/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở chi tiết bundle "Huy hiệu Galaxy Blackhole" bằng CHUỘT THẬT (playwright) và kiểm ảnh xem trước
 *      có nạp được không (naturalWidth > 0) — hồi quy cho lỗi 'không hiển thị được ảnh xem trước'.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-prev2-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1440, height: 980 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(7000);
await page.getByRole("button", { name: "Plugin", exact: true }).click().catch(() => undefined);
await page.waitForTimeout(3000);
await page.getByText("Huy hiệu Galaxy Blackhole", { exact: true }).click().catch(() => undefined);
await page.waitForTimeout(2500);
await page.getByText("Nhập bằng giọng nói", { exact: true }).click().catch(() => undefined);
await page.waitForTimeout(3000);
const ket = await page.evaluate(() => {
  const anh = [...document.querySelectorAll("img")].map((el) => ({
    src: (el as HTMLImageElement).src.slice(0, 40),
    w: (el as HTMLImageElement).naturalWidth,
  }));
  return {
    soAnh: anh.length,
    anhNoiDung: anh.filter((a) => a.w > 0).length,
    coThongBaoLoi: document.body.innerText.includes("Không hiển thị được ảnh xem trước"),
    chiTiet: anh.slice(0, 3),
  };
});
console.log(JSON.stringify(ket, null, 1));
await page.screenshot({ path: "/tmp/gbh-preview-check.png" });
await ctx.close();
