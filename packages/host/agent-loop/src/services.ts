/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Giải service của vòng chạy agent (tách khỏi plugin.ts để giữ ≤ 1000 dòng/tệp):
 *      đọc service qua ctx.get với mặt cấu trúc, fail-loud ở biên, và coi lưu trữ phiên là TUỲ CHỌN như bản gốc.
 */

import type {
  AgentRegistryLike,
  SessionPersistenceLike,
  SessionProjectionsLike,
  SessionStoreLike,
  SystemPromptLike,
} from "./plugin.ts";

export interface AgentLoopServices {
  readonly agents: AgentRegistryLike;
  readonly sessions: SessionStoreLike;
  readonly sessionProjections: SessionProjectionsLike;
  readonly systemPrompt: SystemPromptLike;
  /** TUỲ CHỌN: bản gốc cũng coi lưu trữ phiên là tuỳ chọn (`ctx.get` trả undefined khi vắng). */
  readonly sessionPersistence?: SessionPersistenceLike;
}

/**
 * Lấy 5 service mà vòng chạy CẦN, đọc qua `ctx.get` và NÉM NGAY khi thiếu.
 *
 * Vì sao không ép kiểu trần (08/11/2026 — sự cố thật: prompt được nhận HTTP 200 nhưng KHÔNG có lượt nào
 * chạy, không lỗi ở đâu): bản cũ `return ctx as AgentLoopServices` khiến một service thiếu ở runtime chỉ
 * nổ `TypeError` BÊN TRONG `kick()`, mà `kick()` nuốt lỗi (giống bản gốc) ⇒ im lặng tuyệt đối. Nay thiếu
 * service là ném ngay tại biên với tên service cụ thể, để lỗi hiện ra thay vì treo.
 * Nhận: ctx — context của plugin.
 * Trả: bộ 5 service đã xác nhận có mặt.
 * @throws Error khi thiếu một service, nêu rõ tên.
 */
export function servicesOf(ctx: unknown): AgentLoopServices {
  const dich = ctx as { get?: (k: string) => unknown };
  const doc = (ten: string): unknown => {
    const giaTri = typeof dich.get === "function" ? dich.get(ten) : undefined;
    if (giaTri === undefined || giaTri === null) throw new Error("agent-loop: thieu service '" + ten + "' trong composition");
    return giaTri;
  };
  const optional = (ten: string): unknown => (typeof dich.get === "function" ? dich.get(ten) : undefined);
  return {
    agents: doc("agents") as AgentLoopServices["agents"],
    sessions: doc("sessions") as AgentLoopServices["sessions"],
    sessionProjections: doc("sessionProjections") as AgentLoopServices["sessionProjections"],
    systemPrompt: doc("systemPrompt") as AgentLoopServices["systemPrompt"],
    // sessionPersistence CỐ Ý không đòi ở đây: nó được dùng TRÌ HOÃN qua `ctx.inject([...])` (xem resumeWith),
    //   nên đòi ngay lúc apply sẽ hỏng thứ tự mount (bản ghi 08/11/2026: plugin không activate ⇒ host không boot).
    //   Đọc TUỲ CHỌN bằng `ctx.get` để nơi nào cần "chắc chắn có" thì tự đòi (`persistenceOf`).
    sessionPersistence: optional("sessionPersistence") as AgentLoopServices["sessionPersistence"],
  };
}

/**
 * Lấy lưu trữ phiên khi ĐÃ `ctx.inject(["sessionPersistence"], …)` bảo đảm có mặt.
 * Nhận: ctx — context CON do `inject` cấp. Trả: service lưu trữ phiên.
 * @throws Error nêu rõ tên service khi vắng (không bao giờ im lặng).
 */
export function persistenceOf(ctx: unknown): SessionPersistenceLike {
  const giaTri = (ctx as { readonly sessionPersistence?: SessionPersistenceLike }).sessionPersistence;
  if (giaTri === undefined || giaTri === null) throw new Error("agent-loop: thieu service 'sessionPersistence' trong composition");
  return giaTri;
}

