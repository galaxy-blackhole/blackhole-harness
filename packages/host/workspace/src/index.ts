/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của gói: `WorkspaceId` (thương hiệu), sổ đăng ký `ctx.workspaceRegistry`, bốn lớp
 *      lỗi, và ba mảnh của miền dữ liệu (`workspaceDomainSpec` · `workspaceDomainState` ·
 *      `workspaceRecord`) cộng `realpathNormalize` — ĐÚNG tập export của bản gốc.
 */
import type { WorkspaceId as WorkspaceIdBrand } from "./types.ts";

import { WorkspaceRegistry } from "./registry.ts";

export { WorkspaceMoveInvalidError } from "./entity.ts";
export { WorkspaceRegistry };
export default WorkspaceRegistry;
export {
  WorkspaceActiveSessionError,
  WorkspaceArchivedSessionPinError,
  WorkspaceOrderInvalidError,
  WorkspaceUnknownSessionError,
} from "./errors.ts";
export { realpathNormalize } from "./paths.ts";
export { workspaceDomainSpec, workspaceDomainState, workspaceRecord } from "./spec.ts";
export type { WorkspaceDomainState, WorkspaceRecord } from "./spec.ts";
export type {
  ArchiveSessionOptions,
  SessionActivity,
  SessionActivityItem,
  SessionActivityKind,
  SessionActivityKindMap,
  SessionActivityRequest,
  Workspace,
} from "./types.ts";

/** Danh tính của MỘT bản ghi workspace (xem lý do dùng thương hiệu ở `src/types.ts`). */
export type WorkspaceId = WorkspaceIdBrand;

/**
 * Đóng dấu một chuỗi thành {@link WorkspaceId}.
 * Nhận: chuỗi id workspace thô.
 * Trả: CHÍNH chuỗi đó, mang thương hiệu lúc biên dịch (không có biểu diễn lúc chạy).
 */
export function WorkspaceId(id: string): WorkspaceId {
  return id as WorkspaceId;
}
