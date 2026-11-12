/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Worktree: đăng ký tool create_worktree lên sổ tool
 *      của kernel và uỷ quyền tạo nhánh + worktree, rồi đổi thư mục phiên, cho seam worktrees.
 *      PHASE B (08/11/2026): sổ tool đọc qua SEAM CẤU TRÚC `ctx.get("tools")` thay vì `ctx.tools`
 *      (ADR 000d: gói `gbh-host-tools` cố ý KHÔNG augment `Context`).
 */
import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@galaxy-blackhole/gbh-host-tools";
import type { ToolDefinition } from "@galaxy-blackhole/gbh-host-tools";

/** Tên plugin cordis — nguyên văn từ bundle gốc (không phải tên package của ta). */
export const name = "tool-worktree";

/** Seam phải có trước khi apply chạy: sổ tool của kernel và runtime worktree của phiên. */
export const inject: string[] = ["tools", "worktrees"];

/** Yêu cầu tạo worktree (nguyên văn hình dạng bản gốc truyền cho seam). */
interface CreateWorktreeRequestLike {
  /** Tên nhánh mới, đồng thời là tên thư mục checkout; bỏ trống thì seam tự sinh tên. */
  name?: string;
  /** Commit/nhánh/tag cục bộ để bắt đầu; bỏ trống thì seam dùng HEAD và KHÔNG fetch. */
  from?: string;
}

/** Kết quả tạo worktree mà seam trả về (cũng là schema kết quả của tool). */
interface CreatedWorktreeLike {
  /** Đường dẫn tuyệt đối của checkout mới. */
  path: string;
  /** Tên nhánh vừa tạo. */
  branch: string;
  /** Commit đã phân giải làm mốc. */
  baseCommit: string;
  /** Gốc của repo nguồn. */
  repositoryRoot: string;
}

/**
 * Mặt cắt của seam worktrees mà row này dùng.
 * Toàn bộ việc phân giải revision, tạo nhánh/checkout, giới hạn tài nguyên tiến trình và ghi bền
 * thư mục phiên do chính seam lo — row này KHÔNG tự gọi git và KHÔNG tự ghi đĩa.
 */
interface WorktreeRuntimeLike {
  /**
   * Tạo nhánh mới + checkout mới tại một revision cục bộ, rồi đưa phiên vào đó.
   * Nhận: agent gọi (thư mục hiện tại của nó chọn repo nguồn), yêu cầu tuỳ chọn, tín hiệu huỷ tuỳ chọn.
   * Trả: đường dẫn checkout, tên nhánh, commit mốc và gốc repo nguồn.
   */
  create(agent: unknown, request?: CreateWorktreeRequestLike, signal?: AbortSignal): Promise<CreatedWorktreeLike>;
}

/**
 * Mặt cắt của SỔ TOOL (service `tools`) mà row này dùng — seam CẤU TRÚC, KHÔNG dựa vào augmentation
 * của `Context` (ADR 000d). Kiểu `ToolDefinition` lấy từ gói ta nên chỉ có MỘT nguồn kiểu.
 */
interface ToolsLike {
  /**
   * Đăng ký một định nghĩa tool vào sổ của phạm vi đang cài.
   * Nhận: định nghĩa tool (đã kiểm bởi `defineTool`).
   * Trả: hàm huỷ đăng ký (sổ tool của kernel trả về hàm này).
   */
  register(definition: ToolDefinition): () => void;
}

/**
 * Đọc seam worktrees ở THỜI ĐIỂM GỌI (không giữ tham chiếu từ lúc apply) — đúng cách bản gốc đọc
 * qua proxy của cordis, để một seam được thay/reset sau apply vẫn được nhìn thấy.
 * Nhận: ctx — context đã có seam worktrees (nhờ inject).
 * Trả: mặt cắt seam mà tool dùng.
 */
function worktreesOf(ctx: Context): WorktreeRuntimeLike {
  return ctx.get("worktrees") as WorktreeRuntimeLike;
}

/**
 * Đăng ký tool create_worktree cho tổ hợp plugin này.
 * Nhận: ctx — context cấp sổ tool (seam `tools`) và seam worktrees.
 * Trả: không; tool được đăng ký vào sổ và trả { path, branch, baseCommit, repositoryRoot } khi được gọi.
 */
export function apply(ctx: Context): void {
  // PHASE B: sổ tool lấy qua SEAM CẤU TRÚC; thiếu seam là lỗi cấu hình ⇒ nổ NGAY (fail loud như bản gốc).
  const tools = ctx.get("tools") as ToolsLike | undefined;
  if (tools === undefined) throw new Error("tool-worktree requires the tools seam (ctx.get(\"tools\"))");
  tools.register(defineTool({
    name: "create_worktree",
    description: "Create a new Git branch and worktree from a local commit, branch, or tag, then change this session's working directory to it. Defaults to HEAD and a generated name. Uncommitted files stay in the source checkout. Existing names fail. Use working_directory with cd to leave; the checkout and branch remain.",
    parameters: {
      name: {
        type: "string",
        description: "New branch name, also used as the checkout directory. Omit to generate a unique name.",
      },
      from: {
        type: "string",
        description: "Local commit, branch, or tag to start from. Defaults to HEAD; no fetch is performed.",
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: {
            type: "string",
            required: true,
          },
          branch: {
            type: "string",
            required: true,
          },
          baseCommit: {
            type: "string",
            required: true,
          },
          repositoryRoot: {
            type: "string",
            required: true,
          },
        },
      },
      render: (_args, value) => [{
        type: "text",
        text: JSON.stringify(value),
      }],
    },
    async execute(args, exec) {
      if (exec.agent === undefined) throw new Error("create_worktree requires a calling agent");
      return worktreesOf(ctx).create(exec.agent, args, exec.signal);
    },
    presentCall: (args) => ({
      card: "generic",
      title: "create_worktree",
      rawInput: args,
    }),
  }));
}
