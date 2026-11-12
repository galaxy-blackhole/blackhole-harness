/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Đơn vị chiếu `agentTeam` mà Session chiếu: trạng thái Team bền (roster + bảng việc + hộp thư)
 *      được lái TĂNG DẦN từ các sự kiện phiên đã cam kết, kèm khung nhìn dây CHỈ chứa roster và bảng
 *      việc chưa xoá; bản ghi bền hỏng đầu tiên được giữ trong `failure` và là trạng thái CUỐI.
 *      Port 1:1 lib/types/projection.js của @deepseek-ai/dsh-experimental-agent-team.
 */

// Nạp zod qua "zod/v4" (quy ước repo): ambient shim `declare module "zod"` ở
// packages/client/ui-sidebar-right/src/externals.d.ts che mất kiểu thật khi tsc đọc CẢ chương trình.
import { z } from "zod/v4";
import { brandString } from "@deepseek-ai/dsh-brand";
import type { ContentBlock } from "@deepseek-ai/dsh-llm/types";
import type { SessionId, SessionHeader } from "@deepseek-ai/dsh-session";
import { TeamId as toTeamId, TeamMessageId as toTeamMessageId, TeamTaskId as toTeamTaskId } from "./types.ts";
import { assertTaskGraphCandidate } from "./task-graph.ts";
import { projectTaskView } from "./task-view.ts";
import type { TeamId, TeamMemberSnapshot, TeamMessageId, TeamMessageSnapshot, TeamProjection, TeamTaskSnapshot } from "./types.ts";

/** Số nguyên an toàn KHÔNG ÂM — khuôn số của mọi bộ đếm bền. */
const nonNegativeSafeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** Số nguyên an toàn DƯƠNG — revision task và số thứ tự task kế tiếp. */
const positiveSafeInteger = nonNegativeSafeInteger.min(1);

/** Danh tính phiên trên dây: chuỗi khác rỗng, đóng dấu `SessionId` ở mức kiểu (giá trị không đổi). */
const sessionIdSchema = z.string().min(1).transform(value => brandString<SessionId>(value));

/** Danh tính Team trên dây: chuỗi khác rỗng, đóng dấu `TeamId` ở mức kiểu (giá trị không đổi). */
const teamIdSchema = z.string().min(1).transform(value => toTeamId(value));

/** Hậu tố số của id task do Team cấp: `task-<n>`. */
const numericTaskIdPattern = /^task-(\d+)$/u;

/** Danh tính task trên dây: hậu tố số (nếu có) phải là số nguyên an toàn; đóng dấu `TeamTaskId` ở mức kiểu. */
const teamTaskIdSchema = z.string().min(1).refine((value) => {
  const match = numericTaskIdPattern.exec(value);
  return match === null || Number.isSafeInteger(Number(match[1]));
}, { message: 'numeric task id suffix must be a safe integer' }).transform(value => toTeamTaskId(value));

/** Danh tính tin nhắn trên dây: chuỗi khác rỗng, đóng dấu `TeamMessageId` ở mức kiểu. */
const teamMessageIdSchema = z.string().min(1).transform(value => toTeamMessageId(value));

/** Năm thẻ khối lõi: bốn thẻ đang dùng cộng thẻ `tool-result` đã nghỉ hưu. */
const coreContentBlockTypes = new Set(['text', 'reasoning', 'image', 'tool-call', 'tool-result']);

/** Tham chiếu ảnh bền của MỘT khối `image` — đúng hình dạng `ImageAttachmentRef` trên dây. */
const imageAttachmentSchema = z.object({
  attachmentId: z.string().min(1),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  bytes: nonNegativeSafeInteger,
  width: positiveSafeInteger,
  height: positiveSafeInteger,
  name: z.string().optional(),
}).strict();

/**
 * Chỉ bốn biến thể dưới đây được kiểm; thẻ `tool-result` đã nghỉ hưu KHÔNG được lọt vào nhánh dự
 * phòng mở rộng được của nội dung plugin do JSON giải mã.
 */
const contentBlockSchema = z.lazy(() => z.union([
  z.object({ type: z.literal('text'), text: z.string() }).strict(),
  z.object({ type: z.literal('reasoning'), text: z.string() }).strict(),
  z.object({ type: z.literal('image'), attachment: imageAttachmentSchema }).strict(),
  z.object({
    type: z.literal('tool-call'),
    id: z.string().min(1),
    name: z.string(),
    arguments: z.string(),
  }).strict(),
  // Giữ nguyên tham chiếu các đối tượng JSON lạ; cách parse "loose-object" làm rơi khoá __proto__ của chính chúng.
  z.custom<ContentBlock>((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return false;
    const type = (value as { type?: unknown }).type;
    return typeof type === 'string' && type.length > 0 && !coreContentBlockTypes.has(type);
  }),
]));

/** Snapshot bền của MỘT thành viên: mọi thay đổi vòng đời ghi LẠI toàn bộ giá trị. */
const teamMemberSnapshotSchema = z.object({
  id: sessionIdSchema,
  name: z.string(),
  description: z.string(),
  provider: z.string(),
  context: z.enum(['fresh', 'fork']),
  phase: z.enum(['provisioning', 'active', 'failed']),
  error: z.string().optional(),
}).strict();

/** Snapshot bền của MỘT task: mỗi lần đổi trạng thái là một revision mới. */
const teamTaskSnapshotSchema = z.object({
  id: teamTaskIdSchema,
  revision: positiveSafeInteger,
  subject: z.string(),
  description: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'deleted']),
  ownerId: sessionIdSchema.optional(),
  blockedBy: z.array(teamTaskIdSchema),
  writeScopes: z.array(z.string()),
}).strict();

/**
 * Snapshot bền của MỘT tin nhắn trong hộp thư Team.
 * Trên dây `id`/`attachmentId` của khối nội dung là chuỗi THUẦN (thương hiệu của kernel chỉ tồn tại
 * lúc biên dịch), nên ép kiểu sang `TeamMessageSnapshot`: hình dạng lúc chạy y hệt từng trường.
 */
const teamMessageSnapshotSchema = z.object({
  id: teamMessageIdSchema,
  senderId: sessionIdSchema,
  senderName: z.string(),
  targetId: sessionIdSchema,
  content: z.array(contentBlockSchema),
}).strict() as unknown as z.ZodType<TeamMessageSnapshot>;

/** Phần đầu của MỌI thân sự kiện Team: phiên bản và danh tính Team sở hữu sự kiện đó. */
const teamEventSelectorSchema = z.object({
  version: nonNegativeSafeInteger,
  teamId: teamIdSchema,
}).loose();

/** Thân sự kiện `team/member` phiên bản hiện tại. */
const teamMemberEventSchema = z.object({
  version: z.literal(2),
  teamId: teamIdSchema,
  member: teamMemberSnapshotSchema,
}).strict();

/** Thân sự kiện `team/task` phiên bản hiện tại. */
const teamTaskEventSchema = z.object({
  version: z.literal(2),
  teamId: teamIdSchema,
  task: teamTaskSnapshotSchema,
}).strict();

/** Thân sự kiện `team/message/queued` phiên bản hiện tại. */
const teamMessageQueuedEventSchema = z.object({
  version: z.literal(2),
  teamId: teamIdSchema,
  message: teamMessageSnapshotSchema,
}).strict();

/** Thân sự kiện `team/message/delivered` phiên bản hiện tại. */
const teamMessageDeliveredEventSchema = z.object({
  version: z.literal(2),
  teamId: teamIdSchema,
  messageId: teamMessageIdSchema,
  targetId: sessionIdSchema,
}).strict();

/**
 * Trạng thái Team hiện tại do danh tính Team bền chọn. MỖI sự kiện Team được áp đều tạo một đối tượng
 * trạng thái mới và chỉ thay đúng bộ sưu tập mà nó chạm; các bộ sưu tập còn lại GIỮ NGUYÊN tham chiếu.
 */
export interface TeamState {
  /** Danh tính Team — trùng danh tính Session gốc của Lead. */
  readonly id: TeamId;
  /** Roster bền theo thứ tự đã cam kết. */
  readonly members: readonly TeamMemberSnapshot[];
  /** Bảng việc bền, KỂ CẢ task đã xoá mềm (khung nhìn dây mới lọc chúng). */
  readonly tasks: readonly TeamTaskSnapshot[];
  /** Tin nhắn đã xếp hàng theo thứ tự cam kết. */
  readonly messages: readonly TeamMessageSnapshot[];
  /** Danh tính những tin đã được đích ghi nhận. */
  readonly delivered: readonly TeamMessageId[];
  /** Số thứ tự kế tiếp cho id task `task-<n>` do Team cấp. */
  readonly nextTaskNumber: number;
}

/**
 * Dựng trạng thái RỖNG cho một danh tính Team.
 * Nhận: `rootId` — danh tính Session gốc của Lead.
 * Trả: trạng thái Team rỗng (không thành viên, không task, không tin, chưa giao tin nào).
 */
export function emptyTeamState(rootId: SessionId): TeamProjectionState {
  return {
    id: toTeamId(rootId),
    members: [],
    tasks: [],
    messages: [],
    delivered: [],
    nextTaskNumber: 1,
  };
}

/**
 * Trạng thái an toàn cho checkpoint của Team do Session đang chiếu sở hữu.
 * Ánh xạ khoá `agentTeam` vào bảng trạng thái chiếu của kernel được khai theo CẤU TRÚC (chính kiểu
 * này), KHÔNG bằng `declare module`: một lần augment bảng của gói CÓ THẬT sẽ đè kiểu ở MỌI tệp.
 */
export interface TeamProjectionState extends TeamState {
  /** Câu lỗi của bản ghi bền bị từ chối ĐẦU TIÊN; có mặt thì trạng thái là CUỐI và không lái nữa. */
  readonly failure?: string;
}

/** Trạng thái trọn vẹn mà một dòng cache checkpoint phải mang, kèm lỗi chiếu tuỳ chọn. */
const teamProjectionEntrySchema: z.ZodType<TeamProjectionState> = z.object({
  id: teamIdSchema,
  members: z.array(teamMemberSnapshotSchema),
  tasks: z.array(teamTaskSnapshotSchema),
  messages: z.array(teamMessageSnapshotSchema),
  delivered: z.array(teamMessageIdSchema),
  nextTaskNumber: positiveSafeInteger,
  failure: z.string().optional(),
}).strict();

/** Bốn loại sự kiện thuộc miền Team. */
export type TeamEventType = 'team/member' | 'team/task' | 'team/message/queued' | 'team/message/delivered';

/**
 * Một sự kiện phiên thuộc miền Team — khai theo CẤU TRÚC: chỉ hai trường mà bộ chiếu này đọc.
 * Bản gốc dùng `SessionEvent<TeamEventType>`; bảng `SessionEventMap` của kernel KHÔNG được augment
 * (luật seam-cấu-trúc), nên hình dạng sự kiện Team được khai ngay tại đây.
 */
type TeamSessionEvent = {
  [K in TeamEventType]: {
    /** Loại sự kiện thuộc miền Team. */
    readonly type: K;
    /** Thân sự kiện CHƯA giải mã; `parseCurrentTeamEvent` mới kiểm rồi thay bằng giá trị đã kiểm. */
    readonly data: unknown;
  };
}[TeamEventType];

/** Một sự kiện phiên đã cam kết, khai theo CẤU TRÚC: chỉ phần phép chiếu này đọc. */
interface SessionEventLike {
  /** Loại sự kiện; bộ chiếu chỉ quan tâm bốn loại của miền Team. */
  readonly type: string;
  /** Thân sự kiện; do bộ chiếu tự diễn giải theo loại. */
  readonly data?: unknown;
}

/**
 * Kiểm một sự kiện phiên có thuộc miền Team hay không.
 * Nhận: `event` — sự kiện phiên đã cam kết (bất kỳ loại nào).
 * Trả: `true` khi loại sự kiện thuộc miền Team.
 */
export function isTeamEvent(event: SessionEventLike): event is TeamSessionEvent {
  return event.type === 'team/member'
    || event.type === 'team/task'
    || event.type === 'team/message/queued'
    || event.type === 'team/message/delivered';
}

/** Giải mã MỘT giá trị Team đã lưu và GIỮ lỗi schema làm nguyên nhân (cause). */
function parsePersisted<T>(type: string, schema: { parse(value: unknown): T }, value: unknown): T {
  try {
    return schema.parse(value);
  }
  catch (error) {
    throw new Error(`persisted Agent Teams ${type} payload is invalid`, { cause: error });
  }
}

/** Giải mã toàn bộ thân sự kiện Team phiên bản hiện tại theo đúng loại của nó. */
function parseCurrentTeamEvent(event: TeamSessionEvent) {
  switch (event.type) {
    case 'team/member':
      return { ...event, data: parsePersisted(event.type, teamMemberEventSchema, event.data) };
    case 'team/task':
      return { ...event, data: parsePersisted(event.type, teamTaskEventSchema, event.data) };
    case 'team/message/queued':
      return { ...event, data: parsePersisted(event.type, teamMessageQueuedEventSchema, event.data) };
    case 'team/message/delivered':
      return { ...event, data: parsePersisted(event.type, teamMessageDeliveredEventSchema, event.data) };
    /* v8 ignore next 2 -- TeamEventType is closed and every member is handled above. */
    default:
      return event;
  }
}

/** Một sự kiện Team ĐÃ giải mã theo phiên bản hiện tại (bốn nhánh của {@link TeamEventType}). */
type ParsedTeamEvent = ReturnType<typeof parseCurrentTeamEvent>;

/** Phép lái của sổ chiếu: sự kiện lạ trả CÙNG tham chiếu; lỗi bền đầu tiên thành trạng thái CUỐI. */
function applyProjectionEvent(state: TeamProjectionState, event: SessionEventLike): TeamProjectionState {
  if (state.failure !== undefined)
    return state;
  if (!isTeamEvent(event))
    return state;
  try {
    const selector = parsePersisted(event.type, teamEventSelectorSchema, event.data);
    if (selector.teamId !== state.id)
      return state;
    if (selector.version !== 2) {
      throw new Error(`unsupported Agent Teams event version ${String(selector.version)}`);
    }
    return applyCurrentTeamEvent(state, parseCurrentTeamEvent(event));
  }
  catch (error) {
    /* v8 ignore next -- the owned Team transition throws Error instances. */
    return { ...state, failure: error instanceof Error ? error.message : String(error) };
  }
}

/** Thay MỘT phần tử tại chỗ, hoặc NỐI vào cuối khi chỉ số âm — luôn trả mảng MỚI. */
function replaceAt<T>(items: readonly T[], index: number, item: T): T[] {
  const next = [...items];
  if (index < 0)
    next.push(item);
  else
    next[index] = item;
  return next;
}

/** Áp MỘT sự kiện Team đã giải mã vào trạng thái, kiểm mọi bất biến của miền. */
function applyCurrentTeamEvent(state: TeamProjectionState, event: ParsedTeamEvent): TeamProjectionState {
  switch (event.type) {
    case 'team/member': {
      const member = event.data.member;
      const index = state.members.findIndex(candidate => candidate.id === member.id);
      const prior = state.members[index];
      const named = state.members.find(candidate => candidate.name === member.name);
      if (named !== undefined && named.id !== member.id) {
        throw new Error(`teammate name "${member.name}" is reused by another member`);
      }
      if (prior === undefined) {
        if (member.phase !== 'provisioning')
          throw new Error(`teammate "${member.name}" must begin provisioning`);
      }
      else {
        if (prior.name !== member.name || prior.provider !== member.provider || prior.context !== member.context) {
          throw new Error(`teammate "${member.id}" changed immutable identity fields`);
        }
        if (prior.phase !== 'provisioning' || member.phase === 'provisioning') {
          throw new Error(`teammate "${member.name}" has an invalid ${prior.phase} -> ${member.phase} transition`);
        }
      }
      return { ...state, members: replaceAt(state.members, index, member) };
    }
    case 'team/task': {
      const task = event.data.task;
      const index = state.tasks.findIndex(candidate => candidate.id === task.id);
      const prior = state.tasks[index];
      if (prior === undefined && task.revision !== 1) {
        throw new Error(`team task "${task.id}" must begin at revision 1`);
      }
      if (prior !== undefined && task.revision !== prior.revision + 1) {
        throw new Error(`team task "${task.id}" revision is not contiguous`);
      }
      assertTaskGraphCandidate(state.tasks, task);
      let nextTaskNumber = state.nextTaskNumber;
      const match = numericTaskIdPattern.exec(task.id);
      if (match !== null) {
        const number = Number(match[1]);
        nextTaskNumber = Math.max(nextTaskNumber, number === Number.MAX_SAFE_INTEGER ? number : number + 1);
      }
      return { ...state, tasks: replaceAt(state.tasks, index, task), nextTaskNumber };
    }
    case 'team/message/queued': {
      const message = event.data.message;
      if (state.messages.some(candidate => candidate.id === message.id)) {
        throw new Error(`team message "${message.id}" was queued twice`);
      }
      return { ...state, messages: [...state.messages, message] };
    }
    case 'team/message/delivered': {
      const queued = state.messages.find(message => message.id === event.data.messageId);
      if (queued === undefined)
        throw new Error(`team message "${event.data.messageId}" was delivered before queueing`);
      if (queued.targetId !== event.data.targetId)
        throw new Error(`team message "${event.data.messageId}" target changed`);
      if (state.delivered.includes(event.data.messageId))
        throw new Error(`team message "${event.data.messageId}" was delivered twice`);
      return { ...state, delivered: [...state.delivered, event.data.messageId] };
    }
    /* v8 ignore next 2 -- TeamEventType is closed and every member is handled above. */
    default:
      return state;
  }
}

/** Một dòng roster trong khung nhìn dây (Lead luôn đứng đầu, luôn `active`). */
const teamMemberProjectionSchema = z.object({
  id: sessionIdSchema,
  name: z.string(),
  role: z.enum(['lead', 'teammate']),
  phase: z.enum(['provisioning', 'active', 'failed']),
  error: z.string().optional(),
}).strict();

/** Một dòng bảng việc trong khung nhìn dây (kèm tên chủ, cờ sẵn sàng, cảnh báo chồng lấn). */
const teamTaskViewSchema = z.object({
  id: teamTaskIdSchema,
  revision: positiveSafeInteger,
  subject: z.string(),
  description: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'deleted']),
  blockedBy: z.array(teamTaskIdSchema),
  writeScopes: z.array(z.string()),
  ownerName: z.string().optional(),
  ready: z.boolean(),
  writeScopeWarnings: z.array(z.string()),
}).strict();

/** Khung nhìn dây của `agentTeam`: roster + bảng việc chưa xoá + lỗi chiếu (nếu có). */
const teamProjectionSchema: z.ZodType<TeamProjection> = z.object({
  members: z.array(teamMemberProjectionSchema),
  tasks: z.array(teamTaskViewSchema),
  failure: z.string().optional(),
}).strict();

/** Khung nhìn Client được nhớ theo đúng hai bộ sưu tập đã sinh ra nó. */
const teamProjectionViews = new WeakMap<TeamProjectionState['members'], WeakMap<TeamProjectionState['tasks'], TeamProjection>>();

/** Dựng khung nhìn dây MỚI từ trạng thái hiện tại (không dùng cache). */
function buildTeamProjection(state: TeamProjectionState): TeamProjection {
  const rootId = brandString<SessionId>(state.id);
  const members: TeamProjection['members'][number][] = [{ id: rootId, name: 'lead', role: 'lead', phase: 'active' }];
  for (const member of state.members) {
    members.push({
      id: member.id,
      name: member.name,
      role: 'teammate',
      phase: member.phase,
      ...member.error === undefined ? {} : { error: member.error },
    });
  }
  return {
    members,
    tasks: state.tasks
      .filter(task => task.status !== 'deleted')
      .map(task => projectTaskView(state, task)),
    ...state.failure === undefined ? {} : { failure: state.failure },
  };
}

/**
 * Khung nhìn Client BỀN của một trạng thái Team. Thay đổi chỉ chạm hộp thư dùng lại tham chiếu khung
 * nhìn trước, nên lượt phát trực tiếp không công bố gì cho chúng. Lỗi là CUỐI: các sự kiện sau giữ
 * nguyên tham chiếu trạng thái đã hỏng và không phát lại khung nhìn của nó.
 * Nhận: `state` — trạng thái Team hiện tại.
 * Trả: roster và bảng việc chưa xoá, kèm lỗi chiếu nếu có.
 */
export function teamProjectionView(state: TeamProjectionState): TeamProjection {
  if (state.failure !== undefined)
    return buildTeamProjection(state);
  let byTasks = teamProjectionViews.get(state.members);
  if (byTasks === undefined) {
    byTasks = new WeakMap();
    teamProjectionViews.set(state.members, byTasks);
  }
  let view = byTasks.get(state.tasks);
  if (view === undefined) {
    view = buildTeamProjection(state);
    byTasks.set(state.tasks, view);
  }
  return view;
}

/**
 * Đơn vị chiếu `agentTeam` — đúng hình dạng mà sổ chiếu phiên của kernel gọi tới, khai theo CẤU TRÚC
 * để tệp này không augment hai bảng `SessionProjectionStateMap`/`SessionProjectionMap`.
 */
interface TeamProjectionDefinition {
  /** Khoá chiếu do đơn vị này sở hữu (nguyên văn). */
  readonly key: "agentTeam";
  /** Phiên bản làm mới kho checkpoint: tăng khi trường trạng thái hoặc luật lái đổi. */
  readonly stateVersion: number;
  /** Kiểm trạng thái đã lưu TRƯỚC khi mồi phép gộp. */
  readonly stateSchema: z.ZodType<TeamProjectionState>;
  /**
     * Trạng thái cho log rỗng và metadata phiên bất biến.
     * Nhận: `header` — metadata của phiên đang được chiếu.
     * Trả: trạng thái Team rỗng của phiên gốc.
     */
  readonly init: (header: SessionHeader) => TeamProjectionState;
  /**
     * Phép chuyển THUẦN: trạng thái trước + một sự kiện đã cam kết ⇒ trạng thái sau.
     * Nhận: `state` — trạng thái phủ mọi sự kiện trước; `event` — sự kiện phiên kế tiếp.
     * Trả: trạng thái kế (CÙNG tham chiếu khi sự kiện không thuộc miền Team).
     */
  readonly apply: (state: TeamProjectionState, event: SessionEventLike) => TeamProjectionState;
  /** Khung nhìn dây phát cho Client. */
  readonly wire: {
    /** Kiểm khung nhìn trước khi rời host. */
    readonly viewSchema: z.ZodType<TeamProjection>;
    /**
         * Chiếu trạng thái đã gộp thành khung nhìn dây.
         * Nhận: `state` — trạng thái Team hiện tại.
         * Trả: roster và bảng việc chưa xoá, kèm lỗi chiếu nếu có.
         */
    readonly view: (state: TeamProjectionState) => TeamProjection;
  };
}

/**
 * Đơn vị chiếu Team do danh tính Session đang chiếu chọn; khung nhìn dây CHỈ mang roster và trạng thái
 * bảng việc bền (không mang hộp thư).
 */
export const teamProjectionDefinition: TeamProjectionDefinition = {
  key: 'agentTeam',
  stateVersion: 4,
  stateSchema: teamProjectionEntrySchema,
  init: header => emptyTeamState(header.id),
  apply: applyProjectionEvent,
  wire: { viewSchema: teamProjectionSchema, view: teamProjectionView },
};
