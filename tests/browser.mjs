import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const directory = mkdtempSync(join(tmpdir(), "la-fnb-browser-"));
process.env.DB_PATH = join(directory, "test.sqlite");
process.env.NODE_ENV = "production";
const { app } = await import("../server/index.js");
const { db } = await import("../server/db.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.on("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
mkdirSync("test-results", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1366, height: 900 },
  locale: "vi-VN",
  timezoneId: "Asia/Ho_Chi_Minh",
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const go = async (route) => {
  await page.goto(base + "/#" + route);
  await page.waitForSelector(".page-" + route);
  await page.evaluate(() => document.fonts.ready);
};
const bootstrap = async (branch = 1) =>
  (
    await context.request.get(base + "/api/bootstrap", {
      headers: { "X-Branch-Id": String(branch) },
    })
  ).json();
const result = { viewports: [], functional: [], accessibility: [] };
async function check(name, fn) {
  await fn();
  console.log("PASS", name);
  result.functional.push(name);
}
try {
  await page.goto(base);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForSelector(".overview-banner");
  await page.evaluate(() => document.fonts.ready);
  await check("Customer creation and editing", async () => {
    await go("customers");
    await page
      .getByRole("button", { name: "Thêm khách hàng", exact: true })
      .click();
    await page.getByLabel("Họ và tên").fill("Khách trình duyệt");
    await page.getByLabel("Số điện thoại", { exact: true }).fill("0901239876");
    await page.getByLabel("Email (không bắt buộc)").fill("browser@example.com");
    await page
      .getByRole("button", { name: "Lưu khách hàng", exact: true })
      .click();
    await page.waitForSelector(".modal", { state: "detached" });
    await page
      .getByLabel("Tìm tên, số điện thoại, email...")
      .fill("Khách trình duyệt");
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page
      .getByRole("button", { name: "Sửa Khách trình duyệt", exact: true })
      .click();
    await page.getByLabel("Họ và tên").fill("Khách kiểm thử UI");
    await page
      .getByRole("button", { name: "Lưu khách hàng", exact: true })
      .click();
    await page.waitForSelector(".modal", { state: "detached" });
  });
  let orderId;
  await check(
    "Full POS → kitchen → cash payment → receipt and stock persistence",
    async () => {
      await go("pos");
      await page.getByRole("button", { name: "Mang đi", exact: true }).click();
      const before = await bootstrap();
      const customer = before.customers.find((c) => c.phone === "0901239876");
      await page
        .getByLabel("Khách hàng", { exact: true })
        .selectOption(String(customer.id));
      await page
        .getByRole("button", { name: "Thêm Cà phê sữa đá", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Thêm Cà phê sữa đá", exact: true })
        .click();
      await page.getByLabel("Giảm giá (₫)").fill("5000");
      await page.getByLabel("Ghi chú đơn hàng").fill("Ít đá, kiểm thử UI");
      await page
        .getByRole("button", { name: "Tạo đơn & gửi bếp", exact: true })
        .click();
      await page.waitForSelector(".order-detail-meta");
      assert.ok(
        await page
          .getByRole("dialog")
          .getByText("Chờ xác nhận", { exact: true })
          .isVisible(),
      );
      await page
        .getByRole("button", { name: "Bắt đầu chế biến", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Món đã sẵn sàng", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Thanh toán", exact: true })
        .click();
      await page.getByLabel("Tiền khách đưa (₫)").fill("100000");
      await page
        .getByRole("button", { name: "Xác nhận đã thu tiền", exact: true })
        .click();
      await page.waitForSelector(".payment-success");
      assert.match(
        await page.locator(".payment-success").innerText(),
        /21.160/,
      );
      const after = await bootstrap();
      const order = after.orders.find((o) => o.note === "Ít đá, kiểm thử UI");
      orderId = order.id;
      assert.equal(order.total, 78840);
      assert.equal(order.status, "completed");
      assert.equal(after.customers.find((c) => c.id === customer.id).points, 7);
      assert.ok(
        Math.abs(
          after.ingredients[0].stock - (before.ingredients[0].stock - 0.04),
        ) < 1e-6,
      );
      await context.addInitScript(() => {
        window.print = () => {};
      });
      const popPromise = context.waitForEvent("page");
      await page.getByRole("button", { name: "In phiếu", exact: true }).click();
      const pop = await popPromise;
      await pop.waitForLoadState();
      assert.match(await pop.locator("body").innerText(), /HÓA ĐƠN BÁN HÀNG/);
      await pop.close();
      await page.getByRole("button", { name: "Đóng", exact: true }).click();
      await page.reload();
      await page.waitForSelector(".pos-cart");
      assert.equal(await page.locator(".cart-item").count(), 0);
    },
  );
  await check("Table creation, reservation and draft selection", async () => {
    await go("tables");
    await page.getByRole("button", { name: "Thêm bàn", exact: true }).click();
    await page.getByLabel("Tên bàn").fill("Bàn kiểm thử");
    await page.getByLabel("Khu vực").fill("Tầng 1");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Thêm bàn", exact: true })
      .click();
    await page.waitForSelector(".modal", { state: "detached" });
    await page
      .getByRole("button")
      .filter({ has: page.getByText("Bàn kiểm thử", { exact: true }) })
      .click();
    await page
      .getByLabel("Thông tin đặt bàn")
      .fill("Khách thử · 19:00 · 0901239876");
    await page
      .getByRole("button", { name: "Lưu đặt bàn", exact: true })
      .click();
    await page.waitForSelector(".modal", { state: "detached" });
    assert.match(
      await page.locator(".dining-table.reserved").innerText(),
      /Khách thử/,
    );
    await page
      .getByRole("button")
      .filter({ has: page.getByText("Bàn kiểm thử", { exact: true }) })
      .click();
    await page
      .getByRole("button", { name: "Tạo đơn cho bàn này", exact: true })
      .click();
    await page.waitForSelector(".pos-cart");
    assert.notEqual(await page.getByLabel("Bàn phục vụ").inputValue(), "");
  });
  await check("Menu edit stores central pricing and recipe", async () => {
    await go("menu");
    await page
      .getByRole("button", { name: "Sửa Americano", exact: true })
      .click();
    await page.getByLabel("Giá bán (₫)").fill("46000");
    await page.getByRole("button", { name: "Lưu món", exact: true }).click();
    await page.waitForSelector(".modal", { state: "detached" });
    assert.equal(
      (await bootstrap(2)).products.find((p) => p.id === 3).price,
      46000,
    );
  });
  await check(
    "Stock transfer conserves total inventory across branches",
    async () => {
      await go("inventory");
      const before1 = await bootstrap(),
        before2 = await bootstrap(2);
      await page
        .getByRole("button", { name: "Điều chuyển", exact: true })
        .click();
      await page.getByLabel("Nguyên liệu", { exact: true }).selectOption("1");
      await page.getByLabel("Chi nhánh nhận").selectOption("2");
      await page.getByLabel("Số lượng theo đơn vị nguyên liệu").fill("0.5");
      await page.getByLabel("Lý do / ghi chú").fill("Điều chuyển kiểm thử UI");
      await page
        .getByRole("button", { name: "Xác nhận điều chuyển", exact: true })
        .click();
      await page.waitForSelector(".modal", { state: "detached" });
      const after1 = await bootstrap(),
        after2 = await bootstrap(2);
      assert.ok(
        Math.abs(
          after1.ingredients[0].stock - before1.ingredients[0].stock + 0.5,
        ) < 1e-6,
      );
      assert.ok(
        Math.abs(
          after2.ingredients[0].stock - before2.ingredients[0].stock - 0.5,
        ) < 1e-6,
      );
    },
  );
  await check("Branch switch isolates orders and updates labels", async () => {
    await page.getByLabel("Chọn chi nhánh").selectOption("2");
    await page.waitForFunction(
      () =>
        document.querySelector(".branch-select select")?.value === "2" &&
        document.querySelector(".page-inventory"),
    );
    await go("orders");
    await page.getByRole("button", { name: "Tất cả", exact: true }).click();
    assert.ok(
      !(await page.locator("body").innerText()).includes(
        `#LA-${orderId + 1000}`,
      ),
    );
    await page.getByLabel("Chọn chi nhánh").selectOption("1");
    await page.waitForFunction(
      () =>
        document.querySelector(".branch-select select")?.value === "1" &&
        document.querySelector(".page-orders"),
    );
  });
  await check("Reports export a real CSV file", async () => {
    await go("reports");
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Xuất báo cáo", exact: true })
      .click();
    const file = await download;
    await file.saveAs("test-results/report.csv");
    assert.match(readFileSync("test-results/report.csv", "utf8"), /Mã đơn/);
    assert.match(readFileSync("test-results/report.csv", "utf8"), /LA-/);
  });
  await check(
    "Staff created for a specific branch and correct restricted UI",
    async () => {
      await go("staff");
      await page
        .getByRole("button", { name: "Thêm nhân viên", exact: true })
        .click();
      await page.getByLabel("Họ và tên").fill("Thu ngân kiểm thử");
      await page.getByLabel("Email đăng nhập").fill("ui-staff@lafnb.vn");
      await page
        .getByLabel("Số điện thoại", { exact: true })
        .fill("0907654321");
      await page.getByLabel("Chi nhánh làm việc").selectOption("2");
      await page.getByLabel("Mật khẩu").fill("TestStaff@123");
      await page
        .getByRole("button", { name: "Lưu nhân viên", exact: true })
        .click();
      await page.waitForSelector(".modal", { state: "detached" });
      const other = await browser.newContext();
      const p = await other.newPage();
      await p.goto(base);
      await p.getByLabel("Email", { exact: true }).fill("ui-staff@lafnb.vn");
      await p.getByLabel("Mật khẩu", { exact: true }).fill("TestStaff@123");
      await p.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await p.waitForSelector(".overview-banner");
      assert.equal(await p.locator(".branch-select option").count(), 1);
      assert.equal(
        await p
          .locator(".nav-link")
          .filter({ hasText: "Quản lý chuỗi" })
          .count(),
        0,
      );
      assert.equal(
        await p
          .locator(".nav-link")
          .filter({ hasText: "Kho nguyên liệu" })
          .count(),
        0,
      );
      await other.close();
    },
  );
  await check(
    "Branch settings save without changing historical receipts",
    async () => {
      await go("settings");
      await page
        .getByLabel("Lời cảm ơn cuối phiếu")
        .fill("Hẹn gặp lại tại Lá — kiểm thử UI.");
      await page
        .getByRole("button", { name: "Lưu cài đặt", exact: true })
        .click();
      await page.waitForSelector(".toast");
      assert.equal(
        (await bootstrap()).settings.receiptNote,
        "Hẹn gặp lại tại Lá — kiểm thử UI.",
      );
    },
  );
  await check(
    "Chain management opens branch with empty stock and tables",
    async () => {
      await go("branches");
      await page
        .getByRole("button", { name: "Mở chi nhánh", exact: true })
        .click();
      await page.getByLabel("Tên chi nhánh").fill("Lá · Kiểm thử UI");
      await page
        .getByLabel("Địa chỉ", { exact: true })
        .fill("12 Đường Kiểm Thử");
      await page.getByLabel("Điện thoại", { exact: true }).fill("0901234567");
      await page
        .getByRole("button", { name: "Tạo chi nhánh", exact: true })
        .click();
      await page.waitForSelector(".modal", { state: "detached" });
      await page
        .getByRole("heading", { name: "Lá · Kiểm thử UI", exact: true })
        .waitFor();
      const b = (await bootstrap()).branches.find(
        (b) => b.name === "Lá · Kiểm thử UI",
      );
      const newData = await bootstrap(b.id);
      assert.equal(newData.tables.length, 0);
      assert.ok(newData.ingredients.every((i) => i.stock === 0));
    },
  );
  console.log("Starting responsive checks");
  for (const width of [360, 390, 768, 1366, 1920, 2560]) {
    await page.setViewportSize({
      width,
      height: width <= 390 ? 844 : width >= 1920 ? 1080 : 900,
    });
    await go("dashboard");
    await page.waitForSelector(".toast", { state: "detached" });
    await page.screenshot({
      path: `test-results/dashboard-${width}.png`,
      fullPage: true,
    });
    const fonts = await page.evaluate(() => {
      const size = (s) => getComputedStyle(document.querySelector(s)).fontSize;
      return {
        heading: size("h1"),
        body: size("body"),
        navigation: size(".nav-link"),
        button: size(".heading-actions .btn"),
        card: size(".bestseller strong"),
        description: size(".page-heading p"),
      };
    });
    const overflow = [];
    for (const route of [
      "dashboard",
      "branches",
      "pos",
      "tables",
      "orders",
      "kitchen",
      "menu",
      "inventory",
      "customers",
      "staff",
      "reports",
      "settings",
    ]) {
      await go(route);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      if (over) {
        const bad = await page.evaluate(() =>
          [...document.querySelectorAll("main *")]
            .filter(
              (e) =>
                e.getBoundingClientRect().right > innerWidth + 2 &&
                !e.closest(".table-scroll,.category-tabs,.tabs"),
            )
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              right: Math.round(e.getBoundingClientRect().right),
            }))
            .slice(0, 12),
        );
        overflow.push({ route, bad });
      }
      if (
        [390, 1366, 2560].includes(width) &&
        ["pos", "branches", "menu"].includes(route)
      )
        await page.screenshot({
          path: `test-results/${route}-${width}.png`,
          fullPage: true,
        });
    }
    result.viewports.push({ width, fonts, overflow });
    console.log(width, fonts, "overflow", JSON.stringify(overflow));
  }
  const laptop = result.viewports.find((v) => v.width === 1366),
    desktop = result.viewports.find((v) => v.width === 1920),
    large = result.viewports.find((v) => v.width === 2560);
  for (const role of [
    "heading",
    "body",
    "navigation",
    "button",
    "card",
    "description",
  ]) {
    assert.ok(
      parseFloat(desktop.fonts[role]) > parseFloat(laptop.fonts[role]),
      `${role} should grow at 1920`,
    );
    assert.ok(
      parseFloat(large.fonts[role]) > parseFloat(desktop.fonts[role]),
      `${role} should grow at 2560`,
    );
  }
  assert.ok(
    result.viewports.every((v) => v.overflow.length === 0),
    "Unexpected page horizontal overflow",
  );
  for (const route of [
    "dashboard",
    "branches",
    "pos",
    "tables",
    "orders",
    "kitchen",
    "menu",
    "inventory",
    "customers",
    "staff",
    "reports",
    "settings",
  ]) {
    await page.setViewportSize({ width: 1366, height: 900 });
    await go(route);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    result.accessibility.push({
      route,
      violations: audit.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
    console.log(
      "Accessibility",
      route,
      audit.violations.map((v) => [v.id, v.nodes.length]),
    );
  }
  assert.deepEqual(errors, [], "Browser runtime exceptions");
  assert.ok(
    result.accessibility.every((a) => a.violations.length === 0),
    "Accessibility checks must pass",
  );
  writeFileSync("test-results/results.json", JSON.stringify(result, null, 2));
  console.log("Browser validation completed. Artifacts: test-results/");
} catch (e) {
  await page.screenshot({ path: "test-results/failure.png", fullPage: true });
  writeFileSync(
    "test-results/results.json",
    JSON.stringify({ ...result, error: e.stack }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(directory, { recursive: true, force: true });
}
