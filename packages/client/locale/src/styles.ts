/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang lop CSS + stylesheet cua muc Language — giu NGUYEN ten lop va khai bao cua ban goc
 */

/** Tên lớp CSS của mục Language — GIỮ NGUYÊN tên lớp của bản gốc để bề mặt DOM không lệch. */
export const CLASS = {
  row: "hVGvvW_row",
  rowText: "hVGvvW_rowText",
  title: "hVGvvW_title",
  selector: "hVGvvW_selector",
  chevron: "hVGvvW_chevron",
} as const;

/**
 * Stylesheet của mục Language (cùng khai báo, cùng tên lớp như bản gốc — 696 B).
 * Nhúng thẳng vào bundle vì `bh host` chỉ mount `package.json` + `lib/*.js` vào profile.
 */
export const STYLES: string =
  "." + CLASS.row + "{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}" +
  "." + CLASS.rowText + "{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}" +
  "." + CLASS.title + "{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}" +
  "." + CLASS.selector + "{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}" +
  "." + CLASS.selector + ":hover{background:var(--dsw-alias-interactive-bg-hover)}" +
  "." + CLASS.chevron + "{flex:none}";

/** Đuôi đường dẫn CSS-module gắn vào thẻ `<style data-plugin-css>` (đúng đường dẫn của bản gốc). */
export const STYLE_TAG_SUFFIX = "/LanguageRow.module.css";
