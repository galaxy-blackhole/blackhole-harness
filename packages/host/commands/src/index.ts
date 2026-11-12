/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của @galaxy-blackhole/gbh-commands — sổ đăng ký lệnh do plugin sở hữu, dùng chung cho mọi adapter UI tương tác (row `commands` của DSH).
 */

import { randomUUID } from "node:crypto";
import type { Context } from "@deepseek-ai/cordis";
import { AttachmentError } from "@deepseek-ai/dsh-attachment";
import type { AttachmentStore } from "@deepseek-ai/dsh-attachment";
import { ScopedLayers } from "@deepseek-ai/dsh-scope";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { admitCommandAttachments } from "./attachments.ts";
import { CommandDefinitionId, CommandId } from "./brand.ts";
import { CommandLayer } from "./layer.ts";
import { normalizeDefinition, normalizeResult, type RegisteredCommand } from "./normalize.ts";
import { parseCommand } from "./parse.ts";
import { abortError, cancellationOf, renderThrown, withAbort } from "./support.ts";
import type {
  CommandAgent,
  CommandAttachmentBlock,
  CommandDefinition,
  CommandDescriptor,
  CommandExecution,
  CommandFileReceiptResolver,
  CommandResult,
  CommandSessionLike,
  CommandSource,
  CommandSubmitAttachment,
} from "./types.ts";

/** Tên plugin cordis — nguyên văn của bản gốc. */
export const name = "commands";

/**
 * Giá trị đính kèm dùng chung, ĐÓNG BĂNG, cho các lượt gọi không có tệp đính kèm.
 * Một hằng duy nhất đúng như bản gốc: mọi handler nhận CÙNG mảng rỗng bất biến này.
 */
const NO_ATTACHMENTS: readonly CommandAttachmentBlock[] = Object.freeze([]);

/**
 * Sổ đăng ký lệnh cho người. Định nghĩa trên context trần là TOÀN CỤC; định nghĩa đăng ký
 * qua một context con có inject lệnh của một agent sẽ CHE định nghĩa toàn cục cho agent đó.
 *
 * Kế thừa `TypertRemoteService` (peer `dsh-typert-protocol`) để Gateway của kernel
 * discovery được hai endpoint `commands/list` và `commands/execute`; phải là ĐÚNG lớp cơ sở
 * đó, không phải bản sao.
 */
export class CommandRuntime extends TypertRemoteService {
  /** Hai lớp đăng ký (global + theo phạm vi) trên `ScopedLayers` của `dsh-scope`. */
  private readonly layers: ScopedLayers<CommandLayer> = new ScopedLayers<CommandLayer>(
    (scope) => new CommandLayer(scope),
    () => {
      this.notifyChange();
    },
  );

  /** Bộ đếm tăng đơn điệu theo từng thực thể, đứng sau {@link mintCommandId}. */
  private commandSeq = 0;

  /** Token thực thể giữ id đúc ra không trùng nhau qua các lần khởi động lại trên cùng một log. */
  private readonly instanceToken = randomUUID().slice(0, 8);

  /** Bộ giải biên nhận tệp tuỳ chọn do chủ sở hữu upload của Session cài. */
  private readonly fileReceipts: { resolver: CommandFileReceiptResolver | undefined } = { resolver: undefined };

  /**
   * Đăng ký service `commands` vào context đang kích hoạt.
   * Nhận: `ctx` — context của plugin.
   */
  constructor(ctx: Context) {
    super(ctx, "commands");
  }

  /**
   * Đăng ký một lệnh toàn cục hoặc theo phạm vi của agent đang gọi.
   * Nhận: `definition` — metadata khám phá + handler trực tiếp cho UI.
   * Trả: ĐÚNG bộ huỷ hiệu lực để gỡ định nghĩa này.
   */
  register(definition: CommandDefinition): () => void {
    const registered = normalizeDefinition(definition);
    return this.layers.effect(this.ctx, (layer) => layer.commands.insert(registered.definition.name, registered), {
      label: "commands.register()",
    });
  }

  /**
   * Đăng ký cơ quan DUY NHẤT giải biên nhận tệp đã đóng gói cho các lượt gửi lệnh.
   * Nhận: `resolver` — bộ giải biên nhận biết Session.
   * Trả: bộ huỷ gỡ ĐÚNG bộ giải này.
   * @throws {Error} khi đã có một bộ giải được đăng ký.
   */
  registerFileReceiptResolver(resolver: CommandFileReceiptResolver): () => void {
    if (this.fileReceipts.resolver !== undefined) throw new Error("commands: a file receipt resolver is already registered");
    this.fileReceipts.resolver = resolver;
    return () => {
      if (this.fileReceipts.resolver === resolver) this.fileReceipts.resolver = undefined;
    };
  }

  /**
   * Liệt kê các descriptor lệnh hiệu lực, BẤT BIẾN, cho một agent.
   * Nhận: `agent` — đúng agent nhận và cũng là khoá của lớp phạm vi.
   * Trả: descriptor ĐÃ sắp theo tên, sau khi lớp phạm vi che lớp toàn cục.
   */
  @Remote
  list(agent: CommandAgent): readonly CommandDescriptor[] {
    return Object.freeze(
      [...this.view(agent).values()].map((command) => command.descriptor).sort((left, right) => (left.name < right.name ? -1 : 1)),
    );
  }

  /**
   * Phân giải MỘT định nghĩa lệnh hiệu lực.
   * Nhận: `agent` — đúng agent nhận; `name` — tên lệnh không có dấu gạch chéo.
   * Trả: định nghĩa của lớp phạm vi (nếu có), ngược lại định nghĩa toàn cục.
   */
  find(agent: CommandAgent, name: string): CommandDefinition | undefined {
    return this.view(agent).get(name)?.definition;
  }

  /**
   * Phân tích và thực thi một lệnh ĐÃ BIẾT mà KHÔNG gửi nó cho mô hình.
   *
   * Vòng đời của một lệnh phân giải được đều được ghi log: `command/run` được thêm TRƯỚC
   * khi gọi handler và `command/done` sau khi an bài (handler ném hoặc bị huỷ thì an bài
   * thành `kind: 'error'`). Cả hai là lần ghi chỉ-trong-log trực tiếp — không lượt nào bọc
   * chúng. Lượt trượt admission (sai cú pháp hoặc tên lạ) KHÔNG ghi gì. Ghi `command/run`
   * lỗi thì lượt thực thi hỏng ỒN; ghi `command/done` lỗi trên đường handler-hỏng thì được
   * bao lại để lỗi của chính handler vẫn là lỗi được báo.
   *
   * Admission tệp đính kèm được áp Ở ĐÂY, không phải ở composer: đính kèm gửi cho lệnh
   * không khai `input.attachments`, thiếu store đính kèm, và vượt hạn mức ảnh đều an bài
   * thành kết quả lỗi TRƯỚC khi handler chạy.
   *
   * Nhận: `agent` — đúng agent nhận; `line` — dòng lệnh gạch chéo đầy đủ;
   * `submittedAttachments` — ảnh đã mã hoá + biên nhận tệp gửi kèm, theo thứ tự gửi;
   * `signal` — tín hiệu huỷ do yêu cầu UI sở hữu.
   * Trả: lượt thực thi đã an bài (kết quả + id ghép cặp vòng đời), hoặc `undefined` khi
   * cú pháp hoặc tên không phân giải được.
   */
  @Remote
  async execute(
    agent: CommandAgent,
    line: string,
    submittedAttachments: readonly CommandSubmitAttachment[],
    signal: AbortSignal,
  ): Promise<CommandExecution | undefined> {
    const parsed = parseCommand(line);
    if (parsed === undefined) return undefined;
    const command = this.view(agent).get(parsed.name);
    if (command === undefined) return undefined;
    if (signal.aborted) throw abortError(signal);
    const commandId = this.mintCommandId();
    this.appendLifecycle(agent.session, "command/run", {
      commandId,
      name: parsed.name,
      ...(command.definition.recordInput === false ? {} : { args: parsed.rawInput }),
      source: { kind: "user" } satisfies CommandSource,
    });
    const settle = (result: CommandResult): CommandExecution => {
      this.appendLifecycle(agent.session, "command/done", {
        commandId,
        kind: result.kind,
        ...(result.text === undefined ? {} : { text: result.text }),
        ...(result.kind === "success" && result.sourceEventSeq !== undefined ? { sourceEventSeq: result.sourceEventSeq } : {}),
      });
      return Object.freeze({
        commandId,
        result: Object.freeze(result),
      });
    };
    let attachments: readonly CommandAttachmentBlock[] = NO_ATTACHMENTS;
    if (submittedAttachments.length > 0) {
      if (command.definition.input?.attachments !== true)
        return settle({ kind: "error", text: `/${parsed.name} does not accept attachments` });
      const store = this.ctx.get("attachments") as AttachmentStore | undefined;
      if (store === undefined)
        return settle({
          kind: "error",
          text: `/${parsed.name}: attachments are unavailable because no attachment store is composed`,
        });
      try {
        attachments = await admitCommandAttachments(store, submittedAttachments, (receiptId) =>
          this.fileReceipts.resolver?.(agent, receiptId),
        );
      } catch (error) {
        if (error instanceof AttachmentError) return settle({ kind: "error", text: error.message });
        this.settleThrown(agent.session, parsed.name, commandId, error);
        throw error;
      }
      const cancelledDuringAdmission = cancellationOf(signal);
      if (cancelledDuringAdmission !== undefined) {
        this.settleThrown(agent.session, parsed.name, commandId, cancelledDuringAdmission);
        throw cancelledDuringAdmission;
      }
    }
    const invocation = Object.freeze({
      commandId,
      agent,
      rawInput: parsed.rawInput,
      attachments,
      signal,
    });
    let result: CommandResult;
    try {
      const output = command.definition.handler(invocation);
      result = normalizeResult(parsed.name, await withAbort(Promise.resolve(output), signal));
    } catch (error) {
      this.settleThrown(agent.session, parsed.name, commandId, error);
      throw error;
    }
    return settle(result);
  }

  /**
   * Lần ghi `command/done` lỗi ĐÃ BAO LẠI, cho handler ném hoặc admission hỏng.
   * Nhận: `session` — session nhận bản ghi; `command` — tên lệnh; `commandId` — id ghép cặp;
   * `error` — lỗi cần vẽ thành kết quả `error`.
   * Trả: không; lỗi ghi log được nuốt kèm một dòng `warn`.
   */
  private settleThrown(session: CommandSessionLike, command: string, commandId: CommandId, error: unknown): void {
    try {
      this.appendLifecycle(session, "command/done", {
        commandId,
        kind: "error",
        text: error instanceof Error ? error.message : renderThrown(error),
      });
    } catch (appendError) {
      this.ctx.logger.warn(`command "${command}": command/done append failed: ${renderThrown(appendError)}`);
    }
  }

  /**
   * Đúc id ghép cặp kế tiếp (đơn điệu; có tiền tố token thực thể nên log nối lại không lặp id).
   * Nhận: không.
   * Trả: `cmd-<token 8 ký tự>-<số thứ tự>` đã gắn nhãn CommandId.
   */
  private mintCommandId(): CommandId {
    this.commandSeq += 1;
    return CommandId(`cmd-${this.instanceToken}-${this.commandSeq}`);
  }

  /**
   * Ghi MỘT sự kiện vòng đời chỉ-trong-log trực tiếp: không mở lượt nào và không ép flush —
   * persistence quan sát đường `session/event` ngay khi ghi và xả ở các điểm kiểm tra thường.
   * Nhận: `session` — session nhận; `type` — tên sự kiện; `data` — payload.
   * Trả: giá trị do `session.append` trả về.
   */
  private appendLifecycle(session: CommandSessionLike, type: string, data: unknown): unknown {
    return session.append.bind(session)(type, data);
  }

  /**
   * Phân giải định nghĩa toàn cục rồi tới các lớp phạm vi che nó.
   * Nhận: `agent` — khoá phạm vi (agent nhận lệnh).
   * Trả: bảng tên → lệnh đã đăng ký, theo thứ tự chèn, lớp gần nhất thắng tên.
   */
  private view(agent: CommandAgent): Map<string, RegisteredCommand> {
    return this.layers.merge(agent, (layer) => layer.commands);
  }

  /**
   * Báo cho MỌI quan sát viên của sổ đăng ký mà không để việc UI làm mới thành gánh nặng.
   * Nhận: không.
   * Trả: không; lỗi của listener (ném ngay hoặc từ chối về sau) được nuốt kèm một dòng `warn`.
   */
  private notifyChange(): void {
    for (const callback of this.ctx.events.dispatch("emit", ["commands/change"])) {
      try {
        const returned = callback();
        Promise.resolve(returned).catch((error: unknown) => {
          this.ctx.logger.warn(`commands/change listener rejected: ${renderThrown(error)}`);
        });
      } catch (error) {
        this.ctx.logger.warn(`commands/change listener threw: ${renderThrown(error)}`);
      }
    }
  }
}

export { CommandDefinitionId, CommandId, parseCommand };
// 08/11/2026 — TÁI XUẤT MẶT KIỂU: consumer (plan-mode, command-goal, permission, agent-loop, time-context…)
//   cần CommandDefinition/CommandInvocation/CommandResult từ ENTRY; thiếu chúng thì đổi sang id GBH là gập kiểu
//   (review-2 phát hiện, chặn 7 gói). Một dòng này mở khoá cả nhóm.
export type * from "./types.ts";

export default CommandRuntime;