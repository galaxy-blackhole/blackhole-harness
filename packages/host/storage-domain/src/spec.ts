/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng KHAI BÁO MIỀN: spec là nguồn DUY NHẤT của danh tính, bố cục và schema bản ghi — chủ sở
 *      hữu khai một lần bằng `defineDomain`, cả bề mặt kiểu lẫn lúc chạy (phép kiểm, chiếu descriptor)
 *      đều suy từ đó (bản gốc: lib/types/spec.d.ts).
 */
import type { KvUnitDescriptorLike } from "./hub.ts";
import { UNIT_NAME_RE } from "./hub.ts";

/**
 * Hình dạng schema bản ghi mà tầng này cần — đúng phần giao của zod mà bản gốc dùng.
 * Khai theo CẤU TRÚC để gói không phải khai `zod` thành peer lúc chạy: bundle GỐC chỉ import
 * `schemastery` + gói kho, còn `zod` chỉ xuất hiện ở `.d.ts` (xem README gói §4).
 */
export interface ZodTypeLike<V> {
  /**
   * Kiểm và chuẩn hoá một giá trị.
   * Nhận: giá trị chưa biết (đọc từ môi trường lưu).
   * Trả: giá trị đúng kiểu; NÉM khi không hợp lệ.
   */
  parse(value: unknown): V;
  /**
   * Kiểm không ném.
   * Nhận: giá trị chưa biết.
   * Trả: `{ success: true, ... }` hoặc `{ success: false, ... }`.
   */
  safeParse(value: unknown): { success: boolean };
}

/** Khai báo ô singleton toàn cục: schema cộng giá trị dùng TRƯỚC lượt ghi đầu. */
export interface DomainGlobalSpec<G> {
  /** Kiểm giá trị toàn cục đã lưu ở ranh giới bền. */
  readonly schema: ZodTypeLike<G>;
  /** Giá trị phục vụ khi môi trường lưu CHƯA có global; không được ghi cho tới lượt `set` đầu. */
  readonly initial: G;
}

/**
 * Khai báo MỘT bảng. `K` là kiểu khoá PHANTOM (thường là chuỗi có thương hiệu) chỉ mang lúc biên dịch;
 * trên môi trường lưu khoá là chuỗi trơn.
 */
export interface DomainTableSpec<K extends string = string, V = unknown> {
  /** Kiểm MỌI bản ghi đã lưu ở ranh giới bền. */
  readonly valueSchema: ZodTypeLike<V>;
  /** Vật mang (phantom) cho kiểu khoá; KHÔNG có mặt lúc chạy. */
  readonly __key?: K;
}

/** Khai báo TĨNH của một miền: danh tính, phiên bản và bố cục bản ghi. */
export interface DomainSpec {
  /** Tên miền; phải khớp `UNIT_NAME_RE` (đồng thời là tên đơn vị của backend). */
  readonly name: string;
  /** Phiên bản định dạng hiện tại của miền; lượt đọc ép nó theo bố cục đã chọn. */
  readonly version: number;
  /**
   * Bố cục của đơn vị trên backend: `single` (mặc định) giữ cả đơn vị trong MỘT tài liệu;
   * `per-record` giữ mỗi bản ghi trong một tài liệu riêng và ép phiên bản theo TỪNG bản ghi
   * (tài liệu không được nhận thì BỎ, không bao giờ migrate).
   */
  readonly layout?: "single" | "per-record";
  /**
   * Các phiên bản miền CŨ mà schema bản ghi hiện tại VẪN nhận (chủ sở hữu bảo chứng, thường bằng cách
   * khai các trường bản ghi cũ thiếu là tuỳ chọn). Backend `per-record` đọc tài liệu mang phiên bản
   * có trong danh sách thay vì bỏ, và nhận tệp cả-đơn-vị cũ mang đúng dấu ấy cho lượt gieo một lần;
   * lượt ghi LUÔN đóng dấu {@link version}.
   */
  readonly compatibleVersions?: readonly number[];
  /**
   * `open` làm gì với một bản ghi đã lưu hỏng schema zod. Vắng mặt (mặc định): cả lượt mở bị từ chối
   * với `invalid-record` — đúng cho dữ liệu có thẩm quyền. `'backup-and-skip'` dành cho miền mà bản
   * ghi là dữ liệu PHÁI SINH dùng được thì vứt: backend chuyển tài liệu sang chỗ khác
   * (`KvUnit.backupRecord`), lỗi được ghi log kèm nguyên nhân, và lượt mở tiếp tục với bản ghi VẮNG.
   * Backend không có `backupRecord` rơi về mặc định từ chối. Ô global LUÔN từ chối.
   */
  readonly invalidRecords?: "backup-and-skip";
  /** Ô singleton toàn cục, TUỲ CHỌN. */
  readonly global?: DomainGlobalSpec<unknown>;
  /** Các bảng đã khai; mỗi tên phải khớp `UNIT_NAME_RE`. */
  readonly tables: Record<string, DomainTableSpec>;
}

/** Kiểu khoá của MỘT bảng đã khai, phục hồi từ vật mang phantom. */
export type TableKeyOf<S extends DomainSpec, N extends keyof S["tables"]> = S["tables"][N] extends DomainTableSpec<infer K>
  ? K
  : never;

/** Kiểu giá trị của MỘT bảng đã khai. */
export type TableValueOf<S extends DomainSpec, N extends keyof S["tables"]> = S["tables"][N] extends DomainTableSpec<string, infer V>
  ? V
  : never;

/** Kiểu giá trị global của một spec; `never` khi spec không khai global. */
export type GlobalValueOf<S extends DomainSpec> = S["global"] extends DomainGlobalSpec<infer G> ? G : never;

/**
 * Khai báo một bảng.
 * Nhận: schema kiểm MỌI bản ghi đã lưu của bảng này.
 * Trả: khai báo bảng, mang kiểu khoá `K` (và kiểu giá trị `V` suy từ schema).
 */
export function domainTable<K extends string, V>(schema: ZodTypeLike<V>): DomainTableSpec<K, V> {
  return { valueSchema: schema };
}

/**
 * Trợ giúp danh tính: ghim kiểu literal của spec và KIỂM các trường của nó. Cấu hình sai phải NỔ ngay
 * lúc nạp module của gói chủ sở hữu, TRƯỚC khi chạm môi trường lưu: tên miền/bảng ngoài
 * `UNIT_NAME_RE`, phiên bản không phải số nguyên không âm, hay schema global nhận `null` đều ném.
 * Việc từ chối `null` canh lượt đi-về: backend giữ global như JSON ĐỤC với `null` là dấu "chưa từng
 * ghi", nên global nhận `null` sẽ không phân biệt được với global vắng khi mở lại (một `null` đã lưu
 * lặng lẽ quay về `initial`).
 * Nhận: khai báo miền cần kiểm.
 * Trả: CHÍNH spec đó (đã hẹp kiểu literal).
 */
export function defineDomain<S extends DomainSpec>(spec: S): S {
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

/**
 * Chiếu một spec lên descriptor mà backend nhìn thấy.
 * Nhận: khai báo miền.
 * Trả: descriptor đưa cho `KvFacet.open`; `layout`/`compatibleVersions` CHỈ có mặt khi spec khai
 *      (không ghi khoá `undefined`), đúng hình dạng bản gốc.
 */
export function descriptorOf(spec: DomainSpec): KvUnitDescriptorLike {
  return {
    name: spec.name,
    version: spec.version,
    tables: Object.keys(spec.tables),
    hasGlobal: spec.global !== undefined,
    ...(spec.layout === undefined ? {} : { layout: spec.layout }),
    ...(spec.compatibleVersions === undefined ? {} : { compatibleVersions: spec.compatibleVersions }),
  };
}
