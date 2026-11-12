/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Cấu hình của row repeat-tool-reminder: schema Schemastery (thresholds mặc định [3, 5, 8] · include [] ·
 *      exclude [] · argumentsPreviewChars 500) và hai phép kiểm fail-loud giữ NGUYÊN VĂN thông điệp tiếng Anh
 *      của bản gốc @deepseek-ai/dsh-repeat-tool-reminder (lib/types/index.js dòng 2117–2126, 2184–2189, 2208).
 */
import z from "@deepseek-ai/schemastery";

/**
 * Cấu hình của row repeat-tool-reminder mà `apply` đọc. Bốn trường đều có mặc định trong schema
 * {@link Config}, nên một patch cấu hình có thể bỏ trống cả bốn.
 * Nhận: object cấu hình do tầng nạp plugin (cordis) truyền vào — sau khi schema điền mặc định.
 * Trả: (kiểu) bốn trường: ngưỡng chuỗi lặp, mẫu tên tool được theo dõi/bỏ qua, và trần ký tự xem trước args.
 */
export interface Config {
  /** Các ngưỡng độ dài chuỗi lặp phát nhắc nhở (mặc định `[3, 5, 8]`); phần tử đầu là mức "nhẹ nhàng". */
  thresholds: number[];
  /** Mẫu tên tool ĐƯỢC theo dõi (rỗng = theo dõi mọi tool); mỗi mẫu dùng wildcard `*`. */
  include: string[];
  /** Mẫu tên tool BỎ QUA (thắng `include`); mỗi mẫu dùng wildcard `*`. */
  exclude: string[];
  /** Số ký tự tối đa của chuỗi arguments chuẩn hoá được trích trong nhắc nhở chi tiết (mặc định 500). */
  argumentsPreviewChars: number;
}

/**
 * Schema Schemastery cho {@link Config} — NGUYÊN VĂN bốn trường và giá trị mặc định của bản gốc
 * (thresholds `[3, 5, 8]`, include `[]`, exclude `[]`, argumentsPreviewChars `500`).
 * Nhận: không (schema được dựng một lần lúc nạp module).
 * Trả: schema xác thực cấu hình, để Settings/config-editor của kernel render được field và để tầng nạp
 *        điền mặc định khi patch không khai trường nào.
 */
export const Config: z<Config> = z.object({
  thresholds: z.array(z.number()).default([3, 5, 8]),
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
  argumentsPreviewChars: z.number().default(500),
}) as unknown as z<Config>;

/**
 * Kiểm `thresholds` theo khế ước fail-loud của bản gốc và trả về mảng ĐÃ SẮP XẾP TĂNG DẦN (luật leo thang
 * đọc `thresholds[0]` như mức nhẹ nhàng, nên thứ tự được chuẩn hoá ở đây, một lần duy nhất).
 * Thứ tự kiểm giữ NGUYÊN VĂN: (1) rỗng → (2) từng phần tử phải là số nguyên >= 2 → (3) không trùng nhau.
 * Nhận: `values` — danh sách ngưỡng thô lấy từ cấu hình (có thể chưa sắp xếp).
 * Trả: bản sao ĐÃ sắp xếp tăng dần của `values` (mảng đầu vào không bị sửa tại chỗ).
 * @throws Error khi `values` rỗng, khi có phần tử không phải số nguyên >= 2, hoặc khi có phần tử trùng nhau
 *         — thông điệp giữ nguyên văn bản gốc (tiếng Anh).
 */
export function validateThresholds(values: readonly number[]): number[] {
  if (values.length === 0) throw new Error("repeat-tool-reminder: `thresholds` must not be empty");
  for (const value of values) if (!Number.isInteger(value) || value < 2) throw new Error(`repeat-tool-reminder: invalid threshold ${value} — every threshold must be an integer >= 2`);
  if (new Set(values).size !== values.length) throw new Error("repeat-tool-reminder: `thresholds` must not contain duplicates");
  return [...values].sort((a, b) => a - b);
}

/**
 * Kiểm `argumentsPreviewChars` theo khế ước fail-loud của bản gốc. Bản gốc kiểm phép này NGAY TRONG `apply`
 * (dòng 2208), tức SAU `validateThresholds`; nơi gọi phải giữ đúng thứ tự đó để thông điệp lỗi đầu tiên
 * trùng bản gốc khi cấu hình sai cả hai chỗ.
 * Nhận: `value` — trần số ký tự xem trước arguments lấy từ cấu hình.
 * Trả: chính `value` sau khi đã kiểm (bản gốc chỉ kiểm rồi dùng tiếp biến cục bộ; trả lại để nơi gọi dùng
 *        luôn giá trị đã xác thực).
 * @throws Error khi `value` không phải số nguyên >= 1 — thông điệp giữ nguyên văn bản gốc (tiếng Anh).
 */
export function validateArgumentsPreviewChars(value: number): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`repeat-tool-reminder: invalid argumentsPreviewChars ${value} — must be an integer >= 1`);
  return value;
}
