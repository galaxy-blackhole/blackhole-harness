/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguon DUY NHAT cua danh muc lat nguyen van + ten package cua goi api-session-controller (nua host)
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-api-session-controller";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-api-session-controller";

/** Đường dẫn bundle gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte). */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-api-session-controller/lib/index.js";

/** Tên thư mục chứa các lát của NỬA HOST, tính từ gốc gói (src/parts-host). */
export const HOST_PARTS_DIR_NAME = "parts-host";

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
  "part-01-agent.ts",
  "part-02-catalog.ts",
  "part-03-commands.ts",
  "part-04-control.ts",
  "part-05-assistant-stream.ts",
  "part-06-history.ts",
  "part-07-file-references.ts",
  "part-08-list.ts",
  "part-09-model-selection-projection.ts",
  "part-10-skill-catalog.ts",
  "part-11-media-references.ts",
  "part-12-archived-session-gate.ts",
  "part-13-index.ts",
  "part-14-tail.ts",
];

/** Tên file artefact build ra. */
export const OUT_FILE_NAME = "index.js";

/** Đường dẫn bundle client GỐC (nửa client, script classic). */
export const STOCK_CLIENT_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-api-session-controller/lib/client.js";

/** Tên file artefact client build ra. */
export const OUT_CLIENT_FILE_NAME = "client.js";

/** Đường dẫn bundle typert HOST gốc (artefact thứ ba). */
export const STOCK_TYPERT_HOST_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-api-session-controller/lib/typert.host.js";

/** Tên file artefact typert host build ra. */
export const OUT_TYPERT_HOST_FILE_NAME = "typert.host.js";

/** Đường dẫn bundle typert REMOTE-CLIENT gốc (artefact thứ tư). */
export const STOCK_TYPERT_REMOTE_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-api-session-controller/lib/typert.remote-client.js";

/** Tên file artefact typert remote-client build ra. */
export const OUT_TYPERT_REMOTE_FILE_NAME = "typert.remote-client.js";

/** Tên thư mục chứa lát của typert host, tính từ gốc gói. */
export const TYPERT_HOST_PARTS_DIR_NAME = "parts-typert-host";

/** Tên thư mục chứa lát của typert remote-client, tính từ gốc gói. */
export const TYPERT_REMOTE_PARTS_DIR_NAME = "parts-typert-remote";

/** Danh mục lát của typert host theo ĐÚNG thứ tự ghép. */
export const TYPERT_HOST_PART_FILES: readonly string[] = [
  "part-00.ts",
  "part-01.ts",
  "part-02.ts",
  "part-03.ts",
  "part-04.ts",
  "part-05.ts",
  "part-06.ts",
];

/** Danh mục lát của typert remote-client theo ĐÚNG thứ tự ghép. */
export const TYPERT_REMOTE_PART_FILES: readonly string[] = ["part-00-head.ts", "part-01-schemas.ts", "part-02-remote.ts"];

/** Id gói GỐC dùng khi chuẩn hoá ngược (cổng ownership cho artefact client/typert). */
export const STOCK_ID = "@deepseek-ai/dsh-api-session-controller";
