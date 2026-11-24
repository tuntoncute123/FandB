import { chromium } from "playwright";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "la-zoom-"));
const extension = join(dir, "zoom-extension");
mkdirSync(extension);
writeFileSync(
  join(extension, "manifest.json"),
  JSON.stringify({
    manifest_version: 3,
    name: "Local browser zoom verification",
    version: "1.0",
    permissions: ["tabs"],
    background: { service_worker: "worker.js" },
  }),
);
writeFileSync(
  join(extension, "worker.js"),
  "chrome.runtime.onInstalled.addListener(() => {});",
);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.VERCEL;
process.env.DB_PATH = join(dir, "test.sqlite");
process.env.NODE_ENV = "production";
const { app } = await import("../server/index.js");
const { db } = await import("../server/db.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.on("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const context = await chromium.launchPersistentContext(join(dir, "profile"), {
  channel: "chromium",
  headless: true,
  viewport: null,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    "--window-size=1366,1000",
  ],
});
try {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const page = await context.newPage();
  await page.goto(base);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForSelector(".overview-banner");
  await page.evaluate(() => document.fonts.ready);
  const before = await page.evaluate(() => ({
    width: innerWidth,
    dpr: devicePixelRatio,
  }));
  const zoom = await worker.evaluate(async (base) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url.startsWith(base));
    await chrome.tabs.setZoom(tab.id, 2);
    return chrome.tabs.getZoom(tab.id);
  }, base);
  assert.equal(zoom, 2);
  await page.waitForFunction((w) => innerWidth < w * 0.6, before.width);
  const after = await page.evaluate(() => ({
    width: innerWidth,
    dpr: devicePixelRatio,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert.equal(after.overflow, false);
  mkdirSync("test-results", { recursive: true });
  const cdp = await context.newCDPSession(page);
  await page.waitForTimeout(250);
  const dashboardCapture = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: false,
  });
  writeFileSync(
    "test-results/zoom-200-dashboard.png",
    Buffer.from(dashboardCapture.data, "base64"),
  );
  await page.getByRole("button", { name: "Mở menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Bán hàng POS", exact: false })
    .click();
  await page.waitForSelector(".pos-cart");
  await page.getByRole("button", { name: "Mang đi", exact: true }).click();
  await page
    .getByRole("button", { name: "Thêm Cà phê sữa đá", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tạo đơn & gửi bếp", exact: true })
    .click();
  await page.waitForSelector(".modal");
  await page.screenshot({
    path: "test-results/zoom-200-dialog.png",
    fullPage: false,
  });
  await page.waitForSelector(".toast", { state: "detached" });
  const capture = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: false,
  });
  writeFileSync(
    "test-results/zoom-200-dialog.png",
    Buffer.from(capture.data, "base64"),
  );
  const bounds = await page.locator(".modal").boundingBox();
  assert.ok(bounds.x >= 0);
  assert.ok(bounds.y >= 0);
  assert.ok(
    bounds.y + bounds.height <= (await page.evaluate(() => innerHeight)) + 1,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  assert.ok(bounds.x + bounds.width <= after.width + 1);
  await page
    .getByRole("button", { name: "Bắt đầu chế biến", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Đang chế biến", { exact: true })
    .waitFor();
  await page.keyboard.press("Tab");
  assert.ok(
    await page.evaluate(() =>
      document.querySelector(".modal").contains(document.activeElement),
    ),
  );
  await page.keyboard.press("Escape");
  await page.waitForSelector(".modal", { state: "detached" });
  writeFileSync(
    "test-results/zoom.json",
    JSON.stringify(
      {
        zoom,
        before,
        after,
        createdOrder: true,
        dialogFits: true,
        keyboard: true,
      },
      null,
      2,
    ),
  );
  console.log("PASS real browser zoom 200%", { before, after, zoom });
} finally {
  await context.close();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
