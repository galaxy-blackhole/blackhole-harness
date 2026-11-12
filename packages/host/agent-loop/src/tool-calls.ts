/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lập lịch thi hành lời gọi công cụ của MỘT bước trợ lý: gọi độc quyền thành hàng rào, gọi
 *      song song dùng bể cuộn có chặn trên, phân loại lại trước khi khởi chạy; ghi kết quả và ngữ
 *      cảnh kết quả theo thứ tự model. Port 1:1 vùng `lib/types/tool-calls.js` dòng 474–708 của
 *      `@deepseek-ai/dsh-agent-loop`.
 */

/**
 * Lập lịch thi hành lời gọi công cụ của một bước trợ lý.
 *
 * Lời gọi độc quyền tạo hàng rào; lời gọi song song dùng bể cuộn có chặn trên và được phân loại
 * lại trước khi khởi chạy. Việc phát có thể chồng lấn, nhưng chính sách, kết quả và ngữ cảnh kết
 * quả vẫn theo thứ tự model. Huỷ bỏ hoặc lỗi bộ lập lịch nội bộ sẽ dừng nạp thêm và rút cạn các
 * lời gọi đã khởi chạy.
 *
 * Huỷ bỏ ghi kết quả lỗi tổng hợp cho các lời gọi bị bỏ qua để replay vẫn hợp lệ. Lỗi bộ lập lịch
 * dạng kết thúc sẽ ném lại sau khi rút cạn; bước sở hữu ghi kết quả phục hồi thận trọng trước khi
 * đóng.
 *
 * @module @galaxy-blackhole/gbh-host-agent-loop/tool-calls
 */

import type { Agent } from "@deepseek-ai/dsh-agent";
import { createToolResultMessage } from "@deepseek-ai/dsh-llm";
import type { ToolCallBlock } from "@deepseek-ai/dsh-llm";
import type { Session, SessionSeq, UserMessage } from "@deepseek-ai/dsh-session";
import { TOOL_ABORTED_BEFORE_DISPATCH, TOOL_RUNTIME_SCHEDULER } from "@deepseek-ai/dsh-tools";
import type {
  ToolExecutionInput,
  ToolExecutionMode,
  ToolExecutionResult,
  ToolRunContext,
  ToolRuntimeScheduler,
} from "@deepseek-ai/dsh-tools";
import { assertNever } from "@deepseek-ai/dsh-util-values";

/**
 * Lấy bộ điều phối runtime của service `tools`.
 * Nhận: tools — service `tools` đang sống.
 * Trả: bộ điều phối, hoặc undefined khi service không có.
 *
 * Vì sao có hàm này (22/10/2026): nếu trong cùng tiến trình tồn tại HAI bản của gói `dsh-tools`
 * (bản trong profile và bản trong bản cài), mỗi bản giữ một `Symbol()` KHÁC nhau, nên tra theo
 * hằng số import về sẽ ra undefined dù service có đủ bộ điều phối. Ta tra thêm theo MÔ TẢ của
 * symbol để không vỡ, giữ nguyên hành vi của bản gốc.
 */
function schedulerOf(tools: { readonly [TOOL_RUNTIME_SCHEDULER]?: ToolRuntimeScheduler }): ToolRuntimeScheduler | undefined {
  const truc = tools[TOOL_RUNTIME_SCHEDULER];
  if (truc !== undefined) return truc;
  for (const ky of Object.getOwnPropertySymbols(tools)) {
    if (ky.description === "@deepseek-ai/dsh-tools.scheduler") {
      return (tools as unknown as Record<symbol, ToolRuntimeScheduler>)[ky];
    }
  }
  return undefined;
}


/**
 * Hình dạng TỐI THIỂU của context vòng lặp mà tầng này đọc, khai theo CẤU TRÚC.
 *
 * Bản gốc đọc `ctx.agents`, `ctx.tools` và `ctx.agentLoop` nhờ augment module
 * `@deepseek-ai/cordis`; bản viết lại KHÔNG augment module (ADR 000d), nên seam này khai đúng ba
 * thành viên được dùng. Một `Context` thật của cordis thoả seam này khi đã có ba dịch vụ dưới
 * đây; chỗ nối chỉ cần ép kiểu `ctx as unknown as ToolCallLoopContext`, đúng thói quen của các
 * gói host khác trong repo.
 *
 * Nhận: một context (hoặc seam tương đương) có `agents` cấp Agent khởi xướng, `tools` có chế độ
 * thi hành và bộ lập lịch nội bộ, và `agentLoop` có chặn song song đã cấu hình.
 * Trả: (kiểu) không trả gì — dùng làm kiểu tham số của {@link executeToolCalls} và {@link runGroup}.
 */
export interface ToolCallLoopContext {
  /** Sổ đăng ký Agent: cấp Agent khởi xướng của lượt đang chạy. */
  readonly agents: {
    /**
     * Agent khởi xướng của lượt đang chạy.
     * Trả: Agent sở hữu Session mà các sự kiện `tool/call`/`tool/result` được ghi vào.
     */
    requireInitiator(): Agent;
  };
  /** Sổ đăng ký công cụ cùng bộ lập lịch nội bộ của nó. */
  readonly tools: {
    /**
     * Chế độ đồng thời sống của MỘT lời gọi, được hỏi lại ngay trước khi khởi chạy.
     * Nhận: `exec` — đầu vào thi hành đã phân tích tham số.
     * Trả: chế độ thi hành hiện hành (`parallel` hoặc `exclusive`).
     */
    executionMode(exec: ToolExecutionInput): ToolExecutionMode;
    /** Lát cắt bộ lập lịch giữ thứ tự tiền/hậu chính sách khi các lần phát chồng lấn. */
    readonly [TOOL_RUNTIME_SCHEDULER]: ToolRuntimeScheduler;
  };
  /** Dịch vụ launcher của vòng lặp, nơi giữ cấu hình đã kiểm. */
  readonly agentLoop: {
    /** Cấu hình đã kiểm của dịch vụ vòng lặp. */
    readonly config: {
      /**
       * Chặn trên số lời gọi song song an toàn đang bay trong một bước.
       * Trả: số nguyên dương đã cấu hình (`1` nghĩa là tuần tự).
       */
      readonly maxParallelToolCalls: { get(): number };
    };
  };
}

/** Một lời gọi đã dựng sẵn đầu vào thi hành, giữ nguyên thứ tự model. */
interface PlannedToolCall {
  /** Khối lời gọi của model, dùng để ghi `tool/call` và `tool/result`. */
  readonly block: ToolCallBlock;
  /** Đầu vào thi hành đã phân tích tham số, kèm Agent khởi xướng và signal của bước. */
  readonly exec: ToolExecutionInput;
}

/** Một lời gọi đã kết thúc, chờ được ghi theo thứ tự model. */
interface SettledToolSlot {
  /** Lần thi hành đã chuẩn hoá mà bộ lập lịch trả lại. */
  readonly exec: ToolRunContext;
  /** Kết quả thô trước (hoặc sau) bước hậu xử lý. */
  readonly result: ToolExecutionResult;
  /** `true` khi kết quả còn phải qua `finalize` (post-execute) trước khi ghi. */
  readonly needsPost: boolean;
}

/** Kết quả của MỘT lượt chạy nhóm: số lời gọi đã tiêu thụ, cờ huỷ, cờ kết thúc lượt. */
interface ToolCallGroupOutcome {
  /** Số lời gọi mà lượt này đã tiêu thụ (đã khởi chạy, hoặc toàn nhóm khi bị huỷ). */
  readonly consumed: number;
  /** `true` khi nhóm dừng vì signal đã huỷ; mọi lời gọi chưa khởi chạy đã có kết quả tổng hợp. */
  readonly aborted: boolean;
  /** `true` khi một kết quả đã ghi đánh dấu kết thúc lượt. */
  readonly concluded: boolean;
}

/**
 * Lập lịch thi hành mọi lời gọi công cụ của MỘT bước trợ lý theo chế độ đồng thời sống của chúng.
 *
 * Hoàn tất thường và huỷ bỏ đều ghi kết quả của các lời gọi đã khởi chạy theo đúng thứ tự model.
 * Huỷ bỏ rút cạn chúng, ghi kết quả tổng hợp cho các lời gọi chưa khởi chạy, rồi trả về trong khi
 * signal vẫn ở trạng thái đã huỷ — sau khi đã nhận ngữ cảnh của các lời gọi đã khởi chạy qua
 * `acceptContext` do bên gọi cấp (máy trạng thái xếp nó vào hộp thư bước kế tiếp ở ranh giới
 * bước). Lỗi bộ lập lịch nội bộ dừng mọi lần phát mới, rút cạn các lần phát đã bắt đầu và ném lại
 * lỗi đầu tiên; bước sở hữu cấp kết quả lỗi cho những yêu cầu chưa có kết cục được ghi.
 *
 * Nhận: `ctx` — context vòng lặp sở hữu sổ công cụ và mang Agent khởi xướng; `turn` — số lượt
 * hiện tại; `step` — số bước hiện tại; `toolCalls` — các lời gọi của trợ lý theo thứ tự model;
 * `signal` — signal huỷ dùng chung của bước; `acceptContext` — nhận ngữ cảnh kết quả đã ghi cho
 * ranh giới bước kế tiếp.
 * Trả: Promise của `{ concluded }` — `true` khi một kết quả đã ghi đánh dấu kết thúc lượt.
 * @throws Lỗi bộ lập lịch đầu tiên, ném lại NGUYÊN VĂN sau khi rút cạn các lời gọi đã khởi chạy.
 */
export async function executeToolCalls(
  ctx: ToolCallLoopContext,
  turn: number,
  step: number,
  toolCalls: ToolCallBlock[],
  signal: AbortSignal,
  acceptContext: (context: UserMessage) => void,
): Promise<{ concluded: boolean }> {
  const agent = ctx.agents.requireInitiator();
  const { session } = agent;
  const planned: PlannedToolCall[] = toolCalls.map((block) => ({
    block,
    exec: {
      callId: block.id,
      name: block.name,
      arguments: parseArguments(block.arguments),
      agent,
      signal,
    },
  }));
  let next = 0;
  let concluded = false;
  while (next < planned.length) {
    // Điều kiện vòng lặp bảo đảm `next` nằm trong mảng; khẳng định để qua `noUncheckedIndexedAccess`.
    const first = planned[next]!;
    const mode = ctx.tools.executionMode(first.exec).kind;
    const outcome = await runGroup(
      ctx,
      turn,
      step,
      mode === "parallel" ? planned.slice(next) : [first],
      mode,
      signal,
      acceptContext,
    );
    next += outcome.consumed;
    concluded ||= outcome.concluded;
    if (outcome.aborted) {
      for (const call of planned.slice(next)) appendSkippedToolCall(session, turn, step, call.block);
      return { concluded };
    }
  }
  return { concluded };
}

/**
 * Phân tích tham số do model sinh: JSON hỏng được giữ NGUYÊN VĂN dưới dạng chuỗi, đầu vào rỗng
 * được ánh xạ thành `{}`.
 *
 * Nhận: `raw` — chuỗi tham số thô đúng như model sinh ra.
 * Trả: giá trị đã phân tích, hoặc chính chuỗi `raw` khi JSON không hợp lệ.
 */
export function parseArguments(raw: string): unknown {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return raw;
  }
}

/**
 * Chạy MỘT hàng rào độc quyền hoặc MỘT bể song song.
 *
 * Các lời gọi phía sau được phân loại lại trước khi khởi chạy; một lần phân loại lại thành độc
 * quyền sẽ chờ bể hiện tại rút cạn và ở lại cho hàng rào kế tiếp của bên gọi. Kết quả và ngữ cảnh
 * được ghi theo thứ tự model. Huỷ bỏ dừng khởi chạy, rút cạn và ghi các lời gọi đã khởi chạy, nhận
 * ngữ cảnh của chúng vào lô sở hữu, ghi kết quả cho các lời gọi bị bỏ qua và trả về kết cục đã
 * huỷ. Lỗi bộ lập lịch rút cạn các lần phát rồi ném lại để bước sở hữu ghi kết quả phục hồi.
 *
 * Nhận: `ctx` — context vòng lặp mang Agent khởi xướng và sổ công cụ; `turn` — số lượt hiện tại;
 * `step` — số bước hiện tại; `group` — các lời gọi của lượt này theo thứ tự model; `mode` — chế
 * độ đồng thời đã quyết cho phần tử đầu; `signal` — signal huỷ dùng chung của bước;
 * `acceptContext` — nhận ngữ cảnh kết quả đã ghi cho ranh giới bước kế tiếp.
 * Trả: Promise của kết cục nhóm: số lời gọi đã tiêu thụ, cờ đã huỷ, cờ kết thúc lượt.
 * @throws Lỗi bộ lập lịch nội bộ đầu tiên sau khi đã rút cạn mọi lần phát đang bay.
 * @throws Error("tool-call scheduler: uncommitted settled calls") khi nhóm không bị huỷ mà vẫn còn
 *   lời gọi đã khởi chạy chưa được ghi — nguyên văn chuỗi của bản gốc.
 */
export async function runGroup(
  ctx: ToolCallLoopContext,
  turn: number,
  step: number,
  group: readonly PlannedToolCall[],
  mode: ToolExecutionMode["kind"],
  signal: AbortSignal,
  acceptContext: (context: UserMessage) => void,
): Promise<ToolCallGroupOutcome> {
  const { session } = ctx.agents.requireInitiator();
  const maxParallelToolCalls = ctx.agentLoop.config.maxParallelToolCalls.get();
  // Hai mảng giữ chỗ đúng độ dài nhóm; phần tử chỉ được ghi khi lời gọi tương ứng khởi chạy.
  const slots: (SettledToolSlot | undefined)[] = group.map(() => void 0);
  const callSeqs: (SessionSeq | undefined)[] = group.map(() => void 0);
  let nextToStart = 0;
  let committed = 0;
  let started = 0;
  let aborted = signal.aborted;
  let concluded = false;
  let schedulerFailure: { error: unknown } | undefined;
  const throwSchedulerFailure = (): void => {
    if (schedulerFailure !== void 0) throw schedulerFailure.error;
  };
  const commitReady = async (): Promise<void> => {
    while (committed < group.length) {
      const slot = slots[committed];
      if (slot === void 0) break;
      // Có slot nghĩa là lời gọi đã khởi chạy, nên khối và seq của nó chắc chắn đã được ghi.
      const call = group[committed]!;
      // Bộ điều phối phải có; thiếu là lỗi cấu hình (xem schedulerOf) — báo rõ thay vì để undefined chảy tiếp.
      const scheduler = schedulerOf(ctx.tools);
      if (scheduler === undefined) throw new Error("agent-loop: service tools thieu bo dieu phoi runtime");
      const result = slot.needsPost
        ? await scheduler.finalize(slot.exec, slot.result)
        : scheduler.finish(slot.exec, slot.result);
      appendToolResult(session, turn, step, call.block, result, callSeqs[committed]!);
      for (const context of result.additionalContexts ?? []) acceptContext(context);
      concluded ||= result.concludesTurn === true;
      committed++;
    }
  };
  const inFlight = new Map<number, Promise<number>>();
  const startCall = async (index: number): Promise<void> => {
    const call = group[index]!;
    callSeqs[index] = appendToolCall(session, turn, step, call.block);
    started++;
    const scheduler = schedulerOf(ctx.tools);
    if (scheduler === undefined) throw new Error("agent-loop: service tools thieu bo dieu phoi runtime");
    const prepared = await scheduler.prepare(call.exec);
    throwSchedulerFailure();
    switch (prepared.kind) {
      case "dispatch": {
        const promise = scheduler.dispatch(prepared.exec).then(
          (outcome) => {
            slots[index] = {
              exec: prepared.exec,
              result: outcome.result,
              needsPost: outcome.kind === "post-result",
            };
            return index;
          },
          (error: unknown) => {
            schedulerFailure ??= { error };
            return index;
          },
        );
        inFlight.set(index, promise);
        break;
      }
      case "post-result":
        slots[index] = {
          exec: prepared.exec,
          result: prepared.result,
          needsPost: true,
        };
        break;
      case "final-result":
        slots[index] = {
          exec: prepared.exec,
          result: prepared.result,
          needsPost: false,
        };
        break;
      /* v8 ignore next -- closed-union exhaustiveness guard */
      default:
        assertNever(prepared, "tool-call scheduler prepare result");
    }
  };
  const fillPool = async (): Promise<void> => {
    while (!aborted && nextToStart < group.length && inFlight.size < maxParallelToolCalls) {
      const nextCall = group[nextToStart]!;
      // Chỉ phần tử ĐẦU của nhóm được quyết chế độ; phần tử sau bị phân loại lại và có thể chặn bể.
      if (nextToStart > 0 && mode === "parallel" && ctx.tools.executionMode(nextCall.exec).kind !== "parallel") break;
      await startCall(nextToStart);
      nextToStart++;
      throwSchedulerFailure();
      await commitReady();
      throwSchedulerFailure();
      if (signal.aborted) aborted = true;
    }
  };
  try {
    await fillPool();
    while (inFlight.size > 0) {
      const settledIndex = await Promise.race(inFlight.values());
      inFlight.delete(settledIndex);
      throwSchedulerFailure();
      await commitReady();
      throwSchedulerFailure();
      if (signal.aborted) aborted = true;
      await fillPool();
    }
  } catch (error) {
    schedulerFailure ??= { error };
    await Promise.allSettled(inFlight.values());
    throw schedulerFailure.error;
  }
  if (aborted) {
    for (const call of group.slice(started)) appendSkippedToolCall(session, turn, step, call.block);
    return {
      consumed: group.length,
      aborted: true,
      concluded,
    };
  }
  /* v8 ignore next -- unreachable: a non-aborted group commits every started call */
  if (committed !== started) throw new Error("tool-call scheduler: uncommitted settled calls");
  return {
    consumed: started,
    aborted: false,
    concluded,
  };
}

/**
 * Ghi cặp bền `tool/call` + `tool/result` cho MỘT lời gọi của model bị bỏ qua sau khi huỷ.
 *
 * Nhận: `session` — Session sở hữu lượt; `turn` — số lượt hiện tại; `step` — số bước hiện tại;
 * `block` — khối lời gọi bị bỏ qua.
 * Trả: không.
 * @throws Lỗi của `Session.append` (ví dụ dữ liệu sự kiện không tuần tự hoá được thành JSON).
 */
export function appendSkippedToolCall(session: Session, turn: number, step: number, block: ToolCallBlock): void {
  const callSeq = appendToolCall(session, turn, step, block);
  appendToolResult(session, turn, step, block, {
    content: [{
      type: "text",
      text: "Error: tool call aborted before dispatch",
    }],
    isError: true,
    error: {
      message: "tool call aborted before dispatch",
      info: {
        name: "AbortError",
        code: TOOL_ABORTED_BEFORE_DISPATCH,
      },
    },
  }, callSeq);
}

/**
 * Ghi `tool/call` cho MỘT lời gọi đã khởi chạy.
 *
 * Nhận: `session` — Session sở hữu lượt; `turn` — số lượt hiện tại; `step` — số bước hiện tại;
 * `block` — khối lời gọi của model (giữ nguyên chuỗi tham số thô).
 * Trả: seq của sự kiện `tool/call` — seq mà kết quả của lời gọi PHẢI dẫn nguồn.
 * @throws Lỗi của `Session.append` (ví dụ dữ liệu sự kiện không tuần tự hoá được thành JSON).
 */
export function appendToolCall(session: Session, turn: number, step: number, block: ToolCallBlock): SessionSeq {
  return session.append("tool/call", {
    turn,
    step,
    callId: block.id,
    name: block.name,
    arguments: block.arguments,
  }).seq;
}

/**
 * Ghi `tool/result` theo thứ tự model, nối sự kiện kết quả với sự kiện lời gọi đã dẫn nguồn.
 *
 * Nhận: `session` — Session sở hữu lượt; `turn` — số lượt hiện tại; `step` — số bước hiện tại;
 * `block` — khối lời gọi của model; `result` — kết quả đã chuẩn hoá của lần thi hành;
 * `callSeq` — seq của `tool/call` tương ứng.
 * Trả: không.
 * @throws Lỗi của `Session.append` (ví dụ `meta` không phải JSON tuần tự hoá được).
 */
export function appendToolResult(
  session: Session,
  turn: number,
  step: number,
  block: ToolCallBlock,
  result: ToolExecutionResult,
  callSeq: SessionSeq,
): void {
  const message = createToolResultMessage({
    callId: block.id,
    content: result.content,
    isError: result.isError,
  });
  session.append("tool/result", {
    turn,
    step,
    message,
    ...result.error?.info ? { error: result.error.info } : {},
    ...result.meta !== void 0 ? { meta: result.meta } : {},
  }, {
    surfaceOp: "append",
    sourceEventSeqs: [callSeq],
  });
}
