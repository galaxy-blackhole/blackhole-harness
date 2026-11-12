/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bản viết lại của chunk `public-url` trong bundle gốc của row `web-startup`: kiểm tra và
 *      chuẩn hoá gốc HTTP(S) công khai mà cờ `--public-url` quảng bá.
 */

/**
 * Phân tích gốc HTTP(S) công khai của một triển khai proxy cắt tiền tố.
 *
 * Từ chối đúng những cái bẫy mà bộ phân tích WHATWG tự nó CHẤP NHẬN, rồi chuẩn hoá pathname
 * kết thúc bằng `/` (bản gốc trả về URL đã chuẩn hoá; người gọi chỉ dùng để KIỂM, giá trị công bố
 * vẫn là chuỗi thô).
 * @param value - gốc HTTP(S) công khai được quảng bá.
 * @param label - tên trường hoặc cờ CLI xuất hiện trong thông điệp từ chối.
 * @returns URL đã phân tích, với pathname kết thúc bằng `/`.
 * @throws khi giá trị không phải gốc dùng được, kèm lý do cụ thể.
 */
export function parsePublicUrl(value: string, label = "publicUrl"): URL {
  if (/[\u0000-\u0020\u007f]/u.test(value)) throw new Error(`${label} must not contain ASCII whitespace or control characters`);
  if (!/^https?:\/\//iu.test(value)) throw new Error(`${label} must be an absolute http or https URL of the form http(s)://host[/prefix]`);
  if (value.includes("?") || value.includes("#")) throw new Error(`${label} must not include a query or fragment (? or #)`);
  const [authority = ""] = value.slice(value.indexOf("://") + 3).split(/[/\\]/, 1);
  if (authority === "") throw new Error(`${label} must name a host after http:// or https://`);
  if (authority.includes("@")) {
    throw new Error(`${label} must not include credentials (a username or password before @, including an empty user)`);
  }
  const url = parseUrlOrNull(value);
  if (url === null) throw new Error(`${label} must be an absolute http or https URL`);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

/**
 * Bộ phân tích URL KHÔNG ném — cùng ngữ nghĩa với `URL.parse` mà bản gốc dùng.
 * Viết bằng `new URL` trong `try/catch` để không phụ thuộc phiên bản lib của runtime.
 * @param value - chuỗi cần phân tích.
 * @returns URL, hoặc null khi chuỗi không phải URL tuyệt đối hợp lệ.
 */
function parseUrlOrNull(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
