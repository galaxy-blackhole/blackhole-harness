/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hang so dinh danh cua row ui-schedule: mot id module, nam ten slot nguyen van, chin the CSS
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra) — KHONG khai id cua goi goc: no thuoc gbh.row.aliases va tang nap
 * TU sinh entry alias tro ve cung URL bundle. Mot bundle MOT id.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-schedule";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio load() trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-schedule";

/**
 * Danh sach id module ma bundle TU KHAI — dung mot phan tu, chinh la ten package cua ta.
 * Nhan: khong co.
 * Tra: mang mot phan tu.
 */
export const MODULE_IDS: readonly string[] = [PACKAGE_NAME];

/**
 * Danh sach id cua goi goc duoc khai la alias trong gbh.row.aliases (tang nap sinh entry tro ve ta).
 * Nhan: khong co.
 * Tra: mang mot phan tu.
 */
export const PACKAGE_ALIASES: readonly string[] = [STOCK_PACKAGE_NAME];

/**
 * CHIN ten slot ma ban goc dang ky — NGUYEN VAN, dung thu tu xuat hien trong bundle goc.
 * Nhan: khong co.
 * Tra: mang ten slot.
 */
export const SLOT_NAMES: readonly string[] = [
  "shell.overlay",
  "sidebar.right.pane.tab",
  "sidebar.right.pane.tab.title",
  "main",
  "sidebar.panellist",
  "conversation.chat.turnTail",
  "conversation.session.header.utilities",
  "sidebar.session.row.leading",
  "sidebar.session.row.hover",
];

/**
 * Nam nhan hieu ung vong doi — nguyen van nhan cua ban goc (dung cho log chan doan).
 * Nhan: khong co.
 * Tra: doi tuong nhan hieu.
 */
export const EFFECT_LABELS = {
  /** Tu dien namespace schedule.manager. */
  managerDictionaries: "ui-schedule: dictionaries",
  /** Tu dien namespace manager. */
  dictionaries: "ui-schedule: manager dictionaries",
  /** Loai tab "task" cua thanh ben phai. */
  taskTabType: "ui-schedule: task tab type",
} as const;

/**
 * Id the style cho tung module CSS — build.ts nhung nguyen van bang bang thay the CSS_REPLACEMENTS.
 * Nhan: khong co.
 * Tra: doi tuong anh xa ten module sang id the (khop tagId trong ban goc).
 */
export const STYLE_MODULES: readonly string[] = [
  "ScheduleCatalogAction",
  "ScheduleCreateCard",
  "ScheduleTurnCard",
  "TaskManagerPage",
  "PickerPopover",
  "ClockPicker",
  "DatePicker",
  "TaskMenu",
  "SessionScheduleMark",
];

/**
 * Id loai tab cua thanh ben phai — id CUA TA (LUAT MOT-ID); duoi "/task" giu nguyen nhu ban goc.
 * Cung mot gia tri dung cho CA HAI: key cua slot sidebar.right.pane.tab(.title) va id cua dinh nghia
 * loai tab trong sidebarRightTabs. Lech mot trong hai ⇒ renderer roi vao fallback "khong kha dung" ma
 * KHONG co loi console.
 * Nhan: khong co.
 * Tra: chuoi id loai tab.
 */
export const SCHEDULE_TASK_ID = PACKAGE_NAME + "/task";

/**
 * Id nguoi ngoi cua tab "trang quan ly task" trong slot main (ban goc dung cho ca key cua slot main).
 * Nhan: khong co.
 * Tra: chuoi id.
 */
export const SCHEDULE_PAGE_ID = "schedules";
