/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Giàn test dùng chung cho @galaxy-blackhole/gbh-plan-mode: nạp CẢ bản ta lẫn bundle gốc,
 *      dựng Context cordis THẬT với seam giả (tools/systemPrompt/sessionProjections/commands/
 *      userQuestions), chạy waterfall/lệnh/công cụ, và cung cấp phép so sâu A/B — không mạng.
 */

import { expect } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Gốc repo (file này nằm ở tests/host). */
export const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
export const PKG = join(REPO, "packages", "host", "plan-mode");
/** node_modules của kernel — nơi cả hai bản phân giải peer. */
export const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Bundle GỐC (CHỈ ĐỌC) — oracle. */
export const STOCK = join(APP_MODULES, "@deepseek-ai", "dsh-plan-mode", "lib", "index.js");
/** Thư mục gói gốc (đọc package.json). */
export const STOCK_DIR = join(APP_MODULES, "@deepseek-ai", "dsh-plan-mode");
/** cordis dùng chung cho cả hai bản. */
const CORDIS = join(APP_MODULES, "@deepseek-ai", "cordis", "lib", "index.js");
/** Lớp lỗi user-questions dùng chung cho nhánh ASK_CANCELLED. */
const USER_QUESTIONS = join(APP_MODULES, "@deepseek-ai", "dsh-user-questions", "lib", "index.js");
/** Thư mục artifact tạm; dọn ở afterAll. */
export const OUT = mkdtempSync(join(tmpdir(), "gbh-plan-mode-ab-"));
/** Bundle gốc nạp trong beforeAll. */
let stockMod: Module;
/** Bản của ta nạp từ artifact đã build. */
let oursMod: Module;
/** Lớp Context cordis của kernel. */
let ContextCtor: new () => any;
/** Lớp UserQuestionError của kernel. */
let UserQuestionErrorCtor: new (message: string, code: string) => Error;

/** Bản ghi JSON thô dùng trong fixture. */
export type Obj = Record<string, any>;
/** Kết quả chạy một phép (thành công hoặc ném). */
export type Attempt = { ok: true; value: unknown } | { ok: false; failure: Obj };
/** Bề mặt export của cả hai bundle. */
export interface Module {
  /** Tên công cụ thoát. */
  EXIT_PLAN_MODE: string;
  /** Lớp service (kèm static inject). */
  PlanModeController: (new (ctx: any, config?: any) => any) & { inject: string[] };
  /** Export mặc định. */
  default: unknown;
  /** Định nghĩa chiếu plan. */
  planProjectionDefinition: Obj;
  /** Kiểm tra cấu hình. */
  resolveConfig(config: any): { section: string };
}
/** Trạng thái chiếu plan mà fixture trả về. */
interface PlanState {
  active: boolean;
  wanted: boolean | null;
  running: { commandId: string; wanted: boolean } | null;
  activeAtLastHeader: boolean | null;
}
/** Cờ điều khiển seam của fixture. */
interface Flags {
  planProjection: boolean;
  turnProjection: boolean;
  turnOpen: boolean;
}
/** Tuỳ chọn mount. */
export interface MountOptions {
  config?: Obj;
  active?: boolean;
  wanted?: boolean | null;
  running?: { commandId: string; wanted: boolean } | null;
  activeAtLastHeader?: boolean | null;
  turnOpen?: boolean;
  planProjection?: boolean;
  turnProjection?: boolean;
  userQuestions?: false | ((request: Obj) => Promise<Obj>);
}
/** Một bản cài trên Context cordis THẬT. */
export interface Installed {
  ctx: any;
  fiber: any;
  service: any;
  sections: Obj[];
  projections: Obj[];
  tools: Obj[];
  commands: Obj[];
  orders: string[];
  appends: Array<{ type: string; data: Obj }>;
  injected: Obj[];
  steered: Obj[];
  asked: Obj[];
  concluded: number;
  state: PlanState;
  flags: Flags;
  agent: Obj;
}

/**
 * Băm SHA-256 một chuỗi UTF-8.
 *
 * Nhận: value — chuỗi cần băm.
 * Trả: chuỗi hex 64 ký tự.
 *
 * @param value Chuỗi cần băm.
 * @returns Digest SHA-256 dạng hex.
 */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Hình dạng lỗi sâu: name/message/code, không so stack. */
function failureOf(error: unknown): Obj {
  const value = error as any;
  return {
    name: String(value?.name),
    message: String(value?.message),
    ...(value?.code === undefined ? {} : { code: value.code }),
  };
}

/**
 * Chạy một phép, bắt cả ném đồng bộ lẫn promise bị từ chối.
 *
 * Nhận: run — callback cần chạy.
 * Trả: Attempt thành công hoặc hình dạng lỗi đã chuẩn hoá.
 *
 * @param run Callback cần chạy.
 * @returns Kết quả thành công hoặc thất bại đã chuẩn hoá.
 */
export async function attempt(run: () => unknown | Promise<unknown>): Promise<Attempt> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, failure: failureOf(error) };
  }
}

/** UUID của message tự sinh — thay bằng nhãn để so A/B. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chuẩn hoá một giá trị thành JSON so được A/B. */
function normalize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, item) => {
      if (key === "id" && typeof item === "string" && UUID.test(item)) return "<message-id>";
      return item;
    }),
  );
}

/** Chạy CẢ stock lẫn ours trên cùng callback rồi so sâu kết quả. */
export async function same<T>(run: (mod: Module) => unknown | Promise<unknown>): Promise<{ stock: T; ours: T }> {
  const stock = (await run(stockMod)) as T;
  const ours = (await run(oursMod)) as T;
  expect(normalize(ours)).toEqual(normalize(stock));
  return { stock, ours };
}

/** Chạy CẢ hai bản, bắt lỗi, rồi so hình dạng thành công/thất bại. */
export async function sameAttempt(run: (mod: Module) => unknown | Promise<unknown>): Promise<{ stock: Attempt; ours: Attempt }> {
  const stock = await attempt(() => run(stockMod));
  const ours = await attempt(() => run(oursMod));
  expect(normalize(ours)).toEqual(normalize(stock));
  return { stock, ours };
}

/** Đòi kết quả thành công và trả giá trị. */
function valueOf<T = Obj>(result: Attempt): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected success");
  return result.value as T;
}

/**
 * Dựng MỘT bản cài trên Context cordis THẬT với seam giả.
 *
 * Nhận: mod — bề mặt module (ta hoặc stock); options — cấu hình và trạng thái fixture.
 * Trả: Installed — context, fiber, service, mọi seam đã bắt và agent giả.
 *
 * @param mod Bề mặt module cần mount.
 * @param options Cấu hình và trạng thái fixture.
 * @returns Bản cài đã sẵn sàng.
 */
export async function mount(mod: Module, options: MountOptions = {}): Promise<Installed> {
  const ctx = new ContextCtor();
  const flags: Flags = {
    planProjection: options.planProjection ?? true,
    turnProjection: options.turnProjection ?? true,
    turnOpen: options.turnOpen ?? false,
  };
  const state: PlanState = {
    active: options.active ?? false,
    wanted: options.wanted ?? null,
    running: options.running ?? null,
    activeAtLastHeader: options.activeAtLastHeader ?? null,
  };
  const installed = {
    ctx,
    fiber: undefined,
    service: undefined,
    sections: [],
    projections: [],
    tools: [],
    commands: [],
    orders: [],
    appends: [],
    injected: [],
    steered: [],
    asked: [],
    concluded: 0,
    state,
    flags,
    agent: undefined,
  } as unknown as Installed;
  const session = {
    id: "session-1",
    append(type: string, data: Obj) {
      installed.appends.push({ type, data: JSON.parse(JSON.stringify(data)) });
      if (type === "plan/mode") {
        installed.state.active = data.active as boolean;
        installed.state.wanted = null;
      }
      return { type, seq: installed.appends.length - 1, time: 0, data };
    },
  };
  installed.agent = {
    session,
    inject(message: Obj) {
      installed.injected.push(message);
    },
    steer(message: Obj) {
      installed.steered.push(message);
    },
  };
  ctx.provide("tools", {
    register(tool: Obj) {
      installed.tools.push(tool);
      return () => undefined;
    },
  });
  ctx.provide("systemPrompt", {
    getSectionOrder(name: string) {
      installed.orders.push(name);
      return 500;
    },
    section(definition: Obj) {
      installed.sections.push(definition);
      return () => undefined;
    },
  });
  ctx.provide("sessionProjections", {
    register(definition: Obj) {
      installed.projections.push(definition);
      return () => undefined;
    },
    stateOf(_session: Obj, key: string) {
      if (key === "plan") return flags.planProjection ? installed.state : undefined;
      if (key === "turnBoundary") {
        return flags.turnProjection ? { openTurnStartSeq: flags.turnOpen ? 1 : null } : undefined;
      }
      return undefined;
    },
  });
  ctx.provide("commands", {
    register(definition: Obj) {
      installed.commands.push(definition);
      return () => undefined;
    },
  });
  if (options.userQuestions !== false) {
    ctx.provide("userQuestions", {
      ask(request: Obj) {
        installed.asked.push(request);
        const answerer = options.userQuestions;
        if (typeof answerer === "function") return answerer(request);
        return Promise.resolve({ answers: [{ id: "plan-review", selected: ["Approve"] }] });
      },
    });
  }
  const fiber = ctx.plugin(mod.PlanModeController, options.config ?? { section: "POLICY" });
  await fiber;
  installed.fiber = fiber;
  installed.service = ctx.get("planMode");
  return installed;
}

/** Mount, chạy callback, rồi dọn fiber. */
async function withMount<T>(
  mod: Module,
  options: MountOptions,
  run: (installed: Installed) => unknown | Promise<unknown>,
): Promise<T> {
  const installed = await mount(mod, options);
  try {
    return (await run(installed)) as T;
  } finally {
    await installed.fiber.dispose();
  }
}

/**
 * Chạy waterfall pre-step của Context thật.
 *
 * Nhận: installed — bản cài; options — quyết định kế tiếp, cờ huỷ, lỗi next.
 * Trả: quyết định sau khi listener của row chạy.
 *
 * @param installed Bản cài cần chạy.
 * @param options Quyết định/cờ huỷ/lỗi của next.
 * @returns Quyết định pre-step cuối cùng.
 */
export async function runWaterfall(
  installed: Installed,
  options: { decision?: Obj; aborted?: boolean; nextError?: unknown } = {},
): Promise<Obj> {
  const controller = new AbortController();
  if (options.aborted === true) controller.abort();
  const decision = options.decision ?? { kind: "enter", messages: [] };
  return installed.ctx.waterfall(
    "agent/pre-step",
    {
      agent: installed.agent,
      messages: [],
      turn: 1,
      step: 1,
      signal: controller.signal,
    },
    async () => {
      if (options.nextError !== undefined) throw options.nextError;
      return structuredClone(decision);
    },
  );
}

/** Text của section plan:policy với một context lắp prompt. */
export function sectionText(installed: Installed, withAgent = true): string {
  return installed.sections[0]!.text(withAgent ? { agent: installed.agent } : {}) as string;
}

/**
 * Gọi handler của lệnh /plan.
 *
 * Nhận: installed — bản cài; rawInput — text sau tên lệnh; attachments — block đính kèm.
 * Trả: CommandResult do handler trả về.
 *
 * @param installed Bản cài cần gọi.
 * @param rawInput Text sau tên lệnh.
 * @param attachments Block đính kèm (rỗng mặc định).
 * @returns Kết quả lệnh.
 */
export async function runCommand(installed: Installed, rawInput: string, attachments: Obj[] = []): Promise<Obj> {
  return installed.commands[0]!.handler({
    commandId: "command-1",
    agent: installed.agent,
    rawInput,
    attachments,
    signal: new AbortController().signal,
  });
}

/**
 * Gọi execute của công cụ exit_plan_mode.
 *
 * Nhận: installed — bản cài; args — tham số model; options — bỏ agent khi cần.
 * Trả: giá trị canonical do công cụ trả về.
 *
 * @param installed Bản cài cần gọi.
 * @param args Tham số model.
 * @param options Tuỳ chọn chạy (noAgent).
 * @returns Giá trị canonical của công cụ.
 */
export async function runTool(
  installed: Installed,
  args: Obj,
  options: { noAgent?: boolean } = {},
): Promise<Obj> {
  return installed.tools[0]!.execute(args, {
    callId: "call-1",
    agent: options.noAgent === true ? undefined : installed.agent,
    signal: new AbortController().signal,
    concludeTurn() {
      installed.concluded += 1;
    },
    deferContext() {},
  });
}

/**
 * Nạp cả hai bản: build gói ta vào OUT, symlink node_modules của kernel, rồi import
 * bundle gốc và artifact của ta — kèm Context cordis và lớp UserQuestionError.
 *
 * Nhận: không.
 * Trả: Promise hoàn tất khi cả hai bản sẵn sàng.
 */
export async function loadSides(): Promise<void> {
  const build = (await import(join(PKG, "build.ts"))) as {
    buildPackage(outDir?: string): Promise<{ service: string }>;
  };
  const built = await build.buildPackage(OUT);
  symlinkSync(APP_MODULES, join(OUT, "node_modules"), "dir");
  stockMod = (await import(STOCK)) as Module;
  oursMod = (await import(pathToFileURL(built.service).href)) as Module;
  ContextCtor = ((await import(CORDIS)) as { Context: new () => any }).Context;
  UserQuestionErrorCtor = (
    (await import(USER_QUESTIONS)) as { UserQuestionError: new (message: string, code: string) => Error }
  ).UserQuestionError;
}

/**
 * Dọn thư mục artifact tạm của lượt test.
 *
 * Nhận: không.
 * Trả: không.
 */
export function cleanupSides(): void {
  rmSync(OUT, { recursive: true, force: true });
}

/**
 * Tạo một UserQuestionError của kernel để thử nhánh ASK_CANCELLED/khác.
 *
 * Nhận: message — thông điệp; code — mã lỗi.
 * Trả: thể hiện Error đúng lớp của kernel.
 */
export function userQuestionError(message: string, code: string): Error {
  return new UserQuestionErrorCtor(message, code);
}
