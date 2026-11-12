/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cong JSDoc: moi function/hook/component export phai co mo ta (lam gi, nhan gi, tra gi)
 */

import {
  createResult,
  exitCodeFor,
  isDirectRun,
  partitionFiles,
  printResult,
  readLines,
  toRel,
  walkRepo,
  type CheckResult,
  type Violation,
} from "./shared.ts";

/** Mẫu nhận diện khai báo xuất khẩu trong TS/TSX/JS/JSX. */
const TS_DECLARATIONS: { pattern: RegExp; kind: string }[] = [
  { pattern: /^\s*export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/, kind: "function" },
  { pattern: /^\s*export\s+class\s+([A-Za-z0-9_$]+)/, kind: "class" },
  { pattern: /^\s*export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?function\b/, kind: "function" },
  { pattern: /^\s*export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z0-9_$.]+)\s*=>/, kind: "arrow" },
  { pattern: /^\s*export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:React\.)?(?:memo|forwardRef)\s*\(/, kind: "component" },
];

/** Mẫu nhận diện khai báo công khai trong Rust (pub(crate) không tính là xuất khẩu). */
const RS_DECLARARATIONS: { pattern: RegExp; kind: string }[] = [
  { pattern: /^\s*pub\s+(?:async\s+)?fn\s+([A-Za-z0-9_]+)/, kind: "fn" },
  { pattern: /^\s*pub\s+struct\s+([A-Za-z0-9_]+)/, kind: "struct" },
  { pattern: /^\s*pub\s+enum\s+([A-Za-z0-9_]+)/, kind: "enum" },
  { pattern: /^\s*pub\s+trait\s+([A-Za-z0-9_]+)/, kind: "trait" },
];

/** Từ khoá cho thấy mô tả đã nói rõ NHẬN gì. */
const INPUT_WORDS = /@param|Nhận:|nhận:|tham số|đầu vào|Args|args|từ |theo |dựa trên|với /;

/** Từ khoá cho thấy mô tả đã nói rõ TRẢ gì. */
const OUTPUT_WORDS = /@returns|@return|Trả:|trả:|trả về|trả ra|kết quả|giá trị|đầu ra|→|in ra|sinh ra|dựng|lấy /;

/** Mô tả dài từ ngần này ký tự chữ trở lên được coi là đã nói rõ giá trị trả về (tránh báo oan). */
const DESCRIPTIVE_LETTERS = 45;

/** Một khai báo cần mô tả. */
interface Declaration {
  /** Tên hàm/hook/component/class. */
  name: string;
  /** Loại khai báo (function, arrow, component, class, fn, struct...). */
  kind: string;
  /** Dòng 1-based nơi khai báo bắt đầu. */
  line: number;
}

/**
 * Gom chuỗi khai báo (có thể xuống dòng) bắt đầu từ một dòng.
 * Nhận: mảng dòng + chỉ số 0-based của dòng khai báo + số dòng tối đa.
 * Trả: chuỗi đã nối, dùng để tìm danh sách tham số và kiểu trả về.
 */
function declarationText(lines: string[], index: number, maxLines = 12): string {
  return lines.slice(index, Math.min(lines.length, index + maxLines)).join("\n");
}

/**
 * Cắt phần trong ngoặc tròn đầu tiên (danh sách tham số).
 * Nhận: chuỗi khai báo.
 * Trả: { params, after } — nội dung trong ngoặc và phần còn lại sau dấu đóng; null nếu không có.
 */
function parameterList(text: string): { params: string; after: string } | null {
  const open = text.indexOf("(");
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return { params: text.slice(open + 1, i).trim(), after: text.slice(i + 1).trim() };
    }
  }
  return null;
}

/**
 * Lấy khối JSDoc ngay trên một dòng khai báo (bỏ qua decorator và dòng trống).
 * Nhận: mảng dòng + chỉ số dòng khai báo.
 * Trả: { text, present } — nội dung khối và cờ cho biết có khối hay không.
 */
function blockDocAbove(lines: string[], index: number): { text: string; present: boolean } {
  let j = index - 1;
  const skipBack = (): void => {
    while (j >= 0 && (lines[j] ?? "").trim() === "") j--;
  };
  skipBack();
  while (j >= 0 && /^\s*@[A-Za-z]/.test(lines[j] ?? "")) {
    j--;
    skipBack();
  }
  if (j < 0 || !(lines[j] ?? "").trim().endsWith("*/")) return { text: "", present: false };
  let k = j;
  while (k >= 0 && !(lines[k] ?? "").trim().startsWith("/*")) k--;
  if (k < 0) return { text: "", present: false };
  return { text: lines.slice(k, j + 1).join("\n"), present: true };
}

/**
 * Lấy khối doc comment /// ngay trên một dòng khai báo Rust.
 * Nhận: mảng dòng + chỉ số dòng khai báo.
 * Trả: { text, present } như blockDocAbove.
 */
function rustDocAbove(lines: string[], index: number): { text: string; present: boolean } {
  let j = index - 1;
  while (j >= 0) {
    const t = (lines[j] ?? "").trim();
    if (t === "" || t.startsWith("#[")) {
      j--;
      continue;
    }
    break;
  }
  // 11/11/2026 — .rs trong repo dùng khối `/** */` (cùng quy ước với header bắt buộc), không chỉ `///`.
  // Trước đây chỉ nhận `///` nên MỌI `pub fn` có mô tả đúng vẫn bị báo "thiếu mô tả" (32 vi phạm oan).
  // `j` là dòng `*/` (đã nhảy qua các `#[…]` ở trên khai báo), nên đưa `j + 1` làm mốc cho blockDocAbove.
  if (j >= 0 && (lines[j] ?? "").trim().endsWith("*/")) return blockDocAbove(lines, j + 1);
  let k = j;
  while (k >= 0 && (lines[k] ?? "").trim().startsWith("///")) k--;
  if (k === j) return { text: "", present: false };
  return { text: lines.slice(k + 1, j + 1).join("\n"), present: true };
}

/**
 * Đếm ký tự chữ trong mô tả để loại các khối rỗng hình thức.
 * Nhận: nội dung khối bình luận.
 * Trả: số ký tự chữ cái (kể cả chữ có dấu).
 */
function letterCount(text: string): number {
  const cleaned = text
    .replace(/\/\*\*?/g, " ")
    .replace(/\*\//g, " ")
    .replace(/^\s*\*?\s?/gm, "")
    .replace(/^\s*#+\s?/gm, "")
    .replace(/<!--|-->/g, " ");
  const m = cleaned.match(/[A-Za-zÀ-ỹ]/g);
  return m ? m.length : 0;
}

/**
 * Kiểm mô tả cho mọi khai báo xuất khẩu trong repo.
 * Nhận: không.
 * Trả: CheckResult với vi phạm (thiếu mô tả) và cảnh báo (mô tả chưa nói rõ nhận/trả).
 */
export function runJsdocCheck(): CheckResult {
  const t0 = Date.now();
  const res = createResult("jsdoc");
  const { checked, skipped } = partitionFiles(walkRepo(), true);
  res.skipped = skipped;
  res.checked = checked.length;
  for (const abs of checked) {
    const rel = toRel(abs);
    const isTs = /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(rel);
    const isRs = /\.rs$/.test(rel);
    if (!isTs && !isRs) continue;
    const lines = readLines(abs);
    const found: Declaration[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const rules = isRs ? RS_DECLARARATIONS : TS_DECLARATIONS;
      for (const rule of rules) {
        const m = line.match(rule.pattern);
        if (m && m[1]) {
          found.push({ name: m[1], kind: rule.kind, line: i + 1 });
          break;
        }
      }
    }
    for (const decl of found) {
      const idx = decl.line - 1;
      const doc = isRs ? rustDocAbove(lines, idx) : blockDocAbove(lines, idx);
      if (!doc.present || letterCount(doc.text) < 8) {
        res.violations.push({
          file: rel,
          line: decl.line,
          message: "export " + decl.kind + " " + decl.name + " thiếu mô tả JSDoc (làm gì, nhận gì, trả gì)",
        });
        continue;
      }
      if (isRs || decl.kind === "class" || decl.kind === "component" || decl.kind === "struct" || decl.kind === "enum" || decl.kind === "trait") continue;
      const text = declarationText(lines, idx);
      const sig = parameterList(text);
      if (!sig) continue;
      const descriptive = letterCount(doc.text) >= DESCRIPTIVE_LETTERS;
      if (sig.params !== "" && !INPUT_WORDS.test(doc.text) && !descriptive && !sig.params.startsWith(")")) {
        const v: Violation = {
          file: rel,
          line: decl.line,
          message: decl.name + " có tham số nhưng mô tả chưa nói rõ NHẬN gì (thêm @param hoặc câu 'Nhận:')",
        };
        res.warnings.push(v);
      }
      if (sig.after.startsWith(":")) {
        const type = (sig.after.slice(1).split(/[{\n]/)[0] ?? "").trim();
        if (type !== "" && !/^void\b|^never\b/.test(type) && !OUTPUT_WORDS.test(doc.text) && !descriptive) {
          res.warnings.push({
            file: rel,
            line: decl.line,
            message: decl.name + " trả về " + type + " nhưng mô tả chưa nói rõ TRẢ gì (thêm @returns hoặc câu 'Trả:')",
          });
        }
      }
    }
  }
  res.notes.push("Cảnh báo NHẬN/TRẢ chỉ làm đỏ cổng khi chạy với --strict (không máy móc hoá được nếu không báo oan).");
  res.ms = Date.now() - t0;
  return res;
}

if (isDirectRun(import.meta.url)) {
  const strict = process.argv.includes("--strict");
  const res = runJsdocCheck();
  printResult(res, { strict, limit: 25 });
  process.exit(exitCodeFor(res, { strict }));
}
