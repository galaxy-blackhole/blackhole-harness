/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test A/B cho row agent-preset-registry: đo ARTIFACT của ta đối chứng TRỰC TIẾP bundle gốc trên Context cordis THẬT — export surface, inject/Config, defaultId, projection agentPreset, entryListProblem, audit · rò service · lỗi mount, composition inventory, và lớp Registry (register · list · read · select · C6 danh tính).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/agent-preset-registry/build.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "agent-preset-registry");
/** Thư mục `@deepseek-ai` của KERNEL (mount thật symlink mọi peer về đây) — rig cũng phải nạp từ đây. */
const KERNEL_AI = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** Bundle GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(KERNEL_AI, "dsh-agent-preset-registry", "lib", "index.js");
// LƯỢT ĐO 01/11/2026: `cordis`/`dsh-scope` dưới đây phải trỏ KERNEL, không phải `PKG/node_modules` — bản sao
// workspace khác MÔ-ĐUN, mà `dsh-scope` đánh dấu scope bằng `Symbol()` cục bộ mô-đun nên bản gốc không nhận ra.
/** cordis của KERNEL — cùng một mô-đun với bản gốc để `Service`/`Context` khớp danh tính lớp. */
const CORDIS = join(KERNEL_AI, "cordis", "lib", "index.js");
/** scope của KERNEL — dựng scope THẬT cho revision preset và cho Agent. */
const SCOPE = join(KERNEL_AI, "dsh-scope", "lib", "index.js");
/** Thư mục build tạm (nằm dưới lib/, đã được cổng lint miễn trừ) và artifact của ta trong đó. */
const OUT = join(PKG, "lib", ".test-build");
const ARTIFACT = join(OUT, "index.js");
/** Khoá ghi của tham chiếu volatile (cosmokit) — dùng để đổi preset đã chọn trong bộ nhớ. */
const VOLATILE_WRITE = Symbol.for("cosmokit.volatile.write");
/** Khoá dọn của lease (Symbol.asyncDispose của runtime, đọc động để không phụ thuộc lib ES2024). */
const ASYNC_DISPOSE = (Symbol as unknown as { readonly asyncDispose: symbol }).asyncDispose;

/** Một fiber nhìn qua góc hẹp: đủ cho membership theo định danh vật thể. */
interface FiberLike {
  /** Fiber cha (chính nó khi là gốc). */
  readonly parent: { readonly fiber: FiberLike };
}
/** Store service của cordis nhìn qua góc hẹp. */
interface StoreImpl {
  /** Tên service. */
  readonly name: string;
  /** Fiber sở hữu impl. */
  readonly fiber: unknown;
  /** Giá trị service. */
  value: unknown;
}
/** Context cordis THẬT nhìn qua đúng phần file này chạm tới. */
interface ContextLike {
  /** Cấp một service cho context. */
  provide(name: string, value: unknown): void;
  /** Đọc một service (không ném khi thiếu). */
  get(name: string): unknown;
  /** Nghe một sự kiện; trả hàm dọn. */
  on(event: string, listener: (...args: unknown[]) => unknown): () => void;
  /** Phát một sự kiện. */
  emit(event: string, ...args: unknown[]): void;
  /** Tiêm service và chạy callback khi sẵn sàng. */
  inject(names: readonly string[], callback: (child: ContextLike) => void): unknown;
  /** Đăng ký effect thuộc vòng đời context. */
  effect(callback: () => () => unknown, label?: string): unknown;
  /** Tạo context con có realm riêng cho một service. */
  isolate(name: string): ContextLike;
  /** Fiber của context. */
  readonly fiber: FiberLike & { await(): Promise<void>; readonly state: unknown };
  /** Store service thật của cordis. */
  readonly reflect: { readonly store: Record<symbol, StoreImpl | undefined> };
  /** Context gốc (mang bảng realm isolate). */
  readonly root: Record<symbol, Record<string, symbol> | undefined>;
}
/** Mặt tĩnh của Context cordis mà file này dùng. */
interface ContextClass {
  /** Dựng context gốc. */
  new (): ContextLike;
  /** Khoá bảng realm isolate. */
  readonly isolate: symbol;
}
/** Một scope do dsh-scope cấp: context đã gắn khoá scope + ranh giới dọn. */
interface ScopeHandle {
  /** Context của scope. */
  readonly ctx: ContextLike;
  /** Dọn scope (idempotent). */
  dispose(): Promise<void>;
}
/** Trạng thái chiếu của phiên nhìn qua góc hẹp. */
interface ProjectionLike {
  /** Khoá chiếu. */
  readonly key: string;
  /** Phiên bản trạng thái. */
  readonly stateVersion: number;
  /** Schema trạng thái (zod). */
  readonly stateSchema: { safeParse(value: unknown): { readonly success: boolean; readonly data?: unknown } };
  /** Khởi tạo từ header phiên. */
  init(header: { readonly agentPreset?: string | null }): string | null;
  /** Áp một event của phiên. */
  apply(state: string | null, event: { readonly type: string; readonly data?: { readonly agentPreset?: string | null } }): string | null;
  /** Mặt wire của chiếu. */
  readonly wire: { readonly viewSchema: unknown; readonly view: (state: string | null) => string | null };
}
/** Cấu hình đã validate của registry. */
interface ConfigLike {
  /** Preset mặc định. */
  readonly default: string;
  /** Tham chiếu volatile tới preset đã chọn. */
  readonly selectedDefault?: { get(): string | undefined };
}
/** Schema Config của schemastery (hàm validate + toString). */
interface ConfigSchema {
  /** Validate một giá trị thô. */
  (value: unknown): ConfigLike;
  /** Chuỗi mô tả schema. */
  toString(): string;
}
/** Một hàng entry Cordis như YAML đã parse. */
interface EntryRowLike {
  /** Id tuỳ chọn. */
  readonly id?: string;
  /** Tên plugin. */
  readonly name: string;
  /** true khi là nhóm. */
  readonly group?: boolean;
  /** Node disabled thô. */
  readonly disabled?: unknown;
  /** Hàng con của nhóm. */
  readonly config?: readonly EntryRowLike[];
}
/** Một định nghĩa preset do plugin khai. */
interface PresetDefinitionLike {
  /** Danh tính. */
  readonly id: string;
  /** Tên hiển thị. */
  readonly name?: string;
  /** Mô tả. */
  readonly description?: string;
  /** Thứ tự hiển thị. */
  readonly order?: number;
  /** Danh sách plugin con. */
  readonly plugins: readonly EntryRowLike[];
}
/** Một hàng roster preset. */
interface PresetRowLike {
  /** Danh tính. */
  readonly id: string;
  /** Tên hiển thị. */
  readonly name?: string;
  /** Mô tả. */
  readonly description?: string;
  /** Thứ tự. */
  readonly order?: number;
  /** Chẩn đoán khi preset hỏng. */
  readonly broken?: string;
  /** true khi là preset mặc định. */
  readonly isDefault?: boolean;
}
/** Một module preset đang hoạt động trong revision. */
interface ActiveModuleLike {
  /** Tên module. */
  readonly moduleName: string;
  /** Base URL nơi nạp module. */
  readonly baseUrl?: string;
  /** true khi dùng base của Host. */
  readonly useHostBase: boolean;
}
/** Một bản chụp composition của revision. */
interface InspectionLike {
  /** Danh tính preset. */
  readonly id: string;
  /** Module đang hoạt động. */
  readonly modules: readonly ActiveModuleLike[];
  /** Service rò khỏi realm của preset. */
  readonly leakedServices: readonly string[];
}
/** Agent nhìn qua góc hẹp của select. */
interface AgentLike {
  /** Id phiên. */
  readonly id: string;
  /** Log phiên giả. */
  readonly session: unknown;
  /** Context Agent (scope thật). */
  readonly ctx: unknown;
}
/** Một entry của cây audit (đúng phần auditRows đọc). */
interface AuditEntryLike {
  /** true khi hàng bị tắt. */
  readonly disabled: boolean;
  /** Tuỳ chọn entry. */
  readonly options: { readonly id: string; readonly name: string };
  /** Fiber của entry. */
  readonly fiber?: {
    readonly inject: Record<string, unknown>;
    readonly ctx: { get(name: string): unknown };
    await(): Promise<void>;
  };
}
/** Một cây audit (đúng phần auditRows đọc). */
interface AuditTreeLike {
  /** Chờ cây ổn định. */
  await(): Promise<void>;
  /** Duyệt entry. */
  entries(): Iterable<AuditEntryLike>;
}
/** Registry instance nhìn qua góc hẹp. */
interface RegistryLike {
  /** Tên service đã đăng ký. */
  readonly name: string;
  /** Cấu hình đã validate. */
  readonly config: ConfigLike;
  /** Preset mặc định hiện tại. */
  readonly defaultId: string;
  /** Đăng ký + nạp một định nghĩa. */
  register(definition: PresetDefinitionLike): Promise<() => Promise<void>>;
  /** Roster thô. */
  list(): Promise<PresetRowLike[]>;
  /** Roster cho Remote list. */
  remoteExportList(): Promise<{ readonly presets: PresetRowLike[] }>;
  /** Đọc khai báo dưới dạng YAML. */
  readDocument(agentPreset: string): Promise<{ readonly agentPreset: string; readonly content: string; readonly name?: string; readonly description?: string }>;
  /** Phân giải danh tính. */
  resolve(id?: string): Promise<{ readonly id: string; readonly broken?: string }>;
  /** Chọn preset trước lượt đầu. */
  select(agent: AgentLike, agentPreset: string): Promise<string>;
  /** Bind Agent vào revision của preset. */
  mount(ctx: unknown, id?: string): Promise<{ readonly id: string }>;
  /** Giữ revision cho một lượt đọc (lease mang khoá + Symbol.asyncDispose). */
  acquireScope(id?: string): Promise<object>;
  /** Hàng plugin cho plugin inventory. */
  compositionInventory(): Promise<readonly Record<string, unknown>[]>;
  /** Soi revision đang giữ. */
  inspectCompositions(ctx?: unknown): readonly InspectionLike[];
  /** Cho Agent con thừa kế revision của cha. */
  composeFrom(ctx: unknown, parent: unknown): string | undefined;
  /** Preset mà một Agent đang dùng. */
  composedPreset(ctx: unknown): string | undefined;
  /** Service do revision cấp. */
  serviceFor(agent: { readonly ctx: unknown }, name: string): unknown;
}
/** Mặt module của một bản (gốc hoặc artifact): đúng 6 export runtime. */
interface RegistryModule {
  /** Class registry. */
  readonly AgentPresetRegistry: {
    new (ctx: unknown, config: ConfigLike): RegistryLike;
    readonly inject: readonly string[];
    readonly Config: ConfigSchema;
  };
  /** Export default — phải CHÍNH LÀ class. */
  readonly default: RegistryModule["AgentPresetRegistry"];
  /** Định nghĩa projection agentPreset. */
  readonly agentPresetProjectionDefinition: ProjectionLike;
  /** Audit một cây đã mount. */
  readonly auditRows: (tree: AuditTreeLike) => Promise<{ readonly failed: string[]; readonly pending: string[] }>;
  /** Kiểm danh sách entry đã parse. */
  readonly entryListProblem: (rows: unknown, at?: string) => string | undefined;
  /** Tên service rò khỏi realm gốc. */
  readonly leakedServices: (ctx: unknown, mount: unknown) => string[];
}
/** Loader giả tối thiểu: đủ để EntryTree nạp cordis:<builtin> trên Context thật. */
interface LoaderFake {
  /** Context gốc — Entry dựng context của nó từ đây. */
  readonly ctx: ContextLike;
  /** Builtin plugin của Loader. */
  readonly builtins: Record<string, (ctx: unknown) => void>;
  /** Chuẩn hoá export của module đã nạp. */
  unwrapExports(value: unknown): unknown;
  /** Log của Loader (không in). */
  showLog(): void;
  /** Task đang chờ của Loader (rỗng). */
  getTasks(): unknown[];
  /** Module loader nội bộ (không dùng). */
  readonly internal: undefined;
  /** Chờ cây Host ổn định. */
  await(): Promise<void>;
  /** Entry của cây Host (rỗng). */
  entries(): Iterable<unknown>;
}
/** Một rig: Context cordis THẬT + các seam giả tối thiểu + registry của MỘT bản. */
interface Rig {
  /** Context thật của rig. */
  readonly ctx: ContextLike;
  /** Các định nghĩa chiếu đã đăng ký. */
  readonly registered: ProjectionLike[];
  /** Các lượt settings.configure. */
  readonly settings: { readonly calls: { readonly auto: boolean }[] };
  /** Sự kiện agent-preset/selected đã chuyển tiếp. */
  readonly forwarded: [string, unknown][];
  /** Loader giả. */
  readonly loader: LoaderFake;
  /** Cấu hình đã validate. */
  readonly config: ConfigLike;
  /** Registry của bản đang đo. */
  readonly registry: RegistryLike;
}
/** Log phiên giả: ghi event + trả state chiếu từ chính các event đã ghi. */
interface SessionLike {
  /** Event đã append. */
  readonly appended: { readonly type: string; readonly data: unknown }[];
  /** Trả state chiếu của phiên. */
  stateOf(key: string): unknown;
  /** Ghi một event. */
  append(type: string, data: unknown): void;
}
/** Lỗi nhìn qua góc hẹp để so A/B. */
interface ErrorView {
  /** Tên lớp lỗi. */
  readonly name: string;
  /** Thông điệp NGUYÊN VĂN. */
  readonly message: string;
  /** Mã lỗi Remote (nếu có). */
  readonly code?: unknown;
  /** Chi tiết lỗi Remote (nếu có). */
  readonly details?: unknown;
}

/** Module gốc nạp động; Context + createScope thật của kernel. */
const stockMod = (await import(STOCK)) as unknown as RegistryModule;
const { Context } = (await import(CORDIS)) as unknown as { Context: ContextClass };
const { createScope } = (await import(SCOPE)) as unknown as { createScope: (ctx: unknown, key: object) => ScopeHandle };
/** Module của TA đã build (điền trong beforeAll). */
let ourMod: RegistryModule;

beforeAll(async () => {
  await buildPackage(OUT);
  mkdirSync(join(OUT, "node_modules"), { recursive: true });
  symlinkSync(KERNEL_AI, join(OUT, "node_modules", "@deepseek-ai"), "dir"); symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OUT, "node_modules", "@galaxy-blackhole"), "dir");
  ourMod = (await import(ARTIFACT)) as unknown as RegistryModule;
});

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

/**
 * Dựng một rig trên Context cordis THẬT cho MỘT bản.
 * Nhận: mod — module cần đo; value — giá trị thô của Config (validate bằng CHÍNH schema của bản đó).
 * Trả: context thật + các seam giả + registry đã đăng ký service.
 */
function makeRig(mod: RegistryModule, value: { readonly default: string; readonly selectedDefault?: string } = { default: "p1" }): Rig {
  const ctx = new Context();
  const registered: ProjectionLike[] = [];
  const settings = { calls: [] as { readonly auto: boolean }[] };
  ctx.provide("sessionProjections", {
    register(definition: unknown): void {
      registered.push(definition as ProjectionLike);
    },
    stateOf(session: unknown, key: string): unknown {
      const own = (session as { readonly stateOf?: (name: string) => unknown }).stateOf;
      return typeof own === "function" ? own(key) : undefined;
    },
  });
  ctx.provide("settings", {
    configure(options: { readonly auto: boolean }): () => void {
      settings.calls.push(options);
      return () => {};
    },
  });
  const forwarded: [string, unknown][] = [];
  ctx.on("agent-preset/selected", (...args: unknown[]) => {
    forwarded.push([String(args[0]), args[1]]);
  });
  const loader: LoaderFake = {
    ctx,
    builtins: { trivial: () => {} },
    unwrapExports: (value: unknown) => (value as { readonly default?: unknown } | undefined)?.default ?? value,
    showLog: () => {},
    getTasks: () => [],
    internal: undefined,
    await: async () => {},
    entries: () => [],
  };
  ctx.provide("loader", loader);
  const config = mod.AgentPresetRegistry.Config(value);
  return { ctx, registered, settings, forwarded, loader, config, registry: new mod.AgentPresetRegistry(ctx, config) };
}

/**
 * Chờ một macrotask để ctx.inject chạy callback của nó.
 * Nhận: không.
 * Trả: promise đã settle sau một lượt timer.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 25));
}

/**
 * Bắt lỗi của một lượt gọi thành góc so A/B.
 * Nhận: run — hàm cần chạy.
 * Trả: tên/thông điệp/mã/chi tiết của lỗi, hoặc lỗi giả khi không ném.
 */
async function errorOf(run: () => unknown): Promise<ErrorView> {
  try {
    await run();
  } catch (thrown: unknown) {
    const error = thrown as { readonly name?: unknown; readonly message?: unknown; readonly code?: unknown; readonly details?: unknown };
    return { name: String(error.name), message: String(error.message), code: error.code, details: error.details };
  }
  return { name: "(khong nem)", message: "", code: undefined, details: undefined };
}
/**
 * Đọc tham chiếu volatile của Config, ném khi thiếu.
 * Nhận: config — cấu hình đã validate.
 * Trả: tham chiếu volatile.
 */
function volatileRefOf(config: ConfigLike): { get(): string | undefined } {
  const ref = config.selectedDefault;
  if (ref === undefined) throw new Error("Config không có tham chiếu volatile");
  return ref;
}

/**
 * Đổi giá trị của một tham chiếu volatile (đúng khoá ghi của cosmokit).
 * Nhận: ref — tham chiếu; next — giá trị mới.
 * Trả: không.
 */
function writeVolatile(ref: { get(): string | undefined }, next: string): void {
  const write = (ref as unknown as Record<symbol, ((value: string) => void) | undefined>)[VOLATILE_WRITE];
  if (write === undefined) throw new Error("tham chiếu volatile thiếu khoá ghi");
  write(next);
}
/**
 * Dựng một phiên giả có state chiếu agentPreset suy từ chính event đã append.
 * Nhận: boundary — state chiếu turnBoundary mà phiên trả.
 * Trả: phiên giả.
 */
function sessionWith(boundary: unknown): SessionLike {
  const appended: { readonly type: string; readonly data: unknown }[] = [];
  return {
    appended,
    stateOf(key: string): unknown {
      if (key === "turnBoundary") return boundary;
      if (key !== "agentPreset") return undefined;
      let state: unknown = null;
      for (const event of appended) if (event.type === "agent-preset/selected") state = (event.data as { readonly agentPreset?: unknown }).agentPreset;
      return state;
    },
    append(type: string, data: unknown): void {
      appended.push({ type, data });
    },
  };
}
/**
 * Dựng một entry audit đã start với tập inject cho trước.
 * Nhận: id — id entry; name — tên plugin; inject — tên service mà entry chờ; available — service mà
 * context cấp được.
 * Trả: entry audit.
 */
function startedEntry(id: string, name: string, inject: Record<string, unknown>, available: readonly string[]): AuditEntryLike {
  return {
    disabled: false,
    options: { id, name },
    fiber: { inject, ctx: { get: (service: string) => (available.includes(service) ? { service } : undefined) }, await: async () => {} },
  };
}

/**
 * Dựng một entry audit có fiber reject.
 * Nhận: id — id entry; name — tên plugin; reason — giá trị mà fiber await reject.
 * Trả: entry audit.
 */
function failingEntry(id: string, name: string, reason: unknown): AuditEntryLike {
  return { disabled: false, options: { id, name }, fiber: { inject: {}, ctx: { get: () => undefined }, await: async () => Promise.reject(reason) } };
}

/**
 * Dựng cây audit giả trên danh sách entry.
 * Nhận: entries — entry của cây; awaits — mảng ghi số lượt await (tuỳ chọn).
 * Trả: cây audit.
 */
function auditTreeOf(entries: readonly AuditEntryLike[], awaits: string[] = []): AuditTreeLike {
  return {
    await: async () => {
      awaits.push("await");
    },
    entries: () => entries,
  };
}

/**
 * Dựng một Agent giả trên scope THẬT.
 * Nhận: ctx — context scope; session — log phiên giả; id — id phiên.
 * Trả: Agent.
 */
function agentOf(ctx: ContextLike, session: SessionLike, id = "s-1"): AgentLike {
  return { id, session, ctx };
}

describe("bề mặt export · inject · Config · defaultId", () => {
  test("01 · export surface: đúng 6 tên, default === class, kiểu từng tên bằng gốc", () => {
    const names = ["AgentPresetRegistry", "agentPresetProjectionDefinition", "auditRows", "default", "entryListProblem", "leakedServices"];
    expect(Object.keys(stockMod).sort()).toEqual(names);
    expect(Object.keys(ourMod).sort()).toEqual(names);
    expect(ourMod.default).toBe(ourMod.AgentPresetRegistry);
    expect(stockMod.default).toBe(stockMod.AgentPresetRegistry);
    expect(typeof ourMod.AgentPresetRegistry).toBe(typeof stockMod.AgentPresetRegistry);
    expect(typeof ourMod.agentPresetProjectionDefinition).toBe(typeof stockMod.agentPresetProjectionDefinition);
    expect(typeof ourMod.auditRows).toBe(typeof stockMod.auditRows);
    expect(typeof ourMod.entryListProblem).toBe(typeof stockMod.entryListProblem);
    expect(typeof ourMod.leakedServices).toBe(typeof stockMod.leakedServices);
  });

  test("02 · static inject = ['loader','sessionProjections'] ở cả hai", () => {
    expect(stockMod.AgentPresetRegistry.inject).toEqual(["loader", "sessionProjections"]);
    expect(ourMod.AgentPresetRegistry.inject).toEqual(["loader", "sessionProjections"]);
    expect(ourMod.AgentPresetRegistry.inject).toEqual(stockMod.AgentPresetRegistry.inject);
  });

  test("03 · Config: String bằng gốc, validate {default}, từ chối thiếu default NGUYÊN VĂN", async () => {
    expect(String(ourMod.AgentPresetRegistry.Config)).toBe(String(stockMod.AgentPresetRegistry.Config));
    for (const mod of [stockMod, ourMod]) {
      const config = mod.AgentPresetRegistry.Config({ default: "a" });
      expect(config.default).toBe("a");
      expect(volatileRefOf(config).get()).toBeUndefined();
      expect(mod.AgentPresetRegistry.Config({ default: "a", selectedDefault: "b" }).selectedDefault?.get()).toBe("b");
    }
    const mine = await errorOf(() => ourMod.AgentPresetRegistry.Config({}));
    const theirs = await errorOf(() => stockMod.AgentPresetRegistry.Config({}));
    expect(mine).toEqual(theirs);
    expect({ name: mine.name, message: mine.message }).toEqual({ name: "ValidationError", message: "$.default missing required value" });
  });

  test("04 · defaultId = config.default khi CHƯA chọn (cả hai đọc tham chiếu volatile rỗng)", () => {
    const mine = makeRig(ourMod, { default: "a" });
    const theirs = makeRig(stockMod, { default: "a" });
    expect(theirs.registry.defaultId).toBe("a");
    expect(mine.registry.defaultId).toBe("a");
    expect(mine.registry.defaultId).toBe(theirs.registry.defaultId);
  });

  test("05 · defaultId = config.selectedDefault khi CÓ chọn, và đổi SỐNG theo tham chiếu", () => {
    const mine = makeRig(ourMod, { default: "a", selectedDefault: "b" });
    const theirs = makeRig(stockMod, { default: "a", selectedDefault: "b" });
    expect(theirs.registry.defaultId).toBe("b");
    expect(mine.registry.defaultId).toBe("b");
    writeVolatile(volatileRefOf(theirs.config), "c");
    writeVolatile(volatileRefOf(mine.config), "c");
    expect(theirs.registry.defaultId).toBe("c");
    expect(mine.registry.defaultId).toBe("c");
  });
});

describe("projection agentPreset", () => {
  test("06 · key/stateVersion, init từ header, wire.view = state (hai bản trùng khớp)", () => {
    const mine = ourMod.agentPresetProjectionDefinition;
    const theirs = stockMod.agentPresetProjectionDefinition;
    expect(mine.key).toBe("agentPreset");
    expect({ key: mine.key, stateVersion: mine.stateVersion }).toEqual({ key: theirs.key, stateVersion: theirs.stateVersion });
    expect(mine.init({})).toBe(theirs.init({}));
    expect(mine.init({})).toBeNull();
    expect(mine.init({ agentPreset: null })).toBeNull();
    expect(mine.init({ agentPreset: "p1" })).toBe("p1");
    expect(mine.init({ agentPreset: "p1" })).toBe(theirs.init({ agentPreset: "p1" }));
    expect(mine.wire.view("p2")).toBe("p2");
    expect(mine.wire.view(null)).toBeNull();
    expect(Object.keys(mine.wire)).toEqual(Object.keys(theirs.wire));
  });

  test("07 · apply: event agent-preset/selected đổi state, event khác giữ nguyên", () => {
    const mine = ourMod.agentPresetProjectionDefinition;
    const theirs = stockMod.agentPresetProjectionDefinition;
    const selected = { type: "agent-preset/selected", data: { agentPreset: "p2" } };
    const other = { type: "session/title", data: { agentPreset: "p3" } };
    expect(theirs.apply(null, selected)).toBe("p2");
    expect(mine.apply(null, selected)).toBe("p2");
    expect(theirs.apply("p1", other)).toBe("p1");
    expect(mine.apply("p1", other)).toBe("p1");
    expect(theirs.apply("p1", { type: "agent-preset/selected", data: { agentPreset: null } })).toBeNull();
    expect(mine.apply("p1", { type: "agent-preset/selected", data: { agentPreset: null } })).toBeNull();
  });

  test("08 · stateSchema: chấp nhận string|null, từ chối number|object ở CẢ HAI", () => {
    for (const schema of [stockMod.agentPresetProjectionDefinition.stateSchema, ourMod.agentPresetProjectionDefinition.stateSchema]) {
      expect(schema.safeParse("p1")).toEqual({ success: true, data: "p1" });
      expect(schema.safeParse(null)).toEqual({ success: true, data: null });
      expect(schema.safeParse(3).success).toBe(false);
      expect(schema.safeParse({ preset: "p1" }).success).toBe(false);
    }
  });
});

describe("entryListProblem", () => {
  test("09 · KHÔNG phải mảng: nhánh gốc + nhánh at của nhóm (nguyên văn)", () => {
    for (const rows of [undefined, null, {}, "rows", 3]) {
      expect(stockMod.entryListProblem(rows)).toBe("the composition must be a top-level list of plugin rows");
      expect(ourMod.entryListProblem(rows)).toBe("the composition must be a top-level list of plugin rows");
      expect(stockMod.entryListProblem(rows, "row 2")).toBe("group row 2 must hold a list of plugin rows");
      expect(ourMod.entryListProblem(rows, "row 2")).toBe("group row 2 must hold a list of plugin rows");
    }
  });

  test("10 · hàng KHÔNG phải map: nhãn index nguyên văn", () => {
    const firstRow = [[1], [null], [[]], [["name", "x"]]] as unknown[];
    for (const rows of firstRow) {
      expect(stockMod.entryListProblem(rows)).toBe('row 1 is not a plugin row (expected a map with a "name")');
      expect(ourMod.entryListProblem(rows)).toBe('row 1 is not a plugin row (expected a map with a "name")');
    }
    const secondRow = [{ name: "a" }, 2];
    expect(stockMod.entryListProblem(secondRow)).toBe('row 2 is not a plugin row (expected a map with a "name")');
    expect(ourMod.entryListProblem(secondRow)).toBe('row 2 is not a plugin row (expected a map with a "name")');
  });

  test("11 · THIẾU name / name rỗng / name không phải chuỗi", () => {
    const cases = [[{}], [{ name: "" }], [{ name: 5 }], [{ name: null }]] as unknown[];
    for (const rows of cases) {
      expect(stockMod.entryListProblem(rows)).toBe('row 1 names no plugin (a "name" string is required)');
      expect(ourMod.entryListProblem(rows)).toBe('row 1 names no plugin (a "name" string is required)');
    }
  });

  test("12 · NHÓM LỒNG lỗi: nhãn dồn cấp + nhánh danh sách hợp lệ trả undefined", () => {
    const rowBroken = [{ name: "grp", group: true, config: [null] }];
    const listBroken = [{ name: "grp", group: true, config: {} }];
    const deepBroken = [{ name: "grp", group: true, config: [{ name: "inner", group: true, config: {} }] }];
    const valid = [{ name: "grp", group: true, config: [{ name: "leaf", group: false, config: [] }] }];
    expect(stockMod.entryListProblem(rowBroken)).toBe('row 1 row 1 is not a plugin row (expected a map with a "name")');
    expect(ourMod.entryListProblem(rowBroken)).toBe('row 1 row 1 is not a plugin row (expected a map with a "name")');
    expect(stockMod.entryListProblem(listBroken)).toBe("group row 1 must hold a list of plugin rows");
    expect(ourMod.entryListProblem(listBroken)).toBe("group row 1 must hold a list of plugin rows");
    expect(stockMod.entryListProblem(deepBroken)).toBe("group row 1 row 1 must hold a list of plugin rows");
    expect(ourMod.entryListProblem(deepBroken)).toBe("group row 1 row 1 must hold a list of plugin rows");
    expect(stockMod.entryListProblem(valid)).toBeUndefined();
    expect(ourMod.entryListProblem(valid)).toBeUndefined();
  });
});

describe("audit · rò service · lỗi mount", () => {
  test("13 · auditRows: hàng TẮT bị bỏ qua, hàng chưa start, hàng CHỜ service", async () => {
    const entries: AuditEntryLike[] = [
      { disabled: true, options: { id: "r1", name: "plug-off" } },
      { disabled: false, options: { id: "r2", name: "plug-dead" } },
      startedEntry("r3", "plug-wait", { alpha: 1, beta: 1 }, ["alpha"]),
      startedEntry("r4", "plug-ready", { alpha: 1 }, ["alpha"]),
    ];
    const awaits: string[] = [];
    const mine = await ourMod.auditRows(auditTreeOf(entries, awaits));
    const theirs = await stockMod.auditRows(auditTreeOf(entries));
    expect(theirs).toEqual({ failed: ["r2 (plug-dead): never started"], pending: ["r3 (plug-wait): waiting for beta"] });
    expect(mine).toEqual(theirs);
    expect(awaits).toEqual(["await"]);
  });

  test("14 · auditRows: AggregateError + cause lồng ⇒ mountDetail nhiều nhánh NGUYÊN VĂN", async () => {
    const wrapped = new Error("outer", { cause: new AggregateError([new Error("boom-1"), new Error("boom-2")], "top-level") });
    const nested = new AggregateError([new Error("child", { cause: new AggregateError([new Error("deep")], "deep-wrap") })], "nested");
    const entries: AuditEntryLike[] = [failingEntry("r1", "plug-wrap", wrapped), failingEntry("r2", "plug-nest", nested), failingEntry("r3", "plug-plain", "khong-phai-error")];
    const mine = await ourMod.auditRows(auditTreeOf(entries));
    const theirs = await stockMod.auditRows(auditTreeOf(entries));
    expect(theirs.failed).toEqual([
      "r1 (plug-wrap): outer\n- boom-1\n- boom-2",
      "r2 (plug-nest): nested\n- child\n  - deep",
      "r3 (plug-plain): khong-phai-error",
    ]);
    expect(mine).toEqual(theirs);
  });

  test("15 · leakedServices: rò realm GỐC + store tổng hợp, KHÔNG quy trách nhiệm chéo scope", async () => {
    const rig = makeRig(ourMod);
    const first = createScope(rig.ctx, {});
    const second = createScope(rig.ctx, {});
    first.ctx.provide("rootRealmSvc", { from: "first" });
    first.ctx.isolate("realmSvc").provide("realmSvc", { from: "first-iso" });
    second.ctx.provide("otherSvc", { from: "second" });
    const synthetic = Symbol("synthetic-leak");
    rig.ctx.reflect.store[synthetic] = { name: "syntheticLeak", fiber: first.ctx.fiber, value: 7 };
    const rootRealm = rig.ctx.root[Context.isolate];
    if (rootRealm === undefined) throw new Error("Context gốc thiếu bảng realm isolate");
    rootRealm["syntheticLeak"] = synthetic;
    expect(stockMod.leakedServices(rig.ctx, first.ctx.fiber)).toEqual(["rootRealmSvc", "syntheticLeak"]);
    expect(ourMod.leakedServices(rig.ctx, first.ctx.fiber)).toEqual(["rootRealmSvc", "syntheticLeak"]);
    expect(stockMod.leakedServices(rig.ctx, second.ctx.fiber)).toEqual(["otherSvc"]);
    expect(ourMod.leakedServices(rig.ctx, second.ctx.fiber)).toEqual(["otherSvc"]);
    expect(ourMod.leakedServices(rig.ctx, {})).toEqual(stockMod.leakedServices(rig.ctx, {}));
    await first.dispose();
    await second.dispose();
  });
});

describe("composition inventory", () => {
  test("16 · định nghĩa HỎNG ⇒ definitionComposition (nhóm lồng, entryId null, !!js ⇒ conditional)", async () => {
    const plugins: EntryRowLike[] = [
      { id: "missing", name: "gbh-test/missing-plugin" },
      { id: "off", name: "plug-off", disabled: true },
      { id: "on", name: "plug-on", disabled: false },
      { id: "js", name: "plug-js", disabled: { __jsExpr: "ctx.baseUrl" } },
      {
        id: "grp",
        name: "grp",
        group: true,
        disabled: true,
        config: [
          { id: "child", name: "plug-child" },
          { id: "child-js", name: "plug-child-js", disabled: { __jsExpr: "true" } },
        ],
      },
    ];
    const mineRig = makeRig(ourMod);
    const theirsRig = makeRig(stockMod);
    await mineRig.registry.register({ id: "broken", name: "B", description: "d", order: 3, plugins });
    await theirsRig.registry.register({ id: "broken", name: "B", description: "d", order: 3, plugins });
    const mine = await mineRig.registry.compositionInventory();
    const theirs = await theirsRig.registry.compositionInventory();
    const expected = [
      {
        id: "broken",
        name: "B",
        description: "d",
        isDefault: false,
        broken: "missing (gbh-test/missing-plugin): never started\non (plug-on): never started\njs (plug-js): never started\ngrp (grp): never started",
        rows: [
          { entryId: "missing", moduleName: "gbh-test/missing-plugin", enabled: true },
          { entryId: "off", moduleName: "plug-off", enabled: false },
          { entryId: "on", moduleName: "plug-on", enabled: true },
          { entryId: "js", moduleName: "plug-js", enabled: "conditional", condition: "ctx.baseUrl" },
          { entryId: "child", moduleName: "plug-child", enabled: false },
          { entryId: "child-js", moduleName: "plug-child-js", enabled: false, condition: "true" },
        ],
      },
    ];
    expect(theirs).toEqual(expected);
    expect(mine).toEqual(theirs);
  });

  test("17 · định nghĩa ĐÃ MOUNT ⇒ mountedCompositionRows (bỏ nhóm, !!js, fiberState)", async () => {
    const plugins: EntryRowLike[] = [
      { id: "a", name: "cordis:trivial" },
      { id: "b", name: "cordis:trivial", disabled: { __jsExpr: "true" } },
      { id: "c", name: "cordis:trivial", disabled: { __jsExpr: "false" } },
      { id: "grp", name: "cordis:trivial", group: true, config: [] },
    ];
    const mineRig = makeRig(ourMod);
    const theirsRig = makeRig(stockMod);
    await mineRig.registry.register({ id: "p1", plugins });
    await theirsRig.registry.register({ id: "p1", plugins });
    const mine = await mineRig.registry.compositionInventory();
    const theirs = await theirsRig.registry.compositionInventory();
    const expected = [
      {
        id: "p1",
        isDefault: true,
        rows: [
          { entryId: "a", moduleName: "cordis:trivial", enabled: true, fiberState: 2 },
          { entryId: "b", moduleName: "cordis:trivial", enabled: false, condition: "true" },
          { entryId: "c", moduleName: "cordis:trivial", enabled: true, condition: "false", fiberState: 2 },
        ],
      },
    ];
    expect(theirs).toEqual(expected);
    expect(mine).toEqual(theirs);
  });

  test("18 · inspectCompositions: modules + leakedServices của ĐÚNG revision Agent đã join", async () => {
    const plugins: EntryRowLike[] = [
      { id: "a", name: "cordis:trivial" },
      { id: "b", name: "cordis:trivial", disabled: { __jsExpr: "true" } },
      { id: "grp", name: "cordis:trivial", group: true, config: [] },
    ];
    const mineRig = makeRig(ourMod);
    const theirsRig = makeRig(stockMod);
    await mineRig.registry.register({ id: "p1", plugins });
    await theirsRig.registry.register({ id: "p1", plugins });
    const mineAgent = createScope(mineRig.ctx, {});
    const theirsAgent = createScope(theirsRig.ctx, {});
    const stranger = createScope(mineRig.ctx, {});
    expect(await mineRig.registry.mount(mineAgent.ctx, "p1")).toEqual({ id: "p1" });
    expect(await theirsRig.registry.mount(theirsAgent.ctx, "p1")).toEqual({ id: "p1" });
    const modules = [{ moduleName: "cordis:trivial", useHostBase: true }];
    expect(theirsRig.registry.inspectCompositions()).toEqual([{ id: "p1", modules, leakedServices: [] }]);
    expect(mineRig.registry.inspectCompositions()).toEqual(theirsRig.registry.inspectCompositions());
    expect(mineRig.registry.inspectCompositions(mineAgent.ctx)).toEqual([{ id: "p1", modules, leakedServices: [] }]);
    expect(mineRig.registry.inspectCompositions(stranger.ctx)).toEqual([]);
    expect(mineRig.registry.composedPreset(mineAgent.ctx)).toBe("p1");
    expect(mineRig.registry.composedPreset(stranger.ctx)).toBeUndefined();
    expect(mineRig.registry.serviceFor({ ctx: mineAgent.ctx }, "trivial")).toBeUndefined();
    expect(mineRig.registry.serviceFor({ ctx: stranger.ctx }, "trivial")).toBeUndefined();
    expect(theirsRig.registry.serviceFor({ ctx: theirsAgent.ctx }, "trivial")).toBeUndefined();
    await mineAgent.dispose();
    await theirsAgent.dispose();
    await stranger.dispose();
  });
});

describe("lớp AgentPresetRegistry", () => {
  test("19 · đăng ký service agentPresets + projection + settings + chuyển tiếp session/event", async () => {
    const mineRig = makeRig(ourMod);
    const theirsRig = makeRig(stockMod);
    for (const [rig, mod] of [[mineRig, ourMod], [theirsRig, stockMod]] as const) {
      expect(rig.registry.name).toBe("agentPresets");
      const impl = Object.getOwnPropertySymbols(rig.ctx.reflect.store)
        .map((key) => rig.ctx.reflect.store[key])
        .find((candidate) => candidate?.name === "agentPresets");
      expect(impl?.value).toBe(rig.registry);
      expect(rig.registered).toHaveLength(1);
      expect(rig.registered[0]).toBe(mod.agentPresetProjectionDefinition);
    }
    await settle();
    expect(theirsRig.settings.calls).toEqual([{ auto: false }]);
    expect(mineRig.settings.calls).toEqual(theirsRig.settings.calls);
    for (const rig of [mineRig, theirsRig]) {
      rig.ctx.emit("session/event", { id: "s-1" }, { type: "agent-preset/selected", data: { agentPreset: "p1" } });
      rig.ctx.emit("session/event", { id: "s-2" }, { type: "session/title", data: { agentPreset: "p2" } });
    }
    expect(theirsRig.forwarded).toEqual([["s-1", "p1"]]);
    expect(mineRig.forwarded).toEqual(theirsRig.forwarded);
  });

  test("20 · register: id rỗng + trùng id — thông điệp NGUYÊN VĂN", async () => {
    const mineRig = makeRig(ourMod);
    const theirsRig = makeRig(stockMod);
    const mineEmpty = await errorOf(() => mineRig.registry.register({ id: "   ", plugins: [] }));
    const theirsEmpty = await errorOf(() => theirsRig.registry.register({ id: "   ", plugins: [] }));
    expect(theirsEmpty).toEqual({ name: "Error", message: "Preset id must not be empty", code: undefined, details: undefined });
    expect(mineEmpty).toEqual(theirsEmpty);
    for (const rig of [mineRig, theirsRig]) await rig.registry.register({ id: "p1", plugins: [] });
    const mineDup = await errorOf(() => mineRig.registry.register({ id: "p1", plugins: [] }));
    const theirsDup = await errorOf(() => theirsRig.registry.register({ id: "p1", plugins: [] }));
    expect(theirsDup).toEqual({ name: "Error", message: "Duplicate agent preset: p1", code: undefined, details: undefined });
    expect(mineDup).toEqual(theirsDup);
  });

  test("21 · list: sắp theo order rồi id; hàng HỎNG mang broken nguyên văn", async () => {
    const seed = async (rig: Rig): Promise<void> => {
      await rig.registry.register({ id: "zeta", order: 2, plugins: [] });
      await rig.registry.register({ id: "alpha", order: 2, plugins: [] });
      await rig.registry.register({ id: "beta", plugins: [] });
      await rig.registry.register({ id: "gamma", order: 1, plugins: [] });
      await rig.registry.register({ id: "broken", order: 3, plugins: [{ id: "missing", name: "gbh-test/missing-plugin" }] });
    };
    const mineRig = makeRig(ourMod);
    const theirsRig = makeRig(stockMod);
    await seed(mineRig);
    await seed(theirsRig);
    const mine = await mineRig.registry.list();
    const theirs = await theirsRig.registry.list();
    expect(theirs.map((row) => row.id)).toEqual(["gamma", "alpha", "zeta", "broken", "beta"]);
    expect(theirs[3]?.broken).toBe("missing (gbh-test/missing-plugin): never started");
    expect(mine).toEqual(theirs);
  });

  test("22 · remoteExportList: đánh dấu isDefault theo defaultId (cả hai nhánh)", async () => {
    const mineRig = makeRig(ourMod, { default: "p1" });
    const theirsRig = makeRig(stockMod, { default: "p1" });
    for (const rig of [mineRig, theirsRig]) {
      await rig.registry.register({ id: "p1", plugins: [] });
      await rig.registry.register({ id: "p2", order: 1, plugins: [] });
    }
    const mine = await mineRig.registry.remoteExportList();
    const theirs = await theirsRig.registry.remoteExportList();
    expect(theirs.presets).toEqual([
      { id: "p2", order: 1, isDefault: false },
      { id: "p1", isDefault: true },
    ]);
    expect(mine).toEqual(theirs);
    const picked = makeRig(ourMod, { default: "p1", selectedDefault: "p2" });
    const pickedStock = makeRig(stockMod, { default: "p1", selectedDefault: "p2" });
    for (const rig of [picked, pickedStock]) {
      await rig.registry.register({ id: "p1", plugins: [] });
      await rig.registry.register({ id: "p2", order: 1, plugins: [] });
    }
    expect(await picked.registry.remoteExportList()).toEqual({
      presets: [
        { id: "p2", order: 1, isDefault: true },
        { id: "p1", isDefault: false },
      ],
    });
    expect(await picked.registry.remoteExportList()).toEqual(await pickedStock.registry.remoteExportList());
  });

  test("23 · readDocument: YAML nguyên văn + metadata; not-found mã agent-preset/not-found", async () => {
    const plugins: EntryRowLike[] = [
      { id: "a", name: "cordis:trivial" },
      { id: "b", name: "cordis:trivial", disabled: { __jsExpr: "true" } },
      { name: "cordis:trivial" },
    ];
    const mineRig = makeRig(ourMod);
    const theirsRig = makeRig(stockMod);
    for (const rig of [mineRig, theirsRig]) {
      await rig.registry.register({ id: "p1", name: "P1", description: "d", plugins });
      await rig.registry.register({ id: "p2", plugins: [] });
    }
    const content = "- id: a\n  name: cordis:trivial\n- id: b\n  name: cordis:trivial\n  disabled: !!js 'true'\n- name: cordis:trivial\n";
    const theirs = await theirsRig.registry.readDocument("p1");
    expect(theirs).toEqual({ agentPreset: "p1", content, name: "P1", description: "d" });
    expect(await mineRig.registry.readDocument("p1")).toEqual(theirs);
    const bare = await mineRig.registry.readDocument("p2");
    expect(bare).toEqual({ agentPreset: "p2", content: "[]\n" });
    expect("name" in bare).toBe(false);
    expect("description" in bare).toBe(false);
    const mineError = await errorOf(() => mineRig.registry.readDocument("nope"));
    const theirsError = await errorOf(() => theirsRig.registry.readDocument("nope"));
    expect(theirsError).toEqual({
      name: "RemoteError",
      message: "Unknown agent preset: nope",
      code: "agent-preset/not-found",
      details: { agentPreset: "nope", available: ["p1", "p2"] },
    });
    expect(mineError).toEqual(theirsError);
  });

  test("24 · select: KHOÁ khi turnBoundary đã có lượt — mã agent-preset/locked nguyên văn", async () => {
    const mineRig = makeRig(ourMod);
    const theirsRig = makeRig(stockMod);
    for (const rig of [mineRig, theirsRig]) await rig.registry.register({ id: "p1", plugins: [] });
    const mineScope = createScope(mineRig.ctx, {});
    const theirsScope = createScope(theirsRig.ctx, {});
    for (const boundary of [{ openTurnStartSeq: 4, lastTurn: 0 }, { openTurnStartSeq: null, lastTurn: 2 }]) {
      const mineTurn = await errorOf(() => mineRig.registry.select(agentOf(mineScope.ctx, sessionWith(boundary)), "p1"));
      const theirsTurn = await errorOf(() => theirsRig.registry.select(agentOf(theirsScope.ctx, sessionWith(boundary)), "p1"));
      expect(theirsTurn).toEqual({
        name: "RemoteError",
        message: "This session has already started",
        code: "agent-preset/locked",
        details: { sessionId: "s-1", agentPreset: "p1" },
      });
      expect(mineTurn).toEqual(theirsTurn);
    }
    const open = sessionWith({ openTurnStartSeq: null, lastTurn: 0 });
    expect(await mineRig.registry.select(agentOf(mineScope.ctx, open), "p1")).toBe("p1");
    expect(open.appended).toEqual([{ type: "agent-preset/selected", data: { agentPreset: "p1" } }]);
    await mineScope.dispose();
    await theirsScope.dispose();
  });

  test("25 · select: đường THÀNH CÔNG ghi event, lượt hai KHÔNG ghi lại", async () => {
    const mineRig = makeRig(ourMod);
    const theirsRig = makeRig(stockMod);
    for (const rig of [mineRig, theirsRig]) await rig.registry.register({ id: "p1", plugins: [] });
    const mineScope = createScope(mineRig.ctx, {});
    const theirsScope = createScope(theirsRig.ctx, {});
    const mineSession = sessionWith(undefined);
    const theirsSession = sessionWith(undefined);
    expect(await theirsRig.registry.select(agentOf(theirsScope.ctx, theirsSession), "p1")).toBe("p1");
    expect(await mineRig.registry.select(agentOf(mineScope.ctx, mineSession), "p1")).toBe("p1");
    expect(mineSession.appended).toEqual(theirsSession.appended);
    expect(mineSession.appended).toEqual([{ type: "agent-preset/selected", data: { agentPreset: "p1" } }]);
    expect(mineRig.registry.composedPreset(mineScope.ctx)).toBe(theirsRig.registry.composedPreset(theirsScope.ctx));
    expect(mineRig.registry.composedPreset(mineScope.ctx)).toBe("p1");
    expect(await mineRig.registry.select(agentOf(mineScope.ctx, mineSession), "p1")).toBe("p1");
    expect(await theirsRig.registry.select(agentOf(theirsScope.ctx, theirsSession), "p1")).toBe("p1");
    expect(mineSession.appended).toHaveLength(1);
    expect(theirsSession.appended).toHaveLength(1);
    await mineScope.dispose();
    await theirsScope.dispose();
  });

  test("26 · C6 danh tính: hai lượt list trả vật thể RIÊNG nhưng SÂU BẰNG", async () => {
    const mineRig = makeRig(ourMod);
    const theirsRig = makeRig(stockMod);
    for (const rig of [mineRig, theirsRig]) {
      await rig.registry.register({ id: "p1", order: 2, name: "P1", plugins: [{ id: "a", name: "cordis:trivial" }] });
      await rig.registry.register({ id: "p2", order: 1, plugins: [] });
    }
    const mineFirst = await mineRig.registry.list();
    const mineSecond = await mineRig.registry.list();
    const theirsFirst = await theirsRig.registry.list();
    const theirsSecond = await theirsRig.registry.list();
    expect(mineFirst).not.toBe(mineSecond);
    expect(mineFirst[0]).not.toBe(mineSecond[0]);
    expect(mineFirst).toEqual(mineSecond);
    expect(theirsFirst).not.toBe(theirsSecond);
    expect(theirsFirst).toEqual(theirsSecond);
    expect(mineFirst).toEqual(theirsFirst);
    const mineExport = await mineRig.registry.remoteExportList();
    const mineExportAgain = await mineRig.registry.remoteExportList();
    expect(mineExport.presets).not.toBe(mineExportAgain.presets);
    expect(mineExport.presets[0]).not.toBe(mineExportAgain.presets[0]);
    expect(mineExport).toEqual(mineExportAgain);
    expect(mineExport).toEqual(await theirsRig.registry.remoteExportList());
  });

  test("27 · resolve: not-found + hàng hỏng nguyên văn; acquireScope giữ rồi nhả revision", async () => {
    const mineRig = makeRig(ourMod);
    const theirsRig = makeRig(stockMod);
    for (const rig of [mineRig, theirsRig]) {
      await rig.registry.register({ id: "p1", name: "P1", plugins: [] });
      await rig.registry.register({ id: "bad", plugins: [{ id: "missing", name: "gbh-test/missing-plugin" }] });
    }
    expect(await mineRig.registry.resolve("p1")).toEqual({ id: "p1" });
    expect(await theirsRig.registry.resolve("p1")).toEqual({ id: "p1" });
    expect(await mineRig.registry.resolve("bad")).toEqual({ id: "bad", broken: "missing (gbh-test/missing-plugin): never started" });
    expect(await mineRig.registry.resolve("bad")).toEqual(await theirsRig.registry.resolve("bad"));
    const mineError = await errorOf(() => mineRig.registry.resolve("nope"));
    const theirsError = await errorOf(() => theirsRig.registry.resolve("nope"));
    expect(theirsError).toEqual({
      name: "RemoteError",
      message: "Unknown agent preset: nope",
      code: "agent-preset/not-found",
      details: { agentPreset: "nope", available: ["p1", "bad"] },
    });
    expect(mineError).toEqual(theirsError);
    const mineLease = await mineRig.registry.acquireScope("p1");
    const theirsLease = await theirsRig.registry.acquireScope("p1");
    const mineDispose = (mineLease as Record<symbol, (() => Promise<void>) | undefined>)[ASYNC_DISPOSE];
    const theirsDispose = (theirsLease as Record<symbol, (() => Promise<void>) | undefined>)[ASYNC_DISPOSE];
    if (mineDispose === undefined || theirsDispose === undefined) throw new Error("lease thiếu Symbol.asyncDispose");
    expect((mineLease as { readonly key: unknown }).key).toEqual((theirsLease as { readonly key: unknown }).key);
    await mineDispose();
    await theirsDispose();
    await mineDispose();
    expect(await mineRig.registry.resolve("p1")).toEqual({ id: "p1" });
  });
});
