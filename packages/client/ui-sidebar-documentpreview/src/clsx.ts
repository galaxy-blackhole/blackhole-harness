/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc clsx rut gon — NGUYEN VAN thuat toan cua ban goc (bundle goc nhung thang clsx@2.1.1)
 */

/**
 * Noi cac gia tri lop thanh mot chuoi, bo qua gia tri gia.
 * Nhan: danh sach gia tri (chuoi, so, mang, doi tuong khoa->dieu kien).
 * Tra: chuoi lop da noi bang dau cach.
 */
function value(input: unknown): string {
  let out = "";
  if (typeof input === "string" || typeof input === "number") out += input;
  else if (typeof input === "object" && input !== null) {
    if (Array.isArray(input)) {
      for (let index = 0; index < input.length; index++) {
        const nested = value(input[index]);
        if (nested !== "") {
          if (out !== "") out += " ";
          out += nested;
        }
      }
    } else {
      for (const key in input as Record<string, unknown>) {
        if ((input as Record<string, unknown>)[key]) {
          if (out !== "") out += " ";
          out += key;
        }
      }
    }
  }
  return out;
}

/**
 * Noi cac doi so thanh chuoi lop cua CSS Modules.
 * Nhan: cac gia tri lop (xem {@link value}).
 * Tra: chuoi lop, moi lop cach nhau mot dau cach.
 */
export function clsx(...inputs: unknown[]): string {
  let out = "";
  for (const input of inputs) {
    const part = value(input);
    if (part !== "") {
      if (out !== "") out += " ";
      out += part;
    }
  }
  return out;
}
