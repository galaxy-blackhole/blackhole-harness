/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguồn DUY NHẤT của danh mục lát nguyên văn + tên package của gói session-persistence-jsonl
 */
/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-session-persistence-jsonl";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-session-persistence-jsonl";

/** Đường dẫn bundle gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte). */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-session-persistence-jsonl/lib/index.js";

/** Dòng đánh dấu lát nguyên văn. */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS. */
export const MODULE_TAIL = "export {};";

/** Danh mục lát theo ĐÚNG thứ tự ghép. */
export const PART_FILES: readonly string[] = [
"part-00-head.ts",
"part-01-win32-lease.ts",
"part-02-format.ts",
"part-03-zstd.ts",
"part-04-migration-verifier.ts",
"part-05-generation.ts",
"part-06-catalog-migration.ts",
"part-07-index-head.ts",
"part-08-persistence-body.ts",
"part-09-plugin-tail.ts",
];

/** Tên file artefact build ra. */
export const OUT_FILE_NAME = "index.js";
