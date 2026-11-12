/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở phiên mới rồi chụp khung "Bắt đầu" (Workspace files / Terminal mới / Session Log) để so bố cục
 *      với DSH, kèm in nhãn nhìn thấy.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-start-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1440, height: 980 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
await page.getByRole("button", { name: /Phiên mới/u }).first().click().catch(() => undefined);
await page.waitForTimeout(3000);
const chu = await page.locator("body").innerText();
const dong = chu.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 1);
const quanTam = dong.filter((l: string) => /Tệp trong workspace|Terminal|Session Log|Bắt đầu|Start|Duyệt tệp|Chạy lệnh/u.test(l));
console.log(JSON.stringify(quanTam.slice(0, 10), null, 1));
await page.screenshot({ path: "/tmp/gbh-start-panel.png" });
await ctx.close();
