/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Lúc chạy của MỘT miền đã mở: trạng thái trong bộ nhớ có thẩm quyền, chuỗi ghi DUY NHẤT của miền, và
 *      phát sự kiện đổi. Đọc là ĐỒNG BỘ từ bộ nhớ; mọi lượt ghi xếp hàng trên chuỗi, chờ bền backend
 *      TRƯỚC, rồi mới sửa bộ nhớ, rồi mới phát `domain/changed` (bản gốc: lib/types/domain.d.ts).
 */
import type { Context } from "@deepseek-ai/cordis";
import type { KvUnitLike } from "./hub.ts";
import { DomainError } from "./error.ts";
import type { DomainChanged } from "./events.ts";
import type { DomainGlobalSpec, DomainSpec, TableKeyOf, TableValueOf } from "./spec.ts";

/** Handle trên ô singleton toàn cục của một miền. */
export interface DomainGlobal<G> {
  /**
   * Giá trị hiện tại, ĐỒNG BỘ từ trạng thái trong bộ nhớ có thẩm quyền.
   * Nhận: không.
   * Trả: giá trị global hiện tại; trước lượt `set` đầu là `initial` của spec.
   */
  get(): G;
  /**
   * Thay giá trị cho BỀN. Xếp hàng trên chuỗi ghi của miền; lượt `set` đầu chính là thứ làm global
   * xuất hiện trên môi trường lưu.
   * Nhận: giá trị mới (`value`); phải thoả schema của spec (không kiểm lại ở đây — phép kiểm nằm ở
   * ranh giới ĐỌC bền).
   * Trả: promise phân giải sau khi đã bền và đã phát sự kiện.
   */
  set(value: G): Promise<void>;
}

/**
 * Handle trên MỘT bảng đã khai. Bản ghi là dữ liệu BẤT BIẾN: giá trị trả về CHÍNH là vật thể đã lưu
 * (không sao chép phòng vệ) và KHÔNG được sửa tại chỗ — hãy thay bằng `put`/`update`.
 */
export interface KvTable<K extends string, V> {
  /**
   * Đọc một bản ghi, ĐỒNG BỘ từ bộ nhớ.
   * Nhận: khoá bản ghi.
   * Trả: bản ghi, hoặc `undefined` khi vắng.
   */
  get(key: K): V | undefined;
  /**
   * Duyệt ẢNH CHỤP các cặp `[khoá, bản ghi]`.
   * Nhận: không.
   * Trả: iterator cặp; đây là ảnh chụp chứ không phải khung nhìn sống, nên lượt duyệt đứng yên trong
   *      khi các lượt ghi đã xếp hàng đang hạ cánh.
   */
  entries(): IterableIterator<[K, V]>;
  /**
   * Duyệt ẢNH CHỤP các khoá.
   * Nhận: không.
   * Trả: iterator khoá của ảnh chụp hiện tại.
   */
  keys(): IterableIterator<K>;
  /** Số bản ghi hiện tại. */
  readonly size: number;
  /**
   * Chèn hoặc ghi đè MỘT bản ghi cho bền.
   * Nhận: khoá bản ghi và bản ghi MỚI ĐẦY ĐỦ (không gộp một phần).
   * Trả: promise phân giải sau khi đã bền và đã phát sự kiện.
   */
  put(key: K, value: V): Promise<void>;
  /**
   * Xoá MỘT bản ghi cho bền.
   * Nhận: khoá bản ghi.
   * Trả: `true` khi bản ghi CÓ, `false` khi đã vắng sẵn (ca đó KHÔNG ghi và KHÔNG phát sự kiện).
   */
  delete(key: K): Promise<boolean>;
  /**
   * Đọc-sửa-ghi NGUYÊN TỬ trên chuỗi ghi của miền: `fn` thấy giá trị hiện tại ĐÚNG chỗ xếp hàng của
   * nó, nên các lượt cập nhật chồng nhau không bao giờ xen kẽ.
   * Nhận: khoá bản ghi (`key`; khoá vắng thì từ chối với `missing-key`) và phép biến đổi THUẦN đồng bộ
   * từ bản ghi hiện tại sang bản ghi kế (`fn`).
   * Trả: bản ghi kế đã được lưu.
   */
  update(key: K, fn: (current: V) => V): Promise<V>;
}

/** Handle global của một spec: có kiểu khi khai, `never` (không chạm tới được) khi không khai. */
export type DomainGlobalHandleOf<S extends DomainSpec> = S extends {
  readonly global: DomainGlobalSpec<infer G>;
}
  ? DomainGlobal<G>
  : never;

/** Một miền đã mở, mang kiểu theo spec của nó. */
export interface Domain<S extends DomainSpec> {
  /** Tên miền lấy từ spec. */
  readonly name: string;
  /** Handle ô singleton toàn cục; spec không khai `global` thì không có handle dùng được (`never`). */
  readonly global: DomainGlobalHandleOf<S>;
  /**
   * Giải handle của MỘT bảng đã khai. Handle ỔN ĐỊNH — gọi lặp lại trả về CÙNG thể hiện.
   * Nhận: tên bảng đã khai.
   * Trả: handle bảng mang kiểu khoá/giá trị của bảng đó.
   */
  table<N extends keyof S["tables"] & string>(name: N): KvTable<TableKeyOf<S, N>, TableValueOf<S, N>>;
  /**
   * Đóng miền này: từ chối lượt ghi MỚI ngay, xả các lượt ghi đã xếp hàng (sự kiện của chúng vẫn phát),
   * nhả đơn vị backend, rồi TRẢ TỰ DO tên miền cho một lượt mở sau. Idempotent — gọi lặp lại chia sẻ
   * MỘT lượt dọn. Người dùng sở hữu lượt gọi này (thường là hàm dọn `ctx.effect` của chính nó);
   * facility đóng mọi miền còn mở khi nó xuống.
   * Nhận: không.
   * Trả: promise phân giải sau khi đơn vị đã được nhả.
   */
  close(): Promise<void>;
}
/** Không làm gì — mắt nối của chuỗi ghi, để một lượt ghi hỏng không làm đứt chuỗi. */
const noop = (): void => {};

/** Bề mặt NỘI BỘ mà handle bảng gọi vào; chủ miền cấp, không phơi ra ngoài gói. */
interface DomainHost {
  /** Tên miền (dùng cho sự kiện và câu lỗi). */
  readonly domainName: string;
  /** Đơn vị backend đã mở — `DomainImpl` sở hữu vòng đời của nó. */
  readonly unit: KvUnitLike;
  /**
   * Xếp MỘT việc ghi lên chuỗi của miền.
   * Nhận: hàm chạy khi tới lượt xếp hàng của nó.
   * Trả: promise mang kết quả của hàm đó; bị từ chối `closed` khi miền đang đóng.
   */
  enqueue<T>(job: () => Promise<T>): Promise<T>;
  /** Ném `closed` khi miền đã đóng xong — đọc sau đó phải hỏng thành tiếng. */
  assertReadable(): void;
  /** Phát một lượt đổi SAU khi đã bền, có bao lỗi của người nghe. */
  emitChanged(change: DomainChanged): void;
}

/**
 * Thể hiện DUY NHẤT của một miền đứng sau giao diện {@link Domain}. Facility dựng nó từ ảnh chụp
 * `loadAll` đã kiểm rồi xoá kiểu thành `Domain<S>`; KHÔNG gì ngoài gói này dựng được một thể hiện.
 */
export class DomainImpl {
  /** Tên miền lấy từ spec. */
  readonly name: string;
  private readonly ctx: Context;
  private readonly unit: KvUnitLike;
  private readonly onClosed: () => void;
  private readonly tables = new Map<string, KvTableImpl>();
  private globalValue: unknown = undefined;
  private readonly globalHandle?: DomainGlobal<unknown>;
  /** Đuôi chuỗi ghi; MỌI mắt nối đều tự phân giải (lượt gọi của người dùng quan sát phần của mình). */
  private chain: Promise<void> = Promise.resolve();
  /** Bật khi lượt đóng BẮT ĐẦU: lượt ghi mới bị từ chối trong khi lượt đã xếp hàng vẫn xả. */
  private disposing = false;
  /** Bật khi lượt đóng XONG (chuỗi đã xả, đơn vị đã đóng): đọc từ đây bị từ chối. */
  private closed = false;
  private disposal?: Promise<void>;

  /**
   * Dựng miền đã mở.
   * Nhận: context mang lượt phát `domain/changed` (`ctx`), khai báo miền (`spec`), đơn vị backend đã
   * mở mà thể hiện này sở hữu vòng đời (`unit`), bản ghi ĐÃ KIỂM từ `loadAll` theo từng bảng đã khai
   * (`records`), giá trị global đã kiểm hoặc `initial` của spec (`globalValue`), và móc của facility
   * chạy MỘT lần sau khi dọn xong để trả tự do tên miền (`onClosed`).
   * Trả: thể hiện miền mới, chưa có lượt ghi nào.
   */
  constructor(
    ctx: Context,
    spec: DomainSpec,
    unit: KvUnitLike,
    records: Map<string, Map<string, unknown>>,
    globalValue: unknown,
    onClosed: () => void,
  ) {
    this.ctx = ctx;
    this.unit = unit;
    this.onClosed = onClosed;
    this.name = spec.name;
    const host: DomainHost = {
      domainName: spec.name,
      unit,
      enqueue: <T>(job: () => Promise<T>): Promise<T> => this.enqueue(job),
      assertReadable: (): void => {
        this.assertReadable();
      },
      emitChanged: (change: DomainChanged): void => {
        this.emitChanged(change);
      },
    };
    for (const [table, tableRecords] of records) this.tables.set(table, new KvTableImpl(host, table, tableRecords));
    if (spec.global !== undefined) {
      this.globalValue = globalValue;
      this.globalHandle = {
        get: () => {
          this.assertReadable();
          return this.globalValue;
        },
        set: (value: unknown) =>
          this.enqueue(async () => {
            await this.unit.setGlobal(value);
            this.globalValue = value;
            this.emitChanged({ domain: this.name, table: "", key: "", operation: "put", value });
          }),
      };
    }
  }

  /** Handle ô singleton toàn cục; chạm vào nó trên spec KHÔNG khai global là lỗi người gọi và NÉM. */
  get global(): DomainGlobal<unknown> {
    if (this.globalHandle === undefined) throw new Error(`domain '${this.name}' declares no global`);
    return this.globalHandle;
  }

  /**
   * Giải handle của MỘT bảng đã khai; tên không khai là lỗi người gọi và NÉM.
   * Nhận: tên bảng đã khai.
   * Trả: handle bảng ỔN ĐỊNH (cùng thể hiện qua mọi lượt gọi).
   */
  table(name: string): KvTable<string, unknown> {
    const table = this.tables.get(name);
    if (table === undefined) throw new Error(`domain '${this.name}' declares no table '${name}'`);
    return table;
  }

  /**
   * Đóng miền này: từ chối lượt ghi MỚI ngay, xả các lượt ghi đã xếp hàng (sự kiện của chúng vẫn phát),
   * đóng đơn vị, rồi trả tự do tên miền qua móc của facility. Idempotent — gọi lặp lại chia sẻ MỘT
   * lượt dọn.
   * Nhận: không.
   * Trả: promise phân giải sau khi đơn vị đã được nhả.
   */
  close(): Promise<void> {
    this.disposal ??= this.runClose();
    return this.disposal;
  }

  /**
   * Thân của lượt dọn (chỉ chạy MỘT lần, do {@link close} gọi).
   * Nhận: không.
   * Trả: promise phân giải sau khi chuỗi đã xả, đơn vị đã đóng, và tên miền đã được trả tự do.
   */
  private async runClose(): Promise<void> {
    this.disposing = true;
    await this.chain;
    await this.unit.close();
    this.closed = true;
    this.onClosed();
  }

  /**
   * Phát MỘT thông báo đổi sau khi bền, BAO lỗi của người quan sát: lượt ghi đã cam kết (môi trường lưu
   * và bộ nhớ đều đã mang trạng thái mới) nên một người nghe ném không được phép từ chối ngược lại.
   * Nhận: lượt đổi cần phát.
   * Trả: không (lỗi của người nghe được ghi log cảnh báo).
   */
  private emitChanged(change: DomainChanged): void {
    try {
      this.ctx.emit("domain/changed", change);
    } catch (error) {
      this.ctx.logger.warn(`domain '${this.name}': domain/changed listener failed: ${String(error)}`);
    }
  }

  /**
   * Xếp MỘT việc lên đuôi chuỗi rồi trả phần của người gọi.
   * Nhận: hàm chạy khi tới lượt.
   * Trả: promise mang kết quả của hàm; từ chối `closed` NGAY khi miền đang đóng (không xếp hàng).
   */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    if (this.disposing) return Promise.reject(new DomainError("closed", `domain '${this.name}' is closed`));
    const result = this.chain.then(job);
    this.chain = result.then(noop, noop);
    return result;
  }

  /**
   * Chặn lượt ĐỌC sau khi miền đã đóng hẳn.
   * Nhận: không.
   * Trả: không; NÉM `closed` khi đã đóng xong.
   */
  private assertReadable(): void {
    if (this.closed) throw new DomainError("closed", `domain '${this.name}' is closed`);
  }
}

/** Handle bảng buộc vào MỘT bảng ghi trong bộ nhớ và chuỗi ghi của miền sở hữu nó. */
class KvTableImpl {
  private readonly host: DomainHost;
  private readonly tableName: string;
  private readonly records: Map<string, unknown>;

  /**
   * Dựng handle bảng.
   * Nhận: bề mặt nội bộ của miền (`host`), tên bảng (`tableName`), và bảng ghi ĐÃ KIỂM của bảng đó
   * (`records` — chính vật thể mà miền giữ, không sao chép).
   * Trả: handle mới; mọi lượt đọc/ghi đi qua `host`.
   */
  constructor(host: DomainHost, tableName: string, records: Map<string, unknown>) {
    this.host = host;
    this.tableName = tableName;
    this.records = records;
  }

  /**
   * Đọc một bản ghi, đồng bộ từ bộ nhớ.
   * Nhận: khoá bản ghi.
   * Trả: bản ghi hoặc `undefined`; NÉM `closed` khi miền đã đóng.
   */
  get(key: string): unknown {
    this.host.assertReadable();
    return this.records.get(key);
  }

  /**
   * Ảnh chụp cặp `[khoá, bản ghi]` tại thời điểm gọi.
   * Nhận: không.
   * Trả: iterator của MỘT mảng mới (sửa mảng này không chạm bảng ghi).
   */
  entries(): IterableIterator<[string, unknown]> {
    this.host.assertReadable();
    return [...this.records.entries()][Symbol.iterator]();
  }

  /**
   * Ảnh chụp các khoá tại thời điểm gọi.
   * Nhận: không.
   * Trả: iterator của MỘT mảng khoá mới.
   */
  keys(): IterableIterator<string> {
    this.host.assertReadable();
    return [...this.records.keys()][Symbol.iterator]();
  }

  /** Số bản ghi hiện tại (đọc từ bộ nhớ; NÉM `closed` khi miền đã đóng). */
  get size(): number {
    this.host.assertReadable();
    return this.records.size;
  }

  /**
   * Ghi đè một bản ghi cho bền rồi mới sửa bộ nhớ.
   * Nhận: khoá và bản ghi mới đầy đủ.
   * Trả: promise phân giải sau khi bền + đã phát `domain/changed`; lượt ghi backend hỏng thì bộ nhớ
   *      KHÔNG đổi (không phân kỳ giữa đọc và môi trường lưu).
   */
  put(key: string, value: unknown): Promise<void> {
    return this.host.enqueue(async () => {
      await this.host.unit.putRecord(this.tableName, key, value);
      this.records.set(key, value);
      this.emitPut(key, value);
    });
  }

  /**
   * Xoá một bản ghi cho bền.
   * Nhận: khoá bản ghi.
   * Trả: `true` khi bản ghi CÓ; `false` khi đã vắng sẵn (KHÔNG ghi, KHÔNG phát sự kiện).
   */
  delete(key: string): Promise<boolean> {
    return this.host.enqueue(async () => {
      if (!this.records.has(key)) return false;
      await this.host.unit.deleteRecord(this.tableName, key);
      this.records.delete(key);
      this.host.emitChanged({ domain: this.host.domainName, table: this.tableName, key, operation: "deleted" });
      return true;
    });
  }

  /**
   * Đọc-sửa-ghi trên chuỗi ghi của miền.
   * Nhận: khoá bản ghi và phép biến đổi thuần từ bản ghi hiện tại sang bản ghi kế.
   * Trả: bản ghi kế đã lưu; NÉM `missing-key` khi khoá vắng.
   */
  update(key: string, fn: (current: unknown) => unknown): Promise<unknown> {
    return this.host.enqueue(async () => {
      if (!this.records.has(key)) {
        throw new DomainError(
          "missing-key",
          `domain '${this.host.domainName}' table '${this.tableName}' has no record '${key}' to update`,
        );
      }
      const next = fn(this.records.get(key));
      await this.host.unit.putRecord(this.tableName, key, next);
      this.records.set(key, next);
      this.emitPut(key, next);
      return next;
    });
  }

  /**
   * Phát lượt đổi kiểu `put` của MỘT bản ghi.
   * Nhận: khoá và bản ghi mới.
   * Trả: không.
   */
  private emitPut(key: string, value: unknown): void {
    this.host.emitChanged({ domain: this.host.domainName, table: this.tableName, key, operation: "put", value });
  }
}
