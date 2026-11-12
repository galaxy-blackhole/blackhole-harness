/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở menu "+" ở ô soạn tin bằng aria-label rồi in danh sách mục — kiểm "Kế hoạch" đã có chưa.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-plus-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1600, height: 1000 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
const ung = page.getByRole("button", { name: /Thêm tệp|Add file|Đính kèm|Tệp/u }).first();
const coUng = await ung.count();
await ung.click({ timeout: 3000 }).catch(() => undefined);
await page.waitForTimeout(1500);
const chu = await page.locator("body").innerText();
const dong = chu.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 1);
const muc = dong.filter((l: string) => /^(Tệp|Mục tiêu|Kế hoạch|Lệnh|Quyền|Model|Xuất|Nén)/u.test(l));
console.log(JSON.stringify({ coNut: coUng, muc: muc.slice(0, 10) }, null, 1));
await page.screenshot({ path: "/tmp/gbh-plus-menu.png" });
await ctx.close();
