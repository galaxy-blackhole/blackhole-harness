/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Kiểm tra và đóng băng header/event của phiên, chốt listener Cordis, giữ bảng phiên sống và cổng
 *      bản ghi `plugin:` — port 1:1 vùng `lib/types/index.js` dòng 25–397 (stock bundle
 *      `lib/index.js` dòng 1031–1323).
 */

import { isAbsolute } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import type { Scoped } from "@deepseek-ai/dsh-scope";
import { deepFreeze, snapshotJsonValue } from "@galaxy-blackhole/gbh-util-values";
import { commitPluginRecord } from "./session.ts";
import type { Session } from "./session.ts";
import { validateSessionEventData, validateSurfaceMetadata } from "./surface.ts";
import { SESSION_FORMAT_VERSION } from "./types.ts";
import type {
  PluginRecord,
  PluginRecordMap,
  PluginRecordType,
  SessionEvent,
  SessionHeader,
  SessionId,
  SessionSeq,
} from "./types.ts";

/**
 * Kiểm tra và đóng băng TẠI CHỖ một header tạo phiên đã tách khỏi producer.
 * Nhận: `id` của phiên và `input` là header CHƯA tin cậy (mọi giá trị).
 * Trả: chính bản ghi header đó, đã đóng băng sâu (không sao chép).
 * Ném: khi không phải bản ghi JSON thuần, có trường `seedLength`, sai `version`/`id`,
 *   `createdAt` không phải số nguyên an toàn không âm, `cwd` không phải đường dẫn tuyệt đối,
 *   `parentSession`/`agentPreset` không phải chuỗi, `isSeeded` không phải boolean,
 *   `origin` khác "subagent", hoặc `delegationDepth` không phải số nguyên an toàn không âm.
 */
export function validateSessionHeader(id: SessionId, input: unknown): SessionHeader {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("session header is not a plain JSON record");
  }
  const record = input as Record<string, unknown>;
  if (Object.hasOwn(record, "seedLength")) {
    throw new Error('session header has invalid field "seedLength"');
  }
  if (record.version !== SESSION_FORMAT_VERSION) {
    throw new Error(`session header version must be ${SESSION_FORMAT_VERSION}, got ${String(record.version)}`);
  }
  if (record.id !== id) {
    throw new Error(`session header id "${String(record.id)}" does not match session id "${id}"`);
  }
  if (typeof record.createdAt !== "number"
    || !Number.isSafeInteger(record.createdAt)
    || record.createdAt < 0) {
    throw new Error("session header createdAt must be a non-negative safe integer");
  }
  if (record.cwd !== undefined) {
    if (typeof record.cwd !== "string") throw new Error("session header cwd must be a string");
    if (!isAbsolute(record.cwd)) {
      throw new Error(`session header cwd must be an absolute path, got "${record.cwd}"`);
    }
  }
  if (record.parentSession !== undefined && typeof record.parentSession !== "string") {
    throw new Error("session header parentSession must be a string");
  }
  if (typeof record.isSeeded !== "boolean") {
    throw new Error("session header isSeeded must be a boolean");
  }
  if (record.origin !== undefined && record.origin !== "subagent") {
    throw new Error('session header origin must be "subagent"');
  }
  if (record.delegationDepth !== undefined
    && (typeof record.delegationDepth !== "number" || !Number.isSafeInteger(record.delegationDepth) || record.delegationDepth < 0)) {
    throw new Error("session header delegationDepth must be a non-negative safe integer");
  }
  if (record.agentPreset !== undefined && typeof record.agentPreset !== "string") {
    throw new Error("session header agentPreset must be a string");
  }
  return deepFreeze(record) as unknown as SessionHeader;
}

/**
 * Kiểm tra và đóng băng TẠI CHỖ một header bền vững do bên gọi SỞ HỮU ĐỘC QUYỀN.
 * Nhận: `id` của phiên và `input` là header đọc từ storage.
 * Trả: chính bản ghi header đó, đã đóng băng sâu.
 * Ném: khi prototype không phải `Object.prototype`/`null` (không phải JSON thuần), hoặc bất kỳ điều
 *   kiện nào của {@link validateSessionHeader} hỏng.
 */
export function validateRestoredSessionHeader(id: SessionId, input: unknown): SessionHeader {
  if (input !== null && typeof input === "object" && !Array.isArray(input)) {
    const prototype = Reflect.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("session header is not a plain JSON record");
    }
  }
  return validateSessionHeader(id, input);
}

/**
 * Tách, kiểm tra rồi đóng băng metadata tạo phiên do một phiên công bố.
 * Nhận: `id` của phiên và `source` (header nguồn; vắng mặt thì dựng header tối thiểu
 *   `{ version, id, createdAt: Date.now(), isSeeded: false }`).
 * Trả: header đã chụp JSON, đóng băng sâu và hợp lệ.
 * Ném: khi nguồn không tuần tự hoá JSON không mất mát, hoặc header hỏng theo {@link validateSessionHeader}.
 */
export function snapshotSessionHeader(id: SessionId, source?: SessionHeader): SessionHeader {
  const input: SessionHeader = source === undefined
    ? { version: SESSION_FORMAT_VERSION, id, createdAt: Date.now(), isSeeded: false }
    : source;
  const snapshot = snapshotJsonValue(input);
  if (snapshot === undefined) throw new Error("session header is not losslessly JSON-serializable");
  return validateSessionHeader(id, snapshot);
}

/**
 * Kiểm tra một event do bên gọi SỞ HỮU ĐỘC QUYỀN và đóng băng sâu tin nhắn đã định danh của nó, KHÔNG
 * sao chép event. Bên gọi chuyển giao một đồ thị đối tượng mà không producer nào giữ lại và không chia sẻ
 * con mutable với event khác; nếu không chắc, dùng {@link snapshotSessionEvent}.
 * Nhận: `event` đã thuộc quyền sở hữu của vùng này.
 * Trả: chính đối tượng event đó, với tin nhắn đã kiểm tra và đóng băng sâu.
 * Ném: khi metadata surface cục bộ, trường request-header hoặc bất biến tin nhắn không hợp lệ;
 *   quan hệ lịch sử KHÔNG được kiểm ở đây.
 */
export function adoptSessionEvent<T extends SessionEvent>(event: T): T {
  const candidate: SessionEvent = event;
  validateSessionEventData(candidate, `session event at seq ${candidate.seq}`);
  validateSurfaceMetadata(candidate);
  assertMessageEventShape(candidate, `session event at seq ${candidate.seq}`);
  switch (candidate.type) {
    case "user/message":
      deepFreeze(candidate.data);
      break;
    case "developer/message":
    case "system/message":
    case "assistant/message":
    case "tool/result":
      deepFreeze(candidate.data.message);
      break;
    default:
      // SessionEventMap là merge-extensible; event của plugin không mang tin nhắn lõi.
      break;
  }
  return event;
}

/**
 * Tách một event khỏi producer nhưng vẫn giữ tính bất biến sâu cho tin nhắn đã định danh.
 * Nhận: `event` đi qua ranh giới truy vấn hoặc bền vững.
 * Trả: bản sao event đã tách rời, tin nhắn đã kiểm tra và đóng băng sâu.
 */
export function snapshotSessionEvent<T extends SessionEvent>(event: T): T {
  return adoptSessionEvent(structuredClone(event));
}

/**
 * Kiểm tra phong bì event CỐ ĐỊNH sau một lượt materialize JSON duy nhất.
 * Nhận: `value` là event thô từ seed/load và `index` là vị trí của nó trong seed.
 * Trả: không (chỉ kiểm tra).
 * Ném: khi phong bì có khoá lạ; thiếu hoặc sai `type`/`seq`/`time`/`data`/`ignorable`;
 *   hoặc hình dạng LLM hiện hành không đạt.
 */
export function assertSessionEventEnvelope(value: unknown, index: number): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`seed event at index ${index} has an invalid event envelope`);
  }
  const event = value as Record<string, unknown>;
  for (const key in event) {
    switch (key) {
      case "type":
      case "seq":
      case "time":
      case "data":
      case "surfaceOp":
      case "sourceEventSeqs":
      case "ignorable":
        break;
      default:
        throw new Error(`seed event at index ${index} has an invalid event envelope`);
    }
  }
  const type = event["type"];
  const seq = event["seq"];
  const time = event["time"];
  if (typeof type !== "string"
    || typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0 || Object.is(seq, -0)
    || typeof time !== "number" || !Number.isSafeInteger(time)
    || event["data"] === undefined
    || (event["ignorable"] !== undefined && event["ignorable"] !== true)) {
    throw new Error(`seed event at index ${index} has an invalid event envelope`);
  }
  const candidate = event as unknown as SessionEvent;
  validateSessionEventData(candidate, `seed ${type} at index ${index}`);
  switch (type) {
    case "request/header":
    case "developer/message":
    case "system/message":
    case "user/message":
    case "assistant/attempt":
    case "assistant/message":
    case "tool/result":
      assertCurrentLlmShape(candidate, index);
      break;
    default:
      break;
  }
}

/**
 * Từ chối request-header lỗi thời và tin nhắn sai hình dạng ở ranh giới seed/load.
 * Nhận: `event` đã qua kiểm tra phong bì và `index` là vị trí của nó trong seed.
 * Trả: không (chỉ kiểm tra).
 * Ném: khi `request/header` thiếu provider/model; `reasoningEffort`, `adapterDefaults`, `reason`
 *   hoặc `startsSeries` hỏng; hoặc điểm kết của `assistant/attempt`/`assistant/message` sai
 *   `turn`/`step`/`stream`.
 */
export function assertCurrentLlmShape(event: SessionEvent, index: number): void {
  const data: unknown = event["data"];
  const record = typeof data === "object" && data !== null
    ? data as Record<string, unknown>
    : undefined;
  if (event["type"] === "request/header") {
    const headerRecord = record?.["header"] as Record<string, unknown>;
    const config = headerRecord["config"];
    if (!hasProviderModel(config))
      throw new Error(`seed request/header at index ${index} lacks provider/model`);
    const configRecord = config as Record<string, unknown>;
    const reasoningEffort = configRecord["reasoningEffort"];
    if (reasoningEffort !== undefined
      && (typeof reasoningEffort !== "string" || reasoningEffort.length === 0)) {
      throw new Error(`seed request/header at index ${index} has an invalid reasoningEffort`);
    }
    assertAdapterDefaults(headerRecord["adapterDefaults"], configRecord, index);
    const reason = record?.["reason"];
    if (reason !== "initial" && reason !== "resume" && reason !== "change" && reason !== "series") {
      throw new Error(`seed request/header at index ${index} has an invalid reason`);
    }
    if (record?.["startsSeries"] !== undefined && record["startsSeries"] !== true) {
      throw new Error(`seed request/header at index ${index} has an invalid startsSeries marker`);
    }
  }
  const type = event["type"];
  if (type === "assistant/attempt") {
    assertAssistantSettlementShape(record, type, index);
    return;
  }
  if (!isMessageEventType(type))
    return;
  assertMessageEventShape(event, `seed ${type} at index ${index}`);
  if (type === "assistant/message") {
    assertAssistantSettlementShape(record, type, index);
  }
}

/**
 * Kiểm tra các trường mà logic vòng đời của phiên phục hồi dùng TRỰC TIẾP, không phát lại luồng nhúng.
 * Nhận: `data` là payload event, `type` là tên loại (dùng trong thông báo), `index` là vị trí seed.
 * Trả: không (chỉ kiểm tra).
 * Ném: khi `turn`/`step` không phải số nguyên an toàn không âm, hoặc `stream` không phải mảng.
 */
export function assertAssistantSettlementShape(
  data: Record<string, unknown> | undefined,
  type: string,
  index: number,
): void {
  const turn = data?.["turn"];
  const step = data?.["step"];
  if (typeof turn !== "number" || !Number.isSafeInteger(turn) || turn < 0 || Object.is(turn, -0)
    || typeof step !== "number" || !Number.isSafeInteger(step) || step < 0 || Object.is(step, -0)
    || !Array.isArray(data?.["stream"])) {
    throw new Error(`seed ${type} at index ${index} has invalid settlement fields`);
  }
}

/** Tập khoá hợp lệ của marker `adapterDefaults` trong một request header bền vững. */
export const allowedAdapterKeys = new Set(["reasoningEffort", "maxTokens"]);

/**
 * Kiểm tra marker adapter-default nhập từ một request header bền vững.
 * Nhận: `value` là marker (undefined được bỏ qua), `config` là config của header, và
 *   `index` là vị trí seed.
 * Trả: không (chỉ kiểm tra).
 * Ném: khi marker không phải bản ghi; có khoá ngoài {@link allowedAdapterKeys}; có giá trị khác `true`;
 *   hoặc đánh dấu một trường mà `config` không hề đặt.
 */
export function assertAdapterDefaults(
  value: unknown,
  config: Record<string, unknown>,
  index: number,
): void {
  if (value === undefined)
    return;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`seed request/header at index ${index} has invalid adapterDefaults`);
  }
  const defaults = value as Record<string, unknown>;
  if (Object.keys(defaults).some((key) => !allowedAdapterKeys.has(key))
    || Object.values(defaults).some((marker) => marker !== true)
    || defaults["reasoningEffort"] === true && config["reasoningEffort"] === undefined
    || defaults["maxTokens"] === true && config["maxTokens"] === undefined) {
    throw new Error(`seed request/header at index ${index} has invalid adapterDefaults`);
  }
}

/**
 * Cho biết một loại event surface có mang tin nhắn đã định danh hay không.
 * Nhận: `type` — tên loại event.
 * Trả: true cho `developer/message`, `system/message`, `user/message`,
 *   `assistant/message`, `tool/result`.
 */
export function isMessageEventType(type: string): boolean {
  return type === "developer/message" || type === "system/message" || type === "user/message"
    || type === "assistant/message" || type === "tool/result";
}

/** Vai trò BẮT BUỘC của tin nhắn theo từng loại event sinh tin nhắn. */
export const MESSAGE_ROLE_BY_TYPE: Readonly<Record<string, string>> = {
  "system/message": "system",
  "developer/message": "developer",
  "user/message": "user",
  "assistant/message": "assistant",
  "tool/result": "tool",
};

/**
 * Chỉ kiểm tra các bất biến RIÊNG của event cần để phát lại tin nhắn an toàn.
 * Nhận: `event` cần kiểm và `subject` là tiền tố thông báo lỗi.
 * Trả: không (chỉ kiểm tra); event không sinh tin nhắn được bỏ qua.
 * Ném: khi thiếu tin nhắn có `id`; sai vai trò; sai `source` (system-prompt/model/tool);
 *   `content` không phải mảng; hoặc `toolCallId` lệch với `source.callId`.
 */
export function assertMessageEventShape(event: SessionEvent, subject: string): void {
  const type = event["type"];
  if (!isMessageEventType(type))
    return;
  const data: unknown = event["data"];
  const record = typeof data === "object" && data !== null
    ? data as Record<string, unknown>
    : undefined;
  const message = type === "user/message" ? record : record?.["message"];
  if (typeof message !== "object" || message === null) {
    throw new Error(`${subject} lacks an identified message`);
  }
  const messageRecord = message as Record<string, unknown>;
  if (typeof messageRecord["id"] !== "string" || messageRecord["id"] === "") {
    throw new Error(`${subject} lacks an identified message`);
  }
  const expectedRole = MESSAGE_ROLE_BY_TYPE[type];
  if (messageRecord["role"] !== expectedRole) {
    throw new Error(`${subject} message must have role "${expectedRole}"`);
  }
  const source = messageRecord["source"];
  if (typeof source !== "object" || source === null) {
    throw new Error(`${subject} message has invalid source`);
  }
  const sourceRecord = source as Record<string, unknown>;
  if (typeof sourceRecord["kind"] !== "string" || sourceRecord["kind"] === "") {
    throw new Error(`${subject} message has invalid source`);
  }
  if (!Array.isArray(messageRecord["content"])) {
    throw new Error(`${subject} message has invalid content`);
  }
  if (type === "system/message") {
    if (sourceRecord["kind"] !== "system-prompt") {
      throw new Error(`${subject} message must have system-prompt source`);
    }
    return;
  }
  if (type === "assistant/message") {
    if (sourceRecord["kind"] !== "model" || !hasProviderModel(sourceRecord)) {
      throw new Error(`${subject} message must have model source`);
    }
    return;
  }
  if (type !== "tool/result")
    return;
  if (sourceRecord["kind"] !== "tool"
    || typeof sourceRecord["callId"] !== "string"
    || sourceRecord["callId"] === "") {
    throw new Error(`${subject} message must have tool source`);
  }
  if (messageRecord["toolCallId"] !== sourceRecord["callId"]) {
    throw new Error(`${subject} message has mismatched tool call ids`);
  }
}

/**
 * Cho biết một giá trị chưa biết có mang cặp provider/model hiện hành hay không.
 * Nhận: `value` — giá trị cần kiểm.
 * Trả: true khi cả `provider` và `model` là chuỗi khác rỗng.
 */
export function hasProviderModel(value: unknown): boolean {
  if (typeof value !== "object" || value === null)
    return false;
  const pair = value as Record<string, unknown>;
  return typeof pair["provider"] === "string" && pair["provider"].length > 0
    && typeof pair["model"] === "string" && pair["model"].length > 0;
}

/** Callback của MỘT listener Cordis đã chốt cho một lượt phát (đã bị ràng buộc `this`). */
type SessionEventListener = (...args: unknown[]) => unknown;

/**
 * Chốt danh sách listener cho một lượt phát, kèm các phép kiểm dispatch nội bộ của Cordis.
 * Nhận: `ctx` là context phát và `args` là đối số thô của lượt phát (phần tử đầu là carrier).
 * Trả: mảng callback khớp, đã lọc theo scope.
 */
export function collectSessionCallbacks(ctx: Context, args: unknown[]): SessionEventListener[] {
  return [...ctx.events.dispatch("emit", args)];
}

/**
 * Gọi MỘT danh sách listener quan sát đã chốt, bọc lỗi theo TỪNG listener.
 * Nhận: `ctx` là context phát, `name` là tên sự kiện, `id` là id phiên (cho thông báo),
 *   `args` là đối số lượt phát, `callbacks` là danh sách đã chốt.
 * Trả: không; lỗi đồng bộ được ghi log, promise bị từ chối được ghi log thay vì thành unhandled.
 */
export function invokeContainedSessionObservers(
  ctx: Context,
  name: string,
  id: SessionId,
  args: unknown[],
  callbacks: readonly SessionEventListener[],
): void {
  for (const callback of callbacks) {
    try {
      const returned = callback(...args);
      void Promise.resolve(returned).catch((error: unknown) => {
        ctx.logger.warn(`session "${id}": ${name} listener rejected: ${String(error)}`);
      });
    }
    catch (error) {
      ctx.logger.warn(`session "${id}": ${name} listener threw: ${String(error)}`);
    }
  }
}

/**
 * Một phần tử của bảng gắn kết: một phiên ĐÃ vào store cùng các hook công bố của nó. Hình dạng này soi
 * ĐÚNG `SessionEntry` của sổ phiên (./store.ts) — hai vùng phải dùng CHUNG một bảng yếu.
 */
export interface SessionAttachment {
  /** Id phiên — khoá của sổ. */
  readonly id: SessionId;
  /** Phiên đang sống mà mục này đại diện. */
  readonly session: Session;
  /** Carrier phạm vi BẤT BIẾN dựng một lần trong `enter` (`dsh-scope`). */
  readonly carrier: Scoped<Session>;
  /** Context dùng để phát `session/event` · `session/created` · `session/disposed` · `session/flush`. */
  readonly emitCtx: Context;
  /** Đã phát `session/created` chưa. */
  announced: boolean;
  /** Đang phát `session/created` (cờ chống tái nhập). */
  announcing: boolean;
  /** Đang phát `session/event` cho một append (cờ chống tái nhập). */
  appending: boolean;
  /** Yêu cầu gỡ ĐÃ tới trong lúc đang phát; gỡ sau khi lần phát đó khép lại. */
  detachRequested: boolean;
  /** Gỡ mục này khỏi sổ + bỏ đính kèm, kèm phát `session/disposed` nếu đã announce. */
  readonly detach: () => void;
}

/**
 * Bảng gắn kết phiên sống → phần tử store của nó. Chỉ mục đích nội bộ của row: nhờ nó `Session` không
 * phải phụ thuộc store ở bề mặt công khai. MỘT bảng cho cả tiến trình — đường append của `Session`
 * và sổ phiên phải cùng đọc/ghi đúng bảng này.
 */
export const attachments = new WeakMap<Session, SessionAttachment>();

/**
 * Ngữ pháp của một {@link PluginRecordType}: `plugin:` rồi các đoạn ngăn bởi dấu chéo; mỗi đoạn gồm chữ
 * thường, chữ số, dấu chấm, gạch dưới và gạch nối, bắt đầu bằng chữ hoặc số.
 */
export const PLUGIN_RECORD_TYPE = /^plugin:[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/u;

/**
 * Cho biết một tên loại event có theo ngữ pháp bản ghi plugin hay không.
 * Nhận: `type` — tên loại event.
 * Trả: true khi tên là một {@link PluginRecordType}.
 */
export function isPluginRecordType(type: string): type is PluginRecordType {
  return PLUGIN_RECORD_TYPE.test(type);
}

/**
 * Định kiểu một bản ghi plugin ĐÃ DỰNG thành event log sau khi kiểm tên loại theo ngữ pháp bản ghi plugin.
 * Nhận: `value` — phong bì bản ghi đã đóng băng do `Session` dựng.
 * Trả: không.
 * Ném: khi tên loại nằm ngoài ngữ pháp `plugin:`.
 */
export function assertPluginRecordEvent(value: { readonly type: string }): void {
  const { type } = value;
  if (!isPluginRecordType(type)) {
    throw new Error(`plugin record type "${type}" must be "plugin:" followed by lowercase slash-separated segments`);
  }
}

/**
 * Nối MỘT bản ghi plugin thử nghiệm: một event được đánh dấu `ignorable` với loại khai trong
 * {@link PluginRecordMap}, nằm ngoài {@link SessionEventMap}. Trình đọc không nhận ra loại thì GIỮ và BỎ QUA
 * bản ghi; bản ghi không bao giờ vào surface mà mô hình thấy, còn fork và resume mang nó theo cùng phần còn
 * lại của log. Di trú định dạng giữ bản ghi theo nỗ lực tốt nhất, nên bản ghi chứa trạng thái riêng của
 * plugin mà chủ của nó có thể mất.
 *
 * Bản gốc khai `let commitPluginRecord` NGAY trong module này; bản viết lại tách lớp `Session`
 * sang ./session.ts nên binding sống ấy nằm ở đó (khối `static` của lớp gán nó MỘT lần) và vùng này
 * chỉ ĐỌC nó — đúng một binding cho cả tiến trình, không cần cửa gắn thêm.
 *
 * Chỉ mã sản phẩm dưới `packages/experimental/` mới được gọi hàm này. Đọc lại bằng {@link pluginRecordOf}.
 * Nhận: `session` — phiên nhận bản ghi; `type` — tên loại đã khai; `data` — payload JSON
 *   (được chụp lại trước khi vào log).
 * Trả: số thứ tự của bản ghi đã chốt.
 * Ném: khi `type` ngoài ngữ pháp, `data` không tuần tự hoá JSON không mất mát, hoặc lượt gọi xen vào
 *   lượt công bố của lần nối khác; bản ghi bị từ chối không đổi log.
 */
export function appendPluginRecord<K extends Extract<keyof PluginRecordMap, PluginRecordType>>(
  session: Session,
  type: K,
  data: PluginRecordMap[K],
): SessionSeq {
  return commitPluginRecord!(session, type, data);
}

/**
 * Đọc một event đã chốt như một bản ghi plugin. Cạnh định dạng V3→V4 cũng đổi tên mọi event V3 ignorable
 * không nhận ra vào không gian `plugin:`, nên chủ sở hữu đặt tên bản ghi theo gói của mình và tự kiểm
 * `data`.
 * Nhận: `event` — event đã chốt bất kỳ, sống hay phục hồi.
 * Trả: bản ghi, hoặc undefined khi event không phải event ignorable có loại theo ngữ pháp bản ghi plugin.
 */
export function pluginRecordOf(event: SessionEvent): PluginRecord | undefined {
  const type = event.type;
  if (event.ignorable !== true || !isPluginRecordType(type))
    return undefined;
  return { type, seq: event.seq, time: event.time, data: event.data };
}