/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Mặt KIỂU dùng chung của row agent-preset-registry: định nghĩa preset, hàng entry Cordis lồng nhau,
 *      bản chụp composition/module, audit mount, và các seam mà registry chạm tới (khai theo CẤU TRÚC).
 */

/** Một hàng entry Cordis đã parse từ YAML (đúng hình dạng Loader dùng, lồng qua `group`). */
export interface EntryRow {
  /** Id tuỳ chọn của hàng. */
  readonly id?: string;
  /** Tên plugin (trường bắt buộc). */
  readonly name: string;
  /** `true` khi hàng là NHÓM, con nằm ở `config`. */
  readonly group?: boolean;
  /** Node disabled thô (literal hoặc `!!js` expression). */
  readonly disabled?: unknown;
  /** Danh sách hàng con khi đây là nhóm. */
  readonly config?: readonly EntryRow[];
}

/** Định nghĩa một preset agent do row khai báo (khớp Config của plugin `agent-preset`). */
export interface PresetDefinition {
  /** Danh tính preset (không rỗng, duy nhất). */
  readonly id: string;
  /** Tên hiển thị tuỳ chọn. */
  readonly name?: string;
  /** Mô tả tuỳ chọn. */
  readonly description?: string;
  /** Thứ tự hiển thị tuỳ chọn (số nhỏ trước, thiếu = cuối). */
  readonly order?: number;
  /** Danh sách plugin con mà preset này mount. */
  readonly plugins: readonly EntryRow[];
}

/** Một module ĐANG hoạt động trong composition của một revision. */
export interface ActiveModule {
  /** Tên module (tên package plugin). */
  readonly moduleName: string;
  /** Base URL nơi module được nạp (nếu composition gốc có). */
  readonly baseUrl?: string;
  /** `true` khi module dùng base URL của Host thay vì của cây preset. */
  readonly useHostBase: boolean;
}

/** Một hàng composition đã làm phẳng để chẩn đoán. */
export interface CompositionRow {
  /** Id hàng (null khi hàng không khai id). */
  readonly entryId: string | null;
  /** Tên module của hàng. */
  readonly moduleName: string;
  /** Trạng thái bật: `conditional` khi phụ thuộc biểu thức `!!js`. */
  readonly enabled: boolean | "conditional";
  /** Biểu thức điều kiện nguyên văn khi hàng có `!!js`. */
  readonly condition?: string;
  /** Trạng thái fiber của hàng trong cây đang sống (nếu đã mount). */
  readonly fiberState?: unknown;
}

/** Kết quả audit một cây preset đã mount. */
export interface RowAudit {
  /** Các hàng hỏng (không khởi động được), mỗi dòng một lý do. */
  readonly failed: string[];
  /** Các hàng đang chờ service mà composition không cấp. */
  readonly pending: string[];
}

/** Một revision preset đang được giữ cho các Agent chọn nó. */
export interface PresetMount {
  /** Danh tính preset. */
  readonly presetId: string;
  /** Fiber gốc của cây preset đã mount. */
  readonly fiber: unknown;
  /** Cây entry của revision. */
  readonly tree: MountedTree;
  /** Khoá scope của revision (định danh theo vật thể). */
  readonly key: object;
}

/** Bề mặt tối thiểu của cây entry đã mount mà row này đọc. */
export interface MountedTree {
  /** Chờ cây ổn định. */
  await(): Promise<void>;
  /** Duyệt các entry của cây. */
  entries(): Iterable<MountedEntry>;
  /** Context sở hữu cây. */
  readonly ctx: { readonly baseUrl?: string; readonly fiber: { readonly entry?: { readonly id: string } } };
}

/** Một entry trong cây đã mount. */
export interface MountedEntry {
  /** Id đầy đủ của entry. */
  readonly id: string;
  /** Tuỳ chọn entry (name/id/disabled/group). */
  readonly options: { readonly id: string; readonly name: string; readonly group?: boolean; readonly disabled?: unknown };
  /** Fiber của entry (nếu đã khởi động). */
  readonly fiber?: { readonly state: unknown; readonly inject: Record<string, unknown>; readonly ctx: { get(name: string): unknown }; await(): Promise<void> };
  /** `true` khi entry bị tắt. */
  readonly disabled: boolean;
  /** Cây cha sở hữu entry. */
  readonly parent: { readonly tree: { readonly ctx: { readonly baseUrl?: string } } };
}

/** Một bản chụp composition của revision đang giữ (hiển thị cho inventory). */
export interface AgentPresetInspection {
  /** Danh tính preset. */
  readonly id: string;
  /** Module đang hoạt động. */
  readonly modules: readonly ActiveModule[];
  /** Service rò khỏi realm của preset. */
  readonly leakedServices: readonly string[];
}

/** Hàng hiển thị của roster preset (khớp `list()` của bản gốc). */
export interface PresetRow {
  /** Danh tính. */
  readonly id: string;
  /** Tên hiển thị nếu có. */
  readonly name?: string;
  /** Mô tả nếu có. */
  readonly description?: string;
  /** Thứ tự nếu có. */
  readonly order?: number;
  /** Chẩn đoán khi preset hỏng. */
  readonly broken?: string;
  /** `true` khi là preset mặc định (chỉ trong `remoteExportList`). */
  readonly isDefault?: boolean;
}

/** Ngữ cảnh tối thiểu của registry (context cordis nhìn theo CẤU TRÚC). */
export interface RegistryContext {
  /** Fiber của plugin sở hữu registry. */
  readonly fiber: unknown;
  /** Logger của context. */
  logger: { warn(message: string): void };
  /** Loader của Host (để chờ cây ổn định). */
  readonly loader: { await(): Promise<void> };
  /** Sổ chiếu phiên (đọc `agentPreset` + `turnBoundary`). */
  readonly sessionProjections: { stateOf(session: unknown, key: string): unknown };
  /** Base URL của context (nếu có). */
  readonly baseUrl?: string;
  /** Đọc một service tuỳ chọn. */
  get(name: string): unknown;
  /** Nghe một sự kiện. */
  on(event: string, listener: (...args: never[]) => unknown): () => void;
  /** Tiêm service và chạy callback khi sẵn sàng. */
  inject(names: readonly string[], callback: (child: RegistryContext) => void): unknown;
  /** Đăng ký effect thuộc vòng đời plugin (label tuỳ chọn như bản gốc). */
  effect(callback: () => () => unknown, label?: string): unknown;
  /** Phát một sự kiện. */
  emit(event: string, ...args: never[]): void;
}