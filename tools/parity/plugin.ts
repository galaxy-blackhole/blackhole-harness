/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:plugin — cài plugin NGOÀI (tự viết) vào profile app, chứng minh nạp + chạy, rồi trả nguyên trạng
 */

import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ARTIFACT_FORMAT, parityRelative, relativeToRepo, writeJsonFile, writeTextFile } from "./lib/artifacts.ts";
import {
  type ChromeSession,
  capturePage,
  closeChromeSession,
  launchChrome,
  resolveSessionCookieFrom,
} from "./lib/browser.ts";
import { OURS_PORT, appHome, credentialsPath, ensureDir, log, nowIso, parityPath, stamp } from "./lib/paths.ts";
import { runDumpConfig } from "./lib/runner.ts";
import { appTarget } from "./lib/targets.ts";

/** Tên package plugin thử nghiệm (bên ngoài repo, tự viết). */
export const PROBE_PACKAGE = "@galaxy-blackhole/gbh-parity-probe";

/** Khoá toàn cục mà client bundle của plugin set khi được nạp. */
export const PROBE_MARKER_KEY = "__GBH_PARITY_PROBE__";

/** Giá trị marker — bằng chứng bundle ngoài đã được client loader materialize. */
export const PROBE_MARKER_VALUE = "gbh-parity-probe-ok";

/** Một bước của phép đo plugin-compat. */
export interface PluginStep {
  /** Tên bước. */
  phase: string;
  /** Thời điểm ISO. */
  at: string;
  /** Ghi chú/số liệu. */
  note: string;
}

/** Artifact của một lần `parity:plugin`. */
export interface PluginCompatArtifact {
  /** Phiên bản định dạng. */
  format: number;
  /** Dấu thời gian. */
  stamp: string;
  /** Bắt đầu/kết thúc. */
  startedAt: string;
  /** Kết thúc. */
  finishedAt: string;
  /** Package plugin ngoài đã cài. */
  packageName: string;
  /** Thư mục nguồn của plugin (trong .parity, không phải repo sản phẩm). */
  sourceDir: string;
  /** Nơi đã cài vào profile app. */
  installedAt: string;
  /** File patch của profile đã sửa (rồi trả lại). */
  patchFile: string;
  /** Bản sao lưu nguyên văn patch. */
  patchBackupFile: string;
  /** true khi dump-config của app có row mới. */
  dumpHasRow: boolean;
  /** true khi bundle client của plugin đã chạy và set marker trong trình duyệt. */
  markerSeen: boolean;
  /** true khi file patch được trả về NGUYÊN VĂN. */
  patchRestored: boolean;
  /** true khi gỡ cài đặt và row biến mất khỏi dump. */
  removedAfterTest: boolean;
  /** Các bước đã làm. */
  steps: PluginStep[];
  /** Kết luận. */
  verdict: "PASS" | "FAIL" | "SKIP";
  /** Việc bị bỏ kèm lý do. */
  skips: string[];
}

/** Nội dung host plugin tối thiểu (tương thích cordis: named + default export). */
export const PROBE_HOST_SOURCE = `/**
 * Plugin thử nghiệm của giàn parity — chỉ ghi log khi được nạp.
 */
export const name = "${PROBE_PACKAGE}";
/**
 * Ghi một dòng log khi plugin được host nạp — dấu hiệu nhỏ nhất chứng minh plugin NGOÀI chạy được.
 * @param ctx context cordis do host truyền vào.
 * @returns không trả gì.
 */
export function apply(ctx) {
  try {
    ctx?.logger?.info?.("[parity-probe] activated");
  } catch {
    // không được làm hỏng host vì log
  }
}
export default { name, apply };
`;

/** Nội dung client bundle: đúng dạng lazy-CJS factory mà dsh-client-modules chờ đợi. */
export const PROBE_CLIENT_SOURCE = `window.__ModuleLoader__.load({
  id: "${PROBE_PACKAGE}",
  factory: (require) => {
    var module = { exports: {} };
    globalThis.${PROBE_MARKER_KEY} = "${PROBE_MARKER_VALUE}";
    const plugin = { name: "${PROBE_PACKAGE}", apply() {} };
    module.exports = plugin;
    module.exports.default = plugin;
    return module.exports;
  },
});
`;

/**
 * Tạo package plugin thử nghiệm trong `.parity/plugin-probe` (không nằm trong repo sản phẩm).
 * @returns đường dẫn thư mục plugin.
 */
export function writeProbePackage(): string {
  const dir = ensureDir(parityPath("plugin-probe"));
  ensureDir(join(dir, "lib"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: PROBE_PACKAGE,
        version: "0.0.1",
        private: true,
        type: "module",
        main: "lib/index.js",
        dsh: { client: { platform: "web", inject: [] } },
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(join(dir, "lib", "index.js"), PROBE_HOST_SOURCE);
  writeFileSync(join(dir, "lib", "client.js"), PROBE_CLIENT_SOURCE);
  return dir;
}

/**
 * Cài plugin vào node_modules của profile app bằng symlink (gỡ được, không copy rác).
 * @param profileDir thư mục profile.
 * @param sourceDir thư mục nguồn plugin.
 * @returns đường dẫn đã cài.
 */
export function installProbe(profileDir: string, sourceDir: string): string {
  const scope = join(profileDir, "node_modules", "@galaxy-blackhole");
  mkdirSync(scope, { recursive: true });
  const target = join(scope, "gbh-parity-probe");
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  symlinkSync(sourceDir, target, "dir");
  return target;
}

/**
 * Chạy `parity:plugin`: cài plugin ngoài vào profile, chứng minh nạp/chạy, rồi trả nguyên trạng.
 * @param options tuỳ chọn.
 * @returns artifact đã ghi xuống `.parity/plugins/<stamp>/`.
 */
export async function runPluginCompat(options: { port?: number; quiet?: boolean } = {}): Promise<PluginCompatArtifact> {
  const startedAt = nowIso();
  const runStamp = stamp();
  const dir = ensureDir(parityPath("plugins", runStamp));
  const port = options.port ?? OURS_PORT;
  const profileDir = join(appHome(), "profiles", "blackhole");
  const patchFile = join(profileDir, "cordis.patch.yml");
  const steps: PluginStep[] = [];
  const skips: string[] = [];
  const sourceDir = writeProbePackage();
  const patchBackupFile = writeTextFile(join(dir, "patch-nguyen-ban.yml"), existsSync(patchFile) ? readFileSync(patchFile, "utf8") : "");
  const original = existsSync(patchFile) ? readFileSync(patchFile, "utf8") : "";
  let installedAt = "";
  let dumpHasRow = false;
  let markerSeen = false;
  let removedAfterTest = false;
  let session: ChromeSession | null = null;
  const target = appTarget();

  try {
    installedAt = installProbe(profileDir, sourceDir);
    steps.push({ phase: "cài plugin (symlink)", at: nowIso(), note: installedAt });
    writeFileSync(patchFile, original.replace(/\s*$/u, "") + "\n\n- id: parity-probe\n  name: '" + PROBE_PACKAGE + "'\n");
    steps.push({ phase: "thêm row vào patch profile", at: nowIso(), note: patchFile });
    await new Promise((resolve) => setTimeout(resolve, 7000));

    const dump = runDumpConfig(target);
    dumpHasRow = dump.ok && dump.raw.includes("parity-probe") && dump.raw.includes(PROBE_PACKAGE);
    steps.push({
      phase: "dump-config của app",
      at: nowIso(),
      note: (dumpHasRow ? "CÓ row parity-probe" : "KHÔNG thấy row") + " · " + String(dump.raw.split("\n").length) + " dòng",
    });

    session = await launchChrome(parityPath("tmp"), runStamp + "-plugin");
    const auth = resolveSessionCookieFrom(port, [credentialsPath(), join(appHome(), ".credentials.yaml")]);
    const shot = await capturePage(session, {
      url: "http://127.0.0.1:" + String(port) + "/",
      width: 1440,
      height: 900,
      cookie: auth.cookie,
      settleMs: 2500,
    });
    if (!shot.ok) skips.push("không mở được app để kiểm marker: " + (shot.error ?? "?"));
    steps.push({ phase: "mở app (sau khi cài)", at: nowIso(), note: shot.ok ? "app trả lời OK" : "lỗi" });
  } finally {
    // Gỡ cài đặt + trả patch NGUYÊN VĂN (kể cả khi lỗi ở trên).
    writeFileSync(patchFile, original);
    if (installedAt !== "" && existsSync(installedAt)) rmSync(installedAt, { recursive: true, force: true });
  }

  try {
    if (session !== null) {
      const page = await session.context.newPage();
      try {
        await page.goto("http://127.0.0.1:" + String(port) + "/", { waitUntil: "load", timeout: 30_000 });
        await page
          .waitForFunction(() => document.querySelectorAll("button").length >= 3, { timeout: 20_000 })
          .catch(() => undefined);
        await page.waitForTimeout(2500);
        markerSeen = await page.evaluate((key: string) => (globalThis as never as Record<string, unknown>)[key] === "gbh-parity-probe-ok", PROBE_MARKER_KEY);
      } finally {
        await page.close().catch(() => undefined);
      }
      steps.push({ phase: "kiểm marker client bundle", at: nowIso(), note: markerSeen ? "marker CÓ" : "marker KHÔNG thấy" });
    }
  } finally {
    await closeChromeSession(session);
  }

  await new Promise((resolve) => setTimeout(resolve, 4000));
  const dumpAfter = runDumpConfig(target);
  removedAfterTest = !(dumpAfter.ok && dumpAfter.raw.includes(PROBE_PACKAGE));
  const patchRestored = existsSync(patchFile) && readFileSync(patchFile, "utf8") === original;
  steps.push({
    phase: "gỡ cài đặt + trả patch",
    at: nowIso(),
    note: "patch nguyên văn: " + String(patchRestored) + " · row biến mất khỏi dump: " + String(removedAfterTest),
  });

  const artifact: PluginCompatArtifact = {
    format: ARTIFACT_FORMAT,
    stamp: runStamp,
    startedAt,
    finishedAt: nowIso(),
    packageName: PROBE_PACKAGE,
    sourceDir: relativeToRepo(sourceDir),
    installedAt,
    patchFile,
    patchBackupFile: relativeToRepo(patchBackupFile),
    dumpHasRow,
    markerSeen,
    patchRestored,
    removedAfterTest,
    steps,
    verdict: dumpHasRow && markerSeen && patchRestored && removedAfterTest ? "PASS" : "FAIL",
    skips,
  };
  writeJsonFile(join(dir, "summary.json"), artifact);
  writeJsonFile(parityPath("latest-plugin.json"), artifact);
  if (!options.quiet) printPluginSummary(artifact);
  return artifact;
}

/**
 * In tóm tắt phép đo plugin-compat.
 * @param artifact artifact của lần đo.
 * @returns không trả gì.
 */
export function printPluginSummary(artifact: PluginCompatArtifact): void {
  console.log("");
  console.log("=== parity:plugin — " + artifact.stamp + " → " + artifact.verdict + " ===");
  console.log("| bước | ghi chú |");
  console.log("|---|---|");
  for (const step of artifact.steps) console.log("| " + step.phase + " | " + step.note + " |");
  console.log("");
  console.log("row mới trong dump: " + String(artifact.dumpHasRow) + " · marker client bundle: " + String(artifact.markerSeen));
  console.log("trả patch nguyên văn: " + String(artifact.patchRestored) + " · gỡ cài đặt sạch: " + String(artifact.removedAfterTest));
  for (const skip of artifact.skips) console.log("- SKIP: " + skip);
  console.log("artifact: " + parityRelative("plugins", artifact.stamp));
}

/**
 * Điểm vào CLI `parity:plugin`.
 * @param argv tham số sau tên script.
 * @returns 0 khi PASS, 1 khi FAIL.
 */
export async function main(argv: string[]): Promise<number> {
  const portIndex = argv.indexOf("--port");
  const artifact = await runPluginCompat({
    port: portIndex === -1 ? undefined : Number(argv[portIndex + 1]),
    quiet: argv.includes("--json"),
  });
  if (argv.includes("--json")) {
    console.log(JSON.stringify(artifact, null, 2));
    return artifact.verdict === "PASS" ? 0 : 1;
  }
  return artifact.verdict === "PASS" ? 0 : 1;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
