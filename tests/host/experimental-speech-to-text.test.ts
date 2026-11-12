/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B (14 ca: 13 hành vi + metadata row) cho @galaxy-blackhole/gbh-experimental-speech-to-text: chờ src/ + build.ts ổn định (2 lần đo cách 300ms), build ba entry vào mkdtemp, symlink node_modules về apps/host, rồi chạy CẢ bản ta lẫn bundle gốc @deepseek-ai/dsh-experimental-speech-to-text trên Context cordis THẬT + seam giả settings — so sâu export · String(Config) · lỗi · service · mount/dispose · register · snapshot · follow · resolve · prepare/cancel · transcribe · configure · wave; KHÔNG mạng, KHÔNG audio/model thật.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const REPO = join(import.meta.dir, "..", "..");
const PKG = join(REPO, "packages", "host", "experimental-speech-to-text");
const BUILD = join(PKG, "build.ts");
const SRC = join(PKG, "src");
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
const STOCK_DIR = join(APP_MODULES, "@deepseek-ai", "dsh-experimental-speech-to-text");
const STOCK_INDEX = join(STOCK_DIR, "lib", "index.js");
const STOCK_TYPES = join(STOCK_DIR, "lib", "types", "types.js");
const STOCK_WAVE = join(STOCK_DIR, "lib", "types", "wave.js");
const CORDIS = join(APP_MODULES, "@deepseek-ai", "cordis", "lib", "index.js");
const COSMOKIT = join(APP_MODULES, "@deepseek-ai", "cosmokit", "lib", "index.js");
const OUT = mkdtempSync(join(tmpdir(), "gbh-experimental-speech-to-text-"));
const WAIT_MS = 300_000;
const TEST_TIMEOUT = 30_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface Volatile<T> { get(): T }
interface ConfigLike { readonly defaultProvider: Volatile<string>; readonly language: Volatile<string> }
interface ConfigSchema { (input?: unknown): ConfigLike; toString(): string }
interface Info {
  readonly id: string;
  readonly name: string;
  readonly location: "host-local" | "cloud";
  readonly languages: readonly string[];
  readonly setupEstimate?: Readonly<Record<string, number>>;
  readonly downloadSources?: readonly string[];
}
interface Transcript { readonly text: string; readonly audioSeconds: number; readonly inferenceSeconds: number }
interface SpeechInput { readonly audio: Uint8Array; readonly language: string }
interface Preparation {
  snapshot(): Record<string, unknown>;
  subscribe(listener: () => void): () => void;
  prepare(options?: Record<string, unknown>): void;
  cancel(): Promise<void>;
}
interface Provider {
  readonly info: Info;
  readonly preparation?: Preparation;
  transcribe(input: SpeechInput, signal: AbortSignal): Promise<Transcript>;
}
interface Spec { readonly provider: Provider; readonly audio: Uint8Array; readonly language: string }
interface Snapshot {
  readonly providers: readonly (Info & { readonly preparation: unknown })[];
  readonly selection: { readonly providerId: string; readonly language: string };
}
interface Service {
  readonly name: string;
  register(provider: Provider): () => Promise<void>;
  listProviders(): readonly Info[];
  follow(caller: AbortSignal): AsyncIterable<Snapshot>;
  snapshot(): Snapshot;
  configure(patch: { readonly providerId?: string; readonly language?: string }): Promise<void>;
  prepare(id: string, options?: { readonly downloadSource?: string }): void;
  cancelPreparation(id: string): Promise<void>;
  resolve(request: { readonly audio: Uint8Array; readonly providerId?: string; readonly language?: string }): Spec;
  transcribe(spec: Spec, signal: AbortSignal): Promise<Transcript>;
}
interface SpeechCtor {
  new (ctx: Cordis, config: ConfigLike): Service;
  readonly Config: ConfigSchema;
  readonly name: string;
}
interface SpeechModule { readonly default: SpeechCtor }
interface Fiber {
  await(): Promise<void>;
  dispose(): Promise<void>;
  readonly state: number;
  getEffects(): readonly { readonly label: string }[];
}
interface Cordis {
  readonly fiber: { entry?: { options: { id?: string } }; dispose(): Promise<void> };
  provide(name: string, value: unknown): unknown;
  get(name: string): unknown;
  on(event: string, listener: () => void): unknown;
  emit(event: string, ...args: unknown[]): void;
  plugin(plugin: unknown, config?: unknown): Fiber;
  speechToText?: Service;
}
type ContextCtor = new () => Cordis;
interface BuiltEntries { readonly index: string; readonly types: string; readonly wave: string }
interface BuildModule { buildPackage(outDir?: string): Promise<BuiltEntries> }
interface VolatileModule {
  createVolatile<T>(value: T): Volatile<T>;
  updateVolatile<T>(target: Volatile<T>, source: Volatile<T>): void;
}
interface Side { readonly label: "ours" | "stock"; readonly module: SpeechModule }
interface ErrorShape { readonly name: string; readonly message: string; readonly code?: string; readonly cause?: unknown }
type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ErrorShape };
interface SettingsCall { readonly id: string; readonly patch: unknown }
interface BootOptions {
  readonly raw?: Record<string, unknown>;
  readonly settings?: boolean;
  readonly entryId?: string | null;
  readonly settingsFailure?: Error;
}
interface Rig { readonly ctx: Cordis; readonly service: Service; readonly config: ConfigLike; readonly updates: SettingsCall[] }
interface ProviderCalls {
  readonly transcribe: { readonly audio: readonly number[]; readonly language: string; readonly aborted: boolean }[];
  readonly prepare: (Record<string, unknown> | undefined)[];
  subscribe: number;
  unsubscribe: number;
  cancel: number;
}
interface FakeProvider { readonly provider: Provider; readonly calls: ProviderCalls }
interface FakeProviderOptions {
  readonly id?: string;
  readonly name?: string;
  readonly location?: "host-local" | "cloud";
  readonly languages?: readonly string[];
  readonly setupEstimate?: Readonly<Record<string, number>>;
  readonly downloadSources?: readonly string[];
  readonly preparation?: { readonly state?: Record<string, unknown> };
  readonly transcribe?: (input: SpeechInput, signal: AbortSignal) => Promise<Transcript>;
}

let oursModule!: SpeechModule;
let stockModule!: SpeechModule;
let oursTypes!: Record<string, unknown>;
let stockTypes!: Record<string, unknown>;
let oursWave!: { validateWave(audio: Uint8Array, maxDurationSeconds: number): number };
let stockWave!: { validateWave(audio: Uint8Array, maxDurationSeconds: number): number };
let ContextCtor!: ContextCtor;
let setVolatile!: <T>(target: Volatile<T>, value: T) => void;
let oursIndexPath = "";

/** Liệt kê tệp dưới một thư mục (bỏ node_modules); trả đường dẫn tuyệt đối. */
function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

/** Dấu vết "size:mtime" của một tệp, "-1" khi chưa có. */
function fileStamp(path: string): string {
  try {
    const info = statSync(path);
    return String(info.size) + ":" + String(Math.floor(info.mtimeMs));
  } catch {
    return "-1";
  }
}

/** Chữ ký build.ts + mọi tệp src/; "-1" khi thiếu build.ts hoặc src rỗng. */
function sourceSignature(): string {
  if (!existsSync(BUILD)) return "-1";
  const sources = walkFiles(SRC);
  if (sources.length === 0) return "-1";
  return [BUILD, ...sources]
    .sort()
    .map((path) => path.slice(PKG.length + 1) + "=" + fileStamp(path))
    .join("|");
}

/** Chờ hai lần đo cách 300ms cho cùng chữ ký; ném khi quá deadline. */
async function waitForSources(deadline: number): Promise<void> {
  let previous = sourceSignature();
  while (Date.now() < deadline) {
    await sleep(300);
    const next = sourceSignature();
    if (next !== "-1" && next === previous) return;
    previous = next;
  }
  throw new Error("nguồn " + PKG + " không ổn định sau " + String(WAIT_MS) + "ms (" + sourceSignature() + ")");
}

/** Tìm artifact theo tên trong cây build (≤3 tầng, bỏ node_modules); ném khi không thấy. */
function findArtifact(root: string, name: string): string {
  const queue: { readonly dir: string; readonly depth: number }[] = [{ dir: root, depth: 0 }];
  while (queue.length > 0) {
    const next = queue.shift()!;
    const candidate = join(next.dir, name);
    if (existsSync(candidate)) return candidate;
    if (next.depth >= 3) continue;
    for (const entry of readdirSync(next.dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== "node_modules") {
        queue.push({ dir: join(next.dir, entry.name), depth: next.depth + 1 });
      }
    }
  }
  throw new Error("không thấy " + name + " trong " + root);
}

/** Tên export runtime của một file ESM (export block + khai báo trực tiếp + default). */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
      if (name !== undefined && name !== "") names.add(name);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/** Tên method trên toàn chuỗi prototype (bỏ constructor), đã sắp xếp. */
function methodsOf(value: object): string[] {
  const names = new Set<string>();
  let proto = Object.getPrototypeOf(value) as object | null;
  while (proto !== null && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, name);
      if (name !== "constructor" && typeof descriptor?.value === "function") names.add(name);
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return [...names].sort();
}

/** Chuẩn hoá lỗi thành name + message + code + cause (cause lồng một mức). */
function errorShape(error: unknown): ErrorShape {
  if (!(error instanceof Error)) return { name: "NonError", message: String(error) };
  const code = (error as Error & { code?: unknown }).code;
  const cause = (error as Error & { cause?: unknown }).cause;
  const shape: { name: string; message: string; code?: string; cause?: unknown } = { name: error.name, message: error.message };
  if (typeof code === "string") shape.code = code;
  if (cause !== undefined) {
    shape.cause =
      cause instanceof Error
        ? { name: cause.name, message: cause.message, code: (cause as Error & { code?: unknown }).code }
        : cause;
  }
  return shape;
}

/** Chạy một phép (đồng bộ/bất đồng bộ) và bắt lỗi thành Outcome. */
async function attempt<T>(work: () => T | Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    return { ok: false, error: errorShape(error) };
  }
}

/** Chạy một phép đồng bộ và bắt lỗi thành Outcome. */
function attemptSync<T>(work: () => T): Outcome<T> {
  try {
    return { ok: true, value: work() };
  } catch (error) {
    return { ok: false, error: errorShape(error) };
  }
}

/** Hai bên theo thứ tự ours rồi stock. */
function sides(): readonly Side[] {
  return [
    { label: "ours", module: oursModule },
    { label: "stock", module: stockModule },
  ];
}

/** Chạy CÙNG một kịch bản trên cả hai bên với cùng fixture; trả { ours, theirs }. */
async function both<T>(run: (side: Side) => Promise<T> | T): Promise<{ readonly ours: T; readonly theirs: T }> {
  const results: T[] = [];
  for (const side of sides()) results.push(await run(side));
  return { ours: results[0] as T, theirs: results[1] as T };
}

/** Dựng Context THẬT + seam settings giả + entry giả của Loader cho MỘT bên. */
function boot(side: Side, options: BootOptions = {}): Rig {
  const ctx = new ContextCtor();
  if (options.entryId !== null) ctx.fiber.entry = { options: { id: options.entryId ?? "speech-profile" } };
  const updates: SettingsCall[] = [];
  if (options.settings !== false) {
    ctx.provide("settings", {
      update: async (id: string, patch: unknown): Promise<void> => {
        updates.push({ id, patch });
        if (options.settingsFailure !== undefined) throw options.settingsFailure;
      },
    });
  }
  const config = side.module.default.Config(options.raw ?? { defaultProvider: "fake", language: "auto" });
  const service = new side.module.default(ctx, config);
  return { ctx, service, config, updates };
}

/** Dựng giàn rồi luôn dọn (kể cả khi ca ném); trả kết quả work. */
async function withRig<T>(side: Side, options: BootOptions, work: (rig: Rig) => Promise<T> | T): Promise<T> {
  const rig = boot(side, options);
  try {
    return await work(rig);
  } finally {
    try {
      await rig.ctx.fiber.dispose();
    } catch {
      // Fiber đã bị ca tự dọn — không sao.
    }
  }
}

/** Dựng provider giả ghi mọi lượt gọi, kèm preparation tuỳ chọn. */
function fakeProvider(options: FakeProviderOptions = {}): FakeProvider {
  const info: Info = {
    id: options.id ?? "fake",
    name: options.name ?? "Fake recognizer",
    location: options.location ?? "host-local",
    languages: options.languages ?? ["auto", "en"],
    ...(options.setupEstimate === undefined ? {} : { setupEstimate: options.setupEstimate }),
    ...(options.downloadSources === undefined ? {} : { downloadSources: options.downloadSources }),
  };
  const calls: ProviderCalls = { transcribe: [], prepare: [], subscribe: 0, unsubscribe: 0, cancel: 0 };
  const listeners = new Set<() => void>();
  let state: Record<string, unknown> = options.preparation?.state ?? { phase: "ready" };
  const provider: Provider = {
    info,
    ...(options.preparation === undefined
      ? {}
      : {
          preparation: {
            snapshot: (): Record<string, unknown> => state,
            subscribe: (listener: () => void): (() => void) => {
              calls.subscribe += 1;
              listeners.add(listener);
              return (): void => {
                calls.unsubscribe += 1;
                listeners.delete(listener);
              };
            },
            prepare: (preparationOptions?: Record<string, unknown>): void => {
              calls.prepare.push(preparationOptions);
            },
            cancel: async (): Promise<void> => {
              calls.cancel += 1;
            },
          },
        }),
    transcribe: async (input, signal) => {
      calls.transcribe.push({ audio: [...input.audio], language: input.language, aborted: signal.aborted });
      if (options.transcribe !== undefined) return options.transcribe(input, signal);
      return { text: "recognized", audioSeconds: 1.5, inferenceSeconds: 0.25 };
    },
  };
  return { provider, calls };
}

/** Hình dạng cấu hình đã chuẩn hoá để so A/B. */
function configShape(side: Side, raw: unknown): Record<string, unknown> {
  const config = side.module.default.Config(raw);
  return {
    defaultProvider: config.defaultProvider.get(),
    language: config.language.get(),
    keys: Object.keys(config).sort(),
    api: { defaultProvider: typeof config.defaultProvider.get, language: typeof config.language.get },
  };
}

/** Chuẩn hoá spec đã ghim (provider là object sống, chỉ so id). */
function normalizeSpec(spec: Spec): Record<string, unknown> {
  return { providerId: spec.provider.info.id, language: spec.language, audio: [...spec.audio], audioBytes: spec.audio.byteLength };
}

/** Dựng WAV 16 kHz mono PCM16 chuẩn tắc (có thể cố ý lẻ byte). */
function canonicalWave(samples: number, extraBytes = 0): Uint8Array {
  const size = 44 + samples * 2 + extraBytes;
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string): void => {
    for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index);
  };
  ascii(0, "RIFF");
  view.setUint32(4, size - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true);
  view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, size - 44, true);
  return bytes;
}

beforeAll(async () => {
  await waitForSources(Date.now() + WAIT_MS);
  const build = (await import(pathToFileURL(BUILD).href)) as unknown as BuildModule;
  if (typeof build.buildPackage !== "function") throw new Error("build.ts không export buildPackage");
  const built = await build.buildPackage(OUT);
  const index = existsSync(built.index) ? built.index : findArtifact(OUT, "index.js");
  const types = existsSync(built.types) ? built.types : findArtifact(OUT, "types.js");
  const wave = existsSync(built.wave) ? built.wave : findArtifact(OUT, "wave.js");
  oursIndexPath = index;
  if (!existsSync(join(OUT, "node_modules"))) symlinkSync(APP_MODULES, join(OUT, "node_modules"), "dir");
  oursModule = (await import(pathToFileURL(index).href)) as unknown as SpeechModule;
  oursTypes = (await import(pathToFileURL(types).href)) as Record<string, unknown>;
  oursWave = (await import(pathToFileURL(wave).href)) as { validateWave(audio: Uint8Array, maxDurationSeconds: number): number };
  stockModule = (await import(pathToFileURL(STOCK_INDEX).href)) as unknown as SpeechModule;
  stockTypes = (await import(pathToFileURL(STOCK_TYPES).href)) as Record<string, unknown>;
  stockWave = (await import(pathToFileURL(STOCK_WAVE).href)) as { validateWave(audio: Uint8Array, maxDurationSeconds: number): number };
  const cordis = (await import(pathToFileURL(CORDIS).href)) as unknown as { Context: ContextCtor };
  ContextCtor = cordis.Context;
  const cosmokit = (await import(pathToFileURL(COSMOKIT).href)) as unknown as VolatileModule;
  setVolatile = <T>(target: Volatile<T>, value: T): void => {
    cosmokit.updateVolatile(target, cosmokit.createVolatile(value));
  };
}, WAIT_MS + 60_000);

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

describe("metadata row speech-to-text", () => {
  // 19/10/2026 — reviewer: row speech-to-text ĐÃ MOUNT (Lead flip) ⇒ canh gbh.row, không còn park.
  test("C0 row MOUNT theo dump-now2: id · aliases · config · moduleIds · tests", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      gbh?: {
        row?: { id?: string; config?: Record<string, unknown>; moduleIds?: string[]; aliases?: string[]; tests?: string[] };
        row_unmounted_ly_do?: {
          ly_do?: string;
          row?: { id?: string; config?: Record<string, unknown>; moduleIds?: string[]; aliases?: string[]; tests?: string[] };
        };
      };
    };
    const mounted = manifest.gbh?.row;
    expect(manifest.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect(mounted?.id).toBe("speech-to-text");
    expect(mounted?.config).toEqual({ defaultProvider: "sensevoice-local" });
    expect(mounted?.moduleIds).toEqual(["@galaxy-blackhole/gbh-experimental-speech-to-text"]);
    expect(mounted?.aliases).toEqual(["@deepseek-ai/dsh-experimental-speech-to-text"]);
    expect(mounted?.tests).toEqual(["tests/host/experimental-speech-to-text.test.ts"]);
  });
});

describe("bề mặt gói experimental-speech-to-text", () => {
  test(
    "C1 export · tên lớp · String(Config) · types/wave — B ≡ A",
    () => {
      expect(Object.keys(oursModule).sort()).toEqual(Object.keys(stockModule).sort());
      expect(Object.keys(oursModule).sort()).toEqual(["default"]);
      expect(oursModule.default.name).toBe(stockModule.default.name);
      expect(String(oursModule.default.Config)).toBe(String(stockModule.default.Config));
      const mineIndex = exportNames(readFileSync(oursIndexPath, "utf8"));
      const stockIndex = exportNames(readFileSync(STOCK_INDEX, "utf8"));
      expect(mineIndex).toEqual(stockIndex);
      expect(mineIndex).toEqual(["default"]);
      expect(Object.keys(oursTypes).sort()).toEqual(Object.keys(stockTypes).sort());
      expect(Object.keys(oursTypes)).toEqual([]);
      expect(Object.keys(oursWave).sort()).toEqual(Object.keys(stockWave).sort());
      expect(Object.keys(oursWave).sort()).toEqual(["validateWave"]);
      expect(typeof oursWave.validateWave).toBe("function");
    },
    TEST_TIMEOUT,
  );

  test(
    "C2 Config: defaultProvider bắt buộc · language mặc định auto · hai tham chiếu sống — B ≡ A",
    async () => {
      const raws: unknown[] = [
        { defaultProvider: "fake" },
        { defaultProvider: "cloud", language: "en" },
        { defaultProvider: "x", language: undefined },
        { defaultProvider: "p", language: null },
        { defaultProvider: "p", extra: true },
      ];
      for (const raw of raws) {
        const result = await both((side) => configShape(side, raw));
        expect(result.ours).toEqual(result.theirs);
      }
      const live = await both((side) => {
        const config = side.module.default.Config({ defaultProvider: "fake" });
        const before = { defaultProvider: config.defaultProvider.get(), language: config.language.get() };
        setVolatile(config.defaultProvider, "cloud");
        setVolatile(config.language, "en");
        const after = { defaultProvider: config.defaultProvider.get(), language: config.language.get() };
        return { before, after, keys: Object.keys(config).sort(), api: configShape(side, { defaultProvider: "fake" })["api"] };
      });
      expect(live.ours).toEqual(live.theirs);
      expect(live.ours.before).toEqual({ defaultProvider: "fake", language: "auto" });
      expect(live.ours.after).toEqual({ defaultProvider: "cloud", language: "en" });
      expect(live.ours.keys).toEqual(["defaultProvider", "language"]);
      expect(live.ours.api).toEqual({ defaultProvider: "function", language: "function" });
    },
    TEST_TIMEOUT,
  );

  test(
    "C3 Config sai kiểu/thiếu/rỗng: name · message · code · cause — B ≡ A",
    async () => {
      const raws: unknown[] = [
        {},
        { defaultProvider: "" },
        { defaultProvider: 42 },
        { defaultProvider: null },
        { defaultProvider: "p", language: "" },
        { defaultProvider: "p", language: 3 },
      ];
      for (const raw of raws) {
        const result = await both((side) => attemptSync(() => configShape(side, raw)));
        expect(result.ours).toEqual(result.theirs);
      }
      const missing = attemptSync(() => configShape(sides()[0]!, {}));
      expect(missing.ok).toBe(false);
      if (!missing.ok) {
        expect(missing.error).toEqual({ name: "ValidationError", message: "$.defaultProvider missing required value" });
        expect(missing.error.code).toBeUndefined();
        expect(missing.error.cause).toBeUndefined();
      }
      const badLanguage = attemptSync(() => configShape(sides()[0]!, { defaultProvider: "p", language: 3 }));
      expect(badLanguage.ok).toBe(false);
      if (!badLanguage.ok) {
        expect(badLanguage.error).toEqual({ name: "ValidationError", message: "$.language expected string but got 3" });
      }
    },
    TEST_TIMEOUT,
  );

  test(
    "C4 service ctx.speechToText trên Context THẬT: tên + method — B ≡ A",
    async () => {
      const result = await both(async (side) => {
        const probe = new ContextCtor();
        const before = probe.speechToText;
        await probe.fiber.dispose();
        return withRig(side, {}, (rig) => ({
          before,
          registered: rig.ctx.speechToText !== undefined,
          viaGet: rig.ctx.get("speechToText") !== undefined,
          name: rig.service.name,
          methods: methodsOf(rig.service),
          defaults: { defaultProvider: rig.config.defaultProvider.get(), language: rig.config.language.get() },
        }));
      });
      expect(result.ours).toEqual(result.theirs);
      expect(result.ours.before).toBeUndefined();
      expect(result.ours.registered).toBe(true);
      expect(result.ours.viaGet).toBe(true);
      expect(result.ours.name).toBe("speechToText");
      expect(result.ours.methods.join(",")).toBe("cancelPreparation,changed,configure,follow,listProviders,prepare,register,remove,resolve,selectedProvider,snapshot,transcribe");
      expect(result.ours.defaults).toEqual({ defaultProvider: "fake", language: "auto" });
    },
    TEST_TIMEOUT,
  );

  test(
    "C5 mount ctx.plugin + dispose: đăng ký/huỷ như stock — B ≡ A",
    async () => {
      const result = await both(async (side) => {
        const ctx = new ContextCtor();
        const fiber = ctx.plugin(side.module.default, { defaultProvider: "fake", language: "auto" });
        await fiber.await();
        const service = ctx.speechToText;
        if (service === undefined) throw new Error("ctx.speechToText không được cấp sau khi mount");
        const effects = fiber.getEffects().map((effect) => effect.label).sort();
        const provider = fakeProvider({ id: "mounted", preparation: { state: { phase: "unprepared" } } });
        service.register(provider.provider);
        const during = { effects, registered: ctx.speechToText !== undefined, methods: methodsOf(service) };
        await fiber.dispose();
        const late = await attempt(() => Promise.resolve(service.register(fakeProvider({ id: "late" }).provider)));
        return {
          during,
          state: fiber.state,
          after: ctx.speechToText === undefined,
          unsubscribed: provider.calls.unsubscribe,
          late,
        };
      });
      expect(result.ours).toEqual(result.theirs);
      expect(result.ours.during.effects).toEqual(["anonymous", 'ctx.on("loader/volatile-update")', 'ctx.provide("speechToText")']);
      expect(result.ours.during.registered).toBe(true);
      expect(result.ours.state).toBe(4);
      expect(result.ours.after).toBe(true);
      expect(result.ours.unsubscribed).toBe(1);
      expect(result.ours.late.ok).toBe(false);
      if (!result.ours.late.ok) {
        expect(result.ours.late.error).toEqual({ name: "Error", message: "Speech service disposed" });
      }
    },
    TEST_TIMEOUT,
  );

  test(
    "C6 register · listProviders · id trùng · disposer idempotent — B ≡ A",
    async () => {
      const result = await both((side) =>
        withRig(side, {}, async ({ service }) => {
          const local = fakeProvider({ id: "local", preparation: { state: { phase: "ready" } } });
          const cloud = fakeProvider({
            id: "cloud",
            location: "cloud",
            languages: ["en"],
            downloadSources: ["https://mirror.test/model"],
          });
          const disposeLocal = service.register(local.provider);
          const disposeCloud = service.register(cloud.provider);
          const registered = service.listProviders();
          const duplicate = await attempt(() => service.register(fakeProvider({ id: "local" }).provider));
          await disposeLocal();
          await disposeLocal();
          const afterLocal = service.listProviders();
          await disposeCloud();
          const afterCloud = service.listProviders();
          return {
            registered,
            disposer: typeof disposeLocal,
            duplicate,
            afterLocal,
            afterCloud,
            subscribe: local.calls.subscribe,
            unsubscribe: local.calls.unsubscribe,
          };
        }),
      );
      expect(result.ours).toEqual(result.theirs);
      expect(result.ours.registered.map((info) => info.id)).toEqual(["local", "cloud"]);
      expect(result.ours.registered[1]?.downloadSources).toEqual(["https://mirror.test/model"]);
      expect(result.ours.disposer).toBe("function");
      expect(result.ours.duplicate.ok).toBe(false);
      if (!result.ours.duplicate.ok) {
        expect(result.ours.duplicate.error).toEqual({ name: "Error", message: "Speech provider already registered: local" });
      }
      expect(result.ours.afterLocal.map((info) => info.id)).toEqual(["cloud"]);
      expect(result.ours.afterCloud).toEqual([]);
      expect(result.ours.subscribe).toBe(1);
      expect(result.ours.unsubscribe).toBe(1);
    },
    TEST_TIMEOUT,
  );

  test(
    "C7 snapshot: 3 nhánh preparation (không có/downloading/failed) + selection sống — B ≡ A",
    async () => {
      const result = await both((side) =>
        withRig(side, { raw: { defaultProvider: "local", language: "auto" } }, ({ service, config }) => {
          const local = fakeProvider({ id: "local" });
          const cloud = fakeProvider({
            id: "cloud",
            location: "cloud",
            languages: ["auto", "en"],
            downloadSources: ["https://mirror.test/model"],
            setupEstimate: { recommendedDiskBytes: 1_000, expectedMemoryBytes: 2_000, minimumMinutes: 1, maximumMinutes: 5 },
            preparation: {
              state: {
                phase: "downloading",
                resource: "model",
                completedBytes: 512,
                totalBytes: 2_048,
                step: "model",
                steps: [{ kind: "model", status: "running", startedAt: 42 }],
              },
            },
          });
          const broken = fakeProvider({
            id: "broken",
            languages: ["auto"],
            preparation: {
              state: {
                phase: "failed",
                message: "tải hỏng",
                download: { resource: "model", source: "https://mirror.test/model", reason: "timeout", code: "ETIMEDOUT", status: 504 },
              },
            },
          });
          service.register(local.provider);
          service.register(cloud.provider);
          service.register(broken.provider);
          const before = service.snapshot();
          setVolatile(config.defaultProvider, "cloud");
          setVolatile(config.language, "en");
          const after = service.snapshot();
          return { before, after };
        }),
      );
      expect(result.ours).toEqual(result.theirs);
      expect(result.ours.before.providers.map((provider) => (provider.preparation as { phase: string }).phase)).toEqual(["ready", "downloading", "failed"]);
      expect(result.ours.before.providers[1]?.preparation).toEqual({ phase: "downloading", resource: "model", completedBytes: 512, totalBytes: 2_048, step: "model", steps: [{ kind: "model", status: "running", startedAt: 42 }] });
      expect(result.ours.before.selection).toEqual({ providerId: "local", language: "auto" });
      expect(result.ours.after.selection).toEqual({ providerId: "cloud", language: "en" });
    },
    TEST_TIMEOUT,
  );

  test(
    "C8 follow: ảnh chụp đầu · đăng ký · loader/volatile-update · huỷ người đọc · signal đã huỷ — B ≡ A",
    async () => {
      const result = await both((side) =>
        withRig(side, {}, async ({ ctx, service }) => {
          const caller = new AbortController();
          const iterator = service.follow(caller.signal)[Symbol.asyncIterator]();
          const first = await iterator.next();
          const waiting = iterator.next();
          const added = fakeProvider({ id: "added", languages: ["auto"] });
          const dispose = service.register(added.provider);
          const second = await waiting;
          const waitingEvent = iterator.next();
          ctx.emit("loader/volatile-update");
          const third = await waitingEvent;
          caller.abort(new DOMException("stop", "AbortError"));
          const end = await iterator.next();
          await dispose();
          const pre = new AbortController();
          pre.abort(new DOMException("pre-aborted", "AbortError"));
          const preOutcome = await attempt(() => service.follow(pre.signal)[Symbol.asyncIterator]().next());
          return {
            first: first.value!,
            second: second.value!,
            third: third.value!,
            end: { done: end.done, value: end.value },
            preOutcome,
          };
        }),
      );
      expect(result.ours).toEqual(result.theirs);
      expect(result.ours.first.providers).toEqual([]);
      expect(result.ours.first.selection).toEqual({ providerId: "fake", language: "auto" });
      expect(result.ours.second.providers.map((provider: Info) => provider.id)).toEqual(["added"]);
      expect(result.ours.third).toEqual(result.ours.second);
      expect(result.ours.end.done).toBe(true);
      expect(result.ours.end.value).toBeUndefined();
      expect(result.ours.preOutcome.ok).toBe(false);
      if (!result.ours.preOutcome.ok) {
        expect(result.ours.preOutcome.error).toEqual({ name: "AbortError", message: "pre-aborted" });
      }
    },
    TEST_TIMEOUT,
  );

  test(
    "C9 resolve: mặc định · provider tường minh · ngôn ngữ · thiếu provider · ngôn ngữ lạ — B ≡ A",
    async () => {
      const audio = new Uint8Array([82, 73, 70, 70, 0, 1, 2, 3]);
      const expectedSpec = (providerId: string, language: string): Record<string, unknown> => ({
        providerId,
        language,
        audio: [82, 73, 70, 70, 0, 1, 2, 3],
        audioBytes: 8,
      });
      const result = await both((side) =>
        withRig(side, { raw: { defaultProvider: "local", language: "auto" } }, ({ service, config }) => {
          const local = fakeProvider({ id: "local", languages: ["auto", "en"] });
          const bare = fakeProvider({ id: "bare", location: "cloud", languages: ["auto"] });
          service.register(local.provider);
          service.register(bare.provider);
          const byDefault = service.resolve({ audio });
          const byId = service.resolve({ audio, providerId: "bare" });
          const byLanguage = service.resolve({ audio, language: "en" });
          setVolatile(config.defaultProvider, "bare");
          setVolatile(config.language, "en");
          const unsupportedDefault = attemptSync(() => service.resolve({ audio }));
          setVolatile(config.defaultProvider, "local");
          const missing = attemptSync(() => service.resolve({ audio, providerId: "missing" }));
          const unsupported = attemptSync(() => service.resolve({ audio, language: "fr" }));
          return {
            default: { spec: normalizeSpec(byDefault), identity: byDefault.provider === local.provider },
            byId: { spec: normalizeSpec(byId), identity: byId.provider === bare.provider },
            byLanguage: normalizeSpec(byLanguage),
            unsupportedDefault,
            missing,
            unsupported,
          };
        }),
      );
      expect(result.ours).toEqual(result.theirs);
      expect(result.ours.default).toEqual({ spec: expectedSpec("local", "auto"), identity: true });
      expect(result.ours.byId).toEqual({ spec: expectedSpec("bare", "auto"), identity: true });
      expect(result.ours.byLanguage).toEqual(expectedSpec("local", "en"));
      expect(result.ours.unsupportedDefault).toEqual({ ok: false, error: { name: "Error", message: "Speech provider bare does not support language: en" } });
      expect(result.ours.missing).toEqual({ ok: false, error: { name: "Error", message: "Speech provider is unavailable: missing" } });
      expect(result.ours.unsupported).toEqual({ ok: false, error: { name: "Error", message: "Speech provider local does not support language: fr" } });
    },
    TEST_TIMEOUT,
  );

  test(
    "C10 prepare · cancelPreparation: không preparation · có preparation · thiếu id — B ≡ A",
    async () => {
      const result = await both((side) =>
        withRig(side, {}, async ({ service }) => {
          const plain = fakeProvider({ id: "plain" });
          const cloud = fakeProvider({ id: "cloud", preparation: { state: { phase: "unprepared" } } });
          service.register(plain.provider);
          service.register(cloud.provider);
          service.prepare("plain");
          service.prepare("cloud", { downloadSource: "https://mirror.test/model" });
          service.prepare("cloud");
          await service.cancelPreparation("cloud");
          const missingPrepare = attemptSync(() => service.prepare("missing"));
          const missingCancel = await attempt(() => service.cancelPreparation("missing"));
          return {
            plainCalls: plain.calls.prepare,
            cloudCalls: cloud.calls.prepare,
            cancels: cloud.calls.cancel,
            missingPrepare,
            missingCancel,
          };
        }),
      );
      expect(result.ours).toEqual(result.theirs);
      expect(result.ours.plainCalls).toEqual([]);
      expect(result.ours.cloudCalls).toEqual([{ downloadSource: "https://mirror.test/model" }, undefined]);
      expect(result.ours.cancels).toBe(1);
      expect(result.ours.missingPrepare).toEqual({ ok: false, error: { name: "Error", message: "Speech provider is unavailable: missing" } });
      expect(result.ours.missingCancel).toEqual({ ok: false, error: { name: "Error", message: "Speech provider is unavailable: missing" } });
    },
    TEST_TIMEOUT,
  );

  test(
    "C11 transcribe: thành công · provider ném (code+cause) · caller huỷ · rút/thay đăng ký · huỷ khi đang chạy — B ≡ A",
    async () => {
      const audio = new Uint8Array([1, 2, 3, 4]);
      const result = await both((side) =>
        withRig(side, { raw: { defaultProvider: "fast", language: "auto" } }, async ({ service }) => {
          const fast = fakeProvider({ id: "fast" });
          const disposeFast = service.register(fast.provider);
          const spec = service.resolve({ audio });
          const success = await service.transcribe(spec, new AbortController().signal);
          const successInput = fast.calls.transcribe;

          const boom = new Error("provider exploded", { cause: new Error("root cause") });
          boom.name = "ProviderFailure";
          (boom as Error & { code?: string }).code = "E_PROVIDER";
          const failing = fakeProvider({
            id: "failing",
            transcribe: async () => {
              throw boom;
            },
          });
          service.register(failing.provider);
          const failSpec = service.resolve({ audio, providerId: "failing" });
          const failure = await attempt(() => service.transcribe(failSpec, new AbortController().signal));

          const pre = new AbortController();
          pre.abort(new DOMException("caller cancel", "AbortError"));
          const preAborted = await attempt(() => service.transcribe(spec, pre.signal));

          await disposeFast();
          const withdrawn = await attempt(() => service.transcribe(spec, new AbortController().signal));

          const firstSwapped = fakeProvider({ id: "swap" });
          const disposeFirst = service.register(firstSwapped.provider);
          const stale = service.resolve({ audio, providerId: "swap" });
          await disposeFirst();
          service.register(fakeProvider({ id: "swap" }).provider);
          const replaced = await attempt(() => service.transcribe(stale, new AbortController().signal));

          const slow = fakeProvider({
            id: "slow",
            transcribe: (_input, signal) =>
              new Promise<Transcript>((_resolve, reject) => {
                signal.addEventListener("abort", () => reject(signal.reason), { once: true });
              }),
          });
          const disposeSlow = service.register(slow.provider);
          const slowSpec = service.resolve({ audio, providerId: "slow" });
          const pending = service.transcribe(slowSpec, new AbortController().signal);
          const pendingOutcome = attempt(() => pending);
          await Promise.resolve();
          await Promise.resolve();
          await disposeSlow();
          const cancelledByUnload = await pendingOutcome;

          return { success, successInput, failure, preAborted, withdrawn, replaced, cancelledByUnload };
        }),
      );
      expect(result.ours).toEqual(result.theirs);
      expect(result.ours.success).toEqual({ text: "recognized", audioSeconds: 1.5, inferenceSeconds: 0.25 });
      expect(result.ours.successInput).toEqual([{ audio: [1, 2, 3, 4], language: "auto", aborted: false }]);
      expect(result.ours.failure).toEqual({ ok: false, error: { name: "ProviderFailure", message: "provider exploded", code: "E_PROVIDER", cause: { name: "Error", message: "root cause", code: undefined } } });
      expect(result.ours.preAborted).toEqual({ ok: false, error: { name: "AbortError", message: "caller cancel" } });
      expect(result.ours.withdrawn).toEqual({ ok: false, error: { name: "Error", message: "Resolved speech provider is no longer registered" } });
      expect(result.ours.replaced).toEqual({ ok: false, error: { name: "Error", message: "Resolved speech provider is no longer registered" } });
      expect(result.ours.cancelledByUnload).toEqual({ ok: false, error: { name: "Error", message: "Speech provider unloaded" } });
    },
    TEST_TIMEOUT,
  );

  test(
    "C12 configure: thiếu settings · thiếu entry · 3 lượt ghi hợp lệ · provider/ngôn ngữ sai · settings ném — B ≡ A",
    async () => {
      const result = await both(async (side) => {
        const noSettings = boot(side, { settings: false });
        const withoutSettings = await attempt(() => noSettings.service.configure({ providerId: "fake" }));
        await noSettings.ctx.fiber.dispose();

        const noEntry = boot(side, { entryId: null });
        const withoutEntry = await attempt(() => noEntry.service.configure({ providerId: "fake" }));
        await noEntry.ctx.fiber.dispose();

        const rig = boot(side, { entryId: "speech-profile" });
        rig.service.register(fakeProvider({ id: "fake", languages: ["auto", "en"] }).provider);
        await rig.service.configure({ providerId: "fake" });
        await rig.service.configure({ language: "en" });
        await rig.service.configure({ providerId: "fake", language: "en" });
        const updates = rig.updates;
        const configAfter = { defaultProvider: rig.config.defaultProvider.get(), language: rig.config.language.get() };
        const badProvider = await attempt(() => rig.service.configure({ providerId: "missing" }));
        const badLanguage = await attempt(() => rig.service.configure({ language: "fr" }));
        const updateCountAfterInvalid = rig.updates.length;
        await rig.ctx.fiber.dispose();

        const failure = new Error("profile write failed", { cause: new Error("disk full") });
        failure.name = "SettingsFailure";
        (failure as Error & { code?: string }).code = "E_SETTINGS";
        const failing = boot(side, { entryId: "speech-profile", settingsFailure: failure });
        failing.service.register(fakeProvider({ id: "fake", languages: ["auto"] }).provider);
        const rejected = await attempt(() => failing.service.configure({ providerId: "fake" }));
        const failingUpdates = failing.updates;
        await failing.ctx.fiber.dispose();

        return {
          withoutSettings,
          withoutEntry,
          updates,
          configAfter,
          badProvider,
          badLanguage,
          updateCountAfterInvalid,
          rejected,
          failingUpdates,
        };
      });
      expect(result.ours).toEqual(result.theirs);
      expect(result.ours.withoutSettings).toEqual({ ok: false, error: { name: "Error", message: "Speech selection requires the settings service and a profile entry" } });
      expect(result.ours.withoutEntry).toEqual({ ok: false, error: { name: "Error", message: "Speech selection requires the settings service and a profile entry" } });
      expect(result.ours.updates).toEqual([{ id: "speech-profile", patch: { defaultProvider: "fake" } }, { id: "speech-profile", patch: { language: "en" } }, { id: "speech-profile", patch: { defaultProvider: "fake", language: "en" } }]);
      expect(result.ours.configAfter).toEqual({ defaultProvider: "fake", language: "auto" });
      expect(result.ours.badProvider).toEqual({ ok: false, error: { name: "Error", message: "Speech provider is unavailable: missing" } });
      expect(result.ours.badLanguage).toEqual({ ok: false, error: { name: "Error", message: "Speech provider fake does not support language: fr" } });
      expect(result.ours.updateCountAfterInvalid).toBe(3);
      expect(result.ours.rejected).toEqual({ ok: false, error: { name: "SettingsFailure", message: "profile write failed", code: "E_SETTINGS", cause: { name: "Error", message: "disk full", code: undefined } } });
      expect(result.ours.failingUpdates).toEqual([{ id: "speech-profile", patch: { defaultProvider: "fake" } }]);
    },
    TEST_TIMEOUT,
  );

  test(
    "C13 validateWave: WAV chuẩn · quá hạn · header hỏng · lẻ byte · view lệch offset — B ≡ A",
    async () => {
      const second = canonicalWave(16_000);
      const half = canonicalWave(8_000);
      const badMagic = canonicalWave(10);
      badMagic[0] = 0;
      const badFmtSize = canonicalWave(10);
      new DataView(badFmtSize.buffer).setUint32(16, 15, true);
      const badRiffSize = canonicalWave(10);
      new DataView(badRiffSize.buffer).setUint32(4, 1, true);
      const odd = canonicalWave(10, 1);
      const truncated = canonicalWave(10).subarray(0, 20);
      const shiftedSource = new Uint8Array(second.length + 7);
      shiftedSource.set(second, 7);
      const shifted = shiftedSource.subarray(7);
      const cases = [
        { audio: second, max: 2 },
        { audio: half, max: 1 },
        { audio: second, max: 0.5 },
        { audio: new Uint8Array(0), max: 1 },
        { audio: badMagic, max: 1 },
        { audio: badFmtSize, max: 1 },
        { audio: badRiffSize, max: 1 },
        { audio: odd, max: 1 },
        { audio: truncated, max: 1 },
        { audio: shifted, max: 2 },
      ];
      for (const fixture of cases) {
        const result = await both((side) =>
          attemptSync(() => (side.label === "ours" ? oursWave : stockWave).validateWave(fixture.audio, fixture.max)),
        );
        expect(result.ours).toEqual(result.theirs);
      }
      expect(oursWave.validateWave(second, 2)).toBe(1);
      expect(oursWave.validateWave(half, 1)).toBe(0.5);
      expect(oursWave.validateWave(shifted, 2)).toBe(1);
      expect(attemptSync(() => oursWave.validateWave(second, 0.5))).toEqual({ ok: false, error: { name: "Error", message: "Audio exceeds 0.5 seconds" } });
      expect(attemptSync(() => oursWave.validateWave(badMagic, 1))).toEqual({ ok: false, error: { name: "Error", message: "Audio must be a canonical 16 kHz mono PCM16 WAV recording" } });
      expect(attemptSync(() => oursWave.validateWave(odd, 1))).toEqual({ ok: false, error: { name: "Error", message: "Audio must be a canonical 16 kHz mono PCM16 WAV recording" } });
    },
    TEST_TIMEOUT,
  );
});
