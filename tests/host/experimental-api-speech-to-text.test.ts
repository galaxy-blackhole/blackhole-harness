/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-experimental-api-speech-to-text: build tạm ba entry bằng build.ts → mkdtemp, nạp lib/index.js + lib/typert.host.js + lib/typert.remote-client.js của ta và stock @deepseek-ai/dsh-experimental-api-speech-to-text, rồi so sâu export surface · TYPERT · TYPERT_REMOTE · service RPC trên Context thật với seam speechToText giả (catalog/follow/configure/prepare/cancelPreparation/transcribe + nhánh lỗi auth token/rate limit).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
// Phụ lục (j) tách tệp để giữ ≤1000 dòng/tệp — import side-effect, không xoá ca nào.
import "./experimental-api-speech-to-text-harness.ts";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "experimental-api-speech-to-text");
/** node_modules của kernel — nơi cả hai bản phân giải peer. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Thư mục package stock (CHỈ ĐỌC) — oracle. */
const STOCK_DIR = join(APP_MODULES, "@deepseek-ai", "dsh-experimental-api-speech-to-text");
/** cordis của kernel — hai bên dùng CHUNG một lớp Context/Service. */
const CORDIS = join(APP_MODULES, "@deepseek-ai", "cordis", "lib", "index.js");
/** typert-protocol của kernel — đọc marker @Remote của Service đang sống. */
const TYPERT_PROTOCOL = join(APP_MODULES, "@deepseek-ai", "dsh-typert-protocol", "lib", "index.js");
/** Id gói speech-to-text stock (peer seam). */
const SPEECH_ID = "@deepseek-ai/dsh-experimental-speech-to-text";
/** Id gói speech-to-text của TA — typeSymbol trong artefact trỏ bản GBH (rename CÓ CHỦ ĐÍCH, task-162). */
const OUR_SPEECH_ID = "@galaxy-blackhole/gbh-experimental-speech-to-text";
/** Thư mục artifact tạm; dọn ở afterAll. */
const OUT = mkdtempSync(join(tmpdir(), "gbh-experimental-api-speech-to-text-ab-"));
/** Nơi build tạm đặt lib/index.js + lib/typert.host.js + lib/typert.remote-client.js. */
const ARTIFACT = join(OUT, "lib");
/** package.json của ta (JSON thuần). */
const OUR_PKG = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PackageJson;
/** package.json của stock (JSON thuần). */
const STOCK_PKG = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as PackageJson;

/** Hình dạng tối thiểu của package.json mà test đọc. */
interface PackageJson {
  name?: string;
  exports?: Record<string, unknown>;
}

/** Lấy tên gói, đòi khai tường minh (không so với undefined). */
function packageName(pkg: PackageJson, label: string): string {
  if (pkg.name === undefined) throw new Error(label + ": package.json thiếu name");
  return pkg.name;
}

/** Id gói của ta — mọi manifest typert phải OWNED bởi id này. */
const OUR_ID = packageName(OUR_PKG, "ours");
/** Id gói stock — artfact của ta tuyệt đối không được chứa. */
const STOCK_ID = packageName(STOCK_PKG, "stock");

/** Namespace manifest host. */
interface HostModule {
  TYPERT: HostManifest;
}

/** Namespace manifest remote-client. */
interface RemoteModule {
  TYPERT_REMOTE: RemoteInfo;
  default: RemoteInfo;
}

/** Manifest host: dữ liệu JSON + getter invocations trả descriptor có hàm lazy. */
interface HostManifest {
  package: string;
  face?: string;
  schemas?: unknown[];
  invocations?: unknown;
  model: {
    services: { types: unknown[] }[];
    events: unknown[];
    objects: unknown[];
  };
}

/** Codec generated: create là hàm lazy trả schema zod; jsonSchema là dữ liệu JSON. */
interface Codec {
  mode?: string;
  typeSymbol?: string;
  create?: () => unknown;
  jsonSchema?: unknown;
}
/** Một parameter remote. */
interface RemoteParameter {
  name?: string;
  wire?: string;
  description?: string;
  source?: string;
  acceptsUndefined?: boolean;
  codec?: Codec;
  strictCodec?: Codec;
}
/** Một method remote (descriptor runtime có thêm id/input/invoke; spec chỉ có dữ liệu). */
interface RemoteMethod {
  service?: string;
  description?: string;
  implementation?: string;
  invocation?: unknown;
  mode?: string;
  scope?: unknown;
  parameters?: RemoteParameter[];
  cancellation?: unknown;
  result?: {
    mode?: string;
    typeSymbol?: string;
    description?: string;
    create?: () => unknown;
    jsonSchema?: unknown;
    jsonSchemaError?: string;
    spec?: { jsonSchema?: unknown };
  };
  sourceLocation?: unknown;
}

/** RemoteInfo do createTypertRemoteInfo() trả: getter package/methods/descriptors + spec gốc. */
interface RemoteInfo {
  package: string;
  methods: Record<string, RemoteMethod>;
  descriptors: unknown[];
  spec: {
    package?: string;
    methods?: Record<string, RemoteMethod>;
  };
}

/** Marker @Remote trên prototype (chỉ trường test so). */
interface RemoteMethodMarker {
  method?: string;
  mode?: string;
  invocation?: unknown;
}

/** Context cordis thật nhìn qua index signature để đọc service đã đăng ký. */
type ContextLike = Record<string, unknown>;

/** Cấu hình byte/thời lượng của controller. */
interface Config {
  maxAudioBytes: number;
  maxDurationSeconds: number;
}

/** Service speechController nhìn qua hình dạng test dùng. */
interface SpeechService {
  readonly ctx: ContextLike;
  readonly name: string;
  readonly typertRemote: { readonly serviceKey: string; readonly namespace: string };
  catalog(): unknown;
  follow(signal: AbortSignal): AsyncIterable<unknown>;
  configure(patch: unknown): Promise<void>;
  prepare(providerId: string, options?: unknown): void;
  cancelPreparation(providerId: string): Promise<void>;
  transcribe(request: TranscriptionRequest, signal: AbortSignal): Promise<Transcript>;
}

/** Constructor của SpeechController hai bản (kèm static của plugin). */
interface ServiceCtor {
  new (ctx: ContextLike, config: Config): SpeechService;
  readonly inject?: readonly string[];
  readonly Config?: (value: unknown) => Config;
}

/** Một lượt transcribe gửi lên controller. */
interface TranscriptionRequest {
  readonly audioBase64: string;
  readonly providerId?: string;
  readonly language?: string;
}

/** Kết quả transcribe. */
interface Transcript {
  readonly text: string;
  readonly audioSeconds: number;
  readonly inferenceSeconds: number;
}

/** Hình dạng tối thiểu của cordis mà test dùng. */
interface CordisModule {
  Context: new () => ContextLike;
  Service: new (ctx: never, name: string) => { readonly ctx: unknown };
}

/** cordis THẬT — SpeechController kế thừa TypertRemoteService nên cần Service/Context thật. */
const cordis = (await import(CORDIS)) as CordisModule;
/** typert-protocol THẬT — đọc marker @Remote. */
const protocol = (await import(TYPERT_PROTOCOL)) as {
  remoteMethods(service: unknown): RemoteMethodMarker[];
};

/** Ảnh chụp provider/selection mà seam giả trả. */
interface Snapshot {
  providers: readonly unknown[];
  selection: { providerId: string; language: string };
}

/** Nút vặn lỗi của seam giả (mô phỏng auth token/rate limit của provider). */
interface SeamOptions {
  frames?: readonly Snapshot[];
  resolveError?: string;
  transcribeError?: string;
  configureError?: string;
  prepareError?: string;
}

/** Một lời gọi vào seam, đã chuẩn hoá JSON để so A/B. */
interface SeamCall {
  method: string;
  args?: unknown;
}

/** Bản ghi hoàn chỉnh mà seam giả nhận từ resolve(). */
interface ResolvedRequest {
  audio: Uint8Array;
  provider?: { id: string };
  providerId?: string;
  language?: string;
}

/** Spec đã resolve mà seam giả nhận từ controller. */
interface ResolvedSpec {
  audio: Uint8Array;
  language: string;
  provider: { id: string };
}

/** Bản của ta nạp trong beforeAll. */
let oursIndex!: { default: ServiceCtor };
/** Bản stock nạp trong beforeAll. */
let stockIndex!: { default: ServiceCtor };
/** Manifest host của ta. */
let oursHost!: HostModule;
/** Manifest host stock. */
let stockHost!: HostModule;
/** Manifest remote-client của ta. */
let oursRemote!: RemoteModule;
/** Manifest remote-client stock. */
let stockRemote!: RemoteModule;
/** Constructor service của ta. */
let OURS_CTOR!: ServiceCtor;
/** Constructor service stock. */
let STOCK_CTOR!: ServiceCtor;

/** Đường dẫn ba artifact đã build. */
interface BuiltEntries {
  service: string;
  typertHost: string;
  typertRemoteClient: string;
}

/**
 * Build ba entry của gói vào ARTIFACT: ưu tiên buildPackage của build.ts, lùi về Bun.build từng entry.
 * Nhận: không.
 * Trả: đường dẫn tuyệt đối của service + hai manifest.
 */
async function buildArtifacts(): Promise<BuiltEntries> {
  const build = (await import(join(PKG, "build.ts"))) as {
    buildPackage?: (outDir?: string) => Promise<BuiltEntries>;
  };
  if (typeof build.buildPackage === "function") return build.buildPackage(ARTIFACT);
  const entries: [string, string][] = [
    ["src/index.ts", "index.js"],
    ["src/typert-host.ts", "typert.host.js"],
    ["src/typert-remote-client.ts", "typert.remote-client.js"],
  ];
  const paths: string[] = [];
  for (const [source, naming] of entries) {
    const result = await Bun.build({
      entrypoints: [join(PKG, source)],
      outdir: ARTIFACT,
      target: "node",
      format: "esm",
      naming,
      packages: "external",
    });
    if (!result.success) throw new Error("build " + naming + " thất bại: " + result.logs.map(String).join(" | "));
    paths.push(join(ARTIFACT, naming));
  }
  const [service, typertHost, typertRemoteClient] = paths;
  if (service === undefined || typertHost === undefined || typertRemoteClient === undefined) {
    throw new Error("build thiếu entry");
  }
  return { service, typertHost, typertRemoteClient };
}

beforeAll(async () => {
  const built = await buildArtifacts();
  // Hai manifest import zod/@deepseek-ai/dsh-typert-protocol từ kernel; artifact nằm ngoài repo nên
  // cần node_modules trỏ ngược apps/host/node_modules để phân giải peer y như bản stock.
  symlinkSync(APP_MODULES, join(OUT, "node_modules"), "dir");
  oursIndex = (await import(pathToFileURL(built.service).href)) as { default: ServiceCtor };
  oursHost = (await import(pathToFileURL(built.typertHost).href)) as HostModule;
  oursRemote = (await import(pathToFileURL(built.typertRemoteClient).href)) as RemoteModule;
  stockIndex = (await import(pathToFileURL(join(STOCK_DIR, "lib", "index.js")).href)) as { default: ServiceCtor };
  stockHost = (await import(pathToFileURL(join(STOCK_DIR, "lib", "typert.host.js")).href)) as HostModule;
  stockRemote = (await import(pathToFileURL(join(STOCK_DIR, "lib", "typert.remote-client.js")).href)) as RemoteModule;
  OURS_CTOR = oursIndex.default;
  STOCK_CTOR = stockIndex.default;
});

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

/**
 * Chuyển một giá trị manifest thành dữ liệu JSON thuần.
 * Nhận: value — object có thể chứa hàm lazy create hoặc getter.
 * Trả: bản JSON đã bỏ hàm/undefined, đúng phần dữ liệu thuần JSON cần so.
 */
function jsonData(value: unknown): unknown {
  const text = JSON.stringify(value);
  return text === undefined ? undefined : (JSON.parse(text) as unknown);
}

/**
 * Đổi id gói stock sang id của ta trong dữ liệu JSON: manifest TYPERT phải OWNED bởi gói export nó.
 * Quy cả typeSymbol của gói peer speech-to-text sang id GBH (rename CÓ CHỦ ĐÍCH — artefact trỏ id ta).
 * Nhận: value — dữ liệu JSON của stock.
 * Trả: bản đã align ownership id, phần còn lại giữ nguyên.
 */
function alignStock<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).split(STOCK_ID).join(OUR_ID).split(SPEECH_ID).join(OUR_SPEECH_ID)) as T;
}

/**
 * Đếm số lần xuất hiện của một chuỗi con.
 * Nhận: haystack — văn bản; needle — chuỗi con.
 * Trả: số lần xuất hiện.
 */
function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * Lấy đích thực của một entry exports (string hoặc object có default).
 * Nhận: entry — giá trị trong package.json exports.
 * Trả: đường dẫn tương đối, hoặc undefined nếu không nhận dạng được.
 */
function exportTarget(entry: unknown): string | undefined {
  if (typeof entry === "string") return entry;
  if (entry !== null && typeof entry === "object") {
    const fallback = (entry as { default?: unknown }).default;
    if (typeof fallback === "string") return fallback;
  }
  return undefined;
}

/**
 * Lấy một method theo key, đòi có mặt ở cả hai bên.
 * Nhận: info — TYPERT_REMOTE; key — tên method; side — nhãn để báo lỗi.
 * Trả: descriptor method.
 */
function pickMethod(info: RemoteInfo, key: string, side: string): RemoteMethod {
  const method = info.methods[key];
  assert.ok(method !== undefined, side + ": thiếu method " + key);
  return method;
}

/**
 * Gọi hàm create() của codec/result để lấy schema zod, đòi hàm tồn tại.
 * Nhận: owner — codec hoặc result; label — nhãn để báo lỗi.
 * Trả: schema zod.
 */
function createSchema(owner: { create?: () => unknown } | undefined, label: string): unknown {
  assert.ok(owner !== undefined && typeof owner.create === "function", label + ": thiếu create()");
  return owner.create();
}

/** Kết quả safeParse đã chuẩn hoá để so A/B. */
type ParseOutcome = { ok: true; value: unknown } | { ok: false; issues: unknown };

/**
 * Chạy safeParse và giữ đúng success/value hoặc error/issues.
 * Nhận: schema — schema zod; input — dữ liệu thử.
 * Trả: outcome chuẩn hoá.
 */
function parseSchema(schema: unknown, input: unknown): ParseOutcome {
  const result = (schema as { safeParse(value: unknown): { success: boolean; data?: unknown; error?: { issues?: unknown } } }).safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, issues: result.error?.issues };
}

/**
 * So hành vi safeParse của schema ta với stock trên CÙNG input.
 * Nhận: label — tên ca; oursSchema/stockSchema — schema hai bên; input — dữ liệu thử.
 * Trả: không; ném assertion nếu success/value/issues khác.
 */
function assertSameParse(label: string, oursSchema: unknown, stockSchema: unknown, input: unknown): void {
  const ours = parseSchema(oursSchema, input);
  const stock = parseSchema(stockSchema, input);
  assert.strictEqual(ours.ok, stock.ok, label + ": success phải khớp");
  if (ours.ok && stock.ok) assert.deepStrictEqual(ours.value, stock.value, label + ": data");
  else if (!ours.ok && !stock.ok) assert.deepStrictEqual(ours.issues, stock.issues, label + ": issues");
}

/** Ảnh chụp provider mặc định dùng chung cho mọi ca. */
const SNAPSHOT: Snapshot = {
  providers: [
    {
      id: "sensevoice",
      name: "SenseVoice",
      location: "host-local",
      languages: ["auto", "vi"],
      preparation: { phase: "ready" },
    },
  ],
  selection: { providerId: "sensevoice", language: "auto" },
};

/** Ảnh chụp thứ hai (đang tải) để chứng minh follow stream nhiều frame. */
const SNAPSHOT_LOADING: Snapshot = {
  providers: [
    {
      id: "sensevoice",
      name: "SenseVoice",
      location: "host-local",
      languages: ["auto", "vi"],
      preparation: { phase: "loading", startedAt: 1_700_000_000_000 },
    },
  ],
  selection: { providerId: "sensevoice", language: "vi" },
};

/** Cấu hình mặc định của test: 2 giây để nhánh "quá thời lượng" tất định, không cần audio thật. */
const CONFIG: Config = { maxAudioBytes: 4 * 1024 * 1024, maxDurationSeconds: 2 };

/** Seam speechToText GIẢ: ghi lại lời gọi, trả dữ liệu tất định, không chạm mạng/model. */
class FakeSpeechToText extends cordis.Service {
  /** Nút vặn lỗi + frame follow. */
  readonly seam: SeamOptions;
  /** Nhật ký lời gọi, JSON-safe để so A/B. */
  readonly calls: SeamCall[] = [];

  /**
   * Đăng ký seam dưới key speechToText trên Context thật.
   * Nhận: ctx — Context cordis thật; seam — nút vặn lỗi/frame.
   */
  constructor(ctx: ContextLike, seam: SeamOptions) {
    super(ctx as never, "speechToText");
    this.seam = seam;
  }

  /** Trả ảnh chụp provider/selection hiện tại. */
  snapshot(): Snapshot {
    this.calls.push({ method: "snapshot" });
    return jsonData(SNAPSHOT) as Snapshot;
  }

  /** Phát các frame đã cấu hình (mặc định đủ hai frame). */
  async *follow(signal: AbortSignal): AsyncIterable<Snapshot> {
    this.calls.push({ method: "follow" });
    for (const frame of this.seam.frames ?? [SNAPSHOT, SNAPSHOT_LOADING]) yield jsonData(frame) as Snapshot;
  }

  /** Ghi nhận preference; ném lỗi cấu hình nếu có. */
  async configure(patch: unknown): Promise<void> {
    this.calls.push({ method: "configure", args: patch });
    if (this.seam.configureError !== undefined) throw new Error(this.seam.configureError);
  }

  /** Ghi nhận yêu cầu chuẩn bị; ném lỗi cấu hình nếu có. */
  prepare(providerId: string, options?: unknown): void {
    this.calls.push({ method: "prepare", args: { providerId, options } });
    if (this.seam.prepareError !== undefined) throw new Error(this.seam.prepareError);
  }

  /** Ghi nhận yêu cầu huỷ chuẩn bị. */
  async cancelPreparation(providerId: string): Promise<void> {
    this.calls.push({ method: "cancelPreparation", args: providerId });
  }

  /** Ghi nhận request đã giải mã; ném lỗi provider-lạ nếu có, ngược lại trả spec đã pin provider. */
  resolve(request: ResolvedRequest): ResolvedSpec {
    this.calls.push({
      method: "resolve",
      args: {
        audioLength: request.audio.length,
        providerId: request.providerId ?? null,
        language: request.language ?? null,
      },
    });
    if (this.seam.resolveError !== undefined) throw new Error(this.seam.resolveError);
    return {
      audio: request.audio,
      language: request.language ?? "auto",
      provider: { id: request.providerId ?? "sensevoice" },
    };
  }

  /** Ghi nhận spec; ném lỗi auth token/rate limit nếu có, ngược lại trả transcript tất định. */
  async transcribe(spec: ResolvedSpec, signal: AbortSignal): Promise<Transcript> {
    this.calls.push({ method: "transcribe", args: { audioLength: spec.audio.length, language: spec.language } });
    if (this.seam.transcribeError !== undefined) throw new Error(this.seam.transcribeError);
    return { text: "xin chào", audioSeconds: (spec.audio.length - 44) / 32_000, inferenceSeconds: 0.25 };
  }
}

/** Giàn đo của MỘT bên: Context thật + seam giả + service đã dựng. */
interface Rig {
  ctx: ContextLike;
  seam: FakeSpeechToText;
  service: SpeechService;
}

/**
 * Dựng giàn đo với lớp của một bên, trên Context cordis MỚI.
 * Nhận: ctor — SpeechController; seam — nút vặn lỗi; config — giới hạn byte/giây.
 * Trả: giàn đo.
 */
function rig(ctor: ServiceCtor, seam: SeamOptions = {}, config: Config = CONFIG): Rig {
  const ctx = new cordis.Context();
  const fake = new FakeSpeechToText(ctx, seam);
  return { ctx, seam: fake, service: new ctor(ctx, config) };
}

/** Kết quả/lỗi đã chuẩn hoá để so A/B. */
interface Outcome {
  ok: boolean;
  value?: unknown;
  name?: string;
  message?: string;
  code?: unknown;
  details?: unknown;
  cause?: string | null;
  marker?: boolean;
  isError?: boolean;
}

/**
 * Chạy một hàm và chụp value hoặc lỗi (name/message/code/details/cause/marker).
 * Nhận: run — hàm có thể ném đồng bộ hoặc trả Promise.
 * Trả: outcome chuẩn hoá.
 */
async function outcome(run: () => unknown): Promise<Outcome> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    const failure = error as Error & { code?: unknown; details?: unknown; isDSHRemoteError?: boolean };
    return {
      ok: false,
      name: failure.name,
      message: failure.message,
      code: failure.code,
      details: failure.details,
      cause: failure.cause === undefined ? null : String(failure.cause),
      marker: failure.isDSHRemoteError === true,
      isError: failure instanceof Error,
    };
  }
}

/** Kết quả một bên: outcome + nhật ký seam. */
interface SideResult {
  result: Outcome;
  calls: SeamCall[];
}

/**
 * Chạy CÙNG một kịch bản trên một constructor với giàn đo riêng.
 * Nhận: ctor — lớp của bên đó; run — kịch bản; config/seam — fixture.
 * Trả: outcome + nhật ký seam.
 */
async function runSide(ctor: ServiceCtor, run: (service: SpeechService) => unknown, config: Config, seam: SeamOptions): Promise<SideResult> {
  const station = rig(ctor, seam, config);
  const result = await outcome(() => run(station.service));
  return { result, calls: station.seam.calls };
}

/** Kết quả A/B của một kịch bản. */
interface BothResult {
  ours: Outcome;
  stock: Outcome;
  calls: SeamCall[];
}

/** Tuỳ chọn một ca A/B. */
interface BothOptions {
  seam?: SeamOptions;
  config?: Config;
}

/**
 * Gọi CẢ stock lẫn ours trên cùng fixture rồi so sâu outcome + nhật ký seam.
 * Nhận: label — tên ca; run — kịch bản; options — seam/config.
 * Trả: outcome hai bên (đã chứng minh bằng nhau) + nhật ký seam của ta.
 */
async function both(label: string, run: (service: SpeechService) => unknown, options: BothOptions = {}): Promise<BothResult> {
  const config = options.config ?? CONFIG;
  const seam = options.seam ?? {};
  const ours = await runSide(OURS_CTOR, run, config, seam);
  const stock = await runSide(STOCK_CTOR, run, config, seam);
  assert.deepStrictEqual(ours.calls, stock.calls, label + ": nhật ký seam");
  assert.deepStrictEqual(ours.result, stock.result, label + ": outcome");
  return { ours: ours.result, stock: stock.result, calls: ours.calls };
}

/**
 * Dựng một WAV chuẩn 16 kHz mono PCM16 (im lặng) — đủ header hợp lệ, không cần model thật.
 * Nhận: seconds — số giây PCM.
 * Trả: Buffer WAV hoàn chỉnh.
 */
function wav(seconds: number): Buffer {
  const data = Buffer.alloc(seconds * 32_000);
  const audio = Buffer.alloc(44 + data.length);
  audio.write("RIFF", 0, "ascii");
  audio.writeUInt32LE(audio.length - 8, 4);
  audio.write("WAVE", 8, "ascii");
  audio.write("fmt ", 12, "ascii");
  audio.writeUInt32LE(16, 16);
  audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(16_000, 24);
  audio.writeUInt32LE(32_000, 28);
  audio.writeUInt16LE(2, 32);
  audio.writeUInt16LE(16, 34);
  audio.write("data", 36, "ascii");
  audio.writeUInt32LE(data.length, 40);
  return audio;
}

/** Bản ghi một giây dùng cho mọi ca hợp lệ. */
const WAV = wav(1);

/**
 * Signal đã huỷ với lý do AbortError.
 * Nhận: không.
 * Trả: AbortSignal đã abort.
 */
function abortedSignal(): AbortSignal {
  const controller = new AbortController();
  controller.abort(new DOMException("stop", "AbortError"));
  return controller.signal;
}

describe("experimental-api-speech-to-text — export surface", () => {
  test("(a) index + TYPERT: đúng bề mặt như stock", () => {
    // Cả hai bản là module ESM chỉ export default (service), host chỉ export TYPERT.
    assert.deepStrictEqual(Object.keys(oursIndex).sort(), Object.keys(stockIndex).sort());
    assert.deepStrictEqual(Object.keys(oursIndex).sort(), ["default"]);
    assert.deepStrictEqual(Object.keys(oursHost).sort(), Object.keys(stockHost).sort());
    assert.deepStrictEqual(Object.keys(oursHost).sort(), ["TYPERT"]);
    expect("default" in oursHost).toBe(false);
    expect("default" in stockHost).toBe(false);
  });

  test("(a2) TYPERT_REMOTE + default: cùng tên export và trùng tham chiếu như stock", () => {
    assert.deepStrictEqual(Object.keys(oursRemote).sort(), Object.keys(stockRemote).sort());
    assert.deepStrictEqual(Object.keys(oursRemote).sort(), ["TYPERT_REMOTE", "default"]);
    assert.strictEqual(oursRemote.default, oursRemote.TYPERT_REMOTE);
    assert.strictEqual(stockRemote.default, stockRemote.TYPERT_REMOTE);
  });
});

describe("experimental-api-speech-to-text — TYPERT host", () => {
  test("(b) TYPERT: dữ liệu JSON DEEP EQUAL stock sau align ownership id", () => {
    assert.deepStrictEqual(jsonData(oursHost.TYPERT), alignStock(jsonData(stockHost.TYPERT)));
    // Ownership: manifest của ta phải mang id CỦA TA (typert-loader từ chối id stock).
    assert.strictEqual(oursHost.TYPERT.package, OUR_ID);
    assert.strictEqual(stockHost.TYPERT.package, STOCK_ID);
    // Chốt thêm dữ liệu thuần JSON: không còn hàm nào sau chuẩn hoá.
    assert.deepStrictEqual(jsonData(jsonData(oursHost.TYPERT)), jsonData(oursHost.TYPERT));
  });

  test("(b2) model: services[*].types + events + objects EQUAL stock", () => {
    const oursModel = oursHost.TYPERT.model;
    const stockModel = stockHost.TYPERT.model;
    assert.deepStrictEqual(alignStock(jsonData(oursModel)), jsonData(stockModel));
    assert.deepStrictEqual(Object.keys(jsonData(oursModel) as object).sort(), ["events", "objects", "services"]);
    assert.deepStrictEqual(oursModel.services.map((service) => service.types), stockModel.services.map((service) => service.types));
    assert.deepStrictEqual(oursModel.events, stockModel.events);
    assert.deepStrictEqual(oursModel.objects, stockModel.objects);
    expect(oursModel.services.every((service) => Array.isArray(service.types))).toBe(true);
  });
});

describe("experimental-api-speech-to-text — TYPERT_REMOTE", () => {
  /** Các trường method cần so (không chứa ownership id). */
  function methodFacts(method: RemoteMethod): unknown {
    return {
      service: method.service,
      description: method.description,
      implementation: method.implementation,
      invocation: method.invocation,
      mode: method.mode,
      scope: method.scope,
      cancellation: method.cancellation,
      sourceLocation: method.sourceLocation,
      parameters: (method.parameters ?? []).map((parameter) => ({
        name: parameter.name,
        wire: parameter.wire,
        description: parameter.description,
        source: parameter.source,
        acceptsUndefined: parameter.acceptsUndefined,
      })),
    };
  }

  test("(c) package, methods, trường method, scopes, cancellation EQUAL stock", () => {
    const ours = oursRemote.TYPERT_REMOTE;
    const stock = stockRemote.TYPERT_REMOTE;
    assert.strictEqual(ours.package, OUR_ID);
    assert.strictEqual(stock.package, STOCK_ID);
    assert.deepStrictEqual(Object.keys(ours.methods).sort(), Object.keys(stock.methods).sort());
    for (const key of Object.keys(stock.methods).sort()) {
      assert.deepStrictEqual(methodFacts(pickMethod(ours, key, "ours")), methodFacts(pickMethod(stock, key, "stock")), key);
    }
    assert.deepStrictEqual(Object.keys(ours.spec).sort(), Object.keys(stock.spec).sort());
    assert.deepStrictEqual(jsonData(ours.methods), alignStock(jsonData(stock.methods)));
  });

  test("(c2) jsonSchema parameter + result EQUAL stock (deep)", () => {
    for (const key of Object.keys(stockRemote.TYPERT_REMOTE.methods).sort()) {
      const oursMethod = pickMethod(oursRemote.TYPERT_REMOTE, key, "ours");
      const stockMethod = pickMethod(stockRemote.TYPERT_REMOTE, key, "stock");
      const oursParameters = oursMethod.parameters ?? [];
      const stockParameters = stockMethod.parameters ?? [];
      assert.deepStrictEqual(oursParameters.length, stockParameters.length, key + ": số parameter");
      for (let index = 0; index < stockParameters.length; index += 1) {
        const oursParameter = oursParameters[index];
        const stockParameter = stockParameters[index];
        assert.ok(oursParameter !== undefined && stockParameter !== undefined, key + ": parameter[" + index + "] thiếu");
        assert.deepStrictEqual(oursParameter.codec?.jsonSchema, stockParameter.codec?.jsonSchema, key + ": codec.jsonSchema");
        assert.deepStrictEqual(oursParameter.strictCodec?.jsonSchema, stockParameter.strictCodec?.jsonSchema, key + ": strictCodec.jsonSchema");
        assert.deepStrictEqual(jsonData(oursParameter.codec), alignStock(jsonData(stockParameter.codec)), key + ": toàn bộ codec");
        assert.deepStrictEqual(jsonData(oursParameter.strictCodec), alignStock(jsonData(stockParameter.strictCodec)), key + ": toàn bộ strictCodec");
      }
      assert.deepStrictEqual(oursMethod.result?.jsonSchema, stockMethod.result?.jsonSchema, key + ": result.jsonSchema");
      assert.deepStrictEqual(oursMethod.result?.spec?.jsonSchema, stockMethod.result?.spec?.jsonSchema, key + ": result.spec.jsonSchema");
      assert.deepStrictEqual(oursMethod.result?.jsonSchemaError, stockMethod.result?.jsonSchemaError, key + ": jsonSchemaError");
      assert.deepStrictEqual(jsonData(oursMethod.result), alignStock(jsonData(stockMethod.result)), key + ": toàn bộ result");
    }
  });

  test("(c3) descriptors runtime EQUAL stock; id mang OUR id, không có id stock", () => {
    const ours = jsonData(oursRemote.TYPERT_REMOTE.descriptors);
    const stock = alignStock(jsonData(stockRemote.TYPERT_REMOTE.descriptors));
    assert.deepStrictEqual(ours, stock);
    assert.deepStrictEqual(
      (oursRemote.TYPERT_REMOTE.descriptors as { id?: string }[]).map((descriptor) => descriptor.id),
      (stockRemote.TYPERT_REMOTE.descriptors as { id?: string }[]).map((descriptor) => OUR_ID + String(descriptor.id).slice(STOCK_ID.length)),
    );
    for (const descriptor of oursRemote.TYPERT_REMOTE.descriptors as { id?: string }[]) {
      assert.ok(descriptor.id !== undefined && descriptor.id.startsWith(OUR_ID + "#"), "descriptor id phải mang OUR id");
      assert.strictEqual(descriptor.id.includes(STOCK_ID), false);
    }
  });

  test("(c4) schema zod generated: cùng safeParse transcribe request/result", () => {
    const oursMethod = pickMethod(oursRemote.TYPERT_REMOTE, "speech/transcribe", "ours");
    const stockMethod = pickMethod(stockRemote.TYPERT_REMOTE, "speech/transcribe", "stock");
    const oursRequest = pickMethodParameter(oursMethod, 0, "ours");
    const stockRequest = pickMethodParameter(stockMethod, 0, "stock");
    const oursRequestSchema = createSchema(oursRequest.codec, "ours.request");
    const stockRequestSchema = createSchema(stockRequest.codec, "stock.request");
    assertSameParse("request hợp lệ", oursRequestSchema, stockRequestSchema, { audioBase64: "AAAA" });
    assertSameParse("request thiếu audio", oursRequestSchema, stockRequestSchema, {});
    assertSameParse("request sai kiểu", oursRequestSchema, stockRequestSchema, { audioBase64: 1 });
    const oursResultSchema = createSchema(oursMethod.result, "ours.result");
    const stockResultSchema = createSchema(stockMethod.result, "stock.result");
    assertSameParse("result hợp lệ", oursResultSchema, stockResultSchema, { text: "x", audioSeconds: 1, inferenceSeconds: 0.5 });
    assertSameParse("result thiếu field", oursResultSchema, stockResultSchema, { text: "x" });
  });
});

describe("experimental-api-speech-to-text — package.json + ownership", () => {
  test("(d) exports './typert' + './remote' trỏ lib/*.js như stock", () => {
    const oursExports = OUR_PKG.exports ?? {};
    const stockExports = STOCK_PKG.exports ?? {};
    assert.deepStrictEqual(exportTarget(oursExports["./typert"]), exportTarget(stockExports["./typert"]));
    assert.deepStrictEqual(exportTarget(oursExports["./remote"]), exportTarget(stockExports["./remote"]));
    assert.deepStrictEqual(exportTarget(oursExports["."]), exportTarget(stockExports["."]));
    assert.strictEqual(exportTarget(oursExports["./typert"]), "./lib/typert.host.js");
    assert.strictEqual(exportTarget(oursExports["./remote"]), "./lib/typert.remote-client.js");
    expect(existsSync(join(ARTIFACT, "typert.host.js"))).toBe(true);
    expect(existsSync(join(ARTIFACT, "typert.remote-client.js"))).toBe(true);
  });

  test("(d2) ownership: artifact của ta 0 id stock, manifest mang OUR id; stock đối xứng", () => {
    const artifacts = readdirSync(ARTIFACT)
      .filter((file) => file.endsWith(".js"))
      .sort();
    assert.deepStrictEqual(artifacts, ["index.js", "typert.host.js", "typert.remote-client.js"]);
    for (const file of artifacts) {
      assert.strictEqual(countOf(readFileSync(join(ARTIFACT, file), "utf8"), STOCK_ID), 0, file + " còn id stock");
    }
    for (const file of ["typert.host.js", "typert.remote-client.js"]) {
      const oursOwned = countOf(readFileSync(join(ARTIFACT, file), "utf8"), OUR_ID);
      assert.ok(oursOwned > 0, file + " thiếu OUR id");
      assert.strictEqual(oursOwned, countOf(readFileSync(join(STOCK_DIR, "lib", file), "utf8"), STOCK_ID), file + ": số id ownership");
    }
    // Stock cũng không tự nhắc id của mình trong index; hai index tham chiếu peer speech như nhau.
    // 08/11/2026 (§2b R6a): index của TA đổi peer speech sang id GBH ⇒ đếm theo id TƯƠNG ỨNG (OUR_SPEECH_ID ↔ SPEECH_ID).
    assert.strictEqual(countOf(readFileSync(join(STOCK_DIR, "lib", "index.js"), "utf8"), STOCK_ID), 0);
    assert.strictEqual(countOf(readFileSync(join(ARTIFACT, "index.js"), "utf8"), OUR_SPEECH_ID), countOf(readFileSync(join(STOCK_DIR, "lib", "index.js"), "utf8"), SPEECH_ID));
  });
});

describe("experimental-api-speech-to-text — service RPC trên Context thật", () => {
  test("(e) speechController + binding namespace speech + inject/Config/marker EQUAL stock", () => {
    const mine = rig(OURS_CTOR);
    const theirs = rig(STOCK_CTOR);
    const oursRegistered = mine.ctx.speechController as SpeechService | undefined;
    const stockRegistered = theirs.ctx.speechController as SpeechService | undefined;
    assert.ok(oursRegistered !== undefined && stockRegistered !== undefined);
    assert.deepStrictEqual(
      { name: oursRegistered.name, namespace: oursRegistered.typertRemote.namespace },
      { name: stockRegistered.name, namespace: stockRegistered.typertRemote.namespace },
    );
    assert.deepStrictEqual(
      { name: oursRegistered.name, namespace: oursRegistered.typertRemote.namespace },
      { name: "speechController", namespace: "speech" },
    );
    assert.deepStrictEqual(
      { serviceKey: mine.service.typertRemote.serviceKey, namespace: mine.service.typertRemote.namespace },
      { serviceKey: theirs.service.typertRemote.serviceKey, namespace: theirs.service.typertRemote.namespace },
    );
    assert.deepStrictEqual(
      { serviceKey: mine.service.typertRemote.serviceKey, namespace: mine.service.typertRemote.namespace },
      { serviceKey: "speechController", namespace: "speech" },
    );
    assert.strictEqual(mine.service.name, theirs.service.name);
    assert.deepStrictEqual(OURS_CTOR.inject, STOCK_CTOR.inject);
    assert.ok(OURS_CTOR.Config !== undefined && STOCK_CTOR.Config !== undefined);
    assert.strictEqual(String(OURS_CTOR.Config), String(STOCK_CTOR.Config));
    assert.deepStrictEqual(OURS_CTOR.Config({}), STOCK_CTOR.Config({}));
    assert.deepStrictEqual(OURS_CTOR.Config({}), { maxAudioBytes: 4 * 1024 * 1024, maxDurationSeconds: 120 });
    const oursMarkers = protocol.remoteMethods(mine.service);
    assert.deepStrictEqual(jsonData(oursMarkers), jsonData(protocol.remoteMethods(theirs.service)));
    assert.deepStrictEqual(
      oursMarkers.map((marker) => marker.method),
      ["catalog", "follow", "configure", "prepare", "cancelPreparation", "transcribe"],
    );
    assert.deepStrictEqual(oursMarkers.map((marker) => marker.mode ?? null), [null, "stream", null, null, null, null]);
  });

  test("(f) catalog: snapshot + config EQUAL stock", async () => {
    const { ours } = await both("catalog", (service) => service.catalog());
    assert.deepStrictEqual(ours.value, { ...SNAPSHOT, ...CONFIG });
  });

  test("(f2) follow: stream nhiều frame + config EQUAL stock", async () => {
    const { ours, calls } = await both("follow", async (service) => {
      const frames: unknown[] = [];
      for await (const frame of service.follow(new AbortController().signal)) frames.push(frame);
      return frames;
    });
    assert.deepStrictEqual(ours.value, [
      { ...SNAPSHOT, ...CONFIG },
      { ...SNAPSHOT_LOADING, ...CONFIG },
    ]);
    assert.deepStrictEqual(calls, [{ method: "follow" }]);
  });

  test("(f3) configure/prepare/cancelPreparation: chuyển tiếp seam EQUAL stock", async () => {
    const { ours, calls } = await both("chuyển tiếp", async (service) => {
      await service.configure({ providerId: "sensevoice", language: "vi" });
      service.prepare("sensevoice", { downloadSource: "mirror" });
      await service.cancelPreparation("sensevoice");
      return "ok";
    });
    assert.deepStrictEqual(ours.value, "ok");
    assert.deepStrictEqual(calls, [
      { method: "configure", args: { providerId: "sensevoice", language: "vi" } },
      { method: "prepare", args: { providerId: "sensevoice", options: { downloadSource: "mirror" } } },
      { method: "cancelPreparation", args: "sensevoice" },
    ]);
  });

  test("(f4) configure/prepare lỗi seam: cùng lỗi thô EQUAL stock", async () => {
    const configure = await both("configure lỗi", (service) => service.configure({ language: "vi" }), {
      seam: { configureError: "Speech selection requires the settings service and a profile entry" },
    });
    assert.strictEqual(configure.ours.ok, false);
    assert.strictEqual(configure.ours.name, "Error");
    assert.strictEqual(configure.ours.message, "Speech selection requires the settings service and a profile entry");
    const prepare = await both("prepare lỗi", (service) => service.prepare("sensevoice"), {
      seam: { prepareError: "Speech provider is unavailable: sensevoice" },
    });
    assert.strictEqual(prepare.ours.ok, false);
    assert.strictEqual(prepare.ours.message, "Speech provider is unavailable: sensevoice");
  });

  test("(g) transcribe WAV hợp lệ: transcript + spec EQUAL stock", async () => {
    const { ours, calls } = await both("transcribe hợp lệ", (service) =>
      service.transcribe({ audioBase64: WAV.toString("base64"), providerId: "sensevoice", language: "vi" }, new AbortController().signal),
    );
    assert.deepStrictEqual(ours.value, { text: "xin chào", audioSeconds: 1, inferenceSeconds: 0.25 });
    assert.deepStrictEqual(calls, [
      { method: "resolve", args: { audioLength: WAV.length, providerId: "sensevoice", language: "vi" } },
      { method: "transcribe", args: { audioLength: WAV.length, language: "vi" } },
    ]);
  });

  test("(g2) transcribe mặc định provider/language: spec do seam resolve EQUAL stock", async () => {
    const { ours, calls } = await both("transcribe mặc định", (service) =>
      service.transcribe({ audioBase64: WAV.toString("base64") }, new AbortController().signal),
    );
    assert.deepStrictEqual(ours.value, { text: "xin chào", audioSeconds: 1, inferenceSeconds: 0.25 });
    assert.deepStrictEqual(calls, [
      { method: "resolve", args: { audioLength: WAV.length, providerId: null, language: null } },
      { method: "transcribe", args: { audioLength: WAV.length, language: "auto" } },
    ]);
  });

  test("(h) transcribe input hỏng: base64/WAV/thời lượng → RemoteError EQUAL stock", async () => {
    const scenarios: { label: string; request: TranscriptionRequest; message: string }[] = [
      { label: "base64 không chuẩn", request: { audioBase64: "AAA" }, message: "Audio must use canonical base64 encoding" },
      {
        label: "WAV hỏng",
        request: { audioBase64: Buffer.alloc(46).toString("base64") },
        message: "Audio must be a canonical 16 kHz mono PCM16 WAV recording",
      },
      { label: "quá thời lượng", request: { audioBase64: wav(3).toString("base64") }, message: "Audio exceeds 2 seconds" },
    ];
    for (const scenario of scenarios) {
      const { ours, calls } = await both(scenario.label, (service) => service.transcribe(scenario.request, new AbortController().signal));
      assert.strictEqual(ours.ok, false, scenario.label);
      assert.strictEqual(ours.name, "RemoteError", scenario.label);
      assert.strictEqual(ours.code, "speech/transcription-failed", scenario.label);
      assert.strictEqual(ours.message, scenario.message, scenario.label);
      assert.deepStrictEqual(ours.details, { reason: scenario.message }, scenario.label);
      assert.strictEqual(ours.cause, null, scenario.label);
      assert.strictEqual(ours.marker, true, scenario.label);
      assert.deepStrictEqual(calls, [], scenario.label + ": không chạm seam");
    }
  });

  test("(h2) transcribe quá byte: speech/invalid-audio EQUAL stock, chặn trước base64", async () => {
    const { ours, calls } = await both(
      "quá byte",
      (service) => service.transcribe({ audioBase64: "A".repeat(65) }, new AbortController().signal),
      { config: { maxAudioBytes: 48, maxDurationSeconds: 1 } },
    );
    assert.strictEqual(ours.ok, false);
    assert.strictEqual(ours.name, "RemoteError");
    assert.strictEqual(ours.code, "speech/invalid-audio");
    assert.strictEqual(ours.message, "Audio is invalid or exceeds the configured byte limit");
    assert.deepStrictEqual(ours.details, { reason: "encoding-or-size" });
    assert.deepStrictEqual(calls, []);
  });

  test("(h3) signal đã huỷ: AbortError EQUAL stock, không chạm seam", async () => {
    const { ours, calls } = await both("huỷ", (service) =>
      service.transcribe({ audioBase64: WAV.toString("base64") }, abortedSignal()),
    );
    assert.strictEqual(ours.ok, false);
    assert.strictEqual(ours.name, "AbortError");
    assert.strictEqual(ours.message, "stop");
    assert.deepStrictEqual(calls, []);
  });

  test("(i) seam lỗi auth token + rate limit: speech/transcription-failed EQUAL stock", async () => {
    for (const message of ["Provider rejected the authentication token", "Provider rate limit exceeded; retry after 30s"]) {
      const { ours, calls } = await both(
        "seam: " + message,
        (service) => service.transcribe({ audioBase64: WAV.toString("base64"), providerId: "sensevoice" }, new AbortController().signal),
        { seam: { transcribeError: message } },
      );
      assert.strictEqual(ours.ok, false);
      assert.strictEqual(ours.name, "RemoteError");
      assert.strictEqual(ours.code, "speech/transcription-failed");
      assert.strictEqual(ours.message, message);
      assert.deepStrictEqual(ours.details, { reason: message });
      assert.strictEqual(ours.marker, true);
      assert.deepStrictEqual(calls.map((call) => call.method), ["resolve", "transcribe"]);
    }
  });

  test("(i2) seam resolve lỗi provider lạ: speech/transcription-failed EQUAL stock", async () => {
    const message = "Speech provider is unavailable: nope";
    const { ours, calls } = await both(
      "provider lạ",
      (service) => service.transcribe({ audioBase64: WAV.toString("base64"), providerId: "nope" }, new AbortController().signal),
      { seam: { resolveError: message } },
    );
    assert.strictEqual(ours.ok, false);
    assert.strictEqual(ours.code, "speech/transcription-failed");
    assert.strictEqual(ours.message, message);
    assert.deepStrictEqual(ours.details, { reason: message });
    assert.deepStrictEqual(calls.map((call) => call.method), ["resolve"]);
  });
});

/**
 * Lấy parameter theo vị trí của một method, đòi có mặt.
 * Nhận: method — descriptor method; index — vị trí; side — nhãn báo lỗi.
 * Trả: parameter.
 */
function pickMethodParameter(method: RemoteMethod, index: number, side: string): RemoteParameter {
  const parameter = (method.parameters ?? [])[index];
  assert.ok(parameter !== undefined, side + ": thiếu parameter[" + index + "]");
  return parameter;
}

