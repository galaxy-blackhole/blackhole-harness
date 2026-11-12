/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-time-context: chờ src/ + build.ts ổn định, build gói ta vào
 *      mkdtemp, nạp CẢ bản ta lẫn bundle gốc @deepseek-ai/dsh-time-context, rồi chạy cùng fixture trên
 *      ctx giả (agents/sessionProjections seam) và so sâu value/lỗi name/message/code/cause.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "time-context");
/** node_modules của kernel — nơi cả hai bản phân giải peer. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Bundle GỐC (CHỈ ĐỌC) — oracle. */
const STOCK_PATH = join(APP_MODULES, "@deepseek-ai", "dsh-time-context", "lib", "index.js");
/** Thư mục artifact tạm; dọn ở afterAll. */
const OUT = mkdtempSync(join(tmpdir(), "gbh-time-context-ab-"));
/** Mốc thời gian cố định cho mọi phép đo. */
const NOW = 1_712_345_678_901;
/** Bundle gốc nạp trong beforeAll. */
let stockMod: Module;
/** Bản của ta nạp từ artifact đã build. */
let oursMod: Module;

/** Bản ghi JSON thô dùng trong fixture. */
type Obj = Record<string, any>;
/** Kết quả chạy một phép (thành công hoặc ném). */
type Attempt = { ok: true; value: unknown } | { ok: false; error: unknown };
/** Người nghe waterfall agent/pre-step. */
type Listener = (payload: Obj, next: () => Promise<Obj>) => Promise<Obj>;
/** Bề mặt export của cả hai bundle. */
interface Module {
  /** Schema cấu hình (schemastery) — gọi được như hàm. */
  Config(input: unknown): Obj;
  /** Đăng ký projection + người nghe pre-step trên ctx. */
  apply(ctx: Obj, config: Obj): void;
  /** Tên service mà plugin inject. */
  inject: string[];
  /** Tên plugin. */
  name: string;
}
/** Projection mà plugin đăng ký. */
interface Registration {
  key: string;
  stateVersion: number;
  stateSchema: { parse(value: unknown): unknown };
  init(): Obj;
  apply(state: Obj, event: Obj): Obj;
}
/** Seam thu được sau apply. */
interface Installed {
  registration?: Registration;
  listener?: Listener;
  onEvent?: string;
  onOptions?: Obj;
  calls: string[];
}
/** Kịch bản một lần chạy pre-step. */
interface Scenario {
  now?: number;
  config?: Obj;
  state?: Obj;
  events?: Obj[];
  messages?: Obj[];
  decision?: Obj;
  turn?: number;
  step?: number;
  aborted?: boolean;
  nextError?: unknown;
}

/** Liệt kê tệp dưới một thư mục (đệ quy). */
function filesIn(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesIn(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/** Dấu vân tay nội dung src/ + build.ts + package.json để phát hiện ghi dở. */
function sourceStamp(): string {
  const files = [join(PKG, "build.ts"), join(PKG, "package.json"), ...filesIn(join(PKG, "src"))].sort();
  return files
    .map((file) => {
      const stat = statSync(file);
      const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
      return relative(PKG, file) + ":" + stat.size + ":" + digest;
    })
    .join("|");
}

/** Chờ tối đa 300s cho src/ + build.ts ổn định (HAI lần đo cách 300ms). */
async function waitForStableSource(): Promise<void> {
  const deadline = Date.now() + 300_000;
  let previous: string | undefined;
  while (Date.now() < deadline) {
    let current: string | undefined;
    try {
      current = sourceStamp();
    } catch {
      current = undefined;
    }
    if (current !== undefined && previous !== undefined && current === previous) return;
    previous = current;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("time-context: src/ + build.ts không ổn định trong 300s");
}

beforeAll(async () => {
  await waitForStableSource();
  const build = (await import(join(PKG, "build.ts"))) as {
    buildPackage(outDir?: string): Promise<string | { service: string }>;
  };
  const built = await build.buildPackage(OUT);
  const artifact = typeof built === "string" ? built : built.service;
  if (!existsSync(artifact)) throw new Error("time-context: build không tạo " + artifact);
  symlinkSync(APP_MODULES, join(OUT, "node_modules"), "dir");
  stockMod = (await import(STOCK_PATH)) as Module;
  oursMod = (await import(pathToFileURL(artifact).href)) as Module;
}, 330_000);

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

/** Hình dạng lỗi sâu: name/message/code/cause, không so stack. */
function errorShape(error: unknown): unknown {
  if (!(error instanceof Error)) return { thrown: String(error) };
  const value = error as Error & { code?: string; cause?: unknown };
  return {
    name: value.name,
    message: value.message,
    ...(value.code === undefined ? {} : { code: value.code }),
    ...(value.cause === undefined ? {} : { cause: errorShape(value.cause) }),
  };
}

/** Hình dạng kết quả để so A/B. */
function resultShape(result: Attempt): unknown {
  return result.ok ? { ok: true, value: result.value } : { ok: false, error: errorShape(result.error) };
}

/** Chạy một phép, bắt lỗi (đồng bộ lẫn bất đồng bộ). */
async function attempt(fn: () => unknown | Promise<unknown>): Promise<Attempt> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Chạy CẢ stock lẫn ours trên cùng callback rồi so sâu hình dạng kết quả. */
async function same(fn: (mod: Module) => unknown | Promise<unknown>): Promise<{ stock: Attempt; ours: Attempt }> {
  const stock = await attempt(() => fn(stockMod));
  const ours = await attempt(() => fn(oursMod));
  expect(resultShape(ours)).toEqual(resultShape(stock));
  return { stock, ours };
}

/** Đòi kết quả thành công và trả giá trị. */
function valueOf<T = Obj>(result: Attempt): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected success");
  return result.value as T;
}

/** Bỏ id ngẫu nhiên khỏi message để so cấu trúc. */
function stripIds(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, item) => (key === "id" ? undefined : item))) as unknown;
}

/** Chạy callback với Date.now bị ghim, rồi phục hồi. */
async function withNow<T>(now: number, fn: () => Promise<T>): Promise<T> {
  const original = Date.now;
  Date.now = () => now;
  try {
    return await fn();
  } finally {
    Date.now = original;
  }
}

/** Trạng thái projection ban đầu. */
function emptyState(): Obj {
  return { lastMessageTime: null, lastInjectionTime: null, lastTurnInjectionTime: null };
}

/** Message người dùng với id cố định. */
function message(text: string, source: Obj = { kind: "user" }): Obj {
  return { role: "user", id: "msg-" + text, content: [{ type: "text", text }], source };
}

/** Message user-rpc mang zone trình duyệt (hoặc zone bất kỳ để thử sai). */
function rpcMessage(text: string, zone?: unknown, rpcId: unknown = "rpc-1"): Obj {
  const source: Obj = { kind: "user" };
  if (rpcId !== undefined) source.rpcId = rpcId;
  if (zone !== undefined) source.clientTimeZone = zone;
  return message(text, source);
}

/** Sự kiện mặc định: lượt hiện tại có một message user-rpc zone Asia/Ho_Chi_Minh. */
function defaultEvents(): Obj[] {
  return [
    { type: "user/message", seq: 0, time: 1_000, data: message("older") },
    { type: "turn/start", seq: 1, time: 1_100, data: { turn: 1 } },
    { type: "user/message", seq: 2, time: 1_200, data: rpcMessage("hello", "Asia/Ho_Chi_Minh") },
  ];
}

/** Sự kiện KHÔNG mang zone nào. */
function noZoneEvents(): Obj[] {
  return [
    { type: "user/message", seq: 0, time: 1_000, data: message("older") },
    { type: "turn/start", seq: 1, time: 1_100, data: { turn: 1 } },
  ];
}

/** Message đề xuất mặc định của lượt. */
function defaultMessages(): Obj[] {
  return [rpcMessage("hello", "Asia/Ho_Chi_Minh")];
}

/** Session giả: eventAt(index) trả sự kiện thô. */
function makeSession(events: Obj[]): Obj {
  return {
    seq: events.length,
    eventAt(index: number): Obj | undefined {
      return events[index];
    },
  };
}

/** Dựng ctx giả và ghi lại seam mà apply gọi. */
function makeCtx(installed: Installed, state: Obj): Obj {
  return {
    sessionProjections: {
      register(registration: Registration): void {
        installed.registration = registration;
        installed.calls.push("register");
      },
      stateOf(): Obj {
        installed.calls.push("stateOf");
        return state;
      },
    },
    on(event: string, listener: Listener, options: Obj): void {
      installed.onEvent = event;
      installed.listener = listener;
      installed.onOptions = options;
      installed.calls.push("on");
    },
  };
}

/** Áp plugin lên ctx giả. */
function install(mod: Module, config: Obj, state: Obj = emptyState()): Installed {
  const installed: Installed = { calls: [] };
  mod.apply(makeCtx(installed, state), config);
  return installed;
}

/** Tóm tắt apply kể cả lỗi và tác dụng phụ đã ghi. */
function applyProbe(mod: Module, config: Obj): Obj {
  const installed: Installed = { calls: [] };
  let outcome: Obj;
  try {
    mod.apply(makeCtx(installed, emptyState()), config);
    outcome = { ok: true };
  } catch (error) {
    outcome = { ok: false, error: errorShape(error) };
  }
  return {
    outcome,
    calls: installed.calls,
    onEvent: installed.onEvent,
    onOptions: installed.onOptions,
    key: installed.registration?.key,
    stateVersion: installed.registration?.stateVersion,
    init: installed.registration?.init(),
    hasSchema: typeof installed.registration?.stateSchema?.parse === "function",
    hasListener: typeof installed.listener === "function",
  };
}

/** Chạy listener pre-step trên một bản cài. */
async function runPreStep(mod: Module, scenario: Scenario = {}): Promise<Obj> {
  const installed = install(mod, scenario.config ?? { timeZone: "UTC" }, scenario.state ?? emptyState());
  if (installed.listener === undefined) throw new Error("time-context: không đăng ký agent/pre-step");
  return withNow(scenario.now ?? NOW, async () => {
    const decision = structuredClone(
      scenario.decision ?? { kind: "enter", messages: scenario.messages ?? defaultMessages() },
    );
    const payload = {
      agent: { session: makeSession(scenario.events ?? defaultEvents()) },
      turn: scenario.turn ?? 1,
      step: scenario.step ?? 1,
      signal: { aborted: scenario.aborted ?? false },
    };
    return installed.listener!(payload, async () => {
      if (scenario.nextError !== undefined) throw scenario.nextError;
      return decision;
    });
  });
}

/** Chạy pre-step trên CẢ hai bản với cùng fixture rồi so sâu. */
async function samePreStep(scenario: Scenario = {}): Promise<{ stock: Attempt; ours: Attempt }> {
  return same(async (mod) => stripIds(await runPreStep(mod, scenario)));
}

/** Messages của một quyết định thành công. */
function messagesOf(result: Attempt): Obj[] {
  return valueOf<Obj>(result).messages as Obj[];
}

/** Message cuối (bản inject) của một quyết định thành công. */
function lastMessageOf(result: Attempt): Obj {
  const messages = messagesOf(result);
  expect(messages.length).toBeGreaterThan(0);
  return messages[messages.length - 1]!;
}

/** Text của message. */
function textOf(item: Obj): string {
  return item.content[0].text as string;
}

/** Ba dòng của một reading. */
function linesOf(item: Obj): string[] {
  return textOf(item).split("\n");
}

/** Đòi lỗi TypeError của zone và trả lỗi. */
function zoneError(result: Attempt): Error {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected failure");
  const error = result.error as Error;
  expect(error.name).toBe("TypeError");
  return error;
}

describe("time-context — bề mặt export", () => {
  test("01 export 1:1 + String(Config) + kiểu apply/Config", async () => {
    const result = await same((mod) => ({
      keys: Object.keys(mod).sort(),
      name: mod.name,
      inject: [...mod.inject],
      applyType: typeof mod.apply,
      configType: typeof mod.Config,
      configText: String(mod.Config),
    }));
    const surface = valueOf(result.ours);
    expect(surface.keys).toEqual(["Config", "apply", "inject", "name"]);
    expect(surface.name).toBe("time-context");
    expect(surface.applyType).toBe("function");
    expect(surface.configType).toBe("function");
    expect(surface.configText).toBe("{ timeZone?: string, refreshIntervalMs?: number }");
  });

  test("02 inject đúng ['agents','sessionProjections'] như bản gốc", async () => {
    const result = await same((mod) => ({ name: mod.name, inject: mod.inject }));
    expect(valueOf(result.ours)).toEqual({
      name: "time-context",
      inject: ["agents", "sessionProjections"],
    });
  });
});

describe("time-context — Config (schemastery)", () => {
  test("03 Config giữ nguyên input hợp lệ, không tự điền mặc định", async () => {
    const inputs: unknown[] = [
      {},
      { timeZone: "UTC" },
      { refreshIntervalMs: 0 },
      { refreshIntervalMs: 600_000 },
      { timeZone: "Asia/Ho_Chi_Minh", refreshIntervalMs: 5 },
      { unknown: 1 },
      null,
      undefined,
      { timeZone: undefined, refreshIntervalMs: undefined },
      { timeZone: null, refreshIntervalMs: null },
      { refreshIntervalMs: -1 },
      { refreshIntervalMs: 1.5 },
      { refreshIntervalMs: Number.MAX_SAFE_INTEGER + 1 },
    ];
    for (const input of inputs) {
      const result = await same((mod) => mod.Config(input));
      expect(result.ours.ok).toBe(true);
    }
    expect(valueOf((await same((mod) => mod.Config({}))).ours)).toEqual({});
    expect(valueOf((await same((mod) => mod.Config(null))).ours)).toEqual({});
    expect(valueOf((await same((mod) => mod.Config({ unknown: 1 }))).ours)).toEqual({ unknown: 1 });
    expect(valueOf((await same((mod) => mod.Config({ timeZone: "UTC", refreshIntervalMs: 0 }))).ours)).toEqual({
      timeZone: "UTC",
      refreshIntervalMs: 0,
    });
  });

  test("04 Config từ chối sai kiểu với ValidationError giống bản gốc", async () => {
    const inputs: unknown[] = [
      { refreshIntervalMs: "5" },
      { refreshIntervalMs: true },
      { refreshIntervalMs: {} },
      { timeZone: 5 },
      { timeZone: true },
      { timeZone: {} },
      [],
      "x",
    ];
    for (const input of inputs) {
      const result = await same((mod) => mod.Config(input));
      expect(result.ours.ok).toBe(false);
      if (result.ours.ok) continue;
      const error = result.ours.error as Error;
      expect(error.name).toBe("ValidationError");
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});

describe("time-context — apply/config", () => {
  test("05 apply mặc định đăng ký projection timeContext + listener prepend", async () => {
    const result = await same((mod) => applyProbe(mod, { timeZone: "UTC" }));
    const probe = valueOf(result.ours);
    expect(probe.outcome).toEqual({ ok: true });
    expect(probe.calls).toEqual(["register", "on"]);
    expect(probe.onEvent).toBe("agent/pre-step");
    expect(probe.onOptions).toEqual({ prepend: true });
    expect(probe.key).toBe("timeContext");
    expect(probe.stateVersion).toBe(2);
    expect(probe.init).toEqual({ lastMessageTime: null, lastInjectionTime: null, lastTurnInjectionTime: null });
    expect(probe.hasSchema).toBe(true);
    expect(probe.hasListener).toBe(true);
  });

  test("06 refreshIntervalMs sai ⇒ TypeError, KHÔNG đăng ký gì", async () => {
    const values: unknown[] = [-1, -0.1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, "5", true, {}, []];
    for (const value of values) {
      const result = await same((mod) => applyProbe(mod, { timeZone: "UTC", refreshIntervalMs: value }));
      const probe = valueOf(result.ours);
      expect(probe.outcome.ok).toBe(false);
      expect(probe.calls).toEqual([]);
      expect(probe.key).toBeUndefined();
      expect(probe.hasListener).toBe(false);
    }
    const precedence = await same((mod) => applyProbe(mod, { timeZone: "Not/AZone", refreshIntervalMs: -1 }));
    expect(valueOf(precedence.ours).outcome.ok).toBe(false);
    expect((valueOf(precedence.ours).outcome.error as Obj).name).toBe("TypeError");
  });

  test("07 timeZone sai ⇒ Error bọc RangeError, KHÔNG đăng ký gì", async () => {
    const values: unknown[] = ["Not/AZone", "", "UTC+7", "Asia/Ho Chi Minh", "Asia//Ho_Chi_Minh", "1Asia/Zone", 5, null, true];
    for (const value of values) {
      const result = await same((mod) => applyProbe(mod, { timeZone: value }));
      const probe = valueOf(result.ours);
      expect(probe.outcome.ok).toBe(false);
      expect(probe.calls).toEqual([]);
      expect(probe.key).toBeUndefined();
      expect(probe.hasListener).toBe(false);
      const error = probe.outcome.error as Obj;
      expect(error.name).toBe("Error");
      expect(String(error.message)).toContain("time-context: invalid IANA timeZone");
      expect((error.cause as Obj).name).toBe("RangeError");
    }
  });

  test("08 thiếu timeZone dùng zone tiến trình; alias/khác hoa thường được Intl chuẩn hoá", async () => {
    const systemZone = new Intl.DateTimeFormat("en-US").resolvedOptions().timeZone;
    const fallback = await samePreStep({
      config: {},
      events: noZoneEvents(),
      messages: [message("hello")],
    });
    expect(linesOf(lastMessageOf(fallback.ours))[0]).toContain("[" + systemZone + "]");

    const aliases = ["utc", "asia/ho_chi_minh", "Etc/UTC", "Asia/Saigon"];
    for (const timeZone of aliases) {
      const probe = await same((mod) => applyProbe(mod, { timeZone }));
      expect(valueOf(probe.ours).outcome).toEqual({ ok: true });
      const resolved = new Intl.DateTimeFormat("en-US", { timeZone }).resolvedOptions().timeZone;
      const result = await samePreStep({
        config: { timeZone },
        events: noZoneEvents(),
        messages: [message("hello")],
      });
      expect(linesOf(lastMessageOf(result.ours))[0]).toContain("[" + resolved + "]");
    }
  });
});

describe("time-context — lịch inject", () => {
  test("09 mặc định 600000ms + biên now-lastInjection, 0 inject mọi bước", async () => {
    const cases: Array<{ config: Obj; state: Obj; injected: boolean }> = [
      { config: { timeZone: "UTC" }, state: { ...emptyState(), lastInjectionTime: NOW - 599_999 }, injected: false },
      { config: { timeZone: "UTC" }, state: { ...emptyState(), lastInjectionTime: NOW - 600_000 }, injected: true },
      { config: { timeZone: "UTC" }, state: { ...emptyState(), lastInjectionTime: NOW }, injected: false },
      { config: { timeZone: "UTC" }, state: emptyState(), injected: true },
      { config: { timeZone: "UTC", refreshIntervalMs: 5_000 }, state: { ...emptyState(), lastInjectionTime: NOW - 4_999 }, injected: false },
      { config: { timeZone: "UTC", refreshIntervalMs: 5_000 }, state: { ...emptyState(), lastInjectionTime: NOW - 5_000 }, injected: true },
      { config: { timeZone: "UTC", refreshIntervalMs: 0 }, state: { ...emptyState(), lastInjectionTime: NOW }, injected: true },
      { config: { timeZone: "UTC" }, state: { ...emptyState(), lastInjectionTime: NOW + 1_000 }, injected: true },
    ];
    for (const item of cases) {
      const result = await samePreStep({ config: item.config, state: item.state });
      expect(messagesOf(result.ours)).toHaveLength(item.injected ? 2 : 1);
    }
  });
});

describe("time-context — browser zone từ request", () => {
  test("10 zone duy nhất (đề xuất hoặc đã vào lượt) ⇒ resolved + timestamp theo zone đó", async () => {
    const proposed = await samePreStep({
      events: noZoneEvents(),
      messages: [rpcMessage("hello", "Asia/Ho_Chi_Minh")],
    });
    const proposedLines = linesOf(lastMessageOf(proposed.ours));
    expect(proposedLines[1]).toBe(
      "Browser time zone for this request: Asia/Ho_Chi_Minh. Interpret otherwise-unqualified dates and times in this zone.",
    );
    expect(proposedLines[0]).toContain("[Asia/Ho_Chi_Minh]");

    const enteredEvents = [
      ...noZoneEvents(),
      { type: "user/message", seq: 2, time: 1_200, data: rpcMessage("entered", "America/New_York") },
    ];
    const entered = await samePreStep({
      events: enteredEvents,
      messages: [message("hello")],
      config: { timeZone: "Europe/Paris" },
    });
    const enteredLines = linesOf(lastMessageOf(entered.ours));
    expect(enteredLines[1]).toBe(
      "Browser time zone for this request: America/New_York. Interpret otherwise-unqualified dates and times in this zone.",
    );
    expect(enteredLines[0]).toContain("[America/New_York]");

    const duplicate = await samePreStep({
      events: enteredEvents,
      messages: [rpcMessage("hello", "America/New_York")],
    });
    expect(linesOf(lastMessageOf(duplicate.ours))[1]).toContain(
      "Browser time zone for this request: America/New_York.",
    );
  });

  test("11 nhiều zone ⇒ mixed sắp xếp, timestamp dùng fallback; không zone ⇒ unavailable", async () => {
    const mixed = await samePreStep({
      events: noZoneEvents(),
      messages: [rpcMessage("a", "UTC"), rpcMessage("b", "Asia/Ho_Chi_Minh")],
      config: { timeZone: "Europe/Paris" },
    });
    const mixedLines = linesOf(lastMessageOf(mixed.ours));
    expect(mixedLines[1]).toBe(
      'Browser time zone for this request: mixed ["Asia/Ho_Chi_Minh","UTC"]. Ask the user to clarify otherwise-unqualified dates and times.',
    );
    expect(mixedLines[0]).toContain("[Europe/Paris]");

    const missing = await samePreStep({
      events: noZoneEvents(),
      messages: [message("hello")],
      config: { timeZone: "UTC" },
    });
    const missingLines = linesOf(lastMessageOf(missing.ours));
    expect(missingLines[1]).toBe(
      "Browser time zone for this request: unavailable. Ask the user to clarify otherwise-unqualified dates and times.",
    );
    expect(missingLines[0]).toContain("[UTC]");

    const enteredMixed = await samePreStep({
      events: [
        ...noZoneEvents(),
        { type: "user/message", seq: 2, time: 1_200, data: rpcMessage("entered", "America/New_York") },
      ],
      messages: [rpcMessage("hello", "UTC")],
      config: { timeZone: "Asia/Ho_Chi_Minh" },
    });
    const enteredLines = linesOf(lastMessageOf(enteredMixed.ours));
    expect(enteredLines[1]).toContain('mixed ["America/New_York","UTC"]');
    expect(enteredLines[0]).toContain("[Asia/Ho_Chi_Minh]");
  });

  test("12 zone không canonical/không hỗ trợ ⇒ TypeError có cause đúng; source không đủ điều kiện thì bỏ qua", async () => {
    const invalidZones: unknown[] = [
      "asia/ho_chi_minh",
      "Not/AZone",
      "",
      "Asia/Ho Chi Minh",
      "Asia//Ho_Chi_Minh",
      "1Asia/Zone",
      "GMT",
      "UTC+7",
      "Asia/Ho_Chi_Minh/",
    ];
    for (const zone of invalidZones) {
      const result = await samePreStep({
        events: noZoneEvents(),
        messages: [rpcMessage("hello", zone)],
      });
      const error = zoneError(result.ours);
      expect(error.message).toMatch(/browser time zone (must be canonical|is unsupported)/u);
      if (error.message.includes("is unsupported")) {
        expect((error.cause as Obj).name).toBe("RangeError");
      }
    }

    const ignored: Obj[] = [
      message("no-rpc", { kind: "user", clientTimeZone: "Not/AZone" }),
      message("rpc-nonstring", { kind: "user", rpcId: 5, clientTimeZone: "Not/AZone" }),
      message("zone-nonstring", { kind: "user", rpcId: "rpc-1", clientTimeZone: 5 }),
      message("zone-null", { kind: "user", rpcId: "rpc-1", clientTimeZone: null }),
      message("kind-other", { kind: "assistant", rpcId: "rpc-1", clientTimeZone: "Not/AZone" }),
    ];
    for (const proposed of ignored) {
      const result = await samePreStep({ events: noZoneEvents(), messages: [proposed] });
      expect(linesOf(lastMessageOf(result.ours))[1]).toContain("Browser time zone for this request: unavailable.");
    }
    const canonical = await samePreStep({
      events: noZoneEvents(),
      messages: [rpcMessage("hello", "UTC")],
    });
    expect(linesOf(lastMessageOf(canonical.ours))[1]).toContain("Browser time zone for this request: UTC.");
  });
});

describe("time-context — timestamp/format", () => {
  test("13 nhiều zone + epoch biên + DST: cùng văn bản, đúng khuôn ISO offset/IANA", async () => {
    const matrix: Array<[string, number]> = [
      ["UTC", 0],
      ["UTC", -1],
      ["UTC", 1_712_345_678_901],
      ["UTC", 2_000_000_000_000],
      ["Asia/Ho_Chi_Minh", 1_712_345_678_901],
      ["America/New_York", 1_710_055_800_000],
      ["America/New_York", 1_730_611_800_000],
      ["Europe/Paris", 1_712_345_678_901],
      ["Australia/Lord_Howe", 1_712_345_678_901],
      ["Pacific/Chatham", 1_712_345_678_901],
      ["Asia/Kathmandu", 1_712_345_678_901],
      ["Etc/GMT+5", 1_712_345_678_901],
    ];
    for (const [zone, now] of matrix) {
      const result = await samePreStep({
        now,
        config: { timeZone: "UTC" },
        events: noZoneEvents(),
        messages: [rpcMessage("hello", zone)],
      });
      const lines = linesOf(lastMessageOf(result.ours));
      expect(lines[0]).toMatch(
        /^Time sampled while preparing turn 1, step 1: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}\[[^\]]+\]$/u,
      );
      expect(lines[0]).toContain("[" + zone + "]");
      expect(lines[1]).toContain("Browser time zone for this request: " + zone + ".");
    }

    const fallback = await samePreStep({
      config: { timeZone: "Europe/Paris" },
      events: noZoneEvents(),
      messages: [message("hello")],
    });
    expect(linesOf(lastMessageOf(fallback.ours))[0]).toContain("[Europe/Paris]");
  });

  test("14 elapsed: 0s/giây/phút/giờ/ngày, làm tròn xuống, mốc lùi kẹp 0; step 2 đo từ step context", async () => {
    const stepOne: Array<[number, string]> = [
      [0, "0s"],
      [999, "0s"],
      [1_000, "1s"],
      [59_999, "59s"],
      [60_000, "1m 0s"],
      [3_599_999, "59m 59s"],
      [3_600_000, "1h 0s"],
      [86_399_999, "23h 59m 59s"],
      [86_400_000, "1d 0s"],
      [90_061_000, "1d 1h 1m 1s"],
      [-5_000, "0s"],
    ];
    for (const [delta, expected] of stepOne) {
      const result = await samePreStep({
        config: { timeZone: "UTC", refreshIntervalMs: 0 },
        state: { ...emptyState(), lastMessageTime: NOW - delta },
        events: noZoneEvents(),
        messages: [rpcMessage("hello", "UTC")],
      });
      expect(linesOf(lastMessageOf(result.ours))[2]).toBe(
        "Elapsed since the preceding model-visible message: " + expected + ".",
      );
    }

    const stepTwo: Array<[number, string]> = [
      [0, "0s"],
      [999, "0s"],
      [3_600_000, "1h 0s"],
      [90_061_000, "1d 1h 1m 1s"],
      [-5_000, "0s"],
    ];
    for (const [delta, expected] of stepTwo) {
      const result = await samePreStep({
        step: 2,
        config: { timeZone: "UTC", refreshIntervalMs: 0 },
        state: { ...emptyState(), lastTurnInjectionTime: NOW - delta },
        events: noZoneEvents(),
        messages: [rpcMessage("hello", "UTC")],
      });
      expect(linesOf(lastMessageOf(result.ours))[2]).toBe(
        "Elapsed since the preceding step context: " + expected + ".",
      );
    }
  });
});

describe("time-context — biên lượt và waterfall", () => {
  test("15 chỉ gom user message của lượt đang mở, dừng ở turn/start khớp", async () => {
    const turnOne = await samePreStep({
      turn: 1,
      events: [
        { type: "user/message", seq: 0, time: 1_000, data: rpcMessage("old", "America/New_York") },
        { type: "turn/start", seq: 1, time: 1_100, data: { turn: 1 } },
        { type: "user/message", seq: 2, time: 1_200, data: rpcMessage("entered", "Europe/Paris") },
      ],
      messages: [message("hello")],
    });
    expect(linesOf(lastMessageOf(turnOne.ours))[1]).toContain(
      "Browser time zone for this request: Europe/Paris.",
    );

    const turnTwo = await samePreStep({
      turn: 2,
      events: [
        { type: "user/message", seq: 0, time: 1_000, data: rpcMessage("old", "America/New_York") },
        { type: "turn/start", seq: 1, time: 1_100, data: { turn: 1 } },
        { type: "user/message", seq: 2, time: 1_200, data: rpcMessage("one", "Europe/Paris") },
        { type: "turn/start", seq: 3, time: 1_300, data: { turn: 2 } },
        { type: "user/message", seq: 4, time: 1_400, data: rpcMessage("two", "UTC") },
      ],
      messages: [rpcMessage("hello", "Asia/Ho_Chi_Minh")],
    });
    expect(linesOf(lastMessageOf(turnTwo.ours))[1]).toContain('mixed ["Asia/Ho_Chi_Minh","UTC"]');

    const noBoundary = await samePreStep({
      turn: 1,
      events: [
        { type: "user/message", seq: 0, time: 1_000, data: rpcMessage("a", "America/New_York") },
        { type: "user/message", seq: 1, time: 1_100, data: rpcMessage("b", "UTC") },
      ],
      messages: [],
    });
    // Không có turn/start khớp ⇒ stock bỏ TOÀN BỘ message đã vào, chỉ còn proposed (rỗng) ⇒ missing.
    expect(linesOf(lastMessageOf(noBoundary.ours))[1]).toContain("Browser time zone for this request: unavailable.");

    const empty = await samePreStep({
      events: [],
      messages: [rpcMessage("hello", "UTC")],
    });
    expect(linesOf(lastMessageOf(empty.ours))[1]).toContain("Browser time zone for this request: UTC.");

    const staleBoundary = await samePreStep({
      turn: 1,
      events: [
        { type: "user/message", seq: 0, time: 1_000, data: rpcMessage("a", "America/New_York") },
        { type: "turn/start", seq: 1, time: 1_100, data: { turn: 3 } },
        { type: "user/message", seq: 2, time: 1_200, data: rpcMessage("b", "UTC") },
      ],
      messages: [],
    });
    // turn/start của lượt KHÁC không kết thúc vòng quét ⇒ cũng không có biên khớp ⇒ missing.
    expect(linesOf(lastMessageOf(staleBoundary.ours))[1]).toContain("Browser time zone for this request: unavailable.");
  });

  test("16 reject/abort/signal đã hủy ⇒ không inject; next ném ⇒ lỗi lan nguyên vẹn", async () => {
    const reject = await samePreStep({
      decision: { kind: "reject", messages: [message("hello")] },
    });
    const rejected = valueOf<Obj>(reject.ours);
    expect(rejected.kind).toBe("reject");
    expect(rejected.messages).toHaveLength(1);

    const aborted = await samePreStep({
      aborted: true,
      config: { timeZone: "UTC", refreshIntervalMs: 0 },
      messages: [message("hello")],
    });
    expect(messagesOf(aborted.ours)).toHaveLength(1);

    const extra = await samePreStep({
      decision: { kind: "enter", messages: [message("hello")], meta: { tag: "keep" } },
    });
    const kept = valueOf<Obj>(extra.ours);
    expect(kept.meta).toEqual({ tag: "keep" });
    expect(kept.messages).toHaveLength(2);

    const upstream = new Error("upstream pre-step failed");
    const thrown = await samePreStep({ nextError: upstream });
    expect(thrown.ours.ok).toBe(false);
    if (!thrown.ours.ok) {
      expect((thrown.ours.error as Error).message).toBe("upstream pre-step failed");
    }
  });
});

describe("time-context — projection timeContext", () => {
  test("17 register đúng key/version/schema; init + apply chuyển trạng thái như bản gốc", async () => {
    const result = await same((mod) => {
      const installed = install(mod, { timeZone: "UTC" });
      const registration = installed.registration!;
      const fresh = registration.init();
      const events: Obj[] = [
        { type: "turn/start", time: 1, data: { turn: 1 } },
        { type: "turn/end", time: 2, data: { turn: 1 } },
        { type: "user/message", time: 10, data: { source: { kind: "user" } } },
        { type: "user/message", time: 20, data: { source: { kind: "time-context" } } },
        { type: "assistant/message", time: 30, data: {} },
        { type: "tool/result", time: 40, data: {} },
        { type: "llm/stream", time: 50, data: {} },
      ];
      let state = fresh;
      const transitions = events.map((event) => {
        state = registration.apply(state, event);
        return state;
      });
      const rich = { lastMessageTime: 100, lastInjectionTime: 200, lastTurnInjectionTime: 300 };
      return {
        keys: Object.keys(registration).sort(),
        key: registration.key,
        stateVersion: registration.stateVersion,
        init: fresh,
        transitions,
        clearedByTurnStart: registration.apply(rich, { type: "turn/start", time: 1, data: { turn: 2 } }),
        clearedByTurnEnd: registration.apply(rich, { type: "turn/end", time: 2, data: { turn: 2 } }),
        sameUserTime: registration.apply(rich, { type: "user/message", time: 100, data: { source: { kind: "user" } } }),
        valid: registration.stateSchema.parse({ lastMessageTime: 1, lastInjectionTime: 2, lastTurnInjectionTime: 3 }),
        extra: registration.stateSchema.parse({
          lastMessageTime: 1,
          lastInjectionTime: 2,
          lastTurnInjectionTime: 3,
          extra: "ignored",
        }),
      };
    });
    const probe = valueOf(result.ours);
    expect(probe.keys).toEqual(["apply", "init", "key", "stateSchema", "stateVersion"]);
    expect(probe.key).toBe("timeContext");
    expect(probe.stateVersion).toBe(2);
    expect(probe.init).toEqual(emptyState());
    expect(probe.valid).toEqual({ lastMessageTime: 1, lastInjectionTime: 2, lastTurnInjectionTime: 3 });
    expect(probe.extra).toEqual({ lastMessageTime: 1, lastInjectionTime: 2, lastTurnInjectionTime: 3 });
  });

  test("18 schema từ chối trạng thái sai kiểu/thiếu trường với ZodError giống bản gốc", async () => {
    const invalidStates: unknown[] = [
      {},
      { lastMessageTime: "x", lastInjectionTime: 2, lastTurnInjectionTime: 3 },
      { lastMessageTime: 1, lastInjectionTime: "x", lastTurnInjectionTime: 3 },
      { lastMessageTime: 1, lastInjectionTime: 2 },
      null,
    ];
    for (const state of invalidStates) {
      const result = await same((mod) => {
        const installed = install(mod, { timeZone: "UTC" });
        return installed.registration!.stateSchema.parse(state);
      });
      expect(result.ours.ok).toBe(false);
      if (result.ours.ok) continue;
      expect((result.ours.error as Error).name).toBe("ZodError");
      expect((result.ours.error as Error).message.length).toBeGreaterThan(0);
    }
  });
});

describe("time-context — hình dạng message inject", () => {
  test("19 message user đông cứng, source snapshot time-context, nội dung 3 dòng, giữ message gốc", async () => {
    const proposed = message("hello", { kind: "user", rpcId: "rpc-1", clientTimeZone: "UTC" });
    const scenario: Scenario = {
      events: noZoneEvents(),
      decision: { kind: "enter", messages: [proposed], meta: { tag: "keep" } },
    };
    const result = await samePreStep(scenario);
    const decision = valueOf<Obj>(result.ours);
    expect(decision.kind).toBe("enter");
    expect(decision.meta).toEqual({ tag: "keep" });
    expect(decision.messages).toHaveLength(2);
    // samePreStep đã bỏ id ngẫu nhiên để so A/B; message gốc vẫn nguyên vị trí đầu.
    expect(decision.messages[0]).toEqual(stripIds(proposed));

    // Bản RAW (không chuẩn hoá) để kiểm id/frozen — vẫn sau phép A/B ở trên.
    const raw = await runPreStep(oursMod, scenario);
    expect(raw.messages[0]).toEqual(proposed);
    const injected = raw.messages[1] as Obj;
    const lines = linesOf(injected);
    expect(injected.role).toBe("user");
    expect(typeof injected.id).toBe("string");
    expect(injected.id.length).toBeGreaterThan(0);
    expect(injected.source).toEqual({
      kind: "time-context",
      form: "snapshot",
      sections: [{ name: "time-context", text: textOf(injected) }],
    });
    expect(injected.content).toEqual([{ type: "text", text: textOf(injected) }]);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^Time sampled while preparing turn 1, step 1: /u);
    expect(lines[1]).toBe(
      "Browser time zone for this request: UTC. Interpret otherwise-unqualified dates and times in this zone.",
    );
    expect(lines[2]).toBe("Elapsed since the preceding model-visible message: unavailable.");
    expect(Object.isFrozen(injected)).toBe(true);
    expect(Object.isFrozen(injected.content)).toBe(true);
    expect(Object.isFrozen(injected.source)).toBe(true);
  });

  test("20 ma trận fixture tổng hợp: mọi tổ hợp bước/zone/state cho CÙNG kết quả hai bản", async () => {
    const fixtures: Scenario[] = [
      { step: 1, config: { timeZone: "UTC" }, events: noZoneEvents(), messages: [message("a")] },
      {
        step: 1,
        config: { timeZone: "Asia/Ho_Chi_Minh" },
        events: noZoneEvents(),
        messages: [rpcMessage("a", "America/New_York")],
        state: { ...emptyState(), lastMessageTime: NOW - 90_000 },
      },
      {
        step: 2,
        config: { timeZone: "UTC", refreshIntervalMs: 0 },
        events: noZoneEvents(),
        messages: [rpcMessage("a", "Europe/Paris")],
        state: { ...emptyState(), lastTurnInjectionTime: NOW - 3_600_000 },
      },
      {
        step: 1,
        config: { timeZone: "UTC" },
        events: noZoneEvents(),
        messages: [rpcMessage("a", "UTC"), rpcMessage("b", "Asia/Ho_Chi_Minh")],
        state: { ...emptyState(), lastInjectionTime: NOW - 1_000 },
      },
      {
        step: 1,
        config: { timeZone: "Europe/Paris" },
        events: noZoneEvents(),
        messages: [message("a")],
        state: { ...emptyState(), lastMessageTime: NOW + 5_000 },
      },
      {
        step: 3,
        config: { timeZone: "UTC", refreshIntervalMs: 0 },
        events: noZoneEvents(),
        messages: [rpcMessage("a", "UTC")],
        state: { ...emptyState(), lastTurnInjectionTime: NOW - 86_400_000 },
      },
    ];
    for (const fixture of fixtures) {
      const result = await samePreStep(fixture);
      const messages = messagesOf(result.ours);
      expect(messages.length === 1 || messages.length === 2).toBe(true);
      // Chỉ message CUỐI có source time-context mới là bản inject; fixture bị chặn có thể có 2 proposed.
      const last = messages[messages.length - 1]!;
      if (last.source.kind === "time-context") {
        expect(linesOf(last)).toHaveLength(3);
      }
    }
  });
});
