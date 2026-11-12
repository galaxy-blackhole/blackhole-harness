/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Thực thể workspace RIÊNG TƯ của gói (bản gốc: lib/types/entity.js): cài đặt DUY NHẤT của
 *      `Workspace`. Giữ một ảnh chụp bản ghi được TRÁO TẠI CHỖ sau mỗi lượt thay đổi bền; mọi lượt ghi
 *      đi qua đúng một hàm `mutate` nên việc đóng dấu `updatedAt` và tỉa mục không hợp lệ chỉ xảy ra
 *      MỘT lần.
 */
import { stat } from "node:fs/promises";

import { realpathNormalize } from "./paths.ts";
import type { KvTableLike } from "./seams.ts";
import type { WorkspaceRecord } from "./spec.ts";
import type { SessionHeaderLike, SessionId, Workspace, WorkspaceId } from "./types.ts";

/** Yêu cầu `insertSessionBefore` nêu một phiên hoặc mốc neo KHÔNG có trong sổ (lỗi môi trường lưu vẫn là lỗi trơn). */
export class WorkspaceMoveInvalidError extends Error {
  /**
   * Dựng lỗi với câu đã soạn sẵn.
   * Nhận: câu mô tả id nào không có trong sổ và ở đâu.
   * Trả: thể hiện lỗi (không có gì thêm).
   */
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceMoveInvalidError";
  }
}

/** Dấu HUỶ ô chuỗi ghi, ném bởi hàm `update` khi bản ghi không cần đổi; chỉ `mutate` bắt nó. */
const unchangedSentinel = new Error("workspace record unchanged (internal sentinel)");

/**
 * Phần máy móc do SỔ ĐĂNG KÝ sở hữu mà một thực thể thay đổi qua. Thực thể KHÔNG BAO GIỜ thấy chính
 * sổ đăng ký — chỉ thấy bảng đã mở, chỉ mục đường dẫn phiên đã chuẩn tắc đứng sau phép chiếu
 * `sessionIds`, và phép đọc header lúc gắn phiên.
 */
export interface WorkspaceEntityHost {
  /**
   * Giải handle bảng `workspaces` đã mở.
   * Nhận: không.
   * Trả: bảng; NÉM khi sổ đăng ký chưa khởi động xong.
   */
  table(): KvTableLike<WorkspaceId, WorkspaceRecord>;
  /**
   * Kiểm một phiên ĐÃ CÓ trong sổ còn là thành viên không, GIỮ NGUYÊN tư cách sở hữu khi `cwd` đầy đủ
   * của nó không giải được vì thiếu một đoạn đường dẫn.
   * Nhận: phiên đã có trong sổ ứng viên của workspace này, và đường dẫn đã lưu của workspace.
   * Trả: phiên còn là thành viên hay không.
   */
  candidateMatches(id: SessionId, path: string): boolean;
  /**
   * Đọc header của một phiên đã lưu để kiểm lúc gắn.
   * Nhận: phiên cần đọc header.
   * Trả: promise của header; NÉM khi không có session persistence hoặc không có phiên đó.
   */
  readSessionHeader(id: SessionId): Promise<SessionHeaderLike>;
  /**
   * Công bố một `cwd` đã chuẩn tắc và đã kiểm vào chỉ mục của phép chiếu.
   * Nhận: phiên đã kiểm, và thư mục CÓ THẬT đã chuẩn tắc từ `cwd` bất biến trong header.
   * Trả: không.
   */
  rememberSessionPath(id: SessionId, path: string): void;
}

/**
 * Cài đặt DUY NHẤT của {@link Workspace}; chỉ sổ đăng ký dựng nó.
 *
 * Bản ghi được giữ như một ẢNH CHỤP: sau mỗi lượt ghi bền, `mutate` tráo `record` sang giá trị đã ghi.
 * Nhờ vậy mọi getter đọc đồng bộ trên cùng một ảnh chụp, và hai thực thể không bao giờ chia sẻ ảnh chụp.
 */
export class WorkspaceEntity implements Workspace {
  /** Máy móc của sổ đăng ký (bảng, chỉ mục đường dẫn phiên, phép đọc header). */
  private readonly host: WorkspaceEntityHost;
  /** Id ổn định của bản ghi. */
  readonly id: WorkspaceId;
  /** Ảnh chụp bản ghi đã kiểm — giá trị vừa nạp hoặc vừa ghi. */
  private record: WorkspaceRecord;

  /**
   * Dựng một thực thể trên một ảnh chụp bản ghi.
   * Nhận: máy móc của sổ đăng ký, id ổn định, và ảnh chụp bản ghi đã kiểm.
   * Trả: thể hiện thực thể (chưa ghi gì).
   */
  constructor(host: WorkspaceEntityHost, id: WorkspaceId, record: WorkspaceRecord) {
    this.host = host;
    this.id = id;
    this.record = record;
  }

  /** Đường dẫn đã chuẩn tắc của workspace này. */
  get path(): string {
    return this.record.path;
  }

  /** Tiêu đề hiển thị hiện tại. */
  get title(): string {
    return this.record.title;
  }

  /** Mốc tạo ISO-8601. */
  get createdAt(): string {
    return this.record.createdAt;
  }

  /** Mốc thay đổi bền gần nhất, ISO-8601. */
  get updatedAt(): string {
    return this.record.updatedAt;
  }

  /**
   * Phép chiếu ĐỒNG BỘ của sổ ứng viên, đã lọc qua chỉ mục `cwd` chuẩn tắc: header VẮNG, giá trị `cwd`
   * hỏng, và `cwd` chuẩn tắc KHÁC đường dẫn workspace đều không bao giờ được trả.
   * Nhận: không.
   * Trả: MẢNG MỚI mỗi lượt (sửa mảng trả về không chạm bản ghi).
   */
  get sessionIds(): readonly SessionId[] {
    return this.record.sessionIds.filter((id: SessionId) => this.host.candidateMatches(id, this.record.path));
  }

  /**
   * Thay tiêu đề hiển thị.
   * Nhận: tiêu đề mới.
   * Trả: promise phân giải sau khi bền (không đổi gì khác của bản ghi).
   */
  async setTitle(title: string): Promise<void> {
    await this.mutate((record) => ({ ...record, title }));
  }

  /**
   * Đưa một phiên lên ĐẦU sổ ứng viên. Id đã có trong sổ thì phân giải mà không ghi (ngoài lượt tỉa ứng
   * viên mà MỌI lượt thay đổi được nhận đều làm).
   *
   * Một id MỚI phải có header (đang sống hoặc đã lưu) với `cwd` giải được thành thư mục CÓ THẬT và
   * BẰNG đường dẫn của workspace này; id lạ, `cwd` vắng/hỏng, và `cwd` lệch đều bị TỪ CHỐI mà không ghi.
   * Nhận: phiên cần ghi vào sổ.
   * Trả: promise phân giải sau khi bền; NÉM khi không kiểm được.
   */
  async attachSession(sessionId: SessionId): Promise<void> {
    if (!this.record.sessionIds.includes(sessionId)) {
      const header = await this.host.readSessionHeader(sessionId);
      if (header.cwd === undefined) {
        throw new Error(`cannot attach session '${sessionId}' to workspace '${this.record.path}': its stored header carries no cwd to validate against`);
      }
      let cwd: string;
      try {
        cwd = await realpathNormalize(header.cwd);
      } catch (error) {
        throw new Error(
          `cannot attach session '${sessionId}' to workspace '${this.record.path}': its cwd '${header.cwd}' does not resolve, so it cannot be validated`,
          { cause: error },
        );
      }
      if (!(await stat(cwd)).isDirectory()) {
        throw new Error(`cannot attach session '${sessionId}' to workspace '${this.record.path}': its cwd '${header.cwd}' is not a directory`);
      }
      if (cwd !== this.record.path) {
        throw new Error(`cannot attach session '${sessionId}' to workspace '${this.record.path}': its cwd resolves to '${cwd}'`);
      }
      this.host.rememberSessionPath(sessionId, cwd);
    }
    await this.mutate((record) =>
      record.sessionIds.includes(sessionId) ? record : { ...record, sessionIds: [sessionId, ...record.sessionIds] },
    );
  }

  /**
   * Chuyển một phiên ĐÃ CÓ trong sổ, kiểu DOM-insertBefore: có mốc neo thì đặt TRƯỚC mốc đó, không có
   * thì nối vào CUỐI; chỉ id được chuyển đổi vị trí. Phiên hoặc mốc neo KHÔNG có trong sổ bị từ chối mà
   * không ghi; chuyển về đúng chỗ hiện tại phân giải mà không ghi (ngoài lượt tỉa ứng viên).
   * Nhận: phiên cần chuyển và mốc neo (tuỳ chọn).
   * Trả: promise phân giải sau khi bền; NÉM {@link WorkspaceMoveInvalidError} khi id không có trong sổ.
   */
  async insertSessionBefore(sessionId: SessionId, beforeSessionId?: SessionId): Promise<void> {
    await this.mutate((record) => {
      if (!record.sessionIds.includes(sessionId)) {
        throw new WorkspaceMoveInvalidError(
          `cannot move session '${sessionId}' in workspace '${record.path}': the session is not accounted`,
        );
      }
      if (beforeSessionId !== undefined && !record.sessionIds.includes(beforeSessionId)) {
        throw new WorkspaceMoveInvalidError(
          `cannot move session '${sessionId}' before '${beforeSessionId}' in workspace '${record.path}': the anchor session is not accounted`,
        );
      }
      if (beforeSessionId === sessionId) return record;
      const without = record.sessionIds.filter((id: SessionId) => id !== sessionId);
      const at = beforeSessionId === undefined ? without.length : without.indexOf(beforeSessionId);
      const sessionIds = [...without.slice(0, at), sessionId, ...without.slice(at)];
      return sessionIds.every((id: SessionId, index: number) => id === record.sessionIds[index]) ? record : { ...record, sessionIds };
    });
  }

  /**
   * Bỏ một phiên khỏi sổ ứng viên. Idempotent: id không có trong sổ phân giải mà không ghi (ngoài lượt
   * tỉa ứng viên). KHÔNG BAO GIỜ chạm log đã lưu của chính phiên.
   * Nhận: phiên cần bỏ.
   * Trả: promise phân giải sau khi bền (hoặc ngay khi không có gì để bỏ).
   */
  async detachSession(sessionId: SessionId): Promise<void> {
    await this.mutate((record) =>
      record.sessionIds.includes(sessionId)
        ? { ...record, sessionIds: record.sessionIds.filter((id: SessionId) => id !== sessionId) }
        : record,
    );
  }

  /**
   * Phép kiểm thư mục SỐNG, không cache. Thư mục vắng KHÔNG BAO GIỜ sửa bản ghi — nó có thể chỉ đang bị
   * chuyển tạm.
   * Nhận: không.
   * Trả: `'ok'` khi đường dẫn còn là thư mục, `'missing-dir'` khi không (kể cả khi `stat` ném).
   */
  async status(): Promise<"ok" | "missing-dir"> {
    try {
      return (await stat(this.record.path)).isDirectory() ? "ok" : "missing-dir";
    } catch {
      return "missing-dir";
    }
  }

  /**
   * ĐƯỜNG GHI DUY NHẤT: chạy `fn` trên chuỗi ghi của miền qua `table.update`, đóng dấu `updatedAt` và
   * tỉa các ứng viên không còn qua phép kiểm thành viên, rồi tráo ảnh chụp.
   *
   * `fn` thấy giá trị ĐANG ĐÚNG tại ô chuỗi ghi của nó, nên các quyết định thành viên (idempotence của
   * gắn/bỏ) không đua với các lượt ghi đã xếp hàng. Một `fn` báo "không đổi" bằng cách trả lại
   * `current` NGUYÊN VĂN sẽ huỷ ô chuỗi ghi qua dấu gửi khi lượt tỉa cũng không tìm thấy gì — nhờ vậy
   * một lượt không-đổi KHÔNG viết lại môi trường lưu và KHÔNG phát sự kiện đổi.
   * Nhận: hàm nhận bản ghi hiện tại trả bản ghi kế (hoặc chính nó khi không đổi).
   * Trả: promise phân giải sau khi bền, hoặc ngay khi lượt ghi bị huỷ vì không đổi.
   */
  private async mutate(fn: (current: WorkspaceRecord) => WorkspaceRecord): Promise<void> {
    let next: WorkspaceRecord;
    try {
      next = await this.host.table().update(this.id, (current) => {
        const changed = fn(current);
        const sessionIds = changed.sessionIds.filter((id: SessionId) => this.host.candidateMatches(id, changed.path));
        if (changed === current && sessionIds.length === current.sessionIds.length) throw unchangedSentinel;
        return { ...changed, sessionIds, updatedAt: new Date().toISOString() };
      });
    } catch (error) {
      if (error === unchangedSentinel) return;
      throw error;
    }
    this.record = next;
  }
}