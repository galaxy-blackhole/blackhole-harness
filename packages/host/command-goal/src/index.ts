/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào của @galaxy-blackhole/gbh-command-goal — port 1:1 @deepseek-ai/dsh-command-goal
 *      (stock lib/index.js 187 dòng, host-only): plugin cordis tên `command-goal`,
 *      `inject ['commands','goals']`, đăng ký lệnh `/goal` trên seam ctx.commands + goals.
 */

import { CommandDefinitionId } from "@galaxy-blackhole/gbh-commands/brand";
// PHASE B: kiểu lệnh nằm ở module types của gói GBH (exports "./src/*") — dùng đúng đường dẫn công bố.
import type { CommandInvocation, CommandResult } from "@galaxy-blackhole/gbh-commands/src/types.ts";
import { GoalError } from "@galaxy-blackhole/gbh-goal";
import type { GoalPhase, GoalRef, GoalView } from "@galaxy-blackhole/gbh-goal/src/types.ts";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import type { ContentBlock } from "@deepseek-ai/dsh-llm";
import type { Context } from "@deepseek-ai/cordis";

/**
 * Lệnh người dùng `/goal` trên miền goal bền của CÙNG phiên.
 *
 * Port 1:1 bundle stock: cùng tên plugin, cùng `inject`, cùng bốn trường của định nghĩa lệnh
 * (`definitionId` · `name` · `description` · `input`) và cùng bảy nhánh xử lý
 * (`show` · `invalid-edit` · `create` · `edit` · `pause` · `resume` · `clear`).
 * @module @galaxy-blackhole/gbh-command-goal
 */

/** Tên plugin cordis dùng cho chẩn đoán của Loader — nguyên văn bản gốc. */
export const name = "command-goal";

/**
 * Hai seam plugin tiêu thụ trước khi chạy (nguyên văn bản gốc đọc từ artefact):
 * `commands` (sổ lệnh) và `goals` (service goal của phiên). Không khai `llm`:
 * `createUserMessage` là hàm thuần của module `dsh-llm`, không phải seam `ctx.llm`.
 */
export const inject: string[] = ["commands", "goals"];

/**
 * Seam CẤU TRÚC của miền goal (ADR 000d — PHASE B 08/11/2026, dev-1): CHỈ khai đúng sáu phương thức mà
 * lệnh `/goal` dùng, nên không phụ thuộc augmentation `declare module "@deepseek-ai/cordis"` của bản stock.
 */
interface GoalsLike {
  /** Đọc goal hiện tại của agent. Nhận: agent. Trả: khung nhìn goal hoặc undefined. */
  get(agent: unknown): GoalView | undefined;
  /** Tạo goal mới. Nhận: agent + yêu cầu {objective}. Trả: khung nhìn goal vừa tạo. */
  create(agent: unknown, request: { readonly objective: string }): GoalView;
  /** Sửa mục tiêu theo CAS. Nhận: agent + ref + {objective}. Trả: khung nhìn sau khi sửa. */
  edit(agent: unknown, ref: GoalRef, request: { readonly objective: string }): GoalView;
  /** Tạm dừng goal. Nhận: agent + ref. Trả: khung nhìn sau khi dừng. */
  pause(agent: unknown, ref: GoalRef): GoalView;
  /** Chạy tiếp goal. Nhận: agent + ref. Trả: khung nhìn sau khi chạy tiếp. */
  resume(agent: unknown, ref: GoalRef): GoalView;
  /** Xoá goal. Nhận: agent + ref. Trả: ref đã xoá. */
  clear(agent: unknown, ref: GoalRef): GoalRef;
}

/**
 * Lấy seam theo CẤU TRÚC: ưu tiên `ctx.get(name)` (đường chính thức của cordis), chạm dự phòng thuộc tính
 * cùng tên (kernel cũ và giàn test chỉ phơi thuộc tính). Trả undefined khi không có ⇒ nơi gọi tự nổ.
 * Nhận: ctx — context cordis (hoặc vật giả trong test); name — tên service. Trả: seam nếu có.
 */
function seamOf<T>(ctx: unknown, name: string): T | undefined {
  const holder = ctx as { get?: (key: string) => unknown; [key: string]: unknown };
  const viaGet = typeof holder.get === "function" ? holder.get(name) : undefined;
  const value = viaGet ?? holder[name];
  return (value ?? undefined) as T | undefined;
}

/**
 * Seam CẤU TRÚC của sổ lệnh kernel (ADR 000d — PHASE B 08/11/2026, dev-1): chỉ phần lệnh `/goal` dùng.
 */
interface CommandsLike {
  /**
   * Đăng ký MỘT định nghĩa lệnh lên sổ của kernel.
   * Nhận: definition — định nghĩa lệnh (/goal). Trả: không quan tâm giá trị trả về.
   */
  register(definition: {
    readonly definitionId: string;
    readonly name: string;
    readonly description: string;
    readonly input: { readonly hint: string; readonly attachments: boolean };
    readonly handler: (invocation: CommandInvocation) => CommandResult | Promise<CommandResult>;
  }): unknown;
}

/** Câu hướng dẫn in kèm mọi kết quả lỗi/trống — nguyên văn bản gốc. */
const USAGE = "Usage: /goal [<objective>|clear|edit <objective>|pause|resume]";

/**
 * Ném lỗi rõ ràng nếu một union ĐÓNG phía trên có thêm thành viên chưa xử lý.
 * Nhận: value — thành viên còn lại (kiểu `never`); label — tên union để thông điệp đọc được.
 * Trả: không bao giờ trả; luôn ném TypeError.
 */
function assertNever(value: never, label: string): never {
  throw new TypeError(`unknown ${label}: ${String(value)}`);
}

/** Ngữ pháp lệnh `/goal` đã tách: bảy hình dạng ĐÓNG mà handler xử lý. */
type GoalCommand =
  | { readonly kind: "show" }
  | { readonly kind: "clear" }
  | { readonly kind: "pause" }
  | { readonly kind: "resume" }
  | { readonly kind: "invalid-edit" }
  | { readonly kind: "edit"; readonly objective: string }
  | { readonly kind: "create"; readonly objective: string };

/**
 * Tách CHỈ ngữ pháp do `/goal` sở hữu; mọi đầu vào khác là objective tự do.
 * Nhận: rawInput — phần người dùng gõ sau tên lệnh (kể cả khoảng trắng phân cách).
 * Trả: một `GoalCommand`; chuỗi rỗng ⇒ `show`; `edit` trần ⇒ `invalid-edit`.
 */
function parseGoalCommand(rawInput: string): GoalCommand {
  const input = rawInput.trim();
  if (input.length === 0) return { kind: "show" };
  const control = input.toLowerCase();
  if (control === "clear") return { kind: "clear" };
  if (control === "pause") return { kind: "pause" };
  if (control === "resume") return { kind: "resume" };
  if (control === "edit") return { kind: "invalid-edit" };
  if (/^edit(?=\s)/iu.test(input))
    return {
      kind: "edit",
      objective: input.slice(4).trim(),
    };
  return {
    kind: "create",
    objective: input,
  };
}

/**
 * Nhãn người đọc cho một pha goal bền.
 * Nhận: phase — pha đóng của goal.
 * Trả: nhãn tiếng Anh nguyên văn (`active` · `paused` · `blocked` · `complete`).
 */
function phaseLabel(phase: GoalPhase): string {
  switch (phase) {
    case "active":
      return "active";
    case "paused":
      return "paused";
    case "blocked":
      return "blocked";
    case "complete":
      return "complete";
    default:
      return assertNever(phase, "goal phase");
  }
}

/**
 * Những lệnh còn có nghĩa từ ĐÚNG trạng thái sống hiện tại.
 * Nhận: goal — khung nhìn goal hiện tại (pha bền + activation phạm vi tiến trình).
 * Trả: chuỗi gợi ý các lệnh kế tiếp, nguyên văn bản gốc.
 */
function commandHint(goal: GoalView): string {
  if (goal.phase === "active")
    return goal.activation === "armed"
      ? "/goal edit <objective>, /goal pause, /goal clear"
      : "/goal edit <objective>, /goal resume, /goal clear";
  switch (goal.phase) {
    case "paused":
    case "blocked":
      return "/goal edit <objective>, /goal resume, /goal clear";
    case "complete":
      return "/goal <objective>, /goal clear";
    default:
      return assertNever(goal.phase, "goal phase");
  }
}

/**
 * Dựng kết quả hiển thị trực tiếp cho UI mà không phơi chi tiết compare-and-set.
 * Nhận: title — dòng tiêu đề theo hành động vừa xong; goal — khung nhìn goal hiện tại.
 * Trả: kết quả `success` gồm pha, blocker (khi blocked), objective, rounds, activation và gợi ý lệnh.
 * Ném: TypeError khi goal `blocked` thiếu lý do (bất biến của replay bền).
 */
function renderGoal(title: string, goal: GoalView): CommandResult {
  const reason = goal.phase === "blocked" ? goal.blockedReason : undefined;
  if (goal.phase === "blocked" && reason === undefined) throw new TypeError("blocked goal is missing its reason");
  const blocker = reason === undefined ? [] : [`Blocker: ${reason.code}: ${reason.message}`];
  return {
    kind: "success",
    text: [
      title,
      `Status: ${phaseLabel(goal.phase)}`,
      ...blocker,
      `Objective: ${goal.objective}`,
      `Rounds: ${goal.roundsStarted}/${goal.maxGoalRounds}`,
      `Activation: ${goal.activation}`,
      "",
      `Commands: ${commandHint(goal)}`,
    ].join("\n"),
  };
}

/**
 * Lấy ref compare-and-set CHÍNH XÁC của goal hiện tại.
 * Nhận: goal — khung nhìn goal hiện tại.
 * Trả: object hai trường `id` + `revision` (đúng vật mà service chấp nhận).
 */
function goalRef(goal: GoalView): GoalRef {
  return {
    id: goal.id,
    revision: goal.revision,
  };
}

/**
 * Lỗi trực tiếp cho thao tác bắt buộc phải có goal hiện tại.
 * Nhận: action — tên thao tác người dùng vừa gõ (`edit` · `pause` · `resume`).
 * Trả: kết quả `error` nêu thao tác đó cần goal và in kèm USAGE.
 */
function missingGoal(action: string): CommandResult {
  return {
    kind: "error",
    text: `No goal is currently set; /goal ${action} requires one. ${USAGE}`,
  };
}

/**
 * Gửi attachment đã được nhận của lượt gọi thành MỘT tin nhắn người dùng model thấy,
 * đứng trước vòng goal kế tiếp. Attachment đứng trước khối văn bản cố định nêu vai trò,
 * nên vòng goal sau đọc chúng từ lịch sử phiên thường mà miền goal không phải lưu trạng thái attachment.
 * Nhận: invocation — lượt gọi lệnh có `agent` và `attachments`.
 * Trả: không; chỉ gọi `agent.followup` khi có ít nhất một attachment.
 */
function submitObjectiveAttachments(invocation: CommandInvocation): void {
  if (invocation.attachments.length === 0) return;
  const content: ContentBlock[] = [
    ...invocation.attachments,
    {
      type: "text",
      text: "Reference attachments for the goal objective.",
    },
  ];
  // PHASE B: `followup` do seam agent của kernel cấp (CommandAgent của gói GBH chỉ khai `session`) ⇒ khai CẤU TRÚC tại chỗ.
  const agent = invocation.agent as unknown as { followup(message: unknown): void };
  agent.followup(
    createUserMessage({
      content,
      source: { kind: "user" },
    }),
  );
}

/**
 * Thực thi MỘT lệnh người dùng đã tách qua miền sở hữu việc lưu bền (`ctx.goals`).
 * Nhận: ctx — context plugin (đọc `ctx.goals` tại thời điểm gọi, y bản gốc); invocation — lượt gọi lệnh.
 * Trả: kết quả `success`/`error` cho UI; lỗi `GoalError` của miền goal được chuyển thành câu lỗi ổn định,
 *      mọi lỗi khác được NÉM NGUYÊN VĂN.
 */
function executeGoalCommand(ctx: Context, invocation: CommandInvocation): CommandResult {
  const command = parseGoalCommand(invocation.rawInput);
  if (invocation.attachments.length > 0 && command.kind !== "create" && command.kind !== "edit")
    return {
      kind: "error",
      text: "Attachments only accompany a goal objective: /goal <objective> or /goal edit <objective>.",
    };
  try {
    // PHASE B (ADR 000d, 08/11/2026 dev-1): miền goal đọc qua SEAM CẤU TRÚC ctx.get("goals") thay vì thuộc tính
    // augment ctx.goals; đọc TẠI THỜI ĐIỂM GỌI như bản gốc, thiếu seam là lỗi cấu hình ⇒ nổ NGAY (fail loud).
    const goals = seamOf<GoalsLike>(ctx, "goals");
    if (goals === undefined) throw new TypeError('command-goal requires the goals seam (ctx.get("goals"))');
    const current = goals.get(invocation.agent);
    switch (command.kind) {
      case "show":
        return current === undefined
          ? {
              kind: "success",
              text: `No goal is currently set.\n${USAGE}`,
            }
          : renderGoal("Goal", current);
      case "invalid-edit":
        return {
          kind: "error",
          text: `Goal editing requires a replacement objective.\n${USAGE}`,
        };
      case "create": {
        if (current !== undefined && current.phase !== "complete")
          return {
            kind: "error",
            text: `A goal is already ${phaseLabel(current.phase)}. Use /goal edit <objective> to change it or /goal clear before replacing it.`,
          };
        const created = goals.create(invocation.agent, { objective: command.objective });
        submitObjectiveAttachments(invocation);
        return renderGoal("Goal created", created);
      }
      case "edit": {
        if (current === undefined) return missingGoal("edit");
        if (current.phase === "complete") {
          const replaced = goals.create(invocation.agent, { objective: command.objective });
          submitObjectiveAttachments(invocation);
          return renderGoal("Goal created", replaced);
        }
        const edited = goals.edit(invocation.agent, goalRef(current), { objective: command.objective });
        submitObjectiveAttachments(invocation);
        return renderGoal("Goal updated", edited);
      }
      case "pause":
        if (current === undefined) return missingGoal("pause");
        return renderGoal("Goal paused", goals.pause(invocation.agent, goalRef(current)));
      case "resume":
        if (current === undefined) return missingGoal("resume");
        return renderGoal("Goal resumed", goals.resume(invocation.agent, goalRef(current)));
      case "clear":
        if (current === undefined)
          return {
            kind: "success",
            text: "No goal to clear.",
          };
        goals.clear(invocation.agent, goalRef(current));
        return {
          kind: "success",
          text: "Goal cleared.",
        };
      default:
        return assertNever(command, "goal command");
    }
  } catch (error) {
    if (error instanceof GoalError)
      return {
        kind: "error",
        text: "The goal command is not valid for the current state. Run /goal to view available commands.",
      };
    throw error;
  }
}

/**
 * Đăng ký lệnh `/goal` hình Codex cho MỌI adapter lệnh đã lắp.
 * Nhận: ctx — context plugin; đăng ký sống theo context này (bản gốc không tự giữ disposer).
 * Trả: không; đăng ký đúng MỘT định nghĩa với `definitionId` brand của gói stock.
 */
export function apply(ctx: Context): void {
  // PHASE B (ADR 000d): sổ lệnh đọc qua SEAM CẤU TRÚC ctx.get("commands"); thiếu seam ⇒ nổ NGAY (fail loud).
  const commands = seamOf<CommandsLike>(ctx, "commands");
  if (commands === undefined) throw new TypeError('command-goal requires the commands seam (ctx.get("commands"))');
  commands.register({
    definitionId: CommandDefinitionId("@deepseek-ai/dsh-command-goal"),
    name: "goal",
    description: "Set or view the goal for a long-running task",
    input: {
      hint: "[<objective>|clear|edit <objective>|pause|resume]",
      attachments: true,
    },
    handler: (invocation) => executeGoalCommand(ctx, invocation),
  });
}
