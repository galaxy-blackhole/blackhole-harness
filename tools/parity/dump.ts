/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:dump — chạy --dump-config cho mọi bên, chuẩn hoá rồi diff theo row id
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  ARTIFACT_FORMAT,
  dumpsDir,
  latestPath,
  parityRelative,
  readJsonFile,
  relativeToRepo,
  writeJsonFile,
  writeTextFile,
} from "./lib/artifacts.ts";
import {
  type DumpDiff,
  type NormalisedDump,
  diffDumps,
  formatDumpDiff,
  formatPresenceTable,
  isDumpParity,
  normaliseDump,
} from "./lib/dump-core.ts";
import {
  type TreeDelta,
  describeTreeDelta,
  diffTrees,
  guardVerdict,
  protectedGalaxyGbh,
  sampleChangedPaths,
  snapshotTree,
} from "./lib/guard.ts";
import { PARITY_DIR, appHome, credentialsPath, ensureDir, log, nowIso, parityPath, stamp, stockHome } from "./lib/paths.ts";
import { loadEquivalenceTable } from "./lib/equivalence.ts";
import { runDumpConfig } from "./lib/runner.ts";
import { galaxyRoot, listDumpTargets } from "./lib/targets.ts";

/** Tóm tắt một target dump trong artifact. */
export interface DumpTargetSummary {
  /** Khoá target. */
  key: string;
  /** Nhãn hiển thị. */
  label: string;
  /** Đường dẫn `bin.js`. */
  bin: string;
  /** Version harness. */
  version: string | null;
  /** `DSH_HOME` đã dùng. */
  home: string;
  /** Profile đã boot. */
  profile: string;
  /** Số patch đã áp. */
  patchCount: number;
  /** true khi dump chạy được. */
  ok: boolean;
  /** Lỗi nếu có. */
  error?: string;
  /** Số byte YAML. */
  bytes: number;
  /** Số row. */
  rows: number;
  /** Số id trùng. */
  duplicates: number;
  /** Số cảnh báo YAML (tag `!!js`). */
  warnings: number;
  /** Số id row bị che nhầm `<secret>` — phải luôn là 0. */
  redactedIds: number;
  /** Số giá trị đã bị che `<secret>` trong cây. */
  redactedValues: number;
  /** Thời gian chạy (ms). */
  durationMs: number;
}

/** Artifact của một lần `parity:dump`. */
export interface DumpArtifact {
  /** Phiên bản định dạng. */
  format: number;
  /** Dấu thời gian của lần chạy. */
  stamp: string;
  /** Thời điểm bắt đầu (ISO). */
  startedAt: string;
  /** Thời điểm kết thúc (ISO). */
  finishedAt: string;
  /** Target làm mốc so sánh. */
  base: string;
  /** Tóm tắt từng target. */
  targets: DumpTargetSummary[];
  /** Target bị bỏ kèm lý do. */
  skipped: string[];
  /** Kết quả từng cặp so sánh. */
  pairs: { refKey: string; oursKey: string; diff: DumpDiff }[];
  /** Bảng hiện diện nhiều cột (tách VERSION vs PATCH), dạng Markdown. */
  presenceTable: string | null;
  /** Các cột của bảng hiện diện. */
  presenceColumns: string[];
  /** Bảng tương đương gói đã dùng (nguồn: docs/PARITY-MATRIX.md). */
  equivalence: { source: string; rows: number; issues: string[] };
  /** Chốt an toàn: cây `~/.galaxy/gbh` có bị đụng không (có tính tới cây đang sống). */
  guard: {
    /** Đường dẫn cây được canh. */
    path: string;
    /** Biến động đo trong cửa sổ rảnh (parity không chạy). */
    idle: string;
    /** Biến động đo trong lúc parity chạy. */
    during: string;
    /** Kết luận dễ đọc. */
    verdict: string;
    /** Các đường dẫn đã đổi trong lúc parity chạy (tối đa 8). */
    samples: string[];
    /** true khi cây đổi trong lúc parity chạy. */
    changed: boolean;
  };
  /** File artifact đã ghi. */
  files: { raw: Record<string, string>; normalised: Record<string, string>; diffs: Record<string, string> };
}

/** Tuỳ chọn cho {@link runDump}. */
export interface DumpOptions {
  /** Target làm mốc. */
  base?: string;
  /** Chỉ chạy các target này. */
  targets?: string[];
  /** true để chỉ chạy, không in bảng tóm tắt. */
  quiet?: boolean;
}

/**
 * Bộ tiền tố đường dẫn dùng chung cho MỌI target, để phép chuẩn hoá là như nhau ở hai bên.
 * @returns danh sách tiền tố (home của app, home oracle B, credentials, repo, ~/.galaxy).
 */
export function sharedPathPrefixes(): string[] {
  return [appHome(), stockHome(), credentialsPath(), galaxyRoot(), "/private/tmp", "/tmp"];
}

/**
 * Chạy `--dump-config` cho mọi target khả dụng rồi diff từng cặp so với target mốc.
 * @param options tuỳ chọn (target mốc, danh sách target, chế độ im lặng).
 * @returns artifact đầy đủ và đã ghi xuống `.parity`.
 */
export async function runDump(options: DumpOptions = {}): Promise<DumpArtifact> {
  const startedAt = nowIso();
  const runStamp = stamp();
  const base = options.base ?? "ours";
  const dir = ensureDir(dumpsDir(runStamp));
  const guardPath = protectedGalaxyGbh();
  const guardBefore = snapshotTree(guardPath, { maxDepth: 3 });
  await sleep(1200);
  const guardIdle = snapshotTree(guardPath, { maxDepth: 3 });
  const idleDelta: TreeDelta = diffTrees(guardBefore, guardIdle);
  const { targets: selected, skipped } = listDumpTargets(options.targets ?? []);
  const rawFiles: Record<string, string> = {};
  const normalisedFiles: Record<string, string> = {};
  const diffFiles: Record<string, string> = {};
  const summaries: DumpTargetSummary[] = [];
  const normalised = new Map<string, NormalisedDump>();
  const prefix = sharedPathPrefixes();

  for (const target of selected) {
    const run = runDumpConfig(target);
    summaries.push({
      key: target.key,
      label: target.label,
      bin: target.bin,
      version: run.version,
      home: target.home,
      profile: target.profile,
      patchCount: target.patches.length,
      ok: run.ok,
      error: run.error,
      bytes: run.raw.length,
      rows: 0,
      duplicates: 0,
      warnings: 0,
      redactedIds: 0,
      redactedValues: 0,
      durationMs: run.durationMs,
    });
    const summary = summaries[summaries.length - 1] as DumpTargetSummary;
    if (!run.ok) {
      if (!options.quiet) log("SKIP", target.key, "→", run.error ?? "lỗi không rõ");
      continue;
    }
    const rawFile = writeTextFile(join(dir, target.key + ".yml"), run.raw);
    rawFiles[target.key] = rawFile;
    const tree = normaliseDump(run.raw, target.key, { paths: prefix });
    normalised.set(target.key, tree);
    summary.rows = tree.rowCount;
    summary.duplicates = tree.duplicates.length;
    summary.warnings = tree.warnings;
    summary.redactedIds = tree.maskedIds.length;
    summary.redactedValues = tree.redactedValues;
    if (tree.maskedIds.length > 0) log("CẢNH BÁO: che nhầm id row", target.key, "→", tree.maskedIds.join(", "));
    const normalisedFile = writeJsonFile(join(dir, target.key + ".normalised.json"), {
      source: tree.source,
      rowCount: tree.rowCount,
      duplicates: tree.duplicates,
      warnings: tree.warnings,
      maskedIds: tree.maskedIds,
      redactedValues: tree.redactedValues,
      rows: [...tree.rows.values()].map((row) => ({ id: row.id, order: row.order, json: row.json })),
    });
    normalisedFiles[target.key] = normalisedFile;
  }

  const equivalence = loadEquivalenceTable();
  if (!options.quiet && equivalence.issues.length > 0) log("cảnh báo ma trận parity:", equivalence.issues.join(" · "));
  const baseTree = normalised.get(base);
  const pairs: { refKey: string; oursKey: string; diff: DumpDiff }[] = [];
  if (baseTree !== undefined) {
    for (const [key, tree] of normalised) {
      if (key === base) continue;
      const diff = diffDumps(tree, baseTree, { equivalence });
      pairs.push({ refKey: key, oursKey: base, diff });
      const file = writeTextFile(join(dir, "diff-" + key + "-vs-" + base + ".md"), formatDumpDiff(diff, 60));
      diffFiles[key] = file;
      if (!options.quiet) {
        log(
          "diff",
          base + " vs " + key + ":",
          isDumpParity(diff) ? "PASS" : "FAIL",
          "THÊM " + String(diff.added.length) + " · THIẾU " + String(diff.missing.length) + " · ĐỔI " + String(diff.changed.length) +
          " · đã thay " + String(diff.swapped.length) + " row",
        );
      }
    }
  } else if (!options.quiet) {
    log("SKIP", "không có target mốc '" + base + "' để diff");
  }

  const crossKeys = ["oracleA", "oracleA_rc2", "oracleA_nopatch"];
  const crossColumns = crossKeys.map((key) => normalised.get(key)).filter((tree): tree is NormalisedDump => tree !== undefined);
  const presenceTable = crossColumns.length >= 2 ? formatPresenceTable(crossColumns) : null;
  if (presenceTable !== null) {
    writeTextFile(join(dir, "presence-table.md"), presenceTable);
  }

  const guardAfter = snapshotTree(guardPath, { maxDepth: 3 });
  const runDelta = diffTrees(guardIdle, guardAfter);
  const verdict = guardVerdict(idleDelta, runDelta);
  const artifact: DumpArtifact = {
    format: ARTIFACT_FORMAT,
    stamp: runStamp,
    startedAt,
    finishedAt: nowIso(),
    base,
    targets: summaries,
    skipped,
    pairs,
    presenceTable,
    presenceColumns: crossColumns.map((tree) => tree.source),
    equivalence: { source: equivalence.source, rows: equivalence.rows, issues: equivalence.issues },
    guard: {
      path: guardPath,
      idle: describeTreeDelta(idleDelta),
      during: describeTreeDelta(runDelta),
      verdict,
      samples: sampleChangedPaths(runDelta),
      changed: runDelta.changed,
    },
    files: { raw: rawFiles, normalised: normalisedFiles, diffs: diffFiles },
  };
  if (!options.quiet) log("guard ~/.galaxy/gbh:", verdict);
  return artifact;
}

/**
 * Điểm vào CLI `parity:dump`.
 * @param argv tham số sau tên script.
 * @returns mã thoát (0 = chạy xong; 1 = có target lỗi hoặc FAIL khi bật `--strict`).
 */
export async function main(argv: string[]): Promise<number> {
  const strict = argv.includes("--strict");
  const quiet = argv.includes("--json");
  const base = valueOf(argv, "--base") ?? "ours";
  const targets = (valueOf(argv, "--targets") ?? "").split(",").filter((token) => token.length > 0);
  const artifact = await runDump({ base, targets, quiet });
  writeJsonFile(latestPath().replace("latest.json", "latest-dump.json"), artifact);
  if (quiet) {
    console.log(JSON.stringify({ base: artifact.base, targets: artifact.targets.map((t) => ({ key: t.key, ok: t.ok, rows: t.rows, version: t.version })), pairs: artifact.pairs.map((pair) => ({ pair: pair.oursKey + " vs " + pair.refKey, added: pair.diff.added.length, missing: pair.diff.missing.length, changed: pair.diff.changed.length })), guard: artifact.guard }, null, 2));
    return 0;
  }
  printSummary(artifact);
  const failed = artifact.targets.some((target) => !target.ok) || artifact.pairs.some((pair) => !isDumpParity(pair.diff));
  return strict && failed ? 1 : 0;
}

/**
 * In bảng tóm tắt ra console.
 * @param artifact artifact của lần chạy.
 * @returns không trả gì.
 */
export function printSummary(artifact: DumpArtifact): void {
  console.log("");
  console.log("=== parity:dump — " + artifact.stamp + " ===");
  console.log("| target | version | row | ok |");
  console.log("|---|---|---|---|");
  for (const target of artifact.targets) {
    console.log("| " + target.key + " | " + (target.version ?? "?") + " | " + String(target.rows) + " | " + (target.ok ? "✓" : "SKIP: " + (target.error ?? "")) + " |");
  }
  for (const skip of artifact.skipped) console.log("- SKIP: " + skip);
  for (const pair of artifact.pairs) {
    const diff = pair.diff;
    console.log("");
    console.log(formatDumpDiff(diff, 20));
  }
  if (artifact.presenceTable !== null) {
    console.log("");
    console.log("=== bảng hiện diện (tách VERSION vs PATCH) ===");
    console.log(artifact.presenceTable);
  }
  console.log("");
  console.log("artifact: " + parityRelative("dumps", artifact.stamp));
  console.log("guard ~/.galaxy/gbh: " + artifact.guard.verdict);
  console.log("  · cửa sổ rảnh: " + artifact.guard.idle);
  console.log("  · trong lúc chạy: " + artifact.guard.during);
}

/**
 * Nghỉ một khoảng ngắn (dùng cho cửa sổ đo biến động nền).
 * @param ms số mili giây.
 * @returns promise hoàn tất sau `ms`.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Đọc tham số dạng `--key value`.
 * @param argv danh sách tham số.
 * @param key tên tham số.
 * @returns giá trị, hoặc null nếu không có.
 */
export function valueOf(argv: readonly string[], key: string): string | null {
  const at = argv.indexOf(key);
  return at === -1 ? null : argv[at + 1] ?? null;
}

/**
 * Đọc artifact dump mới nhất đã ghi.
 * @returns artifact, hoặc null nếu chưa từng chạy.
 */
export function readLatestDump(): DumpArtifact | null {
  return readJsonFile<DumpArtifact>(parityPath("latest-dump.json"));
}

/**
 * Ghi artifact ra file JSON trong `.parity`.
 * @param artifact artifact cần ghi.
 * @returns đường dẫn file (tương đối repo) để in log.
 */
export function saveDumpArtifact(artifact: DumpArtifact): string {
  const file = join(PARITY_DIR, "last-dump.json");
  ensureDir(PARITY_DIR);
  writeFileSync(file, JSON.stringify(artifact, null, 2) + "\n");
  return relativeToRepo(file);
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
