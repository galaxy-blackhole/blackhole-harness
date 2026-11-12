/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Boc bundle CJS cua nua browser thanh dang ky __ModuleLoader__.load (id = ten package)
 */

import { PACKAGE_NAME } from "./ids.ts";

/**
 * Bọc bundle CJS thành một lời gọi đăng ký của vỏ.
 * Nhận: mã CJS đã build của nửa browser, và header sinh tự động.
 * Trả: mã hoàn chỉnh để ghi ra `lib/client.js`.
 */
export function wrapClientBundle(code: string, header: string): string {
  return [
    header,
    "window.__ModuleLoader__.load({",
    "\tid: " + JSON.stringify(PACKAGE_NAME) + ",",
    "\tfactory: (require) => {",
    '\t\t"use strict";',
    "\t\tvar module = { exports: {} };",
    "\t\tvar exports = module.exports;",
    indent(code, 2),
    "\t\treturn module.exports;",
    "\t}",
    "});",
    "",
  ].join("\n");
}

/**
 * Thụt lề mọi dòng không rỗng của một khối mã.
 * Nhận: mã nguồn và số cấp thụt lề.
 * Trả: mã đã thụt lề.
 */
export function indent(code: string, levels: number): string {
  const pad = "\t".repeat(levels);
  return code
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join("\n");
}

