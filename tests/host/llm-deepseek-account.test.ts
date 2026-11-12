/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-llm-deepseek-account: mỗi ca dựng HAI giàn giống hệt
 *      nhau rồi chạy CẢ HAI bản cài (ta và chính bundle gốc @deepseek-ai/dsh-llm-deepseek-account) trên
 *      CÙNG một server /models cục bộ, so từng giá trị; cộng ca tập export đo trên ARTIFACT (nạp THẬT
 *      cả hai bên), ca gbh.peers ⊆ peerDependencies có 3 ĐỐI CHỨNG ÂM, ca C6 (not.toBe), ca flaky dùng
 *      waitFor CÓ TRẦN, ca locale 000e và ca canh `gbh.row` chưa khai.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildPackage } from "../../packages/host/llm-deepseek-account/build.ts";
import { exportNames, loadAccountUnderTest } from "./llm-deepseek-account-harness.ts";
import {
  DEFAULT_MODELS_MAX_AGE_MS,
  DEFAULT_MODELS_TIMEOUT_MS,
  plainAccountOptions,
  resolveAccountOptions,
} from "../../packages/host/llm-deepseek-account/src/config.ts";
import type { AccountOptions, ModelOverride } from "../../packages/host/llm-deepseek-account/src/config.ts";
import { brandNeutral } from "../lib/brand-neutral.ts";
import { resolveAccountCatalog } from "../../packages/host/llm-deepseek-account/src/resolve-catalog.ts";

/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK = "../../apps/host/node_modules/@deepseek-ai/dsh-llm-deepseek-account/lib/index.js";
/** Thư mục gói gốc trong kernel (CHỈ ĐỌC) — dùng cho luật locale 000e. */
const STOCK_DIR = new URL("../../apps/host/node_modules/@deepseek-ai/dsh-llm-deepseek-account/", import.meta.url);
/** `LlmError` của KERNEL — mọi ca danh tính so với chính thể hiện này. */
const KERNEL_LLM = "../../apps/host/node_modules/@deepseek-ai/dsh-llm/lib/index.js";
/** Bản cài của chính gói ta trong node_modules của package (đo danh tính lớp lỗi). */
const OURS_LLM = "../../packages/host/llm-deepseek-account/node_modules/@deepseek-ai/dsh-llm/lib/index.js";
/** Origin giả cho các ca KHÔNG chạm mạng (phân giải cấu hình, thông điệp lỗi). */
const NO_SERVER = "http://127.0.0.1:9";

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as { name: string; inject: string[]; Config: (value: unknown) => LiveConfig; apply: (ctx: unknown, config: unknown) => void; };
/** Bề mặt `LlmError` mà test này đọc (lớp thật do kernel cấp). */
interface TypedLlmError extends Error {
  code: string;
  failure: { status?: number };
  cause?: unknown;
}

/** Thể hiện lỗi + hằng số của kernel, nạp động cùng lý do. */
const kernel = (await import(KERNEL_LLM)) as {
  LlmError: new (message: string, code: string, options?: { status?: number; cause?: unknown }) => TypedLlmError;
  APP_IDENTITY: { product: string; version: string; url: string };
  QUOTA_EXCEEDED_CODE: string;
};
const { APP_IDENTITY, LlmError, QUOTA_EXCEEDED_CODE } = kernel;

/** Bộ phân giải của gói adapter (peer) — nguồn của catalog dựng sẵn mà route tài khoản xếp lớp lên. */
const ADAPTER = "../../apps/host/node_modules/@deepseek-ai/dsh-llm-deepseek/lib/index.js";
const adapter = (await import(ADAPTER)) as { resolveAdapterOptions: (config: unknown) => { models: { id: string }[] } };
const resolveAdapterOptions = adapter.resolveAdapterOptions;

/** Bản của ta — ARTEFACT có peer kernel (xem tests/host/llm-deepseek-account-harness.ts). */
const underTest = await loadAccountUnderTest();
const { Config, apply, inject, name } = underTest.module;
/** Helper nội bộ của artefact — lỗi nó ném ra phải CÙNG LỚP kernel. */
const { parseModelListing } = underTest.probe;
const artifactFile = underTest.artifactFile;

afterAll(() => {
  underTest.cleanup();
});

/** Một cấu hình SỐNG như cordis trao cho plugin: mọi trường volatile có `.get()`. */
interface LiveConfig { [field: string]: { get(): unknown }; }

/** Một sự kiện `settings.configure` mà seam `settings` nhận trong hiệu ứng con. */
interface SettingsCall { value: unknown; }

/** Đầu vào dựng một giàn. */
interface HarnessOptions {
  /** Token tài khoản trả về; `undefined` = chưa đăng nhập, hàm = đổi token giữa các lượt. */
  token?: string | (() => string | undefined);
  /** `true` = KHÔNG có service tài khoản nào (seam tuỳ chọn vắng mặt). */
  noAccount?: boolean;
  /** Id row đang nạp plugin; vắng mặt = plugin không nạp từ entry nào. */
  entryId?: string;
}

/** Giàn giả tối thiểu nhưng ĐÚNG hình dạng seam: mọi lời gọi đăng ký đều được ghi lại. */
interface Harness {
  ctx: never;
  providers: Record<string, unknown>[];
  adapters: { providers: string[]; adapter: { dependencies: Dependencies } }[];
  replaced: Record<string, unknown>[][];
  injects: string[][];
  settings: SettingsCall[];
  listeners: string[];
  effectLabels: string[];
  disposers: (() => void)[];
  rejected: string[];
  warns(): number;
}

/** Phần phụ thuộc mà adapter giữ lại — chính là những gì `apply` của ta trao cho kernel. */
interface Dependencies {
  options(): Connection;
  connect(signal?: AbortSignal): Promise<Connection>;
  resolveAuth(connection: Connection): Promise<Auth>;
  admit(connection: Connection, model: string): void;
  discoverModels(provider: string): Promise<ModelInfo[]>;
  providerName?: string;
}

interface Auth {
  headers: Record<string, string>;
  onRequestError?: (error: unknown) => Promise<unknown>;
}

interface Connection {
  baseURL: string;
  models: { id: string; name?: string; contextWindow?: number; maxTokens?: number; inputModalities?: string[]; systemPromptUpdate?: string; toolUpdate?: string; imageMaxBytes?: number }[];
  maxTokens: number;
  catalog: {
    offered: { id: string }[];
    resolution: { id: string }[];
    refusals: ReadonlyMap<string, { kind: string; requiredVersion?: string }>;
    problems: string[];
    overrideErrors: string[];
  };
}

interface ModelInfo { provider: string; id: string; name: string; inputModalities: string[]; }

/** Một bản cài đã chạy trên giàn của nó. */
interface Installed { h: Harness; deps: Dependencies; }

// Dựng giàn: sổ provider/adapter, seam tài khoản, seam settings, môi trường và entry của loader.
function harness(options: HarnessOptions = {}): Harness {
  const providers: Record<string, unknown>[] = [];
  const adapters: Harness["adapters"] = [];
  const replaced: Record<string, unknown>[][] = [];
  const injects: string[][] = [];
  const settings: SettingsCall[] = [];
  const listeners: string[] = [];
  const effectLabels: string[] = [];
  const disposers: (() => void)[] = [];
  const rejected: string[] = [];
  let warns = 0;
  const tokenOf = (): string | undefined => (typeof options.token === "function" ? options.token() : options.token);
  const account = {
    resolveToken: async (_url: string) => tokenOf(),
    rejectToken: async (token: string) => {
      rejected.push(token);
    },
  };
  const ctx = {
    fiber: { entry: options.entryId === undefined ? undefined : { options: { id: options.entryId } } },
    logger: {
      warn: (): void => {
        warns += 1;
      },
    },
    llm: {
      registerConfigurableProviders(entries: Record<string, unknown>[]): unknown {
        providers.push(...entries);
        return { replace: (next: Record<string, unknown>[]) => void replaced.push(next), dispose: () => undefined };
      },
      registerAdapter(routes: string[], adapter: Harness["adapters"][number]["adapter"]): unknown {
        adapters.push({ providers: routes, adapter });
        return { replace: () => undefined, dispose: () => undefined };
      },
    },
    get(key: string): unknown {
      if (key === "launchEnvironment") return { get: () => undefined, getFrom: () => undefined };
      if (key === "deepseekAccount") return options.noAccount === true ? undefined : account;
      return undefined;
    },
    inject(deps: string[], callback: (child: unknown) => void): void {
      injects.push(deps);
      callback({
        effect(execute: () => unknown): () => void {
          settings.push({ value: execute() });
          return () => undefined;
        },
        settings: { configure: (value: unknown) => ({ configured: value }) },
      });
    },
    on(event: string): () => void {
      listeners.push(event);
      return () => undefined;
    },
    effect(execute: () => () => void, label?: string): () => void {
      effectLabels.push(String(label));
      disposers.push(execute());
      return () => undefined;
    },
  };
  return { ctx: ctx as never, providers, adapters, replaced, injects, settings, listeners, effectLabels, disposers, rejected, warns: () => warns };
}

// Chạy một bản cài trên giàn MỚI rồi trả phần phụ thuộc nó trao cho kernel.
function install(applyFn: (ctx: never, config: never) => void, config: unknown, options: HarnessOptions = {}): Installed {
  const h = harness(options);
  applyFn(h.ctx, config as never);
  const first = h.adapters[0];
  if (first === undefined) throw new Error("không có adapter nào được đăng ký");
  return { h, deps: first.adapter.dependencies };
}

// Server /models cục bộ: đếm lượt gọi và ghi lại header của từng request.
type Responder = (request: Request, call: number) => Response | Promise<Response>;
function startServer(respond: Responder): { origin: string; calls: () => number; seen: { url: string; headers: Record<string, string> }[]; stop: () => void } {
  let calls = 0;
  const seen: { url: string; headers: Record<string, string> }[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      calls += 1;
      seen.push({ url: request.url, headers: Object.fromEntries(request.headers) });
      return respond(request, calls);
    },
  });
  return { origin: `http://127.0.0.1:${server.port}`, calls: () => calls, seen, stop: () => void server.stop(true) };
}

// Một mục danh sách /models hợp lệ; `patch` phủ lên để dựng ca lỗi/biên.
function entry(id: string, patch: Record<string, unknown> = {}): Record<string, unknown> {
  const base = { context_window: 524_288, max_output_tokens: 131_072, input_modalities: ["text"], output_modalities: ["text"] };
  return { id, ...base, api_capabilities: { anthropic_messages: {} }, ...patch };
}

// Thân /models gồm đúng các mục đã cho.
function listing(...entries: Record<string, unknown>[]): Response {
  return new Response(JSON.stringify({ data: entries }), { headers: { "content-type": "application/json" } });
}

// Cấu hình cho MỘT bản cài: baseURL trỏ server cục bộ, ba trường danh mục ghi đè được.
function configValue(baseURL: string, patch: Record<string, unknown> = {}): Record<string, unknown> {
  return { baseURL: baseURL + "/anthropic", modelsTimeoutMs: 2_000, modelsMaxAgeMs: 600_000, ...patch };
}

// Cặp bản cài (ta + gốc) trên CÙNG một origin và CÙNG đầu vào giàn.
function pair(origin: string, patch: Record<string, unknown> = {}, options: HarnessOptions = {}): { ours: Installed; theirs: Installed } {
  const value = configValue(origin, patch);
  return { ours: install(apply as never, Config(value), options), theirs: install(stock.apply, stock.Config(value), options) };
}

// Dọn một bản cài: gọi mọi disposer của hiệu ứng (huỷ lượt nạp đang chạy).
function disposeAll(...installs: Installed[]): void {
  for (const installed of installs) for (const disposer of installed.h.disposers) disposer();
}

// Bản chụp so sánh được của một kết nối: Map được đổi thành mảng đã sắp xếp.
function snapshotOf(connection: Connection): unknown {
  return {
    baseURL: connection.baseURL,
    maxTokens: connection.maxTokens,
    models: connection.models,
    catalog: {
      offered: connection.catalog.offered,
      resolution: connection.catalog.resolution,
      refusals: [...connection.catalog.refusals.entries()].sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
      problems: connection.catalog.problems,
      overrideErrors: connection.catalog.overrideErrors,
    },
  };
}

// Schema schemastery của một bên (tham số hẹp hơn `unknown`) dùng như hàm dựng cấu hình.
const factoryOf = (schema: unknown): ((value: unknown) => unknown) => schema as (value: unknown) => unknown;

// Chờ tới khi `predicate` đúng — CÓ TRẦN cứng, hết trần thì NÉM (không treo, không xanh oan).
async function waitFor(predicate: () => boolean, what: string, timeoutMs = 3_000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error(`waitFor hết trần ${timeoutMs}ms: ${what}`);
    await Bun.sleep(5);
  }
}

// Bắt `console.warn` trong lúc chạy một thao tác (route báo lỗi danh sách qua console, không ném).
async function captureWarn<T>(run: () => Promise<T>): Promise<{ value: T; warn: string[] }> {
  const warn: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => void warn.push(args.map(String).join(" "));
  try {
    return { value: await run(), warn };
  } finally {
    console.warn = original;
  }
}

// Chuẩn hoá origin động (cổng ngẫu nhiên) để so được hai bên.
function normalizeUrls(lines: string[]): string[] {
  return lines.map((line) => line.replace(/http:\/\/127\.0\.0\.1:\d+/g, "<url>"));
}

async function outcome<T>(run: () => Promise<T> | T): Promise<{ ok?: T; err?: Record<string, unknown> }> {
  try {
    return { ok: await run() };
  } catch (error) {
    const failure = error as Error & { code?: string; failure?: { status?: number } };
    return {
      err: { name: failure.name, code: failure.code, status: failure.failure?.status, message: failure.message, kernelClass: error instanceof kernel.LlmError },
    };
  }
}

/** Một manifest package.json như phép kiểm §1d cần. */
interface PeerManifest { name: string; gbh?: { peers?: string[]; row?: unknown }; peerDependencies?: Record<string, string>; }

// Luật M6 §1d: `gbh.peers` phải là TẬP CON của `peerDependencies`, so PHẦN TỬ (rỗng = đạt).
function missingPeers(manifest: PeerManifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

// Đọc một package.json trong repo.
function manifestAt(relative: string): PeerManifest {
  return JSON.parse(readFileSync(new URL("../../" + relative, import.meta.url), "utf8")) as PeerManifest;
}

// Băm sha256 của một tệp — dùng cho luật 000e (chép byte-for-byte).
function sha256(path: URL | string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

// Tên model mà một kết nối quảng bá cho id cho trước.
function nameIn(connection: Connection, id = "deepseek-flash"): string | undefined {
  return connection.models.find((model) => model.id === id)?.name;
}

describe("bề mặt plugin: đo trên ARTIFACT, nạp THẬT cả hai bên", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js đã build)", async () => {
    // Build trong CHÍNH thư mục package: artifact nạp peer qua node_modules của package (build ở /tmp
    // thì `import "@deepseek-ai/dsh-llm"` không resolve — đúng như profile thật, nơi peer được symlink).
    const outDir = mkdtempSync(join(import.meta.dir, "..", "..", "packages", "host", "llm-deepseek-account", ".artifact-"));
    try {
    const artifact = await buildPackage(outDir);
    const text = readFileSync(artifact, "utf8");
    const ours = exportNames(text);
    expect(ours).toEqual(exportNames(readFileSync(new URL(STOCK, import.meta.url), "utf8")));
    expect(ours).toEqual(["Config", "apply", "inject", "name"]);
    expect(ours).not.toContain("default");
    // Row HOST-ONLY: bundle KHÔNG được tự khai id module nào của gói gốc (đúng lệnh nghiệm thu).
    expect(text.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    // NẠP THẬT cả hai artifact rồi so PHẦN TỬ của không gian tên — không chỉ đọc văn bản.
    const loadedOurs = (await import(pathToFileURL(artifact).href)) as Record<string, unknown>;
    const loadedTheirs = (await import(STOCK)) as Record<string, unknown>;
    expect(Object.keys(loadedOurs).sort()).toEqual(Object.keys(loadedTheirs).sort());
    expect(Object.keys(loadedOurs).sort()).toEqual(["Config", "apply", "inject", "name"]);
    const live = (loadedOurs.Config as (value: unknown) => LiveConfig)({});
    expect(live.modelsTimeoutMs?.get()).toBe(DEFAULT_MODELS_TIMEOUT_MS);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  test("name · inject · Config khớp bản gốc từng chữ", () => {
    expect(name).toBe(stock.name);
    expect(name).toBe("llm-deepseek-account");
    expect(inject).toEqual(stock.inject);
    expect(inject).toEqual(["llm"]);
    expect(String(Config)).toBe(String(stock.Config));
    const live = Config({}) as LiveConfig;
    const theirs = stock.Config({});
    expect(Object.keys(live)).toEqual(Object.keys(theirs));
    expect(Object.keys(live)).not.toContain("models");
    expect(live.modelsTimeoutMs?.get()).toBe(DEFAULT_MODELS_TIMEOUT_MS);
    expect(live.modelsTimeoutMs?.get()).toBe(theirs.modelsTimeoutMs?.get());
    expect(live.modelsMaxAgeMs?.get()).toBe(DEFAULT_MODELS_MAX_AGE_MS);
    expect(live.modelOverrides?.get()).toEqual({});
  });

  test("plainAccountOptions · resolveAccountOptions: giá trị SỐNG, endpoint /models, ghi đè chỉ giữ trường KHAI", () => {
    const live = Config({ modelsTimeoutMs: 1234, modelOverrides: { "deepseek-flash": { maxTokens: 99 } } });
    const plain = plainAccountOptions(live as never) as AccountOptions;
    expect(plain.modelsTimeoutMs).toBe(1234);
    // Schema điền mảng chưa đặt thành []: bước phân giải mới BỎ nó (y bản gốc).
    expect(plain.modelOverrides).toEqual({ "deepseek-flash": { maxTokens: 99, inputModalities: [] } });
    expect((plainAccountOptions({ modelsTimeoutMs: 7 } as never) as AccountOptions).modelsTimeoutMs).toBe(7);
    const resolved = resolveAccountOptions({
      baseURL: NO_SERVER + "/anthropic",
      modelOverrides: { "deepseek-flash": { name: "Flash", inputModalities: [], maxTokens: undefined } as ModelOverride },
    });
    expect(resolved.catalog).toEqual({
      url: `${NO_SERVER}/models`,
      timeoutMs: DEFAULT_MODELS_TIMEOUT_MS,
      maxAgeMs: DEFAULT_MODELS_MAX_AGE_MS,
    });
    // `inputModalities: []` và `maxTokens: undefined` là "chưa đặt" ⇒ BỎ (y bản gốc).
    expect(resolved.modelOverrides).toEqual({ "deepseek-flash": { name: "Flash" } });
    expect(resolved.protocol.baseURL).toBe(NO_SERVER + "/anthropic");
  });

  test("parseModelListing: lọc modalities, đọc capabilities/requirement, đếm dòng bỏ; thân hỏng ⇒ INVALID_RESPONSE", () => {
    const parsed = parseModelListing({
      data: [
        entry("deepseek-flash", {
          name: "Flash",
          input_modalities: ["image", "text", "audio"],
          context_window: 1000,
          max_output_tokens: 100,
          api_capabilities: { anthropic_messages: { system_prompt_update: "in-history" } },
        }),
        entry("deepseek-v4-pro", { input_modalities: "text" }),
        entry("deepseek-flash"),
        { not: "a model" },
        entry("", {}),
      ],
    });
    expect(parsed.skipped).toBe(3);
    expect(parsed.entries.map((item) => item.id)).toEqual(["deepseek-flash", "deepseek-v4-pro"]);
    expect(parsed.entries[0]?.capabilities).toEqual({
      usable: true,
      // Thứ tự theo DANH SÁCH (`image` đứng trước `text` trong input_modalities), y bản gốc.
      facts: { inputModalities: ["image", "text"], contextWindow: 1000, maxOutputTokens: 100, systemPromptUpdate: "in-history" },
    });
    expect(parsed.entries[0]?.requirement).toEqual({ kind: "none" });
    expect(parsed.entries[1]?.capabilities).toEqual({ usable: false, reason: "declares no input modality Galaxy Blackhole supports" });
    const failure = (body: unknown): TypedLlmError => {
      try {
        parseModelListing(body);
        throw new Error("đáng lẽ phải ném");
      } catch (error) {
        return error as TypedLlmError;
      }
    };
    const noData = failure({});
    expect(noData).toBeInstanceOf(kernel.LlmError);
    expect(noData.code).toBe("INVALID_RESPONSE");
    expect(noData.message).toBe('DeepSeek model listing has no "data" array');
    expect(failure({ data: "x" }).message).toBe('DeepSeek model listing has no "data" array');
    expect(failure({ data: [] }).message).toBe("DeepSeek model listing contains no model entry");
  });

  test("resolveAccountCatalog: xếp lớp + cổng phiên bản + ghi đè + chẩn đoán (đúng thứ tự offered)", () => {
    const { entries } = parseModelListing({
      data: [
        entry("deepseek-flash", {
          name: "Flash (account)",
          input_modalities: ["text", "image"],
          context_window: 524_288,
          max_output_tokens: 131_072,
          api_capabilities: { anthropic_messages: { system_prompt_update: "in-history" } },
        }),
        entry("deepseek-unknown"),
        entry("deepseek-new", { client_requirements: { [APP_IDENTITY.product]: { min_version: "9.0.0" } } }),
        entry("deepseek-bad-req", { client_requirements: { [APP_IDENTITY.product]: { min_version: "" } } }),
      ],
    });
    const supported = resolveAdapterOptions({}).models;
    const result = resolveAccountCatalog({
      listing: entries,
      supported,
      overrides: { "deepseek-flash": { maxTokens: 4_096 }, "ghost-model": { maxTokens: 1 } },
      routeMaxTokens: 256_000,
      clientVersion: APP_IDENTITY.version,
    });
    expect(result.offered.map((model) => model.id)).toEqual(["deepseek-flash"]);
    expect(result.resolution.map((model) => model.id)).toEqual(["deepseek-flash", "deepseek-v4-pro"]);
    expect([...result.refusals.entries()]).toEqual([
      ["deepseek-unknown", { kind: "unsupported" }],
      ["deepseek-new", { kind: "upgrade-required", requiredVersion: "9.0.0" }],
      ["deepseek-bad-req", { kind: "unsupported" }],
    ]);
    expect(result.problems).toEqual(['model "deepseek-bad-req" declares an unreadable client requirement']);
    expect(result.overrideErrors).toEqual([
      'modelOverrides names "ghost-model", which neither the account listing nor the built-in catalog describes',
    ]);
    const flash = result.offered[0];
    expect(flash?.name).toBe("Flash (account)");
    expect(flash?.contextWindow).toBe(524_288);
    expect(flash?.maxTokens).toBe(4_096);
    expect(flash?.systemPromptUpdate).toBe("in-history");
    // Không có danh sách ⇒ offered = resolution (CÙNG vật, y bản gốc), không từ chối gì.
    const bare = resolveAccountCatalog({ listing: undefined, supported, overrides: {}, routeMaxTokens: 256_000, clientVersion: APP_IDENTITY.version });
    expect(bare.offered).toBe(bare.resolution);
    expect(bare.offered.map((model) => model.id)).toEqual(["deepseek-flash", "deepseek-v4-pro"]);
    expect([...bare.refusals.entries()]).toEqual([]);
  });
});

describe("hành vi: mọi ca chạy CẢ HAI bản cài trên cùng một server /models", () => {
  test("apply: provider cấu hình được + adapter + settings + listener + nhãn hiệu ứng; settingsNs theo id ROW", () => {
    const server = startServer(() => listing(entry("deepseek-flash")));
    try {
      const { ours, theirs } = pair(server.origin, {}, { token: "tok-1", entryId: "llm-deepseek-account" });
      expect(ours.h.providers).toEqual(theirs.h.providers);
      expect(ours.h.providers).toEqual([
        { provider: "deepseek-account", displayName: "DeepSeek Account", settingsNs: "llm-deepseek-account", settingsPath: [] },
      ]);
      expect(ours.h.adapters.map((item) => item.providers)).toEqual([["deepseek-account"]]);
      expect(ours.h.adapters.map((item) => item.providers)).toEqual(theirs.h.adapters.map((item) => item.providers));
      expect(ours.h.injects).toEqual(theirs.h.injects);
      expect(ours.h.injects).toEqual([["settings"]]);
      expect(ours.h.settings).toEqual(theirs.h.settings);
      expect(ours.h.settings).toEqual([{ value: { configured: { auto: false } } }]);
      expect(ours.h.listeners).toEqual(theirs.h.listeners);
      expect(ours.h.listeners).toEqual(["loader/volatile-update"]);
      expect(ours.h.effectLabels).toEqual(theirs.h.effectLabels);
      expect(ours.h.effectLabels).toEqual(["llm-deepseek-account: model catalog"]);
      expect(ours.h.disposers.length).toBe(1);
      expect(Object.keys(ours.deps).sort()).toEqual(Object.keys(theirs.deps).sort());
      expect(ours.deps.providerName).toBe("DeepSeek Account");
      // settingsNs lấy id ROW đang nạp; không có entry ⇒ tên plugin (y bản gốc).
      const named = pair(server.origin, {}, { token: "tok-1", entryId: "llm-deepseek-account-ours" });
      expect(named.ours.h.providers[0]?.settingsNs).toBe("llm-deepseek-account-ours");
      expect(named.ours.h.providers).toEqual(named.theirs.h.providers);
      disposeAll(ours, theirs, named.ours, named.theirs);
    } finally {
      server.stop();
    }
  });

  test("cấu hình sai ⇒ NÉM ngay lúc nạp, TRƯỚC mọi đăng ký — A/B NGUYÊN VĂN 8 thông điệp", () => {
    const cases: Record<string, unknown>[] = [
      { models: [] },
      { modelsTimeoutMs: 0 },
      { modelsTimeoutMs: 2_147_483_648 },
      { modelsMaxAgeMs: -1 },
      { modelsMaxAgeMs: 1.5 },
      { modelOverrides: { "": {} } },
      { modelOverrides: { x: { id: "x" } } },
      { modelOverrides: { x: { maxTokens: -5 } } },
    ];
    const measure = (applyFn: (ctx: never, config: never) => void, value: unknown) => {
      const h = harness({});
      let message = "";
      try {
        applyFn(h.ctx, value as never);
      } catch (error) {
        message = (error as Error).message;
      }
      return { message, providers: h.providers.length, adapters: h.adapters.length, effects: h.effectLabels.length };
    };
    for (const value of cases) {
      const ours = measure(apply as never, value);
      expect(ours).toEqual(measure(stock.apply, value));
      expect(ours.providers).toBe(0);
      expect(ours.adapters).toBe(0);
      expect(ours.effects).toBe(0);
    }
    expect(measure(apply as never, { models: [] }).message).toBe(
      "llm-deepseek-account: models is no longer configurable; the account /models listing supplies the catalog. Remove models from this entry and adjust single models with modelOverrides.<model id>",
    );
    expect(measure(apply as never, { modelsTimeoutMs: 0 }).message).toBe(
      "llm-deepseek-account: modelsTimeoutMs must be a positive finite number no greater than 2147483647",
    );
    expect(measure(apply as never, { modelsMaxAgeMs: -1 }).message).toBe(
      "llm-deepseek-account: modelsMaxAgeMs must be a non-negative safe integer",
    );
    expect(measure(apply as never, { modelOverrides: { "": {} } }).message).toBe(
      "llm-deepseek-account: modelOverrides keys must be non-empty model ids",
    );
    expect(measure(apply as never, { modelOverrides: { x: { id: "x" } } }).message).toBe(
      'llm-deepseek-account: modelOverrides.x sets "id", which is its key',
    );
  });

  test("connect: danh sách tài khoản XẾP LỚP lên catalog dựng sẵn; model lạ bị TỪ CHỐI; đòi phiên bản cao hơn", async () => {
    const server = startServer(() =>
      listing(
        entry("deepseek-flash", {
          name: "Flash (account)",
          input_modalities: ["text", "image"],
          context_window: 524_288,
          max_output_tokens: 131_072,
          api_capabilities: { anthropic_messages: { system_prompt_update: "in-history" } },
        }),
        entry("deepseek-unknown"),
        entry("deepseek-new", { client_requirements: { [APP_IDENTITY.product]: { min_version: "9.0.0" } } }),
        entry("deepseek-v4-pro", { context_window: 0 }),
      ),
    );
    try {
      const { ours, theirs } = pair(server.origin, {}, { token: "tok-1" });
      const connected = await ours.deps.connect();
      const theirsConnected = await theirs.deps.connect();
      expect(snapshotOf(connected)).toEqual(snapshotOf(theirsConnected));
      expect(connected.catalog.offered.map((model) => model.id)).toEqual(["deepseek-flash"]);
      expect(connected.catalog.resolution.map((model) => model.id)).toEqual(["deepseek-flash", "deepseek-v4-pro"]);
      expect([...connected.catalog.refusals.entries()]).toEqual([
        ["deepseek-unknown", { kind: "unsupported" }],
        ["deepseek-new", { kind: "upgrade-required", requiredVersion: "9.0.0" }],
        ["deepseek-v4-pro", { kind: "unsupported" }],
      ]);
      // Model QUEN thuộc nhưng khai trần hỏng mới sinh chẩn đoán (model lạ bị cổng id chặn trước đó).
      expect(connected.catalog.problems).toEqual(['model "deepseek-v4-pro" declares an invalid context_window or max_output_tokens']);
      const flash = connected.models.find((model) => model.id === "deepseek-flash");
      expect(flash).toEqual({
        id: "deepseek-flash",
        name: "Flash (account)",
        contextWindow: 524_288,
        maxTokens: 131_072,
        systemPromptUpdate: "in-history",
        toolUpdate: "addition-only",
        inputModalities: ["text", "image"],
        imageMaxBytes: 2_097_152,
      });
      // Header lượt xin danh sách: token tài khoản + chấp nhận JSON + User-Agent của harness.
      const request = server.seen[0];
      expect(request?.url).toBe(`${server.origin}/models`);
      expect(request?.headers["x-dsh-auth-token"]).toBe("tok-1");
      expect(request?.headers.accept).toBe("application/json");
      expect(String(request?.headers["user-agent"] ?? "")).toContain(APP_IDENTITY.product);
      disposeAll(ours, theirs);
    } finally {
      server.stop();
    }
  });

  test("resolveAuth + onRequestError: chưa đăng nhập ⇒ ACCOUNT_SIGN_IN_REQUIRED · QUOTA ⇒ ACCOUNT_QUOTA · 401 ⇒ ACCOUNT_TOKEN_INVALID + rejectToken · 403/lỗi khác ⇒ NGUYÊN vật", async () => {
    const server = startServer(() => listing(entry("deepseek-flash")));
    try {
      const signedOut = pair(server.origin, {}, { token: undefined });
      const noService = pair(server.origin, {}, { noAccount: true });
      for (const [oursInstalled, theirsInstalled] of [
        [signedOut.ours, signedOut.theirs],
        [noService.ours, noService.theirs],
      ] as [Installed, Installed][]) {
        const oursOutcome = await outcome(() => oursInstalled.deps.resolveAuth(oursInstalled.deps.options()));
        expect(oursOutcome).toEqual(await outcome(() => theirsInstalled.deps.resolveAuth(theirsInstalled.deps.options())));
        expect(oursOutcome.err?.code).toBe("ACCOUNT_SIGN_IN_REQUIRED");
        expect(oursOutcome.err?.kernelClass).toBe(true);
        expect(String(oursOutcome.err?.message)).toContain("Sign in to DeepSeek to use the account provider");
      }
      const { ours, theirs } = pair(server.origin, {}, { token: "tok-1" });
      const oursAuth = await ours.deps.resolveAuth(ours.deps.options());
      const theirsAuth = await theirs.deps.resolveAuth(theirs.deps.options());
      expect(oursAuth.headers).toEqual(theirsAuth.headers);
      expect(oursAuth.headers).toEqual({ "x-dsh-auth-token": "tok-1" });
      const quota = new kernel.LlmError("quota ran out", QUOTA_EXCEEDED_CODE, { status: 402 });
      const oursQuota = (await oursAuth.onRequestError?.(quota)) as TypedLlmError;
      const theirsQuota = (await theirsAuth.onRequestError?.(quota)) as TypedLlmError;
      const quotaView = (error: TypedLlmError) => ({ code: error.code, message: error.message, keepsCause: error.cause === quota });
      expect(quotaView(oursQuota)).toEqual(quotaView(theirsQuota));
      expect(quotaView(oursQuota)).toEqual({ code: "ACCOUNT_QUOTA", message: "quota ran out", keepsCause: true });
      const unauthorized = new kernel.LlmError("token rejected", "AUTH", { status: 401 });
      const oursRejected = (await oursAuth.onRequestError?.(unauthorized)) as TypedLlmError;
      const theirsRejected = (await theirsAuth.onRequestError?.(unauthorized)) as TypedLlmError;
      expect({ code: oursRejected.code, status: oursRejected.failure.status }).toEqual({ code: "ACCOUNT_TOKEN_INVALID", status: 401 });
      expect({ code: theirsRejected.code, status: theirsRejected.failure.status }).toEqual({ code: "ACCOUNT_TOKEN_INVALID", status: 401 });
      expect(ours.h.rejected).toEqual(["tok-1"]);
      expect(theirs.h.rejected).toEqual(["tok-1"]);
      const forbidden = new kernel.LlmError("forbidden", "AUTH", { status: 403 });
      expect(await oursAuth.onRequestError?.(forbidden)).toBe(forbidden);
      expect(await theirsAuth.onRequestError?.(forbidden)).toBe(forbidden);
      const plain = new Error("transport exploded");
      expect(await oursAuth.onRequestError?.(plain)).toBe(plain);
      expect(await theirsAuth.onRequestError?.(plain)).toBe(plain);
      // 401 lần hai: token ĐÃ bị xoá vẫn được báo lại (service tài khoản tự quyết định có xoá nữa không).
      await oursAuth.onRequestError?.(unauthorized);
      expect(ours.h.rejected).toEqual(["tok-1", "tok-1"]);
      disposeAll(signedOut.ours, signedOut.theirs, noService.ours, noService.theirs, ours, theirs);
    } finally {
      server.stop();
    }
  });

  test("admit: chặn TRƯỚC I/O bằng đúng mã + nguyên văn; model không bị từ chối thì đi qua", async () => {
    const server = startServer(() =>
      listing(
        entry("deepseek-flash"),
        entry("deepseek-unknown"),
        entry("deepseek-new", { client_requirements: { [APP_IDENTITY.product]: { min_version: "9.0.0" } } }),
      ),
    );
    try {
      const { ours, theirs } = pair(server.origin, {}, { token: "tok-1" });
      const connected = await ours.deps.connect();
      const theirsConnected = await theirs.deps.connect();
      const upgrade = await outcome(() => ours.deps.admit(connected, "deepseek-new"));
      expect(brandNeutral(JSON.stringify(upgrade))).toBe(JSON.stringify(await outcome(() => theirs.deps.admit(theirsConnected, "deepseek-new"))));
      expect(upgrade.err?.code).toBe("CLIENT_UPGRADE_REQUIRED");
      expect(upgrade.err?.kernelClass).toBe(true);
      expect(upgrade.err?.message).toBe(
        `DeepSeek model "deepseek-new" requires Galaxy Blackhole 9.0.0 or later; current version is ${APP_IDENTITY.version}`,
      );
      const unsupported = await outcome(() => ours.deps.admit(connected, "deepseek-unknown"));
      expect(brandNeutral(JSON.stringify(unsupported))).toBe(JSON.stringify(await outcome(() => theirs.deps.admit(theirsConnected, "deepseek-unknown"))));
      expect(unsupported.err?.code).toBe("MODEL_UNSUPPORTED");
      expect(unsupported.err?.message).toBe(
        `DeepSeek model "deepseek-unknown" is not supported by Galaxy Blackhole; current version is ${APP_IDENTITY.version}`,
      );
      expect(() => ours.deps.admit(connected, "deepseek-flash")).not.toThrow();
      expect(() => ours.deps.admit(connected, "model-nao-do")).not.toThrow();
      disposeAll(ours, theirs);
    } finally {
      server.stop();
    }
  });

  test("discoverModels: chưa đăng nhập ⇒ []; có token ⇒ mục catalogModelInfo; ghi đè hỏng ⇒ công bố `error` ĐÚNG MỘT lần", async () => {
    const server = startServer(() => listing(entry("deepseek-flash", { name: "Flash (account)" })));
    try {
      const signedOut = pair(server.origin, {}, { token: undefined });
      expect(await signedOut.ours.deps.discoverModels("deepseek-account")).toEqual([]);
      expect(await signedOut.theirs.deps.discoverModels("deepseek-account")).toEqual([]);
      const broken = pair(server.origin, { modelOverrides: { "ghost-model": { maxTokens: 123 } } }, { token: "tok-1" });
      const oursDiscovered = await broken.ours.deps.discoverModels("deepseek-account");
      expect(oursDiscovered).toEqual(await broken.theirs.deps.discoverModels("deepseek-account"));
      expect(oursDiscovered).toEqual([
        { provider: "deepseek-account", id: "deepseek-flash", name: "Flash (account)", inputModalities: ["text"] },
      ]);
      expect(broken.ours.h.replaced).toEqual(broken.theirs.h.replaced);
      expect(broken.ours.h.replaced.length).toBe(1);
      expect(broken.ours.h.replaced[0]?.[0]).toEqual({
        provider: "deepseek-account",
        displayName: "DeepSeek Account",
        settingsNs: "llm-deepseek-account",
        settingsPath: [],
        error: 'modelOverrides names "ghost-model", which neither the account listing nor the built-in catalog describes',
      });
      // Lượt discovery thứ hai: cùng chẩn đoán ⇒ KHÔNG công bố lại (bản gốc cũng vậy).
      await broken.ours.deps.discoverModels("deepseek-account");
      expect(broken.ours.h.replaced.length).toBe(1);
      disposeAll(signedOut.ours, signedOut.theirs, broken.ours, broken.theirs);
    } finally {
      server.stop();
    }
  });

  test("tầng vận chuyển danh sách: HTTP 500 · JSON hỏng · thiếu data · chuyển hướng · HẾT HẠN — lượt hỏng bị NUỐT, cảnh báo đúng mã", async () => {
    const cases: {
      respond: (request: Request, call: number) => Response | Promise<Response>;
      patch?: Record<string, unknown>;
      contains: string;
    }[] = [
      { respond: () => new Response("boom", { status: 500 }), contains: "answered HTTP 500" },
      { respond: () => new Response("not json"), contains: "did not answer with JSON" },
      { respond: () => new Response(JSON.stringify({ models: [] })), contains: 'no "data" array' },
      { respond: () => new Response(null, { status: 302, headers: { location: "/elsewhere" } }), contains: "could not reach" },
      {
        respond: async () => {
          await Bun.sleep(300);
          return listing(entry("deepseek-flash"));
        },
        patch: { modelsTimeoutMs: 20 },
        contains: "timed out after 20 ms",
      },
    ];
    for (const item of cases) {
      const server = startServer(item.respond);
      try {
        const { ours, theirs } = pair(server.origin, item.patch ?? {}, { token: "tok-1" });
        // Danh sách hỏng KHÔNG ném ra ngoài: route GIỮ catalog dựng sẵn và cảnh báo một lần.
        const oursRun = await captureWarn(() => ours.deps.connect());
        const theirsRun = await captureWarn(() => theirs.deps.connect());
        expect(normalizeUrls(oursRun.warn)).toEqual(normalizeUrls(theirsRun.warn));
        expect(oursRun.warn.length).toBe(1);
        expect(oursRun.warn[0]).toContain("[llm-deepseek-account]");
        expect(oursRun.warn[0]).toContain(item.contains);
        expect(oursRun.warn[0]).toContain("using the bundled catalog");
        expect(oursRun.value.catalog.offered.map((model) => model.id)).toEqual(["deepseek-flash", "deepseek-v4-pro"]);
        disposeAll(ours, theirs);
      } finally {
        server.stop();
      }
    }
  });

  test("đệm danh sách: lượt ĐẦU chờ nạp; lượt sau KHÔNG xin lại; quá tuổi ⇒ làm mới NỀN (waitFor CÓ TRẦN)", async () => {
    const scenario = async (applyFn: (ctx: never, config: never) => void, makeConfig: (value: unknown) => unknown) => {
      const server = startServer((_request, call) => listing(entry("deepseek-flash", { name: `ban-${call}` })));
      const installed = install(applyFn, makeConfig(configValue(server.origin, { modelsMaxAgeMs: 0 })), { token: "tok-1" });
      try {
        const first = await installed.deps.connect();
        const second = await installed.deps.connect();
        const firstLoadCount = server.calls();
        await waitFor(() => server.calls() >= 2, "lượt làm mới nền phải tới server");
        await waitFor(
          () => installed.deps.options().models.some((model) => model.name === "ban-2"),
          "danh sách mới phải được công bố sau lượt làm mới nền",
        );
        const third = await installed.deps.connect();
        return { firstLoadCount, first: nameIn(first), second: nameIn(second), third: nameIn(third) };
      } finally {
        disposeAll(installed);
        server.stop();
      }
    };
    const ours = await scenario(apply as never, factoryOf(Config));
    expect(ours).toEqual(await scenario(stock.apply, factoryOf(stock.Config)));
    // Lượt ĐẦU chờ nạp ⇒ đúng MỘT request; lượt HAI trả NGAY bằng danh sách cũ (làm mới chạy NỀN).
    expect(ours).toEqual({ firstLoadCount: 1, first: "ban-1", second: "ban-1", third: "ban-2" });
  });

  test("lượt nạp hỏng: GIỮ danh sách tốt cuối cùng, cảnh báo ĐÚNG MỘT lần cho mỗi chuỗi hỏng", async () => {
    const scenario = async (applyFn: (ctx: never, config: never) => void, makeConfig: (value: unknown) => unknown) => {
      const server = startServer((_request, call) =>
        call === 2 ? new Response("boom", { status: 500 }) : listing(entry("deepseek-flash", { name: `ban-${call}` })),
      );
      const installed = install(applyFn, makeConfig(configValue(server.origin, { modelsMaxAgeMs: 0 })), { token: "tok-1" });
      const warn: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => void warn.push(args.map(String).join(" "));
      try {
        const first = await installed.deps.connect();
        await installed.deps.connect();
        await waitFor(() => warn.length >= 1, "cảnh báo lần hỏng ĐẦU phải xuất hiện");
        const keptName = nameIn(installed.deps.options());
        await installed.deps.connect();
        await waitFor(
          () => installed.deps.options().models.some((model) => model.name === "ban-3"),
          "lượt nạp thành công thứ ba phải được công bố",
        );
        return { first: nameIn(first), keptName, third: nameIn(installed.deps.options()), warn: [...warn] };
      } finally {
        console.warn = originalWarn;
        disposeAll(installed);
        server.stop();
      }
    };
    const ours = await scenario(apply as never, factoryOf(Config));
    const theirs = await scenario(stock.apply, factoryOf(stock.Config));
    expect(normalizeUrls(ours.warn)).toEqual(normalizeUrls(theirs.warn));
    expect({ first: ours.first, keptName: ours.keptName, third: ours.third }).toEqual({ first: "ban-1", keptName: "ban-1", third: "ban-3" });
    // Chuỗi hỏng chỉ cảnh báo MỘT lần — dù có HAI lượt nạp hỏng liên tiếp trong kịch bản này.
    expect(ours.warn.length).toBe(1);
    expect(ours.warn[0]).toContain("[llm-deepseek-account]");
    expect(ours.warn[0]).toContain("keeping the previous catalog");
  });

  test("đổi token ⇒ PHẠM VI mới: xoá danh sách cũ, xin lại theo token mới", async () => {
    const scenario = async (applyFn: (ctx: never, config: never) => void, makeConfig: (value: unknown) => unknown) => {
      let token = "tok-1";
      const server = startServer((_request, call) => listing(entry("deepseek-flash", { name: `ban-${call}` })));
      const installed = install(applyFn, makeConfig(configValue(server.origin)), { token: () => token });
      try {
        const first = await installed.deps.connect();
        token = "tok-2";
        const second = await installed.deps.connect();
        return { first: nameIn(first), second: nameIn(second), calls: server.calls() };
      } finally {
        disposeAll(installed);
        server.stop();
      }
    };
    const ours = await scenario(apply as never, factoryOf(Config));
    expect(ours).toEqual(await scenario(stock.apply, factoryOf(stock.Config)));
    expect(ours).toEqual({ first: "ban-1", second: "ban-2", calls: 2 });
  });

  test("dọn (effect disposer): huỷ lượt đang chạy; lượt truy cập sau KHÔNG I/O", async () => {
    const scenario = async (applyFn: (ctx: never, config: never) => void, makeConfig: (value: unknown) => unknown) => {
      const server = startServer(async () => {
        await Bun.sleep(150);
        return listing(entry("deepseek-flash"));
      });
      const installed = install(applyFn, makeConfig(configValue(server.origin, { modelsTimeoutMs: 5_000 })), { token: "tok-1" });
      try {
        const pending = installed.deps.connect();
        await waitFor(() => server.calls() >= 1, "request phải tới server trước khi dọn");
        installed.h.disposers[0]?.();
        const settled = await pending;
        const callsAfterDispose = server.calls();
        const after = await installed.deps.connect();
        return {
          callsAfterDispose,
          settledOffered: settled.catalog.offered.map((model) => model.id),
          afterOffered: after.catalog.offered.map((model) => model.id),
          callsAfterSecondAccess: server.calls(),
          labels: installed.h.effectLabels,
        };
      } finally {
        server.stop();
      }
    };
    const ours = await scenario(apply as never, factoryOf(Config));
    expect(ours).toEqual(await scenario(stock.apply, factoryOf(stock.Config)));
    expect(ours.labels).toEqual(["llm-deepseek-account: model catalog"]);
    expect(ours.callsAfterSecondAccess).toBe(ours.callsAfterDispose);
    expect(ours.afterOffered).toEqual(["deepseek-flash", "deepseek-v4-pro"]);
  });
});

describe("C6 — vật thể cấu hình ĐỘC LẬP giữa các thực thể (kiểm bằng DANH TÍNH)", () => {
  test("hai lần cài ⇒ hai mục provider + settingsPath ĐỘC LẬP; sửa một KHÔNG lan sang cái kia", () => {
    const server = startServer(() => listing(entry("deepseek-flash")));
    try {
      const a = install(apply as never, Config(configValue(server.origin)), { token: "tok-1" });
      const b = install(apply as never, Config(configValue(server.origin)), { token: "tok-1" });
      const entryA = a.h.providers[0] as { settingsPath: unknown[] };
      const entryB = b.h.providers[0] as { settingsPath: unknown[] };
      expect(entryA).not.toBe(entryB);
      expect(entryA.settingsPath).not.toBe(entryB.settingsPath);
      entryA.settingsPath.push("mutated");
      expect(entryB.settingsPath).toEqual([]);
      disposeAll(a, b);
    } finally {
      server.stop();
    }
  });

  test("hai đệm danh sách ⇒ catalog/models/refusals là vật KHÁC nhau; hai lượt options() ⇒ ảnh chụp MỚI", async () => {
    const server = startServer(() => listing(entry("deepseek-flash", { name: "A" })));
    try {
      const a = install(apply as never, Config(configValue(server.origin)), { token: "tok-1" });
      const b = install(apply as never, Config(configValue(server.origin)), { token: "tok-1" });
      const [connA, connB] = [await a.deps.connect(), await b.deps.connect()];
      expect(connA.catalog).not.toBe(connB.catalog);
      expect(connA.models).not.toBe(connB.models);
      expect(connA.catalog.refusals).not.toBe(connB.catalog.refusals);
      expect(connA.catalog.offered).not.toBe(connB.catalog.offered);
      connA.catalog.offered.push({ id: "mutated" });
      expect(connB.catalog.offered.some((model) => model.id === "mutated")).toBe(false);
      // Hai lượt options() trên CÙNG một bản cài: object + mảng MỚI, sửa lượt trước không rò lượt sau.
      const fresh = (deps: Dependencies) => {
        const first = deps.options();
        const second = deps.options();
        first.models[0]!.id = "mutated";
        return { fresh: first !== second, models: first.models !== second.models, leak: second.models[0]!.id !== "mutated" };
      };
      const ours = fresh(a.deps);
      expect(ours).toEqual(fresh(b.deps));
      expect(ours).toEqual({ fresh: true, models: true, leak: true });
      disposeAll(a, b);
    } finally {
      server.stop();
    }
  });
});

describe("metadata + luật gói", () => {
  test("gbh.peers ⊆ peerDependencies (so PHẦN TỬ) và mọi peer có phiên bản thật", () => {
    const manifest = manifestAt("packages/host/llm-deepseek-account/package.json");
    expect(manifest.gbh?.peers).toEqual([
      "@deepseek-ai/cordis", "@deepseek-ai/cosmokit", "@deepseek-ai/dsh-launch-environment", "@deepseek-ai/dsh-llm",
      "@deepseek-ai/dsh-llm-deepseek", "@deepseek-ai/dsh-timeout", "@deepseek-ai/schemastery", "semver",
    ]);
    expect(missingPeers(manifest)).toEqual([]);
    for (const peer of manifest.gbh?.peers ?? []) expect(typeof manifest.peerDependencies?.[peer]).toBe("string");
  });

  test("ĐỐI CHỨNG ÂM (3 dạng): thiếu tên · cùng độ dài nhưng lệch phần tử · bỏ peer khỏi manifest THẬT", () => {
    const missing: PeerManifest = {
      name: "x",
      gbh: { peers: ["@deepseek-ai/dsh-llm", "@deepseek-ai/khong-ton-tai"] },
      peerDependencies: { "@deepseek-ai/dsh-llm": "1" },
    };
    expect(missingPeers(missing)).toEqual(["@deepseek-ai/khong-ton-tai"]);
    // Hai danh sách CÙNG ĐỘ DÀI nhưng lệch phần tử vẫn phải ĐỎ (phép kiểm so số lượng là verdict RỖNG).
    const sameCount: PeerManifest = {
      name: "y",
      gbh: { peers: ["@deepseek-ai/a", "@deepseek-ai/b"] },
      peerDependencies: { "@deepseek-ai/a": "1", "@deepseek-ai/c": "1" },
    };
    expect(missingPeers(sameCount)).toEqual(["@deepseek-ai/b"]);
    const real = manifestAt("packages/host/llm-deepseek-account/package.json");
    const broken: PeerManifest = { ...real, peerDependencies: { ...real.peerDependencies } };
    delete broken.peerDependencies?.semver;
    expect(missingPeers(broken)).toEqual(["semver"]);
    // KHÔNG báo oan: danh sách rỗng, hoặc peerDependencies THỪA phần tử, vẫn đạt.
    expect(missingPeers({ name: "z", gbh: { peers: [] }, peerDependencies: {} })).toEqual([]);
    expect(missingPeers({ name: "w", gbh: { peers: ["a"] }, peerDependencies: { a: "1", b: "1" } })).toEqual([]);
  });

  // `gbh.row` do LEAD khai NGOÀI phiên viết gói (mtime 10:52 ngày 18/10/2026) — ca canh HAI CHIỀU:
  // VẮNG là trạng thái an toàn; CÓ thì phải đúng hình dạng row trần của bản gốc (không config/inject).
  test("TEST CANH HAI CHIỀU: gbh.row vắng = an toàn; có thì đúng id + tests, CẤM moduleIds/aliases/config", () => {
    const declared = manifestAt("packages/host/llm-deepseek-account/package.json").gbh?.row as
      | { id?: string; tests?: string[]; moduleIds?: unknown; aliases?: unknown; config?: unknown; inject?: unknown }
      | undefined;
    if (declared === undefined) return;
    expect(declared.id).toBe("llm-deepseek-account");
    expect(declared.tests).toEqual(["tests/host/llm-deepseek-account.test.ts"]);
    expect(declared.moduleIds).toBeUndefined();
    expect(declared.aliases).toBeUndefined();
    expect(declared.config).toBeUndefined();
    if (declared.inject !== undefined) expect(declared.inject).toEqual(["llm"]);
    const testFile = declared.tests?.[0] ?? "";
    expect(readFileSync(new URL("../../" + testFile, import.meta.url), "utf8").length).toBeGreaterThan(1_000);
  });

  test("luật 000e: locale/en.json + locale/zh.json CHÉP BYTE-FOR-BYTE từ bản gốc", () => {
    for (const file of ["en.json", "zh.json"]) {
      const ours = new URL("../../packages/host/llm-deepseek-account/locale/" + file, import.meta.url);
      const theirs = new URL("locale/" + file, STOCK_DIR);
      expect(sha256(ours)).toBe(sha256(theirs));
      expect(readFileSync(ours, "utf8")).toBe(readFileSync(theirs, "utf8"));
    }
  });

  test("một thể hiện kernel duy nhất: artefact KHÔNG bundle dsh-llm mà dùng CHUNG lớp LlmError của kernel", () => {
    // 01/11/2026: ca CŨ so danh tính trên ĐƯỜNG DẪN CÀI ĐẶT (packages/…/node_modules/@deepseek-ai/dsh-llm) —
    // layout do `bun install` sở hữu nên đỏ dù khai báo đúng. Đo lại trên ARTEFACT: (a) KHÔNG nhúng bản sao
    // lớp lỗi kernel, (b) lỗi nó ném ra LÀ instance của lớp kernel (qua symlink kernel của harness).
    const text = readFileSync(artifactFile, "utf8");
    expect(text).not.toMatch(/class (LlmError|HarnessError) /u);
    let failure: unknown;
    try {
      parseModelListing({});
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(kernel.LlmError);
  });
});
