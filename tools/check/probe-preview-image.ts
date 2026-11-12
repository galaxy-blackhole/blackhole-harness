/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Kiểm tra vì sao ảnh xem trước (data:image/svg+xml;base64) không hiện: thử nạp chính data URL
 *      đó trong trang và in lỗi/kích thước thật.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
const pw = join(process.cwd(), "tools", "parity", "node_modules", "playwright-core", "index.js");
const mod = (await import(pathToFileURL(pw).href)) as { chromium?: unknown };
const chromium = mod.chromium as { launchPersistentContext: (d: string, o: unknown) => Promise<any> };
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gbh-img-")), {
  channel: "chrome",
  headless: true,
  viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();
page.on("console", (m: { type: () => string; text: () => string }) => {
  if (m.type() === "error") console.log("console.error:", m.text().slice(0, 200));
});
await page.goto(url, { waitUntil: "load", timeout: 30_000 });
await page.waitForTimeout(6000);
const ketQua = await page.evaluate(async () => {
  const tep = await fetch("/plugins/@galaxy-blackhole/gbh-client-ui-plugin-manager/lib/client.js").catch(() => null);
  const nguon = tep !== null && tep.ok ? await tep.text() : "";
  const m = /var badge_skill_preview_default = "([^"]+)"/u.exec(nguon);
  if (m === null) return { thay: false, trangThai: tep?.status };
  const src = m[1] as string;
  const anh = new Image();
  const ket = await new Promise<{ ok: boolean; loi?: string; w?: number; h?: number }>((res) => {
    anh.onload = () => res({ ok: true, w: anh.naturalWidth, h: anh.naturalHeight });
    anh.onerror = () => res({ ok: false, loi: "onerror" });
    anh.src = src;
    setTimeout(() => res({ ok: false, loi: "timeout" }), 3000);
  });
  return { thay: true, daiSrc: src.length, ket };
});
console.log(JSON.stringify(ketQua, null, 1));
await ctx.close();
