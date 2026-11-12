/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test goi tool-session-query (PLUGIN cordis): artefact BYTE-IDENTICAL bundle goc + be mat export +
 *      Config schema + apply tren Context cordis THAT voi dich vu GIA (tools/systemPrompt/sessionQuery/
 *      sessionProjections), va A/B 5 tool o nhanh loi/hop le
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
// 05/11/2026 (P1b): artefact của ta mang id GBH ⇒ so bản gốc phải qua phép chuẩn hoá dùng chung (runbook bước 2).
import { chuanHoaHost } from "../lib/artefact-normalize.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "tool-session-query");
/** Artefact của ta. */
const OURS_FILE = join(PKG, "lib", "index.js");
/** Bundle GỐC (CHỈ ĐỌC). */
const STOCK_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-session-query", "lib", "index.js");
/** Nội dung bundle gốc. */
const STOCK_TEXT = readFileSync(STOCK_FILE, "utf8");
/** Module session-query THẬT của KERNEL — dựng lỗi SessionQueryError ĐÚNG lớp cho dịch vụ giả phía gốc. */
const SESSION_QUERY_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-query", "lib", "index.js");
/** Module session-query mà CHÍNH artifact ta nạp (workspace) — TỆP khác trên đĩa (nội dung y hệt). */
// 05/11/2026 (P1b): artefact của ta nay import `@galaxy-blackhole/gbh-session-query` ⇒ lớp lỗi của phía ta phải nạp
// từ CHÍNH gói đó (bản cũ trong PKG/node_modules là id stock ⇒ khác instance, `instanceof` TRƯỢT).
const OUR_SESSION_QUERY_FILE = join(REPO, "packages", "host", "session-query", "lib", "index.js");
/** Sáu tên export của gói, ĐÚNG bộ mà plugin công bố. */
const EXPORT_NAMES = ["Config", "DEFAULT_MAX_SEARCH_RESULTS", "DEFAULT_SEARCH_TIMEOUT_MS", "apply", "inject", "name"];
/** Năm tool plugin đăng ký, ĐÚNG thứ tự apply. */
const TOOL_NAMES = ["session_search", "session_event_search", "session_trace", "session_event_trace", "session_event_read"];
/** Cwd workspace GIẢ của caller. */
const CWD = "/tmp/gbh-session-query-ws";
/** Thời điểm GIẢ dùng cho header/event. */
const AT = "2026-10-01T00:00:00.000Z";

/** Bề mặt module (của ta hoặc gốc). */
type Api = Record<string, unknown>;

/** Bề mặt Context cordis tối thiểu mà test chạm tới. */
interface Ctx {
  /** Cấp một dịch vụ GIẢ cho Context. */
  provide(name: string, value: unknown): void;
  /** Đăng ký plugin theo vòng đời cordis THẬT. */
  plugin(plugin: unknown, config?: unknown): FiberLike;
  /** Logger của Context (test thay warn để đếm lời gọi). */
  logger: { warn(...args: unknown[]): void };
}

/** Fiber plugin cordis (chỉ đọc trạng thái). */
interface FiberLike {
  /** Trạng thái fiber: 0 = chờ inject, 2 = đã chạy. */
  state?: number;
}

/** Tool đã defineTool (bề mặt test chạm tới). */
interface ToolLike {
  /** Tên tool. */
  name: string;
  /** Mô tả tool. */
  description: string;
  /** JSON Schema tham số. */
  parameters: unknown;
  /** Vỏ output (chỉ cần schema). */
  output: { schema: unknown };
  /** Hạn chót cooperative của tool (chỉ 2 tool tìm kiếm có). */
  timeoutMs?: number;
  /** Thân tool: validate tham số rồi chạy operation. */
  execute(args: unknown, exec: unknown): Promise<unknown>;
  /** Card trình bày lời gọi. */
  presentCall(args: unknown): unknown;
  /** Cờ an toàn đồng thời (chỉ 3 tool đọc có). */
  isConcurrencySafe?(args: unknown): unknown;
}

/** Bản ghi lời gọi dịch vụ GIẢ. */
interface Recorder {
  /** Các section systemPrompt đã nhận. */
  sections: unknown[];
  /** Các khoá getSectionOrder đã hỏi. */
  orders: unknown[];
  /** Các tool đã register. */
  tools: ToolLike[];
  /** Các lượt ctx.logger.warn. */
  warns: unknown[][];
}

/** Kết quả một lượt gọi apply trên Context THẬT. */
interface MountResult {
  /** Context vừa dựng. */
  ctx: Ctx;
  /** Bản ghi dịch vụ giả. */
  rec: Recorder;
  /** Tool đã đăng ký, tra theo tên. */
  tools: Map<string, ToolLike>;
  /** Lỗi apply ném ra (nếu có). */
  error?: Error;
}

/** Tuỳ chọn dựng Context GIẢ. */
interface MountOptions {
  /** Cấu hình truyền cho apply. */
  config?: Record<string, unknown>;
  /** Có cấp dịch vụ systemPrompt không (mặc định true). */
  withPrompt?: boolean;
  /** Có cấp dịch vụ tools không (mặc định true). */
  withTools?: boolean;
  /** Ghi đè dịch vụ sessionQuery giả. */
  query?: Record<string, unknown>;
  /** Ghi đè dịch vụ sessionProjections giả. */
  projections?: Record<string, unknown>;
}

/** Dịch vụ sessionProjections GIẢ: luôn có bước hiện tại. */
const DEFAULT_PROJECTIONS: Record<string, unknown> = { stateOf: () => ({ lastStepStartSeq: 5 }) };

/** Lớp Context cordis THẬT của runtime app. */
const ContextCtor = await loadCordis();
/** Nạp artefact của ta. */
const ours = (await import(OURS_FILE)) as Api;
/** Nạp bundle gốc. */
const stock = (await import(STOCK_FILE)) as Api;
/**
 * Lớp lỗi session-query THẬT hai phía (dùng cho dịch vụ giả ném lỗi ĐÚNG lớp).
 * `instanceof` so DANH TÍNH LỚP, mà repo có HAI cây cài (workspace cho ta, kernel cho bản gốc) nên mỗi bên
 * phải nhận lỗi mint bằng chính lớp của cây nó nạp — lỗi của cây kia là "lỗi lạ" với bên này.
 */
const { SessionQueryError: StockSessionQueryError } = (await import(SESSION_QUERY_FILE)) as { SessionQueryError: new (message: string, code?: string) => Error };
const { SessionQueryError: OurSessionQueryError } = (await import(OUR_SESSION_QUERY_FILE)) as { SessionQueryError: new (message: string, code?: string) => Error };

/**
 * Băm SHA-256 một chuỗi UTF-8.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Nạp cordis THẬT từ runtime của app.
 * Nhận: không.
 * Trả: lớp Context.
 */
async function loadCordis(): Promise<new () => Ctx> {
  const mod = (await import(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js"))) as { Context: new () => Ctx };
  return mod.Context;
}

/**
 * Đọc schema Config của một bên và validate đầu vào.
 * Nhận: api — bề mặt module; input — giá trị thô.
 * Trả: { value } khi hợp lệ, { issues } khi sai.
 */
function validateConfig(api: Api, input: Record<string, unknown>): { value?: unknown; issues?: unknown } {
  const holder = api["Config"] as { "~standard": { validate(value: unknown): { value?: unknown; issues?: unknown } } };
  return holder["~standard"].validate(input);
}

/**
 * Dựng header phiên GIẢ.
 * Nhận: id — mã phiên; extra — trường bổ sung.
 * Trả: object header có cwd + createdAt.
 */
function headerOf(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, cwd: CWD, createdAt: AT, ...extra };
}

/**
 * Dựng một event GIẢ tối thiểu cho phần đọc/trace.
 * Nhận: seq — số thứ tự event.
 * Trả: object event có type/surface/time.
 */
function eventOf(seq: number): Record<string, unknown> {
  return { seq, type: "user/message", surface: "current", time: AT };
}

/**
 * Dựng một quan sát tiêu đề phiên GIẢ.
 * Nhận: id — mã phiên; title — tiêu đề.
 * Trả: observation đúng hợp đồng readTitleSnapshots.
 */
function snapshotOf(id: string, title: string): Record<string, unknown> {
  return { sessionId: id, value: { session: headerOf(id), title: { title } } };
}

/**
 * Dịch vụ sessionQuery GIẢ: đủ 7 phương thức plugin gọi, mọi thứ rỗng/êm.
 * Nhận: overrides — phương thức ghi đè (để dựng nhánh lỗi).
 * Trả: object thoả bề mặt sessionQuery.
 */
function makeQuery(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    searchSessions: async () => ({ items: [], nextCursor: undefined }),
    readTitleSnapshots: async (ids: string[]) => ids.map((id) => snapshotOf(id, "Tieu de")),
    filterSessions: async () => [],
    searchEvents: async () => ({ items: [], nextCursor: undefined, session: headerOf("s1") }),
    traceSession: async () => ({ target: { header: headerOf("s1"), live: true, persisted: true }, ancestors: [], descendants: [], complete: true }),
    traceEvent: async () => ({
      session: headerOf("s1"),
      target: eventOf(1),
      replacementChain: [],
      replacedEventSeqs: [],
      sourceEventSeqs: [],
      derivedEventSeqs: [],
    }),
    readEvent: async () => ({ session: headerOf("s1"), target: eventOf(1), events: [] }),
    ...overrides,
  };
}

/**
 * Tạo bản ghi lời gọi dịch vụ giả.
 * Nhận: không.
 * Trả: Recorder rỗng.
 */
function makeRecorder(): Recorder {
  return { sections: [], orders: [], tools: [], warns: [] };
}

/**
 * Dịch vụ systemPrompt GIẢ: ghi lại section + khoá order.
 * Nhận: rec — bản ghi.
 * Trả: object thoả bề mặt systemPrompt mà apply gọi.
 */
function promptService(rec: Recorder): Record<string, unknown> {
  return {
    section: (value: unknown) => {
      rec.sections.push(value);
    },
    getSectionOrder: (key: unknown) => {
      rec.orders.push(key);
      return 700;
    },
  };
}

/**
 * Dịch vụ tools GIẢ: ghi lại từng tool register.
 * Nhận: rec — bản ghi.
 * Trả: object thoả bề mặt tools.
 */
function toolsService(rec: Recorder): Record<string, unknown> {
  return {
    register: (tool: ToolLike) => {
      rec.tools.push(tool);
    },
  };
}

/**
 * Dựng Context cordis THẬT + dịch vụ GIẢ rồi gọi apply của một bên (KHÔNG ném).
 * Nhận: api — bề mặt module; options — cấu hình + dịch vụ giả.
 * Trả: { ctx, rec, tools, error } — error là lỗi apply nếu có.
 */
function mountApply(api: Api, options: MountOptions = {}): MountResult {
  const ctx = new ContextCtor();
  const rec = makeRecorder();
  if (options.withPrompt !== false) ctx.provide("systemPrompt", promptService(rec));
  if (options.withTools !== false) ctx.provide("tools", toolsService(rec));
  ctx.provide("sessionQuery", makeQuery(options.query));
  ctx.provide("sessionProjections", options.projections ?? DEFAULT_PROJECTIONS);
  ctx.logger.warn = (...args: unknown[]) => {
    rec.warns.push(args);
  };
  let error: Error | undefined;
  try {
    (api["apply"] as (target: Ctx, config: Record<string, unknown>) => void)(ctx, options.config ?? {});
  } catch (caught) {
    error = caught as Error;
  }
  const map = new Map<string, ToolLike>();
  for (const tool of rec.tools) map.set(tool.name, tool);
  return { ctx, rec, tools: map, error };
}

/**
 * Dựng Context GIẢ rồi gọi apply, NÉM lại lỗi apply (dùng cho kịch bản cần rig sống).
 * Nhận: api — bề mặt module; options — cấu hình + dịch vụ giả.
 * Trả: MountResult khi apply thành công.
 */
function mountRig(api: Api, options: MountOptions = {}): MountResult {
  const result = mountApply(api, options);
  if (result.error !== undefined) throw result.error;
  return result;
}

/**
 * Chụp lại "dấu vết đăng ký" của một lượt apply (section, order, tool, lỗi).
 * Nhận: api — bề mặt module; options — cấu hình + dịch vụ giả.
 * Trả: object JSON-so-sánh-được.
 */
function applySnapshot(api: Api, options: MountOptions = {}): Record<string, unknown> {
  const result = mountApply(api, options);
  return {
    error: result.error === undefined ? null : result.error.name + "|" + result.error.message,
    sections: result.rec.sections,
    orders: result.rec.orders,
    tools: result.rec.tools.map((tool) => tool.name),
  };
}

/**
 * Chụp spec một tool (phần model-facing).
 * Nhận: tool — tool đã define.
 * Trả: object spec JSON-so-sánh-được.
 */
function specOf(tool: ToolLike): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    output: tool.output.schema,
    timeoutMs: tool.timeoutMs ?? null,
    concurrencySafe: typeof tool.isConcurrencySafe === "function",
  };
}

/**
 * Chụp spec CẢ 5 tool của một bên sau khi apply.
 * Nhận: api — bề mặt module; options — cấu hình + dịch vụ giả.
 * Trả: chuỗi JSON spec 5 tool.
 */
function specsOf(api: Api, options: MountOptions = {}): string {
  const result = mountRig(api, options);
  return JSON.stringify(result.rec.tools.map(specOf));
}

/**
 * Lấy một tool theo tên từ rig, báo lỗi rõ khi thiếu.
 * Nhận: rig — kết quả mount; name — tên tool.
 * Trả: ToolLike.
 */
function toolOf(rig: MountResult, name: string): ToolLike {
  const tool = rig.tools.get(name);
  if (tool === undefined) throw new Error("khong co tool " + name);
  return tool;
}

/**
 * Dựng exec GIẢ (agent + signal) cho thân tool.
 * Nhận: options.cwd — cwd của caller (null = caller KHÔNG có workspace).
 * Trả: object exec tối thiểu.
 */
function makeExec(options: { cwd?: string | null } = {}): Record<string, unknown> {
  const cwd = options.cwd === undefined ? CWD : options.cwd;
  const header = cwd === null ? { id: "s1" } : { id: "s1", cwd };
  return { agent: { session: { id: "s1", header } }, signal: new AbortController().signal };
}

/**
 * Chạy một lượt và ghi kết quả hoặc lỗi thành chuỗi so sánh được.
 * Nhận: run — hàm cần chạy (sync hoặc async).
 * Trả: "ok:<JSON>" hoặc "nem|<name>|<code>|<message>".
 */
async function outcome(run: () => unknown): Promise<string> {
  try {
    return "ok:" + JSON.stringify(await run());
  } catch (error) {
    const failure = error as Error & { code?: string };
    return ["nem", failure.name, failure.code ?? "-", failure.message].join("|");
  }
}

/**
 * Chạy thân một tool rồi gói kết quả/lỗi thành chuỗi.
 * Nhận: rig — kết quả mount; name — tên tool; args — tham số; exec — ngữ cảnh gọi.
 * Trả: chuỗi kết quả hoặc lỗi.
 */
async function runTool(rig: MountResult, name: string, args: unknown, exec: unknown): Promise<string> {
  return outcome(() => toolOf(rig, name).execute(args, exec));
}

/**
 * Chạy một kịch bản trên một bên với Context mới.
 * Nhận: api — bề mặt module; scenario — kịch bản nhận rig; options — cấu hình + dịch vụ giả.
 * Trả: chuỗi kết quả/lỗi.
 */
async function outcomeOn(api: Api, scenario: (rig: MountResult) => unknown, options: MountOptions = {}): Promise<string> {
  return outcome(() => scenario(mountRig(api, options)));
}

/**
 * Chạy CÙNG kịch bản trên artefact của ta và bundle gốc.
 * Nhận: scenario — kịch bản nhận rig; options — cấu hình + dịch vụ giả.
 * Trả: cặp [kết quả của ta, kết quả gốc].
 */
async function both(scenario: (rig: MountResult) => unknown, options: MountOptions = {}): Promise<[string, string]> {
  return [await outcomeOn(ours, scenario, options), await outcomeOn(stock, scenario, options)];
}

/**
 * Đăng ký plugin qua vòng đời cordis THẬT rồi chụp trạng thái.
 * Nhận: api — bề mặt module; provideServices — có cấp đủ 4 dịch vụ giả hay không.
 * Trả: object { error, state, sections, orders, tools } JSON-so-sánh-được.
 */
async function pluginSnapshot(api: Api, provideServices: boolean): Promise<Record<string, unknown>> {
  const ctx = new ContextCtor();
  const rec = makeRecorder();
  if (provideServices) {
    ctx.provide("systemPrompt", promptService(rec));
    ctx.provide("tools", toolsService(rec));
    ctx.provide("sessionQuery", makeQuery());
    ctx.provide("sessionProjections", DEFAULT_PROJECTIONS);
  }
  const plugin = { name: api["name"], inject: api["inject"], apply: api["apply"], Config: api["Config"] };
  let error: Error | undefined;
  let fiber: FiberLike | undefined;
  try {
    fiber = ctx.plugin(plugin, {});
  } catch (caught) {
    error = caught as Error;
  }
  await new Promise((resolve) => setTimeout(resolve, 30));
  return {
    error: error === undefined ? null : error.name + "|" + error.message,
    state: fiber?.state ?? null,
    sections: rec.sections.length,
    orders: rec.orders.length,
    tools: rec.tools.map((tool) => tool.name),
  };
}

describe("artefact: plugin port NGUYÊN VĂN TỪNG BYTE", () => {
  test("lib/index.js: cùng độ dài byte với bundle gốc", () => {
    const built = readFileSync(OURS_FILE, "utf8");
    // 05/11/2026 (P1b): so SAU chuẩn hoá id GBH → id stock (độ dài artefact thật đổi vì id dài hơn).
    const chuanHoa = chuanHoaHost(built);
    expect(chuanHoa.length).toBe(STOCK_TEXT.length);
    expect(Buffer.byteLength(chuanHoa, "utf8")).toBe(Buffer.byteLength(STOCK_TEXT, "utf8"));
  });

  test("lib/index.js: trùng từng byte + cùng sha256", () => {
    const built = readFileSync(OURS_FILE, "utf8");
    // 05/11/2026 (P1b): trùng TOÀN VĂN sau chuẩn hoá id GBH → id stock (runbook bước 2, phép 3+4).
    expect(chuanHoaHost(built)).toBe(STOCK_TEXT);
    expect(sha256(chuanHoaHost(built))).toBe(sha256(STOCK_TEXT));
    expect(sha256(chuanHoaHost(built))).toHaveLength(64);
  });
});

describe("bề mặt export A/B", () => {
  test("cùng ĐÚNG 6 tên export: Config + 2 hằng số + apply + inject + name", () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual([...EXPORT_NAMES].sort());
  });

  test("2 hằng số + name + inject + kiểu apply trùng giá trị hai bên", () => {
    expect(ours["DEFAULT_MAX_SEARCH_RESULTS"]).toBe(stock["DEFAULT_MAX_SEARCH_RESULTS"]);
    expect(ours["DEFAULT_SEARCH_TIMEOUT_MS"]).toBe(stock["DEFAULT_SEARCH_TIMEOUT_MS"]);
    expect(ours["name"]).toBe(stock["name"]);
    expect(ours["name"]).toBe("tool-session-query");
    expect(ours["DEFAULT_MAX_SEARCH_RESULTS"]).toBe(100);
    expect(ours["DEFAULT_SEARCH_TIMEOUT_MS"]).toBe(30_000);
    expect(JSON.stringify(ours["inject"])).toBe(JSON.stringify(stock["inject"]));
    expect(ours["inject"]).toEqual(["tools", "systemPrompt", "sessionQuery", "sessionProjections"]);
    expect(typeof ours["apply"]).toBe("function");
    expect(typeof stock["apply"]).toBe("function");
  });
});

describe("Config schema A/B", () => {
  test("validate({}) ⇒ cùng mặc định 100 / 30000", () => {
    const our = validateConfig(ours, {});
    const their = validateConfig(stock, {});
    expect(our.issues).toBeUndefined();
    expect(their.issues).toBeUndefined();
    expect(JSON.stringify(our.value)).toBe(JSON.stringify(their.value));
    expect(our.value).toEqual({ maxSearchResults: 100, searchTimeoutMs: 30000 });
  });

  test("validate giá trị sai ⇒ cùng issues (cùng thông điệp, cùng path)", () => {
    const invalid = [
      { maxSearchResults: 0 },
      { maxSearchResults: -1 },
      { maxSearchResults: 1.5 },
      { maxSearchResults: "100" },
      { searchTimeoutMs: 0 },
      { searchTimeoutMs: 2.5 },
      { searchTimeoutMs: 2_147_483_648 },
    ];
    for (const input of invalid) {
      const our = validateConfig(ours, input);
      const their = validateConfig(stock, input);
      expect(our.value).toBeUndefined();
      expect(their.value).toBeUndefined();
      expect(JSON.stringify(our.issues)).toBe(JSON.stringify(their.issues));
      expect(JSON.stringify(our.issues)).toContain("expected");
    }
  });
});

describe("apply trên Context cordis THẬT với dịch vụ GIẢ", () => {
  test("đủ dịch vụ ⇒ cùng 1 section + 5 tool, cùng thứ tự + cùng khoá order", () => {
    const our = applySnapshot(ours);
    const their = applySnapshot(stock);
    expect(JSON.stringify(our)).toBe(JSON.stringify(their));
    expect(our["error"]).toBeNull();
    expect(our["sections"]).toHaveLength(1);
    expect(our["orders"]).toEqual(["TOOL_SESSION_QUERY"]);
    expect(our["tools"]).toEqual(TOOL_NAMES);
  });

  test("spec 5 tool trùng nhau: name/description/parameters/output/timeoutMs", () => {
    const our = specsOf(ours);
    expect(our).toBe(specsOf(stock));
    const specs = JSON.parse(our) as { name: string; timeoutMs: number | null }[];
    expect(specs.map((spec) => spec.name)).toEqual(TOOL_NAMES);
    expect(specs[0]?.timeoutMs).toBe(30_000);
    expect(specs[1]?.timeoutMs).toBe(30_000);
    expect(specs[2]?.timeoutMs).toBeNull();
  });

  test("config ghi đè ⇒ cùng timeoutMs 1234 trên 2 tool tìm kiếm", () => {
    const options: MountOptions = { config: { maxSearchResults: 3, searchTimeoutMs: 1234 } };
    const our = specsOf(ours, options);
    expect(our).toBe(specsOf(stock, options));
    const specs = JSON.parse(our) as { name: string; timeoutMs: number | null }[];
    expect(specs.filter((spec) => spec.name.endsWith("search")).map((spec) => spec.timeoutMs)).toEqual([1234, 1234]);
  });

  test("cùng ném cùng thông điệp: apply với Config SAI (maxSearchResults=0 / searchTimeoutMs quá trần)", () => {
    const cases = [{ maxSearchResults: 0 }, { searchTimeoutMs: 3_000_000_000 }, { maxSearchResults: 1.5 }];
    const our = cases.map((config) => JSON.stringify(applySnapshot(ours, { config })));
    expect(our).toEqual(cases.map((config) => JSON.stringify(applySnapshot(stock, { config }))));
    for (const snapshot of our) expect(snapshot).toContain("TypeError");
    expect(our[0]).toContain("tool-session-query: maxSearchResults must be a positive safe integer");
    expect(our[1]).toContain("tool-session-query: searchTimeoutMs must be a positive integer no greater than");
  });

  test("cùng ném cùng thông điệp: apply trên Context TRỐNG (thiếu systemPrompt/tools — dịch vụ THẬT không dựng nổi nên chỉ đo lỗi)", () => {
    const empty: MountOptions = { withPrompt: false, withTools: false };
    const our = applySnapshot(ours, empty);
    expect(JSON.stringify(our)).toBe(JSON.stringify(applySnapshot(stock, empty)));
    expect(String(our["error"])).toContain("systemPrompt.section");
    expect(our["sections"]).toHaveLength(0);
    expect(our["tools"]).toHaveLength(0);
  });

  test("cùng ném cùng thông điệp: chỉ có systemPrompt, thiếu tools ⇒ section đã ghi rồi mới ném", () => {
    const partial: MountOptions = { withTools: false };
    const our = applySnapshot(ours, partial);
    expect(JSON.stringify(our)).toBe(JSON.stringify(applySnapshot(stock, partial)));
    expect(String(our["error"])).toContain("tools.register");
    expect(our["sections"]).toHaveLength(1);
    expect(our["tools"]).toHaveLength(0);
  });

  test("ctx.plugin THẬT: inject đủ ⇒ cả hai cùng 5 tool + 1 section + cùng trạng thái fiber", async () => {
    const our = await pluginSnapshot(ours, true);
    const their = await pluginSnapshot(stock, true);
    expect(JSON.stringify(our)).toBe(JSON.stringify(their));
    expect(our["error"]).toBeNull();
    expect(our["tools"]).toEqual(TOOL_NAMES);
    expect(our["sections"]).toBe(1);
    expect(our["orders"]).toBe(1);
    expect(typeof our["state"]).toBe("number");
  });

  test("ctx.plugin trên Context TRỐNG: inject chưa thoả ⇒ cả hai KHÔNG đăng ký gì, cùng trạng thái fiber", async () => {
    const our = await pluginSnapshot(ours, false);
    const their = await pluginSnapshot(stock, false);
    expect(JSON.stringify(our)).toBe(JSON.stringify(their));
    expect(our["tools"]).toEqual([]);
    expect(our["sections"]).toBe(0);
    expect(our["orders"]).toBe(0);
  });
});

describe("A/B nhánh lỗi của 5 tool", () => {
  test("cùng ném cùng thông điệp: thiếu tham số bắt buộc (query/seq)", async () => {
    const scenarios: [string, Record<string, unknown>][] = [
      ["session_search", {}],
      ["session_event_search", {}],
      ["session_event_trace", {}],
      ["session_event_read", {}],
    ];
    const [our, their] = await both((rig) => Promise.all(scenarios.map(([name, args]) => runTool(rig, name, args, makeExec()))));
    expect(our).toBe(their);
    expect(our).toContain("invalid arguments: missing required property");
    expect(our).toContain("property \\\"query\\\"");
    expect(our).toContain("property \\\"seq\\\"");
    expect(our).toContain("ToolArgsError");
  });

  test("cùng ném cùng thông điệp: tham số sai kiểu / sai enum / khoảng thời gian sai", async () => {
    const scenarios: [string, Record<string, unknown>][] = [
      ["session_search", { query: "abc", availability: ["nope"] }],
      ["session_search", { query: "abc", event_surfaces: ["nope"] }],
      ["session_search", { query: 5 }],
      ["session_search", { query: "   " }],
      ["session_search", { query: "abc", session_ids: [] }],
      ["session_search", { query: "abc", created_at_from: "2020-13-01T00:00:00Z" }],
      ["session_search", { query: "abc", created_at_from: "2020-01-01T00:00:00Z", created_at_to: "2019-01-01T00:00:00Z" }],
      ["session_search", { query: "abc", event_seq_from: 9, event_seq_to: 2 }],
      ["session_event_search", { query: "abc", surfaces: ["bad"] }],
      ["session_event_search", { query: "abc", seq_from: 9, seq_to: 2 }],
      ["session_event_trace", { seq: -1 }],
      ["session_event_trace", { seq: "x" }],
      ["session_event_read", { seq: 1, before: -1 }],
      ["session_event_read", { seq: 1, after: "x" }],
      ["session_event_read", { seq: 1.5 }],
    ];
    const [our, their] = await both((rig) => Promise.all(scenarios.map(([name, args]) => runTool(rig, name, args, makeExec()))));
    expect(our).toBe(their);
    expect(our).toContain("must be one of");
    expect(our).toContain("must be an integer");
    expect(our).toContain("must be a string");
    expect(our).toContain("non-negative safe integer");
    expect(our).toContain("must contain at least one value");
    expect(our).toContain("valid ISO 8601 timestamp");
    expect(our).toContain("must be less than or equal to");
    expect(our).toContain("session-search query must contain non-whitespace text");
  });

  test("cùng ném cùng thông điệp: exec KHÔNG có agent ⇒ HarnessError agent-bound caller", async () => {
    const args: Record<string, Record<string, unknown>> = {
      session_search: { query: "abc" },
      session_event_search: { query: "abc" },
      session_trace: {},
      session_event_trace: { seq: 1 },
      session_event_read: { seq: 1 },
    };
    const [our, their] = await both((rig) => Promise.all(TOOL_NAMES.map((name) => runTool(rig, name, args[name] ?? {}, {}))));
    expect(our).toBe(their);
    expect(our).toContain("session query tools require an agent-bound caller");
    expect(our.match(/SESSION_QUERY_TOOL_MISSING_AGENT/g)).toHaveLength(TOOL_NAMES.length);
  });

  test("cùng ném cùng thông điệp: session_search khi caller KHÔNG có workspace (cwd)", async () => {
    const [our, their] = await both((rig) => runTool(rig, "session_search", { query: "abc" }, makeExec({ cwd: null })));
    expect(our).toBe(their);
    expect(our).toContain("cross-session search is unavailable because the caller session has no workspace");
    expect(our).toContain("SESSION_QUERY_TOOL_UNAUTHORIZED");
  });

  test("cùng ném cùng thông điệp: session_event_search khi THIẾU bước hiện tại (dịch vụ sessionProjections GIẢ trả stateOf undefined — không dựng nổi projection thật)", async () => {
    const noBoundary: MountOptions = { projections: { stateOf: () => undefined } };
    const [our, their] = await both((rig) => runTool(rig, "session_event_search", { query: "abc" }, makeExec()), noBoundary);
    expect(our).toBe(their);
    expect(our).toContain("current-session search requires an active step boundary");
    expect(our).toContain("SESSION_QUERY_TOOL_NO_CURRENT_STEP");
  });

  test("cùng ném cùng thông điệp: sessionQuery ném SessionQueryError ĐÃ BIẾT ⇒ cùng mã làm sạch + cùng 1 lượt log (engine thật không dựng nổi nên dùng dịch vụ GIẢ)", async () => {
    /** Dịch vụ GIẢ ném lỗi ĐÃ BIẾT của đúng phía đang đo. Nhận: lớp lỗi của phía đó. Trả: dịch vụ giả. */
    const failingWith = (errorClass: new (message: string, code?: string) => Error): Record<string, unknown> => ({
      searchSessions: async () => {
        throw new errorClass("raw", "SESSION_QUERY_SEARCH_DISABLED");
      },
    });
    /** Kịch bản: một lượt gọi session_search + đếm lượt log. Nhận: rig. Trả: {result, warns}. */
    const scenario = async (rig: MountResult): Promise<Record<string, unknown>> => ({
      result: await runTool(rig, "session_search", { query: "abc" }, makeExec()),
      warns: rig.rec.warns.length,
    });
    const our = await outcomeOn(ours, scenario, { query: failingWith(OurSessionQueryError) });
    const their = await outcomeOn(stock, scenario, { query: failingWith(StockSessionQueryError) });
    expect(our).toBe(their);
    expect(our).toContain("session search is disabled in this deployment");
    expect(our).toContain("SESSION_QUERY_SEARCH_DISABLED");
    expect(our).toContain('"warns":1');
  });

  test("cùng ném cùng thông điệp: lỗi lạ từ sessionQuery ⇒ HarnessError generic SESSION_QUERY_TOOL_FAILED (dịch vụ GIẢ)", async () => {
    const failing = {
      searchSessions: async () => {
        throw new Error("boom");
      },
    };
    const [our, their] = await both((rig) => runTool(rig, "session_search", { query: "abc" }, makeExec()), { query: failing });
    expect(our).toBe(their);
    expect(our).toContain("session query operation failed");
    expect(our).toContain("SESSION_QUERY_TOOL_FAILED");
  });
});

describe("A/B nhánh hợp lệ với dịch vụ GIẢ", () => {
  test("session_search rỗng ⇒ cùng 'No prior session matches found.'", async () => {
    const [our, their] = await both((rig) => runTool(rig, "session_search", { query: "abc" }, makeExec()));
    expect(our).toBe(their);
    expect(our).toContain("No prior session matches found.");
  });

  test("session_search có hit ⇒ cùng văn bản (parent/availability/snippet)", async () => {
    const hit = {
      header: headerOf("s2", { parentSession: "s1" }),
      live: true,
      persisted: true,
      bestMatch: { seq: 3, type: "user/message", surface: "current", time: AT, snippet: "hello world" },
    };
    const query = { searchSessions: async () => ({ items: [hit], nextCursor: undefined }) };
    const [our, their] = await both((rig) => runTool(rig, "session_search", { query: "abc" }, makeExec()), { query });
    expect(our).toBe(their);
    expect(our).toContain("Session search results (1):");
    expect(our).toContain("Parent: s1");
    expect(our).toContain("Availability: live, persisted");
    expect(our).toContain("Snippet: hello world");
  });

  test("session_event_search + session_trace ⇒ cùng văn bản", async () => {
    const [our, their] = await both(async (rig) => [
      await runTool(rig, "session_event_search", { query: "abc" }, makeExec()),
      await runTool(rig, "session_trace", {}, makeExec()),
    ]);
    expect(our).toBe(their);
    expect(our).toContain("No prior event matches found.");
    expect(our).toContain("Ancestors (nearest first):");
    expect(our).toContain("Descendants:");
    expect(our).toContain("Availability: live, persisted");
    expect(our).toContain("Tieu de");
  });

  test("session_event_trace + session_event_read ⇒ cùng văn bản JSON", async () => {
    const [our, their] = await both(async (rig) => [
      await runTool(rig, "session_event_trace", { seq: 1 }, makeExec()),
      await runTool(rig, "session_event_read", { seq: 1 }, makeExec()),
    ]);
    expect(our).toBe(their);
    expect(our).toContain("Target: seq 1 | user/message | current");
    expect(our).toContain("Replaced by: none");
    expect(our).toContain("Target event seq 1:");
  });

  test("vượt maxSearchResults ⇒ cùng dòng 'Result cap reached.'", async () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      header: headerOf("s" + String(index + 2)),
      live: true,
      persisted: false,
      bestMatch: { seq: index, type: "user/message", surface: "current", time: AT, snippet: "s" + String(index) },
    }));
    const query = { searchSessions: async () => ({ items, nextCursor: undefined }) };
    const [our, their] = await both((rig) => runTool(rig, "session_search", { query: "abc" }, makeExec()), { query, config: { maxSearchResults: 2 } });
    expect(our).toBe(their);
    expect(our).toContain("Session search results (2):");
    expect(our).toContain("Result cap reached.");
  });

  test("presentCall 5 tool ⇒ cùng card/kind/title/rawInput; tham số sai ⇒ cả hai cùng undefined", async () => {
    const valid: Record<string, Record<string, unknown>> = {
      session_search: { query: "abc" },
      session_event_search: { query: "abc" },
      session_trace: {},
      session_event_trace: { seq: 4 },
      session_event_read: { seq: 4 },
    };
    const invalid: Record<string, Record<string, unknown>> = {
      session_search: {},
      session_event_search: {},
      session_event_trace: { seq: "x" },
      session_event_read: {},
    };
    const scenario = (rig: MountResult): Record<string, unknown> => ({
      valid: TOOL_NAMES.map((name) => toolOf(rig, name).presentCall(valid[name] ?? {})),
      invalid: TOOL_NAMES.map((name) => toolOf(rig, name).presentCall(invalid[name] ?? valid[name] ?? {})),
    });
    const [our, their] = await both(scenario);
    expect(our).toBe(their);
    expect(our).toContain("Search prior sessions");
    expect(our).toContain("Search session events");
    expect(our).toContain("Trace current session");
    expect(our).toContain("Trace event 4");
    expect(our).toContain("Read event 4");
  });
});

describe("metadata §4f: row LỒNG trong NHÓM ⇒ gbh.nested kind 'group', KHÔNG gbh.row", () => {
  test("package.json: nested đúng dump 1494–1495 · KHÔNG gbh.row/row_unmounted_ly_do · peers ⊆ peerDependencies", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      name?: string;
      gbh?: { row?: unknown; row_unmounted_ly_do?: unknown; nested?: unknown; tests?: string[]; peers?: string[] };
      peerDependencies?: Record<string, string>;
    };
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-tool-session-query");
    expect(manifest.gbh?.row).toBeUndefined();
    expect(manifest.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect(manifest.gbh?.nested).toEqual({
      kind: "group",
      pluginId: "optional-tool-session-query",
      stockId: "@deepseek-ai/dsh-tool-session-query",
      presets: ["optional-session-search"],
    });
    expect(manifest.gbh?.tests).toEqual(["tests/host/tool-session-query.test.ts"]);
    expect(manifest.gbh?.peers?.every((name) => name in (manifest.peerDependencies ?? {}))).toBe(true);
  });

  test("gói stock MỘT MẶT: KHÔNG dsh.client · KHÔNG lib/client.js (điều kiện §4f trước khi khai row)", () => {
    const stockPkg = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-session-query");
    const stockManifest = JSON.parse(readFileSync(join(stockPkg, "package.json"), "utf8")) as { dsh?: { client?: unknown } };
    expect(stockManifest.dsh?.client).toBeUndefined();
    expect(existsSync(join(stockPkg, "lib", "client.js"))).toBe(false);
  });
});
