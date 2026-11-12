/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phan tich dia chi cho danh sach cho phep HTTP(S) cua trinh duyet o sidebar phai
 */

/** Do dai dia chi toi da duoc nhan; chan nay bao ve trang thai dieu huong da luu. */
export const MAX_BROWSER_URL_LENGTH = 16384;

/** Mot dich dieu huong da chuan hoa cua trinh duyet. */
export type BrowserTarget =
  | { readonly kind: "https"; readonly url: string; readonly title: string }
  | { readonly kind: "http"; readonly url: string; readonly title: string };

/** Ly do mot dia chi bi tu choi truoc khi dieu huong. */
export type BrowserAddressFailure = "empty" | "invalid" | "protocol" | "credentials" | "application-origin";

/** Ket qua phan tich mot gia tri trong o dia chi. */
export type BrowserAddressResult =
  | { readonly ok: true; readonly target: BrowserTarget }
  | { readonly ok: false; readonly reason: BrowserAddressFailure };

/** Mau nhan dien mot chuoi da co scheme (khong tinh dang "example.com:8080"). */
const HAS_SCHEME = /^[A-Za-z][A-Za-z\d+.-]*:(?!\d+(?:[/?#]|$))/u;

/**
 * Phan tich mot gia tri trong o dia chi vao danh sach giao thuc co dinh.
 * Nhan: input — gia tri nguoi dung go hoac dia chi mo bang lenh; applicationOrigin — goc tai lieu DSH hien tai.
 * Tra: dich da chuan hoa, hoac ly do tu choi.
 */
export function parseBrowserAddress(input: string, applicationOrigin?: string): BrowserAddressResult {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };
  if (trimmed.length > MAX_BROWSER_URL_LENGTH) return { ok: false, reason: "invalid" };
  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : "https://" + trimmed;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (parsed.username !== "" || parsed.password !== "") return { ok: false, reason: "credentials" };
  if (parsed.protocol === "https:" || parsed.protocol === "http:") {
    if (applicationOrigin !== undefined && applicationOrigin !== "null") {
      try {
        if (parsed.origin === new URL(applicationOrigin).origin) return { ok: false, reason: "application-origin" };
      } catch {
        // Goc ung dung khong phan tich duoc thi bo qua phep chan nay (nguyen van ban goc).
      }
    }
    return {
      ok: true,
      target: {
        kind: parsed.protocol === "https:" ? "https" : "http",
        url: parsed.href,
        title: parsed.hostname,
      },
    };
  }
  return { ok: false, reason: "protocol" };
}
