/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hàng toolview todo của row ui-tool: tóm tắt kế hoạch, hàng TodoRow và hàm đăng ký key todo_write
 */

import { CONVERSATION_NS } from "./ids.ts";
import { jsxRuntime, primitives, react } from "./runtime.ts";
import { ToolRow } from "./component-tool-row.ts";
import { toolRowModel } from "./model-tool-call.ts";
import { planSummary, registerTodoHistory, todoDiffModel } from "./model-todo.ts";
import type { ToolviewScope, UiConversationService } from "./types.ts";

/** Dữ liệu thô đọc từ dây (khối gọi tool · kết quả · hàm dịch của slot) — giữ 'any' cho gọn như bản gốc không đặt kiểu. */
type Wire = any;

/** Ghế dịch của hội thoại: nhận khoá và tham số nội suy, trả chuỗi đã bản địa hoá. */
type TranslateSeat = (key: string, params?: Record<string, unknown>) => string;

/**
 * Kiểm một phần tử trong mảng todos có phải đối tượng không (bản gốc dùng làm vị từ cho Array.every).
 * Nhận: value — phần tử bất kỳ đọc từ dây.
 * Trả: true khi value là đối tượng khác null.
 */
export function isItem(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

/**
 * Tóm tắt một lần cập nhật kế hoạch từ chuỗi tham số thô.
 * Nhận: argsRaw — chuỗi JSON tham số của lời gọi; t — ghế dịch của hội thoại.
 * Trả: { text, extra } đã bản địa hoá, hoặc null khi tham số không phải JSON kế hoạch hợp lệ.
 */
export function summarize(argsRaw: Wire, t: TranslateSeat): Wire {
  if (argsRaw === null) return null;
  let parsed: Wire;
  try {
    parsed = JSON.parse(argsRaw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const todos = parsed.todos;
  if (!Array.isArray(todos) || !todos.every(isItem)) return null;
  const { done, total, activeContent, activeExtra } = planSummary(todos);
  const head = t("todo.completed", {
    done,
    total
  });
  return {
    text: activeContent === null ? head : `${head} · ${activeContent}`,
    extra: activeExtra
  };
}

/** Summarizes a plan update without presenting a cancelled call as completed. */
export function TodoRow({ toolName, block, inspect, useDisclosure, useTodoHistory, useSession, t }: Wire): Wire {
  const baseline = useTodoHistory((snapshot: Wire) => snapshot?.get(block.callId));
  const hasMore = useSession((snapshot: Wire) => snapshot.hasMore);
  const diff = react.useMemo(() => todoDiffModel(block, baseline, hasMore, t), [
    block,
    baseline,
    hasMore,
    t
  ]);
  const model = toolRowModel(toolName, block);
  const summary = summarize(model.bodyRaw, t) ?? {
    text: model.summary,
    extra: 0
  };
  return jsxRuntime.jsx(ToolRow, {
    useDisclosure,
    t,
    variant: model.variant,
    toolName,
    icon: jsxRuntime.jsx(primitives.IconChecklistOutlineRegular, {}),
    title: t(model.titleKey),
    summary: summary.text,
    summarySuffix: [diff?.summary, summary.extra > 0 ? `+${summary.extra}` : null].filter((part: Wire) => part !== null && part !== void 0).join(" · ") || null,
    bodyRaw: model.bodyRaw,
    output: model.output,
    details: diff?.details,
    errorSummary: model.errorSummary,
    state: model.state,
    inspect
  });
}

/**
 * Dang ky dong todo_write cua slot tool.call.toolview (kem lich su ghi khi co mat dich vu hoi thoai).
 * Nhan: ctx — pham vi slot (co the thieu uiConversation o profile khong bat row hoi thoai).
 * Tra: khong co.
 */
export function registerTodoToolview(ctx: ToolviewScope): void {
  const uiConversation: UiConversationService | undefined = ctx.uiConversation;
  if (uiConversation !== undefined) registerTodoHistory({ slots: ctx.slots, uiConversation });
  ctx.slots.inject("tool.call.toolview", () =>
    ctx.slots.register({
      name: "tool.call.toolview",
      key: "todo_write",
      locale: CONVERSATION_NS,
      inject: (sessionId: string) => ({ hooks: { todoHistory: uiConversation?.binding(sessionId).target("tool-todo-history") } })
    }, TodoRow));
}
