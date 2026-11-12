/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Plugin tool-jobs hướng mô hình trên ctx.jobs — port 1:1 lib/types/index.js của @deepseek-ai/dsh-tool-jobs: giữ NGUYÊN VĂN tên, inject, Config, thứ tự kiểm cấu hình, mục systemPrompt, đăng ký controller, phân phối hoàn tất và ba công cụ; seam cordis khai theo CẤU TRÚC (ADR 000d).
 */

import type { Config } from "./config.ts";
import type { AgentLike, AgentRegistryLike, InboxClaimedPayload, ToolJobsContext } from "./types.ts";
import type { ToolExecution } from "@galaxy-blackhole/gbh-host-tools";
import { createUserMessage } from "./messages.ts";
import { completionSummary, fitCompletionNotice } from "./render.ts";
import { createFinalizeJobContent, registerJobTools, visibleOutputLimit } from "./tools.ts";

export { Config } from "./config.ts";
export type { CompletionDelivery } from "./config.ts";

/** Tên plugin cordis — NGUYÊN VĂN bản gốc. Nhận: không. Trả: chuỗi "tool-jobs". */
export const name = "tool-jobs";

/** Service bắt buộc — NGUYÊN VĂN bản gốc (sổ công cụ, sổ jobs, sổ system prompt). Nhận: không. Trả: mảng tên service theo đúng thứ tự. */
export const inject: string[] = ["tools", "jobs", "systemPrompt"];

/** Văn bản mục systemPrompt — NGUYÊN VĂN từng ký tự của bản gốc. */
const SYSTEM_PROMPT_TEXT =
  "Track every background job id you start. You are notified in-session when a job finishes — do not busy-poll or sleep on one; keep working on independent steps and do not duplicate a running job's work. Before giving a final answer, collect every still-relevant job with job_output (set wait: true only when you are genuinely blocked on it), and job_kill jobs that stopped mattering.";

/** Nhãn controller gắn vào sổ jobs — NGUYÊN VĂN bản gốc. */
const CONTROLLER_NAME = "tool-jobs";

/** Tên mục system prompt — NGUYÊN VĂN bản gốc. */
const SECTION_NAME = "tool:jobs";

/** Tên vị trí thứ tự mục system prompt — NGUYÊN VĂN bản gốc. */
const SECTION_ORDER_NAME = "TOOL_JOBS";

/** Giá trị mặc định của waitTimeoutMs khi cấu hình vắng — NGUYÊN VĂN bản gốc. */
const DEFAULT_WAIT_TIMEOUT_MS = 30000;

/** Giá trị mặc định của maxWaitTimeoutMs khi cấu hình vắng — NGUYÊN VĂN bản gốc. */
const DEFAULT_MAX_WAIT_TIMEOUT_MS = 600000;

/** Giá trị mặc định của completionDelivery khi cấu hình vắng — NGUYÊN VĂN bản gốc. */
const DEFAULT_COMPLETION_DELIVERY = "wakeup";

/**
 * Tra sổ agent qua ctx.get("agents") — đúng một lần gọi như bản gốc.
 * Nhận: ctx — context plugin.
 * Trả: sổ agent, hoặc undefined khi không có service.
 */
function agentsOf(ctx: ToolJobsContext): AgentRegistryLike | undefined {
  return ctx.get("agents") as AgentRegistryLike | undefined;
}

/**
 * Cài plugin lên context: kiểm cấu hình, gắn controller, đăng ký mục prompt, phân phối hoàn tất và ba công cụ.
 * Nhận: ctx — context cordis (khai theo CẤU TRÚC); config — cấu hình đã qua Config (hoặc thô).
 * Trả: không.
 * @throws {Error} khi waitTimeoutMs > maxWaitTimeoutMs, khi maxConsecutiveWakes không phải số nguyên an toàn, hoặc khi service bắt buộc vắng mặt.
 */
export function apply(ctx: ToolJobsContext, config: Config): void {
  const waitDefault = config.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const waitCap = config.maxWaitTimeoutMs ?? DEFAULT_MAX_WAIT_TIMEOUT_MS;
  const delivery = config.completionDelivery ?? DEFAULT_COMPLETION_DELIVERY;
  const wakeBudget = config.maxConsecutiveWakes;
  const spentWakes = new WeakMap<AgentLike, number>();
  if (waitDefault > waitCap) {
    throw new Error("tool-jobs: waitTimeoutMs (" + waitDefault + ") exceeds maxWaitTimeoutMs (" + waitCap + ")");
  }
  if (wakeBudget !== undefined && !Number.isSafeInteger(wakeBudget)) {
    throw new Error("tool-jobs: maxConsecutiveWakes (" + wakeBudget + ") must be a whole number of turns");
  }
  if (delivery === "wakeup" && wakeBudget !== undefined) {
    ctx.on("agent/inbox/claimed", (payload: InboxClaimedPayload) => {
      if (payload.message.source.kind === "user") spentWakes.delete(payload.agent);
    });
  }
  const outputLimits = new WeakMap<ToolExecution, number>();
  ctx.on(
    "tools/pre-execute",
    (exec, next) => {
      const maxBytes = visibleOutputLimit(ctx, exec);
      if (maxBytes !== undefined) outputLimits.set(exec, maxBytes);
      return next();
    },
    { prepend: true },
  );
  const finalizeJobContent = createFinalizeJobContent(ctx, outputLimits);
  ctx.jobs.attachController(CONTROLLER_NAME);
  ctx.systemPrompt.section({
    name: SECTION_NAME,
    order: ctx.systemPrompt.getSectionOrder(SECTION_ORDER_NAME),
    text: SYSTEM_PROMPT_TEXT,
  });
  const killedByModel = new Set<string>();
  ctx.jobs.events.subscribe({ owners: "scope" }, (event) => {
    if (event.type === "removed") {
      killedByModel.delete(event.job.id);
      return;
    }
    if (event.type !== "settled") return;
    if (killedByModel.delete(event.job.id) || event.awaited || event.cause === "teardown" || event.job.owner === undefined) return;
    const owner = agentsOf(ctx)?.get(event.job.owner);
    if (owner === undefined) return;
    const message = createUserMessage({
      content: [
        {
          type: "text",
          text: fitCompletionNotice(event.job),
        },
      ],
      source: {
        kind: "tool-jobs",
        form: "notice",
        summary: completionSummary(event.job),
      },
    });
    if (delivery === "wakeup" && owner.status === "idle") {
      if (wakeBudget === undefined) {
        owner.followup(message);
        return;
      }
      const spent = spentWakes.get(owner) ?? 0;
      if (spent < wakeBudget) {
        spentWakes.set(owner, spent + 1);
        owner.followup(message);
        return;
      }
    }
    owner.inject(message);
  });
  registerJobTools(ctx, { waitDefault, waitCap, finalizeJobContent, killedByModel });
}
