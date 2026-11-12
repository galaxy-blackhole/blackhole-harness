/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguồn DUY NHẤT của danh mục lát nguyên văn + cây artefact của gói THƯ VIỆN tool-cordis
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-tool-cordis";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-tool-cordis";

/** Đường dẫn bundle gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte). */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-tool-cordis/lib/index.js";

/** Đường dẫn manifest gốc (CHỈ ĐỌC — nguồn đối chiếu peerDependencies/exports). */
export const STOCK_PACKAGE_JSON = "apps/host/node_modules/@deepseek-ai/dsh-tool-cordis/package.json";

/** Thư mục 6 tệp JS KHÔNG BUNDLE của subpath `./host` (CHỈ ĐỌC — copy nguyên văn). */
export const STOCK_TYPES_DIR = "apps/host/node_modules/@deepseek-ai/dsh-tool-cordis/lib/types";

/** Thư mục locale gốc (CHỈ ĐỌC — copy nguyên văn cả cây con host/). */
export const STOCK_LOCALE_DIR = "apps/host/node_modules/@deepseek-ai/dsh-tool-cordis/locale";

/** Dòng đánh dấu lát nguyên văn. */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS. */
export const MODULE_TAIL = "export {};";

/** Danh mục lát theo ĐÚNG thứ tự ghép (mỗi lát ≤1000 dòng, chia tại ranh giới //#region). */
export const PART_FILES: readonly string[] = ["part-00.ts", "part-01.ts"];

/** Tên file artefact chính build ra. */
export const OUT_FILE_NAME = "index.js";

/** Tên thư mục con chứa 6 tệp JS của subpath `./host` (dưới thư mục build). */
export const TYPES_DIR_NAME = "types";

/** ĐÚNG 6 tệp JS KHÔNG BUNDLE của subpath `./host` — giữ nguyên tên, copy từng byte. */
export const HOST_TYPES_FILES: readonly string[] = [
  "api-catalog.js",
  "config.js",
  "host.js",
  "index.js",
  "present.js",
  "providers.js",
];

/** ĐÚNG 4 tệp locale của gói gốc, giữ nguyên cây con host/. */
export const LOCALE_FILES: readonly string[] = ["en.json", "zh.json", "host/en.json", "host/zh.json"];
