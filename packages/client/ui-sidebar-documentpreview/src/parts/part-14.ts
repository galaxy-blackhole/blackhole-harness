/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			loading: "文档渲染中...",
			failed: "无法显示这张图片",
			unsupported: "图片预览需要完整文件内容"
		};
		/** English dictionary with the same keys as the Chinese dictionary. */
		const en$4 = {
			...zoomEn,
			title: "Image",
			preview: "Image preview: {name}",
			loading: "Rendering document...",
			failed: "This image could not be displayed.",
			unsupported: "Image preview requires the complete file contents."
		};
		//#endregion
		//#region lib/types/client/image/index.js
		/** Image implementation identity, shared by metadata and the keyed slot. */
		const IMAGE_BODY_ID = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/image";
		/** File suffixes rendered by the builtin image body. */
		const IMAGE_EXTENSIONS = [
			"png",
			"jpg",
			"jpeg",
			"gif",
			"webp",
			"bmp",
			"ico",
			"svg"
		];
		/** Bitmap suffixes whose bytes are unreadable as text; SVG stays out because its XML source is worth reading. */
		const BINARY_IMAGE_EXTENSIONS = [
			"png",
			"jpg",
			"jpeg",
			"gif",
			"webp",
			"bmp",
			"ico"
		];
		/**
		* Describe the builtin image renderer independently from its keyed body slot.
		* @param title - locale-owned implementation name.
		* @returns metadata for complete image files.
		*/
		function imageBodyDefinition(title) {
			return {
				id: IMAGE_BODY_ID,
				extensions: IMAGE_EXTENSIONS,
				binaryExtensions: BINARY_IMAGE_EXTENSIONS,
				priority: "builtin",
				title,
				loading: "bytes-complete",
				wrap: false
			};
		}
		/**
		* Register the image dictionary, metadata, and body with reversible effects.
		* @param ctx - owning plugin context.
		*/
		function apply$5(ctx) {
			const t = ctx.locale.bind("sidebarImage");
			ctx.effect(() => ctx.locale.register("sidebarImage", {
				zh: zh$4,
				en: en$4
			}), "document-image: dictionaries");
			ctx.effect(() => ctx.documentPreviews.register(imageBodyDefinition(() => t("title"))), "document-image: metadata");
			const store = createZoomStore();
			const retainTab = retainDocumentTabs(ctx);
			ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
				name: "sidebar.right.tab.document",
				key: IMAGE_BODY_ID,
				locale: "sidebarImage",
				store,
				inject: (_sessionId, actions) => ({ retainTab: (tabId, signal) => {
					retainTab(tabId, signal, actions.forget);
				} })
			}, ImageBody)), "document-image: body");
		}
		//#endregion
		//#region lib/types/client/pdf/LazyPdfBody.js
		/** Load the PDF renderer only after a PDF body is mounted. */
		const LoadedPdfBody = (0, react.lazy)(async () => ({ default: (await require.async("./client.pdf.js")).PdfBody }));
		/**
		* Suspend while the package-local PDF chunk arrives.
		* @param props - PDF body props supplied by the document slot.
		* @returns the deferred PDF renderer.
		*/
		function LazyPdfBody(props) {
			const loading = (0, react_jsx_runtime.jsx)(LoadingIndicator, { label: props.t("loading") });
			return (0, react_jsx_runtime.jsx)(react.Suspense, {
				fallback: loading,
				children: (0, react_jsx_runtime.jsx)(LoadedPdfBody, {
					...props,
					loading
				})
			});
		}
		//#endregion
		//#region lib/types/client/pdf/store.js
		/** Restorable PDF viewing preferences; document objects and canvases remain component-local. */
		/**
		* Declare the last visible page and zoom preference isolated by tab identity.
		* @returns a store declaration instantiated by the document slot for each Session.
		*/
		function createPdfStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({ byTab: {} }),
				actions: {
					/** @param draft - view state. @param tabId - owning tab. @param page - selected 1-based page. */
					page: (draft, tabId, page) => {
						draft.byTab[tabId] = {
							...draft.byTab[tabId],
							page
						};
					},
					/** @param draft - view state. @param tabId - owning tab. @param zoom - selected scale multiplier. */
					zoom: (draft, tabId, zoom) => {
						draft.byTab[tabId] = {
							page: draft.byTab[tabId]?.page ?? 1,
							zoom
						};
					},
					/** @param draft - view state. @param tabId - closed tab whose preferences are discarded. */
					forget: (draft, tabId) => {
						const remaining = {};
						for (const [id, view] of Object.entries(draft.byTab)) if (id !== tabId) remaining[id] = view;
						draft.byTab = remaining;
					}
				}
			});
		}
		//#endregion
		//#region lib/types/client/pdf/locales.js
		/** Copy owned by the PDF renderer. */
		const zh$3 = {
			...zoomZh,
			title: "PDF",
			pageImage: "PDF 第 {page} 页",
			loading: "文档渲染中...",
			rendering: "正在绘制页面…",
			failed: "无法显示 PDF：{message}",
			password: "此 PDF 需要密码，暂不支持预览",
			workerFailed: "PDF 渲染进程无法继续，请重试",
			unsupported: "PDF 预览需要完整文件内容",
			retry: "重试"
		};
		/** English PDF-renderer dictionary. */
		const en$3 = {
			...zoomEn,
			title: "PDF",
			pageImage: "PDF page {page}",
			loading: "Rendering document...",
			rendering: "Rendering page…",
			failed: "Cannot display PDF: {message}",
			password: "This PDF requires a password; password-protected previews are not supported.",
			workerFailed: "The PDF rendering process could not continue. Please retry.",
			unsupported: "PDF preview requires the complete file contents.",
			retry: "Retry"
		};
		//#endregion
		//#region lib/types/client/pdf/index.js
		/** PDF metadata and keyed body share this package-local implementation identity. */
		const PDF_BODY_ID = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/pdf";
		/**
		* Describe the builtin PDF renderer independently from its keyed body slot.
		* @param title - locale-owned implementation name.
		* @returns the complete-file PDF registration.
		*/
		function pdfBodyDefinition(title) {
			return {
				id: PDF_BODY_ID,
				extensions: ["pdf"],
				binaryExtensions: ["pdf"],
				priority: "builtin",
				title,
				loading: "bytes-complete",
				wrap: false
			};
		}
		/** @param ctx - context carrying the locale, document registry, and slot registry. */
		function apply$4(ctx) {
			ctx.effect(() => ctx.locale.register("sidebarPdf", {
				zh: zh$3,
				en: en$3
			}));
			const t = ctx.locale.bind("sidebarPdf");
			ctx.effect(() => ctx.documentPreviews.register(pdfBodyDefinition(() => t("title"))));
			const presentation = pdfBodyRegistration(ctx);
			ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
				name: "sidebar.right.tab.document",
				key: PDF_BODY_ID,
				locale: "sidebarPdf",
				...presentation
			}, LazyPdfBody)));
		}
		/**
		* Retain PDF viewing state for a document entry's tab lifetime.
		* @param ctx - owning registration context.
		* @returns the store and injection shared by ordinary and Office PDF registrations.
		*/
		function pdfBodyRegistration(ctx) {
			const store = createPdfStore();
			const retainTab = retainDocumentTabs(ctx);
			return {
				store,
				inject: (_sessionId, actions) => ({
					retainTab: (tabId, signal) => {
						retainTab(tabId, signal, actions.forget);
					},
					ZoomViewport,
					zoomSurfaceClass
				})
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/code/CodeBody.module.css.mjs
		const css$2 = ".Java6a_renderer{white-space:normal;flex-direction:column;flex:auto;width:100%;min-width:0;height:100%;min-height:0;display:flex;overflow:hidden}.Java6a_renderer .Java6a_code{--dsl-code-block-border-radius:0px;--dsl-code-block-line-white-space:pre;--dsl-code-block-background:transparent;flex-direction:column;flex:auto;min-width:0;height:100%;min-height:0;margin:0;display:flex;position:static}.Java6a_renderer .Java6a_code>[data-code-block-content]{flex:auto;min-width:0;min-height:0;display:block;position:relative;overflow:auto}.Java6a_renderer .Java6a_code>[data-code-block-content]::-webkit-scrollbar-track{margin:2px}.Java6a_renderer .Java6a_code pre{box-sizing:border-box;white-space:pre;word-break:normal;overflow-wrap:normal;min-width:100%;padding:16px;overflow:visible}.Java6a_renderer[data-wrap=true] .Java6a_code{--dsl-code-block-line-white-space:pre-wrap}.Java6a_renderer[data-wrap=true] .Java6a_code pre{white-space:pre-wrap;overflow-wrap:anywhere}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/CodeBody.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var CodeBody_module_css_default = {
			"code": "Java6a_code",
			"renderer": "Java6a_renderer"
		};
		//#endregion
		//#region lib/types/client/code/CodeBody.js
		/** @param props - accumulated document contents and framework props. @returns one stable CodeBlock, or no body for byte contents. */
		function CodeBody({ resourceAddress, content, wrap, scrollportRef, t }) {
			if (content.kind !== "text") return null;
			const file = parseFileAddress(resourceAddress);
			if (file === void 0) throw new Error(`ui-sidebar-documentpreview: not a file address "${resourceAddress}"`);
			const language = (0, _deepseek_ai_dsh_client_ui_primitives.languageForPath)(file.path);
			return (0, react_jsx_runtime.jsx)("div", {
				className: CodeBody_module_css_default.renderer,
				"data-code-preview": true,
				"data-wrap": wrap,
				children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.CodeBlock, {
					className: CodeBody_module_css_default.code,
					contentRef: scrollportRef,
					code: content.text,
					lang: language,
					streaming: !content.eof,
					wrap,
					lineNumbers: true,
					copyLabel: t("copy"),
					copiedLabel: t("copied"),
					toolbarLabels: {
						codeLabel: t("codeBlock.title"),
						wrapLabel: t("codeBlock.wrap"),
						unwrapLabel: t("codeBlock.unwrap")
					}
				})
			});
		}
		//#endregion
		//#region lib/types/client/code/locales.js
		/** Simplified Chinese dictionary and key source. */
		const zh$2 = {
			title: "代码",
			copy: "复制",
			copied: "已复制"
		};
		/** English dictionary with the same keys. */
		const en$2 = {
			title: "Code",
			copy: "Copy",
			copied: "Copied"
		};
		//#endregion
		//#region lib/types/client/code/index.js
		const ID = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/code";
		const NS$1 = "sidebarCodePreview";
		/** @param ctx - owning plugin context. Register localized metadata and the matching keyed document body. */
		function apply$3(ctx) {
			ctx.effect(() => ctx.locale.register(NS$1, {
				zh: zh$2,
				en: en$2
			}));
			const t = ctx.locale.bind(NS$1);
			ctx.effect(() => ctx.documentPreviews.register({
				id: ID,
				extensions: _deepseek_ai_dsh_client_ui_primitives.CODE_HIGHLIGHT_EXTENSIONS,
				priority: "builtin",
				title: () => t("title"),
				loading: "text-pages",
				wrap: true
			}));
			ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
				name: "sidebar.right.tab.document",
				key: ID,
				locale: NS$1
			}, CodeBody)));
		}
		//#endregion
		//#region lib/types/client/office/locales.js
		/** Office preview copy and Host render configuration guidance. */
		const zh$1 = {
			title: "Office 文档",
			loading: "文档渲染中...",
			retry: "重试",
			viewMissingFonts: "缺失 {count} 种字体，点击查看",
			missingFontsTitle: "缺失的字体",
			missingFontsDescription: "本次预览无法使用以下字体，预览中的文字和排版可能与原文档不同。",
			missingFontsCount: "{count} 种字体",
			closeDetails: "关闭字体详情",
			unavailable: "Office 预览不可用。请在运行 DeepSeek Harness 的主机上启用文档预览服务。",
			invalid: "无法预览此 Office 文件。文件可能已损坏、受密码保护，或与扩展名不符。",
			tooLarge: "Office 文件或转换后的 PDF 超过预览大小上限，请缩小文件或调整预览配置。",
			failed: "Office 转换失败，未生成可用的 PDF。请检查该文件后重试。",
			timeout: "Office 转换超时，请重试。",
			busy: "Office 预览任务较多，请稍后重试。",
			changed: "文件在读取时已更改，请重新打开预览。"
		};
		/** English translations checked against the Chinese key set. */
		const en$1 = {
			title: "Office document",
			loading: "Rendering document...",
			retry: "Retry",
			viewMissingFonts: "Missing fonts: {count}. Click to view.",
			missingFontsTitle: "Missing fonts",
			missingFontsDescription: "These fonts are unavailable for this preview. Text and layout may differ from the original document.",
			missingFontsCount: "Fonts: {count}",
			closeDetails: "Close font details",
			unavailable: "Office previews are unavailable. Enable the document preview service on the computer running DeepSeek Harness.",
			invalid: "This Office file cannot be previewed. It may be damaged, password protected, or have the wrong extension.",
			tooLarge: "The Office file or converted PDF exceeds the preview size limit. Reduce the file size or adjust the preview configuration.",
			failed: "Office conversion did not produce a usable PDF. Check the file and try again.",
			timeout: "Office conversion timed out. Try again.",
			busy: "Office preview is busy. Try again shortly.",
			changed: "The file changed while being read. Reopen the preview."
		};
		//#endregion
		//#region lib/types/client/office/cache.js
		/** Bounded successful results; each caller reauthorizes and checks source freshness before reuse. */
		var OfficePreviewCache = class {
			stat;
			convert;
			maxEntries;
			maxBytes;
			maxPending;
			maxReaders;
			currentGeneration;
			busy;
			ready = /* @__PURE__ */ new Map();
			pending = /* @__PURE__ */ new Map();
			bytes = 0;
			readers = 0;
			generation;
			generationQuery = 0;
			acceptedQuery = 0;
			superseded = /* @__PURE__ */ new Error();
			lifetime = new AbortController();
			tasks = /* @__PURE__ */ new Set();
			reads = /* @__PURE__ */ new Set();
			/**
			* @param stat - authorized source metadata lookup.
			* @param convert - Host render Remote returning binary PDF bytes borrowed read-only by callers.
			* @param maxEntries - maximum completed results retained.
			* @param maxBytes - maximum retained PDF byteLength.
			* @param maxPending - maximum unsettled Host conversion requests, including cancellation teardown.
			* @param maxReaders - maximum readers, including metadata lookups.
			* @param generation - current Host renderer generation, checked before cached reuse.
			* @param busy - localized capacity failure.
			*/
			constructor(stat, convert, maxEntries, maxBytes, maxPending, maxReaders, currentGeneration, busy) {
				this.stat = stat;
				this.convert = convert;
				this.maxEntries = maxEntries;
				this.maxBytes = maxBytes;
				this.maxPending = maxPending;
				this.maxReaders = maxReaders;
				this.currentGeneration = currentGeneration;
				this.busy = busy;
			}
			/**
			* Share a conversion without letting one caller cancel another caller's work.
			* Renderer replacement retries authorization once; repeated replacement reports localized capacity failure.
			* @param file - Session authorization scope and source path.
			* @param signal - this caller's lifetime.
			* @param priority - foreground preview or speculative read.
			* @returns current PDF bytes borrowed read-only, or a declared source-read failure; cancellation rejects.
			*/
			async read(file, signal, priority = "foreground") {
				signal.throwIfAborted();
				this.lifetime.signal.throwIfAborted();
				const readerLimit = priority === "background" ? this.maxReaders - 1 : this.maxReaders;
				if (this.readers >= readerLimit || priority === "background" && this.maxPending === 1) throw this.busy();
				this.readers++;
				const operation = this.lookup(file, signal, priority);
				this.reads.add(operation);
				try {
					return await operation;
				} finally {
					this.readers--;
					this.reads.delete(operation);
				}
export {};
