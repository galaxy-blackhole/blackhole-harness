/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				const task = this.readHost(AbortSignal.any([this.lifetime.signal, this.metadata.signal]));
				this.loading = task;
				this.pending.add(task);
				try {
					await task;
				} finally {
					if (this.loading === task) this.loading = void 0;
					this.pending.delete(task);
				}
			}
			/** Invalidate desktop metadata on connection replacement; mounted cards request the new Host. */
			resetHost() {
				const wasLoading = this.loading !== void 0;
				this.metadata.abort();
				this.metadata = new AbortController();
				this.loading = void 0;
				this.host.set(null);
				if (wasLoading) this.loadHost();
			}
			async readHost(signal) {
				let host = "error";
				try {
					const response = await fetch(PRESENT_HOST_ROUTE, { signal });
					if (response.ok) {
						const value = await response.json();
						if (isPresentedHost(value)) host = value;
					}
				} catch {
					host = "error";
				}
				if (!signal.aborted) this.host.set(host);
			}
			/** Cancel outstanding requests and wait until no request can publish state. */
			async dispose() {
				this.lifetime.abort();
				for (const url of this.expiry.keys()) this.clearExpiry(url);
				await Promise.all(this.pending);
			}
			clearExpiry(url) {
				clearTimeout(this.expiry.get(url));
				this.expiry.delete(url);
			}
			async request(url, action, application) {
				const failure = action === "open" ? "error" : "revealError";
				let phase = action === "open" ? "opened" : "revealed";
				try {
					const target = action === "reveal" ? `${url}&action=reveal` : application === void 0 ? url : `${url}&application=${encodeURIComponent(application)}`;
					const response = await fetch(target, {
						method: "POST",
						signal: this.lifetime.signal
					});
					if (!response.ok) phase = response.status === 422 ? "nativeUnavailable" : failure;
				} catch {
					phase = failure;
				}
				if (!this.lifetime.signal.aborted) {
					if (phase === "opened" || phase === "revealed") this.expiry.set(url, setTimeout(() => {
						this.expiry.delete(url);
						this.state.update((state) => {
							Reflect.deleteProperty(state, url);
						});
					}, 5200));
					this.state.update((state) => {
						state[url] = phase;
					});
				}
				return phase === "opened" || phase === "revealed" ? null : action === "reveal" ? "revealError" : "openError";
			}
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-deliverables/src/client/PresentRow.module.css.mjs
		const css$4 = "._93YTAG_summary{min-width:0;color:inherit;align-items:center;gap:8px;margin-left:8px;font-size:12px;display:flex}._93YTAG_summary>:first-child{flex-shrink:0}._93YTAG_paths{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}._93YTAG_output{border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0;padding:12px;font-size:12px}._93YTAG_inspect{color:var(--dsw-alias-link);font:inherit;cursor:pointer;background:0 0;border:none;align-self:flex-start;padding:4px 0;font-size:12px}";
		const tagId$4 = "@deepseek-ai/dsh-client-ui-deliverables/PresentRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-deliverables";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var PresentRow_module_css_default = {
			"inspect": "_93YTAG_inspect",
			"output": "_93YTAG_output",
			"paths": "_93YTAG_paths",
			"summary": "_93YTAG_summary"
		};
		//#endregion
		//#region lib/types/client/PresentRow.js
		/** Present call status and expandable durable result text. */
		/* v8 ignore next -- Non-expandable rows never invoke DisclosureRow's required toggle callback. */
		const noop = () => void 0;
		/** Raw arguments can be partial while a call is streaming. */
		function fileNames(raw) {
			let args;
			try {
				args = JSON.parse(raw);
			} catch {
				return raw;
			}
			if (typeof args !== "object" || args === null || !("files" in args) || !Array.isArray(args.files)) return raw;
			return args.files.flatMap((file) => typeof file === "object" && file !== null && "path" in file && typeof file.path === "string" ? [file.path] : []).join(", ");
		}
		/**
		* Render a present call using its recorded arguments and result.
		* @param props - tool call and localized status copy.
		* @returns a status row with a result disclosure.
		*/
		function PresentRow(props) {
			return props.phase === "preparing" ? (0, react_jsx_runtime.jsx)(PreparingPresentRow, { ...props }) : (0, react_jsx_runtime.jsx)(StartedPresentRow, { ...props });
		}
		function PreparingPresentRow({ t }) {
			return (0, react_jsx_runtime.jsx)("div", {
				"data-tool": "present",
				"data-state": "preparing",
				"aria-label": t("row.preparing"),
				children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
					title: t("row.title"),
					icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDeliverDocRegular, { size: 14 }),
					open: false,
					expandable: false,
					onToggle: noop,
					running: true
				})
			});
		}
		function StartedPresentRow({ block, inspect, t }) {
			const settled = "kind" in block;
			const state = !settled ? "running" : block.error?.code === "interrupted" ? "stopped" : block.isError ? "error" : "ok";
			const args = (settled ? block.call?.argsRaw : block.argsRaw) ?? "";
			const details = (settled ? block.content.map((item) => item.type === "text" ? item.text : JSON.stringify(item)).join("\n") : "") || (settled && block.error ? `${block.error.name}: ${block.error.code}` : "");
			const [expanded, setExpanded] = (0, react.useState)(false);
			return (0, react_jsx_runtime.jsx)("div", {
				"data-tool": "present",
				"data-state": state,
				children: (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
					title: t("row.title"),
					icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDeliverDocRegular, { size: 14 }),
					open: expanded && details !== "",
					expandable: details !== "",
					expandOnRowClick: true,
					keepContentWhenOpen: true,
					onToggle: () => {
						setExpanded((value) => !value);
					},
					collapsedContent: (0, react_jsx_runtime.jsxs)("span", {
						className: PresentRow_module_css_default.summary,
						children: [(0, react_jsx_runtime.jsx)("span", { children: t(`row.${state}`) }), (0, react_jsx_runtime.jsx)("span", {
							className: PresentRow_module_css_default.paths,
							children: fileNames(args)
						})]
					}),
					children: [(0, react_jsx_runtime.jsx)("pre", {
						className: PresentRow_module_css_default.output,
						children: details
					}), inspect && (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: PresentRow_module_css_default.inspect,
						onClick: inspect,
						children: t("row.inspect")
					})]
				})
			});
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
		* Resolve a Workspace-relative path into the Host-facing spelling used by path operations.
		* @param cwd - Session Workspace root, when known.
		* @param path - Absolute or Workspace-relative path.
		* @returns an absolute path when a Workspace root is available, otherwise the original path.
		*/
		function resolveWorkspacePath(cwd, path) {
			if (isAbsoluteWorkspacePath(path)) return path;
			if (cwd === void 0 || cwd === "") return path;
			const separator = isWindowsStylePath(cwd) && cwd.includes("\\") ? "\\" : "/";
			return `${cwd.replace(/[/\\]+$/, "")}${separator}${path.replace(/^[/\\]+/, "")}`;
		}
		/**
		* The address for a path as a caller holds it: a relative path, or an absolute
		* path inside the Session's workspace, becomes a `session`-scoped address; an
		* absolute path outside it, or one whose workspace root is unknown, keeps its
		* absolute path in that Session's address.
		* @param sessionId - the Session the path is read in.
		* @param cwd - that Session's workspace root, when known.
		* @param path - absolute or workspace-relative path, in either separator spelling.
		* @returns the `dsh-resource://file/…` address.
		*/
		function fileAddressFor(sessionId, cwd, path) {
			const normalized = path.replace(/\\/g, "/");
			if (!isAbsoluteWorkspacePath(normalized)) return sessionFileAddress(sessionId, normalized);
			const root = cwd === void 0 ? "" : cwd.replace(/\\/g, "/").replace(/\/+$/, "");
			if (root !== "" && normalized === root) return sessionFileAddress(sessionId, "");
			if (root !== "" && normalized.startsWith(`${root}/`)) return sessionFileAddress(sessionId, normalized.slice(root.length + 1));
			return sessionFileAddress(sessionId, normalized);
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-deliverables/src/client/FileDiff.module.css.mjs
		const css$3 = ".IP6KhG_root{--diff-empty-fill:color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 50%, transparent);box-sizing:border-box;width:100%;min-height:0;color:var(--dsw-alias-label-primary);flex-direction:column;display:flex}.IP6KhG_header{box-sizing:border-box;border-bottom:.5px solid var(--dsw-alias-border-l3);flex:none;align-items:center;gap:6px;height:38px;padding:0 6px 0 8px;display:flex}.IP6KhG_status{color:var(--dsw-alias-label-secondary);align-items:center;gap:12px;margin:0;padding:16px;font-size:13px;display:flex}.IP6KhG_body{min-height:0;font:var(--dsw-font-markdown-code-block);flex-direction:column;flex:auto;padding:8px 0 16px;display:flex;overflow:auto}.IP6KhG_columns{flex:auto;grid-template-columns:minmax(0,1fr) minmax(0,1fr);min-height:0;display:grid}.IP6KhG_column,.IP6KhG_body[data-review-view=unified]:not([data-review-wrap]){grid-template-columns:minmax(max-content,100%);align-content:start;display:grid}.IP6KhG_column{overscroll-behavior:none;min-width:0;overflow-x:scroll}.IP6KhG_column+.IP6KhG_column{border-left:.5px solid var(--dsw-alias-border-l3)}.IP6KhG_sideLine{box-sizing:border-box;white-space:pre;grid-template-columns:3.5em max-content;width:max-content;min-width:100%;min-height:22px;line-height:22px;display:grid}.IP6KhG_note{font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-tertiary);margin:0;padding:4px 16px 8px}.IP6KhG_hunk{margin-bottom:8px}.IP6KhG_hunkHeader{color:var(--dsw-alias-label-tertiary);white-space:pre;padding:4px 16px}.IP6KhG_line{box-sizing:border-box;white-space:pre;grid-template-columns:3.5em 3.5em 1.2em minmax(0,1fr);min-height:22px;line-height:22px;display:grid}.IP6KhG_splitLine{white-space:pre;grid-template-columns:minmax(0,1fr) minmax(0,1fr);min-height:22px;line-height:22px;display:grid}.IP6KhG_cell{box-sizing:border-box;grid-template-columns:3.5em minmax(0,1fr);min-width:0;display:grid}.IP6KhG_cell+.IP6KhG_cell{border-left:.5px solid var(--dsw-alias-border-l3)}.IP6KhG_number{color:var(--dsw-alias-label-tertiary);text-align:right;user-select:none;padding-right:8px}.IP6KhG_sign{text-align:center;user-select:none}.IP6KhG_text{padding-right:16px}.IP6KhG_body[data-review-wrap] .IP6KhG_line,.IP6KhG_body[data-review-wrap] .IP6KhG_splitLine{white-space:pre-wrap}.IP6KhG_body[data-review-wrap] .IP6KhG_text{overflow-wrap:anywhere}.IP6KhG_add{--diff-gutter-fill:var(--dsw-alias-file-diff-added-gutter);--diff-marker:var(--dsw-alias-file-diff-added-marker);background:var(--dsw-alias-file-diff-added-bg)}.IP6KhG_del{--diff-gutter-fill:var(--dsw-alias-file-diff-deleted-gutter);--diff-marker:var(--dsw-alias-file-diff-deleted-marker);background:var(--dsw-alias-file-diff-deleted-bg)}.IP6KhG_add .IP6KhG_number,.IP6KhG_del .IP6KhG_number{background:var(--diff-gutter-fill);color:var(--diff-marker)}.IP6KhG_add .IP6KhG_number:first-child,.IP6KhG_del .IP6KhG_number:first-child{box-shadow:inset 3px 0 0 var(--diff-marker)}.IP6KhG_add .IP6KhG_sign,.IP6KhG_del .IP6KhG_sign{color:var(--diff-marker)}.IP6KhG_context .IP6KhG_text{color:var(--dsw-alias-label-secondary)}.IP6KhG_empty{background:var(--diff-empty-fill)}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-deliverables/FileDiff.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-deliverables";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var FileDiff_module_css_default = {
			"add": "IP6KhG_add",
			"body": "IP6KhG_body",
			"cell": "IP6KhG_cell",
			"column": "IP6KhG_column",
			"columns": "IP6KhG_columns",
			"context": "IP6KhG_context",
			"del": "IP6KhG_del",
			"empty": "IP6KhG_empty",
			"header": "IP6KhG_header",
			"hunk": "IP6KhG_hunk",
			"hunkHeader": "IP6KhG_hunkHeader",
			"line": "IP6KhG_line",
			"note": "IP6KhG_note",
			"number": "IP6KhG_number",
			"root": "IP6KhG_root",
			"sideLine": "IP6KhG_sideLine",
			"sign": "IP6KhG_sign",
			"splitLine": "IP6KhG_splitLine",
			"status": "IP6KhG_status",
			"text": "IP6KhG_text"
		};
		//#endregion
		//#region lib/types/client/FileDiff.js
		/** Shared file comparison for the turn-tail hover preview and Sidebar review. */
		/** Maximum rendered lines per comparison. */
		const MAX_RENDERED_LINES = 5e3;
		function highlightedSide(rows, side, highlighter) {
			const source = rows.flatMap((row) => {
				const no = row[side];
				return no === void 0 ? [] : [{
					no,
					text: row.text
				}];
			});
			if (source.length === 0) return /* @__PURE__ */ new Map();
			const highlighted = highlighter(source.map((line) => line.text).join("\n"));
			if (highlighted === void 0) return void 0;
			return new Map(source.map((line, index) => {
				return [line.no, highlighted[index] ?? []];
			}));
		}
		function hunkHighlights(hunk, highlighter) {
			const rows = hunkRows(hunk);
			return {
				old: highlightedSide(rows, "old", highlighter),
				new: highlightedSide(rows, "new", highlighter)
			};
		}
		function DiffText({ text, spans }) {
			return (0, react_jsx_runtime.jsx)("span", {
				className: FileDiff_module_css_default.text,
				"data-diff-code": spans === void 0 ? void 0 : "",
				children: spans === void 0 ? text : spans.map((span, index) => (0, react_jsx_runtime.jsx)("span", {
					style: span.style,
					children: span.text
				}, index))
			});
		}
		/**
		* Number a hunk's lines: context lines count on both sides, deletions on the
		* old side, additions on the new side.
		* @param hunk - a served hunk.
		* @returns the rows in order.
		*/
		function hunkRows(hunk) {
			let oldNo = hunk.oldStart;
			let newNo = hunk.newStart;
			return hunk.lines.map((line) => {
				const text = line.slice(1);
				switch (line[0]) {
					case "+": return {
						kind: "add",
						old: void 0,
						new: newNo++,
						text
					};
					case "-": return {
						kind: "del",
						old: oldNo++,
						new: void 0,
						text
					};
					default: return {
						kind: "context",
						old: oldNo++,
						new: newNo++,
						text
					};
				}
			});
		}
		/**
		* Pair a hunk's lines for the side-by-side view: each run of deletions is
		* aligned with the run of additions that follows it, row by row, and context
		* lines sit on both sides.
		* @param hunk - a served hunk.
		* @returns the rows in order.
		*/
		function splitRows(hunk) {
			const rows = [];
			let dels = [];
			let adds = [];
			const flush = () => {
				for (let at = 0; at < Math.max(dels.length, adds.length); at += 1) {
					const left = dels[at];
					const right = adds[at];
					rows.push({
						...left === void 0 ? {} : { left },
						...right === void 0 ? {} : { right }
					});
				}
				dels = [];
				adds = [];
			};
			for (const row of hunkRows(hunk)) if (row.kind === "del") dels.push({
				no: row.old,
				text: row.text,
				kind: "del"
			});
			else if (row.kind === "add") adds.push({
				no: row.new,
				text: row.text,
				kind: "add"
			});
			else {
				flush();
				rows.push({
					left: {
						no: row.old,
						text: row.text,
						kind: "context"
					},
					right: {
						no: row.new,
						text: row.text,
						kind: "context"
					}
				});
			}
			flush();
			return rows;
		}
		/**
		* The hunks to draw, cut at {@link MAX_RENDERED_LINES} lines in total.
		* @param hunks - served hunks.
		* @returns the hunks with the last one shortened as needed, and whether anything was cut.
		*/
		function renderedHunks(hunks) {
			let budget = MAX_RENDERED_LINES;
			const kept = [];
			for (const hunk of hunks) {
export {};
