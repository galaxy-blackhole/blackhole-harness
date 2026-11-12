/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở Cài đặt (mục Mô hình + Giao diện) và in các nhãn nhìn thấy — kiểm chứng từ điển vi vừa chèn
 *      cho ui-settings-models / ui-theme / ui-sidebar-right đã có tác dụng.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-settings-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1440, height: 980 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(7000);
await page.getByRole("button", { name: /Thêm|More/ }).first().click().catch(() => undefined);
await page.waitForTimeout(1500);
await page.getByText("Cài đặt", { exact: true }).first().click().catch(() => undefined);
await page.waitForTimeout(2500);
await page.getByText("Mô hình", { exact: true }).first().click().catch(() => undefined);
await page.waitForTimeout(2500);
const text = await page.locator("body").innerText();
const dong = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0).slice(0, 45);
console.log(JSON.stringify(dong, null, 1));
await page.screenshot({ path: "/tmp/gbh-settings-vi.png" });
await ctx.close();
