/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc In ra lỗi console/ pageerror của vỏ web — dùng khi #root rỗng để biết gói client nào hỏng.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-loi-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1400, height: 950 },
});
const page = await ctx.newPage();
const loi: string[] = [];
page.on("console", (m: any) => {
  if (m.type() === "error") loi.push(String(m.text()).slice(0, 300));
});
page.on("pageerror", (e: any) => loi.push("pageerror: " + String(e.message).slice(0, 300)));
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
console.log(JSON.stringify(loi.slice(0, 6), null, 1));
await ctx.close();
