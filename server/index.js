import express from "express";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { all, one, run, transaction } from "./queries.js";

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "same-origin");
  if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    !req.is("application/json")
  )
    return res.status(415).json({ error: "Yêu cầu phải sử dụng JSON." });
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).hostname !== req.hostname)
        return res.status(403).json({ error: "Nguồn yêu cầu không hợp lệ." });
    } catch {
      return res.status(403).json({ error: "Nguồn yêu cầu không hợp lệ." });
    }
  }
  next();
});
const hash = (s) => createHash("sha256").update(s).digest("hex");
const tokenFrom = (req) =>
  (req.headers.cookie || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("la_session="))
    ?.slice(11);
const fail = (message, status = 400) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const idOf = (value) => z.coerce.number().int().positive().parse(value);
const text = z.string().trim().min(1).max(160);
const money = z.number().int().min(0).max(1000000000);
const safeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
  phone: u.phone,
  branchId: u.branchId,
});
const loginAttempts = new Map();
app.get("/api/health", async (req, res) => {
  await one("SELECT id FROM branches LIMIT 1");
  res.json({ ok: true });
});
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const key = req.ip;
    const now = Date.now();
    let entry = loginAttempts.get(key);
    if (!entry || now - entry.start > 15 * 60000) {
      entry = { count: 0, start: now };
      loginAttempts.set(key, entry);
    }
    if (entry.count >= 20)
      fail(
        "Bạn thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.",
        429,
      );
    const { email, password } = z
      .object({
        email: z.string().email().max(160),
        password: z.string().max(128),
      })
      .parse(req.body);
    const user = await one(
      "SELECT * FROM users WHERE email=? AND active=1",
      email.toLowerCase(),
    );
    if (!user || !(await bcrypt.compare(password, user.password))) {
      entry.count++;
      fail("Email hoặc mật khẩu chưa đúng.", 401);
    }
    const token = randomBytes(32).toString("hex");
    await run("DELETE FROM sessions WHERE expires<?", now);
    await run(
      "INSERT INTO sessions VALUES (?,?,?)",
      hash(token),
      user.id,
      now + 12 * 3600000,
    );
    loginAttempts.delete(key);
    res
      .cookie("la_session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure:
          process.env.VERCEL === "1" || process.env.COOKIE_SECURE === "true",
        maxAge: 12 * 3600000,
        path: "/",
      })
      .json({ user: safeUser(user) });
  } catch (e) {
    next(e);
  }
});
app.use("/api", async (req, res, next) => {
  const token = tokenFrom(req);
  const user =
    token &&
    (await one(
      "SELECT users.* FROM users JOIN sessions ON users.id=sessions.userId WHERE sessions.token=? AND sessions.expires>? AND users.active=1",
      hash(token),
      Date.now(),
    ));
  if (!user)
    return res.status(401).json({ error: "Vui lòng đăng nhập để tiếp tục." });
  req.user = user;
  const requested = Number(req.headers["x-branch-id"] || user.branchId || 1);
  if (
    !Number.isInteger(requested) ||
    !(await one("SELECT id FROM branches WHERE id=? AND active=1", requested))
  )
    return res.status(400).json({ error: "Chi nhánh không hợp lệ." });
  if (user.role !== "admin" && requested !== user.branchId)
    return res
      .status(403)
      .json({ error: "Bạn không có quyền truy cập chi nhánh này." });
  req.branchId = requested;
  next();
});
const roles =
  (...allowed) =>
  (req, res, next) =>
    allowed.includes(req.user.role)
      ? next()
      : res
          .status(403)
          .json({ error: "Tài khoản không có quyền thực hiện thao tác này." });
app.post("/api/auth/logout", async (req, res) => {
  const token = tokenFrom(req);
  if (token) await run("DELETE FROM sessions WHERE token=?", hash(token));
  res.clearCookie("la_session", { path: "/" }).json({ ok: true });
});
app.put("/api/auth/password", async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = z
      .object({
        currentPassword: z.string(),
        newPassword: z.string().min(8).max(128),
      })
      .parse(req.body);
    if (!(await bcrypt.compare(currentPassword, req.user.password)))
      fail("Mật khẩu hiện tại chưa đúng.");
    await run(
      "UPDATE users SET password=? WHERE id=?",
      await bcrypt.hash(newPassword, 10),
      req.user.id,
    );
    await run(
      "DELETE FROM sessions WHERE userId=? AND token<>?",
      req.user.id,
      hash(tokenFrom(req)),
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
async function getOrders(branchId) {
  const items = await all("SELECT * FROM order_items ORDER BY id");
  return (
    await all(
      "SELECT orders.*,dining_tables.name AS tableName,customers.name AS customerName,users.name AS staffName FROM orders LEFT JOIN dining_tables ON orders.tableId=dining_tables.id LEFT JOIN customers ON orders.customerId=customers.id JOIN users ON users.id=orders.staffId WHERE orders.branchId=? ORDER BY orders.id DESC",
      branchId,
    )
  ).map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) }));
}
async function branchIngredients(branchId) {
  return await all(
    "SELECT ingredients.id,ingredients.name,ingredients.unit,ingredients.cost,branch_stock.stock,branch_stock.threshold FROM ingredients JOIN branch_stock ON ingredients.id=branch_stock.ingredientId WHERE branch_stock.branchId=?",
    branchId,
  );
}
app.get("/api/bootstrap", async (req, res) =>
  res.json({
    user: safeUser(req.user),
    branchId: req.branchId,
    branches: (await all("SELECT * FROM branches WHERE active=1")).filter(
      (b) => req.user.role === "admin" || b.id === req.user.branchId,
    ),
    settings: await one("SELECT * FROM settings WHERE id=?", req.branchId),
    products: await all("SELECT * FROM products"),
    ingredients: await branchIngredients(req.branchId),
    recipes: await all("SELECT * FROM recipes"),
    tables: await all(
      "SELECT * FROM dining_tables WHERE branchId=?",
      req.branchId,
    ),
    customers:
      req.user.role === "kitchen"
        ? []
        : await all("SELECT * FROM customers ORDER BY id DESC"),
    users:
      req.user.role === "admin"
        ? await all(
            "SELECT id,name,email,role,active,phone,branchId FROM users",
          )
        : [],
    orders: (await getOrders(req.branchId)).filter(
      (o) =>
        req.user.role !== "kitchen" ||
        !["completed", "cancelled"].includes(o.status),
    ),
    movements:
      req.user.role === "admin"
        ? await all(
            "SELECT stock_movements.*,ingredients.name,ingredients.unit,users.name AS staffName FROM stock_movements JOIN ingredients ON ingredients.id=stock_movements.ingredientId JOIN users ON users.id=stock_movements.staffId WHERE stock_movements.branchId=? ORDER BY stock_movements.id DESC LIMIT 100",
            req.branchId,
          )
        : [],
  }),
);
app.get("/api/chain", roles("admin"), async (req, res) =>
  res.json({
    branches: await Promise.all(
      (await all("SELECT * FROM branches WHERE active=1")).map(async (b) => ({
        ...b,
        orders: await getOrders(b.id),
        ingredients: await branchIngredients(b.id),
        tables: await all("SELECT * FROM dining_tables WHERE branchId=?", b.id),
      })),
    ),
  }),
);
app.post("/api/branches", roles("admin"), async (req, res) => {
  const b = z
    .object({ name: text, address: text, phone: z.string().min(8).max(20) })
    .parse(req.body);
  if (await one("SELECT id FROM branches WHERE name=?", b.name))
    fail("Tên chi nhánh đã tồn tại.");
  const id = await transaction(async () => {
    const id = Number(
      (
        await run(
          "INSERT INTO branches (name,address,phone) VALUES (?,?,?)",
          b.name,
          b.address,
          b.phone,
        )
      ).lastInsertRowid,
    );
    await run(
      "INSERT INTO settings VALUES (?,?,?,?,?,?)",
      id,
      "Lá Coffee & Kitchen",
      b.address,
      b.phone,
      8,
      "Cảm ơn bạn đã ghé Lá!",
    );
    for (const i of await all("SELECT * FROM ingredients"))
      await run(
        "INSERT INTO branch_stock VALUES (?,?,?,?)",
        id,
        i.id,
        0,
        i.threshold,
      );
    return id;
  });
  res.status(201).json({ id });
});
app.post("/api/stock/transfer", roles("admin"), async (req, res) => {
  const b = z
    .object({
      ingredientId: z.number().int().positive(),
      toBranchId: z.number().int().positive(),
      quantity: z.number().positive().max(1e6),
      reason: z.string().trim().min(3).max(500),
    })
    .parse(req.body);
  await transaction(async () => {
    if (b.toBranchId === req.branchId)
      fail("Chọn chi nhánh nhận khác chi nhánh xuất.");
    if (
      !(await one(
        "SELECT id FROM branches WHERE id=? AND active=1",
        b.toBranchId,
      ))
    )
      fail("Chi nhánh nhận không hợp lệ.");
    const source = await one(
      "SELECT stock FROM branch_stock WHERE branchId=? AND ingredientId=?",
      req.branchId,
      b.ingredientId,
    );
    if (!source || source.stock < b.quantity)
      fail("Tồn kho không đủ để điều chuyển.");
    for (const [branchId, quantity] of [
      [req.branchId, -b.quantity],
      [b.toBranchId, b.quantity],
    ]) {
      await run(
        "UPDATE branch_stock SET stock=ROUND(stock+?,6) WHERE branchId=? AND ingredientId=?",
        quantity,
        branchId,
        b.ingredientId,
      );
      await run(
        "INSERT INTO stock_movements (ingredientId,quantity,reason,createdAt,staffId,branchId) VALUES (?,?,?,?,?,?)",
        b.ingredientId,
        quantity,
        `Điều chuyển CN ${req.branchId} → ${b.toBranchId}: ${b.reason}`,
        new Date().toISOString(),
        req.user.id,
        branchId,
      );
    }
  });
  res.json({ ok: true });
});

const orderSchema = z.object({
  requestKey: z.string().uuid().optional(),
  type: z.enum(["dinein", "takeaway", "delivery"]),
  tableId: z.number().int().positive().nullable().optional(),
  customerId: z.number().int().positive().nullable().optional(),
  discount: money.default(0),
  note: z.string().max(1000).default(""),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(100),
});
app.post("/api/orders", roles("admin", "cashier"), async (req, res) => {
  const body = orderSchema.parse(req.body);
  const result = await transaction(async () => {
    if (body.requestKey) {
      const existing = await one(
        "SELECT * FROM order_requests WHERE requestKey=?",
        body.requestKey,
      );
      if (existing) {
        if (
          existing.branchId !== req.branchId ||
          existing.staffId !== req.user.id ||
          existing.fingerprint !== hash(JSON.stringify(body))
        )
          fail(
            "Mã yêu cầu đã được sử dụng cho đơn khác. Vui lòng xóa đơn nháp để tạo lại.",
            409,
          );
        return { id: existing.orderId };
      }
    }
    if (body.type === "dinein") {
      if (!body.tableId) fail("Vui lòng chọn bàn.");
      if (
        !(await one(
          "SELECT id FROM dining_tables WHERE id=? AND branchId=?",
          body.tableId,
          req.branchId,
        ))
      )
        fail("Bàn không tồn tại.");
      if (
        await one(
          "SELECT id FROM orders WHERE tableId=? AND status NOT IN ('completed','cancelled')",
          body.tableId,
        )
      )
        fail("Bàn đang có đơn hàng. Vui lòng xử lý đơn hiện tại trước.", 409);
    }
    if (
      body.customerId &&
      !(await one("SELECT id FROM customers WHERE id=?", body.customerId))
    )
      fail("Khách hàng không tồn tại.");
    const combined = new Map();
    for (const i of body.items)
      combined.set(i.productId, (combined.get(i.productId) || 0) + i.quantity);
    const items = [];
    for (const [id, quantity] of combined) {
      if (quantity > 100) fail("Số lượng mỗi món tối đa 100.");
      const p = await one(
        "SELECT * FROM products WHERE id=? AND available=1",
        id,
      );
      if (!p) fail("Một món đã ngừng bán. Vui lòng tải lại thực đơn.");
      items.push({ ...p, quantity });
    }
    const subtotal = items.reduce((s, p) => s + p.price * p.quantity, 0);
    if (body.discount > subtotal)
      fail("Giảm giá không được vượt quá tạm tính.");
    const tax = Math.round(
      ((subtotal - body.discount) *
        (await one("SELECT tax FROM settings WHERE id=?", req.branchId)).tax) /
        100,
    );
    const needs = new Map();
    for (const item of items)
      for (const r of await all(
        "SELECT * FROM recipes WHERE productId=?",
        item.id,
      ))
        needs.set(
          r.ingredientId,
          (needs.get(r.ingredientId) || 0) + r.quantity * item.quantity,
        );
    for (const [id, quantity] of needs) {
      const i = await one(
        "SELECT ingredients.name,branch_stock.stock FROM ingredients JOIN branch_stock ON ingredients.id=branch_stock.ingredientId WHERE ingredients.id=? AND branch_stock.branchId=?",
        id,
        req.branchId,
      );
      if (i.stock + 1e-8 < quantity)
        fail(
          `Không đủ ${i.name} (còn ${Number(i.stock.toFixed(3))} ${i.unit}).`,
          409,
        );
    }
    const id = Number(
      (
        await run(
          "INSERT INTO orders (type,tableId,customerId,status,subtotal,discount,tax,total,note,createdAt,staffId,branchId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
          body.type,
          body.type === "dinein" ? body.tableId : null,
          body.customerId || null,
          "pending",
          subtotal,
          body.discount,
          tax,
          subtotal - body.discount + tax,
          body.note,
          new Date().toISOString(),
          req.user.id,
          req.branchId,
        )
      ).lastInsertRowid,
    );
    for (const i of items)
      await run(
        "INSERT INTO order_items (orderId,productId,name,price,cost,quantity) VALUES (?,?,?,?,?,?)",
        id,
        i.id,
        i.name,
        i.price,
        i.cost,
        i.quantity,
      );
    for (const [ingredientId, quantity] of needs) {
      await run(
        "UPDATE branch_stock SET stock=ROUND(stock-?,6) WHERE ingredientId=? AND branchId=?",
        quantity,
        ingredientId,
        req.branchId,
      );
      await run(
        "INSERT INTO order_stock VALUES (?,?,?)",
        id,
        ingredientId,
        quantity,
      );
      await run(
        "INSERT INTO stock_movements (ingredientId,quantity,reason,createdAt,staffId,branchId) VALUES (?,?,?,?,?,?)",
        ingredientId,
        -quantity,
        `Xuất cho đơn #LA-${id + 1000}`,
        new Date().toISOString(),
        req.user.id,
        req.branchId,
      );
    }
    if (body.type === "dinein")
      await run(
        "UPDATE dining_tables SET reserved='' WHERE id=?",
        body.tableId,
      );
    if (body.requestKey)
      await run(
        "INSERT INTO order_requests VALUES (?,?,?,?,?)",
        body.requestKey,
        id,
        req.branchId,
        req.user.id,
        hash(JSON.stringify(body)),
      );
    return { id };
  });
  res.status(201).json(result);
});
app.patch("/api/orders/:id/status", async (req, res) => {
  const id = idOf(req.params.id);
  const { status } = z
    .object({ status: z.enum(["cooking", "ready", "served", "cancelled"]) })
    .parse(req.body);
  await transaction(async () => {
    const order = await one(
      "SELECT * FROM orders WHERE id=? AND branchId=?",
      id,
      req.branchId,
    );
    if (!order) fail("Không tìm thấy đơn hàng.", 404);
    if (req.user.role === "kitchen" && !["cooking", "ready"].includes(status))
      fail("Bếp chỉ có thể cập nhật chế biến.", 403);
    const transitions = {
      pending: ["cooking", "cancelled"],
      cooking: ["ready", "cancelled"],
      ready: ["served", "cancelled"],
      served: ["cancelled"],
    };
    if (!transitions[order.status]?.includes(status))
      fail("Trạng thái đã thay đổi. Vui lòng tải lại.", 409);
    if (status === "cancelled")
      for (const r of await all(
        "SELECT * FROM order_stock WHERE orderId=?",
        id,
      )) {
        await run(
          "UPDATE branch_stock SET stock=ROUND(stock+?,6) WHERE ingredientId=? AND branchId=?",
          r.quantity,
          r.ingredientId,
          req.branchId,
        );
        await run(
          "INSERT INTO stock_movements (ingredientId,quantity,reason,createdAt,staffId,branchId) VALUES (?,?,?,?,?,?)",
          r.ingredientId,
          r.quantity,
          `Hoàn kho đơn hủy #LA-${id + 1000}`,
          new Date().toISOString(),
          req.user.id,
          req.branchId,
        );
      }
    await run("UPDATE orders SET status=? WHERE id=?", status, id);
  });
  res.json({ ok: true });
});
app.post("/api/orders/:id/pay", roles("admin", "cashier"), async (req, res) => {
  const id = idOf(req.params.id);
  const body = z
    .object({
      payment: z.enum(["cash", "transfer", "card"]),
      received: money.optional(),
    })
    .parse(req.body);
  await transaction(async () => {
    const order = await one(
      "SELECT * FROM orders WHERE id=? AND branchId=?",
      id,
      req.branchId,
    );
    if (!order) fail("Không tìm thấy đơn hàng.", 404);
    if (!["ready", "served"].includes(order.status))
      fail("Chỉ thanh toán khi món đã sẵn sàng hoặc đã phục vụ.", 409);
    if (body.payment === "cash" && (body.received ?? 0) < order.total)
      fail("Số tiền khách đưa chưa đủ.");
    await run(
      "UPDATE orders SET status=?,payment=?,received=?,paidAt=? WHERE id=?",
      "completed",
      body.payment,
      body.payment === "cash" ? body.received : order.total,
      new Date().toISOString(),
      id,
    );
    if (order.customerId)
      await run(
        "UPDATE customers SET spent=spent+?,visits=visits+1,points=points+? WHERE id=?",
        order.total,
        Math.floor(order.total / 10000),
        order.customerId,
      );
  });
  res.json({ ok: true });
});
app.patch(
  "/api/orders/:id/table",
  roles("admin", "cashier"),
  async (req, res) => {
    const id = idOf(req.params.id);
    const tableId = idOf(req.body.tableId);
    await transaction(async () => {
      const order = await one(
        "SELECT * FROM orders WHERE id=? AND branchId=?",
        id,
        req.branchId,
      );
      if (
        !order ||
        order.type !== "dinein" ||
        ["completed", "cancelled"].includes(order.status)
      )
        fail("Đơn không thể chuyển bàn.");
      if (
        !(await one(
          "SELECT id FROM dining_tables WHERE id=? AND reserved='' AND branchId=?",
          tableId,
          req.branchId,
        ))
      )
        fail("Bàn không khả dụng.");
      if (
        await one(
          "SELECT id FROM orders WHERE tableId=? AND status NOT IN ('completed','cancelled')",
          tableId,
        )
      )
        fail("Bàn đã có khách.", 409);
      await run("UPDATE orders SET tableId=? WHERE id=?", tableId, id);
    });
    res.json({ ok: true });
  },
);

const productSchema = z.object({
  name: text,
  category: z.enum(["Cà phê", "Trà & trái cây", "Món chính", "Bánh ngọt"]),
  price: money,
  cost: money,
  image: z
    .string()
    .max(500)
    .refine(
      (s) => !s || s.startsWith("/images/") || /^https:\/\//.test(s),
      "Ảnh phải là đường dẫn /images/ hoặc HTTPS.",
    )
    .default(""),
  description: z.string().max(1000).default(""),
  available: z.boolean().default(true),
  recipe: z
    .array(
      z.object({
        ingredientId: z.number().int().positive(),
        quantity: z.number().positive().max(10000),
      }),
    )
    .max(50)
    .default([]),
});
async function saveProduct(req, res) {
  const b = productSchema.parse(req.body);
  const id = req.params.id ? idOf(req.params.id) : null;
  const result = await transaction(async () => {
    if (id && !(await one("SELECT id FROM products WHERE id=?", id)))
      fail("Không tìm thấy món.", 404);
    if (new Set(b.recipe.map((r) => r.ingredientId)).size !== b.recipe.length)
      fail("Nguyên liệu bị trùng trong công thức.");
    for (const r of b.recipe)
      if (!(await one("SELECT id FROM ingredients WHERE id=?", r.ingredientId)))
        fail("Nguyên liệu không tồn tại.");
    let productId = id;
    if (id)
      await run(
        "UPDATE products SET name=?,category=?,price=?,cost=?,image=?,description=?,available=? WHERE id=?",
        b.name,
        b.category,
        b.price,
        b.cost,
        b.image,
        b.description,
        +b.available,
        id,
      );
    else
      productId = Number(
        (
          await run(
            "INSERT INTO products (name,category,price,cost,image,description,available) VALUES (?,?,?,?,?,?,?)",
            b.name,
            b.category,
            b.price,
            b.cost,
            b.image,
            b.description,
            +b.available,
          )
        ).lastInsertRowid,
      );
    await run("DELETE FROM recipes WHERE productId=?", productId);
    for (const r of b.recipe)
      await run(
        "INSERT INTO recipes VALUES (?,?,?)",
        productId,
        r.ingredientId,
        r.quantity,
      );
    return { id: productId };
  });
  res.status(id ? 200 : 201).json(result);
}
app.post("/api/products", roles("admin"), saveProduct);
app.put("/api/products/:id", roles("admin"), saveProduct);
app.post("/api/ingredients", roles("admin"), async (req, res) => {
  const b = z
    .object({
      name: text,
      unit: text,
      stock: z.number().min(0).max(1e6),
      threshold: z.number().min(0).max(1e6),
      cost: money,
    })
    .parse(req.body);
  const id = await transaction(async () => {
    const id = Number(
      (
        await run(
          "INSERT INTO ingredients (name,unit,stock,threshold,cost) VALUES (?,?,?,?,?)",
          b.name,
          b.unit,
          b.stock,
          b.threshold,
          b.cost,
        )
      ).lastInsertRowid,
    );
    await run(
      "INSERT INTO stock_movements (ingredientId,quantity,reason,createdAt,staffId,branchId) VALUES (?,?,?,?,?,?)",
      id,
      b.stock,
      "Tồn kho đầu kỳ",
      new Date().toISOString(),
      req.user.id,
      req.branchId,
    );
    for (const branch of await all("SELECT id FROM branches"))
      await run(
        "INSERT INTO branch_stock VALUES (?,?,?,?)",
        branch.id,
        id,
        branch.id === req.branchId ? b.stock : 0,
        b.threshold,
      );
    return id;
  });
  res.status(201).json({ id });
});
app.post("/api/stock", roles("admin"), async (req, res) => {
  const b = z
    .object({
      ingredientId: z.number().int().positive(),
      quantity: z
        .number()
        .min(-1e6)
        .max(1e6)
        .refine((n) => n !== 0),
      reason: z.string().trim().min(3).max(500),
    })
    .parse(req.body);
  await transaction(async () => {
    const i = await one(
      "SELECT * FROM branch_stock WHERE ingredientId=? AND branchId=?",
      b.ingredientId,
      req.branchId,
    );
    if (!i) fail("Nguyên liệu không tồn tại.", 404);
    if (i.stock + b.quantity < 0) fail("Tồn kho không thể âm.");
    await run(
      "UPDATE branch_stock SET stock=ROUND(stock+?,6) WHERE ingredientId=? AND branchId=?",
      b.quantity,
      b.ingredientId,
      req.branchId,
    );
    await run(
      "INSERT INTO stock_movements (ingredientId,quantity,reason,createdAt,staffId,branchId) VALUES (?,?,?,?,?,?)",
      b.ingredientId,
      b.quantity,
      b.reason,
      new Date().toISOString(),
      req.user.id,
      req.branchId,
    );
  });
  res.json({ ok: true });
});
const customerSchema = z.object({
  name: text,
  phone: z.string().regex(/^[+\d][\d\s-]{8,14}$/),
  email: z.union([z.string().email().max(160), z.literal("")]).default(""),
});
async function saveCustomer(req, res) {
  const b = customerSchema.parse(req.body);
  const id = req.params.id ? idOf(req.params.id) : null;
  if (
    await one(
      "SELECT id FROM customers WHERE phone=? AND id<>?",
      b.phone,
      id || 0,
    )
  )
    fail("Số điện thoại đã được sử dụng.");
  if (id) {
    if (!(await one("SELECT id FROM customers WHERE id=?", id)))
      fail("Không tìm thấy khách hàng.", 404);
    await run(
      "UPDATE customers SET name=?,phone=?,email=? WHERE id=?",
      b.name,
      b.phone,
      b.email,
      id,
    );
  } else {
    const result = await run(
      "INSERT INTO customers (name,phone,email) VALUES (?,?,?)",
      b.name,
      b.phone,
      b.email,
    );
    return res.status(201).json({ id: Number(result.lastInsertRowid) });
  }
  res.json({ ok: true });
}
app.post("/api/customers", roles("admin", "cashier"), saveCustomer);
app.put("/api/customers/:id", roles("admin", "cashier"), saveCustomer);
app.post("/api/tables", roles("admin"), async (req, res) => {
  const b = z
    .object({ name: text, zone: text, seats: z.number().int().min(1).max(50) })
    .parse(req.body);
  if (
    await one(
      "SELECT id FROM dining_tables WHERE name=? AND branchId=?",
      b.name,
      req.branchId,
    )
  )
    fail("Tên bàn đã tồn tại.");
  const result = await run(
    "INSERT INTO dining_tables (name,zone,seats,branchId) VALUES (?,?,?,?)",
    b.name,
    b.zone,
    b.seats,
    req.branchId,
  );
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});
app.patch("/api/tables/:id", roles("admin", "cashier"), async (req, res) => {
  const id = idOf(req.params.id);
  const reserved = z.string().trim().max(250).parse(req.body.reserved);
  if (
    !(await one(
      "SELECT id FROM dining_tables WHERE id=? AND branchId=?",
      id,
      req.branchId,
    ))
  )
    fail("Không tìm thấy bàn.", 404);
  if (
    await one(
      "SELECT id FROM orders WHERE tableId=? AND status NOT IN ('completed','cancelled')",
      id,
    )
  )
    fail("Bàn đang phục vụ.", 409);
  await run("UPDATE dining_tables SET reserved=? WHERE id=?", reserved, id);
  res.json({ ok: true });
});
const staffSchema = z.object({
  name: text,
  email: z
    .string()
    .email()
    .max(160)
    .transform((v) => v.toLowerCase()),
  phone: z.string().max(20).default(""),
  role: z.enum(["admin", "cashier", "kitchen"]),
  active: z.boolean(),
  branchId: z.number().int().positive().nullable(),
  password: z.string().min(8).max(128).optional(),
});
async function saveStaff(req, res, next) {
  try {
    const b = staffSchema.parse(req.body);
    const id = req.params.id ? idOf(req.params.id) : null;
    if (b.role !== "admin" && !b.branchId)
      fail("Nhân viên phải được phân công chi nhánh.");
    if (
      b.branchId &&
      !(await one("SELECT id FROM branches WHERE id=?", b.branchId))
    )
      fail("Chi nhánh không tồn tại.");
    if (id === req.user.id && (!b.active || b.role !== "admin"))
      fail("Bạn không thể tự khóa hoặc đổi quyền quản trị của mình.");
    if (
      await one(
        "SELECT id FROM users WHERE email=? AND id<>?",
        b.email,
        id || 0,
      )
    )
      fail("Email đã được sử dụng.");
    if (id && !(await one("SELECT id FROM users WHERE id=?", id)))
      fail("Không tìm thấy nhân viên.", 404);
    if (!id && !b.password) fail("Vui lòng nhập mật khẩu cho nhân viên mới.");
    const password = b.password ? await bcrypt.hash(b.password, 10) : null;
    await transaction(async () => {
      if (id) {
        await run(
          "UPDATE users SET name=?,email=?,phone=?,role=?,active=?,branchId=? WHERE id=?",
          b.name,
          b.email,
          b.phone,
          b.role,
          +b.active,
          b.branchId,
          id,
        );
        if (password)
          await run("UPDATE users SET password=? WHERE id=?", password, id);
        await run(
          "DELETE FROM sessions WHERE userId=? AND userId<>?",
          id,
          req.user.id,
        );
      } else
        await run(
          "INSERT INTO users (name,email,phone,role,active,password,branchId) VALUES (?,?,?,?,?,?,?)",
          b.name,
          b.email,
          b.phone,
          b.role,
          +b.active,
          password,
          b.branchId,
        );
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
app.post("/api/users", roles("admin"), saveStaff);
app.put("/api/users/:id", roles("admin"), saveStaff);
app.put("/api/settings", roles("admin"), async (req, res) => {
  const b = z
    .object({
      name: text,
      address: z.string().min(1).max(300),
      phone: z.string().min(8).max(20),
      tax: z.number().min(0).max(30),
      receiptNote: z.string().max(500),
    })
    .parse(req.body);
  await transaction(async () => {
    await run(
      "UPDATE settings SET name=?,address=?,phone=?,tax=?,receiptNote=? WHERE id=?",
      b.name,
      b.address,
      b.phone,
      b.tax,
      b.receiptNote,
      req.branchId,
    );
    await run(
      "UPDATE branches SET address=?,phone=? WHERE id=?",
      b.address,
      b.phone,
      req.branchId,
    );
  });
  res.json({ ok: true });
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Không tìm thấy chức năng." }),
);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (req, res) => res.sendFile(resolve("dist/index.html")));
}
app.use((error, req, res, next) => {
  if (error instanceof z.ZodError)
    return res.status(400).json({
      error: "Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường nhập.",
      details: error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  if (error.type === "entity.parse.failed")
    return res.status(400).json({ error: "Dữ liệu JSON không hợp lệ." });
  if (!error.status) console.error(error);
  res.status(error.status || 500).json({
    error: error.status
      ? error.message
      : "Không thể xử lý yêu cầu. Vui lòng thử lại.",
  });
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3001;
  app.listen(port, "0.0.0.0", () =>
    console.log(`Lá F&B server: http://localhost:${port}`),
  );
}
