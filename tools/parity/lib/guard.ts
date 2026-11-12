/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Chốt an toàn: chụp dấu cây thư mục trước/sau để chứng minh parity không ghi vào dữ liệu cấm
 */

import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Dấu vân tay của một cây thư mục. */
export interface TreeSnapshot {
  /** Thư mục gốc đã chụp. */
  root: string;
  /** Số file đã thấy. */
  files: number;
  /** sha256 của danh sách `đường dẫn + kích thước` (đã sắp xếp). */
  digest: string;
  /** true khi phải dừng sớm vì cây quá lớn. */
  truncated: boolean;
  /** Bảng `đường dẫn tương đối → kích thước` để truy vết file nào đổi. */
  entries: Map<string, number>;
}

/** Tuỳ chọn chụp cây. */
export interface SnapshotOptions {
  /** Số file tối đa duyệt qua. */
  maxFiles?: number;
  /** Độ sâu tối đa. */
  maxDepth?: number;
  /** Bỏ qua các thư mục có tên này. */
  skip?: readonly string[];
  /** Ghi cả mtime vào digest (mặc định false vì cây đang sống sẽ nhiễu). */
  includeMtime?: boolean;
}

/** Kết quả so hai dấu vân tay. */
export interface TreeDelta {
  /** true khi digest khác nhau. */
  changed: boolean;
  /** File có ở cả hai nhưng khác kích thước. */
  modified: string[];
  /** File mới xuất hiện. */
  added: string[];
  /** File biến mất. */
  removed: string[];
  /** Số file trước/sau. */
  counts: { before: number; after: number };
}

/**
 * Chụp dấu vân tay của một cây thư mục (mặc định chỉ dùng đường dẫn + kích thước).
 * @param root thư mục gốc.
 * @param options giới hạn duyệt.
 * @returns dấu vân tay, hoặc null nếu thư mục không tồn tại.
 */
export function snapshotTree(root: string, options: SnapshotOptions = {}): TreeSnapshot | null {
  const maxFiles = options.maxFiles ?? 20000;
  const maxDepth = options.maxDepth ?? 8;
  const includeMtime = options.includeMtime ?? false;
  const skip = new Set(options.skip ?? ["node_modules", ".git"]);
  const entries = new Map<string, number>();
  const lines: string[] = [];
  let truncated = false;
  const walk = (dir: string, depth: number): void => {
    if (truncated || depth > maxDepth) return;
    let children: string[];
    try {
      children = readdirSync(dir);
    } catch {
      return;
    }
    for (const child of children) {
      if (entries.size >= maxFiles) {
        truncated = true;
        return;
      }
      const full = join(dir, child);
      let stats;
      try {
        stats = statSync(full);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        if (skip.has(child)) continue;
        walk(full, depth + 1);
        continue;
      }
      const relativePath = full.slice(root.length);
      entries.set(relativePath, stats.size);
      lines.push(
        relativePath +
          "\t" + String(stats.size) +
          (includeMtime ? "\t" + String(Math.round(stats.mtimeMs)) : ""),
      );
    }
  };
  try {
    if (!statSync(root).isDirectory()) return null;
  } catch {
    return null;
  }
  walk(root, 0);
  lines.sort();
  const digest = createHash("sha256").update(lines.join("\n")).digest("hex");
  return { root, files: lines.length, digest, truncated, entries };
}

/**
 * So hai dấu vân tay và chỉ ra file nào đổi.
 * @param before dấu trước.
 * @param after dấu sau.
 * @returns chi tiết thay đổi.
 */
export function diffTrees(before: TreeSnapshot | null, after: TreeSnapshot | null): TreeDelta {
  if (before === null || after === null) {
    return { changed: false, modified: [], added: [], removed: [], counts: { before: 0, after: 0 } };
  }
  const modified: string[] = [];
  const added: string[] = [];
  for (const [path, size] of after.entries) {
    const previous = before.entries.get(path);
    if (previous === undefined) added.push(path);
    else if (previous !== size) modified.push(path);
  }
  const removed: string[] = [];
  for (const path of before.entries.keys()) if (!after.entries.has(path)) removed.push(path);
  return {
    changed: before.digest !== after.digest,
    modified: modified.sort(),
    added: added.sort(),
    removed: removed.sort(),
    counts: { before: before.files, after: after.files },
  };
}

/**
 * Mô tả ngắn một lần so dấu.
 * @param delta kết quả so dấu.
 * @param maxPaths số đường dẫn tối đa liệt kê.
 * @returns chuỗi tiếng Việt dễ đọc.
 */
export function describeTreeDelta(delta: TreeDelta, maxPaths = 6): string {
  if (!delta.changed) return "không đổi (" + String(delta.counts.after) + " file)";
  const samples = [...delta.modified, ...delta.added, ...delta.removed].slice(0, maxPaths);
  return (
    "ĐÃ ĐỔI (trước " + String(delta.counts.before) + " → sau " + String(delta.counts.after) + " file: " +
    samples.join(", ") + (samples.length === 0 ? "" : "…") + ")"
  );
}

/**
 * Cây bị cấm ghi: dữ liệu của blackhole web đang chạy.
 * @returns đường dẫn `~/.galaxy/gbh`.
 */
export function protectedGalaxyGbh(): string {
  const home = process.env.HOME ?? "";
  return join(home, ".galaxy", "gbh");
}

/**
 * Lấy vài đường dẫn đã đổi để đưa vào report (giúp phân biệt nhiễu của tiến trình đang chạy).
 * @param delta kết quả so dấu.
 * @param max số đường dẫn tối đa.
 * @returns danh sách đường dẫn tương đối.
 */
export function sampleChangedPaths(delta: TreeDelta, max = 8): string[] {
  return [...delta.modified, ...delta.added, ...delta.removed].slice(0, max);
}

/** Các nhánh chỉ được harness đang chạy ghi liên tục (phiên, cache, log, thùng rác). */
export const LIVE_PATH_MARKERS: readonly string[] = Object.freeze([
  "/sessions/",
  "/storages/",
  "/attachments/",
  "/logs/",
  "/.trash/",
  "/speech-to-text/",
  "/journey/",
]);

/**
 * Kiểm tra mọi đường dẫn đã đổi có phải artifact sống của một harness khác hay không.
 * @param paths đường dẫn đã đổi.
 * @returns true khi tất cả đều nằm trong nhánh sống (phiên/cache/log).
 */
export function allPathsAreLiveArtifacts(paths: readonly string[]): boolean {
  if (paths.length === 0) return false;
  return paths.every((path) => LIVE_PATH_MARKERS.some((marker) => path.includes(marker)));
}

/**
 * Kết luận về chốt an toàn, có tính tới việc cây đang bị tiến trình khác ghi.
 * @param idleDelta biến động đo được khi parity KHÔNG chạy (cửa sổ rảnh).
 * @param runDelta biến động đo được trong lúc parity chạy.
 * @returns chuỗi kết luận dùng cho report.
 */
export function guardVerdict(idleDelta: TreeDelta, runDelta: TreeDelta): string {
  if (!runDelta.changed) return "PASS — không đổi trong suốt lần chạy";
  const changedPaths = [...runDelta.modified, ...runDelta.added, ...runDelta.removed];
  if (idleDelta.changed || allPathsAreLiveArtifacts(changedPaths)) {
    return (
      "KHÔNG KẾT LUẬN ĐƯỢC (nhiễu) — " + String(changedPaths.length) +
      " đường dẫn đổi đều thuộc nhánh sống (sessions/storages/logs) của harness khác đang chạy, không quy được cho parity"
    );
  }
  return "CẢNH BÁO — cây đổi trong lúc parity chạy ở nhánh KHÔNG phải phiên/cache: phải điều tra";
}
