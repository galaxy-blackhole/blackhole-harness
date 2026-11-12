/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					const failure = event;
					if (failure.isMainFrame && failure.errorCode !== -3) this.failed({
						code: failure.errorCode,
						description: failure.errorDescription
					});
				}, { signal });
				for (const name of ["render-process-gone", "destroyed"]) element.addEventListener(name, () => {
					this.dropGuest();
					this.failed();
				}, { signal });
				this.presentation.present(element);
			}
			loadPending() {
				const target = this.pending;
				const element = this.element;
				if (!this.ready || target === void 0 || element === void 0) return;
				const revision = this.revision;
				this.pending = void 0;
				element.loadURL(target.url).catch((error) => {
					if (this.element !== element || this.lifetime.signal.aborted || this.revision !== revision) return;
					if (typeof error === "object" && error !== null && "code" in error && error.code === "ERR_ABORTED") return;
					if (this.store.getSnapshot().error === void 0) this.commandFailed(error);
				});
			}
			observe(committed) {
				if (!this.ready || this.element === void 0 || this.lifetime.signal.aborted) return;
				try {
					this.observeReady(this.element, committed);
				} catch (error) {
					this.commandFailed(error);
				}
			}
			observeReady(element, committed) {
				const current = this.store.getSnapshot();
				const parsed = committed ? parseBrowserAddress(element.getURL()) : void 0;
				if (parsed?.ok && this.firstDocument) {
					element.clearHistory();
					this.firstDocument = false;
				}
				let target = current.target;
				let address = current.address;
				if (parsed?.ok) {
					target = {
						...parsed.target,
						title: element.getTitle() || parsed.target.title
					};
					address = "observed";
					this.presentation.show(target.title);
				}
				const loading = current.error === void 0 && element.isLoading();
				const canGoBack = element.canGoBack();
				const canGoForward = element.canGoForward();
				if (target?.url !== current.target?.url || target?.title !== current.target?.title || address !== current.address || loading !== current.loading || canGoBack !== current.canGoBack || canGoForward !== current.canGoForward) this.store.set({
					...current,
					target,
					address,
					loading,
					canGoBack,
					canGoForward
				});
				if (parsed?.ok && target !== void 0) this.persist(target);
			}
			persist(target) {
				if (target.url === this.checkpoint?.url && target.title === this.checkpoint.title) return;
				this.checkpoint = target;
				this.options.persist(browserAddressCheckpoint(target, this.revision));
			}
			failed(error = {
				code: void 0,
				description: void 0
			}) {
				if (this.lifetime.signal.aborted) return;
				const current = this.store.getSnapshot();
				this.store.set({
					...current,
					loading: false,
					error,
					canGoBack: this.ready && current.canGoBack,
					canGoForward: this.ready && current.canGoForward
				});
			}
			commandFailed(error) {
				console.error("Desktop browser operation failed", error);
				this.failed();
			}
			dropGuest() {
				this.guestLifetime?.abort();
				this.guestLifetime = void 0;
				this.presentation.clear();
				this.element = void 0;
				this.ready = false;
				this.firstDocument = true;
				const lease = this.lease;
				this.lease = void 0;
				return lease === void 0 ? Promise.resolve() : this.release(lease);
			}
			release(lease) {
				const released = this.bridge.release(lease).catch((error) => {
					console.error("Desktop browser guest release failed", error);
				}).finally(() => {
					this.releases.delete(released);
				});
				this.releases.add(released);
				return released;
			}
		};
		//#endregion
		//#region lib/types/client/electron/ElectronWebviewPresentation.js
		/** Owns tag creation and attachment, without measuring or following another element. */
		var ElectronWebviewPresentation = class {
			events;
			element;
			host;
			constructor(events) {
				this.events = events;
			}
			/** @param viewportId - committed content container. @returns ends attachment and releases its guest. */
			mount(viewportId) {
				const host = document.getElementById(viewportId);
				if (host === null) throw new Error("Electron presentation: content container is not mounted");
				if (this.host !== void 0) this.events.unmounted();
				this.host = host;
				this.events.mounted();
				return () => {
					if (this.host !== host) return;
					this.events.unmounted();
					this.host = void 0;
				};
			}
			/**
			* Configure a detached webview for an approved guest reservation.
			* @param reservation - main-approved partition and bootstrap lease.
			* @returns a detached, configured webview.
			*/
			createElement(reservation) {
				const element = document.createElement("webview");
				element.className = Browser_module_css_default.webview;
				element.dataset.sidebarBrowserFrame = "webview";
				element.setAttribute("name", reservation.lease);
				element.setAttribute("partition", reservation.partition);
				element.setAttribute("allowpopups", "");
				element.setAttribute("src", "about:blank#" + reservation.lease);
				return element;
			}
			/**
			* Attach a prepared guest, removing any previous guest DOM from the container.
			* @param element - configured guest with its navigation listeners already installed.
			* @throws when no content container is mounted.
			*/
			present(element) {
				if (this.host === void 0) throw new Error("Electron presentation: cannot attach without a content container");
				this.clear();
				this.element = element;
				this.host.append(element);
			}
			/**
			* Set the guest element's accessible label.
			* @param title - observed document title.
			*/
			show(title) {
				this.element?.setAttribute("aria-label", title);
			}
			/** Destroy only the guest DOM; a replacement may use the same mounted container. */
			clear() {
				this.element?.remove();
				this.element = void 0;
			}
			/** Destroy the guest DOM and release its content container. */
			dispose() {
				this.clear();
				this.host = void 0;
			}
		};
		//#endregion
		//#region lib/types/client/electron/pages.js
		/**
		* Assemble an idle Electron provider; guest creation waits for mounting and navigation.
		* @param options - checkpoint and source-tab callbacks.
		* @param bridge - desktop-only transport.
		* @param workspace - storage account resolver.
		* @returns separate navigation and presentation faces.
		*/
		function createElectronPage(options, bridge, workspace) {
			const presentation = new ElectronWebviewPresentation({
				mounted: () => {
					frame.attach();
				},
				unmounted: () => {
					frame.detach();
				}
			});
			const frame = new ElectronWebViewImpl(options, bridge, workspace, presentation);
			return {
				frame,
				presentation
			};
		}
		//#endregion
		//#region lib/types/client/electron/workspace.js
		/**
		* Use the Workspace's canonical CWD, not its record id; ungrouped Sessions remain isolated.
		* @param source - authoritative Workspace membership.
		* @param sessionId - owning DSH Session.
		* @param signal - guest initialization lifetime.
		* @returns the storage account for this occurrence.
		*/
		async function browserWorkspace(source, sessionId, signal) {
			signal.throwIfAborted();
			if (source.getSnapshot().phase !== "ready") await new Promise((resolve, reject) => {
				const abort = () => {
					stop();
					const reason = signal.reason;
					reject(reason);
				};
				const stop = source.subscribe(() => {
					if (source.getSnapshot().phase !== "ready") return;
					stop();
					signal.removeEventListener("abort", abort);
					resolve();
				});
				signal.addEventListener("abort", abort, { once: true });
			});
			signal.throwIfAborted();
			const workspace = source.getSnapshot().items.find((item) => item.sessionIds.some((id) => id === sessionId));
			return workspace === void 0 ? `session:${sessionId}` : `cwd:${workspace.path}`;
		}
		//#endregion
		//#region lib/types/client/definition.js
		/** Browser tab kind. */
		const BROWSER_KIND = "browser";
		/** Browser implementation identity and keyed Slot dispatch key. */
		const BROWSER_ID = "@deepseek-ai/dsh-client-ui-sidebar-browser";
		/** Build the Browser type with locale-live copy. */
		function browserDefinition(t) {
			return {
				id: BROWSER_ID,
				kind: BROWSER_KIND,
				multiple: true,
				priority: "builtin",
				title: () => t("type.label"),
				guide: [{
					id: "new",
					commandId: "browser.new",
					order: 30,
					title: () => t("guide.title"),
					description: () => t("guide.description"),
					icon: _deepseek_ai_dsh_client_ui_primitives.GuideArtworkBrowser
				}]
			};
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Locale-owned Browser tab copy. */
		const zh = {
			"type.label": "浏览器",
			"guide.title": "浏览器",
			"guide.description": "浏览网页",
			"shortcut.noSession": "请先打开一个会话",
			"address.placeholder": "输入 HTTP(S) 地址",
			"address.changed": "URL 已变化",
			back: "后退",
			forward: "前进",
			reload: "刷新",
			go: "前往",
			external: "在系统浏览器中打开",
			"sandbox.disable": "关闭沙箱限制",
			"sandbox.enable": "恢复沙箱限制",
			"sandbox.warning": "沙箱限制已关闭；页面可以导航顶层应用，并使用下载、模态对话框与输入锁定。",
			start: "输入 HTTP(S) 地址开始浏览",
			loading: "正在打开…",
			"restore.previous": "上次打开",
			"restore.action": "恢复页面",
			"error.empty": "请输入地址。",
			"error.invalid": "这个地址无效或过长。",
			"error.protocol": "只支持 HTTP 和 HTTPS 地址；本地文件请使用文档预览。",
			"error.credentials": "地址不能包含用户名或密码。",
			"error.application-origin": "不能在嵌入浏览器中打开 DSH 应用自身。",
			"load.failed": "页面加载失败；请刷新重试或在系统浏览器中打开。",
			"load.failed.detail": "页面加载失败 ({code}): {description}",
			"address.unknown": "页面已跳转；当前载体无法读取新的 URL。"
		};
		/** English dictionary with the same keys. */
		const en = {
			"type.label": "Browser",
			"guide.title": "Browser",
			"guide.description": "Browse web pages",
			"shortcut.noSession": "Open a session first",
			"address.placeholder": "Enter an HTTP(S) address",
			"address.changed": "URL changed",
			back: "Back",
			forward: "Forward",
			reload: "Reload",
			go: "Go",
			external: "Open in system browser",
			"sandbox.disable": "Disable sandbox restrictions",
			"sandbox.enable": "Restore sandbox restrictions",
			"sandbox.warning": "Sandbox restrictions are disabled; the page can navigate the top-level app and use downloads, modal dialogs, and input locks.",
			start: "Enter an HTTP(S) address to start browsing",
			loading: "Opening…",
			"restore.previous": "Previously opened",
			"restore.action": "Restore page",
			"error.empty": "Enter an address.",
			"error.invalid": "That address is invalid or too long.",
			"error.protocol": "Only HTTP and HTTPS addresses are supported; use Document Preview for local files.",
			"error.credentials": "Addresses cannot contain a username or password.",
			"error.application-origin": "The embedded browser cannot open the DSH application itself.",
			"load.failed": "The page could not load; reload or open it in the system browser.",
			"load.failed.detail": "Page load failed ({code}): {description}",
			"address.unknown": "The page navigated; this carrier cannot read its new URL."
		};
		//#endregion
		//#region lib/types/client/browser/store.js
		/** Persisted Browser tab snapshots shared by the body and title slots. */
		/**
		* Declare the Session-scoped Browser persistence store.
		* @returns a fresh store handle for Slot registration.
		*/
		function createBrowserStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({ byTab: {} }),
				persist: "dsh.sidebar-browser.v1",
				actions: {
					replace: (draft, tabId, state) => {
						draft.byTab[tabId] = state;
					},
					forget: (draft, tabId) => {
						const byTab = {};
						for (const [id, state] of Object.entries(draft.byTab)) if (id !== tabId) byTab[id] = state;
						draft.byTab = byTab;
					}
				}
			});
		}
		//#endregion
		//#region lib/types/client/index.js
		/** Required Browser services. */
		const inject = [
			"slots",
			"locale",
			"sidebarRight",
			"sidebarRightTabs"
		];
		/** Register the Browser type, localized guide entry, body, and title. */
		function apply(ctx) {
			const namespace = "sidebarBrowser";
			const t = ctx.locale.bind(namespace);
			ctx.inject(["shortcuts"], (ctx) => {
				ctx.effect(() => ctx.shortcuts.register({
					id: "browser.new",
					label: () => t("guide.title"),
					aliases: ["browser", "new browser tab"],
					defaults: {
						"desktop:macos": {
							code: "KeyT",
							modifiers: ["primary"]
						},
						"desktop:windows": {
							code: "KeyT",
							modifiers: ["primary"]
						},
						"desktop:linux": {
							code: "KeyT",
							modifiers: ["primary"]
						},
						"web:macos": {
							code: "KeyT",
							modifiers: ["primary", "alt"]
						},
						"web:windows": {
							code: "KeyT",
							modifiers: ["primary", "alt"]
						}
					},
					regions: [
						"page",
						"editable",
						"terminal"
					],
					modals: [],
					resolve: ({ target: element }) => {
						const target = ctx.sidebarRight.commandTarget(element);
						if (target === void 0) return {
							status: "blocked",
							reason: t("shortcut.noSession")
						};
						return {
							status: "handled",
							run: () => {
								ctx.sidebarRight.openTabFromTarget("browser", target);
							}
						};
					}
				}), "ui-sidebar-browser: shortcut");
			});
			const store = createBrowserStore();
			const openTabs = ctx.sidebarRight.openTabs;
			const carrier = globalThis.dshDesktop;
			const desktop = carrier?.protocolVersion === 1 ? carrier.browser : void 0;
			ctx.effect(() => ctx.locale.register(namespace, {
				zh,
export {};
