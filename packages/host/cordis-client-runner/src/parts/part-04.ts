/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-cordis-client-runner/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() {[{ // __DSH_FRAGMENT_BEGIN__
				parameters: [{
					name: "snapshot",
					description: "Current immutable theme snapshot."
				}]
			}
		];
		/** Shapes of every exported type the Service and Event signatures reference (transitively), sorted by name. */
		const TYPE_API = [
			{
				name: "ActionsDecl",
				declaration: "export type ActionsDecl<T> = Record<string, (draft: T, ...params: any[]) => void>;"
			},
			{
				name: "AgentContext",
				declaration: "export type AgentContext = Omit<Context, 'remote'> & {\n    readonly remote: ClientRemote & TypertRemoteScopeApi<'agent'>;\n};"
			},
			{
				name: "AssistantLiveChunkEvent",
				declaration: "export interface AssistantLiveChunkEvent {\n    readonly type: 'assistant/live-chunk';\n    readonly seq: number;\n    readonly time: number;\n    readonly data: {\n        readonly attemptId: LlmAttemptId;\n        readonly turn: number;\n        readonly step: number;\n        readonly chunk: StreamChunk;\n    };\n}"
			},
			{
				name: "BakedActions",
				declaration: "export type BakedActions<T, A extends ActionsDecl<T>> = {\n    [K in keyof A]: A[K] extends (draft: T, ...params: infer P) => void ? (...params: P) => void : never;\n};"
			},
			{
				name: "BeginSubmissionInput",
				declaration: "export interface BeginSubmissionInput {\n    readonly mode: 'queue' | 'steer';\n    readonly text: string;\n    readonly attachments: readonly PendingSubmissionAttachment[];\n    readonly onRetire?: (retirement: PendingSubmissionRetirement) => void;\n}"
			},
			{
				name: "BoundActions",
				declaration: "export type BoundActions<H> = H extends StoreHandle<infer T, infer A> ? BakedActions<T, A> : never;"
			},
			{
				name: "BuiltInLocaleId",
				declaration: "export type BuiltInLocaleId = typeof LOCALE_IDS[number];"
			},
			{
				name: "ChainKeysOf",
				declaration: "export type ChainKeysOf<S extends keyof SlotMap & string> = S extends unknown ? (SlotMap[S]['kind'] extends 'chain' ? S : never) : never;"
			},
			{
				name: "ChainRenderOpts",
				declaration: "export interface ChainRenderOpts {\n    fallback?: ReactNode;\n    fallbackOnly?: boolean;\n    overlay?: boolean;\n}"
			},
			{
				name: "ChildrenDecl",
				declaration: "export type ChildrenDecl = {\n    [P in keyof SlotMap & string]?: SlotSpec<SlotMap[P]>;\n};"
			},
			{
				name: "ClientConnectionRpc",
				declaration: "export interface ClientConnectionRpc {\n    call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<ConnectionRpcResult<unknown>>;\n    readonly open?: (channel: string, endpoint: string, payload: unknown, signal: AbortSignal, uplink?: AsyncIterable<unknown>) => AsyncIterable<unknown>;\n}"
			},
			{
				name: "ClientRemote",
				declaration: "export interface ClientRemote extends TypertClientRemote {\n    $stream<Item>(options: RemoteStreamOptions<Item>): RemoteStream<Item>;\n    readonly $host: RemoteHostFacts;\n}"
			},
			{
				name: "CommonKeyOf",
				declaration: "export type CommonKeyOf = LocaleNamespaceMap extends {\n    common: infer C;\n} ? C & string : never;"
			},
			{
				name: "ComposedProps",
				declaration: "export type ComposedProps<K extends keyof SlotMap & string, EntryKey extends EntryKeyOf<K>, S extends keyof SlotMap & string, H, I extends object, M = never, N = undefined> = PropsRuntime<K, EntryKey> & PropsRenderSlots<S> & PropsRenderFactories & PropsStore<H> & InjectFace<I> & MatchedShare<SlotMap[K], M> & PropsLocale<N>;"
			},
			{
				name: "ConnectionGeneration",
				declaration: "export interface ConnectionGeneration {\n    readonly id: number;\n    readonly host: ConnectionHostInfo;\n}"
			},
			{
				name: "ConnectionGenerationSource",
				declaration: "export type ConnectionGenerationSource = (signal: AbortSignal, ready: (host: ConnectionHostInfo) => void) => Promise<void>;"
			},
			{
				name: "ConnectionGenerationState",
				declaration: "export interface ConnectionGenerationState {\n    getSnapshot(): ConnectionGeneration | undefined;\n    subscribe(listener: () => void): () => void;\n}"
			},
			{
				name: "ConnectionHandle",
				declaration: "export interface ConnectionHandle {\n    readonly interactions: ConnectionInteractions;\n    readonly isLoopback: boolean;\n    readonly generation: ConnectionGenerationState;\n    readonly state: ConnectionStateSource;\n    readonly rpc: ClientConnectionRpc;\n    openWebSocket(path: string): ConnectionWebSocket;\n    reconnect(): void;\n    registerGenerationSource(source: ConnectionGenerationSource): () => void;\n    start(sinks: ConnectionSinks, config?: ConnectionRecoveryConfig): ConnectionLoop;\n}"
			},
			{
				name: "ConnectionHostInfo",
				declaration: "export interface ConnectionHostInfo {\n    readonly home: string;\n}"
			},
			{
				name: "ConnectionInteractions",
				declaration: "export type ConnectionInteractions = 'answer' | 'none';"
			},
			{
				name: "ConnectionLoop",
				declaration: "export interface ConnectionLoop {\n    stop(): void;\n}"
			},
			{
				name: "ConnectionRecoveryConfig",
				declaration: "export interface ConnectionRecoveryConfig {\n    backoffBaseMs?: number;\n    backoffFactor?: number;\n    backoffMaxMs?: number;\n    generationReadyWarnMs?: number;\n    generationReadyTimeoutMs?: number;\n}"
			},
			{
				name: "ConnectionRpcFailure",
				declaration: "export interface ConnectionRpcFailure {\n    readonly code: string;\n    readonly message: string;\n    readonly details: object;\n}"
			},
			{
				name: "ConnectionRpcResult",
				declaration: "export type ConnectionRpcResult<T> = {\n    readonly ok: true;\n    readonly value: T;\n} | {\n    readonly ok: false;\n    readonly error: ConnectionRpcFailure;\n};"
			},
			{
				name: "ConnectionSinks",
				declaration: "export interface ConnectionSinks {\n    onConnected?: (host: ConnectionHostInfo) => void;\n    onStateChange?: (state: ConnectionState) => void;\n    onReconnectRequested?: () => void;\n}"
			},
			{
				name: "ConnectionState",
				declaration: "export type ConnectionState = 'connected' | 'disconnected' | 'connecting';"
			},
			{
				name: "ConnectionStateSource",
				declaration: "export interface ConnectionStateSource {\n    getSnapshot(): ConnectionState | undefined;\n    subscribe(listener: () => void): () => void;\n}"
			},
			{
				name: "ConnectionWebSocket",
				declaration: "export interface ConnectionWebSocket {\n    readonly readyState: number;\n    send(data: string): void;\n    close(code?: number, reason?: string): void;\n    addEventListener<Event extends keyof ConnectionWebSocketEventMap>(event: Event, listener: (event: ConnectionWebSocketEventMap[Event]) => void, options?: {\n        readonly once?: boolean;\n    }): void;\n    removeEventListener<Event extends keyof ConnectionWebSocketEventMap>(event: Event, listener: (event: ConnectionWebSocketEventMap[Event]) => void): void;\n}"
			},
			{
				name: "ConnectionWebSocketEventMap",
				declaration: "export interface ConnectionWebSocketEventMap {\n    readonly open: object;\n    readonly error: object;\n    readonly close: object;\n    readonly message: {\n        readonly data: unknown;\n    };\n}"
			},
			{
				name: "DraftInitializationOptions",
				declaration: "export interface DraftInitializationOptions {\n    readonly prompt?: string;\n    readonly clearPreviousDraft?: boolean;\n}"
			},
			{
				name: "EntryKeyOf",
				declaration: "export type EntryKeyOf<K extends keyof SlotMap & string> = SlotMap[K] extends {\n    kind: 'keyed';\n    keyProps: infer P extends object;\n} ? keyof P & string : string;"
			},
			{
				name: "FactoryComponentPropsOf",
				declaration: "export type FactoryComponentPropsOf<F extends keyof SlotFactoryMap & string> = FactoryInputPropsOf<F> & FactoryRegistrationPropsOf<F> & ScopeStandardProps<FactoryDefOf<F>['scope']> & {\n    useFactorySlot: UseFactorySlot<F>;\n};"
			},
			{
				name: "FactoryInjectParams",
				declaration: "export type FactoryInjectParams<F extends keyof SlotFactoryMap & string> = FactoryDefOf<F>['scope'] extends 'session' ? ([\n    FactoryStoreOf<F>\n] extends [\n    StoreDecl\n] ? [\n    sessionId: SessionIdOf,\n    actions: BoundActions<FactoryStoreOf<F>>\n] : [\n    sessionId: SessionIdOf\n]) : FactoryDefOf<F>['scope'] extends 'session-maybe' ? ([\n    FactoryStoreOf<F>\n] extends [\n    StoreDecl\n] ? [\n    sessionId: SessionIdOf | undefined,\n    actions: BoundActions<FactoryStoreOf<F>> | undefined\n] : [\n    sessionId: SessionIdOf | undefined\n]) : ([\n    FactoryStoreOf<F>\n] extends [\n    StoreDecl\n] ? [\n    actions: BoundActions<FactoryStoreOf<F>>\n] : [\n]);"
			},
			{
				name: "FactoryLocalComponent",
				declaration: "export type FactoryLocalComponent<F extends keyof SlotFactoryMap & string, N extends FactoryLocalNameOf<F>> = SlotComponent<FactoryLocalComponentPropsOf<F, N>>;"
			},
			{
				name: "FactoryLocalComponentPropsOf",
				declaration: "export type FactoryLocalComponentPropsOf<F extends keyof SlotFactoryMap & string, N extends FactoryLocalNameOf<F>> = FactoryLocalInputPropsOf<F, N> & FactoryRegistrationPropsOf<F> & ScopeStandardProps<FactoryLocalDefOf<F, N>['scope']>;"
			},
			{
				name: "FactoryRegistrationPropsOf",
				declaration: "export type FactoryRegistrationPropsOf<F extends keyof SlotFactoryMap & string> = FactoryRenderPropsOf<F> & PropsStore<FactoryStoreOf<F>> & InjectFace<FactoryInjectOf<F>> & PropsLocale<FactoryLocaleOf<F>> & PropsRenderFactories;"
			},
			{
				name: "FontFamilies",
				declaration: "export type FontFamilies = Readonly<Record<FontRole, string>>;"
			},
			{
				name: "FontRole",
				declaration: "export type FontRole = typeof FONT_ROLES[number];"
			},
			{
				name: "FontSizes",
				declaration: "export type FontSizes = Readonly<Record<FontRole, number>>;"
			},
			{
				name: "GlobalStandardProps",
				declaration: "export interface GlobalStandardProps {\n}"
			},
			{
				name: "HandleOf",
				declaration: "export type HandleOf<H> = H extends () => infer R ? R : H;"
			},
			{
				name: "HooksSources",
				declaration: "export type HooksSources = Record<string, HostObservable<unknown>>;"
			},
			{
				name: "HostObservable",
				declaration: "export type HostObservable<T> = ObservableSnapshot<T>;"
			},
			{
				name: "InjectFace",
				declaration: "export type InjectFace<I extends object> = I extends {\n    hooks: infer HS extends HooksSources;\n} ? I extends {\n    keyedHooks: infer KS extends KeyedHooksSources;\n} ? Omit<I, 'hooks' | 'keyedHooks'> & PropsHooks<HS> & PropsKeyedHooks<KS> : Omit<I, 'hooks'> & PropsHooks<HS> : I extends {\n    keyedHooks: infer KS extends KeyedHooksSources;\n} ? Omit<I, 'keyedHooks'> & PropsKeyedHooks<KS> : I;"
			},
			{
				name: "InjectParams",
				declaration: "export type InjectParams<K extends keyof SlotMap & string, H> = ScopeOf<K> extends 'session' ? ([\n    H\n] extends [\n    StoreDecl\n] ? [\n    sessionId: SessionIdOf,\n    actions: BoundActions<HandleOf<H>>\n] : [\n    sessionId: SessionIdOf\n]) : ScopeOf<K> extends 'session-maybe' ? ([\n    H\n] extends [\n    StoreDecl\n] ? [\n    sessionId: SessionIdOf | undefined,\n    actions: BoundActions<HandleOf<H>> | undefined\n] : [\n    sessionId: SessionIdOf | undefined\n]) : ([\n    H\n] extends [\n    StoreDecl\n] ? [\n    actions: BoundActions<HandleOf<H>>\n] : [\n]);"
			},
			{
				name: "ISession",
				declaration: "export interface ISession {\n    readonly sessionId: SessionId;\n    readonly projections: ProjectionsFace;\n    beginSubmission(input: BeginSubmissionInput): SubmissionHandle;\n    prompt(content: PromptContentPart[], mode: 'queue' | 'steer', signal?: AbortSignal, requestId?: SessionRequestId): Promise<RemoteResult<{\n        accepted: true;\n    }>>;\n    readAttachment(attachmentId: AttachmentIdType): Promise<RemoteResult<{\n        attachment: ImageAttachmentRef;\n        data: Uint8Array;\n    }>>;\n    updateQueue(itemId: MessageId, action: QueueAction): Promise<RemoteResult<{\n        accepted: true;\n    }>>;\n    cancel(): Promise<RemoteResult<{\n        accepted: true;\n    }>>;\n    rename(title: string): Promise<RemoteResult<{\n        title: string;\n        seq: SessionSeq;\n    }>>;\n    loadOlder(): Promise<void>;\n    loadThrough(seq: SessionSeq): Promise<void>;\n    command(line: string): Promise<RemoteResult<{\n        matched: boolean;\n    }>>;\n}"
			},
			{
				name: "ISessions",
				declaration: "export interface ISessions {\n    readonly list: ObservableSnapshot<SessionListState>;\n    retain(target: SessionTarget, options: SessionRetainOptions): SessionReference;\n    using<T>(target: SessionTarget, options: SessionRetainOptions, operation: (reference: SessionReference) => T | Promise<T>): Promise<T>;\n    retainInfo(id: SessionId): ObservableSnapshot<SessionRetainInfo>;\n    readonly searchResultLimit: number;\n    create(opts?: {\n        workspaceId?: WorkspaceId;\n        cwd?: string;\n        sessionId?: SessionId;\n        agentPreset?: string;\n    }): Promise<SessionId>;\n    subagentAddress(id: SessionId): SubagentAddress | undefined;\n    refreshProjections(sessionId: SessionId): Promise<void>;\n    refresh(): Promise<void>;\n    search(query: string, signal: AbortSignal): Promise<RemoteResult<{\n        items: SessionSearchResultItem[];\n        hasMore: boolean;\n    }>>;\n    fork(opts: {\n        sessionId: SessionId;\n        atSeq?: number;\n        increaseTitle?: boolean;\n        onCreated?: (childId: SessionId) => void;\n        allowMigration?: boolean;\n    }): Promise<SessionId>;\n    scope(id: SessionId): AgentContext | undefined;\n    scopeOf(ctx: Context): SessionId | undefined;\n    sessionOf(ctx: Context): SessionFace | undefined;\n    binding(id: SessionId): SessionBinding | undefined;\n}"
			},
			{
				name: "KeyedHooksSources",
				declaration: "export type KeyedHooksSources = Record<string, KeyedStandardSource>;"
			},
			{
				name: "KeyedSnapshotSelectorHook",
				declaration: "export type KeyedSnapshotSelectorHook<Snapshot> = {\n    (key: string): Snapshot | undefined;\n    <Selected>(key: string, selector: (value: Snapshot | undefined) => Selected, equal?: (left: Selected, right: Selected) => boolean): Selected;\n};"
			},
			{
				name: "KeyedStandardSource",
				declaration: "export type KeyedStandardSource = (key: string, member?: string) => HostObservable<unknown> | undefined;"
			},
			{
				name: "KeyPropsOf",
				declaration: "export type KeyPropsOf<K extends keyof SlotMap & string, EntryKey extends EntryKeyOf<K>> = SlotMap[K] extends {\n    kind: 'keyed';\n    keyProps: infer P extends object;\n} ? EntryKey extends keyof P ? P[EntryKey] extends object ? P[EntryKey] : never : never : object;"
			},
			{
				name: "LanguageRegistration",
				declaration: "export interface LanguageRegistration {\n    id: LocaleId;\n    label: string;\n    fallback: LocaleId;\n}"
			},
			{
				name: "LiveCompositionNode",
				declaration: "export type LiveCompositionNode = LiveSlotNode | LiveFactoryNode;"
			},
			{
				name: "LiveFactoryNode",
				declaration: "export interface LiveFactoryNode {\n    type: 'factory';\n    name: string;\n    scope: SlotScope;\n    registrant?: string;\n    children: LiveSlotNode[];\n}"
			},
			{
				name: "LiveSlotNode",
				declaration: "export interface LiveSlotNode {\n    type: 'slot';\n    name: string;\n    kind: SlotKind;\n    scope: SlotScope;\n    declaredBy?: string;\n    occupants: LiveSlotOccupant[];\n    children: LiveSlotNode[];\n}"
			},
			{
				name: "LiveSlotOccupant",
				declaration: "export interface LiveSlotOccupant {\n    registrant?: string;\n    key?: string;\n    id?: string;\n    order?: number;\n    priority: number;\n    active: boolean;\n}"
			},
			{
				name: "LocaleDefinition",
				declaration: "export interface LocaleDefinition {\n    readonly id: LocaleId;\n    readonly label: string;\n    readonly fallback?: LocaleId;\n}"
			},
			{
				name: "LocaleDict",
				declaration: "export type LocaleDict = Record<string, string>;"
			},
			{
				name: "LocaleDictOf",
				declaration: "export type LocaleDictOf<N extends keyof LocaleNamespaceMap & string> = Record<LocaleNamespaceMap[N] & string, string>;"
			},
			{
				name: "LocaleId",
				declaration: "export type LocaleId = string;"
			},
			{
				name: "LocaleKeysOf",
				declaration: "export type LocaleKeysOf<N extends keyof LocaleNamespaceMap & string> = (LocaleNamespaceMap[N] & string) | CommonKeyOf;"
			},
			{
				name: "LocaleNamespaceMap",
				declaration: "export interface LocaleNamespaceMap {\n}"
			},
			{
				name: "LocaleSnapshot",
				declaration: "export interface LocaleSnapshot {\n    active: LocaleId;\n    locales: readonly LocaleDefinition[];\n    revision: number;\n}"
			},
			{
				name: "MainPanelId",
				declaration: "export type MainPanelId = Branded<'MainPanelId'>;"
			},
			{
				name: "MatchedShare",
				declaration: "export type MatchedShare<E extends SlotEntryDef, M> = E['kind'] extends 'chain' ? {\n    matched: M;\n} : object;"
			},
			{
				name: "ObservableSnapshot",
				declaration: "export interface ObservableSnapshot<T> {\n    getSnapshot(): T;\n    subscribe(fn: () => void): () => void;\n}"
			},
			{
				name: "OpenState",
				declaration: "export type OpenState = 'cold' | 'loading' | 'open' | 'error';"
			},
			{
				name: "OwnerOf",
				declaration: "export type OwnerOf<K extends keyof SlotMap & string> = SlotMap[K] extends {\n    owner: infer O extends object;\n} ? O : object;"
			},
			{
				name: "PendingSubmission",
				declaration: "export interface PendingSubmission {\n    readonly requestId: SessionRequestId;\n    readonly placement: PendingSubmissionPlacement;\n    readonly time: number;\n    readonly text: string;\n    readonly attachments: readonly PendingSubmissionAttachment[];\n}"
			},
			{
				name: "PendingSubmissionAttachment",
				declaration: "export type PendingSubmissionAttachment = PendingSubmissionImageAttachment | PendingSubmissionFileAttachment;"
			},
			{
				name: "PendingSubmissionFileAttachment",
				declaration: "export interface PendingSubmissionFileAttachment {\n    readonly type: 'file';\n    readonly value: FileAttachmentRef;\n}"
			},
			{
				name: "PendingSubmissionImage",
				declaration: "export interface PendingSubmissionImage {\n    readonly previewUrl: string;\n    readonly name?: string;\n    readonly width?: number;\n    readonly height?: number;\n}"
			},
			{
				name: "PendingSubmissionImageAttachment",
				declaration: "export interface PendingSubmissionImageAttachment {\n    readonly type: 'image';\n    readonly value: PendingSubmissionImage;\n}"
			},
			{
				name: "PendingSubmissionPlacement",
				declaration: "export type PendingSubmissionPlacement = 'transcript' | 'queued' | 'steering';"
			},
			{
				name: "PendingSubmissionRetirement",
				declaration: "export type PendingSubmissionRetirement = {\n    readonly reason: 'observed';\n    readonly attachments: readonly (ImageAttachmentRef | FileAttachmentRef)[];\n} | {\n    readonly reason: 'failed';\n};"
			},
			{
				name: "ProjectionsFace",
				declaration: "export interface ProjectionsFace {\n    faceOf(key: string): ObservableSnapshot<unknown>;\n}"
			},
			{
				name: "PromptContentPart",
				declaration: "export type PromptContentPart = {\n    readonly type: 'text';\n    readonly text: string;\n} | {\n    readonly type: 'image';\n    readonly mediaType: ImageMediaType;\n    readonly data: string;\n    readonly name?: string;\n} | {\n    readonly type: 'file';\n    readonly receiptId: Branded<'file-upload-receipt-id'>;\n};"
			},
			{
				name: "PromptError",
				declaration: "export interface PromptError {\n    readonly op: 'send' | 'stop';\n    readonly error: RemoteFailure;\n}"
			},
			{
				name: "PropsHooks",
				declaration: "export type PropsHooks<HS extends HooksSources> = {\n    [N in keyof HS & string as `use${Capitalize<N>}`]: SnapshotSelectorHook<HS[N] extends HostObservable<infer T> ? T : never>;\n};"
			},
			{
				name: "PropsKeyedHooks",
				declaration: "export type PropsKeyedHooks<HS extends KeyedHooksSources> = {\n    [N in keyof HS & string as `use${Capitalize<N>}`]: KeyedSnapshotSelectorHook<HS[N] extends (key: string) => HostObservable<infer T> | undefined ? T : never>;\n};"
			},
			{
				name: "PropsLocale",
				declaration: "export type PropsLocale<N> = N extends keyof LocaleNamespaceMap & string ? {\n    t: TranslateNS<N>;\n} : object;"
			},
			{
				name: "PropsRenderFactories",
				declaration: "export interface PropsRenderFactories {\n    renderFactorySlot: RenderFactorySlot;\n}"
			},
			{
				name: "PropsRenderSlots",
				declaration: "export type PropsRenderSlots<S extends keyof SlotMap & string> = {\n    renderSlot: RenderSlotFn<Exclude<S, ChainKeysOf<S>>>;\n    readonly __renders?: ((key: S) => void) | undefined;\n} & ([\n    ChainKeysOf<S>\n] extends [\n    never\n] ? object : {\n    renderSlotChain: <K extends ChainKeysOf<S>>(key: K, owner: OwnerOf<K>, opts?: ChainRenderOpts) => ReactNode;\n}) & ([\n    Extract<ScopeOf<S>, 'session' | 'session-maybe'>\n] extends [\n    never\n] ? object : {\n    SessionProvider: SessionProviderComponent;\n});"
			},
			{
				name: "PropsRuntime",
				declaration: "export type PropsRuntime<K extends keyof SlotMap & string, EntryKey extends EntryKeyOf<K> = EntryKeyOf<K>> = OwnerOf<K> & KeyPropsOf<K, EntryKey> & SlotInjectFace<SlotInjectOf<K>> & ScopeStandardProps<ScopeOf<K>>;"
			},
			{
				name: "PropsSlotHooks",
				declaration: "export type PropsSlotHooks<HS extends object> = {\n    [N in keyof HS & string as `use${Capitalize<N>}`]: BoundHookOf<HS[N]>;\n};"
			},
			{
				name: "PropsStore",
				declaration: "export type PropsStore<H> = H extends StoreHandle<infer T, infer A> ? {\n    useStore: SnapshotSelectorHook<T>;\n    actions: BakedActions<T, A>;\n} : object;"
			},
			{
				name: "QueueAction",
				declaration: "export type QueueAction = {\n    readonly kind: 'edit';\n    readonly content: readonly TextBlock[];\n} | {\n    readonly kind: 'remove';\n} | {\n    readonly kind: 'steer';\n};"
			},
			{
				name: "RegisterFactory",
				declaration: "export interface RegisterFactory {\n    <F extends keyof SlotFactoryMap & string>(options: RegisterFactoryOptions<F>, component: SlotComponent<FactoryComponentPropsOf<F>>): () => void;\n}"
			},
			{
				name: "RegisterFactoryOptions",
				declaration: "export type RegisterFactoryOptions<F extends keyof SlotFactoryMap & string> = {\n    name: F;\n    scope: FactoryDefOf<F>['scope'];\n} & FactoryField<F, 'children', FactoryChildrenOf<F>> & FactoryField<F, 'store', FactoryStoreOf<F> | (() => FactoryStoreOf<F>)> & FactoryField<F, 'inject', (...args: FactoryInjectParams<F>) => FactoryInjectOf<F>> & FactoryField<F, 'locale', FactoryLocaleOf<F>> & FactoryField<F, 'slots', RuntimeFactorySlots<F>> & FactoryCollisionCheck<F> & FactoryChildrenCheck<F>;"
			},
			{
				name: "RemoteHostFacts",
				declaration: "export interface RemoteHostFacts {\n    readonly home: string | undefined;\n    readonly isLoopback: boolean;\n}"
			},
			{
				name: "RemoteStream",
				declaration: "export class RemoteStream<Item> implements AsyncIterable<RemoteStreamItem<Item>> {\n    constructor(private readonly connection: Pick<ConnectionHandle, 'generation'>, private readonly options: RemoteStreamOptions<Item>);\n    get signal(): AbortSignal;\n    restart(): void;\n    dispose(): Promise<void>;\n    [Symbol.asyncIterator](): AsyncIterator<RemoteStreamItem<Item>>;\n}"
			},
			{
				name: "RemoteStreamCarrierError",
				declaration: "export class RemoteStreamCarrierError extends Error {\n    constructor(message: string, options?: ErrorOptions);\n}"
			},
			{
				name: "RemoteStreamItem",
				declaration: "export interface RemoteStreamItem<Item> {\n    readonly generation: number;\n    readonly value: Item;\n    readonly signal: AbortSignal;\n    accept(): void;\n}"
			},
			{
				name: "RemoteStreamOptions",
				declaration: "export interface RemoteStreamOptions<Item> {\n    readonly name: string;\n    readonly open: (signal: AbortSignal) => AsyncIterable<Item>;\n    readonly ended: (accepted: boolean) => Error;\n    readonly carrierFailed?: (error: RemoteStreamCarrierError) => void;\n}"
			},
			{
				name: "RenderFactorySlot",
				declaration: "export type RenderFactorySlot = <F extends keyof SlotFactoryMap & string>(name: F, props: FactoryInputPropsOf<F>, options?: {\n    slots?: Partial<{\n        [N in FactoryLocalNameOf<F>]: FactoryLocalComponent<F, N>;\n    }>;\n    fallback?: ReactNode;\n}) => ReactNode;"
			},
			{
				name: "ScopeOf",
				declaration: "export type ScopeOf<K extends keyof SlotMap & string> = SlotMap[K]['scope'];"
			},
			{
				name: "ScopeStandardProps",
				declaration: "export type ScopeStandardProps<S extends SlotScope> = (S extends 'session' ? SessionStandardProps : S extends 'session-maybe' ? SessionMaybeStandardProps : object) & GlobalStandardProps;"
			},
			{
				name: "SessionAreaProps",
				declaration: "export interface SessionAreaProps {\n    readonly session?: SlotScopeTargetMap[keyof SlotScopeTargetMap & 'session'] | undefined;\n    empty?: (() => ReactNode) | undefined;\n    children: ReactNode;\n}"
			},
			{
				name: "SessionAssistantSettlementEntry",
				declaration: "export interface SessionAssistantSettlementEntry {\n    readonly type: 'event';\n    readonly event: SessionEvent<'assistant/message'> | SessionEvent<'assistant/attempt'>;\n}"
			},
			{
				name: "SessionBinding",
				declaration: "export interface SessionBinding {\n    readonly sessionId: SessionId;\n    readonly session: SessionFace;\n    readonly eventSource: SessionEventSource;\n    readonly ctx: AgentContext;\n}"
			},
			{
				name: "SessionEventChange",
				declaration: "export type SessionEventChange = {\n    readonly kind: 'replace';\n    readonly entries: readonly SessionEventLikeEntry[];\n} | {\n    readonly kind: 'prepend';\n    readonly entries: readonly SessionEventLikeEntry[];\n} | {\n    readonly kind: 'append';\n    readonly entries: readonly SessionEventLikeEntry[];\n} | {\n    readonly kind: 'settle-assistant';\n    readonly attemptId: LlmAttemptId;\n    readonly entry?: SessionAssistantSettlementEntry;\n};"
			},
			{
				name: "SessionEventLikeEntry",
				declaration: "export type SessionEventLikeEntry = {\n    readonly type: 'event';\n    readonly event: SessionEvent;\n} | {\n    readonly type: 'transient';\n    readonly event: AssistantLiveChunkEvent;\n};"
			},
			{
				name: "SessionEventSource",
				declaration: "export type SessionEventSource = ObservableSnapshot<SessionEventWindow>;"
			},
			{
				name: "SessionEventWindow",
				declaration: "export interface SessionEventWindow {\n    readonly entries: readonly SessionEventLikeEntry[];\n    readonly hasMore: boolean;\n    readonly revision: number;\n    readonly change: SessionEventChange;\n}"
			},
			{
				name: "SessionFace",
				declaration: "export type SessionFace = ISession & ObservableSnapshot<SessionSnapshot>;"
			},
			{
				name: "SessionIdOf",
				declaration: "export type SessionIdOf = SessionStandardProps extends {\n    sessionId: infer S;\n} ? S : string;"
			},
			{
				name: "SessionListPhase",
				declaration: "export type SessionListPhase = 'pending' | 'ready';"
			},
			{
				name: "SessionListState",
				declaration: "export interface SessionListState {\n    ids: SessionId[];\n    byId: Record<SessionId, SessionSummary>;\n    phase: SessionListPhase;\n    projectionsBySession: Readonly<Record<SessionId, SessionProjectionSnapshot>>;\n}"
			},
			{
				name: "SessionMaybeStandardProps",
				declaration: "export interface SessionMaybeStandardProps {\n}"
			},
			{
				name: "SessionProjectionSnapshot",
				declaration: "export interface SessionProjectionSnapshot {\n    readonly values: Readonly<Partial<SessionProjectionMap>>;\n    readonly state: 'idle' | 'loading' | 'ready' | 'migration-required' | 'error';\n    readonly error: RemoteFailure | null;\n}"
			},
			{
				name: "SessionProviderComponent",
				declaration: "export type SessionProviderComponent = (props: SessionAreaProps) => ReactNode;"
			},
			{
				name: "SessionReference",
				declaration: "export interface SessionReference extends Disposable {\n    readonly sessionId: SessionId;\n    readonly binding: SessionBinding;\n    readonly ready: Promise<SessionBinding>;\n    release(): void;\n}"
			},
			{
				name: "SessionReferenceSource",
				declaration: "export type SessionReferenceSource = Extract<keyof SessionReferenceSourceMap, string>;"
			},
			{
				name: "SessionReferenceSourceMap",
				declaration: "export interface SessionReferenceSourceMap {\n    controllerOperation: unknown;\n    gateway: unknown;\n}"
			},
			{
				name: "SessionRequestId",
				declaration: "export type SessionRequestId = Branded<'session-request-id'>;"
			},
			{
				name: "SessionRetainInfo",
				declaration: "export interface SessionRetainInfo {\n    readonly referenceCount: number;\n    readonly retainedBy: Readonly<Partial<Record<SessionReferenceSource, number>>>;\n}"
			},
			{
				name: "SessionRetainOptions",
				declaration: "export interface SessionRetainOptions {\n    readonly source: SessionReferenceSource;\n    readonly signal?: AbortSignal | undefined;\n}"
			},
			{
				name: "SessionSearchResultItem",
				declaration: "export interface SessionSearchResultItem {\n    sessionId: SessionId;\n    snippet: string;\n}"
			},
			{
				name: "SessionSnapshot",
				declaration: "export interface SessionSnapshot {\n    readonly sessionId: SessionId;\n    readonly pendingSubmissions: readonly PendingSubmission[];\n    readonly running: boolean;\n    readonly subagent: {\n        readonly address: SubagentAddress;\n        readonly parentAvailable?: boolean;\n    } | null;\n    readonly removed: boolean;\n    readonly openState: OpenState;\n    readonly openError: RemoteFailure | null;\n    readonly hasMore: boolean;\n    readonly loadingOlder: boolean;\n    readonly promptError: PromptError | null;\n    readonly blank: boolean;\n    readonly lastAgentError: string | null;\n    readonly promptAttempted: boolean;\n    readonly awaitingFirstTurn: boolean;\n}"
			},
			{
				name: "SessionStandardProps",
				declaration: "export interface SessionStandardProps {\n}"
			},
			{
				name: "SessionTarget",
				declaration: "export type SessionTarget = SessionId | SubagentAddress;"
			},
			{
				name: "SlotComponent",
				declaration: "export type SlotComponent<P> = (props: P) => ReactNode;"
			},
			{
				name: "SlotCore",
				declaration: "export class SlotCore {\n    constructor();\n    readonly registerFactory: RegisterFactory;\n    factory(name: string): StoredFactory | undefined;\n    factoryVersion(name: string): number;\n    subscribeFactory(name: string, listener: () => void): () => void;\n    isFactoryLive(definition: StoredFactory): boolean;\n    register<K extends keyof SlotMap & string, const EntryKey extends EntryKeyOf<K> = EntryKeyOf<K>, const D extends ChildrenDecl = Record<never, never>, H extends StoreDecl | undefined = undefined, M = never, N extends (keyof LocaleNamespaceMap & string) | undefined = undefined, C extends SlotComponent<never> = SlotComponent<never>>(options: BaseOptions<K, EntryKey, D, H, M, N> & {\n        inject?: undefined;\n    }, component: C & SlotComponent<ComposedProps<K, NoInfer<EntryKey>, keyof NoInfer<D> & keyof SlotMap & string, HandleOf<NoInfer<H>>, object, NoInfer<M>, NoInfer<N>>> & RendersCheck<C, D>): () => void;\n    register<K extends keyof SlotMap & string, I extends object, const EntryKey extends EntryKeyOf<K> = EntryKeyOf<K>, const D extends ChildrenDecl = Record<never, never>, H extends StoreDecl | undefined = undefined, M = never, N extends (keyof LocaleNamespaceMap & string) | undefined = undefined, C extends SlotComponent<never> = SlotComponent<never>>(options: BaseOptions<K, EntryKey, D, H, M, N> & {\n        inject: (...args: InjectParams<K, H>) => I;\n    }, component: C & SlotComponent<ComposedProps<K, NoInfer<EntryKey>, keyof NoInfer<D> & keyof SlotMap & string, HandleOf<NoInfer<H>>, I, NoInfer<M>, NoInfer<N>>> & RendersCheck<C, D>): () => void;\n    register(options: ErasedOptions, component: unknown): () => void;\n    isLive(entry: StoredEntry): boolean;\n    entries(key: string): readonly StoredEntry[];\n    entriesOfSlot(key: string): readonly StoredEntry[];\n    spec<K extends keyof SlotMap & string>(key: K): SlotSpec<SlotMap[K]> | undefined;\n    specDynamic(key: string): SlotSpec<SlotEntryDef> | undefined;\n    snapshot(root?: string): LiveCompositionNode[];\n    declarationEpoch(key: string): number;\n    subscribe(key: string, fn: () => void): () => void;\n    subscribeDeclaration(key: string, fn: () => void): () => void;\n    getVersion(key: string): number;\n    onMutate(fn: (key: string) => void): () => void;\n    reportEntryError(key: string, entry: StoredEntry, error: unknown, info: {\n        abdicate: boolean;\n    }): void;\n    reportFactoryError(name: string, registration: StoredEntry | StoredFactory, error: unknown): void;\n    onEntryError(fn: (key: string, registration: StoredEntry | StoredFactory, error: unknown, info: {\n        abdicated: boolean;\n    }) => void): () => void;\n}"
			},
			{
				name: "SlotEntryDef",
				declaration: "export interface SlotEntryDef {\n    kind: SlotKind;\n    scope: SlotScope;\n    inline?: true;\n    owner?: object;\n    keyProps?: Record<string, object>;\n    hookContext?: unknown;\n    inject?: object;\n}"
			},
			{
				name: "SlotFactoryMap",
				declaration: "export interface SlotFactoryMap {\n}"
			},
			{
				name: "SlotInjectFace",
				declaration: "export type SlotInjectFace<I extends object> = I extends {\n    hooks: infer HS extends object;\n} ? Omit<I, 'hooks'> & PropsSlotHooks<HS> : I;"
			},
			{
				name: "SlotInjectOf",
				declaration: "export type SlotInjectOf<K extends keyof SlotMap & string> = SlotMap[K] extends {\n    inject: infer Injected extends object;\n} ? Injected : object;"
			},
			{
				name: "SlotKind",
				declaration: "export type SlotKind = 'single' | 'list' | 'keyed' | 'chain';"
			},
			{
				name: "SlotLabel",
				declaration: "export type SlotLabel = string | (() => string);"
			},
			{
				name: "SlotMap",
				declaration: "export interface SlotMap {\n}"
			},
			{
				name: "SlotScope",
				declaration: "export type SlotScope = 'root' | 'session-maybe' | 'session';"
			},
			{
				name: "SlotScopeTargetMap",
				declaration: "export interface SlotScopeTargetMap {\n}"
			},
			{
				name: "SlotSpec",
				declaration: "export type SlotSpec<E extends SlotEntryDef> = {\n    kind: E['kind'];\n    scope: E['scope'];\n    inline?: true;\n} & ('inject' extends keyof E ? E extends {\n    inject: infer Injected extends object;\n} ? {\n    inject: Injected;\n} : {\n    inject?: object;\n} : {\n    inject?: never;\n});"
			},
			{
				name: "SnapshotSelectorHook",
				declaration: "export type SnapshotSelectorHook<T> = <S>(sel: (s: T) => S, eq?: (a: S, b: S) => boolean) => S;"
			},
			{
				name: "StartSessionOptions",
				declaration: "export interface StartSessionOptions extends DraftInitializationOptions {\n    readonly agentPreset?: string;\n}"
			},
			{
				name: "StoreDecl",
				declaration: "export type StoreDecl = StoreHandle<any, any> | StoreFactory;"
			},
			{
				name: "StoredEntry",
				declaration: "export interface StoredEntry {\n    component: unknown;\n    options: {\n        key?: string;\n        id?: string;\n        order?: number;\n        label?: SlotLabel;\n        priority?: number;\n    };\n    select?: ((owner: never) => unknown) | undefined;\n    inject?: ((...args: never[]) => Record<string, unknown>) | undefined;\n    children?: Readonly<Record<string, SlotSpec<SlotEntryDef>>> | undefined;\n    store?: StoreDecl | undefined;\n    locale?: string | undefined;\n    registrant?: string | undefined;\n}"
			},
			{
				name: "StoredFactory",
				declaration: "export interface StoredFactory {\n    readonly name: string;\n    readonly component: unknown;\n    readonly scope: SlotScope;\n    readonly children?: Readonly<Record<string, SlotSpec<SlotEntryDef>>> | undefined;\n    readonly store?: StoreDecl | undefined;\n    readonly inject?: ((...args: never[]) => Record<string, unknown>) | undefined;\n    readonly locale?: string | undefined;\n    readonly slots?: Readonly<Record<string, {\n        scope: SlotScope;\n    }>> | undefined;\n    readonly registrant?: string | undefined;\n}"
			},
			{
				name: "StoreFactory",
				declaration: "export type StoreFactory = () => StoreHandle<any, any>;"
			},
			{
				name: "StoreHandle",
				declaration: "export interface StoreHandle<T, A extends ActionsDecl<T>> {\n    readonly spec: StoreSpec<T, A>;\n    create(scopeKey?: string): StoreInstance<T, A>;\n}"
			},
			{
				name: "StoreInstance",
				declaration: "export interface StoreInstance<T, A extends ActionsDecl<T>> {\n    readonly actions: BakedActions<T, A>;\n    getSnapshot(): T;\n    subscribe(fn: () => void): () => void;\n    clearPersisted(): void;\n}"
			},
			{
				name: "StoreSpec",
				declaration: "export interface StoreSpec<T, A extends ActionsDecl<T>> {\n    init: () => T;\n    persist?: string;\n    actions: A;\n}"
			},
			{
				name: "SubmissionHandle",
				declaration: "export interface SubmissionHandle {\n    readonly requestId: SessionRequestId;\n    abandon(): void;\n}"
			},
			{
				name: "ThemeDefinition",
				declaration: "export interface ThemeDefinition {\n    id: string;\n    colorScheme: 'light' | 'dark';\n    tokens: ThemeTokens;\n}"
			},
			{
				name: "ThemePreference",
				declaration: "export type ThemePreference = typeof THEME_PREFERENCES[number];"
			},
			{
				name: "ThemeSnapshot",
				declaration: "export interface ThemeSnapshot {\n    preference: ThemePreference;\n    fontSizes: FontSizes;\n    fontFamilies: FontFamilies;\n    active: ThemeDefinition;\n    themes: readonly ThemeDefinition[];\n    revision: number;\n}"
			},
			{
				name: "ThemeTokenModes",
				declaration: "export interface ThemeTokenModes {\n    light: string;\n    dark: string;\n}"
			},
			{
				name: "ThemeTokenOverrides",
				declaration: "export type ThemeTokenOverrides = Record<string, ThemeTokenModes>;"
			},
			{
				name: "ThemeTokens",
				declaration: "export type ThemeTokens = Record<string, string>;"
			},
			{
				name: "TranslateNS",
				declaration: "export type TranslateNS<N extends keyof LocaleNamespaceMap & string> = Translate<LocaleKeysOf<N>>;"
			},
			{
				name: "UseFactorySlot",
				declaration: "export type UseFactorySlot<F extends keyof SlotFactoryMap & string> = <N extends FactoryLocalNameOf<F>>(name: N, fallback: FactoryLocalComponent<F, N>) => SlotComponent<FactoryLocalInputPropsOf<F, N>>;"
			},
			{
				name: "WorkspaceView",
				declaration: "export interface WorkspaceView {\n    readonly workspaceId: WorkspaceId;\n    readonly path: string;\n    readonly title: string;\n    readonly sessionIds: readonly SessionId[];\n    readonly createdAt: string;\n    readonly updatedAt: string;\n}"
			}
		];
		function referencedTypeClosure(seeds) {
			const included = /* @__PURE__ */ new Set();
			let frontier = [...seeds];
			while (frontier.length > 0) {
				const next = [];
				for (const entry of TYPE_API) {
					if (included.has(entry.name)) continue;
					const pattern = new RegExp(`\\b${entry.name}\\b`);
					if (!frontier.some((text) => pattern.test(text))) continue;
					included.add(entry.name);
					next.push(entry.declaration);
				}
				frontier = next;
			}
			return TYPE_API.filter((entry) => included.has(entry.name));
		}
		function contextProperty(key) {
			return /^[A-Za-z_$][\w$]*$/.test(key) ? `ctx.${key}` : `ctx[${JSON.stringify(key)}]`;
		}
		/**
		* Project the Service Catalog as a compact directory or one exact coding contract.
		* @param key - exact Service key; omit it to list all Services and method signatures.
		* @param services - platform-specific visible Service entries.
		* @returns compact navigation data or one detailed Service with its referenced type closure.
		*/
		function queryServiceApi(key, services = SERVICE_API) {
			if (key === void 0) return {
				mode: "catalog",
				services: services.map((service) => ({
					key: service.key,
					description: service.summary,
					methods: service.methods.map((method) => ({ signature: method.signature }))
				}))
			};
			const service = services.find((candidate) => candidate.key === key);
			if (service === void 0) throw new Error(`no catalogued Service named "${key}"`);
			return {
				mode: "service",
				service: {
					key: service.key,
					description: service.description,
					access: {
						optional: {
							expression: `ctx.get(${JSON.stringify(service.key)})`,
							requiresUndefinedCheck: true
						},
						hardDependency: {
							inject: [service.key],
							expression: contextProperty(service.key)
						}
					},
					methods: service.methods
				},
				referencedTypes: referencedTypeClosure(service.methods.map((method) => method.signature))
			};
		}
		/**
		* Project the Event Catalog as a compact directory or one exact listener contract.
		* @param name - exact Event name; omit it to list all Events and listener signatures.
		* @param events - platform-specific visible Event entries.
		* @returns compact navigation data or one detailed Event with its referenced type closure.
		*/
		function queryEventApi(name, events = EVENT_API) {
			if (name === void 0) return {
				mode: "catalog",
				events: events.map((event) => ({
					name: event.name,
					description: event.summary,
					mode: event.mode,
					signature: event.signature
				}))
			};
			const event = events.find((candidate) => candidate.name === name);
			if (event === void 0) throw new Error(`no catalogued Event named "${name}"`);
			return {
				mode: "event",
				event: {
					name: event.name,
					description: event.description,
					mode: event.mode,
					signature: event.signature,
					parameters: event.parameters
				},
				referencedTypes: referencedTypeClosure([event.signature])
			};
		}
		//#endregion
} // __DSH_FRAGMENT_END__

export {};
