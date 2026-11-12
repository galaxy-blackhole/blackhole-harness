/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dịch vụ HOST đọc tệp và quan sát thư mục workspace trên filesystem đã hợp thành — bản viết lại 1:1
 *      `WorkspaceFiles` của `@deepseek-ai/dsh-api-workspace-files` (NỬA HOST): `read` · `readBytes` ·
 *      `stat` · `list` · `changes`, cùng mọi cổng kiểm và trần byte/dòng/mục.
 */

import { posix, win32 } from "node:path";

import z from "@deepseek-ai/schemastery";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

import { WorkspaceChangeFeed } from "./changes.ts";
import {
  NUL,
  cutPage as cutPageFromChunks,
  directoryEntry,
  integerAtLeast,
  isNotTextRefusal,
  remoteFailure,
  workspacePathOf,
} from "./page.ts";
import type { FsInfo, FsTarget, WorkspaceFilesContext } from "./seams.ts";
import type { Context } from "@deepseek-ai/cordis";
import type {
  WorkspaceByteReadOptions,
  WorkspaceByteRange,
  WorkspaceDirectoryListing,
  WorkspaceFileBytes,
  WorkspaceFileRange,
  WorkspaceFileScopeLike,
  WorkspaceFileStat,
  WorkspaceFileText,
  WorkspaceFileWatchFrame,
} from "./types.ts";

/** Trần của triển khai cho MỘT trang hoặc MỘT lần liệt kê. */
export interface Config {
  /** Trần byte BAO GỒM cho văn bản một trang và cho một cửa sổ byte; vượt là TỪ CHỐI, không cắt ngắn. */
  readonly maxBytes: number;
  /** Trần byte BAO GỒM cho lần đọc CẢ tệp; tệp lớn hơn bị từ chối, không bao giờ bị cắt. */
  readonly maxFileBytes: number;
  /** Cỡ trang mặc định và LỚN NHẤT theo dòng; yêu cầu lớn hơn bị từ chối. */
  readonly maxLines: number;
  /** Trần số mục thư mục trả về; phần thừa bị bỏ và BÁO là đã cắt. */
  readonly maxEntries: number;
}

/** Dịch vụ Host đọc tệp Remote và quan sát thư mục workspace trên filesystem đã hợp thành. */
export class WorkspaceFiles extends TypertRemoteService {
  /** Trần của triển khai. */
  private readonly config: Config;

  /** Service bắt buộc: filesystem, chính sách sandbox, sổ phiên, và sổ tra cứu Typert. */
  static inject: string[] = ["fs", "sandboxPolicy", "sessions", "typert"];

  /** Schema Loader cho bốn trần; mọi trường đều có mặc định. */
  static Config: z<Config> = z.object({
    maxBytes: z.number().step(1).min(1).default(2 * 1024 * 1024),
    maxFileBytes: z
      .number()
      .step(1)
      .min(1)
      .max(Number.MAX_SAFE_INTEGER - 1)
      .default(32 * 1024 * 1024),
    maxLines: z.number().step(1).min(1).default(5000),
    maxEntries: z.number().step(1).min(1).default(2000),
  }) as unknown as z<Config>;

  /** Dòng thay đổi của đích. */
  private readonly feed: WorkspaceChangeFeed;

  /** Seam của context (khai theo cấu trúc — không phụ thuộc augmentation của gói khác). */
  private readonly seam: WorkspaceFilesContext;

  /**
   * Đăng ký service dưới khoá `workspaceFiles` và bộ tra cứu `workspaceFileScope`.
   * Nhận: context Host mang filesystem và chính sách sandbox; cấu hình bốn trần.
   * Trả: không.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "workspaceFiles");
    const seam = ctx as unknown as WorkspaceFilesContext;
    this.seam = seam;
    this.config = config;
    this.feed = new WorkspaceChangeFeed(seam);
    seam.inject(["sessions", "typert"], (scope) => {
      scope.typert.lookups.register("workspaceFileScope", {
        parameter: "workspaceFileScope",
        wire: "workspaceFileScopeId",
        resource: "session",
        hostTypeSymbol: "@deepseek-ai/dsh-api-workspace-files#WorkspaceFileScope",
        wireTypeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
        resolve: async (sessionId: never) => {
          const live = scope.sessions.get(sessionId)?.header;
          const stored = live === undefined ? await scope.get("sessionPersistence")?.stat(sessionId) : undefined;
          const header = live ?? stored?.header;
          if (header === undefined) return undefined;
          return { sessionId, workspaceRoot: header.cwd ?? scope.sandboxPolicy.workspaceRoot };
        },
      });
    });
  }

  /**
   * Đọc MỘT trang dòng của tệp UTF-8 mà backend filesystem đọc được.
   * Nhận: phạm vi (gốc workspace theo phiên), đường dẫn (tuyệt đối hoặc tương đối theo gốc), cửa sổ dòng, tín hiệu.
   * Trả: trang, version lúc stat TRƯỚC nó, và việc trang có chạm dòng cuối hay không.
   */
  @Remote
  async read(
    workspaceFileScope: WorkspaceFileScopeLike,
    path: string,
    range: WorkspaceFileRange,
    signal: AbortSignal,
  ): Promise<WorkspaceFileText> {
    const { offset, limit } = this.resolvePage(range);
    const { target, info } = await this.locateFile(workspaceFileScope, path, signal);
    const page = await this.cutPage(target, offset, limit, signal, path);
    if (page.text.includes(NUL)) {
      throw remoteFailure("workspace-file/not-text", '"' + path + '" contains NUL bytes', { path });
    }
    return { ...this.statOf(target, info), offset, text: page.text, lines: page.lines, eof: page.eof };
  }

  /**
   * Đọc CẢ một tệp thường hoặc MỘT khoảng byte, không giải mã văn bản.
   * Nhận: phạm vi, đường dẫn đích, tuỳ chọn (tệp gốc và cửa sổ), tín hiệu.
   * Trả: byte gốc kèm version/cỡ lúc stat trước, offset byte, và dấu EOF.
   */
  @Remote
  async readBytes(
    workspaceFileScope: WorkspaceFileScopeLike,
    path: string,
    options: WorkspaceByteReadOptions,
    signal: AbortSignal,
  ): Promise<WorkspaceFileBytes> {
    const window = options.range === undefined ? undefined : this.resolveWindow(options.range, path);
    const resolved =
      options.baseFile === undefined
        ? path
        : await this.relativePath(workspaceFileScope, options.baseFile, path, signal);
    const { target, info } = await this.locateFile(workspaceFileScope, resolved, signal);
    if (window !== undefined) {
      const { offset, length } = window;
      const data = await this.seam.fs.readByteRange(target, window, signal);
      const eof = info.size === undefined ? data.length < length : offset + data.length >= info.size;
      return { ...this.statOf(target, info), offset, data, eof };
    }
    const limit = this.config.maxFileBytes;
    const data = await this.seam.fs.readBytes(target, signal, limit).catch((cause: unknown) => {
      if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "FS_TOO_LARGE") {
        throw remoteFailure(
          "workspace-file/too-large",
          '"' + path + '" exceeds the ' + String(limit) + " byte full-file cap",
          { path, limit },
          { cause },
        );
      }
      throw cause;
    });
    return { ...this.statOf(target, info), offset: 0, data, eof: true };
  }

  /**
   * Báo danh tính, version và cỡ của MỘT tệp thường mà không kèm nội dung.
   * Nhận: phạm vi, đường dẫn, tín hiệu.
   * Trả: đường dẫn tuyệt đối, version hiện tại, và cỡ byte.
   */
  @Remote
  async stat(workspaceFileScope: WorkspaceFileScopeLike, path: string, signal: AbortSignal): Promise<WorkspaceFileStat> {
    const { target, info } = await this.locateFile(workspaceFileScope, path, signal);
    return this.statOf(target, info);
  }

  /**
   * Liệt kê con TRỰC TIẾP của MỘT thư mục trong workspace của phiên.
   * Nhận: phạm vi, đường dẫn workspace (tuyệt đối hoặc tương đối theo gốc), tín hiệu.
   * Trả: các con theo thứ tự tên ổn định của backend, đã giới hạn theo trần số mục.
   */
  @Remote
  async list(
    workspaceFileScope: WorkspaceFileScopeLike,
    path: string,
    signal: AbortSignal,
  ): Promise<WorkspaceDirectoryListing> {
    const { root, workspaceRoot, entry } = await this.inspect(workspaceFileScope, path, signal);
    if (entry.type !== "directory" && entry.type !== "symlink") {
      throw remoteFailure("workspace-file/not-directory", '"' + path + '" is a ' + entry.type, {
        path,
        kind: entry.type,
      });
    }
    const target = await this.confine(root, workspaceRoot, path, signal);
    if (entry.type === "symlink") {
      if ((await this.seam.fs.stat(target, signal))?.type !== "directory") {
        throw remoteFailure("workspace-file/not-directory", '"' + path + '" does not resolve to a directory', {
          path,
          kind: "symlink",
        });
      }
    }
    const children = await this.seam.fs.listDir(target, signal);
    return {
      path: workspacePathOf(this.seam.fs.fileUrl(root), this.seam.fs.fileUrl(target)),
      entries: children.slice(0, this.config.maxEntries).map(directoryEntry),
      truncated: children.length > this.config.maxEntries,
    };
  }

  /**
   * Theo dõi MỘT tệp hoặc các con trực tiếp của MỘT thư mục trong filesystem của phiên.
   * Nhận: phạm vi, đường dẫn đích (Host tự xác định loại và giữ thư mục trong workspace), tín hiệu thế hệ.
   * Trả: `ready` khi watcher đích đã hoạt động, rồi siêu dữ liệu hiện tại cho mọi lần mất hiệu lực.
   */
  @Remote({ mode: "stream" })
  changes(
    workspaceFileScope: WorkspaceFileScopeLike,
    path: string,
    signal: AbortSignal,
  ): AsyncIterable<WorkspaceFileWatchFrame> {
    return this.feed.follow(workspaceFileScope.workspaceRoot, path, signal);
  }

  /**
   * Giải đích TƯƠNG ĐỐI theo thư mục của MỘT tệp gốc.
   * Nhận: phạm vi, tệp gốc, đường dẫn tương đối, tín hiệu.
   * Trả: đường dẫn tuyệt đối của đích.
   */
  private async relativePath(
    scope: WorkspaceFileScopeLike,
    baseFile: string,
    path: string,
    signal: AbortSignal,
  ): Promise<string> {
    const relative = path.replace(/\\/g, "/");
    if (
      relative.length === 0 ||
      relative.startsWith("/") ||
      /^[a-z][a-z\d+.-]*:/iu.test(relative) ||
      relative.includes(NUL)
    ) {
      throw remoteFailure("gateway/bad-request", "path must be relative when baseFile is provided", {});
    }
    const { target } = await this.locateFile(scope, baseFile, signal);
    const absolute = this.seam.fs.processPath(target);
    const paths = absolute.startsWith("/") ? posix : win32;
    return paths.resolve(paths.dirname(absolute), relative);
  }

  /**
   * Áp mặc định và trần của TRANG tại đây, để yêu cầu không bao giờ mang chúng ngầm.
   * Nhận: cửa sổ dòng thô.
   * Trả: offset/limit đã kiểm.
   */
  private resolvePage(range: WorkspaceFileRange): { offset: number; limit: number } {
    const offset = range.offset === undefined ? 1 : integerAtLeast(range.offset, 1, "offset");
    const limit = range.limit === undefined ? this.config.maxLines : integerAtLeast(range.limit, 1, "limit");
    if (limit > this.config.maxLines) {
      throw remoteFailure("gateway/bad-request", "limit must be at most " + String(this.config.maxLines), {});
    }
    return { offset, limit };
  }

  /**
   * Áp mặc định và trần của CỬA SỔ BYTE; cửa sổ vượt trần bị TỪ CHỐI, không cắt ngắn.
   * Nhận: cửa sổ byte thô và đường dẫn (cho thông điệp).
   * Trả: offset/length đã kiểm.
   */
  private resolveWindow(range: WorkspaceByteRange, path: string): { offset: number; length: number } {
    const offset = range.offset === undefined ? 0 : integerAtLeast(range.offset, 0, "offset");
    const length = range.length === undefined ? this.config.maxBytes : integerAtLeast(range.length, 1, "length");
    if (offset + length > Number.MAX_SAFE_INTEGER) {
      throw remoteFailure("gateway/bad-request", "offset plus length must stay a safe integer", {});
    }
    if (length > this.config.maxBytes) {
      throw remoteFailure(
        "workspace-file/too-large",
        String(length) + ' bytes of "' + path + '" exceed the ' + String(this.config.maxBytes) + " byte cap",
        { path, limit: this.config.maxBytes },
      );
    }
    return { offset, length };
  }

  /**
   * Kiểm chính đường dẫn được yêu cầu TRƯỚC khi giải đích theo thành phần cuối. Việc giữ thư mục trong
   * workspace do `list` kiểm riêng.
   * Nhận: phạm vi, đường dẫn, tín hiệu.
   * Trả: gốc đã giải, gốc workspace, và mục `lstat` của đường dẫn.
   */
  private async inspect(
    workspaceFileScope: WorkspaceFileScopeLike,
    path: string,
    signal: AbortSignal,
  ): Promise<{ root: FsTarget; workspaceRoot: string; entry: FsInfo }> {
    if (path.length === 0) throw remoteFailure("gateway/bad-request", "path is required", {});
    const { workspaceRoot } = workspaceFileScope;
    const root = await this.seam.fs.resolve(workspaceRoot, { signal });
    const entry = await this.seam.fs.lstat(path, { cwd: workspaceRoot }, signal);
    if (entry === undefined) {
      throw remoteFailure("workspace-file/not-found", 'no entry at "' + path + '"', { path });
    }
    return { root, workspaceRoot, entry };
  }

  /**
   * Giải MỘT đường dẫn đã kiểm và từ chối trừ khi workspace chứa nó.
   * Nhận: gốc đã giải, gốc workspace, đường dẫn, tín hiệu.
   * Trả: đích đã giải.
   */
  private async confine(
    root: FsTarget,
    workspaceRoot: string,
    path: string,
    signal: AbortSignal,
  ): Promise<FsTarget> {
    const target = await this.seam.fs.resolve(path, { cwd: workspaceRoot, signal });
    if (!this.seam.fs.contains(root, target)) {
      throw remoteFailure("workspace-file/outside-workspace", '"' + path + '" is outside the workspace', { path });
    }
    return target;
  }

  /**
   * MỌI cổng cho MỘT tệp thường, kết thúc bằng ĐÚNG MỘT lần stat nêu version và cỡ của nó. Lần stat kiểm lại
   * điều `lstat` đã thấy: tệp có thể đã mất hoặc đổi loại ở giữa.
   * Nhận: phạm vi, đường dẫn, tín hiệu.
   * Trả: đích và thông tin của nó.
   */
  private async locateFile(
    workspaceFileScope: WorkspaceFileScopeLike,
    path: string,
    signal: AbortSignal,
  ): Promise<{ target: FsTarget; info: FsInfo }> {
    const { workspaceRoot, entry } = await this.inspect(workspaceFileScope, path, signal);
    if (entry.type !== "file") {
      throw remoteFailure("workspace-file/not-regular-file", '"' + path + '" is a ' + entry.type, {
        path,
        kind: entry.type,
      });
    }
    const target = await this.seam.fs.resolve(path, { cwd: workspaceRoot, signal });
    const info = await this.seam.fs.stat(target, signal);
    if (info === undefined) {
      throw remoteFailure("workspace-file/not-found", 'no entry at "' + path + '"', { path });
    }
    if (info.type !== "file") {
      throw remoteFailure("workspace-file/not-regular-file", '"' + path + '" is a ' + info.type, {
        path,
        kind: info.type,
      });
    }
    return { target, info };
  }

  /**
   * Dựng phần thống kê của dây từ đích và thông tin của nó.
   * Nhận: đích và thông tin.
   * Trả: `absolutePath`/`version`/`bytes` (bytes chỉ khi backend báo).
   */
  private statOf(target: FsTarget, info: FsInfo): WorkspaceFileStat {
    return {
      absolutePath: this.seam.fs.processPath(target),
      version: info.version,
      ...(info.size === undefined ? {} : { bytes: info.size }),
    };
  }

  /**
   * Mở luồng VĂN BẢN của tệp và cắt trang, phân loại lời từ chối "không phải văn bản" của backend.
   * Nhận: đích, dòng đầu, số dòng, tín hiệu, đường dẫn (cho thông điệp).
   * Trả: trang đã cắt.
   */
  private async cutPage(
    target: FsTarget,
    offset: number,
    limit: number,
    signal: AbortSignal,
    path: string,
  ): Promise<{ text: string; lines: number; eof: boolean }> {
    try {
      return await cutPageFromChunks(
        await this.seam.fs.streamText(target, signal),
        offset,
        limit,
        this.config.maxBytes,
        path,
      );
    } catch (error) {
      if (isNotTextRefusal(error)) {
        throw remoteFailure(
          "workspace-file/not-text",
          '"' + path + '" is not UTF-8 text',
          { path },
          { cause: error },
        );
      }
      throw error;
    }
  }
}
