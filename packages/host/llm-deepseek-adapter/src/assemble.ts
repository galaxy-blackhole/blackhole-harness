/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ghép các lát NGUYÊN VĂN thành một module ESM — chỉ bỏ phần giao kèo, giữ đúng từng dòng
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MODULE_TAIL, PART_FILES, SLICE_MARKER } from "./manifest.ts";

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/** Dấu đóng khối header 5 dòng. */
const HEADER_END = "*/";

/**
 * Bỏ phần GIAO KÈO của một lát: khối header 5 dòng, dòng đánh dấu, MỘT dòng trống ngay sau nó, MỘT dòng
 * trống + dòng export rỗng ở cuối. Mọi dòng còn lại là NGUYÊN VĂN bundle gốc.
 * Nhận: source — nội dung file lát; fileName — tên file (dùng cho thông báo lỗi).
 * Trả: các dòng nguyên văn của lát.
 */
export function stripSliceScaffold(source: string, fileName: string): string[] {
  const lines = source.split(EOL);
  const marker = lines.findIndex((line) => line.startsWith(SLICE_MARKER));
  if (marker < 0) throw new Error(fileName + ": khong thay dong danh dau lat nguyen van");
  if (!lines.slice(0, marker).some((line) => line.trim() === HEADER_END)) {
    throw new Error(fileName + ": thieu khoi header 5 dong bat buoc");
  }
  const tail = lines.lastIndexOf(MODULE_TAIL);
  if (tail < 0) throw new Error(fileName + ": thieu dong ket thuc module");
  // Bỏ: [0..marker] (header + dòng đánh dấu), dòng trống ngay sau marker, dòng trống ngay trước tail, dòng tail.
  const body = lines.slice(marker + 2, tail - 1);
  if ((lines[marker + 1] ?? "x").trim() !== "") throw new Error(fileName + ": thieu dong trong sau dong danh dau");
  if ((lines[tail - 1] ?? "x").trim() !== "") throw new Error(fileName + ": thieu dong trong truoc dong ket thuc");
  return body;
}

/**
 * Ghép các lát thành module ESM hoàn chỉnh (đúng thứ tự PART_FILES).
 * Nhận: partsDir — thư mục chứa các lát (mặc định: src/parts của gói).
 * Trả: văn bản module đã ghép (kết thúc bằng đúng một ký tự xuống dòng như bundle gốc).
 */
export function assembleBundle(partsDir?: string): string {
  const dir = partsDir ?? join(import.meta.dir, "parts");
  const lines: string[] = [];
  for (const fileName of PART_FILES) {
    lines.push(...stripSliceScaffold(readFileSync(join(dir, fileName), "utf8"), fileName));
  }
  return lines.join(EOL);
}
