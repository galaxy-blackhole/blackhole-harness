/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test đối chứng (A/B) cho @galaxy-blackhole/gbh-tool-terminal: A = bundle gốc, B = artefact của ta;
 *      Context cordis THẬT, TIẾN TRÌNH GIẢ 100% (mock handle pid/kill/signal/onData/exitCode/timeout —
 *      tuyệt đối không shell/spawn thật): export, String(Config)+5 cấu hình, đăng ký tool/service/hook,
 *      exec thành công/lỗi/thoát/timeout/abort, read/signal/close/list, job nền, helper thuần qua hook.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildPackage } from "../../packages/host/tool-terminal/build.ts";

/** Gốc repo, package của ta, bundle gốc (oracle) và cordis THẬT. */
const REPO = join(import.meta.dir, "..", "..");
const PKG = join(REPO, "packages", "host", "tool-terminal");
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-terminal", "lib", "index.js");
const CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
const TOOL_ORDER = ["terminal_open", "terminal_send", "terminal_read", "terminal_signal", "terminal_close", "terminal_list"];
const EXPORT_NAMES = ["Config", "DEFAULT_MAX_RESULT_BYTES", "MIN_MAX_RESULT_BYTES", "apply", "inject", "name"];

interface Block { readonly type: string; readonly text?: string }
interface Exec { agent?: { id: string }; signal: AbortSignal; callId: string; rootCallId: string }
interface Section { name: string; order: number; text: string }
interface ConfigValue { enableRunInBackground: boolean; maxResultBytes: number }
interface ContextLike { provide(name: string, value: unknown): void; get(name: string): unknown }

interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly output: Record<string, unknown>;
  execute(args: Record<string, unknown>, exec: Exec): Promise<unknown>;
  finalizeContent?: (exec: unknown, result: { content: readonly Block[] }) => readonly Block[] | undefined;
  presentCall?: (args: Record<string, unknown>) => unknown;
  presentResult?: (args: Record<string, unknown>, result: { content: readonly Block[]; isError?: boolean }) => unknown;
}

interface TerminalModule {
  readonly name: string;
  readonly inject: readonly string[];
  readonly DEFAULT_MAX_RESULT_BYTES: number;
  readonly MIN_MAX_RESULT_BYTES: number;
  readonly Config: ((input?: Record<string, unknown>) => ConfigValue) & { toString(): string };
  apply(ctx: ContextLike, config?: { enableRunInBackground?: boolean; maxResultBytes?: number }): void;
}

interface TerminalSnapshot { sessionId: string; name?: string; type: string; pid: number; status: Record<string, unknown> }
interface SpawnSnapshot extends TerminalSnapshot { motd: string }
interface ReadPage { text: string; totalLines: number; lineBegin: number; lineEnd: number; truncated: boolean }
interface SendResult { viewport: string; waitReason: string; sessionStatus: Record<string, unknown>; truncated: boolean }
interface SendOperation { done: Promise<SendResult>; cancel: () => void; readOutput: () => { delta: string; truncated: boolean } }
type SendMode = "success" | "exit" | "timeout" | "error" | "abort";

interface Behavior {
  mode: SendMode;
  killResult: boolean;
  listResult: TerminalSnapshot[];
  readResult: ReadPage;
  delta: string;
  readTruncated: boolean;
}

interface Calls {
  spawn: { owner: unknown; request: { type: string; name?: string; cwd: string }; signal?: AbortSignal }[];
  startSend: { owner: unknown; id: string; request: { text: string; submit: boolean; signal?: AbortSignal } }[];
  read: { owner: unknown; id: string; request: unknown }[];
  signal: { owner: unknown; id: string; signal: string }[];
  kill: { owner: unknown; id: string }[];
  list: { owner: unknown }[];
}

interface Harness {
  readonly ctx: ContextLike;
  readonly tools: Tool[];
  readonly prompts: Section[];
  readonly calls: { promptOrders: string[]; workingDirectory: { owner: unknown; signal: AbortSignal }[] };
  readonly terminals: FakeTerminals;
  readonly jobSpecs: Record<string, unknown>[];
  tool(name: string): Tool;
}

interface JobSpec {
  kind: string;
  label: string;
  toolCall: { callId: string; rootCallId: string };
  owner: string;
  outputLimitBytes: number;
  output: { read(fromByte: number): { text: string; nextOffset: number; lossy: boolean } }[];
  run(): { cancel(): void; done: Promise<{ status: string; detail: string }> };
}

/** Handle tiến trình GIẢ 100% — không chạm OS, không shell, không spawn. */
class FakeProcess {
  readonly pid: number;
  readonly timeout = 120_000;
  exitCode: number | null = null;
  signal: string | null = null;
  readonly writes: string[] = [];
  readonly signals: string[] = [];
  readonly kills: string[] = [];
  private readonly listeners: ((chunk: string) => void)[] = [];
  private closed = false;

  constructor(pid: number) { this.pid = pid; }
  get running(): boolean { return !this.closed; }

  onData(listener: (chunk: string) => void): () => void {
    this.listeners.push(listener);
    return () => { const index = this.listeners.indexOf(listener); if (index >= 0) this.listeners.splice(index, 1); };
  }

  write(text: string): void {
    if (this.closed) throw new Error("fake pty da dong");
    this.writes.push(text);
    for (const listener of [...this.listeners]) listener(text);
  }

  signalTo(name: string): void { this.signals.push(name); }

  kill(name = "SIGTERM"): boolean { this.kills.push(name); this.finish(null, name); return true; }

  finish(code: number | null, signal: string | null): void {
    if (this.closed) return;
    this.closed = true;
    this.exitCode = code;
    this.signal = signal;
  }
}

/** Seam terminals GIẢ 100% — mọi thao tác chỉ chạm handle giả. */
class FakeTerminals {
  readonly processes = new Map<string, FakeProcess>();
  readonly calls: Calls = { spawn: [], startSend: [], read: [], signal: [], kill: [], list: [] };
  readonly behavior: Behavior = {
    mode: "success",
    killResult: true,
    listResult: [],
    readResult: { text: "line-1\nline-2", totalLines: 2, lineBegin: 1, lineEnd: 2, truncated: false },
    delta: "out",
    readTruncated: false,
  };

  spawn(owner: unknown, request: { type: string; name?: string; cwd: string }, signal?: AbortSignal): Promise<SpawnSnapshot> {
    this.calls.spawn.push({ owner, request, signal });
    const sessionId = "pty-" + String(this.processes.size + 1);
    const process = new FakeProcess(4000 + this.processes.size);
    this.processes.set(sessionId, process);
    return Promise.resolve({
      sessionId,
      ...(request.name === undefined ? {} : { name: request.name }),
      type: request.type,
      pid: process.pid,
      status: { kind: "running" },
      motd: "fake-shell$ ",
    });
  }

  startSend(owner: unknown, id: unknown, request: { text: string; submit: boolean; signal?: AbortSignal }): SendOperation {
    const key = String(id);
    const process = this.mustProcess(key);
    this.calls.startSend.push({ owner, id: key, request });
    if (this.behavior.mode === "error") {
      return {
        done: Promise.reject(new Error("fake pty write failed: EIO")),
        cancel: () => { process.kill("SIGTERM"); },
        readOutput: () => ({ delta: this.behavior.delta, truncated: this.behavior.readTruncated }),
      };
    }
    process.write(request.text + (request.submit ? "\r" : ""));
    const chunks: string[] = [];
    const off = process.onData((chunk) => chunks.push(chunk));
    const result = (waitReason: string, status: Record<string, unknown>, truncated: boolean): SendResult => ({
      viewport: chunks.join(""),
      waitReason,
      sessionStatus: status,
      truncated,
    });
    const operation = (done: Promise<SendResult>): SendOperation => ({
      done: done.finally(off),
      cancel: () => { process.kill("SIGTERM"); },
      readOutput: () => ({ delta: this.behavior.delta, truncated: this.behavior.readTruncated }),
    });
    if (this.behavior.mode === "abort") {
      return operation(new Promise<SendResult>((resolve) => {
        const onAbort = (): void => {
          process.kill("SIGTERM");
          resolve(result("session_exit", { kind: "exited", exitCode: null, signal: "SIGTERM" }, false));
        };
        if (request.signal?.aborted === true) onAbort();
        else request.signal?.addEventListener("abort", onAbort, { once: true });
      }));
    }
    if (this.behavior.mode === "exit") {
      process.write("bye\r\n");
      process.finish(7, null);
      return operation(Promise.resolve(result("session_exit", { kind: "exited", exitCode: 7, signal: null }, false)));
    }
    if (this.behavior.mode === "timeout") {
      process.write("partial\r\n");
      return operation(Promise.resolve(result("timeout", { kind: "running" }, true)));
    }
    process.write("ok\r\n");
    return operation(Promise.resolve(result("inferred_idle", { kind: "running" }, false)));
  }

  read(owner: unknown, id: unknown, request: unknown): ReadPage {
    const key = String(id);
    this.mustProcess(key);
    this.calls.read.push({ owner, id: key, request });
    return this.behavior.readResult;
  }

  signal(owner: unknown, id: unknown, signal: string): { delivered: true; targetPgid: number } {
    const process = this.mustProcess(String(id));
    this.calls.signal.push({ owner, id: String(id), signal });
    process.signalTo(signal);
    return { delivered: true, targetPgid: process.pid };
  }

  kill(owner: unknown, id: unknown): Promise<boolean> {
    const key = String(id);
    const process = this.mustProcess(key);
    this.calls.kill.push({ owner, id: key });
    if (this.behavior.killResult) process.kill("SIGTERM");
    return Promise.resolve(this.behavior.killResult);
  }

  list(owner: unknown): TerminalSnapshot[] {
    this.calls.list.push({ owner });
    return this.behavior.listResult;
  }

  private mustProcess(key: string): FakeProcess {
    const process = this.processes.get(key);
    if (process === undefined) throw new Error("khong co phien gia " + key);
    return process;
  }
}

const stockModule = (await import(STOCK)) as unknown as TerminalModule;
const { Context } = (await import(CORDIS)) as unknown as { Context: new () => ContextLike };
let ourModule: TerminalModule;
let OUT = "";
let ARTIFACT = "";
let ARTIFACT_TEXT = "";
const STOCK_BYTES = readFileSync(STOCK);
const STOCK_TEXT = STOCK_BYTES.toString("utf8");
const globalBun = Bun as unknown as { spawn: unknown; spawnSync: unknown };
const realSpawn = globalBun.spawn;
const realSpawnSync = globalBun.spawnSync;
let realSpawnCalls = 0;

/** Chặn mọi spawn THẬT của Bun — test chỉ được dùng tiến trình giả. */
function blockRealSpawn(): void {
  globalBun.spawn = (..._args: unknown[]): unknown => {
    realSpawnCalls += 1;
    throw new Error("Bun.spawn bị CẤM: test chỉ dùng tiến trình giả");
  };
  globalBun.spawnSync = (..._args: unknown[]): unknown => {
    realSpawnCalls += 1;
    throw new Error("Bun.spawnSync bị CẤM: test chỉ dùng tiến trình giả");
  };
}

function restoreRealSpawn(): void {
  globalBun.spawn = realSpawn;
  globalBun.spawnSync = realSpawnSync;
}

blockRealSpawn();

beforeAll(async () => {
  mkdirSync(join(PKG, "lib"), { recursive: true });
  OUT = mkdtempSync(join(PKG, "lib", ".test-build-"));
  ARTIFACT = buildPackage(OUT);
  ARTIFACT_TEXT = readFileSync(ARTIFACT, "utf8");
  ourModule = (await import(ARTIFACT)) as unknown as TerminalModule;
});

afterAll(() => {
  restoreRealSpawn();
  if (OUT !== "") rmSync(OUT, { recursive: true, force: true });
});

/** Băm SHA-256 và mã hoá JSON ổn định (giữ cả undefined). */
function sha256(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function encode(value: unknown): string { return JSON.stringify(value, (_key, item) => (item === undefined ? "__undefined__" : item)); }

/** Chạy một phép và trả nhãn kết quả/lỗi thay vì ném. */
async function outcome(run: () => unknown): Promise<string> {
  try {
    return "ok|" + encode(await run());
  } catch (error) {
    const thrown = error as { name?: string; message?: string };
    return "nem|" + String(thrown.name) + ": " + String(thrown.message);
  }
}

/** Một lượt chạy hợp lệ với agent mặc định. */
function execOf(overrides: Partial<Exec> = {}): Exec {
  return { agent: { id: "agent-1" }, signal: new AbortController().signal, callId: "call-1", rootCallId: "root-1", ...overrides };
}

/** Dựng harness trên Context cordis THẬT với seam giả. */
function createHarness(
  mod: TerminalModule,
  options: { jobs?: boolean; config?: { enableRunInBackground?: boolean; maxResultBytes?: number } } = {},
): Harness {
  const ctx = new Context();
  const terminals = new FakeTerminals();
  const tools: Tool[] = [];
  const prompts: Section[] = [];
  const calls = { promptOrders: [] as string[], workingDirectory: [] as { owner: unknown; signal: AbortSignal }[] };
  ctx.provide("terminals", terminals);
  ctx.provide("tools", { register: (tool: Tool): void => { tools.push(tool); } });
  ctx.provide("systemPrompt", {
    section: (section: Section): void => { prompts.push(section); },
    getSectionOrder: (label: string): number => {
      calls.promptOrders.push(label);
      return label === "TOOL_PTY" ? 17 : 0;
    },
  });
  ctx.provide("workingDirectory", {
    ensure: (owner: unknown, signal: AbortSignal): Promise<string> => {
      calls.workingDirectory.push({ owner, signal });
      return Promise.resolve("/work/dir");
    },
  });
  const jobSpecs: Record<string, unknown>[] = [];
  if (options.jobs !== false) {
    ctx.provide("jobs", {
      start: (spec: Record<string, unknown>): string => { jobSpecs.push(spec); return "job-1"; },
    });
  }
  mod.apply(ctx, options.config);
  return {
    ctx,
    tools,
    prompts,
    calls,
    terminals,
    jobSpecs,
    tool(name: string): Tool {
      const found = tools.find((entry) => entry.name === name);
      if (found === undefined) throw new Error("khong co cong cu " + name);
      return found;
    },
  };
}

/** Chạy cùng một kịch bản trên hai module, mỗi bên một harness mới. */
async function pair(
  run: (mod: TerminalModule, h: Harness) => unknown,
  options?: { jobs?: boolean; config?: { enableRunInBackground?: boolean; maxResultBytes?: number } },
): Promise<{ our: string; their: string; ours: Harness; theirs: Harness }> {
  const ours = createHarness(ourModule, options);
  const theirs = createHarness(stockModule, options);
  const our = encode(await run(ourModule, ours));
  const their = encode(await run(stockModule, theirs));
  return { our, their, ours, theirs };
}

/** Render text của một công cụ qua hook output.render. */
function renderOf(tool: Tool, args: Record<string, unknown>, value: unknown): string {
  const render = tool.output["render"] as (a: unknown, v: unknown) => readonly Block[];
  return render(args, value).map((block) => block.text ?? "").join("|");
}

describe("A · artefact byte + bề mặt module", () => {
  test("index.js dựng trong mkdtemp: CÙNG BYTE (20 052 B · 654 dòng · sha256) với bundle gốc", () => {
    const ourBytes = readFileSync(ARTIFACT);
    expect(buildPackage(OUT)).toBe(ARTIFACT);
    expect(ourBytes.equals(STOCK_BYTES)).toBe(true);
    expect(ourBytes.length).toBe(20_052);
    expect(STOCK_BYTES.length).toBe(20_052);
    expect(ourBytes.toString("utf8")).toBe(STOCK_TEXT);
    expect((STOCK_TEXT.match(/\n/gu) ?? []).length).toBe(654);
    expect(sha256(ourBytes)).toBe("e75845292220ed21c0af6763ffa0a044d38f7b9b4d05c2b00248aea8718a7e83");
    expect(sha256(ourBytes)).toBe(sha256(STOCK_BYTES));
  });

  test("tập export runtime đúng SÁU tên; name/inject/hai trần byte khớp gốc; KHÔNG default", () => {
    expect(Object.keys(ourModule).sort()).toEqual([...EXPORT_NAMES].sort());
    expect(Object.keys(ourModule).sort()).toEqual(Object.keys(stockModule).sort());
    expect(ourModule.name).toBe(stockModule.name);
    expect(ourModule.name).toBe("tool-terminal");
    expect([...ourModule.inject]).toEqual([...stockModule.inject]);
    expect([...ourModule.inject]).toEqual(["terminals", "tools", "systemPrompt", "workingDirectory"]);
    expect(ourModule.DEFAULT_MAX_RESULT_BYTES).toBe(stockModule.DEFAULT_MAX_RESULT_BYTES);
    expect(ourModule.DEFAULT_MAX_RESULT_BYTES).toBe(262_144);
    expect(ourModule.MIN_MAX_RESULT_BYTES).toBe(stockModule.MIN_MAX_RESULT_BYTES);
    expect(ourModule.MIN_MAX_RESULT_BYTES).toBe(64);
    expect(typeof ourModule.apply).toBe("function");
    expect(typeof ourModule.Config).toBe("function");
    expect((ourModule as unknown as { default?: unknown }).default).toBeUndefined();
    expect((stockModule as unknown as { default?: unknown }).default).toBeUndefined();
  });

  test("nguồn KHÔNG chứa lệnh spawn thật (child_process/node-pty/Bun.spawn) — process giả 100%", () => {
    for (const [label, text] of [["stock", STOCK_TEXT], ["ours", ARTIFACT_TEXT]] as const) {
      expect(text, label).not.toContain("child_process");
      expect(text, label).not.toContain("node-pty");
      expect(text, label).not.toContain("Bun.spawn");
      expect(text, label).not.toContain("spawnSync");
      expect(text, label).not.toContain("execFile");
    }
    expect(realSpawnCalls).toBe(0);
    expect(Bun.spawn).not.toBe(realSpawn);
    expect(Bun.spawnSync).not.toBe(realSpawnSync);
  });
});

describe("B · Config (helper THUẦN của gói) A/B", () => {
  test("String(Config) + 5 input (mặc định/rỗng/tắt cờ/biên 64/sai 63) khớp từng chữ", async () => {
    const scenario = async (mod: TerminalModule) => ({
      text: String(mod.Config),
      defaults: mod.Config(),
      empty: mod.Config({}),
      off: mod.Config({ enableRunInBackground: false }),
      min: mod.Config({ maxResultBytes: 64 }),
      invalid: await outcome(() => mod.Config({ maxResultBytes: 63 })),
    });
    const ours = encode(await scenario(ourModule));
    const theirs = encode(await scenario(stockModule));
    expect(ours).toBe(theirs);
    const seen = JSON.parse(ours) as { text: string; defaults: ConfigValue; empty: ConfigValue; off: ConfigValue; min: ConfigValue; invalid: string };
    expect(seen.text).toBe("{ enableRunInBackground?: boolean, maxResultBytes?: number }");
    expect(seen.defaults).toEqual({ enableRunInBackground: true, maxResultBytes: 262_144 });
    expect(seen.empty).toEqual(seen.defaults);
    expect(seen.off).toEqual({ enableRunInBackground: false, maxResultBytes: 262_144 });
    expect(seen.min).toEqual({ enableRunInBackground: true, maxResultBytes: 64 });
    expect(seen.invalid.startsWith("nem|")).toBe(true);
  });

  test("apply với maxResultBytes không hợp lệ (63 · 1.5 · NaN): ném nguyên văn như gốc", async () => {
    for (const bad of [63, 1.5, Number.NaN]) {
      const ours = await outcome(() => createHarness(ourModule, { config: { maxResultBytes: bad } }));
      const theirs = await outcome(() => createHarness(stockModule, { config: { maxResultBytes: bad } }));
      expect(ours).toBe(theirs);
      expect(ours).toContain("maxResultBytes must be a safe integer of at least 64");
    }
  });

  test("enableRunInBackground=false: bỏ tham số + câu mô tả + chặn gửi nền, y hệt gốc", async () => {
    const p = await pair(async (_mod, h) => {
      const params = h.tool("terminal_send").parameters as { properties?: Record<string, unknown> };
      return {
        properties: Object.keys(params.properties ?? {}),
        description: h.tool("terminal_send").description,
        error: await outcome(() => h.tool("terminal_send").execute({ sessionId: "pty-1", text: "ls", run_in_background: true }, execOf())),
      };
    }, { config: { enableRunInBackground: false } });
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as { properties: string[]; description: string; error: string };
    expect(seen.properties).toEqual(["sessionId", "text", "submit"]);
    expect(seen.description).not.toContain("Background mode returns");
    expect(seen.error).toContain("background terminal sends are disabled");
  });
});

describe("C · apply trên Context cordis THẬT", () => {
  test("đăng ký ĐỒNG BỘ sáu tool đúng thứ tự + section tool:pty order TOOL_PTY", async () => {
    const p = await pair((mod, h) => ({
      name: mod.name,
      inject: [...mod.inject],
      registered: h.tools.map((tool) => tool.name),
      syncRegistered: h.tools.length,
      descriptions: h.tools.map((tool) => tool.description),
      toolKeys: Object.keys(h.tools[0] ?? {}),
      prompts: h.prompts,
      promptOrders: h.calls.promptOrders,
      workingDirectory: h.calls.workingDirectory.map((call) => ({ owner: call.owner, aborted: call.signal.aborted })),
      terminalSeam: h.ctx.get("terminals") === h.terminals,
      toolsSeam: (h.ctx.get("tools") as { register?: unknown } | undefined)?.register !== undefined,
    }));
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as {
      name: string;
      inject: string[];
      registered: string[];
      syncRegistered: number;
      descriptions: string[];
      toolKeys: string[];
      prompts: Section[];
      promptOrders: string[];
      workingDirectory: { owner: unknown; aborted: boolean }[];
      terminalSeam: boolean;
      toolsSeam: boolean;
    };
    expect(seen.name).toBe("tool-terminal");
    expect(seen.inject).toEqual(["terminals", "tools", "systemPrompt", "workingDirectory"]);
    expect(seen.registered).toEqual(TOOL_ORDER);
    expect(seen.syncRegistered).toBe(6);
    expect(seen.toolKeys).toEqual(["name", "description", "parameters", "output", "execute", "finalizeContent", "presentCall"]);
    expect(seen.descriptions[0]).toContain("Create a persistent, owner-isolated terminal session");
    expect(seen.prompts).toHaveLength(1);
    expect(seen.prompts[0]?.name).toBe("tool:pty");
    expect(seen.prompts[0]?.order).toBe(17);
    expect(seen.prompts[0]?.text).toContain("An inferred_idle or timeout result does not prove the foreground command exited.");
    expect(seen.promptOrders).toEqual(["TOOL_PTY"]);
    expect(seen.workingDirectory).toEqual([]);
    expect(seen.terminalSeam).toBe(true);
    expect(seen.toolsSeam).toBe(true);
    expect(p.ours.tools).toHaveLength(6);
    expect(p.theirs.tools).toHaveLength(6);
  });

  test("schema tham số + schema đầu ra + mô tả của cả sáu tool khớp khít", async () => {
    const p = await pair((_mod, h) => ({
      specs: h.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        schema: tool.output["schema"],
        outputKeys: Object.keys(tool.output),
      })),
      sendParams: h.tool("terminal_send").parameters,
    }));
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as {
      specs: { name: string; description: string; parameters: Record<string, unknown>; schema: unknown; outputKeys: string[] }[];
      sendParams: { properties: Record<string, unknown> };
    };
    expect(seen.specs.map((spec) => spec.name)).toEqual(TOOL_ORDER);
    for (const spec of seen.specs) expect(spec.outputKeys.join(",")).toBe(spec.name === "terminal_send" ? "schema,render,presentationMeta" : "schema,render");
    expect(Object.keys(seen.sendParams.properties)).toEqual(["sessionId", "text", "submit", "run_in_background"]);
    expect(seen.specs[0]?.description).toContain("Create a persistent, owner-isolated terminal session");
    expect(JSON.stringify(seen.specs[1]?.schema)).toContain('"stdin_read"');
  });
});

describe("D · exec với tiến trình GIẢ (không shell/spawn thật)", () => {
  test("terminal_open: spawn qua handle giả (pid), cwd tương đối/tuyệt đối, name chỉ khi truyền", async () => {
    const p = await pair(async (_mod, h) => {
      const first = await h.tool("terminal_open").execute({ type: "shell", name: "main", cwd: "sub" }, execOf());
      const second = await h.tool("terminal_open").execute({ type: "shell", cwd: "/abs" }, execOf());
      return {
        first,
        second,
        spawns: h.terminals.calls.spawn.map((call) => ({ owner: call.owner, request: call.request, aborted: call.signal?.aborted ?? null })),
        processes: [...h.terminals.processes.entries()].map(([id, process]) => ({ id, pid: process.pid, running: process.running })),
      };
    });
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as {
      first: SpawnSnapshot;
      second: SpawnSnapshot;
      spawns: { owner: unknown; request: { type: string; name?: string; cwd: string }; aborted: boolean | null }[];
      processes: { id: string; pid: number; running: boolean }[];
    };
    expect(seen.spawns).toEqual([
      { owner: { id: "agent-1" }, request: { type: "shell", name: "main", cwd: "/work/dir/sub" }, aborted: false },
      { owner: { id: "agent-1" }, request: { type: "shell", cwd: "/abs" }, aborted: false },
    ]);
    expect(seen.first).toMatchObject({ sessionId: "pty-1", name: "main", type: "shell", pid: 4000, status: { kind: "running" } });
    expect(seen.second).not.toHaveProperty("name");
    expect(seen.processes).toEqual([{ id: "pty-1", pid: 4000, running: true }, { id: "pty-2", pid: 4001, running: true }]);
  });

  test("terminal_send THÀNH CÔNG: submit mặc định ghi CR, onData → viewport, inferred_idle", async () => {
    const p = await pair(async (_mod, h) => {
      await h.tool("terminal_open").execute({ type: "shell" }, execOf());
      const result = await h.tool("terminal_send").execute({ sessionId: "pty-1", text: "ls" }, execOf());
      const noEnter = await h.tool("terminal_send").execute({ sessionId: "pty-1", text: "x", submit: false }, execOf());
      const process = h.terminals.processes.get("pty-1");
      return {
        result,
        noEnter,
        writes: process?.writes ?? [],
        pid: process?.pid ?? null,
        running: process?.running ?? null,
        startSends: h.terminals.calls.startSend.map((call) => ({ text: call.request.text, submit: call.request.submit })),
        render: renderOf(h.tool("terminal_send"), {}, result),
      };
    });
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as {
      result: { kind: string; viewport: string; waitReason: string; sessionStatus: Record<string, unknown>; truncated: boolean };
      noEnter: { kind: string };
      writes: string[];
      pid: number;
      running: boolean;
      startSends: { text: string; submit: boolean }[];
      render: string;
    };
    expect(seen.startSends).toEqual([{ text: "ls", submit: true }, { text: "x", submit: false }]);
    expect(seen.writes).toEqual(["ls\r", "ok\r\n", "x", "ok\r\n"]);
    expect(seen.result).toMatchObject({ kind: "foreground", viewport: "ok\r\n", waitReason: "inferred_idle", sessionStatus: { kind: "running" }, truncated: false });
    expect(seen.noEnter.kind).toBe("foreground");
    expect(seen.pid).toBe(4000);
    expect(seen.running).toBe(true);
    expect(seen.render).toContain("[wait: inferred_idle]");
    expect(seen.render).toContain("[session: running]");
  });

  test("terminal_send LỖI: done reject ⇒ cả hai ném nguyên văn", async () => {
    const p = await pair(async (_mod, h) => {
      await h.tool("terminal_open").execute({ type: "shell" }, execOf());
      h.terminals.behavior.mode = "error";
      return { error: await outcome(() => h.tool("terminal_send").execute({ sessionId: "pty-1", text: "boom" }, execOf())) };
    });
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as { error: string };
    expect(seen.error).toBe("nem|Error: fake pty write failed: EIO");
  });

  test("terminal_send THOÁT: exitCode=7/signal=null ⇒ session_exit + render mã thoát", async () => {
    const p = await pair(async (_mod, h) => {
      await h.tool("terminal_open").execute({ type: "shell" }, execOf());
      h.terminals.behavior.mode = "exit";
      const result = await h.tool("terminal_send").execute({ sessionId: "pty-1", text: "exit" }, execOf());
      const process = h.terminals.processes.get("pty-1");
      return {
        result,
        exitCode: process?.exitCode ?? null,
        signal: process?.signal ?? null,
        running: process?.running ?? null,
        render: renderOf(h.tool("terminal_send"), {}, result),
      };
    });
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as {
      result: { waitReason: string; sessionStatus: Record<string, unknown>; truncated: boolean };
      exitCode: number | null;
      signal: string | null;
      running: boolean;
      render: string;
    };
    expect(seen.result).toMatchObject({ waitReason: "session_exit", sessionStatus: { kind: "exited", exitCode: 7, signal: null }, truncated: false });
    expect(seen.exitCode).toBe(7);
    expect(seen.signal).toBeNull();
    expect(seen.running).toBe(false);
    expect(seen.render).toContain("[session: exited code=7 signal=null]");
  });

  test("terminal_send TIMEOUT: waitReason timeout, vẫn running, truncated + hạn chờ giả 120 000ms", async () => {
    const p = await pair(async (_mod, h) => {
      await h.tool("terminal_open").execute({ type: "shell" }, execOf());
      h.terminals.behavior.mode = "timeout";
      const result = await h.tool("terminal_send").execute({ sessionId: "pty-1", text: "sleep 9" }, execOf());
      const process = h.terminals.processes.get("pty-1");
      return {
        result,
        timeout: process?.timeout ?? null,
        running: process?.running ?? null,
        render: renderOf(h.tool("terminal_send"), {}, result),
      };
    });
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as {
      result: { waitReason: string; sessionStatus: Record<string, unknown>; truncated: boolean };
      timeout: number;
      running: boolean;
      render: string;
    };
    expect(seen.result).toMatchObject({ waitReason: "timeout", sessionStatus: { kind: "running" }, truncated: true });
    expect(seen.timeout).toBe(120_000);
    expect(seen.running).toBe(true);
    expect(seen.render).toContain("[wait: timeout]");
  });

  test("terminal_send ABORT: huỷ giữa lúc chờ ⇒ 'terminal send aborted', handle giả nhận SIGTERM", async () => {
    const p = await pair(async (_mod, h) => {
      await h.tool("terminal_open").execute({ type: "shell" }, execOf());
      h.terminals.behavior.mode = "abort";
      const controller = new AbortController();
      const pending = h.tool("terminal_send").execute({ sessionId: "pty-1", text: "sleep 9" }, execOf({ signal: controller.signal }));
      controller.abort();
      const error = await outcome(() => pending);
      const process = h.terminals.processes.get("pty-1");
      return {
        error,
        kills: process?.kills ?? [],
        exitCode: process?.exitCode ?? null,
        signal: process?.signal ?? null,
        running: process?.running ?? null,
      };
    });
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as { error: string; kills: string[]; exitCode: number | null; signal: string | null; running: boolean };
    expect(seen.error).toContain("terminal send aborted");
    expect(seen.kills).toEqual(["SIGTERM"]);
    expect(seen.exitCode).toBeNull();
    expect(seen.signal).toBe("SIGTERM");
    expect(seen.running).toBe(false);
  });
});

describe("E · read · signal · close · list · job nền", () => {
  test("terminal_read: chỉ truyền offset/count KHI CÓ; render trang + phân trang", async () => {
    const p = await pair(async (_mod, h) => {
      await h.tool("terminal_open").execute({ type: "shell" }, execOf());
      const readDefault = await h.tool("terminal_read").execute({ sessionId: "pty-1" }, execOf());
      const readPaged = await h.tool("terminal_read").execute({ sessionId: "pty-1", offset: 3, count: 10 }, execOf());
      return {
        readDefault,
        readPaged,
        requests: h.terminals.calls.read.map((call) => call.request),
        render: renderOf(h.tool("terminal_read"), {}, readDefault),
      };
    });
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as { readDefault: ReadPage; readPaged: ReadPage; requests: unknown[]; render: string };
    expect(seen.requests).toEqual([{}, { offset: 3, count: 10 }]);
    expect(seen.readDefault).toEqual({ text: "line-1\nline-2", totalLines: 2, lineBegin: 1, lineEnd: 2, truncated: false });
    expect(seen.readPaged).toEqual(seen.readDefault);
    expect(seen.render).toContain("[lines: 1-2 of 2]");
  });

  test("terminal_signal: handle giả nhận SIGINT; render pgid; terminal_close: kill + closed/already-closing", async () => {
    const p = await pair(async (_mod, h) => {
      await h.tool("terminal_open").execute({ type: "shell" }, execOf());
      const signalResult = await h.tool("terminal_signal").execute({ sessionId: "pty-1", signal: "SIGINT" }, execOf());
      const closed = await h.tool("terminal_close").execute({ sessionId: "pty-1" }, execOf());
      h.terminals.behavior.killResult = false;
      const closing = await h.tool("terminal_close").execute({ sessionId: "pty-1" }, execOf());
      const process = h.terminals.processes.get("pty-1");
      return {
        signalResult,
        closed,
        closing,
        signalCalls: h.terminals.calls.signal.map((call) => call.signal),
        killCalls: h.terminals.calls.kill.length,
        processSignals: process?.signals ?? [],
        processKills: process?.kills ?? [],
        exitCode: process?.exitCode ?? null,
        signal: process?.signal ?? null,
        renders: {
          signal: renderOf(h.tool("terminal_signal"), { signal: "SIGINT" }, signalResult),
          closed: renderOf(h.tool("terminal_close"), {}, closed),
          closing: renderOf(h.tool("terminal_close"), {}, closing),
        },
      };
    });
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as {
      signalResult: { delivered: boolean; targetPgid: number };
      closed: { sessionId: string; outcome: string };
      closing: { sessionId: string; outcome: string };
      signalCalls: string[];
      killCalls: number;
      processSignals: string[];
      processKills: string[];
      exitCode: number | null;
      signal: string | null;
      renders: { signal: string; closed: string; closing: string };
    };
    expect(seen.signalCalls).toEqual(["SIGINT"]);
    expect(seen.processSignals).toEqual(["SIGINT"]);
    expect(seen.signalResult).toEqual({ delivered: true, targetPgid: 4000 });
    expect(seen.closed).toEqual({ sessionId: "pty-1", outcome: "closed" });
    expect(seen.closing).toEqual({ sessionId: "pty-1", outcome: "already-closing" });
    expect(seen.killCalls).toBe(2);
    expect(seen.processKills).toEqual(["SIGTERM"]);
    expect(seen.exitCode).toBeNull();
    expect(seen.signal).toBe("SIGTERM");
    expect(seen.renders.signal).toContain("delivered SIGINT to foreground process group 4000");
    expect(seen.renders.closed).toBe("closed terminal session pty-1");
    expect(seen.renders.closing).toBe("terminal session pty-1 was already closing");
  });

  test("terminal_list: rỗng ⇒ câu đánh dấu; có phiên ⇒ một dòng/phiên (name/pid/exited)", async () => {
    const sessions: TerminalSnapshot[] = [
      { sessionId: "pty-1", name: "main", type: "shell", pid: 4000, status: { kind: "running" } },
      { sessionId: "pty-2", type: "shell", pid: 4001, status: { kind: "exited", exitCode: 2, signal: null } },
    ];
    const p = await pair(async (_mod, h) => {
      const empty = await h.tool("terminal_list").execute({}, execOf());
      h.terminals.behavior.listResult = sessions;
      const listed = await h.tool("terminal_list").execute({}, execOf());
      return {
        empty,
        listed,
        emptyRender: renderOf(h.tool("terminal_list"), {}, empty),
        render: renderOf(h.tool("terminal_list"), {}, listed),
        listCalls: h.terminals.calls.list.length,
      };
    });
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as { empty: unknown[]; listed: TerminalSnapshot[]; emptyRender: string; render: string; listCalls: number };
    expect(seen.empty).toEqual([]);
    expect(seen.listed).toEqual(sessions);
    expect(seen.listCalls).toBe(2);
    expect(seen.emptyRender).toBe("(no terminal sessions)");
    expect(seen.render).toContain("pty-1 (main) [shell] running pid=4000");
    expect(seen.render).toContain("pty-2 [shell] exited code=2 signal=null pid=4001");
  });

  test("job nền: spec + nguồn đọc + cancel ⇒ killed; done lỗi ⇒ failed; handle giả nhận kill", async () => {
    const p = await pair(async (mod, h) => {
      await h.tool("terminal_open").execute({ type: "shell" }, execOf());
      const kicked = await h.tool("terminal_send").execute({ sessionId: "pty-1", text: "ls", run_in_background: true }, execOf());
      const spec = h.jobSpecs[0] as unknown as JobSpec;
      const source = spec.output[0];
      if (source === undefined) throw new Error("thieu nguon doc job");
      const before = source.read(5);
      h.terminals.behavior.delta = "out";
      h.terminals.behavior.readTruncated = true;
      const run = spec.run();
      const after = source.read(0);
      run.cancel();
      const done = await run.done;
      const process = h.terminals.processes.get("pty-1");
      const failHarness = createHarness(mod);
      await failHarness.tool("terminal_open").execute({ type: "shell" }, execOf());
      failHarness.terminals.behavior.mode = "error";
      await failHarness.tool("terminal_send").execute({ sessionId: "pty-1", text: "ls", run_in_background: true }, execOf());
      const failSpec = failHarness.jobSpecs[0] as unknown as JobSpec;
      const failed = await failSpec.run().done;
      return {
        kicked,
        before,
        after,
        done,
        spec: {
          kind: spec.kind,
          label: spec.label,
          toolCall: spec.toolCall,
          owner: spec.owner,
          outputLimitBytes: spec.outputLimitBytes,
          sources: spec.output.length,
        },
        processKills: process?.kills ?? [],
        failed,
        failSources: failSpec.output.length,
      };
    });
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as {
      kicked: { kind: string; jobId: string };
      before: { text: string; nextOffset: number; lossy: boolean };
      after: { text: string; nextOffset: number; lossy: boolean };
      done: { status: string; detail: string };
      spec: { kind: string; label: string; toolCall: { callId: string; rootCallId: string }; owner: string; outputLimitBytes: number; sources: number };
      processKills: string[];
      failed: { status: string; detail: string };
      failSources: number;
    };
    expect(seen.kicked).toEqual({ kind: "background", jobId: "job-1" });
    expect(seen.spec).toEqual({
      kind: "pty-send",
      label: "pty-1: ls",
      toolCall: { callId: "call-1", rootCallId: "root-1" },
      owner: "agent-1",
      outputLimitBytes: 262_144,
      sources: 1,
    });
    expect(seen.before).toEqual({ text: "", nextOffset: 5, lossy: false });
    expect(seen.after.text).toBe("out\n[output truncated]");
    expect(seen.after.nextOffset).toBe(Buffer.byteLength(seen.after.text));
    expect(seen.after.lossy).toBe(false);
    expect(seen.done).toEqual({ status: "killed", detail: "wait: inferred_idle" });
    expect(seen.processKills).toEqual(["SIGTERM"]);
    expect(seen.failed).toEqual({ status: "failed", detail: "Error: fake pty write failed: EIO" });
    expect(seen.failSources).toBe(1);
  });
});

describe("F · helper thuần qua hook + card + UTF-8", () => {
  test("renderSpawn/renderSend/renderRead/renderList + finalizeContent + card A/B (trần 64 byte)", async () => {
    const p = await pair((_mod, h) => {
      const open = h.tool("terminal_open");
      const send = h.tool("terminal_send");
      const read = h.tool("terminal_read");
      const list = h.tool("terminal_list");
      return {
        cards: [
          open.presentCall?.({ type: "shell", name: "main" }),
          send.presentCall?.({ sessionId: "pty-1", text: "ls" }),
          send.presentCall?.({ sessionId: "pty-1", text: "ls", run_in_background: true }),
          read.presentCall?.({ sessionId: "pty-1" }),
          h.tool("terminal_signal").presentCall?.({ sessionId: "pty-1", signal: "SIGINT" }),
          h.tool("terminal_close").presentCall?.({ sessionId: "pty-1" }),
          list.presentCall?.({}),
        ],
        results: [
          send.presentResult?.({ sessionId: "pty-1", text: "ls" }, { content: [{ type: "text", text: "out" }] }),
          send.presentResult?.({ sessionId: "pty-1", text: "ls" }, { content: [{ type: "text", text: "out" }], isError: true }),
          send.presentResult?.({ sessionId: "pty-1", text: "ls", run_in_background: true }, { content: [{ type: "text", text: "out" }] }),
        ],
        finalize: {
          short: open.finalizeContent?.({}, { content: [{ type: "text", text: "ok" }] }),
          long: open.finalizeContent?.({}, { content: [{ type: "text", text: "y".repeat(500) }] }),
          emoji: open.finalizeContent?.({}, { content: [{ type: "text", text: "🙂".repeat(100) }] }),
          two: open.finalizeContent?.({}, { content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] }),
          image: open.finalizeContent?.({}, { content: [{ type: "image" }] }),
        },
        renders: {
          spawn: renderOf(open, {}, { sessionId: "pty-1", name: "main", type: "shell", pid: 4000, status: { kind: "running" }, motd: "x".repeat(200) }),
          send: renderOf(send, {}, { viewport: "abc", waitReason: "timeout", sessionStatus: { kind: "exited", exitCode: 1, signal: null }, truncated: true }),
          read: renderOf(read, {}, { text: "", totalLines: 9, lineBegin: 1, lineEnd: 9, truncated: true }),
          list: renderOf(list, {}, [{ sessionId: "pty-1", name: "main", type: "shell", pid: 4000, status: { kind: "running" } }]),
        },
      };
    }, { config: { maxResultBytes: 64 } });
    expect(p.our).toBe(p.their);
    const seen = JSON.parse(p.our) as {
      cards: unknown[];
      results: unknown[];
      finalize: { short?: Block[]; long?: Block[]; emoji?: Block[]; two?: Block[] | string; image?: Block[] | string };
      renders: { spawn: string; send: string; read: string; list: string };
    };
    expect(seen.cards).toHaveLength(7);
    expect(seen.cards[0]).toEqual({ card: "generic", title: "Open terminal main", kind: "execute" });
    expect(seen.cards[1]).toEqual({ card: "terminal", title: "ls", description: "Terminal pty-1" });
    expect(seen.cards[2]).toEqual({ card: "generic", title: "Send to terminal pty-1 in background", kind: "execute", rawInput: "ls" });
    expect(seen.cards[6]).toEqual({ card: "generic", title: "List terminal sessions", kind: "read" });
    expect(seen.results[0]).toEqual({ card: "terminal", output: "out" });
    expect(seen.results[1]).toBe("__undefined__");
    expect(seen.results[2]).toBe("__undefined__");
    expect(seen.finalize.short).toEqual([{ type: "text", text: "ok" }]);
    expect(Buffer.byteLength(seen.finalize.long?.[0]?.text ?? "")).toBeLessThanOrEqual(64);
    expect(seen.finalize.long?.[0]?.text).toContain("[output truncated]");
    expect(JSON.stringify(seen.finalize.emoji)).not.toContain("\uFFFD");
    expect(seen.finalize.emoji?.[0]?.text).not.toContain("\uFFFD");
    expect(seen.finalize.two).toBe("__undefined__");
    expect(seen.finalize.image).toBe("__undefined__");
    expect(seen.renders.spawn).toContain("started terminal session pty-1 (main) [type: shell]");
    expect(Buffer.byteLength(seen.renders.spawn)).toBeLessThanOrEqual(64);
    expect(seen.renders.send).toContain("timeout]");
    expect(seen.renders.send).toContain("[session: exited code=1 signal=null]");
    expect(seen.renders.read).toContain("(no retained output)");
    expect(seen.renders.read).toContain("[lines: 1-9 of 9]");
    expect(seen.renders.list).toContain("pty-1 (main) [shell] running pid=4000");
    expect(p.our).not.toContain("\uFFFD");
    expect(realSpawnCalls).toBe(0);
  });
});
