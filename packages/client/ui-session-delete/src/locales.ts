/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Từ điển của row ui-session-delete (namespace session-delete, zh + en). Bản tiếng Việt do gói
 *      @galaxy-blackhole/gbh-client-locale đăng ký (bảng viSessionDelete) — giữ đúng khuôn các row khác.
 */

/** Khoá từ điển của row (lấy bảng tiếng Trung làm nguồn khoá). */
export type SessionDeleteKey =
  | "menu.deleteSession"
  | "dialog.title"
  | "dialog.desc"
  | "dialog.cancel"
  | "dialog.confirm"
  | "dialog.pending"
  | "error.live"
  | "error.notFound"
  | "error.failed";

/** Bản tiếng Trung giản thể. */
export const zh: Readonly<Record<SessionDeleteKey, string>> = {
  "menu.deleteSession": "删除会话",
  "dialog.title": "永久删除此会话？",
  "dialog.desc": "“{title}”将被永久删除：磁盘上的全部会话日志都会消失，无法恢复。请先停止正在运行的会话。",
  "dialog.cancel": "取消",
  "dialog.confirm": "永久删除",
  "dialog.pending": "正在删除…",
  "error.live": "此会话仍在运行，请先停止后再删除。",
  "error.notFound": "找不到该会话（可能已被删除）。",
  "error.failed": "删除失败：{message}",
};

/** Bản tiếng Anh (đã đối chiếu đủ khoá với bản zh). */
export const en: Readonly<Record<SessionDeleteKey, string>> = {
  "menu.deleteSession": "Delete session",
  "dialog.title": "Delete this session for good?",
  "dialog.desc": "“{title}” will be deleted permanently: every session log on disk is removed and cannot be restored. Stop a running session first.",
  "dialog.cancel": "Cancel",
  "dialog.confirm": "Delete permanently",
  "dialog.pending": "Deleting…",
  "error.live": "This session is still running; stop it before deleting.",
  "error.notFound": "Session not found (it may already be deleted).",
  "error.failed": "Delete failed: {message}",
};
