/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mặt cắt SEAM mà bộ đóng góp session-log dùng, khai theo CẤU TRÚC trong chính file này (không
 *      khai ambient `declare module` nào — luật 000d): sổ đăng ký trường request mở rộng của API
 *      DeepSeek chính thức, và hình dạng request đã serialize mà provider nhìn thấy.
 */

import type { JsonValue } from "@deepseek-ai/dsh-util-values";

/**
 * Một trường ĐÃ CHUẨN BỊ cho đúng một request, kèm commit sau khi endpoint nhận (2xx).
 * Bản gốc: `PreparedDeepSeekLlmApiExtension` của `@deepseek-ai/dsh-deepseek-llm-api-extensions`.
 */
export interface PreparedExtensionField {
  /**
   * Giá trị đã tách rời, sẽ được ghép dưới khoá mà provider đã đăng ký. Sổ đăng ký THẬT clone rồi
   * đóng băng giá trị này trước khi ghép vào thân request.
   */
  readonly value: unknown;
  /**
   * Commit phụ thuộc việc endpoint ĐÃ NHẬN request (gọi sau 2xx).
   * Nhận: không.
   * Trả: không, hoặc promise hoàn tất khi commit xong.
   */
  accept?(): void | Promise<void>;
}

/**
 * Sự thật request đã serialize mà provider nhìn thấy.
 * Bản gốc: `DeepSeekLlmApiExtensionRequest`.
 */
export interface ExtensionRequestFacts {
  /** Thân request DeepSeek TRƯỚC khi ghép các trường mở rộng. */
  readonly body: Readonly<Record<string, JsonValue>>;
  /** Danh tính phiên mà request model mang, khi có. */
  readonly sessionId?: string;
  /** Phân loại request phụ, khi có. */
  readonly purpose?: "compaction" | "session-title";
  /** Huỷ của lượt chuẩn bị request; provider phải dừng ngay sau khi bị huỷ. */
  readonly signal: AbortSignal;
}

/**
 * Provider của MỘT trường request mở rộng.
 * Bản gốc: `DeepSeekLlmApiExtensionProvider`.
 */
export interface ExtensionFieldProvider {
  /**
   * Chuẩn bị trường cho đúng một request đã serialize.
   * Nhận: sự thật request bất biến.
   * Trả: trường đã chuẩn bị, hoặc `undefined` khi request này không có giá trị cho trường đó.
   */
  prepare(request: ExtensionRequestFacts): PreparedExtensionField | undefined;
}

/**
 * Sổ đăng ký trường request mở rộng (seam `ctx.deepseekLlmApiExtensions`).
 * Bản gốc: `DeepSeekLlmApiExtensionRegistry` của `@deepseek-ai/dsh-deepseek-llm-api-extensions`.
 */
export interface ExtensionRegistry {
  /**
   * Đăng ký provider DUY NHẤT của một trường request cấp cao nhất; đăng ký có phạm vi hiệu ứng.
   * Nhận: tên trường và provider chuẩn bị trường đó lúc request.
   * Trả: hàm dọn giải phóng trường.
   */
  register(field: string, provider: ExtensionFieldProvider): () => Promise<void>;
}
