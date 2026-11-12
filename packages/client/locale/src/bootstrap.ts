/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Du lieu khoi tao ngon ngu do vo native (Tauri) cấp qua cau preload IPC
 */

/** Dữ liệu khởi tạo đã kiểm: thứ tự ngôn ngữ của hệ điều hành + lựa chọn đã lưu (nếu có). */
export interface LocaleBootstrap {
  /** Thứ tự ngôn ngữ mà hệ điều hành báo. */
  languages: string[];
  /** Lựa chọn đã lưu, hoặc `null` khi chưa từng chọn. */
  preference: string | null;
}

/** Cầu preload mà nửa native (Tauri) có thể cài trên `globalThis`. */
export interface LocaleBridge {
  /**
   * Đọc dữ liệu khởi tạo.
   * Nhận: không.
   * Trả: giá trị CHƯA kiểm (sẽ qua {@link parseLocaleBootstrap}).
   */
  read(): Promise<unknown>;
  /**
   * Báo cho nửa native biết ngôn ngữ đang hiện.
   * Nhận: `active` — id ngôn ngữ.
   * Trả: không.
   */
  onChange(active: string): void;
}

/**
 * Kiểm dữ liệu khởi tạo nhận qua cầu preload IPC (không có tác dụng phụ về lưu trữ).
 * Nhận: `value` — phản hồi IPC chưa tin được.
 * Trả: dữ liệu khởi tạo đã tách khỏi đầu vào.
 * @throws {TypeError} khi hình dạng sai.
 */
export function parseLocaleBootstrap(value: unknown): LocaleBootstrap {
  if (
    typeof value !== "object" ||
    value === null ||
    !("languages" in value) ||
    !Array.isArray((value as { languages: unknown }).languages) ||
    !(value as { languages: unknown[] }).languages.every((language) => typeof language === "string") ||
    !("preference" in value) ||
    ((value as { preference: unknown }).preference !== null && typeof (value as { preference: unknown }).preference !== "string")
  ) {
    throw new TypeError("locale: invalid native initialization data");
  }
  return {
    languages: [...((value as { languages: string[] }).languages)],
    preference: (value as { preference: string | null }).preference,
  };
}
