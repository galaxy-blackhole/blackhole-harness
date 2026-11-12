/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			"ppt",
			"pptx",
			"odt",
			"ods",
			"odp",
			"pages",
			"numbers",
			"exe",
			"dll",
			"so",
			"dylib",
			"bin",
			"o",
			"class",
			"pyc",
			"wasm",
			"ttf",
			"otf",
			"woff",
			"woff2",
			"eot",
			"dmg",
			"iso",
			"img",
			"sqlite",
			"db",
			"psd",
			"ai",
			"sketch",
			"tiff",
			"tif",
			"heic",
			"heif",
			"avif"
		];
		/**
		* Whether a filename's suffix is a known binary container that no renderer claims.
		* @param path - decoded filename or file path.
		* @returns true when the suffix belongs to the unviewable binary list.
		*/
		function unviewableBinaryPath(path) {
			return matchedSuffixLength(documentFileName(path), UNVIEWABLE_BINARY_EXTENSIONS) > 0;
		}
		//#endregion
		//#region lib/types/client/text/lines.js
		/**
		* Split a loaded page into its source lines.
		* @param page - source page.
		* @returns its lines, preserving one empty line but excluding a zero-line page.
		*/
		function linesOf(page) {
			return page.lines === 0 ? [] : page.text.split("\n");
		}
		/**
		* Order loaded pages by source position.
		* @param pages - stored page table.
		* @returns pages in source order.
		*/
		function loadedPages(pages) {
			return Object.entries(pages).map(([offset, page]) => ({
				offset: Number(offset),
				...page
			})).sort((left, right) => left.offset - right.offset);
		}
		/**
		* Find the end of the loaded source prefix.
		* @param pages - ordered pages.
		* @returns the last loaded source line, or zero.
		*/
		function lastLineLoaded(pages) {
			const last = pages.at(-1);
			return last === void 0 ? 0 : last.offset + last.lines - 1;
		}
		/**
		* Reveal a plain-text or highlighted source line.
		* @param body - scrolling document body or code-content viewport.
		* @param line - 1-based source line to reveal.
		* @returns Whether the current renderer exposes that line.
		*/
		function scrollToLine(body, line) {
			const innerCode = body.hasAttribute("data-code-block-content");
			const plain = body.querySelector(`[data-textpreview-line="${line}"]`);
			const code = innerCode ? body.querySelectorAll("pre .line").item(line - 1) : null;
			const row = plain ?? code;
			if (!(row instanceof HTMLElement)) return false;
			body.scrollTop = Math.max(0, row.offsetTop);
			return true;
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/TextPreview.module.css.mjs
		const css$8 = ".dhJKeW_preview{flex-direction:column;flex:auto;height:100%;min-height:0;display:flex}.dhJKeW_header{box-sizing:border-box;border-bottom:.5px solid var(--dsw-alias-border-l3);flex:none;align-items:center;gap:4px;height:38px;padding:0 6px 0 16px;display:flex}.dhJKeW_path{margin-right:12px}.dhJKeW_changed{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-bottom:.5px solid var(--dsw-alias-border-l1);flex:none;align-items:center;gap:10px;margin:0;padding:6px 10px;font-size:12px;display:flex}.dhJKeW_body{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);min-height:0;color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px);font-family:var(--dsw-font-mono,ui-monospace, monospace);white-space:pre;flex:auto;margin:0;padding:0;line-height:1.6;position:relative;overflow:auto}.dhJKeW_body::-webkit-scrollbar-track{margin:2px}.dhJKeW_body:has([data-code-preview]){flex-direction:column;display:flex;overflow:hidden}.dhJKeW_body:has([data-pdf-preview]){background:var(--dsw-alias-bg-document-preview)}.dhJKeW_wrap{white-space:pre-wrap;word-break:break-word}.dhJKeW_textDocument{box-sizing:border-box;min-width:100%;min-height:100%;padding:8px}.dhJKeW_page{font:var(--dsw-font-markdown-code-block);white-space:inherit;margin:0}.dhJKeW_line{padding:0 10px}.dhJKeW_lineTarget{background:var(--dsw-alias-interactive-bg-hover)}.dhJKeW_empty{box-sizing:border-box;height:100%;color:var(--dsw-alias-label-secondary);font-size:var(--dsh-content-font-size-secondary,13px);font-family:var(--dsw-font-family);text-align:center;white-space:normal;flex-direction:column;justify-content:center;align-items:center;gap:16px;padding:0 24px;line-height:1.6;display:flex}.dhJKeW_empty:after{content:\"\";flex:0 12%}.dhJKeW_emptyIcon{opacity:.6;filter:grayscale();flex:none}.dhJKeW_emptyLine{margin:0}.dhJKeW_retry{height:32px;color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);cursor:pointer;background:0 0;flex:none;align-items:center;gap:6px;padding:0 14px 0 12px;font-family:inherit;display:inline-flex}.dhJKeW_retry:hover{background:var(--dsw-alias-interactive-bg-hover)}.dhJKeW_titleIcon{flex:none}.dhJKeW_statusLine{color:var(--dsw-alias-label-secondary);font-size:var(--dsh-content-font-size-secondary,13px);white-space:normal;align-items:center;gap:10px;margin:0;padding:6px 10px;line-height:1.6;display:flex}.dhJKeW_status{box-sizing:border-box;flex-direction:column;justify-content:center;align-items:center;gap:8px;height:100%;padding:12px 10px;display:flex}.dhJKeW_action{color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px);font-family:var(--dsw-font,inherit);white-space:normal;background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);cursor:pointer;padding:4px 10px}.dhJKeW_action:hover{background:var(--dsw-alias-bg-layer-3)}.dhJKeW_more{color:var(--dsw-alias-label-secondary);font-size:12px;font-family:var(--dsw-font,inherit);white-space:normal;background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);cursor:pointer;margin:8px 10px;padding:4px 10px;display:block}.dhJKeW_more:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3)}.dhJKeW_more:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.dhJKeW_tool{width:28px;height:28px;color:var(--dsw-alias-label-secondary);border-radius:var(--dsw-radius-sm);cursor:pointer;background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:6px;line-height:1;display:inline-flex}.dhJKeW_tool svg{width:15px;height:15px}.dhJKeW_tool:hover,.dhJKeW_tool[data-textpreview-tool=auto-refresh][aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.dhJKeW_viewerTool{width:auto;max-width:160px;color:var(--dsw-alias-label-secondary);white-space:nowrap;text-overflow:ellipsis;flex:none;padding:0 6px;font-size:12px;overflow:hidden}";
		const tagId$8 = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/TextPreview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$8) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview";
			tag.dataset.pluginCss = tagId$8;
			tag.textContent = css$8;
			document.head.appendChild(tag);
		}
		var TextPreview_module_css_default = {
			"action": "dhJKeW_action",
			"body": "dhJKeW_body",
			"changed": "dhJKeW_changed",
			"empty": "dhJKeW_empty",
			"emptyIcon": "dhJKeW_emptyIcon",
			"emptyLine": "dhJKeW_emptyLine",
			"header": "dhJKeW_header",
			"line": "dhJKeW_line",
			"lineTarget": "dhJKeW_lineTarget",
			"more": "dhJKeW_more",
			"page": "dhJKeW_page",
			"path": "dhJKeW_path",
			"preview": "dhJKeW_preview",
			"retry": "dhJKeW_retry",
			"status": "dhJKeW_status",
			"statusLine": "dhJKeW_statusLine",
			"textDocument": "dhJKeW_textDocument",
			"titleIcon": "dhJKeW_titleIcon",
			"tool": "dhJKeW_tool",
			"viewerTool": "dhJKeW_viewerTool",
			"wrap": "dhJKeW_wrap"
		};
		//#endregion
		//#region lib/types/client/text/TextBody.js
		/** @param props - document contents and standard tab information. @returns source lines with navigation targets. */
		function TextBody({ content, useTabInfo }) {
			const { tab } = useTabInfo();
			const params = tab.navigation.params;
			const target = params !== void 0 && "line" in params ? params.line : void 0;
			if (content.kind !== "text") return null;
			return (0, react_jsx_runtime.jsx)("div", {
				className: TextPreview_module_css_default.textDocument,
				"data-textpreview-plain": true,
				children: content.pages.map((page) => (0, react_jsx_runtime.jsx)("pre", {
					className: TextPreview_module_css_default.page,
					"data-textpreview-page": page.offset,
					children: linesOf(page).map((text, index) => {
						const number = page.offset + index;
						return (0, react_jsx_runtime.jsxs)("div", {
							className: clsx(TextPreview_module_css_default.line, number === target && TextPreview_module_css_default.lineTarget),
							"data-textpreview-line": number,
							...number === target ? { "data-textpreview-target": number } : {},
							children: [text, "\n"]
						}, number);
					})
				}, page.offset))
			});
		}
		//#endregion
		//#region lib/types/client/text/index.js
		/** Stable plain-text implementation identity within this package. */
		const PLAIN_BODY_ID = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/text";
		/**
		* Describe the plain-text fallback.
		* @param title - locale-owned implementation name.
		* @returns plain-text registration metadata.
		*/
		function textBodyDefinition(title) {
			return {
				id: PLAIN_BODY_ID,
				extensions: [],
				priority: "builtin",
				title,
				loading: "text-pages",
				wrap: true
			};
		}
		/** @param ctx - owning plugin context. Register the fallback metadata and keyed body. */
		function apply$9(ctx) {
			const t = ctx.locale.bind("sidebarDocumentPreview");
			ctx.effect(() => ctx.documentPreviews.register(textBodyDefinition(() => t("viewer.text"))));
			ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
				name: "sidebar.right.tab.document",
				key: PLAIN_BODY_ID
			}, TextBody)));
		}
		//#endregion
		//#region lib/types/client/TextPreview.js
		/**
		* The text preview's body: a file's content, or the reason it is not showing.
		*
		* Two sources meet here. The standard `useResource` hook gives the file's
		* metadata — its version — and this type's
		* own store holds the content it read through its face. Metadata changes reload
		* the current preview while automatic refresh is enabled. A failed metadata frame — the file gone, its
		* workspace unknown — takes the same bar's place over the pages already loaded,
		* with the same reload. The type's controls, viewer choice, wrap and reload, sit at the end of
		* the path row; the Sidebar's strip carries none of them.
		*/
		/**
		* The text type's body, registered under `sidebar.right.pane.tab` as `text`.
		* @param props - composed slot props.
		* @returns the content read so far with its controls, or a progress line.
		*/
		function TextPreview({ useTabInfo, useResource, useStore, actions, loadPage, reloadPages, loadAll, reloadAll, prepareRenderer, useDocumentPreviews, renderSlot, t, addResource, setResources }) {
			const { tab } = useTabInfo();
			const { navigation, signal } = tab;
			const meta = useResource(tab.contentId);
			const canRead = meta.status !== "none";
			const file = (0, react.useMemo)(() => hostFileOf(tab.contentId), [tab.contentId]);
			const state = useStore((s) => s.byTab[tab.id]);
			const definitions = useDocumentPreviews((value) => value);
			const unviewable = (0, react.useMemo)(() => unviewableBinaryPath(file.path), [file.path]);
			const candidates = (0, react.useMemo)(() => {
				const matched = matchingDocumentPreviews(definitions, file.path);
				if (matched.length > 0 && binaryDocumentPath(definitions, file.path)) return matched;
				if (matched.length === 0 && unviewable) return matched;
				const fallback = definitions.find((definition) => definition.id === PLAIN_BODY_ID);
				return fallback === void 0 ? matched : [...matched, fallback];
			}, [
				definitions,
				file.path,
				unviewable
			]);
			const selected = candidates.find((candidate) => candidate.id === state?.rendererId) ?? candidates[0];
			const mode = selected?.loading;
			const contentRendererId = mode === "renderer" ? selected?.id : void 0;
			const current = (state?.mode ?? "text-pages") === mode && state?.contentRendererId === contentRendererId ? state : void 0;
			const add = (0, react.useCallback)((address) => {
				addResource(tab.id, address, signal);
			}, [
				addResource,
				tab.id,
				signal
			]);
			const set = (0, react.useCallback)((addresses) => {
				setResources(tab.id, [tab.contentId, ...addresses], signal);
			}, [
				setResources,
				tab.id,
				tab.contentId,
				signal
			]);
			(0, react.useEffect)(() => {
				set([]);
			}, [set, selected?.id]);
			const bodyRef = (0, react.useRef)(null);
			const scrollportRef = (0, react.useRef)(null);
			const storedScrollTopRef = (0, react.useRef)(0);
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const absolutePath = meta.value?.absolutePath ?? current?.complete?.absolutePath;
			const displayPath = absolutePath ?? file.path;
			const fileOwner = absolutePath === void 0 ? void 0 : { absolutePath };
			const line = navigation.params !== void 0 && "line" in navigation.params ? navigation.params.line : void 0;
			const pages = current?.pages;
			const loaded = (0, react.useMemo)(() => loadedPages(pages ?? {}), [pages]);
			const loadedThrough = lastLineLoaded(loaded);
			const hasContent = mode === "renderer" ? current?.version !== void 0 : loaded.length > 0 || current?.complete !== void 0;
			storedScrollTopRef.current = state?.scrollTop ?? 0;
			const bindBody = (0, react.useCallback)((body) => {
				const previous = bodyRef.current;
				bodyRef.current = body;
				if (scrollportRef.current === null || scrollportRef.current === previous) scrollportRef.current = body;
			}, []);
			const bindScrollport = (0, react.useCallback)((scrollport) => {
				const next = scrollport ?? bodyRef.current;
				scrollportRef.current = next;
				if (next !== null) next.scrollTop = storedScrollTopRef.current;
			}, []);
			const started = current !== void 0;
			(0, react.useEffect)(() => {
				if (started || !canRead || mode === void 0 || selected === void 0) return;
				if (mode === "text-pages") loadPage(tab.id, file, 1, signal, meta.value?.version);
				else if (mode === "bytes-complete") loadAll(tab.id, file, signal, meta.value?.version);
				else prepareRenderer(tab.id, signal, selected.id, meta.value?.version);
			}, [
				started,
				tab.id,
				file,
				signal,
				loadPage,
				loadAll,
				prepareRenderer,
				canRead,
				mode,
				selected,
				meta.value?.version
			]);
			(0, react.useEffect)(() => {
				const body = scrollportRef.current;
				if (hasContent && body !== null && state !== void 0) body.scrollTop = state.scrollTop;
			}, [hasContent, selected?.id]);
			(0, react.useEffect)(() => {
				const body = scrollportRef.current;
				if (current === void 0 || body === null || current.revision === navigation.revision) return;
				if (line === void 0 || mode !== "text-pages") {
					actions.navigated(tab.id, navigation.revision);
					return;
				}
				if (line > loadedThrough && !current.eof) {
					if (!current.loading && current.failure === void 0 && canRead) loadPage(tab.id, file, loadedThrough + 1, signal, meta.value?.version);
					return;
				}
				if (!scrollToLine(body, line) && line <= loadedThrough) return;
				actions.navigated(tab.id, navigation.revision);
				actions.scrolled(tab.id, body.scrollTop);
			}, [
				navigation.revision,
				line,
				loadedThrough,
				current?.eof,
				current?.loading,
				current?.failure,
				started,
				selected?.id,
				mode,
				file,
				canRead,
				meta.value?.version
			]);
			const rendererReload = (0, react.useCallback)(() => {
				if (canRead && selected !== void 0) prepareRenderer(tab.id, signal, selected.id, meta.value?.version, true);
			}, [
				canRead,
				prepareRenderer,
				tab.id,
				signal,
				selected?.id,
				meta.value?.version
			]);
			const observedVersion = meta.value?.version;
			const changed = current?.version !== void 0 && observedVersion !== void 0 && observedVersion !== current.version && observedVersion !== current.observedVersion || state?.resourcesDirty === true;
			const reload = (0, react.useCallback)(() => {
				if (!canRead) return;
				if (mode === "text-pages") reloadPages(tab.id, file, signal, observedVersion);
				else if (mode === "bytes-complete") reloadAll(tab.id, file, signal, observedVersion);
				else rendererReload();
			}, [
				canRead,
				mode,
				reloadPages,
				reloadAll,
				rendererReload,
				tab.id,
				file,
				signal,
				observedVersion
			]);
			(0, react.useEffect)(() => tab.actions.bindCommands({ refresh: reload }), [tab.actions, reload]);
			(0, react.useEffect)(() => {
				if (state?.autoRefresh && changed && current !== void 0 && !current.loading && meta.status === "live") reload();
			}, [
				state?.autoRefresh,
				changed,
				current?.loading,
				meta.status,
				reload
			]);
			const content = (0, react.useMemo)(() => {
				if (mode === "renderer") {
					if (current === void 0) return void 0;
					const revision = current.loadRevision;
					return {
						kind: "renderer",
						revision,
						reload: rendererReload,
						failed: () => {
							actions.rendererFailed(tab.id, revision);
						},
						loaded: (version) => {
							actions.rendered(tab.id, revision, version);
						}
					};
				}
				if (mode === "bytes-complete") return current?.complete === void 0 ? void 0 : {
					kind: "bytes",
					data: current.complete.data
				};
				if (current === void 0 || loaded.length === 0) return void 0;
				return {
					kind: "text",
					pages: loaded,
					text: loaded.filter((page) => page.lines > 0).map((page) => page.text).join("\n"),
					eof: current.eof
				};
			}, [
				mode,
				loaded,
				current?.complete,
				current?.eof,
				current?.loadRevision,
				rendererReload,
				actions,
				tab.id
			]);
			if (selected === void 0 && unviewable) {
				const { name: unsupportedName } = pathPartsOf(displayPath);
				return (0, react_jsx_runtime.jsxs)("div", {
					className: TextPreview_module_css_default.preview,
					"data-textpreview-state": "unsupported",
					"data-textpreview-url": tab.contentId,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: TextPreview_module_css_default.header,
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.PathLabel, {
							path: displayPath,
							className: TextPreview_module_css_default.path,
							"data-textpreview-path": true
						}), fileOwner !== void 0 && renderSlot("sidebar.right.tab.document.actions", fileOwner)]
					}), (0, react_jsx_runtime.jsx)("div", {
						className: TextPreview_module_css_default.body,
export {};
