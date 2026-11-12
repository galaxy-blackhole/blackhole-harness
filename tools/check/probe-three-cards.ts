/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở một phiên có sẵn (khung "Bắt đầu" hiện ở thanh bên phải) rồi đo kiểu hiển thị của ba thẻ —
 *      xác nhận thẻ Terminal đã xếp tiêu đề/mô tả thành CỘT như hai thẻ kia.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-the-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1600, height: 1000 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
await page.getByText("Liệt kê nội dung thư mục").first().click().catch(() => undefined);
await page.waitForTimeout(6000);
const ket = await page.evaluate(() => {
  /** Đo kiểu hiển thị của một phần tử theo lớp. */
  const doLop = (lop: string): unknown => {
    const el = document.querySelector("." + lop) as HTMLElement | null;
    if (el === null) return null;
    const s = getComputedStyle(el);
    return { display: s.display, flexDirection: s.flexDirection, borderWidth: s.borderTopWidth, gap: s.gap };
  };
  return { entry: doLop("gbhTermzju_entry"), text: doLop("gbhTermzju_text"), desc: doLop("gbhTermzju_description") };
});
console.log(JSON.stringify(ket, null, 1));
await page.screenshot({ path: "/tmp/gbh-ba-the.png" });
await ctx.close();
