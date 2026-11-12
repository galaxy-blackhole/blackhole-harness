/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguồn DUY NHẤT của danh mục lát nguyên văn + tên package của gói terminal-bash
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-terminal-bash";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-terminal-bash";

/** Đường dẫn bundle gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte), tính từ gốc repo. */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-terminal-bash/lib/index.js";

/** Dòng đánh dấu lát nguyên văn (cũng là dấu mở phần giao kèo của mỗi lát). */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS của mỗi lát. */
export const MODULE_TAIL = "export {};";

/**
 * Danh mục lát theo ĐÚNG thứ tự ghép. Bundle gốc là MỘT khối 1085 dòng với ba vùng
 * `//#region` (6 · 241 · 897), nên cắt tại vùng gần mid nhất (dòng 241) thành hai lát
 * 240 + 845 dòng — mỗi lát vẫn ≤ 1000 dòng.
 */
export const PART_FILES: readonly string[] = [
  "part-00.ts",
  "part-01.ts",
];

/** Tên file artefact build ra. */
export const OUT_FILE_NAME = "index.js";
