/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Phép gộp THUẦN cho usage bền do nhà cung cấp báo và độ chiếm ngữ cảnh — bản viết lại 1:1
 *      `lib/types/usage-projection.js` (dòng 316–496 của bundle) của `@deepseek-ai/dsh-token-meter`.
 *      Sở hữu hai đơn vị chiếu `tokenUsage` và `contextPressure` trên seam `sessionProjections`.
 */

import { lastAssistantStreamChunk } from "@deepseek-ai/dsh-llm";
import type { TokenUsage } from "@deepseek-ai/dsh-llm";
import { SessionSeq } from "@galaxy-blackhole/gbh-session";
import type { SessionEvent } from "@galaxy-blackhole/gbh-session";
// Nạp augmentation của plugin retry để SessionEventMap có `llm/retry-started` (chỉ kiểu, không import runtime).
import type {} from "@deepseek-ai/dsh-llm-retry/types";

import { foldSurfaceProjection } from "./surface-projection.ts";
import type { ShadowPriceClaim } from "./surface-projection.ts";

/**
 * Usage luỹ kế bền do nhà cung cấp báo cho MỘT log phiên đã hoàn tất.
 * Bốn rổ RỜI NHAU; token suy luận đã nằm trong `outputTokens` nên KHÔNG cộng lại lần nữa.
 */
interface TokenUsageProjection {
  /** Token đầu vào KHÔNG cache. */
  uncachedInputTokens: number;
  /** Token đầu ra, đã gồm token suy luận. */
  outputTokens: number;
  /** Token đầu vào đọc từ cache. */
  cacheReadTokens: number;
  /** Token đầu vào ghi vào cache. */
  cacheWriteTokens: number;
}

/**
 * Độ chiếm ngữ cảnh gần đúng cho hiển thị trạng thái. Các trường, khi có mặt, KHÔNG phải một lần quan sát
 * yêu cầu nguyên tử: mỗi trường là bản ghi THẮNG-SAU-CÙNG của một thời điểm khác nhau, nên đổi model có
 * thể ghép sức chứa mới với áp lực của tuyến trước cho tới khi yêu cầu kế tiếp báo usage.
 */
interface ContextPressureProjection {
  /** Áp lực prompt do nhà cung cấp báo của yêu cầu GẦN NHẤT: input cộng cache đọc/ghi, KHÔNG có output. */
  pressureTokens?: number;
  /** Giá mà prompt của yêu cầu KẾ TIẾP sẽ tốn, khi đã có mẫu usage của nhà cung cấp. */
  projectedTokens?: number;
  /** Sức chứa của tuyến mới nhất đã ghi; vắng khi không adapter nào công bố. */
  contextWindow?: number;
}

/** MỘT mốc usage của lượt/bước đã tất toán gần nhất — khe THAY-THẾ của phép gộp `tokenUsage`. */
interface UsageSlot {
  /** Số lượt của mốc. */
  turn: number;
  /** Số bước trong lượt của mốc. */
  step: number;
  /** Bốn rổ usage của mốc. */
  buckets: TokenUsageProjection;
}

/** Trạng thái đã lưu của đơn vị chiếu `tokenUsage`: tổng luỹ kế + mốc gần nhất (có thể chưa có). */
export interface TokenUsageState {
  /** Tổng usage luỹ kế của toàn log. */
  totals: TokenUsageProjection;
  /** Mốc usage gần nhất đã cộng vào `totals`, hoặc `null` khi chưa có. */
  last: UsageSlot | null;
}

/**
 * Trạng thái đã lưu của đơn vị chiếu `contextPressure`: hai khe THẮNG-SAU-CÙNG độc lập (áp lực của mẫu
 * usage mới nhất và sức chứa của `request/context` mới nhất), cộng tổng bề mặt đang chạy và claim đã nạp.
 */
export interface ContextPressureState {
  /** Sức chứa ngữ cảnh của tuyến mới nhất; vắng khi chưa có `request/context` nào công bố. */
  contextWindow?: number;
  /** Áp lực phía prompt của mẫu usage mới nhất; vắng khi chưa nhà cung cấp nào báo usage. */
  pressureTokens?: number;
  /** Tổng token bề mặt đang chạy (O(1), đi cùng {@link foldSurfaceProjection}). */
  surfaceTokens: number;
  /** Tổng bề mặt tại ĐÚNG lúc mẫu usage mới nhất được đóng dấu; vắng khi chưa có mẫu. */
  sampledSurfaceTokens?: number;
  /** Claim giá bóng do sự kiện đo NGAY TRƯỚC nạp; vắng khi không có. */
  claim?: ShadowPriceClaim;
}

/**
 * Hình dạng schema mà seam `sessionProjections` gọi tới: CHỈ `parse`. Bản gốc dùng zod; gói GBH này
 * KHÔNG khai `zod` (và không được thêm phụ thuộc), nên phần kiểm được viết lại tay với CÙNG luật: số
 * nguyên không âm, seq nguyên không âm ≤ `Number.MAX_SAFE_INTEGER`, object ĐÓNG (từ chối khoá lạ).
 */
interface ProjectionSchema<T> {
  /**
   * Kiểm và chuẩn hoá một giá trị đã lưu.
   * Nhận: giá trị chưa biết (đọc từ kho checkpoint hoặc từ dây).
   * Trả: giá trị đúng kiểu; ném khi không hợp lệ.
   */
  parse(value: unknown): T;
}

/** Khung nhìn dây của đơn vị chiếu: schema của khung nhìn + hàm chiếu từ trạng thái. */
interface ProjectionWire<State, View> {
  /** Schema kiểm khung nhìn trước khi phát đi. */
  readonly viewSchema: ProjectionSchema<View>;
  /**
   * Chiếu trạng thái phép gộp thành khung nhìn dây.
   * Nhận: trạng thái đã gộp.
   * Trả: giá trị sẽ phát cho Client.
   */
  view(state: State): View;
}

/** Hình dạng đơn vị chiếu `tokenUsage` mà seam `sessionProjections` nhận (khai CẤU TRÚC tại chỗ). */
interface TokenUsageProjectionDefinitionShape {
  /** Khoá chiếu; bản gốc dùng `tokenUsage`. */
  readonly key: string;
  /** Phiên bản trạng thái lưu; bản gốc dùng `2`. */
  readonly stateVersion: number;
  /** Schema kiểm trạng thái đã lưu trước khi mồi phép gộp. */
  readonly stateSchema: ProjectionSchema<TokenUsageState>;
  /**
   * Trạng thái cho log rỗng.
   * Nhận: không (seam thật truyền header phiên + số sự kiện thừa kế; bản gốc bỏ qua cả hai).
   * Trả: tổng bằng 0 và chưa có mốc nào.
   */
  init(): TokenUsageState;
  /**
   * Phép gộp THUẦN: trạng thái trước + một sự kiện ⇒ trạng thái sau.
   * Nhận: trạng thái trước và sự kiện đã cam kết.
   * Trả: trạng thái sau — GIỮ NGUYÊN tham chiếu khi sự kiện không đổi gì.
   */
  apply(state: TokenUsageState, event: SessionEvent): TokenUsageState;
  /** Khung nhìn dây của đơn vị chiếu. */
  readonly wire: ProjectionWire<TokenUsageState, TokenUsageProjection>;
}

/** Hình dạng đơn vị chiếu `contextPressure` mà seam `sessionProjections` nhận (khai CẤU TRÚC tại chỗ). */
interface ContextPressureProjectionDefinitionShape {
  /** Khoá chiếu; bản gốc dùng `contextPressure`. */
  readonly key: string;
  /** Phiên bản trạng thái lưu; bản gốc dùng `5`. */
  readonly stateVersion: number;
  /** Schema kiểm trạng thái đã lưu trước khi mồi phép gộp. */
  readonly stateSchema: ProjectionSchema<ContextPressureState>;
  /**
   * Trạng thái cho log rỗng.
   * Nhận: không (seam thật truyền header phiên + số sự kiện thừa kế; bản gốc bỏ qua cả hai).
   * Trả: tổng bề mặt bằng 0, chưa có mẫu usage và chưa có sức chứa.
   */
  init(): ContextPressureState;
  /**
   * Phép gộp THUẦN: trạng thái trước + một sự kiện ⇒ trạng thái sau.
   * Nhận: trạng thái trước và sự kiện đã cam kết.
   * Trả: trạng thái sau; claim đã tiêu thì BỎ khỏi trạng thái.
   */
  apply(state: ContextPressureState, event: SessionEvent): ContextPressureState;
  /** Khung nhìn dây của đơn vị chiếu. */
  readonly wire: ProjectionWire<ContextPressureState, ContextPressureProjection>;
}

/**
 * Báo một giá trị không hợp lệ theo đường dẫn của nó.
 * Nhận: đường dẫn trong trạng thái và mô tả luật bị vi phạm.
 * Trả: không — luôn ném lỗi.
 */
function invalid(path: string, expected: string): never {
  throw new Error(`token meter: ${path} ${expected}`);
}

/**
 * Đọc MỘT số token: số nguyên, KHÔNG âm — đúng chuỗi `z.number().int().nonnegative()` của bản gốc.
 * Nhận: giá trị thô cần kiểm và đường dẫn để báo lỗi.
 * Trả: số token hợp lệ.
 * Ném: khi giá trị không phải số nguyên không âm.
 */
function readTokenCount(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    invalid(path, "must be a non-negative integer");
  }
  return value;
}

/**
 * Đọc MỘT số dương: số nguyên, LỚN HƠN 0 — đúng chuỗi `z.number().int().positive()` của bản gốc.
 * Nhận: giá trị thô cần kiểm và đường dẫn để báo lỗi.
 * Trả: số dương hợp lệ.
 * Ném: khi giá trị không phải số nguyên dương.
 */
function readPositiveInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    invalid(path, "must be a positive integer");
  }
  return value;
}

/**
 * Đọc MỘT seq phiên rồi đóng dấu thương hiệu `SessionSeq` — đúng chuỗi
 * `z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).transform(SessionSeq)` của bản gốc.
 * Nhận: giá trị thô cần kiểm và đường dẫn để báo lỗi.
 * Trả: seq đã đóng dấu `SessionSeq`.
 * Ném: khi giá trị không phải số nguyên không âm, hoặc vượt `Number.MAX_SAFE_INTEGER`.
 */
function readSessionSeq(value: unknown, path: string): SessionSeq {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    invalid(path, "must be a non-negative safe integer");
  }
  return SessionSeq(value);
}

/**
 * Đọc MỘT object thường (KHÔNG đóng): đúng `z.object({...})` không `.strict()` của bản gốc, nơi khoá lạ
 * bị BỎ chứ không bị từ chối.
 * Nhận: giá trị thô và đường dẫn để báo lỗi.
 * Trả: bản ghi đã kiểm (KHÔNG sao chép — nơi gọi tự dựng vật thể mới nên khoá lạ tự rơi).
 * Ném: khi giá trị không phải object thường (mảng cũng bị từ chối).
 */
function readObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(path, "must be an object");
  }
  return value as Record<string, unknown>;
}

/**
 * Đọc MỘT object ĐÓNG: đúng các khoá đã khai, không thừa khoá nào — đúng `.strict()` của bản gốc.
 * Nhận: giá trị thô, danh sách khoá được phép, và đường dẫn để báo lỗi.
 * Trả: bản ghi đã kiểm (KHÔNG sao chép).
 * Ném: khi giá trị không phải object thường, hoặc có khoá nằm ngoài danh sách.
 */
function readStrictObject(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  const record = readObject(value, path);
  for (const key of Object.keys(record)) {
    if (!keys.includes(key)) invalid(path, `has unrecognized key "${key}"`);
  }
  return record;
}

/** Schema BỐN RỔ usage — `projectionSchema` của bản gốc, dùng CHUNG cho tổng và cho từng mốc. */
const projectionSchema: ProjectionSchema<TokenUsageProjection> = {
  parse(value: unknown): TokenUsageProjection {
    const record = readStrictObject(
      value,
      ["uncachedInputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"],
      "tokenUsage.totals",
    );
    return {
      uncachedInputTokens: readTokenCount(record.uncachedInputTokens, "tokenUsage.totals.uncachedInputTokens"),
      outputTokens: readTokenCount(record.outputTokens, "tokenUsage.totals.outputTokens"),
      cacheReadTokens: readTokenCount(record.cacheReadTokens, "tokenUsage.totals.cacheReadTokens"),
      cacheWriteTokens: readTokenCount(record.cacheWriteTokens, "tokenUsage.totals.cacheWriteTokens"),
    };
  },
};

/** Schema MỘT mốc usage: lượt, bước và bốn rổ (object KHÔNG đóng, đúng `.nullable()` của bản gốc). */
const usageSlotSchema: ProjectionSchema<UsageSlot> = {
  parse(value: unknown): UsageSlot {
    const record = readObject(value, "tokenUsage.last");
    return {
      turn: readTokenCount(record.turn, "tokenUsage.last.turn"),
      step: readTokenCount(record.step, "tokenUsage.last.step"),
      buckets: projectionSchema.parse(record.buckets),
    };
  },
};

/** Schema trạng thái `tokenUsage` — biên ĐẦU VÀO của đơn vị chiếu. */
const tokenUsageStateSchema: ProjectionSchema<TokenUsageState> = {
  parse(value: unknown): TokenUsageState {
    const record = readStrictObject(value, ["totals", "last"], "tokenUsage");
    return {
      totals: projectionSchema.parse(record.totals),
      last: record.last === null ? null : usageSlotSchema.parse(record.last),
    };
  },
};

/** Schema khung nhìn `contextPressure` trên dây: ba trường tuỳ chọn, kiểm TĂNG NGHIÊM NGẶT. */
const pressureSchema: ProjectionSchema<ContextPressureProjection> = {
  parse(value: unknown): ContextPressureProjection {
    const record = readStrictObject(
      value,
      ["pressureTokens", "projectedTokens", "contextWindow"],
      "contextPressure",
    );
    const view: ContextPressureProjection = {};
    if (record.pressureTokens !== undefined) {
      view.pressureTokens = readTokenCount(record.pressureTokens, "contextPressure.pressureTokens");
    }
    if (record.projectedTokens !== undefined) {
      view.projectedTokens = readTokenCount(record.projectedTokens, "contextPressure.projectedTokens");
    }
    if (record.contextWindow !== undefined) {
      view.contextWindow = readPositiveInteger(record.contextWindow, "contextPressure.contextWindow");
    }
    return view;
  },
};

/** Schema MỘT claim giá bóng đã nạp (object KHÔNG đóng, đúng `.optional()` của bản gốc). */
const claimSchema: ProjectionSchema<ShadowPriceClaim> = {
  parse(value: unknown): ShadowPriceClaim {
    const record = readObject(value, "contextPressure.claim");
    return {
      start: readSessionSeq(record.start, "contextPressure.claim.start"),
      end: readSessionSeq(record.end, "contextPressure.claim.end"),
      tokens: readTokenCount(record.tokens, "contextPressure.claim.tokens"),
    };
  },
};

/**
 * Schema trạng thái `contextPressure` — biên ĐẦU VÀO của đơn vị chiếu. Kết quả dựng theo ĐÚNG thứ tự
 * khoá của schema gốc (contextWindow · pressureTokens · surfaceTokens · sampledSurfaceTokens · claim),
 * vì zod trả vật thể đã chuẩn hoá theo thứ tự khai báo chứ không theo thứ tự đầu vào.
 */
const contextPressureStateSchema: ProjectionSchema<ContextPressureState> = {
  parse(value: unknown): ContextPressureState {
    const record = readStrictObject(
      value,
      ["contextWindow", "pressureTokens", "surfaceTokens", "sampledSurfaceTokens", "claim"],
      "contextPressure",
    );
    const contextWindow =
      record.contextWindow === undefined
        ? undefined
        : readPositiveInteger(record.contextWindow, "contextPressure.contextWindow");
    const pressureTokens =
      record.pressureTokens === undefined
        ? undefined
        : readTokenCount(record.pressureTokens, "contextPressure.pressureTokens");
    const surfaceTokens = readTokenCount(record.surfaceTokens, "contextPressure.surfaceTokens");
    const sampledSurfaceTokens =
      record.sampledSurfaceTokens === undefined
        ? undefined
        : readTokenCount(record.sampledSurfaceTokens, "contextPressure.sampledSurfaceTokens");
    const claim = record.claim === undefined ? undefined : claimSchema.parse(record.claim);
    return {
      ...(contextWindow === undefined ? {} : { contextWindow }),
      ...(pressureTokens === undefined ? {} : { pressureTokens }),
      surfaceTokens,
      ...(sampledSurfaceTokens === undefined ? {} : { sampledSurfaceTokens }),
      ...(claim === undefined ? {} : { claim }),
    };
  },
};

/**
 * Bốn rổ usage bằng 0 — trạng thái khởi đầu của đơn vị `tokenUsage`.
 * Nhận: không.
 * Trả: vật thể MỚI với bốn rổ bằng 0.
 */
function zeroBuckets(): TokenUsageProjection {
  return {
    uncachedInputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

/**
 * Đổi một mẫu usage của nhà cung cấp thành bốn rổ (ô cache vắng mặt tính là 0).
 * Nhận: mẫu usage báo bởi nhà cung cấp.
 * Trả: bốn rổ của mẫu đó.
 */
function bucketsFrom(usage: TokenUsage): TokenUsageProjection {
  return {
    uncachedInputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
  };
}

/**
 * So HAI bộ bốn rổ xem có bằng nhau từng ô.
 * Nhận: bộ bên trái và bộ bên phải.
 * Trả: `true` khi CẢ BỐN ô bằng nhau.
 */
function bucketsEqual(left: TokenUsageProjection, right: TokenUsageProjection): boolean {
  return (
    left.uncachedInputTokens === right.uncachedInputTokens &&
    left.outputTokens === right.outputTokens &&
    left.cacheReadTokens === right.cacheReadTokens &&
    left.cacheWriteTokens === right.cacheWriteTokens
  );
}

/**
 * Cộng tổng luỹ kế: BỎ mốc trước (nếu có) rồi CỘNG mốc mới — khe thay-thế của `tokenUsage`.
 * Nhận: tổng hiện tại, bốn rổ của mốc đang bị thay (hoặc `undefined`), và bốn rổ mới.
 * Trả: tổng mới sau khi thay.
 */
function addReplacing(
  totals: TokenUsageProjection,
  previous: TokenUsageProjection | undefined,
  next: TokenUsageProjection,
): TokenUsageProjection {
  return {
    uncachedInputTokens: totals.uncachedInputTokens - (previous?.uncachedInputTokens ?? 0) + next.uncachedInputTokens,
    outputTokens: totals.outputTokens - (previous?.outputTokens ?? 0) + next.outputTokens,
    cacheReadTokens: totals.cacheReadTokens - (previous?.cacheReadTokens ?? 0) + next.cacheReadTokens,
    cacheWriteTokens: totals.cacheWriteTokens - (previous?.cacheWriteTokens ?? 0) + next.cacheWriteTokens,
  };
}

/**
 * Áp lực phía prompt của MỘT yêu cầu: input cộng lưu lượng cache, KHÔNG có output.
 * Nhận: mẫu usage báo bởi nhà cung cấp.
 * Trả: token áp lực phía prompt.
 */
function pressureFrom(usage: TokenUsage): number {
  return usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
}

/**
 * Usage mà MỘT lần tất toán Assistant bền báo cho lần thử của nó, nếu có.
 * Tin `assistant/message` mang thẳng `data.usage`; mọi lần tất toán khác đọc mẩu usage CUỐI trong dòng
 * gói đã nén của chính nó. Sự kiện không thuộc hai loại trên trả `undefined`.
 * Nhận: một sự kiện phiên đã cam kết.
 * Trả: mẫu usage của nhà cung cấp, hoặc `undefined` khi sự kiện không báo usage.
 */
export function usageOf(event: SessionEvent): TokenUsage | undefined {
  if (event.type === "assistant/message" && event.data.usage !== undefined) return event.data.usage;
  if (event.type !== "assistant/message" && event.type !== "assistant/attempt") return undefined;
  return lastAssistantStreamChunk(event.data.stream, "usage")?.usage;
}

/**
 * Đơn vị chiếu phiên `tokenUsage` của token-meter.
 *
 * Mỗi lần tất toán Assistant (v2) đóng góp mẫu usage CUỐI nằm trong dòng gói của nó. `llm/retry-started`
 * đóng khe thay-thế để lần thử được thử lại CỘNG vào tổng thay vì ghi đè mốc trước.
 */
export const tokenUsageProjectionDefinition: TokenUsageProjectionDefinitionShape = {
  key: "tokenUsage",
  stateVersion: 2,
  stateSchema: tokenUsageStateSchema,
  init: () => ({ totals: zeroBuckets(), last: null }),
  apply: (state: TokenUsageState, event: SessionEvent): TokenUsageState => {
    if (event.type === "llm/retry-started") {
      return state.last?.turn === event.data.turn && state.last.step === event.data.step
        ? { ...state, last: null }
        : state;
    }
    if (event.type !== "assistant/message" && event.type !== "assistant/attempt") {
      return state;
    }
    const sample = usageOf(event);
    if (sample === undefined) return state;
    const { turn, step } = event.data;
    const buckets = bucketsFrom(sample);
    const previous =
      state.last !== null && state.last.turn === turn && state.last.step === step ? state.last.buckets : undefined;
    if (previous !== undefined && bucketsEqual(previous, buckets)) return state;
    return {
      totals: addReplacing(state.totals, previous, buckets),
      last: { turn, step, buckets },
    };
  },
  wire: { viewSchema: projectionSchema, view: (state: TokenUsageState) => state.totals },
};

/**
 * Đơn vị chiếu độ chiếm ngữ cảnh `contextPressure` của token-meter.
 *
 * Hai khe THẮNG-SAU-CÙNG độc lập: mẫu usage mới nhất cấp tử số của nhà cung cấp, bản ghi
 * `request/context` mới nhất cấp mẫu số. Cả hai là giá trị TRỌN VẸN, nên chỉ thứ tự phát lại quyết định
 * kết quả và không có nhất quán chéo trường nào được khẳng định.
 *
 * `pressureTokens` chỉ phía prompt nên nó ĐỨNG YÊN trong lúc một lượt đang chảy và nhích lên khi yêu cầu
 * kế tiếp báo usage. Vì không gì ngoài một yêu cầu báo usage, nó cũng KHÔNG thấy được một lần nén: phép
 * gộp vì thế mang theo tổng bề mặt đang chạy và phát `projectedTokens` — mẫu cộng phần chuyển dịch CÓ DẤU
 * của bề mặt kể từ lúc lấy mẫu — để độ chiếm trả lời cho yêu cầu KẾ TIẾP thay vì yêu cầu trước. Tổng đi
 * cùng {@link foldSurfaceProjection}, nên trạng thái vẫn O(1) và một lần thay thế rút nó xuống bằng đúng
 * giá bóng đã ghi. Một lần thay thế KHÔNG có claim giữ nguyên tổng trước. Mẫu usage được đóng dấu TRƯỚC
 * khi cùng sự kiện đó nhập bề mặt, nên một `assistant/message` neo vào đúng bề mặt mà yêu cầu của nó đã thấy.
 */
export const contextPressureProjectionDefinition: ContextPressureProjectionDefinitionShape = {
  key: "contextPressure",
  stateVersion: 5,
  stateSchema: contextPressureStateSchema,
  init: () => ({ surfaceTokens: 0 }),
  apply: (state: ContextPressureState, event: SessionEvent): ContextPressureState => {
    const fold = foldSurfaceProjection(state.claim, event);
    let next = state;
    if (event.type === "request/context") {
      const contextWindow = event.data.contextWindow;
      if (contextWindow !== state.contextWindow) {
        if (contextWindow !== undefined) {
          next = { ...next, contextWindow };
        } else {
          const { contextWindow: _removed, ...withoutContextWindow } = next;
          next = withoutContextWindow;
        }
      }
    }
    const usage = usageOf(event);
    if (usage !== undefined) {
      const pressureTokens = pressureFrom(usage);
      if (pressureTokens !== next.pressureTokens || next.sampledSurfaceTokens !== next.surfaceTokens) {
        next = { ...next, pressureTokens, sampledSurfaceTokens: next.surfaceTokens };
      }
    }
    if (fold.deltaTokens !== 0) {
      next = { ...next, surfaceTokens: next.surfaceTokens + fold.deltaTokens };
    }
    // Một `fold.claim` ĐỊNH NGHĨA luôn là vật thể vừa dựng, nên SỰ HIỆN DIỆN quyết định việc giữ claim:
    // không có claim trước lẫn sau sự kiện này thì `next` giữ nguyên.
    if (state.claim === undefined && fold.claim === undefined) return next;
    const { claim: _expired, ...withoutClaim } = next;
    return fold.claim === undefined ? withoutClaim : { ...withoutClaim, claim: fold.claim };
  },
  wire: {
    viewSchema: pressureSchema,
    view: ({
      contextWindow,
      pressureTokens,
      surfaceTokens,
      sampledSurfaceTokens,
    }: ContextPressureState): ContextPressureProjection => ({
      ...(contextWindow === undefined ? {} : { contextWindow }),
      ...(pressureTokens === undefined ? {} : { pressureTokens }),
      ...(pressureTokens === undefined || sampledSurfaceTokens === undefined
        ? {}
        : { projectedTokens: Math.max(0, pressureTokens + surfaceTokens - sampledSurfaceTokens) }),
    }),
  },
};
