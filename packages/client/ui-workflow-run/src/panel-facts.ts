/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Suy dien trang thai/so luong + may trang thai MO/DONG cua disclosure cho panel workflow run
 */

import type { ProjectedMember, ProjectedPhase, WorkflowMemberStatus } from "./workflow-definition.ts";

/** Hàm dịch của namespace `workflowRun` (nhận tham số điền `{name}`/`{count}`). */
export type Translator = (key: string, params?: Record<string, string | number>) => string;

/** Trạng thái mà primitive `StateDot` hiểu. */
export type DotState = "ongoing" | "done" | "error" | "warning";

/** Khoá từ điển theo trạng thái lượt chạy/thành viên. */
export const STATUS_KEYS: Record<WorkflowMemberStatus, string> = {
  running: "status.running",
  completed: "status.completed",
  failed: "status.failed",
  cancelled: "status.cancelled",
  interrupted: "status.interrupted",
};

/** Chế độ của một disclosure: sạch / đang chạy / có bất thường. */
export type DisclosureMode = "clean" | "running" | "abnormal";

/** Sự thật suy ra từ dữ liệu node (quyết định disclosure mở hay đóng). */
export interface DisclosureFacts {
  /** Chế độ. */
  mode: DisclosureMode;
  /** Số thành viên. */
  activityCount: number;
}

/** Trạng thái mở/đóng của một disclosure, bền qua các lần render. */
export interface DisclosureState extends DisclosureFacts {
  /** Đang mở. */
  open: boolean;
  /** Đang chờ đóng lại vì đã trở về "sạch" nhưng con trỏ còn trong vùng. */
  pendingCleanCollapse: boolean;
}

/**
 * Dịch trạng thái thành trạng thái của chấm màu.
 * Nhận: `status` — trạng thái lượt chạy/thành viên.
 * Trả: `ongoing` · `done` · `error` · `warning`.
 */
export function dotState(status: WorkflowMemberStatus): DotState {
  switch (status) {
    case "running":
      return "ongoing";
    case "completed":
      return "done";
    case "failed":
      return "error";
    case "cancelled":
    case "interrupted":
      return "warning";
    /* v8 ignore next -- trạng thái là tập đóng, mọi biến thể đã xử lý ở trên. */
    default:
      return status as DotState;
  }
}

/**
 * Tên pha để hiển thị (phân biệt vắng mặt với rỗng).
 * Nhận: `phase` — tên pha hoặc `null`, `t` — hàm dịch.
 * Trả: chuỗi hiển thị.
 */
export function readablePhase(phase: string | null, t: Translator): string {
  if (phase === null) return t("phase.unassigned");
  return phase === "" ? t("phase.empty") : phase;
}

/**
 * Nhãn thành viên để hiển thị.
 * Nhận: `label` — nhãn hoặc chuỗi rỗng, `t` — hàm dịch.
 * Trả: chuỗi hiển thị.
 */
export function readableMember(label: string, t: Translator): string {
  return label === "" ? t("member.empty") : label;
}

/**
 * Câu đếm theo trạng thái.
 * Nhận: `status` — trạng thái, `count` — số lượng, `t` — hàm dịch.
 * Trả: chuỗi đã điền số.
 */
export function statusCount(status: WorkflowMemberStatus, count: number, t: Translator): string {
  return t("statusCount." + status, { count });
}

/**
 * Câu đếm thành viên của lượt chạy (một hay nhiều).
 * Nhận: `count` — số thành viên, `t` — hàm dịch.
 * Trả: chuỗi đã điền số.
 */
export function memberCount(count: number, t: Translator): string {
  return t(count === 1 ? "run.members.one" : "run.members.other", { count });
}

/**
 * Trạng thái này có phải bất thường không.
 * Nhận: `status` — trạng thái.
 * Trả: true với `failed`/`cancelled`/`interrupted`.
 */
export function abnormal(status: WorkflowMemberStatus): boolean {
  return status === "failed" || status === "cancelled" || status === "interrupted";
}

/**
 * Sự thật của một pha (chế độ + số thành viên) để quyết định mở/đóng.
 * Nhận: `phase` — pha đã chiếu.
 * Trả: sự thật của pha.
 */
export function phaseDisclosureFacts(phase: ProjectedPhase): DisclosureFacts {
  return {
    mode: phase.members.some((member) => abnormal(member.status))
      ? "abnormal"
      : phase.members.some((member) => member.status === "running")
        ? "running"
        : "clean",
    activityCount: phase.members.length,
  };
}

/**
 * Sự thật của cả lượt chạy: bất thường thắng đang-chạy, đang-chạy thắng sạch; số hoạt động là tổng các pha.
 * Nhận: `status` — trạng thái lượt chạy, `phases` — CÁC CẶP `[khoá pha, sự thật]` (panel memo hoá theo cặp này).
 * Trả: sự thật của lượt chạy.
 */
export function runDisclosureFacts(
  status: WorkflowMemberStatus,
  phases: readonly (readonly [string, DisclosureFacts])[],
): DisclosureFacts {
  const facts = phases.map(([, item]) => item);
  return {
    mode:
      abnormal(status) || facts.some((item) => item.mode === "abnormal")
        ? "abnormal"
        : status === "running" || facts.some((item) => item.mode === "running")
          ? "running"
          : "clean",
    activityCount: facts.reduce((count, item) => count + item.activityCount, 0),
  };
}

/**
 * Trạng thái disclosure lúc mới dựng: mở sẵn khi có gì đáng xem.
 * Nhận: `facts` — sự thật suy ra từ dữ liệu.
 * Trả: trạng thái ban đầu.
 */
export function initialDisclosureState(facts: DisclosureFacts): DisclosureState {
  return { ...facts, open: facts.mode !== "clean", pendingCleanCollapse: false };
}

/**
 * Chuyển trạng thái disclosure theo dữ liệu mới, giữ người dùng không bị "đóng dưới tay":
 * đang sạch mà con trỏ còn trong vùng thì hoãn việc đóng lại (`pendingCleanCollapse`).
 * Nhận: `current` — trạng thái hiện tại, `facts` — sự thật mới, `focusWithin` — con trỏ có trong vùng.
 * Trả: trạng thái kế tiếp (chính đối tượng cũ khi không có gì đổi).
 */
export function advanceDisclosureState(current: DisclosureState, facts: DisclosureFacts, focusWithin: boolean): DisclosureState {
  if (current.mode === facts.mode && current.activityCount === facts.activityCount) {
    if (!current.pendingCleanCollapse || focusWithin) return current;
    return { ...current, open: false, pendingCleanCollapse: false };
  }
  if (facts.mode === "clean") {
    const deferCollapse = current.open && focusWithin;
    return { ...facts, open: deferCollapse, pendingCleanCollapse: deferCollapse };
  }
  if (current.mode === "clean" || (facts.mode === "abnormal" && current.mode !== "abnormal")) {
    return { ...facts, open: true, pendingCleanCollapse: false };
  }
  return { ...facts, open: current.open, pendingCleanCollapse: false };
}

/**
 * Đóng disclosure đang chờ đóng, nếu có.
 * Nhận: `state` — trạng thái hiện tại.
 * Trả: trạng thái đã đóng, hoặc chính đối tượng cũ khi không chờ gì.
 */
export function collapsePending(state: DisclosureState): DisclosureState {
  if (!state.pendingCleanCollapse) return state;
  return { ...state, open: false, pendingCleanCollapse: false };
}

/**
 * Con trỏ bàn phím có đang nằm trong phần tử này không.
 * Nhận: `element` — phần tử cần kiểm (có thể null).
 * Trả: true khi `document.activeElement` nằm trong đó.
 */
export function focusIsWithin(element: { contains(node: unknown): boolean; ownerDocument: { activeElement: unknown } } | null): boolean {
  if (element === null || element === undefined) return false;
  return element.contains(element.ownerDocument.activeElement);
}

/**
 * Lấy trạng thái disclosure của một pha đã mount.
 * Nhận: `phases` — bảng trạng thái theo khoá, `key` — khoá pha.
 * Trả: trạng thái của pha đó.
 * @throws khi khoá không có trong bảng (callback của pha sống phải sinh từ bảng này).
 */
export function existingPhaseState(phases: Map<string, DisclosureState>, key: string): DisclosureState {
  const phase = phases.get(key);
  /* v8 ignore next -- callback của pha đã mount luôn sinh từ bảng này. */
  if (phase === undefined) throw new Error("Missing disclosure state for phase " + key);
  return phase;
}

/** Sự kiện chuột tối thiểu mà việc chặn focus cần. */
export interface HeaderMouseEvent {
  /** Phần tử đang nhận sự kiện. */
  currentTarget: { querySelector(selector: string): { contains(node: unknown): boolean } | null };
  /** Phần tử đích của sự kiện. */
  target: unknown;
  /** Chặn hành vi mặc định (ở đây: chặn cú focus do click). */
  preventDefault(): void;
}

/**
 * Khi disclosure đang chờ đóng: cú click vào chính dòng header không được kéo focus vào trong
 * (nếu không, trạng thái "đang chờ đóng" sẽ bị coi là còn focus và không bao giờ đóng).
 * Nhận: `event` — sự kiện chuột ở cấp vùng chứa.
 * Trả: không.
 * @throws khi dòng header chưa render (DisclosureRow luôn render header trước nội dung).
 */
export function preventPendingHeaderFocus(event: HeaderMouseEvent): void {
  const header = event.currentTarget.querySelector("[data-disclosure-row]");
  /* v8 ignore next -- DisclosureRow luôn render header trước nội dung. */
  if (header === null) throw new Error("Missing disclosure header");
  if (header.contains(event.target)) event.preventDefault();
}

/**
 * Câu tóm tắt trạng thái của một pha: khi không còn việc đang chạy thì chỉ đếm `completed`;
 * nếu có `interrupted` lẫn `completed` thì xếp `completed` lên đầu.
 * Nhận: `members` — thành viên trong pha, `t` — hàm dịch.
 * Trả: chuỗi tóm tắt.
 */
export function phaseStatusSummary(members: readonly ProjectedMember[], t: Translator): string {
  const counts = new Map<WorkflowMemberStatus, number>();
  for (const member of members) counts.set(member.status, (counts.get(member.status) ?? 0) + 1);
  const count = (status: WorkflowMemberStatus): number => counts.get(status) ?? 0;
  const active = (["running", "failed", "cancelled", "interrupted"] as const).filter((status) => count(status) > 0);
  if (active.length === 0) return statusCount("completed", count("completed"), t);
  const ordered: WorkflowMemberStatus[] =
    active.includes("interrupted") && count("completed") > 0 ? ["completed", ...active] : [...active];
  return ordered.map((status) => statusCount(status, count(status), t)).join(" · ");
}

/** Bản chụp phiên mà việc điều hướng đọc (chỉ phần dùng). */
export interface SessionsSnapshot {
  /** Bản ghi theo id phiên. */
  byId: Record<string, { id: string; parentId?: string; running?: boolean } | undefined>;
  /** Hình chiếu theo phiên (chỉ phần dùng). */
  projectionsBySession: Record<string, { values: { subagent?: { mode: string } } } | undefined>;
}

/**
 * Các thành viên điều hướng được: con của CHÍNH phiên này, đang chạy, và có hình chiếu `subagent`
 * (nhờ đó biết mở ở chế độ nào).
 * Nhận: `sessions` — bản chụp phiên, `phases` — các pha, `parentId` — phiên đang xem,
 *       `statuses` — BẢNG TRA trạng thái chạy theo id phiên (seam `useSessionStatus` cấp một `Map`).
 * Trả: bảng `childId → mode` cho những thành viên mở được.
 */
export function navigableMembers(
  sessions: SessionsSnapshot,
  phases: readonly ProjectedPhase[],
  parentId: string,
  statuses: ReadonlyMap<string, { running?: boolean } | undefined>,
): Map<string, string> {
  const result = new Map<string, string>();
  for (const phase of phases) {
    for (const member of phase.members) {
      const child = sessions.byId[member.childId];
      const identity = sessions.projectionsBySession[member.childId]?.values.subagent;
      if (
        member.status === "running" &&
        child?.parentId === parentId &&
        identity !== undefined &&
        identity !== null &&
        Boolean(statuses.get(child.id)?.running ?? child.running)
      ) {
        result.set(member.childId, identity.mode);
      }
    }
  }
  return result;
}
