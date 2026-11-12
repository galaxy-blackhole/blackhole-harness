/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Do phia trang cho MOT url; them --save de ghi DUONG NEN hinh hoc cho check:app; --save kem --shot de luu anh nen
 */
import { writeFileSync } from "node:fs";
import { probeGeometry, probePage } from "./page-probe.ts";
const url = process.argv[2];
if (url === undefined) { console.log("thieu URL"); process.exit(2); }
const r = await probePage(url, process.cwd());
console.log(JSON.stringify(r));
if (process.argv.includes("--save")) {
  const geo = await probeGeometry(url, process.cwd());
  writeFileSync(".parity/layout-baseline.json", JSON.stringify(geo, null, 1), "utf8");
  console.log("da ghi .parity/layout-baseline.json: " + geo.length + " phan tu");
  // Anh nen cung mot thoi diem: bang chung thi giac cho baseline (yeu cau Lead 18/10/2026).
  if (process.argv.includes("--shot")) {
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { pathToFileURL } = await import("node:url");
    const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
    const mod = (await import(pathToFileURL(pw).href)) as { chromium?: { launch: (o: unknown) => Promise<unknown> } };
    const chromium = mod.chromium;
    if (chromium !== undefined) {
      const userDataDir = mkdtempSync(join(tmpdir(), "gbh-baseline-shot-"));
      // `mod.chromium` chỉ được khai với `launch` (một API khác của playwright-core) ⇒ ép qua `unknown`
      // một lần cho ĐÚNG API đang gọi; không `any`, không đổi hành vi.
      const persistent = chromium as unknown as {
        launchPersistentContext: (dir: string, o: unknown) => Promise<{ newPage: () => Promise<{ goto: (u: string, o: unknown) => Promise<unknown>; waitForTimeout: (ms: number) => Promise<void>; screenshot: (o: unknown) => Promise<Buffer> }>; close: () => Promise<void> }>;
      };
      const ctx = await persistent.launchPersistentContext(userDataDir, { channel: "chrome", headless: true, viewport: { width: 1440, height: 900 }, locale: "vi-VN" });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: "load", timeout: 30_000 });
      await page.waitForTimeout(10_000);
      await page.screenshot({ path: ".parity/layout-baseline.png", type: "png" });
      await ctx.close();
      console.log("da ghi .parity/layout-baseline.png");
    }
  }
}