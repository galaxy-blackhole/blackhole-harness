/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Mo hinh resource phia browser: ctx.resources (provider theo protocol, pin, source song) + hook useResource
 */

import { isResourceScheme } from "../scheme.ts";
import { createSnapshotStore, type SnapshotStore } from "./store.ts";

/** Trạng thái của một địa chỉ. */
export type ResourceStatus = "none" | "loading" | "live" | "failed";

/** Ảnh chụp trạng thái một địa chỉ (thứ mà §useResource§ trả về). */
export interface ResourceSnapshot<Value = unknown> {
  /** Trạng thái hiện tại. */
  status: ResourceStatus;
  /** Giá trị của frame §ok§ gần nhất; giữ lại qua một frame lỗi sau đó. */
  value: Value | undefined;
  /** Lỗi của frame gần nhất; chỉ có mặt khi §status§ là §failed§. */
  failure: unknown;
}

/** Một frame của luồng resource: §ok§ thay giá trị, ngược lại đánh dấu lỗi và giữ giá trị cũ. */
export type ResourceFrame<Value = unknown> =
  | { ok: true; value: Value }
  | { ok: false; error: unknown };

/** Bối cảnh mà §open§ nhận kèm địa chỉ. */
export interface ResourceOpenContext {
  /** Huỷ khi người giữ cuối cùng nhả resource; luồng PHẢI kết thúc khi nó huỷ. */
  readonly signal: AbortSignal;
}

/** Provider của một protocol, đăng ký qua §ctx.resources.register§. */
export interface ResourceProvider<Value = unknown> {
  /** Scheme URL mà provider này phục vụ. */
  readonly protocol: string;
  /**
   * Mở luồng frame cho một địa chỉ: frame đầu là nội dung hiện tại, các frame sau là thay đổi.
   * Nhận: địa chỉ đầy đủ (§dsh-resource://<protocol>/…§) và bối cảnh huỷ.
   * Trả: luồng frame bất đồng bộ; phải dừng khi §ctx.signal§ huỷ.
   */
  open(address: string, ctx: ResourceOpenContext): AsyncIterable<ResourceFrame<Value>>;
}

/** Bề mặt §ctx.resources§ mà các row khác inject để dùng. */
export interface Resources {
  /**
   * Đăng ký provider cho một protocol trong vòng đời của người gọi.
   * Nhận: provider của protocol đó.
   * Trả: hàm huỷ idempotent.
   * @throws khi protocol đã có provider.
   */
  register<Value>(provider: ResourceProvider<Value>): () => void;
  /**
   * Giữ một resource mở mà KHÔNG đăng ký nghe.
   * Nhận: địa chỉ đầy đủ và tín hiệu huỷ (signal đã huỷ thì không giữ gì).
   * Trả: không.
   */
  pin(address: string, signal: AbortSignal): void;
  /**
   * Nguồn sống của một resource; ổn định tham chiếu cho một địa chỉ trong lúc nó được giữ.
   * Nhận: địa chỉ đầy đủ.
   * Trả: nguồn quan sát được; §getSnapshot§ đọc mà không giữ resource.
   */
  source(address: string): { getSnapshot(): ResourceSnapshot; subscribe(listener: () => void): () => void };
}

/** Context mà plugin này cần: một bảng §provide§, một §effect§, và service §slots§ của tầng trên. */
export interface ResourceContext {
  /** Đăng ký một hiệu ứng vào vòng đời plugin; trả hàm huỷ. */
  effect(callback: () => () => void, label?: string): () => void;
  /** Bảng công bố service của cordis. */
  reflect: { provide(name: string, value: unknown): () => void };
  /** Tầng slots của vỏ: nơi hook gốc §resource§ được đóng góp. */
  slots: { provideRoot(root: { keyedHooks: { resource: (address: string) => unknown } }): void };
}

/**
 * Protocol key của một địa chỉ: host của URL resource (đã hạ chữ thường).
 *
 * 18/10/2026 (task-29): chấp nhận CẢ HAI scheme — `gbh-resource://` (client phát) và
 * `dsh-resource://` (plugin ngoài / địa chỉ đã ghi trong lịch sử phiên). Scheme khác
 * (http:, file:, gbh-lạ:) hoặc URL không phân tích được ⇒ không nêu protocol nào.
 * Nhận: địa chỉ đầy đủ.
 * Trả: protocol key, hoặc undefined khi không phải địa chỉ resource.
 */
export function protocolOf(address: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(address);
  } catch {
    return undefined;
  }
  if (!isResourceScheme(parsed.protocol)) return undefined;
  return parsed.hostname === "" ? undefined : parsed.hostname.toLowerCase();
}


/** Ảnh chụp rỗng ở một trạng thái. */
function idle(status: ResourceStatus): ResourceSnapshot {
  return { status, value: undefined, failure: undefined };
}

/** Một địa chỉ đã có bản ghi: nguồn của nó, số người giữ, và controller của luồng đang mở. */
interface ResourceRecord {
  /** Địa chỉ đầy đủ. */
  address: string;
  /** Protocol key, hoặc undefined khi không phải địa chỉ resource. */
  protocol: string | undefined;
  /** Store trạng thái của địa chỉ. */
  store: SnapshotStore<ResourceSnapshot>;
  /** Số người giữ (người nghe hoặc pin). */
  holders: number;
  /** Controller của luồng đang mở, hoặc undefined. */
  controller: AbortController | undefined;
  /** Nguồn công khai của địa chỉ. */
  source: { getSnapshot(): ResourceSnapshot; subscribe(listener: () => void): () => void };
}

/**
 * Cài đặt §ctx.resources§: provider theo protocol, pin, và nguồn sống theo từng địa chỉ.
 * Một resource mở khi còn ít nhất một người nghe hoặc một pin; khi người giữ cuối cùng nhả thì luồng
 * của provider bị huỷ và trạng thái bị xoá về §none§/§loading§ — đúng như bản gốc.
 */
export class ResourceRegistry implements Resources {
  private readonly ctx: Pick<ResourceContext, "effect">;
  private readonly providers = new Map<string, ResourceProvider>();
  private readonly records = new Map<string, ResourceRecord>();

  /**
   * Dựng mô hình resource trên context của plugin (các hiệu ứng đăng ký provider thuộc context này).
   * Nhận: context có §effect§.
   * Trả: thực thể mô hình.
   */
  constructor(ctx: Pick<ResourceContext, "effect">) {
    this.ctx = ctx;
  }

  /**
   * Đăng ký provider cho một protocol trong vòng đời của người gọi.
   * Nhận: provider.
   * Trả: hàm huỷ idempotent.
   * @throws khi protocol đã có provider.
   */
  register<Value>(provider: ResourceProvider<Value>): () => void {
    const runtime = provider as ResourceProvider;
    const protocol = runtime.protocol;
    if (this.providers.has(protocol)) throw new Error('resources: protocol "' + protocol + '" already has a provider');
    const dispose = this.ctx.effect(() => {
      this.providers.set(protocol, runtime);
      for (const record of this.recordsOf(protocol)) this.attach(record);
      return () => {
        this.providers.delete(protocol);
        for (const record of this.recordsOf(protocol)) this.detach(record);
      };
    }, "resources.register(" + JSON.stringify(protocol) + ")");
    return () => {
      dispose();
    };
  }

/**
   * Giữ một resource mở mà không đăng ký nghe.
   * Nhận: địa chỉ và tín hiệu huỷ.
   * Trả: không.
   */
  pin(address: string, signal: AbortSignal): void {
    if (signal.aborted) return;
    const record = this.record(address);
    this.hold(record);
    signal.addEventListener("abort", () => {
      this.release(record);
    }, { once: true });
  }

/**
   * Nguồn sống của một địa chỉ.
   * Nhận: địa chỉ đầy đủ.
   * Trả: nguồn quan sát được của địa chỉ đó.
   */
  source(address: string): { getSnapshot(): ResourceSnapshot; subscribe(listener: () => void): () => void } {
    return this.record(address).source;
  }

  /** Lấy hoặc tạo bản ghi của một địa chỉ. */
  private record(address: string): ResourceRecord {
    let record = this.records.get(address);
    if (record === undefined) {
      record = this.create(address);
      this.records.set(address, record);
    }
    return record;
  }

  /** Tạo bản ghi cho một địa chỉ: store trạng thái + nguồn công khai giữ/nhả resource theo người nghe. */
  private create(address: string): ResourceRecord {
    const protocol = protocolOf(address);
    const store = createSnapshotStore(idle(this.providerOf(protocol) === undefined ? "none" : "loading"));
    const record: ResourceRecord = {
      address,
      protocol,
      store,
      holders: 0,
      controller: undefined,
      source: {
        getSnapshot: () => store.getSnapshot(),
        subscribe: (listener: () => void) => {
          const unsubscribe = store.subscribe(listener);
          this.hold(record);
          let active = true;
          return () => {
            if (!active) return;
            active = false;
            unsubscribe();
            this.release(record);
          };
        },
      },
    };
    return record;
  }

  /** Provider của một protocol, hoặc undefined khi chưa ai đăng ký. */
  private providerOf(protocol: string | undefined): ResourceProvider | undefined {
    return protocol === undefined ? undefined : this.providers.get(protocol);
  }

  /** Mọi bản ghi thuộc một protocol. */
  private *recordsOf(protocol: string): Generator<ResourceRecord> {
    for (const record of this.records.values()) if (record.protocol === protocol) yield record;
  }

  /** Thêm một người giữ; người đầu tiên mở luồng. */
  private hold(record: ResourceRecord): void {
    record.holders += 1;
    if (record.holders === 1) this.start(record);
  }

  /** Bớt một người giữ; người cuối cùng nhả thì dừng luồng và xoá trạng thái. */
  private release(record: ResourceRecord): void {
    record.holders -= 1;
    if (record.holders > 0) return;
    this.stop(record);
    record.store.set(idle(this.providerOf(record.protocol) === undefined ? "none" : "loading"));
  }

  /** Provider vừa đến: bản ghi đang được giữ thì mở luồng, bản ghi rảnh thì chuyển sang §loading§. */
  private attach(record: ResourceRecord): void {
    if (record.holders > 0) {
      this.start(record);
      return;
    }
    record.store.set(idle("loading"));
  }

  /** Provider vừa đi: dừng luồng và báo §none§. */
  private detach(record: ResourceRecord): void {
    this.stop(record);
    record.store.set(idle("none"));
  }

  /** Mở luồng của provider cho một bản ghi đang được giữ. */
  private start(record: ResourceRecord): void {
    const provider = this.providerOf(record.protocol);
    if (provider === undefined) return;
    const controller = new AbortController();
    record.controller = controller;
    if (record.store.getSnapshot().status !== "loading") record.store.set(idle("loading"));
    void this.consume(record, provider, controller.signal);
  }

  /** Dừng luồng đang mở của một bản ghi. */
  private stop(record: ResourceRecord): void {
    record.controller?.abort();
    record.controller = undefined;
  }

  /** Tiêu thụ luồng frame: §ok§ thay giá trị, lỗi giữ giá trị cũ và báo §failed§; lỗi lập trình để lộ ra. */
  private async consume(record: ResourceRecord, provider: ResourceProvider, signal: AbortSignal): Promise<void> {
    const stream = provider.open(record.address, { signal });
    for await (const frame of stream) {
      if (signal.aborted) break;
      record.store.set(
        frame.ok
          ? { status: "live", value: frame.value, failure: undefined }
          : { status: "failed", value: record.store.getSnapshot().value, failure: frame.error },
      );
    }
  }
}

