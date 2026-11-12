/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Chen style cua CSS Module mot lan duy nhat (ban goc chen qua chuoi \0dsh-css cua bundler)
 */

import { PACKAGE_NAME } from "./ids.ts";

/**
 * Chèn một khối CSS vào `<head>` đúng một lần cho mỗi `tagId`.
 * Nhận: tagId — id gắn vào `data-plugin-css` (id của TA, không phải id package gốc); cssText — nội dung CSS.
 * Trả: không.
 */
export function injectStyleTag(tagId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}
