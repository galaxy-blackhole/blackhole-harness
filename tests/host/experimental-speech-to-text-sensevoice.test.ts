/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-experimental-speech-to-text-sensevoice: chờ nguồn ổn định, build gói ta ra mkdtemp, nạp lib/index.js + lib/worker.js của ta và bản stock @deepseek-ai/dsh-experimental-speech-to-text-sensevoice trên CÙNG fixture; so sâu export/Config/assets/worker/seam subprocess giả/plugin apply. KHÔNG gọi mạng, KHÔNG audio hay model thật.
 */
import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { PassThrough } from "node:stream";
import { pathToFileURL } from "node:url";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "experimental-speech-to-text-sensevoice");
/** node_modules của kernel — nơi cả hai bản phân giải peer. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Thư mục package stock (CHỈ ĐỌC) — oracle. */
const STOCK_DIR = join(APP_MODULES, "@deepseek-ai", "dsh-experimental-speech-to-text-sensevoice");
/** Thư mục build tạm; dọn ở afterAll. */
const OUT = mkdtempSync(join(tmpdir(), "gbh-sensevoice-ab-"));
/** Hạn chót chờ nguồn ổn định + build xong, tính bằng ms. */
const DEADLINE = Date.now() + 300_000;
/** dataRoot dùng chung cho hai bên. */
const DATA = join(OUT, "data");
/** Thư mục model tự dựng (tệp rỗng, KHÔNG phải ONNX thật). */
const MODEL_DIR = join(DATA, "models", "sensevoice-onnx");
/** Đường dẫn VAD tự dựng. */
const VAD_PATH = join(DATA, "models", "silero", "silero_vad.onnx");
/** sha256 của runtime/assets.json stock — mốc BYTE-IDENTICAL. */
const ASSETS_SHA256 = "d46d8e9dd0493725535997100bd2c1389fd3d0ddc5d2e2aefa5495a996d3f5d5";

/** Hình dạng module plugin mà test đọc. */
interface Plugin {
  Config: (input?: unknown) => unknown;
  apply: (ctx: unknown, config: any) => void;
  inject: string[];
  name: string;
  default?: unknown;
}

/** Kết quả build tạm của ta. */
interface Built {
  index: string;
  worker: string;
  root: string;
}

/** Bộ đọc collect-mode tối thiểu. */
interface Reader {
  readFrom(from?: number): { text: string; lossy: boolean; nextOffset: number };
}

/** Handle tiến trình giả của seam subprocess. */
interface Handle {
  stdout: PassThrough;
  done: Promise<{ exitCode: number | null; signal: string | null }>;
  collected: { stderr: Reader };
  terminate(): void;
  waitForExit(): Promise<boolean>;
  terminated(): number;
}

/** Thế giới giả: ctx + vết gọi seam. */
interface World {
  ctx: any;
  registered: any[];
  spawns: any[];
  disposers: Array<() => unknown>;
  handles: Handle[];
  provider(): any;
  close(): Promise<void>;
}

/** Dấu vết lỗi so sánh được (name/message/code/cause). */
interface Failure {
  name: string;
  message: string;
  code: string | null;
  cause: Failure | null;
}

/** Một lượt gọi HTTP giả đã bắt được. */
interface Call {
  url: string;
  method: string;
  authorization: string;
  contentType: string;
  bytes: number;
}

/** Kết cục một lượt transcribe. */
interface Run {
  result?: any;
  failure?: Failure;
  calls: Call[];
}

/** Không ném lỗi — mốc so sánh. */
const NO_FAILURE: Failure = { name: "none", message: "", code: null, cause: null };
/** Mọi thế giới đã dựng, dọn ở afterAll. */
const WORLDS: World[] = [];

/** Ngủ ms mili giây. */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Chữ ký size+mtime của build.ts và mọi tệp dưới src/; chuỗi rỗng khi nguồn chưa đủ.
 * Nhận: không.
 * Trả: chữ ký để phát hiện nguồn còn đang được ghi.
 */
function sourceSignature(): string {
  const files: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else files.push(path);
    }
  };
  walk(join(PKG, "src"));
  const build = join(PKG, "build.ts");
  if (files.length === 0 || !existsSync(build)) return "";
  files.push(build);
  return files
    .map((file) => relative(PKG, file))
    .sort()
    .map((file) => {
      const info = statSync(join(PKG, file));
      return file + ":" + info.size + ":" + info.mtimeMs;
    })
    .join("|");
}

/** Chờ build.ts + src/ ỔN ĐỊNH qua hai lần đo cách 300ms (hạn DEADLINE). */
async function settleSources(): Promise<void> {
  let signature = "";
  while (Date.now() < DEADLINE) {
    const next = sourceSignature();
    if (next !== "" && next === signature) return;
    signature = next;
    await sleep(300);
  }
  throw new Error("nguồn " + PKG + " không ổn định sau 300s");
}

/**
 * Tìm artifact trong lib/ rồi BFS tối đa ba tầng, bỏ node_modules.
 * Nhận: root — thư mục gốc; name — tên tệp.
 * Trả: đường dẫn tuyệt đối hoặc undefined.
 */
function findIn(root: string, name: string): string | undefined {
  for (const direct of [join(root, "lib", name), join(root, name)]) if (existsSync(direct)) return direct;
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
  while (queue.length > 0) {
    const next = queue.shift() as { dir: string; depth: number };
    if (next.dir !== root && existsSync(join(next.dir, name))) return join(next.dir, name);
    if (next.depth >= 3) continue;
    for (const entry of readdirSync(next.dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== "node_modules") queue.push({ dir: join(next.dir, entry.name), depth: next.depth + 1 });
    }
  }
  return undefined;
}

/**
 * Nạp build.ts của ta và dựng artifact vào OUT; thiếu lib/ thì lùi về lib/ của gói.
 * Nhận: không.
 * Trả: đường dẫn lib/index.js + lib/worker.js và gốc artifact.
 */
async function buildOurs(): Promise<Built> {
  await settleSources();
  const module = (await import(pathToFileURL(join(PKG, "build.ts")).href)) as { buildPackage?: (outDir?: string) => Promise<unknown> };
  if (typeof module.buildPackage !== "function") throw new Error("build.ts không export buildPackage");
  const buildPackage = module.buildPackage;
  for (;;) {
    try {
      await buildPackage(join(OUT, "lib"));
      const index = findIn(OUT, "index.js");
      const worker = findIn(OUT, "worker.js");
      if (index !== undefined && worker !== undefined) return { index, worker, root: OUT };
    } catch (error) {
      if (Date.now() > DEADLINE) throw error;
    }
    if (Date.now() > DEADLINE) break;
    await sleep(500);
  }
  const index = join(PKG, "lib", "index.js");
  const worker = join(PKG, "lib", "worker.js");
  if (!existsSync(index) || !existsSync(worker)) throw new Error("không thấy lib/index.js + lib/worker.js của " + PKG);
  return { index, worker, root: PKG };
}

/** Bốn phụ thuộc runtime mà artifact phải phân giải được. */
const NEEDED = ["zod", "@deepseek-ai/schemastery", "@deepseek-ai/dsh-timeout", "@deepseek-ai/dsh-experimental-speech-to-text"];

/**
 * Bảo đảm artifact tạm thấy đủ phụ thuộc: thiếu thì symlink node_modules kernel vào.
 * Nhận: root — gốc artifact; replaceable — chỉ OUT mới được thay node_modules.
 * Trả: không.
 */
function ensureModules(root: string, replaceable: boolean): void {
  const modules = join(root, "node_modules");
  if (NEEDED.every((name) => existsSync(join(modules, name)))) return;
  if (!replaceable) throw new Error("node_modules của " + root + " thiếu phụ thuộc runtime");
  rmSync(modules, { recursive: true, force: true });
  symlinkSync(APP_MODULES, modules, "dir");
}

/**
 * Chép runtime/assets.json THẬT của gói vào artifact nếu build chỉ sinh lib/.
 * Nhận: root — gốc artifact.
 * Trả: không.
 */
function ensureAssets(root: string): void {
  const target = join(root, "runtime", "assets.json");
  if (existsSync(target)) return;
  const source = join(PKG, "runtime", "assets.json");
  if (!existsSync(source)) return;
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

/**
 * Mô tả lỗi thành dữ liệu so sánh được, gồm cả cause.
 * Nhận: error — giá trị đã ném.
 * Trả: name/message/code/cause.
 */
function factsOf(error: unknown): Failure {
  if (!(error instanceof Error)) return { name: typeof error, message: String(error), code: null, cause: null };
  const code = (error as any).code;
  const cause = (error as any).cause;
  return { name: error.name, message: error.message, code: typeof code === "string" ? code : null, cause: cause === undefined ? null : factsOf(cause) };
}

/**
 * Chạy một phép gọi và đóng gói kết cục lỗi (hoặc NO_FAILURE).
 * Nhận: run — phép gọi đồng bộ hay bất đồng bộ.
 * Trả: dấu vết lỗi so sánh được.
 */
async function failureOf(run: () => unknown): Promise<Failure> {
  try {
    await run();
    return NO_FAILURE;
  } catch (error) {
    return factsOf(error);
  }
}

/**
 * Bản sao state đã bỏ mốc thời gian (startedAt) để so A/B.
 * Nhận: state — snapshot preparation.
 * Trả: dữ liệu JSON so sánh được.
 */
function normalizeState(state: any): any {
  return JSON.parse(JSON.stringify(state, (key, value) => (key === "startedAt" ? 0 : value)));
}

/** Bộ đọc collect-mode giả. */
function readerOf(text: string): Reader {
  return { readFrom: (from = 0) => ({ text: text.slice(from), lossy: false, nextOffset: text.length }) };
}

/**
 * Handle worker giả: phát đúng một khung sẵn sàng (hoặc thoát sớm), terminate đếm được.
 * Nhận: options.frame — khung stdout; options.stderr — văn bản lỗi; options.exitEarly — thoát trước sẵn sàng.
 * Trả: handle đúng khuôn seam subprocess.
 */
function handleOf(options: { frame?: string; stderr?: string; exitEarly?: boolean } = {}): Handle {
  const stdout = new PassThrough();
  let resolveDone: (outcome: { exitCode: number | null; signal: string | null }) => void = () => undefined;
  const done = new Promise<{ exitCode: number | null; signal: string | null }>((resolve) => {
    resolveDone = resolve;
  });
  let terminated = 0;
  if (options.exitEarly === true) resolveDone({ exitCode: 1, signal: null });
  else stdout.write(options.frame ?? "{\"port\":45123}\n");
  return {
    stdout,
    done,
    collected: { stderr: readerOf(options.stderr ?? "") },
    terminate: () => {
      terminated += 1;
      resolveDone({ exitCode: 0, signal: null });
    },
    waitForExit: async () => true,
    terminated: () => terminated,
  };
}

/**
 * Dựng ctx giả (effect/speechToText.register/subprocess.spawn/logger) và vết gọi seam.
 * Nhận: handles — hàng đợi handle cho từng lượt spawn.
 * Trả: thế giới giả đã đăng ký để afterAll dọn.
 */
function worldOf(handles: Handle[] = []): World {
  const registered: any[] = [];
  const spawns: any[] = [];
  const disposers: Array<() => unknown> = [];
  const pending = [...handles];
  const ctx = {
    effect(callback: () => unknown) {
      const disposer = callback();
      if (typeof disposer === "function") disposers.push(disposer as () => unknown);
      return () => undefined;
    },
    speechToText: {
      register(spec: any) {
        registered.push(spec);
        return async () => undefined;
      },
    },
    subprocess: {
      spawn(spec: any) {
        spawns.push(spec);
        return pending.shift() ?? handleOf();
      },
    },
    logger: { warn: () => undefined },
  };
  const world: World = {
    ctx,
    registered,
    spawns,
    disposers,
    handles,
    provider: () => registered[0],
    close: async () => {
      for (const disposer of disposers.splice(0)) await disposer();
    },
  };
  WORLDS.push(world);
  return world;
}

/** Dựng ba tệp runtime giả (model.int8.onnx · tokens.txt · silero_vad.onnx). */
function materialize(): void {
  mkdirSync(MODEL_DIR, { recursive: true });
  writeFileSync(join(MODEL_DIR, "model.int8.onnx"), "int8");
  writeFileSync(join(MODEL_DIR, "tokens.txt"), "tokens");
  mkdirSync(dirname(VAD_PATH), { recursive: true });
  writeFileSync(VAD_PATH, "vad");
}

const OURS = await buildOurs();
ensureModules(OURS.root, OURS.root === OUT);
ensureAssets(OURS.root);
materialize();
const ours = (await import(pathToFileURL(OURS.index).href)) as Plugin;
const stock = (await import(pathToFileURL(join(STOCK_DIR, "lib", "index.js")).href)) as Plugin;
const OUR_WORKER = readFileSync(OURS.worker);
const STOCK_WORKER = readFileSync(join(STOCK_DIR, "lib", "worker.js"));
const OUR_ASSETS_PATH = existsSync(join(PKG, "runtime", "assets.json")) ? join(PKG, "runtime", "assets.json") : join(OURS.root, "runtime", "assets.json");
const OUR_ASSETS = readFileSync(OUR_ASSETS_PATH);
const STOCK_ASSETS = readFileSync(join(STOCK_DIR, "runtime", "assets.json"));
const STOCK_ASSETS_PATH = join(STOCK_DIR, "runtime", "assets.json");

/** Cấu hình đã chuẩn hoá bằng Config stock — dùng CHUNG cho hai bên. */
function configOf(overrides: Record<string, unknown> = {}): any {
  const normalized = stock.Config({ dataRoot: DATA, modelDirectory: MODEL_DIR, vadModelPath: VAD_PATH, idleTimeoutMs: 0 }) as Record<string, unknown>;
  return { ...normalized, ...overrides };
}

afterAll(async () => {
  for (const world of WORLDS) await world.close();
  rmSync(OUT, { recursive: true, force: true });
});

/**
 * Chờ lượt inspect() của apply lắng xuống rồi trả snapshot.
 * Nhận: provider — provider đã đăng ký.
 * Trả: state sau khi inspect xong.
 */
async function settle(provider: any): Promise<any> {
  const preparation = provider.preparation;
  let publishes = 0;
  const unsubscribe = preparation.subscribe(() => {
    publishes += 1;
  });
  try {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline && publishes === 0) await sleep(10);
    for (;;) {
      const before = publishes;
      await sleep(20);
      const state = preparation.snapshot();
      if (publishes === before && state.phase !== "checking") return state;
      if (Date.now() > deadline) return state;
    }
  } finally {
    unsubscribe();
  }
}

/**
 * apply plugin trên ctx giả rồi chờ inspect() lắng.
 * Nhận: plugin — module cần áp; config — cấu hình đầy đủ; handles — handle cho seam spawn.
 * Trả: thế giới giả.
 */
async function boot(plugin: Plugin, config: any, handles: Handle[] = []): Promise<World> {
  const world = worldOf(handles);
  plugin.apply(world.ctx, config);
  await settle(world.provider());
  return world;
}

/**
 * Chờ tới khi preparation đạt một trong các phase cho trước.
 * Nhận: provider — provider đã đăng ký; phases — phase đích.
 * Trả: snapshot đạt được (hoặc snapshot cuối khi hết hạn).
 */
async function waitPhase(provider: any, phases: string[]): Promise<any> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const state = provider.preparation.snapshot();
    if (phases.includes(state.phase)) return state;
    await sleep(10);
  }
  return provider.preparation.snapshot();
}

/**
 * prepare() trên một thế giới đã có runtime cache rồi chờ ready/failed.
 * Nhận: world — thế giới giả.
 * Trả: snapshot sau khi preparation kết thúc.
 */
async function prepare(world: World): Promise<any> {
  world.provider().preparation.prepare();
  return await waitPhase(world.provider(), ["ready", "failed"]);
}

/**
 * Chạy một lượt transcribe với fetch GIẢ (không chạm mạng).
 * Nhận: spec — provider đã đăng ký; input — audio + language; respond — dựng Response theo lượt gọi.
 * Trả: kết quả hoặc lỗi, kèm vết gọi HTTP.
 */
function fetchFake(respond: (call: Call) => Response): { calls: Call[]; restore: () => void } {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: any, init: any = {}) => {
    const call: Call = {
      url: String(url),
      method: String(init.method ?? ""),
      authorization: String(init.headers?.authorization ?? ""),
      contentType: String(init.headers?.["content-type"] ?? ""),
      bytes: Buffer.byteLength(init.body),
    };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

/**
 * Chạy một lượt transcribe dưới fetch giả rồi hoàn nguyên fetch thật.
 * Nhận: spec — provider đã đăng ký; input — audio + language; respond — dựng Response.
 * Trả: kết quả hoặc lỗi, kèm vết gọi HTTP.
 */
async function transcribeOf(spec: any, input: { audio: Uint8Array; language: string }, respond: (call: Call) => Response): Promise<Run> {
  const fake = fetchFake(respond);
  try {
    const result = await spec.transcribe(input, new AbortController().signal);
    return { result, calls: fake.calls };
  } catch (error) {
    return { failure: factsOf(error), calls: fake.calls };
  } finally {
    fake.restore();
  }
}

/** Response JSON giả. */
const json = (status: number, value: unknown): Response => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
/** Audio giả (chỉ là byte, không phải WAV thật). */
const AUDIO = new Uint8Array(64).fill(7);
/** Input mẫu. */
const INPUT = { audio: AUDIO, language: "en" };

/**
 * Đặc tả spawn đã chuẩn hoá để so A/B: bỏ đường dẫn tuyệt đối và token ngẫu nhiên.
 * Nhận: spec — spec đã ghi qua seam giả.
 * Trả: dữ liệu so sánh được.
 */
function spawnFacts(spec: any): any {
  const argv = [...spec.argv] as string[];
  const payload = JSON.parse(argv[2] ?? "{}");
  return {
    argv: [argv[0], basename(argv[1] ?? ""), argv.length],
    payload: { ...payload, worker: basename(payload.worker ?? "") },
    cwd: spec.cwd,
    graceMs: spec.graceMs,
    env: { ...spec.env, DSH_SPEECH_TOKEN: "TOKEN" },
    stdio: spec.stdio,
  };
}

/** Vết gọi HTTP đã chuẩn hoá token ngẫu nhiên (mỗi bên một token riêng). */
const callsFacts = (calls: Call[]): Call[] => calls.map((call) => ({ ...call, authorization: call.authorization.replace(/[a-f0-9]{64}/u, "TOKEN") }));

/** sha256 hex của một buffer. */
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

test("export surface: ĐÚNG {Config, apply, inject, name}, KHÔNG default, name/inject trùng stock", () => {
  expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
  expect(Object.keys(ours).sort()).toEqual(["Config", "apply", "inject", "name"]);
  expect(ours.default).toBeUndefined();
  expect(stock.default).toBeUndefined();
  expect(typeof ours.apply).toBe("function");
  expect(ours.name).toBe(stock.name);
  expect(ours.inject).toEqual(stock.inject);
  expect(ours.inject).toEqual(["speechToText", "subprocess"]);
});

test("Config: String() trùng từng chữ, mặc định đầy đủ trùng stock (trừ delta có chủ đích), ghi đè trùng stock", () => {
  expect(String(ours.Config)).toBe(String(stock.Config));
  const defaults = ours.Config({ dataRoot: DATA });
  // 25/10/2026 — DELTA CÓ CHỦ ĐÍCH: bản ta chỉ tải từ Hugging Face chính thức (bỏ gương hf-mirror).
  const stockDefaults = stock.Config({ dataRoot: DATA }) as unknown as Record<string, unknown>;
  expect(stockDefaults["modelOrigins"]).toEqual(["https://huggingface.co", "https://hf-mirror.com"]);
  const oursDefaults = defaults as unknown as Record<string, unknown>;
  const comparable = { ...oursDefaults, modelOrigins: stockDefaults["modelOrigins"] } as unknown as { modelOrigins: unknown };
  expect(comparable).toEqual(stockDefaults as unknown as { modelOrigins: unknown });
  expect(defaults).toEqual({
    providerId: "sensevoice-local",
    dataRoot: DATA,
    precision: "int8",
    // 25/10/2026 — delta có chủ đích: chỉ Hugging Face chính thức (xem tests/host/experimental-speech-to-text-sensevoice.test.ts:523).
    modelOrigins: ["https://huggingface.co"],
    modelProbeTimeoutMs: 3000,
    threads: 2,
    segmentSeconds: 30,
    vadThreshold: 0.5,
    minSpeechSeconds: 0.25,
    minSilenceSeconds: 0.5,
    vadOnsetPaddingSeconds: 0.3,
    maxAudioBytes: 4194304,
    prepareTimeoutMs: 3600000,
    inferenceTimeoutMs: 120000,
    idleTimeoutMs: 300000,
    maxPending: 4,
    graceMs: 1000,
    maxLogBytes: 65536,
    maxResponseBytes: 131072,
    progressIntervalMs: 100,
  });
  // 25/10/2026 — khai TƯỜNG MINH modelOrigins để so phần override công bằng (bản ta đổi default, xem test phía trên).
  const overrides = { dataRoot: DATA, precision: "fp32", modelDirectory: MODEL_DIR, vadModelPath: VAD_PATH, modelOrigin: "https://hf-mirror.com", modelOrigins: ["https://huggingface.co"], threads: 4, idleTimeoutMs: 0, language: undefined };
  expect(ours.Config(overrides)).toEqual(stock.Config(overrides));
  expect((ours.Config(overrides) as any).precision).toBe("fp32");
});

test("Config: 10 cấu hình SAI cho CÙNG name/message ở hai bên", async () => {
  const invalid: Array<[string, Record<string, unknown>]> = [
    ["thiếu dataRoot", {}],
    ["dataRoot rỗng", { dataRoot: "" }],
    ["precision lạ", { dataRoot: DATA, precision: "nope" }],
    ["threads 0", { dataRoot: DATA, threads: 0 }],
    ["modelOrigins rỗng", { dataRoot: DATA, modelOrigins: [] }],
    ["origin sai scheme", { dataRoot: DATA, modelOrigin: "ftp://mirror" }],
    ["segmentSeconds 121", { dataRoot: DATA, segmentSeconds: 121 }],
    ["vadThreshold 1.5", { dataRoot: DATA, vadThreshold: 1.5 }],
    ["maxAudioBytes 10", { dataRoot: DATA, maxAudioBytes: 10 }],
    ["minSilenceSeconds 0", { dataRoot: DATA, minSilenceSeconds: 0 }],
  ];
  for (const [label, input] of invalid) {
    const mine = await failureOf(() => ours.Config(input));
    const theirs = await failureOf(() => stock.Config(input));
    expect({ label, ...mine }).toEqual({ label, ...theirs });
    expect(mine).not.toEqual(NO_FAILURE);
  }
});

test("runtime/assets.json: BYTE-IDENTICAL với stock (sha256 + số byte) và parse JSON giống nhau", () => {
  expect(OUR_ASSETS.length).toBe(STOCK_ASSETS.length);
  expect(sha256(OUR_ASSETS)).toBe(sha256(STOCK_ASSETS));
  expect(sha256(OUR_ASSETS)).toBe(ASSETS_SHA256);
  expect(sha256(readFileSync(STOCK_ASSETS_PATH))).toBe(ASSETS_SHA256);
  const mine = JSON.parse(OUR_ASSETS.toString("utf8"));
  expect(mine).toEqual(JSON.parse(STOCK_ASSETS.toString("utf8")));
});

test("runtime/assets.json: đúng shape khoá + URL pin + sha256 64 hex như stock", () => {
  const mine = JSON.parse(OUR_ASSETS.toString("utf8"));
  const theirs = JSON.parse(STOCK_ASSETS.toString("utf8"));
  expect(Object.keys(mine).sort()).toEqual(Object.keys(theirs).sort());
  expect(Object.keys(mine).sort()).toEqual(["models", "tokens", "vad"]);
  expect(Object.keys(mine.models).sort()).toEqual(["fp32", "int8"]);
  for (const asset of [mine.models.int8, mine.models.fp32, mine.tokens, mine.vad]) {
    expect(Object.keys(asset).sort()).toEqual(["bytes", "name", "sha256", "url"]);
    expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(Number.isSafeInteger(asset.bytes) && asset.bytes > 0).toBe(true);
    expect(asset.url.startsWith("https://huggingface.co/")).toBe(true);
  }
  expect(mine.models.int8.name).toBe("model.int8.onnx");
  expect(mine.models.int8.bytes).toBe(239233841);
  expect(mine.models.fp32.name).toBe("model.onnx");
  expect(mine.models.fp32.bytes).toBe(937617178);
  expect(mine.tokens.name).toBe("tokens.txt");
  expect(mine.tokens.bytes).toBe(315894);
  expect(mine.vad.name).toBe("silero_vad.onnx");
  expect(mine.vad.bytes).toBe(1807522);
  expect(mine.models.int8.url).toContain("2365baeacb507f821a0c8120fcee3d484dba7a07");
  expect(mine.vad.url).toContain("fba88cd2e921609e7675c3aaf51e0b9b295da4bc");
});

test("lib/worker.js: chạy THẬT khi KHÔNG có model ⇒ CÙNG exit code + CÙNG byte stderr/stdout", () => {
  const run = (path: string): { status: number | null; stdout: string; stderr: string } => {
    const result = spawnSync(process.execPath, [path], { encoding: "utf8", timeout: 30_000 });
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  };
  const mine = run(OURS.worker);
  const theirs = run(join(STOCK_DIR, "lib", "worker.js"));
  expect(mine).toEqual(theirs);
  expect(mine.status).toBe(1);
  expect(mine.stdout).toBe("");
  expect(mine.stderr.length).toBeGreaterThan(0);
  expect(mine.stderr).not.toContain("sherpa");
});

test("lib/worker.js: entry point + exports + khuôn khung sẵn sàng giống stock", () => {
  const mine = OUR_WORKER.toString("utf8");
  const theirs = STOCK_WORKER.toString("utf8");
  const exportsOf = (source: string): string[] =>
    [...source.matchAll(/^export\s*\{([^}]*)\}/gmu)].flatMap((match) => (match[1] ?? "").split(",").map((part) => part.trim()).filter((part) => part !== ""));
  expect(exportsOf(mine)).toEqual([]);
  expect(exportsOf(mine)).toEqual(exportsOf(theirs));
  expect(mine).not.toMatch(/^export\s+(default|const|let|function|class)/mu);
  const frameOf = (source: string): string =>
    (/process\.stdout\.write\(([\s\S]*?)\);/u.exec(source)?.[1] ?? "")
      .replace(/\n/gu, "<NL>")
      .replace(/\\n/gu, "<NL>")
      .replace(/\s+/gu, "");
  expect(frameOf(mine)).toBe(frameOf(theirs));
  expect(frameOf(mine)).toContain("JSON.stringify({port})");
  const secretOf = (source: string): string => /DSH_SPEECH_TOKEN/u.exec(source)?.[0] ?? "";
  expect(secretOf(mine)).toBe(secretOf(theirs));
  for (const source of [mine, theirs]) {
    expect(source).toContain("delete process.env.DSH_SPEECH_TOKEN");
    expect(source).toContain("process.exit(1)");
    expect(source).toContain('createRequire(import.meta.url)("sherpa-onnx-node")');
    expect(source).toContain("main().catch");
    expect(source.match(/^import .*sherpa/gu)).toBeNull();
  }
});

test("apply: đường dẫn tương đối bị từ chối với CÙNG name/message, KHÔNG đăng ký provider", async () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ["dataRoot", { dataRoot: "relative/root" }],
    ["modelDirectory", { modelDirectory: "relative/models" }],
    ["vadModelPath", { vadModelPath: "relative/vad.onnx" }],
  ];
  for (const [label, patch] of cases) {
    const config = configOf(patch);
    const worlds = { mine: worldOf(), theirs: worldOf() };
    const mine = await failureOf(() => ours.apply(worlds.mine.ctx, config));
    const theirs = await failureOf(() => stock.apply(worlds.theirs.ctx, config));
    expect({ label, ...mine }).toEqual({ label, ...theirs });
    expect(mine).not.toEqual(NO_FAILURE);
    expect(mine.message).toContain("SenseVoice paths must be absolute");
    expect(worlds.mine.registered).toHaveLength(0);
    expect(worlds.theirs.registered).toHaveLength(0);
  }
});

test("apply: origin hỏng ném CÙNG TypeError ở hai bên; origin hợp lệ vẫn đăng ký được", async () => {
  const broken = configOf({ modelOrigin: "khong-phai-url" });
  const mine = await failureOf(() => ours.apply(worldOf().ctx, broken));
  const theirs = await failureOf(() => stock.apply(worldOf().ctx, broken));
  expect(mine).toEqual(theirs);
  expect(mine).not.toEqual(NO_FAILURE);
  expect(mine.name).toBe("TypeError");
  const valid = configOf({ modelDirectory: undefined, modelOrigin: "https://hf-mirror.com" });
  const world = await boot(ours, valid);
  expect(world.registered).toHaveLength(1);
  expect((world.provider().info as any).downloadSources).toEqual(["https://hf-mirror.com"]);
});

test("apply: info provider + setupEstimate + downloadSources khớp stock ở 4 tổ hợp cấu hình", async () => {
  const combos = [
    { label: "int8 + cả hai đường dẫn", patch: {} },
    { label: "fp32 + cả hai đường dẫn", patch: { precision: "fp32" } },
    { label: "int8 + tải model", patch: { modelDirectory: undefined } },
    { label: "fp32 + tải cả model và vad", patch: { precision: "fp32", modelDirectory: undefined, vadModelPath: undefined } },
  ];
  for (const combo of combos) {
    const config = configOf(combo.patch);
    const mine = await boot(ours, config);
    const theirs = await boot(stock, config);
    // 25/10/2026 — HAI KHÁC BIỆT CÓ CHỦ ĐÍCH của bản port (yêu cầu chủ dự án):
    //   · languages: chỉ "auto" + "en" (SenseVoiceSmall không hỗ trợ tiếng Việt)
    //   · downloadSources: chỉ Hugging Face chính thức (bỏ gương hf-mirror)
    // Mọi trường khác vẫn phải khớp stock từng byte — nên so phần còn lại, và khẳng định riêng hai trường này.
    // Chỉ loại `languages` khỏi phép so (bản ta rút còn auto/en); mọi trường khác — kể cả downloadSources —
    // vẫn phải khớp stock vì config trong test khai origin TƯỜNG MINH (stock.Config chuẩn hoá).
    const strip = (info: Record<string, unknown>): Record<string, unknown> => {
      const { languages: _langs, ...rest } = info;
      return rest;
    };
    expect({ label: combo.label, info: strip(mine.provider().info as Record<string, unknown>) }).toEqual({
      label: combo.label,
      info: strip(theirs.provider().info as Record<string, unknown>),
    });
    expect((mine.provider().info as { languages?: string[] }).languages).toEqual(["auto", "en"]);
    // downloadSources KHÔNG cần khẳng định riêng: nó nằm trong phép so `strip` ở trên, và config của test khai
    // origin TƯỜNG MINH nên hai bên vẫn bằng nhau (delta "bỏ gương hf-mirror" chỉ áp cho DEFAULT).
    expect(mine.provider().info.name).toBe(combo.patch.precision === "fp32" ? "SenseVoiceSmall (FP32)" : "SenseVoiceSmall (INT8)");
    expect(normalizeState(mine.provider().preparation.snapshot())).toEqual(normalizeState(theirs.provider().preparation.snapshot()));
    expect(mine.spawns).toHaveLength(0);
    expect(theirs.spawns).toHaveLength(0);
  }
});

test("apply: model gốc đã có ⇒ standby và steps khớp stock; thiếu tệp ⇒ unprepared", async () => {
  const cached = await boot(ours, configOf());
  const cachedStock = await boot(stock, configOf());
  expect(normalizeState(cached.provider().preparation.snapshot())).toEqual(normalizeState(cachedStock.provider().preparation.snapshot()));
  expect(cached.provider().preparation.snapshot().phase).toBe("standby");
  expect(cached.provider().preparation.snapshot().steps.map((step: any) => [step.kind, step.status])).toEqual([
    ["check", "complete"],
    ["verify", "complete"],
    ["load", "pending"],
  ]);
  const empty = await boot(ours, configOf({ modelDirectory: undefined, vadModelPath: undefined }));
  const emptyStock = await boot(stock, configOf({ modelDirectory: undefined, vadModelPath: undefined }));
  expect(normalizeState(empty.provider().preparation.snapshot())).toEqual(normalizeState(emptyStock.provider().preparation.snapshot()));
  expect(empty.provider().preparation.snapshot().phase).toBe("unprepared");
  expect(empty.provider().preparation.snapshot().steps.map((step: any) => [step.kind, step.status])).toEqual([
    ["check", "complete"],
    ["model", "pending"],
    ["vad", "pending"],
    ["verify", "pending"],
    ["load", "pending"],
  ]);
});

test("seam subprocess GIẢ: spec spawn (argv/cwd/env/stdio/graceMs) khớp stock", async () => {
  const mine = await boot(ours, configOf(), [handleOf()]);
  const theirs = await boot(stock, configOf(), [handleOf()]);
  const mineState = await prepare(mine);
  const theirsState = await prepare(theirs);
  expect(mineState.phase).toBe("ready");
  expect(normalizeState(mineState)).toEqual(normalizeState(theirsState));
  expect(mine.spawns).toHaveLength(1);
  expect(theirs.spawns).toHaveLength(1);
  expect(spawnFacts(mine.spawns[0])).toEqual(spawnFacts(theirs.spawns[0]));
  const spec = mine.spawns[0];
  expect(spec.argv[0]).toBe(process.execPath);
  expect(basename(spec.argv[1])).toBe("worker.js");
  expect(spec.cwd).toBe(DATA);
  expect(spec.env.DSH_SPEECH_TOKEN).toMatch(/^[a-f0-9]{64}$/u);
  expect(spec.env.ELECTRON_RUN_AS_NODE).toBe("1");
  expect(spec.stdio).toEqual({ stdin: "ignore", stdout: "pipe", stderr: { maxBytes: 65536 } });
  expect(spec.graceMs).toBe(1000);
  expect(mine.spawns[0].env.DSH_SPEECH_TOKEN).not.toBe(theirs.spawns[0].env.DSH_SPEECH_TOKEN);
});

test("seam subprocess GIẢ: 3 nhánh parse khung sẵn sàng hỏng cho CÙNG lỗi + state", async () => {
  const branches: Array<[string, { frame?: string; stderr?: string; exitEarly?: boolean }]> = [
    ["JSON hỏng", { frame: "{khong-phai-json}\n" }],
    ["vượt hạn byte", { frame: "x".repeat(200) + "\n" }],
    ["thoát trước sẵn sàng", { exitEarly: true, stderr: "sherpa-onnx-node: model missing" }],
  ];
  for (const [label, options] of branches) {
    const config = configOf({ maxLogBytes: 64 });
    const mine = await boot(ours, config, [handleOf(options)]);
    const theirs = await boot(stock, config, [handleOf(options)]);
    const mineState = await prepare(mine);
    const theirsState = await prepare(theirs);
    expect({ label, phase: mineState.phase }).toEqual({ label, phase: theirsState.phase });
    expect({ label, state: normalizeState(mineState) }).toEqual({ label, state: normalizeState(theirsState) });
    expect(mineState.phase).toBe("failed");
    expect({ label, message: mineState.message }).toEqual({ label, message: theirsState.message });
    expect(mine.handles[0]?.terminated()).toBe(1);
    expect(theirs.handles[0]?.terminated()).toBe(1);
  }
});

test("seam subprocess GIẢ: transcribe THÀNH CÔNG — kết quả + vết gọi HTTP + state khớp stock", async () => {
  const respond = (): Response => json(200, { text: "xin chào thế giới", audioSeconds: 1.5, inferenceSeconds: 0.25 });
  const mine = await boot(ours, configOf(), [handleOf()]);
  const theirs = await boot(stock, configOf(), [handleOf()]);
  const mineRun = await transcribeOf(mine.provider(), INPUT, respond);
  const theirsRun = await transcribeOf(theirs.provider(), INPUT, respond);
  expect(mineRun.result).toEqual(theirsRun.result);
  expect(mineRun.result).toEqual({ text: "xin chào thế giới", audioSeconds: 1.5, inferenceSeconds: 0.25 });
  expect(mineRun.failure).toBeUndefined();
  expect(callsFacts(mineRun.calls)).toEqual(callsFacts(theirsRun.calls));
  expect(mineRun.calls[0]?.url).toBe("http://127.0.0.1:45123/transcribe?language=en");
  expect(mineRun.calls[0]?.method).toBe("POST");
  expect(mineRun.calls[0]?.authorization).toMatch(/^Bearer [a-f0-9]{64}$/u);
  expect(mineRun.calls[0]?.contentType).toBe("audio/wav");
  expect(mineRun.calls[0]?.bytes).toBe(AUDIO.length);
  expect(normalizeState(mine.provider().preparation.snapshot())).toEqual(normalizeState(theirs.provider().preparation.snapshot()));
  expect(mine.provider().preparation.snapshot().phase).toBe("ready");
});

test("seam subprocess GIẢ: transcribe THẤT BẠI — 400 invalid-input · 500 · schema chặt · hàng đợi đầy", async () => {
  const responders: Record<string, () => Response> = {
    "400 invalid-input": () => json(400, { error: "Unsupported SenseVoice language", code: "invalid-input" }),
    "500 lỗi worker": () => json(500, { error: "decoder exploded" }),
    "200 thừa trường": () => json(200, { text: "a", audioSeconds: 1, inferenceSeconds: 1, extra: true }),
  };
  for (const [label, respond] of Object.entries(responders)) {
    const mine = await boot(ours, configOf(), [handleOf(), handleOf()]);
    const theirs = await boot(stock, configOf(), [handleOf(), handleOf()]);
    const mineRun = await transcribeOf(mine.provider(), INPUT, respond);
    const theirsRun = await transcribeOf(theirs.provider(), INPUT, respond);
    expect({ label, failure: mineRun.failure }).toEqual({ label, failure: theirsRun.failure });
    expect({ label, calls: callsFacts(mineRun.calls) }).toEqual({ label, calls: callsFacts(theirsRun.calls) });
    expect({ label, state: normalizeState(mine.provider().preparation.snapshot()) }).toEqual({ label, state: normalizeState(theirs.provider().preparation.snapshot()) });
    expect(mineRun.result).toBeUndefined();
  }
  const full = configOf({ maxPending: 1 });
  const mine = await boot(ours, full, [handleOf(), handleOf()]);
  const theirs = await boot(stock, full, [handleOf(), handleOf()]);
  const fake = fetchFake(() => json(200, { text: "a", audioSeconds: 1, inferenceSeconds: 1 }));
  const signal = new AbortController().signal;
  const first = mine.provider().transcribe(INPUT, signal);
  const firstStock = theirs.provider().transcribe(INPUT, signal);
  const second = await failureOf(() => mine.provider().transcribe(INPUT, signal));
  const secondStock = await failureOf(() => theirs.provider().transcribe(INPUT, signal));
  const firstResult = await first;
  const firstStockResult = await firstStock;
  fake.restore();
  expect(second).toEqual(secondStock);
  expect(second).not.toEqual(NO_FAILURE);
  expect(second.message).toBe("Speech transcription queue is full");
  expect(firstResult).toEqual(firstStockResult);
});

test("transcribe khi chưa chuẩn bị: CÙNG lỗi, KHÔNG spawn, state unprepared", async () => {
  const config = configOf({ modelDirectory: undefined, vadModelPath: undefined });
  const mine = await boot(ours, config);
  const theirs = await boot(stock, config);
  const mineRun = await transcribeOf(mine.provider(), INPUT, () => json(200, { text: "a", audioSeconds: 1, inferenceSeconds: 1 }));
  const theirsRun = await transcribeOf(theirs.provider(), INPUT, () => json(200, { text: "a", audioSeconds: 1, inferenceSeconds: 1 }));
  expect(mineRun.failure).toEqual(theirsRun.failure);
  expect(mineRun.failure?.message).toBe("Prepare the local speech provider before recording");
  expect(mineRun.calls).toHaveLength(0);
  expect(theirsRun.calls).toHaveLength(0);
  expect(mine.spawns).toHaveLength(0);
  expect(theirs.spawns).toHaveLength(0);
});

test("dispose: dừng worker ĐÚNG một lần terminate, state standby, khớp stock", async () => {
  const mine = await boot(ours, configOf(), [handleOf()]);
  const theirs = await boot(stock, configOf(), [handleOf()]);
  await prepare(mine);
  await prepare(theirs);
  await transcribeOf(mine.provider(), INPUT, () => json(200, { text: "a", audioSeconds: 1, inferenceSeconds: 1 }));
  await transcribeOf(theirs.provider(), INPUT, () => json(200, { text: "a", audioSeconds: 1, inferenceSeconds: 1 }));
  await mine.close();
  await theirs.close();
  expect(mine.provider().preparation.snapshot().phase).toBe("standby");
  expect(normalizeState(mine.provider().preparation.snapshot())).toEqual(normalizeState(theirs.provider().preparation.snapshot()));
  expect(mine.handles[0]?.terminated()).toBe(1);
  expect(theirs.handles[0]?.terminated()).toBe(1);
  await mine.close();
  expect(mine.handles[0]?.terminated()).toBe(1);
});

test("idleTimeoutMs: worker tự ngủ sau khi rảnh, state standby khớp stock", async () => {
  const config = configOf({ idleTimeoutMs: 25 });
  const mine = await boot(ours, config, [handleOf()]);
  const theirs = await boot(stock, config, [handleOf()]);
  await prepare(mine);
  await prepare(theirs);
  await transcribeOf(mine.provider(), INPUT, () => json(200, { text: "a", audioSeconds: 1, inferenceSeconds: 1 }));
  await transcribeOf(theirs.provider(), INPUT, () => json(200, { text: "a", audioSeconds: 1, inferenceSeconds: 1 }));
  const mineState = await waitPhase(mine.provider(), ["standby"]);
  const theirsState = await waitPhase(theirs.provider(), ["standby"]);
  expect(mineState.phase).toBe("standby");
  expect(normalizeState(mineState)).toEqual(normalizeState(theirsState));
  expect(mine.handles[0]?.terminated()).toBe(1);
  expect(theirs.handles[0]?.terminated()).toBe(1);
});
