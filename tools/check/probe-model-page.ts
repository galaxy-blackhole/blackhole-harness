/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở Cài đặt → Model và in nhãn thẻ provider — kiểm chứng không còn nhãn "Tuỳ chỉnh" và không còn
 *      nút "Sửa" cho provider Galaxy Blackhole.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-model-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1440, height: 980 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
await page.locator("button").filter({ hasText: /^Thêm$/u }).last().click().catch(() => undefined);
await page.waitForTimeout(1200);
await page.getByText("Cài đặt", { exact: true }).first().click().catch(() => undefined);
await page.waitForTimeout(2000);
await page.getByText("Model", { exact: true }).first().click().catch(() => undefined);
await page.waitForTimeout(2500);
const chu = await page.locator("body").innerText();
const dong = chu.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 1);
const quanTam = dong.filter((l: string) => /Galaxy Blackhole|Tuỳ chỉnh|Sửa|Cài đặt tuỳ|Khoá API|Áp dụng/u.test(l));
console.log(JSON.stringify(quanTam.slice(0, 12), null, 1));
await page.screenshot({ path: "/tmp/gbh-model-page.png" });
await ctx.close();
