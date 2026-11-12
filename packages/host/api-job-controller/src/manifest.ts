/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguon DUY NHAT cua danh muc lat nguyen van + ten package cua goi api-job-controller
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-api-job-controller";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-api-job-controller";

/** Đường dẫn bundle host GỐC (tính từ gốc repo). */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-api-job-controller/lib/index.js";

/** Đường dẫn bundle client GỐC (nửa client, script classic). */
export const STOCK_CLIENT_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-api-job-controller/lib/client.js";

/** Đường dẫn bundle typert HOST gốc. */
export const STOCK_TYPERT_HOST_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-api-job-controller/lib/typert.host.js";

/** Đường dẫn bundle typert REMOTE-CLIENT gốc. */
export const STOCK_TYPERT_REMOTE_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-api-job-controller/lib/typert.remote-client.js";

/** Tên thư mục chứa lát của nửa host, tính từ gốc gói. */
export const HOST_PARTS_DIR_NAME = "parts-host";

/** Tên thư mục chứa lát của typert host. */
export const TYPERT_HOST_PARTS_DIR_NAME = "parts-typert-host";

/** Tên thư mục chứa lát của typert remote-client. */
export const TYPERT_REMOTE_PARTS_DIR_NAME = "parts-typert-remote";

/** Tên file artefact host build ra. */
export const OUT_FILE_NAME = "index.js";

/** Tên file artefact client build ra. */
export const OUT_CLIENT_FILE_NAME = "client.js";

/** Tên file artefact typert host build ra. */
export const OUT_TYPERT_HOST_FILE_NAME = "typert.host.js";

/** Tên file artefact typert remote-client build ra. */
export const OUT_TYPERT_REMOTE_FILE_NAME = "typert.remote-client.js";

/** Danh mục lát của nửa host theo ĐÚNG thứ tự ghép. */
export const PART_FILES: readonly string[] = ["part-00-head.ts", "part-01-wake.ts", "part-02-observe.ts", "part-03-rows.ts", "part-04-index.ts", "part-05-tail.ts"];

/** Danh mục lát của typert host theo ĐÚNG thứ tự ghép. */
export const TYPERT_HOST_PART_FILES: readonly string[] = ["part-00-typert-host.ts"];

/** Danh mục lát của typert remote-client theo ĐÚNG thứ tự ghép. */
export const TYPERT_REMOTE_PART_FILES: readonly string[] = ["part-00-typert-remote-client.ts"];

/** Id gói GỐC dùng khi chuẩn hoá ngược (cổng ownership). */
export const STOCK_ID = "@deepseek-ai/dsh-api-job-controller";

/** Dấu mở mảnh (dòng cấp 0 bị tách) — ghép sẽ gỡ dấu. */
export const FRAGMENT_BEGIN_MARKER = "// __DSH_FRAGMENT_BEGIN__";

/** Dấu đóng mảnh. */
export const FRAGMENT_END_MARKER = "// __DSH_FRAGMENT_END__";

/** Dòng scaffold đầu mỗi lát (bị gỡ khi ghép). */
export const SLICE_MARKER = "// @ts-nocheck";

/** Đuôi module giả của mỗi lát (bị gỡ khi ghép). */
export const MODULE_TAIL = "export {};";

/**
 * Số lần id của TA xuất hiện trong artefact client: ĐÚNG 1 (dòng loader). Sáu lần id stock còn lại trong thân bundle là
 * DỮ LIỆU (package:, typeSymbol:, 4 dòng JSDoc @module) — phải GIỮ NGUYÊN VĂN, không phải chỗ đổi tên.
 */
export const CLIENT_ID_REPLACEMENTS = 1;

/** Số lần id của ta trong typert.host.js = số lần id stock trong bản gốc (11) — artefact typert đổi TOÀN BỘ. */
export const TYPERT_HOST_ID_REPLACEMENTS = 11;

/** Số lần id của ta trong typert.remote-client.js = 10 (khớp bản gốc). */
export const TYPERT_REMOTE_ID_REPLACEMENTS = 10;