/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bốn tiện ích văn bản NGUYÊN VĂN của @deepseek-ai/dsh-tool-str-replace-editor: cắt theo ngưỡng, so codepoint, tìm offsets và suy số dòng.
 */

import { truncateWithoutSplittingSurrogatePair } from "@deepseek-ai/dsh-output-retention";

import { TRUNCATED_MESSAGE } from "./description.ts";

/**
 * Cắt nội dung theo ngưỡng ký tự (không tách cặp surrogate) rồi gắn thông điệp cắt — NGUYÊN VĂN bản gốc.
 * Nhận: content — văn bản cần chiếu; maxOutputChars — ngưỡng ký tự.
 * Trả: văn bản gốc khi vừa ngưỡng, ngược lại là phần đã cắt + {@link TRUNCATED_MESSAGE}.
 */
export function maybeTruncate(content: string, maxOutputChars: number): string {
  return content.length <= maxOutputChars ? content : truncateWithoutSplittingSurrogatePair(content, maxOutputChars) + TRUNCATED_MESSAGE;
}

/**
 * So hai chuỗi theo thứ tự codepoint — NGUYÊN VĂN bản gốc (dùng cho comparator của `Array#sort`).
 * Nhận: left — chuỗi thứ nhất; right — chuỗi thứ hai.
 * Trả: -1 khi left đứng trước, 1 khi đứng sau, 0 khi bằng.
 */
export function codepointCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Liệt kê MỌI vị trí xuất hiện của một chuỗi con, không chồng lấn — NGUYÊN VĂN bản gốc.
 * Nhận: content — văn bản bị tìm; search — chuỗi con cần tìm.
 * Trả: mảng offset (0-based) theo thứ tự tăng dần; rỗng khi không có lần nào.
 */
export function matchOffsets(content: string, search: string): number[] {
  const offsets: number[] = [];
  let offset = 0;
  while (true) {
    const match = content.indexOf(search, offset);
    if (match < 0) return offsets;
    offsets.push(match);
    offset = match + search.length;
  }
}

/**
 * Suy số dòng (1-based) của từng offset trong văn bản — NGUYÊN VĂN bản gốc.
 * Nhận: content — văn bản gốc; offsets — các offset đã sắp tăng dần.
 * Trả: mảng số dòng tương ứng từng offset.
 */
export function lineNumbersAt(content: string, offsets: readonly number[]): number[] {
  let line = 1;
  let cursor = 0;
  return offsets.map((offset) => {
    while (cursor < offset) {
      if (content[cursor] === "\n") line += 1;
      cursor += 1;
    }
    return line;
  });
}
