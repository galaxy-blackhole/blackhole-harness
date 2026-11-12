/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN typert.host.js (phần 568–1134) — KHÔNG sửa tay; build.ts ghép rồi cổng byte + cổng ownership
 */
// @ts-nocheck

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
            "name": "ModelMessageSource",
            "declaration": "export interface ModelMessageSource extends AssistantProviderMetadata {\n    kind: 'model';\n}"
          },
          {
            "name": "ModelSelection",
            "declaration": "export interface ModelSelection {\n    readonly provider: string;\n    readonly model: string;\n    readonly reasoningEffort?: string;\n}"
          },
          {
            "name": "ObjectJsonSchema",
            "declaration": "export type ObjectJsonSchema = JsonSchemaNode & { type: 'object'; };"
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
            "name": "Principal",
            "declaration": "export type Principal = PrincipalMap[keyof PrincipalMap];"
          },
          {
            "name": "PrincipalMap",
            "declaration": "export interface PrincipalMap {\n    owner: { readonly kind: 'owner'; };\n}"
          },
          {
            "name": "PromptContentPart",
            "declaration": "export type PromptContentPart = { readonly type: 'text'; readonly text: string; } | { readonly type: 'image'; readonly mediaType: ImageMediaType; readonly data: string; readonly name?: string; };"
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
            "name": "ReasoningBlock",
            "declaration": "export interface ReasoningBlock {\n    type: 'reasoning';\n    text: string;\n}"
          },
          {
            "name": "ReasoningEffortId",
            "declaration": "export type ReasoningEffortId = Branded<'ReasoningEffortId'>;"
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
            "name": "ResolvedSubagentStartRequest",
            "declaration": "export interface ResolvedSubagentStartRequest extends SubagentStartRequest {\n    readonly cwd: string;\n}"
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
            "name": "SessionEvent",
            "declaration": "export type SessionEvent<T extends SessionEventType = SessionEventType> = { [K in SessionEventType]: { type: K; seq: SessionSeq; time: number; data: SessionEventMap[K]; ignorable?: true; } & (K extends SurfaceEventType ? SurfaceIntent<K> : { surfaceOp?: never; sourceEventSeqs?: never; }) }[T];"
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
            "name": "SessionHeader",
            "declaration": "export interface SessionHeader {\n    readonly version: typeof SESSION_FORMAT_VERSION;\n    readonly id: SessionId;\n    readonly createdAt: number;\n    readonly cwd?: string;\n    readonly parentSession?: SessionId;\n    readonly isSeeded: boolean;\n    readonly origin?: 'subagent';\n    readonly delegationDepth?: number;\n    readonly agentPreset?: string;\n}"
          },
          {
            "name": "SessionId",
            "declaration": "export type SessionId = Branded<'SessionId'>;"
          },
          {
            "name": "SessionLogOffset",
            "declaration": "export type SessionLogOffset = BrandedNumber<'SessionLogOffset'>;"
          },
          {
            "name": "SessionReferenceSource",
            "declaration": "export interface SessionReferenceSource {\n    kind: 'session-reference';\n    form: 'recall';\n    version: 1;\n    references: { sessionId: string; label: string; capturedFormatVersion?: number; capturedThroughSeq: OptionalSessionSeq; compacted: boolean; originalMessages: number; retainedMessages: number; omittedMessages: number; omittedBytes: number; truncated: boolean; inputIndex: number; }[];\n}"
          },
          {
            "name": "SessionRequestId",
            "declaration": "export type SessionRequestId = Branded<'session-request-id'>;"
          },
          {
            "name": "SessionSeq",
            "declaration": "export type SessionSeq = BrandedNumber<'SessionSeq'>;"
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
            "name": "SkillInvocationSource",
            "declaration": "export interface SkillInvocationSource {\n    readonly kind: 'skill-invocation';\n    readonly name: string;\n    readonly form: 'instructions';\n}"
          },
          {
            "name": "StreamChunk",
            "declaration": "export type StreamChunk = { type: 'block-start'; index: number; blockType: ContentBlockType; } | { type: 'text-delta'; index: number; text: string; } | { type: 'reasoning-delta'; index: number; text: string; } | { type: 'tool-call-delta'; index: number; id: ToolCallId; name?: string; argumentsDelta: string; } | { type: 'block-end'; index: number; block: ContentBlock; } | { type: 'usage'; usage: TokenUsage; } | { type: 'finish'; reason: FinishReason; replayState?: ReplayEnvelope; };"
          },
          {
            "name": "SubagentActivation",
            "declaration": "export interface SubagentActivation {\n    readonly childId: SessionId;\n    readonly messageId?: MessageId;\n    readonly result: Promise<SubagentResult>;\n    dispose(): Promise<void>;\n}"
          },
          {
            "name": "SubagentActivationSpec",
            "declaration": "export interface SubagentActivationSpec {\n    readonly provider: string;\n    readonly label: string;\n    readonly childId?: SessionId;\n    readonly request: Omit<SubagentStartRequest, 'label' | 'signal'>;\n    readonly signal: AbortSignal;\n    readonly delivery: 'parent' | 'caller';\n}"
          },
          {
            "name": "SubagentCapabilities",
            "declaration": "export interface SubagentCapabilities {\n    readonly agentOptions: boolean;\n    readonly agentPreset: boolean;\n    readonly outputSchema: boolean;\n    readonly depthLimit: boolean;\n}"
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
            "name": "SubagentCatalogRow",
            "declaration": "export type SubagentCatalogRow = { readonly id: SessionId; readonly activity: 'running' | 'inactive'; } & ({ readonly mode: 'one-shot'; readonly label?: string; } | { readonly mode: 'external'; readonly label?: string; } | { readonly mode: 'continuable'; readonly label: string; });"
          },
          {
            "name": "SubagentDescendantListEntry",
            "declaration": "export type SubagentDescendantListEntry = SubagentListEntry & { readonly parentId: SessionId; readonly depth: number; };"
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
            "name": "SubagentInterruptAuthority",
            "declaration": "export type SubagentInterruptAuthority = { readonly kind: 'user'; readonly parentSessionId: SessionId; } | { readonly kind: 'ancestor'; readonly agent: Agent; };"
          },
          {
            "name": "SubagentInterruptReceipt",
            "declaration": "export interface SubagentInterruptReceipt {\n    readonly accepted: true;\n}"
          },
          {
            "name": "SubagentListEntry",
            "declaration": "export type SubagentListEntry = SubagentCatalogRow & { readonly kind: 'child'; readonly hasChildren: boolean; } | { readonly kind: 'diagnostic'; readonly id: SessionId; readonly reason: 'corrupt' | 'unsupported' | 'unavailable'; };"
          },
          {
            "name": "SubagentPromptReceipt",
            "declaration": "export interface SubagentPromptReceipt {\n    readonly messageId: MessageId;\n}"
          },
          {
            "name": "SubagentPromptRequest",
            "declaration": "export interface SubagentPromptRequest {\n    readonly requestId: SubagentPromptRequestId;\n    readonly parentSessionId: SessionId;\n    readonly childSessionId: SessionId;\n    readonly mode: 'continuable';\n    readonly delivery: 'queue' | 'steer';\n    readonly content: readonly PromptContentPart[];\n    readonly clientTimeZone?: string;\n}"
          },
          {
            "name": "SubagentPromptRequestId",
            "declaration": "export type SubagentPromptRequestId = Branded<'session-request-id'>;"
          },
          {
            "name": "SubagentProvider",
            "declaration": "export interface SubagentProvider {\n    readonly name: string;\n    readonly capabilities: SubagentCapabilities;\n    readonly inheritsParentContext: boolean;\n    readonly agentRouteDefaults?: Readonly<{ provider: string; model: string; }>;\n    start?(request: ResolvedSubagentStartRequest): Promise<SubagentRun>;\n    prepareContinuable?(request: ContinuableCreateRequest): Promise<ContinuableCreateSpec>;\n}"
          },
          {
            "name": "SubagentResult",
            "declaration": "export interface SubagentResult {\n    readonly output: readonly ContentBlock[];\n    readonly structured?: unknown;\n    readonly diagnostic?: string;\n    readonly stopReason: SubagentStopReason;\n}"
          },
          {
            "name": "SubagentRun",
            "declaration": "export interface SubagentRun {\n    readonly id: SessionId;\n    readonly result: Promise<SubagentResult>;\n    dispose(): Promise<void>;\n}"
          },
          {
            "name": "SubagentSendMessageOptions",
            "declaration": "export interface SubagentSendMessageOptions {\n    readonly signal: AbortSignal;\n}"
          },
          {
            "name": "SubagentSettledMessageSource",
            "declaration": "export interface SubagentSettledMessageSource {\n    readonly kind: 'subagent-settled';\n    readonly form: 'notice';\n    readonly summary: string;\n    readonly senderSessionId: SessionId;\n}"
          },
          {
            "name": "SubagentStartRequest",
            "declaration": "export interface SubagentStartRequest {\n    readonly cwd?: string;\n    readonly agentPreset?: string;\n    readonly label?: string;\n    readonly prompt: ContentBlock[];\n    readonly parent: Agent;\n    readonly signal: AbortSignal;\n    readonly agentOptions?: AgentOptions;\n    readonly outputSchema?: ObjectJsonSchema;\n    readonly maxDepth?: number;\n}"
          },
          {
            "name": "SubagentStopReason",
            "declaration": "export type SubagentStopReason = SubagentStopReasonMap[keyof SubagentStopReasonMap];"
          },
          {
            "name": "SubagentStopReasonMap",
            "declaration": "export interface SubagentStopReasonMap {\n    completed: 'completed';\n    aborted: 'aborted';\n    error: 'error';\n    'max-tokens': 'max-tokens';\n    refusal: 'refusal';\n}"
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
            "name": "UserMessage",
            "declaration": "export interface UserMessage extends MessageBase {\n    readonly role: 'user';\n}"
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
          }
        ]
      }
    ],
    "events": [
      {
        "description": "A published child settled. Scope-filtered dispatch uses the same delegating parent carrier as `subagent/start`, so the lifecycle pair reaches the same scoped audience.",
        "summary": "A published child settled.",
        "tags": [
          {
            "name": "param",
            "argument": "info",
            "comment": "- the run identity and terminal outcome.",
            "text": "@param info - the run identity and terminal outcome.\n     *"
          },
          {
            "name": "mode",
            "comment": "emit",
            "text": "@mode emit"
          }
        ],
        "jsDoc": "/**\n * A published child settled. Scope-filtered dispatch uses the same delegating\n * parent carrier as `subagent/start`, so the lifecycle pair reaches the\n * same scoped audience.\n * @param info - the run identity and terminal outcome.\n * @mode emit\n */",
        "name": "subagent/end",
        "mode": "emit",
        "signature": "'subagent/end'(this: Scoped<SubagentRuntime>, info: SubagentRunEndInfo): void"
      },
      {
        "description": "A provider became resolvable in the registry.",
        "summary": "A provider became resolvable in the registry.",
        "tags": [
          {
            "name": "param",
            "argument": "provider",
            "comment": "- the registered provider.",
            "text": "@param provider - the registered provider.\n     *"
          },
          {
            "name": "mode",
            "comment": "emit",
            "text": "@mode emit"
          }
        ],
        "jsDoc": "/**\n * A provider became resolvable in the registry.\n * @param provider - the registered provider.\n * @mode emit\n */",
        "name": "subagent/provider-added",
        "mode": "emit",
        "signature": "'subagent/provider-added'(provider: SubagentProvider): void"
      },
      {
        "description": "A provider left the registry. Accepted runs remain holder-owned.",
        "summary": "A provider left the registry.",
        "tags": [
          {
            "name": "param",
            "argument": "name",
            "comment": "- the provider name that no longer resolves.",
            "text": "@param name - the provider name that no longer resolves.\n     *"
          },
          {
            "name": "mode",
            "comment": "emit",
            "text": "@mode emit"
          }
        ],
        "jsDoc": "/**\n * A provider left the registry. Accepted runs remain holder-owned.\n * @param name - the provider name that no longer resolves.\n * @mode emit\n */",
        "name": "subagent/provider-removed",
        "mode": "emit",
        "signature": "'subagent/provider-removed'(name: string): void"
      },
      {
        "description": "A provider established a published child. For in-process providers, `ctx.agents.get(info.id)` resolves during this notification. Scope-filtered dispatch keys the carrier by the delegating parent, so a parent-scoped listener observes only its own delegations. Paired with `subagent/end`.",
        "summary": "A provider established a published child.",
        "tags": [
          {
            "name": "param",
            "argument": "info",
            "comment": "- the provider and published child identity.",
            "text": "@param info - the provider and published child identity.\n     *"
          },
          {
            "name": "mode",
            "comment": "emit",
            "text": "@mode emit"
          }
        ],
        "jsDoc": "/**\n * A provider established a published child. For in-process providers,\n * `ctx.agents.get(info.id)` resolves during this notification.\n * Scope-filtered dispatch keys the carrier by the delegating parent, so a\n * parent-scoped listener observes only its own delegations. Paired with\n * `subagent/end`.\n * @param info - the provider and published child identity.\n * @mode emit\n */",
        "name": "subagent/start",
        "mode": "emit",
        "signature": "'subagent/start'(this: Scoped<SubagentRuntime>, info: SubagentRunInfo): void"
      }
    ],
    "objects": []
  },
}

export {};
