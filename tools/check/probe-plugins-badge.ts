/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở Cài đặt → Plugin và đếm nhãn thẻ ("Trong preset" thay cho "Đã tắt") — chỉ đọc, không bấm gì thêm.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-nhan-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1600, height: 1000 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
await page.locator("button").filter({ hasText: /^Cài đặt$/u }).last().click();
await page.waitForTimeout(1800);
await page.getByText("Plugin", { exact: true }).first().click();
await page.waitForTimeout(3000);
const chu = await page.locator("body").innerText();
const dong = chu.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 1);
const demTrongPreset = dong.filter((l: string) => l === "Trong preset").length;
const demDaTat = dong.filter((l: string) => l === "Đã tắt").length;
console.log(JSON.stringify({ demTrongPreset, demDaTat }, null, 1));
await page.screenshot({ path: "/tmp/gbh-plugins-nhan.png" });
await ctx.close();
