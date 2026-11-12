/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 vùng call-config.js của @deepseek-ai/dsh-llm (lib/index.js dòng 349–389) cùng
 *      bề mặt kiểu của lib/types/call-config.d.ts: so khớp TỪNG TRƯỜNG của cấu hình lượt gọi và
 *      đánh dấu/kiểm object request do dsh-agent-loop lắp; giữ nguyên thứ tự so sánh và ngữ nghĩa.
 */

import type { ReasoningEffortId } from "./brand.ts";
import type { GenerateOptions, LlmResolvedModelInfo } from "./types.ts";

/**
 * Conversation call configuration and freeze utilities. Provider routing,
 * model, reasoning effort, and sampling values are request-header state that
 * can affect cache reuse; request waterfalls replace them and the loop logs
 * changed snapshots instead of allowing silent per-call drift.
 * @module dsh-llm/call-config
 */

/** Thiết lập sinh cụ thể; điều khiển bị bỏ trống dùng mặc định của tuyến đã chọn. */
export interface LlmCallControls {
  /** Mức suy luận do adapter của model công bố. */
  reasoningEffort?: ReasoningEffortId;
  /** Nhiệt độ lấy mẫu của provider. */
  temperature?: number;
  /** Trần token sinh ra của provider. */
  maxTokens?: number;
  /** Chuỗi dừng do provider tôn trọng. */
  stop?: string[];
}

/**
 * Provider, model, mức suy luận và các vô hướng sampling của request một hội thoại. Mọi trường
 * ánh xạ 1:1 sang trường cùng tên của `GenerateOptions`; loop dựng request từ header đã ghi log
 * thay vì nhận chúng theo từng lượt gọi.
 */
export interface LlmCallConfig extends LlmCallControls {
  /** Khoá tuyến provider của lượt gọi. */
  provider: string;
  /** Id model được gọi. */
  model: string;
}

/**
 * Cấu hình đồng bộ, thuần của một lượt gọi trước khi áp mặc định và kiểm tra. Ghép các hàm theo
 * thứ tự mong muốn; lần ghi sau thay lần ghi trước. Điều khiển trả về KHÔNG đổi được tuyến đã
 * chốt. Lỗi làm hỏng bước chuẩn bị trước khi dispatch; chỉ cấu hình đã chốt mới ghi được.
 */
export type ConfigureCall = (
  controls: Readonly<LlmCallControls>,
  model: Readonly<LlmResolvedModelInfo>,
) => LlmCallControls;

/** Trường cấu hình hiệu lực do phân giải adapter đúng model cấp thay vì do đề xuất của caller. */
export interface LlmCallConfigAdapterDefaults {
  /** Phân giải adapter đã quyết định mức suy luận. */
  reasoningEffort?: true;
  /** Phân giải adapter đã quyết định trần token. */
  maxTokens?: true;
}

/** Danh tính tiến trình của các object request do dsh-agent-loop lắp. */
const AGENT_LOOP_REQUESTS = new WeakSet<GenerateOptions>();

/**
 * Field-wise equality over {@link LlmCallConfig} — the comparison a caller
 * runs to decide whether a proposed configuration is a real change (worth a
 * logged header snapshot) or the held one restated.
 * Nhận: a — một cấu hình; b — cấu hình còn lại.
 * Trả: `true` khi MỌI trường khớp (kể cả danh sách `stop`, so từng phần tử).
 */
export function callConfigEquals(a: LlmCallConfig, b: LlmCallConfig): boolean {
  if (
    a.provider !== b.provider ||
    a.model !== b.model ||
    a.reasoningEffort !== b.reasoningEffort ||
    a.temperature !== b.temperature ||
    a.maxTokens !== b.maxTokens
  ) {
    return false;
  }
  if (a.stop === undefined || b.stop === undefined) return a.stop === b.stop;
  return a.stop.length === b.stop.length && a.stop.every((s, i) => s === b.stop?.[i]);
}

/**
 * Mark one exact request object as assembled by dsh-agent-loop.
 * Nhận: request — envelope request do loop sở hữu, trước khi dispatch tới LLM.
 * Trả: chính object request đó, đã đánh dấu là do agent loop tiến trình này tạo.
 */
export function markAgentLoopRequest<T extends GenerateOptions>(request: T): T {
  AGENT_LOOP_REQUESTS.add(request);
  return request;
}

/**
 * Test whether the exact request object was assembled by dsh-agent-loop.
 * Nhận: request — envelope request quan sát tại waterfall của LLM.
 * Trả: `true` khi {@link markAgentLoopRequest} đã ghi nhận đúng object này.
 */
export function isAgentLoopRequest(request: GenerateOptions): boolean {
  return AGENT_LOOP_REQUESTS.has(request);
}
