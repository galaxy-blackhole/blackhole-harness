/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hàng toolview details của row ui-tool: 37 key ghi nhận kết quả (goal · schedule · cordis · workflow · session · subagent · teammate · job · terminal · lsp) dùng chung DetailsRow
 */

import { CONVERSATION_NS } from "./ids.ts";
import { jsxRuntime, primitives, react } from "./runtime.ts";
import { ToolRow } from "./component-tool-row.ts";
import { parsedToolCall, toolRowModel } from "./model-tool-call.ts";
import { detailsCardModel } from "./model-details2.ts";
import type { ToolviewScope } from "./types.ts";

/** Dữ liệu thô đọc từ dây (khối gọi tool · kết quả · hàm dịch của slot) — giữ 'any' cho gọn như bản gốc không đặt kiểu. */
type Wire = any;

/** Keyed recorded-result rows sharing the compact detail body. */
export const LSP_TITLE_KEYS: Record<string, string> = {
  goToDefinition: "tool.title.findDefinition",
  findReferences: "tool.title.findReferences",
  goToImplementation: "tool.title.findImplementation",
  hover: "tool.title.hoverSymbol"
};

/** Teammate-coordination tools presented with the two-person team icon. */
export const TEAMMATE_TOOLS = new Set([
  "spawn_teammate",
  "list_agents",
  "send_message",
  "interrupt_agent",
  "wait_agent"
]);

/**
 * Chọn biểu tượng cho hàng ghi nhận kết quả theo tiền tố/hậu tố của tên tool.
 * Nhận: toolName — tên tool của hàng.
 * Trả: phần tử icon của primitive (14px) ứng với nhóm tool, mặc định là icon agent preset.
 */
export function detailIcon(toolName: string): Wire {
  if (TEAMMATE_TOOLS.has(toolName)) return jsxRuntime.jsx(primitives.IconUsersOutlineRegular, { size: 14 });
  if (toolName.startsWith("schedule_")) return jsxRuntime.jsx(primitives.IconClockOutlineRegular, { size: 14 });
  if (toolName.endsWith("_goal")) return jsxRuntime.jsx(primitives.IconGoalOutlineRegular, { size: 14 });
  if (toolName.startsWith("cordis_")) return jsxRuntime.jsx(primitives.IconCordisPluginOutlineRegular, {});
  if (toolName.startsWith("terminal_")) return jsxRuntime.jsx(primitives.IconCodeOutlineRegular, { size: 14 });
  if (toolName.startsWith("session_") || toolName === "lsp") return jsxRuntime.jsx(primitives.IconSearchOutlineRegular, { size: 14 });
  if (toolName.startsWith("job_") || toolName.startsWith("team_task_")) return jsxRuntime.jsx(primitives.IconChecklistOutlineRegular, {});
  if (toolName === "workflow" || toolName === "ralph") return jsxRuntime.jsx(primitives.IconBranchOutlineRegular, { size: 14 });
  return jsxRuntime.jsx(primitives.IconAgentPresetOutlineRegular, { size: 14 });
}

/**
 * Present recorded entities, receipts, and report fields in the existing expandable row.
 * @param props - Tool call, row actions, and locale supplied by the keyed slot.
 * @returns A Tool row with structured details or generic input/output.
 */
export function DetailsRow({ toolName, block, cwd, home, openFile, inspect, useDisclosure, t }: Wire): Wire {
  const model = toolRowModel(toolName, block, cwd, home);
  const locale = document.documentElement.lang;
  const details: Wire = react.useMemo(() => detailsCardModel(block, t, locale), [
    block,
    t,
    locale
  ]);
  const operation = toolName === "lsp" ? parsedToolCall(block)?.args.operation : void 0;
  const titleKey = typeof operation === "string" && Object.hasOwn(LSP_TITLE_KEYS, operation) ? LSP_TITLE_KEYS[operation] : model.titleKey;
  return jsxRuntime.jsx(ToolRow, {
    useDisclosure,
    t,
    variant: model.variant,
    toolName,
    icon: detailIcon(toolName),
    title: t(titleKey),
    summary: details?.summary ?? details?.items[0]?.title ?? details?.empty ?? model.summary,
    details,
    bodyRaw: model.bodyRaw,
    output: model.output,
    errorSummary: model.errorSummary,
    state: model.state,
    inspect,
    onOpenFile: openFile
  });
}

/**
 * Đăng ký 37 key ghi nhận kết quả vào slot KEYED "tool.call.toolview" — bản gốc là plugin details-toolview.
 * Nhận: ctx — phạm vi toolview (sổ slot của context).
 * Trả: không có.
 */
export function registerDetailsToolview(ctx: ToolviewScope): void {
  ctx.slots.inject("tool.call.toolview", function* () {
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "create_goal",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "get_goal",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "update_goal",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "schedule_create",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "schedule_list",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "schedule_delete",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "schedule_update",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "cordis_inspect_list",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "cordis_inspect_query",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "cordis_inspect_self",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "workflow",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "ralph",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "session_event_read",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "session_event_search",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "session_event_trace",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "session_search",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "session_trace",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "list_subagent_models",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "subagent",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "list_agents",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "send_message",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "interrupt_agent",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "job_list",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "job_output",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "job_kill",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "terminal_open",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "terminal_read",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "terminal_list",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "terminal_signal",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "terminal_close",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "lsp",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "spawn_teammate",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "team_task_create",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "team_task_get",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "team_task_update",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "team_task_list",
      locale: CONVERSATION_NS
    }, DetailsRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "wait_agent",
      locale: CONVERSATION_NS
    }, DetailsRow);
  });
}
