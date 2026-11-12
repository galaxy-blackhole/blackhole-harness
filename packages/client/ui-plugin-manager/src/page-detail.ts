/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hợp đồng dùng chung của trang Plugins (kiểu dữ liệu · dependency của cụm khác) và các section/trang chi tiết — port 1:1 vùng PluginManagerPage của client.js (2283-2985)
 */
import { PAGE_CLASS } from "./class-names.ts";
import type { PluginManagerModules } from "./runtime.ts";
import type { PrimitivesSeam, IconPrimitive } from "./page-install-dialog.ts";

/** Bảng lớp CSS của trang — bản gốc gọi là PluginManagerPage_module_css_default. */
const css = PAGE_CLASS;

/* ------------------------------------------------------------------------------------------------------------
 * Hợp đồng kiểu: những gì trang đọc từ props của slot và từ các cụm file khác.
 * ---------------------------------------------------------------------------------------------------------- */

/** Hàm dịch của namespace pluginManager (ghế t do slot locale bơm): nhận khoá + tham số nội suy, trả câu đã dịch. */
export interface PageTranslate {
  (key: string, params?: Readonly<Record<string, string>>): string;
}
/** Tham chiếu React (chỉ trường current mà trang chạm tới). */
export interface RefLike<T> {
  current: T;
}
/** Sự kiện bàn phím của React (chỉ thành phần trang đọc). */
export interface KeyboardEventLike {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  readonly target: unknown;
  readonly currentTarget: HTMLElement;
  readonly nativeEvent: { readonly isComposing?: boolean; readonly keyCode?: number };
  preventDefault(): void;
  stopPropagation(): void;
}
/** Sự kiện đổi giá trị của một ô nhập. */
export interface ChangeEventLike<T extends HTMLElement = HTMLElement> {
  readonly target: T;
  readonly currentTarget: T;
}
/** Sự kiện chuột của React (chỉ phần trang đọc). */
export interface MouseEventLike {
  readonly target: unknown;
  preventDefault(): void;
}
/** Một phần tử dựng bằng jsx (React node) — trang không tự mở kiểu của React. */
export type PageNode = unknown;
/** Hàm dựng element có kiểm kiểu tham số: jsx và jsxs của react/jsx-runtime. */
export interface PageJsx {
  <P extends object>(type: (props: P) => unknown, props: P, key?: unknown): PageNode;
  (type: string, props: Record<string, unknown> | null, key?: unknown): PageNode;
}
/** Hàm renderSlot mà slot runtime bơm cho trang: nhận khoá slot + props chủ + tuỳ chọn chọn entry, trả node đã vẽ. */
export interface RenderSlotsSeam {
  (key: string, owner?: Readonly<Record<string, unknown>>, opts?: Readonly<Record<string, unknown>>): PageNode;
}
/** Văn bản đa ngôn ngữ của manifest gói (LocalizedText). */
export type LocalizedTextRef = string | { readonly en: string; readonly [locale: string]: string };
/** Hàm giải văn bản theo ngôn ngữ hiện tại (PluginManagerFace.resolveText): nhận chuỗi/bảng dịch, trả chuỗi. */
export interface ResolveText {
  (text: LocalizedTextRef): string;
}
/** Hiển thị cục bộ của một gói/row và chẩn đoán của Host (PluginLocalizedMeta). */
export interface PluginLocalizedMetaView {
  readonly title?: LocalizedTextRef;
  readonly description?: LocalizedTextRef;
  readonly icon?: string;
  readonly error?: string;
}
/** Mã lỗi quản trị của Host (13 mã của CODE_KEYS). */
export type ManagementCode =
  | "management-required" | "unaddressable" | "unknown-plugin" | "invalid-spec" | "already-installed"
  | "ambiguous-install" | "not-bundle" | "not-removable" | "stop-profile" | "bundle-in-use"
  | "stale-approval" | "incompatible-version" | "operation-error";
/** Lý do Host từ chối điều khiển một mục. */
export type ReadOnlyReasonView = "management-required" | "unaddressable";
/** Một gói bị phiên bản DSH đang chạy từ chối (trang chỉ chuyển tiếp, không đọc trường nào). */
export interface IncompatiblePluginRef {
  readonly name: string;
  readonly version: string;
  readonly runtimeVersion: string;
  readonly requirements: Readonly<Record<string, string>>;
}
/** Lỗi quản trị Host trả về (ManagementError). */
export interface ManagementErrorView {
  readonly code: ManagementCode;
  readonly diagnostic?: string;
  readonly incompatible?: readonly IncompatiblePluginRef[];
}
/** Đầu vào của managementText (bản gốc: mã + chẩn đoán + gói + cờ installing). */
export interface ManagementErrorRef {
  readonly code: ManagementCode;
  readonly diagnostic?: string;
  readonly incompatible?: readonly IncompatiblePluginRef[];
  readonly installing?: true;
}
/** Pha của fiber mà một row đang chạy. */
export type RowPhase = "pending" | "loading" | "active" | "failed" | "unloading";
/** Một row của gói như trang liệt kê (PackageRow). */
export interface PackageRowView {
  readonly entryId?: string; readonly rowId: string; readonly moduleName: string;
  readonly meta?: PluginLocalizedMetaView; readonly enabled: boolean; readonly phase: RowPhase | null;
  readonly readOnlyReason?: ReadOnlyReasonView;
}
/** Nơi đọc được gói: bản cài đặt cấp, profile khai, hay thiếu tệp. */
export type AvailabilityView = "installation" | "profile" | "missing";
/** Một gói như trang hiển thị (PackageView). */
export interface PackageView {
  readonly name: string; readonly official: boolean; readonly availability: AvailabilityView;
  readonly installTarget?: { readonly spec: string; readonly version: string };
  readonly version?: string; readonly description?: string; readonly meta?: PluginLocalizedMetaView;
  readonly installed: boolean; readonly source?: string; readonly optional: boolean;
  readonly removable: boolean; readonly enabled: boolean;
  readonly readOnlyReason?: ReadOnlyReasonView; readonly error?: ManagementErrorView;
  readonly rows: readonly PackageRowView[];
}
/** Trạng thái nháp của form cấu hình một namespace (ConfigFormSnapshot). */
export interface ConfigFormSnapshotView {
  readonly status: "loading" | "ready" | "unavailable"; readonly value: Record<string, unknown> | undefined;
  readonly revision: number | undefined; readonly writable: boolean; readonly mode: "host" | "memory";
  readonly base: unknown; readonly user: unknown;
}
/** Một phép ghi đường dẫn cấu hình (chuyển tiếp nguyên vẹn cho Host). */
export type SettingsPathOpRef = unknown;
/** Form cấu hình của một namespace (ConfigForm): đọc ảnh chụp, xếp một lượt ghi nguyên tử. */
export interface ConfigFormView {
  getSnapshot(): ConfigFormSnapshotView;
  mutate(ops: readonly SettingsPathOpRef[], expectedRevision?: number): Promise<boolean>;
}
/** Form cấu hình mà trang chuyển cho entry của slot (ConfigPageForm của slot-contract). */
export interface ConfigPageForm {
  readonly state: ConfigFormSnapshotView;
  readonly mutate: (ops: readonly SettingsPathOpRef[], revision?: number) => Promise<boolean>;
}
/** Ảnh chụp gương cấu hình mà useConfigurations chọn (SettingsMirrorSnapshot). */
export interface SettingsMirrorSnapshotView {
  readonly view: { readonly namespaces: readonly SettingsNamespaceViewRef[] } | undefined;
  readonly error: string | null;
}
/** Một namespace cấu hình như Host mô tả. */
export interface SettingsNamespaceViewRef {
  readonly ns: string;
}
/** Registry của Host: URL http(s), hoặc null cho registry mà cấu hình pnpm chỉ định. */
export type RegistryRef = string | null;
/** Các registry Host cấu hình (PluginRegistries). */
export interface PluginRegistriesView {
  readonly registry: RegistryRef; readonly fallbackRegistries: readonly string[]; readonly resolved: string | null;
}
/** Lý do một thay đổi phải chờ khởi động lại (RestartReason). */
export type RestartReasonView = "no-hmr" | "package-moved" | "host-module" | "unmanaged-plugin" | "module-comparison";
/** Pha của dialog cài đặt (InstallState.phase). */
export type InstallPhaseView =
  | "idle" | "checking" | "starting" | "running" | "cancelling"
  | "applying" | "unconfirmed" | "unknown" | "done" | "failed";
/** Lựa chọn registry cho một lượt cài (RegistryChoice). */
export type RegistryChoiceView =
  | { readonly kind: "offered"; readonly registry: RegistryRef }
  | { readonly kind: "custom"; readonly url: string };
/** Dạng của một spec cài đặt, theo từ vựng pnpm (InstallSpecKind). */
export type InstallSpecKindView = "registry" | "path" | "git" | "tarball";
/** Spec đã được Host đọc và chấp nhận (InstallSubject). */
export interface InstallSubjectView {
  readonly spec: string; readonly kind: InstallSpecKindView;
  readonly name?: string; readonly version?: string; readonly description?: string;
  readonly bundle: boolean | null; readonly registry: RegistryRef; readonly host?: string;
  readonly selection?: boolean; readonly saveExact?: boolean;
}
/** Vì sao spec bị từ chối trước khi cài (PluginInspectProblem hoặc shipped). */
export type InstallInputProblemView =
  | "invalid-spec" | "already-installed" | "shipped" | "not-found"
  | "not-a-package" | "not-a-bundle" | "network" | "unknown";
/** Lỗi kiểm tra spec (InstallInputError). */
export interface InstallInputErrorView {
  readonly problem: InstallInputProblemView; readonly reason: string; readonly registries?: readonly RegistryRef[];
}
/** Một lượt pnpm của lần cài (InstallRun). */
export interface InstallRunView {
  readonly jobId: string; readonly command: string; readonly cwd: string;
  readonly output: string; readonly exitCode?: number | null;
}
/** Cách một thao tác gói thất bại (PluginInstallFailureKind). */
export type InstallFailureKindView =
  | "pnpm-missing" | "timeout" | "not-found" | "no-matching-version" | "network"
  | "disk-full" | "permission" | "build-blocked" | "integrity" | "unknown";
/** Lỗi đã kết thúc dialog cài đặt (InstallState.failure). */
export interface InstallFailureView {
  readonly reason: string; readonly code?: ManagementCode; readonly incompatible?: readonly IncompatiblePluginRef[];
  readonly kind?: InstallFailureKindView; readonly failedAt?: "registry" | "spec-host";
  readonly pendingBuilds?: readonly string[]; readonly uncertainty?: "result" | "cancellation" | "acceptance";
}
/** Lượt cài đặt mà trang đọc để chọn nút và khoá form (phần InstallState mà vùng này chạm). */
export interface InstallStateView {
  readonly open: boolean; readonly spec: string; readonly mirrorRecovery?: boolean;
  readonly confirmed?: { readonly title: string; readonly version: string };
  readonly registries: PluginRegistriesView | null; readonly registry: RegistryChoiceView;
  readonly registryOpen: boolean; readonly registryError: boolean;
  readonly attempts: { readonly registries: readonly RegistryRef[]; readonly total: number } | null;
  readonly phase: InstallPhaseView; readonly requestId?: string;
  readonly inputError: InstallInputErrorView | null; readonly subject: InstallSubjectView | null;
  readonly runs: readonly InstallRunView[]; readonly detailsOpen: boolean;
  readonly installed: string | null; readonly installedVersion: string | null;
  readonly restartRequired: boolean; readonly restartReason?: RestartReasonView;
  readonly failure: InstallFailureView | null; readonly approvedBuilds: readonly string[];
  readonly enabling: boolean;
}
/** Thông báo mà toast hiển thị (ManagerNotice). */
export type ManagerNoticeView =
  | { readonly kind: "restart"; readonly packageName: string; readonly reason: RestartReasonView | undefined; readonly seq: number }
  | { readonly kind: "overridden"; readonly packageName: string; readonly seq: number }
  | { readonly kind: "cancelled"; readonly seq: number }
  | { readonly kind: "refresh-failed"; readonly seq: number }
  | { readonly kind: "install"; readonly outcome: "done" | "failed" | "unconfirmed" | "applying" | "unknown"; readonly seq: number }
  | {
      readonly kind: "failed"; readonly action: "enable" | "disable" | "uninstall" | "rowEnable" | "rowDisable";
      readonly code?: ManagementCode; readonly reason: string; readonly incompatible?: readonly IncompatiblePluginRef[];
      readonly packageName?: string; readonly seq: number;
    };
/** Phần gói mà packageText đọc. */
export interface PackageTextView {
  readonly name: string; readonly meta?: PluginLocalizedMetaView;
}
/** Phần row mà rowText đọc. */
export interface RowTextView {
  readonly moduleName: string; readonly meta?: PluginLocalizedMetaView;
}

/** Các hàm mà vùng trang dùng nhưng thuộc cụm file KHÁC (bản gốc gọi thẳng hàm module-scope của presentation · manager-store · config-ledger). Cụm port những vùng đó truyền vào đây; chữ ký giữ NGUYÊN bản gốc. */
export interface PluginManagerPageDeps {
  /** presentation.registryText — nhận registry (null = cấu hình pnpm) + t + resolved, trả { name, host }. */
  registryText(registry: RegistryRef, t: PageTranslate, resolved: string | null): { name: string; host: string };
  /** presentation.managementText — nhận mã + chẩn đoán + gói + cờ installing, trả câu hiển thị. */
  managementText(error: ManagementErrorRef, t: PageTranslate): string;
  /** presentation.packageText — nhận tên + metadata cục bộ + resolveText, trả { title, description, beta }. */
  packageText(pkg: PackageTextView, resolveText: ResolveText): { title: string; description: string | undefined; beta: boolean };
  /** presentation.rowText — nhận module + metadata cục bộ + resolveText, trả { title, description }. */
  rowText(row: RowTextView, resolveText: ResolveText): { title: string; description: string | undefined };
  /** presentation.restartText — nhận khoá câu + lý do + t, trả câu nhắc khởi động lại. */
  restartText(key: "restartNotice" | "installDoneRestart", reason: RestartReasonView | undefined, t: PageTranslate): string;
  /** presentation.noticeText — nhận kết cục hành động + t, trả câu của toast. */
  noticeText(notice: ManagerNoticeView, t: PageTranslate): string;
  /** config-ledger.rowConfigKey — nhận tên gói + id row, trả khoá <bundle>#<rowId>. */
  rowConfigKey(bundle: string, rowId: string): string;
  /** manager-store.rowKey — nhận id entry của Loader, trả khoá busy row:<entryId>. */
  rowKey(entryId: string): string;
  /** manager-store.isInstallPending — nhận pha dialog, trả true khi Host còn giữ lượt cài. */
  isInstallPending(phase: InstallPhaseView): boolean;
  /** manager-store.githubRecoveryRegistry — nhận lượt cài, trả registry mirror đề nghị (null = cấu hình pnpm) hoặc undefined khi không áp dụng. */
  githubRecoveryRegistry(install: InstallStateView): RegistryRef | undefined;
  /** manager-store.asksMirror — nhận lượt cài, trả true khi lựa chọn registry so là npmmirror. */
  asksMirror(install: InstallStateView): boolean;
  /** manager-store.offeredRegistries — nhận registry Host cấu hình (hoặc null), trả các registry dialog chào. */
  offeredRegistries(registries: PluginRegistriesView | null): readonly RegistryRef[];
}

/** Các hàm THẬT của cụm file khác (presentation · config-ledger · manager-store) mà deps sẽ nhận. */
type SiblingDeps = Pick<
  typeof import("./presentation.ts"),
  "registryText" | "managementText" | "packageText" | "rowText" | "restartText" | "noticeText"
> &
  Pick<typeof import("./config-ledger.ts"), "rowConfigKey"> &
  Pick<typeof import("./manager-store.ts"), "rowKey" | "isInstallPending" | "githubRecoveryRegistry" | "asksMirror" | "offeredRegistries">;

/** Khẳng định lúc biên dịch: chữ ký các hàm THẬT của cụm khác khớp {@link PluginManagerPageDeps} (TRUE mới hợp lệ). */
export type SiblingDepsMatch = SiblingDeps extends PluginManagerPageDeps ? true : never;

/* ------------------------------------------------------------------------------------------------------------
 * Kích thước của phần chi tiết.
 * ---------------------------------------------------------------------------------------------------------- */

/** Kích thước artwork 36-viewBox hiển thị trong khung 48px của card. */
export const CARD_ARTWORK_SIZE = 36;
/** Kích thước artwork hiển thị trong khung 40px của row. */
export const ROW_ARTWORK_SIZE = 30;
/** Số row vượt ngưỡng này thì danh sách có ô lọc phía trên. */
const ROW_FILTER_THRESHOLD = 10;
/** Khoá từ điển của pha fiber. */
const PHASE_KEYS: Readonly<Record<RowPhase, string>> = {
  pending: "rowPhasePending", loading: "rowPhaseLoading", active: "rowPhaseActive",
  failed: "rowPhaseFailed", unloading: "rowPhaseUnloading",
};
/** Trạng thái chấm của pha fiber; loading/unloading là chuyển tiếp sống. */
const PHASE_STATES: Readonly<Record<RowPhase, "idle" | "ongoing" | "done" | "error">> = {
  pending: "idle", loading: "ongoing", active: "done", failed: "error", unloading: "ongoing",
};
/* 25/10/2026 (yêu cầu chủ dự án): BỎ ảnh xem trước tính năng — trang chi tiết không còn vẽ
 * ảnh preview (và không còn dòng "Không hiển thị được ảnh xem trước" khi ảnh hỏng). */

/* ------------------------------------------------------------------------------------------------------------
 * Props của các phần chi tiết.
 * ---------------------------------------------------------------------------------------------------------- */

/** Props của artwork một gói. */
export interface PackageArtworkProps {
  readonly src?: string | undefined; readonly row?: boolean; readonly size?: number;
}
/** Props của công tắc một row. */
export interface RowSwitchProps {
  readonly row: PackageRowView; readonly title: string; readonly t: PageTranslate;
  readonly busy: boolean; readonly onChange: (enabled: boolean) => void;
}
/** Props của dòng chẩn đoán metadata. */
export interface MetadataErrorProps {
  readonly error: string | undefined; readonly t: PageTranslate;
}
/** Mở trang cấu hình của một row. */
export interface ConfigureHandle {
  has(row: PackageRowView): boolean;
  open(row: PackageRowView): void;
}
/** Props của section các row. */
export interface RowsSectionProps {
  readonly rows: readonly PackageRowView[]; readonly t: PageTranslate; readonly resolveText: ResolveText;
  readonly toggle?:
    | { readonly busy: (row: PackageRowView) => boolean; readonly onSetEnabled: (row: PackageRowView, enabled: boolean) => void }
    | undefined;
  readonly configure?: ConfigureHandle | undefined;
}
/** Props của section nguồn cài đặt. */
export interface SourceSectionProps {
  readonly pkg: PackageView; readonly t: PageTranslate;
}
/** Props của công tắc bật/tắt một gói. */
export interface EnableSwitchProps {
  readonly pkg: PackageView; readonly title: string; readonly t: PageTranslate;
  readonly busy: boolean; readonly onSetEnabled: (enabled: boolean) => void;
}
/** Props của đầu mỗi trang chi tiết. */
export interface DetailTopProps {
  readonly crumbLabel: string; readonly crumbText: string; readonly onBack: () => void;
  readonly icon: PageNode; readonly actions: PageNode;
}
/** Props của trang một plugin chính thức. */
export interface ItemDetailProps {
  readonly item: { readonly id: string; readonly label: string }; readonly t: PageTranslate;
  readonly onBack: () => void; readonly renderSlot: RenderSlotsSeam; readonly form: ConfigPageForm | undefined;
}
/** Props của trang cấu hình một row. */
export interface RowDetailProps {
  readonly pkg: PackageView; readonly row: PackageRowView; readonly t: PageTranslate;
  readonly resolveText: ResolveText; readonly onBack: () => void;
  readonly renderSlot: RenderSlotsSeam; readonly form: ConfigPageForm | undefined;
}
/** Props của trang một gói. */
export interface PackageDetailProps {
  readonly pkg: PackageView; readonly t: PageTranslate; readonly resolveText: ResolveText;
  readonly busy: boolean; readonly rowBusy: (row: PackageRowView) => boolean; readonly configured: boolean;
  readonly configure: ConfigureHandle; readonly renderSlot: RenderSlotsSeam; readonly inMore: boolean;
  readonly onBack: () => void; readonly onSetEnabled: (enabled: boolean) => void;
  readonly onUninstall: () => void; readonly onUpdate: () => void;
  readonly onSetRowEnabled: (row: PackageRowView, enabled: boolean) => void;
}
/** Các phần dùng chung và ba trang chi tiết mà createPageDetail trả về. */
export interface PageDetailParts {
  /** Artwork của một gói (icon manifest hoặc artwork mặc định). */
  readonly PackageArtwork: (props: PackageArtworkProps) => PageNode;
  /** Dòng chẩn đoán metadata của Host. */
  readonly MetadataError: (props: MetadataErrorProps) => PageNode;
  /** Đầu mỗi trang chi tiết. */
  readonly DetailTop: (props: DetailTopProps) => PageNode;
  /** Công tắc bật/tắt một gói. */
  readonly EnableSwitch: (props: EnableSwitchProps) => PageNode;
  /** Artwork của một plugin chính thức theo id đăng ký. */
  readonly itemArtwork: (id: string) => PageNode;
  /** Trạng thái một card: đang chạy, đang tắt, hay có lỗi. */
  readonly packageStatus: (pkg: PackageView) => "problem" | "running" | "disabled";
  /** Gói có bản cập nhật đang chờ. */
  readonly updateAvailable: (pkg: PackageView) => boolean;
  /** Section các row của một gói. */
  readonly RowsSection: (props: RowsSectionProps) => PageNode;
  /** Trang một plugin chính thức. */
  readonly ItemDetail: (props: ItemDetailProps) => PageNode;
  /** Trang cấu hình một row. */
  readonly RowDetail: (props: RowDetailProps) => PageNode;
  /** Trang một gói. */
  readonly PackageDetail: (props: PackageDetailProps) => PageNode;
}

/**
 * Dựng các phần chi tiết của trang Plugins (port 1:1 vùng PluginManagerPage của bundle gốc).
 *
 * Nhận: modules — bảng module của nửa browser; deps — các hàm thuộc cụm file khác.
 * Trả: PageDetailParts — các atom dùng chung và ba trang chi tiết, đã ràng buộc vào modules.
 */
export function createPageDetail(modules: PluginManagerModules, deps: PluginManagerPageDeps): PageDetailParts {
  const react = modules.react;
  const jsx = modules.jsxRuntime.jsx as PageJsx;
  const jsxs = modules.jsxRuntime.jsxs as PageJsx;
  const Fragment = modules.jsxRuntime.Fragment as (props: { children?: PageNode }) => PageNode;
  const prim = modules.primitives as unknown as PrimitivesSeam;
  const { Switch, Input, Tag, StateDot, Button, IconChevronDownOutlineRegular, IconChevronRightOutlineRegular } = prim;
  const { IconRefreshOutlineRegular, IconTrashOutlineRegular } = prim;
  const { packageText, rowText, managementText, rowConfigKey } = deps;

  /** Artwork của các plugin chính thức đã đăng ký cấu hình, theo id đăng ký. */
  const ITEM_ARTWORK: ReadonlyMap<string, IconPrimitive> = new Map<string, IconPrimitive>([
    ["shell", prim.PluginArtworkTerminal],
    ["agent-loop", prim.PluginArtworkLoop],
    ["subagent", prim.PluginArtworkSubagent],
    ["web-search", prim.PluginArtworkSearch],
  ]);

  /** Artwork của một plugin chính thức; plugin không có artwork riêng nhận bản mặc định. */
  function itemArtwork(id: string): PageNode {
    return jsx(ITEM_ARTWORK.get(id) ?? prim.PluginArtworkDefault, { size: CARD_ARTWORK_SIZE });
  }

  /** Ảnh của một gói: icon manifest; giải mã hỏng thì giữ artwork mặc định của vị trí. */
  function PackageArtwork({ src, row = false, size = row ? ROW_ARTWORK_SIZE : CARD_ARTWORK_SIZE }: PackageArtworkProps): PageNode {
    const [failedSource, setFailedSource] = react.useState<string | undefined>(undefined);
    return src === undefined || src === failedSource
      ? jsx(row ? prim.PluginArtworkSubagent : prim.PluginArtworkDefault, { size })
      : jsx("img", {
          className: css.packageImage,
          src,
          width: size,
          height: size,
          alt: "",
          onError: () => {
            setFailedSource(src);
          },
        });
  }

  /** Công tắc một row: khoá và nói lý do khi Host từ chối địa chỉ hoá row qua patch của profile. */
  function RowSwitch({ row, title, t, busy, onChange }: RowSwitchProps): PageNode {
    const locked = row.readOnlyReason !== undefined || row.entryId === undefined;
    return jsx(Switch, {
      checked: row.enabled,
      label: t("partToggle", { name: title }),
      disabled: busy || locked,
      ...(row.readOnlyReason === undefined ? {} : { title: managementText({ code: row.readOnlyReason }, t) }),
      onChange,
    });
  }

  /** Dòng trạng thái của một row: đang tắt, hoặc pha fiber của nó. */
  function rowStateText(row: PackageRowView, t: PageTranslate): string {
    if (!row.enabled) return t("partOff");
    return row.phase === null ? t("rowStateIdle") : t(PHASE_KEYS[row.phase]);
  }

  /** Chấm cạnh một row: pha fiber, hoặc idle. */
  function rowDotState(row: PackageRowView): "idle" | "ongoing" | "done" | "error" {
    if (!row.enabled || row.phase === null) return "idle";
    return PHASE_STATES[row.phase];
  }

  /** Chẩn đoán metadata của Host không đổi quyền quản lý của gói. */
  function MetadataError({ error, t }: MetadataErrorProps): PageNode {
    return error === undefined
      ? null
      : jsx("p", {
          className: css.reason,
          role: "status",
          "data-package-meta-error": true,
          children: t("metadataError", { error }),
        });
  }

  /** Dòng đếm trên các thành phần của một gói: tổng, rồi chỉ những trạng thái đang có. */
  function partsSummary(rows: readonly PackageRowView[], t: PageTranslate): string {
    const failed = rows.filter((row) => row.phase === "failed").length;
    const off = rows.filter((row) => !row.enabled).length;
    const running = rows.filter((row) => row.enabled && row.phase === "active").length;
    return [
      t("partsCountTotal", { count: String(rows.length) }),
      ...(running > 0 ? [t("partsCountRunning", { count: String(running) })] : []),
      ...(off > 0 ? [t("partsCountOff", { count: String(off) })] : []),
      ...(failed > 0 ? [t("partsCountFailed", { count: String(failed) })] : []),
    ].join(" · ");
  }

  /**
   * Các row của một gói, theo thứ tự gói khai: chấm trạng thái, id row, một dòng nói trạng thái,
   * nút cấu hình cho row đã đăng ký trang, và công tắc khi gói đang bật. Gói như base có gần trăm row
   * nên danh sách dài được thêm ô lọc.
   */
  function RowsSection({ rows, t, resolveText, toggle, configure }: RowsSectionProps): PageNode {
    const [filter, setFilter] = react.useState<string>("");
    const query = filter.trim().toLowerCase();
    const localized = rows.map((row) => ({ row, ...rowText(row, resolveText) }));
    const shown =
      query === ""
        ? localized
        : localized.filter(({ row, title, description }) =>
            [title, description, row.rowId, row.moduleName].some((value) => value?.toLowerCase().includes(query)),
          );
    return jsxs("section", {
      className: css.detailSection,
      "data-plugin-rows": true,
      children: [
        jsxs("div", {
          className: css.sectionHead,
          children: [
            jsx("h4", { className: css.sectionTitle, children: t("partsLabel") }),
            rows.length === 0 ? null : jsx("span", { className: css.sectionCount, children: partsSummary(rows, t) }),
          ],
        }),
        rows.length === 0 ? jsx("p", { className: css.status, children: t("partsEmpty") }) : null,
        rows.length > ROW_FILTER_THRESHOLD
          ? jsx(Input, {
              type: "search",
              className: css.partsFilter,
              placeholder: t("partsFilter"),
              "aria-label": t("partsFilter"),
              value: filter,
              onChange: (event) => {
                setFilter(event.target.value);
              },
            })
          : null,
        rows.length > 0 && shown.length === 0 ? jsx("p", { className: css.status, children: t("partsFilterEmpty") }) : null,
        shown.length === 0
          ? null
          : jsx("ul", {
              className: css.rows,
              children: shown.map(({ row, title, description }) =>
                jsxs(
                  "li",
                  {
                    className: css.row,
                    "data-plugin-row": row.entryId ?? row.rowId,
                    ...(row.phase === "failed" ? { "data-state": "failed" } : row.enabled ? {} : { "data-state": "off" }),
                    children: [
                      jsxs("div", {
                        className: css.rowLine,
                        children: [
                          jsx("span", {
                            className: css.rowIcon,
                            "aria-hidden": "true",
                            children: jsx(PackageArtwork, { src: row.meta?.icon, row: true }, row.meta?.icon),
                          }),
                          jsxs("div", {
                            className: css.rowMain,
                            children: [
                              configure?.has(row) === true
                                ? jsxs("button", {
                                    type: "button",
                                    className: css.rowOpen,
                                    "aria-label": t("configureRow", { name: title }),
                                    onClick: () => {
                                      configure.open(row);
                                    },
                                    children: [
                                      jsx("span", { className: css.rowId, children: title }),
                                      jsx(IconChevronRightOutlineRegular, { className: css.rowOpenIcon, "aria-hidden": "true" }),
                                    ],
                                  })
                                : jsx("span", { className: css.rowId, children: title }),
                              description === undefined ? null : jsx("span", { className: css.rowModule, children: description }),
                              title === row.rowId ? null : jsx("code", { className: css.rowModule, children: row.rowId }),
                              title === row.moduleName ? null : jsx("code", { className: css.rowModule, children: row.moduleName }),
                            ],
                          }),
                          jsxs("span", {
                            className: css.rowState,
                            children: [jsx(StateDot, { state: rowDotState(row) }), rowStateText(row, t)],
                          }),
                          toggle === undefined
                            ? null
                            : jsx(RowSwitch, {
                                row,
                                title,
                                t,
                                busy: toggle.busy(row),
                                onChange: (enabled) => {
                                  toggle.onSetEnabled(row, enabled);
                                },
                              }),
                        ],
                      }),
                      jsx(MetadataError, { error: row.meta?.error, t }),
                    ],
                  },
                  row.rowId,
                ),
              ),
            }),
      ],
    });
  }

  /** Nguồn cài đặt và phiên bản đã khai; gói thiếu tệp vẫn giữ spec phụ thuộc đã ghi. */
  function SourceSection({ pkg, t }: SourceSectionProps): PageNode {
    if (pkg.source === undefined && !pkg.installed && pkg.availability === "installation" && !pkg.optional) return null;
    return jsxs("section", {
      className: css.detailSection,
      "data-plugin-source": true,
      children: [
        jsx("h4", { className: css.sectionTitle, children: t("sourceTitle") }),
        jsxs("dl", {
          className: css.facts,
          children: [
            jsxs("div", {
              children: [
                jsx("dt", { children: t("sourceSpec") }),
                jsx("dd", {
                  children:
                    pkg.source !== undefined
                      ? jsx("code", { children: pkg.source })
                      : pkg.availability === "missing"
                        ? t(pkg.installed ? "statusMissingFiles" : "sourceNotInstalled")
                        : t("sourceBuiltIn"),
                }),
              ],
            }),
            pkg.version === undefined
              ? null
              : jsxs("div", { children: [jsx("dt", { children: t("sourceVersion") }), jsx("dd", { children: pkg.version })] }),
            pkg.installTarget === undefined
              ? null
              : jsxs(Fragment, {
                  children: [
                    jsxs("div", {
                      children: [
                        jsx("dt", { children: t("sourceTargetSpec") }),
                        jsx("dd", { children: jsx("code", { children: pkg.installTarget.spec }) }),
                      ],
                    }),
                    jsxs("div", {
                      children: [jsx("dt", { children: t("sourceTargetVersion") }), jsx("dd", { children: pkg.installTarget.version })],
                    }),
                  ],
                }),
          ],
        }),
      ],
    });
  }

  /** Công tắc của một gói trên card và trên trang: khoá kèm lý do với gói Host bảo vệ; tắt và khoá với gói không đọc được. */
  function EnableSwitch({ pkg, title, t, busy, onSetEnabled }: EnableSwitchProps): PageNode {
    return jsx(Switch, {
      checked: pkg.enabled,
      label: t("enableToggle", { name: title }),
      disabled:
        busy ||
        pkg.readOnlyReason !== undefined ||
        (!pkg.enabled && pkg.error !== undefined && !(pkg.availability === "missing" && pkg.installTarget !== undefined)),
      ...(pkg.readOnlyReason === undefined ? {} : { title: managementText({ code: pkg.readOnlyReason }, t) }),
      onChange: onSetEnabled,
    });
  }

  /** Trạng thái một card mang: đang chạy, đang tắt, hoặc một trục trặc Host báo. */
  function packageStatus(pkg: PackageView): "problem" | "running" | "disabled" {
    if (pkg.error !== undefined) return "problem";
    return pkg.enabled ? "running" : "disabled";
  }

  /** Đầu mỗi trang: đường dẫn quay lại, rồi icon với các hành động của trang ở bên phải. */
  function DetailTop({ crumbLabel, crumbText, onBack, icon, actions }: DetailTopProps): PageNode {
    return jsxs("div", {
      className: css.detailTop,
      "data-window-drag": true,
      children: [
        jsxs("button", {
          type: "button",
          className: css.crumb,
          "aria-label": crumbLabel,
          onClick: onBack,
          children: [
            jsx(IconChevronDownOutlineRegular, { className: css.crumbIcon, "aria-hidden": "true" }),
            jsx("span", { children: crumbText }),
          ],
        }),
        jsxs("div", {
          className: css.detailHead,
          children: [jsx("span", { className: css.cardIcon, "aria-hidden": "true", children: icon }), actions],
        }),
      ],
    });
  }

  /** Gói có bản cập nhật đang chờ hay không. */
  function updateAvailable(pkg: PackageView): boolean {
    const target = pkg.installTarget;
    if (!pkg.installed || !pkg.removable || pkg.availability === "installation" || target === undefined) return false;
    return (
      pkg.version !== target.version ||
      ((target.spec.startsWith("link:") || pkg.source?.startsWith("link:") === true) && pkg.source !== target.spec)
    );
  }

  /** Một row như các slot chi tiết thấy. */
  function rowRef(row: PackageRowView): { rowId: string; moduleName: string; enabled: boolean } {
    return { rowId: row.rowId, moduleName: row.moduleName, enabled: row.enabled };
  }

  /** Một gói như các slot chi tiết thấy. */
  function packageRef(pkg: PackageView): {
    name: string;
    version?: string;
    installed: boolean;
    availability: AvailabilityView;
    official: boolean;
    enabled: boolean;
    rows: readonly { rowId: string; moduleName: string; enabled: boolean }[];
  } {
    return {
      name: pkg.name,
      ...(pkg.version === undefined ? {} : { version: pkg.version }),
      installed: pkg.installed,
      availability: pkg.availability,
      official: pkg.official,
      enabled: pkg.enabled,
      rows: pkg.rows.map(rowRef),
    };
  }

  /** Trang một plugin chính thức: đường dẫn quay lại, icon với hành động đóng góp, tiêu đề với badge đóng góp trên dòng mô tả, form và các section đóng góp. */
  function ItemDetail({ item, t, onBack, renderSlot, form }: ItemDetailProps): PageNode {
    const subject = { kind: "item", id: item.id };
    return jsxs("div", {
      className: css.detail,
      "data-plugin-item-detail": item.id,
      children: [
        jsx(DetailTop, {
          crumbLabel: t("backToList"),
          crumbText: t("crumbRoot"),
          onBack,
          icon: itemArtwork(item.id),
          actions: jsx("div", { className: css.detailActions, children: renderSlot("plugins.detail.actions", { subject }) }),
        }),
        jsxs("div", {
          className: css.detailMain,
          children: [
            jsxs("div", {
              className: css.titleRow,
              children: [
                jsx("h3", { className: css.detailTitle, children: item.label }),
                renderSlot("plugins.detail.badge", { subject }),
              ],
            }),
            jsx("p", { className: css.detailDesc, children: renderSlot("plugins.item", { view: "summary" }, { only: item.id }) }),
          ],
        }),
        jsxs("div", {
          className: css.detailSections,
          children: [
            jsx("section", {
              className: css.detailSection,
              "data-plugin-config": true,
              children: renderSlot("plugins.item", { view: "page", form }, { only: item.id }),
            }),
            renderSlot("plugins.detail.section", { subject }),
          ],
        }),
      ],
    });
  }

  /** Trang cấu hình một row giữ danh tính kỹ thuật của row bên cạnh văn bản cục bộ của gói và form do entry cấu hình cấp. */
  function RowDetail({ pkg, row, t, resolveText, onBack, renderSlot, form }: RowDetailProps): PageNode {
    const { title } = packageText(pkg, resolveText);
    const { title: rowTitle, description } = rowText(row, resolveText);
    const key = rowConfigKey(pkg.name, row.rowId);
    const subject = { kind: "row", pkg: packageRef(pkg), row: rowRef(row) };
    return jsxs("div", {
      className: css.detail,
      "data-plugin-row-detail": key,
      children: [
        jsx(DetailTop, {
          crumbLabel: t("backToPackage", { name: title }),
          crumbText: title,
          onBack,
          icon: jsx(PackageArtwork, { src: row.meta?.icon, row: true, size: CARD_ARTWORK_SIZE }, row.meta?.icon),
          actions: jsx("div", { className: css.detailActions, children: renderSlot("plugins.detail.actions", { subject }) }),
        }),
        jsxs("div", {
          className: css.detailMain,
          children: [
            jsxs("div", {
              className: css.titleRow,
              children: [
                jsx("h3", { className: css.detailTitle, children: rowTitle }),
                renderSlot("plugins.detail.badge", { subject }),
              ],
            }),
            rowTitle === row.rowId ? null : jsx("p", { className: css.detailName, children: jsx("code", { children: row.rowId }) }),
            jsx("p", { className: css.detailName, children: jsx("code", { children: row.moduleName }) }),
            jsx("p", {
              className: css.detailDesc,
              children: description ?? renderSlot("plugins.row.config", { view: "summary" }, { entryKey: key }),
            }),
          ],
        }),
        jsx(MetadataError, { error: row.meta?.error, t }),
        jsxs("div", {
          className: css.detailSections,
          "data-plugin-config": true,
          children: [
            renderSlot("plugins.row.config", { view: "page", form }, { entryKey: key }),
            renderSlot("plugins.detail.section", { subject }),
          ],
        }),
      ],
    });
  }

  /**
   * Trang một gói: đường dẫn quay lại danh sách; icon với công tắc và, với gói profile đã cài hoặc lựa chọn
   * Host gỡ được, nút gỡ; tiêu đề cạnh nhãn phiên bản, nhãn beta và nhãn trục trặc; tên gói mà tiêu đề đại diện;
   * dòng mô tả; trục trặc Host báo; cấu hình gói tự đăng ký; các row với công tắc và nút cấu hình; và nguồn gói.
   */
  function PackageDetail({
    pkg,
    t,
    resolveText,
    busy,
    rowBusy,
    configured,
    configure,
    renderSlot,
    inMore,
    onBack,
    onSetEnabled,
    onUninstall,
    onUpdate,
    onSetRowEnabled,
  }: PackageDetailProps): PageNode {
    const { title, description, beta } = packageText(pkg, resolveText);
    const status = packageStatus(pkg);
    const subject = { kind: "bundle", pkg: packageRef(pkg) };
    return jsxs("div", {
      className: css.detail,
      "data-plugin-detail": pkg.name,
      children: [
        jsx(DetailTop, {
          crumbLabel: inMore ? t("backToPackage", { name: t("moreTitle") }) : t("backToList"),
          crumbText: t(inMore ? "moreTitle" : "crumbRoot"),
          onBack,
          icon: jsx(PackageArtwork, { src: pkg.meta?.icon }, pkg.meta?.icon),
          actions: jsxs("div", {
            className: css.detailActions,
            children: [
              renderSlot("plugins.detail.actions", { subject }),
              updateAvailable(pkg)
                ? jsx(Button, {
                    variant: "outline",
                    size: "sm",
                    icon: jsx(IconRefreshOutlineRegular, { size: 13 }),
                    disabled: busy,
                    "aria-label": t("updateLabel", { name: title }),
                    onClick: onUpdate,
                    children: t("update"),
                  })
                : null,
              pkg.installed || pkg.removable
                ? jsx(Button, {
                    variant: "outline",
                    size: "sm",
                    className: css.danger,
                    icon: jsx(IconTrashOutlineRegular, { size: 13 }),
                    "aria-label": t("uninstallLabel", { name: title }),
                    disabled: busy || !pkg.removable || pkg.readOnlyReason !== undefined,
                    onClick: onUninstall,
                    children: t("uninstall"),
                  })
                : null,
              jsx(EnableSwitch, { pkg, title, t, busy, onSetEnabled }),
            ],
          }),
        }),
        jsxs("div", {
          className: css.detailMain,
          children: [
            jsxs("div", {
              className: css.titleRow,
              children: [
                jsx("h3", { className: css.detailTitle, children: title }),
                pkg.version === undefined
                  ? null
                  : jsx(Tag, { className: css.versionTag, tone: "neutral", children: t("versionTag", { version: pkg.version }) }),
                beta ? jsx(Tag, { className: css.statusTag, tone: "info", children: t("statusBeta") }) : null,
                status === "problem" ? jsx(Tag, { className: css.statusTag, tone: "danger", children: t("statusProblem") }) : null,
                pkg.availability === "missing"
                  ? jsx(Tag, { className: css.statusTag, children: t(pkg.installed ? "statusMissingFiles" : "statusNotInstalled") })
                  : null,
                updateAvailable(pkg)
                  ? jsx(Tag, { className: css.statusTag, tone: "info", children: t("statusUpdateAvailable") })
                  : null,
                renderSlot("plugins.detail.badge", { subject }),
              ],
            }),
            jsx("p", { className: css.detailName, children: jsx("code", { "data-plugin-name": true, children: pkg.name }) }),
            description === undefined ? null : jsx("p", { className: css.detailDesc, children: description }),
          ],
        }),
        jsx(MetadataError, { error: pkg.meta?.error, t }),
        pkg.error === undefined
          ? null
          : jsxs("p", { className: css.reason, role: "status", children: [t("reasonLabel"), ": ", managementText(pkg.error, t)] }),
        pkg.readOnlyReason === undefined
          ? null
          : jsx("p", { className: css.reason, role: "status", children: managementText({ code: pkg.readOnlyReason }, t) }),

        jsxs("div", {
          className: css.detailSections,
          children: [
            configured
              ? jsx("section", {
                  className: css.detailSection,
                  "data-plugin-config": true,
                  children: renderSlot("plugins.bundle.config", { view: "page" }, { entryKey: pkg.name }),
                })
              : null,
            pkg.availability === "missing"
              ? null
              : jsx(RowsSection, {
                  rows: pkg.rows,
                  t,
                  resolveText,
                  toggle: pkg.enabled ? { busy: (row) => busy || rowBusy(row), onSetEnabled: onSetRowEnabled } : undefined,
                  configure,
                }),
            jsx(SourceSection, { pkg, t }),
            renderSlot("plugins.detail.section", { subject }),
          ],
        }),
      ],
    });
  }

  return {
    PackageArtwork,
    MetadataError,
    DetailTop,
    EnableSwitch,
    packageStatus,
    updateAvailable,
    RowsSection,
    ItemDetail,
    RowDetail,
    PackageDetail,
    itemArtwork,
  };
}

