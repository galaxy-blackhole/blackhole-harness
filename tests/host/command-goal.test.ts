/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B (≥10 ca) cho @galaxy-blackhole/gbh-command-goal: build gói ta vào mkdtemp rồi nạp CẢ bản ta
 *      lẫn bundle gốc @deepseek-ai/dsh-command-goal, chạy cùng fixture trên ctx GIẢ có ba seam
 *      commands/goals/llm (llm KHÔNG được chạm) và so sâu export · inject · đăng ký lệnh · mọi nhánh handler ·
 *      attachments · lỗi; kèm cổng parity metadata gbh.row + gbh.nested với dump 2026-10-18T01-31-57.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "command-goal");
/** node_modules của kernel — nơi cả hai bản phân giải peer. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_FILE = join(APP_MODULES, "@deepseek-ai", "dsh-command-goal", "lib", "index.js");
/** Manifest gốc — nguồn peerDependencies. */
const STOCK_MANIFEST = join(APP_MODULES, "@deepseek-ai", "dsh-command-goal", "package.json");
/** Dump đối chiếu mà cổng parity mới chỉ định. */
const DUMP_DIR = join(REPO, ".parity", "dumps", "2026-10-18T01-31-57");
/** Dump của app (ours.yml) — nơi có row top-level 280–282 và 3 entry LỒNG 839/1003/1266. */
const DUMP_FILE = join(DUMP_DIR, "ours.yml");
/** Artefact tạm; dọn ở afterAll. */
const OUT = mkdtempSync(join(tmpdir(), "gbh-command-goal-ab-"));
/** Tên module/definition mà lệnh brand (nguyên văn bản gốc). */
const DEFINITION_ID = "@deepseek-ai/dsh-command-goal";
/** Câu hướng dẫn nguyên văn của bản gốc. */
const USAGE = "Usage: /goal [<objective>|clear|edit <objective>|pause|resume]";
/** Đường dẫn test do gói tự khai (gbh.tests + gbh.row.tests). */
const TEST_PATH = "tests/host/command-goal.test.ts";

/** Bề mặt module plugin (của ta hoặc bản gốc). */
interface PluginApi {
  /** Tên plugin đăng ký với Loader. */
  readonly name: string;
  /** Dịch vụ plugin yêu cầu trước khi chạy. */
  readonly inject: string[];
  /** Thân plugin: đăng ký lệnh /goal trên ctx.commands. */
  readonly apply: (ctx: unknown) => void;
}
/** Lượt gọi lệnh do adapter dựng (chỉ các trường handler đọc). */
interface Invocation {
  /** Id pairing do executor cấp. */
  readonly commandId: string;
  /** Agent nhận lệnh. */
  readonly agent: unknown;
  /** Phần người dùng gõ sau tên lệnh. */
  readonly rawInput: string;
  /** Attachment đã được nhận. */
  readonly attachments: readonly unknown[];
  /** Tín hiệu huỷ của lượt gọi. */
  readonly signal: AbortSignal;
}
/** Kết quả lệnh (hợp đóng success/error như dsh-commands). */
interface CommandResult {
  /** Loại kết quả. */
  readonly kind: string;
  /** Câu hiển thị cho người dùng. */
  readonly text?: string;
  /** Seq của sự kiện nguồn (không dùng ở lệnh này). */
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
  /** Mô tả đầu vào tự do. */
  readonly input?: { readonly hint: string; readonly attachments?: boolean };
  /** Thân lệnh. */
  readonly handler: (invocation: Invocation) => CommandResult | Promise<CommandResult>;
}
/** Một goal tối thiểu đủ cho mọi nhánh render (hình dạng GoalView). */
interface GoalView {
  /** Định danh goal. */
  readonly id: string;
  /** Revision compare-and-set. */
  readonly revision: number;
  /** Objective người dùng đặt. */
  readonly objective: string;
  /** Pha bền. */
  readonly phase: string;
  /** Lý do blocked (chỉ khi phase = blocked). */
  readonly blockedReason?: { readonly code: string; readonly message: string };
  /** Trần vòng. */
  readonly maxGoalRounds: number;
  /** Số vòng đã nhận. */
  readonly roundsStarted: number;
  /** Mốc tạo. */
  readonly createdAt: number;
  /** Mốc sửa cuối. */
  readonly updatedAt: number;
  /** Quyền chạy tiếp phạm vi tiến trình. */
  readonly activation: string;
}

/** Một lời gọi service goals đã ghi vết. */
interface GoalCall {
  /** Tên phương thức. */
  readonly method: string;
  /** Tham số nguyên văn. */
  readonly args: readonly unknown[];
}

/** Móc lỗi của service goals giả. */
interface GoalFail {
  /** Phương thức sẽ ném. */
  readonly method: string;
  /** Lỗi ném ra. */
  readonly error: Error;
}

/** Dịch vụ commands GIẢ + vết đăng ký + khoá đã chạm. */
interface FakeCommands {
  /** Giá trị cấp cho ctx.commands. */
  readonly service: unknown;
  /** Định nghĩa đã register, theo thứ tự. */
  readonly registered: CommandDescriptor[];
  /** Số lần disposer được gọi. */
  readonly unregistered: number[];
  /** Các khoá chuỗi đã đọc trên dịch vụ. */
  readonly keys: string[];
}

/** Dịch vụ goals GIẢ + vết lời gọi + khoá đã chạm. */
interface FakeGoals {
  /** Giá trị cấp cho ctx.goals. */
  readonly service: unknown;
  /** Vết lời gọi theo thứ tự. */
  readonly calls: GoalCall[];
  /** Các khoá chuỗi đã đọc trên dịch vụ. */
  readonly keys: string[];
}

/** Một giàn đã mount xong MỘT bên. */
interface Rig {
  /** Bề mặt module đã mount. */
  readonly api: PluginApi;
  /** Dịch vụ commands giả + vết. */
  readonly commands: FakeCommands;
  /** Dịch vụ goals giả + vết. */
  readonly goals: FakeGoals;
  /** Agent giả + các tin nhắn followup đã nhận. */
  readonly agent: { readonly followup: (message: unknown) => void };
  /** Tin nhắn followup theo thứ tự. */
  readonly followups: unknown[];
  /** Các khoá đã đọc trên seam llm (phải RỖNG: llm không phải seam của plugin). */
  readonly llmKeys: string[];
  /** Lỗi apply ném ra (null khi apply không ném). */
  readonly applyError: string | null;
}

/** Kết quả một phép: thành công hoặc lỗi đã chuẩn hoá. */
type Attempt =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: { readonly name: string; readonly message: string } };

/** Bundle gốc nạp trong beforeAll. */
let stockMod: PluginApi;
/** Bản của ta nạp từ artefact đã build trong beforeAll. */
let oursMod: PluginApi;
/** Lớp GoalError THẬT của kernel (cùng thực thể mà artefact của ta import). */
let GoalErrorCtor: new (message: string, code: string) => Error;
/** Lớp GoalError của BUNDLE GỐC (stock) — dùng cho nhánh A/B của bundle gốc sau khi ta đổi sang gbh-goal. */
let StockGoalErrorCtor: new (message: string, code: string) => Error;

beforeAll(async () => {
  const build = (await import(join(PKG, "build.ts"))) as {
    buildPackage(outDir?: string): Promise<{ service: string }>;
  };
  const built = await build.buildPackage(OUT);
  if (!existsSync(built.service)) throw new Error("command-goal: build không tạo " + built.service);
  symlinkSync(APP_MODULES, join(OUT, "node_modules"), "dir");
  stockMod = (await import(STOCK_FILE)) as PluginApi;
  oursMod = (await import(pathToFileURL(built.service).href)) as PluginApi;
  // R6a/PHASE B (08/11/2026, dev-1): artefact của ta import "@galaxy-blackhole/gbh-goal" ⇒ dựng GoalError từ ĐÚNG
  // thực thể của từng bên; bundle gốc vẫn dùng lớp stock nên cần HAI ctor (kịch bản A/B dựng lỗi theo bên).
  const goalModule = (await import("@galaxy-blackhole/gbh-goal")) as {
    GoalError: new (message: string, code: string) => Error;
  };
  GoalErrorCtor = goalModule.GoalError;
  const stockGoalModule = (await import(join(APP_MODULES, "@deepseek-ai", "dsh-goal", "lib", "index.js"))) as {
    GoalError: new (message: string, code: string) => Error;
  };
  StockGoalErrorCtor = stockGoalModule.GoalError;
}, 120_000);

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

/**
 * Chuẩn hoá một lỗi thành name + message (không so stack).
 * @param error - giá trị bắt được.
 * @returns hình dạng so sánh được.
 */
function errorShape(error: unknown): { readonly name: string; readonly message: string } {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "thrown", message: String(error) };
}

/**
 * Chạy một phép, bắt lỗi (đồng bộ lẫn bất đồng bộ).
 * @param fn - hàm cần chạy.
 * @returns Attempt đã chuẩn hoá.
 */
async function attempt(fn: () => unknown | Promise<unknown>): Promise<Attempt> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error: errorShape(error) };
  }
}

/**
 * Dựng một goal mẫu (hình dạng GoalView) với phần ghi đè tuỳ ý.
 * @param overrides - trường cần đổi.
 * @returns goal đã đủ trường.
 */
function goal(overrides: Partial<GoalView> = {}): GoalView {
  return {
    id: "goal-1",
    revision: 3,
    objective: "ship parity",
    phase: "active",
    maxGoalRounds: 7,
    roundsStarted: 2,
    createdAt: 1_000,
    updatedAt: 2_000,
    activation: "armed",
    ...overrides,
  };
}

/**
 * Dựng dịch vụ commands GIẢ: ghi lại từng định nghĩa + mọi khoá bị đọc.
 * @returns FakeCommands với service được bọc Proxy ghi khoá.
 */
function makeCommands(): FakeCommands {
  const registered: CommandDescriptor[] = [];
  const unregistered: number[] = [];
  const keys: string[] = [];
  const service = {
    register(command: CommandDescriptor): () => void {
      registered.push(command);
      const index = registered.length;
      return () => {
        unregistered.push(index);
      };
    },
  };
  return {
    service: new Proxy(service, {
      get(target, prop, receiver) {
        if (typeof prop === "string") keys.push(prop);
        return Reflect.get(target, prop, receiver);
      },
    }),
    registered,
    unregistered,
    keys,
  };
}

/**
 * Dựng dịch vụ goals GIẢ: kho goal theo rig + vết lời gọi + móc lỗi theo phương thức.
 * @param seed - goal hiện tại ban đầu (undefined = chưa có goal).
 * @param fail - móc ném lỗi ở một phương thức.
 * @returns FakeGoals với service được bọc Proxy ghi khoá.
 */
function makeGoals(seed: GoalView | undefined, fail?: GoalFail): FakeGoals {
  const calls: GoalCall[] = [];
  const keys: string[] = [];
  let current = seed;
  let seq = 1;
  const record = (method: string, args: readonly unknown[]): void => {
    calls.push({ method, args });
    if (fail !== undefined && fail.method === method) throw fail.error;
  };
  const need = (): GoalView => {
    if (current === undefined) throw new Error("goals giả: chưa có goal");
    return current;
  };
  const service = {
    get(agent: unknown): GoalView | undefined {
      record("get", [agent]);
      return current;
    },
    create(agent: unknown, request: { readonly objective: string }): GoalView {
      record("create", [agent, request]);
      seq += 1;
      current = goal({ id: "goal-" + String(seq), revision: 1, objective: request.objective, roundsStarted: 0 });
      return current;
    },
    edit(agent: unknown, ref: { readonly id: string; readonly revision: number }, request: { readonly objective: string }): GoalView {
      record("edit", [agent, ref, request]);
      current = { ...need(), revision: ref.revision + 1, objective: request.objective };
      return current;
    },
    pause(agent: unknown, ref: { readonly id: string; readonly revision: number }): GoalView {
      record("pause", [agent, ref]);
      current = { ...need(), revision: ref.revision + 1, phase: "paused", activation: "disarmed" };
      return current;
    },
    resume(agent: unknown, ref: { readonly id: string; readonly revision: number }): GoalView {
      record("resume", [agent, ref]);
      current = { ...need(), revision: ref.revision + 1, phase: "active", activation: "armed" };
      return current;
    },
    clear(agent: unknown, ref: { readonly id: string; readonly revision: number }): { readonly id: string; readonly revision: number } {
      record("clear", [agent, ref]);
      const tomb = { id: need().id, revision: ref.revision + 1 };
      current = undefined;
      return tomb;
    },
  };
  return {
    service: new Proxy(service, {
      get(target, prop, receiver) {
        if (typeof prop === "string") keys.push(prop);
        return Reflect.get(target, prop, receiver);
      },
    }),
    calls,
    keys,
  };
}

/**
 * Mount MỘT bên trên ctx GIẢ có ba seam commands/goals/llm (llm là Proxy ghi khoá, không cấp giá trị).
 * @param api - bề mặt module plugin.
 * @param seed - goal hiện tại ban đầu.
 * @param fail - móc lỗi của service goals.
 * @returns Rig đã mount (kèm lỗi apply nếu có).
 */
function mount(api: PluginApi, seed?: GoalView, fail?: GoalFail): Rig {
  const commands = makeCommands();
  const goals = makeGoals(seed, fail);
  const followups: unknown[] = [];
  const llmKeys: string[] = [];
  const agent = {
    followup(message: unknown): void {
      followups.push(message);
    },
  };
  const ctx = {
    commands: commands.service,
    goals: goals.service,
    llm: new Proxy(
      {},
      {
        get(_target, prop) {
          llmKeys.push(String(prop));
          return undefined;
        },
      },
    ),
  };
  let applyError: string | null = null;
  try {
    api.apply(ctx);
  } catch (error) {
    applyError = errorShape(error).name + "|" + errorShape(error).message;
  }
  return { api, commands, goals, agent, followups, llmKeys, applyError };
}

/**
 * Gọi handler của định nghĩa DUY NHẤT đã đăng ký.
 * @param rig - giàn đã mount.
 * @param rawInput - phần người dùng gõ sau tên lệnh.
 * @param attachments - attachment của lượt gọi.
 * @returns kết quả lệnh (có thể Promise nhưng bản gốc trả đồng bộ).
 */
function invoke(rig: Rig, rawInput: string, attachments: readonly unknown[] = []): CommandResult | Promise<CommandResult> {
  const command = rig.commands.registered[0];
  if (command === undefined) throw new Error("không có command nào được đăng ký");
  return command.handler({
    commandId: "cmd-1",
    agent: rig.agent,
    rawInput,
    attachments,
    signal: new AbortController().signal,
  });
}

/**
 * Gói bề mặt một định nghĩa lệnh thành object JSON-so-sánh-được.
 * @param command - định nghĩa đã register.
 * @returns object bề mặt (definitionId/name/description/input/khoá/kiểu handler).
 */
function surface(command: CommandDescriptor): Record<string, unknown> {
  return {
    definitionId: command.definitionId,
    name: command.name,
    description: command.description,
    input: command.input,
    keys: Object.keys(command),
    handlerType: typeof command.handler,
  };
}

/**
 * Bỏ định danh ngẫu nhiên khỏi một message để so cấu trúc (createUserMessage sinh UUID).
 * @param message - message bất kỳ.
 * @returns { role, source, content } — đủ để chứng minh nội dung model thấy.
 */
function messageShape(message: unknown): unknown {
  const value = message as { role?: unknown; source?: unknown; content?: unknown };
  return { role: value.role, source: value.source, content: value.content };
}

/**
 * Chạy CÙNG kịch bản trên bản của ta và bundle gốc, mỗi bên một rig MỚI, rồi so sâu.
 * @param scenario - kịch bản nhận rig và trả giá trị JSON-so-sánh-được.
 * @param seed - goal hiện tại ban đầu.
 * @param fail - móc lỗi của service goals; truyền HÀM khi lỗi phải là thực thể riêng của từng bên (PHASE B 08/11/2026).
 * @returns hình dạng hai bên + hai rig để khẳng định thêm.
 */
async function pair(
  scenario: (rig: Rig) => unknown | Promise<unknown>,
  seed?: GoalView,
  fail?: GoalFail | ((isOurs: boolean) => GoalFail),
): Promise<{ our: unknown; their: unknown; ours: Rig; stock: Rig }> {
  const failFor = (isOurs: boolean): GoalFail | undefined => (typeof fail === "function" ? fail(isOurs) : fail);
  const ours = mount(oursMod, seed, failFor(true));
  const stock = mount(stockMod, seed, failFor(false));
  const our = await attempt(() => scenario(ours));
  const their = await attempt(() => scenario(stock));
  expect(plain(our)).toEqual(plain(their));
  return { our, their, ours, stock };
}

/**
 * Chuẩn hoá một giá trị thành JSON thuần (bỏ tham chiếu hàm giữa hai giàn A/B).
 * @param value - giá trị bất kỳ.
 * @returns bản sao JSON so sánh được.
 */
function plain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

/**
 * Đọc một giá trị từ Attempt thành công, báo lỗi rõ khi là nhánh lỗi.
 * @param result - Attempt cần đọc.
 * @returns giá trị thành công.
 */
function valueOf(result: unknown): unknown {
  const attempt = result as Attempt;
  if (!attempt.ok) throw new Error("expected success, got " + attempt.error.name + "|" + attempt.error.message);
  return attempt.value;
}

describe("A · bề mặt export + inject A/B", () => {
  test("export runtime ĐÚNG 3 tên {apply, inject, name} ở CẢ HAI bên, không default/Config", () => {
    expect(Object.keys(oursMod).sort()).toEqual(Object.keys(stockMod).sort());
    expect(Object.keys(oursMod).sort()).toEqual(["apply", "inject", "name"]);
    expect("default" in oursMod).toBe(false);
    expect("default" in stockMod).toBe(false);
    expect(String((oursMod as { Config?: unknown }).Config)).toBe(String((stockMod as { Config?: unknown }).Config));
    expect(String((oursMod as { Config?: unknown }).Config)).toBe("undefined");
    expect(oursMod.name).toBe(stockMod.name);
    expect(oursMod.name).toBe("command-goal");
    expect(typeof oursMod.apply).toBe("function");
    expect(typeof stockMod.apply).toBe("function");
  });

  test("inject đọc TỪ ARTEFACT: ['commands','goals'] — hai bên khớp, không chia sẻ mảng", () => {
    expect(Array.isArray(oursMod.inject)).toBe(true);
    expect([...oursMod.inject]).toEqual([...stockMod.inject]);
    expect([...oursMod.inject]).toEqual(["commands", "goals"]);
    expect(oursMod.inject).not.toBe(stockMod.inject);
    expect([...stockMod.inject]).toEqual(["commands", "goals"]);
  });

  test("artefact: 3 import runtime đúng bản gốc, KHÔNG tự đăng ký id @deepseek-ai", () => {
    const artifact = readFileSync(join(PKG, "lib", "index.js"), "utf8");
    const imports = artifact.split(String.fromCharCode(10)).filter((line) => line.startsWith("import "));
    expect(imports).toEqual([
      'import { CommandDefinitionId } from "@galaxy-blackhole/gbh-commands/brand";',
      'import { GoalError } from "@galaxy-blackhole/gbh-goal";',
      'import { createUserMessage } from "@deepseek-ai/dsh-llm";',
    ]);
    expect(artifact.includes("id: @deepseek-ai")).toBe(false);
  });
});

describe("B · apply đăng ký lệnh /goal trên ctx giả", () => {
  test("một định nghĩa DUY NHẤT: definitionId · name · description · input · 5 khoá · handler", async () => {
    const p = await pair((rig) => ({
      count: rig.commands.registered.length,
      commands: rig.commands.registered.map(surface),
      commandKeys: [...new Set(rig.commands.keys)],
      goalCalls: rig.goals.calls,
      llmKeys: rig.llmKeys,
      applyError: rig.applyError,
    }));
    const seen = valueOf(p.our) as {
      count: number;
      commands: Record<string, unknown>[];
      commandKeys: string[];
      goalCalls: GoalCall[];
      llmKeys: string[];
      applyError: string | null;
    };
    expect(seen.count).toBe(1);
    expect(seen.commands).toEqual([
      {
        definitionId: DEFINITION_ID,
        name: "goal",
        description: "Set or view the goal for a long-running task",
        input: { hint: "[<objective>|clear|edit <objective>|pause|resume]", attachments: true },
        keys: ["definitionId", "name", "description", "input", "handler"],
        handlerType: "function",
      },
    ]);
    expect(seen.commandKeys).toEqual(["register"]);
    expect(seen.goalCalls).toEqual([]);
    expect(seen.llmKeys).toEqual([]);
    expect(seen.applyError).toBeNull();
    expect(p.ours.commands.unregistered).toEqual([]);
  });

  test("apply HAI lần ⇒ HAI định nghĩa (không cổng chặn), disposer không tự gọi — y bản gốc", async () => {
    const run = (api: PluginApi): unknown => {
      const commands = makeCommands();
      const goals = makeGoals(undefined);
      const ctx = { commands: commands.service, goals: goals.service };
      api.apply(ctx);
      api.apply(ctx);
      return {
        registered: commands.registered.length,
        unregistered: commands.unregistered,
        keys: [...new Set(commands.keys)],
        goals: goals.calls,
      };
    };
    const p = await pair((rig) => run(rig.api));
    expect(valueOf(p.our)).toEqual({ registered: 2, unregistered: [], keys: ["register"], goals: [] });
  });

  test("ctx THIẾU commands ⇒ apply NÉM TypeError ở CẢ HAI bên, 0 lời gọi goals", async () => {
    const run = (api: PluginApi): unknown => {
      const goals = makeGoals(undefined);
      let error: string | null = null;
      try {
        api.apply({ goals: goals.service });
      } catch (caught) {
        error = errorShape(caught).name + "|" + errorShape(caught).message;
      }
      // PHASE B (ADR 000d): ta FAIL LOUD bằng thông điệp riêng ("requires the commands seam …") còn bản gốc ném
      // TypeError của JS ⇒ A/B so TÊN lớp lỗi (hợp đồng), không so câu chữ; số lời gọi goals vẫn phải bằng 0.
      return { errorName: error === null ? null : error.split("|")[0], calls: goals.calls };
    };
    const p = await pair((rig) => run(rig.api));
    const seen = valueOf(p.our) as { errorName: string | null; calls: GoalCall[] };
    expect(seen.errorName).toBe("TypeError");
    expect(seen.calls).toEqual([]);
  });
});

describe("C · các nhánh handler A/B", () => {
  test("show: chưa có goal ⇒ 'No goal is currently set.' + USAGE; chỉ gọi goals.get", async () => {
    const p = await pair((rig) => ({
      result: invoke(rig, ""),
      spaced: invoke(rig, "   "),
      calls: rig.goals.calls,
      followups: rig.followups.length,
    }));
    const seen = valueOf(p.our) as { result: CommandResult; spaced: CommandResult; calls: GoalCall[]; followups: number };
    const empty = "No goal is currently set." + String.fromCharCode(10) + USAGE;
    expect(seen.result).toEqual({ kind: "success", text: empty });
    expect(seen.spaced).toEqual(seen.result);
    expect(seen.calls.map((call) => call.method)).toEqual(["get", "get"]);
    expect(seen.followups).toBe(0);
  });

  test("show: 5 pha/activation render đủ Status · Rounds · Activation · Commands (kể cả Blocker)", async () => {
    const cases: GoalView[] = [
      goal(),
      goal({ activation: "disarmed" }),
      goal({ phase: "paused", activation: "disarmed" }),
      goal({ phase: "blocked", activation: "disarmed", blockedReason: { code: "waiting-on-review", message: "review pending" } }),
      goal({ phase: "complete", activation: "disarmed" }),
    ];
    for (const seed of cases) {
      const p = await pair((rig) => ({ result: invoke(rig, ""), calls: rig.goals.calls }), seed);
      const seen = valueOf(p.our) as { result: CommandResult; calls: GoalCall[] };
      expect(seen.result.kind).toBe("success");
      const text = seen.result.text ?? "";
      expect(text.startsWith("Goal" + String.fromCharCode(10) + "Status: " + String(seed.phase))).toBe(true);
      expect(text).toContain("Objective: " + seed.objective);
      expect(text).toContain("Rounds: " + String(seed.roundsStarted) + "/" + String(seed.maxGoalRounds));
      expect(text).toContain("Activation: " + seed.activation);
      expect(text).toContain("Commands: ");
      if (seed.phase === "blocked") expect(text).toContain("Blocker: waiting-on-review: review pending");
      if (seed.phase === "paused" || seed.phase === "blocked") expect(text).toContain("/goal resume");
      if (seed.phase === "complete") expect(text).toContain("Commands: /goal <objective>, /goal clear");
      if (seed.phase === "active" && seed.activation === "disarmed") expect(text).toContain("/goal resume");
      expect(seen.calls.map((call) => call.method)).toEqual(["get"]);
    }
  });

  test("create: chưa goal ⇒ goals.create; đang active ⇒ từ chối; complete ⇒ THAY THẾ được", async () => {
    const fresh = await pair((rig) => ({ result: invoke(rig, "build the thing"), calls: rig.goals.calls }));
    const created = valueOf(fresh.our) as { result: CommandResult; calls: GoalCall[] };
    expect(created.result.text ?? "").toContain("Goal created");
    expect(created.calls.map((call) => call.method)).toEqual(["get", "create"]);
    expect(created.calls[1]?.args[1]).toEqual({ objective: "build the thing" });

    const active = await pair((rig) => ({ result: invoke(rig, "replace it"), calls: rig.goals.calls }), goal());
    const refused = valueOf(active.our) as { result: CommandResult; calls: GoalCall[] };
    expect(refused.result).toEqual({
      kind: "error",
      text: "A goal is already active. Use /goal edit <objective> to change it or /goal clear before replacing it.",
    });
    expect(refused.calls.map((call) => call.method)).toEqual(["get"]);

    const complete = await pair(
      (rig) => ({ result: invoke(rig, "next goal"), calls: rig.goals.calls }),
      goal({ phase: "complete", activation: "disarmed" }),
    );
    const replaced = valueOf(complete.our) as { result: CommandResult; calls: GoalCall[] };
    expect(replaced.result.text ?? "").toContain("Goal created");
    expect(replaced.calls.map((call) => call.method)).toEqual(["get", "create"]);
  });

  test("edit: 'edit' trần ⇒ lỗi; chưa goal ⇒ missingGoal; active ⇒ goals.edit(ref); complete ⇒ goals.create", async () => {
    const bare = await pair((rig) => invoke(rig, "edit"));
    expect(valueOf(bare.our)).toEqual({
      kind: "error",
      text: "Goal editing requires a replacement objective." + String.fromCharCode(10) + USAGE,
    });

    const missing = await pair((rig) => invoke(rig, "edit next"), undefined);
    expect(valueOf(missing.our)).toEqual({
      kind: "error",
      text: "No goal is currently set; /goal edit requires one. " + USAGE,
    });

    const edited = await pair((rig) => ({ result: invoke(rig, "edit  new objective "), calls: rig.goals.calls }), goal());
    const seen = valueOf(edited.our) as { result: CommandResult; calls: GoalCall[] };
    expect(seen.calls.map((call) => call.method)).toEqual(["get", "edit"]);
    expect(seen.calls[1]?.args[1]).toEqual({ id: "goal-1", revision: 3 });
    expect(seen.calls[1]?.args[2]).toEqual({ objective: "new objective" });
    expect(seen.result.text ?? "").toContain("Goal updated");
    expect(seen.result.text ?? "").toContain("Objective: new objective");

    const complete = await pair(
      (rig) => ({ result: invoke(rig, "edit after complete"), calls: rig.goals.calls }),
      goal({ phase: "complete", activation: "disarmed" }),
    );
    const replaced = valueOf(complete.our) as { result: CommandResult; calls: GoalCall[] };
    expect(replaced.calls.map((call) => call.method)).toEqual(["get", "create"]);
    expect(replaced.result.text ?? "").toContain("Goal created");
  });

  test("pause · resume · clear: đúng phương thức + CAS ref; không goal ⇒ câu lỗi tương ứng", async () => {
    const p = await pair(
      (rig) => ({
        pause: invoke(rig, "pause"),
        resume: invoke(rig, "resume"),
        clear: invoke(rig, "clear"),
        clearAgain: invoke(rig, "clear"),
        calls: rig.goals.calls,
      }),
      goal(),
    );
    const seen = valueOf(p.our) as {
      pause: CommandResult;
      resume: CommandResult;
      clear: CommandResult;
      clearAgain: CommandResult;
      calls: GoalCall[];
    };
    expect(seen.calls.map((call) => call.method)).toEqual(["get", "pause", "get", "resume", "get", "clear", "get"]);
    expect(seen.calls[1]?.args[1]).toEqual({ id: "goal-1", revision: 3 });
    expect(seen.calls[3]?.args[1]).toEqual({ id: "goal-1", revision: 4 });
    expect(seen.calls[5]?.args[1]).toEqual({ id: "goal-1", revision: 5 });
    expect(seen.pause.text ?? "").toContain("Goal paused");
    expect(seen.resume.text ?? "").toContain("Goal resumed");
    expect(seen.clear).toEqual({ kind: "success", text: "Goal cleared." });
    expect(seen.clearAgain).toEqual({ kind: "success", text: "No goal to clear." });

    const missing = await pair((rig) => ({
      pause: invoke(rig, "pause"),
      resume: invoke(rig, "resume"),
      calls: rig.goals.calls,
    }));
    const none = valueOf(missing.our) as { pause: CommandResult; resume: CommandResult; calls: GoalCall[] };
    expect(none.pause).toEqual({ kind: "error", text: "No goal is currently set; /goal pause requires one. " + USAGE });
    expect(none.resume).toEqual({ kind: "error", text: "No goal is currently set; /goal resume requires one. " + USAGE });
    expect(none.calls.map((call) => call.method)).toEqual(["get", "get"]);
  });

  test("ngữ pháp: trắng ⇒ show · 'CLEAR' ⇒ clear · 'Edit x'/tab ⇒ edit · 'editing x'/'clear now' ⇒ create", async () => {
    const p = await pair(
      (rig) => ({
        blank: invoke(rig, "   "),
        bareEdit: invoke(rig, "edit"),
        editCase: invoke(rig, "Edit  new objective "),
        editTab: invoke(rig, "EDIT" + String.fromCharCode(9) + "x"),
        editing: invoke(rig, "editing stuff"),
        clearNow: invoke(rig, "clear now"),
        upperPause: invoke(rig, "PaUsE"),
        upperResume: invoke(rig, "RESUME"),
        upperClear: invoke(rig, "CLEAR"),
        afterClear: invoke(rig, "clear"),
        calls: rig.goals.calls,
      }),
      goal(),
    );
    const seen = valueOf(p.our) as Record<string, CommandResult | GoalCall[]> & { calls: GoalCall[] };
    expect(((seen.bareEdit as CommandResult).text ?? "")).toContain("Goal editing requires a replacement objective.");
    expect(((seen.editCase as CommandResult).text ?? "")).toContain("Goal updated");
    expect(((seen.editTab as CommandResult).text ?? "")).toContain("Objective: x");
    expect(((seen.editing as CommandResult).text ?? "")).toContain("A goal is already active.");
    expect(((seen.clearNow as CommandResult).text ?? "")).toContain("A goal is already active.");
    expect(((seen.upperPause as CommandResult).text ?? "")).toContain("Goal paused");
    expect(((seen.upperResume as CommandResult).text ?? "")).toContain("Goal resumed");
    expect(seen.upperClear).toEqual({ kind: "success", text: "Goal cleared." });
    expect(seen.afterClear).toEqual({ kind: "success", text: "No goal to clear." });
    expect(((seen.blank as CommandResult).text ?? "").startsWith("Goal" + String.fromCharCode(10) + "Status: active")).toBe(true);
    expect(seen.calls.map((call) => call.method)).toEqual(["get", "get", "get", "edit", "get", "edit", "get", "get", "get", "pause", "get", "resume", "get", "clear", "get"]);
  });

  test("attachments: CHỈ create/edit nhận; create ⇒ followup MỘT tin nhắn user, attachment TRƯỚC câu vai trò", async () => {
    const attachment = { type: "file", attachment: { id: "att-1", name: "notes.txt", bytes: 5 } };
    const p = await pair((rig) => ({
      result: invoke(rig, "build", [attachment]),
      followups: rig.followups.map(messageShape),
      count: rig.followups.length,
      frozen: rig.followups.map((message) => Object.isFrozen(message)),
      hasId: rig.followups.map((message) => typeof (message as { id?: unknown }).id === "string"),
      calls: rig.goals.calls,
    }));
    const seen = valueOf(p.our) as {
      result: CommandResult;
      followups: unknown[];
      count: number;
      frozen: boolean[];
      hasId: boolean[];
      calls: GoalCall[];
    };
    expect(seen.count).toBe(1);
    expect(seen.followups).toEqual([
      {
        role: "user",
        source: { kind: "user" },
        content: [attachment, { type: "text", text: "Reference attachments for the goal objective." }],
      },
    ]);
    expect(seen.frozen).toEqual([true]);
    expect(seen.hasId).toEqual([true]);
    expect(seen.calls.map((call) => call.method)).toEqual(["get", "create"]);
    expect(seen.result.text ?? "").toContain("Goal created");

    const rejected = await pair(
      (rig) => ({
        result: invoke(rig, "pause", [attachment]),
        followups: rig.followups.length,
        calls: rig.goals.calls,
      }),
      goal(),
    );
    const no = valueOf(rejected.our) as { result: CommandResult; followups: number; calls: GoalCall[] };
    expect(no.result).toEqual({
      kind: "error",
      text: "Attachments only accompany a goal objective: /goal <objective> or /goal edit <objective>.",
    });
    expect(no.followups).toBe(0);
    expect(no.calls).toEqual([]);

    const edit = await pair(
      (rig) => ({
        result: invoke(rig, "edit attached", [attachment]),
        followups: rig.followups.length,
      }),
      goal(),
    );
    const yes = valueOf(edit.our) as { result: CommandResult; followups: number };
    expect(yes.followups).toBe(1);
    expect(yes.result.text ?? "").toContain("Goal updated");
  });

  test("GoalError của miền goal ⇒ câu lỗi ổn định; lỗi KHÁC ⇒ NÉM NGUYÊN VĂN", async () => {
    const domainFailure = await pair((rig) => invoke(rig, ""), goal(), (isOurs) => ({
      method: "get",
      error: new (isOurs ? GoalErrorCtor : StockGoalErrorCtor)("nope", "GOAL_INVALID_TRANSITION"),
    }));
    expect(valueOf(domainFailure.our)).toEqual({
      kind: "error",
      text: "The goal command is not valid for the current state. Run /goal to view available commands.",
    });

    const pauseFailure = await pair((rig) => invoke(rig, "pause"), goal(), (isOurs) => ({
      method: "pause",
      error: new (isOurs ? GoalErrorCtor : StockGoalErrorCtor)("stale", "GOAL_STALE_REVISION"),
    }));
    expect(valueOf(pauseFailure.our)).toEqual({
      kind: "error",
      text: "The goal command is not valid for the current state. Run /goal to view available commands.",
    });

    const foreign = await pair((rig) => invoke(rig, "build"), undefined, {
      method: "create",
      error: new TypeError("boom"),
    });
    const thrown = foreign.our as Attempt;
    expect(thrown.ok).toBe(false);
    if (!thrown.ok) {
      expect(thrown.error.name).toBe("TypeError");
      expect(thrown.error.message).toBe("boom");
    }
  });

  test("goal blocked THIẾU reason ⇒ TypeError 'blocked goal is missing its reason' ở CẢ HAI bên", async () => {
    const p = await pair((rig) => invoke(rig, ""), goal({ phase: "blocked", activation: "disarmed" }));
    const thrown = p.our as Attempt;
    expect(thrown.ok).toBe(false);
    if (!thrown.ok) {
      expect(thrown.error.name).toBe("TypeError");
      expect(thrown.error.message).toBe("blocked goal is missing its reason");
    }
  });
});

