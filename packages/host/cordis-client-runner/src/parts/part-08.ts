/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-cordis-client-runner/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() {[{ // __DSH_FRAGMENT_BEGIN__
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
				ownerProps: ["/** Owner props of a page tab another plugin contributes, such as Discover. */\nexport interface PluginTabProps {\n  /**\n   * Install an exact version the person already confirmed: the page's install dialog opens at its check and progress\n   * screens, without the spec form, and names the plugin and version above the spec.\n   * @param target - the spec, optional registry, and display text.\n   */\n  readonly install: (target: PluginTabInstall) => void\n  /**\n   * Switch to the Installed tab and open a bundle's page.\n   * @param packageName - npm package name of the bundle.\n   */\n  readonly openPackage: (packageName: string) => void\n}"],
				ownerPropsReferences: ["PluginTabInstall"],
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
				occupants: ["client-ui-plugin-market DiscoverSection id 'discover'"],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('plugins.tab', () => ctx.slots.register(\n      { name: 'plugins.tab', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-plugin-manager/src/client/slot-contract.ts:124"
			},
			{
				key: "rightbar",
				kind: "single",
				scope: "root",
				summary: "The right column: a track the centre makes room for, or nothing.",
				doc: "The right column: a track the centre makes room for, or nothing. OCCUPIED\nby the right Sidebar, which uses the resolved column width in normal\nmode and covers the viewport in fullscreen, retaining the wide-screen\ncolumn reservation underneath.\n\nWhether the panel is shown, and whether it takes a track, is the\noccupant's own recorded business — it reports the composition of its\nexpanded and presentation state through `ctx.layout`, and the frame sizes\nthe track and places the resize handle from that. The expand control is\nnot this column's: it is a button in the conversation header. The root\noccupant decides when to render its Session-bound content.",
				registerOptions: [],
				ownerProps: ["/** Right column owner share: resolved normal geometry and opening eligibility. */\nexport interface RightbarOwnerProps {\n  /** Resolved normal panel width in px, not the saved preference; zero if it cannot fit. */\n  width: number\n  /** Current frame width in px. */\n  viewportWidth: number\n  /**\n   * Whether a normal right panel can retain 300px beside a 400px center.\n   * Before a narrow opening, includes the space from collapsing the left sidebar.\n   */\n  canShow: boolean\n}"],
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
				declaredBy: "an entry in 'root' (client-ui-layout), so it exists while that entry is mounted",
				occupants: ["client-ui-sidebar-right RightbarRoot"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('rightbar', () => ctx.slots.register(\n      { name: 'rightbar' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-layout/src/client/index.ts:87"
			},
			{
				key: "rightbar.session",
				kind: "single",
				scope: "session",
				summary: "Session content selected by the root-scoped right Sidebar controller.",
				doc: "Session content selected by the root-scoped right Sidebar controller.",
				registerOptions: [],
				ownerProps: ["/** Right column owner share: resolved normal geometry and opening eligibility. */\nexport interface RightbarOwnerProps {\n  /** Resolved normal panel width in px, not the saved preference; zero if it cannot fit. */\n  width: number\n  /** Current frame width in px. */\n  viewportWidth: number\n  /**\n   * Whether a normal right panel can retain 300px beside a 400px center.\n   * Before a narrow opening, includes the space from collapsing the left sidebar.\n   */\n  canShow: boolean\n}", "/** Identity of one open tab; distinct copies of one content share `contentId`, never `TabId`. */\nexport type TabId = Branded<'TabId'>"],
				ownerPropsReferences: ["Branded"],
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
				declaredBy: "an entry in 'rightbar' (client-ui-sidebar-right), so it exists while that entry is mounted",
				occupants: ["client-ui-sidebar-right RightbarSeat"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('rightbar.session', () => ctx.slots.register(\n      { name: 'rightbar.session' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-sidebar-right/src/client/contract/slots.ts:43"
			},
			{
				key: "root",
				kind: "single",
				scope: "root",
				summary: "The built-in render-tree root hole (seeded by SlotCore): the one slot the shell itself renders, and the ancestor of every other seat.",
				doc: "The built-in render-tree root hole (seeded by SlotCore): the one slot the\nshell itself renders, and the ancestor of every other seat. OCCUPIED by\nui-layout's AppFrame, which declares the sidebar, conversation, details,\nand shell.overlay seats inside it.\n\nDO NOT register here. This is a single slot, so a second entry does not\nsit beside the frame — it shadows it, and a dynamically registered entry\nis assigned a lower priority than the shipped one, which makes it the\nwinner: the page would render your component alone, with every seat the\nframe declares gone. For a surface of your own that floats over the whole\napp, register into `shell.overlay` instead (a list slot: additive, and\nclick-through until your entry opts into pointer events).",
				registerOptions: [],
				ownerProps: ["/** Root owner share: the shell supplies nothing — the frame is inject-assembled. */\nexport interface RootOwnerProps { children?: never }"],
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
				declaredBy: "the runtime itself (built in; always present)",
				occupants: ["client-ui-layout AppFrame"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('root', () => ctx.slots.register(\n      { name: 'root' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-renderer/src/client/registry.ts:44"
			},
			{
				key: "settings.action",
				kind: "list",
				scope: "root",
				summary: "Optional actions rendered in the content-column header before Close.",
				doc: "Optional actions rendered in the content-column header before Close.\nRegistrants own visibility, behavior, copy, and failure presentation;\nthe shell supplies only the ordered render site.",
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
				ownerProps: ["/** Owner share of the header title seat (the shell supplies nothing). */\nexport interface SettingsHeaderOwnerProps {\n  /** Marker field: header owner props are intentionally empty. */\n  children?: never\n}"],
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
				declaredBy: "an entry in 'sidebar.settings' (client-ui-settings-general), so it exists while that entry is mounted",
				occupants: ["client-ui-settings-general SettingsDocumentAction id 'open-document'"],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('settings.action', () => ctx.slots.register(\n      { name: 'settings.action', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-settings/src/client/contract/slots.ts:39"
			},
			{
				key: "settings.close",
				kind: "single",
				scope: "root",
				summary: "The close button's visually-hidden label text (the button itself — icon, geometry, focus — is shell chrome).",
				doc: "The close button's visually-hidden label text (the button itself —\nicon, geometry, focus — is shell chrome). Absent contribution leaves\nthe button without an accessible name (broken-composition state).",
				registerOptions: [],
				ownerProps: ["/** Owner share of the header title seat (the shell supplies nothing). */\nexport interface SettingsHeaderOwnerProps {\n  /** Marker field: header owner props are intentionally empty. */\n  children?: never\n}"],
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
				declaredBy: "an entry in 'sidebar.settings' (client-ui-settings-general), so it exists while that entry is mounted",
				occupants: ["client-ui-settings-general CloseLabel"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('settings.close', () => ctx.slots.register(\n      { name: 'settings.close' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-settings/src/client/contract/slots.ts:45"
			},
			{
				key: "settings.general.item",
				kind: "list",
				scope: "root",
				summary: "One preference row inside the General section — the additive seat for a single setting that needs no page of its own (a whole page is `settings.section`), contributed by the feature plugin that owns the preference (locale → Language, ui-theme → Appearance, ui-conversation → Composer Enter).",
				doc: "One preference row inside the General section — the additive seat for a\nsingle setting that needs no page of its own (a whole page is\n`settings.section`), contributed by the feature plugin that owns the\npreference (locale → Language, ui-theme → Appearance, ui-conversation →\nComposer Enter). Options: `id` (row key), `order` (row position). The\nsection column only stacks rows, so a row draws its own internals,\nincluding its label: nothing projects a `label` here and the owner passes\nno props at all — copy, current value, and the write path are all yours,\nthrough your own inject face and `host.call`. Declared at runtime by\nui-settings-general's General entry; the type lives here with every other\nsettings slot type, because this package is the settings domain's base\nlayer and every registrant already depends on it for `ctx.configForms`.",
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
				ownerProps: ["/** Owner share of a General preference row (the section supplies nothing). */\nexport interface SettingsGeneralItemOwnerProps {\n  /** Marker field: item owner props are intentionally empty. */\n  children?: never\n}"],
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
				declaredBy: "an entry in 'settings.section' (client-ui-settings-general), so it exists while that entry is mounted",
				occupants: [
					"client-locale LanguageRow id 'language'",
					"client-ui-chat LinkOpeningRow id 'link-opening'",
					"client-ui-chat PerformanceUsageRow id 'performance-usage'",
					"client-ui-chat TranscriptViewRow id 'transcript-view'",
					"client-ui-conversation EnterBehaviorRow id 'composer-enter'",
					"client-ui-permission-presets PermissionRow id 'permission'",
					"client-ui-settings-general DeveloperToolsRow id 'developer-tools'",
					"client-ui-settings-general CurrentVersionRow id 'current-version'",
					"client-ui-settings-session-log UploadRow",
					"client-ui-shortcuts ShortcutsRow id 'shortcuts'",
					"client-ui-theme AppearanceRow id 'appearance'",
					"client-ui-theme FontSettingsGroup id 'font-size'"
				],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('settings.general.item', () => ctx.slots.register(\n      { name: 'settings.general.item', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-settings/src/client/contract/slots.ts:92"
			},
			{
				key: "settings.header",
				kind: "single",
				scope: "root",
				summary: "The panel title text seat.",
				doc: "The panel title text seat. Content renders inside the nav heading row;\nthe dialog's accessible name points at that node via aria-labelledby.\nAbsent contribution leaves the heading empty.",
				registerOptions: [],
				ownerProps: ["/** Owner share of the header title seat (the shell supplies nothing). */\nexport interface SettingsHeaderOwnerProps {\n  /** Marker field: header owner props are intentionally empty. */\n  children?: never\n}"],
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
				declaredBy: "an entry in 'sidebar.settings' (client-ui-settings-general), so it exists while that entry is mounted",
				occupants: ["client-ui-settings-general HeaderContent"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('settings.header', () => ctx.slots.register(\n      { name: 'settings.header' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-settings/src/client/contract/slots.ts:33"
			},
			{
				key: "settings.launcher",
				kind: "single",
				scope: "root",
				summary: "Optional sidebar account launcher; opens the shell-owned settings panel.",
				doc: "Optional sidebar account launcher; opens the shell-owned settings panel.",
				registerOptions: [],
				ownerProps: ["/** Sidebar launcher geometry and settings navigation. */\nexport interface SettingsLauncherOwnerProps {\n  /** Whether the sidebar shows labels. */\n  wide: boolean\n  /** Whether the settings dialog covers the sidebar; a launcher may treat a false-to-true edge as one Settings entry. */\n  settingsOpen: boolean\n  /** Effective Settings key labels and accessible combination; omitted when unbound. */\n  settingsShortcut?: { readonly keys: readonly string[]; readonly aria?: string | undefined }\n  /** Open the settings panel. */\n  openSettings: () => void\n  /** @param id - registered onboarding editor to open explicitly. */\n  openOnboarding: (id: string) => void\n}"],
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
				declaredBy: "an entry in 'sidebar.settings' (client-ui-settings-general), so it exists while that entry is mounted",
				occupants: ["client-ui-settings-account AccountMenu"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('settings.launcher', () => ctx.slots.register(\n      { name: 'settings.launcher' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-settings/src/client/contract/slots.ts:17"
			},
			{
				key: "settings.models.footer",
				kind: "list",
				scope: "root",
				summary: "Ordered extension area after the provider rows and the add controls.",
				doc: "Ordered extension area after the provider rows and the add controls.\nWithout a registrant the area renders nothing.",
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
				ownerProps: ["/** Owner share of the footer area (the section supplies nothing). */\nexport interface ModelsFooterOwnerProps {\n  /** Marker field: footer owner props are intentionally empty. */\n  children?: never\n}"],
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
				declaredBy: "an entry in 'settings.section' (client-ui-settings-models), so it exists while that entry is mounted",
				occupants: [],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('settings.models.footer', () => ctx.slots.register(\n      { name: 'settings.models.footer', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-settings-models/src/client/slot-contract.ts:40"
			},
			{
				key: "settings.models.provider-card",
				kind: "keyed",
				scope: "root",
				summary: "One provider card's adapter extension area, dispatched with `entryKey = settingsNs` on every card that renders a directory row: a saved row's card (its first-run setup posture included) and the add-provider draft card.",
				doc: "One provider card's adapter extension area, dispatched with\n`entryKey = settingsNs` on every card that renders a directory row: a\nsaved row's card (its first-run setup posture included) and the\nadd-provider draft card. The hand-declared draft card has no directory\nrow yet, so it dispatches nothing until saved. Without a registrant the\narea renders nothing.",
				registerOptions: [{
					name: "key",
					requirement: "required",
					type: "string",
					doc: "Your cell key: the entry renders where the owner dispatches this exact key. Registering an already-occupied key replaces that occupant."
				}],
				ownerProps: ["/** Owner share of one provider-card extension occurrence. */\nexport interface ProviderCardExtrasOwnerProps {\n  /** The card's directory row (route id, display name, settings address, live state). */\n  provider: ProviderDirectoryEntry\n  /** Whether any layer configures this provider (its profile resolves); `false` while the add-provider draft edits a dormant row. */\n  configured: boolean\n  /** Whether the row's referenced api-key credential is confirmed configured (the page's credential join). */\n  keyConfigured: boolean\n}"],
				ownerPropsReferences: ["ProviderDirectoryEntry"],
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
				declaredBy: "an entry in 'settings.section' (client-ui-settings-models), so it exists while that entry is mounted",
				occupants: [],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register(\n      { name: 'settings.models.provider-card', key: '<one key the owner dispatches>' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-settings-models/src/client/slot-contract.ts:33"
			},
			{
				key: "settings.models.sign-in",
				kind: "single",
				scope: "root",
				summary: "Optional account login choice before the credential editor.",
				doc: "Optional account login choice before the credential editor.",
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
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean"
				],
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'settings.onboarding' (client-ui-settings-models), so it exists while that entry is mounted",
				occupants: ["client-ui-settings-account AccountOnboarding"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('settings.models.sign-in', () => ctx.slots.register(\n      { name: 'settings.models.sign-in' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-settings-models/src/client/slot-contract.ts:35"
			},
			{
				key: "settings.onboarding",
				kind: "list",
				scope: "root",
				summary: "Root-scoped onboarding steps contributed by settings features.",
				doc: "Root-scoped onboarding steps contributed by settings features. The\nshell mounts one ordered step at a time; the active registrant either\ncompletes itself or keeps ownership until the user completes its sole\npath. Registrants own readiness, copy, dialog behavior, AND visible\nchrome: a step wraps its visible content in its modal surface (including\n`#root` inert ownership) and renders null while private facts are still\nloading. The shell paints no chrome of its own, so a mounted-but-deciding\nstep shows and blocks nothing.",
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
				ownerProps: ["/** Owner share of the currently active settings-backed onboarding step. */\nexport interface SettingsOnboardingOwnerProps {\n  /** Stable id of the step currently selected by the coordinator. */\n  stepId: string\n  /** User explicitly reopened this step outside first-run onboarding. */\n  explicit?: boolean\n  /** Complete or skip this step and transfer ownership to the next entry. */\n  complete: () => void\n  /** Open the settings panel directly on one registered section. */\n  openSection: (id: string) => void\n}"],
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
				declaredBy: "an entry in 'sidebar.settings' (client-ui-settings-general), so it exists while that entry is mounted",
				occupants: ["client-ui-settings-models WelcomeNotice id 'welcome-notice'", "client-ui-settings-models DeepSeekOnboardingDialog id 'deepseek-official'"],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('settings.onboarding', () => ctx.slots.register(\n      { name: 'settings.onboarding', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-settings/src/client/contract/slots.ts:77"
			},
			{
				key: "settings.plugins.tab",
				kind: "list",
				scope: "root",
				summary: "One page inside the Plugins settings section.",
				doc: "One page inside the Plugins settings section. The section owner renders\nlocalized entry labels as tabs and mounts each contribution inside its\ncorresponding tab panel. Options: `id` (tab key), `order` (tab order),\nand `label` (registrant-localized tab text). Declared at runtime by the\nfeature that owns the Plugins section; the type lives here so inventory\nand configuration plugins collaborate without depending on one another.",
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
				ownerProps: ["/** Owner share of a Plugins tab (the section supplies nothing). */\nexport interface SettingsPluginsTabOwnerProps {\n  /** Marker field: tab owner props are intentionally empty. */\n  children?: never\n}"],
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
				declaredBy: "an entry in 'settings.section' (client-ui-settings-plugins), so it exists while that entry is mounted",
				occupants: ["client-ui-settings-plugin-inventory PluginInventorySettingsTab id 'all'"],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register(\n      { name: 'settings.plugins.tab', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-settings/src/client/contract/slots.ts:66"
			},
			{
				key: "settings.section",
				kind: "list",
				scope: "root",
				summary: "One settings page per list entry.",
				doc: "One settings page per list entry. Registrant options carry the nav\nidentity: `id` (section key, drives `only` filtering), `order` (nav\nposition), `label` (registrant-localized display text — the registrant\nre-registers with fresh text on locale change, so the shell never\nsubscribes locale state; the ledger bump doubles as the shell's\nre-render trigger). Sections render inside the panel content column.\n(`settings.general.item`, declared by ui-settings-general's General\nentry, is typed in the locale package — the common dependency of every\nitem registrant; the shell neither declares nor renders it.)",
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
				ownerProps: ["/**\n * Owner share of a settings section entry. The shell owns modal visibility\n * and navigation; a section's data arrives through its own inject faces and\n * stores. `close` is the one shell affordance a section receives, for flows\n * that leave settings altogether (starting a session from a section) — the\n * onboarding coordinator's `openSection`/`complete` precedent, inverted.\n */\nexport interface SettingsSectionOwnerProps {\n  /** Close the settings panel (the shell owns the open state). */\n  close: () => void\n}"],
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
				declaredBy: "an entry in 'sidebar.settings' (client-ui-settings-general), so it exists while that entry is mounted",
				occupants: [
					"client-ui-agent-preset AgentPresetSection id 'agent-presets'",
					"client-ui-settings-account AccountSection id 'account'",
					"client-ui-settings-general GeneralSection id 'general'",
					"client-ui-settings-models ModelsSection id 'models'",
					"client-ui-settings-plugins PluginsSettingsSection id 'plugins'"
				],
				replaceRisk: "none",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('settings.section', () => ctx.slots.register(\n      { name: 'settings.section', id: 'my-entry', order: 100, label: 'My entry' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-settings/src/client/contract/slots.ts:57"
			},
			{
				key: "settings.trigger",
				kind: "single",
				scope: "root",
				summary: "The sidebar-foot trigger row content: icon + label, supplied as slot content (the accessible name comes from the content — rail state renders the label visually hidden).",
				doc: "The sidebar-foot trigger row content: icon + label, supplied as slot\ncontent (the accessible name comes from the content — rail state\nrenders the label visually hidden). The shell renders the button\nchrome and owns open state. Absent contribution degrades to an\nicon-only button without an accessible name (broken-composition state;\nthe shipped composition always registers the seat).",
				registerOptions: [],
				ownerProps: ["/** Owner share of the trigger content seat: the sidebar column state. */\nexport interface SettingsTriggerOwnerProps {\n  /** Whether the sidebar renders wide content (false = 56px rail, icon only). */\n  wide: boolean\n}"],
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
				declaredBy: "an entry in 'sidebar.settings' (client-ui-settings-general), so it exists while that entry is mounted",
				occupants: ["client-ui-settings-general TriggerContent"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('settings.trigger', () => ctx.slots.register(\n      { name: 'settings.trigger' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-settings/src/client/contract/slots.ts:27"
			},
			{
				key: "shell.bottom",
				kind: "single",
				scope: "root",
				summary: "Full-width bottom content below all three columns.",
				doc: "Full-width bottom content below all three columns. Its rendered height\nreduces the columns' available height; empty content reserves no space.\nThe occupant owns its height, visibility, and controls. It receives no\nSession binding and remains mounted across main-panel navigation.",
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
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean"
				],
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'root' (client-ui-layout), so it exists while that entry is mounted",
				occupants: ["experimental-inspector InspectorPage"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('shell.bottom', () => ctx.slots.register(\n      { name: 'shell.bottom' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-layout/src/client/index.ts:94"
			},
			{
				key: "shell.leading",
				kind: "single",
				scope: "root",
				summary: "Window-chrome seat at the frame's top-left, over every main panel.",
				doc: "Window-chrome seat at the frame's top-left, over every main panel.\nMounted only while the sidebar column is fully hidden (macOS desktop\ncollapse; other platforms keep the rail), so the occupant can assume the\nframe edge is the window edge and the macOS traffic lights sit before it.\nOCCUPIED by ui-sidebar's reopen/New Session controls.\n\nWhile the seat is mounted the frame publishes\n`--dsh-frame-leading-clearance` (the inline inset the seat's band\noccupies, measured from the frame's left edge); a main panel whose\ncontent reaches the top-left corner pads by it so nothing lands under\nthe lights or the controls.",
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
					"useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean"
				],
				keyDomain: "",
				hookContext: "",
				slotInject: "",
				declaredBy: "an entry in 'root' (client-ui-layout), so it exists while that entry is mounted",
				occupants: ["client-ui-sidebar HeaderLeadingControls"],
				replaceRisk: "shadows-shipped-ui",
				example: "return {\n  inject: ['slots'],\n  apply(ctx) {\n    ctx.slots.inject('shell.leading', () => ctx.slots.register(\n      { name: 'shell.leading' },\n      () => React.createElement('div', null, 'hello'),\n    ))\n  },\n}",
				source: "packages/client/ui-layout/src/client/index.ts:119"
			},
			{
				key: "shell.overlay",
				kind: "list",
				scope: "root",
				summary: "Frame-wide floating layer, above every column and outside their scroll containers.",
				doc: "Frame-wide floating layer, above every column and outside their scroll\ncontainers. Deliberately generic and unowned by any feature: a badge, a\ntoast stack or a status pill all belong here, and entries order among\nthemselves. The layer itself is click-through — entries opt back into\npointer events — so an occupant never blocks the app underneath.\n\nThis is the additive seat for a frame-wide surface of your own: a fresh\n`id` is added beside the shipped entries instead of replacing them.",
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
}]} // __DSH_FRAGMENT_END__

export {};
