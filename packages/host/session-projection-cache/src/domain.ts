/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hai hàm KHAI BÁO MIỀN của `@deepseek-ai/dsh-storage-domain` viết lại TẠI CHỖ — `domainTable` và
 *      `defineDomain` — để gói này không phải khai một peer NGOÀI bảng §3b. Hành vi (phép kiểm + CÂU LỖI
 *      nguyên văn) đối chứng A/B với chính gói gốc trong test; spec trả về là object THUẦN mà
 *      `ctx.storageDomain.open` đọc trường, nên không có quan hệ `instanceof` nào bị mất.
 */

/** Mẫu tên đơn vị của `@deepseek-ai/dsh-storage` (miền và bảng dùng CHUNG một mẫu). */
const UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/;

/** Schema tối thiểu mà một khai báo bảng cần: đúng hình dạng zod mà backend gọi `parse`/`safeParse`. */
export interface DomainRecordSchema {
  /**
   * Kiểm và chuẩn hoá một bản ghi.
   * Nhận: giá trị chưa biết (đọc từ medium hoặc sắp ghi).
   * Trả: bản ghi đúng kiểu; ném khi không hợp lệ.
   */
  parse(value: unknown): unknown;
  /**
   * Kiểm không ném.
   * Nhận: giá trị chưa biết.
   * Trả: `{ success: true, data }` hoặc `{ success: false }`.
   */
  safeParse(value: unknown): { success: boolean };
}

/** Khai báo một bảng của miền — đúng hình dạng `DomainTableSpec` của gói gốc. */
export interface DomainTableSpec<K extends string = string, V = unknown> {
  /** Schema kiểm mọi bản ghi ở ranh giới bền. */
  readonly valueSchema: DomainRecordSchema;
  /** Vật mang (phantom) cho kiểu khoá; KHÔNG có mặt lúc chạy. */
  readonly __key?: K;
  /** Vật mang (phantom) cho kiểu giá trị; KHÔNG có mặt lúc chạy. */
  readonly __value?: V;
}

/** Khai báo TĨNH của một miền — đúng hình dạng `DomainSpec` của gói gốc. */
export interface DomainSpec {
  /** Tên miền; phải khớp `UNIT_NAME_RE` (đồng thời là tên đơn vị của backend). */
  readonly name: string;
  /** Phiên bản định dạng hiện tại của miền. */
  readonly version: number;
  /** Bố cục của đơn vị trên medium. */
  readonly layout?: "single" | "per-record";
  /** Phiên bản cũ hơn mà schema bản ghi hiện tại vẫn đọc được. */
  readonly compatibleVersions?: readonly number[];
  /** Thái độ với bản ghi hỏng schema. */
  readonly invalidRecords?: "backup-and-skip";
  /** Khai báo "global" của miền (miền này không dùng). */
  readonly global?: { readonly schema: DomainRecordSchema };
  /** Các bảng đã khai. */
  readonly tables: Record<string, DomainTableSpec>;
}

/**
 * Khai báo một bảng của miền (nguyên văn hành vi của gói gốc: bọc schema thành spec bảng).
 * Nhận: schema zod kiểm mọi bản ghi của bảng.
 * Trả: khai báo bảng mang kiểu khoá `K` và kiểu giá trị `V`.
 */
export function domainTable<K extends string, V>(schema: DomainRecordSchema): DomainTableSpec<K, V> {
  return { valueSchema: schema };
}

/**
 * Kiểm một spec miền NGAY lúc nạp module (nguyên văn phép kiểm + câu lỗi của gói gốc): cấu hình sai
 * phải nổ TRƯỚC khi chạm medium, chứ không phải lúc mở.
 * Nhận: spec cần kiểm.
 * Trả: CHÍNH spec đó (đã hẹp kiểu); ném `Error` khi một trường sai.
 */
export function defineDomain(spec: DomainSpec): DomainSpec {
  if (!UNIT_NAME_RE.test(spec.name)) throw new Error(`domain name '${spec.name}' must match ${UNIT_NAME_RE}`);
  if (!Number.isInteger(spec.version) || spec.version < 0) {
    throw new Error(`domain '${spec.name}' version must be a non-negative integer, got ${spec.version}`);
  }
  for (const compat of spec.compatibleVersions ?? []) {
    if (!Number.isInteger(compat) || compat < 0 || compat >= spec.version) {
      throw new Error(
        `domain '${spec.name}' compatibleVersions entries must be non-negative integers below version ${spec.version}, got ${compat}`,
      );
    }
  }
  if (spec.layout !== undefined) {
    const layout = spec.layout;
    if (layout !== "single" && layout !== "per-record") {
      throw new Error(`domain '${spec.name}' layout must be 'single' or 'per-record', got ${layout}`);
    }
  }
  if (spec.invalidRecords !== undefined) {
    const policy = spec.invalidRecords;
    if (policy !== "backup-and-skip") {
      throw new Error(`domain '${spec.name}' invalidRecords must be 'backup-and-skip' when present, got ${policy}`);
    }
  }
  for (const table of Object.keys(spec.tables)) {
    if (!UNIT_NAME_RE.test(table)) throw new Error(`domain '${spec.name}' table name '${table}' must match ${UNIT_NAME_RE}`);
  }
  if (spec.global !== undefined && spec.global.schema.safeParse(null).success) {
    throw new Error(
      `domain '${spec.name}' global schema must not accept null: null is the medium's "never written" sentinel, so a stored null could not round-trip`,
    );
  }
  return spec;
}
