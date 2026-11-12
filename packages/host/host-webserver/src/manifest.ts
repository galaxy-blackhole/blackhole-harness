/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguon DUY NHAT cua danh muc lat nguyen van + ten package cua goi host-webserver (goi giu HTTP server cua app)
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-host-webserver";

/** Tên gói GỐC mà gói này THAY THẾ. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-host-webserver";

/** Đường dẫn bundle host GỐC (tính từ gốc repo). */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-host-webserver/lib/index.js";

/** Tên thư mục chứa lát (tính từ gốc gói). */
export const HOST_PARTS_DIR_NAME = "parts";

/** Tên file artefact build ra. */
export const OUT_FILE_NAME = "index.js";

/** Danh mục lát theo ĐÚNG thứ tự ghép. */
export const PART_FILES: readonly string[] = ["part-00-head.ts", "part-01-injections.ts", "part-02-index.ts", "part-03-tail.ts"];

/** Id gói GỐC (chỉ dùng trong tài liệu + metadata row; artefact byte-identical nên KHÔNG chuẩn hoá gì). */
export const STOCK_ID = "@deepseek-ai/dsh-host-webserver";

/** Dấu mở mảnh (ghép sẽ gỡ dấu). */
export const FRAGMENT_BEGIN_MARKER = "// __DSH_FRAGMENT_BEGIN__";

/** Dấu đóng mảnh. */
export const FRAGMENT_END_MARKER = "// __DSH_FRAGMENT_END__";

/** Dòng scaffold đầu mỗi lát (bị gỡ khi ghép). */
export const SLICE_MARKER = "// @ts-nocheck";

/** Đuôi module giả của mỗi lát (bị gỡ khi ghép). */
export const MODULE_TAIL = "export {};";
