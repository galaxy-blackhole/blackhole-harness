/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở một PHIÊN CÓ SẴN (để preset của phiên được mount) rồi kiểm: menu "+" có "Kế hoạch" và menu "/"
 *      có "Nén" hay không.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-phien-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1600, height: 1000 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
// Mở phiên đầu tiên trong danh sách (bấm vào dòng có chữ "Liệt kê nội dung thư mục" hoặc phiên bất kỳ).
await page.getByText("Liệt kê nội dung thư mục").first().click().catch(() => undefined);
await page.waitForTimeout(6000);
const doc = async (): Promise<string[]> =>
  (await page.locator("body").innerText()).split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 1);
// menu "/"
const o = page.locator("textarea, [contenteditable='true']").first();
await o.click();
await o.type("/", { delay: 30 });
await page.waitForTimeout(1800);
const dongC = await doc();
const coNen = dongC.some((l: string) => /^Nén/u.test(l));
// menu "+"
await o.fill("").catch(() => undefined);
await page.keyboard.press("Escape");
await page.waitForTimeout(800);
const nut = page.locator("button").filter({ hasText: /^$/u });
const soNut = await nut.count();
let coKeHoach = false;
for (let i = 0; i < Math.min(soNut, 8); i += 1) {
  await nut.nth(i).click({ timeout: 1500 }).catch(() => undefined);
  await page.waitForTimeout(700);
  const d = await doc();
  if (d.some((l: string) => /^Kế hoạch/u.test(l))) { coKeHoach = true; break; }
  await page.keyboard.press("Escape");
}
console.log(JSON.stringify({ coNen, coKeHoach, soNut }, null, 1));
await page.screenshot({ path: "/tmp/gbh-phien-menu.png" });
await ctx.close();
