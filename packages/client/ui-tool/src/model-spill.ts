/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Vung spill-policy cua row ui-tool: dinh dang va nhan dien notice ket qua da bi spill
 */

import { describeOmitted } from "./model-cards.ts";

/**
 * Dinh dang va nhan dien notice spill-policy da luu (browser-safe).
 * Nhan: khong co.
 * Tra: hang so/chuoi cua dinh dang notice.
 */

/** Dau mo menh de luoc bo trong notice. Nhan: khong co. Tra: chuoi "(". */
export const OPEN = "(";
/** Dau dong menh de luoc bo trong notice. Nhan: khong co. Tra: chuoi ")". */
export const CLOSE = ")";
/** Nhan vi tri luu ket qua day du. Nhan: khong co. Tra: chuoi nhan. */
export const LOCATION = " Full formatted result stored at: ";
/** Dau ngan giua notice va phan huong dan. Nhan: khong co. Tra: chuoi ". ". */
export const GUIDANCE_SEPARATOR = ". ";
/** Ngan cach giua cac notice lien tiep. Nhan: khong co. Tra: chuoi xuong dong doi. */
export const SEPARATOR = "\n\n";
/** Menh de luoc bo dang "exact" voi so dem 0 — mau de do vi tri so dem. Nhan: khong co. Tra: chuoi menh de. */
export const EXACT_OMISSION = describeOmitted({ kind: "exact", count: 0 }, "bytes");
/** Vi tri bat dau cua so dem trong EXACT_OMISSION. Nhan: khong co. Tra: chi so ky tu. */
export const COUNT_OFFSET = EXACT_OMISSION.indexOf("0");
/** Phan duoi sau so dem trong EXACT_OMISSION. Nhan: khong co. Tra: chuoi hau to. */
export const COUNT_SUFFIX = EXACT_OMISSION.slice(COUNT_OFFSET + 1);

/**
 * Nhan dien mot menh de luoc bo do thu vien nay viet: ban `exact` co so dem, ban `unknown`
 * khong so dem, ban `none` rong, va chap nhan ca menh de ` Omitted <n> images.` dung truoc.
 * Nhan: text — menh de ung vien da cat khoi notice bao quanh.
 * Tra: true neu menh de dung la mot trong cac cach viet luoc bo cua thu vien.
 */
export function isOmission(text: string): boolean {
  const imageNotice = / Omitted ([1-9][0-9]*) images\.$/.exec(text);
  if (imageNotice !== null) {
    if (!Number.isSafeInteger(Number(imageNotice[1]))) return false;
    text = text.slice(0, imageNotice.index);
  }
  if (text === describeOmitted({ kind: "none" }, "bytes") || text === describeOmitted({ kind: "unknown" }, "bytes")) return true;
  const count = Number(text.slice(COUNT_OFFSET, text.length - COUNT_SUFFIX.length));
  return Number.isSafeInteger(count) && count >= 0 && text === describeOmitted({
    kind: "exact",
    count
  }, "bytes");
}

/**
 * Recognize a final spill-policy notice in persisted text, including notice-only output.
 * This identifies the text convention, not authenticated tool-output origin.
 * @param text - complete recorded text result.
 * @returns whether a complete notice occupies the end of the result.
 */
export function hasSpillNotice(text: string): boolean {
  if (!text.endsWith(CLOSE)) return false;
  let start = 0;
  while (true) {
    const next = text.indexOf(`${SEPARATOR}${OPEN}`, start);
    const candidate = text.slice(start, next < 0 ? -1 : next);
    const location = candidate.indexOf(LOCATION, 1);
    if (candidate.startsWith(OPEN) && location >= 0 && isOmission(candidate.slice(1, location))) return text.indexOf(GUIDANCE_SEPARATOR, start + location + 34) >= 0;
    if (next < 0) return false;
    start = next + 2;
  }
}
