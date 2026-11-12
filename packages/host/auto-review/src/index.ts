/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Plugin của row auto-review: cài preset Auto + cổng duyệt TỪNG lời gọi tool ngay trước thân
 *      của nó. Bản viết lại của Galaxy Blackhole cho @deepseek-ai/dsh-experimental-auto-review;
 *      nguồn đối chiếu G4 nằm trong README.md của package.
 */

import { classifyRisk } from "./classify.ts";
import { AUTO_PRESET, DANGER_FULL_ACCESS, PLUGIN_NAME, RUN_CODE_NAME } from "./constants.ts";
import { askUser, denied, failed } from "./outcome.ts";
import type { AutoReviewContext, NextDecision, PendingExecution, PreToolDecision, ReviewDecision } from "./types.ts";

/** Tên plugin cordis mà tầng nạp dùng cho chẩn đoán — nguyên văn bản gốc. */
export const name = PLUGIN_NAME;

/** Sáu service host bắt buộc phải có trước khi preset Auto được công bố — nguyên văn bản gốc. */
export const inject: string[] = ["approval", "llm", "permissionPresets", "sessions", "tools", "workingDirectory"];

/**
 * Đọc trạng thái huỷ SỐNG qua các điểm await, không dựa vào hẹp kiểu đã cũ.
 * Nhận: `signal` — tín hiệu cần đọc.
 * Trả: `true` khi tín hiệu đã bị huỷ TẠI THỜI ĐIỂM GỌI.
 */
function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

/**
 * Cài preset Auto và cổng duyệt từng lời gọi, đặt TRƯỚC mọi listener khác của waterfall.
 * Nhận: `ctx` — context cordis sở hữu sáu seam và hai hàm vòng đời.
 * Trả: không; đăng ký một hiệu ứng vòng đời gồm listener, preset Auto, và hàm dọn.
 */
export function apply(ctx: AutoReviewContext): void {
  const permissionPresets = ctx.permissionPresets;
  let accepting = true;
  const active = new Set<Promise<void>>();
  const lifecycle = new AbortController();
  ctx.effect(function* () {
    yield ctx.on(
      "tools/pre-execute",
      async (exec: PendingExecution, next: NextDecision): Promise<PreToolDecision> => {
        const agent = exec.agent;
        // Lời gọi không có agent, và `run_code` NGOÀI CÙNG, không đi qua bộ duyệt.
        if (agent === undefined || (exec.parent === undefined && exec.name === RUN_CODE_NAME)) return next();
        if (permissionPresets.current(agent.session) !== AUTO_PRESET) return next();
        if (!accepting || lifecycle.signal.aborted) return { kind: "cancel" };
        const completed = Promise.withResolvers<void>();
        active.add(completed.promise);
        try {
          const review = await classifyRisk(
            ctx,
            agent,
            exec,
            AbortSignal.any([exec.signal, lifecycle.signal]),
          ).then(
            (decision: ReviewDecision) => ({ ok: true as const, decision }),
            (error: unknown) => ({ ok: false as const, error }),
          );
          if (isAborted(lifecycle.signal)) return { kind: "cancel" };
          if (!review.ok) return failed(exec, review.error);
          const { decision } = review;
          // Dưới `never` lời từ chối là CHUNG THẨM; dưới `ask` nó thành câu hỏi cho người.
          if (decision.decision === "deny" && ctx.approval.overrideOf(agent.session) === "never") {
            return denied(exec, decision.reason);
          }
          const downstream = await next();
          if (isAborted(lifecycle.signal)) return { kind: "cancel" };
          if (decision.decision === "allow" || downstream.kind !== "allow") return downstream;
          return askUser(exec, decision.reason);
        } finally {
          active.delete(completed.promise);
          completed.resolve();
        }
      },
      { prepend: true },
    );
    yield permissionPresets.registerAuto(() => {
      if (!accepting) throw new Error("auto-review: integration is closing");
    });
    // Hàm dọn: đóng cổng chọn + cổng duyệt, chuyển phiên Auto đang sống về Full access,
    // rồi huỷ và vắt kiệt các lượt duyệt đang chạy TRƯỚC khi rút listener.
    yield async () => {
      accepting = false;
      try {
        for (const session of ctx.sessions.list()) {
          if (permissionPresets.current(session) !== AUTO_PRESET) continue;
          permissionPresets.set(session, DANGER_FULL_ACCESS);
        }
      } finally {
        lifecycle.abort(new Error("auto-review integration disposed"));
        await Promise.allSettled([...active]);
      }
    };
  }, "auto-review lifecycle");
}
