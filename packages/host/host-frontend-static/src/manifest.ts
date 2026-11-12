/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguon DUY NHAT cua danh muc lat nguyen van + ten package cua goi dsh-host-frontend-static
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-host-frontend-static";

/** Tên gói GỐC mà gói này port 1:1. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-host-frontend-static";

/** Đường dẫn bundle host GỐC (tính từ gốc repo). */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-host-frontend-static/lib/index.js";

/** Tên thư mục chứa lát của nửa host, tính từ gốc gói. */
export const HOST_PARTS_DIR_NAME = "parts";

/** Tên file artefact host build ra. */
export const OUT_FILE_NAME = "index.js";

/** Danh mục lát của nửa host theo ĐÚNG thứ tự ghép. */
export const PART_FILES: readonly string[] = ["part-00-head.ts", "part-01-index.ts", "part-02-tail.ts"];

/** Id gói GỐC dùng khi chuẩn hoá ngược (cổng ownership). */
export const STOCK_ID = "@deepseek-ai/dsh-host-frontend-static";

/** Dấu mở mảnh (dòng cấp 0 bị tách) — ghép sẽ gỡ dấu. */
export const FRAGMENT_BEGIN_MARKER = "// __DSH_FRAGMENT_BEGIN__";

/** Dấu đóng mảnh. */
export const FRAGMENT_END_MARKER = "// __DSH_FRAGMENT_END__";

/** Dòng scaffold đầu mỗi lát (bị gỡ khi ghép). */
export const SLICE_MARKER = "// @ts-nocheck";

/** Đuôi module giả của mỗi lát (bị gỡ khi ghép). */
export const MODULE_TAIL = "export {};";
