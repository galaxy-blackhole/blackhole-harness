/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dạng dữ liệu MIỀN (`ctx.storage.domain`): KV có schema kiểm và phát sự kiện đổi, trên các backend
 *      của kho lưu trữ. Đây là thể hiện DUY NHẤT của tầng miền — người dùng phụ thuộc gói này và KHÔNG
 *      BAO GIỜ chạm backend trực tiếp (bản gốc: lib/types/index.d.ts).
 */
import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-storage-domain";
import z from "@deepseek-ai/schemastery";
import { DomainImpl } from "./domain.ts";
import type { Domain } from "./domain.ts";
import { DomainError } from "./error.ts";
import { storageBackendServiceKey, storageHubOf } from "./hub.ts";
import { descriptorOf } from "./spec.ts";
import type { DomainSpec } from "./spec.ts";

export { DomainError } from "./error.ts";
export type { DomainErrorCode, DomainErrorOptions, InvalidRecordDetail } from "./error.ts";
export { defineDomain, domainTable, descriptorOf } from "./spec.ts";
export type {
  DomainSpec,
  DomainGlobalSpec,
  DomainTableSpec,
  TableKeyOf,
  TableValueOf,
  GlobalValueOf,
} from "./spec.ts";
export type { DomainChanged } from "./events.ts";
export type { Domain, DomainGlobal, DomainGlobalHandleOf, KvTable } from "./domain.ts";

/** Tên plugin cordis — giữ NGUYÊN VĂN `storage-domain` của bản gốc. */
export const name = "storage-domain";

/** Kho lưu trữ phải có mặt TRƯỚC khi dạng dữ liệu này mount được. */
export const inject = ["storage"];

/**
 * Cấu hình plugin. Backend nào phục vụ miền nào được quyết ĐỊNH Ở ĐÂY, không phải toàn cục trên kho:
 * `backend` là tuyến mặc định còn `routes` ghi đè theo tên miền. Tuyến trỏ tới backend chưa đăng ký thì
 * hỏng thành tiếng lúc `open` với `backend-not-found`.
 */
export interface Config {
  /** Tên backend mặc định cho mọi miền không có tuyến riêng. BẮT BUỘC: không có môi trường lưu nào đúng cho mọi ca. */
  backend: string;
  /** Ghi đè theo từng miền: tên miền → tên backend. */
  routes?: Record<string, string>;
}

/** Schema cấu hình lúc chạy cho {@link Config} (nguyên văn bản gốc: backend bắt buộc, routes mặc định rỗng). */
export const Config: z<Config> = z.object({
  backend: z.string().required(),
  routes: z.dict(z.string()).default({}),
}) as unknown as z<Config>;

/**
 * Facility miền ĐÃ MOUNT. Mở các miền đã khai trên backend theo tuyến; MỘT thể hiện facility sở hữu
 * bảng miền đang mở và ép luật MỘT-LẦN-MỞ cho mỗi tên miền.
 */
export class DomainFacility {
  private readonly ctx: Context;
  private readonly config: Config;
  private readonly domains = new Map<string, DomainImpl>();
  /** Tên đã ĐẶT CHỖ bởi một lượt mở đang chạy hoặc đã xong, để hai lượt mở cùng tên hỏng thành tiếng. */
  private readonly reserved = new Set<string>();

  /**
   * Dựng facility miền.
   * Nhận: context của plugin miền — hiệu ứng mở-miền và sự kiện đổi bám vào đây (`ctx`), và cấu hình
   * plugin đã được schema xác thực (`config`).
   * Trả: facility rỗng, chưa mở miền nào.
   */
  constructor(ctx: Context, config: Config) {
    this.ctx = ctx;
    this.config = config;
  }

  /**
   * Mở MỘT miền đã khai. Các bước, mỗi bước làm HỎNG CẢ lượt gọi: từ chối tên đã mở (`already-open`);
   * giải tuyến backend (`backend-not-found` đi xuyên qua từ kho); đòi facet `kv` của nó
   * (`facet-unsupported`); mở đơn vị chiếu từ spec (`version-mismatch`/`malformed-medium` của backend đi
   * xuyên qua); nạp và kiểm MỌI bản ghi đã lưu bằng schema zod của spec (`invalid-record` kèm bảng và
   * khoá phạm lỗi — trừ khi spec khai `invalidRecords: 'backup-and-skip'` và đơn vị chuyển được tài liệu
   * sang chỗ khác, khi đó bản ghi hỏng được sao lưu, ghi log, và bỏ qua); dựng miền.
   *
   * Vòng đời: NGƯỜI GỌI sở hữu handle trả về và đóng nó bằng `Domain.close()` (thường là hàm dọn
   * `ctx.effect` của chính nó) — facility KHÔNG buộc miền vào fiber của người dùng nào. Miền còn mở khi
   * facility xuống sẽ do hàm dọn của plugin đóng.
   * Nhận: khai báo miền (`spec`), thường từ `defineDomain`.
   * Trả: promise của handle miền đã mở, mang kiểu theo spec.
   */
  async open<S extends DomainSpec>(spec: S): Promise<Domain<S>> {
    if (this.reserved.has(spec.name)) throw new DomainError("already-open", `domain '${spec.name}' is already open`);
    this.reserved.add(spec.name);
    try {
      const backendName = this.config.routes?.[spec.name] ?? this.config.backend;
      const backend = storageHubOf(this.ctx).backend.get(backendName);
      if (!backend.kv) {
        throw new DomainError(
          "facet-unsupported",
          `backend '${backendName}' routed for domain '${spec.name}' has no kv facet`,
        );
      }
      const unit = await backend.kv.open(descriptorOf(spec));
      try {
        const snapshot = await unit.loadAll();
        const tables = new Map<string, Map<string, unknown>>();
        for (const [table, tableSpec] of Object.entries(spec.tables)) {
          const records = new Map<string, unknown>();
          for (const [key, raw] of Object.entries(snapshot.tables[table] ?? {})) {
            let parsed: unknown;
            try {
              parsed = parseRecord(spec.name, table, key, () => tableSpec.valueSchema.parse(raw));
            } catch (error) {
              if (spec.invalidRecords !== "backup-and-skip" || unit.backupRecord === undefined) throw error;
              const moved = await unit.backupRecord(table, key);
              this.ctx.logger.error(
                `domain '${spec.name}': stored record '${key}' in table '${table}' failed schema validation; moved to '${moved}' and treated as absent. Cause: ${String((error as DomainError).cause)}`,
              );
              continue;
            }
            records.set(key, parsed);
          }
          tables.set(table, records);
        }
        const globalSpec = spec.global;
        const globalValue =
          globalSpec === undefined
            ? undefined
            : snapshot.global === null
              ? globalSpec.initial
              : parseRecord(spec.name, "", "", () => globalSpec.schema.parse(snapshot.global));
        const domain = new DomainImpl(this.ctx, spec, unit, tables, globalValue, () => {
          this.domains.delete(spec.name);
          this.reserved.delete(spec.name);
        });
        this.domains.set(spec.name, domain);
        return domain as unknown as Domain<S>;
      } catch (error) {
        await unit.close();
        throw error;
      }
    } catch (error) {
      this.reserved.delete(spec.name);
      throw error;
    }
  }

  /**
   * Tra một miền đang mở theo tên, KHÔNG mang kiểu. Bề mặt chẩn đoán; người dùng có kiểu giữ handle mà
   * {@link open} trả về.
   * Nhận: tên miền.
   * Trả: lúc chạy của miền đang mở, hoặc `undefined` khi chưa mở.
   */
  get(name: string): DomainImpl | undefined {
    return this.domains.get(name);
  }

  /**
   * Đóng MỌI miền còn mở trên facility này. Đường xuống của những người dùng chưa từng tự gọi
   * `Domain.close()`; lượt đóng là idempotent nên đóng hai lần một miền đã đóng là vô hại.
   * Nhận: không.
   * Trả: promise phân giải sau khi mọi đơn vị đã được nhả.
   */
  async closeAll(): Promise<void> {
    await Promise.all([...this.domains.values()].map((domain) => domain.close()));
  }
}

/**
 * Chạy MỘT lượt parse zod, dịch lỗi thành `invalid-record` kèm vị trí của nó.
 * Nhận: tên miền, tên bảng (`''` cho global), khoá (`''` cho global), và phép parse cần chạy.
 * Trả: giá trị đã kiểm; NÉM `DomainError('invalid-record')` với `detail` + `cause` gốc.
 */
function parseRecord<T>(domain: string, table: string, key: string, parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    throw new DomainError(
      "invalid-record",
      `domain '${domain}': stored ${table === "" ? "global" : `record '${key}' in table '${table}'`} does not match its schema`,
      { detail: { table, key }, cause: error },
    );
  }
}

/**
 * Mount dạng dữ liệu miền lên kho lưu trữ.
 * Nhận: context plugin (`ctx`) và cấu hình đã xác thực (`config`).
 * Trả: promise phân giải sau khi một bộ backend ĐÃ CÓ SẴN kích hoạt dạng dữ liệu (lượt chờ gồm cả kho
 *      lẫn khoá vòng đời `storage.backend.<tên>` của từng backend mà cấu hình nhắc tới).
 */
export function apply(ctx: Context, config: Config): Promise<void> {
  const backendServices = [...new Set([config.backend, ...Object.values(config.routes ?? {})])].map(
    storageBackendServiceKey,
  );
  const fiber = ctx.inject(backendServices, (domainCtx) => {
    const facility = new DomainFacility(domainCtx, config);
    domainCtx.effect(() => {
      const unmount = storageHubOf(domainCtx).mount("domain", facility);
      return async () => {
        await facility.closeAll();
        unmount();
      };
    });
    domainCtx.provide("storageDomain", facility);
  });
  return Promise.resolve(fiber).then(() => {});
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    // KHÔNG khai lại `storageDomain`: bản gốc `@deepseek-ai/dsh-storage-domain` ĐÃ khai property này với lớp của nó; khai
    // lại bằng lớp của ta sinh TS2717 (hai lớp khác nhau về cấu trúc). Luật: ADR 0009 — một chủ sở hữu cho seam kiểu.
  }
}
