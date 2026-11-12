/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang dinh danh cua row ui-plugin-manager: id module, NS tu dien, PANEL_ID, slot dang ky va slot tieu thu
 */

/**
 * Id MODULE chinh — package cua ta. Bundle dang ky DUNG MOT id (khuon #2 cua task-57).
 * Ten nay PHAI khop cot "gbh tuong ung" cua docs/PARITY-MATRIX.md.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-plugin-manager";

/** Id MODULE cua ban goc — di vao gbh.row.aliases (KHONG vao moduleIds, KHONG dang ky trong bundle). */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-plugin-manager";

/** Namespace tu dien cua man Plugins (giu nguyen chuoi cua ban goc). */
export const NS = "pluginManager";

/** Id cua panel trong sidebar (ban goc: "plugins") — cung la id occupant cua sidebar.panellist. */
export const PANEL_ID = "plugins";

/** Thu tu cua panel trong sidebar.panellist (ban goc: 0). */
export const PANEL_ORDER = 0;

/** Id occupant cua toast lam moi trong shell.overlay (ban goc giu nguyen chuoi). */
export const TOAST_OCCUPANT_ID = "plugin-manager.refresh-toast";

/** Slot ma row NAY dang ky vao: lop phu cua vo ung dung (toast lam moi). */
export const SLOT_SHELL_OVERLAY = "shell.overlay";

/** Slot chinh cua khung ung dung — noi dat trang quan ly plugin. */
export const SLOT_MAIN = "main";

/** Slot danh sach panel o sidebar — noi dat muc "Plugins". */
export const SLOT_SIDEBAR_PANELLIST = "sidebar.panellist";

/** Cac slot ma row nay TIEU THU (doc entries/getVersion/subscribe) — ban goc goi la SLOTS. */
export const CONSUMED_SLOTS = [
  "plugins.item",
  "plugins.bundle.config",
  "plugins.row.config",
] as const;

/** Slot tab trong trang quan ly plugin (row khac dang ky tab vao day). */
export const SLOT_PLUGINS_TAB = "plugins.tab";

/** Nhan hieu ung vong doi — giu nguyen chuoi cua ban goc de log/chan doan doi chieu duoc. */
export const EFFECT = {
  /** Dang ky tu dien cua man Plugins. */
  dictionaries: "ui-plugin-manager: dictionaries",
} as const;
