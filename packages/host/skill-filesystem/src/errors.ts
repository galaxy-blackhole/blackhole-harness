/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Lỗi và mã lỗi của skill-filesystem — giữ nguyên văn chuỗi/thứ tự kiểm của bundle gốc
 *      @galaxy-blackhole/gbh-skill-filesystem: nhận diện ENOENT/ENOTDIR/FS_NOT_FOUND/FS_NOT_DIRECTORY,
 *      và errorMessage dùng cho mọi cảnh báo.
 */

/**
 * Đổi một giá trị lỗi bất kỳ thành chuỗi y hệt bundle gốc (`String(error)`).
 * Nhận: error — giá trị lỗi chưa biết kiểu.
 * Trả: chuỗi mô tả lỗi (ví dụ "Error: ..." hoặc "TypeError: ...").
 */
export function errorMessage(error: unknown): string {
  return String(error);
}

/**
 * Kiểm một lỗi có mang đúng mã `code` hay không (chỉ nhận object không null).
 * Nhận: error — giá trị lỗi; code — mã cần so.
 * Trả: true khi error là object không null và `error.code === code`.
 */
export function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}

/**
 * Kiểm lỗi "đường dẫn không tồn tại" của Node.
 * Nhận: error — giá trị lỗi.
 * Trả: true với ENOENT hoặc ENOTDIR.
 */
export function isAbsentPathError(error: unknown): boolean {
  return hasErrorCode(error, "ENOENT") || hasErrorCode(error, "ENOTDIR");
}

/**
 * Kiểm lỗi "đường dẫn kỹ năng không tồn tại" của cả Node lẫn ctx.fs.
 * Nhận: error — giá trị lỗi.
 * Trả: true với ENOENT/ENOTDIR/FS_NOT_FOUND/FS_NOT_DIRECTORY.
 */
export function isAbsentSkillPathError(error: unknown): boolean {
  return isAbsentPathError(error) || hasErrorCode(error, "FS_NOT_FOUND") || hasErrorCode(error, "FS_NOT_DIRECTORY");
}
