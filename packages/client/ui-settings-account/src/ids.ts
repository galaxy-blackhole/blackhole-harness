/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-settings-account: mot id module, nam ten slot nguyen van, ba id nguoi ngoi, khoa toan cuc va the CSS
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra) — KHONG khai id cua goi goc: no thuoc gbh.row.aliases va tang nap
 * TU sinh entry alias tro ve cung URL bundle. Mot bundle MOT id.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-settings-account";

/**
 * Ten package GOC cua DSH o ban GOC — CHI duoc khai o gbh.row.aliases, KHONG bao gio load() trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-settings-account";

/** Namespace tu dien cua row — nguyen van ban goc. */
export const NS = "settings.account";

/** Namespace settings ben vung cua onboarding Desktop — nguyen van ban goc. */
export const DESKTOP_ONBOARDING_NAMESPACE = "ui-settings-account";

/** Phien ban client ma bundle goc nhung cung (DSh nhung DSH_CLIENT_VERSION luc bundle). */
export const CLIENT_VERSION = "0.2.1-alpha.4";

/** Ten slot lop phu toan khung — nguyen van tu bundle goc. */
export const SLOT_SHELL_OVERLAY = "shell.overlay";

/** Ten slot buoc dang nhap trong muc Models — nguyen van tu bundle goc. */
export const SLOT_MODELS_SIGN_IN = "settings.models.sign-in";

/** Ten slot thong bao het han muc toan khung — nguyen van tu bundle goc. */
export const SLOT_QUOTA_NOTICE = "shell.quota-notice";

/** Ten slot nut khoi dong trong Settings — nguyen van tu bundle goc. */
export const SLOT_SETTINGS_LAUNCHER = "settings.launcher";

/** Ten slot mot muc trong khung Settings — nguyen van tu bundle goc. */
export const SLOT_SETTINGS_SECTION = "settings.section";

/** Id nguoi ngoi cua buoc gioi thieu Desktop trong shell.overlay — nguyen van ban goc. */
export const ONBOARDING_OCCUPANT_ID = "desktop-onboarding";

/** Id nguoi ngoi cua khung trang Platform trong shell.overlay — nguyen van ban goc. */
export const PLATFORM_PAGE_OCCUPANT_ID = "account.platform-page";

/** Id nguoi ngoi cua muc "Tai khoan va so du" trong settings.section — nguyen van ban goc. */
export const ACCOUNT_SECTION_ID = "account";

/** Thu tu cua muc tai khoan trong khung Settings — ban goc xep -10 (dung dau). */
export const ACCOUNT_SECTION_ORDER = -10;

/** Khoa toan cuc chua tuy chon bang hoi khach hang khong kem thong tin xac thuc. */
export const CONTACT_CONFIG_GLOBAL = "__GBH_CONTACT_CONFIG__";

/** Khoa toan cuc ma vo Desktop tiem vao (co "dshDesktop" nghia la dang chay trong Desktop). */
export const DESKTOP_GLOBAL = "dshDesktop";

/** Khoa toan cuc cua cau noi trang Platform native. */
export const PLATFORM_GLOBAL = "dshPlatform";

/** Khoa toan cuc cua cau noi dang nhap Desktop. */
export const ONBOARDING_GLOBAL = "dshOnboarding";

/** Khoa toan cuc chua dia chi stream cua vo (Desktop dung de suy origin dang nhap). */
export const TRANSPORT_GLOBAL = "__GBH_TRANSPORT__";

/** Su kien Remote bao phien tai khoan het han — nguyen van ban goc. */
export const EVENT_SESSION_EXPIRED = "deepseek-account/session-expired";

/** Su kien Remote bao model can dang nhap lai — nguyen van ban goc. */
export const EVENT_MODEL_SIGN_IN_REQUIRED = "deepseek-account/model-sign-in-required";

/** Su kien kernel bao doi chieu credential — nguyen van ban goc. */
export const EVENT_CREDENTIAL_REFERENCE_UPDATED = "credentials/reference-updated";

/** Su kien kernel bao doi bo adapter LLM — nguyen van ban goc. */
export const EVENT_LLM_ADAPTERS_UPDATED = "llm/adapters-updated";

/** Su kien kernel bao doi giao dien — nguyen van ban goc. */
export const EVENT_THEME_CHANGE = "theme/change";

/** Nhan hieu ung vong doi — nguyen van nhan cua ban goc (dung cho log chan doan). */
export const EFFECT = {
  /** Tu dien namespace settings.account. */
  dictionaries: "account: dictionaries",
  /** Vong doi cua so trinh duyet dang cho. */
  browserWindow: "account: pending browser window",
  /** Vong doi anh dai dien. */
  avatar: "account: profile picture lifetime",
  /** Vong doi thong bao thuong. */
  bonusNotice: "account: bonus notice lifetime",
  /** Vong doi yeu cau chi tiet tai khoan. */
  details: "account: details request lifetime",
  /** Vong doi stream trang thai tai khoan. */
  stateStream: "account: state stream",
  /** Vong doi yeu cau trang Platform. */
  platformPage: "account: platform page request",
  /** Vong doi buoc gioi thieu Desktop. */
  desktopOnboarding: "account: desktop onboarding lifetime",
  /** Vong doi lan doc lai credential cua Desktop. */
  credentialReadiness: "account: desktop credential readiness",
} as const;

/** Id the style cho tung module CSS — build.ts nhung nguyen van bang define. */
export const STYLE_TAGS = {
  /** CSS cua SignInDialog.module.css. */
  signInDialog: STOCK_PACKAGE_NAME + "/SignInDialog.module.css",
  /** CSS cua PlatformOverlay.module.css. */
  platformOverlay: STOCK_PACKAGE_NAME + "/PlatformOverlay.module.css",
  /** CSS cua AccountAvatar.module.css. */
  accountAvatar: STOCK_PACKAGE_NAME + "/AccountAvatar.module.css",
  /** CSS cua AccountNotice.module.css. */
  accountNotice: STOCK_PACKAGE_NAME + "/AccountNotice.module.css",
  /** CSS cua AccountMenu.module.css. */
  accountMenu: STOCK_PACKAGE_NAME + "/AccountMenu.module.css",
  /** CSS cua AccountSection.module.css. */
  accountSection: STOCK_PACKAGE_NAME + "/AccountSection.module.css",
  /** CSS cua OnboardingSurface.module.css. */
  onboardingSurface: STOCK_PACKAGE_NAME + "/OnboardingSurface.module.css",
  /** CSS cua DesktopOnboarding.module.css. */
  desktopOnboarding: STOCK_PACKAGE_NAME + "/DesktopOnboarding.module.css",
} as const;

/** Seam ma ban goc khai — nguyen van, khong bot mot muc nao. */
export const INJECT: readonly string[] = ["slots", "locale", "remote", "remote.account", "remote.session", "theme", "configForms"];
