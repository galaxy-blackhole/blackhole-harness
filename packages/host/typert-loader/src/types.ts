/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hình dạng dữ liệu của row typert-loader: vật thể `TYPERT` do gói plugin sinh ra, và các seam
 *      mà bộ nạp chạm tới (loader · typert · pluginPackages · logger). Bản gốc lấy các kiểu này từ
 *      `dsh-typert-registry` và `cordis-plugin-loader` — cả hai NGOÀI bảng peer §3b — nên ở đây
 *      khai lại theo CẤU TRÚC, đúng phần row này chạm tới (không tạo thể hiện thứ hai).
 */

/** Một nhãn JSDoc có cấu trúc do bộ sinh giữ lại. */
export interface TypertDocTag {
  /** Tên nhãn, ví dụ `param`. */
  readonly name: string;
  /** Tham số của nhãn, nếu có. */
  readonly argument?: string;
  /** Chú thích của nhãn, nếu có. */
  readonly comment?: string;
  /** Toàn văn nhãn. */
  readonly text: string;
}

/** Tài liệu nguồn còn giữ trên phần tử được phản chiếu. */
export interface TypertDocumentation {
  /** Mô tả đầy đủ. */
  readonly description?: string;
  /** Tóm tắt một dòng. */
  readonly summary?: string;
  /** Nhãn JSDoc có cấu trúc. */
  readonly tags: readonly TypertDocTag[];
  /** Nguyên văn khối JSDoc. */
  readonly jsDoc?: string;
}

/** Một chữ ký thành viên công khai do bộ sinh tạo. */
export interface TypertMemberModel {
  /** Loại thành viên. */
  readonly kind: string;
  /** Tên thành viên. */
  readonly name: string;
  /** Chữ ký TypeScript. */
  readonly signature: string;
}

/** Một khai báo kiểu có tên được bề mặt nghiệp vụ tham chiếu. */
export interface TypertTypeModel {
  /** Tên kiểu. */
  readonly name: string;
  /** Khai báo TypeScript. */
  readonly declaration: string;
}

/** Phản chiếu lúc chạy của một service Cordis. */
export interface TypertServiceModel extends TypertDocumentation {
  /** Khoá service trên context, ví dụ `typert`. */
  readonly key: string;
  /** Tên export của lớp service. */
  readonly exportName: string;
  /** Các thành viên công khai. */
  readonly members: readonly TypertMemberModel[];
  /** Các khai báo kiểu đi kèm. */
  readonly types: readonly TypertTypeModel[];
}

/** Phản chiếu lúc chạy của một sự kiện Cordis. */
export interface TypertEventModel extends TypertDocumentation {
  /** Tên sự kiện, ví dụ `loader/volatile-update`. */
  readonly name: string;
  /** Chế độ phát, khi có. */
  readonly mode?: string;
  /** Chữ ký listener. */
  readonly signature: string;
}

/** Phản chiếu lúc chạy của một vật thể tham chiếu được export tường minh. */
export interface TypertObjectModel extends TypertDocumentation {
  /** Tên vật thể. */
  readonly name: string;
  /** Tên export của vật thể. */
  readonly exportName: string;
  /** Các thành viên công khai. */
  readonly members: readonly TypertMemberModel[];
  /** Các khai báo kiểu đi kèm. */
  readonly types: readonly TypertTypeModel[];
}

/** Phản chiếu nghiệp vụ đã sinh cho MỘT gói trên MỘT mặt. */
export interface TypertPackageModel {
  /** Các service được phản chiếu. */
  readonly services: readonly TypertServiceModel[];
  /** Các sự kiện được phản chiếu. */
  readonly events: readonly TypertEventModel[];
  /** Các vật thể được phản chiếu. */
  readonly objects: readonly TypertObjectModel[];
}

/** Một nhà máy schema Zod do bộ sinh tạo. */
export interface TypertSchemaFactory {
  /** Tên schema, ví dụ `SessionHeader`. */
  readonly name: string;
  /** Dựng và trả schema của realm hiện tại ở lần dùng đầu tiên. */
  readonly create: () => unknown;
}

/** Một đóng góp của gói, được đăng ký và gỡ ĐÚNG NGUYÊN một lần. */
export interface TypertContribution {
  /** Tên package sở hữu đóng góp này. */
  readonly package: string;
  /** Mặt đã biên dịch độc lập: bộ nạp này chỉ nhận mặt `host`. */
  readonly face: string;
  /** Các nhà máy schema. */
  readonly schemas: readonly TypertSchemaFactory[];
  /** Phản chiếu nghiệp vụ của gói. */
  readonly model: TypertPackageModel;
  /** Định nghĩa lời gọi Remote của mặt host; rỗng khi gói không export phương thức Remote nào. */
  readonly invocations: readonly unknown[];
}

/** Một entry của Loader mà bộ nạp này quan sát. */
export interface LoaderEntrySeam {
  /** Tuỳ chọn của entry; `name` là specifier của gói plugin. */
  readonly options: { readonly name: string };
  /** Fiber đang chạy của entry; `undefined` khi entry chưa được nạp. */
  readonly fiber?: unknown;
  /** Cờ tắt của entry (đã tính cả entry cha). */
  readonly disabled: boolean;
}

/** Seam `loader`: cây entry đang sống của bộ nạp plugin. */
export interface LoaderSeam {
  /** Duyệt mọi entry trong cây, kể cả cây con. */
  entries(): Iterable<LoaderEntrySeam>;
}

/** Một package đã được bảng gói của profile giải. */
export interface ResolvedPluginPackage {
  /** Đường dẫn tuyệt đối tới `package.json`. */
  readonly manifestPath: string;
  /** Manifest đã đọc sẵn, khi bảng gói có sẵn nó. */
  readonly manifest?: Record<string, unknown>;
}

/** Seam `pluginPackages`: bảng gói của profile (có thể vắng ở lab tối thiểu). */
export interface PluginPackagesSeam {
  /** Tra gói sở hữu một specifier theo thứ tự tra của Node từ `parentURL`. */
  packageOf(specifier: string, parentURL: string): ResolvedPluginPackage | undefined;
}

/** Seam `typert`: sổ đăng ký phản chiếu mà bộ nạp này nuôi. */
export interface TypertRegistrySeam {
  /** Đăng ký ĐÚNG NGUYÊN một đóng góp; trả hàm gỡ đăng ký đó (bất đồng bộ, đúng hợp đồng `TypertDisposer`). */
  register(contribution: TypertContribution): () => Promise<void>;
}

/** Log của kernel — chỉ phần bộ nạp này dùng. */
export interface TypertLoaderLogger {
  /** Ghi một lỗi (đối tượng lỗi, không phải chuỗi) ra log của kernel. */
  error(error: unknown): void;
}

/** Context cordis mà plugin này dùng, khai theo CẤU TRÚC: bốn seam, không import gói seam nào. */
export interface TypertLoaderContext {
  /** Neo của cây cấu hình, dùng để `createRequire` và tra gói plugin. */
  readonly baseUrl?: string;
  /** Seam `loader`: đọc TRỰC TIẾP như bản gốc (`ctx.loader.entries()`). */
  readonly loader: LoaderSeam;
  /** Seam `typert`: đọc TRỰC TIẾP như bản gốc (`ctx.typert.register()`). */
  readonly typert: TypertRegistrySeam;
  /** Log của kernel. */
  readonly logger: TypertLoaderLogger;
  /** Tra service theo tên; trả `undefined` khi service vắng. */
  get(name: string): unknown;
  /** Đăng ký listener cho một sự kiện kernel; trả hàm gỡ đăng ký. */
  on(event: "internal/plugin", listener: (fiber: unknown) => void): () => void;
  /** Chạy một hiệu ứng có hàm dọn; cordis gọi hàm dọn khi plugin unload. */
  effect(execute: () => Iterable<() => void>, label?: string): unknown;
}
