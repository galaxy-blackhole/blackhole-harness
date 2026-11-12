/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-tool: mot id module, hai ten slot nguyen van, 49 key cua slot keyed, bay the CSS
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra) — KHONG khai id cua goi goc: no thuoc gbh.row.aliases va tang nap
 * TU sinh entry alias tro ve cung URL bundle. Mot bundle MOT id.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-tool";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio load() trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-tool";

/**
 * Namespace tu dien ma chu nhan slot (goi conversation) cap cho moi trinh render Tool — nguyen van ban goc.
 * Nhan: khong co.
 * Tra: chuoi ten namespace.
 */
export const CONVERSATION_NS = "conversation";

/** Ten slot goc cua nut node hoi thoai ma cay Tool chiem cho — nguyen van tu bundle goc. */
export const SLOT_CHAT_NODE = "conversation.chat.node";

/** Ten slot con kieu KEYED ma tung Tool chiem mot key — nguyen van tu bundle goc. */
export const SLOT_TOOL_VIEW = "tool.call.toolview";

/** Key cua nut node hoi thoai (khong phai id module) — nguyen van ban goc. */
export const CHAT_NODE_KEY = "tool-call";

/** Key cua slot con "tool.call.toolview" do nut node khai voi chu so huu — nguyen van ban goc. */
export const CHILDREN_KIND = "keyed";

/** Pham vi cua slot con — nguyen van ban goc. */
export const CHILDREN_SCOPE = "session";

/** Nhan hieu ung vong doi — nguyen van nhan cua ban goc (dung cho log chan doan). */
export const EFFECT = {
  /** Chen bay the CSS module cua row. */
  styles: "ui-tool: styles",
} as const;

/**
 * Id the style cho tung module CSS — build.ts nhung nguyen van bang define.
 * 08/11/2026 (dev-1): dựng từ PACKAGE_NAME (id CỦA TA), không phải id gốc — canon "quy id chỉ ở dòng loader" là
 * của bản viết tay cũ; artefact nay KHÔNG được chứa id gốc (test \`ui-tool\` đếm occurrences(STOCK)=0), còn parity dữ
 * liệu vẫn so được vì phép so chuẩn hoá id trước khi đối chiếu.
 */
export const STYLE_TAGS = {
  /** CSS cua AskQuestionCard.module.css. */
  askQuestionCard: PACKAGE_NAME + "/AskQuestionCard.module.css",
  /** CSS cua ToolDetails.module.css. */
  toolDetails: PACKAGE_NAME + "/ToolDetails.module.css",
  /** CSS cua ExitCodeBadge.module.css. */
  exitCodeBadge: PACKAGE_NAME + "/ExitCodeBadge.module.css",
  /** CSS cua ToolRow.module.css. */
  toolRow: PACKAGE_NAME + "/ToolRow.module.css",
  /** CSS cua ToolCallTree.module.css. */
  toolCallTree: PACKAGE_NAME + "/ToolCallTree.module.css",
  /** CSS cua QuestionToolRow.module.css. */
  questionToolRow: PACKAGE_NAME + "/QuestionToolRow.module.css",
  /** CSS cua bash-sample.module.css. */
  bashSample: PACKAGE_NAME + "/bash-sample.module.css",
} as const;

/**
 * Duong dan file CSS theo thu tu ban goc chen — dung cho injectStyles trong styles.ts.
 * Nhan: khong co.
 * Tra: mang [nhan, id the, van ban CSS] theo thu tu goc.
 */
export const CSS_ORDER = [
  "askQuestionCard",
  "toolDetails",
  "exitCodeBadge",
  "toolRow",
  "toolCallTree",
  "questionToolRow",
  "bashSample",
] as const;

/** Key ma tung toolview chiem trong slot "tool.call.toolview" — nguyen van tu bundle goc (48 key). */
export const TOOLVIEW_KEYS = {
  /** Nhom ask-question-row (1 key). */
  askQuestion: ["ask_user_question"],
  /** Nhom bash-sample (1 key). */
  bash: ["bash"],
  /** Nhom file-mutation-row (2 key). */
  fileMutation: ["edit", "write"],
  /** Nhom read-row (1 key). */
  read: ["read"],
  /** Nhom read-image-row (1 key). */
  readImage: ["read_image"],
  /** Nhom search-row (2 key). */
  search: ["grep", "glob"],
  /** Nhom web-row (2 key). */
  web: ["web_search", "web_fetch"],
  /** Nhom todo-row (1 key). */
  todo: ["todo_write"],
  /** Nhom details-row (37 key). */
  details: [
    "create_goal",
    "get_goal",
    "update_goal",
    "schedule_create",
    "schedule_list",
    "schedule_delete",
    "schedule_update",
    "cordis_inspect_list",
    "cordis_inspect_query",
    "cordis_inspect_self",
    "workflow",
    "ralph",
    "session_event_read",
    "session_event_search",
    "session_event_trace",
    "session_search",
    "session_trace",
    "list_subagent_models",
    "subagent",
    "list_agents",
    "send_message",
    "interrupt_agent",
    "job_list",
    "job_output",
    "job_kill",
    "terminal_open",
    "terminal_read",
    "terminal_list",
    "terminal_signal",
    "terminal_close",
    "lsp",
    "spawn_teammate",
    "team_task_create",
    "team_task_get",
    "team_task_update",
    "team_task_list",
    "wait_agent",
  ],
} as const;

/**
 * Moi key ma row nay chiem trong slot "tool.call.toolview" — dung cho ca test doi chieu voi ban goc.
 * Nhan: khong co.
 * Tra: mang 48 key nguyen van.
 */
export function allToolviewKeys(): string[] {
  const groups = Object.values(TOOLVIEW_KEYS) as readonly (readonly string[])[];
  return groups.flatMap((keys) => [...keys]);
}
