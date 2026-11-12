/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Soi DOM ba thẻ trong khung "Bắt đầu": in thẻ cha, lớp CSS, kiểu hiển thị của thẻ Terminal so với hai
 *      thẻ còn lại — để biết vì sao mô tả của thẻ Terminal nằm CÙNG DÒNG với tiêu đề.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-dom-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1600, height: 1000 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
// mở khung "Bắt đầu": bấm nút mở panel ở thanh bên phải nếu có, nếu không thì bấm tab hiện có
await page.getByText("Bắt đầu").first().click().catch(() => undefined);
await page.waitForTimeout(2500);
const thongTin = await page.evaluate(() => {
  /** Mô tả một phần tử: lớp + kiểu hiển thị. */
  const mo = (el: Element | null): unknown => {
    if (el === null) return null;
    const s = getComputedStyle(el as HTMLElement);
    return {
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute("class") ?? "").slice(0, 120),
      display: s.display,
      flexDirection: s.flexDirection,
      text: (el.textContent ?? "").trim().slice(0, 60),
    };
  };
  const nut = [...document.querySelectorAll("button, [role='button']")];
  const the = nut.filter((b) => /Tệp trong workspace|Terminal mới|Session Log/u.test(b.textContent ?? ""));
  return the.slice(0, 3).map((b) => ({
    the: mo(b),
    con: [...b.children].map((c) => mo(c)),
    mucCon: [...b.querySelectorAll("*")].slice(0, 8).map((c) => mo(c)),
  }));
});
console.log(JSON.stringify(thongTin, null, 1).slice(0, 4000));
await ctx.close();
