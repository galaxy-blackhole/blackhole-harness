/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ghép lát cho artefact TYPERT (typert.host.js · typert.remote-client.js): artefact KHÔNG có //#region và
 *      có câu lệnh cấp 0 dài hơn 1.000 dòng nên lát buộc phải cắt GIỮA câu lệnh; dấu mảnh nằm CUỐI DÒNG
 *      (có thể sau vỏ giả `({` hoặc `}]}]}}`) nên khi ghép phải gỡ CẢ DÒNG đó, còn thân lát là NGUYÊN VĂN.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { FRAGMENT_BEGIN_MARKER, FRAGMENT_END_MARKER, MODULE_TAIL, SLICE_MARKER } from "./manifest.ts";

/** Ký tự xuống dòng — viết qua String.fromCharCode để không lẫn với ký tự trong văn bản ghép. */
const EOL = String.fromCharCode(10);

/** Dòng đóng khối header 5 dòng bắt buộc của repo. */
const HEADER_END = "*/";

/** Dấu mở mảnh, nằm CUỐI dòng: cả dòng (kể cả vỏ giả đứng trước) bị gỡ khi ghép. */
export const FRAGMENT_BEGIN_LINE = FRAGMENT_BEGIN_MARKER;

/** Dấu đóng mảnh, nằm CUỐI dòng: cả dòng (kể cả vỏ giả đứng trước) bị gỡ khi ghép. */
export const FRAGMENT_END_LINE = FRAGMENT_END_MARKER;

/**
 * Kiểm một dòng của tệp lát có phải DÒNG ĐÁNH DẤU MẢNH không (dấu nằm ở CUỐI dòng).
 * Nhận: line — một dòng nguyên văn của tệp lát.
 * Trả: true khi dòng kết thúc bằng dấu mở hoặc dấu đóng mảnh.
 */
function isFragmentMarkerLine(line: string): boolean {
  const trimmed = line.trimEnd();
  return trimmed.endsWith(FRAGMENT_BEGIN_LINE) || trimmed.endsWith(FRAGMENT_END_LINE);
}

/**
 * Gỡ phần giao kèo của MỘT lát typert và trả về các dòng NGUYÊN VĂN của artefact.
 * Gỡ: khối header 5 dòng · dòng `// @ts-nocheck` · đúng MỘT dòng trống ngay sau nó · đúng MỘT dòng trống
 * ngay trước `export {};` · dòng `export {};` · và CẢ DÒNG đánh dấu mảnh ở cuối dòng. Dòng trống BÊN
 * TRONG thân (kể cả dòng trống cuối lát — chính là newline cuối artefact) là nguyên văn nên KHÔNG được cắt.
 * Nhận: source — nội dung tệp lát; fileName — tên tệp lát (dùng cho thông báo lỗi).
 * Trả: mảng dòng nguyên văn; ghép bằng EOL là ra đúng đoạn artefact của lát.
 */
export function stripTypertSlice(source: string, fileName: string): string[] {
  const lines = source.split(EOL);
  const marker = lines.findIndex((line) => line.startsWith(SLICE_MARKER));
  if (marker < 0) throw new Error(fileName + ": khong thay dong danh dau lat nguyen van");
  const headerOk = lines.slice(0, marker).some((line) => line.trim() === HEADER_END);
  if (!headerOk) throw new Error(fileName + ": thieu khoi header 5 dong bat buoc");
  const tail = lines.lastIndexOf(MODULE_TAIL);
  if (tail < 0) throw new Error(fileName + ": thieu dong ket thuc module");
  if (tail <= marker) throw new Error(fileName + ": dong ket thuc module nam TRUOC dong danh dau lat");
  // Đúng MỘT dòng trống sau @ts-nocheck và đúng MỘT dòng trống trước export {}; là giao kèo của tool sinh lát.
  if ((lines[marker + 1] ?? "x").trim() !== "") throw new Error(fileName + ": thieu dong trong sau dong danh dau");
  if ((lines[tail - 1] ?? "x").trim() !== "") throw new Error(fileName + ": thieu dong trong truoc dong ket thuc");
  return lines.slice(marker + 2, tail - 1).filter((line) => !isFragmentMarkerLine(line));
}

/**
 * Ghép các lát typert theo ĐÚNG thứ tự truyền vào và trả về văn bản artefact hoàn chỉnh.
 * Ghép ở mức DÒNG rồi join MỘT lần: lát cắt ở ranh giới dòng nên không được nối chuỗi từng lát (nối chuỗi
 * sẽ dính dòng cuối lát trước với dòng đầu lát sau và làm mất newline cuối artefact).
 * Nhận: partsDir — thư mục chứa lát; partFiles — danh mục tệp lát theo đúng thứ tự ghép.
 * Trả: văn bản artefact đã ghép (phép kiểm byte-identical là việc của build.ts).
 */
export function assembleTypert(partsDir: string, partFiles: readonly string[]): string {
  if (partFiles.length === 0) throw new Error("danh muc lat rong: " + partsDir);
  const present = new Set(readdirSync(partsDir));
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const file of partFiles) {
    if (!present.has(file)) throw new Error("thieu lat " + file + " trong " + partsDir);
    if (seen.has(file)) throw new Error("lat bi lap trong danh muc: " + file);
    seen.add(file);
    lines.push(...stripTypertSlice(readFileSync(join(partsDir, file), "utf8"), file));
  }
  return lines.join(EOL);
}
