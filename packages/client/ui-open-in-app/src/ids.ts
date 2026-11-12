/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-open-in-app — mot id module, sau slot nguyen van
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra) — KHONG khai id cua goi goc: no thuoc gbh.row.aliases va tang nap
 * TU sinh entry alias tro ve cung URL bundle. Mot bundle MOT id.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-open-in-app";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio dang ky trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-open-in-app";

/**
 * Id NGUOI NGOI (occupant) ma ban goc dat cho CA SAU slot — nguyen van "open-in-app".
 * Nhan: khong co.
 * Tra: chuoi id nguoi ngoi.
 */
export const OCCUPANT_ID = "open-in-app";

/**
 * Thu tu chen cua nut o tieu de phien — nguyen van tu ban goc (order: -10).
 * Nhan: khong co.
 * Tra: so thu tu.
 */
export const HEADER_ORDER = -10;

/**
 * Duong dan (dang tuong doi trinh duyet) cua ba route nua host — nguyen van "/open-in-app/...".slice(1).
 * Nhan: khong co.
 * Tra: chuoi duong dan.
 */
export const ROUTE_APPS = "/open-in-app/apps".slice(1);

/** Duong dan tien to icon cua ung dung — nguyen van "/open-in-app/icon".slice(1). */
export const ROUTE_ICON_PREFIX = "/open-in-app/icon".slice(1);

/** Duong dan mo duong dan bang ung dung — nguyen van "/open-in-app/open".slice(1). */
export const ROUTE_OPEN = "/open-in-app/open".slice(1);

/**
 * Sau ten slot NGUYEN VAN ma ban goc dang ky — hang so chi dung cho inject va cho test khang dinh;
 * ten trong register({ name: "..." }) PHAI la literal (check:rows chi nhan dang duoc khuon do).
 * Nhan: khong co.
 * Tra: chuoi ten slot.
 */
export const SLOT_SESSION_HEADER_UTILITIES = "conversation.session.header.utilities";

/** Ten slot nut thao tac cua cay tep trong sidebar phai — nguyen van. */
export const SLOT_SIDEBAR_FILES_ACTIONS = "sidebar.right.tab.files.actions";

/** Ten slot thanh cong cu cua tab xem truoc tai lieu — nguyen van. */
export const SLOT_DOCUMENT_ACTIONS = "sidebar.right.tab.document.actions";

/** Ten slot trang thai rong cua tai lieu khong xem truoc duoc — nguyen van. */
export const SLOT_DOCUMENT_UNPREVIEWABLE = "sidebar.right.tab.document.unpreviewable";

/** Ten slot thao tac tep cua the ban giao — nguyen van. */
export const SLOT_DELIVERABLES_FILE_ACTIONS = "deliverables.file.actions";

/** Ten slot thao tac tep cua tab duyet thay doi — nguyen van. */
export const SLOT_DELIVERABLES_REVIEW_FILE_ACTIONS = "deliverables.review.file.actions";

/**
 * Hau to id cua the <style> — dung duong dan CSS-module cua ban goc de HMR go dung the.
 * Nhan: khong co.
 * Tra: chuoi hau to.
 */
export const STYLE_TAG_SUFFIX = "/OpenTargetButton.module.css";

/**
 * Id lenh ban phim mo workspace bang ung dung ngoai — nguyen van tu ban goc.
 * Nhan: khong co.
 * Tra: chuoi id lenh.
 */
export const SHORTCUT_ID = "workspace.openLocal";
