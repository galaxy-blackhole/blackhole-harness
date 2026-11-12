/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Định nghĩa Service của seam năng lực workflow: `ctx.workflowEngine`. Nhà cung cấp
 *      (workflow-ptc…) kế thừa lớp này để đăng ký service; sáu sự kiện `workflow/*` CHỈ để
 *      quan sát, không bao giờ phơi quyền điều khiển lượt chạy.
 */

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import type { WorkflowEventName } from "./types.ts";
import type { WorkflowRun, WorkflowStartRequest } from "./runtime-types.ts";

/**
 * Hợp đồng của Service workflow. Yêu cầu không hợp lệ thì ném TRƯỚC khi công bố lượt chạy;
 * lượt chạy đang sống thuộc về người giữ, `result` của nó không bao giờ reject, và lúc dọn dẹp
 * phải chờ cả script lẫn agent con. Hỏng hóc của người nghe sự kiện vòng đời được CÔ ĐỊNH (không
 * làm hỏng người phát), và `workflow/end` phát ĐÚNG MỘT LẦN khi kết quả an bài.
 */
export abstract class WorkflowEngine extends Service {
  /**
   * Đăng ký thực thể này làm service `workflowEngine` trong context hiện tại.
   * Nhận: context host của kernel (cordis cấp đúng một thể hiện service cho cả cây plugin).
   * Trả: không — thực thể đã đăng ký, và lớp con phải cài {@link WorkflowEngine.start}.
   */
  constructor(ctx: Context) {
    super(ctx, "workflowEngine");
  }

  /**
   * Phân tích và thi hành một script workflow.
   * Nhận: yêu cầu gồm thân script, `args`, agent cha, và tín hiệu huỷ tuỳ chọn.
   * Trả: lượt chạy đang sống; `result` của nó an bài khi script kết thúc.
   */
  abstract start(request: WorkflowStartRequest): WorkflowRun;

  /**
   * Phát một sự kiện vòng đời, CÔ ĐỊNH và ghi log từng hỏng hóc của người nghe.
   * Nhận: tên sự kiện `workflow/*` cần phát và thân sự kiện khớp đúng chữ ký đã khai.
   * Trả: không; người nghe ném đồng bộ hay reject bất đồng bộ đều không lan ra người phát.
   */
  protected emitWorkflowEvent(name: WorkflowEventName, ...args: unknown[]): void {
    // Sao y bản gốc: lấy DANH SÁCH callback đã lọc theo context rồi tự gọi từng cái, để một
    // người nghe hỏng không chặn những người nghe còn lại (đó là lý do không dùng `events.emit`).
    for (const callback of this.ctx.events.dispatch("emit", [name, ...args])) {
      try {
        const returned = callback(...args);
        Promise.resolve(returned).catch((error: unknown) => {
          this.ctx.logger.warn(`workflow: ${name} listener rejected: ${renderListenerError(error)}`);
        });
      } catch (error) {
        this.ctx.logger.warn(`workflow: ${name} listener threw: ${renderListenerError(error)}`);
      }
    }
  }
}

/**
 * Hiện thực hoá mọi giá trị bị ném mà KHÔNG phá vỡ cô định người nghe.
 * Nhận: mọi giá trị bị ném (kể cả object có getter ném).
 * Trả: `String(error)`, hoặc một nhãn cố định khi chính phép ép chuỗi cũng ném.
 */
function renderListenerError(error: unknown): string {
  try {
    return String(error);
  } catch {
    return "[unrenderable thrown value]";
  }
}
