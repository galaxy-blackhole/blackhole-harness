/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-sidebar-documentpreview",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		let react_dom = require("react-dom");
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region ../../util/workspace-path/lib/index.js
		/**
		* The `dsh-resource://file/…` address grammar: how a file is named across the
		* Sidebar and the resource model, built and parsed without touching a
		* filesystem.
		* @module
		*/
		/** The scheme and type every file address opens with. */
		const FILE_ADDRESS_PREFIX = "dsh-resource://file/";
		/** Component-encode one id or path segment, keeping `:` literal for drive letters. */
		function encodeSegment(segment) {
			return encodeURIComponent(segment).replace(/%3A/gi, ":");
		}
		/** Encode a `/`-separated path segment by segment. */
		function encodePath(path) {
			return path.split("/").map(encodeSegment).join("/");
		}
		/** Whether a decoded first path segment is a Windows drive (`C:`). */
		function isDriveSegment(segment) {
			return segment !== void 0 && /^[A-Za-z]:$/.test(segment);
		}
		/**
		* Build the address of a file read through one Session.
		* @param sessionId - the Session whose Host workspace resolves the path.
		* @param path - absolute or workspace-relative path; backslashes are normalized to `/`, and leading `./` prefixes are dropped.
		* @returns the `dsh-resource://file/session/<sessionId>/<path>` address.
		*/
		function sessionFileAddress(sessionId, path) {
			const normalized = path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
			return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`;
		}
		/**
		* Read a file address back into its parts without resolving `.` or `..`.
		* Query and fragment suffixes are ignored; encoded path segments are decoded.
		* @param address - a candidate address.
		* @returns the parts, or `undefined` when the string is not a `dsh-resource://file/` URI in a known scope with a path, or a segment is not validly encoded.
		*/
		function parseFileAddress(address) {
			try {
				if (!address.startsWith(FILE_ADDRESS_PREFIX)) return void 0;
				const end = address.search(/[?#]/);
				const [scope, ...rest] = address.slice(20, end === -1 ? void 0 : end).split("/");
				if (scope === "session") {
					const [id, ...segments] = rest;
					if (id === void 0 || id === "" || segments.length === 0) return void 0;
					return {
						scope,
						sessionId: decodeURIComponent(id),
						path: segments.map(decodeURIComponent).join("/")
					};
				}
				if (scope === "absolute") {
					const unc = rest[0] === "" && rest.length > 1;
					const segments = (unc ? rest.slice(1) : rest).map(decodeURIComponent);
					if (segments.length === 0 || segments[0] === "") return void 0;
					if (unc) return {
						scope,
						path: `//${segments.join("/")}`
					};
					return {
						scope,
						path: isDriveSegment(segments[0]) ? segments.join("/") : `/${segments.join("/")}`
					};
				}
				return;
			} catch {
				return;
			}
		}
		/**
		* Browser-safe Workspace path and display helpers.
		* @module @deepseek-ai/dsh-util-workspace-path
		*/
		/** Whether a path uses a Windows drive or UNC prefix. */
		function isWindowsStylePath(value) {
			return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
		}
		/**
		* Whether a path is absolute in either spelling the Host accepts: POSIX (`/a/b`) or Windows drive or UNC.
		* @param path - the path to classify.
		* @returns `true` for an absolute path; `false` for a Workspace-relative one.
		*/
		function isAbsoluteWorkspacePath(path) {
			return path.startsWith("/") || isWindowsStylePath(path);
		}
		/**
		* Split a path for display: the directories through their last separator, and
		* the final segment after it. Both `/` and `\` separate, so a Windows path
		* splits where its own segments end; trailing separators are dropped first, so
		* a directory path names its own last segment. A path with no separator, or a
		* separator-only path, is all name.
		* @param path - file or directory path using POSIX or Windows separators.
		* @returns the directory prefix (possibly empty) and the final segment.
		*/
		function pathPartsOf(path) {
			const trimmed = path.replace(/[/\\]+$/, "");
			if (trimmed === "") return {
				directory: "",
				name: path
			};
			const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\")) + 1;
			return {
				directory: trimmed.slice(0, cut),
				name: trimmed.slice(cut)
			};
		}
		/**
		* Address a decoded absolute file path through the authenticated file route.
		* @param base - HTTP(S) application base, including its deployment prefix, or `dsh-app://app/`.
		* @param path - Native file path; URL escapes in authored Markdown must already be decoded.
		* @returns File URL, or undefined for unsupported transports and non-absolute paths.
		*/
		function fileMediaUrl(base, path) {
			if (!/^https?:/u.test(base) && !base.startsWith("dsh-app://app/") || !isAbsoluteWorkspacePath(path) || /^[/\\]{2}/u.test(path) || /[\u0000-\u001f\u007f]/u.test(path)) return void 0;
			return new URL(`api/file?path=${encodeURIComponent(path)}`, base).href;
		}
		//#endregion
		//#region lib/types/client/failure-line.js
		/** Render a byte count the way a person reads one. */
		function humanBytes(bytes) {
			if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
			if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
			return `${bytes} B`;
		}
		/**
		* Say what went wrong, in terms of the file rather than of the transport.
		* @param t - namespace-bound translate.
		* @param failure - the settled Remote failure.
		* @returns the line to show in place of the file.
		*/
		function failureLine(t, failure) {
			switch (failure.code) {
				case "workspace-file/not-found": return t("error.notFound");
				case "workspace-file/too-large": return t("error.tooLarge", { limit: humanBytes(failure.details.limit) });
				case "workspace-file/not-text": return t("error.notText");
				case "workspace-file/not-regular-file": return t("error.notRegularFile");
				default: return t("error.unavailable", { message: failure.message });
			}
		}
		/**
		* Choose the empty state's action for one settled read failure.
		* @param failure - the settled Remote failure.
		* @returns `open` for a readable file this preview cannot render, `none` for a
		* path with nothing to show or open, `retry` for the rest: carrier and
		* unclassified failures a second read may resolve.
		*/
		function emptyFailureRecourse(failure) {
			switch (failure.code) {
				case "workspace-file/not-text":
				case "workspace-file/too-large": return "open";
				case "workspace-file/not-found":
				case "workspace-file/not-regular-file": return "none";
				default: return "retry";
			}
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/LoadingIndicator.module.css.mjs
		const css$9 = ".tKrPPq_loading{box-sizing:border-box;width:100%;height:100%;min-height:0;color:var(--dsw-alias-label-secondary);font-family:var(--dsw-font,sans-serif);font-size:var(--dsh-content-font-size,14px);text-align:center;white-space:normal;flex-direction:column;justify-content:center;align-items:center;gap:12px;padding:24px;line-height:1.5;display:flex}.tKrPPq_inline{vertical-align:middle;flex-direction:row;gap:8px;width:auto;height:auto;padding:0;display:inline-flex}";
		const tagId$9 = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/LoadingIndicator.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$9) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview";
			tag.dataset.pluginCss = tagId$9;
			tag.textContent = css$9;
			document.head.appendChild(tag);
		}
		var LoadingIndicator_module_css_default = {
			"inline": "tKrPPq_inline",
			"loading": "tKrPPq_loading"
		};
		//#endregion
		//#region lib/types/client/LoadingIndicator.js
		/**
		* @param props - localized status label and compact inline placement for additional pages.
		* @returns a centered document loading status or an accessible inline spinner.
		*/
		function LoadingIndicator({ label, inline = false }) {
			return (0, react_jsx_runtime.jsxs)("span", {
				className: clsx(LoadingIndicator_module_css_default.loading, inline && LoadingIndicator_module_css_default.inline),
				role: "status",
				"aria-label": label,
				"data-document-loading": true,
				children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
					state: "ongoing",
					size: inline ? 14 : 28
				}), !inline && (0, react_jsx_runtime.jsx)("span", { children: label })]
			});
		}
		//#endregion
		//#region lib/types/client/rpc.js
		/**
		* The session and path one `dsh-resource://file/…` address names.
		*
		* A `session` address names its own session and a relative or absolute path, so
		* a tab addressed into another session reads from that session. An `absolute`
		* address carries no session and cannot be read here. The registry routes only
		* session-scoped `file` addresses to this type, so an address `parseFileAddress`
		* rejects or that carries no session is a programming error and throws.
		* @param address - a tab's `dsh-resource://file/…` address.
		* @returns the session and the path to hand the endpoint.
		*/
		function hostFileOf(address) {
			const parsed = parseFileAddress(address);
			if (parsed?.scope !== "session") throw new Error(`ui-sidebar-documentpreview: not a session file address "${address}"`);
			return {
				sessionId: parsed.sessionId,
				path: parsed.path
			};
		}
		/**
		* Bind the paged read to one Remote face. The page length is the Host's
		* configured cap, so no `limit` travels.
		* @param remote - the Client Remote carrying the `workspaceFiles` namespace.
		* @returns the read the face performs.
		*/
		function createReadPage(remote) {
			return (sessionId, path, offset, signal) => remote.workspaceFiles.read(sessionId, path, { offset }, signal);
		}
		//#endregion
		//#region lib/types/client/document/suffix.js
		/**
		* Filename suffix matching shared by the preview registry and the owner's
		* unviewable list, so every consumer normalizes paths and suffixes alike.
		*/
		/**
		* Normalize one declared suffix for comparison.
		* @param extension - declared file suffix, with or without a leading dot.
		* @returns the suffix lowercased with any leading dot dropped.
		*/
		function normalizeSuffix(extension) {
			return extension.toLowerCase().replace(/^\./u, "");
		}
		/**
		* The filename a path's suffixes are matched against.
		* @param path - decoded filename or file path; `\` is accepted as a separator.
		* @returns the lowercased final path segment.
		*/
		function documentFileName(path) {
			const normalized = path.replaceAll("\\", "/").toLowerCase();
			return normalized.slice(normalized.lastIndexOf("/") + 1);
		}
		/**
		* The longest declared suffix ending the filename.
		* @param name - lowercased filename from {@link documentFileName}.
		* @param extensions - declared suffixes; compound suffixes such as `tar.gz` are accepted.
		* @returns the matched suffix's normalized length, or 0 when none matches.
		*/
		function matchedSuffixLength(name, extensions) {
			return Math.max(0, ...extensions.map(normalizeSuffix).filter((extension) => name.endsWith(`.${extension}`)).map((extension) => extension.length));
		}
		//#endregion
		//#region lib/types/client/document/registry.js
		/** File-extension preview registrations; component dispatch belongs to the keyed document slot. */
		/**
		* Rank an observed definition snapshot without consulting mutable service state.
		* @param definitions - registered implementations in registration order.
		* @param path - decoded filename or file path.
		* @returns matching implementations, external band first, then longest suffix.
		*/
		function matchingDocumentPreviews(definitions, path) {
			const name = documentFileName(path);
			return definitions.map((definition, order) => ({
				definition,
				order,
				rank: definition.priority === "builtin" ? 0 : 1,
				length: matchedSuffixLength(name, definition.extensions)
			})).filter((candidate) => candidate.length > 0).sort((left, right) => right.rank - left.rank || right.length - left.length || left.order - right.order).map((candidate) => candidate.definition);
		}
		/**
		* Whether any registered implementation declares the filename's suffix binary.
		* @param definitions - registered implementations.
		* @param path - decoded filename or file path.
		* @returns true when a declared binary suffix matches the filename.
		*/
		function binaryDocumentPath(definitions, path) {
			const name = documentFileName(path);
			return definitions.some((definition) => matchedSuffixLength(name, definition.binaryExtensions ?? []) > 0);
		}
		/** Observable registry of all live implementations, including lower-priority alternatives. */
		var DocumentPreviewRegistry = class {
			registered = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			snapshot = [];
			/**
			* Read the current registrations.
			* @returns the same snapshot until a registration changes.
			*/
			getSnapshot = () => this.snapshot;
			/**
			* Observe registration changes.
			* @param listener - registration-change observer.
			* @returns its disposer.
			*/
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			/**
			* Register metadata separately from the matching keyed slot component.
			* @param definition - unique implementation and recognized suffixes; every
			* `binaryExtensions` entry must appear in `extensions`.
			* @returns an idempotent disposer; duplicate live implementation names and
			* binary suffixes outside `extensions` throw.
			*/
			register(definition) {
				if (this.registered.has(definition.id)) throw new Error(`documentPreviews: duplicate implementation "${definition.id}"`);
				const declared = new Set(definition.extensions.map(normalizeSuffix));
				for (const extension of definition.binaryExtensions ?? []) if (!declared.has(normalizeSuffix(extension))) throw new Error(`documentPreviews: "${definition.id}" declares binary suffix "${extension}" outside its extensions`);
				this.registered.set(definition.id, definition);
				this.publish();
				let active = true;
				return () => {
					if (!active) return;
					active = false;
					this.registered.delete(definition.id);
					this.publish();
				};
			}
			/**
			* List every matching implementation in automatic-selection order.
			* @param path - decoded file path; matching never resolves filesystem access.
			* @returns extension band first, then longest suffix, then registration order.
			*/
			candidates(path) {
				return matchingDocumentPreviews(this.snapshot, path);
			}
			publish() {
				this.snapshot = [...this.registered.values()];
				(0, _deepseek_ai_dsh_client_store.notifySubscribers)(this.listeners, "[document-previews] registry");
			}
		};
		//#endregion
		//#region lib/types/client/document/unviewable.js
		/**
		* Known binary container suffixes with no registered renderer. The preview
		* owner shows these the unsupported empty state instead of the plain-text
		* fallback; any renderer registration for a suffix takes precedence because
		* the owner consults this list only when no implementation matches. A suffix
		* belongs here only when its bytes are never readable text — an uncertain
		* suffix stays out and keeps the plain-text fallback.
		*/
		const UNVIEWABLE_BINARY_EXTENSIONS = [
			"mp4",
			"mov",
			"avi",
			"mkv",
			"webm",
			"flv",
			"wmv",
			"m4v",
			"mp3",
			"wav",
			"flac",
			"ogg",
			"m4a",
			"aac",
			"wma",
			"opus",
			"zip",
			"gz",
			"tgz",
			"bz2",
			"xz",
			"zst",
			"7z",
			"rar",
			"tar",
			"jar",
			"doc",
			"docx",
			"xls",
			"xlsx",
export {};
