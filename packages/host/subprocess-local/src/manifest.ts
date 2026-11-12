/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nguồn DUY NHẤT của danh mục lát nguyên văn + 4 tệp đích + 4 đường dẫn STOCK của gói subprocess-local
 */

/** Id package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-subprocess-local";

/** Tên gói GỐC mà gói này THAY THẾ — chỉ dùng trong tài liệu, không nạp lúc chạy. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-subprocess-local";

/** Thư mục lib của bản gốc trong kernel (CHỈ ĐỌC — nguồn đối chiếu byte-for-byte). */
export const STOCK_LIB_DIR = "apps/host/node_modules/@deepseek-ai/dsh-subprocess-local/lib";

/** Bundle gốc của artefact index (CHỈ ĐỌC). */
export const STOCK_BUNDLE = STOCK_LIB_DIR + "/index.js";

/** Bundle gốc của artefact output (CHỈ ĐỌC). */
export const STOCK_OUTPUT_BUNDLE = STOCK_LIB_DIR + "/output.js";

/** Chunk gốc của artefact runner-launch (CHỈ ĐỌC) — TÊN CÓ HASH, xem RUNNER_FILE_NAME. */
export const STOCK_RUNNER_BUNDLE = STOCK_LIB_DIR + "/runner-launch-B2zsQ1Dz.js";

/**
 * Bundle gốc của artefact runner (CHỈ ĐỌC) — entry provider-private, nạp chunk runner-launch.
 * Giá trị đầy đủ: apps/host/node_modules/@deepseek-ai/dsh-subprocess-local/lib/runner.js
 */
export const STOCK_FILE_BIN = STOCK_LIB_DIR + "/runner.js";

/** Dòng đánh dấu lát nguyên văn. */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS. */
export const MODULE_TAIL = "export {};";

/** Dấu MỞ vỏ hàm của một mảnh — assemble.ts gỡ dấu này + dòng vỏ ngay sau. */
export const FRAGMENT_BEGIN_MARKER = "// __DSH_FRAGMENT_BEGIN__";

/** Dấu ĐÓNG vỏ hàm của một mảnh — assemble.ts gỡ dấu này + dòng vỏ ngay trước. */
export const FRAGMENT_END_MARKER = "// __DSH_FRAGMENT_END__";

/** Tên tệp đích của artefact index. */
export const OUT_FILE_NAME = "index.js";

/** Tên tệp đích của artefact output. */
export const OUTPUT_FILE_NAME = "output.js";

/** Tên tệp đích của chunk runner-launch — GIỮ ĐÚNG tên có hash vì index.js import './runner-launch-B2zsQ1Dz.js'. */
export const RUNNER_FILE_NAME = "runner-launch-B2zsQ1Dz.js";

/** Tên tệp đích của artefact runner — entry bin của provider-private runner core. */
export const OUT_FILE_BIN = "runner.js";

/** Thư mục lát của artefact index (index.js). */
export const PARTS_DIR_NAME = "parts";

/** Thư mục lát của artefact output (output.js). */
export const OUTPUT_PARTS_DIR_NAME = "parts-output";

/** Thư mục lát của chunk runner-launch. */
export const RUNNER_PARTS_DIR_NAME = "parts-runner";

/** Thư mục lát của artefact runner (runner.js). */
export const BIN_PARTS_DIR_NAME = "parts-bin";

/** Danh mục lát của artefact index theo ĐÚNG thứ tự ghép. */
export const PART_FILES: readonly string[] = [
  "part-00-head.ts",
  "part-01-linux-scope.ts",
  "part-02-linux-scope-selector.ts",
  "part-03-windows-job.ts",
  "part-04-terminal.ts",
  "part-05-shell-activity.ts",
  "part-06-index.ts",
  "part-07-tail.ts",
];

/** Danh mục lát của artefact output theo ĐÚNG thứ tự ghép. */
export const OUTPUT_PART_FILES: readonly string[] = [
  "part-00-head.ts",
  "part-01-output.ts",
  "part-02-tail.ts",
];

/** Danh mục lát của chunk runner-launch theo ĐÚNG thứ tự ghép. */
export const RUNNER_PART_FILES: readonly string[] = [
  "part-00-head.ts",
  "part-01-managed-owner.ts",
  "part-02-control-spawn.ts",
  "part-03-windows-inspector.ts",
  "part-04-process-inspector.ts",
  "part-05-spawn.ts",
  "part-06-linux-execve.ts",
  "part-07-runner-protocol.ts",
  "part-08-runner-launch.ts",
  "part-09-tail.ts",
];

/** Danh mục lát của artefact runner (runner.js) theo ĐÚNG thứ tự ghép. */
export const PART_FILES_BIN: readonly string[] = [
  "part-00-head.ts",
  "part-01-spawn-runner.ts",
  "part-02-bin.ts",
  "part-03-tail.ts",
];

/** Một artefact: bộ lát + tên tệp đích + bundle gốc để đối chiếu từng byte. */
export interface Artefact {
  /** Nhãn ngắn dùng cho log. */
  label: string;
  /** Thư mục lát trong src/ (tương đối so với src/). */
  partsDir: string;
  /** Tên tệp đích trong lib/. */
  outFile: string;
  /** Danh mục lát theo ĐÚNG thứ tự ghép. */
  partFiles: readonly string[];
  /** Đường dẫn bundle gốc (tương đối so với gốc repo). */
  stockBundle: string;
  /** Số dòng bundle gốc đo 19/10/2026 (dùng cho log/đối chiếu). */
  stockLines: number;
}

/** BỐN artefact của gói — mỗi artefact một bộ lát riêng, một tệp đích riêng, một bản gốc riêng. */
export const ARTEFACTS: readonly Artefact[] = [
  { label: "index", partsDir: PARTS_DIR_NAME, outFile: OUT_FILE_NAME, partFiles: PART_FILES, stockBundle: STOCK_BUNDLE, stockLines: 1692 },
  { label: "output", partsDir: OUTPUT_PARTS_DIR_NAME, outFile: OUTPUT_FILE_NAME, partFiles: OUTPUT_PART_FILES, stockBundle: STOCK_OUTPUT_BUNDLE, stockLines: 239 },
  { label: "runner-launch", partsDir: RUNNER_PARTS_DIR_NAME, outFile: RUNNER_FILE_NAME, partFiles: RUNNER_PART_FILES, stockBundle: STOCK_RUNNER_BUNDLE, stockLines: 1529 },
  { label: "runner-bin", partsDir: BIN_PARTS_DIR_NAME, outFile: OUT_FILE_BIN, partFiles: PART_FILES_BIN, stockBundle: STOCK_FILE_BIN, stockLines: 436 },
];
