/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Bấm nút "Thêm" ở chân thanh bên (menu tài khoản) và in các mục — kiểm chứng Đăng nhập/Liên hệ
 *      đã ẩn và nhãn "Cài đặt" đã dịch.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-acct-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1440, height: 980 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
const nut = page.locator("button").filter({ hasText: /^Thêm$/u });
console.log("so nut Thêm:", await nut.count());
await nut.last().click({ timeout: 4000 }).catch(() => undefined);
await page.waitForTimeout(1500);
const chu = await page.locator("body").innerText();
const dong = chu.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 1);
const muc = dong.filter((l: string) => /^(Cài đặt|Settings|Liên hệ|Feedback|Đăng nhập|Sign in|Đăng xuất|Sign out)$/u.test(l));
console.log(JSON.stringify(muc, null, 1));
await page.screenshot({ path: "/tmp/gbh-account-menu.png" });
await ctx.close();
