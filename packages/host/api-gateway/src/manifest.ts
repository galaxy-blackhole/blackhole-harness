/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nguon DUY NHAT cua danh muc lat nguyen van + ten package cua goi THU VIEN api-gateway
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-api-gateway";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-api-gateway";

/** Đường dẫn bundle gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte). */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-api-gateway/lib/index.js";

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
  "part-01-access.ts",
  "part-02-stream-protocol.ts",
  "part-03-stream-server.ts",
  "part-04-index-1.ts",
  "part-05-index-2.ts",
  "part-06-tail.ts",
];

/** Tên file artefact build ra. */
export const OUT_FILE_NAME = "index.js";
