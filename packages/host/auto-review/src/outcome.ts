/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hiện thực hoá ba kết cục của cổng duyệt: từ chối cuối cùng (kèm lỗi có cấu trúc), hỏi người
 *      (kèm chữ đã bản địa hoá), và hỏng kỹ thuật. Nguyên văn gói gốc (lib/index.js dòng 416–453).
 */

import { AUTO_REVIEW_DENIED_CODE, AUTO_REVIEW_DENIED_ERROR_NAME } from "./constants.ts";
import type { PendingExecution, PreToolDecision } from "./types.ts";

/**
 * Dựng lời từ chối CUỐI CÙNG (chính sách duyệt `never`) kèm thông điệp model thấy.
 * Nhận: `exec` — lời gọi bị từ chối; `reason` — lý do thô của bộ duyệt, nếu có.
 * Trả: quyết định `deny` với `info` mang tên + mã lỗi cấu trúc (và `reason` khi có).
 */
export function denied(exec: PendingExecution, reason: string | undefined): PreToolDecision {
  return {
    kind: "deny",
    reason: `Auto review rejected tool "${exec.name}"; its body was not executed`,
    info: {
      name: AUTO_REVIEW_DENIED_ERROR_NAME,
      code: AUTO_REVIEW_DENIED_CODE,
      ...(reason === undefined ? {} : { reason }),
    },
  };
}

/**
 * Dựng yêu cầu HỎI NGƯỜI cho một lời gọi mà bộ duyệt từ chối dưới chính sách `ask`.
 * Nhận: `exec` — lời gọi bị từ chối; `reason` — lý do thô, nếu có.
 * Trả: quyết định `ask` với lý do kiểm toán tiếng Anh và chữ nhắc đã bản địa hoá (en + zh).
 */
export function askUser(exec: PendingExecution, reason: string | undefined): PreToolDecision {
  const denial = `Auto review denied tool "${exec.name}"`;
  return {
    kind: "ask",
    reason: reason === undefined ? denial : `${denial}: ${reason}`,
    displayReason:
      reason === undefined
        ? {
            en: "Auto review denied this call.",
            zh: "Auto review 拒绝了此调用。",
          }
        : {
            en: `Auto review denied this call: ${reason}`,
            zh: `Auto review 拒绝了此调用：${reason}`,
          },
  };
}

/**
 * Hiện thực hoá một lần HỎNG của bộ duyệt thành lỗi riêng, không phải lời từ chối.
 * Nhận: `exec` — lời gọi không được chạy; `error` — lỗi bắt được.
 * Trả: quyết định `deny` nêu thân không được thực thi và thông điệp lỗi.
 */
export function failed(exec: PendingExecution, error: unknown): PreToolDecision {
  const message = error instanceof Error ? error.message : String(error);
  return {
    kind: "deny",
    reason: `Auto review of tool "${exec.name}" failed; its body was not executed: ${message}`,
  };
}
