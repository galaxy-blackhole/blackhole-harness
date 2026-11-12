/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Điểm vào của package session: xuất ĐÚNG bề mặt runtime của bản gốc — nguyên văn câu
 *      `export { … }` cuối `lib/index.js` của `@deepseek-ai/dsh-session` (30 tên, gồm `default`),
 *      mỗi tên lấy từ đúng module đã port nó.
 */

// Nguồn: câu export cuối lib/index.js (dòng 2052) của @deepseek-ai/dsh-session 0.2.1-alpha.4.
// Từng tên giữ NGUYÊN VĂN, lấy từ module sở hữu nó trong bản port; `SessionStore` xuất kèm alias
// `default` đúng như bản gốc (`export default SessionStore`).
//   · known-event-types.ts · types.ts · preparation.ts · repair.ts · fork.ts · request-header.ts
//     · seq-ranges.ts · surface.ts  — mỗi module một nhóm, y bản gốc.
//   · session.ts — Session + SessionForkError (nguồn gốc: cùng module index của stock).
//   · events.ts  — adoptSessionEvent · appendPluginRecord · pluginRecordOf · snapshotSessionEvent
//                  (bốn helper nằm cùng module index của stock, tách sang events.ts ở bản port).
//   · store.ts   — SessionStore (kèm alias default).

export { KNOWN_SESSION_EVENT_TYPES } from "./known-event-types.ts";
// R5 (review-2, 08/11/2026): MẶT KIỂU Ở ENTRY — stock `lib/types/index.d.ts:17` re-export TOÀN BỘ `types.ts` nên consumer
// (session-reference/src/service.ts:22 · projection.ts:15 · spill.ts:11 … ~40 điểm import) dùng được SessionHeader ·
// OptionalSessionSeq · SessionEvent … Bản port trước chỉ xuất 4 giá trị ⇒ thêm lại ĐÚNG mặt kiểu của stock.
// Thuần CỘNG THÊM: không đổi mặt runtime (30 tên runtime giữ nguyên).
export * from "./types.ts";
export { SessionPreparation } from "./preparation.ts";
export type { SessionPreparationOptions } from "./preparation.ts";
export type {
  AssistantMessage,
  DeveloperMessage,
  SystemMessage,
  ToolResultMessage,
  UserMessage,
} from "@deepseek-ai/dsh-llm";
export type {
  SessionMessageProjection,
  SessionMessageProjectionContext,
  SessionSurface,
  SurfaceFoldReplacement,
  SurfaceFoldResult,
} from "./surface.ts";
export { Session, SessionForkError } from "./session.ts";
export type { SessionForkErrorCode } from "./session.ts";
export type { SessionForkSource } from "./store.ts";
export {
  adoptSessionEvent,
  appendPluginRecord,
  pluginRecordOf,
  snapshotSessionEvent,
} from "./events.ts";
export { SessionStore, SessionStore as default } from "./store.ts";
export { TOOL_NOT_STARTED, TOOL_OUTCOME_UNKNOWN, ToolCallRecovery, interruptedTurnClosers } from "./repair.ts";
export { buildForkSeed } from "./fork.ts";
export { canonicalHeader, foldRequestHeader, headerEquals } from "./request-header.ts";
export { decodeSeqRanges, encodeSeqRanges } from "./seq-ranges.ts";
export {
  deriveEventMessage,
  foldSurface,
  isAppendSurfaceEvent,
  isReplacementSurfaceEvent,
  isSurfaceEligibleType,
  isSurfaceEvent,
} from "./surface.ts";