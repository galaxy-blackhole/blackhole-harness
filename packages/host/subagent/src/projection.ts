/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Phép chiếu THUẦN của phiên cho danh tính subagent (mode/label) và thời lượng lượt đang mở; viết lại theo hành vi của @deepseek-ai/dsh-subagent (projection).
 */

import { z } from "zod/v4";

import { SessionSeq, type SessionEvent } from "@galaxy-blackhole/gbh-session";

import { foldSubagentDescriptor, type SubagentDescriptorData } from "./descriptor.ts";
import type { SubagentIdentityProjection, SubagentTimingProjection } from "./projection-types.ts";

/** Khoảng lượt đang mở: mốc bắt đầu và mốc sự kiện cuối đã gộp vào phép cắt (nguyên văn bản gốc). */
const activeIntervalSchema = z.object({
  since: z.number().int().nonnegative(),
  through: z.number().int().nonnegative(),
}).strict();

/** Khung nhìn dây của thời lượng: phần đã lắng, lượt đang mở, cờ hoàn tất lượt cuối (nguyên văn bản gốc). */
const projectionSchema = z.object({
  settledMs: z.number().int().nonnegative(),
  active: activeIntervalSchema.optional(),
  lastTurnCompleted: z.boolean().optional(),
}).strict().transform(({ settledMs, active, lastTurnCompleted }) => ({
  settledMs,
  ...active === undefined ? {} : { active },
  ...lastTurnCompleted === undefined ? {} : { lastTurnCompleted },
}));

/** Trạng thái phép gộp thời lượng đã lưu: kiểm TRƯỚC khi nó mồi phép gộp (nguyên văn bản gốc). */
const timingStateSchema = z.object({
  settledMs: z.number().int().nonnegative(),
  active: activeIntervalSchema.optional(),
  pendingTurnStart: z.number().int().nonnegative().optional(),
  descriptorSeen: z.boolean(),
  lastTurnCompleted: z.boolean().optional(),
}).strict();

/** Trạng thái phép gộp cho ảnh chụp thời lượng mới nhất của MỘT subagent. */
export interface TimingState {
  /** Số mili giây đã tích sau các lượt HOÀN TẤT nằm sau mốc descriptor. */
  settledMs: number;
  /** Khoảng đang mở, giữ cặp mốc ngay trong phép gộp. */
  active?: {
    since: number;
    through: number;
  } | undefined;
  /** Mốc bắt đầu lượt gần nhất TRƯỚC descriptor, được thăng cấp khi descriptor CỦA con tới. */
  pendingTurnStart?: number | undefined;
  /** Phép gộp đã đi qua một descriptor trong log logic này chưa. */
  descriptorSeen: boolean;
  /** Lượt đã đóng gần nhất sau descriptor có hoàn tất bình thường không; vắng khi lượt đang mở hoặc trước lượt đóng đầu. */
  lastTurnCompleted?: boolean | undefined;
}

/**
 * Sự kiện `subagent/descriptor` đúng phần thân mà phép gộp đọc, khai theo CẤU TRÚC: bản gốc
 * augment `SessionEventMap` của kernel từ `descriptor.ts`, còn tệp này KHÔNG augment module nào —
 * hình dạng dưới đây ghép được với `SessionEvent` ngay khi bảng sự kiện của kernel có khoá đó.
 */
interface SubagentDescriptorEvent {
  /** Nhãn sự kiện (nguyên văn). */
  readonly type: "subagent/descriptor";
  /** Thứ tự sự kiện trong log phiên con. */
  readonly seq: SessionSeq;
  /** Mốc thời gian Unix (ms) của sự kiện. */
  readonly time: number;
  /** Thân descriptor đã kiểm của gói này. */
  readonly data: SubagentDescriptorData;
}

/** Một sự kiện mà hai phép gộp của tệp này đọc: log Session đã cam kết, cộng mốc descriptor của gói. */
type SubagentFoldEvent = SessionEvent | SubagentDescriptorEvent;

/** Đơn vị chiếu `subagentTiming` khai theo CẤU TRÚC: đúng hình dạng sổ chiếu phiên của kernel gọi tới. */
interface SubagentTimingProjectionDefinition {
  /** Khoá chiếu do đơn vị này sở hữu (nguyên văn). */
  readonly key: "subagentTiming";
  /** Kiểm trạng thái đã lưu TRƯỚC khi mồi phép gộp. */
  readonly stateSchema: z.ZodType<TimingState>;
  /** Trạng thái cho log rỗng. */
  readonly init: () => TimingState;
  /** Phép chuyển THUẦN: trạng thái trước + một sự kiện đã cam kết ⇒ trạng thái sau. */
  readonly apply: (state: TimingState, event: SubagentFoldEvent) => TimingState;
  /** Khung nhìn dây phát cho Client. */
  readonly wire: {
    /** Kiểm khung nhìn trước khi rời host. */
    readonly viewSchema: z.ZodType<SubagentTimingProjection>;
    /** Chiếu trạng thái đã gộp thành khung nhìn dây. */
    readonly view: (state: TimingState) => SubagentTimingProjection;
  };
  /** Phiên bản làm mới kho checkpoint: tăng khi trường trạng thái hoặc luật lái đổi. */
  readonly stateVersion: number;
}

/**
 * Gộp ranh giới lượt quanh descriptor BỀN CỦA CHÍNH con.
 *
 * Một hạt giống fork có thể mang descriptor của tổ tiên và các lượt đã đóng. Mọi descriptor vì thế
 * ĐẶT LẠI trạng thái đã tích; catalog lành chỉ nhận con có ĐÚNG MỘT descriptor trong đuôi log của
 * chính nó, nên lần đặt lại cuối cùng là mốc thời lượng có thẩm quyền của con.
 */
export const subagentTimingProjectionDefinition = {
  key: "subagentTiming",
  stateSchema: timingStateSchema,
  init: () => ({ descriptorSeen: false, settledMs: 0 }),
  apply: (state, event) => {
    if (event.type === "turn/start") {
      const { lastTurnCompleted: _closed, ...openState } = state;
      return state.descriptorSeen
        ? { ...openState, active: { since: event.time, through: event.time } }
        : { ...openState, pendingTurnStart: event.time };
    }
    if (event.type === "subagent/descriptor") {
      const activeSince = state.active?.since ?? state.pendingTurnStart;
      return {
        descriptorSeen: true,
        settledMs: 0,
        ...(activeSince === undefined
          ? {}
          : { active: { since: activeSince, through: event.time } }),
      };
    }
    if (event.type === "turn/end") {
      if (!state.descriptorSeen) {
        if (state.pendingTurnStart === undefined)
          return state;
        const { pendingTurnStart: _closed, ...next } = state;
        return next;
      }
      if (state.active === undefined)
        return state;
      const { active, ...rest } = state;
      return {
        ...rest,
        settledMs: state.settledMs + Math.max(0, event.time - active.since),
        lastTurnCompleted: event.data.reason.kind === "completed",
      };
    }
    if (state.active === undefined)
      return state;
    return { ...state, active: { ...state.active, through: event.time } };
  },
  wire: {
    viewSchema: projectionSchema,
    view: state => ({
      settledMs: state.settledMs,
      ...(state.active === undefined ? {} : { active: state.active }),
      ...(state.lastTurnCompleted === undefined ? {} : { lastTurnCompleted: state.lastTurnCompleted }),
    }),
  },
  stateVersion: 3,
} satisfies SubagentTimingProjectionDefinition;

// Phép ép ở bản gốc chỉ bắc cầu nhánh nhãn TUỲ CHỌN: đầu ra của zod.optional có kèm `undefined`
// tường minh, thứ mà exactOptionalPropertyTypes loại khỏi giao diện công khai. Trạng thái KHÔNG có
// giá trị của chính nó là nhánh `null` tuần tự hoá được — KHÔNG BAO GIỜ là `undefined` — nên mọi
// lượt đọc sổ và mọi khung đẩy đều sống sót qua JSON.stringify không mất mát.
const identityValueSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("one-shot"),
    label: z.string().optional(),
    seq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).transform(SessionSeq),
  }).strict(),
  z.object({
    mode: z.literal("continuable"),
    label: z.string(),
    seq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).transform(SessionSeq),
  }).strict(),
]);

/** Khung nhìn dây của danh tính: giá trị đã kiểm, hoặc `null` nghĩa là KHÔNG có descriptor hợp lệ. */
const identitySchema = identityValueSchema.nullable();

/** Trạng thái phép gộp danh tính đã lưu: kiểm TRƯỚC khi nó mồi phép gộp (nguyên văn bản gốc). */
const identityStateSchema = z.object({
  identity: identityValueSchema.optional(),
}).strict();

/** Trạng thái phép gộp danh tính: danh tính từ descriptor HỢP LỆ cuối. */
interface IdentityState {
  /** Danh tính đã gộp của con; vắng trước descriptor đầu và sau một descriptor hỏng. */
  identity?: SubagentIdentityProjection | undefined;
}

/**
 * Diễn giải danh tính của MỘT sự kiện `subagent/descriptor`; không có giá trị khi thân sự kiện
 * không đáng tin.
 * Nhận: `event` — sự kiện descriptor đã hẹp kiểu.
 * Trả: danh tính (mode, nhãn tuỳ chọn, seq) hoặc `undefined` khi descriptor không đọc được.
 */
function descriptorIdentity(event: SubagentDescriptorEvent): SubagentIdentityProjection | undefined {
  let descriptor: SubagentDescriptorData | undefined;
  try {
    descriptor = foldSubagentDescriptor([event]);
  }
  catch {
    // Chỉ thân phiên bản HIỆN HÀNH sai hình dạng mới ném khi phân tích descriptor;
    // một phép gộp chiếu KHÔNG BAO GIỜ được ném, nên hỏng thì gộp thành không có giá trị.
    descriptor = undefined;
  }
  if (descriptor === undefined)
    return undefined;
  return descriptor.mode === "one-shot"
    ? {
      mode: "one-shot",
      ...descriptor.label !== undefined ? { label: descriptor.label } : {},
      seq: event.seq,
    }
    : { mode: "continuable", label: descriptor.label, seq: event.seq };
}

/** Đơn vị chiếu `subagent` khai theo CẤU TRÚC: đúng hình dạng sổ chiếu phiên của kernel gọi tới. */
interface SubagentIdentityProjectionDefinition {
  /** Khoá chiếu do đơn vị này sở hữu (nguyên văn). */
  readonly key: "subagent";
  /** Kiểm trạng thái đã lưu TRƯỚC khi mồi phép gộp. */
  readonly stateSchema: z.ZodType<IdentityState>;
  /** Trạng thái cho log rỗng. */
  readonly init: () => IdentityState;
  /** Phép chuyển THUẦN: trạng thái trước + một sự kiện đã cam kết ⇒ trạng thái sau. */
  readonly apply: (state: IdentityState, event: SubagentFoldEvent) => IdentityState;
  /** Khung nhìn dây phát cho Client. */
  readonly wire: {
    /** Kiểm khung nhìn trước khi rời host. */
    readonly viewSchema: z.ZodType<SubagentIdentityProjection | null>;
    /** Chiếu trạng thái đã gộp thành khung nhìn dây. */
    readonly view: (state: IdentityState) => SubagentIdentityProjection | null;
  };
  /** Phiên bản làm mới kho checkpoint: tăng khi trường trạng thái hoặc luật lái đổi. */
  readonly stateVersion: number;
}

/**
 * Gộp danh tính mode/label BỀN từ các sự kiện `subagent/descriptor`, thắng-cuối: một hạt giống fork
 * có thể phát lại descriptor của tổ tiên, và descriptor CỦA CHÍNH con phải đè lên nó — cùng kỷ luật
 * đặt-lại như {@link subagentTimingProjectionDefinition}. Một thân hỏng hoặc phiên bản lạ ĐẶT LẠI về
 * chốt `null` thay vì ném, nên một fork của tổ tiên lành KHÔNG BAO GIỜ thừa hưởng danh tính mà
 * descriptor của chính nó đã không thiết lập được — và lần đặt lại đó sống sót mọi khung đẩy JSON,
 * nên bên nhận đang giữ danh tính cũ THAY nó thay vì giữ lại danh tính đã cũ; `null` ⟺ không có
 * descriptor hợp lệ, với các nguyên nhân cố ý không phân biệt.
 */
export const subagentIdentityProjectionDefinition = {
  key: "subagent",
  stateSchema: identityStateSchema,
  init: () => ({}),
  apply: (state, event) => {
    if (event.type !== "subagent/descriptor")
      return state;
    const identity = descriptorIdentity(event);
    return identity === undefined ? {} : { identity };
  },
  wire: { viewSchema: identitySchema, view: state => state.identity ?? null },
  // Tăng khi danh tính nhận trường `seq`: một dòng checkpoint CŨ sẽ phát lại thành giá trị mà
  // schema từ chối, nên nó phải được gộp lại thay vì dùng.
  stateVersion: 2,
} satisfies SubagentIdentityProjectionDefinition;
