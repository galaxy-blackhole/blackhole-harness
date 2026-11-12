/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho nửa HOST của @galaxy-blackhole/gbh-experimental-inspector: bề mặt export · String(Config) ·
 *      resolveInspectorOptions trên 6 biến thể · captureFetch:false KHÔNG chạm globalThis.fetch · service inspector
 *      dựng trên Context cordis THẬT với port 0 loopback · bind lỗi (fail-soft ở mức Context, có log chẩn đoán).
 *      A = bundle gốc CHỈ ĐỌC trong apps/host; B = lib của ta, hoặc build từ build.ts vào mkdtemp rồi dọn.
 */

import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "../../packages/host/experimental-inspector/src/ids.ts";

/** Thư mục gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói đích của ta. */
const PKG = join(REPO, "packages", "host", "experimental-inspector");
/** Bundle gốc trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-experimental-inspector");
const STOCK = join(STOCK_PKG, "lib", "index.js");
/** Cordis THẬT của kernel — service inspector phải sống trên Context thật. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Lib CỦA TA (ưu tiên) và build script dự phòng. */
const OURS_LIB = join(PKG, "lib", "index.js");
const OURS_BUILD = join(PKG, "build.ts");
/** B chỉ chạy được khi có lib hoặc build.ts; thiếu cả hai thì các ca A/B SKIP có tên rõ. */
const HAS_OURS = existsSync(OURS_LIB) || existsSync(OURS_BUILD);
/** test có điều kiện: mọi ca so A/B đều đi qua đây. */
const bTest = test.skipIf(!HAS_OURS);
/** Peer runtime của gói, lấy đúng từ package.json (không tự đoán thêm). */
const PEER_PACKAGES: readonly string[] = [
  "@deepseek-ai/cordis",
  "@deepseek-ai/dsh-app-boot",
  "@deepseek-ai/dsh-util-crypto",
  "@deepseek-ai/schemastery",
  "open",
  "serve-static",
  "ws",
];

/** Kiểu của globalThis.fetch để so danh tính trước/sau mà không cần DOM lib. */
type FetchLike = typeof globalThis.fetch;

/** Hình dạng lỗi đã chuẩn hoá để so A/B (không so stack). */
interface ErrorShape {
  /** Tên lớp lỗi (Error, ValidationError...). */
  readonly name: string;
  /** Thông điệp lỗi. */
  readonly message: string;
  /** Mã lỗi nếu có (EADDRINUSE...). */
  readonly code?: string;
}

/** Kết quả một phép gọi có thể ném. */
type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ErrorShape };

/** Giao kèo host mà test chạm tới trên cả hai bản. */
interface InspectorModule {
  /** Tên plugin Cordis. */
  readonly name: string;
  /** Service bắt buộc. */
  readonly inject: readonly string[];
  /** Schema cấu hình (schemastery callable). */
  readonly Config: ConfigSchema;
  /** Điểm vào plugin host. */
  apply(ctx: unknown, config: unknown): Promise<void>;
  /** Phân giải cấu hình triển khai. */
  resolveInspectorOptions(options?: Record<string, unknown>): Record<string, unknown>;
  /** Mở Worker + server loopback, trả endpoint và handle đóng. */
  startInspector(options?: Record<string, unknown>): Promise<StartHandle>;
}

/** Schema cấu hình callable. */
interface ConfigSchema {
  /** Chuẩn hoá đầu vào thành cấu hình đầy đủ. */
  (input?: unknown): Record<string, unknown>;
}

/** Endpoint inspector do Worker công bố. */
interface StartEndpoint {
  /** URL HTTP loopback. */
  readonly httpUrl: string;
  /** URL WebSocket CDP loopback. */
  readonly webSocketDebuggerUrl: string;
  /** URL mở DevTools. */
  readonly devtoolsFrontendUrl: string;
  /** Tham số bootstrap cho client. */
  readonly client: Record<string, unknown>;
}

/** Handle startInspector trả về. */
interface StartHandle {
  /** Endpoint đã sẵn sàng. */
  readonly endpoint: StartEndpoint;
  /** Nguồn quan sát host. */
  readonly source: { close(): void };
  /** Đóng Worker + server; có thể ném AggregateError khi runtime không kịp thoát Worker. */
  close(): Promise<void>;
}

/** Service ctx.inspector (façade host). */
interface InspectorService {
  /** Phát một bản ghi quan sát. */
  publish(topic: string, payload: unknown, monotonicMs: number): void;
  /** Đọc cây Cordis qua query. */
  readonly cordis: { getTree(): Promise<unknown> };
}

/** Một bản ghi log Cordis đã chuẩn hoá. */
interface LogLine {
  /** Mức log. */
  readonly type: string;
  /** Nội dung nối các tham số. */
  readonly text: string;
}

/** Log record thô của Cordis. */
interface LogRecord {
  /** Mức log. */
  readonly type: string;
  /** Tham số log. */
  readonly args: readonly unknown[];
}

/** Logger Cordis tối thiểu mà test đọc. */
interface LoggerLike {
  /** Buffer log của Context. */
  readonly buffer: readonly LogRecord[];
  /** Ghi một dòng info (dùng để chứng minh Context còn sống). */
  info(...args: unknown[]): void;
}

/** Fiber Cordis tối thiểu. */
interface FiberLike {
  /** Trạng thái số: 2 = ACTIVE, 3 = FAILED. */
  readonly state: number;
  /** Chờ plugin ổn định và ném lỗi khởi động nếu có. */
  await(): Promise<unknown>;
  /** Gỡ plugin và chạy disposer. */
  dispose(): Promise<void>;
}

/** Context cordis THẬT, chỉ khai báo phần test dùng. */
interface RealContext {
  /** Mount plugin. */
  plugin(plugin: unknown, config?: unknown): FiberLike;
  /** Cung cấp service. */
  provide(name: string, value?: unknown): () => void;
  /** Logger thật của Cordis. */
  logger: LoggerLike;
  /** Service inspector do plugin cung cấp (undefined khi fail). */
  inspector?: unknown;
  /** Cho phép đọc service thử nghiệm. */
  [key: string]: unknown;
}

/** Module cordis thật. */
interface CordisModule {
  /** Constructor Context gốc. */
  readonly Context: new () => RealContext;
}

/** Một lần đăng ký trên giàn giả. */
interface Registration {
  /** Kênh đăng ký. */
  readonly channel: string;
  /** Đường dẫn. */
  readonly path: string;
  /** Chi tiết thêm (method/kind) hoặc null. */
  readonly detail: string | null;
}

/** Một lần mount plugin (thành công hoặc lỗi). */
interface Mount {
  /** Context thật. */
  readonly ctx: RealContext;
  /** Fiber của plugin. */
  readonly fiber: FiberLike;
  /** Lỗi khởi động, null nếu mount xong. */
  readonly error: ErrorShape | null;
  /** Trạng thái fiber sau khi chờ. */
  readonly state: number;
  /** ctx.inspector tại thời điểm quan sát. */
  readonly service: unknown;
  /** Các đăng ký đã ghi. */
  readonly records: readonly Registration[];
  /** Log mới trong lúc mount. */
  readonly logs: readonly LogLine[];
  /** Danh tính fetch trước mount. */
  readonly fetchBefore: FetchLike;
  /** Danh tính fetch ngay sau mount. */
  readonly fetchAfterMount: FetchLike;
  /** Disposer service giả. */
  readonly disposers: readonly (() => void)[];
}

/** Quan sát một lần startInspector thành công. */
interface StartObservation {
  /** URL HTTP. */
  readonly httpUrl: string;
  /** URL WebSocket CDP. */
  readonly webSocketDebuggerUrl: string;
  /** Khoá endpoint. */
  readonly endpointKeys: string[];
  /** Khoá client bootstrap. */
  readonly clientKeys: string[];
  /** Nguồn có close() không. */
  readonly sourceHasClose: boolean;
  /** fetch trong lúc chạy vẫn là bản gốc. */
  readonly duringIsBefore: boolean;
  /** fetch sau khi đóng trở lại bản gốc. */
  readonly afterIsBefore: boolean;
  /** Lỗi đóng (Bun hay báo Worker không thoát kịp), null nếu đóng sạch. */
  readonly closeFailure: ErrorShape | null;
}

/** Giàn chặn cổng 65535 (chỉ loopback). */
interface Blocker {
  /** Server tự mở, null nếu cổng đã bị tiến trình khác chiếm (vẫn đủ để bind lỗi). */
  readonly server: Server | null;
  /** Nhả cổng nếu chính test mở. */
  close(): Promise<void>;
}

/** 6 biến thể cấu hình theo đề bài: captureFetch true/false, mặc định, port/host, options lạ, port ngoài miền. */
const CONFIG_VARIANTS: readonly { readonly name: string; readonly options: Record<string, unknown> }[] = [
  { name: "captureFetch:true", options: { captureFetch: true } },
  { name: "captureFetch:false", options: { captureFetch: false } },
  { name: "mặc định (không truyền)", options: {} },
  { name: "port 0 + host loopback", options: { host: "127.0.0.1", port: 0 } },
  { name: "options lạ (unknown keys)", options: { unexpected: "x", nested: { a: 1 }, maxCordisNodes: 3 } },
  { name: "port ngoài miền", options: { port: 65536 } },
];

/** Các option resolve phải ném — dùng để so thông điệp A/B. */
const INVALID_RESOLVE_OPTIONS: readonly Record<string, unknown>[] = [
  { port: -1 },
  { port: 1.5 },
  { port: 65536 },
  { clientOrigins: ["http://127.0.0.1:5439/"] },
  { clientReconnectBaseMs: 5_000, clientReconnectMaxMs: 250 },
  { maxBodyChunkBytes: 100_000, maxSourceFrameBytes: 1_000 },
];

/** Ba đăng ký host mà apply phải tạo, đúng thứ tự của stock. */
const EXPECTED_REGISTRATIONS: readonly Registration[] = [
  { channel: "connection.fetch.register", path: "/api/experimental-inspector/bootstrap", detail: "GET" },
  { channel: "webServer.register", path: "/inspector/devtools", detail: "prefix" },
  { channel: "webServer.registerUpgrade", path: "/inspector/devtools/cdp", detail: null },
];

/** Bundle gốc nạp bằng chuỗi động để tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as unknown as InspectorModule;
/** Cordis thật của kernel. */
const { Context } = (await import(CORDIS)) as unknown as CordisModule;

/** Thư mục tạm chứa bản B đã staged (build hoặc copy lib) + node_modules liên kết. */
let stageRoot = "";
/** Module B sau beforeAll. */
let oursModule: InspectorModule | null = null;

/**
 * Lấy module B, ném lỗi rõ ràng nếu beforeAll chưa dựng được.
 * Nhận: không. Trả: module B đã nạp.
 */
function requireOurs(): InspectorModule {
  if (oursModule === null) throw new Error("B chưa sẵn sàng: beforeAll chưa nạp được lib/build của gói ta");
  return oursModule;
}

/**
 * Liên kết peer runtime + hai bí danh tên gói vào thư mục stage để bản build trong /tmp
 * phân giải được dependency và tự resolve package.json (đường dẫn asset devtools).
 * Nhận: root — thư mục stage; pkgDir — package staged (package.json + lib).
 * Trả: không.
 */
function linkStage(root: string, pkgDir: string): void {
  const modules = join(root, "node_modules");
  for (const name of PEER_PACKAGES) {
    const link = join(modules, name);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(join(PKG, "node_modules", name), link, "dir");
  }
  for (const name of [STOCK_PACKAGE_NAME, PACKAGE_NAME]) {
    const link = join(modules, name);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(pkgDir, link, "dir");
  }
}

/**
 * Dọn thư mục stage: gỡ từng symlink trước rồi mới xoá cây, để không bao giờ đi theo
 * liên kết vào node_modules thật của gói.
 * Nhận: không. Trả: không.
 */
function cleanupStage(): void {
  if (stageRoot === "") return;
  const modules = join(stageRoot, "node_modules");
  for (const name of [...PEER_PACKAGES, STOCK_PACKAGE_NAME, PACKAGE_NAME]) {
    try {
      unlinkSync(join(modules, name));
    } catch {
      // Symlink đã biến mất hoặc chưa được tạo — không sao.
    }
  }
  rmSync(stageRoot, { recursive: true, force: true });
}

/**
 * Dựng bản B: ưu tiên lib/index.js; nếu chưa có thì import buildPackage từ build.ts,
 * build vào thư mục tạm rồi dọn ở afterAll.
 * Nhận: không. Trả: Promise hoàn tất khi module B sẵn sàng.
 */
beforeAll(async () => {
  if (!HAS_OURS) return;
  stageRoot = mkdtempSync(join(tmpdir(), "gbh-inspector-ab-"));
  const pkgDir = join(stageRoot, "pkg");
  mkdirSync(pkgDir, { recursive: true });
  copyFileSync(join(PKG, "package.json"), join(pkgDir, "package.json"));
  let artifact: string;
  if (existsSync(OURS_LIB)) {
    cpSync(join(PKG, "lib"), join(pkgDir, "lib"), { recursive: true });
    artifact = join(pkgDir, "lib", "index.js");
  } else {
    const build = (await import(pathToFileURL(OURS_BUILD).href)) as {
      buildPackage(options?: { readonly outDir?: string }): { readonly outDir: string };
    };
    const report = build.buildPackage({ outDir: join(pkgDir, "lib") });
    artifact = join(report.outDir, "index.js");
  }
  if (!existsSync(join(pkgDir, "lib", "devtools"))) mkdirSync(join(pkgDir, "lib", "devtools"), { recursive: true });
  linkStage(stageRoot, pkgDir);
  oursModule = (await import(pathToFileURL(artifact).href)) as unknown as InspectorModule;
}, 180_000);

/** Dọn bản staged sau khi chạy xong. */
afterAll(() => {
  cleanupStage();
});

/**
 * Chạy một phép gọi và chuẩn hoá lỗi.
 * Nhận: work — phép gọi đồng bộ/bất đồng bộ. Trả: Outcome với value hoặc ErrorShape.
 */
async function attempt<T>(work: () => T | Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

/**
 * Chuẩn hoá một lỗi thành hình dạng so sánh được.
 * Nhận: error — giá trị bị ném. Trả: { name, message, code? }.
 */
function describeError(error: unknown): ErrorShape {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string"
      ? { name: error.name, message: error.message, code }
      : { name: error.name, message: error.message };
  }
  return { name: "NonError", message: String(error) };
}

/**
 * Chặn một promise bằng hạn chót để test không treo.
 * Nhận: work — promise; ms — hạn; label — nhãn lỗi. Trả: giá trị của work.
 */
async function within<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label + ": vượt hạn " + String(ms) + "ms")), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Khôi phục globalThis.fetch nếu một bản capture không tự nhả.
 * Nhận: original — hàm fetch gốc. Trả: không.
 */
function restoreFetch(original: FetchLike): void {
  (globalThis as unknown as { fetch: FetchLike }).fetch = original;
}

/**
 * Chuẩn hoá log Cordis.
 * Nhận: record — bản ghi thô. Trả: { type, text }.
 */
function normalizeLog(record: LogRecord): LogLine {
  return { type: record.type, text: record.args.map((arg) => String(arg)).join(" ") };
}

/**
 * Lọc chẩn đoán inspector ở mức error/warn.
 * Nhận: logs — log đã chuẩn hoá. Trả: các dòng có chữ "inspector".
 */
function inspectorDiagnostics(logs: readonly LogLine[]): LogLine[] {
  return logs.filter((line) => (line.type === "error" || line.type === "warn") && /inspector/i.test(line.text));
}

/**
 * Mount plugin trên Context cordis THẬT với webServer/connection GIẢ nhưng đúng hình dạng seam.
 * Nhận: module — A hoặc B; config — cấu hình plugin. Trả: Mount đã quan sát (có thể lỗi khởi động).
 */
async function mountPlugin(module: InspectorModule, config: Record<string, unknown>): Promise<Mount> {
  const ctx = new Context();
  const records: Registration[] = [];
  const disposers: (() => void)[] = [];
  disposers.push(
    ctx.provide("webServer", {
      register(spec: { readonly kind?: string; readonly path?: string }): () => void {
        records.push({
          channel: "webServer.register",
          path: spec.path ?? "",
          detail: spec.kind ?? null,
        });
        return () => {};
      },
      registerUpgrade(spec: { readonly path?: string }): () => void {
        records.push({ channel: "webServer.registerUpgrade", path: spec.path ?? "", detail: null });
        return () => {};
      },
    }),
  );
  disposers.push(
    ctx.provide("connection", {
      fetch: {
        register(spec: { readonly path?: string; readonly methods?: readonly string[] }): () => void {
          records.push({
            channel: "connection.fetch.register",
            path: spec.path ?? "",
            detail: (spec.methods ?? []).join(","),
          });
          return () => {};
        },
      },
      authorizeIndex(): boolean {
        return true;
      },
      requestRejection(): number | undefined {
        return undefined;
      },
    }),
  );
  const logsStart = ctx.logger.buffer.length;
  const fetchBefore = globalThis.fetch;
  const fiber = ctx.plugin(module, config);
  let error: ErrorShape | null = null;
  try {
    await within(fiber.await(), 25_000, "fiber.await");
  } catch (failure) {
    error = describeError(failure);
  }
  return {
    ctx,
    fiber,
    error,
    state: fiber.state,
    service: ctx.inspector,
    records,
    logs: ctx.logger.buffer.slice(logsStart).map(normalizeLog),
    fetchBefore,
    fetchAfterMount: globalThis.fetch,
    disposers,
  };
}

/**
 * Gỡ plugin + service giả, khôi phục fetch nếu cần.
 * Nhận: mount — kết quả mount. Trả: lỗi dispose đã chuẩn hoá (null nếu sạch).
 */
async function disposeMount(mount: Mount): Promise<ErrorShape | null> {
  let failure: ErrorShape | null = null;
  try {
    await within(mount.fiber.dispose(), 10_000, "fiber.dispose");
  } catch (error) {
    failure = describeError(error);
  }
  for (const dispose of mount.disposers) {
    try {
      dispose();
    } catch {
      // Service giả đã bị gỡ cùng fiber — bỏ qua.
    }
  }
  if (globalThis.fetch !== mount.fetchBefore) restoreFetch(mount.fetchBefore);
  return failure;
}

/**
 * Bun hiện không để Worker thoát trong stopTimeoutMs nên close hay ném "shutdown failed".
 * Nhận: failure — lỗi dispose/close. Trả: không; chỉ chấp nhận lỗi shutdown đã biết.
 */
function expectShutdownOnly(failure: ErrorShape | null): void {
  if (failure !== null) expect(failure.message).toContain("shutdown failed");
}

/**
 * Chứng minh Context còn sống sau lỗi bind: tự provide một service mới rồi đọc lại.
 * Nhận: ctx — Context thật. Trả: true nếu provide/read thành công.
 */
function probeContext(ctx: RealContext): boolean {
  try {
    const dispose = ctx.provide("gbhProbe", "alive");
    const alive = ctx["gbhProbe"] === "alive";
    dispose();
    return alive;
  } catch {
    return false;
  }
}

/**
 * Chạy startInspector với port 0 loopback và đo danh tính fetch trước/trong/sau.
 * Nhận: module — A hoặc B; captureFetch — bật/tắt capture. Trả: StartObservation.
 */
async function observeStart(module: InspectorModule, captureFetch: boolean): Promise<StartObservation> {
  const original = globalThis.fetch;
  try {
    const handle = await within(
      module.startInspector({
        host: "127.0.0.1",
        port: 0,
        captureFetch,
        startupTimeoutMs: 15_000,
        stopTimeoutMs: 250,
      }),
      25_000,
      "startInspector",
    );
    const during = globalThis.fetch;
    let closeFailure: ErrorShape | null = null;
    try {
      await within(handle.close(), 10_000, "close");
    } catch (error) {
      closeFailure = describeError(error);
    }
    const after = globalThis.fetch;
    return {
      httpUrl: handle.endpoint.httpUrl,
      webSocketDebuggerUrl: handle.endpoint.webSocketDebuggerUrl,
      endpointKeys: Object.keys(handle.endpoint),
      clientKeys: Object.keys(handle.endpoint.client).sort(),
      sourceHasClose: typeof handle.source.close === "function",
      duringIsBefore: during === original,
      afterIsBefore: after === original,
      closeFailure,
    };
  } finally {
    if (globalThis.fetch !== original) restoreFetch(original);
  }
}

/**
 * Mở một server loopback giữ cổng 65535 để ép bind lỗi; nếu cổng đã bị chiếm thì cũng đủ.
 * Nhận: port — cổng cần giữ. Trả: Blocker có close().
 */
async function occupy(port: number): Promise<Blocker> {
  const server = createServer((socket) => socket.end());
  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => reject(error);
      server.once("error", onError);
      server.listen(port, "127.0.0.1", () => {
        server.off("error", onError);
        resolve();
      });
    });
    return {
      server,
      async close(): Promise<void> {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      },
    };
  } catch (error) {
    if (error instanceof Error && (error as { code?: unknown }).code === "EADDRINUSE") {
      return {
        server: null,
        async close(): Promise<void> {},
      };
    }
    throw error;
  }
}

/**
 * Gọi startInspector trên cổng đang bị chặn và đo fetch.
 * Nhận: module — A hoặc B. Trả: outcome + fetch còn nguyên vẹn hay không.
 */
async function observeStartFailure(
  module: InspectorModule,
): Promise<{ readonly outcome: Outcome<StartHandle>; readonly fetchSame: boolean }> {
  const original = globalThis.fetch;
  const outcome = await attempt(() =>
    module.startInspector({
      host: "127.0.0.1",
      port: 65535,
      captureFetch: false,
      startupTimeoutMs: 5_000,
      stopTimeoutMs: 250,
    }),
  );
  const fetchSame = globalThis.fetch === original;
  if (outcome.ok) {
    try {
      await within(outcome.value.close(), 10_000, "close");
    } catch {
      // Dọn handle bất ngờ mở được; ca test vẫn sẽ đỏ vì outcome.ok === true.
    }
  }
  if (!fetchSame) restoreFetch(original);
  return { outcome, fetchSame };
}

/** Ca 0 chỉ chạy A để giàn đo luôn có oracle kể cả khi B chưa build xong. */
test("A (stock) là oracle: 6 export · name · inject · Config mặc định port 9230 · resolve mặc định port 0", () => {
  expect(Object.keys(stock).sort()).toEqual([
    "Config",
    "apply",
    "inject",
    "name",
    "resolveInspectorOptions",
    "startInspector",
  ]);
  expect(stock.name).toBe("experimental-inspector");
  expect(stock.inject).toEqual(["webServer", "connection"]);
  expect(stock.Config({}).host).toBe("127.0.0.1");
  expect(stock.Config({}).port).toBe(9230);
  expect(stock.Config({}).captureFetch).toBe(true);
  expect(stock.resolveInspectorOptions().host).toBe("127.0.0.1");
  expect(stock.resolveInspectorOptions().port).toBe(0);
  if (!HAS_OURS) {
    console.log("[experimental-inspector A/B] thiếu lib/index.js và build.ts của gói ta — các ca B SKIP");
  }
});

bTest("ca 1: bề mặt export B ≡ A — 6 tên · name · inject · arity", () => {
  const ours = requireOurs();
  expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
  expect(ours.name).toBe(stock.name);
  expect(ours.inject).toEqual(stock.inject);
  const arity = (module: InspectorModule): number[] => [
    (module.Config as unknown as { length: number }).length,
    (module.apply as unknown as { length: number }).length,
    (module.resolveInspectorOptions as unknown as { length: number }).length,
    (module.startInspector as unknown as { length: number }).length,
  ];
  expect(arity(ours)).toEqual(arity(stock));
  expect(typeof ours.Config).toBe("function");
  expect(typeof ours.apply).toBe("function");
  expect(typeof ours.resolveInspectorOptions).toBe("function");
  expect(typeof ours.startInspector).toBe("function");
});

bTest("ca 2: String(Config) B ≡ A", () => {
  expect(String(requireOurs().Config)).toBe(String(stock.Config));
});

bTest("ca 3: Config() mặc định host 127.0.0.1 · port 9230 · captureFetch true (B ≡ A)", () => {
  const theirs = stock.Config({});
  expect(requireOurs().Config({})).toEqual(theirs);
  expect(theirs.host).toBe("127.0.0.1");
  expect(theirs.port).toBe(9230);
  expect(theirs.captureFetch).toBe(true);
});

bTest("ca 4: Config trên 6 biến thể — kết quả/lỗi B ≡ A", async () => {
  for (const variant of CONFIG_VARIANTS) {
    const theirs = await attempt(() => stock.Config(variant.options));
    const ours = await attempt(() => requireOurs().Config(variant.options));
    expect({ variant: variant.name, result: ours }).toEqual({ variant: variant.name, result: theirs });
  }
});

bTest("ca 5: resolveInspectorOptions trên 6 biến thể — kết quả/lỗi B ≡ A", async () => {
  for (const variant of CONFIG_VARIANTS) {
    const theirs = await attempt(() => stock.resolveInspectorOptions(variant.options));
    const ours = await attempt(() => requireOurs().resolveInspectorOptions(variant.options));
    expect({ variant: variant.name, result: ours }).toEqual({ variant: variant.name, result: theirs });
  }
});

bTest("ca 6: resolveInspectorOptions() — port 0 · host loopback · captureFetch true · clientOrigins tách mới (B ≡ A)", () => {
  const theirs = stock.resolveInspectorOptions();
  const ours = requireOurs().resolveInspectorOptions();
  expect(ours).toEqual(theirs);
  expect(theirs.host).toBe("127.0.0.1");
  expect(theirs.port).toBe(0);
  expect(theirs.captureFetch).toBe(true);
  expect(theirs.clientOrigins).toEqual([]);

  const stockA = stock.resolveInspectorOptions({ clientOrigins: ["http://a.test"] });
  const stockB = stock.resolveInspectorOptions({ clientOrigins: ["http://a.test"] });
  expect(stockA.clientOrigins).not.toBe(stockB.clientOrigins);
  (stockA.clientOrigins as string[]).push("http://b.test");
  expect(stockB.clientOrigins).toEqual(["http://a.test"]);

  const ourA = requireOurs().resolveInspectorOptions({ clientOrigins: ["http://a.test"] });
  const ourB = requireOurs().resolveInspectorOptions({ clientOrigins: ["http://a.test"] });
  expect(ourA.clientOrigins).not.toBe(ourB.clientOrigins);
  (ourA.clientOrigins as string[]).push("http://b.test");
  expect(ourB.clientOrigins).toEqual(["http://a.test"]);
});

bTest("ca 7: resolveInspectorOptions — port biên 0/65535 + 6 option sai, lỗi B ≡ A", async () => {
  for (const port of [0, 65_535]) {
    const theirs = await attempt(() => stock.resolveInspectorOptions({ port }));
    const ours = await attempt(() => requireOurs().resolveInspectorOptions({ port }));
    expect({ port, result: ours }).toEqual({ port, result: theirs });
    expect(theirs.ok).toBe(true);
    if (theirs.ok) expect(theirs.value.port).toBe(port);
  }
  for (const options of INVALID_RESOLVE_OPTIONS) {
    const theirs = await attempt(() => stock.resolveInspectorOptions(options));
    const ours = await attempt(() => requireOurs().resolveInspectorOptions(options));
    expect({ options, result: ours }).toEqual({ options, result: theirs });
    expect(theirs.ok).toBe(false);
  }
});

bTest("ca 8: Config từ chối host ngoài 127.0.0.1, resolve thì không — B ≡ A ở cả hai", async () => {
  const configTheirs = await attempt(() => stock.Config({ host: "0.0.0.0" }));
  const configOurs = await attempt(() => requireOurs().Config({ host: "0.0.0.0" }));
  expect(configOurs).toEqual(configTheirs);
  expect(configTheirs.ok).toBe(false);
  const resolveTheirs = await attempt(() => stock.resolveInspectorOptions({ host: "0.0.0.0" }));
  const resolveOurs = await attempt(() => requireOurs().resolveInspectorOptions({ host: "0.0.0.0" }));
  expect(resolveOurs).toEqual(resolveTheirs);
  expect(resolveTheirs.ok).toBe(true);
  if (resolveTheirs.ok) expect(resolveTheirs.value.host).toBe("0.0.0.0");
});

bTest("ca 9 (BẮT BUỘC a): captureFetch:false KHÔNG cài capture vào globalThis.fetch — trước/sau A và B", async () => {
  for (const [label, module] of [
    ["A", stock],
    ["B", requireOurs()],
  ] as const) {
    const observed = await observeStart(module, false);
    expect({ label, during: observed.duringIsBefore, after: observed.afterIsBefore }).toEqual({
      label,
      during: true,
      after: true,
    });
    expect(new URL(observed.httpUrl).hostname).toBe("127.0.0.1");
    expect(observed.webSocketDebuggerUrl.startsWith("ws://127.0.0.1:")).toBe(true);
    expectShutdownOnly(observed.closeFailure);
  }
}, 45_000);

bTest("ca 10: captureFetch:true cài capture trong lúc chạy rồi khôi phục; endpoint loopback (B ≡ A)", async () => {
  let stockClientKeys: readonly string[] | null = null;
  for (const [label, module] of [
    ["A", stock],
    ["B", requireOurs()],
  ] as const) {
    const observed = await observeStart(module, true);
    expect({ label, during: observed.duringIsBefore, after: observed.afterIsBefore }).toEqual({
      label,
      during: false,
      after: true,
    });
    expect(new URL(observed.httpUrl).hostname).toBe("127.0.0.1");
    expect(observed.endpointKeys).toEqual(["httpUrl", "webSocketDebuggerUrl", "devtoolsFrontendUrl", "client"]);
    expect(observed.clientKeys).toContain("endpoint");
    expect(observed.clientKeys).toContain("protocol");
    expect(observed.sourceHasClose).toBe(true);
    expectShutdownOnly(observed.closeFailure);
    if (label === "A") stockClientKeys = observed.clientKeys;
    else {
      expect(stockClientKeys).not.toBeNull();
      if (stockClientKeys !== null) expect(observed.clientKeys).toEqual([...stockClientKeys]);
    }
  }
}, 45_000);

bTest("ca 11: apply dựng ctx.inspector trên Context cordis THẬT + 3 đăng ký (port 0, captureFetch:false) — B ≡ A", async () => {
  const config = {
    host: "127.0.0.1",
    port: 0,
    captureFetch: false,
    startupTimeoutMs: 15_000,
    stopTimeoutMs: 250,
  };
  const theirs = await mountPlugin(stock, config);
  try {
    expect(theirs.error).toBeNull();
    expect(theirs.state).toBe(2);
    expect(theirs.records).toEqual(EXPECTED_REGISTRATIONS);
    expect(theirs.fetchAfterMount).toBe(theirs.fetchBefore);
    const theirsService = theirs.service as InspectorService | undefined;
    expect(Object.keys(theirsService ?? {}).sort()).toEqual(["cordis", "publish"]);
    expect(typeof theirsService?.publish).toBe("function");
    expect(typeof theirsService?.cordis?.getTree).toBe("function");

    const ours = await mountPlugin(requireOurs(), config);
    try {
      expect(ours.error).toBeNull();
      expect(ours.state).toBe(2);
      expect(ours.records).toEqual(theirs.records);
      expect(ours.fetchAfterMount).toBe(ours.fetchBefore);
      const oursService = ours.service as InspectorService | undefined;
      expect(Object.keys(oursService ?? {}).sort()).toEqual(["cordis", "publish"]);
      expect(typeof oursService?.publish).toBe("function");
      expect(typeof oursService?.cordis?.getTree).toBe("function");
    } finally {
      expectShutdownOnly(await disposeMount(ours));
      expect(ours.ctx.inspector).toBeUndefined();
      expect(typeof ours.ctx.logger.info).toBe("function");
      expect(globalThis.fetch).toBe(ours.fetchBefore);
    }
  } finally {
    expectShutdownOnly(await disposeMount(theirs));
    expect(theirs.ctx.inspector).toBeUndefined();
    expect(typeof theirs.ctx.logger.info).toBe("function");
    expect(globalThis.fetch).toBe(theirs.fetchBefore);
  }
}, 60_000);

bTest("ca 12 (BẮT BUỘC b): bind lỗi — apply không giết Context, không có inspector, có chẩn đoán — A vs B", async () => {
  const blocker = await occupy(65_535);
  const config = {
    host: "127.0.0.1",
    port: 65_535,
    captureFetch: false,
    startupTimeoutMs: 5_000,
    stopTimeoutMs: 250,
  };
  const theirs = await mountPlugin(stock, config);
  const ours = await mountPlugin(requireOurs(), config);
  try {
    const theirsAlive = probeContext(theirs.ctx);
    const oursAlive = probeContext(ours.ctx);
    const theirsDiagnostics = inspectorDiagnostics(theirs.logs);
    const oursDiagnostics = inspectorDiagnostics(ours.logs);
    console.log("[bind lỗi] A=" + JSON.stringify(theirs.error) + " · B=" + JSON.stringify(ours.error));

    expect(theirs.error).not.toBeNull();
    expect(theirs.error?.message).toContain("no available port from 65535 through 65535");
    expect(theirs.service).toBeUndefined();
    expect(theirsAlive).toBe(true);
    expect(theirsDiagnostics.length).toBeGreaterThan(0);

    // A đo được: fiber REJECT (logger.error, không phải warn) nhưng Context sống.
    // B được phép fail-soft (resolve) hoặc reject y hệt A; lỗi lạ là hỏng parity.
    if (ours.error !== null && theirs.error !== null) expect(ours.error).toEqual(theirs.error);
    expect(ours.service).toBeUndefined();
    expect(oursAlive).toBe(true);
    expect(oursDiagnostics.length).toBeGreaterThan(0);
  } finally {
    await disposeMount(ours);
    await disposeMount(theirs);
    await blocker.close();
  }
}, 45_000);

bTest("ca 13: startInspector bind lỗi — cùng lỗi A ≡ B, fetch nguyên vẹn", async () => {
  const blocker = await occupy(65_535);
  try {
    const theirs = await observeStartFailure(stock);
    const ours = await observeStartFailure(requireOurs());
    expect(theirs.outcome.ok).toBe(false);
    expect(ours.outcome.ok).toBe(false);
    if (!theirs.outcome.ok && !ours.outcome.ok) {
      expect(ours.outcome.error).toEqual(theirs.outcome.error);
      expect(theirs.outcome.error.message).toContain("no available port from 65535 through 65535");
    }
    expect(theirs.fetchSame).toBe(true);
    expect(ours.fetchSame).toBe(true);
  } finally {
    await blocker.close();
  }
}, 30_000);
