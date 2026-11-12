/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Xác thực (mint cookie phiên) và chụp ảnh trang bằng Playwright + Chrome có sẵn
 */

import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import type { BrowserContext, Page } from "playwright-core";
import { parse as parseYaml } from "yaml";

import { NAV_TIMEOUT_MS, SETTLE_MS } from "./paths.ts";

/** Cookie phiên của DSH; `value` là secret nên KHÔNG bao giờ được ghi ra file/log. */
export interface SessionCookie {
  /** Tên cookie: `dsh-auth-<base64url(sha256(authority))>`. */
  name: string;
  /** Giá trị cookie đã ký. */
  value: string;
}

/** Thông tin một trang sau khi chụp. */
export interface CaptureInfo {
  /** Tiêu đề document. */
  title: string;
  /** Danh sách asset đã chuẩn hoá (pathname, đã bỏ query). */
  assets: string[];
  /** sha256 của danh sách asset đã sắp xếp — "hash bundle". */
  assetsHash: string;
  /** Khoá cấp 1 của `__DSH_BOOT__`/`__BH_BOOT__` (hợp đồng C1). */
  bootKeys: string[];
  /** sha256 của danh sách khoá boot. */
  bootHash: string;
  /** Số module client đã nạp (nếu đọc được). */
  moduleCount: number;
  /** Số overlay (`role=dialog`/`aria-modal`) đã ẩn trước khi chụp để hai bên cùng trạng thái. */
  hiddenOverlays: number;
  /** true khi trang vẫn còn thẻ thông báo một lần (Preview Notice / Get started) lúc chụp. */
  noticeVisible: boolean;
}

/** Kết quả chụp một trang. */
export interface CaptureResult {
  /** true khi chụp được ảnh. */
  ok: boolean;
  /** Lý do lỗi khi `ok = false`. */
  error?: string;
  /** Ảnh PNG (chỉ có khi `ok = true`). */
  png?: Buffer;
  /** Mã HTTP của lần điều hướng cuối. */
  httpStatus: number;
  /** URL cuối cùng sau redirect. */
  finalUrl: string;
  /** true khi trang trả về trang 401 của DSH. */
  unauthorized: boolean;
  /** Thông tin trang (chỉ có khi `ok = true`). */
  info?: CaptureInfo;
  /** Lỗi console của trang (tối đa 20 dòng). */
  consoleErrors: string[];
}

/** Tuỳ chọn chụp. */
export interface CaptureOptions {
  /** URL sạch (không kèm token). */
  url: string;
  /** Chiều rộng khung nhìn. */
  width: number;
  /** Chiều cao khung nhìn. */
  height: number;
  /** Cookie phiên đã mint (nếu có). */
  cookie?: SessionCookie | null;
  /** Launch token in ra từ stdout của server vừa được parity boot (nếu có). */
  launchToken?: string;
  /** Thời gian chờ thêm sau khi tải xong. */
  settleMs?: number;
  /** Timeout điều hướng. */
  timeoutMs?: number;
}

/**
 * Mã hoá base64url không padding, đúng như `dsh-client-connection`.
 * @param buffer dữ liệu cần mã hoá.
 * @returns chuỗi base64url.
 */
export function encodeBase64Url(buffer: Buffer): string {
  let out = buffer.toString("base64").replaceAll("+", "-").replaceAll("/", "_");
  while (out.endsWith("=")) out = out.slice(0, -1);
  return out;
}

/**
 * Giải mã base64url.
 * @param value chuỗi base64url.
 * @returns buffer, hoặc null nếu chuỗi không hợp lệ.
 */
export function decodeBase64Url(value: string): Buffer | null {
  if (value.length % 4 === 1) return null;
  const normalised = value.replaceAll("-", "+").replaceAll("_", "/");
  const data = Buffer.from(normalised, "base64");
  return encodeBase64Url(data) === value ? data : null;
}

/**
 * Authority mà DSH dùng để buộc cookie (header `Host`).
 * @param port cổng của server.
 * @param host tên host, mặc định `127.0.0.1`.
 * @returns chuỗi `host:port`.
 */
export function authorityForPort(port: number, host = "127.0.0.1"): string {
  return host + ":" + String(port);
}

/**
 * Tên cookie phiên: `dsh-auth-` + base64url(sha256(authority)).
 * @param authority authority của server (`host:port`).
 * @returns tên cookie, khớp tuyệt đối với DSH.
 */
export function cookieNameForAuthority(authority: string): string {
  return "dsh-auth-" + encodeBase64Url(createHash("sha256").update(authority).digest());
}

/**
 * Đọc secret ký cookie phiên từ tài liệu credentials chung.
 * Giá trị secret chỉ tồn tại trong bộ nhớ, không in, không ghi.
 * @param credentialsFile đường dẫn `credentials.yaml`.
 * @returns buffer 32 byte, hoặc null nếu không đọc được.
 */
export function readBrowserSessionSecret(credentialsFile: string): Buffer | null {
  let text: string;
  try {
    text = readFileSync(credentialsFile, "utf8");
  } catch {
    return null;
  }
  try {
    const doc = parseYaml(text) as Record<string, unknown> | null;
    if (doc === null || typeof doc !== "object") return null;
    const records = doc.records;
    if (records === null || typeof records !== "object") return null;
    const record = (records as Record<string, unknown>)["client-connection/browser-session"];
    if (record === null || typeof record !== "object") return null;
    const payload = (record as Record<string, unknown>).payload;
    if (payload === null || typeof payload !== "object") return null;
    const secret = (payload as Record<string, unknown>).secret;
    if (typeof secret !== "string") return null;
    const decoded = decodeBase64Url(secret);
    return decoded !== null && decoded.byteLength === 32 ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Mint cookie phiên đúng định dạng `v1.<payload>.<hmac>` của DSH.
 * @param authority authority của server.
 * @param secret secret 32 byte đọc từ credentials.
 * @param issuedAt thời điểm cấp (ms), mặc định là hiện tại.
 * @param lifetimeMs thời hạn cookie, mặc định 1 ngày.
 * @returns cookie đã ký.
 */
export function mintSessionCookie(authority: string, secret: Buffer, issuedAt = Date.now(), lifetimeMs = 86_400_000): SessionCookie {
  const expiresAt = issuedAt + lifetimeMs;
  const body = encodeBase64Url(Buffer.from(JSON.stringify({ version: 1, authority, issuedAt, expiresAt }), "utf8"));
  const signature = encodeBase64Url(createHmac("sha256", secret).update(body).digest());
  return { name: cookieNameForAuthority(authority), value: "v1." + body + "." + signature };
}

/**
 * Chuẩn bị cookie để mở một server đang chạy sẵn.
 * @param port cổng server.
 * @param credentialsFile đường dẫn credentials, mặc định `~/.galaxy/credentials.yaml`.
 * @returns cookie và dấu vân tay ngắn của secret (bằng chứng, không phải secret).
 */
export function resolveSessionCookie(
  port: number,
  credentialsFile: string,
): { cookie: SessionCookie | null; secretFingerprint: string | null } {
  const secret = readBrowserSessionSecret(credentialsFile);
  if (secret === null) return { cookie: null, secretFingerprint: null };
  const authority = authorityForPort(port);
  const fingerprint = createHash("sha256").update(secret).digest("hex").slice(0, 12);
  return { cookie: mintSessionCookie(authority, secret), secretFingerprint: fingerprint };
}

/**
 * Thử mint cookie từ nhiều kho credentials (kho dùng chung, rồi kho riêng của home).
 * @param port cổng server.
 * @param files danh sách đường dẫn credentials theo thứ tự ưu tiên.
 * @returns cookie + dấu vân tay secret + file đã dùng.
 */
export function resolveSessionCookieFrom(
  port: number,
  files: readonly string[],
): { cookie: SessionCookie | null; secretFingerprint: string | null; source: string | null } {
  for (const file of files) {
    const resolved = resolveSessionCookie(port, file);
    if (resolved.cookie !== null) return { ...resolved, source: file };
  }
  return { cookie: null, secretFingerprint: null, source: null };
}

/** Tiền tố thư mục profile tạm của parity — dùng để nhận diện tiến trình Chrome còn sót. */
export const CHROME_TMP_PREFIX = "gbh-parity-chrome-";

/** Một phiên Chrome của parity kèm thư mục profile tạm cần dọn. */
export interface ChromeSession {
  /** Context Chrome bền với profile riêng (Playwright bắt buộc dùng launchPersistentContext). */
  context: BrowserContext;
  /** Thư mục profile tạm của phiên — dùng để kill tiến trình còn sót. */
  userDataDir: string;
}

/**
 * Mở Chrome có sẵn trên máy bằng Playwright (channel `chrome`, KHÔNG tải browser).
 * Mỗi phiên có `--user-data-dir` riêng dưới thư mục tạm để luôn nhận diện và dọn được
 * tiến trình còn sót (xem tools/parity/clean.ts).
 * @param tmpRoot thư mục chứa profile tạm (mặc định `<hệ điều hành>/tmp/gbh-parity-chrome-...`).
 * @param stamp hậu tố tên thư mục; mặc định là thời điểm hiện tại.
 * @returns phiên Chrome; caller PHẢI gọi {@link closeChromeSession} trong `finally`.
 */
export async function launchChrome(tmpRoot?: string, stamp = String(Date.now())): Promise<ChromeSession> {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const userDataDir = mkdtempSync(join(tmpRoot ?? tmpdir(), CHROME_TMP_PREFIX + stamp + "-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: true,
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "Asia/Saigon",
    args: ["--force-color-profile=srgb", "--hide-scrollbars", "--font-render-hinting=none"],
  });
  return { context, userDataDir };
}

/**
 * Đóng phiên Chrome thật chắc: đóng browser, kill tiến trình còn sót theo `--user-data-dir`,
 * rồi xoá thư mục profile tạm. Không bao giờ ném lỗi ra ngoài.
 * @param session phiên Chrome cần đóng (có thể null).
 * @returns không trả gì.
 */
export async function closeChromeSession(session: ChromeSession | null): Promise<void> {
  if (session === null) return;
  try {
    await session.context.close();
  } catch {
    // bỏ qua: dù close lỗi thì bước kill theo user-data-dir bên dưới vẫn dọn được
  }
  try {
    const { spawnSync } = await import("node:child_process");
    const { rmSync } = await import("node:fs");
    spawnSync("pkill", ["-f", session.userDataDir], { encoding: "utf8" });
    rmSync(session.userDataDir, { recursive: true, force: true });
  } catch {
    // bỏ qua: dọn dẹp là best-effort, không được làm hỏng lần chụp
  }
}

/**
 * Bấm các nút đóng overlay một lần (Preview Notice, chào mừng…) để hai bên cùng trạng thái.
 * @param page trang đang mở.
 * @returns số nút đã bấm.
 */
export async function dismissOverlays(page: Page): Promise<number> {
  let clicked: number = await page.evaluate(() => {
    const textLabels = ["continue", "got it", "dismiss", "close", "ok", "skip", "later", "not now"];
    const ariaLabels = ["close", "dismiss"];
    let count = 0;
    for (const node of Array.from(document.querySelectorAll("button"))) {
      const text = (node.textContent ?? "").trim().toLowerCase();
      const aria = (node.getAttribute("aria-label") ?? "").toLowerCase();
      const matchesText = textLabels.includes(text);
      const matchesAria = aria.length > 0 && ariaLabels.some((label) => aria.includes(label));
      if (!matchesText && !matchesAria) continue;
      (node as HTMLElement).click();
      count += 1;
      if (count >= 3) break;
    }
    return count;
  });
  if (clicked > 0) await page.waitForTimeout(700);
  const dialogs: number = await page.evaluate(() => document.querySelectorAll('[role="dialog"]').length);
  if (dialogs > 0) {
    await page.keyboard.press("Escape");
    clicked += 1;
    await page.waitForTimeout(500);
  }
  return clicked;
}

/**
 * Chuẩn hoá một URL asset về dạng so sánh được.
 * @param raw giá trị `src`/`href`.
 * @param origin origin của trang.
 * @returns pathname (cùng origin) hoặc URL tuyệt đối đã bỏ query/hash.
 */
export function normaliseAsset(raw: string, origin: string): string {
  try {
    const url = new URL(raw, origin);
    if (url.origin === origin) return url.pathname;
    return url.origin + url.pathname;
  } catch {
    return raw;
  }
}

/**
 * Băm một danh sách chuỗi thành hash ngắn (dùng cho "hash bundle" và hợp đồng boot).
 * @param items danh sách chuỗi.
 * @returns sha256 hex của danh sách đã sắp xếp.
 */
export function hashList(items: readonly string[]): string {
  const sorted = [...items].sort();
  return createHash("sha256").update(sorted.join("\n")).digest("hex");
}

/**
 * Chụp một trang web đã xác thực ở đúng một viewport, dùng lại context bền của phiên Chrome.
 * @param session phiên Chrome đã mở (xem {@link launchChrome}).
 * @param options tuỳ chọn chụp (url, kích thước, cookie hoặc launch token).
 * @returns ảnh PNG + thông tin trang; không ném lỗi khi trang 401. Trang luôn được đóng.
 */
export async function capturePage(session: ChromeSession, options: CaptureOptions): Promise<CaptureResult> {
  const settleMs = options.settleMs ?? SETTLE_MS;
  const timeout = options.timeoutMs ?? NAV_TIMEOUT_MS;
  const origin = new URL(options.url).origin;
  const consoleErrors: string[] = [];
  const context = session.context;
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: options.width, height: options.height });
    if (options.cookie !== undefined && options.cookie !== null) {
      await context.addCookies([
        { name: options.cookie.name, value: options.cookie.value, domain: "127.0.0.1", path: "/" },
      ]);
    }
    page.on("console", (message) => {
      if (message.type() === "error" && consoleErrors.length < 20) consoleErrors.push(message.text().slice(0, 200));
    });
    let response = await page.goto(options.url, { waitUntil: "load", timeout });
    if (options.launchToken !== undefined && options.launchToken !== "") {
      await page.goto(origin + "/?token=" + options.launchToken, { waitUntil: "load", timeout });
      await page.waitForTimeout(800);
      response = await page.goto(options.url, { waitUntil: "load", timeout });
    }
    // DSH dựng UI SAU khi nạp xong client module, nên overlay một lần (Preview Notice) chỉ xuất
    // hiện muộn — phải chờ app mount rồi mới đóng, nếu không hai bên lệch trạng thái hoàn toàn.
    await page
      .waitForFunction(() => document.querySelectorAll("button").length >= 3, { timeout: 20_000 })
      .catch(() => undefined);
    await page.waitForTimeout(400);
    const httpStatus = response?.status() ?? 0;
    const bodyText = await page.content();
    const unauthorized = httpStatus === 401 || bodyText.includes("authentication required");
    if (unauthorized) {
      return { ok: false, error: "401: thiếu xác thực (cookie hết hạn hoặc secret khác)", httpStatus, finalUrl: page.url(), unauthorized: true, consoleErrors };
    }
    const dismissed = await dismissOverlays(page);
    const noticeVisible: boolean = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes("Preview Notice") || text.includes("Get started");
    });
    // Overlay một lần (Get started/Preview Notice) là trạng thái RIÊNG của từng home, không phải
    // khác biệt giao diện — ẩn bằng CSS để phép so pixel nói về UI chứ không nói về onboarding.
    const hiddenOverlays: number = await page.evaluate(() => document.querySelectorAll('[role="dialog"],[aria-modal="true"]').length);
    await page.addStyleTag({
      content: [
        "*{animation:none !important;transition:none !important;caret-color:transparent !important}",
        '[role="dialog"],[aria-modal="true"]{display:none !important}',
      ].join("\n"),
    });
    await page.waitForTimeout(settleMs);
    if (dismissed > 0) consoleErrors.push("đã đóng " + String(dismissed) + " overlay một lần để hai bên cùng trạng thái");
    const raw = await page.evaluate(() => {
      const scope = globalThis as unknown as Record<string, unknown>;
      // task-31: ưu tiên __GBH_BOOT__; __GBH_BOOT__ (alias __DSH_BOOT__) là ALIAS cũ; __BH_BOOT__ là tên cũ hơn nữa.
      const boot = (scope.__GBH_BOOT__ ?? scope.__DSH_BOOT__ ?? scope.__BH_BOOT__ ?? null) as Record<string, unknown> | null;
      const bootKeys = boot !== null && typeof boot === "object" ? Object.keys(boot).sort() : [];
      const nodes = Array.from(document.querySelectorAll("script[src],link[href]"));
      const assets = nodes
        .map((node) => node.getAttribute("src") ?? node.getAttribute("href") ?? "")
        .filter((value) => value.length > 0);
      const loader = scope.__ModuleLoader__ as { modules?: Map<string, unknown> } | undefined;
      const moduleCount = loader?.modules instanceof Map ? loader.modules.size : 0;
      return { bootKeys, assets, moduleCount, title: document.title };
    });
    const assets = [...new Set(raw.assets.map((value) => normaliseAsset(value, origin)))].sort();
    const png = await page.screenshot({ type: "png", fullPage: false });
    const info: CaptureInfo = {
      title: raw.title,
      assets,
      assetsHash: hashList(assets),
      bootKeys: raw.bootKeys,
      bootHash: hashList(raw.bootKeys),
      moduleCount: raw.moduleCount,
      hiddenOverlays,
      noticeVisible,
    };
    return { ok: true, png, httpStatus, finalUrl: page.url(), unauthorized: false, info, consoleErrors };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      httpStatus: 0,
      finalUrl: options.url,
      unauthorized: false,
      consoleErrors,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}
