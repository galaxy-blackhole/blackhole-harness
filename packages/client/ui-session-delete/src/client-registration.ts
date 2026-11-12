/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Hợp đồng đăng ký bundle nửa browser: bọc bundle CJS thành script classic gọi
 *      window.__ModuleLoader__.load({ id, factory }) — MỘT BUNDLE MỘT ID (khuôn của ui-agent-team).
 */

/** Năm dòng header bắt buộc của repo, chèn vào file sinh ra để bản build cũng tự khai nguồn. */
export const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 24/10/2026",
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-ui-session-delete — khong sua tay",
  " */",
].join(String.fromCharCode(10));

/**
 * Thụt lề mọi dòng không rỗng của một khối mã.
 * Nhận: code — khối mã; levels — số cấp thụt lề.
 * Trả: khối mã đã thụt lề.
 */
export function indent(code: string, levels: number): string {
  const pad = "  ".repeat(levels);
  return code
    .split(String.fromCharCode(10))
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join(String.fromCharCode(10));
}

/**
 * Bọc bundle CJS thành script classic đăng ký MỘT id module (id CỦA TA).
 * Nhận: code — mã CJS đã bundle; packageName — id module của ta.
 * Trả: văn bản script classic hoàn chỉnh.
 */
export function wrapClientBundle(code: string, packageName: string): string {
  return [
    GENERATED_HEADER,
    "(function () {",
    '  "use strict";',
    "  var factory = function (require) {",
    "    var module = { exports: {} };",
    "    var exports = module.exports;",
    indent(code, 2),
    "    return module.exports.createPlugin(require);",
    "  };",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(packageName) + ", factory: factory });",
    "})();",
    "",
  ].join(String.fromCharCode(10));
}
