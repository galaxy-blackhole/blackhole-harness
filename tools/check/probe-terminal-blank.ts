/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Mở một phiên rồi bật terminal bằng phím tắt Ctrl+`, ghi lại lỗi console và kích thước khung terminal —
 *      tìm nguyên nhân khung terminal trắng.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-term-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1600, height: 1000 },
});
const page = await ctx.newPage();
const loi: string[] = [];
page.on("console", (m: any) => {
  if (m.type() === "error") loi.push(String(m.text()).slice(0, 240));
});
page.on("pageerror", (e: any) => loi.push("pageerror: " + String(e.message).slice(0, 240)));
page.on("requestfailed", (r: any) => loi.push("requestfailed: " + String(r.url()).slice(0, 160)));
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(9000);
await page.getByText("Liệt kê nội dung thư mục").first().click().catch(() => undefined);
await page.waitForTimeout(5000);
await page.locator("body").click();
await page.keyboard.press("Control+Backquote");
await page.waitForTimeout(6000);
const doKhung = await page.evaluate(() => {
  const ung = [...document.querySelectorAll("div,section")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 300 && r.height > 200 && (el.className ?? "").toString().includes("Term");
  });
  const xterm = document.querySelector(".xterm");
  return {
    soKhungTerm: ung.length,
    coXterm: xterm !== null,
    xtermSize: xterm === null ? null : { w: (xterm as HTMLElement).clientWidth, h: (xterm as HTMLElement).clientHeight },
  };
});
console.log(JSON.stringify({ doKhung, soLoi: loi.length, loi: loi.slice(0, 5) }, null, 1));
await page.screenshot({ path: "/tmp/gbh-terminal-trang.png" });
await ctx.close();
