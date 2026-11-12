/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Provider Host của kit LibreOffice: bộ chuyển đổi dùng lại được, nhập/xuất qua ĐĨA RIÊNG của tác vụ — bản
 *      viết lại 1:1 `OfficeToPdf` của `@deepseek-ai/dsh-office-to-pdf` (MỘT MẶT, nửa host).
 */

import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, isAbsolute, join } from "node:path";

import { brandString } from "@deepseek-ai/dsh-brand";
import { Remote, RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import z from "@deepseek-ai/schemastery";

import { OfficeToPdfError, documentRenderFailure } from "./errors.ts";
import { OfficeSourceKey, OfficeToPdfGeneration } from "./identity.ts";
import { readPdf } from "./output.ts";
import { ConversionQueue } from "./queue.ts";
import type { Converted } from "./queue.ts";
import type {
  OfficeExtension,
  OfficeToPdfPriority,
  OfficeToPdfRequest,
  OfficeToPdfResult,
  RenderedDocumentBytes,
} from "./types.ts";

/** Context tối thiểu của Host mà provider này chạm tới. */
export interface OfficeToPdfContext {
  /**
   * Đăng ký MỘT hiệu ứng dọn thuộc fiber này.
   * Nhận: hàm dựng callback dọn, và nhãn.
   * Trả: hàm dọn của đăng ký.
   */
  effect(callback: () => () => Promise<void>, label?: string): () => void;
  /**
   * Lấy MỘT service theo khoá (có thể vắng).
   * Nhận: khoá service.
   * Trả: service, hoặc `undefined`.
   */
  get(key: string): unknown;
}

/** Bộ chuyển đổi do kit cấp (chỉ phần provider dùng). */
export interface ConverterLike {
  /**
   * Render MỘT tệp nguồn sang PDF.
   * Nhận: đường dẫn vào/ra trong thư mục tạm, và tín hiệu.
   * Trả: byte PDF + họ font thiếu.
   */
  render(
    request: { readonly inputPath: string; readonly outputPath: string },
    signal: AbortSignal,
  ): Promise<{ readonly missingFonts: string[] }>;
  /** Dọn engine. */
  dispose?(): Promise<void> | void;
}

/** Tham số cấu hình chuyển cho kit. */
export interface ConverterOptions {
  /** Hạn chót chuyển đổi, mili giây. */
  readonly timeoutMs: number;
  /** Trần byte đầu vào. */
  readonly maxInputBytes: number;
  /** Trần byte đầu ra. */
  readonly maxOutputBytes: number;
  /** DPI ảnh raster xuất ra. */
  readonly maxImageResolution: number;
  /** Trần số mục ZIP của OOXML. */
  readonly maxArchiveEntries: number;
  /** Trần tổng byte chưa nén khai báo. */
  readonly maxUncompressedBytes: number;
  /** Trần số tệp font vật lý. */
  readonly maxFontFiles: number;
  /** Trần byte MỘT tệp font. */
  readonly maxFontFileBytes: number;
  /** Trần byte font gốc nạp cho một lần chuyển đổi. */
  readonly maxLoadedFontBytes: number;
  /** Gốc font tuyệt đối (tuỳ chọn). */
  readonly fontDirectories?: string[];
  /** Nhóm ưu tiên họ font theo thứ tự (tuỳ chọn). */
  readonly fontFallbacks?: string[][];
}

/** Tham số cấu hình đồng thời và render/font của provider. */
export interface Config {
  /** Số lần chuyển đổi ĐỒNG THỜI tối đa; bên xếp hàng vẫn huỷ được. */
  maxConcurrentConversions: number;
  /** Số tác vụ chỉ-có-siêu-dữ-liệu tối đa đang chờ nhận nguồn. */
  maxQueuedJobs: number;
  /** Số bên đọc chưa xong tối đa. */
  maxReaders: number;
  /** Tổng byte nguồn được giữ chỗ tối đa. */
  maxSourceBytes: number;
  /** Số tác vụ NỀN đồng thời tối đa; 0 là từ chối việc suy đoán. */
  maxBackgroundConversions: number;
  /** Số PDF giữ theo nội dung tối đa. */
  maxCachedEntries: number;
  /** Tổng byte PDF được giữ tối đa. */
  maxCachedBytes: number;
  /** Số bí danh version-nguồn tối đa trỏ tới nội dung đã giữ. */
  maxSourceEntries: number;
  /** Hạn chót chuyển đổi, mili giây; KHÔNG tính thời gian xếp hàng của GBH. */
  timeoutMs: number;
  /** Trần byte nguồn đã cấp quyền. */
  maxInputBytes: number;
  /** Trần byte PDF đầy đủ. */
  maxOutputBytes: number;
  /** DPI ảnh raster xuất ra. */
  maxImageResolution: number;
  /** Trần số mục ZIP của OOXML. */
  maxArchiveEntries: number;
  /** Trần tổng byte chưa nén khai báo của OOXML. */
  maxUncompressedBytes: number;
  /** Gốc font tuyệt đối. */
  fontDirectories?: string[];
  /** Nhóm ưu tiên họ font theo thứ tự. */
  fontFallbacks?: string[][];
  /** Trần số tệp font vật lý mỗi converter nạp. */
  maxFontFiles: number;
  /** Trần byte MỘT tệp font. */
  maxFontFileBytes: number;
  /** Trần byte font gốc nạp cho một lần chuyển đổi. */
  maxLoadedFontBytes: number;
}

/**
 * Schema Loader: giá trị MẶC ĐỊNH của triển khai cho mọi trường (giữ nguyên từng số của bản gốc).
 * Nhận: cấu hình một phần.
 * Trả: cấu hình đã áp mặc định.
 */
export const Config: z<Partial<Config>, Config> = z.object({
  maxConcurrentConversions: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(2),
  maxQueuedJobs: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(8),
  maxReaders: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(32),
  maxSourceBytes: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(104857600),
  maxBackgroundConversions: z.natural().min(0).max(Number.MAX_SAFE_INTEGER).default(1),
  maxCachedEntries: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(8),
  maxCachedBytes: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(134217728),
  maxSourceEntries: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(64),
  timeoutMs: z.natural().min(1).max(2147483647).default(60000),
  maxInputBytes: z.natural().min(1).max(Number.MAX_SAFE_INTEGER - 1).default(50 * 1024 * 1024),
  maxOutputBytes: z.natural().min(1).max(Number.MAX_SAFE_INTEGER - 1).default(100 * 1024 * 1024),
  maxImageResolution: z.natural().min(1).max(2147483647).default(192),
  maxArchiveEntries: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(10000),
  maxUncompressedBytes: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(250 * 1024 * 1024),
  fontDirectories: z.array(z.string().min(1)).extra("default", undefined),
  fontFallbacks: z.array(z.array(z.string().pattern(/\S/)).min(2)).extra("default", undefined),
  maxFontFiles: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(20000),
  maxFontFileBytes: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(256 * 1024 * 1024),
  maxLoadedFontBytes: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(512 * 1024 * 1024),
}) as unknown as z<Partial<Config>, Config>;

/** Nhà máy tạo bộ chuyển đổi; mặc định là `createConverter` của kit, thay được khi test. */
export type ConverterFactory = (options: ConverterOptions) => Promise<ConverterLike>;

/** MỘT khe chuyển đổi: engine lười + cờ đang bận. */
interface Slot {
  /** Đang bận chuyển đổi hay không. */
  busy: boolean;
  /** Engine đã tạo (lười) — promise để nhiều bên cùng chờ. */
  converter?: Promise<ConverterLike>;
}

/** MỘT vòng đời provider sở hữu mọi bộ chuyển đổi, lời gọi đang xếp hàng, và tệp tạm. */
export class OfficeToPdf extends TypertRemoteService {
  /** Cấu hình đã phân giải. */
  private readonly config: Config;

  /** Schema Loader của provider. */
  static Config: z<Partial<Config>, Config> = Config;

  /** Đổi mỗi khi thay engine, font, hoặc cấu hình chuyển đổi. */
  readonly generation = OfficeToPdfGeneration(randomUUID());

  /** Huỷ khi provider bị dọn. */
  private readonly remoteLifetime = new AbortController();

  /** Các lời gọi Remote đang chạy (để dọn chờ chúng). */
  private readonly remoteRequests = new Set<Promise<unknown>>();

  /** Các khe chuyển đổi. */
  private readonly slots: Slot[] = [];

  /** Hàng đợi chuyển đổi của thế hệ này. */
  private readonly queue: ConversionQueue;

  /** Tham số chuyển cho kit. */
  private readonly options: ConverterOptions;

  /** Seam của context (khai theo cấu trúc). */
  private readonly seam: OfficeToPdfContext;

  /** Nhà máy bộ chuyển đổi (mặc định do nơi dựng service cấp). */
  private readonly factory: ConverterFactory;

  /**
   * @param ctx - context Host sở hữu.
   * @param config - hạn mức render, font, và đồng thời đã phân giải.
   * @param factory - nhà máy bộ chuyển đổi; BỎ TRỐNG thì nạp `createConverter` của kit như bản gốc (nạp ĐỘNG,
   *   nên gói không kéo kit native vào lúc import), test truyền bản GIẢ để không cần LibreOffice.
   */
  constructor(ctx: unknown, config: Config, factory?: ConverterFactory) {
    super(ctx as never, "officeToPdf");
    this.seam = ctx as unknown as OfficeToPdfContext;
    this.config = config;
    // Mặc định GIỮ 1:1 bản gốc: `createConverter(this.options)`, chỉ khác là nạp ĐỘNG để đường test tiêm được
    // bộ chuyển đổi GIẢ (máy này không có LibreOffice — xem README §3/§5).
    this.factory =
      factory ??
      (async (options) => {
        const kit = (await import("@deepseek-ai/libreoffice-kit")) as {
          createConverter(options: ConverterOptions): Promise<ConverterLike>;
        };
        return kit.createConverter(options);
      });
    if (config.fontDirectories?.some((path) => !isAbsolute(path))) {
      throw new Error("fontDirectories must contain absolute paths.");
    }
    if (config.maxSourceBytes < config.maxInputBytes) throw new Error("maxSourceBytes must be at least maxInputBytes.");
    const {
      fontDirectories,
      fontFallbacks,
      timeoutMs,
      maxInputBytes,
      maxOutputBytes,
      maxImageResolution,
      maxArchiveEntries,
      maxUncompressedBytes,
      maxFontFiles,
      maxFontFileBytes,
      maxLoadedFontBytes,
    } = config;
    this.options = {
      timeoutMs,
      maxInputBytes,
      maxOutputBytes,
      maxImageResolution,
      maxArchiveEntries,
      maxUncompressedBytes,
      maxFontFiles,
      maxFontFileBytes,
      maxLoadedFontBytes,
      ...(fontDirectories === undefined ? {} : { fontDirectories }),
      ...(fontFallbacks === undefined ? {} : { fontFallbacks }),
    };
    this.queue = new ConversionQueue(config, this.generation, (bytes, extension, signal) =>
      this.convertBytes(bytes, extension, signal),
    );
    this.seam.effect(
      () => async () => {
        this.remoteLifetime.abort();
        await this.queue.dispose();
        await Promise.allSettled(this.remoteRequests);
        const failures = (
          await Promise.allSettled(
            this.slots.map(async (slot) => {
              await (await slot.converter)?.dispose?.();
            }),
          )
        ).filter((result) => result.status === "rejected");
        if (failures.length > 0) {
          throw new AggregateError(
            failures.map((result) => (result as PromiseRejectedResult).reason),
            "LibreOffice converter disposal failed.",
          );
        }
      },
    );
  }

  /**
   * Chuyển byte Office mà KHÔNG sửa nguồn và KHÔNG ghi sự kiện phiên.
   * Nhận: yêu cầu đã cấp quyền (kèm hàm đọc hoãn lại có trần), và tín hiệu huỷ của bên gọi.
   * Trả: byte PDF thuộc bên gọi sau khi chuyển đổi và dọn thư mục tạm xong; bên đọc bị huỷ reject độc lập.
   */
  convert(request: OfficeToPdfRequest, signal?: AbortSignal): Promise<OfficeToPdfResult> {
    return this.queue.read(request, signal);
  }

  /**
   * Đọc và chuyển MỘT tệp Office theo ĐÚNG quyền filesystem thông thường của phiên.
   * Nhận: phạm vi workspace của phiên, đường dẫn (tuyệt đối hoặc tương đối theo workspace), mức ưu tiên, tín hiệu.
   * Trả: byte PDF đầy đủ kèm danh tính nguồn gốc và họ font thiếu.
   */
  @Remote
  async render(
    workspaceFileScope: { readonly sessionId: string; readonly workspaceRoot: string },
    path: string,
    priority: OfficeToPdfPriority,
    signal: AbortSignal,
  ): Promise<RenderedDocumentBytes> {
    const upstream = AbortSignal.any([signal, this.remoteLifetime.signal]);
    const operation = this.renderFile(workspaceFileScope, path, priority, upstream);
    this.remoteRequests.add(operation);
    try {
      return await operation;
    } finally {
      this.remoteRequests.delete(operation);
    }
  }

  /**
   * Đọc thế hệ render HIỆN TẠI trước khi dùng lại PDF phía Client.
   * Nhận: tín hiệu huỷ của bên gọi.
   * Trả: vòng đời provider (đổi khi thay cấu hình render/font/engine).
   */
  @Remote("generation")
  getGeneration(signal: AbortSignal): ReturnType<typeof OfficeToPdfGeneration> {
    signal.throwIfAborted();
    return this.generation;
  }

  /**
   * Đọc tệp qua `workspaceFiles` rồi chuyển đổi, bọc lỗi thành `RemoteError` cho Client.
   * Nhận: phạm vi phiên, đường dẫn, mức ưu tiên, tín hiệu.
   * Trả: byte PDF kèm danh tính nguồn.
   */
  private async renderFile(
    workspaceFileScope: { readonly sessionId: string; readonly workspaceRoot: string },
    path: string,
    priority: OfficeToPdfPriority,
    signal: AbortSignal,
  ): Promise<RenderedDocumentBytes> {
    try {
      signal.throwIfAborted();
      const extension = extname(path).slice(1).toLowerCase();
      if (
        extension !== "doc" &&
        extension !== "docx" &&
        extension !== "xls" &&
        extension !== "xlsx" &&
        extension !== "ppt" &&
        extension !== "pptx"
      ) {
        throw new OfficeToPdfError(
          "unsupported-format",
          "The path must end in doc, docx, xls, xlsx, ppt, or pptx.",
        );
      }
      const files = this.seam.get("workspaceFiles") as WorkspaceFilesLike | undefined;
      const fileSystem = this.seam.get("fs") as FsLike | undefined;
      if (files === undefined || fileSystem === undefined) {
        throw new OfficeToPdfError("unavailable", "Office file rendering requires workspaceFiles and fs.");
      }
      const authorized = await files.readBytes(workspaceFileScope, path, { range: { offset: 0, length: 1 } }, signal);
      const source = await files.stat(workspaceFileScope, path, signal);
      const assertUnchanged = (current: { readonly absolutePath: string; readonly version: string }): void => {
        if (current.absolutePath !== source.absolutePath || current.version !== source.version) {
          throw new OfficeToPdfError("source-changed", "The source changed.");
        }
      };
      assertUnchanged(authorized);
      signal.throwIfAborted();
      const result = await this.convert(
        {
          extension: extension as OfficeExtension,
          priority,
          source: {
            key: OfficeSourceKey(
              JSON.stringify([workspaceFileScope.sessionId, workspaceFileScope.workspaceRoot, source.absolutePath]),
            ),
            version: source.version,
            ...(source.bytes === undefined ? {} : { bytes: source.bytes }),
            read: async (upstream, maxBytes) => {
              const target = await fileSystem.resolve(source.absolutePath, { signal: upstream });
              const info = await fileSystem.stat(target, upstream);
              if (info === undefined || info.type !== "file") {
                throw new OfficeToPdfError("source-changed", "The source changed.");
              }
              assertUnchanged({ absolutePath: fileSystem.processPath(target), version: info.version });
              const bytes = await fileSystem.readBytes(target, upstream, maxBytes).catch(async (cause: unknown) => {
                if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "FS_TOO_LARGE") {
                  assertUnchanged(await files.stat(workspaceFileScope, path, upstream));
                  throw new OfficeToPdfError("input-too-large", "The source exceeds the reserved byte capacity.", {
                    cause,
                  });
                }
                throw cause;
              });
              upstream.throwIfAborted();
              assertUnchanged(await files.stat(workspaceFileScope, path, upstream));
              return { bytes, version: source.version };
            },
          },
        },
        signal,
      );
      signal.throwIfAborted();
      return {
        absolutePath: source.absolutePath,
        version: source.version,
        offset: 0,
        eof: true,
        bytes: result.pdf.byteLength,
        data: result.pdf,
        missingFonts: result.missingFonts,
        generation: result.generation,
      };
    } catch (cause) {
      if (signal.aborted) {
        throw new RemoteError("gateway/cancelled", "The document preview was cancelled.", {}, { cause });
      }
      if (cause instanceof OfficeToPdfError) {
        throw documentRenderFailure("Office conversion failed.", { reason: cause.code }, { cause });
      }
      throw cause;
    }
  }

  /**
   * Chuyển MỘT lần trên khe rảnh: tạo thư mục tạm riêng, ghi nguồn, render, đọc PDF có trần, rồi DỌN.
   * Nhận: byte nguồn, định dạng, tín hiệu.
   * Trả: PDF + họ font thiếu (phân loại lỗi engine theo mã của kit).
   */
  private async convertBytes(
    bytes: Uint8Array,
    extension: OfficeExtension,
    signal: AbortSignal,
  ): Promise<Converted> {
    signal.throwIfAborted();
    let slot = this.slots.find((candidate) => !candidate.busy);
    if (slot === undefined) {
      slot = { busy: false };
      this.slots.push(slot);
    }
    slot.busy = true;
    let directory: string | undefined;
    try {
      if (slot.converter === undefined) {
        slot.converter = this.factory(this.options).catch((error: unknown) => {
          delete slot.converter;
          throw error;
        });
      }
      const converter = await slot.converter;
      signal.throwIfAborted();
      directory = await mkdtemp(join(tmpdir(), "gbh-office-to-pdf-"));
      const inputPath = join(directory, "source." + extension);
      const outputPath = join(directory, "converted.pdf");
      await writeFile(inputPath, bytes, { flag: "wx", mode: 384, signal });
      signal.throwIfAborted();
      const result = await converter.render({ inputPath, outputPath }, signal);
      signal.throwIfAborted();
      let pdf: Uint8Array;
      try {
        pdf = await readPdf(outputPath, this.config.maxOutputBytes, signal);
      } catch (cause) {
        if (cause instanceof OfficeToPdfError) throw cause;
        throw new OfficeToPdfError("invalid-output", "The converter PDF could not be read.", { cause });
      }
      signal.throwIfAborted();
      return { pdf, missingFonts: result.missingFonts };
    } catch (cause) {
      signal.throwIfAborted();
      if (cause instanceof OfficeToPdfError) throw cause;
      const code = typeof cause === "object" && cause !== null && "code" in cause ? cause.code : undefined;
      switch (code) {
        case "input-too-large":
        case "output-too-large":
        case "invalid-document":
        case "unsupported-format":
        case "invalid-output":
        case "timeout":
        case "unavailable":
          throw new OfficeToPdfError(code, "LibreOffice conversion failed.", { cause });
        default:
          throw new OfficeToPdfError("failed", "LibreOffice conversion failed.", { cause });
      }
    } finally {
      try {
        if (directory !== undefined) await rm(directory, { recursive: true, force: true });
      } finally {
        slot.busy = false;
      }
    }
  }
}

/** Phần `workspaceFiles` mà provider dùng. */
interface WorkspaceFilesLike {
  /** Đọc byte theo phạm vi. */
  readBytes(
    scope: { readonly sessionId: string; readonly workspaceRoot: string },
    path: string,
    options: { range: { offset: number; length: number } },
    signal: AbortSignal,
  ): Promise<{ readonly absolutePath: string; readonly version: string }>;
  /** Thống kê nguồn. */
  stat(
    scope: { readonly sessionId: string; readonly workspaceRoot: string },
    path: string,
    signal: AbortSignal,
  ): Promise<{ readonly absolutePath: string; readonly version: string; readonly bytes?: number }>;
}

/** Phần seam `fs` mà provider dùng. */
interface FsLike {
  /** Giải đường dẫn. */
  resolve(path: string, options: { signal: AbortSignal }): Promise<{ readonly targetKey: string }>;
  /** Thống kê đích. */
  stat(
    target: { readonly targetKey: string },
    signal: AbortSignal,
  ): Promise<{ readonly type: string; readonly version: string } | undefined>;
  /** Đọc byte có trần. */
  readBytes(target: { readonly targetKey: string }, signal: AbortSignal, maxBytes: number): Promise<Uint8Array>;
  /** Đường dẫn hiển thị của đích. */
  processPath(target: { readonly targetKey: string }): string;
}
