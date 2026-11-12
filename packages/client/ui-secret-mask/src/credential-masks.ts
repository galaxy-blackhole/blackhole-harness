/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Dựng mặt nạ hiển thị của một credential: giữ dấu xuống dòng, mỗi điểm mã một dấu, khối khoá giữ dòng BEGIN/END
 */

import { ADDRESS, KEY_BLOCK, PREFIXED, VISIBLE_PREFIX } from "./credential-formats.ts";

/** Ký tự thay cho mỗi ký tự credential bị che trong chuỗi mặt nạ. */
export const MASK = "*";

/** Số dấu mặt nạ dựng sẵn một lần rồi cắt bớt. */
const SHARED_MARKS = 4096;

/** Chuỗi dấu dùng chung để cắt ra mặt nạ. */
const SHARED_MARK_RUN = MASK.repeat(SHARED_MARKS);

/**
 * Khoảng trắng ngoài ASCII trong \s.
 * Nhận: mã điểm UTF-16.
 * Trả: true nếu là khoảng trắng theo \s của JS.
 */
export function isWideSpace(code: number): boolean {
  return (
    code === 160 ||
    code === 5760 ||
    (code >= 8192 && code <= 8202) ||
    code === 8232 ||
    code === 8233 ||
    code === 8239 ||
    code === 8287 ||
    code === 12288 ||
    code === 65279
  );
}

/**
 * Vị trí bắt đầu của cặp surrogate đứng ngay trước một vị trí, nếu có.
 * Nhận: chuỗi, vị trí bắt đầu xét và vị trí kết thúc (không xét quá).
 * Trả: true nếu ký tự tại vị trí đó mở đầu một cặp surrogate hợp lệ.
 */
function isSurrogateHead(text: string, index: number, limit: number): boolean {
  if (index + 1 >= limit) return false;
  const code = text.charCodeAt(index);
  if (code < 55296 || code > 56319) return false;
  const next = text.charCodeAt(index + 1);
  return next >= 56320 && next <= 57343;
}

/**
 * Dựng mặt nạ cho phần credential đã nhận ra.
 * Nhận: chuỗi gốc, loại của ứng viên sớm nhất, cờ plain (chỉ toàn ký tự định dạng có tiền tố), start và end.
 * Trả: chuỗi hiển thị thay cho credential đó.
 */
export class CredentialMasks {
  /**
   * `count` dấu mặt nạ.
   * Nhận: số dấu.
   * Trả: chuỗi dấu.
   */
  marks(count: number): string {
    return count <= SHARED_MARKS ? SHARED_MARK_RUN.slice(0, count) : MASK.repeat(count);
  }

  /**
   * `count` dấu rồi một dấu xuống dòng.
   * Nhận: số dấu và mã ký tự xuống dòng (10 hoặc 13).
   * Trả: chuỗi đã nối.
   */
  marksThen(count: number, code: number): string {
    if (count > SHARED_MARKS) return MASK.repeat(count) + (code === 10 ? "\n" : "\r");
    return code === 10 ? SHARED_MARK_RUN.slice(0, count) + "\n" : SHARED_MARK_RUN.slice(0, count) + "\r";
  }

  /**
   * Mặt nạ của text[start, end) theo loại của ứng viên sớm nhất.
   * Nhận: chuỗi gốc, loại, cờ plain, start và end.
   * Trả: chuỗi hiển thị: password thì che cả; khoá có tiền tố thì để lộ 8 ký tự đầu; khối khoá thì giữ dòng BEGIN/END.
   */
  masked(text: string, kind: number, plain: boolean, start: number, end: number): string {
    if (kind === ADDRESS) return this.range(text, start, end);
    if (kind === PREFIXED) {
      const head = text.slice(start, start + VISIBLE_PREFIX);
      const body = plain ? this.marks(end - start - VISIBLE_PREFIX) : this.range(text, start + VISIBLE_PREFIX, end);
      return head + body;
    }
    return kind === KEY_BLOCK ? this.keyBlock(text, start, end) : this.range(text, start, end);
  }

  /**
   * Mặt nạ của một khối khoá: giữ dòng BEGIN, dòng END nếu có, và mọi dấu xuống dòng.
   * Nhận: chuỗi gốc, start và end của khối.
   * Trả: chuỗi hiển thị.
   */
  keyBlock(text: string, start: number, end: number): string {
    let bodyStart = start;
    for (let index = start; index < end; index++) {
      if (text.charCodeAt(index) === 10) {
        bodyStart = index + 1;
        break;
      }
    }
    let bodyEnd = end;
    for (let index = end - 9; index >= bodyStart; index--) {
      if (text.charCodeAt(index) === 10 && text.startsWith("-----END", index + 1)) {
        bodyEnd = index;
        break;
      }
    }
    const atBreak = bodyEnd === text.length || text.charCodeAt(bodyEnd) === 10 || text.charCodeAt(bodyEnd) === 13;
    const body = atBreak ? this.lines(text, bodyStart, bodyEnd) : this.range(text, bodyStart, bodyEnd);
    return text.slice(start, bodyStart) + body + text.slice(bodyEnd, end);
  }

  /**
   * Mặt nạ của text[start, end): mọi ký tự trừ dấu xuống dòng; cặp surrogate tính là một ký tự.
   * Nhận: chuỗi gốc, start và end.
   * Trả: chuỗi hiển thị.
   */
  range(text: string, start: number, end: number): string {
    let masked = "";
    let count = 0;
    for (let index = start; index < end; index++) {
      const code = text.charCodeAt(index);
      if (code === 10 || code === 13) {
        masked += this.marksThen(count, code);
        count = 0;
        continue;
      }
      if (isSurrogateHead(text, index, end)) index++;
      count++;
    }
    return masked + this.marks(count);
  }

  /**
   * Như range nhưng cho phần thân kết thúc ở dấu xuống dòng hoặc cuối chuỗi.
   * Nhận: chuỗi gốc, start và end.
   * Trả: chuỗi hiển thị.
   */
  lines(text: string, start: number, end: number): string {
    let masked = "";
    let count = 0;
    for (let index = start; index < end; index++) {
      const code = text.charCodeAt(index);
      if (code === 10 || code === 13) {
        masked += this.marksThen(count, code);
        count = 0;
        continue;
      }
      if (isSurrogateHead(text, index, end)) index++;
      count++;
    }
    return masked + this.marks(count);
  }
}
