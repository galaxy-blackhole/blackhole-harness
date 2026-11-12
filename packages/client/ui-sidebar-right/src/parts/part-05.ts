/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		}
		/**
		* Keep independent Session subtrees and hide those outside the selected Conversation.
		* @param props - frame geometry, view targets and the authorized Session renderer.
		* @returns the foreground and retained background Sidebars.
		*/
		function RightbarRoot({ usePanelInfo, useViews, ...props }) {
			const visible = usePanelInfo((info) => info.activePanelId === null);
			return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: useViews((value) => value).map((view) => (0, react_jsx_runtime.jsx)(SessionView, {
				...props,
				view,
				visible
			}, view.sessionId)) });
		}
		//#endregion
		//#region lib/types/client/session-view.js
		/** Owns its reference until retirement finishes or the Sidebar plugin shuts down. */
		var SidebarSessionView = class {
			sessionId;
			onDispose;
			onTabRelease;
			/** Session reference released exclusively by this View. */
			reference;
			tabs = /* @__PURE__ */ new Map();
			mounts = 0;
			retired = false;
			disposed = false;
			/**
			* @param sessionId - Session displayed by this view.
			* @param sessions - allocator for this view's independent reference.
			* @param onDispose - removes this view from the collection's index before reference release.
			* @param onTabRelease - reconsiders retention after a body releases its hold.
			*/
			constructor(sessionId, sessions, onDispose, onTabRelease) {
				this.sessionId = sessionId;
				this.onDispose = onDispose;
				this.onTabRelease = onTabRelease;
				this.reference = sessions.retain(sessionId, { source: "sidebarView" });
				this.reference.ready.catch((error) => {
					console.error("Sidebar Session opening failed:", error);
				});
			}
			/** Whether an initialized retained body still needs this view. */
			get hasRetainedTabs() {
				return this.tabs.size > 0;
			}
			/**
			* Keep a retired View's reference until its committed roots finish unmounting.
			* @returns cleanup to call once for this root; the final cleanup releases a retired View.
			*/
			mount() {
				this.mounts += 1;
				return () => {
					this.mounts -= 1;
					if (this.retired && this.mounts === 0) this.dispose();
				};
			}
			/**
			* Hold an initialized body until unmount or occurrence cancellation.
			* @param tabId - initialized body identity.
			* @param signal - occurrence lifetime; closing and undoing a tab creates a new lifetime.
			* @returns idempotent release of this body's hold.
			*/
			retainTab = (tabId, signal) => {
				if (signal.aborted || this.disposed) return () => {};
				this.tabs.set(tabId, (this.tabs.get(tabId) ?? 0) + 1);
				let held = true;
				const release = () => {
					if (!held) return;
					held = false;
					signal.removeEventListener("abort", release);
					const count = this.tabs.get(tabId);
					if (count === 1) this.tabs.delete(tabId);
					else this.tabs.set(tabId, count - 1);
					this.onTabRelease(this);
				};
				signal.addEventListener("abort", release, { once: true });
				return release;
			};
			/** End a withdrawn view after its existing committed mounts finish. */
			retire() {
				this.retired = true;
				if (this.mounts === 0) this.dispose();
			}
			/** Release once; plugin shutdown does not wait for remaining React mounts. */
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				this.retired = true;
				this.onDispose(this);
				this.reference.release();
			}
		};
		//#endregion
		//#region lib/types/client/session-views.js
		/** Selects and retires views; the Sidebar plugin's injected dependencies own global teardown. */
		var SidebarSessionViews = class {
			sessions;
			/** Selected and retained View targets observed by the root renderer. */
			source = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)([]);
			views = /* @__PURE__ */ new Map();
			viewsByReference = /* @__PURE__ */ new Map();
			selected;
			closed = false;
			constructor(sessions) {
				this.sessions = sessions;
			}
			/**
			* Change the foreground Session while preserving retained background Views.
			* @param sessionId - main selection, or absence.
			*/
			select(sessionId) {
				if (this.closed || this.selected === sessionId) return;
				this.selected = sessionId;
				if (sessionId !== void 0 && !this.views.has(sessionId)) {
					const view = new SidebarSessionView(sessionId, this.sessions, (disposed) => {
						this.viewsByReference.delete(disposed.reference);
					}, (released) => {
						this.prune(released);
					});
					this.views.set(sessionId, view);
					this.viewsByReference.set(view.reference, view);
				}
				for (const view of this.views.values()) this.prune(view);
				this.publish();
			}
			/**
			* Bind a committed root; release retired references after that root unmounts.
			* @param reference - framework target published by this owner.
			* @returns releases this committed mount.
			*/
			mount(reference) {
				const view = this.viewsByReference.get(reference);
				if (view === void 0) {
					if (this.closed) return () => {};
					throw new Error("Sidebar Session view reference is no longer owned");
				}
				return view.mount();
			}
			/** Plugin shutdown releases every view, including any awaiting a React unmount. */
			dispose() {
				this.closed = true;
				this.views.clear();
				this.source.set([]);
				for (const view of this.viewsByReference.values()) view.dispose();
			}
			prune(view) {
				if (view.sessionId === this.selected || view.hasRetainedTabs || this.views.get(view.sessionId) !== view) return;
				this.views.delete(view.sessionId);
				this.publish();
				view.retire();
			}
			publish() {
				this.source.set([...this.views.values()].sort((a, b) => a.sessionId.localeCompare(b.sessionId)).map((view) => ({
					sessionId: view.sessionId,
					reference: view.reference,
					selected: view.sessionId === this.selected,
					retainTab: view.retainTab
				})));
			}
		};
		//#endregion
		//#region ../../util/crypto/src/index.ts
		/**
		* Random v4 UUID, minted from `crypto.getRandomValues`.
		* @returns the UUID string.
		*/
		function randomUUID() {
			const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
			const hex = Array.from(bytes, (byte, index) => {
				return (index === 6 ? byte & 15 | 64 : index === 8 ? byte & 63 | 128 : byte).toString(16).padStart(2, "0");
			}).join("");
			return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
		}
		//#endregion
		//#region lib/types/client/tab-domain.js
		/** Every session's occurrences. */
		var TabDomain = class {
			navigator;
			pin;
			bySession = /* @__PURE__ */ new Map();
			/**
			* @param navigator - where tab actions go, aimed at the tab's session; the navigation controller.
			* @param pin - `ctx.resources.pin`, called once per occurrence at its first sync.
			*/
			constructor(navigator, pin) {
				this.navigator = navigator;
				this.pin = pin;
			}
			/**
			* Reconcile one session's occurrences with its committed layout.
			*
			* Called by the seat after every commit, and only then: aborting a vanished
			* record runs the types' cleanup, which writes their stores.
			* @param sessionId - the session whose layout committed.
			* @param layout - that session's layout as committed.
			*/
			sync(sessionId, layout) {
				const held = this.session(sessionId);
				for (const [tabId, occurrence] of held) {
					if (layout.tabs[tabId] !== void 0) continue;
					held.delete(tabId);
					occurrence.controller.abort();
				}
				for (const tab of Object.values(layout.tabs)) {
					const occurrence = held.get(tab.id) ?? this.hold(sessionId, tab.id, {
						address: tab.contentId,
						params: void 0,
						revision: 0
					});
					const pane = (0, _deepseek_ai_dsh_client_ui_dockkit.findTabPane)(layout, tab.id);
					occurrence.paneId = pane.host === "dock" ? pane.id : void 0;
					if (occurrence.pinned) continue;
					occurrence.pinned = true;
					this.pin(occurrence.navigation.getSnapshot().address, occurrence.signal);
				}
			}
			/**
			* Read an occurrence created by navigation or committed-store reconciliation.
			* @param sessionId - the session the record is in.
			* @param tab - the record being drawn.
			* @returns its occurrence.
			* @throws when the record has not been reconciled or has disappeared.
			*/
			occurrence(sessionId, tab) {
				const occurrence = this.bySession.get(sessionId)?.get(tab.id);
				if (occurrence === void 0) throw new Error(`sidebarRight: tab "${tab.id}" has no committed occurrence in session "${sessionId}"`);
				return occurrence;
			}
			/**
			* Record that an `open` settled on a tab.
			*
			* A record the layout has not yet shown the seat gets its occurrence here, so
			* the body's first render already carries the opener's `params`.
			* @param sessionId - the session opened into.
			* @param tabId - the tab the open settled on.
			* @param target - the address and the opener's params.
			*/
			navigate(sessionId, tabId, target) {
				const existing = this.session(sessionId).get(tabId);
				if (existing === void 0) {
					this.hold(sessionId, tabId, {
						...target,
						revision: 1
					});
					return;
				}
				existing.navigation.set({
					...target,
					revision: existing.navigation.getSnapshot().revision + 1
				});
			}
			/** Abort every occurrence of every session; the package is unloading. */
			dispose() {
				for (const held of this.bySession.values()) for (const occurrence of held.values()) occurrence.controller.abort();
				this.bySession.clear();
			}
			session(sessionId) {
				let held = this.bySession.get(sessionId);
				if (held === void 0) {
					held = /* @__PURE__ */ new Map();
					this.bySession.set(sessionId, held);
				}
				return held;
			}
			hold(sessionId, tabId, navigation) {
				const controller = new AbortController();
				const { navigator } = this;
				const place = (placement) => ({
					...placement.replaceTab === true ? { replaceTab: tabId } : held.paneId === void 0 ? {} : { paneId: held.paneId },
					...placement.paneId === void 0 ? {} : { paneId: placement.paneId },
					...placement.preferNewPane === void 0 ? {} : { preferNewPane: placement.preferNewPane },
					...placement.revealIfOpened === void 0 ? {} : { revealIfOpened: placement.revealIfOpened }
				});
				const held = {
					id: randomUUID(),
					sessionId,
					tabId,
					controller,
					commands: {},
					signal: controller.signal,
					navigation: (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(navigation),
					paneId: void 0,
					pinned: false,
					tabActions: {
						bindCommands: (commands) => {
							if (controller.signal.aborted) return () => {};
							held.commands = commands;
							const release = () => {
								if (held.commands === commands) held.commands = {};
								controller.signal.removeEventListener("abort", release);
							};
							controller.signal.addEventListener("abort", release, { once: true });
							return release;
						},
						openResource: (address, options = {}) => {
							navigator.openResourceIn(sessionId, address, {
								...place(options),
								params: options.params
							});
						},
						openTab: (kind, options = {}) => {
							navigator.openTabIn(sessionId, kind, {
								...place(options),
								params: options.params
							});
						},
						close: () => {
							navigator.closeIn(sessionId, tabId);
						}
					}
				};
				this.session(sessionId).set(tabId, held);
				return held;
			}
		};
		//#endregion
		//#region lib/types/client/tab-inventory.js
		/** Metadata inventory of saved and adopted layouts without mounting their content. */
		/** Derived membership only; layout stores remain the persisted authority. */
		var SidebarTabInventory = class {
			sessions = /* @__PURE__ */ new Map();
			snapshot = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)([]);
			/** Read-only metadata observable shared with content providers. */
			source = this.snapshot;
			/** Read saved layouts once before the root service is published. */
			constructor() {
				try {
					if (typeof localStorage === "undefined") return;
					const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
					for (const key of keys) {
						if (key === null || !key.startsWith(`dsh.sidebar-right.v1.`)) continue;
						const sessionId = key.slice(21);
						const saved = readSidebarLayout(sessionId);
						if (saved !== void 0) this.sessions.set(sessionId, Object.values(saved.layout.tabs).map((tab) => ({
							sessionId,
							tabId: tab.id,
							kind: tab.kind,
							contentId: tab.contentId
						})));
					}
					this.publish();
				} catch (_storageUnavailable) {}
			}
			/**
			* Replace membership from the authoritative in-window store.
			* @param sessionId - adopted Session.
			* @param tabs - current committed records.
			*/
			update(sessionId, tabs) {
				this.sessions.set(sessionId, tabs.map((tab) => ({
					sessionId,
					tabId: tab.id,
					kind: tab.kind,
					contentId: tab.contentId
				})));
				this.publish();
			}
			/**
			* Forget a permanently cleared scope.
			* @param sessionId - removed Session scope.
			*/
			remove(sessionId) {
				this.sessions.delete(sessionId);
				this.publish();
			}
			publish() {
				const next = [...this.sessions.values()].flat();
				if (JSON.stringify(next) !== JSON.stringify(this.snapshot.getSnapshot())) this.snapshot.set(next);
			}
		};
		//#endregion
		//#region lib/types/client/service.js
		/**
		* `ctx.sidebarRight`: what other plugins may ask of this column.
		*
		* The surface is per session and its state lives in that session's store
		* instance, which the slot runtime mints per session and a root service cannot
		* reach on its own. The plugin adopts each session's store instance as the
		* runtime mints it, so the controller reaches any session's store by id and
		* syncs the Tab domain from that store's commits, on screen or not.
		*
		* The plugin also names the Session on screen — the selected Session while the
		* Conversation fills the main column — from the selection and the main panel,
		* before React renders either change, and publishes it as `mounted`. Every
		* command on the public face acts on that Session through its adopted store; a
		* command with no Session on screen, or with one whose store the runtime has not
		* minted, has nothing to act on and fails loudly rather than writing into a
		* surface nobody is drawing. The seats never publish which Session they draw:
		* they report only what they render with, the room their docking kit measured
		* and the automatic fullscreen rule of their frame width.
		*
		* A tab's own actions (`tabActions`) aim at the session the tab is in, not at
		* the on-screen one: they run through that session's adopted store, so a callback
		* fired after the user switched sessions still lands where its tab is, and they
		* do nothing for a session whose store was never minted.
		*
		* `openResource` and `openTab` are the navigation controller, and every way
		* into the column is a call to one of them: the conversation's file links, a
		* tool row's line reference, the strip's add control, a guide entry box, a file
export {};
