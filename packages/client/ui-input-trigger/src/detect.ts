/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng lib/types/core/detect.js của bản gốc — lõi thuần phát hiện trigger '/' và '@' dưới con trỏ
 */

import { activeAtToken } from "./grammar.ts";
import type { TriggerGuard, TriggerHit } from "./types.ts";

/** Ký tự thuộc một từ (chữ, số, gạch dưới) — nguyên văn lớp ký tự của bản gốc. */
const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** Khoảng trắng — nguyên văn của bản gốc. */
const WHITESPACE = /\s/u;

/**
 * Luật biên từ: ký tự kích hoạt chỉ mở ở đầu draft, sau khoảng trắng (kể cả xuống dòng),
 * hoặc sau dấu câu. Hai ngoại lệ URL giữ '/' chết trong URL (đều được test ghim): '/' sau ':'
 * mà bản thân ':' đứng sau ký tự không phải khoảng trắng (dấu phân cách scheme, https:/…), và
 * '/' ngay sau một '/' khác (dấu chéo thứ hai của //).
 * Nhận: draft — toàn văn bản nháp; index — vị trí ký tự kích hoạt; char — ký tự kích hoạt.
 * Trả: true khi được phép mở trigger ở vị trí đó.
 */
function boundaryOk(draft: string, index: number, char: string): boolean {
  if (index === 0) return true;
  const prev = draft.charAt(index - 1);
  if (WHITESPACE.test(prev)) return true;
  if (WORD_CHAR.test(prev)) return false;
  if (char === "/") {
    if (prev === "/") return false;
    if (prev === ":" && index >= 2 && !WHITESPACE.test(draft.charAt(index - 2))) return false;
  }
  return true;
}

/**
 * Phát hiện một token kích hoạt dưới con trỏ. '@' dùng ngữ pháp dùng chung trước, kể cả token
 * đang mở ngoặc kép có thể vắt qua khoảng trắng. Dò '/' quét sang trái tới khoảng trắng đầu tiên;
 * dấu '/' không qua được biên từ bị coi là ký tự thường và phép quét tiếp tục (dấu '/' trong URL).
 * Mức guard: plain = cả hai ký tự sống; claimed = '/' bị chặn hoàn toàn, '@' sống; frozen = không có gì.
 *
 * Nhận: draft — toàn văn bản nháp; caret — offset con trỏ trong draft; guard — mức sẵn sàng suy từ pha ô nhập.
 * Trả: hit với query = lát từ ký tự kích hoạt tới con trỏ và span = {start, end};
 *   span.draftRev là chỗ giữ 0 — tầng gọi đóng dấu revision thật. Null khi không có trigger sống dưới con trỏ.
 */
export const detectTrigger = (draft: string, caret: number, guard: TriggerGuard): TriggerHit | null => {
  if (guard.tier === "frozen") return null;
  const at = activeAtToken(draft, caret);
  if (at !== undefined) {
    const start = caret - at.prefix.length;
    return {
      trigger: "@",
      query: at.query,
      quoted: at.quoted,
      position: draft.search(/\S/) === start ? "leading" : "inline",
      span: {
        start,
        end: caret,
        draftRev: 0,
      },
    };
  }
  for (let i = caret - 1; i >= 0; i--) {
    const ch = draft.charAt(i);
    if (WHITESPACE.test(ch)) return null;
    if (ch !== "/") continue;
    if (guard.tier === "claimed") continue;
    if (!boundaryOk(draft, i, ch)) continue;
    return {
      trigger: ch,
      query: draft.slice(i + 1, caret),
      quoted: false,
      position: draft.search(/\S/) === i ? "leading" : "inline",
      span: {
        start: i,
        end: caret,
        draftRev: 0,
      },
    };
  }
  return null;
};
