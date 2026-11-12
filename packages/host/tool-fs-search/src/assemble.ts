/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ghép các lát NGUYÊN VĂN thành một module ESM — bỏ đúng phần giao kèo của lát (header/marker/dòng biên)
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
 * dòng kết thúc · dòng kết thúc. Thân lát (kể cả dòng trống cuối của lát CUỐI, giữ nguyên văn byte gốc)
 * được trả lại nguyên trạng.
 * Nhận: source — nội dung file lát; fileName — tên file (dùng cho thông báo lỗi).
 * Trả: các dòng nguyên văn của lát.
 * @throws {Error} khi lát thiếu header, thiếu dòng đánh dấu, hoặc sai dòng biên.
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
  return lines.slice(marker + 2, tail - 1);
}

/**
 * Ghép các lát thành module ESM hoàn chỉnh (đúng thứ tự PART_FILES), nối bằng EOL.
 * Nhận: partsDir — thư mục chứa các lát (mặc định: src/parts của gói).
 * Trả: văn bản module đã ghép.
 * @throws {Error} khi một lát sai giao kèo (xem {@link stripSliceScaffold}).
 */
export function assembleBundle(partsDir?: string): string {
  const dir = partsDir ?? join(import.meta.dir, "parts");
  const lines: string[] = [];
  for (const fileName of PART_FILES) {
    lines.push(...stripSliceScaffold(readFileSync(join(dir, fileName), "utf8"), fileName));
  }
  return lines.join(EOL);
}
