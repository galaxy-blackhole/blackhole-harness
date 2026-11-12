/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Chụp RIÊNG dòng "Đang suy nghĩ" trong lúc một lượt đang chạy (ảnh phóng to 3x), để xác nhận
 *      biểu tượng đã đổi khỏi logo cá của DeepSeek.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-icon2-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1400, height: 950 },
  deviceScaleFactor: 3,
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(7000);
const o = page.locator("textarea, [contenteditable='true']").first();
await o.click();
await o.type("kiểm tra biểu tượng lần nữa", { delay: 20 });
await page.keyboard.press("Enter");
await page.waitForTimeout(1600);
await page.screenshot({ path: "/tmp/gbh-icon-crop.png", clip: { x: 470, y: 172, width: 220, height: 30 } });
console.log("da chup /tmp/gbh-icon-crop.png");
await ctx.close();
