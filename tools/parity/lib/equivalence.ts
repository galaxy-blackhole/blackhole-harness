/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bảng tương đương gói đọc từ docs/PARITY-MATRIX.md: đổi tên gói không tính là lệch hành vi
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "./paths.ts";

/** Một dòng ánh xạ DSH → gbh lấy từ ma trận parity. */
export interface EquivalenceRow {
  /** id row trong cây plugin. */
  rowId: string;
  /** Tên package bên DSH/oracle. */
  dsh: string;
  /** Tên package tương ứng của ta. */
  ours: string;
  /** Bằng chứng hành vi ghi trong cột "Test đang canh" của ma trận. */
  evidence: string;
  /** true khi bằng chứng không rỗng và tìm được file hợp đồng/test tương ứng. */
  verified: boolean;
  /** Đường dẫn file bằng chứng tìm được (nếu có). */
  evidenceFile: string | null;
}

/** Bảng tương đương đã nạp. */
export interface EquivalenceTable {
  /** File nguồn (tương đối repo). */
  source: string;
  /** Số dòng đọc được. */
  rows: number;
  /** Tra theo tên package DSH (giữ tất cả dòng cùng tên). */
  byDsh: Map<string, EquivalenceRow>;
  /** Mọi tên "của ta" đã khai cho một tên DSH (một DSH có thể có nhiều subpath). */
  oursByDsh: Map<string, Set<string>>;
  /** Tra theo id row. */
  byRowId: Map<string, EquivalenceRow>;
  /** Cảnh báo khi đọc ma trận (thiếu cột, dòng hỏng…). */
  issues: string[];
}

/** Đường dẫn ma trận parity trong repo. */
export const MATRIX_FILE = join(REPO_ROOT, "docs", "PARITY-MATRIX.md");

/**
 * Bóc các ô của một dòng bảng Markdown.
 * @param line dòng bảng (bắt đầu và kết thúc bằng `|`).
 * @returns mảng ô đã trim, hoặc rỗng nếu không phải dòng bảng.
 */
export function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Bỏ dấu backtick bao quanh một ô.
 * @param cell nội dung ô.
 * @returns chuỗi đã bỏ backtick và trim.
 */
export function stripCode(cell: string): string {
  let out = cell.trim();
  while (out.startsWith("`")) out = out.slice(1);
  while (out.endsWith("`")) out = out.slice(0, -1);
  return out.trim();
}

/**
 * Tìm file bằng chứng cho một mã hợp đồng/test (ví dụ `C3`) trong repo.
 * @param evidence giá trị cột "Test đang canh".
 * @returns đường dẫn tương đối repo, hoặc null.
 */
export function findEvidenceFile(evidence: string): string | null {
  const code = evidence.trim().toUpperCase();
  if (code === "" || code === "—" || code === "-") return null;
  const first = code.split(/[^A-Z0-9]+/u).find((token) => token.length > 0);
  if (first === undefined) return null;
  const needles = [first.toLowerCase()];
  const roots = [join(REPO_ROOT, "docs", "contracts"), join(REPO_ROOT, "tests")];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const found = searchFile(root, needles, 0);
    if (found !== null) return found;
  }
  return null;
}

/**
 * Duyệt đệ quy tìm file có tên chứa một trong các khoá.
 * @param dir thư mục bắt đầu.
 * @param needles các khoá cần tìm trong tên file.
 * @param depth độ sâu hiện tại.
 * @returns đường dẫn tương đối repo, hoặc null.
 */
function searchFile(dir: string, needles: readonly string[], depth: number): string | null {
  if (depth > 3) return null;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (entry.includes("node_modules")) continue;
    if (entry.includes(".")) {
      const lower = entry.toLowerCase();
      if (needles.some((needle) => lower.includes(needle))) return full.slice(REPO_ROOT.length + 1);
      continue;
    }
    const nested = searchFile(full, needles, depth + 1);
    if (nested !== null) return nested;
  }
  return null;
}

/**
 * Nạp bảng tương đương từ `docs/PARITY-MATRIX.md` (nguồn duy nhất, không hard-code).
 * @param file đường dẫn ma trận.
 * @returns bảng tra cứu + cảnh báo.
 */
export function loadEquivalenceTable(file: string = MATRIX_FILE): EquivalenceTable {
  const issues: string[] = [];
  const byDsh = new Map<string, EquivalenceRow>();
  const byRowId = new Map<string, EquivalenceRow>();
  const oursByDsh = new Map<string, Set<string>>();
  if (!existsSync(file)) {
    return {
      source: file.slice(REPO_ROOT.length + 1),
      rows: 0,
      byDsh,
      oursByDsh,
      byRowId,
      issues: ["không thấy ma trận parity: " + file],
    };
  }
  const lines = readFileSync(file, "utf8").split("\n");
  let headerCells: string[] | null = null;
  for (const line of lines) {
    const cells = splitTableRow(line);
    if (cells.length < 5) continue;
    if (cells[0] === "#") {
      headerCells = cells;
      continue;
    }
    if (headerCells === null) continue;
    if (cells.every((cell) => cell.startsWith("---") || cell === "")) continue;
    const rowId = stripCode(cells[1] ?? "");
    const dsh = stripCode(cells[2] ?? "");
    const ours = stripCode(cells[3] ?? "");
    const evidenceIndex = headerCells.findIndex((header) => header.toLowerCase().includes("test"));
    const evidence = evidenceIndex === -1 ? "" : (cells[evidenceIndex] ?? "");
    if (rowId === "" || dsh === "" || ours === "") continue;
    const evidenceFile = findEvidenceFile(evidence);
    const row: EquivalenceRow = {
      rowId,
      dsh,
      ours,
      evidence,
      verified: evidence.trim() !== "" && evidence.trim() !== "—" && evidenceFile !== null,
      evidenceFile,
    };
    if (!byDsh.has(dsh)) byDsh.set(dsh, row);
    const known = oursByDsh.get(dsh) ?? new Set<string>();
    known.add(ours);
    oursByDsh.set(dsh, known);
    if (byRowId.has(rowId)) issues.push("id row trùng trong ma trận: " + rowId);
    byRowId.set(rowId, row);
  }
  if (byDsh.size === 0) issues.push("ma trận không có dòng ánh xạ nào (kiểm tra lại cột)");
  return { source: file.slice(REPO_ROOT.length + 1), rows: byDsh.size, byDsh, oursByDsh, byRowId, issues };
}

/**
 * Tên của ta có phải bản tương ứng đã khai của tên ref hay không.
 * Tên không có trong bảng → false (vẫn tính là ĐỔI, đúng rào chắn của Lead).
 * @param table bảng tương đương.
 * @param refName tên package bên ref.
 * @param oursName tên package bên ta.
 * @returns true khi đây là cặp đã khai trong ma trận.
 */
export function isEquivalentName(table: EquivalenceTable, refName: string, oursName: string): boolean {
  if (refName === oursName) return true;
  const known = table.oursByDsh.get(refName);
  return known !== undefined && known.has(oursName);
}

/**
 * Lấy dòng ánh xạ theo tên ref.
 * @param table bảng tương đương.
 * @param refName tên package bên ref.
 * @returns dòng ánh xạ, hoặc null.
 */
export function equivalenceFor(table: EquivalenceTable, refName: string): EquivalenceRow | null {
  return table.byDsh.get(refName) ?? null;
}
