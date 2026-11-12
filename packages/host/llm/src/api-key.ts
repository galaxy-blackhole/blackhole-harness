/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng api-key của @deepseek-ai/dsh-llm — port 1:1 lib/index.js dòng 475–516 (nguồn per-file:
 *      lib/types/api-key.js 33 dòng): regex vận chuyển header + normalizeApiKey. Vùng này KHÔNG có
 *      `assertUsableApiKey` và KHÔNG có `INVALID_CREDENTIAL_CODE` (xem README mục 3).
 */

/**
 * The one definition of a well-formed provider API key, shared by every
 * adapter that puts one in an HTTP header.
 * @module @deepseek-ai/dsh-llm/api-key
 */

/**
 * Characters an HTTP header value carries verbatim and every known provider
 * key uses: printable ASCII, space excluded. A key outside this set cannot
 * reach any provider — `fetch` refuses to build the header — so this is a
 * transport invariant rather than one provider's policy. Latin-1 is excluded
 * deliberately: a header could carry it, but no provider issues it, and
 * admitting it trades a local explained refusal for an opaque 401.
 */
const LEGAL_API_KEY = /^[\x21-\x7E]+$/;

/** Why a supplied API key cannot be used. */
export type ApiKeyRejection = "empty" | "illegalCharacters";

/** The verdict on one supplied API key. */
export type ApiKeyCheck =
  | {
      readonly ok: true;
      readonly value: string;
    }
  | {
      readonly ok: false;
      readonly reason: ApiKeyRejection;
    };

/**
 * Judge one *supplied* API key, trimming surrounding whitespace first.
 *
 * Trimming is silent because a padded key has one unambiguous reading; every
 * other defect is reported. Absence is a configuration state this function
 * never sees — a profile naming no credential authenticates through the
 * provider's own ambient discovery or OAuth — so callers decide whether a
 * value was supplied before asking.
 * @param raw - the key exactly as configured, stored, or typed.
 * @returns the trimmed key, or why it cannot be used.
 */
export function normalizeApiKey(raw: string): ApiKeyCheck {
  const value = raw.trim();
  if (value.length === 0) return {
    ok: false,
    reason: "empty",
  };
  if (!LEGAL_API_KEY.test(value)) return {
    ok: false,
    reason: "illegalCharacters",
  };
  return {
    ok: true,
    value,
  };
}
