/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ghep ten lop CSS — thay cho clsx (ban goc nhung san clsx vao bundle, bang module KHONG co no)
 */

/**
 * Ghep cac gia tri lop thanh mot chuoi ten lop, bo qua gia tri gia.
 * Nhan: values — ten lop hoac gia tri gia (false/undefined/null).
 * Tra: chuoi ten lop noi bang dau cach.
 */
export function classes(...values: readonly (string | false | undefined | null)[]): string {
  let out = "";
  for (const value of values) {
    if (value === false || value === undefined || value === null || value === "") continue;
    out = out === "" ? value : out + " " + value;
  }
  return out;
}
