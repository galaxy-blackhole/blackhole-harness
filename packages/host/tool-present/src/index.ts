/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Ai/dsh-tool-present: công cụ `present` khai báo tệp đầu ra cuối cùng, chuẩn hoá đường dẫn qua ctx.fs và ghi sự kiện deliverables/presented sau khi lời gọi thành công.
 *      PHASE B (08/11/2026): đổi import `defineTool` sang `@galaxy-blackhole/gbh-host-tools` (ADR 000d).
 *      GIỮ `ctx.tools`: `apply` nhận `PresentContext` — seam CẤU TRÚC TỰ KHAI trong tệp (không dựa vào
 *      augmentation), nên đổi sang `ctx.get("tools")` sẽ ĐỔI hình dạng lỗi mà test A/B ca 26 đang khoá
 *      (thông điệp TypeError NGUYÊN VĂN của bản gốc: "…evaluating 'ctx.tools.register'").
 */

import z from "@deepseek-ai/schemastery";
import { FsError } from "@deepseek-ai/dsh-fs";
import { defineTool } from "@galaxy-blackhole/gbh-host-tools";

/**
 * Tên ổn định của plugin — NGUYÊN VĂN bản gốc.
 * Nhận: không.
 * Trả: chuỗi "tool-present".
 */
export const name = "tool-present";

/**
 * Schema cấu hình của plugin — NGUYÊN VĂN `z.object({ maxFiles: z.number().default(8) })` của bản gốc.
 * Nhận: value — cấu hình thô của Loader (có thể bỏ trống).
 * Trả: cấu hình đã chuẩn hoá, `maxFiles` mặc định 8.
 * @throws {Error} khi gốc không phải object hoặc `maxFiles` sai kiểu — thông điệp NGUYÊN VĂN schemastery.
 */
export const Config = z.object({ maxFiles: z.number().default(8) });

/**
 * Service bắt buộc — NGUYÊN VĂN mảng `inject` của bản gốc.
 * Nhận: không.
 * Trả: mảng bốn tên service theo đúng thứ tự của bản gốc.
 */
export const inject: string[] = ["tools", "fs", "sessionProjections", "workingDirectory"];

/** Cấu hình đã chuẩn hoá mà `apply` nhận — chỉ trường `maxFiles` được đọc. */
interface PresentConfig {
  /** Số tệp tối đa mỗi lời gọi. */
  maxFiles: number;
}

/** Trạng thái đơn vị chiếu `turnBoundary` — chỉ hai trường mà công cụ đọc. */
interface TurnBoundaryState {
  /** Seq của `turn/start` đang mở, hoặc null giữa hai lượt. */
  readonly openTurnStartSeq: number | null;
  /** Số lượt của `turn/start` mới nhất. */
  readonly lastTurn: number;
}

/** Phiên có thể ghi sự kiện — seam CẤU TRÚC của `Session.append`. */
interface SessionLike {
  /**
   * Ghi một sự kiện bền vào phiên.
   * Nhận: type — loại sự kiện; data — dữ liệu sự kiện.
   * Trả: không.
   */
  append(type: string, data: unknown): void;
}

/** Thông tin đường dẫn mà `ctx.fs.lstat` trả về — chỉ trường `type` được đọc. */
interface FsPathInfoLike {
  /** `file` | `directory` | `symlink` | `other`. */
  readonly type: "file" | "directory" | "symlink" | "other";
}

/** Thông tin đích đã giải mà `ctx.fs.stat` trả về — chỉ trường `type` được đọc. */
interface FsInfoLike {
  /** `file` | `directory` | `other`. */
  readonly type: "file" | "directory" | "other";
}

/** Seam CẤU TRÚC của `ctx.fs` — đúng bốn phương thức mà công cụ gọi. */
interface FsSeam {
  /**
   * Quan sát đường dẫn mà KHÔNG đi theo symlink cuối.
   * Nhận: path — đường dẫn mô hình gửi; opts — `cwd`; signal — tín hiệu huỷ.
   * Trả: thông tin đường dẫn, hoặc undefined khi không tồn tại.
   */
  lstat(path: string, opts?: { cwd?: string }, signal?: AbortSignal): Promise<FsPathInfoLike | undefined>;
  /**
   * Giải đường dẫn thành đích ổn định.
   * Nhận: path — đường dẫn; opts — `cwd` + `signal`.
   * Trả: đích ổn định (đối tượng mờ với công cụ).
   */
  resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<unknown>;
  /**
   * Đọc metadata của đích đã giải.
   * Nhận: target — đích từ `resolve`; signal — tín hiệu huỷ.
   * Trả: thông tin đích, hoặc undefined khi không tồn tại.
   */
  stat(target: unknown, signal?: AbortSignal): Promise<FsInfoLike | undefined>;
  /**
   * Đường dẫn tiến trình cho một đích.
   * Nhận: target — đích từ `resolve`.
   * Trả: đường dẫn tuyệt đối trong thế giới thực thi.
   */
  processPath(target: unknown): string;
}

/** Seam CẤU TRÚC của `ctx.sessionProjections` — chỉ `stateOf`. */
interface SessionProjectionsSeam {
  /**
   * Đọc trạng thái một đơn vị chiếu của phiên.
   * Nhận: session — phiên; key — khoá đơn vị chiếu.
   * Trả: trạng thái `turnBoundary`, hoặc undefined khi chưa có.
   */
  stateOf(session: unknown, key: "turnBoundary"): TurnBoundaryState | undefined;
}

/** Seam CẤU TRÚC của `ctx.workingDirectory` — chỉ `ensure`. */
interface WorkingDirectorySeam {
  /**
   * Bảo đảm agent có thư mục làm việc và trả đường dẫn của nó.
   * Nhận: agent — agent đang chạy; signal — tín hiệu huỷ.
   * Trả: thư mục làm việc tuyệt đối.
   */
  ensure(agent: unknown, signal?: AbortSignal): Promise<string>;
}

/** Lời gọi đã kết thúc mà listener `tools/result` nhận — chỉ `callId` được đọc. */
interface PresentResultExecution {
  /** Mã lời gọi. */
  readonly callId: string;
}

/** Kết quả lời gọi mà listener `tools/result` nhận — chỉ `isError` được đọc. */
interface PresentResultLike {
  /** Lời gọi có thất bại hay không. */
  readonly isError: boolean;
}

/** Bề mặt Context agent-scoped mà plugin dùng — seam CẤU TRÚC, không augment module (ADR 000d). */
interface PresentContext {
  /** Sổ công cụ. */
  readonly tools: {
    /**
     * Đăng ký một định nghĩa công cụ.
     * Nhận: definition — định nghĩa do `defineTool` dựng.
     * Trả: giá trị sổ công cụ trả về (không dùng).
     */
    register(definition: unknown): unknown;
  };
  /** Hệ tệp của phiên. */
  readonly fs: FsSeam;
  /** Sổ đơn vị chiếu phiên. */
  readonly sessionProjections: SessionProjectionsSeam;
  /** Thư mục làm việc của agent. */
  readonly workingDirectory: WorkingDirectorySeam;
  /**
   * Đăng ký listener sự kiện.
   * Nhận: event — tên sự kiện; listener — hàm nhận (exec, result).
   * Trả: giá trị `on` trả về (không dùng, như bản gốc).
   */
  on(event: "tools/result", listener: (exec: PresentResultExecution, result: PresentResultLike) => void): unknown;
}

/** Một tệp đã khai báo — hình dạng canonical của kết quả. */
interface DeliveredFile {
  /** Đường dẫn tiến trình đã chuẩn hoá. */
  readonly path: string;
  /** Mô tả tuỳ chọn cho người dùng. */
  readonly description?: string;
}

/** Một lượt giao hàng đang chờ sự kiện `tools/result`. */
interface Delivery {
  /** Phiên nhận sự kiện `deliverables/presented`. */
  readonly session: SessionLike;
  /** Số lượt tại thời điểm gọi. */
  readonly turn: number;
  /** Danh sách tệp đã chuẩn hoá. */
  readonly files: DeliveredFile[];
}

/**
 * Đăng ký công cụ `present` với tham chiếu tệp bền trong kết quả công cụ.
 * Nhận: ctx — service phạm vi agent; config — số tệp tối đa mỗi lời gọi.
 * Trả: không.
 * @throws {Error} khi `config.maxFiles` không phải số nguyên dương — NGUYÊN VĂN bản gốc.
 */
export function apply(ctx: PresentContext, config: PresentConfig): void {
  if (!Number.isSafeInteger(config.maxFiles) || config.maxFiles < 1) throw new Error("present requires a positive integer maxFiles");
  const pending = new WeakMap<object, Delivery>();
  ctx.tools.register(defineTool({
    name: "present",
    description: "Declare existing files as final deliverables for the user. Use it when the user needs a separate file, especially Office documents, spreadsheets, and slide decks; prefer your final response when that suffices. The user opens the current files; their contents are not copied.",
    parameters: { files: {
      type: "array",
      required: true,
      description: "Usually the 1-2 most important deliverables; at most 4 per call.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: {
            type: "string",
            required: true,
            description: "Path of an existing regular file. Relative paths use the Session working directory.",
          },
          description: {
            type: "string",
            description: "Brief description for the user.",
          },
        },
      },
    } },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          turn: {
            type: "integer",
            required: true,
          },
          files: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                path: {
                  type: "string",
                  required: true,
                },
                description: { type: "string" },
              },
            },
          },
        },
      },
      render: (_args, value) => [{
        type: "text",
        text: value.files.map((file) => `Presented ${file.path}`).join("\n"),
      }],
    },
    async execute(args, exec) {
      if (exec.agent === void 0) throw new Error("present requires an agent Session");
      const boundary = ctx.sessionProjections.stateOf(exec.agent.session, "turnBoundary");
      if (boundary === void 0 || boundary.openTurnStartSeq === null) throw new Error("present requires an open turn");
      if (args.files.length === 0 || args.files.length > config.maxFiles) throw new Error(`present accepts 1 to ${config.maxFiles} files`);
      const cwd = await ctx.workingDirectory.ensure(exec.agent, exec.signal);
      const options = {
        cwd,
        signal: exec.signal,
      };
      const files: DeliveredFile[] = [];
      for (const file of args.files) {
        if (file.path.trim().length === 0) throw new Error("present requires a non-empty file path");
        const entry = await ctx.fs.lstat(file.path, { cwd }, exec.signal);
        if (entry !== void 0 && entry.type !== "file") throw new Error(`Cannot present ${file.path}: not a regular file`);
        const target = await ctx.fs.resolve(file.path, options);
        const info = await ctx.fs.stat(target, exec.signal);
        if (info === void 0) throw new FsError(`Cannot present ${file.path}: file not found. Check the path, create the file if needed, and retry.`, "FS_NOT_FOUND");
        if (info.type !== "file") throw new Error(`Cannot present ${file.path}: not a regular file`);
        files.push({
          ...file,
          path: ctx.fs.processPath(target),
        });
      }
      exec.signal.throwIfAborted();
      pending.set(exec, {
        session: exec.agent.session as unknown as SessionLike,
        turn: boundary.lastTurn,
        files,
      });
      return {
        turn: boundary.lastTurn,
        files,
      };
    },
  }));
  ctx.on("tools/result", (exec, result) => {
    const delivery = pending.get(exec);
    pending.delete(exec);
    if (delivery === void 0 || result.isError) return;
    const { session, turn, files } = delivery;
    session.append("deliverables/presented", {
      turn,
      callId: exec.callId,
      files,
    });
  });
}
