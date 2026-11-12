/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguồn DUY NHẤT của danh mục lát nguyên văn + tên package của gói THƯ VIỆN compaction-tool-result-pruner
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-compaction-tool-result-pruner";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-compaction-tool-result-pruner";

/** Đường dẫn bundle gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte), tính từ gốc repo. */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-compaction-tool-result-pruner/lib/index.js";

/** Dòng đánh dấu lát nguyên văn (cũng là dấu mở phần giao kèo của mỗi lát). */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS của mỗi lát. */
export const MODULE_TAIL = "export {};";

/**
 * Danh mục lát theo ĐÚNG thứ tự ghép. Bundle gốc là MỘT khối liền mạch 194 dòng
 * (hai vùng `//#region` ở dòng 5 và 54), nên chỉ cần MỘT lát — cắt thêm sẽ không
 * còn nằm trên ranh giới `^//#region` gần nhất.
 */
export const PART_FILES: readonly string[] = ["part-00.ts"];

/** Tên file artefact build ra. */
export const OUT_FILE_NAME = "index.js";
