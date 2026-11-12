/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ghép 5 lát NGUYÊN VĂN của stock lib/index.js thành module ESM và bóc phần giao kèo (header · dấu · dòng biên · dòng kết thúc) của từng lát
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

/** Danh mục lát thân nửa host, đúng thứ tự ghép (part-00 → part-04). */
const HOST_PART_FILES: readonly string[] = [
  "part-00.ts",
  "part-01.ts",
  "part-02.ts",
  "part-03.ts",
  "part-04.ts",
];

/** Thư mục chứa các lát thân nửa host, cùng cấp tệp này. */
const HOST_PARTS_DIR = "parts-host";

/**
 * Bóc phần GIAO KÈO của một lát thân host: header 5 dòng · dòng đánh dấu `// @ts-nocheck` · dòng biên
 * (dòng trống ngay sau dấu) · dòng trống trước dòng kết thúc · dòng `export {};`.
 * Nhận: source — toàn văn tệp lát; name — tên tệp (dùng cho thông báo lỗi).
 * Trả: các dòng nguyên văn của lát, đúng thứ tự, không thêm không bớt dòng nào.
 */
export function stripHostSlice(source: string, name: string): string[] {
  const lines = source.split(EOL);
  const marker = lines.findIndex((line) => line.startsWith(SLICE_MARKER));
  if (marker < 0) throw new Error(name + ": thiếu dòng đánh dấu lát nguyên văn");
  if ((lines[0] ?? "").trim() !== HEADER_OPEN || (lines[6] ?? "").trim() !== HEADER_END) {
    throw new Error(name + ": header phải đúng 5 dòng (mở `/**` ở dòng 1, đóng `*/` ở dòng 7)");
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
 * Ghép 5 lát thân nửa host (src/parts-host/part-00.ts … part-04.ts) thành đúng văn bản stock
 * lib/index.js của @deepseek-ai/dsh-experimental-inspector, ngăn các lát bằng EOL.
 * Nhận: không. Trả: văn bản bundle host đã ghép (không kèm dòng cuối thừa).
 */
export function assembleHostParts(): string {
  const dir = join(import.meta.dir, HOST_PARTS_DIR);
  const lines: string[] = [];
  for (const fileName of HOST_PART_FILES) {
    lines.push(...stripHostSlice(readFileSync(join(dir, fileName), "utf8"), fileName));
  }
  return lines.join(EOL);
}
