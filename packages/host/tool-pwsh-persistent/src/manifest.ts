/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguồn DUY NHẤT của danh mục lát nguyên văn + tên package của gói THƯ VIỆN tool-pwsh-persistent
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-tool-pwsh-persistent";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-tool-pwsh-persistent";

/** Đường dẫn bundle gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte). */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-tool-pwsh-persistent/lib/index.js";

/** Dòng đánh dấu lát nguyên văn. */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS. */
export const MODULE_TAIL = "export {};";

/** Danh mục lát theo ĐÚNG thứ tự ghép (bundle gốc 399 dòng ⇒ MỘT lát, không cần cắt). */
export const PART_FILES: readonly string[] = ["part-00.ts"];

/** Tên file artefact build ra. */
export const OUT_FILE_NAME = "index.js";
