/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc In nguyen van cac rule logoRow co trong the <style> dang phuc vu (de biet rule nao thieu)
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
  const els = Array.from(document.querySelectorAll("style")) as HTMLElement[];
  const res: string[] = [];
  for (const e of els) {
    const t = e.textContent ?? "";
    if (!t.includes("logoRow")) continue;
    const rules = t.split("}");
    for (const r of rules) if (r.includes("logoRow")) res.push(r.trim().slice(0, 170) + "}");
  }
  return res;
});
for (const l of out) console.log("  " + l);
console.log("  tong rule logoRow: " + out.length);
await b.close();