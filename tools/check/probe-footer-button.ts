/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Chụp chân thanh bên để kiểm chứng nút "Cài đặt" (icon bánh răng) thay cho "Thêm", và in nhãn nút.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-chan-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1440, height: 980 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
const nut = page.locator("button").filter({ hasText: /^(Cài đặt|Thêm)$/u });
console.log("so nut:", await nut.count());
const nhan = await nut.last().innerText().catch(() => "-");
console.log("nhan nut chan thanh ben:", JSON.stringify(nhan.trim()));
await page.screenshot({ path: "/tmp/gbh-chan-thanh-ben.png", clip: { x: 0, y: 820, width: 300, height: 90 } });
await ctx.close();
