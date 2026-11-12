/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kieu CAU TRUC cua cac module ngoai ma nua client require tu bang module cua trang
 */
//
// Vì sao khai lại kiểu thay vì import: các module ngoài (@deepseek-ai/cordis ·
// @galaxy-blackhole/gbh-client-ui-slots · react) KHÔNG nằm trong workspace của ta — chúng do BẢNG MODULE
// của trang cấp lúc chạy (frontend bundle: `react` · `react/jsx-runtime` · `react-dom` ·
// `react-dom/client` · `@deepseek-ai/cordis` · `@galaxy-blackhole/gbh-client-ui-slots`).
// Import tĩnh sẽ khiến Bun nhúng bản sao thứ hai vào bundle ⇒ hai thể hiện React ⇒ hook nổ.
// ⚠️ KHÔNG dùng `declare module` (ambient) — luật 000d: khai báo ambient là TOÀN CỤC và đè kiểu thật.

/** Hàm `require` do bảng module của trang cấp cho factory (gọi lúc vạt chất hoá module). */
export type RequireFn = (specifier: string) => unknown;

/** Nguồn chỉ-đọc một giá trị (store engine · Session · store instance). */
export interface HostObservable<T> {
  /**
   * Đọc giá trị hiện tại.
   * Trả: giá trị.
   */
  getSnapshot(): T;
  /**
   * Theo dõi thay đổi.
   * Nhận: `listener` — hàm nghe.
   * Trả: hàm gỡ.
   */
  subscribe(listener: () => void): () => void;
}

/** Hook chọn giá trị từ một nguồn (có hàm so sánh tuỳ chọn). */
export type SnapshotSelectorHook<T> = <S = T>(
  selector?: (value: T) => S,
  equal?: (left: S, right: S) => boolean,
) => S;

/** Hook chọn giá trị từ một nguồn CÓ THỂ vắng. */
export type MaybeSnapshotSelectorHook<T> = <S = T | undefined>(
  selector?: (value: T | undefined) => S,
  equal?: (left: S, right: S) => boolean,
) => S;

/** Họ nguồn theo khoá (open-key). */
export interface KeyedStandardSource {
  /**
   * Phân giải nguồn cho một khoá (và tuỳ chọn một thành viên).
   * Nhận: `key` — khoá scope, `member` — tên thành viên (tuỳ chọn).
   * Trả: nguồn, hoặc undefined khi khoá không có.
   */
  (key: string, member?: string): HostObservable<unknown> | undefined;
}

/**
 * Một binding nguồn chuẩn: khoá scope + roster nguồn hook + props tĩnh.
 * Hình dạng ĐÚNG như SlotCore/store của bản gốc dựng (đọc từ registry.js:1317-1322 và
 * ui-session/src/ui-session.ts:522-548 của ta — hai bên khớp nhau).
 */
export interface StandardSourceBinding {
  /** Khoá scope đang áp dụng, hoặc vắng khi chưa chọn phiên. */
  readonly key?: string;
  /** Context sở hữu binding (dùng làm danh tính thế hệ phiên). */
  readonly ctx?: unknown;
  /** Nguồn theo tên hook. */
  readonly hooks: Readonly<Record<string, HostObservable<unknown> | undefined>>;
  /** Họ nguồn theo khoá. */
  readonly keyedHooks: Readonly<Record<string, KeyedStandardSource | undefined>>;
  /** Prop tĩnh đi thẳng vào component. */
  readonly props: Readonly<Record<string, unknown>>;
}

/** Bộ chuyển của MỘT scope đã cài (ui-session cấp qua installScope). */
export interface SlotScopeAdapter {
  /** Nguồn binding hiện tại của scope. */
  readonly current: HostObservable<StandardSourceBinding>;
  /** Nguồn binding phân giải theo tham số `session` của vùng (scope area). */
  bindingSource(session?: unknown): HostObservable<StandardSourceBinding>;
  /** Vẽ vùng của scope (bọc SessionProvider); vắng thì scope không có vùng. */
  renderArea?(binding: StandardSourceBinding, props: Record<string, unknown>): unknown;
}

/** Mỏ neo error boundary: thẻ bọc chỗ ngồi ĐÃ CHẾT. */
export type SlotAnchor = string;

/** Một mục đã đăng ký trong sổ (render-erased view của SlotCore). */
export interface StoredEntry {
  /** Component của mục. */
  readonly component: unknown;
  /** Tuỳ chọn đăng ký (kind/key/id/order/inject/children/locale/store/registrant…). */
  readonly options: Record<string, unknown>;
  /** Cây khai báo con (kind · scope · inline). */
  readonly children?: Readonly<Record<string, SlotChildSpec>>;
  /** Namespace từ điển của mục. */
  readonly locale?: string;
  /**
   * Face inject của mục — **TOP-LEVEL** (không nằm trong `options`).
   *
   * Đo từ bundle gốc (dòng 435–441): `function runInject(entry, binding, actions) { const inject = entry.inject; ... }`.
   * Đọc nhầm `entry.options.inject` ⇒ MỌI entry mất prop inject (usePanels/useNotices/useViews…) ⇒ 13 chỗ
   * ngồi ném "useX is not a function" ⇒ #root rơi từ 24.602 xuống 7.870 ký tự (đo lab 18/10/2026).
   */
  readonly inject?: (...args: unknown[]) => Record<string, unknown>;
  /** Handle store (nếu mục khai store). */
  readonly store?: StoreHandle;
  /** Bộ chọn của slot kiểu chain. */
  select?: (ownerProps: Record<string, unknown>) => unknown;
  /** Tên người đăng ký (chẩn đoán). */
  readonly registrant?: string;
}

/** Khai báo một ô con của mục cha. */
export interface SlotChildSpec {
  /** Kiểu ô: một chỗ · theo khoá · danh sách · chuỗi. */
  readonly kind: "single" | "keyed" | "list" | "chain";
  /** Phạm vi dữ liệu của ô. */
  readonly scope: "root" | "session" | "session-maybe";
  /** Ô nội tuyến (mỏ neo `span` thay vì `div`). */
  readonly inline?: boolean;
}

/** Spec của một slot đã khai. */
export interface SlotSpec {
  /** Kiểu ô. */
  readonly kind: "single" | "keyed" | "list" | "chain";
  /** Phạm vi dữ liệu. */
  readonly scope: "root" | "session" | "session-maybe";
  /** Ô nội tuyến. */
  readonly inline?: boolean;
  /** Face inject do bộ điều phối sở hữu. */
  readonly inject?: Record<string, unknown>;
}

/** Handle store của engine. */
export interface StoreHandle {
  /** Tạo instance (bản ghi cấp gốc không tham số; bản ghi theo phiên nhận khoá). */
  create(key?: string): StoreInstanceLike;
  /** Spec của store (persist là TUYỆT ĐỐI không được khai cho store độc quyền của Factory). */
  readonly spec: { readonly persist?: unknown };
}

/** Instance store mà engine cấp. */
export interface StoreInstanceLike extends HostObservable<unknown> {
  /** Action đã ràng buộc. */
  readonly actions: unknown;
}

/** Định nghĩa Factory đã đăng ký. */
export interface StoredFactory {
  /** Tên Factory. */
  readonly name: string;
  /** Phạm vi dữ liệu. */
  readonly scope: "root" | "session" | "session-maybe";
  /** Component của Factory. */
  readonly component: unknown;
  /** Ô cục bộ mà Factory khai. */
  readonly slots?: Readonly<Record<string, SlotChildSpec>>;
  /** Cây con khai báo. */
  readonly children?: Readonly<Record<string, SlotChildSpec>>;
  /** Namespace từ điển. */
  readonly locale?: string;
  /** Khai báo store: handle trực tiếp hoặc hàm mints handle theo occurrence. */
  readonly store?: StoreHandle | (() => StoreHandle);
  /** Face inject của Factory. */
  readonly inject?: (...args: unknown[]) => Record<string, unknown>;
}

/** Face host mà tầng renderer cài cho cây component (bản gốc: hostFace()). */
export interface SlotRendererHost {
  /** Theo dõi thay đổi đăng ký của một khoá. */
  subscribe(key: string, fn: () => void): () => void;
  /** Số phiên bản đăng ký của một khoá. */
  getVersion(key: string): number;
  /** Ảnh chụp sổ đăng ký của một khoá. */
  entriesOf(key: string): readonly StoredEntry[];
  /** Người thắng theo từng ô của một khoá. */
  entriesOfSlot(key: string): readonly StoredEntry[];
  /** Báo một chỗ ngồi chết (kèm ngữ cảnh rút lui). */
  reportEntryError(key: string, entry: StoredEntry, error: unknown, info: { abdicate: boolean }): void;
  /** Báo một occurrence Factory chết. */
  reportFactoryError(name: string, registration: unknown, error: unknown): void;
  /** Spec sống của một khoá. */
  specOf(key: string): SlotSpec | undefined;
  /** Mục còn sống hay không. */
  isLive(entry: StoredEntry): boolean;
  /** Store của một mục dưới một scope. */
  storeOf(entry: StoredEntry, scopeBinding: StandardSourceBinding | undefined): StoreInstanceLike | undefined;
  /** Store của một Factory dưới một scope. */
  factoryStoreOf(definition: StoredFactory, scopeBinding: StandardSourceBinding | undefined, occurrence: Record<string, unknown>): StoreInstanceLike | undefined;
  /** Giữ occurrence Factory sống tới khi hàm gỡ chạy. */
  retainFactoryOccurrence(definition: StoredFactory, occurrence: Record<string, unknown>): () => void;
  /** Theo dõi đăng ký của một Factory. */
  subscribeFactory(name: string, fn: () => void): () => void;
  /** Số phiên bản đăng ký của một Factory. */
  getFactoryVersion(name: string): number;
  /** Định nghĩa Factory hiện tại. */
  factoryOf(name: string): StoredFactory | undefined;
  /** Factory còn sống hay không. */
  isFactoryLive(definition: StoredFactory): boolean;
  /** Roster nguồn chuẩn GỐC. */
  readonly root: HostObservable<StandardSourceBinding>;
  /** Số phiên bản roster scope (đổi khi scope được cài/gỡ). */
  readonly scopeRevision: HostObservable<number>;
  /** Bộ chuyển của một scope, hoặc undefined khi chưa cài. */
  scope(scope: string): SlotScopeAdapter | undefined;
  /** Face từ điển đã cài (nếu có). */
  readonly locale: LocaleFace | undefined;
}

/** Face từ điển mà gói locale cài qua installLocale. */
export interface LocaleFace {
  /** Ảnh chụp: revision + ngôn ngữ hiện tại. */
  getSnapshot(): { readonly revision: number };
  /** Đăng ký người nghe đổi từ điển. */
  subscribe(listener: () => void): () => void;
  /** Buộc một namespace thành hàm dịch. */
  bind(ns: string): (key: string, params?: Record<string, unknown>) => string;
}

/** Renderer cài vào SlotRegistry (install(createSlotRenderer())). */
export interface SlotRenderer {
  /**
   * Vẽ cây gốc.
   * Nhận: `host` — face host, `ownerProps` — phần của chủ sở hữu ô 'root'.
   * Trả: cây React.
   */
  renderRoot(host: SlotRendererHost, ownerProps: Record<string, unknown>): unknown;
}

/** Lỗi của core khi một mục không được phép render slot con (bản gốc: SlotOwnershipError). */
export interface SlotOwnershipErrorCtor {
  /** Tạo lỗi với thông điệp. */
  new (message: string): Error;
}

/** Lỗi của core khi một mục đã bị gỡ vẫn còn giữ closure render (bản gốc: StaleAuthorizationError). */
export interface StaleAuthorizationErrorCtor {
  /** Tạo lỗi với thông điệp. */
  new (message: string): Error;
}

/** Core thuần của ui-slots: toàn bộ ngữ nghĩa đăng ký + sổ khai báo + cascade khi unload. */
export interface SlotCoreLike {
  /** Theo dõi mọi lần biến đổi sổ. */
  onMutate(fn: (key: string) => void): () => void;
  /** Spec SỐNG của một khoá. */
  specDynamic(key: string): SlotSpec | undefined;
  /** Số thế hệ khai báo của một khoá (đổi khi slot bị gỡ rồi khai lại). */
  declarationEpoch(key: string): number;
  /** Theo dõi thay đổi KHAI BÁO của một khoá. */
  subscribeDeclaration(key: string, fn: () => void): () => void;
  /** Sổ đăng ký của một khoá. */
  entries(key: string): readonly StoredEntry[];
  /** Người thắng theo từng ô. */
  entriesOfSlot(key: string): readonly StoredEntry[];
  /** Cây khai báo JSON-safe. */
  snapshot(root?: string): unknown[];
  /** Theo dõi lỗi của mục/Factory. */
  onEntryError(fn: (key: string, registration: unknown, error: unknown, info: { abdicated: boolean }) => void): () => void;
  /** Spec của một khoá. */
  spec(key: string): SlotSpec | undefined;
  /** Theo dõi thay đổi đăng ký của một khoá. */
  subscribe(key: string, fn: () => void): () => void;
  /** Số phiên bản đăng ký. */
  getVersion(key: string): number;
  /** Đăng ký một mục. */
  register(options: Record<string, unknown>, component: unknown): () => void;
  /** Đăng ký một Factory. */
  registerFactory(options: Record<string, unknown>, component: unknown): () => void;
  /** Định nghĩa Factory hiện tại. */
  factory(name: string): StoredFactory | undefined;
  /** Mục còn sống hay không. */
  isLive(entry: StoredEntry): boolean;
  /** Factory còn sống hay không. */
  isFactoryLive(definition: StoredFactory): boolean;
  /** Báo lỗi của một mục. */
  reportEntryError(key: string, entry: StoredEntry, error: unknown, info: { abdicate: boolean }): void;
  /** Báo lỗi của một occurrence Factory. */
  reportFactoryError(name: string, registration: unknown, error: unknown): void;
  /** Theo dõi đăng ký của một Factory. */
  subscribeFactory(name: string, fn: () => void): () => void;
  /** Số phiên bản đăng ký của một Factory. */
  factoryVersion(name: string): number;
}

/** Module `@galaxy-blackhole/gbh-client-ui-slots` — phần MÀ renderer dùng (đo từ bundle gốc). */
export interface SlotsApi {
  /** Core thuần của sổ slot. */
  SlotCore: new () => SlotCoreLike;
  /** Lỗi: mục render slot con không được khai. */
  SlotOwnershipError: SlotOwnershipErrorCtor;
  /** Lỗi: mục đã bị gỡ vẫn còn giữ closure render. */
  StaleAuthorizationError: StaleAuthorizationErrorCtor;
  /** Tên prop chuẩn của một hook (vd `panelInfo` → `usePanelInfo`). */
  standardHookPropName(name: string): string;
}

/** Sự kiện cordis mà SlotRegistry phát khi sổ biến đổi. */
export const SLOTS_CHANGED_EVENT = "slots/changed";