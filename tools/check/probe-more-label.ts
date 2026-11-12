/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc In nhãn "More" ở đáy sidebar kèm chuỗi CSS/lớp của phần tử chứa nó — để biết gói nào render.
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
await page.waitForTimeout(9000);
const info = await page.evaluate(() => {
  const ra: string[] = [];
  for (const el of document.querySelectorAll("*")) {
    const chu = (el.textContent ?? "").trim();
    if (chu !== "More" && chu !== "Thêm") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    const chuoi = [el.tagName, el.className, el.parentElement?.className].map((x) => String(x).slice(0, 70));
    ra.push(chu + " @@ " + chuoi.join(" | ") + " @" + Math.round(r.x) + "," + Math.round(r.y));
  }
  return ra.slice(0, 6);
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
