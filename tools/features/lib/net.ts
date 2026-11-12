/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Ghi nhật ký mạng của một trang (request/response/requestfailed) đã lọc secret, phục vụ chẩn đoán treo RPC
 */

import type { Page, Request } from "playwright-core";

/** Một lượt request đã chuẩn hoá để so hai bên. */
export interface NetEntry {
  /** Phương thức HTTP. */
  method: string;
  /** URL đã lọc bỏ giá trị của token/khoá bí mật. */
  url: string;
  /** Mã trạng thái (0 khi không nhận được phản hồi). */
  status: number;
  /** Thời gian từ lúc gửi tới lúc xong, mili giây (-1 khi chưa xong). */
  ms: number;
  /** Số byte thân phản hồi (-1 khi không đọc được). */
  bytes: number;
  /** Loại tài nguyên theo Playwright: document, xhr, fetch, script, stylesheet, image, font, websocket... */
  kind: string;
  /** Lỗi mạng nếu có. */
  error?: string;
  /** true khi request đã gửi nhưng chưa có phản hồi lúc chụp ảnh (dấu hiệu RPC treo). */
  pending?: boolean;
}

/** Bộ ghi nhật ký mạng cho một trang. */
export interface NetRecorder {
  /** Gắn bộ ghi vào một trang Playwright. */
  attach(page: Page): void;
  /** Toàn bộ request đã ghi (đã lọc secret), sắp theo thời điểm bắt đầu. */
  entries(): NetEntry[];
  /** Các request KHÔNG phải asset tĩnh (document/xhr/fetch/websocket) — phần cần đối chiếu hai bên. */
  apiEntries(): NetEntry[];
  /** Số request asset tĩnh đã bỏ qua (script, stylesheet, image, font, media). */
  staticCount(): number;
  /** Các request còn treo lúc gọi (đã gửi quá 3 giây mà chưa có phản hồi). */
  pending(now?: number): NetEntry[];
  /** true khi đã có ít nhất một phản hồi RPC (xhr/fetch) mã 200 — bằng chứng dữ liệu thật đã về. */
  apiOk(): boolean;
}

/** Loại tài nguyên được coi là asset tĩnh, không đối chiếu giữa hai bên. */
const STATIC_KINDS: readonly string[] = Object.freeze(["script", "stylesheet", "image", "font", "media", "other", "manifest"]);

/** Tham số truy vấn bị coi là bí mật và bị thay bằng dấu sao trước khi ghi ra file. */
const SECRET_PARAMS: readonly string[] = Object.freeze(["token", "key", "apikey", "api_key", "secret", "auth", "password", "session"]);

/**
 * Lọc bỏ giá trị bí mật trong URL trước khi ghi log.
 * Nhận: URL thô của request.
 * Trả: URL đã thay giá trị của tham số nhạy cảm bằng ba dấu sao (không giữ nguyên văn bí mật).
 */
export function sanitiseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const name of [...url.searchParams.keys()]) {
      if (SECRET_PARAMS.includes(name.toLowerCase())) url.searchParams.set(name, "***");
    }
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return raw.split("?")[0] ?? raw;
  }
}

/**
 * Tạo bộ ghi nhật ký mạng cho một trang.
 * Nhận: không.
 * Trả: bộ ghi có các hàm attach/entries/apiEntries/staticCount/pending.
 */
export function createNetRecorder(): NetRecorder {
  const started = new Map<Request, { at: number; kind: string; method: string; url: string }>();
  const log: NetEntry[] = [];
  let statics = 0;
  return {
    attach(page: Page): void {
      page.on("request", (request) => {
        const kind = request.resourceType();
        started.set(request, {
          at: Date.now(),
          kind,
          method: request.method(),
          url: sanitiseUrl(request.url()),
        });
      });
      page.on("response", (response) => {
        const request = response.request();
        const meta = started.get(request);
        if (meta === undefined) return;
        const header = response.headers()["content-length"];
        log.push({
          method: meta.method,
          url: meta.url,
          status: response.status(),
          ms: Date.now() - meta.at,
          bytes: header === undefined ? -1 : Number(header),
          kind: meta.kind,
        });
      });
      page.on("requestfailed", (request) => {
        const meta = started.get(request);
        if (meta === undefined) return;
        log.push({
          method: meta.method,
          url: meta.url,
          status: 0,
          ms: Date.now() - meta.at,
          bytes: 0,
          kind: meta.kind,
          error: request.failure()?.errorText ?? "unknown",
        });
      });
    },
    entries(): NetEntry[] {
      return log.filter((entry) => !STATIC_KINDS.includes(entry.kind));
    },
    apiEntries(): NetEntry[] {
      return log.filter((entry) => ["document", "xhr", "fetch", "websocket"].includes(entry.kind));
    },
    apiOk(): boolean {
      return log.some((entry) => (entry.kind === "xhr" || entry.kind === "fetch") && entry.status === 200);
    },
    staticCount(): number {
      statics = log.filter((entry) => STATIC_KINDS.includes(entry.kind)).length;
      return statics;
    },
    pending(now = Date.now()): NetEntry[] {
      const answered = new Set(log.map((entry) => entry.method + " " + entry.url));
      const out: NetEntry[] = [];
      for (const [request, meta] of started) {
        if (STATIC_KINDS.includes(meta.kind)) continue;
        // websocket là kênh sống dài hạn (stream phiên), không bao giờ "trả xong" — không tính là treo.
        if (meta.kind === "websocket") continue;
        if (answered.has(meta.method + " " + meta.url)) continue;
        if (request.isNavigationRequest() && now - meta.at < 3000) continue;
        if (now - meta.at < 3000) continue;
        out.push({ method: meta.method, url: meta.url, status: 0, ms: now - meta.at, bytes: -1, kind: meta.kind, pending: true });
      }
      return out;
    },
  };
}
