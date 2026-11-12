/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-auto-review (row auto-review): tập export đo trên
 *      ARTIFACT, đối chứng TỪNG hành vi với CHÍNH bundle gốc trên Context cordis THẬT (duyệt native ·
 *      PTC · từ chối/hỏi người · ma trận lỗi giao thức + ảnh chụp · vòng đời), C6 DANH TÍNH, waitFor
 *      CÓ TRẦN, quy ước gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM, và luật 000e.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/auto-review/build.ts";
import { REVIEW_POLICY } from "../../packages/host/auto-review/src/policy.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "auto-review");
/** Thư mục gói GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-experimental-auto-review");
/** Bundle GỐC — oracle của mọi phép so hành vi. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis của kernel — CÙNG một thể hiện cho cả hai bản (peer của ta trỏ về đây). */
const CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** ARTIFACT của ta: build MỘT lần vào `lib`, mọi ca đo trên chính nó. */
const OUR_ARTIFACT = await buildPackage(join(PKG, "lib"));

const cordis: any = await import(CORDIS);
const ours: any = await import(OUR_ARTIFACT);
const stock: any = await import(STOCK);
/** Lớp Context của kernel — dùng cho CẢ HAI bản. */
const ContextCtor: new () => any = cordis.Context;

/** Một dòng chunk giả — đúng hình dạng `StreamChunk` mà `BlockAssembler` nhận. */
type Chunk = Record<string, any>;

/** Kết luận "cho chạy, rủi ro thấp" — dòng chữ bộ duyệt trả về. */
const ALLOW_LOW = '{"risk":"low","decision":"allow"}';
/** Kết luận "từ chối, rủi ro trung bình, có lý do". */
const DENY_MEDIUM = '{"risk":"medium","decision":"deny","reason":"deletes a pre-existing file"}';

/**
 * Dòng chunk từ một danh sách đã dựng.
 * Nhận: `chunks` — các chunk theo đúng thứ tự stream.
 * Trả: async iterable dùng MỘT lần.
 */
async function* streamOf(chunks: Chunk[]): AsyncIterable<Chunk> {
  for (const chunk of chunks) yield chunk;
}

/**
 * Dòng chunk của MỘT khối chữ rồi một mốc kết thúc.
 * Nhận: `text` — thân khối chữ; `reasoning` — khối suy luận đi trước (nếu có); `finish` — lý do kết thúc.
 * Trả: async iterable dùng MỘT lần.
 */
function textStream(text: string, reasoning?: string, finish: Chunk = { kind: "stop" }): AsyncIterable<Chunk> {
  const chunks: Chunk[] = [];
  if (reasoning !== undefined) chunks.push({ type: "reasoning-delta", index: 0, text: reasoning });
  chunks.push({ type: "text-delta", index: reasoning === undefined ? 0 : 1, text });
  chunks.push({ type: "finish", reason: finish });
  return streamOf(chunks);
}

/** Vết của một harness: dịch vụ giả, yêu cầu LLM đã nhận, và listener đã đăng ký. */
interface Harness {
  /** Context cordis THẬT của lượt cài này. */
  readonly ctx: any;
  /** Mọi yêu cầu đã đưa cho seam `llm.stream`. */
  readonly llmCalls: any[];
  /** Mọi lời gọi seam `workingDirectory.ensure` (agent, signal). */
  readonly ensureCalls: any[][];
  /** Mọi lời gọi seam `permissionPresets.set`. */
  readonly presetWrites: any[][];
  /** Preset theo phiên (mặc định: preset của `state`). */
  readonly presetBySession: Map<any, string>;
  /** Listener `tools/pre-execute` mà plugin đã đăng ký. */
  readonly listeners: any[];
  /** Trạng thái điều khiển được của lượt cài. */
  readonly state: any;
  /** Gọi cổng đồng ý của preset Auto (ném khi tích hợp đã đóng). */
  admit(): void;
  /** Cổng đồng ý đã được gỡ chưa. */
  autoDisposed(): boolean;
}

/**
 * Dựng một harness trên Context cordis THẬT với sáu seam giả có ghi vết.
 * Nhận: `options` — preset · chính sách duyệt · cwd · sổ phiên · nhà máy dòng chunk · listener tầng dưới.
 * Trả: harness rỗng (mọi vết là mảng mới), CHƯA cài plugin.
 */
function makeHarness(options: any = {}): Harness {
  const ctx: any = new ContextCtor();
  const llmCalls: any[] = [];
  const ensureCalls: any[][] = [];
  const presetWrites: any[][] = [];
  const presetBySession = new Map<any, string>();
  const listeners: any[] = [];
  const state = {
    preset: options.preset ?? "auto",
    policy: options.policy,
    cwd: options.cwd ?? "/tmp/auto-review-project",
    review: options.review ?? (() => textStream(ALLOW_LOW)),
  };
  let autoGate: (() => void) | undefined;
  let autoDisposed = false;
  ctx.permissionPresets = {
    current: (session: any) => presetBySession.get(session) ?? state.preset,
    set: (session: any, name: string) => {
      presetWrites.push([session, name]);
    },
    registerAuto: (gate: () => void) => {
      autoGate = gate;
      return async () => {
        autoDisposed = true;
      };
    },
  };
  ctx.approval = { overrideOf: () => state.policy };
  ctx.sessions = { list: () => options.sessions ?? [] };
  ctx.workingDirectory = {
    ensure: async (agent: any, signal?: AbortSignal) => {
      ensureCalls.push([agent, signal]);
      return state.cwd;
    },
  };
  ctx.llm = {
    stream: (request: any) => {
      llmCalls.push(request);
      return state.review(request);
    },
  };
  // Tầng dưới của waterfall: đăng ký TRƯỚC khi cài plugin để phép prepend thực sự bị thử.
  if (options.downstream !== undefined) ctx.on("tools/pre-execute", options.downstream);
  const originalOn = ctx.on.bind(ctx);
  ctx.on = (name: string, listener: any, opts: any) => {
    if (name === "tools/pre-execute") listeners.push(listener);
    return originalOn(name, listener, opts);
  };
  return {
    ctx,
    llmCalls,
    ensureCalls,
    presetWrites,
    presetBySession,
    listeners,
    state,
    admit() {
      if (autoGate === undefined) throw new Error("registerAuto chưa chạy");
      autoGate();
    },
    autoDisposed() {
      return autoDisposed;
    },
  };
}

/**
 * Nhật ký phiên của một lượt gọi NATIVE đang chờ: một chỉ thị người thật, một lời gọi trước đó, và lời gọi chờ.
 * Nhận: không.
 * Trả: mảng sự kiện đúng thứ tự `seq`.
 */
function nativeEvents(): any[] {
  return [
    { seq: 0, type: "turn/start", data: { turn: 0 } },
    { seq: 1, type: "step/start", data: { turn: 0, step: 0 } },
    {
      seq: 2,
      type: "user/message",
      data: { source: { kind: "user", rpcId: "rpc-1" }, content: [{ type: "text", text: "please list the files" }] },
    },
    {
      seq: 3,
      type: "assistant/message",
      data: { turn: 0, step: 0, message: { content: [{ type: "tool-call", id: "call-0", name: "read_file", arguments: '{"path":"notes.md"}' }] } },
    },
    { seq: 4, type: "tool/call", data: { turn: 0, step: 0, callId: "call-0", name: "read_file", arguments: '{"path":"notes.md"}' } },
    {
      seq: 5,
      type: "assistant/message",
      data: { turn: 0, step: 0, message: { content: [{ type: "tool-call", id: "call-1", name: "bash", arguments: '{"command":"ls"}' }] } },
    },
    { seq: 6, type: "tool/call", data: { turn: 0, step: 0, callId: "call-1", name: "bash", arguments: '{"command":"ls"}' } },
  ];
}

/** Header yêu cầu đầy đủ của lượt native: tuyến + hai schema tool. */
function nativeHeader(): any {
  return {
    config: { provider: "deepseek", model: "deepseek-chat" },
    tools: [
      { name: "read_file", description: "Read a file", parameters: { type: "object" } },
      { name: "bash", description: "Run a shell command", parameters: { type: "object" } },
    ],
  };
}

/**
 * Dựng một phiên giả đúng phần bộ duyệt đọc.
 * Nhận: các trường ghi đè (events · nodes · header · requestHeader · isOwnSeq).
 * Trả: phiên giả.
 */
function makeSession(spec: any = {}): any {
  return {
    header: spec.header ?? { origin: "root" },
    surface: { nodes: spec.nodes ?? [2, 3, 5] },
    snapshotEvents: () => spec.events ?? nativeEvents(),
    requestHeader: spec.requestHeader ?? (() => nativeHeader()),
    isOwnSeq: spec.isOwnSeq ?? (() => true),
  };
}

/**
 * Dựng một lời gọi đang chờ (`tools/pre-execute`) đúng phần bộ duyệt đọc.
 * Nhận: các trường ghi đè; `session` dùng cho agent.
 * Trả: lời gọi giả.
 */
function makeExec(spec: any = {}): any {
  const session = spec.session ?? makeSession();
  const exec: any = {
    name: spec.name ?? "bash",
    arguments: spec.arguments === undefined ? { command: "ls" } : spec.arguments,
    signal: spec.signal ?? new AbortController().signal,
    agent: "agent" in spec ? spec.agent : { session },
    rootCallId: spec.rootCallId ?? "call-1",
    callId: spec.callId ?? "call-1",
  };
  if (spec.parent !== undefined) exec.parent = spec.parent;
  if (spec.schema !== undefined) exec.schema = spec.schema;
  return exec;
}

/**
 * Đi qua waterfall thật của cordis với tầng dưới cho trước.
 * Nhận: `h` — harness đã cài; `exec` — lời gọi đang chờ; `next` — tầng dưới (mặc định: cho chạy).
 * Trả: quyết định ngoài cùng của waterfall.
 */
function drive(h: Harness, exec: any, next: () => Promise<any> = async () => ({ kind: "allow" })): Promise<any> {
  return h.ctx.waterfall("tools/pre-execute", exec, next);
}

/**
 * Chạy CẢ HAI bản cài trên hai harness giống hệt nhau rồi so kết quả bằng JSON.
 * Nhận: `options` — tham số của harness, `exec` và tầng dưới.
 * Trả: hai kết luận, hai harness (đã gỡ), và lời gọi đã dùng.
 */
async function bothWays(options: any = {}): Promise<any> {
  const a = makeHarness(options.harness ?? {});
  const b = makeHarness(options.harness ?? {});
  ours.apply(a.ctx);
  stock.apply(b.ctx);
  const exec = options.exec ?? makeExec();
  const ourDecision = await drive(a, exec, options.next);
  const theirDecision = await drive(b, exec, options.next);
  expect(JSON.stringify(ourDecision)).toBe(JSON.stringify(theirDecision));
  await a.ctx.fiber.dispose();
  await b.ctx.fiber.dispose();
  return { ourDecision, theirDecision, ours: a, stock: b, exec };
}

/** Hình dạng so được của một yêu cầu LLM (bỏ AbortSignal — mỗi bên một tín hiệu riêng). */
function requestShape(request: any): string {
  return JSON.stringify({
    provider: request.provider,
    model: request.model,
    system: request.system,
    messages: request.messages,
    temperature: request.temperature,
  });
}

/** Bốn phần dữ liệu của một yêu cầu duyệt, đã bóc khỏi văn bản. */
interface Sections {
  /** Thứ tự bốn nhãn mục. */
  readonly labels: string[];
  /** Mục ENVIRONMENT. */
  readonly env: any;
  /** Mục PROJECT_INSTRUCTIONS. */
  readonly project: any;
  /** Mục FILTERED_HISTORY. */
  readonly history: any;
  /** Mục PENDING_ACTION. */
  readonly action: any;
}

/**
 * Bóc bốn mục JSON khỏi văn bản yêu cầu duyệt.
 * Nhận: `text` — văn bản user của yêu cầu.
 * Trả: bốn nhãn + bốn giá trị đã phân tích.
 */
function sections(text: string): Sections {
  const parts = text.split("\n\n");
  return {
    labels: [parts[0] ?? "", parts[2] ?? "", parts[4] ?? "", parts[6] ?? ""],
    env: JSON.parse(parts[1] ?? "null"),
    project: JSON.parse(parts[3] ?? "[]"),
    history: JSON.parse(parts[5] ?? "[]"),
    action: JSON.parse(parts[7] ?? "null"),
  };
}

/**
 * Chờ có TRẦN cho một điều kiện (ca flaky phải luôn kết thúc).
 * Nhận: `check` — điều kiện; `label` — nhãn lỗi; `ceilingMs` — trần chờ.
 * Trả: không; ném khi quá trần.
 */
async function waitFor(check: () => boolean, label: string, ceilingMs: number): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started >= ceilingMs) throw new Error(`waitFor("${label}") quá trần ${ceilingMs}ms`);
    await Bun.sleep(5);
  }
}
describe("row auto-review — bước 0 + ARTIFACT", () => {
  test("tập export = gốc (đo trên ARTIFACT) · inject/name nguyên văn · 0 id @deepseek-ai", async () => {
    const code = await readFile(OUR_ARTIFACT, "utf8");
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect(Object.keys(ours).sort()).toEqual(["apply", "inject", "name"]);
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(ours.name).toBe(stock.name);
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["approval", "llm", "permissionPresets", "sessions", "tools", "workingDirectory"]);
    expect(typeof ours.apply).toBe("function");
    const build = await readFile(join(PKG, "build.ts"), "utf8");
    expect(build).toContain("process.argv[2]");
  });

  test("MỘT MẶT: package.json KHÔNG dsh.client và lib/client.js KHÔNG tồn tại", async () => {
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    expect(manifest.dsh?.client).toBeUndefined();
    expect(existsSync(join(PKG, "lib", "client.js"))).toBe(false);
    const stockManifest = JSON.parse(await readFile(join(STOCK_DIR, "package.json"), "utf8"));
    expect(stockManifest.dsh?.client).toBeUndefined();
    expect(existsSync(join(STOCK_DIR, "lib", "client.js"))).toBe(false);
  });
});

describe("row auto-review — hành vi chính, đối chứng với chính bundle gốc", () => {
  test("native: cho chạy rủi ro thấp ⇒ downstream allow; yêu cầu LLM khớp TỪNG KÝ TỰ", async () => {
    const run = await bothWays();
    expect(run.ourDecision).toEqual({ kind: "allow" });
    expect(run.ours.llmCalls.length).toBe(1);
    expect(run.stock.llmCalls.length).toBe(1);
    expect(requestShape(run.ours.llmCalls[0])).toBe(requestShape(run.stock.llmCalls[0]));
    const request = run.ours.llmCalls[0];
    expect(request.provider).toBe("deepseek");
    expect(request.model).toBe("deepseek-chat");
    expect(request.temperature).toBe(0);
    expect(request.system).toBe(REVIEW_POLICY);
    expect(request.system.length).toBe(3762);
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.messages)).toBe(true);
    expect(run.ours.ensureCalls.length).toBe(1);
    expect(run.ours.ensureCalls[0]![0]).toBe(run.exec.agent);
    expect(run.ours.ensureCalls[0]![1]).toBeInstanceOf(AbortSignal);
    const s = sections(request.messages[0].content[0].text);
    expect(s.labels).toEqual(["ENVIRONMENT", "PROJECT_INSTRUCTIONS", "FILTERED_HISTORY", "PENDING_ACTION"]);
    expect(s.env).toEqual({ cwd: "/tmp/auto-review-project" });
    expect(s.project).toEqual([]);
    expect(s.history).toEqual([
      {
        kind: "user-message",
        role: "human-instruction",
        source: { kind: "user", rpcId: "rpc-1" },
        content: [{ type: "text", text: "please list the files" }],
      },
      { kind: "tool-call", role: "fact", mode: "native", name: "read_file", arguments: '{"path":"notes.md"}' },
    ]);
    expect(s.action).toEqual({
      mode: "native",
      name: "bash",
      description: "Run a shell command",
      parameters: { type: "object" },
      arguments: { command: "ls" },
    });
  });

  test("native: từ chối dưới never ⇒ deny có info; dưới ask ⇒ ask có chữ đã bản địa hoá", async () => {
    const denied = await bothWays({ harness: { policy: "never", review: () => textStream(DENY_MEDIUM) } });
    expect(denied.ourDecision).toEqual({
      kind: "deny",
      reason: 'Auto review rejected tool "bash"; its body was not executed',
      info: { name: "AutoReviewDeniedError", code: "AUTO_REVIEW_DENIED", reason: "deletes a pre-existing file" },
    });
    const refused = await bothWays({ harness: { policy: "ask", review: () => textStream(DENY_MEDIUM) } });
    expect(refused.ourDecision).toEqual({
      kind: "ask",
      reason: 'Auto review denied tool "bash": deletes a pre-existing file',
      displayReason: {
        en: "Auto review denied this call: deletes a pre-existing file",
        zh: "Auto review 拒绝了此调用：deletes a pre-existing file",
      },
    });
    const bare = await bothWays({ harness: { policy: "ask", review: () => textStream('{"risk":"high","decision":"deny"}') } });
    expect(bare.ourDecision).toEqual({
      kind: "ask",
      reason: 'Auto review denied tool "bash"',
      displayReason: { en: "Auto review denied this call.", zh: "Auto review 拒绝了此调用。" },
    });
    const final = await bothWays({ harness: { policy: "never", review: () => textStream('{"risk":"high","decision":"deny"}') } });
    expect(final.ourDecision.info).toEqual({ name: "AutoReviewDeniedError", code: "AUTO_REVIEW_DENIED" });
    expect(Object.hasOwn(final.ourDecision.info, "reason")).toBe(false);
  });

  test("thứ tự PREPEND: listener tầng dưới đăng ký TRƯỚC vẫn chạy SAU bộ duyệt", async () => {
    const downstream = async () => ({ kind: "ask", reason: "downstream asks first" });
    const run = await bothWays({ harness: { downstream } });
    // Nếu bộ duyệt KHÔNG được prepend, listener dưới chạy trước và không ai gọi LLM.
    expect(run.ours.llmCalls.length).toBe(1);
    expect(run.ourDecision).toEqual({ kind: "ask", reason: "downstream asks first" });
  });

  test("native: suy luận đi trước khối chữ vẫn hợp lệ; schema TRÙNG tên bị từ chối", async () => {
    const reasoning = await bothWays({ harness: { review: () => textStream(ALLOW_LOW, "checking effects") } });
    expect(reasoning.ourDecision).toEqual({ kind: "allow" });
    const duplicate = nativeHeader();
    duplicate.tools = [duplicate.tools[1], duplicate.tools[1], duplicate.tools[0]];
    const ambiguous = await bothWays({ exec: makeExec({ session: makeSession({ requestHeader: () => duplicate }) }) });
    expect(ambiguous.ourDecision.kind).toBe("deny");
    expect(ambiguous.ourDecision.reason).toContain("the pending native tool schema is missing or ambiguous");
  });
});

describe("row auto-review — phân vai nguồn và PTC", () => {
  test("phân vai NGUỒN: human · constraint · checkpoint · direct-parent · fact; nguồn tool bị bỏ", async () => {
    const events = [
      { seq: 0, type: "turn/start", data: { turn: 0 } },
      { seq: 1, type: "step/start", data: { turn: 0, step: 0 } },
      { seq: 2, type: "user/message", data: { source: { kind: "user", rpcId: "rpc-1" }, content: [{ type: "text", text: "human words" }] } },
      { seq: 3, type: "user/message", data: { source: { kind: "agent-instructions" }, content: [{ type: "text", text: "AGENTS.md rule" }] } },
      { seq: 4, type: "user/message", data: { source: { kind: "compact-checkpoint" }, content: [{ type: "text", text: "compacted" }] } },
      {
        seq: 5,
        type: "user/message",
        data: { source: { kind: "agent-message", senderSessionId: "parent-1" }, content: [{ type: "text", text: "parent words" }] },
      },
      {
        seq: 6,
        type: "user/message",
        data: { source: { kind: "agent-message", senderSessionId: "other" }, content: [{ type: "text", text: "unrelated peer" }] },
      },
      { seq: 7, type: "user/message", data: { source: { kind: "tool" }, content: [{ type: "text", text: "tool output" }] } },
      {
        seq: 8,
        type: "assistant/message",
        data: { turn: 0, step: 0, message: { content: [{ type: "tool-call", id: "call-1", name: "bash", arguments: '{"command":"ls"}' }] } },
      },
      { seq: 9, type: "tool/call", data: { turn: 0, step: 0, callId: "call-1", name: "bash", arguments: '{"command":"ls"}' } },
    ];
    const session = makeSession({
      events,
      nodes: [2, 3, 4, 5, 6, 7, 8],
      header: { origin: "subagent", parentSession: "parent-1" },
    });
    const run = await bothWays({ exec: makeExec({ session }) });
    expect(run.ourDecision).toEqual({ kind: "allow" });
    const s = sections(run.ours.llmCalls[0].messages[0].content[0].text);
    expect(s.project).toEqual([
      { kind: "user-message", role: "constraint", source: { kind: "agent-instructions" }, content: [{ type: "text", text: "AGENTS.md rule" }] },
    ]);
    expect(s.history.map((entry: any) => entry.role)).toEqual([
      "human-instruction",
      "checkpoint",
      "direct-parent-instruction",
      "fact",
    ]);
    expect(s.history.map((entry: any) => entry.content?.[0]?.text)).toEqual([
      "human words",
      "compacted",
      "parent words",
      "unrelated peer",
    ]);
  });

  test("PTC: lời gọi con thứ hai ⇒ history có run_code + con TRƯỚC, action là ptc-inner", async () => {
    const events = [
      { seq: 0, type: "turn/start", data: { turn: 0 } },
      { seq: 1, type: "step/start", data: { turn: 0, step: 0 } },
      { seq: 2, type: "user/message", data: { source: { kind: "user", rpcId: "rpc-1" }, content: [{ type: "text", text: "run a program" }] } },
      {
        seq: 3,
        type: "assistant/message",
        data: { turn: 0, step: 0, message: { content: [{ type: "tool-call", id: "call-1", name: "run_code", arguments: '{"program":"bash()"}' }] } },
      },
      { seq: 4, type: "tool/call", data: { turn: 0, step: 0, callId: "call-1", name: "run_code", arguments: '{"program":"bash()"}' } },
      {
        seq: 5,
        type: "tool/ptc-dispatch-start",
        data: { rootCallId: "call-1", parentCallId: "call-1", subCallId: "call-1:ptc:1", name: "read_file", arguments: { path: "notes.md" } },
      },
      {
        seq: 6,
        type: "tool/ptc-dispatch-start",
        data: { rootCallId: "call-1", parentCallId: "call-1", subCallId: "call-1:ptc:2", name: "bash", arguments: { command: "ls" } },
      },
    ];
    const session = makeSession({ events, nodes: [2, 3] });
    const exec = makeExec({
      session,
      parent: { token: 1 },
      callId: "call-1:ptc:2",
      schema: { name: "bash", description: "Run a shell command", parameters: { type: "object" } },
    });
    const run = await bothWays({ exec });
    expect(run.ourDecision).toEqual({ kind: "allow" });
    expect(run.ours.ensureCalls[0]![0]).toBe(exec.agent);
    const s = sections(run.ours.llmCalls[0].messages[0].content[0].text);
    expect(s.history).toEqual([
      {
        kind: "user-message",
        role: "human-instruction",
        source: { kind: "user", rpcId: "rpc-1" },
        content: [{ type: "text", text: "run a program" }],
      },
      { kind: "tool-call", role: "fact", mode: "native", name: "run_code", arguments: '{"program":"bash()"}' },
      { kind: "tool-call", role: "fact", mode: "ptc-inner", name: "read_file", arguments: '{\n  "path": "notes.md"\n}' },
    ]);
    expect(s.action).toEqual({
      mode: "ptc-inner",
      name: "bash",
      description: "Run a shell command",
      parameters: { type: "object" },
      arguments: { command: "ls" },
    });
  });
});

/** Dòng chunk của giao thức: một khối chữ, rồi mốc kết thúc cho trước (hoặc không có mốc). */
function protocolChunks(text: string, finish: Chunk | null = { kind: "stop" }, extra: Chunk[] = []): Chunk[] {
  const chunks: Chunk[] = [...extra, { type: "text-delta", index: extra.length, text }];
  if (finish !== null) chunks.push({ type: "finish", reason: finish });
  return chunks;
}

describe("row auto-review — ma trận lỗi GIAO THỨC (đối chứng từng thông điệp)", () => {
  const cases: Array<{ label: string; chunks: Chunk[]; expected: string }> = [
    { label: "JSON hỏng", chunks: protocolChunks("not json"), expected: "failed; its body was not executed" },
    { label: "mảng thay vật thể", chunks: protocolChunks("[]"), expected: "reviewer output must be one JSON object" },
    { label: "low + deny", chunks: protocolChunks('{"risk":"low","decision":"deny"}'), expected: "does not match the risk/decision protocol" },
    { label: "high + allow", chunks: protocolChunks('{"risk":"high","decision":"allow"}'), expected: "does not match the risk/decision protocol" },
    { label: "allow kèm reason", chunks: protocolChunks('{"risk":"low","decision":"allow","reason":"x"}'), expected: "does not match the risk/decision protocol" },
    { label: "thành viên lặp", chunks: protocolChunks('{"risk":"low","risk":"low","decision":"allow"}'), expected: "repeats a JSON member" },
    {
      label: "hai khối chữ",
      chunks: [{ type: "text-delta", index: 0, text: ALLOW_LOW }, { type: "text-delta", index: 1, text: ALLOW_LOW }, { type: "finish", reason: { kind: "stop" } }],
      expected: "exactly one text block",
    },
    { label: "kết thúc tool-calls", chunks: protocolChunks(ALLOW_LOW, { kind: "tool-calls" }), expected: "reviewer ended with tool-calls" },
    {
      label: "kết thúc error",
      chunks: protocolChunks(ALLOW_LOW, { kind: "error", failure: { code: "E_BOOM", message: "boom" } }),
      expected: "reviewer ended with error E_BOOM: boom",
    },
    {
      label: "kết thúc aborted",
      chunks: protocolChunks(ALLOW_LOW, { kind: "aborted", failure: { code: "E_STOP", message: "cancelled" } }),
      expected: "reviewer ended with aborted E_STOP: cancelled",
    },
    { label: "không có mốc kết thúc", chunks: protocolChunks(ALLOW_LOW, null), expected: "reviewer emitted no terminal finish" },
    {
      label: "dữ liệu sau mốc kết thúc",
      chunks: [...protocolChunks(ALLOW_LOW), { type: "text-delta", index: 2, text: "late" }],
      expected: "reviewer emitted data after its terminal finish",
    },
  ];

  for (const item of cases) {
    test(`giao thức · ${item.label} ⇒ HAI BÊN cùng kết cục + cùng thông điệp`, async () => {
      const run = await bothWays({ harness: { review: () => streamOf(item.chunks) } });
      expect(run.ours.llmCalls.length).toBe(1);
      expect(run.ourDecision.kind).toBe("deny");
      expect(run.ourDecision.reason).toContain("failed; its body was not executed");
      expect(run.ourDecision.reason).toContain(item.expected);
    });
  }
});
/** Nhật ký của một lượt PTC đang chờ: `run_code` gốc và hai lời gọi con đã bắt đầu. */
function ptcEvents(parentCallId = "call-1"): any[] {
  return [
    { seq: 0, type: "turn/start", data: { turn: 0 } },
    { seq: 1, type: "step/start", data: { turn: 0, step: 0 } },
    { seq: 2, type: "user/message", data: { source: { kind: "user", rpcId: "rpc-1" }, content: [{ type: "text", text: "run a program" }] } },
    {
      seq: 3,
      type: "assistant/message",
      data: { turn: 0, step: 0, message: { content: [{ type: "tool-call", id: "call-1", name: "run_code", arguments: '{"program":"bash()"}' }] } },
    },
    { seq: 4, type: "tool/call", data: { turn: 0, step: 0, callId: "call-1", name: "run_code", arguments: '{"program":"bash()"}' } },
    {
      seq: 5,
      type: "tool/ptc-dispatch-start",
      data: { rootCallId: "call-1", parentCallId, subCallId: "call-1:ptc:1", name: "read_file", arguments: { path: "notes.md" } },
    },
    {
      seq: 6,
      type: "tool/ptc-dispatch-start",
      data: { rootCallId: "call-1", parentCallId, subCallId: "call-1:ptc:2", name: "bash", arguments: { command: "ls" } },
    },
  ];
}

/**
 * Dựng một lời gọi con PTC đang chờ.
 * Nhận: `spec` — callId · arguments · parentCallId · withSchema.
 * Trả: lời gọi giả (agent trỏ phiên PTC).
 */
function ptcExec(spec: any = {}): any {
  const session = makeSession({ events: ptcEvents(spec.parentCallId), nodes: [2, 3] });
  const exec = makeExec({
    session,
    parent: { token: 1 },
    callId: spec.callId ?? "call-1:ptc:2",
    arguments: spec.arguments ?? { command: "ls" },
  });
  if (spec.withSchema !== false) exec.schema = { name: "bash", description: "Run a shell command", parameters: { type: "object" } };
  return exec;
}

/** Nhật ký có một lời gọi HIỂN THỊ (ở BƯỚC TRƯỚC) chưa được ghi nhưng đã có PTC dispatch. */
function unstartedSiblingEvents(): any[] {
  return [
    { seq: 0, type: "turn/start", data: { turn: 0 } },
    { seq: 1, type: "step/start", data: { turn: 0, step: 0 } },
    { seq: 2, type: "user/message", data: { source: { kind: "user", rpcId: "rpc-1" }, content: [{ type: "text", text: "hi" }] } },
    {
      seq: 3,
      type: "assistant/message",
      data: { turn: 0, step: 0, message: { content: [{ type: "tool-call", id: "call-0", name: "read_file", arguments: '{"path":"notes.md"}' }] } },
    },
    {
      seq: 4,
      type: "tool/ptc-dispatch-start",
      data: { rootCallId: "call-1", parentCallId: "call-0", subCallId: "call-0:ptc:1", name: "bash", arguments: { command: "ls" } },
    },
    { seq: 5, type: "step/end", data: { turn: 0, step: 0 } },
    { seq: 6, type: "step/start", data: { turn: 0, step: 1 } },
    {
      seq: 7,
      type: "assistant/message",
      data: { turn: 0, step: 1, message: { content: [{ type: "tool-call", id: "call-1", name: "bash", arguments: '{"command":"ls"}' }] } },
    },
    { seq: 8, type: "tool/call", data: { turn: 0, step: 1, callId: "call-1", name: "bash", arguments: '{"command":"ls"}' } },
  ];
}

/** Nhật ký có một lời gọi HIỂN THỊ đứng TRƯỚC lời gọi đang chờ mà không có bản ghi `tool/call`. */
function missingBeforeRootEvents(): any[] {
  return [
    { seq: 0, type: "turn/start", data: { turn: 0 } },
    { seq: 1, type: "step/start", data: { turn: 0, step: 0 } },
    { seq: 2, type: "user/message", data: { source: { kind: "user", rpcId: "rpc-1" }, content: [{ type: "text", text: "hi" }] } },
    {
      seq: 3,
      type: "assistant/message",
      data: {
        turn: 0,
        step: 0,
        message: {
          content: [
            { type: "tool-call", id: "call-3", name: "bash", arguments: '{"command":"whoami"}' },
            { type: "tool-call", id: "call-1", name: "bash", arguments: '{"command":"ls"}' },
          ],
        },
      },
    },
    { seq: 4, type: "tool/call", data: { turn: 0, step: 0, callId: "call-1", name: "bash", arguments: '{"command":"ls"}' } },
  ];
}

/** Nhật ký của một lời gọi con PTC TÊN `run_code` (bị duyệt như mọi lời gọi con khác). */
function innerRunCodeEvents(): any[] {
  return [
    { seq: 0, type: "turn/start", data: { turn: 0 } },
    { seq: 1, type: "step/start", data: { turn: 0, step: 0 } },
    { seq: 2, type: "user/message", data: { source: { kind: "user", rpcId: "rpc-1" }, content: [{ type: "text", text: "run a program" }] } },
    {
      seq: 3,
      type: "assistant/message",
      data: { turn: 0, step: 0, message: { content: [{ type: "tool-call", id: "call-1", name: "run_code", arguments: '{"program":"bash()"}' }] } },
    },
    { seq: 4, type: "tool/call", data: { turn: 0, step: 0, callId: "call-1", name: "run_code", arguments: '{"program":"bash()"}' } },
    {
      seq: 5,
      type: "tool/ptc-dispatch-start",
      data: { rootCallId: "call-1", parentCallId: "call-1", subCallId: "call-1:ptc:1", name: "run_code", arguments: { program: "nested" } },
    },
  ];
}

describe("row auto-review — ma trận lỗi ẢNH CHỤP (nhật ký/bề mặt hỏng ⇒ CÙNG thông điệp)", () => {
  const cases: Array<{ label: string; build: () => any; expected: string }> = [
    {
      label: "native lệch nhật ký",
      build: () => ({ exec: makeExec({ arguments: { command: "pwd" } }) }),
      expected: "the pending native call disagrees with its logged action",
    },
    {
      label: "header không có schema",
      build: () => ({
        exec: makeExec({ session: makeSession({ requestHeader: () => ({ config: { provider: "deepseek", model: "deepseek-chat" }, tools: [] }) }) }),
      }),
      expected: "the pending native tool schema is missing or ambiguous",
    },
    {
      label: "không có header",
      build: () => ({ exec: makeExec({ session: makeSession({ requestHeader: () => undefined }) }) }),
      expected: "no complete request-header route is available",
    },
    {
      label: "provider rỗng",
      build: () => ({
        exec: makeExec({ session: makeSession({ requestHeader: () => ({ config: { provider: "", model: "deepseek-chat" }, tools: [] }) }) }),
      }),
      expected: "no complete request-header route is available",
    },
    {
      label: "root call không có trong log",
      build: () => ({ exec: makeExec({ rootCallId: "call-9" }) }),
      expected: "the pending root call is missing or ambiguous in the session log",
    },
    {
      label: "bề mặt thiếu message đang chờ",
      build: () => ({ exec: makeExec({ session: makeSession({ nodes: [2] }) }) }),
      expected: "the pending root call is missing from the current surface",
    },
    {
      label: "lời gọi hiện tại thiếu log",
      build: () => ({ exec: makeExec({ session: makeSession({ events: missingBeforeRootEvents(), nodes: [2, 3] }) }) }),
      expected: "a visible call before the pending root is missing from the session log",
    },
    {
      label: "lời gọi chưa start đã có PTC",
      build: () => ({
        exec: makeExec({ session: makeSession({ events: unstartedSiblingEvents(), nodes: [2, 3, 7] }) }),
      }),
      expected: "an unstarted visible call has logged PTC dispatches",
    },
    {
      label: "PTC thiếu mốc start",
      build: () => ({ exec: ptcExec({ callId: "call-1:ptc:9" }) }),
      expected: "the pending PTC call is missing or ambiguous in the session log",
    },
    {
      label: "PTC cha không thấy trên bề mặt",
      build: () => ({ exec: ptcExec({ parentCallId: "call-9" }) }),
      expected: "the pending PTC call disagrees with its logged action",
    },
    {
      label: "PTC thiếu schema bind",
      build: () => ({ exec: ptcExec({ withSchema: false }) }),
      expected: "the pending PTC binding schema is missing or inconsistent",
    },
    {
      label: "PTC lệch tham số",
      build: () => ({ exec: ptcExec({ arguments: { command: "pwd" } }) }),
      expected: "the pending PTC call disagrees with its logged action",
    },
  ];

  for (const item of cases) {
    test(`ảnh chụp · ${item.label} ⇒ HAI BÊN cùng kết cục + cùng thông điệp`, async () => {
      const built = item.build();
      const run = await bothWays({ exec: built.exec });
      expect(run.ours.llmCalls.length).toBe(0);
      expect(run.ourDecision.kind).toBe("deny");
      expect(run.ourDecision.reason).toContain("failed; its body was not executed");
      expect(run.ourDecision.reason).toContain(item.expected);
    });
  }
});

describe("row auto-review — đường BỎ QUA", () => {
  test("agent vắng · run_code NGOÀI CÙNG · preset khác auto ⇒ next() và 0 lời gọi LLM", async () => {
    let nextCalls = 0;
    const counter = async () => {
      nextCalls += 1;
      return { kind: "allow" };
    };

    nextCalls = 0;
    const noAgent = await bothWays({ exec: makeExec({ agent: undefined }), next: counter });
    expect(noAgent.ourDecision).toEqual({ kind: "allow" });
    expect(noAgent.ours.llmCalls.length).toBe(0);
    expect(nextCalls).toBe(2);

    nextCalls = 0;
    const outer = await bothWays({ exec: makeExec({ name: "run_code" }), next: counter });
    expect(outer.ourDecision).toEqual({ kind: "allow" });
    expect(outer.ours.llmCalls.length).toBe(0);
    expect(nextCalls).toBe(2);

    nextCalls = 0;
    const otherPreset = await bothWays({ harness: { preset: "read-only" }, next: counter });
    expect(otherPreset.ourDecision).toEqual({ kind: "allow" });
    expect(otherPreset.ours.llmCalls.length).toBe(0);
    expect(nextCalls).toBe(2);
  });

  test("run_code CÓ parent ⇒ VẪN bị duyệt (chỉ vận chuyển NGOÀI CÙNG được miễn)", async () => {
    const session = makeSession({ events: innerRunCodeEvents(), nodes: [2, 3] });
    const exec = makeExec({
      session,
      name: "run_code",
      arguments: { program: "nested" },
      parent: { token: 1 },
      callId: "call-1:ptc:1",
      schema: { name: "run_code", description: "Run a program", parameters: { type: "object" } },
    });
    const run = await bothWays({ exec });
    expect(run.ours.llmCalls.length).toBe(1);
    expect(run.ourDecision).toEqual({ kind: "allow" });
    const s = sections(run.ours.llmCalls[0].messages[0].content[0].text);
    expect(s.action).toEqual({
      mode: "ptc-inner",
      name: "run_code",
      description: "Run a program",
      parameters: { type: "object" },
      arguments: { program: "nested" },
    });
  });
});

describe("row auto-review — VÒNG ĐỜI", () => {
  test("gỡ tích hợp: chuyển phiên Auto sang Full access, chặn admit, listener sau khi gỡ trả cancel", async () => {
    for (const plugin of [ours, stock]) {
      const autoSession = { id: "auto" };
      const otherSession = { id: "other" };
      const h = makeHarness({ sessions: [autoSession, otherSession] });
      h.presetBySession.set(otherSession, "read-only");
      plugin.apply(h.ctx);
      h.admit(); // chưa gỡ ⇒ cổng đồng ý KHÔNG ném
      expect(h.listeners.length).toBe(1);
      await h.ctx.fiber.dispose();
      expect(h.autoDisposed()).toBe(true);
      expect(h.presetWrites).toEqual([[autoSession, "danger-full-access"]]);
      expect(() => h.admit()).toThrow("auto-review: integration is closing");
      let nextCalls = 0;
      const decision = await h.listeners[0](makeExec(), async () => {
        nextCalls += 1;
        return { kind: "allow" };
      });
      expect(decision).toEqual({ kind: "cancel" });
      expect(nextCalls).toBe(0);
    }
  });

  test("gỡ GIỮA lượt duyệt ⇒ cancel, không treo; waitFor CÓ TRẦN luôn kết thúc", async () => {
    for (const plugin of [ours, stock]) {
      const h = makeHarness({
        review: (request: any) =>
          (async function* () {
            await new Promise<void>((resolve) => {
              if (request.signal?.aborted) return resolve();
              request.signal?.addEventListener("abort", () => resolve(), { once: true });
              // Trần an toàn cho CHÍNH harness: không ai huỷ thì vẫn kết thúc để test không treo.
              setTimeout(resolve, 2000);
            });
            throw new Error("review stream aborted");
          })(),
      });
      plugin.apply(h.ctx);
      const pending = drive(h, makeExec());
      await waitFor(() => h.llmCalls.length === 1, "lượt duyệt bắt đầu", 2000);
      await h.ctx.fiber.dispose();
      expect(await pending).toEqual({ kind: "cancel" });
      expect(h.autoDisposed()).toBe(true);
    }
    const startedAt = Date.now();
    await expect(waitFor(() => false, "điều kiện cố tình sai", 40)).rejects.toThrow("quá trần 40ms");
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });
});

describe("row auto-review — C6: vật thể cấu hình phải ĐỘC LẬP (kiểm bằng DANH TÍNH)", () => {
  test("hai lượt duyệt ⇒ hai vật thể yêu cầu RIÊNG; hai lần mount ⇒ hai vòng đời RIÊNG", async () => {
    const a = makeHarness();
    const b = makeHarness();
    ours.apply(a.ctx);
    ours.apply(b.ctx);
    expect(await drive(b, makeExec())).toEqual({ kind: "allow" });
    expect(await drive(b, makeExec())).toEqual({ kind: "allow" });
    expect(b.llmCalls.length).toBe(2);
    // DANH TÍNH, không phải giá trị: hai yêu cầu KHÔNG được chia sẻ tham chiếu.
    expect(b.llmCalls[0]).not.toBe(b.llmCalls[1]);
    expect(b.llmCalls[0].messages).not.toBe(b.llmCalls[1].messages);
    expect(b.llmCalls[0].messages[0]).not.toBe(b.llmCalls[1].messages[0]);
    expect(Object.isFrozen(b.llmCalls[0])).toBe(true);
    expect(Object.isFrozen(b.llmCalls[1])).toBe(true);
    // Gỡ mount A KHÔNG được lan sang mount B.
    await a.ctx.fiber.dispose();
    expect(a.autoDisposed()).toBe(true);
    expect(b.autoDisposed()).toBe(false);
    b.admit();
    expect(await drive(b, makeExec())).toEqual({ kind: "allow" });
    expect(b.llmCalls.length).toBe(3);
    expect(() => a.admit()).toThrow("auto-review: integration is closing");
    await b.ctx.fiber.dispose();
  });
});

describe("metadata: gbh.peers ⊆ peerDependencies (so PHẦN TỬ) + 000e locale", () => {
  /** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
  interface Manifest {
    /** Tên package. */
    name: string;
    /** Peer contract với trình quản lý gói. */
    peerDependencies?: Record<string, string>;
    /** Phụ thuộc thật (KHÔNG được chứa peer). */
    dependencies?: Record<string, string>;
    /** Metadata của ta. */
    gbh?: { peers?: string[]; row?: unknown; row_unmounted_ly_do?: unknown };
  }

  /**
   * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
   * Nhận: `manifest` — manifest cần kiểm (có thể là bản đã bị sửa để làm ĐỐI CHỨNG ÂM).
   * Trả: các tên thiếu, đã sắp xếp.
   */
  function missingPeers(manifest: Manifest): string[] {
    const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
    return [...(manifest.gbh?.peers ?? [])].filter((peer) => !declared.has(peer)).sort();
  }

  /** Hai peer của ta — đúng bảng §3b: kernel (bậc 1) + seam `llm` (bậc 2, cần CÙNG lớp BlockAssembler). */
  const SEAM_PEERS = ["@deepseek-ai/cordis", "@deepseek-ai/dsh-llm"];

  test("mọi tên trong gbh.peers có mặt trong peerDependencies, có thật trong kernel, KHÔNG nằm ở dependencies", async () => {
    const manifest: Manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    const peers = manifest.gbh?.peers ?? [];
    // Chống verdict RỖNG: xoá sạch gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    expect(missingPeers(manifest)).toEqual([]);
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    expect(peers.filter((peer) => deps.has(peer))).toEqual([]);
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([]);
    for (const peer of peers) {
      expect(typeof manifest.peerDependencies?.[peer]).toBe("string");
      expect(existsSync(join(ROOT, "apps", "host", "node_modules", peer))).toBe(true);
    }
    // `gbh.row` KHÔNG do gói tự khai: nếu có, đó là bản khai của LEAD ở lượt mount và phải
    // trỏ ĐÚNG row này (id + đúng tệp test); dấu hiệu ĐÃ GỠ MOUNT thì không được phép có.
    const row = manifest.gbh?.row as { id?: string; tests?: string[] } | undefined;
    if (row !== undefined) {
      expect(row.id).toBe("auto-review");
      expect(row.tests).toEqual(["tests/host/auto-review.test.ts"]);
    }
    expect(manifest.gbh?.row_unmounted_ly_do).toBeUndefined();
  });

  test("ĐỐI CHỨNG ÂM: xoá-một-tên · xoá-sạch · thừa-tên · cùng-độ-dài-mà-lệch đều bị phép kiểm bắt", async () => {
    const manifest: Manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    const peers = [...(manifest.gbh?.peers ?? [])];
    const victim = peers[0] as string;
    const withoutOne: Manifest = {
      ...manifest,
      peerDependencies: Object.fromEntries(Object.entries(manifest.peerDependencies ?? {}).filter(([name]) => name !== victim)),
    };
    expect(missingPeers(withoutOne)).toEqual([victim]);
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
    const extra: Manifest = { ...manifest, gbh: { peers: [...peers, "@deepseek-ai/khong-ton-tai"] } };
    expect(missingPeers(extra)).toEqual(["@deepseek-ai/khong-ton-tai"]);
    // Phép so SỐ LƯỢNG cho verdict RỖNG (bài học M6 §1d): hai danh sách cùng độ dài mà vẫn lệch phần tử.
    const sameCount: Manifest = {
      name: "@galaxy-blackhole/gbh-gia",
      gbh: { peers: ["@deepseek-ai/a", "@deepseek-ai/z"] },
      peerDependencies: { "@deepseek-ai/a": "1", "@deepseek-ai/b": "1" },
    };
    expect(sameCount.gbh?.peers?.length).toBe(Object.keys(sameCount.peerDependencies ?? {}).length);
    expect(missingPeers(sameCount)).toEqual(["@deepseek-ai/z"]);
  });

  test("000e: locale/en.json + locale/zh.json TRÙNG TỪNG BYTE bản gốc và có trong exports", async () => {
    for (const file of ["en.json", "zh.json"]) {
      const ourBytes = await readFile(join(PKG, "locale", file));
      const stockBytes = await readFile(join(STOCK_DIR, "locale", file));
      expect(ourBytes.equals(stockBytes)).toBe(true);
      expect(ourBytes.length).toBeGreaterThan(0);
    }
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });
});
