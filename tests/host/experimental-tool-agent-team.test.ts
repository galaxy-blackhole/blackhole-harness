/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-experimental-tool-agent-team (row tool-agent-team): tập export
 *      đo trên ARTIFACT, 2 mục prompt + 9 tool so TỪNG KÝ TỰ với CHÍNH bundle gốc trên Context cordis THẬT,
 *      ma trận hành vi + đường lỗi, C6 DANH TÍNH, waitFor CÓ TRẦN, gbh.peers ⊆ peerDependencies có ĐỐI
 *      CHỨNG ÂM, luật 000e (locale byte-for-byte), và 2 tool BỔ SUNG set_team_limits · reset_teammate.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/experimental-tool-agent-team/build.ts";
import { NO_ACTIVE_PEER_MESSAGE, teamPolicy } from "../../packages/host/experimental-tool-agent-team/src/policy.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "experimental-tool-agent-team");
/** Thư mục gói GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-experimental-tool-agent-team");
/** Bundle GỐC — oracle của mọi phép so hành vi. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis của kernel — CÙNG một thể hiện cho cả hai bản. */
const CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** ARTIFACT của ta: build MỘT lần vào lib, mọi ca đo trên chính nó. */
const OUR_ARTIFACT = await buildPackage(join(PKG, "lib"));

const cordis: any = await import(CORDIS);
const ours: any = await import(OUR_ARTIFACT);
const stock: any = await import(STOCK);
/** Lớp Context của kernel — dùng cho CẢ HAI bản. */
const ContextCtor: new () => any = cordis.Context;

/** Tên 9 tool theo ĐÚNG thứ tự đăng ký của bản gốc. */
const TOOL_ORDER = [
  "spawn_teammate",
  "send_message",
  "list_agents",
  "wait_agent",
  "interrupt_agent",
  "team_task_create",
  "team_task_list",
  "team_task_get",
  "team_task_update",
];

/** Tool BỔ SUNG của ta — bản gốc KHÔNG có; đăng ký SAU 9 tool gốc nên 9 mục đầu vẫn 1:1. */
const OUR_EXTRA_TOOL = "set_team_limits";
/** Tool BỔ SUNG thứ hai (11/11/2026) — nạp lại một teammate; cũng đứng SAU 9 tool gốc. */
const OUR_RESET_TOOL = "reset_teammate";
/** Mọi tool bổ sung, ĐÚNG thứ tự đăng ký (sau 9 tool gốc). */
const OUR_EXTRA_TOOLS = [OUR_EXTRA_TOOL, OUR_RESET_TOOL];

/** Số TOOL mỗi bản đăng ký trên phạm vi MỘT agent (gốc 9; ta 9 + 2 tool bổ sung). */
const STOCK_TOOL_COUNT = TOOL_ORDER.length;
const OUR_TOOL_COUNT = TOOL_ORDER.length + OUR_EXTRA_TOOLS.length;

/** Số mục đăng ký trên phạm vi MỘT agent: 2 prompt + N tool. */
const STOCK_REGISTRATIONS = 11;
const OUR_REGISTRATIONS = 13;

/** Một thành viên Team giả (đúng hình dạng TeamMemberView). */
interface Member {
  readonly id: string;
  readonly name: string;
  readonly role: "lead" | "teammate";
  status: "running" | "inactive" | "provisioning" | "failed";
  readonly diagnostics: string[];
  readonly description?: string;
  readonly provider?: string;
  readonly context?: "fresh" | "fork";
  readonly model?: string;
}

/** Vết đăng ký trên phạm vi của MỘT agent: để so giữa hai bản và để kiểm việc dọn. */
interface ScopedRecord {
  /** Spec mục prompt ĐÃ đăng ký, theo thứ tự. */
  readonly specs: any[];
  /** Thứ tự mà bản thân plugin TRA CỨU (TEAM_POLICY …), theo thứ tự. */
  readonly orderQueries: string[];
  /** Định nghĩa tool đã đăng ký, theo thứ tự. */
  readonly tools: any[];
  /** Số lần hàm dọn đã được gọi. */
  disposed: number;
}

/** Thế giới giả của một lượt cài: Context cordis THẬT + seam giả + vết gọi. */
interface World {
  /** Context gốc — nơi seam agents/agentTeams sống. */
  readonly ctx: any;
  /** Thành viên theo agent. */
  readonly members: Map<any, Member>;
  /** Vết gọi seam, đã lọc bỏ tín hiệu huỷ (không JSON-serializable). */
  readonly calls: any[];
  /** Agent đã tạo, theo thứ tự. */
  readonly agents: any[];
  /** Bản ghi phạm vi của từng agent. */
  readonly scoped: Map<any, ScopedRecord>;
  /** Bảng task giả. */
  tasks: any[];
  /**
   * Thêm một agent vào thế giới.
   * Nhận: name — tên model nhìn thấy; role — vai; isMember — có thuộc Team hay không.
   * Trả: agent giả có ctx riêng (phạm vi của nó).
   */
  addAgent(name: string, role: "lead" | "teammate", isMember?: boolean): any;
  /** Giải phóng context gốc (chạy mọi effect dọn). */
  dispose(): Promise<void>;
}

/**
 * Một task view giả (đúng hình dạng TeamTaskView).
 * Nhận: các trường cần ghi đè.
 * Trả: view đầy đủ, các trường còn lại lấy mặc định.
 */
function taskView(overrides: Record<string, any>): any {
  return {
    id: "t1",
    revision: 1,
    subject: "subject",
    description: "description",
    status: "pending",
    blockedBy: [],
    writeScopes: [],
    ready: true,
    writeScopeWarnings: [],
    ...overrides,
  };
}

/**
 * Dựng một thế giới giả MỚI: Context cordis thật, seam giả, mỗi agent có Context phạm vi RIÊNG
 * (đúng như bản gốc dùng agent.ctx).
 * Nhận: không.
 * Trả: World với vết gọi rỗng.
 */
function makeWorld(): World {
  const root = new ContextCtor();
  const members = new Map<any, Member>();
  const calls: any[] = [];
  const agents: any[] = [];
  const scoped = new Map<any, ScopedRecord>();
  const world: World = {
    ctx: root,
    members,
    calls,
    agents,
    scoped,
    tasks: [],
    addAgent(name, role, isMember = true): any {
      const agent: any = { id: "sess-" + name, name, ctx: null };
      const record: ScopedRecord = { specs: [], orderQueries: [], tools: [], disposed: 0 };
      const disposeOnce = (): (() => void) => {
        let done = false;
        return () => {
          if (done) return;
          done = true;
          record.disposed += 1;
        };
      };
      const scopedCtx = new ContextCtor();
      scopedCtx.provide("systemPrompt", {
        getSectionOrder: (sectionName: string) => {
          record.orderQueries.push(sectionName);
          return sectionName === "TEAM_POLICY" ? 600 : 0;
        },
        getContextOrder: (contextName: string) => {
          record.orderQueries.push(contextName);
          return contextName === "TEAM_IDENTITY" ? 125 : 0;
        },
        section: (spec: any) => {
          record.specs.push({ kind: "section", ...spec });
          return disposeOnce();
        },
        context: (spec: any) => {
          record.specs.push({ kind: "context", ...spec });
          return disposeOnce();
        },
      });
      scopedCtx.provide("tools", {
        register: (definition: any) => {
          record.tools.push(definition);
          return disposeOnce();
        },
      });
      agent.ctx = scopedCtx;
      if (isMember) members.set(agent, { id: agent.id, name, role, status: "inactive", diagnostics: [] });
      scoped.set(agent, record);
      agents.push(agent);
      return agent;
    },
    async dispose(): Promise<void> {
      await root.fiber.dispose();
      for (const agent of agents) await agent.ctx.fiber.dispose();
    },
  };
  root.provide("agents", { list: () => agents });
  root.provide("agentTeams", {
    membership: (agent: any) => {
      const member = members.get(agent);
      if (member === undefined) throw new Error("not a Team member");
      return { root: agent, id: "team-1", role: member.role, name: member.name };
    },
    tryMembership: (agent: any) => members.get(agent),
    listMembers: (caller: any) => {
      calls.push({ method: "listMembers", caller: members.get(caller)?.name });
      return [...members.values()].map((member) => ({ ...member }));
    },
    spawnTeammate: async (caller: any, request: any) => {
      calls.push({
        method: "spawnTeammate",
        caller: members.get(caller)?.name,
        name: request.name,
        description: request.description,
        prompt: request.prompt,
        context: request.context,
        provider: request.provider,
        hasSignal: request.signal instanceof AbortSignal,
      });
      const member: Member = {
        id: "sess-" + request.name,
        name: request.name,
        role: "teammate",
        status: "provisioning",
        diagnostics: ["created by " + String(members.get(caller)?.name)],
        description: request.description,
        provider: request.provider,
        context: request.context,
      };
      return { member };
    },
    sendMessage: async (caller: any, request: any) => {
      calls.push({
        method: "sendMessage",
        caller: members.get(caller)?.name,
        target: request.target,
        content: request.content,
        hasSignal: request.signal instanceof AbortSignal,
      });
      return { messageId: "msg-1", targetId: "sess-" + request.target };
    },
    waitForChange: async (caller: any, timeoutMs: number, signal: any) => {
      calls.push({ method: "waitForChange", caller: members.get(caller)?.name, timeoutMs, hasSignal: signal instanceof AbortSignal });
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { timedOut: true };
    },
    interrupt: (caller: any, target: string) => {
      calls.push({ method: "interrupt", caller: members.get(caller)?.name, target });
      return "running";
    },
    createTask: async (caller: any, request: any) => {
      calls.push({ method: "createTask", caller: members.get(caller)?.name, request });
      const view = taskView({ id: "t1", revision: 1, subject: request.subject, description: request.description, status: "pending" });
      world.tasks.push(view);
      return view;
    },
    listTasks: (caller: any) => {
      calls.push({ method: "listTasks", caller: members.get(caller)?.name });
      return world.tasks.map((task) => ({ ...task }));
    },
    getTask: (caller: any, id: any) => {
      calls.push({ method: "getTask", caller: members.get(caller)?.name, id });
      const found = world.tasks.find((task) => task.id === id);
      if (found === undefined) throw new Error("no such task " + String(id));
      return { ...found };
    },
    updateTask: async (caller: any, request: any) => {
      calls.push({ method: "updateTask", caller: members.get(caller)?.name, request });
      return taskView({ id: request.taskId, revision: request.expectedRevision + 1, subject: "after " + String(request.action), description: "d" });
    },
    setLimits: (caller: any, request: any) => {
      calls.push({ method: "setLimits", caller: members.get(caller)?.name, request });
      if (request.maxMembers === undefined && request.maxTasks === undefined) {
        throw new Error("at least one Team limit must be provided");
      }
      return { maxMembers: request.maxMembers ?? 8, maxTasks: request.maxTasks ?? 256 };
    },
    resetTeammate: async (caller: any, request: any) => {
      calls.push({
        method: "resetTeammate",
        caller: members.get(caller)?.name,
        target: request.target,
        prompt: request.prompt,
        hasPrompt: request.prompt !== undefined,
        hasSignal: request.signal instanceof AbortSignal,
      });
      const member = members.get(world.agents.find((agent: any) => members.get(agent)?.name === request.target));
      if (member === undefined) throw new Error("no such teammate " + String(request.target));
      return { member: { ...member } };
    },
  });
  root.provide("tools", { register: () => () => undefined });
  root.provide("systemPrompt", { section: () => () => undefined, context: () => () => undefined, getSectionOrder: () => 0, getContextOrder: () => 0 });
  return world;
}

/**
 * Chạy MỘT lượt cài của một bản trên thế giới mới: Lead ở trạng thái inactive + một teammate running.
 * Nhận: plugin — bản cần chạy (ours hoặc stock); config — cấu hình thô.
 * Trả: World đã cài.
 */
function boot(plugin: any, config: Record<string, any> = { freshProvider: "spawn", forkProvider: "fork" }): World {
  const world = makeWorld();
  world.addAgent("lead", "lead");
  const helper = world.addAgent("helper", "teammate");
  const member = world.members.get(helper);
  if (member !== undefined) member.status = "running";
  plugin.apply(world.ctx, config);
  return world;
}

/**
 * Bản ghi phạm vi của agent thứ index.
 * Nhận: world — thế giới đã cài; index — chỉ số agent (0 = Lead).
 * Trả: ScopedRecord tương ứng.
 */
function recordOf(world: World, index = 0): ScopedRecord {
  const record = world.scoped.get(world.agents[index]);
  if (record === undefined) throw new Error("agent " + String(index) + " chưa được cài");
  return record;
}

/**
 * Chữ của khối TEAM_POLICY đã đăng ký.
 * Nhận: world — thế giới đã cài; index — chỉ số agent.
 * Trả: chuỗi chính sách (đã đăng ký tĩnh).
 */
function policyTextOf(world: World, index = 0): string {
  const spec = recordOf(world, index).specs.find((item) => item.name === "team:policy");
  return typeof spec?.text === "string" ? spec.text : "KHONG CO";
}

/**
 * Chữ của ngữ cảnh TEAM_IDENTITY sau khi RÁP (gọi lại hàm text).
 * Nhận: world — thế giới đã cài; index — chỉ số agent.
 * Trả: chuỗi định danh do chính plugin sinh ra.
 */
function identityOf(world: World, index = 0): string {
  const spec = recordOf(world, index).specs.find((item) => item.name === "team:identity");
  return spec === undefined ? "KHONG CO" : String(spec.text());
}

/**
 * Tìm định nghĩa tool theo tên trên phạm vi của agent thứ index.
 * Nhận: world — thế giới đã cài; name — tên tool; index — chỉ số agent.
 * Trả: định nghĩa tool (ném khi không thấy).
 */
function toolNamed(world: World, name: string, index = 0): any {
  const found = recordOf(world, index).tools.find((tool) => tool.name === name);
  if (found === undefined) throw new Error("khong thay tool " + name);
  return found;
}

/**
 * Ảnh chụp ĐỊNH NGHĨA tool (bỏ execute): hình dạng model nhìn thấy + thân render mẫu.
 * Nhận: definition — định nghĩa do defineTool trả.
 * Trả: bản ghi so được bằng toEqual.
 */
function toolShape(definition: any): any {
  return {
    name: definition.name,
    description: definition.description,
    parameters: definition.parameters,
    schema: definition.output.schema,
    rendered: definition.output.render({}, taskView({ status: "in_progress", ownerName: "lead" })),
  };
}

/**
 * Bộ thực thi giả cho một agent: đúng hai trường mà tool đọc (agent + signal).
 * Nhận: world — thế giới đã cài; index — chỉ số agent.
 * Trả: đối tượng exec.
 */
function execFor(world: World, index = 0): any {
  return { agent: world.agents[index], signal: new AbortController().signal };
}

/**
 * Gọi một tool rồi ĐÓNG GÓI kết cục (giá trị hoặc chuỗi lỗi) để hai bản so được.
 * Nhận: world; tên tool; tham số; exec.
 * Trả: { ok } hoặc { error }.
 */
async function call(world: World, name: string, args: any, exec: any = execFor(world)): Promise<any> {
  try {
    return { ok: await toolNamed(world, name).execute(args, exec) };
  } catch (error) {
    return { error: error instanceof Error ? error.name + ": " + error.message : String(error) };
  }
}

/** Hàm chờ có TRẦN: chạy lại check tới khi đúng, quá trần thì NÉM (không để test treo). */
async function waitFor(check: () => boolean, label: string, ceilingMs: number): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started >= ceilingMs) throw new Error('waitFor("' + label + '") quá trần ' + String(ceilingMs) + "ms");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/**
 * Ma trận hành vi: gọi LẦN LƯỢT mọi tool rồi đóng gói kết cục + vết gọi seam.
 * Nhận: world — thế giới đã cài.
 * Trả: mảng kết cục so được bằng toEqual (phần tử cuối là vết gọi seam).
 */
async function drive(world: World): Promise<any[]> {
  const out: any[] = [];
  out.push(await call(world, "spawn_teammate", { name: "t2", description: "d", prompt: "p" }));
  out.push(await call(world, "spawn_teammate", { name: "t3", description: "d", prompt: "p", context: "fork" }));
  out.push(await call(world, "spawn_teammate", { name: "t4", description: "d", prompt: "p" }, { signal: new AbortController().signal }));
  out.push(await call(world, "send_message", { target: "lead", message: "hi" }));
  out.push(await call(world, "list_agents", {}));
  const helper = world.members.get(world.agents[1]);
  if (helper !== undefined) helper.status = "inactive";
  out.push(await call(world, "wait_agent", {}));
  out.push(await call(world, "wait_agent", { timeout_ms: 5000 }));
  if (helper !== undefined) helper.status = "running";
  out.push(await call(world, "wait_agent", {}));
  out.push(await call(world, "interrupt_agent", { target: "helper" }));
  out.push(await call(world, "team_task_create", { subject: "s", description: "d" }));
  out.push(await call(world, "team_task_create", { subject: "s2", description: "d2", blocked_by: ["t1"], write_scopes: ["packages/host"] }));
  out.push(await call(world, "team_task_list", {}));
  out.push(await call(world, "team_task_list", { status: "completed" }));
  out.push(await call(world, "team_task_list", { cursor: -1 }));
  out.push(await call(world, "team_task_list", { limit: 101 }));
  out.push(await call(world, "team_task_list", { cursor: 1, limit: 1 }));
  out.push(await call(world, "team_task_get", { task_id: "t1" }));
  out.push(await call(world, "team_task_get", { task_id: "nope" }));
  out.push(await call(world, "team_task_update", { task_id: "t1", expected_revision: 1, action: "claim" }));
  out.push(await call(world, "team_task_update", { task_id: "t1", expected_revision: 2, action: "edit", subject: "x", description: "y", write_scopes: ["a"], owner: "helper" }));
  out.push(await call(world, "team_task_update", { task_id: "t1", expected_revision: 3, action: "delete", blocked_by: [] }));
  out.push(await call(world, "team_task_update", { task_id: "t1", action: "claim" }));
  out.push({ calls: [...world.calls] });
  return out;
}

describe("row tool-agent-team — tập export đo trên ARTIFACT", () => {
  test("ta = gốc: ĐÚNG 4 tên {Config, apply, inject, name}, KHÔNG default", () => {
    const oursNames = Object.keys(ours).sort();
    const stockNames = Object.keys(stock).sort();
    expect(oursNames).toEqual(stockNames);
    expect(oursNames).toEqual(["Config", "apply", "inject", "name"]);
    expect(ours.default).toBeUndefined();
    expect(typeof ours.apply).toBe("function");
    expect(ours.name).toBe(stock.name);
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["agents", "agentTeams", "tools", "systemPrompt"]);
  });

  test("Config: String() trùng từng chữ, mặc định giống nhau, lỗi kiểu cho CÙNG thông điệp", () => {
    expect(String(ours.Config)).toBe(String(stock.Config));
    expect(ours.Config({})).toEqual(stock.Config({}));
    expect(ours.Config({})).toEqual({ interrupt: true, freshProvider: "spawn", forkProvider: "fork" });
    expect(ours.Config({ interrupt: false, freshProvider: "p", forkProvider: "f" })).toEqual({ interrupt: false, freshProvider: "p", forkProvider: "f" });
    const failure = (plugin: any): string => {
      try {
        plugin.Config({ interrupt: 5 });
        return "không ném";
      } catch (error) {
        return String(error);
      }
    };
    expect(failure(ours)).toBe(failure(stock));
    expect(failure(ours)).not.toBe("không ném");
  });
});

describe("row tool-agent-team — 2 mục prompt + 9 tool so TỪNG KÝ TỰ với bundle gốc", () => {
  test("prompt: TEAM_POLICY + TEAM_IDENTITY — cùng tên, cùng thứ tự tra cứu, cùng chữ ở CẢ HAI vai", () => {
    for (const config of [{}, { interrupt: false }]) {
      const mine = boot(ours, config);
      const theirs = boot(stock, config);
      expect(recordOf(mine, 0).orderQueries).toEqual(recordOf(theirs, 0).orderQueries);
      expect(recordOf(mine, 0).orderQueries).toEqual(["TEAM_POLICY", "TEAM_IDENTITY"]);
      expect(recordOf(mine, 0).specs.map((spec) => [spec.kind, spec.name, spec.order])).toEqual(recordOf(theirs, 0).specs.map((spec) => [spec.kind, spec.name, spec.order]));
      expect(policyTextOf(mine)).toBe(policyTextOf(theirs));
      expect(policyTextOf(mine)).toBe(teamPolicy(config.interrupt ?? true));
      expect(identityOf(mine, 0)).toBe(identityOf(theirs, 0));
      expect(identityOf(mine, 1)).toBe(identityOf(theirs, 1));
      expect(identityOf(mine, 0)).toContain('You are the Team Lead named "lead".');
      expect(identityOf(mine, 1)).toContain('You are teammate "helper".');
      expect(identityOf(mine, 1)).toContain('To message your Team Lead, use send_message({ target: "lead", message: "..." }).');
    }
  });

  test("9 tool GỐC: tên · mô tả · schema tham số · schema đầu ra · thân render — khớp nhau", () => {
    const mine = boot(ours);
    const theirs = boot(stock);
    // 9 mục ĐẦU của ta phải trùng tên + thứ tự bản gốc; tool bổ sung của ta đứng CUỐI.
    expect(recordOf(mine, 0).tools.map((tool) => tool.name)).toEqual([...TOOL_ORDER, ...OUR_EXTRA_TOOLS]);
    expect(recordOf(theirs, 0).tools.map((tool) => tool.name)).toEqual(TOOL_ORDER);
    expect(recordOf(mine, 0).tools.slice(0, TOOL_ORDER.length).map(toolShape)).toEqual(recordOf(theirs, 0).tools.map(toolShape));
  });

  test("tool BỔ SUNG: bản gốc KHÔNG có, bản ta có đúng một, schema đầu ra riêng", () => {
    const mine = boot(ours);
    const theirs = boot(stock);
    expect(recordOf(theirs, 0).tools.map((tool) => tool.name)).not.toContain(OUR_EXTRA_TOOL);
    const extras = recordOf(mine, 0).tools.filter((tool) => tool.name === OUR_EXTRA_TOOL);
    expect(extras).toHaveLength(1);
    expect(recordOf(mine, 0).tools.at(-2).name).toBe(OUR_EXTRA_TOOL);
    expect(recordOf(mine, 0).tools.at(-1).name).toBe(OUR_RESET_TOOL);
    expect(extras[0].description).toContain("Only the Team Lead");
    expect(Object.keys(extras[0].parameters.properties).sort()).toEqual(["max_members", "max_tasks"]);
    expect(extras[0].parameters.required ?? []).toEqual([]);
    expect(extras[0].output.schema.properties).toEqual({
      maxMembers: { type: "integer" },
      maxTasks: { type: "integer" },
    });
    expect(extras[0].output.schema.required).toEqual(["maxMembers", "maxTasks"]);
    expect(extras[0].output.schema.additionalProperties).toBe(false);
  });

  test("tắt interrupt ⇒ còn 8 tool (KHÔNG có interrupt_agent) và chữ chính sách đổi đúng một cụm", () => {
    const mine = boot(ours, { interrupt: false });
    const theirs = boot(stock, { interrupt: false });
    const mineTools = recordOf(mine, 0).tools.map((tool) => tool.name);
    const theirsTools = recordOf(theirs, 0).tools.map((tool) => tool.name);
    expect(mineTools).toEqual([...theirsTools, ...OUR_EXTRA_TOOLS]);
    expect(mineTools).toHaveLength(10);
    expect(theirsTools).toHaveLength(8);
    expect(mineTools).not.toContain("interrupt_agent");
    expect(teamPolicy(false)).not.toBe(teamPolicy(true));
    expect(teamPolicy(false)).not.toContain("and interrupt_agent");
  });
});

describe("row tool-agent-team — ma trận hành vi + đường lỗi, so với bundle gốc", () => {
  test("mọi tool cho CÙNG kết cục và CÙNG vết gọi seam (bật interrupt)", async () => {
    expect(await drive(boot(ours))).toEqual(await drive(boot(stock)));
  });

  test("tắt interrupt ⇒ ma trận vẫn khớp (lời gọi interrupt_agent không còn tool)", async () => {
    expect(await drive(boot(ours, { interrupt: false }))).toEqual(await drive(boot(stock, { interrupt: false })));
  });

  test("wait_agent trả noProgress NGAY khi không còn ai chạy — thân chữ đúng nguyên văn", async () => {
    const mine = boot(ours);
    const helper = mine.members.get(mine.agents[1]);
    if (helper !== undefined) helper.status = "inactive";
    const outcome = await call(mine, "wait_agent", {});
    expect(outcome.ok).toEqual({ timedOut: false, noProgress: { reason: "no-active-peer", message: NO_ACTIVE_PEER_MESSAGE } });
    expect(mine.calls.some((entry) => entry.method === "waitForChange")).toBe(false);
  });

  test("team_task_get thiếu task_id ⇒ lỗi KIỂM THAM SỐ của sổ tool, hai bản cùng thông điệp", async () => {
    const mine = await call(boot(ours), "team_task_get", {});
    const theirs = await call(boot(stock), "team_task_get", {});
    expect(mine.error).toBe(theirs.error);
    expect(mine.error).toContain("task_id");
  });
});

describe("row tool-agent-team — vòng đời: agent/created · agent/disposed · effect", () => {
  test("chỉ cài cho THÀNH VIÊN Team; gỡ đúng agent; effect của lượt cài gỡ phần còn lại", async () => {
    const mine = boot(ours);
    const theirs = boot(stock);
    expect(recordOf(mine, 0).tools).toHaveLength(OUR_TOOL_COUNT);
    expect(recordOf(mine, 1).tools).toHaveLength(OUR_TOOL_COUNT);
    const lateMine = mine.addAgent("late", "teammate");
    const lateTheirs = theirs.addAgent("late", "teammate");
    const outsiderMine = mine.addAgent("outsider", "teammate", false);
    const outsiderTheirs = theirs.addAgent("outsider", "teammate", false);
    mine.ctx.emit("agent/created", { agent: lateMine });
    mine.ctx.emit("agent/created", { agent: outsiderMine });
    theirs.ctx.emit("agent/created", { agent: lateTheirs });
    theirs.ctx.emit("agent/created", { agent: outsiderTheirs });
    expect(recordOf(mine, 2).tools).toHaveLength(OUR_TOOL_COUNT);
    expect(recordOf(theirs, 2).tools).toHaveLength(STOCK_TOOL_COUNT);
    expect(recordOf(mine, 3).tools).toHaveLength(0);
    expect(recordOf(theirs, 3).tools).toHaveLength(0);
    mine.ctx.emit("agent/disposed", { agent: lateMine });
    theirs.ctx.emit("agent/disposed", { agent: lateTheirs });
    expect(recordOf(mine, 2).disposed).toBe(OUR_REGISTRATIONS);
    expect(recordOf(theirs, 2).disposed).toBe(STOCK_REGISTRATIONS);
    expect(recordOf(mine, 2).disposed).toBe(recordOf(theirs, 2).disposed + OUR_EXTRA_TOOLS.length);
    await mine.dispose();
    await theirs.dispose();
    const mineCounts = mine.agents.map((_, index) => recordOf(mine, index).disposed);
    const theirsCounts = theirs.agents.map((_, index) => recordOf(theirs, index).disposed);
    expect(mineCounts).toEqual([OUR_REGISTRATIONS, OUR_REGISTRATIONS, OUR_REGISTRATIONS, 0]);
    expect(theirsCounts).toEqual([STOCK_REGISTRATIONS, STOCK_REGISTRATIONS, STOCK_REGISTRATIONS, 0]);
  });
});

describe("row tool-agent-team — C6: DANH TÍNH (không chia sẻ tham chiếu)", () => {
  test("mỗi agent một bộ spec + tool RIÊNG; ngữ cảnh định danh đọc ĐÚNG thành viên của nó", () => {
    const mine = boot(ours);
    expect(recordOf(mine, 0).specs[0]).not.toBe(recordOf(mine, 1).specs[0]);
    expect(recordOf(mine, 0).tools[0]).not.toBe(recordOf(mine, 1).tools[0]);
    const helper = mine.members.get(mine.agents[1]);
    if (helper === undefined) throw new Error("thiếu thành viên helper");
    (helper as { name: string }).name = "renamed";
    expect(identityOf(mine, 1)).toContain('You are teammate "renamed".');
    expect(identityOf(mine, 0)).toContain('You are the Team Lead named "lead".');
  });

  test("hai lần cài ⇒ hai vòng đời RIÊNG: dọn bản A không lan sang bản B", async () => {
    const a = boot(ours);
    const b = boot(ours);
    await a.dispose();
    expect(recordOf(a, 0).disposed).toBe(OUR_REGISTRATIONS);
    expect(recordOf(b, 0).disposed).toBe(0);
    expect(recordOf(b, 0).tools).toHaveLength(OUR_TOOL_COUNT);
    const spawned = await call(b, "spawn_teammate", { name: "z", description: "d", prompt: "p" });
    expect(spawned.ok.member.target).toBe("z");
    expect(spawned.ok.member.provider).toBe("spawn");
  });
});

describe("row tool-agent-team — tool BỔ SUNG set_team_limits", () => {
  test("Lead gọi: seam nhận ĐÚNG tham số đã đổi tên snake_case → camelCase, trả trần mới", async () => {
    const world = boot(ours);
    const outcome = await call(world, OUR_EXTRA_TOOL, { max_members: 16, max_tasks: 128 });
    expect(outcome.ok).toEqual({ maxMembers: 16, maxTasks: 128 });
    expect(world.calls).toContainEqual({
      method: "setLimits",
      caller: "lead",
      request: { maxMembers: 16, maxTasks: 128 },
    });
  });

  test("chỉ gửi MỘT trần: tham số vắng mặt KHÔNG được gửi xuống seam", async () => {
    const world = boot(ours);
    expect((await call(world, OUR_EXTRA_TOOL, { max_members: 24 })).ok).toEqual({ maxMembers: 24, maxTasks: 256 });
    expect(world.calls.at(-1)).toEqual({ method: "setLimits", caller: "lead", request: { maxMembers: 24 } });
  });

  test("gọi RỖNG: không đổi trần nào ⇒ lỗi của seam đi thẳng ra model", async () => {
    const outcome = await call(boot(ours), OUR_EXTRA_TOOL, {});
    expect(outcome.error).toBe("Error: at least one Team limit must be provided");
  });

  test("tham số tuỳ chọn: cả hai trường KHÔNG bắt buộc, kiểu integer", () => {
    const definition = toolNamed(boot(ours), OUR_EXTRA_TOOL);
    expect(definition.parameters.properties.max_members).toEqual({
      type: "integer",
      description: "New cap on durable teammates; cannot be lower than the current teammate count.",
    });
    expect(definition.parameters.properties.max_tasks).toEqual({
      type: "integer",
      description: "New cap on undeleted shared tasks; cannot be lower than the current task count.",
    });
    expect(definition.parameters.required ?? []).toEqual([]);
  });

  test("thân render: JSON gọn, đúng giá trị đã hứa cho model", () => {
    const definition = toolNamed(boot(ours), OUR_EXTRA_TOOL);
    expect(definition.output.render({}, { maxMembers: 16, maxTasks: 128 })).toEqual([
      { type: "text", text: JSON.stringify({ maxMembers: 16, maxTasks: 128 }) },
    ]);
  });
});

describe("row tool-agent-team — tool BỔ SUNG reset_teammate (nạp lại teammate từ đầu)", () => {
  test("bản gốc KHÔNG có tool này; bản ta có ĐÚNG một, đứng CUỐI, Lead-only trong mô tả", () => {
    const mine = boot(ours);
    const theirs = boot(stock);
    expect(recordOf(theirs, 0).tools.map((tool) => tool.name)).not.toContain(OUR_RESET_TOOL);
    const extras = recordOf(mine, 0).tools.filter((tool) => tool.name === OUR_RESET_TOOL);
    expect(extras).toHaveLength(1);
    expect(recordOf(mine, 0).tools.at(-1).name).toBe(OUR_RESET_TOOL);
    expect(extras[0].description).toContain("Only the Team Lead");
    expect(extras[0].description).toContain("empty context");
  });

  test("tham số: target BẮT BUỘC, prompt tuỳ chọn; đầu ra đúng hình dạng member như spawn_teammate", () => {
    const definition = toolNamed(boot(ours), OUR_RESET_TOOL);
    expect(Object.keys(definition.parameters.properties).sort()).toEqual(["prompt", "target"]);
    expect(definition.parameters.required).toEqual(["target"]);
    expect(definition.output.schema.required).toEqual(["member"]);
    expect(Object.keys(definition.output.schema.properties.member.properties).sort()).toEqual([
      "context", "description", "diagnostics", "model", "provider", "role", "status", "target",
    ]);
    expect(definition.output.schema.additionalProperties).toBe(false);
  });

  test("Lead gọi CÓ prompt: seam nhận đúng target + MỘT khối text + tín hiệu; trả dòng roster", async () => {
    const world = boot(ours);
    const outcome = await call(world, OUR_RESET_TOOL, { target: "helper", prompt: "start over" });
    expect(outcome.ok.member.target).toBe("helper");
    expect(world.calls.at(-1)).toEqual({
      method: "resetTeammate",
      caller: "lead",
      target: "helper",
      prompt: [{ type: "text", text: "start over" }],
      hasPrompt: true,
      hasSignal: true,
    });
  });

  test("KHÔNG có prompt: KHÔNG gửi trường prompt xuống seam (để roster tự đặt lại mô tả)", async () => {
    const world = boot(ours);
    await call(world, OUR_RESET_TOOL, { target: "helper" });
    expect(world.calls.at(-1)).toEqual({
      method: "resetTeammate",
      caller: "lead",
      target: "helper",
      prompt: undefined,
      hasPrompt: false,
      hasSignal: true,
    });
  });

  test("thiếu target ⇒ lỗi KIỂM THAM SỐ của sổ tool (không chạm seam)", async () => {
    const world = boot(ours);
    const outcome = await call(world, OUR_RESET_TOOL, {});
    expect(outcome.error).toContain("target");
    expect(world.calls.some((entry) => entry.method === "resetTeammate")).toBe(false);
  });

  test("seam từ chối ⇒ lỗi đi THẲNG ra model, không bị bọc lại", async () => {
    const world = boot(ours);
    const outcome = await call(world, OUR_RESET_TOOL, { target: "ghost" });
    expect(outcome.error).toBe("Error: no such teammate ghost");
  });
});

describe("row tool-agent-team — chờ seam: waitFor CÓ TRẦN", () => {
  test("wait_agent chờ seam thật rồi trả timedOut; waitFor luôn kết thúc (không treo)", async () => {
    for (const plugin of [ours, stock]) {
      const world = boot(plugin);
      const pending = call(world, "wait_agent", {});
      await waitFor(() => world.calls.some((entry) => entry.method === "waitForChange"), "lượt chờ bắt đầu", 2000);
      expect(await pending).toEqual({ ok: { timedOut: true } });
    }
    const startedAt = Date.now();
    await expect(waitFor(() => false, "điều kiện cố tình sai", 40)).rejects.toThrow("quá trần 40ms");
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });
});

describe("metadata: gbh.peers ⊆ peerDependencies (so PHẦN TỬ) + 000e locale", () => {
  /** Manifest của gói — nguồn DUY NHẤT của cả gbh.peers lẫn peerDependencies (JSON được miễn header). */
  interface Manifest {
    /** Tên package. */
    name: string;
    /** Peer contract với trình quản lý gói. */
    peerDependencies?: Record<string, string>;
    /** Phụ thuộc thật (KHÔNG được chứa peer). */
    dependencies?: Record<string, string>;
    /** Metadata của ta. */
    gbh?: { peers?: string[]; row?: unknown; row_unmounted_ly_do?: unknown };
  }

  /**
   * Tên còn THIẾU: phần tử của gbh.peers không có mặt trong peerDependencies.
   * Nhận: manifest — manifest cần kiểm (có thể là bản đã bị sửa để làm ĐỐI CHỨNG ÂM).
   * Trả: các tên thiếu, đã sắp xếp.
   */
  function missingPeers(manifest: Manifest): string[] {
    const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
    return [...(manifest.gbh?.peers ?? [])].filter((peer) => !declared.has(peer)).sort();
  }

  /** Sáu peer của ta — §3b bậc 1 (cordis · schemastery) + bốn seam row này THẬT SỰ gọi. */
  const SEAM_PEERS = [
    "@deepseek-ai/cordis",
    "@deepseek-ai/dsh-agent",
    "@deepseek-ai/dsh-experimental-agent-team",
    "@deepseek-ai/dsh-system-prompt",
    "@deepseek-ai/dsh-tools",
    "@deepseek-ai/schemastery",
  ];

  test("mọi tên trong gbh.peers có mặt trong peerDependencies, có thật trong kernel, KHÔNG ở dependencies", async () => {
    const manifest: Manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    const peers = manifest.gbh?.peers ?? [];
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    expect(missingPeers(manifest)).toEqual([]);
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    expect(peers.filter((peer) => deps.has(peer))).toEqual([]);
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([]);
    for (const peer of peers) {
      expect(typeof manifest.peerDependencies?.[peer]).toBe("string");
      expect(existsSync(join(ROOT, "apps", "host", "node_modules", peer))).toBe(true);
    }
    // `gbh.row` do LEAD khai NGOÀI phiên viết gói (mtime 10:40:50 ngày 18/10/2026) — gói KHÔNG tự khai.
    // Theo công thức §7, test canh đổi CHIỀU: row đã khai thì khẳng định khai ĐÚNG id + ĐÚNG config của dump.
    expect(manifest.gbh?.row).toEqual({
      id: "tool-agent-team",
      config: { freshProvider: "spawn", forkProvider: "fork" },
      tests: ["tests/host/experimental-tool-agent-team.test.ts"],
      // 25/10/2026 (ADR 0027): row này do bundle agent-team cắm ⇒ app patch không phát khối riêng.
      ownedByBundle: true,
    });
    expect(manifest.gbh?.row_unmounted_ly_do).toBeUndefined();
  });

  test("ĐỐI CHỨNG ÂM: xoá-một-tên · xoá-sạch · thừa-tên · cùng-độ-dài-mà-lệch đều bị phép kiểm bắt", async () => {
    const manifest: Manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    const peers = [...(manifest.gbh?.peers ?? [])];
    const victim = peers[0] as string;
    const withoutOne: Manifest = {
      ...manifest,
      peerDependencies: Object.fromEntries(Object.entries(manifest.peerDependencies ?? {}).filter(([name]) => name !== victim)),
    };
    expect(missingPeers(withoutOne)).toEqual([victim]);
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
    const extra: Manifest = { ...manifest, gbh: { peers: [...peers, "@deepseek-ai/khong-ton-tai"] } };
    expect(missingPeers(extra)).toEqual(["@deepseek-ai/khong-ton-tai"]);
    const sameCount: Manifest = {
      name: "@galaxy-blackhole/gbh-gia",
      gbh: { peers: ["@deepseek-ai/a", "@deepseek-ai/z"] },
      peerDependencies: { "@deepseek-ai/a": "1", "@deepseek-ai/b": "1" },
    };
    expect(sameCount.gbh?.peers?.length).toBe(Object.keys(sameCount.peerDependencies ?? {}).length);
    expect(missingPeers(sameCount)).toEqual(["@deepseek-ai/z"]);
  });

  test("000e: locale/en.json + locale/zh.json TRÙNG TỪNG BYTE bản gốc và có trong exports", async () => {
    for (const file of ["en.json", "zh.json"]) {
      const ourBytes = await readFile(join(PKG, "locale", file));
      const stockBytes = await readFile(join(STOCK_DIR, "locale", file));
      expect(ourBytes.equals(stockBytes)).toBe(true);
      expect(ourBytes.length).toBeGreaterThan(0);
    }
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8")) as { exports?: Record<string, string> };
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });

  test("artifact: 0 lần chuỗi id của gói gốc (row này không đăng ký id module nào)", async () => {
    const artifact = await readFile(join(PKG, "lib", "index.js"), "utf8");
    expect(artifact.includes("id: @deepseek-ai")).toBe(false);
    expect(artifact.includes("__ModuleLoader__")).toBe(false);
  });
});

