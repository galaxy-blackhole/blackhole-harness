/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Mở trang Plugins của app đang chạy (Chrome thật, click bằng JS) và in nhãn nhìn thấy — kiểm
 *      chứng việc chèn từ điển tiếng Việt vào artefact client.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as {
  launchPersistentContext: (dir: string, o: unknown) => Promise<{
    newPage: () => Promise<{
      goto: (u: string, o: unknown) => Promise<unknown>;
      waitForTimeout: (ms: number) => Promise<void>;
      evaluate: (fn: () => unknown) => Promise<unknown>;
      innerText: () => Promise<string>;
      locator: (s: string) => { innerText: () => Promise<string> };
      screenshot: (o: unknown) => Promise<unknown>;
    }>;
    close: () => Promise<void>;
  }>;
};
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-probe-plugins-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(6000);
const daBam = await page.evaluate(() => {
  const nut = [...document.querySelectorAll("button, a, [role='button'], [role='link'], div")]
    .filter((el) => ["Plugins", "Plugin"].includes((el.textContent ?? "").trim()))
    .pop();
  if (nut === undefined) return false;
  (nut as HTMLElement).click();
  return true;
});
await page.waitForTimeout(4000);
const text = await page.locator("body").innerText();
console.log(JSON.stringify({ daBam }));
console.log(text.replace(/\n{2,}/g, "\n").slice(0, 1200));
await page.screenshot({ path: "/tmp/gbh-plugins-vi.png" });
await ctx.close();
