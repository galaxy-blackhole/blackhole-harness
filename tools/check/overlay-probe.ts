/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Liệt kê overlay/modal ĐANG MỞ trong DOM thật — đo ĐÚNG triệu chứng thay vì suy từ ảnh
 */

// ⚠️ 18/10/2026: công cụ này ra đời từ một chẩn đoán thật. `parity:report` báo **4 FAIL ảnh A/B**
//   (`1440x900 vs oracleA` = **67,739%** px khác — ngưỡng 0,1%) mà KHÔNG nói khác ở đâu.
//   Mở ảnh ra thì thấy app của ta có **một panel trắng khổng lồ**; nhưng phải probe DOM mới biết
//   thủ phạm: `DIV.VOzbGW_overlay` (position:fixed, **z-index:1000**) + `DIV.VOzbGW_mask`
//   (**rgba(0,0,0,0.24)**) — **một MODAL đang mở** — trong khi `body.innerText` chứng minh app
//   vẫn render ĐÚNG ở dưới.
//
//   ⇒ BÀI HỌC: ảnh cho biết **CÓ** khác biệt; chỉ DOM mới cho biết **LÀ GÌ**. Và một modal bỏ mở
//     **không** làm hỏng `(8)` (`#root` vẫn 68.760) lẫn `(5)` (0 dòng `did not activate`) ⇒ nếu chỉ
//     nhìn các chỉ số sức khoẻ, ta sẽ tưởng app không có vấn đề gì.
//
// CÁCH DÙNG:
//   bun run tools/check/overlay-probe.ts            # dùng ready-url.txt của app 5439
//   bun run tools/check/overlay-probe.ts <url>      # hoặc URL cụ thể (lab cách ly)
//
// ⚠️ Phải truyền `channel: "chrome"` cho playwright — nếu không sẽ báo
//   *'Executable doesn't exist … chromium_headless_shell'* (đã mất một lượt vì lỗi này).

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Một phần tử phủ màn hình tìm thấy trong DOM. */
export interface OverlayHit {
  /** Tên thẻ HTML. */
  tag: string;
  /** Chuỗi lớp CSS (cắt ngắn) — dùng để truy ra gói sở hữu. */
  cls: string;
  /** `position` tính toán được. */
  position: string;
  /** `z-index` tính toán được. */
  z: string;
  /** `background-color` tính toán được. */
  background: string;
  /** Kích thước vật lý (px). */
  w: number;
  /** Chiều cao vật lý (px). */
  h: number;
  /** Vài thuộc tính `data-*`/`aria-*` để nhận dạng. */
  attrs: string[];
}

/**
 * Đọc URL app đang phục vụ từ `ready-url.txt` (có token) — `curl` trần luôn 401.
 *
 * @returns URL đầy đủ kèm token, hoặc `null` nếu chưa có tệp.
 */
export function readReadyUrl(): string | null {
  try {
    return readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
  } catch {
    return null;
  }
}

/**
 * Liệt kê mọi phần tử phủ màn hình (`fixed`/`absolute`, ≥400x300) đang HIỆN trong trang.
 *
 * Lọc bỏ phần tử `display:none` / `visibility:hidden` / gần như trong suốt, vì đó là overlay
 * đã đóng — thứ ta cần là overlay **đang mở**.
 *
 * @param url URL đầy đủ (kèm token) của app cần đo.
 * @returns Danh sách phần tử phủ màn hình, hoặc mảng rỗng nếu không mở được Chrome.
 */
export async function probeOverlays(url: string): Promise<OverlayHit[]> {
  const repo = process.cwd();
  const pw = join(repo, "tools", "parity", "node_modules", "playwright-core", "index.js");
  const mod = (await import(pathToFileURL(pw).href)) as {
    chromium?: { launch: (o: unknown) => Promise<{ newPage: () => Promise<unknown>; close: () => Promise<void> }> };
    default?: { chromium?: { launch: (o: unknown) => Promise<{ newPage: () => Promise<unknown>; close: () => Promise<void> }> } };
  };
  const chromium = mod.chromium ?? mod.default?.chromium;
  if (chromium === undefined) return [];
  let browser: { newPage: () => Promise<unknown>; close: () => Promise<void> };
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome", args: ["--no-sandbox"] });
  } catch {
    return [];
  }
  try {
    const page = (await browser.newPage()) as {
      goto: (u: string, o: unknown) => Promise<unknown>;
      waitForTimeout: (ms: number) => Promise<void>;
      evaluate: (fn: () => OverlayHit[]) => Promise<OverlayHit[]>;
    };
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(2_500);
    return await page.evaluate(() => {
      const out: OverlayHit[] = [];
      const all = Array.from(document.querySelectorAll("body *")) as HTMLElement[];
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.width < 400 || r.height < 300) continue;
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" && cs.position !== "absolute") continue;
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) continue;
        out.push({
          tag: el.tagName,
          cls: String(el.className).slice(0, 90),
          position: cs.position,
          z: cs.zIndex,
          background: cs.backgroundColor,
          w: Math.round(r.width),
          h: Math.round(r.height),
          attrs: Array.from(el.attributes).map((a) => a.name + "=" + a.value.slice(0, 40)).slice(0, 4),
        });
      }
      return out;
    });
  } finally {
    await browser.close();
  }
}

if (import.meta.main) {
  const url = process.argv[2] ?? readReadyUrl();
  if (url === null) {
    console.log("khong doc duoc ready-url.txt — truyen URL lam doi so thu nhat");
    process.exit(1);
  }
  const hits = await probeOverlays(url);
  if (hits.length === 0) {
    console.log("khong mo duoc Chrome, hoac KHONG co phan tu phu man hinh nao dang mo");
  } else {
    console.log("phan tu phu man hinh DANG MO: " + hits.length);
    for (const h of hits) {
      console.log("  " + h.tag + "." + h.cls + "  " + h.position + " z=" + h.z + " " + h.w + "x" + h.h +
        " bg=" + h.background + "  " + h.attrs.join(" "));
    }
  }
}
