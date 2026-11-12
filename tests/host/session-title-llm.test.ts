/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-session-title-llm: mỗi ca dựng HAI giàn giống hệt
 *      nhau trên Context cordis THẬT rồi chạy CẢ HAI bản cài — gói của ta và chính bundle gốc
 *      (@deepseek-ai/dsh-session-title-llm) — so điều khiển đã kiểm, tuyến đã chuẩn bị, bản ghi
 *      session/title-llm-request, phản hồi đã lắp, và từng thông điệp lỗi; cộng ca tập export trên
 *      ARTIFACT, ca gbh.peers ⊆ peerDependencies (có ĐỐI CHỨNG ÂM) và ca C6 (danh tính).
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/session-title-llm/build.ts";
import * as ours from "../../packages/host/session-title-llm/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "session-title-llm");
/** Bundle GỐC đã build trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-title-llm", "lib", "index.js");
/** cordis của kernel — gói ta symlink ĐÚNG bản này nên hai bên dùng CHUNG một lớp Context. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Context cordis THẬT: chỉ seam llm được đắp thêm bằng Proxy. */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as {
  SESSION_TITLE_TIMEOUT_CODE: string;
  SessionTitleLlmConfigFields: Record<string, { toString(): string }>;
  SessionTitleLlmConfigSchema: ((value: unknown) => unknown) & { toString(): string };
  resolveSessionTitleLlmConfig(config: unknown): Record<string, unknown>;
  executeSessionTitleLlm(
    ctx: unknown,
    config: unknown,
    request: unknown,
    titleProvider: unknown,
    prepared: unknown,
  ): Promise<{ blocks: unknown[]; finish: { kind: string }; model: unknown }>;
};

/** Bản của ta nhìn qua cùng hình dạng để so hai bên. */
const mine = ours as unknown as typeof stock;

/** Một mẩu stream — đúng hình dạng StreamChunk mà BlockAssembler.push nhận. */
interface StreamChunk {
  /** Loại mẩu. */
  type: string;
  /** Chỉ số khối của mẩu. */
  index?: number;
  /** Chữ của mẩu văn bản. */
  text?: string;
  /** Kết cục khi kết thúc stream. */
  reason?: { kind: string; failure?: { message: string; code: string } };
  /** Id công cụ của mẩu tool-call-delta. */
  id?: string;
  /** Tên công cụ của mẩu tool-call-delta. */
  name?: string;
  /** Phần tham số của mẩu tool-call-delta. */
  argumentsDelta?: string;
}

/** Một lượt prepareCall đã ghi lại. */
interface RecordedCall {
  /** Cấu hình tuyến mà seam nhận. */
  config: Record<string, unknown>;
  /** Tín hiệu mà seam nhận. */
  signal: AbortSignal;
  /** Điều khiển do bộ chọn mức suy luận trả về. */
  controls?: Record<string, unknown>;
  /** Tùy chọn cuối mà stream nhận. */
  options?: Record<string, unknown>;
}

/** Giàn đo của MỘT bên cài. */
interface Harness {
  /** Context cordis THẬT đã đắp seam llm. */
  ctx: unknown;
  /** Mọi lượt prepareCall. */
  calls: RecordedCall[];
  /** Mọi bản ghi phiên đã nhận. */
  appends: { type: string; data: Record<string, unknown> }[];
  /** Phiên GHI của giàn — yêu cầu gửi cho hàm thi hành phải mang CHÍNH phiên này. */
  session: { id: string; append(type: string, data: Record<string, unknown>): void };
}

/**
 * Dựng giàn cho MỘT bên cài trên Context cordis THẬT.
 * Nhận: dãy mẩu mà tầng LLM giả sẽ phát, và độ trễ trước mỗi mẩu (mili giây).
 * Trả: giàn đo có sổ prepareCall và sổ bản ghi phiên.
 */
function makeHarness(reply: readonly StreamChunk[], delayMs = 0): Harness {
  const calls: RecordedCall[] = [];
  const appends: Harness["appends"] = [];
  const session = {
    id: "session-1",
    append(type: string, data: Record<string, unknown>): void {
      appends.push({ type, data });
    },
  };
  const real = new ContextCtor();
  const ctx = new Proxy(real, {
    get(target, prop) {
      if (prop === "llm") {
        return {
          prepareCall(
            config: Record<string, unknown>,
            signal: AbortSignal,
            controls: (current: Record<string, unknown>, model: unknown) => Record<string, unknown>,
          ) {
            const call: RecordedCall = { config: { ...config }, signal };
            calls.push(call);
            // Cùng hình dạng metadata mà adapter thật cấp: mức suy luận đầu tiên là mức THẤP NHẤT.
            const model = { reasoning: { efforts: [{ id: "low" }, { id: "high" }] } };
            call.controls = controls({}, model);
            return {
              config: { ...call.config, ...call.controls },
              retryPolicy: {},
              adapterDefaults: {},
              stream: async function* stream(options: Record<string, unknown>): AsyncIterable<StreamChunk> {
                call.options = options;
                if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
                for (const chunk of reply) yield chunk;
              },
            };
          },
        };
      }
      const value = Reflect.get(target, prop) as unknown;
      return typeof value === "function" ? (value as (...params: unknown[]) => unknown).bind(target) : value;
    },
  });
  return { ctx, calls, appends, session };
}

/** Cấu hình thi hành hợp lệ dùng chung cho cả hai bên. */
const CONTROL = { maxInputBytes: 4096, maxOutputTokens: 64, timeoutMs: 60000 };

/**
 * Dựng yêu cầu của service mang ĐÚNG phiên ghi của giàn.
 * Nhận: giàn đo và phần ghi đè.
 * Trả: yêu cầu đủ hình dạng seam trao cho hàm thi hành.
 */
function requestFor(harness: Harness, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session: harness.session,
    messages: [
      { seq: 1, text: "the build explodes" },
      { seq: 2, text: "please fix it" },
    ],
    route: { provider: "deepseek", model: "deepseek-v4.1-flash" },
    signal: new AbortController().signal,
    ...overrides,
  };
}

/**
 * Phần provider chuẩn bị dùng chung cho cả hai bên.
 * Nhận: phần ghi đè (đầu vào, seq nguồn, bộ chọn mức suy luận).
 * Trả: đối tượng SessionTitleLlmPreparedRequest đúng hình dạng.
 */
function preparedFor(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    system: "Create a concise title.",
    input: "Generate the session title from this JSON array",
    messageSeqs: [1, 2],
    selectReasoningEffort: (model: { reasoning?: { efforts?: { id: string }[] } }) => model.reasoning?.efforts?.[0]?.id,
    ...overrides,
  };
}

/**
 * Chạy MỘT lượt thi hành trên một bên cài, trả THÔ kết quả hoặc THÔNG ĐIỆP LỖI.
 * Nhận: lớp gói, dãy mẩu, phần ghi đè cấu hình/yêu cầu/phần chuẩn bị, và độ trễ của stream.
 * Trả: dấu vết quan sát được (kết quả + sổ gọi + sổ bản ghi) hoặc thông điệp lỗi.
 */
async function run(
  plugin: typeof stock,
  reply: readonly StreamChunk[],
  options: {
    control?: Record<string, unknown>;
    request?: Record<string, unknown>;
    prepared?: Record<string, unknown>;
    delayMs?: number;
    titleProvider?: string;
  } = {},
  capture?: (messages: unknown) => void,
): Promise<Record<string, unknown>> {
  const harness = makeHarness(reply, options.delayMs ?? 0);
  // Danh tính tin nhắn là NGẪU NHIÊN ở mỗi lượt (createUserMessage cấp id mới) ⇒ phép so A/B chuẩn hoá
  // phần id thành "có id hay không", giữ nguyên role/source/content — mọi thứ còn lại phải trùng.
  const normalize = (messages: unknown): unknown =>
    (messages as Record<string, unknown>[]).map((message) => ({
      role: message["role"],
      source: message["source"],
      content: message["content"],
      idIsString: typeof message["id"] === "string" && (message["id"] as string).length > 0,
    }));
  try {
    const config = plugin.resolveSessionTitleLlmConfig({ ...CONTROL, ...options.control });
    const result = await plugin.executeSessionTitleLlm(
      harness.ctx,
      config,
      requestFor(harness, options.request ?? {}),
      options.titleProvider ?? "session-title-provider",
      preparedFor(options.prepared ?? {}),
    );
    return {
      ok: true,
      result,
      calls: harness.calls.map((call) => {
        capture?.(call.options?.["messages"]);
        return {
        config: call.config,
        controls: call.controls,
        system: call.options?.["system"],
        sessionId: call.options?.["sessionId"],
        purpose: call.options?.["purpose"],
        messages: normalize(call.options?.["messages"]),
        hasSignal: call.options?.["signal"] instanceof AbortSignal,
          optionsFrozen: call.options !== undefined && Object.isFrozen(call.options),
        };
      }),
      appends: harness.appends.map((entry) => ({
        type: entry.type,
        data: { ...entry.data, messages: normalize(entry.data["messages"]) },
      })),
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message, code: (error as { code?: string }).code };
  }
}

/**
 * Tên export của một file ESM đã build (cùng hai regex mà check:rows dùng).
 * Nhận: văn bản artifact.
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

/** Hình dạng package.json của gói ta mà test đọc. */
interface PkgJson {
  /** Tên package. */
  name: string;
  /** Metadata gbh (KHÔNG có row — gói THƯ VIỆN). */
  gbh?: { row?: unknown; peers?: string[]; tests?: string[]; draft?: string };
  /** Peer khai báo. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thật (phải RỖNG). */
  dependencies?: Record<string, string>;
}

/**
 * Đọc package.json của gói ta.
 * Nhận: không.
 * Trả: nội dung đã parse.
 */
function pkgJson(): PkgJson {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PkgJson;
}

describe("bề mặt gói: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (5 tên)", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-stl-")));
    const oursText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual([
      "SESSION_TITLE_TIMEOUT_CODE",
      "SessionTitleLlmConfigFields",
      "SessionTitleLlmConfigSchema",
      "executeSessionTitleLlm",
      "resolveSessionTitleLlmConfig",
    ]);
    // Bốn module ngoài nạp LÚC CHẠY — đúng bản gốc; cordis/dsh-session/dsh-session-title chỉ mượn KIỂU.
    for (const specifier of [
      "@deepseek-ai/schemastery",
      "@deepseek-ai/dsh-llm",
      "@deepseek-ai/dsh-timeout",
      "@deepseek-ai/dsh-util-values",
    ]) {
      expect(oursText).toContain('from "' + specifier + '"');
      expect(stockText).toContain('from "' + specifier + '"');
    }
    for (const specifier of ["@deepseek-ai/cordis", "@deepseek-ai/dsh-session", "@deepseek-ai/dsh-session-title"]) {
      expect(oursText).not.toContain('from "' + specifier + '"');
    }
    expect(oursText).not.toContain("__ModuleLoader__");
  });

  test("SESSION_TITLE_TIMEOUT_CODE + String(schema) + String(từng trường) TRÙNG bản gốc", () => {
    expect(mine.SESSION_TITLE_TIMEOUT_CODE).toBe(stock.SESSION_TITLE_TIMEOUT_CODE);
    expect(mine.SESSION_TITLE_TIMEOUT_CODE).toBe("SESSION_TITLE_TIMEOUT");
    expect(String(mine.SessionTitleLlmConfigSchema)).toBe(String(stock.SessionTitleLlmConfigSchema));
    for (const key of Object.keys(stock.SessionTitleLlmConfigFields)) {
      expect(String(mine.SessionTitleLlmConfigFields[key])).toBe(String(stock.SessionTitleLlmConfigFields[key]));
    }
    expect(Object.keys(mine.SessionTitleLlmConfigFields)).toEqual(Object.keys(stock.SessionTitleLlmConfigFields));
  });

  test("schema TỪ CHỐI cùng thông điệp cho cùng đầu vào sai", () => {
    const failure = (schema: (value: unknown) => unknown, raw: unknown): string => {
      try {
        schema(raw);
        return "KHONG NEM";
      } catch (error) {
        return (error as Error).message;
      }
    };
    for (const raw of [
      {},
      { maxInputBytes: 0, maxOutputTokens: 1, timeoutMs: 1 },
      { maxInputBytes: 1, maxOutputTokens: 1, timeoutMs: 0 },
      { maxInputBytes: 1, maxOutputTokens: 1, timeoutMs: 2_147_483_648 },
      { maxInputBytes: 1, maxOutputTokens: 1, timeoutMs: 1, provider: 5 },
    ]) {
      expect(failure(mine.SessionTitleLlmConfigSchema, raw)).toBe(failure(stock.SessionTitleLlmConfigSchema, raw));
      expect(failure(mine.SessionTitleLlmConfigSchema, raw)).not.toBe("KHONG NEM");
    }
  });
});

describe("resolveSessionTitleLlmConfig — kiểm điều khiển thi hành, đối chứng từng thông điệp", () => {
  /** Bảng ca: tên, cấu hình thô, và kỳ vọng ("OK" hoặc thông điệp lỗi). */
  const CASES: { name: string; raw: unknown; expected: "OK" | string }[] = [
    { name: "hợp lệ, không tuyến", raw: CONTROL, expected: "OK" },
    { name: "hợp lệ, có cặp tuyến", raw: { ...CONTROL, provider: "deepseek", model: "m" }, expected: "OK" },
    { name: "null ⇒ NÉM", raw: null, expected: "session-title-llm: configuration is required" },
    { name: "không phải object ⇒ NÉM", raw: 5, expected: "session-title-llm: configuration is required" },
    {
      name: "khoá lạ ⇒ NÉM",
      raw: { ...CONTROL, extra: 1 },
      expected: 'session-title-llm: unknown config key "extra"',
    },
    {
      name: "maxInputBytes 0 ⇒ NÉM",
      raw: { ...CONTROL, maxInputBytes: 0 },
      expected: "session-title-llm: maxInputBytes must be a positive integer",
    },
    {
      name: "maxOutputTokens 1.5 ⇒ NÉM",
      raw: { ...CONTROL, maxOutputTokens: 1.5 },
      expected: "session-title-llm: maxOutputTokens must be a positive integer",
    },
    {
      name: "timeoutMs âm ⇒ NÉM",
      raw: { ...CONTROL, timeoutMs: -1 },
      expected: "session-title-llm: timeoutMs must be a positive integer",
    },
    {
      name: "timeoutMs vượt MAX_TIMER_DELAY_MS ⇒ NÉM",
      raw: { ...CONTROL, timeoutMs: 2_147_483_648 },
      expected: "session-title-llm: timeoutMs must not exceed 2147483647",
    },
    {
      name: "provider mà thiếu model ⇒ NÉM",
      raw: { ...CONTROL, provider: "deepseek" },
      expected: "session-title-llm: provider and model must be supplied together",
    },
    {
      name: "model mà thiếu provider ⇒ NÉM",
      raw: { ...CONTROL, model: "m" },
      expected: "session-title-llm: provider and model must be supplied together",
    },
    {
      name: "cặp tuyến rỗng ⇒ NÉM",
      raw: { ...CONTROL, provider: "", model: "" },
      expected: "session-title-llm: provider and model overrides must be non-empty strings",
    },
  ];
  for (const ca of CASES) {
    test(ca.name, () => {
      const results = [mine, stock].map((plugin) => {
        try {
          return { value: plugin.resolveSessionTitleLlmConfig(ca.raw), error: undefined as string | undefined };
        } catch (error) {
          return { value: undefined, error: (error as Error).message };
        }
      });
      expect(results[0]).toEqual(results[1]);
      if (ca.expected === "OK") {
        expect(results[0]?.error).toBe(undefined);
        expect(results[0]?.value).toEqual(ca.raw as Record<string, unknown>);
      } else {
        expect(results[0]?.error).toBe(ca.expected);
      }
    });
  }

  test("kết quả ĐÃ ĐÓNG BĂNG SÂU và TÁCH RỜI khỏi đầu vào (cả hai bản)", () => {
    for (const plugin of [mine, stock]) {
      const raw = { ...CONTROL, provider: "deepseek", model: "m" };
      const resolved = plugin.resolveSessionTitleLlmConfig(raw);
      expect(Object.isFrozen(resolved)).toBe(true);
      expect(resolved).not.toBe(raw);
      expect(resolved).toEqual(raw);
    }
  });
});

describe("executeSessionTitleLlm — đối chứng TỪNG TRƯỜNG với bundle gốc trên Context cordis THẬT", () => {
  test("đường hạnh phúc: khối văn bản + kết cục stop + tuyến, bản ghi request ĐÚNG MỘT lần", async () => {
    const reply: StreamChunk[] = [
      { type: "text-delta", index: 0, text: "Fixing" },
      { type: "text-delta", index: 0, text: " the build" },
      { type: "finish", reason: { kind: "stop" } },
    ];
    const a = await run(mine, reply);
    const b = await run(stock, reply);
    expect(a).toEqual(b);
    const result = a["result"] as { blocks: unknown[]; finish: { kind: string }; model: unknown };
    expect(result.blocks).toEqual([{ type: "text", text: "Fixing the build" }]);
    expect(result.finish).toEqual({ kind: "stop" });
    expect(result.model).toEqual({ provider: "deepseek", model: "deepseek-v4.1-flash" });
    const appends = a["appends"] as { type: string; data: Record<string, unknown> }[];
    expect(appends).toHaveLength(1);
    expect(appends[0]?.type).toBe("session/title-llm-request");
    expect(appends[0]?.data["route"]).toEqual({ provider: "deepseek", model: "deepseek-v4.1-flash" });
    expect(appends[0]?.data["maxTokens"]).toBe(64);
    expect(appends[0]?.data["messageSeqs"]).toEqual([1, 2]);
    expect(appends[0]?.data["reasoningEffort"]).toBe("low");
    expect(appends[0]?.data["titleProvider"]).toBe("session-title-provider");
    const calls = a["calls"] as Record<string, unknown>[];
    expect(calls).toHaveLength(1);
    expect(calls[0]?.["purpose"]).toBe("session-title");
    expect(calls[0]?.["sessionId"]).toBe("session-1");
    expect(calls[0]?.["hasSignal"]).toBe(true);
    expect(calls[0]?.["optionsFrozen"]).toBe(true);
    expect(calls[0]?.["config"]).toEqual({ provider: "deepseek", model: "deepseek-v4.1-flash", maxTokens: 64 });
    expect(calls[0]?.["system"]).toBe("Create a concise title.");
  });

  test("tuyến TƯỜNG MINH trong cấu hình THẮNG tuyến đã ghi trong yêu cầu", async () => {
    const reply: StreamChunk[] = [{ type: "finish", reason: { kind: "stop" } }];
    const options = { control: { ...CONTROL, provider: "auto", model: "deepseek-v4.1-flash" } };
    const a = await run(mine, reply, options);
    const b = await run(stock, reply, options);
    expect(a).toEqual(b);
    expect((a["result"] as { model: unknown }).model).toEqual({ provider: "auto", model: "deepseek-v4.1-flash" });
    expect((a["calls"] as Record<string, unknown>[])[0]?.["config"]).toEqual({
      provider: "auto",
      model: "deepseek-v4.1-flash",
      maxTokens: 64,
    });
  });

  test("bộ chọn mức suy luận của provider ĐƯỢC áp vào điều khiển; không có effort thì VẮNG khoá", async () => {
    const reply: StreamChunk[] = [{ type: "finish", reason: { kind: "stop" } }];
    const chosen = await run(mine, reply, { prepared: { selectReasoningEffort: () => "high" } });
    const chosenStock = await run(stock, reply, { prepared: { selectReasoningEffort: () => "high" } });
    expect(chosen).toEqual(chosenStock);
    expect((chosen["appends"] as { data: Record<string, unknown> }[])[0]?.data["reasoningEffort"]).toBe("high");
    const none = await run(mine, reply, { prepared: { selectReasoningEffort: () => undefined } });
    const noneStock = await run(stock, reply, { prepared: { selectReasoningEffort: () => undefined } });
    expect(none).toEqual(noneStock);
    const data = (none["appends"] as { data: Record<string, unknown> }[])[0]?.data ?? {};
    expect("reasoningEffort" in data).toBe(false);
  });

  test("kết cục max-tokens: bản ghi VẪN được ghi rồi mới trả finish (cả hai bản)", async () => {
    const reply: StreamChunk[] = [
      { type: "text-delta", index: 0, text: "partial" },
      { type: "finish", reason: { kind: "max-tokens" } },
    ];
    const a = await run(mine, reply);
    const b = await run(stock, reply);
    expect(a).toEqual(b);
    expect((a["result"] as { finish: { kind: string } }).finish).toEqual({ kind: "max-tokens" });
    expect((a["appends"] as unknown[]).length).toBe(1);
  });

  test("kết cục tool-calls ĐƯỢC trả về (provider tự từ chối) — không ném ở tầng này", async () => {
    const reply: StreamChunk[] = [
      { type: "tool-call-delta", index: 0, id: "call-1", name: "bash", argumentsDelta: "{}" },
      { type: "finish", reason: { kind: "tool-calls" } },
    ];
    const a = await run(mine, reply);
    const b = await run(stock, reply);
    expect(a).toEqual(b);
    expect((a["result"] as { finish: { kind: string } }).finish).toEqual({ kind: "tool-calls" });
  });
});

describe("executeSessionTitleLlm — SÁU đường lỗi, đối chứng từng thông điệp", () => {
  test("yêu cầu đã bị huỷ TRƯỚC ⇒ ném NGAY, không gọi tầng LLM, không ghi gì", async () => {
    for (const plugin of [mine, stock]) {
      const harness = makeHarness([{ type: "finish", reason: { kind: "stop" } }]);
      const controller = new AbortController();
      controller.abort();
      const config = plugin.resolveSessionTitleLlmConfig(CONTROL);
      let threw = false;
      try {
        await plugin.executeSessionTitleLlm(
          harness.ctx,
          config,
          requestFor(harness, { signal: controller.signal }),
          "p",
          preparedFor(),
        );
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
      expect(harness.calls).toHaveLength(0);
      expect(harness.appends).toHaveLength(0);
    }
  });

  test("không có seq nguồn ⇒ cùng thông điệp", async () => {
    const a = await run(mine, [], { prepared: { messageSeqs: [] } });
    const b = await run(stock, [], { prepared: { messageSeqs: [] } });
    expect(a).toEqual(b);
    expect(a["message"]).toBe("session-title-llm: at least one source message is required");
  });

  test("đầu vào vượt maxInputBytes ⇒ cùng thông điệp NÊU ĐÚNG số byte", async () => {
    const options = { control: { ...CONTROL, maxInputBytes: 5 }, prepared: { input: "0123456789" } };
    const a = await run(mine, [], options);
    const b = await run(stock, [], options);
    expect(a).toEqual(b);
    expect(a["message"]).toBe("session-title-llm: input is 10 bytes, exceeding maxInputBytes 5");
  });

  test("không có tuyến nào ⇒ cùng thông điệp", async () => {
    const a = await run(mine, [], { request: { route: undefined } });
    const b = await run(stock, [], { request: { route: undefined } });
    expect(a).toEqual(b);
    expect(a["message"]).toBe(
      "session-title-llm: no logged request route is available; configure provider and model together",
    );
  });

  test("kết cục error/aborted ⇒ NÉM mang ĐÚNG mã lỗi của provider", async () => {
    for (const kind of ["error", "aborted"]) {
      const reply: StreamChunk[] = [
        { type: "finish", reason: { kind, failure: { message: "provider exploded", code: "RATE_LIMITED" } } },
      ];
      const a = await run(mine, reply);
      const b = await run(stock, reply);
      expect(a).toEqual(b);
      expect(a["ok"]).toBe(false);
      expect(a["message"]).toBe("provider exploded");
      expect(a["code"]).toBe("RATE_LIMITED");
    }
  });

  test("hết hạn chót ⇒ ném TimeoutReason mang mã SESSION_TITLE_TIMEOUT (cả hai bản)", async () => {
    const reply: StreamChunk[] = [{ type: "text-delta", index: 0, text: "late" }];
    const options = { control: { ...CONTROL, timeoutMs: 1 }, delayMs: 60 };
    const a = await run(mine, reply, options);
    const b = await run(stock, reply, options);
    expect(a["ok"]).toBe(false);
    expect(b["ok"]).toBe(false);
    expect(a["message"]).toBe(b["message"]);
    expect(a["code"]).toBe(mine.SESSION_TITLE_TIMEOUT_CODE);
    expect(b["code"]).toBe(stock.SESSION_TITLE_TIMEOUT_CODE);
  });
});

describe("C6 — DANH TÍNH: hai lượt thi hành KHÔNG chia sẻ vật thể", () => {
  test("hai lượt trên cùng cấu hình ⇒ hai danh sách tin nhắn RIÊNG, hai quyết định RIÊNG", async () => {
    const reply: StreamChunk[] = [{ type: "finish", reason: { kind: "stop" } }];
    let messagesA: unknown[] = [];
    let messagesB: unknown[] = [];
    await run(mine, reply, {}, (messages) => {
      messagesA = messages as unknown[];
    });
    await run(mine, reply, {}, (messages) => {
      messagesB = messages as unknown[];
    });
    expect(messagesA).not.toBe(messagesB);
    expect(messagesA[0]).not.toBe(messagesB[0]);
    const config = mine.resolveSessionTitleLlmConfig(CONTROL);
    const second = mine.resolveSessionTitleLlmConfig(CONTROL);
    expect(config).not.toBe(second);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(second)).toBe(true);
  });
});

describe("quy ước repo: GÓI THƯ VIỆN (không gbh.row) · gbh.peers ⊆ peerDependencies", () => {
  test("KHÔNG khai gbh.row vì bản gốc KHÔNG có hàm apply (không phải row)", () => {
    const json = pkgJson();
    expect(json.gbh?.row).toBe(undefined);
    expect(json.gbh?.draft ?? "").toContain("KHÔNG PHẢI ROW");
    expect(json.gbh?.tests).toEqual(["tests/host/session-title-llm.test.ts"]);
    // Đối chứng DƯƠNG: bản gốc thật sự KHÔNG export apply ⇒ không khai gbh.row là ĐÚNG.
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(stockText)).not.toContain("apply");
  });

  test("gbh.peers là TẬP CON của peerDependencies, không tên nào trong dependencies", () => {
    const json = pkgJson();
    const peers = json.peerDependencies ?? {};
    const declared = json.gbh?.peers ?? [];
    expect(declared.length).toBe(7);
    expect(declared.filter((name) => !(name in peers))).toEqual([]);
    expect(Object.keys(json.dependencies ?? {})).toEqual([]);
    // ĐỐI CHỨNG ÂM: xoá một tên ⇒ lệch; thêm tên lạ ⇒ lệch.
    const gaps = (list: readonly string[], deps: Record<string, string>): string[] =>
      list.filter((name) => !(name in deps));
    expect(gaps(declared, peers)).toEqual([]);
    expect(gaps(declared.slice(1), peers)).toEqual([]);
    expect(gaps([...declared, "@deepseek-ai/khong-ton-tai"], peers)).toEqual(["@deepseek-ai/khong-ton-tai"]);
  });
});
