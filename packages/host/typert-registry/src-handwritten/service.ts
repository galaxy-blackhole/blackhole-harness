/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Sổ đăng ký lúc chạy cho reflection Typert đã sinh, lời gọi Remote, và các nhà cung cấp tra cứu/
 *      Context/kiểu tài nguyên — bản viết lại 1:1 `TypertRegistry` của `@deepseek-ai/dsh-typert-registry`.
 *      Sổ này KHÔNG phân tích TypeScript và KHÔNG sinh schema.
 */

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import type {
  TypertContextRegistry,
  TypertDisposer,
  TypertLocalRegistry,
  TypertLookupRegistry,
  TypertRemoteRegistry,
  TypertResourceRegistry,
} from "@deepseek-ai/dsh-typert-protocol";
// zod v4: `z` là một THỂ HIỆN `ZodClassic`, KHÔNG phải namespace ⇒ `z.core.*`/`zCore.$ZodType` không tồn tại.
// Kiểu lõi lấy từ ĐÚNG module con `zod/v4/core` (đó là nơi `ToJSONSchemaParams` + `JSONSchema` được xuất);
// giá trị lúc chạy lấy từ `zod` (`zod.z.toJSONSchema`).
import * as zod from "zod";
import type { $ZodType, JSONSchema, ToJSONSchemaParams } from "zod/v4/core";

import {
  ContextStore,
  DescriptorStore,
  LookupStore,
  RemoteStore,
  ResourceStore,
  typertEndpoint,
  typertKey,
  typertPackageKey,
  validateCodec,
  validateNonempty,
  validateSegment,
} from "./stores.ts";
import type { StoreContext, TypertChange } from "./stores.ts";
import type {
  TypertContribution,
  TypertFace,
  TypertPackageFilter,
  TypertPackageRecord,
  TypertSchemaFactory,
  TypertSchemaFilter,
  TypertSchemaRecord,
} from "./types.ts";

export { typertEndpoint, typertKey, typertPackageKey };

/** Mục schema nội bộ: nhà máy + danh tính, kèm schema đã hiện thực hoá (nhớ đệm). */
interface SchemaEntry extends TypertSchemaRecord {
  /** Nhà máy sinh schema. */
  readonly create: () => $ZodType;
  /** Schema đã hiện thực hoá (nhớ đệm sau lần đầu). */
  value?: $ZodType;
}

/** Mục schema khi CHƯA hiện thực hoá. */
interface PendingSchema extends TypertSchemaFactory {
  /** Package đóng góp. */
  readonly package: string;
  /** Phía đóng góp. */
  readonly face: TypertFace;
  /** Khoá toàn cục. */
  readonly key: string;
}

/**
 * Sổ đăng ký schema đã sinh, reflection package, lời gọi, và các nhà cung cấp phụ thuộc Remote.
 */
export class TypertRegistry extends Service {
  /** Schema đang sống theo khoá toàn cục. */
  private readonly schemas = new Map<string, SchemaEntry>();

  /** Mô hình package đang sống theo khoá `<package>#<face>`. */
  private readonly packages = new Map<string, TypertPackageRecord>();

  /** Sổ định nghĩa lời gọi của MÔI TRƯỜNG HIỆN TẠI. */
  private readonly localStore: DescriptorStore;

  /** Sổ định nghĩa Remote do bên tiêu thụ chọn. */
  private readonly remoteStore: RemoteStore;

  /** Sổ nhà cung cấp tra cứu. */
  private readonly lookupStore: LookupStore;

  /** Sổ bộ chuyển Context. */
  private readonly contextStore: ContextStore;

  /** Sổ loại tài nguyên. */
  private readonly resourceStore: ResourceStore;

  /**
   * Đăng ký service dưới khoá `typert` và dựng năm sổ con.
   * Nhận: context của plugin Host.
   * Trả: không.
   */
  constructor(ctx: Context) {
    super(ctx, "typert");
    const seam = ctx as unknown as StoreContext;
    const report = (change: TypertChange, error: unknown): void => {
      seam.logger.warn("typert: " + change.kind + ' observer for "' + change.key + '" failed');
      seam.logger.warn(error);
    };
    this.localStore = new DescriptorStore("local", report);
    this.remoteStore = new RemoteStore(new DescriptorStore("remote", report));
    this.lookupStore = new LookupStore(report);
    this.contextStore = new ContextStore(report);
    this.resourceStore = new ResourceStore(report);
  }

  /** Định nghĩa lời gọi của MÔI TRƯỜNG HIỆN TẠI. */
  get local(): TypertLocalRegistry {
    const ctx = this.ctx as unknown as StoreContext;
    return {
      get: (endpoint) => this.localStore.get(endpoint),
      hasSeen: (endpoint) => this.localStore.hasSeen(endpoint),
      list: () => this.localStore.list(),
      subscribe: (listener: (change: TypertChange) => void) => this.localStore.subscribe(ctx, listener),
    };
  }

  /** Định nghĩa Remote do bên tiêu thụ chọn. */
  get remotes(): TypertRemoteRegistry {
    return this.remoteStore.view(this.ctx as unknown as StoreContext);
  }

  /** Nhà cung cấp tra cứu đối tượng Host. */
  get lookups(): TypertLookupRegistry {
    return this.lookupStore.view(this.ctx as unknown as StoreContext);
  }

  /** Bộ chuyển Context Host và Client. */
  get contexts(): TypertContextRegistry {
    return this.contextStore.view(this.ctx as unknown as StoreContext);
  }

  /** Trường dây mặc định của các loại tài nguyên. */
  get resources(): TypertResourceRegistry {
    return this.resourceStore.view(this.ctx as unknown as StoreContext);
  }

  /**
   * Đăng ký MỘT đóng góp đã sinh NGUYÊN TỬ cho fiber đang gọi. Trùng danh tính package-face, trùng schema,
   * trùng id lời gọi, hoặc trùng điểm cuối ⇒ từ chối CẢ LÔ.
   * Nhận: đóng góp (schema, reflection, lời gọi Host).
   * Trả: ĐÚNG hàm dọn của hiệu ứng đã gỡ đóng góp này.
   */
  register(contribution: TypertContribution): TypertDisposer {
    const packageRecord = this.validatePackage(contribution);
    const schemaRecords = this.validateSchemas(contribution);
    const invocations = contribution.invocations;
    this.localStore.validate(invocations);
    const owner = {};
    const { schemas, packages, localStore } = this;
    return (this.ctx as unknown as StoreContext).effect(function* () {
      packages.set(packageRecord.key, packageRecord);
      for (const record of schemaRecords) schemas.set(record.key, record);
      localStore.commit(owner, invocations);
      yield () => {
        if (packages.get(packageRecord.key) === packageRecord) packages.delete(packageRecord.key);
        for (const record of schemaRecords) {
          if (schemas.get(record.key) === record) schemas.delete(record.key);
        }
        localStore.withdraw(owner, invocations);
      };
    }, "typert.register()");
  }

  /**
   * Lấy MỘT schema theo `<package>#<name>`.
   * Nhận: khoá toàn cục.
   * Trả: bản ghi chứa schema đã nhớ đệm, hoặc `undefined` khi vắng.
   */
  get(key: string): TypertSchemaRecord | undefined {
    const record = this.schemas.get(key);
    return record === undefined ? undefined : materializeSchema(record);
  }

  /**
   * Giải MỘT schema BẮT BUỘC.
   * Nhận: khoá toàn cục.
   * Trả: bản ghi chứa schema đã nhớ đệm.
   * Ném: khi khoá sai dạng, phía của package vắng, hoặc schema chưa được đóng góp.
   */
  resolve(key: string): TypertSchemaRecord {
    const record = this.schemas.get(key);
    if (record !== undefined) return materializeSchema(record);
    const hash = key.indexOf("#");
    if (hash <= 0 || hash === key.length - 1) {
      throw new Error('typert: invalid schema key "' + key + '" — expected "<package>#<name>"');
    }
    const packageName = key.slice(0, hash);
    if ([...this.packages.values()].some((candidate) => candidate.package === packageName)) {
      throw new Error(
        'typert: cannot resolve "' +
          key +
          '" — package "' +
          packageName +
          '" is registered but contributes no schema named "' +
          key.slice(hash + 1) +
          '"',
      );
    }
    throw new Error('typert: cannot resolve "' + key + '" — package "' + packageName + '" has no registered contribution');
  }

  /**
   * Liệt kê schema đang sống theo thứ tự đăng ký.
   * Nhận: bộ lọc package/phía (tuỳ chọn).
   * Trả: các bản ghi khớp, đã hiện thực hoá schema.
   */
  list(filter: TypertSchemaFilter = {}): TypertSchemaRecord[] {
    return [...this.schemas.values()].filter((record) => matches(record, filter)).map(materializeSchema);
  }

  /**
   * Lấy reflection đã sinh của MỘT package trên MỘT phía.
   * Nhận: tên package chính xác, và phía (mặc định `host`).
   * Trả: bản ghi package đang sống, hoặc `undefined`.
   */
  getPackage(packageName: string, face: TypertFace = "host"): TypertPackageRecord | undefined {
    return this.packages.get(typertPackageKey(packageName, face));
  }

  /**
   * Liệt kê reflection package theo thứ tự đăng ký.
   * Nhận: bộ lọc package/phía (tuỳ chọn).
   * Trả: các bản ghi khớp.
   */
  listPackages(filter: TypertPackageFilter = {}): TypertPackageRecord[] {
    return [...this.packages.values()].filter((record) => matches(record, filter));
  }

  /**
   * Chiếu MỘT schema Zod đang sống sang JSON Schema, KHÔNG nhớ đệm kết quả.
   * Nhận: khoá toàn cục, và tham số chiếu của Zod.
   * Trả: tài liệu JSON Schema MỚI.
   */
  toJSONSchema(key: string, params?: ToJSONSchemaParams): JSONSchema.BaseSchema {
    // MỘT ép kiểu tại đây: kiểu của giá trị `zod.z` phụ thuộc entry mà TS phân giải (classic vs core), không ổn
    // định giữa chế độ typecheck từng tệp và chế độ quét cả repo; hợp đồng công khai vẫn do `z.core.*` ở chữ ký.
    const project = zod.z as unknown as {
      toJSONSchema(schema: $ZodType, options?: ToJSONSchemaParams): JSONSchema.BaseSchema;
    };
    return project.toJSONSchema(this.resolve(key).schema, params);
  }

  /**
   * Kiểm và dựng bản ghi package của MỘT đóng góp.
   * Nhận: đóng góp.
   * Trả: bản ghi package.
   */
  private validatePackage(contribution: TypertContribution): TypertPackageRecord {
    validateSegment("package name", contribution.package);
    const face = contribution.face;
    if (face !== "host" && face !== "client") {
      throw new Error("typert: invalid face " + JSON.stringify(face) + ' — expected "host" or "client"');
    }
    const key = typertPackageKey(contribution.package, contribution.face);
    if (this.packages.has(key)) throw new Error('typert: package face "' + key + '" is already registered');
    return { package: contribution.package, face, key, model: contribution.model };
  }

  /**
   * Kiểm và dựng các bản ghi schema của MỘT đóng góp.
   * Nhận: đóng góp.
   * Trả: các bản ghi schema CHƯA hiện thực hoá.
   */
  private validateSchemas(contribution: TypertContribution): SchemaEntry[] {
    const records: SchemaEntry[] = [];
    const batch = new Set<string>();
    for (const schema of contribution.schemas) {
      validateSegment("schema name", schema.name);
      if (typeof schema.create !== "function") {
        throw new Error('typert: schema "' + schema.name + '" has no create() factory');
      }
      const key = typertKey(contribution.package, schema.name);
      if (batch.has(key) || this.schemas.has(key)) throw new Error('typert: schema "' + key + '" is already registered');
      batch.add(key);
      records.push({
        name: schema.name,
        create: schema.create,
        package: contribution.package,
        face: contribution.face,
        key,
        schema: undefined as unknown as $ZodType,
      });
    }
    return records;
  }
}

/**
 * Hiện thực hoá schema của MỘT bản ghi (nhớ đệm trong `value`) và trả bản ghi CÔNG KHAI.
 * Nhận: mục schema nội bộ.
 * Trả: bản ghi schema (schema đã hiện thực hoá).
 */
function materializeSchema(record: SchemaEntry): TypertSchemaRecord {
  const schema = (record.value ??= record.create());
  return {
    name: record.name,
    schema,
    package: record.package,
    face: record.face,
    key: record.key,
  };
}

/**
 * MỘT bản ghi có khớp bộ lọc package/phía không.
 * Nhận: bản ghi (có `package`/`face`) và bộ lọc.
 * Trả: true khi khớp.
 */
function matches(
  record: { readonly package: string; readonly face: TypertFace },
  filter: { readonly package?: string; readonly face?: TypertFace },
): boolean {
  return (
    (filter.package === undefined || record.package === filter.package) &&
    (filter.face === undefined || record.face === filter.face)
  );
}


// Giữ các validator ở lại trong module này để bề mặt kiểm tra của sổ là MỘT chỗ.
export { validateCodec, validateNonempty };
export type { PendingSchema };
