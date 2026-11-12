/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 07/11/2026
 * desc Nửa client của gói settings-about: đăng ký MỘT mục vào settings.section với ICON SVG RIÊNG.
 *   ⚠️ Đây là package ĐỘC LẬP — không thay row nào của DSH; nó chỉ THÊM một mục vào popup Settings.
 *   Đồng thời là phép thử cho đường cài plugin ngoài (extra-bundles.json) và cho trường mở rộng
 *   `icon` mà ta thêm vào nav của ui-settings-general.
 */

import { LOCALE_KEY, en, vi, zh } from "./locales.ts";
import { ZALO_DATA_URI } from "./zalo-data.ts";

/** Bảng module của bộ nạp — chỉ id trong `load()` mới vào bảng (id của `slots.register` thì KHÔNG). */
const loader = (globalThis as unknown as {
  __ModuleLoader__: { load(registration: { id: string; factory: unknown }): void };
}).__ModuleLoader__;

/** require do bảng module cấp cho factory. */
type RequireFn = (id: string) => unknown;

/** Bề mặt context phía browser mà gói này dùng. */
interface ClientContext {
  /** Seam slot. */
  slots: {
    /** Đăng ký khi ghế cha đã có trên sổ. */
    inject(name: string, register: () => unknown): unknown;
    /** Đăng ký một ghế. */
    register(spec: Record<string, unknown>, component: unknown): unknown;
  };
  /** Seam từ điển. */
  locale: { bind(namespace: string): (key: string) => string; register(namespace: string, dictionaries: unknown): unknown };
  /** Vòng đời cordis. */
  effect(callback: () => unknown, label?: string): unknown;
}

/** jsx runtime (React) do bảng module cấp. */
interface JsxRuntime {
  jsx(type: unknown, props: Record<string, unknown>): unknown;
  jsxs(type: unknown, props: Record<string, unknown>): unknown;
}

/** Id ghế của ta trong `settings.section` (KHÔNG trùng id nào của DSH). */
export const SECTION_ID = "about";

/**
 * Cờ chặn cài hai lần ở PHẠM VI MODULE (hai entry ⇒ hai ctx nên khoá theo ctx không chặn được).
 * @see docs/recipes/ROW-REVIEW-CHECKLIST.md
 */
let installed = false;

/**
 * Icon SVG RIÊNG của mục Thông tin — đây là điểm mấu chốt của thí nghiệm: bản gốc tra bảng cứng
 * `NAV_ICONS` theo id nên mục mới LUÔN ra icon Settings; ta truyền component nên icon ĐỔI ĐƯỢC.
 * @param props - props React (chỉ dùng `className` và `size`).
 * @returns phần tử svg 16px.
 */
function AboutIcon(props: Record<string, unknown>): unknown {
  const size = typeof props.size === "number" ? props.size : 16;
  return runtime.jsx("svg", {
    className: props.className,
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    children: runtime.jsxs("g", {
      children: [
        runtime.jsx("circle", { cx: 8, cy: 8, r: 6.2 }),
        runtime.jsx("path", { d: "M8 7.2v4" }),
        runtime.jsx("circle", { cx: 8, cy: 4.9, r: 0.75, fill: "currentColor", stroke: "none" }),
      ],
    }),
  });
}

/** jsx runtime — do factory gán trước khi plugin chạy. */
let runtime: JsxRuntime;

/**
 * Tác giả hiển thị trong panel Thông tin — port TRUNG THÀNH từ galaxy-code/src/info.ts (bản gốc của blackhole web).
 *   Nguồn: `galaxy-code/src/info.ts` — AUTHOR { name, email, zaloImage, website }, versionLine(),
 *   infoLines(). Thứ tự dòng đúng như infoLines: Tác giả · Email · Website · Zalo (thẻ ảnh).
 *   ⚠️ 07/11/2026 — DÒNG "Phiên bản gói" ĐÃ XOÁ theo yêu cầu (tab Thông tin không hiện phiên bản gói nữa).
 */
const AUTHOR = Object.freeze({
  name: "Bùi Trọng Hiếu",
  email: "kevinbui210191@gmail.com",
  website: "https://galaxy-blackhole.vercel.app/",
});

/** Thẻ Zalo nhúng base64 (bundle client không phục vụ được asset theo đường dẫn gói). */
const ZALO_ASSET = ZALO_DATA_URI;

/**
 * Panel Thông tin: đúng bố cục của trang thông tin blackhole web (KHÔNG còn dòng phiên bản gói).
 * @param props - props React; `t` là hàm dịch của namespace `settings.about`.
 * @returns phần tử jsx (title · tác giả · email · website · thẻ Zalo).
 */
function AboutPanel(props: Record<string, unknown>): unknown {
  const t = typeof props.t === "function" ? (props.t as (k: string) => string) : (k: string) => k;
  const row = (key: string, label: string, value: string): unknown =>
    runtime.jsxs("div", {
      key,
      style: { display: "flex", gap: 6, fontSize: 14, lineHeight: "22px" },
      children: [
        runtime.jsx("span", { style: { opacity: 0.75 }, children: label }),
        runtime.jsx("span", { children: value }),
      ],
    });
  const link = runtime.jsxs("div", {
    key: "website",
    style: { display: "flex", gap: 6, fontSize: 14, lineHeight: "22px" },
    children: [
      runtime.jsx("span", { style: { opacity: 0.75 }, children: "Website:" }),
      runtime.jsx("a", { href: AUTHOR.website, target: "_blank", rel: "noreferrer", style: { color: "var(--dsw-alias-brand-primary)" }, children: AUTHOR.website }),
    ],
  });
  const zalo = runtime.jsxs("div", {
    key: "zalo",
    style: { marginTop: 16, width: 300, borderRadius: 10, background: "#3f5876", padding: 16, boxSizing: "border-box" },
    children: [
      runtime.jsx("div", { style: { textAlign: "center", color: "#fff", fontSize: 12, opacity: 0.9, marginBottom: 8 }, children: t("about.zaloCard") }),
      runtime.jsx("img", { src: ZALO_ASSET, alt: t("about.zaloCard"), style: { width: "100%", borderRadius: 6, display: "block" } }),
    ],
  });
  const children: unknown[] = [
    runtime.jsx("div", { key: "title", style: { fontSize: 22, fontWeight: 600, marginBottom: 12 }, children: t("about.title") }),
    row("author", t("about.author"), AUTHOR.name),
    row("email", t("about.email"), AUTHOR.email),
    link,
    zalo,
  ];
  return runtime.jsx("div", { style: { padding: 4 }, children });
}

/**
 * Dựng plugin phía browser.
 * @param requireFn - require của bảng module.
 * @returns plugin có `apply` + `inject`.
 */
function createPlugin(requireFn: RequireFn): { apply(ctx: ClientContext): void; inject: string[] } {
  const react = ((): JsxRuntime => {
    const jsxRuntime = requireFn("react/jsx-runtime") as JsxRuntime | undefined;
    if (!jsxRuntime) throw new Error("settings-about: thieu react/jsx-runtime");
    return jsxRuntime;
  })();
  runtime = react;

  /** Cài wiring của gói. */
  function apply(ctx: ClientContext): void {
    if (installed) return;
    installed = true;
    ctx.effect(() => ctx.locale.register(LOCALE_KEY, { en, vi, zh }), "settings-about.dictionaries");
    const t = ctx.locale.bind(LOCALE_KEY);
    // ⚠️ 18/10/2026 — SỔ ĐĂNG KÝ ICON cấp module. `slots.register` có thể KHÔNG giữ trường lạ
    //   `icon` trong options (kernel DSH chỉ biết trường chuẩn), nên ngoài việc khai trong spec,
    //   ta ghi thêm vào sổ này để ui-settings-general đọc được icon riêng của gói độc lập.
    const iconRegistry = ((globalThis as Record<string, unknown>).__gbhSectionIcons ??= {}) as Record<string, unknown>;
    iconRegistry[SECTION_ID] = AboutIcon;
    ctx.effect(
      () => ctx.slots.inject("settings.section", () => ctx.slots.register(
        {
          name: "settings.section",
          id: SECTION_ID,
          order: 900,
          locale: LOCALE_KEY,
          label: () => t("about.nav"),
          icon: AboutIcon,
          inject: () => ({ t }),
        },
        AboutPanel,
      )),
      "settings-about.section",
    );
  }

  return { apply, inject: ["slots", "locale"] };
}

/** Factory mà bảng module gọi khi nạp bundle. */
const factory = (requireFn: RequireFn): unknown => createPlugin(requireFn);

// id CHÍNH = package của ta (để rev của HMR trả đúng dòng trong manifest).
loader.load({ id: "@galaxy-blackhole/gbh-client-settings-about", factory });

/** Đánh dấu tệp này là MODULE (tránh chế độ script toàn cục làm đụng tên với package khác). */
export {};

