/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểm phụ thuộc đầy đủ cho snapshot task hiện tại của Team: TeamTaskGraphError + assertTaskGraphCandidate (thiếu/trùng/tự chặn/chu trình) — port 1:1 lib/types/task-graph.js.
 */
import type { TeamTask, TeamTaskId } from "./types.ts";

/** Lỗi phụ thuộc task (giữ riêng để lệnh ánh xạ mã lỗi). */
export class TeamTaskGraphError extends Error {
  /** Nhóm quan hệ không hợp lệ ổn định. */
  readonly violation: "missing" | "duplicate" | "cycle";

  /**
   * Dựng lỗi phụ thuộc.
   * Nhận: message — quan hệ không hợp lệ cụ thể; violation — nhóm quan hệ. Trả: không.
   */
  constructor(message: string, violation: "missing" | "duplicate" | "cycle") {
    super(message);
    this.violation = violation;
    this.name = "TeamTaskGraphError";
  }
}

/**
 * Kiểm toàn bộ đồ thị task đang sống sau khi thay một snapshot ứng viên.
 * Nhận: current — snapshot hiện có; candidate — snapshot mới/kế tiếp.
 * Trả: không; ném TeamTaskGraphError khi chặn thiếu/trùng/tự chặn/chu trình.
 */
export function assertTaskGraphCandidate(current: readonly TeamTask[], candidate: TeamTask): void {
  const tasks = new Map<TeamTaskId, TeamTask>(current.map((task) => [task.id, task]));
  tasks.set(candidate.id, candidate);
  for (const task of tasks.values()) {
    if (task.status === "deleted") continue;
    const seen = new Set<TeamTaskId>();
    for (const blockerId of task.blockedBy) {
      if (blockerId === task.id) throw new TeamTaskGraphError('team task "' + task.id + '" cannot block itself', "cycle");
      if (seen.has(blockerId)) throw new TeamTaskGraphError('team task "' + task.id + '" repeats blocker "' + blockerId + '"', "duplicate");
      const blocker = tasks.get(blockerId);
      if (blocker === undefined || blocker.status === "deleted") {
        throw new TeamTaskGraphError('blocker task "' + blockerId + '" for "' + task.id + '" is missing or deleted', "missing");
      }
      seen.add(blockerId);
    }
  }
  const visiting = new Set<TeamTaskId>();
  const visited = new Set<TeamTaskId>();
  const visit = (id: TeamTaskId): void => {
    if (visiting.has(id)) throw new TeamTaskGraphError('task dependency cycle includes "' + id + '"', "cycle");
    if (visited.has(id)) return;
    const task = tasks.get(id);
    if (task === undefined || task.status === "deleted") return;
    visiting.add(id);
    for (const blockerId of task.blockedBy) visit(blockerId);
    visiting.delete(id);
    visited.add(id);
  };
  for (const task of tasks.values()) visit(task.id);
}
