/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Kieu cau truc cho cac dich vu ma row nay cham vao (form cai dat · store · remote)
 */

/** Nguồn ảnh chụp chỉ đọc. */
export interface Readable<T> {
  /** Ảnh chụp hiện tại. */
  getSnapshot: () => T;
  /** Đăng ký người nghe; trả hàm gỡ. */
  subscribe: (listener: () => void) => () => void;
}

/** Store ghi được (createSnapshotStore của dsh-client-store). */
export interface WritableStore<T> extends Readable<T> {
  /** Ghi ảnh chụp mới. */
  set: (next: T) => void;
}

/** Một phép ghi vào tài liệu cài đặt. */
export interface ConfigMutation {
  /** Toán tử. */
  readonly op: string;
  /** Đường dẫn trong tài liệu. */
  readonly path: readonly string[];
  /** Giá trị mới. */
  readonly value: unknown;
}

/** Ảnh chụp của một mục cài đặt do Host sở hữu. */
export interface SettingsSectionSnapshot<V> {
  /** Trạng thái nạp. */
  readonly status: string;
  /** Có ghi được không. */
  readonly writable: boolean;
  /** Revision của tài liệu. */
  readonly revision: number;
  /** Giá trị hiện tại (vắng khi mục chưa được phục vụ). */
  readonly value?: V;
}

/** Mục cài đặt do Host phục vụ (do `ctx.configForms.get(ns)` trả về). */
export interface SettingsSection<V> extends Readable<SettingsSectionSnapshot<V>> {
  /** Ghi một loạt thay đổi theo revision đã đọc. */
  mutate: (operations: readonly ConfigMutation[], revision: number | undefined) => Promise<unknown>;
}

/** Một trường số trong form cài đặt. */
export interface NumberFieldDescriptor {
  /** Phân giải văn bản người dùng thành phép ghi, hoặc undefined khi không hợp lệ. */
  parse: (text: string) => { readonly kind: string; readonly value?: number } | undefined;
}

/** Mô hình form cài đặt của bộ nguyên thuỷ (`SettingsFormModel`). */
export interface FormModelLike {
  /** Vỏ trạng thái dùng chung (available/writable/dirty/invalid/saving/failed). */
  shell: () => Record<string, unknown>;
  /** Ảnh chụp một trường đã staged. */
  field: (name: string) => unknown;
  /** Tạo store theo dõi ảnh chụp form. */
  bind: (select: () => unknown) => unknown;
  /** Tập action (edit/resetField/save/discard). */
  actions: () => Record<string, unknown>;
  /** Gỡ mọi đăng ký. */
  dispose: () => void;
}

/** Phụ thuộc bộ nguyên thuỷ mà ba controller dùng. */
export interface SubagentPrimitives {
  /** Dựng một trường số. */
  settingsNumberField: (field: unknown) => NumberFieldDescriptor;
  /** Dựng mô hình form cài đặt. */
  SettingsFormModel: new (scope: unknown, fields: readonly unknown[]) => FormModelLike;
  /** Dựng store ảnh chụp. */
  createSnapshotStore: <T>(initial: T) => WritableStore<T>;
}

/** Một tuyến provider/model. */
export interface ModelRoute {
  /** Id nhà cung cấp. */
  readonly provider: string;
  /** Id model. */
  readonly model: string;
}

/** Một dòng ứng viên trong danh sách model của thẻ. */
export interface ModelCandidate extends ModelRoute {
  /** Khoá định danh (không bao giờ tự phân tích). */
  readonly key: string;
  /** Tên nhà cung cấp để hiển thị. */
  readonly providerName: string;
  /** Tên model để hiển thị. */
  readonly modelName: string;
  /** Có trong danh mục đang sống không. */
  readonly available: boolean;
  /** Đang được chọn trong bản nháp không. */
  readonly selected: boolean;
}

/** Một nhóm model theo nhà cung cấp trong danh mục sống. */
export interface ModelGroup {
  /** Id nhà cung cấp. */
  readonly id: string;
  /** Tên nhà cung cấp. */
  readonly name: string;
  /** Các model. */
  readonly models: readonly { readonly id: string; readonly name: string }[];
}
