/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của @galaxy-blackhole/gbh-workflow — bản viết lại của @deepseek-ai/dsh-workflow.
 *      Phơi seam `ctx.workflowEngine`, `WorkflowError`+predicate fatal, hàm đóng dấu
 *      `WorkflowRunId`, và KHAI KIỂU sáu sự kiện `workflow/*` trên Context/Events của cordis.
 *      Nguồn đối chiếu: xem README.md của package (G4).
 */

import type { WorkflowAgentEndInfo, WorkflowAgentInfo, WorkflowResultInfo, WorkflowRunInfo } from "./types.ts";
import { WorkflowEngine } from "./service.ts";

export { WorkflowEngine };
export { WorkflowError, isFatalWorkflowError } from "./errors.ts";
export { WorkflowRunId } from "./types.ts";
export type {
  WorkflowAgentEndInfo,
  WorkflowAgentInfo,
  WorkflowAgentOutcome,
  WorkflowErrorCode,
  WorkflowEventName,
  WorkflowMeta,
  WorkflowPhase,
  WorkflowResult,
  WorkflowResultInfo,
  WorkflowRunInfo,
  WorkflowStopReason,
} from "./types.ts";
export type { WorkflowRun, WorkflowStartRequest } from "./runtime-types.ts";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Seam năng lực workflow: thứ mà nhà cung cấp engine đăng ký khi nó khởi động. */
    workflowEngine: WorkflowEngine;
  }

  interface Events {
    /**
     * Một lượt chạy workflow bắt đầu — khối meta của script đã hợp lệ, thân script sắp chạy.
     * Cặp với {@link Events['workflow/end']}.
     * @param info — ảnh chụp danh tính của lượt chạy (id + meta).
     * @mode emit
     */
    "workflow/start"(info: WorkflowRunInfo): void;

    /**
     * Script bước vào một pha (một lời gọi `phase(title)`) — gom nhóm tiến độ cho người quan sát;
     * không có ngữ nghĩa thi hành nào.
     * @param info — ảnh chụp danh tính của lượt chạy.
     * @param title — tiêu đề pha, nguyên văn.
     * @mode emit
     */
    "workflow/phase"(info: WorkflowRunInfo, title: string): void;

    /**
     * Script phát một dòng tường thuật (một lời gọi `log(message)`).
     * @param info — ảnh chụp danh tính của lượt chạy.
     * @param message — thông điệp đã ghi, nguyên văn.
     * @mode emit
     */
    "workflow/log"(info: WorkflowRunInfo, message: string): void;

    /**
     * Một lời gọi `agent()` đã dựng được một lượt chạy con ĐÃ CÔNG BỐ. Cặp với
     * {@link Events['workflow/agent-end']} theo `agent.seq`. Lời gọi không bao giờ nhận được lượt
     * chạy đã công bố từ nhà cung cấp thì KHÔNG phát cặp sự kiện nào.
     * @param info — ảnh chụp danh tính của lượt chạy.
     * @param agent — số thứ tự, nhãn, pha và id agent con của lời gọi.
     * @mode emit
     */
    "workflow/agent-start"(info: WorkflowRunInfo, agent: WorkflowAgentInfo): void;

    /**
     * Một lời gọi `agent()` đã an bài (kết quả sạch, agent con hỏng, hoặc lượt chạy bị huỷ). Cặp
     * với {@link Events['workflow/agent-start']} theo `agent.seq`, đúng một lần cho mỗi lời gọi
     * đã bắt đầu trên MỌI đường dừng — trên đường engine bị chấm dứt, sự kiện kết thúc do engine
     * TỰ SINH với outcome `cancelled`.
     * @param info — ảnh chụp danh tính của lượt chạy.
     * @param agent — danh tính lời gọi cộng kết cục của nó.
     * @mode emit
     */
    "workflow/agent-end"(info: WorkflowRunInfo, agent: WorkflowAgentEndInfo): void;

    /**
     * Một lượt chạy workflow đã an bài (bất kỳ lý do dừng nào). Phát khi `result` của
     * {@link WorkflowRun} được hiện thực. Cặp với {@link Events['workflow/start']}.
     * @param info — ảnh chụp danh tính của lượt chạy.
     * @param result — dữ liệu kết cục (lý do dừng, lỗi, số agent) — CỐ Ý KHÔNG có giá trị kết quả
     *   (xem {@link WorkflowResultInfo}).
     * @mode emit
     */
    "workflow/end"(info: WorkflowRunInfo, result: WorkflowResultInfo): void;
  }
}

export default WorkflowEngine;
