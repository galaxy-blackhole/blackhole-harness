/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dịch vụ hẹn giờ sống-theo-fiber của cordis — bản viết lại của row `timer`
 *      (@deepseek-ai/cordis-plugin-timer 1.1.7): timeout · interval · throttle · debounce cùng hai
 *      bí danh cũ setTimeout · setInterval. Mọi bộ hẹn giờ đăng ký trên FIBER hiện tại nên tự được
 *      dọn khi plugin đã tạo ra chúng bị gỡ.
 */

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";

declare module "@deepseek-ai/cordis" {
  /** Bề mặt mà dịch vụ trộn thẳng vào `ctx` (giữ NGUYÊN VĂN danh sách của bản gốc). */
  interface Context extends Pick<TimerService, "interval" | "timeout" | "throttle" | "debounce" | "setTimeout" | "setInterval"> {
    /** Dịch vụ hẹn giờ dùng chung của cây plugin. */
    timer: TimerService;
  }
}

/** Hàm trả về kèm hàm huỷ bộ hẹn giờ của nó. */
type WithDispose<T> = T & { dispose: () => void };

/** Bộ hẹn giờ đã đăng ký, hoặc `undefined` khi lần gọi gần nhất không cần hẹn (nhánh `noTrailing`). */
type TimerHandle = ReturnType<typeof setTimeout> | undefined;

/** Hàm bọc do `_schedule` trả: gọi được như hàm gốc, kèm phương thức `.dispose`. */
type Scheduled = ((...args: unknown[]) => void) & { dispose: () => Promise<void> };

/** Nhãn effect của `timeout` — NGUYÊN VĂN bản gốc (vết `getEffects()` và log của kernel khoá theo chuỗi này). */
const LABEL_TIMEOUT = "ctx.timeout()";

/** Nhãn effect của `interval` — NGUYÊN VĂN bản gốc. */
const LABEL_INTERVAL = "ctx.interval()";

/** Nhãn effect của `throttle` — NGUYÊN VĂN bản gốc. */
const LABEL_THROTTLE = "ctx.throttle()";

/** Nhãn effect của `debounce` — NGUYÊN VĂN bản gốc. */
const LABEL_DEBOUNCE = "ctx.debounce()";

/** Câu lỗi khi fiber bị gỡ giữa lúc đang chờ — NGUYÊN VĂN bản gốc (ca test khẳng định từng chữ). */
const DISPOSED_MESSAGE = "Context has been disposed";

/** Sáu tên phương thức trộn vào `ctx` — NGUYÊN VĂN và ĐÚNG THỨ TỰ của bản gốc. */
const MIXED_IN_METHODS = ["timeout", "interval", "throttle", "debounce", "setTimeout", "setInterval"] as const;

/**
 * Tách đối số của hai overload "có hàm gọi lại / không có hàm gọi lại".
 * Nhận: mảng đối số thô của lượt gọi (`[callback, delay]` hoặc `[delay]`).
 * Trả: hàm gọi lại (hoặc `undefined`) và độ trễ — cắt ĐÚNG như bản gốc: đối số đầu bị `shift()`
 *      khi nó là hàm, nên độ trễ luôn là phần tử đầu còn lại.
 */
function splitCallback(args: unknown[]): { callback: (() => void) | undefined; delay: number } {
  const first = args[0];
  const callback = typeof first === "function" ? (args.shift() as () => void) : undefined;
  return { callback, delay: args[0] as number };
}

/**
 * Một promise kèm hai hàm giải quyết — ĐÚNG hình dạng mà `Promise.withResolvers()` trả về
 * (kiểu toàn cục `PromiseWithResolvers` không có trong lib ES2023 mà cổng dùng).
 */
interface Deferred<T> {
  /** Promise sẽ hoàn tất khi một trong hai hàm dưới được gọi. */
  promise: Promise<T>;
  /** Giải quyết promise với giá trị đã cho. */
  resolve: (value: T | PromiseLike<T>) => void;
  /** Từ chối promise với lý do đã cho. */
  reject: (reason?: unknown) => void;
}

/** Dịch vụ hẹn giờ trộn vào Cordis context. */
export class TimerService extends Service {
  constructor(ctx: Context) {
    super(ctx, "timer");
    ctx.mixin("timer", [...MIXED_IN_METHODS]);
  }

  /** @deprecated dùng `ctx.timeout()` thay thế — bí danh cũ, chuyển tiếp NGUYÊN VĂN. */
  setTimeout(callback: () => void, delay: number) {
    return this.timeout(callback, delay);
  }

  /** @deprecated dùng `ctx.interval()` thay thế — bí danh cũ, chuyển tiếp NGUYÊN VĂN. */
  setInterval(callback: () => void, delay: number) {
    return this.interval(callback, delay);
  }

  /** Chạy hàm gọi lại ĐÚNG MỘT lần, hoặc trả promise hoàn tất sau `delay` ms. */
  timeout(callback: () => void, delay: number): () => void;
  timeout(delay: number): Promise<void>;
  timeout(...args: unknown[]): any {
    const { callback, delay } = splitCallback(args);
    if (callback) {
      // Nhánh 1: tự gỡ effect NGAY trước khi gọi hàm — bộ hẹn giờ không bị tính là còn sống.
      const dispose = this.ctx.effect(() => {
        const timer = setTimeout(() => {
          dispose();
          callback();
        }, delay);
        return () => clearTimeout(timer);
      }, LABEL_TIMEOUT);
      return dispose;
    }
    // Nhánh 2: promise. Bị gỡ giữa lúc chờ ⇒ TỪ CHỐI với đúng câu lỗi của bản gốc.
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const dispose = this.ctx.effect(() => {
      const timer = setTimeout(resolve, delay);
      return () => {
        clearTimeout(timer);
        reject(new Error(DISPOSED_MESSAGE));
      };
    }, LABEL_TIMEOUT);
    return promise.finally(dispose);
  }

  /** Chạy hàm gọi lại LẶP LẠI, hoặc trả async iterator phát một nhịp mỗi `delay` ms. */
  interval(callback: () => void, delay: number): () => void;
  interval<R = any>(delay: number): AsyncIterableIterator<void, R, void>;
  interval(...args: unknown[]): any {
    const { callback, delay } = splitCallback(args);
    if (callback) {
      return this.ctx.effect(() => {
        const timer = setInterval(callback, delay);
        return () => clearInterval(timer);
      }, LABEL_INTERVAL);
    }
    // Nhánh iterator: giữ NGUYÊN mô hình trạng thái của bản gốc — một `done` ba khả năng
    // (chưa kết thúc · return · throw) và ĐÚNG MỘT `nextTask` đang chờ tại một thời điểm.
    let done: { kind: "return"; value: unknown } | { kind: "throw"; reason: unknown } | undefined;
    let nextTask: Deferred<IteratorResult<void>> | undefined;
    const dispose = this.ctx.effect(() => {
      const timer = setInterval(() => {
        nextTask?.resolve({ done: false, value: undefined });
      }, delay);
      return () => {
        clearInterval(timer);
        if (done) return;
        done = { kind: "throw", reason: new Error(DISPOSED_MESSAGE) };
        nextTask?.reject(done.reason);
      };
    }, LABEL_INTERVAL);
    return {
      next: () => {
        if (!done) return (nextTask = Promise.withResolvers<IteratorResult<void>>()).promise;
        if (done.kind === "return") return Promise.resolve<IteratorResult<void>>({ done: true, value: done.value as void });
        return Promise.reject(done.reason);
      },
      return: (value) => {
        if (!done) done = { kind: "return", value };
        nextTask?.resolve({ done: true, value });
        dispose();
        return Promise.resolve<IteratorResult<void>>({ done: true, value });
      },
      throw: (reason) => {
        if (!done) done = { kind: "throw", reason };
        nextTask?.reject(reason);
        dispose();
        return Promise.resolve<IteratorResult<void>>({ done: true, value: undefined });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    } satisfies AsyncIterableIterator<void>;
  }

  /**
   * Dựng hàm bọc dùng chung cho `throttle`/`debounce`: mỗi lượt gọi huỷ bộ hẹn giờ CŨ rồi hẹn mới.
   * Nhận: nhãn effect, hàm `trigger` chạy mỗi lượt gọi (nhận đối số + cờ đã-bị-gỡ), và giá trị ĐẦU của cờ đó.
   * Trả: hàm bọc kèm `.dispose` — gỡ effect thì cờ bật và bộ hẹn giờ bị huỷ.
   */
  private _schedule(label: string, trigger: (args: unknown[], isDisposed: boolean) => TimerHandle, isDisposed = false): Scheduled {
    let timer: TimerHandle;
    const dispose = this.ctx.effect(() => () => {
      isDisposed = true;
      clearTimeout(timer);
    }, label);
    return Object.assign(
      (...args: unknown[]): void => {
        clearTimeout(timer);
        timer = trigger(args, isDisposed);
      },
      { dispose },
    );
  }

  /**
   * Trả hàm THROTTLE: lượt gọi đầu chạy ngay, các lượt trong cửa sổ `delay` bị dồn thành MỘT lượt cuối.
   * Nhận: hàm gọi lại, độ trễ cửa sổ, và `noTrailing` (đúng ⇒ bỏ hẳn lượt cuối).
   * Trả: hàm bọc kèm `.dispose` để dọn bộ hẹn giờ cùng fiber.
   */
  throttle<F extends (...args: any[]) => void>(callback: F, delay: number, noTrailing?: boolean): WithDispose<F> {
    const fn = callback as (...args: unknown[]) => void;
    // `lastCall` âm vô cực để lượt ĐẦU luôn chạy ngay (remaining = delay - now + (-Infinity) <= 0).
    let lastCall = -Infinity;
    const execute = (...args: unknown[]) => {
      lastCall = Date.now();
      fn(...args);
    };
    const scheduled = this._schedule(
      LABEL_THROTTLE,
      (args, isDisposed) => {
        const remaining = delay - Date.now() + lastCall;
        if (remaining <= 0) {
          execute(...args);
          return undefined;
        }
        if (!isDisposed) return setTimeout(execute, remaining, ...args);
        return undefined;
      },
      noTrailing,
    );
    return scheduled as unknown as WithDispose<F>;
  }

  /**
   * Trả hàm DEBOUNCE: mỗi lượt gọi dời bộ hẹn giờ, chỉ lượt CUỐI trong cửa sổ `delay` được chạy.
   * Nhận: hàm gọi lại và độ trễ.
   * Trả: hàm bọc kèm `.dispose` để dọn bộ hẹn giờ cùng fiber.
   */
  debounce<F extends (...args: any[]) => void>(callback: F, delay: number): WithDispose<F> {
    const fn = callback as (...args: unknown[]) => void;
    const scheduled = this._schedule(LABEL_DEBOUNCE, (args, isDisposed) => {
      if (isDisposed) return undefined;
      return setTimeout(fn, delay, ...args);
    });
    return scheduled as unknown as WithDispose<F>;
  }
}

export default TimerService;
