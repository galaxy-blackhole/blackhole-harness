/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào của package session-reference: xuất ĐÚNG bề mặt runtime của stock — dòng export
 *      `lib/index.js` 745 (10 ký hiệu) — trên bốn vùng đã port: `config.ts` (hằng + lỗi),
 *      `uri.ts` (scheme + mã hoá/giải mã + mention + bộ tách), và `service.ts` (class
 *      `SessionReferenceResolver` cùng `default`). Không xuất thêm gì khác.
 */

export { DEFAULT_CANDIDATE_LIMIT, DEFAULT_MAX_REFERENCE_BYTES, MAX_REFERENCES, SessionReferenceError } from "./config.ts";
export { SESSION_REFERENCE_SCHEME, decodeSessionReferenceUri, encodeSessionReferenceUri, formatSessionReferenceMention, parseSessionReferenceText } from "./uri.ts";
export { SessionReferenceResolver, SessionReferenceResolver as default } from "./service.ts";
