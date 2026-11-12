/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở menu "+" cạnh ô soạn tin bằng nhiều cách chọn khác nhau và in toàn bộ mục — kiểm tra xem
 *      Kế hoạch (Plan) và Nén lịch sử (Compact) đã có mặt chưa.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-menu-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1440, height: 980 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(8000);
const nut = page.locator("[data-slot='composer'] button").filter({ hasText: /^$/u });
const soNut = await nut.count();
let daMo = false;
for (let i = 0; i < Math.min(soNut, 6); i += 1) {
  await nut.nth(i).click({ timeout: 2000 }).catch(() => undefined);
  await page.waitForTimeout(900);
  const chu = await page.locator("body").innerText();
  if (/Mục tiêu|Goal/u.test(chu) && /Kế hoạch|Plan/u.test(chu)) {
    daMo = true;
    break;
  }
}
const chu = await page.locator("body").innerText();
const dong = chu.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 1);
const muc = dong.filter((l: string) => /^(Tệp|Mục tiêu|Kế hoạch|Lệnh|Nén|Quyền|Model|Xuất|Phản hồi|Đăng nhập|Cài đặt|Skill)/u.test(l));
console.log("so nut:", soNut, "| mo duoc:", daMo);
console.log(JSON.stringify(muc.slice(0, 14), null, 1));
await page.screenshot({ path: "/tmp/gbh-menu-vi.png" });
await ctx.close();
