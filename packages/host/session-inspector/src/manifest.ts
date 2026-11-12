/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Manifest bản biên dịch nửa client session-inspector: thứ tự ghép sáu lát nguyên văn + bảng thay thế CSS
 */

/**
 * Danh sách lát theo ĐÚNG thứ tự ghép — mỗi lát là một file trong src/parts/.
 * Nội dung từng lát là NGUYÊN VĂN bundle gốc @deepseek-ai/dsh-experimental-session-inspector/lib/client.js
 * (cắt theo mốc //#region của chính nó; xem tools/split-stock-bundle.ts), chỉ khác phần giao kèo
 * (header 5 dòng + @ts-nocheck + hai dòng đánh dấu vỏ + export {}) mà src/assemble.ts GỠ khi ghép.
 * Nhận: không.
 * Trả: mảng đường dẫn tương đối so với src/.
 */
export const PART_FILES: readonly string[] = [
  "parts/part-01.ts",
  "parts/part-02.ts",
  "parts/part-03.ts",
  "parts/part-04.ts",
  "parts/part-05.ts",
  "parts/part-06.ts",
];

/** Một chỗ thay thế CSS trong bản biên dịch. */
export interface CssReplacement {
  /** Điểm thay thế xuất hiện trong lát mã nguồn (build.ts thay bằng chuỗi CSS đã mã hoá JSON). */
  readonly placeholder: string;
  /** Đường dẫn file .module.css tương đối so với src/ — nguồn sự thật của CSS. */
  readonly file: string;
}

/**
 * Bảng thay thế CSS: mỗi điểm thay thế trong lát ứng với đúng một file .module.css.
 * Bundle gốc nhúng ĐÚNG MỘT module CSS (vùng \0dsh-css:…inspector.module.css.mjs, một chuỗi một dòng
 * 6.679 byte); tools/extract-css.ts tách nó ra và để lại điểm thay thế, build.ts nhúng lại NGUYÊN VĂN.
 * Nhận: không.
 * Trả: mảng các cặp điểm thay thế ↔ file CSS, theo thứ tự xuất hiện trong bundle.
 */
export const CSS_REPLACEMENTS: readonly CssReplacement[] = [
  { placeholder: "__GBH_SESSION_INSPECTOR_CSS_inspector__", file: "styles/inspector.module.css" },
];

/**
 * Dòng đánh dấu MỞ vỏ của một mảnh bị cắt giữa câu lệnh — NGUỒN SỰ THẬT DUY NHẤT.
 * tools/split-stock-bundle.ts in dòng này vào mỗi mảnh (kèm phần ngoặc cần mở lại); src/assemble.ts
 * GỠ đúng những dòng khớp khuôn này khi ghép, nên bản chạy vẫn NGUYÊN VĂN từng byte.
 */
export const FRAGMENT_BEGIN_MARKER = "// __DSH_FRAGMENT_BEGIN__";

/** Dòng đánh dấu ĐÓNG vỏ của một mảnh bị cắt giữa câu lệnh. */
export const FRAGMENT_END_MARKER = "// __DSH_FRAGMENT_END__";

/** Khuôn nhận diện dòng đánh dấu vỏ: dòng KẾT THÚC bằng một trong hai dấu. */
export const FRAGMENT_MARKER_LINE = /\/\/ __DSH_FRAGMENT_(?:BEGIN|END)__\s*$/;
