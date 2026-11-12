/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so cua row ui-shortcuts: id module, id goi goc, namespace tu dien, nhan hieu ung, id the style
 */

/** Ten package cua ta — id module DUY NHAT ma bundle tu khai (khop `gbh.row.moduleIds`). */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-shortcuts";

/** Ten package goc DSH — CHI nam o `gbh.row.aliases`; dang ky no trong bundle la app trang. */
export const STOCK_NAME = "@deepseek-ai/dsh-client-ui-shortcuts";

/** Namespace tu dien cua row (ban goc `ctx.locale.register("shortcuts", …)` + `bind("shortcuts")`). */
export const NS = "shortcuts";

/**
 * Bon goi ma ban goc khai o `dsh.client.inject` (package.json goc) — giu NGUYEN VAN thu tu.
 * Tầng nạp của ta đổi id gốc sang gói của ta qua `aliases`, nên danh sách này không đổi.
 */
export const STOCK_CLIENT_INJECT: readonly string[] = [
  "@deepseek-ai/dsh-client-shortcuts",
  "@deepseek-ai/dsh-client-locale",
  "@deepseek-ai/dsh-client-ui-layout",
  "@deepseek-ai/dsh-client-ui-settings",
];

/** Nhan hieu ung vong doi — giu NGUYEN VAN chuoi cua ban goc (log boot doi chieu duoc). */
export const EFFECT = {
  /** Dang ky hai bang tu dien cua namespace `shortcuts`. */
  dictionaries: "shortcuts: dictionaries",
  /** Ghe hang "Phim tat" trong Settings (list `settings.general.item`). */
  settingsItem: "settings.general.item",
  /** Hop thoai tra cuu phim tat (single `shell.overlay`). */
  shellOverlay: "shell.overlay",
} as const;

/** Id gan vao `data-plugin-css` cua the style (ban goc: `<package gốc>/Reference.module.css`). */
export const STYLE_TAG = PACKAGE_NAME + "/Reference.module.css";
