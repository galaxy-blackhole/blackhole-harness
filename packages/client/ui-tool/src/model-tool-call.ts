/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Mo hinh cua mot hang tool: phan loai variant · tieu de · tom tat · than khi mo rong · ket qua da det · tu choi auto-review
 */

import { abbreviateHomePath, isAbsoluteWorkspacePath, recordedAbsolutePath, relativizeToCwd } from "./paths.ts";

/** Du lieu tho doc tu day (khoi goi tool · ket qua · ham dich cua slot) — giu 'any' cho gon nhu ban goc khong dat kieu. */
type Wire = any;

/** Ban the cua mot hang tool do trinh render nguyen tu chon. */
type ToolRowVariant = "search" | "read" | "bash" | "write" | "edit" | "code" | "others";

/** Vong doi cua hang tool — dung cho kieu dang tom tat va chu trang thai. */
type ToolRowState = "preparing" | "running" | "ok" | "error" | "stopped";

/** Su that trung lap ngon ngu, chi hang Tool phia nguoi dung dung. */
interface AutoReviewDenial {
  /** Ly do tho cua nguoi duyet; viec chuan hoa de hien thi lam luc render. */
  reason: string | null;
}

/** Moi thu ToolRow can, dan xuat MOT lan tu lat cat da dong bang. */
interface ToolRowModel {
  variant: ToolRowVariant;
  titleKey: string;
  /** Hang generic giu ten tool tren day; hang co tham so thi noi them tom tat. */
  summary: string;
  /**
   * Duong dan tuyet doi luc chay tool cua hang file. Ket qua cu khong co metadata
   * vi tri thi giu duong dan tu tham so; duong dan tuong doi dang chay thi chua co
   * cho toi khi ket qua chi ra dich.
   */
  filePath: string | undefined;
  /** JSON tham so goc giu lai de dinh dang than luc mo rong. */
  bodyRaw: string | null;
  /** Van ban ket qua da det ({@link resultText}); null khi dang chay hoac ket qua khong co chu. */
  output: string | null;
  /** Dong dau cua van ban ket qua tren hang loi; null voi moi trang thai khac. */
  errorSummary: string | null;
  /** Danh tinh tu choi auto-review co cau truc; null voi moi ket qua thuong. */
  autoReviewDenial: AutoReviewDenial | null;
  state: ToolRowState;
}

/** Mot lan goi tool trong cua so da duoc phan tich, tham so la mot doi tuong JSON. */
interface ParsedToolCall {
  name: string;
  args: Record<string, unknown>;
}

/** Ban dich thay the dau ra cua mot lan goi loi vi auto-review tu choi. */
interface AutoReviewDenialPresentation {
  summary: string;
  output: string;
}

/** Ham dich cua namespace hoi thoai (ban goc lay tu slot) — giu 'any' cho gon. */
type TranslateFn = any;

/** Locale key per generic row variant. */
export const VARIANT_TITLE_KEYS = {
  search: "tool.title.search",
  read: "tool.title.read",
  bash: "tool.title.bash",
  write: "tool.title.write",
  edit: "tool.title.edit",
  code: "tool.title.code",
  others: "tool.title.generic"
} as const;

/**
 * Known tool name -> variant.
 *
 * `cordis_define` is deliberately absent: ui-cordis registers a keyed
 * `tool.call.toolview` entry for it, and a keyed hit REPLACES the generic row
 * (this table is only reached through GenericToolCard, the dispatch fallback in
 * ToolCallTree). An entry here would be unreachable, and a second title for the
 * same call would be a second answer to a question the card already owns.
 */
export const TOOL_VARIANTS: Record<string, ToolRowVariant> = {
  bash: "bash",
  pwsh: "bash",
  read: "read",
  read_image: "read",
  web_fetch: "read",
  web_search: "search",
  grep: "search",
  glob: "search",
  write: "write",
  edit: "edit",
  run_code: "code",
  cordis_package_inspect: "read",
  cordis_runtime_inspect: "read",
  cordis_run: "others",
  cordis_stop: "others",
  cordis_undefine: "others"
};

/** Tool-owned titles that refine a generic row variant without replacing it. */
export const TOOL_TITLE_KEYS: Record<string, string> = {
  cordis_package_inspect: "tool.title.inspect",
  cordis_runtime_inspect: "tool.title.inspect",
  cordis_run: "tool.title.runCordis",
  cordis_stop: "tool.title.stopCordis",
  cordis_undefine: "tool.title.removeCordis",
  pwsh: "tool.title.pwsh",
  read_image: "tool.title.readImage",
  todo_write: "todo.rowTitle",
  ask_user_question: "ask.rowTitle",
  create_goal: "tool.title.createGoal",
  get_goal: "tool.title.getGoal",
  update_goal: "tool.title.updateGoal",
  schedule_create: "tool.title.createSchedule",
  schedule_list: "tool.title.listSchedules",
  schedule_delete: "tool.title.deleteSchedule",
  schedule_update: "tool.title.updateSchedule",
  cordis_inspect_list: "tool.title.inspectProviders",
  cordis_inspect_query: "tool.title.queryRuntime",
  cordis_inspect_self: "tool.title.inspectPlugins",
  workflow: "tool.title.workflow",
  ralph: "tool.title.ralph",
  session_event_read: "tool.title.readEvent",
  session_event_search: "tool.title.searchEvents",
  session_event_trace: "tool.title.traceEvent",
  session_search: "tool.title.searchSessions",
  session_trace: "tool.title.traceSession",
  list_subagent_models: "tool.title.listModels",
  subagent: "tool.title.subagent",
  list_agents: "tool.title.listAgents",
  send_message: "tool.title.sendMessage",
  interrupt_agent: "tool.title.interruptAgent",
  job_list: "tool.title.listJobs",
  job_output: "tool.title.readJob",
  job_kill: "tool.title.killJob",
  terminal_open: "tool.title.openTerminal",
  terminal_read: "tool.title.readTerminal",
  terminal_list: "tool.title.listTerminals",
  terminal_signal: "tool.title.signalTerminal",
  terminal_close: "tool.title.closeTerminal",
  lsp: "tool.title.lsp",
  spawn_teammate: "tool.title.spawnTeammate",
  team_task_create: "tool.title.createTeamTask",
  team_task_get: "tool.title.getTeamTask",
  team_task_update: "tool.title.updateTeamTask",
  team_task_list: "tool.title.listTeamTasks",
  wait_agent: "tool.title.waitAgent",
  reset_teammate: "tool.title.resetTeammate",
  set_team_limits: "tool.title.setTeamLimits"
};

/**
 * Classify a tool name into its row variant.
 * @param toolName - wire tool name.
 * @returns matching variant, others when unknown.
 */
export function classifyTool(toolName: string): ToolRowVariant {
  return TOOL_VARIANTS[toolName] ?? "others";
}

/**
 * Select a tool-owned or generic title without reading arguments.
 * @param toolName - wire tool name.
 * @returns the localized title key.
 */
export function toolTitleKey(toolName: string): string {
  return TOOL_TITLE_KEYS[toolName] ?? VARIANT_TITLE_KEYS[classifyTool(toolName)];
}

/**
 * Doc su that tu choi auto-review ra tu mot khoi ket qua da det.
 * Nhan: block — khoi goi tool tu Session log.
 * Tra: { reason } khi loi dung la AutoReviewDeniedError voi ma AUTO_REVIEW_DENIED, nguoc lai null.
 */
export function deriveAutoReviewDenial(block: Wire): AutoReviewDenial | null {
  if (!("kind" in block) || !block.isError) return null;
  const error = block.error;
  if (error?.name !== "AutoReviewDeniedError" || error.code !== "AUTO_REVIEW_DENIED") return null;
  return { reason: typeof error.reason === "string" ? error.reason : null };
}

/**
 * Flatten a settled result's content blocks to display text: text blocks
 * verbatim, other block shapes as pretty JSON. Empty content on a failed call
 * falls back to the structured error's `name: code` line.
 * @param node - the settled result node.
 * @returns the flattened result text (may be empty).
 */
export function resultText(node: Wire): string {
  const parts: string[] = [];
  for (const block of node.content) if (block.type === "text") parts.push(block.text);
  else parts.push(JSON.stringify(block, null, 2));
  if (parts.length === 0 && node.error !== undefined) parts.push(`${node.error.name}: ${node.error.code}`);
  return parts.join("\n");
}

/**
 * Doc tham so JSON cua mot lan goi tool, khong nem loi khi van ban con do dang.
 * Nhan: argsRaw — chuoi tham so goc (JSON hoac van ban tho chua hoan chinh).
 * Tra: gia tri da phan tich, hoac undefined khi khong phai JSON hop le.
 */
export function parseArgs(argsRaw: string): Wire {
  try {
    return JSON.parse(argsRaw);
  } catch {
    return;
  }
}

/**
 * Cat mot doan van ban ve dong dau tien.
 * Nhan: text — van ban can cat.
 * Tra: phan truoc ky tu xuong dong dau tien, hoac nguyen van ban khi chi co mot dong.
 */
export function firstLine(text: string): string {
  const nl = text.indexOf("\n");
  return nl === -1 ? text : text.slice(0, nl);
}

/**
 * Lay chuoi khac rong dau tien trong tham so theo thu tu uu tien cua khoa.
 * Nhan: args — doi tuong tham so da phan tich; keys — danh sach khoa theo thu tu uu tien.
 * Tra: chuoi dau tien khac rong, hoac undefined khi khong khoa nao co chuoi.
 */
export function pickString(args: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const v = args[key];
    if (typeof v === "string" && v !== "") return v;
  }
}

/** Summary key preference per variant (args-derived; result-derived summaries are a ledger item). */
export const SUMMARY_KEYS: Record<ToolRowVariant, readonly string[]> = {
  bash: ["description", "command"],
  read: [
    "path",
    "file_path",
    "url"
  ],
  search: [
    "query",
    "pattern",
    "url"
  ],
  write: ["path", "file_path"],
  edit: ["path", "file_path"],
  code: ["description"],
  others: []
};

/**
 * Dan xuat tom tat mot dong cua mot lan goi tu tham so goc.
 * Nhan: variant — ban the hang tool; argsRaw — chuoi tham so goc.
 * Tra: tom tat mot dong (uu tien theo bang khoa cua variant, sau do chuoi dau tien, cuoi cung la van ban goc).
 */
export function deriveSummary(variant: ToolRowVariant, argsRaw: string): string {
  const parsed = parseArgs(argsRaw);
  if (typeof parsed !== "object" || parsed === null) return firstLine(argsRaw);
  const args = parsed as Record<string, unknown>;
  if (variant === "search" && Array.isArray(args.queries)) {
    const queries = args.queries.filter((query) => typeof query === "string" && query !== "");
    if (queries.length > 0) return queries.map(firstLine).join(", ");
  }
  const picked = pickString(args, SUMMARY_KEYS[variant]);
  if (picked !== undefined) return firstLine(picked);
  for (const v of Object.values(args)) if (typeof v === "string" && v !== "") return firstLine(v);
  return firstLine(argsRaw);
}

/** Path keys only — never `url` (web_fetch lands on the read variant). */
export const FILE_PATH_KEYS = ["path", "file_path"];

/** File-tool variants whose summary may be an openable workspace path. */
export const FILE_PATH_VARIANTS = new Set([
  "read",
  "write",
  "edit"
]);

/**
 * Summary material read the same way at every stage from the argument view: a
 * complete `file_path` for file tools, otherwise the `description` text so far.
 * Empty when the view carries neither, so the caller falls back to the raw text.
 */
export function argumentSummary(variant: ToolRowVariant, args: Wire, cwd?: string, home?: string): { summary: string; filePath: string | undefined } {
  if (FILE_PATH_VARIANTS.has(variant)) {
    const path = args.complete("file_path") ? args.text("file_path") : undefined;
    const filePath = path !== undefined && path !== "" && args.complete("file_path") ? firstLine(path) : undefined;
    return {
      summary: filePath === undefined ? "" : abbreviateHomePath(relativizeToCwd(filePath, cwd), home),
      filePath
    };
  }
  const description = args.text("description");
  return {
    summary: description === undefined ? "" : firstLine(description),
    filePath: undefined
  };
}

/**
 * Doc duong dan file tu tham so goc cho cac hang file (khong bao gio lay `url`).
 * Nhan: variant — ban the hang tool; argsRaw — chuoi tham so goc.
 * Tra: dong dau cua duong dan, hoac undefined khi variant khong phai hang file / tham so khong hop le.
 */
export function deriveFilePath(variant: ToolRowVariant, argsRaw: string): string | undefined {
  if (!FILE_PATH_VARIANTS.has(variant)) return undefined;
  const parsed = parseArgs(argsRaw);
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const picked = pickString(parsed as Record<string, unknown>, FILE_PATH_KEYS);
  return picked === undefined ? undefined : firstLine(picked);
}

/**
 * Format one argument payload when its generic input body becomes visible.
 * @param variant - row presentation selected for the Tool name.
 * @param argsRaw - original argument JSON or incomplete raw text.
 * @returns display body, or null for empty input.
 */
export function formatToolBody(variant: ToolRowVariant, argsRaw: string): string | null {
  if (argsRaw === "") return null;
  const parsed = parseArgs(argsRaw);
  if (parsed === undefined) return argsRaw;
  if (variant === "code" && typeof parsed === "object" && parsed !== null) {
    const code = parsed.code;
    if (typeof code === "string" && code !== "") return code;
  }
  return JSON.stringify(parsed, null, 2);
}

/**
 * Derive the full row model from a frozen call slice.
 * @param toolName - wire tool name (dispatch-supplied; survives windowless results).
 * @param block - preparing call, dispatched call, or result from the snapshot.
 * @param cwd - session workspace root; workspace-rooted path summaries display relative to it.
 * @param home - host account home; a leftover POSIX home path displays as `~`.
 * @returns the row model.
 */
export function toolRowModel(toolName: string, block: Wire, cwd?: string, home?: string): ToolRowModel {
  const variant = classifyTool(toolName);
  const titleKey = toolTitleKey(toolName);
  const done = "kind" in block;
  const argsRaw = done ? block.call?.argsRaw ?? "" : block.phase === "start" ? block.argsRaw : null;
  const primary = argumentSummary(variant, block.args, cwd, home);
  const argumentPath = primary.filePath ?? (argsRaw === null ? undefined : deriveFilePath(variant, argsRaw));
  const recordedPath = done ? recordedAbsolutePath(block.meta, "path") : undefined;
  const canUseArgumentPath = argumentPath !== undefined && (isAbsoluteWorkspacePath(argumentPath) || done && !block.isError && block.parentCallId === undefined);
  const filePath = argumentPath === undefined ? undefined : recordedPath ?? (canUseArgumentPath ? argumentPath : undefined);
  const state: ToolRowState = !done ? block.phase === "preparing" ? "preparing" : "running" : block.error?.code === "interrupted" ? "stopped" : block.isError ? "error" : "ok";
  const base = primary.summary !== "" || argsRaw === null ? primary.summary : argsRaw === "" ? block.callId : abbreviateHomePath(relativizeToCwd(deriveSummary(variant, argsRaw), cwd), home);
  const summary = [titleKey === "tool.title.generic" ? toolName : "", base].filter(Boolean).join(" · ");
  const output = done ? resultText(block) || null : null;
  const errorSummary = state === "error" && output !== null ? firstLine(output) : null;
  return {
    variant,
    titleKey,
    summary,
    filePath,
    bodyRaw: argsRaw === "" ? null : argsRaw,
    output,
    errorSummary,
    autoReviewDenial: deriveAutoReviewDenial(block),
    state
  };
}

/** Nho dem theo doi tuong: ket qua phan tich cua tung khoi goi tool bat bien. */
export const parsedCalls = /* @__PURE__ */ new WeakMap<object, ParsedToolCall | null>();

/**
 * Parse the call head paired with one immutable Tool block.
 * @param block - preparing, dispatched, or settled Tool block.
 * @returns the Tool name and object arguments, or null during preparation or when valid arguments are unavailable.
 */
export function parsedToolCall(block: Wire): ParsedToolCall | null {
  if (!("kind" in block) && block.phase === "preparing") return null;
  const cached = parsedCalls.get(block);
  if (cached !== undefined || parsedCalls.has(block)) return cached ?? null;
  const call = "kind" in block ? block.call : block;
  if (call === null) {
    parsedCalls.set(block, null);
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(call.argsRaw);
  } catch {
    parsedCalls.set(block, null);
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    parsedCalls.set(block, null);
    return null;
  }
  const parsed: ParsedToolCall = {
    name: call.name,
    args: value as Record<string, unknown>
  };
  parsedCalls.set(block, parsed);
  return parsed;
}

/**
 * Read the exact single text block consumed by first-party card derivations.
 * @param block - settled Tool result.
 * @returns its text, or undefined for any other content layout.
 */
export function singleResultText(block: Wire): string | undefined {
  if (block.content.length !== 1) return undefined;
  const only = block.content[0];
  return only?.type === "text" ? only.text : undefined;
}

/**
 * Normalize only the user-visible copy; the durable error keeps the raw reason.
 * @param reason - raw persisted reviewer reason, or null when none was recorded.
 * @returns one display line, or null when the reason has no displayable text.
 */
export function normalizeAutoReviewReason(reason: string | null): string | null {
  if (reason === null) return null;
  const normalized = reason.trim().replace(/[\r\n\u2028\u2029]+/gu, " ");
  return normalized === "" ? null : normalized;
}

/**
 * Resolve the collapsed identity and the single expanded OUT line.
 * @param denial - locale-neutral persisted denial facts.
 * @param t - conversation-namespace translator.
 * @returns localized summary and output text for the Tool row.
 */
export function localizeAutoReviewDenial(denial: AutoReviewDenial, t: TranslateFn): AutoReviewDenialPresentation {
  const reason = normalizeAutoReviewReason(denial.reason) ?? t("tool.autoReviewReasonFallback");
  return {
    summary: t("tool.autoReviewRejected"),
    output: t("tool.autoReviewNotExecuted", { reason })
  };
}
