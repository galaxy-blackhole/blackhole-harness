/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở HAI phiên liên tiếp rồi quay lại phiên đầu (preset mount 2 lần) và ghi lại lỗi console/ pageerror
 *      — kiểm xem việc bật plan-mode ở mặt phẳng web có gây trùng đăng ký khi nhiều phiên cùng sống không.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-2phien-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1600, height: 1000 },
});
const page = await ctx.newPage();
const loi: string[] = [];
page.on("console", (m: any) => {
  if (m.type() === "error") loi.push(String(m.text()).slice(0, 200));
});
page.on("pageerror", (e: any) => loi.push("pageerror: " + String(e.message).slice(0, 200)));
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
await page.getByText("Liệt kê nội dung thư mục").first().click().catch(() => undefined);
await page.waitForTimeout(5000);
await page.getByText("Say OK Only").first().click().catch(() => undefined);
await page.waitForTimeout(5000);
await page.getByText("Liệt kê nội dung thư mục").first().click().catch(() => undefined);
await page.waitForTimeout(5000);
const chu = await page.locator("body").innerText();
console.log(JSON.stringify({ soLoi: loi.length, loi: loi.slice(0, 4), coNen: /Nén/u.test(chu) }, null, 1));
await page.screenshot({ path: "/tmp/gbh-hai-phien.png" });
await ctx.close();
