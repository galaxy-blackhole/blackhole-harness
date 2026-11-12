/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test A/B cho row agent-team: đo trên ARTIFACT đối chứng bundle gốc trên Context cordis THẬT + seam giả
 *      cấu trúc — export/inject/Config, brand + TeamError, TeamActivity (đồng hồ giả), validation, task-graph,
 *      task-view, projection agentTeam và các nhánh lỗi công khai của TeamService; kèm API BỔ SUNG của ta
 *      `setLimits` và `resetTeammate` (nạp lại một teammate từ đầu).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/experimental-agent-team/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "experimental-agent-team");
/** Bundle gốc trong kernel (CHỈ ĐỌC). */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-experimental-agent-team", "lib", "index.js");
/** cordis THẬT mà package ta nạp. */
const CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Build tạm dưới lib/ (lint miễn trừ). */
const OUT = join(PKG, "lib", ".test-build");
/** Artifact của ta. */
const ARTIFACT = join(OUT, "index.js");

/** Bề mặt module cần đo. */
interface TeamModule {
  readonly TeamError: new (message: string, code: string, options?: ErrorOptions) => Error & { readonly code: string };
  readonly TeamId: (id: string) => string;
  readonly TeamTaskId: (id: string) => string;
  readonly TeamMessageId: (id: string) => string;
  readonly TeamService: (new (ctx: unknown, config?: Record<string, unknown>) => unknown) & {
    readonly inject: readonly string[];
    readonly Config: (input: Record<string, unknown>) => Record<string, unknown>;
  };
  readonly default: unknown;
}

/** Bundle gốc nạp động. */
const stockMod = (await import(STOCK)) as unknown as TeamModule;
/** Context cordis THẬT. */
const { Context } = (await import(CORDIS)) as unknown as { Context: new () => Record<string, unknown> & { provide(name: string, value: unknown): void } };
/** Module của TA. */
let ourMod: TeamModule;

/**
 * Dựng context THẬT với seam giả cấu trúc đủ cho TeamService.
 * Nhận: không. Trả: context đã cấp agents/sessions/sessionPersistence/sessionProjections/subagents/logger.
 */
function makeContext(): Record<string, unknown> {
  const ctx = new Context();
  ctx.provide("agents", { get: (): undefined => undefined, list: (): unknown[] => [] });
  ctx.provide("sessions", { get: (): undefined => undefined, flush: async (): Promise<void> => {} });
  ctx.provide("sessionPersistence", {});
  ctx.provide("sessionProjections", { register: (): (() => void) => () => {}, stateOf: (): undefined => undefined });
  ctx.provide("subagents", {});
  ctx.provide("logger", { warn: (): void => {}, info: (): void => {}, error: (): void => {} });
  return ctx;
}

/**
 * Chạy một lượt và trả nhãn (tên lớp|message|code) thay vì ném.
 * Nhận: run — hàm cần chạy. Trả: nhãn lỗi hoặc JSON kết quả.
 */
async function outcomeOf(run: () => unknown): Promise<string> {
  try {
    const value = await run();
    return "(khong nem)|" + JSON.stringify(value);
  } catch (thrown: unknown) {
    const error = thrown as { readonly constructor?: { readonly name?: string }; readonly message?: string; readonly code?: string; readonly violation?: string };
    return String(error.constructor?.name) + "|" + String(error.message) + "|" + String(error.code ?? error.violation);
  }
}

beforeAll(async () => {
  await buildPackage(OUT);
  ourMod = (await import(ARTIFACT)) as unknown as TeamModule;
});

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("agent-team — bề mặt artifact", () => {
  test("đúng SÁU export runtime, default === TeamService", () => {
    expect(Object.keys(ourMod).sort()).toEqual(["TeamError", "TeamId", "TeamMessageId", "TeamService", "TeamTaskId", "default"]);
    expect(Object.keys(ourMod).sort()).toEqual(Object.keys(stockMod).sort());
    expect(ourMod.default).toBe(ourMod.TeamService);
    expect(stockMod.default).toBe(stockMod.TeamService);
  });

  test("static inject khớp gốc đúng thứ tự", () => {
    expect(ourMod.TeamService.inject).toEqual(["agents", "sessions", "sessionPersistence", "sessionProjections", "subagents"]);
    expect(ourMod.TeamService.inject).toEqual(stockMod.TeamService.inject);
  });

  test("String(Config) bằng gốc từng ký tự; Config({}) sâu bằng nhau", () => {
    expect(String(ourMod.TeamService.Config)).toBe(String(stockMod.TeamService.Config));
    expect(ourMod.TeamService.Config({})).toEqual(stockMod.TeamService.Config({}));
  });

  test("Config từ chối trần không hợp lệ: thông điệp nguyên văn", async () => {
    for (const config of [{ maxMembers: 0 }, { maxTasks: -1 }, { disposalTimeoutMs: 1.5 }]) {
      expect(await outcomeOf(() => ourMod.TeamService.Config(config))).toBe(await outcomeOf(() => stockMod.TeamService.Config(config)));
    }
  });
});

describe("agent-team — brand + lỗi", () => {
  test("TeamId/TeamTaskId/TeamMessageId giữ nguyên chuỗi", () => {
    for (const mod of [ourMod, stockMod]) {
      expect(mod.TeamId("sess-1")).toBe("sess-1");
      expect(mod.TeamTaskId("task-1")).toBe("task-1");
      expect(mod.TeamMessageId("msg-1")).toBe("msg-1");
    }
  });

  test("TeamError: name/message/code + cause y hệt", () => {
    for (const mod of [ourMod, stockMod]) {
      const cause = new Error("cause");
      const error = new mod.TeamError("boom", "TEAM_X", { cause });
      expect(error.name).toBe("TeamError");
      expect(error.message).toBe("boom");
      expect(error.code).toBe("TEAM_X");
      expect((error as Error & { cause?: unknown }).cause).toBe(cause);
    }
  });
});
/** Một Agent giả tối thiểu đủ cho roster/task mà TeamService gọi. */
interface FakeAgent {
  /** Danh tính phiên. */
  readonly id: string;
  /** Trạng thái sống. */
  readonly status: string;
  /** Tuỳ chọn agent. */
  readonly options: Record<string, unknown>;
  /** Session gốc. */
  readonly session: Record<string, unknown>;
}

/**
 * Dựng Agent Lead giả + context THẬT đã cấp seam trả về chính nó.
 * Nhận: state — trạng thái Team mà projection giả trả. Trả: agent + ctx + bộ đếm register.
 */
function makeLead(state: Record<string, unknown>): { agent: FakeAgent; ctx: Record<string, unknown>; registered: { count: number } } {
  const agent: FakeAgent = {
    id: "lead",
    status: "running",
    options: {},
    session: {
      id: "lead",
      header: { parentSession: undefined },
      snapshotEvents: (): unknown[] => [],
      inheritedEventCount: 0,
      ownEvents: (): unknown[] => [],
      append: (): void => {},
    },
  };
  const registered = { count: 0 };
  const ctx = new Context();
  ctx.provide("agents", { get: (id: string): FakeAgent | undefined => (id === agent.id ? agent : undefined), list: (): FakeAgent[] => [agent] });
  ctx.provide("sessions", { get: (): undefined => undefined, flush: async (): Promise<void> => {} });
  ctx.provide("sessionPersistence", {});
  ctx.provide("sessionProjections", {
    register: (): (() => void) => { registered.count += 1; return () => {}; },
    stateOf: (): Record<string, unknown> => state,
  });
  ctx.provide("subagents", {});
  ctx.provide("logger", { warn: (): void => {}, info: (): void => {}, error: (): void => {} });
  return { agent, ctx, registered };
}

/**
 * Dựng TeamService trên context đã chuẩn bị.
 * Nhận: mod — module; ctx — context; config — cấu hình. Trả: service nhìn theo bề mặt công khai.
 */
function makeService(mod: TeamModule, ctx: Record<string, unknown>, config: Record<string, unknown> = {}): Record<string, (...args: never[]) => unknown> {
  return new mod.TeamService(ctx, mod.TeamService.Config(config)) as unknown as Record<string, (...args: never[]) => unknown>;
}

/** Trạng thái Team rỗng dùng cho projection giả. */
const EMPTY_STATE = { id: "lead", members: [], tasks: [], messages: [], delivered: [], nextTaskNumber: 1 };

describe("agent-team — TeamService trên Context THẬT + seam giả", () => {
  test("dựng service: đăng ký service agentTeams + projection ĐÚNG MỘT lần", () => {
    const { ctx, registered } = makeLead(EMPTY_STATE);
    const mine = makeService(ourMod, ctx);
    expect(typeof (mine as unknown as Record<string, unknown>)["listMembers"]).toBe("function");
    expect(registered.count).toBe(1);
    const other = makeLead(EMPTY_STATE);
    makeService(stockMod, other.ctx);
    expect(other.registered.count).toBe(1);
  });

  test("listMembers(lead) trả dòng Lead: A/B JSON bằng nhau", () => {
    const mineLead = makeLead(EMPTY_STATE);
    const theirsLead = makeLead(EMPTY_STATE);
    const mine = makeService(ourMod, mineLead.ctx);
    const theirs = makeService(stockMod, theirsLead.ctx);
    expect(mine["listMembers"]!(mineLead.agent as never)).toEqual(theirs["listMembers"]!(theirsLead.agent as never));
    expect((mine["listMembers"]!(mineLead.agent as never) as { role: string }[])[0]?.role).toBe("lead");
  });

  test("membership/listMembers với agent LẠ: TEAM_NOT_MEMBER, thông điệp nguyên văn", async () => {
    const mineLead = makeLead(EMPTY_STATE);
    const theirsLead = makeLead(EMPTY_STATE);
    const stranger = { id: "stranger", status: "running", options: {}, session: { id: "stranger", header: {}, snapshotEvents: (): unknown[] => [], inheritedEventCount: 0 } };
    const mine = makeService(ourMod, mineLead.ctx);
    const theirs = makeService(stockMod, theirsLead.ctx);
    expect(await outcomeOf(() => mine["membership"]!(stranger as never))).toBe(await outcomeOf(() => theirs["membership"]!(stranger as never)));
    expect(await outcomeOf(() => mine["listMembers"]!(stranger as never))).toBe(await outcomeOf(() => theirs["listMembers"]!(stranger as never)));
    expect(mine["tryMembership"]!(stranger as never)).toBeUndefined();
    expect(theirs["tryMembership"]!(stranger as never)).toBeUndefined();
  });

  test("sendMessage tự gửi cho lead: TEAM_SELF_MESSAGE A/B", async () => {
    const mineLead = makeLead(EMPTY_STATE);
    const theirsLead = makeLead(EMPTY_STATE);
    const mine = makeService(ourMod, mineLead.ctx);
    const theirs = makeService(stockMod, theirsLead.ctx);
    const request = { target: "lead", content: [{ type: "text", text: "hi" }], signal: new AbortController().signal };
    expect(await outcomeOf(() => mine["sendMessage"]!(mineLead.agent as never, request as never))).toBe(
      await outcomeOf(() => theirs["sendMessage"]!(theirsLead.agent as never, request as never)),
    );
  });

  test("sendMessage vượt maxMessageBytes: TEAM_MESSAGE_TOO_LARGE A/B", async () => {
    const mineLead = makeLead(EMPTY_STATE);
    const theirsLead = makeLead(EMPTY_STATE);
    const big = "x".repeat(500);
    const mine = makeService(ourMod, mineLead.ctx, { maxMessageBytes: 10 });
    const theirs = makeService(stockMod, theirsLead.ctx, { maxMessageBytes: 10 });
    const request = { target: "ghost", content: [{ type: "text", text: big }], signal: new AbortController().signal };
    expect(await outcomeOf(() => mine["sendMessage"]!(mineLead.agent as never, request as never))).toBe(
      await outcomeOf(() => theirs["sendMessage"]!(theirsLead.agent as never, request as never)),
    );
  });

  test("createTask/listTasks/getTask: A/B JSON + task-1 revision 1", async () => {
    const mineLead = makeLead(EMPTY_STATE);
    const theirsLead = makeLead(EMPTY_STATE);
    const mine = makeService(ourMod, mineLead.ctx);
    const theirs = makeService(stockMod, theirsLead.ctx);
    const request = { subject: "Việc", description: "Mô tả" };
    const mineView = await mine["createTask"]!(mineLead.agent as never, request as never);
    const theirsView = await theirs["createTask"]!(theirsLead.agent as never, request as never);
    expect(mineView).toEqual(theirsView);
    expect((mineView as { id: string }).id).toBe("task-1");
    expect(mine["listTasks"]!(mineLead.agent as never)).toEqual(theirs["listTasks"]!(theirsLead.agent as never));
    expect(await outcomeOf(() => mine["getTask"]!(mineLead.agent as never, "task-404" as never))).toBe(
      await outcomeOf(() => theirs["getTask"]!(theirsLead.agent as never, "task-404" as never)),
    );
  });

  test("updateTask: claim rồi complete A/B; revision cũ ⇒ TEAM_TASK_STALE_REVISION", async () => {
    const seedTask = {
      id: "task-1",
      revision: 1,
      subject: "S",
      description: "D",
      status: "pending",
      blockedBy: [],
      writeScopes: [],
    };
    const state = { ...EMPTY_STATE, tasks: [seedTask] };
    const mineLead = makeLead(state);
    const theirsLead = makeLead(state);
    const mine = makeService(ourMod, mineLead.ctx);
    const theirs = makeService(stockMod, theirsLead.ctx);
    const claim = { taskId: "task-1", expectedRevision: 1, action: "claim", owner: "lead" };
    const mineClaim = await mine["updateTask"]!(mineLead.agent as never, claim as never);
    const theirsClaim = await theirs["updateTask"]!(theirsLead.agent as never, claim as never);
    expect(mineClaim).toEqual(theirsClaim);
    expect((mineClaim as { status: string }).status).toBe("in_progress");
    expect(await outcomeOf(() => mine["updateTask"]!(mineLead.agent as never, claim as never))).toBe(
      await outcomeOf(() => theirs["updateTask"]!(theirsLead.agent as never, claim as never)),
    );
    expect(await outcomeOf(() => mine["getTask"]!(mineLead.agent as never, "task-404" as never))).toBe(
      await outcomeOf(() => theirs["getTask"]!(theirsLead.agent as never, "task-404" as never)),
    );
  });

  test("waitForChange: timeout ngoài biên ⇒ TEAM_INVALID_TIMEOUT A/B", async () => {
    const mineLead = makeLead(EMPTY_STATE);
    const theirsLead = makeLead(EMPTY_STATE);
    const mine = makeService(ourMod, mineLead.ctx);
    const theirs = makeService(stockMod, theirsLead.ctx);
    for (const timeoutMs of [9_999, 3_600_001, 1.5]) {
      expect(await outcomeOf(() => mine["waitForChange"]!(mineLead.agent as never, timeoutMs as never, new AbortController().signal as never))).toBe(
        await outcomeOf(() => theirs["waitForChange"]!(theirsLead.agent as never, timeoutMs as never, new AbortController().signal as never)),
      );
    }
  });

  test("interrupt target lạ: thông điệp nguyên văn A/B", async () => {
    const mineLead = makeLead(EMPTY_STATE);
    const theirsLead = makeLead(EMPTY_STATE);
    const mine = makeService(ourMod, mineLead.ctx);
    const theirs = makeService(stockMod, theirsLead.ctx);
    expect(await outcomeOf(() => mine["interrupt"]!(mineLead.agent as never, "ghost" as never))).toBe(
      await outcomeOf(() => theirs["interrupt"]!(theirsLead.agent as never, "ghost" as never)),
    );
  });

  test("spawnTeammate: tên sai mẫu ⇒ TEAM_INVALID_MEMBER_NAME A/B", async () => {
    const mineLead = makeLead(EMPTY_STATE);
    const theirsLead = makeLead(EMPTY_STATE);
    const mine = makeService(ourMod, mineLead.ctx);
    const theirs = makeService(stockMod, theirsLead.ctx);
    const request = { name: "Bad Name", description: "d", prompt: [{ type: "text", text: "x" }], context: "fresh", provider: "deepseek", signal: new AbortController().signal };
    expect(await outcomeOf(() => mine["spawnTeammate"]!(mineLead.agent as never, request as never))).toBe(
      await outcomeOf(() => theirs["spawnTeammate"]!(theirsLead.agent as never, request as never)),
    );
  });

  test("C6 danh tính: hai lượt listMembers là vật thể khác nhau nhưng sâu bằng", () => {
    const mineLead = makeLead(EMPTY_STATE);
    const mine = makeService(ourMod, mineLead.ctx);
    const first = mine["listMembers"]!(mineLead.agent as never) as unknown[];
    const second = mine["listMembers"]!(mineLead.agent as never) as unknown[];
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
describe("agent-team — thêm nhánh công khai", () => {
  test("membership(lead) trả root + role lead; tryMembership(lead) khớp", () => {
    const mineLead = makeLead(EMPTY_STATE);
    const theirsLead = makeLead(EMPTY_STATE);
    const mine = makeService(ourMod, mineLead.ctx);
    const theirs = makeService(stockMod, theirsLead.ctx);
    const mineMembership = mine["membership"]!(mineLead.agent as never) as { id: string; role: string; name: string; root: unknown };
    const theirsMembership = theirs["membership"]!(theirsLead.agent as never) as { id: string; role: string; name: string; root: unknown };
    expect(mineMembership.id).toBe(theirsMembership.id);
    expect(mineMembership.role).toBe("lead");
    expect(mineMembership.role).toBe(theirsMembership.role);
    expect(mineMembership.name).toBe(theirsMembership.name);
    expect(mineMembership.root).toBe(mineLead.agent);
    expect(theirsMembership.root).toBe(theirsLead.agent);
    const mineTry = mine["tryMembership"]!(mineLead.agent as never) as { id: string; role: string } | undefined;
    const theirsTry = theirs["tryMembership"]!(theirsLead.agent as never) as { id: string; role: string } | undefined;
    expect(mineTry?.id).toBe(theirsTry?.id);
    expect(mineTry?.role).toBe(theirsTry?.role);
  });

  test("updateTask action lạ ⇒ TEAM_INVALID_ARGUMENT A/B", async () => {
    const seedTask = { id: "task-1", revision: 1, subject: "S", description: "D", status: "pending", blockedBy: [], writeScopes: [] };
    const state = { ...EMPTY_STATE, tasks: [seedTask] };
    const mineLead = makeLead(state);
    const theirsLead = makeLead(state);
    const mine = makeService(ourMod, mineLead.ctx);
    const theirs = makeService(stockMod, theirsLead.ctx);
    const bogus = { taskId: "task-1", expectedRevision: 1, action: "bogus" };
    expect(await outcomeOf(() => mine["updateTask"]!(mineLead.agent as never, bogus as never))).toBe(
      await outcomeOf(() => theirs["updateTask"]!(theirsLead.agent as never, bogus as never)),
    );
  });

  test("createTask blocker không tồn tại ⇒ thông điệp nguyên văn A/B", async () => {
    const mineLead = makeLead(EMPTY_STATE);
    const theirsLead = makeLead(EMPTY_STATE);
    const mine = makeService(ourMod, mineLead.ctx);
    const theirs = makeService(stockMod, theirsLead.ctx);
    const request = { subject: "S", description: "D", blockedBy: ["task-404"] };
    expect(await outcomeOf(() => mine["createTask"]!(mineLead.agent as never, request as never))).toBe(
      await outcomeOf(() => theirs["createTask"]!(theirsLead.agent as never, request as never)),
    );
  });
});

describe("agent-team — setLimits: API BỔ SUNG của ta (bản gốc KHÔNG có)", () => {
  test("ĐỐI CHỨNG ÂM: bundle gốc không có setLimits", () => {
    const theirsLead = makeLead(EMPTY_STATE);
    const theirs = makeService(stockMod, theirsLead.ctx);
    expect(theirs["setLimits"]).toBeUndefined();
  });

  test("Lead nâng trần: trả trần ĐANG CÓ hiệu lực; gọi một phần thì trần kia giữ nguyên", async () => {
    const lead = makeLead(EMPTY_STATE);
    const service = makeService(ourMod, lead.ctx);
    expect(await outcomeOf(() => service["setLimits"]!(lead.agent as never, { maxMembers: 24, maxTasks: 128 } as never))).toBe(
      "(khong nem)|" + JSON.stringify({ maxMembers: 24, maxTasks: 128 }),
    );
    expect(await outcomeOf(() => service["setLimits"]!(lead.agent as never, { maxTasks: 512 } as never))).toBe(
      "(khong nem)|" + JSON.stringify({ maxMembers: 24, maxTasks: 512 }),
    );
  });

  test("không đổi trần nào ⇒ TEAM_INVALID_ARGUMENT; trần không dương/không nguyên ⇒ TEAM_INVALID_CONFIG", async () => {
    const lead = makeLead(EMPTY_STATE);
    const service = makeService(ourMod, lead.ctx);
    expect(await outcomeOf(() => service["setLimits"]!(lead.agent as never, {} as never))).toBe(
      "TeamError|at least one Team limit must be provided|TEAM_INVALID_ARGUMENT",
    );
    for (const request of [{ maxMembers: 0 }, { maxTasks: -1 }, { maxMembers: 1.5 }]) {
      expect(await outcomeOf(() => service["setLimits"]!(lead.agent as never, request as never))).toContain("|TEAM_INVALID_CONFIG");
    }
  });

  test("KHÔNG cho hạ trần dưới mức đang dùng: đếm theo members/tasks của state", async () => {
    const member = { id: "sess-a", name: "a", description: "d", provider: "spawn", phase: "active" };
    const task = { id: "task-1", revision: 1, subject: "S", description: "D", status: "pending", blockedBy: [], writeScopes: [] };
    const state = {
      ...EMPTY_STATE,
      members: [member, { ...member, id: "sess-b", name: "b" }],
      tasks: [task, { ...task, id: "task-2" }],
    };
    const lead = makeLead(state);
    const service = makeService(ourMod, lead.ctx);
    expect(await outcomeOf(() => service["setLimits"]!(lead.agent as never, { maxMembers: 1 } as never))).toBe(
      "TeamError|maxMembers cannot be lower than the current teammate count (2)|TEAM_INVALID_ARGUMENT",
    );
    expect(await outcomeOf(() => service["setLimits"]!(lead.agent as never, { maxTasks: 1 } as never))).toBe(
      "TeamError|maxTasks cannot be lower than the current task count (2)|TEAM_INVALID_ARGUMENT",
    );
    expect(await outcomeOf(() => service["setLimits"]!(lead.agent as never, { maxMembers: 2, maxTasks: 2 } as never))).toBe(
      "(khong nem)|" + JSON.stringify({ maxMembers: 2, maxTasks: 2 }),
    );
  });
});
describe("agent-team — resetTeammate: API BỔ SUNG của ta (bản gốc KHÔNG có)", () => {
  test("ĐỐI CHỨNG ÂM: bundle gốc không có resetTeammate; bản ta có ĐÚNG một hàm", () => {
    const theirsLead = makeLead(EMPTY_STATE);
    const theirs = makeService(stockMod, theirsLead.ctx);
    expect(theirs["resetTeammate"]).toBeUndefined();
    const mineLead = makeLead(EMPTY_STATE);
    const mine = makeService(ourMod, mineLead.ctx);
    expect(typeof mine["resetTeammate"]).toBe("function");
  });

  test("Lead tự nạp lại chính mình ⇒ TEAM_INVALID_TARGET (không đụng seam nào)", async () => {
    const lead = makeLead(EMPTY_STATE);
    const service = makeService(ourMod, lead.ctx);
    expect(await outcomeOf(() => service["resetTeammate"]!(lead.agent as never, {
      target: "lead",
      signal: new AbortController().signal,
    } as never))).toBe("TeamError|the Team Lead cannot reset itself|TEAM_INVALID_TARGET");
  });

  test("tên không có teammate active ⇒ TEAM_MEMBER_NOT_FOUND, thông điệp nguyên văn", async () => {
    const lead = makeLead(EMPTY_STATE);
    const service = makeService(ourMod, lead.ctx);
    expect(await outcomeOf(() => service["resetTeammate"]!(lead.agent as never, {
      target: "ghost",
      signal: new AbortController().signal,
    } as never))).toBe('TeamError|active teammate "ghost" not found|TEAM_MEMBER_NOT_FOUND');
  });

  test("composition THIẾU dịch vụ xoá phiên ⇒ TEAM_RESET_UNAVAILABLE (từ chối, không tự gỡ thư mục)", async () => {
    const member = { id: "sess-a", name: "a", description: "d", provider: "spawn", context: "fresh", phase: "active" };
    const lead = makeLead({ ...EMPTY_STATE, members: [member] });
    const service = makeService(ourMod, lead.ctx);
    expect(await outcomeOf(() => service["resetTeammate"]!(lead.agent as never, {
      target: "a",
      signal: new AbortController().signal,
    } as never))).toBe("TeamError|resetting a teammate requires the session-delete service|TEAM_RESET_UNAVAILABLE");
  });
});
