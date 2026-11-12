/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Khung một lần thử assistant trong tiến trình + tích luỹ stream bền: gộp MỘT lần thử của model
 *      thành một stream gọn duy nhất kèm các khung tạm thời theo thứ tự. Port 1:1 vùng
 *      `lib/types/assistant-stream.js` dòng 352–473 của `@deepseek-ai/dsh-agent-loop`.
 */

/**
 * Khung một lần thử assistant trong tiến trình và việc tích luỹ stream bền.
 * @module @galaxy-blackhole/gbh-host-agent-loop/assistant-stream
 */

import { AssistantStreamAccumulator, BlockAssembler, LlmAttemptId } from "@deepseek-ai/dsh-llm";
import type { ContentBlock, FinishReason, ReplayEnvelope, StreamChunk, TokenUsage } from "@deepseek-ai/dsh-llm";
import type { AssistantStreamFrame } from "@deepseek-ai/dsh-agent";
import type { SessionEventMap, SessionId, SessionSeq } from "@deepseek-ai/dsh-session";

/**
 * Gộp MỘT lần thử của model thành một stream gọn duy nhất kèm các khung tạm thời theo thứ tự.
 */
export class AssistantStreamAttempt {
  /** Cấp phát số hiệu (revision) của khung kế tiếp được phát. */
  private readonly nextRevision: () => number;
  /** Lượt bền sở hữu yêu cầu. */
  readonly turn: number;
  /** Bước bền sở hữu yêu cầu. */
  readonly step: number;
  /** Bộ phát thông báo phạm vi agent. */
  private readonly emit: (frame: AssistantStreamFrame) => void;
  /** Bộ tích luỹ stream gọn (dùng chung thuật toán của kernel). */
  private readonly accumulator = new AssistantStreamAccumulator();
  /** Bộ lắp khối: biến các chunk thành block và message hoàn chỉnh. */
  private readonly assembler = new BlockAssembler();
  /** Vị trí dày, đếm từ 0, của khung chunk trong lần thử này. */
  private index = 0;
  /** Lần thử này đã phát khung kết thúc chưa. */
  private terminal = false;
  /** Danh tính lần thử, duy nhất trong vòng đời Agent này. */
  readonly attemptId: LlmAttemptId;

  /**
   * Lần thử đã bắt đầu này đã phát khung kết thúc chưa.
   * Trả: `true` khi khung `end` đã được phát.
   */
  get ended(): boolean {
    return this.terminal;
  }

  /**
   * Gắn danh tính lần thử và các bộ tích luỹ.
   * Nhận: `sessionId` — danh tính chỉ nhúng vào id lần thử cục bộ trong vòng đời Agent;
   * `attempt` — bộ đếm lần thử cục bộ của Session đã gắn; `nextRevision` — cấp số hiệu revision kế tiếp;
   * `turn` — lượt bền sở hữu yêu cầu; `step` — bước bền sở hữu yêu cầu;
   * `emit` — bộ phát thông báo phạm vi agent.
   * Trả: không (đây là constructor).
   */
  constructor(
    sessionId: SessionId,
    attempt: number,
    nextRevision: () => number,
    turn: number,
    step: number,
    emit: (frame: AssistantStreamFrame) => void,
  ) {
    this.nextRevision = nextRevision;
    this.turn = turn;
    this.step = step;
    this.emit = emit;
    this.attemptId = LlmAttemptId(`${sessionId}:${attempt}`);
  }

  /**
   * Phát dấu mở đầu TRƯỚC chunk đầu tiên được giao.
   * Nhận: không.
   * Trả: không.
   */
  start(): void {
    this.emit({
      type: "start",
      attemptId: this.attemptId,
      revision: this.nextRevision(),
      turn: this.turn,
      step: this.step,
    });
  }

  /**
   * Chụp MỘT chunk đúng một lần, rồi cho việc nén bền, việc lắp khối và việc phát trực tiếp dùng chung.
   * Nhận: `chunk` — chunk thô kế tiếp của model, theo thứ tự stream.
   * Trả: không.
   */
  push(chunk: StreamChunk): void {
    const timed = this.accumulator.push({
      time: Date.now(),
      chunk,
    });
    this.assembler.push(timed.chunk);
    this.emit({
      type: "chunk",
      attemptId: this.attemptId,
      revision: this.nextRevision(),
      index: this.index++,
      time: timed.time,
      chunk: timed.chunk,
    });
  }

  /**
   * Phát việc kết toán cuối sau khi sự kiện bền tương ứng đã commit.
   * Nhận: `eventType` — kiểu kết toán bền; `append` — phép nối bền ĐỒNG BỘ, trả số thứ tự đã commit.
   * Trả: không.
   * @throws Lỗi của `append` được NÉM LẠI nguyên vẹn sau khi lần thử đã được phát bỏ (abandon).
   */
  settle(eventType: "assistant/message" | "assistant/attempt", append: () => SessionSeq): void {
    let seq: SessionSeq;
    try {
      seq = append();
    } catch (error) {
      this.abandon();
      throw error;
    }
    this.terminal = true;
    this.emit({
      type: "end",
      attemptId: this.attemptId,
      revision: this.nextRevision(),
      index: this.index,
      outcome: {
        kind: "committed",
        eventType,
        seq,
      },
    });
  }

  /**
   * Phát việc phát bỏ khi KHÔNG thể commit sự kiện lần thử bền nào.
   * Nhận: không.
   * Trả: không.
   */
  abandon(): void {
    this.terminal = true;
    this.emit({
      type: "end",
      attemptId: this.attemptId,
      revision: this.nextRevision(),
      index: this.index,
      outcome: { kind: "abandoned" },
    });
  }

  /**
   * Stream gọn CHÍNH XÁC cho sự kiện bền cuối cùng.
   * Trả: bản sao mảng các bản ghi gọn của lần thử.
   */
  get stream(): SessionEventMap["assistant/attempt"]["stream"] {
    return [...this.accumulator.snapshot()];
  }

  /**
   * Các block của message hoàn chỉnh, dựng theo quy tắc chuẩn từ CÙNG những chunk đó.
   * Nhận: không.
   * Trả: các block nội dung đã lắp xong, theo thứ tự stream.
   */
  blocks(): ContentBlock[] {
    return this.assembler.blocks();
  }

  /**
   * Tiền tố AN TOÀN còn hiển thị được khi việc huỷ cắt ngang lần thử.
   * Nhận: không.
   * Trả: các block văn bản/suy luận đã đóng hoặc đang mở và có nội dung khác rỗng.
   */
  interruptedBlocks(): ContentBlock[] {
    return this.assembler.interruptedBlocks();
  }

  /**
   * Mức dùng MỚI NHẤT do adapter báo, nằm trong stream.
   * Trả: mức dùng token, hoặc `undefined` khi chưa có chunk `usage` nào.
   */
  get usage(): TokenUsage | undefined {
    return this.assembler.usage;
  }

  /**
   * Lý do kết thúc, mặc định là `stop` khi stream không khai.
   * Trả: lý do kết thúc của lần thử.
   */
  get finish(): FinishReason {
    return this.assembler.finish;
  }

  /**
   * Trạng thái phát lại do bản ghi finish kết thúc mang theo.
   * Trả: phong bì phát lại, hoặc `undefined` khi không có.
   */
  get replayState(): ReplayEnvelope | undefined {
    return this.assembler.replayState;
  }
}
