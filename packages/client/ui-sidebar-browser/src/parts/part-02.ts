/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				};
			}
			return {
				ok: false,
				reason: "protocol"
			};
		}
		//#endregion
		//#region lib/types/client/browser/BrowserController.js
		/** Carrier-independent tab commands and renderer-facing state. */
		/** Owns input validation and page lifetime without inspecting the carrier type. */
		var BrowserController = class {
			options;
			page;
			store;
			unsubscribe;
			actions;
			checkpoint;
			started = false;
			disposed = false;
			disposal;
			abort = () => {
				this.dispose();
			};
			/** @param options - identity, persistence, page factory and source-tab navigation. */
			constructor(options) {
				this.options = options;
				this.actions = options.actions;
				this.checkpoint = options.initial;
				this.page = options.createPage({
					initial: options.initial,
					persist: (state) => {
						if (this.disposed) return;
						this.checkpoint = state;
						this.actions.replace(options.tabId, state);
					},
					openRequested: (value) => {
						if (this.disposed) return;
						const result = parseBrowserAddress(value, options.applicationOrigin);
						if (!result.ok) {
							this.addressFailed(result.reason);
							return;
						}
						options.openTab(result.target.url);
					}
				});
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
					frame: this.page.frame.getSnapshot(),
					restoreTarget: currentBrowserTarget(this.checkpoint),
					addressFailure: void 0,
					addressRevision: 0
				});
				this.unsubscribe = this.page.frame.subscribe(() => {
					if (this.disposed) return;
					const current = this.store.getSnapshot();
					const frame = this.page.frame.getSnapshot();
					const changed = frame.target?.url !== current.frame.target?.url;
					this.store.set({
						frame,
						restoreTarget: frame.target === void 0 ? currentBrowserTarget(this.checkpoint) : void 0,
						addressFailure: changed ? void 0 : current.addressFailure,
						addressRevision: current.addressRevision + Number(changed)
					});
				});
				options.signal.addEventListener("abort", this.abort, { once: true });
			}
			/** @returns immutable state for the common toolbar. */
			getSnapshot = () => this.store.getSnapshot();
			/** @param listener - state invalidation. @returns unsubscribe callback. */
			subscribe = (listener) => this.store.subscribe(listener);
			/**
			* Attach the page without transferring ownership of its tab occurrence.
			* @param viewportId - mounted content container.
			* @returns physical attachment cleanup only.
			*/
			mount(viewportId) {
				this.publishSaved();
				return this.page.presentation.mount(viewportId);
			}
			/**
			* Consume initial navigation once; a saved checkpoint alone never starts a page.
			* @param initialUrl - explicit typed-open address, or absence.
			*/
			start(initialUrl) {
				if (this.started || this.disposed) return;
				this.started = true;
				if (initialUrl !== void 0) this.loadUrl(initialUrl);
			}
			/** Load the saved address only after an explicit restore action. */
			restore() {
				const target = this.store.getSnapshot().restoreTarget;
				if (target !== void 0) this.loadUrl(target.url);
			}
			/**
			* Validate an address before navigation, publishing invalid input for correction.
			* @param value - address-bar or typed-open input.
			*/
			loadUrl(value) {
				if (this.disposed) return;
				const parsed = parseBrowserAddress(value, this.options.applicationOrigin);
				if (!parsed.ok) {
					this.addressFailed(parsed.reason);
					return;
				}
				this.command(() => {
					this.page.frame.loadUrl(parsed.target);
				});
			}
			/** Delegate Back to the page's navigation provider. */
			goBack() {
				this.command(() => {
					this.page.frame.goBack();
				});
			}
			/** Delegate Forward to the page's navigation provider. */
			goForward() {
				this.command(() => {
					this.page.frame.goForward();
				});
			}
			/** Restore a saved address, or reload the already requested page. */
			reload() {
				if (this.store.getSnapshot().restoreTarget !== void 0) this.restore();
				else this.command(() => {
					this.page.frame.reload();
				});
			}
			/**
			* Apply the optional embedding-sandbox control; unsupported providers remain unchanged.
			* @param enabled - whether to enforce the provider's embedding sandbox.
			*/
			setSandbox(enabled) {
				const sandbox = this.page.frame.sandbox;
				if (sandbox !== void 0) this.command(() => {
					sandbox.setEnabled(enabled);
				});
			}
			/**
			* Redirect future checkpoint writes to a replacement Session binding.
			* @param actions - replacement persistence writer.
			*/
			rebind(actions) {
				this.actions = actions;
			}
			/**
			* Release the page and detach occurrence and state listeners.
			* @returns after page teardown; repeated callers join the same disposal.
			*/
			dispose() {
				if (this.disposal !== void 0) return this.disposal;
				this.disposed = true;
				this.options.signal.removeEventListener("abort", this.abort);
				this.unsubscribe();
				this.disposal = this.page.frame.dispose();
				return this.disposal;
			}
			publishSaved() {
				if (this.checkpoint !== void 0) this.actions.replace(this.options.tabId, this.checkpoint);
			}
			addressFailed(reason) {
				this.store.set({
					...this.store.getSnapshot(),
					addressFailure: reason
				});
			}
			command(run) {
				if (this.disposed) return;
				const current = this.store.getSnapshot();
				this.store.set({
					...current,
					addressFailure: void 0,
					addressRevision: current.addressRevision + 1
				});
				run();
			}
		};
		/**
		* Own tab-occurrence controllers behind Session-scoped callbacks.
		* @param actions - persisted view-state writer.
		* @param createPage - composition-selected provider.
		* @param isTabOpen - authoritative layout membership, independent of mounted bodies and plugin lifetime.
		* @returns tab callbacks.
		*/
		function createBrowserControllers(actions, createPage, isTabOpen) {
			let currentActions = actions;
			const controllers = /* @__PURE__ */ new Map();
			const controller = (id) => controllers.get(id)?.controller;
			return {
				keyedHooks: { browserState: (key) => controller(key) },
				mount(request) {
					const { tabId, signal } = request;
					if (signal.aborted) return () => {};
					let held = controllers.get(tabId);
					if (held?.signal !== signal) {
						if (held !== void 0) {
							held.signal.removeEventListener("abort", held.forget);
							held.controller.dispose();
						}
						const created = new BrowserController({
							...request,
							actions: currentActions,
							createPage
						});
						const forget = () => {
							controllers.delete(tabId);
							if (!isTabOpen(tabId)) currentActions.forget(tabId);
						};
						held = {
							signal,
							controller: created,
							forget
						};
						controllers.set(tabId, held);
						signal.addEventListener("abort", forget, { once: true });
					}
					const hide = held.controller.mount(request.viewportId);
					held.controller.start(request.initialUrl);
					return hide;
				},
				dispose: async () => {
					const pending = [...controllers.values()].map(({ signal, controller, forget }) => {
						signal.removeEventListener("abort", forget);
						return controller.dispose();
					});
					controllers.clear();
					await Promise.all(pending);
				},
				rebind: (actions) => {
					currentActions = actions;
					for (const { controller } of controllers.values()) controller.rebind(actions);
				},
				loadUrl: (id, value) => {
					controller(id)?.loadUrl(value);
				},
				restore: (id) => {
					controller(id)?.restore();
				},
				goBack: (id) => {
					controller(id)?.goBack();
				},
				goForward: (id) => {
					controller(id)?.goForward();
				},
				reload: (id) => {
					controller(id)?.reload();
				},
				setSandbox: (id, enabled) => {
					controller(id)?.setSandbox(enabled);
				}
			};
		}
		/**
		* Owns the application-known URL history and the iframe observation state machine.
		* The first load for a request keeps its URL authoritative; another load marks it unknown.
		*/
		var BrowserNavigation = class BrowserNavigation {
			value;
			/**
			* @param initial - persisted state restored for this tab, or a fresh empty state.
			*/
			constructor(initial = BrowserNavigation.empty()) {
				this.value = initial;
			}
			/**
			* Create state before a tab has a controlled navigation target.
			* @returns empty serializable state.
			*/
			static empty() {
				return {
					entries: [],
					index: -1,
					request: void 0,
					navigation: { status: "empty" },
					failure: void 0
				};
			}
			/**
			* Read the selected application-history entry.
			* @param state - serializable tab state.
			* @returns the current target, if any.
			*/
			static current(state) {
				return state === void 0 || state.index < 0 ? void 0 : state.entries[state.index];
			}
			/**
			* Test whether the Web carrier can use the preceding application-history entry.
			* @param state - serializable tab state.
			* @returns whether Back is available.
			*/
			static canGoBack(state) {
				return state.navigation.status !== "unknown" && state.index > 0;
			}
			/**
			* Test whether the Web carrier can use the following application-history entry.
			* @param state - serializable tab state.
			* @returns whether Forward is available.
			*/
			static canGoForward(state) {
				return state.navigation.status !== "unknown" && state.index >= 0 && state.index < state.entries.length - 1;
			}
			/** Current immutable serializable state. */
			get snapshot() {
				return this.value;
			}
			/** Whether the Web iframe can safely use the application-owned Back entry. */
			get canGoBack() {
				return BrowserNavigation.canGoBack(this.value);
			}
			/** Whether the Web iframe can safely use the application-owned Forward entry. */
			get canGoForward() {
				return BrowserNavigation.canGoForward(this.value);
			}
			/**
			* Add a controlled target and discard its stale forward branch.
			* @param target - validated canonical target.
			* @returns the new load request.
			*/
			navigate(target) {
				const entries = [...this.value.entries.slice(0, this.value.index + 1), target];
				if (entries.length > 100) entries.splice(0, entries.length - 100);
				return this.request(target, {
					...this.value,
					entries,
					index: entries.length - 1
				});
			}
			/**
			* Select the preceding application-known target.
			* @returns a new load request, or undefined when unavailable.
			*/
			back() {
				if (!this.canGoBack) return void 0;
				const index = this.value.index - 1;
				const target = this.value.entries[index];
				return this.request(target, {
					...this.value,
					index
				});
			}
			/**
			* Select the following application-known target.
			* @returns a new load request, or undefined when unavailable.
			*/
			forward() {
				if (!this.canGoForward) return void 0;
				const index = this.value.index + 1;
				const target = this.value.entries[index];
				return this.request(target, {
					...this.value,
					index
				});
			}
			/**
			* Start another load of the last application-known target.
			* @returns a new load request, or undefined before the first target.
			*/
			reload() {
				const target = BrowserNavigation.current(this.value);
				return target === void 0 ? void 0 : this.request(target, this.value);
			}
			/**
			* Record a frame load for its captured revision.
			* @param revision - revision bound to the rendered frame.
			*/
			frameLoaded(revision) {
				const navigation = this.value.navigation;
				if (navigation.status === "empty" || navigation.revision !== revision) return;
				if (navigation.status === "loading") this.value = {
					...this.value,
					navigation: {
						status: "known",
						revision
					}
				};
				else if (navigation.status === "known") this.value = {
					...this.value,
					navigation: {
						status: "unknown",
						revision
					}
				};
			}
			request(target, basis) {
				const request = {
					revision: (this.value.request?.revision ?? 0) + 1,
					target
				};
				this.value = {
					...basis,
					request,
					navigation: {
						status: "loading",
						revision: request.revision
					},
					failure: void 0
				};
				return request;
			}
		};
		//#endregion
export {};
