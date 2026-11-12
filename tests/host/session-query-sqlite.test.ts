/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test gói session-query-sqlite: artefact BYTE-IDENTICAL bundle gốc + bề mặt export + engine trên
 *      Context cordis THẬT (dịch vụ sessions GIẢ) với DB trong thư mục TẠM, A/B kết quả/mã lỗi/thông điệp.
 *      DRIVER: bun 1.3.14 KHÔNG có 'node:sqlite' nên test mock.module('node:sqlite') bằng bun:sqlite
 *      (DatabaseSync/StatementSync, get() trả undefined như node) — CÙNG một shim cho CẢ HAI bên.
 *      THÊM: A/B bằng node ≥22 THẬT (spawn `node --input-type=module -e`) trên ĐÚNG driver node:sqlite
 *      của artefact — chứng minh hai bản giống nhau ngoài shim, DB vẫn chỉ trong mkdtemp.
 */
import { afterAll, describe, expect, mock, test } from "bun:test";
import { Database as BunDatabase, type Statement } from "bun:sqlite";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Kiểu tham số bun:sqlite nhận cho một câu lệnh. */
type BindValue = Parameters<Statement["run"]>[0];

/** Bề mặt module (của ta hoặc gốc). */
type Api = Record<string, unknown>;

/**
 * Vỏ StatementSync giống node:sqlite.
 * Khác biệt DUY NHẤT được xử lý: node:sqlite trả undefined khi không có dòng, bun:sqlite trả null —
 * bundle dựa vào undefined ở nhánh "phiên không tồn tại", nên vỏ phải chuẩn hoá lại.
 */
class StatementSync {
  /** Câu lệnh bun:sqlite được bọc. */
  private readonly inner: Statement;

  /**
   * Nhận: câu lệnh bun:sqlite đã chuẩn bị.
   * Trả: vỏ StatementSync mới.
   */
  constructor(inner: Statement) {
    this.inner = inner;
  }

  /**
   * Lấy dòng đầu tiên.
   * Nhận: tham số bind.
   * Trả: dòng đầu tiên, hoặc undefined khi không có dòng.
   */
  get(...params: BindValue[]): unknown {
    const row = this.inner.get(...params);
    return row === null ? undefined : row;
  }

  /**
   * Lấy toàn bộ dòng.
   * Nhận: tham số bind.
   * Trả: mảng dòng.
   */
  all(...params: BindValue[]): unknown[] {
    return this.inner.all(...params) as unknown[];
  }

  /**
   * Chạy câu lệnh ghi.
   * Nhận: tham số bind.
   * Trả: object changes/lastInsertRowid của bun:sqlite.
   */
  run(...params: BindValue[]): unknown {
    return this.inner.run(...params);
  }

  /**
   * Duyệt từng dòng.
   * Nhận: tham số bind.
   * Trả: iterator các dòng.
   */
  iterate(...params: BindValue[]): IterableIterator<unknown> {
    return this.inner.iterate(...params) as IterableIterator<unknown>;
  }

  /**
   * Giải phóng câu lệnh.
   * Nhận: không.
   * Trả: kết quả finalize của bun:sqlite.
   */
  finalize(): unknown {
    return this.inner.finalize();
  }
}

/**
 * Vỏ DatabaseSync giống node:sqlite, thân là bun:sqlite.
 * bun 1.3.14 chưa có 'node:sqlite' nên đây là cách duy nhất để chạy SQLite THẬT cho CẢ HAI bên A/B.
 */
class DatabaseSync {
  /** Kết nối bun:sqlite bên dưới. */
  private readonly inner: BunDatabase;

  /**
   * Nhận: đường dẫn DB + tuỳ chọn readOnly.
   * Trả: kết nối đã mở.
   */
  constructor(path: string, options?: { readOnly?: boolean }) {
    this.inner = new BunDatabase(path, options?.readOnly === true ? { readonly: true } : undefined);
  }

  /**
   * Chuẩn bị câu lệnh.
   * Nhận: SQL.
   * Trả: vỏ StatementSync.
   */
  prepare(sql: string): StatementSync {
    return new StatementSync(this.inner.prepare(sql));
  }

  /**
   * Chạy một hoặc nhiều câu lệnh.
   * Nhận: SQL.
   * Trả: không.
   */
  exec(sql: string): void {
    this.inner.exec(sql);
  }

  /**
   * Đóng kết nối.
   * Nhận: không.
   * Trả: không.
   */
  close(): void {
    this.inner.close();
  }
}

mock.module("node:sqlite", () => ({ DatabaseSync, StatementSync, default: { DatabaseSync, StatementSync } }));

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Artefact của ta. */
const OURS_FILE = join(REPO, "packages", "host", "session-query-sqlite", "lib", "index.js");
/** Bundle GỐC (CHỈ ĐỌC). */
const STOCK_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-query-sqlite", "lib", "index.js");
/** Nội dung bundle gốc. */
const STOCK_TEXT = readFileSync(STOCK_FILE, "utf8");
/** Tám tên export ĐÚNG bộ mà gói công bố. */
const EXPORT_NAMES = [
  "SESSION_QUERY_SQLITE_APPLICATION_ID",
  "SESSION_QUERY_SQLITE_DEFAULT_LIMIT",
  "SESSION_QUERY_SQLITE_MAX_LIMIT",
  "SESSION_QUERY_SQLITE_PATH_KEY",
  "SESSION_QUERY_SQLITE_SCHEMA_VERSION",
  "SESSION_QUERY_SQLITE_SNIPPET_CHARS",
  "SqliteSessionQueryEngine",
  "default",
];
/** Năm hằng số phải trùng giá trị hai bên. */
const CONSTANT_NAMES = [
  "SESSION_QUERY_SQLITE_APPLICATION_ID",
  "SESSION_QUERY_SQLITE_DEFAULT_LIMIT",
  "SESSION_QUERY_SQLITE_MAX_LIMIT",
  "SESSION_QUERY_SQLITE_PATH_KEY",
  "SESSION_QUERY_SQLITE_SCHEMA_VERSION",
  "SESSION_QUERY_SQLITE_SNIPPET_CHARS",
];
/** Thư mục TẠM duy nhất cho cả bộ test (mkdtemp) — KHÔNG BAO GIỜ chạm ~/.galaxy hay ~/.dsh. */
const TEMP_ROOT = mkdtempSync(join(tmpdir(), "gbh-session-query-sqlite-"));
/** Đường dẫn DB dùng CHUNG cho A/B: cùng đầu vào ⇒ thông điệp lỗi chứa đường dẫn cũng y hệt. */
const DB_PATH = join(TEMP_ROOT, "index.sqlite");

/** Bề mặt Context cordis tối thiểu mà test chạm tới. */
interface Ctx {
  /** Cấp một dịch vụ GIẢ cho Context. */
  provide(name: string, value: unknown): void;
  /** Đăng ký plugin theo vòng đời cordis THẬT. */
  plugin(plugin: unknown, config?: unknown): FiberLike;
  /** Dịch vụ sessionQuery do engine đăng ký (undefined sau dispose). */
  sessionQuery?: EngineLike;
  /** Các thuộc tính khác của Context. */
  [key: string]: unknown;
}

/** Fiber plugin cordis (chỉ phần test dùng). */
interface FiberLike {
  /** Trạng thái fiber: 2 = đã chạy. */
  state?: number;
  /** Chờ lifecycle hiện tại và ném lại lỗi khởi động. */
  await(): Promise<unknown>;
  /** Gỡ plugin (cordis tự đóng engine qua effect). */
  dispose(): Promise<unknown>;
}

/** Engine session-query (bề mặt test dùng). */
interface EngineLike {
  /** Cấu hình đã validate + điền mặc định. */
  config: Record<string, unknown>;
  /** Tìm phiên. */
  searchSessions(request: Record<string, unknown>, exec?: Record<string, unknown>): Promise<unknown>;
  /** Tìm event trong một phiên. */
  searchEvents(request: Record<string, unknown>, exec?: Record<string, unknown>): Promise<unknown>;
  /** Đóng index. */
  close(): Promise<unknown>;
}

/** Một engine đã mount trên Context THẬT. */
interface Mounted {
  /** Fiber của plugin. */
  fiber: FiberLike;
  /** Engine đã đăng ký tại ctx.sessionQuery. */
  engine: EngineLike;
}

/** Rig của một lượt chạy. */
interface Rig {
  /** Context vừa dựng. */
  ctx: Ctx;
  /** Fiber của engine. */
  fiber: FiberLike;
  /** Engine đang chạy. */
  engine: EngineLike;
  /** Đường dẫn DB của lượt chạy. */
  dbPath: string;
}

/** Tuỳ chọn một lượt chạy. */
interface RunOptions {
  /** Ghi đè cấu hình engine (path/openAt/maxLimit...). */
  config?: Record<string, unknown>;
  /** Dựng DB trước khi mount (schema sai, application_id lạ...). */
  before?: (dbPath: string) => void;
  /** Dịch vụ sessions GIẢ thay thế. */
  sessions?: Record<string, unknown>;
}

/** Kịch bản chạy trên MỘT bên. */
type Scenario = (rig: Rig, api: Api) => unknown;

/** Ảnh chụp schema đọc lại từ tệp DB. */
interface SchemaSnapshot {
  /** PRAGMA application_id. */
  applicationId: number;
  /** PRAGMA user_version. */
  userVersion: number;
  /** Bảng người dùng (trừ sqlite_*). */
  tables: string[];
  /** Dòng search_state. */
  searchState: { singleton: number; global_generation: number }[];
}

/** Kết quả validate Config. */
interface ConfigValidation {
  /** Giá trị đã điền mặc định khi hợp lệ. */
  value?: unknown;
  /** Danh sách lỗi khi sai. */
  issues?: unknown;
}

/** Lớp Context cordis THẬT của runtime app. */
const ContextCtor = (await import(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js"))).Context as new () => Ctx;
/** Nạp artefact của ta. */
const ours = (await import(OURS_FILE)) as Api;
/** Nạp bundle gốc. */
const stock = (await import(STOCK_FILE)) as Api;
/** application_id của gói (đọc từ artefact). */
const APP_ID = ours["SESSION_QUERY_SQLITE_APPLICATION_ID"] as number;
/** schema version của gói (đọc từ artefact). */
const SCHEMA_VERSION = ours["SESSION_QUERY_SQLITE_SCHEMA_VERSION"] as number;

/**
 * Băm SHA-256 một chuỗi UTF-8.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Kiểm một đường dẫn có nằm trong thư mục TẠM của bộ test hay không.
 * Nhận: path — đường dẫn cần kiểm.
 * Trả: true khi nằm dưới TEMP_ROOT.
 */
function isTempPath(path: string): boolean {
  return path === TEMP_ROOT || path.startsWith(TEMP_ROOT);
}

/**
 * Đường dẫn DB của một lượt chạy (ưu tiên config.path).
 * Nhận: options — tuỳ chọn lượt chạy.
 * Trả: đường dẫn tuyệt đối trong thư mục tạm.
 */
function dbPathOf(options: RunOptions): string {
  const override = options.config?.["path"];
  return typeof override === "string" ? override : DB_PATH;
}

/**
 * Xoá sạch tệp DB (kèm -wal/-shm) để hai bên bắt đầu từ CÙNG trạng thái.
 * Nhận: dbPath — đường dẫn DB.
 * Trả: không.
 */
function resetDb(dbPath: string): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      rmSync(dbPath + suffix, { force: true });
    } catch {
      // Đường dẫn có thư mục cha là TỆP (ca "đường dẫn không hợp lệ") ⇒ không có gì để xoá.
    }
  }
}

/**
 * Dịch vụ sessions GIẢ tối thiểu: đúng thứ engine gọi trên corpus rỗng.
 * Nhận: không.
 * Trả: object có list() rỗng và get() luôn undefined.
 */
function emptySessions(): Record<string, unknown> {
  return { list: () => [], get: () => undefined };
}

/**
 * Dựng Context cordis THẬT + cấp dịch vụ sessions GIẢ (theo static inject của engine).
 * Nhận: sessions — dịch vụ thay thế (mặc định rỗng).
 * Trả: Context mới.
 */
function newContext(sessions?: Record<string, unknown>): Ctx {
  const ctx = new ContextCtor() as Ctx;
  ctx.provide("sessions", sessions ?? emptySessions());
  return ctx;
}

/**
 * Mount engine lên một Context đã có sẵn (dùng cho ca hai engine cùng DB).
 * Nhận: api — bề mặt module; ctx — Context THẬT; config — ghi đè cấu hình.
 * Trả: { fiber, engine } sau khi cordis chạy xong Service.init.
 */
async function mount(api: Api, ctx: Ctx, config: Record<string, unknown> = {}): Promise<Mounted> {
  const fiber = ctx.plugin(api["SqliteSessionQueryEngine"], { path: DB_PATH, openAt: "first-search", ...config });
  await fiber.await();
  const engine = ctx.sessionQuery;
  if (engine === undefined) throw new Error("ctx.sessionQuery chua duoc dang ky sau khi mount");
  return { fiber, engine };
}

/**
 * Chạy một kịch bản trên MỘT bên rồi đóng engine + dọn fiber.
 * Nhận: api — bề mặt module; scenario — kịch bản; options — tuỳ chọn lượt chạy.
 * Trả: chuỗi "ok:<JSON>" hoặc "nem|<name>|<code>|<message>".
 */
async function runSide(api: Api, scenario: Scenario, options: RunOptions = {}): Promise<string> {
  const dbPath = dbPathOf(options);
  if (!isTempPath(dbPath)) throw new Error("DB ngoai thu muc tam: " + dbPath);
  resetDb(dbPath);
  options.before?.(dbPath);
  const ctx = newContext(options.sessions);
  const fiber = ctx.plugin(api["SqliteSessionQueryEngine"], { path: dbPath, openAt: "first-search", ...(options.config ?? {}) });
  try {
    return await outcome(async () => {
      await fiber.await();
      const engine = ctx.sessionQuery;
      if (engine === undefined) throw new Error("ctx.sessionQuery chua duoc dang ky sau khi mount");
      return scenario({ ctx, fiber, engine, dbPath }, api);
    });
  } finally {
    try {
      await ctx.sessionQuery?.close();
    } catch {}
    try {
      await fiber.dispose();
    } catch {}
  }
}

/**
 * Chạy CÙNG kịch bản trên artefact của ta rồi bundle gốc, tuần tự trên CÙNG đường dẫn DB.
 * Nhận: scenario — kịch bản; options — tuỳ chọn lượt chạy.
 * Trả: cặp [kết quả của ta, kết quả gốc].
 */
async function both(scenario: Scenario, options: RunOptions = {}): Promise<[string, string]> {
  const our = await runSide(ours, scenario, options);
  const their = await runSide(stock, scenario, options);
  return [our, their];
}

/**
 * Chạy một hàm (sync/async) rồi gói kết quả hoặc lỗi thành chuỗi so sánh được.
 * Nhận: run — hàm cần chạy.
 * Trả: "ok:<JSON>" hoặc "nem|<name>|<code>|<message>".
 */
async function outcome(run: () => unknown): Promise<string> {
  try {
    const value = await run();
    return "ok:" + (JSON.stringify(value) ?? "undefined");
  } catch (error) {
    const failure = error as Error & { code?: string };
    return ["nem", failure.name ?? "Error", failure.code ?? "-", failure.message ?? ""].join("|");
  }
}

/**
 * Đọc lại schema đã khởi tạo từ tệp DB bằng một kết nối CHỈ ĐỌC riêng.
 * Nhận: dbPath — đường dẫn DB.
 * Trả: SchemaSnapshot gồm application_id, user_version, bảng người dùng và search_state.
 */
function readSchema(dbPath: string): SchemaSnapshot {
  const db = new BunDatabase(dbPath, { readonly: true });
  try {
    const app = db.prepare("PRAGMA application_id").get() as { application_id: number };
    const version = db.prepare("PRAGMA user_version").get() as { user_version: number };
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name")
      .all() as { name: string }[];
    const state = db.prepare("SELECT singleton, global_generation FROM search_state ORDER BY singleton").all() as SchemaSnapshot["searchState"];
    return {
      applicationId: app.application_id,
      userVersion: version.user_version,
      tables: tables.map((row) => row.name),
      searchState: state,
    };
  } finally {
    db.close();
  }
}

/**
 * Dựng sẵn một DB "cùng application_id nhưng user_version = 7" để thử nhánh reset schema.
 * Nhận: dbPath — đường dẫn DB.
 * Trả: không.
 */
function seedVersionSeven(dbPath: string): void {
  const db = new BunDatabase(dbPath);
  try {
    db.exec("PRAGMA application_id = " + String(APP_ID));
    db.exec("CREATE TABLE search_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), global_generation INTEGER NOT NULL) STRICT");
    db.exec("INSERT INTO search_state (singleton, global_generation) VALUES (1, 7)");
    db.exec("PRAGMA user_version = 7");
  } finally {
    db.close();
  }
}

/**
 * Validate Config của một bên bằng chuẩn Schemastery.
 * Nhận: api — bề mặt module; input — giá trị thô.
 * Trả: { value } khi hợp lệ, { issues } khi sai.
 */
function validateConfig(api: Api, input: Record<string, unknown>): ConfigValidation {
  const holder = api["SqliteSessionQueryEngine"] as {
    Config: { "~standard": { validate(value: unknown): ConfigValidation } };
  };
  return holder.Config["~standard"].validate(input);
}

afterAll(() => {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
});

describe("artefact: bản sao NGUYÊN VĂN TỪNG BYTE", () => {
  test("lib/index.js: cùng độ dài byte với bundle gốc", () => {
    const built = readFileSync(OURS_FILE, "utf8");
    expect(Buffer.byteLength(built, "utf8")).toBe(Buffer.byteLength(STOCK_TEXT, "utf8"));
    expect(statSync(OURS_FILE).size).toBe(statSync(STOCK_FILE).size);
    expect(statSync(OURS_FILE).size).toBe(Buffer.byteLength(STOCK_TEXT, "utf8"));
  });

  test("lib/index.js: trùng toàn văn + cùng sha256 64 ký tự", () => {
    const built = readFileSync(OURS_FILE, "utf8");
    expect(built).toBe(STOCK_TEXT);
    expect(sha256(built)).toBe(sha256(STOCK_TEXT));
    expect(sha256(built)).toHaveLength(64);
  });
});

describe("bề mặt export A/B", () => {
  test("đúng 8 tên export, hai bên trùng khít", () => {
    expect(Object.keys(ours).sort()).toEqual([...EXPORT_NAMES].sort());
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
  });

  test("6 hằng số + default === SqliteSessionQueryEngine trùng giá trị hai bên", () => {
    for (const name of CONSTANT_NAMES) expect(ours[name]).toBe(stock[name]);
    expect(ours["SESSION_QUERY_SQLITE_SCHEMA_VERSION"]).toBe(8);
    expect(ours["SESSION_QUERY_SQLITE_APPLICATION_ID"]).toBe(1146308689);
    expect(ours["SESSION_QUERY_SQLITE_DEFAULT_LIMIT"]).toBe(20);
    expect(ours["SESSION_QUERY_SQLITE_MAX_LIMIT"]).toBe(100);
    expect(ours["SESSION_QUERY_SQLITE_SNIPPET_CHARS"]).toBe(240);
    expect(ours["SESSION_QUERY_SQLITE_PATH_KEY"]).toBe("launcherSessionQueryPath");
    expect(ours["default"]).toBe(ours["SqliteSessionQueryEngine"]);
    expect(stock["default"]).toBe(stock["SqliteSessionQueryEngine"]);
    expect(typeof ours["SqliteSessionQueryEngine"]).toBe("function");
    expect(typeof stock["SqliteSessionQueryEngine"]).toBe("function");
  });

  test("Config: validate({}) cùng issues, validate({path}) cùng mặc định", () => {
    const empty = [validateConfig(ours, {}), validateConfig(stock, {})];
    expect(JSON.stringify(empty[0])).toBe(JSON.stringify(empty[1]));
    expect(JSON.stringify(empty[0])).toContain("$.path");
    const filled = [validateConfig(ours, { path: DB_PATH }), validateConfig(stock, { path: DB_PATH })];
    expect(JSON.stringify(filled[0])).toBe(JSON.stringify(filled[1]));
    const firstFilled = filled[0];
    if (firstFilled === undefined) throw new Error("validateConfig khong tra ve ket qua");
    const value = firstFilled.value as Record<string, unknown>;
    expect(value["openAt"]).toBe("startup");
    expect(value["journalMode"]).toBe("wal");
    expect(value["defaultLimit"]).toBe(ours["SESSION_QUERY_SQLITE_DEFAULT_LIMIT"]);
    expect(value["maxLimit"]).toBe(ours["SESSION_QUERY_SQLITE_MAX_LIMIT"]);
    expect(value["snippetChars"]).toBe(ours["SESSION_QUERY_SQLITE_SNIPPET_CHARS"]);
  });
});

describe("engine trên Context cordis THẬT (DB TẠM)", () => {
  test("schema khởi tạo: application_id + user_version + bảng đọc lại từ DB tạm A/B y hệt", async () => {
    const [our, their] = await both((rig) => readSchema(rig.dbPath), { config: { openAt: "startup" } });
    expect(our).toBe(their);
    const schema = JSON.parse(our.slice(3)) as SchemaSnapshot;
    expect(schema.applicationId).toBe(Number(ours["SESSION_QUERY_SQLITE_APPLICATION_ID"]));
    expect(schema.userVersion).toBe(Number(ours["SESSION_QUERY_SQLITE_SCHEMA_VERSION"]));
    expect(schema.tables).toContain("search_state");
    expect(schema.tables).toContain("persisted_docs");
    expect(schema.searchState).toEqual([{ singleton: 1, global_generation: 0 }]);
  });

  test("config sau mount: mặc định 20/100/240 + journalMode wal hai bên y hệt", async () => {
    const [our, their] = await both((rig) => rig.engine.config);
    expect(our).toBe(their);
    const config = JSON.parse(our.slice(3)) as Record<string, unknown>;
    expect(config["defaultLimit"]).toBe(20);
    expect(config["maxLimit"]).toBe(100);
    expect(config["snippetChars"]).toBe(240);
    expect(config["journalMode"]).toBe("wal");
    expect(config["path"]).toBe(DB_PATH);
  });

  test("searchSessions trên DB rỗng ⇒ cùng { items: [] }", async () => {
    const [our, their] = await both((rig) => rig.engine.searchSessions({ query: "khong-co-gi" }));
    expect(our).toBe(their);
    expect(our).toBe('ok:{"items":[]}');
  });

  test("limit: mặc định 20, chạm trần 100 OK, vượt 101 ⇒ cùng SESSION_QUERY_INVALID_LIMIT", async () => {
    const [our, their] = await both(async (rig) => ({
      implicit: await rig.engine.searchSessions({ query: "x" }),
      exactlyMax: await rig.engine.searchSessions({ query: "x", limit: 100 }),
      aboveMax: await outcome(() => rig.engine.searchSessions({ query: "x", limit: 101 })),
    }));
    expect(our).toBe(their);
    expect(our).toContain("SESSION_QUERY_INVALID_LIMIT");
    expect(our).toContain("between 1 and 100");
  });

  test("limit: trần cấu hình riêng maxLimit=5 ⇒ cùng lỗi between 1 and 5", async () => {
    const [our, their] = await both(
      async (rig) => ({
        atCap: await rig.engine.searchSessions({ query: "x", limit: 5 }),
        aboveCap: await outcome(() => rig.engine.searchSessions({ query: "x", limit: 6 })),
        negative: await outcome(() => rig.engine.searchSessions({ query: "x", limit: -1 })),
      }),
      { config: { maxLimit: 5, defaultLimit: 3 } },
    );
    expect(our).toBe(their);
    expect(our).toContain("between 1 and 5");
  });

  test("searchEvents phiên không tồn tại ⇒ cùng SESSION_QUERY_SESSION_NOT_FOUND", async () => {
    const [our, their] = await both((rig) => outcome(() => rig.engine.searchEvents({ sessionId: "khong-co", query: "x" })));
    expect(our).toBe(their);
    const message = JSON.parse(our.slice(3)) as string;
    expect(message).toContain("SESSION_QUERY_SESSION_NOT_FOUND");
    expect(message).toContain('session "khong-co" not found');
  });

  test("openAt 'never' ⇒ cùng SESSION_QUERY_SEARCH_DISABLED và KHÔNG tạo tệp DB", async () => {
    const [our, their] = await both(
      async (rig) => ({
        error: await outcome(() => rig.engine.searchSessions({ query: "x" })),
        fileAfter: existsSync(rig.dbPath),
      }),
      { config: { openAt: "never" } },
    );
    expect(our).toBe(their);
    expect(our).toContain("SESSION_QUERY_SEARCH_DISABLED");
    expect(our).toContain('"fileAfter":false');
  });
});

describe("nhánh lỗi A/B", () => {
  test("query rỗng / toàn khoảng trắng / NUL / thiếu query ⇒ cùng SESSION_QUERY_INVALID_QUERY", async () => {
    const [our, their] = await both(async (rig) => [
      await outcome(() => rig.engine.searchSessions({ query: "" })),
      await outcome(() => rig.engine.searchSessions({ query: "   " })),
      await outcome(() => rig.engine.searchSessions({ query: "a\0b" })),
      await outcome(() => rig.engine.searchSessions({})),
    ]);
    expect(our).toBe(their);
    expect(our).toContain("must contain non-whitespace text");
    expect(our).toContain("must be text");
    expect(our).toContain("must not contain NUL");
  });

  test("limit sai kiểu ('3', 3.5, null) ⇒ cùng SESSION_QUERY_INVALID_LIMIT", async () => {
    const [our, their] = await both(async (rig) =>
      Promise.all([
        outcome(() => rig.engine.searchSessions({ query: "x", limit: "3" })),
        outcome(() => rig.engine.searchSessions({ query: "x", limit: 3.5 })),
        outcome(() => rig.engine.searchSessions({ query: "x", limit: null })),
      ]),
    );
    expect(our).toBe(their);
    expect(our).toContain("SESSION_QUERY_INVALID_LIMIT");
    expect(our).toContain("between 1 and 100");
  });

  test("limit âm hoặc 0 (-1, 0) ⇒ cùng SESSION_QUERY_INVALID_LIMIT", async () => {
    const [our, their] = await both(async (rig) => [
      await outcome(() => rig.engine.searchSessions({ query: "x", limit: -1 })),
      await outcome(() => rig.engine.searchSessions({ query: "x", limit: 0 })),
    ]);
    expect(our).toBe(their);
    expect(our).toContain("SESSION_QUERY_INVALID_LIMIT");
  });

  test("sessionId không phải text ⇒ cùng SESSION_QUERY_INVALID_FILTER", async () => {
    const [our, their] = await both(async (rig) => [
      await outcome(() => rig.engine.searchEvents({ sessionId: 5, query: "x" })),
      await outcome(() => rig.engine.searchEvents({ query: "x" })),
    ]);
    expect(our).toBe(their);
    expect(our).toContain("SESSION_QUERY_INVALID_FILTER");
    expect(our).toContain("session id must be text");
  });

  test("đường dẫn DB không hợp lệ (thư mục cha là tệp) ⇒ cùng SESSION_QUERY_INDEX_FAILED", async () => {
    const blocker = join(TEMP_ROOT, "blocker-file");
    const [our, their] = await both((rig) => outcome(() => rig.engine.searchSessions({ query: "x" })), {
      config: { path: join(blocker, "index.sqlite") },
      before: () => writeFileSync(blocker, "x"),
    });
    expect(our).toBe(their);
    expect(our).toContain("SESSION_QUERY_INDEX_FAILED");
    expect(our).toContain("failed to open");
  });

  test("DB có application_id lạ ⇒ cùng 'belongs to another application'", async () => {
    const [our, their] = await both((rig) => outcome(() => rig.engine.searchSessions({ query: "x" })), {
      before: (dbPath) => {
        const db = new BunDatabase(dbPath);
        try {
          db.exec("PRAGMA application_id = 12345");
        } finally {
          db.close();
        }
      },
    });
    expect(our).toBe(their);
    expect(our).toContain("SESSION_QUERY_INDEX_FAILED");
    expect(our).toContain("belongs to another application");
  });

  test("DB application_id=0 nhưng có bảng lạ ⇒ cùng 'not an empty or recognized derived index'", async () => {
    const [our, their] = await both((rig) => outcome(() => rig.engine.searchSessions({ query: "x" })), {
      before: (dbPath) => {
        const db = new BunDatabase(dbPath);
        try {
          db.exec("CREATE TABLE foreign_table (x INTEGER)");
        } finally {
          db.close();
        }
      },
    });
    expect(our).toBe(their);
    expect(our).toContain("is not an empty or recognized derived index");
  });

  test("DB cùng application_id nhưng user_version=7 ⇒ cùng reset về 8", async () => {
    const [our, their] = await both(
      async (rig) => ({ search: await rig.engine.searchSessions({ query: "x" }), schema: readSchema(rig.dbPath) }),
      { before: seedVersionSeven },
    );
    expect(our).toBe(their);
    const parsed = JSON.parse(our.slice(3)) as { search: unknown; schema: SchemaSnapshot };
    expect(parsed.search).toEqual({ items: [] });
    expect(parsed.schema.userVersion).toBe(SCHEMA_VERSION);
    expect(parsed.schema.applicationId).toBe(APP_ID);
  });
});

describe("vòng đời A/B", () => {
  test("close() hai lần ⇒ cùng một promise, cùng trả undefined", async () => {
    const [our, their] = await both(async (rig) => {
      const first = rig.engine.close();
      const second = rig.engine.close();
      return { same: first === second, first: (await first) ?? null, second: (await second) ?? null };
    });
    expect(our).toBe(their);
    expect(our).toContain('"same":true');
    expect(our).toContain('"first":null');
    expect(our).toContain('"second":null');
  });

  test("đóng rồi dùng lại ⇒ cùng SESSION_QUERY_INDEX_FAILED 'index is closed'", async () => {
    const [our, their] = await both(async (rig) => {
      await rig.engine.close();
      return {
        searchSessions: await outcome(() => rig.engine.searchSessions({ query: "x" })),
        searchEvents: await outcome(() => rig.engine.searchEvents({ sessionId: "s", query: "x" })),
      };
    });
    expect(our).toBe(their);
    expect(our).toContain("SESSION_QUERY_INDEX_FAILED");
    expect(our).toContain("SQLite index is closed");
  });

  test("hai engine cùng một DB ⇒ cùng hành vi hai bên", async () => {
    const [our, their] = await both(async (rig, api) => {
      const secondCtx = newContext();
      const second = await mount(api, secondCtx, { path: rig.dbPath });
      try {
        return {
          first: await rig.engine.searchSessions({ query: "x" }),
          second: await second.engine.searchSessions({ query: "x" }),
        };
      } finally {
        await second.engine.close();
        await second.fiber.dispose();
      }
    });
    expect(our).toBe(their);
    expect(our).toBe('ok:{"first":{"items":[]},"second":{"items":[]}}');
  });

  test("mở/đóng engine hai lần trên cùng DB ⇒ cùng kết quả hai bên", async () => {
    const [our, their] = await both(async (rig, api) => {
      const first = await rig.engine.searchSessions({ query: "x" });
      await rig.engine.close();
      const reopened = await mount(api, newContext(), { path: rig.dbPath });
      try {
        return { first, second: await reopened.engine.searchSessions({ query: "x" }) };
      } finally {
        await reopened.engine.close();
        await reopened.fiber.dispose();
      }
    });
    expect(our).toBe(their);
    expect(our).toBe('ok:{"first":{"items":[]},"second":{"items":[]}}');
  });

  test("dispose Context ⇒ engine tự đóng, service biến mất (A/B y hệt)", async () => {
    const [our, their] = await both(async (rig) => {
      await rig.fiber.dispose();
      return {
        search: await outcome(() => rig.engine.searchSessions({ query: "x" })),
        service: String(typeof rig.ctx.sessionQuery),
      };
    });
    expect(our).toBe(their);
    expect(our).toContain("SESSION_QUERY_INDEX_FAILED");
    expect(our).toContain('"service":"undefined"');
  });

  test("dọn tệp: close() + xoá DB tạm ⇒ không còn index/wal", async () => {
    const [our, their] = await both(async (rig) => {
      await rig.engine.searchSessions({ query: "x" });
      await rig.engine.close();
      resetDb(rig.dbPath);
      return { db: existsSync(rig.dbPath), wal: existsSync(rig.dbPath + "-wal"), shm: existsSync(rig.dbPath + "-shm") };
    });
    expect(our).toBe(their);
    expect(our).toBe('ok:{"db":false,"wal":false,"shm":false}');
  });

  test("DB TẠM: mọi đường dẫn DB nằm trong mkdtemp, không đụng ~/.galaxy hay ~/.dsh", () => {
    expect(TEMP_ROOT.startsWith(tmpdir())).toBe(true);
    expect(DB_PATH.startsWith(TEMP_ROOT)).toBe(true);
    expect(isTempPath(DB_PATH)).toBe(true);
    expect(DB_PATH.includes(".galaxy")).toBe(false);
    expect(DB_PATH.includes(".dsh")).toBe(false);
  });
});

/**
 * Node ≥22 có 'node:sqlite' — ĐÚNG driver THẬT mà artefact nạp LAZY trong openSearchDatabase.
 * Ứng viên xếp mới → cũ; chỉ nhận bản chạy được 'node:sqlite' (bun 1.3.14 không có module này).
 */
const NODE_CANDIDATES = [
  "/Users/buitronghieu/.nvm/versions/node/v26.9.0/bin/node",
  "/Users/buitronghieu/.nvm/versions/node/v24.4.1/bin/node",
  "/usr/local/bin/node",
];
/** Node dùng cho A/B THẬT; "" nghĩa là máy không có bản nào ⇒ mọi ca node:sqlite THẬT bị SKIP. */
const REAL_NODE =
  NODE_CANDIDATES.find(
    (path) => existsSync(path) && Bun.spawnSync([path, "--input-type=module", "-e", "await import('node:sqlite')"]).exitCode === 0,
  ) ?? "";
/** Bundle cordis THẬT của runtime app — dựng Context trong tiến trình node. */
const CORDIS_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thời gian tối đa một ca node THẬT (hai tiến trình node, mỗi tiến trình nạp cordis + mở DB). */
const NODE_TEST_TIMEOUT_MS = 30_000;

/**
 * Thân từng kịch bản chạy trong tiến trình node THẬT (dùng open/shut/seed/snapshot/outcome của khung).
 * Mỗi thân PHẢI trả về giá trị JSON-serializable; lỗi mong đợi bọc bằng outcome để hai bên so chuỗi.
 */
const NODE_CASES = {
  "fresh-pragmas": `const m = await open({ openAt: "startup" }); await shut(m); return snapshot();`,
  "empty-search": `const m = await open(); try { return await m.engine.searchSessions({ query: "khong-co-gi" }); } finally { await shut(m); }`,
  "limit-over-max": `const m = await open(); try { return { implicit: await m.engine.searchSessions({ query: "x" }), exactlyMax: await m.engine.searchSessions({ query: "x", limit: 100 }), aboveMax: await outcome(() => m.engine.searchSessions({ query: "x", limit: 101 })) }; } finally { await shut(m); }`,
  "limit-invalid": `const m = await open(); try { return [await outcome(() => m.engine.searchSessions({ query: "x", limit: "3" })), await outcome(() => m.engine.searchSessions({ query: "x", limit: 3.5 })), await outcome(() => m.engine.searchSessions({ query: "x", limit: null }))]; } finally { await shut(m); }`,
  "query-invalid": `const m = await open(); try { const nul = "a" + String.fromCharCode(0) + "b"; return [await outcome(() => m.engine.searchSessions({ query: "" })), await outcome(() => m.engine.searchSessions({ query: "   " })), await outcome(() => m.engine.searchSessions({ query: nul })), await outcome(() => m.engine.searchSessions({}))]; } finally { await shut(m); }`,
  "reopen": `const first = await open(); const one = await first.engine.searchSessions({ query: "x" }); await shut(first); const second = await open(); try { return { first: one, second: await second.engine.searchSessions({ query: "x" }) }; } finally { await shut(second); }`,
  "foreign-application-id": `seed("PRAGMA application_id = 12345"); const m = await open(); try { return await outcome(() => m.engine.searchSessions({ query: "x" })); } finally { await shut(m); }`,
  "foreign-user-version": `seed("PRAGMA application_id = 1146308689; CREATE TABLE search_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), global_generation INTEGER NOT NULL) STRICT; INSERT INTO search_state (singleton, global_generation) VALUES (1, 7); PRAGMA user_version = 7"); const m = await open(); const search = await m.engine.searchSessions({ query: "x" }); await shut(m); return { search, schema: snapshot() };`,
  "two-engines": `const a = await open(); const b = await open(); try { return { first: await a.engine.searchSessions({ query: "x" }), second: await b.engine.searchSessions({ query: "x" }) }; } finally { await shut(a); await shut(b); }`,
  "open-at-never": `const m = await open({ openAt: "never" }); try { return { error: await outcome(() => m.engine.searchSessions({ query: "x" })), fileAfter: existsSync(db) }; } finally { await shut(m); }`,
  "blank-path": `writeFileSync(db + ".blocker", "x"); const m = await open({ path: db + ".blocker/index.sqlite" }); try { return await outcome(() => m.engine.searchSessions({ query: "x" })); } finally { await shut(m); }`,
  "close-twice": `const m = await open(); const first = m.engine.close(); const second = m.engine.close(); await shut(m); return { same: first === second, first: (await first) ?? null, second: (await second) ?? null };`,
  "search-events-unknown": `const m = await open(); try { return await outcome(() => m.engine.searchEvents({ sessionId: "khong-co", query: "x" })); } finally { await shut(m); }`,
} as const;
/** Tên kịch bản node hợp lệ. */
type NodeCase = keyof typeof NODE_CASES;

/**
 * Sinh script ESM chạy bằng node THẬT: nạp cordis + bundle cần đo, dựng Context, chạy kịch bản, in JSON.
 * Nhận: moduleFile — bundle (của ta hoặc gốc); scenario — tên kịch bản; db — DB tạm dùng chung hai bên.
 * Trả: mã nguồn ESM truyền cho 'node --input-type=module -e'.
 */
function nodeScript(moduleFile: string, scenario: NodeCase, db: string): string {
  return `
const { Context } = await import(${JSON.stringify("file://" + CORDIS_FILE)});
const api = await import(${JSON.stringify("file://" + moduleFile)});
const { DatabaseSync } = await import("node:sqlite");
const { existsSync, writeFileSync } = await import("node:fs");
const db = ${JSON.stringify(db)};
const outcome = async (run) => { try { return "ok:" + JSON.stringify(await run()); } catch (e) { return ["nem", e.name ?? "Error", e.code ?? "-", e.message ?? ""].join("|"); } };
const open = async (config = {}) => {
  const ctx = new Context();
  ctx.provide("sessions", { list: () => [], get: () => undefined });
  const fiber = ctx.plugin(api.SqliteSessionQueryEngine, { path: db, openAt: "first-search", ...config });
  await fiber.await();
  return { ctx, fiber, engine: ctx.sessionQuery };
};
const shut = async (m) => { try { await m.engine.close(); } catch {} try { await m.fiber.dispose(); } catch {} };
const seed = (sql) => { const d = new DatabaseSync(db); try { d.exec(sql); } finally { d.close(); } };
const snapshot = () => { const d = new DatabaseSync(db); try { return { applicationId: d.prepare("PRAGMA application_id").get().application_id, userVersion: d.prepare("PRAGMA user_version").get().user_version, tables: d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name").all().map((row) => row.name) }; } finally { d.close(); } };
const main = async () => { ${NODE_CASES[scenario]} };
const result = await main();
console.log(typeof result === "string" ? result : JSON.stringify(result));
`;
}

/**
 * Chạy MỘT kịch bản bằng node THẬT trên một bên (xoá DB tạm trước để hai bên bắt đầu giống nhau).
 * Nhận: moduleFile — bundle cần đo; scenario — tên kịch bản; db — DB tạm dùng chung.
 * Trả: chuỗi JSON do tiến trình node in ra.
 */
function runRealNode(moduleFile: string, scenario: NodeCase, db: string): string {
  if (!db.startsWith(tmpdir()) || db.includes(".galaxy") || db.includes(".dsh")) throw new Error("DB ngoai thu muc tam: " + db);
  resetDb(db);
  const proc = Bun.spawnSync([REAL_NODE, "--input-type=module", "-e", nodeScript(moduleFile, scenario, db)]);
  if (proc.exitCode !== 0) throw new Error("node that bai (" + scenario + "): " + proc.stderr.toString());
  return proc.stdout.toString().trim();
}

/**
 * A/B bằng node THẬT: hai tiến trình node riêng, CÙNG kịch bản + CÙNG đường dẫn DB trong mkdtemp.
 * Nhận: scenario — tên kịch bản.
 * Trả: cặp [JSON của ta, JSON của gốc]; thư mục tạm bị xoá trong finally.
 */
function realBoth(scenario: NodeCase): [string, string] {
  const dir = mkdtempSync(join(tmpdir(), "gbh-session-query-node-"));
  const db = join(dir, "index.sqlite");
  try {
    return [runRealNode(OURS_FILE, scenario, db), runRealNode(STOCK_FILE, scenario, db)];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Đăng ký một ca A/B node THẬT; máy không có node ≥22 thì SKIP kèm lý do ngay trong tên ca.
 * Nhận: name — tên ca; run — thân ca.
 * Trả: không.
 */
function realTest(name: string, run: () => void): void {
  if (REAL_NODE === "") test.skip(name + " [SKIP: khong co node >=22 chay duoc node:sqlite]", run, NODE_TEST_TIMEOUT_MS);
  else test(name, run, NODE_TEST_TIMEOUT_MS);
}

describe("A/B với node:sqlite THẬT (spawn node + DB TẠM)", () => {
  realTest("node thật · fresh-pragmas: application_id + user_version + bảng y hệt", () => {
    const [our, their] = realBoth("fresh-pragmas");
    expect(our).toBe(their);
    const schema = JSON.parse(our) as { applicationId: number; userVersion: number; tables: string[] };
    expect([schema.applicationId, schema.userVersion]).toEqual([APP_ID, SCHEMA_VERSION]);
    expect(schema.tables).toContain("persisted_docs");
  });

  realTest("node thật · empty-search: DB rỗng ⇒ cùng { items: [] }", () => {
    const [our, their] = realBoth("empty-search");
    expect(our).toBe(their);
    expect(our).toBe('{"items":[]}');
  });

  realTest("node thật · limit-over-max: 101 vượt trần ⇒ cùng SESSION_QUERY_INVALID_LIMIT", () => {
    const [our, their] = realBoth("limit-over-max");
    expect(our).toBe(their);
    expect(our).toContain("between 1 and 100");
    expect(our).toContain('"implicit":{"items":[]}');
  });

  realTest("node thật · limit-invalid: '3'/3.5/null ⇒ cùng SESSION_QUERY_INVALID_LIMIT", () => {
    const [our, their] = realBoth("limit-invalid");
    expect(our).toBe(their);
    expect(our).toContain("SESSION_QUERY_INVALID_LIMIT");
    expect(our).toContain("must be an integer between 1 and 100");
  });

  realTest("node thật · query-invalid: rỗng/khoảng trắng/NUL/thiếu ⇒ cùng INVALID_QUERY", () => {
    const [our, their] = realBoth("query-invalid");
    expect(our).toBe(their);
    expect(our).toContain("must contain non-whitespace text");
    expect(our).toContain("must be text");
    expect(our).toContain("must not contain NUL");
  });

  realTest("node thật · reopen: đóng rồi mở lại cùng DB ⇒ hai lượt đều { items: [] }", () => {
    const [our, their] = realBoth("reopen");
    expect(our).toBe(their);
    expect(our).toBe('{"first":{"items":[]},"second":{"items":[]}}');
  });

  realTest("node thật · foreign-application-id: application_id lạ ⇒ cùng 'belongs to another application'", () => {
    const [our, their] = realBoth("foreign-application-id");
    expect(our).toBe(their);
    expect(our).toContain("SESSION_QUERY_INDEX_FAILED");
    expect(our).toContain("belongs to another application");
  });

  realTest("node thật · foreign-user-version: user_version=7 ⇒ cùng reset về 8, không ném", () => {
    const [our, their] = realBoth("foreign-user-version");
    expect(our).toBe(their);
    const parsed = JSON.parse(our) as { search: unknown; schema: { applicationId: number; userVersion: number } };
    expect(parsed.search).toEqual({ items: [] });
    expect([parsed.schema.applicationId, parsed.schema.userVersion]).toEqual([APP_ID, SCHEMA_VERSION]);
  });

  realTest("node thật · two-engines: hai engine cùng DB ⇒ cùng kết quả hai bên", () => {
    const [our, their] = realBoth("two-engines");
    expect(our).toBe(their);
    expect(our).toBe('{"first":{"items":[]},"second":{"items":[]}}');
  });

  realTest("node thật · open-at-never: cùng SEARCH_DISABLED và KHÔNG tạo tệp DB", () => {
    const [our, their] = realBoth("open-at-never");
    expect(our).toBe(their);
    expect(our).toContain("SESSION_QUERY_SEARCH_DISABLED");
    expect(our).toContain('"fileAfter":false');
  });

  realTest("node thật · blank-path: thư mục cha là tệp ⇒ cùng 'failed to open'", () => {
    const [our, their] = realBoth("blank-path");
    expect(our).toBe(their);
    expect(our).toContain("SESSION_QUERY_INDEX_FAILED");
    expect(our).toContain("failed to open");
  });

  realTest("node thật · close-twice: cùng một promise, cùng trả undefined", () => {
    const [our, their] = realBoth("close-twice");
    expect(our).toBe(their);
    expect(our).toContain('"same":true');
    expect(our).toContain('"first":null');
  });

  realTest("node thật · search-events-unknown: phiên lạ ⇒ cùng SESSION_QUERY_SESSION_NOT_FOUND", () => {
    const [our, their] = realBoth("search-events-unknown");
    expect(our).toBe(their);
    expect(our).toContain('session "khong-co" not found');
  });
});
