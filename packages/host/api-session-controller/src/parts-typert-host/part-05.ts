/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua artefact typert.host.js @deepseek-ai/dsh-api-session-controller — khong sua tay
 */
// @ts-nocheck

({ // __DSH_FRAGMENT_BEGIN__
            "declaration": "export type QueueAction = { readonly kind: 'edit'; readonly content: readonly TextBlock[]; } | { readonly kind: 'remove'; } | { readonly kind: 'steer'; };"
          },
          {
            "name": "ReasoningBlock",
            "declaration": "export interface ReasoningBlock {\n    type: 'reasoning';\n    text: string;\n}"
          },
          {
            "name": "ReasoningEffortId",
            "declaration": "export type ReasoningEffortId = Branded<'ReasoningEffortId'>;"
          },
          {
            "name": "RemoteAccessDeniedDetails",
            "declaration": "export interface RemoteAccessDeniedDetails {\n    readonly action: string;\n    readonly reason: string;\n}"
          },
          {
            "name": "RemoteError",
            "declaration": "export class RemoteError<Code extends RemoteErrorCode = RemoteErrorCode> extends Error {\n    readonly isDSHRemoteError: true;\n}"
          },
          {
            "name": "RemoteErrorCode",
            "declaration": "export type RemoteErrorCode = keyof RemoteErrorDetailsMap;"
          },
          {
            "name": "RemoteErrorDetailsMap",
            "declaration": "export interface RemoteErrorDetailsMap {\n    'gateway/bad-request': { readonly issues?: readonly object[]; };\n    'gateway/cancelled': {};\n    'gateway/internal': {};\n    'llm/model-discovery-rejected': { readonly settingsNs: string; readonly baseURL?: string; };\n    'session/not-found': { readonly sessionId: SessionId; };\n    'workspace/not-found': { readonly workspaceId: WorkspaceId; };\n    'agent-preset/not-found': { readonly agentPreset: string; readonly available: readonly string[]; };\n    'agent-preset/invalid': { readonly agentPreset: string; readonly reason: string; };\n    'agent-preset/locked': { readonly sessionId: SessionId; readonly agentPreset: string; };\n    'remote-access/denied': RemoteAccessDeniedDetails;\n    'gateway/ambiguous-endpoint': TypertGatewayFaultDetails;\n    'gateway/arguments-invalid': TypertGatewayFaultDetails;\n    'gateway/binding-invalid': TypertGatewayFaultDetails;\n    'gateway/context-failed': TypertGatewayFaultDetails;\n    'gateway/context-not-found': TypertGatewayFaultDetails;\n    'gateway/context-unavailable': TypertGatewayFaultDetails;\n    'gateway/definition-unavailable': TypertGatewayFaultDetails;\n    'gateway/input-invalid': TypertGatewayFaultDetails;\n    'gateway/interactions-forbidden': TypertGatewayFaultDetails;\n    'gateway/invocation-unavailable': TypertGatewayFaultDetails;\n    'gateway/lookup-failed': TypertGatewayFaultDetails;\n    'gateway/lookup-not-found': TypertGatewayFaultDetails;\n    'gateway/lookup-unavailable': TypertGatewayFaultDetails;\n    'gateway/method-unavailable': TypertGatewayFaultDetails;\n    'gateway/peer-disposed': TypertGatewayFaultDetails;\n    'gateway/protocol': TypertGatewayFaultDetails;\n    'gateway/provider-mismatch': TypertGatewayFaultDetails;\n    'gateway/result-invalid': TypertGatewayFaultDetails;\n    'gateway/service-unavailable': TypertGatewayFaultDetails;\n    'gateway/signature-invalid': TypertGatewayFaultDetails;\n    'gateway/uplink-overflow': TypertGatewayFaultDetails;\n    'job/not-found': { readonly sessionId: SessionId; readonly jobId: JobId; };\n    'session/provider-credentials-unavailable': Record<string, never>;\n    'session/provider-models-unavailable': { readonly provider: string; };\n    'session/model-unavailable': { readonly provider: string; readonly model: string; };\n    'session/conflict': { readonly sessionId: SessionId; readonly requestedCwd: string; readonly existingCwd?: string; };\n    'session/projections-unavailable': Record<string, never>;\n    'session/writer-held': { readonly sessionId: SessionId; };\n    'session/agent-busy': { readonly reason: string; };\n    'session/invalid-time-zone': { readonly value: string; };\n    'session/workspace-attach-failed': { readonly sessionId: SessionId; readonly workspaceId: string; };\n    'agent-preset/conflict': { readonly sessionId: SessionId; readonly requestedPreset: string; };\n    'session/attachment-invalid': { readonly reason: string; };\n    'session/queue-item-not-found': { readonly itemId: MessageId; };\n    'session/steer-unavailable': { readonly itemId: MessageId; };\n    'session/title-invalid': { readonly sessionId: SessionId; };\n    'session/fork-unavailable': { readonly sessionId: SessionId; };\n    'session/migration-required': { readonly sessionId: SessionId; };\n    'subagent/not-found': { readonly parentSessionId: SessionId; readonly childSessionId: SessionId; };\n    'subagent/catalog-diagnostic': { readonly parentSessionId: SessionId; readonly childSessionId: SessionId; readonly reason: 'corrupt' | 'unsupported' | 'unavailable'; };\n    'subagent/invalid-time-zone': { readonly value: string; };\n    'subagent/parent-unavailable': { readonly parentSessionId: SessionId; };\n    'subagent/not-resumable': { readonly childSessionId: SessionId; };\n    'subagent/unauthorized': { readonly childSessionId: SessionId; };\n    'subagent/attachment-invalid': { readonly reason: string; };\n    'subagent/delivery-unavailable': { readonly childSessionId: SessionId; };\n    'settings/rejected': { readonly ns: string; };\n    'settings/conflict': { readonly ns: string; readonly expected: number; readonly actual: number; };\n    'credential/rejected': { readonly ref: string; };\n    'terminal/unavailable': Record<string, never>;\n    'terminal/control-unavailable': { readonly reason: 'read-only' | 'not-running'; };\n    'terminal/limit-reached': { readonly limit: number; };\n    'workspace/invalid-path': { readonly path: string; };\n    'workspace/name-conflict': { readonly name: string; };\n    'workspace/session-active': { readonly sessionId: SessionId; readonly activity: readonly SessionActivity[]; };\n    'workspace/move-invalid': { readonly workspaceId: WorkspaceId; readonly sessionId: SessionId; readonly beforeSessionId?: SessionId; };\n    'directory-picker/unavailable': { readonly capability: string; };\n    'directory-picker/unreadable': { readonly path: string; };\n    'directory-picker/exists': { readonly path: string; };\n    'directory-picker/create-failed': { readonly path: string; };\n    'workspace-file/watch-unsupported': { readonly path: string; };\n    'workspace-file/not-found': { readonly path: string; };\n    'workspace-file/outside-workspace': { readonly path: string; };\n    'workspace-file/too-large': { readonly path: string; readonly limit: number; };\n    'workspace-file/not-text': { readonly path: string; };\n    'workspace-file/not-regular-file': { readonly path: string; readonly kind: 'directory' | 'symlink' | 'other'; };\n    'workspace-file/not-directory': { readonly path: string; readonly kind: 'file' | 'symlink' | 'other'; };\n    'speech/invalid-audio': { readonly reason: string; };\n    'speech/transcription-failed': { readonly reason: string; };\n    'cotTranslation/failed': Record<string, never>;\n    'document-render/failed': { readonly reason: OfficeToPdfErrorCode; };\n    'plugin-market/invalid-index-url': { readonly url: string; readonly reason: string; };\n    'plugin-market/unknown-index': { readonly url: string; };\n    'plugin-market/fetch-failed': { readonly url: string; readonly reason: string; };\n    'plugin-market/invalid-index': { readonly url: string; readonly path: string; readonly reason: string; };\n    'plugin-market/invalid-query': { readonly field: string; readonly reason: string; };\n    'plugin-market/settings-unavailable': Record<string, never>;\n}"
          },
          {
            "name": "ReplayEnvelope",
            "declaration": "export interface ReplayEnvelope {\n    response: unknown;\n    blocks?: readonly unknown[];\n}"
          },
          {
            "name": "RequestContext",
            "declaration": "export interface RequestContext {\n    provider: string;\n    model: string;\n    contextWindow?: number;\n    systemPromptUpdate?: SystemPromptUpdate;\n}"
          },
          {
            "name": "RequestHeaderReason",
            "declaration": "export type RequestHeaderReason = 'initial' | 'resume' | 'change' | 'series';"
          },
          {
            "name": "RetryId",
            "declaration": "export type RetryId = Branded<'RetryId'>;"
          },
          {
            "name": "SandboxMode",
            "declaration": "export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';"
          },
          {
            "name": "ScheduleChange",
            "declaration": "export type ScheduleChange = ScheduleCreateChange | ScheduleDeleteChange | ScheduleDispatchChange;"
          },
          {
            "name": "ScheduleCreateChange",
            "declaration": "export interface ScheduleCreateChange {\n    readonly version: 1;\n    readonly operation: 'create';\n    readonly schedule: LegacyScheduleRecord;\n}"
          },
          {
            "name": "ScheduleDeleteChange",
            "declaration": "export interface ScheduleDeleteChange {\n    readonly version: 1;\n    readonly operation: 'delete';\n    readonly id: ScheduleId;\n}"
          },
          {
            "name": "ScheduleDispatchChange",
            "declaration": "export type ScheduleDispatchChange = OneShotScheduleDispatchChange | EveryScheduleDispatchChange;"
          },
          {
            "name": "ScheduleId",
            "declaration": "export type ScheduleId = Branded<'ScheduleId'>;"
          },
          {
            "name": "Session",
            "declaration": "export class Session {\n    get surface(): SessionSurface;\n    readonly header: SessionHeader;\n    readonly inheritedEventCount: SessionLogOffset;\n    get id(): SessionId;\n    readonly firstLiveSeq: SessionLogOffset;\n    readonly firstLifecycleSeq: SessionLogOffset;\n    eventAt(seq: SessionSeq): SessionEvent | undefined;\n    snapshotEvents(fromSeq: SessionLogOffset = SessionLogOffset(0), toSeqExclusive: SessionLogOffset = this.seq): readonly SessionEvent[];\n    ownEvents(): readonly SessionEvent[];\n    isOwnSeq(seq: SessionSeq): boolean;\n    get seq(): SessionLogOffset;\n    append<T extends SessionEventType>(type: T, data: SessionEventMap[T], ...opts: T extends SurfaceEventType ? [opts: SurfaceIntent<T>] : []): SessionEvent<T>;\n    requestHeader(): EpochHeader | undefined;\n    requestContext(): RequestContext | undefined;\n    toolHistory(): ToolHistory;\n    deriveMessages(): Message[];\n    deriveEventMessage(event: SessionEvent): Message | null;\n}"
          },
          {
            "name": "SessionActivity",
            "declaration": "export interface SessionActivity {\n    readonly kind: SessionActivityKind;\n    readonly items?: readonly SessionActivityItem[];\n}"
          },
          {
            "name": "SessionActivityItem",
            "declaration": "export interface SessionActivityItem {\n    readonly id: string;\n    readonly label?: string;\n}"
          },
          {
            "name": "SessionActivityKind",
            "declaration": "export type SessionActivityKind = keyof SessionActivityKindMap;"
          },
          {
            "name": "SessionActivityKindMap",
            "declaration": "export interface SessionActivityKindMap {\n    turn: true;\n    job: true;\n    subagent: true;\n    schedule: true;\n}"
          },
          {
            "name": "SessionAddress",
            "declaration": "export type SessionAddress = { readonly kind: 'session'; readonly sessionId: SessionId; } | { readonly kind: 'subagent'; readonly parentSessionId: SessionId; readonly childSessionId: SessionId; readonly mode: 'one-shot' | 'continuable' | 'unknown'; };"
          },
          {
            "name": "SessionAssistantStreamAttempt",
            "declaration": "export interface SessionAssistantStreamAttempt {\n    readonly attemptId: LlmAttemptId;\n    readonly startedAfterSeq: SessionSeqCursor;\n    readonly turn: number;\n    readonly step: number;\n    readonly nextIndex: number;\n    readonly stream: readonly JsonValue[];\n}"
          },
          {
            "name": "SessionAssistantStreamBaseline",
            "declaration": "export interface SessionAssistantStreamBaseline {\n    readonly revision: number;\n    readonly activeAttempt?: SessionAssistantStreamAttempt;\n}"
          },
          {
            "name": "SessionAssistantStreamFrame",
            "declaration": "export type SessionAssistantStreamFrame = { readonly type: 'start'; readonly attemptId: LlmAttemptId; readonly revision: number; readonly startedAfterSeq: SessionSeqCursor; readonly turn: number; readonly step: number; } | { readonly type: 'chunk'; readonly attemptId: LlmAttemptId; readonly revision: number; readonly index: number; readonly time: number; readonly chunk: JsonValue; } | { readonly type: 'end'; readonly attemptId: LlmAttemptId; readonly revision: number; readonly index: number; readonly outcome: { readonly kind: 'committed'; readonly eventType: 'assistant/message' | 'assistant/attempt'; readonly seq: number; } | { readonly kind: 'abandoned'; }; };"
          },
          {
            "name": "SessionAttachmentRequest",
            "declaration": "export interface SessionAttachmentRequest {\n    readonly sessionId: SessionId;\n    readonly attachmentId: AttachmentIdType;\n}"
          },
          {
            "name": "SessionAttachmentValue",
            "declaration": "export interface SessionAttachmentValue {\n    readonly attachment: ImageAttachmentRef;\n    readonly data: string;\n}"
          },
          {
            "name": "SessionCancelRequest",
            "declaration": "export interface SessionCancelRequest {\n    readonly sessionId: SessionId;\n}"
          },
          {
            "name": "SessionCancelValue",
            "declaration": "export interface SessionCancelValue {\n    readonly accepted: true;\n}"
          },
          {
            "name": "SessionControlBaseline",
            "declaration": "export interface SessionControlBaseline {\n    readonly projections: Readonly<Record<SessionId, SessionProjectionBaseline>>;\n}"
          },
          {
            "name": "SessionControlFrame",
            "declaration": "export type SessionControlFrame = { readonly type: 'baseline'; readonly value: SessionControlBaseline; } | ({ readonly type: 'projection'; } & SessionProjectionUpdate);"
          },
          {
            "name": "SessionCreateRequest",
            "declaration": "export interface SessionCreateRequest {\n    readonly workspaceId?: WorkspaceId;\n    readonly cwd?: string;\n    readonly sessionId?: SessionId;\n    readonly agentPreset?: string;\n}"
          },
          {
            "name": "SessionCreateValue",
            "declaration": "export interface SessionCreateValue {\n    readonly sessionId: SessionId;\n    readonly agentPreset?: string;\n}"
          },
          {
            "name": "SessionEvent",
            "declaration": "export type SessionEvent<T extends SessionEventType = SessionEventType> = { [K in SessionEventType]: { type: K; seq: SessionSeq; time: number; data: SessionEventMap[K]; ignorable?: true; } & (K extends SurfaceEventType ? SurfaceIntent<K> : { surfaceOp?: never; sourceEventSeqs?: never; }) }[T];"
          },
          {
            "name": "SessionEventEntry",
            "declaration": "export interface SessionEventEntry {\n    readonly type: 'event';\n    readonly event: SessionWireEvent;\n}"
          },
          {
            "name": "SessionEventMap",
            "declaration": "export interface SessionEventMap {\n    'turn/start': { turn: number; };\n    'turn/end': { turn: number; reason: TurnEndReason; };\n    'step/start': { turn: number; step: number; };\n    'step/end': { turn: number; step: number; };\n    'user/message': UserMessage;\n    'developer/message': { turn: number; step: number; message: DeveloperMessage; headerSeq?: SessionSeq; };\n    'system/message': { turn: number; step: number; message: SystemMessage; };\n    'assistant/message': { turn: number; step: number; message: AssistantMessage; stream: AssistantStreamRecord[]; usage?: TokenUsage; interrupted?: true; };\n    'assistant/attempt': { turn: number; step: number; stream: AssistantStreamRecord[]; };\n    'tool/call': { turn: number; step: number; callId: ToolCallId; name: string; arguments: string; };\n    'tool/result': { turn: number; step: number; message: ToolResultMessage; error?: { name: string; code: string; reason?: string; }; meta?: JsonValue; };\n    'request/header': { header: EpochHeader; reason: RequestHeaderReason; startsSeries?: true; };\n    'request/context': RequestContext;\n    'session/end-seed': { inherited?: true; };\n    'agent/inbox/spliced': { target: InboxTarget; start: number; removedCount?: number; inserted: UserMessage[]; outcome?: 'canceled'; };\n    'working-directory/change': { cwd: string; };\n    'sandbox/mode': { mode: SandboxMode; source?: 'delegation'; };\n    'approval/asked': { id: ApprovalRequestId; toolName: string; callId?: ToolCallId; reason?: string; };\n    'approval/decided': { id: ApprovalRequestId; outcome: ApprovalOutcome; };\n    'approval/policy': { policy: ApprovalPolicy; source?: 'delegation'; };\n    'tool/ptc-dispatch-start': PtcDispatchStartEventData;\n    'tool/ptc-dispatch': PtcDispatchEventData;\n    'agent-preset/selected': { agentPreset: string; };\n    'job/registered': JobRegisteredData;\n    'job/settled': JobSettledData;\n    'command/run': { commandId: CommandId; name: string; args?: string; source: CommandSource; };\n    'command/done': { commandId: CommandId; kind: 'success' | 'error'; text?: string; sourceEventSeq?: import('@deepseek-ai/dsh-session/types').SessionSeq; };\n    'image/offload': { targets: ImageOffloadTarget[]; };\n    'session/title': SessionTitleEventData;\n    'todo/write': { todos: TodoItem[]; };\n    'model/selection': ModelSelection;\n    'permission/preset': { preset: string; };\n    'subagent/descriptor': SubagentDescriptorData;\n    'subagent/catalog': SubagentCatalogEvent;\n    'compaction/start': { compactionId: CompactionId; sourceCommandId?: CommandId; turn: number | null; };\n    'compaction/summary': { compactionId: CompactionId; sourceCommandId?: CommandId; summary: ContentBlock[]; shadowedRange: { start: SessionSeq; end: SessionSeq; }; shadowedSeqs: SessionSeq[]; shadowedTokenCount: number; provider: string; model: string; maxTokens?: number; usage?: TokenUsage; } & ({ rawOutput: ContentBlock[]; llmStreamCall: true; } | { rawOutput?: ContentBlock[]; llmStreamCall?: never; });\n    'compaction/end': { compactionId: CompactionId; sourceCommandId?: CommandId; turn: number | null; error?: string; };\n    'compaction/prune': { shadowedRange: { start: SessionSeq; end: SessionSeq; }; shadowedSeqs: SessionSeq[]; shadowedTokenCount: number; };\n    'feedback/record': FeedbackRecord;\n    'llm/retry': LlmRetryEventData;\n    'llm/retry-started': LlmRetryStartedEventData;\n    'team/member': { version: 2; teamId: TeamId; member: TeamMemberSnapshot; };\n    'team/task': { version: 2; teamId: TeamId; task: TeamTaskSnapshot; };\n    'team/message/queued': { version: 2; teamId: TeamId; message: TeamMessageSnapshot; };\n    'team/message/delivered': { version: 2; teamId: TeamId; messageId: TeamMessageId; targetId: SessionId; };\n    'goal/change': GoalChangeMeta;\n    'feedback/message-put': MessageFeedbackPut;\n    'feedback/message-delete': MessageFeedbackDelete;\n    'plan/mode': { active: boolean; };\n    'schedule/change': ScheduleChange;\n    'subagent/model-selection-policy': { allowedModels: AllowedModelRoute[]; };\n    'workspace/changes': { turn: number; };\n}"
          },
          {
            "name": "SessionEventType",
            "declaration": "export type SessionEventType = keyof SessionEventMap;"
          },
          {
            "name": "SessionFollowFrame",
            "declaration": "export type SessionFollowFrame = { readonly type: 'snapshot'; readonly header: SessionWireHeader; readonly cursor: number; readonly records: readonly SessionHistoryRecord[]; readonly hasMore: boolean; readonly projections: SessionProjectionBaseline; readonly assistantStream?: SessionAssistantStreamBaseline; } | SessionEventEntry | { readonly type: 'assistant-stream'; readonly frame: SessionAssistantStreamFrame; };"
          },
          {
            "name": "SessionFollowRequest",
            "declaration": "export interface SessionFollowRequest extends Pick<SessionPageRequest, 'maxMessages' | 'turnWindow'> {\n    readonly address: SessionAddress;\n    readonly assistantStream?: true;\n}"
          },
          {
            "name": "SessionForkRequest",
            "declaration": "export interface SessionForkRequest {\n    readonly sessionId: SessionId;\n    readonly atSeq?: number;\n    readonly allowMigration?: boolean;\n}"
          },
          {
            "name": "SessionForkValue",
            "declaration": "export interface SessionForkValue {\n    readonly sessionId: SessionId;\n}"
          },
          {
            "name": "SessionHeader",
            "declaration": "export interface SessionHeader {\n    readonly version: typeof SESSION_FORMAT_VERSION;\n    readonly id: SessionId;\n    readonly createdAt: number;\n    readonly cwd?: string;\n    readonly parentSession?: SessionId;\n    readonly isSeeded: boolean;\n    readonly origin?: 'subagent';\n    readonly delegationDepth?: number;\n    readonly agentPreset?: string;\n}"
          },
          {
            "name": "SessionHistoryRecord",
            "declaration": "export type SessionHistoryRecord = SessionEventEntry;"
          },
          {
            "name": "SessionId",
            "declaration": "export type SessionId = Branded<'SessionId'>;"
          },
          {
            "name": "SessionInspection",
            "declaration": "export interface SessionInspection extends SessionStorageMetadata {\n    readonly events: readonly SessionEvent[];\n}"
          },
          {
            "name": "SessionListMetadata",
            "declaration": "export interface SessionListMetadata {\n    readonly blank: boolean;\n    readonly lastPromptAt: number | null;\n}"
          },
          {
            "name": "SessionListRequest",
            "declaration": "export interface SessionListRequest {\n    readonly cursor?: string;\n}"
          },
          {
            "name": "SessionListValue",
            "declaration": "export interface SessionListValue {\n    readonly items: readonly SessionSummary[];\n}"
          },
          {
            "name": "SessionLogOffset",
            "declaration": "export type SessionLogOffset = BrandedNumber<'SessionLogOffset'>;"
          },
          {
            "name": "SessionOpenWorkspacePathRequest",
            "declaration": "export interface SessionOpenWorkspacePathRequest {\n    readonly action?: 'reveal';\n    readonly application?: string;\n    readonly path: string;\n}"
          },
          {
            "name": "SessionOpenWorkspacePathValue",
            "declaration": "export interface SessionOpenWorkspacePathValue {\n    readonly opened: true;\n}"
          },
          {
            "name": "SessionPage",
            "declaration": "export interface SessionPage {\n    readonly records: readonly SessionHistoryRecord[];\n    readonly hasMore: boolean;\n}"
          },
          {
            "name": "SessionPageRequest",
            "declaration": "export interface SessionPageRequest {\n    readonly address: SessionAddress;\n    readonly throughSeq: number;\n    readonly beforeSeq?: number;\n    readonly maxMessages?: number;\n    readonly turnWindow?: { readonly minMessages: number; readonly minTurns: number; };\n}"
          },
          {
            "name": "SessionProjectionBaseline",
            "declaration": "export interface SessionProjectionBaseline {\n    readonly asOfSeq: number;\n    readonly values: SessionProjectionValues;\n}"
          },
          {
            "name": "SessionProjectionHints",
            "declaration": "export interface SessionProjectionHints {\n    readonly kind: 'cached' | 'sequenced';\n    readonly asOfSeq: number;\n    readonly values: SessionProjectionValues;\n}"
          },
          {
            "name": "SessionProjectionMap",
            "declaration": "export interface SessionProjectionMap {\n    inbox: InboxWireState;\n    workingDirectory: string | null;\n    agentPreset: string | null;\n    title: string | null;\n    todos: TodoItem[] | null;\n    sessionListMetadata: SessionListMetadata;\n    imageLimits: ImageAttachmentLimits;\n    modelSelection: ModelSelectionProjection;\n    permissions: PermissionSelection;\n    subagentCatalog: SubagentCatalogEntry[];\n    subagentTiming: SubagentTimingProjection;\n    subagent: SubagentIdentityProjection | null;\n    tokenUsage: TokenUsageProjection;\n    contextPressure: ContextPressureProjection;\n    contextBreakdown: ContextBreakdownProjection;\n    agentTeam: TeamProjection;\n    userQuestions: UserQuestionProjectionView;\n    goal: GoalProjection | null;\n    plan: PlanProjection;\n}"
          },
          {
            "name": "SessionProjectionsRequest",
            "declaration": "export interface SessionProjectionsRequest {\n    readonly sessionId: SessionId;\n}"
          },
          {
            "name": "SessionProjectionsValue",
            "declaration": "export type SessionProjectionsValue = (SessionProjectionBaseline & { readonly kind: 'sequenced'; }) | { readonly kind: 'migration-required'; readonly values: SessionProjectionValues; } | null;"
          },
          {
            "name": "SessionProjectionUpdate",
            "declaration": "export interface SessionProjectionUpdate {\n    readonly sessionId: SessionId;\n    readonly key: string;\n    readonly value: JsonValue;\n    readonly seq: number;\n}"
          },
          {
            "name": "SessionProjectionValue",
            "declaration": "export type SessionProjectionValue = JsonValue;"
          },
          {
            "name": "SessionProjectionValues",
            "declaration": "export type SessionProjectionValues = Partial<SessionProjectionMap> & Readonly<Record<string, SessionProjectionValue>>;"
          },
          {
            "name": "SessionPromptRequest",
            "declaration": "export interface SessionPromptRequest {\n    readonly requestId: SessionRequestId;\n    readonly sessionId: SessionId;\n    readonly mode: 'queue' | 'steer';\n    readonly content: readonly PromptContentPart[];\n    readonly clientTimeZone?: string;\n}"
          },
          {
            "name": "SessionPromptValue",
            "declaration": "export interface SessionPromptValue {\n    readonly accepted: true;\n}"
          },
          {
            "name": "SessionReferenceSource",
            "declaration": "export interface SessionReferenceSource {\n    kind: 'session-reference';\n    form: 'recall';\n    version: 1;\n    references: { sessionId: string; label: string; capturedFormatVersion?: number; capturedThroughSeq: OptionalSessionSeq; compacted: boolean; originalMessages: number; retainedMessages: number; omittedMessages: number; omittedBytes: number; truncated: boolean; inputIndex: number; }[];\n}"
          },
          {
            "name": "SessionRenameRequest",
            "declaration": "export interface SessionRenameRequest {\n    readonly sessionId: SessionId;\n    readonly title: string;\n}"
          },
          {
            "name": "SessionRenameValue",
            "declaration": "export interface SessionRenameValue {\n    readonly title: string;\n    readonly seq: number;\n}"
          },
          {
            "name": "SessionRequestId",
            "declaration": "export type SessionRequestId = Branded<'session-request-id'>;"
          },
          {
            "name": "SessionSearchItem",
            "declaration": "export interface SessionSearchItem {\n    readonly sessionId: SessionId;\n    readonly snippet: string;\n}"
          },
          {
            "name": "SessionSearchRequest",
            "declaration": "export interface SessionSearchRequest {\n    readonly query: string;\n}"
          },
          {
            "name": "SessionSearchValue",
            "declaration": "export interface SessionSearchValue {\n    readonly items: readonly SessionSearchItem[];\n    readonly hasMore: boolean;\n}"
          },
          {
            "name": "SessionSelectModelRequest",
            "declaration": "export interface SessionSelectModelRequest extends ModelSelection {\n    readonly sessionId: SessionId;\n}"
          },
          {
            "name": "SessionSelectModelValue",
            "declaration": "export interface SessionSelectModelValue {\n    readonly selected: ModelSelection;\n}"
          },
          {
            "name": "SessionSeq",
            "declaration": "export type SessionSeq = BrandedNumber<'SessionSeq'>;"
          },
          {
            "name": "SessionSeqCursor",
            "declaration": "export type SessionSeqCursor = SessionSeq | -1;"
          },
          {
            "name": "SessionStorageMetadata",
            "declaration": "export interface SessionStorageMetadata {\n    readonly meta: SessionHeader;\n    readonly inheritedEventCount: SessionLogOffset;\n}"
          },
          {
            "name": "SessionSummary",
            "declaration": "export interface SessionSummary {\n    readonly agentAvailable: boolean;\n    readonly formatStatus?: 'current' | 'migration-required';\n    readonly sessionId: SessionId;\n    readonly updatedAt: number;\n    readonly running: boolean;\n    readonly blank: boolean;\n    readonly parentSessionId?: SessionId;\n    readonly origin?: 'subagent';\n    readonly cwd?: string;\n    readonly projections?: SessionProjectionHints;\n}"
          },
          {
            "name": "SessionSurface",
            "declaration": "export interface SessionSurface {\n    readonly nodes: readonly SessionSeq[];\n    readonly replaceGeneration: number;\n    readonly contentGeneration: number;\n}"
          },
          {
            "name": "SessionTitleEventData",
            "declaration": "export interface SessionTitleEventData {\n    readonly title: string;\n    readonly messageSeqs: SessionSeq[];\n    readonly source: SessionTitleSource;\n}"
          },
          {
            "name": "SessionTitleModelIdentity",
            "declaration": "export interface SessionTitleModelIdentity {\n    readonly provider: string;\n    readonly model: string;\n}"
          },
          {
            "name": "SessionTitleProviderId",
            "declaration": "export type SessionTitleProviderId = Branded<'SessionTitleProviderId'>;"
          },
          {
            "name": "SessionTitleSource",
            "declaration": "export type SessionTitleSource = { readonly kind: 'fallback'; } | { readonly kind: 'provider'; readonly provider: SessionTitleProviderId; readonly model?: SessionTitleModelIdentity; } | { readonly kind: 'user'; };"
          },
          {
            "name": "SessionUpdateQueueRequest",
            "declaration": "export interface SessionUpdateQueueRequest {\n    readonly sessionId: SessionId;\n    readonly itemId: MessageId;\n    readonly action: QueueAction;\n}"
          },
          {
            "name": "SessionUpdateQueueValue",
            "declaration": "export interface SessionUpdateQueueValue {\n    readonly accepted: true;\n}"
          },
          {
            "name": "SessionWireEvent",
            "declaration": "export interface SessionWireEvent {\n    readonly type: string;\n    readonly seq: number;\n    readonly time: number;\n    readonly data: JsonValue;\n    readonly ignorable?: true;\n    readonly sourceEventSeqs?: JsonValue;\n    readonly surfaceOp?: JsonValue;\n}"
          },
          {
            "name": "SessionWireHeader",
            "declaration": "export interface SessionWireHeader {\n    readonly version: number;\n    readonly id: SessionId;\n    readonly createdAt: number;\n    readonly cwd?: string;\n    readonly parentSession?: SessionId;\n    readonly isSeeded: boolean;\n    readonly origin?: 'subagent';\n    readonly delegationDepth?: number;\n    readonly agentPreset?: string;\n}"
          },
          {
            "name": "SessionWorkspacePathApplication",
            "declaration": "export type SessionWorkspacePathApplication = NativeFileApplication;"
          },
          {
            "name": "SettledUserQuestion",
            "declaration": "export interface SettledUserQuestion {\n    readonly callId: ToolCallId;\n    readonly answers: readonly AskUserQuestionAnswerItem[];\n}"
          },
          {
            "name": "SkillInvocationSource",
            "declaration": "export interface SkillInvocationSource {\n    readonly kind: 'skill-invocation';\n    readonly name: string;\n    readonly form: 'instructions';\n}"
          },
          {
            "name": "StreamChunk",
            "declaration": "export type StreamChunk = { type: 'block-start'; index: number; blockType: ContentBlockType; } | { type: 'text-delta'; index: number; text: string; } | { type: 'reasoning-delta'; index: number; text: string; } | { type: 'tool-call-delta'; index: number; id: ToolCallId; name?: string; argumentsDelta: string; } | { type: 'block-end'; index: number; block: ContentBlock; } | { type: 'usage'; usage: TokenUsage; } | { type: 'finish'; reason: FinishReason; replayState?: ReplayEnvelope; };"
          },
          {
            "name": "SubagentCatalogEntry",
            "declaration": "export type SubagentCatalogEntry = { readonly id: SessionId; readonly createdAt: number; } & ({ readonly mode: 'one-shot'; readonly label?: string; } | { readonly mode: 'external'; readonly label?: string; } | { readonly mode: 'continuable'; readonly label: string; } | { readonly mode: 'unknown'; readonly label?: string; });"
          },
          {
            "name": "SubagentCatalogEvent",
            "declaration": "export type SubagentCatalogEvent = { readonly childId: SessionId; readonly childCreatedAt: number; } & (({ readonly version: 0; } & KnownCatalogMode) | ({ readonly version: 1; } & (KnownCatalogMode | { readonly mode: 'unknown'; readonly label?: string; })) | { readonly version: 2; readonly mode: 'external'; readonly label?: string; });"
          },
          {
            "name": "SubagentDescriptorBase",
            "declaration": "export interface SubagentDescriptorBase {\n    readonly version: number;\n    readonly mode: 'one-shot' | 'continuable';\n    readonly provider: string;\n}"
          },
          {
            "name": "SubagentDescriptorData",
            "declaration": "export type SubagentDescriptorData = OneShotSubagentDescriptorData | ContinuableSubagentDescriptorData;"
          },
          {
            "name": "SubagentIdentityProjection",
            "declaration": "export type SubagentIdentityProjection = { mode: 'one-shot'; label?: string; seq: SessionSeq; } | { mode: 'continuable'; label: string; seq: SessionSeq; };"
          },
          {
            "name": "SubagentSettledMessageSource",
            "declaration": "export interface SubagentSettledMessageSource {\n    readonly kind: 'subagent-settled';\n    readonly form: 'notice';\n    readonly summary: string;\n    readonly senderSessionId: SessionId;\n}"
          },
          {
            "name": "SubagentTimingProjection",
            "declaration": "export interface SubagentTimingProjection {\n    settledMs: number;\n    active?: { since: number; through: number; };\n    lastTurnCompleted?: boolean;\n}"
          },
          {
            "name": "SurfaceEventType",
            "declaration": "export type SurfaceEventType = 'system/message' | 'developer/message' | 'user/message' | 'assistant/message' | 'tool/result';"
          },
          {
            "name": "SurfaceIntent",
            "declaration": "export type SurfaceIntent<T extends SurfaceEventType = SurfaceEventType> = { surfaceOp: SurfaceOp; } & (T extends 'assistant/message' ? { sourceEventSeqs?: never; } : { sourceEventSeqs?: SessionSeq[]; });"
          },
          {
            "name": "SurfaceOp",
            "declaration": "export type SurfaceOp = 'append' | { op: 'replace'; startSeq: SessionSeq; endSeq: SessionSeq; };"
          },
          {
            "name": "SystemMessage",
            "declaration": "export interface SystemMessage extends MessageBase {\n    readonly role: 'system';\n    readonly source: MessageSourceMap['system-prompt'];\n}"
          },
          {
            "name": "SystemPromptMessageSource",
            "declaration": "export interface SystemPromptMessageSource {\n    kind: 'system-prompt';\n}"
          },
          {
            "name": "SystemPromptUpdate",
            "declaration": "export type SystemPromptUpdate = 'in-history';"
          },
          {
            "name": "TeamId",
            "declaration": "export type TeamId = Branded<'TeamId'>;"
          },
          {
            "name": "TeamMemberPhase",
            "declaration": "export type TeamMemberPhase = 'provisioning' | 'active' | 'failed';"
          },
          {
            "name": "TeamMemberProjection",
            "declaration": "export interface TeamMemberProjection {\n    readonly id: SessionId;\n    readonly name: string;\n    readonly role: 'lead' | 'teammate';\n    readonly phase: TeamMemberPhase;\n    readonly error?: string;\n}"
          },
          {
            "name": "TeamMemberSnapshot",
            "declaration": "export interface TeamMemberSnapshot {\n    readonly id: SessionId;\n    readonly name: string;\n    readonly description: string;\n    readonly provider: string;\n    readonly context: 'fresh' | 'fork';\n    readonly phase: TeamMemberPhase;\n    readonly error?: string;\n}"
          },
          {
            "name": "TeamMessageId",
            "declaration": "export type TeamMessageId = Branded<'TeamMessageId'>;"
          },
          {
            "name": "TeamMessageSnapshot",
            "declaration": "export interface TeamMessageSnapshot {\n    readonly id: TeamMessageId;\n    readonly senderId: SessionId;\n    readonly senderName: string;\n    readonly targetId: SessionId;\n    readonly content: ContentBlock[];\n}"
          },
          {
            "name": "TeamMessageSource",
            "declaration": "export interface TeamMessageSource {\n    readonly kind: 'team-message';\n    readonly teamId: TeamId;\n    readonly messageId: TeamMessageId;\n    readonly senderId: SessionId;\n    readonly senderName: string;\n}"
          },
          {
            "name": "TeamProjection",
            "declaration": "export interface TeamProjection {\n    readonly members: TeamMemberProjection[];\n    readonly tasks: TeamTaskView[];\n    readonly failure?: string;\n}"
          },
          {
            "name": "TeamTaskId",
            "declaration": "export type TeamTaskId = Branded<'TeamTaskId'>;"
          },
          {
            "name": "TeamTaskSnapshot",
            "declaration": "export interface TeamTaskSnapshot {\n    readonly id: TeamTaskId;\n    readonly revision: number;\n    readonly subject: string;\n    readonly description: string;\n    readonly status: TeamTaskStatus;\n    readonly ownerId?: SessionId;\n    readonly blockedBy: TeamTaskId[];\n    readonly writeScopes: string[];\n}"
          },
          {
            "name": "TeamTaskStatus",
            "declaration": "export type TeamTaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';"
          },
          {
            "name": "TeamTaskView",
            "declaration": "export interface TeamTaskView {\n    readonly id: TeamTaskId;\n    readonly revision: number;\n    readonly subject: string;\n    readonly description: string;\n    readonly status: TeamTaskStatus;\n    readonly blockedBy: TeamTaskId[];\n    readonly writeScopes: string[];\n    readonly ownerName?: string;\n    readonly ready: boolean;\n    readonly writeScopeWarnings: string[];\n}"
          },
          {
            "name": "TextBlock",
            "declaration": "export interface TextBlock {\n    type: 'text';\n    text: string;\n}"
          },
          {
            "name": "TodoItem",
            "declaration": "export interface TodoItem {\n    content: string;\n    status: 'pending' | 'in_progress' | 'completed';\n}"
          },
          {
            "name": "TokenUsage",
            "declaration": "export interface TokenUsage {\n    inputTokens: number;\n    outputTokens: number;\n    totalTokens?: number;\n    cacheReadTokens?: number;\n    cacheWriteTokens?: number;\n    reasoningTokens?: number;\n}"
          },
          {
            "name": "TokenUsageProjection",
            "declaration": "export interface TokenUsageProjection {\n    uncachedInputTokens: number;\n    outputTokens: number;\n    cacheReadTokens: number;\n    cacheWriteTokens: number;\n}"
          },
          {
            "name": "ToolAdditionBlock",
            "declaration": "export interface ToolAdditionBlock {\n    type: 'tool-addition';\n    toolName: string;\n    tool?: never;\n}"
          },
          {
            "name": "ToolCallBlock",
            "declaration": "export interface ToolCallBlock {\n    type: 'tool-call';\n    id: ToolCallId;\n    name: string;\n    arguments: string;\n}"
          },
          {
            "name": "ToolCallId",
            "declaration": "export type ToolCallId = Branded<'ToolCallId'>;"
          },
          {
            "name": "ToolHistory",
            "declaration": "export interface ToolHistory {\n    readonly tools: readonly ToolSchema[];\n    readonly updates: readonly { readonly messageId: MessageId; readonly additions: readonly ToolSchema[]; }[];\n}"
          },
          {
            "name": "ToolMessageSource",
            "declaration": "export interface ToolMessageSource {\n    kind: 'tool';\n    callId: ToolCallId;\n}"
          },
          {
            "name": "ToolRemovalBlock",
            "declaration": "export interface ToolRemovalBlock {\n    type: 'tool-removal';\n    toolName: string;\n}"
          },
          {
            "name": "ToolRestriction",
            "declaration": "export interface ToolRestriction {\n    readonly allow?: readonly string[];\n    readonly deny?: readonly string[];\n}"
          },
          {
            "name": "ToolResultMessage",
            "declaration": "export interface ToolResultMessage extends MessageBase {\n    readonly role: 'tool';\n    readonly source: ToolMessageSource;\n    readonly toolCallId: ToolCallId;\n    readonly isError?: boolean;\n}"
          },
          {
            "name": "ToolSchema",
            "declaration": "export interface ToolSchema {\n    deferLoading?: true;\n    name: string;\n    description: string;\n    parameters: Record<string, unknown>;\n}"
          },
          {
            "name": "TurnEndCancelCause",
            "declaration": "export type TurnEndCancelCause = AgentCancelCause | { readonly kind: 'legacy'; };"
          },
          {
            "name": "TurnEndReason",
            "declaration": "export type TurnEndReason = TurnEndReasonMap[keyof TurnEndReasonMap];"
          },
          {
            "name": "TurnEndReasonMap",
            "declaration": "export interface TurnEndReasonMap {\n    completed: { kind: 'completed'; };\n    aborted: { kind: 'aborted'; reason: TurnEndCancelCause; };\n    blocked: { kind: 'blocked'; };\n    error: { kind: 'error'; error: LlmFailure; };\n    'max-tokens': { kind: 'max-tokens'; };\n    interrupted: { kind: 'interrupted'; };\n    forked: { kind: 'forked'; };\n}"
          },
          {
            "name": "TypertGatewayFaultDetails",
            "declaration": "export interface TypertGatewayFaultDetails {\n    readonly endpoint: string;\n    readonly field?: string;\n}"
          },
          {
            "name": "UserMessage",
            "declaration": "export interface UserMessage extends MessageBase {\n    readonly role: 'user';\n}"
          },
          {
            "name": "UserQuestionProjectionView",
            "declaration": "export interface UserQuestionProjectionView {\n    readonly active: readonly PendingUserQuestion[];\n    readonly settled: readonly SettledUserQuestion[];\n}"
          },
          {
            "name": "UserQuestionState",
            "declaration": "export type UserQuestionState = 'open' | 'continued';"
          },
          {
            "name": "WebhookDeliveryId",
            "declaration": "export type WebhookDeliveryId = Branded<'WebhookDeliveryId'>;"
          },
          {
            "name": "WebhookRuleId",
            "declaration": "export type WebhookRuleId = Branded<'WebhookRuleId'>;"
          },
          {
            "name": "WebhookSourceId",
            "declaration": "export type WebhookSourceId = Branded<'WebhookSourceId'>;"
          },
          {
            "name": "WorkspaceId",
            "declaration": "export type WorkspaceId = Branded<'WorkspaceId'>;"
}) // __DSH_FRAGMENT_END__

export {};
