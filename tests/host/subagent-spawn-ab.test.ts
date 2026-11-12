/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-subagent: hai Context cordis THẬT (A = bundle stock
 *      @deepseek-ai/dsh-subagent, B = lib/index.js của ta), cấp service nền (SessionStore thật của
 *      dsh-session + fake cấu trúc tối thiểu), spawn/fork THẬT qua provider đăng ký trong service,
 *      bắt đủ ba event provider-added · start · end để so từng field, và chứng minh chống trùng
 *      service/provider (plugin thứ hai cùng tên bị cordis từ chối).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** cordis kernel — đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const CORDIS = join(REPO, "apps/host/node_modules/@deepseek-ai/cordis/lib/index.js");
/** dsh-session kernel: SessionStore THẬT cho log cha lẫn Session của con. */
const SESSION = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-session/lib/index.js");
/** Bundle GỐC của seam (CHỈ ĐỌC) — bên A. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-subagent/lib/index.js");
/** Bản đã port — bên B. */
const OURS = join(REPO, "packages/host/subagent/lib/index.js");
/** Provider spawn đã convert, đăng ký qua service trên CẢ HAI runtime. */
const SPAWN = join(REPO, "packages/host/subagent-spawn-in-process/lib/index.js");
/** Provider fork đã convert, đăng ký qua service trên CẢ HAI runtime. */
const FORK = join(REPO, "packages/host/subagent-fork-in-process/lib/index.js");
/** Một khối nội dung model-visible. */
interface ContentBlock { type: string; text?: string }
/** Kết quả cuối của một activation. */
interface RunResult { output: ContentBlock[]; stopReason: string; structured?: unknown; diagnostic?: string }
/** Header phiên (tập con test đọc). */
interface SessionHeader {
  version: number;
  id: string;
  createdAt: number;
  cwd?: string;
  parentSession?: string;
  isSeeded?: boolean;
  origin?: string;
  delegationDepth?: number;
  agentPreset?: string;
}
/** Một sự kiện log phiên. */
interface SessionEvent { type: string; seq: number; time?: number; data?: unknown }
/** Header request cuối của phiên. */
interface RequestHeader { config?: { provider: string; model: string; reasoningEffort?: string } }
/** Session THẬT của dsh-session. */
interface SessionLike {
  readonly id: string;
  readonly seq: number;
  readonly header: SessionHeader;
  append(type: string, data?: unknown): unknown;
  snapshotEvents(offset?: number): SessionEvent[];
  requestHeader(): RequestHeader | undefined;
}
/** SessionStore THẬT. */
interface SessionStoreLike {
  create(id?: string, options?: { seed?: readonly SessionEvent[]; inheritedEventCount?: number; meta?: Record<string, unknown> }): SessionLike;
  get(id: string): SessionLike | undefined;
  flush(session: SessionLike): Promise<void> | void;
}
/** Inbox của Agent. */
interface InboxLike { nextStep: unknown[]; nextTurn: unknown[] }
/** Agent (thật hoặc fake cấu trúc) — tập con seam chạm tới. */
interface AgentLike {
  readonly id: string;
  readonly session: SessionLike;
  readonly ctx: RealContext;
  readonly options: Record<string, unknown>;
  readonly status: string;
  readonly inbox: InboxLike;
  followup(message: unknown): void;
  steer(message: unknown): void;
  inject(message: unknown): void;
  whenIdle(): Promise<void>;
  cancel(reason?: unknown): void;
  runMaintenance(operation: () => void): void;
}
/** Options manager đưa cho agents.create. */
interface CreateAgentOptions {
  readonly sessionId: string;
  readonly meta: Record<string, unknown>;
  readonly seed?: readonly SessionEvent[];
  readonly inheritedEventCount?: number;
  setup(childCtx: RealContext, child: AgentLike): Promise<void> | void;
}
/** Sổ agent fake cấu trúc. */
interface AgentsService {
  get(id: string): AgentLike | undefined;
  create?(options: CreateAgentOptions): Promise<{ agent: AgentLike; dispose(): Promise<void> }>;
}
/** Một lượt workingDirectory.set. */
interface WorkingDirectoryCall { agentId: string; cwd: string }
/** Dấu vết một con do fake agents.create dựng. */
interface ChildRecord { agent: AgentLike; session: SessionLike; prompts: unknown[]; disposeCalls: number }
/** Fiber của plugin cordis. */
interface PluginFiber extends PromiseLike<unknown> { readonly state: number }
/** Sổ runtime plugin của cordis. */
interface RegistryLike { values(): Iterable<{ readonly name: string }> }
/** Context cordis THẬT. */
interface RealContext {
  readonly sessions: SessionStoreLike;
  readonly registry: RegistryLike;
  readonly fiber: { dispose(): Promise<void> };
  get(name: string): unknown;
  provide(name: string, value: unknown): void;
  plugin(plugin: unknown, config?: unknown): PluginFiber;
  on(name: string, listener: (payload: unknown) => void): () => void;
}
/** Lớp plugin của một bên cài. */
interface PluginClass { new (ctx: RealContext, config: unknown): unknown }
/** Bề mặt module của seam. */
interface PluginApi { readonly default: PluginClass }
/** Bề mặt plugin provider đã convert. */
interface ProviderPlugin {
  readonly name: string;
  readonly inject: readonly string[];
  Config(value?: Record<string, unknown>): Record<string, unknown>;
  apply(ctx: RealContext, config: Record<string, unknown>): void;
}
/** Request provider nhận khi chuẩn bị con continuable. */
interface ContinuableCreateRequest { cwd: string; sessionId: string; parent: AgentLike; signal: AbortSignal }
/** Phần provider đóng góp khi tạo con continuable. */
interface ContinuableCreateSpec { seed?: readonly SessionEvent[] }
/** Request đã resolve mà provider external nhận. */
interface ResolvedStartRequest {
  cwd: string;
  label?: string;
  prompt: readonly ContentBlock[];
  parent: AgentLike;
  signal: AbortSignal;
}
/** Handle một run external. */
interface RunHandle { id: string; result: Promise<RunResult>; dispose(): Promise<void> }
/** Provider đăng ký qua service "subagents". */
interface ProviderLike {
  readonly name: string;
  readonly capabilities: Record<string, boolean>;
  readonly inheritsParentContext: boolean;
  start?(request: ResolvedStartRequest): Promise<RunHandle>;
  prepareContinuable?(request: ContinuableCreateRequest): Promise<ContinuableCreateSpec>;
}
/** Spec bắt đầu một activation. */
interface ActivationSpec {
  provider: string;
  label: string;
  childId?: string;
  request: {
    prompt: ContentBlock[];
    parent: AgentLike;
    cwd?: string;
    agentOptions?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    maxDepth?: number;
  };
  signal: AbortSignal;
  delivery: "parent" | "caller";
}
/** Activation đã được service chấp nhận. */
interface Activation {
  readonly childId: string;
  readonly messageId?: string;
  readonly result: Promise<RunResult>;
  dispose(): Promise<void>;
}
/** Service "subagents". */
interface SubagentService {
  readonly name: string;
  list(): string[];
  getProvider(name: string): ProviderLike | undefined;
  registerProvider(provider: ProviderLike): () => void;
  resolveMaxDepth(configured?: number | "provider-managed"): number | undefined;
  startActivation(spec: ActivationSpec): Promise<Activation>;
}
/** Tên ba event Lead yêu cầu bắt. */
type EventName = "subagent/provider-added" | "subagent/start" | "subagent/end";
/** Một event đã bắt, giữ payload NGUYÊN BẢN. */
interface CapturedEvent { name: EventName; payload: unknown }
/** Payload start/end (tập con). */
interface RunInfo {
  runId: string;
  provider: string;
  id: string;
  local: boolean;
  stopReason?: string;
  lastAssistantMessage?: unknown;
}
/** Dấu vết của MỘT bên cài trong một ca. */
interface Side {
  readonly api: PluginApi;
  readonly label: string;
  readonly ctx: RealContext;
  readonly service: SubagentService;
  readonly parent: AgentLike;
  readonly parentSession: SessionLike;
  readonly children: ChildRecord[];
  readonly events: CapturedEvent[];
  readonly workingDirectories: WorkingDirectoryCall[];
  readonly projections: unknown[];
  readonly systemPromptContexts: unknown[];
  readonly systemPromptSections: unknown[];
  readonly toolRestrictions: unknown[];
  readonly agentPresetCompositions: unknown[];
  readonly persistenceChecks: string[];
  readonly cwd: string;
}
/** Tuỳ chọn dựng một bên cho ca giới hạn đo được. */
interface BootOptions { agents?: "full" | "get-only" | "none" }
/** Kết quả đo của provider external giả. */
interface ExternalProbe { provider: ProviderLike; startCalls: ResolvedStartRequest[]; disposeCalls: () => number }
/** Tuỳ chọn chạy một activation. */
interface ActivateOptions { label: string; childId?: string }
/** Các Context đang sống — dọn sau mỗi ca. */
const LIVE: Side[] = [];
/** cordis kernel THẬT. */
const { Context } = (await import(CORDIS)) as unknown as { Context: new () => RealContext };
/** SessionStore THẬT của dsh-session. */
const { SessionStore } = (await import(SESSION)) as unknown as { SessionStore: new (ctx: RealContext) => unknown };
/** Bên A: bundle gốc trong kernel (CHỈ ĐỌC). */
const stock = (await import(STOCK)) as unknown as PluginApi;
/** Bên B: bản port đã build. */
const ours = (await import(OURS)) as unknown as PluginApi;
/** Provider spawn đã convert. */
const spawnPlugin = (await import(SPAWN)) as unknown as ProviderPlugin;
/** Provider fork đã convert. */
const forkPlugin = (await import(FORK)) as unknown as ProviderPlugin;
/**
 * Bắt thông điệp lỗi của một lượt gọi ĐỒNG BỘ.
 * Nhận: hàm có thể ném. Trả: thông điệp lỗi hoặc "KHONG NEM".
 */
function syncMessage(run: () => unknown): string {
  try {
    run();
    return "KHONG NEM";
  } catch (error) {
    return (error as Error).message;
  }
}
/**
 * Bắt thông điệp lỗi của một lượt gọi BẤT ĐỒNG BỘ.
 * Nhận: hàm trả thenable. Trả: thông điệp lỗi hoặc "KHONG NEM".
 */
async function rejectionOf(run: () => PromiseLike<unknown>): Promise<string> {
  try {
    await run();
    return "KHONG NEM";
  } catch (error) {
    return (error as Error).message;
  }
}
/**
 * Đếm runtime plugin SubagentRuntime trong sổ cordis.
 * Nhận: Context thật. Trả: số runtime (1 mới chứng minh service chỉ đăng ký một lần).
 */
function runtimeEntries(ctx: RealContext): number {
  let count = 0;
  for (const runtime of ctx.registry.values()) if (runtime.name === "SubagentRuntime") count += 1;
  return count;
}
/**
 * Dựng Agent cha đúng danh tính mà manager đối chiếu.
 * Nhận: Context + session thật. Trả: Agent cha tối thiểu.
 */
function makeParent(ctx: RealContext, session: SessionLike): AgentLike {
  return {
    id: "parent-1",
    session,
    ctx,
    options: {},
    status: "idle",
    inbox: { nextStep: [], nextTurn: [] },
    followup: () => undefined,
    steer: () => undefined,
    inject: () => undefined,
    whenIdle: async () => undefined,
    cancel: () => undefined,
    runMaintenance: (operation) => {
      operation();
    },
  };
}
/**
 * Dựng sổ agents fake: get đối chiếu danh tính, create dựng Session THẬT trong SessionStore.
 * Nhận: Context, cha, sổ con, chế độ thiếu create. Trả: AgentsService đúng hình dạng seam gọi.
 */
function makeAgents(
  ctx: RealContext,
  parent: AgentLike,
  children: ChildRecord[],
  mode: "full" | "get-only" | "none",
): AgentsService {
  const get = (id: string): AgentLike | undefined => {
    if (id === parent.id) return parent;
    return children.find((record) => record.agent.id === id)?.agent;
  };
  if (mode !== "full") return { get };
  return {
    get,
    async create(options: CreateAgentOptions): Promise<{ agent: AgentLike; dispose(): Promise<void> }> {
      const session = ctx.sessions.create(options.sessionId, {
        ...(options.seed === undefined ? {} : { seed: options.seed }),
        ...(options.inheritedEventCount === undefined ? {} : { inheritedEventCount: options.inheritedEventCount }),
        meta: options.meta,
      });
      const prompts: unknown[] = [];
      const runTurn = (): void => {
        session.append("turn/start", {});
        session.append("turn/end", { reason: { kind: "completed" } });
      };
      const child: AgentLike = {
        id: options.sessionId,
        session,
        ctx,
        options: {},
        status: "running",
        inbox: { nextStep: [], nextTurn: [] },
        followup: (message) => {
          prompts.push(message);
          runTurn();
        },
        steer: (message) => {
          prompts.push(message);
          runTurn();
        },
        inject: (message) => {
          prompts.push(message);
        },
        whenIdle: async () => undefined,
        cancel: () => undefined,
        runMaintenance: (operation) => {
          operation();
        },
      };
      const record: ChildRecord = { agent: child, session, prompts, disposeCalls: 0 };
      children.push(record);
      await options.setup(ctx, child);
      return {
        agent: child,
        dispose: async () => {
          record.disposeCalls += 1;
        },
      };
    },
  };
}
/**
 * Dựng MỘT bên cài trên Context cordis THẬT, cấp đủ service nền và mount seam.
 * Nhận: bề mặt module, nhãn, chế độ agents. Trả: Side sẵn sàng đăng ký provider.
 */
async function boot(api: PluginApi, label: string, options: BootOptions = {}): Promise<Side> {
  const ctx = new Context();
  new SessionStore(ctx);
  const cwd = tmpdir();
  const parentSession = ctx.sessions.create("parent-1", { meta: { cwd } });
  const children: ChildRecord[] = [];
  const workingDirectories: WorkingDirectoryCall[] = [];
  const projections: unknown[] = [];
  const systemPromptContexts: unknown[] = [];
  const systemPromptSections: unknown[] = [];
  const toolRestrictions: unknown[] = [];
  const agentPresetCompositions: unknown[] = [];
  const persistenceChecks: string[] = [];
  const parent = makeParent(ctx, parentSession);
  const agents = makeAgents(ctx, parent, children, options.agents ?? "full");
  ctx.provide("workingDirectory", {
    ensure: async (_agent: AgentLike, _signal: AbortSignal): Promise<string> => cwd,
    set: async (agent: AgentLike, directory: string, _signal: AbortSignal): Promise<void> => {
      workingDirectories.push({ agentId: agent.id, cwd: directory });
    },
  });
  if (options.agents !== "none") ctx.provide("agents", agents);
  ctx.provide("sessionProjections", {
    register: (definition: unknown): (() => void) => {
      projections.push(definition);
      return () => undefined;
    },
  });
  ctx.provide("systemPrompt", {
    context: (entry: unknown): void => {
      systemPromptContexts.push(entry);
    },
    section: (entry: unknown): void => {
      systemPromptSections.push(entry);
    },
    getContextOrder: (_name: string): number => 1,
    getSectionOrder: (_name: string): number => 1,
  });
  ctx.provide("agentPresets", {
    composedPreset: (_ctx: RealContext): undefined => undefined,
    composeFrom: (_child: RealContext, _parent: RealContext): void => {
      agentPresetCompositions.push("composeFrom");
    },
    mount: async (_child: RealContext, _preset: string): Promise<void> => {
      agentPresetCompositions.push("mount");
    },
  });
  ctx.provide("tools", {
    get: (_name: string, _scope?: unknown): undefined => undefined,
    restrict: (filter: unknown): void => {
      toolRestrictions.push(filter);
    },
  });
  ctx.provide("llm", {
    resolveModelInfo: async (_provider: string, _model: string, _signal: AbortSignal): Promise<Record<string, unknown>> => ({
      inputModalities: ["text", "image"],
    }),
  });
  ctx.provide("sandbox", {});
  ctx.provide("approval", {});
  ctx.provide("workspace", {});
  ctx.provide("attachment", {});
  ctx.provide("sandboxPolicy", { overrideOf: (_session: SessionLike): undefined => undefined });
  ctx.provide("permissionPresets", { current: (_session: SessionLike): undefined => undefined });
  ctx.provide("sessionPersistence", {
    stat: async (id: string, _options?: { signal?: AbortSignal }): Promise<undefined> => {
      persistenceChecks.push(id);
      return undefined;
    },
  });
  ctx.provide("sessionQuery", {
    observeSession: async (_id: string, _options?: { signal?: AbortSignal }): Promise<never> => {
      throw new Error("ca này không đọc sessionQuery");
    },
  });
  await ctx.plugin(api.default, {});
  const service = ctx.get("subagents") as SubagentService | undefined;
  if (service === undefined) throw new Error("Context khong cap ctx.subagents");
  const events: CapturedEvent[] = [];
  const capture = (name: EventName) => (payload: unknown): void => {
    events.push({ name, payload });
  };
  ctx.on("subagent/provider-added", capture("subagent/provider-added"));
  ctx.on("subagent/start", capture("subagent/start"));
  ctx.on("subagent/end", capture("subagent/end"));
  const side: Side = {
    api,
    label,
    ctx,
    service,
    parent,
    parentSession,
    children,
    events,
    workingDirectories,
    projections,
    systemPromptContexts,
    systemPromptSections,
    toolRestrictions,
    agentPresetCompositions,
    persistenceChecks,
    cwd,
  };
  LIVE.push(side);
  return side;
}
/**
 * Dựng provider external giả chạy được start -> result -> dispose.
 * Nhận: id con cố định + chữ message cuối. Trả: probe kèm dấu vết lượt gọi.
 */
function externalProvider(id: string, text: string): ExternalProbe {
  const startCalls: ResolvedStartRequest[] = [];
  let disposals = 0;
  const provider: ProviderLike = {
    name: "spawn-external",
    capabilities: { agentOptions: true, agentPreset: true, outputSchema: true, depthLimit: true },
    inheritsParentContext: false,
    async start(request: ResolvedStartRequest): Promise<RunHandle> {
      startCalls.push(request);
      return {
        id,
        result: Promise.resolve({ output: [{ type: "text", text }], stopReason: "completed" }),
        dispose: async () => {
          disposals += 1;
        },
      };
    },
  };
  return { provider, startCalls, disposeCalls: () => disposals };
}
/**
 * Dựng spec activation cho một side.
 * Nhận: side, provider, nhãn, id con giữ chỗ tuỳ chọn. Trả: spec đủ trường bắt buộc.
 */
function activationSpec(side: Side, provider: string, label: string, childId?: string): ActivationSpec {
  return {
    provider,
    label,
    ...(childId === undefined ? {} : { childId }),
    request: { prompt: [{ type: "text", text: "làm việc" }], parent: side.parent },
    signal: new AbortController().signal,
    delivery: "caller",
  };
}
/**
 * Chạy MỘT activation thật và chờ kết quả cuối.
 * Nhận: side, provider, nhãn/id con. Trả: activation + result đã settle.
 */
async function activate(
  side: Side,
  provider: string,
  options: ActivateOptions,
): Promise<{ activation: Activation; result: RunResult }> {
  const activation = await side.service.startActivation(
    activationSpec(side, provider, options.label, options.childId),
  );
  const result = await activation.result;
  return { activation, result };
}
/**
 * Hình dạng payload provider-added.
 * Nhận: payload event. Trả: record để so A/B.
 */
function providerShape(payload: unknown): Record<string, unknown> {
  const provider = payload as ProviderLike;
  return {
    name: provider.name,
    capabilities: provider.capabilities,
    inheritsParentContext: provider.inheritsParentContext,
    ownKeys: Object.keys(provider).sort(),
    prototypeKeys: Object.getOwnPropertyNames(Object.getPrototypeOf(provider)).sort(),
    start: typeof provider.start,
    prepareContinuable: typeof provider.prepareContinuable,
  };
}
/**
 * Hình dạng payload start/end; runId chỉ so KIỂU vì nó ngẫu nhiên.
 * Nhận: event start/end. Trả: record để so A/B.
 */
function runShape(event: CapturedEvent): Record<string, unknown> {
  const info = event.payload as RunInfo;
  return {
    name: event.name,
    keys: Object.keys(info).sort(),
    provider: info.provider,
    local: info.local,
    id: info.id,
    runIdType: typeof info.runId,
    ...(event.name === "subagent/end"
      ? {
          stopReason: info.stopReason,
          hasLastAssistantMessage: Object.hasOwn(info, "lastAssistantMessage"),
          lastAssistantMessage: info.lastAssistantMessage,
        }
      : {}),
  };
}
/**
 * Rút hình dạng CẢ ba event theo đúng thứ tự.
 * Nhận: mảng event. Trả: mảng record để so A/B.
 */
function eventShapes(events: CapturedEvent[]): Record<string, unknown>[] {
  return events.map((event) =>
    event.name === "subagent/provider-added" ? providerShape(event.payload) : runShape(event),
  );
}
/**
 * Chuẩn hoá dữ liệu sự kiện: bỏ thời điểm, thay childId/timestamp ngẫu nhiên.
 * Nhận: dữ liệu event. Trả: bản sao thuần JSON đã chuẩn hoá.
 */
function normalizeData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item: unknown) => normalizeData(item));
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (key === "childId") out[key] = "<child>";
      else if (key === "childCreatedAt") out[key] = 0;
      else out[key] = normalizeData(item);
    }
    return out;
  }
  return value;
}
/**
 * Chuẩn hoá một sự kiện phiên.
 * Nhận: sự kiện thật. Trả: record bỏ time, giữ type/seq/data.
 */
function normalizeEvent(event: SessionEvent): Record<string, unknown> {
  return { type: event.type, seq: event.seq, data: normalizeData(event.data) };
}
/**
 * Chuẩn hoá header con.
 * Nhận: header phiên con. Trả: record bỏ id/thời điểm ngẫu nhiên.
 */
function childHeaderShape(header: SessionHeader): Record<string, unknown> {
  return { ...header, id: "<child>", createdAt: 0 };
}
/**
 * Rút hình dạng message đã giao cho con.
 * Nhận: message manager dựng. Trả: record bỏ message id ngẫu nhiên.
 */
function messageShape(message: unknown): Record<string, unknown> {
  const value = message as { content?: unknown; source?: unknown };
  return { id: "<message>", content: value.content, source: value.source };
}
/**
 * Rút hình dạng projection definition.
 * Nhận: mảng definition. Trả: mảng {key, stateVersion}.
 */
function projectionShapes(projections: unknown[]): Record<string, unknown>[] {
  return projections.map((projection) => {
    const definition = projection as { key?: unknown; stateVersion?: unknown };
    return { key: definition.key, stateVersion: definition.stateVersion };
  });
}
/**
 * Lấy catalog con cuối trong log cha.
 * Nhận: session cha. Trả: data subagent/catalog. Ném khi cha chưa ghi catalog.
 */
function catalogOf(session: SessionLike): Record<string, unknown> {
  const event = session.snapshotEvents().filter((item) => item.type === "subagent/catalog").at(-1);
  if (event === undefined) throw new Error("khong co subagent/catalog trong log cha");
  return event.data as Record<string, unknown>;
}
/**
 * Rút TOÀN BỘ state quan sát được của một ca local.
 * Nhận: side + dấu vết con. Trả: record đã chuẩn hoá để so A/B.
 */
function localState(side: Side, child: ChildRecord): Record<string, unknown> {
  return {
    providers: side.service.list(),
    maxDepth: side.service.resolveMaxDepth(),
    childHeader: childHeaderShape(child.session.header),
    childLog: child.session.snapshotEvents().map(normalizeEvent),
    parentLog: side.parentSession.snapshotEvents().map(normalizeEvent),
    prompts: child.prompts.map(messageShape),
    disposeCalls: child.disposeCalls,
    workingDirectories: side.workingDirectories,
    projections: projectionShapes(side.projections),
    systemPromptContexts: side.systemPromptContexts,
    systemPromptSections: side.systemPromptSections,
    agentPresetCompositions: side.agentPresetCompositions,
    toolRestrictions: side.toolRestrictions,
    persistenceChecks: side.persistenceChecks,
  };
}
/**
 * Rút hình dạng request external.
 * Nhận: request đã resolve. Trả: record bỏ danh tính signal/cha.
 */
function requestShape(request: ResolvedStartRequest): Record<string, unknown> {
  return {
    cwd: request.cwd,
    label: request.label,
    prompt: request.prompt,
    parentId: request.parent.id,
    aborted: request.signal.aborted,
  };
}
/** Dọn mọi Context còn sống sau mỗi ca — tránh fiber/session rò sang ca sau. */
afterEach(async (): Promise<void> => {
  while (LIVE.length > 0) {
    const side = LIVE.pop();
    if (side === undefined) continue;
    try {
      await side.ctx.fiber.dispose();
    } catch {
      // Context đã đóng ở ca trước — dọn lần hai vô hại.
    }
  }
});
describe("CHỐNG TRÙNG SERVICE — Context B dựng đúng MỘT lần", () => {
  test("ctx.subagents có đúng một runtime; plugin thứ hai bị cordis từ chối 'has been registered'", async () => {
    const side = await boot(ours, "B");
    expect(side.service.name).toBe("subagents");
    expect(side.service.list()).toEqual([]);
    expect(runtimeEntries(side.ctx)).toBe(1);
    // Mount LẦN HAI cùng lớp plugin ⇒ cordis từ chối vì service "subagents" đã có chủ.
    const message = await rejectionOf(() => side.ctx.plugin(ours.default, {}));
    expect(message).toContain('service "subagents" has been registered');
    expect(message).toContain("<SubagentRuntime>");
    expect(runtimeEntries(side.ctx)).toBe(1);
    expect(side.service.list()).toEqual([]);
    // Service cũ vẫn là nơi DUY NHẤT giữ provider: đăng ký trùng tên bị từ chối.
    const probe = externalProvider("external-duplicate", "x");
    side.service.registerProvider(probe.provider);
    expect(side.service.list()).toEqual(["spawn-external"]);
    expect(syncMessage(() => side.service.registerProvider(probe.provider))).toBe(
      'a subagent provider named "spawn-external" is already registered',
    );
    expect(side.service.list()).toEqual(["spawn-external"]);
    expect(runtimeEntries(side.ctx)).toBe(1);
  });
  test("A stock từ chối plugin thứ hai y hệt B: cùng thông điệp cordis, cùng số runtime", async () => {
    const a = await boot(stock, "A");
    const b = await boot(ours, "B");
    const messageA = await rejectionOf(() => a.ctx.plugin(stock.default, {}));
    const messageB = await rejectionOf(() => b.ctx.plugin(ours.default, {}));
    expect(messageA).toBe(messageB);
    expect(messageA).toContain('service "subagents" has been registered');
    expect(runtimeEntries(a.ctx)).toBe(1);
    expect(runtimeEntries(b.ctx)).toBe(1);
    expect(a.service.list()).toEqual([]);
    expect(b.service.list()).toEqual([]);
  });
});
describe("SPAWN THẬT — provider external chạy start -> result -> end", () => {
  test("A stock vs B ta: cùng result/stopReason/state; provider thật sự chạy và dispose", async () => {
    const a = await boot(stock, "A");
    const b = await boot(ours, "B");
    const probeA = externalProvider("child-external-1", "đã xong");
    const probeB = externalProvider("child-external-1", "đã xong");
    a.service.registerProvider(probeA.provider);
    b.service.registerProvider(probeB.provider);
    const runA = await activate(a, "spawn-external", { label: "việc-ngoài" });
    const runB = await activate(b, "spawn-external", { label: "việc-ngoài" });
    expect(runA.result).toEqual({ output: [{ type: "text", text: "đã xong" }], stopReason: "completed" });
    expect(runB.result).toEqual(runA.result);
    expect(runA.activation.childId).toBe("child-external-1");
    expect(runB.activation.childId).toBe("child-external-1");
    // Provider THẬT SỰ được gọi một lần và handle được dispose một lần.
    expect(probeA.startCalls).toHaveLength(1);
    expect(probeB.startCalls).toHaveLength(1);
    expect(probeA.disposeCalls()).toBe(1);
    expect(probeB.disposeCalls()).toBe(1);
    expect(requestShape(probeA.startCalls[0]!)).toEqual(requestShape(probeB.startCalls[0]!));
    expect(probeA.startCalls[0]!.cwd).toBe(a.cwd);
    expect(probeA.startCalls[0]!.prompt).toEqual([{ type: "text", text: "làm việc" }]);
    expect(probeA.startCalls[0]!.signal).toBeInstanceOf(AbortSignal);
    expect(a.service.list()).toEqual(["spawn-external"]);
    expect(b.service.list()).toEqual(["spawn-external"]);
    expect(a.service.getProvider("spawn-external")?.name).toBe("spawn-external");
    expect(b.service.getProvider("spawn-external")?.name).toBe("spawn-external");
    expect(a.service.resolveMaxDepth()).toBe(1);
    expect(b.service.resolveMaxDepth()).toBe(1);
    expect(a.service.resolveMaxDepth("provider-managed")).toBeUndefined();
    expect(b.service.resolveMaxDepth("provider-managed")).toBeUndefined();
    // delivery="caller" ⇒ external KHÔNG ghi catalog vào log cha.
    expect(a.parentSession.snapshotEvents()).toEqual([]);
    expect(b.parentSession.snapshotEvents()).toEqual([]);
  });
  test("BẮT đủ 3 event provider-added · start · end — payload từng field A vs B", async () => {
    const a = await boot(stock, "A");
    const b = await boot(ours, "B");
    const probeA = externalProvider("child-external-2", "kết quả");
    const probeB = externalProvider("child-external-2", "kết quả");
    a.service.registerProvider(probeA.provider);
    b.service.registerProvider(probeB.provider);
    const runA = await activate(a, "spawn-external", { label: "việc-ngoài" });
    const runB = await activate(b, "spawn-external", { label: "việc-ngoài" });
    const expected = ["subagent/provider-added", "subagent/start", "subagent/end"];
    expect<string[]>(a.events.map((event) => event.name)).toEqual(expected);
    expect<string[]>(b.events.map((event) => event.name)).toEqual(expected);
    expect(eventShapes(a.events)).toEqual(eventShapes(b.events));
    expect(a.events[0]!.payload).toBe(probeA.provider);
    expect(b.events[0]!.payload).toBe(probeB.provider);
    const addedA = a.events[0]!.payload as ProviderLike;
    expect(addedA.name).toBe("spawn-external");
    expect(addedA.capabilities).toEqual({
      agentOptions: true,
      agentPreset: true,
      outputSchema: true,
      depthLimit: true,
    });
    expect(addedA.inheritsParentContext).toBe(false);
    expect(typeof addedA.start).toBe("function");
    expect(addedA.prepareContinuable).toBeUndefined();
    const startA = a.events[1]!.payload as RunInfo;
    const endA = a.events[2]!.payload as RunInfo;
    expect(startA.runId).toBe(endA.runId);
    expect(startA.id).toBe(endA.id);
    expect(startA.id).toBe(runA.activation.childId);
    expect(startA.id).toBe(runB.activation.childId);
    expect(startA.provider).toBe("spawn-external");
    expect(startA.local).toBe(false);
    expect(Object.keys(startA).sort()).toEqual(["id", "local", "provider", "runId"]);
    expect(Object.keys(endA).sort()).toEqual([
      "id",
      "lastAssistantMessage",
      "local",
      "provider",
      "runId",
      "stopReason",
    ]);
    expect(endA.stopReason).toBe("completed");
    expect(endA.lastAssistantMessage).toEqual([{ type: "text", text: "kết quả" }]);
  });
});
describe("SPAWN CỤC BỘ — provider THẬT subagent-spawn-in-process (local activation)", () => {
  test("con trong SessionStore THẬT, KHÔNG seed, chạy hết; 3 event local + state A vs B", async () => {
    const a = await boot(stock, "A");
    const b = await boot(ours, "B");
    spawnPlugin.apply(a.ctx, spawnPlugin.Config({}));
    spawnPlugin.apply(b.ctx, spawnPlugin.Config({}));
    expect(a.service.list()).toEqual(["spawn"]);
    expect(b.service.list()).toEqual(["spawn"]);
    const runA = await activate(a, "spawn", { label: "việc-spawn", childId: "child-spawn-1" });
    const runB = await activate(b, "spawn", { label: "việc-spawn", childId: "child-spawn-1" });
    expect(runA.result).toEqual({ output: [], stopReason: "completed" });
    expect(runB.result).toEqual(runA.result);
    expect(runA.activation.childId).toBe("child-spawn-1");
    expect(runB.activation.childId).toBe("child-spawn-1");
    const childA = a.children[0]!;
    const childB = b.children[0]!;
    expect(childA.session.header.isSeeded).toBe(false);
    expect(childA.session.header.parentSession).toBe("parent-1");
    expect(childA.session.header.origin).toBe("subagent");
    expect(childA.session.header.delegationDepth).toBe(1);
    expect(childA.session.header.cwd).toBe(a.cwd);
    expect(childB.session.header.isSeeded).toBe(false);
    expect(childB.session.header.parentSession).toBe("parent-1");
    // Prompt đầu là message THẬT do dsh-llm dựng, và con đã "chạy" một turn.
    expect(childA.prompts).toHaveLength(1);
    const prompt = childA.prompts[0] as { id?: unknown; content?: unknown; source?: { kind?: unknown } };
    expect(typeof prompt.id).toBe("string");
    expect(prompt.content).toEqual([{ type: "text", text: "làm việc" }]);
    expect(prompt.source?.kind).toBe("user");
    expect(childA.disposeCalls).toBe(1);
    expect(childA.session.snapshotEvents().map((event) => event.type)).toEqual([
      "subagent/descriptor",
      "approval/policy",
      "turn/start",
      "turn/end",
    ]);
    expect(childA.session.snapshotEvents()[0]!.data).toEqual({
      version: 3,
      mode: "continuable",
      provider: "spawn",
      label: "việc-spawn",
    });
    // Con được gán thư mục và manager đã kiểm id giữ chỗ qua sessionPersistence.stat.
    expect(a.workingDirectories).toEqual([{ agentId: "child-spawn-1", cwd: a.cwd }]);
    expect(a.persistenceChecks).toEqual(["child-spawn-1"]);
    expect(b.workingDirectories).toEqual([{ agentId: "child-spawn-1", cwd: b.cwd }]);
    expect(b.persistenceChecks).toEqual(["child-spawn-1"]);
    const catalogA = catalogOf(a.parentSession);
    expect(catalogA.version).toBe(0);
    expect(catalogA.mode).toBe("continuable");
    expect(catalogA.label).toBe("việc-spawn");
    expect(catalogA.childId).toBe("child-spawn-1");
    const catalogB = catalogOf(b.parentSession);
    expect({ ...catalogB, childCreatedAt: 0 }).toEqual({ ...catalogA, childCreatedAt: 0 });
    expect(projectionShapes(a.projections)).toHaveLength(3);
    expect(projectionShapes(b.projections)).toEqual(projectionShapes(a.projections));
    expect(a.agentPresetCompositions).toEqual(["composeFrom"]);
    expect(b.agentPresetCompositions).toEqual(["composeFrom"]);
    // 3 event: provider-added · start · end — payload từng field A vs B.
    const expected = ["subagent/provider-added", "subagent/start", "subagent/end"];
    expect<string[]>(a.events.map((event) => event.name)).toEqual(expected);
    expect<string[]>(b.events.map((event) => event.name)).toEqual(expected);
    expect(eventShapes(a.events)).toEqual(eventShapes(b.events));
    const added = a.events[0]!.payload as ProviderLike;
    expect(added.name).toBe("spawn");
    expect(added.inheritsParentContext).toBe(false);
    expect(typeof added.prepareContinuable).toBe("function");
    expect(typeof added.start).toBe("undefined");
    const start = a.events[1]!.payload as RunInfo;
    const end = a.events[2]!.payload as RunInfo;
    expect(start.local).toBe(true);
    expect(start.provider).toBe("spawn");
    expect(start.id).toBe("child-spawn-1");
    expect(start.runId).toBe(end.runId);
    expect(start.id).toBe(end.id);
    expect(Object.keys(start).sort()).toEqual(["id", "local", "provider", "runId"]);
    expect(Object.keys(end).sort()).toEqual(["id", "local", "provider", "runId", "stopReason"]);
    expect(end.local).toBe(true);
    expect(end.stopReason).toBe("completed");
    expect(Object.hasOwn(end, "lastAssistantMessage")).toBe(false);
    // So TOÀN BỘ state quan sát được giữa hai runtime.
    expect(localState(a, childA)).toEqual(localState(b, childB));
  });
});
describe("FORK THẬT — provider THẬT subagent-fork-in-process (seed tiền tố lượt đã xong)", () => {
  test("fork mang seed của cha, con isSeeded; 3 event local + state A vs B", async () => {
    const a = await boot(stock, "A");
    const b = await boot(ours, "B");
    for (const side of [a, b]) {
      side.parentSession.append("turn/start", {});
      side.parentSession.append("turn/end", { reason: { kind: "completed" } });
    }
    forkPlugin.apply(a.ctx, forkPlugin.Config({}));
    forkPlugin.apply(b.ctx, forkPlugin.Config({}));
    expect(a.service.list()).toEqual(["fork"]);
    expect(b.service.list()).toEqual(["fork"]);
    const runA = await activate(a, "fork", { label: "việc-fork", childId: "child-fork-1" });
    const runB = await activate(b, "fork", { label: "việc-fork", childId: "child-fork-1" });
    expect(runA.result).toEqual({ output: [], stopReason: "completed" });
    expect(runB.result).toEqual(runA.result);
    const childA = a.children[0]!;
    const childB = b.children[0]!;
    expect(childA.session.header.isSeeded).toBe(true);
    expect(childA.session.header.parentSession).toBe("parent-1");
    expect(childA.session.header.delegationDepth).toBe(1);
    expect(childB.session.header.isSeeded).toBe(true);
    expect(childB.session.header.parentSession).toBe("parent-1");
    // Tiền tố log con BẰNG ĐÚNG tiền tố lượt đã xong của cha, rồi mới tới biên seed.
    const parentPrefixA = a.parentSession.snapshotEvents().slice(0, 2).map(normalizeEvent);
    expect(childA.session.snapshotEvents().slice(0, 2).map(normalizeEvent)).toEqual(parentPrefixA);
    expect(childA.session.snapshotEvents().map((event) => event.type)).toEqual([
      "turn/start",
      "turn/end",
      "session/end-seed",
      "subagent/descriptor",
      "approval/policy",
      "turn/start",
      "turn/end",
    ]);
    const endSeed = childA.session.snapshotEvents()[2]!;
    expect(endSeed.type).toBe("session/end-seed");
    expect(endSeed.data).toEqual({ inherited: true });
    expect(childA.session.snapshotEvents()[3]!.data).toEqual({
      version: 3,
      mode: "continuable",
      provider: "fork",
      label: "việc-fork",
    });
    const catalogA = catalogOf(a.parentSession);
    expect(catalogA.mode).toBe("continuable");
    expect(catalogA.label).toBe("việc-fork");
    expect(catalogA.childId).toBe("child-fork-1");
    const catalogB = catalogOf(b.parentSession);
    expect({ ...catalogB, childCreatedAt: 0 }).toEqual({ ...catalogA, childCreatedAt: 0 });
    expect(childA.disposeCalls).toBe(1);
    expect(childA.prompts).toHaveLength(1);
    // 3 event: provider-added · start · end — payload từng field A vs B.
    const expected = ["subagent/provider-added", "subagent/start", "subagent/end"];
    expect<string[]>(a.events.map((event) => event.name)).toEqual(expected);
    expect<string[]>(b.events.map((event) => event.name)).toEqual(expected);
    expect(eventShapes(a.events)).toEqual(eventShapes(b.events));
    const added = a.events[0]!.payload as ProviderLike;
    expect(added.name).toBe("fork");
    expect(added.inheritsParentContext).toBe(true);
    expect(typeof added.prepareContinuable).toBe("function");
    expect(typeof added.start).toBe("undefined");
    const start = a.events[1]!.payload as RunInfo;
    const end = a.events[2]!.payload as RunInfo;
    expect(start.local).toBe(true);
    expect(start.provider).toBe("fork");
    expect(start.id).toBe("child-fork-1");
    expect(start.runId).toBe(end.runId);
    expect(start.id).toBe(end.id);
    expect(end.local).toBe(true);
    expect(end.stopReason).toBe("completed");
    expect(Object.hasOwn(end, "lastAssistantMessage")).toBe(false);
    expect(localState(a, childA)).toEqual(localState(b, childB));
  });
});
describe("ĐỐI CHỨNG CHÉO — spawn và fork trên CÙNG runtime", () => {
  test("fork mang seed, spawn thì không; A và B cho cùng hai log con", async () => {
    const a = await boot(stock, "A");
    const b = await boot(ours, "B");
    for (const side of [a, b]) {
      side.parentSession.append("turn/start", {});
      side.parentSession.append("turn/end", { reason: { kind: "completed" } });
    }
    spawnPlugin.apply(a.ctx, spawnPlugin.Config({}));
    spawnPlugin.apply(b.ctx, spawnPlugin.Config({}));
    forkPlugin.apply(a.ctx, forkPlugin.Config({}));
    forkPlugin.apply(b.ctx, forkPlugin.Config({}));
    expect(a.service.list()).toEqual(["spawn", "fork"]);
    expect(b.service.list()).toEqual(["spawn", "fork"]);
    await activate(a, "spawn", { label: "viec-spawn", childId: "child-spawn-3" });
    await activate(a, "fork", { label: "viec-fork", childId: "child-fork-3" });
    await activate(b, "spawn", { label: "viec-spawn", childId: "child-spawn-3" });
    await activate(b, "fork", { label: "viec-fork", childId: "child-fork-3" });
    const spawnA = a.children[0]!;
    const forkA = a.children[1]!;
    const spawnB = b.children[0]!;
    const forkB = b.children[1]!;
    expect(spawnA.session.snapshotEvents()[0]!.type).toBe("subagent/descriptor");
    expect(spawnA.session.snapshotEvents().map((event) => event.type)).not.toContain("session/end-seed");
    expect(forkA.session.snapshotEvents()[0]!.type).toBe("turn/start");
    expect(forkA.session.snapshotEvents().map((event) => event.type)).toContain("session/end-seed");
    expect(forkA.session.seq).toBeGreaterThan(spawnA.session.seq);
    expect(spawnA.session.header.isSeeded).toBe(false);
    expect(forkA.session.header.isSeeded).toBe(true);
    expect(spawnA.session.snapshotEvents().map(normalizeEvent)).toEqual(
      spawnB.session.snapshotEvents().map(normalizeEvent),
    );
    expect(forkA.session.snapshotEvents().map(normalizeEvent)).toEqual(
      forkB.session.snapshotEvents().map(normalizeEvent),
    );
    expect(localState(a, spawnA)).toEqual(localState(b, spawnB));
    expect(localState(a, forkA)).toEqual(localState(b, forkB));
  });
});
describe("GIỚI HẠN ĐO ĐƯỢC — local activation cần agents.create (không bỏ qua spawn thật)", () => {
  test("thiếu service agents ⇒ CONTINUATION_UNAVAILABLE; chỉ có get ⇒ TypeError agents.create", async () => {
    const withoutA = await boot(stock, "A", { agents: "none" });
    const withoutB = await boot(ours, "B", { agents: "none" });
    forkPlugin.apply(withoutA.ctx, forkPlugin.Config({}));
    forkPlugin.apply(withoutB.ctx, forkPlugin.Config({}));
    const missingA = await rejectionOf(() => withoutA.service.startActivation(activationSpec(withoutA, "fork", "việc")));
    const missingB = await rejectionOf(() => withoutB.service.startActivation(activationSpec(withoutB, "fork", "việc")));
    expect(missingA).toBe("continuable subagents require the agents service");
    expect(missingB).toBe(missingA);
    const getOnlyA = await boot(stock, "A", { agents: "get-only" });
    const getOnlyB = await boot(ours, "B", { agents: "get-only" });
    forkPlugin.apply(getOnlyA.ctx, forkPlugin.Config({}));
    forkPlugin.apply(getOnlyB.ctx, forkPlugin.Config({}));
    const createA = await rejectionOf(() => getOnlyA.service.startActivation(activationSpec(getOnlyA, "fork", "việc")));
    const createB = await rejectionOf(() => getOnlyB.service.startActivation(activationSpec(getOnlyB, "fork", "việc")));
    // Tên biến nội bộ bundle khác nhau (this.ownerCtx vs state.ownerCtx), cùng bản chất.
    expect(createA).toContain("ownerCtx.agents.create is not a function");
    expect(createB).toContain("ownerCtx.agents.create is not a function");
  });
});