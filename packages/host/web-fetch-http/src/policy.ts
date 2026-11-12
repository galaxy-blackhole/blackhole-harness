/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chính sách URL + phân loại Content-Type của provider fetch HTTP(S) — nửa THUẦN, không mạng
 */

import { WebError } from "@deepseek-ai/dsh-web";
import { WEB_FETCH_MAX_URL_LENGTH } from "./ids.ts";

/**
 * Phân tích URL yêu cầu và áp các giới hạn KHÔNG liên quan mạng: chỉ HTTP(S), không nhúng thông tin đăng nhập.
 * @param input chuỗi URL thô từ yêu cầu fetch.
 * @returns URL đã phân tích.
 */
export function parseFetchUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch (error) {
    throw new WebError(`invalid URL: ${input}`, "WEB_INVALID_URL", { cause: error });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new WebError(`unsupported URL scheme "${url.protocol}" (only http and https are allowed)`, "WEB_INVALID_URL");
  }
  if (url.username.length > 0 || url.password.length > 0) throw new WebError("credentials in URLs are not allowed", "WEB_BLOCKED_URL");
  return url;
}

/**
 * Kiểm URL theo TOÀN BỘ chính sách trước khi chạm mạng: độ dài có trần + các giới hạn của parseFetchUrl.
 * @param input chuỗi URL thô từ yêu cầu fetch.
 * @returns URL đã phân tích.
 */
export function validateFetchUrl(input: string): URL {
  if (input.length > WEB_FETCH_MAX_URL_LENGTH) {
    throw new WebError(`URL exceeds the maximum length of ${WEB_FETCH_MAX_URL_LENGTH}`, "WEB_INVALID_URL");
  }
  return parseFetchUrl(input);
}

/**
 * Hai URL cùng origin khi scheme, hostname và port trùng nhau.
 * @param a URL thứ nhất.
 * @param b URL thứ hai.
 * @returns true khi cùng origin.
 */
export function isSameOrigin(a: URL, b: URL): boolean {
  return a.protocol === b.protocol && a.hostname === b.hostname && a.port === b.port;
}

/**
 * Phân loại Content-Type thành loại thân đọc được ("html" | "text"), hoặc undefined cho loại không hỗ trợ.
 * @param contentType giá trị header Content-Type, hoặc null khi vắng.
 * @returns loại đọc được, hoặc undefined.
 */
export function classifyContentType(contentType: string | null): "html" | "text" | undefined {
  const mime = (contentType ?? "").replace(/;.*$/s, "").trim().toLowerCase();
  if (mime === "text/html" || mime === "application/xhtml+xml") return "html";
  if (mime.startsWith("text/")) return "text";
  if (mime === "application/json" || mime === "application/xml" || mime.endsWith("+json") || mime.endsWith("+xml")) return "text";
  return undefined;
}

/**
 * Lấy tham số charset trong Content-Type (chữ thường), hoặc undefined khi vắng.
 * @param contentType giá trị header Content-Type, hoặc null.
 * @returns nhãn charset chữ thường, hoặc undefined.
 */
export function parseCharset(contentType: string | null): string | undefined {
  return /;\s*charset\s*=\s*"?([^";]+)"?/i.exec(contentType ?? "")?.[1]?.trim().toLowerCase();
}

/**
 * Dựng TextDecoder cho charset đã khai; vắng thì UTF-8; nhãn lạ ⇒ WebError WEB_UNSUPPORTED_CONTENT_TYPE.
 * @param charset nhãn charset (từ parseCharset), hoặc undefined.
 * @returns decoder cho encoding đã khai (hoặc mặc định).
 */
export function decoderForCharset(charset: string | undefined): TextDecoder {
  if (charset === undefined) return new TextDecoder("utf-8");
  try {
    return new TextDecoder(charset);
  } catch (error) {
    throw new WebError(`unsupported charset "${charset}"`, "WEB_UNSUPPORTED_CONTENT_TYPE", { cause: error });
  }
}
