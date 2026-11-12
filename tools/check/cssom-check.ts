/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Kiem CSSOM: rule logoRow co THUC SU vao bang style khong (nghi loi cu phap phia truoc)
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const url = process.argv[2] ?? "";
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = await import(pathToFileURL(pw).href);
const m = mod as { chromium?: unknown; default?: { chromium?: unknown } };
const chromium = m.chromium ?? m.default?.chromium;
const b = await (chromium as { launch: (o: unknown) => Promise<any> }).launch({ headless: true, channel: "chrome", args: ["--no-sandbox"] });
const page = await b.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30000 });
await new Promise((r) => setTimeout(r, 9000));
const out = await page.evaluate(() => {
  const res: string[] = [];
  const sheets = Array.from(document.styleSheets);
  res.push("so sheet: " + sheets.length);
  for (let i = 0; i < sheets.length; i += 1) {
    const s = sheets[i] as CSSStyleSheet;
    let n = 0;
    try { n = s.cssRules.length; } catch { res.push("  sheet " + i + ": KHONG DOC DUOC cssRules"); continue; }
    let has = false;
    for (let j = 0; j < n; j += 1) {
      const r = s.cssRules[j] as CSSStyleRule;
      if (r.selectorText !== undefined && r.selectorText.includes("logoRow")) has = true;
    }
    if (has) res.push("  sheet " + i + ": CO rule logoRow, tong " + n + " rule");
    else if (n > 20) res.push("  sheet " + i + ": " + n + " rule, KHONG co logoRow");
  }
  return res;
});
for (const l of out) console.log("  " + l);
await b.close();