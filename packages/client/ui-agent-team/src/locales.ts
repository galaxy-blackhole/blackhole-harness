/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tu dien Agent Teams Web — port 1:1 vung locales.js cua bundle goc (dong 393-455): NS + zh + en
 */
//
// Nguồn đối chiếu (CHỈ ĐỌC): apps/host/node_modules/@deepseek-ai/dsh-experimental-client-ui-agent-team/lib/client.js
//   dòng 396: NS = "agent-team"; dòng 398-424: zh (25 khoá); dòng 426-455: en (25 khoá, kiểm theo tập khoá zh).
// Bản gốc chỉ có {zh, en} (không có vi) ⇒ giữ đúng như vậy; KHÔNG tự thêm tiếng Việt ở phase port.

/** Namespace từ điển do Agent Teams Web sở hữu (nguyên văn bản gốc). */
export const NS = "agent-team";

/** Khoá từ điển của Agent Teams Web (lấy từ nguồn khoá zh — bản gốc dùng zh làm nguồn khoá). */
export type TeamKey =
  | "trigger"
  | "loading"
  | "unavailable"
  | "failure"
  | "empty"
  | "roster"
  | "tasks"
  | "model"
  | "open"
  | "current"
  | "owner"
  | "unowned"
  | "blockedBy"
  | "writeScopes"
  | "ready"
  | "blocked"
  | "task.expand"
  | "task.collapse"
  | "memberStatus.running"
  | "memberStatus.inactive"
  | "memberStatus.provisioning"
  | "memberStatus.failed"
  | "status.pending"
  | "status.in_progress"
  | "status.completed"
  // 23/10/2026 — hàng toolview của tool BỔ SUNG `set_team_limits` (ADR 0013).
  | "limits.title"
  | "limits.summary";

/** Từ điển tiếng Trung — nguồn khoá của namespace. */
export const zh: Readonly<Record<TeamKey, string>> = {
  trigger: "智能体团队",
  loading: "正在加载团队…",
  unavailable: "Team 暂不可用",
  failure: "团队持久记录无效：{message}",
  empty: "暂无共享任务，可以通过对话创建",
  roster: "成员",
  tasks: "共享任务",
  model: "模型",
  open: "打开成员会话",
  current: "当前会话",
  owner: "Owner",
  unowned: "未分配",
  blockedBy: "依赖",
  writeScopes: "写入范围",
  ready: "可开始",
  blocked: "被依赖阻塞",
  "task.expand": "展开",
  "task.collapse": "收起",
  "memberStatus.running": "运行中",
  "memberStatus.inactive": "未运行",
  "memberStatus.provisioning": "准备中",
  "memberStatus.failed": "失败",
  "status.pending": "待处理",
  "status.in_progress": "进行中",
  "status.completed": "已完成",
  "limits.title": "设置团队上限",
  "limits.summary": "{members} 名成员 · {tasks} 个任务",
};

/** Từ điển tiếng Anh — cùng tập khoá với zh (bản gốc kiểm chéo hai tập). */
export const en: Readonly<Record<TeamKey, string>> = {
  trigger: "Agent Team",
  loading: "Loading Team…",
  unavailable: "Team is unavailable",
  failure: "Invalid persisted Team record: {message}",
  empty: "No shared tasks yet. Create them through the conversation.",
  roster: "Members",
  tasks: "Shared tasks",
  model: "Model",
  open: "Open member conversation",
  current: "Current chat",
  owner: "Owner",
  unowned: "Unowned",
  blockedBy: "Blocked by",
  writeScopes: "Write scopes",
  ready: "Ready",
  blocked: "Blocked by dependencies",
  "task.expand": "Show more",
  "task.collapse": "Show less",
  "memberStatus.running": "Running",
  "memberStatus.inactive": "Inactive",
  "memberStatus.provisioning": "Provisioning",
  "memberStatus.failed": "Failed",
  "status.pending": "Pending",
  "status.in_progress": "In progress",
  "status.completed": "Completed",
  "limits.title": "Set team limits",
  "limits.summary": "{members} members · {tasks} tasks",
};
