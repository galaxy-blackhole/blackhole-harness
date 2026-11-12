/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Test đối chứng (A/B) cho @galaxy-blackhole/gbh-terminal: A = bundle gốc @deepseek-ai/dsh-terminal, B = lib artefact của ta;
 *      Context cordis THẬT + backend/tiến trình GIẢ 100% (KHÔNG spawn shell), so tập export, bề mặt service 'terminals',
 *      đăng ký backend, spawn/read/send/signal/kill và dọn dẹp theo owner/service
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "terminal");
/** Artefact của ta (B) — bản byte-identical của bundle gốc. */
const OURS_FILE = join(PKG, "lib", "index.js");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so (A). */
const STOCK_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-terminal", "lib", "index.js");
/** Cordis THẬT của runtime app. */
const CORDIS_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Locale gốc + locale của ta (phải trùng từng byte). */
const STOCK_LOCALE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-terminal", "locale");
const OURS_LOCALE = join(PKG, "locale");
/** Nội dung bundle gốc. */
const STOCK_TEXT = readFileSync(STOCK_FILE, "utf8");
/** Tập export runtime ĐÚNG của bundle gốc (5 tên, có default). */
const EXPORT_NAMES = ["TerminalBackendCleanupError", "TerminalError", "TerminalSessionId", "TerminalSessionService", "default"];
/** Tên service mà bundle gốc đăng ký khi mount. */
const SERVICE_NAME = "terminals";

/** Trạng thái tiến trình GIẢ. */
type FakeStatus = { readonly kind: "running" } | { readonly kind: "exited"; readonly exitCode: number | null; readonly signal: string | null };

/** Handle tiến trình GIẢ: pid/kill/signal/onData/exitCode/timeout đều mô phỏng trong bộ nhớ. */
interface FakeHandle {
  readonly pid: number;
  exitCode: number | null;
  signalCode: string | null;
  timeoutMs: number | null;
  readonly chunks: string[];
  readonly writes: string[];
  readonly signals: string[];
  readonly closes: string[];
  onData(listener: (chunk: string) => void): () => void;
  kill(signalName?: string): boolean;
  signal(signalName: string): void;
  status(): FakeStatus;
  emit(chunk: string): void;
}

/** Yêu cầu gửi xuống backend giả. */
interface FakeSendRequest {
  readonly text: string;
  readonly submit: boolean;
  readonly signal?: AbortSignal;
}

/** Phần đọc tăng dần của một send. */
interface FakeSendRead {
  readonly delta: string;
  readonly truncated: boolean;
}

/** Kết quả một send. */
interface FakeSendResult {
  readonly viewport: string;
  readonly waitReason: string;
  readonly sessionStatus: FakeStatus;
  readonly truncated: boolean;
}

/** Operation của một send. */
interface FakeOperation {
  readonly done: Promise<FakeSendResult>;
  readOutput(): FakeSendRead;
  cancel(): boolean;
}

/** Trang scrollback giả. */
interface FakeReadResult {
  readonly text: string;
  readonly totalLines: number;
  readonly lineBegin: number;
  readonly lineEnd: number;
  readonly truncated: boolean;
}

/** Kết quả gửi tín hiệu giả. */
interface FakeSignalResult {
  readonly delivered: true;
  readonly targetPgid: number;
}

/** Phiên backend GIẢ. */
interface FakeSession {
  readonly motd: string;
  readonly pid?: number;
  startSend(request: FakeSendRequest): FakeOperation;
  read(request: { readonly offset?: number; readonly count?: number }): FakeReadResult;
  signal(signalName: string): Promise<FakeSignalResult>;
  status(): FakeStatus;
  close(reason: string): Promise<void>;
}

/** Backend GIẢ do test tự dựng. */
interface FakeBackend {
  readonly type: string;
  spawn(spec: SpawnSpec): Promise<FakeSession>;
}

/** Đặc tả spawn mà service đưa xuống backend giả. */
interface SpawnSpec {
  readonly sessionId: string;
  readonly owner: FakeAgent;
  readonly type: string;
  readonly name?: string;
  readonly cwd?: string;
  readonly signal?: AbortSignal;
}

/** Yêu cầu spawn test đưa vào service. */
interface SpawnRequest {
  readonly type: string;
  readonly name?: string;
  readonly cwd?: string;
}

/** Ảnh chụp phiên do service trả. */
interface Snapshot {
  readonly sessionId: string;
  readonly name?: string;
  readonly type: string;
  readonly pid?: number;
  readonly status: FakeStatus;
  readonly motd?: string;
}

/** Agent GIẢ: id + Context cordis THẬT của owner. */
interface FakeAgent {
  readonly id: string;
  readonly ctx: CtxLike;
}

/** Fiber cordis (chỉ đọc trạng thái + dispose). */
interface FiberLike {
  state?: number;
  dispose(): Promise<unknown>;
}

/** Context cordis THẬT (mặt tối thiểu test chạm tới). */
interface CtxLike {
  provide(name: string, value: unknown): () => void;
  get(name: string): unknown;
  plugin(plugin: unknown, config?: unknown): FiberLike;
  effect(callback: () => unknown, label?: string): () => unknown;
  fiber: FiberLike;
  logger: { error(...args: unknown[]): void; warn(...args: unknown[]): void };
  terminals?: unknown;
}

/** Lỗi TerminalError (kèm mã). */
interface TerminalErrorLike extends Error {
  readonly code: string;
}

/** Lỗi dọn dẹp backend (AggregateError). */
interface TerminalCleanupErrorLike extends AggregateError {
  readonly spawnError: unknown;
  readonly cleanupError: unknown;
}

/** Bề mặt service mà test gọi. */
interface ServiceLike {
  readonly name: string;
  registerBackend(backend: FakeBackend): () => void;
  listBackends(): string[];
  spawn(owner: FakeAgent, request: SpawnRequest, signal?: AbortSignal): Promise<Snapshot>;
  hasOwnerActivity(owner: FakeAgent): boolean;
  startSend(owner: FakeAgent, id: string, request: FakeSendRequest): FakeOperation;
  read(owner: FakeAgent, id: string, request?: { readonly offset?: number; readonly count?: number }): FakeReadResult;
  signal(owner: FakeAgent, id: string, signalName: string): Promise<FakeSignalResult>;
  kill(owner: FakeAgent, id: string, reason?: string): Promise<boolean>;
  list(owner: FakeAgent): Snapshot[];
}

/** Hàm dựng service (lớp plugin cordis). */
interface ServiceCtor {
  new (ctx: CtxLike, config?: unknown): ServiceLike;
  readonly name: string;
  readonly prototype: ServiceLike;
}

/** Bề mặt module của một bên (A hoặc B). */
interface TerminalModule {
  readonly TerminalBackendCleanupError: new (spawnError: unknown, cleanupError: unknown) => TerminalCleanupErrorLike;
  readonly TerminalError: new (message: string, code: string) => TerminalErrorLike;
  readonly TerminalSessionId: (value: string) => string;
  readonly TerminalSessionService: ServiceCtor;
  readonly default: ServiceCtor;
}

/** Một thế giới test: Context THẬT + service đã mount + agent giả. */
interface World {
  readonly ctx: CtxLike;
  readonly owners: Map<string, FakeAgent>;
  readonly service: ServiceLike;
  readonly fiber: FiberLike;
  readonly errors: string[];
}

/** Kế hoạch cho phiên giả. */
interface SessionPlan {
  motd?: string;
  send?(request: FakeSendRequest, handle: FakeHandle): Promise<FakeSendResult>;
  close?(reason: string, handle: FakeHandle): Promise<void>;
}

/** Lớp Context cordis THẬT của runtime app. */
const ContextCtor = ((await import(CORDIS_FILE)) as unknown as { Context: new () => CtxLike }).Context;
/** B = artefact của ta. */
const ours = (await import(OURS_FILE)) as unknown as TerminalModule;
/** A = bundle gốc. */
const stock = (await import(STOCK_FILE)) as unknown as TerminalModule;

/** Băm SHA-256 một chuỗi UTF-8. */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Dựng handle tiến trình GIẢ 100% — không tiến trình/shell thật nào được tạo. */
function makeHandle(overrides: Partial<Pick<FakeHandle, "exitCode" | "signalCode" | "timeoutMs">> = {}): FakeHandle {
  const listeners: ((chunk: string) => void)[] = [];
  const handle: FakeHandle = {
    pid: 4242,
    exitCode: overrides.exitCode ?? null,
    signalCode: overrides.signalCode ?? null,
    timeoutMs: overrides.timeoutMs ?? 300000,
    chunks: ["fake$ "],
    writes: [],
    signals: [],
    closes: [],
    onData(listener: (chunk: string) => void): () => void {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
    kill(signalName = "SIGTERM"): boolean {
      handle.signals.push(signalName);
      handle.exitCode = 0;
      return true;
    },
    signal(signalName: string): void {
      handle.signals.push(signalName);
    },
    status(): FakeStatus {
      return handle.exitCode === null ? { kind: "running" } : { kind: "exited", exitCode: handle.exitCode, signal: handle.signalCode };
    },
    emit(chunk: string): void {
      handle.chunks.push(chunk);
      for (const listener of [...listeners]) listener(chunk);
    },
  };
  return handle;
}

/** Dựng phiên backend GIẢ trên một handle giả (đúng bề mặt TerminalBackendSession). */
function makeSession(handle: FakeHandle, plan: SessionPlan = {}): FakeSession {
  return {
    motd: plan.motd ?? "fake-ready",
    pid: handle.pid,
    startSend(request: FakeSendRequest): FakeOperation {
      handle.writes.push(request.text);
      const done =
        plan.send !== undefined
          ? plan.send(request, handle)
          : Promise.resolve({ viewport: handle.chunks.join(""), waitReason: "stdin_read", sessionStatus: handle.status(), truncated: false });
      return {
        done,
        readOutput: (): FakeSendRead => ({ delta: handle.chunks.join(""), truncated: false }),
        cancel: (): boolean => {
          handle.signal("SIGINT");
          return true;
        },
      };
    },
    read: (request) => ({
      text: handle.chunks.join(""),
      totalLines: handle.chunks.length,
      lineBegin: request.offset ?? 0,
      lineEnd: handle.chunks.length,
      truncated: false,
    }),
    signal: (signalName: string): Promise<FakeSignalResult> => {
      handle.signal(signalName);
      return Promise.resolve({ delivered: true, targetPgid: handle.pid });
    },
    status: (): FakeStatus => handle.status(),
    close: (reason: string): Promise<void> => {
      handle.closes.push(reason);
      return plan.close !== undefined ? plan.close(reason, handle) : Promise.resolve();
    },
  };
}

/** Dựng backend GIẢ với hàm spawn tuỳ ý (mọi phiên đều trên handle trong bộ nhớ). */
function makeBackend(type: string, spawn: (spec: SpawnSpec) => Promise<FakeSession>): FakeBackend {
  return { type, spawn };
}

/** Dựng Owner GIẢ có Context cordis THẬT (để ctx.effect dọn dẹp chạy thật). */
function makeOwner(world: World, id: string): FakeAgent {
  const ownerCtx = new ContextCtor();
  ownerCtx.logger.error = () => {};
  ownerCtx.logger.warn = () => {};
  const owner: FakeAgent = { id, ctx: ownerCtx };
  world.owners.set(id, owner);
  return owner;
}

/** Dựng Context THẬT + dịch vụ 'agents' GIẢ rồi mount service của MỘT bên (config bị service bỏ qua). */
async function makeWorld(api: TerminalModule, config?: unknown): Promise<World> {
  const ctx = new ContextCtor();
  const errors: string[] = [];
  ctx.logger.error = (...args: unknown[]) => {
    errors.push(args.map((value) => (value instanceof Error ? value.name + "|" + value.message : String(value))).join(" "));
  };
  ctx.logger.warn = () => {};
  const owners = new Map<string, FakeAgent>();
  ctx.provide("agents", { get: (id: string) => owners.get(id) });
  const fiber = ctx.plugin(api.TerminalSessionService, config);
  await fiber;
  const service = ctx.get(SERVICE_NAME) as ServiceLike | undefined;
  if (service === undefined) throw new Error("service '" + SERVICE_NAME + "' khong duoc dang ky");
  return { ctx, owners, service, fiber, errors };
}

/** Mã lỗi DẠNG CHUỖI của một lỗi (DOMException của AbortSignal có code SỐ ⇒ "-"). */
function codeOf(error: Error): string {
  const code = (error as Error & { code?: unknown }).code;
  return typeof code === "string" ? code : "-";
}

/** Gói kết quả/lỗi của một hàm thành chuỗi so sánh được: "ok:<JSON>" hoặc "nem|name|code|message". */
async function outcome(run: () => unknown): Promise<string> {
  try {
    return "ok:" + JSON.stringify(await run());
  } catch (error) {
    const failure = error as Error;
    return ["nem", failure.name, codeOf(failure), failure.message].join("|");
  }
}

/** Chạy CÙNG kịch bản trên A (stock) và B (artefact), mỗi bên một thế giới MỚI. */
async function ab(scenario: (world: World) => unknown): Promise<{ a: string; b: string }> {
  const worldA = await makeWorld(stock);
  const worldB = await makeWorld(ours);
  return { a: await outcome(() => scenario(worldA)), b: await outcome(() => scenario(worldB)) };
}

/** Chạy kịch bản A/B, khẳng định HAI BÊN TRÙNG NHAU rồi giải mã kết quả của B. */
async function same(scenario: (world: World) => unknown): Promise<unknown> {
  const pair = await ab(scenario);
  expect(pair.a).toBe(pair.b);
  if (!pair.b.startsWith("ok:")) throw new Error("kich ban loi: " + pair.b);
  return JSON.parse(pair.b.slice(3)) as unknown;
}

/** Chạy một hàm và gói lỗi thành chuỗi (dùng BÊN TRONG kịch bản A/B). */
async function catchText(run: () => unknown): Promise<string> {
  try {
    await run();
    return "ok";
  } catch (error) {
    const failure = error as Error;
    return [failure.name, codeOf(failure), failure.message].join("|");
  }
}

/** Dựng tín hiệu ĐÃ huỷ (đo nhánh abort trước khi vào backend). */
function abortedSignal(): AbortSignal {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
}

describe("A · artefact byte-identical bundle gốc", () => {
  test("A1 · lib/index.js = bundle gốc: 13 614 byte · 360 dòng · sha256 trùng · delta 0", () => {
    const ourText = readFileSync(OURS_FILE, "utf8");
    expect(ourText).toBe(STOCK_TEXT);
    expect(sha256(ourText)).toBe(sha256(STOCK_TEXT));
    expect(sha256(ourText)).toBe("d89bd6e304d0904dc3cd6c9fd50085be2e5eeaf8f1444f18a4c669b6e764ecb4");
    expect(sha256(ourText)).toHaveLength(64);
    expect(statSync(OURS_FILE).size).toBe(13614);
    expect(Buffer.byteLength(STOCK_TEXT, "utf8")).toBe(13614);
    expect((STOCK_TEXT.match(/\n/g) ?? []).length).toBe(360);
    expect(ourText.split("\n").length).toBe(STOCK_TEXT.split("\n").length);
    expect(ourText.endsWith("\n")).toBe(true);
    expect(ourText.endsWith("\n\n")).toBe(false);
  });
});

describe("B · bề mặt module A/B (không có apply/Config)", () => {
  test("B1 · export runtime: ĐÚNG 5 tên {4 lớp/hàm + default}, default = TerminalSessionService, KHÔNG Config", () => {
    const oursKeys = Object.keys(ours).sort();
    expect(oursKeys).toEqual(Object.keys(stock).sort());
    expect(oursKeys).toEqual([...EXPORT_NAMES].sort());
    expect("Config" in ours).toBe(false);
    expect("Config" in stock).toBe(false);
    expect(String((ours as { Config?: unknown }).Config)).toBe("undefined");
    expect(String((stock as { Config?: unknown }).Config)).toBe("undefined");
    expect(ours.default).toBe(ours.TerminalSessionService);
    expect(stock.default).toBe(stock.TerminalSessionService);
    expect(ours.default.name).toBe("TerminalSessionService");
    expect(ours.TerminalSessionService.name).toBe(stock.TerminalSessionService.name);
    expect(typeof ours.TerminalSessionId).toBe("function");
    expect(ours.TerminalSessionId("pty-1")).toBe("pty-1");
    expect(ours.TerminalSessionId("")).toBe("");
    expect("apply" in ours).toBe(false);
    expect("inject" in ours).toBe(false);
    expect("name" in ours).toBe(false);
  });

  test("B2 · prototype/static của service + thứ bậc lỗi TRÙNG bản gốc", () => {
    const oursProto = Object.getOwnPropertyNames(ours.TerminalSessionService.prototype).sort();
    expect(oursProto).toEqual(Object.getOwnPropertyNames(stock.TerminalSessionService.prototype).sort());
    expect(oursProto).toEqual(
      [
        "abortAndClose", "abortPendingSpawns", "assertActive", "closeRecords", "constructor", "disposeAll", "disposeOwned",
        "ensureOwnerCleanup", "expectOwned", "hasOwnerActivity", "isLiveOwner", "kill", "list", "listBackends", "read",
        "registerBackend", "removePendingSpawn", "reserveName", "reserveSpawn", "signal", "snapshot", "spawn", "startSend",
      ].sort(),
    );
    expect(Object.getOwnPropertyNames(ours.TerminalSessionService).sort()).toEqual([
      "length",
      "name",
      "prototype",
    ]);
    expect(Object.getOwnPropertyNames(stock.TerminalSessionService).sort()).toEqual([
      "length",
      "name",
      "prototype",
    ]);
    expect(Object.getPrototypeOf(ours.TerminalError.prototype)).toBe(Error.prototype);
    expect(Object.getPrototypeOf(stock.TerminalError.prototype)).toBe(Error.prototype);
    expect(Object.getPrototypeOf(ours.TerminalBackendCleanupError.prototype)).toBe(AggregateError.prototype);
    expect(Object.getPrototypeOf(stock.TerminalBackendCleanupError.prototype)).toBe(AggregateError.prototype);
    expect(ours.TerminalSessionService).not.toBe(stock.TerminalSessionService);
    expect(ours.TerminalError).not.toBe(stock.TerminalError);
  });

  test("B3 · KHÔNG có Config: 5 giá trị config qua ctx.plugin đều cho CÙNG bề mặt đăng ký (A/B)", async () => {
    const configs: unknown[] = [undefined, null, {}, { mode: "pty" }, { nested: { depth: 2 } }];
    const seen: string[] = [];
    for (const config of configs) {
      const surfaceOf = async (api: TerminalModule): Promise<string> => {
        const world = await makeWorld(api, config);
        const surface = {
          serviceName: world.service.name,
          serviceCtor: world.service.constructor.name,
          backends: world.service.listBackends(),
          mounted: (world.ctx.get(SERVICE_NAME) as ServiceLike | undefined)?.name === world.service.name,
          state: typeof world.fiber.state,
          terminals: typeof world.ctx.terminals,
          tools: world.ctx.get("tools") ?? null,
          commands: world.ctx.get("commands") ?? null,
          errors: world.errors,
        };
        await world.fiber.dispose();
        return JSON.stringify(surface);
      };
      const a = await surfaceOf(stock);
      const b = await surfaceOf(ours);
      expect(b).toBe(a);
      seen.push(b);
    }
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).toContain('"serviceName":"terminals"');
    expect(seen[0]).toContain('"serviceCtor":"TerminalSessionService"');
    expect(seen[0]).toContain('"tools":null');
    expect(seen[0]).toContain('"commands":null');
  });
});

describe("C · service 'terminals' trên Context cordis THẬT", () => {
  test("C1 · mount đăng ký ĐÚNG MỘT service 'terminals'; không tool/hook; dispose gỡ sạch (A/B)", async () => {
    const surface = (await same((world) => ({
      name: world.service.name,
      mounted: (world.ctx.get(SERVICE_NAME) as ServiceLike | undefined)?.name === world.service.name,
      terminalType: typeof world.ctx.terminals,
      ctor: world.service.constructor.name,
      state: world.fiber.state,
      tools: world.ctx.get("tools") ?? null,
      commands: world.ctx.get("commands") ?? null,
      errors: world.errors,
    }))) as Record<string, unknown>;
    expect(surface.name).toBe(SERVICE_NAME);
    expect(surface.mounted).toBe(true);
    expect(surface.terminalType).toBe("object");
    expect(surface.ctor).toBe("TerminalSessionService");
    expect(surface.state).toBe(2);
    expect(surface.tools).toBeNull();
    expect(surface.commands).toBeNull();
    expect(surface.errors).toEqual([]);

    const gone = (await same(async (world) => {
      await world.fiber.dispose();
      return { after: world.ctx.get(SERVICE_NAME) ?? null, terminals: world.ctx.terminals ?? null, backends: world.service.listBackends() };
    })) as Record<string, unknown>;
    expect(gone.after).toBeNull();
    expect(gone.terminals).toBeNull();
    expect(gone.backends).toEqual([]);
  });

  test("C2 · registerBackend: thứ tự · trùng type DUPLICATE_BACKEND · type rỗng Error · disposer gỡ đúng phần mình", async () => {
    const seen = (await same((world) => {
      const empty: FakeBackend = { type: "", spawn: async (): Promise<FakeSession> => makeSession(makeHandle()) };
      const first = makeBackend("fake-a", async () => makeSession(makeHandle()));
      const second = makeBackend("fake-b", async () => makeSession(makeHandle()));
      const disposeFirst = world.service.registerBackend(first);
      world.service.registerBackend(second);
      const afterRegister = world.service.listBackends();
      const duplicate = (() => {
        try {
          world.service.registerBackend(makeBackend("fake-a", async () => makeSession(makeHandle())));
          return "khong nem";
        } catch (error) {
          const failure = error as TerminalErrorLike;
          return failure.name + "|" + failure.code + "|" + failure.message;
        }
      })();
      const emptyType = (() => {
        try {
          world.service.registerBackend(empty);
          return "khong nem";
        } catch (error) {
          return (error as Error).name + "|" + (error as Error).message;
        }
      })();
      disposeFirst();
      const afterDispose = world.service.listBackends();
      disposeFirst();
      const afterSecondDispose = world.service.listBackends();
      return { afterRegister, duplicate, emptyType, afterDispose, afterSecondDispose };
    })) as Record<string, unknown>;
    expect(seen.afterRegister).toEqual(["fake-a", "fake-b"]);
    expect(seen.duplicate).toBe('TerminalError|DUPLICATE_BACKEND|a PTY backend named "fake-a" is already registered');
    expect(seen.emptyType).toBe("Error|pty backend type must be non-empty");
    expect(seen.afterDispose).toEqual(["fake-b"]);
    expect(seen.afterSecondDispose).toEqual(["fake-b"]);
  });
});

describe("D · spawn + thẩm quyền owner (tiến trình GIẢ)", () => {
  test("D1 · spawn THÀNH CÔNG: đặc tả xuống backend, snapshot, list, hasOwnerActivity (A/B)", async () => {
    const seen = (await same(async (world) => {
      const owner = makeOwner(world, "agent-1");
      const other = makeOwner(world, "agent-2");
      const specs: Record<string, unknown>[] = [];
      const handle = makeHandle();
      world.service.registerBackend(
        makeBackend("fake", async (spec) => {
          specs.push({
            sessionId: spec.sessionId,
            ownerId: spec.owner.id,
            type: spec.type,
            name: spec.name ?? null,
            cwd: spec.cwd ?? null,
            signal: spec.signal instanceof AbortSignal,
            keys: Object.keys(spec).sort(),
          });
          return makeSession(handle);
        }),
      );
      const before = world.service.hasOwnerActivity(owner);
      const snapshot = await world.service.spawn(owner, { type: "fake", name: "shell-1", cwd: "/tmp/fake" });
      const listed = world.service.list(owner);
      const otherList = world.service.list(other);
      const activity = world.service.hasOwnerActivity(owner);
      return { before, snapshot, listed, otherList, activity, specs };
    })) as Record<string, unknown>;
    expect(seen.before).toBe(false);
    expect(seen.snapshot).toEqual({
      sessionId: "pty-1",
      name: "shell-1",
      type: "fake",
      pid: 4242,
      status: { kind: "running" },
      motd: "fake-ready",
    });
    expect(seen.listed).toEqual([{ sessionId: "pty-1", name: "shell-1", type: "fake", pid: 4242, status: { kind: "running" } }]);
    expect(seen.otherList).toEqual([]);
    expect(seen.activity).toBe(true);
    expect(seen.specs).toEqual([
      {
        sessionId: "pty-1",
        ownerId: "agent-1",
        type: "fake",
        name: "shell-1",
        cwd: "/tmp/fake",
        signal: true,
        keys: ["cwd", "name", "owner", "sessionId", "signal", "type"],
      },
    ]);
  });

  test("D2 · spawn LỖI: NO_BACKEND · DUPLICATE_NAME · FOREIGN_SESSION · NO_SESSION · OWNER_NOT_LIVE · name rỗng", async () => {
    const seen = (await same(async (world) => {
      const owner = makeOwner(world, "agent-1");
      const other = makeOwner(world, "agent-2");
      const ghost: FakeAgent = { id: "ghost", ctx: makeOwner(world, "ghost-ctx").ctx };
      world.service.registerBackend(makeBackend("fake", async () => makeSession(makeHandle())));
      const noBackend = await catchText(() => world.service.spawn(owner, { type: "nope" }));
      const emptyName = await catchText(() => world.service.spawn(owner, { type: "fake", name: "" }));
      const ownerNotLive = await catchText(() => world.service.spawn(ghost, { type: "fake" }));
      const snapshot = await world.service.spawn(owner, { type: "fake", name: "one" });
      const duplicateName = await catchText(() => world.service.spawn(owner, { type: "fake", name: "one" }));
      const foreign = await catchText(() => world.service.read(other, snapshot.sessionId));
      const noSession = await catchText(() => world.service.read(owner, "pty-999"));
      return { noBackend, emptyName, ownerNotLive, duplicateName, foreign, noSession, sessions: world.service.list(owner).length };
    })) as Record<string, unknown>;
    expect(seen.noBackend).toBe('TerminalError|NO_BACKEND|no PTY backend registered for "nope"');
    expect(seen.emptyName).toBe("Error|-|PTY session name must be non-empty");
    expect(seen.ownerNotLive).toBe('TerminalError|OWNER_NOT_LIVE|agent "ghost" is not the registered PTY owner');
    expect(seen.duplicateName).toBe('TerminalError|DUPLICATE_NAME|PTY session name "one" already exists for this owner');
    expect(seen.foreign).toBe("TerminalError|FOREIGN_SESSION|PTY session pty-1 belongs to another agent");
    expect(seen.noSession).toBe("TerminalError|NO_SESSION|unknown PTY session pty-999");
    expect(seen.sessions).toBe(1);
  });

  test("D3 · hasOwnerActivity: true suốt spawn CHƯA công bố; abort giữa chừng dọn sạch, không publish", async () => {
    const seen = (await same(async (world) => {
      const owner = makeOwner(world, "agent-1");
      let release: (session: FakeSession) => void = () => {};
      const gate = new Promise<FakeSession>((resolve) => {
        release = resolve;
      });
      world.service.registerBackend(makeBackend("slow", () => gate));
      const pending = world.service.spawn(owner, { type: "slow" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const during = world.service.hasOwnerActivity(owner);
      const publishedBefore = world.service.list(owner).length;
      release(makeSession(makeHandle()));
      const snapshot = await pending;
      const afterPublish = world.service.hasOwnerActivity(owner);
      await world.service.kill(owner, snapshot.sessionId, "test done");
      const afterKill = world.service.hasOwnerActivity(owner);

      const controller = new AbortController();
      world.service.registerBackend(
        makeBackend("abortable", (spec) => new Promise<FakeSession>((_resolve, reject) => {
          spec.signal?.addEventListener("abort", () => reject(spec.signal?.reason), { once: true });
        })),
      );
      const aborted = world.service.spawn(owner, { type: "abortable" }, controller.signal);
      controller.abort();
      const abortText = await catchText(() => aborted);
      const afterAbort = world.service.hasOwnerActivity(owner);
      return { during, publishedBefore, afterPublish, afterKill, abortText, afterAbort, sessions: world.service.list(owner).length };
    })) as Record<string, unknown>;
    expect(seen.during).toBe(true);
    expect(seen.publishedBefore).toBe(0);
    expect(seen.afterPublish).toBe(true);
    expect(seen.afterKill).toBe(false);
    expect(seen.abortText).toBe("AbortError|-|The operation was aborted.");
    expect(seen.afterAbort).toBe(false);
    expect(seen.sessions).toBe(0);
  });
});

describe("E · exec với tiến trình GIẢ: thành công/lỗi/thoát/timeout/abort", () => {
  test("E1 · THÀNH CÔNG: done + readOutput + signal + read + SEND_ACTIVE khi send thứ hai chồng", async () => {
    const seen = (await same(async (world) => {
      const owner = makeOwner(world, "agent-1");
      const handle = makeHandle();
      let settle: (result: FakeSendResult) => void = () => {};
      const pending = new Promise<FakeSendResult>((resolve) => {
        settle = resolve;
      });
      handle.chunks.push("ready\n");
      let sends = 0;
      world.service.registerBackend(makeBackend("fake", async () => makeSession(handle, {
        send: () => {
          sends += 1;
          if (sends === 1) return pending;
          return Promise.resolve({ viewport: handle.chunks.join(""), waitReason: "stdin_read", sessionStatus: handle.status(), truncated: false });
        },
      })));
      const snapshot = await world.service.spawn(owner, { type: "fake" });
      const operation = world.service.startSend(owner, snapshot.sessionId, { text: "echo hi", submit: true });
      const active = await catchText(() => Promise.resolve(world.service.startSend(owner, snapshot.sessionId, { text: "x", submit: false })));
      const readDelta = operation.readOutput();
      const cancelled = operation.cancel();
      handle.emit("hi\n");
      settle({ viewport: handle.chunks.join(""), waitReason: "inferred_idle", sessionStatus: handle.status(), truncated: false });
      const done = await operation.done;
      const signal = await world.service.signal(owner, snapshot.sessionId, "SIGINT");
      const page = world.service.read(owner, snapshot.sessionId, { offset: 1, count: 2 });
      const writes = handle.writes;
      const signals = handle.signals;
      const reused = world.service.startSend(owner, snapshot.sessionId, { text: "second", submit: true });
      const reusedDone = await reused.done;
      return { active, readDelta, cancelled, done, signal, page, writes, signals, reusedDone };
    })) as Record<string, unknown>;
    expect(seen.active).toBe("TerminalError|SEND_ACTIVE|PTY session pty-1 already has an active send");
    expect(seen.readDelta).toEqual({ delta: "fake$ ready\n", truncated: false });
    expect(seen.cancelled).toBe(true);
    expect(seen.done).toEqual({
      viewport: "fake$ ready\nhi\n",
      waitReason: "inferred_idle",
      sessionStatus: { kind: "running" },
      truncated: false,
    });
    expect(seen.signal).toEqual({ delivered: true, targetPgid: 4242 });
    expect(seen.page).toEqual({ text: "fake$ ready\nhi\n", totalLines: 3, lineBegin: 1, lineEnd: 3, truncated: false });
    expect(seen.writes).toEqual(["echo hi", "second"]);
    expect(seen.signals).toEqual(["SIGINT", "SIGINT"]);
    expect((seen.reusedDone as Record<string, unknown>).waitReason).toBe("stdin_read");
  });

  test("E2 · LỖI send chuyển NGUYÊN VĂN; active được nhả; THOÁT phản ánh qua status/list", async () => {
    const seen = (await same(async (world) => {
      const owner = makeOwner(world, "agent-1");
      const handle = makeHandle();
      let fail = true;
      world.service.registerBackend(
        makeBackend("fake", async () => makeSession(handle, {
          send: () => fail
            ? Promise.reject(new Error("fake-pty-exec-boom"))
            : Promise.resolve({ viewport: handle.chunks.join(""), waitReason: "session_exit", sessionStatus: handle.status(), truncated: false }),
        })),
      );
      const snapshot = await world.service.spawn(owner, { type: "fake" });
      const operation = world.service.startSend(owner, snapshot.sessionId, { text: "boom", submit: true });
      const failure = await catchText(() => operation.done);
      fail = false;
      const retried = world.service.startSend(owner, snapshot.sessionId, { text: "after", submit: true });
      const retriedDone = await retried.done;
      handle.kill("SIGTERM");
      const exited = world.service.list(owner)[0]?.status ?? null;
      const exitOperation = world.service.startSend(owner, snapshot.sessionId, { text: "status", submit: true });
      const exitDone = await exitOperation.done;
      return { failure, retriedDone, exited, exitDone, exitCode: handle.exitCode, killed: handle.signals };
    })) as Record<string, unknown>;
    expect(seen.failure).toBe("Error|-|fake-pty-exec-boom");
    expect(seen.retriedDone).toEqual({ viewport: "fake$ ", waitReason: "session_exit", sessionStatus: { kind: "running" }, truncated: false });
    expect(seen.exited).toEqual({ kind: "exited", exitCode: 0, signal: null });
    expect(seen.exitDone).toEqual({
      viewport: "fake$ ",
      waitReason: "session_exit",
      sessionStatus: { kind: "exited", exitCode: 0, signal: null },
      truncated: false,
    });
    expect(seen.exitCode).toBe(0);
    expect(seen.killed).toEqual(["SIGTERM"]);
  });

  test("E3 · TIMEOUT + ABORT: waitReason timeout · huỷ qua cancel · signal đã huỷ trước khi spawn", async () => {
    const seen = (await same(async (world) => {
      const owner = makeOwner(world, "agent-1");
      const handle = makeHandle({ timeoutMs: 1500 });
      world.service.registerBackend(
        makeBackend("fake", async () => makeSession(handle, {
          send: (request) => request.signal?.aborted === true
            ? Promise.reject(request.signal.reason)
            : Promise.resolve({ viewport: handle.chunks.join(""), waitReason: "timeout", sessionStatus: handle.status(), truncated: false }),
        })),
      );
      const snapshot = await world.service.spawn(owner, { type: "fake" });
      const operation = world.service.startSend(owner, snapshot.sessionId, { text: "sleep 10", submit: true });
      const timedOut = await operation.done;
      const abortedOperation = world.service.startSend(owner, snapshot.sessionId, { text: "interrupt", submit: false, signal: abortedSignal() });
      const abortedText = await catchText(() => abortedOperation.done);
      const cancelAfterSettled = abortedOperation.cancel();
      const spawnAborted = await catchText(() => world.service.spawn(owner, { type: "fake" }, abortedSignal()));
      return { timedOut, abortedText, cancelAfterSettled, timeoutMs: handle.timeoutMs, spawnAborted };
    })) as Record<string, unknown>;
    expect(seen.timedOut).toEqual({ viewport: "fake$ ", waitReason: "timeout", sessionStatus: { kind: "running" }, truncated: false });
    expect(seen.abortedText).toBe("AbortError|-|The operation was aborted.");
    expect(seen.cancelAfterSettled).toBe(true);
    expect(seen.timeoutMs).toBe(1500);
    expect(seen.spawnAborted).toBe("AbortError|-|The operation was aborted.");
  });
});

describe("F · kill + dọn dẹp theo owner/service", () => {
  test("F1 · kill: lần đầu true, lần hai (đang đóng) false; close LỖI giữ session rồi thử lại được", async () => {
    const seen = (await same(async (world) => {
      const owner = makeOwner(world, "agent-1");
      const handles: FakeHandle[] = [];
      let failNext = true;
      world.service.registerBackend(
        makeBackend("fake", async () => {
          const handle = makeHandle();
          handles.push(handle);
          return makeSession(handle, {
            close: () => {
              if (!failNext) return Promise.resolve();
              failNext = false;
              return Promise.reject(new Error("fake-close-boom"));
            },
          });
        }),
      );
      const first = await world.service.spawn(owner, { type: "fake" });
      const closeFailure = await catchText(() => world.service.kill(owner, first.sessionId, "cleanup"));
      const stillThere = world.service.list(owner).length;
      const retry = await world.service.kill(owner, first.sessionId, "cleanup");
      const afterRetry = world.service.list(owner).length;
      const second = await world.service.spawn(owner, { type: "fake" });
      const [firstKill, secondKill] = await Promise.all([
        world.service.kill(owner, second.sessionId, "double"),
        world.service.kill(owner, second.sessionId, "double"),
      ]);
      return {
        closeFailure,
        stillThere,
        retry,
        afterRetry,
        firstKill,
        secondKill,
        closes: handles.map((handle) => [...handle.closes]),
        sessions: world.service.list(owner).length,
      };
    })) as Record<string, unknown>;
    expect(seen.closeFailure).toBe("Error|-|fake-close-boom");
    expect(seen.stillThere).toBe(1);
    expect(seen.retry).toBe(true);
    expect(seen.afterRetry).toBe(0);
    expect([seen.firstKill, seen.secondKill]).toEqual([true, false]);
    expect(seen.closes).toEqual([["cleanup", "cleanup"], ["double"]]);
    expect(seen.sessions).toBe(0);
  });

  test("F2 · owner dispose đóng phiên + chặn spawn lại; service dispose đóng TẤT CẢ và xoá backend", async () => {
    const seen = (await same(async (world) => {
      const owner = makeOwner(world, "agent-1");
      const other = makeOwner(world, "agent-2");
      const handles: FakeHandle[] = [];
      world.service.registerBackend(makeBackend("fake", async () => {
        const handle = makeHandle();
        handles.push(handle);
        return makeSession(handle);
      }));
      const owned = await world.service.spawn(owner, { type: "fake" });
      const otherSession = await world.service.spawn(other, { type: "fake" });
      await owner.ctx.fiber.dispose();
      await new Promise((resolve) => setTimeout(resolve, 20));
      const ownerSessions = world.service.list(owner).length;
      const ownerActivity = world.service.hasOwnerActivity(owner);
      const ownerCloses = [...handles[0]?.closes ?? []];
      const blocked = await catchText(() => world.service.spawn(owner, { type: "fake" }));
      const otherAlive = world.service.list(other).length;
      await world.fiber.dispose();
      const serviceCloses = [...handles[1]?.closes ?? []];
      return {
        owned: owned.sessionId,
        otherSession: otherSession.sessionId,
        ownerSessions,
        ownerActivity,
        ownerCloses,
        blocked,
        otherAlive,
        afterService: world.service.list(other).length,
        backends: world.service.listBackends(),
        serviceCloses,
      };
    })) as Record<string, unknown>;
    expect(seen.owned).toBe("pty-1");
    expect(seen.otherSession).toBe("pty-2");
    expect(seen.ownerSessions).toBe(0);
    expect(seen.ownerActivity).toBe(false);
    expect(seen.ownerCloses).toEqual(["PTY owner disposed"]);
    expect(seen.blocked).toBe('TerminalError|OWNER_NOT_LIVE|agent "agent-1" is not the registered PTY owner');
    expect(seen.otherAlive).toBe(1);
    expect(seen.afterService).toBe(0);
    expect(seen.backends).toEqual([]);
    expect(seen.serviceCloses).toEqual(["PTY service disposed"]);
  });
});

describe("G · helper thuần + lỗi (A/B)", () => {
  test("G1 · TerminalSessionId · TerminalError · TerminalBackendCleanupError: trường/chuỗi/thứ bậc TRÙNG gốc", async () => {
    const seen = (await same((world) => {
      void world;
      const brand = ours.TerminalSessionId("pty-42");
      return {
        brand,
        branded: ours.TerminalSessionId(brand),
        empty: ours.TerminalSessionId(""),
        terminalError: (() => {
          const error = new ours.TerminalError("unknown PTY session pty-9", "NO_SESSION");
          return {
            name: error.name,
            code: error.code,
            message: error.message,
            isError: error instanceof Error,
            text: String(error),
            keys: Object.keys(error).sort(),
          };
        })(),
        cleanup: (() => {
          const spawnError = new Error("spawn-boom");
          const cleanupError = new Error("cleanup-boom");
          const error = new ours.TerminalBackendCleanupError(spawnError, cleanupError);
          return {
            name: error.name,
            message: error.message,
            isAggregate: error instanceof AggregateError,
            isError: error instanceof Error,
            errors: error.errors.map((item: unknown) => (item instanceof Error ? item.message : String(item))),
            spawn: error.spawnError === spawnError,
            cleanup: error.cleanupError === cleanupError,
            text: String(error),
          };
        })(),
      };
    })) as Record<string, unknown>;
    expect(seen.brand).toBe("pty-42");
    expect(seen.branded).toBe("pty-42");
    expect(seen.empty).toBe("");
    expect(seen.terminalError).toEqual({
      name: "TerminalError",
      code: "NO_SESSION",
      message: "unknown PTY session pty-9",
      isError: true,
      text: "TerminalError: unknown PTY session pty-9",
      keys: ["code", "name"],
    });
    expect(seen.cleanup).toEqual({
      name: "TerminalBackendCleanupError",
      message: "PTY backend startup and cleanup both failed",
      isAggregate: true,
      isError: true,
      errors: ["spawn-boom", "cleanup-boom"],
      spawn: true,
      cleanup: true,
      text: "TerminalBackendCleanupError: PTY backend startup and cleanup both failed",
    });
  });
});

describe("H · metadata gói + locale", () => {
  test("H1 · package.json: tên/private/exports 3 khoá/peer CHÉP stock/gbh.nested group 'pty', KHÔNG gbh.row", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      name: string;
      private: boolean;
      type: string;
      main: string;
      exports: Record<string, string>;
      peerDependencies: Record<string, string>;
      gbh: { peers: string[]; tests: string[]; row?: unknown; nested: { kind: string; pluginId: string; stockId: string; presets: string[] } };
    };
    const stockManifest = JSON.parse(
      readFileSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-terminal", "package.json"), "utf8"),
    ) as { peerDependencies: Record<string, string> };
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-terminal");
    expect(manifest.private).toBe(true);
    expect(manifest.type).toBe("module");
    expect(manifest.main).toBe("lib/index.js");
    expect(Object.keys(manifest.exports).sort()).toEqual([".", "./locale/*.json", "./package.json"]);
    // 08/11/2026 (dev-5 review + luật Lead): "." phải có điều kiện `types` khi lib/types TỒN TẠI (consumer TS mới thấy kiểu).
    expect(manifest.exports["."] as unknown as Record<string, string>).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" });
    expect(manifest.exports["./locale/*.json"]).toBe("./locale/*.json");
    expect(manifest.exports["./package.json"]).toBe("./package.json");
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(manifest.peerDependencies, stockManifest.peerDependencies)).toBe(true);
    expect(manifest.gbh.peers).toEqual(Object.keys(manifest.peerDependencies).sort());
    expect(manifest.gbh.tests).toEqual(["tests/host/terminal.test.ts"]);
    expect(manifest.gbh.row).toBeUndefined();
    expect(manifest.gbh.nested).toEqual({
      kind: "group",
      pluginId: "pty",
      stockId: "@deepseek-ai/dsh-terminal",
      presets: ["persistent-shell", "optional-persistent-terminals"],
    });
  });

  test("H2 · locale en/zh trùng TỪNG BYTE bản gốc (44 B / 146 B, cùng sha256)", () => {
    for (const name of ["en.json", "zh.json"]) {
      const ourText = readFileSync(join(OURS_LOCALE, name));
      const stockText = readFileSync(join(STOCK_LOCALE, name));
      expect(ourText.equals(stockText)).toBe(true);
      expect(sha256(ourText.toString("utf8"))).toBe(sha256(stockText.toString("utf8")));
    }
    expect(statSync(join(OURS_LOCALE, "en.json")).size).toBe(44);
    expect(statSync(join(OURS_LOCALE, "zh.json")).size).toBe(146);
    expect(JSON.parse(readFileSync(join(OURS_LOCALE, "en.json"), "utf8"))).toEqual({ meta: { title: "terminal" } });
    expect(JSON.parse(readFileSync(join(OURS_LOCALE, "zh.json"), "utf8"))).toEqual({
      meta: { title: "持久终端服务", description: "管理可持续交互的终端会话及其输入、输出和清理。" },
    });
  });
});