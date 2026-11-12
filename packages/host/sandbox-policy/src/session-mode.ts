/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ghi đè chế độ sandbox theo TỪNG PHIÊN: nhật ký phiên làm kho — mỗi lần đổi là
 *      đúng một sự kiện `sandbox/mode`, không có kho cấu hình ngoài
 */

/** Chế độ tác động tệp của sandbox — giữ nguyên từ vựng của seam `@deepseek-ai/dsh-sandbox`. */
export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

/** Phiên tối thiểu mà đường ghi này cần (định danh + siêu dữ liệu + nhật ký) — tra theo HÌNH DẠNG. */
export interface SandboxSession {
  /** Định danh phiên (đi kèm chính sách đã giải để backend khoá trạng thái theo phiên). */
  readonly id: string;
  /** Siêu dữ liệu bất biến của phiên; `cwd` là biên `workspace-write` của phiên. */
  readonly header: { readonly cwd?: string };
  /** Ghi một sự kiện vào nhật ký phiên. */
  append(type: string, data: unknown): void;
}

/** Mọi {@link SandboxMode}, để quảng cáo lựa chọn và kiểm tra chuỗi chế độ không tin cậy. */
export const SANDBOX_MODES: readonly SandboxMode[] = ["read-only", "workspace-write", "danger-full-access"];

/**
 * ĐƯỜNG GHI duy nhất cho ghi đè chế độ sandbox của một phiên: ghi thêm ĐÚNG MỘT sự kiện `sandbox/mode`
 * — lần đổi CHÍNH LÀ sự kiện của nó, không ai sửa trạng thái chế độ ngoài đường này.
 * Nhận: phiên sở hữu ghi đè, và chế độ cho mọi lời gọi bị hạn chế tiếp theo của phiên đó.
 * Trả: không (hiệu lực ở lời gọi kế tiếp, vì bên tiêu thụ đọc trạng thái chiếu dùng chung).
 */
export function setSandboxMode(session: SandboxSession, mode: SandboxMode): void {
  session.append("sandbox/mode", { mode });
}
