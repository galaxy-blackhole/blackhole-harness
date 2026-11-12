/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Suy diễn task-view thuần dùng chung cho bảng việc và projection client: taskReady + projectTaskView (ownerName · ready · writeScopeWarnings) — port 1:1 lib/types/task-view.js.
 */
import { brandString } from "@deepseek-ai/dsh-brand";

import type { TeamState } from "./projection.ts";
import type { TeamTask, TeamTaskView } from "./types.ts";

/**
 * Hai tiền tố tệp/thư mục có chồng lấn theo thành phần đường dẫn hay không.
 * Nhận: left — scope chuẩn hoá; right — scope chuẩn hoá. Trả: một bên chứa bên kia.
 */
function scopesOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(right + "/") || right.startsWith(left + "/");
}

/**
 * Mọi blocker hiện tại của một task đã hoàn thành chưa.
 * Nhận: state — trạng thái Team cung cấp task anh em; task — snapshot cần kiểm. Trả: không còn blocker dở.
 */
export function taskReady(state: TeamState, task: TeamTask): boolean {
  return task.blockedBy.every((id) => state.tasks.find((candidate) => candidate.id === id)?.status === "completed");
}

/**
 * Suy ra một task view kèm tên chủ, trạng thái sẵn sàng và cảnh báo chồng lấn vùng ghi.
 * Nhận: state — trạng thái Team; task — snapshot cần xem. Trả: task view tách rời.
 */
export function projectTaskView(state: TeamState, task: TeamTask): TeamTaskView {
  const ownerName =
    task.ownerId === undefined
      ? undefined
      : (task.ownerId as string) === brandString(state.id as unknown as string)
        ? "lead"
        : state.members.find((member) => member.id === task.ownerId)?.name;
  const warnings = new Set<string>();
  for (const other of state.tasks) {
    if (other.id === task.id || other.status !== "in_progress") continue;
    if (task.writeScopes.some((left) => other.writeScopes.some((right) => scopesOverlap(left, right)))) {
      warnings.add("write scopes overlap with " + other.id);
    }
  }
  return {
    id: task.id,
    revision: task.revision,
    subject: task.subject,
    description: task.description,
    status: task.status,
    blockedBy: [...task.blockedBy],
    writeScopes: [...task.writeScopes],
    ...(ownerName === undefined ? {} : { ownerName }),
    ready: task.status === "pending" && taskReady(state, task),
    writeScopeWarnings: [...warnings],
  };
}