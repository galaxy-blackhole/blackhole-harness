/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Lệnh Remote của Workspace phía Host — bản viết lại 1:1 vùng `lib/types/commands.js` (dòng 196–364) của
 *      `@deepseek-ai/dsh-api-workspace-controller/lib/index.js`: tạo/tìm, đổi tên, xoá, sắp thứ tự Workspace và
 *      ghim/lưu trữ Session trên sổ đăng ký có thẩm quyền, cộng ánh xạ lỗi miền sang mã lỗi Remote ổn định.
 */

import { RemoteError, remoteErrorOf } from "@galaxy-blackhole/gbh-typert-protocol";

/**
 * Nhan dien loi mien theo TEN LOP, ben voi moi ban sao module.
 * Vi sao (01/11/2026): cac lop loi nay duoc import qua peer `@deepseek-ai/dsh-workspace`; trong
 * test/workspace specifier do phan giai ve MOT BAN SAO khac kernel nen `instanceof` truot ⇒
 * controller nem loi mien tho ra ngoai thay vi ma Remote on dinh (do that: insertBefore voi id la).
 * Nhan: error - gia tri bat duoc; name - ten lop can khop. Tra: true khi khop TEN.
 */
function isNamedError(error: unknown, name: string): error is Error {
  return error instanceof Error && (error as { name?: string }).name === name;
}

import {
  WorkspaceActiveSessionError,
  WorkspaceArchivedSessionPinError,
  WorkspaceId,
  WorkspaceMoveInvalidError,
  WorkspaceOrderInvalidError,
  WorkspaceUnknownSessionError,
} from "@galaxy-blackhole/gbh-workspace";

import { workspaceView } from "./feed.ts";

import type { Context } from "@deepseek-ai/cordis";
import type { Workspace } from "@galaxy-blackhole/gbh-workspace";
import type {
  WorkspaceArchiveSessionRequest,
  WorkspaceArchiveValue,
  WorkspaceCreateRequest,
  WorkspaceCreateValue,
  WorkspaceDeleteRequest,
  WorkspaceDeleteValue,
  WorkspaceInsertBeforeRequest,
  WorkspaceInsertSessionBeforeRequest,
  WorkspaceOrderValue,
  WorkspacePinSessionRequest,
  WorkspacePinValue,
  WorkspaceRenameRequest,
  WorkspaceUnarchiveSessionRequest,
  WorkspaceUnpinSessionRequest,
  WorkspaceValue,
} from "./types.ts";
import { workspaceRegistryOf, type WorkspaceRegistryLike } from "./workspace-seam.ts";

/**
 * Thực thi các phép biến đổi Workspace trên sổ đăng ký có thẩm quyền.
 * Nhận: context Host mang `this.registry` — nguồn sự thật duy nhất về Workspace và tư cách Session.
 * Trả: không — lớp chỉ giữ context và một hàng đợi tuần tự hoá mọi phép ghi.
 */
export class WorkspaceCommands {

  /**
   * Sổ workspace đọc qua SEAM CẤU TRÚC (ADR 000d — PHASE B 08/11/2026); thiếu seam là lỗi cấu hình nên nổ NGAY.
   * Nhận: không. Trả: seam sổ workspace của kernel.
   */
  private get registry(): WorkspaceRegistryLike {
    return workspaceRegistryOf(this.ctx);
  }
  /** Context Host mang sổ đăng ký Workspace. */
  private readonly ctx: Context;

  /** Đuôi hàng đợi: mỗi phép ghi chờ phép trước kết thúc, kể cả khi phép trước ném lỗi. */
  private operationTail: Promise<void> = Promise.resolve();

  /**
   * Giữ context Host mang sổ đăng ký Workspace.
   * Nhận: context Host mang sổ đăng ký Workspace.
   * Trả: không.
   */
  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  /**
   * Tạo hoặc phân giải MỘT Workspace trên một thư mục đã tồn tại.
   * Nhận: đường dẫn thư mục cần đăng ký.
   * Trả: Workspace và cờ cho biết lần gọi này có tạo mới hay không.
   */
  create(request: WorkspaceCreateRequest): Promise<WorkspaceCreateValue> {
    return this.enqueue<WorkspaceCreateValue>(async () => {
      try {
        const existing = await this.registry.resolveByPath(request.path);
        if (existing !== undefined) {
          return { workspace: workspaceView(existing), created: false };
        }
        return {
          workspace: workspaceView(await this.registry.create(request.path)),
          created: true,
        };
      } catch (error) {
        if (remoteErrorOf(error) !== undefined) throw error;
        throw new RemoteError(
          "workspace/invalid-path",
          `cannot create a Workspace at "${request.path}": ${commandErrorMessage(error)}`,
          { path: request.path },
          { cause: error },
        );
      }
    });
  }

  /**
   * Đổi tên MỘT Workspace sau khi tuần tự hoá phép kiểm quyền sở hữu tiêu đề.
   * Nhận: định danh Workspace và tiêu đề đề nghị.
   * Trả: ảnh chiếu Workspace đã cập nhật.
   */
  rename(request: WorkspaceRenameRequest): Promise<WorkspaceValue> {
    const title = request.title.trim();
    if (title === "") {
      return Promise.reject(
        new RemoteError("gateway/bad-request", "Workspace rename requires a non-blank title", {}),
      );
    }
    return this.enqueue<WorkspaceValue>(async () => {
      const workspace = this.requireWorkspace(request.workspaceId);
      if (title !== workspace.title) {
        if (
          this.registry
            .list()
            .some((candidate) => candidate.id !== workspace.id && candidate.title === title)
        ) {
          throw new RemoteError(
            "workspace/name-conflict",
            `Workspace name '${title}' is already in use`,
            { name: title },
          );
        }
        await workspace.setTitle(title);
      }
      return { workspace: workspaceView(workspace) };
    });
  }

  /**
   * Xoá MỘT đăng ký Workspace mà không xoá thư mục hay Session của nó.
   * Nhận: định danh Workspace cần gỡ.
   * Trả: biên nhận đã xoá.
   */
  delete(request: WorkspaceDeleteRequest): Promise<WorkspaceDeleteValue> {
    return this.enqueue<WorkspaceDeleteValue>(async () => {
      if (!(await this.registry.delete(WorkspaceId(request.workspaceId)))) {
        throw workspaceNotFound(request.workspaceId);
      }
      return { deleted: true };
    });
  }

  /**
   * Di chuyển MỘT Workspace trong thứ tự bền vững của sổ đăng ký.
   * Nhận: Workspace bị di chuyển và neo tuỳ chọn.
   * Trả: toàn bộ thứ tự Workspace sau phép biến đổi.
   */
  async insertBefore(request: WorkspaceInsertBeforeRequest): Promise<WorkspaceOrderValue> {
    try {
      return {
        workspaceIds: [
          ...(await this.registry.insertBefore(
            WorkspaceId(request.workspaceId),
            request.beforeWorkspaceId === undefined
              ? undefined
              : WorkspaceId(request.beforeWorkspaceId),
          )),
        ],
      };
    } catch (error) {
      if (!isNamedError(error, "WorkspaceOrderInvalidError")) throw error;
      throw workspaceNotFound((error as WorkspaceOrderInvalidError).workspaceId);
    }
  }

  /**
   * Di chuyển MỘT Session đã được tính trong thứ tự thủ công của Workspace.
   * Nhận: định danh Workspace, Session, và neo tuỳ chọn.
   * Trả: ảnh chiếu Workspace đã cập nhật.
   */
  async insertSessionBefore(
    request: WorkspaceInsertSessionBeforeRequest,
  ): Promise<WorkspaceValue> {
    const workspace = this.requireWorkspace(request.workspaceId);
    try {
      await workspace.insertSessionBefore(request.sessionId, request.beforeSessionId);
    } catch (error) {
      if (!isNamedError(error, "WorkspaceMoveInvalidError")) throw error;
      throw new RemoteError(
        "workspace/move-invalid",
        error.message,
        {
          workspaceId: request.workspaceId,
          sessionId: request.sessionId,
          ...(request.beforeSessionId === undefined
            ? {}
            : { beforeSessionId: request.beforeSessionId }),
        },
        { cause: error },
      );
    }
    return { workspace: workspaceView(workspace) };
  }

  /**
   * Đưa MỘT Session đã biết vào tập lưu trữ TOÀN SỔ. Không có `stopActivity` thì Session còn việc đang chạy bị
   * từ chối với mã `workspace/session-active` kèm hoạt động mà các provider của sổ đăng ký báo; có nó thì các
   * provider dừng việc đó trước.
   * Nhận: định danh Session cần lưu trữ và việc có dừng công việc của nó hay không.
   * Trả: toàn bộ tập lưu trữ sau phép biến đổi.
   */
  async archiveSession(request: WorkspaceArchiveSessionRequest): Promise<WorkspaceArchiveValue> {
    try {
      await this.registry.archiveSession(
        request.sessionId,
        request.stopActivity === true ? { stopActivity: true } : {},
      );
    } catch (error) {
      if (isNamedError(error, "WorkspaceUnknownSessionError")) {
        throw new RemoteError(
          "session/not-found",
          error.message,
          { sessionId: request.sessionId },
          { cause: error },
        );
      }
      if (isNamedError(error, "WorkspaceActiveSessionError")) {
        // Trường riêng của lớp lỗi miền (không nằm trên `Error`) ⇒ đọc qua đúng kiểu của lớp đó.
        const active = error as WorkspaceActiveSessionError;
        throw new RemoteError(
          "workspace/session-active",
          active.message,
          { sessionId: request.sessionId, activity: active.activity },
          { cause: active },
        );
      }
      throw error;
    }
    return { archivedSessionIds: [...this.registry.archivedSessionIds] };
  }

  /**
   * Gỡ MỘT Session khỏi tập lưu trữ TOÀN SỔ. Id không nằm trong tập lưu trữ KHÔNG phải lỗi: phép gọi là idempotent,
   * nên một lần thua đua với bề mặt khác phân giải thành no-op.
   * Nhận: định danh Session cần bỏ lưu trữ.
   * Trả: toàn bộ tập lưu trữ sau phép biến đổi.
   */
  async unarchiveSession(request: WorkspaceUnarchiveSessionRequest): Promise<WorkspaceArchiveValue> {
    await this.registry.unarchiveSession(request.sessionId);
    return { archivedSessionIds: [...this.registry.archivedSessionIds] };
  }

  /**
   * Đưa MỘT Session đã biết, chưa lưu trữ, vào tập ghim TOÀN SỔ.
   * Nhận: định danh Session cần ghim.
   * Trả: toàn bộ tập ghim sau phép biến đổi, ghim gần nhất đứng đầu.
   */
  async pinSession(request: WorkspacePinSessionRequest): Promise<WorkspacePinValue> {
    try {
      await this.registry.pinSession(request.sessionId);
    } catch (error) {
      if (isNamedError(error, "WorkspaceUnknownSessionError")) {
        throw new RemoteError(
          "session/not-found",
          error.message,
          { sessionId: request.sessionId },
          { cause: error },
        );
      }
      if (isNamedError(error, "WorkspaceArchivedSessionPinError")) {
        throw new RemoteError("gateway/bad-request", error.message, {}, { cause: error });
      }
      throw error;
    }
    return { pinnedSessionIds: [...this.registry.pinnedSessionIds] };
  }

  /**
   * Gỡ MỘT Session khỏi tập ghim TOÀN SỔ. Id không được ghim KHÔNG phải lỗi: phép gọi là idempotent, nên một lần
   * thua đua với bề mặt khác phân giải thành no-op.
   * Nhận: định danh Session cần bỏ ghim.
   * Trả: toàn bộ tập ghim sau phép biến đổi, ghim gần nhất đứng đầu.
   */
  async unpinSession(request: WorkspaceUnpinSessionRequest): Promise<WorkspacePinValue> {
    await this.registry.unpinSession(request.sessionId);
    return { pinnedSessionIds: [...this.registry.pinnedSessionIds] };
  }

  /**
   * Lấy Workspace theo định danh, ném lỗi `workspace/not-found` khi không có.
   * Nhận: định danh Workspace cần lấy.
   * Trả: entity Workspace có thẩm quyền.
   */
  private requireWorkspace(workspaceId: WorkspaceId): Workspace {
    const workspace = this.registry.get(WorkspaceId(workspaceId));
    if (workspace === undefined) throw workspaceNotFound(workspaceId);
    return workspace;
  }

  /**
   * Xếp một phép ghi vào đuôi hàng đợi để mọi phép ghi chạy tuần tự.
   * Nhận: phép ghi cần chạy sau khi phép trước kết thúc.
   * Trả: lời hứa của chính phép ghi đó; lỗi của nó không làm kẹt hàng đợi.
   */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

/**
 * Lỗi Remote chuẩn cho một định danh Workspace không có trong sổ đăng ký.
 * Nhận: định danh Workspace đã tra mà không thấy.
 * Trả: `RemoteError` mã `workspace/not-found` kèm `workspaceId` trong details.
 */
export function workspaceNotFound(workspaceId: WorkspaceId): RemoteError {
  return new RemoteError("workspace/not-found", `Workspace "${workspaceId}" not found`, {
    workspaceId,
  });
}

/**
 * Đổi một giá trị bị ném thành chuỗi người đọc được.
 * Nhận: giá trị bất kỳ bắt được trong `catch`.
 * Trả: `message` khi là `Error`, ngược lại `String(value)`.
 */
export function commandErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
