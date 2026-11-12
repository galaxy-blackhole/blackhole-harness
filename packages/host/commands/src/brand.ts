/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Brand của row commands: hai constructor danh tính (CommandDefinitionId · CommandId) — chép nguyên hành vi `brand.ts` của bản gốc.
 */

/**
 * Nhãn hiệu danh tính kiểu chuỗi — cùng vai trò với `Branded<B>` của `@deepseek-ai/dsh-brand`
 * nhưng KHAI TẠI CHỖ để gói không phải nhận thêm một peer nằm ngoài bảng §3b
 * (bản gốc chỉ mượn KIỂU, không gọi hàm nào của gói đó lúc chạy).
 */
declare const brand: unique symbol;

/** Kiểu chuỗi mang nhãn `B` — chỉ để phân biệt ở mức KIỂU, lúc chạy vẫn là chuỗi thuần. */
export type Branded<B extends string> = string & { readonly [brand]: B };

/**
 * Danh tính do plugin sở hữu cho một định nghĩa lệnh — độc lập với tên và phần chữ hiển thị.
 */
export type CommandDefinitionId = Branded<"CommandDefinitionId">;

/**
 * Gắn nhãn danh tính định nghĩa lệnh do plugin đặt.
 * Nhận: `id` — chuỗi danh tính ổn định do plugin đăng ký chọn.
 * Trả: chính chuỗi đó, đã mang nhãn; KHÔNG kiểm tra gì.
 */
export function CommandDefinitionId(id: string): CommandDefinitionId {
  return id as CommandDefinitionId;
}

/**
 * Ghép một lượt thực thi lệnh: cặp bản ghi `command/run`/`command/done` với phản hồi
 * `command.execute`. Do bộ thực thi đúc ra, tăng đơn điệu theo từng thực thể service.
 */
export type CommandId = Branded<"CommandId">;

/**
 * Gắn nhãn một chuỗi thành {@link CommandId}.
 * Nhận: `id` — id ghép cặp do bộ thực thi đúc.
 * Trả: chính chuỗi đó, đã mang nhãn; KHÔNG kiểm tra gì.
 */
export function CommandId(id: string): CommandId {
  return id as CommandId;
}
