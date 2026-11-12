/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng LỖI của sổ đăng ký workspace (bản gốc: bốn lớp lỗi trong lib/types/index.js): mỗi lớp
 *      giữ ĐÚNG trường dữ liệu và ĐÚNG câu thông điệp của bản gốc, vì người gọi phân nhánh theo
 *      `instanceof` và theo `sessionId`/`activity`/`workspaceId` trên thể hiện.
 */
import type { SessionActivity, SessionId, WorkspaceId } from "./types.ts";

/**
 * Lượt `archiveSession` hoặc `pinSession` nêu một phiên KHÔNG có ở cả hai nguồn (đang sống và session
 * persistence) — chỉ VẮNG CHẮC CHẮN mới rơi vào lớp này; lỗi môi trường lưu đi xuyên qua nguyên vật.
 */
export class WorkspaceUnknownSessionError extends Error {
  /** Phiên mà lượt gọi nêu tên. */
  readonly sessionId: SessionId;

  /**
   * Dựng lỗi cho một phiên không tồn tại.
   * Nhận: phiên không tồn tại, và động từ của lượt gọi (`archive` hoặc `pin`) để câu lỗi nói đúng việc.
   * Trả: thể hiện lỗi với `name`/`sessionId`/`message` đã đóng dấu.
   */
  constructor(sessionId: SessionId, verb: "archive" | "pin") {
    super(`cannot ${verb} session '${sessionId}': live sessions and session persistence hold no such session`);
    this.sessionId = sessionId;
    this.name = "WorkspaceUnknownSessionError";
  }
}

/**
 * Lượt `archiveSession` nêu một phiên mà ít nhất một listener `workspace/session-activity` báo là ĐANG
 * HOẠT ĐỘNG. Không có gì được ghi; `activity` gọi tên thứ phải dừng trước khi phiên lưu trữ được.
 */
export class WorkspaceActiveSessionError extends Error {
  /** Phiên đang hoạt động. */
  readonly sessionId: SessionId;
  /** Hoạt động đã báo, theo thứ tự listener. */
  readonly activity: readonly SessionActivity[];

  /**
   * Dựng lỗi cho một phiên còn hoạt động.
   * Nhận: phiên đang hoạt động và danh sách hoạt động theo thứ tự listener.
   * Trả: thể hiện lỗi; câu thông điệp liệt kê các HỌ hoạt động bằng dấu phẩy.
   */
  constructor(sessionId: SessionId, activity: readonly SessionActivity[]) {
    super(`cannot archive session '${sessionId}': the session is active (${activity.map((entry) => entry.kind).join(", ")})`);
    this.sessionId = sessionId;
    this.activity = activity;
    this.name = "WorkspaceActiveSessionError";
  }
}

/** Lượt `pinSession` nêu một phiên ĐANG trong sổ lưu trữ; ghim và lưu trữ loại trừ nhau. */
export class WorkspaceArchivedSessionPinError extends Error {
  /** Phiên đã lưu trữ. */
  readonly sessionId: SessionId;

  /**
   * Dựng lỗi cho một phiên đã lưu trữ.
   * Nhận: phiên đã lưu trữ.
   * Trả: thể hiện lỗi với câu thông điệp cố định của bản gốc.
   */
  constructor(sessionId: SessionId) {
    super(`cannot pin session '${sessionId}': the session is archived`);
    this.sessionId = sessionId;
    this.name = "WorkspaceArchivedSessionPinError";
  }
}

/** Một lượt đổi thứ tự nêu id NGUỒN hoặc id MỐC NEO không có trong thứ tự bền của sổ đăng ký. */
export class WorkspaceOrderInvalidError extends Error {
  /** Id nguồn hoặc mốc neo đang thiếu. */
  readonly workspaceId: WorkspaceId;

  /**
   * Dựng lỗi cho một id không có trong thứ tự.
   * Nhận: id đang thiếu.
   * Trả: thể hiện lỗi với câu thông điệp cố định của bản gốc.
   */
  constructor(workspaceId: WorkspaceId) {
    super(`cannot reorder unknown workspace '${workspaceId}'`);
    this.workspaceId = workspaceId;
    this.name = "WorkspaceOrderInvalidError";
  }
}
