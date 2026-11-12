/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Reference-local: nhà cung cấp `ctx.fileReferences`
 *      trên hệ tệp CỤC BỘ — mỗi agent một chỉ mục mờ có giới hạn, gốc tại cwd của agent; chỉ mục được
 *      đánh dấu cũ sau mỗi `tool/result` và giữ nguyên các mục cũ trong khi bản thay thế dựng ở phía
 *      sau con trỏ. Kèm mục prompt `context:file-reference` cài theo vòng đời từng agent.
 *      Nguồn đối chiếu G4: xem README.md của package.
 */

import type { Context } from "@deepseek-ai/cordis";
import { FileReferenceService, FILE_REFERENCE_PROMPT } from "@deepseek-ai/dsh-file-reference";
import { activeAtToken, formatFileMention } from "@deepseek-ai/dsh-file-reference/grammar";
import type { Agent } from "@deepseek-ai/dsh-agent";
import z from "@deepseek-ai/schemastery";
import {
  DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES,
  DEFAULT_FILE_SEARCH_MAX_ENTRIES,
  DEFAULT_FILE_SEARCH_MAX_RESULTS,
  WorkspaceFileSearch,
} from "./search.ts";
import type {
  FileReferenceContext,
  FileReferencePromptContext,
  FileReferencePromptFiber,
  FileSearchCandidate,
  FileSearchConfig,
  FileSearchConfigInput,
} from "./types.ts";

export { FILE_REFERENCE_PROMPT, activeAtToken, formatFileMention };
export { DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES, DEFAULT_FILE_SEARCH_MAX_ENTRIES, DEFAULT_FILE_SEARCH_MAX_RESULTS, WorkspaceFileSearch };

/**
 * Nhà cung cấp `ctx.fileReferences` trên hệ tệp cục bộ.
 *
 * Mỗi agent có MỘT chỉ mục riêng gốc tại cwd của nó; đổi cwd là gỡ chỉ mục cũ và dựng chỉ mục mới.
 * Mục prompt `context:file-reference` cài theo vòng đời agent và chữ của nó phụ thuộc việc agent có
 * tool `read` hay không — không có `read` thì mục rỗng, để lời nhắc không hứa một khả năng vắng mặt.
 */
export class LocalFileReferenceService extends FileReferenceService {
  /** Seam cần có: sổ agent và thư mục làm việc của agent. */
  static inject = ["agents", "workingDirectory"];

  /** Schema cấu hình (schemastery) — giữ nguyên ba trường và mặc định của bản gốc. */
  static Config = z.object({
    maxResults: z.number().step(1).min(1).default(DEFAULT_FILE_SEARCH_MAX_RESULTS),
    maxEntries: z.number().step(1).min(1).default(DEFAULT_FILE_SEARCH_MAX_ENTRIES),
    excludedDirectories: z.array(z.string()).default([...DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES]),
  });

  /** Cấu hình đã chốt của plugin (ba trường, đã hợp nhất mặc định). */
  config: FileSearchConfig;

  /** Chỉ mục theo agent — mỗi agent một thực thể `WorkspaceFileSearch`. */
  searches = new Map<Agent, { cwd: string; search: WorkspaceFileSearch }>();

  /** Fiber của mục prompt đã cài, theo agent — cài MỘT lần cho mỗi agent. */
  promptFibers = new Map<Agent, FileReferencePromptFiber>();

  /** Các lượt dọn prompt còn đang chạy, để hiệu ứng dọn cuối cùng chờ hết. */
  promptDisposals = new Set<Promise<void>>();

  /**
   * Đăng ký service `fileReferences`, cài mục prompt cho MỌI agent đang sống, và nối ba sự kiện
   * vòng đời: agent sinh ra (cài prompt), agent bị gỡ (gỡ chỉ mục + prompt), và `tool/result` trong
   * phiên (đánh dấu cũ chỉ mục của agent).
   * Nhận: context host mang các seam đã khai + cấu hình người dùng cấp (tuỳ chọn).
   * Trả: thực thể dịch vụ đã đăng ký dưới tên `fileReferences`; ném khi cấu hình không hợp lệ.
   */
  constructor(ctx: FileReferenceContext, config: FileSearchConfigInput = {}) {
    super(ctx as unknown as Context);
    this.config = {
      maxResults: config.maxResults ?? DEFAULT_FILE_SEARCH_MAX_RESULTS,
      maxEntries: config.maxEntries ?? DEFAULT_FILE_SEARCH_MAX_ENTRIES,
      excludedDirectories: config.excludedDirectories ?? DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES,
    };
    validateConfig(this.config);
    const installPrompt = (agent: Agent): FileReferencePromptFiber => {
      const existing = this.promptFibers.get(agent);
      if (existing !== undefined) return existing;
      /* `Agent` công khai chỉ khai `id`; mặt `ctx` sống do kernel bồi vào lúc chạy, nên đọc qua
       * kiểu theo CẤU TRÚC thay vì đoán hình dạng. */
      const promptContext = agent.ctx as unknown as FileReferencePromptContext;
      const fiber = promptContext.inject(["systemPrompt", "tools"], (scope) => {
        scope.systemPrompt.section({
          name: "context:file-reference",
          order: scope.systemPrompt.getSectionOrder("FILE_REFERENCE"),
          text: () => (promptContext.tools.get("read", agent) === undefined ? "" : FILE_REFERENCE_PROMPT),
        });
      });
      this.promptFibers.set(agent, fiber);
      return fiber;
    };
    const disposePrompt = (agent: Agent): void => {
      const fiber = this.promptFibers.get(agent);
      if (fiber === undefined) return;
      this.promptFibers.delete(agent);
      /* Lỗi dọn prompt KHÔNG được làm hỏng lượt gỡ: ghi cảnh báo rồi đi tiếp, đúng như bản gốc. */
      const task = fiber.dispose().catch((error: unknown) => {
        ctx.logger.warn(`file-reference-local: prompt cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      });
      this.promptDisposals.add(task);
      task.finally(() => {
        this.promptDisposals.delete(task);
      });
    };
    for (const agent of ctx.agents.list()) installPrompt(agent);
    ctx.on("agent/created", async ({ agent }) => {
      await installPrompt(agent);
    });
    ctx.on("agent/disposed", ({ agent }) => {
      this.searches.get(agent)?.search.dispose();
      this.searches.delete(agent);
      disposePrompt(agent);
    });
    ctx.on("session/event", (session, event) => {
      if (event.type !== "tool/result") return;
      const agent = ctx.agents.get(session.id);
      if (agent !== undefined) this.searches.get(agent)?.search.invalidate();
    });
    ctx.effect(
      () => async () => {
        for (const { search } of this.searches.values()) search.dispose();
        this.searches.clear();
        const promptFibers = [...this.promptFibers.values()];
        this.promptFibers.clear();
        await Promise.all([...promptFibers.map((fiber) => fiber.dispose()), ...this.promptDisposals]);
      },
      "file-reference-local: search cache",
    );
  }

  /**
   * Liệt kê ứng viên đường dẫn cho cwd của MỘT agent.
   * Nhận: agent đích + chữ truy vấn sau `@` hoặc `@"` + tín hiệu huỷ của người gọi.
   * Trả: ứng viên chỉ-đường-dẫn, tất định; chỉ mục được dựng lại khi cwd của agent đổi.
   */
  async list(agent: Agent, query: string, signal: AbortSignal): Promise<FileSearchCandidate[]> {
    const cwd = await (this.ctx as unknown as FileReferenceContext).workingDirectory.ensure(agent, signal);
    let cached = this.searches.get(agent);
    if (cached?.cwd !== cwd) {
      cached?.search.dispose();
      cached = {
        cwd,
        search: new WorkspaceFileSearch(cwd, this.config),
      };
      this.searches.set(agent, cached);
    }
    return cached.search.list(query, signal);
  }
}

/**
 * Kiểm cấu hình đã hợp nhất ngay tại biên plugin.
 * Nhận: cấu hình đã chốt (ba trường).
 * Trả: không; ném `Error` có tiền tố `file-reference-local:` khi một trường không hợp lệ.
 */
function validateConfig(config: FileSearchConfig): void {
  if (!Number.isSafeInteger(config.maxResults) || config.maxResults <= 0) throw new Error("file-reference-local: maxResults must be a positive safe integer");
  if (!Number.isSafeInteger(config.maxEntries) || config.maxEntries <= 0) throw new Error("file-reference-local: maxEntries must be a positive safe integer");
  if (config.excludedDirectories.some((name) => name.length === 0 || name.includes("/") || name.includes("\\"))) throw new Error("file-reference-local: excludedDirectories entries must be non-empty directory basenames");
}

export default LocalFileReferenceService;
