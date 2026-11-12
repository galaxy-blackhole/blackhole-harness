/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguon DUY NHAT cua danh muc lat nguyen van + ten package cua goi typert-registry (gói BA artefact, client KÉP)
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-typert-registry";

/** Tên gói GỐC mà gói này THAY THẾ. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-typert-registry";

/** Đường dẫn bundle host GỐC. */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-typert-registry/lib/index.js";

/** Đường dẫn bundle client BROWSER gốc (script classic, có loader). */
export const STOCK_CLIENT_BROWSER_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-typert-registry/lib/client.browser.js";

/** Đường dẫn bundle client NODE gốc (ESM thuần, KHÔNG có loader). */
export const STOCK_CLIENT_NODE_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-typert-registry/lib/client.node.js";

/** Tên thư mục chứa lát của nửa host. */
export const HOST_PARTS_DIR_NAME = "parts-host";

/** Tên thư mục chứa lát của client NODE (ESM thuần, ghép bằng assembleBundle). */
export const CLIENT_NODE_PARTS_DIR_NAME = "parts-client-node";

/** Tên file artefact host. */
export const OUT_FILE_NAME = "index.js";

/** Tên file artefact client browser. */
export const OUT_CLIENT_BROWSER_FILE_NAME = "client.browser.js";

/** Tên file artefact client node. */
export const OUT_CLIENT_NODE_FILE_NAME = "client.node.js";

/** Danh mục lát của nửa host theo ĐÚNG thứ tự ghép. */
export const PART_FILES: readonly string[] = ["part-00-head.ts", "part-01-service.ts", "part-02-tail.ts"];

/** Danh mục lát của client node theo ĐÚNG thứ tự ghép. */
export const CLIENT_NODE_PART_FILES: readonly string[] = [
  "part-00-head.ts",
  "part-01-service.ts",
  "part-02-client-index.ts",
  "part-03-tail.ts",
];

/** Số lần id của ta trong client BROWSER: ĐÚNG 1 (dòng loader). Id stock còn lại ở dòng 14 là JSDoc `@module` — giữ nguyên. */
export const CLIENT_BROWSER_ID_REPLACEMENTS = 1;

/** Số lần id của ta trong host = 0 (id stock chỉ nằm trong JSDoc ⇒ artefact byte-identical). */
export const HOST_ID_REPLACEMENTS = 0;

/** Số lần id của ta trong client node = 0 (ESM thuần, id stock chỉ trong JSDoc ⇒ byte-identical). */
export const CLIENT_NODE_ID_REPLACEMENTS = 0;

/** Id gói GỐC dùng khi chuẩn hoá ngược (cổng ownership). */
export const STOCK_ID = "@deepseek-ai/dsh-typert-registry";

/** Dấu mở mảnh (dòng cấp 0 bị tách) — ghép sẽ gỡ dấu. */
export const FRAGMENT_BEGIN_MARKER = "// __DSH_FRAGMENT_BEGIN__";

/** Dấu đóng mảnh. */
export const FRAGMENT_END_MARKER = "// __DSH_FRAGMENT_END__";

/** Dòng scaffold đầu mỗi lát (bị gỡ khi ghép). */
export const SLICE_MARKER = "// @ts-nocheck";

/** Đuôi module giả của mỗi lát (bị gỡ khi ghép). */
export const MODULE_TAIL = "export {};";
