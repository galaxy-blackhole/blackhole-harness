/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Giàn test dùng chung cho row agent: nạp HAI bản (bản của ta + bundle GỐC), dựng Context cordis
 *      THẬT cho mỗi bản, cấp agent giả đúng hình dạng, chờ CÓ TRẦN (không chờ vô hạn), và cung cấp
 *      các phép so dùng được cho ĐỐI CHỨNG ÂM (sửa một chỗ ⇒ phép so phải báo đỏ).
 */

import { join } from "node:path";

/** Thư mục gốc repo. */
export const ROOT = join(import.meta.dir, "..", "..");

/** Thư mục package của ta. */
export const PKG_DIR = join(ROOT, "packages", "host", "agent");

/** Điểm vào NGUỒN của ta (Bun nạp thẳng TS). */
export const OURS_SRC = join(PKG_DIR, "src", "index.ts");

/** Thư mục gói GỐC (chỉ đọc) — oracle của mọi phép so. */
export const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-agent");

/** Bundle GỐC đã build (chỉ đọc). */
export const STOCK_ENTRY = join(STOCK_DIR, "lib", "index.js");

/** cordis mà bản của ta nạp (symlink ⇒ cùng thể hiện với kernel). */
export const OUR_CORDIS = join(PKG_DIR, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** cordis mà bundle gốc nạp. */
export const STOCK_CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/**
 * Thư mục build tạm: nằm trong `node_modules` của CHÍNH package (đã bị gitignore và được mọi cổng
 * lint miễn trừ) — nếu để cạnh `src/` thì một lượt test đỏ giữa chừng sẽ để lại artifact không
 * header và làm đỏ cổng `header` của người khác.
 */
export const OUT_DIR = join(PKG_DIR, "node_modules", ".test-lib");

/** Bộ phân phát sự kiện của một bản. */
export interface EventDispatchLike {
  /** Phát "bắn-và-quên". */
  emit(name: string, payload: Record<string, unknown>): void;
  /** Phát serial. */
  serial(name: string, payload: Record<string, unknown>): Promise<unknown>;
  /** Phát waterfall. */
  waterfall(name: string, payload: Record<string, unknown>, ...rest: unknown[]): unknown;
}

/** Bề mặt module mà cả hai bản phải cung cấp (đúng tập export của gốc). */
export interface AgentModule {
  /** Lớp sổ đăng ký (export chính). */
  AgentRegistry: new (ctx: unknown) => AgentRegistryLike;
  /** Export mặc định — phải LÀ cùng lớp với `AgentRegistry`. */
  default: new (ctx: unknown) => AgentRegistryLike;
  /** Carrier phạm vi của một agent. */
  agentCarrier(agent: unknown): unknown;
  /** Bộ phát hợp nhất chủ thể + carrier. */
  agentEvents(ctx: unknown, agent: unknown, carrier?: unknown): EventDispatchLike;
  /** Phát MỘT thông báo agent đã bao lỗi. */
  emitAgentEvent(ctx: unknown, agent: unknown, name: string, payload: Record<string, unknown>): void;
  /** Context lắp prompt với agent và scope đặt cùng nhau. */
  assembleContextFor(agent: unknown, signal?: AbortSignal): Record<string, unknown>;
  /** Gấp nhật ký thành bản tính công việc đã tiêu thụ. */
  foldConsumedWork(events: readonly unknown[]): { end?: unknown; droppedUnrun: boolean };
  /** Ghép lựa chọn model vào phép lắp prompt + định tuyến request. */
  installModelSelection(ctx: unknown, selection: unknown): () => void;
}

/** Bề mặt sổ đăng ký mà test chạm tới (dùng chung cho CẢ HAI bản). */
export interface AgentRegistryLike {
  /** Agent khởi xướng kế thừa. */
  currentInitiator(): unknown;
  /** Agent khởi xướng, ném khi không có. */
  requireInitiator(): unknown;
  /** Chạy thao tác với một Agent làm initiator. */
  withInitiator<T>(agent: unknown, operation: () => T): T;
  /** Chạy thao tác KHÔNG có initiator. */
  withoutInitiator<T>(operation: () => T): T;
  /** Đăng ký factory tạo agent. */
  setFactory(factory: unknown): () => void;
  /** Tạo agent qua factory. */
  create(options: unknown): Promise<unknown>;
  /** Resume agent qua factory. */
  resume(options: unknown): Promise<unknown>;
  /** Ghi agent đang sống qua effect. */
  register(agent: unknown): unknown;
  /** Chèn agent chưa công bố. */
  enter(agent: unknown, owner: unknown): () => void;
  /** Công bố agent đã chèn. */
  announce(agent: unknown, source: string, signal?: AbortSignal): Promise<void>;
  /** Tra agent đang sống. */
  get(id: string): unknown;
  /** Xét quyền sở hữu lúc chạy. */
  isOwnedBy(id: string, owner: unknown): boolean;
  /** Mọi agent đang sống. */
  list(): unknown[];
  /** Mọi agent cấp cao đang sống. */
  roots(): unknown[];
}

/** Một fiber của cordis, ở mức test cần. */
export interface FiberLike {
  /** Trạng thái vòng đời (0 PENDING · 1 LOADING · 2 ACTIVE · 3 FAILED · 4 DISPOSED · 5 UNLOADING). */
  readonly state: number;
  /** Gỡ plugin và chờ dọn xong. */
  dispose(): Promise<void>;
}

/** Context cordis ở đúng phần phòng test dùng. */
export interface CordisContext {
  /** Nạp một plugin. */
  plugin(plugin: unknown, config?: unknown): FiberLike & PromiseLike<FiberLike>;
  /** Cấp một service. */
  provide(name: string, value: unknown): unknown;
  /** Đọc một service. */
  get(name: string): unknown;
  /** Đăng ký người nghe sự kiện (tên chuỗi, không cần khai kiểu). */
  on(name: string, listener: (...args: never[]) => unknown, options?: unknown): () => boolean;
  /** Phát sự kiện "bắn-và-quên". */
  emit(name: string, ...args: unknown[]): void;
  /** Điều phối serial. */
  serial(...args: unknown[]): Promise<unknown>;
  /** Điều phối waterfall. */
  waterfall(...args: unknown[]): unknown;
  /** Kho sự kiện (phép phân phát thật). */
  readonly events: { dispatch(mode: string, args: unknown[]): ((...args: unknown[]) => unknown)[] };
  /** Log của kernel. */
  readonly logger: { warn(message: string, ...args: unknown[]): void };
}

/** Một bản cài (ta hoặc gốc) mà test chạy trên đó. */
export interface Side {
  /** Nhãn để in trong thông điệp lỗi. */
  label: "ours" | "stock";
  /** Bề mặt module đã nạp. */
  module: AgentModule;
  /** Lớp Context của chính bản đó. */
  ContextCtor: new () => unknown;
}

/**
 * Nạp cả hai bản, mỗi bản với cordis của CHÍNH nó.
 * Nhận: không.
 * Trả: hai `Side` — `ours` (nguồn TS của ta) và `stock` (bundle gốc).
 */
export async function loadSides(): Promise<{ ours: Side; stock: Side }> {
  const oursModule = (await import(OURS_SRC)) as AgentModule;
  const stockModule = (await import(STOCK_ENTRY)) as AgentModule;
  const ourCordis = (await import(OUR_CORDIS)) as { Context: new () => unknown };
  const stockCordis = (await import(STOCK_CORDIS)) as { Context: new () => unknown };
  return {
    ours: { label: "ours", module: oursModule, ContextCtor: ourCordis.Context },
    stock: { label: "stock", module: stockModule, ContextCtor: stockCordis.Context },
  };
}

/**
 * Dựng MỘT sổ đăng ký trên Context cordis THẬT của chính bản đó.
 * Nhận: `side` — bản cần dựng.
 * Trả: context, sổ đăng ký (đã resolve qua `ctx.get`), và fiber của plugin.
 */
export async function bootRegistry(side: Side): Promise<{ ctx: CordisContext; registry: AgentRegistryLike; fiber: FiberLike }> {
  const ctx = new side.ContextCtor() as unknown as CordisContext;
  const fiber = await ctx.plugin(side.module.AgentRegistry, {});
  const registry = await waitFor(
    () => ctx.get("agents") as AgentRegistryLike | undefined,
    side.label + ": service agents",
  );
  return { ctx, registry, fiber };
}

/** Một agent giả, đúng hình dạng mà sổ đăng ký và bộ chọn model chạm tới. */
export interface FakeAgent {
  /** Danh tính chia sẻ agent/phiên. */
  readonly id: string;
  /** Trạng thái vòng đời. */
  status: "idle" | "running";
  /** Tuỳ chọn tuyến. */
  readonly options: Record<string, unknown>;
  /** Phiên: danh tính + đầu mục request. */
  readonly session: {
    /** Danh tính phiên (mặc định trùng agent). */
    readonly id: string;
    /** Đầu mục request hiện tại, hoặc `undefined`. */
    requestHeader(): { config: { provider: string; model: string } } | undefined;
  };
  /** Context theo scope của agent. */
  readonly ctx: unknown;
  /** Thư chờ giả (row này không đọc nội dung). */
  readonly inbox: Record<string, unknown>;
  /** Huỷ hoạt động; giàn ghi lại nguyên nhân. */
  cancel(cause: unknown, options?: unknown): void;
  /** Chờ lặng. */
  whenIdle(): Promise<void>;
  /** Chạy việc bảo trì. */
  runMaintenance<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T>;
  /** Gửi vào thư chờ. */
  send(message: unknown, target: string, wakeup: boolean): void;
  /** Xếp lượt tiếp nối. */
  followup(message: unknown): void;
  /** Gửi chỉ đạo. */
  steer(message: unknown): void;
  /** Chèn ngữ cảnh. */
  inject(message: unknown): void;
}

/** Phần thay đổi được của {@link FakeAgent}. */
export interface FakeAgentPatch {
  /** Trạng thái ban đầu (mặc định `idle`). */
  status?: "idle" | "running";
  /** Danh tính phiên khác danh tính agent (để dựng ca lệch id). */
  sessionId?: string;
  /** Đầu mục request hiện tại. */
  header?: { provider: string; model: string };
}

/**
 * Dựng một agent giả và sổ ghi các lần `cancel`.
 * Nhận: `id` — danh tính chia sẻ; `patch` — trạng thái/danh tính phiên/đầu mục request.
 * Trả: `{ agent, cancels }` — `cancels` là mảng nhận MỌI lời gọi `cancel` theo thứ tự.
 */
export function makeAgent(id: string, patch: FakeAgentPatch = {}): { agent: FakeAgent; cancels: unknown[] } {
  const cancels: unknown[] = [];
  const sessionId = patch.sessionId ?? id;
  const header = patch.header;
  let status = patch.status ?? "idle";
  const agent: FakeAgent = {
    id,
    get status(): "idle" | "running" {
      return status;
    },
    set status(next: "idle" | "running") {
      status = next;
    },
    options: {},
    session: {
      id: sessionId,
      requestHeader: () => (header === undefined ? undefined : { config: header }),
    },
    ctx: {},
    inbox: {},
    cancel: (cause, options) => {
      cancels.push(options === undefined ? { cause } : { cause, options });
    },
    whenIdle: () => Promise.resolve(),
    runMaintenance: (task) => task(new AbortController().signal),
    send: () => undefined,
    followup: () => undefined,
    steer: () => undefined,
    inject: () => undefined,
  };
  return { agent, cancels };
}

/**
 * Bề mặt phân phát dùng CHÍNH kho sự kiện của kernel nhưng ghi log cảnh báo vào mảng để so.
 * Nhận: `ctx` — context cordis thật.
 * Trả: `{ surface, warns }` — `surface` đúng hình dạng hàm `agentEvents` cần; `warns` nhận từng dòng log.
 */
export function dispatchSurface(ctx: CordisContext): {
  surface: { events: CordisContext["events"]; logger: { warn(message: string, ...args: unknown[]): void }; serial(...args: unknown[]): Promise<unknown>; waterfall(...args: unknown[]): unknown };
  warns: string[];
} {
  const warns: string[] = [];
  return {
    warns,
    surface: {
      events: ctx.events,
      logger: {
        warn: (message: string, ...rest: unknown[]): void => {
          warns.push(rest.length === 0 ? message : message + " | " + rest.map((value) => String(value)).join(" "));
        },
      },
      serial: ctx.serial,
      waterfall: ctx.waterfall,
    },
  };
}

/**
 * Chờ CÓ TRẦN cho tới khi `check` trả khác `undefined`.
 * Nhận: `check` — phép dò; `label` — nhãn cho thông điệp lỗi; `timeoutMs` — TRẦN chờ (mặc định 2000ms).
 * Trả: giá trị đầu tiên khác `undefined`.
 * Ném: khi quá trần — KHÔNG chờ vô hạn, để ca flaky thành đỏ có chẩn đoán thay vì treo.
 */
export async function waitFor<T>(check: () => T | undefined, label: string, timeoutMs = 2000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = check();
    if (value !== undefined) return value;
    if (Date.now() >= deadline) throw new Error('waitFor("' + label + '") quá trần ' + String(timeoutMs) + "ms");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/**
 * Liệt kê tên export của một file ESM đã build — ĐÚNG hai regex của `tools/check/rows.ts`.
 * Nhận: `text` — nội dung artifact.
 * Trả: tập tên export.
 */
export function exportNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (m[1] as string).split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name !== undefined && name !== "") out.add(name);
    }
  }
  if (/export\s+default/.test(text)) out.add("default");
  return out;
}

/**
 * So HAI tập tên export — phép so dùng được cho ĐỐI CHỨNG ÂM.
 * Nhận: `ours` — tập của ta; `theirs` — tập của bản gốc.
 * Trả: `{ missing, extra }` — tên gốc có mà ta thiếu, và tên ta thừa.
 */
export function exportGaps(ours: ReadonlySet<string>, theirs: ReadonlySet<string>): { missing: string[]; extra: string[] } {
  const missing = [...theirs].filter((name) => !ours.has(name)).sort();
  const extra = [...ours].filter((name) => !theirs.has(name)).sort();
  return { missing, extra };
}

/**
 * So `gbh.peers` với khoá của `peerDependencies` theo PHẦN TỬ (không so số lượng).
 * Nhận: `manifest` — nội dung package.json đã đọc.
 * Trả: các tên peer KHAI để inject mà KHÔNG được kernel cấp (rỗng = đạt).
 */
export function peerGaps(manifest: { gbh?: { peers?: unknown }; peerDependencies?: Record<string, unknown> }): string[] {
  const peers = Array.isArray(manifest.gbh?.peers) ? manifest.gbh.peers.filter((name): name is string => typeof name === "string") : [];
  const provided = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return peers.filter((name) => !provided.has(name)).sort();
}
