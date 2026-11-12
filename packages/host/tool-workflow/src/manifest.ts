/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguồn DUY NHẤT của danh mục lát nguyên văn + tên package của gói THƯ VIỆN tool-workflow
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-tool-workflow";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-tool-workflow";

/** Đường dẫn bundle gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte), tính từ gốc repo. */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-tool-workflow/lib/index.js";

/** Dòng đánh dấu lát nguyên văn (cũng là dấu mở phần giao kèo của mỗi lát). */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS của mỗi lát. */
export const MODULE_TAIL = "export {};";

/**
 * Danh mục lát theo ĐÚNG thứ tự ghép. Bundle gốc là MỘT khối liền mạch 442 dòng
 * (hai vùng `//#region` ở dòng 3 và 46: record.js + index.js), dưới ngưỡng 1000 dòng,
 * nên chỉ cần MỘT lát — cắt thêm sẽ không còn nằm trên ranh giới `^//#region` gần mid.
 */
export const PART_FILES: readonly string[] = ["part-00.ts"];

/** Tên file artefact build ra. */
export const OUT_FILE_NAME = "index.js";

/**
 * Hai tệp JS KHÔNG BUNDLE của stock (lib/types/types.js import ./record.js) mà ta mirror
 * NGUYÊN VĂN vào lib/types/ để subpath `./types` của gói chạy được — cặp [nguồn, đích],
 * đường dẫn nguồn tính từ gốc repo.
 */
export const TYPE_MIRROR_FILES: readonly (readonly [string, string])[] = [
  [
    "apps/host/node_modules/@deepseek-ai/dsh-tool-workflow/lib/types/types.js",
    "types/types.js",
  ],
  [
    "apps/host/node_modules/@deepseek-ai/dsh-tool-workflow/lib/types/record.js",
    "types/record.js",
  ],
];
