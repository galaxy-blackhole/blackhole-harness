/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tu dien namespace `approval` (en/zh) — chuoi giu NGUYEN nhu ban goc de ma tran anh A/B khong lech
 */

/** Namespace từ điển do package này sở hữu. */
export const NS = "approval";

/**
 * Từ điển tiếng Trung — đây cũng là NGUỒN SỰ THẬT của tập khoá (bản gốc làm y vậy).
 * Chuỗi là DỮ LIỆU đối chiếu: đổi một ký tự là lệch ảnh A/B dù hành vi vẫn đúng.
 */
export const zh = {
  waiting: "等待审批",
  "detail.aria": "审批详情",
  escalation: "工具 {toolName} 请求越权执行",
  reject: "拒绝",
  allowOnce: "允许一次",
};

/** Tập khoá copy của namespace `approval`. */
export type ApprovalKey = keyof typeof zh;

/** Từ điển tiếng Anh — bắt buộc đủ và đúng tập khoá của {@link zh}. */
export const en: Record<ApprovalKey, string> = {
  waiting: "Waiting for approval",
  "detail.aria": "Approval details",
  escalation: "Tool {toolName} requests privileged execution",
  reject: "Reject",
  allowOnce: "Allow once",
};
