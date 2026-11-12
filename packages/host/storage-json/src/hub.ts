/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hình dạng SEAM kho lưu trữ mà backend JSON gọi (`ctx.storage.backend.register` + `ctx.provide`),
 *      khai theo CẤU TRÚC, kèm ba hằng của seam: `UNIT_NAME_RE`, `storageBackendServiceKey`, `StorageError`.
 *      Vì sao KHÔNG import gói kho: profile của app KHÔNG có gói kho GỐC (xem README gói §3).
 */
import type { Context } from "@deepseek-ai/cordis";

/**
 * Mã phân loại ỔN ĐỊNH mà kho và mọi backend dùng chung — đúng BẢY mã của bản gốc, không thêm không bớt.
 */
export type StorageErrorCode =
  | "backend-not-found"
  | "form-not-mounted"
  | "duplicate-backend"
  | "duplicate-mount"
  | "version-mismatch"
  | "malformed-medium"
  | "closed";

/**
 * Lỗi do kho và do các backend ném ra: `code` là hợp đồng ổn định để người dùng `switch`, `message` chỉ
 * là câu chẩn đoán. Đây là BẢN SAO TẠI CHỖ của lớp trong gói kho — `name`/`code`/`cause` và mọi câu
 * thông điệp đối chứng A/B với chính bundle gốc trong test của gói.
 */
export class StorageError extends Error {
  /** Mã phân loại của lần hỏng này — giá trị do nơi ném quyết định, không suy từ `message`. */
  readonly code: StorageErrorCode;

  /** Tên lớp cố định `StorageError` (đặt trên CHÍNH thể hiện, như bản gốc). */
  override readonly name = "StorageError";

  /**
   * Dựng một lỗi mang mã ổn định.
   * Nhận: mã lỗi, câu chẩn đoán cho người đọc, và tuỳ chọn lỗi chuẩn (`cause`).
   * Trả: thể hiện lỗi đã gắn `code`; `message`/`cause` do lớp `Error` giữ nguyên.
   */
  constructor(code: StorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}

/** Mẫu hợp lệ cho tên đơn vị và tên bảng — nguyên văn giá trị của gói kho (an toàn làm tên tệp). */
export const UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/;

/**
 * Suy ra khoá service vòng đời cordis của MỘT backend có tên.
 * Nhận: tên backend trong sổ (ví dụ `json`).
 * Trả: khoá dạng `storage.backend.<tên>` mà tầng nạp dùng để chờ lượt đăng ký backend.
 */
export function storageBackendServiceKey(name: string): string {
  return `storage.backend.${name}`;
}

/** Định danh tĩnh và hình dạng của MỘT đơn vị KV, chiếu từ spec của chủ sở hữu. */
export interface KvUnitDescriptorLike {
  /** Tên đơn vị; phải khớp {@link UNIT_NAME_RE}. */
  readonly name: string;
  /** Phiên bản định dạng đơn vị; đóng dấu lên môi trường lưu ở lần ghi đầu. */
  readonly version: number;
  /** Tên các bảng đã khai. */
  readonly tables: readonly string[];
  /** Đơn vị có mang ô singleton toàn cục hay không. */
  readonly hasGlobal: boolean;
  /** Cách bố trí trên môi trường lưu: `single` (mặc định) hay `per-record`. */
  readonly layout?: "single" | "per-record";
  /** Các phiên bản đơn vị CŨ mà bản ghi đã lưu vẫn đọc được dưới schema hiện tại. */
  readonly compatibleVersions?: readonly number[];
}

/** Một đơn vị KV ĐÃ MỞ; giá trị là JSON ĐỤC với tầng này (không schema, không sự kiện, không ngữ nghĩa miền). */
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
   * Xoá MỘT bản ghi cho bền; idempotent (khoá vắng là no-op).
   * Nhận: tên bảng đã khai và khoá bản ghi.
   * Trả: promise phân giải sau khi đã xoá bền.
   */
  deleteRecord(table: string, key: string): Promise<void>;
  /**
   * Chuyển tài liệu đã lưu của MỘT bản ghi ra khỏi tập đọc được, giữ nguyên byte để soát.
   * Nhận: tên bảng đã khai và khoá bản ghi.
   * Trả: vị trí trên môi trường lưu mà tài liệu đã được chuyển tới (chẩn đoán).
   */
  backupRecord?(table: string, key: string): Promise<string>;
  /**
   * Ghi ô singleton toàn cục cho bền; chỉ hợp lệ khi mô tả đã khai `hasGlobal`.
   * Nhận: giá trị JSON đục.
   * Trả: promise phân giải sau khi giá trị đã bền.
   */
  setGlobal(value: unknown): Promise<void>;
  /**
   * Xả các lượt ghi đang chạy của đơn vị rồi nhả nó; idempotent.
   * Nhận: không.
   * Trả: promise phân giải sau khi đơn vị đã được nhả.
   */
  close(): Promise<void>;
}

/** Nhóm thao tác KHOÁ–GIÁ TRỊ của một backend; VẮNG hẳn khi backend không phục vụ loại dữ liệu này. */
export interface KvFacetLike {
  /**
   * Mở một đơn vị, tự tạo khi môi trường lưu chưa có dấu vết nào của nó.
   * Nhận: mô tả tĩnh (định danh + hình dạng) của đơn vị cần mở.
   * Trả: đơn vị đã mở.
   */
  open(descriptor: KvUnitDescriptorLike): Promise<KvUnitLike>;
}

/** Một backend đã đăng ký: sở hữu đúng MỘT môi trường lưu và chia vòng đời cho mọi facet. */
export interface StorageBackendLike {
  /** Thao tác khoá–giá trị; VẮNG khi backend không phục vụ được loại dữ liệu này. */
  readonly kv?: KvFacetLike;
  /**
   * Xả các lượt ghi đang chạy trên mọi đơn vị đang mở rồi nhả môi trường lưu.
   * Nhận: không.
   * Trả: promise phân giải sau khi môi trường lưu đã được nhả.
   */
  close(): Promise<void>;
}

/** Hình dạng SEAM của kho mà backend này chạm tới: sổ backend CÓ TÊN. */
export interface StorageHubLike {
  /** Sổ backend có tên của kho. */
  readonly backend: {
    /**
     * Đăng ký một backend có tên; đăng ký là HIỆU ỨNG.
     * Nhận: tên backend (`json`) và thể hiện backend.
     * Trả: hàm dọn gỡ đúng cái tên đó (KHÔNG đóng backend).
     */
    register(name: string, backend: StorageBackendLike): () => void;
  };
}

/**
 * Lấy seam kho từ context host.
 * Nhận: context của plugin (kernel cordis cấp).
 * Trả: hình dạng {@link StorageHubLike} của `ctx.storage` — phép cast nằm ở ĐÚNG MỘT ranh giới này.
 */
export function storageHubOf(ctx: Context): StorageHubLike {
  return (ctx as unknown as { storage: StorageHubLike }).storage;
}
