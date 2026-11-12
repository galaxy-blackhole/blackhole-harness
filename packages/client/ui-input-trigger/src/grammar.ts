/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng ../../context/file-reference/src/grammar.ts của bản gốc — nhận diện token @path / @\"path có khoảng trắng
 */

/**
 * Một token @ đang hoạt động dưới con trỏ.
 * Nhận: không có.
 * Trả: hợp đồng kiểu ActiveAtToken.
 */
export interface ActiveAtToken {
  /** Nguyên văn token kể cả ký tự @ (và dấu nháy mở nếu có). */
  readonly prefix: string;
  /** Phần query sau ký tự @ (không gồm dấu nháy mở). */
  readonly query: string;
  /** Token đang mở ngoặc kép hay không. */
  readonly quoted: boolean;
}

/**
 * Tách token @path hoặc @"path có khoảng trắng dưới con trỏ. Một @ nằm trong token khác
 * (ví dụ địa chỉ email) không phải mốc gợi ý.
 * Nhận: line — dòng hiện tại của ô soạn; cursorCol — cột con trỏ trong dòng đó.
 * Trả: token đang hoạt động, hoặc undefined khi con trỏ ngoài token @.
 */
export function activeAtToken(line: string, cursorCol: number): ActiveAtToken | undefined {
  const beforeCursor = line.slice(0, cursorCol);
  const quoted = /(?:^|\s)(@"([^"]*))$/u.exec(beforeCursor);
  if (quoted?.[1] !== undefined && quoted[2] !== undefined) {
    return {
      prefix: quoted[1],
      query: quoted[2],
      quoted: true,
    };
  }
  const plain = /(?:^|\s)(@([^\s]*))$/u.exec(beforeCursor);
  if (plain?.[1] === undefined || plain[2] === undefined) return undefined;
  return {
    prefix: plain[1],
    query: plain[2],
    quoted: false,
  };
}
