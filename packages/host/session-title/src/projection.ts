/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc HAI đơn vị chiếu của miền tiêu đề: `title` (văn bản tiêu đề mới nhất — chuỗi trần mà hàng
 *      danh sách phiên phía client ăn) và `titleInput` (đầu vào hợp lệ giữ dạng tổng hợp O(1): tin
 *      ĐẦU, số tin, seq tin cuối). Cả hai là phép gộp THUẦN trên log. Bản viết lại của Galaxy
 *      Blackhole cho row session-title — nguồn đối chiếu: README.md (G4).
 */

import { z as zod } from "zod/v4";
import { SessionSeq } from "./brand.ts";
import { sessionTitleUserMessageOf } from "./messages.ts";
import type {
  ProjectionDefinition,
  SessionEvent,
  SessionTitleEventData,
  SessionTitleUserMessage,
  TitleInputState,
} from "./types.ts";

/** Trạng thái "chưa có tiêu đề": `null` — khung nhìn client ăn thẳng giá trị này. */
const NO_TITLE: null = null;

/** Trạng thái "chưa có tin hợp lệ nào" — bản gốc dùng CHUNG một vật thể cho mọi phiên (đo ở test). */
const EMPTY_TITLE_INPUT: TitleInputState = { first: null, count: 0, lastSeq: null };

/** Schema MỘT tin người dùng hợp lệ; `seq` được đóng dấu `SessionSeq` (nguyên văn bản gốc). */
const sessionTitleUserMessageSchema = zod
  .object({
    seq: zod.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).transform(SessionSeq),
    text: zod.string(),
  })
  .strict();

/**
 * Schema trạng thái `titleInput` cộng phép kiểm TĂNG NGHIÊM NGẶT: hoặc RỖNG HOÀN TOÀN (first/lastSeq
 * null, count 0), hoặc ĐẦY ĐỦ (có first + lastSeq, count > 0, first.seq ≤ lastSeq) — trạng thái lửng
 * là dữ liệu hỏng, không phải đầu vào.
 */
const titleInputStateSchema = zod
  .object({
    first: sessionTitleUserMessageSchema.nullable(),
    count: zod.number().int().nonnegative(),
    lastSeq: zod.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).transform(SessionSeq).nullable(),
  })
  .strict()
  .superRefine((state, context) => {
    const empty = state.first === null && state.lastSeq === null && state.count === 0;
    const populated =
      state.first !== null && state.lastSeq !== null && state.count > 0 && state.first.seq <= state.lastSeq;
    if (!empty && !populated) {
      context.addIssue({
        code: "custom",
        message: "title input state must pair its count with first and last message seqs",
      });
    }
  });

/** Schema khung nhìn `title`: chuỗi KHÔNG rỗng hoặc `null`. */
const titleViewSchema = zod.string().min(1).nullable();

/** Đơn vị chiếu `title` đăng ký trên `ctx.sessionProjections` (xuất để test đối chứng). */
export const titleProjectionDefinition: ProjectionDefinition<string | null, string | null> = {
  key: "title",
  stateVersion: 1,
  // Bản gốc dùng CHÍNH một thể hiện schema cho cả trạng thái lẫn khung nhìn (đo được ở test).
  stateSchema: titleViewSchema,
  init: () => NO_TITLE,
  apply: (state: string | null, event: SessionEvent) =>
    event.type === "session/title" ? (event.data as SessionTitleEventData).title : state,
  wire: {
    viewSchema: titleViewSchema,
    view: (state: string | null) => state,
  },
};

/** Đơn vị chiếu `titleInput` đăng ký trên `ctx.sessionProjections` (xuất để test đối chứng). */
export const titleInputProjectionDefinition: ProjectionDefinition<TitleInputState, TitleInputState> = {
  key: "titleInput",
  stateVersion: 3,
  stateSchema: titleInputStateSchema,
  init: () => EMPTY_TITLE_INPUT,
  apply: (state: TitleInputState, event: SessionEvent) => {
    const message: SessionTitleUserMessage | undefined = sessionTitleUserMessageOf(event);
    if (message === undefined) return state;
    return {
      first: state.first ?? message,
      count: state.count + 1,
      lastSeq: message.seq,
    };
  },
};

/**
 * Trạng thái rỗng của `titleInput` — CÙNG một vật thể cho mọi phiên, đúng như bản gốc.
 * Nhận: không.
 * Trả: vật thể rỗng dùng chung (KHÔNG sao chép — xem ca C6 trong test).
 */
export function emptyTitleInput(): TitleInputState {
  return EMPTY_TITLE_INPUT;
}
