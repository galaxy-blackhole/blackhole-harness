/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Phục hồi lời gọi công cụ còn treo, dùng chung cho bước live lỗi, log bị ngắt và hạt giống
 *      fork: sửa đuôi giữ nguyên các bước đã đóng, chỉ bổ sung kết quả công cụ còn thiếu và ranh
 *      giới vòng đời, kèm hướng dẫn thử lại theo từng nguyên nhân. Port 1:1 vùng
 *      `lib/types/repair.js` (189 dòng) của `@deepseek-ai/dsh-session`.
 */

/**
 * Phục hồi lời gọi công cụ còn treo dùng chung cho bước live lỗi, log bị ngắt và hạt giống fork.
 * Sửa đuôi giữ nguyên các bước đã đóng và chỉ bổ sung kết quả công cụ còn thiếu cùng ranh giới
 * vòng đời, với hướng dẫn thử lại theo từng nguyên nhân.
 *
 * @module @galaxy-blackhole/gbh-session/repair
 */

import { brandString } from '@galaxy-blackhole/gbh-brand';
import type { MessageId, ToolCallId, ToolResultMessage } from '@galaxy-blackhole/gbh-llm';
import { deepFreeze } from '@galaxy-blackhole/gbh-util-values';

import { SessionSeq } from './types.ts';
import type { SessionEvent } from './types.ts';

/** Mã phục hồi cho yêu cầu công cụ của trợ lý chưa từng tới mốc ghi nhận bắt đầu gọi. */
export const TOOL_NOT_STARTED = 'TOOL_NOT_STARTED';

/** Mã phục hồi cho lời gọi công cụ đã ghi nhận nhưng kết quả hoàn tất không được ghi bền. */
export const TOOL_OUTCOME_UNKNOWN = 'TOOL_OUTCOME_UNKNOWN';

/** Câu chữ model nhìn thấy của kết quả công cụ lỗi tổng hợp, khoá theo nguyên nhân đóng lượt. */
const CLOSER_TEXT = {
  interrupted: {
    started: 'The tool call was interrupted after it was recorded, but no result was durably recorded. Its outcome is unknown. Decide whether to retry from the tool semantics: retry only if the operation is read-only or idempotent; if it may have side effects, first verify external state or ask the user. Do not retry blindly.',
    notStarted: 'The tool call was interrupted before the Harness recorded it as started. Retry it if it is still needed.',
  },
  forked: {
    started: 'The history inherited by this branch records this tool call starting but does not include its result. The parent session may have completed it after the fork point. Decide whether to retry from the tool semantics: retry only if the operation is read-only or idempotent; if it may have side effects, first verify external state or ask the user. Do not retry blindly.',
    notStarted: 'The history inherited by this branch has no record of this tool call starting. The parent session may have executed it after the fork point. Decide whether to retry from the tool semantics: retry only if the operation is read-only or idempotent; if it may have side effects, first verify external state or ask the user. Do not retry blindly.',
  },
};

/**
 * Vì sao một lượt còn mở ở đuôi log bị đóng bằng sự kiện tổng hợp: `interrupted` là phục hồi sự
 * cố trên log đã lưu; `forked` là hạt giống fork bị cắt ngay trong lượt còn mở của nguồn. Nguyên
 * nhân quyết định lý do `turn/end` tổng hợp, câu chữ model nhìn thấy của kết quả công cụ lỗi tổng
 * hợp, và tiền tố id thông điệp tổng hợp tất định. Hai mã lỗi ({@link TOOL_NOT_STARTED} /
 * {@link TOOL_OUTCOME_UNKNOWN}) dùng chung: cả hai nguyên nhân nói cùng một sự thật về vòng đời
 * đã ghi nhận của lời gọi.
 */
export type OpenTurnCloseCause =
  | { readonly kind: 'interrupted' }
  | { readonly kind: 'forked' };

/**
 * Trả về các sự kiện tổng hợp tất định để đóng một lượt còn mở ở đuôi log. Lời gọi chưa có kết quả
 * nhận kết quả lỗi trước, rồi tới `step/end` đang mở và `turn/end` theo nguyên nhân; seq nối tiếp
 * log và mốc thời gian dùng lại sự kiện thật cuối cùng. Log cân bằng hoặc rỗng trả về mảng rỗng.
 *
 * Nhận: events — log bền đã nạp để quét (tiền tố đã commit hợp lệ, có thể có đuôi sự cố);
 * cause — thao tác đóng sở hữu: chọn câu chữ kết quả và lý do kết thúc lượt.
 * Trả: các sự kiện đóng tổng hợp để nối sau `events`, theo đúng thứ tự; rỗng khi log đã cân bằng.
 *
 * @param events - log bền đã nạp để quét (tiền tố đã commit hợp lệ, có thể có đuôi sự cố).
 * @param cause - thao tác đóng sở hữu: chọn câu chữ kết quả và lý do kết thúc lượt.
 * @returns các sự kiện đóng tổng hợp để nối sau `events`, theo đúng thứ tự; rỗng khi log đã cân bằng.
 */
export function openTurnClosers(events: readonly SessionEvent[], cause: OpenTurnCloseCause): SessionEvent[] {
  let openTurn: number | null = null;
  let openStep: number | null = null;
  const recovery = new ToolCallRecovery(cause);
  for (const event of events) {
    recovery.observe(event);
    switch (event.type) {
      case 'turn/start':
        openTurn = event.data.turn;
        openStep = null;
        break;
      case 'turn/end':
        openTurn = null;
        openStep = null;
        break;
      case 'step/start':
        openStep = event.data.step;
        break;
      case 'step/end':
        openStep = null;
        break;
      // Các loại sự kiện khác không làm con trỏ ranh giới lượt/bước dịch chuyển.
      default:
        break;
    }
  }
  // Log cân bằng (không có lượt mở ở đuôi): không có gì để đóng. Một lượt mở kéo theo `events`
  // khác rỗng (đã ghi `turn/start` của nó), nên `last` tồn tại.
  const last = events.at(-1);
  if (openTurn === null || last === undefined) return [];
  // Sự kiện thật cuối cùng cấp mốc seq và mốc thời gian cho các sự kiện đóng tổng hợp (dùng lại mốc
  // thời gian cuối giữ chúng tất định và không bao giờ bịa ra thời điểm "tương lai").
  const closers: SessionEvent[] = recovery.results();
  let seq = last.seq + closers.length + 1;
  const time = last.time;
  // Đóng bước đang mở trước lượt của nó.
  if (openStep !== null) {
    closers.push({ type: 'step/end', seq: SessionSeq(seq++), time, data: { turn: openTurn, step: openStep } });
  }
  closers.push({ type: 'turn/end', seq: SessionSeq(seq++), time, data: { turn: openTurn, reason: { kind: cause.kind } } });
  return closers;
}

/**
 * Theo dõi các yêu cầu công cụ của trợ lý chưa được trả lời từ các sự kiện đã commit của MỘT
 * Session. Quan sát từ đầu bước sở hữu hoặc tiền tố replay, và phục hồi trước khi bước đó đóng.
 * Trạng thái này giữ danh tính còn treo, không giữ lịch sử sự kiện.
 */
export class ToolCallRecovery {
  private readonly cause: OpenTurnCloseCause;
  private readonly pendingCalls = new Map<ToolCallId, { turn: number; step: number; callSeq?: SessionSeq }>();
  private last: { seq: SessionSeq; time: number } | undefined;

  /**
   * Tạo bộ theo dõi cho một nguyên nhân đóng lượt.
   *
   * Nhận: cause — mặc định là phục hồi live/sự cố `interrupted`; hàm dựng hạt giống fork tự
   * truyền nguyên nhân của nó.
   *
   * @param cause - mặc định là phục hồi live/sự cố `interrupted`; hàm dựng hạt giống fork tự truyền nguyên nhân của nó.
   */
  constructor(cause: OpenTurnCloseCause = { kind: 'interrupted' }) {
    this.cause = cause;
  }

  /**
   * Tiêu thụ sự kiện đã commit tiếp theo; bước đã đóng và ranh giới lượt xoá các yêu cầu còn treo.
   *
   * Nhận: event — sự kiện kế tiếp của cùng Session, theo thứ tự seq.
   * Trả: không trả về giá trị; cập nhật trạng thái còn treo nội bộ.
   *
   * @param event - sự kiện kế tiếp của cùng Session, theo thứ tự seq.
   */
  observe(event: SessionEvent): void {
    this.last = { seq: event.seq, time: event.time };
    switch (event.type) {
      case 'turn/start':
      case 'turn/end':
      case 'step/end':
        this.pendingCalls.clear();
        break;
      case 'assistant/message':
        for (const block of event.data.message.content) {
          if (block.type === 'tool-call') {
            this.pendingCalls.set(block.id, { turn: event.data.turn, step: event.data.step });
          }
        }
        break;
      case 'tool/call': {
        const entry = this.pendingCalls.get(event.data.callId);
        if (entry) entry.callSeq = event.seq;
        break;
      }
      case 'tool/result': {
        const callId = event.data.message.source.callId;
        const entry = this.pendingCalls.get(callId);
        if (event.surfaceOp === 'append' && entry !== undefined
          && entry.turn === event.data.turn && entry.step === event.data.step) {
          this.pendingCalls.delete(callId);
        }
        break;
      }
      // SessionEvent là merge-extensible; các sự kiện không liên quan giữ nguyên yêu cầu còn treo.
      default:
        break;
    }
  }

  /**
   * Dựng các kết quả lỗi thận trọng theo thứ tự trợ lý mà không đổi trạng thái đang theo dõi. Seq
   * nối sau sự kiện quan sát được mới nhất và mốc thời gian dùng lại mốc của nó. Người gọi commit
   * các kết quả rồi quan sát chính các commit đó trước khi phục hồi lần nữa.
   *
   * Nhận: không.
   * Trả: các sự kiện `tool/result` còn treo, rỗng khi không còn yêu cầu nào chưa được trả lời.
   *
   * @returns các sự kiện `tool/result` còn treo, rỗng khi không còn yêu cầu nào chưa được trả lời.
   */
  results(): SessionEvent<'tool/result'>[] {
    if (this.last === undefined) return [];
    let seq = this.last.seq + 1;
    const time = this.last.time;
    const results: SessionEvent<'tool/result'>[] = [];
    const text = CLOSER_TEXT[this.cause.kind];
    // Đóng lời gọi trước bước của chúng: nhà cung cấp từ chối các lời gọi trợ lý lửng lơ, và thứ tự
    // chèn của Map giữ đúng thứ tự hội thoại.
    for (const [callId, { turn, step, callSeq }] of this.pendingCalls) {
      const started = callSeq !== undefined;
      const message: ToolResultMessage = deepFreeze({
        id: brandString<MessageId>(`${this.cause.kind}-tool-result-${callId}-${seq}`),
        role: 'tool',
        toolCallId: callId,
        isError: true,
        source: { kind: 'tool', callId },
        content: [{
          type: 'text',
          text: started ? text.started : text.notStarted,
        }],
      });
      results.push({
        type: 'tool/result',
        seq: SessionSeq(seq++),
        time,
        data: {
          turn,
          step,
          message,
          error: started
            ? { name: 'ToolOutcomeUnknownError', code: TOOL_OUTCOME_UNKNOWN }
            : { name: 'ToolNotStartedError', code: TOOL_NOT_STARTED },
        },
        surfaceOp: 'append',
        ...(started ? { sourceEventSeqs: [callSeq] } : {}),
      });
    }
    return results;
  }
}

/**
 * Điểm vào phục hồi sự cố: các sự kiện đóng tổng hợp để cân bằng một log đã lưu mà lượt ở đuôi bị
 * ngắt. Người gọi phục hồi sự cố dùng hàm này; hạt giống fork nhận các sự kiện đóng nguyên nhân
 * `forked` qua `buildForkSeed` trong `./fork.ts`.
 *
 * Nhận: events — log đã lưu để quét, có thể kết thúc giữa một lượt còn mở.
 * Trả: các sự kiện đóng `interrupted` tổng hợp để nối sau `events`; rỗng khi log đã cân bằng.
 *
 * @param events - log đã lưu để quét, có thể kết thúc giữa một lượt còn mở.
 * @returns các sự kiện đóng `interrupted` tổng hợp để nối sau `events`; rỗng khi log đã cân bằng.
 */
export function interruptedTurnClosers(events: readonly SessionEvent[]): SessionEvent[] {
  return openTurnClosers(events, { kind: 'interrupted' });
}
