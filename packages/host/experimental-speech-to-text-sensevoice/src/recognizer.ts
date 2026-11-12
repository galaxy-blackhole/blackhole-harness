/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc MỘT worker SenseVoice tuần tự: hàng đợi có hạn mức, huỷ theo từng yêu cầu, thu hồi khi rảnh —
 *      port 1:1 region lib/types/recognizer.js (stock lib/index.js:382–881).
 */
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import type { Context } from "@deepseek-ai/cordis";
import type {
  SpeechInput,
  SpeechPreparationOptions,
  SpeechPreparationState,
  SpeechPreparationStep,
  SpeechPreparationStepKind,
  Transcript,
} from "@galaxy-blackhole/gbh-experimental-speech-to-text";
import type { SubprocessHandle } from "@deepseek-ai/dsh-subprocess";
import { deadline, timeoutOf } from "@deepseek-ai/dsh-timeout";
import { z } from "zod";
import type { Config } from "./config.ts";
import { SpeechDownloadError } from "./download-error.ts";
import { SpeechInputError } from "./input.ts";
import { inspectRuntime, prepareRuntime, type RuntimePaths } from "./runtime.ts";

/** Một worker đã sẵn sàng: handle tiến trình, URL loopback, token riêng và cờ đã đóng. */
interface WorkerHandle {
  /** Tiến trình con do Host quản lý. */
  readonly handle: SubprocessHandle;
  /** URL loopback có cổng động. */
  readonly url: string;
  /** Bí mật bearer riêng của tiến trình. */
  readonly token: string;
  /** Đã đóng (thoát hoặc bị dừng) hay chưa. */
  closed: boolean;
}

/** Một tác vụ chuẩn bị do Host sở hữu. */
interface PreparationTask {
  /** Huỷ riêng của tác vụ. */
  readonly abort: AbortController;
  /** Kết thúc sau khi công việc đã xếp hàng/chạy xong và trạng thái cuối đã công bố. */
  settled: Promise<void>;
  /** Cờ cho biết trạng thái cuối đã được công bố. */
  completed: boolean;
  /** Nguồn tải do người dùng chọn cho tác vụ này (undefined = chính sách triển khai). */
  readonly downloadSource: string | undefined;
}

/** Trạng thái nội bộ: luôn kèm danh sách bước đã chuẩn hoá (stock lib/index.js:559–565). */
type WorkerState = SpeechPreparationState & { readonly steps: readonly SpeechPreparationStep[] };

/** Hình dạng phản hồi transcript cuối cùng từ worker (stock lib/index.js:442–446). */
const transcriptSchema = z.object({
  text: z.string(),
  audioSeconds: z.number().nonnegative(),
  inferenceSeconds: z.number().nonnegative(),
}).strict();

/** Hình dạng khung readiness duy nhất của worker (stock lib/index.js:482). */
const readySchema = z.object({ port: z.number().int().min(1).max(65535) }).strict();

/**
 * Chờ một tác vụ có thể huỷ mà không mất quyền sở hữu kết cục của nó (stock lib/index.js:448–459).
 * Nhận: `pending` — tác vụ đang chạy; `signal` — huỷ của người gọi.
 * Trả: kết quả của `pending`; từ chối bằng lý do huỷ khi signal kích hoạt.
 */
function waitFor<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => {
      reject(signal.reason instanceof Error ? signal.reason : new Error("Speech operation cancelled"));
    };
    signal.addEventListener("abort", abort, { once: true });
    pending.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}

/**
 * Đọc MỘT khung readiness có giới hạn của worker và từ chối thoát trước khi sẵn sàng (stock lib/index.js:467–500).
 * Nhận: `handle` — worker vừa spawn với stdout pipe; `limit` — trần byte readiness; `signal` — deadline khởi động hoặc huỷ.
 * Trả: cổng loopback được cấp động.
 */
async function readReady(handle: SubprocessHandle, limit: number, signal: AbortSignal): Promise<number> {
  if (!handle.stdout) throw new Error("Speech worker stdout is unavailable");
  signal.throwIfAborted();
  const stdout = handle.stdout;
  let text = "";
  const pending = Promise.withResolvers<number>();
  const data = (chunk: Buffer): void => {
    text += chunk.toString("utf8");
    if (Buffer.byteLength(text) > limit) {
      pending.reject(new Error("Speech worker readiness exceeded its byte limit"));
      return;
    }
    const end = text.indexOf("\n");
    if (end < 0) return;
    try {
      const value = readySchema.parse(JSON.parse(text.slice(0, end)));
      pending.resolve(value.port);
    } catch (error) {
      pending.reject(new Error("Invalid speech worker readiness", { cause: error }));
    }
  };
  stdout.on("data", data);
  stdout.on("error", pending.reject);
  handle.done.then(() => {
    pending.reject(new Error(`Speech worker exited before readiness: ${handle.collected.stderr?.readFrom(0).text}`));
  }, pending.reject);
  try {
    return await waitFor(pending.promise, signal);
  } finally {
    stdout.off("data", data);
    stdout.off("error", pending.reject);
    stdout.resume();
  }
}

/**
 * Giải mã phản hồi HTTP có giới hạn của worker; đầu ra hỏng làm hỏng yêu cầu (stock lib/index.js:507–534).
 * Nhận: `response` — phản hồi worker đã xác thực; `limit` — số byte tối đa giữ trước khi parse JSON.
 * Trả: transcript cuối đã kiểm; loại đầu vào bị đánh dấu ném SpeechInputError.
 */
async function readTranscript(response: Response, limit: number): Promise<Transcript> {
  if (!response.body) throw new Error("Speech worker returned no response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw new Error("Speech transcript exceeded its byte limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!response.ok) {
    const failure = z.object({
      error: z.string(),
      code: z.literal("invalid-input").optional(),
    }).parse(value);
    if ((response.status === 400 || response.status === 413) && failure.code === "invalid-input") throw new SpeechInputError(failure.error);
    throw new Error(failure.error);
  }
  return transcriptSchema.parse(value);
}

/** Sở hữu MỘT worker qua nhiều bản ghi và join mọi việc đã nhận khi dispose (stock lib/index.js:536–881). */
export class SenseVoiceWorker {
  /** Context Host (subprocess + logger). */
  readonly ctx: Context;
  /** Cấu hình đã kiểm của provider. */
  readonly config: Config;
  /** Worker đang sống, nếu có. */
  worker: WorkerHandle | undefined;
  /** Đuôi tuần tự: mọi việc chạy sau việc trước đã settle. */
  tail: Promise<void> = Promise.resolve();
  /** Số việc đang chạy + đang chờ. */
  pending = 0;
  /** Vòng đời của provider. */
  readonly lifetime = new AbortController();
  /** Hẹn giờ thu hồi worker khi rảnh. */
  idle: ReturnType<typeof setTimeout> | undefined;
  /** Runtime đã xác minh (cache sau soi/nạp). */
  runtime: RuntimePaths | undefined;
  /** Trạng thái chuẩn bị do Host sở hữu. */
  state: WorkerState;
  /** Listener bị vô hiệu hoá khi trạng thái đổi. */
  readonly listeners = new Set<() => void>();
  /** Mốc thời gian của lần phát tiến độ gần nhất. */
  lastProgressAt = 0;
  /** Origin khả dụng cho tải tường minh; triển khai offline không đưa lựa chọn nào. */
  readonly downloadSources: string[];
  /** Tác vụ chuẩn bị đang chạy, nếu có. */
  preparing: PreparationTask | undefined;

  /**
   * Dựng worker từ context + cấu hình, đồng thời suy ra danh sách bước chuẩn bị ban đầu.
   * Nhận: `ctx` — context Host; `config` — cấu hình đã kiểm.
   * Trả: thực thể worker ở trạng thái `unprepared`.
   */
  constructor(ctx: Context, config: Config) {
    this.ctx = ctx;
    this.config = config;
    this.downloadSources = config.modelDirectory !== void 0 && config.vadModelPath !== void 0 ? [] : [...new Set((config.modelOrigin === void 0 ? config.modelOrigins : [config.modelOrigin]).map((origin) => new URL(origin).origin))];
    const kinds: SpeechPreparationStepKind[] = ["check"];
    if (config.modelDirectory === void 0) kinds.push("model");
    if (config.vadModelPath === void 0) kinds.push("vad");
    kinds.push("verify", "load");
    this.state = {
      phase: "unprepared",
      steps: kinds.map((kind) => ({
        kind,
        status: "pending",
      })),
    };
  }

  /**
   * Đọc trạng thái sẵn sàng hiện tại.
   * Nhận: không.
   * Trả: trạng thái chuẩn bị do Host sở hữu (không phải bản sao).
   */
  snapshot(): SpeechPreparationState {
    return this.state;
  }

  /**
   * Quan sát trạng thái sẵn sàng.
   * Nhận: `listener` — callback vô hiệu hoá.
   * Trả: hàm huỷ đăng ký.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Công bố trạng thái mới, suy ra danh sách bước và chặn tiến độ tải quá dày (stock lib/index.js:585–630).
   * Nhận: `state` — trạng thái Host muốn công bố.
   * Trả: không (thông báo listener khi trạng thái thực sự đổi).
   */
  publish(state: SpeechPreparationState): void {
    if (this.preparing && [
      "ready",
      "standby",
      "unprepared",
      "failed",
      "cancelled",
    ].includes(state.phase)) this.preparing.completed = true;
    const previous: WorkerState = this.state;
    const steps = state.steps ?? previous.steps.map((item): SpeechPreparationStep => {
      if (state.phase === "ready") return {
        ...item,
        status: "complete",
      };
      if (state.step === "check" && item.kind !== "check") return {
        kind: item.kind,
        status: "pending",
      };
      if (state.step === item.kind) return item.status === "running" ? item : {
        kind: item.kind,
        status: "running",
        startedAt: Date.now(),
      };
      if (item.status !== "running") return item;
      if (state.phase === "standby") return {
        ...item,
        status: "cancelled",
      };
      if (state.phase === "failed" || state.phase === "cancelled") return {
        ...item,
        status: state.phase,
      };
      return state.step === void 0 ? item : {
        ...item,
        status: "complete",
      };
    });
    this.state = {
      ...state,
      steps,
    } as WorkerState;
    const now = performance.now();
    if (state.phase === "downloading" && previous.phase === "downloading" && state.resource === previous.resource && state.completedBytes !== state.totalBytes && now - this.lastProgressAt < this.config.progressIntervalMs) return;
    this.lastProgressAt = now;
    for (const listener of this.listeners) listener();
  }

  /**
   * Soi cache trên đĩa lúc kích hoạt; tài nguyên hợp lệ vào standby mà KHÔNG khởi động worker (stock lib/index.js:632–663).
   * Nhận: không.
   * Trả: không (công bố trạng thái bất đồng bộ).
   */
  inspect(): void {
    this.runPreparation(async (signal) => {
      using inspection = deadline(signal, this.config.prepareTimeoutMs, "SPEECH_PREPARE_TIMEOUT");
      this.publish({
        phase: "checking",
        step: "check",
        startedAt: Date.now(),
      });
      const runtime = await inspectRuntime(this.config, inspection.signal);
      inspection.signal.throwIfAborted();
      this.runtime = runtime;
      this.publish({
        phase: runtime ? "standby" : "unprepared",
        steps: this.state.steps.map(({ kind }): SpeechPreparationStep => ({
          kind,
          status: kind === "check" || runtime !== void 0 && kind !== "load" ? "complete" : "pending",
        })),
      });
    });
  }

  /**
   * Khởi động hoặc join MỘT tác vụ chuẩn bị do Host sở hữu với nguồn tải cố định (stock lib/index.js:668–675).
   * Nhận: `options` — bỏ trống thì dùng chính sách triển khai; nguồn thủ công phải được quảng cáo và tắt fallback.
   * Trả: không (tác vụ chuẩn bị chạy nền).
   */
  prepare(options: SpeechPreparationOptions = {}): void {
    const source = options.downloadSource;
    if (source !== void 0 && !this.downloadSources.includes(source)) throw new Error("Speech download source is unavailable");
    const config = source === void 0 ? this.config : Object.assign({}, this.config, { modelOrigin: source });
    this.runPreparation(async (signal) => {
      await this.start(signal, config);
    }, source);
  }

  /**
   * Chạy một tác vụ chuẩn bị đã đăng ký, công bố lỗi thành trạng thái thất bại (stock lib/index.js:676–698).
   * Nhận: `run` — thân tác vụ; `downloadSource` — nguồn tải của tác vụ (undefined = chính sách triển khai).
   * Trả: không.
   */
  runPreparation(run: (signal: AbortSignal) => Promise<void>, downloadSource?: string): void {
    if (this.preparing && this.preparing.downloadSource !== downloadSource) throw new Error("Cancel preparation before changing its download source");
    if (this.preparing || this.worker) return;
    this.lifetime.signal.throwIfAborted();
    const abort = new AbortController();
    const task: PreparationTask = {
      abort,
      settled: Promise.resolve(),
      completed: false,
      downloadSource,
    };
    this.preparing = task;
    task.settled = this.enqueue(run, abort.signal).catch((error: unknown) => {
      if (this.lifetime.signal.aborted) return;
      this.publish(abort.signal.aborted ? { phase: "cancelled" } : {
        phase: "failed",
        message: error instanceof Error ? error.message : String(error),
        ...error instanceof SpeechDownloadError ? { download: error.download } : {},
      });
    }).finally(() => {
      this.preparing = void 0;
    });
  }

  /**
   * Huỷ chuẩn bị chưa xong; trạng thái sẵn sàng đã hoàn tất được giữ nguyên (stock lib/index.js:699–711).
   * Nhận: không.
   * Trả: sau khi công việc đang chạy/đang chờ của tác vụ đã settle.
   */
  async cancel(): Promise<void> {
    const task = this.preparing;
    if (!task) return;
    if (!task.completed) {
      this.publish({
        phase: "cancelling",
        startedAt: Date.now(),
      });
      task.abort.abort(new Error("Speech preparation cancelled"));
    }
    await task.settled;
  }

  /**
   * Xếp hàng MỘT bản ghi có giới hạn; huỷ không bao giờ để suy luận chạy tiếp sau khi settle (stock lib/index.js:719–721).
   * Nhận: `input` — WAV đầy đủ + gợi ý ngôn ngữ; `signal` — huỷ của người gọi.
   * Trả: văn bản đã nhận; việc đang chờ bị huỷ không bao giờ chiếm worker.
   */
  async transcribe(input: SpeechInput, signal: AbortSignal): Promise<Transcript> {
    return await this.enqueue(async (combined) => await this.execute(input, combined), signal);
  }

  /**
   * Xếp một việc vào đuôi tuần tự, đếm hạn mức và hẹn thu hồi khi rảnh (stock lib/index.js:722–744).
   * Nhận: `run` — thân việc nhận signal đã hợp; `signal` — huỷ của người gọi.
   * Trả: kết quả của việc; từ chối khi hàng đợi đầy hoặc đã huỷ.
   */
  async enqueue<T>(run: (combined: AbortSignal) => Promise<T>, signal: AbortSignal): Promise<T> {
    const combined = AbortSignal.any([signal, this.lifetime.signal]);
    combined.throwIfAborted();
    if (this.pending >= this.config.maxPending) throw new Error("Speech transcription queue is full");
    clearTimeout(this.idle);
    this.pending++;
    const job = this.tail.then(async () => {
      combined.throwIfAborted();
      return await run(combined);
    });
    this.tail = job.then(() => void 0, () => void 0).finally(() => {
      this.pending--;
      if (this.pending === 0 && !this.lifetime.signal.aborted && this.config.idleTimeoutMs > 0) this.idle = setTimeout(() => {
        this.tail = this.tail.then(async () => {
          await this.stop();
        });
        this.tail.catch((error: unknown) => {
          this.ctx.logger.warn("Speech worker idle cleanup failed", error);
        });
      }, this.config.idleTimeoutMs);
    });
    return await job;
  }

  /**
   * Khởi động worker (hoặc dùng lại worker đã sống), chuẩn bị runtime và đọc readiness (stock lib/index.js:745–820).
   * Nhận: `signal` — huỷ/deadline chuẩn bị; `preparationConfig` — cấu hình dùng cho tác vụ chuẩn bị.
   * Trả: worker sẵn sàng của provider.
   */
  async start(signal: AbortSignal, preparationConfig: Config = this.config): Promise<WorkerHandle> {
    if (this.worker?.closed) await this.stop();
    if (this.worker) return this.worker;
    using setup = deadline(signal, this.config.prepareTimeoutMs, "SPEECH_PREPARE_TIMEOUT");
    const cached = this.runtime !== void 0;
    if (!cached) this.publish({
      phase: "checking",
      step: "check",
      startedAt: Date.now(),
    });
    const runtime = this.runtime ?? await prepareRuntime(this.ctx, preparationConfig, setup.signal, (state) => {
      this.publish(state);
    });
    this.runtime = runtime;
    setup.signal.throwIfAborted();
    this.publish({
      phase: cached ? "waking" : "loading",
      step: "load",
      startedAt: Date.now(),
    });
    await mkdir(this.config.dataRoot, { recursive: true });
    const token = randomBytes(32).toString("hex");
    const handle = this.ctx.subprocess.spawn({
      argv: [
        process.execPath,
        ...runtime.worker.endsWith(".ts") ? ["--import", import.meta.resolve("tsx/esm")] : [],
        runtime.worker,
        JSON.stringify(Object.assign({}, this.config, runtime)),
      ],
      cwd: this.config.dataRoot,
      graceMs: this.config.graceMs,
      env: {
        DSH_SPEECH_TOKEN: token,
        ELECTRON_RUN_AS_NODE: "1",
      },
      stdio: {
        stdin: "ignore",
        stdout: "pipe",
        stderr: { maxBytes: this.config.maxLogBytes },
      },
    });
    try {
      const worker: WorkerHandle = {
        handle,
        url: `http://127.0.0.1:${await readReady(handle, this.config.maxLogBytes, setup.signal)}`,
        token,
        closed: false,
      };
      this.worker = worker;
      this.publish({ phase: "ready" });
      const exited = (): void => {
        if (!worker.closed) {
          worker.closed = true;
          this.publish({ phase: "standby" });
        }
      };
      handle.done.then(exited, exited);
      return worker;
    } catch (error) {
      handle.terminate();
      await handle.waitForExit();
      throw error;
    }
  }

  /**
   * Gửi MỘT bản ghi tới worker đã sẵn sàng và đọc transcript có hạn (stock lib/index.js:821–859).
   * Nhận: `input` — WAV + ngôn ngữ; `signal` — huỷ của người gọi.
   * Trả: transcript cuối; lỗi không phải đầu vào sẽ thu hồi worker rồi ném lại.
   */
  async execute(input: SpeechInput, signal: AbortSignal): Promise<Transcript> {
    const phase = this.state.phase;
    if (phase !== "ready" && phase !== "standby") throw new Error("Prepare the local speech provider before recording");
    try {
      const worker = await this.start(signal);
      using call = deadline(signal, this.config.inferenceTimeoutMs, "SPEECH_INFERENCE_TIMEOUT");
      const result = await readTranscript(await fetch(`${worker.url}/transcribe?language=${encodeURIComponent(input.language)}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${worker.token}`,
          "content-type": "audio/wav",
        },
        body: Buffer.from(input.audio),
        signal: call.signal,
      }), this.config.maxResponseBytes).catch((error: unknown) => {
        call.signal.throwIfAborted();
        throw error;
      });
      call.signal.throwIfAborted();
      return result;
    } catch (error) {
      if (error instanceof SpeechInputError) throw error;
      await this.stop();
      this.publish({ phase: "standby" });
      throw error;
    }
  }

  /**
   * Dừng worker đang sống và chờ tiến trình con thoát (stock lib/index.js:860–868).
   * Nhận: không.
   * Trả: sau khi worker đã thoát và trạng thái về standby.
   */
  async stop(): Promise<void> {
    const worker = this.worker;
    if (!worker) return;
    worker.closed = true;
    worker.handle.terminate();
    await worker.handle.waitForExit();
    this.worker = void 0;
    this.publish({ phase: "standby" });
  }

  /**
   * Dừng recognizer cục bộ và join toàn bộ việc đã nhận (stock lib/index.js:870–880).
   * Nhận: không.
   * Trả: sau khi cổng nhận việc đóng, việc đã xếp hàng settle và worker do Host quản lý đã thoát.
   */
  async dispose(): Promise<void> {
    this.listeners.clear();
    this.lifetime.abort(new Error("SenseVoice provider disposed"));
    clearTimeout(this.idle);
    try {
      await this.tail;
    } finally {
      await this.stop();
    }
    await this.preparing?.settled;
  }
}
