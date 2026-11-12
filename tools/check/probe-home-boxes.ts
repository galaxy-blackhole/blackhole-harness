/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Chụp màn hình trang chủ để đối chiếu bố cục sau khi đổi description/locale
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = process.argv[2];
const pw = join(process.env.GBH_PLAYWRIGHT_ROOT ?? "/tmp/pw/node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as any;
const ctx = await mod.chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-shot-")), {
  channel: "chrome", headless: true, viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(8000);
await page.screenshot({ path: "/tmp/gbh-home-now.png", type: "png" });
const boxes = await page.evaluate(() =>
  Array.from(document.querySelectorAll("header, main, aside, nav"))
    .map((e) => { const r = e.getBoundingClientRect(); return { tag: e.tagName, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((b) => b.w > 40 && b.h > 20),
);
console.log(JSON.stringify(boxes).slice(0, 600));
process.exit(0);
