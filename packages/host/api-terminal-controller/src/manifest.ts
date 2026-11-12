/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguon DUY NHAT cua danh muc lat nguyen van + ten package cua goi api-terminal-controller
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-api-terminal-controller";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-api-terminal-controller";

/** Đường dẫn bundle gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte). */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-api-terminal-controller/lib/index.js";

/** Dòng đánh dấu lát nguyên văn. */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS. */
export const MODULE_TAIL = "export {};";

/** Dấu MỞ vỏ hàm của một mảnh — assemble.ts gỡ dấu này + dòng vỏ ngay sau. */
export const FRAGMENT_BEGIN_MARKER = "// __DSH_FRAGMENT_BEGIN__";

/** Dấu ĐÓNG vỏ hàm của một mảnh — assemble.ts gỡ dấu này + dòng vỏ ngay trước. */
export const FRAGMENT_END_MARKER = "// __DSH_FRAGMENT_END__";

/** Danh mục lát theo ĐÚNG thứ tự ghép. */
export const PART_FILES: readonly string[] = [
  "part-00-head.ts",
  "part-01-shells.ts",
  "part-02-stream.ts",
  "part-03-retention.ts",
  "part-04-terminal.ts",
  "part-05-index.ts",
  "part-06-tail.ts",
];

/** Tên file artefact build ra. */
export const OUT_FILE_NAME = "index.js";

/** Đường dẫn bundle client GỐC (nửa client, script classic). */
export const STOCK_CLIENT_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-api-terminal-controller/lib/client.js";

/** Tên file artefact client build ra. */
export const OUT_CLIENT_FILE_NAME = "client.js";

/** Đường dẫn bundle typert HOST gốc. */
export const STOCK_TYPERT_HOST_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-api-terminal-controller/lib/typert.host.js";

/** Tên file artefact typert host build ra. */
export const OUT_TYPERT_HOST_FILE_NAME = "typert.host.js";

/** Đường dẫn bundle typert REMOTE-CLIENT gốc. */
export const STOCK_TYPERT_REMOTE_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-api-terminal-controller/lib/typert.remote-client.js";

/** Tên file artefact typert remote-client build ra. */
export const OUT_TYPERT_REMOTE_FILE_NAME = "typert.remote-client.js";

/** Tên thư mục chứa lát của typert host. */
export const TYPERT_HOST_PARTS_DIR_NAME = "parts-typert-host";

/** Tên thư mục chứa lát của typert remote-client. */
export const TYPERT_REMOTE_PARTS_DIR_NAME = "parts-typert-remote";

/** Danh mục lát của typert host theo ĐÚNG thứ tự ghép. */
export const TYPERT_HOST_PART_FILES: readonly string[] = ["part-00-head.ts", "part-01-schemas.ts", "part-02-remote.ts", "part-03-typert.ts"];

/** Danh mục lát của typert remote-client theo ĐÚNG thứ tự ghép. */
export const TYPERT_REMOTE_PART_FILES: readonly string[] = ["part-00-head.ts", "part-01-schemas.ts", "part-02-remote.ts"];

/** Id gói GỐC dùng khi chuẩn hoá ngược (cổng ownership). */
export const STOCK_ID = "@deepseek-ai/dsh-api-terminal-controller";
