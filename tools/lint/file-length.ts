/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cong do dai: moi file nguon <= 1000 dong, vuot la phai tach module (khong noi nguong)
 */

import {
  countLines,
  createResult,
  exitCodeFor,
  isDirectRun,
  partitionFiles,
  printResult,
  REPO_ROOT,
  toRel,
  USING_CUSTOM_ROOT,
  walkRepo,
  type CheckResult,
} from "./shared.ts";

/** Ngưỡng cứng số dòng mỗi file nguồn (AGENTS.md §2). */
export const MAX_LINES = 1000;

/**
 * Kiểm độ dài mọi file nguồn trong repo.
 * Nhận: không.
 * Trả: CheckResult với các file vượt MAX_LINES (dòng vi phạm = MAX_LINES + 1).
 */
export function runFileLengthCheck(): CheckResult {
  const t0 = Date.now();
  const res = createResult("file-length");
  if (USING_CUSTOM_ROOT) res.notes.push("Đang quét cây thay thế GBH_LINT_ROOT=" + REPO_ROOT);
  const { checked, skipped } = partitionFiles(walkRepo(), true);
  res.skipped = skipped;
  res.checked = checked.length;
  for (const abs of checked) {
    const n = countLines(abs);
    if (n > MAX_LINES) {
      res.violations.push({
        file: toRel(abs),
        line: MAX_LINES + 1,
        message: n + " dòng > " + MAX_LINES + " — phải tách module (không nới ngưỡng)",
      });
    }
  }
  res.ms = Date.now() - t0;
  return res;
}

if (isDirectRun(import.meta.url)) {
  const res = runFileLengthCheck();
  printResult(res, { strict: process.argv.includes("--strict") });
  process.exit(exitCodeFor(res, { strict: process.argv.includes("--strict") }));
}
