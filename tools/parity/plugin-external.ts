/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:plugin-external — MỘT lệnh làm đủ ba bước cho mục tiêu G1: cài plugin NGOÀI từ npm bằng
 *      ĐÚNG đường của DSH, chứng minh nó được NẠP và CHẠY, so thêm phía oracle B, rồi gỡ và khôi phục
 *      app về NGUYÊN BYTE. Phần npm/profile/UI nằm ở lib/plugin-npm · lib/plugin-profile · lib/plugin-ui
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ARTIFACT_FORMAT, parityRelative, writeJsonFile, writeTextFile } from "./lib/artifacts.ts";
import { type ChromeSession, closeChromeSession, launchChrome } from "./lib/browser.ts";
import { assessUrlHealth, describeHealth, findInvalidWindow } from "./lib/health.ts";
import {
  type CommandRun,
  type PnpmInfo,
  type TarballCheck,
  EXTERNAL_PLUGIN,
  checkTarball,
  ensurePnpm,
  runDshPlugin,
} from "./lib/plugin-npm.ts";
import { type PeerComparison, compareWithPeer } from "./lib/plugin-peer.ts";
import {
  type HomeStateVerification,
  dumpHasPluginRow,
  listSeededFiles,
  readHostLogLines,
  readProfileSnapshot,
  restoreProfile,
  verifyHomeState,
} from "./lib/plugin-profile.ts";
import {
  type ClientProof,
  type RouteProbe,
  captureBaselineSettings,
  captureClientProof,
  cookieFor,
  describeClientHealth,
  pageBytes,
  probeRoute,
} from "./lib/plugin-ui.ts";
import { ORACLE_A_PORT, OURS_PORT, appHome, ensureDir, nowIso, parityPath, stamp } from "./lib/paths.ts";

/** Một bước của phép đo. */
export interface ExternalStep {
  /** Tên bước. */
  phase: string;
  /** Thời điểm ISO. */
  at: string;
  /** Ghi chú/số liệu. */
  note: string;
}

/** Artifact của một lần chạy parity:plugin-external. */
export interface ExternalPluginArtifact {
  /** Phiên bản định dạng. */
  format: number;
  /** Dấu thời gian. */
  stamp: string;
  /** Bắt đầu. */
  startedAt: string;
  /** Kết thúc. */
  finishedAt: string;
  /** Gói plugin đã cài. */
  plugin: typeof EXTERNAL_PLUGIN;
  /** Đường dẫn profile đã cài vào. */
  profileDir: string;
  /** pnpm dùng để cài (đường nào). */
  pnpm: PnpmInfo;
  /** Đối chiếu tarball registry. */
  tarball: TarballCheck | null;
  /** Kết quả lệnh cài/gỡ của DSH. */
  commands: { install: CommandRun | null; uninstall: CommandRun | null };
  /** Row của plugin trong cây dump-config ở các thời điểm. */
  dumpRow: { before: boolean; during: boolean; afterUninstall: boolean; rowsDuring: number };
  /** Thăm route: app lúc có plugin, đối chứng oracle A, và sau khi gỡ. */
  route: { app: RouteProbe | null; oracleControl: RouteProbe | null; afterUninstall: RouteProbe | null };
  /** Bằng chứng phía trình duyệt của app. */
  client: ClientProof;
  /** Dấu vân tay trạng thái cây plugin (số entry boot graph + số byte trang) trước/trong/sau. */
  fingerprint: {
    /** Số entry __DSH_BOOT__ trước khi cài. */
    bootEntriesBefore: number;
    /** Số entry __DSH_BOOT__ khi plugin đang cài. */
    bootEntriesDuring: number;
    /** Số entry __DSH_BOOT__ sau khi gỡ. */
    bootEntriesAfter: number;
  };
  /** Bằng chứng plugin chạy thật ở nửa host. */
  hostEvidence: {
    /** Các dòng log do chính plugin ghi (bằng chứng nó chạy). */
    logLines: string[];
    /** Các tệp plugin gieo vào home. */
    seededFiles: string[];
    /** Số byte settings.yaml mà plugin sửa (null nếu không có). */
    settingsBytes: number | null;
  };
  /** Số byte trang chủ ở các thời điểm (bằng chứng byte, không phải HTTP 200). */
  pageBytes: { oursBefore: number | null; oursDuring: number | null; oursAfter: number | null; oracle: number | null };
  /** Trạng thái app ở các thời điểm. */
  health: { before: string; during: string; after: string };
  /** State ở home sau khi gỡ: settings.yaml, settings.yaml.imported, .agent-presets (bài học lượt 13:43). */
  homeState: HomeStateVerification;
  /** Kết quả khôi phục. */
  restore: {
    /** true khi mọi tệp profile giống NGUYÊN BYTE ảnh chụp. */
    filesIdentical: boolean;
    /** Từng tệp: sha trước và sau. */
    files: { name: string; before: string; after: string }[];
    /** Các đường dẫn đã tạo thêm và được dọn. */
    removedPaths: string[];
  };
  /** Phép so hai phía với oracle B (null nếu bỏ qua). */
  peer: PeerComparison | null;
  /** Kết luận rút ra từ phép so hai phía (rỗng nếu không chạy). */
  peerConclusion: string;
  /** Các bước đã làm. */
  steps: ExternalStep[];
  /** Kết luận. */
  verdict: "PASS" | "FAIL" | "SKIP";
  /** Việc bị bỏ kèm lý do. */
  skips: string[];
}

/**
 * Sinh bản Markdown của artifact (để dán vào báo cáo).
 * @param artifact artifact của lần đo.
 * @param failed danh sách bằng chứng chưa đạt.
 * @returns khối Markdown.
 */
export function formatExternalArtifact(artifact: ExternalPluginArtifact, failed: readonly string[]): string {
  const lines: string[] = [];
  const { client, peer } = artifact;
  lines.push("### plugin-compat (G1): plugin NGOÀI " + artifact.plugin.name + "@" + artifact.plugin.version + " → " + artifact.verdict);
  lines.push("");
  lines.push("| bằng chứng | số liệu |");
  lines.push("|---|---|");
  lines.push(
    "| tarball registry | " +
      (artifact.tarball === null
        ? "—"
        : artifact.tarball.bytes + " B · sha512 khớp=" + String(artifact.tarball.integrityOk) + " · magic gzip=" + String(artifact.tarball.gzipMagicOk)) +
      " |",
  );
  lines.push("| đường cài | dsh plugin --profile blackhole add -w " + artifact.plugin.name + " · pnpm " + artifact.pnpm.version + " (" + artifact.pnpm.source + ") |");
  lines.push(
    "| row trong cây dump | " + String(artifact.dumpRow.rowsDuring) + " row · có row plugin=" + String(artifact.dumpRow.during) + " · sau khi gỡ còn row=" +
      String(!artifact.dumpRow.afterUninstall) + " |",
  );
  lines.push(
    "| route host " + artifact.plugin.route + " | app " + String(artifact.route.app?.status ?? -1) + " (" + String(artifact.route.app?.bytes ?? 0) + " B) · đối chứng oracle A " +
      String(artifact.route.oracleControl?.status ?? -1) + " · sau khi gỡ " + String(artifact.route.afterUninstall?.status ?? -1) + " |",
  );
  lines.push(
    "| boot graph của trình duyệt | entry plugin=" + String(client.pluginBootEntries.length) + " · bundle client=" + (client.bundleHits.map((hit) => hit.bytes).join("/") || "0") +
      " B · marker trong bundle=" + String(client.bundleMarkerFound) + " |",
  );
  lines.push(
    "| trang Settings của plugin | mục mới trong nav=" + JSON.stringify(client.addedNavItems) + " · thấy nhãn=" + String(client.navLabelSeen) + " · hiện sau " +
      (client.pageVisibleAfterMs === null ? "KHÔNG hiện trong hạn chờ" : String(client.pageVisibleAfterMs) + " ms") + " |",
  );
  lines.push("| ảnh | " + (client.screenshot ?? "—") + " |");
  lines.push(
    "| dấu vân tay cây plugin | entry boot trước/trong/sau = " + String(artifact.fingerprint.bootEntriesBefore) + "/" + String(artifact.fingerprint.bootEntriesDuring) + "/" +
      String(artifact.fingerprint.bootEntriesAfter) + " · byte trang trước/trong/sau = " + String(artifact.pageBytes.oursBefore ?? -1) + "/" +
      String(artifact.pageBytes.oursDuring ?? -1) + "/" + String(artifact.pageBytes.oursAfter ?? -1) + " |",
  );
  lines.push(
    "| plugin chạy thật ở nửa host | dòng log riêng=" + String(artifact.hostEvidence.logLines.length) + " · tệp gieo vào home=" + String(artifact.hostEvidence.seededFiles.length) +
      " · settings.yaml=" + String(artifact.hostEvidence.settingsBytes ?? -1) + " B |",
  );
  if (peer !== null) {
    lines.push(
      "| so hai phía (oracle B) | cài exit=" + String(peer.commands.install?.exitCode ?? -1) + " · row plugin=" + String(peer.dumpRow.has) + " · route " +
        String(peer.routeBefore?.status ?? -1) + " → " + String(peer.routeDuring?.status ?? -1) + " · entry boot=" +
        String(peer.client?.pluginBootEntries.length ?? 0) + " · mục Settings thêm=" + JSON.stringify(peer.client?.addedNavItems ?? []) + " · khôi phục=" + String(peer.restored) + " |",
    );
  }
  if (artifact.peerConclusion !== "") {
    lines.push("");
    lines.push("- **kết luận hai phía:** " + artifact.peerConclusion);
  }
  lines.push("| trạng thái app | trước: " + artifact.health.before + " · khi cài: " + artifact.health.during + " · sau: " + artifact.health.after + " |");
  lines.push("| khôi phục profile | byte khớp ảnh chụp=" + String(artifact.restore.filesIdentical) + " · dọn " + String(artifact.restore.removedPaths.length) + " đường dẫn |");
  lines.push(
    "| khôi phục STATE Ở HOME | sạch=" + String(artifact.homeState.clean) + " · " +
      artifact.homeState.files.map((file) => file.name + " (trước=" + String(file.existedBefore) + " → sau=" + String(file.existsAfter) + ")").join(" · ") +
      " · .agent-presets " + String(artifact.homeState.agentPresetsBefore) + " → " + String(artifact.homeState.agentPresetsAfter) + " tệp |",
  );
  lines.push("");
  if (failed.length > 0) lines.push("- bằng chứng CHƯA đạt: " + failed.join(" · "));
  for (const skip of artifact.skips) lines.push("- SKIP/GHI CHÚ: " + skip);
  return lines.join("\n");
}

/**
 * In tóm tắt phép đo ra console.
 * @param artifact artifact của lần đo.
 * @param failed danh sách bằng chứng chưa đạt.
 * @returns không trả gì.
 */
export function printExternalSummary(artifact: ExternalPluginArtifact, failed: readonly string[]): void {
  console.log("");
  console.log("=== parity:plugin-external — " + artifact.stamp + " → " + artifact.verdict + " ===");
  console.log(formatExternalArtifact(artifact, failed));
  for (const step of artifact.steps) console.log("- " + step.phase + ": " + step.note);
  console.log("artifact: " + parityRelative("plugins", artifact.stamp + "-external"));
}

/**
 * Chạy trọn phép đo: cài plugin NGOÀI bằng đường của DSH, chứng minh nạp + chạy, so phía oracle B, gỡ sạch.
 * @param options cổng app, cổng oracle A, bỏ phép so hai phía, giữ plugin sau khi đo, im lặng.
 * @returns artifact đã ghi xuống .parity/plugins/<stamp>-external/.
 */
export async function runExternalPluginCompat(
  options: { port?: number; oraclePort?: number; noPeer?: boolean; keep?: boolean; quiet?: boolean } = {},
): Promise<ExternalPluginArtifact> {
  const startedAt = nowIso();
  const runStamp = stamp();
  const dir = ensureDir(parityPath("plugins", runStamp + "-external"));
  const port = options.port ?? OURS_PORT;
  const oraclePort = options.oraclePort ?? ORACLE_A_PORT;
  const home = appHome();
  const profile = "blackhole";
  const steps: ExternalStep[] = [];
  const skips: string[] = [];
  const mark = (phase: string, note: string): void => {
    steps.push({ phase, at: nowIso(), note });
  };
  const invalid = findInvalidWindow();
  if (invalid !== null) skips.push("thời điểm đo nằm trong INVALID_WINDOWS " + invalid.from + "–" + invalid.to + " — " + invalid.why);
  const pnpm = ensurePnpm();
  mark("tìm pnpm", pnpm.ok ? pnpm.version + " (" + pnpm.source + ")" : "KHÔNG CÓ: " + pnpm.note);
  if (!pnpm.ok) skips.push("không có pnpm: " + pnpm.note);

  const snapshot = readProfileSnapshot(home, profile);
  mark("chụp trạng thái trước khi cài", snapshot.files.map((file) => file.name + "=" + file.sha256.slice(0, 12)).join(" · "));
  const tarball = await checkTarball(EXTERNAL_PLUGIN.name, EXTERNAL_PLUGIN.version, EXTERNAL_PLUGIN.integrity).catch(() => null);
  mark(
    "đối chiếu tarball registry",
    tarball === null
      ? "không tải được"
      : tarball.bytes + " B · sha512 khớp=" + String(tarball.integrityOk) + " · magic gzip=" + String(tarball.gzipMagicOk),
  );

  let session: ChromeSession | null = null;
  let installRun: CommandRun | null = null;
  let uninstallRun: CommandRun | null = null;
  let dumpDuring = { has: false, rows: 0, lines: 0 };
  let cookie: { name: string; value: string } | null = null;
  let baselineNav: string[] = [];
  let baselineBootEntries = 0;
  let healthBefore = "chưa đo";
  let healthDuring = "chưa đo";
  let healthAfter = "chưa đo";
  let client: ClientProof = {
    bootEntryCount: 0,
    pluginBootEntries: [],
    bundleHits: [],
    bundleMarkerFound: false,
    baselineNav: [],
    pluginNav: [],
    addedNavItems: [],
    navLabelSeen: false,
    pageVisibleAfterMs: null,
    health: null,
    screenshot: null,
  };
  let restore = {
    filesIdentical: false,
    files: [] as { name: string; before: string; after: string }[],
    removedPaths: [] as string[],
  };
  let peer: PeerComparison | null = null;
  let routeApp: RouteProbe | null = null;
  let routeOracle: RouteProbe | null = null;
  let routeAfter: RouteProbe | null = null;
  let bytesBefore: number | null = null;
  let bytesDuring: number | null = null;
  let bytesAfter: number | null = null;
  let bootEntriesAfter = 0;
  let homeState: HomeStateVerification = { files: [], agentPresetsBefore: -1, agentPresetsAfter: -1, clean: false };
  let hostEvidenceDuring: { logLines: string[]; seededFiles: string[]; settingsBytes: number | null } = {
    logLines: [],
    seededFiles: [],
    settingsBytes: null,
  };
  const oracleCookie = cookieFor(oraclePort, home);
  const bytesOracle = await pageBytes(oraclePort, oracleCookie);
  const abort = (): boolean => !pnpm.ok || !healthBefore.startsWith("LÀNH");

  try {
    session = await launchChrome(parityPath("tmp"), runStamp + "-external");
    cookie = cookieFor(port, home);
    const base = await captureBaselineSettings(session, port, cookie);
    baselineNav = base.nav;
    baselineBootEntries = base.bootEntries;
    healthBefore = describeHealth(base.health);
    bytesBefore = await pageBytes(port, cookie);
    mark("cổng trạng thái TRƯỚC khi cài", healthBefore + " · trang " + String(bytesBefore ?? -1) + " B");
    if (!base.health.ok) skips.push("app không LÀNH trước khi cài → SKIP: " + healthBefore);

    if (!abort()) {
      installRun = runDshPlugin(home, profile, ["add", "-w", EXTERNAL_PLUGIN.name], pnpm.bin);
      mark(
        "cài plugin ngoài bằng đường chính thức của DSH",
        "exit=" + String(installRun.exitCode) + " · " + String(installRun.durationMs) + "ms · " + installRun.output.split("\n").slice(-2).join(" | "),
      );
      await new Promise((resolve) => setTimeout(resolve, 8000));
      dumpDuring = dumpHasPluginRow(home, profile, EXTERNAL_PLUGIN.dumpRowId, EXTERNAL_PLUGIN.name);
      mark("cây dump-config", String(dumpDuring.rows) + " row · có row plugin=" + String(dumpDuring.has));
      routeApp = await probeRoute(port, EXTERNAL_PLUGIN.route, cookie);
      routeOracle = await probeRoute(oraclePort, EXTERNAL_PLUGIN.route, oracleCookie);
      mark("route riêng của plugin (nửa host)", "app " + String(routeApp.status) + " · " + String(routeApp.bytes) + " B · đối chứng oracle A " + String(routeOracle.status));
      client = await captureClientProof(session, port, cookie, join(dir, "settings-with-plugin.png"), baselineNav);
      hostEvidenceDuring = collectHostEvidence();
      healthDuring = describeClientHealth(client.health);
      bytesDuring = await pageBytes(port, cookie);
      mark(
        "bằng chứng phía trình duyệt",
        "entry boot=" + String(client.pluginBootEntries.length) + " · tổng entry=" + String(client.bootEntryCount) + " · bundle=" +
          (client.bundleHits.map((hit) => hit.bytes).join("/") || "0") + " B · marker=" + String(client.bundleMarkerFound) + " · mục Settings thêm=" +
          String(client.addedNavItems.length) + " · trang hiện sau " + String(client.pageVisibleAfterMs ?? -1) + " ms",
      );
      mark("cổng trạng thái KHI CÀI", healthDuring + " · trang " + String(bytesDuring ?? -1) + " B");
      if (!options.noPeer && pnpm.ok) {
        peer = await compareWithPeer(session, pnpm, join(dir, "settings-oracleB.png"));
        mark(
          "so hai phía với oracle B",
          "route " + String(peer.routeBefore?.status ?? -1) + " → " + String(peer.routeDuring?.status ?? -1) + " · mục Settings thêm=" +
            JSON.stringify(peer.client?.addedNavItems ?? []) + " · khôi phục=" + String(peer.restored),
        );
      }
    }
  } catch (error) {
    skips.push("lỗi trong lượt đo: " + (error instanceof Error ? error.message : String(error)));
  } finally {
    // Bằng chứng host: hợp nhất bản thu TRONG LƯỢT ĐO với bản đọc ở cuối — plugin ghi log hơi muộn và
    // `bh host` ghi lại log mỗi lần restart, nên chỉ đọc một thời điểm là thiếu.
    const finalEvidence = collectHostEvidence();
    const hostEvidence = {
      logLines: [...new Set([...hostEvidenceDuring.logLines, ...finalEvidence.logLines])],
      seededFiles: hostEvidenceDuring.seededFiles.length >= finalEvidence.seededFiles.length ? hostEvidenceDuring.seededFiles : finalEvidence.seededFiles,
      settingsBytes: finalEvidence.settingsBytes ?? hostEvidenceDuring.settingsBytes,
    };
    if (installRun !== null && installRun.ok && pnpm.ok) {
      if (options.keep) {
        skips.push("--keep: cố ý giữ plugin lại để khảo sát, KHÔNG gỡ");
      } else {
        uninstallRun = runDshPlugin(home, profile, ["remove", "-w", EXTERNAL_PLUGIN.name], pnpm.bin);
        mark("gỡ plugin bằng đường chính thức", "exit=" + String(uninstallRun.exitCode) + " · " + String(uninstallRun.durationMs) + "ms");
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const restored = restoreProfile(home, snapshot);
    restore = {
      filesIdentical: restored.files.every((file) => file.before === file.after && file.before !== ""),
      files: restored.files,
      removedPaths: restored.removed,
    };
    homeState = verifyHomeState(home, snapshot);
    mark(
      "khôi phục profile + STATE Ở HOME",
      "profile byte khớp=" + String(restore.filesIdentical) + " · home state sạch=" + String(homeState.clean) + " · dọn " + String(restored.removed.length) + " đường dẫn · " +
        homeState.files.map((file) => file.name + "(trước=" + String(file.existedBefore) + ",sau=" + String(file.existsAfter) + ")").join(" · "),
    );
    routeAfter = await probeRoute(port, EXTERNAL_PLUGIN.route, cookie).catch(() => null);
    bytesAfter = await pageBytes(port, cookie);
    if (session !== null) {
      const check = await evaluateAfter(session, port, cookie);
      healthAfter = check.health;
      bootEntriesAfter = check.bootEntries;
      mark("cổng trạng thái SAU khi gỡ", healthAfter + " · trang " + String(bytesAfter ?? -1) + " B · tổng entry=" + String(bootEntriesAfter));
    }
    await closeChromeSession(session);
    return finish(hostEvidence);
  }

  async function evaluateAfter(
    active: ChromeSession,
    activePort: number,
    activeCookie: { name: string; value: string } | null,
  ): Promise<{ health: string; bootEntries: number }> {
    const page = await active.context.newPage();
    try {
      if (activeCookie !== null) {
        await active.context.addCookies([{ name: activeCookie.name, value: activeCookie.value, domain: "127.0.0.1", path: "/" }]);
      }
      await page.goto("http://127.0.0.1:" + String(activePort) + "/", { waitUntil: "load", timeout: 30_000 });
      await page.waitForTimeout(2500);
      const bootEntries: number = await page.evaluate(() => {
        const scope = globalThis as unknown as Record<string, unknown>;
        // task-31: ưu tiên __GBH_BOOT__, fallback alias __GBH_BOOT__ (alias __DSH_BOOT__).
        const wire = (scope.__GBH_BOOT__ ?? scope.__DSH_BOOT__ ?? null) as { entries?: unknown[] } | null;
        return (wire?.entries ?? []).length;
      });
      const report = await assessUrlHealth(active.context, "http://127.0.0.1:" + String(activePort) + "/", {
        cookie: activeCookie,
        waitMs: 1500,
      });
      if (!report.ok) skips.push("app không LÀNH sau khi gỡ: " + describeHealth(report));
      return { health: describeHealth(report), bootEntries };
    } catch {
      return { health: "không đo được", bootEntries: 0 };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  function collectHostEvidence(): { logLines: string[]; seededFiles: string[]; settingsBytes: number | null } {
    return {
      logLines: readHostLogLines(home, "host-5439.log", EXTERNAL_PLUGIN.name),
      seededFiles: listSeededFiles(home, ".agent-presets/custom"),
      settingsBytes: existsSync(join(home, "settings.yaml")) ? Buffer.byteLength(readFileSync(join(home, "settings.yaml"), "utf8"), "utf8") : null,
    };
  }

  function finish(hostEvidence: { logLines: string[]; seededFiles: string[]; settingsBytes: number | null }): ExternalPluginArtifact {
    const dumpAfter = dumpHasPluginRow(home, profile, EXTERNAL_PLUGIN.dumpRowId, EXTERNAL_PLUGIN.name);
    const evidence: Record<string, boolean> = {
      tarballByteOk: tarball !== null && tarball.integrityOk && tarball.gzipMagicOk,
      installed: installRun !== null && installRun.ok,
      rowAppeared: dumpDuring.has,
      rowGone: !dumpAfter.has,
      hostRunning: routeApp !== null && routeApp.status === 200 && routeApp.bytes > 0,
      oracleControlAbsent: routeOracle !== null && routeOracle.status === 404,
      clientLoaded: client.pluginBootEntries.length > 0 && client.bundleHits.length > 0 && client.bundleMarkerFound,
      hostRan: hostEvidence.seededFiles.length >= 3 || hostEvidence.logLines.length > 0,
      healthyDuring: client.health !== null && client.health.ok,
      routeGoneAfter: routeAfter !== null && routeAfter.status === 404,
      restoredByteExact: restore.filesIdentical,
      homeStateClean: homeState.clean,
    };
    const failed = Object.entries(evidence)
      .filter(([, value]) => !value)
      .map(([key]) => key);
    // Kết luận hai phía: nửa host của plugin chạy ở CẢ hai phía; nửa client chỉ tới trình duyệt khi
    // manifest boot của host đã gồm plugin (app: có; oracle B: không, vì server đã boot trước khi cài
    // và không restart) — nên "trang UI không hiện" KHÔNG phải khuyết điểm riêng của ta.
    const peerConclusion =
      peer === null
        ? ""
        : "nửa host chạy ở cả hai phía (route " + String(peer.routeBefore?.status ?? -1) + " → " + String(peer.routeDuring?.status ?? -1) + " trên oracle B, " +
          String(routeApp?.status ?? -1) + " trên app); nửa client chỉ tới trình duyệt khi manifest boot của host đã gồm plugin — app: mục Settings " +
          JSON.stringify(client.addedNavItems) + "; oracle B: " + JSON.stringify(peer.client?.addedNavItems ?? []) +
          " (server oracle B đã boot trước khi cài và không restart, nên manifest cũ)";
    if (client.pageVisibleAfterMs === null) {
      skips.push(
        "nửa client ĐÃ tới trình duyệt (entry boot + bundle + marker) nhưng trang Settings của plugin không hiện trong hạn chờ — " +
          (peer === null ? "chưa so được phía oracle B" : "oracle B cũng vậy: " + JSON.stringify(peer.client?.addedNavItems ?? [])),
      );
    }
    if (bootEntriesAfter !== 0 && bootEntriesAfter !== baselineBootEntries + client.pluginBootEntries.length) {
      skips.push("số entry boot sau khi gỡ = " + String(bootEntriesAfter) + " (manifest sống có thể giữ entry tới khi host restart)");
    }
    const artifact: ExternalPluginArtifact = {
      format: ARTIFACT_FORMAT,
      stamp: runStamp,
      startedAt,
      finishedAt: nowIso(),
      plugin: EXTERNAL_PLUGIN,
      profileDir: snapshot.profileDir,
      pnpm,
      tarball,
      commands: { install: installRun, uninstall: uninstallRun },
      dumpRow: { before: false, during: dumpDuring.has, afterUninstall: !dumpAfter.has, rowsDuring: dumpDuring.rows },
      route: { app: routeApp, oracleControl: routeOracle, afterUninstall: routeAfter },
      client,
      fingerprint: { bootEntriesBefore: baselineBootEntries, bootEntriesDuring: client.bootEntryCount, bootEntriesAfter },
      hostEvidence,
      pageBytes: { oursBefore: bytesBefore, oursDuring: bytesDuring, oursAfter: bytesAfter, oracle: bytesOracle },
      health: { before: healthBefore, during: healthDuring, after: healthAfter },
      homeState,
      restore,
      peer,
      peerConclusion,
      steps,
      verdict: skips.some((skip) => skip.includes("INVALID_WINDOWS") || skip.includes("không LÀNH trước khi cài"))
        ? "SKIP"
        : failed.length === 0
          ? "PASS"
          : "FAIL",
      skips,
    };
    writeJsonFile(join(dir, "external.json"), artifact);
    writeJsonFile(parityPath("latest-plugin-external.json"), artifact);
    writeTextFile(join(dir, "external.md"), formatExternalArtifact(artifact, failed));
    if (!options.quiet) printExternalSummary(artifact, failed);
    return artifact;
  }
  throw new Error("parity: luồng không thể tới đây (thiếu finish)");
}

/**
 * Điểm vào CLI của parity:plugin-external.
 * @param argv tham số sau tên script (--keep, --no-peer, --json, --port <n>, --oracle-port <n>).
 * @returns 0 khi PASS, 1 khi FAIL, 2 khi SKIP.
 */
export async function main(argv: string[]): Promise<number> {
  const portIndex = argv.indexOf("--port");
  const oracleIndex = argv.indexOf("--oracle-port");
  const artifact = await runExternalPluginCompat({
    port: portIndex === -1 ? undefined : Number(argv[portIndex + 1]),
    oraclePort: oracleIndex === -1 ? undefined : Number(argv[oracleIndex + 1]),
    noPeer: argv.includes("--no-peer"),
    keep: argv.includes("--keep"),
    quiet: argv.includes("--json"),
  });
  if (argv.includes("--json")) {
    console.log(JSON.stringify(artifact, null, 2));
    return artifact.verdict === "PASS" ? 0 : artifact.verdict === "SKIP" ? 2 : 1;
  }
  return artifact.verdict === "PASS" ? 0 : artifact.verdict === "SKIP" ? 2 : 1;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
