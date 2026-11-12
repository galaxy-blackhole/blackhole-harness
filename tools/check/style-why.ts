/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tim the <style> chua rule logoRow va in thuoc tinh + so rule CSSOM cua no (vi sao khong ap dung)
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
  const els = Array.from(document.querySelectorAll("style")) as HTMLStyleElement[];
  for (const e of els) {
    const t = e.textContent ?? "";
    if (!t.includes("logoRow")) continue;
    const attrs = Array.from(e.attributes).map((a) => a.name + "=" + a.value).join(" ");
    res.push("thuoc tinh: [" + attrs + "]");
    res.push("parent: " + (e.parentElement?.tagName ?? "?") + " trong #root? " + (e.closest("#root") !== null));
    res.push("con nam trong shadow/template? " + (e.getRootNode() !== document));
    const sh = e.sheet as CSSStyleSheet | null;
    res.push("sheet: " + (sh === null ? "null" : sh.cssRules.length + " rule"));
    res.push("60 ky tu dau: " + t.slice(0, 60).replace(/\n/g, " "));
  }
  return res;
});
for (const l of out) console.log("  " + l);
await b.close();