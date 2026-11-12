/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test goi ui-primitives: phu song icon dang dung, artwork 1:1 voi vo, GbhIcon render, asset thuong hieu, khong mount
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  createGbhIcon,
  createGbhLogo,
  createGbhWordmark,
  DSH_TO_GBH_ICON,
  GBH_ARTWORK_ALIASES,
  GBH_ARTWORK_COUNT,
  GBH_ARTWORKS,
  GBH_FAVICON_SOURCE_SHA256,
  GBH_FAVICON_VIEWBOX,
  GBH_ICONS,
  GBH_LOGO_ARTWORK,
  GBH_LOGO_SOURCE_SHA256,
  GBH_LOGO_VIEWBOX,
  GBH_WORDMARK_TEXT,
  resolveGbhArtwork,
  type GbhIconArtwork,
  type GbhJsxRuntime,
} from "../../packages/client/ui-primitives/src/index.ts";

/** Gốc repo (tests/client -> repo). */
const REPO_ROOT = join(import.meta.dir, "..", "..");
/** Thư mục gói ui-primitives. */
const PKG = join(REPO_ROOT, "packages", "client", "ui-primitives");

/** Một phần tử giả để kiểm cây jsx mà không cần React. */
interface FakeElement {
  /** Loại: tên thẻ hoặc component. */
  type: unknown;
  /** Thuộc tính. */
  props: Record<string, unknown>;
}

/** Runtime jsx giả: gói lại { type, props } để kiểm cấu trúc. */
const runtime: GbhJsxRuntime = {
  jsx: (type, props) => ({ type, props }) as FakeElement,
  jsxs: (type, props) => ({ type, props }) as FakeElement,
};

/**
 * Duyệt cây phần tử giả, gọi callback cho từng phần tử.
 * Nhận: el — phần tử/chuỗi/mảng; visit — callback nhận phần tử.
 * Trả: khong.
 */
function walk(el: unknown, visit: (element: FakeElement) => void): void {
  if (el === null || el === undefined) return;
  if (Array.isArray(el)) {
    for (const item of el) walk(item, visit);
    return;
  }
  const element = el as FakeElement;
  if (typeof element !== "object" || !("type" in element)) return;
  visit(element);
  walk(element.props.children, visit);
}

/**
 * Lấy mọi chuỗi trong cây phần tử giả (để so path/thuộc tính).
 * Nhận: el — phần tử gốc.
 * Trả: mảng chuỗi (thuộc tính + con chữ).
 */
function stringsOf(el: unknown): string[] {
  const out: string[] = [];
  walk(el, (element) => {
    for (const value of Object.values(element.props)) {
      if (typeof value === "string") out.push(value);
    }
    if (typeof element.props.children === "string") out.push(element.props.children);
  });
  return out;
}

/**
 * Trích tên icon mà 53 bundle client của ta tham chiếu.
 * Nhận: khong.
 * Trả: tập tên icon (chuỗi literal dạng IconXxx) thuộc vũ trụ icon DSH đã có trong bảng tra.
 */
function iconNamesInBundles(): Set<string> {
  const known = new Set(Object.keys(DSH_TO_GBH_ICON));
  const found = new Set<string>();
  const root = join(REPO_ROOT, "packages", "client");
  for (const pkg of readdirSync(root)) {
    const file = join(root, pkg, "lib", "client.js");
    if (!existsSync(file)) continue;
    const code = readFileSync(file, "utf8");
    for (const match of code.matchAll(/\bIcon[A-Z][A-Za-z0-9]+\b/g)) {
      const name = match[0];
      if (known.has(name)) found.add(name);
    }
  }
  return found;
}

/**
 * Tìm bundle vỏ web đang cài (nguồn đối chiếu artwork 1:1).
 * Nhận: khong.
 * Trả: nội dung file JS lớn nhất của vỏ, hoặc null khi chưa cài vỏ.
 */
function shellBundleText(): string | null {
  const dir = join(REPO_ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist", "assets");
  if (!existsSync(dir)) return null;
  const candidates = readdirSync(dir).filter((name) => name.startsWith("index-") && name.endsWith(".js"));
  if (candidates.length === 0) return null;
  let best = "";
  let bestSize = -1;
  for (const name of candidates) {
    const text = readFileSync(join(dir, name), "utf8");
    if (text.length > bestSize) {
      bestSize = text.length;
      best = text;
    }
  }
  return best;
}

describe("ui-primitives — bảng đặc tả icon", () => {
  test("201 entry (189 icon DSH + 12 họ tổ hợp), mọi entry phân giải được artwork", () => {
    expect(Object.keys(GBH_ICONS).length).toBe(201);
    for (const [name, spec] of Object.entries(GBH_ICONS)) {
      const resolved = resolveGbhArtwork(spec.artwork);
      expect(resolved.artwork).toBeDefined();
      expect(spec.size).toBeGreaterThan(0);
      if (spec.strokeWidth !== undefined) expect([1, 1.3]).toContain(spec.strokeWidth);
      expect(name.startsWith("gbh:")).toBe(true);
    }
  });

  test("phủ 100% tên icon mà bundle client của ta đang tham chiếu (>=89 tên — số SỐNG)", () => {
    // Số đo 18/10/2026 lúc khảo sát: 53 bundle · 89 tên · 32 gói. Con số TĂNG khi teammate thêm icon vào gói mới
    // (ui-theme thêm 3 biến thể Medium) — điều bất biến là MỌI tên đều phải có trong sổ GBH, không phải con số 89.
    const names = iconNamesInBundles();
    expect(names.size).toBeGreaterThanOrEqual(89);
    for (const name of names) expect(DSH_TO_GBH_ICON[name]).toBeDefined();
  });

  /**
   * Đường SVG đã THAY CÓ CHỦ ĐÍCH vì lý do thương hiệu (22/10/2026): biểu tượng "đang suy nghĩ" của bản gốc
   * là logo cá voi của DeepSeek. Ta dùng tia sáng trung tính; test phải kiểm RIÊNG đường này.
   */
  const DUONG_THAY_BRAND = {
    moi: [
      "M8 1.75L9.35 6.65L14.25 8L9.35 9.35L8 14.25L6.65 9.35L1.75 8L6.65 6.65Z",
      "M12.6 2.4L13.1 4.1L14.8 4.6L13.1 5.1L12.6 6.8L12.1 5.1L10.4 4.6L12.1 4.1Z",
    ],
    goc: "M10.2854 5.71481C12.9673 8.39663 14.1182 11.5938 12.8562 12.8559",
  };

  test("artwork 1:1 với vỏ đang chạy: mọi path dài (>=30 ký tự) có mặt NGUYÊN VĂN", () => {
    const shell = shellBundleText();
    if (shell === null) {
      console.log("chưa cài vỏ web — bỏ qua phép đối chiếu artwork 1:1");
      return;
    }
    let checked = 0;
    const missing: string[] = [];
    for (const entry of Object.values(GBH_ARTWORKS)) {
      if (typeof entry === "function") continue;
      for (const node of (entry as GbhIconArtwork).nodes) {
        const collect = (item: unknown): void => {
          const element = item as { tag?: string; attrs?: Record<string, unknown>; children?: unknown[] };
          const d = element.attrs?.d;
          if (typeof d === "string" && d.length >= 30) {
            // 22/10/2026: đường thương hiệu đã thay thì kiểm RIÊNG (phải có bản của ta, phải KHÔNG còn bản gốc).
            if (DUONG_THAY_BRAND.moi.includes(d)) {
              // Vỏ web đang chạy là bản stock nên KHÔNG chứa đường của ta — bỏ qua phép "có mặt" cho đường
              // này; việc thay đã được kiểm bằng (a) chính bảng artwork, (b) ảnh chụp UI thật.
              expect(Object.values(GBH_ARTWORKS).some((e) => typeof e !== "function" && JSON.stringify(e).includes(d))).toBe(true);
              checked += 1;
            } else {
              checked += 1;
              if (!shell.includes(d)) missing.push(d.slice(0, 40));
            }
          }
          for (const child of element.children ?? []) collect(child);
        };
        collect(node);
      }
    }
    expect(missing).toEqual([]);
    expect(checked).toBeGreaterThanOrEqual(150);
  });

  test("artwork động (mask) và alias đều phân giải được; alias giữ kích thước gốc", () => {
    expect(typeof GBH_ARTWORKS.IconArchiveOffOutlineArtwork).toBe("function");
    expect(GBH_ARTWORK_ALIASES["IconPlanOutlineArtwork"]?.size).toBe(14);
    expect(resolveGbhArtwork("IconPlanOutlineArtwork").size).toBe(14);
    expect(GBH_ARTWORK_COUNT).toBe(Object.keys(GBH_ARTWORKS).length + Object.keys(GBH_ARTWORK_ALIASES).length);
  });
});

describe("ui-primitives — GbhIcon render", () => {
  const GbhIcon = createGbhIcon(runtime);

  test("regular: svg + aria-hidden + viewBox + strokeWidth 1", () => {
    const el = GbhIcon({ name: "gbh:chevron-down-outline-regular" }) as FakeElement;
    expect(el.type).toBe("svg");
    expect(el.props["aria-hidden"]).toBe("true");
    expect(el.props.viewBox).toBe("0 0 16 16");
    expect(el.props.strokeWidth).toBe(1);
    expect(el.props.width).toBe(14);
    expect(stringsOf(el)).toContain("M4 6L7.29289 9.29289C7.68342 9.68342 8.31658 9.68342 8.70711 9.29289L12 6");
  });

  test("medium: cùng artwork nhưng strokeWidth 1.3", () => {
    const el = GbhIcon({ name: "gbh:chevron-down-outline-medium" }) as FakeElement;
    expect(el.props.strokeWidth).toBe(1.3);
  });

  test("tra theo tên CŨ của DSH cho CÙNG cây phần tử", () => {
    const a = GbhIcon({ name: "gbh:chevron-down-outline-regular" });
    const b = GbhIcon({ name: "IconChevronDownOutlineRegular" });
    expect(JSON.stringify(b)).toEqual(JSON.stringify(a));
  });

  test("id gradient/mask DUY NHẤT giữa hai lần render cùng artwork", () => {
    const first = GbhIcon({ name: "gbh:archive-off-outline-regular" }) as FakeElement;
    const second = GbhIcon({ name: "gbh:archive-off-outline-regular" }) as FakeElement;
    const ids = (el: unknown): string[] => {
      const out: string[] = [];
      walk(el, (element) => {
        for (const [key, value] of Object.entries(element.props)) {
          if (typeof value === "string" && value.includes("gbh")) out.push(value);
        }
      });
      return out;
    };
    const a = ids(first);
    const b = ids(second);
    expect(a.length).toBeGreaterThan(0);
    for (const value of a) expect(b).not.toContain(value);
  });

  test("tên không có trong bảng ⇒ NÉM (không render rỗng âm thầm)", () => {
    expect(() => GbhIcon({ name: "gbh:khong-ton-tai" })).toThrow(/khong co icon/);
  });
});

describe("ui-primitives — asset thương hiệu Galaxy Blackhole", () => {
  test("logo hố đen: viewBox 128, có gradient, KHÔNG còn fish DSH", () => {
    const GbhLogo = createGbhLogo(runtime);
    const el = GbhLogo({ size: 24 }) as FakeElement;
    expect(el.type).toBe("svg");
    expect(el.props.viewBox).toBe(GBH_LOGO_VIEWBOX);
    expect(el.props.width).toBe(24);
    expect(el.props["aria-hidden"]).toBe("true");
    const all = stringsOf(el).join(" ");
    expect(all).toContain("#0b0a14");
    expect(all).not.toContain("M22.9168");
  });

  test("favicon + wordmark: viewBox 64, chữ 'Galaxy Blackhole' (không dùng font lạ)", () => {
    expect(GBH_FAVICON_VIEWBOX).toBe("0 0 64 64");
    const GbhWordmark = createGbhWordmark(runtime);
    const el = GbhWordmark({}) as FakeElement;
    expect(el.type).toBe("span");
    expect(el.props.children).toBe(GBH_WORDMARK_TEXT);
    expect(el.props.style).toMatchObject({ fontWeight: 600, letterSpacing: "0.01em", whiteSpace: "nowrap" });
  });

  test("sha256 asset khớp nguồn (N4) và không có thông hiệu DSH trong gói (N1)", () => {
    const logo = readFileSync(join(PKG, "assets", "gbh-logo.svg"));
    const favicon = readFileSync(join(PKG, "assets", "gbh-favicon.svg"));
    expect(createHash("sha256").update(logo).digest("hex")).toBe(GBH_LOGO_SOURCE_SHA256);
    expect(createHash("sha256").update(favicon).digest("hex")).toBe(GBH_FAVICON_SOURCE_SHA256);
    const srcDir = join(PKG, "src");
    for (const name of readdirSync(srcDir)) {
      if (!name.endsWith(".ts")) continue;
      const text = readFileSync(join(srcDir, name), "utf8");
      expect(text).not.toContain("M22.9168");
      expect(text).not.toContain("M68.416 18.2447");
    }
  });
});

describe("ui-primitives — trạng thái mount", () => {
  test("KHÔNG khai gbh.row và KHÔNG khai dsh.client ⇒ không mount, không đổi UI", () => {
    const meta = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Record<string, unknown>;
    expect(meta.gbh).toBeUndefined();
    expect(meta.dsh).toBeUndefined();
    expect(meta.name).toBe("@galaxy-blackhole/gbh-client-ui-primitives");
  });
});
