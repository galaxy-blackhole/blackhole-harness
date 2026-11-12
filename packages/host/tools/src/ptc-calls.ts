/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Sổ theo dõi các lượt gọi PTC đang sống: lượt gọi mới phải chờ các lượt tiền nhiệm ĐÃ BỊ HUỶ dọn
 *      xong, mọi lượt còn sống bị huỷ khi chế độ sandbox của phiên đổi hoặc khi sổ tool bị gỡ — port 1:1
 *      ptc-calls.js (61 dòng) của @deepseek-ai/dsh-tools.
 */

import type { Context } from "@deepseek-ai/cordis";
import type { SandboxMode } from "@deepseek-ai/dsh-sandbox";
import type { SessionId } from "@deepseek-ai/dsh-session";

/** Một lượt gọi PTC đang sống: chế độ tệp lúc nhận vào, bộ huỷ riêng, và mốc dọn xong. */
interface PtcCall {
  /** Chế độ tệp đọc TẠI THỜI ĐIỂM nhận vào, dùng để so với sự kiện `sandbox/mode` sau đó. */
  readonly mode: SandboxMode;
  /** Bộ huỷ của RIÊNG lượt gọi này (hợp nhất với tín hiệu của bên gọi khi chạy). */
  readonly controller: AbortController;
  /** Xong khi lượt gọi đã dọn xong (được resolve trong `finally` của {@link PtcCalls.run}). */
  readonly done: Promise<void>;
}

/**
 * Mặt cắt CẤU TRÚC của sự kiện `session/event` mà tệp này đọc.
 * Nhận: `type` — loại sự kiện; `data` — thân sự kiện, nhánh `sandbox/mode` mang `mode`.
 * Trả: hình dạng chỉ-kiểu; không có giá trị lúc chạy.
 * Vì sao khai tại chỗ: khoá `sandbox/mode` do `@deepseek-ai/dsh-sandbox-policy` cộng gộp vào
 * `SessionEventMap`; gói này KHÔNG cộng gộp module (ADR 000d) nên đọc qua mặt cắt cấu trúc.
 */
interface SessionModeEventLike {
  /** Loại sự kiện; chỉ `sandbox/mode` mới hành động. */
  readonly type: string;
  /** Thân sự kiện; nhánh `sandbox/mode` mang chế độ tệp mới. */
  readonly data: { readonly mode: SandboxMode };
}

/**
 * Giữ các lượt gọi dưới một chính sách đã đổi không chồng lấn lên tiền nhiệm đã bị huỷ của chúng.
 * Nhận: không (lớp).
 * Trả: không (lớp).
 */
export class PtcCalls {
  /** Các lượt gọi đang sống, nhóm theo phiên gọi. */
  private readonly calls = new Map<SessionId, Set<PtcCall>>();

  /** Đã bị gỡ: lượt gọi mới bị từ chối, lượt cũ bị huỷ và chờ dọn. */
  private disposed = false;

  /**
   * Theo dõi thay đổi chính sách cho sổ tool đang sở hữu, và dọn mọi lượt gọi khi sổ bị gỡ.
   * Nhận: `ctx` — vòng đời của sổ đăng ký cùng các sự kiện Phiên.
   * Trả: không.
   */
  constructor(ctx: Context) {
    ctx.on("session/event", (session, event) => {
      // ADR 000d: đọc nhánh `sandbox/mode` qua mặt cắt cấu trúc thay vì cộng gộp SessionEventMap.
      const change = event as unknown as SessionModeEventLike;
      if (change.type !== "sandbox/mode") return;
      for (const call of this.calls.get(session.id) ?? []) {
        if (call.mode !== change.data.mode) call.controller.abort(new Error("sandbox mode changed"));
      }
    }, { global: true });
    ctx.effect(() => async () => {
      this.disposed = true;
      const calls = [...this.calls.values()].flatMap((calls) => [...calls]);
      for (const call of calls) call.controller.abort(new Error("PTC tool registry disposed"));
      await Promise.all(calls.map((call) => call.done));
    }, "PTC calls");
  }

  /**
   * Chờ các tiền nhiệm đã bị huỷ TRƯỚC khi chốt quyền và nhận lượt gọi vào sổ.
   * Nhận: `sessionId` — Phiên đang gọi; `signal` — tín hiệu huỷ của bên gọi; `mode` — chế độ
   *   đang đứng, đọc SAU khi dọn xong tiền nhiệm; `run` — cả lượt gọi, kể cả phần dọn tool lồng nhau.
   * Trả: kết quả của lượt gọi.
   * @throws {Error} khi sổ tool đã bị gỡ (`PTC tool registry disposed`).
   */
  async run<T>(
    sessionId: SessionId,
    signal: AbortSignal,
    mode: () => SandboxMode,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    for (;;) {
      const pending = [...this.calls.get(sessionId) ?? []].filter((call) => call.controller.signal.aborted);
      if (pending.length === 0) break;
      await Promise.all(pending.map((call) => call.done));
    }
    signal.throwIfAborted();
    if (this.disposed) throw new Error("PTC tool registry disposed");
    const controller = new AbortController();
    const done = Promise.withResolvers<void>();
    const call: PtcCall = { mode: mode(), controller, done: done.promise };
    let calls = this.calls.get(sessionId);
    if (calls === undefined) this.calls.set(sessionId, calls = new Set());
    calls.add(call);
    try {
      return await run(AbortSignal.any([signal, controller.signal]));
    } finally {
      calls.delete(call);
      if (calls.size === 0) this.calls.delete(sessionId);
      done.resolve(undefined);
    }
  }
}
