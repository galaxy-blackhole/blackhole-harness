/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Vật thể chạy của miền goal: hằng phiên bản thay đổi, hàm đóng dấu danh tính goal, và lớp lỗi
 *      của ranh giới miền — kế thừa ĐÚNG HarnessError của kernel để các gói khác bắt được cùng một lớp.
 */

import { HarnessError } from "@deepseek-ai/dsh-llm";

/** Phiên bản thay đổi goal được nhúng trong nguồn message của vòng zero (nguyên văn bản gốc). */
export const GOAL_CHANGE_VERSION = 1;

declare const GOAL_ID_BRAND: unique symbol;

/** Danh tính goal đã đóng dấu thương hiệu ở mức KIỂU (lúc chạy vẫn là chuỗi thuần, y bản gốc). */
export type GoalId = string & { readonly [GOAL_ID_BRAND]: true };

/**
 * Đóng dấu một chuỗi thành danh tính goal.
 * Nhận: `id` — chuỗi danh tính thô.
 * Trả: chính chuỗi đó với thương hiệu `GoalId` (không kiểm nội dung: bản gốc cũng vậy).
 */
export function GoalId(id: string): GoalId {
  return id as GoalId;
}

/** Lỗi do ranh giới miền goal ném ra (mang mã ổn định của {@link GoalErrorCode}). */
export class GoalError extends HarnessError {
  /**
   * Dựng một lỗi miền goal.
   * Nhận: `message` — câu giải thích cho người; `code` — phân loại ổn định để định tuyến máy.
   * Trả: thể hiện lỗi đã sẵn sàng ném.
   */
  constructor(message: string, code: string) {
    super(message, code);
  }
}
