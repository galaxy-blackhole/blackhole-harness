/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Lỗi có kiểu của seam workflow: kế thừa ĐÚNG `HarnessError` của kernel (peer
 *      `@deepseek-ai/dsh-llm`) để `code` định tuyến được bằng máy, kèm cờ `fatal` cho
 *      kỷ luật của combinator `parallel()`/`pipeline()`.
 */

import { HarnessError } from "@deepseek-ai/dsh-llm";
import type { WorkflowErrorCode } from "./types.ts";

/**
 * Lỗi có kiểu cho hỏng hóc của seam workflow. Kế thừa {@link HarnessError} nên `code` là
 * taxonomy định tuyến được bằng máy. Cờ `fatal` điều khiển kỷ luật của combinator:
 * `parallel()`/`pipeline()` NÉM LẠI lỗi fatal (một tuỳ chọn gõ sai hay một trần tài nguyên bị
 * chạm phải giết script thật to), và để `null` theo từng mục cho agent con hỏng / lỗi script
 * thường trong một stage. Mọi {@link WorkflowErrorCode} đều fatal — cờ tồn tại để sự phân biệt
 * là TƯỜNG MINH ở từng chỗ bắt, không phải suy diễn.
 */
export class WorkflowError extends HarnessError {
  /** Combinator có phải LAN TRUYỀN lỗi này thay vì biến mục đó thành `null` hay không. */
  readonly fatal: boolean;

  /**
   * Dựng một lỗi workflow.
   * Nhận: thông điệp người đọc được, mã lỗi máy định tuyến được, và tuỳ chọn chuẩn `ErrorOptions`
   * (có `cause` để nối chuỗi nguyên nhân) cộng cờ `fatal` (mặc định `true`).
   * Trả: thực thể lỗi đã đăng ký `name`/`code`/`fatal` như bản gốc.
   */
  constructor(message: string, code: WorkflowErrorCode, options?: ErrorOptions & { fatal?: boolean }) {
    super(message, code, options);
    this.name = "WorkflowError";
    this.fatal = options?.fatal ?? true;
  }
}

/**
 * Cho biết combinator có phải NÉM LẠI `error` thay vì biến mục đó thành `null` hay không.
 * Nhận: mọi giá trị bị ném — tính fatal là `instanceof` ở realm host (script ở realm khác
 * KHÔNG làm giả được).
 * Trả: `true` khi và chỉ khi `error` là {@link WorkflowError} và cờ `fatal` của nó bật.
 */
export function isFatalWorkflowError(error: unknown): boolean {
  return error instanceof WorkflowError && error.fatal;
}
