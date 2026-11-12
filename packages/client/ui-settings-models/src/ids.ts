/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hằng số định danh của row ui-settings-models: một id module, hai tên slot nguyên văn, khoá cấu hình onboarding
 */

/**
 * Tên package của ta — id DUY NHẤT mà bundle được phép đăng ký.
 * Bundle tự khai id này bằng §window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory })§ trong artifact
 * lib/client.js (do build.ts phát ra) — KHÔNG khai id của gói gốc: nó thuộc gbh.row.aliases và tầng nạp
 * TỰ sinh entry alias trỏ về cùng URL bundle. Một bundle MỘT id.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-settings-models";

/**
 * Tên package GỐC của DSH — CHỈ được khai ở gbh.row.aliases, KHÔNG bao giờ load() trong bundle.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-settings-models";

/** Namespace từ điển của trang Models — nguyên văn bản gốc. */
export const NS = "settings.models";

/** Tên slot của mục Models trong khung Settings — nguyên văn bản gốc. */
export const SLOT_SETTINGS_SECTION = "settings.section";

/** Tên slot của các bước chào mừng/onboarding — nguyên văn bản gốc. */
export const SLOT_SETTINGS_ONBOARDING = "settings.onboarding";

/** Id người ngồi của mục Models trong slot settings.section — bản gốc dùng "models". */
export const SECTION_ID = "models";

/** Thứ tự của mục Models trong danh sách mục Settings — bản gốc xếp 10. */
export const SECTION_ORDER = 10;

/** Id người ngồi của thông báo chào mừng — bản gốc dùng "welcome-notice". */
export const WELCOME_NOTICE_ID = "welcome-notice";

/** Thứ tự của thông báo chào mừng — bản gốc xếp -100 (đứng trước mọi bước khác). */
export const WELCOME_NOTICE_ORDER = -100;

/** Id người ngồi của bước nhập khoá DeepSeek chính thức — bản gốc dùng "deepseek-official". */
export const DEEPSEEK_ONBOARDING_ID = "deepseek-official";

/** Thứ tự của bước DeepSeek chính thức — bản gốc xếp 0. */
export const DEEPSEEK_ONBOARDING_ORDER = 0;

/** Khoá toàn cục mang tuỳ chọn onboarding công khai do nửa host phát vào trang. */
export const ONBOARDING_CONFIG_GLOBAL = "__GBH_MODELS_ONBOARDING__";

/** Dấu hiệu vỏ desktop (Electron/Tauri) — có mặt thì bỏ qua onboarding tự động và thông báo chào mừng. */
export const DESKTOP_SHELL_MARKER = "dshDesktop";

/** Các seam mà bản gốc khai — nguyên văn, không bớt một mục nào. */
export const INJECT: readonly string[] = [
  "slots",
  "locale",
  "remote",
  "remote.credentials",
  "remote.llm",
  "remote.settings",
  "remote.session",
  "configForms",
  "settingsSchema",
];

/** Nhãn hiệu ứng vòng đời — nguyên văn nhãn của bản gốc. */
export const EFFECTS = {
  /** Từ điển namespace settings.models. */
  dictionaries: "ui-settings-models: copy dictionaries",
  /** Các lần đẩy bất biến (settings · credentials · adapters · reset kết nối). */
  invalidations: "ui-settings-models: pushed invalidations",
} as const;

/** Id thẻ style cho từng module CSS — build.ts nhúng nguyên văn bằng define. */
export const STYLE_TAGS = {
  /** CSS của ModelsSection.module.css (dùng chung cho cả chín component trong trang). */
  section: STOCK_PACKAGE_NAME + "/ModelsSection.module.css",
  /** CSS của OnboardingModal.module.css. */
  onboarding: STOCK_PACKAGE_NAME + "/OnboardingModal.module.css",
  /** CSS của DeepSeekOnboardingDialog.module.css. */
  signIn: STOCK_PACKAGE_NAME + "/DeepSeekOnboardingDialog.module.css",
  /** CSS của WelcomeNotice.module.css. */
  welcome: STOCK_PACKAGE_NAME + "/WelcomeNotice.module.css",
} as const;
