/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cong dep-guard: cam tuyet doi @galaxy-stack/ai-coder-core o moi tang (package.json, lockfile, ma nguon)
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  createResult,
  exitCodeFor,
  isDirectRun,
  printResult,
  toRel,
  walkRepo,
  REPO_ROOT,
  type CheckResult,
} from "./shared.ts";

/** Chuỗi bị cấm tuyệt đối (AGENTS.md §2, gate:no-ai-coder-core). */
export const BANNED_SPECIFIER = "@galaxy-stack/ai-coder-core";

/** Mẫu import/require tới gói bị cấm (chỉ khớp khi thật sự được nạp, không khớp câu văn). */
const BANNED_IMPORT = /(?:from\s*|require\s*\(\s*|import\s*\(\s*|import\s*)['"]@galaxy-stack\/ai-coder-core(?:\/[^'"]*)?['"]/;

/** Tên các trường trong package.json có thể chứa phụ thuộc. */
const DEP_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "bundledDependencies",
  "bundleDependencies",
  "resolutions",
  "overrides",
];

/** Đuôi file được coi là văn bản để quét chuỗi. */
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|json5|yml|yaml|toml|md|rs|sh|css|html|py|lock|txt)$/;

/** Tên lockfile được quét toàn văn (chứa cả phụ thuộc bắc cầu). */
const LOCKFILES = /^(bun\.lock|bun\.lockb|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock)$/;

/**
 * Kiểm mọi tầng phụ thuộc xem có gói bị cấm không.
 * Nhận: không.
 * Trả: CheckResult; vi phạm = phụ thuộc/import/lockfile chứa gói cấm, ghi chú = số lần chỉ được nhắc trong văn bản.
 */
export function runDepGuardCheck(): CheckResult {
  const t0 = Date.now();
  const res = createResult("dep-guard");
  const files = walkRepo();
  let textMentions = 0;
  let manifests = 0;
  let scanned = 0;
  for (const abs of files) {
    const rel = toRel(abs);
    const name = rel.split("/").pop() ?? rel;
    if (!TEXT_EXT.test(name)) continue;
    let size = 0;
    try {
      size = statSync(abs).size;
    } catch {
      continue;
    }
    if (size > 4 * 1024 * 1024) continue;
    let text = "";
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    scanned++;
    if (name === "package.json") {
      manifests++;
      try {
        const pkg = JSON.parse(text) as Record<string, unknown>;
        for (const field of DEP_FIELDS) {
          const block = pkg[field];
          if (!block || typeof block !== "object") continue;
          for (const dep of Object.keys(block as Record<string, unknown>)) {
            if (dep === BANNED_SPECIFIER || dep.startsWith(BANNED_SPECIFIER + "/")) {
              res.violations.push({
                file: rel,
                line: 0,
                message: field + ' chứa gói bị cấm "' + dep + '"',
              });
            }
          }
        }
      } catch {
        res.notes.push("Không đọc được " + rel + " (JSON hỏng?) — bỏ qua nội dung, chỉ quét chuỗi.");
      }
    }
    if (LOCKFILES.test(name) && text.includes(BANNED_SPECIFIER)) {
      const line = text.split("\n").findIndex((l) => l.includes(BANNED_SPECIFIER)) + 1;
      res.violations.push({
        file: rel,
        line: line > 0 ? line : 0,
        message: "lockfile có phụ thuộc (kể cả bắc cầu) tới " + BANNED_SPECIFIER,
      });
      continue;
    }
    const m = text.match(BANNED_IMPORT);
    if (m) {
      const line = text.slice(0, m.index ?? 0).split("\n").length;
      res.violations.push({
        file: rel,
        line,
        message: "mã nguồn import gói bị cấm (" + BANNED_SPECIFIER + ")",
      });
      continue;
    }
    if (text.includes(BANNED_SPECIFIER)) textMentions++;
  }
  if (existsSync(join(REPO_ROOT, "node_modules", "@galaxy-stack", "ai-coder-core"))) {
    res.violations.push({
      file: "node_modules/@galaxy-stack/ai-coder-core",
      line: 0,
      message: "gói bị cấm đang tồn tại trong node_modules",
    });
  }
  res.checked = scanned;
  res.notes.push("Đã quét " + scanned + " file văn bản, " + manifests + " package.json, mọi lockfile trong repo.");
  if (textMentions > 0) {
    res.notes.push(
      "Có " + textMentions + " file chỉ NHẮC tới tên gói cấm trong văn bản/tài liệu (không phải phụ thuộc) — không tính là vi phạm.",
    );
  }
  res.ms = Date.now() - t0;
  return res;
}

if (isDirectRun(import.meta.url)) {
  const strict = process.argv.includes("--strict");
  const res = runDepGuardCheck();
  printResult(res, { strict });
  process.exit(exitCodeFor(res, { strict }));
}
