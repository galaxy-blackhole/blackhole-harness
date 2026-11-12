/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguồn DUY NHẤT của danh mục lát nguyên văn + tên package của gói THƯ VIỆN tool-terminal
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-tool-terminal";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-tool-terminal";

/** Đường dẫn bundle gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte), tính từ gốc repo. */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-tool-terminal/lib/index.js";

/** Dòng đánh dấu lát nguyên văn (cũng là dấu mở phần giao kèo của mỗi lát). */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS của mỗi lát. */
export const MODULE_TAIL = "export {};";

/**
 * Danh mục lát theo ĐÚNG thứ tự ghép. Bundle gốc là MỘT khối liền mạch (654 dòng,
 * ba vùng `//#region` 6 + 107 + 141 dòng), không có ranh giới `^//#region` nào
 * gần giữa (dòng 327) và toàn bộ vừa MỘT tệp ≤ 1000 dòng — nên chỉ cần MỘT lát.
 */
export const PART_FILES: readonly string[] = ["part-00.ts"];

/** Tên file artefact build ra. */
export const OUT_FILE_NAME = "index.js";
