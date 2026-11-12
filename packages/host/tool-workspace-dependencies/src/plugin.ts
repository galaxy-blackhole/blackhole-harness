/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Đăng ký tool load_workspace_dependencies của tool-workspace-dependencies, chép nguyên văn `apply` trong
 *      bundle gốc: kiểm đường dẫn tuyệt đối, effect dọn preparation, schema đầu ra, render, presentCall và cache lời gọi đầu.
 *      PHASE B (08/11/2026): sổ tool đọc qua SEAM CẤU TRÚC `ctx.get("tools")` thay vì `ctx.tools`
 *      (ADR 000d: gói `gbh-host-tools` cố ý KHÔNG augment `Context`).
 */

import { isAbsolute } from "node:path";

import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@galaxy-blackhole/gbh-host-tools";
import type { ToolDefinition } from "@galaxy-blackhole/gbh-host-tools";

import type { Config } from "./config.ts";
import { installPrimaryRuntime, resolvePrimaryRuntime } from "./runtime.ts";
import type { WorkspaceDependencies } from "./types.ts";

/**
 * Mô tả công cụ gửi cho mô hình — NGUYÊN VĂN từng ký tự của bundle gốc.
 * Nhận: không.
 * Trả: chuỗi mô tả mà `load_workspace_dependencies` công bố.
 */
const DESCRIPTION = "Get absolute paths to bundled Python and library directories, plus bundled Python distribution versions. Node.js and pnpm paths are included when the payload provides them. Python includes numpy, pandas, python-docx, python-pptx, openpyxl, Pillow, lxml, and XlsxWriter. Use these libraries for Office files unless the user or workspace instructions select another environment. When Node.js and pnpm paths are returned, run pnpm with that Node executable and pnpm script path. This does not change PATH or package-manager settings.";

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
 * Đăng ký truy vấn đường dẫn chỉ đọc; lời gọi ĐẦU chuẩn bị (hoặc chỉ kiểm) payload.
 * NGUYÊN VĂN thân hàm `apply` của bundle gốc: cùng thứ tự kiểm, cùng chuỗi lỗi, cùng schema và cache.
 * Nhận: ctx — chủ sổ tool (seam `tools`) và `ctx.effect`; config — vị trí payload + thư mục cài tuỳ chọn (đã qua `Config`).
 * Trả: không; tool được đăng ký vào sổ và lần gọi đầu chép/kiểm payload.
 * @throws {Error} khi `source`/`root` không phải đường dẫn tuyệt đối (ném TRƯỚC mọi đăng ký).
 */
export function apply(ctx: Context, config: Config): void {
  if (!isAbsolute(config.source) || config.root !== void 0 && !isAbsolute(config.root)) throw new Error("workspace dependencies: source and root must be absolute paths");
  let preparation: Promise<WorkspaceDependencies> | undefined;
  ctx.effect(() => async () => {
    await preparation?.catch(() => void 0);
  });
  // PHASE B: sổ tool lấy qua SEAM CẤU TRÚC; thiếu seam là lỗi cấu hình ⇒ nổ NGAY (fail loud như bản gốc).
  const tools = ctx.get("tools") as ToolsLike | undefined;
  if (tools === undefined) throw new Error("tool-workspace-dependencies requires the tools seam (ctx.get(\"tools\"))");
  tools.register(defineTool({
    name: "load_workspace_dependencies",
    description: DESCRIPTION,
    parameters: {},
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          python: {
            type: "string",
            required: true,
          },
          node: {
            type: "string",
            description: "Absent when the payload ships no Node.js.",
          },
          pnpm: {
            type: "string",
            description: "Absent when the payload ships no pnpm.",
          },
          pythonPackages: {
            type: "string",
            required: true,
          },
          nodePackages: {
            type: "string",
            description: "Absent when the payload ships no Node.js.",
          },
          pythonDistributions: {
            type: "object",
            additionalProperties: true,
            required: true,
            description: "Bundled distribution names and versions recorded in runtime.json; excludes user-installed additions.",
          },
        },
      },
      render: (_args, value) => [{
        type: "text",
        text: JSON.stringify(value, void 0, 2),
      }],
    },
    execute: () => {
      preparation ??= (config.root === void 0 ? resolvePrimaryRuntime(config.source) : installPrimaryRuntime(config.source, config.root)).catch((error: unknown) => {
        preparation = void 0;
        throw error;
      });
      return preparation;
    },
    presentCall: () => ({
      card: "generic",
      title: "Load workspace dependencies",
      kind: "read",
    }),
  }));
}
