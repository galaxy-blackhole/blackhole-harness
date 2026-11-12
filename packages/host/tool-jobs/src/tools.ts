/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Ba công cụ hướng mô hình job_output · job_list · job_kill — port 1:1 lib/types/index.js của @deepseek-ai/dsh-tool-jobs: giữ nguyên tên/mô tả/tham số/schema đầu ra/render/presentCall, ba nhánh execute, phép cắt nội dung cuối và cách tra trần đầu ra của nhà sản xuất.
 */

import { defineTool } from "@galaxy-blackhole/gbh-host-tools";
import type { ToolDefinition, ToolExecution } from "@galaxy-blackhole/gbh-host-tools";
import { JobId } from "@galaxy-blackhole/gbh-jobs";
import type { JobOutputValue, ToolJobsContext } from "./types.ts";
import { boundSingleText, publicJob, rawSingleText, readBody, statusLine } from "./render.ts";
import { fitWithSuffix } from "./retention.ts";

/** Schema dùng chung cho đầu ra của ba công cụ điều khiển job — NGUYÊN VĂN bản gốc. */
const PUBLIC_JOB_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: {
      type: "string",
      required: true,
    },
    kind: {
      type: "string",
      required: true,
    },
    label: {
      type: "string",
      required: true,
    },
    status: {
      type: "string",
      required: true,
      enum: ["running", "stopping", "completed", "killed", "failed"],
    },
    detail: { type: "string" },
    startedAt: {
      type: "integer",
      required: true,
    },
    finishedAt: { type: "integer" },
  },
} as const;

/** Kiểu của hàm cắt nội dung cuối mà defineTool nhận — lấy từ chính ToolDefinition. */
type Finalizer = NonNullable<ToolDefinition["finalizeContent"]>;

/**
 * Trần đầu ra của nhà sản xuất cho job mà một lời gọi job_output/job_kill nêu, khi người gọi thấy được.
 * Nhận: ctx — context plugin; exec — lời gọi đang chuẩn bị chạy.
 * Trả: trần byte, hoặc undefined khi không áp dụng/không thấy job.
 */
export function visibleOutputLimit(ctx: ToolJobsContext, exec: Readonly<ToolExecution>): number | undefined {
  if (exec.name !== "job_output" && exec.name !== "job_kill") return undefined;
  const jobId = (exec.arguments as { job_id?: unknown } | undefined)?.job_id;
  if (typeof jobId !== "string" || jobId.length === 0) return undefined;
  return ctx.jobs.list(exec.agent?.id).find((job) => job.id === jobId)?.outputLimitBytes;
}

/**
 * Kiểm ràng buộc KHÁC RỖNG mà ParameterSchemaSpec không diễn đạt được — NGUYÊN VĂN validateJobId của bản gốc.
 * Nhận: value — chuỗi job_id mô hình gửi.
 * Trả: cùng chuỗi đã đánh dấu JobId.
 * @throws {Error} khi chuỗi rỗng — thông điệp NGUYÊN VĂN bản gốc.
 */
export function validateJobId(value: string): ReturnType<typeof JobId> {
  if (value.length === 0) throw new Error("invalid job_id: expected a non-empty string, got " + JSON.stringify(value));
  return JobId(value);
}

/**
 * Dựng phần trình bày lời gọi đang chờ dùng chung cho ba công cụ điều khiển job — NGUYÊN VĂN presentJobCall.
 * Nhận: title — tiêu đề; kind — loại lời gọi (read/execute); rawInput — đầu vào nổi bật (vắng thì bỏ khoá).
 * Trả: view generic đang chờ.
 */
export function presentJobCall(title: string, kind: "read" | "execute", rawInput?: string): { card: "generic"; title: string; kind: "read" | "execute"; rawInput?: string } {
  return {
    card: "generic",
    title,
    kind,
    ...(rawInput !== undefined ? { rawInput } : {}),
  };
}

/**
 * Dựng hàm cắt nội dung cuối cho job_output/job_kill — NGUYÊN VĂN finalizeJobContent trong apply của bản gốc.
 * Nhận: ctx — context plugin; outputLimits — bản đồ yếu ghi trần đầu ra đã chuẩn bị ở tools/pre-execute.
 * Trả: hàm finalizeContent dùng cho cả hai định nghĩa công cụ.
 * @throws {Error} khi trần đầu ra không phải số nguyên không âm (ủy nhiệm cho phép cắt của bản gốc).
 */
export function createFinalizeJobContent(ctx: ToolJobsContext, outputLimits: WeakMap<ToolExecution, number>): Finalizer {
  return (exec, result) => {
    const maxBytes = outputLimits.get(exec) ?? visibleOutputLimit(ctx, exec);
    outputLimits.delete(exec);
    if (maxBytes === undefined) return undefined;
    if (exec.name === "job_output" && !result.isError) {
      const value = result.value as unknown as JobOutputValue;
      const body = value.text.length > 0 ? value.text : "(no new output)";
      const content = body.endsWith("\n") ? body.slice(0, -1) : body;
      const suffix = "\n" + statusLine(value.job);
      if (rawSingleText(result.content) === content + suffix) {
        return [{ type: "text", text: fitWithSuffix(content, suffix, maxBytes, "\n[output truncated]") }];
      }
    }
    return boundSingleText(result.content, maxBytes) as ReturnType<Finalizer>;
  };
}

/**
 * Đăng ký ba công cụ điều khiển job lên sổ công cụ — NGUYÊN VĂN ba khối ctx.tools.register của bản gốc.
 * Nhận: ctx — context plugin; deps — trần chờ mặc định/trần cứng, hàm cắt cuối và tập id do mô hình giết.
 * Trả: không.
 */
export function registerJobTools(
  ctx: ToolJobsContext,
  deps: {
    readonly waitDefault: number;
    readonly waitCap: number;
    readonly finalizeJobContent: Finalizer;
    readonly killedByModel: Set<string>;
  },
): void {
  const { waitDefault, waitCap, finalizeJobContent, killedByModel } = deps;
  ctx.tools.register(
    defineTool({
      name: "job_output",
      description: "Read a background job: output since the previous read for stream jobs, or the result of a finished final-output job.",
      parameters: {
        job_id: {
          type: "string",
          required: true,
          description: "Job id returned by the tool that started the background work.",
        },
        wait: {
          type: "boolean",
          description: "Block until the job finishes or the timeout expires; a timed-out wait leaves the job running. Defaults to false.",
        },
        timeout_ms: {
          type: "number",
          description: "Max wait in milliseconds with wait: true. Defaults to and is capped by configuration.",
        },
      },
      finalizeContent: finalizeJobContent,
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: {
              type: "string",
              required: true,
            },
            job: {
              ...PUBLIC_JOB_SCHEMA,
              required: true,
            },
          },
        },
        render: (_args, value) => {
          const body = value.text.length > 0 ? value.text : "(no new output)";
          return [
            {
              type: "text",
              text: body + (body.endsWith("\n") ? "" : "\n") + statusLine(value.job),
            },
          ];
        },
      },
      async execute(args, exec) {
        const id = validateJobId(args.job_id);
        const jobs = ctx.jobs;
        if (args.wait === true) {
          await jobs.wait(id, Math.min(args.timeout_ms ?? waitDefault, waitCap), exec.agent?.id, exec.signal);
        }
        return readBody(jobs.read(id, exec.agent?.id));
      },
      presentCall: (args) => presentJobCall("Read output from background job " + args.job_id, "read", args.job_id),
    }),
  );
  ctx.tools.register(
    defineTool({
      name: "job_list",
      description: "List your background jobs (running and finished) with their ids, kinds, and statuses.",
      parameters: {},
      output: {
        schema: {
          type: "array",
          items: PUBLIC_JOB_SCHEMA,
        },
        render: (_args, jobs) => [
          {
            type: "text",
            text: jobs.length === 0 ? "(no background jobs)" : jobs.map((job) => job.id + " [" + job.kind + "] " + job.status + " — " + job.label).join("\n"),
          },
        ],
      },
      execute(_args, exec) {
        const jobs = ctx.jobs.list(exec.agent?.id);
        return Promise.resolve(jobs.map(publicJob));
      },
      presentCall: () => presentJobCall("List background jobs", "read"),
    }),
  );
  ctx.tools.register(
    defineTool({
      name: "job_kill",
      description: "Request cancellation of a running background job.",
      parameters: {
        job_id: {
          type: "string",
          required: true,
          description: "Job id returned by the tool that started the background work.",
        },
        reason: {
          type: "string",
          description: "Optional short reason, recorded in the log and forwarded to the job.",
        },
      },
      finalizeContent: finalizeJobContent,
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            outcome: {
              type: "string",
              required: true,
              enum: ["cancellation-requested", "already-finished"],
            },
            job: {
              ...PUBLIC_JOB_SCHEMA,
              required: true,
            },
          },
        },
        render: (_args, value) => [
          {
            type: "text",
            text:
              value.outcome === "already-finished"
                ? "job " + value.job.id + " had already finished " + statusLine(value.job)
                : "requested cancellation of job " + value.job.id,
          },
        ],
      },
      execute(args, exec) {
        const id = validateJobId(args.job_id);
        const jobs = ctx.jobs;
        const result = jobs.kill(id, exec.agent?.id, args.reason);
        if (result === "requested") killedByModel.add(id);
        const job = publicJob(jobs.get(id, exec.agent?.id));
        return Promise.resolve({
          outcome: result === "already-finished" ? "already-finished" : "cancellation-requested",
          job,
        });
      },
      presentCall: (args) => presentJobCall("Kill background job " + args.job_id, "execute", args.job_id),
    }),
  );
}
