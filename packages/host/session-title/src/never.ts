/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Guard VÉT CẠN của union đóng — bản địa phương của `assertNever` ở @deepseek-ai/dsh-util-values
 *      (gói đó ngoài bảng peer §3b; hàm chỉ ném lỗi nên không cần CÙNG một thể hiện).
 */

/**
 * Khẳng định một nhánh union là KHÔNG THỂ tới được (nguyên văn câu lỗi của bản gốc).
 * Nhận: giá trị đã bị vét cạn và tên union để chẩn đoán.
 * Trả: không trả — LUÔN ném `Error`.
 */
export function assertNever(value: never, context: string): never {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}
