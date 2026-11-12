/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-sidebar-right: mot id module, nam ten slot nguyen van, nhan hieu ung vong doi
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra) — KHONG khai id cua goi goc: no thuoc gbh.row.aliases va tang nap
 * TU sinh entry alias tro ve cung URL bundle. Mot bundle MOT id.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-sidebar-right";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio load() trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-sidebar-right";

/** Namespace tu dien do row nay so huu — nguyen van ban goc ("sidebarRight"). */
export const NS = "sidebarRight";

/**
 * Sau seam ma ban goc khai — NGUYEN VAN, khong bot mot muc nao.
 * Thu tu y nguyen ban goc (khai bao thu tu khong rang buoc apply: dsh.client.inject chi la metadata nap truoc).
 */
export const INJECT: readonly string[] = [
  "slots",
  "layout",
  "locale",
  "resources",
  "sessions",
  "uiSession",
  "shortcuts",
];

/** Ten slot goc cua thanh ben phai (khung thanh ben do ui-layout so huu) — nguyen van ban goc. */
export const SLOT_RIGHTBAR = "rightbar";
/** Ten slot con (single, pham vi phien) chua than mot phien cua thanh ben — nguyen van ban goc. */
export const SLOT_RIGHTBAR_SESSION = "rightbar.session";
/** Ten slot chua nut mo rong o goc phien — nguyen van ban goc. */
export const SLOT_HEADER_CORNER = "conversation.session.header.corner";
/** Ten slot KEYED chua than cua mot tab thanh ben phai — nguyen van ban goc. */
export const SLOT_PANE_TAB = "sidebar.right.pane.tab";
/** Ten slot KEYED chua tieu de cua mot tab thanh ben phai — nguyen van ban goc. */
export const SLOT_PANE_TAB_TITLE = "sidebar.right.pane.tab.title";
/** Ten slot LIST chua cac muc menu cua mot tab — nguyen van ban goc (khai la con cua rightbar.session). */
export const SLOT_TAB_MENU_ITEM = "sidebar.right.tab.menu.item";
/** Ten slot KEYED chua mot cua vao trong than tab huong dan — nguyen van ban goc. */
export const SLOT_GUIDE_ENTRY = "sidebar.right.tab.guide.entry";
/** Ten slot CHAIN thay the than tab huong dan — nguyen van ban goc. */
export const SLOT_GUIDE_CHAIN = "sidebar.right.tab.guide";

/**
 * Khoa cua tab huong dan trong hai slot KEYED — NGUYEN VAN ban goc.
 *
 * ⚠️ LUAT 7: "key" cua slot KEYED PHAI BANG "id" cua dinh nghia loai tab (guide-definition.ts dung
 * CUNG mot hang so nay cho ca hai cho). Lech mot ky tu ⇒ renderer roi vao fallback
 * (the <p data-sidebar-right-unavailable>) ⇒ tab hien "khong kha dung" MA KHONG CO LOI CONSOLE.
 * Gia tri nay cung la khoa trang thai tab da luu cua nguoi dung ⇒ khong duoc doi.
 * Nhan: khong co.
 * Tra: chuoi id/khoa cua tab huong dan.
 */
export const GUIDE_ID = "@deepseek-ai/dsh-client-ui-sidebar-right/guide";

/** Giao thuc tai nguyen ma row nay so huu — nguyen van ban goc. */
export const RESOURCE_SCHEME = "dsh-sidebar-right";

/** Nhan hieu ung vong doi — nguyen van nhan cua ban goc (dung cho log chan doan). */
export const EFFECT = {
  /** Giu khung nhin phien cho moi phien. */
  retainedViews: "ui-sidebar-right: retained Session views",
  /** Phien dang hien tren man hinh. */
  onScreenSession: "ui-sidebar-right: on-screen Session",
  /** Hai mat dich vu sidebarRightTabs + sidebarRight. */
  serviceFaces: "ui-sidebar-right: service faces",
  /** Tu dien namespace sidebarRight. */
  dictionaries: "ui-sidebar-right: dictionaries",
  /** Bon lenh ban phim cua thanh ben phai. */
  shortcuts: "ui-sidebar-right: shortcuts",
  /** Bo quan sat tieu diem. */
  focus: "ui-sidebar-right: focus",
  /** Cho ngoi, nut mo rong va loai tab huong dan. */
  seats: "ui-sidebar-right: seats and shipped tab type",
} as const;

/**
 * Id the style cho tung module CSS — giu NGUYEN duong dan module cua ban goc.
 * Giu nguyen de neu ca ban goc lan ban cua ta cung ton tai thi the style chi duoc chen MOT lan.
 */
export const STYLE_TAGS = {
  /** CSS cua tabs/guide/GuideBody.module.css. */
  guideBody: STOCK_PACKAGE_NAME + "/GuideBody.module.css",
  /** CSS cua shell/ExpandButton.module.css. */
  expandButton: STOCK_PACKAGE_NAME + "/ExpandButton.module.css",
  /** CSS cua shell/SidebarRight.module.css. */
  sidebarRight: STOCK_PACKAGE_NAME + "/SidebarRight.module.css",
} as const;
