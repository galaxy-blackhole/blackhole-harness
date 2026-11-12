/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Đơn vị chiếu `goal` của sổ chiếu phiên: hai schema dây (trạng thái NGHIÊM + khung nhìn Client)
 *      và phép lái KHÔNG NÉM của sổ — sự kiện goal hỏng đầu tiên được giữ trong `failure`, còn Client
 *      vẫn thấy goal hợp lệ gần nhất. Viết lại theo hành vi của lib/types/index.js (bản gốc).
 */

// Nạp qua "zod/v4" (quy ước repo): có một ambient shim `declare module "zod"` ở
// packages/client/ui-sidebar-right/src/externals.d.ts che mất kiểu thật khi tsc đọc CẢ chương trình.
import { z as zod } from "zod/v4";

import { applyGoalEvent } from "./fold.ts";
import type { GoalProjection, GoalProjectionDefinition, GoalProjectionState, GoalFoldState, SessionEventLike } from "./types.ts";

/** Schema dây của phép chiếu `goal` (goal hiện tại, hoặc `null` trước khi tạo / sau khi xoá). */
const goalProjectionSchema = zod.union([
  zod.object({
    goal: zod.object({
      id: zod.string().min(1),
      revision: zod.number().int().positive(),
      objective: zod.string().min(1),
      phase: zod.union([zod.literal("active"), zod.literal("paused"), zod.literal("blocked"), zod.literal("complete")]),
      blockedReason: zod
        .object({
          code: zod.string(),
          message: zod.string(),
        })
        .optional(),
      maxGoalRounds: zod.number().int().positive(),
    }),
    roundsStarted: zod.number().int().nonnegative(),
    createdAt: zod.number(),
    updatedAt: zod.number(),
  }),
  zod.null(),
]);

/** Schema NGHIÊM của trạng thái checkpoint an toàn cho kho (đúng ba trường; bất biến kiểm bằng superRefine). */
const goalProjectionStateSchema = zod
  .object({
    current: goalProjectionSchema,
    seenGoalIds: zod.array(zod.string().min(1)).refine((ids) => new Set(ids).size === ids.length, { message: "seen goal ids must be unique" }),
    failure: zod.string().min(1).nullable(),
  })
  .strict()
  .superRefine((state, context) => {
    if (state.current === null) return;
    if (!state.seenGoalIds.includes(state.current.goal.id))
      context.addIssue({
        code: "custom",
        message: "current goal id must be retained among seen goal ids",
      });
    if (state.current.updatedAt < state.current.createdAt)
      context.addIssue({
        code: "custom",
        message: "current goal update cannot precede its creation",
      });
    if (state.current.roundsStarted > state.current.goal.maxGoalRounds)
      context.addIssue({
        code: "custom",
        message: "current goal rounds cannot exceed its configured limit",
      });
  });

/**
 * Dựng trạng thái gộp NGHIÊM từ một trạng thái phép chiếu an toàn cho checkpoint.
 * Nhận: `state` — trạng thái đã lưu của đơn vị chiếu.
 * Trả: bộ tích luỹ mới (tập id đã thấy được CHÉP, không chia sẻ tham chiếu).
 */
function goalFoldState(state: GoalProjectionState): GoalFoldState {
  return {
    goal: state.current?.goal,
    roundsStarted: state.current?.roundsStarted ?? 0,
    createdAt: state.current?.createdAt,
    updatedAt: state.current?.updatedAt,
    lastRef: undefined,
    seenGoalIds: new Set(state.seenGoalIds),
  };
}

/**
 * Chuyển trạng thái gộp NGHIÊM thành trạng thái phép chiếu an toàn cho checkpoint.
 * Nhận: `state` — bộ tích luỹ đã lái xong.
 * Trả: `{ current, seenGoalIds, failure }` với `current` là `null` khi không có goal.
 */
function goalProjectionState(state: GoalFoldState): GoalProjectionState {
  let current: GoalProjection | null = null;
  if (state.goal !== undefined) {
    const { createdAt, updatedAt } = state;
    if (createdAt === undefined || updatedAt === undefined) throw new Error("current goal fold lacks timestamps");
    current = {
      goal: state.goal,
      roundsStarted: state.roundsStarted,
      createdAt,
      updatedAt,
    };
  }
  return {
    current,
    seenGoalIds: [...state.seenGoalIds],
    failure: null,
  };
}

/**
 * Lái các sự kiện goal bền qua luật phát lại NGHIÊM mà KHÔNG ném khỏi lượt lái của sổ chiếu.
 * Sự kiện goal hỏng đầu tiên được giữ trong `failure`; lượt đọc goal phía host từ chối trạng thái
 * đó trong khi khung nhìn Client vẫn ở goal hợp lệ gần nhất.
 * Nhận: `state` — phép chiếu phủ mọi sự kiện trước; `event` — sự kiện phiên đã cam kết kế tiếp.
 * Trả: phép chiếu kế (CÙNG tham chiếu khi sự kiện không liên quan).
 */
export function applyGoalProjection(state: GoalProjectionState, event: SessionEventLike): GoalProjectionState {
  if (state.failure !== null) return state;
  if (event.type !== "goal/change" && (event.type !== "user/message" || event.data.source.kind !== "goal")) return state;
  const folded = goalFoldState(state);
  try {
    applyGoalEvent(folded, event);
    return goalProjectionState(folded);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...state,
      failure: `goal replay failed at session event ${event.seq}: ${message}`,
    };
  }
}

/** Trạng thái host NGHIÊM đi kèm giá trị Client đã cắt gọn của bản gốc. */
export const goalProjectionDefinition: GoalProjectionDefinition = {
  key: "goal",
  stateSchema: {
    /**
     * Kiểm một trạng thái đã lưu.
     * Nhận: giá trị thô từ kho checkpoint.
     * Trả: trạng thái đã kiểm và đã chuẩn hoá (zod bỏ khoá lạ ở khung nhìn, giữ nguyên ở trạng thái NGHIÊM).
     */
    parse(value: unknown): GoalProjectionState {
      return goalProjectionStateSchema.parse(value) as GoalProjectionState;
    },
  },
  init: () => ({
    current: null,
    seenGoalIds: [],
    failure: null,
  }),
  apply: applyGoalProjection,
  wire: {
    viewSchema: {
      /**
       * Kiểm một khung nhìn trước khi phát cho Client.
       * Nhận: khung nhìn vừa dựng.
       * Trả: khung nhìn đã kiểm (bản SAO do zod dựng).
       */
      parse(value: unknown): GoalProjection | null {
        return goalProjectionSchema.parse(value) as GoalProjection | null;
      },
    },
    view: (state) => state.current,
  },
  stateVersion: 6,
};
