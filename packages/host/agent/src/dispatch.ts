/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bộ phân phát theo scope của agent và helper lắp prompt: carrier hợp nhất chủ thể agent với
 *      khoá phạm vi của nó, nên khoá và trường `agent` trong payload KHÔNG thể lệch nhau. Viết lại
 *      theo hành vi của @deepseek-ai/dsh-agent (dispatch).
 */

import { scopeTarget } from "@deepseek-ai/dsh-scope";
import type { Agent, AgentCarrier, AgentEventDispatch, AssembleContext, DispatchContext } from "./types.ts";

/**
 * Dựng carrier phạm vi hợp nhất cho MỘT chủ thể agent.
 *
 * Carrier là vật định tuyến BẤT BIẾN (không mang thuộc tính của chủ thể). {@link agentEvents}
 * nhận một carrier có sẵn, nên bên gọi phát LẶP LẠI cho cùng agent (bộ điều khiển vòng chạy) dựng
 * nó một lần trong constructor của agent rồi dùng lại, giữ đường nóng không cấp phát.
 * Nhận: `agent` — chủ thể đồng thời là khoá phạm vi.
 * Trả: carrier truyền làm giá trị `this` của bộ phát sự kiện.
 */
export function agentCarrier(agent: Agent): AgentCarrier {
  return scopeTarget(agent, agent);
}

/**
 * Dựng bộ phát hợp nhất chủ thể agent với carrier phạm vi của nó.
 * Nhận: `ctx` — context để phát qua (context nào của app cũng được); `agent` — chủ thể, đồng thời
 * là khoá carrier; `carrier` — carrier để phát qua, mặc định {@link agentCarrier} của agent (truyền
 * carrier do constructor dựng để khỏi dựng lại mỗi lần phát).
 * Trả: bộ phát hợp nhất.
 */
export function agentEvents(ctx: DispatchContext, agent: Agent, carrier: AgentCarrier = agentCarrier(agent)): AgentEventDispatch {
  const fused = (payload: Record<string, unknown>): Record<string, unknown> => ({
    ...payload,
    agent,
  });
  return {
    emit(name, payload) {
      // `dispatch` TIÊU THỤ hai phần tử đầu của mảng (thisArg, tên sự kiện) rồi trả callback đã
      // ràng buộc — nên `args` còn lại đúng [payload] khi gọi. Sao chép nguyên thứ tự này.
      const args: unknown[] = [carrier, name, fused(payload)];
      const callbacks = ctx.events.dispatch("emit", args);
      for (const callback of callbacks) {
        try {
          const returned = callback(...args);
          Promise.resolve(returned).catch((error: unknown) => {
            ctx.logger.warn(`agent event "${name}" listener rejected: ${String(error)}`);
          });
        } catch (error) {
          ctx.logger.warn(`agent event "${name}" listener threw: ${String(error)}`);
        }
      }
    },
    async serial(name, payload) {
      const serial = ctx.serial;
      return await serial(carrier, name, fused(payload));
    },
    waterfall(name, payload, ...rest) {
      const waterfall = ctx.waterfall;
      return waterfall(carrier, name, fused(payload), ...rest);
    },
  };
}

/**
 * Phát MỘT thông báo agent đã bao lỗi mà không giữ lại bộ phát nào.
 * Nhận: `ctx` — context để phát qua; `agent` — chủ thể và khoá phạm vi; `name` — sự kiện cần phát;
 * `payload` — các trường payload (agent được chèn).
 * Trả: không.
 */
export function emitAgentEvent(ctx: DispatchContext, agent: Agent, name: string, payload: Record<string, unknown>): void {
  agentEvents(ctx, agent).emit(name, payload);
}

/**
 * Dựng context lắp prompt với agent và scope đặt CÙNG nhau, để đóng góp prompt/tool theo agent
 * không bị bỏ sót âm thầm.
 * Nhận: `agent` — agent mà phép lắp phục vụ; `signal` — tín hiệu kiểm soát của lượt hiện tại, khi
 * phép lắp thuộc một lượt.
 * Trả: context truyền cho `assemble()` — có `signal` CHỈ khi được truyền vào.
 */
export function assembleContextFor(agent: Agent, signal?: AbortSignal): AssembleContext {
  return {
    agent,
    scope: agent,
    ...(signal === undefined ? {} : { signal }),
  };
}
