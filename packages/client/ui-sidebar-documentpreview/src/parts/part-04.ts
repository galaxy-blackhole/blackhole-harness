/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				};
				const loadAll = (tabId, file, signal, observedVersion) => {
					if (signal.aborted) return;
					const reads = modeOf(tabId, signal, "bytes-complete");
					reads.controller?.abort();
					const controller = new AbortController();
					reads.controller = controller;
					const lifetime = AbortSignal.any([signal, controller.signal]);
					actions.loading(tabId, "bytes-complete", observedVersion);
					readAll(file, lifetime).then((result) => {
						if (lifetime.aborted) return;
						if (!result.ok) {
							actions.failed(tabId, result.error);
							return;
						}
						const file = result.value;
						reads.version = file.version;
						actions.complete(tabId, file);
					}, (error) => {
						if (lifetime.aborted) return;
						actions.failed(tabId, Object.assign(new Error(error instanceof Error ? error.message : String(error), { cause: error }), {
							name: "RemoteError",
							isDSHRemoteError: true,
							code: "gateway/internal",
							details: {}
						}));
					});
				};
				const restart = (tabId, file, signal, observedVersion, mode = "text-pages") => {
					if (signal.aborted) return;
					const reads = readsOf(tabId, signal);
					reads.controller?.abort();
					reads.generation += 1;
					reads.version = void 0;
					actions.reset(tabId);
					if (mode === "text-pages") loadPage(tabId, file, 1, signal, observedVersion);
					else loadAll(tabId, file, signal, observedVersion);
				};
				return {
					addResource: (tabId, address, signal) => {
						if (!signal.aborted) readsOf(tabId, signal).group.add(address);
					},
					setResources: (tabId, addresses, signal) => {
						if (!signal.aborted) readsOf(tabId, signal).group.set(addresses);
					},
					loadPage,
					reloadPages: restart,
					loadAll,
					prepareRenderer: (tabId, signal, rendererId, observedVersion, reload = false) => {
						if (signal.aborted) return;
						modeOf(tabId, signal, "renderer", rendererId);
						if (reload) actions.reset(tabId);
						actions.loading(tabId, "renderer", observedVersion, rendererId);
					},
					reloadAll: (tabId, file, signal, observedVersion) => {
						restart(tabId, file, signal, observedVersion, "bytes-complete");
					}
				};
			};
		}
		//#endregion
		//#region lib/types/client/store.js
		/**
		* A tab's state before it reads, scrolls, toggles, or answers anything.
		* @returns the empty bucket.
		*/
		function fresh() {
			return {
				autoRefresh: true,
				resourcesDirty: false,
				loadRevision: 0,
				version: void 0,
				observedVersion: void 0,
				pages: {},
				eof: false,
				loading: false,
				failure: void 0,
				scrollTop: 0,
				wrap: true,
				revision: void 0
			};
		}
		/** The bucket for one tab, created on first write. */
		function bucket(state, tabId) {
			return state.byTab[tabId] ??= fresh();
		}
		/**
		* Declare the preview's store.
		*
		* Constructed once in apply and shared by the body and the tools registrations,
		* which the slot runtime allows because both are session-scoped.
		* @returns the store handle to declare on both registrations.
		*/
		function createTextStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({ byTab: {} }),
				actions: {
					toggledAutoRefresh: (d, tabId) => {
						const state = bucket(d, tabId);
						state.autoRefresh = !state.autoRefresh;
					},
					resourceChanged: (d, tabId) => {
						bucket(d, tabId).resourcesDirty = true;
					},
					/** @param d - draft. @param tabId - owning tab. @param rendererId - manual choice, or automatic selection. */
					selected: (d, tabId, rendererId) => {
						if (rendererId === void 0) delete bucket(d, tabId).rendererId;
						else bucket(d, tabId).rendererId = rendererId;
					},
					/**
					* Mark a page read as in flight.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					* @param mode - selected renderer's loading mode.
					* @param observedVersion - metadata version at read start; later pages retain the initial observation.
					* @param contentRendererId - implementation owning source loading.
					*/
					loading: (d, tabId, mode, observedVersion, contentRendererId) => {
						const state = bucket(d, tabId);
						if (state.version === void 0 && !state.loading) state.observedVersion = observedVersion;
						if (contentRendererId === void 0) delete state.contentRendererId;
						else state.contentRendererId = contentRendererId;
						state.loading = true;
						state.failure = void 0;
						if (mode !== void 0) state.mode = mode;
					},
					/**
					* @param d - draft. @param tabId - owning tab.
					* @param revision - active content revision. @param version - displayed source version.
					*/
					rendered: (d, tabId, revision, version) => {
						const state = d.byTab[tabId];
						if (state?.mode !== "renderer" || state.loadRevision !== revision) return;
						state.version = version;
						state.loading = false;
					},
					/** @param d - draft. @param tabId - owning tab. @param revision - failed content revision. */
					rendererFailed: (d, tabId, revision) => {
						const state = d.byTab[tabId];
						if (state?.mode !== "renderer" || state.loadRevision !== revision) return;
						state.loading = false;
					},
					/** @param d - draft. @param tabId - owning tab. @param file - complete byte result for this view. */
					complete: (d, tabId, file) => {
						const state = bucket(d, tabId);
						state.complete = file;
						state.version = file.version;
						state.eof = true;
						state.loading = false;
						state.failure = void 0;
					},
					/**
					* Keep one page. A page from a newer file version invalidates the pages
					* of the older one, so the body never shows two versions at once.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					* @param page - the page the Host returned.
					*/
					page: (d, tabId, page) => {
						const state = bucket(d, tabId);
						if (state.version !== void 0 && state.version !== page.version) state.pages = {};
						state.version = page.version;
						state.pages[page.offset] = {
							text: page.text,
							lines: page.lines
						};
						state.eof = page.eof;
						state.loading = false;
						state.failure = void 0;
					},
					/**
					* Record why a page read failed; the pages already held stay.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					* @param failure - the settled Remote failure.
					*/
					failed: (d, tabId, failure) => {
						const state = bucket(d, tabId);
						state.loading = false;
						state.failure = failure;
					},
					/**
					* Drop every page, keeping the view, for a re-read from the first line.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					*/
					reset: (d, tabId) => {
						const state = bucket(d, tabId);
						state.resourcesDirty = false;
						state.loadRevision++;
						state.pages = {};
						delete state.complete;
						state.eof = false;
						state.version = void 0;
						state.observedVersion = void 0;
						state.loading = false;
						state.failure = void 0;
					},
					/**
					* Record where one tab's body is scrolled to.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					* @param scrollTop - the body's scroll offset, in px.
					*/
					scrolled: (d, tabId, scrollTop) => {
						bucket(d, tabId).scrollTop = scrollTop;
					},
					/**
					* Switch one tab between wrapped and unwrapped lines.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					*/
					toggledWrap: (d, tabId) => {
						const state = bucket(d, tabId);
						state.wrap = !state.wrap;
					},
					/**
					* Record that the body answered one navigation, so a remount restores the
					* reader's position instead of jumping again.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					* @param revision - the `navigation.revision` answered.
					*/
					navigated: (d, tabId, revision) => {
						bucket(d, tabId).revision = revision;
					},
					/**
					* Drop one tab's state, for a tab record that is gone.
					* @param d - draft state.
					* @param tabId - the tab that went away.
					*/
					forget: (d, tabId) => {
						const byTab = {};
						for (const [id, state] of Object.entries(d.byTab)) if (id !== tabId) byTab[id] = state;
						d.byTab = byTab;
					}
				}
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/**
		* `sidebarDocumentPreview` namespace dictionaries.
		*
		* The failure lines are the point of this file: a preview that cannot show a
		* page has to say which of several different things went wrong, and each one
		* suggests a different next step for the reader.
		*/
		/** Simplified Chinese dictionary and key-set source of truth. */
		const zh$7 = {
			loading: "文档渲染中...",
			loadMore: "加载更多",
			changed: "文件已更新，当前显示为旧内容",
			reloadNow: "重新载入",
			reload: "重新读取文件",
			autoRefresh: "自动刷新",
			"autoRefresh.enable": "开启自动刷新",
			"autoRefresh.disable": "关闭自动刷新",
			"wrap.enable": "自动换行",
			"wrap.disable": "取消换行",
			"wrap.aria": "自动换行",
			openWith: "打开方式",
			"viewer.text": "纯文本",
			resourceUnavailable: "文件资源服务不可用",
			rendererUnavailable: "预览器 {name} 不可用",
			unsupportedFile: "该格式文件暂时无法预览",
			"error.notFound": "文件不存在，可能已被移动或删除",
			"error.tooLarge": "单页内容超过 {limit} 上限，无法读取",
			"error.notText": "该格式文件暂时无法预览",
			"error.notRegularFile": "该路径不是普通文件，没有可显示的内容",
			"error.unavailable": "读取失败：{message}",
			retry: "重试"
		};
		/** English dictionary, checked against the Chinese key set. */
		const en$7 = {
			loading: "Rendering document...",
			loadMore: "Load more",
			changed: "The file has changed, showing the previous content.",
			reloadNow: "Reload",
			reload: "Read the file again",
			autoRefresh: "Auto refresh",
			"autoRefresh.enable": "Enable auto refresh",
			"autoRefresh.disable": "Disable auto refresh",
			"wrap.enable": "Turn on line wrap",
			"wrap.disable": "Turn off line wrap",
			"wrap.aria": "Line wrap",
			openWith: "Open with",
			"viewer.text": "Plain text",
			resourceUnavailable: "The file resource service is unavailable.",
			rendererUnavailable: "The {name} preview is unavailable.",
			unsupportedFile: "Preview is not available for this file type yet.",
			"error.notFound": "File not found. It may have been moved or deleted.",
			"error.tooLarge": "This page exceeds the {limit} limit and cannot be read.",
			"error.notText": "Preview is not available for this file type yet.",
			"error.notRegularFile": "Not a regular file, nothing to display.",
			"error.unavailable": "Read failed: {message}",
			retry: "Retry"
		};
		//#endregion
		//#region lib/types/client/document/contract.js
		/**
		* Forward the framework's tab reader to the selected document body.
		* @param _standard - framework standard props.
		* @param useTabInfo - enclosing tab's bound reader.
		* @returns the same reader, without another subscription adapter.
		*/
		const documentTabInfoFactory = (_standard, useTabInfo) => useTabInfo;
		//#endregion
		//#region lib/types/client/markdown/frontmatter.js
		/** Leading YAML frontmatter split from a Markdown document before Markdown parsing. */
		const FRONTMATTER = /^\uFEFF?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)??(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/u;
		/**
		* Split a leading YAML frontmatter block from Markdown text without parsing its YAML.
		* @param text - Markdown source; an unterminated block is not frontmatter.
		* @returns frontmatter source and the remaining body, or `undefined` when the text has none.
		*/
		function splitFrontmatter(text) {
			const match = FRONTMATTER.exec(text);
			if (match === null) return void 0;
			return {
				source: match[1] ?? "",
				body: text.slice(match[0].length)
			};
		}
		//#endregion
		//#region lib/types/client/markdown/path-images.js
		/** Local Markdown image destinations served by the authenticated file route. */
		/**
		* Build a file URL, resolving relative destinations beside the previewed file.
		* @param base - document base URI, including any deployment prefix.
		* @param documentPath - absolute source path reported by the Host, when available.
		* @param destination - authored Markdown image URL; query and fragment are not filename components.
		* @returns a Web or Desktop file URL, or undefined for unsupported or malformed destinations.
		*/
		function markdownImageUrl(base, documentPath, destination) {
			const suffix = destination.search(/[?#]/u);
			let path;
			try {
				path = decodeURIComponent(suffix === -1 ? destination : destination.slice(0, suffix));
			} catch (_error) {
				return;
			}
			if (path.length === 0) return void 0;
			if (!/^[a-z]:[/\\]/iu.test(path) && /^[a-z][a-z\d+.-]*:/iu.test(path)) return void 0;
			if (!isAbsoluteWorkspacePath(path)) {
				if (documentPath === void 0) return void 0;
				path = pathPartsOf(documentPath).directory + path;
			}
			return fileMediaUrl(base, path);
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/markdown/MarkdownBody.module.css.mjs
		const css$7 = "._0RKuNG_document{min-width:0;font-family:var(--dsw-font,inherit);white-space:normal;padding:10px 12px}._0RKuNG_frontmatter{border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);font:var(--dsw-font-markdown-small);color:var(--dsw-alias-label-primary);white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 16px;padding:10px 12px}._0RKuNG_frontmatter:empty{display:none}._0RKuNG_frontmatterSource{font-family:var(--ds-font-family-code);white-space:inherit;margin:0}";
		const tagId$7 = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/MarkdownBody.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$7) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview";
			tag.dataset.pluginCss = tagId$7;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		var MarkdownBody_module_css_default = {
			"document": "_0RKuNG_document",
			"frontmatter": "_0RKuNG_frontmatter",
			"frontmatterSource": "_0RKuNG_frontmatterSource"
		};
		//#endregion
		//#region lib/types/client/markdown/MarkdownBody.js
		/** One retained Markdown renderer over the document owner's accumulated text. */
		/** Show the verbatim frontmatter when the field-list chunk cannot load. */
		function FrontmatterFallback({ fallback }) {
			return fallback;
		}
		const FrontmatterFields = (0, react.lazy)(() => require.async("./client.frontmatter-fields.js").then((module) => ({ default: module.FrontmatterFields }), () => ({ default: FrontmatterFallback })));
		/**
		* Render one accumulated document; EOF completes the primitive's full parse.
		* A leading YAML frontmatter block renders as a field list instead of Markdown; its
		* verbatim source stands in while the field-list chunk loads or when it fails.
		* @param props - owner-loaded contents and localized primitive labels.
		* @returns Markdown content, or nothing for a non-text delivery.
		*/
		function MarkdownBody({ content, resourceAddress, useResource, t }) {
			const absolutePath = useResource(resourceAddress).value?.absolutePath;
			const pathImages = (0, react.useMemo)(() => ({ resolve: (value) => markdownImageUrl(document.baseURI, absolutePath, value) }), [absolutePath]);
			const copyLabel = t("code.copy");
			const copiedLabel = t("code.copied");
			const footnotes = t("footnotes");
			const codeLabel = t("codeBlock.title");
			const wrapLabel = t("codeBlock.wrap");
			const unwrapLabel = t("codeBlock.unwrap");
			const labels = (0, react.useMemo)(() => ({
				code: {
					copyLabel,
					copiedLabel,
					toolbarLabels: {
						codeLabel,
						wrapLabel,
						unwrapLabel
					}
				},
export {};
