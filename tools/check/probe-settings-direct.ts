/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Bấm nút "Cài đặt" ở chân thanh bên rồi kiểm xem hộp thoại Cài đặt có mở TRỰC TIẾP không (không còn
 *      lớp popup một mục ở giữa).
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-cd-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1440, height: 980 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
await page.locator("button").filter({ hasText: /^Cài đặt$/u }).last().click();
await page.waitForTimeout(2000);
const chu = await page.locator("body").innerText();
const dong = chu.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 1);
const coHopThoai = dong.some((l: string) => l === "Cài đặt");
const coTab = dong.some((l: string) => /^(Chung|Model|Plugin|Preset agent|Thông tin)$/u.test(l));
const coMenuLe = dong.filter((l: string) => l === "Cài đặt").length;
console.log(JSON.stringify({ hopThoai: coHopThoai, coTabCaiDat: coTab, soLanChuCaiDat: coMenuLe }, null, 1));
await page.screenshot({ path: "/tmp/gbh-caidat-truc-tiep.png" });
await ctx.close();
