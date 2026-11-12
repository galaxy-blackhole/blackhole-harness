/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Brand chuoi luc bien dich (1:1 util/brand cua ban goc) — khong doi gia tri luc chay
 */

/**
 * Áp một brand chuỗi lúc biên dịch mà không đổi giá trị.
 * Nhận: value — chuỗi đã được miền sở hữu brand đích chấp nhận.
 * Trả: đúng chuỗi đó, mang brand kiểu mà người gọi yêu cầu.
 */
export function brandString<T extends string>(value: string): T {
  return value as T;
}
