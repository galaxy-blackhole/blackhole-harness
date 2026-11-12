/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-host-llm-pi-ai: so từng ký tự bề mặt export + Config với
 *      bundle gốc, chạy apply trên context GIẢ (catalog id/thứ tự/không trùng), và phủ stream · error
 *      · retry policy · replay bằng transport GIẢ — spy globalThis.fetch canh 0 lần gọi mạng.
 */
import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { join } from "node:path";

import {
  Config as OurConfig,
  PiAiAdapter as OurPiAiAdapter,
  apply as ourApply,
  inject as ourInject,
  name as ourName,
  recordKeyFor as ourRecordKeyFor,
  supportedProtocols as ourSupportedProtocols,
} from "../../packages/host/llm-pi-ai/src/index.ts";
import { resolveProfiles } from "../../packages/host/llm-pi-ai/src/config.ts";
import { catalogProvider, catalogProviderIds } from "../../packages/host/llm-pi-ai/src/catalog.ts";
import { toPiAssistant, toPiReplayState } from "../../packages/host/llm-pi-ai/src/replay.ts";
// @ts-ignore -- bundle chỉ có lib/index.js; khai báo kiểu nằm ở lib/types (không cạnh file .js)
import { LlmError } from "../../apps/host/node_modules/@deepseek-ai/dsh-llm/lib/index.js";


const PROVIDER = "fake-route";
const MODEL = "fake-model";
const BASE_URL = "http://127.0.0.1:9/v1";
const REPO = join(import.meta.dir, "..", "..");
const STOCK_PATH = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-llm-pi-ai", "lib", "index.js");
const BUILT_PATH = join(REPO, "packages", "host", "llm-pi-ai", "lib", "index.js");
const SEVEN_EXPORTS = ["Config", "PiAiAdapter", "apply", "inject", "name", "recordKeyFor", "supportedProtocols"];

/** Khoá fetch toàn cục: mọi ca chạy dưới spy này; afterEach đòi 0 lần gọi. */
const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((() => {
  throw new Error("llm-pi-ai test: network access is forbidden");
}) as unknown as typeof fetch);

/** Bundle gốc nạp động để tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK_PATH)) as unknown as {
  Config: (value: unknown) => { providers: { get(): Record<string, unknown> } };
  PiAiAdapter: new (options: unknown) => any;
  apply: (ctx: unknown, config: unknown) => void;
  inject: string[];
  name: string;
  recordKeyFor: (providerId: string) => string;
  supportedProtocols: () => readonly string[];
};

/** Artifact đã build của gói ta — đo bề mặt export thật. */
const built = (await import(BUILT_PATH)) as unknown as Record<string, unknown>;

type AnyRecord = Record<string, any>;
interface Capture {
  model: AnyRecord;
  context: AnyRecord;
  options: AnyRecord;
}
type Handler = (model: AnyRecord, context: AnyRecord, options: AnyRecord) => AsyncIterable<AnyRecord> | never;

beforeEach(() => fetchSpy.mockClear());
afterEach(() => expect(fetchSpy.mock.calls).toHaveLength(0));
// 20/10/2026 — BẮT BUỘC khôi phục fetch toàn cục: Bun chạy CẢ bộ test trong MỘT tiến trình, spy không
// restore sẽ rò sang tệp khác (đã làm `gate:home-isolation` của boot.test.ts đỏ vì host boot gọi fetch
// và ăn "network access is forbidden").
afterAll(() => fetchSpy.mockRestore());

/** Usage pi-ai đầy đủ, gồm cost bốn hạng. */
function piUsage(overrides: AnyRecord = {}): AnyRecord {
  return {
    input: 10, output: 5, cacheRead: 2, cacheWrite: 0, totalTokens: 15,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    ...overrides,
  };
}

/** Assistant message pi-ai hoàn tất. */
function piMessage(overrides: AnyRecord = {}): AnyRecord {
  return {
    role: "assistant",
    content: [{ type: "text", text: "hello", textSignature: "sig-text" }],
    api: "openai-completions",
    provider: PROVIDER,
    model: "provider-model",
    usage: piUsage(),
    stopReason: "stop",
    timestamp: 0,
    ...overrides,
  };
}

/** Descriptor chat model tối thiểu mà provider giả trả về. */
function modelDescriptor(overrides: AnyRecord = {}): AnyRecord {
  return {
    id: MODEL, name: "Fake Model", api: "openai-completions", provider: PROVIDER,
    baseUrl: BASE_URL, input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 4096, maxTokens: 512,
    ...overrides,
  };
}

/** Provider pi-ai GIẢ: không socket/fetch; mọi lượt gọi được ghi lại. */
function fakeProvider(handler: Handler, captured: Capture[] = [], modelOverrides: AnyRecord = {}): AnyRecord {
  const model = modelDescriptor(modelOverrides);
  return {
    id: PROVIDER,
    name: "Fake Provider",
    auth: {
      apiKey: {
        name: "Fake",
        resolve: async ({ credential }: AnyRecord = {}) => ({
          auth: credential?.key === undefined ? {} : { apiKey: credential.key },
          source: "fake",
        }),
      },
    },
    getModels: () => [model],
    stream: () => { throw new Error("fake provider stream() must never be called"); },
    streamSimple: (seenModel: AnyRecord, context: AnyRecord, options: AnyRecord) => {
      captured.push({ model: seenModel, context, options });
      return handler(seenModel, context, options);
    },
  };
}

/** Async iterable từ mảng event — transport đồng bộ, không I/O. */
function eventStream(events: AnyRecord[]): AsyncIterable<AnyRecord> {
  return (async function* () { for (const event of events) yield event; })();
}

/** Map profile đã phân giải với provider giả, đúng cách adapter đọc snapshot. */
function profileMap(provider: AnyRecord, profile: AnyRecord = {}): Map<string, any> {
  const profiles = resolveProfiles({
    [PROVIDER]: {
      api: "openai-completions",
      baseURL: BASE_URL,
      models: [{ id: MODEL, name: "Fake Model", contextWindow: 4096, maxTokens: 512, input: ["text"] }],
      ...profile,
    },
  });
  const resolved = profiles.get(PROVIDER);
  if (resolved === undefined) throw new Error("fake profile did not resolve");
  profiles.set(PROVIDER, { ...resolved, piProvider: provider } as any);
  return profiles as Map<string, any>;
}

/** Hai seam auth tối thiểu — không đọc file/env thật. */
const FAKE_AUTH = {
  credentials: {
    read: async () => undefined,
    list: async () => [],
    modify: async (_providerId: string, mutate: (current: undefined) => Promise<undefined>) => mutate(undefined),
    delete: async () => undefined,
  },
  authContext: { env: async () => undefined, fileExists: async () => false },
};

const defaultResolveApiKey = async (): Promise<string> => "test-key";

/** Adapter của TA trên transport giả. */
function oursAdapter(
  provider: AnyRecord,
  profile: AnyRecord = {},
  resolveApiKey: (provider: string, profile: AnyRecord) => Promise<string | undefined> = defaultResolveApiKey,
): any {
  const profiles = profileMap(provider, profile);
  return new OurPiAiAdapter({ profiles: () => profiles, resolveApiKey, auth: FAKE_AUTH });
}

/** Adapter của bản GỐC trên cùng transport giả, cùng profile. */
function stockAdapter(
  provider: AnyRecord,
  profile: AnyRecord = {},
  resolveApiKey: (provider: string, profile: AnyRecord) => Promise<string | undefined> = defaultResolveApiKey,
): any {
  const profiles = profileMap(provider, profile);
  return new stock.PiAiAdapter({ profiles: () => profiles, resolveApiKey, auth: FAKE_AUTH });
}

async function collect(stream: AsyncIterable<AnyRecord>): Promise<AnyRecord[]> {
  const chunks: AnyRecord[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

async function failureOf(run: () => Promise<unknown>): Promise<any | undefined> {
  try { await run(); return undefined; } catch (error) { return error; }
}

function thrownOf(run: () => unknown): any | undefined {
  try { run(); return undefined; } catch (error) { return error; }
}

function errorShape(error: any | undefined): AnyRecord | undefined {
  return error === undefined ? undefined : { name: error.constructor.name, message: error.message, code: error.code };
}

/** Chạy CẢ HAI adapter trên cùng handler rồi so chunk + context đã bắt. */
async function streamBoth(
  handler: Handler,
  request: AnyRecord,
  profile: AnyRecord = {},
  modelOverrides: AnyRecord = {},
): Promise<{ chunks: AnyRecord[]; captured: Capture[]; ours: any; stock: any }> {
  const capturedOurs: Capture[] = [];
  const capturedStock: Capture[] = [];
  const ours = oursAdapter(fakeProvider(handler, capturedOurs, modelOverrides), profile);
  const stockSide = stockAdapter(fakeProvider(handler, capturedStock, modelOverrides), profile);
  const chunks = await collect(ours.stream(request));
  const stockChunks = await collect(stockSide.stream(request));
  expect(chunks).toEqual(stockChunks);
  expect(capturedOurs.map((entry) => entry.context)).toEqual(capturedStock.map((entry) => entry.context));
  return { chunks, captured: capturedOurs, ours, stock: stockSide };
}

function textRequest(extra: AnyRecord = {}): AnyRecord {
  return {
    provider: PROVIDER,
    model: MODEL,
    messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    ...extra,
  };
}

/** Usage toàn số 0 mà pi-ai đòi ở message lịch sử. */
const ZERO_PI_USAGE = piUsage({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 });

/** Chạy CẢ HAI adapter trên một handler NÉM LỖI, so hình dạng lỗi. */
async function failingStreamBoth(
  handler: Handler,
  request: AnyRecord,
  profile: AnyRecord = {},
  modelOverrides: AnyRecord = {},
): Promise<{ oursError: any; stockError: any }> {
  const ours = oursAdapter(fakeProvider(handler, [], modelOverrides), profile);
  const stockSide = stockAdapter(fakeProvider(handler, [], modelOverrides), profile);
  const oursError = await failureOf(() => collect(ours.stream(request)));
  const stockError = await failureOf(() => collect(stockSide.stream(request)));
  expect(errorShape(oursError)).toEqual(errorShape(stockError));
  return { oursError, stockError };
}

/** Trạng thái quan sát được của một ctx cordis giả. */
interface ApplyState {
  directory?: any[];
  routes?: string[];
  adapter?: any;
  discovery?: { ns: string; run: unknown };
  events: Map<string, (...args: any[]) => any>;
  adapterRegistrations: number;
  directoryRegistrations: number;
}

/** Context cordis GIẢ đủ seam mà apply chạm tới. */
function fakeApplyContext(withEntry = true): { ctx: any; state: ApplyState } {
  const state: ApplyState = { events: new Map(), adapterRegistrations: 0, directoryRegistrations: 0 };
  const handle = (onReplace: (next: any) => void) => Object.assign(() => undefined, { replace: onReplace });
  const ctx = {
    fiber: withEntry ? { entry: { options: { id: "llm-pi-ai" } } } : {},
    inject: () => undefined,
    effect: (run: () => void) => { run(); return () => undefined; },
    on: (name: string, listener: (...args: any[]) => any) => { state.events.set(name, listener); return () => undefined; },
    get: () => undefined,
    logger: { warn: () => undefined, error: () => undefined, info: () => undefined },
    llm: {
      registerConfigurableProviders: (entries: any[]) => {
        state.directoryRegistrations += 1;
        state.directory = entries;
        return handle((next) => { state.directory = next; });
      },
      registerModelDiscovery: (ns: string, run: unknown) => {
        state.discovery = { ns, run };
        return () => undefined;
      },
      registerAdapter: (routes: string[], adapter: any) => {
        state.adapterRegistrations += 1;
        state.routes = routes;
        state.adapter = adapter;
        return handle((next) => { state.routes = next; });
      },
    },
  };
  return { ctx, state };
}

function declaredRoute(modelId: string): AnyRecord {
  return {
    api: "openai-completions",
    baseURL: BASE_URL,
    models: [{ id: modelId, name: modelId, contextWindow: 4096, maxTokens: 512, input: ["text"] }],
  };
}

/** Chạy apply của một bản trên context giả. */
function runApply(applyFn: (ctx: any, config: any) => void, providers: AnyRecord, withEntry = true): ApplyState {
  const { ctx, state } = fakeApplyContext(withEntry);
  applyFn(ctx, { providers: { get: () => providers } });
  return state;
}

describe("bề mặt export A/B: bảy tên, từng ký tự", () => {
  test("artifact build + nguồn: đúng bảy tên, khớp bundle gốc", () => {
    expect(Object.keys(built).sort()).toEqual([...SEVEN_EXPORTS].sort());
    expect(Object.keys(built)).toHaveLength(7);
    expect(Object.keys(built)).toEqual(Object.keys(stock));
    expect(built.name).toBe(stock.name);
    expect(built.inject).toEqual(stock.inject);
    expect(built.supportedProtocols).toBeTypeOf("function");
    expect((built.supportedProtocols as () => unknown)()).toEqual(stock.supportedProtocols());
    expect(built.recordKeyFor).toBeTypeOf("function");
    expect((built.recordKeyFor as (id: string) => string)("openai")).toBe(stock.recordKeyFor("openai"));
  });

  test("name và inject khớp từng ký tự", () => {
    expect(ourName).toBe(stock.name);
    expect(ourName).toBe("llm-pi-ai");
    expect(ourInject).toEqual(stock.inject);
    expect(ourInject).toEqual(["llm"]);
    expect(ourInject).toHaveLength(1);
  });

  test("apply là hàm cùng tên, cùng arity như bản gốc", () => {
    expect(typeof ourApply).toBe(typeof stock.apply);
    expect(typeof ourApply).toBe("function");
    expect(ourApply.name).toBe(stock.apply.name);
    expect(ourApply.name).toBe("apply");
    expect(ourApply.length).toBe(stock.apply.length);
    expect(ourApply.length).toBe(2);
  });

  test("supportedProtocols: đúng thứ tự, khớp bản gốc", () => {
    expect(ourSupportedProtocols()).toEqual(stock.supportedProtocols());
    expect(ourSupportedProtocols()).toEqual(["openai-completions", "openai-responses", "anthropic-messages"]);
  });

  test("recordKeyFor: chuỗi y hệt + tên sai ném cùng lỗi", () => {
    for (const providerId of ["openai", "openai-codex", "anthropic", "x"]) {
      expect(String(ourRecordKeyFor(providerId))).toBe(String(stock.recordKeyFor(providerId)));
      expect(String(ourRecordKeyFor(providerId))).toBe(`llm-pi-ai/${providerId}`);
    }
    for (const invalid of ["", "OpenAI", "a/b", "a b", "-x"]) {
      const oursError = thrownOf(() => ourRecordKeyFor(invalid));
      const stockError = thrownOf(() => stock.recordKeyFor(invalid));
      expect(errorShape(oursError)).toEqual(errorShape(stockError));
      expect(oursError?.constructor.name).toBe("TypeError");
    }
  });

  test("String(Config) khớp từng ký tự với bundle gốc", () => {
    expect(String(OurConfig)).toBe(String(stock.Config));
    expect(String(OurConfig).length).toBe(String(stock.Config).length);
    expect(String(OurConfig)).toContain("providers");
  });

  test("Config: cùng input cho cùng giá trị đã kiểm (mặc định materialize)", () => {
    const raw = { providers: { [PROVIDER]: declaredRoute("m1") } };
    const ours = OurConfig(structuredClone(raw));
    const theirs = stock.Config(structuredClone(raw));
    expect(ours.providers.get() as AnyRecord).toEqual(theirs.providers.get() as AnyRecord);
    const profile = (ours.providers.get() as AnyRecord)[PROVIDER];
    expect(profile.defaultInput).toEqual(["text"]);
    expect(profile.defaultContextWindow).toBe(262144);
    expect(profile.defaultMaxTokens).toBe(32768);
    expect(profile.streamIdleTimeoutMs).toBe(300000);
  });

  test("Config rỗng: providers {} dormant, khớp bản gốc", () => {
    expect(OurConfig({}).providers.get() as AnyRecord).toEqual({});
    expect(OurConfig({}).providers.get() as AnyRecord).toEqual(stock.Config({}).providers.get() as AnyRecord);
  });

  test("spy fetch đang hoạt động và suite chưa gọi mạng", () => {
    expect(globalThis.fetch).toBe(fetchSpy as unknown as typeof fetch);
    expect(fetchSpy.mock.calls).toHaveLength(0);
  });
});

describe("catalog + apply: provider id, thứ tự, không trùng", () => {
  test("catalogProviderIds: duy nhất, catalogProvider tra được từng id", () => {
    const ids = [...catalogProviderIds()];
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(catalogProvider(id)?.id).toBe(id);
    expect(catalogProvider("definitely-not-a-pi-ai-provider")).toBeUndefined();
  });

  test("apply dormant: thư mục đúng catalog order, không đăng ký adapter, khớp gốc", () => {
    const ids = [...catalogProviderIds()];
    const ours = runApply(ourApply, {}, false);
    const theirs = runApply(stock.apply as any, {}, false);
    expect(ours.directory!.map((entry) => entry.provider)).toEqual(ids);
    for (const id of ids) expect(catalogProvider(id)).toBeDefined();
    expect(new Set(ours.directory!.map((entry) => entry.provider)).size).toBe(ours.directory!.length);
    expect(ours.directory).toEqual(theirs.directory);
    expect(ours.directory![0]!.settingsNs).toBe("llm-pi-ai");
    expect(ours.routes).toBeUndefined();
    expect(theirs.routes).toBeUndefined();
    expect(ours.adapterRegistrations).toBe(0);
    expect(theirs.adapterRegistrations).toBe(0);
    expect(ours.directoryRegistrations).toBe(1);
    expect(theirs.directoryRegistrations).toBe(1);
  });

  test("apply có route tự khai: catalog trước, route khai sau, không trùng id, khớp gốc", () => {
    const ids = [...catalogProviderIds()];
    const providers = {
      openai: { displayName: "My OpenAI" },
      "zz-declared": declaredRoute("zz-model"),
    };
    const ours = runApply(ourApply, providers);
    const theirs = runApply(stock.apply as any, providers);
    expect(ours.directory!.map((entry) => entry.provider)).toEqual([...ids, "zz-declared"]);
    expect(ours.directory).toHaveLength(ids.length + 1);
    expect(new Set(ours.directory!.map((entry) => entry.provider)).size).toBe(ours.directory!.length);
    expect(ours.directory!.find((entry) => entry.provider === "openai")?.displayName).toBe("My OpenAI");
    expect(ours.directory!.at(-1)?.provider).toBe("zz-declared");
    expect(ours.directory!.at(-1)?.declared).toBe(true);
    expect(ours.directory).toEqual(theirs.directory);
    expect(ours.routes).toEqual(["openai", "zz-declared"]);
    expect(ours.routes).toEqual(theirs.routes);
    expect(new Set(ours.routes!).size).toBe(ours.routes!.length);
    expect(ours.directoryRegistrations).toBe(1);
    expect(theirs.directoryRegistrations).toBe(1);
  });

  test("apply nhiều route tự khai: giữ thứ tự dict + model discovery đúng namespace, khớp gốc", () => {
    const providers = { "route-b": declaredRoute("b-model"), "route-a": declaredRoute("a-model") };
    const ours = runApply(ourApply, providers);
    const theirs = runApply(stock.apply as any, providers);
    expect(ours.routes).toEqual(["route-b", "route-a"]);
    expect(ours.routes).toEqual(theirs.routes);
    expect(new Set(ours.routes!).size).toBe(2);
    expect(ours.discovery?.ns).toBe("llm-pi-ai");
    expect(theirs.discovery?.ns).toBe("llm-pi-ai");
    expect(ours.directory!.slice(-2).map((entry) => entry.provider)).toEqual(["route-b", "route-a"]);
    expect(ours.directory).toEqual(theirs.directory);
    expect(ours.adapterRegistrations).toBe(1);
    expect(theirs.adapterRegistrations).toBe(1);
  });

  test("volatile-update thay route/thư mục bằng replace, không đăng ký lại, khớp gốc", () => {
    let current: AnyRecord = { "route-b": declaredRoute("b-model"), "route-a": declaredRoute("a-model") };
    const config = { providers: { get: () => current } };
    const ours = fakeApplyContext();
    const theirs = fakeApplyContext();
    ourApply(ours.ctx, config);
    (stock.apply as any)(theirs.ctx, config);
    expect(ours.state.routes).toEqual(["route-b", "route-a"]);
    expect(theirs.state.routes).toEqual(["route-b", "route-a"]);
    current = { "route-c": declaredRoute("c-model") };
    ours.state.events.get("loader/volatile-update")?.();
    theirs.state.events.get("loader/volatile-update")?.();
    expect(ours.state.routes).toEqual(["route-c"]);
    expect(theirs.state.routes).toEqual(["route-c"]);
    expect(ours.state.directory).toEqual(theirs.state.directory);
    expect(ours.state.adapterRegistrations).toBe(1);
    expect(theirs.state.adapterRegistrations).toBe(1);
    expect(ours.state.directoryRegistrations).toBe(1);
    expect(theirs.state.directoryRegistrations).toBe(1);
    expect(new Set(ours.state.routes!).size).toBe(1);
    expect(ours.state.adapter).toBeDefined();
  });
});

describe("adapter stream: chunk text/tool-call, usage, finish", () => {
  test("text: block-start/delta/block-end + usage + finish stop + replay state, A/B", async () => {
    const doneMessage = piMessage({
      content: [{ type: "text", text: "Hello", textSignature: "sig-text" }],
      responseId: "resp-text",
    });
    const events = [
      { type: "start", partial: doneMessage },
      { type: "text_start", contentIndex: 0, partial: doneMessage },
      { type: "text_delta", contentIndex: 0, delta: "Hel", partial: doneMessage },
      { type: "text_delta", contentIndex: 0, delta: "lo", partial: doneMessage },
      { type: "text_end", contentIndex: 0, content: "Hello", partial: doneMessage },
      { type: "done", reason: "stop", message: doneMessage },
    ];
    const { chunks, captured } = await streamBoth(
      () => eventStream(events),
      textRequest({ temperature: 0.2, maxTokens: 128, sessionId: "session-1" }),
    );
    expect(chunks).toEqual([
      { type: "block-start", index: 0, blockType: "text" },
      { type: "text-delta", index: 0, text: "Hel" },
      { type: "text-delta", index: 0, text: "lo" },
      { type: "block-end", index: 0, block: { type: "text", text: "Hello" } },
      { type: "usage", usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, cacheReadTokens: 2 } },
      {
        type: "finish",
        reason: { kind: "stop" },
        replayState: {
          response: {
            kind: "pi-ai", version: 2, api: "openai-completions", provider: PROVIDER,
            model: MODEL, responseId: "resp-text", stopReason: "stop",
          },
          blocks: [{ type: "text", textSignature: "sig-text" }],
        },
      },
    ]);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.context.messages).toEqual([{ role: "user", content: "hi", timestamp: 0 }]);
    expect(captured[0]!.options.maxRetries).toBe(0);
    expect(captured[0]!.options.apiKey).toBe("test-key");
    expect(captured[0]!.options.temperature).toBe(0.2);
    expect(captured[0]!.options.maxTokens).toBe(128);
    expect(captured[0]!.options.sessionId).toBe("session-1");
    expect(captured[0]!.options.headers["user-agent"]).toContain("deepseek-harness");
  });

  test("tool-call: start/delta/end giữ JSON thô + finish tool-calls, A/B", async () => {
    const partial = piMessage({
      content: [
        { type: "text", text: "lookup" },
        { type: "toolCall", id: "call-1", name: "lookup", arguments: {} },
      ],
    });
    const toolCall = { type: "toolCall", id: "call-1", name: "lookup", arguments: { q: "x" }, thoughtSignature: "sig-call" };
    const doneMessage = piMessage({
      content: [{ type: "text", text: "lookup", textSignature: "sig-text" }, toolCall],
      stopReason: "toolUse",
      usage: piUsage({ cacheWrite: 4, totalTokens: 19 }),
      responseModel: "provider-model-v2",
      responseId: "resp-tool",
      providerThinkingLevel: "high",
    });
    const events = [
      { type: "start", partial },
      { type: "text_start", contentIndex: 0, partial },
      { type: "text_delta", contentIndex: 0, delta: "look", partial },
      { type: "text_end", contentIndex: 0, content: "lookup", partial },
      { type: "toolcall_start", contentIndex: 1, partial },
      { type: "toolcall_delta", contentIndex: 1, delta: '{"q":', partial },
      { type: "toolcall_delta", contentIndex: 1, delta: '"x"}', partial },
      { type: "toolcall_end", contentIndex: 1, toolCall, partial },
      { type: "done", reason: "toolUse", message: doneMessage },
    ];
    const { chunks } = await streamBoth(() => eventStream(events), textRequest());
    expect(chunks).toEqual([
      { type: "block-start", index: 0, blockType: "text" },
      { type: "text-delta", index: 0, text: "look" },
      { type: "block-end", index: 0, block: { type: "text", text: "lookup" } },
      { type: "block-start", index: 1, blockType: "tool-call" },
      { type: "tool-call-delta", index: 1, id: "call-1", name: "lookup", argumentsDelta: '{"q":' },
      { type: "tool-call-delta", index: 1, id: "call-1", name: "lookup", argumentsDelta: '"x"}' },
      { type: "block-end", index: 1, block: { type: "tool-call", id: "call-1", name: "lookup", arguments: '{"q":"x"}' } },
      { type: "usage", usage: { inputTokens: 10, outputTokens: 5, totalTokens: 19, cacheReadTokens: 2, cacheWriteTokens: 4 } },
      {
        type: "finish",
        reason: { kind: "tool-calls" },
        replayState: {
          response: {
            kind: "pi-ai", version: 2, api: "openai-completions", provider: PROVIDER, model: MODEL,
            responseModel: "provider-model-v2", responseId: "resp-tool",
            providerThinkingLevel: "high", stopReason: "toolUse",
          },
          blocks: [
            { type: "text", textSignature: "sig-text" },
            { type: "tool-call", thoughtSignature: "sig-call" },
          ],
        },
      },
    ]);
  });

  test("thinking: reasoning chunk + finish max-tokens + usage cache, A/B", async () => {
    const doneMessage = piMessage({
      content: [{ type: "thinking", thinking: "why", thinkingSignature: "sig-think", redacted: true }],
      stopReason: "length",
      usage: piUsage({ cacheRead: 0, cacheWrite: 0 }),
    });
    const events = [
      { type: "start", partial: doneMessage },
      { type: "thinking_start", contentIndex: 0, partial: doneMessage },
      { type: "thinking_delta", contentIndex: 0, delta: "why", partial: doneMessage },
      { type: "thinking_end", contentIndex: 0, content: "why", partial: doneMessage },
      { type: "done", reason: "length", message: doneMessage },
    ];
    const { chunks } = await streamBoth(() => eventStream(events), textRequest());
    expect(chunks).toEqual([
      { type: "block-start", index: 0, blockType: "reasoning" },
      { type: "reasoning-delta", index: 0, text: "why" },
      { type: "block-end", index: 0, block: { type: "reasoning", text: "why" } },
      { type: "usage", usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      {
        type: "finish",
        reason: { kind: "max-tokens" },
        replayState: {
          response: {
            kind: "pi-ai", version: 2, api: "openai-completions", provider: PROVIDER,
            model: MODEL, stopReason: "length",
          },
          blocks: [{ type: "reasoning", thinkingSignature: "sig-think", redacted: true }],
        },
      },
    ]);
  });

  test("stop rỗng: EMPTY_RESPONSE; usage vượt context: CONTEXT_WINDOW_EXCEEDED, A/B", async () => {
    const empty = piMessage({ content: [], stopReason: "stop", usage: ZERO_PI_USAGE });
    const emptyRun = await streamBoth(() => eventStream([
      { type: "start", partial: empty },
      { type: "done", reason: "stop", message: empty },
    ]), textRequest());
    expect(emptyRun.chunks.at(-1)?.reason).toEqual({
      kind: "error",
      failure: { message: 'model "provider-model" returned a completed response with no content', code: "EMPTY_RESPONSE" },
    });

    const overflow = piMessage({ usage: piUsage({ input: 5000, cacheRead: 100, totalTokens: 5100 }) });
    const overflowRun = await streamBoth(() => eventStream([
      { type: "start", partial: overflow },
      { type: "done", reason: "stop", message: overflow },
    ]), textRequest());
    expect(overflowRun.chunks.at(-1)?.reason).toEqual({
      kind: "error",
      failure: { message: 'pi-ai detected context overflow for model "provider-model"', code: "CONTEXT_WINDOW_EXCEEDED" },
    });
  });
});

describe("adapter: kiểm request + liệt kê/kể model", () => {
  test("reasoning không được model hỗ trợ: UNSUPPORTED_REASONING_EFFORT, transport không chạy", async () => {
    const { oursError } = await failingStreamBoth(
      () => { throw new Error("must not run"); },
      textRequest(),
      { reasoning: "high" },
    );
    expect(errorShape(oursError)).toEqual({
      name: "LlmError",
      message: 'pi-ai provider "fake-route" model "fake-model" does not support reasoning effort "high"',
      code: "UNSUPPORTED_REASONING_EFFORT",
    });
  });

  test("stop option bị từ chối trước mọi phân giải route: UNSUPPORTED_OPTION, A/B", async () => {
    const { oursError } = await failingStreamBoth(
      () => { throw new Error("must not run"); },
      textRequest({ stop: ["STOP"] }),
    );
    expect(errorShape(oursError)).toEqual({
      name: "LlmError",
      message: "llm-pi-ai does not support GenerateOptions.stop",
      code: "UNSUPPORTED_OPTION",
    });
  });

  test("ảnh trên model text-only: UNSUPPORTED_CONTENT, A/B", async () => {
    const request = textRequest({
      messages: [{ role: "user", content: [{ type: "image", attachment: { attachmentId: "a1" } }] }],
    });
    const { oursError } = await failingStreamBoth(() => { throw new Error("must not run"); }, request);
    expect(errorShape(oursError)).toEqual({
      name: "LlmError",
      message: 'pi-ai model "fake-model" does not support image input',
      code: "UNSUPPORTED_CONTENT",
    });
  });

  test("route/model lạ: NO_ADAPTER và UNKNOWN_MODEL, A/B", async () => {
    const unknownProvider = await failingStreamBoth(
      () => { throw new Error("must not run"); },
      textRequest({ provider: "unknown-route" }),
    );
    expect(errorShape(unknownProvider.oursError)).toEqual({
      name: "LlmError",
      message: 'pi-ai adapter does not own provider "unknown-route"',
      code: "NO_ADAPTER",
    });
    const unknownModel = await failingStreamBoth(
      () => { throw new Error("must not run"); },
      textRequest({ model: "missing-model" }),
    );
    expect(errorShape(unknownModel.oursError)).toEqual({
      name: "LlmError",
      message: 'pi-ai provider "fake-route" has no configured model "missing-model"',
      code: "UNKNOWN_MODEL",
    });
  });

  test("listModels: thiếu credential trả []; đủ credential trả model, A/B", async () => {
    const missing = async () => { throw new LlmError("missing credential", "MISSING_CREDENTIAL"); };
    const a = oursAdapter(fakeProvider(() => { throw new Error("must not run"); }), {}, missing);
    const b = stockAdapter(fakeProvider(() => { throw new Error("must not run"); }), {}, missing);
    expect(await a.listModels(PROVIDER)).toEqual([]);
    expect(await a.listModels(PROVIDER)).toEqual(await b.listModels(PROVIDER));

    const c = oursAdapter(fakeProvider(() => { throw new Error("must not run"); }));
    const d = stockAdapter(fakeProvider(() => { throw new Error("must not run"); }));
    expect(await c.listModels(PROVIDER)).toEqual([
      { provider: PROVIDER, id: MODEL, name: "Fake Model", inputModalities: ["text"] },
    ]);
    expect(await c.listModels(PROVIDER)).toEqual(await d.listModels(PROVIDER));
  });

  test("ĐỐI CHỨNG ÂM: cùng mã MISSING_CREDENTIAL nhưng KHÔNG phải LlmError ⇒ NÉM lại (không trả []), A/B", async () => {
    // Chốt phép nhận diện theo TÊN LỚP: lỗi lạ cùng mã KHÔNG được coi là "thiếu credential" của kernel.
    const fake = async (): Promise<string> => {
      throw Object.assign(new Error("missing credential"), { code: "MISSING_CREDENTIAL" });
    };
    const a = oursAdapter(fakeProvider(() => { throw new Error("must not run"); }), {}, fake);
    const b = stockAdapter(fakeProvider(() => { throw new Error("must not run"); }), {}, fake);
    const outcome = (adapter: any): Promise<string> =>
      adapter.listModels(PROVIDER).then(() => "ok", (error: unknown) => String((error as { message?: unknown }).message));
    expect(await outcome(a)).toBe("missing credential");
    expect(await outcome(a)).toBe(await outcome(b));
  });

  test("resolveModel: context + defaultMaxTokens + reasoning effort, A/B", async () => {
    const profile = {
      reasoning: "high",
      models: [{ id: MODEL, name: "Fake Model", contextWindow: 4096, maxTokens: 512, input: ["text", "image"] }],
    };
    const provider = fakeProvider(() => { throw new Error("must not run"); }, [], { input: ["text", "image"], reasoning: true });
    const a = oursAdapter(provider, profile);
    const b = stockAdapter(provider, profile);
    const info = await a.resolveModel(PROVIDER, MODEL);
    expect(info).toEqual(await b.resolveModel(PROVIDER, MODEL));
    expect(info).toEqual({
      provider: PROVIDER, id: MODEL, name: "Fake Model", inputModalities: ["text", "image"],
      context: { contextWindow: 4096 }, defaultMaxTokens: 512,
      reasoning: {
        efforts: [
          { id: "off", name: "Off" }, { id: "minimal", name: "Minimal" }, { id: "low", name: "Low" },
          { id: "medium", name: "Medium" }, { id: "high", name: "High" },
        ],
        defaultEffort: "high",
      },
    });
    expect(a.providerInfo(PROVIDER)).toEqual(b.providerInfo(PROVIDER));
    expect(a.providerInfo(PROVIDER)).toEqual({ id: PROVIDER, name: "fake-route" });
  });
});

describe("error: transport ném, HTTP lỗi, huỷ/abort, timeout, stream đóng", () => {
  test("transport ném lỗi mạng: finish error TRANSPORT, không throw, A/B", async () => {
    const { chunks } = await streamBoth(
      () => { throw new Error("network connection refused"); },
      textRequest(),
    );
    expect(chunks).toEqual([
      { type: "usage", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
      { type: "finish", reason: { kind: "error", failure: { message: "network connection refused", code: "TRANSPORT" } } },
    ]);
  });

  test("HTTP 401/429/500 ánh xạ AUTH/RATE_LIMIT/SERVER, A/B", async () => {
    const cases: [string, string][] = [
      ["HTTP 401 Unauthorized", "AUTH"],
      ["HTTP 429 Too Many Requests", "RATE_LIMIT"],
      ["HTTP 500 Internal Server Error", "SERVER"],
    ];
    for (const [text, code] of cases) {
      const error = piMessage({ content: [], stopReason: "error", errorMessage: text, usage: ZERO_PI_USAGE });
      const { chunks } = await streamBoth(
        () => eventStream([{ type: "error", reason: "error", error }]),
        textRequest(),
      );
      expect(chunks.at(-1)?.reason).toEqual({ kind: "error", failure: { message: text, code } });
    }
  });

  test("caller huỷ GIỮA stream: error event thành finish aborted, A/B", async () => {
    const error = piMessage({ content: [], stopReason: "error", errorMessage: "caller cancelled", usage: ZERO_PI_USAGE });
    const abortHandler = (controller: AbortController): Handler => () => (async function* () {
      yield { type: "start", partial: error };
      controller.abort();
      yield { type: "error", reason: "error", error };
    })();
    const controllerOurs = new AbortController();
    const controllerStock = new AbortController();
    const ours = oursAdapter(fakeProvider(abortHandler(controllerOurs)));
    const stockSide = stockAdapter(fakeProvider(abortHandler(controllerStock)));
    const chunks = await collect(ours.stream(textRequest({ signal: controllerOurs.signal })));
    const stockChunks = await collect(stockSide.stream(textRequest({ signal: controllerStock.signal })));
    expect(chunks).toEqual(stockChunks);
    expect(chunks.at(-1)?.reason).toEqual({
      kind: "aborted",
      failure: { message: "caller cancelled", code: "ABORTED" },
    });
  });

  test("huỷ thắng lỗi context: adapter ném ABORTED, A/B", async () => {
    const request = textRequest({
      signal: AbortSignal.abort(),
      messages: [{ role: "user", content: [{ type: "image", attachment: { attachmentId: "a1" } }] }],
    });
    const { oursError } = await failingStreamBoth(() => { throw new Error("must not run"); }, request);
    expect(errorShape(oursError)).toEqual({
      name: "LlmError",
      message: "pi-ai request aborted by caller",
      code: "ABORTED",
    });
  });

  test("idle timeout: watchdog ném TIMEOUT, A/B", async () => {
    const handler: Handler = () => (async function* () {
      yield { type: "start", partial: piMessage() };
      await new Promise(() => {});
    })();
    const { oursError } = await failingStreamBoth(handler, textRequest(), { streamIdleTimeoutMs: 25 });
    expect(errorShape(oursError)).toEqual({
      name: "LlmError",
      message: "pi-ai stream idle timeout after 25ms",
      code: "TIMEOUT",
    });
  });

  test("stream đóng trước done/error: STREAM_CLOSED, A/B", async () => {
    const { oursError } = await failingStreamBoth(
      () => eventStream([{ type: "start", partial: piMessage() }]),
      textRequest(),
    );
    expect(errorShape(oursError)).toEqual({
      name: "LlmError",
      message: "pi-ai event stream ended without done/error",
      code: "STREAM_CLOSED",
    });
  });
});

describe("retry policy: chụp bất biến, adapter không tự retry", () => {
  const normalPolicy = {
    mode: "normal",
    maxRetries: 5,
    retryableCodes: ["EMPTY_RESPONSE", "RATE_LIMIT", "SERVER", "TIMEOUT", "TRANSPORT"],
    initialDelayMs: 500,
    maxDelayMs: 10000,
    jitterRatio: 0.1,
  };

  test("mặc định normal + policy always đều khớp bản gốc", () => {
    const plain = { a: oursAdapter(fakeProvider(() => { throw new Error("unused"); })), b: stockAdapter(fakeProvider(() => { throw new Error("unused"); })) };
    expect(plain.a.providerRetryPolicy(PROVIDER)).toEqual(normalPolicy);
    expect(plain.a.providerRetryPolicy(PROVIDER)).toEqual(plain.b.providerRetryPolicy(PROVIDER));

    const profile = {
      retryPolicy: { mode: "always", backoff: { initialDelayMs: 25, maxDelayMs: 50, jitterRatio: 0 } },
    };
    const a = oursAdapter(fakeProvider(() => { throw new Error("unused"); }), profile);
    const b = stockAdapter(fakeProvider(() => { throw new Error("unused"); }), profile);
    expect(a.providerRetryPolicy(PROVIDER)).toEqual({ mode: "always", initialDelayMs: 25, maxDelayMs: 50, jitterRatio: 0 });
    expect(a.providerRetryPolicy(PROVIDER)).toEqual(b.providerRetryPolicy(PROVIDER));
    expect(a.providerRetryPolicy("missing")).toBeUndefined();
  });

  test("một lượt stream: maxRetries 0, transport chỉ chạy đúng một lần, A/B", async () => {
    const done = piMessage();
    const { captured, chunks } = await streamBoth(
      () => eventStream([
        { type: "start", partial: done },
        { type: "done", reason: "stop", message: done },
      ]),
      textRequest(),
      { retryPolicy: { mode: "always", backoff: { initialDelayMs: 1, maxDelayMs: 2, jitterRatio: 0 } } },
    );
    expect(captured).toHaveLength(1);
    expect(captured[0]!.options.maxRetries).toBe(0);
    expect(chunks.filter((chunk) => chunk.type === "finish")).toHaveLength(1);
    expect(chunks.at(-1)?.reason).toEqual({ kind: "stop" });
  });
});

describe("replay: toPiReplayState ↔ toPiAssistant round-trip + degrade", () => {
  test("round-trip giữ text/thinking/tool-call signature, lossless", () => {
    const pi = piMessage({
      content: [
        { type: "text", text: "hello", textSignature: "ts" },
        { type: "thinking", thinking: "why", thinkingSignature: "th", redacted: true },
        { type: "toolCall", id: "call-1", name: "lookup", arguments: { q: "x" }, thoughtSignature: "tsig", namespace: "ns" },
      ],
      stopReason: "toolUse",
      responseModel: "resp-model-2",
      responseId: "resp-1",
      providerThinkingLevel: "high",
    });
    const state = toPiReplayState(pi as any, MODEL);
    const harness: AnyRecord = {
      role: "assistant",
      content: [
        { type: "text", text: "hello" },
        { type: "reasoning", text: "why" },
        { type: "tool-call", id: "call-1", name: "lookup", arguments: '{"q":"x"}' },
      ],
      source: { provider: PROVIDER, model: MODEL, replayState: state },
    };
    const back = toPiAssistant(harness as any);
    expect(back as any).toEqual({
      role: "assistant",
      content: [
        { type: "text", text: "hello", textSignature: "ts" },
        { type: "thinking", thinking: "why", thinkingSignature: "th", redacted: true },
        { type: "toolCall", id: "call-1", name: "lookup", arguments: { q: "x" }, thoughtSignature: "tsig", namespace: "ns" },
      ],
      api: "openai-completions",
      provider: PROVIDER,
      model: MODEL,
      responseModel: "resp-model-2",
      responseId: "resp-1",
      providerThinkingLevel: "high",
      usage: ZERO_PI_USAGE,
      stopReason: "toolUse",
      timestamp: 0,
    });
    expect(toPiReplayState(back as any, MODEL)).toEqual(state);
  });

  test("state hỏng hạ cấp MỘT message + báo lý do, không ném", () => {
    const state = toPiReplayState(piMessage() as any, MODEL);
    const harness: AnyRecord = {
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
      source: { provider: PROVIDER, model: MODEL, replayState: state },
    };
    const reasons: string[] = [];
    const foreign = toPiAssistant(
      { ...harness, source: { ...harness.source, replayState: { ...state, response: { ...(state.response as any), version: 1 } } } } as any,
      (reason) => reasons.push(reason),
    );
    expect(reasons).toEqual(["invalid pi-ai replay state: unsupported version 1"]);
    expect(foreign.api).toBe("dsh-foreign");
    expect(foreign.content).toEqual([{ type: "text", text: "hello" }]);
    expect(foreign.stopReason).toBe("stop");

    const plainReasons: string[] = [];
    const plain = toPiAssistant(
      { ...harness, source: { provider: PROVIDER, model: MODEL } } as any,
      (reason) => plainReasons.push(reason),
    );
    expect(plainReasons).toEqual([]);
    expect(plain.api).toBe("dsh-foreign");
  });

  test("provider/model/block count lệch đều degrade thay vì ném", () => {
    const state = toPiReplayState(piMessage() as any, MODEL);
    const harness: AnyRecord = {
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
      source: { provider: PROVIDER, model: MODEL, replayState: state },
    };
    const cases: [AnyRecord, string][] = [
      [{ ...harness, source: { ...harness.source, provider: "other" } }, "provider does not match assistant source"],
      [{ ...harness, source: { ...harness.source, model: "other-model" } }, "model does not match assistant source"],
      [{ ...harness, source: { ...harness.source, replayState: { ...state, blocks: [] } } }, "block count does not match assistant content"],
    ];
    for (const [message, reason] of cases) {
      const reasons: string[] = [];
      const foreign = toPiAssistant(message as any, (seen) => reasons.push(seen));
      expect(reasons).toEqual([`invalid pi-ai replay state: ${reason}`]);
      expect(foreign.api).toBe("dsh-foreign");
    }
  });

  test("adapter dựng lại assistant history từ replay state, A/B", async () => {
    const state = toPiReplayState(piMessage({
      content: [
        { type: "text", text: "hello", textSignature: "sig-text" },
        { type: "toolCall", id: "call-1", name: "lookup", arguments: { q: "x" }, thoughtSignature: "sig-call" },
      ],
      stopReason: "toolUse",
    }) as any, MODEL);
    const request = {
      provider: PROVIDER,
      model: MODEL,
      messages: [
        { role: "user", content: [{ type: "text", text: "go" }] },
        {
          role: "assistant",
          content: [
            { type: "text", text: "hello" },
            { type: "tool-call", id: "call-1", name: "lookup", arguments: '{"q":"x"}' },
          ],
          source: { provider: PROVIDER, model: MODEL, replayState: state },
        },
        { role: "tool", toolCallId: "call-1", content: [{ type: "text", text: "done" }] },
      ],
    };
    const done = piMessage();
    const { captured, chunks } = await streamBoth(
      () => eventStream([
        { type: "start", partial: done },
        { type: "done", reason: "stop", message: done },
      ]),
      request,
    );
    const messages = captured[0]!.context.messages;
    expect(messages[1]!.content[0]!.textSignature).toBe("sig-text");
    expect(messages[1]!.content[1]!.thoughtSignature).toBe("sig-call");
    expect(messages[2]).toMatchObject({ role: "toolResult", toolCallId: "call-1", toolName: "lookup" });
    expect(chunks.at(-1)?.reason).toEqual({ kind: "stop" });
  });
});
