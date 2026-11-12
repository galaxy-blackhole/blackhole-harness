/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của package session-projection: xuất ĐÚNG bề mặt bản gốc
 *      (`SessionProjectionRegistry` + `default`), các kiểu của seam, và khai merge
 *      `ctx.sessionProjections` vào Context cordis. Kiểu/hằng dùng chung nằm ở `./types.ts` + `./brand.ts`.
 */

export { SessionProjectionRegistry, SessionProjectionRegistry as default } from "./registry.ts";
export type {
  ProjectedSession,
  ProjectionChangeListener,
  ProjectionCheckpoint,
  ProjectionCheckpointRow,
  ProjectionDefinition,
  ProjectionSchema,
  ProjectionSnapshot,
  ProjectionWire,
  SessionEventLike,
  SessionHeaderLike,
  SessionProjectionMap,
  SessionProjectionStateMap,
} from "./types.ts";
export type { SessionLogOffset, SessionSeq, SessionSeqCursor } from "./brand.ts";

// ⚠️ 18/10/2026 (task-28) — KHÔNG khai `declare module "@deepseek-ai/cordis"` ở đây nữa.
//   Lý do ĐO ĐƯỢC: gói stock `@deepseek-ai/dsh-session-projection/lib/types/index.d.ts:25` đã khai
//   `interface Context { sessionProjections: SessionProjectionRegistry }` (kiểu của CHÍNH nó). Kernel
//   vẫn là DSH ở bước 2, nên mọi tệp kéo `.d.ts` stock vào chương trình tsc (llm-retry · session-title ·
//   session-projection-cache · …) sẽ gặp TS2717: hai khai báo cùng tên nhưng KHÁC kiểu. Augmentation là
//   toàn cục nên không thể 'thắng' bằng thứ tự — đúng luật 000d: gói khai seam theo CẤU TRÚC, không
//   augment. Bên tiêu thụ đọc `ctx.get("sessionProjections")` hoặc seam cấu trúc của chính nó.
