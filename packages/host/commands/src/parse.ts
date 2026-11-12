/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phân tích một dòng lệnh gạch chéo ĐÚNG NGUYÊN VĂN — chép nguyên biểu thức của bản gốc, không chuẩn hoá phần nhập phía sau.
 */

import type { ParsedCommand } from "./types.ts";

/**
 * Phân tích một dòng lệnh gạch chéo, KHÔNG chuẩn hoá phần nhập phía sau.
 *
 * Biểu thức là nguyên văn của bản gốc: tên lệnh phải theo `[a-z][a-z0-9_-]*` và phải kết
 * thúc bằng hết dòng hoặc một ký tự phân cách (tab/xuống dòng/về đầu dòng/khoảng trắng).
 *
 * Nhận: `line` — dòng ứng viên đầy đủ.
 * Trả: object ĐÓNG BĂNG `{ name, rawInput }`, hoặc `undefined` khi dòng không phải lệnh.
 */
export function parseCommand(line: string): ParsedCommand | undefined {
  const match = /^\/([a-z][a-z0-9_-]*)(?=$|[\t\n\r ])/u.exec(line);
  if (match === null) return undefined;
  const name = match[1];
  /* v8 ignore next -- nhóm bắt thứ nhất buộc phải có mỗi khi biểu thức khớp */
  if (name === undefined) return undefined;
  return Object.freeze({
    name,
    rawInput: line.slice(match[0].length),
  });
}
