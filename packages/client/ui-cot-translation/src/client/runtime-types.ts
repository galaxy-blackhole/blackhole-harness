/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bề mặt các seed nền tảng mà nửa client nhận qua require của factory (zod · react · jsx-runtime · primitives · store)
 */

/** Hàm nạp module do bảng module của vỏ cấp cho factory (không import tĩnh gói nền tảng). */
export type RequireFn = (specifier: string) => unknown;

/** Một schema zod mà spec Remote dùng (chỉ phần bề mặt có trong bản gốc). */
export interface ZodSchemaLike {
  /** Gắn mô tả cho người đọc (nguyên văn chuỗi của bản gốc). */
  describe(text: string): ZodSchemaLike;
  /** Đánh dấu trường chỉ đọc trên đường truyền. */
  readonly(): ZodSchemaLike;
  /** Cho phép vắng mặt. */
  optional(): ZodSchemaLike;
  /** Bắt buộc có mặt. */
  nonoptional(): ZodSchemaLike;
}

/** Namespace `zod.z` — đủ hàm dựng mà spec Remote và form dùng. */
export interface ZodNamespaceLike {
  /** Object thường. */
  object(shape: Record<string, ZodSchemaLike>): ZodSchemaLike;
  /** Object nghiêm ngặt (từ chối khoá lạ). */
  strictObject(shape: Record<string, ZodSchemaLike>): ZodSchemaLike;
  /** Chuỗi. */
  string(): ZodSchemaLike;
  /** Số. */
  number(): ZodSchemaLike;
  /** Hằng chuỗi. */
  literal(value: string): ZodSchemaLike;
  /** Hợp các schema. */
  union(items: ZodSchemaLike[]): ZodSchemaLike;
  /** Mảng. */
  array(item: ZodSchemaLike): ZodSchemaLike;
}

/** Module `zod` do vỏ cấp (namespace nằm ở `z`, đúng như bản gốc require). */
export interface ZodModuleLike {
  /** Namespace dựng schema. */
  z: ZodNamespaceLike;
}

/** Bề mặt React mà hai component của row dùng. */
export interface ReactLike {
  /** State cục bộ + hàm đặt lại (bản gốc chỉ dùng giá trị khởi tạo trực tiếp). */
  useState<T>(initial: T): [T, (next: T | ((previous: T) => T)) => void];
  /** Ref cục bộ. */
  useRef<T>(initial?: T): { current: T | undefined };
  /** Hiệu ứng vòng đời kèm danh sách phụ thuộc (dọn dẹp tuỳ chọn). */
  useEffect(effect: () => void | (() => void), dependencies?: readonly unknown[]): void;
  /** Giá trị nhớ kèm danh sách phụ thuộc. */
  useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T;
  /** Id ổn định cho nhãn/ô nhập. */
  useId(): string;
}

/** Bề mặt jsx runtime (react-jsx) mà bundle gọi trực tiếp. */
export interface JsxRuntimeLike {
  /** Dựng element một con; tham số thứ ba là key (bản gốc dùng cho danh sách option). */
  jsx(type: unknown, props: object, key?: unknown): unknown;
  /** Dựng element nhiều con. */
  jsxs(type: unknown, props: object, key?: unknown): unknown;
  /** Mảnh bọc nhiều con. */
  Fragment: unknown;
}

/** Scope cài đặt đã bind cho namespace cot-translation. */
export interface SettingsScopeLike {
  /** Ảnh chụp cài đặt hiện tại. */
  getSnapshot(): unknown;
  /** Nghe thay đổi của scope; trả hàm huỷ. */
  subscribe(listener: () => void): () => void;
}

/** Mô hình form cài đặt dùng chung của khung Plugins. */
export interface SettingsFormModelLike {
  /** Ảnh chụp chung của form (trạng thái ghi, bẩn, lỗi). */
  shell(): Record<string, unknown>;
  /** Ảnh chụp một ô theo tên. */
  field(name: string): unknown;
  /** Các hành động của form (lưu, bỏ, sửa, khôi phục). */
  actions(): Record<string, unknown>;
  /** Bind store quan sát được từ một phép chiếu. */
  bind(project: () => unknown): unknown;
  /** Nhả mọi đăng ký của form. */
  dispose(): void;
}

/** Bề mặt bộ primitive mà hai component của row dùng. */
export interface PrimitivesLike {
  /** Nút bấm. */
  Button: unknown;
  /** Icon vòng quay. */
  IconLoadingOutlineRegular: unknown;
  /** Khung form cài đặt. */
  SettingsForm: unknown;
  /** Ô giá trị có nhãn "đã ghi đè" + nút khôi phục. */
  SettingsValueField: unknown;
  /** Nhãn nhỏ. */
  Tag: unknown;
  /** Mô hình form cài đặt. */
  SettingsFormModel: new (scope: SettingsScopeLike, fields: unknown[]) => SettingsFormModelLike;
  /** Khai một ô văn bản trong form. */
  settingsTextField(name: string): Record<string, unknown>;
}

/** Store ảnh chụp do vỏ cấp. */
export interface SnapshotStoreLike<T> {
  /** Đọc ảnh chụp hiện tại. */
  getSnapshot(): T;
  /** Ghi ảnh chụp mới. */
  set(value: T): void;
}

/** Module store của vỏ (chỉ phần row này dùng). */
export interface ClientStoreLike {
  /** Tạo store ảnh chụp từ giá trị đầu. */
  createSnapshotStore<T>(initial: T): SnapshotStoreLike<T>;
}
