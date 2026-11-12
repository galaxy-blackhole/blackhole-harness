/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:shot — chụp ảnh A/B cùng viewport/route, pixelmatch, ghi hash bundle vào artifact
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ARTIFACT_FORMAT,
  latestPath,
  parityRelative,
  readJsonFile,
  relativeToRepo,
  shotsDir,
  writeBinaryFile,
  writeJsonFile,
  writeTextFile,
} from "./lib/artifacts.ts";
import {
  type CaptureResult,
  type ChromeSession,
  type SessionCookie,
  capturePage,
  closeChromeSession,
  hashList,
  launchChrome,
  resolveSessionCookieFrom,
} from "./lib/browser.ts";
import {
  type TreeDelta,
  describeTreeDelta,
  diffTrees,
  guardVerdict,
  protectedGalaxyGbh,
  sampleChangedPaths,
  snapshotTree,
} from "./lib/guard.ts";
import { pixelDiff, pngSize, ratioPercent } from "./lib/image.ts";
import { enterSession } from "./lib/session-entry.ts";
import {
  type MaskRegion,
  type ResolvedMask,
  DEFAULT_MASKS,
  buildIgnoreMask,
  describeMasks,
  parseMaskFile,
  resolveMasks,
  unmaskedPixelCount,
} from "./lib/masks.ts";
import {
  OURS_PORT,
  ORACLE_A_PORT,
  PIXEL_THRESHOLD_RATIO,
  STOCK_PORT,
  type Viewport,
  VIEWPORTS,
  credentialsPath,
  ensureDir,
  log,
  nowIso,
  parityPath,
  parseViewports,
  stamp,
} from "./lib/paths.ts";
import { httpProbe, startStockServer, stopChild } from "./lib/runner.ts";
import { type DumpTarget, discoverLiveOracle, runtimeVersion, stockTarget } from "./lib/targets.ts";

/** Phiên Chrome đang mở của lần chụp hiện tại; handler SIGINT/SIGTERM dùng để luôn đóng. */
let activeSession: ChromeSession | null = null;

/** Trạng thái một bên (ours hoặc ref) sau khi chụp. */
export interface SideInfo {
  /** Khoá bên: `ours`, `stock`, `oracleA`. */
  key: string;
  /** Nhãn hiển thị. */
  label: string;
  /** URL đã chụp. */
  url: string;
  /** Cổng. */
  port: number;
  /** true khi server trả lời. */
  up: boolean;
  /** Lỗi nếu không chụp được. */
  error?: string;
  /** Cách xác thực đã dùng. */
  authMode: string;
  /** Dấu vân tay ngắn của secret phiên (bằng chứng, KHÔNG phải secret). */
  secretFingerprint: string | null;
  /** Mã HTTP. */
  httpStatus: number;
  /** Tiêu đề trang. */
  title: string;
  /** Danh sách asset. */
  assets: string[];
  /** sha256 danh sách asset (hash bundle). */
  assetsHash: string;
  /** Khoá cấp 1 của boot injection. */
  bootKeys: string[];
  /** sha256 danh sách khoá boot. */
  bootHash: string;
  /** Số module client đã nạp. */
  moduleCount: number;
  /** Số overlay đã ẩn để hai bên cùng trạng thái. */
  hiddenOverlays: number;
  /** true khi trang vẫn còn thẻ thông báo một lần lúc chụp (khác biệt trạng thái). */
  noticeVisible: boolean;
  /** Lỗi console. */
  consoleErrors: string[];
  /** Version harness của bên này. */
  runtime: string | null;
  /** Home harness của bên này. */
  home: string;
  /** Profile của bên này. */
  profile: string;
}

/** Một cặp ảnh đã chụp và so. */
export interface ShotPair {
  /** Route đã chụp. */
  route: string;
  /** Viewport. */
  viewport: string;
  /** Ảnh bên tham chiếu (tương đối repo). */
  refFile: string;
  /** Ảnh bên ta (tương đối repo). */
  oursFile: string;
  /** Ảnh diff (tương đối repo). */
  diffFile: string;
  /** Kích thước ảnh. */
  width: number;
  /** Chiều cao ảnh. */
  height: number;
  /** Số pixel khác nhau. */
  diffPixels: number;
  /** Tổng số pixel. */
  totalPixels: number;
  /** Tỉ lệ khác nhau. */
  ratio: number;
  /** Ngưỡng cho phép. */
  threshold: number;
  /** true khi đạt ngưỡng. */
  pass: boolean;
  /** Ghi chú (SKIP/lý do). */
  note?: string;
  /** Vùng mask đã áp cho khung này (đã quy đổi pixel). */
  masks: ResolvedMask[];
  /** Số pixel bị bỏ qua. */
  maskedPixels: number;
  /** Số pixel khác nhau khi KHÔNG mask. */
  rawDiffPixels: number;
  /** Tỉ lệ thô khi không mask. */
  rawRatio: number;
}

/** Artifact của một lần `parity:shot`. */
export interface ShotArtifact {
  /** Phiên bản định dạng. */
  format: number;
  /** Dấu thời gian. */
  stamp: string;
  /** Bắt đầu (ISO). */
  startedAt: string;
  /** Kết thúc (ISO). */
  finishedAt: string;
  /** Khoá bên tham chiếu. */
  refKey: string;
  /** Trạng thái bên ta. */
  ours: SideInfo;
  /** Trạng thái bên tham chiếu. */
  ref: SideInfo;
  /** Các cặp ảnh. */
  pairs: ShotPair[];
  /** Việc bị bỏ kèm lý do. */
  skips: string[];
  /** Ngưỡng pixel đã áp. */
  threshold: number;
  /** Định nghĩa vùng mask đã dùng cho lần chụp này. */
  maskRegions: MaskRegion[];
  /** true khi lần chụp dùng profile Chrome MỚI (không rò localStorage/IndexedDB giữa các lần đo). */
  freshProfile: boolean;
  /** sha256 ngắn của user-data-dir để chứng minh hai lần chạy không dùng chung profile. */
  profileHash: string;
  /** Chốt an toàn `~/.galaxy/gbh`. */
  guard: { path: string; idle: string; during: string; verdict: string; samples: string[]; changed: boolean };
  /** Kết luận tổng: PASS nếu mọi cặp đạt ngưỡng. */
  verdict: "PASS" | "FAIL" | "SKIP";
}

/** Tuỳ chọn cho {@link runShot}. */
export interface ShotOptions {
  /** Bên tham chiếu: `stock` (oracle B) hoặc `oracleA` (4001). */
  ref?: "stock" | "oracleA";
  /** Cổng của app ta. */
  oursPort?: number;
  /** Cổng của bên tham chiếu. */
  refPort?: number;
  /** Danh sách viewport. */
  viewports?: readonly Viewport[];
  /** Danh sách route. */
  routes?: readonly string[];
  /** Tự boot oracle B khi cổng chưa mở. */
  spawnRef?: boolean;
  /** Giữ oracle B sống sau khi chụp. */
  keepRef?: boolean;
  /** Chế độ im lặng. */
  quiet?: boolean;
  /** Danh sách vùng mask; `[]` nghĩa là so pixel toàn khung. */
  masks?: readonly MaskRegion[];
}

/**
 * Chuẩn bị thông tin một bên trước khi chụp.
 * @param key khoá bên.
 * @param label nhãn hiển thị.
 * @param port cổng.
 * @param target target dump tương ứng (để lấy runtime/home/profile).
 * @returns thông tin bên, đã có auth mode.
 */
export function prepareSide(key: string, label: string, port: number, target: DumpTarget | null): {
  info: SideInfo;
  cookie: SessionCookie | null;
  launchToken: string;
} {
  const url = "http://127.0.0.1:" + String(port) + "/";
  const stores = [credentialsPath()];
  if (target !== null && target.home !== "") stores.push(join(target.home, ".credentials.yaml"));
  const auth = resolveSessionCookieFrom(port, stores);
  return {
    info: {
      key,
      label,
      url,
      port,
      up: false,
      authMode: auth.cookie === null ? "none" : "cookie",
      secretFingerprint: auth.secretFingerprint,
      httpStatus: 0,
      title: "",
      assets: [],
      assetsHash: "",
      bootKeys: [],
      bootHash: "",
      moduleCount: 0,
      hiddenOverlays: 0,
      noticeVisible: false,
      consoleErrors: [],
      runtime: target === null ? null : runtimeVersion(target.bin),
      home: target?.home ?? "",
      profile: target?.profile ?? "",
    },
    cookie: auth.cookie,
    launchToken: "",
  };
}

/**
 * Chụp một bên ở một viewport/route, cập nhật thông tin bên đó.
 * @param browser browser đã mở.
 * @param info thông tin bên (sẽ được cập nhật).
 * @param url URL đầy đủ cần chụp.
 * @param viewport viewport.
 * @param auth cookie/launch token đã chuẩn bị.
 * @returns buffer PNG (null nếu không chụp được).
 */
async function captureSide(
  session: ChromeSession,
  info: SideInfo,
  url: string,
  viewport: Viewport,
  auth: { cookie: SessionCookie | null; launchToken: string },
): Promise<Buffer | null> {
  const result: CaptureResult = await capturePage(session, {
    url,
    width: viewport.width,
    height: viewport.height,
    cookie: auth.cookie,
    launchToken: auth.launchToken,
  });
  info.up = result.ok;
  info.httpStatus = result.httpStatus;
  info.consoleErrors = result.consoleErrors;
  if (!result.ok) {
    info.error = result.error;
    return null;
  }
  if (result.info !== undefined) {
    info.title = result.info.title;
    info.assets = result.info.assets;
    info.assetsHash = result.info.assetsHash;
    info.bootKeys = result.info.bootKeys;
    info.bootHash = result.info.bootHash;
    info.moduleCount = result.info.moduleCount;
    info.hiddenOverlays = Math.max(info.hiddenOverlays, result.info.hiddenOverlays);
    info.noticeVisible = info.noticeVisible || result.info.noticeVisible;
  }
  return result.png ?? null;
}

/**
 * Chạy `parity:shot`: chụp ours vs ref ở mọi viewport/route rồi so pixel.
 * @param options tuỳ chọn.
 * @returns artifact đã ghi xuống `.parity/shots/<stamp>/`.
 */
export async function runShot(options: ShotOptions = {}): Promise<ShotArtifact> {
  // Bị Ctrl-C / bị kill vì quá hạn cũng phải đóng Chrome, nếu không sẽ rò tiến trình.
  const interrupt = (): void => {
    void closeChromeSession(activeSession);
    process.exit(130);
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  const startedAt = nowIso();
  const runStamp = stamp();
  const dir = ensureDir(shotsDir(runStamp));
  const viewports = options.viewports !== undefined && options.viewports.length > 0 ? options.viewports : VIEWPORTS;
  const routes = options.routes !== undefined && options.routes.length > 0 ? options.routes : ["/"];
  const maskRegions = options.masks ?? DEFAULT_MASKS;
  const skips: string[] = [];
  const guardPath = protectedGalaxyGbh();
  const guardBefore = snapshotTree(guardPath, { maxDepth: 3 });
  await new Promise((resolve) => setTimeout(resolve, 800));
  const guardIdle = snapshotTree(guardPath, { maxDepth: 3 });
  const idleDelta: TreeDelta = diffTrees(guardBefore, guardIdle);

  const oursPort = options.oursPort ?? OURS_PORT;
  const refKey = options.ref ?? "stock";
  const refPort = options.refPort ?? (refKey === "oracleA" ? ORACLE_A_PORT : STOCK_PORT);
  const oursSide = prepareSide("ours", "app của ta (cổng " + String(oursPort) + ")", oursPort, null);
  const stockTargetOrNull = refKey === "stock" ? stockTarget() : null;
  const live = refKey === "oracleA" ? discoverLiveOracle(refPort) : null;
  const refSide = prepareSide(
    refKey,
    (refKey === "stock" ? "Oracle B — profile web nguyên bản (cổng " : "Oracle A — blackhole web đang chạy (cổng ") +
      String(refPort) + ")",
    refPort,
    stockTargetOrNull,
  );
  if (refKey === "oracleA" && live !== null) {
    refSide.info.runtime = runtimeVersion(live.bin);
    refSide.info.home = live.home ?? "";
    refSide.info.profile = live.profile;
  }

  let child = null as ReturnType<typeof startStockServer> extends Promise<infer T> ? (T extends { child: infer C } ? C : null) : null;
  let launched = false;
  const oursProbe = await httpProbe(oursSide.info.url, 3000);
  if (!oursProbe.up) {
    skips.push("ours: cổng " + String(oursPort) + " chưa mở (" + (oursProbe.error ?? "?") + ") — chưa so ảnh được");
  }
  const refProbe = await httpProbe(refSide.info.url, 3000);
  if (!refProbe.up) {
    if (refKey === "stock" && options.spawnRef !== false && stockTargetOrNull !== null) {
      log("oracle B chưa mở — parity tự boot trên cổng", refPort);
      const server = await startStockServer(stockTargetOrNull, refPort);
      child = server.child;
      launched = server.ok;
      refSide.launchToken = server.launchToken;
      refSide.info.authMode = server.launchToken === "" ? refSide.info.authMode : "launch-token";
      if (!server.ok) skips.push("ref: không boot được oracle B — " + server.note);
    } else {
      skips.push("ref (" + refKey + "): cổng " + String(refPort) + " chưa mở (" + (refProbe.error ?? "?") + ")");
    }
  }

  const pairs: ShotPair[] = [];
  let chromeSession: ChromeSession | null = null;
  let freshProfile = false;
  let profileHash = "";
  const canCapture = oursProbe.up || refProbe.up || launched;
  if (!canCapture) {
    skips.push("không bên nào sẵn sàng — SKIP toàn bộ phần ảnh");
  } else {
    chromeSession = await launchChrome(parityPath("tmp"), runStamp);
    activeSession = chromeSession;
    // Vào app bằng ĐƯỜNG TOKEN trước (ready-url), secret chỉ là đường lùi — xem lib/session-entry.ts.
    const entryStores = [credentialsPath(), appHome() + "/.credentials.yaml"];
    for (const side of [oursSide, refSide]) {
      if (side.launchToken !== "") continue;
      const entry = await enterSession(chromeSession.context, side.info.port, entryStores);
      if (entry.via !== "none") {
        side.cookie = entry.cookie;
        side.info.authMode = entry.via;
        log("shot: " + side.info.key + " vào app bằng đường " + entry.via + " · " + entry.detail);
      } else {
        log("shot: " + side.info.key + " — DỤNG CỤ KHÔNG VÀO ĐƯỢC · " + entry.detail);
      }
    }
    freshProfile = true;
    profileHash = hashList([chromeSession.userDataDir]).slice(0, 12);
    try {
      let firstPair = true;
      for (const route of routes) {
        for (const viewport of viewports) {
          const suffix = viewport.name + (route === "/" ? "" : "-" + route.replaceAll("/", "_").replaceAll("?", ""));
          const oursUrl = entryUrlFor(oursPort, route);
          const refUrl = "http://127.0.0.1:" + String(refPort) + route;
          const refPng =
            refProbe.up || launched
              ? await captureSide(chromeSession as ChromeSession, refSide.info, refUrl, viewport, {
                  cookie: refSide.cookie,
                  launchToken: refSide.launchToken,
                })
              : null;
          const oursPng = oursProbe.up
            ? await captureSide(chromeSession as ChromeSession, oursSide.info, oursUrl, viewport, {
                cookie: oursSide.cookie,
                launchToken: "",
              })
            : null;
          if (refPng === null || oursPng === null) {
            if (refPng !== null) {
              const only = writeBinaryFile(join(dir, "ref-" + suffix + ".png"), refPng);
              if (firstPair) writeBinaryFile(join(dir, "ref.png"), refPng);
              skips.push("thiếu ảnh ours cho " + viewport.name + " → chỉ lưu " + relativeToRepo(only));
            } else if (oursPng !== null) {
              const only = writeBinaryFile(join(dir, "ours-" + suffix + ".png"), oursPng);
              if (firstPair) writeBinaryFile(join(dir, "ours.png"), oursPng);
              skips.push("thiếu ảnh ref cho " + viewport.name + " → chỉ lưu " + relativeToRepo(only));
            } else {
              skips.push("không chụp được cả hai bên ở " + viewport.name + " (" + (refSide.info.error ?? oursSide.info.error ?? "?") + ")");
            }
            firstPair = false;
            continue;
          }
          const refFile = writeBinaryFile(join(dir, "ref-" + suffix + ".png"), refPng);
          const oursFile = writeBinaryFile(join(dir, "ours-" + suffix + ".png"), oursPng);
          const masks = resolveMasks(maskRegions, viewport.width, viewport.height);
          const framePixels = viewport.width * viewport.height;
          const maskedPixels = framePixels - unmaskedPixelCount(viewport.width, viewport.height, masks);
          const diff = pixelDiff(refPng, oursPng, PIXEL_THRESHOLD_RATIO, {
            ignoreMask: masks.length > 0 ? buildIgnoreMask(viewport.width, viewport.height, masks) : undefined,
            maskedPixels,
          });
          const diffPng = diff.diffPng ?? Buffer.alloc(0);
          const diffFile = writeBinaryFile(join(dir, "diff-" + suffix + ".png"), diffPng);
          if (firstPair) {
            writeBinaryFile(join(dir, "ref.png"), refPng);
            writeBinaryFile(join(dir, "ours.png"), oursPng);
            writeBinaryFile(join(dir, "diff.png"), diffPng);
            firstPair = false;
          }
          const refSize = pngSize(refPng);
          pairs.push({
            route,
            viewport: viewport.name,
            refFile: relativeToRepo(refFile),
            oursFile: relativeToRepo(oursFile),
            diffFile: relativeToRepo(diffFile),
            width: refSize?.width ?? viewport.width,
            height: refSize?.height ?? viewport.height,
            diffPixels: diff.diffPixels,
            totalPixels: diff.totalPixels,
            ratio: diff.ratio,
            threshold: PIXEL_THRESHOLD_RATIO,
            pass: diff.pass,
            note: diff.ok ? undefined : diff.reason,
            masks,
            maskedPixels: diff.maskedPixels,
            rawDiffPixels: diff.rawDiffPixels,
            rawRatio: diff.rawRatio,
          });
          if (!options.quiet) {
            log(
              "shot",
              viewport.name,
              route,
              diff.pass ? "PASS" : "FAIL",
              "mask " + ratioPercent(diff.ratio) + " (" + String(diff.diffPixels) + "/" + String(diff.totalPixels) + " px ngoài mask,",
              String(diff.maskedPixels) + " px bị mask) · thô " + ratioPercent(diff.rawRatio),
            );
          }
        }
      }
    } finally {
      await closeChromeSession(chromeSession);
      chromeSession = null;
      activeSession = null;
    }
  }
  if (refSide.info.noticeVisible || oursSide.info.noticeVisible) {
    skips.push(
      "LƯU Ý: còn thẻ thông báo một lần khi chụp (ref " + String(refSide.info.noticeVisible) +
        " · ours " + String(oursSide.info.noticeVisible) + ") — số pixel bao gồm khác biệt TRẠNG THÁI, không phải giao diện",
    );
  }
  if (child !== null && options.keepRef !== true) stopChild(child);
  if (child !== null && options.keepRef === true) skips.push("oracle B vẫn đang chạy (pid " + String(child.pid ?? 0) + ") theo --keep-ref");

  const guardAfter = snapshotTree(guardPath, { maxDepth: 3 });
  const runDelta = diffTrees(guardIdle, guardAfter);
  const verdict: ShotArtifact["verdict"] =
    pairs.length === 0 ? "SKIP" : pairs.every((pair) => pair.pass) ? "PASS" : "FAIL";
  const artifact: ShotArtifact = {
    format: ARTIFACT_FORMAT,
    stamp: runStamp,
    startedAt,
    finishedAt: nowIso(),
    refKey,
    ours: oursSide.info,
    ref: refSide.info,
    pairs,
    skips,
    threshold: PIXEL_THRESHOLD_RATIO,
    maskRegions: [...maskRegions],
    freshProfile,
    profileHash,
    guard: {
      path: guardPath,
      idle: describeTreeDelta(idleDelta),
      during: describeTreeDelta(runDelta),
      verdict: guardVerdict(idleDelta, runDelta),
      samples: sampleChangedPaths(runDelta),
      changed: runDelta.changed,
    },
    verdict,
  };
  writeJsonFile(join(dir, "summary.json"), artifact);
  writeJsonFile(parityPath("latest-shots.json"), artifact);
  // Ghi riêng theo bên tham chiếu để report --from-cache đọc lại đúng cả hai cặp.
  writeJsonFile(parityPath("latest-shots-" + refKey + ".json"), artifact);
  return artifact;
}

/**
 * In bảng tóm tắt ảnh ra console.
 * @param artifact artifact của lần chạy.
 * @returns không trả gì.
 */
export function printShotSummary(artifact: ShotArtifact): void {
  console.log("");
  console.log("=== parity:shot — " + artifact.stamp + " → " + artifact.verdict + " ===");
  console.log("| viewport | route | ref | ours | pixel diff | ngưỡng | kết luận |");
  console.log("|---|---|---|---|---|---|---|");
  for (const pair of artifact.pairs) {
    console.log(
      "| " + pair.viewport + " | " + pair.route + " | " + pair.refFile + " | " + pair.oursFile + " | " +
        String(pair.diffPixels) + "/" + String(pair.totalPixels) + " (" + ratioPercent(pair.ratio) + ") | " +
        ratioPercent(pair.threshold) + " | " + (pair.pass ? "PASS" : "FAIL") + " |",
    );
    console.log(
      "  · ngoài mask " + ratioPercent(pair.ratio) + " · thô " + ratioPercent(pair.rawRatio) +
        " · bỏ qua " + String(pair.maskedPixels) + " px trong " + String(pair.masks.length) + " vùng",
    );
  }
  for (const skip of artifact.skips) console.log("- SKIP: " + skip);
  console.log("");
  if (artifact.maskRegions.length > 0) {
    console.log("Vùng mask đã dùng (toạ độ pixel ghi trong summary.json):");
    for (const region of artifact.maskRegions) {
      console.log("  · " + region.name + " (" + region.kind + ") — " + region.reason);
    }
  }
  console.log(
    "profile Chrome: " + (artifact.freshProfile ? "MỚI (fresh) · hash " + artifact.profileHash : "KHÔNG mở được Chrome"),
  );
  console.log("bundle ref : " + artifact.ref.assetsHash + " (" + String(artifact.ref.assets.length) + " asset)");
  console.log("bundle ours: " + artifact.ours.assetsHash + " (" + String(artifact.ours.assets.length) + " asset)");
  console.log("boot ref   : " + artifact.ref.bootHash + " · ours: " + artifact.ours.bootHash);
  console.log("artifact: " + parityRelative("shots", artifact.stamp));
}

/**
 * Đọc artifact ảnh mới nhất.
 * @returns artifact, hoặc null nếu chưa từng chạy.
 */
export function readLatestShots(): ShotArtifact | null {
  return readJsonFile<ShotArtifact>(parityPath("latest-shots.json"));
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
 * Bóc danh sách vùng mask từ tham số: `--no-mask` (so toàn khung) hoặc `--masks <file.json>`.
 * @param argv tham số dòng lệnh.
 * @returns danh sách vùng mask (mặc định là {@link DEFAULT_MASKS}).
 */
export function loadMasks(argv: readonly string[]): MaskRegion[] {
  if (argv.includes("--no-mask")) return [];
  const file = valueOf(argv, "--masks");
  if (file === null) return [...DEFAULT_MASKS];
  const parsed = readJsonFile<unknown>(file);
  if (parsed === null) {
    log("không đọc được file mask", file, "→ dùng mask mặc định");
    return [...DEFAULT_MASKS];
  }
  const regions = parseMaskFile(parsed);
  return regions.length > 0 ? regions : [...DEFAULT_MASKS];
}

/**
 * Điểm vào CLI `parity:shot`.
 * @param argv tham số sau tên script.
 * @returns mã thoát (0 = chạy xong hoặc SKIP; 1 = FAIL khi bật `--strict`).
 */
export async function main(argv: string[]): Promise<number> {
  const against = valueOf(argv, "--against");
  const refOption = valueOf(argv, "--ref");
  const ref: "stock" | "oracleA" = refOption === "oracleA" || against !== null ? "oracleA" : "stock";
  const refPort = against !== null ? Number(against) : undefined;
  const oursPort = valueOf(argv, "--ours-port");
  const artifact = await runShot({
    ref,
    refPort: refPort !== undefined && Number.isFinite(refPort) ? refPort : undefined,
    oursPort: oursPort !== null && Number.isFinite(Number(oursPort)) ? Number(oursPort) : undefined,
    viewports: parseViewports(valueOf(argv, "--sizes")),
    routes: (valueOf(argv, "--routes") ?? "/").split(",").filter((route) => route.length > 0),
    keepRef: argv.includes("--keep-ref"),
    spawnRef: !argv.includes("--no-spawn-ref"),
    quiet: argv.includes("--json"),
    masks: loadMasks(argv),
  });
  if (argv.includes("--json")) {
    console.log(JSON.stringify(artifact, null, 2));
    return 0;
  }
  printShotSummary(artifact);
  return argv.includes("--strict") && artifact.verdict === "FAIL" ? 1 : 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}

/**
 * URL de VAO app khi chup: uu tien duong TOKEN trong ready-url.txt khi cong khop, vi token chi doi duoc
 * thanh phien qua MOT luot dieu huong — di URL tran bang cookie mint tu secret co the tra 401 du app LANH
 * (bay nay da lam luot chup phia ours SKIP oan). Khong co file / khac cong thi dung URL tran nhu cu.
 * @param port - cong app.
 * @param route - duong dan can chup (mac dinh "/").
 * @returns URL day du kem token neu co.
 */
export function entryUrlFor(port: number, route: string, readyUrlFile = join(appHome(), "ready-url.txt")): string {
  try {
    const raw = readFileSync(readyUrlFile, "utf8").trim();
    const parsed = new URL(raw);
    if (Number(parsed.port) !== port) return "http://127.0.0.1:" + String(port) + route;
    return "http://127.0.0.1:" + String(port) + route + parsed.search;
  } catch {
    return "http://127.0.0.1:" + String(port) + route;
  }
}

import { appHome } from "./lib/paths.ts";
