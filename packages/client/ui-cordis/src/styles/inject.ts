/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Chèn ba thẻ style của row vào head đúng một lần (idempotent theo data-plugin-css) — tương đương khối chèn CSS ở đầu ba vùng CSS của bản gốc
 */

import { PACKAGE_NAME } from "../ids.ts";
import { CSS as DEFINE_ROW_CSS, TAG_ID as DEFINE_ROW_TAG_ID } from "./define-row.ts";
import { CSS as PANEL_CSS, TAG_ID as PANEL_TAG_ID } from "./panel.ts";
import { CSS as RUN_ROW_CSS, TAG_ID as RUN_ROW_TAG_ID } from "./run-row.ts";

/**
 * Chèn một stylesheet vào `<head>` nếu chưa có thẻ cùng `data-plugin-css`.
 * Nhận: tagId — id của thẻ style; css — văn bản CSS.
 * Trả: không.
 */
export function injectStyleTag(tagId: string, css: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = css;
  document.head.appendChild(tag);
}

/**
 * Chèn cả ba stylesheet của row (thẻ Run, thẻ Define, bảng Cordis) theo đúng thứ tự của bản gốc.
 * Nhận: không.
 * Trả: không.
 */
export function injectStyles(): void {
  injectStyleTag(RUN_ROW_TAG_ID, RUN_ROW_CSS);
  injectStyleTag(DEFINE_ROW_TAG_ID, DEFINE_ROW_CSS);
  injectStyleTag(PANEL_TAG_ID, PANEL_CSS);
}
