/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ghép các lát NGUYÊN VĂN thành một module ESM — bỏ đúng header 5 dòng, dòng đánh dấu và dòng biên
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MODULE_TAIL, PART_FILES, SLICE_MARKER } from "./manifest.ts";

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/** Dấu đóng khối header 5 dòng. */
const HEADER_END = "*/";

/**
 * Bỏ phần GIAO KÈO của một lát: header 5 dòng · dòng đánh dấu · dòng trống sau nó · dòng trống trước
 * dòng kết thúc · dòng kết thúc. Phần còn lại là NGUYÊN VĂN bundle gốc (kể cả dòng trống cuối cùng
 * khi bản gốc kết thúc bằng newline).
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
  if ((lines[marker + 1] ?? "x").trim() !== "") throw new Error(fileName + ": thieu dong trong sau dong danh dau");
  if ((lines[tail - 1] ?? "x").trim() !== "") throw new Error(fileName + ": thieu dong trong truoc dong ket thuc");
  if (tail <= marker + 2) throw new Error(fileName + ": than lat rong");
  return lines.slice(marker + 2, tail - 1);
}

/**
 * Ghép các lát thành module ESM hoàn chỉnh (đúng thứ tự PART_FILES), nối bằng LF — không thêm/bớt dòng.
 * Bundle gốc kết thúc bằng một LF, nên bản ghép cũng kết thúc bằng đúng một LF (giữ newline cuối như stock).
 * Nhận: partsDir — thư mục chứa các lát (mặc định: src/parts của gói).
 * Trả: văn bản module đã ghép.
 */
export function assembleBundle(partsDir?: string): string {
  const dir = partsDir ?? join(import.meta.dir, "parts");
  const lines: string[] = [];
  for (const fileName of PART_FILES) {
    lines.push(...stripSliceScaffold(readFileSync(join(dir, fileName), "utf8"), fileName));
  }
  const assembled = lines.join(EOL);
  return assembled.endsWith(EOL) ? assembled : assembled + EOL;
}
