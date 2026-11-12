/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Đơn vị chiếu `sessionStats`: phép gộp THUẦN các mốc bước, dòng gói nhúng, cặp công cụ và tin
 *      trợ lý đã lắp thành số đếm toàn log + bốn loại thời gian tường. Bản viết lại của Galaxy
 *      Blackhole cho row session-stats — nguồn đối chiếu: xem README.md của gói (G4).
 */

import { z as zod } from "zod/v4";
import { assistantStreamFirstTokenTime } from "@deepseek-ai/dsh-llm";
import type {
  AssistantAttemptData,
  AssistantMessageData,
  ProjectionDefinition,
  SessionEvent,
  SessionStatsProjection,
  SessionStatsState,
  StepBoundaryData,
  ToolCallData,
  ToolResultData,
} from "./types.ts";

/**
 * Schema khung nhìn dây: tám tổng, đúng tám trường, kiểm TĂNG NGHIÊM NGẶT (`.strict()`) — một khoá
 * thừa là dữ liệu hỏng, không phải thống kê.
 */
const sessionStatsSchema = zod
  .object({
    turns: zod.number().int().nonnegative(),
    steps: zod.number().int().nonnegative(),
    llmMs: zod.number().nonnegative(),
    toolMs: zod.number().nonnegative(),
    ttftMs: zod.number().nonnegative(),
    ttftSteps: zod.number().int().nonnegative(),
    decodeMs: zod.number().nonnegative(),
    decodeTokens: zod.number().nonnegative(),
  })
  .strict();

/**
 * Schema trạng thái đã lưu (tổng + ranh giới đang bay), kiểm trên dòng cache sau cổng `ver` — biên
 * ĐẦU VÀO của đơn vị. Khung nhìn là tập con thật sự của trạng thái nên schema này MỞ RỘNG
 * `sessionStatsSchema` (biên ĐẦU RA trên dây) bằng đúng ba trường ranh giới.
 */
const sessionStatsStateSchema = sessionStatsSchema.extend({
  lastTurn: zod.number().int().nonnegative().nullable(),
  openStep: zod
    .object({
      turn: zod.number().int().nonnegative(),
      step: zod.number().int().nonnegative(),
      startTime: zod.number().nonnegative(),
      firstTokenTime: zod.number().nonnegative().nullable(),
    })
    .nullable(),
  pendingCalls: zod.record(zod.string(), zod.number().nonnegative()),
});

/**
 * Token ra do nhà cung cấp báo, phòng dữ liệu hỏng ĐÚNG cách phép gộp cửa sổ của client phòng
 * `usage` của nút: không phải số hữu hạn không âm thì coi như KHÔNG báo.
 * Nhận: bản ghi `usage` tuỳ chọn của sự kiện `assistant/message`.
 * Trả: số token ra, hoặc `null` khi không báo/không hợp lệ.
 */
function usageOutputTokens(usage: unknown): number | null {
  if (typeof usage !== "object" || usage === null) return null;
  const value = (usage as { outputTokens?: unknown }).outputTokens;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Đơn vị chiếu `sessionStats` đăng ký trên `ctx.sessionProjections` (xuất để test đối chứng). */
export const sessionStatsProjectionDefinition: ProjectionDefinition<SessionStatsState, SessionStatsProjection> = {
  key: "sessionStats",
  stateVersion: 1,
  stateSchema: sessionStatsStateSchema,
  init: () => ({
    turns: 0,
    steps: 0,
    llmMs: 0,
    toolMs: 0,
    ttftMs: 0,
    ttftSteps: 0,
    decodeMs: 0,
    decodeTokens: 0,
    lastTurn: null,
    openStep: null,
    pendingCalls: {},
  }),
  apply: (state: SessionStatsState, event: SessionEvent): SessionStatsState => {
    // Mọi sự kiện không đáng quan tâm trả về CÙNG tham chiếu (cổng Object.is của seam quyết định
    // có đẩy kênh thay đổi đi hay không).
    switch (event.type) {
      case "step/start": {
        const data = event.data as StepBoundaryData;
        return {
          ...state,
          openStep: { turn: data.turn, step: data.step, startTime: event.time, firstTokenTime: null },
        };
      }
      case "assistant/attempt": {
        const data = event.data as AssistantAttemptData;
        const open = state.openStep;
        // Lần gọi đã tất toán mà không lắp tin: chỉ GIỮ mốc token đầu tiên của bước đang mở, nên một
        // `llm/retry` giữa bước không làm mất độ trễ đã đo được.
        if (open === null || open.turn !== data.turn || open.step !== data.step) return state;
        const first = assistantStreamFirstTokenTime(data.stream) ?? null;
        if (open.firstTokenTime !== null || first === null) return state;
        return { ...state, openStep: { ...open, firstTokenTime: first } };
      }
      case "assistant/message": {
        const data = event.data as AssistantMessageData;
        const open = state.openStep;
        if (open === null || open.turn !== data.turn || open.step !== data.step) return state;
        const firstToken = open.firstTokenTime ?? assistantStreamFirstTokenTime(data.stream) ?? null;
        // Mỗi bước chỉ lắp MỘT tin: đóng ranh giới nghĩa là một bản trùng phòng vệ không cộng hai lần.
        const next: SessionStatsState = {
          ...state,
          llmMs: state.llmMs + Math.max(0, event.time - open.startTime),
          openStep: null,
        };
        if (firstToken !== null) {
          next.ttftMs += Math.max(0, firstToken - open.startTime);
          next.ttftSteps += 1;
          const outputTokens = usageOutputTokens(data.usage);
          if (outputTokens !== null) {
            next.decodeMs += Math.max(0, event.time - firstToken);
            next.decodeTokens += outputTokens;
          }
        }
        return next;
      }
      case "tool/call": {
        const data = event.data as ToolCallData;
        return { ...state, pendingCalls: { ...state.pendingCalls, [data.callId]: event.time } };
      }
      case "tool/result": {
        const data = event.data as ToolResultData;
        // callId do nhà cung cấp cấp (biên JSON của mô hình/công cụ), nên phép kiểm PHẢI là "khoá riêng":
        // một cái tên thuộc prototype Object (`constructor`, `toString`) trên kết quả không có lệnh gọi
        // đã ghi phải đọc là KHÔNG khớp, không phải một hàm thừa kế làm `toolMs` thành NaN.
        const callId = data.message.source.callId;
        const dispatched = Object.hasOwn(state.pendingCalls, callId) ? state.pendingCalls[callId] : undefined;
        if (dispatched === undefined) return state;
        const pendingCalls = Object.fromEntries(
          Object.entries(state.pendingCalls).filter(([id]) => id !== callId),
        );
        return { ...state, toolMs: state.toolMs + Math.max(0, event.time - dispatched), pendingCalls };
      }
      case "step/end": {
        const data = event.data as StepBoundaryData;
        return {
          ...state,
          turns: state.lastTurn === data.turn ? state.turns : state.turns + 1,
          steps: state.steps + 1,
          lastTurn: data.turn,
          openStep: null,
        };
      }
      case "turn/end":
        // Lệnh gọi không bao giờ có kết quả thuộc về một lượt bị huỷ hoặc hỏng; kết quả LUÔN rơi trong
        // lượt của nó, nên bỏ phần thừa thay vì để trạng thái đã lưu phình mãi.
        return Object.keys(state.pendingCalls).length === 0 ? state : { ...state, pendingCalls: {} };
      default:
        return state;
    }
  },
  wire: {
    viewSchema: sessionStatsSchema,
    view: (state: SessionStatsState): SessionStatsProjection => ({
      turns: state.turns,
      steps: state.steps,
      llmMs: state.llmMs,
      toolMs: state.toolMs,
      ttftMs: state.ttftMs,
      ttftSteps: state.ttftSteps,
      decodeMs: state.decodeMs,
      decodeTokens: state.decodeTokens,
    }),
  },
};
