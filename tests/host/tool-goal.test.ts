/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-tool-goal: đo trên ARTIFACT đã build và so TỪNG hành vi
 *      với CHÍNH bundle gốc của DSH trên cùng fixture giả — bề mặt export · inject · đăng ký tool
 *      (tên/schema/presentCall) · hành vi 2–3 nhánh mỗi tool · kiểm quyền · wrapup · metadata row.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { buildPackage } from "../../packages/host/tool-goal/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "tool-goal");
/** Gói GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-goal");
/** Bundle gốc. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để "packages: external" phân giải được peer. */
const OUT = join(PKG, ".test-lib");

/** Artifact của TA, build ngay khi nạp test. */
const ARTIFACT_FILE: string = await buildPackage(OUT);
/** Module artifact của ta. */
const Ours: any = await import(ARTIFACT_FILE);
/** Module bundle GỐC. */
const Stock: any = await import(STOCK);

/** Một goal giả trong "miền goal" của fixture. */
interface FakeGoal {
  /** Id ổn định. */
  id: string;
  /** Revision dương. */
  revision: number;
  /** Mục tiêu người dùng. */
  objective: string;
  /** Pha bền. */
  phase: string;
  /** Số vòng đã chấp nhận. */
  roundsStarted: number;
  /** Trần vòng. */
  maxGoalRounds: number;
  /** Kích hoạt tiến trình (process-local). */
  activation: "armed" | "disarmed";
  /** Lý do blocked, chỉ khi phase = blocked. */
  blockedReason?: { code: string; message: string };
}

/** Tuỳ chọn dựng một "thế giới" giả. */
interface WorldOptions {
  /** Goal hiện tại (bỏ trống ⇒ chưa có goal). */
  goal?: FakeGoal;
  /** Sự kiện phiên tại thời điểm gọi. */
  events?: any[];
  /** Ranh giới lượt: số seq mở, "missing" (thiếu projection) hoặc "closed" (giữa hai lượt). */
  openTurn?: number | "missing" | "closed";
  /** false ⇒ ctx.agents.get trả THỂ HIỆN KHÁC (agent không còn sống). */
  live?: boolean;
  /** false ⇒ agent.status = "idle". */
  running?: boolean;
  /** false ⇒ agent KHÔNG nằm trong roots(). */
  root?: boolean;
  /** false ⇒ currentInitiator() trả undefined. */
  initiator?: boolean;
  /** Cấu hình truyền cho apply. */
  config?: any;
}

/** Một "thế giới" giả dùng chung cho cả hai bản cài. */
interface World {
  /** Context giả. */
  ctx: any;
  /** Agent gọi. */
  agent: any;
  /** Tool đã đăng ký, theo thứ tự. */
  registered: any[];
  /** Mục system prompt đã đăng ký. */
  sections: any[];
  /** Vết lời gọi miền goal (đã chuẩn hoá). */
  goalCalls: any[];
}

/**
 * Dựng một goal giả với các trường mặc định.
 * Nhận: overrides — các trường cần đè.
 * Trả: goal đầy đủ (id "goal-1", revision 1, 3 vòng, active).
 */
function goal(overrides: Partial<FakeGoal> = {}): FakeGoal {
  return {
    id: "goal-1",
    revision: 1,
    objective: "Viết lại row tool-goal",
    phase: "active",
    roundsStarted: 3,
    maxGoalRounds: 20,
    activation: "armed",
    ...overrides,
  };
}

/** Sự kiện mở lượt. */
const TURN_START = { type: "turn/start", data: { turn: 1 } };

/** Tin nhắn người thật. */
const HUMAN = { type: "user/message", data: { source: { kind: "user" }, content: [] } };

/**
 * Tin nhắn vòng goal do runtime chấp nhận.
 * Nhận: goalId — id goal; revision — revision; round — số vòng.
 * Trả: sự kiện user/message nguồn "goal".
 */
function goalRound(goalId: string, revision: number, round: number): any {
  return { type: "user/message", data: { source: { kind: "goal", goalId, revision, round }, content: [] } };
}

/**
 * Dựng miền goal giả ghi vết — ĐÚNG các phương thức mà bundle gốc gọi.
 * Nhận: calls — mảng vết; initial — goal ban đầu (nếu có).
 * Trả: service giả có get/create/edit/pause/resume/complete/block.
 */
function fakeGoals(calls: any[], initial?: FakeGoal): any {
  let current: FakeGoal | undefined = initial === undefined ? undefined : { ...initial };
  return {
    get(agent: any) {
      calls.push({ method: "get", agent: agent?.id });
      return current;
    },
    create(agent: any, request: any) {
      calls.push({ method: "create", agent: agent?.id, request });
      current = goal({ id: "goal-1", revision: 1, objective: request.objective, maxGoalRounds: request.maxGoalRounds ?? 20, roundsStarted: 0, phase: "active", activation: "armed" });
      return current;
    },
    edit(agent: any, ref: any, request: any) {
      calls.push({ method: "edit", agent: agent?.id, ref, request });
      current = { ...(current as FakeGoal), ...request, revision: ref.revision + 1 };
      return current;
    },
    pause(agent: any, ref: any) {
      calls.push({ method: "pause", agent: agent?.id, ref });
      current = { ...(current as FakeGoal), phase: "paused", activation: "disarmed", revision: ref.revision + 1 };
      return current;
    },
    resume(agent: any, ref: any) {
      calls.push({ method: "resume", agent: agent?.id, ref });
      current = { ...(current as FakeGoal), phase: "active", activation: "armed", revision: ref.revision + 1 };
      return current;
    },
    complete(agent: any, ref: any) {
      calls.push({ method: "complete", agent: agent?.id, ref });
      current = { ...(current as FakeGoal), phase: "complete", activation: "disarmed", revision: ref.revision + 1 };
      return current;
    },
    block(agent: any, ref: any, reason: any) {
      calls.push({ method: "block", agent: agent?.id, ref, reason });
      current = { ...(current as FakeGoal), phase: "blocked", activation: "disarmed", blockedReason: { code: reason.code, message: reason.message }, revision: ref.revision + 1 };
      return current;
    },
  };
}

/**
 * Dựng một "thế giới" giả đúng hình dạng mà HAI bundle cần.
 * Nhận: options — goal, sự kiện, ranh giới lượt và các cờ sống/chạy/gốc/initiator.
 * Trả: context giả + agent + hai sổ ghi (tool, prompt) + vết miền goal.
 */
function makeWorld(options: WorldOptions = {}): World {
  const events = options.events ?? [];
  const session = { id: "s1", snapshotEvents: () => events };
  const agent: any = { id: "s1", status: options.running === false ? "idle" : "running", session };
  const registered: any[] = [];
  const sections: any[] = [];
  const goalCalls: any[] = [];
  const ctx = {
    systemPrompt: {
      getSectionOrder(name: string) {
        return name === "TOOL_GOAL" ? 2400 : 0;
      },
      section(section: any) {
        sections.push(section);
        return () => {};
      },
    },
    tools: {
      register(definition: any) {
        registered.push(definition);
        return () => {};
      },
    },
    agents: {
      get(id: string) {
        return options.live === false ? { id, status: "running", session } : agent;
      },
      currentInitiator() {
        return options.initiator === false ? undefined : agent;
      },
      roots() {
        return options.root === false ? [] : [agent];
      },
    },
    sessionProjections: {
      stateOf(_session: any, key: string) {
        if (key !== "turnBoundary") return undefined;
        if (options.openTurn === "missing") return undefined;
        if (options.openTurn === "closed") {
          return { openTurnStartSeq: null, lastStepStartSeq: null, lastStepBoundary: null, lastTurn: 0 };
        }
        return { openTurnStartSeq: options.openTurn ?? 0, lastStepStartSeq: null, lastStepBoundary: null, lastTurn: 1 };
      },
    },
    goals: fakeGoals(goalCalls, options.goal),
  };
  return { ctx, agent, registered, sections, goalCalls };
}

/**
 * Boot một plugin trên một thế giới giả.
 * Nhận: plugin — module (ta hoặc gốc); options — tuỳ chọn thế giới.
 * Trả: thế giới đã có tool + prompt đã đăng ký.
 * Ném: lỗi của apply khi cấu hình hỏng (để test so hai bản).
 */
function boot(plugin: any, options: WorldOptions = {}): World {
  const world = makeWorld(options);
  plugin.apply(world.ctx, options.config ?? {});
  return world;
}

/**
 * Dựng exec tối thiểu (đúng các trường mà execute đọc) và bộ gom context hoãn.
 * Nhận: agent — agent gọi (có thể undefined để mô phỏng lời gọi không agent).
 * Trả: exec + mảng context đã defer.
 */
function makeExec(agent: any): { exec: any; deferred: any[] } {
  const deferred: any[] = [];
  return {
    deferred,
    exec: {
      callId: "call-1",
      name: "goal",
      arguments: {},
      agent,
      signal: new AbortController().signal,
      deferContext(context: any) {
        deferred.push(context);
      },
      concludeTurn() {},
    },
  };
}

/**
 * Chạy một lượt gọi và bắt gọn kết quả/lỗi để so A/B.
 * Nhận: run — hàm có thể ném hoặc trả Promise.
 * Trả: { ok, value } hoặc { ok: false, name, message, code }.
 */
async function outcome(run: () => Promise<unknown>): Promise<any> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    const failure = error as any;
    return { ok: false, name: failure.name, message: failure.message, code: failure.code };
  }
}

/**
 * Gọi một tool trong một thế giới.
 * Nhận: world — thế giới đã boot; toolName — tên tool; args — tham số; agent — agent gọi.
 * Trả: { result, deferred } — kết quả/lỗi và các context bị hoãn.
 */
async function callTool(world: World, toolName: string, args: any, agent: any): Promise<any> {
  const tool = world.registered.find((candidate) => candidate.name === toolName);
  const { exec, deferred } = makeExec(agent);
  const result = await outcome(() => tool.execute(args, exec));
  return { result, deferred };
}

/**
 * Lấy một tool theo tên (không ném khi thiếu — test tự khẳng định).
 * Nhận: world — thế giới đã boot; toolName — tên tool.
 * Trả: định nghĩa tool hoặc undefined.
 */
function toolOf(world: World, toolName: string): any {
  return world.registered.find((candidate) => candidate.name === toolName);
}

/**
 * Phần tử có trong danh sách peer khai báo mà KHÔNG có trong peerDependencies.
 * So PHẦN TỬ, không so số lượng.
 * Nhận: peers — danh sách khai; peerDependencies — tên trong manifest.
 * Trả: các tên thiếu.
 */
function missingPeers(peers: readonly string[], peerDependencies: readonly string[]): string[] {
  const declared = new Set(peerDependencies);
  return peers.filter((peer) => !declared.has(peer));
}

/**
 * Bóc phần SO SÁNH ĐƯỢC của một message (bỏ id ngẫu nhiên do createUserMessage sinh).
 * Nhận: message — tin nhắn người dùng đã hoãn.
 * Trả: { role, content, source } — đúng phần hành vi mà hai bản phải trùng.
 */
function messageShape(message: any): any {
  return { role: message.role, content: message.content, source: message.source };
}

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("tool-goal — artifact và bề mặt export", () => {
  test("ARTIFACT: tập export của ta = tập export của bản gốc, 0 id module (row MỘT MẶT)", async () => {
    const code = await readFile(ARTIFACT_FILE, "utf8");
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    expect(code.includes("__ModuleLoader__")).toBe(false);
    expect(Object.keys(Ours).sort()).toEqual(Object.keys(Stock).sort());
    expect(Object.keys(Ours).sort()).toEqual(["Config", "apply", "inject", "name"]);
    expect(Ours.name).toBe(Stock.name);
    expect(Ours.name).toBe("tool-goal");
    expect(Ours.apply.length).toBe(Stock.apply.length);
    expect(Ours.apply.length).toBe(2);
    expect([...Ours.inject]).toEqual([...Stock.inject]);
    expect([...Ours.inject]).toEqual(["agents", "goals", "tools", "systemPrompt", "sessionProjections"]);
    expect(typeof Ours.apply).toBe("function");
    // Cả hai boot đều đăng ký ĐÚNG BA tool, cùng thứ tự và cùng tên.
    const ourNames = boot(Ours).registered.map((tool) => tool.name);
    const stockNames = boot(Stock).registered.map((tool) => tool.name);
    expect(ourNames).toEqual(stockNames);
    expect(ourNames).toEqual(["get_goal", "create_goal", "update_goal"]);
  });

  test("inject + Config: deep-equal với bản gốc; schemastery chuẩn hoá y hệt", () => {
    expect(JSON.stringify(Ours.inject)).toBe(JSON.stringify(Stock.inject));
    expect(String(Ours.Config)).toBe(String(Stock.Config));
    expect(Ours.Config({})).toEqual(Stock.Config({}));
    expect(Ours.Config({})).toEqual({ blockedAfterConsecutiveRounds: 3 });
    expect(Ours.Config({ blockedAfterConsecutiveRounds: 5 })).toEqual(Stock.Config({ blockedAfterConsecutiveRounds: 5 }));
    expect(Ours.Config({ blockedAfterConsecutiveRounds: 5 })).toEqual({ blockedAfterConsecutiveRounds: 5 });
  });

  test("mục system prompt 'tool:goal': tên · order · văn bản khớp TỪNG KÝ TỰ", () => {
    const ourWorld = boot(Ours);
    const stockWorld = boot(Stock);
    expect(ourWorld.sections).toEqual(stockWorld.sections);
    expect(ourWorld.sections.length).toBe(1);
    const section = ourWorld.sections[0];
    expect(section.name).toBe("tool:goal");
    expect(section.order).toBe(2400);
    expect(section.text).toContain("at least 3 consecutive goal rounds");
    // Ngưỡng khác đi vào CÙNG một câu, cùng vị trí.
    const custom = boot(Ours, { config: { blockedAfterConsecutiveRounds: 7 } });
    const customStock = boot(Stock, { config: { blockedAfterConsecutiveRounds: 7 } });
    expect(custom.sections).toEqual(customStock.sections);
    expect(custom.sections[0].text).toContain("at least 7 consecutive goal rounds");
  });

  test("cấu hình hỏng: NÉM cùng lớp + cùng thông điệp, và KHÔNG đăng ký gì", () => {
    for (const config of [{ blockedAfterConsecutiveRounds: 0 }, { blockedAfterConsecutiveRounds: 1.5 }, { blockedAfterConsecutiveRounds: -2 }]) {
      let ourError: any;
      let stockError: any;
      let ourWorld: World | undefined;
      let stockWorld: World | undefined;
      try { ourWorld = boot(Ours, { config }); } catch (error) { ourError = error; }
      try { stockWorld = boot(Stock, { config }); } catch (error) { stockError = error; }
      expect(ourError?.name).toBe(stockError?.name);
      expect(ourError?.message).toBe(stockError?.message);
      expect(ourError?.message).toBe("blockedAfterConsecutiveRounds must be a positive safe integer");
      expect(ourWorld).toBeUndefined();
      expect(stockWorld).toBeUndefined();
    }
  });
});

describe("tool-goal — đăng ký tool: tên · schema · presentCall", () => {
  test("ba tool: tên · mô tả · schema tham số · schema kết quả KHỚP gốc", () => {
    const ourWorld = boot(Ours);
    const stockWorld = boot(Stock);
    for (const name of ["get_goal", "create_goal", "update_goal"]) {
      const ours = toolOf(ourWorld, name);
      const stock = toolOf(stockWorld, name);
      expect(ours).toBeDefined();
      expect(stock).toBeDefined();
      expect(ours.name).toBe(stock.name);
      expect(ours.description).toBe(stock.description);
      expect(JSON.stringify(ours.parameters)).toBe(JSON.stringify(stock.parameters));
      expect(JSON.stringify(ours.output.schema)).toBe(JSON.stringify(stock.output.schema));
      expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
      expect(Object.keys(ours.output).sort()).toEqual(Object.keys(stock.output).sort());
    }
    const update = toolOf(ourWorld, "update_goal");
    expect(update.parameters.properties.action.enum).toEqual(["edit", "pause", "resume", "complete", "blocked"]);
    expect(update.parameters.required).toEqual(["goal_id", "revision", "action"]);
    expect(toolOf(ourWorld, "get_goal").parameters.properties).toEqual({});
    // Schema đầu ra là một oneOf HAI nhánh, y bản gốc.
    expect(toolOf(ourWorld, "get_goal").output.schema.oneOf.length).toBe(2);
  });

  test("render + presentCall: mọi nhánh KHỚP gốc, kể cả rawInput vắng mặt", () => {
    const ourWorld = boot(Ours);
    const stockWorld = boot(Stock);
    const values = [
      { goal: null },
      { goal: { id: "goal-1", revision: 3, objective: "X", phase: "active", roundsStarted: 2, maxGoalRounds: 9 }, activation: "armed" },
      { goal: { id: "g", revision: 1, objective: "Y", phase: "blocked", roundsStarted: 1, maxGoalRounds: 4, blockedReason: { code: "model-reported", message: "kẹt" } }, activation: "disarmed" },
    ];
    for (const name of ["get_goal", "create_goal", "update_goal"]) {
      for (const value of values) {
        expect(toolOf(ourWorld, name).output.render({}, value)).toEqual(toolOf(stockWorld, name).output.render({}, value));
      }
    }
    const presentCases: [string, any][] = [
      ["get_goal", {}],
      ["create_goal", { objective: "Mục tiêu" }],
      ["create_goal", { objective: "Mục tiêu", max_goal_rounds: 5 }],
      ["update_goal", { goal_id: "goal-1", revision: 1, action: "edit", objective: "Mới" }],
      ["update_goal", { goal_id: "goal-1", revision: 1, action: "pause" }],
      ["update_goal", { goal_id: "goal-1", revision: 1, action: "resume" }],
      ["update_goal", { goal_id: "goal-1", revision: 1, action: "complete" }],
      ["update_goal", { goal_id: "goal-1", revision: 1, action: "blocked", blocked_reason: "hỏng thật" }],
      ["update_goal", { goal_id: "goal-1", revision: 1, action: "edit", max_goal_rounds: 4 }],
      ["update_goal", { goal_id: "goal-1", revision: 1, action: "blocked" }],
    ];
    for (const [name, args] of presentCases) {
      expect(toolOf(ourWorld, name).presentCall(args)).toEqual(toolOf(stockWorld, name).presentCall(args));
    }
    expect(toolOf(ourWorld, "get_goal").presentCall({})).toEqual({ card: "generic", title: "Read current goal", kind: "read" });
    expect(toolOf(ourWorld, "create_goal").presentCall({ objective: "A" })).toEqual({ card: "generic", title: "Create goal", kind: "other", rawInput: "A" });
    expect(toolOf(ourWorld, "update_goal").presentCall({ goal_id: "g", revision: 1, action: "blocked", blocked_reason: "B" })).toEqual({ card: "generic", title: "Mark goal", kind: "other", rawInput: "B" });
  });

  test("schema tham số chặn cùng đầu vào sai ở CẢ HAI bản (defineTool validate)", async () => {
    const ourWorld = boot(Ours);
    const stockWorld = boot(Stock);
    const badCases: [string, any][] = [
      ["create_goal", {}],
      ["create_goal", { objective: 42 }],
      ["update_goal", { goal_id: "g", revision: 1 }],
      ["update_goal", { goal_id: "g", revision: 1, action: "clear" }],
      ["update_goal", { goal_id: "g", revision: 1, action: "edit", unknown: true }],
    ];
    for (const [name, args] of badCases) {
      const ours = await callTool(ourWorld, name, args, ourWorld.agent);
      const stock = await callTool(stockWorld, name, args, stockWorld.agent);
      expect(ours.result).toEqual(stock.result);
      expect(ours.result.ok).toBe(false);
    }
  });
});

describe("tool-goal — hành vi get_goal", () => {
  test("chưa có goal ⇒ { goal: null } · có goal ⇒ compact + activation, KHỚP gốc", async () => {
    const emptyWorld = boot(Ours, { events: [TURN_START, HUMAN], openTurn: 0 });
    const emptyStock = boot(Stock, { events: [TURN_START, HUMAN], openTurn: 0 });
    const empty = await callTool(emptyWorld, "get_goal", {}, emptyWorld.agent);
    const emptyStockResult = await callTool(emptyStock, "get_goal", {}, emptyStock.agent);
    expect(empty.result).toEqual(emptyStockResult.result);
    expect(empty.result).toEqual({ ok: true, value: { goal: null } });
    expect(empty.deferred).toEqual([]);

    const blockedGoal = goal({ phase: "blocked", activation: "disarmed", blockedReason: { code: "model-reported", message: "kẹt" } });
    const world = boot(Ours, { goal: blockedGoal, events: [TURN_START, HUMAN], openTurn: 0 });
    const stockWorld = boot(Stock, { goal: blockedGoal, events: [TURN_START, HUMAN], openTurn: 0 });
    const ours = await callTool(world, "get_goal", {}, world.agent);
    const stock = await callTool(stockWorld, "get_goal", {}, stockWorld.agent);
    expect(ours.result).toEqual(stock.result);
    expect(ours.result.value).toEqual({
      goal: { id: "goal-1", revision: 1, objective: "Viết lại row tool-goal", phase: "blocked", roundsStarted: 3, maxGoalRounds: 20, blockedReason: { code: "model-reported", message: "kẹt" } },
      activation: "disarmed",
    });
    // blockedReason được CHÉP (không giữ tham chiếu) — hành vi của bản gốc.
    expect(ours.result.value.goal.blockedReason).not.toBe(blockedGoal.blockedReason);
  });

  test("kiểm quyền: không agent · agent không sống · idle · không phải initiator · chưa mở lượt — KHỚP gốc", async () => {
    const cases: WorldOptions[] = [
      { live: false },
      { running: false },
      { initiator: false },
      { openTurn: "missing" },
      { openTurn: "closed" },
    ];
    for (const options of cases) {
      const world = boot(Ours, { ...options, events: [TURN_START, HUMAN], openTurn: options.openTurn ?? 0 });
      const stockWorld = boot(Stock, { ...options, events: [TURN_START, HUMAN], openTurn: options.openTurn ?? 0 });
      const ours = await callTool(world, "get_goal", {}, world.agent);
      const stock = await callTool(stockWorld, "get_goal", {}, stockWorld.agent);
      expect(ours.result).toEqual(stock.result);
      expect(ours.result.ok).toBe(false);
    }
    const noAgent = await callTool(boot(Ours, { events: [TURN_START, HUMAN], openTurn: 0 }), "get_goal", {}, undefined);
    expect(noAgent.result).toEqual({ ok: false, name: "HarnessError", message: "goal tools require a calling agent", code: "GOAL_TOOL_AGENT_REQUIRED" });
    const closedWorld = boot(Ours, { events: [], openTurn: "closed" });
    const closed = await callTool(closedWorld, "get_goal", {}, closedWorld.agent);
    expect(closed.result.code).toBe("GOAL_TOOL_DRIVER_REQUIRED");
  });
});

describe("tool-goal — hành vi create_goal", () => {
  test("người thật trực tiếp: tạo goal (có/không trần vòng) — giá trị + vết miền goal KHỚP gốc", async () => {
    for (const args of [{ objective: "Viết lại row tool-goal" }, { objective: "Viết lại row tool-goal", max_goal_rounds: 5 }]) {
      const world = boot(Ours, { events: [TURN_START, HUMAN], openTurn: 0 });
      const stockWorld = boot(Stock, { events: [TURN_START, HUMAN], openTurn: 0 });
      const ours = await callTool(world, "create_goal", args, world.agent);
      const stock = await callTool(stockWorld, "create_goal", args, stockWorld.agent);
      expect(ours.result).toEqual(stock.result);
      expect(ours.result.ok).toBe(true);
      expect(world.goalCalls).toEqual(stockWorld.goalCalls);
      expect(world.goalCalls[0]).toEqual({ method: "create", agent: "s1", request: args.max_goal_rounds === undefined ? { objective: args.objective } : { objective: args.objective, maxGoalRounds: args.max_goal_rounds } });
      expect(ours.deferred).toEqual([]);
    }
  });

  test("thiếu quyền người thật: agent con · lượt chỉ có goal · agent không sống — cùng mã lỗi như gốc", async () => {
    const cases: WorldOptions[] = [
      { root: false },
      { events: [TURN_START, goalRound("goal-1", 1, 3)], openTurn: 0, goal: goal() },
      { events: [TURN_START], openTurn: 0 },
      { live: false, events: [TURN_START, HUMAN], openTurn: 0 },
    ];
    for (const options of cases) {
      const world = boot(Ours, options);
      const stockWorld = boot(Stock, options);
      const ours = await callTool(world, "create_goal", { objective: "X" }, world.agent);
      const stock = await callTool(stockWorld, "create_goal", { objective: "X" }, stockWorld.agent);
      expect(ours.result).toEqual(stock.result);
      expect(ours.result.ok).toBe(false);
      expect(world.goalCalls).toEqual(stockWorld.goalCalls);
      expect(world.goalCalls.filter((call) => call.method === "create").length).toBe(0);
    }
    // Đúng mã của nhánh thiếu quyền người thật.
    const subagent = boot(Ours, { root: false, events: [TURN_START, HUMAN], openTurn: 0 });
    const denied = await callTool(subagent, "create_goal", { objective: "X" }, subagent.agent);
    expect(denied.result.code).toBe("GOAL_TOOL_AUTHORITY_REQUIRED");
    expect(denied.result.message).toBe("this goal operation requires a direct human turn on a top-level agent");
  });
});

describe("tool-goal — hành vi update_goal", () => {
  test("edit/pause/resume (người thật): giá trị + vết + đối số replacements KHỚP gốc", async () => {
    const cases: [any, FakeGoal | undefined][] = [
      [{ goal_id: "goal-1", revision: 1, action: "edit", objective: "Mới" }, goal()],
      [{ goal_id: "goal-1", revision: 1, action: "edit", max_goal_rounds: 7 }, goal()],
      [{ goal_id: "goal-1", revision: 1, action: "pause" }, goal()],
      [{ goal_id: "goal-1", revision: 1, action: "resume" }, goal({ phase: "paused", activation: "disarmed" })],
    ];
    for (const [args, initial] of cases) {
      const world = boot(Ours, { goal: initial, events: [TURN_START, HUMAN], openTurn: 0 });
      const stockWorld = boot(Stock, { goal: initial, events: [TURN_START, HUMAN], openTurn: 0 });
      const ours = await callTool(world, "update_goal", args, world.agent);
      const stock = await callTool(stockWorld, "update_goal", args, stockWorld.agent);
      expect(ours.result).toEqual(stock.result);
      expect(world.goalCalls).toEqual(stockWorld.goalCalls);
      expect(ours.deferred).toEqual([]);
    }
    const editWorld = boot(Ours, { goal: goal(), events: [TURN_START, HUMAN], openTurn: 0 });
    await callTool(editWorld, "update_goal", { goal_id: "goal-1", revision: 1, action: "edit", objective: "Mới", max_goal_rounds: 7 }, editWorld.agent);
    expect(editWorld.goalCalls[0].request).toEqual({ objective: "Mới", maxGoalRounds: 7 });
  });

  test("đường lỗi tham số/trạng thái: ref hỏng · blocked_reason sai chỗ · resume goal đang paused — KHỚP gốc", async () => {
    const cases: [any, FakeGoal | undefined][] = [
      [{ goal_id: "", revision: 1, action: "edit", objective: "X" }, goal()],
      [{ goal_id: " goal-1", revision: 1, action: "edit", objective: "X" }, goal()],
      [{ goal_id: "goal-1", revision: 0, action: "edit", objective: "X" }, goal()],
      [{ goal_id: "goal-1", revision: 1.5, action: "edit", objective: "X" }, goal()],
      [{ goal_id: "goal-1", revision: 1, action: "edit", blocked_reason: "X" }, goal()],
      [{ goal_id: "goal-1", revision: 1, action: "pause", objective: "X" }, goal()],
      [{ goal_id: "goal-1", revision: 1, action: "pause", blocked_reason: "X" }, goal()],
      [{ goal_id: "goal-1", revision: 1, action: "complete", objective: "X" }, goal()],
      [{ goal_id: "goal-1", revision: 1, action: "complete", blocked_reason: "X" }, goal()],
      [{ goal_id: "goal-1", revision: 1, action: "blocked" }, goal()],
      [{ goal_id: "goal-1", revision: 1, action: "blocked", blocked_reason: "   " }, goal()],
      [{ goal_id: "goal-1", revision: 1, action: "resume" }, goal({ phase: "paused", activation: "disarmed" })],
    ];
    for (const [args, initial] of cases) {
      const world = boot(Ours, { goal: initial, events: [TURN_START, HUMAN], openTurn: 0 });
      const stockWorld = boot(Stock, { goal: initial, events: [TURN_START, HUMAN], openTurn: 0 });
      const ours = await callTool(world, "update_goal", args, world.agent);
      const stock = await callTool(stockWorld, "update_goal", args, stockWorld.agent);
      expect(ours.result).toEqual(stock.result);
      expect(ours.result.ok).toBe(false);
      expect(world.goalCalls).toEqual(stockWorld.goalCalls);
    }
    const paused = boot(Ours, { goal: goal({ phase: "paused", activation: "disarmed" }), events: [TURN_START, HUMAN], openTurn: 0 });
    const resume = await callTool(paused, "update_goal", { goal_id: "goal-1", revision: 1, action: "resume" }, paused.agent);
    expect(resume.result.code).toBe("GOAL_TOOL_RESUME_PAUSED");
  });

  test("complete: quyền NGƯỜI THẬT không defer; quyền VÒNG GOAL defer đúng văn bản wrapup — KHỚP gốc", async () => {
    const directWorld = boot(Ours, { goal: goal(), events: [TURN_START, HUMAN], openTurn: 0 });
    const directStock = boot(Stock, { goal: goal(), events: [TURN_START, HUMAN], openTurn: 0 });
    const direct = await callTool(directWorld, "update_goal", { goal_id: "goal-1", revision: 1, action: "complete" }, directWorld.agent);
    const directStockResult = await callTool(directStock, "update_goal", { goal_id: "goal-1", revision: 1, action: "complete" }, directStock.agent);
    expect(direct.result).toEqual(directStockResult.result);
    expect(direct.deferred).toEqual([]);

    const roundEvents = [TURN_START, goalRound("goal-1", 1, 3)];
    const roundWorld = boot(Ours, { goal: goal(), events: roundEvents, openTurn: 0 });
    const roundStock = boot(Stock, { goal: goal(), events: roundEvents, openTurn: 0 });
    const round = await callTool(roundWorld, "update_goal", { goal_id: "goal-1", revision: 1, action: "complete" }, roundWorld.agent);
    const roundStockResult = await callTool(roundStock, "update_goal", { goal_id: "goal-1", revision: 1, action: "complete" }, roundStock.agent);
    expect(round.result).toEqual(roundStockResult.result);
    expect(round.deferred.length).toBe(1);
    expect(roundStockResult.deferred.length).toBe(1);
    expect(messageShape(round.deferred[0])).toEqual(messageShape(roundStockResult.deferred[0]));
    expect(round.deferred[0].source).toEqual({ kind: "tool-goal", form: "notice", summary: "complete: Viết lại row tool-goal" });
    expect(round.deferred[0].content).toEqual([
      {
        type: "text",
        text:
          '<goal_complete>\nObjective: "Viết lại row tool-goal"\nThe goal is marked complete and this autonomous run is ending. Write the closing message to the user now: state the outcome, summarize what was done and how it was verified, and point to the concrete results (files, commits, or other artifacts). Report only what earlier rounds and tool results in this session actually establish; when a detail is not in the session, say so instead of inventing it. Note anything the user should review or do next. Address the user directly. Do not call any more tools in this run; further work waits for the user\'s next instruction.\n</goal_complete>',
      },
    ]);
  });

  test("blocked: ngưỡng vòng của goal-round chặn/cho qua + văn bản wrapup — KHỚP gốc", async () => {
    const blockedCase = async (rounds: number, config: any): Promise<any> => {
      const events = [TURN_START, goalRound("goal-1", 1, rounds)];
      const world = boot(Ours, { goal: goal({ roundsStarted: rounds }), events, openTurn: 0, config });
      const stockWorld = boot(Stock, { goal: goal({ roundsStarted: rounds }), events, openTurn: 0, config });
      const ours = await callTool(world, "update_goal", { goal_id: "goal-1", revision: 1, action: "blocked", blocked_reason: "cùng một điều kiện" }, world.agent);
      const stock = await callTool(stockWorld, "update_goal", { goal_id: "goal-1", revision: 1, action: "blocked", blocked_reason: "cùng một điều kiện" }, stockWorld.agent);
      expect(ours.result).toEqual(stock.result);
      expect(world.goalCalls).toEqual(stockWorld.goalCalls);
      expect(ours.deferred.map(messageShape)).toEqual(stock.deferred.map(messageShape));
      return ours;
    };
    const below = await blockedCase(1, undefined);
    expect(below.result.ok).toBe(false);
    expect(below.result.code).toBe("GOAL_TOOL_BLOCK_THRESHOLD");
    expect(below.result.message).toBe("blocked requires at least 3 consecutive goal rounds; current round is 1");
    expect(below.deferred).toEqual([]);

    const atLimit = await blockedCase(3, undefined);
    expect(atLimit.result.ok).toBe(true);
    expect(atLimit.deferred.length).toBe(1);
    expect(atLimit.deferred[0].source).toEqual({ kind: "tool-goal", form: "notice", summary: "blocked: Viết lại row tool-goal" });
    expect(atLimit.deferred[0].content[0].text).toContain('<goal_blocked>\nObjective: "Viết lại row tool-goal"\nBlocked: "cùng một điều kiện"\n');
    expect(atLimit.deferred[0].content[0].text.endsWith("</goal_blocked>")).toBe(true);

    const customBelow = await blockedCase(4, { blockedAfterConsecutiveRounds: 5 });
    expect(customBelow.result.code).toBe("GOAL_TOOL_BLOCK_THRESHOLD");
    expect(customBelow.result.message).toBe("blocked requires at least 5 consecutive goal rounds; current round is 4");
    const customAt = await blockedCase(5, { blockedAfterConsecutiveRounds: 5 });
    expect(customAt.result.ok).toBe(true);
  });
});

describe("tool-goal — văn bản wrapup với dữ liệu lạ", () => {
  test("5 mục tiêu/lý do (quote · newline · unicode) — văn bản hoãn KHỚP gốc từng ký tự", async () => {
    const objectives = ["Viết lại row tool-goal", 'Mục tiêu có "ngoặc kép"', "Dòng một\nDòng hai", "Tiếng Việt có dấu — 漢字 🚀", ""];
    const reasons = ["cùng một điều kiện", 'lý do "trích dẫn"', "xuống\ndòng", "🙂 ký tự lạ", "lý do thứ năm"];
    for (let index = 0; index < objectives.length; index += 1) {
      const objective = objectives[index] as string;
      const reason = reasons[index] as string;
      const events = [TURN_START, goalRound("goal-1", 1, 3)];
      const world = boot(Ours, { goal: goal({ objective }), events, openTurn: 0 });
      const stockWorld = boot(Stock, { goal: goal({ objective }), events, openTurn: 0 });
      const blocked = await callTool(world, "update_goal", { goal_id: "goal-1", revision: 1, action: "blocked", blocked_reason: reason }, world.agent);
      const blockedStock = await callTool(stockWorld, "update_goal", { goal_id: "goal-1", revision: 1, action: "blocked", blocked_reason: reason }, stockWorld.agent);
      expect(blocked.result).toEqual(blockedStock.result);
      expect(blocked.deferred.map(messageShape)).toEqual(blockedStock.deferred.map(messageShape));
      expect(blocked.deferred[0].content[0].text).toBe(
        '<goal_blocked>\nObjective: ' + JSON.stringify(objective) + '\nBlocked: ' + JSON.stringify(reason) +
          '\nThe goal is marked blocked and this autonomous run is ending. Write the closing message to the user now: state what has been completed so far, describe the concrete blocking condition and what you tried, and say exactly what you need from the user to continue. Report only what earlier rounds and tool results in this session actually establish; when a detail is not in the session, say so instead of inventing it. Address the user directly. Do not call any more tools in this run; further work waits for the user\'s next instruction.\n</goal_blocked>',
      );

      const completeWorld = boot(Ours, { goal: goal({ objective }), events, openTurn: 0 });
      const completeStock = boot(Stock, { goal: goal({ objective }), events, openTurn: 0 });
      const complete = await callTool(completeWorld, "update_goal", { goal_id: "goal-1", revision: 1, action: "complete" }, completeWorld.agent);
      const completeStockResult = await callTool(completeStock, "update_goal", { goal_id: "goal-1", revision: 1, action: "complete" }, completeStock.agent);
      expect(complete.result).toEqual(completeStockResult.result);
      expect(complete.deferred.map(messageShape)).toEqual(completeStockResult.deferred.map(messageShape));
      expect(complete.deferred[0].content[0].text).toBe(
        '<goal_complete>\nObjective: ' + JSON.stringify(objective) +
          '\nThe goal is marked complete and this autonomous run is ending. Write the closing message to the user now: state the outcome, summarize what was done and how it was verified, and point to the concrete results (files, commits, or other artifacts). Report only what earlier rounds and tool results in this session actually establish; when a detail is not in the session, say so instead of inventing it. Note anything the user should review or do next. Address the user directly. Do not call any more tools in this run; further work waits for the user\'s next instruction.\n</goal_complete>',
      );
    }
  });
});

describe("tool-goal — metadata row và locale", () => {
  test("gbh.row MIRROR đúng dump: id + insertDisabled + disabled + tests, KHÔNG config/inject", async () => {
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-tool-goal");
    expect(manifest.gbh.row).toEqual({
      id: "tool-goal",
      // 19/10/2026 (Lead chốt): row INSERT phải tắt theo row stock đang disabled:true.
      insertDisabled: true,
      disabled: true,
      tests: ["tests/host/tool-goal.test.ts"],
    });
    expect(Object.keys(manifest.gbh.row).sort()).toEqual(["disabled", "id", "insertDisabled", "tests"]);
    expect("config" in manifest.gbh.row).toBe(false);
    expect("inject" in manifest.gbh.row).toBe(false);
    expect(manifest.gbh.row.id).toBe("tool-goal");
    expect(manifest.gbh.nested).toEqual({
      kind: "preset",
      pluginId: "tool-goal",
      stockId: "@deepseek-ai/dsh-tool-goal",
      presets: ["preset-standard", "preset-ptc", "preset-cordis"],
    });
    expect(manifest.gbh.tests).toEqual(["tests/host/tool-goal.test.ts"]);
    expect(manifest.main).toBe("lib/index.js");
    expect(manifest.exports["./locale/*.json"]).toBe("./locale/*.json");
  });

  test("gbh.peers là TẬP CON của peerDependencies — có ĐỐI CHỨNG ÂM", async () => {
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    const peers: string[] = manifest.gbh.peers;
    const peerDependencies: string[] = Object.keys(manifest.peerDependencies);
    expect(Array.isArray(peers)).toBe(true);
    expect(peers.length).toBeGreaterThan(0);
    expect(missingPeers(peers, peerDependencies)).toEqual([]);
    // peer = stock peerDependencies + deps.
    for (const name of ["@deepseek-ai/dsh-agent", "@deepseek-ai/dsh-goal", "@deepseek-ai/dsh-llm", "@deepseek-ai/dsh-session", "@deepseek-ai/dsh-system-prompt", "@deepseek-ai/dsh-tools", "@deepseek-ai/cordis", "@deepseek-ai/dsh-session-projection", "@deepseek-ai/schemastery"]) {
      expect(peers).toContain(name);
    }
    expect(new Set(peers).size).toBe(peers.length);
    // ĐỐI CHỨNG ÂM 1: cùng SỐ LƯỢNG nhưng lệch phần tử vẫn bị bắt.
    expect(missingPeers(["@a/x", "@a/y"], ["@a/x", "@a/z"])).toEqual(["@a/y"]);
    expect(["@a/x", "@a/y"].length).toBe(["@a/x", "@a/z"].length);
    // ĐỐI CHỨNG ÂM 2: xoá ĐÚNG một tên ⇒ báo đúng tên đó.
    for (const peer of peers) {
      const without = peerDependencies.filter((name) => name !== peer);
      expect(missingPeers(peers, without)).toEqual([peer]);
    }
  });

  test("locale/{en,zh}.json chép BYTE-FOR-BYTE từ gói gốc (luật 000e)", async () => {
    for (const locale of ["en.json", "zh.json"]) {
      const ours = await readFile(join(PKG, "locale", locale));
      const stock = await readFile(join(STOCK_DIR, "locale", locale));
      expect(ours.equals(stock)).toBe(true);
    }
  });
});
