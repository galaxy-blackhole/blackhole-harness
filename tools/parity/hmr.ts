/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:hmr — chứng minh HMR chạy thật: sửa patch của profile rồi chụp lại, KHÔNG restart host
 */

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ARTIFACT_FORMAT, parityRelative, relativeToRepo, writeBinaryFile, writeJsonFile, writeTextFile } from "./lib/artifacts.ts";
import {
  type ChromeSession,
  capturePage,
  closeChromeSession,
  launchChrome,
  resolveSessionCookieFrom,
} from "./lib/browser.ts";
import { pixelDiff, ratioPercent } from "./lib/image.ts";
import { OURS_PORT, appHome, credentialsPath, ensureDir, log, nowIso, parityPath, stamp } from "./lib/paths.ts";
import { redactTokens } from "./lib/runner.ts";

/** Một bước trong phép đo HMR. */
export interface HmrStep {
  /** Tên bước (baseline / sau khi ghi patch / sau khi trả patch). */
  phase: string;
  /** Thời điểm ISO. */
  at: string;
  /** Số pixel khác baseline. */
  diffPixels: number;
  /** Tỉ lệ khác baseline. */
  ratio: number;
  /** Ảnh tương ứng (tương đối repo). */
  file: string;
  /** Mili giây kể từ lúc ghi patch (chỉ có ở bước sau khi ghi). */
  elapsedMs?: number;
}

/** Artifact của một lần đo HMR. */
export interface HmrArtifact {
  /** Phiên bản định dạng. */
  format: number;
  /** Dấu thời gian. */
  stamp: string;
  /** Bắt đầu/kết thúc. */
  startedAt: string;
  /** Kết thúc. */
  finishedAt: string;
  /** Cổng app được đo. */
  port: number;
  /** File patch của profile đã sửa. */
  patchFile: string;
  /** Nội dung đã ghi vào patch (theme tối). */
  themePatch: string;
  /** true khi phát hiện giao diện đổi mà KHÔNG restart host. */
  detected: boolean;
  /** Độ trễ từ lúc ghi file tới lúc ảnh đổi (ms), null nếu không phát hiện. */
  latencyMs: number | null;
  /** Ngưỡng tỉ lệ pixel coi là "đã đổi". */
  changeThreshold: number;
  /** Các bước đo. */
  steps: HmrStep[];
  /** true khi ảnh sau khi trả patch trở lại giống baseline. */
  restoreVerified: boolean;
  /** Độ trễ chiều REVERT (ms) từ lúc ghi lại patch gốc tới lúc ảnh về baseline; null nếu không về. */
  revertLatencyMs: number | null;
  /** true khi file patch đã được ghi lại NGUYÊN VĂN bản gốc. */
  patchRestored: boolean;
  /** Bản sao lưu nội dung gốc của file patch (để khôi phục bằng tay nếu cần). */
  patchBackupFile: string;
  /** Dòng log mới của host trong lúc đo (đã che token). */
  hostLogLines: string[];
  /** Kết luận. */
  verdict: "PASS" | "FAIL" | "SKIP";
  /** Việc bị bỏ kèm lý do. */
  skips: string[];
}

/** Tuỳ chọn cho {@link runHmr}. */
export interface HmrOptions {
  /** Cổng app. */
  port?: number;
  /** File patch của profile; mặc định `<home app>/profiles/blackhole/cordis.patch.yml`. */
  patchFile?: string;
  /** Nội dung patch ghi tạm để đổi theme. */
  themePatch?: string;
  /** Ngưỡng tỉ lệ pixel coi là giao diện đã đổi. */
  changeThreshold?: number;
  /** Thời gian chờ tối đa cho HMR. */
  timeoutMs?: number;
  /** Thời gian chờ tối đa cho chiều revert. */
  revertTimeoutMs?: number;
  /** Chế độ im lặng. */
  quiet?: boolean;
}

/** Patch mặc định dùng để đo: đổi theme sang tối (ui-theme.preference = dark). */
export const DEFAULT_THEME_PATCH = ["- id: ui-theme", "  config:", "    preference: dark", ""].join("\n");

/** File patch mặc định của profile app. */
export function defaultPatchFile(): string {
  return process.env.GBH_PARITY_PATCH ?? join(appHome(), "profiles", "blackhole", "cordis.patch.yml");
}

/**
 * Đọc các dòng log mới của host kể từ một offset, đã che token.
 * @param file đường dẫn log.
 * @param fromOffset offset bắt đầu đọc.
 * @returns các dòng mới (tối đa 40) và offset mới.
 */
export function readNewLogLines(file: string, fromOffset: number): { lines: string[]; offset: number } {
  if (!existsSync(file)) return { lines: [], offset: fromOffset };
  const size = statSync(file).size;
  if (size <= fromOffset) return { lines: [], offset: size };
  const text = readFileSync(file, "utf8").slice(fromOffset);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => redactTokens(line))
    .slice(-40);
  return { lines, offset: size };
}

/**
 * Chứng minh HMR: chụp baseline, ghi patch đổi theme, chụp lại mà KHÔNG restart host, rồi trả patch.
 * @param options tuỳ chọn.
 * @returns artifact đã ghi xuống `.parity/hmr/<stamp>/`.
 */
export async function runHmr(options: HmrOptions = {}): Promise<HmrArtifact> {
  const startedAt = nowIso();
  const runStamp = stamp();
  const dir = ensureDir(parityPath("hmr", runStamp));
  const port = options.port ?? OURS_PORT;
  const patchFile = options.patchFile ?? defaultPatchFile();
  const themePatch = options.themePatch ?? DEFAULT_THEME_PATCH;
  const changeThreshold = options.changeThreshold ?? 0.05;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const skips: string[] = [];
  const steps: HmrStep[] = [];
  const logFile = join(appHome(), "host-" + String(port) + ".log");

  if (!existsSync(patchFile)) {
    return {
      format: ARTIFACT_FORMAT,
      stamp: runStamp,
      startedAt,
      finishedAt: nowIso(),
      port,
      patchFile,
      themePatch,
      detected: false,
      latencyMs: null,
      changeThreshold,
      steps,
      restoreVerified: false,
      revertLatencyMs: null,
      patchRestored: true,
      patchBackupFile: "(chưa sao lưu — file patch không tồn tại)",
      hostLogLines: [],
      verdict: "SKIP",
      skips: ["không thấy file patch của profile: " + patchFile],
    };
  }
  const original = readFileSync(patchFile, "utf8");
  // Sao lưu NGUYÊN VĂN patch của người dùng trước khi động vào, để luôn khôi phục được.
  const patchBackupFile = writeTextFile(join(dir, "patch-nguyen-ban.yml"), original);
  const logStart = readNewLogLines(logFile, 0).offset;
  const url = "http://127.0.0.1:" + String(port) + "/";
  const auth = resolveSessionCookieFrom(port, [credentialsPath(), join(appHome(), ".credentials.yaml")]);
  let session: ChromeSession | null = null;
  let detected = false;
  let latencyMs: number | null = null;
  let restoreVerified = false;
  let revertLatencyMs: number | null = null;
  try {
    session = await launchChrome(parityPath("tmp"), runStamp + "-hmr");
    const capture = async (name: string): Promise<{ png: Buffer; file: string }> => {
      const result = await capturePage(session as ChromeSession, {
        url,
        width: 1440,
        height: 900,
        cookie: auth.cookie,
        settleMs: 400,
        timeoutMs: 20_000,
      });
      if (!result.ok || result.png === undefined) throw new Error(result.error ?? "không chụp được " + name);
      const file = writeBinaryFile(join(dir, name + ".png"), result.png);
      return { png: result.png, file: relativeToRepo(file) };
    };
    const baseline = await capture("before");
    steps.push({ phase: "baseline", at: nowIso(), diffPixels: 0, ratio: 0, file: baseline.file });

    const writeAt = Date.now();
    writeFileSync(patchFile, themePatch);
    if (!options.quiet) log("đã ghi patch theme tối vào", patchFile, "— chờ HMR, KHÔNG restart host");

    let last = baseline;
    while (Date.now() - writeAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const shot = await capture("sau-khi-ghi-patch");
      const diff = pixelDiff(baseline.png, shot.png, 0);
      last = shot;
      if (diff.rawRatio >= changeThreshold) {
        detected = true;
        latencyMs = Date.now() - writeAt;
        steps.push({
          phase: "sau-khi-ghi-patch",
          at: nowIso(),
          diffPixels: diff.rawDiffPixels,
          ratio: diff.rawRatio,
          file: shot.file,
          elapsedMs: latencyMs,
        });
        if (!options.quiet) log("HMR phát hiện sau", String(latencyMs), "ms —", ratioPercent(diff.rawRatio), "pixel đổi");
        break;
      }
      steps.push({ phase: "poll", at: nowIso(), diffPixels: diff.rawDiffPixels, ratio: diff.rawRatio, file: shot.file, elapsedMs: Date.now() - writeAt });
    }
    if (!detected) {
      skips.push("quá " + String(timeoutMs) + "ms mà giao diện không đổi (HMR không chạy?) — ảnh cuối: " + last.file);
    }

    // ---- Chiều REVERT: ghi lại NGUYÊN VĂN patch gốc rồi poll tới khi ảnh về baseline ----
    const revertAt = Date.now();
    writeFileSync(patchFile, original);
    const revertTimeoutMs = options.revertTimeoutMs ?? 25_000;
    while (Date.now() - revertAt < revertTimeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const shot = await capturePage(session as ChromeSession, {
        url,
        width: 1440,
        height: 900,
        cookie: auth.cookie,
        settleMs: 400,
        timeoutMs: 20_000,
      });
      if (!shot.ok || shot.png === undefined) continue;
      const diff = pixelDiff(baseline.png, shot.png, 0);
      const file = writeBinaryFile(join(dir, "sau-khi-tra-patch.png"), shot.png);
      const elapsed = Date.now() - revertAt;
      if (diff.rawRatio < changeThreshold) {
        restoreVerified = true;
        revertLatencyMs = elapsed;
        steps.push({ phase: "sau-khi-tra-patch", at: nowIso(), diffPixels: diff.rawDiffPixels, ratio: diff.rawRatio, file: relativeToRepo(file), elapsedMs: elapsed });
        if (!options.quiet) log("revert xong sau", String(elapsed), "ms —", ratioPercent(diff.rawRatio), "pixel khác baseline");
        break;
      }
      steps.push({ phase: "poll-revert", at: nowIso(), diffPixels: diff.rawDiffPixels, ratio: diff.rawRatio, file: relativeToRepo(file), elapsedMs: elapsed });
    }
    if (!restoreVerified) {
      skips.push("sau " + String(revertTimeoutMs) + "ms gỡ patch, giao diện KHÔNG trở lại baseline — patch gỡ không được áp lại (phải báo Lead)");
    }
  } finally {
    // LUÔN trả patch về nguyên trạng, kể cả khi lỗi.
    writeFileSync(patchFile, original);
    await closeChromeSession(session);
  }

  const logRead = readNewLogLines(logFile, logStart);
  const artifact: HmrArtifact = {
    format: ARTIFACT_FORMAT,
    stamp: runStamp,
    startedAt,
    finishedAt: nowIso(),
    port,
    patchFile,
    themePatch,
    detected,
    latencyMs,
    changeThreshold,
    steps,
    restoreVerified,
    revertLatencyMs,
    patchRestored: readFileSync(patchFile, "utf8") === original,
    patchBackupFile: relativeToRepo(patchBackupFile),
    hostLogLines: logRead.lines,
    verdict: detected && restoreVerified ? "PASS" : detected ? "FAIL" : "FAIL",
    skips: restoreVerified ? skips : [...skips, "ảnh sau khi trả patch KHÔNG trở lại baseline"],
  };
  writeJsonFile(join(dir, "summary.json"), artifact);
  writeJsonFile(parityPath("latest-hmr.json"), artifact);
  return artifact;
}

/**
 * In tóm tắt phép đo HMR.
 * @param artifact artifact của lần đo.
 * @returns không trả gì.
 */
export function printHmrSummary(artifact: HmrArtifact): void {
  console.log("");
  console.log("=== parity:hmr — " + artifact.stamp + " → " + artifact.verdict + " ===");
  console.log("| bước | pixel khác baseline | tỉ lệ | sau khi ghi patch |");
  console.log("|---|---|---|---|");
  for (const step of artifact.steps) {
    console.log(
      "| " + step.phase + " | " + String(step.diffPixels) + " | " + ratioPercent(step.ratio) + " | " +
        (step.elapsedMs === undefined ? "—" : String(step.elapsedMs) + " ms") + " |",
    );
  }
  console.log("");
  console.log("phát hiện: " + String(artifact.detected) + " · độ trễ HMR: " + (artifact.latencyMs === null ? "—" : String(artifact.latencyMs) + " ms"));
  console.log(
    "revert: " + String(artifact.restoreVerified) + " · độ trễ revert: " +
      (artifact.revertLatencyMs === null ? "—" : String(artifact.revertLatencyMs) + " ms") +
      " · patch ghi lại nguyên văn: " + String(artifact.patchRestored) + " (bản gốc: " + artifact.patchBackupFile + ")",
  );
  for (const skip of artifact.skips) console.log("- " + skip);
  if (artifact.hostLogLines.length > 0) {
    console.log("log host (đã che token):");
    for (const line of artifact.hostLogLines.slice(-10)) console.log("  · " + line);
  }
  console.log("artifact: " + parityRelative("hmr", artifact.stamp));
}

/**
 * Điểm vào CLI `parity:hmr`.
 * @param argv tham số sau tên script (`--port`, `--timeout-ms`, `--json`).
 * @returns 0 khi HMR chạy đúng, 1 khi không phát hiện hoặc ảnh không trở lại baseline.
 */
export async function main(argv: string[]): Promise<number> {
  const portArg = argv[argv.indexOf("--port") + 1];
  const timeoutArg = argv[argv.indexOf("--timeout-ms") + 1];
  const artifact = await runHmr({
    port: argv.includes("--port") && Number.isFinite(Number(portArg)) ? Number(portArg) : undefined,
    timeoutMs: argv.includes("--timeout-ms") && Number.isFinite(Number(timeoutArg)) ? Number(timeoutArg) : undefined,
    quiet: argv.includes("--json"),
  });
  if (argv.includes("--json")) {
    console.log(JSON.stringify(artifact, null, 2));
    return artifact.verdict === "PASS" ? 0 : 1;
  }
  printHmrSummary(artifact);
  return artifact.verdict === "PASS" ? 0 : 1;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
