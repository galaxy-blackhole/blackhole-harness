/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Manifest bản biên dịch nửa client cordis-client-runner: thứ tự ghép các lát nguyên văn của bundle gốc
 */

/**
 * Danh sách lát theo ĐÚNG thứ tự ghép — mỗi lát là một file trong src/parts/.
 * Nội dung từng lát là NGUYÊN VĂN bundle gốc @deepseek-ai/dsh-cordis-client-runner/lib/client.js
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
  "parts/part-07.ts",
  "parts/part-08.ts",
  "parts/part-09.ts",
  "parts/part-10.ts",
  "parts/part-11.ts",
];

/**
 * Điểm thay thế CSS — bundle gốc của row này KHÔNG có module CSS nào (CSS của package động do
 * DynamicCordisStyles chèn lúc chạy, không nhúng sẵn), nên bảng rỗng là ĐÚNG chứ không phải bỏ sót.
 * Nhận: không.
 * Trả: mảng rỗng.
 */
export const CSS_REPLACEMENTS: readonly { readonly placeholder: string; readonly file: string }[] = [];

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
