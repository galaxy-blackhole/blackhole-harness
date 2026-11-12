/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc CSS của tiêu đề tab terminal
 */

/** CSS của tiêu đề tab terminal (giữ nguyên khai báo, đổi tiền tố lớp). */
export const TITLE_CSS = ".gbhTermyms_title{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.gbhTermyms_name{width:120px;min-width:48px;max-width:100%;color:inherit;font:inherit;background:var(--dsw-alias-bg-l1);border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);outline:none;padding:0 4px}";

/** Tên lớp sau khi đổi tiền tố. */
export const TITLE_CLASS = Object.freeze({
  "name": "gbhTermyms_name",
  "title": "gbhTermyms_title",
});
