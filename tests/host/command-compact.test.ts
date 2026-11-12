/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test đối chứng (A/B) cho @galaxy-blackhole/gbh-command-compact: artefact BYTE-IDENTICAL bundle gốc +
 *      bề mặt plugin (name/inject/apply) + apply trên Context cordis THẬT với dịch vụ commands/compaction GIẢ
 *      (đúng bộ `inject` đọc từ bundle) + vòng đời ctx.effect + mọi nhánh của handler /compact
 */

import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/command-compact/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "command-compact");
/** Artefact của ta (bản byte-identical của bundle gốc). */
const OURS_FILE = join(PKG, "lib", "index.js");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-command-compact", "lib", "index.js");
/** Cordis THẬT của runtime app. */
const CORDIS_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Module compaction THẬT — chỉ dùng để dựng ManualCompactionError ĐÚNG lớp cho dịch vụ giả. */
const COMPACTION_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-compaction", "lib", "index.js");

/** Nội dung bundle gốc. */
const STOCK_TEXT = readFileSync(STOCK_FILE, "utf8");
/** Ba tên export của gói (gói MỘT MẶT, không có default export, không có Config). */
const EXPORT_NAMES = ["apply", "inject", "name"];
/** definitionId mà bundle gốc brand cho lệnh. */
const DEFINITION_ID = "@deepseek-ai/dsh-command-compact";
/** Tên lệnh người dùng gõ. */
const COMMAND_NAME = "compact";
/** Mô tả lệnh. */
const DESCRIPTION = "Compact older conversation history";
/** Câu báo khi có tham số. */
const USAGE = "Usage: /compact (no arguments)";
/** Câu báo khi bị huỷ. */
const CANCELLED = "Compaction cancelled.";
/** Kết quả compactNow MẶC ĐỊNH của dịch vụ giả. */
const DEFAULT_RESULT = { shadowedSeqs: [11, 12, 13], shadowedTokenCount: 4200, summarySeq: 99 };
/** Sáu mã lỗi ĐÓNG của ManualCompactionError. */
const CODES = ["busy", "cancelled", "changed", "summary", "commit", "persistence"] as const;
/** Thông điệp người dùng ỨNG VỚI từng mã (nguyên văn bundle gốc). */
const TEXTS: Record<(typeof CODES)[number], string> = {
  busy: "Compaction is unavailable because this process has an active compaction, or the agent is not idle.",
  cancelled: CANCELLED,
  changed: "The history selected for compaction changed before it could be replaced. The attempt is recorded in the session log.",
  summary: "Compaction could not produce a useful summary. The attempt is recorded in the session log.",
  commit: "Compaction did not finish cleanly; some session history may have changed. Inspect the current session state before retrying.",
  persistence: "Compaction finished, but the session could not be saved.",
};

/** Một lời gọi lệnh do adapter dựng (chỉ các trường bundle gốc đọc). */
interface Invocation {
  /** Agent của lượt gọi. */
  readonly agent: unknown;
  /** Tín hiệu huỷ của lượt gọi. */
  readonly signal: AbortSignal;
  /** Id pairing do executor cấp. */
  readonly commandId: string;
  /** Phần người dùng gõ sau tên lệnh. */
  readonly rawInput: string;
}

/** Kết quả lệnh (hợp đóng kind success/error). */
interface CommandResult {
  /** Loại kết quả. */
  readonly kind: string;
  /** Câu hiển thị cho người dùng. */
  readonly text: string;
  /** Seq của sự kiện nguồn (chỉ nhánh thành công có compact). */
  readonly sourceEventSeq?: number;
}

/** Định nghĩa lệnh plugin đăng ký. */
interface CommandDescriptor {
  /** Id brand của definition. */
  readonly definitionId?: string;
  /** Tên lệnh. */
  readonly name: string;
  /** Mô tả lệnh. */
  readonly description: string;
  /** Thân lệnh. */
  readonly handler: (invocation: Invocation) => CommandResult | Promise<CommandResult>;
}

/** Bề mặt module plugin (của ta hoặc bản gốc). */
interface PluginApi {
  /** Tên plugin đăng ký với Loader. */
  readonly name: string;
  /** Dịch vụ plugin yêu cầu trước khi chạy. */
  readonly inject: readonly string[];
  /** Thân plugin: đăng ký /compact qua ctx.commands trong một ctx.effect. */
  readonly apply: (ctx: Ctx) => void;
}

/** Bề mặt Context cordis tối thiểu mà test chạm tới. */
interface Ctx {
  /** Cấp một dịch vụ GIẢ; trả hàm rút dịch vụ. */
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
  /** Dispose fiber: Context của nó thành INACTIVE và chạy hết disposer của ctx.effect. */
  dispose(): Promise<unknown>;
}

/** Dịch vụ commands GIẢ + vết đăng ký + khoá đã chạm. */
interface FakeCommands {
  /** Giá trị cấp cho ctx.provide('commands', …). */
  readonly service: unknown;
  /** Định nghĩa lệnh đã register, theo thứ tự. */
  readonly registered: CommandDescriptor[];
  /** Số lần disposer của register được gọi. */
  readonly unregistered: number[];
  /** Các khoá chuỗi đã đọc trên dịch vụ. */
  readonly keys: string[];
}

/** Một lời gọi dịch vụ compaction GIẢ đã ghi vết. */
interface CompactionCall {
  /** Phương thức được gọi. */
  readonly method: string;
  /** Tham số nguyên văn. */
  readonly args: readonly unknown[];
}

/** Ghi đè hành vi dịch vụ compaction GIẢ (dựng nhánh lỗi/kết quả rỗng). */
interface CompactionOverrides {
  /** Ghi đè compactNow. */
  compactNow?(args: readonly unknown[]): Promise<unknown>;
}

/** Dịch vụ compaction GIẢ + vết lời gọi + khoá đã chạm. */
interface FakeCompaction {
  /** Giá trị cấp cho ctx.provide('compaction', …). */
  readonly service: unknown;
  /** Vết lời gọi theo thứ tự. */
  readonly calls: CompactionCall[];
  /** Các khoá chuỗi đã đọc trên dịch vụ. */
  readonly keys: string[];
}

/** Tuỳ chọn dựng rig. */
interface MountOptions {
  /** Có cấp dịch vụ commands không (mặc định true). */
  withCommands?: boolean;
  /** Có cấp dịch vụ compaction không (mặc định true). */
  withCompaction?: boolean;
  /** Ghi đè hành vi compaction giả. */
  compaction?: CompactionOverrides;
}

/** Một rig đã mount xong một bên. */
interface Rig {
  /** Context cordis THẬT vừa dựng. */
  readonly ctx: Ctx;
  /** Dịch vụ commands giả + vết. */
  readonly commands: FakeCommands;
  /** Dịch vụ compaction giả + vết. */
  readonly compaction: FakeCompaction;
  /** Log lỗi mà cordis đẩy qua ctx.logger.error. */
  readonly errors: string[];
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
// ĐO TRÊN ARTIFACT nhưng peer phải là KERNEL (pattern tests/host/shell.test.ts): gói là bản byte-identical
// của bundle gốc, nó `instanceof ManualCompactionError` lấy từ `@deepseek-ai/dsh-compaction` — nạp artefact
// từ lib/ trong workspace thì lớp lỗi là bản .bun, khác realpath kernel ⇒ nhánh chuyển mã trượt.
// build.ts xoá sạch outDir nên symlink phải dựng SAU khi build xong.
const SURFACE_DIR = mkdtempSync(join(tmpdir(), "gbh-command-compact-"));
const SURFACE_FILE = await buildPackage(SURFACE_DIR);
mkdirSync(join(SURFACE_DIR, "node_modules"), { recursive: true });
symlinkSync(
  join(REPO, "apps", "host", "node_modules", "@deepseek-ai"),
  join(SURFACE_DIR, "node_modules", "@deepseek-ai"),
  "dir",
);
/** Nạp artefact của ta (peer = kernel). */
const ours = (await import(SURFACE_FILE)) as PluginApi;

/** Dọn thư mục dựng tạm của artefact. Nhận: không. Trả: không. */
afterAll(() => {
  rmSync(SURFACE_DIR, { recursive: true, force: true });
});
/** Nạp bundle gốc. */
const stock = (await import(STOCK_FILE)) as PluginApi;
/** Lớp lỗi compaction THẬT (dịch vụ giả ném ĐÚNG lớp để đo nhánh chuyển mã). */
const { ManualCompactionError } = (await import(COMPACTION_FILE)) as {
  ManualCompactionError: new (code: string, message: string) => Error;
};
/** Bộ `inject` ĐỌC TỪ BUNDLE — nguồn duy nhất quyết định dịch vụ GIẢ tối thiểu phải cấp. */
const INJECT: readonly string[] = [...stock.inject];

/**
 * Băm SHA-256 một chuỗi UTF-8.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Chờ cordis chạy xong fiber con và các promise đang treo.
 * Nhận: không.
 * Trả: Promise hoàn tất sau một macrotask.
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
 * Bọc một dịch vụ GIẢ bằng Proxy ghi lại mọi khoá chuỗi bị đọc.
 * Nhận: service — object dịch vụ; keys — mảng nhận khoá.
 * Trả: service đã bọc, hành vi y nguyên.
 */
function traced<T extends object>(service: T, keys: string[]): T {
  return new Proxy(service, {
    get(target, prop, receiver) {
      if (typeof prop === "string") keys.push(prop);
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Dịch vụ commands GIẢ: ghi lại từng định nghĩa lệnh register + mọi khoá bị đọc.
 * Nhận: không.
 * Trả: FakeCommands (service có Proxy ghi khoá, mảng đã đăng ký, mảng đếm dispose).
 */
function makeCommands(): FakeCommands {
  const registered: CommandDescriptor[] = [];
  const unregistered: number[] = [];
  const keys: string[] = [];
  const service = {
    register(command: CommandDescriptor): () => void {
      registered.push(command);
      return () => {
        unregistered.push(registered.length);
      };
    },
  };
  return { service: traced(service, keys), registered, unregistered, keys };
}

/**
 * Dịch vụ compaction GIẢ: một phương thức compactNow như seam thật bundle gốc gọi.
 * Nhận: overrides — ghi đè compactNow (dựng nhánh lỗi/kết quả rỗng).
 * Trả: FakeCompaction (service có Proxy ghi khoá, vết lời gọi).
 */
function makeCompaction(overrides: CompactionOverrides = {}): FakeCompaction {
  const calls: CompactionCall[] = [];
  const keys: string[] = [];
  const service = {
    async compactNow(...args: unknown[]): Promise<unknown> {
      calls.push({ method: "compactNow", args });
      if (overrides.compactNow !== undefined) return overrides.compactNow(args);
      return DEFAULT_RESULT;
    },
  };
  return { service: traced(service, keys), calls, keys };
}

/**
 * Dựng Context cordis THẬT + dịch vụ GIẢ theo ĐÚNG bộ `inject` của bundle gốc, rồi gọi apply của MỘT bên.
 * Nhận: api — bề mặt module plugin; options — bật/tắt dịch vụ + ghi đè compaction giả.
 * Trả: Rig (Context, dịch vụ giả, log lỗi, lỗi apply).
 */
async function mount(api: PluginApi, options: MountOptions = {}): Promise<Rig> {
  const ctx = new ContextCtor() as Ctx;
  const errors: string[] = [];
  ctx.logger.error = (...args: unknown[]) => {
    errors.push(args.map(textOfError).join(" "));
  };
  ctx.logger.warn = () => {};
  const commands = makeCommands();
  const compaction = makeCompaction(options.compaction ?? {});
  const available: Record<string, unknown> = {
    commands: commands.service,
    compaction: compaction.service,
    enabled: { commands: options.withCommands !== false, compaction: options.withCompaction !== false },
  };
  // Fake service tối thiểu ĐÚNG THEO `inject` của stock: tên lạ ⇒ nổ ngay, không đoán.
  for (const name of INJECT) {
    const enabled = available.enabled as Record<string, boolean>;
    if (enabled[name] !== true) continue;
    const fake = available[name];
    if (fake === undefined) throw new Error("thieu fake service cho inject '" + name + "'");
    ctx.provide(name, fake);
  }
  let applyError: string | null = null;
  try {
    api.apply(ctx);
  } catch (caught) {
    applyError = textOfError(caught);
  }
  await settle();
  return { ctx, commands, compaction, errors, applyError };
}

/**
 * Gói bề mặt một định nghĩa lệnh thành object JSON-so-sánh-được.
 * Nhận: command — định nghĩa đã register.
 * Trả: object { definitionId, name, description, keys, handlerType }.
 */
function commandSurface(command: CommandDescriptor): Record<string, unknown> {
  return {
    definitionId: command.definitionId,
    name: command.name,
    description: command.description,
    keys: Object.keys(command),
    handlerType: typeof command.handler,
  };
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
 * Lấy định nghĩa lệnh DUY NHẤT đã register từ rig, báo lỗi rõ khi thiếu.
 * Nhận: rig — kết quả mount.
 * Trả: CommandDescriptor.
 */
function commandOf(rig: Rig): CommandDescriptor {
  const command = rig.commands.registered[0];
  if (command === undefined) throw new Error("khong co command nao duoc register");
  return command;
}

/**
 * Dựng một invocation GIẢ đúng các trường bundle gốc đọc.
 * Nhận: extra — rawInput/agent/signal/commandId ghi đè.
 * Trả: Invocation.
 */
function invocation(extra: Partial<Invocation> = {}): Invocation {
  return {
    agent: extra.agent ?? { session: { id: "s1" } },
    signal: extra.signal ?? new AbortController().signal,
    commandId: extra.commandId ?? "cmd-1",
    rawInput: extra.rawInput ?? "",
  };
}

/**
 * Dựng tín hiệu ĐÃ HUỶ (đo nhánh ưu tiên abort trong catch).
 * Nhận: không.
 * Trả: AbortSignal đã abort.
 */
function abortedSignal(): AbortSignal {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
}

/**
 * Mount plugin qua vòng đời ctx.plugin THẬT (không gọi apply trực tiếp), kèm config tuỳ ý.
 * Nhận: api — bề mặt module plugin; config — giá trị config truyền cho ctx.plugin.
 * Trả: object { state, surface, errors } JSON-so-sánh-được.
 */
async function pluginMount(api: PluginApi, config?: unknown): Promise<{ state: number | null; surface: unknown[]; errors: number }> {
  const ctx = new ContextCtor() as Ctx;
  const errors: string[] = [];
  ctx.logger.error = (...args: unknown[]) => {
    errors.push(args.map(textOfError).join(" "));
  };
  ctx.logger.warn = () => {};
  const commands = makeCommands();
  const compaction = makeCompaction();
  ctx.provide("commands", commands.service);
  ctx.provide("compaction", compaction.service);
  const fiber = ctx.plugin({ name: api.name, inject: api.inject, apply: api.apply }, config);
  await fiber;
  await settle();
  return { state: fiber.state ?? null, surface: commands.registered.map(commandSurface), errors: errors.length };
}

describe("A · artefact byte-identical bundle gốc", () => {
  test("lib/index.js: cùng độ dài BYTE + cùng 102 dòng (3 506 byte) với bundle gốc", () => {
    const oursText = readFileSync(OURS_FILE, "utf8");
    expect(oursText.length).toBe(STOCK_TEXT.length);
    expect(Buffer.byteLength(oursText, "utf8")).toBe(3506);
    expect(statSync(OURS_FILE).size).toBe(Buffer.byteLength(STOCK_TEXT, "utf8"));
    expect((oursText.match(/\n/g) ?? []).length).toBe(102);
    expect(oursText.split("\n").length).toBe(STOCK_TEXT.split("\n").length);
  });

  test("lib/index.js: trùng TOÀN VĂN từng byte + sha256 64 ký tự (delta 0)", () => {
    const oursText = readFileSync(OURS_FILE, "utf8");
    expect(oursText).toBe(STOCK_TEXT);
    expect(sha256(oursText)).toBe(sha256(STOCK_TEXT));
    expect(sha256(oursText)).toBe("ee8b2519449ad549db3c2d81d652b2b0827492b3ae1d809e8c01df3f79b6ad94");
    expect(sha256(oursText)).toHaveLength(64);
  });
});

describe("B · bề mặt plugin A/B", () => {
  test("export runtime: ĐÚNG 3 tên {apply, inject, name}, KHÔNG có default/Config ở CẢ HAI bên", () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual([...EXPORT_NAMES].sort());
    expect("default" in ours).toBe(false);
    expect("default" in stock).toBe(false);
    expect(String((ours as { Config?: unknown }).Config)).toBe(String((stock as { Config?: unknown }).Config));
    expect(String((ours as { Config?: unknown }).Config)).toBe("undefined");
    expect(ours.name).toBe(stock.name);
    expect(ours.name).toBe("command-compact");
    expect(typeof ours.apply).toBe("function");
    expect(typeof stock.apply).toBe("function");
  });

  test("inject đọc TỪ BUNDLE: ['commands', 'compaction'] — hai bên khớp, đó là bộ fake service tối thiểu", () => {
    expect(Array.isArray(ours.inject)).toBe(true);
    expect([...ours.inject]).toEqual([...stock.inject]);
    expect([...ours.inject]).toEqual(["commands", "compaction"]);
    expect([...INJECT]).toEqual(["commands", "compaction"]);
  });

  test("KHÔNG có Config: 5 giá trị config khác nhau qua ctx.plugin đều cho CÙNG bề mặt đăng ký (A/B)", async () => {
    const configs: unknown[] = [undefined, null, {}, { mode: "compact" }, { nested: { depth: 2 } }];
    const seen: string[] = [];
    for (const config of configs) {
      const our = await pluginMount(ours, config);
      const their = await pluginMount(stock, config);
      expect(JSON.stringify(our)).toBe(JSON.stringify(their));
      expect(typeof our.state).toBe("number");
      expect(our.surface).toHaveLength(1);
      seen.push(JSON.stringify(our.surface));
    }
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).toContain('"name":"compact"');
    expect(seen[0]).toContain('"definitionId":"@deepseek-ai/dsh-command-compact"');
    expect(seen[0]).toContain('"handlerType":"function"');
  });
});

describe("C · apply trên Context cordis THẬT + dịch vụ GIẢ", () => {
  test("apply: ĐÚNG 1 command /compact — definitionId/name/description/khoá, chỉ chạm 'register'", async () => {
    const p = await pair((rig) => ({
      count: rig.commands.registered.length,
      surface: rig.commands.registered.map(commandSurface),
      commandKeys: [...new Set(rig.commands.keys)],
      compactionKeys: [...new Set(rig.compaction.keys)],
    }));
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      count: number;
      surface: Record<string, unknown>[];
      commandKeys: string[];
      compactionKeys: string[];
    };
    expect(seen.count).toBe(1);
    expect(seen.surface).toEqual([
      {
        definitionId: DEFINITION_ID,
        name: COMMAND_NAME,
        description: DESCRIPTION,
        keys: ["definitionId", "name", "description", "handler"],
        handlerType: "function",
      },
    ]);
    expect(seen.commandKeys).toEqual(["register"]);
    expect(seen.compactionKeys).toEqual([]);
    expect(p.rig.applyError).toBeNull();
    expect(p.stockRig.applyError).toBeNull();
  });

  test("apply qua ctx.plugin THẬT: cùng trạng thái fiber + cùng bề mặt command, không log lỗi", async () => {
    const our = await pluginMount(ours);
    const their = await pluginMount(stock);
    expect(JSON.stringify(our)).toBe(JSON.stringify(their));
    expect(our.surface).toHaveLength(1);
    expect(our.errors).toBe(0);
    expect(typeof our.state).toBe("number");
  });

  test("vòng đời ctx.effect: dispose CHỜ compactNow đang bay rồi mới xong (A/B)", async () => {
    const run = async (api: PluginApi): Promise<Record<string, unknown>> => {
      const ctx = new ContextCtor() as Ctx;
      const errors: string[] = [];
      ctx.logger.error = (...args: unknown[]) => {
        errors.push(args.map(textOfError).join(" "));
      };
      ctx.logger.warn = () => {};
      const commands = makeCommands();
      let release: (value: unknown) => void = () => {};
      const pending = new Promise<unknown>((resolve) => {
        release = resolve;
      });
      const compaction = makeCompaction({ compactNow: () => pending });
      ctx.provide("commands", commands.service);
      ctx.provide("compaction", compaction.service);
      const fiber = ctx.plugin({ name: api.name, inject: api.inject, apply: api.apply });
      await fiber;
      await settle();
      const command = commands.registered[0];
      if (command === undefined) throw new Error("khong co command nao duoc register");
      const operation = command.handler(invocation());
      let disposed = false;
      const disposal = Promise.resolve(fiber.dispose()).then(() => {
        disposed = true;
      });
      await settle();
      const duringDisposal = disposed;
      release(DEFAULT_RESULT);
      const result = await operation;
      await disposal;
      return { duringDisposal, disposed, result, errors, unregistered: commands.unregistered.length };
    };
    const our = await run(ours);
    const their = await run(stock);
    expect(JSON.stringify(our)).toBe(JSON.stringify(their));
    expect(our.duringDisposal).toBe(false);
    expect(our.disposed).toBe(true);
    expect(our.errors).toEqual([]);
    expect(our.unregistered).toBe(1);
    expect(our.result).toEqual({
      kind: "success",
      text: "Compacted 3 history items (~4200 tokens).",
      sourceEventSeq: 99,
    });
  });
});

describe("D · handler /compact A/B", () => {
  test("thành công: chuyển NGUYÊN VĂN agent/signal/commandId cho compactNow, báo số mục/token + sourceEventSeq", async () => {
    const signal = new AbortController().signal;
    const agent = { session: { id: "s1" } };
    const p = await pair(async (rig) => {
      const result = await commandOf(rig).handler(invocation({ agent, signal, commandId: "cmd-42" }));
      const call = rig.compaction.calls[0];
      return {
        result,
        called: rig.compaction.calls.length,
        method: call?.method,
        agentSame: call?.args[0] === agent,
        signalSame: call?.args[1] === signal,
        commandIdSame: call?.args[2] === "cmd-42",
        args: call?.args.map(textOfArgument),
      };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as Record<string, unknown>;
    expect(seen.result).toEqual({
      kind: "success",
      text: "Compacted 3 history items (~4200 tokens).",
      sourceEventSeq: 99,
    });
    expect(seen.called).toBe(1);
    expect(seen.method).toBe("compactNow");
    expect(seen.agentSame).toBe(true);
    expect(seen.signalSame).toBe(true);
    expect(seen.commandIdSame).toBe(true);
    expect(seen.args).toHaveLength(3);
    expect(p.rig.compaction.calls).toHaveLength(1);
    expect(p.rig.commands.unregistered).toHaveLength(0);
  });

  test("compactNow trả null: 'No compactable history yet.' — success KHÔNG có sourceEventSeq", async () => {
    const p = await pair((rig) => commandOf(rig).handler(invocation()), {
      compaction: { compactNow: async () => null },
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as Record<string, unknown>;
    expect(seen).toEqual({ kind: "success", text: "No compactable history yet." });
    expect("sourceEventSeq" in seen).toBe(false);
    expect(p.rig.compaction.calls).toHaveLength(1);
  });

  test("rawInput có KÝ TỰ khác khoảng trắng ⇒ Usage, KHÔNG chạm compactNow; chỉ khoảng trắng ⇒ coi như không tham số", async () => {
    const p = await pair(async (rig) => ({
      word: await commandOf(rig).handler(invocation({ rawInput: "now" })),
      spaced: await commandOf(rig).handler(invocation({ rawInput: "   " })),
      newline: await commandOf(rig).handler(invocation({ rawInput: "\n\t " })),
      calls: rig.compaction.calls.length,
    }));
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as Record<string, unknown>;
    // trim() rỗng ⇒ đi tiếp vào compactNow (đúng nguyên văn bundle gốc).
    expect(seen.word).toEqual({ kind: "error", text: USAGE });
    expect(seen.spaced).toEqual({
      kind: "success",
      text: "Compacted 3 history items (~4200 tokens).",
      sourceEventSeq: 99,
    });
    expect(seen.newline).toEqual({
      kind: "success",
      text: "Compacted 3 history items (~4200 tokens).",
      sourceEventSeq: 99,
    });
    expect(seen.calls).toBe(2);
    expect(p.rig.compaction.calls).toHaveLength(2);
    expect(p.stockRig.compaction.calls).toHaveLength(2);
  });

  test("ManualCompactionError 6 mã ĐÓNG ⇒ 6 thông điệp người-dùng ổn định, đúng nguyên văn (A/B)", async () => {
    const p = await pair(
      async (rig) => {
        const results: unknown[] = [];
        for (const code of CODES) results.push(await commandOf(rig).handler(invocation({ commandId: code })));
        return results;
      },
      {
        compaction: {
          compactNow: async (args) => {
            throw new ManualCompactionError(String(args[2]), "backend: " + String(args[2]));
          },
        },
      },
    );
    expect(p.our).toBe(p.their);
    const results = decoded(p.our) as CommandResult[];
    expect(results).toHaveLength(CODES.length);
    for (const [index, code] of CODES.entries()) {
      expect(results[index]?.kind).toBe("error");
      expect(results[index]?.text).toBe(TEXTS[code]);
      expect(results[index]?.sourceEventSeq).toBeUndefined();
    }
    expect(p.rig.compaction.calls.map((call) => call.args[2])).toEqual([...CODES]);
  });

  test("signal ĐÃ HUỶ thắng cả ManualCompactionError ⇒ 'Compaction cancelled.'; abort mà compactNow thành công vẫn báo thành công", async () => {
    const aborted = abortedSignal();
    const failed = await pair((rig) => commandOf(rig).handler(invocation({ signal: aborted })), {
      compaction: {
        compactNow: async () => {
          throw new ManualCompactionError("busy", "dang ban");
        },
      },
    });
    expect(failed.our).toBe(failed.their);
    expect(decoded(failed.our)).toEqual({ kind: "error", text: CANCELLED });
    const ok = await pair((rig) => commandOf(rig).handler(invocation({ signal: aborted })));
    expect(ok.our).toBe(ok.their);
    expect(decoded(ok.our)).toEqual({
      kind: "success",
      text: "Compacted 3 history items (~4200 tokens).",
      sourceEventSeq: 99,
    });
  });

  test("lỗi KHÔNG phải ManualCompactionError ⇒ NÉM NGUYÊN VĂN, không bọc thành kết quả", async () => {
    const p = await pair((rig) => commandOf(rig).handler(invocation()), {
      compaction: {
        compactNow: async () => {
          throw new TypeError("boom");
        },
      },
    });
    expect(p.our).toBe(p.their);
    expect(p.our).toBe("nem|TypeError|-|boom");
    expect(p.our).not.toContain('"kind"');
  });

  test("Context TRỐNG (không commands/compaction): apply NÉM TypeError thiếu ctx.commands ở CẢ HAI bên, 0 command, không log", async () => {
    const p = await pair((rig) => ({ registered: rig.commands.registered.length, errors: rig.errors }), {
      withCommands: false,
      withCompaction: false,
    });
    expect(p.our).toBe(p.their);
    expect(p.rig.applyError).toBe(p.stockRig.applyError);
    expect(p.rig.applyError).toContain("ctx.commands.register");
    expect(p.rig.commands.registered).toHaveLength(0);
    expect(p.stockRig.commands.registered).toHaveLength(0);
    expect(p.rig.commands.keys).toEqual([]);
    expect(p.rig.errors).toEqual([]);
    expect(p.stockRig.errors).toEqual([]);
    expect(p.rig.compaction.calls).toHaveLength(0);
  });

  test("thiếu RIÊNG compaction: /compact vẫn đăng ký nhưng gọi handler ⇒ cùng lỗi thiếu dịch vụ (A/B)", async () => {
    const p = await pair((rig) => commandOf(rig).handler(invocation()), { withCompaction: false });
    expect(p.our).toBe(p.their);
    expect(p.our.startsWith("nem|")).toBe(true);
    expect(p.our).toContain("compaction");
    expect(p.rig.commands.registered).toHaveLength(1);
    expect(p.rig.compaction.calls).toHaveLength(0);
  });
});
