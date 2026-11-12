/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Manifest gói client-ui-directory-picker-browse: id ta/gốc, số chỗ đổi id (3), tên artefact, danh mục lát
 */

/** Id module CỦA TA (dòng `__ModuleLoader__.load` trong vỏ client dùng id này). */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-directory-picker-browse";

/** Id gói GỐC — chỉ dùng khi chuẩn hoá ngược (cổng ownership) và khi quy đổi DỮ LIỆU DOM ở build time. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-directory-picker-browse";

/** 19/10/2026 (Lead chốt (b)): 3 chỗ mang id CỦA TA trong bundle client — 1 dòng loader + 2 DỮ LIỆU DOM
 * (tagId CSS module + dataset.plugin). Mục tiêu cuối là 0 tham chiếu DSH trong DOM nên phải là id của ta. */
export const CLIENT_ID_REPLACEMENTS = 3;

/** Tên thư mục chứa lát của nửa host, tính từ gốc gói. */
export const HOST_PARTS_DIR_NAME = "parts-host";

/** Tên file artefact host build ra. */
export const OUT_FILE_NAME = "index.js";

/** Danh mục lát của nửa host theo ĐÚNG thứ tự ghép. */
export const PART_FILES: readonly string[] = ["part-00-index.ts", "part-01-tail.ts"];

/** Id gói GỐC dùng khi chuẩn hoá ngược (cổng ownership). */
export const STOCK_ID = "@deepseek-ai/dsh-client-ui-directory-picker-browse";

/** Dấu mở mảnh (dòng cấp 0 bị tách) — ghép sẽ gỡ dấu. */
export const FRAGMENT_BEGIN_MARKER = "// __DSH_FRAGMENT_BEGIN__";

/** Dấu đóng mảnh. */
export const FRAGMENT_END_MARKER = "// __DSH_FRAGMENT_END__";

/** Dòng scaffold đầu mỗi lát (bị gỡ khi ghép). */
export const SLICE_MARKER = "// @ts-nocheck";

/** Đuôi module giả của mỗi lát (bị gỡ khi ghép). */
export const MODULE_TAIL = "export {};";
/** Đường dẫn bundle host của gói GỐC (dùng cho cổng byte + kiểm tồn tại). */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-client-ui-directory-picker-browse/lib/index.js";

/** Đường dẫn bundle client của gói GỐC (49.675 B — dùng cho cổng đảo ngược id). */
export const STOCK_CLIENT_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-client-ui-directory-picker-browse/lib/client.js";

/** Tên file artefact client build ra. */
export const OUT_CLIENT_FILE_NAME = "client.js";

/** Danh mục lát của nửa client theo ĐÚNG thứ tự ghép (khớp `client-wrapper.browser.json`). */
export const CLIENT_PARTS: readonly string[] = [
  "part-00.ts",
  "part-01.ts",
  "part-02.ts",
  "part-03.ts",
  "part-04.ts",
  "part-05.ts",
];