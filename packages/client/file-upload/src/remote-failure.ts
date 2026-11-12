/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hàm tạo lỗi Remote cho các mã NGHIỆP VỤ của row file-upload. Bản gốc khai mã của mình
 *      bằng module augmentation ngay cạnh chỗ ném; package này khai seam theo CẤU TRÚC (luật 000d)
 *      nên ép kiểu ở ĐÚNG MỘT chỗ thay vì augment toàn cục.
 */

import { RemoteError } from "@deepseek-ai/dsh-typert-protocol";

/** Hình dạng constructor RemoteError khi mã nghiệp vụ chưa nằm trong từ vựng của chương trình tsc. */
type RemoteErrorConstructor = new (
  code: string,
  message: string,
  details: Record<string, unknown>,
  options?: ErrorOptions,
) => RemoteError;

/**
 * Tạo MỘT lỗi Remote nghiệp vụ (nhận diện xuyên realm bằng isDSHRemoteError).
 * @param code - mã lỗi ổn định trên dây.
 * @param message - chẩn đoán người đọc được.
 * @param details - chi tiết có cấu trúc theo mã lỗi.
 * @param options - tuỳ chọn chuẩn của Error (cause chỉ sống trong tiến trình).
 * @returns thực thể RemoteError.
 */
export function remoteFailure(code: string, message: string, details: Record<string, unknown>, options?: ErrorOptions): RemoteError {
  return new (RemoteError as unknown as RemoteErrorConstructor)(code, message, details, options);
}
