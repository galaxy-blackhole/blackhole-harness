/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bơm nguồn kéo do sổ đăng ký tự vận hành: chép nguồn đầu ra của job vào vòng đệm theo nhịp có
 *      chặn, và hút một lần cuối sau khi producer kết thúc. Tiện ích thuần — không cordis, không
 *      hẹn giờ nào sống sót qua lúc kết thúc.
 */

import type { JobAppendOptions, JobOutputSource } from "@deepseek-ai/dsh-jobs";

/** Một lượt bơm; `done` thoả sau lần hút cuối cùng (sau khi producer kết thúc). */
export interface PumpHandle {
  /** Thoả khi lượt bơm kết thúc hẳn, kể cả lần hút cuối. */
  done: Promise<void>;
}

/** Nơi bơm giao những gì nó đọc được. */
export interface PumpSink {
  /**
   * Ghi text đã chép vào vòng đệm.
   * Nhận: text của chunk đúng như đọc được, và tuỳ chọn nhãn luồng/dấu mất byte.
   * Trả: không.
   */
  append(text: string, options?: JobAppendOptions): void;
  /**
   * Ghi nhận file tràn mà nguồn ở vị trí `index` khai ở lần đọc gần nhất; gọi ở MỌI lần đọc, với
   * `undefined` khi nguồn không giữ file nào hoặc đã rút lại.
   * Nhận: chỉ số nguồn trong mảng nguồn của bơm, và đường dẫn trên máy mà nguồn báo (nếu có).
   * Trả: không.
   */
  spill(index: number, path: string | undefined): void;
}

/**
 * Hút mọi nguồn theo thứ tự mảng, ngủ `pollMs` hoặc tới khi `until` kết thúc, lặp lại, rồi hút
 * thêm một lần cuối. Một lần đọc mất byte sẽ ghi phần đuôi còn lại kèm `gapBefore`, để chỗ đứt
 * vẫn hiện ra với người quan sát. Mỗi vòng hút theo thứ tự mảng, nên byte của hai nguồn trong cùng
 * một cửa sổ poll vào vòng đệm theo thứ tự mảng chứ không theo thứ tự được ghi: vòng đệm là bản
 * xem sống "cố gắng nhất", sai thứ tự giữa các nguồn bị chặn trần bởi `pollMs`.
 *
 * Việc chờ giữ tài nguyên KHÔNG ĐỔI dù job chạy bao lâu: một subscription trên `until` cho cả
 * lượt chạy và đúng một hẹn giờ đang treo tại mỗi thời điểm.
 * Nhận: nguồn của producer (mỗi nguồn bơm theo offset riêng), nơi nhận, chu kỳ poll (ms, số hữu hạn
 * dương), và lời hứa kết thúc khi producer xong (chỉ dùng `then`).
 * Trả: handle mà `done` thoả sau lần hút cuối.
 */
export function startPump(
  sources: readonly JobOutputSource[],
  sink: PumpSink,
  pollMs: number,
  until: PromiseLike<unknown>,
): PumpHandle {
  if (!Number.isFinite(pollMs) || pollMs <= 0) {
    throw new Error(`invalid pump pollMs: expected a positive finite number of milliseconds, got ${JSON.stringify(pollMs)}`);
  }
  const states = sources.map((source) => ({ source, cursor: 0 }));
  const drain = (): void => {
    for (const [index, state] of states.entries()) {
      const { source } = state;
      const read = source.read(state.cursor);
      state.cursor = read.nextOffset;
      sink.spill(index, read.spillPath);
      if (read.text.length === 0) continue;
      if (source.channel === undefined && !read.lossy) sink.append(read.text);
      else
        sink.append(read.text, {
          ...(source.channel !== undefined ? { channel: source.channel } : {}),
          ...(read.lossy ? { gapBefore: true as const } : {}),
        });
    }
  };
  return {
    done: (async () => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let wake: (() => void) | undefined;
      const finish = (): void => {
        settled = true;
        clearTimeout(timer);
        wake?.();
      };
      until.then(finish, finish);
      while (!settled) {
        drain();
        await new Promise<void>((resolve) => {
          wake = resolve;
          timer = setTimeout(resolve, pollMs);
        });
        wake = undefined;
        timer = undefined;
      }
      drain();
    })(),
  };
}
