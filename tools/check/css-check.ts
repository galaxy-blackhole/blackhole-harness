/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Kiem CSS cua thanh ben co duoc nap khong (nghi van: thieu stylesheet => chuoi xep doc)
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
  const els = Array.from(document.querySelectorAll("style,link[rel=stylesheet]")) as HTMLElement[];
  const res: string[] = ["so style/link: " + els.length];
  let found = 0;
  for (const e of els) {
    const t = e.tagName === "STYLE" ? (e.textContent ?? "") : "";
    if (t.includes("hHd-Xa_logoRow")) { found += 1; res.push("CO rule logoRow trong <style> dai " + t.length + " ky tu"); }
  }
  res.push("tong so style chua rule logoRow: " + found);
  const r = document.querySelector("[class*=logoRow]") as HTMLElement | null;
  if (r !== null) {
    const cs = getComputedStyle(r);
    res.push("computed logoRow: height=" + cs.height + " display=" + cs.display + " justify=" + cs.justifyContent);
  }
  const bm = document.querySelector("[class*=brandMark]") as HTMLElement | null;
  if (bm !== null) res.push("computed brandMark: display=" + getComputedStyle(bm).display);
  return res;
});
for (const l of out) console.log("  " + l);
await b.close();