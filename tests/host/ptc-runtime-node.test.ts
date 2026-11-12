/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B chính thức cho @galaxy-blackhole/gbh-ptc-runtime-node: module THUẦN so trực tiếp với vùng
 *      bundle gốc trích ra /tmp; index + 2 entry con chạy bằng NODE THẬT (bun thiếu node:module) và so A≡B.
 */

import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PassThrough, Readable } from "node:stream";
import type { Duplex } from "node:stream";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import { buildPackage } from "../../packages/host/ptc-runtime-node/build.ts";
import { replyToBinding, validateBindings } from "../../packages/host/ptc-runtime-node/src/bindings.ts";
import { JsonChannel } from "../../packages/host/ptc-runtime-node/src/channel.ts";
import { NodeConfig, validateConfig } from "../../packages/host/ptc-runtime-node/src/config.ts";
import { clearProgramEnvironment, STARTUP_ENVIRONMENT_NAMES } from "../../packages/host/ptc-runtime-node/src/environment.ts";
import { decodePtcJsonWire, encodePtcJsonWire, snapshotPtcJsonValue } from "../../packages/host/ptc-runtime-node/src/json-wire.ts";
import { bootstrapArgs, resolveLaunch } from "../../packages/host/ptc-runtime-node/src/launch.ts";
import { OutputLedger } from "../../packages/host/ptc-runtime-node/src/output-ledger.ts";
import { jsonStringBytesUpTo, jsonValueBytesUpTo, truncateJsonStringBytes } from "../../packages/host/ptc-runtime-node/src/output-json.ts";
import { drainOutput, terminateProcess } from "../../packages/host/ptc-runtime-node/src/output-stream.ts";
import { PolicyProcesses } from "../../packages/host/ptc-runtime-node/src/policy-processes.ts";
/** Gốc repo — mọi đường dẫn dưới đây suy ra từ đây, không phụ thuộc cwd. */
const REPO = join(import.meta.dir, "..", "..");
/** Bundle gốc (CHỈ ĐỌC) + ba entry của nó. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-ptc-runtime-node", "lib");
const STOCK_INDEX = join(STOCK_DIR, "index.js");
const STOCK_PROCESS = join(STOCK_DIR, "process.js");
const STOCK_PERSISTENT = join(STOCK_DIR, "persistent-process.js");
/** Thư mục build artefact THẬT của ta + vùng trích bundle + harness node. */
const OUT = "/tmp/gbh-ptc-ab";
const OURS_INDEX = join(OUT, "index.js");
const OURS_PROCESS = join(OUT, "process.js");
const OURS_PERSISTENT = join(OUT, "persistent-process.js");
/** Gói peer thật trong cây cài kernel — dùng cho vùng trích bundle gốc. */
const PEERS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** Ứng viên Node ≥ 22.13 (có stripTypeScriptTypes) — ưu tiên đúng bản đã đo. */
const NODE_CANDIDATES = [
  "/Users/buitronghieu/.nvm/versions/node/v26.9.0/bin/node",
  "/Users/buitronghieu/.nvm/versions/node/v24.4.1/bin/node",
  "/usr/local/bin/node",
];
/** Chọn Node thật đầu tiên tồn tại. Nhận: không. Trả: đường dẫn tuyệt đối tới node; ném lỗi khi máy không có bản nào. */
function findNode(): string {
  for (const candidate of NODE_CANDIDATES) if (existsSync(candidate)) return candidate;
  throw new Error("không tìm thấy node >= 22.13 để chạy A/B");
}
/** Node thật dùng cho mọi ca cần node:module. */
const NODE = findNode();
/** Bề mặt một phía harness node: keys · config · name · inject · scenarios. */
type HarnessSide = {
  keys: string[];
  config: string;
  name: string;
  inject: string[];
  scenarios: { name: string; ok: boolean; value?: unknown; error?: string }[];
};
/** Kết quả harness node của cả hai phía. */
let harness: { a: HarnessSide; b: HarnessSide };
/** Vùng bundle gốc đã trích, nạp như ESM thật trong bun. */
const stock: Record<string, any> = {};
/** Peer util-values (nguồn snapshotJsonValue mà bundle gốc dùng). */
let stockUtil: any;
/** Kết quả chạy hai entry con khi THIẾU marker fd 7. */
const childRuns: Record<string, { status: number | null; stderr: string }> = {};
/** Chạy một tệp bằng node thật, không truyền fd 7. Nhận: path — tệp .js cần chạy. Trả: mã thoát + stderr đã giải mã. */
function runChild(path: string): { status: number | null; stderr: string } {
  const run = Bun.spawnSync([NODE, path], { timeout: 120_000 });
  return { status: run.exitCode, stderr: run.stderr.toString() };
}
/** Chạy một hàm đồng bộ và bắt câu lỗi. Nhận: run — hàm cần chạy. Trả: câu lỗi, hoặc KHONG-NEM khi không ném. */
function captureError(run: () => unknown): string {
  try {
    run();
    return "KHONG-NEM";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
/** Chạy một promise và bắt câu lỗi. Nhận: run — promise cần await. Trả: câu lỗi, hoặc KHONG-NEM khi resolve. */
async function captureRejection(run: Promise<unknown>): Promise<string> {
  try {
    await run;
    return "KHONG-NEM";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
/** Chờ một điều kiện thành true (poll 5ms). Nhận: check — điều kiện; timeoutMs — hạn chờ. Trả: Promise hoàn tất khi điều kiện đúng; ném lỗi khi quá hạn. */
async function waitFor(check: () => boolean, timeoutMs = 2_000): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error("quá hạn chờ điều kiện");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
/** Ghép khung 4-byte độ dài + JSON như kênh điều khiển. Nhận: value — giá trị JSON. Trả: Buffer của một frame hoàn chỉnh. */
function encodeFrame(value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32BE(body.length);
  return Buffer.concat([header, body]);
}
/** Bề mặt tối thiểu của lớp JsonChannel dùng trong A/B. */
type ChannelCtor = new (
  stream: Duplex,
  maxBytes: number,
  receive: (message: unknown, bytes: number) => void,
  failure: (error: Error, kind: "io" | "protocol") => void,
) => { send(message: unknown): Promise<void>; close(): void; drain(): Promise<void> };
/** Dựng hai kênh nối nhau bằng PassThrough để đo cả hai chiều. Nhận: Impl — lớp JsonChannel (A hoặc B); maxBytes — trần frame. Trả: cặp kênh + mảng quan sát. */
function channelPair(Impl: ChannelCtor, maxBytes: number) {
  const left = new PassThrough();
  const right = new PassThrough();
  left.pipe(right);
  const rightSeen: unknown[] = [];
  const failures: { type: string; message: string }[] = [];
  const onFailure = (error: Error, type: "io" | "protocol") => failures.push({ type, message: error.message });
  const chA = new Impl(left, maxBytes, () => {}, onFailure);
  const chB = new Impl(right, maxBytes, (message) => rightSeen.push(message), onFailure);
  return { left, chA, chB, rightSeen };
}
/** Chạy một kịch bản kênh và trả quan sát (cùng kịch bản cho A và B). Nhận: Impl — lớp JsonChannel; kind — tên kịch bản. Trả: đối tượng quan sát (any) so sánh được bằng toEqual. */
async function channelObserve(Impl: ChannelCtor, kind: string): Promise<any> {
  const header = (length: number): Buffer => {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32BE(length);
    return bytes;
  };
  if (kind === "empty-header" || kind === "oversize-header" || kind === "invalid-utf8") {
    const stream = new PassThrough();
    const failures: { type: string; message: string }[] = [];
    new Impl(stream, 64, () => {}, (error, type) => failures.push({ type, message: error.message }));
    if (kind === "empty-header") stream.write(header(0));
    if (kind === "oversize-header") stream.write(header(4_096));
    if (kind === "invalid-utf8") stream.write(Buffer.concat([header(2), Buffer.from([0xff, 0xfe])]));
    await waitFor(() => failures.length === 1);
    stream.destroy();
    return { failures };
  }
  const pair = channelPair(Impl, kind === "over-cap" ? 16 : 64);
  const out: Record<string, unknown> = {};
  if (kind === "roundtrip") {
    await pair.chA.send({ hello: "world", n: 1 });
    await pair.chA.send([1, 2, null]);
    await waitFor(() => pair.rightSeen.length === 2);
    out.rightSeen = pair.rightSeen;
  } else if (kind === "fragmented") {
    for (const byte of encodeFrame({ a: [1, "x"] })) pair.left.write(Buffer.from([byte]));
    await waitFor(() => pair.rightSeen.length === 1);
    out.rightSeen = pair.rightSeen;
  } else if (kind === "over-cap") {
    out.rejection = await captureRejection(pair.chA.send("x".repeat(100)));
  } else if (kind === "close") {
    const pending = captureRejection(pair.chA.send({ a: 1 }));
    pair.chA.close();
    out.pending = await pending;
    out.afterClose = await captureRejection(pair.chA.send({ b: 2 }));
    out.drain = await captureRejection(pair.chA.drain());
  }
  pair.chA.close();
  pair.chB.close();
  return out;
}
/** Chạy một kịch bản drainOutput. Nhận: run — hàm drainOutput (A hoặc B); kind — tên kịch bản. Trả: kết quả boolean của drainOutput. */
async function drainObserve(run: (stream: any, graceMs: number) => Promise<boolean>, kind: string): Promise<boolean> {
  if (kind === "undefined") return run(undefined, 20);
  if (kind === "ended") {
    const stream = new PassThrough();
    stream.end();
    stream.resume();
    await new Promise((resolve) => stream.once("end", resolve));
    return run(stream, 20);
  }
  if (kind === "destroyed") {
    const stream = new PassThrough();
    stream.destroy();
    return run(stream, 20);
  }
  const stream = new Readable({ read() {} });
  if (kind === "error") {
    const pending = run(stream, 50);
    stream.emit("error", new Error("boom"));
    return pending;
  }
  if (kind === "close") {
    const pending = run(stream, 50);
    stream.emit("close");
    return pending;
  }
  return run(stream, 10);
}
/** Chạy một kịch bản terminateProcess. Nhận: run — hàm terminateProcess (A hoặc B); kind — clean · done-rejects · drain-fails. Trả: quan sát { drained, terminated, destroyed }. */
async function terminateObserve(run: (handle: any, graceMs: number) => Promise<boolean>, kind: string) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  if (kind !== "drain-fails") {
    stdout.end();
    stderr.end();
  }
  let terminated = 0;
  const handle = {
    stdout,
    stderr,
    done: kind === "done-rejects" ? Promise.reject(new Error("spawn failed")) : Promise.resolve({ code: 0 }),
    terminate: () => {
      terminated += 1;
    },
    waitForExit: async () => true,
  };
  const drained = await run(handle, 20);
  const observed = { drained, terminated, destroyed: stdout.destroyed && stderr.destroyed };
  if (kind === "drain-fails") {
    stdout.destroy();
    stderr.destroy();
  }
  return observed;
}
/** Bề mặt tối thiểu của lớp PolicyProcesses dùng trong A/B. */
type PolicyCtor = new (ctx: any) => {
  register(policy: any, release: () => Promise<void>): () => void;
  wait(sessionId?: string): Promise<void>;
};
/** Dựng context giả ghi lại wiring của PolicyProcesses. Nhận: sessions — bảng phiên; modes — chế độ theo phiên. Trả: context + events + warns + emit + dispose. */
function policyCtx(sessions: Map<string, { id: string }>, modes: Map<string, string>) {
  const events: string[] = [];
  const disposers: Array<() => Promise<void>> = [];
  const warns: string[] = [];
  let listener: ((session: { id: string }, event: any) => void) | undefined;
  const ctx = {
    on(event: string, handler: (session: { id: string }, event: any) => void, options?: { global?: boolean }) {
      events.push("on:" + event + ":" + String(options?.global));
      listener = handler;
      return () => {};
    },
    effect(effect: () => () => Promise<void>, label: string) {
      events.push("effect:" + label);
      disposers.push(effect());
      return () => {};
    },
    get(name: string) {
      return name === "sessions" ? { get: (id: string) => sessions.get(id) } : undefined;
    },
    sandboxPolicy: { resolve: (request?: { session?: { id: string } }) => ({ mode: modes.get(request?.session?.id ?? "") ?? "read-only", workspaceRoot: "/tmp" }) },
    logger: { warn: (error: unknown) => warns.push(error instanceof Error ? error.message : String(error)) },
  };
  return {
    ctx,
    events,
    warns,
    emit: (session: { id: string }, event: any) => listener?.(session, event),
    dispose: async () => {
      for (const disposer of disposers.reverse()) await disposer();
    },
  };
}
/** Chạy một kịch bản PolicyProcesses. Nhận: Impl — lớp PolicyProcesses; kind — mode-change · same-mode · other-session · no-session · unregister · dispose · reject. Trả: quan sát { events, releases, warns, waitError }. */
async function policyObserve(Impl: PolicyCtor, kind: string) {
  const sessions = new Map([["s1", { id: "s1" }], ["s2", { id: "s2" }]]);
  const modes = new Map([["s1", "read-only"], ["s2", "read-only"]]);
  const host = policyCtx(sessions, modes);
  const instance = new Impl(host.ctx);
  let releases = 0;
  let waitError: string | undefined;
  const release = async (): Promise<void> => {
    releases += 1;
    if (kind === "reject") throw new Error("boom");
  };
  const policy = { mode: "read-only", workspaceRoot: "/tmp", sessionId: "s1" };
  if (kind === "no-session") {
    instance.register({ mode: "read-only", workspaceRoot: "/tmp" }, release)();
    await instance.wait(undefined);
  } else if (kind === "dispose") {
    instance.register(policy, release);
    instance.register({ ...policy, sessionId: "s2" }, release);
    await host.dispose();
  } else {
    const off = instance.register(policy, release);
    if (kind === "unregister") off();
    host.emit(kind === "other-session" ? { id: "s2" } : { id: "s1" }, { type: "sandbox/mode", data: { mode: kind === "same-mode" ? "read-only" : "workspace-write" } });
    try {
      await instance.wait("s1");
    } catch (error) {
      waitError = error instanceof Error ? error.message : String(error);
    }
    if (kind === "mode-change") host.emit({ id: "s1" }, { type: "sandbox/mode", data: { mode: "danger-full-access" } });
  }
  return { events: host.events, releases, warns: host.warns, waitError };
}
/** Chạy một bộ kịch bản OutputLedger. Nhận: Impl — lớp OutputLedger (A hoặc B). Trả: quan sát so sánh được bằng toEqual. */
function ledgerObserve(Impl: any) {
  const sink: string[] = [];
  const ledger = new Impl(40);
  const admitted = [ledger.admit("abc", sink), ledger.admit("x".repeat(50), sink), ledger.admit("def", sink)];
  return {
    admitted,
    sink,
    success: new Impl(20).success(["ab"], { ok: true }),
    successOverflow: new Impl(10).success(["ab"], { big: "x".repeat(50) }),
    failure: new Impl(30).failure(["ab"], { kind: "exception", message: "boom" }),
    failureOverflow: new Impl(8).failure([], { kind: "exception", message: "x".repeat(50) }),
    limit: new Impl(24).limit(["a".repeat(40), "tail"]),
    limitCustom: new Impl(24, "custom overflow").limit(["line"]),
  };
}
/** Chạy clearProgramEnvironment và quan sát môi trường còn lại. Nhận: clear — hàm clearProgramEnvironment (A hoặc B). Trả: { remaining, fresh, protoNull, sameObject }. */
function clearObserve(clear: (state: { env: any }) => void) {
  const env: Record<string, string> = { PATH: "/bin", path: "/lower", HOME: "/root", TEMP: "/tmp", TMP: "/t", PATHEXT: ".EXE", SYSTEMROOT: "C:", WINDIR: "W", FOO: "bar" };
  const state = { env: env as any };
  clear(state);
  return { remaining: Object.keys(env), fresh: Object.keys(state.env), protoNull: Object.getPrototypeOf(state.env) === null, sameObject: state.env === env };
}
/** Đường dẫn tuyệt đối của một module peer (chuỗi JSON an toàn cho import). Nhận: name — tên gói; file — tệp entry trong lib/. Trả: chuỗi đã quote. */
function peerModule(name: string, file: string): string {
  return JSON.stringify(join(PEERS, name, "lib", file));
}
/** Trích một vùng #region của bundle gốc. Nhận: lines — các dòng bundle; name — tên vùng (lib/types/<name>.js). Trả: thân vùng (không gồm dấu region). */
function region(lines: string[], name: string): string {
  const start = lines.findIndex((line) => line.trim() === "//#region lib/types/" + name + ".js");
  const end = lines.findIndex((line, index) => index > start && line.trim() === "//#endregion");
  if (start < 0 || end < 0) throw new Error("thiếu vùng bundle: " + name);
  return lines.slice(start + 1, end).join("\n");
}
/** Sinh các module THUẦN từ vùng bundle gốc ra /tmp/gbh-ptc-ab/stock. Nhận: không (chỉ đọc bundle gốc). Trả: không (ghi tệp). */
function generateStockModules(): void {
  const indexLines = readFileSync(STOCK_INDEX, "utf8").split("\n");
  const processLines = readFileSync(STOCK_PROCESS, "utf8").split("\n");
  const dir = join(OUT, "stock");
  mkdirSync(dir, { recursive: true });
  const util = peerModule("dsh-util-values", "index.js");
  const ptc = peerModule("dsh-ptc-runtime", "index.js");
  const timeout = peerModule("dsh-timeout", "index.js");
  const schema = peerModule("schemastery", "index.mjs");
  const files: Record<string, string> = {
    "stock-json-wire.mjs": region(indexLines, "json-wire") + "\nexport { encodePtcJsonWire, decodePtcJsonWire };\n",
    "stock-bindings.mjs": "import { snapshotJsonValue } from " + util + ";\n"
      + "import { DUNDER_MEMBER, PORTABLE_RESERVED_WORDS, RESERVED_BINDING_GLOBALS, RESERVED_ERROR_MEMBERS } from " + ptc + ";\n"
      + "import { encodePtcJsonWire } from \"./stock-json-wire.mjs\";\n"
      + region(indexLines, "bindings") + "\nexport { validateBindings, replyToBinding };\n",
    "stock-output-json.mjs": region(indexLines, "output-json") + "\nexport { jsonStringBytesUpTo, jsonValueBytesUpTo, truncateJsonStringBytes };\n",
    "stock-channel.mjs": "import { Buffer as Buffer$1 } from \"node:buffer\";\n"
      + "import { jsonValueBytesUpTo } from \"./stock-output-json.mjs\";\n"
      + region(indexLines, "channel") + "\nexport { JsonChannel };\n",
    "stock-launch.mjs": "import { dirname, isAbsolute, resolve } from \"node:path\";\n"
      + "import { fileURLToPath, pathToFileURL } from \"node:url\";\n"
      + "import { assertNever } from " + util + ";\n" + region(indexLines, "launch") + "\nexport { resolveLaunch, bootstrapArgs };\n",
    "stock-config.mjs": "import z from " + schema + ";\n" + "import { MAX_TIMER_DELAY_MS } from " + timeout + ";\n"
      + region(indexLines, "config") + "\nexport { NodeConfig, validateConfig };\n",
    "stock-policy-processes.mjs": region(indexLines, "policy-processes") + "\nexport { PolicyProcesses };\n",
    "stock-environment.mjs": region(indexLines, "environment") + "\nexport { STARTUP_ENVIRONMENT_NAMES };\n",
    "stock-output-ledger.mjs": "import { jsonStringBytesUpTo, jsonValueBytesUpTo, truncateJsonStringBytes } from \"./stock-output-json.mjs\";\n"
      + region(indexLines, "output-ledger") + "\nexport { OutputLedger };\n",
    "stock-output-stream.mjs": region(indexLines, "output-stream") + "\nexport { drainOutput, terminateProcess };\n",
    "stock-environment-clear.mjs": region(processLines, "environment") + "\nexport { clearProgramEnvironment };\n",
  };
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
}
/** Nạp một module vùng trích bundle gốc đã sinh. Nhận: file — tên tệp trong /tmp/gbh-ptc-ab/stock. Trả: bề mặt module (any — mã JS thuần không có .d.ts). */
async function loadStock(file: string): Promise<any> {
  return await import(pathToFileURL(join(OUT, "stock", file)).href);
}
/** Script harness chạy bằng NODE thật: nạp A rồi B, đo bề mặt + 13 kịch bản resolve/run/constructor. */
const HARNESS_SOURCE = `
import Stock from "__STOCK__";
import Ours from "__OURS__";
const DEFAULTS = { executionMode: "per-call", timeoutMs: 120000, maxTimeoutMs: 600000, maxOutputBytes: 67108864, maxOldGenerationSizeMb: 512, maxMessageBytes: 134217728, maxPendingCalls: 128, graceMs: 3000 };
/** Dựng ctx giả tối thiểu cho NodePtcRuntime: on · effect · get · reflect · sandboxPolicy · logger. */
function makeCtx(options) {
  const events = [];
  const disposers = [];
  const ctx = {
    on(event) { events.push("on:" + event); return () => {}; },
    effect(fn, label) { events.push("effect:" + label); disposers.push(fn()); return () => {}; },
    get() { return undefined; },
    reflect: { provide(name) { events.push("provide:" + name); } },
    sandboxPolicy: {
      resolve() { return { mode: options?.mode ?? "read-only", workspaceRoot: options?.workspaceRoot ?? "/tmp" }; },
      get defaultMode() { return options?.mode ?? "read-only"; },
    },
    logger: { warn() {} },
    fs: { processPathFromHostPath: (path) => path },
    subprocess: { resolveExecutable: async (name) => name, spawn() { throw new Error("spawn not used"); } },
    sandbox: { confine: async (argv) => ({ argv, enforcement: "test" }) },
  };
  return { ctx, events, dispose: async () => { for (const dispose of disposers.reverse()) await dispose(); } };
}
/** Chạy 13 kịch bản trên một Impl (A hoặc B) và trả quan sát. */
async function runAll(Impl) {
  const observed = { keys: Object.keys(Impl), config: String(Impl.Config), name: Impl.name, inject: Impl.inject, scenarios: [] };
  const scenario = async (name, run) => {
    try { observed.scenarios.push({ name, ok: true, value: await run() }); }
    catch (error) { observed.scenarios.push({ name, ok: false, error: error?.message ?? String(error) }); }
  };
  await scenario("resolve-defaults", async () => {
    const host = makeCtx();
    const runtime = new Impl(host.ctx, structuredClone(DEFAULTS));
    const spec = await runtime.resolve({ program: "return 1", bindings: [] });
    return { cwd: spec.cwd, timeoutMs: spec.timeoutMs, policy: spec.sandboxPolicy, format: runtime.programFormat, language: runtime.language, isolation: runtime.isolation, timeout: runtime.timeout, sandboxMode: runtime.sandboxMode, instructions: runtime.executionInstructions, events: host.events };
  });
  await scenario("resolve-explicit", async () => {
    const host = makeCtx();
    const spec = await new Impl(host.ctx, structuredClone(DEFAULTS)).resolve({ program: "1", bindings: [], cwd: "/tmp/explicit", timeoutMs: 500, sandboxPolicy: { mode: "workspace-write", workspaceRoot: "/tmp/explicit" } });
    return { cwd: spec.cwd, timeoutMs: spec.timeoutMs, policy: spec.sandboxPolicy };
  });
  for (const [name, request] of [
    ["resolve-relative-cwd", { program: "1", bindings: [], cwd: "relative/path" }],
    ["resolve-negative-timeout", { program: "1", bindings: [], timeoutMs: -1 }],
  ]) await scenario(name, async () => { await new Impl(makeCtx().ctx, structuredClone(DEFAULTS)).resolve(request); });
  await scenario("resolve-timeout-clamped", async () => {
    const spec = await new Impl(makeCtx().ctx, structuredClone(DEFAULTS)).resolve({ program: "1", bindings: [], timeoutMs: 9999999 });
    return { timeoutMs: spec.timeoutMs };
  });
  await scenario("run-without-policy", async () => {
    await new Impl(makeCtx().ctx, structuredClone(DEFAULTS)).run({ program: "1", bindings: [], cwd: "/tmp", timeoutMs: 100 });
  });
  await scenario("after-disposal", async () => {
    const host = makeCtx();
    const runtime = new Impl(host.ctx, structuredClone(DEFAULTS));
    await host.dispose();
    const errors = [];
    for (const run of [() => runtime.resolve({ program: "1", bindings: [] }), () => runtime.run({ program: "1", bindings: [] })]) {
      try { await run(); errors.push(null); } catch (error) { errors.push(error?.message ?? String(error)); }
    }
    return errors;
  });
  for (const [name, config] of [
    ["launch-empty-executable", { launch: { kind: "node-script", executable: "" } }],
    ["launch-relative-bootstrap", { launch: { kind: "node-script", executable: process.execPath, bootstrapPath: "relative/bootstrap.js" } }],
    ["config-zero-timeout", { timeoutMs: 0 }],
    ["config-small-output", { maxOutputBytes: 3 }],
  ]) await scenario(name, async () => { new Impl(makeCtx().ctx, { ...structuredClone(DEFAULTS), ...config }); });
  await scenario("persistent-mode", async () => {
    const host = makeCtx();
    const runtime = new Impl(host.ctx, { ...structuredClone(DEFAULTS), executionMode: "persistent-in-memory" });
    let relErr = null;
    try { runtime.resolve({ program: "1", bindings: [], cwd: "rel" }); } catch (error) { relErr = error?.message ?? String(error); }
    return { format: runtime.programFormat, instructions: runtime.executionInstructions, timeout: runtime.timeout, relErr, events: host.events };
  });
  await scenario("persistent-embedded-launch", async () => {
    new Impl(makeCtx().ctx, { ...structuredClone(DEFAULTS), executionMode: "persistent-in-memory", launch: { kind: "embedded", executable: process.execPath } });
  });
  return observed;
}
const a = await runAll(Stock);
const b = await runAll(Ours);
console.log(JSON.stringify({ a, b }));
`.replace("__STOCK__", STOCK_INDEX).replace("__OURS__", OURS_INDEX);
beforeAll(async () => {
  rmSync(OUT, { recursive: true, force: true });
  await buildPackage(OUT);
  symlinkSync(join(REPO, "apps", "host", "node_modules"), join(OUT, "node_modules"), "dir");
  generateStockModules();
  writeFileSync(join(OUT, "ab-harness.mjs"), HARNESS_SOURCE);
  const stockFiles: Array<[string, string]> = [
    ["jsonWire", "stock-json-wire.mjs"], ["bindings", "stock-bindings.mjs"], ["outputJson", "stock-output-json.mjs"],
    ["channel", "stock-channel.mjs"], ["launch", "stock-launch.mjs"], ["config", "stock-config.mjs"],
    ["policy", "stock-policy-processes.mjs"], ["environment", "stock-environment.mjs"],
    ["environmentClear", "stock-environment-clear.mjs"], ["outputLedger", "stock-output-ledger.mjs"],
    ["outputStream", "stock-output-stream.mjs"],
  ];
  for (const [key, file] of stockFiles) stock[key] = await loadStock(file);
  stockUtil = await import(pathToFileURL(join(PEERS, "dsh-util-values", "lib", "index.js")).href);
  for (const path of [STOCK_PROCESS, OURS_PROCESS, STOCK_PERSISTENT, OURS_PERSISTENT]) childRuns[path] = runChild(path);
  const run = Bun.spawnSync([NODE, join(OUT, "ab-harness.mjs")], { timeout: 180_000 });
  if (run.exitCode !== 0) throw new Error("harness node lỗi: " + run.stderr.toString().slice(0, 800));
  harness = JSON.parse(run.stdout.toString());
}, 240_000);
/** Lấy một kịch bản theo tên ở một phía harness. Nhận: side — phía A hoặc B; name — tên kịch bản. Trả: kịch bản đã ghi. */
function scenarioOf(side: HarnessSide, name: string): HarnessSide["scenarios"][number] {
  const found = side.scenarios.find((item) => item.name === name);
  if (found === undefined) throw new Error("thiếu kịch bản " + name);
  return found;
}
/** Khẳng định một kịch bản lỗi ở CẢ HAI phía với đúng một câu. Nhận: name — tên kịch bản; message — câu lỗi mong đợi. Trả: không (ném assertion khi lệch). */
function expectScenarioError(name: string, message: string): void {
  for (const side of [harness.a, harness.b]) {
    const observed = scenarioOf(side, name);
    expect(observed.ok).toBe(false);
    expect(observed.error).toBe(message);
  }
}

describe("json-wire: snapshot · encode · decode", () => {
  test("snapshot vô hướng + null-prototype + realm khác trùng util-values (A) và bản ta (B)", () => {
    const value = { a: [1, "x", null, true, { b: -2.5 }], c: {}, d: [] };
    expect(snapshotPtcJsonValue(value)).toEqual(stockUtil.snapshotJsonValue(value));
    expect(JSON.stringify(snapshotPtcJsonValue(value))).toBe(JSON.stringify(stockUtil.snapshotJsonValue(value)));
    expect(snapshotPtcJsonValue(null)).toBeNull();
    expect(snapshotPtcJsonValue("x")).toBe("x");
    const nullProto = Object.assign(Object.create(null), { a: 1 });
    expect(snapshotPtcJsonValue(nullProto)).toEqual(stockUtil.snapshotJsonValue(nullProto));
    expect(snapshotPtcJsonValue(runInNewContext("({a: [1, 2]})"))).toEqual(stockUtil.snapshotJsonValue(runInNewContext("({a: [1, 2]})")));
  });
  test("snapshot từ chối lá không JSON · chu trình · mảng thưa · lớp lạ · khoá không hiển thị", () => {
    const object: any = { a: 1 };
    object.self = object;
    const array: any[] = [1];
    array.push(array);
    const sparse: any[] = [1];
    sparse[2] = 3;
    const extra: any = [1];
    extra.extra = 2;
    const rejects: unknown[] = [undefined, () => 1, Symbol("x"), 1n, NaN, Infinity, -Infinity, -0, object, array, sparse, extra, new Date(0), new Map([["a", 1]]), new Set([1]), new (class X { a = 1 })(), Object.defineProperty({ a: 1 }, "b", { value: 2, enumerable: false }), { [Symbol("k")]: 1 }];
    for (const value of rejects) {
      expect(snapshotPtcJsonValue(value)).toBeUndefined();
      expect(stockUtil.snapshotJsonValue(value)).toBeUndefined();
    }
  });
  test("snapshot lồng 10.000 tầng KHÔNG chạm ngăn xếp — cả hai cùng độ sâu", () => {
    let deep: any = 1;
    for (let index = 0; index < 10_000; index++) deep = [deep];
    const depthOf = (value: any): number => {
      let depth = 0;
      let node = value;
      while (Array.isArray(node)) {
        node = node[0];
        depth += 1;
      }
      return depth;
    };
    expect(depthOf(snapshotPtcJsonValue(deep))).toBe(10_000);
    expect(depthOf(stockUtil.snapshotJsonValue(deep))).toBe(10_000);
  });
  test("encode: wire trùng từng token; mảng thưa/thuộc tính undefined cùng ném", () => {
    const value = { a: [1, "x", null, true, { b: -2.5 }], c: {} };
    expect(encodePtcJsonWire(value)).toEqual(stock.jsonWire.encodePtcJsonWire(value));
    const sparse: any[] = [];
    sparse[1] = 1;
    expect(captureError(() => encodePtcJsonWire(sparse))).toBe(captureError(() => stock.jsonWire.encodePtcJsonWire(sparse)));
    expect(captureError(() => encodePtcJsonWire(sparse))).toBe("cannot encode a sparse JSON array");
    expect(captureError(() => encodePtcJsonWire({ a: undefined } as any))).toBe(captureError(() => stock.jsonWire.encodePtcJsonWire({ a: undefined })));
  });
  test("decode: round-trip giá trị phức hợp trùng A", () => {
    const value = { a: [1, "x", null, true, { b: -2.5 }], c: {}, d: [[], [1, [2]]] };
    expect(decodePtcJsonWire(encodePtcJsonWire(value))).toEqual(stock.jsonWire.decodePtcJsonWire(stock.jsonWire.encodePtcJsonWire(value)));
    expect(decodePtcJsonWire(encodePtcJsonWire(value))).toEqual(value);
  });
  test("decode: 22 wire hỏng đều trả undefined ở CẢ HAI bản", () => {
    const bad: unknown[] = [
      [], [1, 2], [undefined], [NaN], [Infinity], [-0], [{ kind: "array", length: 2 }],
      [{ kind: "array", length: 2 }, 1], [{ kind: "array", length: -1 }], [{ kind: "array", length: 0, extra: 1 }],
      [{ kind: "array", length: "1" }], [{ kind: "array", length: 1.5 }], [{ kind: "array", length: 2 }, 1, 2, 3],
      [{ kind: "object", keys: ["a", "a"] }, 1, 2], [{ kind: "object", keys: ["a"], extra: 1 }],
      [{ kind: "object", keys: "a" }], [{ kind: "object", keys: [1] }], [{ kind: "object", keys: [] }, 1],
      [{ kind: "unknown" }], [{ kind: null }], [{ kind: "array" }], [{ kind: "object", keys: ["a"] }, 1, 2],
    ];
    expect(bad.length).toBe(22);
    for (const wire of bad) {
      expect(decodePtcJsonWire(wire)).toBeUndefined();
      expect(stock.jsonWire.decodePtcJsonWire(wire)).toBeUndefined();
    }
  });
});

describe("bindings: kiểm tên trước spawn + trả lời binding", () => {
  /** Dựng request tối thiểu cho validateBindings. Nhận: bindings. Trả: request. */
  const request = (bindings: any[]): any => ({ program: "1", bindings });
  test("namespace hợp lệ: map giữ ĐÚNG thứ tự khoá — trùng A", () => {
    const bindings = [{ global: "tools", functions: { a: async () => null } }, { global: "_ok2", functions: {} }];
    expect([...validateBindings(request(bindings)).keys()]).toEqual([...stock.bindings.validateBindings(request(bindings)).keys()]);
    expect([...validateBindings(request(bindings)).keys()]).toEqual(["tools", "_ok2"]);
  });
  test("global không phải định danh + từ khoá di động ⇒ cùng câu lỗi", () => {
    for (const global of ["1bad", "my-ns", "", "a b", "é", "class", "await", "lambda", "None", "True", "match", "type", "_"]) {
      const message = captureError(() => validateBindings(request([{ global, functions: {} }])));
      expect(message).toBe(captureError(() => stock.bindings.validateBindings(request([{ global, functions: {} }]))));
      expect(message).toContain("is not a usable identifier");
    }
  });
  test("global bị giữ chỗ ⇒ cùng câu reserved binding global", () => {
    for (const global of ["console", "__name__", "__debug__", "__dsh_main__", "__builtins__"]) {
      const message = captureError(() => validateBindings(request([{ global, functions: {} }])));
      expect(message).toBe(captureError(() => stock.bindings.validateBindings(request([{ global, functions: {} }]))));
      expect(message).toBe("dsh-ptc-runtime-node: reserved binding global " + JSON.stringify(global));
    }
  });
  test("global trùng lặp ⇒ cùng câu lỗi", () => {
    const bindings = [{ global: "same", functions: {} }, { global: "same", functions: {} }];
    expect(captureError(() => validateBindings(request(bindings)))).toBe(captureError(() => stock.bindings.validateBindings(request(bindings))));
    expect(captureError(() => validateBindings(request(bindings)))).toContain("duplicate binding global");
  });
  test("errorClass: 8 tổ hợp đúng/sai đều trùng A", () => {
    const cases: any[] = [
      { global: "tools", functions: {}, errorClass: { name: "ToolError", memberNameProperty: "toolName" } },
      { global: "tools", functions: {}, errorClass: { name: "class", memberNameProperty: "m" } },
      { global: "tools", functions: {}, errorClass: { name: "console", memberNameProperty: "m" } },
      { global: "tools", functions: {}, errorClass: { name: "ToolError", memberNameProperty: "name" } },
      { global: "tools", functions: {}, errorClass: { name: "ToolError", memberNameProperty: "add_note" } },
      { global: "tools", functions: {}, errorClass: { name: "ToolError", memberNameProperty: "__x__" } },
      { global: "tools", functions: {}, errorClass: { name: "ToolError", memberNameProperty: "" } },
      { global: "same", functions: {}, errorClass: { name: "same", memberNameProperty: "m" } },
    ];
    for (const item of cases) {
      const ours = (() => {
        try {
          return "ok:" + [...validateBindings(request([item])).keys()].join(",");
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      })();
      const theirs = (() => {
        try {
          return "ok:" + [...stock.bindings.validateBindings(request([item])).keys()].join(",");
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      })();
      expect(ours).toBe(theirs);
    }
  });
  test("replyToBinding: kết quả JSON → cùng wire + wire giải mã đúng giá trị", async () => {
    const reply = await replyToBinding(7, async () => ({ a: [1, 2] }), null);
    const expected = await stock.bindings.replyToBinding(7, async () => ({ a: [1, 2] }), null);
    expect(reply).toEqual(expected);
    expect(reply).toEqual({ type: "reply", id: 7, ok: true, value: stock.jsonWire.encodePtcJsonWire({ a: [1, 2] }) });
    expect(decodePtcJsonWire((reply as any).value)).toEqual({ a: [1, 2] });
  });
  test("replyToBinding: thiếu binding · ném · kết quả không lossless — cùng câu", async () => {
    const calls: Array<(impl: any) => Promise<unknown>> = [
      (impl) => impl.replyToBinding(1, undefined, null),
      (impl) => impl.replyToBinding(2, async () => { throw new Error("boom"); }, null),
      (impl) => impl.replyToBinding(3, async () => { throw "raw"; }, null),
      (impl) => impl.replyToBinding(4, async () => NaN, null),
      (impl) => impl.replyToBinding(5, async () => undefined, null),
    ];
    for (const call of calls) expect(await call({ replyToBinding })).toEqual(await call(stock.bindings));
    expect(await replyToBinding(1, undefined, null)).toEqual({ type: "reply", id: 1, ok: false, message: "binding is unavailable in this evaluation; reacquire the current tool" });
    expect(await replyToBinding(4, async () => NaN, null)).toEqual({ type: "reply", id: 4, ok: false, message: "binding resolution must be lossless JSON" });
  });
});

describe("output-json: kế toán byte + cắt theo code point", () => {
  test("jsonStringBytesUpTo = số byte JSON.stringify; vượt trần hoặc maxBytes < 2 ⇒ undefined", () => {
    const samples = ["", "abc", "héllo", "😀", "a😀b", 'quote"slash' + String.fromCharCode(92), String.fromCharCode(0, 8, 9, 10, 12, 13), String.fromCharCode(31), String.fromCharCode(0xd800)];
    for (const text of samples) {
      const expected = Buffer.byteLength(JSON.stringify(text), "utf8");
      expect(jsonStringBytesUpTo(text, 10_000)).toBe(expected);
      expect(stock.outputJson.jsonStringBytesUpTo(text, 10_000)).toBe(expected);
    }
    for (const [text, max] of [["abcdef", 4], ["😀", 3], ["x", 1], ["x", 0]] as Array<[string, number]>) {
      expect(jsonStringBytesUpTo(text, max)).toBeUndefined();
      expect(stock.outputJson.jsonStringBytesUpTo(text, max)).toBeUndefined();
    }
    expect(jsonStringBytesUpTo("", 2)).toBe(2);
  });
  test("jsonValueBytesUpTo = số byte JSON.stringify cho 9 giá trị; vượt trần ⇒ undefined", () => {
    const samples: any[] = [null, true, false, 0, -1.5, "héllo😀", [1, [2, { a: null }]], { a: 1, b: [true, "x"] }, {}];
    for (const value of samples) {
      const expected = Buffer.byteLength(JSON.stringify(value), "utf8");
      expect(jsonValueBytesUpTo(value, 10_000)).toBe(expected);
      expect(stock.outputJson.jsonValueBytesUpTo(value, 10_000)).toBe(expected);
    }
    for (const [value, max] of [[{ a: 1 }, 5], [[1, 2, 3], 6], ["long text", 4]] as Array<[any, number]>) {
      expect(jsonValueBytesUpTo(value, max)).toBeUndefined();
      expect(stock.outputJson.jsonValueBytesUpTo(value, max)).toBeUndefined();
    }
  });
  test("truncate: tiền tố vừa trần, không cắt đôi cặp surrogate — trùng A", () => {
    const text = "a😀b" + String.fromCharCode(0) + "c";
    for (let max = 2; max <= 20; max++) {
      const ours = truncateJsonStringBytes(text, max);
      expect(ours).toBe(stock.outputJson.truncateJsonStringBytes(text, max));
      expect(Buffer.byteLength(JSON.stringify(ours), "utf8")).toBeLessThanOrEqual(max);
      expect(/[\uD800-\uDBFF]$/.test(ours)).toBe(false);
    }
    expect(truncateJsonStringBytes("😀", 5)).toBe("");
    expect(truncateJsonStringBytes("😀", 6)).toBe("😀");
  });
  test("truncate: chuỗi vừa trần giữ NGUYÊN VĂN; maxBytes < 2 ⇒ rỗng", () => {
    expect(truncateJsonStringBytes("abc", 5)).toBe("abc");
    expect(stock.outputJson.truncateJsonStringBytes("abc", 5)).toBe("abc");
    for (const max of [0, 1]) {
      expect(truncateJsonStringBytes("abc", max)).toBe("");
      expect(stock.outputJson.truncateJsonStringBytes("abc", max)).toBe("");
    }
  });
});

describe("channel: frame 4 byte + trần byte", () => {
  test("send → bên kia nhận đúng frame; frame cắt từng byte vẫn ghép đúng — trùng A", async () => {
    const roundtrip = await channelObserve(JsonChannel as unknown as ChannelCtor, "roundtrip");
    expect(roundtrip).toEqual(await channelObserve(stock.channel.JsonChannel as ChannelCtor, "roundtrip"));
    expect(roundtrip.rightSeen).toEqual([{ hello: "world", n: 1 }, [1, 2, null]]);
    const fragmented = await channelObserve(JsonChannel as unknown as ChannelCtor, "fragmented");
    expect(fragmented).toEqual(await channelObserve(stock.channel.JsonChannel as ChannelCtor, "fragmented"));
    expect(fragmented.rightSeen).toEqual([{ a: [1, "x"] }]);
  });
  test("header rỗng/vượt trần + payload UTF-8 hỏng ⇒ cùng lỗi protocol ở cả hai", async () => {
    for (const kind of ["empty-header", "oversize-header", "invalid-utf8"]) {
      const ours = await channelObserve(JsonChannel as unknown as ChannelCtor, kind);
      const theirs = await channelObserve(stock.channel.JsonChannel as ChannelCtor, kind);
      expect(ours).toEqual(theirs);
      expect(ours.failures[0].type).toBe("protocol");
    }
    expect((await channelObserve(JsonChannel as unknown as ChannelCtor, "empty-header")).failures[0].message).toBe("control frame exceeds 64 bytes or is empty");
    expect((await channelObserve(JsonChannel as unknown as ChannelCtor, "oversize-header")).failures[0].message).toBe("control frame exceeds 64 bytes or is empty");
  });
  test("gửi quá trần ⇒ cùng câu từ chối ở cả hai", async () => {
    const ours = await channelObserve(JsonChannel as unknown as ChannelCtor, "over-cap");
    expect(ours).toEqual(await channelObserve(stock.channel.JsonChannel as ChannelCtor, "over-cap"));
    expect(ours.rejection).toBe("control output exceeds 16 queued bytes");
  });
  test("close ⇒ pending + send sau close cùng reject, drain vẫn xong — trùng A", async () => {
    const ours = await channelObserve(JsonChannel as unknown as ChannelCtor, "close");
    expect(ours).toEqual(await channelObserve(stock.channel.JsonChannel as ChannelCtor, "close"));
    expect(ours.afterClose).toBe("control channel is closed");
    expect(ours.drain).toBe("KHONG-NEM");
  });
});

describe("launch: chọn bootstrap + tham số", () => {
  test("resolveLaunch mặc định = process.execPath; tường minh trả NGUYÊN cấu hình — trùng A", () => {
    expect(resolveLaunch()).toEqual(stock.launch.resolveLaunch());
    expect(resolveLaunch()).toEqual({ kind: "node-script", executable: process.execPath });
    for (const config of [
      { kind: "node-script", executable: "/opt/node", bootstrapPath: "/opt/bootstrap.js" },
      { kind: "embedded", executable: "/opt/ptc" },
    ] as const) {
      expect(resolveLaunch(config)).toEqual(stock.launch.resolveLaunch(config));
      expect(resolveLaunch(config)).toEqual(config);
    }
  });
  test("resolveLaunch: executable rỗng + bootstrapPath tương đối — cùng câu lỗi", () => {
    const cases: any[] = [
      { kind: "node-script", executable: "" },
      { kind: "node-script", executable: "/bin/node", bootstrapPath: "relative.js" },
    ];
    for (const config of cases) expect(captureError(() => resolveLaunch(config))).toBe(captureError(() => stock.launch.resolveLaunch(config)));
    expect(captureError(() => resolveLaunch(cases[0]))).toBe("ptc-runtime-node: launch.executable must be non-empty");
    expect(captureError(() => resolveLaunch(cases[1]))).toBe("ptc-runtime-node: launch.bootstrapPath must be absolute");
  });
  test("bootstrapArgs: embedded + persistent lỗi + bootstrapPath tường minh — trùng A", () => {
    const fs = { processPathFromHostPath: (path: string) => "WORLD:" + path };
    const embedded = { kind: "embedded", executable: "/opt/ptc" } as const;
    expect(bootstrapArgs(fs, embedded, 9)).toEqual(stock.launch.bootstrapArgs(fs, embedded, 9));
    expect(bootstrapArgs(fs, embedded, 9)).toEqual(["9"]);
    expect(captureError(() => bootstrapArgs(fs, embedded, 9, true))).toBe(captureError(() => stock.launch.bootstrapArgs(fs, embedded, 9, true)));
    expect(captureError(() => bootstrapArgs(fs, embedded, 9, true))).toBe("Persistent PTC requires a node-script launch");
    const explicit = { kind: "node-script", executable: "/opt/node", bootstrapPath: "/opt/process.js" } as const;
    expect(bootstrapArgs(fs, explicit, 7)).toEqual(stock.launch.bootstrapArgs(fs, explicit, 7));
    expect(bootstrapArgs(fs, explicit, 7)).toEqual(["/opt/process.js", "7"]);
    expect(bootstrapArgs(fs, explicit, 7, true)).toEqual(stock.launch.bootstrapArgs(fs, explicit, 7, true));
  });
  test("nguồn .ts: nhánh --eval gọi runNodeMain/runPersistentMain; ánh xạ hỏng cùng tiền tố lỗi", () => {
    const fs = { processPathFromHostPath: (path: string) => "WORLD:" + path };
    const source = bootstrapArgs(fs, { kind: "node-script", executable: "/opt/node" }, 5);
    expect(source[0]).toBe("--input-type=module");
    expect(source[1]).toBe("--eval");
    expect(source[2]).toContain("runNodeMain");
    expect(source[2]).toContain("WORLD:");
    expect(bootstrapArgs(fs, { kind: "node-script", executable: "/opt/node" }, 5, true)[2]).toContain("runPersistentMain");
    const unmapped = { processPathFromHostPath: () => undefined };
    const ours = captureError(() => bootstrapArgs(unmapped, { kind: "node-script", executable: "/opt/node" }, 5));
    const theirs = captureError(() => stock.launch.bootstrapArgs(unmapped, { kind: "node-script", executable: "/opt/node" }, 5));
    expect(ours.startsWith("PTC runtime bootstrap is unavailable in the subprocess execution world: ")).toBe(true);
    expect(theirs.startsWith("PTC runtime bootstrap is unavailable in the subprocess execution world: ")).toBe(true);
  });
});

describe("config: schema + validate", () => {
  /** Cấu hình hợp lệ đầy đủ (default của NodeConfig). */
  const BASE: any = { executionMode: "per-call", timeoutMs: 120_000, maxTimeoutMs: 600_000, maxOutputBytes: 67_108_864, maxOldGenerationSizeMb: 512, maxMessageBytes: 134_217_728, maxPendingCalls: 128, graceMs: 3_000 };
  test("String(NodeConfig) NGUYÊN VĂN trùng bundle gốc; config hợp lệ đi qua CẢ HAI bản", () => {
    expect(String(NodeConfig)).toBe(String(stock.config.NodeConfig));
    expect(String(NodeConfig)).toContain('executionMode?: "per-call" | "persistent-in-memory"');
    expect(captureError(() => validateConfig(BASE))).toBe("KHONG-NEM");
    expect(captureError(() => stock.config.validateConfig({ ...BASE }))).toBe("KHONG-NEM");
  });
  test("số âm/0/không hữu hạn + vượt dải hẹn giờ ⇒ cùng câu lỗi", () => {
    const cases: Array<[string, number]> = [["timeoutMs", 0], ["timeoutMs", -5], ["timeoutMs", NaN], ["graceMs", Infinity]];
    for (const [key, value] of cases) {
      const ours = captureError(() => validateConfig({ ...BASE, [key]: value }));
      expect(ours).toBe(captureError(() => stock.config.validateConfig({ ...BASE, [key]: value })));
      expect(ours).toBe("ptc-runtime-node: " + key + " must be positive and finite");
    }
    for (const key of ["timeoutMs", "maxTimeoutMs", "graceMs"]) {
      const ours = captureError(() => validateConfig({ ...BASE, [key]: 2_147_483_648 }));
      expect(ours).toBe(captureError(() => stock.config.validateConfig({ ...BASE, [key]: 2_147_483_648 })));
      expect(ours).toBe("ptc-runtime-node: " + key + " exceeds the supported timer range");
    }
  });
  test("trần byte/số nguyên ⇒ 5 tổ hợp cùng câu lỗi", () => {
    const cases: Array<[string, number]> = [
      ["maxOutputBytes", 3], ["maxOutputBytes", 4.5], ["maxMessageBytes", 4_294_967_296],
      ["maxPendingCalls", 1.5], ["maxOldGenerationSizeMb", 0.5],
    ];
    for (const [key, value] of cases) {
      expect(captureError(() => validateConfig({ ...BASE, [key]: value }))).toBe(captureError(() => stock.config.validateConfig({ ...BASE, [key]: value })));
    }
    expect(captureError(() => validateConfig({ ...BASE, maxOutputBytes: 3 }))).toBe("ptc-runtime-node: maxOutputBytes must be an integer of at least 4");
    expect(captureError(() => validateConfig({ ...BASE, maxMessageBytes: 4_294_967_296 }))).toBe("ptc-runtime-node: maxMessageBytes must fit an unsigned 32-bit frame length");
  });
  test("maxPendingCalls/maxOldGenerationSizeMb không nguyên ⇒ cùng câu 'must be an integer'", () => {
    expect(captureError(() => validateConfig({ ...BASE, maxPendingCalls: 1.5 }))).toBe("ptc-runtime-node: maxPendingCalls must be an integer");
    expect(captureError(() => validateConfig({ ...BASE, maxOldGenerationSizeMb: 0.5 }))).toBe("ptc-runtime-node: maxOldGenerationSizeMb must be an integer");
  });
});

describe("policy-processes: dọn khi đổi chế độ", () => {
  test("wiring constructor: session/event global + nhãn effect — trùng A", async () => {
    const ours = await policyObserve(PolicyProcesses as unknown as PolicyCtor, "same-mode");
    expect(ours.events).toEqual((await policyObserve(stock.policy.PolicyProcesses as PolicyCtor, "same-mode")).events);
    expect(ours.events).toEqual(["on:session/event:true", "effect:Node PTC policy cleanup"]);
  });
  test("đổi chế độ ⇒ release MỘT lần, wait xong; phát lại không release thêm — trùng A", async () => {
    const ours = await policyObserve(PolicyProcesses as unknown as PolicyCtor, "mode-change");
    expect(ours).toEqual(await policyObserve(stock.policy.PolicyProcesses as PolicyCtor, "mode-change"));
    expect(ours.releases).toBe(1);
    expect(ours.waitError).toBeUndefined();
  });
  test("cùng chế độ · phiên khác · đã gỡ theo dõi ⇒ KHÔNG release — trùng A", async () => {
    for (const kind of ["same-mode", "other-session", "unregister"]) {
      const ours = await policyObserve(PolicyProcesses as unknown as PolicyCtor, kind);
      expect(ours).toEqual(await policyObserve(stock.policy.PolicyProcesses as PolicyCtor, kind));
      expect(ours.releases).toBe(0);
    }
  });
  test("không sessionId ⇒ no-op; dispose dọn 2; release lỗi ⇒ warn + wait reject — trùng A", async () => {
    const noSession = await policyObserve(PolicyProcesses as unknown as PolicyCtor, "no-session");
    expect(noSession).toEqual(await policyObserve(stock.policy.PolicyProcesses as PolicyCtor, "no-session"));
    expect(noSession.releases).toBe(0);
    const disposed = await policyObserve(PolicyProcesses as unknown as PolicyCtor, "dispose");
    expect(disposed).toEqual(await policyObserve(stock.policy.PolicyProcesses as PolicyCtor, "dispose"));
    expect(disposed.releases).toBe(2);
    const rejected = await policyObserve(PolicyProcesses as unknown as PolicyCtor, "reject");
    expect(rejected).toEqual(await policyObserve(stock.policy.PolicyProcesses as PolicyCtor, "reject"));
    expect(rejected.waitError).toBe("boom");
    expect(rejected.warns).toEqual(["boom"]);
  });
});

describe("output-stream: xả ống + kết thúc tiến trình", () => {
  test("drainOutput: undefined/đã kết thúc ⇒ true; destroyed/error/close/hết hạn ⇒ false — trùng A", async () => {
    for (const kind of ["undefined", "ended", "destroyed", "error", "close", "timer"]) {
      const ours = await drainObserve(drainOutput, kind);
      expect(ours).toBe(await drainObserve(stock.outputStream.drainOutput, kind));
    }
    expect(await drainObserve(drainOutput, "ended")).toBe(true);
    expect(await drainObserve(drainOutput, "destroyed")).toBe(false);
    expect(await drainObserve(drainOutput, "error")).toBe(false);
    expect(await drainObserve(drainOutput, "close")).toBe(false);
    expect(await drainObserve(drainOutput, "timer")).toBe(false);
  });
  test("terminateProcess: ống sạch + done reject ⇒ true, terminate 1 lần, ống bị destroy — trùng A", async () => {
    const clean = await terminateObserve(terminateProcess, "clean");
    expect(clean).toEqual(await terminateObserve(stock.outputStream.terminateProcess, "clean"));
    expect(clean).toEqual({ drained: true, terminated: 1, destroyed: true });
    const rejected = await terminateObserve(terminateProcess, "done-rejects");
    expect(rejected).toEqual(await terminateObserve(stock.outputStream.terminateProcess, "done-rejects"));
    expect(rejected.drained).toBe(true);
  });
  test("terminateProcess: ống không đóng ⇒ false ở cả hai", async () => {
    const failing = await terminateObserve(terminateProcess, "drain-fails");
    expect(failing).toEqual(await terminateObserve(stock.outputStream.terminateProcess, "drain-fails"));
    expect(failing.drained).toBe(false);
  });
});

describe("environment + output-ledger", () => {
  test("STARTUP_ENVIRONMENT_NAMES: đúng 6 tên, trùng A", () => {
    expect([...STARTUP_ENVIRONMENT_NAMES].sort()).toEqual([...stock.environment.STARTUP_ENVIRONMENT_NAMES].sort());
    expect([...STARTUP_ENVIRONMENT_NAMES].sort()).toEqual(["PATH", "PATHEXT", "SYSTEMROOT", "TEMP", "TMP", "WINDIR"]);
  });
  test("clearProgramEnvironment: giữ 6 tên (không phân biệt HOA/thường), env mới null-prototype — trùng A", () => {
    const ours = clearObserve(clearProgramEnvironment);
    expect(ours).toEqual(clearObserve(stock.environmentClear.clearProgramEnvironment));
    expect(ours.remaining.sort()).toEqual(["PATH", "PATHEXT", "SYSTEMROOT", "TEMP", "TMP", "WINDIR", "path"].sort());
    expect(ours.fresh).toEqual([]);
    expect(ours.protoNull).toBe(true);
    expect(ours.sameObject).toBe(false);
  });
  test("OutputLedger: admit · success · failure · limit đều trùng A", () => {
    const ours = ledgerObserve(OutputLedger);
    const theirs = ledgerObserve(stock.outputLedger.OutputLedger);
    expect(ours).toEqual(theirs);
    expect(ours.admitted).toEqual([true, false, true]);
    expect(ours.sink).toEqual(["abc", "def"]);
    expect(ours.limit.error.kind).toBe("output-limit");
    expect(ours.limit.error.message).toBe("outer output exceede");
    expect(Buffer.byteLength(JSON.stringify(ours.limit.error.message), "utf8")).toBeLessThanOrEqual(22);
  });
});

describe("index qua NODE thật: bề mặt + 13 kịch bản", () => {
  test("bun KHÔNG nạp được CẢ HAI bản (thiếu stripTypeScriptTypes) — đối xứng", async () => {
    const messages: string[] = [];
    for (const path of [STOCK_INDEX, OURS_INDEX]) {
      try {
        await import(pathToFileURL(path).href);
        messages.push("KHONG-NEM");
      } catch (error) {
        messages.push(error instanceof Error ? error.message : String(error));
      }
    }
    expect(messages[0]).toBe(messages[1]);
    expect(messages[0]).toContain("stripTypeScriptTypes");
  });
  test("Object.keys · String(Config) · name · inject trùng nhau", () => {
    expect(harness.b.keys).toEqual(harness.a.keys);
    expect(harness.b.keys).toEqual(["inject", "Config"]);
    expect(harness.b.config).toBe(harness.a.config);
    expect(harness.b.name).toBe(harness.a.name);
    expect(harness.b.name).toBe("NodePtcRuntime");
    expect(harness.b.inject).toEqual(harness.a.inject);
    expect(harness.b.inject).toEqual(["fs", "subprocess", "sandbox", "sandboxPolicy"]);
  });
  test("executionInstructions per-call NGUYÊN VĂN + language/isolation/programFormat/sandboxMode", () => {
    const a = scenarioOf(harness.a, "resolve-defaults");
    const b = scenarioOf(harness.b, "resolve-defaults");
    expect(b).toEqual(a);
    const value = b.value as any;
    expect(value.instructions).toBe((a.value as any).instructions);
    expect(value.instructions.startsWith("The program is the body of an async TypeScript function;")).toBe(true);
    expect(value.instructions).toContain("process.env starts empty");
    expect(value.language).toBe("typescript");
    expect(value.isolation).toBe("process");
    expect(value.format).toBe("function-body");
    expect(value.sandboxMode).toBe("read-only");
    expect(value.events).toEqual(["provide:ptcRuntime", "on:session/event", "effect:Node PTC policy cleanup", "effect:Node ptc-runtime cleanup"]);
  });
  test("persistent-in-memory: instructions NGUYÊN VĂN, programFormat repl, lỗi cwd tiền tố persistent PTC:", () => {
    const a = scenarioOf(harness.a, "persistent-mode");
    const b = scenarioOf(harness.b, "persistent-mode");
    expect(b).toEqual(a);
    const value = b.value as any;
    expect(value.format).toBe("repl");
    expect(value.instructions.startsWith("The program contains TypeScript REPL statements;")).toBe(true);
    expect(value.relErr).toBe("persistent PTC: cwd must be absolute");
    expect(value.events).toEqual(["provide:ptcRuntime", "on:session/event", "effect:Node PTC policy cleanup", "effect:Persistent PTC environments", "effect:Node ptc-runtime cleanup"]);
  });
  test("resolve: mặc định · tường minh · kẹp timeout — trùng A", () => {
    for (const name of ["resolve-defaults", "resolve-explicit", "resolve-timeout-clamped"]) {
      expect(scenarioOf(harness.b, name)).toEqual(scenarioOf(harness.a, name));
    }
    const defaults = scenarioOf(harness.a, "resolve-defaults").value as any;
    expect(defaults.cwd).toBe("/tmp");
    expect(defaults.timeoutMs).toBe(120_000);
    expect(defaults.timeout).toEqual({ defaultMs: 120_000, maxMs: 600_000 });
    expect((scenarioOf(harness.a, "resolve-timeout-clamped").value as any).timeoutMs).toBe(600_000);
    const explicit = scenarioOf(harness.a, "resolve-explicit").value as any;
    expect(explicit.cwd).toBe("/tmp/explicit");
    expect(explicit.policy).toEqual({ mode: "workspace-write", workspaceRoot: "/tmp/explicit" });
  });
  test("resolve lỗi: cwd tương đối · timeout âm · run thiếu policy · sau disposal — cùng câu", () => {
    expectScenarioError("resolve-relative-cwd", "ptc-runtime-node: cwd must be absolute");
    expectScenarioError("resolve-negative-timeout", "ptc-runtime-node: timeoutMs must be a positive finite number");
    expectScenarioError("run-without-policy", "ptc-runtime-node: run requires a resolved sandbox policy");
    const after = scenarioOf(harness.a, "after-disposal");
    expect(scenarioOf(harness.b, "after-disposal")).toEqual(after);
    expect(after.value).toEqual(["ptc-runtime-node: resolve after disposal", "ptc-runtime-node: run after disposal"]);
  });
  test("constructor/launch/config lỗi + persistent embedded ⇒ cùng câu ở cả hai", () => {
    expectScenarioError("launch-empty-executable", "ptc-runtime-node: launch.executable must be non-empty");
    expectScenarioError("launch-relative-bootstrap", "ptc-runtime-node: launch.bootstrapPath must be absolute");
    expectScenarioError("config-zero-timeout", "ptc-runtime-node: timeoutMs must be positive and finite");
    expectScenarioError("config-small-output", "ptc-runtime-node: maxOutputBytes must be an integer of at least 4");
    expectScenarioError("persistent-embedded-launch", "Persistent PTC requires a node-script launch");
  });
  test("toàn bộ 13 kịch bản của A và B trùng KHÍT", () => {
    expect(harness.b.scenarios).toEqual(harness.a.scenarios);
    expect(harness.a.scenarios.length).toBe(13);
  });
});

describe("hai entry con bằng NODE thật: thiếu marker fd 7", () => {
  test("lib/process.js: A và B cùng mã thoát 1 + cùng câu lỗi", () => {
    const ours = childRuns[OURS_PROCESS]!;
    const theirs = childRuns[STOCK_PROCESS]!;
    expect(ours.status).toBe(1);
    expect(ours.status).toBe(theirs.status);
    const message = "Error: subprocess control channel was not inherited";
    expect(ours.stderr).toContain(message);
    expect(theirs.stderr).toContain(message);
    expect(ours.stderr.split("\n").find((line) => line.includes(message))?.trim()).toBe(message);
  });
  test("lib/persistent-process.js: A và B cùng mã thoát 1 + cùng câu lỗi", () => {
    const ours = childRuns[OURS_PERSISTENT]!;
    const theirs = childRuns[STOCK_PERSISTENT]!;
    expect(ours.status).toBe(1);
    expect(ours.status).toBe(theirs.status);
    const message = "Error: subprocess control channel was not inherited";
    expect(ours.stderr).toContain(message);
    expect(theirs.stderr).toContain(message);
    expect(theirs.stderr.split("\n").find((line) => line.includes(message))?.trim()).toBe(message);
  });
});