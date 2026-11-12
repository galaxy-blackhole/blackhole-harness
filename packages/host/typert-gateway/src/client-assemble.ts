/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ghép vỏ (client-wrapper.<phía>.json) + các lát thân ⇒ đúng văn bản bundle client gốc sau khi quy đổi id
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/** Dấu đóng khối header 5 dòng. */
const HEADER_END = "*/";

/** Dòng đánh dấu lát. */
const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS. */
const MODULE_TAIL = "export {};";

/** Dấu mở/đóng vỏ hàm của mảnh. */
const FRAGMENT_BEGIN_MARKER = "// __DSH_FRAGMENT_BEGIN__";
const FRAGMENT_END_MARKER = "// __DSH_FRAGMENT_END__";

/** Vỏ + danh mục lát của một phía. */
export interface ClientWrapper {
  /** Dòng vỏ đầu (id đã đổi sang id của ta). */
  head: string[];
  /** Dòng vỏ cuối (gồm cả mảnh keo đẩy về). */
  tail: string[];
  /** Danh mục lát thân theo thứ tự. */
  parts: string[];
}

/**
 * Đọc vỏ + danh mục lát của một phía.
 * Nhận: side — "browser" hoặc "node".
 * Trả: ClientWrapper.
 */
export function readWrapper(side: string): ClientWrapper {
  return JSON.parse(readFileSync(join(import.meta.dir, "client-wrapper." + side + ".json"), "utf8")) as ClientWrapper;
}

/**
 * Bỏ phần giao kèo của một lát thân (header · dấu · dòng trống · dòng kết thúc · vỏ hàm nếu có).
 * Nhận: source — nội dung file lát; fileName — tên file.
 * Trả: các dòng nguyên văn.
 */
export function stripPartScaffold(source: string, fileName: string): string[] {
  const lines = source.split(EOL);
  const marker = lines.findIndex((line) => line.startsWith(SLICE_MARKER));
  if (marker < 0) throw new Error(fileName + ": thieu dong danh dau lat");
  if (!lines.slice(0, marker).some((line) => line.trim() === HEADER_END)) throw new Error(fileName + ": thieu header 5 dong");
  const tail = lines.lastIndexOf(MODULE_TAIL);
  if (tail < 0) throw new Error(fileName + ": thieu dong ket thuc module");
  const body = lines.slice(marker + 2, tail - 1);
  const begin = body.indexOf(FRAGMENT_BEGIN_MARKER);
  const end = body.indexOf(FRAGMENT_END_MARKER);
  if (begin >= 0 && end >= 0) return [...body.slice(0, begin), ...body.slice(begin + 2, end - 1), ...body.slice(end + 1)];
  if (begin >= 0 || end >= 0) throw new Error(fileName + ": chi co MOT dau vo ham");
  return body;
}

/**
 * Ghép một nửa client từ vỏ + các lát thân.
 * Nhận: side — "browser" hoặc "node"; partsDir — thư mục lát (mặc định src/client-parts/<side>).
 * Trả: văn bản bundle client.
 */
export function assembleClient(side: string, partsDir?: string): string {
  const wrapper = readWrapper(side);
  const dir = partsDir ?? join(import.meta.dir, "client-parts", side);
  const lines: string[] = [...wrapper.head];
  for (const fileName of wrapper.parts) lines.push(...stripPartScaffold(readFileSync(join(dir, fileName), "utf8"), fileName));
  lines.push(...wrapper.tail);
  return lines.join(EOL);
}
