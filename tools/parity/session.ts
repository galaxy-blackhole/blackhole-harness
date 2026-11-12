/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:session — session round-trip: chứng minh một phiên tạo ở bên này MỞ ĐƯỢC ở bên kia.
 *      Copy byte-nguyên session.v4.jsonl.zstd sang home bên kia (cùng slug), mở bằng UI bên đó,
 *      đối chiếu văn bản hiện ra với dữ liệu đã giải mã, rồi dọn sạch bản copy
 */

import { existsSync } from "node:fs";

import { ARTIFACT_FORMAT, parityRelative, relativeToRepo, writeJsonFile, writeTextFile } from "./lib/artifacts.ts";
import { type ChromeSession, closeChromeSession, launchChrome } from "./lib/browser.ts";
import { assessHealth, describeHealth, findInvalidWindow } from "./lib/health.ts";
import { STOCK_PORT, appHome, ensureDir, nowIso, parityPath, stamp, stockHome } from "./lib/paths.ts";
import { cookieFor, cookieForHomeFirst } from "./lib/plugin-ui.ts";
import { ensureStockServer, stopChild } from "./lib/runner.ts";
import * as sessionStore from "./lib/session-store.ts";
import { type SessionFolder, copySessionTo, listSideSessions, removeSessionCopy } from "./lib/session-store.ts";
import { ORACLE_A_PORT, OURS_PORT, log } from "./lib/paths.ts";

/** Một bước của phép đo. */
export interface SessionStep {
  /** Tên bước. */
  phase: string;
  /** Thời điểm ISO. */
  at: string;
  /** Ghi chú/số liệu. */
  note: string;
}

/** Hợp đồng lưu trữ đo được ở một bên. */
export interface StorageContract {
  /** Nhãn bên. */
  side: string;
  /** DSH_HOME. */
  home: string;
  /** Số phiên. */
  sessions: number;
  /** Số phiên có nội dung (có bản ghi người dùng). */
  withContent: number;
  /** Các slug workspace gặp phải. */
  slugs: string[];
  /** true khi MỌI phiên đều có magic zstd đúng. */
  magicAllOk: boolean;
  /** true khi MỌI phiên đều có đủ lõi header. */
  headerCoreAllOk: boolean;
  /** Tập khoá header lớn nhất gặp phải. */
  headerKeys: string[];
  /** Các loại bản ghi gặp phải (hợp của mọi phiên). */
  recordTypes: string[];
}

/** Kết quả một chiều round-trip. */
export interface RoundTrip {
  /** Nhãn bên gửi. */
  from: string;
  /** Nhãn bên nhận. */
  to: string;
  /** Home nhận. */
  targetHome: string;
  /** Slug workspace. */
  slug: string;
  /** Định danh phiên. */
  id: string;
  /** Tiêu đề phiên. */
  title: string;
  /** Câu người dùng gõ (kim chỉ nam để đối chiếu UI). */
  userText: string;
  /** sha256 trước khi copy. */
  sha256Before: string;
  /** sha256 tại home nhận sau khi copy. */
  sha256After: string;
  /** true khi byte giống hệt. */
  byteIdentical: boolean;
  /** true khi file copy vẫn đúng magic zstd. */
  magicOk: boolean;
  /** true khi header của bản copy đủ lõi. */
  headerCoreOk: boolean;
  /** Số phiên bên nhận TRƯỚC khi copy. */
  listedBefore: number;
  /** Số phiên bên nhận SAU khi copy. */
  listedAfter: number;
  /** true khi bên nhận báo LÀNH khi mở UI. */
  receiverHealthy: boolean;
  /** true khi bấm mở được một mục có tiêu đề khớp. */
  clicked: boolean;
  /** true khi nội dung hiện ra chứa đúng câu người dùng đã lưu. */
  renderedMatch: boolean;
  /** Văn bản đầu khung hội thoại bên nhận (để đối chiếu). */
  renderedHead: string;
  /** URL sau khi mở. */
  url: string;
  /** Ảnh chụp bên nhận sau khi mở. */
  screenshot: string | null;
  /** true khi bản copy đã được dọn. */
  cleaned: boolean;
  /** Số phiên bên nhận sau khi dọn. */
  listedAfterCleanup: number;
}

/** Artifact của một lần chạy parity:session. */
export interface SessionRoundTripArtifact {
  /** Phiên bản định dạng. */
  format: number;
  /** Dấu thời gian. */
  stamp: string;
  /** Bắt đầu/kết thúc. */
  startedAt: string;
  /** Kết thúc. */
  finishedAt: string;
  /** Hợp đồng lưu trữ đo được ở từng bên. */
  contracts: StorageContract[];
  /** Chiều app → bên kia (oracle B). */
  appToPeer: RoundTrip | null;
  /** Chiều bên kia (oracle B) → app. */
  peerToApp: RoundTrip | null;
  /** Phiên do UI app tạo trong lượt đo này (null nếu không tạo được). */
  createdNow: { created: boolean; id: string; text: string; note: string } | null;
  /** Các bước đã làm. */
  steps: SessionStep[];
  /** Kết luận. */
  verdict: "PASS" | "FAIL" | "SKIP";
  /** Việc bị bỏ kèm lý do. */
  skips: string[];
}

/**
 * Tổng hợp hợp đồng lưu trữ của một bên từ danh sách phiên.
 * @param side nhãn bên.
 * @param home DSH_HOME.
 * @param sessions danh sách phiên.
 * @returns hợp đồng đo được.
 */
export function contractOf(side: string, home: string, sessions: readonly SessionFolder[]): StorageContract {
  const withContent = sessions.filter((session) => session.userText !== "");
  const headerKeys = new Set<string>();
  const recordTypes = new Set<string>();
  for (const session of sessions) {
    session.headerKeys.forEach((key) => headerKeys.add(key));
    session.recordTypes.forEach((type) => recordTypes.add(type));
  }
  return {
    side,
    home,
    sessions: sessions.length,
    withContent: withContent.length,
    slugs: [...new Set(sessions.map((session) => session.slug))].sort(),
    magicAllOk: sessions.every((session) => session.magicOk),
    headerCoreAllOk: sessions.every((session) => session.headerCoreOk),
    headerKeys: [...headerKeys].sort(),
    recordTypes: [...recordTypes].sort(),
  };
}

/**
 * Bấm mục phiên có tiêu đề cho trước trong thanh bên (phần tử SÂU NHẤT khớp văn bản).
 * @param page trang đang mở.
 * @param title tiêu đề phiên.
 * @returns true khi đã bấm được.
 */
export async function clickSessionByTitle(page: import("playwright-core").Page, title: string): Promise<boolean> {
  // Tiêu đề lưu trong log có thể kèm dấu câu ("Say OK only.") còn thanh bên hiển thị "Say OK Only" + thời gian.
  const needle = title.trim().toLowerCase().replace(/[.!?\s]+$/u, "");
  return await page.evaluate((wanted: string) => {
    const nodes = Array.from(document.querySelectorAll("div,span,li,p,button,a"));
    const matches = nodes.filter((node) => {
      const text = (node.textContent ?? "").replace(/\s+/gu, " ").trim().toLowerCase();
      return text.startsWith(wanted) && text.length <= wanted.length + 18;
    });
    matches.sort((a, b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length);
    const target = matches[0];
    if (target === undefined) return false;
    (target as HTMLElement).click();
    return true;
  }, needle);
}

/**
 * Mở một phiên ở bên nhận bằng UI và đối chiếu văn bản hiện ra với dữ liệu đã lưu.
 * @param session phiên Chrome.
 * @param port cổng bên nhận.
 * @param cookie cookie phiên của bên nhận.
 * @param target phiên cần mở (đã nằm trong home bên nhận).
 * @param shotFile đường dẫn ảnh cần ghi.
 * @returns kết quả mở + đối chiếu.
 */
export async function openSessionInUi(
  session: ChromeSession,
  port: number,
  cookie: { name: string; value: string } | null,
  target: SessionFolder,
  shotFile: string,
): Promise<{ healthy: boolean; clicked: boolean; renderedMatch: boolean; renderedHead: string; url: string; screenshot: string | null }> {
  const url = "http://127.0.0.1:" + String(port) + "/";
  const page = await session.context.newPage();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    if (cookie !== null) await session.context.addCookies([{ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/" }]);
    // PHẢI điều hướng CHÍNH trang này (không dùng trang của cổng trạng thái), nếu không trang trắng.
    await page.goto(url, { waitUntil: "load", timeout: 30_000 }).catch(() => undefined);
    await page
      .waitForFunction(() => document.querySelectorAll("button").length >= 3, { timeout: 20_000 })
      .catch(() => undefined);
    await page.waitForTimeout(3500);
    const health = await assessHealth(page);
    if (!health.ok) {
      return { healthy: false, clicked: false, renderedMatch: false, renderedHead: describeHealth(health), url: page.url(), screenshot: null };
    }
    const clicked = await clickSessionByTitle(page, target.title === "" ? target.id : target.title);
    await page.waitForTimeout(3500);
    const renderedHead: string = await page.evaluate(() => document.body.innerText.replace(/\s+/gu, " ").slice(0, 600));
    const needle = target.userText.replace(/\s+/gu, " ").trim().slice(0, 24);
    const renderedMatch = needle.length > 3 && renderedHead.toLowerCase().includes(needle.toLowerCase());
    await page.screenshot({ path: shotFile, type: "png" }).catch(() => undefined);
    return { healthy: true, clicked, renderedMatch, renderedHead, url: page.url(), screenshot: relativeToRepo(shotFile) };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Chạy parity:session — round-trip hai chiều giữa app và oracle B (home tạm, cùng slug workspace).
 * @param options cổng app, cổng oracle A (chỉ đọc để đối chiếu), bỏ phần tạo phiên mới.
 * @returns artifact đã ghi xuống .parity/sessions/<stamp>/.
 */
export async function runSessionRoundTrip(options: { port?: number; oraclePort?: number; quiet?: boolean } = {}): Promise<SessionRoundTripArtifact> {
  const startedAt = nowIso();
  const runStamp = stamp();
  const dir = ensureDir(parityPath("sessions", runStamp));
  const port = options.port ?? OURS_PORT;
  const oraclePort = options.oraclePort ?? ORACLE_A_PORT;
  const home = appHome();
  const peerHome = stockHome();
  const steps: SessionStep[] = [];
  const skips: string[] = [];
  const mark = (phase: string, note: string): void => {
    steps.push({ phase, at: nowIso(), note });
  };
  const invalid = findInvalidWindow();
  if (invalid !== null) skips.push("thời điểm đo nằm trong INVALID_WINDOWS " + invalid.from + "–" + invalid.to + " — " + invalid.why);

  const appSessions = listAll(home, "app");
  const peerSessions = listAll(peerHome, "oracleB");
  const oracleSessions = listAll(oraclePort === ORACLE_A_PORT ? "/tmp/gbh-alpha" : "", "oracleA");
  const appContract = contractOf("app", home, appSessions);
  const peerContract = contractOf("oracleB", peerHome, peerSessions);
  const contracts: StorageContract[] = [appContract, peerContract];
  if (oracleSessions.length > 0) contracts.push(contractOf("oracleA", "/tmp/gbh-alpha", oracleSessions));
  mark(
    "hợp đồng lưu trữ",
    contracts.map((entry) => entry.side + ": " + String(entry.sessions) + " phiên · magic ok=" + String(entry.magicAllOk) + " · header lõi ok=" + String(entry.headerCoreAllOk)).join(" · "),
  );

  let session: ChromeSession | null = null;
  let appToPeer: RoundTrip | null = null;
  let peerToApp: RoundTrip | null = null;
  let createdNow: SessionRoundTripArtifact["createdNow"] = null;
  let peerServer: Awaited<ReturnType<typeof ensureStockServer>> | null = null;
  try {
    session = await launchChrome(parityPath("tmp"), runStamp + "-session");
    // Oracle B phải sống mới "mở bằng bên kia" được; nếu chưa có thì tự boot (home tạm).
    peerServer = await ensureStockServer(STOCK_PORT);
    mark("bảo đảm oracle B sống", peerServer.note);
    if (!peerServer.note.startsWith("đã boot oracle B")) skips.push("oracle B: " + peerServer.note);
    const appCookie = cookieFor(port, home);
    const peerCookie = cookieForHomeFirst(STOCK_PORT, peerHome);

    // Chiều 1: phiên CỦA APP → mở bằng oracle B (home tạm, cùng slug workspace).
    const appSource = pickBest(appSessions, peerSessions, "app");
    if (appSource === null) {
      skips.push("không có phiên nào của app để làm nguồn chiều 1");
    } else {
      appToPeer = await runDirection(session, appSource, "app", "oracleB", peerHome, STOCK_PORT, peerCookie, peerContract, dir + "/app-to-oracleB.png", mark);
    }

    // Chiều 2: phiên CỦA BÊN KIA (oracle B tạo) → mở bằng app.
    const peerSource = pickBest(peerSessions, appSessions, "oracleB");
    if (peerSource === null) {
      skips.push("không có phiên nào của oracle B để làm nguồn chiều 2");
    } else {
      peerToApp = await runDirection(session, peerSource, "oracleB", "app", home, port, appCookie, appContract, dir + "/oracleB-to-app.png", mark);
    }
  } catch (error) {
    skips.push("lỗi trong lượt đo: " + (error instanceof Error ? error.message : String(error)));
  } finally {
    await closeChromeSession(session);
    if (peerServer !== null && peerServer.bootedHere) stopChild(peerServer.child);
  }

  const evidence: Record<string, boolean> = {
    appSessionToPeerOpened: appToPeer !== null && appToPeer.byteIdentical && appToPeer.renderedMatch,
    peerSessionToAppOpened: peerToApp !== null && peerToApp.byteIdentical && peerToApp.renderedMatch,
    sameStorageContract: contracts.length >= 2 && contracts.every((entry) => entry.magicAllOk && entry.headerCoreAllOk),
    noResidue: (appToPeer?.cleaned ?? true) && (peerToApp?.cleaned ?? true),
  };
  const failed = Object.entries(evidence)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  const artifact: SessionRoundTripArtifact = {
    format: ARTIFACT_FORMAT,
    stamp: runStamp,
    startedAt,
    finishedAt: nowIso(),
    contracts,
    appToPeer,
    peerToApp,
    createdNow,
    steps,
    verdict: skips.some((skip) => skip.includes("INVALID_WINDOWS")) ? "SKIP" : failed.length === 0 ? "PASS" : "FAIL",
    skips,
  };
  writeJsonFile(parityPath("latest-session-roundtrip.json"), artifact);
  writeTextFile(parityPath("sessions", runStamp, "roundtrip.md"), formatSessionRoundTrip(artifact, failed));
  if (!options.quiet) {
    console.log("");
    console.log("=== parity:session — " + artifact.stamp + " → " + artifact.verdict + " ===");
    console.log(formatSessionRoundTrip(artifact, failed));
    console.log("artifact: " + parityRelative("sessions", artifact.stamp));
  }
  return artifact;
}

/**
 * Danh sách phiên của một bên (bọc import động để tránh vòng import).
 * @param home DSH_HOME (rỗng thì trả về danh sách rỗng).
 * @param side nhãn bên.
 * @returns danh sách phiên.
 */
function listAll(home: string, side: string): SessionFolder[] {
  if (home === "" || !existsSync(home)) return [];
  return listSideSessions(home, side);
}

/**
 * Chọn phiên nguồn tốt nhất: có nội dung, tiêu đề KHÔNG trùng ở bên nhận (để bấm không nhầm).
 * @param candidates phiên bên gửi.
 * @param receivers phiên đang có ở bên nhận.
 * @param side nhãn bên gửi (chỉ để ghi log).
 * @returns phiên nên dùng, hoặc null.
 */
export function pickBest(candidates: readonly SessionFolder[], receivers: readonly SessionFolder[], side: string): SessionFolder | null {
  const withContent = candidates.filter((session) => session.userText !== "" && session.slug !== "");
  const receiverTitles = new Set(receivers.map((session) => session.title.trim().toLowerCase()));
  const unique = withContent.filter((session) => !receiverTitles.has(session.title.trim().toLowerCase()));
  const newestUnique = unique.at(-1);
  if (newestUnique !== undefined) return newestUnique;
  const newestAny = withContent.at(-1);
  if (newestAny !== undefined) {
    log("session: bên nhận đã có tiêu đề trùng, dùng phiên mới nhất của", side, "và đối chiếu bằng nội dung");
    return newestAny;
  }
  return null;
}

/**
 * Chạy một chiều round-trip: copy byte-nguyên sang home nhận, mở bằng UI bên nhận, đối chiếu, rồi dọn.
 * @param session phiên Chrome.
 * @param source phiên nguồn.
 * @param fromSide nhãn bên gửi.
 * @param toSide nhãn bên nhận.
 * @param targetHome home bên nhận.
 * @param targetPort cổng bên nhận.
 * @param cookie cookie phiên của bên nhận.
 * @param receiverContract hợp đồng lưu trữ bên nhận (để đếm số phiên).
 * @param shotFile ảnh chụp bên nhận.
 * @param mark hàm ghi bước.
 * @returns kết quả chiều đó.
 */
async function runDirection(
  session: ChromeSession,
  source: SessionFolder,
  fromSide: string,
  toSide: string,
  targetHome: string,
  targetPort: number,
  cookie: { name: string; value: string } | null,
  receiverContract: StorageContract,
  shotFile: string,
  mark: (phase: string, note: string) => void,
): Promise<RoundTrip> {
  const listedBefore = listSideSessions(targetHome, toSide).length;
  // Đọc lại NGUỒN ngay trước khi copy: harness đang chạy có thể vừa ghi thêm frame vào log phiên,
  // nên so với ảnh chụp lúc đầu lượt là so nhầm.
  const sourceNow = sessionStore.readSessionFolder(source.home, source.side, source.slug, source.id);
  const { folder, byteIdentical } = copySessionTo(sourceNow, targetHome);
  const opened = await openSessionInUi(session, targetPort, cookie, folder, shotFile);
  const listedAfter = listSideSessions(targetHome, toSide).length;
  const cleaned = removeSessionCopy(targetHome, source.slug, source.id);
  const listedAfterCleanup = listSideSessions(targetHome, toSide).length;
  mark(
    "chiều " + fromSide + " → " + toSide,
    "phiên " + source.id.slice(0, 20) + " · byte giống=" + String(byteIdentical) + " · hiện ra khớp=" + String(opened.renderedMatch) + " · danh sách " +
      String(listedBefore) + " → " + String(listedAfter) + " → dọn còn " + String(listedAfterCleanup),
  );
  return {
    from: fromSide,
    to: toSide,
    targetHome,
    slug: source.slug,
    id: source.id,
    title: source.title,
    userText: source.userText,
    sha256Before: sourceNow.sha256,
    sha256After: folder.sha256,
    byteIdentical,
    magicOk: folder.magicOk,
    headerCoreOk: folder.headerCoreOk,
    listedBefore,
    listedAfter,
    receiverHealthy: opened.healthy,
    clicked: opened.clicked,
    renderedMatch: opened.renderedMatch,
    renderedHead: opened.renderedHead,
    url: opened.url,
    screenshot: opened.screenshot,
    cleaned,
    listedAfterCleanup,
  };
}

/**
 * Sinh bản Markdown của artifact round-trip.
 * @param artifact artifact của lần đo.
 * @param failed danh sách bằng chứng chưa đạt.
 * @returns khối Markdown.
 */
export function formatSessionRoundTrip(artifact: SessionRoundTripArtifact, failed: readonly string[]): string {
  const lines: string[] = [];
  lines.push("### session round-trip: app ↔ oracle B (home tạm, cùng slug workspace) → " + artifact.verdict);
  lines.push("");
  lines.push("| bên | phiên | có nội dung | slug | magic zstd | header lõi |");
  lines.push("|---|---|---|---|---|---|");
  for (const entry of artifact.contracts) {
    lines.push(
      "| " + entry.side + " | " + String(entry.sessions) + " | " + String(entry.withContent) + " | " + entry.slugs.map((slug) => slug.slice(0, 34)).join(", ") +
        " | " + String(entry.magicAllOk) + " | " + String(entry.headerCoreAllOk) + " |",
    );
  }
  lines.push("");
  for (const direction of [artifact.appToPeer, artifact.peerToApp]) {
    if (direction === null) continue;
    lines.push(
      "- **" + direction.from + " → " + direction.to + "**: phiên " + direction.id + " · tiêu đề " + JSON.stringify(direction.title) + " · copy byte giống=" +
        String(direction.byteIdentical) + " (sha " + direction.sha256After.slice(0, 12) + ") · danh sách " + String(direction.listedBefore) + " → " +
        String(direction.listedAfter) + " · mở được=" + String(direction.clicked) + " · nội dung khớp=" + String(direction.renderedMatch) + " · dọn còn " +
        String(direction.listedAfterCleanup) + " · ảnh " + (direction.screenshot ?? "—"),
    );
    lines.push("  - văn bản bên nhận: " + direction.renderedHead.slice(0, 200));
  }
  lines.push("");
  lines.push("- ghi chú: KHÔNG ghi gì vào home của oracle A (/tmp/gbh-alpha) — chỉ ĐỌC để đối chiếu hợp đồng lưu trữ; lượt mở thật dùng oracle B (cùng runtime, cùng slug).");
  if (failed.length > 0) lines.push("- bằng chứng CHƯA đạt: " + failed.join(" · "));
  for (const skip of artifact.skips) lines.push("- SKIP/GHI CHÚ: " + skip);
  return lines.join("\n");
}

/**
 * Điểm vào CLI của parity:session.
 * @param argv tham số sau tên script (--json, --port <n>, --oracle-port <n>).
 * @returns 0 khi PASS, 1 khi FAIL, 2 khi SKIP.
 */
export async function main(argv: string[]): Promise<number> {
  const portIndex = argv.indexOf("--port");
  const oracleIndex = argv.indexOf("--oracle-port");
  const artifact = await runSessionRoundTrip({
    port: portIndex === -1 ? undefined : Number(argv[portIndex + 1]),
    oraclePort: oracleIndex === -1 ? undefined : Number(argv[oracleIndex + 1]),
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
