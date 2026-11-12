/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Đơn vị chiếu `turnOutline`: phép gộp THUẦN các mốc `turn/start`, prompt người dùng đầu tiên
 *      và phản hồi trợ lý cuối cùng thành dàn bài toàn log mà ray hội thoại render cho những lượt
 *      nằm ngoài cửa sổ sự kiện client đã nạp. Bản viết lại của Galaxy Blackhole cho row
 *      session-turn-outline — nguồn đối chiếu: xem README.md (G4).
 */

import { z as zod } from "zod/v4";
import { SessionSeq } from "./brand.ts";
import { PROMPT_PREVIEW_LIMIT, RESPONSE_PREVIEW_LIMIT, preview } from "./preview.ts";
import type {
  AssistantMessageData,
  ProjectionDefinition,
  SessionEvent,
  TurnOutlineEntry,
  TurnOutlineState,
  TurnStartData,
  UserMessageData,
} from "./types.ts";

/**
 * Schema các mục dàn bài: số lượt / seq / hai bản xem trước có biên, cộng phép kiểm TĂNG NGHIÊM NGẶT
 * theo số lượt (một dàn bài lệch thứ tự là dữ liệu hỏng, không phải dàn bài).
 */
const turnOutlineEntriesSchema = zod
  .array(
    zod
      .object({
        turn: zod.number().int().nonnegative(),
        seq: zod.number().int().nonnegative().transform(SessionSeq),
        prompt: zod.string().max(PROMPT_PREVIEW_LIMIT),
        response: zod.string().max(RESPONSE_PREVIEW_LIMIT),
      })
      .strict(),
  )
  .superRefine((turns, context) => {
    let previous = -1;
    for (const entry of turns) {
      if (entry.turn <= previous) {
        context.addIssue({ code: "custom", message: "turn outline entries must be strictly increasing by turn" });
        return;
      }
      previous = entry.turn;
    }
  });

/** Schema trạng thái đã lưu: các mục + bản nháp phản hồi của lượt đang mở. */
const turnOutlineStateSchema = zod
  .object({
    turns: turnOutlineEntriesSchema,
    draft: zod.string().max(RESPONSE_PREVIEW_LIMIT),
  })
  .strict();

/** Trạng thái "chưa có lượt nào" — bản gốc dùng CHUNG một vật thể cho mọi phiên (xem test). */
const EMPTY_OUTLINE: TurnOutlineState = { turns: [], draft: "" };

/**
 * Gộp MỘT sự kiện đã cam kết vào dàn bài. Mọi sự kiện không đáng quan tâm trả về CÙNG tham chiếu
 * (cổng `Object.is` của seam quyết định có đẩy đi hay không), và nhánh chỉ-đổi-nháp giữ nguyên
 * danh tính mảng `turns` (cổng danh tính của khung nhìn thô giữ kênh thay đổi im).
 * Nhận: trạng thái trước và sự kiện đã cam kết.
 * Trả: trạng thái sau — GIỮ NGUYÊN tham chiếu khi sự kiện không đổi gì.
 */
function foldTurnOutline(state: TurnOutlineState, event: SessionEvent): TurnOutlineState {
  switch (event.type) {
    case "turn/start": {
      const data = event.data as TurnStartData;
      const last = state.turns.at(-1);
      // Cổng thứ tự: mốc không TIẾN số lượt thì giữ dàn bài đã sắp, và bản xem trước của một lượt
      // được thử lại sẽ rơi vào mục đang đứng.
      if (last !== undefined && data.turn <= last.turn) return state;
      return {
        turns: [...state.turns, { turn: data.turn, seq: event.seq, prompt: "", response: "" }],
        draft: "",
      };
    }
    case "user/message": {
      const data = event.data as UserMessageData;
      // Chỉ lượt MỚI NHẤT còn có thể đang chờ prompt người dùng mở đầu; tin người dùng về sau trong
      // cùng lượt (steering) giữ bản xem trước ĐẦU TIÊN.
      if (data.source.kind !== "user") return state;
      const last = state.turns.at(-1);
      if (last === undefined || last.prompt !== "") return state;
      const prompt = preview(data.content, PROMPT_PREVIEW_LIMIT);
      if (prompt === "") return state;
      return { turns: [...state.turns.slice(0, -1), { ...last, prompt }], draft: state.draft };
    }
    case "assistant/message": {
      const data = event.data as AssistantMessageData;
      // Tin MỚI NHẤT có chữ thắng; bộ đệm cam kết ở `turn/end`.
      const draft = preview(data.message.content, RESPONSE_PREVIEW_LIMIT);
      if (draft === "" || draft === state.draft) return state;
      return { turns: state.turns, draft };
    }
    case "turn/end": {
      if (state.draft === "") return state;
      const last = state.turns.at(-1);
      if (last === undefined || last.response === state.draft) return { turns: state.turns, draft: "" };
      return { turns: [...state.turns.slice(0, -1), { ...last, response: state.draft }], draft: "" };
    }
    default:
      return state;
  }
}

/** Đơn vị chiếu `turnOutline` đăng ký trên `ctx.sessionProjections` (xuất để test đối chứng). */
export const turnOutlineProjectionDefinition: ProjectionDefinition<TurnOutlineState, readonly TurnOutlineEntry[]> = {
  key: "turnOutline",
  stateVersion: 2,
  stateSchema: turnOutlineStateSchema,
  init: () => EMPTY_OUTLINE,
  apply: foldTurnOutline,
  wire: {
    viewSchema: turnOutlineEntriesSchema,
    view: (state) => state.turns,
  },
};
