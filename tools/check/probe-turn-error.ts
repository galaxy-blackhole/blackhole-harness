/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Gửi MỘT lượt thật trong app rồi in lỗi + console log — để lấy bằng chứng cho lỗi
 *      "Cannot read properties of undefined (reading 'prepare')".
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-turn-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1400, height: 950 },
});
const page = await ctx.newPage();
const loi: string[] = [];
page.on("console", (m: { type: () => string; text: () => string }) => {
  if (m.type() === "error") loi.push(m.text().slice(0, 300));
});
page.on("pageerror", (e: Error) => loi.push("pageerror: " + String(e.message).slice(0, 300)));
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(8000);
const o = page.locator("textarea, [contenteditable='true']").first();
await o.click();
await o.type("chạy lệnh ls -la rồi cho tôi biết có gì", { delay: 20 });
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
// Chup GIUA luot de bat bieu tuong "dang suy nghi".
await page.screenshot({ path: "/tmp/gbh-dang-suy-nghi.png" });
await page.waitForTimeout(14000);
const text = await page.locator("body").innerText();
const dongLoi = text.split("\n").filter((l: string) => l.includes("thất bại") || l.includes("prepare") || l.includes("Cannot read")).slice(0, 4);
await page.screenshot({ path: "/tmp/gbh-turn-error.png" });
await ctx.close();
console.log(JSON.stringify({ dongLoi, loi }, null, 1));
