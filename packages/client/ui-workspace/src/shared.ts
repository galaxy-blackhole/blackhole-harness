/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tien ich dung chung: assertNever cho nhanh union dong
 */

/**
 * Danh dau mot nhanh union dong khong bao gio toi duoc.
 * Nhan: value — gia tri khong the co; context — nhan tuy chon cua diem switch.
 * Tra: never; gia tri thoat khoi kieu cua no luon nem loi.
 */
export function assertNever(value: never, context?: string): never {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error("unreachable variant" + (context !== undefined ? " in " + context : "") + ": " + rendered);
}
