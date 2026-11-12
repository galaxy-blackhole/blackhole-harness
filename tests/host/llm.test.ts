/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-llm — so sâu message/error/api-key/retry/content/stream/runtime với bundle gốc, không gọi mạng.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** node_modules của kernel: đích symlink cho dep external của cả hai bản. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Bundle GỐC đã build trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(APP_MODULES, "@deepseek-ai", "dsh-llm", "lib", "index.js");
/** cordis của kernel — hai bên dùng CHUNG một lớp Context. */
const CORDIS = join(APP_MODULES, "@deepseek-ai", "cordis", "lib", "index.js");
/** typert của kernel — đọc marker @Remote trên prototype service. */
const TYPERT = join(APP_MODULES, "@deepseek-ai", "dsh-typert-protocol", "lib", "index.js");

/** Bề mặt module động + kết quả đo + hình dạng lỗi dùng cho phép so sâu xuyên hai bản cài. */
type AnyModule = Record<string, any>;
type Snapshot = { ok: true; value: unknown } | { ok: false; error: ErrorShape };
interface ErrorShape {
  name: string;
  message: string;
  code?: string;
  failure?: unknown;
  cause?: unknown;
}

/** build.ts nạp ĐỘNG: đường dẫn tính lúc chạy nên tsc không kéo build vào chương trình test. */
const { buildPackage } = (await import("../../packages/host/llm/build.ts")) as {
  buildPackage(outDir?: string): Promise<{ service: string }>;
};

/** Thư mục tạm; node_modules + package.json symlink nằm ở cha để build không xoá mất. */
const TMP = mkdtempSync(join(tmpdir(), "gbh-llm-"));
symlinkSync(APP_MODULES, join(TMP, "node_modules"), "dir");
symlinkSync(join(REPO, "packages", "host", "llm", "package.json"), join(TMP, "package.json"));
/** Artifact service của ta (build.ts trả object entry; lấy index.js). */
const ARTIFACT = (await buildPackage(join(TMP, "pkg"))).service;
/** Bản của ta, nạp từ artifact vừa build. */
const ours = (await import(pathToFileURL(ARTIFACT).href)) as AnyModule;
/** Bản gốc trong kernel, nạp cùng cách. */
const stock = (await import(pathToFileURL(STOCK).href)) as AnyModule;
/** Context cordis THẬT của kernel. */
const { Context } = (await import(pathToFileURL(CORDIS).href)) as { Context: new () => object };
/** Đọc marker @Remote của một service. */
const { remoteMethods } = (await import(pathToFileURL(TYPERT).href)) as {
  remoteMethods(service: unknown): unknown;
};

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

/** Ảnh chuẩn dùng chung cho fixture content. */
/** Version thật của hai package — APP_IDENTITY đọc chính package.json của nó. */
const OURS_VERSION = (JSON.parse(readFileSync(join(REPO, "packages", "host", "llm", "package.json"), "utf8")) as { version: string }).version;
const STOCK_VERSION = (JSON.parse(readFileSync(join(APP_MODULES, "@deepseek-ai", "dsh-llm", "package.json"), "utf8")) as { version: string }).version;

const IMAGE = { attachmentId: "a".repeat(64), mediaType: "image/png", bytes: 1234, width: 640, height: 480, name: "cat.png" } as const;

/** Ảnh thứ hai, khác id/tên. */
const IMAGE_2 = { ...IMAGE, attachmentId: "b".repeat(64), name: "dog.png" } as const;

/** Tệp chuẩn dùng chung cho fixture content. */
const FILE = { attachmentId: "c".repeat(64), name: "notes.txt", bytes: 2048 } as const;

/** Chuẩn hoá Error thành hình dạng so sánh được, đệ quy theo cause; trả nguyên giá trị nếu không phải Error. */
function shapeCause(value: unknown): unknown {
  if (!(value instanceof Error)) return value;
  const result: ErrorShape = { name: value.name, message: value.message };
  const code = (value as { code?: unknown }).code;
  if (typeof code === "string") result.code = code;
  const failure = (value as { failure?: unknown }).failure;
  if (failure !== undefined) result.failure = failure;
  const cause = (value as { cause?: unknown }).cause;
  if (cause !== undefined) result.cause = shapeCause(cause);
  return result;
}

/** Chụp một lượt gọi đồng bộ thành Snapshot, không ném ra ngoài. */
function capture(run: () => unknown): Snapshot {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    return { ok: false, error: shapeCause(error) as ErrorShape };
  }
}

/** Chụp một lượt gọi bất đồng bộ thành Snapshot, không ném ra ngoài. */
async function captureAsync(run: () => Promise<unknown>): Promise<Snapshot> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error: shapeCause(error) as ErrorShape };
  }
}

/** Chạy CÙNG một phép đo trên gói ta và gói gốc rồi so sâu; trả hai Snapshot. */
function abSync(run: (mod: AnyModule) => unknown): Snapshot {
  const mine = capture(() => run(ours));
  const theirs = capture(() => run(stock));
  expect(mine).toEqual(theirs);
  return mine;
}

/** Bản async của abSync cho các phép đo phải await. */
async function abAsync(run: (mod: AnyModule) => Promise<unknown>): Promise<Snapshot> {
  const mine = await captureAsync(() => run(ours));
  const theirs = await captureAsync(() => run(stock));
  expect(mine).toEqual(theirs);
  return mine;
}

/** Lấy value từ Snapshot đã so; ném nếu phép đo của ta thất bại. */
function valueOf(snapshot: Snapshot): any {
  if (!snapshot.ok) throw new Error("A/B snapshot failed: " + snapshot.error.message);
  return snapshot.value;
}

/** Chuẩn hoá id ngẫu nhiên của message thành "<id>" để so phần còn lại. */
function normalizeMessage(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const id = record["id"];
  return {
    ...record,
    id: typeof id === "string" && id.length > 0 ? "<id>" : id,
  };
}

/** Chuẩn hoá một dãy message. */
function normalizeMessages(value: unknown): unknown[] {
  return (value as unknown[]).map(normalizeMessage);
}

/** Message fixture: user có text/image/file và user text thuần. */
function fixtureMessages(mod: AnyModule): any[] {
  return [
    mod.createUserMessage({
      content: [{ type: "text", text: "look" }, { type: "image", attachment: IMAGE }, { type: "file", attachment: FILE }],
      source: { kind: "user" },
    }),
    mod.createUserMessage({ content: [{ type: "text", text: "plain" }], source: { kind: "user" } }),
  ];
}

/** Dãy chunk đầy đủ cho BlockAssembler: text, reasoning, tool-call, usage, finish + replay. */
function fixtureChunks(mod: AnyModule): any[] {
  return [
    { type: "block-start", index: 0, blockType: "text" },
    { type: "text-delta", index: 0, text: "Hello " },
    { type: "text-delta", index: 0, text: "world" },
    { type: "block-end", index: 0, block: { type: "text", text: "Hello world" } },
    { type: "block-start", index: 1, blockType: "reasoning" },
    { type: "reasoning-delta", index: 1, text: "think " },
    { type: "block-end", index: 1, block: { type: "reasoning", text: "think more" } },
    { type: "block-start", index: 2, blockType: "tool-call" },
    { type: "tool-call-delta", index: 2, id: mod.ToolCallId("call-1"), name: "grep", argumentsDelta: '{"q":' },
    { type: "tool-call-delta", index: 2, id: mod.ToolCallId("call-1"), argumentsDelta: '"x"}' },
    { type: "usage", usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
    { type: "finish", reason: { kind: "tool-calls" }, replayState: { response: { id: "resp-1" }, blocks: [{ n: 1 }, { n: 2 }, { n: 3 }] } },
  ];
}

/** Compact stream record fixture cho assistant-stream: ba run nén + usage + finish thô. */
function fixtureRecords(mod: AnyModule): any[] {
  return [
    { type: "text-chunks", time0: 100, index: 0, dt: [10], texts: ["Hello ", "world"] },
    { type: "reasoning-chunks", time0: 200, index: 1, dt: [], texts: [" think"] },
    { type: "tool-call-chunks", time0: 300, index: 2, dt: [1], id: mod.ToolCallId("call-1"), name: "grep", args: ["{", "}"] },
    { type: "chunk", time: 400, chunk: { type: "usage", usage: { inputTokens: 1, outputTokens: 2 } } },
    { type: "chunk", time: 401, chunk: { type: "finish", reason: { kind: "stop" } } },
  ];
}

/** Adapter GIẢ theo đúng d.ts LlmAdapter — không chạm mạng. */
function fakeAdapter(mod: AnyModule, calls: string[]): any {
  class FakeAdapter extends mod.LlmAdapter {
    /** Metadata provider cố định. */
    providerInfo(provider: string): unknown {
      return { id: provider, name: "Fake " + provider };
    }

    /** Catalog cố định, đúng yêu cầu provider/id/name của runtime. */
    async listModels(provider: string): Promise<unknown[]> {
      return [{ provider, id: "fake-1", name: "Fake One" }];
    }

    /** Metadata model cố định, không I/O. */
    async resolveModel(provider: string, model: string): Promise<unknown> {
      return { provider, id: model, name: "Fake One", context: { contextWindow: 128000 }, reasoning: { efforts: [{ id: mod.ReasoningEffortId("low"), name: "Low" }], defaultEffort: mod.ReasoningEffortId("low") } };
    }

    /** Stream hai chunk cố định, ghi lại route đã gọi. */
    async *stream(options: any): AsyncIterable<unknown> {
      calls.push(options.provider + "/" + options.model);
      yield { type: "text-delta", index: 0, text: "hello" };
      yield { type: "finish", reason: { kind: "stop" } };
    }
  }
  return new FakeAdapter();
}

describe("message — constructor + freeze + MessageId", () => {
  test("create* / createMessage / freezeMessage: cùng shape sâu, id tươi, immutable", () => {
    const run = (mod: AnyModule) => {
      const user = mod.createUserMessage({
        content: [{ type: "text", text: "hi" }],
        source: { kind: "user" },
      });
      const assistant = mod.createAssistantMessage({
        content: [{ type: "text", text: "hello" }],
        source: { provider: "fake", model: "fake-1" },
      });
      const system = mod.createSystemMessage("You are helpful.");
      const developer = mod.createDeveloperMessage({
        content: [{ type: "tool-addition", toolName: "grep" }],
        source: { kind: "user" },
      });
      const tool = mod.createToolResultMessage({
        callId: mod.ToolCallId("call-9"),
        content: [{ type: "text", text: "result" }],
        isError: true,
      });
      const created = mod.createMessage({
        role: "user",
        content: [{ type: "text", text: "raw" }],
        source: { kind: "user" },
      });
      const frozen = mod.freezeMessage({
        id: mod.MessageId("fixed-id"),
        role: "assistant",
        content: [{ type: "text", text: "kept" }],
        source: { kind: "model", provider: "p", model: "m" },
      });
      const all = [user, assistant, system, developer, tool, created, frozen];
      return {
        user: normalizeMessage(user),
        assistant: normalizeMessage(assistant),
        system: normalizeMessage(system),
        developer: normalizeMessage(developer),
        tool: normalizeMessage(tool),
        created: normalizeMessage(created),
        frozen: normalizeMessage(frozen),
        frozenId: frozen.id,
        idsAreFreshStrings: all.map((message) => typeof message.id === "string" && message.id.length > 0),
        frozenFlags: all.map((message) => [
          Object.isFrozen(message),
          Object.isFrozen(message.content),
          Object.isFrozen(message.content[0]),
        ]),
        mutations: all.map((message) =>
          capture(() => {
            (message.content as unknown[]).push({ type: "text", text: "late" });
          }),
        ),
        messageId: {
          value: mod.MessageId("stable"),
          sameAsString: mod.MessageId("stable") === "stable",
          kind: typeof mod.MessageId("stable"),
        },
      };
    };
    const value = valueOf(abSync(run));
    expect(value.user.id).toBe("<id>");
    expect(value.frozenId).toBe("fixed-id");
    expect(value.user.role).toBe("user");
    expect(value.assistant.source).toEqual({ kind: "model", provider: "fake", model: "fake-1" });
    expect(value.system.source).toEqual({ kind: "system-prompt" });
    expect(value.tool.toolCallId).toBe("call-9");
    expect(value.idsAreFreshStrings.every(Boolean)).toBe(true);
    expect(value.frozenFlags.every((flags: boolean[]) => flags.every(Boolean))).toBe(true);
    expect(value.mutations.every((snapshot: Snapshot) => snapshot.ok === false)).toBe(true);
    expect(value.messageId).toEqual({ value: "stable", sameAsString: true, kind: "string" });
  });
});

describe("error — HarnessError / LlmError / predicates / chain", () => {
  test("HarnessError + LlmError: name, code, failure, cause, instanceof", () => {
    const run = (mod: AnyModule) => {
      const inner = new Error("inner");
      const base = new mod.HarnessError("boom", "BOOM", { cause: inner });
      const llm = new mod.LlmError("bad", "AUTH", {
        cause: base,
        status: 401,
        providerRetryAfterMs: 1200,
        requestId: mod.ProviderRequestId("req-1"),
        offloadImages: 2,
      });
      return {
        base: shapeCause(base),
        llm: shapeCause(llm),
        baseInstance: [base instanceof Error, base instanceof mod.HarnessError, mod.isHarnessError(base)],
        llmInstance: [
          llm instanceof Error,
          llm instanceof mod.HarnessError,
          llm instanceof mod.LlmError,
          mod.isHarnessError(llm),
        ],
        failure: llm.failure,
        keys: Object.keys(llm).sort(),
        causeIsBase: llm.cause === base,
        codeConstants: [
          mod.CONTEXT_WINDOW_EXCEEDED_CODE,
          mod.QUOTA_EXCEEDED_CODE,
          mod.ACCOUNT_QUOTA_EXCEEDED_CODE,
          mod.EMPTY_RESPONSE_CODE,
          mod.INVALID_CREDENTIAL_CODE,
          mod.IMAGE_OFFLOAD_REQUIRED_CODE,
        ],
      };
    };
    const value = valueOf(abSync(run));
    expect(value.llm.name).toBe("LlmError");
    expect(value.llm.code).toBe("AUTH");
    expect(value.failure).toEqual({
      message: "bad",
      code: "AUTH",
      status: 401,
      providerRetryAfterMs: 1200,
      requestId: "req-1",
      offloadImages: 2,
    });
    expect(value.baseInstance).toEqual([true, true, true]);
    expect(value.llmInstance).toEqual([true, true, true, true]);
    expect(value.codeConstants).toEqual([
      "CONTEXT_WINDOW_EXCEEDED",
      "QUOTA",
      "ACCOUNT_QUOTA",
      "EMPTY_RESPONSE",
      "INVALID_CREDENTIAL",
      "IMAGE_OFFLOAD_REQUIRED",
    ]);
  });

  test("LlmError từ chối option sai với cùng thông điệp", () => {
    const run = (mod: AnyModule) =>
      [
        { status: 0 },
        { status: 99 },
        { status: 600 },
        { status: 1.5 },
        { providerRetryAfterMs: 0 },
        { providerRetryAfterMs: 1.5 },
        { requestId: "" },
        { offloadImages: 0 },
        { offloadImages: -1 },
      ].map((options) => capture(() => new mod.LlmError("x", "Y", options)));
    const first = (valueOf(abSync(run)) as Snapshot[])[0]!;
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.error.message).toBe("LlmError status must be an integer from 100 through 599");
  });

  test("isHarnessError + isQuotaExceededError + isContextWindowExceededError trên bảng mã", () => {
    const run = (mod: AnyModule) => ({
      harness: [
        mod.isHarnessError(new mod.HarnessError("x", "X")),
        mod.isHarnessError(new mod.LlmError("x", "Y")),
        mod.isHarnessError(new Error("x")),
        mod.isHarnessError({ name: "HarnessError", code: "X" }),
        mod.isHarnessError(null),
        mod.isHarnessError("x"),
      ],
      predicates: [
        "context length exceeded",
        "maximum context length is 128000 tokens",
        "This model's maximum context length is 8192 tokens",
        "rate limit reached",
        "insufficient balance",
        "quota exceeded",
        "you have exceeded your current quota",
        "RESOURCE_EXHAUSTED",
        "invalid api key",
        "normal failure",
        "credit balance is too low",
      ].map((detail) => [
        detail,
        mod.isContextWindowExceededError(detail),
        mod.isQuotaExceededError(detail),
      ]),
    });
    const value = valueOf(abSync(run));
    expect(value.harness).toEqual([true, true, false, false, false, false]);
  });

  test("errorChain: cause chain, cause trùng, AggregateError, giá trị lạ", () => {
    const run = (mod: AnyModule) => {
      const chain = new Error("outer", { cause: new Error("inner", { cause: new Error("root") }) });
      const repeated = new Error("same", { cause: new Error("same") });
      const aggregate = new AggregateError([new Error("a"), new Error("b")], "agg");
      const harness = new mod.HarnessError("wrapped", "W", { cause: chain });
      return {
        chain: mod.errorChain(chain),
        repeated: mod.errorChain(repeated),
        aggregate: mod.errorChain(aggregate),
        harness: mod.errorChain(harness),
        plain: mod.errorChain("plain"),
        object: mod.errorChain({ message: "obj" }),
        nullValue: mod.errorChain(null),
        undefinedValue: mod.errorChain(undefined),
      };
    };
    const value = valueOf(abSync(run));
    expect(value.chain).toBe("outer: inner: root");
    expect(value.aggregate).toBe("agg [a; b]");
  });
});

describe("api-key — normalize + assertUsableApiKey", () => {
  test("normalizeApiKey: trim/empty/illegal trên bảng giá trị", () => {
    const run = (mod: AnyModule) => {
      const values = [
        "  sk-abc  ",
        "",
        "   ",
        "sk-abc def",
        "sk-abcé",
        "sk-abc\n",
        "\tsk-1\t",
        "aaaaa",
      ];
      return {
        checks: values.map((value) => [value, mod.normalizeApiKey(value)]),
        invalidCode: mod.INVALID_CREDENTIAL_CODE,
      };
    };
    const value = valueOf(abSync(run));
    expect(value.checks[0]).toEqual(["  sk-abc  ", { ok: true, value: "sk-abc" }]);
    expect(value.invalidCode).toBe("INVALID_CREDENTIAL");
  });

  test("assertUsableApiKey: hợp lệ trả key trim; rỗng/ký tự lạ ném INVALID_CREDENTIAL", () => {
    const run = (mod: AnyModule) => ({
      valid: capture(() => mod.assertUsableApiKey("  sk-ok  ", "pkg-x", "env:KEY")),
      empty: capture(() => mod.assertUsableApiKey("   ", "pkg-x", "env:KEY")),
      illegal: capture(() => mod.assertUsableApiKey("sk-é", "pkg-x", "env:KEY")),
    });
    const value = valueOf(abSync(run));
    expect(value.valid).toEqual({ ok: true, value: "sk-ok" });
    expect(value.empty.ok).toBe(false);
    expect(value.empty.error.code).toBe("INVALID_CREDENTIAL");
    expect(value.empty.error.message).toContain("env:KEY");
  });
});

describe("retry-policy + call-config — mặc định, custom, sai, equality", () => {
  test("RetryPolicySchema + resolveRetryPolicy: mặc định/custom/always", () => {
    const run = (mod: AnyModule) => ({
      schema: String(mod.RetryPolicySchema),
      resolved: [
        mod.resolveRetryPolicy(undefined, "provider.fake"),
        mod.resolveRetryPolicy({ mode: "normal" }, "provider.fake"),
        mod.resolveRetryPolicy(
          {
            mode: "normal",
            maxRetries: 2,
            retryableCodes: ["AUTH", "TIMEOUT"],
            backoff: { initialDelayMs: 10, maxDelayMs: 99, jitterRatio: 0 },
          },
          "provider.fake",
        ),
        mod.resolveRetryPolicy({ mode: "always" }, "provider.fake"),
        mod.resolveRetryPolicy({ mode: "always", backoff: { initialDelayMs: 1 } }, "provider.fake"),
      ],
    });
    const value = valueOf(abSync(run));
    expect(value.schema).toContain('mode: "normal"');
    expect(value.resolved[0]).toEqual({
      mode: "normal",
      maxRetries: 5,
      retryableCodes: ["EMPTY_RESPONSE", "RATE_LIMIT", "SERVER", "TIMEOUT", "TRANSPORT"],
      initialDelayMs: 500,
      maxDelayMs: 10000,
      jitterRatio: 0.1,
    });
    expect(value.resolved[2].retryableCodes).toEqual(["AUTH", "TIMEOUT"]);
    expect(value.resolved[3].mode).toBe("always");
  });

  test("resolveRetryPolicy từ chối cấu hình sai với cùng thông điệp/path", () => {
    const run = (mod: AnyModule) =>
      [
        { mode: "bogus" },
        { mode: "normal", maxRetries: -1 },
        { mode: "normal", maxRetries: 1.5 },
        { mode: "normal", retryableCodes: [""] },
        { mode: "normal", retryableCodes: "AUTH" },
        { mode: "normal", backoff: { jitterRatio: 2 } },
        { mode: "normal", backoff: { maxDelayMs: -1 } },
        { mode: "normal", extra: 1 },
        null,
        "normal",
      ].map((config) => capture(() => mod.resolveRetryPolicy(config, "cfg.path")));
    const snapshots = valueOf(abSync(run)) as Snapshot[];
    // Narrow qua BIẾN CỤC BỘ: `snapshots[0]` là `Snapshot | undefined` dưới `noUncheckedIndexedAccess`, và
    // truy cập qua chỉ số không narrow được union `ok` ⇒ `.error` bị TS2339. Một biến + kiểm `undefined` là đủ.
    const first = snapshots[0];
    if (first === undefined) throw new Error("thiếu snapshot đầu tiên");
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.error.message).toBe('cfg.path.mode must be "normal" or "always"');
    const last = snapshots[7];
    if (last === undefined) throw new Error("thiếu snapshot thứ 8");
    expect(last.ok).toBe(false);
  });

  test("callConfigEquals: từng cặp + markAgentLoopRequest/isAgentLoopRequest", () => {
    const run = (mod: AnyModule) => {
      const base = {
        provider: "p",
        model: "m",
        reasoningEffort: "high",
        temperature: 0.2,
        maxTokens: 100,
        stop: ["a", "b"],
      };
      const pairs: [any, any][] = [
        [base, { ...base }],
        [base, { ...base, stop: ["a", "b"] }],
        [base, { ...base, stop: ["b", "a"] }],
        [base, { ...base, temperature: 0.3 }],
        [{ provider: "p", model: "m" }, { provider: "p", model: "m", temperature: undefined }],
        [{ provider: "p", model: "m", stop: [] }, { provider: "p", model: "m" }],
        [{ provider: "p", model: "m", stop: ["a"] }, { provider: "p", model: "m", stop: ["a", "b"] }],
      ];
      const request = { provider: "p", model: "m", messages: [] };
      const marked = mod.markAgentLoopRequest(request);
      return {
        equals: pairs.map(([a, b]) => mod.callConfigEquals(a, b)),
        marker: {
          sameObject: marked === request,
          marked: mod.isAgentLoopRequest(marked),
          bare: mod.isAgentLoopRequest(request),
          copy: mod.isAgentLoopRequest({ ...request }),
        },
      };
    };
    const value = valueOf(abSync(run));
    expect(value.equals).toEqual([true, true, false, false, true, false, false]);
    expect(value.marker).toEqual({ sameObject: true, marked: true, bare: true, copy: false });
  });
});

describe("content — block flags + handle text", () => {
  test("contentHasFile/contentHasImage trên fixture block", () => {
    const run = (mod: AnyModule) => {
      const cases = [
        [],
        [{ type: "text", text: "x" }],
        [{ type: "image", attachment: IMAGE }],
        [{ type: "file", attachment: FILE }],
        [{ type: "image", attachment: IMAGE, offloaded: true }],
        [{ type: "tool-call", id: mod.ToolCallId("c"), name: "t", arguments: "{}" }],
      ];
      return {
        image: cases.map((content) => mod.contentHasImage(content)),
        file: cases.map((content) => mod.contentHasFile(content)),
      };
    };
    const value = valueOf(abSync(run));
    expect(value.image).toEqual([false, false, true, false, true, false]);
  });

  test("textOnlyImageText/requestImageHandleText/offloadedImageText/fileHandleText", () => {
    const run = (mod: AnyModule) => ({
      textOnly: mod.textOnlyImageText(IMAGE),
      requestNoAccess: mod.requestImageHandleText(IMAGE, { width: 320, height: 240 }),
      requestAccess: mod.requestImageHandleText(
        IMAGE,
        { width: 320, height: 240 },
        { readonlyPath: "/work/img.png" },
      ),
      offNoAccess: mod.offloadedImageText(IMAGE),
      offAccess: mod.offloadedImageText(IMAGE, { readonlyPath: "/work/img.png" }),
      file: mod.fileHandleText(FILE, "/work/notes.txt"),
      fileNoPath: mod.fileHandleText(FILE, undefined),
    });
    const value = valueOf(abSync(run));
    expect(value.textOnly).toContain("text only");
    expect(value.requestNoAccess).toContain("cat.png");
    expect(value.requestAccess).toContain("/work/img.png");
    expect(value.offNoAccess).toContain("cat.png");
    expect(value.offAccess).toContain("/work/img.png");
    expect(value.file).toContain("notes.txt");
    expect(value.file).toContain("/work/notes.txt");
    expect(value.fileNoPath).toContain("notes.txt");
    expect(value.fileNoPath).not.toContain("/work/notes.txt");
  });

  test("projectFilesToText: message bền + RequestUserInput, có/không đường dẫn", () => {
    const run = (mod: AnyModule) => {
      const messages = fixtureMessages(mod);
      const before = JSON.stringify(messages);
      const withPath = mod.projectFilesToText(messages, (ref: any) =>
        ref.attachmentId === FILE.attachmentId ? "/work/notes.txt" : undefined,
      );
      const noPath = mod.projectFilesToText(messages, () => undefined);
      const inputs = [{ role: "user", content: [{ type: "file", attachment: FILE }] }];
      const requestProjection = mod.projectFilesToText(inputs, () => "/work/notes.txt");
      return {
        withPath: normalizeMessages(withPath),
        noPath: normalizeMessages(noPath),
        requestProjection: normalizeMessages(requestProjection),
        unchanged: JSON.stringify(messages) === before,
      };
    };
    const value = valueOf(abSync(run));
    expect(value.unchanged).toBe(true);
    expect(value.withPath[0].content[2].type).toBe("text");
    expect(value.withPath[0].content[2].text).toContain("/work/notes.txt");
    expect(value.noPath[0].content[2].text).toContain("cannot access");
  });

  test("projectImagesForTextModel/projectOffloadedImages: thay ảnh bằng text", () => {
    const run = (mod: AnyModule) => {
      const messages = [
        mod.createUserMessage({
          content: [
            { type: "text", text: "look" },
            { type: "image", attachment: IMAGE, offloaded: true },
            { type: "image", attachment: IMAGE_2 },
          ],
          source: { kind: "user" },
        }),
      ];
      const inputs = [
        { role: "user", content: [{ type: "image", attachment: IMAGE }, { type: "text", text: "hi" }] },
      ];
      return {
        textOnly: normalizeMessages(mod.projectImagesForTextModel(messages)),
        offloaded: normalizeMessages(
          mod.projectOffloadedImages(messages, (ref: any) => "OFF:" + ref.attachmentId),
        ),
        requestProjection: normalizeMessages(mod.projectImagesForTextModel(inputs)),
      };
    };
    const value = valueOf(abSync(run));
    expect(value.textOnly[0].content.every((block: any) => block.type !== "image")).toBe(true);
    expect(value.textOnly[0].content[1].text).toContain("text only");
    expect(value.offloaded[0].content[1].text).toBe("OFF:" + IMAGE.attachmentId);
    expect(value.offloaded[0].content[2].type).toBe("image");
  });

  test("resolveImageAttachmentAccess: có map, không map, không host path, ref lỗi", () => {
    const run = (mod: AnyModule) => {
      const store = {
        imageHostPath(ref: any): string | undefined {
          return ref.attachmentId === IMAGE.attachmentId ? "/host/attachments/img.png" : undefined;
        },
      };
      return {
        mapped: mod.resolveImageAttachmentAccess(store, (path: string) => "/mounted" + path, IMAGE),
        noMap: mod.resolveImageAttachmentAccess(store, () => undefined, IMAGE),
        noHost: mod.resolveImageAttachmentAccess(store, (path: string) => path, IMAGE_2),
        invalid: capture(() =>
          mod.resolveImageAttachmentAccess(
            {
              imageHostPath(): string {
                throw new Error("bad attachment ref");
              },
            },
            (path: string) => path,
            { attachmentId: "x" },
          ),
        ),
      };
    };
    const value = valueOf(abSync(run));
    expect(value.mapped).toEqual({ readonlyPath: "/mounted/host/attachments/img.png" });
    expect(value.noMap).toBeUndefined();
    expect(value.noHost).toBeUndefined();
  });

  test("requiredImageOffload: đếm theo maxImages/maxBytes/quantum", () => {
    const run = (mod: AnyModule) => {
      const content = [
        { type: "image", attachment: IMAGE },
        { type: "image", attachment: IMAGE_2 },
        { type: "image", attachment: { ...IMAGE, attachmentId: "e".repeat(64), name: "e.png" } },
      ];
      const messages = [{ role: "user", content }];
      const budgets = [
        { representation: "raw", maxImages: 1 },
        { representation: "raw", maxImages: 1, countQuantum: 2 },
        { representation: "raw", maxImages: 2 },
        { representation: "raw", maxBytes: 2000 },
        { representation: "raw", maxBytes: 2000, byteQuantum: 2000 },
        { representation: "base64", maxBytes: 2000 },
        { representation: "raw" },
      ];
      return budgets.map((budget) => mod.requiredImageOffload(messages, budget, () => 1234));
    };
    const counts = valueOf(abSync(run)) as number[];
    expect(counts[0]).toBe(2);
    expect(counts[2]).toBe(1);
  });
});

describe("attribution + brand — danh tính gửi provider", () => {
  test("APP_IDENTITY/attributionHeaders/userAgent + brand constructor", () => {
    const run = (mod: AnyModule) => {
      const identity = { product: "acme", version: "1.2.3", url: "https://acme.test" };
      const version = mod.APP_IDENTITY.version;
      const normalize = (text: string) => text.split(version).join("<version>");
      return {
        app: { ...mod.APP_IDENTITY, version: "<version>" },
        versionMatchesPackage: version === (mod === ours ? OURS_VERSION : STOCK_VERSION),
        headers: { "user-agent": normalize(mod.attributionHeaders()["user-agent"]) },
        customHeaders: mod.attributionHeaders(identity),
        userAgent: normalize(mod.userAgent()),
        customUserAgent: mod.userAgent(identity),
        brands: [
          mod.MessageId("m-1"),
          mod.ToolCallId("t-1"),
          mod.ProviderRequestId("r-1"),
          mod.LlmAttemptId("a-1"),
          mod.ReasoningEffortId("low"),
        ],
        brandKinds: [
          typeof mod.MessageId("m-1"),
          typeof mod.ToolCallId("t-1"),
          typeof mod.ProviderRequestId("r-1"),
          typeof mod.LlmAttemptId("a-1"),
          typeof mod.ReasoningEffortId("low"),
        ],
      };
    };
    const value = valueOf(abSync(run));
    expect(value.app.product).toBe("deepseek-harness");
    expect(value.headers).toEqual({ "user-agent": value.userAgent });
    expect(value.customHeaders).toEqual({ "user-agent": "acme/1.2.3 (+https://acme.test)" });
    expect(value.brands).toEqual(["m-1", "t-1", "r-1", "a-1", "low"]);
    expect(value.brandKinds).toEqual(["string", "string", "string", "string", "string"]);
  });
});

describe("assembler — BlockAssembler từ chuỗi chunk", () => {
  test("text/reasoning/tool-call + usage/finish/replay/message", () => {
    const run = (mod: AnyModule) => {
      const assembler = new mod.BlockAssembler();
      for (const chunk of fixtureChunks(mod)) assembler.push(chunk);
      const empty = new mod.BlockAssembler();
      return {
        blocks: assembler.blocks(),
        usage: assembler.usage,
        finish: assembler.finish,
        replay: assembler.replayState,
        message: normalizeMessage(assembler.message({ provider: "p", model: "m" })),
        empty: {
          blocks: empty.blocks(),
          usage: empty.usage ?? null,
          finish: empty.finish,
          replay: empty.replayState ?? null,
        },
      };
    };
    const value = valueOf(abSync(run));
    expect(value.blocks.map((block: any) => block.type)).toEqual(["text", "reasoning", "tool-call"]);
    expect(value.blocks[0].text).toBe("Hello world");
    expect(value.blocks[2].arguments).toBe('{"q":"x"}');
    expect(value.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    expect(value.finish).toEqual({ kind: "tool-calls" });
    expect(value.replay).toEqual({ response: { id: "resp-1" }, blocks: [{ n: 1 }, { n: 2 }, { n: 3 }] });
    expect(value.message.role).toBe("assistant");
    expect(value.message.id).toBe("<id>");

  });

  test("interruptedBlocks + delta sau block-end + open block lạ", () => {
    const run = (mod: AnyModule) => {
      const partial = new mod.BlockAssembler();
      for (const chunk of [
        { type: "block-start", index: 0, blockType: "text" },
        { type: "text-delta", index: 0, text: "   " },
        { type: "block-start", index: 1, blockType: "tool-call" },
        { type: "tool-call-delta", index: 1, id: mod.ToolCallId("c-2"), name: "z", argumentsDelta: "{}" },
        { type: "block-start", index: 2, blockType: "reasoning" },
        { type: "reasoning-delta", index: 2, text: "why" },
        { type: "block-start", index: 3, blockType: "unknown-thing" },
      ]) {
        partial.push(chunk);
      }
      const malformed = new mod.BlockAssembler();
      malformed.push({ type: "block-start", index: 0, blockType: "text" });
      malformed.push({ type: "block-end", index: 0, block: { type: "text", text: "done" } });
      malformed.push({ type: "text-delta", index: 0, text: "late" });
      return {
        interrupted: partial.interruptedBlocks(),
        openUnknown: capture(() => partial.blocks()),
        malformed: malformed.blocks(),
      };
    };
    const value = valueOf(abSync(run));
    expect(value.interrupted).toEqual([{ type: "reasoning", text: "why" }]);
    expect(value.openUnknown.ok).toBe(false);
    expect(value.malformed).toEqual([{ type: "text", text: "done" }]);
  });
});

describe("assistant-stream — record nén, reader, accumulator, assemble", () => {
  test("expand/join/chunks/last/firstToken/HasVisible trên fixture stream", () => {
    const run = (mod: AnyModule) => {
      const records = fixtureRecords(mod);
      const empty = [
        { type: "chunk", time: 1, chunk: { type: "usage", usage: { inputTokens: 0, outputTokens: 0 } } },
        { type: "chunk", time: 2, chunk: { type: "finish", reason: { kind: "stop" } } },
      ];
      return {
        expanded: mod.expandAssistantStream(records),
        joined: mod.joinAssistantStreamText(records),
        usageChunks: mod.assistantStreamChunks(records, "usage"),
        lastUsage: mod.lastAssistantStreamChunk(records, "usage"),
        lastFinish: mod.lastAssistantStreamChunk(records, "finish"),
        firstToken: mod.assistantStreamFirstTokenTime(records),
        visible: [
          mod.assistantStreamHasVisibleContent(records),
          mod.assistantStreamHasVisibleText(records),
        ],
        empty: {
          firstToken: mod.assistantStreamFirstTokenTime(empty) ?? null,
          visibleContent: mod.assistantStreamHasVisibleContent(empty),
          visibleText: mod.assistantStreamHasVisibleText(empty),
          joined: mod.joinAssistantStreamText(empty),
          lastUsage: mod.lastAssistantStreamChunk(empty, "usage"),
        },
        malformed: capture(() => mod.expandAssistantStream([{ type: "bogus", time: 1 }])),
      };
    };
    const value = valueOf(abSync(run));
    expect(value.joined).toBe("Hello world");
    expect(value.expanded[0]).toEqual({ time: 100, chunk: { type: "text-delta", index: 0, text: "Hello " } });
    expect(value.firstToken).toBe(100);
    expect(value.visible).toEqual([true, true]);
    expect(value.empty.visibleContent).toBe(false);
    expect(value.empty.joined).toBe("");
    expect(value.malformed.ok).toBe(false);
    if (!value.malformed.ok) expect(value.malformed.error.name).toBe("TypeError");
  });

  test("AssistantStreamAccumulator: push/snapshot tách bản sao", () => {
    const run = (mod: AnyModule) => {
      const accumulator = new mod.AssistantStreamAccumulator();
      const inputs = [
        { time: 100, chunk: { type: "block-start", index: 0, blockType: "text" } },
        { time: 101, chunk: { type: "text-delta", index: 0, text: "a" } },
        { time: 102, chunk: { type: "finish", reason: { kind: "stop" } } },
      ];
      const pushed = inputs.map((input) => accumulator.push(input));
      return { pushed, snapshot: accumulator.snapshot() };
    };
    const value = valueOf(abSync(run));
    expect(value.snapshot).toEqual([
      { type: "chunk", time: 100, chunk: { type: "block-start", index: 0, blockType: "text" } },
      { type: "text-chunks", time0: 101, index: 0, dt: [], texts: ["a"] },
      { type: "chunk", time: 102, chunk: { type: "finish", reason: { kind: "stop" } } },
    ]);

  });

  test("assembleAssistantStream + isTokenDelta/isVisibleChunk/chunkHasVisibleText", () => {
    const run = (mod: AnyModule) => {
      const assembler = mod.assembleAssistantStream(fixtureRecords(mod));
      const custom = new mod.BlockAssembler();
      const sameAssembler = mod.assembleAssistantStream(fixtureRecords(mod), custom) === custom;
      const chunkCases = [
        { type: "text-delta", index: 0, text: " " },
        { type: "text-delta", index: 0, text: "x" },
        { type: "reasoning-delta", index: 0, text: "why" },
        { type: "tool-call-delta", index: 0, id: mod.ToolCallId("c"), name: "t", argumentsDelta: "" },
        { type: "tool-call-delta", index: 0, id: mod.ToolCallId("c"), argumentsDelta: "{}" },
        { type: "block-start", index: 0, blockType: "tool-call" },
        { type: "block-end", index: 0, block: { type: "tool-call", id: mod.ToolCallId("c"), name: "t", arguments: "{}" } },
        { type: "usage", usage: { inputTokens: 1, outputTokens: 1 } },
        { type: "finish", reason: { kind: "stop" } },
      ];
      return {
        blocks: assembler.blocks(),
        usage: assembler.usage,
        finish: assembler.finish,
        sameAssembler,
        flags: chunkCases.map((chunk) => [
          chunk.type,
          mod.isTokenDelta(chunk),
          mod.isVisibleChunk(chunk),
          mod.chunkHasVisibleText(chunk),
        ]),
      };
    };
    const value = valueOf(abSync(run));
    expect(value.blocks.map((block: any) => block.type)).toEqual(["text", "reasoning", "tool-call"]);
    expect(value.blocks[0].text).toBe("Hello world");
    expect(value.blocks[2].arguments).toBe("{}");
    expect(value.usage).toEqual({ inputTokens: 1, outputTokens: 2 });
    expect(value.sameAssembler).toBe(true);
    expect(value.flags[0]).toEqual(["text-delta", true, false, false]);
    expect(value.flags[1]).toEqual(["text-delta", true, true, true]);
  });
});

describe("runtime — cordis THẬT + adapter GIẢ (không mạng)", () => {
  test("metadata class + tên service 'llm' + static inject + remoteMethods", () => {
    const run = (mod: AnyModule) => {
      const ctx = new Context();
      const runtime = new mod.LlmRuntime(ctx);
      return {
        ctorName: mod.LlmRuntime.name,
        instanceName: runtime.name,
        staticInject: mod.LlmRuntime.inject ?? null,
        staticProps: Object.getOwnPropertyNames(mod.LlmRuntime).sort(),
        adapterCtorName: mod.LlmAdapter.name,
        proto: [typeof runtime.stream, typeof runtime.registerAdapter, typeof runtime.resolveModelInfo],
        remote: remoteMethods(runtime),
      };
    };
    const value = valueOf(abSync(run));
    expect(value.ctorName).toBe("LlmRuntime");
    expect(value.instanceName).toBe("llm");
    expect(value.adapterCtorName).toBe("LlmAdapter");
    expect(value.remote).toEqual([
      { method: "listProviders", invocation: { kind: "direct" } },
      { method: "listConfigurableProviders", invocation: { kind: "direct" } },
      { method: "remoteDiscoverModels", exportName: "discoverModels", invocation: { kind: "direct" } },
    ]);
  });

  test("registerAdapter + listProviders + resolveModelInfo + listModels + stream + dispose", async () => {
    const run = async (mod: AnyModule) => {
      const ctx = new Context();
      const runtime = new mod.LlmRuntime(ctx);
      const calls: string[] = [];
      const dispose = runtime.registerAdapter(["fake"], fakeAdapter(mod, calls));
      const providers = runtime.listProviders();
      const resolved = await runtime.resolveModelInfo("fake", "fake-1");
      const catalog = await runtime.listModels("fake");
      const policy = runtime.providerRetryPolicy("fake");
      const pricing = runtime.imageRequestPricing("fake", "fake-1") ?? null;
      const chunks: unknown[] = [];
      for await (const chunk of runtime.stream({ provider: "fake", model: "fake-1", messages: [] })) {
        chunks.push(chunk);
      }
      const duplicate = capture(() => runtime.registerAdapter(["fake"], fakeAdapter(mod, [])));
      dispose();
      return {
        providers,
        resolved,
        catalog,
        policy,
        pricing,
        calls,
        chunks,
        duplicate,
        afterDispose: runtime.listProviders(),
      };
    };
    const value = valueOf(await abAsync(run));
    expect(value.providers).toEqual([{ id: "fake", name: "Fake fake" }]);
    expect(value.resolved.provider).toBe("fake");
    expect(value.resolved.id).toBe("fake-1");
    expect(value.resolved.context).toEqual({ contextWindow: 128000 });
    expect(value.policy.mode).toBe("normal");
    expect(value.calls).toEqual(["fake/fake-1"]);
    expect(value.chunks[0]).toEqual({ type: "text-delta", index: 0, text: "hello" });
    expect(value.duplicate.ok).toBe(false);
    if (!value.duplicate.ok) expect(value.duplicate.error.code).toBe("DUPLICATE_ADAPTER");
    expect(value.afterDispose).toEqual([]);
  });
});

describe("bề mặt export", () => {
  test("tập export runtime của ta BẰNG bản gốc", () => {
    const oursNames = Object.keys(ours).sort();
    const stockNames = Object.keys(stock).sort();
    expect(oursNames).toEqual(stockNames);
    expect(oursNames.length).toBe(66);
  });
});
