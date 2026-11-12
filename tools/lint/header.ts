/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cong header: moi file nguon phai co khoi 5 dong author/email/create date/modify date/desc
 */

import {
  createResult,
  exitCodeFor,
  isDirectRun,
  partitionFiles,
  printResult,
  readLines,
  REPO_ROOT,
  toRel,
  USING_CUSTOM_ROOT,
  walkRepo,
  type CheckResult,
  type Violation,
} from "./shared.ts";
import { headerRuleFor, type CommentStyle } from "./exemptions.ts";

/** Số dòng đầu tiên được phép chứa khối header (main.rs có thuộc tính crate ở dòng 1). */
export const HEADER_WINDOW_LINES = 10;

/** Dấu hiệu để nhận ra một khối bình luận ĐÍCH THỊ là header (tránh nhầm JSDoc hàm đầu file). */
const HEADER_MARKER = /\b(author|email|create date|modify date|desc)\b/i;

/** Một trường bắt buộc của header: nhãn hiển thị + cách nhận diện trong khối bình luận. */
interface RequiredField {
  /** Nhãn tiếng Việt để in trong thông báo lỗi. */
  label: string;
  /** Chuỗi phải xuất hiện trong khối header (đã chuẩn hoá khoảng trắng). */
  needle: string;
  /** Mẫu kiểm tra mạnh hơn cho các trường có giá trị động. */
  pattern?: RegExp;
}

/** 5 trường bắt buộc, ĐÚNG thứ tự quy định ở AGENTS.md §1. */
const REQUIRED_FIELDS: RequiredField[] = [
  { label: "author Bùi Trọng Hiếu", needle: "author Bùi Trọng Hiếu" },
  { label: "email kevinbui210191@gmail.com", needle: "email kevinbui210191@gmail.com" },
  { label: "create date 15/10/2026 (cố định)", needle: "create date 15/10/2026" },
  { label: "modify date <dd/mm/yyyy>", needle: "modify date", pattern: /modify date \d{2}\/\d{2}\/\d{4}/ },
  { label: "desc <mô tả>", needle: "desc", pattern: /desc \S.*\S/ },
];

/**
 * Cắt khối bình luận header ra khỏi các dòng đầu của file.
 * Nhận: mảng dòng của file + kiểu bình luận của đuôi file.
 * Trả: { text, start } của khối header, hoặc null nếu không có khối nào trong cửa sổ cho phép.
 */
function extractHeaderBlock(lines: string[], style: CommentStyle): { text: string; start: number } | null {
  const limit = Math.min(lines.length, HEADER_WINDOW_LINES);
  // .md nhận cả <!-- --> (chuẩn) lẫn khối /** */ (biến thể in nguyên mẫu header TS ở đầu tài liệu).
  const pairs: [string, string][] =
    style === "block"
      ? [["/*", "*/"]]
      : style === "html"
        ? [["<!--", "-->"]]
        : style === "markdown"
          ? [
              ["<!--", "-->"],
              ["/**", "*/"],
            ]
          : [];
  for (let i = 0; i < limit; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    // .sh có shebang ở dòng 1: header nằm ngay sau đó, không tính shebang là header.
    if (style === "line" && trimmed.startsWith("#!")) continue;
    if (style === "line") {
      if (!trimmed.startsWith("#")) continue;
      // Kiểu dòng (#): gom các dòng liên tiếp bắt đầu bằng "#".
      let j = i;
      while (j < lines.length && (lines[j] ?? "").trim().startsWith("#")) j++;
      const candidate = lines.slice(i, j).join("\n");
      // Khối chỉ được coi là header nếu có chứa ít nhất một trường của header
      // (nếu không, đó chỉ là chú thích thường ở đầu file).
      if (!HEADER_MARKER.test(candidate)) continue;
      return { text: candidate, start: i + 1 };
    }
    for (const [open, close] of pairs) {
      if (!trimmed.startsWith(open)) continue;
      let end = -1;
      if (trimmed.includes(close)) end = i;
      else {
        for (let j = i; j < Math.min(lines.length, i + 24); j++) {
          if ((lines[j] ?? "").includes(close)) {
            end = j;
            break;
          }
        }
      }
      if (end < 0) continue;
      const candidate = lines.slice(i, end + 1).join("\n");
      if (!HEADER_MARKER.test(candidate)) continue;
      return { text: candidate, start: i + 1 };
    }
  }
  return null;
}

/**
 * Kiểm header của toàn repo.
 * Nhận: không.
 * Trả: CheckResult với danh sách file thiếu header / sai trường / sai thứ tự.
 */
export function runHeaderCheck(): CheckResult {
  const t0 = Date.now();
  const res = createResult("header");
  if (USING_CUSTOM_ROOT) res.notes.push("Đang quét cây thay thế GBH_LINT_ROOT=" + REPO_ROOT);
  const { checked, skipped } = partitionFiles(walkRepo(), true);
  res.skipped = skipped;
  res.checked = checked.length;
  for (const abs of checked) {
    const rel = toRel(abs);
    const rule = headerRuleFor(rel);
    if (!rule) continue;
    const lines = readLines(abs);
    const block = extractHeaderBlock(lines, rule.style);
    if (!block) {
      res.violations.push({
        file: rel,
        line: 1,
        message: "thiếu khối header 5 dòng trong " + HEADER_WINDOW_LINES + " dòng đầu (kiểu " + rule.style + ")",
      });
      continue;
    }
    const flat = block.text.replace(/\s+/g, " ");
    const missing: Violation[] = [];
    const positions: number[] = [];
    for (const f of REQUIRED_FIELDS) {
      const idx = flat.indexOf(f.needle);
      const ok = idx >= 0 && (f.pattern ? f.pattern.test(block.text) : true);
      if (!ok) missing.push({ file: rel, line: block.start, message: "header thiếu trường: " + f.label });
      else positions.push(idx);
    }
    if (missing.length > 0) {
      res.violations.push(...missing);
      continue;
    }
    const ordered = positions.every((p, i) => i === 0 || p > (positions[i - 1] ?? -1));
    if (!ordered) {
      res.violations.push({
        file: rel,
        line: block.start,
        message: "header sai thứ tự trường (author → email → create date → modify date → desc)",
      });
    }
  }
  res.notes.push(
    "Miễn trừ: .json (manifest), lockfile, .svg/.png (icon parity + nhị phân), tệp VCS, docs/contracts/data — lý do đầy đủ ở tools/lint/exemptions.ts",
  );
  const exempted = Object.entries(res.skipped)
    .filter(([k]) => k.startsWith("miễn trừ"))
    .reduce((a, [, n]) => a + n, 0);
  if (exempted > 0) res.notes.push("Có " + exempted + " file được miễn trừ (xem --json để biết chi tiết).");
  res.ms = Date.now() - t0;
  return res;
}

if (isDirectRun(import.meta.url)) {
  const strict = process.argv.includes("--strict");
  const res = runHeaderCheck();
  printResult(res, { strict });
  process.exit(exitCodeFor(res, { strict }));
}
