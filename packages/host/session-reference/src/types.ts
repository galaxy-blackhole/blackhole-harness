/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Điểm vào KIỂU của gói — tương ứng subpath `./types` mà bản gốc khai trong package.json
 *      (`@deepseek-ai/dsh-session-reference/types` → `lib/types/types.{d.ts,js}`): 6 interface wire dùng chung
 *      giữa service · uri · spill · typert. Bản port đặt chúng ở module hẹp nhất dùng chúng, tệp này gom lại
 *      ĐÚNG mặt kiểu của stock để consumer đổi alias không gãy (review-2/dev-6: nợ subpath `./types`).
 */

export type { SessionReferenceInput } from "./uri.ts";
export type {
  PreparedReferencedMessage,
  SessionReferenceCandidate,
  SessionReferenceMentionCandidate,
  SessionReferenceSource,
} from "./service.ts";
export type { ReferencedConversationItem } from "./spill.ts";
