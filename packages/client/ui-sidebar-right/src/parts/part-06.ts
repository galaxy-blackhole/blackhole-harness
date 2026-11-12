/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		* tree's rows. A resource is claimed through the registry by address; a page is
		* named by kind and recorded at the address this package composes for it. Both
		* hand the store one settled intent and record the navigation in the Tab
		* domain. Placement is the caller's option, never a type's property.
		*
		* The registration adopts Session stores, names the on-screen Session, and
		* forwards the seats' reports; callers use the service's navigation methods.
		*/
		/**
		* Create the public controller and the plugin-private Session callbacks.
		* Adoption reconciles restored records before any seat renders, then follows commits.
		* @param tabs - registered tab types.
		* @param pin - resource retention for an occurrence's lifetime.
		* @param host - the viewport rule and focus continuity the commands use.
		* @returns the controller; store adoption and scope removal; naming the on-screen Session; and recording a seat's room rule.
		*/
		function createSidebarRightController(tabs, pin, host) {
			const adopted = /* @__PURE__ */ new Map();
			const rooms = /* @__PURE__ */ new Map();
			const onScreen = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(void 0);
			const inventory = new SidebarTabInventory();
			const controller = new SidebarRightController(tabs, pin, host, {
				adopted,
				rooms,
				onScreen,
				openTabs: inventory.source
			});
			return {
				controller,
				forget: (sessionId) => {
					inventory.remove(sessionId);
					rooms.delete(sessionId);
				},
				show: (sessionId) => {
					if (onScreen.getSnapshot() !== sessionId) onScreen.set(sessionId);
				},
				measure: (sessionId, canSplitPane) => {
					rooms.set(sessionId, canSplitPane);
				},
				adopt(sessionId, store) {
					adopted.get(sessionId)?.unsubscribe();
					const sync = () => {
						const surface = store.getSnapshot().bySession[sessionId];
						inventory.update(sessionId, Object.values(surface?.layout.tabs ?? {}));
						if (surface !== void 0) controller.tabDomain.sync(sessionId, surface.layout);
					};
					const adoption = {
						store,
						unsubscribe: store.subscribe(sync)
					};
					adopted.set(sessionId, adoption);
					sync();
					return () => {
						adoption.unsubscribe();
						if (adopted.get(sessionId) === adoption) adopted.delete(sessionId);
					};
				}
			};
		}
		/** The scheme every resource address carries; anything else is not a resource this face opens. */
		const RESOURCE_SCHEME = "dsh-resource://";
		/** Cross-plugin right-Sidebar face (ctx.sidebarRight). */
		var SidebarRightController = class {
			tabs;
			host;
			/** Open tab metadata across saved and adopted Sessions, independent of visible seats. */
			openTabs;
			/** The on-screen Session; see {@link ISidebarRight.mounted}. */
			mounted;
			adopted;
			rooms;
			closeHandlers = /* @__PURE__ */ new Map();
			/**
			* Register resource cleanup before explicit removal. Failure preserves the tab.
			* @param kind - tab kind owned by the registering plugin.
			* @param handler - saves any background cleanup before returning and allowing removal.
			* @returns an effect-scoped unregister callback.
			*/
			registerCloseHandler(kind, handler) {
				if (this.closeHandlers.has(kind)) throw new Error(`sidebarRight: close handler already registered for ${kind}`);
				this.closeHandlers.set(kind, handler);
				return () => {
					if (this.closeHandlers.get(kind) === handler) this.closeHandlers.delete(kind);
				};
			}
			/**
			* The Tab domain this controller navigates into; synced from each adopted
			* store's commits, read by the seat for each body's owner share.
			*/
			tabDomain;
			/**
			* @param tabs - the tab-type registry consulted to claim an address.
			* @param pin - `ctx.resources.pin`, which the Tab domain holds addresses with.
			* @param host - the viewport rule and focus continuity the commands use.
			* @param sessions - plugin-owned adopted stores, room rules, on-screen Session, and open tab metadata.
			*/
			constructor(tabs, pin, host, sessions) {
				this.tabs = tabs;
				this.host = host;
				this.adopted = sessions.adopted;
				this.rooms = sessions.rooms;
				this.mounted = sessions.onScreen;
				this.openTabs = sessions.openTabs;
				this.tabDomain = new TabDomain(this, pin);
			}
			/**
			* Read the committed tabs of a Session so providers can restore their content.
			* @param sessionId - Session whose layout has been adopted.
			* @returns its open records, or an empty list before adoption.
			*/
			tabsIn(sessionId) {
				return Object.values(this.adopted.get(sessionId)?.store.getSnapshot().bySession[sessionId]?.layout.tabs ?? {});
			}
			/**
			* Open a resource: claim it, place it, reveal the column, record the navigation.
			* @param address - a `dsh-resource://<type>/…` address.
			* @param options - placement, the opening type, and navigation parameters.
			*/
			openResource(address, options = {}) {
				const { sessionId, actions } = this.require();
				this.placeResource(sessionId, actions, address, options);
			}
			/**
			* Open a page type by kind at the address this package records pages under.
			* @param kind - the page type's kind.
			* @param options - placement and that kind's navigation parameters.
			*/
			openTab(kind, options = {}) {
				const { sessionId, actions } = this.require();
				this.placeTab(sessionId, actions, kind, options);
			}
			/**
			* Open a resource in one session, for a tab's own action; nothing happens
			* for a session whose store was never adopted or whose adoption was released.
			* Not part of `ISidebarRight`: the Tab domain's path.
			* @param sessionId - the session the acting tab is in.
			* @param address - a `dsh-resource://<type>/…` address.
			* @param options - placement, the opening type, and navigation parameters.
			*/
			openResourceIn(sessionId, address, options = {}) {
				const actions = this.actionsFor(sessionId);
				if (actions !== void 0) this.placeResource(sessionId, actions, address, options);
			}
			/**
			* Open a page type in one session, for a tab's own action; nothing happens
			* for a session whose store was never adopted or whose adoption was released.
			* Not part of `ISidebarRight`: the Tab domain's path.
			* @param sessionId - the session the acting tab is in.
			* @param kind - the page type's kind.
			* @param options - placement and that kind's navigation parameters.
			*/
			openTabIn(sessionId, kind, options = {}) {
				const actions = this.actionsFor(sessionId);
				if (actions !== void 0) this.placeTab(sessionId, actions, kind, options);
			}
			/**
			* Close a tab of one session, preserving the sole docked guide; nothing happens
			* for a session whose store was never adopted or whose adoption was released.
			* Not part of `ISidebarRight`: the Tab domain's path.
			* @param sessionId - the session the tab is in.
			* @param tabId - the tab to close.
			*/
			closeIn(sessionId, tabId) {
				const actions = this.actionsFor(sessionId);
				const surface = this.adopted.get(sessionId)?.store.getSnapshot().bySession[sessionId];
				if (actions === void 0 || surface === void 0) return;
				const tab = surface.layout.tabs[tabId];
				if (tab === void 0 || !canCloseTab(surface, tabId)) return;
				this.removeAfterCleanup(sessionId, tab, () => {
					actions.closeTab(sessionId, tabId);
				});
			}
			removeAfterCleanup(sessionId, tab, commit) {
				this.closeHandlers.get(tab.kind)?.(sessionId, tab);
				commit();
			}
			/** Claim a resource and place it in one session; an address outside the scheme or one no type claims throws. */
			placeResource(sessionId, actions, address, options) {
				if (!address.startsWith(RESOURCE_SCHEME)) throw new Error(`sidebarRight: no registered tab type claims "${address}"`);
				this.place(sessionId, actions, this.tabs.claim(address, options.kind), address, options, options.params);
			}
			/** Place a page type in one session at the address pages are recorded under; an unregistered kind throws. */
			placeTab(sessionId, actions, kind, options) {
				const definition = this.tabs.get(kind);
				if (definition === void 0) throw new Error(`sidebarRight: no tab type is registered as "${kind}"`);
				const address = definition.multiple === true ? `${pageAddress(kind)}/${randomUUID()}` : pageAddress(kind);
				this.place(sessionId, actions, {
					kind,
					contentId: address,
					title: definition.title(address)
				}, address, options, options.params);
			}
			/** The steps both opens share: one store intent, and the navigation record for the tab it settles on. */
			place(sessionId, actions, claim, address, placement, params) {
				const surface = this.adopted.get(sessionId)?.store.getSnapshot().bySession[sessionId];
				const targetPane = surface === void 0 ? void 0 : placement.paneId ?? (0, _deepseek_ai_dsh_client_ui_dockkit.activeDockPaneId)(surface.layout);
				const target = targetPane === void 0 ? void 0 : surface?.layout.nodes[targetPane];
				const preferNewPane = placement.preferNewPane === true && placement.replaceTab === void 0 && surface !== void 0 && target?.kind === "pane" && target.host === "dock" && target.tabs.length > 0 && (0, _deepseek_ai_dsh_client_ui_dockkit.canSplit)(surface.layout) && (0, _deepseek_ai_dsh_client_ui_dockkit.dockPaneIds)(surface.layout).length < 2 && this.mounted.getSnapshot() === sessionId && this.canSplitPane(sessionId, target.id);
				const commit = () => {
					actions.openContent(sessionId, {
						kind: claim.kind,
						contentId: claim.contentId,
						title: claim.title,
						...placement.paneId === void 0 ? {} : { paneId: placement.paneId },
						...preferNewPane ? { preferNewPane: true } : {},
						...placement.replaceTab === void 0 ? {} : { replaceTab: placement.replaceTab },
						...placement.revealIfOpened === void 0 ? {} : { revealIfOpened: placement.revealIfOpened }
					}, (tabId) => {
						this.tabDomain.navigate(sessionId, tabId, {
							address,
							params
						});
					});
				};
				const layout = surface?.layout;
				const replaced = placement.replaceTab === void 0 ? void 0 : layout?.tabs[placement.replaceTab];
				const replacementPane = replaced === void 0 || layout === void 0 ? void 0 : (0, _deepseek_ai_dsh_client_ui_dockkit.findTabPane)(layout, replaced.id);
				const revealed = layout === void 0 ? void 0 : claim.contentId === pageAddress(claim.kind) ? (0, _deepseek_ai_dsh_client_ui_dockkit.findPaneContentTab)(layout, replacementPane?.host === "dock" ? replacementPane.id : placement.paneId ?? (0, _deepseek_ai_dsh_client_ui_dockkit.activeDockPaneId)(layout), claim.contentId, claim.kind) : placement.revealIfOpened === false ? void 0 : (0, _deepseek_ai_dsh_client_ui_dockkit.findContentTab)(layout, claim.contentId, claim.kind);
				if (replaced === void 0 || replaced.id === revealed) {
					commit();
					return;
				}
				this.removeAfterCleanup(sessionId, replaced, commit);
			}
			/**
			* Close one tab of the on-screen Session; the sole docked guide remains open.
			* @param tabId - the tab to close.
			*/
			close(tabId) {
				this.closeIn(this.require().sessionId, tabId);
			}
			/**
			* The active tab of the active pane.
			* @returns the record, or `undefined` without an on-screen surface.
			*/
			active() {
				const layout = this.mountedSurface()?.layout;
				if (layout === void 0) return void 0;
				const { activeTabId } = (0, _deepseek_ai_dsh_client_ui_dockkit.getPane)(layout, layout.activePaneId);
				return Object.values(layout.tabs).find((tab) => tab.id === activeTabId);
			}
			/**
			* Whether the column is currently showing its panel.
			* @returns `true` while expanded; `false` while collapsed or without an on-screen surface.
			*/
			isExpanded() {
				return this.mountedSurface()?.layout.expanded ?? false;
			}
			/** Collapse the column, or expand it and focus its active dock pane after rendering. */
			toggleExpanded() {
				const { sessionId, actions } = this.require();
				this.host.openWithFocus(sessionId, () => {
					actions.toggleExpanded(sessionId);
					const layout = this.mountedSurface()?.layout;
					return layout?.expanded ? (0, _deepseek_ai_dsh_client_ui_dockkit.activeDockPaneId)(layout) : void 0;
				});
			}
			/**
			* Focus a tab and the pane holding it; a missing tab is left alone.
			* @param tabId - the tab to focus.
			*/
			focus(tabId) {
				const { sessionId, actions } = this.require();
				if (this.mountedSurface()?.layout.tabs[tabId] === void 0) return;
				actions.focusTab(sessionId, tabId);
			}
			/**
			* Capture the page owning current DOM focus; outside focus never uses layout history.
			* @param element - explicit input target, including an embedding iframe; defaults to live document focus.
			* @returns current focused page identity, or undefined outside a visible sidebar page.
			*/
			focusedTarget(element = document.activeElement) {
				const screen = this.screen();
				return screen === void 0 ? void 0 : sidebarTargetFromElement(element, screen.sessionId, screen.surface.layout, (tabId) => this.tabDomain.occurrence(screen.sessionId, { id: tabId }));
			}
			/**
			* Choose a focused sidebar pane, or the on-screen Session's active dock pane for an outside open.
			* @param element - live command input target; stale sidebar markup never falls back to another pane.
			* @returns captured target, or undefined without an on-screen surface.
			*/
			commandTarget(element = document.activeElement) {
				const focused = this.focusedTarget(element);
				if (focused !== void 0 || element?.closest("[data-sidebar-right-session]")) return focused;
				const screen = this.screen();
				if (screen === void 0) return void 0;
				const { sessionId, surface: { layout } } = screen;
				const pane = (0, _deepseek_ai_dsh_client_ui_dockkit.getPane)(layout, (0, _deepseek_ai_dsh_client_ui_dockkit.activeDockPaneId)(layout));
				const tabId = pane.activeTabId;
				const held = tabId === void 0 ? void 0 : this.tabDomain.occurrence(sessionId, { id: tabId });
				return {
					sessionId,
					paneId: pane.id,
					host: pane.host,
					tabId,
					occurrence: held,
					navigationRevision: held?.navigation.getSnapshot().revision
				};
			}
			/**
			* Open from a captured pane using the guide's replacement and floating placement rules.
			* @param kind - registered page kind.
			* @param target - captured live pane and optional page.
			*/
			openTabFromTarget(kind, target) {
				if (!this.isTargetCurrent(target)) return;
				const { sessionId, actions } = this.require();
				this.host.openWithFocus(sessionId, () => {
					const tab = target.tabId === void 0 ? void 0 : this.mountedSurface()?.layout.tabs[target.tabId];
					if (target.host === "float" && tab?.kind === kind && this.tabs.get(kind)?.multiple !== true) {
						actions.setExpanded(sessionId, true);
						this.focus(tab.id);
					} else this.openTab(kind, {
						...target.host === "dock" ? { paneId: target.paneId } : {},
						...tab?.kind === "guide" ? { replaceTab: tab.id } : {}
					});
					return this.mountedSurface()?.layout.activePaneId;
				});
			}
			/**
			* Test explicit close eligibility without using the last selected page.
			* @param target - captured focused page.
			* @returns whether this current page can be removed or its sole guide pane collapsed.
			*/
			canCloseTarget(target) {
				return this.isTargetCurrent(target) && target.tabId !== void 0;
			}
			/**
			* Remove a captured page through its resource cleanup handler, or collapse the sole docked guide.
			* Cleanup errors propagate and preserve the page.
			* @param target - page captured while resolving the command.
			* @returns closed after removal or collapse, unavailable without a page, or stale after identity changes.
			*/
			closeTarget(target) {
				if (!this.isTargetCurrent(target)) return "stale";
				const surface = this.mountedSurface();
				if (surface === void 0 || target.tabId === void 0) return "unavailable";
				const tabId = target.tabId;
				const { sessionId, actions } = this.require();
				this.host.closeWithFocus(sessionId, target.paneId, () => {
					if (canCloseTab(surface, tabId)) this.close(tabId);
					else actions.setExpanded(sessionId, false);
				});
				return "closed";
			}
			/**
			* Check a captured target before acting, including reopened records and intervening navigation.
			* @param target - identity captured while resolving the input.
			* @returns whether the on-screen Session, pane, tab lifetime and navigation still match.
			*/
			isTargetCurrent(target) {
				if (this.mounted.getSnapshot() !== target.sessionId) return false;
				const layout = this.mountedSurface()?.layout;
				const pane = layout?.nodes[target.paneId];
				if (pane?.kind !== "pane" || pane.host !== target.host) return false;
				if (target.tabId === void 0) return pane.activeTabId === void 0;
				if (!pane.tabs.includes(target.tabId) || layout?.tabs[target.tabId] === void 0) return false;
				const held = this.tabDomain.occurrence(target.sessionId, { id: target.tabId });
				return held === target.occurrence && !held.signal.aborted && held.navigation.getSnapshot().revision === target.navigationRevision;
			}
			/**
			* Explain the same geometry and pane-budget rule used by the split control.
			* @param target - captured command or button target.
			* @returns a localizable block discriminator, or undefined when splitting is available.
			*/
			splitBlock(target) {
				const surface = this.mountedSurface();
				if (surface === void 0 || !this.isTargetCurrent(target)) return "stale";
				const { layout } = surface;
				if (target.host === "float") return "float";
				if (!layout.expanded) return "collapsed";
				if ((0, _deepseek_ai_dsh_client_ui_dockkit.getPane)(layout, target.paneId).tabs.length === 0) return "empty";
				if (!(0, _deepseek_ai_dsh_client_ui_dockkit.canSplit)(layout) || (0, _deepseek_ai_dsh_client_ui_dockkit.dockPaneIds)(layout).length >= 2) return "budget";
				if (!this.canSplitPane(target.sessionId, target.paneId)) return "width";
			}
			/**
			* Toggle the right panel's display mode through the same action as its chrome button.
			* @param target - captured dock pane; floating and stale targets are unchanged.
			*/
			toggleFullscreen(target) {
				if (!this.isTargetCurrent(target) || target.host === "float" || !this.isExpanded()) return;
				const { sessionId, actions } = this.require();
				const autoFullscreen = this.host.autoFullscreen();
				const fullscreen = autoFullscreen || this.mountedSurface()?.layout.mode === "fullscreen";
				if (fullscreen && autoFullscreen) actions.setExpanded(sessionId, false);
				actions.setMode(sessionId, fullscreen ? "push" : "fullscreen");
			}
			/**
			* Split a docked pane to its right when the budget and the room rule allow.
			* @param paneId - the pane to split; defaults to the active docked pane.
			* @returns the new pane's id, or `undefined` when nothing was split.
			*/
			split(paneId) {
				const { sessionId, actions } = this.require();
				const layout = this.mountedSurface()?.layout;
				if (layout === void 0) return void 0;
				const target = paneId ?? (0, _deepseek_ai_dsh_client_ui_dockkit.activeDockPaneId)(layout);
				const node = layout.nodes[target];
				if (node === void 0 || node.kind !== "pane" || node.host !== "dock") return void 0;
				if (!(0, _deepseek_ai_dsh_client_ui_dockkit.canSplit)(layout) || (0, _deepseek_ai_dsh_client_ui_dockkit.dockPaneIds)(layout).length >= 2 || !this.canSplitPane(sessionId, target)) return void 0;
				let created;
export {};
