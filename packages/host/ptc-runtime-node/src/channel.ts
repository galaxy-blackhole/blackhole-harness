/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kênh điều khiển JSON có tiền tố độ dài (4 byte) giữa host và worker PTC: đầu vào có hạn, ghi xếp
 *      hàng, đóng/xả tường minh — port 1:1 vùng channel của @deepseek-ai/dsh-ptc-runtime-node (index.js 511–633)
 */

import { Buffer } from "node:buffer";
import type { Duplex } from "node:stream";

import { jsonValueBytesUpTo } from "./output-json.ts";

/* Length-prefixed JSON transport with bounded input and queued writes. */
const stringify = JSON.stringify;
const parse = JSON.parse;

/**
 * Giá trị JSON không mất mát đi qua kênh — BẢN KHAI TỐI THIỂU CỤC BỘ của kiểu peer `PtcJsonValue`
 * trong `@deepseek-ai/dsh-ptc-runtime` (peer KHÔNG được cài thật trong gói: `node_modules` chỉ là
 * symlink chưa commit, nên import thật sẽ là TS2307 ở máy chưa cài); giống hệt khai báo ở
 * ./output-json.ts nên hai bên dùng lẫn được.
 * Nhận: không (chỉ là khai báo kiểu).
 * Trả: không (không sinh mã lúc chạy).
 */
type PtcJsonValue = null | boolean | number | string | PtcJsonValue[] | { [key: string]: PtcJsonValue };

/**
 * Một lần ghi đang chờ biên nhận của stream (đúng hình dạng bản gốc dựng trong `send`).
 * Nhận: không (chỉ là khai báo kiểu).
 * Trả: không (không sinh mã lúc chạy).
 */
interface PendingWrite {
  /** Promise hoàn tất khi frame đã được stream nhận (hoặc reject khi transport lỗi). */
  readonly promise: Promise<void>;
  /** Kết thúc lần ghi: có lỗi ⇒ reject, không lỗi ⇒ resolve; gọi lặp là vô hại. */
  finish(error?: Error): void;
}

/**
 * One co-shipped process channel; the consumer owns frame validation and terminal outcomes.
 * Nhận: stream — duplex sở hữu bởi kênh này; maxBytes — trần cho MỖI frame và cho tổng byte đang xếp
 *   hàng; receive — nhận (giá trị JSON đã parse, số byte của frame); failure — báo lỗi kèm loại
 *   `io` | `protocol`.
 * Trả: không (lớp).
 */
export class JsonChannel {
  private readonly stream: Duplex;
  private readonly maxBytes: number;
  private readonly receive: (message: unknown, bytes: number) => void;
  private readonly failure: (error: Error, kind: "io" | "protocol") => void;
  private readonly header: Buffer = Buffer.alloc(4);
  private headerBytes = 0;
  private payload: Buffer | undefined;
  private payloadBytes = 0;
  private queuedBytes = 0;
  private closed = false;
  private readonly writes = new Set<PendingWrite>();

  /**
   * Gắn bốn listener của stream (data · error · end · close) — kênh sở hữu endpoint này.
   * Nhận: stream · maxBytes · receive · failure (như mô tả ở lớp).
   * Trả: không.
   */
  constructor(stream: Duplex, maxBytes: number, receive: (message: unknown, bytes: number) => void, failure: (error: Error, kind: "io" | "protocol") => void) {
    this.stream = stream;
    this.maxBytes = maxBytes;
    this.receive = receive;
    this.failure = failure;
    stream.on("data", this.onData);
    stream.on("error", this.onError);
    stream.on("end", this.onEnd);
    stream.on("close", this.onClose);
  }

  private readonly onError = (error: Error): void => {
    this.finishWrites(error);
    if (!this.closed) this.failure(error, "io");
  };

  private readonly onClose = (): void => {
    this.finishWrites(new Error("control channel closed during a write"));
  };

  private readonly onEnd = (): void => {
    if (!this.closed) this.failure(new Error("control channel ended before the program settled"), "io");
  };

  private readonly onData = (chunk: Buffer): void => {
    if (this.closed) return;
    try {
      let offset = 0;
      while (offset < chunk.length && !this.closed) {
        if (this.payload === undefined) {
          const bytes = Math.min(4 - this.headerBytes, chunk.length - offset);
          chunk.copy(this.header, this.headerBytes, offset, offset + bytes);
          this.headerBytes += bytes;
          offset += bytes;
          if (this.headerBytes !== 4) continue;
          const length = this.header.readUInt32BE(0);
          if (length === 0 || length > this.maxBytes) throw new Error(`control frame exceeds ${this.maxBytes} bytes or is empty`);
          this.payload = Buffer.allocUnsafe(length);
          this.payloadBytes = 0;
          this.headerBytes = 0;
        }
        const payload = this.payload;
        const bytes = Math.min(payload.length - this.payloadBytes, chunk.length - offset);
        chunk.copy(payload, this.payloadBytes, offset, offset + bytes);
        this.payloadBytes += bytes;
        offset += bytes;
        if (this.payloadBytes !== payload.length) continue;
        const frame = payload;
        this.payload = undefined;
        this.payloadBytes = 0;
        this.receive(parse(new TextDecoder("utf-8", { fatal: true }).decode(frame)), frame.length);
      }
    } catch (error) {
      this.failure(error instanceof Error ? error : new Error(String(error)), "protocol");
    }
  };

  /**
   * Submit a bounded frame immediately and await the stream's write receipt.
   * Nhận: message — giá trị giao thức JSON đi kèm trong tiến trình.
   * Trả: Promise<void> — xong khi frame đã ghi, hoặc reject sau lỗi transport (kênh đóng ⇒ reject ngay).
   */
  send(message: unknown): Promise<void> {
    if (this.closed) return Promise.reject(new Error("control channel is closed"));
    const size = jsonValueBytesUpTo(message as PtcJsonValue, this.maxBytes);
    if (size === undefined || this.queuedBytes + size > this.maxBytes) return Promise.reject(new Error(`control output exceeds ${this.maxBytes} queued bytes`));
    /* Bản gốc: Buffer.from(stringify(message), "utf8"). `jsonValueBytesUpTo` ở trên đã bảo đảm message
       là JSON hợp lệ nên stringify luôn trả chuỗi; ép kiểu chỉ để TypeScript thấy điều đó. */
    const body = Buffer.from(stringify(message) as string, "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length);
    this.queuedBytes += body.length;
    const completion = Promise.withResolvers<void>();
    const write: PendingWrite = {
      promise: completion.promise,
      finish: (error) => {
        if (!this.writes.delete(write)) return;
        this.queuedBytes -= body.length;
        if (error) completion.reject(error);
        else completion.resolve();
      }
    };
    this.writes.add(write);
    try {
      this.stream.cork();
      this.stream.write(header);
      this.stream.write(body, (error) => {
        write.finish(error ?? undefined);
      });
      this.stream.uncork();
    } catch (error) {
      write.finish(error instanceof Error ? error : new Error(String(error)));
    }
    return completion.promise;
  }

  /**
   * Kết thúc MỌI lần ghi đang chờ bằng cùng một lỗi (idempotent, xoá khỏi tập đang chờ).
   * Nhận: error — lỗi giao cho từng lần ghi.
   * Trả: không.
   */
  private finishWrites(error: Error): void {
    for (const write of this.writes) write.finish(error);
  }

  /**
   * Stop reads and close the owned endpoint; pending writes reject on closure.
   * Nhận: không.
   * Trả: không (đóng endpoint; lần ghi đang chờ bị reject).
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.payload = undefined;
    this.finishWrites(new Error("control channel is closed"));
    this.stream.off("data", this.onData);
    this.stream.off("end", this.onEnd);
    this.stream.destroy();
  }

  /**
   * Wait for accepted writes to finish or fail.
   * Nhận: không.
   * Trả: Promise<void> — xong khi mọi lần ghi đã được chấp nhận đều settled (không ném lỗi của chúng).
   */
  async drain(): Promise<void> {
    await Promise.allSettled([...this.writes].map((write) => write.promise));
  }
}
