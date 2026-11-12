/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Manifest ban bien dich ui-schedule: thu tu ghep cac phan + bang thay the CSS + bang doi id (do build.ts doc)
 */

import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "./ids.ts";

/**
 * Thu tu ghep cac phan cua ban bien dich, dung NGUYEN VAN thu tu region cua bundle goc.
 * ⚠️ MOI phan trong mang nay la NGUYEN VAN 100% ban goc — khong mot dong viet tay nao.
 * Cong chong cai hai lan + hai bang tieng Viet nam o HANDWRITTEN_PARTS (lat viet tay rieng).
 * Nhan: khong.
 * Tra: mang duong dan tuong doi so voi src/.
 */
export const PART_FILES: readonly string[] = [
  "parts/00-requires.ts",
  "parts/01-catalog-source.ts",
  "parts/02-DeleteToast.ts",
  "parts/03-definition.ts",
  "parts/04-partial-json.ts",
  "parts/05-values-index.ts",
  "parts/06-task-cron.ts",
  "parts/07-schedule-format.ts",
  "parts/08-css-ScheduleCatalogAction.ts",
  "parts/09-ScheduleCatalogAction.ts",
  "parts/10-schedule-create-card.ts",
  "parts/11-css-ScheduleCreateCard.ts",
  "parts/12-ScheduleCreateCard.ts",
  "parts/13-session-surface.ts",
  "parts/14-schedule-turn.ts",
  "parts/15-css-ScheduleTurnCard.ts",
  "parts/16-ScheduleTurnCard.ts",
  "parts/17-css-TaskManagerPage.ts",
  "parts/18-CatalogFeedback.ts",
  "parts/19-clsx.ts",
  "parts/20-CalendarIcon.ts",
  "parts/21-task-timing.ts",
  "parts/22-css-PickerPopover.ts",
  "parts/23-PickerPopover.ts",
  "parts/24-css-ClockPicker.ts",
  "parts/25-ClockPicker.ts",
  "parts/26-css-DatePicker.ts",
  "parts/27-DatePicker.ts",
  "parts/28-DeliveryHistory.ts",
  "parts/29-relative-clock.ts",
  "parts/30-session-link.ts",
  "parts/31-recent-time-zones.ts",
  "parts/32-css-TaskMenu.ts",
  "parts/33-TaskMenu.ts",
  "parts/34-TaskDetaila.ts",
  "parts/35-TaskDetailb.ts",
  "parts/36-TaskDetailc.ts",
  "parts/37-task-tab-target.ts",
  "parts/38-ScheduleTaskTab.ts",
  "parts/39-ScheduleTaskTabTitle.ts",
  "parts/40-session-schedule-state.ts",
  "parts/41-css-SessionScheduleMark.ts",
  "parts/42-SessionScheduleMark.ts",
  "parts/43-task-tab-bindings.ts",
  "parts/44-TaskManagerPage.ts",
  "parts/45-TaskManagerIcon.ts",
  "parts/46-frequency-locales.ts",
  "parts/47-locales.ts",
  "parts/48-task-manager-locales.ts",
  "parts/49-plugin.ts",
];

/**
 * Hai dong EXPORTS cuoi cua than bundle goc (sau //#endregion cuoi cung) — NGUYEN VAN.
 * Dat TRUOC khoi viet tay de khoi do boc duoc dung ham `apply` vua duoc gan vao exports.
 */
export const CLIENT_EXPORT_LINES: readonly string[] = [
  "\t\texports.apply = apply;",
  "\t\texports.inject = inject;",
];

/**
 * Cac lat VIET TAY cua goi — moi thu KHONG co trong bundle goc nam o day, va chi o day.
 * Thu tu ghep: PART_FILES (nguyen van) → CLIENT_EXPORT_LINES → HANDWRITTEN_PARTS → CLIENT_TAIL_LINES.
 * Test parity doi chung bo dung van ban cac lat nay theo VI TRI MANIFEST (khong do chuoi noi dung)
 * de khang dinh phan con lai la NGUYEN VAN ban goc.
 */
export const HANDWRITTEN_PARTS: readonly string[] = [
  "parts/plugin-surface.ts",
];

/**
 * Dong cuoi cung cua than bundle goc — NGUYEN VAN, dat SAU khoi viet tay.
 * Factory tra ve dung the module ma ban goc tra ve ({ apply, inject }).
 */
export const CLIENT_TAIL_LINES: readonly string[] = [
  "\t\treturn module.exports;",
];

/** Mot cho thay the CSS trong ban bien dich. */
export interface CssReplacement {
  /** Dinh danh xuat hien trong phan ma (build.ts thay bang chuoi CSS da ma hoa). */
  placeholder: string;
  /** Duong dan file .module.css tuong doi so voi src/ — nguon su that cua CSS. */
  file: string;
}

/**
 * Bang thay the CSS: moi dinh danh trong phan ma ung voi dung mot file .module.css.
 * Nhan: khong.
 * Tra: mang cac cap dinh danh ↔ file CSS, theo thu tu xuat hien.
 */
export const CSS_REPLACEMENTS: readonly CssReplacement[] = [
  { placeholder: "__GBH_UI_SCHEDULE_CSS_ScheduleCatalogAction__", file: "styles/ScheduleCatalogAction.module.css" },
  { placeholder: "__GBH_UI_SCHEDULE_CSS_ScheduleCreateCard__", file: "styles/ScheduleCreateCard.module.css" },
  { placeholder: "__GBH_UI_SCHEDULE_CSS_ScheduleTurnCard__", file: "styles/ScheduleTurnCard.module.css" },
  { placeholder: "__GBH_UI_SCHEDULE_CSS_TaskManagerPage__", file: "styles/TaskManagerPage.module.css" },
  { placeholder: "__GBH_UI_SCHEDULE_CSS_PickerPopover__", file: "styles/PickerPopover.module.css" },
  { placeholder: "__GBH_UI_SCHEDULE_CSS_ClockPicker__", file: "styles/ClockPicker.module.css" },
  { placeholder: "__GBH_UI_SCHEDULE_CSS_DatePicker__", file: "styles/DatePicker.module.css" },
  { placeholder: "__GBH_UI_SCHEDULE_CSS_TaskMenu__", file: "styles/TaskMenu.module.css" },
  { placeholder: "__GBH_UI_SCHEDULE_CSS_SessionScheduleMark__", file: "styles/SessionScheduleMark.module.css" },
];

/** Mot phep doi id package trong ban bien dich (build.ts chay TRUOC buoc thay CSS). */
export interface IdRewrite {
  /** Chuoi id cua goi GOC xuat hien trong cac phan NGUYEN VAN. */
  from: string;
  /** Chuoi id thay vao — id CUA TA. Duoi "/task", "/<Ten>.module.css" tu dong giu nguyen. */
  to: string;
  /** So diem XUAT HIEN dung theo ban goc: 1 hang SCHEDULE_TASK_ID + 9 tagId + 9 tag.dataset.plugin. */
  sites: number;
}

/**
 * Bang doi id: LUAT MOT-ID — trong lib/client.js khong duoc con mot chuoi id cua goi goc nao
 * (ke ca CSS tagId, dataset.plugin, hang tai lieu hay chunk). Cac phan trong PART_FILES van la
 * NGUYEN VAN ban goc; buoc doi id nay la khac biet DUY NHAT giua artifact va bundle goc.
 * Nhan: khong.
 * Tra: mang mot phan tu { from: id goi goc, to: id cua ta, sites: so diem }.
 */
export const ID_REWRITES: readonly IdRewrite[] = [
  { from: STOCK_PACKAGE_NAME, to: PACKAGE_NAME, sites: 19 },
];
