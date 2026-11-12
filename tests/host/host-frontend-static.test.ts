/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho gói @galaxy-blackhole/gbh-host-frontend-static — port 1:1 bundle gốc 99 dòng /
 *      3.899 B / sha256 19bb095c…19a2: ca byte (Buffer.equals + sha + số dòng + số byte + 2 id stock ở
 *      JSDoc dòng 6 + 16 + 0 lần đổi tên), ca ghép 3 lát bằng src/assemble.ts, ca export/Config (khoá
 *      distIndex REQUIRED — cùng ném cùng thông điệp), ca BẢO MẬT serveStatic dựng dist trong mkdtemp
 *      (200 ở dist root + index path, 404 thiếu path, 403 traversal ra ngoài dist root, 200 asset +
 *      MIME), ca apply (fallback seat, 405, base href, index-missing 404, asset công khai) và ca
 *      package.json THƯ VIỆN (KHÔNG gbh.row/row_unmounted_ly_do, có draft, tests trỏ tệp này).
 */

import { afterAll, describe, expect, test } from "bun:test";
import { chuanHoaHost, soByte as ByteLen } from "../lib/artefact-normalize.ts";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { assembleBundle } from "../../packages/host/host-frontend-static/src/assemble.ts";
import { PART_FILES } from "../../packages/host/host-frontend-static/src/manifest.ts";

/** Gốc repo (tests/host ⇒ ../..). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG_DIR = join(REPO, "packages", "host", "host-frontend-static");
/** Artefact của ta — bản byte-identical của bundle gốc. */
const OUR_FILE = join(PKG_DIR, "lib", "index.js");
/** Thư mục gói GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_PKG_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-host-frontend-static");
/** Bundle GỐC. */
const STOCK_FILE = join(STOCK_PKG_DIR, "lib", "index.js");
/** node_modules của kernel — nguồn duy nhất có @deepseek-ai/schemastery. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Tệp test này (phải được gbh.tests trỏ tới). */
const TEST_FILE = "tests/host/host-frontend-static.test.ts";
/** Số dòng theo wc -l. */
const ARTEFACT_LINES = 99;
/** Số byte trên đĩa. */
const ARTEFACT_BYTES = 3899;
/** SHA-256 của artefact (và của bundle gốc — byte-identical tuyệt đối). */
const ARTEFACT_SHA256 = "19bb095c5175bd5dc6532aa97512e2013a132e5073558ba4b059b8ad5b0f19a2";
/** Id gói GỐC — xuất hiện ĐÚNG 2 lần, cả hai ở JSDoc (dòng 6 + 16). */
const STOCK_ID = "@deepseek-ai/dsh-host-frontend-static";
/** Id gói của ta — 0 lần trong artefact (vì byte-identical). */
const OUR_ID = "@galaxy-blackhole/gbh-host-frontend-static";
/** Hai dòng JSDoc chứa id gốc (1-based). */
const STOCK_ID_LINES: readonly number[] = [6, 16];
/** Tập export ESM của artefact, đã sắp xếp. */
const EXPORT_NAMES: readonly string[] = ["Config", "apply", "inject", "name", "serveStatic"];
/** Khoá schema Config duy nhất — distIndex REQUIRED. */
const SCHEMA_KEYS: readonly string[] = ["distIndex"];
/** Tên plugin Cordis ổn định. */
const PLUGIN_NAME = "frontend-static";
/** Hai dịch vụ bắt buộc trước khi nhận fallback seat. */
const INJECT = ["webServer", "connection"];
/** Nhãn effect mà apply đăng ký. */
const EFFECT_LABEL = "frontend-static: fallback seat";
/** index.html mẫu của dist tạm (head KHÔNG thuộc tính để kiểm tra chèn base). */
const INDEX_HTML = '<!doctype html><html><head><meta charset="utf-8"><title>gbh</title></head><body><div id="root"></div><script type="module" src="./assets/app.js"></script></body></html>';
/** Body do renderIndex giả lập trả về — chứng minh index đi qua render, KHÔNG đọc thẳng file. */
const RENDERED_INDEX = "<!doctype html><html><body>render-index</body></html>";
/** Nội dung asset JS. */
const ASSET_JS = "console.log('gbh');\n";
/** Nội dung asset CSS. */
const ASSET_CSS = ":root{color:red}\n";
/** Nội dung asset SVG. */
const ASSET_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>\n';
/** Byte asset đuôi lạ — phải ship octet-stream NGUYÊN BYTE. */
const ASSET_BLOB = Buffer.from([0, 1, 2, 255]);
/** Nội dung bí mật nằm NGOÀI dist root — chứng minh traversal bị 403 chứ không phải 404. */
const SECRET_TEXT = "TOPSECRET\n";

/** Phản hồi node tối thiểu mà serveStatic chạm tới. */
interface ResponseLike {
  writeHead(status: number, headers?: Record<string, string>): unknown;
  end(body?: string | Buffer): unknown;
}

/** Bản ghi một phản hồi giả — so mã + header + body giữa hai bản. */
interface ResponseRecord {
  status: number;
  headers: Record<string, string>;
  body: string | Buffer | undefined;
  ended: boolean;
}

/** Một trường schemastery (chỉ đọc phần test chạm). */
interface ConfigField {
  meta?: Record<string, unknown>;
  type?: string;
}

/** Schema cấu hình: gọi được để parse + bảng trường. */
interface ConfigSchema {
  (input: unknown): Record<string, unknown>;
  dict: Record<string, ConfigField>;
}

/** Handler fallback mà apply đăng ký. */
type StaticHandler = (req: { method?: string; url?: string }, res: ResponseLike) => Promise<void> | void;

/** Bề mặt module artefact (của ta hoặc bản gốc). */
interface StaticModule {
  name: string;
  inject: string[];
  Config: ConfigSchema;
  serveStatic(
    pathname: string,
    res: ResponseLike,
    distRoot: string,
    distIndex: string,
    authorizeIndex: () => boolean,
    renderIndex: () => Promise<string>,
  ): Promise<void>;
  apply(ctx: ApplyContext, config: { distIndex: string }): void;
}

/** WebServer tối thiểu mà apply dùng. */
interface WebServerLike {
  registerFallback(handler: StaticHandler): () => void;
  renderIndex(html: string): string;
}

/** Context cordis tối thiểu mà apply dùng. */
interface ApplyContext {
  webServer: WebServerLike;
  connection: { authorizeIndex(req: unknown, res: unknown): boolean };
  effect(run: () => () => void, label?: string): () => void;
}

/** Bộ dò context: nhãn effect, fallback đã đăng ký, html đã render, số lần authorize. */
interface ContextProbe {
  ctx: ApplyContext;
  labels: string[];
  fallbacks: StaticHandler[];
  renders: string[];
  authorizes: number;
  releases: number;
}

/** Bộ tệp dist tạm dựng trong mkdtemp. */
interface DistFixture {
  root: string;
  dist: string;
  distIndex: string;
  missingIndex: string;
  secret: string;
}

/** Tuỳ chọn của một lượt serveStatic. */
interface ServeOptions {
  authorize?: boolean;
  render?: () => Promise<string>;
}

/** Quan sát một lượt serveStatic: phản hồi + số lần gọi hook. */
interface ServeObservation {
  record: ResponseRecord;
  authorizes: number;
  renders: number;
}

/** Hình dạng package.json mà test đọc. */
interface PackageJson {
  name?: string;
  type?: string;
  main?: string;
  exports?: Record<string, unknown>;
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  dsh?: unknown;
  gbh?: {
    tests?: string[];
    peers?: string[];
    draft?: string;
    row?: unknown;
    row_unmounted_ly_do?: unknown;
  };
}

/**
 * Băm SHA-256.
 * Nhận: input — Buffer hoặc chuỗi UTF-8. Trả: chuỗi hex 64 ký tự.
 */
function sha256(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Đếm số dòng theo nghĩa wc -l (số ký tự xuống dòng).
 * Nhận: text — văn bản cần đếm. Trả: số ký tự xuống dòng.
 */
function lineCount(text: string): number {
  return text.split("\n").length - 1;
}

/**
 * Đo độ dài byte UTF-8 của một chuỗi.
 * Nhận: text — chuỗi cần đo. Trả: số byte khi mã hoá UTF-8.
 */
function byteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/**
 * Đếm số lần một id xuất hiện trong văn bản.
 * Nhận: text — văn bản cần đếm; id — chuỗi id cần tìm. Trả: số lần xuất hiện.
 */
function idCount(text: string, id: string): number {
  return text.split(id).length - 1;
}

/**
 * Danh sách tên export của một module ESM, đã sắp xếp.
 * Nhận: mod — module namespace. Trả: mảng tên export đã sắp xếp.
 */
function exportNames(mod: object): string[] {
  return Object.keys(mod).sort();
}

/**
 * Rút gọn schema Config thành bảng so sánh được (khoá ⇒ meta + type).
 * Nhận: schema — Config của module. Trả: object khoá ⇒ { meta, type }.
 */
function schemaView(schema: ConfigSchema): Record<string, Record<string, unknown>> {
  const view: Record<string, Record<string, unknown>> = {};
  for (const [key, field] of Object.entries(schema.dict)) view[key] = { meta: field.meta ?? {}, type: field.type ?? "-" };
  return view;
}

/**
 * Chạy một thao tác đồng bộ và ghi kết quả/lỗi thành chuỗi so sánh được.
 * Nhận: run — thao tác cần chạy. Trả: "ok" hoặc "nem|<tên lớp>|<thông điệp>".
 */
function outcomeOf(run: () => unknown): string {
  try {
    run();
    return "ok";
  } catch (error) {
    const failure = error as Error;
    return "nem|" + failure.name + "|" + failure.message;
  }
}

/**
 * Chạy một thao tác BẤT ĐỒNG BỘ và ghi kết quả/lỗi thành chuỗi so sánh được.
 * Nhận: run — thao tác cần chạy. Trả: "ok" hoặc "nem|<tên lớp>|<thông điệp>".
 */
async function asyncOutcomeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "ok";
  } catch (error) {
    const failure = error as Error;
    return "nem|" + failure.name + "|" + failure.message;
  }
}

/**
 * Dựng thư mục tạm chứa BẢN SAO artefact của ta + symlink node_modules của kernel (gói khai
 * peer-only nên KHÔNG có node_modules riêng), rồi nạp cả hai artefact.
 * Nhận: không. Trả: { dir, ours, stock } — thư mục tạm (dọn ở afterAll) và hai module đã nạp.
 */
async function loadModules(): Promise<{ dir: string; ours: StaticModule; stock: StaticModule }> {
  const dir = mkdtempSync(join(tmpdir(), "gbh-host-frontend-static-"));
  try {
    mkdirSync(join(dir, "lib"), { recursive: true });
    symlinkSync(APP_MODULES, join(dir, "node_modules"), "dir");
    copyFileSync(OUR_FILE, join(dir, "lib", "index.js"));
    // 05/11/2026 (P1b): artefact cua ta mang id CUA TA ⇒ so ban sao voi CHINH tep cua ta (khong dung hang so sha cua ban goc).
    if (sha256(readFileSync(join(dir, "lib", "index.js"))) !== sha256(readFileSync(OUR_FILE))) throw new Error("bản sao artefact trong thư mục tạm không khớp sha256");
    const ours = (await import(pathToFileURL(join(dir, "lib", "index.js")).href)) as StaticModule;
    const stock = (await import(pathToFileURL(STOCK_FILE).href)) as StaticModule;
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

afterAll(() => rmSync(LOADED.dir, { recursive: true, force: true }));

/**
 * Đọc package.json của gói ta.
 * Nhận: không. Trả: object đã parse.
 */
function readPackage(): PackageJson {
  return JSON.parse(readFileSync(join(PKG_DIR, "package.json"), "utf8")) as PackageJson;
}

/**
 * Đọc package.json của gói GỐC (chỉ đọc — oracle của exports).
 * Nhận: không. Trả: object đã parse.
 */
function readStockPackage(): PackageJson {
  return JSON.parse(readFileSync(join(STOCK_PKG_DIR, "package.json"), "utf8")) as PackageJson;
}

/**
 * Lấy đích hiệu lực của một nhánh exports (chuỗi hoặc object có "default").
 * Nhận: value — giá trị exports. Trả: đường dẫn đích, hoặc undefined khi không đọc được.
 */
function exportTarget(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return undefined;
  const fallback = (value as Record<string, unknown>)["default"];
  return typeof fallback === "string" ? fallback : undefined;
}

/**
 * Dựng cây dist tạm: index.html + asset phẳng + asset trong thư mục con + asset đuôi lạ,
 * kèm một tệp bí mật NGOÀI dist root và một dist root có index.html bị thiếu.
 * Nhận: root — thư mục tạm đã tạo. Trả: DistFixture với mọi đường dẫn cần dùng.
 */
function buildDist(root: string): DistFixture {
  const dist = join(root, "dist");
  mkdirSync(join(dist, "assets", "nested"), { recursive: true });
  writeFileSync(join(dist, "index.html"), INDEX_HTML);
  writeFileSync(join(dist, "assets", "app.js"), ASSET_JS);
  writeFileSync(join(dist, "assets", "app.css"), ASSET_CSS);
  writeFileSync(join(dist, "assets", "nested", "logo.svg"), ASSET_SVG);
  writeFileSync(join(dist, "assets", "blob.bin"), ASSET_BLOB);
  writeFileSync(join(root, "secret.txt"), SECRET_TEXT);
  const missingRoot = join(root, "dist-missing");
  mkdirSync(missingRoot, { recursive: true });
  return {
    root,
    dist,
    distIndex: join(dist, "index.html"),
    missingIndex: join(missingRoot, "index.html"),
    secret: join(root, "secret.txt"),
  };
}

/**
 * Tạo mkdtemp, dựng dist tạm, chạy callback rồi LUÔN dọn thư mục trong finally.
 * Nhận: run — callback nhận DistFixture. Trả: giá trị callback trả.
 */
async function withTempDist<T>(run: (fixture: DistFixture) => Promise<T>): Promise<T> {
  const root = mkdtempSync(join(tmpdir(), "gbh-frontend-static-dist-"));
  try {
    return await run(buildDist(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/**
 * Tạo một phản hồi giả ghi lại mã/header/body/ended để so giữa hai bản.
 * Nhận: không. Trả: { res, record } — response và bản ghi của nó.
 */
function makeResponse(): { res: ResponseLike; record: ResponseRecord } {
  const record: ResponseRecord = { status: 0, headers: {}, body: undefined, ended: false };
  const res: ResponseLike = {
    writeHead(status: number, headers?: Record<string, string>) {
      record.status = status;
      if (headers !== undefined) record.headers = { ...headers };
      return res;
    },
    end(body?: string | Buffer) {
      record.body = body;
      record.ended = true;
      return res;
    },
  };
  return { res, record };
}

/**
 * Chuẩn hoá body để so sánh được (Buffer ⇒ base64 + số byte; undefined ⇒ null).
 * Nhận: body — body thô của phản hồi. Trả: giá trị JSON so sánh được.
 */
function bodyView(body: string | Buffer | undefined): unknown {
  if (body === undefined) return null;
  return Buffer.isBuffer(body) ? { base64: body.toString("base64"), bytes: body.byteLength } : body;
}

/**
 * Rút gọn bản ghi phản hồi thành object so sánh được giữa ta và bản gốc.
 * Nhận: record — bản ghi phản hồi. Trả: { status, headers, body, ended }.
 */
function responseView(record: ResponseRecord): { status: number; headers: Record<string, string>; body: unknown; ended: boolean } {
  return { status: record.status, headers: { ...record.headers }, body: bodyView(record.body), ended: record.ended };
}

/**
 * Chạy MỘT lượt serveStatic trên một module với hook authorize/render đếm được.
 * Nhận: mod — module; pathname — path đã giải mã; fixture — dist tạm; options — authorize/render.
 * Trả: phản hồi + số lần gọi authorizeIndex/renderIndex.
 */
async function serveOnce(mod: StaticModule, pathname: string, fixture: DistFixture, options: ServeOptions = {}): Promise<ServeObservation> {
  const { res, record } = makeResponse();
  let authorizes = 0;
  let renders = 0;
  const authorize = options.authorize ?? true;
  const render = options.render ?? (async () => {
    renders += 1;
    return RENDERED_INDEX;
  });
  await mod.serveStatic(pathname, res, fixture.dist, fixture.distIndex, () => {
    authorizes += 1;
    return authorize;
  }, render);
  return { record, authorizes, renders };
}

/**
 * Chạy CÙNG một lượt serveStatic trên CẢ HAI bản rồi trả hai quan sát để so.
 * Nhận: pathname — path; fixture — dist tạm; options — authorize/render. Trả: { ours, stock }.
 */
async function serveBoth(pathname: string, fixture: DistFixture, options: ServeOptions = {}): Promise<{ ours: ServeObservation; stock: ServeObservation }> {
  const [ours, stock] = await Promise.all([serveOnce(OURS, pathname, fixture, options), serveOnce(STOCK, pathname, fixture, options)]);
  return { ours, stock };
}

/**
 * Tạo context cordis giả ghi lại nhãn effect, fallback, html render và số lần authorize.
 * Nhận: options — authorize trả về true/false. Trả: ContextProbe.
 */
function makeContext(options: { authorize?: boolean } = {}): ContextProbe {
  const probe: ContextProbe = {
    ctx: undefined as unknown as ApplyContext,
    labels: [],
    fallbacks: [],
    renders: [],
    authorizes: 0,
    releases: 0,
  };
  const ctx: ApplyContext = {
    webServer: {
      registerFallback(handler: StaticHandler) {
        probe.fallbacks.push(handler);
        return () => {
          probe.releases += 1;
        };
      },
      renderIndex(html: string) {
        probe.renders.push(html);
        return html;
      },
    },
    connection: {
      authorizeIndex() {
        probe.authorizes += 1;
        return options.authorize ?? true;
      },
    },
    effect(run: () => () => void, label?: string) {
      if (label !== undefined) probe.labels.push(label);
      return run();
    },
  };
  probe.ctx = ctx;
  return probe;
}

/**
 * Lấy handler fallback DUY NHẤT mà apply đã đăng ký.
 * Nhận: probe — context đã apply. Trả: handler fallback. Ném khi chưa đăng ký.
 */
function handlerOf(probe: ContextProbe): StaticHandler {
  const handler = probe.fallbacks[0];
  if (handler === undefined) throw new Error("apply không đăng ký fallback");
  return handler;
}

describe("ca byte — artefact của ta PHẢI byte-identical tuyệt đối với bundle gốc", () => {
  test("Buffer.equals + sha256 + số byte + số dòng khớp bảng số đo 99 dòng · 3.899 B", () => {
    const ours = readFileSync(OUR_FILE);
    const stock = readFileSync(STOCK_FILE);
    // 05/11/2026 (P1b): artefact cua ta mang id CUA TA ⇒ so TUNG BYTE tren dang da chuan hoa id.
    const oursChuan = Buffer.from(chuanHoaHost(ours.toString("utf8")), "utf8");
    expect(oursChuan.equals(stock)).toBe(true);
    expect(sha256(oursChuan)).toBe(ARTEFACT_SHA256);
    expect(sha256(stock)).toBe(ARTEFACT_SHA256);
    expect(oursChuan.byteLength).toBe(ARTEFACT_BYTES);
    expect(statSync(OUR_FILE).size).toBeGreaterThanOrEqual(ARTEFACT_BYTES);
    expect(statSync(STOCK_FILE).size).toBe(ARTEFACT_BYTES);
    expect(lineCount(ours.toString("utf8"))).toBe(ARTEFACT_LINES);
    expect(lineCount(stock.toString("utf8"))).toBe(ARTEFACT_LINES);
    expect(byteLength(chuanHoaHost(ours.toString("utf8")))).toBe(ARTEFACT_BYTES);
  });

  test("id stock xuất hiện ĐÚNG 2 lần ở JSDoc dòng 6 + 16; id ta 0 lần (không đổi tên)", () => {
    const text = readFileSync(OUR_FILE, "utf8");
    const lines = text.split("\n");
    // 05/11/2026 (P1b): vai tro hai id doi cho nhau (cung hai dong JSDoc).
    expect(idCount(text, OUR_ID)).toBe(2);
    expect(idCount(text, STOCK_ID)).toBe(0);
    expect(lines.flatMap((line, index) => (line.includes(OUR_ID) ? [index + 1] : []))).toEqual([...STOCK_ID_LINES]);
    expect(lines[5]).toBe("* " + OUR_ID + " — SPA dist server over the webserver");
    expect(lines[15]).toBe("* @module " + OUR_ID);
    for (const lineNumber of STOCK_ID_LINES) expect((lines[lineNumber - 1] ?? "").startsWith("*")).toBe(true);
  });

  test("bản sao trong mkdtemp (bản test nạp thật) cũng khớp sha256 + số byte", () => {
    const copy = join(LOADED.dir, "lib", "index.js");
    // 05/11/2026 (P1b): ban sao = artefact cua ta ⇒ so tren dang chuan hoa id.
    expect(sha256(chuanHoaHost(readFileSync(copy, "utf8")))).toBe(ARTEFACT_SHA256);
    // 05/11/2026 (P1b): kich thuoc THAT doi theo do dai id ta ⇒ so tren dang chuan hoa.
    expect(ByteLen(chuanHoaHost(readFileSync(copy, "utf8")))).toBe(ARTEFACT_BYTES);
  });
});

describe("ca ghép lát — src/assemble.ts ghép 3 lát nguyên văn ra ĐÚNG artefact", () => {
  test("assembleBundle() === lib/index.js === bundle gốc (cùng sha + dòng + byte)", () => {
    expect([...PART_FILES]).toEqual(["part-00-head.ts", "part-01-index.ts", "part-02-tail.ts"]);
    const assembled = assembleBundle();
    // 05/11/2026 (P1b): lat ghep la NGUYEN VAN stock; artefact mang id cua ta ⇒ so sau chuan hoa.
    expect(assembled).toBe(chuanHoaHost(readFileSync(OUR_FILE, "utf8")));
    expect(assembled).toBe(readFileSync(STOCK_FILE, "utf8"));
    // 05/11/2026 (P1b): ban ghep la NGUYEN VAN stock ⇒ giu hang so sha goc.
    expect(sha256(Buffer.from(assembled, "utf8"))).toBe(ARTEFACT_SHA256);
    expect(lineCount(assembled)).toBe(ARTEFACT_LINES);
    expect(byteLength(assembled)).toBe(ARTEFACT_BYTES);
  });

  test("mỗi lát có header bắt buộc + dòng đánh dấu + đuôi module; artefact KHÔNG còn scaffold", () => {
    for (const fileName of PART_FILES) {
      const source = readFileSync(join(PKG_DIR, "src", "parts", fileName), "utf8");
      const lines = source.split("\n");
      const marker = lines.findIndex((line) => line.startsWith("// @ts-nocheck"));
      expect(marker).toBeGreaterThan(0);
      expect(lines.slice(0, marker).some((line) => line.trim() === "*/")).toBe(true);
      expect(source).toContain("author Bùi Trọng Hiếu");
      expect(source).toContain("create date 15/10/2026");
      expect(source).toContain("modify date 19/10/2026");
      expect(lines[lines.length - 1]).toBe("");
      expect(lines[lines.length - 2]).toBe("export {};");
    }
    const text = readFileSync(OUR_FILE, "utf8");
    for (const scaffold of ["// @ts-nocheck", "author Bùi Trọng Hiếu", "__GBH_FRAGMENT_BEGIN__", "__GBH_FRAGMENT_END__", "export {};"]) {
      expect(text).not.toContain(scaffold);
    }
  });
});

describe("ca export + Config schema — bề mặt ESM và distIndex REQUIRED không đổi", () => {
  test("đúng 5 export, KHÔNG default, name/inject y hệt bản gốc", () => {
    expect(exportNames(OURS)).toEqual([...EXPORT_NAMES]);
    expect(exportNames(STOCK)).toEqual([...EXPORT_NAMES]);
    expect(exportNames(OURS)).toEqual(exportNames(STOCK));
    expect(OURS.name).toBe(PLUGIN_NAME);
    expect(STOCK.name).toBe(PLUGIN_NAME);
    expect(OURS.inject).toEqual(INJECT);
    expect(STOCK.inject).toEqual(INJECT);
    expect("default" in OURS).toBe(false);
    expect("default" in STOCK).toBe(false);
  });

  test("Config: cùng 1 khoá distIndex, cùng required/type, parse ra cùng object", () => {
    expect(Object.keys(OURS.Config.dict).sort()).toEqual([...SCHEMA_KEYS]);
    expect(Object.keys(STOCK.Config.dict).sort()).toEqual([...SCHEMA_KEYS]);
    const mine = schemaView(OURS.Config);
    const theirs = schemaView(STOCK.Config);
    expect(mine).toEqual(theirs);
    expect(mine["distIndex"]?.["meta"]).toMatchObject({ required: true });
    expect(mine["distIndex"]?.["type"]).toBe("string");
    const config = { distIndex: "/srv/web-frontend/dist/index.html" };
    expect(OURS.Config(config)).toEqual(config);
    expect(STOCK.Config(config)).toEqual(OURS.Config(config));
  });

  test("thiếu distIndex ⇒ CẢ HAI ném ValidationError CÙNG thông điệp (required)", () => {
    for (const input of [{}, null, { distIndex: undefined }]) {
      const mine = outcomeOf(() => OURS.Config(input));
      const theirs = outcomeOf(() => STOCK.Config(input));
      expect(mine).toBe(theirs);
      expect(mine).toContain("ValidationError");
      expect(mine).toContain("$.distIndex missing required value");
    }
    expect(outcomeOf(() => OURS.Config({}))).toBe("nem|ValidationError|$.distIndex missing required value");
    expect(outcomeOf(() => STOCK.Config({}))).toBe("nem|ValidationError|$.distIndex missing required value");
  });

  test("distIndex sai kiểu ⇒ cả hai cùng ném CÙNG thông điệp", () => {
    for (const value of [5, true, ["x"], { a: 1 }]) {
      const mine = outcomeOf(() => OURS.Config({ distIndex: value }));
      const theirs = outcomeOf(() => STOCK.Config({ distIndex: value }));
      expect(mine).toBe(theirs);
      expect(mine).toContain("$.distIndex expected string");
    }
  });

  test("lib/types/index.d.ts byte-identical bản gốc + lib/index.d.ts re-export đúng", () => {
    const ourTypes = readFileSync(join(PKG_DIR, "lib", "types", "index.d.ts"));
    const stockTypes = readFileSync(join(STOCK_PKG_DIR, "lib", "types", "index.d.ts"));
    expect(ourTypes.equals(stockTypes)).toBe(true);
    expect(sha256(ourTypes)).toBe(sha256(stockTypes));
    expect(readFileSync(join(PKG_DIR, "lib", "index.d.ts"), "utf8")).toBe('export * from "./types/index.js";\n');
  });
});

describe("ca BẢO MẬT serveStatic — dựng dist tạm trong mkdtemp, so mã + body hai bản", () => {
  test("dist root '/' ⇒ 200 index qua renderIndex (KHÔNG đọc thẳng file), khớp từng header/body", async () => {
    await withTempDist(async (fixture) => {
      const { ours, stock } = await serveBoth("/", fixture);
      expect(ours.record.status).toBe(200);
      expect(stock.record.status).toBe(200);
      expect(ours.record.headers["content-type"]).toBe("text/html; charset=utf-8");
      expect(stock.record.headers["content-type"]).toBe("text/html; charset=utf-8");
      expect(ours.record.body).toBe(RENDERED_INDEX);
      expect(stock.record.body).toBe(RENDERED_INDEX);
      expect(ours.authorizes).toBe(1);
      expect(stock.authorizes).toBe(1);
      expect(ours.renders).toBe(1);
      expect(stock.renders).toBe(1);
      expect(responseView(ours.record)).toEqual(responseView(stock.record));
    });
  });

  test("index path '/index.html' ⇒ 200 qua renderIndex (không phải asset tĩnh), khớp hai bản", async () => {
    await withTempDist(async (fixture) => {
      const { ours, stock } = await serveBoth("/index.html", fixture);
      expect(ours.record.status).toBe(200);
      expect(stock.record.status).toBe(200);
      expect(ours.record.body).toBe(RENDERED_INDEX);
      expect(stock.record.body).toBe(RENDERED_INDEX);
      expect(ours.renders).toBe(1);
      expect(stock.renders).toBe(1);
      expect(ours.authorizes).toBe(1);
      expect(stock.authorizes).toBe(1);
      expect(responseView(ours.record)).toEqual(responseView(stock.record));
    });
  });

  test("index-missing ⇒ 404 cả hai (ENOENT của renderIndex bị nuốt thành 404)", async () => {
    await withTempDist(async (fixture) => {
      const render = async () => {
        throw Object.assign(new Error("ENOENT: index.html"), { code: "ENOENT" });
      };
      const mine = await serveOnce(OURS, "/", fixture, { render });
      const theirs = await serveOnce(STOCK, "/", fixture, { render });
      expect(mine.record.status).toBe(404);
      expect(theirs.record.status).toBe(404);
      expect(mine.record.body).toBeUndefined();
      expect(theirs.record.body).toBeUndefined();
      expect(responseView(mine.record)).toEqual(responseView(theirs.record));
    });
  });

  test("thiếu path ⇒ 404 cả hai, body rỗng, không header (file + thư mục)", async () => {
    await withTempDist(async (fixture) => {
      for (const pathname of ["/nope.js", "/assets/missing.css", "/assets", "/assets/nested"]) {
        const { ours, stock } = await serveBoth(pathname, fixture);
        expect(ours.record.status).toBe(404);
        expect(stock.record.status).toBe(404);
        expect(ours.record.ended).toBe(true);
        expect(ours.record.body).toBeUndefined();
        expect(stock.record.body).toBeUndefined();
        expect(ours.record.headers).toEqual({});
        expect(responseView(ours.record)).toEqual(responseView(stock.record));
      }
    });
  });

  test("traversal '../' ra ngoài dist root ⇒ 403 cả hai (tệp ngoài TỒN TẠI — không phải 404)", async () => {
    await withTempDist(async (fixture) => {
      expect(existsSync(fixture.secret)).toBe(true);
      expect(readFileSync(fixture.secret, "utf8")).toBe(SECRET_TEXT);
      for (const pathname of ["/../secret.txt", "/assets/../../secret.txt", "/../../etc/passwd"]) {
        const { ours, stock } = await serveBoth(pathname, fixture);
        expect(ours.record.status).toBe(403);
        expect(stock.record.status).toBe(403);
        expect(ours.record.ended).toBe(true);
        expect(ours.record.body).toBeUndefined();
        expect(responseView(ours.record)).toEqual(responseView(stock.record));
      }
    });
  });

  test("asset thường ⇒ 200 + MIME đúng, body NGUYÊN BYTE (js/css/svg/octet-stream)", async () => {
    await withTempDist(async (fixture) => {
      const cases: ReadonlyArray<readonly [string, string, Buffer]> = [
        ["/assets/app.js", "text/javascript; charset=utf-8", Buffer.from(ASSET_JS)],
        ["/assets/app.css", "text/css; charset=utf-8", Buffer.from(ASSET_CSS)],
        ["/assets/nested/logo.svg", "image/svg+xml", Buffer.from(ASSET_SVG)],
        ["/assets/blob.bin", "application/octet-stream", ASSET_BLOB],
      ];
      for (const [pathname, type, expected] of cases) {
        const { ours, stock } = await serveBoth(pathname, fixture);
        expect(ours.record.status).toBe(200);
        expect(stock.record.status).toBe(200);
        expect(ours.record.headers["content-type"]).toBe(type);
        expect(stock.record.headers["content-type"]).toBe(type);
        expect(bodyView(ours.record.body)).toEqual(bodyView(expected));
        expect(bodyView(stock.record.body)).toEqual(bodyView(expected));
        expect(responseView(ours.record)).toEqual(responseView(stock.record));
      }
    });
  });

  test("authorizeIndex=false ⇒ KHÔNG ghi head/end, KHÔNG render (cả hai, cả root lẫn index path)", async () => {
    await withTempDist(async (fixture) => {
      for (const pathname of ["/", "/index.html"]) {
        const mine = await serveOnce(OURS, pathname, fixture, { authorize: false });
        const theirs = await serveOnce(STOCK, pathname, fixture, { authorize: false });
        expect(mine.authorizes).toBe(1);
        expect(theirs.authorizes).toBe(1);
        expect(mine.renders).toBe(0);
        expect(theirs.renders).toBe(0);
        expect(mine.record.status).toBe(0);
        expect(mine.record.ended).toBe(false);
        expect(responseView(mine.record)).toEqual(responseView(theirs.record));
      }
    });
  });

  test("lỗi KHÔNG thuộc ENOENT/EISDIR/ENOTDIR ⇒ ném ra ngoài, cả hai CÙNG lỗi", async () => {
    await withTempDist(async (fixture) => {
      const render = async () => {
        throw Object.assign(new Error("boom-eacces"), { code: "EACCES" });
      };
      const mine = await asyncOutcomeOf(() => serveOnce(OURS, "/", fixture, { render }));
      const theirs = await asyncOutcomeOf(() => serveOnce(STOCK, "/", fixture, { render }));
      expect(mine).toBe(theirs);
      expect(mine).toBe("nem|Error|boom-eacces");
    });
  });
});

describe("ca apply — fallback seat, 405, base href, index-missing và asset công khai", () => {
  test("apply đăng ký ĐÚNG 1 fallback qua effect nhãn 'frontend-static: fallback seat'", () => {
    const mine = makeContext();
    const theirs = makeContext();
    OURS.apply(mine.ctx, { distIndex: "/tmp/gbh/index.html" });
    STOCK.apply(theirs.ctx, { distIndex: "/tmp/gbh/index.html" });
    expect(mine.labels).toEqual([EFFECT_LABEL]);
    expect(mine.labels).toEqual(theirs.labels);
    expect(mine.fallbacks.length).toBe(1);
    expect(theirs.fallbacks.length).toBe(1);
    expect(typeof handlerOf(mine)).toBe("function");
    expect(typeof handlerOf(theirs)).toBe("function");
  });

  test("GET '/' ⇒ 200 + renderIndex nhận đúng index.html + chèn '<base href=\"./\">' sau <head>", async () => {
    await withTempDist(async (fixture) => {
      const mine = makeContext();
      OURS.apply(mine.ctx, { distIndex: fixture.distIndex });
      const theirs = makeContext();
      STOCK.apply(theirs.ctx, { distIndex: fixture.distIndex });
      const oursGet = makeResponse();
      await handlerOf(mine)({ method: "GET", url: "/" }, oursGet.res);
      const stockGet = makeResponse();
      await handlerOf(theirs)({ method: "GET", url: "/" }, stockGet.res);
      expect(oursGet.record.status).toBe(200);
      expect(stockGet.record.status).toBe(200);
      expect(mine.renders).toEqual([INDEX_HTML]);
      expect(theirs.renders).toEqual([INDEX_HTML]);
      expect(mine.authorizes).toBe(1);
      expect(theirs.authorizes).toBe(1);
      const body = oursGet.record.body as string;
      expect(body).toBe(stockGet.record.body as string);
      expect(body).toContain('<head><base href="./">');
      expect(idCount(body, '<base href="./">')).toBe(1);
      expect(body).toBe(INDEX_HTML.replace("<head>", '<head><base href="./">'));
      expect(responseView(oursGet.record)).toEqual(responseView(stockGet.record));
    });
  });

  test("chèn base sau <head> CÓ THUỘC TÍNH cũng khớp bản gốc", async () => {
    await withTempDist(async (fixture) => {
      const variant = '<!doctype html><html><head lang="vi"><title>x</title></head><body></body></html>';
      writeFileSync(fixture.distIndex, variant);
      const mine = makeContext();
      OURS.apply(mine.ctx, { distIndex: fixture.distIndex });
      const theirs = makeContext();
      STOCK.apply(theirs.ctx, { distIndex: fixture.distIndex });
      const oursGet = makeResponse();
      await handlerOf(mine)({ method: "GET", url: "/" }, oursGet.res);
      const stockGet = makeResponse();
      await handlerOf(theirs)({ method: "GET", url: "/" }, stockGet.res);
      const expected = variant.replace('<head lang="vi">', '<head lang="vi"><base href="./">');
      expect(oursGet.record.body).toBe(expected);
      expect(stockGet.record.body).toBe(expected);
      expect(oursGet.record.status).toBe(200);
      expect(stockGet.record.status).toBe(200);
    });
  });

  test("POST/PUT/DELETE/PATCH ⇒ 405 cả hai (chỉ GET/HEAD được phục vụ)", async () => {
    await withTempDist(async (fixture) => {
      const mine = makeContext();
      OURS.apply(mine.ctx, { distIndex: fixture.distIndex });
      const theirs = makeContext();
      STOCK.apply(theirs.ctx, { distIndex: fixture.distIndex });
      for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
        const oursCall = makeResponse();
        await handlerOf(mine)({ method, url: "/" }, oursCall.res);
        const stockCall = makeResponse();
        await handlerOf(theirs)({ method, url: "/" }, stockCall.res);
        expect(oursCall.record.status).toBe(405);
        expect(stockCall.record.status).toBe(405);
        expect(oursCall.record.ended).toBe(true);
        expect(oursCall.record.body).toBeUndefined();
        expect(responseView(oursCall.record)).toEqual(responseView(stockCall.record));
      }
      expect(mine.authorizes).toBe(0);
      expect(mine.renders).toEqual([]);
    });
  });

  test("asset công khai KHÔNG gọi authorizeIndex; index mới gọi (cả hai)", async () => {
    await withTempDist(async (fixture) => {
      const mine = makeContext({ authorize: false });
      OURS.apply(mine.ctx, { distIndex: fixture.distIndex });
      const theirs = makeContext({ authorize: false });
      STOCK.apply(theirs.ctx, { distIndex: fixture.distIndex });
      const asset = makeResponse();
      await handlerOf(mine)({ method: "GET", url: "/assets/app.js" }, asset.res);
      const stockAsset = makeResponse();
      await handlerOf(theirs)({ method: "GET", url: "/assets/app.js" }, stockAsset.res);
      expect(asset.record.status).toBe(200);
      expect(stockAsset.record.status).toBe(200);
      expect(bodyView(asset.record.body)).toEqual(bodyView(Buffer.from(ASSET_JS)));
      expect(bodyView(stockAsset.record.body)).toEqual(bodyView(Buffer.from(ASSET_JS)));
      expect((asset.record.body as Buffer).toString("utf8")).toBe(ASSET_JS);
      expect(mine.authorizes).toBe(0);
      expect(theirs.authorizes).toBe(0);
      const index = makeResponse();
      await handlerOf(mine)({ method: "GET", url: "/" }, index.res);
      const stockIndex = makeResponse();
      await handlerOf(theirs)({ method: "GET", url: "/" }, stockIndex.res);
      expect(index.record.status).toBe(0);
      expect(stockIndex.record.status).toBe(0);
      expect(mine.authorizes).toBe(1);
      expect(theirs.authorizes).toBe(1);
    });
  });

  test("apply: '/..%2Fsecret.txt' giải mã thành '../' ⇒ 403 cả hai, không authorize", async () => {
    await withTempDist(async (fixture) => {
      expect(existsSync(fixture.secret)).toBe(true);
      const mine = makeContext();
      OURS.apply(mine.ctx, { distIndex: fixture.distIndex });
      const theirs = makeContext();
      STOCK.apply(theirs.ctx, { distIndex: fixture.distIndex });
      const oursCall = makeResponse();
      await handlerOf(mine)({ method: "GET", url: "/..%2Fsecret.txt" }, oursCall.res);
      const stockCall = makeResponse();
      await handlerOf(theirs)({ method: "GET", url: "/..%2Fsecret.txt" }, stockCall.res);
      expect(oursCall.record.status).toBe(403);
      expect(stockCall.record.status).toBe(403);
      expect(oursCall.record.body).toBeUndefined();
      expect(stockCall.record.body).toBeUndefined();
      expect(mine.authorizes).toBe(0);
      expect(theirs.authorizes).toBe(0);
      expect(responseView(oursCall.record)).toEqual(responseView(stockCall.record));
    });
  });

  test("apply: index-missing ⇒ 404 cả hai, authorize CÓ gọi nhưng renderIndex KHÔNG", async () => {
    await withTempDist(async (fixture) => {
      const mine = makeContext();
      OURS.apply(mine.ctx, { distIndex: fixture.missingIndex });
      const theirs = makeContext();
      STOCK.apply(theirs.ctx, { distIndex: fixture.missingIndex });
      const oursCall = makeResponse();
      await handlerOf(mine)({ method: "GET", url: "/" }, oursCall.res);
      const stockCall = makeResponse();
      await handlerOf(theirs)({ method: "GET", url: "/" }, stockCall.res);
      expect(oursCall.record.status).toBe(404);
      expect(stockCall.record.status).toBe(404);
      expect(oursCall.record.body).toBeUndefined();
      expect(mine.authorizes).toBe(1);
      expect(theirs.authorizes).toBe(1);
      expect(mine.renders).toEqual([]);
      expect(theirs.renders).toEqual([]);
      expect(responseView(oursCall.record)).toEqual(responseView(stockCall.record));
    });
  });
});

describe("ca package.json — gói THƯ VIỆN (quyết định Lead 19/10), không có row oracle", () => {
  test("KHÔNG gbh.row + KHÔNG gbh.row_unmounted_ly_do, có gbh.draft, peer cordis", () => {
    const pkg = readPackage();
    expect(pkg.name).toBe(OUR_ID);
    expect(pkg.type).toBe("module");
    expect(pkg.main).toBe("lib/index.js");
    expect(pkg.gbh?.row).toBeUndefined();
    expect(pkg.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect("row" in (pkg.gbh ?? {})).toBe(false);
    expect("row_unmounted_ly_do" in (pkg.gbh ?? {})).toBe(false);
    expect(typeof pkg.gbh?.draft).toBe("string");
    expect((pkg.gbh?.draft ?? "").length).toBeGreaterThan(50);
    // 01/11/2026: `gbh.peers` chốt theo manifest sau lượt đồng bộ — ba seam runtime của gói
    // (cordis + host-webserver + client-connection); phép kiểm MẠNH vẫn là peerDependencies == stock ở dưới.
    expect(pkg.gbh?.peers).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/dsh-host-webserver",
      "@deepseek-ai/dsh-client-connection",
    ]);
    // 01/11/2026: parity voi manifest stock (stock khai ~4.0.5-alpha.2 cho cordis, khong phai "*").
    const stockPeers = (JSON.parse(readFileSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-host-frontend-static", "package.json"), "utf8")) as { peerDependencies?: Record<string, string> }).peerDependencies;
    expect(pkg.peerDependencies).toEqual(stockPeers);
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.dsh).toBeUndefined();
  });

  test("gbh.tests trỏ ĐÚNG tệp test này và tệp tồn tại", () => {
    const pkg = readPackage();
    expect(pkg.gbh?.tests).toEqual([TEST_FILE]);
    expect(existsSync(join(REPO, TEST_FILE))).toBe(true);
  });

  test("exports khớp bản gốc: cùng 3 khoá, '.' ⇒ ./lib/index.js, './src/*' + './package.json' nguyên văn", () => {
    const ours = readPackage().exports ?? {};
    const stock = readStockPackage().exports ?? {};
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual([".", "./package.json", "./src/*"]);
    expect(exportTarget(ours["."])).toBe("./lib/index.js");
    expect(exportTarget(stock["."])).toBe("./lib/index.js");
    expect(ours["./src/*"]).toBe(stock["./src/*"]);
    expect(ours["./package.json"]).toBe(stock["./package.json"]);
    expect((stock["."] as { types?: string }).types).toBe("./lib/types/index.d.ts");
    expect(existsSync(join(PKG_DIR, "lib", "index.js"))).toBe(true);
    expect(existsSync(join(PKG_DIR, "lib", "types", "index.d.ts"))).toBe(true);
  });
});
