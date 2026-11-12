/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc MỘT nơi duy nhất chứa allowlist sự kiện Host được chuyển tiếp qua Remote (port 1:1
 *      `lib/types/remote-events.js` của @deepseek-ai/dsh-api-remotes); `./types.ts` chỉ còn là mặt KIỂU.
 */

/** Mã phiên mà payload mang theo — cùng hình dạng `SessionId` của seam session (chỉ ở tầng kiểu). */
export type SessionId = string;

/** Bản rút gọn của `SessionSummary` mà đơn vị đọc tài nguyên `api-session/added` cần. */
export interface SessionSummaryLike {
  /** Mã phiên nằm trong bản tóm tắt vừa thêm. */
  readonly sessionId: SessionId;
}

/**
 * Sự kiện Host mà ứng dụng chuyển tiếp KHÔNG đổi tên. `mode` vừa là chiến lược phát của Host vừa là
 * tập khoá hợp lệ của `ctx.remote.$on` phía người dùng. Mục `emit` khai bộ ĐỌC tài nguyên mà payload
 * mang theo (hoặc không có để chạm tài nguyên dựng sẵn `global`); mục `waterfall` đi qua cầu nối
 * chờ của Gateway.
 */
export const API_REMOTE_FORWARDED_EVENTS = [
  { event: "agent-preset/selected", mode: "emit" },
  { event: "approval/request", mode: "waterfall" },
  { event: "api-session/activity", mode: "emit", resources: { session: (sessionId: SessionId) => sessionId } },
  { event: "api-session/added", mode: "emit", resources: { session: (summary: SessionSummaryLike) => summary.sessionId } },
  { event: "api-session/error", mode: "emit", resources: { session: (sessionId: SessionId) => sessionId } },
  { event: "api-session/removed", mode: "emit", resources: { session: (sessionId: SessionId) => sessionId } },
  { event: "api-session/status", mode: "emit", resources: { session: (sessionId: SessionId) => sessionId } },
  { event: "commands/change", mode: "emit" },
  { event: "deepseek-account/session-expired", mode: "emit" },
  { event: "deepseek-account/model-sign-in-required", mode: "emit" },
  { event: "credentials/record-updated", mode: "emit" },
  { event: "credentials/reference-updated", mode: "emit" },
  { event: "goal/activation-changed", mode: "emit" },
  { event: "cordis/request-run", mode: "emit" },
  { event: "cordis/request-run-resolved", mode: "emit" },
  { event: "cordis/dynamic-package", mode: "emit" },
  { event: "cordis/dynamic-retract", mode: "emit" },
  { event: "cordis/inspect-query", mode: "emit" },
  { event: "cordis/inspect-query-resolved", mode: "emit" },
  { event: "llm/adapters-updated", mode: "emit" },
  { event: "permission-presets/catalog-changed", mode: "emit" },
  { event: "plugin-manager/changed", mode: "emit" },
  { event: "plugin-manager/install-log", mode: "emit" },
  { event: "plugin-manager/install-state", mode: "emit" },
  { event: "plugin-market/changed", mode: "emit" },
  { event: "settings/document-updated", mode: "emit" },
  { event: "schedule/changed", mode: "emit" },
  { event: "user-questions/request", mode: "waterfall" },
] as const;

/** Chiếu KIỂU của allowlist; người dùng và Host cùng đọc một khai báo thay vì hai bản có thể lệch. */
export type ApiRemoteForwardedEvent = (typeof API_REMOTE_FORWARDED_EVENTS)[number]["event"];
