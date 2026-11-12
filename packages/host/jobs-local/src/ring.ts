/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Vòng đệm đầu ra có chặn của MỘT job: chunk ở offset byte tuyệt đối, cắt đầu mà không bao giờ
 *      đổi offset đã cấp, và đọc không tiêu thụ từ bất kỳ offset nào.
 */

import type { JobAppendOptions, JobChannel, JobChunk, JobOutputRead } from "@deepseek-ai/dsh-jobs";

/** Một chunk đang giữ trong vòng đệm: offset tuyệt đối, text, số byte, nhãn luồng và dấu mất byte. */
interface RetainedChunk {
  /** Offset byte tuyệt đối của byte đầu tiên của chunk. */
  at: number;
  /** Text nguyên như lúc ghi (có thể đã bị cắt đuôi khi quá cỡ). */
  text: string;
  /** Số byte UTF-8 của `text` — KHÔNG phải số ký tự. */
  bytes: number;
  /** Nhãn luồng, chỉ có khi producer khai. */
  channel?: JobChannel;
  /** true khi các byte NGAY TRƯỚC chunk này đã mất. */
  gapBefore?: true;
}

/**
 * Đuôi an toàn theo UTF-8 của `text` dài không quá `maxBytes`: mốc cắt tiến qua các byte nối nên
 * phần sống sót không bao giờ bắt đầu giữa một điểm mã.
 * Nhận: text của chunk quá cỡ và ngân sách byte dương NHỎ HƠN độ dài byte của nó.
 * Trả: phần đuôi sống sót và độ dài byte chính xác của nó.
 */
function utf8Tail(text: string, maxBytes: number): { text: string; bytes: number } {
  const raw = Buffer.from(text, "utf8");
  let start = raw.length - maxBytes;
  while (start < raw.length && (raw[start]! & 192) === 128) start += 1;
  const tail = raw.subarray(start);
  return { text: tail.toString("utf8"), bytes: tail.length };
}

/** Offset vẫn TUYỆT ĐỐI qua mọi lần cắt: `earliest` chỉ tiến, không bao giờ lùi. */
export class OutputRing {
  /** Các chunk đang giữ, theo thứ tự offset. */
  private readonly chunks: RetainedChunk[] = [];
  /** Tổng số byte của các chunk đang giữ. */
  retainedBytes = 0;
  /** Tổng số byte UTF-8 đã ghi từ trước tới nay — offset mà chunk kế tiếp sẽ bắt đầu. */
  total = 0;
  /** Offset của byte cũ nhất còn giữ (bằng `total` khi không giữ gì). */
  earliest = 0;

  /**
   * Ghi một chunk rồi cắt đầu cho vừa `cap`.
   * Nhận: text nguyên như producer tạo, tuỳ chọn nhãn luồng/dấu mất byte, và ngân sách byte sau khi ghi.
   * Trả: false khi chunk rỗng và không có gì thay đổi.
   */
  append(text: string, options: JobAppendOptions | undefined, cap: number): boolean {
    if (text.length === 0) return false;
    const bytes = Buffer.byteLength(text, "utf8");
    this.chunks.push({
      at: this.total,
      text,
      bytes,
      ...(options?.channel !== undefined ? { channel: options.channel } : {}),
      ...(options?.gapBefore !== undefined ? { gapBefore: options.gapBefore } : {}),
    });
    this.total += bytes;
    this.retainedBytes += bytes;
    this.trim(cap);
    return true;
  }

  /**
   * Bỏ dần chunk đầu tới khi vòng đệm vừa `cap`; một chunk quá cỡ DUY NHẤT chỉ giữ đuôi an toàn
   * UTF-8 kèm dấu `gapBefore`.
   * Nhận: ngân sách byte cần giữ.
   * Trả: không (sửa vòng đệm tại chỗ).
   */
  trim(cap: number): void {
    while (this.retainedBytes > cap && this.chunks.length > 1) {
      const dropped = this.chunks.shift();
      if (dropped === undefined) break;
      this.retainedBytes -= dropped.bytes;
    }
    const single = this.chunks.length === 1 ? this.chunks[0] : undefined;
    if (single !== undefined && single.bytes > cap) {
      const tail = utf8Tail(single.text, cap);
      single.at += single.bytes - tail.bytes;
      single.text = tail.text;
      single.bytes = tail.bytes;
      single.gapBefore = true;
      this.retainedBytes = tail.bytes;
    }
    this.earliest = this.chunks[0]?.at ?? this.total;
  }

  /**
   * Các chunk còn giữ có giao với `[from, total)`, dưới dạng chunk MỚI cho đường truyền.
   * Nhận: offset byte tuyệt đối cần đọc từ đó.
   * Trả: danh sách chunk, offset để đọc tiếp, và cờ cho biết byte trước đó đã bị cắt mất.
   */
  readFrom(from: number): JobOutputRead {
    const chunks: JobChunk[] = [];
    for (const chunk of this.chunks) {
      if (chunk.at + chunk.bytes <= from) continue;
      chunks.push({
        at: chunk.at,
        text: chunk.text,
        ...(chunk.channel !== undefined ? { channel: chunk.channel } : {}),
        ...(chunk.gapBefore !== undefined ? { gapBefore: chunk.gapBefore } : {}),
      });
    }
    return { chunks, next: this.total, lossy: from < this.earliest };
  }
}
