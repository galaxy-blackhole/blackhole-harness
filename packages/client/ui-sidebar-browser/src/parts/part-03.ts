/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#region lib/types/client/browser/IframeImpl.js
		/** Iframe navigation provider with bounded application-known history. */
		/** Owns iframe navigation; the view reports loads without reading cross-origin content. */
		var IframeImpl = class {
			options;
			presentation;
			sandbox = { setEnabled: (enabled) => {
				this.setSandbox(enabled);
			} };
			navigation;
			store;
			sandboxed = true;
			error;
			disposed = false;
			disposal;
			/** @param options - initial checkpoint and persistence writer. @param presentation - iframe DOM adapter. */
			constructor(options, presentation) {
				this.options = options;
				this.presentation = presentation;
				this.navigation = new BrowserNavigation(options.initial);
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
					...emptyBrowserFrame(),
					sandboxEnabled: this.sandboxed
				});
			}
			/**
			* Record a controlled load or a later navigation to an unreadable address.
			* @param revision - document generation whose iframe emitted load.
			*/
			handleLoaded(revision) {
				if (this.disposed) return;
				this.navigation.frameLoaded(revision);
				this.publish();
			}
			/**
			* Publish a failure only for the current document generation.
			* @param revision - document generation whose iframe reported failure.
			*/
			handleLoadFailed(revision) {
				if (this.disposed || this.navigation.snapshot.request?.revision !== revision) return;
				this.error = {
					code: void 0,
					description: void 0
				};
				this.publish();
			}
			/** @returns immutable navigation state. */
			getSnapshot = () => this.store.getSnapshot();
			/** @param listener - state invalidation. @returns unsubscribe callback. */
			subscribe = (listener) => this.store.subscribe(listener);
			/** @param target - validated address; submitting the current address reloads it. */
			loadUrl(target) {
				if (this.disposed) return;
				const request = BrowserNavigation.current(this.navigation.snapshot)?.url === target.url ? this.navigation.reload() : this.navigation.navigate(target);
				this.load(request);
			}
			/** Move through application-known history while the iframe address remains known. */
			goBack() {
				if (!this.disposed) this.load(this.navigation.back());
			}
			/** Move through application-known history while the iframe address remains known. */
			goForward() {
				if (!this.disposed) this.load(this.navigation.forward());
			}
			/** Reload the last application-known address. */
			reload() {
				if (!this.disposed) this.load(this.navigation.reload());
			}
			/** @returns after the presentation has been removed; repeated calls join disposal. */
			dispose() {
				if (this.disposal !== void 0) return this.disposal;
				this.disposed = true;
				this.presentation.dispose();
				this.disposal = Promise.resolve();
				return this.disposal;
			}
			setSandbox(enabled) {
				if (this.disposed || enabled === this.sandboxed) return;
				this.sandboxed = enabled;
				if (this.store.getSnapshot().target === void 0) {
					this.store.set({
						...this.store.getSnapshot(),
						sandboxEnabled: enabled
					});
					return;
				}
				this.load(this.navigation.reload());
			}
			load(request) {
				if (request === void 0) return;
				this.error = void 0;
				this.publish();
				this.presentation.show({
					target: request.target,
					revision: request.revision,
					sandboxed: this.sandboxed
				});
			}
			snapshot() {
				const state = this.navigation.snapshot;
				const target = BrowserNavigation.current(state);
				return {
					target,
					address: target === void 0 ? "empty" : state.navigation.status === "unknown" ? "unknown" : "requested",
					loading: state.navigation.status === "loading" && this.error === void 0,
					canGoBack: this.navigation.canGoBack,
					canGoForward: this.navigation.canGoForward,
					error: this.error,
					sandboxEnabled: this.sandboxed
				};
			}
			publish() {
				this.store.set(this.snapshot());
				this.options.persist(this.navigation.snapshot);
			}
		};
		//#endregion
		//#region lib/types/client/view/IframePresentation.js
		/** Fixed iframe policy; top navigation and downloads are not granted directly. */
		const WEB_BROWSER_SANDBOX = "allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox";
		/** Owns the iframe element; navigation and history remain in IframeImpl. */
		var IframePresentation = class {
			events;
			host;
			element;
			document;
			rendered = false;
			/** @param events - provider-owned load and remount callbacks. */
			constructor(events) {
				this.events = events;
			}
			/** @param viewportId - mounted placeholder. @returns removes only the iframe presentation. */
			mount(viewportId) {
				const host = document.getElementById(viewportId);
				if (host === null) throw new Error("iframe presentation: viewport is not mounted");
				this.element?.remove();
				this.element = void 0;
				this.host = host;
				if (this.rendered) this.events.remounted();
				else this.render();
				return () => {
					if (this.host !== host) return;
					this.element?.remove();
					this.element = void 0;
					this.host = void 0;
				};
			}
			/**
			* Retain the prepared document and render it when a container is mounted.
			* @param value - prepared document and event generation.
			*/
			show(value) {
				this.document = value;
				this.render();
			}
			/** Remove the owned DOM and retained presentation data. */
			dispose() {
				this.element?.remove();
				this.element = void 0;
				this.host = void 0;
				this.document = void 0;
			}
			render() {
				const current = this.document;
				const host = this.host;
				if (current === void 0 || host === void 0) return;
				this.element?.remove();
				const element = document.createElement("iframe");
				element.className = Browser_module_css_default.frame;
				element.src = current.target.url;
				element.title = current.target.title;
				element.referrerPolicy = "no-referrer";
				element.dataset.sidebarBrowserFrame = "iframe";
				if (current.sandboxed) element.setAttribute("sandbox", WEB_BROWSER_SANDBOX);
				element.addEventListener("load", () => {
					if (this.element === element) this.events.loaded(current.revision);
				});
				element.addEventListener("error", () => {
					if (this.element === element) this.events.failed(current.revision);
				});
				this.element = element;
				this.rendered = true;
				host.append(element);
			}
		};
		//#endregion
		//#region lib/types/client/pages.js
		/**
		* Assemble an idle iframe provider and its DOM presentation.
		* @param options - saved navigation and callbacks.
		* @returns the Web page's navigation and presentation objects.
		*/
		function createIframePage(options) {
			const presentation = new IframePresentation({
				loaded: (revision) => {
					frame.handleLoaded(revision);
				},
				failed: (revision) => {
					frame.handleLoadFailed(revision);
				},
				remounted: () => {
					frame.reload();
				}
			});
			const frame = new IframeImpl(options, presentation);
			return {
				frame,
				presentation
			};
		}
		//#endregion
		//#region lib/types/client/electron/ElectronWebViewImpl.js
		/** Electron navigation and guest lifetime, independent from DOM placement. */
		/** Owns native history and translates Electron observations into common frame state. */
		var ElectronWebViewImpl = class {
			options;
			bridge;
			workspace;
			presentation;
			store;
			lifetime = new AbortController();
			guestLifetime;
			element;
			lease;
			workspaceKey;
			initializing;
			ready = false;
			pending;
			revision = 0;
			firstDocument = true;
			checkpoint;
			disposal;
			attachment;
			releases = /* @__PURE__ */ new Set();
			/**
			* @param options - saved address, persistence and source-tab opening callback.
			* @param bridge - main-process guest operations.
			* @param workspace - resolves the storage account once for this frame lifetime.
			* @param presentation - tag and Sidebar placement adapter.
			*/
			constructor(options, bridge, workspace, presentation) {
				this.options = options;
				this.bridge = bridge;
				this.workspace = workspace;
				this.presentation = presentation;
				this.checkpoint = currentBrowserTarget(options.initial);
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(emptyBrowserFrame());
			}
			/** @returns immutable carrier-neutral navigation state. */
			getSnapshot = () => this.store.getSnapshot();
			/** @param listener - state invalidation. @returns unsubscribe callback. */
			subscribe = (listener) => this.store.subscribe(listener);
			/** A physical mount may recreate a lost guest; ordinary Sidebar hiding never calls this. */
			attach() {
				if (this.lifetime.signal.aborted) return;
				this.attachment = new AbortController();
				this.pending ??= this.store.getSnapshot().target;
				if (this.pending !== void 0) {
					this.store.set({
						...this.store.getSnapshot(),
						address: "requested",
						loading: true,
						canGoBack: false,
						canGoForward: false,
						error: void 0
					});
					this.initialize();
				}
			}
			/** Invalidate pending attachment before the containing DOM is removed. */
			detach() {
				this.attachment?.abort();
				this.attachment = void 0;
				this.pending = this.store.getSnapshot().target;
				this.dropGuest();
			}
			/** @param target - validated address, loaded without replacing the guest. */
			loadUrl(target) {
				if (this.lifetime.signal.aborted) return;
				const current = this.store.getSnapshot();
				if (this.ready && current.address === "observed" && current.target?.url === target.url) {
					this.reload();
					return;
				}
				this.revision++;
				this.pending = target;
				this.store.set({
					...current,
					target,
					address: "requested",
					loading: true,
					error: void 0
				});
				this.persist(target);
				if (this.ready) this.loadPending();
				else this.initialize();
			}
			/** Move backward through Chromium history. */
			goBack() {
				if (this.store.getSnapshot().canGoBack) this.navigate("goBack");
			}
			/** Move forward through Chromium history. */
			goForward() {
				if (this.store.getSnapshot().canGoForward) this.navigate("goForward");
			}
			/** Reload the actual current page, or retry failed guest creation. */
			reload() {
				const current = this.store.getSnapshot();
				if (this.lifetime.signal.aborted || current.target === void 0) return;
				if (!this.ready || current.error !== void 0) {
					this.revision++;
					this.pending = current.target;
					this.store.set({
						...current,
						loading: true,
						error: void 0
					});
					if (this.ready) this.loadPending();
					else this.initialize();
				} else this.navigate("reload");
			}
			/** @returns after pending initialization and the owned guest have been released. */
			dispose() {
				if (this.disposal !== void 0) return this.disposal;
				this.lifetime.abort();
				this.pending = void 0;
				this.disposal = Promise.all([this.dropGuest(), this.initializing]).then(() => Promise.all(this.releases)).then(() => {});
				this.presentation.dispose();
				return this.disposal;
			}
			navigate(command) {
				if (this.lifetime.signal.aborted || !this.ready || this.element === void 0) return;
				this.revision++;
				this.pending = void 0;
				this.store.set({
					...this.store.getSnapshot(),
					loading: true,
					error: void 0
				});
				try {
					this.element[command]();
				} catch (error) {
					this.commandFailed(error);
				}
			}
			initialize() {
				const attachment = this.attachment;
				if (attachment === void 0 || this.initializing !== void 0 || this.element !== void 0 || this.lifetime.signal.aborted) return;
				const signal = AbortSignal.any([this.lifetime.signal, attachment.signal]);
				this.initializing = this.createGuest(signal).catch(async (error) => {
					await this.dropGuest();
					if (!signal.aborted) this.commandFailed(error);
				}).finally(() => {
					this.initializing = void 0;
					if (this.attachment !== attachment && this.pending !== void 0) this.initialize();
				});
			}
			async createGuest(attachmentSignal) {
				this.workspaceKey ??= await this.workspace(attachmentSignal);
				if (attachmentSignal.aborted) return;
				const reservation = await this.bridge.acquire(this.workspaceKey);
				if (attachmentSignal.aborted) {
					await this.release(reservation.lease);
					return;
				}
				this.lease = reservation.lease;
				this.guestLifetime = new AbortController();
				const signal = AbortSignal.any([attachmentSignal, this.guestLifetime.signal]);
				const element = this.presentation.createElement(reservation);
				this.element = element;
				const unsubscribeOpen = this.bridge.onOpenRequested(reservation.lease, (url) => {
					if (this.element === element && !signal.aborted) this.options.openRequested(url);
				});
				signal.addEventListener("abort", unsubscribeOpen, { once: true });
				element.addEventListener("dom-ready", () => {
					this.ready = true;
					this.observe(this.store.getSnapshot().address !== "requested");
					this.loadPending();
				}, { signal });
				element.addEventListener("did-navigate", () => {
					this.observe(true);
				}, { signal });
				element.addEventListener("did-navigate-in-page", (event) => {
					if (event.isMainFrame) this.observe(true);
				}, { signal });
				element.addEventListener("did-start-navigation", (event) => {
					if (event.isMainFrame) this.store.set({
						...this.store.getSnapshot(),
						loading: true,
						error: void 0
					});
				}, { signal });
				for (const name of [
					"did-start-loading",
					"did-stop-loading",
					"page-title-updated"
				]) element.addEventListener(name, () => {
					this.observe(name === "page-title-updated" && this.store.getSnapshot().address === "observed");
				}, { signal });
				element.addEventListener("did-fail-load", (event) => {
export {};
