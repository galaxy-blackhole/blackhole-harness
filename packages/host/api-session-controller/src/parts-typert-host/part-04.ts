/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua artefact typert.host.js @deepseek-ai/dsh-api-session-controller — khong sua tay
 */
// @ts-nocheck

export const TYPERT = {
  package: '@galaxy-blackhole/gbh-api-session-controller',
  face: 'host',
  schemas: [
  ],
  get invocations() { return $remote.descriptors },
  model: {
    "services": [
      {
        "description": "Host service backing the generated `ctx.remote.session` namespace.",
        "summary": "Host service backing the generated `ctx.remote.session` namespace.",
        "tags": [],
        "jsDoc": "/** Host service backing the generated `ctx.remote.session` namespace. */",
        "key": "sessionController",
        "exportName": "SessionController",
        "members": [
          {
            "kind": "method",
            "name": "resolveAgent",
            "signature": "resolveAgent(sessionId: SessionId): Promise<ApiSessionAgentResult>",
            "summary": "Resolve or resume one ordinary Session for another Host API domain.",
            "jsDoc": "/**\n * Resolve or resume one ordinary Session for another Host API domain.\n * @param sessionId - Session identity whose Agent owns the operation.\n * @returns the live Agent or the stable Session-domain failure.\n */"
          },
          {
            "kind": "method",
            "name": "inspect",
            "signature": "inspect( sessionId: SessionId, signal?: AbortSignal, ): Promise<SessionInspection>",
            "summary": "Inspect one attached or persisted Session without activating its Agent.",
            "jsDoc": "/**\n * Inspect one attached or persisted Session without activating its Agent.\n * @param sessionId - durable Session identity.\n * @param signal - optional caller cancellation for persistence reads.\n * @returns the current attached state or persisted header and event prefix.\n */"
          },
          {
            "kind": "method",
            "name": "list",
            "signature": "@Remote('list') async list(_request: SessionListRequest, signal: AbortSignal): Promise<SessionListValue>",
            "summary": "Read all visible Session rows without resuming an Agent.",
            "jsDoc": "/**\n * Read all visible Session rows without resuming an Agent.\n * @param _request - reserved empty list request.\n * @param signal - cancellation for persistence reads and summary generation.\n * @returns visible Session summaries ordered by activity.\n */"
          },
          {
            "kind": "method",
            "name": "search",
            "signature": "@Remote('search') async search(request: SessionSearchRequest, signal: AbortSignal): Promise<SessionSearchValue>",
            "summary": "Search visible Session content without resuming an Agent.",
            "jsDoc": "/**\n * Search visible Session content without resuming an Agent. A non-owner\n * receives only the hits whose Session `allows()` admits; `hasMore`\n * describes the bounded result before that filtering.\n * @param request - literal message-content query.\n * @param signal - cancellation for list and search reads.\n * @returns authorized bounded Session search results.\n */"
          },
          {
            "kind": "method",
            "name": "create",
            "signature": "@Remote('create') create(request: SessionCreateRequest): Promise<SessionCreateValue>",
            "summary": "Create one ordinary Session for a new conversation, reusing the named blank Session while it is reusable.",
            "jsDoc": "/**\n * Create one ordinary Session for a new conversation, reusing the named blank Session while it is reusable.\n * @param request - optional blank Session to reuse, location, and Agent preset.\n * @returns the created or reused Session identity and its preset when configured.\n */"
          },
          {
            "kind": "method",
            "name": "selectModel",
            "signature": "@Remote('selectModel') selectModel(request: SessionSelectModelRequest): Promise<SessionSelectModelValue>",
            "summary": "Select one Session-local model after explicitly resuming the Session; save the default in the background.",
            "jsDoc": "/**\n * Select one Session-local model after explicitly resuming the Session; save the default in the background.\n * @param request - Session identity and requested model selection.\n * @returns the normalized selection installed for the Session, without waiting for default persistence.\n */"
          },
          {
            "kind": "method",
            "name": "initializeDefaultModel",
            "signature": "@Remote async initializeDefaultModel(): Promise<void>",
            "summary": "Select the first available account model after login when no provider API key is configured.",
            "jsDoc": "/**\n * Select the first available account model after login when no provider API key is configured.\n * @returns after saving the first available model or retaining the existing default.\n */"
          },
          {
            "kind": "method",
            "name": "modelCatalog",
            "signature": "@Remote('modelCatalog') modelCatalog(): Promise<ModelCatalog>",
            "summary": "Describe every currently routable model for Host-generation selectors.",
            "jsDoc": "/**\n * Describe every currently routable model for Host-generation selectors.\n * @returns provider-grouped models, the deployment default, and isolated provider failures.\n */"
          },
          {
            "kind": "method",
            "name": "canOpenWorkspacePath",
            "signature": "@Remote canOpenWorkspacePath(): boolean",
            "summary": "Report whether this deployment can hand a Session workspace path to a native desktop.",
            "jsDoc": "/**\n * Report whether this deployment can hand a Session workspace path to a native desktop.\n * @returns true when the matching open operation is available.\n */"
          },
          {
            "kind": "method",
            "name": "workspaceDesktop",
            "signature": "workspaceDesktop(): { name: string; available: boolean; fileManager: 'finder' | 'explorer' | 'directory' | null }",
            "summary": "Describe the serving desktop for authenticated file-action routes.",
            "jsDoc": "/**\n * Describe the serving desktop for authenticated file-action routes.\n * @returns Host name, configured availability, and platform-specific file-manager behavior.\n */"
          },
          {
            "kind": "method",
            "name": "openWorkspacePath",
            "signature": "@Remote('openWorkspacePath') async openWorkspacePath( request: SessionOpenWorkspacePathRequest, signal: AbortSignal, ): Promise<SessionOpenWorkspacePathValue>",
            "summary": "Verify one path through the composed filesystem and open it on the Host desktop.",
            "jsDoc": "/**\n * Verify one path through the composed filesystem and open it on the Host desktop.\n * @param request - path after best-effort Session workspace resolution.\n * @param signal - caller lifetime; abort terminates the native command.\n * @returns confirmation after the native opener accepts the path.\n * @throws RemoteError when the request is invalid, has no verified Host mapping, is cancelled, or the opener fails.\n */"
          },
          {
            "kind": "method",
            "name": "workspacePathApplications",
            "signature": "@Remote('workspacePathApplications') async workspacePathApplications( request: { readonly path: string }, signal: AbortSignal, ): Promise<readonly SessionWorkspacePathApplication[]>",
            "summary": "Query current file handlers on the serving desktop without activating an Agent.",
            "jsDoc": "/**\n * Query current file handlers on the serving desktop without activating an Agent.\n * @param request - file path in Host filesystem syntax.\n * @param signal - caller lifetime, propagated to filesystem and desktop queries.\n * @returns OS application names, icons, and default selection; empty when desktop opening is unavailable.\n * @throws RemoteError when the path is invalid, the query is cancelled, or native discovery fails.\n */"
          },
          {
            "kind": "method",
            "name": "rename",
            "signature": "@Remote('rename') rename(request: SessionRenameRequest): Promise<SessionRenameValue>",
            "summary": "Rename one Session after explicitly resuming it.",
            "jsDoc": "/**\n * Rename one Session after explicitly resuming it.\n * @param request - Session identity and proposed title.\n * @returns the accepted title and durable event sequence.\n */"
          },
          {
            "kind": "method",
            "name": "fork",
            "signature": "@Remote('fork') async fork(request: SessionForkRequest): Promise<SessionForkValue>",
            "summary": "Fork one cold-readable exact event prefix into a new Session.",
            "jsDoc": "/**\n * Fork one cold-readable exact event prefix into a new Session. An omitted\n * boundary selects the latest completed-turn prefix; an open cut receives\n * synthetic fork closers.\n * @param request - source Session, optional exact inclusive event boundary, and migration preflight choice.\n * @returns the new Session identity.\n */"
          },
          {
            "kind": "method",
            "name": "prompt",
            "signature": "@Remote('prompt') async prompt(request: SessionPromptRequest, signal: AbortSignal): Promise<SessionPromptValue>",
            "summary": "Admit one prompt after explicitly resuming its Session.",
            "jsDoc": "/**\n * Admit one prompt after explicitly resuming its Session.\n * @param request - Session identity, prompt content, source metadata, and delivery mode.\n * @param signal - caller cancellation before prompt admission begins.\n * @returns acknowledgement that the Agent accepted the prompt.\n */"
          },
          {
            "kind": "method",
            "name": "attachment",
            "signature": "@Remote('attachment') attachment(request: SessionAttachmentRequest): Promise<SessionAttachmentValue>",
            "summary": "Read one image proven reachable from the addressed Session log.",
            "jsDoc": "/**\n * Read one image proven reachable from the addressed Session log.\n * @param request - Session and attachment identities used for authorization.\n * @returns the durable attachment reference and base64-encoded bytes.\n */"
          },
          {
            "kind": "method",
            "name": "updateQueue",
            "signature": "@Remote('updateQueue') updateQueue(request: SessionUpdateQueueRequest): Promise<SessionUpdateQueueValue>",
            "summary": "Mutate one still-pending queue occurrence, resuming a cold Agent first.",
            "jsDoc": "/**\n * Mutate one still-pending queue occurrence, resuming a cold Agent first.\n * @param request - Session, queue item, and requested mutation.\n * @returns acknowledgement that the queue mutation was applied.\n */"
          },
          {
            "kind": "method",
            "name": "cancel",
            "signature": "@Remote('cancel') cancel(request: SessionCancelRequest): SessionCancelValue",
            "summary": "Cancel one active Agent turn without dropping its pending inbox.",
            "jsDoc": "/**\n * Cancel one active Agent turn without dropping its pending inbox.\n * @param request - Session whose active Agent turn is cancelled.\n * @returns acknowledgement that cancellation was requested.\n */"
          },
          {
            "kind": "method",
            "name": "page",
            "signature": "@Remote({ name: 'page', resources: { session: addressedSession } }) page(request: SessionPageRequest, signal: AbortSignal): Promise<SessionPage>",
            "summary": "Read one cold-safe, message-aligned Session history page.",
            "jsDoc": "/**\n * Read one cold-safe, message-aligned Session history page.\n * @param request - durable address, backward cursor, and page budget.\n * @param signal - cancellation for persistence reads.\n * @returns one chronological page.\n */"
          },
          {
            "kind": "method",
            "name": "follow",
            "signature": "@Remote({ mode: 'stream', resources: { session: addressedSession } }) follow(request: SessionFollowRequest, signal: AbortSignal): AsyncIterable<SessionFollowFrame>",
            "summary": "Follow one Session log from its opening or resume cursor.",
            "jsDoc": "/**\n * Follow one Session log from its opening or resume cursor.\n * @param request - durable address and last committed sequence already held by the caller.\n * @param signal - cancellation owned by the Remote stream carrier.\n * @returns a complete opening snapshot followed by gap-free durable event\n *   frames and optional cursorless assistant-stream frames.\n */"
          },
          {
            "kind": "method",
            "name": "projections",
            "signature": "@Remote('projections') async projections(request: SessionProjectionsRequest, signal: AbortSignal): Promise<SessionProjectionsValue>",
            "summary": "Read exact projections, returning cached hints only when migration is required.",
            "jsDoc": "/**\n * Read exact projections, returning cached hints only when migration is required.\n * @param request - Session whose current values are required.\n * @param signal - cancellation for the Session read.\n * @returns a sequenced baseline, cached hints when migration is deferred, or null when absent.\n */"
          },
          {
            "kind": "method",
            "name": "control",
            "signature": "@Remote({ mode: 'stream' }) async *control(signal: AbortSignal): AsyncIterable<SessionControlFrame>",
            "summary": "Stream a complete live-control baseline followed by replacement frames.",
            "jsDoc": "/**\n * Stream a complete live-control baseline followed by replacement frames.\n * @param signal - cancellation owned by the Remote stream carrier.\n * @returns one complete baseline followed by live replacement frames.\n */"
          }
        ],
        "types": [
          {
            "name": "AfterScheduleRecord",
            "declaration": "export interface AfterScheduleRecord {\n    readonly id: ScheduleId;\n    readonly kind: 'after';\n    readonly title: string;\n    readonly prompt: string;\n    readonly afterSeconds: number;\n    readonly scheduledAt: string;\n}"
          },
          {
            "name": "Agent",
            "declaration": "export interface Agent {\n    readonly id: SessionId;\n    readonly options: AgentOptions;\n    readonly session: Session;\n    readonly inbox: Inbox;\n    readonly status: AgentStatus;\n    readonly ctx: Context;\n    cancel(cause: AgentCancelCause, options?: CancelOptions): void;\n    whenIdle(): Promise<void>;\n    runMaintenance<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T>;\n    send(message: UserMessage, target: InboxTarget, wakeup: boolean): void;\n    followup(message: UserMessage): void;\n    steer(message: UserMessage): void;\n    inject(message: UserMessage): void;\n}"
          },
          {
            "name": "AgentCancelCause",
            "declaration": "export type AgentCancelCause = { readonly kind: 'user'; } | { readonly kind: 'parent'; } | { readonly kind: 'hook'; readonly reason: string; } | { readonly kind: 'disposed'; };"
          },
          {
            "name": "AgentMessageSource",
            "declaration": "export interface AgentMessageSource {\n    readonly kind: 'agent-message';\n    readonly form: 'relay';\n    readonly senderSessionId: SessionId;\n}"
          },
          {
            "name": "AgentOptions",
            "declaration": "export interface AgentOptions {\n    provider?: string;\n    model?: string;\n    reasoningEffort?: ReasoningEffortId;\n    maxTokens?: number;\n    subagentDepth?: number;\n}"
          },
          {
            "name": "AgentStatus",
            "declaration": "export type AgentStatus = 'idle' | 'running';"
          },
          {
            "name": "AllowedModelRoute",
            "declaration": "export interface AllowedModelRoute {\n    readonly provider: string;\n    readonly model: string;\n}"
          },
          {
            "name": "ApiSessionAgentError",
            "declaration": "export type ApiSessionAgentError = RemoteError<'session/not-found' | 'session/agent-busy' | 'session/writer-held' | 'gateway/internal'>;"
          },
          {
            "name": "ApiSessionAgentResult",
            "declaration": "export type ApiSessionAgentResult = { readonly agent: Agent; } | { readonly error: ApiSessionAgentError; };"
          },
          {
            "name": "ApprovalOutcome",
            "declaration": "export type ApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable';"
          },
          {
            "name": "ApprovalPolicy",
            "declaration": "export type ApprovalPolicy = 'ask' | 'never';"
          },
          {
            "name": "ApprovalRequestId",
            "declaration": "export type ApprovalRequestId = Branded<'ApprovalRequestId'>;"
          },
          {
            "name": "AskUserQuestionAnswerItem",
            "declaration": "export interface AskUserQuestionAnswerItem {\n    id: string;\n    selected: string[];\n    custom?: string;\n}"
          },
          {
            "name": "AskUserQuestionIntent",
            "declaration": "export type AskUserQuestionIntent = { kind: 'plan-review'; approve: string; callId?: ToolCallId; };"
          },
          {
            "name": "AskUserQuestionItem",
            "declaration": "export interface AskUserQuestionItem {\n    id: string;\n    question: string;\n    detail?: string;\n    header?: string;\n    options?: AskUserQuestionOption[];\n    multiSelect?: boolean;\n    intent?: AskUserQuestionIntent;\n}"
          },
          {
            "name": "AskUserQuestionOption",
            "declaration": "export interface AskUserQuestionOption {\n    label: string;\n    description?: string;\n}"
          },
          {
            "name": "AssistantMessage",
            "declaration": "export interface AssistantMessage extends MessageBase {\n    readonly role: 'assistant';\n    readonly source: ModelMessageSource;\n}"
          },
          {
            "name": "AssistantProviderMetadata",
            "declaration": "export interface AssistantProviderMetadata {\n    provider: string;\n    model: string;\n    replayState?: unknown;\n}"
          },
          {
            "name": "AssistantStreamRecord",
            "declaration": "export type AssistantStreamRecord = { readonly type: 'text-chunks'; readonly time0: number; readonly index: number; readonly dt: readonly number[]; readonly texts: readonly string[]; } | { readonly type: 'reasoning-chunks'; readonly time0: number; readonly index: number; readonly dt: readonly number[]; readonly texts: readonly string[]; } | { readonly type: 'tool-call-chunks'; readonly time0: number; readonly index: number; readonly dt: readonly number[]; readonly id: ToolCallId; readonly name?: string; readonly args: readonly string[]; } | { readonly type: 'chunk'; readonly time: number; readonly chunk: StreamChunk; };"
          },
          {
            "name": "AtScheduleRecord",
            "declaration": "export interface AtScheduleRecord {\n    readonly id: ScheduleId;\n    readonly kind: 'at';\n    readonly title: string;\n    readonly prompt: string;\n    readonly scheduledAt: string;\n}"
          },
          {
            "name": "AttachmentId",
            "declaration": "export type AttachmentId = Branded<'AttachmentId'>;"
          },
          {
            "name": "Branded",
            "declaration": "export type Branded<B extends string> = string & { readonly [BRAND]: B; };"
          },
          {
            "name": "BrandedNumber",
            "declaration": "export type BrandedNumber<B extends string> = number & { readonly [BRAND]: B; };"
          },
          {
            "name": "CancelOptions",
            "declaration": "export interface CancelOptions {\n    keepInbox?: boolean | undefined;\n}"
          },
          {
            "name": "CommandId",
            "declaration": "export type CommandId = Branded<'CommandId'>;"
          },
          {
            "name": "CommandSource",
            "declaration": "export type CommandSource = CommandSourceMap[keyof CommandSourceMap];"
          },
          {
            "name": "CommandSourceMap",
            "declaration": "export interface CommandSourceMap {\n    user: { kind: 'user'; };\n}"
          },
          {
            "name": "CompactionCheckpointSource",
            "declaration": "export type CompactionCheckpointSource = typeof COMPACT_CHECKPOINT_MARKER & { readonly compactionId: CompactionId; readonly sourceCommandId?: CommandId; };"
          },
          {
            "name": "CompactionId",
            "declaration": "export type CompactionId = Branded<'CompactionId'>;"
          },
          {
            "name": "ContentBlock",
            "declaration": "export type ContentBlock = ContentBlockMap[ContentBlockType];"
          },
          {
            "name": "ContentBlockMap",
            "declaration": "export interface ContentBlockMap {\n    text: TextBlock;\n    reasoning: ReasoningBlock;\n    image: ImageBlock;\n    file: FileBlock;\n    'tool-call': ToolCallBlock;\n    'tool-addition': ToolAdditionBlock;\n    'tool-removal': ToolRemovalBlock;\n}"
          },
          {
            "name": "ContentBlockType",
            "declaration": "export type ContentBlockType = keyof ContentBlockMap;"
          },
          {
            "name": "ContextBreakdownProjection",
            "declaration": "export interface ContextBreakdownProjection {\n    systemTokens: number;\n    toolsTokens: number;\n    messageTokens: number;\n}"
          },
          {
            "name": "ContextFormed",
            "declaration": "export type ContextFormed = { readonly form?: never; } | { readonly form: 'instructions'; } | { readonly form: 'catalog'; } | { readonly form: 'snapshot'; readonly sections: readonly ContextSnapshotSection[]; } | { readonly form: 'notice'; readonly summary: string; } | { readonly form: 'relay'; } | { readonly form: 'recall'; };"
          },
          {
            "name": "ContextPressureProjection",
            "declaration": "export interface ContextPressureProjection {\n    pressureTokens?: number;\n    projectedTokens?: number;\n    contextWindow?: number;\n}"
          },
          {
            "name": "ContextSnapshotSection",
            "declaration": "export interface ContextSnapshotSection {\n    readonly name: string;\n    readonly text: string;\n}"
          },
          {
            "name": "ContinuableSubagentDescriptorData",
            "declaration": "export interface ContinuableSubagentDescriptorData extends SubagentDescriptorBase {\n    readonly mode: 'continuable';\n    readonly label: string;\n    readonly agentProvider?: string;\n    readonly agentModel?: string;\n    readonly agentReasoningEffort?: ReasoningEffortId;\n    readonly persona?: string;\n    readonly toolFilter?: ToolRestriction;\n}"
          },
          {
            "name": "DeveloperMessage",
            "declaration": "export interface DeveloperMessage extends MessageBase {\n    readonly role: 'developer';\n}"
          },
          {
            "name": "EpochHeader",
            "declaration": "export interface EpochHeader {\n    config: LlmCallConfig;\n    adapterDefaults?: LlmCallConfigAdapterDefaults;\n    tools?: ToolSchema[];\n    system?: never;\n}"
          },
          {
            "name": "EveryScheduleDispatchChange",
            "declaration": "export interface EveryScheduleDispatchChange {\n    readonly version: 1;\n    readonly operation: 'dispatch';\n    readonly id: ScheduleId;\n    readonly acceptedAt: string;\n}"
          },
          {
            "name": "EveryScheduleRecord",
            "declaration": "export interface EveryScheduleRecord {\n    readonly id: ScheduleId;\n    readonly kind: 'every';\n    readonly title: string;\n    readonly prompt: string;\n    readonly everySeconds: number;\n    readonly scheduledAt: string;\n}"
          },
          {
            "name": "FeedbackCategory",
            "declaration": "export type FeedbackCategory = 'task-result' | 'instruction-following' | 'product-interaction' | 'service-stability' | 'resource-cost' | 'security-privacy-permission' | 'other';"
          },
          {
            "name": "FeedbackRecord",
            "declaration": "export interface FeedbackRecord {\n    readonly text?: string;\n    readonly category?: FeedbackCategory;\n}"
          },
          {
            "name": "FileAttachmentRef",
            "declaration": "export interface FileAttachmentRef {\n    attachmentId: AttachmentId;\n    name: string;\n    bytes: number;\n}"
          },
          {
            "name": "FileBlock",
            "declaration": "export interface FileBlock {\n    type: 'file';\n    attachment: FileAttachmentRef;\n}"
          },
          {
            "name": "FinishReason",
            "declaration": "export type FinishReason = FinishReasonMap[keyof FinishReasonMap];"
          },
          {
            "name": "FinishReasonMap",
            "declaration": "export interface FinishReasonMap {\n    stop: { kind: 'stop'; };\n    'tool-calls': { kind: 'tool-calls'; };\n    'max-tokens': { kind: 'max-tokens'; };\n    aborted: { kind: 'aborted'; failure: LlmFailure; };\n    error: { kind: 'error'; failure: LlmFailure; };\n}"
          },
          {
            "name": "GoalBlockReason",
            "declaration": "export interface GoalBlockReason {\n    readonly code: string;\n    readonly message: string;\n}"
          },
          {
            "name": "GoalChangeMeta",
            "declaration": "export type GoalChangeMeta = GoalSnapshotChangeMeta | GoalClearChangeMeta;"
          },
          {
            "name": "GoalClearChangeMeta",
            "declaration": "export interface GoalClearChangeMeta {\n    readonly kind: 'goal/change';\n    readonly version: 1;\n    readonly operation: 'clear';\n    readonly cleared: GoalRef;\n    readonly clearedAt: number;\n}"
          },
          {
            "name": "GoalId",
            "declaration": "export type GoalId = Branded<'GoalId'>;"
          },
          {
            "name": "GoalMessageSource",
            "declaration": "export interface GoalMessageSource {\n    readonly kind: 'goal';\n    readonly goalId: GoalId;\n    readonly revision: number;\n    readonly round: number;\n}"
          },
          {
            "name": "GoalOperation",
            "declaration": "export type GoalOperation = 'create' | 'edit' | 'pause' | 'resume' | 'complete' | 'block' | 'clear';"
          },
          {
            "name": "GoalPhase",
            "declaration": "export type GoalPhase = 'active' | 'paused' | 'blocked' | 'complete';"
          },
          {
            "name": "GoalProjection",
            "declaration": "export interface GoalProjection {\n    readonly goal: GoalSnapshot;\n    readonly roundsStarted: number;\n    readonly createdAt: number;\n    readonly updatedAt: number;\n}"
          },
          {
            "name": "GoalRef",
            "declaration": "export interface GoalRef {\n    readonly id: GoalId;\n    readonly revision: number;\n}"
          },
          {
            "name": "GoalSnapshot",
            "declaration": "export interface GoalSnapshot extends GoalRef {\n    readonly objective: string;\n    readonly phase: GoalPhase;\n    readonly blockedReason?: GoalBlockReason;\n    readonly maxGoalRounds: number;\n}"
          },
          {
            "name": "GoalSnapshotChangeMeta",
            "declaration": "export interface GoalSnapshotChangeMeta {\n    readonly kind: 'goal/change';\n    readonly version: 1;\n    readonly operation: Exclude<GoalOperation, 'clear'>;\n    readonly goal: GoalSnapshot;\n    readonly roundsStarted: number;\n    readonly createdAt: number;\n    readonly updatedAt: number;\n}"
          },
          {
            "name": "ImageAttachmentLimits",
            "declaration": "export interface ImageAttachmentLimits {\n    maxImageBytes: number;\n    maxImagesPerMessage: number;\n    maxMessageImageBytes: number;\n    maxImagePixels: number;\n    maxImageDimension: number;\n    mediaTypes: readonly ImageMediaType[];\n}"
          },
          {
            "name": "ImageAttachmentRef",
            "declaration": "export interface ImageAttachmentRef {\n    attachmentId: AttachmentId;\n    mediaType: ImageMediaType;\n    bytes: number;\n    width: number;\n    height: number;\n    name?: string;\n    originalDimensions?: { width: number; height: number; };\n}"
          },
          {
            "name": "ImageBlock",
            "declaration": "export interface ImageBlock {\n    type: 'image';\n    attachment: ImageAttachmentRef;\n    offloaded?: true;\n}"
          },
          {
            "name": "ImageMediaType",
            "declaration": "export type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';"
          },
          {
            "name": "ImageOffloadTarget",
            "declaration": "export interface ImageOffloadTarget {\n    seq: SessionSeq;\n    imageIndexes: number[];\n}"
          },
          {
            "name": "Inbox",
            "declaration": "export interface Inbox {\n    readonly nextTurn: readonly UserMessage[];\n    readonly nextStep: readonly UserMessage[];\n    clear(): void;\n    append(target: InboxTarget, message: UserMessage): void;\n    prepend(target: InboxTarget, message: UserMessage): void;\n    replace(messageId: MessageId, newMessage: UserMessage): boolean;\n    remove(messageId: MessageId): boolean;\n    splice(target: InboxTarget, start: number, deleteCount: number, inserted: UserMessage[]): UserMessage[];\n}"
          },
          {
            "name": "InboxTarget",
            "declaration": "export type InboxTarget = 'next-turn' | 'next-step';"
          },
          {
            "name": "InboxWireState",
            "declaration": "export interface InboxWireState {\n    readonly 'next-turn': readonly JsonValue[];\n    readonly 'next-step': readonly JsonValue[];\n}"
          },
          {
            "name": "JobId",
            "declaration": "export type JobId = Branded<'JobId'>;"
          },
          {
            "name": "JobOutcome",
            "declaration": "export interface JobOutcome {\n    status: 'completed' | 'killed' | 'failed';\n    detail?: string;\n    result?: string;\n}"
          },
          {
            "name": "JobRegisteredData",
            "declaration": "export interface JobRegisteredData {\n    readonly jobId: JobId;\n    readonly owner: SessionId;\n    readonly kind: string;\n    readonly label: string;\n    readonly startedAt: number;\n    readonly toolCall?: JobToolCall;\n}"
          },
          {
            "name": "JobSettleCause",
            "declaration": "export type JobSettleCause = 'producer' | 'kill' | 'teardown';"
          },
          {
            "name": "JobSettledData",
            "declaration": "export interface JobSettledData extends JobRegisteredData {\n    readonly finishedAt: number;\n    readonly status: JobOutcome['status'];\n    readonly cause: JobSettleCause;\n    readonly producerReported: boolean;\n    readonly detail?: string;\n}"
          },
          {
            "name": "JobToolCall",
            "declaration": "export interface JobToolCall {\n    readonly callId: SessionEventMap['tool/call']['callId'];\n    readonly rootCallId: SessionEventMap['tool/call']['callId'];\n}"
          },
          {
            "name": "JsonValue",
            "declaration": "export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue; };"
          },
          {
            "name": "KnownCatalogMode",
            "declaration": "export type KnownCatalogMode = { readonly mode: 'one-shot'; readonly label?: string; } | { readonly mode: 'continuable'; readonly label: string; };"
          },
          {
            "name": "LegacyAfterScheduleRecord",
            "declaration": "export interface LegacyAfterScheduleRecord extends Omit<AfterScheduleRecord, 'title'> {\n    readonly title?: string;\n}"
          },
          {
            "name": "LegacyAtScheduleRecord",
            "declaration": "export interface LegacyAtScheduleRecord extends Omit<AtScheduleRecord, 'title'> {\n    readonly title?: string;\n}"
          },
          {
            "name": "LegacyEveryScheduleRecord",
            "declaration": "export interface LegacyEveryScheduleRecord extends Omit<EveryScheduleRecord, 'title'> {\n    readonly title?: string;\n}"
          },
          {
            "name": "LegacyScheduleRecord",
            "declaration": "export type LegacyScheduleRecord = LegacyAfterScheduleRecord | LegacyAtScheduleRecord | LegacyEveryScheduleRecord;"
          },
          {
            "name": "LlmAttemptId",
            "declaration": "export type LlmAttemptId = Branded<'LlmAttemptId'>;"
          },
          {
            "name": "LlmCallConfig",
            "declaration": "export interface LlmCallConfig extends LlmCallControls {\n    provider: string;\n    model: string;\n}"
          },
          {
            "name": "LlmCallConfigAdapterDefaults",
            "declaration": "export interface LlmCallConfigAdapterDefaults {\n    reasoningEffort?: true;\n    maxTokens?: true;\n}"
          },
          {
            "name": "LlmCallControls",
            "declaration": "export interface LlmCallControls {\n    reasoningEffort?: ReasoningEffortId;\n    temperature?: number;\n    maxTokens?: number;\n    stop?: string[];\n}"
          },
          {
            "name": "LlmFailure",
            "declaration": "export interface LlmFailure {\n    readonly message: string;\n    readonly code: string;\n    readonly status?: number;\n    readonly providerRetryAfterMs?: number;\n    readonly requestId?: ProviderRequestId;\n    readonly offloadImages?: number;\n}"
          },
          {
            "name": "LlmRetryEventData",
            "declaration": "export type LlmRetryEventData = { retryId: RetryId; turn: number; step: number; provider: string; mode: 'normal'; policyKey: string; retry: number; maxRetries: number; delayMs: number; failure: LlmFailure; } | { retryId: RetryId; turn: number; step: number; provider: string; mode: 'always'; policyKey: string; retry: number; delayMs: number; failure: LlmFailure; };"
          },
          {
            "name": "LlmRetryStartedEventData",
            "declaration": "export interface LlmRetryStartedEventData {\n    retryId: RetryId;\n    turn: number;\n    step: number;\n    retry: number;\n}"
          },
          {
            "name": "Message",
            "declaration": "export type Message = MessageRoleMap[keyof MessageRoleMap];"
          },
          {
            "name": "MessageBase",
            "declaration": "export interface MessageBase {\n    readonly id: MessageId;\n    readonly content: readonly ContentBlock[];\n    readonly source: MessageSource;\n}"
          },
          {
            "name": "MessageFeedbackDelete",
            "declaration": "export interface MessageFeedbackDelete {\n    readonly sessionId: SessionId;\n    readonly messageId: MessageId;\n}"
          },
          {
            "name": "MessageFeedbackItem",
            "declaration": "export interface MessageFeedbackItem {\n    readonly messageId: MessageId;\n    readonly rating: MessageFeedbackRating;\n    readonly note?: string;\n    readonly category?: FeedbackCategory;\n    readonly version: MessageFeedbackVersion;\n    readonly createdAt: number;\n    readonly updatedAt: number;\n}"
          },
          {
            "name": "MessageFeedbackPut",
            "declaration": "export interface MessageFeedbackPut {\n    readonly sessionId: SessionId;\n    readonly item: MessageFeedbackItem;\n}"
          },
          {
            "name": "MessageFeedbackRating",
            "declaration": "export type MessageFeedbackRating = 'positive' | 'negative';"
          },
          {
            "name": "MessageFeedbackVersion",
            "declaration": "export type MessageFeedbackVersion = Branded<'MessageFeedbackVersion'>;"
          },
          {
            "name": "MessageId",
            "declaration": "export type MessageId = Branded<'MessageId'>;"
          },
          {
            "name": "MessageRoleMap",
            "declaration": "export interface MessageRoleMap {\n    system: SystemMessage;\n    developer: DeveloperMessage;\n    user: UserMessage;\n    assistant: AssistantMessage;\n    tool: ToolResultMessage;\n}"
          },
          {
            "name": "MessageSource",
            "declaration": "export type MessageSource = MessageSourceMap[keyof MessageSourceMap];"
          },
          {
            "name": "MessageSourceMap",
            "declaration": "export interface MessageSourceMap {\n    user: { kind: 'user'; };\n    model: ModelMessageSource;\n    tool: ToolMessageSource;\n    'system-prompt': SystemPromptMessageSource;\n    'model-selection': { kind: 'model-selection'; } & ContextFormed;\n    'runtime-context': { kind: 'runtime-context'; } & ContextFormed;\n    'working-directory': { kind: 'working-directory'; };\n    'user-approval': { kind: 'user-approval'; } & ContextFormed;\n    'ptc-mode': { kind: 'ptc-mode'; };\n    'tool-registry': { kind: 'tool-registry'; };\n    'user-rpc': { kind: 'user'; rpcId: SessionRequestId; clientTimeZone?: string; principal?: Principal; };\n    'agent-message': AgentMessageSource;\n    'subagent-settled': SubagentSettledMessageSource;\n    'skill-invocation': SkillInvocationSource;\n    'compact-checkpoint': CompactionCheckpointSource;\n    'cordis-host-runner': { kind: 'cordis-host-runner'; };\n    'team-message': TeamMessageSource;\n    'user-question-reply': { kind: 'user-question-reply'; callId: ToolCallId; outcome: 'answered'; };\n    goal: GoalMessageSource;\n    'plan-mode': { kind: 'plan-mode'; } & ContextFormed;\n    schedule: { kind: 'schedule'; } & ContextFormed;\n    'session-reference': SessionReferenceSource;\n    webhook: { readonly kind: 'webhook'; readonly provider: string; readonly source: WebhookSourceId; readonly deliveryId: WebhookDeliveryId; readonly ruleId: WebhookRuleId; readonly form: 'notice'; readonly summary: string; };\n}"
          },
          {
            "name": "ModelCatalog",
            "declaration": "export interface ModelCatalog {\n    readonly default: ModelSelection;\n    readonly routableProviders: readonly string[];\n    readonly groups: readonly ModelProviderGroup[];\n    readonly failures: readonly ModelCatalogFailure[];\n}"
          },
          {
            "name": "ModelCatalogFailure",
            "declaration": "export interface ModelCatalogFailure {\n    readonly id: string;\n    readonly name: string;\n    readonly message: string;\n}"
          },
          {
            "name": "ModelCatalogModel",
            "declaration": "export interface ModelCatalogModel {\n    readonly id: string;\n    readonly name: string;\n    readonly description?: string;\n    readonly reasoning?: ModelReasoning;\n}"
          },
          {
            "name": "ModelMessageSource",
            "declaration": "export interface ModelMessageSource extends AssistantProviderMetadata {\n    kind: 'model';\n}"
          },
          {
            "name": "ModelProviderGroup",
            "declaration": "export interface ModelProviderGroup {\n    readonly id: string;\n    readonly name: string;\n    readonly models: readonly ModelCatalogModel[];\n}"
          },
          {
            "name": "ModelReasoning",
            "declaration": "export interface ModelReasoning {\n    readonly efforts: readonly ModelReasoningEffort[];\n    readonly defaultEffort?: string;\n}"
          },
          {
            "name": "ModelReasoningEffort",
            "declaration": "export interface ModelReasoningEffort {\n    readonly id: string;\n    readonly name: string;\n    readonly description?: string;\n}"
          },
          {
            "name": "ModelSelection",
            "declaration": "export interface ModelSelection {\n    readonly provider: string;\n    readonly model: string;\n    readonly reasoningEffort?: string;\n}"
          },
          {
            "name": "ModelSelectionProjection",
            "declaration": "export interface ModelSelectionProjection {\n    readonly lastUsed: ModelSelection | null;\n    readonly next: ModelSelection | null;\n}"
          },
          {
            "name": "NativeFileApplication",
            "declaration": "export interface NativeFileApplication {\n    readonly id: string;\n    readonly name: string;\n    readonly default: boolean;\n    readonly icon: string | null;\n}"
          },
          {
            "name": "OfficeToPdfErrorCode",
            "declaration": "export type OfficeToPdfErrorCode = 'input-too-large' | 'output-too-large' | 'invalid-document' | 'unsupported-format' | 'invalid-output' | 'timeout' | 'unavailable' | 'failed' | 'busy' | 'source-changed';"
          },
          {
            "name": "OneShotScheduleDispatchChange",
            "declaration": "export interface OneShotScheduleDispatchChange {\n    readonly version: 1;\n    readonly operation: 'dispatch';\n    readonly id: ScheduleId;\n}"
          },
          {
            "name": "OneShotSubagentDescriptorData",
            "declaration": "export interface OneShotSubagentDescriptorData extends SubagentDescriptorBase {\n    readonly mode: 'one-shot';\n    readonly label?: string;\n}"
          },
          {
            "name": "OptionalSessionSeq",
            "declaration": "export type OptionalSessionSeq = SessionSeq | null;"
          },
          {
            "name": "PendingUserQuestion",
            "declaration": "export interface PendingUserQuestion {\n    readonly callId: ToolCallId;\n    readonly questions: readonly AskUserQuestionItem[];\n    readonly state: UserQuestionState;\n}"
          },
          {
            "name": "PermissionSelection",
            "declaration": "export interface PermissionSelection {\n    currentValue: string;\n}"
          },
          {
            "name": "PlanProjection",
            "declaration": "export interface PlanProjection {\n    active: boolean;\n    pending: boolean;\n}"
          },
          {
            "name": "Principal",
            "declaration": "export type Principal = PrincipalMap[keyof PrincipalMap];"
          },
          {
            "name": "PrincipalMap",
            "declaration": "export interface PrincipalMap {\n    owner: { readonly kind: 'owner'; };\n}"
          },
          {
            "name": "PromptContentPart",
            "declaration": "export type PromptContentPart = { readonly type: 'text'; readonly text: string; } | { readonly type: 'image'; readonly mediaType: ImageMediaType; readonly data: string; readonly name?: string; } | { readonly type: 'file'; readonly receiptId: Branded<'file-upload-receipt-id'>; };"
          },
          {
            "name": "ProviderRequestId",
            "declaration": "export type ProviderRequestId = Branded<'ProviderRequestId'>;"
          },
          {
            "name": "PtcDispatchEventData",
            "declaration": "export interface PtcDispatchEventData extends PtcDispatchStartEventData {\n    isError: boolean;\n    content: ContentBlock[];\n    meta?: JsonValue;\n    error?: { name: string; code: string; reason?: string; };\n}"
          },
          {
            "name": "PtcDispatchStartEventData",
            "declaration": "export interface PtcDispatchStartEventData {\n    rootCallId: ToolCallId;\n    parentCallId: ToolCallId;\n    subCallId: ToolCallId;\n    name: string;\n    arguments: unknown;\n}"
          },
          {
            "name": "QueueAction",
}]}]}} // __DSH_FRAGMENT_END__

export {};
