/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lỗi có kiểu của Team: TeamError kế thừa HarnessError + hàm errorMessage mô tả giá trị ném ra — port 1:1 lib/types/error.js.
 */
import { inspect } from "node:util";

import { HarnessError } from "@deepseek-ai/dsh-llm";

/** Lỗi ổn định của miền Team. */
export class TeamError extends HarnessError {
  /**
   * Dựng lỗi với mã ổn định.
   * Nhận: message — thông điệp; code — mã lỗi; options — tuỳ chọn của Error. Trả: không.
   */
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options);
    this.name = "TeamError";
  }
}

/**
 * Mô tả một giá trị ném ra mà KHÔNG thay thế lần từ chối gốc.
 * Nhận: error — giá trị bắt được. Trả: một dòng chẩn đoán có giới hạn.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return inspect(error, { breakLength: Infinity, compact: true, depth: 4 });
}
