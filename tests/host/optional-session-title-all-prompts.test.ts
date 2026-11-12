/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-optional-session-title-all-prompts: tập export đo trên ARTIFACT,
 *      đối chứng TRỰC TIẾP với chính bundle gốc trên cùng một giàn giả (câu lệnh hệ thống · đóng khung
 *      JSON · neo tiêu đề hiện tại · lấy tiêu đề từ phản hồi · bốn đường lỗi · đường tuyến), ca C6
 *      (danh tính vật thể cấu hình giữa hai thực thể), và quy ước gbh.peers ⊆ peerDependencies kèm
 *      ĐỐI CHỨNG ÂM.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/optional-session-title-all-prompts/build.ts";
import * as ours from "../../packages/host/optional-session-title-all-prompts/src/index.ts";

import { peerRangeProblems } from "./peer-range-harness.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "optional-session-title-all-prompts");
/** Bundle GỐC đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK = join(
  REPO,
  "apps",
  "host",
  "node_modules",
  "@deepseek-ai",
  "dsh-session-title-all-prompts-llm",
  "lib",
  "index.js",
);

/** Cấu hình của row trong profile `blackhole` — đọc từ bản dump gần nhất của `.parity/dumps/…/ours.yml`, dòng 1478–1485. */
const PROFILE_CONFIG = {
  targetWords: 5,
  targetCjkCharacters: 10,
  maxInputBytes: 4096,
  maxOutputTokens: 64,
  timeoutMs: 60000,
};

/** Một mẩu của stream LLM giả — đúng bốn hình dạng mà `BlockAssembler.push` nhận. */
interface StreamChunk {
  /** Loại mẩu (`text-delta` · `tool-call-delta` · `block-start` · `finish`). */
  type: string;
  /** Chỉ số khối của mẩu. */
  index?: number;
  /** Loại khối khi mở khối. */
  blockType?: string;
  /** Chữ của mẩu văn bản. */
  text?: string;
  /** Kết cục của stream (mẩu `finish`). */
  reason?: { kind: string };
  /** Id công cụ (mẩu `tool-call-delta`). */
  id?: string;
  /** Tên công cụ (mẩu `tool-call-delta`). */
  name?: string;
  /** Phần tham số công cụ (mẩu `tool-call-delta`). */
  argumentsDelta?: string;
}

/** Một bản ghi mà `request.session.append` đã nhận. */
interface AppendedEvent {
  /** Loại sự kiện phiên. */
  type: string;
  /** Dữ liệu sự kiện. */
  data: Record<string, unknown>;
}

/** Kết quả provider mà seam `sessionTitle` nhận. */
interface ProviderResult {
  /** Tiêu đề đề xuất. */
  title: string;
  /** Seq của các tin nhắn nguồn. */
  messageSeqs: readonly number[];
  /** Tuyến model đã dùng. */
  model?: { provider: string; model: string };
}

/** Yêu cầu sinh tiêu đề mà seam `sessionTitle` trao cho provider. */
interface ProviderRequest {
  /** Phiên đang được đặt tiêu đề. */
  session: { id: string; append(type: string, data: unknown): void };
  /** Tin nhắn người dùng đủ điều kiện. */
  messages: readonly { seq: number; text: string }[];
  /** Tuyến request chính đã ghi (nếu có). */
  route?: { provider: string; model: string };
  /** Tiêu đề hiện tại (nếu đã có). */
  currentTitle?: { title: string; source: { kind: string } };
  /** Huỷ của lượt gọi. */
  signal: AbortSignal;
}

/** Một provider đã đăng ký vào seam. */
interface RegisteredProvider {
  /** Id provider. */
  id: string;
  /** Nhịp sinh tự động. */
  automatic: string;
  /** Sinh một bản tiêu đề. */
  generate(request: ProviderRequest): Promise<ProviderResult>;
}

/** Context giả: đúng ba seam mà plugin chạm tới. */
interface FakeContext {
  /** Sổ tiêu đề phiên — nơi provider được đăng ký. */
  sessionTitle: { register(provider: RegisteredProvider): () => Promise<void> };
  /** Tầng LLM — chỉ `prepareCall` được dùng. */
  llm: {
    prepareCall(
      route: Record<string, unknown>,
      signal: AbortSignal,
      controls: (current: Record<string, unknown>, model: unknown) => Record<string, unknown>,
    ): { config: Record<string, unknown>; stream(options: Record<string, unknown>): AsyncIterable<StreamChunk> };
  };
  /** Sổ phiên (plugin khai `inject` nhưng không gọi trực tiếp). */
  sessions: Record<string, never>;
}

/** Một lượt `prepareCall` đã nhận. */
interface RecordedCall {
  /** Tuyến yêu cầu. */
  route: Record<string, unknown>;
  /** Điều khiển mà bộ chọn mức suy luận trả về. */
  controls?: Record<string, unknown>;
  /** Tùy chọn cuối mà seam trao cho `stream`. */
  options?: Record<string, unknown>;
}

/** Giàn đo của MỘT bên cài. */
interface Harness {
  /** Context giả. */
  ctx: FakeContext;
  /** Phiên GHI của giàn — yêu cầu gửi cho provider phải mang CHÍNH phiên này. */
  session: { id: string; append(type: string, data: unknown): void };
  /** Mọi bản ghi phiên, theo thứ tự. */
  appends: AppendedEvent[];
  /** Mọi lượt `prepareCall`. */
  calls: RecordedCall[];
  /** Provider đã đăng ký (ném nếu plugin không đăng ký gì). */
  registered(): RegisteredProvider;
}

/** Lớp plugin của một bên cài (ta hoặc gốc). */
interface PluginLike {
  /** Cài plugin trên một context. */
  apply(ctx: unknown, config: unknown): void;
  /** Schema/hàm chuẩn hoá cấu hình. */
  Config(value: unknown): unknown;
}

/** Bản gốc nạp động — cùng bốn export như bản viết lại. */
const stock = (await import(STOCK)) as unknown as PluginLike & { name: string; inject: string[] };
/** Bản của ta, nhìn qua cùng hình dạng để so hai bên. */
const mine = ours as unknown as PluginLike & { name: string; inject: string[] };

/**
 * Dựng giàn giả cho MỘT bên cài: seam tiêu đề ghi lại provider, tầng LLM phát đúng chuỗi mẩu cho trước.
 * Nhận: các mẩu stream mà tầng LLM giả sẽ phát, và id phiên.
 * Trả: giàn đo có `registered()` để lấy provider sau khi cài.
 */
function makeHarness(reply: readonly StreamChunk[], sessionId = "session-1"): Harness {
  const appends: AppendedEvent[] = [];
  const calls: RecordedCall[] = [];
  let provider: RegisteredProvider | undefined;
  const session = {
    id: sessionId,
    append(type: string, data: unknown): void {
      appends.push({ type, data: data as Record<string, unknown> });
    },
  };
  const ctx: FakeContext = {
    sessionTitle: {
      register(registered: RegisteredProvider): () => Promise<void> {
        provider = registered;
        return async () => undefined;
      },
    },
    llm: {
      prepareCall(route, _signal, controls) {
        const call: RecordedCall = { route };
        calls.push(call);
        // Cùng hình dạng metadata mà adapter thật cấp: mức suy luận đầu tiên là mức THẤP NHẤT.
        const model = { reasoning: { efforts: [{ id: "low" }, { id: "high" }] } };
        call.controls = controls({}, model);
        return {
          config: { ...call.controls },
          stream: async function* stream(options: Record<string, unknown>): AsyncIterable<StreamChunk> {
            call.options = options;
            for (const chunk of reply) yield chunk;
          },
        };
      },
    },
    sessions: {},
  };
  return {
    ctx,
    session,
    appends,
    calls,
    registered(): RegisteredProvider {
      if (provider === undefined) throw new Error("plugin không đăng ký provider nào");
      return provider;
    },
  };
}

/**
 * Cài MỘT bên lên giàn của nó, dùng chính cấu hình đã qua schema của bên đó.
 * Nhận: lớp plugin, giàn đo, và cấu hình THÔ (chưa qua schema).
 * Trả: không; provider nằm trong `harness.registered()`.
 */
function install(plugin: PluginLike, harness: Harness, raw: Record<string, unknown> = PROFILE_CONFIG): void {
  plugin.apply(harness.ctx as never, plugin.Config(raw) as never);
}

/**
 * Cài MỘT bên bằng cấu hình ĐI VÒNG schema — lớp kiểm thứ hai của chính `apply`.
 * Nhận: lớp plugin, giàn đo, và cấu hình thô chưa qua schema.
 * Trả: không; ném lỗi của `apply` nếu cấu hình không dùng được.
 */
function installRaw(plugin: PluginLike, harness: Harness, raw: Record<string, unknown>): void {
  plugin.apply(harness.ctx as never, raw as never);
}

/**
 * Dựng yêu cầu sinh tiêu đề mang ĐÚNG phiên ghi của giàn.
 * Nhận: giàn đo và các trường muốn ghi đè.
 * Trả: yêu cầu đã đủ hình dạng seam trao cho provider.
 */
function requestFor(harness: Harness, overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  // `session` đặt SAU cùng: không lời gọi nào được vô tình thay phiên GHI bằng phiên rỗng.
  return { ...defaultRequest(), ...overrides, session: harness.session };
}

/** Dấu vết chuẩn hoá của MỘT lượt sinh tiêu đề — mọi thứ quan sát được, trừ id tin nhắn ngẫu nhiên. */
interface Trace {
  /** Tiêu đề trả về. */
  title: string;
  /** Seq nguồn. */
  messageSeqs: number[];
  /** Tuyến model của kết quả. */
  model: unknown;
  /** Câu lệnh hệ thống đã ghi vào phiên. */
  system: string;
  /** Đầu vào đã đóng khung. */
  input: string;
  /** Tuyến đã ghi. */
  route: unknown;
  /** Trần token đầu ra. */
  maxTokens: number;
  /** Mức suy luận đã ghi (`null` khi vắng). */
  reasoningEffort: unknown;
  /** Phiên nhận yêu cầu. */
  sessionId: unknown;
  /** Mục đích của yêu cầu. */
  purpose: unknown;
  /** Tuyến mà `prepareCall` nhận. */
  callRoute: unknown;
}

/**
 * Rút dấu vết quan sát được của một lượt sinh tiêu đề.
 * Nhận: giàn đo và kết quả provider.
 * Trả: dấu vết đã chuẩn hoá để so hai bên từng trường.
 */
function trace(harness: Harness, result: ProviderResult): Trace {
  const event = harness.appends.find((item) => item.type === "session/title-llm-request");
  if (event === undefined) throw new Error("không có bản ghi session/title-llm-request");
  const messages = event.data["messages"] as readonly { content: readonly { type: string; text?: string }[] }[];
  const input = messages[0]?.content.find((block) => block.type === "text")?.text ?? "";
  const options = harness.calls[0]?.options;
  return {
    title: result.title,
    messageSeqs: [...result.messageSeqs],
    model: result.model,
    system: event.data["system"] as string,
    input,
    route: event.data["route"],
    maxTokens: event.data["maxTokens"] as number,
    reasoningEffort: event.data["reasoningEffort"] ?? null,
    sessionId: options?.["sessionId"],
    purpose: options?.["purpose"],
    callRoute: harness.calls[0]?.route,
  };
}

/**
 * Chạy CÙNG một lượt sinh trên cả hai bên cài rồi trả hai dấu vết.
 * Nhận: các mẩu stream, hàm dựng yêu cầu (mỗi bên một yêu cầu RIÊNG), và cấu hình thô.
 * Trả: dấu vết của ta và của gốc.
 */
async function both(
  reply: readonly StreamChunk[],
  request: () => ProviderRequest,
  raw: Record<string, unknown> = PROFILE_CONFIG,
): Promise<{ ours: Trace; stock: Trace }> {
  const mineHarness = makeHarness(reply);
  install(mine, mineHarness, raw);
  const oursResult = await mineHarness.registered().generate(requestFor(mineHarness, request()));
  const stockHarness = makeHarness(reply);
  install(stock, stockHarness, raw);
  const stockResult = await stockHarness.registered().generate(requestFor(stockHarness, request()));
  return { ours: trace(mineHarness, oursResult), stock: trace(stockHarness, stockResult) };
}

/** Yêu cầu mặc định: hai tin nhắn người dùng, có tuyến đã ghi, không tiêu đề hiện tại. */
function defaultRequest(): ProviderRequest {
  return {
    session: { id: "session-1", append: () => undefined },
    messages: [
      { seq: 1, text: "the build explodes on the second worker" },
      { seq: 2, text: "please fix the bundling order" },
    ],
    route: { provider: "deepseek", model: "deepseek-v4.1-flash" },
    signal: new AbortController().signal,
  };
}

/** Chạy một lượt gọi và trả THÔNG ĐIỆP lỗi (hoặc `KHONG NEM` khi không ném). */
async function failureOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "KHONG NEM";
  } catch (error) {
    return (error as Error).message;
  }
}

/** Tên export của một file ESM đã build (cùng hai regex mà `check:rows` dùng). */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

describe("bề mặt plugin: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js đã build)", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-title-")));
    const oursText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["Config", "apply", "inject", "name"]);
    // Row host thuần: KHÔNG có `__ModuleLoader__`, KHÔNG có id module nào trong artifact.
    expect(oursText).not.toContain("__ModuleLoader__");
    expect(oursText.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    // ⚠️ 18/10/2026 (task-13): consumer nay dùng THƯ VIỆN CỦA TA (@galaxy-blackhole/gbh-session-title-llm)
    //   và thư viện đó được INLINE vào artifact ⇒ ba hệ quả phải canh:
    //   (a) KHÔNG còn phụ thuộc bundle DSH @deepseek-ai/dsh-session-title-llm (mục tiêu G4),
    //   (b) KHÔNG còn specifier của thư viện ta trong artifact (đã nội tuyến, không phải import lúc chạy),
    //   (c) chỉ còn các gói KERNEL mà thư viện ta dùng.
    expect(oursText).not.toContain('from "@deepseek-ai/dsh-session-title-llm"');
    expect(oursText).not.toContain("@galaxy-blackhole/gbh-session-title-llm");
    expect(oursText).toContain("executeSessionTitleLlm");
    for (const specifier of [
      "@deepseek-ai/schemastery",
      "@deepseek-ai/dsh-session-title",
      "@deepseek-ai/dsh-llm",
      "@deepseek-ai/dsh-timeout",
      "@deepseek-ai/dsh-util-values",
    ]) {
      expect(oursText).toContain('from "' + specifier + '"');
    }
    expect(oursText).not.toContain('from "@deepseek-ai/cordis"');
    // ĐỐI CHỨNG: bản gốc VẪN phụ thuộc bundle DSH (đúng thứ ta vừa gỡ).
    expect(stockText).toContain('from "@deepseek-ai/dsh-session-title-llm"');
  });

  test("name · inject · String(Config) TRÙNG bản gốc; schema TỪ CHỐI cấu hình thiếu trường — cùng thông điệp", () => {
    expect(mine.name).toBe(stock.name);
    expect(mine.inject).toEqual(stock.inject);
    expect(mine.inject).toEqual(["sessionTitle", "llm", "sessions"]);
    expect(String(mine.Config)).toBe(String(stock.Config));
    expect(String(mine.Config)).toContain("targetWords");
    expect(String(mine.Config)).toContain("targetCjkCharacters");
    const missing = (schema: (value: unknown) => unknown): string => {
      try {
        schema({});
        return "KHONG NEM";
      } catch (error) {
        return (error as Error).message;
      }
    };
    expect(missing(mine.Config as unknown as (value: unknown) => unknown)).toBe("$.targetWords missing required value");
    expect(missing(mine.Config as unknown as (value: unknown) => unknown)).toBe(
      missing(stock.Config as unknown as (value: unknown) => unknown),
    );
  });

  test("provider đăng ký ĐÚNG MỘT lần, id nguyên văn, nhịp `all-prompts` — y bản gốc", () => {
    const mineHarness = makeHarness([{ type: "finish", reason: { kind: "stop" } }]);
    install(mine, mineHarness);
    const stockHarness = makeHarness([{ type: "finish", reason: { kind: "stop" } }]);
    install(stock, stockHarness);
    for (const harness of [mineHarness, stockHarness]) {
      const provider = harness.registered();
      expect(provider.id).toBe("session-title-all-prompts-llm");
      expect(provider.automatic).toBe("all-prompts");
      expect(typeof provider.generate).toBe("function");
    }
  });
});

describe("sinh tiêu đề: đối chứng với CHÍNH bundle gốc trên cùng giàn", () => {
  test("KHÔNG có tiêu đề hiện tại ⇒ câu lệnh 5 dòng + đóng khung MẢNG, tiêu đề lấy từ dòng đầu", async () => {
    const reply: StreamChunk[] = [
      { type: "text-delta", index: 0, text: "**Fixing the build**" },
      { type: "finish", reason: { kind: "stop" } },
    ];
    const { ours: mineTrace, stock: stockTrace } = await both(reply, defaultRequest);
    expect(mineTrace).toEqual(stockTrace);
    expect(mineTrace.title).toBe("Fixing the build");
    expect(mineTrace.messageSeqs).toEqual([1, 2]);
    expect(mineTrace.model).toEqual({ provider: "deepseek", model: "deepseek-v4.1-flash" });
    expect(mineTrace.maxTokens).toBe(64);
    // Mức suy luận THẤP NHẤT của tuyến (efforts[0]) được chọn — y bản gốc.
    expect(mineTrace.reasoningEffort).toBe("low");
    expect(mineTrace.sessionId).toBe("session-1");
    expect(mineTrace.purpose).toBe("session-title");
    expect(mineTrace.route).toEqual({ provider: "deepseek", model: "deepseek-v4.1-flash" });
    expect(mineTrace.callRoute).toEqual({ provider: "deepseek", model: "deepseek-v4.1-flash", maxTokens: 64 });
    expect(mineTrace.system.split("\n")).toEqual([
      "Create a concise title for an AI coding-assistant session from the supplied human messages.",
      "Return only the title on one line, **in plain text of natural language**, with no quotes, prefix, explanation, Markdown, XML, or terminal control codes. No code is allowed.",
      "Use the language of the messages.",
      "Aim for about 5 words in non-CJK languages or 10 CJK characters.",
      "If the messages give little to name, still return a short best-effort title, such as Greeting, instead of explaining.",
    ]);
    expect(mineTrace.input.startsWith("Generate the session title from this JSON array of human messages:\n")).toBe(true);
    expect(mineTrace.input).toContain('{"seq":1,"text":"the build explodes on the second worker"}');
  });

  test("tiêu đề nguồn `provider` ⇒ NEO: câu lệnh thêm 4 dòng + đóng khung OBJECT — y bản gốc", async () => {
    const reply: StreamChunk[] = [
      { type: "text-delta", index: 0, text: "Fixing the build" },
      { type: "finish", reason: { kind: "stop" } },
    ];
    const request = (): ProviderRequest => ({
      ...defaultRequest(),
      currentTitle: { title: "Fixing the build", source: { kind: "provider" } },
    });
    const { ours: mineTrace, stock: stockTrace } = await both(reply, request);
    expect(mineTrace).toEqual(stockTrace);
    expect(mineTrace.system.split("\n").slice(5)).toEqual([
      "An existing title is supplied as currentTitle. If it still accurately describes the main topic or task, return it exactly unchanged.",
      'Follow-up questions, additional details within the same topic, acknowledgements such as "thanks", and requests to continue do not by themselves justify a title change.',
      "Do not reword, polish, shorten, or replace synonyms in an adequate title. Keeping its exact wording takes priority over the target length.",
      "Change the title only when the messages materially change or expand the main topic or task so that the existing title is no longer accurate.",
    ]);
    expect(mineTrace.input.startsWith("Update the session title from this JSON object:\n")).toBe(true);
    expect(mineTrace.input).toContain('{"currentTitle":"Fixing the build","messages":[');
  });

  test("tiêu đề nguồn KHÁC `provider` (fallback · user · vắng) ⇒ KHÔNG neo — y bản gốc", async () => {
    const reply: StreamChunk[] = [
      { type: "text-delta", index: 0, text: "Fixing the build" },
      { type: "finish", reason: { kind: "stop" } },
    ];
    for (const kind of ["fallback", "user", "absent"] as const) {
      const request = (): ProviderRequest => {
        const base = defaultRequest();
        if (kind === "absent") return base;
        return { ...base, currentTitle: { title: "Fixing the build", source: { kind } } };
      };
      const { ours: mineTrace, stock: stockTrace } = await both(reply, request);
      expect(mineTrace).toEqual(stockTrace);
      expect(mineTrace.system.split("\n").length).toBe(5);
      expect(mineTrace.input.startsWith("Generate the session title from this JSON array")).toBe(true);
    }
  });

  test("lấy tiêu đề: dòng ĐẦU không rỗng · bỏ nhấn mạnh bao ngoài · giữ nhấn mạnh BÊN TRONG — y bản gốc", async () => {
    const cases: { text: string; expected: string }[] = [
      { text: "   \n\n  Build fix \nsecond line ignored", expected: "Build fix" },
      { text: "**Build fix**", expected: "Build fix" },
      { text: "***Build fix***", expected: "Build fix" },
      { text: "**Fix *x* now**", expected: "Fix *x* now" },
      { text: "*x* and **y**", expected: "*x* and **y**" },
      // Hai mẩu văn bản được NỐI BẰNG DẤU CÁCH trước khi lấy dòng đầu (hành vi của bản gốc).
      { text: "Fix", expected: "Fix" },
    ];
    for (const item of cases) {
      const reply: StreamChunk[] = [
        { type: "text-delta", index: 0, text: item.text },
        { type: "finish", reason: { kind: "stop" } },
      ];
      const { ours: mineTrace, stock: stockTrace } = await both(reply, defaultRequest);
      expect(mineTrace).toEqual(stockTrace);
      expect(mineTrace.title).toBe(item.expected);
    }
  });
});

describe("đường lỗi: cùng mã, cùng thông điệp, không treo", () => {
  test("bốn kết cục không dùng được ⇒ thông điệp GIỐNG NHAU từng chữ", async () => {
    const cases: { chunks: StreamChunk[]; message: string }[] = [
      {
        chunks: [
          { type: "text-delta", index: 0, text: "Fix" },
          { type: "finish", reason: { kind: "tool-calls" } },
        ],
        message: "session-title-llm: title output must contain text only",
      },
      {
        chunks: [
          { type: "text-delta", index: 0, text: "Fix" },
          { type: "finish", reason: { kind: "max-tokens" } },
        ],
        message: "session-title-llm: title output reached maxOutputTokens",
      },
      {
        chunks: [{ type: "finish", reason: { kind: "stop" } }],
        message: "session-title-llm: title model produced no text",
      },
      {
        chunks: [
          { type: "block-start", index: 0, blockType: "tool-call" },
          { type: "tool-call-delta", index: 0, id: "call-1", name: "shell", argumentsDelta: "{}" },
          { type: "finish", reason: { kind: "stop" } },
        ],
        message: "session-title-llm: title output must contain text only",
      },
    ];
    for (const item of cases) {
      const mineHarness = makeHarness(item.chunks);
      install(mine, mineHarness);
      const stockHarness = makeHarness(item.chunks);
      install(stock, stockHarness);
      const mineMessage = await failureOf(() => mineHarness.registered().generate(requestFor(mineHarness)));
      const stockMessage = await failureOf(() => stockHarness.registered().generate(requestFor(stockHarness)));
      expect(mineMessage).toBe(item.message);
      expect(mineMessage).toBe(stockMessage);
    }
  });

  test("điều khiển thi hành: thiếu cặp tuyến · vượt maxInputBytes · vượt trần thời hạn ⇒ cùng thông điệp", async () => {
    const reply: StreamChunk[] = [
      { type: "text-delta", index: 0, text: "Fix" },
      { type: "finish", reason: { kind: "stop" } },
    ];
    // Lượt cài CŨNG có thể ném (kiểm cấu hình của `apply`), nên nó nằm trong cùng phép thử.
    const run = async (raw: Record<string, unknown>, request = defaultRequest): Promise<string> => {
      const harness = makeHarness(reply);
      return failureOf(async () => {
        install(mine, harness, raw);
        return harness.registered().generate(requestFor(harness, request()));
      });
    };
    const runStock = async (raw: Record<string, unknown>, request = defaultRequest): Promise<string> => {
      const harness = makeHarness(reply);
      return failureOf(async () => {
        install(stock, harness, raw);
        return harness.registered().generate(requestFor(harness, request()));
      });
    };
    // Hai biến thể ĐI VÒNG schema: đo lớp kiểm thứ hai của chính `apply`.
    const runRaw = async (raw: Record<string, unknown>): Promise<string> => {
      const harness = makeHarness(reply);
      return failureOf(async () => {
        installRaw(mine, harness, raw);
        return harness.registered().generate(requestFor(harness));
      });
    };
    const runRawStock = async (raw: Record<string, unknown>): Promise<string> => {
      const harness = makeHarness(reply);
      return failureOf(async () => {
        installRaw(stock, harness, raw);
        return harness.registered().generate(requestFor(harness));
      });
    };
    // (a) không có tuyến ghi trong request VÀ cấu hình không khai provider/model.
    const noRoute = (): ProviderRequest => ({ ...defaultRequest(), route: undefined });
    expect(await run(PROFILE_CONFIG, noRoute)).toBe(
      "session-title-llm: no logged request route is available; configure provider and model together",
    );
    expect(await run(PROFILE_CONFIG, noRoute)).toBe(await runStock(PROFILE_CONFIG, noRoute));
    // (b) provider mà KHÔNG có model — cặp tuyến phải đi cùng nhau.
    expect(await run({ ...PROFILE_CONFIG, provider: "deepseek" })).toBe(
      "session-title-llm: provider and model must be supplied together",
    );
    expect(await run({ ...PROFILE_CONFIG, provider: "deepseek" })).toBe(
      await runStock({ ...PROFILE_CONFIG, provider: "deepseek" }),
    );
    // (c) đầu vào vượt trần byte ⇒ chặn TRƯỚC khi gọi model.
    const tiny = { ...PROFILE_CONFIG, maxInputBytes: 16 };
    const message = await run(tiny);
    expect(message.startsWith("session-title-llm: input is ")).toBe(true);
    expect(message).toContain("exceeding maxInputBytes 16");
    expect(message).toBe(await runStock(tiny));
    // (d) thời hạn vượt trần đồng hồ của kernel: schema chặn TRƯỚC, thông điệp GIỐNG bản gốc.
    const tooLong = { ...PROFILE_CONFIG, timeoutMs: 2147483648 };
    expect(await run(tooLong)).toBe(await runStock(tooLong));
    expect(await run(tooLong)).toContain("timeoutMs");
    // Lớp `apply` (cấu hình đi VÒNG schema) mới là nơi seam ném thông điệp trần đồng hồ.
    expect(await runRaw(tooLong)).toBe("session-title-llm: timeoutMs must not exceed 2147483647");
    expect(await runRaw(tooLong)).toBe(await runRawStock(tooLong));
  });

  test("đích độ dài của riêng provider: HAI lớp kiểm — schema rồi `apply`, thông điệp y bản gốc", async () => {
    const messageOf = (plugin: PluginLike, raw: Record<string, unknown>, viaSchema: boolean): string => {
      const harness = makeHarness([{ type: "finish", reason: { kind: "stop" } }]);
      try {
        if (viaSchema) install(plugin, harness, raw);
        else installRaw(plugin, harness, raw);
        return "KHONG NEM";
      } catch (error) {
        return (error as Error).message;
      }
    };
    // Lớp 1 — schema loader chặn TRƯỚC (đường tầng nạp thật dùng), thông điệp của schemastery.
    for (const raw of [
      { ...PROFILE_CONFIG, targetWords: 0 },
      { ...PROFILE_CONFIG, targetWords: 1.5 },
      { ...PROFILE_CONFIG, targetCjkCharacters: -3 },
    ]) {
      expect(messageOf(mine, raw, true)).toBe(messageOf(stock, raw, true));
      expect(messageOf(mine, raw, true)).not.toBe("KHONG NEM");
    }
    // Lớp 2 — `apply` tự kiểm lại cho cấu hình ĐI VÒNG schema; thông điệp nêu đúng tên trường.
    const fractional = messageOf(mine, { ...PROFILE_CONFIG, targetWords: 1.5 }, false);
    expect(fractional).toBe("session-title-all-prompts-llm: targetWords must be a positive integer");
    expect(fractional).toBe(messageOf(stock, { ...PROFILE_CONFIG, targetWords: 1.5 }, false));
    const cjk = messageOf(mine, { ...PROFILE_CONFIG, targetCjkCharacters: 0 }, false);
    expect(cjk).toBe("session-title-all-prompts-llm: targetCjkCharacters must be a positive integer");
    expect(cjk).toBe(messageOf(stock, { ...PROFILE_CONFIG, targetCjkCharacters: 0 }, false));
    // Đối chứng dương cho các ca âm trên: cấu hình hợp lệ thì cài được ở CẢ HAI lớp.
    expect(messageOf(mine, PROFILE_CONFIG, false)).toBe("KHONG NEM");
    expect(messageOf(stock, PROFILE_CONFIG, false)).toBe("KHONG NEM");
    expect(messageOf(mine, PROFILE_CONFIG, true)).toBe("KHONG NEM");
  });

  test("cặp tuyến KHAI TRONG CẤU HÌNH thắng tuyến của request — y bản gốc", async () => {
    const reply: StreamChunk[] = [
      { type: "text-delta", index: 0, text: "Fix" },
      { type: "finish", reason: { kind: "stop" } },
    ];
    const raw = { ...PROFILE_CONFIG, provider: "openai", model: "gpt-x" };
    const { ours: mineTrace, stock: stockTrace } = await both(reply, defaultRequest, raw);
    expect(mineTrace).toEqual(stockTrace);
    expect(mineTrace.route).toEqual({ provider: "openai", model: "gpt-x" });
    expect(mineTrace.callRoute).toEqual({ provider: "openai", model: "gpt-x", maxTokens: 64 });
  });
});

describe("C6 — vật thể cấu hình phải ĐỘC LẬP giữa các thực thể (kiểm bằng DANH TÍNH)", () => {
  test("hai lượt cài tạo provider RIÊNG, mỗi bên giữ đích độ dài của mình — y bản gốc", async () => {
    const reply: StreamChunk[] = [
      { type: "text-delta", index: 0, text: "Fix" },
      { type: "finish", reason: { kind: "stop" } },
    ];
    const run = async (plugin: PluginLike): Promise<{ same: boolean; systems: string[]; titles: string[] }> => {
      const first = makeHarness(reply);
      install(plugin, first, { ...PROFILE_CONFIG, targetWords: 3, targetCjkCharacters: 7 });
      const second = makeHarness(reply);
      install(plugin, second, { ...PROFILE_CONFIG, targetWords: 11, targetCjkCharacters: 21 });
      const titles = [
        (await first.registered().generate(requestFor(first))).title,
        (await second.registered().generate(requestFor(second))).title,
      ];
      const systems = [
        trace(first, { title: titles[0] ?? "", messageSeqs: [] }).system,
        trace(second, { title: titles[1] ?? "", messageSeqs: [] }).system,
      ];
      return { same: first.registered() === second.registered(), systems, titles };
    };
    const mineRun = await run(mine);
    const stockRun = await run(stock);
    expect(mineRun).toEqual(stockRun);
    // Phép so SÂU một mình sẽ ĐẠT cả khi hai bên dùng chung một hằng ⇒ phải so DANH TÍNH.
    expect(mineRun.same).toBe(false);
    expect(mineRun.systems[0]).toContain("about 3 words");
    expect(mineRun.systems[1]).toContain("about 11 words");
    expect(mineRun.systems[1]).not.toContain("about 3 words");
    expect(mineRun.titles).toEqual(["Fix", "Fix"]);
  });
});

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");

/**
 * Danh sách peer CHỌN LỌC của riêng gói này — dùng để chống verdict RỖNG cho phép ⊆.
 * 01/11/2026: chốt lại theo `gbh.peers` sau lượt đồng bộ manifest (gói GBH-only, không có stock để
 * đối chứng; danh sách cũ liệt kê dsh-llm/dsh-timeout/dsh-util-values — những seam KHÔNG còn khai).
 */
const SEAM_PEERS = [
  "@deepseek-ai/cordis",
  "@deepseek-ai/schemastery",
  "@deepseek-ai/dsh-session-title",
  "@deepseek-ai/dsh-session-title-llm",
];

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Chỉ mượn KIỂU (bị xoá lúc build) — không phải seam lúc chạy. */
  devDependencies?: Record<string, string>;
  /** Metadata của ta để `bh host` sinh khối patch. */
  gbh?: { peers?: string[]; row?: unknown };
  /** Đầu ra công khai. */
  exports?: Record<string, unknown>;
}

/**
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không `import`).
 * Nhận: không.
 * Trả: manifest đã ép kiểu.
 */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — `peerDependencies` thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/**
 * Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật.
 * Nhận: manifest gốc.
 * Trả: bản sao độc lập.
 */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

describe("quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ)", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    const declared = Object.keys(manifest.peerDependencies ?? {});
    // Chống verdict RỖNG: nếu ai xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    for (const peer of peers) expect(declared).toContain(peer);
    expect(missingPeers(manifest)).toEqual([]);
    // Dải: (1) PHẢI BẰNG ĐÚNG dải manifest stock của gói, (2) PHẢI phủ bản kernel đang chạy — phép kiểm
    // MẠNH trong harness (stock khai dải alpha, kernel chạy bản không-alpha; vẫn chặn drift rc.5).
    expect(peerRangeProblems(PKG)).toEqual([]);
  });

  test("peer khai ra phải có THẬT trong kernel; peer KHÔNG nằm trong dependencies", () => {
    const manifest = readManifest();
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    for (const peer of manifest.gbh?.peers ?? []) {
      expect(existsSync(join(REPO, "apps", "host", "node_modules", peer, "package.json"))).toBe(true);
      expect(deps.has(peer)).toBe(false);
    }
    expect(manifest.dependencies).toBeUndefined();
    for (const peer of manifest.gbh?.peers ?? []) {
      expect(Object.keys(manifest.devDependencies ?? {})).toContain(peer);
    }
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const peer of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      // Đỏ ở ĐÚNG tên vừa xoá ⇒ ca dương ở trên KHÔNG rỗng: ai xoá một peer thì test sẽ ĐỎ.
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    // Xoá SẠCH peerDependencies ⇒ phải báo ĐỦ cả danh sách (không phải một con số).
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
  });

  
  test("000e: bản gốc KHÔNG có locale/ ⇒ gói ta cũng không ship locale/", () => {
    const stockLocale = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-title-all-prompts-llm", "locale");
    expect(existsSync(stockLocale)).toBe(false);
    expect(existsSync(join(PKG, "locale"))).toBe(false);
    expect(Object.keys(readManifest().exports ?? {})).not.toContain("./locale/*.json");
  });
});


describe("nguồn: consumer dùng THƯ VIỆN GBH qua ĐƯỜNG DẪN TƯƠNG ĐỐI (task-32)", () => {
  test("src/index.ts import thư viện CỦA TA bằng đường dẫn tương đối, KHÔNG bare specifier, KHÔNG bundle DSH", () => {
    const src = readFileSync(join(PKG, "src", "index.ts"), "utf8");
    // (1) Giá trị lẫn kiểu đều lấy từ CHÍNH package thư viện trong repo, qua đường dẫn tương đối.
    expect(src).toContain('} from "../../session-title-llm/src/index.ts";');
    // (2) KHÔNG còn bare specifier: nó chỉ phân giải được nhờ symlink node_modules (gitignore) ⇒ clone mới hỏng.
    expect(src).not.toContain("@galaxy-blackhole/gbh-session-title-llm");
    expect((src.match(/@galaxy-blackhole\//gu) ?? []).length).toBe(0);
    // (3) Không còn BẤT KỲ tham chiếu nào tới bundle DSH của thư viện chính sách.
    expect(src).not.toContain("@deepseek-ai/dsh-session-title-llm");
    // (4) Chống verdict RỖNG: đếm được ĐÚNG hai câu import (một giá trị, một kiểu).
    expect((src.match(/from "\.\.\/\.\.\/session-title-llm\/src\/index\.ts"/gu) ?? []).length).toBe(2);
  });

  test("SHIM đã xoá · package thư viện re-export ĐỦ SÁU kiểu của .d.ts gốc", () => {
    // (1) Shim `declare module` đã bị xoá — đường phân giải bền không cần nó.
    expect(existsSync(join(PKG, "src", "gbh-session-title-llm.d.ts"))).toBe(false);
    // (2) Thư viện công bố đúng SÁU kiểu mà .d.ts bản gốc có (1:1), để consumer không phải tự khai.
    const index = readFileSync(join(REPO, "packages", "host", "session-title-llm", "src", "index.ts"), "utf8");
    for (const typeName of [
      "SessionTitleLlmConfig",
      "ResolvedSessionTitleLlmConfig",
      "SessionTitleLlmPreparedRequest",
      "SessionTitleLlmFinish",
      "SessionTitleLlmResponse",
      "SessionTitleLlmRequestEventData",
    ]) {
      expect(index.includes(typeName)).toBe(true);
    }
    // (3) Đối chứng DƯƠNG: bundle gốc THẬT SỰ công bố đủ sáu kiểu đó.
    const stockTypes = readFileSync(
      join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-title-llm", "lib", "types", "index.d.ts"),
      "utf8",
    );
    expect((stockTypes.match(/^export (?:interface|type) /gmu) ?? []).length).toBe(6);
  });
});

