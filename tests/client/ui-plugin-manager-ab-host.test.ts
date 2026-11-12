/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test A/B CHÍNH THỨC nửa HOST của row ui-plugin-manager: build thật bằng build.ts ra /tmp rồi so
 *      artifact của ta (B) với bundle gốc trong kernel (A) — tập export, static Config, đăng ký service
 *      trên Context cordis THẬT (provide/effect/slot), hằng chuỗi, và mọi đường lỗi quan sát được.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";

import { buildPackage } from "../../packages/client/ui-plugin-manager/build.ts";

/** Gốc repo (tests/client -> repo). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "client", "ui-plugin-manager");
/** Thư mục bản gốc trong kernel (CHỈ ĐỌC) — oracle của phép A/B. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-plugin-manager");
/** Artifact nửa host của bản gốc. */
const STOCK_ENTRY = join(STOCK_DIR, "lib", "index.js");
/** Thư mục build B — đúng hợp đồng /tmp/gbh-pm-ab-<tên>. */
const BUILD_DIR = "/tmp/gbh-pm-ab-host";
/** Thư mục `@deepseek-ai` của KERNEL — mount thật symlink MỌI peer về đây, và A cũng nạp từ đây. */
const KERNEL_AI = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** cordis của kernel — CÙNG thể hiện mà cả A và B nạp. */
const CORDIS_ENTRY = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** dsh-timeout: nguồn của trần MAX_TIMER_DELAY_MS trong schema. */
const TIMEOUT_ENTRY = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-timeout", "lib", "index.js");
/** typert-protocol: seam RPC mà lớp phải kế thừa + bộ đọc marker Remote. */
const TYPERT_ENTRY = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-typert-protocol", "lib", "index.js");

// Dọn và build lại MỖI lượt chạy: chỉ xoá đúng thư mục /tmp đã định danh, không bao giờ xoá đường dẫn tính toán.
if (resolve(BUILD_DIR) !== BUILD_DIR) throw new Error("thư mục build A/B không đúng định danh: " + BUILD_DIR);
rmSync(BUILD_DIR, { recursive: true, force: true });
/** Kết quả build thật của buildPackage(outDir). */
const BUILT = await buildPackage(BUILD_DIR);
// LƯỢT ĐO 01/11/2026: artifact nằm ở /tmp nên phải tự bắc cầu phân giải, nhưng cầu đó phải trỏ về
// `@deepseek-ai` của KERNEL — KHÔNG phải bản sao trong `packages/client/ui-plugin-manager/node_modules`.
// Hai bản sao cùng nội dung nhưng khác MÔ-ĐUN, nên `lớp B kế thừa ĐÚNG TypertRemoteService của kernel` và
// `instanceof protocol.TypertRemoteService` đều trượt dù hành vi y hệt. Mọi phụ thuộc ngoài của artifact
// (cordis · dsh-timeout · dsh-typert-protocol · schemastery) đều là gói @deepseek-ai nên MỘT symlink là đủ.
mkdirSync(join(BUILD_DIR, "node_modules"), { recursive: true });
symlinkSync(KERNEL_AI, join(BUILD_DIR, "node_modules", "@deepseek-ai"), "dir");
// P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
// neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(BUILD_DIR, "node_modules", "@galaxy-blackhole"), "dir");

/** Bề mặt namespace của một nửa host. */
interface ModuleSurface {
  /** Export mặc định — lớp service PluginRegistryProbe. */
  default: unknown;
}

/** Artifact nửa host của TA (B), nạp từ /tmp. */
const oursModule = (await import(BUILT.host)) as ModuleSurface;
/** Artifact nửa host của bản gốc (A), CHỈ ĐỌC. */
const stockModule = (await import(STOCK_ENTRY)) as ModuleSurface;

/** Hình dạng tối thiểu của Context cordis mà giàn dùng. */
interface CordisContext {
  /** Tầng phản chiếu dịch vụ. */
  reflect: ReflectLike;
  /** Fiber sở hữu các hiệu ứng. */
  fiber: FiberLike;
  /** Context gốc. */
  root: CordisContext;
  /** Tra dịch vụ theo tên. */
  get(name: string): unknown;
  /** Đăng ký hiệu ứng vòng đời. */
  effect(callback: () => () => unknown, label?: string): () => unknown;
  /** Nghe sự kiện. */
  on(name: string, listener: (...args: unknown[]) => unknown): () => unknown;
  /** Cấp dịch vụ. */
  provide(name: string, value: unknown): () => unknown;
}

/** Phần reflect.provide mà lớp service dùng. */
interface ReflectLike {
  /** Cấp service và trả disposer. */
  provide(name: string, value: unknown, check?: unknown): () => unknown;
}

/** Phần fiber mà ca unload dùng. */
interface FiberLike {
  /** Gỡ toàn bộ hiệu ứng của fiber. */
  dispose(): Promise<void>;
}

/** Constructor Context của cordis. */
interface ContextCtor {
  /** Tạo Context gốc mới. */
  new (): CordisContext;
}

/** Cấu hình dò registry (ba trường của bản gốc). */
interface ProbeConfig {
  /** Bật dò hay không. */
  registryProbeEnabled: boolean;
  /** Hạn chót cả lượt đua (ms). */
  registryProbeTimeoutMs: number;
  /** TTL của cache (ms). */
  registryProbeCacheTtlMs: number;
}

/** Bản ghi cache nội bộ của service. */
interface ProbeCache {
  /** Registry thắng hoặc null. */
  registry: string | null;
  /** Mốc hết hạn (ms since epoch). */
  expiresAt: number;
}

/** Bề mặt instance service sau khi dựng. */
interface ProbeService {
  /** Tên service đã đăng ký. */
  name: string;
  /** Context sở hữu (chính là ctx đưa vào). */
  ctx: unknown;
  /** Cấu hình đã gán. */
  config: ProbeConfig;
  /** Vòng đời service. */
  lifetime: AbortController;
  /** Lượt dò đang chạy. */
  pending: Promise<string | null> | undefined;
  /** Kết quả đã cache. */
  cached: ProbeCache | undefined;
  /** Liên kết Typert Gateway. */
  typertRemote: { service: unknown; serviceKey: string; namespace: string };
  /** Đua ping hai registry. */
  fastest(): Promise<string | null>;
  /** Một lượt dò (không kiểm tra unload). */
  probe(): Promise<string | null>;
}

/** Schema Config kiểu schemastery (gọi được + String() cho mô tả). */
interface SchemaLike {
  /** Chuẩn hoá cấu hình (điền default / ném khi sai). */
  (input: Record<string, unknown>): Record<string, unknown>;
  /** Mô tả hình dạng schema. */
  toString(): string;
}

/** Lớp service của một bên. */
interface ProbeClass {
  /** Dựng service trên ctx với cấu hình. */
  new (ctx: unknown, config: ProbeConfig): ProbeService;
  /** Tên lớp. */
  readonly name: string;
  /** Số tham số constructor. */
  readonly length: number;
  /** Prototype của instance. */
  readonly prototype: ProbeService;
  /** Schema cấu hình tĩnh. */
  Config: SchemaLike;
}

/** Bề mặt typert-protocol mà test dùng. */
interface ProtocolModule {
  /** Lớp cơ sở Remote Service. */
  TypertRemoteService: Function;
  /** Đọc marker Remote trên prototype của service sống. */
  remoteMethods(service: unknown): { method: string; invocation: { kind: string } }[];
}

/** Context cordis thật của kernel. */
const { Context } = (await import(CORDIS_ENTRY)) as { Context: ContextCtor };
/** Bề mặt typert-protocol dùng chung cho cả A và B. */
const protocol = (await import(TYPERT_ENTRY)) as ProtocolModule;
/** Trần thời gian chờ của kernel. */
const { MAX_TIMER_DELAY_MS } = (await import(TIMEOUT_ENTRY)) as { MAX_TIMER_DELAY_MS: number };
/** Văn bản hai artifact (so hằng chuỗi / khung export). */
const oursText = readFileSync(BUILT.host, "utf8");
/** Văn bản artifact gốc. */
const stockText = readFileSync(STOCK_ENTRY, "utf8");
/** Lớp service của ta. */
const OursClass = oursModule.default as ProbeClass;
/** Lớp service gốc. */
const StockClass = stockModule.default as ProbeClass;

/** Cấu hình dùng chung cho hầu hết ca: bật dò, hạn 500 ms, TTL 60 s. */
const CONFIG: ProbeConfig = { registryProbeEnabled: true, registryProbeTimeoutMs: 500, registryProbeCacheTtlMs: 60_000 };

/** Nhật ký hiệu ứng của một giàn. */
interface Journal {
  /** Nhãn từng lượt ctx.effect (plugin gọi không kèm nhãn). */
  effects: (string | undefined)[];
  /** Tên service của từng lượt reflect.provide. */
  provides: string[];
  /** Giá trị của từng lượt reflect.provide. */
  provided: unknown[];
  /** Occupant của từng lượt slots.register. */
  slots: unknown[];
  /** Tên sự kiện của từng lượt ctx.on. */
  ons: string[];
}

/** Seam slots giả tối thiểu — ghi lại mọi lượt register. */
interface SlotSeam {
  /** Đăng ký một occupant. */
  register(occupant: unknown): () => void;
  /** Version của slot (không dùng trong nửa host). */
  getVersion(name: string): number;
  /** Danh sách occupant (không dùng trong nửa host). */
  entries(name: string): unknown[];
}

/** Giàn đo một bên: Context thật + lớp ghi nhật ký + service đã dựng. */
interface Rig {
  /** Context thật. */
  base: CordisContext;
  /** Context proxy ghi nhật ký (chính là ctx service giữ). */
  ctx: CordisContext;
  /** Nhật ký hiệu ứng. */
  journal: Journal;
  /** Service đã dựng. */
  service: ProbeService;
}

/**
 * Dựng MỘT giàn: Context cordis THẬT + proxy chỉ ghi nhật ký ở effect/reflect.provide/on và seam slots giả.
 * Nhận: Ctor — lớp service của bên cần đo; config — cấu hình truyền cho constructor.
 * Trả: Rig gồm context thật, proxy ghi nhật ký, nhật ký và service.
 */
function createRig(Ctor: ProbeClass, config: ProbeConfig): Rig {
  const base = new Context();
  const journal: Journal = { effects: [], provides: [], provided: [], slots: [], ons: [] };
  const slots: SlotSeam = {
    register: (occupant: unknown) => {
      journal.slots.push(occupant);
      return () => undefined;
    },
    getVersion: () => 0,
    entries: () => [],
  };
  const reflect = new Proxy(base.reflect, {
    get(target, prop) {
      if (prop === "provide") {
        return (name: string, value: unknown, check?: unknown) => {
          journal.provides.push(name);
          journal.provided.push(value);
          return target.provide(name, value, check);
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const ctx = new Proxy(base, {
    get(target, prop) {
      if (prop === "effect") {
        return (callback: () => () => unknown, label?: string) => {
          journal.effects.push(label);
          return target.effect(callback, label);
        };
      }
      if (prop === "reflect") return reflect;
      if (prop === "slots") return slots;
      if (prop === "on") {
        return (name: string, listener: (...args: unknown[]) => unknown) => {
          journal.ons.push(name);
          return target.on(name, listener);
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const service = new Ctor(ctx, config);
  return { base, ctx, journal, service };
}

/** Một lượt gọi fetch mà giàn ghi lại. */
interface FetchCall {
  /** URL đầy đủ. */
  url: string;
  /** Chính sách redirect trong init. */
  redirect: RequestRedirect | undefined;
  /** Signal trong init. */
  signal: AbortSignal | undefined;
}

/** Phản hồi giả theo một lượt gọi. */
type StubHandler = (call: FetchCall) => Response | Promise<Response>;

/**
 * Dựng fetch giả có ghi nhật ký.
 * Nhận: handler — sinh Response theo từng lượt gọi.
 * Trả: fetch giả (gán được vào globalThis) + mảng calls sống.
 */
function recordingFetch(handler: StubHandler): { stub: typeof globalThis.fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const stub = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const call: FetchCall = { url: String(input), redirect: init?.redirect, signal: init?.signal ?? undefined };
    calls.push(call);
    return await handler(call);
  }) as typeof globalThis.fetch;
  return { stub, calls };
}

/**
 * Chạy một ca với fetch giả rồi KHÔI PHỤC fetch thật dù ca ném.
 * Nhận: handler — phản hồi giả; run — thân ca, nhận mảng calls.
 * Trả: kết quả của run.
 */
async function withFetch<T>(handler: StubHandler, run: (calls: FetchCall[]) => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  const { stub, calls } = recordingFetch(handler);
  globalThis.fetch = stub;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

/** Response rỗng với mã trạng thái cho trước. Nhận: status. Trả: Response. */
function response(status: number): Response {
  return new Response(null, { status });
}

/** Stub chỉ phản hồi khi signal bị huỷ — mô phỏng request treo tới hạn/unload. Nhận: call. Trả: Promise không tự resolve. */
function abortAware(call: FetchCall): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    const signal = call.signal;
    if (signal === undefined) return;
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

/**
 * Chạy cùng một thân ca trên CẢ HAI lớp rồi trả kết quả từng bên.
 * Nhận: run — thân ca nhận lớp service.
 * Trả: { ours, stock }.
 */
async function both<T>(run: (Ctor: ProbeClass) => Promise<T> | T): Promise<{ ours: T; stock: T }> {
  const stock = await run(StockClass);
  const ours = await run(OursClass);
  return { ours, stock };
}

/**
 * Bắt lỗi của một lượt gọi thành tên + thông điệp.
 * Nhận: run — hàm có thể ném.
 * Trả: { name, message } hoặc { value } khi không ném.
 */
async function outcome<T>(run: () => Promise<T>): Promise<{ value?: T; name?: string; message?: string }> {
  try {
    return { value: await run() };
  } catch (error) {
    const failure = error as Error;
    return { name: failure.name, message: failure.message };
  }
}

/**
 * Đếm số lần một chuỗi con xuất hiện.
 * Nhận: text — văn bản; needle — chuỗi con.
 * Trả: số lần xuất hiện.
 */
function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/**
 * Liệt kê tên export của một namespace ESM.
 * Nhận: ns — namespace module.
 * Trả: mảng tên đã sắp xếp.
 */
function exportNames(ns: object): string[] {
  return Object.keys(ns).sort();
}

/**
 * Đọc tên trong các khối `export { ... as name }` của văn bản ESM.
 * Nhận: text — văn bản artifact.
 * Trả: mảng tên export đã sắp xếp.
 */
function exportClauseNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/gu)) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
      if (name !== undefined && name !== "") names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * Liệt kê specifier của mọi import tĩnh.
 * Nhận: text — văn bản artifact.
 * Trả: mảng specifier duy nhất đã sắp xếp.
 */
function importSpecifiers(text: string): string[] {
  const specs = new Set<string>();
  for (const match of text.matchAll(/\bfrom\s+"([^"]+)"/gu)) {
    const spec = match[1];
    if (spec !== undefined) specs.add(spec);
  }
  return [...specs].sort();
}

/**
 * Chạy schema Config và bắt lỗi thành thông điệp.
 * Nhận: schema — Config của một bên; input — đầu vào cần kiểm.
 * Trả: { value } khi hợp lệ, { error } khi schema từ chối.
 */
function configOutcome(schema: SchemaLike, input: Record<string, unknown>): { value?: Record<string, unknown>; error?: string } {
  try {
    return { value: schema(input) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/** Cờ descriptor dùng để so cấu trúc thuộc tính. */
interface DescriptorFlags {
  /** Ghi được không. */
  writable: boolean | undefined;
  /** Duyệt được không. */
  enumerable: boolean | undefined;
  /** Cấu hình lại được không. */
  configurable: boolean | undefined;
}

/**
 * Rút ba cờ của một descriptor.
 * Nhận: target — đối tượng; key — tên thuộc tính.
 * Trả: DescriptorFlags (undefined khi không có thuộc tính).
 */
function flagsOf(target: object, key: string): DescriptorFlags {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  return { writable: descriptor?.writable, enumerable: descriptor?.enumerable, configurable: descriptor?.configurable };
}

describe("ui-plugin-manager A/B nửa host — artifact build & bề mặt export", () => {
  test("buildPackage(outDir) sinh index.js ĐÚNG thư mục /tmp/gbh-pm-ab-host", () => {
    expect(BUILT.host).toBe(join(BUILD_DIR, "index.js"));
    expect(existsSync(BUILT.host)).toBe(true);
    expect(oursText.length).toBeGreaterThan(0);
  });

  test("namespace B chỉ có default — không có named export nào", () => {
    expect(exportNames(oursModule)).toEqual(["default"]);
    expect(typeof oursModule.default).toBe("function");
  });

  test("tập export của B BẰNG tập export của A", () => {
    expect(exportNames(oursModule)).toEqual(exportNames(stockModule));
  });

  test("A cũng chỉ export default (oracle hợp lệ)", () => {
    expect(exportNames(stockModule)).toEqual(["default"]);
  });

  test("KHÔNG export apply hay Config ở cấp module (đúng bản gốc)", () => {
    expect(exportNames(oursModule)).not.toContain("apply");
    expect(exportNames(oursModule)).not.toContain("Config");
  });

  test("khối export trong văn bản artifact cũng chỉ default ở cả hai", () => {
    expect(exportClauseNames(oursText)).toEqual(["default"]);
    expect(exportClauseNames(stockText)).toEqual(exportClauseNames(oursText));
  });

  test("tên lớp PluginRegistryProbe trùng", () => {
    expect(OursClass.name).toBe("PluginRegistryProbe");
    expect(StockClass.name).toBe(OursClass.name);
  });

  test("prototype own names trùng (constructor · fastest · probe)", () => {
    expect(Object.getOwnPropertyNames(OursClass.prototype).sort()).toEqual(["constructor", "fastest", "probe"]);
    expect(Object.getOwnPropertyNames(StockClass.prototype).sort()).toEqual(Object.getOwnPropertyNames(OursClass.prototype).sort());
  });

  test("static own props trùng — chỉ Config ngoài length/name/prototype", () => {
    const statics = (Ctor: ProbeClass): string[] => Object.getOwnPropertyNames(Ctor).filter((key) => !["length", "name", "prototype"].includes(key)).sort();
    expect(statics(OursClass)).toEqual(["Config"]);
    expect(statics(StockClass)).toEqual(statics(OursClass));
  });

  test("constructor nhận đúng 2 tham số (ctx, config) ở cả hai", () => {
    expect(OursClass.length).toBe(2);
    expect(StockClass.length).toBe(OursClass.length);
  });

  test("fastest và probe đều là hàm async ở cả hai", () => {
    expect(OursClass.prototype.fastest.constructor.name).toBe("AsyncFunction");
    expect(StockClass.prototype.fastest.constructor.name).toBe(OursClass.prototype.fastest.constructor.name);
    expect(OursClass.prototype.probe.constructor.name).toBe("AsyncFunction");
    expect(StockClass.prototype.probe.constructor.name).toBe(OursClass.prototype.probe.constructor.name);
  });

  test("descriptor Config và fastest trùng cờ writable/enumerable/configurable", () => {
    expect(flagsOf(OursClass, "Config")).toEqual(flagsOf(StockClass, "Config"));
    expect(flagsOf(OursClass.prototype, "fastest")).toEqual(flagsOf(StockClass.prototype, "fastest"));
  });

  test("lớp B kế thừa ĐÚNG TypertRemoteService của kernel (cùng seam RPC)", () => {
    expect(Object.getPrototypeOf(OursClass)).toBe(protocol.TypertRemoteService);
    expect(Object.getPrototypeOf(StockClass)).toBe(protocol.TypertRemoteService);
  });
});

describe("ui-plugin-manager A/B nửa host — static Config schema", () => {
  test("cả hai đều khai static Config", () => {
    expect(typeof OursClass.Config).toBe("function");
    expect(typeof StockClass.Config).toBe("function");
  });

  test("String(Config) TRÙNG TỪNG KÝ TỰ", () => {
    expect(String(OursClass.Config)).toBe(String(StockClass.Config));
    expect(String(OursClass.Config)).toBe("{ registryProbeEnabled?: boolean, registryProbeTimeoutMs?: number, registryProbeCacheTtlMs?: number }");
  });

  test("defaults({}) trùng: bật · 1500 ms · 300000 ms", () => {
    expect(OursClass.Config({})).toEqual(StockClass.Config({}));
    expect(OursClass.Config({})).toEqual({ registryProbeEnabled: true, registryProbeTimeoutMs: 1500, registryProbeCacheTtlMs: 300_000 });
  });

  test("nhận cấu hình hợp lệ tuỳ chỉnh giống nhau", () => {
    const input = { registryProbeEnabled: false, registryProbeTimeoutMs: 2500, registryProbeCacheTtlMs: 1000 };
    expect(OursClass.Config(input)).toEqual(StockClass.Config(input));
    expect(OursClass.Config(input)).toEqual(input);
  });

  test("timeout < 1 bị từ chối, thông điệp TRÙNG", () => {
    const ours = configOutcome(OursClass.Config, { registryProbeTimeoutMs: 0 });
    const stock = configOutcome(StockClass.Config, { registryProbeTimeoutMs: 0 });
    expect(ours.error).toBe(stock.error);
    expect(ours.error).toContain(">= 1");
  });

  test("cacheTtl âm bị từ chối, thông điệp TRÙNG", () => {
    const ours = configOutcome(OursClass.Config, { registryProbeCacheTtlMs: -1 });
    const stock = configOutcome(StockClass.Config, { registryProbeCacheTtlMs: -1 });
    expect(ours.error).toBe(stock.error);
    expect(ours.error).toContain(">= 0");
  });

  test("enabled không phải boolean bị từ chối, thông điệp TRÙNG", () => {
    const ours = configOutcome(OursClass.Config, { registryProbeEnabled: "yes" });
    const stock = configOutcome(StockClass.Config, { registryProbeEnabled: "yes" });
    expect(ours.error).toBe(stock.error);
    expect(ours.error).toContain("expected boolean");
  });

  test("timeout không nguyên bị từ chối (natural), thông điệp TRÙNG", () => {
    const ours = configOutcome(OursClass.Config, { registryProbeTimeoutMs: 1.5 });
    const stock = configOutcome(StockClass.Config, { registryProbeTimeoutMs: 1.5 });
    expect(ours.error).toBe(stock.error);
    expect(ours.error).toContain("multiple of 1");
  });

  test("biên MAX_TIMER_DELAY_MS: nhận đúng MAX, từ chối MAX+1, thông điệp TRÙNG", () => {
    expect(OursClass.Config({ registryProbeTimeoutMs: MAX_TIMER_DELAY_MS }).registryProbeTimeoutMs).toBe(MAX_TIMER_DELAY_MS);
    expect(StockClass.Config({ registryProbeTimeoutMs: MAX_TIMER_DELAY_MS }).registryProbeTimeoutMs).toBe(MAX_TIMER_DELAY_MS);
    const ours = configOutcome(OursClass.Config, { registryProbeTimeoutMs: MAX_TIMER_DELAY_MS + 1 });
    const stock = configOutcome(StockClass.Config, { registryProbeTimeoutMs: MAX_TIMER_DELAY_MS + 1 });
    expect(ours.error).toBe(stock.error);
    expect(ours.error).toContain("<= " + String(MAX_TIMER_DELAY_MS));
  });
});

describe("ui-plugin-manager A/B nửa host — Context cordis THẬT: provide/effect/slot", () => {
  test("ctor provide ĐÚNG MỘT service tên pluginRegistryProbe ở cả hai", () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    expect(ours.journal.provides).toEqual(["pluginRegistryProbe"]);
    expect(stock.journal.provides).toEqual(ours.journal.provides);
    expect(ours.journal.provides.length).toBe(1);
    void ours.base.fiber.dispose();
    void stock.base.fiber.dispose();
  });

  test("service HIỆN trên ctx thật (tracker cordis) và giá trị provide ĐÚNG instance", () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    const ourVisible = ours.base.get("pluginRegistryProbe") as ProbeService | undefined;
    const stockVisible = stock.base.get("pluginRegistryProbe") as ProbeService | undefined;
    expect(typeof ourVisible).toBe("object");
    expect(typeof stockVisible).toBe("object");
    expect(ourVisible?.name).toBe("pluginRegistryProbe");
    expect(stockVisible?.name).toBe(ourVisible?.name);
    expect(ours.journal.provided[0]).toBe(ours.service);
    expect(stock.journal.provided[0]).toBe(stock.service);
    void ours.base.fiber.dispose();
    void stock.base.fiber.dispose();
  });

  test("số lượt ctx.effect = 1 và nhãn giống nhau (plugin gọi không kèm nhãn)", () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    expect(ours.journal.effects.length).toBe(1);
    expect(stock.journal.effects.length).toBe(ours.journal.effects.length);
    expect(ours.journal.effects).toEqual([undefined]);
    expect(stock.journal.effects).toEqual(ours.journal.effects);
    void ours.base.fiber.dispose();
    void stock.base.fiber.dispose();
  });

  test("KHÔNG đăng ký slot nào (nửa host không có slot)", () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    expect(ours.journal.slots.length).toBe(0);
    expect(stock.journal.slots.length).toBe(ours.journal.slots.length);
    void ours.base.fiber.dispose();
    void stock.base.fiber.dispose();
  });

  test("KHÔNG nghe sự kiện nào khi dựng", () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    expect(ours.journal.ons.length).toBe(0);
    expect(stock.journal.ons.length).toBe(ours.journal.ons.length);
    void ours.base.fiber.dispose();
    void stock.base.fiber.dispose();
  });

  test("service.name và typertRemote.serviceKey/namespace = pluginRegistryProbe", () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    expect(ours.service.name).toBe("pluginRegistryProbe");
    expect(stock.service.name).toBe(ours.service.name);
    expect(ours.service.typertRemote.serviceKey).toBe("pluginRegistryProbe");
    expect(stock.service.typertRemote.serviceKey).toBe(ours.service.typertRemote.serviceKey);
    expect(ours.service.typertRemote.namespace).toBe("pluginRegistryProbe");
    expect(stock.service.typertRemote.namespace).toBe(ours.service.typertRemote.namespace);
    void ours.base.fiber.dispose();
    void stock.base.fiber.dispose();
  });

  test("typertRemote ĐÓNG BĂNG, đủ 3 khoá, trỏ đúng service", () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    expect(Object.isFrozen(ours.service.typertRemote)).toBe(true);
    expect(Object.keys(ours.service.typertRemote)).toEqual(["service", "serviceKey", "namespace"]);
    expect(Object.keys(stock.service.typertRemote)).toEqual(Object.keys(ours.service.typertRemote));
    expect(ours.service.typertRemote.service).toBe(ours.service);
    expect(stock.service.typertRemote.service).toBe(stock.service);
    void ours.base.fiber.dispose();
    void stock.base.fiber.dispose();
  });

  test("Remote marker của fastest trùng (method + invocation.kind)", () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    expect(protocol.remoteMethods(ours.service)).toEqual(protocol.remoteMethods(stock.service));
    expect(protocol.remoteMethods(ours.service)).toEqual([{ method: "fastest", invocation: { kind: "direct" } }]);
    void ours.base.fiber.dispose();
    void stock.base.fiber.dispose();
  });

  test("instance của cùng TypertRemoteService và instanceof lớp plugin", () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    expect(ours.service instanceof protocol.TypertRemoteService).toBe(true);
    expect(stock.service instanceof protocol.TypertRemoteService).toBe(true);
    expect(ours.service instanceof OursClass).toBe(true);
    expect(stock.service instanceof StockClass).toBe(true);
    void ours.base.fiber.dispose();
    void stock.base.fiber.dispose();
  });

  test("service.ctx CHÍNH LÀ ctx đưa vào (proxy ghi nhật ký)", () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    expect(ours.service.ctx).toBe(ours.ctx);
    expect(stock.service.ctx).toBe(stock.ctx);
    void ours.base.fiber.dispose();
    void stock.base.fiber.dispose();
  });

  test("config được gán NGUYÊN VĂN (cùng tham chiếu) ở cả hai", () => {
    const ourConfig = { ...CONFIG };
    const stockConfig = { ...CONFIG };
    const ours = createRig(OursClass, ourConfig);
    const stock = createRig(StockClass, stockConfig);
    expect(ours.service.config).toBe(ourConfig);
    expect(stock.service.config).toBe(stockConfig);
    expect(ours.service.config).toEqual(stock.service.config);
    void ours.base.fiber.dispose();
    void stock.base.fiber.dispose();
  });

  test("trạng thái đầu: lifetime chưa abort, pending/cached undefined", () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    expect(ours.service.lifetime).toBeInstanceOf(AbortController);
    expect(stock.service.lifetime).toBeInstanceOf(AbortController);
    expect(ours.service.lifetime.signal.aborted).toBe(false);
    expect(stock.service.lifetime.signal.aborted).toBe(false);
    expect(ours.service.pending).toBeUndefined();
    expect(stock.service.pending).toBeUndefined();
    expect(ours.service.cached).toBeUndefined();
    expect(stock.service.cached).toBeUndefined();
    void ours.base.fiber.dispose();
    void stock.base.fiber.dispose();
  });

  test("unload Context: service BIẾN MẤT khỏi ctx.get", async () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    await ours.base.fiber.dispose();
    await stock.base.fiber.dispose();
    expect(ours.base.get("pluginRegistryProbe")).toBeUndefined();
    expect(stock.base.get("pluginRegistryProbe")).toBeUndefined();
  });

  test("unload Context: lifetime.signal.aborted = true ở cả hai", async () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    await ours.base.fiber.dispose();
    await stock.base.fiber.dispose();
    expect(ours.service.lifetime.signal.aborted).toBe(true);
    expect(stock.service.lifetime.signal.aborted).toBe(true);
  });

  test("unload rồi fastest ⇒ AbortError cùng name + message", async () => {
    const ours = createRig(OursClass, CONFIG);
    const stock = createRig(StockClass, CONFIG);
    await ours.base.fiber.dispose();
    await stock.base.fiber.dispose();
    const ourOutcome = await outcome(() => ours.service.fastest());
    const stockOutcome = await outcome(() => stock.service.fastest());
    expect(ourOutcome.name).toBe("AbortError");
    expect(stockOutcome.name).toBe(ourOutcome.name);
    expect(ourOutcome.message).toBe(stockOutcome.message);
    expect(ourOutcome.message).toBe("The operation was aborted.");
  });

  test("unload khi đang bay: lượt đang chờ trả null, 2 fetch, KHÔNG ghi cache", async () => {
    await withFetch(abortAware, async (calls) => {
      const ours = createRig(OursClass, CONFIG);
      const stock = createRig(StockClass, CONFIG);
      const ourPending = ours.service.fastest();
      const stockPending = stock.service.fastest();
      await new Promise((resolve) => setTimeout(resolve, 5));
      await ours.base.fiber.dispose();
      await stock.base.fiber.dispose();
      const ourValue = await ourPending;
      const stockValue = await stockPending;
      expect(ourValue).toBeNull();
      expect(stockValue).toBe(ourValue);
      expect(calls.length).toBe(4);
      expect(calls.filter((call) => call.url.includes("npmjs")).length).toBe(2);
      expect(ours.service.cached).toBeUndefined();
      expect(stock.service.cached).toBeUndefined();
    });
  });

  test("gọi thẳng probe() sau unload trả null (không ném)", async () => {
    await withFetch(abortAware, async () => {
      const ours = createRig(OursClass, CONFIG);
      const stock = createRig(StockClass, CONFIG);
      await ours.base.fiber.dispose();
      await stock.base.fiber.dispose();
      const ourValue = await ours.service.probe();
      const stockValue = await stock.service.probe();
      expect(ourValue).toBeNull();
      expect(stockValue).toBe(ourValue);
    });
  });
});

describe("ui-plugin-manager A/B nửa host — hành vi fastest", () => {
  test("npm thắng khi mirror chậm hơn ⇒ registry npm, 2 fetch", async () => {
    const handler: StubHandler = async (call) => {
      if (call.url.includes("npmmirror")) await new Promise((resolve) => setTimeout(resolve, 20));
      return response(200);
    };
    await withFetch(handler, async (calls) => {
      const ours = createRig(OursClass, CONFIG);
      const stock = createRig(StockClass, CONFIG);
      const ourValue = await ours.service.fastest();
      const stockValue = await stock.service.fastest();
      expect(ourValue).toBe("https://registry.npmjs.org/");
      expect(stockValue).toBe(ourValue);
      expect(calls.length).toBe(4);
      await ours.base.fiber.dispose();
      await stock.base.fiber.dispose();
    });
  });

  test("mirror thắng khi npm trả 503", async () => {
    await withFetch((call) => response(call.url.includes("npmjs") ? 503 : 200), async () => {
      const ours = createRig(OursClass, CONFIG);
      const stock = createRig(StockClass, CONFIG);
      const ourValue = await ours.service.fastest();
      const stockValue = await stock.service.fastest();
      expect(ourValue).toBe("https://registry.npmmirror.com/");
      expect(stockValue).toBe(ourValue);
      await ours.base.fiber.dispose();
      await stock.base.fiber.dispose();
    });
  });

  test("cả hai hỏng ⇒ null ở cả hai", async () => {
    await withFetch(() => response(500), async () => {
      const ours = createRig(OursClass, CONFIG);
      const stock = createRig(StockClass, CONFIG);
      expect(await ours.service.fastest()).toBeNull();
      expect(await stock.service.fastest()).toBeNull();
      await ours.base.fiber.dispose();
      await stock.base.fiber.dispose();
    });
  });

  test("fetch ném TypeError ⇒ null (lỗi mạng không thoát ra ngoài)", async () => {
    await withFetch(() => {
      throw new TypeError("boom");
    }, async () => {
      const ours = createRig(OursClass, CONFIG);
      const stock = createRig(StockClass, CONFIG);
      expect(await ours.service.fastest()).toBeNull();
      expect(await stock.service.fastest()).toBeNull();
      await ours.base.fiber.dispose();
      await stock.base.fiber.dispose();
    });
  });

  test("cache trong TTL ⇒ lần hai KHÔNG fetch thêm", async () => {
    await withFetch(() => response(200), async (calls) => {
      const ours = createRig(OursClass, CONFIG);
      const stock = createRig(StockClass, CONFIG);
      const first = await ours.service.fastest();
      const second = await ours.service.fastest();
      const stockFirst = await stock.service.fastest();
      const stockSecond = await stock.service.fastest();
      expect(second).toBe(first);
      expect(stockSecond).toBe(stockFirst);
      expect(calls.length).toBe(4);
      expect(calls.filter((call) => call.url.includes("npmjs")).length).toBe(2);
      await ours.base.fiber.dispose();
      await stock.base.fiber.dispose();
    });
  });

  test("TTL 0 ⇒ lần hai fetch lại (4 lượt cho hai bên)", async () => {
    const config: ProbeConfig = { ...CONFIG, registryProbeCacheTtlMs: 0 };
    await withFetch(() => response(200), async (calls) => {
      const ours = createRig(OursClass, config);
      const stock = createRig(StockClass, config);
      expect(await ours.service.fastest()).toBe("https://registry.npmjs.org/");
      expect(await ours.service.fastest()).toBe("https://registry.npmjs.org/");
      expect(await stock.service.fastest()).toBe("https://registry.npmjs.org/");
      expect(await stock.service.fastest()).toBe("https://registry.npmjs.org/");
      expect(calls.length).toBe(8);
      await ours.base.fiber.dispose();
      await stock.base.fiber.dispose();
    });
  });

  test("tắt dò ⇒ null và KHÔNG gọi fetch", async () => {
    const config: ProbeConfig = { ...CONFIG, registryProbeEnabled: false };
    await withFetch(() => response(200), async (calls) => {
      const ours = createRig(OursClass, config);
      const stock = createRig(StockClass, config);
      expect(await ours.service.fastest()).toBeNull();
      expect(await stock.service.fastest()).toBeNull();
      expect(calls.length).toBe(0);
      await ours.base.fiber.dispose();
      await stock.base.fiber.dispose();
    });
  });

  test("hai người đọc đồng thời DÙNG CHUNG một lượt dò", async () => {
    const handler: StubHandler = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return response(200);
    };
    await withFetch(handler, async (calls) => {
      const ours = createRig(OursClass, CONFIG);
      const stock = createRig(StockClass, CONFIG);
      const [ourA, ourB] = await Promise.all([ours.service.fastest(), ours.service.fastest()]);
      const [stockA, stockB] = await Promise.all([stock.service.fastest(), stock.service.fastest()]);
      expect(ourA).toBe("https://registry.npmjs.org/");
      expect(ourB).toBe(ourA);
      expect(stockA).toBe(ourA);
      expect(stockB).toBe(stockA);
      expect(calls.length).toBe(4);
      await ours.base.fiber.dispose();
      await stock.base.fiber.dispose();
    });
  });

  test("quá hạn chót ⇒ null sau ~30 ms, 2 fetch mỗi bên", async () => {
    const config: ProbeConfig = { ...CONFIG, registryProbeTimeoutMs: 30 };
    await withFetch(abortAware, async (calls) => {
      const ours = createRig(OursClass, config);
      const stock = createRig(StockClass, config);
      const startedAt = Date.now();
      const ourValue = await ours.service.fastest();
      const stockValue = await stock.service.fastest();
      expect(ourValue).toBeNull();
      expect(stockValue).toBe(ourValue);
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(20);
      expect(calls.length).toBe(4);
      await ours.base.fiber.dispose();
      await stock.base.fiber.dispose();
    });
  });

  test("đóng body của cả hai response (cancel ×2 mỗi bên)", async () => {
    let cancels = 0;
    const stream = (): ReadableStream =>
      new ReadableStream({
        cancel() {
          cancels += 1;
        },
      });
    await withFetch(() => new Response(stream(), { status: 200 }), async () => {
      const ours = createRig(OursClass, CONFIG);
      const stock = createRig(StockClass, CONFIG);
      expect(await ours.service.fastest()).toBe("https://registry.npmjs.org/");
      expect(await stock.service.fastest()).toBe("https://registry.npmjs.org/");
      expect(cancels).toBe(4);
      await ours.base.fiber.dispose();
      await stock.base.fiber.dispose();
    });
  });

  test("tham số fetch trùng: thứ tự npm→mirror, redirect error, có signal", async () => {
    await withFetch(() => response(200), async (calls) => {
      const ours = createRig(OursClass, CONFIG);
      const stock = createRig(StockClass, CONFIG);
      await ours.service.fastest();
      await stock.service.fastest();
      const shape = calls.map((call) => ({ url: call.url, redirect: call.redirect, hasSignal: call.signal !== undefined }));
      expect(shape.slice(0, 2)).toEqual(shape.slice(2, 4));
      expect(shape[0]?.url).toBe("https://registry.npmjs.org/-/ping");
      expect(shape[1]?.url).toBe("https://registry.npmmirror.com/-/ping");
      expect(shape[0]?.redirect).toBe("error");
      expect(shape[0]?.hasSignal).toBe(true);
      await ours.base.fiber.dispose();
      await stock.base.fiber.dispose();
    });
  });
});

describe("ui-plugin-manager A/B nửa host — hằng số/id chuỗi trong artifact", () => {
  test("service key xuất hiện đúng MỘT lần ở mỗi bản", () => {
    expect(countOf(oursText, '"pluginRegistryProbe"')).toBe(1);
    expect(countOf(stockText, '"pluginRegistryProbe"')).toBe(countOf(oursText, '"pluginRegistryProbe"'));
  });

  test("hai endpoint ping xuất hiện đúng một lần, npm TRƯỚC mirror", () => {
    const npm = "https://registry.npmjs.org/-/ping";
    const mirror = "https://registry.npmmirror.com/-/ping";
    expect(countOf(oursText, npm)).toBe(1);
    expect(countOf(stockText, npm)).toBe(countOf(oursText, npm));
    expect(countOf(oursText, mirror)).toBe(1);
    expect(countOf(stockText, mirror)).toBe(countOf(oursText, mirror));
    expect(oursText.indexOf(npm)).toBeLessThan(oursText.indexOf(mirror));
    expect(stockText.indexOf(npm)).toBeLessThan(stockText.indexOf(mirror));
  });

  test("thông điệp 'Registry ping returned HTTP ' trùng số lần xuất hiện", () => {
    const message = "Registry ping returned HTTP ";
    expect(countOf(oursText, message)).toBe(1);
    expect(countOf(stockText, message)).toBe(countOf(oursText, message));
  });

  test("redirect \"error\" xuất hiện đúng một lần ở mỗi bản", () => {
    expect(countOf(oursText, 'redirect: "error"')).toBe(1);
    expect(countOf(stockText, 'redirect: "error"')).toBe(countOf(oursText, 'redirect: "error"'));
  });

  test("import tĩnh chỉ 3 gói phụ thuộc ngoài, tập TRÙNG", () => {
    const expected = ["@deepseek-ai/dsh-timeout", "@deepseek-ai/dsh-typert-protocol", "@deepseek-ai/schemastery"];
    expect(importSpecifiers(oursText)).toEqual(expected);
    expect(importSpecifiers(stockText)).toEqual(importSpecifiers(oursText));
  });

  test("host artifact KHÔNG kéo nửa client (không __ModuleLoader__/data-plugin-css)", () => {
    expect(oursText.includes("__ModuleLoader__")).toBe(false);
    expect(oursText.includes("data-plugin-css")).toBe(false);
    expect(stockText.includes("__ModuleLoader__")).toBe(false);
    expect(stockText.includes("data-plugin-css")).toBe(false);
  });
});
