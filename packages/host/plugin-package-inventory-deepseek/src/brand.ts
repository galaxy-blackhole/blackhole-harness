/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dấu kiểu (brand) cho id phiên — bản địa phương của `brandString` mà bản gốc lấy từ
 *      @galaxy-blackhole/gbh-brand. Gói đó NGOÀI bảng §3b và hàm của nó là hàm ĐỒNG NHẤT lúc chạy
 *      (`lib/index.js`: `function brandString(value) { return value }`), nên khai tại chỗ là
 *      tương đương từng byte trên dây, không cần thêm một peer.
 */

/**
 * Đóng dấu kiểu chuỗi mà KHÔNG đổi giá trị lúc chạy.
 * @param value - chuỗi do miền sở hữu dấu kiểu chấp nhận (ở đây là id phiên).
 * @returns đúng chuỗi đó, không sao chép, không chuẩn hoá.
 */
export function brandString(value: string): string {
  return value;
}
