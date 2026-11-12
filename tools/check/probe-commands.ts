/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở phiên mới, gõ "/" rồi in danh sách lệnh — kiểm tra lệnh Compact (nén) và Kế hoạch có mặt không.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-cmd-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1440, height: 980 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
await page.getByRole("button", { name: /Phiên mới/u }).first().click().catch(() => undefined);
await page.waitForTimeout(2500);
const o = page.locator("textarea, [contenteditable='true']").first();
await o.click();
await o.type("/", { delay: 30 });
await page.waitForTimeout(2000);
const chu = await page.locator("body").innerText();
const dong = chu.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 1);
const muc = dong.filter((l: string) => /^(\/|Nén|Compact|Quyền|Permission|Model|Xuất|Export|Kế hoạch|Plan)/u.test(l));
console.log(JSON.stringify(muc.slice(0, 14), null, 1));
await ctx.close();
