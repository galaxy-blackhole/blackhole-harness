/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phân loại lỗi ổn định của seam hỏi người dùng: lớp lỗi mang `code` máy đọc được, hàm dựng
 *      lỗi "đã huỷ", và phép dựng lại lỗi đi qua dây (bản gốc: `UserQuestionError extends HarnessError`).
 */
import { HarnessError } from "@deepseek-ai/dsh-llm";

/**
 * Phân loại lỗi ổn định cho mọi thất bại của seam hỏi người dùng.
 *
 * Vì sao kế thừa ĐÚNG `HarnessError` của kernel (peer `@deepseek-ai/dsh-llm`): tầng tool của
 * kernel chỉ ghi `{ name, code }` vào kết quả tool khi `error instanceof HarnessError`
 * (`errorInfo` trong `dsh-tools`), và UI đọc đúng `code` đó để vẽ thẻ "đã huỷ" — một lớp lỗi
 * chỉ GIỐNG hình dạng sẽ làm mất cả hai đường đó.
 */
export class UserQuestionError extends HarnessError {
  /**
   * Dựng một lỗi hỏi người dùng.
   * Nhận: `message` — chữ cho người đọc; `code` — mã ổn định; `options` — nguyên nhân gốc.
   * Trả: thể hiện lỗi với `name` cố định `"UserQuestionError"`.
   */
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options);
    this.name = "UserQuestionError";
  }
}

/**
 * Lỗi "đã huỷ trước khi người dùng trả lời".
 * Nhận: `cause` — nguyên nhân gốc, có thể vắng.
 * Trả: lỗi mã `ASK_ABORTED`.
 */
export function abortedQuestion(cause?: unknown): UserQuestionError {
  return new UserQuestionError(
    "ask_user_question was aborted before the user answered",
    "ASK_ABORTED",
    cause === undefined ? undefined : { cause },
  );
}

/**
 * Kiểm một giá trị có phải bản ghi (object không phải mảng) hay không.
 * Nhận: `value` — giá trị bất kỳ.
 * Trả: true khi là object không null và không phải mảng.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Dựng lại lỗi hỏi người dùng từ một giá trị đi qua dây.
 *
 * Lời đáp của UI đi qua Remote nên tới đây dưới dạng bản ghi `{ name, code, message }` chứ không
 * phải thể hiện lớp; hàm này dựng lại ĐÚNG lớp để tầng trên còn phân loại được bằng `instanceof`
 * và `code`.
 * Nhận: `reason` — giá trị bị ném ra.
 * Trả: thể hiện {@link UserQuestionError} khi nhận ra, ngược lại chính giá trị đầu vào.
 */
export function restoreUserQuestionError(reason: unknown): unknown {
  if (reason instanceof UserQuestionError) return reason;
  if (
    isRecord(reason) &&
    reason["name"] === "UserQuestionError" &&
    typeof reason["message"] === "string" &&
    typeof reason["code"] === "string"
  ) {
    return new UserQuestionError(reason["message"], reason["code"], { cause: reason });
  }
  return reason;
}
