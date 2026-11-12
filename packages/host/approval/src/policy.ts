/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chính sách duyệt của MỘT phiên: từ vựng hợp lệ, đường ghi BỀN duy nhất
 *      (`approval/policy`), phép đọc ghi đè cuối, và điều kiện TIÊN QUYẾT "đang trong một lượt mở"
 *      của `approval.request()`
 */

import { SessionSeq, type Session } from "@deepseek-ai/dsh-session";

import type { ApprovalPolicy } from "./types.ts";

/** Mọi {@link ApprovalPolicy}, để quảng bá lựa chọn và kiểm giá trị chính sách KHÔNG TIN CẬY lúc chạy. */
export const APPROVAL_POLICIES: readonly ApprovalPolicy[] = ["ask", "never"];

/**
 * Ghi biểu diễn BỀN duy nhất của một ghi đè chính sách phiên. Giá trị không hợp lệ NÉM TRƯỚC khi
 * nhật ký đổi; người đọc gấp giá trị mới ở mỗi lần đọc.
 * Nhận: `session` — phiên sở hữu ghi đè; `policy` — chính sách có hiệu lực tới lượt chuyển kế tiếp.
 * Trả: không (ghi đúng MỘT sự kiện `approval/policy`).
 */
export function setApprovalPolicy(session: Session, policy: ApprovalPolicy): void {
  if (!APPROVAL_POLICIES.includes(policy)) throw new TypeError('approval policy must be one of "ask" or "never"');
  session.append("approval/policy", { policy });
}

/**
 * Nhật ký có đang nằm trong một LƯỢT MỞ không (một `turn/start` chưa bị `turn/end` đóng) — điều
 * kiện tiên quyết của `approval.request()`. Cặp kiểm toán phải được BAO trong lượt: lượt là ranh
 * giới commit/replay của nhật ký bền, nên một sự kiện trần nằm giữa hai lượt không phân biệt được
 * với đuôi sự cố và bị bỏ im lặng khi nạp lại.
 * Nhận: `session` — phiên có nhật ký cần soát.
 * Trả: `true` khi đang trong lượt mở, `false` khi đứng giữa hai lượt.
 */
export function hasOpenTurn(session: Session): boolean {
  for (let seq = session.seq - 1; seq >= 0; seq -= 1) {
    const type = session.eventAt(SessionSeq(seq))?.type;
    if (type === "turn/start") return true;
    if (type === "turn/end") return false;
  }
  return false;
}

/**
 * Đọc ghi đè của phiên mà KHÔNG áp chính sách mặc định đã cấu hình: sự kiện `approval/policy`
 * CUỐI CÙNG trong nhật ký.
 * Nhận: `session` — phiên có nhật ký cấp ghi đè.
 * Trả: chính sách ghi log cuối cùng, hoặc `undefined` khi chưa có lần chuyển nào.
 */
export function policyOverrideOf(session: Session): ApprovalPolicy | undefined {
  for (let seq = session.seq - 1; seq >= 0; seq -= 1) {
    const event = session.eventAt(SessionSeq(seq));
    if (event?.type === "approval/policy") return event.data.policy;
  }
  return undefined;
}
