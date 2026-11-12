/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({ byTab: {} }),
				actions: {
					/** @param state - draft. @param tab - owning tab. @param revision - new content revision. */
					loading(state, tab, revision) {
						state.byTab[tab] = { revision };
					},
					/** @param state - draft. @param tab - owning tab. @param revision - completed revision. @param file - borrowed PDF bytes. */
					complete(state, tab, revision, file) {
						state.byTab[tab] = {
							revision,
							file
						};
					},
					/** @param state - draft. @param tab - owning tab. @param revision - failed revision. @param failure - displayable failure. */
					failed(state, tab, revision, failure) {
						state.byTab[tab] = {
							revision,
							failure
						};
					},
					/** @param state - draft. @param tab - closed tab. */
					forget(state, tab) {
						const { [tab]: _closed, ...remaining } = state.byTab;
						state.byTab = remaining;
					}
				}
			});
		}
		//#endregion
		//#region lib/types/client/office/index.js
		/**
		* Register Office previews with versioned PDF reuse and missing-font notices.
		* @param ctx - Client renderer registry, localized copy, and optional Host Remotes.
		* @param config - Resolved Office preview cache limits.
		*/
		function apply$2(ctx, config) {
			const id = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/office";
			const extensions = [
				"doc",
				"docx",
				"ppt",
				"pptx"
			];
			ctx.effect(() => ctx.locale.register("sidebarOffice", {
				zh: zh$1,
				en: en$1
			}));
			const t = ctx.locale.bind("sidebarOffice");
			const unavailable = (_file, signal) => {
				signal.throwIfAborted();
				return Promise.reject(new Error(t("unavailable")));
			};
			let read = unavailable;
			ctx.effect(() => ctx.documentPreviews.register({
				id,
				extensions,
				binaryExtensions: extensions,
				priority: "builtin",
				title: () => t("title"),
				loading: "renderer",
				wrap: false
			}));
			const store = createOfficeStore();
			ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document.action", () => ctx.slots.register({
				name: "sidebar.right.tab.document.action",
				key: id,
				locale: "sidebarOffice",
				store
			}, OfficeFontAction)));
			const retainTab = retainDocumentTabs(ctx);
			const documentT = ctx.locale.bind("sidebarDocumentPreview");
			const face = officeFace((file, signal) => read(file, signal), (failure) => "code" in failure ? failureLine(documentT, failure) : documentT("error.unavailable", { message: failure.message }));
			ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
				name: "sidebar.right.tab.document",
				key: id,
				locale: "sidebarOffice",
				store,
				children: { "sidebar.right.tab.document.office.pdf": {
					kind: "keyed",
					scope: "session",
					inject: { hooks: { tabInfo: documentTabInfoFactory } }
				} },
				inject: (sessionId, actions) => ({
					...face(sessionId, actions),
					retainTab: (tabId, signal) => {
						retainTab(tabId, signal, actions.forget);
					}
				})
			}, OfficeBody)));
			const pdfPresentation = pdfBodyRegistration(ctx);
			ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document.office.pdf", () => ctx.slots.register({
				name: "sidebar.right.tab.document.office.pdf",
				key: id,
				locale: "sidebarPdf",
				...pdfPresentation
			}, LazyPdfBody)));
			ctx.inject([
				"remote",
				"remote.officeToPdf",
				"remote.workspaceFiles"
			], (scope) => {
				const convert = async (file, signal, priority) => {
					signal.throwIfAborted();
					const result = await scope.remote.officeToPdf.render(file.sessionId, file.path, priority, signal);
					signal.throwIfAborted();
					if (!result.ok && result.error.code === "document-render/failed") throw new Error(t(conversionErrorKey(result.error.details.reason)), { cause: result.error });
					return result;
				};
				const createCache = () => new OfficePreviewCache(async (file, signal) => {
					const authorized = await scope.remote.workspaceFiles.readBytes(file.sessionId, file.path, { range: {
						offset: 0,
						length: 1
					} }, signal);
					signal.throwIfAborted();
					if (!authorized.ok) return authorized;
					const metadata = await scope.remote.workspaceFiles.stat(file.sessionId, file.path, signal);
					if (metadata.ok && (authorized.value.absolutePath !== metadata.value.absolutePath || authorized.value.version !== metadata.value.version)) throw new Error(t("changed"));
					return metadata;
				}, convert, config.maxCachedEntries, config.maxCachedBytes, config.maxPending, config.maxReaders, async (signal) => {
					const result = await scope.remote.officeToPdf.generation(signal);
					signal.throwIfAborted();
					if (!result.ok) throw new Error(t("unavailable"), { cause: result.error });
					return result;
				}, () => new Error(t("busy")));
				let cache = createCache();
				const retired = /* @__PURE__ */ new Set();
				read = async (file, signal) => {
					const result = await cache.read(file, signal);
					if (!result.ok && (result.error.code === "gateway/invocation-unavailable" || result.error.code === "gateway/service-unavailable")) throw new Error(t("unavailable"), { cause: result.error });
					return result;
				};
				scope.on("connection/reset", () => {
					const previous = cache;
					cache = createCache();
					const closing = previous.dispose().finally(() => {
						retired.delete(closing);
					});
					retired.add(closing);
				});
				scope.effect(() => async () => {
					read = unavailable;
					await Promise.all([...retired, cache.dispose()]);
				});
			});
		}
		function conversionErrorKey(code) {
			switch (code) {
				case "input-too-large":
				case "output-too-large": return "tooLarge";
				case "invalid-document":
				case "unsupported-format": return "invalid";
				case "timeout": return "timeout";
				case "unavailable": return "unavailable";
				case "busy": return "busy";
				case "source-changed": return "changed";
				default: return "failed";
			}
		}
		//#endregion
		//#region lib/types/client/excel/error.js
		/** Locale-independent spreadsheet parser failure categories. */
		var ExcelPreviewError = class extends Error {
			code;
			/** @param code - User-actionable parser failure. */
			constructor(code, options) {
				super(code, options);
				this.code = code;
				this.name = "ExcelPreviewError";
			}
		};
		//#endregion
		//#region lib/types/client/excel/format.js
		/** Filename-to-parser selection kept outside the heavy spreadsheet chunk. */
		/**
		* Resolve a registered filename to its parser.
		* @param path - Decoded file path.
		* @returns The supported suffix; rejects unsupported filenames.
		*/
		function excelFormat(path) {
			const suffix = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
			if (suffix === "xlsx" || suffix === "xls" || suffix === "csv" || suffix === "tsv") return suffix;
			throw new ExcelPreviewError("invalid");
		}
		//#endregion
		//#region lib/types/client/excel/LazyExcelBody.js
		/** Load the spreadsheet renderer only when a supported workbook is opened. */
		const LoadedExcelBody = (0, react.lazy)(async () => ({ default: (await require.async("./client.excel.js")).ExcelBody }));
		/**
		* Load the browser spreadsheet renderer for every registered format.
		* @param props - Complete file bytes and standard document seats.
		* @returns Localized loading state or Excel preview.
		*/
		function LazyExcelBody(props) {
			const format = excelFormat(hostFileOf(props.resourceAddress).path);
			const loading = (0, react_jsx_runtime.jsx)(LoadingIndicator, { label: props.t("loading") });
			return (0, react_jsx_runtime.jsx)(react.Suspense, {
				fallback: loading,
				children: (0, react_jsx_runtime.jsx)(LoadedExcelBody, {
					...props,
					format,
					loading
				})
			});
		}
		//#endregion
		//#region lib/types/client/excel/locales.js
		/** Locale-owned Excel preview controls and parser feedback. */
		const zh = {
			title: "表格",
			language: "zh",
			loading: "文档渲染中...",
			invalid: "无法打开此表格。请检查文件格式、内容或密码保护。",
			tooLarge: "此表格超过预览大小限制。",
			timeout: "打开表格超时。请缩小文件后重试。",
			encoding: "无法识别此文本文件的编码。请另存为 UTF-8 或带 BOM 的 UTF-16 后重试。",
			formulaWarning: "此工作簿包含公式，显示结果可能缺失或不准确。",
			unsupportedNotice: "当前预览不支持此工作簿中的{features}。请使用系统应用打开，以获得完整体验。",
			charts: "图表",
			images: "图片",
			shapes: "形状",
			conditionalFormatting: "条件格式",
			featureSeparator: "、",
			retry: "重试"
		};
		/** English Excel preview copy. */
		const en = {
			title: "Spreadsheet",
			language: "en",
			loading: "Rendering document...",
			invalid: "This spreadsheet could not be opened. Check its format, contents, or password protection.",
			tooLarge: "This workbook exceeds the preview size limit.",
			timeout: "Opening this workbook timed out. Try a smaller file.",
			encoding: "This text encoding could not be read. Save the file as UTF-8 or UTF-16 with a BOM and retry.",
			formulaWarning: "This workbook contains formulas. Displayed results may be missing or inaccurate.",
			unsupportedNotice: "This preview does not support {features} in this workbook. Open it in a system application for the full experience.",
			charts: "charts",
			images: "images",
			shapes: "shapes",
			conditionalFormatting: "conditional formatting",
			featureSeparator: ", ",
			retry: "Retry"
		};
		//#endregion
		//#region lib/types/client/excel/index.js
		/**
		* Register the browser Excel viewer and its lifecycle-owned slot.
		* @param ctx - Preview and locale registries.
		* @param limits - Resolved parser limits.
		*/
		function apply$1(ctx, limits) {
			const id = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/excel";
			ctx.effect(() => ctx.locale.register("sidebarExcel", {
				zh,
				en
			}));
			const t = ctx.locale.bind("sidebarExcel");
			ctx.effect(() => ctx.documentPreviews.register({
				id,
				extensions: [
					"xlsx",
					"xls",
					"csv",
					"tsv"
				],
				binaryExtensions: ["xlsx", "xls"],
				priority: "builtin",
				title: () => t("title"),
				loading: "bytes-complete",
				wrap: false
			}));
			ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
				name: "sidebar.right.tab.document",
				key: id,
				locale: "sidebarExcel",
				inject: () => ({ limits })
			}, LazyExcelBody)));
		}
		//#endregion
		//#region ../../../vendor/cosmokit/lib/index.js
		/** Return true when a value is `null` or `undefined`. */
		function isNullable(value) {
			return value === null || value === void 0;
		}
		/** Return true for non-array object values. */
		function isPlainObject(data) {
			return data && typeof data === "object" && !Array.isArray(data);
		}
		/** Filter object entries and return a new object. */
		function filterKeys(object, filter) {
			return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
		}
		/** Map object values while preserving the original key set. */
		function mapValues(object, transform) {
			return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
		}
		/** Pick selected keys from an object, optionally including `undefined` values. */
		function pick(source, keys, forced) {
			if (!keys) return { ...source };
			const result = {};
			for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
			return result;
		}
		/** Shared config references used by schema validators and plugin runtimes. */
		const write = Symbol.for("cosmokit.volatile.write");
		function snapshot(value, ancestors = /* @__PURE__ */ new Set()) {
			if (typeof value === "function") throw new TypeError("volatile config cannot contain functions");
			if (value === null || typeof value !== "object") return value;
			if (ancestors.has(value)) throw new TypeError("volatile config cannot contain cycles");
			ancestors.add(value);
			try {
				if (Array.isArray(value)) return Object.freeze(value.map((item) => snapshot(item, ancestors)));
				if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError("volatile config objects must be plain objects or arrays");
				return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item, ancestors)])));
			} finally {
				ancestors.delete(value);
			}
		}
		/**
		* Create a detached reference containing an immutable copy of the supplied data.
		* @param value - validated config data; class instances and functions are unsupported.
		* @returns a reference whose value is updated only by its owning runtime.
		*/
		function createVolatile(value) {
			let current = snapshot(value);
			return Object.freeze({
				get: () => current,
				[write]: (value) => {
					current = value;
				}
			});
		}
		/**
		* Identify references across ESM/CJS copies of the shared library.
		* @param value - a parsed config value.
		* @returns whether the value implements the shared reference protocol.
		*/
		function isVolatile(value) {
			return typeof value === "object" && value !== null && write in value;
		}
		/** Test values using `instanceof` with a `toStringTag` fallback. */
		function is(type, value) {
			if (arguments.length === 1) return (value) => is(type, value);
			return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
		}
		function isArrayBufferLike(value) {
			return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
		}
		function isArrayBufferSource(value) {
			return isArrayBufferLike(value) || ArrayBuffer.isView(value);
		}
		/** Binary source detection and base64/hex conversion helpers. */
		var Binary;
		(function(Binary) {
			Binary.is = isArrayBufferLike;
			Binary.isSource = isArrayBufferSource;
			function fromSource(source) {
				if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
				else return source;
			}
			Binary.fromSource = fromSource;
			function toBase64(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
				let binary = "";
				const bytes = new Uint8Array(source);
				for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
				return btoa(binary);
			}
			Binary.toBase64 = toBase64;
			function fromBase64(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
				return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
			}
			Binary.fromBase64 = fromBase64;
			function toHex(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
				return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
			}
			Binary.toHex = toHex;
			function fromHex(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
				const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
				const buffer = [];
				for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
				return Uint8Array.from(buffer).buffer;
			}
			Binary.fromHex = fromHex;
		})(Binary || (Binary = {}));
		Binary.fromBase64;
		Binary.toBase64;
		Binary.fromHex;
		Binary.toHex;
		/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
		function clone(source, refs = /* @__PURE__ */ new Map()) {
			if (!source || typeof source !== "object") return source;
			if (is("Date", source)) return new Date(source.valueOf());
			if (is("RegExp", source)) return new RegExp(source.source, source.flags);
			if (isArrayBufferLike(source)) return source.slice(0);
export {};
