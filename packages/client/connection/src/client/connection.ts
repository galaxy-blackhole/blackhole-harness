/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Vòng đời thế hệ kết nối: mở nguồn thế hệ, phục hồi bằng backoff, tạm dừng khi trình duyệt offline
 */

import { resolveConnectionConfig, type ConnectionRecoveryConfig, type ResolvedConnectionRecoveryConfig } from "../recovery-config.ts";

/** Sự thật về Host mà khung mở của một thế hệ mang theo. */
export interface ConnectionHostInfo {
  /** Thư mục home của Host, nếu khung mở có nêu. */
  home?: string;
}

/** Một thế hệ kết nối đã thiết lập. */
export interface ConnectionGeneration {
  /** Số thứ tự thế hệ, tăng dần trong một lượt chạy. */
  id: number;
  /** Sự thật về Host của thế hệ này. */
  host: ConnectionHostInfo;
}

/** Trạng thái vòng đời phục hồi. */
export type ConnectionState = "connected" | "disconnected" | "connecting";

/** Nguồn định nghĩa các thế hệ Host; chỉ báo ready SAU khi đã gắn listener tăng dần của nó. */
export type ConnectionGenerationSource = (signal: AbortSignal, ready: (host: ConnectionHostInfo) => void) => Promise<void>;

/** Điểm nhận sự kiện của vòng lặp. */
export interface ConnectionSinks {
  /** Thế hệ vừa sẵn sàng. */
  onConnected?: (host: ConnectionHostInfo) => void;
  /** Trạng thái đổi. */
  onStateChange?: (state: ConnectionState) => void;
  /** Vòng lặp sắp thử lại; bên tiêu thụ có thể chủ động nối lại. */
  onReconnectRequested?: () => void;
}

/** Lý do chủ động nối lại: người dùng yêu cầu. */
const MANUAL_RECONNECT = new Error("connection: manual reconnect requested");

/** Lý do chủ động nối lại: trạng thái mạng của trình duyệt đổi. */
const NETWORK_STATE_CHANGED = new Error("connection: browser network state changed");

/**
 * Ngủ một khoảng, thức dậy sớm khi tín hiệu bị abort.
 * @param ms - số mili giây.
 * @param signal - tín hiệu vòng đời.
 * @returns promise hoàn tất khi hết giờ hoặc khi bị abort.
 */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
    function done(): void {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}

/**
 * Chờ một tín hiệu bị abort.
 * @param signal - tín hiệu vòng đời.
 * @returns promise hoàn tất khi tín hiệu đã abort.
 */
function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

/**
 * Chờ nguồn thế hệ báo ready, kèm ngưỡng cảnh báo và ngưỡng bỏ cuộc.
 * @param ready - promise do nguồn giải khi sẵn sàng.
 * @param config - nhịp đã áp mặc định.
 * @param signal - tín hiệu vòng đời của thế hệ.
 * @returns sự thật về Host khi sẵn sàng.
 * @throws Error khi quá hạn, hoặc khi tín hiệu abort trong lúc chờ.
 */
export function waitForReady(ready: Promise<ConnectionHostInfo>, config: ResolvedConnectionRecoveryConfig, signal: AbortSignal): Promise<ConnectionHostInfo> {
  return new Promise<ConnectionHostInfo>((resolve, reject) => {
    const warn = setTimeout(() => {
      console.warn("[connection] generation not ready after " + String(config.generationReadyWarnMs) + "ms");
    }, config.generationReadyWarnMs);
    const cleanup = (): void => {
      clearTimeout(warn);
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("connection: generation was not ready within " + String(config.generationReadyTimeoutMs) + "ms"));
    }, config.generationReadyTimeoutMs);
    const onAbort = (): void => {
      cleanup();
      reject(signal.reason instanceof Error ? signal.reason : new Error("connection: generation aborted during readiness handshake"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    ready.then((host) => {
      cleanup();
      resolve(host);
    }, (error: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error("connection generation failed", { cause: error }));
    });
  });
}

/**
 * Mở nguồn thế hệ đã đăng ký, nối lại bằng backoff khi mất, và phát trạng thái cho bên tiêu thụ.
 *
 * Trạng thái (thế hệ/số lần thử) là riêng của instance, không bao giờ nằm trong store. Lỗi của sink
 * KHÔNG giết vòng lặp.
 */
export class ConnectionController {
  /** Nguồn thế hệ. */
  private readonly source: ConnectionGenerationSource;

  /** Điểm nhận sự kiện. */
  private readonly sinks: ConnectionSinks;

  /** Nhịp đã áp mặc định. */
  private readonly config: ResolvedConnectionRecoveryConfig;

  /** Số thế hệ đã mở. */
  private generation = 0;

  /** Số lần thử lại liên tiếp. */
  private attempt = 0;

  /** Vòng đời của thế hệ đang mở. */
  private current: AbortController | null = null;

  /** Vòng đời của khoảng chờ thử lại. */
  private retryDelay: AbortController | null = null;

  /** Vòng lặp có đang chạy hay không. */
  private running = false;

  /** Có yêu cầu thử lại ngay hay không (bỏ qua backoff). */
  private immediateRetry = false;

  /** Trình duyệt có đang có mạng hay không. */
  private networkAvailable = true;

  /** Trạng thái đã phát gần nhất. */
  private lastState: ConnectionState | undefined;

  /**
   * @param source - nguồn định nghĩa các thế hệ.
   * @param sinks - điểm nhận sự kiện.
   * @param config - nhịp phục hồi (chưa đầy đủ cũng được, sẽ áp mặc định).
   */
  constructor(source: ConnectionGenerationSource, sinks: ConnectionSinks = {}, config: ConnectionRecoveryConfig = {}) {
    this.source = source;
    this.sinks = sinks;
    this.config = resolveConnectionConfig(config);
  }

  /** Bắt đầu vòng lặp nối/phục hồi; gọi lại lần nữa không có tác dụng. */
  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  /** Dừng vòng lặp và abort nguồn thế hệ đang mở. */
  stop(): void {
    this.running = false;
    this.current?.abort();
    this.current = null;
    this.retryDelay?.abort();
    this.retryDelay = null;
  }

  /** Xoá chuỗi thử lại và thay thế thế hệ hoặc khoảng chờ hiện tại ngay lập tức. */
  reconnect(): void {
    if (!this.running) return;
    this.attempt = 0;
    this.immediateRetry = true;
    this.emitState("connecting");
    if (!this.isRunning()) return;
    this.current?.abort(MANUAL_RECONNECT);
    this.retryDelay?.abort(MANUAL_RECONNECT);
  }

  /**
   * Tạm dừng thử lại tự động khi offline và khởi động lại backoff khi mạng trở lại.
   * @param available - trình duyệt có báo có mạng hay không.
   */
  setNetworkAvailable(available: boolean): void {
    if (this.networkAvailable === available) return;
    this.networkAvailable = available;
    this.attempt = 0;
    this.immediateRetry = false;
    if (!this.running) return;
    this.emitState(available ? "connecting" : "disconnected");
    if (!this.isRunning()) return;
    this.current?.abort(NETWORK_STATE_CHANGED);
    this.retryDelay?.abort(NETWORK_STATE_CHANGED);
  }

  /**
   * Trần thời gian chờ của một lần thử.
   * @param attempt - số thứ tự lần thử (bắt đầu từ 1).
   * @returns số mili giây.
   */
  private backoffCap(attempt: number): number {
    const { backoffBaseMs, backoffFactor, backoffMaxMs } = this.config;
    return Math.min(backoffMaxMs, backoffBaseMs * backoffFactor ** Math.max(0, attempt - 1));
  }

  /**
   * Thời gian chờ thực tế: nửa trần cố định, nửa ngẫu nhiên (chống dồn dập).
   * @param attempt - số thứ tự lần thử.
   * @returns số mili giây.
   */
  private backoffDelay(attempt: number): number {
    const cap = this.backoffCap(attempt);
    return cap / 2 + Math.random() * (cap / 2);
  }

  /**
   * Có bị ngắt giữa chừng bởi yêu cầu nối lại hoặc trạng thái mạng hay không.
   * @param immediate - lần này có phải thử lại ngay do người dùng yêu cầu hay không.
   * @returns true khi nên bỏ lần chờ này.
   */
  private isRetryInterrupted(immediate: boolean): boolean {
    return this.immediateRetry || (!this.networkAvailable && !immediate);
  }

  /** Đọc cờ chạy qua phương thức: stop() có thể lật cờ trong lúc await. */
  private isRunning(): boolean {
    return this.running;
  }

  /**
   * Phát trạng thái nếu nó đổi; lỗi của sink không được giết vòng lặp.
   * @param state - trạng thái mới.
   */
  private emitState(state: ConnectionState): void {
    if (this.lastState === state) return;
    this.lastState = state;
    this.callSink(() => this.sinks.onStateChange?.(state));
  }

  /**
   * Gọi một sink, nuốt lỗi của sink (giống bản gốc).
   * @param run - thân lời gọi.
   */
  private callSink(run: () => void): void {
    try {
      run();
    } catch (error) {
      console.error("[connection] sink threw:", error);
    }
  }

  /**
   * Thế hệ này còn hoạt động hay không (đọc lại cả hai cờ sau một sink có thể tái nhập).
   * @param controller - vòng đời của thế hệ.
   * @returns true khi vòng lặp còn chạy và thế hệ chưa bị abort.
   */
  private isGenerationActive(controller: AbortController): boolean {
    return this.isRunning() && !controller.signal.aborted;
  }

  /** Vòng lặp nối/phục hồi. */
  private async loop(): Promise<void> {
    let retry = false;
    while (this.running) {
      if (!this.networkAvailable && !this.immediateRetry) {
        const offline = new AbortController();
        this.retryDelay = offline;
        this.emitState("disconnected");
        await waitForAbort(offline.signal);
        if (this.retryDelay === offline) this.retryDelay = null;
        if (!this.isRunning()) return;
        retry = true;
        continue;
      }
      if (retry) {
        const immediate = this.immediateRetry;
        this.immediateRetry = false;
        if (immediate) this.attempt = 0;
        const attempt = ++this.attempt;
        this.emitState("connecting");
        if (!this.isRunning()) return;
        if (this.isRetryInterrupted(immediate)) continue;
        if (!immediate) {
          const delay = new AbortController();
          this.retryDelay = delay;
          await sleep(this.backoffDelay(attempt), delay.signal);
          if (this.retryDelay === delay) this.retryDelay = null;
          if (!this.isRunning()) return;
          if (delay.signal.aborted) continue;
        }
        console.warn("[connection] connection lost, retry #" + String(attempt));
        this.callSink(() => this.sinks.onReconnectRequested?.());
        if (!this.isRunning()) return;
      }
      const generation = ++this.generation;
      const controller = new AbortController();
      this.current = controller;
      let sourceReady = false;
      let resolveReady: ((host: ConnectionHostInfo) => void) | undefined;
      let rejectReady: ((error: Error) => void) | undefined;
      let rejectSourceLost: ((error: Error) => void) | undefined;
      const ready = new Promise<ConnectionHostInfo>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });
      const sourceLost = new Promise<never>((_resolve, reject) => {
        rejectSourceLost = reject;
      });
      const reportReady = (host: ConnectionHostInfo): void => {
        if (sourceReady || generation !== this.generation || !this.isGenerationActive(controller)) return;
        sourceReady = true;
        resolveReady?.(host);
      };
      const failed = new Promise<void>((resolve) => {
        const settle = (): void => {
          if (generation === this.generation && !controller.signal.aborted) controller.abort();
          resolve();
        };
        void Promise.resolve()
          .then(() => this.source(controller.signal, reportReady))
          .then(() => {
            const error = new Error("connection generation ended");
            if (!sourceReady) rejectReady?.(error);
            rejectSourceLost?.(error);
            settle();
          }, (error: unknown) => {
            const failure = error instanceof Error ? error : new Error("connection generation failed", { cause: error });
            if (!sourceReady) rejectReady?.(failure);
            rejectSourceLost?.(failure);
            settle();
          });
      });
      try {
        const host = await Promise.race([waitForReady(ready, this.config, controller.signal), sourceLost]);
        if (controller.signal.aborted) throw new Error("generation aborted during readiness handshake");
        this.attempt = 0;
        this.emitState("connected");
        if (this.isGenerationActive(controller)) this.callSink(() => this.sinks.onConnected?.(host));
      } catch (error) {
        if (!controller.signal.aborted) controller.abort(error);
      }
      await failed;
      retry = true;
    }
  }
}
