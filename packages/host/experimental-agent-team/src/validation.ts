/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Chuẩn hoá đầu vào dùng chung cho roster và lệnh task: requiredText + writeScope — port 1:1 lib/types/validation.js.
 */
import { TeamError } from "./error.ts";

/**
 * Chuẩn hoá một chuỗi bắt buộc do người viết.
 * Nhận: value — giá trị thô; field — tên trường chẩn đoán; maxLength — số ký tự tối đa sau chuẩn hoá.
 * Trả: văn bản đã trim, không rỗng.
 */
export function requiredText(value: string, field: string, maxLength: number): string {
  const text = value.trim();
  if (text.length === 0) throw new TeamError(field + " must be non-empty", "TEAM_INVALID_ARGUMENT");
  if (text.length > maxLength) throw new TeamError(field + " exceeds " + maxLength + " characters", "TEAM_INVALID_ARGUMENT");
  return text;
}

/**
 * Chuẩn hoá một tiền tố đường dẫn tương đối workspace (advisory, không phải lock).
 * Nhận: value — tiền tố người dùng viết. Trả: tiền tố chuẩn hoá, phân tách bằng dấu /.
 */
export function writeScope(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "").replace(/\/+$/u, "");
  const segments = normalized.split("/");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    /^[a-z]:/iu.test(normalized) ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new TeamError("invalid workspace-relative write scope " + JSON.stringify(value), "TEAM_INVALID_WRITE_SCOPE");
  }
  return normalized;
}
