/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu dữ liệu của sổ đăng ký trường mở rộng cho request LLM DeepSeek: JSON vô tổn, bảng trường
 *      hợp nhất được bằng declaration merging, sự thật request, và giao dịch chấp nhận sau 2xx.
 */

/** Giá trị JSON vô tổn mà thân request DeepSeek nhận. */
export type DeepSeekLlmApiJson =
  | null
  | boolean
  | number
  | string
  | DeepSeekLlmApiJson[]
  | { [key: string]: DeepSeekLlmApiJson };

/**
 * Bảng trường mở rộng top-level của request DeepSeek, hợp nhất được bằng declaration merging.
 * Gói đóng góp tự khai trường mình sở hữu vào bảng này — nhờ vậy `register` chỉ nhận đúng tên trường
 * đã được khai ở đâu đó trong chương trình, và kiểu giá trị đi kèm tên trường.
 */
export interface DeepSeekLlmApiExtensionMap {}

/** Sự thật request đã tuần tự hoá, nguyên văn, mà nhà cung cấp trường nhìn thấy. */
export interface DeepSeekLlmApiExtensionRequest {
  /** Thân request DeepSeek nền, TRƯỚC khi gộp trường mở rộng. */
  readonly body: Readonly<Record<string, DeepSeekLlmApiJson>>;
  /** Danh tính phiên do request model mang theo, khi có. */
  readonly sessionId?: string;
  /** Phân loại phụ của request, khi có. */
  readonly purpose?: "compaction" | "session-title";
  /** Tín hiệu huỷ của lượt chuẩn bị; nhà cung cấp phải dừng ngay sau khi bị huỷ. */
  readonly signal: AbortSignal;
}

/** Một giá trị trường đã chuẩn bị, kèm pha chốt (commit) tuỳ chọn sau khi provider nhận 2xx. */
export interface PreparedDeepSeekLlmApiExtension<T extends DeepSeekLlmApiJson> {
  /** Giá trị đã tách khỏi thân request, sẽ được gộp dưới tên trường đã đăng ký. */
  readonly value: T;
  /** Trạng thái chốt chỉ chạy khi provider đã xác nhận nhận request. */
  accept?(): void | Promise<void>;
}

/** Nhà cung cấp đăng ký dưới một khoá của {@link DeepSeekLlmApiExtensionMap}. */
export interface DeepSeekLlmApiExtensionProvider<T extends DeepSeekLlmApiJson> {
  /**
   * Chuẩn bị một trường cho một request đã tuần tự hoá chính xác.
   * Nhận: sự thật request nền bất biến.
   * Trả: trường đã chuẩn bị, hoặc `undefined` khi request này không có giá trị cho trường đó.
   */
  prepare(
    request: DeepSeekLlmApiExtensionRequest,
  ): PreparedDeepSeekLlmApiExtension<T> | undefined | Promise<PreparedDeepSeekLlmApiExtension<T> | undefined>;
}

/** Mọi trường đã chuẩn bị cho một request, kèm giao dịch chấp nhận chung của chúng. */
export interface PreparedDeepSeekLlmApiExtensions {
  /** Các trường top-level đã tách khỏi thân request, để gộp vào thân nền. */
  readonly fields: Readonly<Partial<DeepSeekLlmApiExtensionMap>>;
  /**
   * Chốt mọi nhà cung cấp đã bắt được, sau khi HTTP trả 2xx. Gọi lặp lại thì cùng một lần kết toán.
   * Trả: lời hứa hoàn tất khi MỌI lần chốt thành công.
   */
  accept(): Promise<void>;
}
