/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Họ `turn` của phép nhận lưu trữ trong sổ workspace: phiên có Agent của nó đang trong một lượt
 *      không, và lần huỷ khi phiên bị lưu trữ cùng công việc của nó. Được cài bởi constructor của sổ
 *      đăng ký, nên nó trả lời cho MỌI Agent mà sổ công bố. Viết lại theo hành vi của
 *      @deepseek-ai/dsh-agent (archive-admission).
 */

import type { Agent, ArchiveAdmissionContext, SessionId } from "./types.ts";

/**
 * Trả lời `workspace/session-activity` bằng họ `turn` khi Agent của phiên đang CHẠY (kể cả lượt đang
 * chờ phê duyệt hoặc câu trả lời), và `workspace/session-stop` bằng cách huỷ lượt đó ĐÚNG như lần
 * dừng của chính người dùng — `agent.cancel({ kind: 'user' })`, nhưng KHÔNG kèm `keepInbox` của nút
 * stop, nên đầu vào đang xếp hàng bị bỏ cùng một lần cắt thư chờ đã ghi log, thay vì đánh thức phiên
 * đã lưu trữ về sau. Không chờ gì tới lúc lắng. Cả hai người nghe sống cùng fiber của `ctx`.
 * Nhận: `ctx` — context đăng ký của sổ; `lookup` — phép tra Agent đang sống theo id phiên của sổ.
 * Trả: không.
 */
export function installTurnArchiveAdmission(
  ctx: ArchiveAdmissionContext,
  lookup: (sessionId: SessionId) => Agent | undefined,
): void {
  ctx.on("workspace/session-activity", async ({ sessionId }, next) => {
    const running = lookup(sessionId)?.status === "running";
    const rest = await next();
    if (!running) return rest;
    return [{ kind: "turn" }, ...rest];
  });
  ctx.on("workspace/session-stop", ({ sessionId }) => {
    const agent = lookup(sessionId);
    if (agent?.status === "running") agent.cancel({ kind: "user" });
  });
}
