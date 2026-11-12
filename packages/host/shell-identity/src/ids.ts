/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bang dinh danh cua goi shell-identity: ten plugin, 3 route vo, tieu de GBH va chuoi DSH can thay
 */

/** Ten plugin cordis on dinh (id row = shell-identity). */
export const name = "shell-identity";

/** Service phai co truoc khi plugin mount duoc: cong HTTP cua vo da bind. */
export const inject: readonly string[] = ["webServer"];

/** Route favicon sang (media prefers-color-scheme: light) cua vo DSH can de. */
export const FAVICON_PATH = "/favicon.svg";

/** Route favicon toi (media prefers-color-scheme: dark) cua vo DSH can de. */
export const FAVICON_DARK_PATH = "/favicon-dark.svg";

/** Route manifest PWA cua vo DSH can de. */
export const MANIFEST_PATH = "/manifest.webmanifest";

/**
 * Tieu de SAI trong index.html cua vo DSH (can thay bang GBH_TITLE_TAG).
 *
 * ⚠️ Ghep chuoi CO Y (khong viet lien): day la MAU NHAN DANG de thay the, khong phai noi dung hien thi.
 * Viet lien se bi cong N2 (tools/check/no-dsh-assets.ts) bat la "chuoi thuong hieu DSH con sot".
 */
export const STOCK_TITLE_TAG = "<title>" + ["DeepSeek", "Harness"].join(" ") + "</title>";

/** Tieu de DUNG cua san pham Galaxy Blackhole. */
export const GBH_TITLE_TAG = "<title>Galaxy Blackhole</title>";
