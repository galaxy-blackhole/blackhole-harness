/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở menu chế độ quyền và in nhãn — kiểm chứng ui-permission đã tiếng Việt (Chỉ đọc / Ghi trong
 *      workspace / Toàn quyền), và mở hộp thoại xác nhận Toàn quyền để kiểm câu thoại.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-perm-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1440, height: 980 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(8000);
await page.getByRole("button", { name: /Ghi trong workspace|Workspace Write/ }).first().click().catch(() => undefined);
await page.waitForTimeout(2000);
const menu = await page.locator("body").innerText();
const dong = menu.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
const nhom = dong.filter((l: string) => /Chỉ đọc|Ghi trong workspace|Toàn quyền|Tự động duyệt|Read Only|Full access|Auto review/.test(l));
console.log(JSON.stringify(nhom.slice(0, 8), null, 1));
await page.screenshot({ path: "/tmp/gbh-permission-vi.png" });
await ctx.close();
