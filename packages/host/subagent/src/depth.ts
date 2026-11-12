/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hạch toán độ sâu uỷ nhiệm: ngân sách đệ quy mà cha truyền cho con; tách khỏi dịch vụ để helper
 *      hợp thành đọc được mà không phải import sổ đăng ký. Port 1:1 `lib/types/depth.js` (39 dòng) +
 *      `lib/types/depth.d.ts` (31 dòng) của `@deepseek-ai/dsh-subagent`.
 */

/**
 * Hạch toán độ sâu uỷ nhiệm: ngân sách đệ quy mà cha truyền cho con. Giữ tách khỏi dịch vụ để helper
 * hợp thành đọc được nó mà không phải import sổ đăng ký.
 *
 * Bản gốc khai `AgentOptions.subagentDepth` bằng `declare module '@galaxy-blackhole/gbh-agent'`; repo CẤM
 * augment module (ADR 000d), nên seam dưới đây khai theo CẤU TRÚC đúng phần được đọc.
 *
 * @module @galaxy-blackhole/gbh-subagent/depth
 */

import type { Agent } from "@galaxy-blackhole/gbh-agent";

/**
 * Hình dạng Agent mà tầng này đọc, khai theo CẤU TRÚC: `Agent` thật cộng đúng một trường mà bản gốc
 * thêm bằng augment — `options.subagentDepth`.
 *
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
type DepthCarryingAgent = Agent & {
  /** Độ sâu uỷ nhiệm: 0 với Agent cấp cao nhất, bằng độ sâu cha + 1 với con. */
  readonly options: { readonly subagentDepth?: number };
};

/**
 * Đọc độ sâu uỷ nhiệm của một Agent, coi vắng mặt là độ sâu cấp cao nhất bằng 0. Header phiên đã lưu là
 * nguồn chuẩn và đơn điệu: `AgentOptions.subagentDepth` lúc chạy có thể LÀM SÂU thêm phép đếm nhưng
 * không bao giờ được làm nó nông đi — một con chạy lại đến với tuỳ chọn mới, và đếm nó từ 0 sẽ cho nó uỷ
 * nhiệm như thể nó là cấp cao nhất.
 * Nhận: agent — Agent mà header và tuỳ chọn của nó mang độ sâu.
 * Trả: độ sâu là số nguyên an toàn không âm.
 * @throws TypeError nếu `AgentOptions.subagentDepth` lúc chạy không phải số nguyên an toàn không âm.
 */
export function delegationDepthOf(agent: Agent): number {
  const runtime = (agent as DepthCarryingAgent).options.subagentDepth;
  if (runtime !== undefined && (!Number.isSafeInteger(runtime) || runtime < 0 || Object.is(runtime, -0))) {
    throw new TypeError('agent subagentDepth must be a non-negative safe integer');
  }
  // Giá trị header đã được kiểm tại biên phiên (cả lúc tạo lẫn lúc nạp bền vững đều dựng qua store).
  // Bản port gbh-agent không khai header trên AgentSession ⇒ đọc qua mặt CẤU TRÚC tại biên.
  const header = (agent.session as unknown as { readonly header: { readonly delegationDepth?: number } }).header;
  return Math.max(header.delegationDepth ?? 0, runtime ?? 0);
}

/**
 * Từ chối một trần đệ quy không biểu diễn được độ sâu uỷ nhiệm chính xác.
 * Nhận: maxDepth — giá trị lúc chạy tuỳ chọn cần kiểm.
 * Trả: không; ném TypeError khi giá trị không phải số nguyên an toàn không âm (kể cả `-0`).
 */
export function assertSubagentMaxDepth(maxDepth: unknown): void {
  if (maxDepth !== undefined && (typeof maxDepth !== 'number'
    || !Number.isSafeInteger(maxDepth)
    || maxDepth < 0
    || Object.is(maxDepth, -0))) {
    throw new TypeError('subagent maxDepth must be a non-negative safe integer');
  }
}
