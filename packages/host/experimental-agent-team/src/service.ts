/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Dịch vụ `agentTeams`: mặt tiền Agent Team trên bốn chủ sở hữu (roster, messaging, bảng việc, vòng
 *      đời runtime) — trần triển khai đã kiểm, cứu provisioning sau `agent/created`, cửa tiếp nhận
 *      dùng chung lúc dọn — port 1:1 lib/types/index.js (236 dòng) của
 *      @deepseek-ai/dsh-experimental-agent-team.
 */
import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import type { ContentBlock, MessageId, MessageSource } from "@deepseek-ai/dsh-llm";
import { steerHostSubagentPrompt } from "@deepseek-ai/dsh-subagent/internal";
import z from "@deepseek-ai/schemastery";

import { TeamActivity } from "./activity.ts";
import { errorMessage, TeamError } from "./error.ts";
import { TeamJournal } from "./journal.ts";
import { TeamRuntimeLifecycle } from "./lifecycle.ts";
import { teamProjectionDefinition } from "./projection.ts";
import { resolveActiveMember, TeamRoster } from "./roster.ts";
import type { TeamMembership } from "./roster.ts";
import { TeamTaskBoard } from "./task-board.ts";
import { TeamId } from "./types.ts";
import type {
  Config,
  CreateTeamTaskRequest,
  ResetTeammateRequest,
  ResetTeammateResult,
  SendTeamMessageRequest,
  SendTeamMessageResult,
  SetTeamLimitsRequest,
  SpawnTeammateRequest,
  SpawnTeammateResult,
  TeamLimitsView,
  TeamMemberView,
  TeamTaskId,
  TeamTaskView,
  TeamWaitResult,
  UpdateTeamTaskRequest,
} from "./types.ts";

/** Trần thành viên mặc định của một Team (nguyên văn bản gốc). */
const DEFAULT_MAX_MEMBERS = 16;
/** Trần task mặc định của một Team (nguyên văn bản gốc). */
const DEFAULT_MAX_TASKS = 256;
/** Trần byte mặc định cho MỘT lượt giao tin đã đóng khung người gửi (nguyên văn bản gốc). */
const DEFAULT_MAX_MESSAGE_BYTES = 65_536;
/** Hạn dọn mặc định của runtime Team, tính bằng mili giây (nguyên văn bản gốc). */
const DEFAULT_DISPOSAL_TIMEOUT_MS = 5_000;

/** Cấu hình ĐÃ phân giải: mọi trần triển khai đều là số nguyên an toàn DƯƠNG. */
interface ResolvedConfig {
  /** Trần số thành viên bền của một Team. */
  readonly maxMembers: number;
  /** Trần số task chưa xoá của một Team. */
  readonly maxTasks: number;
  /** Trần số byte UTF-8 của một lượt giao tin. */
  readonly maxMessageBytes: number;
  /** Hạn chờ dọn runtime, tính bằng mili giây. */
  readonly disposalTimeoutMs: number;
}

/**
 * Seam `sessionProjections` khai theo CẤU TRÚC: đúng MỘT lời gọi `register` mà service dùng.
 * Vì sao không dùng kiểu thật: bảng `SessionProjectionMap`/`SessionProjectionStateMap` của kernel chỉ
 * nhận khoá đã augment, còn row này KHÔNG augment module nào (luật seam-cấu-trúc).
 */
interface TeamProjectionRegistrySeam {
  /**
   * Đăng ký MỘT đơn vị chiếu.
   * Nhận: `definition` — đơn vị chiếu Team (`agentTeam`). Trả: hàm dọn gỡ đăng ký.
   */
  register(definition: unknown): () => void;
}

/**
 * Kiểm MỘT trần triển khai là số nguyên an toàn DƯƠNG.
 * Nhận: `name` — tên trường để nêu trong lỗi; `value` — giá trị cần kiểm.
 * Trả: chính giá trị đó khi hợp lệ.
 * Ném: `TeamError` mã `TEAM_INVALID_CONFIG` khi không phải số nguyên an toàn ≥ 1.
 */
function positiveLimit(name: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TeamError(`${name} must be a positive safe integer`, "TEAM_INVALID_CONFIG");
  }
  return value;
}

/** Dịch vụ Agent Team tựa trên ĐÚNG log Session Lead đang sống. */
export class TeamService extends Service {
  /** Năm seam phải có trước khi service thức dậy (nguyên văn thứ tự bản gốc). */
  static inject = ["agents", "sessions", "sessionPersistence", "sessionProjections", "subagents"];

  /** Schema cấu hình lúc chạy: bốn trần triển khai, mặc định nguyên văn bản gốc. */
  static Config: z<Config> = z.object({
    maxMembers: z.number().step(1).min(1).default(DEFAULT_MAX_MEMBERS),
    maxTasks: z.number().step(1).min(1).default(DEFAULT_MAX_TASKS),
    maxMessageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_MESSAGE_BYTES),
    disposalTimeoutMs: z.number().step(1).min(1).default(DEFAULT_DISPOSAL_TIMEOUT_MS),
  });

  /** Giới hạn triển khai ĐÃ kiểm dùng cho mọi thao tác Team. */
  private readonly config: ResolvedConfig;
  /** Waiter thay đổi miền Team (một lần, không phụ thuộc projection). */
  private readonly activity: TeamActivity;
  /** Cổng tiếp nhận + dọn có hạn của runtime Team. */
  private readonly lifecycle: TeamRuntimeLifecycle;
  /** Chủ sở hữu giao dịch log Lead. */
  private readonly journal: TeamJournal;
  /** Roster thành viên và vòng đời con continuable. */
  private readonly roster: TeamRoster;
  /** Bảng việc chia sẻ (DAG). */
  private readonly tasks: TeamTaskBoard;

  /**
   * Dựng dịch vụ, đăng ký nó dưới tên `agentTeams`, và nối bốn chủ sở hữu vào vòng đời context.
   * Nhận: `ctx` — context cordis có đủ năm seam trong {@link TeamService.inject};
   *       `config` — cấu hình thô của loader (bỏ trống thì lấy mặc định từng trần).
   * Trả: không; effect của service dọn runtime Team (và gỡ đơn vị chiếu) khi fiber xuống.
   * Ném: `TeamError` mã `TEAM_INVALID_CONFIG` khi một trần không phải số nguyên an toàn dương.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, "agentTeams");
    this.config = {
      maxMembers: positiveLimit("maxMembers", config.maxMembers ?? DEFAULT_MAX_MEMBERS),
      maxTasks: positiveLimit("maxTasks", config.maxTasks ?? DEFAULT_MAX_TASKS),
      maxMessageBytes: positiveLimit("maxMessageBytes", config.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES),
      disposalTimeoutMs: positiveLimit("disposalTimeoutMs", config.disposalTimeoutMs ?? DEFAULT_DISPOSAL_TIMEOUT_MS),
    };
    this.activity = new TeamActivity();
    this.lifecycle = new TeamRuntimeLifecycle(this.config.disposalTimeoutMs);
    this.journal = new TeamJournal(ctx, (root) => {
      this.activity.notify(TeamId((root.session as { readonly id: string }).id));
    });
    this.roster = new TeamRoster(ctx, this.journal, this.lifecycle, this.config.maxMembers);
    this.tasks = new TeamTaskBoard(this.journal, this.config.maxTasks);
    ctx.on("agent/created", ({ agent }) => {
      this.scheduleRecovery(agent);
      return undefined;
    });
    ctx.on("agent/status", ({ agent }) => {
      const membership = this.roster.tryMembership(agent);
      if (membership !== undefined) this.activity.notify(membership.id);
    });
    ctx.effect(() => {
      const disposeProjection = (ctx.root.sessionProjections as unknown as TeamProjectionRegistrySeam).register(
        teamProjectionDefinition,
      );
      return async () => {
        try {
          await this.disposeRuntime();
        } finally {
          disposeProjection();
        }
      };
    }, "agentTeams.runtimeLifecycle()");
    for (const agent of ctx.agents.list()) this.scheduleRecovery(agent);
  }

  /**
   * Phân giải vai trò Team của MỘT Agent đang sống chính xác.
   * Nhận: `agent` — Agent đang sống dùng làm thẩm quyền.
   * Trả: root, danh tính Team, vai trò và tên do model đặt của người gọi.
   */
  membership(agent: Agent): TeamMembership {
    return this.roster.membership(agent);
  }

  /**
   * Liệt kê roster đã làm giàu runtime mà MỘT thành viên Team nhìn thấy.
   * Nhận: `agent` — thành viên Team đang sống.
   * Trả: dòng Lead rồi các dòng teammate theo thứ tự tạo.
   */
  listMembers(agent: Agent): TeamMemberView[] {
    return this.roster.list(this.roster.membership(agent));
  }

  /**
   * Tạo MỘT con trực tiếp continuable có tên của Lead Team.
   * Nhận: `caller` — Agent Lead đang sống; `request` — tên bất biến, mô tả, prompt, chế độ context,
   *       provider và tín hiệu huỷ.
   * Trả: dòng roster đang hoạt động sau khi con nhận prompt đầu tiên bền vững.
   */
  async spawnTeammate(caller: Agent, request: SpawnTeammateRequest): Promise<SpawnTeammateResult> {
    return await this.roster.spawn(caller, request);
  }

  /**
   * NẠP LẠI MỘT teammate từ đầu (API BỔ SUNG của GBH — bản gốc KHÔNG có): dừng lượt đang chạy, xoá nhật
   * ký phiên của nó rồi dựng lại continuation trên CÙNG id phiên, giữ nguyên tên · mô tả · provider.
   * Nhận: `caller` — Agent Lead đang sống chính xác; `request` — tên teammate đích, prompt mới tuỳ chọn
   *       và tín hiệu huỷ (gộp với tín hiệu dọn runtime).
   * Trả: dòng roster của teammate sau khi continuation mới nhận prompt đầu tiên bền vững.
   * Ném: `TeamError` mã `TEAM_DISPOSED` khi runtime đang dọn, và mọi lỗi của lượt nạp lại (xem
   *      `TeamRoster.reset`).
   */
  async resetTeammate(caller: Agent, request: ResetTeammateRequest): Promise<ResetTeammateResult> {
    if (this.lifecycle.disposed) throw new TeamError("Agent Teams service is disposing", "TEAM_DISPOSED");
    return await this.lifecycle.track(
      this.roster.reset(caller, {
        ...request,
        signal: AbortSignal.any([request.signal, this.lifecycle.signal]),
      }),
    );
  }

  /**
   * Đổi trần triển khai của MỘT Team trong lúc chạy (chỉ Lead Team).
   * Nhận: `caller` — Agent Lead đang sống chính xác; `request` — trần mới cho thành viên và/hoặc task.
   * Trả: trần ĐANG có hiệu lực sau lượt đổi. Thay đổi chỉ sống trong đời service này: khởi động lại
   *       host thì profile patch quyết định lại trần.
   * Ném: `TeamError` mã `TEAM_DISPOSED` khi runtime đang dọn, `TEAM_LEAD_REQUIRED` khi người gọi không
   *      phải Lead, `TEAM_INVALID_CONFIG` khi trần không phải số nguyên an toàn dương, và
   *      `TEAM_INVALID_ARGUMENT` khi không đổi trần nào hoặc trần mới thấp hơn mức đang dùng.
   */
  setLimits(caller: Agent, request: SetTeamLimitsRequest): TeamLimitsView {
    if (this.lifecycle.disposed) throw new TeamError("Agent Teams service is disposing", "TEAM_DISPOSED");
    const membership = this.roster.membership(caller);
    if (membership.role !== "lead") {
      throw new TeamError("only the Team Lead can change Team limits", "TEAM_LEAD_REQUIRED");
    }
    if (request.maxMembers === undefined && request.maxTasks === undefined) {
      throw new TeamError("at least one Team limit must be provided", "TEAM_INVALID_ARGUMENT");
    }
    const members = request.maxMembers === undefined ? undefined : positiveLimit("maxMembers", request.maxMembers);
    const tasks = request.maxTasks === undefined ? undefined : positiveLimit("maxTasks", request.maxTasks);
    if (members !== undefined) {
      const current = this.journal.state(membership.root).members.length;
      if (members < current) {
        throw new TeamError(
          `maxMembers cannot be lower than the current teammate count (${current})`,
          "TEAM_INVALID_ARGUMENT",
        );
      }
    }
    if (tasks !== undefined) {
      const current = this.tasks.list(membership).length;
      if (tasks < current) {
        throw new TeamError(`maxTasks cannot be lower than the current task count (${current})`, "TEAM_INVALID_ARGUMENT");
      }
    }
    if (members !== undefined) this.roster.setLimit(members);
    if (tasks !== undefined) this.tasks.setLimit(tasks);
    return { maxMembers: this.roster.limit(), maxTasks: this.tasks.limit() };
  }

  /**
   * Đẩy MỘT tin nhắn ngang hàng vào hộp thư đích hoặc từ chối lượt gửi.
   * Nhận: `caller` — thành viên Team đang gửi; `request` — tên đích, nội dung và tín hiệu huỷ trước
   *       khi được nhận.
   * Trả: danh tính hộp thư đã nhận; việc nhận đi theo persistence Agent thường và KHÔNG chờ model xử lý.
   * Ném: `TeamError` mã `TEAM_DISPOSED` khi runtime đang dọn, và mọi lỗi của lượt giao đã nhận.
   */
  async sendMessage(caller: Agent, request: SendTeamMessageRequest): Promise<SendTeamMessageResult> {
    if (this.lifecycle.disposed) throw new TeamError("Agent Teams service is disposing", "TEAM_DISPOSED");
    return await this.lifecycle.track(
      this.sendAdmitted(caller, {
        ...request,
        signal: AbortSignal.any([request.signal, this.lifecycle.signal]),
      }),
    );
  }

  /**
   * Tạo MỘT task pending chưa có chủ trong log Lead của Team.
   * Nhận: `caller` — thành viên Team đang sống tạo task; `request` — văn bản task, các task chặn và
   *       vùng ghi advisory.
   * Trả: task-view ở revision một.
   */
  async createTask(caller: Agent, request: CreateTeamTaskRequest): Promise<TeamTaskView> {
    return await this.tasks.create(this.roster.membership(caller), request);
  }

  /**
   * Trả MỘT task, kể cả bia mộ đã xoá mềm.
   * Nhận: `caller` — thành viên Team đang đọc task; `id` — danh tính task trong Team.
   * Trả: giá trị task mới nhất kèm chẩn đoán sẵn sàng suy diễn.
   */
  getTask(caller: Agent, id: TeamTaskId): TeamTaskView {
    return this.tasks.get(this.roster.membership(caller), id);
  }

  /**
   * Liệt kê các task chưa xoá theo thứ tự tạo.
   * Nhận: `caller` — thành viên Team đang đọc bảng việc.
   * Trả: các task-view hiện tại đã tách rời khỏi trạng thái.
   */
  listTasks(caller: Agent): TeamTaskView[] {
    return this.tasks.list(this.roster.membership(caller));
  }

  /**
   * So-sánh-và-đặt MỘT chuyển trạng thái task có thẩm quyền.
   * Nhận: `caller` — thành viên Team cấp thẩm quyền; `request` — danh tính task, revision mong đợi,
   *       hành động và trường của hành động.
   * Trả: revision task kế tiếp đã cam kết.
   */
  async updateTask(caller: Agent, request: UpdateTeamTaskRequest): Promise<TeamTaskView> {
    return await this.tasks.update(caller, this.roster.membership(caller), request);
  }

  /**
   * Chờ thay đổi miền Team hoặc trạng thái thành viên kế tiếp.
   * Nhận: `caller` — thành viên Team đang chờ; `timeoutMs` — hạn chờ từ mười giây tới một giờ;
   *       `signal` — huỷ của người gọi cho RIÊNG lượt chờ.
   * Trả: một thay đổi đã quan sát hoặc kết quả hết hạn.
   */
  async waitForChange(caller: Agent, timeoutMs: number, signal: AbortSignal): Promise<TeamWaitResult> {
    const membership = this.roster.membership(caller);
    return await this.activity.wait(membership.id, timeoutMs, signal);
  }

  /**
   * Ngắt MỘT lượt của teammate đang sống mà KHÔNG xoá hộp thư chờ của nó.
   * Nhận: `caller` — Agent Lead đang sống; `targetName` — tên bền vững của teammate.
   * Trả: trạng thái của mục tiêu được lấy mẫu NGAY TRƯỚC khi huỷ.
   */
  interrupt(caller: Agent, targetName: string): { previousStatus: "running" | "inactive" } {
    return this.roster.interrupt(caller, targetName);
  }

  /**
   * Phân giải người gọi mà KHÔNG ném — cho lượt cài tool theo phạm vi và quan sát viên.
   * Nhận: `agent` — Agent đang sống ứng viên.
   * Trả: danh tính Team, hoặc `undefined` với subagent không thuộc Team và danh tính đã cũ.
   */
  tryMembership(agent: Agent): TeamMembership | undefined {
    return this.roster.tryMembership(agent);
  }

  /**
   * Giao MỘT lượt gửi đã nhận bằng thẩm quyền của Lead và danh tính của người gửi thật.
   * Nhận: `caller` — thành viên Team đang gửi; `request` — tên đích, nội dung và tín hiệu huỷ.
   * Trả: danh tính tin đã được hộp thư đích nhận.
   * Ném: `TeamError` khi tự nhắn chính mình, khi vượt trần byte, hoặc lỗi của seam giao tin.
   */
  private async sendAdmitted(caller: Agent, request: SendTeamMessageRequest): Promise<SendTeamMessageResult> {
    const membership = this.roster.membership(caller);
    request.signal.throwIfAborted();
    const { root } = membership;
    const target = resolveActiveMember(root, this.journal.state(root), request.target);
    if (target.id === caller.id) throw new TeamError("a Team member cannot message itself", "TEAM_SELF_MESSAGE");
    const content: ContentBlock[] = [
      { type: "text", text: `Team message from ${membership.name}:` },
      ...structuredClone(request.content),
    ];
    if (Buffer.byteLength(JSON.stringify(content), "utf8") > this.config.maxMessageBytes) {
      throw new TeamError(`team message exceeds ${this.config.maxMessageBytes} bytes`, "TEAM_MESSAGE_TOO_LARGE");
    }
    const source: MessageSource = { kind: "agent-message", form: "relay", senderSessionId: caller.id };
    let messageId: MessageId;
    if (target.id === root.id) {
      const input = createUserMessage({ content, source });
      root.steer(input);
      messageId = input.id;
    } else {
      messageId = await steerHostSubagentPrompt(this.ctx.subagents, root, target.id, content, source, request.signal);
    }
    this.activity.notify(membership.id);
    return { messageId };
  }

  /**
   * Xếp MỘT lượt hoà giải provisioning đã bao lỗi vào microtask sau khi publication đã cuộn xong.
   * Nhận: `agent` — Agent vừa khởi động.
   * Trả: không; lỗi hoà giải chỉ ghi cảnh báo và chỉ khi runtime còn sống.
   */
  private scheduleRecovery(agent: Agent): void {
    queueMicrotask(() => {
      if (this.lifecycle.disposed) return;
      void this.roster.recoverFor(agent, this.lifecycle.signal).catch((error) => {
        if (this.lifecycle.disposed) return;
        this.ctx.logger.warn(`Agent Teams recovery for "${agent.id}" failed: ${errorMessage(error)}`);
      });
    });
  }

  /**
   * Dừng mọi nhánh Team đang sống và giải phóng mọi waiter TRƯỚC khi service dọn xong.
   * Nhận: không.
   * Trả: không; ném `AggregateError` gom mọi lỗi dọn bất ngờ.
   */
  private async disposeRuntime(): Promise<void> {
    this.lifecycle.close();
    this.activity.close();
    const failures: unknown[] = [];
    await this.lifecycle.settle(this.lifecycle.pending(), failures);
    for (const [root, childIds] of this.roster.liveChildrenByRoot()) {
      try {
        await this.roster.stopTeammates(root, childIds);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) throw new AggregateError(failures, "Agent Teams runtime disposal failed");
  }
}

export default TeamService;