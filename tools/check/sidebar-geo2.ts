/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Do hinh hoc thanh ben o KHONG DO RONG chi dinh, in day du className (de biet trang thai collapsed)
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const url = process.argv[2] ?? "";
const w = Number(process.argv[3] ?? "1680");
const h = Number(process.argv[4] ?? "900");
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
if (!existsSync(pw)) { console.log("khong co playwright"); process.exit(2); }
const mod = await import(pathToFileURL(pw).href);
const m = mod as { chromium?: unknown; default?: { chromium?: unknown } };
const chromium = m.chromium ?? m.default?.chromium;
const b = await (chromium as { launch: (o: unknown) => Promise<any> }).launch({ headless: true, channel: "chrome", args: ["--no-sandbox"] });
const page = await b.newPage();
await page.setViewportSize({ width: w, height: h });
await page.goto(url, { waitUntil: "load", timeout: 30000 });
await new Promise((r) => setTimeout(r, 9000));
const out = await page.evaluate(() => {
  const res: string[] = [];
  for (const sel of ["[class*=root]", "[class*=logoRow]", "[class*=brand]", "[class*=iconButton]", "[class*=newSession]"]) {
    const e = document.querySelector(sel) as HTMLElement | null;
    if (e === null) { res.push(sel + " : KHONG THAY"); continue; }
    const r = e.getBoundingClientRect();
    res.push(sel + " : cls=" + e.className + " x=" + Math.round(r.x) + " y=" + Math.round(r.y) + " " + Math.round(r.width) + "x" + Math.round(r.height));
  }
  res.push("titlebar-attr=" + document.documentElement.hasAttribute("data-windows-titlebar") + " body=" + document.body.getAttribute("class"));
  return res;
});
console.log("viewport " + w + "x" + h);
for (const l of out) console.log("  " + l);
await b.close();