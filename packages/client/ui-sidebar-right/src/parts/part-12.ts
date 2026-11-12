/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		/**
		* Whether a band may join a held kind: an `extension` and a `builtin` pair up
		* once, and a `fallback` shares its kind with nothing.
		*/
		function coexists(slot, band) {
			return band !== "fallback" && slot.inForce.band !== "fallback" && slot.inForce.band !== band && slot.shadowed === void 0;
		}
		/**
		* The address's URI path: what a pattern with no scheme separator matches
		* against. `dsh-resource://file/session/s1/home/me/b.md` gives `/session/s1/home/me/b.md`;
		* `sidebar://guide` gives `''`; an address that is not a URI gives nothing.
		*/
		function pathOf(address) {
			try {
				return new URL(address).pathname;
			} catch {
				return;
			}
		}
		/** Compile one declared pattern into the test the router runs. */
		function matcherFor(pattern) {
			const whole = pattern.includes(":");
			const match = (0, import_posix.default)(pattern, {
				nocase: true,
				dot: true,
				...whole ? {} : { basename: true }
			});
			return (address) => {
				if (whole) return match(address);
				const path = pathOf(address);
				return path !== void 0 && match(path);
			};
		}
		/**
		* The registered tab types.
		*
		* Registration order is part of the contract: it breaks ties between types that
		* recognize an address equally well.
		*/
		var SidebarRightTabRegistry = class {
			ctx;
			kinds = /* @__PURE__ */ new Map();
			ids = /* @__PURE__ */ new Set();
			listeners = /* @__PURE__ */ new Set();
			registrations = 0;
			cached = [];
			guideEntries = [];
			/** @param ctx - Context whose effects own the contributed types. */
			constructor(ctx) {
				this.ctx = ctx;
			}
			/**
			* Register one tab type for the caller's lifetime.
			*
			* The caller holds the returned disposer inside its own `ctx.effect`, so a
			* type's registration lives exactly as long as the plugin that contributed it.
			* An `extension` may register a kind a `builtin` already holds and takes it
			* over until it unregisters; a second registration in the same band, or any
			* registration meeting a `fallback` of the same kind, is a wiring mistake, and
			* so is an `id` already in use.
			* @param definition - the contributed type.
			* @returns idempotent disposer.
			* @throws when the id is taken, or the kind is already registered in a way this one cannot coexist with.
			*/
			register(definition) {
				const { id, kind } = definition;
				const entries = definition.guide ?? [];
				if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error(`sidebarRight: duplicate guide entry id in "${id}"`);
				const band = definition.priority ?? DEFAULT_BAND;
				if (this.ids.has(id)) throw new Error(`sidebarRight: tab type id "${id}" is already registered`);
				const held = this.kinds.get(kind);
				if (held !== void 0 && !coexists(held, band)) throw new Error(`sidebarRight: tab kind "${kind}" is already registered (${held.inForce.band})`);
				this.registrations += 1;
				const entry = {
					definition,
					band,
					matchers: (definition.patterns ?? []).map((pattern) => ({
						pattern,
						test: matcherFor(pattern)
					})),
					order: this.registrations
				};
				const dispose = this.ctx.effect(() => {
					this.ids.add(id);
					const slot = this.enter(kind, entry);
					this.refresh();
					return () => {
						this.ids.delete(id);
						this.leave(kind, slot, entry);
						this.refresh();
					};
				}, `sidebarRight.tabs.register(${JSON.stringify(id)})`);
				return () => {
					dispose();
				};
			}
			/** Add a registration to its kind's slot, the higher band in force; `coexists` has already admitted it. */
			enter(kind, entry) {
				const held = this.kinds.get(kind);
				if (held === void 0) {
					const slot = {
						inForce: entry,
						shadowed: void 0
					};
					this.kinds.set(kind, slot);
					return slot;
				}
				if (RANKS[entry.band] > RANKS[held.inForce.band]) {
					held.shadowed = held.inForce;
					held.inForce = entry;
				} else held.shadowed = entry;
				return held;
			}
			/** Remove a registration from its kind's slot: a shadowed builtin resumes, and an emptied kind is freed. */
			leave(kind, slot, entry) {
				if (slot.inForce !== entry) slot.shadowed = void 0;
				else if (slot.shadowed === void 0) this.kinds.delete(kind);
				else {
					slot.inForce = slot.shadowed;
					slot.shadowed = void 0;
				}
			}
			/** Every kind's registration in force, in registration order. */
			active() {
				return [...this.kinds.values()].map((slot) => slot.inForce).sort((left, right) => left.order - right.order);
			}
			/**
			* Registered types in registration order.
			* @returns reference-stable entries.
			*/
			entries() {
				return this.cached;
			}
			/**
			* Every type in force's guide entries, in `order`, each naming the kind it opens.
			* @returns reference-stable entries.
			*/
			guide() {
				return this.guideEntries;
			}
			/**
			* The type in force for a kind.
			* @param kind - the type discriminator.
			* @returns the type, or `undefined` when nothing registered it.
			*/
			get(kind) {
				return this.kinds.get(kind)?.inForce.definition;
			}
			/**
			* Every type that would open an address, best first.
			*
			* Ranked by priority band, then by the length of the pattern that matched,
			* then by registration order. Types whose `canOpen` vetoes are absent.
			* @param address - the address a caller wants opened.
			* @returns the ranked types; empty when nothing recognizes the address.
			*/
			candidates(address) {
				const ranked = [];
				for (const { definition, band, matchers, order } of this.active()) {
					let length = -1;
					for (const matcher of matchers) if (matcher.test(address) && matcher.pattern.length > length) length = matcher.pattern.length;
					if (length < 0) continue;
					if (definition.canOpen !== void 0 && !definition.canOpen(address)) continue;
					ranked.push({
						definition,
						rank: RANKS[band],
						length,
						order
					});
				}
				ranked.sort((left, right) => right.rank - left.rank || right.length - left.length || left.order - right.order);
				return ranked.map((entry) => entry.definition);
			}
			/**
			* Decide which type opens an address, and as what.
			*
			* Without `kind`, the best candidate wins. With `kind`, that type opens the
			* address if its `canOpen` agrees — its globs are not consulted, because
			* naming the type IS the decision.
			*
			* An address no type will open is a wiring mistake, not a user error, so this
			* throws rather than reporting absence.
			* @param address - the address a caller wants opened.
			* @param kind - a type named by the caller, overriding the ranking.
			* @returns the claiming type and the record to open.
			*/
			claim(address, kind) {
				if (kind !== void 0) {
					const definition = this.get(kind);
					if (definition === void 0) throw new Error(`sidebarRight: no tab type is registered as "${kind}"`);
					if (definition.canOpen !== void 0 && !definition.canOpen(address)) throw new Error(`sidebarRight: tab type "${kind}" refuses "${address}"`);
					return {
						kind,
						contentId: address,
						title: definition.title(address)
					};
				}
				const [chosen] = this.candidates(address);
				if (chosen === void 0) throw new Error(`sidebarRight: no registered tab type claims "${address}"`);
				return {
					kind: chosen.kind,
					contentId: address,
					title: chosen.title(address)
				};
			}
			/**
			* Observe low-frequency registry changes.
			* @param listener - synchronous invalidation callback.
			* @returns unsubscribe callback.
			*/
			subscribe(listener) {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			}
			refresh() {
				this.cached = this.active().map((entry) => entry.definition);
				this.guideEntries = this.cached.flatMap((definition) => (definition.guide ?? []).map((entry) => ({
					...entry,
					kind: definition.kind,
					providerId: definition.id
				}))).sort((left, right) => left.order - right.order);
				(0, _deepseek_ai_dsh_client_store.notifySubscribers)(this.listeners, "[ui-sidebar-right] tab registry");
			}
		};
		//#endregion
		//#region lib/types/client/locales.js
		/**
		* `sidebarRight` namespace dictionaries.
		*
		* Everything a user reads in this column is here, including the strings handed
		* to the docking kit — the kit renders no copy of its own, so its whole
		* vocabulary is this package's to own and translate.
		*/
		/** Simplified Chinese dictionary and key-set source of truth. */
		const zh = {
			"command.close": "关闭当前页面／窗口",
			"command.refresh": "刷新当前页面",
			"command.noRefresh": "当前页面不支持刷新",
			"command.toggle": "展开／收起右侧栏",
			"command.fullscreen": "面板全屏／退出全屏",
			"command.noSession": "请先选择会话",
			"command.noFocus": "请先聚焦右侧面板",
			"command.stale": "页面已切换，请重新聚焦",
			"command.collapsed": "请先展开右侧栏",
			"command.float": "浮动面板不支持此操作",
			"command.empty": "请先打开页面",
			"command.budget": "已达两格上限",
			"command.width": "栏宽不足，拖宽侧边栏后再分栏",
			"chrome.expand": "打开侧边栏",
			"chrome.expandAria": "打开右侧边栏",
			"chrome.collapse": "收起侧边栏",
			"chrome.collapseAria": "收起右侧边栏",
			"chrome.toFullscreen": "全屏",
			"chrome.exitFullscreen": "退出全屏",
			"dock.emptyPane": "空面板",
			"dock.splitPane": "分栏",
			"dock.splitPaneDisabled": "已达两格上限",
			"dock.splitPaneNarrow": "栏宽不足，拖宽侧边栏后再分栏",
			"dock.closeTab": "关闭",
			"dock.addTab": "新标签页",
			"dock.dockFloat": "收回到侧边栏",
			"dock.closeFloat": "关闭",
			"dock.drop.center": "移到这里",
			"dock.drop.left": "左分栏",
			"dock.drop.right": "右分栏",
			"dock.drop.top": "上分栏",
			"dock.drop.bottom": "下分栏",
			"tab.guide.title": "开始",
			"tab.unavailable": "这类内容还没有可用的查看方式。"
		};
		/** English dictionary, checked against the Chinese key set. */
		const en = {
			"command.close": "Close current page or window",
			"command.refresh": "Refresh current page",
			"command.noRefresh": "This page cannot be refreshed",
			"command.toggle": "Toggle right sidebar",
			"command.fullscreen": "Toggle panel fullscreen",
			"command.noSession": "Select a session first",
			"command.noFocus": "Focus a right sidebar pane first",
			"command.stale": "The page changed; focus it again",
			"command.collapsed": "Expand the right sidebar first",
			"command.float": "This action is unavailable in a floating panel",
			"command.empty": "Open a page first",
			"command.budget": "Two panes is the limit",
			"command.width": "Not enough width to split, widen the sidebar",
			"chrome.expand": "Open sidebar",
			"chrome.expandAria": "Open right sidebar",
			"chrome.collapse": "Collapse sidebar",
			"chrome.collapseAria": "Collapse right sidebar",
			"chrome.toFullscreen": "Fullscreen",
			"chrome.exitFullscreen": "Exit fullscreen",
			"dock.emptyPane": "Empty pane",
			"dock.splitPane": "Split",
			"dock.splitPaneDisabled": "Two panes is the limit",
			"dock.splitPaneNarrow": "Not enough width to split, widen the sidebar",
			"dock.closeTab": "Close",
			"dock.addTab": "New tab",
			"dock.dockFloat": "Send back to the sidebar",
			"dock.closeFloat": "Close",
			"dock.drop.center": "Move here",
			"dock.drop.left": "Add left split",
			"dock.drop.right": "Add right split",
			"dock.drop.top": "Add top split",
			"dock.drop.bottom": "Add bottom split",
			"tab.guide.title": "Start",
			"tab.unavailable": "Nothing here can view this kind of content yet."
		};
		//#endregion
		//#region lib/types/client/tabs/guide/definition.js
		/** The shipped guide implementation's identity: the key its body registers under. */
		const GUIDE_ID = "@deepseek-ai/dsh-client-ui-sidebar-right/guide";
		/**
		* The guide type's registry definition.
		*
		* A page type: it recognizes no resource address, because a guide views
		* nothing, and is opened by kind; `builtin` is the ordinary band for a type
		* shipped here.
		* @param t - namespace-bound translate, read fresh on every title call.
		* @returns the definition to register.
		*/
		function guideDefinition(t) {
			return {
				id: GUIDE_ID,
				kind: GUIDE_KIND,
				priority: "builtin",
				title: () => t("tab.guide.title")
			};
		}
		//#endregion
		//#region lib/types/client/tab-info.js
		/**
		* Bind a tab occurrence without subscribing or creating records during factory evaluation.
		* @param standard - framework session identity.
		* @param context - stable record lifetime and framework-bound readers.
		* @returns the tab information hook.
		*/
		const tabInfoFactory = (standard, context) => {
			const { sessionId } = standard;
			const { tabId, title, fullscreen, active, signal, actions, useStore, useTabNavigation, shortcuts } = context;
			return function useTabInfo() {
				const layout = useStore((state) => state.bySession[sessionId]?.layout);
				const navigation = useTabNavigation(tabId);
				return (0, react.useMemo)(() => {
					const tab = layout?.tabs[tabId];
					if (layout === void 0 || tab === void 0 || navigation === void 0) throw new Error(`sidebarRight: tab "${tabId}" is not committed in session "${sessionId}"`);
					const pane = (0, _deepseek_ai_dsh_client_ui_dockkit.findTabPane)(layout, tabId);
					return {
						sidebar: {
							expanded: layout.expanded,
							fullscreen
						},
						panel: { id: pane.id },
						tab: {
							...tab,
							visible: active && (pane.host === "float" || layout.expanded && (title || pane.activeTabId === tabId)),
							navigation,
							signal,
							actions,
							refreshShortcut: shortcuts.find((row) => row.id === "page.refresh")
						}
					};
				}, [
					layout,
					navigation,
					tabId,
					title,
					fullscreen,
					active,
					signal,
					actions,
					shortcuts
				]);
			};
		};
		/**
		* Forward the framework-bound tab hook to guide content.
		* @param _standard - the guide's framework standard props.
		* @param useTabInfo - the enclosing tab's framework-bound reader.
		* @returns the same reader for the replacement.
		*/
		const guideTabInfoFactory = (_standard, useTabInfo) => useTabInfo;
		//#endregion
		//#region lib/types/client/index.js
		/** This package's copy namespace. */
		const NS = "sidebarRight";
		/** Required browser services: the slot registry, the frame's panel actions, copy, and the resource model. */
		const inject = [
			"slots",
			"layout",
			"locale",
			"resources",
			"sessions",
			"uiSession",
			"shortcuts"
		];
		/**
		* Client plugin body: provide the registry and the navigation face, register the
		* panel seat and the rail seat over one store with their extension children, and
export {};
