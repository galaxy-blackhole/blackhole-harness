/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của package authorization: xuất ĐÚNG bề mặt bản gốc — `AuthorizationError` ·
 *      `AuthorizationDeclinedError` · `AuthorizationService` (+ `default`); các kiểu chỉ tồn tại ở
 *      tầng kiểu nên không có mặt trong artifact. Mọi thứ khác của gói là NỘI BỘ (không xuất ở đây).
 */

export { AuthorizationDeclinedError, AuthorizationError } from "./errors.ts";
export type {
  AuthorizationEntry,
  AuthorizationFlow,
  AuthorizationInteraction,
  AuthorizationMethod,
  AuthorizationNotice,
  AuthorizationOutcome,
  AuthorizationPrompt,
  AuthorizationPromptOption,
  AuthorizationRequest,
  AuthorizationSession,
  AuthorizationSettlement,
  AuthorizationStatus,
} from "./types.ts";
export { default, AuthorizationService } from "./service.ts";
