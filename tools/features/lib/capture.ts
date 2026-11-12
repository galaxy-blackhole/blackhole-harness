/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Chụp một bên (ours/ref) theo kịch bản: profile Chrome MỚI mỗi lần, cổng sẵn sàng, nhật ký mạng
 */

import { mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";

import {
  type ChromeSession,
  CHROME_TMP_PREFIX,
  closeChromeSession,
  hashList,
  resolveSessionCookieFrom,
} from "../../parity/lib/browser.ts";
import { SETTLE_MS, credentialsPath, parityPath } from "../../parity/lib/paths.ts";
import { enterByToken } from "../../parity/lib/session-entry.ts";

import { type NetEntry, type NetRecorder, createNetRecorder } from "./net.ts";
import { dialogCount, dismissOneTimeDialogs, elementLabel, firstHeading, inventory, resetScroll, runSteps } from "./steps.ts";
import type { BootFingerprint, Scenario, SideCapture, StepOutcome, Viewport } from "./types.ts";

/** Dấu hiệu bất thường trên trang, dùng để phát hiện khác biệt THẬT (không phải brand/state). */
const SYMPTOM_MARKERS: readonly string[] = Object.freeze([
  "Failed to load plugins",
  "did not activate",
  "enter your galaxy api key",
  "Enter your Galaxy API key",
  "failed to load",
  "Something went wrong",
  "Unexpected error",
]);

/** Thời gian chờ mặc định cho một thao tác Playwright trên trang (ms). */
const ACTION_TIMEOUT_MS = 15_000;

/** Thời gian tối đa cho một lần điều hướng trong kịch bản (ms). */
const GOTO_TIMEOUT_MS = 20_000;

/** Thời gian tối đa cho một lần mở Chrome (ms) — quá hạn thì bỏ và dọn profile. */
const LAUNCH_TIMEOUT_MS = 45_000;

/** Một bên cần chụp: khoá, nhãn hiển thị và cổng server. */
export interface SideSpec {
  /** Khoá bên: ours hoặc ref. */
  key: "ours" | "ref";
  /** Nhãn hiển thị trong ma trận. */
  label: string;
  /** Cổng server của bên này. */
  port: number;
}

/** Cặp bên mặc định của ma trận: app 5439 so với blackhole web 4001. */
export interface SidePair {
  /** Bên của ta. */
  ours: SideSpec;
  /** Bên tham chiếu (oracle). */
  ref: SideSpec;
}

/**
 * Cặp bên mặc định, đọc cổng từ biến môi trường để chạy được trên máy khác.
 * Nhận: không.
 * Trả: cặp bên với nhãn hiển thị kèm cổng thật.
 */
export function defaultSides(): SidePair {
  const oursPort = Number(process.env.GBH_FEATURES_OURS_PORT ?? "5439");
  const refPort = Number(process.env.GBH_FEATURES_REF_PORT ?? "4001");
  return {
    ours: { key: "ours", label: "app của ta (Galaxy Blackhole Desktop) @ " + String(oursPort), port: oursPort },
    ref: { key: "ref", label: "oracle A (blackhole web) @ " + String(refPort), port: refPort },
  };
}

/**
 * Mở Chrome bằng profile MỚI với thời gian chờ hữu hạn (khác parity lib ở chỗ có timeout).
 * Dùng đúng tiền tố profile của giàn parity để tools/parity/clean.ts vẫn dọn được phần còn sót.
 * Nhận: thư mục chứa profile tạm, hậu tố tên profile, thời gian chờ tối đa (ms).
 * Trả: phiên Chrome; ném lỗi (và dọn thư mục) nếu Chrome không lên kịp.
 */
export async function launchChromeBounded(
  tmpRoot: string,
  suffix: string,
  timeoutMs = LAUNCH_TIMEOUT_MS,
): Promise<ChromeSession> {
  const userDataDir = mkdtempSync(join(tmpRoot, CHROME_TMP_PREFIX + suffix + "-"));
  try {
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chrome",
      headless: true,
      timeout: timeoutMs,
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
      locale: "en-US",
      timezoneId: "Asia/Saigon",
      args: ["--force-color-profile=srgb", "--hide-scrollbars", "--font-render-hinting=none"],
    });
    return { context, userDataDir };
  } catch (error) {
    rmSync(userDataDir, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Mở một profile Chrome MỚI, chạy hàm nhận phiên rồi LUÔN đóng và xoá profile.
 * Có đồng hồ canh: quá hạn thì kill Chrome theo tham số user-data-dir để lời gọi Playwright đang treo
 * bung ra lỗi, nhờ vậy khối finally vẫn dọn sạch (không để rò tiến trình Chrome).
 * Nhận: hậu tố tên profile, hàm bất đồng bộ nhận phiên Chrome, hạn chót cho cả kịch bản (ms).
 * Trả: giá trị mà hàm nhận phiên trả về.
 */
export async function withFreshChrome<T>(
  suffix: string,
  fn: (session: ChromeSession) => Promise<T>,
  deadlineMs = 150_000,
): Promise<T> {
  const session = await launchChromeBounded(parityPath("tmp"), suffix);
  const killer = setTimeout(() => {
    spawnSync("pkill", ["-f", session.userDataDir], { encoding: "utf8" });
  }, deadlineMs);
  try {
    return await fn(session);
  } finally {
    clearTimeout(killer);
    await closeChromeSession(session);
  }
}

/** Dấu vân tay rỗng, dùng khi không đọc được payload boot. */
export const EMPTY_FINGERPRINT: BootFingerprint = Object.freeze({
  rev: "",
  entries: 0,
  batches: 0,
  hash: "",
  version: "",
});

/**
 * Đọc dấu vân tay trạng thái cây plugin từ `__GBH_BOOT__ (alias __DSH_BOOT__)` của trang đang mở.
 * Nhận: trang Playwright đang mở.
 * Trả: { rev, entries, batches, hash, version } — hash là sha256 của danh sách "id@rev" đã sắp xếp,
 * nên hai cây khác nội dung mà cùng số entry vẫn phân biệt được.
 */
export async function readBootFingerprint(page: Page): Promise<BootFingerprint> {
  const raw = await page
    .evaluate(() => {
      const scope = globalThis as unknown as Record<string, unknown>;
      // task-31: ưu tiên __GBH_BOOT__, fallback alias __GBH_BOOT__ (alias __DSH_BOOT__).
      const boot = (scope.__GBH_BOOT__ ?? scope.__DSH_BOOT__) as Record<string, unknown> | undefined;
      if (boot === undefined) return null;
      const entries = Array.isArray(boot.entries) ? (boot.entries as { id?: unknown; rev?: unknown }[]) : [];
      const release = boot.release as { version?: unknown } | undefined;
      return {
        rev: typeof boot.rev === "string" ? boot.rev : "",
        batches: Array.isArray(boot.batches) ? boot.batches.length : 0,
        version: typeof release?.version === "string" ? release.version : "",
        pairs: entries.map((entry) => String(entry.id ?? "") + "@" + String(entry.rev ?? "")),
      };
    })
    .catch(() => null);
  if (raw === null) return { ...EMPTY_FINGERPRINT };
  return {
    rev: raw.rev,
    entries: raw.pairs.length,
    batches: raw.batches,
    hash: hashList(raw.pairs).slice(0, 16),
    version: raw.version,
  };
}

/**
 * Tìm dấu hiệu bất thường trong chữ hiển thị của trang.
 * Nhận: trang Playwright đang mở.
 * Trả: danh sách dấu hiệu khớp được (rỗng nghĩa là trang sạch).
 */
async function detectSymptoms(page: Page): Promise<string[]> {
  const text = (await page.evaluate(() => document.body.innerText)).toLowerCase();
  return SYMPTOM_MARKERS.filter((marker) => text.includes(marker.toLowerCase()));
}

/**
 * Chờ nội dung thật của màn hình (điều kiện sẵn sàng) và chờ mạng lặng.
 * Khung xương đang tải hoặc RPC treo đều bị coi là CHƯA SẴN SÀNG, không phải lỗi giao diện.
 * Nhận: trang Playwright, bộ ghi mạng, điều kiện sẵn sàng của kịch bản (có thể bỏ trống).
 * Trả: { ready, note, waitedMs, pending } — pending là các request còn treo lúc hết hạn.
 */
export async function waitReady(
  page: Page,
  recorder: NetRecorder,
  ready: Scenario["ready"],
): Promise<{ ready: boolean; note: string; waitedMs: number; pending: NetEntry[] }> {
  if (ready === undefined) return { ready: true, note: "trang tĩnh — chỉ cần tải xong", waitedMs: 0, pending: [] };
  const budget = ready.timeoutMs ?? 15_000;
  const started = Date.now();
  const deadline = started + budget;
  let satisfied = false;
  if (ready.selector !== undefined) {
    // Locator của Playwright hiểu cả các bộ chọn text= và css=, khác với waitForFunction (chỉ CSS).
    try {
      const locator = page.locator(ready.selector);
      await locator.first().waitFor({ state: "attached", timeout: Math.max(1000, deadline - Date.now()) });
      satisfied = (await locator.count()) >= (ready.minCount ?? 1);
    } catch {
      satisfied = false;
    }
  } else {
    satisfied = true;
  }
  while (Date.now() < deadline) {
    if (!satisfied) break;
    if (recorder.pending().length === 0) break;
    await page.waitForTimeout(500);
  }
  const pending = recorder.pending();
  const apiOk = ready.requireApi !== true || recorder.apiOk();
  const waitedMs = Date.now() - started;
  const ok = satisfied && apiOk && pending.length === 0;
  const note = ok
    ? ready.description + " (chờ " + String(waitedMs) + "ms)"
    : ready.description + " — KHÔNG đạt sau " + String(waitedMs) + "ms" +
      (satisfied ? "" : " (không thấy nội dung)") +
      (apiOk ? "" : " (chưa có phản hồi RPC 200 nào)") +
      (pending.length > 0 ? " · còn " + String(pending.length) + " request treo" : "");
  return { ready: ok, note, waitedMs, pending };
}

/**
 * Chụp một bên theo đúng kịch bản: mở trang, đóng hộp thoại một lần, chạy các bước, chờ sẵn sàng, chụp ảnh và đọc DOM.
 * Nhận: phiên Chrome đã mở (profile mới của riêng kịch bản này), bên cần chụp, kịch bản, viewport.
 * Trả: kết quả chụp gồm ảnh PNG, danh sách phần tử tương tác, nhật ký mạng và trạng thái sẵn sàng.
 */
export async function captureSide(
  session: ChromeSession,
  side: SideSpec,
  scenario: Scenario,
  viewport: Viewport,
): Promise<SideCapture> {
  const url = "http://127.0.0.1:" + String(side.port) + "/";
  const auth = resolveSessionCookieFrom(side.port, [credentialsPath()]);
  const recorder = createNetRecorder();
  const base: SideCapture = {
    key: side.key,
    label: side.label,
    port: side.port,
    url,
    ok: false,
    httpStatus: 0,
    title: "",
    inventory: [],
    steps: [],
    dismissed: 0,
    blockedByDialog: false,
    symptoms: [],
    consoleErrors: [],
    labels: [],
    ready: false,
    readyNote: "",
    net: [],
    pending: [],
    staticAssets: 0,
    fingerprint: { ...EMPTY_FINGERPRINT },
    headingText: "",
    headingY: -1,
    scroll: { documentBefore: 0, documentAfter: 0, regions: [] },
  };
  let page: Page;
  try {
    page = await session.context.newPage();
  } catch (error) {
    // Trình duyệt có thể đã chết (hết bộ nhớ, bị kill): trả về lỗi để runScenario ghi SKIP chứ không làm sập cả lượt.
    return {
      ...base,
      error: "không mở được trang: " + (error instanceof Error ? error.message.split("\n")[0] ?? "" : String(error)),
    };
  }
  try {
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(GOTO_TIMEOUT_MS);
    recorder.attach(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // ĐƯỜNG TOKEN trước: để app tự đặt cookie phiên qua MỘT lượt điều hướng ready-url.
    // Chỉ addCookies bằng cookie mint theo đường SECRET là đường lùi — nó 401 khi secret không khớp
    // dù app hoàn toàn lành (bẫy đã ghi trong AGENTS.md, và là nguyên nhân SKIP oan của rig này).
    const token = await enterByToken(session.context, side.port).catch(() => null);
    if (token === null || !token.appUp) {
      if (auth.cookie !== null) {
        await session.context.addCookies([
          { name: auth.cookie.name, value: auth.cookie.value, domain: "127.0.0.1", path: "/" },
        ]);
      }
    }
    await page.emulateMedia({ colorScheme: scenario.scheme ?? "light", reducedMotion: "reduce", forcedColors: "none" });
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && consoleErrors.length < 20) consoleErrors.push(message.text().slice(0, 200));
    });
    const response = await page.goto(url, { waitUntil: "load", timeout: GOTO_TIMEOUT_MS });
    await page
      .waitForFunction(() => document.querySelectorAll("button").length >= 3, { timeout: 20_000 })
      .catch(() => undefined);
    await page.waitForTimeout(1500);
    const status = response?.status() ?? 0;
    const content = await page.content();
    if (status === 401 || content.includes("authentication required")) {
      return { ...base, httpStatus: status, error: "401: thiếu xác thực (cookie phiên không hợp lệ)" };
    }
    const dismissedLabels = await dismissOneTimeDialogs(page);
    const symptoms = await detectSymptoms(page);
    // Tắt animation/transition/nháy con trỏ để ảnh hai bên chụp đúng một khung hình tĩnh.
    await page.addStyleTag({
      content: "*{animation:none !important;transition:none !important;caret-color:transparent !important}",
    });
    const { outcomes, failedRequired } = await runSteps(page, scenario.steps, ACTION_TIMEOUT_MS);
    const readyState = await waitReady(page, recorder, scenario.ready);
    // Hộp thoại có thể xuất hiện MUỘN (do RPC đổ về muộn) — đóng lần nữa rồi mới chụp.
    const lateDismissed = await dismissOneTimeDialogs(page);
    await page.waitForTimeout(Math.max(400, Math.min(SETTLE_MS, 1500)));
    // Chuẩn hoá vùng cuộn TRƯỚC khi chụp: một cú focus có thể làm trang tự cuộn vài chục pixel,
    // khiến hai bên lệch nhau cả khung dù giao diện giống hệt (đã xảy ra 28 px ở màn Plugins).
    const scroll = await resetScroll(page);
    const fingerprint = await readBootFingerprint(page);
    const heading = await firstHeading(page);
    const png = await page.screenshot({ type: "png", fullPage: false });
    const rows = await inventory(page);
    const dialogs = await dialogCount(page);
    const notes: StepOutcome[] = [...outcomes];
    if (dismissedLabels.length + lateDismissed.length > 0) {
      notes.push({
        label: "hộp thoại một lần",
        ok: true,
        note: "đã đóng: " + [...dismissedLabels, ...lateDismissed].join(", "),
      });
    }
    if (symptoms.length > 0) notes.push({ label: "dấu hiệu bất thường", ok: false, note: symptoms.join(" · ") });
    if (consoleErrors.length > 0) {
      notes.push({ label: "lỗi console", ok: false, note: consoleErrors.join(" | ").slice(0, 300) });
    }
    return {
      ...base,
      ok: true,
      httpStatus: status,
      title: await page.title(),
      png,
      inventory: rows,
      steps: notes,
      dismissed: dismissedLabels.length + lateDismissed.length,
      blockedByDialog: dialogs > 0,
      symptoms,
      consoleErrors,
      labels: [...new Set(rows.map((row) => elementLabel(row)).filter((label) => label !== ""))].sort(),
      ready: readyState.ready,
      readyNote: readyState.note,
      net: recorder.entries(),
      pending: readyState.pending.length > 0 ? readyState.pending : recorder.pending(),
      staticAssets: recorder.staticCount(),
      fingerprint,
      headingText: heading?.text ?? "",
      headingY: heading === null ? -1 : heading.y,
      scroll,
      error: failedRequired === null ? undefined : "bước bắt buộc hỏng: " + failedRequired,
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message.split("\n")[0] ?? "" : String(error),
      net: recorder.entries(),
      pending: recorder.pending(),
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}
