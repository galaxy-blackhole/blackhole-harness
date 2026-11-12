/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-workspace: mot id module, muoi ten slot/occupant nguyen van, bon the CSS
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra) — KHONG khai id cua goi goc: no thuoc gbh.row.aliases va tang nap
 * TU sinh entry alias tro ve cung URL bundle. Mot bundle MOT id.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-workspace";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio load() trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-workspace";

/** Namespace tu dien do row nay so huu — nguyen van ban goc. */
export const NS = "workspace";

/** Ten slot thanh ben phai chua cay workspace — nguyen van tu bundle goc. */
export const SLOT_WORKSPACES = "sidebar.workspaces";
/** Ten slot con (single) chua luong chon thu muc cua cay workspace — nguyen van ban goc. */
export const SLOT_WORKSPACES_DIRECTORY_FLOW = "sidebar.workspaces.directoryFlow";
/** Ten slot LIST chua cac muc menu "..." cua mot phien — nguyen van ban goc. */
export const SLOT_SESSION_MENU_ITEM = "sidebar.workspaces.session.menu.item";
/** Ten slot LIST chua cac nut hanh dong khi ro chuot tren mot phien — nguyen van ban goc. */
export const SLOT_SESSION_ROW_ACTION = "sidebar.workspaces.session.row.action";
/** Ten slot LIST o o dan dau (16px) cua mot dong phien — nguyen van ban goc. */
export const SLOT_SESSION_ROW_LEADING = "sidebar.session.row.leading";
/** Ten slot LIST trong the hover cua mot dong phien — nguyen van ban goc. */
export const SLOT_SESSION_ROW_HOVER = "sidebar.session.row.hover";
/** Ten slot lop phu toan khung (hop thoai + toast) — nguyen van ban goc. */
export const SLOT_SHELL_OVERLAY = "shell.overlay";
/** Ten slot KEYED chua cac muc toast cua row nay — nguyen van ban goc. */
export const SLOT_TOAST = "workspace.toast";
/** Ten slot FACTORY chua than cua mot muc toast — nguyen van ban goc. */
export const SLOT_TOAST_CONTENT = "workspace.toast.content";
/** Ten slot khung chon workspace o man trong — nguyen van ban goc. */
export const SLOT_HERO_WORKSPACE = "conversation.hero.workspace";
/** Ten slot con (single) chua luong chon thu muc cua khung chon — nguyen van ban goc. */
export const SLOT_HERO_WORKSPACE_DIRECTORY_FLOW = "conversation.hero.workspace.directoryFlow";

/** Id nguoi ngoi cua bon muc menu "..." nguyen van ban goc. */
export const MENU_ITEM_IDS = {
  /** Ghim/bo ghim phien. */
  pin: "pin",
  /** Doi ten phien. */
  rename: "rename",
  /** Tao nhanh (fork) tu phien. */
  fork: "fork",
  /** Luu tru phien. */
  archive: "archive",
  /** Sao chep Session ID. */
  sessionId: "session-id",
} as const;

/** Thu tu cua bon muc menu "..." — nguyen van ban goc (100/200/300/400/450). */
export const MENU_ITEM_ORDER = {
  /** Ghim. */
  pin: 100,
  /** Doi ten. */
  rename: 200,
  /** Fork. */
  fork: 300,
  /** Luu tru. */
  archive: 400,
  /** Session ID. */
  sessionId: 450,
} as const;

/** Id nguoi ngoi cua hai nut hanh dong tren dong phien — nguyen van ban goc. */
export const ROW_ACTION_IDS = {
  /** Nut luu tru. */
  archive: "archive",
  /** Nut ghim. */
  pin: "pin",
} as const;

/** Thu tu cua hai nut hanh dong tren dong phien — nguyen van ban goc (100/200). */
export const ROW_ACTION_ORDER = {
  /** Luu tru. */
  archive: 100,
  /** Ghim. */
  pin: 200,
} as const;

/** Id nguoi ngoi cua ba lop phu trong shell.overlay — nguyen van ban ban goc. */
export const OVERLAY_IDS = {
  /** Hop thoai doi ten phien. */
  rename: "workspace.session-rename",
  /** Hop thoai xac nhan dung va luu tru. */
  archive: "workspace.session-archive",
  /** The toast hanh dong tren dong. */
  rowToast: "workspace.row-toast",
} as const;

/** Khoa cua tung muc toast trong slot workspace.toast — nguyen van ban goc. */
export const TOAST_KEYS = [
  "sessionIdCopied",
  "sessionIdCopyFailed",
  "pinFailed",
  "unpinFailed",
  "archivedNotOpenable",
  "defaultWorkspaceFailed",
  "shortcutForkFailed",
  "createFailed",
  "forkRequiresOpen",
  "archived",
  "stoppedAndArchived",
] as const;

/**
 * Chin seam ma ban goc khai trong apply — NGUYEN VAN, khong bot mot muc nao.
 * Thu tu y nguyen ban goc (khai bao thu tu khong rang buoc apply: dsh.client.inject chi la metadata nap truoc).
 */
export const INJECT: readonly string[] = [
  "slots",
  "sessions",
  "workspaces",
  "locale",
  "remote",
  "remote.directoryPicker",
  "layout",
  "shortcuts",
  "remoteAccess",
];

/** Nhan hieu ung vong doi — nguyen van nhan cua ban goc (dung cho log chan doan). */
export const EFFECT = {
  /** Tu dien namespace workspace. */
  dictionaries: "ui-workspace: dictionaries",
} as const;

/** Id the style cho tung module CSS — build.ts nhung nguyen van bang define. */
export const STYLE_TAGS = {
  /** CSS cua Rows.module.css. */
  rows: STOCK_PACKAGE_NAME + "/Rows.module.css",
  /** CSS cua AnimatedRows.module.css (lop Qg_5Eq_exits). */
  animatedRows: STOCK_PACKAGE_NAME + "/AnimatedRows.module.css",
  /** CSS cua WorkspacePicker.module.css. */
  picker: STOCK_PACKAGE_NAME + "/WorkspacePicker.module.css",
  /** CSS cua WorkspaceBrowser.module.css. */
  browser: STOCK_PACKAGE_NAME + "/WorkspaceBrowser.module.css",
} as const;

/** Ten bien define ma build.ts dung de nhung bon module CSS vao bundle. */
export const CSS_DEFINES = {
  /** CSS Rows.module.css. */
  rows: "__GBH_UI_WORKSPACE_ROWS_CSS__",
  /** CSS AnimatedRows.module.css. */
  animatedRows: "__GBH_UI_WORKSPACE_ANIMATED_ROWS_CSS__",
  /** CSS WorkspacePicker.module.css. */
  picker: "__GBH_UI_WORKSPACE_PICKER_CSS__",
  /** CSS WorkspaceBrowser.module.css. */
  browser: "__GBH_UI_WORKSPACE_BROWSER_CSS__",
} as const;

/**
 * Ten workspace MA HOST tu dat cho workspace mac dinh — nguyen van ban goc.
 * ⚠️ 18/10/2026: ban goc doi chieu DUNG chuoi nay (`title === "default-workspace"`) de thay bang ten da dich.
 *   Ban port truoc doi chieu `title === ""` ⇒ workspace mac dinh hien thi slug tran "default-workspace"
 *   thay vi "Default workspace" (do C4.1: khac MOT truong trong cay DOM).
 */
export const DEFAULT_WORKSPACE_TITLE = "default-workspace";

/** Khoa luu thu tu phien thu cong cua danh sach phang — nguyen van ban goc. */
export const FLAT_SESSION_ORDER_KEY = "__flat_session_order__";

/** So dong toi thieu moi nhom phien hien truoc khi hien nut "xem them" — nguyen van ban goc. */
export const SESSION_WATERMARK_BASE = 5;
/** So dong toi da ma mot lan bam "xem them" mo them — nguyen van ban goc. */
export const SESSION_WATERMARK_AUTO_MAX = 50;

/** Do tre (ms) gom truy van tim kiem — nguyen van ban goc. */
export const SEARCH_DEBOUNCE_MS = 250;
/** So don vi ma toi da cua truy van tim kiem — nguyen van ban goc. */
export const SEARCH_QUERY_MAX_CODE_UNITS = 500;
/** Thoi luong (ms) cua hieu ung mo rong thanh ben — nguyen van ban goc. */
export const EXPAND_SLIDE_MS = 300;
/** Thoi luong (ms) cua hieu ung mo dan dong — nguyen van ban goc. */
export const ROW_FADE_MS = 100;
/** Thoi luong (ms) cua hieu ung truot dong — nguyen van ban goc. */
export const ROW_GLIDE_MS = 200;
/** Do tre (ms) mo the hover cua mot dong — nguyen van ban goc. */
export const HOVER_CARD_DELAY_MS = 800;
/** Do tre (ms) mo tooltip — nguyen van ban goc. */
export const TOOLTIP_DELAY_MS = 500;
