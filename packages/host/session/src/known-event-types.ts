/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Danh mục event mà bản build này HIỂU (port 1:1 known-event-types.js): KNOWN_SESSION_EVENT_TYPES +
 *      MESSAGE_PROJECTION_EVENT_TYPES — persistence từ chối log chứa loại ngoài tập này trừ khi event có cờ ignorable.
 */
/** Mọi thành viên SessionEventMap mà build này hiểu (trừ event plugin ngoài repo). */
export const KNOWN_SESSION_EVENT_TYPES: ReadonlySet<string> = new Set<string>([
  'agent-preset/selected',
  'agent/inbox/spliced',
  'approval/asked',
  'approval/decided',
  'approval/policy',
  'assistant/attempt',
  'assistant/message',
  'command/done',
  'command/run',
  'compaction/end',
  'compaction/prune',
  'compaction/start',
  'compaction/summary',
  'deliverables/presented',
  'developer/message',
  'feedback/message-delete',
  'feedback/message-put',
  'feedback/record',
  'goal/change',
  'hook/invoked',
  'hook/result',
  'image/offload',
  'job/registered',
  'job/settled',
  'llm/retry',
  'llm/retry-started',
  'model/selection',
  'permission/preset',
  'plan/mode',
  'request/context',
  'request/header',
  'sandbox/mode',
  'schedule/change',
  'session-log-deepseek/delivery-accepted',
  'session/end-seed',
  'session/title',
  'session/title-llm-request',
  'step/end',
  'step/start',
  'subagent/catalog',
  'subagent/descriptor',
  'subagent/model-selection-policy',
  'system/message',
  'team/member',
  'team/message/delivered',
  'team/message/queued',
  'team/task',
  'todo/write',
  'tool-workflow/agent-end',
  'tool-workflow/agent-start',
  'tool-workflow/run-end',
  'tool-workflow/run-start',
  'tool/call',
  'tool/ptc-dispatch',
  'tool/ptc-dispatch-start',
  'tool/result',
  'turn/end',
  'turn/start',
  'user/message',
  'web/deepseek-search-llm-request',
  'working-directory/change',
  'workspace/changes',
]);

/** Loại event mà hiệu ứng model-visible của nó cần bộ thông dịch thuần tường minh. */
export const MESSAGE_PROJECTION_EVENT_TYPES: ReadonlySet<string> = new Set<string>([
  'image/offload',
]);
