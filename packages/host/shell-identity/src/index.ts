/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Lop vo L3: route de favicon/manifest DSH bang asset GBH + tapIndex doi <title> — KHONG cham bootstrap/module-loader
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { GBH_FAVICON_SHA256, GBH_FAVICON_SVG, GBH_MANIFEST_JSON } from "./assets.ts";

// Xuat lai asset de test HTTP doc bytes tu CUNG mot nguon voi route (khong chep tay).
export { GBH_FAVICON_SHA256, GBH_FAVICON_SVG, GBH_MANIFEST_JSON };
import { STOCK_TITLE_TAG, FAVICON_DARK_PATH, FAVICON_PATH, GBH_TITLE_TAG, MANIFEST_PATH, inject, name } from "./ids.ts";
import { injectDeepLink } from "./deep-link.ts";

// Nua host la diem vao duy nhat cua goi: xuat lai ca bang dinh danh de test/tang nap doc duoc tu mot cho.
export { STOCK_TITLE_TAG, FAVICON_DARK_PATH, FAVICON_PATH, GBH_TITLE_TAG, inject, MANIFEST_PATH, name };
// Deep-link phiên (?session=) cũng thuộc lớp vỏ: test đọc từ cùng một chỗ.
export { SELECTION_STORAGE_KEY, LEGACY_SELECTION_STORAGE_KEY, deepLinkScript, injectDeepLink } from "./deep-link.ts";

/** Mot route exact cua seam webServer (chi phan plugin nay dung). */
interface WebRouteLike {
  /** Kieu khop: lop vo chi dung route CHINH XAC. */
  kind: "exact";
  /** Pathname tuyet doi. */
  path: string;
  /** So huu toan bo vong doi response. */
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}

/** Be mat seam webServer ma plugin can (khai theo cau truc, khong import goi seam). */
export interface WebServerLike {
  /** Dang ky route dat ten; tra disposer. */
  register: (route: WebRouteLike) => () => void;
  /** Dang ky tap bien doi index tho; tra disposer. */
  tapIndex: (transform: (html: string) => string) => () => void;
}

/** Be mat context toi thieu ma plugin dung (khai theo cau truc). */
export interface ShellIdentityContext {
  /** Lay mot service theo ten. */
  get: (name: string) => unknown;
  /** Dang ky hieu ung vong doi. */
  effect: (run: () => () => void) => void;
  /** Logger cua cordis. */
  logger: { info: (message: string) => void; error: (message: string) => void };
}

/** Tieu de + body cua ba route vo. */
interface RouteAsset {
  /** Pathname. */
  path: string;
  /** Content-Type tra ve. */
  contentType: string;
  /** Body bytes (UTF-8). */
  body: string;
}

/** Ba route vo: favicon sang, favicon toi, manifest — cung mot bo asset GBH. */
export const SHELL_ROUTES: readonly RouteAsset[] = Object.freeze([
  { path: FAVICON_PATH, contentType: "image/svg+xml; charset=utf-8", body: GBH_FAVICON_SVG },
  { path: FAVICON_DARK_PATH, contentType: "image/svg+xml; charset=utf-8", body: GBH_FAVICON_SVG },
  { path: MANIFEST_PATH, contentType: "application/manifest+json; charset=utf-8", body: GBH_MANIFEST_JSON },
]);

/**
 * Tra loi mot route asset cua vo (200 + content-type + bytes; 405 voi method khac GET/HEAD).
 * Nhận: asset — route can tra; req/res — vong doi HTTP.
 * Trả: khong co (da ghi response).
 */
export function respondRoute(asset: RouteAsset, req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    res.end();
    return;
  }
  const bytes = Buffer.from(asset.body, "utf8");
  res.writeHead(200, {
    "content-type": asset.contentType,
    "content-length": String(bytes.length),
    // Favicon bi cache RAT lau: khong co header nay thi trinh duyet giu asset DSH => bao doan oan.
    "cache-control": "no-cache",
  });
  res.end(bytes);
}

/**
 * Tap index tho cua vo: CHI doi the <title> DSH -> GBH, khong cham bat ky markup nao khac.
 * Nhận: html — than index.html vo tra ve.
 * Trả: html da doi tieu de (idempotent: chay hai lan cho cung ket qua).
 */
export function tapIndexTitle(html: string): string {
  return html.split(STOCK_TITLE_TAG).join(GBH_TITLE_TAG);
}

/**
 * Diem vao cua Loader phia Host: de 3 route vo bang asset GBH + tap tieu de.
 * Nhận: ctx — context phia host (co webServer + logger).
 * Trả: khong co — dang ky roi tra quyen cho tang nap.
 */
export function apply(ctx: ShellIdentityContext): void {
  const webServer = ctx.get("webServer") as WebServerLike | undefined;
  if (webServer === undefined) {
    // Khong co cong HTTP => khong co lop vo de sua; bao ro roi thoat (khong nem: app van phai chay).
    ctx.logger.error("shell-identity: thieu seam webServer — bo qua lop vo");
    return;
  }
  const disposers = SHELL_ROUTES.map((asset) =>
    webServer.register({
      kind: "exact",
      path: asset.path,
      handler: (req, res) => respondRoute(asset, req, res),
    }),
  );
  disposers.push(webServer.tapIndex(tapIndexTitle));
  // 27/10/2026: deep-link ?session=<id> để VS Code mở đúng phiên trong GBH web.
  disposers.push(webServer.tapIndex(injectDeepLink));
  ctx.effect(() => () => {
    for (const dispose of disposers) dispose();
  });
  ctx.logger.info("shell-identity: da de 3 route vo (favicon x2 + manifest), tap <title> -> Galaxy Blackhole va deep-link ?session=");
}

/**
 * Cho biet bytes cua asset dang dung khop sha256 nguon (N4) — test goi truc tiep.
 * Nhận: khong.
 * Trả: true khi favicon dung sha256 GBH da ghi.
 */
export function faviconMatchesSource(): boolean {
  return sha256Hex(GBH_FAVICON_SVG) === GBH_FAVICON_SHA256;
}

/**
 * Tinh sha256 cua mot chuoi UTF-8.
 * Nhận: text — chuoi dau vao.
 * Trả: hex sha256.
 */
function sha256Hex(text: string): string {
  return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}
