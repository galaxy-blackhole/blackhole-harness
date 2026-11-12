/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng `lib/types/uri.js` của @deepseek-ai/dsh-session-reference (stock lib/index.js dòng 274–348):
 *      URI chuẩn `dsh-session:`, mã hoá/giải mã không mất mát, mention Markdown `@[label](uri)`, và bộ
 *      tách mention khỏi văn bản host (escapeLabel · unescapeLabel · invalidUri). Port 1:1, không đổi hành vi.
 */

import { brandString } from "@deepseek-ai/dsh-brand";
import type { SessionId } from "@galaxy-blackhole/gbh-session";

import { SessionReferenceError } from "./config.ts";

/**
 * Một phiên nguồn do host chọn. KIỂU TẠM — stock: `lib/types/types.d.ts` 36–42.
 * Nhận: không có (kiểu thuần).
 * Trả: `{ sessionId, label? }` — id phiên và nhãn hiển thị tuỳ chọn.
 */
export interface SessionReferenceInput {
  /** Danh tính phiên nguồn không trong suốt. */
  sessionId: SessionId;
  /** Nhãn mention do người dùng đặt, tuỳ chọn. */
  label?: string;
}

/**
 * Kết quả tách mention chuẩn khỏi văn bản thuần. KIỂU TẠM — stock: `lib/types/uri.d.ts` 25–30.
 * Nhận: không có (kiểu thuần).
 * Trả: `text` đã thay token + `references` theo thứ tự xuất hiện.
 */
export interface ParsedSessionReferenceText {
  /** Văn bản đã thay token mờ bằng khoảng `@label` đọc được. */
  text: string;
  /** Tham chiếu có cấu trúc theo thứ tự xuất hiện lần đầu, TRƯỚC khi service khử trùng. */
  references: SessionReferenceInput[];
}

/**
 * Scheme URI dành riêng cho ảnh chụp phiên của Galaxy Blackhole.
 * Nhận: không có (hằng chuỗi).
 * Trả: `dsh-session:` — đúng 12 ký tự, khớp phép cắt của {@link decodeSessionReferenceUri}.
 */
export const SESSION_REFERENCE_SCHEME = "dsh-session:";

/**
 * Mã hoá BẤT KỲ chuỗi id phiên JavaScript nào thành URI chuẩn không mất mát.
 * Nhận: `sessionId` — id phiên không trong suốt cần tuần tự hoá.
 * Trả: URI `dsh-session:` chuẩn (base64url của JSON chuỗi).
 */
export function encodeSessionReferenceUri(sessionId: SessionId): string {
  return `${SESSION_REFERENCE_SCHEME}${Buffer.from(JSON.stringify(sessionId), "utf8").toString("base64url")}`;
}

/**
 * Giải mã và chuẩn hoá MỘT URI tham chiếu phiên.
 * Nhận: `uri` — URI chuẩn đầy đủ.
 * Trả: id phiên đã giải mã; ném {@link SessionReferenceError} khi sai scheme, sai bảng chữ, không
 *        phải chuỗi JSON, hoặc khi mã hoá lại KHÔNG ra đúng URI ban đầu (không chuẩn).
 */
export function decodeSessionReferenceUri(uri: string): SessionId {
  if (!uri.startsWith("dsh-session:")) throw invalidUri(uri);
  const payload = uri.slice(12);
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) throw invalidUri(uri);
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof parsed !== "string") throw new TypeError("decoded session id is not a string");
    const sessionId = brandString<SessionId>(parsed);
    if (encodeSessionReferenceUri(sessionId) !== uri) throw new TypeError("URI is not canonical");
    return sessionId;
  } catch (error) {
    throw invalidUri(uri, error);
  }
}

/**
 * Dựng mention Markdown trung tính với host, mang URI chuẩn.
 * Nhận: `reference` — id có cấu trúc và nhãn hiển thị tuỳ chọn.
 * Trả: mention `@[label](uri)` đã escape nhãn.
 */
export function formatSessionReferenceMention(reference: SessionReferenceInput): string {
  return `@[${escapeLabel(reference.label ?? reference.sessionId)}](${encodeSessionReferenceUri(reference.sessionId)})`;
}

/**
 * Tách mention Markdown và URI chuẩn trần khỏi một giá trị văn bản.
 * Mention Markdown tường minh NÉM khi URI hỏng bất kỳ. Văn bản trần chỉ được coi là tham chiếu khi
 * payload có dạng base64url KHÔNG RỖNG, rồi vẫn ném nếu ứng viên đó không chuẩn.
 * Nhận: `text` — văn bản host cần chuẩn hoá.
 * Trả: văn bản đọc được và tham chiếu có cấu trúc theo thứ tự xuất hiện.
 */
export function parseSessionReferenceText(text: string): ParsedSessionReferenceText {
  const references: SessionReferenceInput[] = [];
  return {
    text: text.replace(
      /@\[((?:\\.|[^\\\]])*)\]\((dsh-session:[^\s)]*)\)|(dsh-session:[A-Za-z0-9_-]+)/gu,
      (
        _match: string,
        rawLabel: string | undefined,
        markdownUri: string | undefined,
        bareUri: string | undefined,
      ) => {
        const uri = markdownUri ?? bareUri;
        /* v8 ignore next -- the two-alternative regex always captures exactly one URI group. */
        if (uri === void 0)
          throw new SessionReferenceError(
            "session reference URI is missing",
            "SESSION_REFERENCE_INVALID_REFERENCE",
          );
        const sessionId = decodeSessionReferenceUri(uri);
        const label = rawLabel === void 0 ? sessionId : unescapeLabel(rawLabel);
        references.push({
          sessionId,
          label,
        });
        return `@${label}`;
      },
    ),
    references,
  };
}

/**
 * Escape nhãn mention: chỉ `\` và `]` được thêm dấu gạch chéo ngược — private y như stock.
 * Nhận: `label` — nhãn thô.
 * Trả: nhãn đã escape, ghép được vào `@[label](uri)`.
 */
function escapeLabel(label: string): string {
  return label.replace(/[\\\]]/gu, (match) => `\\${match}`);
}

/**
 * Giải escape nhãn mention: bỏ dấu gạch chéo ngược trước đúng MỘT ký tự — private y như stock.
 * Nhận: `label` — nhãn đã escape.
 * Trả: nhãn gốc.
 */
function unescapeLabel(label: string): string {
  return label.replace(/\\(.)/gu, "$1");
}

/**
 * Dựng lỗi URI không hợp lệ kèm mã `SESSION_REFERENCE_INVALID_REFERENCE` — private y như stock.
 * Nhận: `uri` — URI hỏng; `cause` — nguyên nhân tuỳ chọn.
 * Trả: {@link SessionReferenceError} để nơi gọi ném.
 */
function invalidUri(uri: string, cause?: unknown): SessionReferenceError {
  return new SessionReferenceError(
    `invalid session reference URI ${JSON.stringify(uri)}`,
    "SESSION_REFERENCE_INVALID_REFERENCE",
    cause === void 0 ? void 0 : { cause },
  );
}
