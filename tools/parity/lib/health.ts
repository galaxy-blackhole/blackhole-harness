/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cổng trạng thái bắt buộc trước mọi phép đo: app phải LÀNH (sidebar + ô soạn tin, không băng báo lỗi)
 *      và thời điểm đo không được rơi vào cửa sổ INVALID_WINDOWS đã biết
 */

import type { BrowserContext, Page } from "playwright-core";

/** Một cửa sổ thời gian mà mọi số liệu đo được đều KHÔNG hợp lệ. */
export interface InvalidWindow {
  /** Nhãn ngày theo giờ địa phương, dạng `YYYY-MM-DD`. */
  date: string;
  /** Giờ bắt đầu (giờ địa phương, `HH:MM`), tính là thuộc cửa sổ. */
  from: string;
  /** Giờ kết thúc (giờ địa phương, `HH:MM`), KHÔNG tính là thuộc cửa sổ. */
  to: string;
  /** Lý do — để report giải thích vì sao lượt đo bị bỏ. */
  why: string;
}

/**
 * Các cửa sổ KHÔNG hợp lệ đã biết. Trong khoảng này app hỏng tầng RPC nên bất kỳ số liệu nào
 * (kể cả "0 px lệch") cũng vô nghĩa — phải SKIP chứ không được kết luận.
 */
export const INVALID_WINDOWS: readonly InvalidWindow[] = Object.freeze([
  {
    date: "2026-10-17",
    from: "13:07",
    to: "13:40",
    why: "app hỏng RPC (RPC hỏng làm UI không mount) — mọi số liệu trong khoảng này không hợp lệ",
  },
]);

/** Chuỗi báo lỗi nạp plugin mà một app LÀNH tuyệt đối không được có. */
export const FAILURE_BANNERS: readonly string[] = Object.freeze([
  "Failed to load plugins",
  "did not activate",
  "failed to activate",
]);

/** Chuỗi nhận diện hộp thoại đòi API key — cũng là trạng thái không đo được. */
export const API_KEY_PROMPTS: readonly string[] = Object.freeze([
  "Enter your Galaxy API key",
  "Enter your API key",
  "API key is required",
]);

/** Các selector dùng để nhận diện một app đã mount giao diện thật. */
export const HEALTH_PROBES = Object.freeze({
  /** Thanh bên: DSH dựng `aside` làm cột điều hướng. */
  sidebar: "aside, nav, [class*='sidebar'], [data-testid*='sidebar']",
  /** Ô soạn tin: ô nhập đa dòng có thể gõ được. */
  composer: "textarea, [contenteditable='true'], [role='textbox']",
});

/** Kết quả đánh giá trạng thái một trang. */
export interface HealthReport {
  /** true khi app LÀNH: có sidebar, có ô soạn tin, không băng lỗi, không modal API key. */
  ok: boolean;
  /** Số node khớp selector thanh bên. */
  sidebarNodes: number;
  /** Số node khớp selector ô soạn tin. */
  composerNodes: number;
  /** Số nút bấm nhìn thấy được (app đã mount thì phải có nút). */
  buttons: number;
  /** Các chuỗi lỗi bắt gặp trong văn bản trang. */
  banners: string[];
  /** true khi có hộp thoại đòi API key. */
  apiKeyModal: boolean;
  /** true khi trang là trang 401 (thiếu xác thực) — không phải app hỏng mà là lỗi xác thực. */
  unauthorized: boolean;
  /** Cửa sổ không hợp lệ mà thời điểm đo rơi vào (null nếu hợp lệ). */
  invalidWindow: InvalidWindow | null;
  /** Danh sách lý do khi `ok = false`, dạng người đọc được. */
  reasons: string[];
}

/**
 * Đổi một chuỗi `HH:MM` thành số phút kể từ nửa đêm.
 * @param clock chuỗi giờ dạng `HH:MM`.
 * @returns số phút, hoặc NaN nếu chuỗi sai định dạng.
 */
export function clockToMinutes(clock: string): number {
  const parts = clock.split(":");
  if (parts.length !== 2) return Number.NaN;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return hours * 60 + minutes;
}

/**
 * Định dạng một thời điểm theo giờ địa phương thành `YYYY-MM-DD` và `HH:MM`.
 * @param date thời điểm cần định dạng, mặc định là hiện tại.
 * @returns cặp ngày/giờ địa phương.
 */
export function localClock(date: Date = new Date()): { date: string; time: string } {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return {
    date: String(date.getFullYear()) + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()),
    time: pad(date.getHours()) + ":" + pad(date.getMinutes()),
  };
}

/**
 * Kiểm tra một thời điểm có rơi vào cửa sổ không hợp lệ nào không.
 * @param date thời điểm cần kiểm, mặc định là hiện tại.
 * @param windows danh sách cửa sổ, mặc định {@link INVALID_WINDOWS}.
 * @returns cửa sổ bị rơi vào, hoặc null nếu thời điểm hợp lệ.
 */
export function findInvalidWindow(date: Date = new Date(), windows: readonly InvalidWindow[] = INVALID_WINDOWS): InvalidWindow | null {
  const local = localClock(date);
  const now = clockToMinutes(local.time);
  for (const window of windows) {
    if (window.date !== local.date) continue;
    const from = clockToMinutes(window.from);
    const to = clockToMinutes(window.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    if (now >= from && now < to) return window;
  }
  return null;
}

/**
 * Đọc trạng thái một trang đã mở và chấm điểm LÀNH/HỎNG.
 * @param page trang Playwright đang mở (đã điều hướng).
 * @param date thời điểm đo, mặc định là hiện tại.
 * @returns báo cáo trạng thái kèm lý do cụ thể.
 */
export async function assessHealth(page: Page, date: Date = new Date()): Promise<HealthReport> {
  const reasons: string[] = [];
  const invalidWindow = findInvalidWindow(date);
  if (invalidWindow !== null) {
    reasons.push(
      "thời điểm đo nằm trong INVALID_WINDOWS " + invalidWindow.from + "–" + invalidWindow.to + " (" + invalidWindow.why + ")",
    );
  }
  const probe = await page
    .evaluate(
      (input: { sidebar: string; composer: string; banners: string[]; apiKeys: string[] }) => {
        const text = document.body === null ? "" : document.body.innerText;
        return {
          sidebarNodes: document.querySelectorAll(input.sidebar).length,
          composerNodes: document.querySelectorAll(input.composer).length,
          buttons: document.querySelectorAll("button").length,
          banners: input.banners.filter((needle) => text.includes(needle)),
          apiKeyModal: input.apiKeys.some((needle) => text.includes(needle)),
          url: location.href,
        };
      },
      { sidebar: HEALTH_PROBES.sidebar, composer: HEALTH_PROBES.composer, banners: [...FAILURE_BANNERS], apiKeys: [...API_KEY_PROMPTS] },
    )
    .catch(() => ({ sidebarNodes: 0, composerNodes: 0, buttons: 0, banners: [] as string[], apiKeyModal: false, url: "" }));
  const unauthorized = probe.url.includes("/auth") || probe.url.includes("401");
  if (probe.sidebarNodes === 0) reasons.push("không thấy thanh bên (sidebar) — UI chưa mount");
  if (probe.composerNodes === 0) reasons.push("không thấy ô soạn tin — UI chưa mount");
  if (probe.banners.length > 0) reasons.push("có băng báo lỗi nạp plugin: " + probe.banners.join(" · "));
  if (probe.apiKeyModal) reasons.push("có hộp thoại đòi API key — trạng thái chặn, không đo được");
  if (unauthorized) reasons.push("trang 401 — thiếu/không đúng cookie phiên");
  return {
    ok: reasons.length === 0,
    sidebarNodes: probe.sidebarNodes,
    composerNodes: probe.composerNodes,
    buttons: probe.buttons,
    banners: probe.banners,
    apiKeyModal: probe.apiKeyModal,
    unauthorized,
    invalidWindow,
    reasons,
  };
}

/**
 * Mô tả ngắn gọn một báo cáo trạng thái để in ra log và ghi vào report.
 * @param health báo cáo trạng thái.
 * @returns chuỗi một dòng tiếng Việt.
 */
export function describeHealth(health: HealthReport): string {
  if (health.ok) {
    return (
      "LÀNH — sidebar " + String(health.sidebarNodes) + " node · ô soạn tin " + String(health.composerNodes) +
      " node · " + String(health.buttons) + " nút · không băng lỗi · không modal API key"
    );
  }
  return "KHÔNG ĐO ĐƯỢC — " + health.reasons.join("; ");
}

/**
 * Cổng trạng thái: ném lỗi kèm lý do khi app không LÀNH hoặc thời điểm đo không hợp lệ.
 * @param health báo cáo trạng thái cần kiểm.
 * @returns chính báo cáo đó khi đạt, để dùng dạng `const h = requireHealthy(await assessHealth(page))`.
 * @throws Error khi app không lành hoặc rơi vào cửa sổ không hợp lệ — người gọi phải SKIP, không kết luận.
 */
export function requireHealthy(health: HealthReport): HealthReport {
  if (!health.ok) throw new Error("parity: cổng trạng thái không đạt → SKIP. " + describeHealth(health));
  return health;
}

/** Tuỳ chọn khi đánh giá trạng thái một URL. */
export interface UrlHealthOptions {
  /** Cookie phiên đã mint trong bộ nhớ (giá trị KHÔNG bao giờ được ghi ra log/file). */
  cookie?: { name: string; value: string } | null;
  /** Thời gian chờ UI mount trước khi chấm điểm. */
  waitMs?: number;
  /** Thời điểm đo. */
  date?: Date;
}

/**
 * Đánh giá trạng thái tại một URL: gắn cookie phiên, mở trang, chờ UI mount rồi chấm điểm.
 * @param context context Chrome của phiên parity.
 * @param url URL cần kiểm.
 * @param options cookie phiên + thời gian chờ + thời điểm đo.
 * @returns báo cáo trạng thái kèm mã HTTP của lần điều hướng.
 */
export async function assessUrlHealth(context: BrowserContext, url: string, options: UrlHealthOptions = {}): Promise<HealthReport> {
  const waitMs = options.waitMs ?? 4000;
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    if (options.cookie !== undefined && options.cookie !== null) {
      await context.addCookies([{ name: options.cookie.name, value: options.cookie.value, domain: "127.0.0.1", path: "/" }]);
    }
    const response = await page.goto(url, { waitUntil: "load", timeout: 30_000 }).catch(() => null);
    await page
      .waitForFunction(() => document.querySelectorAll("button").length >= 1, { timeout: 20_000 })
      .catch(() => undefined);
    await page.waitForTimeout(waitMs);
    const report = await assessHealth(page, options.date ?? new Date());
    if (response !== null && response.status() === 401 && !report.reasons.some((reason) => reason.includes("401"))) {
      report.reasons.push("trang trả 401 — thiếu/không đúng cookie phiên");
      report.ok = false;
      report.unauthorized = true;
    }
    return report;
  } finally {
    await page.close().catch(() => undefined);
  }
}
