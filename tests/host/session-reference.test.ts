/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-session-reference: dựng HAI Context cordis THẬT (mỗi bên một
 *      Context) với seam GIẢ tối thiểu, nạp bản của ta từ ARTIFACT lib/index.js (build.ts → mkdtemp) và
 *      bản gốc @deepseek-ai/dsh-session-reference, rồi so sâu giá trị/lỗi trên cùng fixture.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "session-reference");
/** node_modules của kernel — nơi cả hai bản phân giải peer. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Bundle GỐC (CHỈ ĐỌC) — oracle. */
const STOCK_PATH = join(APP_MODULES, "@deepseek-ai", "dsh-session-reference", "lib", "index.js");
/** cordis của kernel — hai bên dùng CHUNG một lớp Context. */
const CORDIS_PATH = join(APP_MODULES, "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục artifact tạm; dọn ở afterAll. */
const OUT = mkdtempSync(join(tmpdir(), "gbh-session-reference-ab-"));
/*
 * GIÀN ĐO — seam GIẢ (tối thiểu, đúng method resolver GỌI):
 * - sessionQuery: listSessions(signal) + readSurface(id) — fixture trong test.
 * - sessionProjections: snapshot(session, keys) — chỉ trả title/subagent.
 * - sessionProjectionCache: cachedSnapshot(meta, keys) là method THẬT resolver gọi; kèm get/put/evict
 *   theo yêu cầu (resolver không gọi ba method này).
 * - sessions: list() — phiên đang gắn.
 * - spillStore: saveText(input) là seam THẬT; readText(locator) chỉ để kiểm nội dung đã lưu.
 * - llm: resolveModelInfo(provider, model) — chỉ dùng cho ca ngân sách tự động.
 * - agent là object thường { id, session.header.cwd, session.id, options }; systemPrompt không cần vì
 *   listener assemble chỉ đọc variables, và ta đo ngân sách qua agent.options thay vì waterfall.
 * KHÔNG giả: TextRetainer và isCompactCheckpointSource là mô-đun THẬT nạp từ kernel.
 */
/** Bản ghi JSON thô dùng trong fixture. */
type Obj = Record<string, any>;
/** Bề mặt 11 export của cả hai bundle. */
interface Mod {
  MAX_REFERENCES: number;
  DEFAULT_CANDIDATE_LIMIT: number;
  DEFAULT_MAX_REFERENCE_BYTES: number;
  SESSION_REFERENCE_SCHEME: string;
  SessionReferenceError: new (message: string, code: string, options?: ErrorOptions) => Error & { code: string };
  SessionReferenceResolver: new (ctx: any, config?: Obj) => Resolver;
  encodeSessionReferenceUri(sessionId: string): string;
  decodeSessionReferenceUri(uri: string): string;
  formatSessionReferenceMention(reference: { sessionId: string; label?: string }): string;
  parseSessionReferenceText(text: string): { text: string; references: { sessionId: string; label?: string }[] };
  default: unknown;
}
/** Bề mặt resolver mà test gọi. */
interface Resolver {
  listCandidates(agent: Obj, query?: string, limit?: number, signal?: AbortSignal): Promise<Obj[]>;
  remoteExportCandidates(agent: Obj, query: string, signal: AbortSignal): Promise<Obj[]>;
  prepare(agent: Obj, content: Obj[], references: Obj[], signal?: AbortSignal): Promise<Obj>;
}
/** Kết quả chạy một phép (thành công hoặc ném). */
type Attempt = { ok: true; value: unknown } | { ok: false; error: unknown };
/** Hai bản nạp trong beforeAll. */
let stockMod: Mod;
/** Bản của ta. */
let oursMod: Mod;
/** Lớp Context của kernel. */
let ContextCtor: new () => any;
beforeAll(async () => {
  const { buildPackage } = (await import(join(PKG, "build.ts"))) as { buildPackage(outDir?: string): Promise<string | { service: string }> };
  const built = await buildPackage(OUT);
  const artifact = typeof built === "string" ? built : built.service;
  symlinkSync(APP_MODULES, join(OUT, "node_modules"), "dir");
  stockMod = (await import(STOCK_PATH)) as Mod;
  oursMod = (await import(pathToFileURL(artifact).href)) as Mod;
  ContextCtor = ((await import(CORDIS_PATH)) as { Context: new () => any }).Context;
});
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
/** Chạy một phép, bắt lỗi. */
async function attempt(fn: () => unknown | Promise<unknown>): Promise<Attempt> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error };
  }
}
/** Chạy CẢ stock lẫn ours trên cùng callback, so sâu và trả hai kết quả thô. */
async function same(fn: (mod: Mod) => unknown | Promise<unknown>): Promise<{ stock: Attempt; ours: Attempt }> {
  const stock = await attempt(() => fn(stockMod));
  const ours = await attempt(() => fn(oursMod));
  expect(resultShape(ours)).toEqual(resultShape(stock));
  return { stock, ours };
}
/** Đòi kết quả thành công và trả giá trị. */
function valueOf(result: Attempt): Obj {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected success");
  return result.value as Obj;
}
/** Sự thật về một lỗi, kèm instanceof theo ĐÚNG lớp của bên đang chạy. */
function errorFacts(error: unknown, mod: Mod): Obj {
  const value = error as Error & { code?: string; cause?: unknown };
  return {
    isError: value instanceof Error,
    isSessionReferenceError: value instanceof mod.SessionReferenceError,
    name: value.name,
    message: value.message,
    code: value.code,
    cause: value.cause === undefined ? null : errorShape(value.cause),
  };
}
/** Đòi một Attempt là SessionReferenceError (và mã nếu có). */
function assertReferenceError(result: Attempt, mod: Mod, code?: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  const facts = errorFacts(result.error, mod);
  expect(facts.isError).toBe(true);
  expect(facts.isSessionReferenceError).toBe(true);
  expect(facts.name).toBe("SessionReferenceError");
  if (code !== undefined) expect(facts.code).toBe(code);
}
/** Header phiên; cwd null nghĩa là KHÔNG ghi nhận. */
function header(id: string, cwd: string | null, createdAt = 1_700_000_000_000, version = 4): Obj {
  return { id, version, createdAt, isSeeded: false, ...(cwd === null ? {} : { cwd }) };
}
/** Bản ghi liệt kê phiên. */
function record(id: string, cwd: string | undefined, createdAt: number): Obj {
  return { header: { ...header(id, cwd === undefined ? null : cwd, createdAt) }, live: createdAt % 2 === 0, persisted: true };
}
/** Sự kiện user/message. */
function userEvent(seq: number, content: any, source: Obj = { kind: "user" }): Obj {
  return {
    type: "user/message",
    seq,
    time: seq,
    surfaceOp: "append",
    data: {
      role: "user",
      id: `user-${seq}`,
      source,
      content: typeof content === "string" ? [{ type: "text", text: content }] : content,
    },
  };
}
/** Sự kiện assistant/message. */
function assistantEvent(seq: number, content: any): Obj {
  return {
    type: "assistant/message",
    seq,
    time: seq,
    surfaceOp: "append",
    data: {
      turn: 1,
      step: 1,
      message: {
        role: "assistant",
        id: `assistant-${seq}`,
        source: { kind: "model" },
        content: typeof content === "string" ? [{ type: "text", text: content }] : content,
      },
      stream: [],
    },
  };
}
/** Ảnh chụp bề mặt phiên. */
function makeSnapshot(options: Obj = {}): Obj {
  const events = options.events ?? [userEvent(1, "hello"), assistantEvent(2, "hi")];
  return {
    session: header(options.id ?? "source-session", options.cwd === undefined ? "/work" : options.cwd, 1_700_000_000_000, options.version ?? 4),
    inheritedEventCount: 0,
    capturedThroughSeq: options.capturedThroughSeq ?? (events.length === 0 ? null : events[events.length - 1].seq),
    events,
  };
}
/** Agent giả; session.id khác agent.id để kiểm owner spill. */
function makeAgent(options: Obj = {}): Obj {
  const id = options.id ?? "self";
  return {
    id,
    session: {
      id: options.sessionId ?? `${id}-session`,
      header: { cwd: options.cwd === undefined ? "/work" : options.cwd },
    },
    options: options.options ?? {},
  };
}
/** Kho spill giả: saveText ghi vết; readText đọc lại nội dung đã lưu. */
function makeSpill(mode: "ok" | "absent" | "fail", ref?: Obj): Obj {
  const saves: Obj[] = [];
  const stored = new Map<string, string>();
  return {
    saves,
    async saveText(input: Obj): Promise<Obj> {
      saves.push(structuredClone(input));
      if (mode === "fail") throw new Error("spill disk full");
      const saved = ref ?? {
        locator: `spill://ref-${saves.length}`,
        bytes: Buffer.byteLength(input.content, "utf8"),
        hint: "Read the full snapshot",
      };
      stored.set(saved.locator, input.content);
      return structuredClone(saved);
    },
    readText(locator: string): string | undefined {
      return stored.get(locator);
    },
  };
}
/** Bộ nhớ đệm chiếu giả: cachedSnapshot là method resolver gọi; get/put/evict có mặt theo seam. */
function makeCache(rows: Obj): Obj {
  const map = new Map<string, Obj>(Object.entries(rows));
  return {
    get(meta: Obj): Obj | undefined {
      return map.get(meta.id);
    },
    put(meta: Obj, value: Obj): void {
      map.set(meta.id, value);
    },
    evict(meta: Obj): void {
      map.delete(meta.id);
    },
    cachedSnapshot(meta: Obj): Obj | undefined {
      return map.get(meta.id);
    },
  };
}
/** Giàn đo của MỘT bên. */
interface Harness {
  /** Module đang chạy. */
  mod: Mod;
  /** Context cordis thật. */
  ctx: any;
  /** Resolver đã đăng ký. */
  service: Resolver;
  /** Seam truy vấn. */
  query: Obj;
  /** Vết gọi seam. */
  queryCalls: { list: number; read: string[] };
  /** Kho spill giả. */
  spill: Obj;
  /** Bộ nhớ đệm chiếu giả (nếu có). */
  cache?: Obj;
  /** Sổ chiếu giả (nếu có). */
  projections?: Obj;
  /** Sổ phiên giả (nếu có). */
  sessions?: Obj;
  /** Số lần gọi llm. */
  llmCalls: () => number;
}
/** Dựng Context thật + seam giả + resolver của một bên. */
function makeHarness(mod: Mod, fixture: Obj = {}, config: Obj = {}): Harness {
  const ctx: any = new ContextCtor();
  const queryCalls = { list: 0, read: [] as string[] };
  const snapshots = fixture.snapshots ?? {};
  const query = {
    async listSessions(_signal?: AbortSignal): Promise<Obj[]> {
      queryCalls.list += 1;
      return structuredClone(fixture.records ?? []);
    },
    async readSurface(id: string): Promise<Obj> {
      queryCalls.read.push(id);
      const snapshot = snapshots[id];
      if (snapshot === undefined) throw new Error(`missing session ${id}`);
      return structuredClone(snapshot);
    },
  };
  ctx.provide("sessionQuery", query);
  let sessions: Obj | undefined;
  if (fixture.attached !== undefined) {
    sessions = { list: (): Obj[] => structuredClone(fixture.attached) };
    ctx.provide("sessions", sessions);
  }
  let projections: Obj | undefined;
  if (fixture.projectionSnapshots !== undefined) {
    projections = {
      snapshot: (session: Obj): Obj | undefined => structuredClone(fixture.projectionSnapshots[session.id]),
    };
    ctx.provide("sessionProjections", projections);
  }
  let cache: Obj | undefined;
  if (fixture.cacheSnapshots !== undefined) {
    cache = makeCache(fixture.cacheSnapshots);
    ctx.provide("sessionProjectionCache", cache);
  }
  const spill = makeSpill(fixture.spill ?? "ok", fixture.spillRef);
  if ((fixture.spill ?? "ok") !== "absent") ctx.provide("spillStore", spill);
  let llmCalls = 0;
  if (fixture.llm !== undefined) {
    ctx.provide("llm", {
      async resolveModelInfo(provider: string, model: string): Promise<Obj> {
        llmCalls += 1;
        if (fixture.llm.error !== undefined) throw fixture.llm.error;
        return {
          provider,
          id: model,
          name: model,
          ...(fixture.llm.contextWindow === undefined ? {} : { context: { contextWindow: fixture.llm.contextWindow } }),
        };
      },
    });
  }
  const service = new mod.SessionReferenceResolver(ctx, config);
  return { mod, ctx, service, query, queryCalls, spill, cache, projections, sessions, llmCalls: () => llmCalls };
}
/** Dạng so sánh của kết quả prepare; bỏ id ngẫu nhiên của createUserMessage. */
function preparedView(value: Obj): Obj {
  const context = value?.additionalContext;
  return {
    content: value?.content,
    hasAdditionalContext: context !== undefined,
    role: context?.role,
    source: context?.source,
    prompt: context?.content?.[0]?.text,
  };
}
/** Chạy prepare trên một bên và trả cả harness để kiểm spill/query. */
async function prepareSide(mod: Mod, fixture: Obj, config: Obj, references: Obj[], options: Obj = {}): Promise<{ view: Obj; harness: Harness }> {
  const harness = makeHarness(mod, fixture, config);
  const agent = options.agent ?? makeAgent(options.agentOptions ?? {});
  const content = options.content ?? [{ type: "text", text: "x" }];
  const value = await harness.service.prepare(agent, content, references, options.signal);
  return { view: preparedView(value), harness };
}
/** Dữ liệu JSON nằm giữa phong bì referenced-sessions. */
function envelopeData(prompt: string): string {
  const open = "<referenced-sessions>\n";
  const close = "\n</referenced-sessions>";
  const start = prompt.indexOf(open);
  const end = prompt.indexOf(close);
  if (start < 0 || end < 0) throw new Error("missing referenced-sessions envelope");
  return prompt.slice(start + open.length, end);
}
/** Hội thoại đã chiếu từ prompt. */
function conversationOf(view: Obj): Obj[] {
  return JSON.parse(envelopeData(String(view.prompt ?? "")))[0]?.conversation ?? [];
}
/** Prompt của một view. */
function promptOf(view: Obj): string {
  return String(view.prompt ?? "");
}
/** Byte của MỘT đối tượng dữ liệu (bỏ wrapper mảng của phong bì) — đúng thước retain dùng. */
function sourceDataBytes(view: Obj): number {
  const data = JSON.parse(envelopeData(promptOf(view))) as Obj[];
  return Buffer.byteLength(JSON.stringify(data[0]).replaceAll("<", "\\u003c"), "utf8");
}
describe("uri — encode/decode/mention/parse ...", () => {
  test("1. encode/decode roundtrip giữ nguyên id lạ", async () => {
    const ids = ["", "plain-id", "a/b?c=d#e", "ngôn ngữ 😀", "</tag>", "x".repeat(300)];
    const { stock } = await same((mod) => ({
      scheme: mod.SESSION_REFERENCE_SCHEME,
      rows: ids.map((id) => {
        const uri = mod.encodeSessionReferenceUri(id);
        return { id, uri, decoded: mod.decodeSessionReferenceUri(uri) };
      }),
    }));
    const value = valueOf(stock);
    expect(value.scheme).toBe("dsh-session:");
    for (const row of value.rows as Obj[]) {
      expect(row.decoded).toBe(row.id);
      expect(String(row.uri).startsWith("dsh-session:")).toBe(true);
    }
  });
  test("2. decode từ chối sai scheme/payload hỏng/không chuẩn", async () => {
    const bad = [
      "http://x",
      "dsh-session:",
      "dsh-session:%%%%",
      "dsh-session:abc",
      `dsh-session:${Buffer.from(' "x"').toString("base64url")}`,
      `dsh-session:${Buffer.from("123").toString("base64url")}`,
    ];
    const { stock } = await same((mod) =>
      bad.map((uri) => {
        try {
          return { uri, ok: true, decoded: mod.decodeSessionReferenceUri(uri) };
        } catch (error) {
          return { uri, ok: false, facts: errorFacts(error, mod) };
        }
      }),
    );
    for (const row of valueOf(stock) as unknown as Obj[]) {
      expect(row.ok).toBe(false);
      expect((row.facts as Obj).isSessionReferenceError).toBe(true);
      expect((row.facts as Obj).code).toBe("SESSION_REFERENCE_INVALID_REFERENCE");
    }
  });

  test("3. formatSessionReferenceMention escape nhãn rồi parse roundtrip", async () => {
    const labels = [undefined, "", "]", "\\", "a]b\\c", "a)b", "nhãn <đặc>", "line\nbreak", "😀]\\"];
    const { stock } = await same((mod) =>
      labels.map((label) => {
        const reference = label === undefined ? { sessionId: "id/with space" } : { sessionId: "id/with space", label };
        const mention = mod.formatSessionReferenceMention(reference);
        return { label: label ?? null, mention, parsed: mod.parseSessionReferenceText(mention) };
      }),
    );
    for (const row of valueOf(stock) as unknown as Obj[]) {
      const expected = row.label ?? "id/with space";
      expect(row.parsed.references.length).toBe(1);
      expect(row.parsed.references[0].label).toBe(expected);
      expect(row.parsed.text).toBe(`@${expected}`);
    }
  });

  test("4. parseSessionReferenceText: văn bản KHÔNG có tham chiếu", async () => {
    const { stock } = await same((mod) => mod.parseSessionReferenceText("plain text, no dsh here"));
    const value = valueOf(stock);
    expect(value.text).toBe("plain text, no dsh here");
    expect(value.references).toEqual([]);
  });

  test("5. parseSessionReferenceText: một mention Markdown + một URI trần", async () => {
    const { stock } = await same((mod) => {
      const uri = mod.encodeSessionReferenceUri("sess-1");
      return {
        markdown: mod.parseSessionReferenceText(`see @[One](${uri}) now`),
        bare: mod.parseSessionReferenceText(`see ${uri} now`),
      };
    });
    const value = valueOf(stock);
    expect(value.markdown.text).toBe("see @One now");
    expect(value.markdown.references).toEqual([{ sessionId: "sess-1", label: "One" }]);
    expect(value.bare.text).toBe("see @sess-1 now");
    expect(value.bare.references).toEqual([{ sessionId: "sess-1", label: "sess-1" }]);
  });

  test("6. parseSessionReferenceText: nhiều tham chiếu lẫn văn bản, giữ thứ tự", async () => {
    const { stock } = await same((mod) => {
      const first = mod.encodeSessionReferenceUri("s1");
      const second = mod.encodeSessionReferenceUri("s2");
      return mod.parseSessionReferenceText(`before @[One](${first}) middle ${second} after @[Two](${second})`);
    });
    const value = valueOf(stock);
    expect(value.text).toBe("before @One middle @s2 after @Two");
    expect(value.references.map((reference: Obj) => reference.sessionId)).toEqual(["s1", "s2", "s2"]);
  });

  test("7. parseSessionReferenceText: escape/unescape nhãn đặc biệt", async () => {
    const labels = ["a]b", "a\\b", "a]\\b", "a[b]c", "nhãn\nđặc", "😀]\\"];
    const { stock } = await same((mod) =>
      labels.map((label) => {
        const mention = mod.formatSessionReferenceMention({ sessionId: "s", label });
        return { label, mention, parsed: mod.parseSessionReferenceText(mention) };
      }),
    );
    for (const row of valueOf(stock) as unknown as Obj[]) {
      expect(row.parsed.references.length).toBe(1);
      expect(row.parsed.references[0].label).toBe(row.label);
      expect(row.parsed.text).toBe(`@${row.label}`);
    }
  });
});
describe("config — hằng số và lỗi", () => {
  test("8. 4 hằng + scheme + export default khớp stock", async () => {
    const { stock } = await same((mod) => ({
      scheme: mod.SESSION_REFERENCE_SCHEME,
      maxReferences: mod.MAX_REFERENCES,
      candidateLimit: mod.DEFAULT_CANDIDATE_LIMIT,
      maxBytes: mod.DEFAULT_MAX_REFERENCE_BYTES,
      errorName: mod.SessionReferenceError.name,
      defaultIsResolver: mod.default === mod.SessionReferenceResolver,
    }));
    const value = valueOf(stock);
    expect(value.scheme).toBe("dsh-session:");
    expect(value.maxReferences).toBe(3);
    expect(value.candidateLimit).toBe(50);
    expect(value.maxBytes).toBe(65_536);
    expect(value.errorName).toBe("SessionReferenceError");
    expect(value.defaultIsResolver).toBe(true);
  });

  test("9. SessionReferenceError: instanceof/name/message/code/cause", async () => {
    const { stock } = await same((mod) => {
      const cause = new TypeError("gốc");
      const error = new mod.SessionReferenceError("hỏng", "SESSION_REFERENCE_TOO_MANY", { cause });
      return {
        isError: error instanceof Error,
        isSessionReferenceError: error instanceof mod.SessionReferenceError,
        name: error.name,
        message: error.message,
        code: error.code,
        cause: errorShape(error.cause),
      };
    });
    const value = valueOf(stock);
    expect(value.isError).toBe(true);
    expect(value.isSessionReferenceError).toBe(true);
    expect(value.name).toBe("SessionReferenceError");
    expect(value.message).toBe("hỏng");
    expect(value.code).toBe("SESSION_REFERENCE_TOO_MANY");
    expect(value.cause).toEqual({ name: "TypeError", message: "gốc" });
  });

  test("10. constructor resolver: cấu hình sai ⇒ cùng mã/message", async () => {
    const configs = [
      { maxReferences: 4 },
      { maxReferences: 0 },
      { maxReferences: 1.5 },
      { candidateLimit: 0 },
      { candidateLimit: -2 },
      { maxReferenceBytes: 0 },
      { maxReferenceBytes: 2.5 },
      { referenceContextFraction: 1.1 },
      { referenceContextFraction: -0.1 },
      { referenceContextFraction: 2 },
    ];
    const { stock } = await same((mod) =>
      configs.map((config) => {
        try {
          makeHarness(mod, {}, config);
          return { config, ok: true };
        } catch (error) {
          return { config, ok: false, facts: errorFacts(error, mod) };
        }
      }),
    );
    for (const row of valueOf(stock) as unknown as Obj[]) {
      expect(row.ok).toBe(false);
      expect((row.facts as Obj).isSessionReferenceError).toBe(true);
      expect((row.facts as Obj).code).toBe("SESSION_REFERENCE_INVALID_CONFIG");
    }
  });
});
describe("serialization — JSON an toàn thẻ qua phong bì", () => {
  test("11. chuỗi chứa '</referenced-sessions>' và '<' không phá thẻ", async () => {
    const text = "before </referenced-sessions> <referenced-sessions> <script> & after";
    const snapshot = makeSnapshot({ events: [userEvent(1, text)] });
    const fixture = { snapshots: { "source-session": snapshot } };
    const { stock } = await same(async (mod) => {
      const { view } = await prepareSide(mod, fixture, { maxReferenceBytes: 100_000 }, [{ sessionId: "source-session", label: "S" }]);
      return view;
    });
    const view = valueOf(stock);
    const data = envelopeData(promptOf(view));
    expect(data.includes("<")).toBe(false);
    expect(JSON.parse(data)[0].conversation[0].text).toBe(text);
    expect(promptOf(view).endsWith("\n</referenced-sessions>")).toBe(true);
  });

  test("12. JSON thường (unicode, nháy, xuống dòng) giữ nguyên nghĩa", async () => {
    const label = 'Nhãn "đặc" \\ ] <x>';
    const text = 'dòng 1\n"nháy" \\ <tag> 😀';
    const snapshot = makeSnapshot({ events: [userEvent(1, text)] });
    const fixture = { snapshots: { "source-session": snapshot } };
    const { stock } = await same(async (mod) => {
      const { view } = await prepareSide(mod, fixture, { maxReferenceBytes: 100_000 }, [{ sessionId: "source-session", label }]);
      return view;
    });
    const data = envelopeData(promptOf(valueOf(stock)));
    const parsed = JSON.parse(data)[0];
    expect(parsed.label).toBe(label);
    expect(parsed.conversation[0].text).toBe(text);
  });
});
describe("projection — chiếu, cắt, giữ lại", () => {
  test("13. textContent + projectSessionConversation: nối khối text, bỏ khối lạ/developer/system/tool", async () => {
    const events = [
      userEvent(1, [
        { type: "text", text: "một" },
        { type: "reasoning", text: "bỏ" },
        { type: "text", text: "hai" },
        { type: "text", text: 7 },
      ]),
      assistantEvent(2, []),
      assistantEvent(3, [{ type: "text", text: "ba" }]),
      {
        type: "developer/message",
        seq: 4,
        time: 4,
        surfaceOp: "append",
        data: { message: { role: "developer", id: "d", source: { kind: "system-prompt" }, content: [{ type: "text", text: "dev" }] } },
      },
      {
        type: "system/message",
        seq: 5,
        time: 5,
        surfaceOp: "append",
        data: { message: { role: "system", id: "s", source: { kind: "system-prompt" }, content: [{ type: "text", text: "sys" }] } },
      },
      {
        type: "tool/result",
        seq: 6,
        time: 6,
        surfaceOp: "append",
        data: { message: { role: "tool", id: "t", source: { kind: "tool" }, toolCallId: "c", content: [{ type: "text", text: "tool" }] } },
      },
    ];
    const snapshot = makeSnapshot({ events });
    const fixture = { snapshots: { "source-session": snapshot } };
    const { stock } = await same(async (mod) => {
      const { view } = await prepareSide(mod, fixture, { maxReferenceBytes: 100_000 }, [{ sessionId: "source-session", label: "S" }]);
      return view;
    });
    const view = valueOf(stock);
    expect(conversationOf(view)).toEqual([
      { role: "user", text: "một\nhai" },
      { role: "assistant", text: "ba" },
    ]);
    expect(view.source.references[0].originalMessages).toBe(2);
  });

  test("14. chỉ user trực tiếp + checkpoint nén; context tiêm bị lọc", async () => {
    const events = [
      userEvent(1, "direct", { kind: "user" }),
      userEvent(2, "injected", { kind: "system-prompt" }),
      userEvent(3, "summary", { kind: "compact-checkpoint", compactionId: "c1" }),
      userEvent(4, "tool-source", { kind: "tool" }),
      assistantEvent(5, "answer"),
    ];
    const snapshot = makeSnapshot({ events });
    const fixture = { snapshots: { "source-session": snapshot } };
    const { stock } = await same(async (mod) => {
      const { view } = await prepareSide(mod, fixture, { maxReferenceBytes: 100_000 }, [{ sessionId: "source-session" }]);
      return view;
    });
    const view = valueOf(stock);
    expect(conversationOf(view)).toEqual([
      { role: "user", text: "direct" },
      { role: "user", text: "summary" },
      { role: "assistant", text: "answer" },
    ]);
    expect(view.source.references[0].compacted).toBe(true);
  });

  test("15. truncateWithNotice: dưới ngưỡng giữ nguyên văn, không spill", async () => {
    const snapshot = makeSnapshot({ events: [userEvent(1, "y".repeat(200))] });
    const fixture = { snapshots: { "source-session": snapshot } };
    const { stock } = await same(async (mod) => {
      const { view, harness } = await prepareSide(mod, fixture, { maxReferenceBytes: 100_000 }, [{ sessionId: "source-session" }]);
      return { view, saves: harness.spill.saves.length, reads: harness.queryCalls.read };
    });
    const run = valueOf(stock);
    expect(run.view.source.references[0].truncated).toBe(false);
    expect(run.saves).toBe(0);
    expect(promptOf(run.view).includes("## Reference omissions")).toBe(false);
  });

  test("16. truncateWithNotice: đúng biên byte KHÔNG cắt, biên-1 thì cắt", async () => {
    const snapshot = makeSnapshot({ events: [userEvent(1, "z".repeat(300))] });
    const fixture = { snapshots: { "source-session": snapshot } };
    const references = [{ sessionId: "source-session" }];
    const baseRun = await same(async (mod) => (await prepareSide(mod, fixture, { maxReferenceBytes: 1_000_000 }, references)).view);
    const base = valueOf(baseRun.stock);
    expect(base.source.references[0].truncated).toBe(false);
    const exact = sourceDataBytes(base);
    const atRun = await same(async (mod) => (await prepareSide(mod, fixture, { maxReferenceBytes: exact }, references)).view);
    const belowRun = await same(async (mod) => (await prepareSide(mod, fixture, { maxReferenceBytes: exact - 1 }, references)).view);
    const at = valueOf(atRun.stock);
    const below = valueOf(belowRun.stock);
    expect(at.source.references[0].truncated).toBe(false);
    expect(below.source.references[0].truncated).toBe(true);
    expect(below.source.references[0].omittedMessages).toBe(0);
    expect(below.source.references[0].omittedBytes).toBeGreaterThan(0);
    expect(promptOf(below)).toContain("[… omitted");
  });

  test("17. retainReferencedSession: snapshot lớn bỏ tin cũ + cắt tin dài, notice omission", async () => {
    const events = [userEvent(1, "old-one"), userEvent(2, "old-two"), assistantEvent(3, "a".repeat(2_000))];
    const snapshot = makeSnapshot({ events });
    const fixture = { snapshots: { "source-session": snapshot } };
    const { stock } = await same(async (mod) => {
      const { view, harness } = await prepareSide(mod, fixture, { maxReferenceBytes: 700 }, [{ sessionId: "source-session", label: "S" }]);
      return { view, saves: harness.spill.saves.length };
    });
    const run = valueOf(stock);
    const reference = run.view.source.references[0];
    expect(reference.truncated).toBe(true);
    expect(reference.omittedMessages).toBeGreaterThanOrEqual(2);
    expect(reference.retainedMessages).toBe(1);
    expect(reference.omittedBytes).toBeGreaterThan(0);
    expect(promptOf(run.view)).toContain("## Reference omissions");
    expect(run.saves).toBe(1);
  });
});
describe("spill — omission và transcript", () => {
  test("18. preview cắt + KHÔNG có store ⇒ unavailable storage-not-configured", async () => {
    const snapshot = makeSnapshot({ events: [userEvent(1, "q".repeat(2_000))] });
    const fixture = { snapshots: { "source-session": snapshot }, spill: "absent" };
    const { stock } = await same(async (mod) => {
      const { view, harness } = await prepareSide(mod, fixture, { maxReferenceBytes: 700 }, [{ sessionId: "source-session" }]);
      return { view, saves: harness.spill.saves.length };
    });
    const run = valueOf(stock);
    expect(run.view.source.references[0].truncated).toBe(true);
    expect(promptOf(run.view)).toContain('"status":"unavailable"');
    expect(promptOf(run.view)).toContain('"reason":"storage-not-configured"');
    expect(run.saves).toBe(0);
  });

  test("19. store có ⇒ owner/source/suggestedName/content + fullSnapshot saved", async () => {
    const fixture = {
      snapshots: {
        a: makeSnapshot({ id: "a", events: [userEvent(1, "a".repeat(2_000))] }),
        b: makeSnapshot({ id: "b", events: [userEvent(1, "b".repeat(2_000))] }),
      },
    };
    const references = [
      { sessionId: "a", label: "A" },
      { sessionId: "b", label: "B" },
    ];
    const { stock } = await same(async (mod) => {
      const { view, harness } = await prepareSide(mod, fixture, { maxReferenceBytes: 700 }, references, {
        agent: makeAgent({ sessionId: "owner-session" }),
      });
      return { view, saves: harness.spill.saves };
    });
    const run = valueOf(stock);
    const refs = run.view.source.references;
    expect(refs.length).toBe(2);
    expect(refs.map((reference: Obj) => reference.inputIndex)).toEqual([0, 1]);
    const saves = run.saves as Obj[];
    expect(saves.length).toBe(2);
    expect(saves[0]!.owner).toEqual({ sessionId: "owner-session" });
    expect(saves[0]!.source).toEqual({ kind: "session-reference", sessionId: "a", label: "A" });
    expect(saves[0]!.suggestedName).toBe("session-reference-1.txt");
    expect(saves[1]!.suggestedName).toBe("session-reference-2.txt");
    expect(saves[0]!.content).toContain("## Referenced session — full projected snapshot");
    expect(promptOf(run.view)).toContain('"status":"saved"');
  });

  test("20. saveText ném ⇒ save-failed, prompt vẫn dựng", async () => {
    const snapshot = makeSnapshot({ events: [userEvent(1, "f".repeat(2_000))] });
    const fixture = { snapshots: { "source-session": snapshot }, spill: "fail" };
    const { stock } = await same(async (mod) => {
      const { view, harness } = await prepareSide(mod, fixture, { maxReferenceBytes: 700 }, [{ sessionId: "source-session" }]);
      return { view, saves: harness.spill.saves.length };
    });
    const run = valueOf(stock);
    expect(run.view.source.references[0].truncated).toBe(true);
    expect(promptOf(run.view)).toContain('"reason":"save-failed"');
    expect(run.saves).toBe(1);
  });

  test("21. renderTranscript: formatVersion 1/2/khác + mảnh 64 code point", async () => {
    const text = "A".repeat(2_000) + "\n😀" + "B".repeat(40);
    for (const version of [1, 2, 99]) {
      const snapshot = makeSnapshot({ version, events: [userEvent(1, text), assistantEvent(2, "short")] });
      const fixture = { snapshots: { "source-session": snapshot } };
      const { stock } = await same(async (mod) => {
        const { view, harness } = await prepareSide(mod, fixture, { maxReferenceBytes: 700 }, [{ sessionId: "source-session", label: "S" }]);
        return { view, saves: harness.spill.saves };
      });
      const run = valueOf(stock);
      const saves = run.saves as Obj[];
      expect(saves.length).toBe(1);
      const content = String(saves[0]!.content);
      expect(content).toContain(`"capturedFormatVersion": ${version}`);
      expect(content).toContain("### Message 1: user");
      expect(content).toContain("### Message 2: assistant");
      const fragments = content.split("\n").filter((line) => line.startsWith('"'));
      for (const fragment of fragments) {
        const decoded = JSON.parse(fragment);
        expect(typeof decoded).toBe("string");
        expect(Array.from(decoded as string).length).toBeLessThanOrEqual(64);
      }
      expect(fragments.map((fragment) => JSON.parse(fragment)).join("")).toBe(text + "short");
    }
  });
});
describe("resolver — candidates/resolve trên harness giả", () => {
  test("22. listCandidates: loại self, xếp hạng cwd, title/subagent/cache fallback", async () => {
    const fixture = {
      records: [
        record("self", "/work", 1),
        record("same-attached", "/work", 2),
        record("cold-same", undefined, 3),
        record("other-cwd", "/other", 4),
        record("cold-title", undefined, 5),
        record("attached-untitled", "/work", 6),
      ],
      attached: [{ id: "self" }, { id: "same-attached" }, { id: "attached-untitled" }],
      projectionSnapshots: {
        "same-attached": { asOfSeq: 1, values: { title: "Same title", subagent: { label: "Same sub" } } },
        "attached-untitled": { asOfSeq: 1, values: {} },
      },
      cacheSnapshots: {
        "cold-same": { asOfSeq: 1, values: { title: "Cold same title" } },
        "cold-title": { asOfSeq: 1, values: { title: "Cold title", subagent: { label: "Cold sub" } } },
        "other-cwd": { asOfSeq: 1, values: { title: "Other title" } },
      },
    };
    const { stock } = await same((mod) => makeHarness(mod, fixture).service.listCandidates(makeAgent()));
    expect(valueOf(stock)).toEqual([
      { sessionId: "same-attached", label: "Same title", displayTitle: "Same sub", cwd: "/work", sameWorkspace: true, createdAt: 2 },
      { sessionId: "attached-untitled", label: "attached-untitled", displayTitle: "attached-untitled", cwd: "/work", sameWorkspace: true, createdAt: 6 },
      { sessionId: "cold-same", label: "Cold same title", displayTitle: "Cold same title", sameWorkspace: false, createdAt: 3 },
      { sessionId: "cold-title", label: "Cold title", displayTitle: "Cold sub", sameWorkspace: false, createdAt: 5 },
      { sessionId: "other-cwd", label: "Other title", displayTitle: "Other title", cwd: "/other", sameWorkspace: false, createdAt: 4 },
    ]);
  });

  test("23. listCandidates: query không phân biệt hoa thường + limit + query cwd", async () => {
    const fixture = {
      records: [
        record("self", "/work", 1),
        record("same-attached", "/work", 2),
        record("cold-same", undefined, 3),
        record("other-cwd", "/other", 4),
        record("cold-title", undefined, 5),
        record("attached-untitled", "/work", 6),
      ],
      attached: [{ id: "self" }, { id: "same-attached" }, { id: "attached-untitled" }],
      projectionSnapshots: { "same-attached": { values: { title: "Same title" } }, "attached-untitled": { values: {} } },
      cacheSnapshots: {
        "cold-same": { values: { title: "Cold same title" } },
        "cold-title": { values: { title: "Cold title" } },
        "other-cwd": { values: { title: "Other title" } },
      },
    };
    const { stock } = await same(async (mod) => {
      const harness = makeHarness(mod, fixture);
      return {
        title: await harness.service.listCandidates(makeAgent(), "TITLE"),
        limit: await harness.service.listCandidates(makeAgent(), "", 2),
        cwd: await harness.service.listCandidates(makeAgent(), "other"),
      };
    });
    const value = valueOf(stock);
    expect(value.title.map((candidate: Obj) => candidate.sessionId)).toEqual(["same-attached", "attached-untitled", "cold-same", "cold-title", "other-cwd"]);
    expect(value.limit.map((candidate: Obj) => candidate.sessionId)).toEqual(["same-attached", "attached-untitled"]);
    expect(value.cwd.map((candidate: Obj) => candidate.sessionId)).toEqual(["other-cwd"]);
  });

  test("24. listCandidates: limit không phải số nguyên dương ⇒ cùng lỗi", async () => {
    const fixture = { records: [record("other", "/work", 2)] };
    const limits = [0, -1, 1.5, Number.NaN];
    const { stock } = await same(async (mod) =>
      Promise.all(
        limits.map(async (limit) => {
          try {
            await makeHarness(mod, fixture).service.listCandidates(makeAgent(), "", limit);
            return { limit: String(limit), ok: true };
          } catch (error) {
            return { limit: String(limit), ok: false, facts: errorFacts(error, mod) };
          }
        }),
      ),
    );
    for (const row of valueOf(stock) as unknown as Obj[]) {
      expect(row.ok).toBe(false);
      expect((row.facts as Obj).code).toBe("SESSION_REFERENCE_INVALID_REFERENCE");
    }
  });

  test("25. remoteExportCandidates: mention canonical + escape nhãn", async () => {
    const fixture = {
      records: [record("self", "/work", 1), record("same-attached", "/work", 2), record("attached-untitled", "/work", 3)],
      attached: [{ id: "self" }, { id: "same-attached" }, { id: "attached-untitled" }],
      projectionSnapshots: {
        "same-attached": { values: { title: "Same title", subagent: { label: "Same ] sub \\" } } },
        "attached-untitled": { values: {} },
      },
    };
    const { stock } = await same((mod) => {
      const harness = makeHarness(mod, fixture, { candidateLimit: 2 });
      return harness.service.remoteExportCandidates(makeAgent(), "", new AbortController().signal);
    });
    const candidates = valueOf(stock) as unknown as Obj[];
    expect(candidates.length).toBe(2);
    for (const candidate of candidates) {
      const parsed = stockMod.parseSessionReferenceText(candidate.mention);
      expect(parsed.text).toBe(`@${candidate.displayTitle ?? candidate.label}`);
      expect(parsed.references[0]!.sessionId).toBe(candidate.sessionId);
    }
    expect(String(candidates[0]!.mention)).toContain("Same \\] sub");
  });

  test("26. prepare: khử trùng, label mặc định id, inputIndex theo thứ tự", async () => {
    const fixture = {
      snapshots: {
        a: makeSnapshot({ id: "a" }),
        b: makeSnapshot({ id: "b" }),
        c: makeSnapshot({ id: "c" }),
      },
    };
    const references = [
      { sessionId: "a", label: "One" },
      { sessionId: "a", label: "Two" },
      { sessionId: "b" },
      { sessionId: "c", label: "Three" },
    ];
    const content = [{ type: "text", text: "see @[One](dsh-session:abc)" }];
    const { stock } = await same(async (mod) => {
      const { view } = await prepareSide(mod, fixture, { maxReferenceBytes: 100_000 }, references, { content });
      return view;
    });
    const view = valueOf(stock);
    expect(view.source.references.map((reference: Obj) => [reference.sessionId, reference.label, reference.inputIndex])).toEqual([
      ["a", "One", 0],
      ["b", "b", 1],
      ["c", "Three", 2],
    ]);
    expect(view.content).toEqual(content);
  });

  test("27. prepare: tự tham chiếu/quá trần/tham chiếu hỏng ⇒ cùng lỗi", async () => {
    const fixture = {
      snapshots: {
        a: makeSnapshot({ id: "a" }),
        b: makeSnapshot({ id: "b" }),
        c: makeSnapshot({ id: "c" }),
        d: makeSnapshot({ id: "d" }),
      },
    };
    const cases: Obj[] = [
      { name: "self", agent: makeAgent({ id: "self" }), config: {}, references: [{ sessionId: "self" }] },
      { name: "null", references: [null] },
      { name: "id-number", references: [{ sessionId: 5 }] },
      { name: "label-number", references: [{ sessionId: "a", label: 5 }] },
      { name: "too-many-config", config: { maxReferences: 2 }, references: [{ sessionId: "a" }, { sessionId: "b" }, { sessionId: "c" }] },
      { name: "too-many-default", config: {}, references: [{ sessionId: "a" }, { sessionId: "b" }, { sessionId: "c" }, { sessionId: "d" }] },
    ];
    const { stock } = await same(async (mod) =>
      Promise.all(
        cases.map(async (item) => {
          try {
            await prepareSide(mod, fixture, item.config, item.references as Obj[], { agent: item.agent ?? makeAgent() });
            return { name: item.name, ok: true };
          } catch (error) {
            return { name: item.name, ok: false, facts: errorFacts(error, mod) };
          }
        }),
      ),
    );
    const expected: Obj = {
      self: "SESSION_REFERENCE_SELF_REFERENCE",
      null: "SESSION_REFERENCE_INVALID_REFERENCE",
      "id-number": "SESSION_REFERENCE_INVALID_REFERENCE",
      "label-number": "SESSION_REFERENCE_INVALID_REFERENCE",
      "too-many-config": "SESSION_REFERENCE_TOO_MANY",
      "too-many-default": "SESSION_REFERENCE_TOO_MANY",
    };
    for (const row of valueOf(stock) as unknown as Obj[]) {
      expect(row.ok).toBe(false);
      expect((row.facts as Obj).code).toBe(expected[row.name]);
    }
  });

  test("28. prepare: readSurface lỗi ⇒ READ_FAILED; huỷ trước ⇒ CANCELLED", async () => {
    const fixture = { snapshots: { a: makeSnapshot({ id: "a" }) } };
    const { stock } = await same(async (mod) => {
      const readFailure = await attempt(() => prepareSide(mod, fixture, {}, [{ sessionId: "ghost" }]));
      const controller = new AbortController();
      controller.abort(new Error("stop"));
      const cancel = await attempt(() => prepareSide(mod, fixture, {}, [{ sessionId: "a" }], { signal: controller.signal }));
      return { readFailure: resultShape(readFailure), cancel: resultShape(cancel) };
    });
    const value = valueOf(stock);
    expect(value.readFailure.ok).toBe(false);
    expect(value.readFailure.error.code).toBe("SESSION_REFERENCE_READ_FAILED");
    expect(value.readFailure.error.message).toContain("missing session ghost");
    expect(value.cancel.ok).toBe(false);
    expect(value.cancel.error.code).toBe("SESSION_REFERENCE_CANCELLED");
    expect(value.cancel.error.cause).toEqual({ name: "Error", message: "stop" });
  });

  test("29. prepare: ngân sách tự động từ llm (contextWindow) và sàn 64 KiB", async () => {
    const text = "b".repeat(70_000);
    const snapshot = makeSnapshot({ events: [userEvent(1, text)] });
    const fixture = { snapshots: { "source-session": snapshot } };
    const references = [{ sessionId: "source-session" }];
    const run = async (mod: Mod, llm: Obj | undefined): Promise<Obj> => {
      const { view, harness } = await prepareSide(mod, { ...fixture, llm }, { referenceContextFraction: 0.2 }, references, {
        agent: makeAgent({ options: { provider: "p", model: "m" } }),
      });
      return { view, llmCalls: harness.llmCalls() };
    };
    const { stock } = await same(async (mod) => ({
      big: await run(mod, { contextWindow: 100_000 }),
      small: await run(mod, { contextWindow: 10_000 }),
      absent: await run(mod, undefined),
    }));
    const value = valueOf(stock);
    expect(value.big.view.source.references[0].truncated).toBe(false);
    expect(value.big.llmCalls).toBe(1);
    expect(value.small.view.source.references[0].truncated).toBe(true);
    expect(value.small.llmCalls).toBe(1);
    expect(value.absent.view.source.references[0].truncated).toBe(true);
    expect(value.absent.llmCalls).toBe(0);
  });
});
