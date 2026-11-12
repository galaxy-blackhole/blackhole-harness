/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mo hinh chi tiet mo rong cua row ui-tool: ket qua inspect cordis, workflow, truy van phien, todo, goal va lich chay
 */

import { controlDetails, detailJson, detailList, detailRecord, inspectionItems, nonempty } from "./model-details.ts";
import { parsedToolCall, singleResultText } from "./model-tool-call.ts";
import { hasSpillNotice } from "./model-spill.ts";

/** Du lieu tho doc tu day (khoi goi tool · ket qua da luu · tham so) — giu 'any' cho gon nhu ban goc khong dat kieu. */
type Wire = any;

/** Ghe dich cua hoi thoai: tra chuoi da ban dia hoa theo khoa. */
type TranslateSeat = (key: string, params?: Record<string, unknown>) => string;

/** Sac thai tinh cua the trang thai. */
type BadgeTone = "neutral" | "info" | "success" | "warning" | "error";

/** The trang thai da ban dia hoa, khong ham y mot dang ky truc tiep. */
interface DetailBadge {
  /** Chu tren the. */
  label: string;
  /** Sac thai tinh. */
  tone: BadgeTone;
}

/** Mot cap nhan/gia tri cua mot muc chi tiet. */
interface DetailField {
  /** Nhan truong. */
  label: string;
  /** Gia tri truong. */
  value: string;
}

/** Mot muc cua khoi chi tiet (ban goc la ToolDetailItem cua the ToolDetails). */
interface DetailItem {
  /** Tieu de muc. */
  title?: string;
  /** Dong phu duoi tieu de. */
  subtitle?: string;
  /** Mo ta day du. */
  description?: string;
  /** The trang thai nho. */
  badge?: DetailBadge;
  /** Trang thai cua muc. */
  status?: {
    /** Ma trang thai. */
    value: "completed" | "in_progress" | "pending";
    /** Nhan trang thai da ban dia hoa. */
    label: string;
  };
  /** Cac cap nhan/gia tri cua muc. */
  fields: DetailField[];
  /** Cac dong van ban tho. */
  lines?: readonly string[];
  /** Khoi ma nguon. */
  code?: {
    /** Than ma. */
    text: string;
    /** Ngon ngu cua khoi ma. */
    language?: string;
  };
  /** Cac nhom muc con gap lai duoc. */
  groups?: {
    /** Nhan nhom. */
    label: string;
    /** Cac muc con. */
    items: DetailItem[];
  }[];
}

/** Du lieu hien thi da ban dia hoa ma cac the chi tiet dung chung (ban goc la ToolDetailsModel). */
interface DetailsModel {
  /** Cac muc chi tiet. */
  items: readonly DetailItem[];
  /** Dong tom tat. */
  summary?: string;
  /** Dong tom tat khi mo rong. */
  expandedSummary?: string;
  /** Nhan hien khi khong co muc nao. */
  empty?: string;
  /** Dong chu thich dau khoi. */
  caption?: string;
}

/**
 * Format a recorded timestamp for display, keeping the raw text when it is not a date.
 * @param value - Recorded date value.
 * @param locale - Date display locale.
 * @returns The localized medium date and short time, or the raw text.
 */
export function dateText(value: Wire, locale: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  } catch {
    return String(value);
  }
}

/**
 * Derive the provider, query, and self-inspection records of the Cordis tools.
 * @param name - Wire tool name of one of the three cordis_inspect variants.
 * @param args - Recorded argument object.
 * @param value - Parsed whole-result JSON.
 * @param t - Conversation translator.
 * @returns Named records, or null when the result does not match the tool.
 */
export function cordisDetails(name: string, args: Wire, value: Wire, t: TranslateSeat): DetailsModel | null {
  if (!detailRecord(value)) return null;
  if (name === "cordis_inspect_list") {
    if (!Array.isArray(value.providers)) return null;
    return detailList(inspectionItems(value.providers, t), t("detail.providers.count", { count: value.providers.length }), t);
  }
  if (name === "cordis_inspect_query") {
    if (!("data" in value) || typeof value.provider !== "string" || typeof value.method !== "string") return null;
    return detailList(inspectionItems(value.data, t), `${value.provider}.${value.method}`, t);
  }
  if (name === "cordis_inspect_self") {
    if (Array.isArray(value.plugins)) return detailList(inspectionItems(value.plugins, t), t("detail.plugins.count", { count: value.plugins.length }), t);
    return detailList(inspectionItems(value, t), String(args.pluginId ?? args.packageId ?? value.mode), t);
  }
  return null;
}

/**
 * Derive the workflow and Ralph report records from their recorded result text.
 * @param name - Wire tool name: the workflow tool, or any other name for the Ralph report.
 * @param args - Recorded argument object.
 * @param text - Recorded result text.
 * @param t - Conversation translator.
 * @returns The reported record, or null when neither recorded format matches.
 */
export function workflowDetails(name: string, args: Wire, text: string, t: TranslateSeat): DetailsModel | null {
  if (name === "workflow") {
    const match = /^workflow "([\s\S]*?)" completed \((\d+) agents?\)\.\nReturn value:\n([\s\S]*)$/u.exec(text);
    if (match === null || match[1] === void 0 || match[2] === void 0 || match[3] === void 0) return null;
    const value = detailJson(match[3]);
    if (value === void 0) return null;
    return detailList([{
      title: match[1],
      badge: {
        label: t("detail.status.completed"),
        tone: "success"
      },
      fields: [{
        label: t("detail.field.agents"),
        value: match[2]
      }],
      ...typeof args.code === "string" ? { groups: [{
        label: t("detail.workflow.script"),
        items: [{
          fields: [],
          code: {
            text: args.code,
            language: "javascript"
          }
        }]
      }] } : {}
    }, ...inspectionItems(value, t)], match[1], t);
  }
  const split = text.indexOf("\nFinal report:\n");
  if (split < 0) return null;
  const header = text.slice(0, split);
  const rounds = /\b(\d+) rounds?\b/u.exec(header)?.[1];
  const report = detailJson(text.slice(split + 15));
  if (!detailRecord(report) || typeof report.summary !== "string" || !Array.isArray(report.evidence) || !report.evidence.every((value: Wire) => typeof value === "string") || !Array.isArray(report.nextSteps) || !report.nextSteps.every((value: Wire) => typeof value === "string") || typeof report.blocker !== "string") return null;
  const badge: DetailBadge | undefined = header.startsWith("Ralph worker reported completion ") ? {
    label: t("detail.ralph.reportedComplete"),
    tone: "success"
  } : header.startsWith("Ralph worker reported a blocker ") ? {
    label: t("detail.ralph.reportedBlocker"),
    tone: "warning"
  } : header.startsWith("Ralph reached its ") ? {
    label: t("detail.ralph.limit"),
    tone: "warning"
  } : void 0;
  if (badge === void 0) return null;
  const groups: { label: string; items: DetailItem[] }[] = [];
  if (report.nextSteps.length > 0) groups.push({
    label: t("detail.report.nextSteps"),
    items: [{
      fields: [],
      lines: report.nextSteps
    }]
  });
  if (typeof args.objective === "string") groups.push({
    label: t("detail.field.task"),
    items: [{
      fields: [],
      description: args.objective
    }]
  });
  const fields = rounds === void 0 ? [] : [{
    label: t("detail.goal.rounds"),
    value: rounds
  }];
  if (report.blocker !== "") fields.push({
    label: t("detail.goal.reason"),
    value: report.blocker
  });
  return detailList([{
    title: report.summary,
    badge,
    fields,
    ...report.evidence.length === 0 ? {} : { lines: report.evidence },
    groups
  }], report.summary, t);
}

/** Recorded trace field names mapped to their conversation dictionary keys. */
export const TRACE_FIELDS: Record<string, string> = {
  Created: "detail.field.time",
  Availability: "detail.field.availability",
  Parent: "detail.field.parent",
  "Best match": "detail.field.bestMatch",
  Target: "detail.field.target",
  "Replaced by": "detail.trace.replacedBy",
  "Replacement chain": "detail.trace.replacementChain",
  "Events replaced by target": "detail.trace.replaces",
  "Events cited directly as sources": "detail.trace.sources",
  "Direct derived events": "detail.trace.derived"
};

/**
 * Project the recognized "Label: value" lines of a recorded trace section into fields.
 * @param text - Recorded trace section text.
 * @param t - Conversation translator.
 * @param locale - Date display locale.
 * @returns One field per recognized trace line, in recorded order.
 */
export function textFields(text: string, t: TranslateSeat, locale: string): DetailField[] {
  return text.split("\n").flatMap((line) => {
    const match = /^\s*([^:]+): (.+)$/u.exec(line);
    if (match === null || match[1] === void 0 || match[2] === void 0) return [];
    const key = Object.hasOwn(TRACE_FIELDS, match[1]) ? TRACE_FIELDS[match[1]] : void 0;
    if (key === void 0) return [];
    return [{
      label: t(key),
      value: match[1] === "Created" ? dateText(match[2], locale) : match[2] === "none" ? t("detail.none") : match[2]
    }];
  });
}

/**
 * Derive the session and event search hits from their recorded result text.
 * @param name - Wire tool name of the session search tool.
 * @param text - Recorded result text.
 * @param t - Conversation translator.
 * @param locale - Date display locale.
 * @returns The matched-hit records, or null when the text is not a recognized hit list.
 */
export function searchDetails(name: string, text: string, t: TranslateSeat, locale: string): DetailsModel | null {
  if (text === "No prior session matches found." || text.endsWith("\n\nNo prior event matches found.")) return detailList([], t("detail.matches.count", { count: 0 }), t);
  const blocks = text.split(/\n(?=\d+\. )/u).filter((block) => /^\d+\. /u.test(block));
  if (blocks.length === 0) return null;
  const items: DetailItem[] = [];
  for (const block of blocks) {
    const snippet = /\n\s*Snippet: ([\s\S]*?)(?:\n\nResult cap reached\.|$)/u.exec(block)?.[1];
    if (name === "session_search") {
      const match = /^\d+\. Session (\S+) — (.*)/u.exec(block);
      if (match === null || match[1] === void 0 || match[2] === void 0) return null;
      items.push({
        title: match[2],
        subtitle: match[1],
        ...snippet === void 0 ? {} : { description: snippet.trimEnd() },
        fields: textFields(block, t, locale)
      });
    } else {
      const match = /^\d+\. seq (\d+) \| ([^|]+) \| ([^|]+) \| ([^\n]+)/u.exec(block);
      if (match === null || match[1] === void 0 || match[2] === void 0 || match[3] === void 0 || match[4] === void 0) return null;
      items.push({
        title: snippet?.trimEnd() ?? match[2],
        subtitle: `${match[2].trim()} · #${match[1]}`,
        fields: [{
          label: t("detail.field.time"),
          value: dateText(match[4], locale)
        }, {
          label: t("detail.field.surface"),
          value: match[3].trim()
        }]
      });
    }
  }
  return {
    ...detailList(items, t("detail.matches.count", { count: items.length }), t),
    ...text.includes("Result cap reached.") ? { caption: t("detail.matches.capped") } : {}
  };
}

/**
 * Derive the target event record and its adjacent-event summary from recorded text.
 * @param text - Recorded result text of the event read tool.
 * @param t - Conversation translator.
 * @param locale - Date display locale.
 * @returns The event record, or null when the recorded text is not recognized.
 */
export function eventReadDetails(text: string, t: TranslateSeat, locale: string): DetailsModel | null {
  const match = /^Session (\S+) — ([^\n]*)\nTarget event seq (\d+):\n```json\n([\s\S]*?)\n```([\s\S]*)$/u.exec(text);
  if (match === null || match[1] === void 0 || match[2] === void 0 || match[3] === void 0 || match[4] === void 0) return null;
  const event = detailJson(match[4]);
  if (!detailRecord(event) || typeof event.type !== "string" || !detailRecord(event.data)) return null;
  const fields: DetailField[] = [{
    label: t("detail.field.seq"),
    value: match[3]
  }];
  if (typeof event.time === "number") fields.push({
    label: t("detail.field.time"),
    value: dateText(event.time, locale)
  });
  const groups: { label: string; items: DetailItem[] }[] = [];
  const adjacent = match[5]?.trim();
  if (adjacent) groups.push({
    label: t("detail.event.neighbors"),
    items: [{
      fields: [],
      description: adjacent
    }]
  });
  return detailList([
    {
      title: event.type,
      subtitle: `${match[2]} · ${match[1]}`,
      fields
    },
    ...inspectionItems(event.data, t),
    ...groups.length === 0 ? [] : [{
      fields: [],
      groups
    }]
  ], `${event.type} · #${match[3]}`, t);
}

/**
 * Derive the session ancestry or event lineage records from recorded trace text.
 * @param name - Wire tool name of the trace tool.
 * @param text - Recorded result text.
 * @param t - Conversation translator.
 * @param locale - Date display locale.
 * @returns The trace records, or null when a recorded section is not recognized.
 */
export function traceDetails(name: string, text: string, t: TranslateSeat, locale: string): DetailsModel | null {
  const match = /^Session (\S+) — ([^\n]*)\n([\s\S]*)$/u.exec(text);
  if (match === null || match[1] === void 0 || match[2] === void 0 || match[3] === void 0) return null;
  if (name === "session_event_trace") return detailList([{
    title: match[2],
    subtitle: match[1],
    fields: textFields(match[3], t, locale)
  }], match[2], t);
  const sections = match[3].split("\n\n");
  const items: DetailItem[] = [{
    title: match[2],
    subtitle: match[1],
    fields: textFields(sections[0] ?? "", t, locale)
  }];
  for (const section of sections.slice(1)) {
    const firstBreak = section.indexOf("\n");
    const label = section.startsWith("Ancestors (nearest first):") ? t("detail.trace.ancestors") : section.startsWith("Descendants:") ? t("detail.trace.descendants") : void 0;
    if (label === void 0 || firstBreak < 0) return null;
    const body = section.slice(firstBreak + 1);
    items.push({
      title: label,
      fields: [],
      ...body === "- none" || body === "- none (target is a root session)" ? { description: t("detail.none") } : { lines: body.split("\n").map((line) => line.replace(/^(\s*)- /u, "$1")) }
    });
  }
  return detailList(items, match[2], t);
}

/**
* Present successful inspection, query, and workflow text as named records.
* @param name - Wire tool name.
* @param args - Recorded argument object.
* @param text - Recorded result text.
* @param json - Parsed whole-result JSON, or undefined for non-JSON text.
* @param t - Conversation translator.
* @param locale - Date display locale.
* @returns Structured details, or null when an output format is unknown.
*/
export function inspectionDetails(name: string, args: Record<string, unknown>, text: string, json: unknown, t: TranslateSeat, locale: string): DetailsModel | null {
  if (hasSpillNotice(text)) return null;
  switch (name) {
    case "cordis_inspect_list":
    case "cordis_inspect_query":
    case "cordis_inspect_self": return cordisDetails(name, args, json, t);
    case "workflow":
    case "ralph": return workflowDetails(name, args, text, t);
    case "session_search":
    case "session_event_search": return searchDetails(name, text, t, locale);
    case "session_event_read": return eventReadDetails(text, t, locale);
    case "session_trace":
    case "session_event_trace": return traceDetails(name, text, t, locale);
    default: return null;
  }
}

/**
 * Whether a recorded number is usable as a non-negative safe integer count.
 * @param value - Recorded count value.
 * @returns True when the value is a non-negative safe integer.
 */
export function count(value: Wire): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Format a schedule date with a short time zone name, keeping the recorded text as fallback.
 * @param date - Parsed schedule date.
 * @param locale - Display locale.
 * @param fallback - Text returned when the locale cannot format the date.
 * @returns The localized absolute date and time.
 */
export function formatDate(date: Date, locale: string, fallback: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short"
    }).format(date);
  } catch {
    return fallback;
  }
}

/**
* Derive the compact todo list from a todo_write call.
* @param args - Parsed todo_write arguments.
* @param t - Conversation dictionary translator.
* @returns Localized todo details, or null for unsupported input.
*/
export function todosDetail(args: Record<string, unknown>, t: TranslateSeat): DetailsModel | null {
  if (!Array.isArray(args.todos)) return null;
  const items: DetailItem[] = [];
  const seen = /* @__PURE__ */ new Set();
  for (const todo of args.todos) {
    if (!detailRecord(todo) || !nonempty(todo.content)) return null;
    const status = todo.status;
    if (status !== "completed" && status !== "in_progress" && status !== "pending") return null;
    const title = todo.content.trim();
    if (seen.has(title)) return null;
    seen.add(title);
    items.push({
      title,
      status: {
        value: status,
        label: t(`detail.todo.${status}`)
      },
      fields: []
    });
  }
  return {
    items,
    empty: t("detail.todo.empty")
  };
}

/**
 * Derive the recorded goal record and its round counters, or the empty state when no goal is armed.
 * @param value - Parsed whole-result JSON of a goal tool.
 * @param t - Conversation translator.
 * @returns Localized goal details, or null for unsupported input.
 */
export function goalDetail(value: Wire, t: TranslateSeat): DetailsModel | null {
  if (!detailRecord(value)) return null;
  if (value.goal === null) return {
    items: [],
    empty: t("detail.goal.empty")
  };
  const goal = value.goal;
  if (!detailRecord(goal) || !nonempty(goal.id) || !nonempty(goal.objective) || !count(goal.revision) || !count(goal.roundsStarted) || !count(goal.maxGoalRounds)) return null;
  const phase = goal.phase;
  if (phase !== "active" && phase !== "paused" && phase !== "blocked" && phase !== "complete") return null;
  if (value.activation !== "armed" && value.activation !== "disarmed") return null;
  const fields: DetailField[] = [{
    label: t("detail.state"),
    value: t(phase === "active" && value.activation === "disarmed" ? "detail.goal.disarmed" : `detail.goal.${phase}`)
  }, {
    label: t("detail.goal.rounds"),
    value: `${goal.roundsStarted} / ${goal.maxGoalRounds}`
  }];
  if (goal.blockedReason !== void 0) {
    if (!detailRecord(goal.blockedReason) || !nonempty(goal.blockedReason.code) || !nonempty(goal.blockedReason.message)) return null;
    fields.push({
      label: t("detail.goal.reason"),
      value: goal.blockedReason.message
    });
  }
  return { items: [{
    title: goal.objective,
    fields
  }] };
}

/** ISO-weekday keys, Monday first: a stored weekly rule names days 1 through 7. */
export const WEEKDAY_KEYS = [
  "detail.weekday.1",
  "detail.weekday.2",
  "detail.weekday.3",
  "detail.weekday.4",
  "detail.weekday.5",
  "detail.weekday.6",
  "detail.weekday.7"
];

/**
 * Name a stored interval in the largest whole unit it divides evenly.
 * @param seconds - Stored interval in seconds.
 * @param t - Conversation translator.
 * @returns The localized day, hour, minute, or second figure.
 */
export function interval(seconds: number, t: TranslateSeat): string {
  if (seconds % 86400 === 0) return t("detail.days", { count: seconds / 86400 });
  if (seconds % 3600 === 0) return t("detail.hours", { count: seconds / 3600 });
  if (seconds % 60 === 0) return t("detail.minutes", { count: seconds / 60 });
  return t("detail.seconds", { count: seconds });
}

/**
 * A stored wall clock without its zero seconds, the figure the schedule surfaces state.
 * @param time - Stored wall clock text.
 * @returns The wall clock without its zero seconds.
 */
export function shortTime(time: string): string {
  return time.replace(/:00\.000$/, "").replace(/\.000$/, "");
}

/**
 * Localized weekday list of a stored weekly rule, or undefined when the set is empty or out of range.
 * @param days - Stored weekday numbers of a weekly rule.
 * @param t - Conversation translator.
 * @returns The joined localized weekday list, or undefined when the set is unusable.
 */
export function weekdayText(days: Wire, t: TranslateSeat): string | undefined {
  if (!Array.isArray(days) || days.length === 0) return void 0;
  const labels: string[] = [];
  for (const day of days) {
    if (typeof day !== "number" || !Number.isInteger(day)) return void 0;
    const key = WEEKDAY_KEYS[day - 1];
    if (key === void 0) return void 0;
    labels.push(t(key));
  }
  return labels.join(t("detail.weekday.join"));
}

/**
 * Derive one scheduled-task record from its recorded JSON value.
 * @param value - Parsed schedule JSON of one stored task.
 * @param t - Conversation translator.
 * @param locale - Display locale for the absolute next run time.
 * @returns The scheduled-task item, or null when the recorded task is unsupported.
 */
export function scheduleItem(value: Wire, t: TranslateSeat, locale: string): DetailItem | null {
  if (!detailRecord(value) || !nonempty(value.id) || !nonempty(value.prompt) || typeof value.scheduledAt !== "string" || value.deliveryMode !== "host" && value.deliveryMode !== "session-local" || value.state !== "scheduled" && value.state !== "overdue") return null;
  const date = new Date(value.scheduledAt);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value.scheduledAt) return null;
  let frequency: string;
  switch (value.kind) {
    case "at":
      frequency = t("detail.schedule.once");
      break;
    case "after":
      if (!count(value.afterSeconds) || value.afterSeconds === 0) return null;
      frequency = t("detail.schedule.once");
      break;
    case "every":
      if (!count(value.everySeconds) || value.everySeconds === 0) return null;
      frequency = t("detail.schedule.every", { interval: interval(value.everySeconds, t) });
      break;
    case "daily":
      if (!nonempty(value.time) || !nonempty(value.timeZone)) return null;
      frequency = t("detail.schedule.daily", {
        time: shortTime(value.time),
        zone: value.timeZone
      });
      break;
    case "weekly": {
      const days = weekdayText(value.weekdays, t);
      if (!nonempty(value.time) || !nonempty(value.timeZone) || days === void 0) return null;
      frequency = t("detail.schedule.weekly", {
        days,
        time: shortTime(value.time),
        zone: value.timeZone
      });
      break;
    }
    case "cron":
      if (!nonempty(value.expression) || !nonempty(value.timeZone)) return null;
      frequency = t("detail.schedule.cron", {
        expression: value.expression,
        zone: value.timeZone
      });
      break;
    default: return null;
  }
  const dateText = formatDate(date, locale, value.scheduledAt);
  return {
    title: nonempty(value.title) ? value.title : value.prompt,
    fields: [
      {
        label: t("detail.schedule.when"),
        value: dateText
      },
      {
        label: t("detail.schedule.frequency"),
        value: frequency
      },
      {
        label: t("detail.state"),
        value: t(`detail.schedule.${value.state}`)
      }
    ]
  };
}

/**
* Derive a supported successful result, retaining generic output on unknown or malformed data.
* @param block - Logged root or nested Tool call and its optional result.
* @param t - Conversation dictionary translator.
* @param locale - Display locale for absolute dates in the viewer's time zone.
* @returns Localized detail data, or null for raw input/output.
*/
export function detailsCardModel(block: Wire, t: TranslateSeat, locale: string): DetailsModel | null {
  if (!("kind" in block) || block.isError) return null;
  const call = parsedToolCall(block);
  if (call === null) return null;
  const text = singleResultText(block);
  if (text === void 0) return null;
  const value = detailJson(text);
  const details = controlDetails(call.name, call.args, text, value, t) ?? inspectionDetails(call.name, call.args, text, value, t, locale);
  if (details !== null) return details;
  if (value === void 0) return null;
  switch (call.name) {
    case "create_goal":
    case "get_goal":
    case "update_goal": return goalDetail(value, t);
    case "schedule_create":
    case "schedule_update": {
      const item = scheduleItem(value, t, locale);
      return item === null ? null : { items: [item] };
    }
    case "schedule_list": {
      if (!Array.isArray(value)) return null;
      const items: DetailItem[] = [];
      for (const entry of value) {
        const item = scheduleItem(entry, t, locale);
        if (item === null) return null;
        items.push(item);
      }
      return {
        items,
        summary: t("detail.schedule.count", { count: items.length }),
        empty: t("detail.schedule.empty")
      };
    }
    case "schedule_delete":
      if (!detailRecord(value) || !nonempty(value.id) || value.deleted !== true) return null;
      return { items: [{
        title: value.id,
        fields: [{
          label: t("detail.state"),
          value: t("detail.schedule.deleted")
        }]
      }] };
    default: return null;
  }
}
