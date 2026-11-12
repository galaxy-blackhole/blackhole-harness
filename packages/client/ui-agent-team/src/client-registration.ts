/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hợp đồng đăng ký bundle nửa browser: bọc bundle CJS thành script classic gọi
 *      window.__ModuleLoader__.load({ id, factory }) — MỘT BUNDLE MỘT ID. build.ts dùng hàm này để sinh
 *      lib/client.js, nên literal `load(` nằm trong src (cổng check:rows kiểm đúng chỗ này).
 */

/** Năm dòng header bắt buộc của repo, chèn vào file sinh ra để bản build cũng tự khai nguồn. */
export const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-ui-agent-team — khong sua tay",
  " */",
].join("\n");

/**
 * Thụt lề mọi dòng không rỗng của một khối mã.
 * Nhận: khối mã và số cấp thụt lề.
 * Trả: khối mã đã thụt lề.
 */
export function indent(code: string, levels: number): string {
  const pad = "  ".repeat(levels);
  return code
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join("\n");
}

/**
 * Bọc bundle CJS thành script classic đăng ký MỘT id module (id CỦA TA).
 *
 * ⚠️ Quy tắc "MỘT BUNDLE MỘT ID" (trả giá 17/10/2026): đăng ký thêm id của gói GỐC trong CÙNG bundle làm
 * cùng một bundle chạy hai lần ⇒ `duplicate factory registration` ⇒ app trắng. Id gốc thuộc
 * `gbh.row.aliases` và tầng nạp TỰ sinh entry alias.
 * Nhận: code — mã CJS đã bundle (dùng module/exports như biến tự do); packageName — id module của ta.
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
    "  // id CHINH = package cua ta (khop manifest va rev cua HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(packageName) + ", factory: factory });",
    "  // KHONG dang ky id cua goi GOC: no thuoc `gbh.row.aliases` va tang nap TU sinh entry alias.",
    "})();",
    "",
  ].join("\n");
}
