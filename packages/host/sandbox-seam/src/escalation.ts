/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng + nghi thức escalation dùng CHUNG cho mọi họ công cụ cưỡng chế sandbox: bậc THẲNG RỘNG HƠN,
 *      kiểm cặp tham số, marker từ chối/gợi ý hướng mô hình, và approveEscalation — chuỗi đóng-cửa-khi-hỏng
 *      CÓ THỨ TỰ, giải một yêu cầu sandbox_permissions qua kênh duyệt NGƯỜI DÙNG trước khi chạy — port 1:1
 */

import { assertNever } from "@deepseek-ai/dsh-util-values";

import type { SandboxMode } from "./types.ts";

/**
 * Bảng THẲNG RỘNG HƠN: chế độ hiệu lực (khoá) được escalate LÊN đâu. Kiểm lúc CHẠY, không bao giờ nướng
 * vào schema công cụ — enum của schema là {@link ESCALATION_TARGETS}, vì schema là toàn cục registry còn
 * chế độ hiệu lực là sự thật theo TỪNG lượt gọi.
 */
export const WIDER_MODES: Record<string, readonly SandboxMode[]> = {
  "read-only": ["workspace-write", "danger-full-access"],
  "workspace-write": ["danger-full-access"],
};

/**
 * Từ vựng ĐÓNG của đích escalation — mọi chế độ một lượt gọi có thể escalate TỚI (`read-only` là sàn;
 * không gì escalate về nó). Quảng cáo đủ mọi chế độ mỗi khi năng lực đã mount có cầm giữ: cắt enum xuống
 * chỉ các chế độ rộng hơn DEFAULT của tổ hợp sẽ bỏ rơi phiên có chế độ hiệu lực thấp hơn.
 */
export const ESCALATION_TARGETS: readonly SandboxMode[] = ["workspace-write", "danger-full-access"];

/**
 * Kiểm cặp tham số escalation mà schema công cụ KHÔNG diễn đạt được: `sandbox_permissions` và
 * `justification` phải đi CÙNG NHAU — lời nhắc duyệt không có lý do, hoặc lý do không dẫn tới đâu, là một
 * yêu cầu SAI HÌNH — và justification phải là câu KHÁC RỖNG.
 * Nhận: sandboxPermissions — tham số thô, nếu có; justification — tham số thô, nếu có.
 * Trả: không; ném Error khi cặp tham số sai.
 */
export function validateEscalationArgs(sandboxPermissions: string | undefined, justification: string | undefined): void {
  if (sandboxPermissions !== void 0 && justification === void 0) throw new Error("invalid escalation: sandbox_permissions requires a justification");
  if (justification !== void 0 && sandboxPermissions === void 0) throw new Error("invalid escalation: justification is only valid together with sandbox_permissions");
  if (justification !== void 0 && justification.trim().length === 0) throw new Error("invalid justification: expected a non-empty sentence");
}

/**
 * Marker TỪ CHỐI hướng mô hình — từ vựng DUY NHẤT cả hai họ cưỡng chế dạy và báo, để mô hình nhận ra một
 * từ chối chính sách y hệt nhau dù nhân từ chối hiệu ứng file của bash hay hàng rào của provider fs.
 * Nhận: mode — chế độ mà lượt gọi bị từ chối đã chạy dưới.
 * Trả: dòng marker, ĐÚNG như mô hình thấy.
 */
export function sandboxDenialMarker(mode: SandboxMode): string {
  return `[sandbox: file access denied under ${mode} mode]`;
}

/**
 * Gợi ý escalation CÙNG LƯỢT đi kèm một từ chối khi tổ hợp có quảng cáo trường escalation — lời nhắc nằm
 * NGAY điểm quyết định để lượt thử lại được phép không phụ thuộc việc mô hình nhớ mô tả công cụ.
 * Nhận: subject — danh từ của họ cho hành động bị từ chối (`command` cho bash, `operation` cho fs).
 * Trả: dòng gợi ý, ĐÚNG như mô hình thấy.
 */
export function escalationHintMarker(subject: string): string {
  return `[sandbox: escalation available — retry this exact ${subject} once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the approval prompt asks the user]`;
}

/**
 * Mô tả tham số `sandbox_permissions` hướng mô hình, mang luật escalation cho mọi họ cưỡng chế.
 * Nhận: subject — danh từ của họ cho hành động bị từ chối.
 * Trả: mô tả tham số, ĐÚNG như mô hình thấy.
 */
export function sandboxPermissionsDescription(subject: string): string {
  return `The narrowest wider sandbox mode for a one-shot retry of the exact ${subject} the sandbox just denied; the retry asks the user for approval.`;
}

/**
 * Từ vựng ĐÓNG của một lời hỏi escalation — giống CẤU TRÚC với `ApprovalOutcome` của seam approval để giá
 * trị trả của `ApprovalService.request` gán được mà không phải import gói đó.
 */
export type EscalationOutcome = "allowed-once" | "rejected" | "cancelled" | "unavailable";

/**
 * Hình dạng TỐI THIỂU của bộ hỏi duyệt mà {@link approveEscalation} cần — CẤU TRÚC tương đương
 * `ApprovalService`, generic trên kiểu agent `A` và kiểu call-id `C`.
 */
export interface EscalationApprover<A = object, C = string> {
  /**
   * Hỏi NGƯỜI một hành động, trả về kết luận đóng.
   * Nhận: req — yêu cầu kiểm toán kèm displayReason bản địa hoá (tuỳ chọn) và signal vòng đời.
   * Trả: quyết định của người, dưới dạng {@link EscalationOutcome}.
   */
  request(req: {
    /** Agent đang gọi. */
    agent: A;
    /** Tên công cụ ghi vào yêu cầu. */
    toolName: string;
    /** Id lượt gọi mà lời nhắc duyệt gắn vào. */
    callId: C;
    /** Lý do kiểm toán. */
    reason: string;
    /** Lý do hiển thị đã bản địa hoá (khoá `en` bắt buộc). */
    displayReason?: { readonly en: string; readonly [locale: string]: string };
    /** Signal huỷ của lượt thực thi công cụ, khi có. */
    signal?: AbortSignal;
  }): Promise<EscalationOutcome>;
}

/**
 * Nguyên liệu duyệt mà một công cụ đang escalate trao cho {@link approveEscalation}: bộ hỏi duyệt
 * (`ctx.approval`, hoặc `undefined` khi không có), agent đang gọi (hoặc `undefined`), và danh tính lượt gọi.
 */
export interface EscalationApproval<A = object, C = string> {
  /** Bộ hỏi duyệt (`ctx.approval`), hoặc `undefined` khi không có. */
  approver: EscalationApprover<A, C> | undefined;
  /** Agent đang gọi, hoặc `undefined` cho lượt không có agent (đóng cửa khi hỏng). */
  agent: A | undefined;
  /** Id lượt gọi mà lời nhắc duyệt gắn vào. */
  callId: C;
  /** Tên công cụ ghi vào yêu cầu duyệt. */
  toolName: string;
  /** Signal huỷ của lượt thực thi công cụ, khi có. */
  signal?: AbortSignal;
}

/** Một yêu cầu escalation, đúng như {@link approveEscalation} xét nó. */
export interface EscalationRequest {
  /** Chế độ đích được yêu cầu (schema ghim vào {@link ESCALATION_TARGETS} khi được quảng cáo). */
  requestedMode: string;
  /** Lý do MỘT CÂU của mô hình, hiện NGUYÊN VĂN cho người dùng trong lý do kiểm toán. */
  justification: string;
  /** Chế độ hiệu lực của lượt gọi (ghi đè phiên ?? mặc định tổ hợp); lặp lại nó KHÔNG cần duyệt. */
  effectiveMode: SandboxMode;
  /** Danh từ của họ cho hành động được escalate trong các văn bản hướng người (`command`/`operation`). */
  subject: string;
}

/**
 * Giải một yêu cầu quyền sandbox TRƯỚC khi chạy. Lặp lại chế độ hiệu lực của lượt gọi thì trả về nó mà
 * KHÔNG cần duyệt. Chế độ thẳng rộng hơn cần duyệt và chỉ áp cho lượt gọi này. Đích hẹp hơn/không hỗ trợ,
 * thiếu dịch vụ duyệt hoặc thiếu agent để mở rộng, và kết luận không phải cấp phép đều NÉM trước khi chạy.
 * Nhận: request — yêu cầu cần xét; approval — nguyên liệu duyệt công cụ đang giữ.
 * Trả: chế độ đã được cấp, chỉ dùng cho đúng lượt gọi đã hỏi.
 */
export async function approveEscalation<A, C>(request: EscalationRequest, approval: EscalationApproval<A, C>): Promise<SandboxMode> {
  const { requestedMode: mode, effectiveMode, justification, subject } = request;
  if (mode === effectiveMode) return effectiveMode;
  if (!(WIDER_MODES[effectiveMode] ?? []).includes(mode as SandboxMode)) throw new Error(`sandbox escalation to "${mode}" is not strictly wider than this call's current "${effectiveMode}" mode`);
  if (approval.approver === void 0) throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval service is composed`);
  if (approval.agent === void 0) throw new Error(`sandbox escalation to "${mode}" requires approval, but the call has no agent to route it through`);
  const outcome = await approval.approver.request({
    agent: approval.agent,
    toolName: approval.toolName,
    callId: approval.callId,
    reason: `escalate sandbox to ${mode}: ${justification}`,
    displayReason: {
      en: `Allow this operation with ${mode} permissions: ${justification}`,
      zh: `允许本次操作使用 ${mode} 权限：${justification}`,
    },
    ...(approval.signal ? { signal: approval.signal } : {}),
  });
  switch (outcome) {
    case "allowed-once": return mode as SandboxMode;
    case "rejected": throw new Error(`the user rejected escalating this ${subject} to "${mode}"; it stays denied, so stop and explain instead of working around it`);
    case "cancelled": throw new Error(`approval for escalating to "${mode}" was cancelled`);
    case "unavailable": throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval channel is available`);
    default: return assertNever(outcome, "EscalationOutcome");
  }
}
