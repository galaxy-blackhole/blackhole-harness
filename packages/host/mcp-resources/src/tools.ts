/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Ba tool dùng chung: chuyển tham số của model thành phép toán tài nguyên có phạm vi.
 *      PHASE B (08/11/2026): sổ tool đọc qua SEAM CẤU TRÚC `ctx.get("tools")` thay vì `ctx.tools`
 *      (ADR 000d: gói `gbh-host-tools` cố ý KHÔNG augment `Context`).
 */
import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@galaxy-blackhole/gbh-host-tools";
import type { ParameterSchemaSpec, ToolDefinition, ToolExecution } from "@galaxy-blackhole/gbh-host-tools";
import { renderResourceResult } from "./render.ts";
import type { JsonValue, McpResourceRequest } from "./types.ts";

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

/** Một lượt gọi tài nguyên do tool chuyển tiếp, đã gắn danh tính người gọi. */
export type RequestResource = (
  server: string,
  request: McpResourceRequest,
  exec: ToolExecution,
) => Promise<JsonValue>;

/** Tham số chung của hai tool LIỆT KÊ: tên server bắt buộc, cursor tuỳ chọn. */
const listParameters = {
  server: {
    type: "string",
    required: true,
    description: "Configured MCP server name.",
  },
  cursor: {
    type: "string",
    description: "Continuation cursor returned by this server.",
  },
} as const satisfies ParameterSchemaSpec;

/** Hợp đồng đầu ra dùng chung cho cả ba tool: JSON chuẩn + phép render có quy kết server. */
const output = {
  schema: { type: "json" },
  render: (args: { server: string }, value: JsonValue) => renderResourceResult(args.server, value),
} as const;

/**
 * Đăng ký ba phép toán tài nguyên vào phạm vi tool của người tiêu thụ.
 *
 * Mỗi lượt đăng ký là một hiệu ứng; ba hiệu ứng con được đăng ký NGAY khi generator chạy, nên
 * disposer trả về gỡ cả ba tool đồng bộ (đúng thứ tự ngược).
 * Nhận: context sở hữu lượt đăng ký, và phép toán biết người gọi.
 * Trả: hiệu ứng gỡ cả ba tool.
 */
export function registerResourceTools(ctx: Context, request: RequestResource): () => void {
  // PHASE B: sổ tool lấy qua SEAM CẤU TRÚC; thiếu seam là lỗi cấu hình ⇒ nổ NGAY (fail loud như bản gốc).
  const tools = ctx.get("tools") as ToolsLike | undefined;
  if (tools === undefined) throw new Error("mcp-resources requires the tools seam (ctx.get(\"tools\"))");
  return ctx.effect(function* (): Generator<() => void, void, void> {
    yield tools.register(
      defineTool({
        name: "list_mcp_resources",
        description: "List resources available from an MCP server.",
        parameters: listParameters,
        output,
        execute: (args, exec) =>
          request(
            args.server,
            { method: "resources/list", ...(args.cursor === undefined ? {} : { cursor: args.cursor }) },
            exec,
          ),
      }),
    );
    yield tools.register(
      defineTool({
        name: "list_mcp_resource_templates",
        description: "List parameterized resource URI templates from an MCP server.",
        parameters: listParameters,
        output,
        execute: (args, exec) =>
          request(
            args.server,
            { method: "resources/templates/list", ...(args.cursor === undefined ? {} : { cursor: args.cursor }) },
            exec,
          ),
      }),
    );
    yield tools.register(
      defineTool({
        name: "read_mcp_resource",
        description:
          "Read an MCP resource by URI from the named server. Use a listed URI or an expanded resource template.",
        parameters: {
          server: listParameters.server,
          uri: {
            type: "string",
            required: true,
            description: "Resource URI to read.",
          },
        },
        output,
        execute: (args, exec) => request(args.server, { method: "resources/read", uri: args.uri }, exec),
      }),
    );
  }, "mcpResources.resourceTools");
}
