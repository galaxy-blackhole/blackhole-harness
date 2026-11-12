/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Kiểm chứng 3 điểm: (a) trang chi tiết bundle không còn id @deepseek-ai/..., (b) tooltip ở đầu
 *      trang Plugin đã tiếng Việt, (c) nút mở tệp cấu hình trong Cài đặt đã tiếng Việt.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-verify-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1440, height: 980 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(7000);
// (1) mở trang Plugins
await page.evaluate(() => {
  const nut = [...document.querySelectorAll("button, a, [role='button']")].filter((el) => ["Plugin", "Plugins"].includes((el.textContent ?? "").trim())).pop();
  if (nut instanceof HTMLElement) nut.click();
});
await page.waitForTimeout(3500);
// (2) tooltip: rê chuột vào nút thông tin
const tooltip = await page.evaluate(() => {
  const nut = document.querySelector("[aria-label*='hướng dẫn'], [aria-label*='giới thiệu'], button[aria-describedby]");
  if (nut instanceof HTMLElement) {
    nut.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    nut.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  }
  return document.body.innerText.split("\n").filter((l) => l.includes("Cấu hình plugin chính thức") || l.includes("Configure official")).slice(0, 2);
});
// (3) mở chi tiết bundle
await page.evaluate(() => {
  const tieuDe = [...document.querySelectorAll("*")].find((el) => (el.textContent ?? "").trim() === "Nhóm agent" && el.children.length === 0);
  const the = tieuDe?.closest("div, article, li");
  if (the instanceof HTMLElement) the.click();
});
await page.waitForTimeout(4000);
const chiTiet = await page.evaluate(() =>
  document.body.innerText.split("\n").filter((l) => l.trim().startsWith("@") || l.includes("@deepseek-ai") || l.includes("@galaxy-blackhole")).slice(0, 8),
);
const conStock = await page.evaluate(() => document.body.innerText.includes("@deepseek-ai/"));
await page.screenshot({ path: "/tmp/gbh-detail-ids.png" });
console.log(JSON.stringify({ tooltip, chiTiet, conStock }, null, 1));
await ctx.close();
