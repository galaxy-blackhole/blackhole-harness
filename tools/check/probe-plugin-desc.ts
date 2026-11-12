/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Kiểm mô tả plugin trong UI: KHÔNG còn "DeepSeek Harness", có "Galaxy Blackhole", và đếm số plugin còn trỏ gói stock
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = process.argv[2];
const pw = join(process.env.GBH_PLAYWRIGHT_ROOT ?? "/tmp/pw/node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as any;
const ctx = await mod.chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-desc-")), {
  channel: "chrome", headless: true, viewport: { width: 1600, height: 1000 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(8000);
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button, [role=button]")) as HTMLElement[];
  b.find((e) => /^(More|Khác)$/iu.test((e.textContent ?? "").trim()))?.click();
});
await page.waitForTimeout(800);
await page.evaluate(() => {
  const it = Array.from(document.querySelectorAll("[role=menuitem], button, a")) as HTMLElement[];
  it.find((e) => /^(Settings|Cài đặt)$/iu.test((e.textContent ?? "").trim()))?.click();
});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const it = Array.from(document.querySelectorAll("button, [role=button], a, li")) as HTMLElement[];
  it.find((e) => /^(Plugin|Plugins)$/iu.test((e.textContent ?? "").trim()))?.click();
});
await page.waitForTimeout(3500);
const info = await page.evaluate(() => {
  const text = document.body.innerText;
  const dsHarness = (text.match(/DeepSeek Harness/gu) ?? []).length;
  const gbh = (text.match(/Galaxy Blackhole/gu) ?? []).length;
  const stockIds = (text.match(/@deepseek-ai\/[a-z0-9-]+/gu) ?? []).length;
  const viDescs = text.split("\n").filter((l) => l.length > 30 && /[àáảãạăâđêôơư]/iu.test(l)).slice(0, 3);
  return { dsHarness, gbh, stockIds, viDescs };
});
await page.screenshot({ path: "/tmp/gbh-plugins.png", type: "png" });
console.log(JSON.stringify(info).slice(0, 700));
process.exit(0);
