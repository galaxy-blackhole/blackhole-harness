/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tien ich dung chung cho cac cong lint: duyet file, doc text, in vi pham, tim node >= 26
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { EXEMPT_DIRS, exemptionFor, headerRuleFor, sourceExtensions } from "./exemptions.ts";

/**
 * Thư mục gốc bị quét. Mặc định là repo blackhole-tauri (file này nằm ở tools/lint/).
 * Đặt GBH_LINT_ROOT để trỏ cổng vào một cây khác — chỉ dùng cho test/thử phá, không dùng khi chạy thật.
 */
export const REPO_ROOT: string = process.env.GBH_LINT_ROOT
  ? resolve(process.env.GBH_LINT_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Cờ cho biết đang chạy trên cây thay thế (GBH_LINT_ROOT), để in cảnh báo. */
export const USING_CUSTOM_ROOT = process.env.GBH_LINT_ROOT !== undefined;

/** Phiên bản Node tối thiểu mà dự án yêu cầu (node 24 ở /usr/local/bin hỏng im lặng). */
export const MIN_NODE_MAJOR = 26;

/** Một vi phạm: file nào, dòng nào, vi phạm điều gì. */
export interface Violation {
  /** Đường dẫn tương đối repo. */
  file: string;
  /** Số dòng 1-based; 0 nghĩa là vi phạm ở mức cả file. */
  line: number;
  /** Mô tả vi phạm bằng tiếng Việt. */
  message: string;
}

/** Kết quả một cổng kiểm tra. */
export interface CheckResult {
  /** Tên cổng, ví dụ "header". */
  name: string;
  /** Số file đã thực sự kiểm. */
  checked: number;
  /** Số file bỏ qua, gộp theo lý do. */
  skipped: Record<string, number>;
  /** Vi phạm làm cổng đỏ. */
  violations: Violation[];
  /** Cảnh báo, chỉ làm đỏ cổng khi chạy --strict. */
  warnings: Violation[];
  /** Ghi chú tự do (nguồn dữ liệu, cách chạy lại, cảnh báo môi trường). */
  notes: string[];
  /** Thời gian chạy, mili giây. */
  ms: number;
}

/**
 * Tạo kết quả rỗng cho một cổng.
 * Nhận: tên cổng.
 * Trả: đối tượng CheckResult chưa có số liệu.
 */
export function createResult(name: string): CheckResult {
  return { name, checked: 0, skipped: {}, violations: [], warnings: [], notes: [], ms: 0 };
}

/**
 * Đổi đường dẫn tuyệt đối thành đường dẫn tương đối repo, dùng dấu "/".
 * Nhận: đường dẫn tuyệt đối (hoặc đã tương đối so với repo).
 * Trả: đường dẫn tương đối kiểu POSIX.
 */
export function toRel(abs: string): string {
  const rel = abs.startsWith(REPO_ROOT) ? relative(REPO_ROOT, abs) : abs;
  return rel.split(sep).join("/");
}

/**
 * Duyệt toàn repo lấy danh sách file thuộc diện kiểm.
 * Nhận: không (dùng REPO_ROOT và EXEMPT_DIRS).
 * Trả: mảng đường dẫn tuyệt đối đã sắp xếp.
 */
export function walkRepo(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        // 08/11/2026 — thư mục TẠM do test A/B sinh lúc chạy (`.ab-run-XXXXXX`) chứa `.js` của bản
        //   đối chứng ⇒ tsc/lint nhìn thấy và báo lỗi giả. Bỏ qua mọi thư mục bắt đầu bằng `.ab-run-`.
        if (e.name.startsWith(".ab-run-")) continue;
        if (EXEMPT_DIRS.includes(e.name)) continue;
        walk(abs);
      } else if (e.isFile()) {
        out.push(abs);
      }
    }
  };
  walk(REPO_ROOT);
  return out.sort();
}

/**
 * Đọc file thành mảng dòng (bỏ dòng trống cuối cùng do newline).
 * Nhận: đường dẫn tuyệt đối.
 * Trả: mảng dòng; file không đọc được trả mảng rỗng.
 */
export function readLines(abs: string): string[] {
  try {
    if (statSync(abs).size > 8 * 1024 * 1024) return [];
    const text = readFileSync(abs, "utf8");
    const lines = text.split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines;
  } catch {
    return [];
  }
}

/**
 * Đếm số dòng thực của file.
 * Nhận: đường dẫn tuyệt đối.
 * Trả: số dòng (0 nếu không đọc được).
 */
export function countLines(abs: string): number {
  return readLines(abs).length;
}

/**
 * Lọc danh sách file theo đuôi nguồn và bảng miễn trừ.
 * Nhận: danh sách tuyệt đối, và cờ chỉ-lấy-đuôi-nguồn.
 * Trả: hai mảng {checked, skipped} kèm lý do gộp theo nhóm.
 */
export function partitionFiles(
  files: string[],
  onlySourceExt = true,
): { checked: string[]; skipped: Record<string, number> } {
  const checked: string[] = [];
  const skipped: Record<string, number> = {};
  const bump = (k: string): void => {
    skipped[k] = (skipped[k] ?? 0) + 1;
  };
  for (const abs of files) {
    const rel = toRel(abs);
    const exempt = exemptionFor(rel);
    if (exempt) {
      bump("miễn trừ: " + exempt.slice(0, 60));
      continue;
    }
    if (onlySourceExt) {
      const name = rel.split("/").pop() ?? rel;
      const dot = name.lastIndexOf(".");
      const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
      if (!sourceExtensions().includes(ext)) {
        bump("không phải đuôi mã nguồn: " + (ext || "(không có)"));
        continue;
      }
    }
    checked.push(abs);
  }
  return { checked, skipped };
}

/** Tuỳ chọn khi in kết quả một cổng. */
export interface PrintOptions {
  /** Khi true, cảnh báo cũng làm cổng đỏ. */
  strict?: boolean;
  /** In tối đa bao nhiêu vi phạm (mặc định 40). */
  limit?: number;
}

/**
 * In kết quả một cổng ra stdout cho người đọc và cho CI.
 * Nhận: kết quả cổng + tuỳ chọn in.
 * Trả: true nếu cổng xanh (không vi phạm và, khi --strict, không cảnh báo).
 */
export function printResult(res: CheckResult, opts: PrintOptions = {}): boolean {
  const limit = opts.limit ?? 40;
  const strict = opts.strict === true;
  const show = (v: Violation, tag: string): void => {
    console.log(tag + " " + v.file + ":" + v.line + "  " + v.message);
  };
  for (const v of res.violations.slice(0, limit)) show(v, "FAIL");
  if (res.violations.length > limit) {
    console.log("FAIL ... còn " + (res.violations.length - limit) + " vi phạm nữa (xem " + res.name + " --json)");
  }
  for (const w of res.warnings.slice(0, limit)) show(w, "WARN");
  for (const n of res.notes) console.log("INFO " + n);
  const skippedTotal = Object.values(res.skipped).reduce((a, b) => a + b, 0);
  const red = res.violations.length > 0 || (strict && res.warnings.length > 0);
  const parts = [
    (red ? "FAIL" : "OK  ") + " " + res.name,
    "kiểm " + res.checked + " file",
    res.violations.length + " vi phạm",
    res.warnings.length + " cảnh báo",
    "bỏ qua " + skippedTotal,
    res.ms + "ms",
  ];
  console.log("[" + parts.join(" · ") + "]");
  return !red;
}

/**
 * Tính mã thoát của một cổng.
 * Nhận: kết quả cổng + tuỳ chọn.
 * Trả: 0 nếu xanh, 1 nếu đỏ.
 */
export function exitCodeFor(res: CheckResult, opts: PrintOptions = {}): number {
  const strict = opts.strict === true;
  return res.violations.length > 0 || (strict && res.warnings.length > 0) ? 1 : 0;
}

/**
 * Nhận biết file đang được chạy trực tiếp (không phải bị import).
 * Nhận: import.meta.url của module.
 * Trả: true nếu đây là entrypoint của tiến trình.
 */
export function isDirectRun(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const self = fileURLToPath(metaUrl);
  if (resolve(entry) === resolve(self)) return true;
  // bun chạy file TS trực tiếp vẫn giữ đường dẫn gốc; so thêm theo hậu tố để an toàn.
  return entry.endsWith(self) || self.endsWith(entry);
}

/** Một runtime Node tìm được trên máy. */
export interface NodeRuntime {
  /** Đường dẫn tuyệt đối tới binary node. */
  path: string;
  /** Chuỗi phiên bản thô, ví dụ "v26.9.0". */
  version: string;
}

/**
 * Tìm runtime Node >= 26 (PATH của tiến trình này KHÔNG có node).
 * Nhận: không.
 * Trả: runtime phù hợp, hoặc null nếu máy không có (cổng typecheck sẽ SKIP kèm lý do).
 */
export function findNodeRuntime(): NodeRuntime | null {
  const candidates: string[] = [];
  if (process.env.GBH_NODE) candidates.push(process.env.GBH_NODE);
  if (process.env.NVM_DIR) candidates.push(process.env.NVM_DIR + "/versions/node/" + "*" + "/bin/node");
  candidates.push(homedir() + "/.nvm/versions/node/*/bin/node");
  candidates.push("/usr/local/bin/node", "/opt/homebrew/bin/node");
  const expanded: string[] = [];
  for (const c of candidates) {
    if (!c.includes("*")) {
      expanded.push(c);
      continue;
    }
    const base = dirname(dirname(dirname(c)));
    if (!existsSync(base)) continue;
    for (const d of readdirSync(base).sort().reverse()) expanded.push(join(base, d, "bin", "node"));
  }
  if (process.execPath && /\/node$/.test(process.execPath)) expanded.unshift(process.execPath);
  for (const p of expanded) {
    if (!existsSync(p)) continue;
    const r = spawnSync(p, ["--version"], { encoding: "utf8", timeout: 10000 });
    if (r.status !== 0 || !r.stdout) continue;
    const version = r.stdout.trim();
    const major = Number(version.replace(/^v/, "").split(".")[0]);
    // node v24 ở /usr/local/bin thoát im lặng khi chạy harness: chỉ nhận >= MIN_NODE_MAJOR.
    if (Number.isFinite(major) && major >= MIN_NODE_MAJOR) return { path: p, version };
  }
  return null;
}

/**
 * Kiểm tra một file có phải file nguồn thuộc diện kiểm (không miễn trừ).
 * Nhận: đường dẫn tuyệt đối.
 * Trả: quy tắc header hoặc null.
 */
export function sourceRuleOf(abs: string) {
  const rel = toRel(abs);
  if (exemptionFor(rel)) return null;
  return headerRuleFor(rel);
}