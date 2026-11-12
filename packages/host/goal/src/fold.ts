/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phép gộp phát lại THUẦN và bộ giải mã NGHIÊM cho các thay đổi goal bền: mọi quy tắc chuyển
 *      revision, giữ bộ đếm, và khớp vòng đã nhận đều được kiểm ở đây — hỏng thì ném, không im lặng.
 *      Viết lại theo hành vi của lib/types/fold.js trong @deepseek-ai/dsh-goal.
 */

import { GoalId } from "./runtime.ts";
import type {
  FoldedGoal,
  GoalBlockReason,
  GoalChangeMeta,
  GoalFoldState,
  GoalMessageSource,
  GoalOperation,
  GoalRef,
  GoalSnapshot,
  GoalSourceLike,
  SessionEventLike,
} from "./types.ts";

/** Động từ ghi một ảnh chụp TOÀN PHẦN (mọi động từ trừ `clear`). */
const SNAPSHOT_OPERATIONS = new Set<string>(["create", "edit", "pause", "resume", "complete", "block"]);

/** Bốn pha vòng đời hợp lệ. */
const PHASES = new Set<string>(["active", "paused", "blocked", "complete"]);

/**
 * Dựng bộ tích luỹ phát lại rỗng.
 * Nhận: không.
 * Trả: trạng thái không có goal hiện tại và không có tham chiếu trước.
 */
export function emptyGoalFoldState(): GoalFoldState {
  return {
    goal: undefined,
    roundsStarted: 0,
    createdAt: undefined,
    updatedAt: undefined,
    lastRef: undefined,
    seenGoalIds: new Set<GoalId>(),
  };
}

/**
 * Một giá trị có phải bản ghi JSON (không phải mảng) không.
 * Nhận: `value` — giá trị bất kỳ.
 * Trả: true khi là object khác null và không phải mảng.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Bắt buộc một số nguyên an toàn DƯƠNG.
 * Nhận: `value` — giá trị cần kiểm; `field` — tên trường cho thông điệp lỗi.
 * Trả: chính giá trị đã kiểm.
 */
function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new Error(`goal change ${field} must be a positive safe integer`);
  return value;
}

/**
 * Bắt buộc một số nguyên an toàn KHÔNG ÂM.
 * Nhận: `value` — giá trị cần kiểm; `field` — tên trường cho thông điệp lỗi.
 * Trả: chính giá trị đã kiểm.
 */
function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`goal change ${field} must be a non-negative safe integer`);
  return value;
}

/**
 * Giải mã một lý do chặn chuẩn tắc.
 * Nhận: `value` — giá trị thô.
 * Trả: `{ code, message }` đã kiểm (đúng hai trường, code lower-kebab-case, message đã chuẩn hoá).
 */
function decodeBlockReason(value: unknown): GoalBlockReason {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "code,message") throw new Error("goal change goal.blockedReason must have exactly code and message fields");
  if (typeof value["code"] !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value["code"])) throw new Error("goal change goal.blockedReason.code must be lower-kebab-case");
  if (typeof value["message"] !== "string" || value["message"].trim().length === 0 || value["message"] !== value["message"].trim()) throw new Error("goal change goal.blockedReason.message must be non-empty and normalized");
  return {
    code: value["code"],
    message: value["message"],
  };
}

/**
 * Giải mã và kiểm MỘT ảnh chụp goal.
 * Nhận: `value` — giá trị thô.
 * Trả: ảnh chụp đã kiểm (đúng bộ trường theo pha, revision/trần dương).
 */
function decodeSnapshot(value: unknown): GoalSnapshot {
  if (!isRecord(value)) throw new Error("goal change goal must be a record");
  if (typeof value["id"] !== "string" || value["id"].length === 0) throw new Error("goal change goal.id must be a non-empty string");
  if (typeof value["objective"] !== "string" || value["objective"].trim().length === 0 || value["objective"] !== value["objective"].trim()) throw new Error("goal change goal.objective must be non-empty and normalized");
  if (typeof value["phase"] !== "string" || !PHASES.has(value["phase"])) throw new Error("goal change goal.phase is invalid");
  const phase = value["phase"];
  const expectedKeys = phase === "blocked" ? "blockedReason,id,maxGoalRounds,objective,phase,revision" : "id,maxGoalRounds,objective,phase,revision";
  if (Object.keys(value).sort().join(",") !== expectedKeys) throw new Error(`goal change goal for phase ${phase} must have exactly ${expectedKeys} fields`);
  return {
    id: GoalId(value["id"]),
    revision: positiveInteger(value["revision"], "goal.revision"),
    objective: value["objective"],
    phase: phase as GoalSnapshot["phase"],
    maxGoalRounds: positiveInteger(value["maxGoalRounds"], "goal.maxGoalRounds"),
    ...(phase === "blocked" ? { blockedReason: decodeBlockReason(value["blockedReason"]) } : {}),
  };
}

/**
 * Giải mã và kiểm MỘT tham chiếu revision.
 * Nhận: `value` — giá trị thô.
 * Trả: `{ id, revision }` đã kiểm.
 */
function decodeRef(value: unknown): GoalRef {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "id,revision") throw new Error("goal clear tombstone must have exactly id and revision fields");
  if (typeof value["id"] !== "string" || value["id"].length === 0) throw new Error("goal clear tombstone id must be a non-empty string");
  return {
    id: GoalId(value["id"]),
    revision: positiveInteger(value["revision"], "cleared.revision"),
  };
}

/**
 * Giải mã một giá trị TỰ KHAI là thay đổi goal. Giá trị không liên quan trả `undefined`;
 * thay đổi goal hỏng làm phát lại NÉM (không im lặng).
 * Nhận: `value` — thay đổi nguồn cần xét.
 * Trả: thay đổi goal đã kiểm, hoặc `undefined` khi là loại giá trị khác.
 */
export function decodeGoalChange(value: unknown): GoalChangeMeta | undefined {
  if (!isRecord(value) || value["kind"] !== "goal/change") return undefined;
  if (value["version"] !== 1) throw new Error(`unsupported goal change version ${String(value["version"])}`);
  if (value["operation"] === "clear") {
    const allowed = ["cleared", "clearedAt", "kind", "operation", "version"];
    if (Object.keys(value).sort().join(",") !== allowed.sort().join(",")) throw new Error(`goal clear change must have exactly ${allowed.sort().join(",")} fields`);
    return {
      kind: "goal/change",
      version: 1,
      operation: "clear",
      cleared: decodeRef(value["cleared"]),
      clearedAt: nonNegativeInteger(value["clearedAt"], "clearedAt"),
    };
  }
  if (typeof value["operation"] !== "string" || !SNAPSHOT_OPERATIONS.has(value["operation"])) throw new Error("goal change operation is invalid");
  const allowed = ["createdAt", "goal", "kind", "operation", "roundsStarted", "updatedAt", "version"];
  if (Object.keys(value).sort().join(",") !== allowed.sort().join(",")) throw new Error(`goal snapshot change must have exactly ${allowed.sort().join(",")} fields`);
  const createdAt = nonNegativeInteger(value["createdAt"], "createdAt");
  const updatedAt = nonNegativeInteger(value["updatedAt"], "updatedAt");
  if (updatedAt < createdAt) throw new Error("goal change updatedAt cannot precede createdAt");
  return {
    kind: "goal/change",
    version: 1,
    operation: value["operation"] as Exclude<GoalOperation, "clear">,
    goal: decodeSnapshot(value["goal"]),
    roundsStarted: nonNegativeInteger(value["roundsStarted"], "roundsStarted"),
    createdAt,
    updatedAt,
  };
}

/**
 * Thu hẹp nguồn message về nguồn vòng goal hợp lệ, hoặc `undefined`.
 * Nhận: `source` — nguồn message bất kỳ của sự kiện `user/message`.
 * Trả: chính nguồn đó khi là vòng goal hợp lệ; `undefined` khi là loại nguồn khác.
 */
function goalSource(source: GoalSourceLike | null | undefined): GoalMessageSource | undefined {
  if ((source as GoalSourceLike).kind !== "goal") return undefined;
  const candidate = source as GoalSourceLike;
  if (typeof candidate.goalId !== "string" || candidate.goalId.length === 0 || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1 || !Number.isSafeInteger(candidate.round) || (candidate.round as number) < 1) throw new Error("goal message source is invalid");
  return candidate as GoalMessageSource;
}

/**
 * Bắt buộc hai ảnh chụp giữ nguyên các trường mà CHỈ `edit` được thay.
 * Nhận: ảnh chụp hiện tại, ảnh chụp kế, và động từ đang xét.
 * Trả: không; ném khi mục tiêu hoặc trần vòng bị đổi.
 */
function requireSameDefinition(current: GoalSnapshot, next: GoalSnapshot, operation: string): void {
  if (next.objective !== current.objective || next.maxGoalRounds !== current.maxGoalRounds) throw new Error(`goal ${operation} cannot change objective or maxGoalRounds`);
}

/**
 * Bắt buộc ảnh chụp kế là ĐÚNG revision kế của goal hiện tại.
 * Nhận: ảnh chụp hiện tại, ảnh chụp kế, và động từ đang xét.
 * Trả: không; ném khi danh tính hoặc bước revision sai.
 */
function requireNextRevision(current: GoalSnapshot, next: GoalRef, operation: string): void {
  if (next.id !== current.id || next.revision !== current.revision + 1) throw new Error(`goal ${operation} must advance the current goal by one revision`);
}

/**
 * Kiểm MỘT chuyển ảnh chụp không-phải-create so với phép chiếu trước đó.
 * Nhận: `state` — trạng thái gộp; `change` — thay đổi đã giải mã; `current` — ảnh chụp hiện tại.
 * Trả: không; ném khi chuyển pha / bộ đếm / mốc thời gian sai.
 */
function validateSnapshotTransition(state: GoalFoldState, change: Exclude<GoalChangeMeta, { operation: "clear" }>, current: GoalSnapshot): void {
  const next = change.goal;
  requireNextRevision(current, next, change.operation);
  if (state.updatedAt === undefined) throw new Error("current goal fold lacks updatedAt");
  if (change.createdAt !== state.createdAt || change.updatedAt < state.updatedAt || change.roundsStarted !== state.roundsStarted) throw new Error(`goal ${change.operation} does not preserve the current counters and timestamps`);
  switch (change.operation) {
    case "edit":
      if (next.phase !== current.phase || JSON.stringify(next.blockedReason) !== JSON.stringify(current.blockedReason)) throw new Error("goal edit cannot change phase or blocked reason");
      break;
    case "pause":
      requireSameDefinition(current, next, change.operation);
      if (current.phase !== "active" || next.phase !== "paused") throw new Error("goal pause has an invalid phase transition");
      break;
    case "resume":
      requireSameDefinition(current, next, change.operation);
      if (!new Set(["active", "paused", "blocked"]).has(current.phase) || next.phase !== "active" || state.roundsStarted >= next.maxGoalRounds) throw new Error("goal resume has an invalid phase transition or exhausted round budget");
      break;
    case "complete":
      requireSameDefinition(current, next, change.operation);
      if (current.phase === "complete" || next.phase !== "complete") throw new Error("goal complete has an invalid phase transition");
      break;
    case "block":
      requireSameDefinition(current, next, change.operation);
      if (current.phase !== "active" || next.phase !== "blocked") throw new Error("goal block has an invalid phase transition");
      break;
    case "create":
      throw new Error("goal create cannot be validated as a current-goal transition");
    default:
      throw new Error("unknown goal snapshot operation");
  }
}

/**
 * Đọc danh tính revision mà một thay đổi mang theo.
 * Nhận: `change` — thay đổi goal đã giải mã.
 * Trả: tham chiếu ổn định dùng để đối chiếu thay đổi bị hoãn với sự kiện log của nó.
 */
export function goalChangeRef(change: GoalChangeMeta): GoalRef {
  return change.operation === "clear" ? change.cleared : { id: change.goal.id, revision: change.goal.revision };
}

/**
 * Kiểm và áp MỘT thay đổi đã giải mã lên bộ tích luỹ đang sửa.
 * Nhận: `state` — phép chiếu bền phía trước; `change` — ảnh chụp đầy đủ hoặc tombstone clear.
 * Trả: không; cập nhật `state` tại chỗ.
 */
function applyGoalChange(state: GoalFoldState, change: GoalChangeMeta): void {
  const ref = goalChangeRef(change);
  if (change.operation === "clear") {
    const current = state.goal;
    if (current === undefined) throw new Error("goal clear requires a current goal");
    requireNextRevision(current, change.cleared, change.operation);
    if (state.updatedAt === undefined) throw new Error("current goal fold lacks updatedAt");
    if (change.clearedAt < state.updatedAt) throw new Error("goal clear timestamp cannot precede the current goal update");
    state.goal = undefined;
    state.roundsStarted = 0;
    state.createdAt = undefined;
    state.updatedAt = undefined;
    state.lastRef = ref;
    return;
  }
  if (change.operation === "create") {
    if (change.goal.revision !== 1 || change.goal.phase !== "active" || change.roundsStarted !== 0 || (state.goal !== undefined && state.goal.phase !== "complete") || state.seenGoalIds.has(change.goal.id)) throw new Error("goal create requires a fresh active revision-one goal with zero rounds");
    state.seenGoalIds.add(change.goal.id);
  } else {
    const current = state.goal;
    if (current === undefined) throw new Error(`goal ${change.operation} requires a current goal`);
    validateSnapshotTransition(state, change, current);
  }
  state.goal = change.goal;
  state.roundsStarted = change.roundsStarted;
  state.createdAt = change.createdAt;
  state.updatedAt = change.updatedAt;
  state.lastRef = ref;
}

/**
 * Áp MỘT sự kiện phiên lên phép gộp goal NGHIÊM.
 * Nhận: `state` — bộ tích luỹ đang sửa; `event` — sự kiện kế tiếp theo thứ tự.
 * Trả: không; ném khi sự kiện hỏng hoặc vòng không phải vòng kế được nhận.
 */
function applyGoalEvent(state: GoalFoldState, event: SessionEventLike): void {
  if (event.type === "goal/change") {
    const change = decodeGoalChange(event.data);
    if (change === undefined) throw new Error(`goal change at session event ${event.seq} has an invalid kind`);
    applyGoalChange(state, change);
    return;
  }
  if (event.type === "user/message") {
    const source = goalSource(event.data.source);
    if (source === undefined) return;
    const current = state.goal;
    if (current === undefined || current.phase !== "active" || source.goalId !== current.id || source.revision !== current.revision || source.round !== state.roundsStarted + 1 || source.round > current.maxGoalRounds) throw new Error(`goal round at session event ${event.seq} is not the next admitted round of the active goal`);
    state.roundsStarted = source.round;
  }
}

/**
 * Gộp trạng thái goal hiện tại từ MỘT log sự kiện phiên liền mạch.
 * Nhận: `events` — sự kiện phiên theo thứ tự `seq`.
 * Trả: phép chiếu bền MỚI; quyền tự động cố ý vắng mặt.
 */
export function foldGoal(events: readonly SessionEventLike[]): FoldedGoal {
  const state = emptyGoalFoldState();
  for (const event of events) applyGoalEvent(state, event);
  return {
    ...(state.goal === undefined ? {} : { goal: { ...state.goal } }),
    roundsStarted: state.roundsStarted,
    ...(state.createdAt === undefined ? {} : { createdAt: state.createdAt }),
    ...(state.updatedAt === undefined ? {} : { updatedAt: state.updatedAt }),
    ...(state.lastRef === undefined ? {} : { lastRef: { ...state.lastRef } }),
  };
}

export { applyGoalEvent };
