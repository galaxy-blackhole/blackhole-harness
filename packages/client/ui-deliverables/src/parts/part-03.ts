/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				if (budget === 0) return {
					hunks: kept,
					truncated: true
				};
				kept.push(hunk.lines.length <= budget ? hunk : {
					...hunk,
					lines: hunk.lines.slice(0, budget)
				});
				budget -= Math.min(budget, hunk.lines.length);
			}
			return {
				hunks: kept,
				truncated: hunks.some((hunk, at) => kept[at] !== hunk)
			};
		}
		/** The one-line fact about a text comparison worth stating above its hunks, if any. */
		function noteOf(diff) {
			if (!diff.before) return "diff.created";
			if (!diff.after) return "diff.deleted";
			if (diff.hunks.length === 0) return "diff.unchanged";
		}
		/**
		* Render a file comparison with the same states and highlighting in previews and review tabs.
		* Addition-only and deletion-only comparisons use one column without changing the requested layout.
		* @param props - comparison state, layout choices, retry action, and localized copy.
		* @returns the comparison or its loading, unavailable, or error state.
		*/
		function FileDiff({ state, split, wrap, retry, t }) {
			if (state === void 0 || state === "loading") return (0, react_jsx_runtime.jsx)("p", {
				className: FileDiff_module_css_default.status,
				role: "status",
				children: t("diff.loading")
			});
			if (state === "missing") return (0, react_jsx_runtime.jsx)("p", {
				className: FileDiff_module_css_default.status,
				children: t("diff.missing")
			});
			if (state === "error") return (0, react_jsx_runtime.jsxs)("div", {
				className: FileDiff_module_css_default.status,
				children: [(0, react_jsx_runtime.jsx)("span", { children: t("diff.error") }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					size: "sm",
					onClick: retry,
					children: t("presented.retry")
				})]
			});
			if (state.kind === "binary") return (0, react_jsx_runtime.jsx)("p", {
				className: FileDiff_module_css_default.status,
				children: t("diff.binary")
			});
			if (state.kind === "oversized") return (0, react_jsx_runtime.jsx)("p", {
				className: FileDiff_module_css_default.status,
				children: t("diff.oversized")
			});
			const oneSided = state.hunks.some((hunk) => hunk.lines.some((line) => line.startsWith("+"))) !== state.hunks.some((hunk) => hunk.lines.some((line) => line.startsWith("-")));
			return (0, react_jsx_runtime.jsx)(TextDiff, {
				diff: state,
				split: split && !oneSided,
				wrap,
				t
			});
		}
		/** The kind a paired row carries: a deletion or addition on either side, otherwise context. */
		function splitRowKind(row) {
			return row.left?.kind === "del" ? "del" : row.right?.kind === "add" ? "add" : "context";
		}
		function hunkHeader(hunk) {
			return `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
		}
		/**
		* The side-by-side view without wrapping: two columns that clip their long
		* lines and scroll together on both axes, so a long line on one side never
		* runs under the other and both sides show the same rows and columns of text.
		* Every line is one fixed-height row, which keeps the sides aligned.
		* The columns suppress elastic overscroll while retaining native in-range scrolling.
		*/
		function SplitColumns({ hunks, highlights }) {
			const paired = (0, react.useMemo)(() => hunks.map((hunk) => ({
				header: hunkHeader(hunk),
				rows: splitRows(hunk)
			})), [hunks]);
			const columns = (0, react.useRef)({
				left: null,
				right: null
			});
			const offsets = (0, react.useRef)({
				left: {
					scrollLeft: 0,
					scrollTop: 0
				},
				right: {
					scrollLeft: 0,
					scrollTop: 0
				}
			});
			const follow = (side) => (event) => {
				const peer = side === "left" ? "right" : "left";
				const other = columns.current[peer];
				/* v8 ignore next -- Both column refs are attached before browser scroll events can run. */
				if (other === null) return;
				for (const axis of ["scrollLeft", "scrollTop"]) {
					const value = event.currentTarget[axis];
					if (offsets.current[side][axis] === value) continue;
					offsets.current[side][axis] = value;
					other[axis] = value;
					offsets.current[peer][axis] = other[axis];
				}
			};
			return (0, react_jsx_runtime.jsx)("div", {
				className: FileDiff_module_css_default.columns,
				children: ["left", "right"].map((side) => (0, react_jsx_runtime.jsx)("div", {
					className: FileDiff_module_css_default.column,
					"data-diff-side": side,
					ref: (element) => {
						columns.current[side] = element;
					},
					onScroll: follow(side),
					children: paired.map((hunk, position) => (0, react_jsx_runtime.jsxs)("section", {
						className: FileDiff_module_css_default.hunk,
						children: [(0, react_jsx_runtime.jsx)("div", {
							className: FileDiff_module_css_default.hunkHeader,
							"data-diff-hunk-header": true,
							children: hunk.header
						}), hunk.rows.map((row, at) => {
							const cell = row[side];
							const spans = cell === void 0 ? void 0 : highlights[position]?.[side === "left" ? "old" : "new"]?.get(cell.no);
							return (0, react_jsx_runtime.jsxs)("div", {
								className: `${FileDiff_module_css_default.sideLine} ${cell === void 0 ? FileDiff_module_css_default.empty : FileDiff_module_css_default[cell.kind]}`,
								"data-diff-line": splitRowKind(row),
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: FileDiff_module_css_default.number,
									children: cell?.no ?? ""
								}), (0, react_jsx_runtime.jsx)(DiffText, {
									text: cell?.text ?? "",
									spans
								})]
							}, at);
						})]
					}, position))
				}, side))
			});
		}
		/** The hunks of a text comparison with their line numbers, unified or side by side. */
		function TextDiff({ diff, split, wrap, t }) {
			const note = noteOf(diff);
			const { hunks, truncated } = (0, react.useMemo)(() => renderedHunks(diff.hunks), [diff.hunks]);
			const highlighter = (0, _deepseek_ai_dsh_client_ui_primitives.useCodeHighlighter)((0, _deepseek_ai_dsh_client_ui_primitives.languageForPath)(diff.path));
			const highlights = (0, react.useMemo)(() => hunks.map((hunk) => hunkHighlights(hunk, highlighter)), [hunks, highlighter]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: FileDiff_module_css_default.body,
				"data-review-view": split ? "split" : "unified",
				"data-review-wrap": wrap || void 0,
				children: [
					note !== void 0 && (0, react_jsx_runtime.jsx)("p", {
						className: FileDiff_module_css_default.note,
						"data-diff-note": hunks.length === 0 ? "empty" : "metadata",
						children: t(note)
					}),
					diff.coarse && (0, react_jsx_runtime.jsx)("p", {
						className: FileDiff_module_css_default.note,
						"data-diff-coarse": true,
						children: t("diff.coarse")
					}),
					truncated && (0, react_jsx_runtime.jsx)("p", {
						className: FileDiff_module_css_default.note,
						"data-diff-truncated": true,
						children: t("diff.truncated", { count: String(5e3) })
					}),
					split && !wrap ? (0, react_jsx_runtime.jsx)(SplitColumns, {
						hunks,
						highlights
					}) : hunks.map((hunk, position) => {
						const highlighted = highlights[position];
						return (0, react_jsx_runtime.jsxs)("section", {
							className: FileDiff_module_css_default.hunk,
							children: [(0, react_jsx_runtime.jsx)("div", {
								className: FileDiff_module_css_default.hunkHeader,
								"data-diff-hunk-header": true,
								children: hunkHeader(hunk)
							}), split ? splitRows(hunk).map((row, at) => (0, react_jsx_runtime.jsxs)("div", {
								className: FileDiff_module_css_default.splitLine,
								"data-diff-line": splitRowKind(row),
								children: [(0, react_jsx_runtime.jsxs)("span", {
									className: `${FileDiff_module_css_default.cell} ${row.left === void 0 ? FileDiff_module_css_default.empty : FileDiff_module_css_default[row.left.kind]}`,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: FileDiff_module_css_default.number,
										children: row.left?.no ?? ""
									}), (0, react_jsx_runtime.jsx)(DiffText, {
										text: row.left?.text ?? "",
										spans: row.left === void 0 ? void 0 : highlighted?.old?.get(row.left.no)
									})]
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: `${FileDiff_module_css_default.cell} ${row.right === void 0 ? FileDiff_module_css_default.empty : FileDiff_module_css_default[row.right.kind]}`,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: FileDiff_module_css_default.number,
										children: row.right?.no ?? ""
									}), (0, react_jsx_runtime.jsx)(DiffText, {
										text: row.right?.text ?? "",
										spans: row.right === void 0 ? void 0 : highlighted?.new?.get(row.right.no)
									})]
								})]
							}, at)) : hunkRows(hunk).map((row, at) => (0, react_jsx_runtime.jsxs)("div", {
								className: `${FileDiff_module_css_default.line} ${FileDiff_module_css_default[row.kind]}`,
								"data-diff-line": row.kind,
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: FileDiff_module_css_default.number,
										children: row.old ?? ""
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: FileDiff_module_css_default.number,
										children: row.new ?? ""
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: FileDiff_module_css_default.sign,
										children: row.kind === "add" ? "+" : row.kind === "del" ? "-" : " "
									}),
									(0, react_jsx_runtime.jsx)(DiffText, {
										text: row.text,
										spans: row.kind === "add" ? highlighted?.new?.get(row.new) : highlighted?.old?.get(row.old)
									})
								]
							}, at))]
						}, position);
					})
				]
			});
		}
		//#endregion
		//#region ../../core/session/lib/types/surface.js
		/** Runtime counterpart of the message-producing event union. */
		const SURFACE_EVENT_TYPES = new Set([
			"system/message",
			"developer/message",
			"user/message",
			"assistant/message",
			"tool/result"
		]);
		/**
		* Narrow an event to a surface-eligible event carrying its required marker.
		* @param event - event to test.
		* @returns true when both the type and marker identify a surface event.
		*/
		function isSurfaceEvent(event) {
			if (!SURFACE_EVENT_TYPES.has(event.type)) return false;
			return event.surfaceOp !== void 0;
		}
		/**
		* Narrow an event to an append-origin surface event: one that entered the
		* surface at its own log position and was never itself a replacement copy.
		*
		* The model-visible surface deliberately shadows replaced ranges, so it is the
		* wrong source for a human transcript — a landed replacement would erase
		* conversation the user already saw. Append-origin events are that transcript's
		* durable source material; replacement copies stay model-only.
		* @param event - event to test.
		* @returns true when the event appended to the surface tail.
		*/
		function isAppendSurfaceEvent(event) {
			return isSurfaceEvent(event) && event.surfaceOp === "append";
		}
		//#endregion
		//#region lib/types/client/turn-deliverables.js
		/**
		* Turn-scoped produced-file Definition and readers. Client-only and
		* model-free: produced paths come from successful first-party mutation calls and
		* their recorded file targets, changed files from the Host's recorded git
		* summary, and deliveries from `present`; never from presentation data or
		* the closing prose.
		*/
		/**
		* Extract the path from a supported first-party mutation call. Session
		* `tool/call` events are root calls; PTC dispatch children do not enter this
		* Definition independently.
		* @param name - wire tool name.
		* @param argsRaw - model-produced JSON arguments.
		* @returns the mutation path, or null when the call is not a supported mutation.
		*/
		function mutationPath(name, argsRaw) {
			let args;
			try {
				args = JSON.parse(argsRaw);
			} catch {
				return null;
			}
			if (!isRecord(args)) return null;
			switch (name) {
				case "write": return typeof args.content === "string" ? pathValue(args.file_path) : null;
				case "edit": return validEditArgs(args) ? pathValue(args.file_path) : null;
				case "str_replace_editor": return editorMutationPath(args);
				default: return null;
			}
		}
		/** Validate the fields that an `edit` execution requires. */
		function validEditArgs(args) {
			return typeof args.old_string === "string" && args.old_string.length > 0 && typeof args.new_string === "string" && args.old_string !== args.new_string && (args.replace_all === void 0 || typeof args.replace_all === "boolean");
		}
		/** Extract a path only from a complete mutating editor command. */
		function editorMutationPath(args) {
			const path = pathValue(args.path);
			if (path === null) return null;
			switch (args.command) {
				case "create": return typeof args.file_text === "string" ? path : null;
				case "str_replace": return typeof args.old_str === "string" && args.old_str.length > 0 && (args.new_str === void 0 || typeof args.new_str === "string") ? path : null;
				case "insert": return typeof args.insert_line === "number" && Number.isInteger(args.insert_line) && args.insert_line >= 0 && typeof args.new_str === "string" ? path : null;
				default: return null;
			}
		}
		/** A non-blank path preserves the exact spelling supplied to the tool. */
		function pathValue(value) {
			return typeof value === "string" && value.trim().length > 0 ? value : null;
		}
		/** Resolve a settled mutation from recorded metadata, retaining legacy argument paths. */
		function mutationResultPath(argumentPath, meta) {
			if (!isRecord(meta) || !Object.hasOwn(meta, "path")) return argumentPath;
			if (typeof meta.path === "string" && isAbsoluteWorkspacePath(meta.path)) return meta.path;
			return isAbsoluteWorkspacePath(argumentPath) ? argumentPath : null;
		}
		/** Narrow parsed JSON to an argument object. */
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/**
		* Files produced by one Turn data value.
		*
		* The source is successful `write`, `edit`, and mutating `str_replace_editor`
		* calls and their recorded absolute targets; legacy results use arguments. A produced file must be
		* listed whether or not the model remembered to name it. Reads, unsupported
		* tools, malformed calls, and failed results contribute nothing. Paths keep
		* first-seen order and appear once, so a file written and then edited in the
		* same turn is one entry.
		*
		* The Conversation Location index owns turn membership before this function
		* runs, so paths cannot spill across turns and this derivation does not infer
		* boundaries from neighboring presentation Nodes.
		* @param data - engine-published Deliverables data for one Turn.
		* @param seq - closing Assistant seq; later Tool settlements are excluded.
		* @returns Produced paths in first-seen order; empty when the turn wrote nothing.
		*/
		function producedForClosing(data, seq = Number.POSITIVE_INFINITY) {
			if (data === void 0) return [];
			const paths = [];
			const seen = /* @__PURE__ */ new Set();
			for (const produced of data.produced) {
				if (produced.seq > seq || seen.has(produced.path)) continue;
				seen.add(produced.path);
				paths.push(produced.path);
			}
			return paths;
		}
		/**
		* Claim the turn-tail chain only when its closing turn produced files.
		* @param owner - Turn-tail owner currency for the closing assistant.
		* @returns Produced paths as the component's match, or null to decline before mount.
		*/
		function selectProducedFiles(owner) {
			const paths = producedForClosing(owner.turn.data.get("deliverables"), owner.seq);
			return paths.length === 0 ? null : paths;
		}
		/** Turn-local successful mutation accumulator; it publishes no view Node. */
		const deliverablesDefinition = {
			kind: "deliverables",
			match: (event) => {
				if (event.type === "turn/start") return {
					id: String(event.data.turn),
					role: "start"
				};
				if (event.type === "tool/call") return {
					id: String(event.data.turn),
					role: "update"
				};
				if (event.type === "deliverables/presented") return isPresentedData(event.data) ? {
					id: String(event.data.turn),
					role: "update"
				} : null;
				if (event.type === "workspace/changes") return isChangesEvent(event.data) ? {
					id: String(event.data.turn),
					role: "update"
				} : null;
				if (event.type === "tool/result" && isAppendSurfaceEvent(event)) return {
					id: String(event.data.turn),
					role: "update"
				};
				return null;
			},
			start: (_context, match) => {
				if (match.event.type !== "turn/start") throw new Error("deliverables start requires turn/start");
				return {
					turn: match.event.data.turn,
					calls: /* @__PURE__ */ new Map(),
					produced: []
				};
			},
			update: (context, match) => {
				if (match.event.type === "workspace/changes") return {
					...context.state,
					changes: { seq: match.event.seq }
				};
				if (match.event.type === "deliverables/presented") {
					const { files } = match.event.data;
					const seq = match.event.seq;
export {};
