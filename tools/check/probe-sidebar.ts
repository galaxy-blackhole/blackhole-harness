/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Dò cách mở một phiên CÓ NỘI DUNG trong app: in các ứng viên ở sidebar + số slot trước/sau khi bấm.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launch: (o: unknown) => Promise<any> };
const browser = await chromium.launch({ headless: true, channel: "chrome", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(8000);
const truoc = await page.evaluate(() => document.querySelectorAll("[data-slot]").length);
const ung = await page.evaluate(() => {
  const ds: string[] = [];
  for (const el of document.querySelectorAll("*")) {
    const chu = (el.textContent ?? "").trim();
    if (chu.length === 0 || chu.length > 60) continue;
    const r = el.getBoundingClientRect();
    if (r.x > 300 || r.width === 0) continue;
    if (el.children.length > 2) continue;
    ds.push(chu + " |" + el.tagName);
    if (ds.length > 22) break;
  }
  return ds;
});
console.log("slot truoc:", truoc);
console.log(ung.slice(0, 20).join("\n"));
await browser.close();
