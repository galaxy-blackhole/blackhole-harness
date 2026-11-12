/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Vào app bằng ĐƯỜNG TOKEN trước, ĐƯỜNG SECRET sau — hết lớp lỗi 'secret lệch' làm giàn đo SKIP oan
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { BrowserContext, Page } from "playwright-core";

import { type SessionCookie, cookieNameForAuthority, resolveSessionCookieFrom } from "./browser.ts";
import { appHome } from "./paths.ts";

/** Kết quả một lần vào app. */
export interface EntryResult {
  /** Đường đã dùng: token (ready-url) · secret (credentials) · none (không vào được). */
  via: "token" | "secret" | "none";
  /** Cookie phiên tìm được, nếu có. */
  cookie: SessionCookie | null;
  /** Mã HTTP của lần điều hướng kiểm chứng (0 khi không kết nối được). */
  status: number;
  /** App có phục vụ không (kết nối được và trả trang). */
  appUp: boolean;
  /** Mô tả ngắn để in ra log — KHÔNG chứa secret. */
  detail: string;
}

/** Ứng viên file ready-url cho một cổng. */
function readyUrlCandidates(port: number): string[] {
  return [join(appHome(), "ready-url-" + String(port) + ".txt"), join(appHome(), "ready-url.txt")];
}

/**
 * Đọc ready-url của một cổng.
 * Nhận: cổng cần vào.
 * Trả: URL kèm token nếu file tồn tại VÀ cổng trong URL khớp; ngược lại null.
 */
export function readyUrlForPort(port: number): string | null {
  for (const file of readyUrlCandidates(port)) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8").trim();
    if (text === "") continue;
    try {
      const parsed = new URL(text);
      if (parsed.port !== String(port)) continue;
      return text;
    } catch {
      continue;
    }
  }
  return null;
}

/** URL gốc của một cổng. */
function baseUrlForPort(port: number): string {
  return "http://127.0.0.1:" + String(port) + "/";
}

/**
 * Mở một trang và cho biết app có phục vụ vỏ DSH hay không.
 * Nhận: context Chrome, URL cần mở.
 * Trả: mã HTTP (0 khi không kết nối được) và app có phục vụ không.
 */
async function loadAndProbe(context: BrowserContext, url: string): Promise<{ status: number; appUp: boolean; bootError: string }> {
  const page: Page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "load", timeout: 25_000 }).catch(() => null);
    await page.waitForTimeout(600);
    // Phép dò ĐÚNG: biến toàn cục đồ thị boot (payload có thể không nằm trong innerHTML) — tên MỚI
    // __GBH_BOOT__ trước, tên CŨ __GBH_BOOT__ (alias __DSH_BOOT__) là ALIAS tương thích (task-31).
    // cộng bằng chứng UI đã render thật (#root có nội dung) và băng lỗi nạp plugin nếu có.
    const probe = await page
      .evaluate(() => {
        const html = document.documentElement.innerHTML;
        const banner = html.includes("Failed to load plugins") ? "Failed to load plugins" : "";
        const rootChars = (document.getElementById("root")?.textContent ?? "").length;
        const scope = window as { __GBH_BOOT__?: unknown; __DSH_BOOT__?: unknown };
        const globalBoot = typeof scope.__GBH_BOOT__ !== "undefined" || typeof scope.__DSH_BOOT__ !== "undefined";
        return { hasBoot: globalBoot || html.includes("__GBH_BOOT__") || html.includes("__DSH_BOOT__"), banner, rootChars };
      })
      .catch(() => ({ hasBoot: false, banner: "", rootChars: 0 }));
    // Vào được app là khi vỏ DSH thật sự render (có payload boot hoặc #root có nội dung).
    // Băng lỗi nạp plugin là KHIẾM KHUYẾT CỦA APP, không phải lý do để nói 'dụng cụ không vào được' —
    // nó được ghi kèm như thông tin để người đo biết vì sao UI có thể chưa đủ.
    const appUp = probe.hasBoot || probe.rootChars > 200;
    return { status: response === null ? 0 : response.status(), appUp, bootError: probe.banner };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Vào app bằng TOKEN: mở ready-url MỘT LẦN để app tự đặt cookie phiên, rồi đọc lại cookie đó.
 * Nhận: context Chrome và cổng.
 * Trả: cookie app đã đặt (kèm mô tả), hoặc null khi không có ready-url/cookie.
 */
export async function enterByToken(context: BrowserContext, port: number): Promise<{ cookie: SessionCookie; appUp: boolean; bootError: string; detail: string } | null> {
  const url = readyUrlForPort(port);
  if (url === null) return null;
  const probe = await loadAndProbe(context, url);
  const wanted = cookieNameForAuthority("127.0.0.1:" + String(port));
  // App có thể đặt cookie SAU khi trang ready-url kịp load — chờ tới 6 giây thay vì đọc một lần.
  let jar: { name: string; value: string }[] = [];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    jar = (await context.cookies(baseUrlForPort(port)).catch(() => [])) as { name: string; value: string }[];
    if (jar.some((cookie) => cookie.name.startsWith("dsh-auth-"))) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  // App có thể đặt cookie dưới authority hơi khác (host alias) nên ưu tiên tên khớp tuyệt đối,
  // rồi chấp nhận cookie phiên bất kỳ (dsh-auth-*) — phép kiểm __GBH_BOOT__ (alias __DSH_BOOT__) mới là thứ quyết định.
  const found = jar.find((cookie: { name: string }) => cookie.name === wanted) ?? jar.find((cookie: { name: string }) => cookie.name.startsWith("dsh-auth-"));
  const detail = "ready-url (token → phiên, http " + String(probe.status) + ")" + (probe.bootError === "" ? "" : " · app có băng lỗi nạp plugin: " + probe.bootError);
  if (found === undefined) return null;
  return { cookie: { name: found.name, value: found.value }, appUp: probe.appUp, bootError: probe.bootError, detail };
}

/**
 * Vào app: TOKEN trước, SECRET sau. Phân biệt rõ 'app không phục vụ' với 'dụng cụ không vào được'.
 * Nhận: context Chrome, cổng, và các kho credentials để mint theo đường secret.
 * Trả: { via, cookie, status, appUp, detail }.
 */
export async function enterSession(context: BrowserContext, port: number, stores: readonly string[]): Promise<EntryResult> {
  // App có thể đang bận/đang boot lại ngay lúc đo ⇒ thử đường token tới 3 lần trước khi kết luận.
  let token = await enterByToken(context, port);
  for (let attempt = 0; attempt < 2 && (token === null || !token.appUp); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const again = await enterByToken(context, port);
    if (again !== null && again.appUp) {
      token = again;
      break;
    }
    if (token === null && again !== null) token = again;
  }
  if (token !== null && token.appUp) {
    return { via: "token", cookie: token.cookie, status: 200, appUp: true, detail: token.detail };
  }
  const minted = resolveSessionCookieFrom(port, stores);
  if (minted.cookie !== null) {
    await context.addCookies([{ name: minted.cookie.name, value: minted.cookie.value, domain: "127.0.0.1", path: "/" }]).catch(() => undefined);
    const probe = await loadAndProbe(context, baseUrlForPort(port));
    if (probe.appUp) {
      return { via: "secret", cookie: minted.cookie, status: probe.status, appUp: true, detail: "credentials (secret vân tay " + String(minted.secretFingerprint) + ")" };
    }
    if (probe.status === 0) {
      return { via: "none", cookie: null, status: 0, appUp: false, detail: "không kết nối được cổng " + String(port) };
    }
    if (probe.status === 401 || probe.status === 403) {
      // Trang trả 401/403 nghĩa là CẢ HAI đường vào đều bị từ chối — lỗi của DỤNG CỤ ĐO,
      // không phải app boot hỏng. Phân biệt này là yêu cầu của task-49.
      return {
        via: "none",
        cookie: null,
        status: probe.status,
        appUp: true,
        detail: "DỤNG CỤ KHÔNG VÀO ĐƯỢC — cả đường token lẫn đường secret đều bị từ chối (http " + String(probe.status) + ") · secret vân tay " + String(minted.secretFingerprint) + " · token " + (token === null ? "không đặt được phiên" : "có cookie nhưng vẫn 401"),
      };
    }
    if (probe.status !== 0 && !probe.appUp) {
      return {
        via: "none",
        cookie: null,
        status: probe.status,
        appUp: false,
        detail: "APP BOOT HỎNG — trang trả HTTP " + String(probe.status) + " nhưng KHÔNG có __GBH_BOOT__ (hoặc alias __DSH_BOOT__)" + (probe.bootError === "" ? "" : " (băng lỗi: " + probe.bootError + ")"),
      };
    }
    return {
      via: "none",
      cookie: null,
      status: probe.status,
      appUp: true,
      detail: "app CÓ phục vụ (http " + String(probe.status) + ") nhưng không đường nào vào được: token " + (token === null ? "không có ready-url/cookie" : "có cookie nhưng trang không có __DSH_BOOT__") + " · secret vân tay " + String(minted.secretFingerprint) + " bị từ chối",
    };
  }
  if (token !== null) {
    return { via: "none", cookie: null, status: token.appUp ? 200 : 0, appUp: token.appUp, detail: "token có cookie nhưng trang không có __DSH_BOOT__ · không mint được secret" };
  }
  const probe = await loadAndProbe(context, baseUrlForPort(port));
  return {
    via: "none",
    cookie: null,
    status: probe.status,
    appUp: probe.appUp,
    detail: probe.status === 0 ? "không kết nối được cổng " + String(port) : "không có ready-url cho cổng này và không mint được secret",
  };
}
