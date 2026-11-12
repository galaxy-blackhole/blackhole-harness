/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Definition su kien BEN cua workflow run: gop tool-workflow/* thanh MOT node Chat co khoa
 */

/** Trạng thái sống của một thành viên workflow (đóng). */
export type WorkflowMemberStatus = "running" | "completed" | "failed" | "cancelled" | "interrupted";

/** Lý do dừng của cả lượt chạy. */
export type WorkflowStopReason = "completed" | "cancelled" | "error";

/** Kết quả của một thành viên. */
export type WorkflowAgentOutcome = "completed" | "cancelled" | "failed";

/** Một thành viên đã ghi vào state bền. */
export interface WorkflowMember {
  /** Số thứ tự sự kiện `agent-start` (khoá React). */
  seq: number;
  /** Nhãn hiển thị. */
  label: string;
  /** Pha mà thành viên thuộc về; VẮNG MẶT khác với chuỗi rỗng. */
  phase?: string;
  /** Phiên con của thành viên. */
  childId: string;
  /** Kết quả, khi đã có `agent-end`. */
  outcome?: WorkflowAgentOutcome;
}

/** State bền của một lượt chạy. */
export interface WorkflowRunState {
  /** Tên lượt chạy. */
  name: string;
  /** Các thành viên theo thứ tự bắt đầu. */
  members: WorkflowMember[];
  /** Lý do dừng, khi đã có `run-end`. */
  stopReason?: WorkflowStopReason;
}

/** Vị trí (Step/Turn) mà node neo vào. */
export interface WorkflowLocation {
  /** Loại vị trí. */
  kind: string;
  /** Turn chứa vị trí này (nếu có). */
  turn?: { end?: { data: { reason: { kind: string } } } };
}

/** Sự kiện bền mà Definition này nhận. */
export interface WorkflowEvent {
  /** Loại sự kiện `tool-workflow/*`. */
  type: string;
  /** Số thứ tự sự kiện trong phiên. */
  seq: number;
  /** Dữ liệu của sự kiện. */
  data: Record<string, unknown>;
}

/** Ngữ cảnh mà seam hội thoại cấp cho Definition. */
export interface WorkflowDefinitionContext {
  /** Khoá node. */
  key: string;
  /** Id node. */
  id: string;
  /** State bền hiện tại. */
  state: WorkflowRunState;
  /** Sự kiện mở node (nếu đã có). */
  start?: { event: WorkflowEvent; location: WorkflowLocation };
}

/** Một thành viên đã chiếu cho renderer. */
export interface ProjectedMember {
  /** Số thứ tự `agent-start`. */
  seq: number;
  /** Nhãn. */
  label: string;
  /** Phiên con. */
  childId: string;
  /** Trạng thái sống. */
  status: WorkflowMemberStatus;
}

/** Một pha đã chiếu cho renderer. */
export interface ProjectedPhase {
  /** Khoá pha (phân biệt vắng mặt với rỗng). */
  key: string;
  /** Tên pha, hoặc `null` khi member không khai pha. */
  phase: string | null;
  /** Thành viên trong pha. */
  members: ProjectedMember[];
}

/** Dữ liệu mà node Chat mang. */
export interface ProjectedRun {
  /** Tên lượt chạy. */
  name: string;
  /** Trạng thái cả lượt. */
  status: WorkflowMemberStatus;
  /** Các pha. */
  phases: ProjectedPhase[];
}

/** Node Chat đã dựng. */
export interface WorkflowViewNode {
  /** Khoá node. */
  key: string;
  /** Loại node. */
  kind: "workflow-run";
  /** Id node. */
  id: string;
  /** Đích render. */
  target: "chat";
  /** Neo theo số thứ tự sự kiện. */
  anchorSeq: number;
  /** Vị trí neo. */
  location: WorkflowLocation;
  /** Hiển thị. */
  visibility: "visible";
  /** Dữ liệu đã chiếu. */
  data: ProjectedRun;
}

/** Definition mà seam `uiConversation.events` nhận. */
export interface WorkflowRunDefinition {
  /** Loại node. */
  kind: "workflow-run";
  /** Đích. */
  target: "chat";
  /**
   * Ghép một sự kiện vào node này.
   * Nhận: `event` — sự kiện phiên.
   * Trả: `{ id, role }` khi sự kiện thuộc họ này, `null` khi không.
   */
  match(event: WorkflowEvent): { id: string; role: "start" | "update" } | null;
  /**
   * State ban đầu của node.
   * Nhận: `context` — ngữ cảnh (chưa có state), `match` — kết quả `match`.
   * Trả: state rỗng có tên lượt chạy.
   * @throws khi sự kiện mở không phải `run-start`.
   */
  start(context: WorkflowDefinitionContext, match: { event: WorkflowEvent }): { name: string; members: WorkflowMember[] };
  /**
   * Gấp một sự kiện cập nhật vào state.
   * Nhận: `context` — ngữ cảnh có state, `match` — kết quả `match`.
   * Trả: state mới (hoặc nguyên state khi sự kiện không đổi gì).
   */
  update(context: WorkflowDefinitionContext, match: { event: WorkflowEvent }): WorkflowRunState;
  /**
   * Dựng node để renderer vẽ.
   * Nhận: `context` — ngữ cảnh có state và sự kiện mở.
   * Trả: node Chat, hoặc `null` khi chưa có `run-start`.
   */
  buildViewNode(context: WorkflowDefinitionContext): WorkflowViewNode | null;
}

/**
 * Khoá pha không đụng nhau, giữ phân biệt giữa VẮNG MẶT và RỖNG.
 * Nhận: `phase` — chuỗi pha chính xác, hoặc `null` khi trường bị bỏ.
 * Trả: khoá ổn định cho danh tính pha đó.
 */
export function workflowPhaseKey(phase: string | null): string {
  return phase === null ? "missing" : "value:" + String(phase.length) + ":" + phase;
}

/**
 * Dịch lý do dừng của lượt chạy thành trạng thái hiển thị.
 * Nhận: `stopReason` — lý do dừng.
 * Trả: trạng thái tương ứng (`error` ⇒ `failed`).
 */
export function statusFromStopReason(stopReason: string): WorkflowMemberStatus {
  switch (stopReason) {
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "error":
      return "failed";
    default:
      return stopReason as WorkflowMemberStatus;
  }
}

/**
 * Dịch kết quả của một thành viên thành trạng thái hiển thị.
 * Nhận: `outcome` — kết quả `agent-end`.
 * Trả: trạng thái tương ứng.
 */
export function statusFromOutcome(outcome: string): WorkflowMemberStatus {
  switch (outcome) {
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "failed":
      return "failed";
    default:
      return outcome as WorkflowMemberStatus;
  }
}

/**
 * Một lượt chạy nền sống lâu hơn Step/Turn đã sinh ra nó, nên Step/Turn đóng bình thường KHÔNG nói gì
 * về sự sống của lượt chạy; chỉ Turn đóng vì bị ngắt hoặc ở ranh giới fork mới chứng minh lượt chạy
 * không có `run-end` đã dừng.
 * Nhận: `location` — vị trí neo của node.
 * Trả: true khi lượt chạy bị bỏ dở.
 */
export function turnAbandoned(location: WorkflowLocation): boolean {
  if (location.kind !== "step" && location.kind !== "turn") return false;
  const reason = location.turn?.end?.data.reason.kind;
  return reason === "interrupted" || reason === "forked";
}

/**
 * Chiếu state bền + vị trí neo thành dữ liệu cho renderer: gom thành viên theo pha (giữ thứ tự),
 * suy ra trạng thái còn sống khi chưa có `run-end`.
 * Nhận: `context` — ngữ cảnh Definition, `location` — vị trí neo.
 * Trả: dữ liệu node Chat.
 */
export function projectWorkflow(context: WorkflowDefinitionContext, location: WorkflowLocation): ProjectedRun {
  const state = context.state;
  const interrupted = state.stopReason === undefined && turnAbandoned(location);
  const phases = new Map<string, { phase: string | null; members: ProjectedMember[] }>();
  for (const member of state.members) {
    const phase = member.phase === undefined ? null : member.phase;
    const key = workflowPhaseKey(phase);
    let group = phases.get(key);
    if (group === undefined) {
      group = { phase, members: [] };
      phases.set(key, group);
    }
    group.members.push({
      seq: member.seq,
      label: member.label,
      childId: member.childId,
      status: member.outcome === undefined ? (interrupted ? "interrupted" : "running") : statusFromOutcome(member.outcome),
    });
  }
  const projectedPhases: ProjectedPhase[] = [...phases].map(([key, group]) => ({
    key,
    phase: group.phase,
    members: group.members,
  }));
  return {
    name: state.name,
    status: state.stopReason === undefined ? (interrupted ? "interrupted" : "running") : statusFromStopReason(state.stopReason),
    phases: projectedPhases,
  };
}

/**
 * Ghi thêm một thành viên vừa bắt đầu.
 * Nhận: `state` — state hiện tại, `data` — dữ liệu `agent-start`.
 * Trả: state mới.
 */
export function updateAgentStart(state: WorkflowRunState, data: Record<string, unknown>): WorkflowRunState {
  const member: WorkflowMember = {
    seq: data.seq as number,
    label: data.label as string,
    ...(data.phase === undefined ? {} : { phase: data.phase as string }),
    childId: data.childId as string,
  };
  return { ...state, members: [...state.members, member] };
}

/**
 * Ghi kết quả của một thành viên đã có.
 * Nhận: `state` — state hiện tại, `data` — dữ liệu `agent-end`.
 * Trả: state mới (thành viên khác giữ nguyên).
 */
export function updateAgentEnd(state: WorkflowRunState, data: Record<string, unknown>): WorkflowRunState {
  return {
    ...state,
    members: state.members.map((member) =>
      member.seq === (data.seq as number) ? { ...member, outcome: data.outcome as WorkflowAgentOutcome } : member,
    ),
  };
}

/** Họ sự kiện bền `tool-workflow/*` gấp vào MỘT node Chat có khoá. */
export const workflowRunDefinition: WorkflowRunDefinition = {
  kind: "workflow-run",
  target: "chat",
  match: (event: WorkflowEvent): { id: string; role: "start" | "update" } | null => {
    if (event.type === "tool-workflow/run-start") return { id: String(event.data.runId), role: "start" };
    if (
      event.type === "tool-workflow/agent-start" ||
      event.type === "tool-workflow/agent-end" ||
      event.type === "tool-workflow/run-end"
    ) {
      return { id: String(event.data.runId), role: "update" };
    }
    return null;
  },
  start: (_context, match): { name: string; members: WorkflowMember[] } => {
    if (match.event.type !== "tool-workflow/run-start") {
      throw new Error("workflow-run start requires tool-workflow/run-start");
    }
    return { name: match.event.data.name as string, members: [] };
  },
  update: (context, match): WorkflowRunState => {
    if (match.event.type === "tool-workflow/agent-start") return updateAgentStart(context.state, match.event.data);
    if (match.event.type === "tool-workflow/agent-end") return updateAgentEnd(context.state, match.event.data);
    if (match.event.type === "tool-workflow/run-end") {
      return { ...context.state, stopReason: match.event.data.stopReason as WorkflowStopReason };
    }
    return context.state;
  },
  buildViewNode: (context): WorkflowViewNode | null => {
    if (context.start === undefined) return null;
    const data = projectWorkflow(context, context.start.location);
    return {
      key: context.key,
      kind: "workflow-run",
      id: context.id,
      target: "chat",
      anchorSeq: context.start.event.seq,
      location: context.start.location,
      visibility: "visible",
      data,
    };
  },
};
