/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Đơn vị chiếu `contextBreakdown`: thành phần ước lượng của bề mặt còn giữ (system · tools ·
 *      message), độc lập giá ảnh theo tuyến và usage của provider — bản viết lại 1:1
 *      `lib/types/breakdown-projection.js` của `@deepseek-ai/dsh-token-meter`.
 */

import { SessionSeq, canonicalHeader, deriveEventMessage, isSurfaceEvent } from "@galaxy-blackhole/gbh-session";
import type { SessionEvent, SurfaceEvent } from "@galaxy-blackhole/gbh-session";
import type {} from "@deepseek-ai/dsh-compaction";

import { estimateMessage, estimateToolsTokens } from "./estimate.ts";

/** MỘT node `system/message` còn sống và giá ước lượng của nó. */
export interface ContextBreakdownSystemNode {
  /** Số thứ tự bền của sự kiện bề mặt. */
  seq: SessionSeq;
  /** Giá ước lượng cố định của tin nhắn hệ thống ở node này. */
  tokens: number;
}

/**
 * Giá bóng do sự kiện `compaction/summary` hoặc `compaction/prune` NẠP NGAY TRƯỚC một lần thay thế:
 * khoảng bị thay, giá ước lượng của nó, và các câu lệnh hệ thống còn sống nằm trong khoảng đó.
 */
export interface ContextBreakdownClaim {
  /** Seq bắt đầu (tính cả) của khoảng đã được định giá. */
  start: SessionSeq;
  /** Seq kết thúc (tính cả) của khoảng đã được định giá. */
  end: SessionSeq;
  /** Giá ước lượng của khoảng đã được định giá dưới bộ ước lượng cố định. */
  tokens: number;
  /** Các seq câu lệnh hệ thống còn sống bị khoảng này che, theo thứ tự bề mặt. */
  systemSeqs: SessionSeq[];
}

/** Thành phần của yêu cầu kế tiếp: hệ thống · công cụ · tin nhắn (khung nhìn dây của đơn vị chiếu). */
export interface ContextBreakdownProjection {
  /** Token ước lượng của câu lệnh hệ thống còn sống CUỐI CÙNG (theo thứ tự bề mặt) và khác rỗng; 0 khi không có. */
  systemTokens: number;
  /** Token ước lượng của lược đồ công cụ trong phong bì yêu cầu mới nhất; 0 trước yêu cầu đầu tiên. */
  toolsTokens: number;
  /** Token ước lượng của mọi node bề mặt khác đang thấy, GỒM các câu lệnh hệ thống đã bị thay. */
  messageTokens: number;
}

/**
 * Trạng thái checkpoint JSON thuần: các câu lệnh hệ thống còn sống theo thứ tự bề mặt, tổng bề mặt,
 * một claim đã nạp, và thành phần ba phần đã phát.
 */
export interface ContextBreakdownState {
  /** Các câu lệnh hệ thống còn sống, theo thứ tự bề mặt. */
  systems: ContextBreakdownSystemNode[];
  /** Tổng token bề mặt đang chạy (đã kẹp về không âm khi phát). */
  surfaceTokens: number;
  /** Claim đã nạp bởi sự kiện đo NGAY TRƯỚC; vắng khi không có. */
  claim?: ContextBreakdownClaim;
  /** Thành phần ba phần đã phát gần nhất. */
  breakdown: ContextBreakdownProjection;
}

/** Các câu lệnh hệ thống còn sống và tổng bề mặt sau MỘT sự kiện. */
export interface ContextBreakdownTotals {
  /** Các câu lệnh hệ thống còn sống sau sự kiện, theo thứ tự bề mặt. */
  systems: ContextBreakdownSystemNode[];
  /** Tổng token bề mặt sau sự kiện. */
  surfaceTokens: number;
}

/**
 * Hình dạng schema mà seam `sessionProjections` gọi tới: CHỈ `parse`. Bản gốc dùng zod; gói GBH này
 * KHÔNG khai `zod` (và không được thêm phụ thuộc), nên phần kiểm được viết lại tay với CÙNG luật:
 * số nguyên không âm, seq nguyên không âm ≤ `Number.MAX_SAFE_INTEGER`, object ĐÓNG (từ chối khoá lạ).
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
   * Trả: thành phần ba phần sẽ phát.
   */
  view(state: State): View;
}

/** Một đơn vị chiếu host-only mà seam `sessionProjections` nhận (khai theo CẤU TRÚC tại chỗ dùng). */
interface ContextBreakdownProjectionDefinitionShape {
  /** Khoá chiếu; bản gốc dùng `contextBreakdown` (giữ NGUYÊN kiểu literal như bản gốc). */
  readonly key: "contextBreakdown";
  /** Phiên bản trạng thái lưu; bản gốc dùng `6`. */
  readonly stateVersion: number;
  /** Schema kiểm trạng thái đã lưu trước khi mồi phép gộp. */
  readonly stateSchema: ProjectionSchema<ContextBreakdownState>;
  /**
   * Trạng thái cho log rỗng.
   * Nhận: không (seam thật truyền header phiên + số sự kiện thừa kế; bản gốc bỏ qua cả hai).
   * Trả: trạng thái rỗng — vật thể MỚI mỗi lần gọi như bản gốc.
   */
  init(): ContextBreakdownState;
  /**
   * Phép gộp THUẦN: trạng thái trước + một sự kiện ⇒ trạng thái sau.
   * Nhận: trạng thái trước và sự kiện đã cam kết.
   * Trả: trạng thái sau — GIỮ NGUYÊN tham chiếu khi sự kiện không đổi gì.
   */
  apply(state: ContextBreakdownState, event: SessionEvent): ContextBreakdownState;
  /** Khung nhìn dây của đơn vị chiếu. */
  readonly wire: ProjectionWire<ContextBreakdownState, ContextBreakdownProjection>;
}

/**
 * Báo một giá trị không hợp lệ theo đường dẫn của nó.
 * Nhận: đường dẫn trong trạng thái và mô tả luật bị vi phạm.
 * Trả: không — luôn ném lỗi.
 */
function invalid(path: string, expected: string): never {
  throw new Error(`context breakdown: ${path} ${expected}`);
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
 * Đọc MỘT object ĐÓNG: đúng các khoá đã khai, không thừa khoá nào — đúng `.strict()` của bản gốc.
 * Nhận: giá trị thô, danh sách khoá được phép, và đường dẫn để báo lỗi.
 * Trả: bản ghi đã kiểm (KHÔNG sao chép — nơi gọi tự dựng vật thể mới như zod).
 * Ném: khi giá trị không phải object thường, hoặc có khoá nằm ngoài danh sách.
 */
function readStrictObject(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(path, "must be an object");
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!keys.includes(key)) invalid(path, `has unrecognized key "${key}"`);
  }
  return record;
}

/** Schema của MỘT node hệ thống đã định giá: `{ seq, tokens }` đóng, seq là `SessionSeq`. */
const systemNodeSchema: ProjectionSchema<ContextBreakdownSystemNode> = {
  parse(value: unknown): ContextBreakdownSystemNode {
    const record = readStrictObject(value, ["seq", "tokens"], "systems[]");
    return {
      seq: readSessionSeq(record.seq, "systems[].seq"),
      tokens: readTokenCount(record.tokens, "systems[].tokens"),
    };
  },
};

/**
 * Đọc mảng node hệ thống đã định giá — đúng `z.array(systemNodeSchema)` của bản gốc.
 * Nhận: giá trị thô của trường `systems` và đường dẫn để báo lỗi.
 * Trả: mảng node MỚI, mỗi node đã kiểm và đã đóng dấu seq.
 * Ném: khi giá trị không phải mảng hoặc có node sai hình dạng.
 */
function readSystemNodes(value: unknown, path: string): ContextBreakdownSystemNode[] {
  if (!Array.isArray(value)) invalid(path, "must be an array");
  // `Array.from` (không phải `.map`) để lỗ hổng của mảng thưa cũng bị đọc thành `undefined` và bị từ chối
  // — đúng như `z.array(...)` của bản gốc.
  return Array.from(value, (item) => systemNodeSchema.parse(item));
}

/** Schema thành phần ba phần phát trên dây: đúng ba trường, kiểm TĂNG NGHIÊM NGẶT — khoá thừa là dữ liệu hỏng. */
const breakdownSchema: ProjectionSchema<ContextBreakdownProjection> = {
  parse(value: unknown): ContextBreakdownProjection {
    const record = readStrictObject(value, ["systemTokens", "toolsTokens", "messageTokens"], "breakdown");
    return {
      systemTokens: readTokenCount(record.systemTokens, "breakdown.systemTokens"),
      toolsTokens: readTokenCount(record.toolsTokens, "breakdown.toolsTokens"),
      messageTokens: readTokenCount(record.messageTokens, "breakdown.messageTokens"),
    };
  },
};

/** Schema của claim đã nạp: khoảng bị thay, giá ước lượng của nó, và các seq hệ thống bị che. */
const claimSchema: ProjectionSchema<ContextBreakdownClaim> = {
  parse(value: unknown): ContextBreakdownClaim {
    const record = readStrictObject(value, ["start", "end", "tokens", "systemSeqs"], "claim");
    const systemSeqs = record.systemSeqs;
    if (!Array.isArray(systemSeqs)) invalid("claim.systemSeqs", "must be an array");
    return {
      start: readSessionSeq(record.start, "claim.start"),
      end: readSessionSeq(record.end, "claim.end"),
      tokens: readTokenCount(record.tokens, "claim.tokens"),
      // Như `systems`: mảng thưa bị đọc thành `undefined` và bị từ chối (đúng `z.array(sessionSeq)`).
      systemSeqs: Array.from(systemSeqs, (seq, index) => readSessionSeq(seq, `claim.systemSeqs[${String(index)}]`)),
    };
  },
};

/** Schema trạng thái đã lưu — biên ĐẦU VÀO của đơn vị chiếu. */
const contextBreakdownStateSchema: ProjectionSchema<ContextBreakdownState> = {
  parse(value: unknown): ContextBreakdownState {
    const record = readStrictObject(value, ["systems", "surfaceTokens", "claim", "breakdown"], "state");
    const systems = readSystemNodes(record.systems, "state.systems");
    const surfaceTokens = readTokenCount(record.surfaceTokens, "state.surfaceTokens");
    const claim = record.claim === undefined ? undefined : claimSchema.parse(record.claim);
    const breakdown = breakdownSchema.parse(record.breakdown);
    return claim === undefined
      ? { systems, surfaceTokens, breakdown }
      : { systems, surfaceTokens, claim, breakdown };
  },
};

/**
 * Đặt node đã định giá của MỘT sự kiện bề mặt vào trạng thái.
 * Nhận: `state` — trạng thái trước sự kiện, KHÔNG kèm claim đã nạp; `claim` — giá bóng do sự kiện
 *        NGAY TRƯỚC nạp (nếu có); `event` — sự kiện bề mặt; `tokens` — giá ước lượng của tin nhắn sự kiện.
 * Trả: các câu lệnh hệ thống và tổng bề mặt sau sự kiện.
 * Ném: khi một lần thay thế ĐÃ ĐO nêu khoảng khác claim của nó, hoặc đặt tin nhắn hệ thống vào chỗ
 *       một khoảng đã đo (thứ tự của nó giữa các câu lệnh hệ thống còn sống là KHÔNG biết).
 */
export function placeSurfaceEvent(
  state: ContextBreakdownState,
  claim: ContextBreakdownClaim | undefined,
  event: SurfaceEvent,
  tokens: number,
): ContextBreakdownTotals {
  const op = event.surfaceOp;
  const node: ContextBreakdownSystemNode = { seq: event.seq, tokens };
  const isSystem = event.type === "system/message";
  if (op === "append") {
    return {
      systems: isSystem ? [...state.systems, node] : state.systems,
      surfaceTokens: state.surfaceTokens + tokens,
    };
  }
  if (claim !== undefined) {
    if (claim.start !== op.startSeq || claim.end !== op.endSeq) {
      throw new Error(
        `context breakdown: replace at seq ${event.seq} over range ${op.startSeq}-${op.endSeq} has no adjacent shadow price` +
          ` (armed claim covers ${claim.start}-${claim.end})`,
      );
    }
    if (isSystem) {
      throw new Error(
        `context breakdown: replace at seq ${event.seq} puts a system message in place of a metered range;` +
          " its order among the surviving system prompts is unknown",
      );
    }
    const shadowed = new Set(claim.systemSeqs);
    return {
      systems: state.systems.filter((system) => !shadowed.has(system.seq)),
      surfaceTokens: state.surfaceTokens + tokens - claim.tokens,
    };
  }
  const index = op.startSeq === op.endSeq ? state.systems.findIndex((system) => system.seq === op.startSeq) : -1;
  const replaced = state.systems[index];
  if (replaced === undefined) {
    // Trạng thái BỊ CHẶN không định giá được một khoảng không hệ thống chưa đo, nên gộp với delta 0;
    // các producer hiện tại ĐO mọi lần thay thế như vậy.
    return { systems: state.systems, surfaceTokens: state.surfaceTokens };
  }
  return {
    systems: isSystem ? state.systems.with(index, node) : state.systems.toSpliced(index, 1),
    surfaceTokens: state.surfaceTokens + tokens - replaced.tokens,
  };
}

/**
 * Phát tổng, GIỮ NGUYÊN object thành phần cũ khi các con số của nó không đổi (cổng `Object.is` của seam).
 * Nhận: `state` — trạng thái trước; `totals` — các câu lệnh hệ thống và tổng bề mặt sau sự kiện.
 * Trả: trạng thái sau, đã kẹp tổng về không âm và đã phân loại system/message.
 */
export function withTotals(state: ContextBreakdownState, totals: ContextBreakdownTotals): ContextBreakdownState {
  const surfaceTokens = Math.max(0, totals.surfaceTokens);
  const systemTokens = totals.systems.findLast((system) => system.tokens > 0)?.tokens ?? 0;
  const messageTokens = Math.max(0, surfaceTokens - systemTokens);
  const breakdown =
    systemTokens === state.breakdown.systemTokens && messageTokens === state.breakdown.messageTokens
      ? state.breakdown
      : { systemTokens, toolsTokens: state.breakdown.toolsTokens, messageTokens };
  return {
    ...state,
    systems: totals.systems,
    surfaceTokens,
    breakdown,
  };
}

/**
 * Bỏ claim đã nạp; trả LẠI CHÍNH tham chiếu cũ khi không có claim nào.
 * Nhận: trạng thái trước sự kiện.
 * Trả: trạng thái không còn `claim` (cùng tham chiếu khi vốn không có).
 */
export function withoutClaim(state: ContextBreakdownState): ContextBreakdownState {
  if (state.claim === undefined) return state;
  const { claim: _expired, ...unclaimed } = state;
  return unclaimed;
}

/**
 * Thành phần ngữ cảnh với câu lệnh hệ thống KHÁC RỖNG còn sống CUỐI CÙNG (theo thứ tự bề mặt) được
 * phân loại là token hệ thống; mọi giá đang thấy khác là tin nhắn. Lần nối cộng giá của nó; một lần
 * thay thế trừ giá bóng của sự kiện `compaction/summary` hoặc `compaction/prune` liền trước, mà
 * `shadowedSeqs` của nó cũng nêu các câu lệnh hệ thống bị bỏ; một lần viết lại câu lệnh hệ thống trừ
 * giá còn giữ của node hệ thống mà nó thay. Công cụ được định giá từ phong bì yêu cầu mới nhất.
 * KHÔNG áp giá tuyến nào.
 * Nhận: không — seam `sessionProjections` đăng ký định nghĩa này.
 * Trả: đơn vị chiếu khoá `contextBreakdown`, `stateVersion` 6, schema trạng thái, `init`, `apply` và
 *   khung nhìn dây `systemTokens` · `toolsTokens` · `messageTokens`.
 */
export const contextBreakdownProjectionDefinition: ContextBreakdownProjectionDefinitionShape = {
  key: "contextBreakdown",
  stateVersion: 6,
  stateSchema: contextBreakdownStateSchema,
  init: () => ({
    systems: [],
    surfaceTokens: 0,
    breakdown: { systemTokens: 0, toolsTokens: 0, messageTokens: 0 },
  }),
  apply: (state: ContextBreakdownState, event: SessionEvent): ContextBreakdownState => {
    if (event.type === "compaction/summary" || event.type === "compaction/prune") {
      const shadowed = new Set(event.data.shadowedSeqs);
      return {
        ...state,
        claim: {
          start: SessionSeq(event.data.shadowedRange.start),
          end: SessionSeq(event.data.shadowedRange.end),
          tokens: event.data.shadowedTokenCount,
          systemSeqs: state.systems.filter((system) => shadowed.has(system.seq)).map((system) => system.seq),
        },
      };
    }
    // Một claim CHỈ định giá sự kiện NGAY SAU sự kiện đo của nó.
    const unclaimed = withoutClaim(state);
    if (event.type === "request/header") {
      const toolsTokens = estimateToolsTokens(canonicalHeader(event.data.header));
      return toolsTokens === unclaimed.breakdown.toolsTokens
        ? unclaimed
        : { ...unclaimed, breakdown: { ...unclaimed.breakdown, toolsTokens } };
    }
    if (!isSurfaceEvent(event)) return unclaimed;
    const message = deriveEventMessage(event);
    // `estimateMessage` cua kernel nhan `Message` cua @deepseek-ai/dsh-llm; ban port dung kieu cua gbh-llm
    // (khac danh tinh, CUNG hinh dang runtime) => ep MOT cho tai bien (ADR 000d).
    const tokens = message === null ? 0 : estimateMessage(message as unknown as Parameters<typeof estimateMessage>[0]);
    return withTotals(unclaimed, placeSurfaceEvent(unclaimed, state.claim, event, tokens));
  },
  wire: {
    viewSchema: breakdownSchema,
    view: (state: ContextBreakdownState) => state.breakdown,
  },
};