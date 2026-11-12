/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Điểm vào của package message-feedback: xuất ĐÚNG bề mặt bản gốc đo trên artifact
 *      (`MessageFeedbackService` + `default`). Từ vựng kiểu nằm ở ./types.ts và được xuất lại
 *      CHỈ Ở TẦNG KIỂU (`export type *`) — lúc chạy bản build không mang thêm export nào.
 */

export { default, MessageFeedbackService } from "./service.ts";
// 08/11/2026 (R5 — review): stock phơi KIỂU `Config` ở gốc; khai lại đúng một dòng (thuần KIỂU, không đổi runtime).
export type { Config } from "./service.ts";
export type * from "./types.ts";
