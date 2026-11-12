/** /** author Bùi Trọng Hiếu email kevinbui210191@gmail.com create date 15/10/2026 modify date 01/11/2026 desc A/B cho gbh-workflow-ptc: A = bundle gốc, B = artefact của ta — export/Config/mount cordis THẬT, bốn seam GIẢ theo đúng inject, mọi nhánh start (meta/lỗi/timeout/abort/sandbox), guest bindings, validateMeta/materializeFromRealm, metadata gói và cơ chế nested group hai nơi. KHÔNG mạng/spawn. / */

import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderGroupRewriteBlocks } from "../../apps/cli/src/profile.ts";
import { readNestedRedirects, rewriteNestedNames } from "../../packages/host/agent-preset-registry/src/nested-mount.ts";
// 05/11/2026 (P1b): chuẩn hoá id GBH → id gốc trước khi so byte với bundle stock.
import { chuanHoaHost } from "../lib/artefact-normalize.ts";
import { buildPackage } from "../../packages/host/workflow-ptc/build.ts";
import { assembleBundle, stripSliceScaffold } from "../../packages/host/workflow-ptc/src/assemble.ts";
import {
  MODULE_TAIL,
  OUT_FILE_NAME,
  PACKAGE_NAME,
  PART_FILES,
  SLICE_MARKER,
  STOCK_BUNDLE,
  STOCK_PACKAGE_NAME,
} from "../../packages/host/workflow-ptc/src/manifest.ts";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "workflow-ptc");
/** Artefact chuẩn của ta. */
const LIB = join(PKG, "lib", "index.js");
/** Gói GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-workflow-ptc");
/** Bundle GỐC. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Cordis THẬT của runtime app. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Patch bundle chèn row NHÓM top-level optional-ralph (nguồn của nhánh (a)). */
const RALPH_PATCH = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-experimental-ralph-bundle", "cordis.patch.yml");

/** Bundle gốc · 4 export runtime · 4 inject · 6 sự kiện vòng đời · số byte + sha256. */
const STOCK_TEXT = readFileSync(STOCK, "utf8");
const EXPORT_NAMES = ["MaterializeError", "default", "materializeFromRealm", "validateMeta"];
const INJECT = ["subagents", "ptcRuntime", "sandboxPolicy", "workingDirectory"];
const EVENT_NAMES = ["workflow/start", "workflow/phase", "workflow/log", "workflow/agent-start", "workflow/agent-end", "workflow/end"];
const STOCK_BYTES = 66267;
const STOCK_SHA = "c7718bc30bcdfb33de38e2011096f2edddccba536b8891c4e6ea456a41fbf19c";

/** Bề mặt module (hai bên cùng hình dạng). */
type Api = Record<string, any>;

// Build THẬT vào lib/: ca E2 đọc đúng file build ra.
buildPackage(join(PKG, "lib"));
// Bề mặt ĐO nạp từ bản dựng trong thư mục tạm có symlink @deepseek-ai của KERNEL (pattern
// tests/host/shell.test.ts): nạp thẳng lib/ thì peer trỏ về bản .bun của workspace — KHÁC realpath kernel
// ⇒ A2 đỏ oan. build.ts xoá sạch outDir nên symlink dựng SAU build.
const SURFACE_DIR = mkdtempSync(join(tmpdir(), "gbh-workflow-ptc-"));
const SURFACE_ARTIFACT = buildPackage(SURFACE_DIR);
mkdirSync(join(SURFACE_DIR, "node_modules"), { recursive: true });
symlinkSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), join(SURFACE_DIR, "node_modules", "@deepseek-ai"), "dir"); symlinkSync(join(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(SURFACE_DIR, "node_modules", "@galaxy-blackhole"), "dir");
const ours = (await import(SURFACE_ARTIFACT)) as Api;
const stock = (await import(STOCK)) as Api;
const ContextCtor = ((await import(CORDIS)) as { Context: new () => any }).Context;

/** Dọn thư mục dựng tạm của bề mặt đo. Nhận: không. Trả: không. */
afterAll(() => rmSync(SURFACE_DIR, { recursive: true, force: true }));

/** Một lượt chạy ghi vết. */
interface Rig {
  ctx: any;
  resolved: any[];
  specs: any[];
  childCalls: any[];
  disposed: string[];
  events: string[];
  warns: string[];
  inits: any[];
}

/** Tuỳ chọn dựng rig. */
interface RigOptions {
  config?: Record<string, unknown>;
  language?: string;
  sandboxMode?: string | null;
  policyMode?: string;
  run?: (spec: any, rig: Rig) => any;
  startActivation?: (spec: any, rig: Rig) => any;
}

/** Rig + fiber + engine sau mount. */
interface Mounted extends Rig {
  fiber: any;
  engine: any;
}

/** Băm SHA-256; nhận chuỗi/byte, trả hex 64 ký tự. */
function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Chờ tới khi phép dò trả giá trị khác undefined; nhận probe/label/timeout, trả giá trị đó. */
async function waitFor<T>(probe: () => T | undefined, label: string, timeoutMs = 2000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error("timeout: " + label);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Nhường một nhịp timer (mặc định 10ms) để workflow/end kịp phát. */
async function settle(ms = 10): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Vết sự kiện đã chuẩn hoá — bỏ id ngẫu nhiên để A/B so được. */
function traceOf(name: string, args: any[]): string {
  if (name === "workflow/start") return "start";
  if (name === "workflow/phase") return "phase:" + String(args[0]);
  if (name === "workflow/log") return "log:" + String(args[0]);
  if (name === "workflow/agent-start" || name === "workflow/agent-end") return name + ":" + JSON.stringify(args[0]);
  if (name === "workflow/end") {
    const result = { ...(args[0] as any) };
    if (result.error !== undefined) result.error = firstLine(result.error);
    return "end:" + JSON.stringify(result);
  }
  return name;
}

/** Dựng rig với bốn seam GIẢ đúng tên inject của engine (chưa mount). */
function makeRig(options: RigOptions = {}): Rig {
  const rig: Rig = {
    ctx: new ContextCtor(),
    resolved: [],
    specs: [],
    childCalls: [],
    disposed: [],
    events: [],
    warns: [],
    inits: [],
  };
  const runtime: any = {
    language: options.language ?? "typescript",
    isolation: "worker-thread",
    programFormat: "repl",
    sandboxMode: options.sandboxMode === null ? undefined : options.sandboxMode ?? "workspace-write",
    timeout: { defaultMs: 1000, maxMs: 2000 },
    executionInstructions: "huong dan gia",
    release: async () => undefined,
    resolve: (request: any) => {
      rig.resolved.push(request);
      return { ...request, cwd: request.cwd ?? "/work/project", timeoutMs: null };
    },
    run: async (spec: any) => {
      rig.specs.push(spec);
      if (options.run !== undefined) return options.run(spec, rig);
      return { logs: [], value: { value: null, stopReason: "completed", agentsStarted: 0 } };
    },
  };
  const subagents: any = {
    getProvider: (name: string) => (name === "spawn" || name === "fork" ? { name } : undefined),
    startActivation: async (spec: any) => {
      rig.childCalls.push(spec);
      if (options.startActivation !== undefined) return options.startActivation(spec, rig);
      return {
        childId: "child-1",
        result: Promise.resolve({ output: [{ type: "text", text: "con tra loi" }], stopReason: "completed", structured: { ok: true } }),
        dispose: async () => {
          rig.disposed.push(spec.label);
        },
      };
    },
  };
  rig.ctx.provide("subagents", subagents);
  rig.ctx.provide("ptcRuntime", runtime);
  rig.ctx.provide("sandboxPolicy", {
    mode: options.policyMode ?? "workspace-write",
    resolve: () => ({ mode: options.policyMode ?? "workspace-write", workspaceRoot: "/work" }),
  });
  rig.ctx.provide("workingDirectory", { ensure: async () => "/work/project" });
  rig.ctx.logger.warn = (...parts: unknown[]) => {
    rig.warns.push(parts.map((part) => String(part)).join(" "));
  };
  for (const name of EVENT_NAMES) {
    rig.ctx.on(name, (...args: unknown[]) => {
      rig.events.push(traceOf(name, args.slice(1) as any[]));
    });
  }
  return rig;
}

/** Mount engine qua ctx.plugin THẬT; trả rig + fiber + service workflowEngine. */
async function mount(api: Api, options: RigOptions = {}): Promise<Mounted> {
  const rig = makeRig(options);
  const fiber = rig.ctx.plugin(api.default, options.config ?? {});
  await fiber;
  const engine = await waitFor(() => rig.ctx.get("workflowEngine") as any, "service workflowEngine");
  return { ...rig, fiber, engine };
}

/** Request mẫu (parent/session mới mỗi lượt). */
function makeRequest(extra: Record<string, unknown> = {}): any {
  return {
    meta: { name: "demo", description: "mo ta" },
    script: "return 42",
    parent: { session: { id: "session-1" } },
    ...extra,
  };
}

/** Chuẩn hoá lỗi đồng bộ thành { ok, name, message, code } để so A/B. */
function failureOf(fn: () => unknown): Record<string, any> {
  try {
    fn();
    return { ok: true };
  } catch (error: any) {
    return { ok: false, name: String(error?.name), message: String(error?.message), code: error?.code };
  }
}

/** Dòng đầu của một chuỗi (bỏ stack) để so lỗi A/B. */
function firstLine(text: unknown): string {
  return String(text).split(String.fromCharCode(10))[0] ?? "";
}

/** Bản sao JSON thuần của một giá trị. */
function plain(value: unknown): any {
  return JSON.parse(JSON.stringify(value));
}

/** Chạy cùng kịch bản trên HAI bản (A = gốc, B = ta); trả rig + kết quả đã settle. */
async function runBoth(
  options: RigOptions = {},
  extra: Record<string, unknown> = {},
): Promise<{ a: Mounted; b: Mounted; resultA: any; resultB: any; runA: any; runB: any }> {
  const a = await mount(ours, options);
  const b = await mount(stock, options);
  const runA = a.engine.start(makeRequest(extra));
  const runB = b.engine.start(makeRequest(extra));
  const resultA = await runA.result;
  const resultB = await runB.result;
  await settle();
  return { a, b, resultA, resultB, runA, runB };
}

/** Gọi binding, bắt CẢ lỗi đồng bộ lẫn rejection; trả "ok:<json>" hoặc "err:<message>". */
async function callBinding(host: Record<string, any>, name: string, arg: unknown): Promise<string> {
  try {
    const value = await host[name](arg);
    return "ok:" + JSON.stringify(value);
  } catch (error: any) {
    return "err:" + String(error?.message ?? error);
  }
}

describe("A · artefact + bề mặt export (A/B)", () => {
  test("A1 cổng BYTE: bản ghép = bundle gốc từng byte, delta 0, sha256 trùng, lib/index.js trùng", () => {
    expect(SURFACE_ARTIFACT).toBe(join(SURFACE_DIR, OUT_FILE_NAME));
    // 05/11/2026 (P1b): artefact mang id GBH ⇒ quy id về dạng gốc rồi mới so byte/sha/số dòng với stock.
    const mine = Buffer.from(chuanHoaHost(readFileSync(SURFACE_ARTIFACT, "utf8")), "utf8");
    const theirs = readFileSync(STOCK);
    expect(mine.equals(theirs)).toBe(true);
    expect(mine.length).toBe(STOCK_BYTES);
    expect(Buffer.byteLength(STOCK_TEXT, "utf8")).toBe(STOCK_BYTES);
    expect(sha256(mine)).toBe(STOCK_SHA);
    expect(sha256(mine)).toBe(sha256(theirs));
    expect(Buffer.from(chuanHoaHost(readFileSync(LIB, "utf8")), "utf8").equals(readFileSync(STOCK))).toBe(true);
    expect((chuanHoaHost(readFileSync(LIB, "utf8")).match(/\n/g) ?? []).length).toBe(670);
    // Không đăng ký id module nào (host-only) — cả hai bên đều 0.
    expect([...STOCK_TEXT.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...(readFileSync(LIB, "utf8").matchAll(/id: @galaxy-blackhole/g))].length).toBe(0);
  });

  test("A2 tập export runtime = gốc (4 tên) + default là lớp PtcWorkflowEngine + inject/prototype trùng", () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual([...EXPORT_NAMES].sort());
    expect(typeof ours.default).toBe("function");
    expect(ours.default.name).toBe(stock.default.name);
    expect(ours.default.name).toBe("PtcWorkflowEngine");
    expect(ours.default.inject).toEqual(stock.default.inject);
    expect(ours.default.inject).toEqual(INJECT);
    // 05/11/2026 (P1b): artefact của ta nạp lớp nền "@galaxy-blackhole/gbh-workflow" còn bản stock nạp
    // "@deepseek-ai/dsh-workflow" ⇒ HAI lớp khác danh tính, nhưng PHẢI cùng TÊN + cùng bề mặt prototype.
    expect(Object.getPrototypeOf(ours.default).name).toBe("WorkflowEngine");
    expect(Object.getPrototypeOf(ours.default).name).toBe(Object.getPrototypeOf(stock.default).name);
    expect(Object.getOwnPropertyNames(ours.default.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.default.prototype).sort(),
    );
    expect(Object.getOwnPropertyNames(ours.default.prototype).sort()).toEqual(["constructor", "start"]);
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(ours.default.prototype)).sort()).toEqual(
      Object.getOwnPropertyNames(Object.getPrototypeOf(stock.default.prototype)).sort(),
    );
    // Gói engine KHÔNG đăng ký tool/section nào — bề mặt là service workflowEngine.
    expect("apply" in ours).toBe(false);
    expect("tools" in ours).toBe(false);
    expect("sections" in ours).toBe(false);
  });

  test("A3 String(Config) + 6 đầu vào Config A≡B (mặc định · đầy đủ · 4 lỗi schema)", () => {
    expect(String(ours.default.Config)).toBe(String(stock.default.Config));
    const inputs: Record<string, unknown>[] = [
      {},
      { provider: "fork", maxConcurrentAgents: 4, maxTotalAgents: 12, maxItemsPerCall: 64, syncTimeoutMs: 250 },
      { maxConcurrentAgents: 0 },
      { maxTotalAgents: 0 },
      { provider: 7 },
      { syncTimeoutMs: 1.5 },
    ];
    for (const input of inputs) {
      expect(failureOf(() => stock.default.Config(input))).toEqual(failureOf(() => ours.default.Config(input)));
    }
    expect(plain(ours.default.Config({}))).toEqual({
      provider: "spawn",
      maxConcurrentAgents: 0,
      maxTotalAgents: 1000,
      maxItemsPerCall: 4096,
      syncTimeoutMs: 5000,
    });
    expect(failureOf(() => ours.default.Config({ maxTotalAgents: 0 }))).toEqual({
      ok: false,
      name: "ValidationError",
      message: "$.maxTotalAgents expected number >= 1 but got 0",
      code: undefined,
    });
    expect(failureOf(() => ours.default.Config({ provider: 7 }))).toEqual({
      ok: false,
      name: "ValidationError",
      message: "$.provider expected string but got 7",
      code: undefined,
    });
  });
});

describe("B · mount trên Context cordis THẬT (bề mặt plugin)", () => {
  test("B1 service workflowEngine xuất hiện qua ctx.plugin, config resolve, dispose rút service — A≡B", async () => {
    const a = await mount(ours);
    const b = await mount(stock);
    for (const side of [a, b]) {
      expect(side.engine).toBeDefined();
      expect(side.engine.name).toBe("workflowEngine");
      expect(typeof side.engine.start).toBe("function");
    }
    expect(a.engine instanceof ours.default).toBe(true);
    expect(b.engine instanceof stock.default).toBe(true);
    expect(plain(a.engine.config)).toEqual(plain(b.engine.config));
    expect(plain(a.engine.config)).toEqual({
      provider: "spawn",
      maxConcurrentAgents: 0,
      maxTotalAgents: 1000,
      maxItemsPerCall: 4096,
      syncTimeoutMs: 5000,
    });
    // Engine chỉ là service: KHÔNG chạm bề mặt tool (rig không cấp ctx.tools, engine không đăng ký gì).
    expect(a.ctx.get("tools")).toBeUndefined();
    expect(b.ctx.get("tools")).toBeUndefined();
    await a.fiber.dispose?.();
    await b.fiber.dispose?.();
    expect(a.ctx.get("workflowEngine")).toBeUndefined();
    expect(b.ctx.get("workflowEngine")).toBeUndefined();
  });

  test("B2 inject GATE: thiếu bốn service ⇒ fiber PENDING, chưa có workflowEngine; cấp đủ ⇒ ACTIVE", async () => {
    const ctx = new ContextCtor();
    const fiber = ctx.plugin(ours.default, {});
    await settle(20);
    expect(ctx.get("workflowEngine")).toBeUndefined();
    expect(fiber.state).not.toBe(2);
    const rig = makeRig();
    ctx.provide("subagents", rig.ctx.get("subagents"));
    ctx.provide("ptcRuntime", rig.ctx.get("ptcRuntime"));
    ctx.provide("sandboxPolicy", rig.ctx.get("sandboxPolicy"));
    ctx.provide("workingDirectory", rig.ctx.get("workingDirectory"));
    const engine = await waitFor(() => ctx.get("workflowEngine") as any, "service sau khi cấp inject");
    expect(engine.name).toBe("workflowEngine");
    expect(fiber.state).toBe(2);
    await fiber.dispose?.();
  });

  test("B3 runtime KHÔNG phải typescript ⇒ constructor ném, service không xuất hiện — A≡B", async () => {
    for (const api of [ours, stock]) {
      const ctx = new ContextCtor();
      const fiber = ctx.plugin(api.default, {});
      ctx.provide("subagents", {});
      ctx.provide("ptcRuntime", { language: "python" });
      ctx.provide("sandboxPolicy", {});
      ctx.provide("workingDirectory", {});
      await settle(30);
      expect(ctx.get("workflowEngine")).toBeUndefined();
      expect(fiber.state).not.toBe(2);
      await fiber.dispose?.();
    }
  });
});

describe("C · start() + giao thức guest trên seam GIẢ", () => {
  test("C1 lượt chạy THÀNH CÔNG: program repl, bindings workflowHost, sự kiện start..end, kết quả JSON", async () => {
    let guest: any;
    const { a, b, resultA, resultB } = await runBoth({
      run: async (spec: any, rig: Rig) => {
        const host = spec.bindings[0].functions;
        rig.inits.push(await host.begin({}));
        guest = Object.keys(host).sort();
        return { logs: [], value: { value: { ran: true, n: 2 }, stopReason: "completed", agentsStarted: 0 } };
      },
    });
    expect(resultA).toEqual(resultB);
    expect(resultA).toEqual({ value: { ran: true, n: 2 }, stopReason: "completed", agentsStarted: 0 });
    expect(a.events).toEqual(b.events);
    expect(a.events).toEqual(["start", "end:" + JSON.stringify({ stopReason: "completed", agentsStarted: 0 })]);
    const spec = a.specs[0];
    expect(Object.keys(spec).sort()).toEqual(["bindings", "cwd", "program", "sandboxPolicy", "signal", "timeoutMs"]);
    expect(spec.cwd).toBe("/work/project");
    expect(spec.timeoutMs).toBeNull();
    expect(spec.sandboxPolicy).toEqual({ mode: "workspace-write", workspaceRoot: "/work" });
    expect(spec.program.startsWith("await (async () => {")).toBe(true);
    expect(spec.program).toContain("runWorkflowGuest");
    expect(spec.program).toContain("workflowHost");
    expect(spec.bindings.length).toBe(1);
    expect(spec.bindings[0].global).toBe("workflowHost");
    expect(guest).toEqual(["begin", "childResult", "disposeChild", "progress", "startChild"]);
    // resolve() nhận ĐÚNG cwd đã await từ workingDirectory.ensure + program/bindings.
    expect(a.resolved[0].cwd).toBe("/work/project");
    expect(a.resolved[0].program).toBe(spec.program);
    expect(a.resolved[0].bindings).toBe(spec.bindings);
    expect(b.resolved[0].cwd).toBe(a.resolved[0].cwd);
  });

  test("C2 meta: 3 lỗi META_INVALID + meta NORMALIZE đi vào begin() — A≡B", async () => {
    const cases: Record<string, unknown>[] = [
      {},
      { name: "n", description: "d", extra: 1 },
      { name: "n", description: "d", phases: [{ title: "" }, { title: "x", bad: 1 }] },
    ];
    for (const meta of cases) {
      const a = await mount(ours);
      const b = await mount(stock);
      const fa = failureOf(() => a.engine.start(makeRequest({ meta })));
      const fb = failureOf(() => b.engine.start(makeRequest({ meta })));
      expect(fa).toEqual(fb);
      expect(fa.ok).toBe(false);
      expect(fa.code).toBe("META_INVALID");
      expect(firstLine(fa.message)).toContain("invalid meta:");
    }
    const okMeta = { name: "n", description: "d", whenToUse: "w", phases: [{ title: "p", detail: "dd", provider: "pr", model: "m" }] };
    const { a, b, resultA, resultB } = await runBoth(
      {
        run: async (spec: any, rig: Rig) => {
          rig.inits.push(await spec.bindings[0].functions.begin({}));
          return { logs: [], value: { value: null, stopReason: "completed", agentsStarted: 0 } };
        },
      },
      { meta: okMeta },
    );
    expect(resultA).toEqual(resultB);
    expect(a.inits[0].meta).toEqual(okMeta);
    expect(a.inits[0].meta).toEqual(b.inits[0].meta);
  });

  test("C3 parse/provider/cap: 5 lỗi ĐỒNG BỘ A≡B + args được structuredClone", async () => {
    const a = await mount(ours);
    const b = await mount(stock);
    const cases: Record<string, unknown>[] = [
      { script: "export const meta = { name: 'x' }" },
      { subagentProvider: "" },
      { subagentProvider: "nope" },
      { maxTotalAgents: 0 },
      { maxTotalAgents: 1001 },
    ];
    for (const extra of cases) {
      const fa = failureOf(() => a.engine.start(makeRequest(extra)));
      const fb = failureOf(() => b.engine.start(makeRequest(extra)));
      expect(fa).toEqual(fb);
      expect(fa.ok).toBe(false);
    }
    expect(failureOf(() => a.engine.start(makeRequest({ script: "export const meta = {}" })))).toEqual({
      ok: false,
      name: "WorkflowError",
      message:
        "workflow meta rides the \u0060meta\u0060 request field, not the script: remove the \u0060export const meta = {...}\u0060 statement from the body",
      code: "SCRIPT_PARSE",
    });
    expect(failureOf(() => a.engine.start(makeRequest({ maxTotalAgents: 1001 }))).code).toBe("INVALID_ARGUMENT");
    expect(firstLine(failureOf(() => a.engine.start(makeRequest({ maxTotalAgents: 1001 }))).message)).toBe(
      "workflow maxTotalAgents 1001 exceeds the engine ceiling 1000",
    );
    const args = { nested: { n: 1 }, list: [1, 2] };
    const { a: ra, b: rb, resultA, resultB } = await runBoth(
      {
        run: async (spec: any, rig: Rig) => {
          rig.inits.push(await spec.bindings[0].functions.begin({}));
          return { logs: [], value: { value: null, stopReason: "completed", agentsStarted: 0 } };
        },
      },
      { args },
    );
    args.nested.n = 99;
    expect(resultA).toEqual(resultB);
    expect(ra.inits[0].args).toEqual({ nested: { n: 1 }, list: [1, 2] });
    expect(ra.inits[0].args).toEqual(rb.inits[0].args);
  });

  test("C4 runtime LỖI: exception/timeout/worker-exit/invalid-output + runtime NÉM ⇒ stopReason error A≡B", async () => {
    const outcomes: any[] = [
      { logs: [], error: { kind: "exception", message: "script nem" } },
      { logs: [], error: { kind: "timeout", message: "het gio" } },
      { logs: [], error: { kind: "worker-exit", message: "tien trinh chet" } },
      { logs: [], value: { stopReason: "bogus" } },
    ];
    for (const outcome of outcomes) {
      const { resultA, resultB, a, b } = await runBoth({ run: async () => outcome });
      expect(resultA.stopReason).toBe("error");
      expect(resultA.stopReason).toBe(resultB.stopReason);
      expect(firstLine(resultA.error)).toBe(firstLine(resultB.error));
      expect(a.events).toEqual(b.events);
      expect(a.events.filter((line) => line.startsWith("end:")).length).toBe(1);
    }
    const timeout = await runBoth({ run: async () => ({ logs: [], error: { kind: "timeout", message: "het gio" } }) });
    expect(firstLine(timeout.resultA.error)).toBe("workflow execution failed (timeout): het gio");
    const thrown = await runBoth({
      run: async () => {
        throw new Error("runtime hong");
      },
    });
    expect(thrown.resultA.stopReason).toBe("error");
    expect(firstLine(thrown.resultA.error)).toBe("Error: runtime hong");
    expect(firstLine(thrown.resultA.error)).toBe(firstLine(thrown.resultB.error));
    expect(await thrown.runA.result).toBeDefined();
  });

  test("C5 file policy: read-only + runtime không sandboxMode ⇒ lỗi; danger-full-access ⇒ chạy; workspace-write ⇒ truyền policy", async () => {
    const denied = await runBoth({ sandboxMode: null, policyMode: "read-only" });
    expect(denied.resultA.stopReason).toBe("error");
    expect(firstLine(denied.resultA.error)).toBe("Error: workflow runtime cannot enforce the read-only file policy");
    expect(firstLine(denied.resultA.error)).toBe(firstLine(denied.resultB.error));
    expect(denied.a.specs.length).toBe(0);
    expect(denied.a.resolved.length).toBe(0);
    const full = await runBoth({ sandboxMode: null, policyMode: "danger-full-access" });
    expect(full.resultA.stopReason).toBe("completed");
    expect("sandboxPolicy" in full.a.specs[0]).toBe(false);
    expect("sandboxPolicy" in full.b.specs[0]).toBe(false);
    const write = await runBoth({ sandboxMode: "workspace-write", policyMode: "workspace-write" });
    expect(write.resultA.stopReason).toBe("completed");
    expect(write.a.specs[0].sandboxPolicy).toEqual({ mode: "workspace-write", workspaceRoot: "/work" });
  });

  test("C6 huỷ: signal đã abort TRƯỚC start · abort GIỮA chạy · dispose ⇒ cancelled A≡B", async () => {
    const pre = await mount(ours);
    const preStock = await mount(stock);
    const controller = new AbortController();
    controller.abort();
    const preA = pre.engine.start(makeRequest({ signal: controller.signal }));
    const preB = preStock.engine.start(makeRequest({ signal: controller.signal }));
    expect(await preA.result).toEqual(await preB.result);
    expect((await preA.result).stopReason).toBe("cancelled");
    await settle();
    expect((await preA.result).error).toBe("workflow run cancelled: workflow signal aborted");
    expect(pre.specs.length).toBe(0);
    expect(preStock.specs.length).toBe(0);
    expect(pre.events).toEqual(preStock.events);

    const waitAbort = async (spec: any) =>
      new Promise((_resolve, reject) => spec.signal.addEventListener("abort", () => reject(spec.signal.reason), { once: true }));
    const running = await mount(ours, { run: waitAbort });
    const runningStock = await mount(stock, { run: waitAbort });
    const live = new AbortController();
    const runA = running.engine.start(makeRequest({ signal: live.signal }));
    const runB = runningStock.engine.start(makeRequest({ signal: live.signal }));
    await settle(5);
    live.abort();
    const resultA = await runA.result;
    const resultB = await runB.result;
    expect(resultA).toEqual(resultB);
    expect(resultA.stopReason).toBe("cancelled");
    expect(resultA.error).toBe("workflow run cancelled: workflow signal aborted");
    expect(running.specs[0].signal.aborted).toBe(true);
    await settle();
    expect(running.events).toEqual([
      "start",
      "end:" + JSON.stringify({ stopReason: "cancelled", error: "workflow run cancelled: workflow signal aborted", agentsStarted: 0 }),
    ]);

    const disposed = await mount(stock, { run: waitAbort });
    const runD = disposed.engine.start(makeRequest());
    const first = runD.dispose();
    const second = runD.dispose();
    expect(first).toBe(second);
    expect((await runD.result).error).toBe("workflow run cancelled: workflow disposed");
  });

  test("C7 guest con: begin/startChild/childResult/progress/disposeChild — request con, sự kiện, dọn con sót", async () => {
    let captured: any = {};
    const { a, b, resultA, resultB } = await runBoth({
      run: async (spec: any, rig: Rig) => {
        const host = spec.bindings[0].functions;
        const init = await host.begin({});
        const started = await host.startChild({
          prompt: "lam viec",
          label: "nhan",
          phase: "khao sat",
          schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
          provider: "p",
          model: "m",
        });
        const childResult = await host.childResult({ callId: started.callId });
        await host.progress([
          { type: "phase", title: "khao sat" },
          { type: "log", message: "dang chay" },
          { type: "agent-start", info: { seq: 1, label: "nhan", childId: "child-1", phase: "khao sat" } },
          { type: "agent-end", info: { seq: 1, label: "nhan", childId: "child-1", outcome: "completed" } },
          { type: "agent-start", info: { seq: 2, label: "sot", childId: "child-2" } },
        ]);
        await host.disposeChild({ callId: started.callId });
        captured = { init, started, childResult };
        rig.inits.push(init);
        return { logs: [], value: { value: { done: true }, stopReason: "completed", agentsStarted: 1 } };
      },
    });
    expect(resultA).toEqual(resultB);
    expect(resultA).toEqual({ value: { done: true }, stopReason: "completed", agentsStarted: 1 });
    const child = a.childCalls[0];
    expect(child.provider).toBe("spawn");
    expect(child.label).toBe("demo child 1");
    expect(child.delivery).toBe("caller");
    expect(child.signal).toBeDefined();
    expect(child.request.cwd).toBe("/work/project");
    expect(child.request.prompt).toEqual([{ type: "text", text: "lam viec" }]);
    expect(child.request.parent).toEqual({ session: { id: "session-1" } });
    expect(child.request.outputSchema).toEqual({
      type: "object",
      properties: { ok: { type: "boolean" } },
      required: ["ok"],
      additionalProperties: false,
    });
    expect(child.request.agentOptions).toEqual({ provider: "p", model: "m" });
    expect(captured.started).toEqual({ callId: 1, childId: "child-1" });
    expect(captured.childResult).toEqual({ output: [{ type: "text", text: "con tra loi" }], stopReason: "completed", structured: { ok: true } });
    expect(a.disposed).toEqual(["demo child 1"]);
    expect(a.disposed).toEqual(b.disposed);
    expect(a.events).toEqual(b.events);
    expect(a.events).toEqual([
      "start",
      "phase:khao sat",
      "log:dang chay",
      "workflow/agent-start:" + JSON.stringify({ seq: 1, label: "nhan", childId: "child-1", phase: "khao sat" }),
      "workflow/agent-end:" + JSON.stringify({ seq: 1, label: "nhan", childId: "child-1", outcome: "completed" }),
      "workflow/agent-start:" + JSON.stringify({ seq: 2, label: "sot", childId: "child-2" }),
      "workflow/agent-end:" + JSON.stringify({ seq: 2, label: "sot", childId: "child-2", outcome: "cancelled" }),
      "end:" + JSON.stringify({ stopReason: "completed", agentsStarted: 1 }),
    ]);
  });

  test("C8 bindings TỪ CHỐI đầu vào xấu: progress/startChild/childResult/disposeChild — cùng thông điệp A≡B", async () => {
    const collect = async (api: Api) => {
      const rig = await mount(api, {
        run: async (spec: any) => {
          const host = spec.bindings[0].functions;
          const out: Record<string, string> = {};
          out.progressEvent = await callBinding(host, "progress", [{ type: "nope" }]);
          out.progressString = await callBinding(host, "progress", "x");
          out.progressObject = await callBinding(host, "progress", {});
          out.promptNumber = await callBinding(host, "startChild", { prompt: 1 });
          out.promptMissing = await callBinding(host, "startChild", {});
          out.callIdString = await callBinding(host, "childResult", { callId: "x" });
          out.callIdMissing = await callBinding(host, "childResult", {});
          out.unknownChild = await callBinding(host, "disposeChild", { callId: 99 });
          out.disposeMissing = await callBinding(host, "disposeChild", {});
          out.schemaBad = await callBinding(host, "startChild", { prompt: "p", schema: { type: "string" } });
          return { logs: [], value: { value: out, stopReason: "completed", agentsStarted: 0 } };
        },
      });
      const run = rig.engine.start(makeRequest());
      return (await run.result).value;
    };
    const mine = await collect(ours);
    const theirs = await collect(stock);
    expect(mine).toEqual(theirs);
    expect(mine).toEqual({
      progressEvent: "err:invalid workflow progress event",
      progressString: "err:workflow progress requires an array of events",
      progressObject: "err:workflow progress requires an array of events",
      promptNumber: "err:workflow prompt must be a string",
      promptMissing: "err:workflow prompt must be a string",
      callIdString: "err:workflow child call id must be an integer",
      callIdMissing: "err:workflow child call id must be an integer",
      unknownChild: "err:workflow child call is not active",
      disposeMissing: "err:workflow child call id must be an integer",
      schemaBad: 'err:unsupported JSON schema: schema.type must be "object" (structured output is object-rooted)',
    });
  });

  test("C9 con LỖI: startActivation ném · con chạy sau khi huỷ · childResult reject — A≡B", async () => {
    const fail = async (api: Api) => {
      const rig = await mount(api, {
        startActivation: async () => {
          throw new Error("spawn hong");
        },
        run: async (spec: any) => {
          const host = spec.bindings[0].functions;
          return {
            logs: [],
            value: { value: { out: { start: await callBinding(host, "startChild", { prompt: "p" }) } }, stopReason: "completed", agentsStarted: 0 },
          };
        },
      });
      const result = await rig.engine.start(makeRequest()).result;
      return result.value.out;
    };
    expect(await fail(ours)).toEqual(await fail(stock));
    expect(await fail(ours)).toEqual({ start: "err:spawn hong" });

    const reject = async (api: Api) => {
      const rig = await mount(api, {
        startActivation: async () => ({ childId: "c", result: Promise.reject(new Error("con hong")), dispose: async () => undefined }),
        run: async (spec: any) => {
          const host = spec.bindings[0].functions;
          const started = await host.startChild({ prompt: "p" });
          return {
            logs: [],
            value: {
              value: { out: { result: await callBinding(host, "childResult", { callId: started.callId }) } },
              stopReason: "completed",
              agentsStarted: 1,
            },
          };
        },
      });
      const result = await rig.engine.start(makeRequest()).result;
      return result.value.out;
    };
    expect(await reject(ours)).toEqual(await reject(stock));
    expect(await reject(ours)).toEqual({ result: "err:con hong" });

    const cancelDuringStart = async (api: Api) => {
      let captured: any;
      const rig = await mount(api, {
        startActivation: async () => {
          await settle(40);
          return { childId: "c", result: Promise.resolve({ output: [], stopReason: "completed" }), dispose: async () => undefined };
        },
        run: async (spec: any) => {
          const pending = callBinding(spec.bindings[0].functions, "startChild", { prompt: "p" });
          await settle(5);
          (rig as any).engineRun.cancel("huy giua chung");
          captured = { start: await pending };
          return { logs: [], value: { value: { out: captured }, stopReason: "completed", agentsStarted: 0 } };
        },
      });
      const run = rig.engine.start(makeRequest());
      (rig as any).engineRun = run;
      const result = await run.result;
      return { result, out: captured };
    };
    const cancelA = await cancelDuringStart(ours);
    const cancelB = await cancelDuringStart(stock);
    expect(cancelA.out).toEqual(cancelB.out);
    expect(cancelA.out).toEqual({ start: "err:workflow child started after cancellation" });
    expect(cancelA.result.stopReason).toBe("cancelled");
    expect(cancelA.result.error).toBe("workflow run cancelled: huy giua chung");
    expect(cancelA.result.agentsStarted).toBe(1);
  });

  test("C10 config → limits: 4 số đi vào begin(); trần request bị chặn theo config; auto-concurrency A≡B", async () => {
    const options: RigOptions = {
      config: { maxConcurrentAgents: 2, maxTotalAgents: 7, maxItemsPerCall: 5, syncTimeoutMs: 77 },
      run: async (spec: any, rig: Rig) => {
        rig.inits.push(await spec.bindings[0].functions.begin({}));
        return { logs: [], value: { value: null, stopReason: "completed", agentsStarted: 0 } };
      },
    };
    const { a, b, resultA, resultB } = await runBoth(options);
    expect(resultA).toEqual(resultB);
    expect(a.inits[0].limits).toEqual({ maxConcurrentAgents: 2, maxTotalAgents: 7, maxItemsPerCall: 5, syncTimeoutMs: 77 });
    expect(a.inits[0].limits).toEqual(b.inits[0].limits);
    expect(failureOf(() => a.engine.start(makeRequest({ maxTotalAgents: 8 })))).toEqual(
      failureOf(() => b.engine.start(makeRequest({ maxTotalAgents: 8 }))),
    );
    const auto = await runBoth({
      run: async (spec: any, rig: Rig) => {
        rig.inits.push(await spec.bindings[0].functions.begin({}));
        return { logs: [], value: { value: null, stopReason: "completed", agentsStarted: 0 } };
      },
    });
    const limit = auto.a.inits[0].limits.maxConcurrentAgents;
    expect(limit).toBe(auto.b.inits[0].limits.maxConcurrentAgents);
    expect(limit).toBeGreaterThanOrEqual(1);
    expect(limit).toBeLessThanOrEqual(16);
  });
});

describe("D · validateMeta + materializeFromRealm (A/B)", () => {
  test("D1 validateMeta: chuẩn hoá meta hợp lệ + 3 lỗi META_INVALID y bản gốc", () => {
    const good = { name: "n", description: "d", whenToUse: "w", phases: [{ title: "p", detail: "dd", provider: "pr", model: "m" }] };
    expect(plain(ours.validateMeta(good))).toEqual(plain(stock.validateMeta(good)));
    expect(plain(ours.validateMeta(good))).toEqual(good);
    for (const bad of [{}, { name: "", description: "d" }, { name: "n", description: "d", phases: [{ title: "" }, { title: "x", bad: 1 }] }]) {
      expect(failureOf(() => ours.validateMeta(bad))).toEqual(failureOf(() => stock.validateMeta(bad)));
    }
    expect(failureOf(() => ours.validateMeta({}))).toEqual({
      ok: false,
      name: "WorkflowError",
      message: "invalid meta: meta.name must be a non-empty string; meta.description must be a non-empty string",
      code: "META_INVALID",
    });
  });

  test("D2 materializeFromRealm: JSON hợp lệ + 8 giá trị bị từ chối, cùng thông điệp A≡B", () => {
    const cyc: any = {};
    cyc.self = cyc;
    const valid = { a: [1, "b", null], o: { x: true } };
    expect(plain(ours.materializeFromRealm(valid))).toEqual(plain(stock.materializeFromRealm(valid)));
    expect(ours.materializeFromRealm(undefined)).toBeUndefined();
    expect(stock.materializeFromRealm(undefined)).toBeUndefined();
    const cases: unknown[] = [
      { a: 1n },
      [1, , 3],
      { d: new Date() },
      cyc,
      { f: () => 1 },
      { n: Number.NaN },
      { s: Symbol("s") },
      { get boom(): never { throw new Error("no"); } },
    ];
    for (const value of cases) {
      const mine = failureOf(() => ours.materializeFromRealm(value));
      const theirs = failureOf(() => stock.materializeFromRealm(value));
      expect(mine.ok).toBe(false);
      expect(mine.name).toBe(theirs.name);
      expect(firstLine(mine.message)).toBe(firstLine(theirs.message));
    }
    expect(failureOf(() => ours.materializeFromRealm({ a: 1n }))).toEqual({
      ok: false,
      name: "MaterializeError",
      message: "value.a: bigints are not JSON data",
      code: undefined,
    });
    expect(firstLine(failureOf(() => ours.materializeFromRealm(cyc)).message)).toBe("value.self: circular references are not JSON data");
    expect(typeof ours.MaterializeError).toBe("function");
    expect(ours.MaterializeError.name).toBe(stock.MaterializeError.name);
  });
});

describe("E · metadata gói + locale", () => {
  test("E1 package.json: exports/nested/peers/tests đúng đặc tả, KHÔNG gbh.row, peer+deps CHÉP stock", () => {
    const json = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as any;
    const stockJson = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as any;
    expect(PACKAGE_NAME).toBe("@galaxy-blackhole/gbh-workflow-ptc");
    expect(STOCK_PACKAGE_NAME).toBe("@deepseek-ai/dsh-workflow-ptc");
    expect(json.name).toBe(PACKAGE_NAME);
    expect(json.private).toBe(true);
    expect(json.type).toBe("module");
    expect(json.main).toBe("lib/index.js");
    // 05/11/2026 (P1b): exports["."] theo DUNG hinh dang stock { types, default } de goi TS dung duoc.
    expect(json.exports["."]).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" });
    expect(json.exports["./locale/*.json"]).toBe("./locale/*.json");
    expect(json.exports["./package.json"]).toBe("./package.json");
    expect("./src/*" in json.exports).toBe(false);
    expect(sameAfterIdMap(json.peerDependencies, stockJson.peerDependencies)).toBe(true); expect(sameAfterIdMap(json.dependencies, stockJson.dependencies)).toBe(true);
    expect(json.gbh.peers).toEqual([...Object.keys(json.peerDependencies), ...Object.keys(json.dependencies)]);
    expect(json.gbh.tests).toEqual(["tests/host/workflow-ptc.test.ts"]);
    const allowed = ["draft", "nested", "peers", "provenance", "row", "row_unmounted_ly_do", "tests"];
    expect(Object.keys(json.gbh).filter((key) => !allowed.includes(key))).toEqual([]);
    expect(json.gbh.row !== undefined && json.gbh.row_unmounted_ly_do !== undefined).toBe(false);
    expect(json.gbh.nested).toEqual({
      kind: "group",
      pluginId: "optional-ralph-workflow",
      stockId: "@deepseek-ai/dsh-workflow-ptc",
      presets: ["optional-ralph"],
    });
    expect(readFileSync(join(PKG, "package.json"), "utf8").includes("@galaxy-stack/")).toBe(false);
  });

  test("E2 locale BYTE-FOR-BYTE toàn thư mục + require.resolve mọi peer/dep qua symlink", () => {
    const walk = (dir: string, prefix = ""): string[] => {
      const out: string[] = [];
      for (const name of readdirSync(dir).sort()) {
        const abs = join(dir, name);
        const rel = prefix === "" ? name : prefix + "/" + name;
        if (statSync(abs).isDirectory()) out.push(...walk(abs, rel));
        else out.push(rel);
      }
      return out;
    };
    const stockLocale = join(STOCK_DIR, "locale");
    const ourLocale = join(PKG, "locale");
    const stockFiles = walk(stockLocale);
    expect(stockFiles.length).toBeGreaterThan(0);
    const ourFiles = walk(ourLocale);
    expect(ourFiles.filter((file) => file !== "vi.json")).toEqual(stockFiles);
    expect(ourFiles).toContain("vi.json");
    for (const file of stockFiles) {
      expect(readFileSync(join(ourLocale, file)).equals(readFileSync(join(stockLocale, file)))).toBe(true);
    }
    const json = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as any;
    const require = createRequire(join(PKG, "package.json"));
    for (const name of json.gbh.peers as string[]) {
      expect(existsSync(join(PKG, "node_modules", name, "package.json"))).toBe(true);
      expect(() => require.resolve(name)).not.toThrow();
    }
    // 05/11/2026 (P1b): goi PHAT THEM .d.ts (khong co .js trong types) de goi TS dung duoc.
    const typesDir = join(PKG, "lib", "types");
    expect(existsSync(typesDir) ? readdirSync(typesDir).filter((f) => f.endsWith(".js")) : []).toEqual([]);
    expect(existsSync(join(PKG, "lib", OUT_FILE_NAME))).toBe(true);
  });

  test("E3 manifest hằng số + assemble khớp stock + stripSliceScaffold từ chối lát thiếu giao kèo", () => {
    expect(PACKAGE_NAME).toBe("@galaxy-blackhole/gbh-workflow-ptc");
    expect(STOCK_PACKAGE_NAME).toBe("@deepseek-ai/dsh-workflow-ptc");
    expect(STOCK_BUNDLE).toBe("apps/host/node_modules/@deepseek-ai/dsh-workflow-ptc/lib/index.js");
    expect(SLICE_MARKER).toBe("// @ts-nocheck");
    expect(MODULE_TAIL).toBe("export {};");
    expect(PART_FILES).toEqual(["part-00.ts"]);
    expect(OUT_FILE_NAME).toBe("index.js");
    expect(assembleBundle()).toBe(STOCK_TEXT);
    expect(assembleBundle().endsWith(String.fromCharCode(10))).toBe(true);
    const good = "/**\n * desc x\n */\n// @ts-nocheck\n\nA\n\nB\n\nexport {};\n";
    expect(stripSliceScaffold(good, "good.ts")).toEqual(["A", "", "B"]);
    expect(() => stripSliceScaffold("// @ts-nocheck\n\nA\n\nexport {};\n", "no-header.ts")).toThrow("thieu khoi header 5 dong bat buoc");
    expect(() =>
      stripSliceScaffold("/**\n * desc x\n */\n/* @ts-nocheck */\n\nA\n\nexport {};\n", "no-marker.ts"),
    ).toThrow("khong thay dong danh dau lat nguyen van");
    expect(() => stripSliceScaffold("/**\n * desc x\n */\n// @ts-nocheck\n\nA\n", "no-tail.ts")).toThrow("thieu dong ket thuc module");
    expect(() =>
      stripSliceScaffold("/**\n * desc x\n */\n// @ts-nocheck\n\nA\nexport {};\n", "no-blank.ts"),
    ).toThrow("thieu dong trong truoc dong ket thuc");
  });
});

describe("F · cơ chế nested group hai nơi (patch optional-ralph + registry preset)", () => {
  test("F1 renderGroupRewriteBlocks: ĐÚNG 1 khối cho optional-ralph, đổi tên workflow-ptc, GIỮ isolate + tool-ralph", () => {
    const patch = readFileSync(RALPH_PATCH, "utf8");
    const result = renderGroupRewriteBlocks(patch, [{ kind: "group", stockId: STOCK_PACKAGE_NAME, specifier: PACKAGE_NAME }]);
    expect(result.warnings).toEqual([]);
    expect(result.blocks.length).toBe(1);
    const block = result.blocks[0] ?? "";
    expect(block.split(String.fromCharCode(10)).filter((line) => line.trim() === "- id: optional-ralph").length).toBe(1);
    expect(block).toContain("- id: optional-ralph\n  disabled: true");
    expect(block).toContain("- id: optional-ralph-ours");
    expect(block).toContain("name: cordis:group");
    expect(block).toContain("group: true");
    expect(block).toContain("isolate:\n        workflowEngine: true");
    expect(block).toContain("name: '@galaxy-blackhole/gbh-workflow-ptc'");
    expect(block).not.toContain("name: '@deepseek-ai/dsh-workflow-ptc'");
    expect(block).toContain("id: optional-ralph-workflow");
    expect(block).toContain("name: '@deepseek-ai/dsh-tool-ralph'");
    expect(block).toContain("maxRounds: 64");
    expect(block).toContain("provider: spawn");
    expect(block.trimEnd().endsWith("maxRounds: 64")).toBe(true);
  });

  test("F2 readNestedRedirects + rewriteNestedNames: preset delegation đổi tên workflow-ptc, giữ group/isolate, idempotent", () => {
    const root = mkdtempSync(join(tmpdir(), "gbh-wfptc-profile-"));
    try {
      const dir = join(root, "@galaxy-blackhole", "gbh-workflow-ptc");
      mkdirSync(join(dir, "lib"), { recursive: true });
      copyFileSync(join(PKG, "package.json"), join(dir, "package.json"));
      writeFileSync(join(dir, "lib", "index.js"), "export {};\n");
      const read = readNestedRedirects(root);
      expect(read.warnings).toEqual([]);
      expect([...read.map]).toEqual([[STOCK_PACKAGE_NAME, PACKAGE_NAME]]);
      const plugins = [
        { id: "persona", name: "@deepseek-ai/dsh-persona" },
        {
          id: "delegation",
          name: "cordis:group",
          group: true,
          isolate: { workflowEngine: true },
          config: [
            { id: "tool-subagent", name: "@deepseek-ai/dsh-tool-subagent", config: { provider: "spawn" } },
            { id: "workflow-ptc", name: "@deepseek-ai/dsh-workflow-ptc", config: { provider: "spawn" } },
            { id: "tool-workflow", name: "@deepseek-ai/dsh-tool-workflow" },
          ],
        },
      ];
      const out = rewriteNestedNames(plugins, read.map, "preset-standard") as any[];
      expect(out).toEqual([
        { id: "persona", name: "@deepseek-ai/dsh-persona" },
        {
          id: "delegation",
          name: "cordis:group",
          group: true,
          isolate: { workflowEngine: true },
          config: [
            { id: "tool-subagent", name: "@deepseek-ai/dsh-tool-subagent", config: { provider: "spawn" } },
            { id: "workflow-ptc", name: PACKAGE_NAME, config: { provider: "spawn" } },
            { id: "tool-workflow", name: "@deepseek-ai/dsh-tool-workflow" },
          ],
        },
      ]);
      const twice = rewriteNestedNames(out, read.map, "preset-standard");
      expect(JSON.stringify(twice)).toBe(JSON.stringify(out));
      expect(JSON.stringify(out).includes("@galaxy-blackhole/@galaxy-blackhole")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
