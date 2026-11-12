/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Port 1:1 `lib/types/roster.js` + `roster.d.ts` của @deepseek-ai/dsh-experimental-agent-team:
 *      danh tính Team ngầm định (implicit root), roster thành viên, tạo teammate continuable, ngắt lượt,
 *      dọn con theo Lead — kèm seam CẤU TRÚC tới agents/sessions/sessionPersistence/sessionProjections/
 *      subagents (khai tại chỗ, KHÔNG augment module nào). THÊM 11/11/2026: `reset` — xoá NHẬT KÝ phiên
 *      của một teammate rồi dựng lại continuation TRÊN CÙNG id phiên (nạp lại từ 0, giữ tên/mô tả).
 */

import { randomUUID } from "node:crypto";

import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { brandString } from "@deepseek-ai/dsh-brand";
import type { MessageId } from "@deepseek-ai/dsh-llm";
import type { Session, SessionId } from "@deepseek-ai/dsh-session";
import type { SessionPersistence } from "@deepseek-ai/dsh-session-persistence";
import type { SessionProjectionRegistry } from "@deepseek-ai/dsh-session-projection";
import { foldSubagentDescriptor, type SubagentRuntime } from "@galaxy-blackhole/gbh-subagent";

/**
 * Kiểu `Agent` mà SEAM `ctx.subagents` (gói GBH) yêu cầu — CẤU TRÚC, không augmentation (ADR 000d, 08/11/2026 dev-1).
 * Kernel cấp `Agent` của bản stock còn gói GBH khai `Agent` của chính nó ⇒ hai kiểu KHÁC DANH TÍNH nhưng CÙNG hình dạng
 * runtime; vì vậy tại BIÊN gọi seam ta ép kiểu (không đổi hành vi, không nới kiểu ở nơi khác).
 */
type SubagentAgentArg = Parameters<SubagentRuntime["drainChildren"]>[0];

import { errorMessage, TeamError } from "./error.ts";
import type { TeamJournal } from "./journal.ts";
import type { TeamRuntimeLifecycle } from "./lifecycle.ts";
import { readPersistedSession } from "./persisted.ts";
import type { TeamState } from "./projection.ts";
import { messageAccepted } from "./session-message.ts";
import { TeamId } from "./types.ts";
import type {
  ResetTeammateRequest,
  ResetTeammateResult,
  SpawnTeammateRequest,
  SpawnTeammateResult,
  TeamMemberPhase,
  TeamMemberSnapshot,
  TeamMemberView,
} from "./types.ts";
import { requiredText } from "./validation.ts";

/** Mẫu tên teammate do model đặt: lower-kebab-case, không hoa, không dấu. */
const MEMBER_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** Số lượt chờ tối đa cho sổ phiên SỐNG nhả id phiên con sau khi dọn Activation (50 × 20ms = 1s). */
const SESSION_RELEASE_ATTEMPTS = 50;
/** Khoảng chờ giữa hai lượt dò sổ phiên sống, tính bằng mili giây. */
const SESSION_RELEASE_INTERVAL_MS = 20;

/** Seam `agents`: sổ Agent ĐANG SỐNG của kernel — đúng hai phương thức roster gọi. */
interface AgentsSeam {
  /**
   * Tra một Agent đang sống theo id phiên.
   * Nhận: `id` — id phiên của Agent.
   * Trả: Agent nếu còn sống, `undefined` nếu đã giải phóng hoặc chưa tồn tại.
   */
  get(id: SessionId): Agent | undefined;
  /**
   * Liệt kê mọi Agent đang sống.
   * Nhận: không.
   * Trả: mảng Agent đang sống (thứ tự của sổ đăng ký).
   */
  list(): Agent[];
}

/**
 * Seam DỊCH VỤ XOÁ PHIÊN (row `session-delete`) mà lượt nạp lại teammate dùng — khai CẤU TRÚC, không
 * augment module nào. Vắng seam này (composition không cài row đó) thì `reset` từ chối thay vì tự tay
 * gỡ thư mục nhật ký.
 */
interface SessionDeleteSeam {
  /**
   * Xoá vĩnh viễn nhật ký của MỘT phiên đã lưu.
   * Nhận: `request` — id phiên cần xoá.
   * Trả: kết quả của dịch vụ (`{ deleted: true, path }`); ném khi phiên còn sống hoặc không tồn tại.
   */
  delete(request: { readonly sessionId: string }): Promise<unknown>;
}

/** Seam `sessions`: sổ phiên sống của kernel — đúng hai phương thức roster gọi. */
interface SessionsSeam {
  /**
   * Tra một phiên đang sống theo id.
   * Nhận: `id` — id phiên.
   * Trả: Session nếu còn sống, `undefined` nếu đã chết hoặc chưa tồn tại.
   */
  get(id: SessionId): Session | undefined;
  /**
   * Đẩy trạng thái phiên xuống kho bền vững và chờ flush xong.
   * Nhận: `session` — phiên cần flush.
   * Trả: promise báo có listener flush nào tham gia hay không.
   */
  flush(session: Session): Promise<boolean>;
}

/**
 * Seam CẤU TRÚC của `ctx` mà roster cần: năm dịch vụ của dịch vụ Team cộng hai sự kiện vòng đời phiên.
 * Khai tại chỗ để không phụ thuộc augmentation của gói kernel nào.
 */
interface TeamRosterHost {
  /** Sổ Agent đang sống — nguồn thẩm quyền cho "Agent còn sống chính xác". */
  readonly agents: AgentsSeam;
  /** Sổ phiên sống — nơi con continuable xuất hiện trước khi kịp flush. */
  readonly sessions: SessionsSeam;
  /** Kho phiên bền vững — chuyển nguyên vẹn cho {@link readPersistedSession}. */
  readonly sessionPersistence: SessionPersistence;
  /**
   * Sổ chiếu phiên — nơi `agentTeam` được chiếu.
   * Roster đọc trạng thái Team qua `TeamJournal.state` nên chỉ khai seam, không gọi trực tiếp.
   */
  readonly sessionProjections: SessionProjectionRegistry;
  /** Bộ quản lý activation con continuable — tạo, ngắt và dọn con theo Lead. */
  readonly subagents: SubagentRuntime;
  /**
   * Tra MỘT dịch vụ TUỲ CHỌN theo khoá Cordis (dùng cho `sessionDelete`).
   * Nhận: `name` — khoá dịch vụ.
   * Trả: thể hiện dịch vụ, hoặc `undefined` khi composition không cài row đó.
   */
  get(name: string): unknown;
  /**
   * Nghe MỘT sự kiện vòng đời phiên và trả hàm dọn.
   * Nhận: `event` — `session/event` hoặc `session/disposed`; `listener` — hàm nhận phiên phát sự kiện.
   * Trả: hàm dọn đăng ký (gọi để ngừng nghe).
   */
  on(event: "session/event" | "session/disposed", listener: (session: Session) => void): () => void;
}

/** Danh tính người gọi trong MỘT Team ngầm định. */
export interface TeamMembership {
  /** Agent gốc (Lead) của Team. */
  readonly root: Agent;
  /** Danh tính Team — chính là danh tính phiên gốc. */
  readonly id: TeamId;
  /** Vai trò của người gọi trong Team. */
  readonly role: "lead" | "teammate";
  /** Tên do model đặt cho thành viên (`lead` cho Lead). */
  readonly name: string;
}

/**
 * Phân giải MỘT thành viên Team đang hoạt động theo tên do model đặt, kể cả dòng giả `lead`.
 * Nhận: `root` — Lead Team đang sống chính xác; `state` — trạng thái Team hiện tại;
 *       `rawName` — tên thành viên ứng viên.
 * Trả: id bền vững đã phân giải và tên đã chuẩn hoá (cắt khoảng trắng hai đầu).
 * Ném: `TeamError` mã `TEAM_MEMBER_NOT_FOUND` khi không có teammate `active` mang tên đó.
 */
export function resolveActiveMember(
  root: Agent,
  state: TeamState,
  rawName: string,
): { id: SessionId; name: string } {
  const name = rawName.trim();
  if (name === "lead") return { id: root.id, name };
  const member = state.members.find((candidate) => candidate.name === name);
  if (member === undefined || member.phase !== "active") {
    throw new TeamError(`active teammate "${name}" not found`, "TEAM_MEMBER_NOT_FOUND");
  }
  return { id: member.id, name };
}

/** Sở hữu danh tính Team và vòng đời các con continuable nằm trong roster. */
export class TeamRoster {
  /** Context cordis nhìn qua seam cấu trúc của dịch vụ Team. */
  private readonly ctx: TeamRosterHost;
  /** Chủ sở hữu giao dịch log của Lead — nguồn trạng thái Team có thẩm quyền. */
  private readonly journal: TeamJournal;
  /** Cổng tiếp nhận runtime Team dùng chung. */
  private readonly lifecycle: TeamRuntimeLifecycle;
  /** Số mục roster bất biến tối đa của một Team — đổi được lúc chạy qua {@link TeamRoster.setLimit}. */
  private maxMembers: number;

  /**
   * Nhận: `ctx` — context dịch vụ Team có agents, sessions, persistence và subagents;
   *       `journal` — chủ sở hữu giao dịch log Lead; `lifecycle` — cổng tiếp nhận runtime Team;
   *       `maxMembers` — số mục roster bất biến tối đa của một Team.
   * Trả: không; giữ bốn phụ thuộc cho các thao tác roster.
   */
  constructor(ctx: Context, journal: TeamJournal, lifecycle: TeamRuntimeLifecycle, maxMembers: number) {
    // Seam CẤU TRÚC: nhìn `ctx` qua đúng năm dịch vụ roster dùng, không augment module nào.
    this.ctx = ctx as unknown as TeamRosterHost;
    this.journal = journal;
    this.lifecycle = lifecycle;
    this.maxMembers = maxMembers;
  }

  /**
   * Đọc trần thành viên hiện hành mà roster đang áp.
   * Nhận: không.
   * Trả: trần mục roster của MỘT Team tại thời điểm gọi.
   */
  limit(): number {
    return this.maxMembers;
  }

  /**
   * Đặt trần thành viên mới cho roster.
   * Nhận: `next` — trần mới, đã do người gọi (TeamService) kiểm là số nguyên an toàn dương và
   *       không thấp hơn số thành viên hiện có.
   * Trả: không; mọi lượt spawn SAU đó đọc trần mới ở phép kiểm giới hạn.
   */
  setLimit(next: number): void {
    this.maxMembers = next;
  }

  /**
   * Phân giải vai trò Team của MỘT Agent đang sống chính xác.
   * Nhận: `agent` — Agent đang sống dùng làm thẩm quyền.
   * Trả: root, danh tính Team, vai trò và tên do model đặt của người gọi.
   * Ném: `TeamError` mã `TEAM_NOT_MEMBER` khi Agent không thuộc Team đang hoạt động nào.
   */
  membership(agent: Agent): TeamMembership {
    const membership = this.tryMembership(agent);
    if (membership === undefined) {
      throw new TeamError(`agent "${agent.id}" is not a member of an active Agent Team`, "TEAM_NOT_MEMBER");
    }
    return membership;
  }

  /**
   * Phân giải người gọi mà KHÔNG ném — cho lượt cài theo phạm vi và quan sát viên vòng đời.
   * Nhận: `agent` — Agent đang sống ứng viên.
   * Trả: danh tính Team, hoặc `undefined` với subagent không thuộc Team và danh tính đã cũ.
   */
  tryMembership(agent: Agent): TeamMembership | undefined {
    if (this.ctx.agents.get(agent.id) !== agent) return undefined;
    try {
      const parentId = agent.session.header.parentSession;
      if (parentId !== undefined) {
        const root = this.ctx.agents.get(parentId);
        if (root !== undefined) {
          const member = this.journal.state(root).members.find((candidate) => candidate.id === agent.id);
          if (member?.phase === "active" || member?.phase === "provisioning") {
            return { root, id: TeamId(root.id), role: "teammate", name: member.name };
          }
          // Con trực tiếp nằm NGOÀI roster bền vững không phải teammate. Fork thường của host là
          // root độc lập; descriptor subagent phân biệt worker do provider sở hữu — chúng không
          // được nhận danh tính Team lồng nhau.
          if (this.subagentDescriptor(agent)) return undefined;
          return { root: agent, id: TeamId(agent.id), role: "lead", name: "lead" };
        }
      }
      // Một continuation có thể sống lâu hơn parent chốc lát khi dọn con trước. Không diễn giải
      // lại đứa con bền vững đó thành Team root ngầm định mới. Fork thường được host resume không
      // có descriptor trong suffix của chính nó nên vẫn là root mới hợp lệ, còn bản ghi Team thừa
      // kế nằm ngoài trạng thái Team đã chiếu của nó.
      if (this.subagentDescriptor(agent)) return undefined;
      return { root: agent, id: TeamId(agent.id), role: "lead", name: "lead" };
    } catch {
      // Phương thức này được quan sát viên vòng đời và bộ dò dọn dẹp dùng. Luồng bền vững hỏng sẽ
      // do thao tác Team có thẩm quyền ném ra; phép dò KHÔNG ném này không được phủ quyết các
      // cạnh vòng đời Agent không liên quan.
      return undefined;
    }
  }

  /**
   * Liệt kê roster đã làm giàu runtime mà MỘT thành viên Team nhìn thấy.
   * Nhận: `membership` — danh tính người gọi đã do roster này phân giải.
   * Trả: dòng Lead rồi các dòng teammate theo thứ tự tạo.
   */
  list(membership: TeamMembership): TeamMemberView[] {
    const { root } = membership;
    const state = this.journal.state(root);
    const result: TeamMemberView[] = [
      {
        id: root.id,
        name: "lead",
        role: "lead",
        status: availability(root),
        ...(root.options.model === undefined ? {} : { model: root.options.model }),
        diagnostics: [],
      },
    ];
    for (const member of state.members) {
      const live = this.ctx.agents.get(member.id);
      const model = live?.options.model ?? root.options.model;
      result.push({
        id: member.id,
        name: member.name,
        role: "teammate",
        status:
          member.phase === "failed"
            ? "failed"
            : member.phase === "provisioning"
              ? "provisioning"
              : availability(live),
        description: member.description,
        provider: member.provider,
        context: member.context,
        ...(model === undefined ? {} : { model }),
        diagnostics: member.error === undefined ? [] : [member.error],
      });
    }
    return result;
  }

  /**
   * Tạo MỘT con trực tiếp continuable có tên của Lead Team.
   * Nhận: `caller` — Agent Lead đang sống chính xác; `request` — tên, mô tả, prompt, chế độ
   *       context, provider và tín hiệu huỷ đã chốt.
   * Trả: dòng roster `active` sau khi con nhận prompt đầu tiên một cách bền vững.
   * Ném: `TeamError` khi dịch vụ đang dọn (`TEAM_DISPOSED`), khi người gọi không phải Lead
   *      (`TEAM_LEAD_REQUIRED`), khi tên/giới hạn/hội tụ provisioning vi phạm.
   */
  async spawn(caller: Agent, request: SpawnTeammateRequest): Promise<SpawnTeammateResult> {
    if (this.lifecycle.disposed) throw new TeamError("Agent Teams service is disposing", "TEAM_DISPOSED");
    return await this.lifecycle.track(this.spawnAdmitted(caller, request));
  }

  /**
   * Hoà giải trạng thái provisioning khi MỘT phiên thành viên Team khởi động.
   * Nhận: `agent` — Agent đang sống vừa khởi động; `signal` — tín hiệu huỷ runtime dùng chung.
   * Trả: không; Lead chỉ hoà giải khi chính nó là Lead của Team.
   */
  async recoverFor(agent: Agent, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    const membership = this.tryMembership(agent);
    if (membership?.role === "lead") await this.reconcileProvisioning(membership.root, signal);
  }

  /**
   * Ngắt MỘT lượt của teammate đang sống mà KHÔNG xoá hộp thư chờ của nó.
   * Nhận: `caller` — Agent Lead đang sống chính xác; `targetName` — tên bền vững của teammate.
   * Trả: trạng thái của mục tiêu được lấy mẫu NGAY TRƯỚC khi huỷ.
   * Ném: `TeamError` khi người gọi không phải Lead, mục tiêu không phải teammate `active`,
   *      hoặc mục tiêu chính là Lead.
   */
  interrupt(caller: Agent, targetName: string): { previousStatus: "running" | "inactive" } {
    const membership = this.membership(caller);
    if (membership.role !== "lead") {
      throw new TeamError("only the Team Lead can interrupt teammates", "TEAM_LEAD_REQUIRED");
    }
    const state = this.journal.state(membership.root);
    const target = resolveActiveMember(membership.root, state, targetName);
    if (target.id === membership.root.id) {
      throw new TeamError("the Team Lead cannot interrupt itself", "TEAM_INVALID_TARGET");
    }
    const live = this.ctx.agents.get(target.id);
    if (live === undefined) return { previousStatus: "inactive" };
    const previousStatus = availability(live);
    this.ctx.subagents.interrupt(target.id, { kind: "ancestor", agent: caller as unknown as SubagentAgentArg });
    return { previousStatus };
  }

  /**
   * NẠP LẠI MỘT teammate từ ĐẦU: dừng lượt đang chạy, xoá vĩnh viễn nhật ký phiên của nó, rồi dựng lại
   * continuation TRÊN CÙNG id phiên với prompt mới. Tên · mô tả · provider trong roster KHÔNG đổi, nên
   * `list_agents`, `send_message` và `wait_agent` vẫn nhắm đúng mục tiêu cũ — chỉ bộ nhớ hội thoại (và
   * mọi tin chờ trong hộp thư của nó) bị xoá.
   *
   * Vì sao phải xoá nhật ký: bản ghi roster chỉ-thêm của bản gốc khoá tên teammate VĨNH VIỄN và không có
   * pha "đã xoá", nên con đường DUY NHẤT để giữ nguyên danh tính là tái dùng đúng id phiên; mà
   * `startActivation` từ chối id đã có nhật ký (`DUPLICATE_CHILD`). Xem ADR 0013 và
   * docs/GBH-SAI-KHAC-CO-CHU-DICH.md §6.
   *
   * Nhận: `caller` — Agent Lead đang sống chính xác; `request` — tên teammate đích, prompt mới (bỏ trống
   *       thì dùng mô tả của chính teammate) và tín hiệu huỷ.
   * Trả: dòng roster của teammate sau khi continuation mới nhận prompt đầu tiên bền vững.
   * Ném: `TeamError` mã `TEAM_DISPOSED` (runtime đang dọn), `TEAM_LEAD_REQUIRED`, `TEAM_MEMBER_NOT_FOUND`
   *      (không có teammate `active` mang tên đó), `TEAM_INVALID_TARGET` (đích là Lead),
   *      `TEAM_RESET_UNAVAILABLE` (composition thiếu dịch vụ xoá phiên), `TEAM_RESET_BLOCKED` (sổ phiên
   *      sống chưa nhả id sau khi dọn), và mọi lỗi của lượt dựng lại.
   */
  async reset(caller: Agent, request: ResetTeammateRequest): Promise<ResetTeammateResult> {
    if (this.lifecycle.disposed) throw new TeamError("Agent Teams service is disposing", "TEAM_DISPOSED");
    const membership = this.membership(caller);
    if (membership.role !== "lead") {
      throw new TeamError("only the Team Lead can reset teammates", "TEAM_LEAD_REQUIRED");
    }
    const signal = AbortSignal.any([request.signal, this.lifecycle.signal]);
    signal.throwIfAborted();
    const root = membership.root;
    const state = this.journal.state(root);
    const target = resolveActiveMember(root, state, request.target);
    if (target.id === root.id) {
      throw new TeamError("the Team Lead cannot reset itself", "TEAM_INVALID_TARGET");
    }
    const member = state.members.find((candidate) => candidate.id === target.id);
    /* v8 ignore next -- resolveActiveMember chỉ trả thành viên phase "active" nằm trong state.members. */
    if (member === undefined) throw new TeamError(`active teammate "${target.name}" not found`, "TEAM_MEMBER_NOT_FOUND");
    const deletion = this.ctx.get("sessionDelete") as SessionDeleteSeam | undefined;
    if (deletion === undefined) {
      throw new TeamError("resetting a teammate requires the session-delete service", "TEAM_RESET_UNAVAILABLE");
    }
    // 1. Dừng lượt đang chạy rồi chờ sổ phiên SỐNG nhả id — nếu không, bước 3 sẽ bị DUPLICATE_CHILD.
    await this.stopTeammates(root, [target.id]);
    await this.awaitSessionRelease(target.id);
    // 2. Xoá nhật ký phiên con: đó là TOÀN BỘ bộ nhớ hội thoại của teammate.
    await deletion.delete({ sessionId: target.id });
    signal.throwIfAborted();
    // 3. Dựng lại continuation TRÊN CÙNG id phiên ⇒ roster không đổi, bộ nhớ bắt đầu từ 0.
    const prompt = request.prompt ?? [{
      type: "text" as const,
      text: `Continue as teammate "${member.name}". Your responsibility: ${member.description}.`,
    }];
    const started = await this.ctx.subagents.startActivation({
      delivery: "parent",
      childId: target.id,
      provider: member.provider,
      label: member.description,
      request: {
        prompt,
        parent: root as unknown as SubagentAgentArg,
      },
      signal,
    });
    await this.checkpointInitialPrompt(target.id, started.messageId, signal);
    return { member: this.memberView(member) };
  }

  /**
   * Chờ sổ phiên SỐNG của kernel nhả MỘT id phiên con sau khi Activation của nó đã dọn.
   * Nhận: `id` — id phiên con cần nhả.
   * Trả: promise hoàn tất khi id không còn trong sổ phiên sống.
   * Ném: `TeamError` mã `TEAM_RESET_BLOCKED` khi hết trần chờ mà phiên vẫn còn được nạp.
   */
  private async awaitSessionRelease(id: SessionId): Promise<void> {
    for (let attempt = 0; attempt < SESSION_RELEASE_ATTEMPTS; attempt += 1) {
      if (this.ctx.sessions.get(id) === undefined) return;
      await new Promise((resolve) => setTimeout(resolve, SESSION_RELEASE_INTERVAL_MS));
    }
    throw new TeamError(`teammate "${id}" Session is still loaded in this process`, "TEAM_RESET_BLOCKED");
  }

  /**
   * Gom các con roster đang sống theo Lead hiện tại của chúng để dọn runtime.
   * Nhận: không.
   * Trả: map mỗi Lead đang sống tới id các con roster còn trong sổ Agent.
   */
  liveChildrenByRoot(): Map<Agent, SessionId[]> {
    const teams = new Map<Agent, SessionId[]>();
    for (const agent of this.ctx.agents.list()) {
      const rootId = agent.session.header.parentSession;
      if (rootId === undefined) continue;
      const root = this.ctx.agents.get(rootId);
      if (root === undefined || !this.journal.state(root).members.some((member) => member.id === agent.id)) {
        continue;
      }
      const children = teams.get(root) ?? [];
      children.push(agent.id);
      teams.set(root, children);
    }
    return teams;
  }

  /**
   * Giải phóng đúng các Activation teammate qua chủ sở hữu vòng đời continuation.
   * Nhận: `root` — Lead Team đang sống cấp thẩm quyền giải phóng; `childIds` — id con roster đã chọn.
   * Trả: promise hoàn tất khi các con đã được dọn trong hạn định của lifecycle.
   */
  async stopTeammates(root: Agent, childIds: readonly SessionId[]): Promise<void> {
    await this.lifecycle.withTimeout(this.ctx.subagents.drainChildren(root as unknown as SubagentAgentArg, childIds));
  }

  /**
   * Thực hiện MỘT lần tạo đã được tiếp nhận trước cổng dọn runtime Team.
   * Nhận: `caller` — Agent Lead đang sống chính xác; `request` — yêu cầu tạo teammate đã chốt.
   * Trả: dòng roster `active`; ghi cạnh `failed` bền vững rồi ném lại lỗi gốc khi tạo hỏng.
   */
  private async spawnAdmitted(caller: Agent, request: SpawnTeammateRequest): Promise<SpawnTeammateResult> {
    const membership = this.membership(caller);
    if (membership.role !== "lead") {
      throw new TeamError("only the Team Lead can create teammates", "TEAM_LEAD_REQUIRED");
    }
    const signal = AbortSignal.any([request.signal, this.lifecycle.signal]);
    signal.throwIfAborted();
    const root = membership.root;
    const name = this.memberName(request.name);
    const description = requiredText(request.description, "description", 200);
    const childId = brandString<SessionId>(randomUUID());
    const member: TeamMemberSnapshot = {
      id: childId,
      name,
      description,
      provider: requiredText(request.provider, "provider", 200),
      context: request.context,
      phase: "provisioning",
    };
    await this.journal.transact(root.id, async () => {
      const state = this.journal.state(root);
      if (state.members.some((candidate) => candidate.name === name)) {
        throw new TeamError(`teammate name "${name}" was already used in this Team`, "TEAM_MEMBER_NAME_TAKEN");
      }
      if (state.members.length >= this.maxMembers) {
        throw new TeamError(`Team member limit ${this.maxMembers} reached`, "TEAM_MEMBER_LIMIT");
      }
      await this.journal.appendAndFlush(root, "team/member", { version: 2, teamId: TeamId(root.id), member });
    });
    try {
      const started = await this.ctx.subagents.startActivation({
        delivery: "parent",
        childId,
        provider: request.provider,
        label: description,
        request: {
          prompt: request.prompt,
          parent: root as unknown as SubagentAgentArg,
        },
        signal,
      });
      await this.checkpointInitialPrompt(childId, started.messageId, signal);
    } catch (error) {
      const failed: TeamMemberSnapshot = {
        ...member,
        phase: "failed",
        error: errorMessage(error),
      };
      try {
        const phase = await this.settleProvisioning(root, failed);
        await this.stopTeammates(root, [childId]);
        if (phase === "active") {
          throw new TeamError(
            `teammate "${name}" became active while its creator reported failure`,
            "TEAM_PROVISIONING_CONFLICT",
            { cause: error },
          );
        }
      } catch (recordError) {
        throw new AggregateError([error, recordError], "teammate creation and durable failure recording both failed");
      }
      throw error;
    }
    const active: TeamMemberSnapshot = {
      ...member,
      phase: "active",
    };
    // Một khi continuation đã nhận prompt đầu tiên, nó là con thật. Nếu checkpoint này hỏng, giữ
    // cạnh `active` trong bộ nhớ thay vì bịa ra chuyển trạng thái active -> failed bất khả; lần
    // hoà giải sau restart sẽ phủ tiền tố bền vững chỉ có provisioning.
    const settledPhase = await this.settleProvisioning(root, active);
    if (settledPhase === "failed") {
      const conflict = new TeamError(
        `teammate "${name}" was reconciled as failed while creation was in progress`,
        "TEAM_PROVISIONING_CONFLICT",
      );
      try {
        await this.stopTeammates(root, [childId]);
      } catch (cleanupError) {
        /* v8 ignore next -- cần đồng thời hội tụ HMR (đã test riêng) và dọn dẹp hỏng. */
        throw new AggregateError([conflict, cleanupError], "provisioning conflict cleanup failed");
      }
      throw conflict;
    }
    return { member: this.memberView(active) };
  }

  /**
   * Flush mục hộp thư đầu tiên đã được chấp nhận TRƯỚC khi Lead được commit trạng thái `active`.
   * Nhận: `childId` — id phiên con; `messageId` — id thư đã chấp nhận; `signal` — tín hiệu huỷ.
   * Trả: promise hoàn tất khi prompt đầu tiên bền vững (hoặc phiên con đã chết với sự kiện đó).
   * Ném: `TeamError` `TEAM_PROVISIONING_CONFLICT` khi prompt đầu tiên không được chấp nhận bền vững.
   */
  private async checkpointInitialPrompt(
    childId: SessionId,
    messageId: MessageId,
    signal: AbortSignal,
  ): Promise<void> {
    while (true) {
      signal.throwIfAborted();
      const session = this.ctx.sessions.get(childId);
      if (session === undefined) {
        const stored = await readPersistedSession(this.ctx.sessionPersistence, childId, signal);
        const suffix = stored.events.slice(stored.inheritedEventCount);
        if (messageAccepted(suffix, (message) => message.id === messageId)) return;
        throw new TeamError(
          `teammate "${childId}" initial prompt was not durably accepted`,
          "TEAM_PROVISIONING_CONFLICT",
        );
      }
      const progress = Promise.withResolvers<void>();
      // Abort có thể thắng trong khi flush bền vững còn chờ; đánh dấu rejection sẽ được await sau
      // là ĐÃ xử lý mà không đổi kết quả cuối cùng của nó.
      void progress.promise.catch(() => undefined);
      const stopEvent = this.ctx.on("session/event", (candidate) => {
        if (candidate === session) progress.resolve();
      });
      const stopDisposed = this.ctx.on("session/disposed", (candidate) => {
        if (candidate === session) progress.resolve();
      });
      const onAbort = (): void => {
        const reason = signal.reason;
        progress.reject(
          reason instanceof Error
            ? reason
            : new TeamError(`teammate creation aborted: ${errorMessage(reason)}`, "TEAM_DISPOSED"),
        );
      };
      signal.addEventListener("abort", onAbort, { once: true });
      try {
        signal.throwIfAborted();
        await this.ctx.sessions.flush(session);
        // oxlint-disable-next-line typescript/no-deprecated -- đọc lịch sử Session có sẵn; hoãn chuyển đổi.
        const suffix = session.snapshotEvents(session.inheritedEventCount);
        if (messageAccepted(suffix, (message) => message.id === messageId)) return;
        if (this.ctx.sessions.get(childId) !== session) continue;
        await progress.promise;
      } finally {
        signal.removeEventListener("abort", onAbort);
        stopDisposed();
        stopEvent();
      }
    }
  }

  /**
   * Kết toán các thành viên CHỈ có provisioning từ phiên con bền vững độc lập của chúng.
   * Nhận: `root` — Lead Team đang sống chính xác; `signal` — tín hiệu huỷ runtime.
   * Trả: không; mỗi mục provisioning lặng được ghi một cạnh `active` hoặc `failed` bền vững.
   */
  private async reconcileProvisioning(root: Agent, signal: AbortSignal): Promise<void> {
    const provisioning = this.journal.state(root).members.filter((member) => member.phase === "provisioning");
    for (const member of provisioning) {
      signal.throwIfAborted();
      // Con còn sống nghĩa là việc tạo vẫn đang hoàn tất trong tiến trình này. Người tạo sở hữu
      // cạnh thành viên kết thúc.
      if (this.ctx.agents.get(member.id) !== undefined) continue;
      let phase: TeamMemberPhase = "failed";
      let failure = "provisioning did not leave a resumable child Session";
      try {
        const loaded = await readPersistedSession(this.ctx.sessionPersistence, member.id, signal);
        const suffix = loaded.events.slice(loaded.inheritedEventCount);
        const descriptor = foldSubagentDescriptor(suffix);
        const acceptedInitialPrompt = messageAccepted(suffix, (message) => message.source.kind === "user");
        if (
          loaded.header.parentSession === root.id &&
          descriptor?.mode === "continuable" &&
          descriptor.provider === member.provider &&
          acceptedInitialPrompt
        ) {
          phase = "active";
        } else {
          failure = "persisted child Session does not match the provisioned continuation";
        }
      } catch (error) {
        failure = `child Session recovery failed: ${errorMessage(error)}`;
      }
      signal.throwIfAborted();
      await this.journal.transact(root.id, async () => {
        signal.throwIfAborted();
        const current = this.journal.state(root).members.find((candidate) => candidate.id === member.id);
        if (current?.phase !== "provisioning") return;
        const settled: TeamMemberSnapshot = {
          ...current,
          phase,
          ...(phase === "failed" ? { error: failure } : {}),
        };
        await this.journal.appendAndFlush(root, "team/member", {
          version: 2,
          teamId: TeamId(root.id),
          member: settled,
        });
      });
    }
  }

  /**
   * Dựng MỘT dòng thành viên runtime sau khi tạo thành công.
   * Nhận: `member` — ảnh chụp thành viên vừa `active`.
   * Trả: dòng roster kèm trạng thái lượt và model hiện tại của Agent sống (nếu có).
   */
  private memberView(member: TeamMemberSnapshot): TeamMemberView {
    const live = this.ctx.agents.get(member.id);
    return {
      id: member.id,
      name: member.name,
      role: "teammate",
      status: availability(live),
      description: member.description,
      provider: member.provider,
      context: member.context,
      ...(live?.options.model === undefined ? {} : { model: live.options.model }),
      diagnostics: [],
    };
  }

  /**
   * Kiểm tra tên teammate do model đặt — tên KHÔNG BAO GIỜ được tái sử dụng.
   * Nhận: `value` — tên thô từ yêu cầu tạo.
   * Trả: chính tên đó khi hợp lệ (lower-kebab-case, ≤ 64 ký tự, không phải `lead`).
   * Ném: `TeamError` mã `TEAM_INVALID_MEMBER_NAME` khi tên vi phạm.
   */
  private memberName(value: string): string {
    if (!MEMBER_NAME.test(value) || value.length > 64 || value === "lead") {
      throw new TeamError(
        'teammate name must be lower-kebab-case, at most 64 characters, and not "lead"',
        "TEAM_INVALID_MEMBER_NAME",
      );
    }
    return value;
  }

  /**
   * Ghi MỘT cạnh provisioning kết thúc, trừ khi hoà giải đã kết toán trước đó.
   * Nhận: `root` — Lead Team đang sống chính xác; `terminal` — ảnh chụp thành viên kết thúc.
   * Trả: pha hiện tại sau giao dịch (`active` hoặc `failed`).
   * Ném: `TeamError` `TEAM_PROVISIONING_CONFLICT` khi mục provisioning đã biến mất.
   */
  private async settleProvisioning(root: Agent, terminal: TeamMemberSnapshot): Promise<TeamMemberPhase> {
    return this.journal.transact(root.id, async () => {
      const current = this.journal.state(root).members.find((member) => member.id === terminal.id);
      /* v8 ignore next 3 -- sự kiện provisioning chỉ-thêm đã được chính thao tác này commit trước khi kết toán. */
      if (current === undefined) {
        throw new TeamError(`provisioned teammate "${terminal.id}" disappeared`, "TEAM_PROVISIONING_CONFLICT");
      }
      if (current.phase !== "provisioning") return current.phase;
      await this.journal.appendAndFlush(root, "team/member", {
        version: 2,
        teamId: TeamId(root.id),
        member: terminal,
      });
      return terminal.phase === "active" ? "active" : "failed";
    });
  }

  /**
   * Cho biết suffix của CHÍNH phiên có nhận diện một con subagent do provider sở hữu hay không.
   * Nhận: `agent` — Agent đang sống cần dò.
   * Trả: `true` khi suffix riêng của phiên có descriptor subagent, ngược lại `false`.
   */
  private subagentDescriptor(agent: Agent): boolean {
    // oxlint-disable-next-line typescript/no-deprecated -- đọc lịch sử Session có sẵn; hoãn chuyển đổi.
    return foldSubagentDescriptor(agent.session.snapshotEvents(agent.session.inheritedEventCount)) !== undefined;
  }
}

/**
 * Mức sẵn sàng của lượt, ĐỘC LẬP với việc Agent đã được nạp hay chưa.
 * Nhận: `agent` — Agent đang sống, hoặc `undefined` khi không còn sống.
 * Trả: `running` khi Agent đang chạy lượt, ngược lại `inactive`.
 */
function availability(agent: Agent | undefined): "running" | "inactive" {
  return agent?.status === "running" ? "running" : "inactive";
}