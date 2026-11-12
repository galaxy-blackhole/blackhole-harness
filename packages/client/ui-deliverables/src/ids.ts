/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-deliverables: mot id module, ba ten slot, dia chi tai nguyen, the CSS
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra) — KHONG khai id cua goi goc: no thuoc gbh.row.aliases va tang nap
 * TU sinh entry alias tro ve cung URL bundle. Mot bundle MOT id.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-deliverables";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio load() trong bundle, va
 * KHONG bao gio viet thanh literal o vi tri `id: "…"` (nghiem thu dem so lan xuat hien cua chinh khuon do).
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-deliverables";

/** Tu dien namespace do row nay so huu — nguyen van ban goc. */
export const NS = "deliverables";

/**
 * Id cua row nay trong he thong tab thanh ben phai VA cung la id nguoi ngoi cua slot
 * conversation.chat.turnTail — NGUYEN VAN tu bundle goc (doi chuoi nay la mat kha nang khoi phuc
 * tab cua nguoi dung dang mo). Khong phai id module: no khong nam o vi tri id cua load({ id }).
 */
export const CHANGES_REVIEW_ID = STOCK_PACKAGE_NAME;

/** Loai (kind) cua tab so sanh trong sidebarRightTabs — nguyen van ban goc. */
export const CHANGES_REVIEW_KIND = "changes-review";

/** Tien to dia chi tai nguyen cua mot tab so sanh trong thanh ben phai — nguyen van ban goc. */
// 18/10/2026 (task-29, Wave D): PHÁT scheme mới gbh-resource://; nơi nhận/pattern chấp nhận cả scheme cũ.
export const CHANGES_REVIEW_ADDRESS = "gbh-resource://changes-review/session/";

/** Do dai tien to tren, dung khi cat chuoi dia chi (ban goc dung literal 38). */
export const CHANGES_REVIEW_ADDRESS_LENGTH = CHANGES_REVIEW_ADDRESS.length;

/** Ten slot chua the ban giao o duoi moi luot (the file da doi + the file ban giao). */
export const SLOT_TURN_TAIL = "conversation.chat.turnTail";

/** Ten slot chua hang cua mot lan goi tool (row nay chiem cho cua tool `present`). */
export const SLOT_TOOL_VIEW = "tool.call.toolview";

/** Ten slot than cua tab thanh ben phai. */
export const SLOT_SIDEBAR_PANE_TAB = "sidebar.right.pane.tab";

/** Khoa (key) cua nguoi ngoi trong slot tool.call.toolview — ban goc dung ten tool. */
export const PRESENT_TOOL_KEY = "present";

/** Khoa (key) cua nguoi ngoi trong slot sidebar.right.pane.tab — ban goc dung CHANGES_REVIEW_ID. */
export const REVIEW_TAB_KEY = CHANGES_REVIEW_ID;

/** Id danh sach con (children) cho hanh dong tren tung file da doi — nguyen van ban goc. */
export const CHILDREN_FILE_ACTIONS = "deliverables.file.actions";

/** Id danh sach con (children) cho hanh dong trong tab so sanh — nguyen van ban goc. */
export const CHILDREN_REVIEW_FILE_ACTIONS = "deliverables.review.file.actions";

/** Ten dich vu ma row nay cung cap cho cac row khac (mo neo file vao cau tra loi). */
export const SERVICE_FILE_MENTIONS = "chatFileMentions";

/** Seam ma ban goc khai — nguyen van, khong bot mot muc nao. */
export const INJECT: readonly string[] = [
  "slots",
  "locale",
  "uiConversation",
  "remote",
  "remote.session",
  "sidebarRightTabs",
  "sidebarRight",
  "configForms",
];

/** Nhan hieu ung vong doi — nguyen van nhan cua ban goc (dung cho log chan doan). */
export const EFFECT = {
  /** Don dep ba store khi plugin bi thao. */
  dispose: undefined,
  /** Tu dien namespace deliverables. */
  dictionaries: "ui-deliverables: dictionaries",
  /** Loai tab so sanh trong sidebarRightTabs. */
  reviewType: "ui-deliverables: changes-review type",
  /** Than tab so sanh trong slot sidebar.right.pane.tab. */
  reviewBody: "ui-deliverables: changes-review body",
} as const;

/** Id the style cho tung module CSS — build.ts nhung nguyen van bang define. */
export const STYLE_TAGS = {
  /** CSS cua PresentRow.module.css. */
  presentRow: STOCK_PACKAGE_NAME + "/PresentRow.module.css",
  /** CSS cua FileDiff.module.css. */
  fileDiff: STOCK_PACKAGE_NAME + "/FileDiff.module.css",
  /** CSS cua ChangedFiles.module.css. */
  changedFiles: STOCK_PACKAGE_NAME + "/ChangedFiles.module.css",
  /** CSS cua Deliverables.module.css. */
  deliverables: STOCK_PACKAGE_NAME + "/Deliverables.module.css",
  /** CSS cua ReviewTab.module.css. */
  reviewTab: STOCK_PACKAGE_NAME + "/ReviewTab.module.css",
} as const;
