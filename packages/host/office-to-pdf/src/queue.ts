/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nhận nguồn CÓ TRẦN, CHIA SẺ một lần chuyển đổi cho nhiều bên đọc đã cấp quyền, và giao PDF thuộc bên gọi —
 *      bản viết lại 1:1 `ConversionQueue` của `@deepseek-ai/dsh-office-to-pdf`.
 */

import { createHash } from "node:crypto";

import { OfficeToPdfError } from "./errors.ts";
import { OfficeToPdfKey } from "./identity.ts";
import type { OfficeToPdfGeneration } from "./identity.ts";
import type { Config } from "./service.ts";
import type { OfficeExtension, OfficeToPdfRequest, OfficeToPdfResult } from "./types.ts";

/** Kết quả thô của MỘT lần chuyển đổi do engine trả. */
export type Converted = Pick<OfficeToPdfResult, "pdf" | "missingFonts">;

/** Hàm chuyển đổi: byte nguồn + định dạng + tín hiệu ⇒ PDF. */
export type Convert = (bytes: Uint8Array, extension: OfficeExtension, signal: AbortSignal) => Promise<Converted>;

/** Một bên đọc đã cấp quyền đang chờ MỘT việc chuyển đổi dùng chung. */
interface Reader {
  /** Việc đang phục vụ bên đọc này. */
  job: Job;
  /** Khoá nguồn (để gỡ khỏi sổ khi bên đọc rời). */
  source: string;
  /** Mức ưu tiên của bên đọc. */
  priority: OfficeToPdfRequest["priority"];
  /** Giải promise của bên gọi. */
  resolve(result: OfficeToPdfResult): void;
  /** Từ chối promise của bên gọi. */
  reject(error: unknown): void;
  /** Gỡ listener huỷ. */
  cleanup(): void;
}

/** MỘT tác vụ chuyển đổi dùng chung (một nguồn hoặc một digest nội dung). */
interface Job {
  /** Yêu cầu đã cấp quyền (kèm hàm đọc hoãn lại). */
  request: OfficeToPdfRequest;
  /** Mức ưu tiên hiệu lực. */
  priority: OfficeToPdfRequest["priority"];
  /** Huỷ việc này. */
  controller: AbortController;
  /** Các bên đọc đang chờ. */
  readers: Set<Reader>;
  /** Các khoá nguồn cùng trỏ về việc này. */
  sources: Set<string>;
  /** Trạng thái sống của việc. */
  state: "queued" | "running" | "finished";
}

/** MỘT thế hệ bộ chuyển đổi sở hữu mọi nguồn đang xếp hàng, chuyển đổi, bên đọc, và PDF còn giữ. */
export class ConversionQueue {
  /** Hạn mức đã kiểm. */
  private readonly config: Config;
  /** Thế hệ provider; chặn dùng lại sau khi thay engine/font. */
  private readonly generation: OfficeToPdfGeneration;
  /** Hàm chuyển đổi một lần đã nhận. */
  private readonly convert: Convert;
  /** PDF đã giữ theo định danh nội dung (thứ tự LRU). */
  private readonly ready = new Map<string, OfficeToPdfResult>();
  /** Bí danh khoá nguồn ⇒ định danh nội dung. */
  private readonly aliases = new Map<string, string>();
  /** Việc đang sống theo khoá nguồn. */
  private readonly sources = new Map<string, Job>();
  /** Việc đang sống theo định danh nội dung. */
  private readonly digests = new Map<string, Job>();
  /** Hàng đợi việc đã nhận nhưng chưa chạy. */
  private readonly queue: Job[] = [];
  /** Các promise đang chạy (để `dispose()` chờ). */
  private readonly tasks = new Set<Promise<void>>();
  /** Mọi việc đang sống. */
  private readonly jobs = new Set<Job>();
  /** Byte PDF đã giữ. */
  private cachedBytes = 0;
  /** Byte nguồn đã giữ chỗ cho các việc đang chạy. */
  private sourceBytes = 0;
  /** Số lần chuyển đổi đang chạy. */
  private running = 0;
  /** Số lần chuyển đổi NỀN đang chạy. */
  private background = 0;
  /** Số bên đọc đang mở. */
  private readers = 0;
  /** Đã dọn chưa. */
  private disposed = false;

  /**
   * @param config - hạn mức hàng đợi, nguồn, bên đọc, và kết quả đã hoàn tất.
   * @param generation - vòng đời provider; chặn dùng lại sau khi thay engine hoặc font.
   * @param convert - thi hành MỘT lần chuyển đổi đã nhận và chỉ xong sau khi dọn thư mục tạm.
   */
  constructor(config: Config, generation: OfficeToPdfGeneration, convert: Convert) {
    this.config = config;
    this.generation = generation;
    this.convert = convert;
  }

  /**
   * Nhận siêu dữ liệu TRƯỚC khi nạp byte nguồn, và chia sẻ lần chuyển đổi cho các bên đọc đã cấp quyền.
   * Nhận: yêu cầu đã cấp quyền (kèm hàm đọc hoãn lại có trần), và tín hiệu huỷ của bên đọc này.
   * Trả: byte PDF ĐỘC LẬP; bên đọc bận/bị huỷ reject mà không nhả sớm sức chứa engine đang chạy.
   */
  async read(request: OfficeToPdfRequest, signal?: AbortSignal): Promise<OfficeToPdfResult> {
    signal?.throwIfAborted();
    if (this.disposed) throw this.unavailable();
    if (request.source.bytes !== undefined && request.source.bytes > this.config.maxInputBytes) {
      throw new OfficeToPdfError("input-too-large", "The Office source exceeds maxInputBytes.");
    }
    const source = JSON.stringify([request.source.key, request.source.version, request.extension]);
    const alias = this.aliases.get(source);
    const cached = alias === undefined ? undefined : this.ready.get(alias);
    if (cached !== undefined) {
      this.ready.delete(cached.cacheKey);
      this.ready.set(cached.cacheKey, cached);
      this.aliases.delete(source);
      this.aliases.set(source, cached.cacheKey);
      return this.copy(cached);
    }
    const readerLimit = request.priority === "background" ? this.config.maxReaders - 1 : this.config.maxReaders;
    if (this.readers >= readerLimit) throw this.busy();
    if (request.priority === "background" && this.config.maxBackgroundConversions === 0) throw this.busy();
    let job = this.sources.get(source);
    if (job === undefined) {
      if (this.queue.length >= this.config.maxQueuedJobs) {
        const obsolete = request.priority === "foreground" ? this.queue.find((item) => item.priority === "background") : undefined;
        if (obsolete === undefined) throw this.busy();
        this.fail(obsolete, this.busy());
      }
      job = {
        request,
        priority: request.priority,
        controller: new AbortController(),
        readers: new Set(),
        sources: new Set([source]),
        state: "queued",
      };
      this.sources.set(source, job);
      this.jobs.add(job);
      this.queue.push(job);
    }
    const shared = job;
    if (request.priority === "foreground") shared.priority = "foreground";
    this.readers++;
    const promise = new Promise<OfficeToPdfResult>((resolve, reject) => {
      const abort = (): void => {
        this.release(reader);
        const reason = signal?.reason;
        reject(reason instanceof Error ? reason : new Error("Office conversion cancelled", { cause: reason }));
        if (reader.job.readers.size === 0) this.cancel(reader.job);
        this.drain();
      };
      const reader: Reader = {
        job: shared,
        source,
        priority: request.priority,
        resolve,
        reject,
        cleanup: () => signal?.removeEventListener("abort", abort),
      };
      shared.readers.add(reader);
      signal?.addEventListener("abort", abort, { once: true });
    });
    this.drain();
    return promise;
  }

  /** Huỷ mọi bên đọc và chờ tới khi việc đọc/chuyển đổi/dọn thư mục tạm THẬT SỰ xong. */
  async dispose(): Promise<void> {
    this.disposed = true;
    for (const job of this.jobs) this.fail(job, this.unavailable());
    this.ready.clear();
    this.aliases.clear();
    this.cachedBytes = 0;
    await Promise.allSettled(this.tasks);
  }

  /** Lỗi "đã chạm hạn mức nhận". */
  private busy(): OfficeToPdfError {
    return new OfficeToPdfError("busy", "The document converter has reached its admission limit.");
  }

  /** Lỗi "bộ chuyển đổi không dùng được". */
  private unavailable(): OfficeToPdfError {
    return new OfficeToPdfError("unavailable", "The document converter is unavailable.");
  }

  /** Bản sao PDF độc lập cho MỘT bên gọi. */
  private copy(result: OfficeToPdfResult): OfficeToPdfResult {
    return { ...result, pdf: Uint8Array.from(result.pdf), missingFonts: [...result.missingFonts] };
  }

  /** Gỡ MỘT bên đọc khỏi việc của nó và cập nhật sổ. */
  private release(reader: Reader): void {
    reader.job.readers.delete(reader);
    if (reader.job.state === "queued") {
      reader.job.priority = [...reader.job.readers].some((other) => other.priority === "foreground")
        ? "foreground"
        : "background";
    }
    if (![...reader.job.readers].some((other) => other.source === reader.source)) {
      reader.job.sources.delete(reader.source);
      if (this.sources.get(reader.source) === reader.job) this.sources.delete(reader.source);
    }
    reader.cleanup();
    this.readers--;
  }

  /** Huỷ MỘT việc (và gỡ khỏi hàng đợi nếu còn xếp hàng). */
  private cancel(job: Job): void {
    job.controller.abort();
    if (job.state === "queued") {
      this.queue.splice(this.queue.indexOf(job), 1);
      job.state = "finished";
      this.jobs.delete(job);
    }
  }

  /** Từ chối MỌI bên đọc của MỘT việc rồi huỷ việc. */
  private fail(job: Job, error: unknown): void {
    for (const reader of job.readers) {
      this.release(reader);
      reader.reject(error);
    }
    this.cancel(job);
  }

  /** Sức chứa nguồn phải giữ chỗ cho MỘT việc. */
  private reservation(job: Job): number {
    return Math.max(1, job.request.source.bytes ?? this.config.maxInputBytes);
  }

  /** Nhận thêm việc chạy được, tôn trọng hạn mức đồng thời/nguồn/nền và ưu tiên tiền cảnh. */
  private drain(): void {
    while (!this.disposed && this.running < this.config.maxConcurrentConversions) {
      const eligible = (job: Job): boolean =>
        this.sourceBytes + this.reservation(job) <= this.config.maxSourceBytes &&
        (job.priority === "foreground" ||
          this.background < Math.min(this.config.maxBackgroundConversions, Math.max(1, this.config.maxConcurrentConversions - 1)));
      const foregroundWaiting = this.queue.some((item) => item.priority === "foreground");
      const job = this.queue.find((item) => (!foregroundWaiting || item.priority === "foreground") && eligible(item));
      if (job === undefined) return;
      this.queue.splice(this.queue.indexOf(job), 1);
      job.state = "running";
      const background = job.priority === "background";
      const reserved = this.reservation(job);
      this.running++;
      if (background) this.background++;
      this.sourceBytes += reserved;
      const task = this.execute(job, reserved)
        .catch((error: unknown) => {
          this.fail(job, error);
        })
        .finally(() => {
          this.running--;
          if (background) this.background--;
          this.sourceBytes -= reserved;
          job.state = "finished";
          this.jobs.delete(job);
          this.tasks.delete(task);
          this.drain();
        });
      this.tasks.add(task);
    }
  }

  /** Đọc nguồn, khử trùng theo digest, chuyển đổi, và giao kết quả. */
  private async execute(job: Job, reserved: number): Promise<void> {
    const signal = job.controller.signal;
    signal.throwIfAborted();
    const input = await job.request.source.read(signal, reserved);
    signal.throwIfAborted();
    if (input.version !== job.request.source.version) {
      throw new OfficeToPdfError("source-changed", "The source changed while waiting for conversion.");
    }
    if (input.bytes.byteLength > reserved) {
      throw new OfficeToPdfError("input-too-large", "The source exceeds its reserved read capacity.");
    }
    const digest = createHash("sha256").update(job.request.extension).update("\0").update(input.bytes).digest("hex");
    const key = OfficeToPdfKey(this.generation + ":" + digest);
    const cached = this.ready.get(key);
    if (cached !== undefined) {
      this.ready.delete(key);
      this.ready.set(key, cached);
      this.finish(job, cached);
      return;
    }
    const existing = this.digests.get(key);
    if (existing !== undefined && !existing.controller.signal.aborted) {
      if (job.priority === "foreground") existing.priority = "foreground";
      for (const reader of job.readers) {
        reader.job = existing;
        existing.readers.add(reader);
      }
      job.readers.clear();
      for (const source of job.sources) {
        existing.sources.add(source);
        this.sources.set(source, existing);
      }
      job.sources.clear();
      return;
    }
    this.digests.set(key, job);
    try {
      const converted = await this.convert(input.bytes, job.request.extension, signal);
      signal.throwIfAborted();
      const result: OfficeToPdfResult = { ...converted, cacheKey: key, generation: this.generation };
      this.retain(result);
      this.finish(job, result);
    } finally {
      if (this.digests.get(key) === job) this.digests.delete(key);
    }
  }

  /** Giao kết quả cho mọi bên đọc và ghi bí danh nguồn → nội dung. */
  private finish(job: Job, result: OfficeToPdfResult): void {
    for (const source of job.sources) this.sources.delete(source);
    if (this.ready.has(result.cacheKey)) {
      for (const source of job.sources) {
        this.aliases.delete(source);
        this.aliases.set(source, result.cacheKey);
        while (this.aliases.size > this.config.maxSourceEntries) {
          this.aliases.delete(this.aliases.keys().next().value as string);
        }
      }
    }
    for (const reader of job.readers) {
      this.release(reader);
      reader.resolve(this.copy(result));
    }
  }

  /** Giữ MỘT PDF trong bộ đệm LRU (bỏ khi vượt trần số mục/byte). */
  private retain(result: OfficeToPdfResult): void {
    if (result.pdf.byteLength > this.config.maxCachedBytes) return;
    while (
      this.ready.size >= this.config.maxCachedEntries ||
      this.cachedBytes + result.pdf.byteLength > this.config.maxCachedBytes
    ) {
      const [key, oldest] = this.ready.entries().next().value as [string, OfficeToPdfResult];
      this.ready.delete(key);
      this.cachedBytes -= oldest.pdf.byteLength;
      for (const [source, digest] of this.aliases) if (digest === key) this.aliases.delete(source);
    }
    this.ready.set(result.cacheKey, result);
    this.cachedBytes += result.pdf.byteLength;
  }
}
