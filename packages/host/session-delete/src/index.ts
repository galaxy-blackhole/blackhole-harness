/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Điểm vào @galaxy-blackhole/gbh-session-delete — row nạp default export (lớp dịch vụ), kèm named
 *      export và các kiểu dữ liệu của namespace Remote `sessionDelete`.
 */

import SessionDeleteService from "./service.ts";

/**
 * Lớp dịch vụ xoá phiên — giá trị mà row nạp.
 * Nhận: không — giá trị xuất là chính lớp đã cài đặt ở './service.ts'.
 * Trả: lớp SessionDeleteService.
 */
export default SessionDeleteService;

/**
 * Cùng một lớp, phơi thêm dưới dạng named export cho nơi khai theo tên.
 * Nhận: không.
 * Trả: đúng lớp của default export (cùng tham chiếu).
 */
export { SessionDeleteService };

/**
 * Các kiểu dữ liệu của namespace Remote `sessionDelete`.
 * Nhận: không — chỉ là kiểu, không phát sinh mã lúc chạy.
 * Trả: kiểu yêu cầu và kết quả của lượt xoá.
 */
export type { SessionDeleteRequest, SessionDeleteResult } from "./service.ts";
