/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở Cài đặt → tab Plugin (chọn trong hộp thoại) và đếm nhãn thẻ — xác nhận nhãn mới "Trong preset".
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-nhan2-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1600, height: 1000 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
await page.locator("button").filter({ hasText: /^Cài đặt$/u }).last().click();
await page.waitForTimeout(2000);
// Chọn tab "Plugin" TRONG hộp thoại (tránh bấm nhầm mục "Plugin" ở thanh bên).
const hopThoai = page.getByRole("dialog").first();
const coHop = await hopThoai.count();
const tabPlugin = hopThoai.getByText("Plugin", { exact: true }).first();
await tabPlugin.click({ timeout: 4000 }).catch(() => undefined);
await page.waitForTimeout(2500);
const chu = await page.locator("body").innerText();
const dong = chu.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 1);
console.log(JSON.stringify({
  coHopThoai: coHop,
  demTrongPreset: dong.filter((l: string) => l === "Trong preset").length,
  demDaTat: dong.filter((l: string) => l === "Đã tắt").length,
}, null, 1));
await page.screenshot({ path: "/tmp/gbh-plugins-nhan2.png" });
await ctx.close();
