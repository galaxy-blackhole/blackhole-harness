/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Định dạng và NHẬN DẠNG thông báo tràn đã ghi bền — an toàn cho cả môi trường browser (không
 *      dùng builtin `node:` nào); chữ của thông báo là QUY ƯỚC ĐÃ LƯU nên phải trùng nguyên văn bản gốc.
 */

import { describeOmitted } from "@galaxy-blackhole/gbh-output-retention";
import type { Omitted } from "@galaxy-blackhole/gbh-output-retention";
import type { SpillNoticeRef } from "./types.ts";

/** Dấu mở đầu thông báo. */
const OPEN = "(";
/** Dấu kết thúc thông báo. */
const CLOSE = ")";
/** Nhãn vị trí bản đầy đủ. */
const LOCATION = " Full formatted result stored at: ";
/** Dấu phân cách giữa định vị và câu hướng dẫn đọc lại. */
const GUIDANCE_SEPARATOR = ". ";
/** Dấu phân cách giữa phần xem trước và thông báo. */
const SEPARATOR = "\n\n";
/** Câu mô tả số byte bị bỏ khi số đó bằng 0 — mốc để cắt/ghép lại số đã lưu. */
const EXACT_OMISSION = describeOmitted({ kind: "exact", count: 0 }, "bytes");
/** Vị trí chữ số trong câu mốc. */
const COUNT_OFFSET = EXACT_OMISSION.indexOf("0");
/** Phần đuôi sau chữ số trong câu mốc. */
const COUNT_SUFFIX = EXACT_OMISSION.slice(COUNT_OFFSET + 1);

/**
 * Định dạng thông báo gắn sau phần xem trước đã giữ, giữ nguyên cách viết đã lưu.
 * Nhận: số byte bị bỏ, tham chiếu đọc lại (định vị + câu hướng dẫn), và số ảnh nguyên chiếc bị bỏ.
 * Trả: câu thông báo đầy đủ, KHÔNG kèm dấu phân cách phía trước.
 */
export function formatSpillNotice(omitted: Omitted, ref: SpillNoticeRef, images = 0): string {
  const imageNotice = images > 0 ? " Omitted " + String(images) + " images." : "";
  return OPEN + describeOmitted(omitted, "bytes") + imageNotice + LOCATION + ref.locator + GUIDANCE_SEPARATOR + ref.retrievalHint + CLOSE;
}

/**
 * Nhận dạng phần mô tả số bị bỏ trong một thông báo.
 * Nhận: chữ nằm giữa dấu mở và nhãn vị trí.
 * Trả: `true` khi đó là câu mô tả hợp lệ (không bỏ, không rõ số, hoặc số chính xác kèm số ảnh).
 */
function isOmission(text: string): boolean {
  let rest = text;
  const imageNotice = / Omitted ([1-9][0-9]*) images\.$/.exec(rest);
  if (imageNotice !== null) {
    const digits = imageNotice[1];
    if (digits === undefined || !Number.isSafeInteger(Number(digits))) return false;
    rest = rest.slice(0, imageNotice.index);
  }
  if (rest === describeOmitted({ kind: "none" }, "bytes") || rest === describeOmitted({ kind: "unknown" }, "bytes")) return true;
  const count = Number(rest.slice(COUNT_OFFSET, rest.length - COUNT_SUFFIX.length));
  return Number.isSafeInteger(count) && count >= 0 && rest === describeOmitted({ kind: "exact", count }, "bytes");
}

/**
 * Nhận dạng một thông báo tràn nằm ở CUỐI chữ đã ghi bền, kể cả kết quả chỉ có thông báo.
 * Đây là nhận dạng QUY ƯỚC CHỮ, không phải chứng thực nguồn gốc kết quả tool.
 * Nhận: toàn bộ chữ của một kết quả đã ghi.
 * Trả: `true` khi một thông báo trọn vẹn chiếm phần cuối của kết quả.
 */
export function hasSpillNotice(text: string): boolean {
  if (!text.endsWith(CLOSE)) return false;
  let start = 0;
  for (;;) {
    const next = text.indexOf(SEPARATOR + OPEN, start);
    const candidate = text.slice(start, next < 0 ? -CLOSE.length : next);
    const location = candidate.indexOf(LOCATION, OPEN.length);
    if (candidate.startsWith(OPEN) && location >= 0 && isOmission(candidate.slice(OPEN.length, location))) {
      return text.indexOf(GUIDANCE_SEPARATOR, start + location + LOCATION.length) >= 0;
    }
    if (next < 0) return false;
    start = next + SEPARATOR.length;
  }
}
