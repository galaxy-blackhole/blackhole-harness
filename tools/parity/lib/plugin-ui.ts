/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Phần UI/HTTP của phép đo plugin-compat: thăm route bằng cookie mint trong bộ nhớ, mở Settings,
 *      và thu bằng chứng trình duyệt rằng nửa client của plugin đã tới và có chạy hay không
 */

import type { Page } from "playwright-core";

import { type ChromeSession, resolveSessionCookieFrom } from "./browser.ts";
import { type HealthReport, assessUrlHealth, describeHealth } from "./health.ts";
import { credentialsPath } from "./paths.ts";
import { EXTERNAL_PLUGIN } from "./plugin-npm.ts";

/** Kết quả thăm một route HTTP. */
export interface RouteProbe {
  /** Cổng. */
  port: number;
  /** Đường dẫn. */
  path: string;
  /** Mã HTTP. */
  status: number;
  /** Kiểu nội dung. */
  contentType: string;
  /** Số byte thân phản hồi. */
  bytes: number;
  /** 200 byte đầu của thân (đã rút gọn khoảng trắng). */
  head: string;
}

/** Bằng chứng phía trình duyệt rằng plugin được nạp + chạy. */
export interface ClientProof {
  /** Số entry của __DSH_BOOT__ (bằng chứng manifest đã compose). */
  bootEntryCount: number;
  /** Các entry của boot graph thuộc plugin (đã NẠP). */
  pluginBootEntries: string[];
  /** Các phản hồi bundle chứa mã client của plugin (URL + status + byte). */
  bundleHits: { url: string; status: number; bytes: number }[];
  /** true khi tìm thấy chuỗi riêng của plugin trong bundle tải về. */
  bundleMarkerFound: boolean;
  /** Danh sách mục trong Settings trước khi cài. */
  baselineNav: string[];
  /** Danh sách mục trong Settings khi plugin đang chạy. */
  pluginNav: string[];
  /** Mục Settings CHỈ xuất hiện khi có plugin (khác biệt đối chứng). */
  addedNavItems: string[];
  /** true khi thấy nhãn trang Settings của plugin trong văn bản trang. */
  navLabelSeen: boolean;
  /** Số ms phải chờ tới khi trang Settings của plugin hiện ra (null nếu không thấy trong hạn chờ). */
  pageVisibleAfterMs: number | null;
  /** Báo cáo trạng thái app lúc chụp. */
  health: HealthReport | null;
  /** Ảnh Settings lúc plugin đang chạy (tương đối repo). */
  screenshot: string | null;
}

/**
 * Thăm một route bằng cookie phiên mint trong bộ nhớ (giá trị cookie không bao giờ bị ghi ra).
 * @param port cổng.
 * @param path đường dẫn.
 * @param cookie cookie phiên đã mint.
 * @returns mã HTTP + số byte + 200 byte đầu của thân.
 */
export async function probeRoute(port: number, path: string, cookie: { name: string; value: string } | null): Promise<RouteProbe> {
  const headers: Record<string, string> = cookie === null ? {} : { cookie: cookie.name + "=" + cookie.value };
  const response = await fetch("http://127.0.0.1:" + String(port) + path, { headers, signal: AbortSignal.timeout(20_000) });
  const data = Buffer.from(await response.arrayBuffer());
  return {
    port,
    path,
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    bytes: data.length,
    head: data.subarray(0, 200).toString("utf8").replace(/\s+/gu, " "),
  };
}

/**
 * Đo số byte HTML trang chủ bằng cookie đã mint (bằng chứng byte, thay cho "HTTP 200 là đủ").
 * @param port cổng.
 * @param cookie cookie phiên.
 * @returns số byte, hoặc null khi không lấy được.
 */
export async function pageBytes(port: number, cookie: { name: string; value: string } | null): Promise<number | null> {
  try {
    const headers: Record<string, string> = cookie === null ? {} : { cookie: cookie.name + "=" + cookie.value };
    const response = await fetch("http://127.0.0.1:" + String(port) + "/", { headers, signal: AbortSignal.timeout(20_000) });
    return Buffer.from(await response.arrayBuffer()).length;
  } catch {
    return null;
  }
}

/**
 * Mint cookie phiên cho một cổng từ kho credentials dùng chung rồi tới kho riêng của home.
 * @param port cổng.
 * @param home DSH_HOME của app.
 * @returns cookie (giá trị chỉ nằm trong bộ nhớ).
 */
export function cookieFor(port: number, home: string): { name: string; value: string } | null {
  return resolveSessionCookieFrom(port, [credentialsPath(), home + "/.credentials.yaml"]).cookie;
}

/**
 * Mint cookie phiên, ưu tiên kho credentials NẰM TRONG chính home đó.
 * Oracle B (home tạm) sinh secret riêng trong home của nó, nên mint từ kho dùng chung sẽ bị 401.
 * @param port cổng.
 * @param home DSH_HOME của bên cần mở.
 * @returns cookie (giá trị chỉ nằm trong bộ nhớ).
 */
export function cookieForHomeFirst(port: number, home: string): { name: string; value: string } | null {
  return resolveSessionCookieFrom(port, [home + "/.credentials.yaml", credentialsPath()]).cookie;
}

/**
 * Mở trang Settings của vỏ DSH: bấm menu tài khoản (More/Account menu) rồi mục Settings.
 * @param page trang đang mở.
 * @returns true khi đã bấm được mục Settings.
 */
export async function openSettings(page: Page): Promise<boolean> {
  const opened = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("button,[role='button']"));
    const menu =
      candidates.find((node) => (node.getAttribute("aria-label") ?? "") === "Account menu") ??
      candidates.find((node) => /more|account/i.test((node.textContent ?? "") + " " + (node.getAttribute("aria-label") ?? "")));
    if (menu === undefined) return false;
    (menu as HTMLElement).click();
    return true;
  });
  if (!opened) return false;
  await page.waitForTimeout(1200);
  const clicked = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("[role='menuitem'],button,a"));
    const target = items.find((node) => {
      const text = (node.textContent ?? "").replace(/\s+/gu, " ").trim();
      return text === "Settings" || text.startsWith("Settings");
    });
    if (target === undefined) return false;
    (target as HTMLElement).click();
    return true;
  });
  await page.waitForTimeout(2500);
  return clicked;
}

/**
 * Đọc danh sách mục trong ngăn Settings (mỗi mục là một nhãn ngắn).
 * @param page trang đang mở ở Settings.
 * @returns danh sách nhãn đã sắp xếp, đã bỏ trùng.
 */
export async function readSettingsNav(page: Page): Promise<string[]> {
  const lines: string[] = await page.evaluate(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const nodes = Array.from(document.querySelectorAll("nav a, nav button, [role='tab'], [class*='nav'] button, [class*='nav'] a"));
    for (const node of nodes) {
      const text = (node.textContent ?? "").replace(/\s+/gu, " ").trim();
      if (text.length === 0 || text.length > 28) continue;
      if (seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
    return out;
  });
  return lines.sort();
}

/**
 * Chụp trạng thái + danh sách mục Settings TRƯỚC khi cài plugin (đối chứng cho phần UI).
 * @param session phiên Chrome.
 * @param port cổng app.
 * @param cookie cookie phiên.
 * @returns trạng thái app và danh sách mục Settings nền.
 */
export async function captureBaselineSettings(
  session: ChromeSession,
  port: number,
  cookie: { name: string; value: string } | null,
): Promise<{ health: HealthReport; nav: string[]; bootEntries: number }> {
  const health = await assessUrlHealth(session.context, "http://127.0.0.1:" + String(port) + "/", { cookie, waitMs: 2500 });
  const page = await session.context.newPage();
  try {
    await page.goto("http://127.0.0.1:" + String(port) + "/", { waitUntil: "load", timeout: 30_000 });
    await page.waitForFunction(() => document.querySelectorAll("button").length >= 3, { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    const bootEntries: number = await page.evaluate(() => {
      const scope = globalThis as unknown as Record<string, unknown>;
      const wire = (scope.__GBH_BOOT__ ?? scope.__DSH_BOOT__ ?? null) as { entries?: unknown[] } | null;
      return (wire?.entries ?? []).length;
    });
    await openSettings(page);
    return { health, nav: await readSettingsNav(page), bootEntries };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Chụp bằng chứng phía trình duyệt: boot graph, bundle client, UI Settings, trạng thái app.
 * Chờ CÓ POLL cho trang Settings của plugin vì module client materialize muộn.
 * @param session phiên Chrome.
 * @param port cổng app.
 * @param cookie cookie phiên.
 * @param shotFile đường dẫn ảnh cần ghi.
 * @param baselineNav danh sách mục Settings ĐO TRƯỚC khi cài (đối chứng).
 * @param pollMs tổng thời gian chờ trang plugin hiện ra.
 * @returns bằng chứng client; health là null khi không mở được trang.
 */
export async function captureClientProof(
  session: ChromeSession,
  port: number,
  cookie: { name: string; value: string } | null,
  shotFile: string,
  baselineNav: readonly string[],
  pollMs = 24_000,
): Promise<ClientProof> {
  const url = "http://127.0.0.1:" + String(port) + "/";
  const page = await session.context.newPage();
  const bundleHits: { url: string; status: number; bytes: number }[] = [];
  let markerFound = false;
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    page.on("response", (response) => {
      const responseUrl = response.url();
      if (!responseUrl.includes("/plugins/")) return;
      void response
        .body()
        .then((body) => {
          bundleHits.push({ url: responseUrl.replace(/\?.*$/u, ""), status: response.status(), bytes: body.length });
          if (body.includes(EXTERNAL_PLUGIN.clientMarker)) markerFound = true;
        })
        .catch(() => undefined);
    });
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await page.waitForFunction(() => document.querySelectorAll("button").length >= 3, { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(4000);
    const boot = await page.evaluate(() => {
      const scope = globalThis as unknown as Record<string, unknown>;
      const wire = (scope.__GBH_BOOT__ ?? scope.__DSH_BOOT__ ?? null) as { entries?: { id: string }[] } | null;
      return (wire?.entries ?? []).map((row) => row.id);
    });
    const health = await assessUrlHealth(session.context, url, { cookie, waitMs: 1500 });
    await openSettings(page);
    const startedAt = Date.now();
    let pluginNav = await readSettingsNav(page);
    let navLabelSeen = false;
    let addedNavItems = pluginNav.filter((item) => !baselineNav.includes(item));
    let pageVisibleAfterMs: number | null = addedNavItems.length > 0 ? 0 : null;
    while (Date.now() - startedAt < pollMs && addedNavItems.length === 0 && !navLabelSeen) {
      await page.waitForTimeout(3000);
      pluginNav = await readSettingsNav(page);
      addedNavItems = pluginNav.filter((item) => !baselineNav.includes(item));
      const bodyText = await page.evaluate(() => document.body.innerText);
      navLabelSeen = EXTERNAL_PLUGIN.navLabels.some((label) => bodyText.includes(label));
      if (addedNavItems.length > 0 || navLabelSeen) pageVisibleAfterMs = Date.now() - startedAt;
    }
    await page.screenshot({ path: shotFile, type: "png" }).catch(() => undefined);
    await page.waitForTimeout(800);
    return {
      bootEntryCount: boot.length,
      pluginBootEntries: boot.filter((id) => id.includes(EXTERNAL_PLUGIN.name) || id.includes(EXTERNAL_PLUGIN.dumpRowId)),
      bundleHits,
      bundleMarkerFound: markerFound,
      baselineNav: [...baselineNav],
      pluginNav,
      addedNavItems,
      navLabelSeen,
      pageVisibleAfterMs,
      health,
      screenshot: shotFile,
    };
  } catch (error) {
    return {
      bootEntryCount: 0,
      pluginBootEntries: [],
      bundleHits,
      bundleMarkerFound: markerFound,
      baselineNav: [...baselineNav],
      pluginNav: [],
      addedNavItems: [],
      navLabelSeen: false,
      pageVisibleAfterMs: null,
      health: null,
      screenshot: null,
      ...{ error: error instanceof Error ? error.message : String(error) },
    } as unknown as ClientProof;
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Mô tả trạng thái app trong bằng chứng client.
 * @param health báo cáo trạng thái (có thể null).
 * @returns chuỗi tiếng Việt.
 */
export function describeClientHealth(health: HealthReport | null): string {
  return health === null ? "KHÔNG MỞ ĐƯỢC TRANG" : describeHealth(health);
}
