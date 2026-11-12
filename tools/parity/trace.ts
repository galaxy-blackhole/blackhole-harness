/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:trace — cùng kịch bản trên hai bên, ghi HTTP+WS (kèm kích thước/encoding), diff frame/route
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { ARTIFACT_FORMAT, parityRelative, relativeToRepo, writeJsonFile, writeTextFile } from "./lib/artifacts.ts";
import {
  type ChromeSession,
  capturePage,
  closeChromeSession,
  dismissOverlays,
  launchChrome,
  resolveSessionCookieFrom,
} from "./lib/browser.ts";
import { REPO_ROOT, OURS_PORT, ORACLE_A_PORT, STOCK_PORT, credentialsPath, ensureDir, log, nowIso, parityPath, stamp, stockHome } from "./lib/paths.ts";
import { startStockServer, stopChild } from "./lib/runner.ts";
import { type DumpTarget, stockTarget } from "./lib/targets.ts";
import {
  COMPRESSION_THRESHOLD_BYTES,
  type DocumentEvidence,
  type DocumentProbe,
  type SideTrace,
  type TraceDiff,
  FIRST_RESPONSE_TIMEOUT_MS,
  attachRecorder,
  diffTraces,
  documentEvidence,
  encodingMismatches,
  extractSessionFingerprint,
  frameBalance,
  probeDocument,
} from "./lib/trace.ts";
import type { BrowserContext, Page } from "playwright-core";

/** Prompt ngắn dùng cho kịch bản trace (chi phí nhỏ, câu trả lời ngắn). */
export const DEFAULT_PROMPT = "Say OK only.";

/**
 * Route chỉ xuất hiện khi kịch bản đi qua menu phụ ("Open in app") — khác do ĐƯỜNG ĐI KỊCH BẢN, không phải
 * khác hành vi của app. Bằng chứng: gọi trực tiếp cả hai route đều 200 (Lead tự gọi trên 5439).
 */
export const SCENARIO_PATH_ONLY_ROUTES: readonly string[] = Object.freeze([
  "GET /open-in-app/apps 200",
  "GET /open-in-app/icon/finder 200",
]);

/**
 * Tách các dòng lệch "chỉ do đường đi kịch bản" ra khỏi lệch thật.
 * @param keys danh sách khoá lệch (có thể kèm " ×n").
 * @returns dòng do kịch bản và dòng cần xem lại.
 */
export function splitScenarioOnly(keys: readonly string[]): { scenarioOnly: string[]; blocking: string[] } {
  const scenarioOnly: string[] = [];
  const blocking: string[] = [];
  for (const key of keys) {
    const bare = key.split(" ×")[0] ?? key;
    if (SCENARIO_PATH_ONLY_ROUTES.includes(bare)) scenarioOnly.push(key);
    else blocking.push(key);
  }
  return { scenarioOnly, blocking };
}

/** Dấu hiệu modal/hộp thoại có thể CHẶN kịch bản. */
export const BLOCKER_MARKERS: readonly string[] = Object.freeze([
  "Get started",
  "Add API Key",
  "Sign in",
  "Preview Notice",
  "authentication required",
  "Galaxy API key",
]);

/** Nhãn nút dùng để đóng modal xin API key mà KHÔNG nhập gì (không bao giờ ghi secret vào UI). */
export const KEY_MODAL_DISMISS_LABELS: readonly string[] = Object.freeze(["Later", "Để sau", "Skip", "Not now"]);

/** Một bước của kịch bản trace. */
export interface ScenarioStep {
  /** Tên bước. */
  phase: string;
  /** Thời điểm ISO. */
  at: string;
  /** true khi bước chạy được. */
  ok: boolean;
  /** Chi tiết (đã bấm / timeout / bị chặn bởi gì). */
  note: string;
}

/** Kết quả phần kịch bản của một bên. */
export interface ScenarioRun {
  /** Đã mở được trang chủ. */
  opened: boolean;
  /** Đã bấm được New Session. */
  sessionCreated: boolean;
  /** Đã gửi được prompt. */
  promptSent: boolean;
  /** Thời gian tới nội dung trả lời đầu tiên (ms). */
  firstResponseMs: number | null;
  /** Dấu vân tay id phiên (không lưu id thô). */
  sessionFingerprint: string | null;
  /** Số token bắt được. */
  tokenUsage: { input: number; output: number; total: number } | null;
  /** Ghi chú. */
  note?: string;
  /** Từng bước kèm kết quả. */
  steps: ScenarioStep[];
  /** Các dấu hiệu modal chặn gặp phải. */
  blockers: string[];
  /** Ảnh màn hình cuối (tương đối repo). */
  finalShot: string | null;
}

/** Trace của một bên (dùng ScenarioRun của CLI, tương thích SideTrace của lib). */
export interface SideRun extends Omit<SideTrace, "scenario"> {
  /** Kết quả kịch bản kèm từng bước. */
  scenario: ScenarioRun;
}

/** Artifact của một lần `parity:trace`. */
export interface TraceArtifact {
  /** Phiên bản định dạng. */
  format: number;
  /** Dấu thời gian. */
  stamp: string;
  /** Bắt đầu. */
  startedAt: string;
  /** Kết thúc. */
  finishedAt: string;
  /** Prompt đã dùng. */
  prompt: string;
  /** Trace bên ta. */
  ours: SideRun;
  /** Trace bên tham chiếu. */
  ref: SideRun;
  /** Khoá bên tham chiếu. */
  refKey: string;
  /** Diff route/frame. */
  diff: TraceDiff;
  /** Bằng chứng tài liệu HTML gốc hai bên + lệch encoding (chỉ tính khi đủ 3 điều kiện). */
  document: { ref: DocumentEvidence | null; ours: DocumentEvidence | null; encodingMismatches: string[] };
  /** Số đo THÔ tài liệu HTML (không nén vs nén) — bằng chứng hành vi cho row webserver. */
  rawDocument: { ref: DocumentProbe | null; ours: DocumentProbe | null };
  /** Kết luận. */
  verdict: "PASS" | "FAIL" | "SKIP";
  /** Việc bị bỏ kèm lý do. */
  skips: string[];
  /** true khi dùng profile Chrome mới. */
  freshProfile: boolean;
  /** Đuôi hash user-data-dir. */
  profileHash: string;
}

/** Tuỳ chọn cho {@link runTrace}. */
export interface TraceOptions {
  /** Cổng app. */
  oursPort?: number;
  /** Bên tham chiếu. */
  ref?: "oracleA" | "stock";
  /** Prompt của kịch bản. */
  prompt?: string;
  /** Chế độ im lặng. */
  quiet?: boolean;
}

/**
 * Tìm dấu hiệu modal/hộp thoại có thể chặn kịch bản.
 * @param page trang đang mở.
 * @returns mô tả dấu hiệu tìm thấy, hoặc null.
 */
export async function detectBlocker(page: Page): Promise<string | null> {
  const text = await page.evaluate(() => document.body.innerText).catch(() => "");
  for (const marker of BLOCKER_MARKERS) {
    if (text.includes(marker)) return "thấy dấu hiệu: " + marker;
  }
  return null;
}

/**
 * Dựng header `Cookie` cho phép đo thô (giá trị cookie chỉ nằm trong bộ nhớ).
 * @param cookie cookie phiên (nếu có).
 * @returns chuỗi header, hoặc null.
 */
export function cookieHeader(cookie: { name: string; value: string } | null): string | null {
  return cookie === null ? null : cookie.name + "=" + cookie.value;
}

/**
 * Chạy kịch bản trên một bên và ghi lại HTTP/WS, kèm từng bước và ảnh cuối.
 * @param context context Chrome bền của phiên chụp.
 * @param side khoá bên (ours/ref).
 * @param url URL trang chủ.
 * @param port cổng.
 * @param cookie cookie phiên (nếu có).
 * @param launchToken launch token (nếu vừa boot oracle B).
 * @param prompt prompt sẽ gửi.
 * @param shotDir thư mục lưu ảnh cuối.
 * @returns trace của bên đó.
 */
export async function captureSide(
  context: BrowserContext,
  side: string,
  url: string,
  port: number,
  cookie: { name: string; value: string } | null,
  launchToken: string,
  prompt: string,
  shotDir: string,
): Promise<SideRun> {
  const page = await context.newPage();
  const steps: ScenarioStep[] = [];
  const step = (phase: string, ok: boolean, note: string): void => {
    steps.push({ phase, at: nowIso(), ok, note });
  };
  const scenario: ScenarioRun = {
    opened: false,
    sessionCreated: false,
    promptSent: false,
    firstResponseMs: null,
    sessionFingerprint: null,
    tokenUsage: null,
    steps,
    blockers: [],
    finalShot: null,
  };
  const recorder = attachRecorder(page, {
    onUsage: (usage) => {
      const current = scenario.tokenUsage;
      if (current === null || usage.total >= current.total) scenario.tokenUsage = usage;
    },
    onFrame: (payload) => {
      if (scenario.sessionFingerprint === null) {
        const fingerprint = extractSessionFingerprint(payload);
        if (fingerprint !== null) scenario.sessionFingerprint = fingerprint;
      }
    },
  });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    if (cookie !== null) {
      await context.addCookies([{ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/" }]);
    }
    let response = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    if (launchToken !== "") {
      await page.goto(url + "?token=" + launchToken, { waitUntil: "load", timeout: 30_000 });
      await page.waitForTimeout(800);
      response = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    }
    scenario.opened = response !== null && response.status() < 400;
    step("mở trang chủ", scenario.opened, "HTTP " + String(response?.status() ?? 0));
    await page
      .waitForFunction(() => document.querySelectorAll("button").length >= 3, { timeout: 20_000 })
      .catch(() => undefined);
    await page.waitForTimeout(2000);

    const blocker = await detectBlocker(page);
    if (blocker !== null) {
      scenario.blockers.push(blocker);
      step("phát hiện modal chặn", false, blocker);
      const dismissed = await dismissOverlays(page);
      await page.waitForTimeout(1500);
      const still = await detectBlocker(page);
      if (still !== null) scenario.blockers.push(still);
      step("đóng modal", still === null, "đã bấm " + String(dismissed) + " nút" + (still === null ? " · đã hết" : " · VẪN CÒN: " + still));
      // Modal xin API key (Galaxy Blackhole) chặn TOÀN BỘ UI: chỉ bấm "Later", không bao giờ nhập key.
      for (const label of KEY_MODAL_DISMISS_LABELS) {
        const button = page.locator('button:has-text("' + label + '")').first();
        if ((await button.count()) === 0) continue;
        await button.click({ timeout: 5000 }).catch(() => undefined);
        await page.waitForTimeout(1200);
        const after = await detectBlocker(page);
        step("đóng modal xin API key", after === null, "đã bấm nút \"" + label + "\"" + (after === null ? " · đã hết" : " · VẪN CÒN: " + after));
        if (after !== null) scenario.blockers.push(after);
        break;
      }
    }

    const baseline = await page.evaluate(() => document.body.innerText.length);
    const newSessionButton = page.locator('button:has-text("New Session")').first();
    const newSessionCount = await newSessionButton.count();
    if (newSessionCount > 0) {
      try {
        await newSessionButton.click({ timeout: 8000 });
        scenario.sessionCreated = true;
        step("bấm New Session", true, "khớp " + String(newSessionCount) + " nút");
      } catch (error) {
        step("bấm New Session", false, "bị chặn/timeout: " + String((error as Error).message).slice(0, 120));
      }
      await page.waitForTimeout(1200);
    } else {
      step("bấm New Session", false, "KHÔNG thấy nút New Session");
    }

    const composer = page.locator('textarea, [contenteditable="true"], [role="textbox"]').first();
    const composerCount = await composer.count();
    if (composerCount > 0) {
      try {
        await composer.click({ timeout: 8000 });
        await page.keyboard.type(prompt, { delay: 15 });
        await page.keyboard.press("Enter");
        scenario.promptSent = true;
        step("gõ prompt + Enter", true, "ô soạn tin khớp " + String(composerCount));
      } catch (error) {
        step("gõ prompt + Enter", false, "bị chặn/timeout: " + String((error as Error).message).slice(0, 120));
      }
    } else {
      step("gõ prompt + Enter", false, "KHÔNG thấy ô soạn tin (bị modal che?)");
    }

    const sentAt = Date.now();
    const deadline = sentAt + FIRST_RESPONSE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const length = await page.evaluate(() => document.body.innerText.length).catch(() => baseline);
      if (length > baseline + 30) {
        scenario.firstResponseMs = Date.now() - sentAt;
        break;
      }
      await page.waitForTimeout(1000);
    }
    step(
      "chờ trả lời đầu tiên",
      scenario.firstResponseMs !== null,
      scenario.firstResponseMs === null ? "timeout " + String(FIRST_RESPONSE_TIMEOUT_MS) + "ms" : String(scenario.firstResponseMs) + " ms",
    );
    await page.waitForTimeout(1500);
    const shotFile = join(shotDir, side + "-cuoi.png");
    await page.screenshot({ path: shotFile, type: "png" }).catch(() => undefined);
    scenario.finalShot = existsSync(shotFile) ? relativeToRepo(shotFile) : null;
    step("chụp ảnh màn hình cuối", scenario.finalShot !== null, scenario.finalShot ?? "không chụp được");
    const finalBlocker = await detectBlocker(page);
    if (finalBlocker !== null && !scenario.blockers.includes(finalBlocker)) scenario.blockers.push(finalBlocker);
    return { side, url, port, http: recorder.http, ws: recorder.ws, scenario };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Chạy `parity:trace`: cùng kịch bản trên hai bên rồi diff route/frame + so kích thước/encoding.
 * @param options tuỳ chọn.
 * @returns artifact đã ghi xuống `.parity/traces/<stamp>/`.
 */
export async function runTrace(options: TraceOptions = {}): Promise<TraceArtifact> {
  const startedAt = nowIso();
  const runStamp = stamp();
  const dir = ensureDir(parityPath("traces", runStamp));
  const oursPort = options.oursPort ?? OURS_PORT;
  const refKey = options.ref ?? "oracleA";
  const refPort = refKey === "oracleA" ? ORACLE_A_PORT : STOCK_PORT;
  const prompt = options.prompt ?? DEFAULT_PROMPT;
  const skips: string[] = [];
  let chromeSession: ChromeSession | null = null;
  let child = null as ReturnType<typeof startStockServer> extends Promise<infer T> ? (T extends { child: infer C } ? C : null) : null;
  let launchToken = "";
  try {
    chromeSession = await launchChrome(parityPath("tmp"), runStamp + "-trace");
    const context = chromeSession.context;
    const oursAuth = resolveSessionCookieFrom(oursPort, [credentialsPath(), join(stockHome(), ".credentials.yaml")]);
    if (oursAuth.cookie === null) skips.push("ours: không mint được cookie phiên (thiếu secret)");
    const oursTrace = await captureSide(
      context,
      "ours",
      "http://127.0.0.1:" + String(oursPort) + "/",
      oursPort,
      oursAuth.cookie,
      "",
      prompt,
      dir,
    );

    const refUrl = "http://127.0.0.1:" + String(refPort) + "/";
    if (refKey === "stock") {
      const target: DumpTarget = stockTarget();
      const probe = await capturePage(chromeSession, { url: refUrl, width: 800, height: 600, cookie: null, settleMs: 100 });
      if (!probe.ok && !probe.unauthorized) {
        const server = await startStockServer(target, refPort);
        child = server.child;
        launchToken = server.launchToken;
        if (!server.ok) skips.push("ref: không boot được oracle B — " + server.note);
      }
    }
    const refAuth = resolveSessionCookieFrom(refPort, [credentialsPath(), join(stockHome(), ".credentials.yaml")]);
    const refTrace = await captureSide(context, refKey, refUrl, refPort, refAuth.cookie, launchToken, prompt, dir);
    // Đo THÔ tài liệu HTML: xin bản không nén rồi bản nén để thấy kích thước thật + magic bytes.
    const oursProbe = await probeDocument("http://127.0.0.1:" + String(oursPort) + "/", cookieHeader(oursAuth.cookie));
    const refProbe = await probeDocument(refUrl, cookieHeader(refAuth.cookie));
    const diff = diffTraces(refTrace, oursTrace);
    const scenarioOk = oursTrace.scenario.promptSent && refTrace.scenario.promptSent;
    const artifact: TraceArtifact = {
      format: ARTIFACT_FORMAT,
      stamp: runStamp,
      startedAt,
      finishedAt: nowIso(),
      prompt,
      ours: oursTrace,
      ref: refTrace,
      refKey,
      diff,
      document: {
        ref: documentEvidence(refTrace),
        ours: documentEvidence(oursTrace),
        encodingMismatches: encodingMismatches(refTrace, oursTrace),
      },
      rawDocument: { ref: refProbe, ours: oursProbe },
      verdict: !scenarioOk
        ? "SKIP"
        : splitScenarioOnly(diff.httpAdded).blocking.length +
              splitScenarioOnly(diff.httpMissing).blocking.length +
              splitScenarioOnly(diff.wsAdded).blocking.length +
              splitScenarioOnly(diff.wsMissing).blocking.length ===
            0
          ? "PASS"
          : "FAIL",
      skips,
      freshProfile: true,
      profileHash: chromeSession.userDataDir.slice(-6),
    };
    writeJsonFile(join(dir, "ours.json"), oursTrace);
    writeJsonFile(join(dir, refKey + ".json"), refTrace);
    writeTextFile(join(dir, "diff.md"), formatTraceDiff(artifact));
    writeJsonFile(parityPath("latest-trace.json"), artifact);
    return artifact;
  } finally {
    stopChild(child);
    await closeChromeSession(chromeSession);
  }
}

/**
 * In kết quả diff trace thành Markdown (kèm từng bước kịch bản và ảnh cuối).
 * @param artifact artifact của lần chạy.
 * @returns khối Markdown.
 */
export function formatTraceDiff(artifact: TraceArtifact): string {
  const { diff } = artifact;
  const lines: string[] = [];
  lines.push("### trace HTTP/WS: ours vs " + artifact.refKey + " → " + artifact.verdict);
  lines.push("");
  lines.push("| bên | HTTP | WS | session | prompt | trả lời đầu | token | ảnh cuối |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const side of [artifact.ref, artifact.ours]) {
    lines.push(
      "| " + side.side + " | " + String(side.http.length) + " request | " + String(side.ws.length) + " frame (" + frameBalance(side.ws) + ") | " +
        (side.scenario.sessionCreated ? "✓" : "—") + " | " + (side.scenario.promptSent ? "✓" : "—") + " | " +
        (side.scenario.firstResponseMs === null ? "—" : String(side.scenario.firstResponseMs) + " ms") + " | " +
        (side.scenario.tokenUsage === null
          ? "—"
          : String(side.scenario.tokenUsage.input) + "/" + String(side.scenario.tokenUsage.output) + " (tổng " + String(side.scenario.tokenUsage.total) + ")") +
        " | " + (side.scenario.finalShot ?? "—") + " |",
    );
  }
  lines.push("");
  const refDoc = artifact.document.ref;
  const oursDoc = artifact.document.ours;
  const describe = (doc: DocumentEvidence | null): string =>
    doc === null ? "—" : String(doc.bytes) + " B" + (doc.encoding === "" ? " (không nén)" : " (" + doc.encoding + ")");
  lines.push(
    "- tài liệu HTML gốc GET /: ref " + describe(refDoc) + " · ours " + describe(oursDoc) +
      (refDoc !== null && oursDoc !== null && refDoc.encoding === oursDoc.encoding ? " → **encoding khớp**" : " → **encoding KHÁC**"),
  );
  const rawRef = artifact.rawDocument.ref;
  const rawOurs = artifact.rawDocument.ours;
  const describeRaw = (probe: DocumentProbe | null): string =>
    probe === null
      ? "—"
      : String(probe.identityBytes) + " B → " + String(probe.gzipBytes) + " B (" +
        (probe.gzipEncoding === "" ? "KHÔNG nén" : probe.gzipEncoding) + ", magic " + probe.magic +
        ", còn " + (probe.ratio * 100).toFixed(1) + "%)";
  lines.push("- đo THÔ tài liệu HTML (identity → gzip): ref " + describeRaw(rawRef) + " · ours " + describeRaw(rawOurs));
  if (artifact.document.encodingMismatches.length > 0) {
    lines.push(
      "- route lệch encoding, chỉ tính khi phản hồi ≥ " + String(COMPRESSION_THRESHOLD_BYTES) +
        " B + content-type nén được + client xin gzip: " + artifact.document.encodingMismatches.slice(0, 6).join(" · "),
    );
  } else {
    lines.push("- route lệch encoding: **0** (sau khi áp đủ 3 điều kiện của ngưỡng nén)");
  }
  lines.push(
    "- route HTTP: giống **" + String(diff.httpSame) + "** · THÊM **" + String(diff.httpAdded.length) +
      "** · THIẾU **" + String(diff.httpMissing.length) + "** · ĐỔI **" + String(diff.httpChanged.length) + "**",
  );
  lines.push(
    "- frame WS: giống **" + String(diff.wsSame) + "** · THÊM **" + String(diff.wsAdded.length) +
      "** · THIẾU **" + String(diff.wsMissing.length) + "** · ĐỔI **" + String(diff.wsChanged.length) + "**",
  );
  if (diff.httpAdded.length > 0) lines.push("- HTTP chỉ có ở ta: " + diff.httpAdded.slice(0, 10).join(", "));
  const httpMissingSplit = splitScenarioOnly(diff.httpMissing);
  if (httpMissingSplit.scenarioOnly.length > 0) {
    lines.push(
      "- HTTP chỉ có ở ref nhưng **KHÁC DO ĐƯỜNG ĐI KỊCH BẢN** (route vẫn 200 khi gọi trực tiếp; lượt của ta không mở menu 'Open in app'): " +
        httpMissingSplit.scenarioOnly.join(", "),
    );
  }
  if (httpMissingSplit.blocking.length > 0) lines.push("- HTTP chỉ có ở ref (cần xem lại): " + httpMissingSplit.blocking.slice(0, 10).join(", "));
  if (diff.wsAdded.length > 0) lines.push("- WS chỉ có ở ta: " + diff.wsAdded.slice(0, 10).join(", "));
  if (diff.wsMissing.length > 0) lines.push("- WS chỉ có ở ref: " + diff.wsMissing.slice(0, 10).join(", "));
  if (diff.wsChanged.length > 0) {
    lines.push(
      "- WS đổi số lần: " + diff.wsChanged.slice(0, 8).map((delta) => delta.key + " (" + String(delta.ref) + "→" + String(delta.ours) + ")").join(", ") +
        " — chú ý: `type=item` là ĐỘ DÀI câu trả lời của model (nội dung stream), KHÔNG phải thiếu frame giao thức.",
    );
  }
  lines.push("");
  lines.push("Từng bước kịch bản:");
  lines.push("");
  for (const side of [artifact.ref, artifact.ours]) {
    lines.push("- **" + side.side + "**" + (side.scenario.blockers.length > 0 ? " (modal: " + side.scenario.blockers.join(" · ") + ")" : ""));
    for (const item of side.scenario.steps) {
      lines.push("  - " + (item.ok ? "✓" : "✗") + " " + item.phase + " — " + item.note);
    }
  }
  for (const skip of artifact.skips) lines.push("- SKIP: " + skip);
  return lines.join("\n");
}

/**
 * In tóm tắt trace ra console.
 * @param artifact artifact của lần chạy.
 * @returns không trả gì.
 */
export function printTraceSummary(artifact: TraceArtifact): void {
  console.log("");
  console.log("=== parity:trace — " + artifact.stamp + " → " + artifact.verdict + " ===");
  console.log(formatTraceDiff(artifact));
  console.log("");
  console.log("artifact: " + parityRelative("traces", artifact.stamp));
}

/**
 * Điểm vào CLI `parity:trace`.
 * @param argv tham số sau tên script.
 * @returns 0 khi chạy xong; 1 khi FAIL và bật `--strict`.
 */
export async function main(argv: string[]): Promise<number> {
  const promptIndex = argv.indexOf("--prompt");
  const portIndex = argv.indexOf("--ours-port");
  const artifact = await runTrace({
    ref: argv.includes("--against") ? "oracleA" : "stock",
    oursPort: portIndex === -1 ? undefined : Number(argv[portIndex + 1]),
    prompt: promptIndex === -1 ? undefined : argv[promptIndex + 1],
    quiet: argv.includes("--json"),
  });
  if (argv.includes("--json")) {
    console.log(JSON.stringify(artifact, null, 2));
    return artifact.verdict === "PASS" ? 0 : 1;
  }
  printTraceSummary(artifact);
  return argv.includes("--strict") && artifact.verdict === "FAIL" ? 1 : 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
