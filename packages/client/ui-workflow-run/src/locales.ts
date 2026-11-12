/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tu dien namespace \`workflowRun\` (en/zh) — giu NGUYEN 19 chuoi cua ban goc
 */

/** Khoá của từ điển `workflowRun`. */
export type WorkflowRunKey =
  | "run.title"
  | "run.members.one"
  | "run.members.other"
  | "run.empty"
  | "phase.unassigned"
  | "phase.empty"
  | "statusCount.running"
  | "statusCount.completed"
  | "statusCount.failed"
  | "statusCount.cancelled"
  | "statusCount.interrupted"
  | "member.empty"
  | "member.open"
  | "status.running"
  | "status.completed"
  | "status.failed"
  | "status.cancelled"
  | "status.interrupted";

/** Bản tiếng Trung giản thể (nguyên văn của DSH; `{name}`/`{count}` là chỗ điền tham số). */
export const zh: Record<WorkflowRunKey, string> = {
  "run.title": "{name}",
  "run.members.one": "{count} 个成员",
  "run.members.other": "{count} 个成员",
  "run.empty": "没有启动成员",
  "phase.unassigned": "未分阶段",
  "phase.empty": "空阶段名",
  "statusCount.running": "运行中 {count}",
  "statusCount.completed": "已完成 {count}",
  "statusCount.failed": "失败 {count}",
  "statusCount.cancelled": "已取消 {count}",
  "statusCount.interrupted": "已中断 {count}",
  "member.empty": "空成员名",
  "member.open": "打开 {name}",
  "status.running": "运行中",
  "status.completed": "已完成",
  "status.failed": "失败",
  "status.cancelled": "已取消",
  "status.interrupted": "已中断",
};

/** Bản tiếng Anh (cùng tập khoá). */
export const en: Record<WorkflowRunKey, string> = {
  "run.title": "{name}",
  "run.members.one": "{count} member",
  "run.members.other": "{count} members",
  "run.empty": "No members started",
  "phase.unassigned": "Unphased",
  "phase.empty": "Empty phase name",
  "statusCount.running": "Running {count}",
  "statusCount.completed": "Completed {count}",
  "statusCount.failed": "Failed {count}",
  "statusCount.cancelled": "Cancelled {count}",
  "statusCount.interrupted": "Interrupted {count}",
  "member.empty": "Empty member name",
  "member.open": "Open {name}",
  "status.running": "Running",
  "status.completed": "Completed",
  "status.failed": "Failed",
  "status.cancelled": "Cancelled",
  "status.interrupted": "Interrupted",
};
