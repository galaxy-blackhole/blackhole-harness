/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguon DUY NHAT cua danh muc lat nguyen van + ten package cua goi dsh-client-ui-directory-picker-native
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-directory-picker-native";

/** Tên gói GỐC mà gói này port 1:1. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-directory-picker-native";

/** Đường dẫn bundle host GỐC (tính từ gốc repo). */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-client-ui-directory-picker-native/lib/index.js";

/** Đường dẫn bundle client GỐC (nửa client, script classic). */
export const STOCK_CLIENT_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-client-ui-directory-picker-native/lib/client.js";

/** Tên file artefact client build ra. */
export const OUT_CLIENT_FILE_NAME = "client.js";

/**
 * Số lần id của ta trong artefact client = số chỗ đã đổi tên. Bundle này chỉ đổi DÒNG LOADER;
 * các lần id stock khác trong thân là DỮ LIỆU (CSS module tagId, dataset.plugin) phải giữ nguyên văn.
 */
export const CLIENT_ID_REPLACEMENTS = 1;

/** Tên thư mục chứa lát của nửa host, tính từ gốc gói. */
export const HOST_PARTS_DIR_NAME = "parts-host";

/** Tên file artefact host build ra. */
export const OUT_FILE_NAME = "index.js";

/** Danh mục lát của nửa host theo ĐÚNG thứ tự ghép. */
export const PART_FILES: readonly string[] = ["part-00-index.ts", "part-01-tail.ts"];

/** Id gói GỐC dùng khi chuẩn hoá ngược (cổng ownership). */
export const STOCK_ID = "@deepseek-ai/dsh-client-ui-directory-picker-native";

/** Dấu mở mảnh (dòng cấp 0 bị tách) — ghép sẽ gỡ dấu. */
export const FRAGMENT_BEGIN_MARKER = "// __DSH_FRAGMENT_BEGIN__";

/** Dấu đóng mảnh. */
export const FRAGMENT_END_MARKER = "// __DSH_FRAGMENT_END__";

/** Dòng scaffold đầu mỗi lát (bị gỡ khi ghép). */
export const SLICE_MARKER = "// @ts-nocheck";

/** Đuôi module giả của mỗi lát (bị gỡ khi ghép). */
export const MODULE_TAIL = "export {};";
