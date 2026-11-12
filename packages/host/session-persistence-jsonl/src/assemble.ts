/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ghép các lát NGUYÊN VĂN thành một module ESM — bỏ đúng phần giao kèo của lát
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MODULE_TAIL, PART_FILES, SLICE_MARKER } from "./manifest.ts";

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/** Dấu đóng khối header 5 dòng. */
const HEADER_END = "*/";

/**
 * Bỏ phần GIAO KÈO của một lát: header 5 dòng · dòng đánh dấu · và các dòng trống biên.
 * Nhận: source — nội dung file lát; fileName — tên file (cho thông báo lỗi).
 * Trả: các dòng nguyên văn của lát.
 */
export function stripSliceScaffold(source: string, fileName: string): string[] {
  const lines = source.split(EOL);
  const marker = lines.findIndex((line) => line.startsWith(SLICE_MARKER));
  if (marker < 0) throw new Error(fileName + ": thiếu dòng đánh dấu lát nguyên văn");
  if (!lines.slice(0, marker).some((line) => line.trim() === HEADER_END)) throw new Error(fileName + ": thiếu khối header 5 dòng bắt buộc");
  const tail = lines.lastIndexOf(MODULE_TAIL);
  if (tail < 0) throw new Error(fileName + ": thiếu dòng kết thúc module");
  const body = lines.slice(marker + 1, tail);
  let start = 0;
  while (start < body.length && (body[start] ?? "").trim() === "") start += 1;
  let end = body.length;
  while (end > start && (body[end - 1] ?? "").trim() === "") end -= 1;
  return body.slice(start, end);
}

/**
 * Ghép các lát thành module ESM hoàn chỉnh (đúng thứ tự PART_FILES).
 * Nhận: partsDir — thư mục chứa lát (mặc định: src/parts của gói). Trả: văn bản module đã ghép.
 */
export function assembleBundle(partsDir?: string): string {
  const dir = partsDir ?? join(import.meta.dir, "parts");
  const lines: string[] = [];
  for (const fileName of PART_FILES) lines.push(...stripSliceScaffold(readFileSync(join(dir, fileName), "utf8"), fileName));
  return lines.join(EOL) + EOL;
}
