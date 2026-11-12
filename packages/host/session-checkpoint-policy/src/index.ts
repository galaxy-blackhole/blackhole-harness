/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chính sách checkpoint phiên: ghi bền sự kiện đã cam kết TRƯỚC request model và TRƯỚC tác dụng
 *      phụ của tool top-level, và ở mỗi ranh giới `agent/pre-step`. Bản viết lại của Galaxy Blackhole
 *      cho row session-checkpoint-policy (@deepseek-ai/dsh-session-checkpoint-policy) — nguồn đối chiếu
 *      ở README.md của package (G4).
 */

import { abortedBeforeDispatchResult } from "./result.ts";
import type { CheckpointContext, LiveSession, StreamNext } from "./types.ts";

/** Tên plugin cordis — nguyên văn của bản gốc (Loader dùng cho chẩn đoán). */
export const name = "session-checkpoint-policy";

/** Service mà chính sách phải chờ trước khi chạy: chính sách chỉ là listener trên ba ranh giới của chúng. */
export const inject: string[] = ["llm", "sessionPersistence", "sessions", "tools"];

/**
 * Bọc luồng model để checkpoint chạy TRƯỚC khi luồng hạ nguồn được dựng.
 * Nhận: context sở hữu sổ phiên, phiên của request model, và hàm dựng luồng của adapter.
 * Trả: luồng chỉ ghi bền xong phần đã cam kết rồi mới kéo chunk đầu tiên từ hạ nguồn;
 *       flush ném lỗi ⇒ luồng ném ở lần kéo đầu và adapter KHÔNG được dựng (fail-closed).
 */
function afterCheckpoint(ctx: CheckpointContext, session: LiveSession, next: StreamNext): AsyncIterable<unknown> {
  return (async function* () {
    // Cờ boolean của kernel chỉ nói "có listener ghi bền nào tham gia không" — thành công hay không
    // nằm ở việc promise này NÉM hay không, nên bản gốc (và ta) cố ý bỏ qua giá trị trả về.
    await ctx.sessions.flush(session);
    yield* next();
  })();
}

/**
 * Cài các listener checkpoint ngữ nghĩa.
 * Nhận: context cordis sở hữu sổ phiên và ba điểm mở rộng.
 * Trả: không; đăng ký ba listener — request model, lượt gọi tool top-level, và ranh giới bước kế tiếp.
 *       Lỗi checkpoint là fail-closed: adapter model và thân tool top-level không chạy khi ghi bền hỏng.
 */
export function apply(ctx: CheckpointContext): void {
  ctx.on("llm/stream", (options, next) => {
    if (options.sessionId === undefined) return next();
    const session = ctx.sessions.get(options.sessionId);
    return session === undefined ? next() : afterCheckpoint(ctx, session, next);
  });
  ctx.on("tools/execute", async (exec, next) => {
    // Lời gọi LỒNG NHAU (có parent) dùng lại checkpoint của lời gọi ngoài; lời gọi không thuộc agent
    // nào thì không có phiên để ghi bền.
    if (exec.agent === undefined || exec.parent !== undefined) return next();
    await ctx.sessions.flush(exec.agent.session);
    // Huỷ rơi vào lúc chờ checkpoint: trả kết quả canonical, KHÔNG vào thân tool.
    if (exec.signal.aborted) return abortedBeforeDispatchResult();
    return next();
  });
  ctx.on("agent/pre-step", async ({ agent }, next) => {
    // Ranh giới bước: batch response + kết quả tool của bước TRƯỚC phải bền trước khi dựng request mới.
    await ctx.sessions.flush(agent.session);
    return next();
  });
}
