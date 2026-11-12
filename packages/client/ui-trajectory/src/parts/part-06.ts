/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-trajectory/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/TrajectoryTable.js
		/** Turn-aware trajectory event ledger with a local record inspector. */
		const BOTTOM_FOLLOW_THRESHOLD_PX = 2;
		const OLDER_LOAD_THRESHOLD_PX = 48;
		const HISTORY_LOAD_ROW_HEIGHT_PX = 30;
		const VIRTUALIZATION_THRESHOLD = 100;
		const VIRTUAL_OVERSCAN_ROWS = 12;
		const VIRTUAL_INITIAL_VIEWPORT_HEIGHT_PX = 600;
		const KIND_LABEL_KEY = {
			system: "kind.system",
			user: "kind.user",
			context: "kind.context",
			compacted: "kind.compacted",
			message: "kind.assistant",
			tool: "kind.tool",
			subtool: "kind.subtool"
		};
		function ToolWrenchIcon() {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: "13",
				height: "13",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"data-role-icon": "wrench",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)("path", { d: "M14 3.3a3.8 3.8 0 0 1-4.8 4.8l-5.1 5.1a1.6 1.6 0 1 1-2.3-2.3l5.1-5.1A3.8 3.8 0 0 1 11.7 1l-2.3 2.3 2.3 2.3L14 3.3Z" })
			});
		}
		function InformationIcon() {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.4",
				strokeLinecap: "round",
				"data-role-icon": "information",
				"aria-hidden": "true",
				children: [
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "8",
						cy: "8",
						r: "6.7"
					}),
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "8",
						cy: "5.5",
						r: ".85",
						fill: "currentColor",
						stroke: "none"
					}),
					(0, react_jsx_runtime.jsx)("path", {
						d: "M8 7.75v3.4",
						strokeWidth: "1.8"
					})
				]
			});
		}
		function CompactedIcon() {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: "13",
				height: "13",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"data-role-icon": "compacted",
				"aria-hidden": "true",
				children: [
					(0, react_jsx_runtime.jsx)("path", { d: "m2.5 2.5 3.75 3.75M3 6.25h3.25V3" }),
					(0, react_jsx_runtime.jsx)("path", { d: "m13.5 2.5-3.75 3.75M13 6.25H9.75V3" }),
					(0, react_jsx_runtime.jsx)("path", { d: "m2.5 13.5 3.75-3.75M3 9.75h3.25V13" }),
					(0, react_jsx_runtime.jsx)("path", { d: "m13.5 13.5-3.75-3.75M13 9.75H9.75V13" })
				]
			});
		}
		const KIND_ICON = {
			system: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutlineRegular, { size: 13 }),
			user: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUserOutlineRegular, { size: 13 }),
			context: (0, react_jsx_runtime.jsx)(InformationIcon, {}),
			compacted: (0, react_jsx_runtime.jsx)(CompactedIcon, {}),
			message: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkleRegular, { size: 13 }),
			tool: (0, react_jsx_runtime.jsx)(ToolWrenchIcon, {}),
			subtool: (0, react_jsx_runtime.jsx)(ToolWrenchIcon, {})
		};
		function useStableVirtualRowStructure(rows) {
			const cache = (0, react.useRef)({
				rows: [],
				structure: []
			});
			if (cache.current.rows === rows) return cache.current.structure;
			const structure = cache.current.structure.length === rows.length && rows.every((row, index) => {
				const previous = cache.current.structure[index];
				return previous?.key === row.key && previous.height === row.height;
			}) ? cache.current.structure : rows.map((row) => ({
				key: row.key,
				height: row.height
			}));
			cache.current = {
				rows,
				structure
			};
			return structure;
		}
		const DETAILS_MIN_WIDTH = 320;
		const DETAILS_MAX_WIDTH = 720;
		const TABLE_MIN_WIDTH = 280;
		const DETAILS_RESIZE_STEP = 16;
		const TOOL_REQUEST_SHARE = .58;
		const TOOL_REQUEST_MIN_WIDTH = 180;
		const TOOL_REQUEST_MAX_WIDTH = 480;
		const DEFAULT_TOOL_REQUEST_SHARE = .36;
		const DEFAULT_TOOL_REQUEST_OFFSET = 56;
		const SYSTEM_PROMPT_TABS = [{
			id: "system-prompt",
			labelKey: "tab.systemPrompt"
		}, {
			id: "tools",
			labelKey: "tab.tools"
		}];
		const SYSTEM_UPDATE_TABS = [{
			id: "diff",
			labelKey: "tab.diff"
		}, ...SYSTEM_PROMPT_TABS];
		const REQUEST_TABS = [
			{
				id: "overview",
				labelKey: "tab.summary"
			},
			{
				id: "options",
				labelKey: "tab.options"
			},
			{
				id: "usage",
				labelKey: "tab.usage"
			},
			{
				id: "timing",
				labelKey: "tab.timing"
			}
		];
		function jsonTreeLabels(t) {
			return {
				copyValue: t("copy.value"),
				copyJson: t("copy.json"),
				copyPath: t("copy.path"),
				copyPrettyJson: t("copy.prettyJson"),
				copyCompactJson: t("copy.compactJson"),
				copied: t("copied"),
				copyFailed: t("copy.failed"),
				collapseNode: t("collapse"),
				expandNode: t("expand"),
				copyButtonTitle: (action) => t("copy.optionsHint", { action })
			};
		}
		function markdownLabels(t) {
			return {
				code: {
					copyLabel: t("copy"),
					copiedLabel: t("copied")
				},
				footnotes: t("markdown.footnotes")
			};
		}
		function clampDetailsWidth(width, splitWidth) {
			const maxWidth = Math.max(DETAILS_MIN_WIDTH, Math.min(DETAILS_MAX_WIDTH, splitWidth - TABLE_MIN_WIDTH));
			return Math.round(Math.min(Math.max(width, DETAILS_MIN_WIDTH), maxWidth));
		}
		function defaultToolRequestWidth(splitWidth) {
			return Math.min(Math.max(splitWidth * DEFAULT_TOOL_REQUEST_SHARE - DEFAULT_TOOL_REQUEST_OFFSET, TOOL_REQUEST_MIN_WIDTH), TOOL_REQUEST_MAX_WIDTH);
		}
		function formatDurationMs(milliseconds, t) {
			if (milliseconds < 1e3) return t("unit.milliseconds", { value: Math.round(milliseconds) });
			return t("unit.seconds", { value: (milliseconds / 1e3).toFixed(milliseconds < 1e4 ? 2 : 1) });
		}
		function formatStartedAt(timestamp, t) {
			if (timestamp === null || !Number.isFinite(timestamp)) return t("timing.notAvailable");
			const date = new Date(timestamp);
			const two = (value) => String(value).padStart(2, "0");
			const three = (value) => String(value).padStart(3, "0");
			const time = `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}.${three(date.getMilliseconds())}`;
			return `${`${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`} ${time}`;
		}
		/** Whether a click lands on an active text selection and should keep it. */
		function clickSelectsText(target) {
			const selection = window.getSelection();
			return selection !== null && !selection.isCollapsed && selection.rangeCount > 0 && selection.getRangeAt(0).intersectsNode(target);
		}
		function StartedAtValue({ timestamp, t }) {
			const [showUnix, setShowUnix] = (0, react.useState)(false);
			if (timestamp === null || !Number.isFinite(timestamp)) return (0, react_jsx_runtime.jsx)("dd", { children: t("timing.notAvailable") });
			return (0, react_jsx_runtime.jsx)("dd", { children: (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: TrajectoryTable_module_css_default.timestampToggle,
				title: showUnix ? t("timing.showLocalTime") : t("timing.showUnixTimestamp"),
				onClick: (event) => {
					if (clickSelectsText(event.currentTarget)) return;
					setShowUnix((current) => !current);
				},
				children: showUnix ? (timestamp / 1e3).toFixed(3) : formatStartedAt(timestamp, t)
			}) });
		}
		function totalTime(metrics, t) {
			if (!metrics.timingRecorded) return t("timing.notRecorded");
			if (metrics.stepStartTime === null) return t("timing.stepStartUnavailable");
			if (metrics.completedTime === null) return t("status.pending");
			return formatDurationMs(Math.max(0, metrics.completedTime - metrics.stepStartTime), t);
		}
		function ttft(metrics, t) {
			if (!metrics.timingRecorded) return t("timing.notRecorded");
			if (metrics.stepStartTime === null) return t("timing.stepStartUnavailable");
			if (metrics.firstTokenTime === null) return t("timing.firstTokenUnavailable");
			return formatDurationMs(Math.max(0, metrics.firstTokenTime - metrics.stepStartTime), t);
		}
		function generationTime(metrics, t) {
			if (!metrics.timingRecorded || metrics.firstTokenTime === null) return t("timing.firstTokenUnavailable");
			if (metrics.completedTime === null) return t("status.pending");
			return formatDurationMs(Math.max(0, metrics.completedTime - metrics.firstTokenTime), t);
		}
		function throughput(metrics, t) {
			if (!metrics.usageProvided) return t("timing.usageUnavailable");
			if (metrics.outputTokens === null) return t("timing.outputTokensUnavailable");
			if (!metrics.timingRecorded || metrics.firstTokenTime === null) return t("timing.firstTokenUnavailable");
			if (metrics.completedTime === null) return t("status.pending");
			const generationSeconds = (metrics.completedTime - metrics.firstTokenTime) / 1e3;
			if (generationSeconds <= 0) return t("timing.durationTooShort");
			return t("unit.tokensPerSecond", { value: (metrics.outputTokens / generationSeconds).toFixed(1) });
		}
		function AssistantTimingPanel({ metrics, t }) {
			return (0, react_jsx_runtime.jsxs)("dl", {
				className: TrajectoryTable_module_css_default.overview,
				children: [
					(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.started") }), (0, react_jsx_runtime.jsx)(StartedAtValue, {
						timestamp: metrics.stepStartTime,
						t
					})] }),
					(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.totalDuration") }), (0, react_jsx_runtime.jsx)("dd", { children: totalTime(metrics, t) })] }),
					(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.ttft") }), (0, react_jsx_runtime.jsx)("dd", { children: ttft(metrics, t) })] }),
					(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.generation") }), (0, react_jsx_runtime.jsx)("dd", { children: generationTime(metrics, t) })] }),
					(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.throughput") }), (0, react_jsx_runtime.jsx)("dd", { children: throughput(metrics, t) })] })
				]
			});
		}
		function flattenRecords(turns) {
			return turns.flatMap((turn, section) => {
				let firstInSection = true;
				const records = turn.groups.flatMap((group) => {
					return group.cells.map((cell, index) => {
						const turnStart = firstInSection && cell.requestOnly !== true && cell.kind !== "system" && (cell.kind !== "compacted" || turn.turn === null);
						if (turnStart) firstInSection = false;
						return {
							turn: turn.turn,
							section,
							group: group.title,
							groupStart: index === 0,
							turnStart,
							cell,
							turnEnd: false
						};
					});
				});
				const last = records.at(-1);
				if (last !== void 0) last.turnEnd = true;
				return records;
			});
		}
		function filterRecords(records, matches) {
			const filtered = records.filter((record) => record.cell.requestOnly !== true && matches.has(record.cell.index)).map((record) => ({
				...record,
				groupStart: false,
				turnStart: false,
				turnEnd: false
			}));
			const startedSections = /* @__PURE__ */ new Set();
			for (const [index, record] of filtered.entries()) {
				const previous = filtered[index - 1];
				const next = filtered[index + 1];
				record.groupStart = previous === void 0 || previous.section !== record.section || previous.group !== record.group;
				record.turnStart = !startedSections.has(record.section) && record.cell.kind !== "system" && (record.cell.kind !== "compacted" || record.turn === null);
				if (record.turnStart) startedSections.add(record.section);
				record.turnEnd = next === void 0 || next.section !== record.section;
			}
			return filtered;
		}
		function requestKey(turn, group) {
			return `${turn}\u0000${group}`;
		}
		function requestIdentity(request) {
			return request.purpose === "compaction" ? `compaction\u0000${request.seq}` : `assistant\u0000${request.turn}\u0000${request.step}`;
		}
		function indexRequestBoundaries(records, requestGroups) {
			const boundaries = /* @__PURE__ */ new Map();
			for (const record of records) {
				const key = requestKey(record.turn, record.group);
				if (!requestGroups.has(key)) continue;
				if (boundaries.has(key)) continue;
				if (record.cell.kind === "user" || record.cell.kind === "context") continue;
				boundaries.set(key, record.cell.index);
			}
			return boundaries;
		}
		function sectionLabel(turn, t) {
			return turn === null ? t("section.betweenTurns") : t("turn.label", { turn });
		}
		function indexRequestNumbers(sessionNumbers) {
			const numbers = /* @__PURE__ */ new Map();
			for (const request of sessionNumbers ?? []) numbers.set(requestKey(request.turn, request.group), request.number);
			return numbers;
		}
		function indexRequestBoundaryRuns(records, requestGroups) {
			const indexes = /* @__PURE__ */ new Map();
			let runLength = 0;
			for (const record of records) {
				if (record.cell.requestOnly === true) {
					indexes.set(record.cell.index, runLength++);
					continue;
				}
				if (runLength > 0 && record.groupStart && requestGroups.has(requestKey(record.turn, record.group))) indexes.set(record.cell.index, runLength);
				runLength = 0;
			}
			return indexes;
		}
		function summarizeTurn(records, requestGroups, t) {
			const steps = new Set(records.map((record) => requestKey(record.turn, record.group)).filter((key) => requestGroups.has(key))).size;
			const toolCalls = records.filter((record) => record.cell.kind === "tool" || record.cell.kind === "subtool").length;
			return [t(steps === 1 ? "summary.steps.one" : "summary.steps.other", { count: steps }), t(toolCalls === 1 ? "summary.toolCalls.one" : "summary.toolCalls.other", { count: toolCalls })].join(" · ");
		}
		function collapseTurnRecords(records, collapsedTurns, requestGroups, t) {
			const recordsByTurn = /* @__PURE__ */ new Map();
			for (const record of records) {
				if (record.turn === null) continue;
				const turnRecords = recordsByTurn.get(record.turn) ?? [];
				turnRecords.push(record);
				recordsByTurn.set(record.turn, turnRecords);
			}
			return records.flatMap((record) => {
				if (record.turn === null || !collapsedTurns.has(record.turn)) return [record];
				const turnRecords = recordsByTurn.get(record.turn) ?? [record];
				if (record.cell.requestOnly === true || record.cell.kind === "system") return [record];
				const contentRecords = turnRecords.filter((candidate) => candidate.cell.requestOnly !== true && candidate.cell.kind !== "system");
				if (contentRecords.length <= 1) return [record];
				if (record.cell.index !== contentRecords[0]?.cell.index) return [];
				return [{
					...record,
					turnEnd: false
				}, {
					...record,
					groupStart: false,
					turnStart: false,
					turnEnd: true,
					collapsedSummary: summarizeTurn(contentRecords.slice(1), requestGroups, t),
					collapsedSummaryKind: "turn"
				}];
			});
		}
		function assistantToolCalls(records, assistantIndex) {
			const at = records.findIndex((record) => record.cell.index === assistantIndex);
			if (at === -1 || records[at]?.cell.kind !== "message") return [];
			const calls = [];
			for (let i = at + 1; i < records.length; i++) {
				const record = records[i];
				if (record === void 0) break;
				if (record.cell.kind !== "tool" && record.cell.kind !== "subtool") break;
				calls.push(record);
			}
			return calls;
		}
		function summarizeAssistantTools(records, t) {
			const names = [...new Set(records.map((record) => {
				const separator = record.cell.text.indexOf(" · ");
				return separator === -1 ? record.cell.text : record.cell.text.slice(0, separator);
			}).filter((name) => name !== ""))];
			const count = records.length;
			const summary = t(count === 1 ? "summary.toolCalls.one" : "summary.toolCalls.other", { count });
			return names.length > 0 ? `${summary} · ${names.join(", ")}` : summary;
		}
		function collapseAssistantRecords(records, collapsedAssistants, t) {
			const out = [];
			for (let i = 0; i < records.length; i++) {
				const record = records[i];
				if (record === void 0) continue;
				out.push(record);
				if (record.cell.kind !== "message" || !collapsedAssistants.has(trajectoryRecordId(record.cell))) continue;
				const calls = [];
				for (let j = i + 1; j < records.length; j++) {
					const candidate = records[j];
					if (candidate === void 0 || candidate.collapsedSummary !== void 0 || candidate.cell.kind !== "tool" && candidate.cell.kind !== "subtool") break;
					calls.push(candidate);
				}
				if (calls.length === 0) continue;
				const last = calls.at(-1);
				out[out.length - 1] = {
					...record,
					turnEnd: false
				};
				out.push({
					...record,
					groupStart: false,
					turnStart: false,
					turnEnd: last?.turnEnd ?? false,
					collapsedSummary: summarizeAssistantTools(calls, t),
					collapsedSummaryKind: "assistant"
				});
				i += calls.length;
			}
			return out;
		}
		function stateOf(record) {
			if (record.cell.isError) return "error";
			if (record.cell.kind === "compacted" && record.cell.timeSeconds === null) return "running";
			if (record.cell.assistantMetrics?.completedTime === null) return "running";
			if ((record.cell.kind === "tool" || record.cell.kind === "subtool") && record.cell.outputDetail === void 0) return "running";
			return "complete";
		}
		function statusLabel(state, t) {
			if (state === "error") return t("status.failed");
			if (state === "running") return t("status.pending");
}} // __DSH_FRAGMENT_END__

export {};
