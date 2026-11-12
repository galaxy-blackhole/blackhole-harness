/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc SEAM CẤU TRÚC của sổ workspace (ADR 000d — PHASE B 08/11/2026, dev-1): thay cho thuộc tính augment
 *      ctx.workspaceRegistry của bản stock. Chỉ khai đúng phần API mà controller dùng nên đổi import sang id GBH
 *      không còn làm mất augmentation (TS2339), và vẫn fail loud khi thiếu seam.
 */
import type { Workspace, WorkspaceId } from "@galaxy-blackhole/gbh-workspace";
import type { SessionId } from "@galaxy-blackhole/gbh-session";

/**
 * Hình dạng CẤU TRÚC của sổ workspace mà controller cần (13 thành viên dùng thật).
 */
export interface WorkspaceRegistryLike {
  /** Lấy workspace theo id. Nhận: id. Trả: workspace hoặc undefined. */
  get(id: WorkspaceId): Workspace | undefined;
  /** Liệt kê workspace theo thứ tự người dùng. Nhận: không. Trả: mảng workspace. */
  list(): readonly Workspace[];
  /** Tạo workspace cho một đường dẫn. Nhận: path + tiêu đề tuỳ chọn. Trả: workspace đã tạo. */
  create(path: string, title?: string): Promise<Workspace>;
  /** Xoá workspace. Nhận: id. Trả: true khi đã xoá. */
  delete(id: WorkspaceId): Promise<boolean>;
  /** Tìm workspace đã đăng ký cho đường dẫn. Nhận: path. Trả: workspace hoặc undefined. */
  resolveByPath(path: string): Promise<Workspace | undefined>;
  /** Chèn workspace trước một workspace khác. Nhận: id + id mốc. Trả: thứ tự mới. */
  insertBefore(id: WorkspaceId, beforeId?: WorkspaceId): Promise<readonly WorkspaceId[]>;
  /** Bảo đảm có workspace mặc định. Nhận: hàm phân giải thư mục. Trả: workspace hoặc undefined. */
  initializeDefault(resolveDirectory: () => Promise<string>): Promise<Workspace | undefined>;
  /** Lưu trữ một phiên. Nhận: sessionId + tuỳ chọn dừng hoạt động. Trả: không. */
  archiveSession(sessionId: SessionId, options?: { readonly stopActivity?: boolean }): Promise<void>;
  /** Bỏ lưu trữ một phiên. Nhận: sessionId. Trả: không. */
  unarchiveSession(sessionId: SessionId): Promise<void>;
  /** Ghim một phiên. Nhận: sessionId. Trả: không. */
  pinSession(sessionId: SessionId): Promise<void>;
  /** Bỏ ghim một phiên. Nhận: sessionId. Trả: không. */
  unpinSession(sessionId: SessionId): Promise<void>;
  /** Tập phiên đang lưu trữ (chỉ đọc). */
  readonly archivedSessionIds: readonly SessionId[];
  /** Tập phiên đang ghim (chỉ đọc). */
  readonly pinnedSessionIds: readonly SessionId[];
}

/**
 * Lấy sổ workspace theo CẤU TRÚC: ưu tiên ctx.get("workspaceRegistry") (đường chính thức của cordis), chạm
 * dự phòng thuộc tính cùng tên (kernel cũ và giàn test chỉ phơi thuộc tính).
 * Nhận: ctx — context cordis (hoặc vật giả trong test). Trả: seam workspace; ném TypeError khi thiếu.
 */
export function workspaceRegistryOf(ctx: unknown): WorkspaceRegistryLike {
  const holder = ctx as { get?: (key: string) => unknown; [key: string]: unknown };
  const viaGet = typeof holder.get === "function" ? holder.get("workspaceRegistry") : undefined;
  const seam = (viaGet ?? holder.workspaceRegistry ?? undefined) as WorkspaceRegistryLike | undefined;
  if (seam === undefined) {
    throw new TypeError('api-workspace-controller requires the workspaceRegistry seam (ctx.get("workspaceRegistry"))');
  }
  return seam;
}
