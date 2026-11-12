/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Cài bộ 9 tool agent-team + 2 mục prompt vào ĐÚNG phạm vi của một agent thành viên Team: khối
 *      TEAM_POLICY (chữ cố định) · ngữ cảnh TEAM_IDENTITY (đọc lại mỗi lần ráp prompt) · 9 tool gốc
 *      spawn_teammate · send_message · list_agents · wait_agent · interrupt_agent · team_task_create ·
 *      team_task_list · team_task_get · team_task_update · và HAI tool BỔ SUNG của ta:
 *      `set_team_limits` (trần triển khai) và `reset_teammate` (nạp lại một teammate từ đầu).
 */

import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { TeamTaskId, type TeamMemberView } from "@deepseek-ai/dsh-experimental-agent-team";
import { defineTool } from "@galaxy-blackhole/gbh-host-tools";
import type { ToolDefinition } from "@galaxy-blackhole/gbh-host-tools";

import { ACTIVE_WAIT_STATUSES, NO_ACTIVE_PEER_MESSAGE, teamPolicy } from "./policy.ts";
import {
  INTERRUPT_VALUE_SCHEMA,
  jsonOutput,
  MEMBER_LIST_VALUE_SCHEMA,
  RESET_VALUE_SCHEMA,
  SEND_VALUE_SCHEMA,
  SPAWN_VALUE_SCHEMA,
  TASK_LIST_VALUE_SCHEMA,
  TASK_VIEW_SCHEMA,
  TEAM_LIMITS_VALUE_SCHEMA,
  WAIT_VALUE_SCHEMA,
} from "./schemas.ts";
import { modelMember } from "./view.ts";

/**
 * Seam Team BỔ SUNG của ta — chỉ phương thức KHÔNG có ở bản gốc (`setLimits`). Khai theo CẤU TRÚC,
 * không augment module nào: kiểu `ctx.agentTeams` trong workspace là kiểu của gói stock (peer), còn
 * phương thức này do gói `gbh-experimental-agent-team` của ta thêm. Xem ADR 0013.
 */
interface TeamLimitsSeam {
  /**
   * Đổi trần triển khai của MỘT Team; chỉ Lead Team gọi được.
   * Nhận: `caller` — Agent Lead đang sống; `request` — trần mới cho thành viên và/hoặc task.
   * Trả: trần ĐANG có hiệu lực sau lượt đổi.
   */
  setLimits(
    caller: Agent,
    request: { readonly maxMembers?: number; readonly maxTasks?: number },
  ): { readonly maxMembers: number; readonly maxTasks: number };
}

/**
 * Seam Team BỔ SUNG của ta — phương thức nạp lại teammate (`resetTeammate`) không có ở bản gốc. Khai
 * theo CẤU TRÚC như {@link TeamLimitsSeam}: kiểu `ctx.agentTeams` trong workspace là kiểu của gói stock
 * (peer), còn phương thức này do `gbh-experimental-agent-team` của ta thêm. Xem ADR 0013.
 */
interface TeamResetSeam {
  /**
   * Xoá bộ nhớ hội thoại của MỘT teammate rồi dựng lại nó trên cùng id phiên; chỉ Lead Team gọi được.
   * Nhận: `caller` — Agent Lead đang sống; `request` — tên đích, prompt đầu tiên tuỳ chọn, tín hiệu huỷ.
   * Trả: dòng roster của teammate sau khi nạp lại.
   */
  resetTeammate(
    caller: Agent,
    request: {
      readonly target: string;
      readonly prompt?: readonly { readonly type: "text"; readonly text: string }[];
      readonly signal: AbortSignal;
    },
  ): Promise<{ readonly member: TeamMemberView }>;
}

/**
 * Mặt cắt của SỔ TOOL (service `tools`) mà row này dùng — seam CẤU TRÚC, KHÔNG dựa vào augmentation
 * của `Context` (ADR 000d: `@galaxy-blackhole/gbh-host-tools` cố ý không augment). Kiểu
 * `ToolDefinition` lấy từ gói ta nên cả row chỉ có MỘT nguồn kiểu.
 */
interface ToolsLike {
  /**
   * Đăng ký một định nghĩa tool vào sổ của phạm vi agent đang cài.
   * Nhận: `definition` — định nghĩa tool (đã kiểm bởi `defineTool`).
   * Trả: hàm huỷ đăng ký (sổ tool của kernel trả về hàm này).
   */
  register(definition: ToolDefinition): () => void;
}

/** Cấu hình ĐÃ phân giải (mặc định của schema đã điền sẵn) mà một lượt cài dùng. */
export interface ResolvedConfig {
  /** Có đăng ký `interrupt_agent` hay không (mặc định true ở schema). */
  readonly interrupt: boolean;
  /** Provider subagent dùng cho teammate "tươi" (không mang lịch sử của Lead). */
  readonly freshProvider: string;
  /** Provider subagent dùng cho teammate fork (mang các lượt Lead đã xong). */
  readonly forkProvider: string;
}

/**
 * Lấy đúng agent đã gọi tool, do phạm vi Agent của sổ tool bảo đảm.
 * Nhận: `agent` — vật mang do discovery cấp; `toolName` — tên tool để nêu trong thông điệp lỗi.
 * Trả: chính agent đó; ném lỗi nêu TÊN tool khi vật mang vắng mặt.
 */
function callingAgent(agent: unknown, toolName: string): Agent {
  /*
   * SEAM CẤU TRÚC (ADR 000d — 08/11/2026, dev-1 chỉ định của Lead): `exec.agent` do `defineTool` của gói GBH cấp
   * nên mang kiểu `Agent` CỦA GÓI GBH, còn mọi API `ctx.agentTeams.*` của kernel nhận kiểu `Agent` của bản stock.
   * Hai kiểu KHÁC DANH TÍNH nhưng CÙNG hình dạng runtime ⇒ nhận vào theo CẤU TRÚC (`unknown`) rồi ép MỘT lần tại đây,
   * thay vì ép rải rác ở 8 điểm gọi. Không đổi hành vi.
   */
  /* v8 ignore next 2 -- Team tools are registered only in an exact Agent scope, so discovery supplies this carrier. */
  if (agent === void 0) throw new Error(`${toolName} requires a calling Agent`);
  return agent as Agent;
}

/**
 * Cài trọn bộ tool Team trong ĐÚNG MỘT phạm vi Agent.
 *
 * Mọi thứ đăng ký được gom vào một danh sách dọn: hỏng giữa chừng thì dọn NGƯỢC thứ tự rồi ném lại,
 * còn bình thường thì trả một hàm dọn cho người gọi (apply dùng nó khi agent bị giải phóng).
 * Nhận: `agent` — agent thành viên Team cần cài; `ctx` — context gốc giữ seam `agentTeams`;
 *       `config` — cấu hình đã phân giải.
 * Trả: hàm dọn đã đăng ký 13 mục (2 prompt + 11 tool, hoặc 10 tool khi tắt `interrupt`).
 */
export function install(agent: Agent, ctx: Context, config: ResolvedConfig): () => void {
  const scoped = agent.ctx;
  // PHASE B: sổ tool của agent lấy qua SEAM CẤU TRÚC; thiếu seam là lỗi cấu hình ⇒ nổ NGAY,
  // TRƯỚC mọi lượt đăng ký (không để lại hiệu ứng dở dang cho nhánh catch dọn).
  const tools = scoped.get("tools") as ToolsLike | undefined;
  if (tools === undefined) throw new Error("tool-agent-team requires the tools seam (ctx.get(\"tools\"))");
  const disposers: (() => void)[] = [];
  const register = (disposer: () => void): void => {
    disposers.push(disposer);
  };
  try {
    register(scoped.systemPrompt.section({
      name: "team:policy",
      order: scoped.systemPrompt.getSectionOrder("TEAM_POLICY"),
      text: teamPolicy(config.interrupt),
    }));
    register(scoped.systemPrompt.context({
      name: "team:identity",
      order: scoped.systemPrompt.getContextOrder("TEAM_IDENTITY"),
      required: true,
      text: () => {
        const { role, name } = ctx.agentTeams.membership(agent);
        return `${role === "lead" ? "You are the Team Lead named \"lead\"." : `You are teammate "${name}".\nYour Team Lead is named "lead".\nTo message your Team Lead, use send_message({ target: "lead", message: "..." }).`}
Use list_agents({}) to find your teammates and their names.
To message another teammate, use send_message({ target: "<teammate name>", message: "..." }).`;
      },
    }));
    register(tools.register(defineTool({
      name: "spawn_teammate",
      description: "Create one named, durable teammate. Only the Team Lead may call this tool.",
      parameters: {
        name: {
          type: "string",
          required: true,
          description: "Unique lower-kebab-case teammate name.",
        },
        description: {
          type: "string",
          required: true,
          description: "Short description of the delegated responsibility.",
        },
        prompt: {
          type: "string",
          required: true,
          description: "Complete initial task for the teammate.",
        },
        context: {
          type: "string",
          enum: ["fresh", "fork"],
          description: "fresh starts without Lead history; fork inherits completed Lead turns. Defaults to fresh.",
        },
      },
      output: jsonOutput(SPAWN_VALUE_SCHEMA),
      async execute(args, exec) {
        const caller = callingAgent(exec.agent, "spawn_teammate");
        const context = args.context ?? "fresh";
        return { member: modelMember((await ctx.agentTeams.spawnTeammate(caller, {
          name: args.name,
          description: args.description,
          prompt: [{
            type: "text",
            text: args.prompt,
          }],
          context,
          provider: context === "fork" ? config.forkProvider : config.freshProvider,
          signal: exec.signal,
        })).member) };
      },
    })));
    register(tools.register(defineTool({
      name: "send_message",
      description: "Send one message to another Team member. A running target receives it at the nearest step boundary; an inactive target starts or resumes a turn.",
      parameters: {
        target: {
          type: "string",
          required: true,
          description: "Member target returned by spawn_teammate or list_agents, including lead.",
        },
        message: {
          type: "string",
          required: true,
          description: "Self-contained message for the target.",
        },
      },
      output: jsonOutput(SEND_VALUE_SCHEMA),
      async execute(args, exec) {
        await ctx.agentTeams.sendMessage(callingAgent(exec.agent, "send_message"), {
          target: args.target,
          content: [{
            type: "text",
            text: args.message,
          }],
          signal: exec.signal,
        });
        return { sent: true };
      },
    })));
    register(tools.register(defineTool({
      name: "list_agents",
      description: "List the Lead and every durable teammate with an addressable target and current availability. inactive means no turn is executing, not a task result. provisioning and failed describe member creation.",
      parameters: {},
      output: jsonOutput(MEMBER_LIST_VALUE_SCHEMA),
      execute(_args, exec) {
        return Promise.resolve(ctx.agentTeams.listMembers(callingAgent(exec.agent, "list_agents")).map(modelMember));
      },
    })));
    register(tools.register(defineTool({
      name: "wait_agent",
      description: "Wait for the next teammate status, message, or shared-task change after this call starts. This never wakes inactive members and returns noProgress immediately when no other member is running or provisioning. Re-list after wakeup or timeout instead of polling.",
      parameters: { timeout_ms: {
        type: "integer",
        description: "Wait duration in milliseconds, from 10000 through 3600000. Defaults to 30000.",
      } },
      output: jsonOutput(WAIT_VALUE_SCHEMA),
      async execute(args, exec) {
        const caller = callingAgent(exec.agent, "wait_agent");
        const timeoutMs = args.timeout_ms ?? 3e4;
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1e4 || timeoutMs > 36e5) return await ctx.agentTeams.waitForChange(caller, timeoutMs, exec.signal);
        if (!ctx.agentTeams.listMembers(caller).some((member) => member.id !== caller.id && ACTIVE_WAIT_STATUSES.has(member.status))) return {
          timedOut: false,
          noProgress: {
            reason: "no-active-peer" as const,
            message: NO_ACTIVE_PEER_MESSAGE,
          },
        };
        return await ctx.agentTeams.waitForChange(caller, timeoutMs, exec.signal);
      },
    })));
    if (config.interrupt) register(tools.register(defineTool({
      name: "interrupt_agent",
      description: "Interrupt one teammate's current turn while preserving its pending inbox. Team Lead only.",
      parameters: { target: {
        type: "string",
        required: true,
        description: "Teammate target returned by spawn_teammate or list_agents.",
      } },
      output: jsonOutput(INTERRUPT_VALUE_SCHEMA),
      execute(args, exec) {
        return Promise.resolve(ctx.agentTeams.interrupt(callingAgent(exec.agent, "interrupt_agent"), args.target));
      },
    })));
    register(tools.register(defineTool({
      name: "team_task_create",
      description: "Create one unowned pending task on the shared Team task board.",
      parameters: {
        subject: {
          type: "string",
          required: true,
          description: "Concise task title.",
        },
        description: {
          type: "string",
          required: true,
          description: "Complete task details and acceptance criteria.",
        },
        blocked_by: {
          type: "array",
          items: { type: "string" },
          description: "Task ids that must complete first.",
        },
        write_scopes: {
          type: "array",
          items: { type: "string" },
          description: "Advisory workspace-relative file or directory prefixes this task expects to modify.",
        },
      },
      output: jsonOutput(TASK_VIEW_SCHEMA),
      async execute(args, exec) {
        return await ctx.agentTeams.createTask(callingAgent(exec.agent, "team_task_create"), {
          subject: args.subject,
          description: args.description,
          ...(args.blocked_by === void 0 ? {} : { blockedBy: args.blocked_by.map(TeamTaskId) }),
          ...(args.write_scopes === void 0 ? {} : { writeScopes: args.write_scopes }),
        });
      },
    })));
    register(tools.register(defineTool({
      name: "team_task_list",
      description: "List shared tasks, including readiness, owner, revision, blockers, and write-scope warnings.",
      parameters: {
        status: {
          type: "string",
          enum: ["pending", "in_progress", "completed"],
          description: "Optional exact status filter.",
        },
        owner: {
          type: "string",
          description: "Optional member target from spawn_teammate or list_agents, matching ownerName; use unowned for tasks without an owner.",
        },
        ready: {
          type: "boolean",
          description: "Optional readiness filter.",
        },
        cursor: {
          type: "integer",
          description: "Zero-based result offset. Defaults to 0.",
        },
        limit: {
          type: "integer",
          description: "Number of rows, 1 through 100. Defaults to 50.",
        },
      },
      output: jsonOutput(TASK_LIST_VALUE_SCHEMA),
      execute(args, exec) {
        const status = args.status;
        const filtered = ctx.agentTeams.listTasks(callingAgent(exec.agent, "team_task_list")).filter((task) => (status === void 0 || task.status === status) && (args.owner === void 0 || (args.owner === "unowned" ? task.ownerName === void 0 : task.ownerName === args.owner)) && (args.ready === void 0 || task.ready === args.ready));
        const cursor = args.cursor ?? 0;
        const limit = args.limit ?? 50;
        if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error("cursor must be a non-negative safe integer");
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("limit must be an integer from 1 through 100");
        return Promise.resolve({
          tasks: filtered.slice(cursor, cursor + limit),
          ...(cursor + limit < filtered.length ? { nextCursor: cursor + limit } : {}),
        });
      },
    })));
    register(tools.register(defineTool({
      name: "team_task_get",
      description: "Read the complete latest value of one shared task before changing or executing it.",
      parameters: { task_id: {
        type: "string",
        required: true,
        description: "Shared task id.",
      } },
      output: jsonOutput(TASK_VIEW_SCHEMA),
      async execute(args, exec) {
        return Promise.resolve(ctx.agentTeams.getTask(callingAgent(exec.agent, "team_task_get"), TeamTaskId(args.task_id)));
      },
    })));
    register(tools.register(defineTool({
      name: "team_task_update",
      description: "Compare-and-set a shared task action using the latest revision from team_task_get or team_task_list.",
      parameters: {
        task_id: {
          type: "string",
          required: true,
          description: "Shared task id.",
        },
        expected_revision: {
          type: "integer",
          required: true,
          description: "Current task revision used as the CAS precondition.",
        },
        action: {
          type: "string",
          required: true,
          enum: [
            "claim",
            "release",
            "edit",
            "set_dependencies",
            "complete",
            "reopen",
            "reassign",
            "delete",
          ],
          description: "Task transition to apply.",
        },
        subject: {
          type: "string",
          description: "Replacement title for edit.",
        },
        description: {
          type: "string",
          description: "Replacement details for edit.",
        },
        blocked_by: {
          type: "array",
          items: { type: "string" },
          description: "Complete blocker list for set_dependencies.",
        },
        write_scopes: {
          type: "array",
          items: { type: "string" },
          description: "Replacement advisory write scopes for edit.",
        },
        owner: {
          type: "string",
          description: "Member target from spawn_teammate or list_agents for Lead-only reassign; omit to unassign.",
        },
      },
      output: jsonOutput(TASK_VIEW_SCHEMA),
      async execute(args, exec) {
        return await ctx.agentTeams.updateTask(callingAgent(exec.agent, "team_task_update"), {
          taskId: TeamTaskId(args.task_id),
          expectedRevision: args.expected_revision,
          action: args.action,
          ...(args.subject === void 0 ? {} : { subject: args.subject }),
          ...(args.description === void 0 ? {} : { description: args.description }),
          ...(args.blocked_by === void 0 ? {} : { blockedBy: args.blocked_by.map(TeamTaskId) }),
          ...(args.write_scopes === void 0 ? {} : { writeScopes: args.write_scopes }),
          ...(args.owner === void 0 ? {} : { owner: args.owner }),
        });
      },
    })));
    register(tools.register(defineTool({
      name: "set_team_limits",
      description: "Change this Team's deployment caps while it runs: how many durable teammates it may keep and how many undeleted shared tasks it may hold. Only the Team Lead may call this tool. The change lasts for this host process; after a restart the profile configuration decides the caps again.",
      parameters: {
        max_members: {
          type: "integer",
          description: "New cap on durable teammates; cannot be lower than the current teammate count.",
        },
        max_tasks: {
          type: "integer",
          description: "New cap on undeleted shared tasks; cannot be lower than the current task count.",
        },
      },
      output: jsonOutput(TEAM_LIMITS_VALUE_SCHEMA),
      execute(args, exec) {
        const teams = ctx.agentTeams as unknown as TeamLimitsSeam;
        return Promise.resolve(teams.setLimits(callingAgent(exec.agent, "set_team_limits"), {
          ...(args.max_members === void 0 ? {} : { maxMembers: args.max_members }),
          ...(args.max_tasks === void 0 ? {} : { maxTasks: args.max_tasks }),
        }));
      },
    })));
    register(tools.register(defineTool({
      name: "reset_teammate",
      description: "Erase one teammate's entire conversation and start it over from an empty context, keeping its name, description, and provider. The current turn stops, the stored history is deleted, and the given prompt becomes the new first task. Use this when a teammate has exhausted its context window or has drifted off task. Only the Team Lead may call this tool.",
      parameters: {
        target: {
          type: "string",
          required: true,
          description: "Teammate target returned by spawn_teammate or list_agents.",
        },
        prompt: {
          type: "string",
          description: "New first task for the restarted teammate. Defaults to restating its description.",
        },
      },
      output: jsonOutput(RESET_VALUE_SCHEMA),
      async execute(args, exec) {
        const caller = callingAgent(exec.agent, "reset_teammate");
        const teams = ctx.agentTeams as unknown as TeamResetSeam;
        return { member: modelMember((await teams.resetTeammate(caller, {
          target: args.target,
          ...(args.prompt === void 0 ? {} : { prompt: [{
            type: "text" as const,
            text: args.prompt,
          }] }),
          signal: exec.signal,
        })).member) };
      },
    })));
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose();
    throw error;
  }
  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}
