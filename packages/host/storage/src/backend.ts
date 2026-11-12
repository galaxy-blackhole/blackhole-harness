/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng phía BACKEND của kho lưu trữ: một backend sở hữu MỘT môi trường lưu (gốc cây tệp,
 *      một tệp cơ sở dữ liệu) và phơi các nhóm thao tác trên đó; kèm mẫu tên đơn vị/bảng
 *      (bản gốc: lib/types/backend.d.ts)
 */

/** Mẫu hợp lệ cho tên đơn vị và tên bảng: an toàn làm tên tệp và làm đoạn định danh SQL mà không cần escape. */
export const UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/;

/**
 * Một backend đã đăng ký. Backend sở hữu đúng MỘT môi trường lưu và chia vòng đời cho mọi facet;
 * facet là thành viên TUỲ CHỌN — backend không phục vụ được một loại dữ liệu thì bỏ hẳn facet đó,
 * và lượt giải sẽ hỏng thành tiếng thay vì trả rỗng.
 */
export interface StorageBackend {
  /** Thao tác khoá–giá trị; VẮNG khi backend không phục vụ được loại dữ liệu này. */
  readonly kv?: KvFacet;
  /**
   * Xả các lượt ghi đang chạy trên mọi đơn vị đang mở rồi nhả môi trường lưu.
   * Idempotent; gọi chồng nhau chỉ phân giải MỘT lần khi teardown xong.
   * Nhận: không.
   * Trả: promise phân giải sau khi môi trường lưu đã được nhả.
   */
  close(): Promise<void>;
}

/** Hình dạng dữ liệu khoá–giá trị: ảnh chụp nguyên đơn vị cộng các lượt ghi bền theo từng bản ghi. */
export interface KvFacet {
  /**
   * Mở một đơn vị, tự tạo khi môi trường lưu chưa có dấu vết nào của nó.
   * Nhận: mô tả tĩnh (định danh + hình dạng) của đơn vị cần mở.
   * Trả: đơn vị đã mở.
   */
  open(descriptor: KvUnitDescriptor): Promise<KvUnit>;
}

/** Định danh tĩnh và hình dạng của MỘT đơn vị KV, chiếu từ spec của chủ sở hữu. */
export interface KvUnitDescriptor {
  /** Tên đơn vị; phải khớp {@link UNIT_NAME_RE}. Đồng thời là đoạn tên tệp / định danh SQL. */
  readonly name: string;
  /** Phiên bản định dạng đơn vị; số nguyên không âm được đóng dấu lên môi trường lưu ở lần ghi đầu. */
  readonly version: number;
  /** Tên các bảng; mỗi tên phải khớp {@link UNIT_NAME_RE}. */
  readonly tables: readonly string[];
  /** Đơn vị có mang ô singleton toàn cục hay không. */
  readonly hasGlobal: boolean;
  /**
   * Cách bố trí trên môi trường lưu. `single` (mặc định) giữ nguyên đơn vị trong một tài liệu;
   * `per-record` giữ mỗi bản ghi trong một tài liệu riêng.
   */
  readonly layout?: "single" | "per-record";
  /**
   * Các phiên bản đơn vị CŨ mà bản ghi đã lưu vẫn đọc được dưới schema hiện tại của chủ sở hữu.
   */
  readonly compatibleVersions?: readonly number[];
}

/**
 * Một đơn vị đã mở. Giá trị là JSON ĐỤC với tầng này: không schema, không sự kiện, không ngữ nghĩa
 * miền. Đơn vị KHÔNG tự xếp hàng các lượt ghi chồng nhau — thứ tự ghi là việc của người gọi; đơn vị
 * chỉ bảo đảm mỗi lời gọi đơn lẻ là nguyên tử trên môi trường lưu và bền sau khi phân giải.
 */
export interface KvUnit {
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
   * Xoá MỘT bản ghi cho bền; idempotent (khoá không có là no-op).
   * Nhận: tên bảng đã khai và khoá bản ghi.
   * Trả: promise phân giải sau khi đã xoá bền.
   */
  deleteRecord(table: string, key: string): Promise<void>;
  /**
   * Chuyển tài liệu đã lưu của MỘT bản ghi ra khỏi tập đọc được của đơn vị, giữ nguyên byte để soát.
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
   * Xả các lượt ghi đang chạy của đơn vị này rồi nhả nó; idempotent.
   * Nhận: không.
   * Trả: promise phân giải sau khi đơn vị đã được nhả.
   */
  close(): Promise<void>;
}
