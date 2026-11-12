/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Bản viết lại của Galaxy Blackhole cho row tool-working-directory: đăng ký tool working_directory
 *      lên sổ tool của kernel và uỷ quyền đọc/đổi thư mục cho seam workingDirectory.
 *      PHASE B (08/11/2026): đọc sổ tool qua SEAM CẤU TRÚC \`ctx.get("tools")\` thay vì \`ctx.tools\`
 *      (ADR 000d: gbh-host-tools cố ý KHÔNG augment \`Context\`, nên nếu đổi import sang id GBH mà vẫn
 *      dùng \`ctx.tools\` thì tsc đỏ TS2339 "Property 'tools' does not exist on type 'Context'").
 */
import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@galaxy-blackhole/gbh-host-tools";
import type { ToolDefinition } from "@galaxy-blackhole/gbh-host-tools";

/** Tên plugin cordis — nguyên văn từ bundle gốc (không phải tên package của ta). */
export const name = "tool-working-directory";

/** Seam phải có trước khi apply chạy: sổ tool của kernel và chủ sở hữu thư mục của phiên. */
export const inject: string[] = ["tools", "workingDirectory"];

/**
 * Mặt cắt của seam workingDirectory mà row này dùng (chủ sở hữu thư mục của phiên).
 * Toàn bộ việc kiểm tra tồn tại, khôi phục, ghi bền và thông báo ngữ cảnh do chính seam lo.
 */
interface WorkingDirectoryLike {
  /**
   * Đọc thư mục đã ghi bền, kiểm nó còn tồn tại và khôi phục thư mục gốc khi nó đã biến mất.
   * Nhận: agent sở hữu phiên và tín hiệu huỷ tuỳ chọn.
   * Trả: đường dẫn tuyệt đối đang tồn tại.
   */
  ensure(agent: unknown, signal?: AbortSignal): Promise<string>;

  /**
   * Đổi thư mục của một phiên (không đổi tiến trình đang chạy, không đổi quyền ghi).
   * Nhận: agent sở hữu phiên, đường dẫn tuyệt đối hoặc tương đối so với thư mục hiện tại, tín hiệu huỷ tuỳ chọn.
   * Trả: đường dẫn tuyệt đối đã chuẩn hoá, được ghi bền trước khi trả về.
   */
  set(agent: unknown, path: string, signal?: AbortSignal): Promise<string>;
}


/**
 * Mặt cắt của SỔ TOOL (service \`tools\`) mà row này dùng — cùng kiểu seam CẤU TRÚC với
 * {@link WorkingDirectoryLike}: chỉ khai đúng phương thức cần, KHÔNG dựa vào augmentation của \`Context\`
 * (ADR 000d). Kiểu \`ToolDefinition\` lấy từ gói ta nên chỉ có MỘT nguồn kiểu.
 */
interface ToolsLike {
  /**
   * Đăng ký một định nghĩa tool vào sổ của tổ hợp plugin.
   * Nhận: định nghĩa tool (đã kiểm bởi \`defineTool\`).
   * Trả: hàm huỷ đăng ký (sổ tool của kernel trả về hàm này).
   */
  register(definition: ToolDefinition): () => void;
}

/**
 * Đăng ký tool working_directory cho tổ hợp plugin này.
 * Nhận: ctx — context cấp seam sổ tool (\`tools\`) và seam workingDirectory.
 * Trả: không; tool được đăng ký vào sổ và trả { cwd } cho model khi được gọi.
 */
export function apply(ctx: Context): void {
  const workingDirectory = ctx.get("workingDirectory") as WorkingDirectoryLike;
  // PHASE B: sổ tool lấy qua SEAM CẤU TRÚC; thiếu seam là lỗi cấu hình ⇒ nổ NGAY (fail loud như bản gốc).
  const tools = ctx.get("tools") as ToolsLike | undefined;
  if (tools === undefined) throw new Error("tool-working-directory requires the tools seam (ctx.get(\"tools\"))");
  tools.register(defineTool({
    name: "working_directory",
    description: "Read the current working directory, or change it with cd. Relative paths use the current directory. Existing shells and running processes keep their own directories.",
    parameters: {
      cd: {
        type: "string",
        description: "Existing directory to enter. Omit to read the current directory.",
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          cwd: {
            type: "string",
            required: true,
            description: "Current absolute working directory.",
          },
        },
      },
      render: (_args, value) => [{ type: "text", text: value.cwd }],
    },
    async execute(args, exec) {
      if (exec.agent === undefined) throw new Error("working_directory requires an agent Session");
      return {
        cwd:
          args.cd === undefined
            ? await workingDirectory.ensure(exec.agent, exec.signal)
            : await workingDirectory.set(exec.agent, args.cd, exec.signal),
      };
    },
  }));
}
