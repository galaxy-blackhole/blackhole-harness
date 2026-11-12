/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-sidebar-browser — mot id module, hai ten slot nguyen van
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-sidebar-browser";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio dang ky trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-sidebar-browser";

/**
 * Namespace tu dien do plugin nay so huu (khop LocaleNamespaceMap.sidebarBrowser cua ban goc).
 * Nhan: khong co.
 * Tra: chuoi namespace.
 */
export const LOCALE_NS = "sidebarBrowser";

/**
 * Kieu tab cua sidebar phai ma row nay dang ky — nguyen van tu bundle goc.
 * Nhan: khong co.
 * Tra: chuoi kieu tab.
 */
export const BROWSER_KIND = "browser";

/**
 * Id lenh mo tab trinh duyet moi — nguyen van tu bundle goc (phim tat va muc huong dan dung chung).
 * Nhan: khong co.
 * Tra: chuoi id lenh.
 */
export const SHORTCUT_ID = "browser.new";

/**
 * Id muc huong dan trong guide[] cua kieu tab — nguyen van tu bundle goc.
 * Nhan: khong co.
 * Tra: chuoi id muc huong dan.
 */
export const GUIDE_ENTRY_ID = "new";

/**
 * Duong dan module CSS ma the style tu khai — giu nguyen khuon cua ban goc de khong nhay hai lan.
 * Nhan: khong co.
 * Tra: chuoi id the CSS.
 */
export const CSS_TAG_ID = PACKAGE_NAME + "/Browser.module.css";

/**
 * Bon dich vu bat buoc ma hai cho ngoi cua trinh duyet can — nguyen van tu bundle goc.
 * Nhan: khong co.
 * Tra: mang ten dich vu.
 */
export const INJECT: readonly string[] = ["slots", "locale", "sidebarRight", "sidebarRightTabs"];
