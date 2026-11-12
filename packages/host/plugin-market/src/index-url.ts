/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 'lib/types/index-url.js' của @deepseek-ai/dsh-plugin-market (vùng lib/index.js dòng 10–39):
 *      validate + chuẩn hoá MỘT URL nguồn index (chỉ http/https, không credentials, không fragment) và ném
 *      RemoteError mã 'plugin-market/invalid-index-url' với đúng 3 nhánh reason: not-absolute · scheme ·
 *      credentials-or-fragment. RemoteError import từ @deepseek-ai/dsh-typert-protocol, KHÔNG port lại.
 */
import { RemoteError } from "@deepseek-ai/dsh-typert-protocol";

/** Index source URL validation shared by `setIndexes` and the per-use check of configured sources. */
/**
 * Validate and normalize one index source URL.
 * @param text - URL as configured or entered.
 * @returns the URL's serialization.
 * @throws {RemoteError} `plugin-market/invalid-index-url` for anything but an http(s) URL without credentials or
 * fragment.
 */
export function normalizeIndexUrl(text: string): string {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    // Bản gốc khai mã lỗi bằng `declare module` trên `RemoteErrorDetailsMap`; repo CẤM `declare module`
    // (luật 000d) ⇒ ép kiểu tại ĐÚNG ba chỗ ném lỗi, giữ nguyên lớp lỗi, mã, thông điệp và chi tiết.
    throw new RemoteError(
      "plugin-market/invalid-index-url" as never,
      `Not an absolute URL: ${text}`,
      { url: text, reason: "not-absolute" } as never,
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new RemoteError(
      "plugin-market/invalid-index-url" as never,
      `Index URLs use http or https: ${text}`,
      { url: text, reason: "scheme" } as never,
    );
  if (url.username !== "" || url.password !== "" || url.href.includes("#"))
    throw new RemoteError(
      "plugin-market/invalid-index-url" as never,
      `Index URLs carry no credentials or fragment: ${text}`,
      { url: text, reason: "credentials-or-fragment" } as never,
    );
  return url.href;
}
