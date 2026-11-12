/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ghép các lát NGUYÊN VĂN thành một module ESM — bỏ đúng phần giao kèo và vỏ hàm của mảnh
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { FRAGMENT_BEGIN_MARKER, FRAGMENT_END_MARKER, MODULE_TAIL, PART_FILES, SLICE_MARKER } from "./manifest.ts";

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/** Dấu đóng khối header 5 dòng. */
const HEADER_END = "*/";

/** Dòng vỏ hàm đóng (do tools/split-stock-bundle.ts chèn quanh mảnh). */
const WRAPPER_CLOSE = "}";

/**
 * Bỏ phần GIAO KÈO của một lát: header 5 dòng · dòng đánh dấu · dòng trống sau nó · dòng trống trước
 * dòng kết thúc · dòng kết thúc · và VỎ HÀM nếu lát là mảnh (gỡ theo hai dấu __DSH_FRAGMENT_*).
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
  const body = lines.slice(marker + 2, tail - 1);
  // Gỡ vỏ hàm: dấu MỞ + dòng vỏ ngay sau, và dòng vỏ ngay trước + dấu ĐÓNG.
  const begin = body.indexOf(FRAGMENT_BEGIN_MARKER);
  const end = body.indexOf(FRAGMENT_END_MARKER);
  if (begin >= 0 && end >= 0) {
    const before = body.slice(0, begin);
    const after = body.slice(end + 1);
    const wrapperClose = body[end - 1];
    if (wrapperClose !== WRAPPER_CLOSE) throw new Error(fileName + ": dong vong truoc dau FRAGMENT_END khong phai dong vo ham");
    return [...before, ...body.slice(begin + 2, end - 1), ...after];
  }
  if (begin >= 0 || end >= 0) throw new Error(fileName + ": chi co MOT trong hai dau vo ham");
  return body;
}

/**
 * Ghép các lát thành module ESM hoàn chỉnh (đúng thứ tự PART_FILES).
 * Nhận: partsDir — thư mục chứa các lát (mặc định: src/parts của gói).
 * Trả: văn bản module đã ghép.
 */
export function assembleBundle(partsDir?: string): string {
  const dir = partsDir ?? join(import.meta.dir, "parts");
  const lines: string[] = [];
  for (const fileName of PART_FILES) {
    lines.push(...stripSliceScaffold(readFileSync(join(dir, fileName), "utf8"), fileName));
  }
  return lines.join(EOL);
}