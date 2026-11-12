/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Xả (drain) đầu ra thô của tiến trình PTC có giới hạn thời gian, rồi kết thúc tiến trình đã quản lý —
 *      port 1:1 vùng output-stream của @deepseek-ai/dsh-ptc-runtime-node (index.js 880–933)
 */

import type { Readable } from "node:stream";

/**
 * Bounded drainage for raw process output after managed execution ends.
 * Phần TỐI THIỂU của `SubprocessHandle` (@deepseek-ai/dsh-subprocess KHÔNG được cài thật trong gói:
 * `node_modules` chỉ là symlink chưa commit) mà hàm này chạm tới: hai ống thô, `done`, `terminate`,
 * `waitForExit`.
 * Nhận: không (khai báo kiểu).
 * Trả: không (không sinh mã lúc chạy).
 */
interface SubprocessHandle {
  /** The child's raw stdout, present iff spawned with `stdout: 'pipe'`. */
  readonly stdout: Readable | undefined;
  /** The child's raw stderr, present iff spawned with `stderr: 'pipe'`. */
  readonly stderr: Readable | undefined;
  /** Resolves with spawned-command exit facts; rejects for spawn or provider failures. */
  readonly done: Promise<unknown>;
  /** Begin the provider's documented termination procedure on the managed range (idempotent). */
  terminate(): void;
  /**
   * Wait until the managed range is empty; `false` when the signal aborted first.
   * Kiểu trả để RỘNG (`Promise<unknown>`) cho tương thích với mọi bản khai tối thiểu khác của cùng
   * peer trong gói; hàm ở đây chỉ await, không đọc giá trị.
   */
  waitForExit(signal?: AbortSignal): Promise<unknown>;
}

/**
 * Wait for queued bytes without letting an inherited descriptor retain a run forever.
 * Nhận: stream — đầu ra thô của tiến trình (có thể undefined); graceMs — hạn chờ tối đa sau khi
 *   tiến trình đã bị kết thúc (ms).
 * Trả: Promise<boolean> — true khi stream đã kết thúc TRỌN VẸN mà không lỗi truyền; false khi đóng/
 *   lỗi/hết hạn chờ.
 */
export function drainOutput(stream: Readable | undefined, graceMs: number): Promise<boolean> {
  if (stream === undefined || stream.readableEnded) return Promise.resolve(true);
  if (stream.destroyed) return Promise.resolve(false);
  return new Promise((resolve) => {
    const finish = (complete: boolean) => {
      clearTimeout(timer);
      stream.off("end", onEnd);
      stream.off("close", onClose);
      stream.off("error", onError);
      resolve(complete);
    };
    const onEnd = () => {
      finish(true);
    };
    const onClose = () => {
      finish(false);
    };
    const onError = () => {
      finish(false);
    };
    const timer = setTimeout(() => {
      finish(false);
    }, graceMs);
    stream.once("end", onEnd);
    stream.once("close", onClose);
    stream.once("error", onError);
  });
}

/**
 * Terminate a managed process and drain its pipes, including failures before output listeners attach.
 * Nhận: handle — tiến trình + hai ống do runtime sở hữu; graceMs — hạn chờ xả ống sau khi tiến trình
 *   đã thoát (ms).
 * Trả: Promise<boolean> — true khi CẢ HAI ống stdout/stderr kết thúc sạch (không có false nào).
 */
export async function terminateProcess(handle: SubprocessHandle, graceMs: number): Promise<boolean> {
  try {
    handle.terminate();
    handle.stdout?.resume();
    handle.stderr?.resume();
    await Promise.all([handle.done.catch(() => {}), handle.waitForExit()]);
    return !(await Promise.all([drainOutput(handle.stdout, graceMs), drainOutput(handle.stderr, graceMs)])).includes(false);
  } finally {
    handle.stdout?.destroy();
    handle.stderr?.destroy();
  }
}
