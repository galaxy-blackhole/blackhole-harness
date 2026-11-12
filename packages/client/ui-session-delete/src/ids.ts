/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Id của row @galaxy-blackhole/gbh-client-ui-session-delete: một occupant trong menu ngữ cảnh phiên
 *      (slot KEYED do ui-workspace khai) để xoá vĩnh viễn một phiên đã lưu (ADR 0016).
 */

/** Id module của gói (một bundle một id). */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-session-delete";

/** Namespace từ điển của gói. */
export const NS = "session-delete";

/** Slot menu ngữ cảnh của một phiên trong sidebar (khai bởi ui-workspace). */
export const SLOT_SESSION_MENU_ITEM = "sidebar.workspaces.session.menu.item";

/** Id occupant trong slot trên. */
export const OCCUPANT_ID = "delete-session";

/** Thứ tự occupant — đặt SAU Fork (300) và Archive (400) để không chen ngang các mục quen thuộc. */
export const OCCUPANT_ORDER = 500;

/** Id thẻ `<style>` chèn CSS của row (một lần cho mỗi plugin). */
export const STYLE_TAG = PACKAGE_NAME + "/dialog.module.css";

/** Service client mà row cần (nguyên văn cơ chế của gói khác trong repo). */
export const INJECT: readonly string[] = ["remote", "locale"];
