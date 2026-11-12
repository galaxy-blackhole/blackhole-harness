/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hình dạng SEAM kho lưu trữ mà tầng miền gọi (`ctx.storage`: sổ backend + `mount`), khai theo
 *      CẤU TRÚC — cùng mẫu `session-projection-cache`. Kèm hai hằng của seam: mẫu tên đơn vị
 *      `UNIT_NAME_RE` và `storageBackendServiceKey`. Vì sao KHÔNG import gói kho: đọc README gói §4.
 */

/** Mẫu hợp lệ cho tên miền và tên bảng (nguyên văn giá trị của `@deepseek-ai/dsh-storage`). */
export const UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/;

/**
 * Suy ra khoá service vòng đời cordis của MỘT backend có tên (nguyên văn hành vi của gói kho).
 * Nhận: tên backend trong sổ (ví dụ `json`).
 * Trả: khoá dạng `storage.backend.<tên>` mà lượt chờ kích hoạt dùng để không đua với lượt đăng ký.
 */
export function storageBackendServiceKey(name: string): string {
  return `storage.backend.${name}`;
}

/** Định danh tĩnh + hình dạng của MỘT đơn vị KV, chiếu từ spec của chủ sở hữu. */
export interface KvUnitDescriptorLike {
  /** Tên đơn vị; phải khớp {@link UNIT_NAME_RE}. */
  readonly name: string;
  /** Phiên bản định dạng đơn vị; số nguyên không âm. */
  readonly version: number;
  /** Tên các bảng đã khai. */
  readonly tables: readonly string[];
  /** Đơn vị có ô singleton toàn cục hay không. */
  readonly hasGlobal: boolean;
  /** Cách bố trí trên môi trường lưu: `single` (mặc định) hay `per-record`. */
  readonly layout?: "single" | "per-record";
  /** Các phiên bản đơn vị CŨ mà bản ghi đã lưu vẫn đọc được. */
  readonly compatibleVersions?: readonly number[];
}

/** Một đơn vị KV ĐÃ MỞ: giá trị là JSON ĐỤC với tầng này (không schema, không sự kiện). */
export interface KvUnitLike {
  /**
   * Đọc ảnh chụp đầy đủ hiện tại.
   * Nhận: không.
   * Trả: bản ghi của mọi bảng theo tên bảng, cộng ô singleton toàn cục (`null` khi chưa ghi).
   */
  loadAll(): Promise<{ tables: Record<string, Record<string, unknown>>; global: unknown }>;
  /**
   * Ghi đè (upsert) MỘT bản ghi cho bền.
   * Nhận: tên bảng đã khai, khoá bản ghi, và giá trị JSON đục.
   * Trả: promise phân giải sau khi bản ghi đã bền.
   */
  putRecord(table: string, key: string, value: unknown): Promise<void>;
  /**
   * Xoá MỘT bản ghi cho bền; idempotent.
   * Nhận: tên bảng đã khai và khoá bản ghi.
   * Trả: promise phân giải sau khi đã xoá bền.
   */
  deleteRecord(table: string, key: string): Promise<void>;
  /**
   * Chuyển tài liệu đã lưu của MỘT bản ghi ra khỏi tập đọc được của đơn vị.
   * Nhận: tên bảng đã khai và khoá bản ghi.
   * Trả: vị trí trên môi trường lưu mà tài liệu đã được chuyển tới (chẩn đoán).
   */
  backupRecord?(table: string, key: string): Promise<string>;
  /**
   * Ghi ô singleton toàn cục cho bền.
   * Nhận: giá trị JSON đục.
   * Trả: promise phân giải sau khi giá trị đã bền.
   */
  setGlobal(value: unknown): Promise<void>;
  /**
   * Xả các lượt ghi đang chạy rồi nhả đơn vị này; idempotent.
   * Nhận: không.
   * Trả: promise phân giải sau khi đơn vị đã được nhả.
   */
  close(): Promise<void>;
}

/** Hình dạng dữ liệu khoá–giá trị của một backend: mở một đơn vị. */
export interface KvFacetLike {
  /**
   * Mở một đơn vị, tự tạo khi môi trường lưu chưa có dấu vết nào của nó.
   * Nhận: mô tả tĩnh của đơn vị cần mở.
   * Trả: đơn vị đã mở.
   */
  open(descriptor: KvUnitDescriptorLike): Promise<KvUnitLike>;
}

/** Một backend đã đăng ký trong kho; `kv` là facet TUỲ CHỌN. */
export interface StorageBackendLike {
  /** Thao tác khoá–giá trị; VẮNG khi backend không phục vụ được loại dữ liệu này. */
  readonly kv?: KvFacetLike;
  /**
   * Nhả môi trường lưu của backend.
   * Nhận: không.
   * Trả: promise phân giải sau khi môi trường lưu đã được nhả.
   */
  close(): Promise<void>;
}

/** Sổ backend có tên của kho. */
export interface BackendRegistryLike {
  /**
   * Giải một backend theo tên.
   * Nhận: tên backend đã đăng ký.
   * Trả: thể hiện backend; chưa đăng ký thì NÉM `StorageError('backend-not-found')` của gói kho.
   */
  get(name: string): StorageBackendLike;
}

/** Bề mặt kho lưu trữ (`ctx.storage`) mà tầng miền chạm tới — khai theo cấu trúc, đúng hai thành viên. */
export interface StorageHubLike {
  /** Sổ backend có tên. */
  readonly backend: BackendRegistryLike;
  /**
   * Mount một dạng dữ liệu lên kho.
   * Nhận: khoá dạng (`domain`) và thể hiện facility cần phơi.
   * Trả: hàm dọn tháo dạng đó ra; mount trùng khoá thì NÉM `duplicate-mount`.
   */
  mount(form: string, facility: unknown): () => void;
}

/**
 * Lấy kho lưu trữ từ một context cordis — ĐÚNG MỘT phép ép kiểu ở ranh giới seam.
 * Nhận: context cordis (của plugin hoặc của lượt chờ backend).
 * Trả: bề mặt {@link StorageHubLike}; context không có `storage` thì giá trị là `undefined` như mọi
 *      service chưa cấp (lượt gọi sau đó sẽ ném `TypeError` y như bản gốc).
 */
export function storageHubOf(ctx: unknown): StorageHubLike {
  return (ctx as { storage: StorageHubLike }).storage;
}
