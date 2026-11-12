/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 gói THƯ VIỆN @galaxy-blackhole/gbh-brand (32 dòng, zero-dep): brand KIỂU
 *      compile-time cho string/number, không đổi giá trị lúc chạy, không giữ danh tính/trạng thái nên hai bản
 *      cài độc lập vẫn cho giá trị dùng lẫn nhau được.
 */

/**
 * Gắn brand KIỂU cho string mà KHÔNG đổi giá trị.
 * @param value - string do miền sở hữu brand đích chấp nhận.
 * @returns đúng string đó, kèm brand compile-time được yêu cầu.
 */
export function brandString<T extends string>(value: string): T {
  return value as T;
}

/**
 * Gắn brand KIỂU cho number mà KHÔNG đổi giá trị.
 * @param value - number do miền sở hữu brand đích chấp nhận.
 * @returns đúng number đó, kèm brand compile-time được yêu cầu.
 */
export function brandNumber<T extends number>(value: number): T {
  return value as T;
}
/**
 * Brand của KERNEL (`@deepseek-ai/dsh-brand`) — TÁI XUẤT để cả cây dùng CHUNG một kiểu danh nghĩa.
 * Nhận: không. Trả: hai kiểu brand (string/number) của kernel dưới dạng TYPE.
 * Lý do (08/11/2026, lỗi thật TS2345/TS2344): nếu gói này tự khai `string & { [BRAND]: B }` riêng thì
 *   `SessionId` của ta và của kernel là HAI kiểu danh nghĩa khác nhau ⇒ consumer trộn hai id không gán được.
 *   Gói gốc khai đúng hai kiểu này ở `lib/types/index.d.ts:16,20` ⇒ đây là port 1:1, không phải nới luật.
 */
export type { Branded, BrandedNumber } from "@deepseek-ai/dsh-brand";
