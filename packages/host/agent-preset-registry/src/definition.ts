/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểm danh sách entry Cordis đã parse (kể cả nhóm lồng nhau) — port 1:1 `entryListProblem`.
 */

import type { EntryRow } from "./types.ts";

/**
 * Tìm hàng entry ĐẦU TIÊN không hợp lệ trong danh sách đã parse, đi xuống cả nhóm lồng nhau.
 * Nhận: rows — giá trị YAML đã parse; at — tiền tố chẩn đoán (rỗng ở cấp gốc).
 * Trả: mô tả lỗi đầu tiên, hoặc undefined khi danh sách hợp lệ.
 */
export function entryListProblem(rows: unknown, at = ""): string | undefined {
  if (!Array.isArray(rows)) {
    return at === "" ? "the composition must be a top-level list of plugin rows" : "group " + at + " must hold a list of plugin rows";
  }
  for (const [index, value] of rows.entries()) {
    const label = at === "" ? "row " + String(index + 1) : at + " row " + String(index + 1);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return label + ' is not a plugin row (expected a map with a "name")';
    }
    const row = value as EntryRow;
    if (typeof row.name !== "string" || row.name === "") return label + ' names no plugin (a "name" string is required)';
    if (row.group === true) {
      const nested = entryListProblem(row.config, label);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}
