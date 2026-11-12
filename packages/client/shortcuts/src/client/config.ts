/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Doc cau hinh nho trong trang (thay cho schemastery o nua browser — khong nhung ca thu vien)
 */

import { DEFAULT_STOP_SEQUENCE_MS, MAX_STOP_SEQUENCE_MS } from "../ids.ts";

/** Cấu hình mà nửa host nhúng vào trang. */
export interface ShortcutPageConfig {
  /** Khoảng cách tối đa giữa hai lần Escape liên tiếp (ms). */
  stopSequenceMs: number;
  /** Các trường khác mà bản gốc vẫn chuyển tiếp nguyên vẹn. */
  [key: string]: unknown;
}

/**
 * Đọc và kiểm cấu hình nhúng trong trang. Hành vi khớp schema schemastery của bản gốc (ĐÃ ĐO):
 * thiếu/null ⇒ 500 · phải là số nguyên trong [1, 2147483646] · trường lạ được GIỮ nguyên.
 * Nhận: `value` — giá trị thô từ `__GBH_SHORTCUTS_CONFIG__`.
 * Trả: cấu hình đã kiểm.
 * @throws khi giá trị không phải bản ghi, hoặc `stopSequenceMs` sai kiểu/khoảng.
 */
export function readShortcutConfig(value: unknown): ShortcutPageConfig {
  if (value === null || value === undefined) return { stopSequenceMs: DEFAULT_STOP_SEQUENCE_MS };
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("expected object but got ");
  const record = value as Record<string, unknown>;
  const raw = record["stopSequenceMs"];
  if (raw === undefined || raw === null) return { ...record, stopSequenceMs: DEFAULT_STOP_SEQUENCE_MS };
  if (typeof raw !== "number") throw new Error(`$.stopSequenceMs expected number but got ${String(raw)}`);
  if (!Number.isInteger(raw)) throw new Error(`$.stopSequenceMs expected number multiple of 1 but got ${String(raw)}`);
  if (raw < 1) throw new Error(`$.stopSequenceMs expected number >= 1 but got ${String(raw)}`);
  if (raw > MAX_STOP_SEQUENCE_MS) {
    throw new Error(`$.stopSequenceMs expected number <= ${MAX_STOP_SEQUENCE_MS} but got ${String(raw)}`);
  }
  return { ...record, stopSequenceMs: raw };
}
