/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của @galaxy-blackhole/gbh-session-title: dịch vụ tiêu đề phiên (`ctx.sessionTitle`),
 *      phép gộp bất biến, ba hàm chuẩn hoá văn bản, và đơn vị chiếu `title`. Tập export ở đây KHỚP
 *      TỪNG TÊN với `lib/index.js` của bản gốc (9 tên, kể cả `default`) — đó là BỀ MẶT SERVICE của
 *      một row HOST; thiếu một tên là gói khác gọi vào sẽ hỏng lúc chạy mà cổng vẫn xanh.
 *      Bản gốc: @deepseek-ai/dsh-session-title 0.2.1-alpha.4 — xem README.md (G4).
 */

// GIÁ TRỊ — chín tên, đúng tập của bản gốc.
export { SessionTitleProviderId } from "./brand.ts";
export { fallbackSessionTitle, normalizeSessionTitle, truncateTitleUtf8 } from "./normalize.ts";
export { SessionTitleInvalidError, foldSessionTitle } from "./snapshot.ts";
export { titleProjectionDefinition } from "./projection.ts";
export { SessionTitleService } from "./service.ts";
export { SessionTitleService as default } from "./service.ts";

// KIỂU — chỉ tồn tại lúc biên dịch, không vào tập export lúc chạy.
export type {
  Config,
  SessionTitleAutomaticMode,
  SessionTitleEventData,
  SessionTitleModelIdentity,
  SessionTitleProvider,
  SessionTitleProviderRequest,
  SessionTitleProviderResult,
  SessionTitleSnapshot,
  SessionTitleSource,
  SessionTitleUserMessage,
  TitleProjection,
} from "./types.ts";
