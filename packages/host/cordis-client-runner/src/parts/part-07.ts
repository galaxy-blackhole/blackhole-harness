/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-cordis-client-runner/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() {[{ // __DSH_FRAGMENT_BEGIN__
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'conversation.session.header' (client-ui-conversation), so it exists while that entry is mounted",
				occupants: [
					"client-ui-open-in-app SessionOpenInAppAction id 'open-in-app'",
					"client-ui-schedule ScheduleCatalogAction id 'schedule-catalog'",
					"session-log-export SessionLogDownloadHeaderAction id 'session-log-download'"
				],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register(\n      { name: 'conversation.session.header.utilities', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-conversation/src/client/contract/slots.ts:235"
			},
			{
				key: "conversation.trajectory.images",
				kind: "single",
				scope: "session",
				summary: "Renderer for one group of durable record images in the Trajectory ledger.",
				doc: "Renderer for one group of durable record images in the Trajectory\nledger. The owner supplies image references, an authorized loader, and\nalignment. A registration replaces the shipped gallery; without one,\nimages are omitted.",
				registerOptions: [],
				ownerProps: ["/** Message image group handed to the optional attachment presentation plugin. */\nexport interface MessageImagesOwnerProps {\n  /** Durable references or submission-echo previews in source order. */\n  images: readonly MessageImageSource[]\n  /** Session-authorized image URL loader for the durable arm. */\n  loadImage: MessageImageLoader\n  /** Horizontal placement inside the owning record. */\n  align: 'start' | 'end'\n  /** Force every image into the compact message-attachment tile size. */\n  compact?: boolean\n  /** Fixed, uncropped thumbnail for an attachment list row. */\n  thumbnail?: boolean\n}"],
				ownerPropsReferences: [
					"Message",
					"MessageImageLoader",
					"MessageImageSource"
				],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean",
					"useChat: UseChat",
					"useConversation: UseConversation",
					"useInput: SnapshotSelectorHook<InputState>",
					"inputActions: InputActions",
					"useSession: SessionSnapshotSelector",
					"sessionId: SessionId",
					"useProjection: UseProjection",
					"useAccess: (action: RemoteEndpoint) => boolean",
					"useTrajectory: UseTrajectory"
				],
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'conversation.view' (client-ui-trajectory), so it exists while that entry is mounted",
				occupants: ["client-ui-attachment MessageImages"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('conversation.trajectory.images', () => ctx.slots.register(\n      { name: 'conversation.trajectory.images' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-trajectory/src/client/trajectory-contract.ts:103"
			},
			{
				key: "conversation.user.text.node",
				kind: "keyed",
				scope: "session",
				summary: "One business-owned inline renderer for a pure JSON text node.",
				doc: "One business-owned inline renderer for a pure JSON text node.",
				registerOptions: [{
					name: "key",
					requirement: "required",
					type: "string",
					doc: "Your cell key: the entry renders where the owner dispatches this exact key. Registering an already-occupied key replaces that occupant."
				}],
				ownerProps: ["/** JSON-only owner data common to every business text node. */\nexport interface UserTextNodeOwnerProps {\n  readonly raw: string\n  readonly interactive: boolean\n}"],
				ownerPropsReferences: [],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean",
					"useChat: UseChat",
					"useConversation: UseConversation",
					"useInput: SnapshotSelectorHook<InputState>",
					"inputActions: InputActions",
					"useSession: SessionSnapshotSelector",
					"sessionId: SessionId",
					"useProjection: UseProjection",
					"useAccess: (action: RemoteEndpoint) => boolean",
					"useTrajectory: UseTrajectory"
				],
				keyDomain: "fixed by the owner's key table { [Id in UserTextId]: { node: UserTextNode<Id> } }, already taken: command, file, folder, secret, session, skill, text",
				hookContext: "",
				slotInject: "",
				declaredBy: "factory 'conversation.user.text' (client-ui-conversation), so it exists while that definition is registered",
				occupants: [
					"client-ui-conversation PlainUserText key 'text'",
					"client-ui-conversation SessionReference key 'session'",
					"client-ui-goal GoalCommandReference key 'command'",
					"client-ui-reference FileReference key 'file'",
					"client-ui-reference FolderReference key 'folder'",
					"client-ui-secret-mask SecretText key 'secret'",
					"client-ui-skill SkillReference key 'skill'"
				],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('conversation.user.text.node', () => ctx.slots.register(\n      { name: 'conversation.user.text.node', key: '<one key the owner dispatches>' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-conversation/src/client/contract/slots.ts:196"
			},
			{
				key: "conversation.view",
				kind: "list",
				scope: "session",
				summary: "Registered Conversation target Views, rendered one at a time.",
				doc: "Registered Conversation target Views, rendered one at a time.",
				registerOptions: [
					{
						name: "id",
						requirement: "required",
						type: "string",
						doc: "Your cell key. Use an id of your own: a fresh id is added beside the shipped entries, while reusing a shipped id puts you in THAT cell and replaces it. Owners that filter by id address you by it."
					},
					{
						name: "order",
						requirement: "optional",
						type: "number",
						doc: "Position among the entries, ascending (default 0)."
					},
					{
						name: "label",
						requirement: "optional",
						type: "string | (() => string)",
						doc: "Display text where the owner projects one (nav rows, tabs). A thunk is re-read on every projection, so localized text follows the active locale without re-registering."
					}
				],
				ownerProps: ["/** Conversation View entries obtain their data from registered standard hooks. */\nexport interface ConvViewOwnerProps {\n  /** Open a tool call's inspector when an inspection target is available. */\n  inspectCall: ((callId: string) => void) | undefined\n  /** Focus request addressed to the selected View. */\n  viewRequest: import('./views.ts').ConversationViewRequest | null\n  /** Select a View and address one opaque focus identity to it. */\n  openView: (view: string, focus: string) => void\n  /** Acknowledge the current one-shot focus request. */\n  completeViewRequest: () => void\n}"],
				ownerPropsReferences: ["ConversationViewRequest"],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean",
					"useChat: UseChat",
					"useConversation: UseConversation",
					"useInput: SnapshotSelectorHook<InputState>",
					"inputActions: InputActions",
					"useSession: SessionSnapshotSelector",
					"sessionId: SessionId",
					"useProjection: UseProjection",
					"useAccess: (action: RemoteEndpoint) => boolean",
					"useTrajectory: UseTrajectory"
				],
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'conversation.session' (client-ui-conversation), so it exists while that entry is mounted",
				occupants: ["client-ui-chat ChatView id 'chat'", "client-ui-trajectory TrajectoryView id 'trajectory'"],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('conversation.view', () => ctx.slots.register(\n      { name: 'conversation.view', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-conversation/src/client/contract/slots.ts:258"
			},
			{
				key: "deliverables.file.actions",
				kind: "list",
				scope: "session",
				summary: "Open one file through its authorized Session event coordinates.",
				doc: "Open one file through its authorized Session event coordinates.",
				registerOptions: [
					{
						name: "id",
						requirement: "required",
						type: "string",
						doc: "Your cell key. Use an id of your own: a fresh id is added beside the shipped entries, while reusing a shipped id puts you in THAT cell and replaces it. Owners that filter by id address you by it."
					},
					{
						name: "order",
						requirement: "optional",
						type: "number",
						doc: "Position among the entries, ascending (default 0)."
					},
					{
						name: "label",
						requirement: "optional",
						type: "string | (() => string)",
						doc: "Display text where the owner projects one (nav rows, tabs). A thunk is re-read on every projection, so localized text follows the active locale without re-registering."
					}
				],
				ownerProps: ["/** Native file action selected by an explicit user gesture. */\nexport type PresentedAction = 'open' | 'reveal'", "/** Failure feedback for the shared native opening control. */\nexport type PresentedOpenFailure = 'openError' | 'revealError' | null"],
				ownerPropsReferences: [],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean",
					"useChat: UseChat",
					"useConversation: UseConversation",
					"useInput: SnapshotSelectorHook<InputState>",
					"inputActions: InputActions",
					"useSession: SessionSnapshotSelector",
					"sessionId: SessionId",
					"useProjection: UseProjection",
					"useAccess: (action: RemoteEndpoint) => boolean",
					"useTrajectory: UseTrajectory"
				],
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'conversation.chat.turnTail' (client-ui-deliverables), so it exists while that entry is mounted",
				occupants: ["client-ui-open-in-app FileRouteAction id 'open-in-app'"],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('deliverables.file.actions', () => ctx.slots.register(\n      { name: 'deliverables.file.actions', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-deliverables/src/client/file-actions.ts:8"
			},
			{
				key: "deliverables.review.file.actions",
				kind: "list",
				scope: "session",
				summary: "The same file actions owned by a changed-file review tab.",
				doc: "The same file actions owned by a changed-file review tab.",
				registerOptions: [
					{
						name: "id",
						requirement: "required",
						type: "string",
						doc: "Your cell key. Use an id of your own: a fresh id is added beside the shipped entries, while reusing a shipped id puts you in THAT cell and replaces it. Owners that filter by id address you by it."
					},
					{
						name: "order",
						requirement: "optional",
						type: "number",
						doc: "Position among the entries, ascending (default 0)."
					},
					{
						name: "label",
						requirement: "optional",
						type: "string | (() => string)",
						doc: "Display text where the owner projects one (nav rows, tabs). A thunk is re-read on every projection, so localized text follows the active locale without re-registering."
					}
				],
				ownerProps: ["/** Slot contract table. Owners extend via declaration merging; entries are {@link SlotEntryDef}. */\nexport interface SlotMap {}"],
				ownerPropsReferences: ["SlotEntryDef"],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean",
					"useChat: UseChat",
					"useConversation: UseConversation",
					"useInput: SnapshotSelectorHook<InputState>",
					"inputActions: InputActions",
					"useSession: SessionSnapshotSelector",
					"sessionId: SessionId",
					"useProjection: UseProjection",
					"useAccess: (action: RemoteEndpoint) => boolean",
					"useTrajectory: UseTrajectory"
				],
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'sidebar.right.pane.tab' (client-ui-deliverables), so it exists while that entry is mounted",
				occupants: ["client-ui-open-in-app FileRouteAction id 'open-in-app'"],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('deliverables.review.file.actions', () => ctx.slots.register(\n      { name: 'deliverables.review.file.actions', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-deliverables/src/client/file-actions.ts:21"
			},
			{
				key: "main",
				kind: "keyed",
				scope: "root",
				summary: "Central panel selected by sidebar entry id.",
				doc: "Central panel selected by sidebar entry id. The reserved `conversation`\nkey hosts the Conversation; other keys receive no Session binding.",
				registerOptions: [{
					name: "key",
					requirement: "required",
					type: "string",
					doc: "Your cell key: the entry renders where the owner dispatches this exact key. Registering an already-occupied key replaces that occupant."
				}],
				ownerProps: [],
				ownerPropsReferences: [],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean"
				],
				keyDomain: "open: any string the owner dispatches (no compile-time key set), already taken: conversation",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'root' (client-ui-layout), so it exists while that entry is mounted",
				occupants: [
					"client-ui-conversation ConversationPanel key 'conversation'",
					"client-ui-plugin-manager PluginManagerPage",
					"client-ui-schedule TaskManagerPage"
				],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('main', () => ctx.slots.register(\n      { name: 'main', key: '<one key the owner dispatches>' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-layout/src/client/index.ts:73"
			},
			{
				key: "main.conversation",
				kind: "single",
				scope: "session-maybe",
				summary: "Conversation shell beneath its root-scoped main-panel entry.",
				doc: "Conversation shell beneath its root-scoped main-panel entry.",
				registerOptions: [],
				ownerProps: [],
				ownerPropsReferences: [],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean",
					"useConversation: MaybeSnapshotSelectorHook<ConversationSnapshot>",
					"useInput: MaybeSnapshotSelectorHook<InputState>",
					"inputActions: InputActions | undefined",
					"useSession: MaybeSnapshotSelectorHook<SessionSnapshot>",
					"sessionId: SessionId | undefined",
					"useProjection: UseProjection",
					"useAccess: (action: RemoteEndpoint) => boolean | undefined"
				],
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'main' (client-ui-conversation), so it exists while that entry is mounted",
				occupants: ["client-ui-conversation ConversationRoot"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('main.conversation', () => ctx.slots.register(\n      { name: 'main.conversation' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-conversation/src/client/contract/slots.ts:204"
			},
			{
				key: "plugins.add.actions",
				kind: "list",
				scope: "root",
				summary: "Additional MenuItemButton rows after installation: 72px high, with a title and a description capped at two lines.",
				doc: "Additional MenuItemButton rows after installation: 72px high, with a title and a description capped at two lines.",
				registerOptions: [
					{
						name: "id",
						requirement: "required",
						type: "string",
						doc: "Your cell key. Use an id of your own: a fresh id is added beside the shipped entries, while reusing a shipped id puts you in THAT cell and replaces it. Owners that filter by id address you by it."
					},
					{
						name: "order",
						requirement: "optional",
						type: "number",
						doc: "Position among the entries, ascending (default 0)."
					},
					{
						name: "label",
						requirement: "optional",
						type: "string | (() => string)",
						doc: "Display text where the owner projects one (nav rows, tabs). A thunk is re-read on every projection, so localized text follows the active locale without re-registering."
					}
				],
				ownerProps: ["/** Add-plugin menu actions, independent of any selected bundle or Session. */\nexport interface PluginAddActionsProps {\n  /** Close the add-plugin menu before starting the contributed action. */\n  readonly onDismiss: () => void\n}"],
				ownerPropsReferences: [],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean"
				],
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'main' (client-ui-plugin-manager), so it exists while that entry is mounted",
				occupants: ["client-ui-agent-preset CreatePluginMenuItem id 'create-plugin'"],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('plugins.add.actions', () => ctx.slots.register(\n      { name: 'plugins.add.actions', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-plugin-manager/src/client/slot-contract.ts:118"
			},
			{
				key: "plugins.bundle.activation",
				kind: "keyed",
				scope: "root",
				summary: "Optional guidance after the user enables a bundle from the list, keyed by npm package name.",
				doc: "Optional guidance after the user enables a bundle from the list, keyed by npm package name.",
				registerOptions: [{
					name: "key",
					requirement: "required",
					type: "string",
					doc: "Your cell key: the entry renders where the owner dispatches this exact key. Registering an already-occupied key replaces that occupant."
				}],
				ownerProps: ["/** One user-requested bundle activation and navigation to its configuration page. */\nexport interface PluginActivationOwnerProps {\n  readonly packageName: string\n  /** Dismiss guidance for this activation. */\n  readonly onDismiss: () => void\n  /** Dismiss guidance and open this bundle's detail page. */\n  readonly onOpenDetails: () => void\n}"],
				ownerPropsReferences: [],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean"
				],
				keyDomain: "open: any string the owner dispatches (no compile-time key set), already taken: @deepseek-ai/dsh-experimental-voice-input-bundle",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'main' (client-ui-plugin-manager), so it exists while that entry is mounted",
				occupants: ["experimental-client-ui-voice-input VoiceSetupPrompt key '@deepseek-ai/dsh-experimental-voice-input-bundle'"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('plugins.bundle.activation', () => ctx.slots.register(\n      { name: 'plugins.bundle.activation', key: '<one key the owner dispatches>' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-plugin-manager/src/client/slot-contract.ts:126"
			},
			{
				key: "plugins.bundle.config",
				kind: "keyed",
				scope: "root",
				summary: "A bundle's own configuration, keyed by the bundle's package name and rendered on the bundle's page between its description and its rows (`view: 'page'` only).",
				doc: "A bundle's own configuration, keyed by the bundle's package name and\nrendered on the bundle's page between its description and its rows\n(`view: 'page'` only).",
				registerOptions: [{
					name: "key",
					requirement: "required",
					type: "string",
					doc: "Your cell key: the entry renders where the owner dispatches this exact key. Registering an already-occupied key replaces that occupant."
				}],
				ownerProps: ["/** The view the page asks a configuration entry for. */\nexport interface PluginConfigViewProps {\n  /** `summary` renders the one-liner alone, as text or inline nodes; `page` renders the form with its save control. */\n  readonly view: 'summary' | 'page'\n  /** Host-owned configuration values and write actions for this page's entry. */\n  readonly form?: ConfigPageForm | undefined\n}"],
				ownerPropsReferences: ["ConfigPageForm"],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean"
				],
				keyDomain: "open: any string the owner dispatches (no compile-time key set), already taken: @deepseek-ai/dsh-experimental-cot-translation-bundle, @deepseek-ai/dsh-experimental-voice-input-bundle",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'main' (client-ui-plugin-manager), so it exists while that entry is mounted",
				occupants: ["experimental-client-ui-cot-translation TranslationSettings key '@deepseek-ai/dsh-experimental-cot-translation-bundle'", "experimental-client-ui-voice-input VoicePreparation key '@deepseek-ai/dsh-experimental-voice-input-bundle'"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register(\n      { name: 'plugins.bundle.config', key: '<one key the owner dispatches>' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-plugin-manager/src/client/slot-contract.ts:142"
			},
			{
				key: "plugins.detail.actions",
				kind: "list",
				scope: "root",
				summary: "Controls at the head of a detail page, before the page's own switch and uninstall, rendered with the page's subject.",
				doc: "Controls at the head of a detail page, before the page's own switch and\nuninstall, rendered with the page's subject. An entry renders null for a\nsubject it has no control for.",
				registerOptions: [
					{
						name: "id",
						requirement: "required",
						type: "string",
						doc: "Your cell key. Use an id of your own: a fresh id is added beside the shipped entries, while reusing a shipped id puts you in THAT cell and replaces it. Owners that filter by id address you by it."
					},
					{
						name: "order",
						requirement: "optional",
						type: "number",
						doc: "Position among the entries, ascending (default 0)."
					},
					{
						name: "label",
						requirement: "optional",
						type: "string | (() => string)",
						doc: "Display text where the owner projects one (nav rows, tabs). A thunk is re-read on every projection, so localized text follows the active locale without re-registering."
					}
				],
				ownerProps: ["/** The owner props every detail contribution is rendered with. */\nexport interface PluginDetailProps {\n  /** The subject of the open page; an entry renders null for a subject it has nothing for. */\n  readonly subject: PluginsSubject\n}"],
				ownerPropsReferences: ["PluginsSubject"],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean"
				],
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'main' (client-ui-plugin-manager), so it exists while that entry is mounted",
				occupants: [],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('plugins.detail.actions', () => ctx.slots.register(\n      { name: 'plugins.detail.actions', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-plugin-manager/src/client/slot-contract.ts:156"
			},
			{
				key: "plugins.detail.badge",
				kind: "list",
				scope: "root",
				summary: "Tags beside a detail page's title, after the version, beta, and problem tags the page draws itself, rendered with the page's subject.",
				doc: "Tags beside a detail page's title, after the version, beta, and problem\ntags the page draws itself, rendered with the page's subject.",
				registerOptions: [
					{
						name: "id",
						requirement: "required",
						type: "string",
						doc: "Your cell key. Use an id of your own: a fresh id is added beside the shipped entries, while reusing a shipped id puts you in THAT cell and replaces it. Owners that filter by id address you by it."
					},
					{
						name: "order",
						requirement: "optional",
						type: "number",
						doc: "Position among the entries, ascending (default 0)."
					},
					{
						name: "label",
						requirement: "optional",
						type: "string | (() => string)",
						doc: "Display text where the owner projects one (nav rows, tabs). A thunk is re-read on every projection, so localized text follows the active locale without re-registering."
					}
				],
				ownerProps: ["/** The owner props every detail contribution is rendered with. */\nexport interface PluginDetailProps {\n  /** The subject of the open page; an entry renders null for a subject it has nothing for. */\n  readonly subject: PluginsSubject\n}"],
				ownerPropsReferences: ["PluginsSubject"],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean"
				],
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'main' (client-ui-plugin-manager), so it exists while that entry is mounted",
				occupants: [],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('plugins.detail.badge', () => ctx.slots.register(\n      { name: 'plugins.detail.badge', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-plugin-manager/src/client/slot-contract.ts:161"
			},
			{
				key: "plugins.detail.section",
				kind: "list",
				scope: "root",
				summary: "Sections under a detail page's own content: after the rows on a bundle's page, after the configuration on a row's or an official plugin's page.",
				doc: "Sections under a detail page's own content: after the rows on a bundle's\npage, after the configuration on a row's or an official plugin's page.\nAn entry draws its own section chrome and renders null for a subject it\nhas nothing for.",
				registerOptions: [
					{
						name: "id",
						requirement: "required",
						type: "string",
						doc: "Your cell key. Use an id of your own: a fresh id is added beside the shipped entries, while reusing a shipped id puts you in THAT cell and replaces it. Owners that filter by id address you by it."
					},
					{
						name: "order",
						requirement: "optional",
						type: "number",
						doc: "Position among the entries, ascending (default 0)."
					},
					{
						name: "label",
						requirement: "optional",
						type: "string | (() => string)",
						doc: "Display text where the owner projects one (nav rows, tabs). A thunk is re-read on every projection, so localized text follows the active locale without re-registering."
					}
				],
				ownerProps: ["/** The owner props every detail contribution is rendered with. */\nexport interface PluginDetailProps {\n  /** The subject of the open page; an entry renders null for a subject it has nothing for. */\n  readonly subject: PluginsSubject\n}"],
				ownerPropsReferences: ["PluginsSubject"],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean"
				],
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'main' (client-ui-plugin-manager), so it exists while that entry is mounted",
				occupants: [],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('plugins.detail.section', () => ctx.slots.register(\n      { name: 'plugins.detail.section', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-plugin-manager/src/client/slot-contract.ts:168"
			},
			{
				key: "plugins.item",
				kind: "list",
				scope: "root",
				summary: "One official plugin the Plugins page lists in its Official group after the official bundles: `label` is the card's title and `order` its place.",
				doc: "One official plugin the Plugins page lists in its Official group after\nthe official bundles: `label` is the card's title and `order` its place.\nThe page renders the entry as the card's one-liner (`view: 'summary'`)\nand, once the card is opened, as the body of the plugin's own page\n(`view: 'page'`). OCCUPIED by the official settings pages, one companion\npackage per host-plane namespace; a bundle's configuration belongs in\n`plugins.bundle.config` or `plugins.row.config` instead.",
				registerOptions: [
					{
						name: "id",
						requirement: "required",
						type: "string",
						doc: "Your cell key. Use an id of your own: a fresh id is added beside the shipped entries, while reusing a shipped id puts you in THAT cell and replaces it. Owners that filter by id address you by it."
					},
					{
						name: "order",
						requirement: "optional",
						type: "number",
						doc: "Position among the entries, ascending (default 0)."
					},
					{
						name: "label",
						requirement: "optional",
						type: "string | (() => string)",
						doc: "Display text where the owner projects one (nav rows, tabs). A thunk is re-read on every projection, so localized text follows the active locale without re-registering."
					}
				],
				ownerProps: ["/** The view the page asks a configuration entry for. */\nexport interface PluginConfigViewProps {\n  /** `summary` renders the one-liner alone, as text or inline nodes; `page` renders the form with its save control. */\n  readonly view: 'summary' | 'page'\n  /** Host-owned configuration values and write actions for this page's entry. */\n  readonly form?: ConfigPageForm | undefined\n}"],
				ownerPropsReferences: ["ConfigPageForm"],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean"
				],
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'main' (client-ui-plugin-manager), so it exists while that entry is mounted",
				occupants: [
					"client-ui-settings-agent-loop AgentLoopCard id 'agent-loop'",
					"client-ui-settings-shell ShellCard id 'shell'",
					"client-ui-settings-subagent SubagentCard id 'subagent'",
					"client-ui-settings-web-search WebSearchCard id 'web-search'"
				],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('plugins.item', () => ctx.slots.register(\n      { name: 'plugins.item', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-plugin-manager/src/client/slot-contract.ts:136"
			},
			{
				key: "plugins.row.config",
				kind: "keyed",
				scope: "root",
				summary: "The configuration of one row a bundle declares, keyed by `<package name>#<row id>` with the row id as the bundle's patch declares it: the row on the bundle's page gains a configure control that opens the entry's page, headed by the plugin's display title and description.",
				doc: "The configuration of one row a bundle declares, keyed by\n`<package name>#<row id>` with the row id as the bundle's patch declares\nit: the row on the bundle's page gains a configure control that opens\nthe entry's page, headed by the plugin's display title and description.\nAn absent description falls back to the entry's `view: 'summary'`.",
				registerOptions: [{
					name: "key",
					requirement: "required",
					type: "string",
					doc: "Your cell key: the entry renders where the owner dispatches this exact key. Registering an already-occupied key replaces that occupant."
				}],
				ownerProps: ["/** The view the page asks a configuration entry for. */\nexport interface PluginConfigViewProps {\n  /** `summary` renders the one-liner alone, as text or inline nodes; `page` renders the form with its save control. */\n  readonly view: 'summary' | 'page'\n  /** Host-owned configuration values and write actions for this page's entry. */\n  readonly form?: ConfigPageForm | undefined\n}"],
				ownerPropsReferences: ["ConfigPageForm"],
				standardProps: [
					"useRemoteAccess: (action: RemoteEndpoint) => boolean",
					"useResource: UseResource",
					"useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>",
					"usePanelInfo: UsePanelInfo",
					"useSessions: UseSessions",
					"useSessionStatus: UseSessionStatus",
					"useSessionRetainInfo: UseSessionRetainInfo",
					"useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean",
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean"
				],
				keyDomain: "open: any string the owner dispatches (no compile-time key set), none are taken yet",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'main' (client-ui-plugin-manager), so it exists while that entry is mounted",
				occupants: [],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('plugins.row.config', () => ctx.slots.register(\n      { name: 'plugins.row.config', key: '<one key the owner dispatches>' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-plugin-manager/src/client/slot-contract.ts:150"
			},
			{
				key: "plugins.tab",
				kind: "list",
				scope: "root",
				summary: "Tabs after the page's own Installed tab, such as Discover: `label` names the tab and `order` places it.",
				doc: "Tabs after the page's own Installed tab, such as Discover: `label` names the tab and `order` places it. The\npage renders the selected entry under its header and tabs; the entry draws its own content and installs\nthrough the owner's `install`.",
}]} // __DSH_FRAGMENT_END__

export {};
