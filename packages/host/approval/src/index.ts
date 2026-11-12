/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của package approval: xuất ĐÚNG bề mặt bản gốc — `APPROVAL_POLICIES` ·
 *      `ApprovalRequestId` · `ApprovalService` (+ `default`) · `setApprovalPolicy`; các kiểu chỉ
 *      tồn tại ở tầng kiểu. Mọi thứ khác của gói là NỘI BỘ (không xuất ở đây)
 */

export { ApprovalRequestId } from "./types.ts";
export type {
  ApprovalOutcome,
  ApprovalPolicy,
  ApprovalRequest,
  ApprovalRequestEvent,
  Config,
} from "./types.ts";
export { APPROVAL_POLICIES, setApprovalPolicy } from "./policy.ts";
export { default, ApprovalService } from "./service.ts";
