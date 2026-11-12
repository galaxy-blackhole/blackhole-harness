/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào của @galaxy-blackhole/gbh-tool-goal — port 1:1 nửa host của
 *      @deepseek-ai/dsh-tool-goal (stock lib/index.js dòng 100–379, region lib/types/index.js):
 *      plugin cordis tên "tool-goal", inject ["agents","goals","tools","systemPrompt","sessionProjections"],
 *      đăng ký ba tool get_goal/create_goal/update_goal + mục system prompt "tool:goal".
 */

import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { GoalId } from "@galaxy-blackhole/gbh-goal";
import type { GoalRef, GoalView } from "@galaxy-blackhole/gbh-goal";
import { HarnessError, boundContextSummary, createUserMessage } from "@deepseek-ai/dsh-llm";
import type { ContentBlock, ContextFormed } from "@deepseek-ai/dsh-llm";
// Nạp augmentation của kernel chỉ khai kiểu: `ctx.systemPrompt` (mục prompt) và `ctx.tools` (defineTool).
import type {} from "@galaxy-blackhole/gbh-system-prompt";
import { defineTool } from "@galaxy-blackhole/gbh-host-tools";
import type { ToolCallKind, ToolCallView, ValueSchemaSpec } from "@galaxy-blackhole/gbh-host-tools";
import { completionAuthority, goalToolExecution, requireDirectHuman } from "./authority.ts";
import { renderWrapupContext } from "./wrapup.ts";
import { agentsOf, asGoalAgent, goalsOf, sessionProjectionsOf, toolsOf } from "./seams.ts";

// Nguồn `tool-goal` là một khoá của bảng nguồn tin nhắn (stock index.d.ts dòng 9–15).
declare module "@deepseek-ai/dsh-llm" {
  interface MessageSourceMap {
    "tool-goal": {
      kind: "tool-goal";
    } & ContextFormed;
  }
}

/**
 * Plugin cordis hướng model: ba tool `get_goal`, `create_goal`, `update_goal` trên miền goal bền
 * của cùng phiên, kèm một mục chính sách dùng chung trong system prompt.
 *
 * @module @galaxy-blackhole/gbh-tool-goal
 */

/** Tên plugin cordis dùng cho chẩn đoán của Loader (nguyên văn của bản gốc). */
export const name = "tool-goal";

/** Năm seam phải có trước khi apply chạy: sổ agent, miền goal, sổ tool, system prompt, projection. */
export const inject: string[] = ["agents", "goals", "tools", "systemPrompt", "sessionProjections"];

/** Chính sách miền giá trị của tool goal. */
export interface Config {
  /** Số vòng goal được chấp nhận tối thiểu trước khi model được tự báo `blocked`. */
  blockedAfterConsecutiveRounds?: number;
}

/** Kiểm chứng schemastery cho {@link Config} — một trường tuỳ chọn, đúng như bản gốc (mặc định 3). */
export const Config: z<Config> = z.object({
  blockedAfterConsecutiveRounds: z.number().step(1).min(1).default(3),
}) as unknown as z<Config>;

/** Năm hành động hợp lệ của `update_goal` — nguyên văn thứ tự của bản gốc. */
const UPDATE_ACTIONS = ["edit", "pause", "resume", "complete", "blocked"] as const;

/** Mô tả model thấy của `create_goal` (nguyên văn). */
const CREATE_DESCRIPTION =
  "Create a persisted goal that keeps this session working across automatic continuation rounds. Use it when the direct human request is a long-running objective, even if the user did not say \"goal\"; not for single-turn work.";

/** Mô tả model thấy của `get_goal` (nguyên văn). */
const GET_DESCRIPTION =
  "Read the current session goal, including the id and revision that update_goal requires.";

/**
 * Schema đầu ra canonical dùng chung cho cả ba tool — nguyên văn của bản gốc:
 * một trong hai nhánh `{ goal: null }` hoặc `{ goal, activation }`.
 */
const GOAL_VALUE_SCHEMA = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      properties: {
        goal: {
          type: "null",
          required: true,
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        goal: {
          type: "object",
          additionalProperties: false,
          required: true,
          properties: {
            id: {
              type: "string",
              required: true,
            },
            revision: {
              type: "integer",
              required: true,
            },
            objective: {
              type: "string",
              required: true,
            },
            phase: {
              type: "string",
              required: true,
              enum: ["active", "paused", "blocked", "complete"],
            },
            roundsStarted: {
              type: "integer",
              required: true,
            },
            maxGoalRounds: {
              type: "integer",
              required: true,
            },
            blockedReason: {
              type: "object",
              additionalProperties: false,
              properties: {
                code: {
                  type: "string",
                  required: true,
                },
                message: {
                  type: "string",
                  required: true,
                },
              },
            },
          },
        },
        activation: {
          type: "string",
          required: true,
          enum: ["armed", "disarmed"],
        },
      },
    },
  ],
} as const satisfies ValueSchemaSpec;

/** Giá trị model thấy của một goal — suy ra từ schema ở trên, dùng cho cả ba tool. */
type GoalToolValue =
  | {
      goal: null;
    }
  | {
      goal: {
        id: string;
        revision: number;
        objective: string;
        phase: GoalView["phase"];
        roundsStarted: number;
        maxGoalRounds: number;
        blockedReason?: {
          code: string;
          message: string;
        };
      };
      activation: GoalView["activation"];
    };

/**
 * Dựng hướng dẫn chính sách kèm ngưỡng blocked do triển khai chọn.
 * Nhận: blockedAfter — số vòng goal liên tiếp tối thiểu trước khi được báo blocked.
 * Trả: văn bản mục system prompt `tool:goal` (nguyên văn của bản gốc, chỉ thay ngưỡng).
 */
function guidance(blockedAfter: number): string {
  return (
    "create_goal may infer goal intent from a direct human request in any language. After session resume or fork, an active goal is disarmed: when a human asks to continue or resume in any wording or language, use update_goal action resume to rearm it. Mark complete only when the objective is actually achieved. Mark blocked only after the same blocking condition persists for at least " +
    blockedAfter +
    " consecutive goal rounds, and report that concrete condition in blocked_reason; difficulty, uncertainty, or useful remaining work is not blocked."
  );
}

/**
 * Kiểm cấu hình ngay cả khi apply được gọi trực tiếp ngoài đường chuẩn hoá của Loader.
 * Nhận: config — cấu hình row (có thể thiếu trường).
 * Trả: cấu hình đã chốt (mặc định 3).
 * Ném: TypeError khi ngưỡng không phải số nguyên an toàn dương.
 */
function resolveConfig(config: Config): { blockedAfterConsecutiveRounds: number } {
  const blockedAfter = config.blockedAfterConsecutiveRounds ?? 3;
  if (!Number.isSafeInteger(blockedAfter) || blockedAfter < 1) {
    throw new TypeError("blockedAfterConsecutiveRounds must be a positive safe integer");
  }
  return { blockedAfterConsecutiveRounds: blockedAfter };
}

/**
 * Cho biết văn bản tuỳ chọn có ý nghĩa hay chỉ là vật độn rỗng của schema nghiêm.
 * Nhận: value — giá trị cần kiểm (có thể vắng).
 * Trả: true khi có mặt và khác chuỗi rỗng.
 */
function hasText(value: string | undefined): boolean {
  return value !== undefined && value !== "";
}

/**
 * Cho biết trần vòng tuỳ chọn có ý nghĩa hay chỉ là số 0 độn của schema nghiêm.
 * Nhận: value — giá trị cần kiểm (có thể vắng).
 * Trả: true khi có mặt và khác 0.
 */
function hasRoundCap(value: number | undefined): boolean {
  return value !== undefined && value !== 0;
}

/**
 * Dựng ref so-sánh-và-ghi từ tham số model.
 * Nhận: goalId — id do model khai; revision — revision model khai.
 * Trả: GoalRef đã đóng dấu id.
 * Ném: HarnessError `GOAL_TOOL_INVALID_UPDATE` khi id rỗng/có khoảng trắng đầu cuối hoặc revision không dương.
 */
function goalRef(goalId: string, revision: number): GoalRef {
  if (goalId.length === 0 || goalId !== goalId.trim() || !Number.isSafeInteger(revision) || revision < 1) {
    throw new HarnessError(
      "goal_id must be non-empty and revision must be a positive safe integer",
      "GOAL_TOOL_INVALID_UPDATE",
    );
  }
  return {
    id: GoalId(goalId),
    revision,
  };
}

/**
 * Dựng kết quả model gọn, ổn định; activation chỉ là quan sát, không phải trạng thái replay.
 * Nhận: goal — goal hiện tại của agent, hoặc undefined khi chưa có.
 * Trả: `{ goal: null }` khi chưa có, ngược lại goal đã lọc + activation.
 */
function goalValue(goal: GoalView | undefined): GoalToolValue {
  if (goal === undefined) return { goal: null };
  return {
    goal: {
      id: goal.id,
      revision: goal.revision,
      objective: goal.objective,
      phase: goal.phase,
      roundsStarted: goal.roundsStarted,
      maxGoalRounds: goal.maxGoalRounds,
      ...(goal.blockedReason === undefined
        ? {}
        : {
            blockedReason: {
              code: goal.blockedReason.code,
              message: goal.blockedReason.message,
            },
          }),
    },
    activation: goal.activation,
  };
}

/** Khai báo đầu ra canonical dùng lại cho cả ba điều khiển goal. */
const GOAL_OUTPUT: {
  schema: typeof GOAL_VALUE_SCHEMA;
  render: (args: unknown, value: GoalToolValue) => ContentBlock[];
} = {
  schema: GOAL_VALUE_SCHEMA,
  render: (_args, value) => [
    {
      type: "text",
      text: JSON.stringify(value),
    },
  ],
};

/**
 * Dựng cách trình bày chờ chung, chỉ dựa vào tham số, dùng cho cả ba tool goal.
 * Nhận: title — nhãn hiển thị; kind — nhóm biểu tượng; rawInput — đầu vào đáng chú ý (tuỳ chọn).
 * Trả: card generic của ToolCallView (bỏ rawInput khi vắng).
 */
function present(title: string, kind: ToolCallKind, rawInput?: unknown): ToolCallView {
  return {
    card: "generic",
    title,
    kind,
    ...(rawInput === undefined ? {} : { rawInput }),
  };
}

/**
 * Đăng ký ba tool goal hình dạng Codex và mục chính sách dùng chung của chúng.
 * Nhận: ctx — context có sổ tool + system prompt + sổ agent + miền goal + projection;
 *       config — chính sách goal (ngưỡng blocked).
 * Trả: không; đăng ký mục prompt `tool:goal` và ba tool vào sổ.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config);
  ctx.systemPrompt.section({
    name: "tool:goal",
    order: ctx.systemPrompt.getSectionOrder("TOOL_GOAL"),
    text: guidance(resolved.blockedAfterConsecutiveRounds),
  });
  toolsOf(ctx).register(
    defineTool({
      name: "get_goal",
      description: GET_DESCRIPTION,
      parameters: {},
      output: GOAL_OUTPUT,
      execute(_args, exec) {
        const execution = goalToolExecution(ctx, exec);
        return Promise.resolve(goalValue(goalsOf(ctx).get(asGoalAgent(execution.agent))));
      },
      presentCall: () => present("Read current goal", "read"),
    }),
  );
  toolsOf(ctx).register(
    defineTool({
      name: "create_goal",
      description: CREATE_DESCRIPTION,
      parameters: {
        objective: {
          type: "string",
          required: true,
          description: "The concrete completion objective inferred from the direct human request.",
        },
        max_goal_rounds: {
          type: "number",
          description: "Optional positive safe-integer limit on automatic continuation rounds.",
        },
      },
      output: GOAL_OUTPUT,
      execute(args, exec) {
        const execution = goalToolExecution(ctx, exec);
        requireDirectHuman(ctx, execution);
        const goal = goalsOf(ctx).create(asGoalAgent(execution.agent), {
          objective: args.objective,
          ...(args.max_goal_rounds === void 0 ? {} : { maxGoalRounds: args.max_goal_rounds }),
        });
        return Promise.resolve(goalValue(goal));
      },
      presentCall: (args) => present("Create goal", "other", args.objective),
    }),
  );
  toolsOf(ctx).register(
    defineTool({
      name: "update_goal",
      description: "Update the current goal.",
      parameters: {
        goal_id: {
          type: "string",
          required: true,
          description: "Exact id returned by get_goal.",
        },
        revision: {
          type: "number",
          required: true,
          description: "Exact positive revision returned by get_goal.",
        },
        action: {
          type: "string",
          required: true,
          enum: UPDATE_ACTIONS,
          description:
            "edit, pause, and resume require a direct top-level human request. complete and blocked are also allowed during an automatic continuation of this goal; blocked is rejected before the configured minimum round count.",
        },
        objective: {
          type: "string",
          description: "Replacement objective; valid only with action edit.",
        },
        max_goal_rounds: {
          type: "number",
          description: "Replacement cap; valid only with action edit.",
        },
        blocked_reason: {
          type: "string",
          description:
            "Required only with action blocked: the concrete condition that persisted across rounds and blocks progress.",
        },
      },
      output: GOAL_OUTPUT,
      execute(args, exec) {
        const execution = goalToolExecution(ctx, exec);
        const ref = goalRef(args.goal_id, args.revision);
        const replacements = {
          ...(hasText(args.objective) ? { objective: args.objective } : {}),
          ...(hasRoundCap(args.max_goal_rounds) ? { maxGoalRounds: args.max_goal_rounds } : {}),
        };
        if (args.action === "edit") {
          requireDirectHuman(ctx, execution);
          if (hasText(args.blocked_reason)) {
            throw new HarnessError("blocked_reason is valid only with action blocked", "GOAL_TOOL_INVALID_UPDATE");
          }
          const goal = goalsOf(ctx).edit(asGoalAgent(execution.agent), ref, replacements);
          return Promise.resolve(goalValue(goal));
        }
        if (args.action === "pause" || args.action === "resume") {
          requireDirectHuman(ctx, execution);
          if (hasText(args.objective) || hasRoundCap(args.max_goal_rounds) || hasText(args.blocked_reason)) {
            throw new HarnessError(
              "objective and max_goal_rounds are valid only with action edit; blocked_reason is valid only with action blocked",
              "GOAL_TOOL_INVALID_UPDATE",
            );
          }
          const current = goalsOf(ctx).get(asGoalAgent(execution.agent));
          if (
            args.action === "resume" &&
            current?.id === ref.id &&
            current.revision === ref.revision &&
            current.phase === "paused"
          ) {
            throw new HarnessError(
              "the model cannot resume a paused goal; the user must resume it",
              "GOAL_TOOL_RESUME_PAUSED",
            );
          }
          const goal = args.action === "pause" ? goalsOf(ctx).pause(asGoalAgent(execution.agent), ref) : goalsOf(ctx).resume(asGoalAgent(execution.agent), ref);
          return Promise.resolve(goalValue(goal));
        }
        const authority = completionAuthority(ctx, execution);
        if (hasText(args.objective) || hasRoundCap(args.max_goal_rounds)) {
          throw new HarnessError("objective and max_goal_rounds are valid only with action edit", "GOAL_TOOL_INVALID_UPDATE");
        }
        if (args.action === "complete" && hasText(args.blocked_reason)) {
          throw new HarnessError("blocked_reason is valid only with action blocked", "GOAL_TOOL_INVALID_UPDATE");
        }
        if (args.action === "blocked" && (args.blocked_reason === void 0 || args.blocked_reason.trim().length === 0)) {
          throw new HarnessError("blocked_reason is required with action blocked", "GOAL_TOOL_INVALID_UPDATE");
        }
        if (
          args.action === "blocked" &&
          authority.kind === "goal-round" &&
          authority.goal.roundsStarted < resolved.blockedAfterConsecutiveRounds
        ) {
          throw new HarnessError(
            "blocked requires at least " +
              resolved.blockedAfterConsecutiveRounds +
              " consecutive goal rounds; current round is " +
              authority.goal.roundsStarted,
            "GOAL_TOOL_BLOCK_THRESHOLD",
          );
        }
        const goal =
          args.action === "complete"
            ? goalsOf(ctx).complete(asGoalAgent(execution.agent), ref)
            : goalsOf(ctx).block(asGoalAgent(execution.agent), ref, {
                code: "model-reported",
                message: args.blocked_reason as string,
              });
        if (authority.kind === "goal-round") {
          exec.deferContext(
            createUserMessage({
              content:
                args.action === "complete"
                  ? renderWrapupContext(goal.objective)
                  : renderWrapupContext(goal.objective, args.blocked_reason),
              source: {
                kind: "tool-goal",
                form: "notice",
                summary: boundContextSummary(args.action + ": " + goal.objective),
              },
            }),
          );
        }
        return Promise.resolve(goalValue(goal));
      },
      presentCall: (args) =>
        present(
          (args.action === "blocked" ? "Mark" : args.action.charAt(0).toUpperCase() + args.action.slice(1)) + " goal",
          "other",
          hasText(args.blocked_reason)
            ? args.blocked_reason
            : hasText(args.objective)
              ? args.objective
              : hasRoundCap(args.max_goal_rounds)
                ? args.max_goal_rounds
                : args.goal_id,
        ),
    }),
  );
}
