/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bảng việc chia sẻ của Team (DAG): TeamTaskBoard — tạo/đọc/liệt kê/cập nhật/xoá task, kiểm đồ thị
 *      phụ thuộc (thiếu/trùng/tự chặn/chu trình) và dựng task-view sẵn sàng/bị chặn — port 1:1
 *      lib/types/task-board.js (234 dòng) của @deepseek-ai/dsh-experimental-agent-team.
 */
import type { Agent } from "@deepseek-ai/dsh-agent";

import { TeamError } from "./error.ts";
import type { TeamJournal } from "./journal.ts";
import type { TeamState } from "./projection.ts";
import { resolveActiveMember } from "./roster.ts";
import type { TeamMembership } from "./roster.ts";
import { assertTaskGraphCandidate, TeamTaskGraphError } from "./task-graph.ts";
import { projectTaskView, taskReady } from "./task-view.ts";
import { TeamId, TeamTaskId } from "./types.ts";
import type { CreateTeamTaskRequest, TeamTaskSnapshot, TeamTaskView, UpdateTeamTaskRequest } from "./types.ts";
import { requiredText, writeScope } from "./validation.ts";

/** Ánh xạ nhóm vi phạm đồ thị dùng chung sang mã lỗi lệnh ổn định (nguyên văn bản gốc). */
const TASK_GRAPH_ERROR_CODES: Record<TeamTaskGraphError["violation"], string> = {
  missing: "TEAM_TASK_NOT_FOUND",
  duplicate: "TEAM_INVALID_ARGUMENT",
  cycle: "TEAM_TASK_DEPENDENCY_CYCLE",
};

/** Sở hữu giới hạn task, thẩm quyền, chuyển trạng thái và các khung nhìn suy diễn của Team. */
export class TeamTaskBoard {
  /** Chủ sở hữu giao dịch log Lead có thẩm quyền. */
  private readonly journal: TeamJournal;
  /** Số task chưa xoá tối đa mà MỘT Team được giữ — đổi được lúc chạy qua {@link TeamTaskBoard.setLimit}. */
  private maxTasks: number;

  /**
   * Dựng bảng việc.
   * Nhận: `journal` — chủ sở hữu giao dịch log Lead; `maxTasks` — số task chưa xoá tối đa của một Team.
   * Trả: không; hai phụ thuộc được giữ cho mọi thao tác task.
   */
  constructor(journal: TeamJournal, maxTasks: number) {
    this.journal = journal;
    this.maxTasks = maxTasks;
  }

  /**
   * Đọc trần task chưa xoá hiện hành của MỘT Team.
   * Nhận: không.
   * Trả: trần task mà bảng việc đang áp.
   */
  limit(): number {
    return this.maxTasks;
  }

  /**
   * Đặt trần task chưa xoá mới cho bảng việc.
   * Nhận: `next` — trần mới, đã do người gọi (TeamService) kiểm là số nguyên an toàn dương và
   *       không thấp hơn số task chưa xoá hiện có.
   * Trả: không; mọi lượt tạo task SAU đó đọc trần mới ở phép kiểm giới hạn.
   */
  setLimit(next: number): void {
    this.maxTasks = next;
  }

  /**
   * Tạo MỘT task pending chưa có chủ trong log Lead của Team.
   * Nhận: `membership` — danh tính người gọi đã do roster phân giải; `request` — văn bản task,
   *       các task chặn và vùng ghi advisory.
   * Trả: task-view ở revision một.
   * Ném: `TeamError` mã `TEAM_TASK_LIMIT` khi chạm trần hoặc cạn không gian id, `TEAM_INVALID_ARGUMENT`
   *      khi văn bản/vùng ghi không hợp lệ, và mã đồ thị khi quan hệ chặn hỏng.
   */
  async create(membership: TeamMembership, request: CreateTeamTaskRequest): Promise<TeamTaskView> {
    const { root } = membership;
    return this.journal.transact(root.id, async () => {
      const state = this.journal.state(root);
      const active = state.tasks.filter((task) => task.status !== "deleted").length;
      if (active >= this.maxTasks) {
        throw new TeamError(`Team task limit ${this.maxTasks} reached`, "TEAM_TASK_LIMIT");
      }
      const id = TeamTaskId(`task-${state.nextTaskNumber}`);
      if (state.tasks.some((task) => task.id === id)) {
        throw new TeamError("Team task id space exhausted", "TEAM_TASK_LIMIT");
      }
      const task: TeamTaskSnapshot = {
        id,
        revision: 1,
        subject: requiredText(request.subject, "subject", 200),
        description: requiredText(request.description, "description", 16_384),
        status: "pending",
        blockedBy: this.dependencies(request.blockedBy ?? [], state),
        writeScopes: this.writeScopes(request.writeScopes ?? []),
      };
      this.assertTaskGraph(state, task);
      await this.journal.appendAndFlush(root, "team/task", { version: 2, teamId: TeamId(root.id), task });
      return projectTaskView(state, task);
    });
  }

  /**
   * Trả MỘT task, kể cả bia mộ đã xoá mềm.
   * Nhận: `membership` — danh tính người gọi đã do roster phân giải; `id` — danh tính task trong Team.
   * Trả: giá trị task mới nhất kèm chẩn đoán sẵn sàng suy diễn.
   * Ném: `TeamError` mã `TEAM_TASK_NOT_FOUND` khi task không tồn tại.
   */
  get(membership: TeamMembership, id: TeamTaskId): TeamTaskView {
    const { root } = membership;
    const state = this.journal.state(root);
    const task = state.tasks.find((candidate) => candidate.id === id);
    if (task === undefined) throw new TeamError(`team task "${id}" not found`, "TEAM_TASK_NOT_FOUND");
    return projectTaskView(state, task);
  }

  /**
   * Liệt kê các task chưa xoá theo thứ tự tạo.
   * Nhận: `membership` — danh tính người gọi đã do roster phân giải.
   * Trả: các task-view hiện tại đã tách rời khỏi trạng thái.
   */
  list(membership: TeamMembership): TeamTaskView[] {
    const { root } = membership;
    const state = this.journal.state(root);
    return state.tasks.filter((task) => task.status !== "deleted").map((task) => projectTaskView(state, task));
  }

  /**
   * So-sánh-và-đặt MỘT chuyển trạng thái task có thẩm quyền.
   * Nhận: `caller` — thành viên Team đang sống cấp thẩm quyền; `membership` — vai trò người gọi và
   *       Lead đang sống chính xác; `request` — danh tính task, revision mong đợi, hành động và
   *       trường của hành động.
   * Trả: revision task kế tiếp đã cam kết.
   * Ném: `TeamError` khi task không tồn tại/đã xoá/revision cũ, khi người gọi không có quyền, khi
   *      chuyển trạng thái không hợp lệ, khi task đang bị chặn, hoặc khi đồ thị thành chu trình.
   */
  async update(caller: Agent, membership: TeamMembership, request: UpdateTeamTaskRequest): Promise<TeamTaskView> {
    const root = membership.root;
    return this.journal.transact(root.id, async () => {
      const state = this.journal.state(root);
      const current = state.tasks.find((task) => task.id === request.taskId);
      if (current === undefined) {
        throw new TeamError(`team task "${request.taskId}" not found`, "TEAM_TASK_NOT_FOUND");
      }
      if (current.revision !== request.expectedRevision) {
        throw new TeamError(
          `stale team task "${current.id}" revision ${request.expectedRevision}; current revision is ${current.revision}`,
          "TEAM_TASK_STALE_REVISION",
        );
      }
      if (current.status === "deleted") throw new TeamError(`team task "${current.id}" is deleted`, "TEAM_TASK_DELETED");
      const lead = membership.role === "lead";
      const owner = current.ownerId === caller.id;
      /** Chặn thao tác không phải của chủ task hoặc Team Lead. */
      const authorizeOwner = (): void => {
        if (!lead && !owner) throw new TeamError("task mutation requires its owner or Team Lead", "TEAM_TASK_UNAUTHORIZED");
      };
      let next: TeamTaskSnapshot;
      switch (request.action) {
        case "claim":
          if (current.ownerId !== undefined && current.ownerId !== caller.id) {
            throw new TeamError(`team task "${current.id}" is owned by another member`, "TEAM_TASK_ALREADY_CLAIMED");
          }
          if (current.status !== "pending" || !taskReady(state, current)) {
            throw new TeamError(`team task "${current.id}" is not ready to claim`, "TEAM_TASK_BLOCKED");
          }
          next = { ...current, status: "in_progress", ownerId: caller.id };
          break;
        case "release":
          authorizeOwner();
          if (current.status !== "in_progress") {
            throw new TeamError("only an in-progress task can be released", "TEAM_TASK_INVALID_TRANSITION");
          }
          next = this.withoutOwner({ ...current, status: "pending" });
          break;
        case "edit":
          authorizeOwner();
          if (request.subject === undefined && request.description === undefined && request.writeScopes === undefined) {
            throw new TeamError("task edit requires subject, description, or write_scopes", "TEAM_INVALID_ARGUMENT");
          }
          next = {
            ...current,
            ...(request.subject === undefined ? {} : { subject: requiredText(request.subject, "subject", 200) }),
            ...(request.description === undefined
              ? {}
              : { description: requiredText(request.description, "description", 16_384) }),
            ...(request.writeScopes === undefined ? {} : { writeScopes: this.writeScopes(request.writeScopes) }),
          };
          break;
        case "set_dependencies":
          authorizeOwner();
          if (request.blockedBy === undefined) {
            throw new TeamError("set_dependencies requires blocked_by", "TEAM_INVALID_ARGUMENT");
          }
          next = { ...current, blockedBy: this.dependencies(request.blockedBy, state, current.id) };
          break;
        case "complete":
          authorizeOwner();
          if (current.status !== "in_progress") {
            throw new TeamError("only an in-progress task can complete", "TEAM_TASK_INVALID_TRANSITION");
          }
          next = { ...current, status: "completed" };
          break;
        case "reopen":
          authorizeOwner();
          if (current.status !== "completed") {
            throw new TeamError("only a completed task can reopen", "TEAM_TASK_INVALID_TRANSITION");
          }
          next = this.withoutOwner({ ...current, status: "pending" });
          break;
        case "reassign": {
          if (!lead) throw new TeamError("only the Team Lead can reassign tasks", "TEAM_LEAD_REQUIRED");
          if (current.status !== "pending" && current.status !== "in_progress") {
            throw new TeamError("only a pending or in-progress task can be reassigned", "TEAM_TASK_INVALID_TRANSITION");
          }
          if (request.owner === undefined || request.owner.trim().length === 0) {
            next = this.withoutOwner({ ...current, status: "pending" });
            break;
          }
          if (!taskReady(state, current)) throw new TeamError(`team task "${current.id}" is blocked`, "TEAM_TASK_BLOCKED");
          const assignee = resolveActiveMember(root, state, request.owner);
          next = { ...current, status: "in_progress", ownerId: assignee.id };
          break;
        }
        case "delete": {
          authorizeOwner();
          const dependent = state.tasks.find(
            (task) => task.status !== "deleted" && task.id !== current.id && task.blockedBy.includes(current.id),
          );
          if (dependent !== undefined) {
            throw new TeamError(`team task "${current.id}" still blocks "${dependent.id}"`, "TEAM_TASK_HAS_DEPENDENTS");
          }
          next = { ...current, status: "deleted" };
          break;
        }
        /* v8 ignore next 2 -- TeamTaskAction là tập đóng và mọi thành viên đã xử lý ở trên. */
        default:
          throw new TeamError(`unsupported task action ${String(request.action)}`, "TEAM_INVALID_ARGUMENT");
      }
      const task: TeamTaskSnapshot = {
        ...next,
        revision: current.revision + 1,
      };
      this.assertTaskGraph(state, task);
      await this.journal.appendAndFlush(root, "team/task", { version: 2, teamId: TeamId(root.id), task });
      return projectTaskView(state, task);
    });
  }

  /**
   * Kiểm và khử trùng các id phụ thuộc theo đồ thị task hiện tại.
   * Nhận: `values` — các id chặn thô; `state` — trạng thái Team cung cấp task anh em; `self` — id
   *       của chính task đang sửa (bỏ trống khi tạo mới).
   * Trả: danh sách id chặn đã kiểm, không trùng, giữ nguyên thứ tự người gọi đưa.
   * Ném: `TeamError` khi task tự chặn, khi trùng id, hoặc khi task chặn không tồn tại/đã xoá.
   */
  private dependencies(values: readonly TeamTaskId[], state: TeamState, self?: TeamTaskId): TeamTaskId[] {
    const seen = new Set<TeamTaskId>();
    const result: TeamTaskId[] = [];
    for (const id of values) {
      if (id === self) throw new TeamError("a team task cannot block itself", "TEAM_TASK_DEPENDENCY_CYCLE");
      if (seen.has(id)) throw new TeamError(`duplicate blocker "${id}"`, "TEAM_INVALID_ARGUMENT");
      const task = state.tasks.find((candidate) => candidate.id === id);
      if (task === undefined || task.status === "deleted") {
        throw new TeamError(`blocker task "${id}" not found`, "TEAM_TASK_NOT_FOUND");
      }
      seen.add(id);
      result.push(id);
    }
    return result;
  }

  /**
   * Chuẩn hoá và khử trùng vùng ghi của task.
   * Nhận: `values` — các tiền tố đường dẫn người dùng viết.
   * Trả: mảng tiền tố đã chuẩn hoá, không trùng.
   * Ném: `TeamError` mã `TEAM_INVALID_WRITE_SCOPE` khi một tiền tố không phải đường dẫn tương đối hợp lệ.
   */
  private writeScopes(values: readonly string[]): string[] {
    return [...new Set(values.map(writeScope))];
  }

  /**
   * Ánh xạ kiểm đồ thị dùng chung sang mã lỗi lệnh ổn định.
   * Nhận: `state` — trạng thái Team hiện tại; `candidate` — snapshot task mới hoặc revision kế tiếp.
   * Trả: không; ném `TeamError` giữ nguyên thông điệp và giữ lỗi gốc làm `cause`.
   */
  private assertTaskGraph(state: TeamState, candidate: TeamTaskSnapshot): void {
    try {
      assertTaskGraphCandidate(state.tasks, candidate);
    } catch (error) {
      /* v8 ignore next -- bộ kiểm dùng chung là câu lệnh DUY NHẤT trong try và chỉ ném đúng lỗi này. */
      if (!(error instanceof TeamTaskGraphError)) throw error;
      throw new TeamError(error.message, TASK_GRAPH_ERROR_CODES[error.violation], { cause: error });
    }
  }

  /**
   * Bỏ trường chủ tuỳ chọn của một task (giữ nguyên hành vi `exactOptionalPropertyTypes` của bản gốc).
   * Nhận: `task` — snapshot cần bỏ chủ.
   * Trả: snapshot mới KHÔNG có thuộc tính `ownerId`.
   */
  private withoutOwner(task: TeamTaskSnapshot): TeamTaskSnapshot {
    const { ownerId: _ownerId, ...without } = task;
    return without;
  }
}
