/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ba tiện ích nội bộ của row commands: chuẩn hoá lý do huỷ thành Error, đọc trạng thái huỷ, và dừng chờ handler không hợp tác.
 */

/** Lý do huỷ đã chuẩn hoá thành một Error ổn định. */
type AbortReason = Error;

/**
 * Chuyển lý do huỷ bất kỳ thành MỘT Error bị từ chối ổn định.
 * Nhận: `signal` — tín hiệu đã huỷ (hoặc chưa).
 * Trả: `signal.reason` khi nó đã là `Error`; ngược lại `Error` của chuỗi lý do,
 * hoặc `"command aborted"` khi lý do không phải chuỗi.
 */
export function abortError(signal: AbortSignal): AbortReason {
  if (signal.reason instanceof Error) return signal.reason;
  return new Error(typeof signal.reason === "string" ? signal.reason : "command aborted");
}

/**
 * Lỗi huỷ đã chuẩn hoá của tín hiệu, khi tín hiệu ĐÃ huỷ.
 * Nhận: `signal` — tín hiệu cần xét.
 * Trả: lỗi huỷ, hoặc `undefined` khi tín hiệu chưa huỷ.
 */
export function cancellationOf(signal: AbortSignal): AbortReason | undefined {
  return signal.aborted ? abortError(signal) : undefined;
}

/**
 * Vẽ một giá trị bị ném ra mà KHÔNG tin vào phép ép chuỗi của nó.
 * Nhận: `value` — giá trị bất kỳ bị ném.
 * Trả: chuỗi `String(value)`, hoặc `"<unrenderable thrown value>"` khi phép ép ném.
 */
export function renderThrown(value: unknown): string {
  try {
    return String(value);
  } catch {
    return "<unrenderable thrown value>";
  }
}

/**
 * Ngừng chờ một handler không hợp tác ngay khi yêu cầu UI sở hữu nó bị huỷ.
 *
 * Nhận: `promise` — lời hứa của handler; `signal` — tín hiệu huỷ của yêu cầu UI.
 * Trả: lời hứa của handler; bị từ chối bằng lỗi huỷ đã chuẩn hoá khi tín hiệu huỷ, và
 * một lần từ chối KHÔNG phải Error được bọc thành Error kèm `cause`.
 */
export function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      signal.removeEventListener("abort", onAbort);
      reject(abortError(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(
          error instanceof Error
            ? error
            : new Error(`command handler rejected with a non-Error value: ${renderThrown(error)}`, { cause: error }),
        );
      },
    );
  });
}
