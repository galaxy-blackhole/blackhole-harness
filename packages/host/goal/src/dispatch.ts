/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Lượt phát sự kiện PHẠM VI AGENT của miền goal: dựng vật mang phạm vi bằng `scopeTarget` của kernel
 *      (vật mang không thể tự chế) rồi lái `ctx.events.dispatch` đúng như `agentEvents` của dsh-agent —
 *      payload được GẮN thêm `agent`, lỗi người nghe bị CHẶN và ghi log, không bao giờ làm hỏng lượt ghi.
 */

import { scopeTarget } from "@deepseek-ai/dsh-scope";

import type { GoalContextSeam } from "./types.ts";

/**
 * Phát MỘT sự kiện phạm vi agent tới mọi người nghe đã đăng ký.
 * Nhận: `seam` — chân trời Context (events + logger); `agent` — chủ thể kiêm khoá phạm vi;
 *       `name` — tên sự kiện; `payload` — các trường thân (agent được gắn thêm).
 * Trả: không; lỗi đồng bộ lẫn promise bị từ chối của người nghe đều chỉ ghi log.
 */
export function emitAgentEvent(seam: GoalContextSeam, agent: object, name: string, payload: Record<string, unknown>): void {
  const carrier = scopeTarget(agent, agent);
  const args: unknown[] = [carrier, name, { ...payload, agent }];
  const callbacks = seam.events.dispatch("emit", args);
  for (const callback of callbacks) {
    try {
      const returned = callback(...args);
      Promise.resolve(returned).catch((error: unknown) => {
        seam.logger.warn(`agent event "${name}" listener rejected: ${String(error)}`);
      });
    } catch (error) {
      seam.logger.warn(`agent event "${name}" listener threw: ${String(error)}`);
    }
  }
}
