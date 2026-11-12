/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nguon DUY NHAT cua danh muc lat nguyen van + ten package cua goi thu vien llm-deepseek-adapter
 */

/** Id package của ta (tên MỚI để không trùng gói gbh-llm-deepseek đang là bản của dsh-llm-deepseek-api-key). */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-llm-deepseek-adapter";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu/README, không bao giờ nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-llm-deepseek";

/** Đường dẫn bundle gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte). */
export const STOCK_BUNDLE = "apps/host/node_modules/@deepseek-ai/dsh-llm-deepseek/lib/index.js";

/** Dòng đánh dấu lát nguyên văn (do tools/split-stock-bundle.ts chèn) — assemble.ts bỏ đúng dòng này. */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS (do tools/split-stock-bundle.ts chèn) — assemble.ts bỏ đúng dòng này. */
export const MODULE_TAIL = "export {};";

/** Danh mục lát theo ĐÚNG thứ tự ghép (đầu bundle · 21 vùng module · đuôi export). */
export const PART_FILES: readonly string[] = [
  "part-00-head.ts",
  "part-01-defaults.ts",
  "part-02-models.ts",
  "part-03-image-tokens.ts",
  "part-04-request-pricing.ts",
  "part-05-config.ts",
  "part-06-model-info.ts",
  "part-07-file-id.ts",
  "part-08-messages-api.ts",
  "part-09-files-api.ts",
  "part-10-upload-index.ts",
  "part-11-file-store.ts",
  "part-12-request-files.ts",
  "part-13-request-extensions.ts",
  "part-14-images.ts",
  "part-15-replay.ts",
  "part-16-serialize.ts",
  "part-17-transport.ts",
  "part-18-sse.ts",
  "part-19-translate.ts",
  "part-20-adapter.ts",
  "part-21-host.ts",
  "part-22-tail.ts",
];

/** Đường dẫn bundle gốc của ta (artefact build) — bản port phải TRÙNG TỪNG BYTE với bundle gốc. */
export const OUT_FILE_NAME = "index.js";
