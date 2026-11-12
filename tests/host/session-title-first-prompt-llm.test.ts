/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-session-title-first-prompt-llm: tập export đo trên ARTIFACT,
 *      đối chứng TRỰC TIẾP với chính bundle gốc trên cùng một giàn giả (câu lệnh hệ thống · đóng khung
 *      JSON CHỈ tin nhắn đầu · lấy tiêu đề từ phản hồi · bốn đường lỗi · đường tuyến), ca C6 (danh tính
 *      vật thể cấu hình), quy ước gbh.peers ⊆ peerDependencies kèm ĐỐI CHỨNG ÂM, 000e locale
 *      byte-for-byte, và hợp đồng gbh.row (id `session-title-llm` · config oracle · disabled mirror).
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderRewriteBlock } from "../../apps/cli/src/rewrite-metadata.ts";
import { buildPackage } from "../../packages/host/session-title-first-prompt-llm/build.ts";
import * as ours from "../../packages/host/session-title-first-prompt-llm/src/index.ts";

import { peerRangeProblems } from "./peer-range-harness.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "session-title-first-prompt-llm");
/** Bundle GỐC đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-title-first-prompt-llm");
/** Artifact bản gốc. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Tên package của ta. */
const OUR_NAME = "@galaxy-blackhole/gbh-session-title-first-prompt-llm";
// 20/10/2026 (Lead): gói row `session-title-llm` nay là DRAFT (gbh chỉ có draft/tests/peers/provenance,
// KHÔNG row) ⇒ runtime patch KHÔNG còn row `session-title-llm-ours`; ca "cây patch ĐANG CHẠY" chỉ có
// nghĩa khi gói đã khai row. Đọc trạng thái từ manifest thay vì phỏng đoán.
const DRAFT_PACKAGE = (() => {
  const manifest = JSON.parse(readFileSync(join(REPO, "packages", "host", "session-title-llm", "package.json"), "utf8")) as {
    gbh?: { row?: unknown; row_unmounted_ly_do?: unknown };
  };
  return manifest.gbh?.row === undefined && manifest.gbh?.row_unmounted_ly_do === undefined;
})();

/** Cấu hình của row `session-title-llm` trong profile `blackhole` — đo từ dump MỚI NHẤT của `.parity/dumps/`. */
const PROFILE_CONFIG = {
  targetWords: 5,
  targetCjkCharacters: 10,
  maxInputBytes: 4096,
  maxOutputTokens: 4096,
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
  /** Tiêu đề hiện tại (nếu đã có) — provider first-prompt KHÔNG dùng tới. */
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
  /** Tuỳ chọn cuối mà seam trao cho `stream`. */
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

/** Yêu cầu mặc định: HAI tin nhắn người dùng, có tuyến đã ghi, không tiêu đề hiện tại. */
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

/**
 * Dựng yêu cầu sinh tiêu đề mang ĐÚNG phiên ghi của giàn.
 * Nhận: giàn đo và các trường muốn ghi đè.
 * Trả: yêu cầu đã đủ hình dạng seam trao cho provider.
 */
function requestFor(harness: Harness, overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return { ...defaultRequest(), ...overrides, session: harness.session };
}

/** Dấu vết chuẩn hoá của MỘT lượt sinh tiêu đề — mọi thứ quan sát được. */
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

/**
 * Chạy một lượt gọi và trả THÔNG ĐIỆP lỗi (hoặc `KHONG NEM` khi không ném).
 * Nhận: hàm chạy lượt gọi.
 * Trả: thông điệp lỗi, hoặc `KHONG NEM`.
 */
async function failureOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "KHONG NEM";
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * Tên export của một file ESM đã build (cùng hai regex mà `check:rows` dùng).
 * Nhận: nội dung file.
 * Trả: danh sách tên export đã sắp xếp.
 */
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
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-title-first-")));
    const oursText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["Config", "apply", "inject", "name"]);
    // Row host thuần: KHÔNG có `__ModuleLoader__`, KHÔNG có id module nào trong artifact.
    expect(oursText).not.toContain("__ModuleLoader__");
    // ⚠️ 18/10/2026 (task-13): consumer nay dùng THƯ VIỆN CỦA TA (@galaxy-blackhole/gbh-session-title-llm)
    //   và thư viện đó được INLINE vào artifact ⇒ (a) KHÔNG còn phụ thuộc bundle DSH, (b) KHÔNG còn
    //   specifier của thư viện ta (đã nội tuyến), (c) chỉ còn các gói KERNEL mà thư viện ta dùng.
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

  test("provider đăng ký ĐÚNG MỘT lần, id nguyên văn, nhịp `first-prompt` — y bản gốc", () => {
    const mineHarness = makeHarness([{ type: "finish", reason: { kind: "stop" } }]);
    install(mine, mineHarness);
    const stockHarness = makeHarness([{ type: "finish", reason: { kind: "stop" } }]);
    install(stock, stockHarness);
    for (const harness of [mineHarness, stockHarness]) {
      const provider = harness.registered();
      expect(provider.id).toBe("session-title-first-prompt-llm");
      expect(provider.automatic).toBe("first-prompt");
      expect(typeof provider.generate).toBe("function");
    }
  });
});

describe("sinh tiêu đề: đối chứng với CHÍNH bundle gốc trên cùng giàn", () => {
  test("câu lệnh 5 dòng + đóng khung MẢNG CHỈ tin nhắn đầu; seq nguồn = [1] — y bản gốc", async () => {
    const reply: StreamChunk[] = [
      { type: "text-delta", index: 0, text: "**Fixing the build**" },
      { type: "finish", reason: { kind: "stop" } },
    ];
    const { ours: mineTrace, stock: stockTrace } = await both(reply, defaultRequest);
    expect(mineTrace).toEqual(stockTrace);
    expect(mineTrace.title).toBe("Fixing the build");
    expect(mineTrace.messageSeqs).toEqual([1]);
    expect(mineTrace.model).toEqual({ provider: "deepseek", model: "deepseek-v4.1-flash" });
    expect(mineTrace.maxTokens).toBe(4096);
    expect(mineTrace.reasoningEffort).toBe("low");
    expect(mineTrace.sessionId).toBe("session-1");
    expect(mineTrace.purpose).toBe("session-title");
    expect(mineTrace.route).toEqual({ provider: "deepseek", model: "deepseek-v4.1-flash" });
    expect(mineTrace.callRoute).toEqual({ provider: "deepseek", model: "deepseek-v4.1-flash", maxTokens: 4096 });
    expect(mineTrace.system.split("\n")).toEqual([
      "Create a concise title for an AI coding-assistant session from the supplied human messages.",
      "Return only the title on one line, **in plain text of natural language**, with no quotes, prefix, explanation, Markdown, XML, or terminal control codes. No code is allowed.",
      "Use the language of the messages.",
      "Aim for about 5 words in non-CJK languages or 10 CJK characters.",
      "If the messages give little to name, still return a short best-effort title, such as Greeting, instead of explaining.",
    ]);
    expect(mineTrace.input.startsWith("Generate the session title from this JSON array of human messages:\n")).toBe(true);
    expect(mineTrace.input).toContain('{"seq":1,"text":"the build explodes on the second worker"}');
    // CHỈ tin nhắn ĐẦU: tin nhắn thứ hai KHÔNG được gửi cho model.
    expect(mineTrace.input).not.toContain("please fix the bundling order");
  });

  test("có tiêu đề hiện tại ⇒ KHÔNG đổi gì (first-prompt không neo) — y bản gốc", async () => {
    const reply: StreamChunk[] = [
      { type: "text-delta", index: 0, text: "Fixing the build" },
      { type: "finish", reason: { kind: "stop" } },
    ];
    const request = (): ProviderRequest => ({
      ...defaultRequest(),
      currentTitle: { title: "Old title", source: { kind: "provider" } },
    });
    const { ours: mineTrace, stock: stockTrace } = await both(reply, request);
    expect(mineTrace).toEqual(stockTrace);
    expect(mineTrace.system.split("\n").length).toBe(5);
    expect(mineTrace.input.startsWith("Generate the session title from this JSON array")).toBe(true);
  });

  test("lấy tiêu đề: dòng ĐẦU không rỗng · bỏ nhấn mạnh bao ngoài · giữ nhấn mạnh BÊN TRONG — y bản gốc", async () => {
    const cases: { text: string; expected: string }[] = [
      { text: "   \n\n  Build fix \nsecond line ignored", expected: "Build fix" },
      { text: "**Build fix**", expected: "Build fix" },
      { text: "***Build fix***", expected: "Build fix" },
      { text: "**Fix *x* now**", expected: "Fix *x* now" },
      { text: "*x* and **y**", expected: "*x* and **y**" },
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

  test("KHÔNG có tin nhắn nào ⇒ lỗi nguyên văn, cả hai bản", async () => {
    const reply: StreamChunk[] = [{ type: "finish", reason: { kind: "stop" } }];
    const request = (): ProviderRequest => ({ ...defaultRequest(), messages: [] });
    const mineHarness = makeHarness(reply);
    install(mine, mineHarness);
    const mineMessage = await failureOf(() => mineHarness.registered().generate(requestFor(mineHarness, request())));
    const stockHarness = makeHarness(reply);
    install(stock, stockHarness);
    const stockMessage = await failureOf(() => stockHarness.registered().generate(requestFor(stockHarness, request())));
    expect(mineMessage).toBe("first-prompt title provider requires one human message");
    expect(mineMessage).toBe(stockMessage);
    expect(mineHarness.calls.length).toBe(0);
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

  test("điều khiển thi hành: thiếu tuyến · cặp tuyến lẻ · vượt maxInputBytes · vượt trần thời hạn ⇒ cùng thông điệp", async () => {
    const reply: StreamChunk[] = [
      { type: "text-delta", index: 0, text: "Fix" },
      { type: "finish", reason: { kind: "stop" } },
    ];
    const run = async (plugin: PluginLike, raw: Record<string, unknown>, request = defaultRequest): Promise<string> => {
      const harness = makeHarness(reply);
      return failureOf(async () => {
        install(plugin, harness, raw);
        return harness.registered().generate(requestFor(harness, request()));
      });
    };
    const runRaw = async (plugin: PluginLike, raw: Record<string, unknown>): Promise<string> => {
      const harness = makeHarness(reply);
      return failureOf(async () => {
        installRaw(plugin, harness, raw);
        return harness.registered().generate(requestFor(harness));
      });
    };
    const noRoute = (): ProviderRequest => ({ ...defaultRequest(), route: undefined });
    expect(await run(mine, PROFILE_CONFIG, noRoute)).toBe(
      "session-title-llm: no logged request route is available; configure provider and model together",
    );
    expect(await run(mine, PROFILE_CONFIG, noRoute)).toBe(await run(stock, PROFILE_CONFIG, noRoute));
    expect(await run(mine, { ...PROFILE_CONFIG, provider: "deepseek" })).toBe(
      "session-title-llm: provider and model must be supplied together",
    );
    expect(await run(mine, { ...PROFILE_CONFIG, provider: "deepseek" })).toBe(
      await run(stock, { ...PROFILE_CONFIG, provider: "deepseek" }),
    );
    const tiny = { ...PROFILE_CONFIG, maxInputBytes: 16 };
    const overBytes = await run(mine, tiny);
    expect(overBytes.startsWith("session-title-llm: input is ")).toBe(true);
    expect(overBytes).toContain("exceeding maxInputBytes 16");
    expect(overBytes).toBe(await run(stock, tiny));
    const tooLong = { ...PROFILE_CONFIG, timeoutMs: 2147483648 };
    // Đường tầng nạp (schema): schemastery chặn TRƯỚC ⇒ thông điệp của schemastery, trùng bản gốc.
    expect(await run(mine, tooLong)).toBe(await run(stock, tooLong));
    expect(await run(mine, tooLong)).toContain("timeoutMs");
    // Đường đi VÒNG schema: `apply` ném thông điệp trần đồng hồ của seam, trùng bản gốc.
    expect(await runRaw(mine, tooLong)).toBe("session-title-llm: timeoutMs must not exceed 2147483647");
    expect(await runRaw(mine, tooLong)).toBe(await runRaw(stock, tooLong));
  });

  test("đích độ dài của riêng provider: HAI lớp kiểm — schema rồi `apply`, thông điệp y bản gốc", () => {
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
    for (const raw of [
      { ...PROFILE_CONFIG, targetWords: 0 },
      { ...PROFILE_CONFIG, targetWords: 1.5 },
      { ...PROFILE_CONFIG, targetCjkCharacters: -3 },
    ]) {
      expect(messageOf(mine, raw, true)).toBe(messageOf(stock, raw, true));
      expect(messageOf(mine, raw, true)).not.toBe("KHONG NEM");
    }
    const fractional = messageOf(mine, { ...PROFILE_CONFIG, targetWords: 1.5 }, false);
    expect(fractional).toBe("session-title-first-prompt-llm: targetWords must be a positive integer");
    expect(fractional).toBe(messageOf(stock, { ...PROFILE_CONFIG, targetWords: 1.5 }, false));
    const cjk = messageOf(mine, { ...PROFILE_CONFIG, targetCjkCharacters: 0 }, false);
    expect(cjk).toBe("session-title-first-prompt-llm: targetCjkCharacters must be a positive integer");
    expect(cjk).toBe(messageOf(stock, { ...PROFILE_CONFIG, targetCjkCharacters: 0 }, false));
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
    expect(mineTrace.callRoute).toEqual({ provider: "openai", model: "gpt-x", maxTokens: 4096 });
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

/** Lớp patch ĐANG CHẠY của app — được `bh host` sinh lại mỗi lần boot từ metadata `gbh.row`. */
const APP_PATCH = join(REPO, "profiles", "blackhole", "app.patch.yml");

/**
 * Danh sách peer CHỌN LỌC của riêng gói này — chống verdict RỖNG cho phép ⊆.
 * 01/11/2026: chốt lại theo `gbh.peers` sau lượt đồng bộ manifest — thêm dsh-session và
 * dsh-session-title-llm (hai seam mà bản port thật sự tiêu thụ).
 */
const SEAM_PEERS = [
  "@deepseek-ai/cordis",
  "@deepseek-ai/schemastery",
  "@deepseek-ai/dsh-session-title",
  "@deepseek-ai/dsh-llm",
  "@deepseek-ai/dsh-timeout",
  "@deepseek-ai/dsh-util-values",
  "@deepseek-ai/dsh-session",
  "@deepseek-ai/dsh-session-title-llm",
];

/** Khối metadata thay MỘT row (dùng cho cả `row` lẫn `row_unmounted_ly_do.row`). */
interface RowSpec {
  /** Id row stock bị thay. */
  id?: string;
  /** Config của row mới. */
  config?: Record<string, unknown>;
  /** Mirror trạng thái disabled của oracle cho row STOCK. */
  disabled?: unknown;
  /** Mirror trạng thái disabled cho row CHÈN (CLI render vào chính khối `insert`). */
  insertDisabled?: unknown;
  /** Tệp test chứng minh hành vi. */
  tests?: string[];
  /** Id module phụ (row host thuần: vắng). */
  moduleIds?: string[];
}

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  /** Tên package. */
  name?: string;
  /** Phiên bản. */
  version?: string;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Chỉ mượn KIỂU hoặc để test cài — không phải seam lúc chạy. */
  devDependencies?: Record<string, string>;
  /** Metadata của ta để `bh host` sinh khối patch. */
  gbh?: {
    /** Peer bổ sung ngoài kernel. */
    peers?: string[];
    /** Khối thay row (CHỈ có khi row được mount). */
    row?: RowSpec;
    /** Khối gỡ mount: lý do + row giữ nguyên để mount lại là MỘT dòng. */
    row_unmounted_ly_do?: { ly_do?: string; row?: RowSpec };
  };
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

describe("quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ) + phiên bản khớp kernel", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    const declared = Object.keys(manifest.peerDependencies ?? {});
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
      expect(Object.keys(manifest.devDependencies ?? {})).toContain(peer);
    }
    expect(manifest.dependencies).toBeUndefined();
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const peer of peers) {
      const mutated = JSON.parse(JSON.stringify(manifest)) as Manifest;
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
  });
});

describe("000e — locale en/zh byte-for-byte với bản gốc", () => {
  test("hai tệp tồn tại và THẬT SỰ trùng từng byte", () => {
    for (const name of ["en.json", "zh.json"]) {
      const stockPath = join(STOCK_DIR, "locale", name);
      const oursPath = join(PKG, "locale", name);
      expect(existsSync(oursPath)).toBe(true);
      const hash = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");
      expect(hash(oursPath)).toBe(hash(stockPath));
    }
    expect(Object.keys(readManifest().exports ?? {})).toContain("./locale/*.json");
  });
});

describe("gbh.row — mount MIRROR oracle (row stock đang DISABLED ⇒ row CHÈN cũng disabled)", () => {
  test("metadata: id stock · config oracle · stock disabled:true · insertDisabled:true · tests", () => {
    const gbh = readManifest().gbh;
    const row = gbh?.row;
    expect(row).toBeDefined();
    expect(row?.id).toBe("session-title-llm");
    expect(row?.config).toEqual(PROFILE_CONFIG as unknown as Record<string, unknown>);
    // Oracle DISABLE provider này (dsh-base + bundle experimental bật provider all-prompts khác)
    // ⇒ bản thay thế PHẢI disabled theo, nếu không sẽ có HAI provider cùng đăng ký ⇒ seam ném
    // `session-title provider ... is already registered`.
    expect(row?.disabled).toBe(true);
    expect(row?.insertDisabled).toBe(true);
    const tests = row?.tests ?? [];
    expect(tests).toEqual(["tests/host/session-title-first-prompt-llm.test.ts"]);
    expect(existsSync(join(REPO, tests[0] as string))).toBe(true);
    expect(row?.moduleIds).toBeUndefined();
  });

  test("TEST CANH: KHÔNG còn `row_unmounted_ly_do` (row đã mount lại) — ai gỡ mount phải có lý do", () => {
    const gbh = readManifest().gbh;
    expect(gbh?.row).toBeDefined();
    expect(gbh?.row_unmounted_ly_do).toBeUndefined();
  });

  test("renderRewriteBlock: khối `insert` mang `disabled: true` ĐÚNG SAU dòng name (mirror row stock)", () => {
    const row = readManifest().gbh?.row;
    const block = renderRewriteBlock(OUR_NAME, {
      id: row?.id as string,
      config: row?.config as never,
      disabled: row?.disabled as boolean,
      insertDisabled: row?.insertDisabled as boolean,
      tests: row?.tests,
    });
    const lines = block.split("\n");
    const insertIndex = lines.findIndex((line) => line.trim() === "- id: session-title-llm-ours");
    expect(insertIndex).toBeGreaterThanOrEqual(0);
    expect(lines[insertIndex + 1]?.trim()).toBe("name: '@galaxy-blackhole/gbh-session-title-first-prompt-llm'");
    expect(lines[insertIndex + 2]?.trim()).toBe("disabled: true");
    // Đúng HAI dòng disabled: một cho row STOCK (2 space) và một cho row CHÈN (6 space).
    expect(lines.filter((line) => line.trim() === "disabled: true").length).toBe(2);
    expect(lines[0]).toBe("- id: session-title-llm");
    expect(lines[1]).toBe("  disabled: true");
    expect(lines.some((line) => line.trim() === "insertDisabled: true")).toBe(false);
    expect(block).not.toContain("insertDisabled");
  });

  // 20/10/2026: chỉ chạy khi gói đã khai row (không còn là draft) — xem `DRAFT_PACKAGE`.
  test.skipIf(!existsSync(APP_PATCH) || DRAFT_PACKAGE)("cây patch ĐANG CHẠY: row `session-title-llm-ours` có `disabled: true` và row stock vẫn disabled", () => {
    const lines = readFileSync(APP_PATCH, "utf8").split("\n");
    const insertIndex = lines.findIndex((line) => line.trim() === "- id: session-title-llm-ours");
    expect(insertIndex).toBeGreaterThanOrEqual(0);
    const next = lines.slice(insertIndex + 1).findIndex((line) => /^(- |#)/.test(line));
    const block = lines.slice(insertIndex, insertIndex + (next < 0 ? 10 : next + 1)).map((line) => line.trim());
    expect(block[0]).toBe("- id: session-title-llm-ours");
    expect(block[1]).toBe("name: '@galaxy-blackhole/gbh-session-title-first-prompt-llm'");
    expect(block).toContain("disabled: true");
  });

  test.skipIf(!existsSync(join(REPO, ".parity", "dumps")))("bước 0: oracle dump mới nhất có row `session-title-llm` = gói gốc + ĐÚNG config + disabled: true", () => {
    const dumps = join(REPO, ".parity", "dumps");
    const newest = readdirSync(dumps)
      .filter((name) => existsSync(join(dumps, name, "ours.yml")))
      .sort()
      .pop() as string;
    const lines = readFileSync(join(dumps, newest, "ours.yml"), "utf8").split("\n");
    const index = lines.findIndex((line) => line.trim() === "- id: session-title-llm");
    expect(index).toBeGreaterThanOrEqual(0);
    expect(lines[index + 1]?.trim()).toBe("name: '@deepseek-ai/dsh-session-title-first-prompt-llm'");
    expect(lines[index + 2]?.trim()).toBe("config:");
    const block = lines.slice(index, index + 10).map((line) => line.trim());
    expect(block).toContain("targetWords: 5");
    expect(block).toContain("targetCjkCharacters: 10");
    expect(block).toContain("maxInputBytes: 4096");
    expect(block).toContain("maxOutputTokens: 4096");
    expect(block).toContain("timeoutMs: 60000");
    expect(block).toContain("disabled: true");
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

