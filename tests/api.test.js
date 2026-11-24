import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
const directory = mkdtempSync(join(tmpdir(), "la-fnb-api-"));
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.VERCEL;
process.env.DB_PATH = join(directory, "test.sqlite");
const { app } = await import("../server/index.js");
const { db } = await import("../server/db.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.on("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
async function request(
  path,
  { method = "GET", body, cookie, branch = 1 } = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Branch-Id": String(branch),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
async function login(role = "admin") {
  const r = await request("/auth/login", {
    method: "POST",
    body: { email: `${role}@lafnb.vn`, password: "LaFnb@2026" },
  });
  assert.equal(r.status, 200);
  assert.ok(r.cookie);
  return r.cookie;
}
const closeTo = (a, b) =>
  assert.ok(Math.abs(a - b) < 0.00001, `${a} should equal ${b}`);
test("F&B transactional and branch isolation integration", async (t) => {
  const admin = await login(),
    cashier = await login("cashier"),
    kitchen = await login("kitchen");
  const req = (path, options = {}) =>
    request(path, { cookie: admin, ...options });
  const bootstrap = async (branch = 1) =>
    (await req("/bootstrap", { branch })).data;
  let created, initial, initialBranch2, newCustomer;
  await t.test("Authentication and session cookies", async () => {
    assert.equal((await request("/bootstrap")).status, 401);
    assert.equal(
      (
        await request("/auth/login", {
          method: "POST",
          body: { email: "admin@lafnb.vn", password: "incorrect" },
        })
      ).status,
      401,
    );
    const data = await bootstrap();
    assert.equal(data.branches.length, 3);
    assert.equal(data.user.role, "admin");
    assert.ok(!JSON.stringify(data.users).includes("password"));
    assert.equal(data.products.length, 15);
  });
  await t.test(
    "Employee cannot read a different branch or chain report",
    async () => {
      assert.equal(
        (await request("/bootstrap", { cookie: cashier, branch: 2 })).status,
        403,
      );
      assert.equal((await request("/chain", { cookie: cashier })).status, 403);
      assert.equal(
        (await request("/bootstrap", { cookie: kitchen, branch: 2 })).status,
        403,
      );
      const k = (await request("/bootstrap", { cookie: kitchen })).data;
      assert.equal(k.customers.length, 0);
      assert.equal(k.users.length, 0);
      assert.ok(
        k.orders.every((o) => !["completed", "cancelled"].includes(o.status)),
      );
    },
  );
  await t.test(
    "Admin reads isolated branch stock, tables and orders",
    async () => {
      initial = await bootstrap();
      initialBranch2 = await bootstrap(2);
      assert.ok(initial.orders.every((o) => o.branchId === 1));
      assert.ok(initialBranch2.orders.every((o) => o.branchId === 2));
      assert.ok(initialBranch2.tables.every((o) => o.branchId === 2));
      assert.notEqual(
        initial.ingredients[0].stock,
        initialBranch2.ingredients[0].stock,
      );
    },
  );
  await t.test("Customer validation and uniqueness", async () => {
    const r = await req("/customers", {
      method: "POST",
      body: {
        name: "Khách Kiểm Thử",
        phone: "0909998877",
        email: "test@example.com",
      },
    });
    assert.equal(r.status, 201);
    newCustomer = r.data.id;
    assert.equal(
      (
        await req("/customers", {
          method: "POST",
          body: { name: "Trùng", phone: "0909998877", email: "" },
        })
      ).status,
      400,
    );
  });
  await t.test(
    "POS calculates price on server and deducts recipe only in selected branch",
    async () => {
      const r = await req("/orders", {
        method: "POST",
        body: {
          type: "dinein",
          tableId: 1,
          customerId: newCustomer,
          discount: 5000,
          note: "Ít đá",
          items: [{ productId: 1, quantity: 2, price: 1 }],
        },
      });
      assert.equal(r.status, 201, JSON.stringify(r.data));
      created = r.data.id;
      const data = await bootstrap(),
        order = data.orders.find((o) => o.id === created);
      assert.equal(order.subtotal, 78000);
      assert.equal(order.tax, 5840);
      assert.equal(order.total, 78840);
      assert.equal(order.status, "pending");
      closeTo(data.ingredients[0].stock, initial.ingredients[0].stock - 0.04);
      closeTo(data.ingredients[1].stock, initial.ingredients[1].stock - 0.12);
      closeTo(
        (await bootstrap(2)).ingredients[0].stock,
        initialBranch2.ingredients[0].stock,
      );
    },
  );
  await t.test(
    "Reject occupied table, foreign branch table and excessive discount",
    async () => {
      for (const body of [
        { type: "dinein", tableId: 1 },
        { type: "dinein", tableId: 13 },
        { type: "takeaway", discount: 9999999 },
      ]) {
        const r = await req("/orders", {
          method: "POST",
          body: { items: [{ productId: 1, quantity: 1 }], ...body },
        });
        assert.ok([400, 409].includes(r.status));
      }
      assert.equal(
        (await bootstrap()).orders.filter((o) => o.id === created).length,
        1,
      );
    },
  );
  await t.test("Insufficient inventory rolls entire order back", async () => {
    const before = await bootstrap();
    const r = await req("/orders", {
      method: "POST",
      body: {
        type: "takeaway",
        items: [
          { productId: 1, quantity: 1 },
          { productId: 2, quantity: 100 },
        ],
      },
    });
    assert.equal(r.status, 409);
    const after = await bootstrap();
    assert.equal(after.orders.length, before.orders.length);
    closeTo(after.ingredients[0].stock, before.ingredients[0].stock);
  });
  await t.test("Branch ownership checked on order mutation", async () => {
    assert.equal(
      (
        await req(`/orders/${created}/status`, {
          method: "PATCH",
          branch: 2,
          body: { status: "cooking" },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await req(`/orders/${created}/pay`, {
          method: "POST",
          branch: 2,
          body: { payment: "card" },
        })
      ).status,
      404,
    );
  });
  await t.test(
    "Payment forbidden before kitchen ready and transitions checked",
    async () => {
      assert.equal(
        (
          await req(`/orders/${created}/pay`, {
            method: "POST",
            body: { payment: "cash", received: 100000 },
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await req(`/orders/${created}/status`, {
            method: "PATCH",
            body: { status: "ready" },
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request(`/orders/${created}/status`, {
            cookie: kitchen,
            method: "PATCH",
            body: { status: "cancelled" },
          })
        ).status,
        403,
      );
      for (const status of ["cooking", "ready"])
        assert.equal(
          (
            await request(`/orders/${created}/status`, {
              cookie: kitchen,
              method: "PATCH",
              body: { status },
            })
          ).status,
          200,
        );
    },
  );
  await t.test("Move table preserves order and releases source", async () => {
    assert.equal(
      (
        await req(`/orders/${created}/table`, {
          method: "PATCH",
          body: { tableId: 3 },
        })
      ).status,
      200,
    );
    assert.equal(
      (await bootstrap()).orders.find((o) => o.id === created).tableId,
      3,
    );
    assert.equal(
      (
        await req(`/orders/${created}/table`, {
          method: "PATCH",
          body: { tableId: 13 },
        })
      ).status,
      400,
    );
  });
  await t.test(
    "Kitchen cannot collect payment; insufficient cash rejected",
    async () => {
      assert.equal(
        (
          await request(`/orders/${created}/pay`, {
            cookie: kitchen,
            method: "POST",
            body: { payment: "cash", received: 100000 },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await req(`/orders/${created}/pay`, {
            method: "POST",
            body: { payment: "cash", received: 1 },
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "Simultaneous payment records revenue and loyalty exactly once",
    async () => {
      const results = await Promise.all(
        [1, 2].map(() =>
          req(`/orders/${created}/pay`, {
            method: "POST",
            body: { payment: "cash", received: 100000 },
          }),
        ),
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      const data = await bootstrap();
      assert.equal(
        data.orders.find((o) => o.id === created).status,
        "completed",
      );
      const c = data.customers.find((c) => c.id === newCustomer);
      assert.equal(c.spent, 78840);
      assert.equal(c.points, 7);
      assert.equal(c.visits, 1);
      assert.equal(
        (
          await req(`/orders/${created}/status`, {
            method: "PATCH",
            body: { status: "cancelled" },
          })
        ).status,
        409,
      );
    },
  );
  await t.test(
    "Cancellation restores exact captured recipe despite recipe edits",
    async () => {
      const before = await bootstrap();
      const r = await req("/orders", {
        method: "POST",
        body: { type: "takeaway", items: [{ productId: 3, quantity: 2 }] },
      });
      assert.equal(r.status, 201);
      const p = before.products.find((p) => p.id === 3);
      assert.equal(
        (
          await req("/products/3", {
            method: "PUT",
            body: {
              ...p,
              available: true,
              recipe: [{ ingredientId: 1, quantity: 0.03 }],
            },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await req(`/orders/${r.data.id}/status`, {
            method: "PATCH",
            body: { status: "cancelled" },
          })
        ).status,
        200,
      );
      closeTo(
        (await bootstrap()).ingredients[0].stock,
        before.ingredients[0].stock,
      );
      assert.equal(
        (
          await req(`/orders/${r.data.id}/status`, {
            method: "PATCH",
            body: { status: "cancelled" },
          })
        ).status,
        409,
      );
    },
  );
  await t.test(
    "Inventory transfer changes both branches atomically and logs both sides",
    async () => {
      const a = await bootstrap(),
        b = await bootstrap(2);
      const r = await req("/stock/transfer", {
        method: "POST",
        body: {
          ingredientId: 1,
          toBranchId: 2,
          quantity: 1,
          reason: "Bổ sung ca sáng",
        },
      });
      assert.equal(r.status, 200);
      const aa = await bootstrap(),
        bb = await bootstrap(2);
      closeTo(aa.ingredients[0].stock, a.ingredients[0].stock - 1);
      closeTo(bb.ingredients[0].stock, b.ingredients[0].stock + 1);
      assert.match(aa.movements[0].reason, /Điều chuyển/);
      assert.match(bb.movements[0].reason, /Điều chuyển/);
      assert.equal(
        (
          await req("/stock/transfer", {
            method: "POST",
            body: {
              ingredientId: 1,
              toBranchId: 2,
              quantity: 999999,
              reason: "Không đủ",
            },
          })
        ).status,
        400,
      );
      closeTo(
        (await bootstrap(2)).ingredients[0].stock,
        bb.ingredients[0].stock,
      );
    },
  );
  await t.test(
    "Create ingredient initializes every branch and stock adjustments reject negatives",
    async () => {
      const r = await req("/ingredients", {
        method: "POST",
        body: {
          name: "Nguyên liệu thử",
          unit: "kg",
          stock: 2,
          threshold: 1,
          cost: 50000,
        },
      });
      assert.equal(r.status, 201, JSON.stringify(r.data));
      assert.equal(
        (await bootstrap(2)).ingredients.find((i) => i.id === r.data.id).stock,
        0,
      );
      assert.equal(
        (
          await req("/stock", {
            method: "POST",
            body: {
              ingredientId: r.data.id,
              quantity: -3,
              reason: "Xuất quá mức",
            },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await req("/stock", {
            method: "POST",
            body: {
              ingredientId: r.data.id,
              quantity: 2,
              reason: "Nhập bổ sung",
            },
          })
        ).status,
        200,
      );
      assert.equal(
        (await bootstrap()).ingredients.find((i) => i.id === r.data.id).stock,
        4,
      );
    },
  );
  await t.test(
    "Branch creation initializes isolated settings and inventory",
    async () => {
      const r = await req("/branches", {
        method: "POST",
        body: {
          name: "Lá · Test",
          address: "12 Test, TP.HCM",
          phone: "0909999999",
        },
      });
      assert.equal(r.status, 201);
      const b = await bootstrap(r.data.id);
      assert.equal(b.orders.length, 0);
      assert.equal(b.tables.length, 0);
      assert.ok(b.ingredients.every((i) => i.stock === 0));
      assert.equal(b.settings.address, "12 Test, TP.HCM");
    },
  );
  await t.test(
    "Staff permissions enforced server-side; admin cannot self-demote",
    async () => {
      assert.equal(
        (
          await request("/products", {
            cookie: cashier,
            method: "POST",
            body: {},
          })
        ).status,
        403,
      );
      assert.equal(
        (await request("/stock", { cookie: kitchen, method: "POST", body: {} }))
          .status,
        403,
      );
      const a = (await bootstrap()).user;
      assert.equal(
        (
          await req(`/users/${a.id}`, {
            method: "PUT",
            body: { ...a, role: "cashier", branchId: 1, active: true },
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "Create branch-assigned employee and disable invalidates session",
    async () => {
      const body = {
        name: "Nhân viên test",
        email: "staff-test@lafnb.vn",
        phone: "",
        role: "cashier",
        branchId: 2,
        active: true,
        password: "TestPass@123",
      };
      assert.equal((await req("/users", { method: "POST", body })).status, 200);
      const result = await request("/auth/login", {
        method: "POST",
        body: { email: body.email, password: body.password },
      });
      assert.equal(result.status, 200);
      assert.equal(
        (await request("/bootstrap", { cookie: result.cookie, branch: 2 }))
          .status,
        200,
      );
      assert.equal(
        (await request("/bootstrap", { cookie: result.cookie, branch: 1 }))
          .status,
        403,
      );
      const user = (await bootstrap()).users.find(
        (u) => u.email === body.email,
      );
      assert.equal(
        (
          await req(`/users/${user.id}`, {
            method: "PUT",
            body: { ...body, active: false },
          })
        ).status,
        200,
      );
      assert.equal(
        (await request("/bootstrap", { cookie: result.cookie, branch: 2 }))
          .status,
        401,
      );
    },
  );
  await t.test("Table reservation and naming scoped to branch", async () => {
    assert.equal(
      (
        await req("/tables/4", {
          method: "PATCH",
          body: { reserved: "Linh · 19:00" },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await req("/tables", {
          method: "POST",
          body: { name: "Bàn 01", zone: "Sân", seats: 4 },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req("/tables", {
          method: "POST",
          body: { name: "Bàn Test", zone: "Sân", seats: 4 },
        })
      ).status,
      201,
    );
  });
  await t.test(
    "Branch tax settings isolated and historical totals unchanged",
    async () => {
      const data = await bootstrap();
      assert.equal(
        (
          await req("/settings", {
            method: "PUT",
            body: { ...data.settings, tax: 10 },
          })
        ).status,
        200,
      );
      assert.equal((await bootstrap(2)).settings.tax, 8);
      const r = await req("/orders", {
        method: "POST",
        body: { type: "takeaway", items: [{ productId: 1, quantity: 1 }] },
      });
      assert.equal(r.status, 201);
      const after = await bootstrap();
      assert.equal(after.orders.find((o) => o.id === r.data.id).tax, 3900);
      assert.equal(after.orders.find((o) => o.id === created).tax, 5840);
    },
  );
  await t.test(
    "POS request retry creates exactly one order and one stock deduction",
    async () => {
      const before = await bootstrap();
      const body = {
        requestKey: randomUUID(),
        type: "takeaway",
        items: [{ productId: 1, quantity: 1 }],
      };
      const results = await Promise.all([
        req("/orders", { method: "POST", body }),
        req("/orders", { method: "POST", body }),
      ]);
      assert.ok(results.every((r) => r.status === 201));
      assert.equal(results[0].data.id, results[1].data.id);
      const after = await bootstrap();
      assert.equal(after.orders.length, before.orders.length + 1);
      closeTo(after.ingredients[0].stock, before.ingredients[0].stock - 0.02);
      assert.equal(
        (
          await req("/orders", {
            method: "POST",
            body: { ...body, note: "Changed retry" },
          })
        ).status,
        409,
      );
    },
  );
  await t.test(
    "Cross-origin mutations rejected while same-host browser login succeeds",
    async () => {
      const bad = await fetch(base + "/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://unrelated.example",
        },
        body: JSON.stringify({
          email: "admin@lafnb.vn",
          password: "LaFnb@2026",
        }),
      });
      assert.equal(bad.status, 403);
      const good = await fetch(base + "/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: new URL(base).origin,
        },
        body: JSON.stringify({
          email: "admin@lafnb.vn",
          password: "LaFnb@2026",
        }),
      });
      assert.equal(good.status, 200);
    },
  );
  await t.test(
    "Password update invalidates other sessions and logout revokes access",
    async () => {
      const second = await login();
      assert.equal(
        (
          await req("/auth/password", {
            method: "PUT",
            body: { currentPassword: "bad", newPassword: "Updated@123" },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await req("/auth/password", {
            method: "PUT",
            body: { currentPassword: "LaFnb@2026", newPassword: "Updated@123" },
          })
        ).status,
        200,
      );
      assert.equal(
        (await request("/bootstrap", { cookie: second })).status,
        401,
      );
      assert.equal(
        (await req("/auth/logout", { method: "POST", body: {} })).status,
        200,
      );
      assert.equal((await req("/bootstrap")).status, 401);
    },
  );
});
test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
