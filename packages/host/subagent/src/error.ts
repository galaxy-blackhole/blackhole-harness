/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lỗi có kiểu dùng chung cho thao tác dịch vụ và provider của subagent. Port 1:1
 *      `SubagentError` của `@deepseek-ai/dsh-subagent` (`lib/types/error.js` 14 dòng +
 *      `lib/types/error.d.ts` 11 dòng).
 */

/**
 * Lỗi có kiểu dùng chung cho thao tác dịch vụ và provider của subagent.
 *
 * @module @galaxy-blackhole/gbh-subagent/error
 */

import { HarnessError } from "@deepseek-ai/dsh-llm";

/** Lỗi có kiểu của seam subagent. */
export class SubagentError extends HarnessError {
  /**
   * Dựng lỗi với thông điệp, mã định tuyến và nguyên nhân tuỳ chọn.
   * Nhận: message — chẩn đoán cho người đọc; code — lớp lỗi ổn định để định tuyến;
   *        options — `cause` chuẩn của Error.
   * Trả: không (khởi tạo đối tượng); `name` được đặt thành `SubagentError`.
   */
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options);
    this.name = "SubagentError";
  }
}
