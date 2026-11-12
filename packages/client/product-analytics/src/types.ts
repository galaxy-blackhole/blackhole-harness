/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kieu du lieu cua row product-analytics: danh muc su kien, thuoc tinh duoc phep, cau hinh va hinh dang ban ghi gui len Host
 */

/**
 * Ten su kien san pham duoc phep — NGUYEN VAN 22 ten trong bang cham cua ban goc.
 * Doi chieu: @deepseek-ai/dsh-client-product-analytics/lib/typert.host.js (z.literal cua eventName).
 * Nhan: khong co.
 * Tra: mang ten su kien (thu tu nhu ban goc).
 */
export const PRODUCT_EVENT_NAMES: readonly string[] = [
  "desktop_app_launch",
  "auth_page_view",
  "auth_page_click",
  "api_key_save_click",
  "onboarding_page_view",
  "onboarding_page_click",
  "onboarding_popup_view",
  "onboarding_popup_click",
  "desktop_upgrade_click",
  "desktop_upgrade_download_result",
  "desktop_upgrade_install_restart_click",
  "send_button_click",
  "model_switch",
  "thinking_level_switch",
  "context_compression",
  "branch_session_click",
  "sidebar_menu_click",
  "plugin_toggle",
  "plugin_add_button_click",
  "plugin_install_click",
  "install_plugin_result",
  "confirm_uninstall_plugin",
];

/**
 * Ten thuoc tinh nghiep vu duoc phep gui kem (khong bao gio chua noi dung tin nhan hay credential).
 * Doi chieu: cung file typert.host.js o tren.
 * Nhan: khong co.
 * Tra: mang ten thuoc tinh (thu tu nhu ban goc).
 */
export const PRODUCT_ATTRIBUTE_KEYS: readonly string[] = [
  "button_name",
  "page_name",
  "selected_content",
  "popup_name",
  "is_success",
  "error_reason",
  "session_id",
  "model_name",
  "thinking_effort",
  "run_mode",
  "msg_type",
  "switch_from",
  "switch_to",
  "trigger_type",
  "parent_session_id",
  "parent_message_id",
  "click_position",
  "menu_name",
  "plugin_name",
  "plugin_type",
  "is_enabled",
  "is_builtin",
  "input_value",
  "duration",
];

/**
 * Ten mot su kien san pham. Giu kieu chuoi (khong phai union cua 22 literal) de nua client forward duoc
 * su kien cua row khac ma khong phai ep kieu; tap gia tri hop le nam o PRODUCT_EVENT_NAMES.
 */
export type ProductEventName = string;

/** Gia tri thuoc tinh di qua duoc duong JSON (chuoi · so huu han · boolean). */
export type ProductAttributeValue = string | number | boolean;

/**
 * Thuoc tinh nghiep vu cua mot su kien — chan doan lai o Host, khong chua noi dung tin nhan.
 * Cho phep undefined de giu dung hanh vi ban goc (truong thieu bi JSON bo qua khi len duong).
 */
export type ProductAttributes = Record<string, ProductAttributeValue | undefined>;

/** Mot su kien san pham: ten · thuoc tinh · thoi diem xay ra (ms). */
export interface ProductEvent {
  /** Ten su kien (xem PRODUCT_EVENT_NAMES). */
  eventName: ProductEventName;
  /** Thuoc tinh nghiep vu da duoc phep. */
  attributes: ProductAttributes;
  /** Thoi diem xay ra (epoch ms). */
  timestamp: number;
}

/** Danh tinh thiet bi ma Host doc tu service deepseekAccount (thieu truong nao thi bo truong do). */
export interface ProductDeviceIdentity {
  /** Id thiet bi do Host cap. */
  deviceId?: string;
  /** Id nguoi dung da dang nhap. */
  userId?: string;
  /** Phien ban he dieu hanh cua thiet bi. */
  osVersion?: string;
}

/**
 * Ban ghi ma Host day vao backend telemetry: su kien + body + thuoc tinh da hop nhat danh tinh.
 * Hinh dang nay giu nguyen tu ban goc: body = ten su kien, app_version lay tu config.
 */
export interface ProductTelemetryRecord extends ProductEvent {
  /** Truong body cua ban ghi telemetry (luon bang eventName). */
  body: ProductEventName;
}

/** Cau hinh cua row: co thu hay khong, va phien ban ung dung gan vao moi ban ghi. */
export interface ProductAnalyticsConfig {
  /** Cong tac thu su kien (mac dinh true nhu ban goc). */
  enabled?: boolean | { get(): boolean };
  /** Phien ban ung dung desktop, gan vao thuoc tinh app_version. */
  appVersion?: string;
}

/**
 * Doc cong tac enabled tu cau hinh cordis (co the la boolean tran hoac observable cua schemastery).
 * Nhan: config — cau hinh tho cua row (co the thieu).
 * Tra: true khi duoc thu, false khi bi tat; mac dinh true nhu ban goc.
 */
export function readEnabledFlag(config: ProductAnalyticsConfig | undefined): boolean {
  const value = config?.enabled;
  if (value === undefined) return true;
  if (typeof value === "boolean") return value;
  try {
    return value.get() === true;
  } catch {
    // Observable da bi huy (row bi go) — coi nhu TAT, khong nem trong duong nong.
    return false;
  }
}

/**
 * Doc phien ban ung dung tu cau hinh (rong hoac thieu ⇒ khong gan app_version).
 * Nhan: config — cau hinh tho cua row (co the thieu).
 * Tra: phien ban ung dung, hoac undefined.
 */
export function readAppVersion(config: ProductAnalyticsConfig | undefined): string | undefined {
  const value = config?.appVersion;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Hop nhat thuoc tinh nghiep vu voi danh tinh thiet bi va phien ban ung dung, theo dung thu tu ban goc
 * (device_id · user_id · app_version · os_version — truong thieu bi JSON bo qua khi len duong).
 * Nhan: event — su kien goc; identity — danh tinh doc duoc (co the undefined); appVersion — phien ban app.
 * Tra: thuoc tinh day du se di tren duong telemetry.
 */
export function mergeAttributes(
  event: ProductEvent,
  identity: ProductDeviceIdentity | undefined,
  appVersion: string | undefined,
): ProductAttributes {
  const merged: ProductAttributes = { ...event.attributes };
  if (identity !== undefined) {
    if (identity.deviceId !== undefined) merged.device_id = identity.deviceId;
    if (identity.userId !== undefined) merged.user_id = identity.userId;
    if (appVersion !== undefined) merged.app_version = appVersion;
    merged.os_version = identity.osVersion;
  } else if (appVersion !== undefined) {
    merged.app_version = appVersion;
  }
  return merged;
}