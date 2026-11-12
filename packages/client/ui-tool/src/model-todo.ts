/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chi muc lich su todo_write · mo hinh so sanh khac biet · tom tat ke hoach cua hang todo
 */

import { todosDetail } from "./model-details2.ts";
import { parsedToolCall } from "./model-tool-call.ts";
import type { ToolviewScope } from "./types.ts";

/** Du lieu tho doc tu day (khoi goi tool · ban ghi lich su) — giu 'any' cho gon nhu ban goc khong dat kieu. */
type Wire = any;

/** Ham dich cua namespace hoi thoai (ban goc lay tu slot) — giu 'any' cho gon. */
type TranslateFn = any;

/** Mot dong todo nhu ban goc ghi lai: noi dung + trang thai do tool tu kiem. */
interface TodoItem {
  /** Noi dung dong todo, nguyen van tu tham so lan goi. */
  content: string;
  /** Trang thai tool tu khai: completed · in_progress · pending. */
  status: string;
}

/** Danh sach truoc mot lan goi Tool; thieu truoc lan ghi dau tien duoc nap. */
interface TodoBaseline {
  /** Cac dong ghi truoc do, hoac undefined khi moc bat dau chua duoc nap. */
  readonly todos: readonly TodoItem[] | undefined;
}

/** Mot dong cua bang khac biet: tieu de + trang thai da dia phuong hoa. */
interface TodoDiffRow {
  /** Tieu de dong (noi dung todo da cat khoang trang). */
  title: string;
  /** Trang thai da gan nhan; co the thieu o du lieu cu. */
  status?: {
    /** Ma trang thai nguyen van. */
    value: string;
    /** Nhan trang thai da dich. */
    label: string;
  };
  /** Truong phu cua ban goc; todosDetail de trong. */
  fields: unknown[];
  /** Nhan thay doi cua dong nay khi co so sanh. */
  change?: {
    /** added · updated · moved · removed. */
    value: string;
    /** Nhan thay doi da dich. */
    label: string;
  };
  /** Trang thai truoc do, chi dat khi trang thai doi. */
  previousStatus?: string;
}

/** Chi tiet danh sach todo do `todosDetail` dung — du lieu qua day nen giu long. */
type TodoDetails = Record<string, any>;

/** Ket qua so sanh: bang khac biet de hien thi kem mot dong tom tat. */
interface TodoDiffModel {
  /** Chi tiet danh sach khoa `items`/empty/unchanged cho ToolDetails. */
  details: TodoDetails;
  /** Mot dong tom tat thay doi; null khi khong co moc so sanh de noi. */
  summary: string | null;
}

/** Durable writes are indexed independently of Tool success receipts. */
export const todoWriteDefinition = {
  kind: "tool-todo-write",
  match: (event: Wire) => event.type === "todo/write" ? {
    id: String(event.seq),
    role: "start"
  } : null,
  start: (_context: Wire, match: Wire) => {
    if (match.event.type !== "todo/write") throw new Error("tool-todo-write requires todo/write");
    return match.event.data.todos;
  },
  update: (context: Wire) => context.state,
  publication: () => "none"
};

/** Invocation predecessors are repaired by the assembler when older history arrives. */
export const todoCallDefinition = {
  kind: "tool-todo-call",
  target: "tool-todo-history",
  match: (event: Wire) => {
    if (event.type === "tool/call" && event.data.name === "todo_write") return {
      id: String(event.data.callId),
      role: "start"
    };
    if (event.type === "tool/ptc-dispatch-start" && event.data.name === "todo_write") return {
      id: String(event.data.subCallId),
      role: "start"
    };
    return null;
  },
  start: (_context: Wire, _match: Wire, reader: Wire) => ({ todos: reader.previous("tool-todo-write")?.state }),
  update: (context: Wire) => context.state,
  buildViewNode: (context: Wire) => context.state === void 0 ? null : {
    key: context.key,
    kind: context.kind,
    id: context.id,
    target: "tool-todo-history",
    data: context.state
  }
};

/** Incremental lookup snapshots preserve earlier call baselines across later writes. */
export const todoHistoryView = {
  target: "tool-todo-history",
  create: () => {
    let calls = /* @__PURE__ */ new Map();
    return {
      empty: calls,
      replace: ({ nodes }: Wire) => calls = new Map(nodes.map((node: Wire) => [node.id, node.data])),
      apply: ({ upserts }: Wire) => {
        if (upserts.length > 0) {
          calls = new Map(calls);
          for (const node of upserts) calls.set(node.id, node.data);
        }
        return calls;
      }
    };
  }
};

/**
 * Install the recorded-write index and call predecessor target.
 * @param ctx - Tool presentation plugin context.
 * Thieu uiConversation (profile khong bat row hoi thoai) thi bo qua, khong nem.
 */
export function registerTodoHistory(ctx: ToolviewScope): void {
  const uiConversation = ctx.uiConversation;
  if (uiConversation === undefined) return;
  uiConversation.events.register(todoWriteDefinition);
  uiConversation.events.register(todoCallDefinition);
  uiConversation.views.register(todoHistoryView);
}

/**
 * Compare this write with its predecessor in the loaded call history.
 * @param block - The write being displayed.
 * @param baseline - List recorded before this call, or undefined when its start is unavailable.
 * @param hasMore - Whether older unloaded history may contain a preceding list.
 * @param t - Conversation dictionary translator.
 * @returns Details and a change summary, or null for generic Tool output.
 */
export function todoDiffModel(block: Wire, baseline: TodoBaseline | undefined, hasMore: boolean, t: TranslateFn): TodoDiffModel | null {
  if (!("kind" in block) || block.isError) return null;
  const call = parsedToolCall(block);
  const current = (call?.name === "todo_write" ? todosDetail(call.args, t) : null) as TodoDetails | null;
  if (current === null) return null;
  const previous: { items: TodoDiffRow[] } | null = baseline?.todos === void 0 ? null : { items: baseline.todos.map((todo) => ({
    title: todo.content,
    status: {
      value: todo.status,
      label: t(`detail.todo.${todo.status}`)
    },
    fields: []
  })) };
  if (baseline === void 0 || previous === null && hasMore) return {
    details: {
      ...current,
      caption: t("todo.diff.unavailable")
    },
    summary: null
  };
  const previousByTitle = new Map<string, TodoDiffRow>(previous?.items.map((item) => [item.title, item]));
  const currentTitles = new Set(current.items.map((item: Wire) => item.title));
  const retainedPositions = new Map<string, number>(previous?.items.filter((item) => currentTitles.has(item.title)).map((item, index) => [item.title, index]));
  let retainedIndex = 0;
  const items: TodoDiffRow[] = [];
  const unchanged: TodoDiffRow[] = [];
  let added = 0;
  let updated = 0;
  for (const item of current.items) {
    const before = previousByTitle.get(item.title);
    previousByTitle.delete(item.title);
    if (before === void 0) {
      added++;
      items.push({
        ...item,
        change: {
          value: "added",
          label: t("todo.diff.addedItem")
        }
      });
    } else {
      const moved = retainedPositions.get(item.title) !== retainedIndex++;
      const statusChanged = before.status?.value !== item.status?.value;
      if (statusChanged || moved) {
        updated++;
        items.push({
          ...item,
          ...statusChanged && before.status !== void 0 ? { previousStatus: before.status.label } : {},
          change: {
            value: "updated",
            label: t(statusChanged ? "todo.diff.updatedItem" : "todo.diff.movedItem")
          }
        });
      } else unchanged.push(item);
    }
  }
  for (const item of previousByTitle.values()) items.push({
    ...item,
    change: {
      value: "removed",
      label: t("todo.diff.removedItem")
    }
  });
  return {
    summary: [
      added > 0 ? t("todo.diff.added", { count: added }) : null,
      updated > 0 ? t("todo.diff.updated", { count: updated }) : null,
      previousByTitle.size > 0 ? t("todo.diff.removed", { count: previousByTitle.size }) : null
    ].filter((part) => part !== null).join(" · ") || t("todo.diff.noChanges"),
    details: {
      items,
      caption: t(previous === null ? "todo.diff.initial" : "todo.diff.compare"),
      empty: current.items.length === 0 && previous === null ? t("detail.todo.empty") : t("todo.diff.noChanges"),
      ...unchanged.length === 0 ? {} : { unchanged: {
        label: t("todo.diff.unchanged", { count: unchanged.length }),
        items: unchanged
      } }
    }
  };
}

/**
 * Pure plan derivation for the todo_write row's one-line summary. Several items
 * may be `in_progress` at once — parallel work runs concurrent tasks, so a
 * summary built from one active item would silently drop the rest. The plan
 * strip header derives its own counts inline and shares nothing with this, so
 * this stays inside the toolviews domain rather than in `contract/` (the
 * inter-domain face).
 * @module
 */

/**
 * One list item as the row sees it: unvalidated model JSON parsed from a call's
 * args, so any field may be missing or mistyped.
 */
interface PlanItemLike {
  /** Noi dung dong, co the thieu hoac sai kieu. */
  content?: unknown;
  /** Trang thai dong, co the thieu hoac sai kieu. */
  status?: unknown;
}

/**
 * Counts plus the two halves of the summary, deliberately NOT pre-joined: the
 * row ellipsizes its summary text, and a count concatenated onto the end of the
 * task name is the first thing a narrow row clips — exactly when it carries
 * information. The row renders `activeExtra` in its own non-shrinking span
 * beside the truncatable text.
 */
interface PlanSummary {
  /** So dong da completed. */
  done: number;
  /** Tong so dong. */
  total: number;
  /** Noi dung cua dong in_progress dau tien, hoac null khi dong do khong dung duoc. */
  activeContent: string | null;
  /** So dong dang chay sau dong dau tien; 0 khi khong co activeContent. */
  activeExtra: number;
}

/**
 * Derive the counts and the active summary from a whole-list snapshot. It names
 * the first `in_progress` item and counts the remaining active ones, so a
 * parallel plan reports how many tasks are running rather than naming one and
 * hiding the others. `activeContent` is null when nothing is in progress, or
 * when the first active item's content is missing, mistyped, or blank once
 * trimmed — the tool's own rule for usable content, applied here because a
 * rejected call keeps its args verbatim. The row then renders the counts alone
 * rather than falling back to the generic tool summary: the counts are already
 * known to be good, and the active-item clause is the only part an unusable
 * name costs.
 * @param todos - the whole list, in model order.
 * @returns the done/total counts and the two summary halves.
 */
export function planSummary(todos: readonly PlanItemLike[]): PlanSummary {
  const active = todos.filter((t) => t.status === "in_progress");
  const first = active[0]?.content;
  const named = typeof first === "string" && first.trim() !== "";
  return {
    done: todos.filter((t) => t.status === "completed").length,
    total: todos.length,
    activeContent: named ? first as string : null,
    activeExtra: named ? active.length - 1 : 0
  };
}
