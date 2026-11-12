/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Đóng góp session-log TĂNG DẦN, KHÔNG MẤT MÁT cho các request của API DeepSeek chính thức. Bản
 *      viết lại của Galaxy Blackhole cho row session-log-deepseek
 *      (@deepseek-ai/dsh-session-log-deepseek): đăng ký MỘT provider của trường request
 *      `dsh_session_log` trên seam `ctx.deepseekLlmApiExtensions`, tải tiền tố sự kiện dài nhất còn
 *      chờ vừa `maxBytes`, rồi ghi sự kiện mốc `session-log-deepseek/delivery-accepted` sau khi
 *      endpoint nhận (2xx). Mốc nằm trong CHÍNH log canonical nên phục hồi sau restart không cần kho
 *      thứ hai. Nguồn đối chiếu: xem README.md của package (G4).
 */

import type { Context, Volatile } from "@deepseek-ai/cordis";
import { brandString } from "@deepseek-ai/dsh-brand";
import { SessionLogOffset } from "@deepseek-ai/dsh-session";
import type { Session, SessionId, SessionSeq } from "@deepseek-ai/dsh-session";
import z from "@deepseek-ai/schemastery";

import { NEW_EVENT_TYPE, acceptedThrough } from "./acceptance.ts";
import type { ExtensionRegistry, ExtensionRequestFacts } from "./seams.ts";
import type { DeliveryAcceptedData, DeliverySink, DeepSeekSessionLogExtension, DeepSeekSessionLogWireEvent } from "./types.ts";
import { jsonBytes, wireEvent, wireHeader } from "./wire.ts";

/** Tên plugin cordis — nguyên văn của bản gốc. */
export const name = "session-log-gbh";

/** Service bắt buộc: sổ đăng ký trường request DeepSeek và sổ phiên. */
export const inject: string[] = ["deepseekLlmApiExtensions", "sessions"];

/** Cấu hình đóng góp session-log cho request DeepSeek chính thức. */
export interface Config {
  /** Có đóng góp `dsh_session_log` vào request DeepSeek chính thức hay không; mặc định `true`. */
  enabled: Volatile<boolean>;
  /**
   * Trường `dsh_session_log` lớn nhất, tính bằng byte UTF-8, mà MỘT request mang được.
   * Request tải tiền tố sự kiện chờ dài nhất vừa trần này; các request sau nối tiếp từ mốc đã nhận.
   * Mặc định 8 MiB.
   */
  maxBytes: number;
}

/** Schema loader cho cấu hình đóng góp session-log (đã kiểm, đã điền mặc định). */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true).volatile(),
  maxBytes: z.number().step(1).min(1).default(8 * 1024 * 1024),
}) as unknown as z<Config>;

/** Sự kiện mà lượt tải của mỗi phiên ĐÃ được báo là bị chặn tại đó; một lần chặn chỉ ghi log MỘT lần. */
const blockedWarnings = new WeakMap<Session, SessionSeq>();

/**
 * Đăng ký đóng góp request tăng dần; công tắc được đọc lại ở MỖI request.
 * Nhận: context mang sổ phiên và sổ đăng ký trường request DeepSeek; cấu hình đã kiểm.
 * Trả: không; đăng ký một provider của trường `dsh_session_log`.
 */
export function apply(ctx: Context, config: Config): void {
  const { maxBytes } = config;
  const registry = (ctx as unknown as { deepseekLlmApiExtensions: ExtensionRegistry }).deepseekLlmApiExtensions;
  registry.register("dsh_session_log", {
    prepare: (request: ExtensionRequestFacts) => {
      if (!config.enabled.get()) return undefined;
      if (request.sessionId === undefined) return undefined;
      const session = ctx.sessions.get(brandString<SessionId>(request.sessionId));
      if (session === undefined) return undefined;
      const afterSeq = acceptedThrough(session);
      const pending = session.snapshotEvents(SessionLogOffset(afterSeq + 1));
      const envelope = {
        version: 1 as const,
        sessionFormatVersion: session.header.version,
        session: wireHeader(session),
        afterSeq: Number(afterSeq),
      };
      // Số byte của trường khi CHƯA có sự kiện và chưa có chữ số của `throughSeq`; mỗi tiền tố ứng
      // viên tự cộng thêm phần của nó.
      let bytes = jsonBytes({ ...envelope, throughSeq: 0, events: [] }) - 1;
      const events: DeepSeekSessionLogWireEvent[] = [];
      // Số byte của trường khi tính cả sự kiện vừa xét; khi không sự kiện nào vừa, đây là cỡ của
      // CHÍNH sự kiện đầu tiên.
      let candidateBytes = 0;
      for (const event of pending) {
        const wire = wireEvent(event);
        const next = bytes + (events.length === 0 ? 0 : 1) + jsonBytes(wire);
        candidateBytes = next + String(event.seq).length;
        if (candidateBytes > maxBytes) break;
        bytes = next;
        events.push(wire);
      }
      const last = events.length === 0 ? undefined : pending[events.length - 1];
      if (last === undefined) {
        const first = pending[0];
        if (first !== undefined && blockedWarnings.get(session) !== first.seq) {
          blockedWarnings.set(session, first.seq);
          const seq = String(first.seq);
          ctx.logger.warn(
            Number.isFinite(candidateBytes)
              ? `session-log-deepseek: event ${seq} of session "${session.id}" needs a ${String(candidateBytes)}-byte` +
                  ` dsh_session_log field, above maxBytes ${String(maxBytes)}; this session's upload stays at event ${seq}` +
                  " until maxBytes admits it"
              : `session-log-deepseek: event ${seq} of session "${session.id}" is too large to serialize into a dsh_session_log field;` +
                  ` this session's upload stays at event ${seq}`,
          );
        }
        return undefined;
      }
      const throughSeq = last.seq;
      const value: DeepSeekSessionLogExtension = { ...envelope, throughSeq: Number(throughSeq), events };
      return {
        value,
        accept: () => {
          (session as unknown as DeliverySink).append(NEW_EVENT_TYPE, {
            sessionId: session.id,
            sessionFormatVersion: session.header.version,
            throughSeq,
          } satisfies DeliveryAcceptedData);
        },
      };
    },
  });
}

export { acceptedThrough } from "./acceptance.ts";
