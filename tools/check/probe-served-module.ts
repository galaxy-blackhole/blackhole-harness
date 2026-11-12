/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Kiểm tra HOST đang phục vụ bản client nào: tải module ui-settings-models qua HTTP và tìm dấu bản vá
 *      "provider !== \"auto\"" — phân biệt "file trong profile đã vá" với "host phục vụ bản khác".
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-serve-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1200, height: 800 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(6000);
const ket = await page.evaluate(async () => {
  const ds = (window as unknown as { __GBH_CLIENT__?: { modules?: { id: string; url: string }[] } }).__GBH_CLIENT__;
  return ds === undefined ? "khong co __GBH_CLIENT__" : JSON.stringify(ds).slice(0, 400);
});
console.log("client registry:", ket);
const thu = await page.evaluate(async () => {
  const ds = (window as unknown as { __GBH_CLIENT__?: { modules?: { id: string; url: string }[] } }).__GBH_CLIENT__;
  const muc = (ds?.modules ?? []).find((m) => m.id.includes("settings-models"));
  if (muc === undefined) return "khong thay module";
  const tra = await fetch(muc.url);
  const chu = await tra.text();
  return muc.url + " | co dau va: " + String(chu.includes('provider !== "auto"')) + " | co customTag: " + String(chu.includes("customTag"));
});
console.log("module:", thu);
await ctx.close();
