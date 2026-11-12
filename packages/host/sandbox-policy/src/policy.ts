/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Hình dạng HỢP ĐỒNG và hai hàm thuần của nhà chính sách sandbox: gốc workspace
 *      tuyệt đối, chữ ngữ cảnh model, và schema trạng thái của đơn vị chiếu `sandboxMode`
 */

import { isAbsolute } from "node:path";
import { SANDBOX_MODES, type SandboxMode, type SandboxSession } from "./session-mode.ts";

/** Chính sách tác động tệp đã giải cho MỘT lời gọi (khớp `SandboxExecutionPolicy` của seam sandbox). */
export interface SandboxExecutionPolicy {
  /** Chế độ tác động tệp mà lời gọi này chạy dưới. */
  mode: SandboxMode;
  /** Gốc tuyệt đối mà `workspace-write` được ghi trong đó (mang cả khi chế độ không dùng tới). */
  workspaceRoot: string;
  /** Định danh phiên gọi; VẮNG khi lời gọi không có phiên. */
  sessionId?: string;
}

/** Đầu vào chọn chính sách cho một lời gọi capability. */
export interface SandboxPolicyRequest {
  /** Phiên gọi; `cwd` bất biến của nó trở thành biên workspace. */
  session?: SandboxSession;
  /** Chế độ đã được duyệt, xếp TRÊN chính sách của phiên. */
  mode?: SandboxMode;
}

/** Một sự kiện nhật ký phiên, ở dạng mà hàm gộp của đơn vị chiếu cần. */
export interface ProjectionEvent {
  /** Loại sự kiện (đơn vị này chỉ quan tâm `sandbox/mode`). */
  readonly type: string;
  /** Dữ liệu sự kiện. */
  readonly data: { readonly mode?: unknown };
}

/** Trạng thái đã lưu của đơn vị chiếu `sandboxMode`: chế độ cuối, hoặc `null` trước lần đổi đầu. */
export type SandboxModeState = SandboxMode | null;

/** Validator trạng thái đã lưu, đúng phần mà sổ chiếu dùng (`.parse`). */
export interface SandboxModeStateSchema {
  /** Kiểm một giá trị đã lưu. Nhận: giá trị thô. Trả: chế độ hợp lệ hoặc `null`; ném khi sai. */
  parse(value: unknown): SandboxModeState;
}

/** Định nghĩa một đơn vị chiếu phiên (hình dạng mà seam `sessionProjections` nhận). */
export interface ProjectionDefinition {
  /** Khoá của đơn vị trong bảng chiếu. */
  key: string;
  /** Phiên bản trạng thái; dòng lưu lệch phiên bản bị bỏ và gộp lại từ `init`. */
  stateVersion: number;
  /** Validator cho trạng thái đã lưu. */
  stateSchema: SandboxModeStateSchema;
  /** Trạng thái khởi đầu. Nhận: siêu dữ liệu phiên + số sự kiện thừa hưởng. Trả: `null`. */
  init(header: unknown, inheritedEventCount: number): SandboxModeState;
  /** Gộp một sự kiện. Nhận: trạng thái hiện tại + sự kiện. Trả: trạng thái kế tiếp. */
  apply(state: SandboxModeState, event: ProjectionEvent): SandboxModeState;
}

/** Seam sổ chiếu phiên (`ctx.sessionProjections`) — tra theo hình dạng, KHÔNG import gói seam. */
export interface SessionProjectionsSeam {
  /** Đăng ký một đơn vị chiếu. Nhận: định nghĩa. Trả: chính bộ huỷ đã đăng ký. */
  register(definition: ProjectionDefinition): unknown;
  /** Đọc trạng thái host hiện tại của một đơn vị. Nhận: phiên + khoá. Trả: trạng thái, hoặc undefined. */
  stateOf(session: SandboxSession, key: string): SandboxModeState | undefined;
}

/** Ngữ cảnh lắp prompt mà nhà cung cấp chữ ngữ cảnh nhận. */
export interface AssembleContextLike {
  /** Agent của lượt lắp này, nếu có. */
  agent?: { session?: SandboxSession };
}

/** Mục ngữ cảnh đóng góp cho system prompt. */
export interface PromptContextLike {
  /** Tên duy nhất của mục. */
  name: string;
  /** Thứ tự ghép (tăng dần). */
  order: number;
  /** Chữ tĩnh hoặc nhà cung cấp chữ, tính lúc lắp prompt. */
  text: (context: AssembleContextLike) => string;
}

/** Seam system prompt (`ctx.systemPrompt`) — tra theo hình dạng, KHÔNG import gói seam. */
export interface SystemPromptSeam {
  /** Thứ tự chuẩn của một mục ngữ cảnh theo tên. Nhận: tên mục. Trả: số thứ tự. */
  getContextOrder(name: string): number;
  /** Đăng ký một mục ngữ cảnh. Nhận: mục. Trả: bộ huỷ của kernel. */
  context(context: PromptContextLike): unknown;
}

/**
 * Giữ nguyên cách viết của thế giới THI HÀNH: bên cưỡng chế tự giải định danh hệ tệp trên host của nó.
 * Nhận: đường dẫn gốc workspace.
 * Trả: chính đường dẫn đó khi là tuyệt đối; ném lỗi khi là tương đối.
 */
export function resolveWorkspaceRoot(path: string): string {
  if (!isAbsolute(path)) throw new Error("sandbox-policy: workspace root must be an absolute execution-world path");
  return path;
}

/**
 * Diễn đạt chính sách mà KHÔNG tự nhận đã mount capability nào.
 * Nhận: chính sách đã giải của lượt lắp prompt.
 * Trả: đúng một đoạn chữ ngữ cảnh cho chế độ hiện hành.
 */
export function renderPolicyContext(policy: SandboxExecutionPolicy): string {
  switch (policy.mode) {
    case "read-only":
      return "Current Galaxy Blackhole file policy: read-only. Any available operation enforced by the Galaxy Blackhole file sandbox cannot modify files in the standing mode. Do not refuse a required modification from this policy alone: try an available tool normally and follow any denial and escalation guidance it returns.";
    case "workspace-write":
      return "Current Galaxy Blackhole file policy: workspace-write. Any available operation enforced by the Galaxy Blackhole file sandbox may modify files under the session workspace: " + JSON.stringify(policy.workspaceRoot) + ". Some platform temporary areas may also be writable.";
    case "danger-full-access":
      return "Current Galaxy Blackhole file policy: danger-full-access. The Galaxy Blackhole file sandbox does not restrict file modifications by available operations.";
    default: {
      // Nhánh bất khả: SandboxMode là union đóng trong cùng tiến trình; đây chỉ là chốt vét cạn.
      const mode: never = policy.mode;
      throw new Error("unreachable sandbox mode: " + String(mode));
    }
  }
}

/**
 * Schema trạng thái của đơn vị chiếu `sandboxMode` (trạng thái BẰNG hình dạng công khai).
 * Bản gốc dùng `zod`; ở đây là validator cùng hợp đồng `.parse`: nhận đúng ba chế độ hoặc `null`,
 * ném khi khác — nên đường khôi phục từ dòng lưu xử sự y hệt mà không kéo thêm phụ thuộc runtime.
 */
export const sandboxModeStateSchema: SandboxModeStateSchema = {
  parse(value: unknown): SandboxModeState {
    if (value === null) return null;
    for (const mode of SANDBOX_MODES) if (value === mode) return mode;
    throw new Error("sandbox-policy: sandboxMode state must be one of " + SANDBOX_MODES.join(" | ") + " or null");
  },
};
