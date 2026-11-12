/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-renderer: ten package - id goi goc - TEN HAI SERVICE - khoa slot goc - inject
 */

/** Tên package của ta — cũng là id module DUY NHẤT mà bundle tự khai (luật một-id). */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-renderer";

/**
 * Id module của GÓI GỐC — CHỈ khai ở gbh.row.aliases, KHÔNG load() trong bundle.
 *
 * Đo được 17/10/2026: đăng ký id gốc trong bundle thì bundle chạy HAI lần, sinh duplicate factory
 * registration, và app trắng. Tầng nạp tự sinh entry alias trỏ về cùng URL bundle (khi manifest có
 * metadata aliases-only).
 */
export const STOCK_MODULE_ID = "@deepseek-ai/dsh-client-ui-renderer";

/**
 * Tên service mà lớp SlotRegistry (kế thừa cordis Service) đăng ký.
 *
 * MODULE khác SERVICE: tên này KHÔNG phải một export của module; nó do LỚP sở hữu, và 28 entry khác
 * inject đúng cái tên này. Bản gốc cũng chỉ xuất hiện đúng một lần trong bundle.
 */
export const SERVICE_SLOTS = "slots";

/**
 * Tên service mà apply phơi qua ctx.reflect.provide("uiRenderer", { mount }) — vỏ Tauri chờ đúng tên này
 * rồi mới mount app (bundle frontend gọi `ctx.inject(["uiRenderer"], r => r.effect(() => r.uiRenderer.mount(t)))`).
 */
export const SERVICE_UI_RENDERER = "uiRenderer";

/** Khoá của slot GỐC — slot duy nhất được render ở cấp ctx; cả cây layout treo dưới nó. */
export const ROOT_SLOT = "root";

/**
 * Danh sách service mà THÂN plugin cần (bản gốc: `const inject = []` — dòng 1833 của bundle).
 *
 * Rỗng là ĐÚNG: renderer chỉ dùng bảng module của trang (react · cordis · ui-slots), không phụ thuộc
 * entry nào khác. 28 entry kia inject VÀO renderer, không phải ngược lại.
 */
export const INJECT: readonly string[] = [];

/** Nhãn hiệu ứng vòng đời — giữ NGUYÊN VĂN chuỗi của bản gốc (dùng để đọc getEffects()). */
export const EFFECT = {
  /** apply → cài renderer. */
  applyInstall: "slots.install()",
  /** apply → cài bảng từ điển. */
  installLocale: "slots.installLocale()",
  /** provideRoot của gói khác. */
  provideRoot: "slots.provideRoot()",
  /** installScope của gói khác. */
  installScopePrefix: "slots.installScope(",
  /** Nhãn register của gói khác. */
  register: "slots.register()",
  /** Nhãn registerFactory của gói khác. */
  registerFactory: "slots.registerFactory()",
  /** Nhãn inject của gói khác. */
  injectPrefix: "slots.inject(",
  /** Nhãn hậu tố của hiệu ứng chờ khai báo slot. */
  injectDeclarationSuffix: "): declaration",
  /** Nhãn hiệu ứng giữ phạm vi store (bản gốc: `slots: store scope <key>`). */
  storeScopePrefix: "slots: store scope ",
} as const;

/** Khoá instance của bản ghi store cấp GỐC (bản ghi theo phiên dùng id phiên nên không thể trùng). */
export const ROOT_INSTANCE_KEY = "root";

/** Thuộc tính CSS của mọi mỏ neo outlet — `display:contents` để vỏ không tham gia bố cục. */
export const ANCHOR_STYLE = { display: "contents" } as const;

/** Khoá thuộc tính DOM mà outlet đánh dấu trên mỏ neo (bản gốc: `data-slot`). */
export const DATA_SLOT = "data-slot";

/** Khoá thuộc tính DOM đánh dấu một chỗ ngồi ĐÃ CHẾT (bản gốc: `data-slot-error`). */
export const DATA_SLOT_ERROR = "data-slot-error";

/** Khoá thuộc tính DOM đánh dấu một occurrence Factory đã chết (bản gốc: `data-factory-error`). */
export const DATA_FACTORY_ERROR = "data-factory-error";

/** Khoá thuộc tính DOM đánh dấu fallback của chuỗi overlay (bản gốc: `data-chain-overlay-fallback`). */
export const DATA_CHAIN_OVERLAY_FALLBACK = "data-chain-overlay-fallback";

/** Khoá thuộc tính DOM mà kernel boot đánh dấu DOM chờ (bản gốc: `data-dsh-boot`). */
export const DATA_BOOT = "data-dsh-boot";

/** Nghĩa vụ khi cài lần hai (chỉ ghi cảnh báo, KHÔNG ném — bản gốc không có cổng này). */
export const DUPLICATE_INSTALL_WARNING = "gbh-client-ui-renderer: bundle đã được cài, bỏ qua lần thứ hai";
