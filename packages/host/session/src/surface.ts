/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Tầng SURFACE trên log sự kiện phiên: khung nhìn CÓ THỨ TỰ của các sự kiện sinh thông điệp LLM —
 *      `foldSurface`, lớp `SurfaceManager` (kiểm tại biên append + thay thế theo khoảng), toàn bộ luật
 *      chấp nhận/đủ điều kiện/thay thế, `validateSurfaceMetadata`, `deriveEventMessage`. Bản viết lại 1:1
 *      lib/types/surface.js (574 dòng) + surface.d.ts của @deepseek-ai/dsh-session; an toàn cho trình
 *      duyệt nên KHÔNG import `node:`.
 */

import type { Message } from "@galaxy-blackhole/gbh-llm";

import { KNOWN_SESSION_EVENT_TYPES, MESSAGE_PROJECTION_EVENT_TYPES } from "./known-event-types.ts";
import { SessionLogOffset, SessionSeq } from "./types.ts";
import type { SessionEvent, SessionEventType, SurfaceEvent, SurfaceOp } from "./types.ts";

/** Lịch sử CHỈ-ĐỌC ngay trước một sự kiện chiếu thông điệp. */
export interface SessionMessageProjectionContext {
  /** Các seq sự kiện sinh thông điệp hiện hành, theo thứ tự mô hình nhìn thấy. */
  nodes: readonly SessionSeq[];
  /** Cửa sổ sự kiện liền mạch; mục tại hoặc sau seq của ứng viên KHÔNG phải đầu vào đã cam kết. */
  events: readonly SessionEvent[];
  /** Seq tuyệt đối của sự kiện đầu cửa sổ. */
  baseSeq: SessionLogOffset;
  /** Các thông điệp đã chiếu trước đó, khoá theo seq sự kiện gốc. */
  messages: ReadonlyMap<SessionSeq, Message>;
}

/** Cách diễn giải THUẦN của một sự kiện do plugin sở hữu, làm đổi nội dung thông điệp đã có. */
export interface SessionMessageProjection<T extends SessionEventType = SessionEventType> {
  /** Loại sự kiện mà định nghĩa này diễn giải; khai nó bằng `@messageProjection` trong SessionEventMap. */
  type: T;
  /**
   * Kiểm TOÀN BỘ quyết định bền vững trước khi trả về bất kỳ cập nhật nào; giữ nguyên danh tính
   * thông điệp và phát bản sao bất biến, không sửa đầu vào.
   * Nhận: sự kiện ứng viên (chưa áp lên lịch sử đã cho) và ngữ cảnh lịch sử trước quyết định.
   * Trả: các thông điệp hiện hành đã đổi, khoá theo seq gốc của chúng.
   * Ném: khi quyết định bền vững không áp được lên lịch sử này.
   */
  project(event: SessionEvent<T>, context: SessionMessageProjectionContext): ReadonlyMap<SessionSeq, Message>;
}

/** Một phép thay thế quan sát được khi gộp surface của một phiên. */
export interface SurfaceFoldReplacement {
  /** Seq của sự kiện đã thay thế khoảng surface trước đó. */
  seq: SessionSeq;
  /** Seq bắt đầu (bao gồm) đã khai của khoảng surface bị thay thế. */
  start: SessionSeq;
  /** Seq kết thúc (bao gồm) đã khai của khoảng surface bị thay thế. */
  end: SessionSeq;
  /** Các mục surface THỰC SỰ bị gỡ bởi phép thay thế, theo thứ tự surface. */
  shadowedSeqs: SessionSeq[];
}

/** Kết quả đầy đủ của việc phát lại các phép surface trong một log phiên. */
export interface SurfaceFoldResult {
  /** Các seq sự kiện surface hiện hành, theo thứ tự mô hình nhìn thấy. */
  nodes: SessionSeq[];
  /** Các phép thay thế, theo thứ tự sự kiện. */
  replacements: SurfaceFoldReplacement[];
  /** Các thông điệp đã chiếu (bất biến), khoá theo seq sự kiện gốc. */
  projectedMessages: ReadonlyMap<SessionSeq, Message>;
}

/** Khung nhìn SỐNG chỉ-đọc của các sự kiện phiên sinh thông điệp. */
export interface SessionSurface {
  /** Các seq sự kiện surface hiện hành, theo thứ tự mô hình nhìn thấy. */
  readonly nodes: readonly SessionSeq[];
  /** Số lần thay thế vị trí đã cam kết (tăng đơn điệu). */
  readonly replaceGeneration: number;
  /** Số lần thay thế vị trí và đổi nội dung do plugin sở hữu đã cam kết (tăng đơn điệu). */
  readonly contentGeneration: number;
}

/** Bản đối chiếu runtime của hợp các sự kiện sinh thông điệp. */
const SURFACE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "system/message",
  "developer/message",
  "user/message",
  "assistant/message",
  "tool/result",
]);

/**
 * Một loại sự kiện có được gia nhập surface mà mô hình nhìn thấy hay không.
 * Nhận: `type` — loại sự kiện cần kiểm.
 * Trả: `true` với một trong các loại sự kiện sinh thông điệp.
 */
export function isSurfaceEligibleType(type: string): boolean {
  return SURFACE_EVENT_TYPES.has(type);
}

/**
 * Thu hẹp một sự kiện thành sự kiện ĐỦ ĐIỀU KIỆN surface và có marker bắt buộc của nó.
 * Nhận: `event` — sự kiện cần kiểm.
 * Trả: `true` khi cả loại lẫn marker cùng chỉ ra một sự kiện surface.
 */
export function isSurfaceEvent(event: SessionEvent): event is SurfaceEvent {
  if (!SURFACE_EVENT_TYPES.has(event.type)) return false;
  const candidate = event;
  return candidate.surfaceOp !== undefined;
}

/**
 * Thu hẹp một sự kiện thành sự kiện surface GỐC-APPEND: sự kiện đã vào surface ngay tại vị trí log
 * của chính nó và chưa từng là bản sao thay thế.
 *
 * Surface mà mô hình nhìn thấy CỐ Ý che các khoảng đã bị thay thế, nên nó là nguồn SAI cho bản ghi
 * cho con người — một phép thay thế đã đáp xuống sẽ xoá hội thoại người dùng đã thấy. Sự kiện
 * gốc-append là chất liệu bền vững của bản ghi đó; bản sao thay thế chỉ thuộc về mô hình.
 * Nhận: `event` — sự kiện cần kiểm.
 * Trả: `true` khi sự kiện đã nối vào CUỐI surface.
 */
export function isAppendSurfaceEvent(event: SessionEvent): event is SurfaceEvent & { surfaceOp: "append" } {
  return isSurfaceEvent(event) && event.surfaceOp === "append";
}

/**
 * Thu hẹp một sự kiện thành phép THAY THẾ surface: một nút đã che một khoảng surface đang có thay
 * vì nối vào cuối. Đối ứng của {@link isAppendSurfaceEvent} trên hai biến thể {@link SurfaceOp}.
 * Nhận: `event` — sự kiện cần kiểm.
 * Trả: `true` khi sự kiện đã thay thế một khoảng surface.
 */
export function isReplacementSurfaceEvent(
  event: SessionEvent,
): event is SurfaceEvent & { surfaceOp: Extract<SurfaceOp, { op: "replace" }> } {
  return isSurfaceEvent(event) && event.surfaceOp !== "append";
}

/**
 * Chiếu MỘT sự kiện thành thông điệp LLM mà nó dẫn ra, hoặc `null` khi nó không sinh thông điệp nào —
 * sự kiện không thuộc surface (attempt, boundary, bản ghi chỉ-log) hay thông điệp system, developer,
 * assistant rỗng nội dung. Người gọi dựng lại đầu vào mô hình phải đưa `projectedMessages` của CÙNG
 * tiền tố lấy từ {@link foldSurface}; thiếu map đó thì hàm này đọc nội dung gốc của sự kiện. Phương
 * thức của thể hiện phiên áp phép chiếu đang sống. Thông điệp là bất biến và nội dung không đổi giữ
 * nguyên danh tính bền vững của nó.
 * Nhận: `event` — sự kiện cần chiếu; `projectedMessages` — phép chiếu thông điệp của cùng tiền tố log.
 * Trả: thông điệp dẫn ra, hoặc `null` khi sự kiện không sinh thông điệp nào.
 */
export function deriveEventMessage(
  event: SessionEvent,
  projectedMessages?: ReadonlyMap<SessionSeq, Message>,
): Message | null {
  const projected = projectedMessages?.get(event.seq);
  if (projected !== undefined) return projected;
  // CỐ Ý không vét cạn: chỉ sự kiện sinh thông điệp mới dẫn ra lịch sử; biên turn/step, attempt
  // hỏng và lỗi là dữ liệu trace/replay.
  switch (event.type) {
    // Lời nhắc thường và ngữ cảnh được chèn giữ nguyên khung do bên sinh sở hữu.
    // Xem Derived history trong packages/core/session/README.md.
    case "user/message": {
      return event.data;
    }
    // Nút system và developer rỗng vẫn giữ vị trí surface mà không thêm thông điệp trên dây. Sự kiện
    // assistant rỗng mang usage của bước max-tokens và KHÔNG được chèn một lượt không nội dung vào
    // bản ghi của nhà cung cấp.
    case "system/message":
    case "developer/message":
    case "assistant/message": {
      if (event.data.message.content.length === 0) return null;
      return event.data.message;
    }
    case "tool/result": {
      return event.data.message;
    }
    default:
      // Sự kiện không thuộc surface (boundary, attempt, bản ghi chỉ-log) chiếu ra không thông điệp.
      // Hợp mở rộng được bằng merge: KHÔNG có assertNever ở đây.
      return null;
  }
}

/** Một trường payload có phải JSON object (không phải mảng hay scalar) hay không. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Từ chối các trường request-header không chuẩn tắc, role/nội dung developer, và metadata thất bại
 * của công cụ mâu thuẫn. Hàm KHÔNG kiểm toàn bộ payload sự kiện hay luồng của nhà cung cấp nhúng
 * trong đó.
 * Nhận: `event` — sự kiện có các trường payload liên quan cục bộ cần soi; `subject` — vị trí sự kiện
 * để đưa vào thông báo lỗi.
 * Trả: không trả gì; NÉM khi trường request-header, role/nội dung developer, hoặc metadata thất bại
 * của công cụ không hợp lệ.
 */
export function validateSessionEventData(event: Pick<SessionEvent, "type" | "data">, subject: string): void {
  // `data` giữ kiểu `unknown`: seam chỉ soi payload bằng các phép thu hẹp runtime bên dưới.
  const data: unknown = event.data;
  if (SURFACE_EVENT_TYPES.has(event.type) && isRecord(data)) {
    const message = event.type === "user/message" ? data : data["message"];
    if (isRecord(message)) {
      if ((event.type === "developer/message") !== (message["role"] === "developer")) {
        throw new Error(`${subject} developer/message and developer role must occur together`);
      }
      if (
        message["role"] !== "developer" &&
        Array.isArray(message["content"]) &&
        message["content"].some(
          (block) => isRecord(block) && (block["type"] === "tool-addition" || block["type"] === "tool-removal"),
        )
      ) {
        throw new Error(`${subject} tool-change blocks require developer role`);
      }
      if (event.type === "developer/message" && Array.isArray(message["content"])) {
        let hasAdditions = false;
        for (const block of message["content"]) {
          if (!isRecord(block) || (block["type"] !== "tool-addition" && block["type"] !== "tool-removal")) continue;
          if (typeof block["toolName"] !== "string" || block["toolName"].length === 0) {
            throw new Error(`${subject} ${block["type"]} requires a nonempty toolName`);
          }
          if (block["type"] === "tool-addition") {
            hasAdditions = true;
            if (Object.hasOwn(block, "tool")) {
              throw new Error(`${subject} tool-addition must omit inline tool definitions`);
            }
          }
        }
        if (hasAdditions ? !isEventSeq(data["headerSeq"]) : Object.hasOwn(data, "headerSeq")) {
          throw new Error(`${subject} requires headerSeq exactly when tool additions are present`);
        }
      }
    }
  }
  if (event.type === "request/header") {
    if (!isRecord(data)) throw new Error(`${subject} data must be an object`);
    const header = data["header"];
    if (!isRecord(header)) throw new Error(`${subject} header must be an object`);
    if (Object.hasOwn(header, "system")) throw new Error(`${subject} must omit header.system; use system/message`);
    if (Array.isArray(header["tools"]) && header["tools"].length === 0) {
      throw new Error(`${subject} must omit empty tools`);
    }
    const defaults = header["adapterDefaults"];
    if (isRecord(defaults) && Object.keys(defaults).length === 0) {
      throw new Error(`${subject} must omit empty adapterDefaults`);
    }
  } else if (event.type === "tool/result") {
    if (!isRecord(data)) throw new Error(`${subject} data must be an object`);
    if (data["error"] === undefined) return;
    const message = data["message"];
    if (!isRecord(message) || message["isError"] !== true) {
      throw new Error(`${subject} error requires message.isError === true`);
    }
  }
}

/** Trạng thái chuyển tiếp DÙNG CHUNG của một phép gộp surface. */
interface SurfaceFoldState {
  /** Các seq sự kiện surface hiện hành, theo thứ tự mô hình nhìn thấy. */
  nodes: SessionSeq[];
  /** Số lần thay thế vị trí đã cam kết. */
  replaceGeneration: number;
  /** Số lần đổi nội dung mô hình nhìn thấy đã cam kết. */
  contentGeneration: number;
  /** Thông điệp đã chiếu, khoá theo seq sự kiện gốc. */
  projectedMessages: Map<SessionSeq, Message>;
  /** Các định nghĩa chiếu đã dùng tới. */
  projections: Set<SessionMessageProjection>;
}

/** Tạo trạng thái gộp surface rỗng. */
function createFoldState(): SurfaceFoldState {
  return {
    nodes: [],
    replaceGeneration: 0,
    contentGeneration: 0,
    projectedMessages: new Map(),
    projections: new Set(),
  };
}

/** Một giá trị runtime có phải seq sự kiện AN TOÀN, KHÔNG ÂM hay không. */
function isEventSeq(value: unknown): value is SessionSeq {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

/** Một giá trị runtime có ĐÚNG hình dạng replace theo vị trí hay không. */
function isReplaceOp(value: unknown): value is Extract<SurfaceOp, { op: "replace" }> {
  const op = value as Record<string, unknown>;
  return (
    Object.keys(op).length === 3 &&
    Object.hasOwn(op, "op") &&
    Object.hasOwn(op, "startSeq") &&
    Object.hasOwn(op, "endSeq") &&
    op["op"] === "replace" &&
    isEventSeq(op["startSeq"]) &&
    isEventSeq(op["endSeq"])
  );
}

/** Kiểm tính đủ điều kiện surface cục bộ của sự kiện và trả về phép của nó. */
function surfaceOpOf(event: SessionEvent): SurfaceOp | undefined {
  const raw = event;
  if (!isSurfaceEligibleType(event.type)) {
    // Bản ghi lạ nhưng bỏ qua được giữ metadata mờ mà không ảnh hưởng lịch sử.
    if (!KNOWN_SESSION_EVENT_TYPES.has(event.type) && event.ignorable === true) return;
    if (raw.surfaceOp !== undefined) {
      throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry surfaceOp`);
    }
    if (raw.sourceEventSeqs !== undefined) {
      throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry sourceEventSeqs`);
    }
    return;
  }
  const op = raw.surfaceOp;
  if (op === undefined) {
    throw new Error(`session event "${event.type}" is surface-eligible and requires a surfaceOp marker`);
  }
  if (op === "append") return op;
  if (op === null || typeof op !== "object" || Array.isArray(op)) {
    throw new Error(`session event "${event.type}" carries an invalid surfaceOp`);
  }
  if (!isReplaceOp(op)) {
    throw new Error(`session event "${event.type}" carries an invalid replace surfaceOp`);
  }
  return op;
}

/** Kiểm các seq sự kiện nguồn được dẫn so với mục log trước đó và khoảng bị thay thế. */
function assertSourceEventReferences(event: SessionEvent, shadowedSeqs: readonly SessionSeq[]): void {
  const raw = event.sourceEventSeqs;
  if (event.type === "assistant/message" && raw !== undefined) {
    throw new Error("assistant/message embeds its source stream and cannot carry sourceEventSeqs");
  }
  const sources = new Set<SessionSeq>();
  if (raw !== undefined) {
    if (!Array.isArray(raw)) {
      throw new Error(`sourceEventSeqs on event at seq ${event.seq} must be an array when present`);
    }
    if (raw.length === 0) {
      throw new Error("sourceEventSeqs must not be empty");
    }
    let nonEarlierSource: SessionSeq | undefined;
    for (const source of raw) {
      if (!isEventSeq(source)) {
        throw new Error(
          `session event "${event.type}" sourceEventSeqs must densely contain non-negative safe integers`,
        );
      }
      sources.add(source);
      if (nonEarlierSource === undefined && source >= event.seq) nonEarlierSource = source;
    }
    if (sources.size !== raw.length) {
      throw new Error("sourceEventSeqs must not contain duplicates");
    }
    if (nonEarlierSource !== undefined) {
      throw new Error(`sourceEventSeqs must reference earlier events: ${nonEarlierSource} >= current seq ${event.seq}`);
    }
  }
  const missing = shadowedSeqs.filter((seq) => !sources.has(seq));
  if (missing.length > 0) {
    throw new Error(
      `surface replace: sourceEventSeqs must include every shadowed surface node; missing ${missing.join(", ")}`,
    );
  }
}

/** Đối chiếu các phép thêm công cụ với request header lịch sử BẤT BIẾN của chúng. */
function assertDeveloperHeader(
  event: SessionEvent,
  events: readonly SessionEvent[],
  baseSeq: SessionLogOffset,
): void {
  if (event.type !== "developer/message") return;
  validateSessionEventData(event, `developer/message at seq ${event.seq}`);
  if (event.data.headerSeq === undefined) return;
  const headerSeq = event.data.headerSeq;
  const headerEvent = events[headerSeq - baseSeq];
  if (headerSeq >= event.seq || headerEvent?.type !== "request/header") {
    throw new Error("developer/message headerSeq must reference an earlier request/header");
  }
  for (const block of event.data.message.content) {
    if (block.type !== "tool-addition") continue;
    const definitions =
      headerEvent.data.header.tools?.filter((tool: { name: string }) => tool.name === block.toolName) ?? [];
    if (definitions.length !== 1) {
      throw new Error(
        `developer/message tool-addition "${block.toolName}" must name exactly one tool in headerSeq ${headerSeq}`,
      );
    }
    const definition = definitions[0]!;
    if (typeof definition.description !== "string" || !isRecord(definition.parameters)) {
      throw new Error(
        `developer/message tool-addition "${block.toolName}" requires a complete tool definition in headerSeq ${headerSeq}`,
      );
    }
    if (Object.hasOwn(definition, "deferLoading") && definition.deferLoading !== true) {
      throw new Error("developer/message referenced tool deferLoading must be true when present");
    }
  }
}

/**
 * Kiểm metadata surface của MỘT sự kiện mà không xét tư cách thành viên log hay surface.
 * Bản ghi lạ nhưng bỏ qua được giữ metadata mờ và KHÔNG BAO GIỜ đổi surface.
 * Nhận: `event` — sự kiện có marker và các giá trị seq nguồn cần soi.
 * Trả: phép đã kiểm, hoặc `undefined` với sự kiện chỉ-log hay bản ghi lạ bỏ qua được.
 * Ném: khi metadata vi phạm luật cục bộ về đủ điều kiện, marker hoặc seq nguồn.
 */
export function validateSurfaceMetadata(event: SessionEvent): SurfaceOp | undefined {
  const op = surfaceOpOf(event);
  if (op !== undefined && op !== "append" && (op.startSeq >= event.seq || op.endSeq >= event.seq)) {
    throw new Error(`surface replace at seq ${event.seq}: startSeq and endSeq must reference earlier events`);
  }
  if (op !== undefined) assertSourceEventReferences(event, []);
  return op;
}

/** Định vị MỘT khoảng thay thế mà không sửa trạng thái gộp hiện tại. */
function replacementRange(
  state: SurfaceFoldState,
  op: Extract<SurfaceOp, { op: "replace" }>,
): { startIdx: number; endIdx: number; shadowedSeqs: SessionSeq[] } {
  const startIdx = state.nodes.indexOf(op.startSeq);
  if (startIdx === -1) {
    throw new Error(`surface replace: start seq ${op.startSeq} not found in surface`);
  }
  const endIdx = state.nodes.indexOf(op.endSeq);
  if (endIdx === -1) {
    throw new Error(`surface replace: end seq ${op.endSeq} not found in surface`);
  }
  if (startIdx > endIdx) {
    throw new Error(
      `surface replace: start seq ${op.startSeq} (index ${startIdx}) is after end seq ${op.endSeq} (index ${endIdx})`,
    );
  }
  return {
    startIdx,
    endIdx,
    shadowedSeqs: state.nodes.slice(startIdx, endIdx + 1),
  };
}

/**
 * So sánh SÂU cấu trúc trên miền giá trị JSON của sự kiện phiên (null/boolean/number/string, mảng,
 * object thuần). Thay `isDeepStrictEqual` của `node:util` để module này an toàn cho trình duyệt.
 * Nhận: `a`, `b` — hai giá trị JSON cần so.
 * Trả: `true` khi hai giá trị bằng nhau về cấu trúc.
 */
function isDeepEqualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => isDeepEqualJson(item, b[i]));
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const aKeys = Object.keys(a);
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => Object.hasOwn(b, key) && isDeepEqualJson(aRecord[key], bRecord[key]));
}

/** Giới hạn một phép thay thế tool-result vào nội dung của ĐÚNG MỘT kết quả hiện hành. */
function assertToolResultRewrite(
  event: SessionEvent,
  shadowedSeqs: readonly SessionSeq[],
  events: readonly SessionEvent[],
  baseSeq: SessionLogOffset,
): void {
  if (event.type !== "tool/result") return;
  if (shadowedSeqs.length !== 1) {
    throw new Error("tool/result surface replacement must rewrite exactly one current node");
  }
  for (const originalSeq of shadowedSeqs) {
    const original = events[originalSeq - baseSeq];
    if (original?.type !== "tool/result") {
      throw new Error("tool/result surface replacement must target a current tool/result");
    }
    const originalRest: Record<string, unknown> = { ...original.data };
    const replacementRest: Record<string, unknown> = { ...event.data };
    originalRest["message"] = { ...original.data.message, content: null };
    replacementRest["message"] = { ...event.data.message, content: null };
    if (!isDeepEqualJson(originalRest, replacementRest)) {
      throw new Error("tool/result surface replacement may change only content");
    }
  }
}

/**
 * Bảo vệ system prompt tại nút surface 0. Một phép thay thế phủ nút 0 khi nút đó là `system/message`
 * thì CHÍNH NÓ phải là `system/message` trên đúng nút đó; các nút system về sau không được bảo vệ và
 * một khoảng compaction có thể che chúng.
 */
function assertSystemHeadRewrite(
  event: SessionEvent,
  state: SurfaceFoldState,
  startIdx: number,
  shadowedSeqs: readonly SessionSeq[],
  events: readonly SessionEvent[],
  baseSeq: SessionLogOffset,
): void {
  if (startIdx !== 0) return;
  const head = events[state.nodes[0]! - baseSeq];
  if (head?.type !== "system/message") return;
  if (event.type !== "system/message" || shadowedSeqs.length !== 1) {
    throw new Error(
      "surface replace: node 0 holds the system prompt and may be rewritten only by a system/message over exactly that node",
    );
  }
}

/** Một phép chuyển surface ĐÃ KIỂM, sẵn sàng cam kết nguyên tử vào trạng thái gộp. */
type SurfacePlan =
  | {
      /** Nối sự kiện vào cuối surface. */
      kind: "append";
      /** Seq của sự kiện được nối. */
      seq: SessionSeq;
    }
  | {
      /** Thay một khoảng surface bằng một nút. */
      kind: "replace";
      /** Seq của sự kiện thay thế. */
      seq: SessionSeq;
      /** Seq bắt đầu (bao gồm) của khoảng bị thay thế. */
      start: SessionSeq;
      /** Seq kết thúc (bao gồm) của khoảng bị thay thế. */
      end: SessionSeq;
      /** Chỉ số surface của nút bắt đầu. */
      startIdx: number;
      /** Chỉ số surface của nút kết thúc. */
      endIdx: number;
      /** Các seq surface thực sự bị gỡ. */
      shadowedSeqs: SessionSeq[];
    }
  | {
      /** Áp một định nghĩa chiếu thông điệp do plugin sở hữu. */
      kind: "project";
      /** Định nghĩa chiếu đã áp. */
      projection: SessionMessageProjection;
      /** Các thông điệp đã đổi, khoá theo seq gốc. */
      messages: ReadonlyMap<SessionSeq, Message>;
    };

/** Kiểm một sự kiện tại biên phát lại của nó và chuẩn bị phép chuyển gộp NGUYÊN TỬ. */
function planSurfaceEvent(
  state: SurfaceFoldState,
  event: SessionEvent,
  expectedSeq: SessionSeq,
  events: readonly SessionEvent[],
  baseSeq: SessionLogOffset,
  projections: readonly SessionMessageProjection[],
): SurfacePlan | undefined {
  if (event.seq !== expectedSeq) {
    throw new Error(`session event seq ${event.seq} is not contiguous; expected ${expectedSeq}`);
  }
  const surfaceOp = validateSurfaceMetadata(event);
  assertDeveloperHeader(event, events, baseSeq);
  const projection = projections.find((item) => item.type === event.type);
  if (projection !== undefined) {
    return {
      kind: "project",
      projection,
      messages: projection.project(event, {
        nodes: state.nodes,
        events,
        baseSeq,
        messages: state.projectedMessages,
      }),
    };
  }
  if (MESSAGE_PROJECTION_EVENT_TYPES.has(event.type)) {
    throw new Error(
      `session event "${event.type}" requires a message projection; load its owning plugin or supply its projection definition`,
    );
  }
  if (surfaceOp === undefined) return;
  if (surfaceOp === "append") {
    return { kind: "append", seq: event.seq };
  }
  const range = replacementRange(state, surfaceOp);
  assertSourceEventReferences(event, range.shadowedSeqs);
  assertToolResultRewrite(event, range.shadowedSeqs, events, baseSeq);
  assertSystemHeadRewrite(event, state, range.startIdx, range.shadowedSeqs, events, baseSeq);
  return {
    kind: "replace",
    seq: event.seq,
    start: surfaceOp.startSeq,
    end: surfaceOp.endSeq,
    ...range,
  };
}

/** Áp MỘT sự kiện và chỉ trả metadata thay thế khi đã có một phép thay thế. */
function applySurfaceEvent(
  state: SurfaceFoldState,
  event: SessionEvent,
  expectedSeq: SessionSeq,
  events: readonly SessionEvent[],
  baseSeq: SessionLogOffset,
  projections: readonly SessionMessageProjection[],
): SurfaceFoldReplacement | undefined {
  const plan = planSurfaceEvent(state, event, expectedSeq, events, baseSeq, projections);
  return applySurfacePlan(state, plan);
}

/** Cam kết MỘT phép chuyển surface đã kiểm trước đó. */
function applySurfacePlan(
  state: SurfaceFoldState,
  plan: SurfacePlan | undefined,
): SurfaceFoldReplacement | undefined {
  if (plan?.kind === "append") {
    state.nodes.push(plan.seq);
  } else if (plan?.kind === "replace") {
    state.nodes.splice(plan.startIdx, plan.endIdx - plan.startIdx + 1, plan.seq);
    state.replaceGeneration += 1;
    state.contentGeneration += 1;
  } else if (plan?.kind === "project") {
    for (const [seq, message] of plan.messages) state.projectedMessages.set(seq, message);
    state.projections.add(plan.projection);
    state.contentGeneration += 1;
  }
  if (plan?.kind !== "replace") return;
  return {
    seq: plan.seq,
    start: plan.start,
    end: plan.end,
    shadowedSeqs: plan.shadowedSeqs,
  };
}

/**
 * Phát lại TOÀN BỘ log phiên qua phép gộp surface chuẩn tắc.
 * Nhận: `events` — các sự kiện phiên theo thứ tự seq LIỀN MẠCH; `projections` — các bộ diễn giải
 * thuần cho thay đổi thông điệp do plugin sở hữu (định nghĩa bắt buộc phải được cấp).
 * Trả: các seq hiện hành đã TÁCH RỜI cùng lịch sử thay thế.
 * Ném: khi thiếu một bộ diễn giải, hoặc một sự kiện vi phạm phép chiếu, metadata surface, việc dẫn
 * nguồn hay luật thay thế của nó.
 */
export function foldSurface(
  events: readonly SessionEvent[],
  projections: readonly SessionMessageProjection[] = [],
): SurfaceFoldResult {
  const state = createFoldState();
  const replacements: SurfaceFoldReplacement[] = [];
  for (const [index, event] of events.entries()) {
    const replacement = applySurfaceEvent(
      state,
      event,
      SessionSeq(index),
      events,
      SessionLogOffset(0),
      projections,
    );
    if (replacement !== undefined) replacements.push(replacement);
  }
  return { nodes: [...state.nodes], replacements, projectedMessages: new Map(state.projectedMessages) };
}

/** Ứng viên đã được `validateNext` kiểm, chờ đúng log nhận nó. */
interface PendingSurfacePlan {
  /** Sự kiện ứng viên (chưa vào log). */
  event: SessionEvent;
  /** Seq mà log sẽ cấp cho ứng viên. */
  expectedSeq: SessionSeq;
  /** Phép chuyển đã kiểm cho ứng viên. */
  plan: SurfacePlan | undefined;
}

/** Khung nhìn surface CÓ THỨ TỰ tăng dần và bộ kiểm tại biên append. */
export class SurfaceManager implements SessionSurface {
  /** Log liền mạch đầy đủ hoặc cửa sổ sự kiện đã nạp. */
  private log: readonly SessionEvent[];
  /** Seq tuyệt đối của sự kiện đầu cửa sổ. */
  private readonly baseSeq: SessionLogOffset;
  /** Các định nghĩa MƯỢN SỐNG; gỡ một định nghĩa đã dùng làm mọi phép đọc sau đó mất hiệu lực. */
  private readonly projections: readonly SessionMessageProjection[];
  /** Trạng thái chuyển tiếp dùng chung; lịch sử thay thế KHÔNG được giữ lại. */
  private _state: SurfaceFoldState = createFoldState();
  /** Seq tuyệt đối đã xử lý cuối cùng; `-1` khi chưa có sự kiện nào. */
  private _lastProcessedSeq: SessionSeq | -1;
  /** Ứng viên đã kiểm bởi `validateNext`, chờ đúng log nhận nó. */
  private _pendingPlan: PendingSurfacePlan | undefined;

  /**
   * Nhận: `log` — log đầy đủ liền mạch hoặc cửa sổ sự kiện đã nạp; `baseSeq` — seq tuyệt đối của
   * sự kiện đầu cửa sổ; `projections` — các định nghĩa mượn sống (gỡ định nghĩa đã dùng làm mọi
   * phép đọc sau đó mất hiệu lực).
   */
  constructor(
    log: readonly SessionEvent[],
    baseSeq: SessionLogOffset = SessionLogOffset(0),
    projections: readonly SessionMessageProjection[] = [],
  ) {
    this.log = log;
    this.baseSeq = baseSeq;
    this.projections = projections;
    this._lastProcessedSeq = baseSeq === 0 ? -1 : SessionSeq(baseSeq - 1);
  }

  /**
   * Kiểm ứng viên KẾ TIẾP mà không sửa surface đã cam kết.
   * Nhận: `event` — sự kiện ứng viên chưa gia nhập log.
   * Trả: không trả gì; giữ phép chuyển đã kiểm để `_processDelta` cam kết khi log nhận ứng viên.
   */
  validateNext(event: SessionEvent): void {
    this._assertProjections();
    if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1) this._processDelta();
    const expectedSeq = SessionSeq(this.baseSeq + this.log.length);
    this._pendingPlan = {
      event,
      expectedSeq,
      plan: planSurfaceEvent(this._state, event, expectedSeq, this.log, this.baseSeq, this.projections),
    };
  }

  /** Số lần thay thế vị trí đã gộp (tăng đơn điệu). */
  get replaceGeneration(): number {
    this._assertProjections();
    if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1) this._processDelta();
    return this._state.replaceGeneration;
  }

  /** Số lần đổi nội dung mô hình nhìn thấy đã cam kết (tăng đơn điệu). */
  get contentGeneration(): number {
    this._assertProjections();
    if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1) this._processDelta();
    return this._state.contentGeneration;
  }

  /**
   * Chiếu MỘT thông điệp với MỌI phép chiếu thông điệp đã cam kết được áp lên.
   * Nhận: `event` — sự kiện sinh thông điệp hoặc chỉ-log.
   * Trả: thông điệp bất biến đã chiếu, hoặc `null` khi sự kiện không sinh thông điệp nào.
   */
  deriveEventMessage(event: SessionEvent): Message | null {
    this._assertProjections();
    if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1) this._processDelta();
    return deriveEventMessage(event, this._state.projectedMessages);
  }

  /** Các seq sự kiện surface, theo thứ tự mô hình nhìn thấy. */
  get nodes(): readonly SessionSeq[] {
    this._assertProjections();
    if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1) this._processDelta();
    return this._state.nodes;
  }

  /** Gộp các sự kiện đã được nối thêm kể từ lần truy cập trước. */
  private _processDelta(): void {
    const tailSeq = this.baseSeq + this.log.length - 1;
    for (let seq = this._lastProcessedSeq + 1; seq <= tailSeq; seq++) {
      const index = seq - this.baseSeq;
      // oxlint-disable-next-line typescript/no-non-null-assertion -- bounded by the loop condition
      const event = this.log[index]!;
      const pending = this._pendingPlan;
      if (pending !== undefined && pending.event === event && pending.expectedSeq === seq) {
        applySurfacePlan(this._state, pending.plan);
      } else {
        applySurfaceEvent(this._state, event, SessionSeq(seq), this.log, this.baseSeq, this.projections);
      }
      if (pending !== undefined && pending.expectedSeq <= seq) this._pendingPlan = undefined;
      this._lastProcessedSeq = SessionSeq(seq);
    }
  }

  /** Thông điệp đã cache KHÔNG được sống lâu hơn các định nghĩa đã diễn giải log của chúng. */
  private _assertProjections(): void {
    const candidate = this._pendingPlan;
    const pending =
      candidate !== undefined && this.log[candidate.expectedSeq - this.baseSeq] === candidate.event
        ? candidate.plan
        : undefined;
    const required =
      pending?.kind === "project" ? [...this._state.projections, pending.projection] : this._state.projections;
    for (const projection of required) {
      if (!this.projections.includes(projection)) {
        throw new Error(
          `session message projection "${projection.type}" was removed or replaced; restore the session with its owning plugin`,
        );
      }
    }
  }
}
