/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-compaction-basic (row LỒNG trong GROUP `compaction` của 4 preset):
 *      artefact TRÙNG TỪNG BYTE bundle gốc, tập export runtime, String(Config) + 5 đầu vào Config, mount trên
 *      Context cordis THẬT với ba service GIẢ (llm/tokenMeter/sessions) đăng ký ĐÚNG service `compaction` +
 *      4 hook tự động, config resolve (6 ca), compactIfNeeded/compactRegion/compactNow/summarize A/B.
 *      KHÔNG mạng, KHÔNG spawn tiến trình.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 05/11/2026 (P1b): chuẩn hoá id GBH → id gốc trước khi so byte với bundle stock.
import { chuanHoaHost } from "../lib/artefact-normalize.ts";
import { buildPackage } from "../../packages/host/compaction-basic/build.ts";
import { assembleBundle, stripSliceScaffold } from "../../packages/host/compaction-basic/src/assemble.ts";
import {
  MODULE_TAIL,
  OUT_FILE_NAME,
  PACKAGE_NAME,
  PART_FILES,
  SLICE_MARKER,
  STOCK_BUNDLE,
  STOCK_PACKAGE_NAME,
} from "../../packages/host/compaction-basic/src/manifest.ts";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "compaction-basic");
/** Artefact chuẩn của ta (đã build sẵn). */
const LIB = join(PKG, "lib", "index.js");
/** Thư mục gói GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-compaction-basic");
/** Bundle GỐC — oracle của mọi phép so hành vi. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis của kernel — CÙNG một thể hiện cho cả hai bản. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Quy ước A/B của tệp: A = bundle GỐC (`stock`), B = lib/index.js của ta (`ours`). */
/** Bộ export runtime ĐÚNG của gói MỘT MẶT (default trỏ về cùng lớp). */
const EXPORT_NAMES = ["BasicCompactionEngine", "default"];
/** Bốn hook mà chế độ auto đăng ký trên Context. */
const AUTO_HOOKS = ["agent/pre-step", "agent/request-error", "agent/status", "session/event"];
/** Phương thức prototype của lớp engine (kể cả hook nội bộ). */
const PROTOTYPE_NAMES = [
  "constructor",
  "_registerAutomaticCompaction",
  "summarize",
  "compactIfNeeded",
  "compactRegion",
  "compactNow",
  "regionDependencies",
];
/** SHA-256 của bundle gốc 49.452 byte. */
const STOCK_SHA = "b7ac52f20a36430cf01a66b3a36f23a48ffdb22708d714dbe1fff541b5df4ec5";

/** Bề mặt module (của ta hoặc gốc). */
type Api = Record<string, any>;

/** Một lỗi đã chuẩn hoá để so A/B. */
interface Failure {
  /** Tên lớp lỗi. */
  name: string;
  /** Thông điệp. */
  message: string;
  /** Mã lỗi có cấu trúc (nếu có). */
  code?: unknown;
  /** Thông điệp của nguyên nhân (nếu có). */
  cause?: string;
}

/** Kết quả một phép gọi có thể ném (đồng bộ hoặc bất đồng bộ). */
type Attempt = { ok: true; value: unknown } | { ok: false; failure: Failure };

/** Seam LLM GIẢ có ghi vết từng lời gọi. */
interface FakeLlm {
  /** Service cấp cho Context. */
  service: Record<string, unknown>;
  /** Các tham số stream đã nhận, theo thứ tự. */
  calls: any[];
}

/** Một lượt mount trên Context cordis THẬT. */
interface Mounted {
  /** Context vừa dựng. */
  ctx: any;
  /** Fiber của plugin. */
  fiber: any;
  /** Service `compaction` đã resolve qua ctx.get. */
  engine: any;
  /** Seam llm giả của lượt này. */
  llm: FakeLlm;
  /** Seam tokenMeter giả của lượt này. */
  tokenMeter: any;
  /** Seam sessions giả của lượt này. */
  sessions: any;
}

/** Tuỳ chọn mount. */
interface MountOptions {
  /** Cấu hình thô truyền cho plugin. */
  config?: Record<string, unknown>;
  /** Seam llm thay thế. */
  llm?: FakeLlm;
  /** Seam tokenMeter thay thế. */
  tokenMeter?: Record<string, unknown>;
  /** Seam sessions thay thế. */
  sessions?: Record<string, unknown>;
}

let ours: Api;
let stock: Api;
let ContextCtor: new () => any;
let artifactFile: string;
let tempDir: string | undefined;

beforeAll(async () => {
  // B chạy trên lib/index.js của ta; nếu chưa build thì build vào thư mục tạm TRONG gói
  // (để import bare-specifier vẫn đi qua node_modules symlink của gói) rồi dọn ở afterAll.
  if (!existsSync(LIB)) {
    tempDir = mkdtempSync(join(PKG, ".ab-build-"));
    buildPackage(tempDir);
    artifactFile = join(tempDir, "index.js");
  } else {
    artifactFile = LIB;
  }
  ours = (await import(artifactFile)) as Api;
  stock = (await import(STOCK)) as Api;
  ContextCtor = ((await import(CORDIS)) as { Context: new () => any }).Context;
});

afterAll(() => {
  if (tempDir !== undefined) rmSync(tempDir, { recursive: true, force: true });
});

/**
 * Băm SHA-256.
 * Nhận: value — chuỗi hoặc byte.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Chờ tới khi một phép dò trả giá trị khác `undefined`.
 * Nhận: probe — phép dò; label — nhãn lỗi; timeoutMs — trần chờ.
 * Trả: giá trị đầu tiên khác undefined.
 */
async function waitFor<T>(probe: () => T | undefined, label: string, timeoutMs = 2000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error("timeout: " + label);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/**
 * Chuẩn hoá một lỗi thành hình dạng so được A/B.
 * Nhận: error — lỗi bất kỳ.
 * Trả: tên · thông điệp · mã · thông điệp nguyên nhân.
 */
function failureOf(error: unknown): Failure {
  const value = error as any;
  return {
    name: String(value?.name),
    message: String(value?.message),
    ...(value?.code === undefined ? {} : { code: value.code }),
    ...(value?.cause instanceof Error ? { cause: value.cause.message } : {}),
  };
}

/**
 * Chạy một phép gọi, bắt cả ném ĐỒNG BỘ lẫn promise bị từ chối.
 * Nhận: run — phép gọi cần chạy.
 * Trả: giá trị, hoặc lỗi đã chuẩn hoá.
 */
async function attempt(run: () => unknown): Promise<Attempt> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, failure: failureOf(error) };
  }
}

/**
 * Dựng seam LLM GIẢ tối thiểu đúng hợp đồng mà bundle gọi.
 * Nhận: options — info trả cho resolveModelInfo và các chunk phát ra từ stream.
 * Trả: service cấp cho Context + vết lời gọi.
 */
function makeLlm(options: { info?: unknown; chunks?: readonly unknown[] } = {}): FakeLlm {
  const calls: any[] = [];
  const chunks = options.chunks ?? [];
  return {
    calls,
    service: {
      resolveModelInfo: async () => options.info ?? {},
      stream: async function* stream(request: any) {
        calls.push(request);
        for (const chunk of chunks) yield chunk;
      },
    },
  };
}

/**
 * Dựng seam tokenMeter GIẢ.
 * Nhận: measure — phép đo thay thế (mặc định mặt rỗng 0 token).
 * Trả: service cấp cho Context.
 */
function makeMeter(measure?: (session: unknown) => unknown): Record<string, any> {
  return {
    measure: measure ?? (() => ({ nodes: [], totalTokens: 0 })),
    estimateMessage: () => 0,
  };
}

/**
 * Dựng MỘT bản cài trên Context cordis THẬT bằng đường nạp THẬT `ctx.plugin`.
 * Nhận: api — bề mặt module cần mount; options — cấu hình + các seam giả.
 * Trả: context, fiber, service `compaction` và các seam.
 */
async function mount(api: Api, options: MountOptions = {}): Promise<Mounted> {
  const ctx = new ContextCtor() as any;
  const llm = options.llm ?? makeLlm();
  const tokenMeter = options.tokenMeter ?? makeMeter();
  const sessions = options.sessions ?? { flush: async () => undefined };
  // Đọc `inject` từ CHÍNH bundle đang nạp: chỉ cấp đúng những service mà engine khai, không thừa không thiếu.
  const services: Record<string, unknown> = { llm: llm.service, tokenMeter, sessions };
  for (const name of api.BasicCompactionEngine.inject as readonly string[]) {
    const service = services[name];
    if (service === undefined) throw new Error("thieu service gia cho inject: " + name);
    ctx.provide(name, service);
  }
  const fiber = ctx.plugin(api.BasicCompactionEngine, options.config ?? {});
  await fiber;
  const engine = await waitFor(() => ctx.get("compaction") as any, "service compaction");
  return { ctx, fiber, engine, llm, tokenMeter, sessions };
}

/**
 * Gọi schema Config, bắt lỗi validation.
 * Nhận: api — bề mặt module; input — cấu hình thô.
 * Trả: giá trị đã chuẩn hoá, hoặc lỗi đã chuẩn hoá.
 */
function configCall(api: Api, input: Record<string, unknown>): Attempt {
  try {
    return { ok: true, value: api.BasicCompactionEngine.Config(input) };
  } catch (error) {
    return { ok: false, failure: failureOf(error) };
  }
}

/**
 * Dựng TRỰC TIẾP lớp engine (không qua schema của plugin) để đo resolveConfig.
 * Nhận: api — bề mặt module; input — cấu hình thô (luôn kèm auto:false để không đăng ký hook).
 * Trả: config đã resolve (JSON thuần), hoặc lỗi đã chuẩn hoá.
 */
function construct(api: Api, input: Record<string, unknown>): Attempt {
  const ctx = new ContextCtor() as any;
  ctx.provide("llm", makeLlm().service);
  ctx.provide("tokenMeter", makeMeter());
  ctx.provide("sessions", { flush: async () => undefined });
  try {
    const engine = new api.BasicCompactionEngine(ctx, { auto: false, ...input });
    return { ok: true, value: JSON.parse(JSON.stringify(engine.config)) };
  } catch (error) {
    return { ok: false, failure: failureOf(error) };
  }
}

/**
 * Tên các hook KHÔNG nội bộ đã đăng ký trên Context.
 * Nhận: ctx — Context cordis thật.
 * Trả: danh sách tên đã sắp xếp.
 */
function hookNames(ctx: any): string[] {
  return Object.keys(ctx.events._hooks as Record<string, unknown>)
    .filter((name) => !name.startsWith("internal/"))
    .sort();
}

/**
 * Agent GIẢ tối thiểu đúng hình dạng bundle chạm tới.
 * Nhận: options — header request, tuyến options, và runMaintenance tuỳ chọn.
 * Trả: agent giả.
 */
function fakeAgent(
  options: { header?: unknown; provider?: string; model?: string; maintenance?: () => unknown } = {},
): any {
  return {
    session: {
      id: "s-1",
      seq: 0,
      surface: { nodes: [], replaceGeneration: 0 },
      requestHeader: () => options.header,
      toolHistory: () => [],
      eventAt: () => undefined,
    },
    options: {
      ...(options.provider === undefined ? {} : { provider: options.provider }),
      ...(options.model === undefined ? {} : { model: options.model }),
    },
    ...(options.maintenance === undefined ? {} : { runMaintenance: options.maintenance }),
  };
}

describe("A/B bề mặt + cấu hình", () => {
  test("A1 artefact A≡B từng byte · cổng delta 0 · tập export runtime", () => {
    const builtDir = mkdtempSync(join(tmpdir(), "gbh-compaction-basic-"));
    try {
      const built = buildPackage(builtDir);
      // 05/11/2026 (P1b): artefact của ta mang id GBH ⇒ quy id về dạng gốc rồi mới so byte/sha với bản gốc.
      const mine = Buffer.from(chuanHoaHost(readFileSync(built, "utf8")), "utf8");
      const theirs = readFileSync(STOCK);
      expect(mine.equals(theirs)).toBe(true);
      expect(mine.length).toBe(49452);
      expect(sha256(mine)).toBe(STOCK_SHA);
      expect(sha256(mine)).toBe(sha256(theirs));
    } finally {
      rmSync(builtDir, { recursive: true, force: true });
    }
    // 05/11/2026 (P1b): artefact trên đĩa cũng mang id GBH ⇒ chuẩn hoá trước khi so với bản gốc.
    expect(Buffer.from(chuanHoaHost(readFileSync(LIB, "utf8")), "utf8").equals(readFileSync(STOCK))).toBe(true);
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual(EXPORT_NAMES);
    expect(ours.default).toBe(ours.BasicCompactionEngine);
    expect(stock.default).toBe(stock.BasicCompactionEngine);
    expect(ours.BasicCompactionEngine.inject).toEqual(stock.BasicCompactionEngine.inject);
    expect(ours.BasicCompactionEngine.inject).toEqual(["llm", "tokenMeter", "sessions"]);
  });

  test("A2 String(Config) + 5 đầu vào Config A≡B (mặc định · đầy đủ · modelPolicies · 2 lỗi schema)", () => {
    expect(String(ours.BasicCompactionEngine.Config)).toBe(String(stock.BasicCompactionEngine.Config));
    const inputs: Record<string, unknown>[] = [
      {},
      {
        thresholdRatio: 0.5,
        headroomTokens: 100,
        retainRatio: 0.1,
        maxTokens: 2000,
        compactionRetries: 2,
        maxOverflowRetries: 3,
        summarizationProvider: "p",
        summarizationModel: "m",
        auto: false,
      },
      { modelPolicies: [{ provider: "p", model: "m", headroomTokens: 7 }] },
      { maxTokens: 0 },
      { auto: "yes" },
    ];
    for (const input of inputs) {
      expect(configCall(stock, input)).toEqual(configCall(ours, input));
    }
    expect(configCall(ours, {})).toEqual({ ok: true, value: { modelPolicies: [] } });
    expect(configCall(ours, { maxTokens: 0 })).toEqual({
      ok: false,
      failure: { name: "ValidationError", message: "$.maxTokens expected number >= 1 but got 0" },
    });
    expect(configCall(ours, { auto: "yes" })).toEqual({
      ok: false,
      failure: { name: "ValidationError", message: "$.auto expected boolean but got yes" },
    });
  });

  test("A3 mount THẬT trên Context cordis: service `compaction` + 4 hook auto A≡B, KHÔNG đụng bề mặt tool", async () => {
    const a = await mount(ours, { config: { auto: true } });
    const b = await mount(stock, { config: { auto: true } });
    for (const side of [a, b]) {
      expect(side.engine).toBeDefined();
      expect(side.engine.name).toBe("compaction");
      expect(Object.getOwnPropertyNames(Object.getPrototypeOf(side.engine))).toEqual(PROTOTYPE_NAMES);
    }
    expect(a.engine instanceof ours.BasicCompactionEngine).toBe(true);
    expect(b.engine instanceof stock.BasicCompactionEngine).toBe(true);
    expect(a.engine.config).toEqual(b.engine.config);
    expect(a.engine.config.auto).toBe(true);
    expect(hookNames(a.ctx)).toEqual(AUTO_HOOKS);
    expect(hookNames(b.ctx)).toEqual(hookNames(a.ctx));
    expect(a.ctx.get("tools")).toBeUndefined();
    expect(b.ctx.get("tools")).toBeUndefined();
    const offA = await mount(ours, { config: { auto: false } });
    const offB = await mount(stock, { config: { auto: false } });
    expect(hookNames(offA.ctx)).toEqual([]);
    expect(hookNames(offB.ctx)).toEqual([]);
    expect(offA.engine.config.auto).toBe(false);
    expect(offB.engine.config).toEqual(offA.engine.config);
  });

  test("A4 resolveConfig: 3 cấu hình hợp lệ + 4 lỗi tải-gói A≡B", () => {
    const inputs: Record<string, unknown>[] = [
      {},
      {
        thresholdRatio: 0.5,
        headroomTokens: 100,
        retainRatio: 0.1,
        maxTokens: 2000,
        compactionRetries: 2,
        maxOverflowRetries: 3,
        summarizationProvider: "p",
        summarizationModel: "m",
      },
      { modelPolicies: [{ provider: "p", model: "m", headroomTokens: 7 }] },
      { retainRatio: 0.5, retainTokens: 3 },
      { retainRatio: 0.9 },
      { unknownKey: true },
      { summarizationProvider: "p" },
    ];
    for (const input of inputs) expect(construct(stock, input)).toEqual(construct(ours, input));
    expect(construct(ours, {})).toEqual({
      ok: true,
      value: {
        thresholdRatio: 0.8,
        headroomTokens: 65536,
        retainRatio: 0.16,
        summarizationProvider: "",
        summarizationModel: "",
        maxTokens: 65536,
        compactionRetries: 1,
        maxOverflowRetries: 1,
        modelPolicies: [],
        auto: false,
      },
    });
    expect(construct(ours, { modelPolicies: [{ provider: "p", model: "m", headroomTokens: 7 }] })).toEqual({
      ok: true,
      value: {
        thresholdRatio: 0.8,
        headroomTokens: 65536,
        retainRatio: 0.16,
        summarizationProvider: "",
        summarizationModel: "",
        maxTokens: 65536,
        compactionRetries: 1,
        maxOverflowRetries: 1,
        modelPolicies: [{ provider: "p", model: "m", headroomTokens: 7, maxTokens: 7 }],
        auto: false,
      },
    });
    expect(construct(ours, { retainRatio: 0.5, retainTokens: 3 })).toEqual({
      ok: false,
      failure: {
        name: "Error",
        message: "BasicCompactionConfig: retainRatio and retainTokens are mutually exclusive",
      },
    });
    expect(construct(ours, { unknownKey: true })).toEqual({
      ok: false,
      failure: { name: "Error", message: 'BasicCompactionConfig: unknown key "unknownKey"' },
    });
  });
});

describe("A/B hành vi engine trên cùng giàn giả", () => {
  test("A5 compactIfNeeded: không tuyến ⇒ null · context-overflow không dải ⇒ null · thiếu context capacity ⇒ CÙNG lỗi", async () => {
    const a = await mount(ours, { config: { auto: false } });
    const b = await mount(stock, { config: { auto: false } });
    const signal = new AbortController().signal;
    const untargeted = fakeAgent();
    expect(await a.engine.compactIfNeeded(untargeted, "pressure", signal)).toBeNull();
    expect(await b.engine.compactIfNeeded(untargeted, "pressure", signal)).toBeNull();
    const targeted = fakeAgent({ header: { config: { provider: "p", model: "m" } }, provider: "p", model: "m" });
    expect(await a.engine.compactIfNeeded(targeted, "context-overflow", signal)).toBeNull();
    expect(await b.engine.compactIfNeeded(targeted, "context-overflow", signal)).toBeNull();
    const missingA = await attempt(() => a.engine.compactIfNeeded(targeted, "pressure", signal));
    const missingB = await attempt(() => b.engine.compactIfNeeded(targeted, "pressure", signal));
    expect(missingA).toEqual(missingB);
    expect(missingA).toEqual({
      ok: false,
      failure: {
        name: "Error",
        message: "compaction-basic: no context capacity for p/m; configure contextWindow on that adapter model",
      },
    });
  });

  test("A6 compactRegion sai dải + compactNow bận (đồng bộ) + runMaintenance từ chối (bất đồng bộ) A≡B", async () => {
    const a = await mount(ours, { config: { auto: false } });
    const b = await mount(stock, { config: { auto: false } });
    const signal = new AbortController().signal;
    const agent = fakeAgent({ header: { config: { provider: "p", model: "m" } }, provider: "p", model: "m" });
    const regionA = await attempt(() => a.engine.compactRegion(0, 0, agent, signal));
    const regionB = await attempt(() => b.engine.compactRegion(0, 0, agent, signal));
    expect(regionA).toEqual(regionB);
    expect(regionA).toEqual({
      ok: false,
      failure: { name: "Error", message: "compactRegion: start seq 0 not found in surface" },
    });
    const busy = () => fakeAgent({ maintenance: () => { throw new Error("not idle"); } });
    const busyA = await attempt(() => a.engine.compactNow(busy(), signal));
    const busyB = await attempt(() => b.engine.compactNow(busy(), signal));
    expect(busyA).toEqual(busyB);
    expect(busyA).toEqual({
      ok: false,
      failure: {
        name: "ManualCompactionError",
        message: "manual compaction requires an idle agent with no waking queued work",
        code: "busy",
        cause: "not idle",
      },
    });
    const reject = () => fakeAgent({ maintenance: async () => { throw new Error("not idle async"); } });
    expect(await attempt(() => a.engine.compactNow(reject(), signal))).toEqual(
      await attempt(() => b.engine.compactNow(reject(), signal)),
    );
  });

  test("A7 summarize: stream text A≡B (cùng envelope · instruction cuối · provider/model/maxTokens)", async () => {
    const chunks = [
      { type: "block-start", index: 0, blockType: "text" },
      { type: "text-delta", index: 0, text: "## Summary\n- did stuff" },
      { type: "block-end", index: 0, block: { type: "text", text: "## Summary\n- did stuff" } },
      { type: "finish", reason: { kind: "stop" } },
    ];
    const a = await mount(ours, { config: { auto: false }, llm: makeLlm({ chunks }) });
    const b = await mount(stock, { config: { auto: false }, llm: makeLlm({ chunks }) });
    const agent = fakeAgent({ header: { config: { provider: "p", model: "m" } }, provider: "p", model: "m" });
    const input = { messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }] };
    const outA = await a.engine.summarize(input, agent);
    const outB = await b.engine.summarize(input, agent);
    expect(outA).toEqual(outB);
    expect(outA).toEqual({
      summary: [{ type: "text", text: "## Summary\n- did stuff" }],
      rawOutput: [{ type: "text", text: "## Summary\n- did stuff" }],
      llmStreamCall: true,
      provider: "p",
      model: "m",
      maxTokens: 65536,
    });
    expect(a.llm.calls.length).toBe(1);
    expect(a.llm.calls[0]).toEqual(b.llm.calls[0]);
    expect(a.llm.calls[0].provider).toBe("p");
    expect(a.llm.calls[0].model).toBe("m");
    expect(a.llm.calls[0].purpose).toBe("compaction");
    expect(a.llm.calls[0].sessionId).toBe("s-1");
    expect(a.llm.calls[0].maxTokens).toBe(65536);
    expect(a.llm.calls[0].messages.length).toBe(2);
    expect(a.llm.calls[0].messages[1].content[0].text).toContain("You are now acting as a compaction engine");
  });

  test("A8 summarize lỗi: max-tokens ⇒ MAX_TOKENS · không tuyến ⇒ CÙNG thông điệp A≡B", async () => {
    const chunks = [
      { type: "block-start", index: 0, blockType: "text" },
      { type: "text-delta", index: 0, text: "partial" },
      { type: "block-end", index: 0, block: { type: "text", text: "partial" } },
      { type: "finish", reason: { kind: "max-tokens" } },
    ];
    const a = await mount(ours, { config: { auto: false }, llm: makeLlm({ chunks }) });
    const b = await mount(stock, { config: { auto: false }, llm: makeLlm({ chunks }) });
    const input = { messages: [] as unknown[] };
    const agent = fakeAgent({ header: { config: { provider: "p", model: "m" } }, provider: "p", model: "m" });
    const truncatedA = await attempt(() => a.engine.summarize(input, agent));
    const truncatedB = await attempt(() => b.engine.summarize(input, agent));
    expect(truncatedA).toEqual(truncatedB);
    expect(truncatedA).toEqual({
      ok: false,
      failure: {
        name: "Error",
        message: "summarization truncated at the token cap (incomplete checkpoint)",
        code: "MAX_TOKENS",
      },
    });
    const noTargetA = await attempt(() => a.engine.summarize(input, fakeAgent()));
    const noTargetB = await attempt(() => b.engine.summarize(input, fakeAgent()));
    expect(noTargetA).toEqual(noTargetB);
    expect(noTargetA).toEqual({
      ok: false,
      failure: {
        name: "Error",
        message:
          "no provider/model available for summarization: set both BasicCompactionConfig summarization fields, route one request, or set both AgentOptions fields",
      },
    });
  });
});

describe("giao kèo gói + manifest + assemble", () => {
  test("A9 package.json: peer/deps CHÉP stock · gbh peers/tests/nested · KHÔNG gbh.row · locale byte-for-byte · symlink resolve", () => {
    const json = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as any;
    const stockJson = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as any;
    expect(json.name).toBe("@galaxy-blackhole/gbh-compaction-basic");
    expect(json.private).toBe(true);
    expect(json.type).toBe("module");
    expect(json.main).toBe("lib/index.js");
    // 08/11/2026 (dev-1): chính sách types của Lead — gói CÓ lib/types/index.d.ts thì exports["."] phải khai
    // CẢ 'types' + 'default' (đúng hình dạng stock); trước đây chỉ chuỗi './lib/index.js' nên consumer TS
    // không thấy khai kiểu.
    expect(json.exports).toEqual({
      ".": { types: "./lib/types/index.d.ts", default: "./lib/index.js" },
      "./locale/*.json": "./locale/*.json",
      "./package.json": "./package.json",
    });
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(json.peerDependencies, stockJson.peerDependencies)).toBe(true);
    expect(json.peerDependenciesMeta).toEqual(stockJson.peerDependenciesMeta);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(json.dependencies, stockJson.dependencies)).toBe(true);
    expect(json.gbh.peers).toEqual([...Object.keys(json.peerDependencies), ...Object.keys(json.dependencies)]);
    expect(json.gbh.tests).toEqual(["tests/host/compaction-basic.test.ts"]);
    expect(json.gbh.row).toBeUndefined();
    // 20/10/2026 (task-162): manifest có thêm `provenance` (nguồn stock + version + sha bundle gốc) — khai báo
    // CÓ CHỦ ĐÍCH của lô chuyển giao. Giữ nguyên phép so TẬP KHOÁ (không nới) và canh ĐÚNG nội dung provenance.
    expect(Object.keys(json.gbh).sort()).toEqual(["nested", "peers", "provenance", "tests"]);
    expect(json.gbh.provenance).toEqual({
      stock: stockJson.name,
      version: stockJson.version,
      sha: createHash("sha256").update(readFileSync(STOCK, "utf8"), "utf8").digest("hex"),
    });
    expect(json.gbh.nested).toEqual({
      kind: "group",
      pluginId: "compaction-basic",
      stockId: "@deepseek-ai/dsh-compaction-basic",
      presets: ["preset-standard", "preset-ptc", "preset-minimal", "preset-cordis"],
    });
    const require = createRequire(join(PKG, "package.json"));
    for (const name of json.gbh.peers as string[]) {
      expect(existsSync(join(PKG, "node_modules", name, "package.json"))).toBe(true);
      expect(() => require.resolve(name)).not.toThrow();
    }
    for (const file of ["en.json", "zh.json"]) {
      expect(readFileSync(join(PKG, "locale", file)).equals(readFileSync(join(STOCK_DIR, "locale", file)))).toBe(true);
    }
  });

  test("A10 manifest hằng số + assemble khớp stock + stripSliceScaffold từ chối lát thiếu giao kèo", () => {
    expect(PACKAGE_NAME).toBe("@galaxy-blackhole/gbh-compaction-basic");
    expect(STOCK_PACKAGE_NAME).toBe("@deepseek-ai/dsh-compaction-basic");
    expect(STOCK_BUNDLE).toBe("apps/host/node_modules/@deepseek-ai/dsh-compaction-basic/lib/index.js");
    expect(SLICE_MARKER).toBe("// @ts-nocheck");
    expect(MODULE_TAIL).toBe("export {};");
    expect(PART_FILES).toEqual(["part-00.ts", "part-01.ts"]);
    expect(OUT_FILE_NAME).toBe("index.js");
    expect(assembleBundle()).toBe(readFileSync(STOCK, "utf8"));
    const good = "/**\n * desc x\n */\n// @ts-nocheck\n\nA\n\nB\n\nexport {};\n";
    expect(stripSliceScaffold(good, "good.ts")).toEqual(["A", "", "B"]);
    expect(() => stripSliceScaffold("// @ts-nocheck\n\nA\n\nexport {};\n", "no-header.ts")).toThrow(
      "thieu khoi header 5 dong bat buoc",
    );
    expect(() => stripSliceScaffold("/**\n * desc x\n */\n/* @ts-nocheck */\n\nA\n\nexport {};\n", "no-marker.ts")).toThrow(
      "khong thay dong danh dau lat nguyen van",
    );
    expect(() => stripSliceScaffold("/**\n * desc x\n */\n// @ts-nocheck\n\nA\n", "no-tail.ts")).toThrow(
      "thieu dong ket thuc module",
    );
  });
});
