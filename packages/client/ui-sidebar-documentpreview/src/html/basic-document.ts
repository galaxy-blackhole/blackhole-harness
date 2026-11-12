/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ban xem HTML tinh: khong script, khong tai nguyen mang, khong bieu mau, khong khung long nhau
 */

import purify from "../../vendor/dompurify.mjs";
import { decodeText } from "./bytes.ts";

/** Chinh sach noi dung han che, dat dau tien trong head — nguyen van ban goc. */
export const BASIC_CSP = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";

/**
 * Chuan bi noi dung tinh truoc khi trinh duyet kip nap bat ky tai nguyen nao cua tai lieu.
 * Nhan: data — byte UTF-8 HTML day du.
 * Tra: tai lieu voi CSP han che nam dau head.
 */
export function createBasicHtmlDocument(data: Uint8Array): string {
  const clean = purify.sanitize(decodeText(data), {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: ["noscript", "base", "link", "meta", "iframe", "frame", "object", "embed", "set", "animate", "animateMotion", "animateTransform"],
    FORBID_ATTR: ["href", "xlink:href"],
  });
  const parsed = new DOMParser().parseFromString(clean, "text/html");
  const policy = parsed.createElement("meta");
  policy.setAttribute("http-equiv", "Content-Security-Policy");
  policy.setAttribute("content", BASIC_CSP);
  parsed.head.prepend(policy);
  return "<!doctype html>" + parsed.documentElement.outerHTML;
}
