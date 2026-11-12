/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Thư mục làm việc của phiên (`ctx.workingDirectory`): một chủ sở hữu duy nhất cho thư mục hiệu lực
 *      của mỗi phiên, thay đổi bền qua nhật ký phiên, ngữ cảnh model nhìn thấy, và khôi phục dự án gốc
 *      khi thư mục hiện tại biến mất. Bản viết lại của Galaxy Blackhole cho row working-directory
 *      (@deepseek-ai/dsh-working-directory) — nguồn đối chiếu: xem README.md của package (G4).
 */

import type { Context } from "@deepseek-ai/cordis";
import { Service } from "@deepseek-ai/cordis";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import z from "@deepseek-ai/schemastery";
import { assertAbsoluteDefault, directoryStateSchema, renderContextText, renderNoticeText } from "./directory.ts";
import { seamsOf } from "./seams.ts";
import type { AgentLike, DirectoryState, SessionLike } from "./seams.ts";

declare module "@deepseek-ai/dsh-llm" {
  interface MessageSourceMap {
    /**
     * Thông báo đổi thư mục đã ghi bền — nguồn của tin ngữ cảnh đi vào hộp thư agent.
     * @persistenceAttribution
     */
    "working-directory": {
      /** Nguồn duy nhất của các thông báo chuyển thư mục. */
      kind: "working-directory";
    };
  }
}

/** Cấu hình plugin: thư mục dự phòng của deployment cho phiên không có dự án gốc. */
export interface Config {
  /** Thư mục dự phòng TUYỆT ĐỐI trong thế giới thi hành; vắng thì dùng thư mục khởi động. */
  defaultDirectory?: string;
}

/**
 * Một chủ sở hữu cho thư mục hiệu lực của mỗi phiên và các thay đổi model nhìn thấy.
 *
 * Thư mục nằm trong CHIẾU PHIÊN nên người đọc nguội dùng được mà không cần agent sống; header phiên
 * vẫn giữ dự án GỐC. Mọi thay đổi được chuỗi hoá theo phiên, kiểm bằng seam `fs`, kiểm tín hiệu huỷ và
 * vòng đời agent, ghi một sự kiện bền, rồi xếp một thông báo ngữ cảnh cho model.
 */
export class WorkingDirectoryService extends Service {
  /** Seam bắt buộc: hệ tệp, sổ chiếu phiên, sổ mục system prompt. */
  static inject = ["fs", "sessionProjections", "systemPrompt"];

  /** Schema cấu hình (schemastery) — đúng một trường tuỳ chọn, y bản gốc. */
  static Config = z.object({ defaultDirectory: z.string() }) as unknown as z<Config>;

  /** Thư mục dự phòng TUYỆT ĐỐI của deployment cho phiên không có thư mục gốc đã ghi. */
  readonly defaultDirectory: string;

  /** Đuôi chuỗi hoá theo từng phiên: lượt sau chờ lượt trước của CÙNG phiên. */
  private readonly pending = new WeakMap<SessionLike, Promise<void>>();

  /** Các lượt đang chạy, để hàm dọn chờ chúng lặng hẳn. */
  private readonly operations = new Set<Promise<unknown>>();

  /** Vòng đời của service: huỷ khi plugin bị gỡ, để mọi lượt đang chạy thoát ra. */
  private readonly lifecycle = new AbortController();

  /**
   * Đăng ký service `workingDirectory`, chiếu phiên `workingDirectory`, mục ngữ cảnh
   * `working-directory:current`, listener waterfall `system-prompt/assemble`, và hàm dọn vòng đời.
   * Nhận: context host và cấu hình đã qua schema.
   * Trả: thực thể đã đăng ký (thư mục dự phòng đã chốt).
   * @throws khi `defaultDirectory` là đường dẫn tương đối.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "workingDirectory");
    this.defaultDirectory = assertAbsoluteDefault(config.defaultDirectory ?? process.cwd());
    const seams = seamsOf(ctx);
    seams.sessionProjections.register({
      key: "workingDirectory",
      stateVersion: 1,
      stateSchema: directoryStateSchema,
      init: (header) => header.cwd ?? null,
      apply: (state, event) =>
        event.type === "working-directory/change" ? (event.data.cwd as DirectoryState) : state,
      wire: {
        viewSchema: directoryStateSchema,
        view: (state) => state,
      },
    });
    seams.systemPrompt.context({
      name: "working-directory:current",
      order: seams.systemPrompt.getContextOrder("WORKING_DIRECTORY"),
      required: true,
      interpolate: false,
      text: (context) => (context.agent === undefined ? "" : this.contextText(context.agent.session)),
    });
    seams.on(
      "system-prompt/assemble",
      async (_assembly, context, next) => {
        if (context.agent === undefined) return next();
        await this.ensure(context.agent, context.signal);
        const assembly = await next();
        this.lifecycle.signal.throwIfAborted();
        const text = this.contextText(context.agent.session);
        const contribution = assembly.contexts.find((entry) => entry.name === "working-directory:current");
        if (contribution === undefined) {
          assembly.contexts.unshift({
            name: "working-directory:current",
            text,
            interpolate: false,
          });
        } else {
          contribution.text = text;
          contribution.interpolate = false;
        }
        return assembly;
      },
      { prepend: true },
    );
    seams.effect(() => async () => {
      this.lifecycle.abort(new Error("working-directory service disposed"));
      await Promise.allSettled(this.operations);
    });
  }

  /**
   * Đọc thư mục ĐÃ GHI BỀN mà không chạm hệ tệp.
   * Nhận: phiên cần hỏi.
   * Trả: thư mục hiệu lực tuyệt đối của nó, hoặc thư mục dự phòng khi chiếu chưa ghi nhận gì.
   */
  get(session: SessionLike): string {
    return seamsOf(this.ctx).sessionProjections.stateOf(session, "workingDirectory") ?? this.defaultDirectory;
  }

  /**
   * Kiểm thư mục hiện tại và khôi phục dự án GỐC khi nó biến mất.
   * Nhận: agent đang sống (hoặc chưa công bố) sở hữu phiên, và tín hiệu huỷ cho lượt kiểm hệ tệp.
   * Trả: thư mục còn tồn tại; lượt khôi phục được ghi bền TRƯỚC khi trả.
   * Cảnh báo (không hoàn nguyên trạng thái) khi không xếp được thông báo; ném khi dự án gốc cũng mất.
   */
  ensure(agent: AgentLike, signal?: AbortSignal): Promise<string> {
    return this.serialize(agent, signal, async (control) => {
      const seams = seamsOf(this.ctx);
      const current = this.get(agent.session);
      const target = await seams.fs.resolve(current, { signal: control });
      const info = await seams.fs.stat(target, control);
      control.throwIfAborted();
      agent.ctx.fiber.assertActive();
      if (info?.type === "directory") {
        // Lần đầu thấy thư mục hợp lệ: ghi bền ngay để người đọc nguội không phải suy luận.
        if (seams.sessionProjections.stateOf(agent.session, "workingDirectory") === null) {
          agent.session.append("working-directory/change", { cwd: current });
        }
        return current;
      }
      const original = agent.session.header.cwd ?? this.defaultDirectory;
      const restored = await this.directory(original, original, control);
      this.commit(agent, restored, true, control);
      return restored;
    });
  }

  /**
   * Đổi thư mục của MỘT phiên mà không đổi tiến trình hay quyền đang có.
   * Nhận: agent đang sống (hoặc chưa công bố) sở hữu phiên, đường dẫn tuyệt đối hoặc tương đối so với
   * thư mục hiện tại, và tín hiệu huỷ trước khi ghi bền.
   * Trả: thư mục tuyệt đối đã chuẩn hoá, được ghi bền TRƯỚC khi trả.
   * Cảnh báo (không hoàn nguyên) khi không xếp được thông báo; ném khi đường dẫn không phải thư mục.
   */
  set(agent: AgentLike, path: string, signal?: AbortSignal): Promise<string> {
    return this.serialize(agent, signal, async (control) => {
      if (path.length === 0) throw new Error("working-directory: cd must not be empty");
      const directory = await this.directory(path, this.get(agent.session), control);
      this.commit(agent, directory, false, control);
      return directory;
    });
  }

  /**
   * Chữ ngữ cảnh model cho thư mục hiệu lực của một phiên.
   * Nhận: phiên cần hỏi.
   * Trả: một câu `Current working directory: "<path>".` (đường dẫn JSON-quote).
   */
  private contextText(session: SessionLike): string {
    return renderContextText(this.get(session));
  }

  /**
   * Giải và kiểm MỘT đường dẫn thành thư mục tuyệt đối của thế giới thi hành.
   * Nhận: đường dẫn người dùng, thư mục cwd để giải đường dẫn tương đối, và tín hiệu huỷ.
   * Trả: đường dẫn tuyệt đối mà tiến trình mở được.
   * @throws khi đường dẫn không tồn tại, hoặc không phải thư mục.
   */
  private async directory(path: string, cwd: string, signal: AbortSignal): Promise<string> {
    const seams = seamsOf(this.ctx);
    const target = await seams.fs.resolve(path, { cwd, signal });
    const info = await seams.fs.stat(target, signal);
    signal.throwIfAborted();
    if (info?.type !== "directory") {
      throw new Error(`working-directory: directory does not exist: ${JSON.stringify(path)}`);
    }
    return seams.fs.processPath(target);
  }

  /**
   * Ghi bền một lần đổi thư mục và xếp thông báo ngữ cảnh cho model.
   * Nhận: agent sở hữu phiên, thư mục mới, cờ "khôi phục", và tín hiệu huỷ.
   * Trả: không; KHÔNG ghi gì khi thư mục không đổi. Lỗi hộp thư chỉ cảnh báo, không hoàn nguyên.
   */
  private commit(agent: AgentLike, directory: string, recovered: boolean, signal: AbortSignal): void {
    signal.throwIfAborted();
    agent.ctx.fiber.assertActive();
    const previous = this.get(agent.session);
    if (previous === directory) return;
    agent.session.append("working-directory/change", { cwd: directory });
    const notice = createUserMessage({
      content: [{ type: "text", text: renderNoticeText(previous, directory, recovered) }],
      source: { kind: "working-directory" },
    });
    try {
      agent.inject(notice);
    } catch (error) {
      seamsOf(this.ctx).logger.warn(
        `working-directory: committed ${JSON.stringify(directory)}, but could not queue its notice: ${String(error)}`,
      );
    }
  }

  /**
   * Xếp một lượt lên đuôi chuỗi hoá của phiên và theo dõi nó trong tập lượt đang chạy.
   * Nhận: agent sở hữu phiên, tín hiệu huỷ tuỳ chọn của lượt, và thân lượt cần chạy.
   * Trả: promise của CHÍNH lượt đó; lượt sau của cùng phiên chỉ chạy khi lượt này kết thúc (kể cả khi hỏng).
   */
  private serialize(
    agent: AgentLike,
    signal: AbortSignal | undefined,
    action: (control: AbortSignal) => Promise<string>,
  ): Promise<string> {
    const session = agent.session;
    const control = signal === undefined ? this.lifecycle.signal : AbortSignal.any([this.lifecycle.signal, signal]);
    const settled: Promise<string> = (this.pending.get(session) ?? Promise.resolve())
      .then(() => {
        control.throwIfAborted();
        agent.ctx.fiber.assertActive();
        return action(control);
      })
      .finally(() => this.operations.delete(settled));
    this.operations.add(settled);
    this.pending.set(
      session,
      settled.then(
        () => {},
        () => {},
      ),
    );
    return settled;
  }
}
