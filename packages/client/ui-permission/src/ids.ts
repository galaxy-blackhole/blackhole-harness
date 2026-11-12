/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang dinh danh cua row ui-permission: id MODULE (vao bang module), id SLOT OCCUPANT, namespace tu dien
 */

/**
 * Id MODULE chinh — package cua ta. Day la id bundle tu khai trong __ModuleLoader__.load,
 * nen no la dong ma manifest cua Host tro toi va la ownerId ma HMR tra rev.
 * Ten nay PHAI khop cot "gbh tuong ung" cua docs/PARITY-MATRIX.md (neu lech, parity bao THEM/DOI gia).
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-permission-presets";

/**
 * Id MODULE phu — package goc cua DSH. Bundle cua ta dang ky THEM id nay de moi bundle phu thuoc
 * require("@galaxy-blackhole/gbh-client-ui-permission-presets") van tim thay bang module.
 * Ban goc chi dang ky DUNG MOT id module, nen tong so id cua ta la hai.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-permission-presets";

/** Namespace tu dien cua hang cai dat (mac dinh phien moi) — giu nguyen chuoi cua ban goc. */
export const NS_SETTINGS = "settings.permission";

/** Namespace tu dien cua hai be mat phien hien tai (chip composer + popup /permission). */
export const NS_ACCESS = "permission.access";

/**
 * Id SLOT OCCUPANT cua hang trong slot settings.general.item — KHONG phai id module.
 * Ban goc dung "permission"; giu nguyen de hang cai dat doi chieu duoc.
 */
export const ROW_OCCUPANT_ID = "permission";

/** Thu tu cua hang trong slot settings.general.item; ban goc xep -20 (len dau nhom). */
export const ROW_ORDER = -20;

/** Ten hai slot ma row nay dang ky (ghi bang CHUOI o noi dang ky de check:rows doi chieu duoc). */
export const SLOT_SETTINGS_ITEM = "settings.general.item";

/** Slot chip muc quyen tren composer (thanh nhap cua hoi thoai). */
export const SLOT_CONVERSATION_PERMISSION = "conversation.input.permission";

/** Ten lenh ma popupSelect trang tri; ban goc dung "permission". */
export const COMMAND_NAME = "permission";

/** Id cua lenh khi can tat popup dang mo (ban goc: command.dismiss("permission")). */
export const COMMAND_DISMISS_ID = "permission";

/** Id gan vao data-plugin-css cua hai the style, giu nguyen chuoi cua ban goc. */
export const STYLE_TAGS = {
  /** CSS cua hang cai dat (PermissionRow.module.css). */
  row: STOCK_PACKAGE_NAME + "/PermissionRow.module.css",
  /** CSS cua chip quyen tren composer (PermissionSelect.module.css). */
  select: STOCK_PACKAGE_NAME + "/PermissionSelect.module.css",
} as const;

/** Nhan hieu ung vong doi — giu nguyen chuoi cua ban goc de log/chan doan doi chieu duoc. */
export const EFFECT = {
  /** Dang ky tu dien cua hai be mat phien hien tai. */
  accessDictionaries: "ui-permission: current-session dictionaries",
  /** Giai phong thu muc catalog khi fiber tat. */
  catalog: "ui-permission: process catalog directory",
  /** Dong popup dang mo khi catalog bi vo hieu. */
  dismiss: "ui-permission: dismiss stale slash choices",
  /** Dang ky tu dien cua hang cai dat. */
  settingsDictionaries: "ui-permission: settings row dictionaries",
  /** Giai phong bo dieu khien hang cai dat. */
  settingsController: "ui-permission: settings row directory",
  /** Trang tri lenh /permission bang popupSelect. */
  decoration: "ui-permission: /permission decoration",
} as const;

/** Khoa cua namespace cai dat tren duong day Host (ban goc: "permission"). */
export const PERMISSION_SETTINGS_NS = "permission";

/** Ten event Remote bao catalog doi (ban goc dang ky dung chuoi nay). */
export const CATALOG_CHANGED_EVENT = "permission-presets/catalog-changed";

/** Gia tri may cua preset "toan quyen" — can cong xac nhan rui ro truoc khi doi. */
export const FULL_ACCESS_PRESET = "danger-full-access";

/** Gia tri may cua preset "tu dong review" (thi nghiem) — chi co o phien hien tai. */
export const AUTO_REVIEW_PRESET = "auto";
