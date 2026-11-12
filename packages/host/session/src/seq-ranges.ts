/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Mã hoá/giải mã dải seq không mất mát cho JSONL sourceEventSeqs (port 1:1 seq-ranges.js).
 */
import { SessionSeq } from "./types.ts";
import type { SessionSeq as SessionSeqType } from "./types.ts";

/** Một seq đã lưu, hoặc một cặp bao đóng [start, end] của dải liên tiếp. */
export type EncodedSeq = number | [number, number];

/**
 * Kiểm dãy có tăng NGHIÊM NGẶT hay không.
 * Nhận: values — dãy số. Trả: true khi mỗi phần tử lớn hơn phần tử trước.
 */
function isStrictlyIncreasing(values: readonly number[]): boolean {
  return values.every((value, index) => index === 0 || value > (values[index - 1] as unknown as number));
}

/**
 * Thay các RUN liên tiếp có lợi bằng cặp bao đóng [start, end].
 * Nhận: values — seq đã kiểm trong bộ nhớ. Trả: dạng lưu JSON không mất mát.
 */
export function encodeSeqRanges(values: readonly SessionSeqType[]): EncodedSeq[] {
  if (!isStrictlyIncreasing(values)) return [...values];
  const encoded: EncodedSeq[] = [];
  for (let start = 0; start < values.length;) {
    let end = start;
    while (end + 1 < values.length && (values[end + 1] as unknown as number) === (values[end] as unknown as number) + 1) end += 1;
    if (end - start >= 2) encoded.push([values[start] as unknown as number, values[end] as unknown as number]);
    else for (let index = start; index <= end; index += 1) encoded.push(values[index] as unknown as number);
    start = end + 1;
  }
  return encoded;
}

/**
 * Mở rộng mảng sourceEventSeqs dạng lưu JSON.
 * Nhận: value — giá trị đã parse; maxEntries — trần danh sách do event sở hữu cho phép.
 * Trả: seq trong bộ nhớ.
 */
export function decodeSeqRanges(value: unknown, maxEntries: number = Number.MAX_SAFE_INTEGER): SessionSeqType[] {
  if (!Array.isArray(value)) throw new TypeError("sourceEventSeqs must be an array");
  const decoded: SessionSeqType[] = [];
  let hasRange = false;
  for (const entry of value) {
    if (typeof entry === "number") {
      assertSeq(entry);
      if (decoded.length >= maxEntries) throw new TypeError("sourceEventSeqs exceeds its event sequence");
      decoded.push(SessionSeq(entry));
      continue;
    }
    if (!Array.isArray(entry) || entry.length !== 2) throw new TypeError("sourceEventSeqs range entries must be [start, end] pairs");
    const start = entry[0] as number;
    const end = entry[1] as number;
    assertSeq(start);
    assertSeq(end);
    if (end < start) throw new TypeError("sourceEventSeqs ranges require start <= end");
    const length = end - start + 1;
    if (length > maxEntries - decoded.length) throw new TypeError("sourceEventSeqs range exceeds its event sequence");
    for (let seq = start; seq <= end; seq += 1) decoded.push(SessionSeq(seq));
    hasRange = true;
  }
  if (hasRange && !isStrictlyIncreasing(decoded as unknown as number[])) throw new TypeError("sourceEventSeqs ranges must be strictly increasing");
  return decoded;
}

/**
 * Kiểm một phần tử là seq hợp lệ.
 * Nhận: value — giá trị cần kiểm. Trả: không; ném khi không phải số nguyên an toàn không âm.
 */
function assertSeq(value: unknown): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new TypeError("sourceEventSeqs must contain non-negative safe integers");
}