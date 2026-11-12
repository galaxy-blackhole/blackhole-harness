/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test đối chứng (A/B) cho @galaxy-blackhole/gbh-tool-schedule: artefact BYTE-IDENTICAL bundle gốc +
 *      bề mặt plugin (name/inject/apply) + apply trên Context cordis THẬT với dịch vụ tools/schedule GIẢ
 *      (đúng 4 tool schedule_create/list/delete/update) + nhánh lỗi + hành vi 4 handler với schedule GIẢ
 */

import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
// 05/11/2026 (P1b): artefact của ta mang id GBH ⇒ so với bản gốc phải qua phép chuẩn hoá dùng chung (runbook bước 2).
import { chuanHoaHost } from "../lib/artefact-normalize.ts";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "tool-schedule");
/** Artefact của ta (bản byte-identical của bundle gốc). */
const OURS_FILE = join(PKG, "lib", "index.js");
/** Thư mục @deepseek-ai của KERNEL — nguồn DUY NHẤT cấp dsh-schedule cho artefact của ta.
 * Vì sao (01/11/2026): gói workspace phân giải peer qua root node_modules/.bun còn kernel nằm ở
 * apps/host/node_modules; hai bản sao vật lý ⇒ `error instanceof ScheduleInputError` TRƯỢT, nên lỗi
 * nhập liệu của dịch vụ THẬT bị hạ thành internal_error. Artefact BYTE-IDENTICAL gốc được nạp từ một
 * thư mục tạm TRONG gói có symlink node_modules/@deepseek-ai → kernel (pattern tests/host/shell.test.ts). */
const KERNEL_AI = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** Thư mục tạm nạp artefact với peer của kernel (dọn ở afterAll). */
const RUN_DIR = mkdtempSync(join(PKG, ".ab-run-"));
mkdirSync(join(RUN_DIR, "node_modules"), { recursive: true });
symlinkSync(KERNEL_AI, join(RUN_DIR, "node_modules", "@deepseek-ai"), "dir");
// P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
// neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(RUN_DIR, "node_modules", "@galaxy-blackhole"), "dir");
copyFileSync(OURS_FILE, join(RUN_DIR, "index.js"));
afterAll(() => {
  rmSync(RUN_DIR, { recursive: true, force: true });
});
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-schedule", "lib", "index.js");
/** Cordis THẬT của runtime app. */
const CORDIS_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Module schedule THẬT — chỉ dùng để dựng ScheduleInputError ĐÚNG lớp cho dịch vụ giả. */
// 05/11/2026 (P1b): artefact của ta nay import `@galaxy-blackhole/gbh-schedule` ⇒ dịch vụ giả phải ném lớp lỗi
// từ CHÍNH module đó (nếu lấy từ dsh-schedule thì `instanceof` TRƯỢT vì khác instance).
const SCHEDULE_FILE = join(REPO, "packages", "host", "schedule", "lib", "index.js");
/** Nội dung bundle gốc. */
const STOCK_TEXT = readFileSync(STOCK_FILE, "utf8");
/** Bốn tool plugin đăng ký, ĐÚNG thứ tự apply. */
const TOOL_NAMES = ["schedule_create", "schedule_list", "schedule_delete", "schedule_update"];
/** Ba tên export của gói (gói MỘT MẶT, không có default export). */
const EXPORT_NAMES = ["apply", "inject", "name"];
/** Mã phiên GIẢ của caller. */
const SESSION_ID = "s1";
/** Bản ghi schedule GIẢ ở TƯƠNG LAI ⇒ state luôn 'scheduled' dù Date.now() lệch giữa hai bên. */
const FUTURE_RECORD = { id: "sc1", title: "T", prompt: "P", scheduledAt: "2030-01-01T00:00:00.000Z", kind: "at" };
/** Bản ghi schedule GIẢ ở QUÁ KHỨ ⇒ state luôn 'overdue'. */
const PAST_RECORD = { id: "sc2", title: "T2", prompt: "P2", scheduledAt: "2000-01-01T00:00:00.000Z", kind: "at" };

/** Bề mặt module plugin (của ta hoặc bản gốc). */
interface PluginApi {
  /** Tên plugin đăng ký với Loader. */
  readonly name: string;
  /** Dịch vụ plugin yêu cầu trước khi chạy. */
  readonly inject: readonly string[];
  /** Thân plugin: chờ dịch vụ schedule rồi đăng ký 4 tool qua ctx.tools. */
  apply(ctx: Ctx): void;
}

/** Bề mặt Context cordis tối thiểu mà test chạm tới. */
interface Ctx {
  /** Cấp một dịch vụ GIẢ; trả hàm rút dịch vụ (async). */
  provide(name: string, value: unknown): () => Promise<void>;
  /** Đăng ký plugin theo vòng đời cordis THẬT. */
  plugin(plugin: unknown, config?: unknown): FiberLike;
  /** Logger của Context (test thay error/warn để đếm lời gọi). */
  logger: { error(...args: unknown[]): void; warn(...args: unknown[]): void };
}

/** Fiber cordis (chỉ đọc trạng thái + dispose). */
interface FiberLike {
  /** Trạng thái fiber: 2 = đã chạy xong thân plugin. */
  state?: number;
  /** Dispose fiber: Context của nó thành INACTIVE. */
  dispose(): Promise<unknown>;
}

/** Tool đã defineTool (bề mặt test chạm tới). */
interface ToolLike {
  /** Tên tool. */
  name: string;
  /** Mô tả model-facing. */
  description: string;
  /** JSON Schema tham số. */
  parameters: Record<string, unknown>;
  /** Vỏ output: schema + render. */
  output: { schema: Record<string, unknown>; render(args: unknown, value: unknown): unknown };
  /** Thân tool: validate tham số rồi chạy handler. */
  execute(args: unknown, exec: unknown): Promise<unknown>;
  /** Card trình bày lời gọi (trả undefined khi tham số sai). */
  presentCall(args: unknown): unknown;
}

/** Một lời gọi dịch vụ schedule GIẢ đã ghi vết. */
interface ScheduleCall {
  /** Phương thức được gọi. */
  readonly method: string;
  /** Tham số nguyên văn. */
  readonly args: readonly unknown[];
}

/** Ghi đè hành vi dịch vụ schedule GIẢ (dựng nhánh lỗi/khác rỗng). */
interface ScheduleOverrides {
  /** Ghi đè create. */
  create?(...args: unknown[]): Promise<unknown>;
  /** Ghi đè list. */
  list?(...args: unknown[]): Promise<unknown>;
  /** Ghi đè delete. */
  delete?(...args: unknown[]): Promise<unknown>;
  /** Ghi đè update. */
  update?(...args: unknown[]): Promise<unknown>;
  /** Ghi đè catalog (chỉ schedule_update gọi). */
  catalog?(...args: unknown[]): Promise<unknown>;
}

/** Dịch vụ schedule GIẢ + vết lời gọi + khoá đã chạm. */
interface FakeSchedule {
  /** Giá trị cấp cho ctx.provide('schedule', …). */
  readonly service: unknown;
  /** Vết lời gọi theo thứ tự. */
  readonly calls: ScheduleCall[];
  /** Các khoá chuỗi đã đọc trên dịch vụ. */
  readonly keys: string[];
}

/** Tuỳ chọn dựng rig. */
interface MountOptions {
  /** Có cấp dịch vụ tools không (mặc định true). */
  withTools?: boolean;
  /** Có cấp dịch vụ schedule không (mặc định true). */
  withSchedule?: boolean;
  /** Ghi đè hành vi schedule giả. */
  schedule?: ScheduleOverrides;
}

/** Một rig đã mount xong một bên. */
interface Rig {
  /** Context cordis THẬT vừa dựng. */
  readonly ctx: Ctx;
  /** Tool đã đăng ký, theo thứ tự. */
  readonly registered: ToolLike[];
  /** Tool tra theo tên. */
  readonly tools: Map<string, ToolLike>;
  /** Log lỗi mà cordis đẩy qua ctx.logger.error. */
  readonly errors: string[];
  /** Khoá chuỗi đã đọc trên dịch vụ tools. */
  readonly toolsKeys: string[];
  /** Dịch vụ schedule giả + vết. */
  readonly schedule: FakeSchedule;
  /** Rút dịch vụ schedule khỏi Context. */
  readonly dropSchedule: () => Promise<void>;
  /** Lỗi apply ném ra (null khi apply không ném). */
  readonly applyError: string | null;
}

/** Kết quả một phép so A/B: chuỗi của ta, chuỗi gốc, và hai rig để khẳng định thêm. */
interface Pair {
  /** Kết quả kịch bản trên artefact của ta. */
  readonly our: string;
  /** Kết quả kịch bản trên bundle gốc. */
  readonly their: string;
  /** Rig của ta. */
  readonly rig: Rig;
  /** Rig của bản gốc. */
  readonly stockRig: Rig;
}

/** Lớp Context cordis THẬT của runtime app. */
const ContextCtor = ((await import(CORDIS_FILE)) as { Context: new () => unknown }).Context;
/** Nạp artefact của ta TỪ thư mục tạm có peer kernel (xem RUN_DIR). */
const ours = (await import(join(RUN_DIR, "index.js"))) as PluginApi;
/** Nạp bundle gốc. */
const stock = (await import(STOCK_FILE)) as PluginApi;
/** Lớp lỗi schedule THẬT (dịch vụ giả ném ĐÚNG lớp để đo nhánh chuyển mã). */
const { ScheduleInputError } = (await import(SCHEDULE_FILE)) as { ScheduleInputError: new (code: string, message: string) => Error };
// 05/11/2026 (P1b): bản GỐC vẫn ném lớp lỗi của `dsh-schedule` — hai bên giờ là HAI instance khác nhau,
// nên fixture A/B phải chọn lớp theo rig (xem `oursRigs`).
const STOCK_SCHEDULE_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-schedule", "lib", "index.js");
const { ScheduleInputError: StockScheduleInputError } = (await import(STOCK_SCHEDULE_FILE)) as {
  ScheduleInputError: new (code: string, message: string) => Error;
};

/**
 * Băm SHA-256 một chuỗi UTF-8.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Chờ cordis chạy xong fiber con (apply dùng ctx.inject nên đăng ký tool là BẤT ĐỒNG BỘ).
 * Nhận: không.
 * Trả: Promise hoàn tất sau một macrotask, đủ để mọi fiber đã thoả inject chạy.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 40));
}

/**
 * Gói một giá trị lỗi thành chuỗi so sánh được.
 * Nhận: value — giá trị bất kỳ mà logger nhận.
 * Trả: "Name|message" cho Error, hoặc String(value).
 */
function textOfError(value: unknown): string {
  return value instanceof Error ? value.name + "|" + value.message : String(value);
}

/**
 * Gói một tham số lời gọi dịch vụ thành chuỗi so sánh được.
 * Nhận: value — tham số nguyên văn.
 * Trả: "signal" cho AbortSignal, JSON cho phần còn lại.
 */
function textOfArgument(value: unknown): string {
  if (value instanceof AbortSignal) return "signal";
  return JSON.stringify(value) ?? String(value);
}

/**
 * Dịch vụ tools GIẢ: ghi lại từng tool register + mọi khoá bị đọc.
 * Nhận: registered — mảng nhận tool; keys — mảng nhận khoá chuỗi.
 * Trả: giá trị cấp cho ctx.provide('tools', …), có Proxy ghi vết.
 */
function makeTools(registered: ToolLike[], keys: string[]): unknown {
  const service = {
    register(tool: ToolLike): () => void {
      registered.push(tool);
      return () => {};
    },
  };
  return new Proxy(service, {
    get(target, prop, receiver) {
      if (typeof prop === "string") keys.push(prop);
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Dịch vụ schedule GIẢ: 5 phương thức bundle gốc gọi, trả dữ liệu CỐ ĐỊNH hoặc ghi đè.
 * Nhận: overrides — ghi đè từng phương thức (dựng nhánh lỗi).
 * Trả: FakeSchedule gồm service (có Proxy ghi khoá), vết lời gọi, và khoá đã chạm.
 */
function makeSchedule(overrides: ScheduleOverrides = {}): FakeSchedule {
  const calls: ScheduleCall[] = [];
  const keys: string[] = [];
  const push = (method: string, args: unknown[]): void => {
    calls.push({ method, args });
  };
  const service = {
    async create(...args: unknown[]): Promise<unknown> {
      push("create", args);
      return overrides.create === undefined ? FUTURE_RECORD : overrides.create(...args);
    },
    async list(...args: unknown[]): Promise<unknown> {
      push("list", args);
      return overrides.list === undefined ? [FUTURE_RECORD] : overrides.list(...args);
    },
    async delete(...args: unknown[]): Promise<unknown> {
      push("delete", args);
      if (overrides.delete !== undefined) return overrides.delete(...args);
      const query = args[0] as { id?: string } | undefined;
      return { id: query?.id, deleted: true };
    },
    async update(...args: unknown[]): Promise<unknown> {
      push("update", args);
      return overrides.update === undefined ? { record: { ...FUTURE_RECORD, title: "moi" } } : overrides.update(...args);
    },
    async catalog(...args: unknown[]): Promise<unknown> {
      push("catalog", args);
      return overrides.catalog === undefined ? [] : overrides.catalog(...args);
    },
  };
  const traced = new Proxy(service, {
    get(target, prop, receiver) {
      if (typeof prop === "string") keys.push(prop);
      return Reflect.get(target, prop, receiver);
    },
  });
  return { service: traced, calls, keys };
}

/**
 * Dựng Context cordis THẬT + dịch vụ GIẢ rồi gọi apply của MỘT bên.
 * Nhận: api — bề mặt module plugin; options — bật/tắt dịch vụ + ghi đè schedule giả.
 * Trả: Rig (Context, tool đã đăng ký, log lỗi, vết dịch vụ, lỗi apply).
 */
async function mount(api: PluginApi, options: MountOptions = {}): Promise<Rig> {
  const ctx = new ContextCtor() as Ctx;
  const registered: ToolLike[] = [];
  const errors: string[] = [];
  const toolsKeys: string[] = [];
  const schedule = makeSchedule(options.schedule ?? {});
  ctx.logger.error = (...args: unknown[]) => {
    errors.push(args.map(textOfError).join(" "));
  };
  ctx.logger.warn = () => {};
  if (options.withTools !== false) ctx.provide("tools", makeTools(registered, toolsKeys));
  const dropSchedule = options.withSchedule === false ? async (): Promise<void> => {} : ctx.provide("schedule", schedule.service);
  let applyError: string | null = null;
  try {
    api.apply(ctx);
  } catch (caught) {
    applyError = textOfError(caught);
  }
  await settle();
  const tools = new Map<string, ToolLike>();
  for (const tool of registered) tools.set(tool.name, tool);
  return { ctx, registered, tools, errors, toolsKeys, schedule, dropSchedule, applyError };
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
 * Chạy CÙNG kịch bản trên artefact của ta và bundle gốc, mỗi bên một rig MỚI.
 * Nhận: scenario — kịch bản nhận rig; options — tuỳ chọn dựng rig.
 * Trả: Pair gồm hai chuỗi kết quả + hai rig.
 */
async function pair(scenario: (rig: Rig) => unknown, options: MountOptions = {}): Promise<Pair> {
  const rig = await mount(ours, options);
  const stockRig = await mount(stock, options);
  const our = await outcome(() => scenario(rig));
  const their = await outcome(() => scenario(stockRig));
  return { our, their, rig, stockRig };
}

/**
 * Giải mã kết quả "ok:<JSON>" thành giá trị.
 * Nhận: encoded — chuỗi outcome.
 * Trả: giá trị JSON đã giải mã; ném nếu chuỗi là nhánh lỗi.
 */
function decoded(encoded: string): unknown {
  if (!encoded.startsWith("ok:")) throw new Error("khong phai ket qua ok: " + encoded);
  return JSON.parse(encoded.slice(3));
}

/**
 * Lấy một tool theo tên từ rig, báo lỗi rõ khi thiếu.
 * Nhận: rig — kết quả mount; name — tên tool.
 * Trả: ToolLike.
 */
function toolOf(rig: Rig, name: string): ToolLike {
  const tool = rig.tools.get(name);
  if (tool === undefined) throw new Error("khong co tool " + name);
  return tool;
}

/**
 * Dựng agent GIẢ đúng các trường delegationDepthOf đọc (session.header + options).
 * Nhận: extra — delegationDepth (header) và/hoặc subagentDepth (options).
 * Trả: object agent tối thiểu.
 */
function agent(extra: { delegationDepth?: number; subagentDepth?: number } = {}): unknown {
  return {
    session: { id: SESSION_ID, header: extra.delegationDepth === undefined ? {} : { delegationDepth: extra.delegationDepth } },
    options: extra.subagentDepth === undefined ? {} : { subagentDepth: extra.subagentDepth },
  };
}

/**
 * Dựng exec GIẢ (agent + signal) cho thân tool.
 * Nhận: agentValue — agent của caller; signal — tín hiệu huỷ (mặc định: chưa huỷ).
 * Trả: object exec tối thiểu.
 */
function exec(agentValue: unknown, signal: AbortSignal = new AbortController().signal): unknown {
  return { agent: agentValue, signal };
}

/**
 * Tín hiệu ĐÃ HUỶ (đo nhánh exec.signal.aborted).
 * Nhận: không.
 * Trả: AbortSignal đã abort.
 */
function abortedSignal(): AbortSignal {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
}

/**
 * Dựng một scope cordis ĐÃ DISPOSE để đo apply trên Context chết.
 * Nhận: không.
 * Trả: Context con mà fiber chủ đã dispose.
 */
async function disposedScope(): Promise<Ctx> {
  const ctx = new ContextCtor() as Ctx;
  ctx.logger.error = () => {};
  ctx.logger.warn = () => {};
  ctx.provide("tools", { register: () => () => {} });
  ctx.provide("schedule", makeSchedule().service);
  let inner: Ctx | undefined;
  const host = ctx.plugin({
    name: "pham-vi-tam",
    apply(scope: Ctx): void {
      inner = scope;
    },
  });
  await host;
  await host.dispose();
  if (inner === undefined) throw new Error("khong lay duoc scope con");
  return inner;
}

/**
 * Mount plugin qua vòng đời ctx.plugin THẬT (không gọi apply trực tiếp).
 * Nhận: api — bề mặt module plugin.
 * Trả: object { state, names } JSON-so-sánh-được.
 */
async function pluginMount(api: PluginApi): Promise<{ state: number | null; names: string[] }> {
  const ctx = new ContextCtor() as Ctx;
  const registered: ToolLike[] = [];
  ctx.logger.error = () => {};
  ctx.logger.warn = () => {};
  ctx.provide("tools", makeTools(registered, []));
  ctx.provide("schedule", makeSchedule().service);
  const fiber = ctx.plugin({ name: api.name, inject: api.inject, apply: api.apply });
  await fiber;
  await settle();
  return { state: fiber.state ?? null, names: registered.map((tool) => tool.name) };
}

describe("A · artefact byte-identical bundle gốc", () => {
  test("lib/index.js: cùng độ dài BYTE + cùng số dòng (661 dòng · 19 293 byte) với bundle gốc", () => {
    const oursText = readFileSync(OURS_FILE, "utf8");
    // 05/11/2026 (P1b): so SAU chuẩn hoá id GBH → id stock (độ dài artefact thật đổi vì id dài hơn).
    const chuanHoa = chuanHoaHost(oursText);
    expect(chuanHoa.length).toBe(STOCK_TEXT.length);
    expect(Buffer.byteLength(chuanHoa, "utf8")).toBe(Buffer.byteLength(STOCK_TEXT, "utf8"));
    expect((chuanHoa.match(/\n/g) ?? []).length).toBe(661);
    expect(chuanHoa.split("\n").length).toBe(STOCK_TEXT.split("\n").length);
  });

  test("lib/index.js: trùng TOÀN VĂN từng byte + cùng sha256 64 ký tự", () => {
    const oursText = readFileSync(OURS_FILE, "utf8");
    // 05/11/2026 (P1b): trùng TOÀN VĂN sau chuẩn hoá id GBH → id stock (runbook bước 2, phép 3+4).
    expect(chuanHoaHost(oursText)).toBe(STOCK_TEXT);
    expect(sha256(chuanHoaHost(oursText))).toBe(sha256(STOCK_TEXT));
    expect(sha256(chuanHoaHost(oursText))).toHaveLength(64);
  });
});

describe("B · bề mặt plugin A/B", () => {
  test("name = 'tool-schedule' · typeof apply = 'function' · đúng 3 export ở CẢ HAI bên", () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual([...EXPORT_NAMES].sort());
    expect(ours.name).toBe(stock.name);
    expect(ours.name).toBe("tool-schedule");
    expect(typeof ours.apply).toBe("function");
    expect(typeof stock.apply).toBe("function");
  });

  test("inject = ['tools'] ở CẢ HAI bên (schedule KHÔNG khai trong inject)", () => {
    expect(Array.isArray(ours.inject)).toBe(true);
    expect([...ours.inject]).toEqual([...stock.inject]);
    expect([...ours.inject]).toEqual(["tools"]);
    expect([...ours.inject]).not.toContain("schedule");
    expect([...stock.inject]).not.toContain("schedule");
  });
});

describe("C · apply trên Context cordis THẬT + dịch vụ tools GIẢ", () => {
  test("apply: ĐÚNG 4 tool, ĐÚNG tên + thứ tự (create · list · delete · update), hai bên khớp", async () => {
    const p = await pair((rig) => rig.registered.map((tool) => tool.name));
    expect(p.our).toBe(p.their);
    expect(decoded(p.our)).toEqual(TOOL_NAMES);
    expect(p.rig.registered).toHaveLength(4);
    expect(p.rig.applyError).toBeNull();
    expect(p.stockRig.applyError).toBeNull();
  });

  test("apply: spec từng tool (description + parameters JSON schema) trùng khít", async () => {
    const p = await pair((rig) =>
      rig.registered.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })),
    );
    expect(p.our).toBe(p.their);
    const specs = decoded(p.our) as { name: string; description: string; parameters: { type: string; properties: Record<string, unknown>; required?: string[] } }[];
    expect(specs.map((spec) => spec.name)).toEqual(TOOL_NAMES);
    for (const spec of specs) expect(spec.parameters.type).toBe("object");
    expect(Object.keys(specs[0]?.parameters.properties ?? {})).toEqual([
      "prompt",
      "title",
      "after_seconds",
      "every_seconds",
      "daily",
      "weekly",
      "cron",
      "at",
    ]);
    expect(specs[0]?.parameters.required).toEqual(["prompt", "title"]);
    expect(Object.keys(specs[1]?.parameters.properties ?? {})).toEqual([]);
    expect(specs[1]?.parameters.required).toBeUndefined();
    expect(Object.keys(specs[2]?.parameters.properties ?? {})).toEqual(["id"]);
    expect(specs[2]?.parameters.required).toEqual(["id"]);
    expect(Object.keys(specs[3]?.parameters.properties ?? {})).toEqual([
      "id",
      "title",
      "prompt",
      "every_seconds",
      "daily",
      "weekly",
      "cron",
      "at",
    ]);
    expect(specs[3]?.parameters.required).toEqual(["id"]);
  });

  test("apply: output schema từng tool trùng khít (oneOf 10/10/11/11) + đúng khoá output {schema, render}", async () => {
    const p = await pair((rig) =>
      rig.registered.map((tool) => ({
        schema: tool.output.schema,
        outputKeys: Object.keys(tool.output),
        toolKeys: Object.keys(tool),
      })),
    );
    expect(p.our).toBe(p.their);
    const specs = decoded(p.our) as { schema: { oneOf?: unknown[] }; outputKeys: string[]; toolKeys: string[] }[];
    expect(specs.map((spec) => spec.schema.oneOf?.length)).toEqual([10, 10, 11, 11]);
    for (const spec of specs) {
      expect(spec.outputKeys).toEqual(["schema", "render"]);
      expect(spec.toolKeys).toEqual(["name", "description", "parameters", "output", "execute", "presentCall"]);
    }
  });

  test("apply: chỉ chạm ĐÚNG một khoá 'register' trên ctx.tools (không define/tool) — namespace trùng", async () => {
    const p = await pair((rig) => ({ keys: [...new Set(rig.toolsKeys)], registered: rig.registered.length }));
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { keys: string[]; registered: number };
    expect(seen.keys).toEqual(["register"]);
    expect(seen.registered).toBe(4);
    expect(p.rig.toolsKeys).toContain("register");
    expect(p.rig.toolsKeys).not.toContain("define");
    expect(p.rig.toolsKeys).not.toContain("tool");
  });

  test("apply: presentCall + render 4 tool trùng nhau (card/kind/title/rawInput)", async () => {
    const p = await pair((rig) => ({
      create: toolOf(rig, "schedule_create").presentCall({ prompt: "P", title: "T", after_seconds: 60 }) ?? null,
      list: toolOf(rig, "schedule_list").presentCall({}) ?? null,
      remove: toolOf(rig, "schedule_delete").presentCall({ id: "sc1" }) ?? null,
      update: toolOf(rig, "schedule_update").presentCall({ id: "sc1", title: "M" }) ?? null,
      invalid: toolOf(rig, "schedule_create").presentCall({}) ?? null,
      render: toolOf(rig, "schedule_list").output.render({}, FUTURE_RECORD),
    }));
    expect(p.our).toBe(p.their);
    expect(p.our).toContain('"title":"Create reminder"');
    expect(p.our).toContain('"title":"List reminders"');
    expect(p.our).toContain('"title":"Delete reminder"');
    expect(p.our).toContain('"title":"Update reminder"');
    expect(p.our).toContain('"kind":"read"');
    expect(p.our).toContain('"invalid":null');
    expect(p.our).toContain('"text":"{\\"id\\":\\"sc1\\"');
  });

  test("apply qua ctx.plugin THẬT: cùng 4 tool + cùng trạng thái fiber", async () => {
    const our = await pluginMount(ours);
    const their = await pluginMount(stock);
    expect(JSON.stringify(our)).toBe(JSON.stringify(their));
    expect(our.names).toEqual(TOOL_NAMES);
    expect(typeof our.state).toBe("number");
  });

  test("apply: đăng ký tool BẤT ĐỒNG BỘ (0 tool ngay sau apply, 4 tool sau macrotask) ở CẢ HAI bên", async () => {
    const syncCount = (api: PluginApi): number => {
      const ctx = new ContextCtor() as Ctx;
      const registered: unknown[] = [];
      ctx.logger.error = () => {};
      ctx.logger.warn = () => {};
      ctx.provide("tools", makeTools(registered as ToolLike[], []));
      ctx.provide("schedule", makeSchedule().service);
      api.apply(ctx);
      return registered.length;
    };
    expect(syncCount(ours)).toBe(0);
    expect(syncCount(stock)).toBe(0);
    const p = await pair((rig) => rig.registered.length);
    expect(p.our).toBe(p.their);
    expect(decoded(p.our)).toBe(4);
  });
});

describe("D · nhánh lỗi A/B", () => {
  test("Context TRỐNG (không tools/schedule): apply KHÔNG ném, 0 tool, KHÔNG log — hai bên y hệt", async () => {
    const p = await pair((rig) => ({ registered: rig.registered.length, errors: rig.errors }), {
      withTools: false,
      withSchedule: false,
    });
    expect(p.our).toBe(p.their);
    expect(p.rig.applyError).toBeNull();
    expect(p.stockRig.applyError).toBeNull();
    expect(p.rig.registered).toHaveLength(0);
    expect(p.rig.errors).toEqual([]);
  });

  test("thiếu ctx.tools (chỉ có schedule): cả hai cùng log 'cannot get property \"tools\" without inject' + 0 tool (tools THẬT không dựng nổi nên chỉ đo log)", async () => {
    const p = await pair((rig) => ({ registered: rig.registered.length, errors: rig.errors }), { withTools: false });
    expect(p.our).toBe(p.their);
    expect(p.rig.applyError).toBeNull();
    expect(p.rig.registered).toHaveLength(0);
    expect(p.rig.errors).toEqual(['Error|cannot get property "tools" without inject']);
    expect(p.stockRig.errors).toEqual(p.rig.errors);
  });

  test("apply trên Context ĐÃ DISPOSE: cả hai cùng ném 'cannot create effect on inactive context'", async () => {
    const ourScope = await disposedScope();
    const theirScope = await disposedScope();
    const ourDisposed = await outcome(() => ours.apply(ourScope));
    const theirDisposed = await outcome(() => stock.apply(theirScope));
    expect(ourDisposed).toBe(theirDisposed);
    expect(ourDisposed.startsWith("nem|")).toBe(true);
    expect(ourDisposed).toContain("cannot create effect on inactive context");
  });

  test("schedule THIẾU lúc mount: 0 tool ở CẢ HAI (nhánh 'gọi tool khi thiếu service' KHÔNG tồn tại — handler bất khả đích)", async () => {
    const p = await pair((rig) => ({ registered: rig.registered.length, errors: rig.errors }), { withSchedule: false });
    expect(p.our).toBe(p.their);
    expect(p.rig.applyError).toBeNull();
    expect(p.rig.registered).toHaveLength(0);
    expect(p.rig.errors).toEqual([]);
    expect(p.rig.tools.size).toBe(0);
  });

  test("schedule bị RÚT sau mount: cả hai cùng trả internal_error khi gọi schedule_create (schedule engine THẬT không dựng nổi — dịch vụ GIẢ)", async () => {
    const p = await pair(async (rig) => {
      await rig.dropSchedule();
      return toolOf(rig, "schedule_create").execute({ prompt: "P", title: "T", after_seconds: 60 }, exec(agent()));
    });
    expect(p.our).toBe(p.their);
    expect(p.our).toContain('"code":"internal_error"');
    expect(p.our).toContain("The schedule operation failed.");
  });

  test("tham số sai kiểu: cả hai cùng ném ToolArgsError 'invalid arguments: \"prompt\" must be a string'", async () => {
    const p = await pair((rig) => toolOf(rig, "schedule_create").execute({ prompt: 5, title: "T", after_seconds: 60 }, exec(agent())));
    expect(p.our).toBe(p.their);
    expect(p.our).toContain("nem|ToolArgsError|INVALID_ARGS|");
    expect(p.our).toContain('invalid arguments: "prompt" must be a string');
    expect(p.rig.schedule.calls).toHaveLength(0);
  });

  test("agent có subagentDepth sai kiểu: cả hai cùng ném TypeError (Agent/subagent THẬT không dựng nổi — fixture)", async () => {
    const p = await pair((rig) => toolOf(rig, "schedule_list").execute({}, exec(agent({ subagentDepth: -1 }))));
    expect(p.our).toBe(p.their);
    expect(p.our).toBe("nem|TypeError|-|agent subagentDepth must be a non-negative safe integer");
    expect(p.rig.schedule.calls).toHaveLength(0);
  });
});

describe("E · hành vi 4 handler với dịch vụ schedule GIẢ", () => {
  test("schedule_create: view JSON y hệt + uỷ quyền ĐÚNG sessionId · nguyên args · signal", async () => {
    const args = { prompt: "P", title: "T", after_seconds: 60 };
    const signal = new AbortController().signal;
    const p = await pair(async (rig) => {
      const result = await toolOf(rig, "schedule_create").execute(args, exec(agent(), signal));
      return { result, calls: rig.schedule.calls.map((call) => ({ method: call.method, args: call.args.map(textOfArgument) })) };
    });
    expect(p.our).toBe(p.their);
    expect(p.our).toContain('"state":"scheduled"');
    expect(p.our).toContain('"deliveryMode":"host"');
    const first = p.rig.schedule.calls[0];
    expect(p.rig.schedule.calls).toHaveLength(1);
    expect(first?.method).toBe("create");
    expect(first?.args[0]).toBe(SESSION_ID);
    expect(first?.args[1]).toBe(args);
    expect(first?.args[2]).toBe(signal);
  });

  test("schedule_list: state 'scheduled' (mốc 2030) và 'overdue' (mốc 2000) — hai bên y hệt", async () => {
    const p = await pair((rig) => toolOf(rig, "schedule_list").execute({}, exec(agent())), {
      schedule: { list: async () => [FUTURE_RECORD, PAST_RECORD] },
    });
    expect(p.our).toBe(p.their);
    const views = decoded(p.our) as { id: string; state: string }[];
    expect(views.map((view) => view.id)).toEqual(["sc1", "sc2"]);
    expect(views.map((view) => view.state)).toEqual(["scheduled", "overdue"]);
    expect(p.rig.schedule.calls[0]?.args[0]).toEqual({ sessionId: SESSION_ID });
  });

  test("schedule_delete: {id, deleted:true} y hệt; id rỗng/khoảng trắng ⇒ invalid_rule TRƯỚC khi chạm dịch vụ", async () => {
    const p = await pair(async (rig) => ({
      ok: await toolOf(rig, "schedule_delete").execute({ id: "sc1" }, exec(agent())),
      spaced: await toolOf(rig, "schedule_delete").execute({ id: " sc1" }, exec(agent())),
      empty: await toolOf(rig, "schedule_delete").execute({ id: "" }, exec(agent())),
    }));
    expect(p.our).toBe(p.their);
    expect(p.our).toContain('"deleted":true');
    expect(p.our).toContain("schedule_delete id must be non-empty without surrounding whitespace.");
    expect(p.rig.schedule.calls).toHaveLength(1);
    expect(p.rig.schedule.calls[0]?.method).toBe("delete");
    expect(p.rig.schedule.calls[0]?.args[0]).toEqual({ sessionId: SESSION_ID, id: "sc1" });
  });

  test("schedule_update: tìm thấy ⇒ view mới; KHÔNG thấy ⇒ catalog quyết định schedule_not_found / schedule_ended", async () => {
    const found = await pair((rig) => toolOf(rig, "schedule_update").execute({ id: "sc1", title: "M" }, exec(agent())));
    expect(found.our).toBe(found.their);
    expect(found.our).toContain('"title":"moi"');
    expect(found.rig.schedule.calls.map((call) => call.method)).toEqual(["list", "update"]);
    const missing = await pair((rig) => toolOf(rig, "schedule_update").execute({ id: "sc1", title: "M" }, exec(agent())), {
      schedule: { list: async () => [], catalog: async () => [] },
    });
    expect(missing.our).toBe(missing.their);
    expect(missing.our).toContain('"code":"schedule_not_found"');
    expect(missing.rig.schedule.calls.map((call) => call.method)).toEqual(["list", "catalog"]);
    const ended = await pair((rig) => toolOf(rig, "schedule_update").execute({ id: "sc1", title: "M" }, exec(agent())), {
      schedule: {
        list: async () => [],
        catalog: async () => [{ sessionId: SESSION_ID, id: "sc1" }],
      },
    });
    expect(ended.our).toBe(ended.their);
    expect(ended.our).toContain('"code":"schedule_ended"');
  });

  test("schedule_update: dịch vụ trả updated:false + schedule_conflict ⇒ chuyển nguyên văn, không bọc view", async () => {
    const p = await pair((rig) => toolOf(rig, "schedule_update").execute({ id: "sc1", title: "M" }, exec(agent())), {
      schedule: { update: async () => ({ id: "sc1", updated: false, code: "schedule_conflict" }) },
    });
    expect(p.our).toBe(p.their);
    expect(p.our).toContain('"updated":false');
    expect(p.our).toContain('"code":"schedule_conflict"');
    expect(p.our).not.toContain('"deliveryMode"');
  });

  test("schedule_create/list: ScheduleInputError ⇒ cùng code/message; lỗi lạ ⇒ cùng internal_error che thông điệp", async () => {
    // 05/11/2026 (P1b): sau P1b hai bên nạp HAI instance schedule khác nhau ⇒ mỗi bên phải nhận lớp lỗi của CHÍNH nó
    // (dùng chung một lớp thì `instanceof` của bên kia TRƯỢT ⇒ lệch nhánh internal_error).
    const callCreate = (rig: Rig): unknown => toolOf(rig, "schedule_create").execute({ prompt: "P", title: "T", at: "2030-01-01T00:00:00Z" }, exec(agent()));
    const rigOurs = await mount(ours, {
      schedule: {
        create: async () => {
          throw new ScheduleInputError("not_future", "The scheduled time must be strictly in the future.");
        },
      },
    });
    const rigStock = await mount(stock, {
      schedule: {
        create: async () => {
          throw new StockScheduleInputError("not_future", "The scheduled time must be strictly in the future.");
        },
      },
    });
    const known = { our: await outcome(() => callCreate(rigOurs)), their: await outcome(() => callCreate(rigStock)) };
    expect(known.our).toBe(known.their);
    expect(known.our).toContain('"code":"not_future"');
    expect(known.our).toContain("The scheduled time must be strictly in the future.");
    const unknown = await pair((rig) => toolOf(rig, "schedule_list").execute({}, exec(agent())), {
      schedule: {
        list: async () => {
          throw new Error("boom");
        },
      },
    });
    expect(unknown.our).toBe(unknown.their);
    expect(unknown.our).toContain('"code":"internal_error"');
    expect(unknown.our).toContain("The schedule operation failed.");
    expect(unknown.our).not.toContain("boom");
  });

  test("thiếu exec.agent · subagent (delegationDepth>0) · signal aborted ⇒ cùng internal_error/subagent_session, không chạm dịch vụ (subagent THẬT không dựng nổi — fixture)", async () => {
    const p = await pair(async (rig) => ({
      noAgent: await toolOf(rig, "schedule_create").execute({ prompt: "P", title: "T", after_seconds: 60 }, exec(undefined)),
      subagent: await toolOf(rig, "schedule_list").execute({}, exec(agent({ delegationDepth: 2 }))),
      aborted: await toolOf(rig, "schedule_update").execute({ id: "sc1", title: "M" }, exec(agent(), abortedSignal())),
    }));
    expect(p.our).toBe(p.their);
    expect(p.our).toContain('"code":"internal_error"');
    expect(p.our).toContain('"code":"subagent_session"');
    expect(p.our).toContain("A delegated subagent cannot use reminders.");
    expect(p.rig.schedule.calls).toHaveLength(0);
    expect(p.stockRig.schedule.calls).toHaveLength(0);
  });
});

/** Bề mặt package.json mà ca F đọc (chỉ các khoá liên quan manifest/metadata). */
interface ManifestLike {
  /** Tên package của ta. */
  name?: string;
  /** Cờ private. */
  private?: boolean;
  /** Kiểu module. */
  type?: string;
  /** Đầu vào chính. */
  main?: string;
  /** Khối dsh.client của bản gốc (phải VẮNG ở gói một mặt). */
  dsh?: unknown;
  /** Metadata gbh. */
  gbh?: {
    /** Row top-level đã mount (phải VẮNG). */
    row?: unknown;
    /** Row top-level đang park (phải VẮNG — gói này chỉ có row lồng). */
    row_unmounted_ly_do?: unknown;
    /** Test hành vi của gói. */
    tests?: string[];
    /** Khai báo row LỒNG trong preset. */
    nested?: { kind?: string; pluginId?: string; stockId?: string; presets?: string[] };
  };
}

describe("F · manifest + metadata (gbh.nested, KHÔNG row)", () => {
  test("package.json: gói MỘT MẶT, không gbh.row/row_unmounted_ly_do, nested đúng 3 preset đo từ dump-now2", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as ManifestLike;
    const stockManifest = JSON.parse(
      readFileSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-schedule", "package.json"), "utf8"),
    ) as ManifestLike;
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-tool-schedule");
    expect(manifest.private).toBe(true);
    expect(manifest.type).toBe("module");
    expect(manifest.main).toBe("lib/index.js");
    expect(manifest.dsh).toBeUndefined();
    expect(manifest.gbh?.row).toBeUndefined();
    expect(manifest.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect(manifest.gbh?.nested).toEqual({
      kind: "preset",
      pluginId: "tool-schedule",
      stockId: "@deepseek-ai/dsh-tool-schedule",
      presets: ["preset-standard", "preset-ptc", "preset-cordis"],
    });
    expect(stockManifest.name).toBe(manifest.gbh?.nested?.stockId);
    expect(manifest.gbh?.tests).toEqual(["tests/host/tool-schedule.test.ts"]);
    const readme = readFileSync(join(PKG, "README.md"), "utf8");
    expect(readme).toContain("dòng 865");
    expect(readme).toContain("dòng 1029");
    expect(readme).toContain("dòng 1296");
    expect(readme).toContain("CHƯA mount/flip");
  });
});
