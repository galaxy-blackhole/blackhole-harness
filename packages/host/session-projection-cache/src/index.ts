/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của package session-projection-cache: xuất ĐÚNG tập export của bản gốc
 *      (`Config` · `SessionProjectionCache` + `default` · bốn giá trị của miền) và khai merge
 *      `ctx.sessionProjectionCache` vào Context cordis. Thân dịch vụ nằm ở ./service.ts, miền ở ./spec.ts.
 */

import type { SessionProjectionCache } from "./service.ts";

export { Config, SessionProjectionCache } from "./service.ts";
export { SessionProjectionCache as default } from "./service.ts";
export { checkpointIdentity, checkpointRecord, checkpointRow, projectionCacheDomainSpec } from "./spec.ts";
export type { CheckpointIdentity, CheckpointRecord } from "./spec.ts";

declare module "@deepseek-ai/cordis" {
  /** Context cordis của kernel, mở rộng thêm dịch vụ `sessionProjectionCache` do package này cấp. */
  interface Context {
    /** Cache chiếu phiên bền vững (bản gốc khai y hệt trong `lib/types/index.d.ts`). */
    sessionProjectionCache: SessionProjectionCache;
  }
}
