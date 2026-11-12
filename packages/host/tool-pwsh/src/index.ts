/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng `#region lib/types/index.js` của bundle gốc @deepseek-ai/dsh-tool-pwsh (dòng 214–735):
 *      Consumer PowerShell hướng model trên seam `ctx.shell` — tiền cảnh + `run_in_background`, job
 *      registry, môi trường `DSH_*`, chính sách sandbox theo lời gọi, escalate qua `ctx.approval`, và
 *      trình bày thẻ terminal. Logic/chuỗi/hằng số/schema/thứ tự tham số NGUYÊN VĂN; chỉ thêm kiểu.
 */

import { isAbsolute, resolve } from "node:path";

import z from "@deepseek-ai/schemastery";
import { TOOL_ABORTED, defineTool } from "@galaxy-blackhole/gbh-host-tools";
import type { ToolDefinition } from "@galaxy-blackhole/gbh-host-tools";
import { HarnessError } from "@deepseek-ai/dsh-llm";
import { ESCALATION_TARGETS, approveEscalation, sandboxPermissionsDescription, validateEscalationArgs } from "@deepseek-ai/dsh-sandbox";
import { parseExitStatus } from "@deepseek-ai/dsh-shell";

import { processJob, processOutcome, processSources, ringDelta } from "./background.ts";
import { renderPwshJobRead, renderPwshPromoted, renderPwshResult } from "./render.ts";
import type {
  AgentLike,
  CollectedOutput,
  JobRegistry,
  ProcessHandle,
  PwshArgs,
  PwshContext,
  PwshForegroundResult,
  PwshOutput,
  SandboxExecutionPolicy,
  SandboxMode,
  SandboxPolicyService,
  ShellExecRequest,
  ShellExecSpec,
  ShellRunResult,
  ToolExec,
} from "./types.ts";

/**
 * Tên plugin cordis — NGUYÊN VĂN bản gốc.
 * Nhận: không.
 * Trả: "tool-pwsh".
 */
export const name = "tool-pwsh";

/**
 * Service bắt buộc của plugin — NGUYÊN VĂN bản gốc (sổ tool · seam shell · prompt hệ thống · môi trường shell · thư mục làm việc).
 * Nhận: không.
 * Trả: mảng tên service theo ĐÚNG thứ tự bản gốc.
 */
export const inject: string[] = [
  "tools",
  "shell",
  "systemPrompt",
  "shellEnv",
  "workingDirectory"
];

/**
 * Cấu hình hướng triển khai của tool pwsh — NGUYÊN VĂN `interface Config` trong
 * lib/types/index.d.ts của bản gốc (hợp nhất khai báo với schema cùng tên).
 * Nhận: — (kiểu chỉ tồn tại lúc biên dịch, không có giá trị chạy).
 * Trả: — (kiểu chỉ tồn tại lúc biên dịch, không có giá trị chạy).
 */
export interface Config {
  /**
   * Phơi `run_in_background` khi có job registry (mặc định true); lời gọi bị tắt cũng bị từ chối.
   * Không có registry thì tool chỉ chạy tiền cảnh bất kể giá trị này.
   */
  enableRunInBackground?: boolean;
  /**
   * Giữ lệnh tiền cảnh đã tới hạn chót tiếp tục chạy như một job nền thay vì giết (mặc định true).
   * Chỉ áp dụng khi chạy nền khả dụng.
   */
  promoteOnTimeout?: boolean;
}

/**
 * Schema cấu hình của tool pwsh — NGUYÊN VĂN `const Config = z.object({...})` của bản gốc:
 * cùng thứ tự trường, cùng `z.boolean()` và cùng hai default true.
 * Nhận: value — cấu hình thô (có thể thiếu, null hoặc sai kiểu).
 * Trả: cấu hình đã điền hai cờ, giữ nguyên khoá lạ như bản gốc.
 * @throws {ValidationError} khi gốc không phải object hoặc trường sai kiểu.
 */
export const Config = z.object({
  enableRunInBackground: z.boolean().default(true),
  promoteOnTimeout: z.boolean().default(true)
});

/**
 * Kiểm tham số model trước khi chạy — NGUYÊN VĂN `validatePwshArgs` của bản gốc, đúng thứ tự kiểm.
 * Nhận: args — tham số đã qua schema (chuỗi có thể rỗng, số có thể không hữu hạn).
 * Trả: không (ném khi sai).
 * @throws {Error} câu lỗi NGUYÊN VĂN của bản gốc cho command/description/timeoutMs, rồi tới validateEscalationArgs.
 */
function validatePwshArgs(args: PwshArgs): void {
  if (args.command.trim().length === 0) throw new Error("invalid command: expected a non-empty string");
  if (args.description.trim().length === 0) throw new Error("invalid description: expected a non-empty string");
  if (args.timeoutMs !== void 0 && (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) throw new Error(`invalid timeoutMs: expected a positive number, got ${JSON.stringify(args.timeoutMs)}`);
  validateEscalationArgs(args.sandbox_permissions, args.justification);
}

/**
 * Mô tả hướng model của tool — NGUYÊN VĂN hai chuỗi của bản gốc (bản ngắn khi không có sandbox
 * Windows, bản dài khi có, thêm đoạn ConstrainedLanguage/named pipes).
 * Nhận: windowsSandbox — bố cục có executor sandbox hay không.
 * Trả: chuỗi mô tả NGUYÊN VĂN.
 */
function pwshDescription(windowsSandbox: boolean): string {
  const base = "Execute a PowerShell command (`pwsh -Command`) and return its stdout/stderr. Each call runs in a fresh pwsh process; pass `workdir` instead of using `cd`. Paths use native Windows form (`C:\\...`); read environment variables with `$env:NAME`. Managed `$env:DSH_*` variables expose current harness environment facts. Long output is truncated to its tail; the full output is saved to a file whose path is reported when available. On Windows a force-killed command settles as `[exit code: 1]` without a signal marker — treat it as an interruption, not a command failure. Provide `description` before `command` in the arguments. Before any delete or move, verify that the resolved absolute target path is the intended one; never run it against a computed path you have not checked. Do not assign to automatic variables such as `$HOME`; variable names are case-insensitive, so `$home` is the same read-only variable. Commands may run under a file sandbox; a blocked file operation is reported as `[sandbox: file access denied under <mode> mode]`, a policy denial: do not retry another way.";
  if (!windowsSandbox) return base;
  return "Execute a PowerShell command (`pwsh -Command`) and return its stdout/stderr. Each call runs in a fresh pwsh process; pass `workdir` instead of using `cd`. Paths use native Windows form (`C:\\...`); read environment variables with `$env:NAME`. Managed `$env:DSH_*` variables expose current harness environment facts. Long output is truncated to its tail; the full output is saved to a file whose path is reported when available. On Windows a force-killed command settles as `[exit code: 1]` without a signal marker — treat it as an interruption, not a command failure. Provide `description` before `command` in the arguments. Before any delete or move, verify that the resolved absolute target path is the intended one; never run it against a computed path you have not checked. Do not assign to automatic variables such as `$HOME`; variable names are case-insensitive, so `$home` is the same read-only variable. Commands may run under a file sandbox; a blocked file operation is reported as `[sandbox: file access denied under <mode> mode]`, a policy denial: do not retry another way. Under the Windows sandbox, read-only pwsh runs in PowerShell ConstrainedLanguage mode, while workspace-write stays in FullLanguage unless host policy says otherwise. In read-only, prefer cmdlets and core types (`[string]`, `[datetime]`, `[regex]`, `[guid]`); .NET static calls (`[System.IO.*]::`, `[math]::`), `Add-Type`, COM objects, and reflection fail with \"only core types\" errors. `-f` formatting, property access, and core cmdlets work. In both confined modes, programs cannot open named pipes, so a command that captures another program's output through piped stdio (Node.js `child_process.spawn`/`exec` with the default `stdio: 'pipe'`) fails with EPERM, while `stdio: 'inherit'` and `stdio: 'ignore'` spawns work and PowerShell's own pipelines are unaffected. That EPERM is the documented boundary: do not retry the command another way — escalate the exact command once or restructure it to avoid capturing output.";
}

/**
 * Phân giải thư mục làm việc ghi đè tương đối theo thư mục hiện tại của phiên.
 * Nhận: modelWorkdir — thư mục model xin; sessionCwd — thư mục hiện tại của phiên (undefined khi không có agent).
 * Trả: đường dẫn sẽ dùng (có thể undefined khi cả hai đều vắng).
 */
function resolveWorkdir(modelWorkdir: string | undefined, sessionCwd: string | undefined): string | undefined {
  if (modelWorkdir === void 0) return sessionCwd;
  if (sessionCwd !== void 0 && !isAbsolute(modelWorkdir)) return resolve(sessionCwd, modelWorkdir);
  return modelWorkdir;
}

/**
 * Tách DTO của executor khỏi kiểu Service Definition chỉ-đọc thành dữ liệu JSON thuần — NGUYÊN VĂN
 * `canonicalPwshResult` của bản gốc.
 * Nhận: result — kết quả một lần chạy của executor; cwd — thư mục làm việc của lần chạy.
 * Trả: giá trị canonical của lời gọi tiền cảnh (chỉ gồm trường có mặt như bản gốc).
 */
function canonicalPwshResult(result: ShellRunResult, cwd: string): PwshForegroundResult {
  const output = (stream: CollectedOutput) => ({
    text: stream.text,
    truncated: stream.truncated,
    ...stream.spillPath !== void 0 ? { spillPath: stream.spillPath } : {}
  });
  return {
    cwd,
    kind: "foreground",
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    aborted: result.aborted,
    timeoutMs: result.timeoutMs,
    stdout: output(result.stdout),
    stderr: output(result.stderr),
    ...result.sandbox !== void 0 ? { sandbox: {
      mode: result.sandbox.mode,
      denied: result.sandbox.denied,
      ...result.sandbox.enforcement !== void 0 ? { enforcement: result.sandbox.enforcement } : {},
      ...result.sandbox.runnerFailed !== void 0 ? { runnerFailed: result.sandbox.runnerFailed } : {}
    } } : {}
  };
}

/**
 * Lỗi huỷ có cấu trúc mà các đường tiền cảnh ném khi bên gọi huỷ lời gọi — NGUYÊN VĂN `toolAborted`.
 * Nhận: không.
 * Trả: HarnessError mã TOOL_ABORTED mang tên "AbortError".
 */
function toolAborted(): HarnessError {
  const error = new HarnessError("tool call aborted", TOOL_ABORTED);
  error.name = "AbortError";
  return error;
}

/** Thuộc tính handle nền canonical dùng chung cho hợp đầu ra của pwsh — NGUYÊN VĂN bản gốc. */
const BACKGROUND_OUTPUT_PROPERTIES = {
  kind: {
    type: "string",
    required: true,
    const: "background"
  },
  jobId: {
    type: "string",
    required: true
  },
  cwd: {
    type: "string",
    required: true
  }
} as const;

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
 * Cài plugin lên context cordis — NGUYÊN VĂN `apply` của bundle gốc, đúng thứ tự đăng ký và mọi
 * nhánh lỗi. Với registry, mọi lời gọi đăng ký tiến trình thành job ngay từ đầu; không có registry
 * thì tool chỉ chạy tiền cảnh và hạn chót của executor giết lệnh.
 * Nhận: ctx — context cordis mang năm service bắt buộc (và tuỳ chọn jobs/sandboxPolicy/approval); config — cấu hình đã qua schema (mặc định `{}`).
 * Trả: không (đăng ký tool + mục prompt hệ thống lên context).
 * @throws {Error} khi executor giam lệnh mà thiếu ctx.sandboxPolicy (câu lỗi NGUYÊN VĂN bản gốc).
 */
export function apply(ctx: PwshContext, config: Config = {}): void {
  const backgroundEnabled = config.enableRunInBackground ?? true;
  const promoteOnTimeout = (config.promoteOnTimeout ?? true) && backgroundEnabled;
  const defaultMode = ctx.shell.sandboxMode;
  const escalationModes: readonly string[] = defaultMode === void 0 ? [] : ESCALATION_TARGETS;
  const sandboxPolicy = defaultMode === void 0 ? void 0 : ctx.get("sandboxPolicy") as SandboxPolicyService | undefined;
  if (defaultMode !== void 0 && sandboxPolicy === void 0) throw new Error("tool-pwsh: the mounted bash executor confines but ctx.sandboxPolicy is missing");

  /**
   * Phân giải chính sách đứng đầy đủ cho lời gọi này khi có executor giam lệnh.
   * Nhận: exec — ngữ cảnh lời gọi (agent quyết định phiên đi cùng chính sách).
   * Trả: policy đã phân giải, hoặc undefined khi bố cục không giam.
   */
  const resolveSandboxPolicy = (exec: ToolExec): SandboxExecutionPolicy | undefined => sandboxPolicy?.resolve(exec.agent === void 0 ? {} : { session: exec.agent.session });

  /**
   * Phân giải yêu cầu escalate sandbox qua `ctx.approval` TRƯỚC khi bất cứ thứ gì chạy, giao chuỗi
   * fail-closed dùng chung (nới chặt, phân giải kênh, ánh xạ kết cục) cho `approveEscalation`. Tool này
   * chỉ đóng góp chốt bố cục và nguyên liệu approval.
   * Nhận: mode — chế độ xin; justification — một câu giải thích của model; exec — ngữ cảnh lời gọi; standingPolicy — chính sách đứng của lời gọi.
   * Trả: chế độ đã được duyệt cho đúng lời gọi này.
   * @throws {Error} khi bố cục không có executor sandbox để escalate (câu lỗi NGUYÊN VĂN bản gốc).
   */
  const approvePwshEscalation = (mode: string, justification: string, exec: ToolExec, standingPolicy: SandboxExecutionPolicy): Promise<SandboxMode> => {
    if (escalationModes.length === 0) throw new Error("sandbox_permissions is not available in this composition (no sandboxing executor to escalate)");
    const effectiveMode = standingPolicy.mode;
    return approveEscalationRequest({
      requestedMode: mode,
      justification,
      effectiveMode,
      subject: "command"
    }, {
      approver: ctx.get("approval"),
      agent: exec.agent,
      callId: exec.callId,
      toolName: "pwsh",
      signal: exec.signal
    });
  };

  ctx.systemPrompt.section({
    name: "tool:pwsh",
    order: ctx.systemPrompt.getSectionOrder("TOOL_PWSH"),
    text: "Non-zero exits are reported as `[exit code: N]` markers; investigate failures before moving on. On Windows a killed process settles as `[exit code: 1]` without a signal marker; treat a bare exit 1 after an interruption as a termination, not a command failure."
  });

  /**
   * Một lần đăng ký tool `pwsh`. Có registry thì mọi lời gọi đăng ký tiến trình thành job ngay từ
   * lúc bắt đầu; không có thì tool chỉ tiền cảnh và hạn chót của executor giết lệnh.
   * Nhận: jobs — sổ job (undefined ⇒ chỉ tiền cảnh).
   * Trả: định nghĩa tool đã đóng gói theo bố cục này.
   */
  const pwshTool = (jobs?: JobRegistry) => {
    const background = jobs !== void 0;
    const promote = background && promoteOnTimeout;

    /**
     * Đăng ký lệnh thành job; tiến trình spawn BÊN TRONG starter, sau khi được nhận.
     * Nhận: registry — sổ job; args — tham số model; exec — ngữ cảnh lời gọi; spec — spec đã phân giải.
     * Trả: handle { id, process(), stopped() } mà đường chờ dùng.
     */
    const startJob = (registry: JobRegistry, args: PwshArgs, exec: ToolExec, spec: ShellExecSpec) => {
      let proc: ProcessHandle | undefined;
      let stopped: string | undefined;
      return {
        id: registry.start({
          kind: "pwsh",
          label: args.command,
          toolCall: {
            callId: exec.callId,
            rootCallId: exec.rootCallId
          },
          ...exec.agent ? { owner: exec.agent.id } : {},
          output: processSources(() => proc),
          run: () => {
            const hooks = processJob(async (signal) => {
              proc = await ctx.shell.execute({
                ...spec,
                signal
              });
              return proc;
            }, (started) => processOutcome(started, escalationModes));
            return {
              done: hooks.done,
              cancel: (reason: string) => {
                stopped = reason;
                hooks.cancel(reason);
              }
            };
          }
        }),
        process: () => proc,
        stopped: () => stopped
      };
    };

    /**
     * Chờ một lệnh tiền cảnh đã đăng ký cho tới khi chốt hoặc hết hạn chót.
     * Nhận: registry — sổ job; attached — handle vừa đăng ký; exec — ngữ cảnh lời gọi; spec — spec đã phân giải.
     * Trả: giá trị canonical (tiền cảnh / đã chuyển nền) của lời gọi.
     */
    const waitOnJob = async (registry: JobRegistry, attached: ReturnType<typeof startJob>, exec: ToolExec, spec: ShellExecSpec): Promise<PwshOutput> => {
      const owner = exec.agent?.id;
      const timeoutMs = spec.timeoutMs;

      /**
       * Dừng job theo tài khoản của CHÍNH lời gọi này và ở lại tới khi nó chốt, để lần chốt là
       * `awaited` và không có thông báo hoàn tất nào theo sau kết quả lời gọi đã mang; bản ghi sau đó
       * rời đi cùng lời gọi, vì model chưa từng thấy id.
       * Nhận: reason — lý do dừng.
       * Trả: hình chiếu job sau khi chờ.
       */
      const stop = async (reason: string) => {
        registry.kill(attached.id, owner, reason);
        const settled = await registry.wait(attached.id, timeoutMs, owner);
        if (settled.status !== "running" && settled.status !== "stopping") registry.remove(attached.id, owner);
        return settled;
      };
      let view;
      try {
        view = await registry.wait(attached.id, timeoutMs, owner, exec.signal);
      } catch {
        await stop("tool call aborted");
        throw toolAborted();
      }
      if ((view.status === "running" || view.status === "stopping") && attached.process() === void 0) {
        await stop("timed out during preparation");
        return {
          kind: "foreground",
          cwd: spec.workdir,
          exitCode: null,
          signal: null,
          timedOut: true,
          aborted: false,
          timeoutMs,
          stdout: {
            text: "",
            truncated: false
          },
          stderr: {
            text: "",
            truncated: false
          },
          ...spec.sandboxPolicy !== void 0 ? { sandbox: {
            mode: spec.sandboxPolicy.mode,
            denied: false
          } } : {}
        };
      }
      if (view.status === "running" || view.status === "stopping") {
        const read = registry.read(attached.id, owner);
        return {
          kind: "promoted",
          cwd: spec.workdir,
          jobId: attached.id,
          timeoutMs,
          output: renderPwshJobRead(ringDelta(read.chunks), read.lossy, read.job.output.spillPaths ?? [], attached.process()?.sandbox, escalationModes)
        };
      }
      registry.remove(attached.id, owner);
      const process = attached.process();
      if (process === void 0) throw new Error(view.detail);
      const result = await process.result();
      const stopped = attached.stopped();
      return {
        ...canonicalPwshResult(result, spec.workdir),
        ...stopped !== void 0 ? { stopped } : {}
      };
    };

    return defineTool({
      name: "pwsh",
      description: pwshDescription(escalationModes.length > 0),
      parameters: {
        description: {
          type: "string",
          required: true,
          description: "Clear, concise description of what this command does in active voice, 5-10 words (shown in the UI). Examples: \"ls\" → \"List files in current directory\"; \"git status\" → \"Show working tree status\"; \"Get-Process\" → \"List running processes\"."
        },
        command: {
          type: "string",
          required: true,
          description: "The PowerShell command to execute."
        },
        timeoutMs: {
          type: "number",
          description: promote ? "Timeout in milliseconds. The executor applies its configured default and cap; on expiry the command moves to the background as a job instead of being killed." : "Timeout in milliseconds. The executor applies its configured default and cap, and kills the command on expiry."
        },
        workdir: {
          type: "string",
          description: "Working directory for this command. Defaults to the session workspace; a relative path is resolved against it."
        },
        ...background ? { run_in_background: {
          type: "boolean",
          description: "Run in the background and return a job id immediately (collect with job_output, stop with job_kill). No timeout applies."
        } } : {},
        ...escalationModes.length > 0 ? {
          sandbox_permissions: {
            type: "string",
            enum: [...escalationModes],
            description: sandboxPermissionsDescription("command")
          },
          justification: {
            type: "string",
            description: "Required with sandbox_permissions: one sentence for the user explaining why this exact command needs the wider access. Use the language of the user’s current request."
          }
        } : {}
      },
      output: {
        schema: { oneOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: BACKGROUND_OUTPUT_PROPERTIES
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                required: true,
                const: "promoted"
              },
              cwd: {
                type: "string",
                required: true
              },
              jobId: {
                type: "string",
                required: true
              },
              timeoutMs: {
                type: "number",
                required: true
              },
              output: {
                type: "string",
                required: true
              }
            }
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                required: true,
                const: "foreground"
              },
              cwd: {
                type: "string",
                required: true
              },
              exitCode: {
                required: true,
                oneOf: [{ type: "integer" }, { type: "null" }]
              },
              signal: {
                required: true,
                oneOf: [{ type: "string" }, { type: "null" }]
              },
              timedOut: {
                type: "boolean",
                required: true
              },
              aborted: {
                type: "boolean",
                required: true
              },
              stopped: { type: "string" },
              timeoutMs: {
                type: "number",
                required: true
              },
              stdout: {
                type: "object",
                additionalProperties: false,
                required: true,
                properties: {
                  text: {
                    type: "string",
                    required: true
                  },
                  truncated: {
                    type: "boolean",
                    required: true
                  },
                  spillPath: { type: "string" }
                }
              },
              stderr: {
                type: "object",
                additionalProperties: false,
                required: true,
                properties: {
                  text: {
                    type: "string",
                    required: true
                  },
                  truncated: {
                    type: "boolean",
                    required: true
                  },
                  spillPath: { type: "string" }
                }
              },
              sandbox: {
                type: "object",
                additionalProperties: false,
                properties: {
                  mode: {
                    type: "string",
                    required: true
                  },
                  denied: {
                    type: "boolean",
                    required: true
                  },
                  enforcement: { type: "string" },
                  runnerFailed: { type: "boolean" }
                }
              }
            }
          }
        ] },
        render: (_args, value) => {
          const output = value as unknown as PwshOutput;
          return [{
            type: "text",
            text: output.kind === "background" ? `started background job ${output.jobId}` : output.kind === "promoted" ? renderPwshPromoted(output) : renderPwshResult(output, escalationModes)
          }];
        },
        presentationMeta: (_args, value) => ({ cwd: (value as unknown as PwshOutput).cwd })
      },
      async execute(args, exec) {
        validatePwshArgs(args);
        const standingPolicy = resolveSandboxPolicy(exec);
        const approvedMode = args.sandbox_permissions !== void 0 && args.justification !== void 0 ? await approvePwshEscalation(args.sandbox_permissions, args.justification, exec, standingPolicy as SandboxExecutionPolicy) : void 0;
        const policy = approvedMode === void 0 ? standingPolicy : {
          ...standingPolicy as SandboxExecutionPolicy,
          mode: approvedMode
        };
        const cwd = exec.agent === void 0 ? void 0 : await ctx.workingDirectory.ensure(exec.agent as AgentLike, exec.signal);
        const workdir = resolveWorkdir(args.workdir, cwd);
        const request: ShellExecRequest = {
          command: args.command,
          ...workdir !== void 0 ? { workdir } : {},
          ...args.timeoutMs !== void 0 ? { timeoutMs: args.timeoutMs } : {},
          dshEnv: ctx.shellEnv.collect(exec),
          ...policy !== void 0 ? { sandboxPolicy: policy } : {}
        };
        if (args.run_in_background === true) {
          if (!backgroundEnabled) throw new Error("run_in_background is disabled for this deployment (enableRunInBackground: false)");
          if (jobs === void 0) throw new Error("background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs");
          if (exec.signal.aborted) throw toolAborted();
          const spec = ctx.shell.resolve({
            ...request,
            onExpiry: "none"
          });
          return {
            kind: "background",
            jobId: startJob(jobs, args, exec, spec).id,
            cwd: spec.workdir
          } as PwshOutput;
        }
        if (jobs !== void 0 && promote) {
          const spec = ctx.shell.resolve({
            ...request,
            onExpiry: "none"
          });
          let attached: ReturnType<typeof startJob> | undefined;
          try {
            attached = startJob(jobs, args, exec, spec);
          } catch (error) {
            ctx.logger.warn(`pwsh: job registration refused, running in the foreground with the timeout kill instead: ${String(error)}`);
          }
          if (attached !== void 0) return await waitOnJob(jobs, attached, exec, spec);
        }
        const spec = ctx.shell.resolve({
          ...request,
          signal: exec.signal
        });
        const result = await (await ctx.shell.execute(spec)).result();
        if (result.aborted) throw toolAborted();
        return canonicalPwshResult(result, spec.workdir);
      },
      presentCall: (args) => {
        if (args.run_in_background === true) return {
          card: "generic",
          title: args.command,
          kind: "execute",
          rawInput: args.command,
          content: [{
            type: "text",
            text: args.description
          }]
        };
        return {
          card: "terminal",
          title: args.command,
          description: args.description,
          ...args.workdir !== void 0 ? { cwd: args.workdir } : {}
        };
      },
      presentResult: (args, result) => {
        const block = result.content.length === 1 ? result.content[0] : void 0;
        if (block === void 0 || block.type !== "text") return void 0;
        const raw = block.text;
        const isBackground = typeof args === "object" && args !== null && args.run_in_background === true;
        const isPromoted = (result as unknown as { value?: { kind?: string } }).value?.kind === "promoted";
        if (isBackground || isPromoted || result.isError) return {
          card: "generic",
          content: [{
            type: "text",
            text: `\`\`\`console\n${raw.replace(/\n+$/, "")}\n\`\`\``
          }]
        };
        const { body, ...exit } = parseExitStatus(raw);
        return {
          card: "terminal",
          output: body,
          ...exit
        };
      }
    });
  };
  // PHASE B: sổ tool lấy qua SEAM CẤU TRÚC; thiếu seam là lỗi cấu hình ⇒ nổ NGAY trước lượt đăng ký ĐẦU
  // (đặt SAU phép kiểm ctx.sandboxPolicy để giữ NGUYÊN thứ tự lỗi của bản gốc).
  const tools = ctx.get("tools") as ToolsLike | undefined;
  if (tools === undefined) throw new Error("tool-pwsh requires the tools seam (ctx.get(\"tools\"))");
  if (!backgroundEnabled) {
    tools.register(pwshTool(void 0));
    return;
  }
  let foregroundOnly = ctx.get("jobs") === void 0 ? tools.register(pwshTool(void 0)) : void 0;
  ctx.inject(["jobs"], (jobCtx) => {
    foregroundOnly?.();
    foregroundOnly = void 0;
    const unregister = tools.register(pwshTool(jobCtx.jobs));
    jobCtx.effect(() => () => {
      unregister();
      if (ctx.fiber.state === 2) foregroundOnly = tools.register(pwshTool(void 0));
    });
  });
}

/**
 * Gọi `approveEscalation` của kernel qua seam CẤU TRÚC (ADR 000d): nguyên liệu approval của tool
 * (`ctx.get("approval")`) là service do kernel sở hữu nên chỉ cần đúng hình dạng chạm tới.
 * Nhận: request — yêu cầu escalate (chế độ xin, lý do, chế độ hiệu lực, chủ thể); approval — nguyên liệu duyệt (approver, agent, callId, toolName, signal).
 * Trả: chế độ đã được duyệt cho đúng lời gọi này.
 * @throws {Error} mọi nhánh fail-closed NGUYÊN VĂN của approveEscalation trong kernel.
 */
function approveEscalationRequest(
  request: { requestedMode: string; justification: string; effectiveMode: string; subject: string },
  approval: { approver: unknown; agent: AgentLike | undefined; callId: string; toolName: string; signal: AbortSignal },
): Promise<SandboxMode> {
  return (approveEscalation as unknown as (
    innerRequest: typeof request,
    innerApproval: typeof approval,
  ) => Promise<SandboxMode>)(request, approval);
}