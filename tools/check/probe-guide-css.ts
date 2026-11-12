/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Kiểm xem CSS của thẻ hướng dẫn Terminal đã được chèn vào <head> chưa, và luật .gbhTermzju_entry có
 *      thật trong tài liệu không (đây là gốc của việc thẻ Terminal bị dồn một dòng).
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-css-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1600, height: 1000 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
const ket = await page.evaluate(() => {
  const the = document.querySelector('style[data-gbh-guide="ui-sidebar-terminal"]');
  let coLuat = false;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules ?? [])) {
      if (rule.cssText.includes(".gbhTermzju_entry")) coLuat = true;
    }
  }
  return { coTheStyle: the !== null, coLuatEntry: coLuat };
});
console.log(JSON.stringify(ket, null, 1));
await ctx.close();
