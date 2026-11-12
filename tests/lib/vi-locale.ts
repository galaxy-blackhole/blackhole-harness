/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hai hàm dùng chung cho test đối chứng từ điển: bỏ ngôn ngữ "vi" (phần THÊM CÓ CHỦ ĐÍCH)
 *   trước khi so với bundle gốc, và lấy bảng tiếng Việt của TA để khẳng định nó có mặt.
 */

/** Một dòng từ điển đã ghi lại: namespace + bảng theo ngôn ngữ (hình dạng tuỳ gói ghi lại). */
export interface DictionaryEntry {
  /** Namespace được đăng ký. */
  namespace: string;
  /** Bảng chữ theo ngôn ngữ; `unknown` vì mỗi gói ghi lại một hình dạng hơi khác nhau. */
  copy?: unknown;
}

/**
 * Bỏ ngôn ngữ "vi" khỏi các dòng từ điển để so PHẦN CHUNG với bundle gốc.
 *
 * Vì sao cần: bản gốc chỉ có zh+en; Galaxy Blackhole THÊM vi cho toàn bộ giao diện (yêu cầu chủ dự án
 * 18/10/2026). Test đối chứng phải so phần chung, và khẳng định riêng rằng vi CÓ mặt (hàm dưới).
 * @param entries - các dòng từ điển đã ghi lại.
 * @returns các dòng đã bỏ khoá "vi" (không sửa đầu vào).
 */
export function withoutVi<T extends DictionaryEntry>(entries: readonly T[]): unknown[] {
  return entries.map((entry) => {
    const copy = (entry.copy ?? {}) as Record<string, unknown>;
    const { vi, ...rest } = copy;
    void vi;
    return { ...entry, copy: rest };
  });
}

/**
 * Lấy bảng tiếng Việt của một namespace trong danh sách đã ghi lại.
 * @param entries - các dòng từ điển đã ghi lại.
 * @param namespace - namespace cần lấy (bỏ trống: lấy dòng ĐẦU TIÊN có vi).
 * @returns bảng vi, hoặc undefined khi không có.
 */
export function viDictionary(entries: readonly DictionaryEntry[], namespace?: string): Record<string, string> | undefined {
  const copyOf = (entry: DictionaryEntry): Record<string, Record<string, string>> => (entry.copy ?? {}) as Record<string, Record<string, string>>;
  const match = namespace === undefined
    ? entries.find((entry) => copyOf(entry).vi !== undefined)
    : entries.find((entry) => entry.namespace === namespace);
  return match === undefined ? undefined : copyOf(match).vi;
}