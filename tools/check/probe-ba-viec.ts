/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Kiểm ba thứ sau khi bật preset + đổi nhãn: (a) nhãn thẻ trong Cài đặt → Plugin, (b) menu "+" có
 *      "Kế hoạch" chưa, (c) menu "/" có "Nén" chưa. In JSON gọn để dễ đọc.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-ba-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1600, height: 1000 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);

/** Đọc toàn bộ chữ trên trang, trả mảng dòng. */
const doc = async (): Promise<string[]> =>
  (await page.locator("body").innerText()).split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 1);

// (a) Cài đặt → Plugin: xem nhãn thẻ
await page.locator("button").filter({ hasText: /^Cài đặt$/u }).last().click();
await page.waitForTimeout(1500);
await page.getByText("Plugin", { exact: true }).first().click();
await page.waitForTimeout(2500);
const dongA = await doc();
const nhanThe = dongA.filter((l: string) => /^(Trong preset|Đã tắt|Bật|Tắt)$/u.test(l)).slice(0, 6);
await page.keyboard.press("Escape");
await page.waitForTimeout(1200);

// (b) menu "+"
const nutCong = page.locator("[data-slot='composer'] button").filter({ hasText: /^$/u });
await nutCong.first().click().catch(() => undefined);
await page.waitForTimeout(1200);
const dongB = await doc();
const coKeHoach = dongB.some((l: string) => /^Kế hoạch/u.test(l));
await page.keyboard.press("Escape");

// (c) menu "/"
const o = page.locator("textarea, [contenteditable='true']").first();
await o.click();
await o.type("/", { delay: 30 });
await page.waitForTimeout(1800);
const dongC = await doc();
const coNen = dongC.some((l: string) => /^Nén/u.test(l));
console.log(JSON.stringify({ nhanThe, coKeHoach, coNen }, null, 1));
await page.screenshot({ path: "/tmp/gbh-ba-viec.png" });
await ctx.close();
