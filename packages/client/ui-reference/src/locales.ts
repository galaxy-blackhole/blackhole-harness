/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tu dien namespace \`reference\` (en/zh) — giu NGUYEN 16 chuoi cua ban goc
 */

/** Khoá của từ điển `reference` (tập khoá lấy từ bản gốc). */
export type ReferenceKey =
  | "section.files"
  | "section.subagents"
  | "section.sessions"
  | "candidate.noCwd"
  | "crumb.root"
  | "fileOpen.title"
  | "fileOpen.failed"
  | "fileOpen.close"
  | "fileOpen.retry"
  | "time.now"
  | "time.minutes"
  | "time.hours"
  | "time.days"
  | "time.months"
  | "time.years";

/** Bản tiếng Trung giản thể (nguyên văn của DSH; `{n}`/`{path}` là chỗ điền tham số). */
export const zh: Record<ReferenceKey, string> = {
  "section.files": "文件与文件夹",
  "section.subagents": "子智能体",
  "section.sessions": "对话",
  "candidate.noCwd": "（无工作目录）",
  "crumb.root": "工作区",
  "fileOpen.title": "无法打开文件",
  "fileOpen.failed": "无法打开“{path}”，请重试或关闭此提示",
  "fileOpen.close": "关闭",
  "fileOpen.retry": "重试",
  "time.now": "刚刚",
  "time.minutes": "{n}分钟",
  "time.hours": "{n}小时",
  "time.days": "{n}天",
  "time.months": "{n}个月",
  "time.years": "{n}年",
};

/** Bản tiếng Anh (nguyên văn của DSH; đủ khoá như bản zh). */
export const en: Record<ReferenceKey, string> = {
  "section.files": "Files & folders",
  "section.subagents": "Subagents",
  "section.sessions": "Sessions",
  "candidate.noCwd": "(no cwd)",
  "crumb.root": "Workspace",
  "fileOpen.title": "Couldn’t open file",
  "fileOpen.failed": "Couldn’t open “{path}”. Try again or close this message.",
  "fileOpen.close": "Close",
  "fileOpen.retry": "Retry",
  "time.now": "now",
  "time.minutes": "{n}min",
  "time.hours": "{n}h",
  "time.days": "{n}d",
  "time.months": "{n}mo",
  "time.years": "{n}y",
};
