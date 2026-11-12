/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test A/B cho gói @galaxy-blackhole/gbh-host-webserver — gói GIỮ HTTP server của cả app nên phải
 *      chứng minh cổng/khoá route/mã trạng thái/header KHÔNG đổi: ca byte (538 dòng · 21.436 B · artefact
 *      ta sha256 0197…85ba sau lô đổi tên brand, bundle stock 0890…f3ab; chuẩn hoá brand ĐỐI XỨNG hai vế
 *      ⇒ trùng từng byte · id stock đúng 1 lần ở dòng 102 · id ta 0 lần), ca config row park deep-equal
 *      dump oracle, ca listen(0)+address(), ca route/status/header qua HTTP THẬT, ca export/Config schema
 *      và ca package.json peer-only (thay cho ca src-handwritten — gói này là bản port mới).
 */

import { afterAll, describe, expect, test } from "bun:test";
import { chuanHoaHost, soByte } from "../lib/artefact-normalize.ts";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { request, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

import { assembleBundle } from "../../packages/host/host-webserver/src/assemble.ts";
import { PART_FILES } from "../../packages/host/host-webserver/src/manifest.ts";
import { brandEqual, DIST_READ_NAMES, normalizeBrand, sha256Brand } from "../lib/brand-parity.ts";

/** Gốc repo (tests/host ⇒ ../..). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG_DIR = join(REPO, "packages", "host", "host-webserver");
/** Artefact của ta — bản byte-identical của bundle gốc. */
const OUR_FILE = join(PKG_DIR, "lib", "index.js");
/** Thư mục gói GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_PKG_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-host-webserver");
/** Bundle GỐC. */
const STOCK_FILE = join(STOCK_PKG_DIR, "lib", "index.js");
/** node_modules của kernel — nguồn duy nhất có cordis/schemastery/compression/ipaddr/negotiator. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** File test này (khai trong package.json). */
const TEST_FILE = "tests/host/host-webserver.test.ts";
/** Số dòng theo wc -l. */
const ARTEFACT_LINES = 538;
/** Số byte trên đĩa. */
const ARTEFACT_BYTES = 21436;
/** /** SHA-256 của artefact CỦA TA. 20/10/2026 (lô đổi tên brand): READY_MARKUP đổi `__DSH_BOOT_READY__` → `__GBH_BOOT_READY__` (tên VỎ DIST) ⇒ sha đổi CÓ CHỦ ĐÍCH; cùng độ dài nên byte/dòng không đổi, còn phép so với bản gốc vẫn CHẶT bằng chuẩn hoá brand ĐỐI XỨNG hai vế (xem STOCK_ARTEFACT_SHA256). */
const ARTEFACT_SHA256 = "01970a16addd8261985afa0f0117b1cadbc7335dc1f1883a9ee41a67514885ba";
/** SHA-256 của bundle GỐC trong kernel — vẫn viết tên vỏ DSH; sau chuẩn hoá brand hai vế phải BẰNG nhau. */
const STOCK_ARTEFACT_SHA256 = "08907285802f0edd3aeb68c91fb443be2804879ab3d41104c4600424be06f3ab";
/** Id gói GỐC — chỉ xuất hiện 1 lần, ở JSDoc dòng 102. */
const STOCK_ID = "@deepseek-ai/dsh-host-webserver";
/** Id gói của ta — 0 lần trong artefact (vì byte-identical). */
const OUR_ID = "@galaxy-blackhole/gbh-host-webserver";
/** Dòng DUY NHẤT chứa id gốc (1-based). */
const STOCK_ID_LINE = 102;
/** Tập export ESM của artefact, đã sắp xếp. */
const EXPORT_NAMES: readonly string[] = [
  "WebServer",
  "bindUrlHost",
  "default",
  "isLoopbackHost",
  "isWildcardHost",
  "normalizeBindAddress",
  "renderIndexInjections",
];
/** Sáu khoá schema Config, đã sắp xếp — TRÙNG ĐÚNG sáu khoá row trong dump. */
const SCHEMA_KEYS: readonly string[] = ["compression", "compressionLevel", "compressionThresholdBytes", "host", "port", "tls"];
/** Config row 'webserver' phải khớp NGUYÊN VĂN (3 giá trị !!js giữ nguyên chuỗi có nháy bên trong). */
const EXPECTED_ROW_CONFIG: Record<string, unknown> = {
  host: "!!js ctx.webStartup.host ?? '127.0.0.1'",
  port: "!!js ctx.webStartup.port ?? 3080",
  tls: "!!js ctx.webStartup.tls",
  compression: "gzip",
  compressionLevel: 1,
  compressionThresholdBytes: 1024,
};
/** Header quan trọng phải khớp từng giá trị giữa hai bản. */
const IMPORTANT_HEADERS: readonly string[] = ["content-type", "content-length", "content-encoding", "vary", "transfer-encoding"];
/** Cấu hình listen tối thiểu (port 0 ⇒ cổng động). */
const BASE_CONFIG: Record<string, unknown> = { host: "127.0.0.1", port: 0 };
/** Cấu hình bật gzip đúng như row oracle. */
const GZIP_CONFIG: Record<string, unknown> = { host: "127.0.0.1", port: 0, compression: "gzip", compressionLevel: 1, compressionThresholdBytes: 1024 };

/** Cấu hình đã chuẩn hoá của WebServer (chỉ các trường test chạm). */
interface ConfigShape {
  host: string;
  port: number;
  tls?: { certFile: string; keyFile: string } | undefined;
  compression: "none" | "gzip";
  compressionLevel: number;
  compressionThresholdBytes: number;
}

/** Một trường schemastery (chỉ đọc phần test chạm). */
interface ConfigField {
  meta?: Record<string, unknown>;
  type?: string;
}

/** Schema cấu hình: gọi được để parse + bảng trường. */
interface ConfigSchema {
  (input: unknown): ConfigShape;
  dict: Record<string, ConfigField>;
}

/** Phản hồi/yêu cầu node tối thiểu mà handler mẫu dùng. */
interface ResponseLike {
  writeHead(status: number, headers?: Record<string, string>): unknown;
  end(body?: string): unknown;
}
interface RequestLike {
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

/** Handler + route đăng ký với WebServer. */
type Handler = (req: RequestLike, res: ResponseLike) => void;
interface Route {
  kind: "exact" | "prefix";
  path: string;
  handler: Handler;
}

/** Máy chủ node bên dưới WebServer (chỉ đọc). */
interface NodeServerLike {
  address(): AddressInfo | string | null;
  listening: boolean;
}

/** Bề mặt WebServer mà test chạm tới. */
interface ServerLike {
  port: number | undefined;
  host: string;
  protocol: string;
  server: NodeServerLike;
  exact: Map<string, Route>;
  prefixes: Map<string, Route>;
  getOrigin(): string;
  register(route: Route): () => void;
  registerFallback(handler: Handler): () => void;
}

/** Lớp WebServer + schema tĩnh. */
interface WebServerClass {
  new (ctx: unknown, config: unknown): ServerLike;
  Config: ConfigSchema;
}

/** Module artefact (của ta hoặc bản gốc). */
interface WebServerModule {
  WebServer: WebServerClass;
  default: WebServerClass;
  bindUrlHost(host: string): string | undefined;
  isLoopbackHost(host: string): boolean;
  isWildcardHost(host: string): boolean;
  normalizeBindAddress(host: string): string;
  renderIndexInjections(html: string, rows: readonly unknown[]): string;
}

/** Context + fiber cordis tối thiểu. */
interface ContextLike {
  plugin(plugin: unknown, config?: unknown): unknown;
  webServer?: ServerLike | undefined;
}
interface FiberLike extends PromiseLike<unknown> {
  dispose(): Promise<unknown>;
}

/** Một server đã mount + hàm dọn. */
interface Mounted {
  readonly server: ServerLike;
  readonly ctx: ContextLike;
  dispose(): Promise<void>;
}

/** Kết quả một lượt GET. */
interface HttpResult {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

/** Row khai trong manifest. */
interface RowShape {
  id?: string;
  stockId?: string;
  moduleIds?: string[];
  aliases?: string[];
  tests?: string[];
  config?: Record<string, unknown>;
}

/** Hình dạng package.json mà test đọc. */
interface PackageJson {
  name?: string;
  type?: string;
  main?: string;
  exports?: Record<string, unknown>;
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  gbh?: {
    tests?: string[];
    peers?: string[];
    row?: RowShape;
    row_unmounted_ly_do?: { ly_do?: string; row?: RowShape };
  };
}

/** /** Đếm số lần một id xuất hiện trong văn bản. Nhận: text — văn bản cần đếm; id — chuỗi id cần tìm. Trả: số lần xuất hiện. / */
function idCount(text: string, id: string): number {
  return text.split(id).length - 1;
}

/** /** Quy 4 tên VỎ DIST về dạng stock (`__GBH_BOOT__` ⇒ `__DSH_BOOT__`) để so CHÉO hai vế: `normalizeBrand` GIỮ NGUYÊN 4 tên này (vỏ SPA đang đọc tên GBH) còn bundle stock viết `__DSH_*`. Nhận: text — văn bản artefact. Trả: văn bản đã quy 4 tên vỏ dist về dạng DSH. / */
function dongBoVoDist(text: string): string {
  let out = text;
  for (const ten of DIST_READ_NAMES) out = out.split(ten).join("__DSH_" + ten.slice("__GBH_".length));
  return out;
}

/** /** Đo độ dài byte UTF-8 của một chuỗi. Nhận: text — chuỗi cần đo. Trả: số byte khi mã hoá UTF-8. / */
function byteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/** /** Băm SHA-256. Nhận: input — Buffer hoặc chuỗi UTF-8. Trả: chuỗi hex 64 ký tự. / */
function sha256(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** /** Đếm số dòng theo nghĩa wc -l (số ký tự xuống dòng). Nhận: text — văn bản cần đếm. Trả: số ký tự xuống dòng. / */
function lineCount(text: string): number {
  return text.split("\n").length - 1;
}

/** /** Danh sách tên export của một module ESM, đã sắp xếp. Nhận: mod — module namespace. Trả: mảng tên export đã sắp xếp. / */
function exportNames(mod: object): string[] {
  return Object.keys(mod).sort();
}

/** /** Rút gọn schema Config thành bảng so sánh được (khoá ⇒ meta + type). Nhận: schema — Config của WebServer. Trả: object khoá ⇒ { meta, type }. / */
function schemaView(schema: ConfigSchema): Record<string, Record<string, unknown>> {
  const view: Record<string, Record<string, unknown>> = {};
  for (const [key, field] of Object.entries(schema.dict)) view[key] = { meta: field.meta ?? {}, type: field.type ?? "-" };
  return view;
}

/** /** Chạy một thao tác đồng bộ và ghi kết quả/lỗi thành chuỗi so sánh được. Nhận: run — thao tác cần chạy. Trả: "ok" hoặc "nem|<tên lớp>|<thông điệp>". / */
function outcomeOf(run: () => unknown): string {
  try {
    run();
    return "ok";
  } catch (error) {
    const failure = error as Error;
    return "nem|" + failure.name + "|" + failure.message;
  }
}

/** /** GET một đường dẫn qua HTTP thật tới localhost (timeout 5s). Nhận: port — cổng server; path — đường dẫn; headers — header gửi kèm. Trả: mã trạng thái + header thô + body thô. / */
async function httpGet(port: number, path: string, headers: Record<string, string> = {}): Promise<HttpResult> {
  return await new Promise<HttpResult>((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method: "GET", headers, timeout: 5_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("timeout", () => req.destroy(new Error("httpGet: quá 5s không phản hồi")));
    req.on("error", reject);
    req.end();
  });
}

/** /** Lọc các header QUAN TRỌNG thành object so sánh được. Nhận: headers — header thô của node. Trả: object các header quan trọng đang có mặt. / */
function headerView(headers: IncomingHttpHeaders): Record<string, string> {
  const view: Record<string, string> = {};
  for (const name of IMPORTANT_HEADERS) {
    const value = headers[name];
    if (value !== undefined) view[name] = Array.isArray(value) ? value.join(",") : value;
  }
  return view;
}

/** /** Tập tên header (bỏ 'date' vì giá trị phụ thuộc đồng hồ), đã sắp xếp. Nhận: headers — header thô của node. Trả: mảng tên header đã sắp xếp. / */
function headerNames(headers: IncomingHttpHeaders): string[] {
  return Object.keys(headers)
    .filter((name) => name.toLowerCase() !== "date")
    .sort();
}

/** /** Giải nén body khi phản hồi ở dạng gzip. Nhận: result — kết quả GET. Trả: body sau giải nén (hoặc nguyên bản khi không nén). / */
function decodeBody(result: HttpResult): Buffer {
  return result.headers["content-encoding"] === "gzip" ? gunzipSync(result.body) : result.body;
}

/** /** Danh sách khoá route của một server, đã sắp xếp. Nhận: server — server cần đọc. Trả: { exact, prefixes }. / */
function routeKeys(server: ServerLike): { exact: string[]; prefixes: string[] } {
  return { exact: [...server.exact.keys()].sort(), prefixes: [...server.prefixes.keys()].sort() };
}

/** /** Lấy cổng đã bind, báo lỗi rõ khi server chưa listen. Nhận: server — server cần đọc. Trả: số cổng. / */
function portOf(server: ServerLike): number {
  const port = server.port;
  if (port === undefined) throw new Error("server chưa bind cổng");
  return port;
}

/** /** Mount một WebServer qua vòng đời cordis THẬT (ctx.plugin) rồi chờ listen xong. Nhận: mod — module artefact; config — cấu hình thô (schema tự điền mặc định). Trả: Mounted (server + ctx + dispose). / */
async function mount(mod: WebServerModule, config: Record<string, unknown>): Promise<Mounted> {
  const ctx = new ContextCtor() as ContextLike;
  const fiber = ctx.plugin(mod.WebServer, config) as FiberLike;
  try {
    await fiber;
  } catch (error) {
    await fiber.dispose();
    throw error;
  }
  const server = ctx.webServer;
  if (server === undefined) throw new Error("mount: ctx.webServer không xuất hiện sau khi fiber chạy xong");
  const dispose = async (): Promise<void> => {
    await fiber.dispose();
  };
  return { server, ctx, dispose };
}

/** /** Mount một bên, chạy callback rồi LUÔN dispose trong finally. Nhận: mod — module artefact; config — cấu hình; run — callback nhận server. Trả: giá trị callback trả. / */
async function withServer<T>(mod: WebServerModule, config: Record<string, unknown>, run: (server: ServerLike) => Promise<T>): Promise<T> {
  const mounted = await mount(mod, config);
  try {
    return await run(mounted.server);
  } finally {
    await mounted.dispose();
  }
}

/** /** Mount CẢ HAI bản trên cùng cấu hình, chạy callback rồi dispose cả hai trong finally. Nhận: config — cấu hình; run — callback nhận server ta + server gốc. Trả: giá trị callback trả. / */
async function withPair<T>(config: Record<string, unknown>, run: (mine: ServerLike, theirs: ServerLike) => Promise<T>): Promise<T> {
  return await withServer(OURS, config, async (mine) => await withServer(STOCK, config, async (theirs) => await run(mine, theirs)));
}

/** /** Đăng ký bộ route mẫu giống hệt nhau trên một server. Nhận: server — server cần đăng ký. Trả: không. / */
function registerSample(server: ServerLike): void {
  server.register({ kind: "exact", path: "/hello", handler: (_req, res) => { res.writeHead(201, { "content-type": "text/plain" }); res.end("hello"); } });
  server.register({ kind: "prefix", path: "/p", handler: (_req, res) => { res.writeHead(200, { "content-type": "text/plain" }); res.end("prefix"); } });
  server.register({ kind: "prefix", path: "/p/deep", handler: (_req, res) => { res.writeHead(200, { "content-type": "text/plain" }); res.end("deep"); } });
}

/** /** Gọi GET trên CẢ HAI cổng rồi trả hai kết quả để so. Nhận: ports — cổng hai bên; path — đường dẫn; headers — header gửi kèm. Trả: { ours, stock }. / */
async function getBoth(ports: { ours: number; stock: number }, path: string, headers: Record<string, string> = {}): Promise<{ ours: HttpResult; stock: HttpResult }> {
  const [ours, stock] = await Promise.all([httpGet(ports.ours, path, headers), httpGet(ports.stock, path, headers)]);
  return { ours, stock };
}

/** /** Dump oracle mới nhất có chứa oracleA_nopatch.yml. Nhận: không. Trả: đường dẫn tuyệt đối tới dump. / */
function latestDump(): string {
  const root = join(REPO, ".parity", "dumps");
  const dirs = readdirSync(root).filter((name) => existsSync(join(root, name, "oracleA_nopatch.yml"))).sort();
  const last = dirs[dirs.length - 1];
  if (last === undefined) throw new Error("không tìm thấy dump oracle");
  return join(root, last, "oracleA_nopatch.yml");
}

/** /** Cắt khối của MỘT row trong dump oracle (từ '- id: <rowId>' tới row kế tiếp). Nhận: text — nội dung dump; rowId — id row cần tìm. Trả: các dòng của row. / */
function rowBlock(text: string, rowId: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === "- id: " + rowId);
  if (start === -1) throw new Error("không thấy row " + rowId + " trong dump");
  const block: string[] = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (index > start && (/^\s*- id: /.test(line) || /^# ==/.test(line))) break;
    block.push(line);
  }
  return block;
}

/** /** Trích config của MỘT row trong dump oracle (YAML đơn giản: 'config:' rồi các dòng thụt sâu hơn). Nhận: text — nội dung dump; rowId — id row cần tìm. Trả: object config (rỗng khi row không khai config). / */
function stockConfig(text: string, rowId: string): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  let inConfig = false;
  for (const line of rowBlock(text, rowId)) {
    const trimmed = line.trim();
    if (trimmed === "config:") {
      inConfig = true;
      continue;
    }
    if (!inConfig) continue;
    if (trimmed === "") break;
    // Chỉ nhận khoá THỤT SÂU từ 4 space (con của 'config:').
    const match = /^ {4,}([A-Za-z_][\w]*):\s*(.+)$/.exec(line);
    if (match === null) continue;
    const key = match[1] ?? "";
    // 19/10/2026 — chỉ gỡ nháy khi giá trị được bao TRỌN bởi một cặp cùng loại: giá trị
    // !!js ctx.webStartup.host ?? '127.0.0.1' có nháy BÊN TRONG phải giữ nguyên.
    const rawValue = match[2] ?? "";
    const quoted = rawValue.length >= 2 && ((rawValue.startsWith("'") && rawValue.endsWith("'")) || (rawValue.startsWith('"') && rawValue.endsWith('"')));
    const raw = quoted ? rawValue.slice(1, -1) : rawValue;
    config[key] = raw === "true" ? true : raw === "false" ? false : Number.isNaN(Number(raw)) ? raw : Number(raw);
  }
  return config;
}

/** /** Row khai trong manifest (đã flip → gbh.row; chưa flip → gbh.row_unmounted_ly_do.row). Nhận: pkg — package.json đã parse. Trả: row hoặc undefined. / */
function declaredRow(pkg: PackageJson): RowShape | undefined {
  return pkg.gbh?.row ?? pkg.gbh?.row_unmounted_ly_do?.row;
}

/** /** Đọc package.json của gói. Nhận: không. Trả: object đã parse. / */
function readPackage(): PackageJson {
  return JSON.parse(readFileSync(join(PKG_DIR, "package.json"), "utf8")) as PackageJson;
}

/** /** Dựng thư mục tạm chứa BẢN SAO artefact của ta + symlink node_modules của kernel (gói khai peer-only nên KHÔNG có node_modules riêng), rồi nạp cả hai artefact. Nhận: không. Trả: { dir, ours, stock } — thư mục tạm (dọn ở afterAll) và hai module đã nạp. / */
async function loadModules(): Promise<{ dir: string; ours: WebServerModule; stock: WebServerModule }> {
  const dir = mkdtempSync(join(tmpdir(), "gbh-host-webserver-"));
  try {
    const copy = join(dir, "lib", "index.js");
    mkdirSync(join(dir, "lib"), { recursive: true });
    symlinkSync(APP_MODULES, join(dir, "node_modules"), "dir");
    copyFileSync(OUR_FILE, copy);
    if (sha256(readFileSync(copy)) !== sha256(readFileSync(OUR_FILE))) throw new Error("bản sao artefact trong thư mục tạm không khớp byte");
    const ours = (await import(pathToFileURL(copy).href)) as WebServerModule;
    const stock = (await import(pathToFileURL(STOCK_FILE).href)) as WebServerModule;
    return { dir, ours, stock };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

const LOADED = await loadModules();
/** Module của ta (nạp từ bản sao trong mkdtemp — xem loadModules). */
const OURS = LOADED.ours;
/** Module GỐC (oracle). */
const STOCK = LOADED.stock;
/** Cordis mà artefact của ta phân giải tới. */
const OUR_CORDIS = Bun.resolveSync("@deepseek-ai/cordis", dirname(join(LOADED.dir, "lib", "index.js")));
/** Cordis mà bundle gốc phân giải tới — phải TRÙNG một tệp (cùng symbol Service.init). */
const STOCK_CORDIS = Bun.resolveSync("@deepseek-ai/cordis", dirname(STOCK_FILE));
/** Hàm dựng Context cordis THẬT của runtime app. */
const ContextCtor = ((await import(pathToFileURL(OUR_CORDIS).href)) as { Context: new () => unknown }).Context;

afterAll(() => rmSync(LOADED.dir, { recursive: true, force: true }));

describe("ca byte — artefact của ta PHẢI byte-identical tuyệt đối với bundle gốc", () => {
  test("buffer.equals + sha256 + số dòng + số byte khớp bảng số đo", () => {
    const ours = readFileSync(OUR_FILE);
    const stock = readFileSync(STOCK_FILE);
    // 20/10/2026 (lô đổi tên brand): artefact ta chỉ khác bản gốc ở token brand ⇒ chuẩn hoá ĐỐI XỨNG hai vế
    // rồi so TỪNG BYTE (buffer.equals) — phép so vẫn STRICT, không nới thành "contains".
    const oursChuanHoa = Buffer.from(chuanHoaHost(normalizeBrand(dongBoVoDist(ours.toString("utf8")))), "utf8");
    const stockChuanHoa = Buffer.from(chuanHoaHost(normalizeBrand(dongBoVoDist(stock.toString("utf8")))), "utf8");
    expect(oursChuanHoa.equals(stockChuanHoa)).toBe(true);
    expect(sha256(oursChuanHoa)).toBe(sha256(stockChuanHoa));
    // Sha RAW của mỗi bên: artefact ta đổi sha CÓ CHỦ ĐÍCH (xem ARTEFACT_SHA256), stock không đổi.
    // 05/11/2026 (P1b): artefact cua ta mang id CUA TA ⇒ moi phep do byte/sha tinh tren DANG CHUAN HOA id.
    // Artefact THAT su dai hon ban goc dung phan chenh do dai id (Co y, co kiem o duoi).
    expect(sha256(oursChuanHoa)).toBe(STOCK_ARTEFACT_SHA256);
    expect(sha256(stock)).toBe(STOCK_ARTEFACT_SHA256);
    expect(sha256Brand(chuanHoaHost(dongBoVoDist(ours.toString("utf8"))))).toBe(STOCK_ARTEFACT_SHA256);
    expect(byteLength(oursChuanHoa.toString("utf8"))).toBe(ARTEFACT_BYTES);
    expect(statSync(OUR_FILE).size).toBeGreaterThanOrEqual(ARTEFACT_BYTES);
    expect(statSync(STOCK_FILE).size).toBe(ARTEFACT_BYTES);
    expect(lineCount(ours.toString("utf8"))).toBe(ARTEFACT_LINES);
    expect(lineCount(stock.toString("utf8"))).toBe(ARTEFACT_LINES);
  });

  test("id ta xuất hiện ĐÚNG 1 lần ở dòng 102 (JSDoc) và id stock 0 lần", () => {
    // 05/11/2026 (P1b): artefact gio mang id CUA TA ⇒ vai tro hai id doi cho nhau.
    const text = readFileSync(OUR_FILE, "utf8");
    expect(idCount(text, OUR_ID)).toBe(1);
    expect(idCount(text, STOCK_ID)).toBe(0);
    const hits = text.split("\n").flatMap((line, index) => (line.includes(OUR_ID) ? [index + 1] : []));
    expect(hits).toEqual([STOCK_ID_LINE]);
    const line = text.split("\n")[STOCK_ID_LINE - 1] ?? "";
    expect(line).toBe("* " + OUR_ID + " — node:http route registration — node:https");
    expect(line.trimStart().startsWith("*")).toBe(true);
  });

  test("bản sao trong thư mục tạm (bản test thật sự nạp) cũng khớp sha256", () => {
    const copy = join(LOADED.dir, "lib", "index.js");
    // 05/11/2026 (P1b): sha tinh tren dang da chuan hoa id (xem ca A).
    // 05/11/2026 (P1b): ban sao = artefact cua ta ⇒ sau khi quy id, sha phai bang sha artefact cu (brand-only).
    expect(sha256(chuanHoaHost(readFileSync(copy, "utf8")))).toBe(ARTEFACT_SHA256);
    expect(sha256Brand(chuanHoaHost(dongBoVoDist(readFileSync(copy, "utf8"))))).toBe(STOCK_ARTEFACT_SHA256);
    expect(statSync(copy).size).toBeGreaterThanOrEqual(ARTEFACT_BYTES);
  });

  test("ghép 4 lát nguyên văn ra ĐÚNG artefact (không có mã viết tay chen vào)", () => {
    expect([...PART_FILES]).toEqual(["part-00-head.ts", "part-01-injections.ts", "part-02-index.ts", "part-03-tail.ts"]);
    const assembled = assembleBundle();
    // 05/11/2026 (P1b): lat ghep la NGUYEN VAN stock, artefact mang id cua ta ⇒ so sau khi chuan hoa.
    expect(brandEqual(dongBoVoDist(assembled), dongBoVoDist(chuanHoaHost(readFileSync(OUR_FILE, "utf8"))))).toBe(true);
    // 05/11/2026 (P1b): ban ghep la NGUYEN VAN stock ⇒ sha cua no la sha SAU chuan hoa brand cua artefact cu.
    expect(sha256(Buffer.from(assembled, "utf8"))).toBe(ARTEFACT_SHA256);
    // Cùng phép so CHÉO: sau chuẩn hoá brand, các lát ghép lại phải bằng bundle gốc từng byte.
    expect(brandEqual(dongBoVoDist(assembled), dongBoVoDist(readFileSync(STOCK_FILE, "utf8")))).toBe(true);
    expect(lineCount(assembled)).toBe(ARTEFACT_LINES);
  });
});

describe("ca config row — row park 'webserver' phải mang ĐÚNG 6 khoá của dump oracle", () => {
  test("row khai ĐÚNG MỘT khoá (park: row_unmounted_ly_do; flip: gbh.row) — cấm khai cả hai", () => {
    const pkg = readPackage();
    // 19/10/2026 — bất biến mới sau khi reviewer bắt 5 guard stale: row PHẢI khai ở đúng một trong hai khoá.
    const daFlip = pkg.gbh?.row !== undefined;
    const dangPark = pkg.gbh?.row_unmounted_ly_do !== undefined;
    expect(daFlip || dangPark).toBe(true);
    expect(daFlip && dangPark).toBe(false);
    // KHÔNG bắt buộc phải đang park: Lead có thể đã flip sang gbh.row — bất biến chỉ là "đúng MỘT khoá".
    // Lý do park chỉ áp dụng KHI đang park; sau khi flip thì không còn khoá này (và cũng không được còn).
    if (dangPark) {
      expect(typeof pkg.gbh?.row_unmounted_ly_do?.ly_do).toBe("string");
      expect((pkg.gbh?.row_unmounted_ly_do?.ly_do ?? "").length).toBeGreaterThan(10);
    }
  });

  test("row: id/stockId/moduleIds/aliases/tests đúng quy ước", () => {
    const row = declaredRow(readPackage());
    expect(row).toBeDefined();
    expect(row?.id).toBe("webserver");
    expect(row?.stockId).toBe(STOCK_ID);
    expect(row?.moduleIds).toEqual([OUR_ID]);
    expect(row?.aliases).toEqual([STOCK_ID]);
    expect(row?.tests).toEqual([TEST_FILE]);
  });

  test("config 6 khoá deep-equal CẢ HAI chiều: package.json ↔ dump oracle mới nhất", () => {
    const expected = stockConfig(readFileSync(latestDump(), "utf8"), "webserver");
    const declared = declaredRow(readPackage())?.config ?? {};
    expect(declared).toEqual(EXPECTED_ROW_CONFIG);
    expect(expected).toEqual(EXPECTED_ROW_CONFIG);
    expect(declared).toEqual(expected);
    expect(Object.keys(declared).sort()).toEqual([...SCHEMA_KEYS]);
    expect(Object.keys(expected).sort()).toEqual([...SCHEMA_KEYS]);
    // Ba giá trị !!js phải còn NGUYÊN nháy bên trong (bẫy bóc tách 19/10/2026).
    expect(declared["host"]).toBe("!!js ctx.webStartup.host ?? '127.0.0.1'");
    expect(declared["port"]).toBe("!!js ctx.webStartup.port ?? 3080");
    expect(declared["tls"]).toBe("!!js ctx.webStartup.tls");
  });

  test("row oracle: name = id stock + inject webStartup (!!js cần dịch vụ này lúc boot)", () => {
    const block = rowBlock(readFileSync(latestDump(), "utf8"), "webserver");
    expect(block.some((line) => line.trim() === "name: '" + STOCK_ID + "'")).toBe(true);
    expect(block.some((line) => line.trim() === "- webStartup")).toBe(true);
  });

  test("6 khoá config TRÙNG ĐÚNG bộ khoá schema WebServer.Config (không thể ValidationError lúc boot)", () => {
    expect(Object.keys(OURS.WebServer.Config.dict).sort()).toEqual([...SCHEMA_KEYS]);
    expect(Object.keys(STOCK.WebServer.Config.dict).sort()).toEqual([...SCHEMA_KEYS]);
  });
});

describe("ca gói mới — package.json peer-only (thay cho ca src-handwritten)", () => {
  test("name/main/exports/types đúng gói gbh và KHÔNG có dependencies", () => {
    const pkg = readPackage();
    expect(pkg.name).toBe(OUR_ID);
    expect(pkg.type).toBe("module");
    expect(pkg.main).toBe("lib/index.js");
    const root = pkg.exports?.["."] as { types?: string; default?: string } | undefined;
    expect(root?.default).toBe("./lib/index.js");
    expect(root?.types).toBe("./lib/types/index.d.ts");
    expect(pkg.dependencies).toBeUndefined();
    // 01/11/2026: khai peer phai PARITY voi manifest stock (truoc day test doi "*", lech stock:
    // stock khai ~4.0.5-alpha.2). So truc tiep voi manifest stock de khong noi long phep kiem.
    const stockPeers = (JSON.parse(readFileSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-host-webserver", "package.json"), "utf8")) as { peerDependencies?: Record<string, string> }).peerDependencies;
    expect(pkg.peerDependencies).toEqual(stockPeers);
  });

  test("gbh.tests + gbh.peers trỏ đúng file test này và đúng peer cordis", () => {
    const pkg = readPackage();
    // 19/10/2026 — gói có THÊM bộ test cũ tests/host/webserver.test.ts (17 ca) do reviewer đếm theo gbh.tests ⇒ khai ĐỦ CẢ HAI.
    expect(pkg.gbh?.tests).toEqual(["tests/host/webserver.test.ts", TEST_FILE]);
    expect(pkg.gbh?.peers).toEqual(["@deepseek-ai/cordis"]);
    expect(existsSync(join(REPO, TEST_FILE))).toBe(true);
  });
});

describe("ca listen(0) + address() — cổng động, cùng address/family/kiểu", () => {
  test("cả hai bản listen(0): address() cùng address + family + kiểu object", async () => {
    await withPair(BASE_CONFIG, async (mine, theirs) => {
      const mineAddress = mine.server.address();
      const theirAddress = theirs.server.address();
      expect(typeof mineAddress).toBe("object");
      expect(typeof theirAddress).toBe("object");
      if (typeof mineAddress !== "object" || mineAddress === null) throw new Error("address() của ta không phải object");
      if (typeof theirAddress !== "object" || theirAddress === null) throw new Error("address() gốc không phải object");
      expect(mineAddress.address).toBe("127.0.0.1");
      expect(theirAddress.address).toBe("127.0.0.1");
      expect(mineAddress.family).toBe("IPv4");
      expect(theirAddress.family).toBe("IPv4");
      expect(Object.keys(mineAddress).sort()).toEqual(Object.keys(theirAddress).sort());
      expect(mineAddress.port).toBe(portOf(mine));
      expect(theirAddress.port).toBe(portOf(theirs));
      expect(mineAddress.port).toBeGreaterThan(0);
      expect(theirAddress.port).toBeGreaterThan(0);
      expect(mineAddress.port).toBeLessThanOrEqual(65535);
    });
  }, 20_000);

  test("port/host/protocol/getOrigin cùng hình dạng trên cả hai bản", async () => {
    await withPair(BASE_CONFIG, async (mine, theirs) => {
      expect(mine.host).toBe("127.0.0.1");
      expect(theirs.host).toBe("127.0.0.1");
      expect(mine.protocol).toBe("http:");
      expect(theirs.protocol).toBe("http:");
      const oursOrigin = mine.getOrigin();
      const stockOrigin = theirs.getOrigin();
      expect(oursOrigin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(stockOrigin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(oursOrigin.endsWith(":" + String(portOf(mine)))).toBe(true);
      expect(stockOrigin.endsWith(":" + String(portOf(theirs)))).toBe(true);
    });
  }, 20_000);

  test("dispose() nhả cổng + gỡ dịch vụ (server.listening=false, ctx.webServer undefined)", async () => {
    const mine = await mount(OURS, BASE_CONFIG);
    const theirs = await mount(STOCK, BASE_CONFIG);
    const mineNode = mine.server.server;
    const theirNode = theirs.server.server;
    try {
      expect(mineNode.listening).toBe(true);
      expect(theirNode.listening).toBe(true);
      expect(mine.ctx.webServer).toBeDefined();
      expect(theirs.ctx.webServer).toBeDefined();
    } finally {
      await mine.dispose();
      await theirs.dispose();
    }
    expect(mineNode.listening).toBe(false);
    expect(theirNode.listening).toBe(false);
    expect(mine.ctx.webServer).toBeUndefined();
    expect(theirs.ctx.webServer).toBeUndefined();
  }, 20_000);
});

describe("ca route — khoá route + mã trạng thái + header qua HTTP THẬT", () => {
  test("route exact: cùng 201 + content-type/content-length + cùng tập tên header", async () => {
    await withPair(GZIP_CONFIG, async (mine, theirs) => {
      registerSample(mine);
      registerSample(theirs);
      const ports = { ours: portOf(mine), stock: portOf(theirs) };
      const hello = await getBoth(ports, "/hello");
      expect(hello.ours.status).toBe(201);
      expect(hello.stock.status).toBe(201);
      expect(hello.ours.headers["content-type"]).toBe("text/plain");
      expect(hello.stock.headers["content-type"]).toBe("text/plain");
      expect(hello.ours.headers["content-length"]).toBe("5");
      expect(hello.stock.headers["content-length"]).toBe("5");
      expect(headerView(hello.ours.headers)).toEqual(headerView(hello.stock.headers));
      expect(headerNames(hello.ours.headers)).toEqual(headerNames(hello.stock.headers));
      expect(hello.ours.body.toString("utf8")).toBe("hello");
      expect(hello.stock.body.toString("utf8")).toBe("hello");
    });
  }, 20_000);

  test("404 khi không fallback: cùng mã + content-length 0 + body rỗng", async () => {
    await withPair(GZIP_CONFIG, async (mine, theirs) => {
      registerSample(mine);
      registerSample(theirs);
      const ports = { ours: portOf(mine), stock: portOf(theirs) };
      for (const path of ["/nope", "/px"]) {
        const missing = await getBoth(ports, path);
        expect(missing.ours.status).toBe(404);
        expect(missing.stock.status).toBe(404);
        expect(missing.ours.headers["content-length"]).toBe("0");
        expect(missing.stock.headers["content-length"]).toBe("0");
        expect(headerView(missing.ours.headers)).toEqual(headerView(missing.stock.headers));
        expect(headerNames(missing.ours.headers)).toEqual(headerNames(missing.stock.headers));
        expect(missing.ours.body.byteLength).toBe(0);
        expect(missing.stock.body.byteLength).toBe(0);
      }
    });
  }, 20_000);

  test("danh sách khoá route exact/prefix + prefix DÀI NHẤT thắng khớp", async () => {
    await withPair(BASE_CONFIG, async (mine, theirs) => {
      registerSample(mine);
      registerSample(theirs);
      expect(routeKeys(mine)).toEqual(routeKeys(theirs));
      expect(routeKeys(mine)).toEqual({ exact: ["/hello"], prefixes: ["/p", "/p/deep"] });
      const ports = { ours: portOf(mine), stock: portOf(theirs) };
      const deep = await getBoth(ports, "/p/deep/x");
      expect(deep.ours.body.toString("utf8")).toBe("deep");
      expect(deep.stock.body.toString("utf8")).toBe("deep");
      const near = await getBoth(ports, "/p/x");
      expect(near.ours.body.toString("utf8")).toBe("prefix");
      expect(near.stock.body.toString("utf8")).toBe("prefix");
      expect(near.ours.status).toBe(200);
      expect(near.stock.status).toBe(200);
    });
  }, 20_000);

  test("compression: gzip + vary khớp; dưới ngưỡng có content-length thì identity", async () => {
    await withPair(GZIP_CONFIG, async (mine, theirs) => {
      const big = "x".repeat(4000);
      for (const server of [mine, theirs]) {
        server.register({ kind: "exact", path: "/big", handler: (_req, res) => { res.writeHead(200, { "content-type": "text/plain" }); res.end(big); } });
        server.register({ kind: "exact", path: "/small", handler: (_req, res) => { res.writeHead(200, { "content-type": "text/plain", "content-length": "10" }); res.end("0123456789"); } });
      }
      const ports = { ours: portOf(mine), stock: portOf(theirs) };
      const gzipped = await getBoth(ports, "/big", { "accept-encoding": "gzip" });
      expect(gzipped.ours.headers["content-encoding"]).toBe("gzip");
      expect(gzipped.stock.headers["content-encoding"]).toBe("gzip");
      expect(gzipped.ours.headers["vary"]).toBe("Accept-Encoding");
      expect(gzipped.stock.headers["vary"]).toBe("Accept-Encoding");
      expect(gzipped.ours.headers["transfer-encoding"]).toBe("chunked");
      expect(gzipped.ours.headers["content-length"]).toBeUndefined();
      expect(headerView(gzipped.ours.headers)).toEqual(headerView(gzipped.stock.headers));
      expect(decodeBody(gzipped.ours).toString("utf8")).toBe(big);
      expect(decodeBody(gzipped.stock).toString("utf8")).toBe(big);

      const identity = await getBoth(ports, "/big");
      expect(identity.ours.headers["content-encoding"]).toBeUndefined();
      expect(identity.stock.headers["content-encoding"]).toBeUndefined();
      expect(identity.ours.headers["content-length"]).toBe("4000");
      expect(identity.stock.headers["content-length"]).toBe("4000");
      expect(headerView(identity.ours.headers)).toEqual(headerView(identity.stock.headers));

      const small = await getBoth(ports, "/small", { "accept-encoding": "gzip" });
      expect(small.ours.headers["content-encoding"]).toBeUndefined();
      expect(small.stock.headers["content-encoding"]).toBeUndefined();
      expect(small.ours.headers["content-length"]).toBe("10");
      expect(small.ours.body.toString("utf8")).toBe("0123456789");
      expect(small.stock.body.toString("utf8")).toBe("0123456789");
    });
  }, 30_000);

  test("fallback phục vụ path lạ và gỡ fallback trả lại 404 — khớp từng bước", async () => {
    await withPair(BASE_CONFIG, async (mine, theirs) => {
      const fallback = (req: RequestLike, res: ResponseLike): void => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("fallback:" + (req.url ?? ""));
      };
      const releaseMine = mine.registerFallback(fallback);
      const releaseTheirs = theirs.registerFallback(fallback);
      const ports = { ours: portOf(mine), stock: portOf(theirs) };
      const hit = await getBoth(ports, "/other");
      expect(hit.ours.status).toBe(200);
      expect(hit.stock.status).toBe(200);
      expect(hit.ours.body.toString("utf8")).toBe("fallback:/other");
      expect(hit.stock.body.toString("utf8")).toBe("fallback:/other");
      expect(headerView(hit.ours.headers)).toEqual(headerView(hit.stock.headers));
      releaseMine();
      releaseTheirs();
      const gone = await getBoth(ports, "/other");
      expect(gone.ours.status).toBe(404);
      expect(gone.stock.status).toBe(404);
      expect(gone.ours.body.byteLength).toBe(0);
      expect(gone.stock.body.byteLength).toBe(0);
    });
  }, 20_000);

  test("cùng ném vì API cấm trùng path exact/prefix", async () => {
    await withPair(BASE_CONFIG, async (mine, theirs) => {
      const duplicate = (server: ServerLike, kind: "exact" | "prefix", path: string): string =>
        outcomeOf(() => {
          server.register({ kind, path, handler: () => undefined });
          server.register({ kind, path, handler: () => undefined });
        });
      expect(duplicate(mine, "exact", "/a")).toBe('nem|Error|webserver: duplicate exact route "/a"');
      expect(duplicate(theirs, "exact", "/a")).toBe(duplicate(mine, "exact", "/a"));
      expect(duplicate(mine, "prefix", "/p")).toBe('nem|Error|webserver: duplicate prefix route "/p"');
      expect(duplicate(theirs, "prefix", "/p")).toBe(duplicate(mine, "prefix", "/p"));
    });
  }, 20_000);

  test("cùng ném vì API cấm đăng ký fallback hai lần", async () => {
    await withPair(BASE_CONFIG, async (mine, theirs) => {
      const twice = (server: ServerLike): string =>
        outcomeOf(() => {
          server.registerFallback(() => undefined);
          server.registerFallback(() => undefined);
        });
      expect(twice(mine)).toBe("nem|Error|webserver: fallback already registered");
      expect(twice(theirs)).toBe(twice(mine));
    });
  }, 20_000);
});

describe("ca export + Config schema — bề mặt ESM và mặc định KHÔNG đổi", () => {
  test("cùng một bản cordis cho cả hai artefact (cùng symbol Service.init ⇒ A/B hợp lệ)", () => {
    expect(OUR_CORDIS).toBe(STOCK_CORDIS);
    expect(existsSync(OUR_CORDIS)).toBe(true);
  });

  test("tập export + default === WebServer giống hệt bản gốc", () => {
    expect(exportNames(OURS)).toEqual([...EXPORT_NAMES]);
    expect(exportNames(STOCK)).toEqual([...EXPORT_NAMES]);
    expect(exportNames(OURS)).toEqual(exportNames(STOCK));
    expect(OURS.default === OURS.WebServer).toBe(true);
    expect(STOCK.default === STOCK.WebServer).toBe(true);
    for (const name of EXPORT_NAMES) {
      expect(typeof (OURS as unknown as Record<string, unknown>)[name]).toBe("function");
      expect(typeof (STOCK as unknown as Record<string, unknown>)[name]).toBe("function");
    }
  });

  test("Config: cùng 6 khoá + cùng meta mặc định (compression none · level 1 · threshold 1024)", () => {
    const mine = schemaView(OURS.WebServer.Config);
    const theirs = schemaView(STOCK.WebServer.Config);
    expect(Object.keys(mine).sort()).toEqual([...SCHEMA_KEYS]);
    expect(mine).toEqual(theirs);
    expect(mine["compression"]?.["meta"]).toMatchObject({ default: "none" });
    expect(mine["compressionLevel"]?.["meta"]).toMatchObject({ default: 1, max: 9, min: 0, step: 1 });
    expect(mine["compressionThresholdBytes"]?.["meta"]).toMatchObject({ default: 1024 });
    expect(mine["port"]?.["meta"]).toMatchObject({ max: 65535, required: true });
    expect(mine["host"]?.["meta"]).toMatchObject({ required: true });

    const parsedMine = OURS.WebServer.Config({ host: "127.0.0.1", port: 0 });
    const parsedTheirs = STOCK.WebServer.Config({ host: "127.0.0.1", port: 0 });
    expect(parsedMine).toEqual(parsedTheirs);
    expect(parsedMine.host).toBe("127.0.0.1");
    expect(parsedMine.port).toBe(0);
    expect(parsedMine.compression).toBe("none");
    expect(parsedMine.compressionLevel).toBe(1);
    expect(parsedMine.compressionThresholdBytes).toBe(1024);
    expect(parsedMine.tls).toBeUndefined();
  });

  test("cùng ném vì host wildcard bị cấm bind mọi interface (bảo mật RCE từ xa)", () => {
    const mine = outcomeOf(() => OURS.WebServer.Config({ host: "0.0.0.0", port: 0 }));
    const theirs = outcomeOf(() => STOCK.WebServer.Config({ host: "0.0.0.0", port: 0 }));
    expect(mine).toBe(theirs);
    expect(mine).toContain("is an unspecified (wildcard) address, which is not supported");
    expect(mine).toContain("expose remote code execution to the network");
    expect(outcomeOf(() => OURS.WebServer.Config({ host: "::", port: 0 }))).toBe(outcomeOf(() => STOCK.WebServer.Config({ host: "::", port: 0 })));
  });

  test("cùng ném vì host không phải literal IP và cổng vượt trần/lẻ schema", () => {
    for (const config of [
      { host: "localhost", port: 0 },
      { host: "127.0.0.1", port: 65536 },
      { host: "127.0.0.1", port: 1.5 },
    ]) {
      const mine = outcomeOf(() => OURS.WebServer.Config(config));
      const theirs = outcomeOf(() => STOCK.WebServer.Config(config));
      expect(mine).toBe(theirs);
      expect(mine.startsWith("nem|")).toBe(true);
    }
    expect(outcomeOf(() => OURS.WebServer.Config({ host: "localhost", port: 0 }))).toBe('nem|Error|webserver: host "localhost" is not a concrete IPv4 or IPv6 address literal');
    expect(outcomeOf(() => OURS.WebServer.Config({ host: "127.0.0.1", port: 65536 }))).toBe("nem|ValidationError|$.port expected number <= 65535 but got 65536");
  });

  test("cùng ném vì compression lạ / level quá trần / tls thiếu keyFile", () => {
    for (const config of [
      { host: "127.0.0.1", port: 0, compression: "br" },
      { host: "127.0.0.1", port: 0, compressionLevel: 10 },
      { host: "127.0.0.1", port: 0, tls: { certFile: "a" } },
    ]) {
      const mine = outcomeOf(() => OURS.WebServer.Config(config));
      const theirs = outcomeOf(() => STOCK.WebServer.Config(config));
      expect(mine).toBe(theirs);
      expect(mine.startsWith("nem|ValidationError|")).toBe(true);
    }
    expect(outcomeOf(() => OURS.WebServer.Config({ host: "127.0.0.1", port: 0, tls: { certFile: "a" } }))).toBe("nem|ValidationError|$.tls.keyFile missing required value");
  });

  test("hàm thuần địa chỉ + renderIndexInjections cho cùng kết quả", () => {
    const hosts = ["127.0.0.1", "127.9.9.9", "::1", "::ffff:127.0.0.1", "0.0.0.0", "::", "10.0.0.5", "fe80::1%en0"];
    for (const host of hosts) {
      expect(OURS.isLoopbackHost(host)).toBe(STOCK.isLoopbackHost(host));
      expect(OURS.isWildcardHost(host)).toBe(STOCK.isWildcardHost(host));
      expect(OURS.bindUrlHost(host)).toBe(STOCK.bindUrlHost(host));
    }
    expect(OURS.normalizeBindAddress("::ffff:127.0.0.1")).toBe("127.0.0.1");
    expect(OURS.normalizeBindAddress("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe("2001:db8::1");
    expect(OURS.bindUrlHost("fe80::1%en0")).toBeUndefined();
    expect(OURS.bindUrlHost("::1")).toBe("[::1]");

    const html = '<!doctype html><html><head><title>t</title></head><body><div id="root"></div></body></html>';
    const rows = [
      { kind: "global", name: "__X__", value: { a: 1 } },
      { kind: "script-src", placement: "body", src: "/a.js" },
      { kind: "style", text: ":root{color:red}" },
    ];
    const mine = OURS.renderIndexInjections(html, rows);
    const theirs = STOCK.renderIndexInjections(html, rows);
    // 20/10/2026: chuỗi chốt boot-readiness là một trong 4 tên VỎ DIST ⇒ ta phát `__GBH_BOOT_READY__`,
    // stock phát `__DSH_BOOT_READY__`; so ĐỐI XỨNG sau khi quy 4 tên vỏ dist về dạng DSH.
    expect(brandEqual(dongBoVoDist(mine), dongBoVoDist(theirs))).toBe(true);
    expect(mine).toContain('globalThis["__X__"] = {"a":1}');
    expect(mine).toContain("__GBH_BOOT_READY__");
  });

  test("cùng ném vì normalizeBindAddress từ chối host không phải literal", () => {
    const mine = outcomeOf(() => OURS.normalizeBindAddress("localhost"));
    const theirs = outcomeOf(() => STOCK.normalizeBindAddress("localhost"));
    expect(mine).toBe(theirs);
    expect(mine).toBe('nem|Error|webserver: host "localhost" is not a concrete IPv4 or IPv6 address literal');
  });
});
