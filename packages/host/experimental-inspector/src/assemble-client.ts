/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ghép 4 lát NGUYÊN VĂN của stock lib/client.js thành văn bản bundle client và bóc phần giao kèo (header · dấu · dòng biên · dòng kết thúc) của từng lát
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Ký tự xuống dòng dùng khi bóc và ghép lát. */
const EOL = String.fromCharCode(10);

/** Dấu mở khối header 5 dòng. */
const HEADER_OPEN = "/**";

/** Dấu đóng khối header 5 dòng. */
const HEADER_END = "*/";

/** 5 dòng nội dung header bắt buộc, đúng thứ tự AGENTS.md §1. */
const HEADER_FIELDS: readonly string[] = [
  " * author ",
  " * email ",
  " * create date ",
  " * modify date ",
  " * desc ",
];

/** Dòng đánh dấu lát nguyên văn (miễn kiểm kiểu cho thân lát). */
const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS. */
const MODULE_TAIL = "export {};";

/** Danh mục lát thân nửa client, đúng thứ tự ghép (part-00 → part-03). */
const CLIENT_PART_FILES: readonly string[] = [
  "part-00.ts",
  "part-01.ts",
  "part-02.ts",
  "part-03.ts",
];

/** Thư mục chứa các lát thân nửa client, cùng cấp tệp này. */
const CLIENT_PARTS_DIR = "parts-client";

/**
 * Bóc phần GIAO KÈO của một lát thân nửa client: header 5 dòng · dòng đánh dấu `// @ts-nocheck` · dòng biên
 * (dòng trống ngay sau dấu) · dòng trống trước dòng kết thúc · dòng `export {};`.
 * Nhận: source — toàn văn tệp lát; name — tên tệp cho thông báo lỗi (mặc định "lát client").
 * Trả: các dòng nguyên văn của lát, đúng thứ tự, không thêm không bớt dòng nào.
 */
export function stripClientSlice(source: string, name = "lát client"): string[] {
  const lines = source.split(EOL);
  const marker = lines.findIndex((line) => line.startsWith(SLICE_MARKER));
  if (marker < 0) throw new Error(name + ": thiếu dòng đánh dấu lát nguyên văn");
  if ((lines[0] ?? "").trim() !== HEADER_OPEN || (lines[6] ?? "").trim() !== HEADER_END) {
    throw new Error(name + ": header phải đúng 5 dòng (mở khối ở dòng 1, đóng khối ở dòng 7)");
  }
  for (let index = 0; index < HEADER_FIELDS.length; index += 1) {
    const field = HEADER_FIELDS[index] ?? "";
    const line = lines[index + 1] ?? "";
    if (!line.startsWith(field)) {
      throw new Error(name + ": thiếu trường header `" + field.trim() + "` ở dòng " + String(index + 2));
    }
  }
  if (marker < HEADER_FIELDS.length + 2) throw new Error(name + ": dòng đánh dấu phải nằm SAU khối header");
  if ((lines[marker + 1] ?? "x").trim() !== "") throw new Error(name + ": thiếu dòng biên (dòng trống) sau dòng đánh dấu");
  const tail = lines.lastIndexOf(MODULE_TAIL);
  if (tail < 0) throw new Error(name + ": thiếu dòng kết thúc module");
  if (tail <= marker + 1) throw new Error(name + ": dòng kết thúc module phải nằm SAU dòng đánh dấu");
  if ((lines[tail - 1] ?? "x").trim() !== "") throw new Error(name + ": thiếu dòng trống trước dòng kết thúc module");
  return lines.slice(marker + 2, tail - 1);
}

/**
 * Ghép 4 lát thân nửa client (src/parts-client/part-00.ts … part-03.ts) thành đúng văn bản stock
 * lib/client.js của @deepseek-ai/dsh-experimental-inspector, ngăn các lát bằng EOL. Id module trong văn bản
 * ghép vẫn là id stock — build.ts mới là nơi thay id (hàm này cố ý không đổi id).
 * Nhận: không. Trả: văn bản bundle client đã ghép (không kèm dòng cuối thừa).
 */
export function assembleClientParts(): string {
  const dir = join(import.meta.dir, CLIENT_PARTS_DIR);
  const lines: string[] = [];
  for (const fileName of CLIENT_PART_FILES) {
    lines.push(...stripClientSlice(readFileSync(join(dir, fileName), "utf8"), fileName));
  }
  return lines.join(EOL);
}
