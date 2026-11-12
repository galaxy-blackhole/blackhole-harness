/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguồn DUY NHẤT của danh mục lát nguyên văn + tên package của gói DỊCH VỤ terminal (row lồng trong group)
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-terminal";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-terminal";

/** Đường dẫn bundle gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte). */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-terminal/lib/index.js";

/** Dòng đánh dấu lát nguyên văn. */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS. */
export const MODULE_TAIL = "export {};";

/** Danh mục lát theo ĐÚNG thứ tự ghép — bundle gốc là MỘT khối liền nên chỉ có MỘT lát. */
export const PART_FILES: readonly string[] = ["part-00-index.ts"];

/** Tên file artefact build ra. */
export const OUT_FILE_NAME = "index.js";
