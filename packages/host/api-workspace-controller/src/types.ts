/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Từ vựng request/result/state-stream an toàn trình duyệt cho namespace Workspace và chọn thư mục —
 *      port 1:1 `lib/types/types.d.ts` (stock 178 dòng) của `@deepseek-ai/dsh-api-workspace-controller`:
 *      chiếu WorkspaceView, baseline/follow frame, các request/value, và khối augmentation
 *      `RemoteErrorDetailsMap` với đủ 8 mã `workspace/*` + `directory-picker/*`. Kiểu của seam chọn thư mục
 *      được RE-EXPORT từ chính gói khai nó, không khai lại.
 */

import type { SessionId } from "@galaxy-blackhole/gbh-session";
import type { SessionActivity, WorkspaceId } from "@galaxy-blackhole/gbh-workspace";

export type { WorkspaceId } from "@galaxy-blackhole/gbh-workspace";
export type {
  SessionActivity,
  SessionActivityItem,
  SessionActivityKind,
  SessionActivityKindMap,
} from "@galaxy-blackhole/gbh-workspace";
export type { DirectoryEntry, DirectoryListing } from "@deepseek-ai/dsh-host-directory-picker/types";

/** Một Workspace bền vững được chiếu cho bên tiêu thụ trình duyệt. */
export interface WorkspaceView {
  /** Định danh bản ghi ổn định. */
  readonly workspaceId: WorkspaceId;
  /** Đường dẫn thư mục chuẩn trên Host. */
  readonly path: string;
  /** Tiêu đề người dùng thấy. */
  readonly title: string;
  /** Các phiên được tính cho Workspace này, theo thứ tự thủ công. */
  readonly sessionIds: readonly SessionId[];
  /** Thời điểm tạo, ISO-8601. */
  readonly createdAt: string;
  /** Thời điểm sửa cuối, ISO-8601. */
  readonly updatedAt: string;
}

declare module "@galaxy-blackhole/gbh-typert-protocol" {
  interface RemoteErrorDetailsMap {
    /** Thư mục được yêu cầu không thể làm nền cho một Workspace. */
    "workspace/invalid-path": {
      readonly path: string;
    };
    /** Một Workspace khác đã dùng tên được yêu cầu. */
    "workspace/name-conflict": {
      readonly name: string;
    };
    /**
     * Session vẫn còn việc đang chạy — lượt của chính nó, một subagent, một tác vụ nền, hoặc một lịch đang
     * hoạt động — nên phép lưu trữ bị từ chối mà không ghi gì; `activity` nói việc gì phải dừng trước.
     */
    "workspace/session-active": {
      readonly sessionId: SessionId;
      readonly activity: readonly SessionActivity[];
    };
    /** Session hoặc mỏ neo của nó không nằm trong thứ tự thủ công của Workspace. */
    "workspace/move-invalid": {
      readonly workspaceId: WorkspaceId;
      readonly sessionId: SessionId;
      readonly beforeSessionId?: SessionId;
    };
    /**
     * Workspace được yêu cầu không có trong sổ đăng ký (08/11/2026, dev-1: khai BỔ SUNG — khoá này trước đây
     * đến từ augmentation của gói stock nên đổi import sang id GBH là mất).
     */
    "workspace/not-found": {
      readonly workspaceId: WorkspaceId;
    };
    /** Phiên được yêu cầu không nằm trong sổ workspace (khai bổ sung, cùng lý do trên). */
    "session/not-found": {
      readonly sessionId: SessionId;
    };
    /** Verb cần một tương tác mà backend đã hợp thành không phục vụ. */
    "directory-picker/unavailable": {
      readonly capability: string;
    };
    /** Đích không đủ tuyệt đối, hoặc backend không liệt kê được nó. */
    "directory-picker/unreadable": {
      readonly path: string;
    };
    /** Một mục con cùng tên đã có sẵn. */
    "directory-picker/exists": {
      readonly path: string;
    };
    /** Thư mục cha không đủ tuyệt đối, tên không phải một đoạn, hoặc phép tạo thất bại. */
    "directory-picker/create-failed": {
      readonly path: string;
    };
  }
}

/** Thư mục đã tồn tại được yêu cầu nhận làm Workspace. */
export interface WorkspaceCreateRequest {
  readonly path: string;
}

/** Workspace vừa tạo hoặc đã đăng ký trước đó. */
export interface WorkspaceCreateValue {
  readonly workspace: WorkspaceView;
  readonly created: boolean;
}

/** Phép đổi tiêu đề Workspace. */
export interface WorkspaceRenameRequest {
  readonly workspaceId: WorkspaceId;
  readonly title: string;
}

/** Phép biến đổi Workspace trả về nguyên hàng đã đổi. */
export interface WorkspaceValue {
  readonly workspace: WorkspaceView;
}

/** Phép xoá đăng ký Workspace. */
export interface WorkspaceDeleteRequest {
  readonly workspaceId: WorkspaceId;
}

/** Biên nhận sau khi một đăng ký Workspace bị xoá. */
export interface WorkspaceDeleteValue {
  readonly deleted: true;
}

/** Phép đổi thứ tự Workspace kiểu DOM-insertBefore. */
export interface WorkspaceInsertBeforeRequest {
  readonly workspaceId: WorkspaceId;
  readonly beforeWorkspaceId?: WorkspaceId;
}

/** Toàn bộ thứ tự sổ đăng ký Workspace sau một phép biến đổi. */
export interface WorkspaceOrderValue {
  readonly workspaceIds: readonly WorkspaceId[];
}

/** Phép đổi thứ tự tư cách Session kiểu DOM-insertBefore. */
export interface WorkspaceInsertSessionBeforeRequest {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
  readonly beforeSessionId?: SessionId;
}

/** Session được yêu cầu lưu trữ từ các bề mặt nhóm theo Workspace. */
export interface WorkspaceArchiveSessionRequest {
  readonly sessionId: SessionId;
  /**
   * Dừng việc đang chạy của Session — lượt của nó, các subagent con, tác vụ nền thuộc nó, và các lịch đang
   * hoạt động — thay vì từ chối phép lưu trữ với mã `workspace/session-active`. Các lệnh dừng được gửi
   * TRƯỚC phép ghi lưu trữ và không được chờ; phản hồi tới khi tập lưu trữ đã bền vững.
   */
  readonly stopActivity?: boolean;
}

/** Session được yêu cầu phục hồi từ danh sách Session đã lưu trữ. */
export interface WorkspaceUnarchiveSessionRequest {
  readonly sessionId: SessionId;
}

/** Toàn bộ tập Session đã lưu trữ sau một phép biến đổi. */
export interface WorkspaceArchiveValue {
  readonly archivedSessionIds: readonly SessionId[];
}

/** Session được yêu cầu ghim lên trước các Session chưa ghim trên bề mặt nhóm. */
export interface WorkspacePinSessionRequest {
  readonly sessionId: SessionId;
}

/** Session được yêu cầu gỡ khỏi tập ghim. */
export interface WorkspaceUnpinSessionRequest {
  readonly sessionId: SessionId;
}

/** Toàn bộ tập Session đã ghim sau một phép biến đổi, ghim gần nhất đứng đầu. */
export interface WorkspacePinValue {
  readonly pinnedSessionIds: readonly SessionId[];
}

/** Baseline đầy đủ để trình duyệt nối lại trạng thái Workspace. */
export interface WorkspaceBaseline {
  /** Toàn bộ Workspace đang hoạt động, theo thứ tự sổ đăng ký. */
  readonly items: readonly WorkspaceView[];
  /** Tập phiên đã lưu trữ toàn sổ đăng ký. */
  readonly archivedSessionIds: readonly SessionId[];
  /** Tập phiên đã ghim toàn sổ đăng ký, ghim gần nhất đứng đầu. */
  readonly pinnedSessionIds: readonly SessionId[];
}

/**
 * Một thay đổi Workspace có thứ tự sau baseline của một thế hệ. `replace` mang toàn bộ trạng thái đè lên mọi
 * thứ đã giao trước nó trong thế hệ; nó là một thay đổi, không phải frame mở đầu của thế hệ mới.
 */
export type WorkspaceFollowIncrement =
  | {
      readonly type: "replace";
      readonly value: WorkspaceBaseline;
    }
  | {
      readonly type: "upsert";
      readonly workspace: WorkspaceView;
    }
  | {
      readonly type: "remove";
      readonly workspaceId: WorkspaceId;
    }
  | {
      readonly type: "order";
      readonly workspaceIds: readonly WorkspaceId[];
    }
  | {
      readonly type: "archived";
      readonly archivedSessionIds: readonly SessionId[];
    }
  | {
      readonly type: "pinned";
      readonly pinnedSessionIds: readonly SessionId[];
    };

/** Dòng trạng thái Workspace; mỗi thế hệ mở đầu bằng đúng MỘT baseline. */
export type WorkspaceFollowFrame =
  | {
      readonly type: "baseline";
      readonly value: WorkspaceBaseline;
    }
  | WorkspaceFollowIncrement;
