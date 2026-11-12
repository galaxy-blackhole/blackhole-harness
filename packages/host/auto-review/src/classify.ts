/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Một lượt phân loại: đóng băng ảnh chụp, dựng yêu cầu LLM bằng chính sách cố định + tuyến hiện
 *      tại, rồi đọc kết luận. Nguyên văn gói gốc (lib/index.js dòng 397–415).
 */

import type { GenerateOptions } from "@deepseek-ai/dsh-llm";
import { deepFreeze } from "./freeze.ts";
import { REVIEW_POLICY } from "./policy.ts";
import { readDecision } from "./decision.ts";
import { reviewUserText, snapshotAutoReview } from "./snapshot.ts";
import type { AutoReviewAgent, AutoReviewContext, PendingExecution, ReviewDecision } from "./types.ts";

/**
 * Duyệt MỘT hành động đã đóng băng bằng chính sách cố định và tuyến LLM hiện tại.
 * Nhận: `ctx` — context có hai seam `workingDirectory`/`llm`; `agent` — agent gọi;
 * `exec` — lời gọi đang chờ; `signal` — tín hiệu huỷ đã hợp nhất của lượt.
 * Trả: kết luận của bộ duyệt; ném khi ảnh chụp hỏng hoặc dòng chunk không hợp lệ.
 */
export async function classifyRisk(
  ctx: AutoReviewContext,
  agent: AutoReviewAgent,
  exec: PendingExecution,
  signal: AbortSignal,
): Promise<ReviewDecision> {
  const snapshot = snapshotAutoReview(agent, exec, await ctx.workingDirectory.ensure(agent, signal));
  const options = deepFreeze<GenerateOptions>({
    provider: snapshot.provider,
    model: snapshot.model,
    system: REVIEW_POLICY,
    messages: [{ role: "user", content: [{ type: "text", text: reviewUserText(snapshot) }] }],
    temperature: 0,
    signal,
  });
  return readDecision(ctx.llm.stream(options));
}
