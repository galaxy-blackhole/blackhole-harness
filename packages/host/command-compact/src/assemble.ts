/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ghép lát NGUYÊN VĂN thành một module ESM — bỏ đúng phần giao kèo của lát và GIỮ newline cuối như bản gốc
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MODULE_TAIL, PART_FILES, SLICE_MARKER } from "./manifest.ts";

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/** Dấu đóng khối header 5 dòng. */
const HEADER_END = "*/";

/**
 * Bỏ phần GIAO KÈO của một lát: khối header 5 dòng · dòng đánh dấu · dòng trống sau nó · dòng trống
 * trước dòng kết thúc · dòng kết thúc. Phần còn lại là NGUYÊN VĂN bundle gốc, gồm cả dòng trống cuối
 * cùng khi bản gốc kết thúc bằng newline (nhờ vậy `assembled === stock` đúng từng byte).
 * Nhận: source — nội dung file lát; fileName — tên file (dùng cho thông báo lỗi).
 * Trả: các dòng nguyên văn của lát, ĐÚNG thứ tự xuất hiện trong bundle gốc.
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
 * Ghép các lát thành module ESM hoàn chỉnh (đúng thứ tự PART_FILES). Nối bằng newline nên newline cuối
 * của bundle gốc được giữ nguyên; gói này chỉ có MỘT lát nên kết quả là chính bundle gốc.
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
