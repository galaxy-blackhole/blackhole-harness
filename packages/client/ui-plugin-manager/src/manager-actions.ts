/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nửa "trạng thái + hành vi thuần" của vùng `manager-store` (bundle gốc client.js dòng 731-966 và 900-966):
 *      toàn bộ kiểu dữ liệu của mặt `PluginManagerFace`, các hằng số của hộp thoại cài đặt, và các hàm thuần
 *      (registry · thứ tự danh sách · trạng thái hộp thoại · câu lỗi) mà controller dùng.
 *
 * Vì sao tách: vùng gốc 1.181 dòng + 484 dòng khai kiểu vượt ngưỡng 1.000 dòng/tệp của repo. Phần LỚN NHẤT
 * nhưng không giữ trạng thái nằm ở đây; `manager-store.ts` giữ lớp `PluginManagerController` (nơi duy nhất
 * có trạng thái). Hành vi từng hàm giữ nguyên bản gốc, chỉ thay phụ thuộc phạm vi module bằng tham số.
 */

import { PLUGIN_DESCRIPTIONS, type PluginDescription } from "./plugin-descriptions.ts";
import type { PluginManagerModules } from "./runtime.ts";
import type { HostObservable, PluginTab } from "./tab-ledger.ts";
import type { ConfigLedger } from "./config-ledger.ts";
import { shortName } from "./presentation.ts";

/** Một registry để cài từ đó: URL http(s), hoặc null cho registry mà cấu hình pnpm tự khai. */
export type Registry = string | null;

/** Các registry mà trình quản lý hỏi: cái đầu đã cấu hình, các cái dự phòng theo thứ tự, và cái pnpm tự khai. */
export interface PluginRegistries {
  /** Registry hỏi trước; null nghĩa là dùng registry pnpm tự khai. */
  readonly registry: Registry;
  /** Các registry dự phòng, theo thứ tự Host sẽ thử. */
  readonly fallbackRegistries: readonly string[];
  /** URL mà cấu hình pnpm trong profile nêu; null khi Host chưa đọc được. */
  readonly resolved: string | null;
}

/** Vì sao một thay đổi phải chờ lần khởi động sau (5 lý do của Host). */
export type RestartReason = "no-hmr" | "package-moved" | "host-module" | "unmanaged-plugin" | "module-comparison";

/** Vì sao profile không thể sửa mục tiêu (2 lý do của Host). */
export type ReadOnlyReason = "management-required" | "unaddressable";

/** Mã lỗi quản trị của Host (13 mã — khớp từng khoá của `CODE_KEYS` trong presentation). */
export type ManagementErrorCode =
  | "management-required" | "unaddressable" | "unknown-plugin" | "invalid-spec" | "already-installed"
  | "ambiguous-install" | "not-bundle" | "not-removable" | "stop-profile" | "bundle-in-use"
  | "stale-approval" | "incompatible-version" | "operation-error";

/** Một gói mà các yêu cầu DSH của nó từ chối phiên bản DSH đang chạy (không có miễn trừ cho cặp đó). */
export interface IncompatiblePlugin {
  readonly name: string;
  readonly version: string;
  readonly runtimeVersion: string;
  /** Chỉ các yêu cầu mà phiên bản đang chạy KHÔNG thoả, khoá theo `engines.dsh` hoặc tên gói peer. */
  readonly requirements: Readonly<Record<string, string>>;
}

/** Lỗi quản trị của Host: mã, chẩn đoán tuỳ chọn, và các gói mà lỗi không tương thích nêu tên. */
export interface ManagementError {
  /** Mã lỗi của Host — 13 mã của {@link ManagementErrorCode} (giữ `string` để lưới an toàn không ném). */
  readonly code: string;
  /** Chẩn đoán của Host; `operation-error` hiển thị NGUYÊN VĂN chuỗi này. */
  readonly diagnostic?: string;
  /** Bí danh của `diagnostic` do bản port trước dùng — giữ để test cũ và trang cũ không vỡ. */
  readonly message?: string;
  /** Các gói bị từ chối khi mã là `incompatible-version`. */
  readonly incompatible?: readonly IncompatiblePlugin[];
  /** Đặt khi gói bị từ chối đang được CÀI (chọn câu khắc phục của nhánh cài, không phải nhánh đã cài). */
  readonly installing?: true;
}

/** Id một entry của Loader (bản gốc là kiểu có thương hiệu; ở đây là chuỗi, đúng giá trị wire). */
export type PluginEntryId = string;

/** Pha của fiber một entry (nguồn: `dsh-host-plugin-inventory`). */
export type PluginFiberPhase = "pending" | "loading" | "active" | "failed" | "unloading" | null;

/** Chữ hiển thị của gói: chuỗi, hoặc object đa ngôn ngữ (khoá `en` bắt buộc). */
export type LocalizedText = string | { readonly en: string; readonly [locale: string]: string };

/** Chữ hiển thị + chẩn đoán metadata mà Host cấp cho một gói/row. */
export interface PluginLocalizedMeta {
  readonly title?: LocalizedText;
  readonly description?: LocalizedText;
  readonly icon?: string;
  readonly error?: string;
}

/** Một entry đang chạy của profile và khả năng điều khiển bền vững của nó. */
export interface PluginInfo {
  readonly entryId: PluginEntryId;
  readonly moduleName: string;
  readonly meta?: PluginLocalizedMeta;
  readonly enabled: boolean;
  readonly fiberPhase: PluginFiberPhase;
  readonly readOnlyReason?: ReadOnlyReason;
}

/** Một row mà patch của bundle khai, kèm entry đang chạy khi bundle đóng góp row đó. */
export interface BundleRowInfo {
  readonly rowId: string;
  readonly moduleName: string;
  readonly meta?: PluginLocalizedMeta;
  readonly entryId?: PluginEntryId;
}

/** Một bundle mà Host biết: gói đi kèm bản cài, gói đã cài trong profile, hoặc mục danh mục tải khi cần. */
export interface BundleInfo {
  readonly name: string;
  readonly official: boolean;
  readonly availability: "installation" | "profile" | "missing";
  /** Phiên bản chính xác Host mời cài/cập nhật (mục danh mục tải khi cần). */
  readonly installTarget?: { readonly spec: string; readonly version: string };
  readonly version?: string;
  readonly meta?: PluginLocalizedMeta;
  readonly description?: string;
  readonly enabled: boolean;
  readonly installed: boolean;
  /** Với phụ thuộc của profile mà bản cài không cấp: spec mà `pnpm add` nhận. */
  readonly source?: string;
  /** Gói đi kèm bản cài để người dùng tự bật: chính thức, tắt tới khi được chọn, không bao giờ gỡ được. */
  readonly optional: boolean;
  readonly removable: boolean;
  readonly readOnlyReason?: ReadOnlyReason;
  readonly error?: ManagementError;
  readonly rows: readonly BundleRowInfo[];
}

/** Hình thức một spec cài đặt, theo từ vựng của pnpm. */
export type InstallSpecKind = "registry" | "path" | "git" | "tarball";

/** Vì sao một spec bị từ chối TRƯỚC khi cài bất cứ thứ gì. */
export type PluginInspectProblem = "invalid-spec" | "already-installed" | "not-found" | "not-a-package" | "not-a-bundle" | "network" | "unknown";

/** Spec đã được Host đọc: hoặc nhận (kèm những gì nó nêu tên), hoặc từ chối (kèm lý do). */
export type PluginSpecInspection =
  | {
    readonly status: "accepted";
    /** Hình thức của spec. */
    readonly kind: InstallSpecKind;
    /** Tên gói, khi biết. */
    readonly name?: string;
    /** Phiên bản, khi biết. */
    readonly version?: string;
    /** Mô tả của manifest. */
    readonly description?: string;
    /** Gói có khai patch bundle không; null khi hình thức spec không nói được. */
    readonly bundle: boolean | null;
    /** Registry đã trả lời (với tên gói), hoặc registry mà lần cài sẽ hỏi trước. */
    readonly registry: Registry;
    /** Host mà spec git/tarball được tải từ đó (không registry nào thay thế được). */
    readonly host?: string;
  }
  | {
    readonly status: "refused";
    /** Vấn đề khiến spec bị từ chối. */
    readonly problem: PluginInspectProblem;
    /** Điều pnpm/registry/hệ tệp đã nói. */
    readonly reason: string;
    /** Các registry đã hỏi, theo thứ tự, khi lời từ chối đến từ việc hỏi chúng. */
    readonly registries?: readonly Registry[];
  };

/** Cách một thao tác gói thất bại, đọc từ cách nó kết thúc và những gì nó in ra. */
export type PluginInstallFailureKind =
  | "pnpm-missing" | "timeout" | "not-found" | "no-matching-version" | "network"
  | "disk-full" | "permission" | "build-blocked" | "integrity" | "unknown";

/** Kết cục một lượt chạy pnpm của gói (kèm chẩn đoán đầy đủ qua đường dẫn log). */
export interface PackageResult {
  readonly exitCode: number;
  readonly output: string;
  readonly truncated: boolean;
  readonly logPath: string;
  /** Khi lượt chạy thất bại: loại thất bại mà mã thoát + đầu ra mô tả. */
  readonly kind?: PluginInstallFailureKind;
  readonly timedOut?: boolean;
  /** Khi bước kiểm tương thích từ chối lượt chạy: các gói bị từ chối. */
  readonly incompatible?: readonly IncompatiblePlugin[];
}

/** Một thay đổi đã ghi xuống, kèm kết cục áp dụng mà Host quan sát được. */
export interface ChangeResult {
  readonly changed: boolean;
  /** `cancelled`: lần cài do người gọi dừng, tệp đã được khôi phục. */
  readonly application: "applied" | "restart-required" | "overridden" | "failed" | "cancelled";
  /** Với `restart-required`: vì sao thay đổi chỉ có hiệu lực ở lần khởi động sau. */
  readonly restartReason?: RestartReason;
  readonly stage: "install" | "enable" | "remove";
  readonly target: string;
  readonly enabled?: boolean;
  readonly error?: ManagementError;
  /** Các entry không hoạt động có sẵn mà thao tác để nguyên. */
  readonly warnings?: readonly string[];
  readonly packageResult?: PackageResult;
  readonly bundle?: string;
  readonly version?: string;
  readonly pendingBuilds?: readonly string[];
  readonly approvedBuilds?: readonly string[];
  readonly registries?: readonly Registry[];
  /** Vì sao lượt chạy thất bại không chạm được registry hay host của spec. */
  readonly failedAt?: "registry" | "spec-host";
}

/** Id một lần cài, từ lúc bắt đầu tới lúc kết thúc (kể cả log và yêu cầu huỷ). */
export type PluginInstallRequestId = string;

/** Tuỳ chọn một lời gọi cài bundle. */
export interface InstallBundleOptions {
  enabled?: boolean;
  saveExact?: boolean;
  requestId?: PluginInstallRequestId;
  approvedBuilds?: readonly string[];
  /** Registry hỏi trước; thiếu thì dùng cái đã cấu hình. */
  registry?: Registry;
}

/** Nơi một lần kiểm spec hỏi. */
export interface InspectOptions {
  /** Registry hỏi trước; thiếu thì dùng cái đã cấu hình. */
  readonly registry?: Registry;
}

/** Pha của Host trong một lần cài, trước khi lời gọi cài kết thúc. */
export interface PluginInstallProgress {
  readonly requestId: PluginInstallRequestId;
  readonly phase: "installing" | "cancelling" | "applying";
  /** Với `installing`: registry của lần thử này, vị trí một-based, và tổng số registry có thể hỏi. */
  readonly attempt?: { readonly registry: Registry; readonly index: number; readonly total: number };
}

/** Kết cục một yêu cầu huỷ (chỉ `cancelled` là đã chắc chắn dừng). */
export interface PluginInstallCancellation {
  readonly status: "cancelled" | "too-late" | "not-running";
}

/** Một mẩu đầu ra của một lượt chạy pnpm, đúng như lượt chạy sinh ra. */
export interface PluginInstallLogChunk {
  /** Lần cài mà lượt chạy thuộc về, khi người gọi có cấp request id. */
  readonly requestId?: PluginInstallRequestId;
  /** Lượt chạy mà mẩu này thuộc về. */
  readonly jobId: string;
  /** Dòng lệnh của lượt chạy: tên lệnh pnpm rồi các tham số. */
  readonly argv: readonly string[];
  /** Thư mục lượt chạy chạy trong đó: thư mục profile. */
  readonly cwd: string;
  readonly stream: "stdout" | "stderr";
  readonly text: string;
  /** Có ở mẩu CUỐI: mã thoát của pnpm, null khi kết thúc không có mã. */
  readonly exitCode?: number | null;
}

/** Ảnh chụp kho plugin của Host. */
export interface PluginInventorySnapshot {
  readonly managementAvailable?: boolean;
  readonly entries?: readonly PluginInfo[];
}

/** Lỗi một lời gọi Remote: mã của Host và câu của nó. */
export interface RemoteFailure {
  readonly code: string;
  readonly message: string;
}

/** Kết quả một lời gọi Remote: hoặc giá trị, hoặc lỗi (nguyên hình `RemoteResult` của typert). */
export type RemoteResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteFailure };

/** Namespace `remote.pluginManager` — chỉ những phương thức màn Plugins gọi. */
export interface PluginManagerRemote {
  listBundles(): Promise<RemoteResult<BundleInfo[]>>;
  listPlugins(): Promise<RemoteResult<PluginInfo[]>>;
  registries(): Promise<RemoteResult<PluginRegistries>>;
  /** Đọc xem một spec nêu tên gì, trước khi cài. */
  inspect(spec: string, options?: InspectOptions, signal?: AbortSignal): Promise<RemoteResult<PluginSpecInspection>>;
  /** Cài một bundle và trả kết cục áp dụng. */
  installBundle(spec: string, options?: InstallBundleOptions): Promise<RemoteResult<ChangeResult>>;
  /** Hỏi lại kết quả của một lần cài mà trả lời gốc đã mất; null khi Host không còn request đó. */
  waitForInstall(requestId: PluginInstallRequestId): Promise<RemoteResult<ChangeResult | null>>;
  cancelInstall(requestId: PluginInstallRequestId): Promise<RemoteResult<PluginInstallCancellation>>;
  /** Bật/tắt một bundle trong danh sách lớp của profile. */
  setBundleEnabled(packageName: string, enabled: boolean): Promise<RemoteResult<ChangeResult>>;
  /** Bật/tắt một entry trong lớp người dùng của profile. */
  setPluginEnabled(entryId: PluginEntryId, enabled: boolean): Promise<RemoteResult<ChangeResult>>;
  /** Gỡ một gói khỏi profile. */
  removeBundle(packageName: string): Promise<RemoteResult<ChangeResult>>;
}

/** Namespace `remote.pluginInventory` (chỉ lời gọi mà tab này dùng). */
export interface PluginInventoryRemote {
  /** Đọc ảnh chụp kho plugin (cho biết Host có quản lý profile không). */
  list(): Promise<RemoteResult<PluginInventorySnapshot>>;
}

/** Namespace `remote.pluginRegistryProbe` (đua ping để chọn registry nhanh hơn). */
export interface PluginRegistryProbeRemote {
  /** Trả registry nhanh nhất, hoặc null khi cả hai đều hỏng. */
  fastest(): Promise<RemoteResult<Registry>>;
}

/** Sự kiện phân tích sản phẩm (`ctx.get("productAnalytics")`) — chỉ phần tab này gọi. */
export interface ProductAnalyticsSeam {
  readonly enabled?: boolean;
  track(event: string, properties: Record<string, unknown>): void;
}

/** Ảnh chụp gương cài đặt mà `configForms.describe()` phục vụ (phần tab này đọc). */
export interface SettingsMirrorSnapshot {
  readonly status: "idle" | "loading" | "ready";
  readonly view: unknown;
  readonly error: string | null;
}

/** Mặt cài đặt dùng chéo namespace (`SettingsDescribeFace` của ui-settings, phần tab này dùng). */
export interface SettingsDescribeFace {
  getSnapshot(): SettingsMirrorSnapshot;
  subscribe(listener: () => void): () => void;
  ensure(): Promise<void>;
  acceptView(view: unknown): void;
}

/** Service `configForms` của khung cài đặt (phần tab này dùng). */
export interface ConfigFormsSeam {
  describe(): SettingsDescribeFace;
  get(entryId: string): unknown;
}

/** Seam ctx mà controller cần (đúng các service bản gốc dùng, phần còn lại truyền qua tham số). */
export interface PluginManagerContext {
  readonly remote: {
    /** Trình quản lý plugin của Host. */
    readonly pluginManager: PluginManagerRemote;
    /** Kho plugin của Host. */
    readonly pluginInventory: PluginInventoryRemote;
    /** Đầu dò registry của Host. */
    readonly pluginRegistryProbe: PluginRegistryProbeRemote;
  };
  readonly configForms: ConfigFormsSeam;
  /** Lấy một service tuỳ chọn của khung (chỉ `productAnalytics`). */
  get(service: "productAnalytics"): ProductAnalyticsSeam | undefined;
}

/** Sổ ảnh chụp: đọc đồng bộ + nghe thay đổi + ghi ảnh chụp mới. */
export interface SnapshotStore<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
  set(next: T): void;
}

/** Hàm tạo sổ ảnh chụp của engine (`createSnapshotStore`), kèm tuỳ chọn bền qua lần tải trang. */
export interface CreateSnapshotStore {
  <T>(initial: T, options?: { readonly persist?: { readonly name: string } }): SnapshotStore<T>;
}

/** Phần bảng module mà sổ này dùng: hàm tạo snapshot store của engine. */
interface StoreModuleSeam {
  readonly createSnapshotStore?: CreateSnapshotStore;
}

/** Việc đang làm khi một toast thất bại nêu tên (5 việc). */
export type FailedAction = "enable" | "disable" | "uninstall" | "rowEnable" | "rowDisable";

/** Điều thao tác vừa rồi còn phải nói, hiển thị như toast; `seq` phân biệt lần hiện này với lần sau. */
export type ManagerNotice =
  | { readonly kind: "restart"; readonly packageName: string; readonly reason: RestartReason | undefined; readonly seq: number }
  | { readonly kind: "overridden"; readonly packageName: string; readonly seq: number }
  | { readonly kind: "cancelled"; readonly seq: number }
  | { readonly kind: "refresh-failed"; readonly seq: number }
  | { readonly kind: "install"; readonly outcome: "done" | "failed" | "unconfirmed" | "applying" | "unknown"; readonly seq: number }
  | {
    readonly kind: "failed";
    /** Việc đang làm khi thất bại. */
    readonly action: FailedAction;
    /** Lời từ chối của Host, khi Host từ chối; vắng khi hỏng đường truyền. */
    readonly code?: string;
    /** Chẩn đoán của Host hoặc câu của đường truyền, hiển thị NGUYÊN VĂN; rỗng khi mã đã nói đủ. */
    readonly reason: string;
    /** Các gói mà lời từ chối `incompatible-version` nêu tên. */
    readonly incompatible?: readonly IncompatiblePlugin[];
    /** Tên gói liên quan, khi có. */
    readonly packageName?: string;
    /** Số thứ tự lần hiện. */
    readonly seq: number;
  };

/** Một row mà một bundle đóng góp, như trang liệt kê: khai báo của patch ghép với entry đang chạy. */
export interface PackageRow {
  readonly entryId?: PluginEntryId;
  /** Id row như bundle khai. */
  readonly rowId: string;
  readonly moduleName: string;
  /** Chữ hiển thị + chẩn đoán metadata do Host cấp. */
  readonly meta?: PluginLocalizedMeta;
  /** Entry có chạy không; false với row không có entry đang chạy. */
  readonly enabled: boolean;
  readonly phase: PluginFiberPhase;
  readonly readOnlyReason?: ReadOnlyReason;
}

/** Một bundle như trang hiển thị: bundle của Host ghép với các entry mà row của nó chạy thành. */
export interface PackageView {
  readonly name: string;
  readonly official: boolean;
  /** Nơi đọc được gói. */
  readonly availability: BundleInfo["availability"];
  readonly installTarget?: NonNullable<BundleInfo["installTarget"]>;
  /** Phiên bản hiện có. */
  readonly version?: string;
  /** Mô tả chưa dịch. */
  readonly description?: string;
  readonly meta?: PluginLocalizedMeta;
  readonly installed: boolean;
  /** Với phụ thuộc của profile mà bản cài không cấp: spec mà `pnpm add` nhận. */
  readonly source?: string;
  readonly optional: boolean;
  readonly removable: boolean;
  readonly enabled: boolean;
  readonly readOnlyReason?: ReadOnlyReason;
  readonly error?: ManagementError;
  readonly rows: readonly PackageRow[];
}

/** Spec đã đọc, đúng như Host đọc, trên các màn đang cài/đã cài/thất bại. */
export type InstallSubject = Extract<PluginSpecInspection, { status: "accepted" }> & {
  readonly spec: string;
  /** Với lần cài/cập nhật từ danh mục: trạng thái chọn mong muốn sau khi cài. */
  readonly selection?: boolean;
  readonly saveExact?: boolean;
};

/** Registry mà người dùng chọn cho một lần cài: một cái Host mời, hoặc URL tự gõ. */
export type RegistryChoice =
  | { readonly kind: "offered"; readonly registry: Registry }
  | { readonly kind: "custom"; readonly url: string };

/** Vì sao spec bị từ chối trước khi cài bất cứ thứ gì. */
export interface InstallInputError {
  readonly problem: PluginInspectProblem | "shipped";
  readonly reason: string;
  /** Các registry mà bước kiểm đã hỏi, theo thứ tự, khi lời từ chối đến từ việc hỏi chúng. */
  readonly registries?: readonly Registry[];
}

/** Một lượt chạy pnpm của một lần cài, như terminal của hộp thoại vẽ ra. */
export interface InstallRun {
  readonly jobId: string;
  readonly command: string;
  readonly cwd: string;
  /** stdout và stderr xen kẽ đúng thứ tự nhận, kể cả mã màu của pnpm. */
  readonly output: string;
  /** Mã thoát của pnpm khi lượt chạy kết thúc; null khi kết thúc bằng tín hiệu hoặc không chạy; vắng khi đang chạy. */
  readonly exitCode?: number | null;
}

/**
 * Đầu vào cài đặt, tiến trình Host báo, và kết cục cuối. `unconfirmed` giữ request chưa ngã ngũ; `unknown`
 * giải phóng nó khi Host báo không còn request mà câu trả lời gốc đã mất — cả hai KHÔNG phải huỷ.
 */
export interface InstallState {
  readonly open: boolean;
  readonly spec: string;
  readonly mirrorRecovery?: boolean;
  /** Spec đến từ một mục đã xác nhận ở tab khác, kèm tên và phiên bản của mục đó: hộp thoại không hiện form spec. */
  readonly confirmed?: { readonly title: string; readonly version: string };
  /** Các registry Host đã cấu hình, đọc khi hộp thoại mở; null tới khi Host trả lời. */
  readonly registries: PluginRegistries | null;
  /** Registry mà lần cài này hỏi trước: cái dùng gần nhất, không thì cái đầu của Host. */
  readonly registry: RegistryChoice;
  readonly registryOpen: boolean;
  readonly registryError: boolean;
  /** Các registry Host đã hỏi cho lần cài này, theo thứ tự, và số nó có thể hỏi; null trước khi chạy. */
  readonly attempts: { readonly registries: readonly Registry[]; readonly total: number } | null;
  readonly phase: "idle" | "checking" | "starting" | "running" | "cancelling" | "applying" | "unconfirmed" | "unknown" | "done" | "failed";
  /** Định danh lần cài của hộp thoại này, kể cả log và thông điệp huỷ. */
  readonly requestId?: PluginInstallRequestId;
  /** Vì sao spec bị từ chối trước khi cài; hiện dưới ô nhập. */
  readonly inputError: InstallInputError | null;
  /** Spec nêu tên gì, sau khi Host đọc. */
  readonly subject: InstallSubject | null;
  readonly runs: readonly InstallRun[];
  readonly detailsOpen: boolean;
  /** Bundle mà lượt chạy đã thêm; lần cài thường chờ bật, thao tác danh mục mang theo lựa chọn của nó. */
  readonly installed: string | null;
  readonly installedVersion: string | null;
  readonly restartRequired: boolean;
  readonly restartReason?: RestartReason;
  /** Thất bại của lượt chạy, khi một lượt đã kết luận hộp thoại. */
  readonly failure: {
    /** Câu lý do (chẩn đoán của Host hoặc câu của đường truyền). */
    readonly reason: string;
    /** Mã từ chối của Host. */
    readonly code?: string;
    /** Các gói mà lời từ chối `incompatible-version` nêu tên. */
    readonly incompatible?: readonly IncompatiblePlugin[];
    /** Loại thất bại của pnpm. */
    readonly kind?: PluginInstallFailureKind;
    /** Chỗ mà lượt chạy thất bại không chạm tới được, theo Host: registry, hoặc host của chính spec. */
    readonly failedAt?: "registry" | "spec-host";
    /** Các gói mà script cài đặt của chúng pnpm để ngỏ, mời phê duyệt. */
    readonly pendingBuilds?: readonly string[];
    /** Phân biệt mất câu trả lời cài, huỷ chưa xác nhận, và huỷ đang chờ Host nhận. */
    readonly uncertainty?: "result" | "cancellation" | "acceptance";
  } | null;
  readonly approvedBuilds: readonly string[];
  /** Bật bundle vừa cài từ màn "đã cài" là một lời gọi qua đường truyền. */
  readonly enabling: boolean;
}

/** Một thao tác phá huỷ đang chờ người dùng xác nhận: gỡ một gói. */
export interface ConfirmState {
  readonly action: "uninstall";
  readonly packageName: string;
}

/** Những gì tab vẽ ra. */
export interface PluginManagerState {
  /** `unavailable` khi Host chạy không có profile quản lý được; `error` giữ các gói đọc được lần cuối. */
  readonly status: "idle" | "loading" | "ready" | "error" | "unavailable";
  /** Phản hồi làm mới thủ công: `refreshing` tới khi các lần đọc xong và đủ 400 ms; `failed` khi làm mới hỏng mà không có kho đệm. */
  readonly refreshStatus: "idle" | "refreshing" | "failed";
  readonly packages: readonly PackageView[];
  readonly busy: readonly string[];
  readonly notice: ManagerNotice | null;
  readonly install: InstallState;
  readonly confirm: ConfirmState | null;
  /** Gói mà danh sách cuộn tới và đánh dấu, sau khi một lần cài bật nó. */
  readonly highlight: string | null;
}

/** Mặt phía đăng ký mà entry slot của tab inject. */
export interface PluginManagerFace {
  /** Giải chữ của gói theo ngôn ngữ hiện tại, tại lúc vẽ. */
  resolveText: (text: LocalizedText) => string;
  /** Lấy form cấu hình theo id entry của Host. */
  configForm: ConfigFormsSeam["get"];
  /** Các nguồn mà bộ vẽ bind. */
  hooks: {
    /** Giá trị cấu hình đã chấp nhận, dùng chung. */
    configurations: SettingsDescribeFace;
    /** Ảnh chụp của tab, bộ vẽ bind thành `usePluginManager`. */
    pluginManager: SnapshotStore<PluginManagerState>;
    /** Các plugin mang cấu hình, bộ vẽ bind thành `useConfigLedger`. */
    configLedger: HostObservable<ConfigLedger>;
    /** Các tab do plugin khác đóng góp, bộ vẽ bind thành `usePluginTabs`. */
    pluginTabs: HostObservable<readonly PluginTab[]>;
  };
  /** Đọc Host ngay lần vẽ đầu của tab. */
  ensure: () => void;
  /** Đọc Host lại. */
  refresh: () => void;
  /** Mở hộp thoại cài đặt. */
  openInstall: () => void;
  /** Mở hộp thoại cài đặt với một phiên bản đã xác nhận ở nơi khác, và bắt đầu kiểm nó. */
  installFrom: (target: PluginTabInstall) => void;
  /** Ẩn ngay, huỷ bước kiểm, hoặc yêu cầu huỷ trong khi vẫn giữ lần cài do Host sở hữu. */
  closeInstall: () => void;
  /** Sửa spec trong ô nhập. */
  editInstallSpec: (text: string) => void;
  /** Kiểm spec với Host rồi cài; từ màn thất bại thì chạy lại. */
  runInstall: () => void;
  /** Mở ra/thu lại các lựa chọn registry dưới ô spec. */
  toggleRegistryOptions: () => void;
  /** Chọn registry mà lần cài hỏi trước, hoặc gõ một cái. */
  chooseRegistry: (choice: RegistryChoice) => void;
  /** Từ màn thất bại: quay về ô spec với các lựa chọn registry mở ra. */
  changeRegistry: () => void;
  /** Từ lỗi kết nối GitHub về ô spec rỗng, hỏi registry gương được mời, giữ lựa chọn nếu nó đã hỏi gương đó. */
  useGithubMirror: () => void;
  /** Cho phép các script mà lượt chạy thất bại để ngỏ, lưu cho profile này, rồi chạy lại đúng spec đó. */
  approveBuildsAndRetry: () => void;
  /** Rời bước kiểm hoặc màn thất bại về ô spec, hoặc xin Host dừng lượt chạy và chờ nó dọn dẹp. */
  cancelInstall: () => void;
  /** Hỏi Host kết quả của một lần cài mà câu trả lời gốc đã mất. */
  reconcileInstall: () => void;
  /** Mở/thu phần chi tiết của lần cài. */
  toggleInstallDetails: () => void;
  /** Bật bundle mà lần cài đã xong thêm vào, rồi đóng hộp thoại và đánh dấu nó trong danh sách. */
  enableInstalled: () => void;
  /** Bỏ đánh dấu trong danh sách sau khi đã hiện. */
  clearHighlight: () => void;
  /** Đưa một bundle vào hoặc ra khỏi danh sách lớp của profile. */
  setEnabled: (packageName: string, enabled: boolean) => void;
  /** Gỡ gói đã cài rồi cài phiên bản trong danh mục của Host, chọn như gói đang được chọn. */
  update: (packageName: string) => void;
  /** Hỏi trước khi gỡ một gói khỏi profile. */
  uninstall: (packageName: string) => void;
  /** Xác nhận thao tác đang chờ. */
  confirm: () => void;
  /** Bỏ hộp xác nhận. */
  cancelConfirm: () => void;
  /** Bật/tắt một row của bundle trong lớp người dùng của profile. */
  setRowEnabled: (entryId: PluginEntryId, enabled: boolean) => void;
  /** Bỏ toast đang hiện. */
  dismissNotice: () => void;
}

/** Mục đã xác nhận của tab khác, đưa vào hộp thoại cài đặt (`PluginTabInstall` của slot-contract). */
export interface PluginTabInstall {
  /** Spec chính xác sẽ cài. */
  readonly spec: string;
  /** Registry mà mục đó yêu cầu (tuỳ chọn). */
  readonly registry?: string;
  /** Tiêu đề hộp thoại hiển thị. */
  readonly title: string;
  /** Phiên bản hộp thoại hiển thị. */
  readonly version: string;
}

/** Lựa chọn hiển thị trước khi Host nói registry nào hỏi trước: registry do cấu hình pnpm tự khai. */
export const OFFICIAL_REGISTRY: RegistryChoice = { kind: "offered", registry: null };

/** Giữ vòng xoay làm mới thủ công ít nhất chừng này mili-giây để lần đọc nhanh không nháy. */
export const REFRESH_SPINNER_MIN_MS = 400;

/** URL npmmirror công khai, dùng chung cho cấu hình dự phòng và phép so registry công khai. */
export const NPMMIRROR_REGISTRY = "https://registry.npmmirror.com/";

/** Một URL http(s), đúng dạng pnpm nhận cho `--registry`. */
export const REGISTRY_URL = /^https?:\/\/\S+$/;

/** Trạng thái hộp thoại cài đặt lúc nghỉ (nguyên văn `IDLE_INSTALL` của bản gốc). */
export const IDLE_INSTALL: InstallState = {
  open: false, spec: "", registries: null, registry: OFFICIAL_REGISTRY, registryOpen: false, registryError: false,
  attempts: null, phase: "idle", inputError: null, subject: null, runs: [], detailsOpen: false, installed: null,
  installedVersion: null, restartRequired: false, failure: null, approvedBuilds: [], enabling: false,
};

/**
 * UUID v4 ngẫu nhiên, đúc từ `crypto.getRandomValues` (port 1:1 `util/crypto`).
 * Nhận: không.
 * Trả: chuỗi UUID.
 */
export function randomUUID(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (byte, index) => {
    const value = index === 6 ? (byte & 15) | 64 : index === 8 ? (byte & 63) | 128 : byte;
    return value.toString(16).padStart(2, "0");
  }).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Parse một URL registry về dạng pnpm so sánh registry: host chữ thường, có dấu "/" cuối.
 * Nhận: `url` — registry như được cấu hình hoặc yêu cầu.
 * Trả: URL đã chuẩn hoá.
 * Ném: `Error` với bất cứ thứ gì không phải URL http(s).
 */
export function normalizeRegistry(url: string): string {
  let parsed: URL | undefined;
  try {
    parsed = new URL(url);
  } catch {
    // Rơi xuống nhánh ném bên dưới — đúng bản gốc (bắt rỗng rồi kiểm `parsed`).
  }
  if (parsed === undefined || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    throw new Error(`a registry must be an http(s) URL: ${url}`);
  }
  if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
  return parsed.href;
}

/**
 * Khoá so sánh của một lựa chọn registry, đúng như kế hoạch cài của Host so: cấu hình pnpm tự khai đại diện
 * cho URL nó nêu, một khi Host đã đọc được.
 * Nhận: `registry` — registry (null = registry pnpm tự khai); `resolved` — URL pnpm tự khai (null khi chưa đọc được).
 * Trả: khoá so sánh; registry không parse được thì so NGUYÊN chuỗi, registry null thì chuỗi rỗng.
 */
export function registryKey(registry: Registry, resolved: string | null): string {
  const url = registry ?? resolved;
  if (url === null) return "";
  try {
    return normalizeRegistry(url);
  } catch {
    return url;
  }
}

/**
 * Các registry mà hộp thoại mời: cái đầu của Host, các cái dự phòng, và cái pnpm tự khai, mỗi cái MỘT lần.
 * Cấu hình pnpm tự khai đại diện cho registry nó nêu nên không lặp lại cái Host đã mời.
 * Nhận: `registries` — những gì Host cấu hình, hoặc null khi chưa đọc.
 * Trả: các registry theo đúng thứ tự hộp thoại liệt kê.
 */
export function offeredRegistries(registries: PluginRegistries | null): Registry[] {
  const offered: Registry[] = [];
  const keys: string[] = [];
  const candidates: Registry[] = [...registries === null ? [] : [registries.registry, ...registries.fallbackRegistries], null];
  for (const registry of candidates) {
    const key = registryKey(registry, registries?.resolved ?? null);
    if (keys.includes(key)) continue;
    offered.push(registry);
    keys.push(key);
  }
  return offered;
}

/**
 * Một lần cài còn do Host sở hữu không.
 * Nhận: `phase` — pha hiện tại của hộp thoại.
 * Trả: true khi còn chờ kết quả Host hoặc chờ bước kiểm request đang chạy.
 */
export function isInstallPending(phase: InstallState["phase"]): boolean {
  return phase === "starting" || phase === "running" || phase === "cancelling" || phase === "applying" || phase === "unconfirmed";
}

/**
 * Mời registry gương Trung Quốc đã cấu hình sau một lỗi kết nối GitHub đã xác nhận.
 * Nhận: `install` — lần cài và sự quy lỗi của Host.
 * Trả: mục được mời hỏi npmmirror; null khi mục đó là cấu hình pnpm tự khai; undefined khi cách chữa này
 * không áp dụng (phải kiểm `undefined`, vì null là một mục HỢP LỆ).
 */
export function githubRecoveryRegistry(install: InstallState): Registry | undefined {
  if (
    install.confirmed !== undefined
    || install.phase !== "failed"
    || install.failure?.failedAt !== "spec-host"
    || (install.failure.kind !== "network" && install.failure.kind !== "timeout")
  ) return undefined;
  const host = install.subject?.host?.toLowerCase().split(":")[0];
  if (host !== "github.com" && !host?.endsWith(".github.com")) return undefined;
  const resolved = install.registries?.resolved ?? null;
  return offeredRegistries(install.registries).find((registry) => registryKey(registry, resolved) === NPMMIRROR_REGISTRY);
}

/**
 * Lần cài đã hỏi npmmirror trước chưa, để việc chuyển sang gương được mời không đổi registry.
 * Nhận: `install` — lần cài và lựa chọn registry của nó.
 * Trả: true khi registry đã chọn (được mời hoặc tự gõ) so ra là npmmirror.
 */
export function asksMirror(install: InstallState): boolean {
  const choice = install.registry;
  return registryKey(choice.kind === "custom" ? choice.url.trim() : choice.registry, install.registries?.resolved ?? null) === NPMMIRROR_REGISTRY;
}

/**
 * Khoá mà một row chiếm trong danh sách bận.
 * Nhận: `entryId` — id entry của Loader.
 * Trả: khoá bận dạng `row:<entryId>`.
 */
export function rowKey(entryId: string): string {
  return `row:${entryId}`;
}


/**
 * Mo ta DA NGON NGU cua goi ta: bang PLUGIN_DESCRIPTIONS theo TEN GOI (task-178, 20/10/2026).
 * Uu tien bang nay de man Plugins hien cau dung nghia va TU DICH theo ngon ngu UI; khong co thi dung manifest.
 * Nhan: bundle - thong tin goi tu Host.
 * Tra: mo ta {en, zh, vi} hoac undefined khi bang khong co goi nay.
 */
function moTaCuaTa(bundle: BundleInfo): PluginDescription | undefined {
  return PLUGIN_DESCRIPTIONS[bundle.name];
}

/**
 * Chuẩn hoá mô tả của ta thành LocalizedText (zh có thể thiếu ⇒ dùng chuỗi rỗng cho đủ ba ngôn ngữ).
 * Nhận: moTa — mô tả trong bảng của ta (có thể undefined). Trả: LocalizedText đủ khoá, hoặc undefined.
 */
function chuanHoaMoTa(moTa: PluginDescription | undefined): LocalizedText | undefined {
  if (moTa === undefined) return undefined;
  return { en: moTa.en, zh: moTa.zh ?? "", vi: moTa.vi };
}
/**
 * Một bundle như trang hiển thị: các row của nó ghép với các entry của Host.
 * Nhận: `bundle` — bundle của Host; `plugins` — các entry plugin của Host.
 * Trả: {@link PackageView}.
 */
export function packageView(bundle: BundleInfo, plugins: readonly PluginInfo[]): PackageView {
  const rows: PackageRow[] = bundle.rows.map((row) => {
    const live = row.entryId === undefined ? undefined : plugins.find((plugin) => plugin.entryId === row.entryId);
    return {
      rowId: row.rowId,
      moduleName: row.moduleName,
      enabled: live?.enabled ?? false,
      phase: live?.fiberPhase ?? null,
      ...row.meta === undefined ? {} : { meta: row.meta },
      ...row.entryId === undefined ? {} : { entryId: row.entryId },
      ...live?.readOnlyReason === undefined ? {} : { readOnlyReason: live.readOnlyReason },
    };
  });
  return {
    name: bundle.name,
    official: bundle.official,
    availability: bundle.availability,
    ...bundle.installTarget === undefined ? {} : { installTarget: bundle.installTarget },
    installed: bundle.installed,
    optional: bundle.optional,
    removable: bundle.removable,
    enabled: bundle.enabled,
    rows,
    ...bundle.version === undefined ? {} : { version: bundle.version },
    ...bundle.source === undefined ? {} : { source: bundle.source },
    ...(moTaCuaTa(bundle) === undefined ? (bundle.description === undefined ? {} : { description: bundle.description }) : {}),
    ...(moTaCuaTa(bundle) === undefined
      ? bundle.meta === undefined
        ? {}
        : { meta: bundle.meta }
      : { meta: { ...(bundle.meta ?? {}), description: chuanHoaMoTa(moTaCuaTa(bundle)) } }),
    ...bundle.readOnlyReason === undefined ? {} : { readOnlyReason: bundle.readOnlyReason },
    ...bundle.error === undefined ? {} : { error: bundle.error },
  };
}

/**
 * Thứ tự danh sách hiển thị gói: theo tên rút gọn mà người ta đọc, để một thẻ đứng yên khi bundle của nó
 * được bật/tắt, bất kể Host trả lời theo thứ tự nào.
 * Nhận: `packages` — các bundle đã thành view.
 * Trả: các view đã sắp theo tên rút gọn.
 */
export function sortPackages(packages: readonly PackageView[]): PackageView[] {
  return [...packages].sort((a, b) => shortName(a.name).localeCompare(shortName(b.name)));
}

/**
 * Hộp thoại quay về ô spec: quên lượt chạy và kết cục của nó, giữ spec và các registry.
 * Nhận: `install` — trạng thái hộp thoại hiện tại.
 * Trả: trạng thái mới.
 */
export function specAgain(install: InstallState): InstallState {
  const { open, spec, registries, registry, mirrorRecovery, confirmed } = install;
  return {
    ...IDLE_INSTALL,
    open,
    spec,
    registries,
    registry,
    ...install.subject?.selection === undefined ? {} : { subject: install.subject },
    ...mirrorRecovery === undefined ? {} : { mirrorRecovery },
    ...confirmed === undefined ? {} : { confirmed },
  };
}

/**
 * Lựa chọn như hộp thoại hiển thị được sau khi Host trả lời: không nhớ gì thì bắt đầu từ registry Host hỏi
 * trước; registry đã nhớ mà Host nay hỏi dưới mục khác thì lấy mục đó; cái Host không còn mời thì giữ như
 * registry tự gõ.
 * Nhận: `remembered` — lựa chọn đã nhớ (null: chưa dùng lần nào); `registries` — những gì Host trả lời.
 * Trả: lựa chọn để hiển thị.
 */
export function reconciled(remembered: RegistryChoice | null, registries: PluginRegistries): RegistryChoice {
  if (remembered === null) return { kind: "offered", registry: registries.registry };
  if (remembered.kind === "custom" || remembered.registry === null) return remembered;
  const key = registryKey(remembered.registry, registries.resolved);
  const offered = offeredRegistries(registries).find((registry) => registryKey(registry, registries.resolved) === key);
  return offered === undefined ? { kind: "custom", url: remembered.registry } : { kind: "offered", registry: offered };
}

/**
 * Chỉ gương công khai đi kèm bản cài mới thay được mặc định npm chính thức chưa cấu hình.
 * Nhận: `registries` — các registry Host trả lời.
 * Trả: mục npmmirror trong danh sách dự phòng, hoặc undefined khi không đủ điều kiện.
 */
export function eligibleMirror(registries: PluginRegistries): Registry | undefined {
  if (registries.registry !== null || registries.resolved === null) return undefined;
  let resolved: string;
  try {
    resolved = normalizeRegistry(registries.resolved);
  } catch {
    return undefined;
  }
  if (resolved !== "https://registry.npmjs.org/") return undefined;
  return registries.fallbackRegistries.find((registry) => registry === NPMMIRROR_REGISTRY);
}

/**
 * Lời từ chối, hoặc một thay đổi Host không áp dụng được — mang điều nó nói và, với lời từ chối, mã của nó.
 * Nhận: `reason` — câu lý do; `code` — mã lỗi của Host; `incompatible` — các gói bị từ chối.
 * Trả: lỗi mới.
 */
export class RemoteAnswerError extends Error {
  /** Câu lý do (nguyên văn `reason` của bản gốc). */
  readonly reason: string;
  /** Mã lỗi của Host, khi đây là lời từ chối. */
  readonly code: string | undefined;
  /** Các gói mà lời từ chối không tương thích nêu tên. */
  readonly incompatible: readonly IncompatiblePlugin[] | undefined;

  constructor(reason: string, code?: string, incompatible?: readonly IncompatiblePlugin[]) {
    super(reason);
    this.reason = reason;
    this.code = code;
    this.incompatible = incompatible;
    this.name = "RemoteAnswerError";
  }
}

/**
 * Cách hộp thoại đọc một thay đổi thất bại: mã và chẩn đoán của Host, và thất bại đã phân loại của lượt chạy.
 * Nhận: `error` — lỗi của Host (undefined khi Host không nói); `kind` — loại thất bại của pnpm;
 * `pendingBuilds` — các gói đang chờ phê duyệt; `failedAt` — chỗ không chạm tới được.
 * Trả: khối `failure` của {@link InstallState}.
 */
export function failureOf(
  error: ManagementError | undefined,
  kind?: PluginInstallFailureKind,
  pendingBuilds?: readonly string[],
  failedAt?: "registry" | "spec-host",
): NonNullable<InstallState["failure"]> {
  return {
    reason: error?.diagnostic ?? "",
    ...error === undefined ? {} : { code: error.code },
    ...error?.incompatible === undefined ? {} : { incompatible: error.incompatible },
    ...kind === undefined ? {} : { kind },
    ...failedAt === undefined ? {} : { failedAt },
    ...pendingBuilds === undefined || pendingBuilds.length === 0 ? {} : { pendingBuilds },
  };
}

/**
 * Toast mà một lỗi ném ra trở thành: lời từ chối giữ mã của nó, mọi thứ khác giữ câu của nó.
 * Nhận: `error` — lỗi đã ném; `subject` — việc đang làm và gói liên quan; `seq` — số thứ tự lần hiện.
 * Trả: {@link ManagerNotice} kiểu `failed`.
 */
export function failedNotice(error: unknown, subject: { readonly packageName?: string; readonly action: FailedAction }, seq: number): ManagerNotice {
  const code = error instanceof RemoteAnswerError ? error.code : undefined;
  const incompatible = error instanceof RemoteAnswerError ? error.incompatible : undefined;
  return {
    kind: "failed",
    reason: reasonOf(error),
    ...code === undefined ? {} : { code },
    ...incompatible === undefined ? {} : { incompatible },
    ...subject,
    seq,
  };
}

/**
 * Các lượt chạy với MỌI lượt còn mở được kết thúc ở `exitCode`.
 * Nhận: `runs` — các lượt chạy; `exitCode` — mã thoát để đóng các lượt còn mở.
 * Trả: mảng lượt chạy mới (giữ nguyên lượt đã có mã thoát).
 */
export function settledRuns(runs: readonly InstallRun[], exitCode: number | null): readonly InstallRun[] {
  return runs.map((run) => run.exitCode === undefined ? { ...run, exitCode } : run);
}

/**
 * Điều một lỗi đã ném nói: câu lý do của lời từ chối, không thì `message` của lỗi.
 * Nhận: `error` — giá trị đã bắt.
 * Trả: chuỗi lý do.
 */
export function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Lấy hàm tạo snapshot store từ bảng module của trang.
 * Nhận: `modules` — bảng module mà loader cấp (có thể chưa có).
 * Trả: `createSnapshotStore` của engine; thiếu thì trả bản trong bộ nhớ kèm MỘT cảnh báo
 *      (dị biệt có chủ đích so với bản gốc: bản gốc luôn có module nên không có nhánh này).
 */
export function storeFactoryOf(modules: PluginManagerModules | undefined): CreateSnapshotStore {
  const seam = modules?.store as StoreModuleSeam | undefined;
  if (seam?.createSnapshotStore !== undefined) return seam.createSnapshotStore;
  warnMissingStore();
  return <T>(initial: T): SnapshotStore<T> => memorySnapshotStore(initial);
}

/** Đã cảnh báo thiếu engine store chưa (chỉ cảnh báo một lần để không rác console). */
let warnedMissingStore = false;

/** Cảnh báo một lần rằng bảng module thiếu engine store. */
function warnMissingStore(): void {
  if (warnedMissingStore) return;
  warnedMissingStore = true;
  console.warn("[ui-plugin-manager] thiếu modules.store.createSnapshotStore — dùng sổ trong bộ nhớ (không bền qua lần tải trang)");
}

/**
 * Sổ ảnh chụp tối thiểu trong bộ nhớ (chỉ dùng khi bảng module thiếu engine store).
 * Nhận: `initial` — ảnh chụp đầu tiên.
 * Trả: sổ có getSnapshot/subscribe/set.
 */
function memorySnapshotStore<T>(initial: T): SnapshotStore<T> {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (next) => {
      snapshot = next;
      for (const listener of [...listeners]) listener();
    },
  };
}
