/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 02/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-trajectory/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/trajectory-search-index.js
		/** Incremental full-text index for the trajectory ledger. */
		function searchableJson(value) {
			if (value === void 0) return "";
			try {
				return JSON.stringify(value);
			} catch {
				return "";
			}
		}
		function sameSources(left, right) {
			return left.length === right.length && left.every((value, index) => value === right[index]);
		}
		function markdownPreview(cell) {
			if (cell.previewMarkdown === void 0) return "";
			const preview = trajectoryPreviewText(cell.previewMarkdown);
			if (cell.text === "") return preview;
			return preview === "" ? cell.text : `${cell.text} · ${preview}`;
		}
		function resultPreview(cell) {
			return cell.resultPreviewMarkdown === void 0 ? cell.result ?? "" : trajectoryPreviewText(cell.resultPreviewMarkdown);
		}
		function recordSources(turn, group, cell) {
			const blocks = [...cell.sourceBlocks ?? [], ...cell.outputBlocks ?? []];
			return [
				turn === null ? "between turns" : `turn ${turn}`,
				group,
				cell.kind,
				cell.kind === "message" ? "assistant" : "",
				cell.text,
				cell.previewMarkdown ?? "",
				cell.inputDetail ?? "",
				cell.outputDetail ?? "",
				cell.thinkingDetail ?? "",
				cell.schemaDetail ?? "",
				cell.result ?? "",
				cell.resultPreviewMarkdown ?? "",
				cell.callId ?? "",
				...blocks.flatMap((block) => [
					block.type,
					block.content,
					block.callId ?? "",
					block.toolName ?? "",
					block.attachment?.name ?? ""
				]),
				searchableJson(cell.messageSource),
				searchableJson(cell.promptDetail),
				searchableJson(cell.previousPromptDetail)
			];
		}
		/** Session-view-local index that reparses Markdown only when one record's source changes. */
		var TrajectorySearchIndex = class {
			entries = /* @__PURE__ */ new Map();
			layouts;
			/**
			* Incrementally synchronize one or more current trajectory layout slices.
			* @param layouts - Finalized and optional streaming layouts from the same view.
			* @returns Whether the indexed layout version changed.
			*/
			update(layouts) {
				if (this.layouts === layouts) return false;
				this.layouts = layouts;
				const seen = /* @__PURE__ */ new Set();
				for (const turns of layouts) for (const turn of turns) for (const group of turn.groups) for (const cell of group.cells) {
					if (cell.requestOnly === true) continue;
					const id = trajectoryRecordId(cell);
					const sources = recordSources(turn.turn, group.title, cell);
					const previous = this.entries.get(id);
					const entry = previous !== void 0 && sameSources(previous.sources, sources) ? previous : {
						sources,
						text: [
							...sources,
							markdownPreview(cell),
							resultPreview(cell)
						].join("\n").toLocaleLowerCase()
					};
					this.entries.set(id, entry);
					seen.add(id);
				}
				for (const id of this.entries.keys()) if (!seen.has(id)) this.entries.delete(id);
				return true;
			}
			/**
			* Match a query against the latest committed index version.
			* @param query - Space-separated case-insensitive search terms.
			* @returns Matching stable record identities, or `null` without a query.
			*/
			search(query) {
				const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
				if (terms.length === 0) return null;
				const matches = /* @__PURE__ */ new Set();
				for (const [id, entry] of this.entries) if (terms.every((term) => entry.text.includes(term))) matches.add(id);
				return matches;
			}
		};
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-trajectory/src/client/views.module.css.mjs
		const css = "__GBH_UI_TRAJECTORY_CSS_views__";
		const tagId = "@deepseek-ai/dsh-client-ui-trajectory/views.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-trajectory";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var views_module_css_default = {
			"ledger": "qBU-ya_ledger",
			"root": "qBU-ya_root"
		};
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/TrajectoryView.js
		/** Trajectory view: compact summary over a turn-aware event ledger. */
		const EMPTY_TURN_IDS = /* @__PURE__ */ new Set();
		const EMPTY_RECORD_IDS = /* @__PURE__ */ new Set();
		const SEARCH_INDEX_THROTTLE_MS = 3e3;
		const HISTORY_PAGE_NODES = 50;
		function containsCall(calls, callId) {
			for (const call of calls) if (call.callId === callId || containsCall(call.subCalls, callId)) return true;
			return false;
		}
		function lastCellIndex(turns) {
			let last = 0;
			for (const turn of turns) for (const group of turn.groups) for (const cell of group.cells) last = Math.max(last, cell.index);
			return last;
		}
		function timelineBlock(block) {
			switch (block.kind) {
				case "text": return {
					kind: "text",
					text: ""
				};
				case "reasoning": return {
					kind: "reasoning",
					text: ""
				};
				case "image": return block;
				case "tool-call": return {
					kind: "tool-call",
					callId: block.callId,
					name: block.name,
					argsRaw: ""
				};
				case "other": return {
					kind: "other",
					block: null
				};
			}
		}
		function partialStructureSignature(partial) {
			if (partial === null) return "";
			return partial.blocks.map((block) => block.kind === "tool-call" ? `${block.kind}:${block.callId}:${block.name}` : block.kind).join("\0");
		}
		function requestUsage(value) {
			const usage = value;
			if (usage === void 0) return void 0;
			return {
				...usage.inputTokens === void 0 ? {} : { input: usage.inputTokens },
				...usage.cacheReadTokens === void 0 ? {} : { cacheRead: usage.cacheReadTokens },
				...usage.cacheWriteTokens === void 0 ? {} : { cacheWrite: usage.cacheWriteTokens },
				...usage.outputTokens === void 0 ? {} : { output: usage.outputTokens },
				...usage.reasoningTokens === void 0 ? {} : { reasoning: usage.reasoningTokens }
			};
		}
		function addUsage(total, usage) {
			if (usage === void 0) return total;
			return {
				...total?.input === void 0 && usage.input === void 0 ? {} : { input: (total?.input ?? 0) + (usage.input ?? 0) },
				...total?.cacheRead === void 0 && usage.cacheRead === void 0 ? {} : { cacheRead: (total?.cacheRead ?? 0) + (usage.cacheRead ?? 0) },
				...total?.cacheWrite === void 0 && usage.cacheWrite === void 0 ? {} : { cacheWrite: (total?.cacheWrite ?? 0) + (usage.cacheWrite ?? 0) },
				...total?.output === void 0 && usage.output === void 0 ? {} : { output: (total?.output ?? 0) + (usage.output ?? 0) },
				...total?.reasoning === void 0 && usage.reasoning === void 0 ? {} : { reasoning: (total?.reasoning ?? 0) + (usage.reasoning ?? 0) }
			};
		}
		function TrajectoryView({ useSession, useTrajectory, useDuration, loadOlder, loadImage, setActualDuration, viewRequest, completeViewRequest, renderSlot, t, jsonStringWrapping }) {
			const [collapsedTurns, setCollapsedTurns] = (0, react.useState)(EMPTY_TURN_IDS);
			const [collapsedAssistants, setCollapsedAssistants] = (0, react.useState)(EMPTY_RECORD_IDS);
			const [timelineSelection, setTimelineSelection] = (0, react.useState)(null);
			const actualDuration = useDuration((value) => value);
			const [actualTime, setActualTime] = (0, react.useState)(false);
			const [searchQuery, setSearchQuery] = (0, react.useState)("");
			const [searchIndex] = (0, react.useState)(() => new TrajectorySearchIndex());
			const [searchIndexRevision, setSearchIndexRevision] = (0, react.useState)(0);
			const searchIndexTimer = (0, react.useRef)(null);
			const searchIndexInitialized = (0, react.useRef)(false);
			const [selectedTimelineIndex, setSelectedTimelineIndex] = (0, react.useState)(null);
			const [timelineRecordSelection, setTimelineRecordSelection] = (0, react.useState)(null);
			const [timelineRecordFocus, setTimelineRecordFocus] = (0, react.useState)(null);
			const completeInspection = useTrajectory((snapshot) => snapshot);
			const latestNodeSeq = completeInspection.eventNodes.at(-1)?.seq;
			const [historyTailSeq, setHistoryTailSeq] = (0, react.useState)(latestNodeSeq);
			const [historyNodeLimit, setHistoryNodeLimit] = (0, react.useState)(HISTORY_PAGE_NODES);
			const fixedTailSeq = historyTailSeq ?? latestNodeSeq;
			const historyTailIndex = fixedTailSeq === void 0 ? -1 : completeInspection.eventNodes.findLastIndex((node) => node.seq <= fixedTailSeq);
			const historyEndIndex = historyTailIndex < 0 && latestNodeSeq !== void 0 ? completeInspection.eventNodes.length : historyTailIndex + 1;
			const historyStartIndex = Math.max(0, historyEndIndex - historyNodeLimit);
			(0, react.useEffect)(() => {
				if (latestNodeSeq !== void 0 && (historyTailSeq === void 0 || historyTailIndex < 0)) setHistoryTailSeq(latestNodeSeq);
			}, [
				historyTailIndex,
				historyTailSeq,
				latestNodeSeq
			]);
			const inspection = (0, react.useMemo)(() => {
				if (historyStartIndex === 0) return completeInspection;
				const eventNodes = completeInspection.eventNodes.slice(historyStartIndex);
				const firstSeq = eventNodes[0]?.seq ?? 0;
				return {
					...completeInspection,
					eventNodes,
					requests: completeInspection.requests.filter((request) => request.startSeq >= firstSeq || (request.resultSeq ?? -1) >= firstSeq)
				};
			}, [completeInspection, historyStartIndex]);
			const historyLoading = useSession((snapshot) => snapshot.openState === "loading");
			const olderHistoryLoading = useSession((snapshot) => snapshot.loadingOlder);
			const sessionHasOlderHistory = useSession((snapshot) => snapshot.hasMore);
			const hasResidentOlderHistory = historyStartIndex > 0;
			const hasOlderHistory = hasResidentOlderHistory || sessionHasOlderHistory;
			const nodes = inspection.eventNodes;
			const eventLocations = inspection.eventLocations;
			const historyBaseSeq = nodes[0]?.seq ?? 0;
			const partial = inspection.partial;
			const runningCalls = inspection.runningCalls;
			const requests = inspection.requests;
			const callSchemas = inspection.callSchemas;
			const inspectCallId = viewRequest?.view === "trajectory" ? viewRequest.focus : null;
			const inspectNodeIndex = (0, react.useMemo)(() => inspectCallId === null ? -1 : completeInspection.eventNodes.findIndex((node) => node.kind === "assistant" ? node.blocks.some((block) => block.kind === "tool-call" && block.callId === inspectCallId) : node.kind === "tool-result" && containsCall([node], inspectCallId)), [completeInspection.eventNodes, inspectCallId]);
			(0, react.useEffect)(() => {
				if (inspectNodeIndex < 0 || inspectNodeIndex >= historyStartIndex) return;
				setHistoryNodeLimit((limit) => limit + historyStartIndex - inspectNodeIndex);
			}, [historyStartIndex, inspectNodeIndex]);
			const requestNumbers = (0, react.useMemo)(() => {
				const assistantsByStep = /* @__PURE__ */ new Map();
				for (const node of completeInspection.eventNodes) {
					if (node.kind !== "assistant" || node.step <= 0) continue;
					assistantsByStep.set(`${node.turn}\u0000${node.step}`, node);
				}
				const requestsByStep = new Map(completeInspection.requests.filter((request) => request.purpose === "assistant").map((request) => [`${request.turn}\u0000${request.step}`, request]));
				const orderedRequests = [...completeInspection.requests.map((request) => ({
					seq: request.startSeq,
					request,
					node: request.purpose === "assistant" ? assistantsByStep.get(`${request.turn}\u0000${request.step}`) : void 0
				})), ...[...assistantsByStep.entries()].flatMap(([key, node]) => requestsByStep.has(key) ? [] : [{
					seq: node.seq,
					request: void 0,
					node
				}])].sort((left, right) => left.seq - right.seq);
				const numbered = [];
				let cumulativeUsage;
				for (const [index, entry] of orderedRequests.entries()) {
					const usage = requestUsage(entry.request?.usage ?? entry.node?.usage);
					cumulativeUsage = addUsage(cumulativeUsage, usage);
					if (entry.request?.purpose !== "compaction") {
						const request = entry.request;
						const node = entry.node;
						const turn = request?.turn ?? node?.turn;
						const step = request?.step ?? node?.step;
						if (turn === void 0 || step === void 0) continue;
						const provider = request?.providerMetadata?.provider ?? node?.providerMetadata?.provider;
						const model = request?.providerMetadata?.model ?? node?.providerMetadata?.model;
						const requestConfig = request?.requestConfig ?? node?.requestConfig;
						const startedAt = request?.startedAt;
						const completedAt = request === void 0 ? node?.time : request.completedAt;
						const resultSeq = request?.resultSeq ?? node?.seq;
						numbered.push({
							seq: entry.seq,
							turn,
							step,
							group: t("group.step", { step }),
							number: index + 1,
							status: request?.status ?? (node?.interrupted === true ? "error" : "complete"),
							...startedAt === void 0 ? {} : { startedAt },
							...completedAt === void 0 ? {} : { completedAt },
							...request?.error === void 0 ? {} : { error: request.error },
							...request?.errorCode === void 0 ? {} : { errorCode: request.errorCode },
							...resultSeq === void 0 ? {} : { resultSeq },
							...request?.retry === void 0 ? {} : { retry: request.retry },
							...request?.maxRetries === void 0 ? {} : { maxRetries: request.maxRetries },
							...request?.retryDelayMs === void 0 ? {} : { retryDelayMs: request.retryDelayMs },
							...provider === void 0 ? {} : { provider },
							...model === void 0 ? {} : { model },
							...requestConfig === void 0 ? {} : { requestConfig },
							...usage === void 0 ? {} : { usage },
							...cumulativeUsage === void 0 ? {} : { cumulativeUsage }
						});
						continue;
					}
					const request = entry.request;
					numbered.push({
						seq: request.startSeq,
						turn: request.turn,
						step: 0,
						group: t("group.compaction", { seq: request.startSeq }),
						number: index + 1,
						purpose: "compaction",
						status: request.status,
						startedAt: request.startedAt,
						completedAt: request.completedAt,
						...request.error === void 0 ? {} : { error: request.error },
						...request.errorCode === void 0 ? {} : { errorCode: request.errorCode },
						...request.status === "running" ? {} : { resultSeq: request.startSeq },
						...request.providerMetadata?.provider === void 0 ? {} : { provider: request.providerMetadata.provider },
						...request.providerMetadata?.model === void 0 ? {} : { model: request.providerMetadata.model },
						...request.requestConfig === void 0 ? {} : { requestConfig: request.requestConfig },
						...usage === void 0 ? {} : { usage },
						...cumulativeUsage === void 0 ? {} : { cumulativeUsage }
					});
				}
				return numbered;
			}, [
				completeInspection.eventNodes,
				completeInspection.requests,
				t
			]);
			const partialTurn = partial?.turn ?? null;
			const partialStep = partial?.step ?? null;
			const finalized = (0, react.useMemo)(() => {
				const turns = deriveTrajectoryLayout({
					nodes,
					eventLocations,
					partial: partialTurn === null || partialStep === null ? null : {
						turn: partialTurn,
						step: partialStep,
						blocks: []
					},
					runningCalls,
					requests,
					systemPrompts: inspection.systemPrompts,
					callSchemas
				}, t);
				return {
					turns,
					lastIndex: lastCellIndex(turns)
				};
			}, [
				nodes,
				eventLocations,
				partialTurn,
				partialStep,
				runningCalls,
				requests,
				inspection.systemPrompts,
				callSchemas,
				t
			]);
			const timelinePartialSignature = partialStructureSignature(partial);
			const partialStartTime = partial?.timing?.stepStartTime;
			const partialFirstTokenTime = partial?.timing?.firstTokenTime;
			const timelinePartial = (0, react.useMemo)(() => partial === null ? null : {
				turn: partial.turn,
				step: partial.step,
				blocks: partial.blocks.map((block) => timelineBlock(block)),
				...partial.timing === void 0 ? {} : { timing: partial.timing }
			}, [
				partialStep,
				partialTurn,
				timelinePartialSignature,
				partialStartTime,
				partialFirstTokenTime
			]);
			const timelineTurns = (0, react.useMemo)(() => appendTrajectoryPartialLayout(finalized.turns, timelinePartial, finalized.lastIndex, t), [
				finalized,
				timelinePartial,
				t
			]);
			const timelineMode = actualDuration ? actualTime ? "actual" : "duration" : actualTime ? "time" : "sequence";
			const partialSearchTurns = (0, react.useMemo)(() => appendTrajectoryPartialLayout([], partial, finalized.lastIndex, t), [
				finalized.lastIndex,
				partial,
				t
			]);
			const searchLayouts = (0, react.useMemo)(() => [finalized.turns, partialSearchTurns], [finalized, partialSearchTurns]);
			const latestSearchLayouts = (0, react.useRef)(searchLayouts);
			latestSearchLayouts.current = searchLayouts;
			(0, react.useEffect)(() => {
				if (!searchIndexInitialized.current) {
					searchIndexInitialized.current = true;
					if (searchIndex.update(searchLayouts)) setSearchIndexRevision((revision) => revision + 1);
					return;
				}
				if (searchIndexTimer.current !== null) return;
				searchIndexTimer.current = setTimeout(() => {
					searchIndexTimer.current = null;
					if (searchIndex.update(latestSearchLayouts.current)) setSearchIndexRevision((revision) => revision + 1);
				}, SEARCH_INDEX_THROTTLE_MS);
			}, [searchIndex, searchLayouts]);
			(0, react.useEffect)(() => () => {
				if (searchIndexTimer.current !== null) clearTimeout(searchIndexTimer.current);
			}, []);
			const streamingCells = (0, react.useMemo)(() => partialSearchTurns.flatMap((turn) => turn.groups.flatMap((group) => group.cells)), [partialSearchTurns]);
			const searchMatchRecordIds = (0, react.useMemo)(() => searchIndex.search(searchQuery), [
				searchIndex,
				searchIndexRevision,
				searchQuery
			]);
			const searchMatchIndexes = (0, react.useMemo)(() => {
				if (searchMatchRecordIds === null) return null;
				const indexes = /* @__PURE__ */ new Set();
				for (const turns of searchLayouts) for (const turn of turns) for (const group of turn.groups) for (const cell of group.cells) if (searchMatchRecordIds.has(trajectoryRecordId(cell))) indexes.add(cell.index);
				return indexes;
			}, [searchLayouts, searchMatchRecordIds]);
			const timelineRange = timelineSelection;
			const timelineFocusIndexes = (0, react.useMemo)(() => timelineRange === null ? null : trajectoryTimelineFocusIndexes(timelineTurns, timelineRange, timelineMode), [
				timelineMode,
				timelineRange,
				timelineTurns
			]);
			const handleRecordSelect = (0, react.useCallback)((index) => {
				if (timelineFocusIndexes !== null && !timelineFocusIndexes.has(index)) setTimelineSelection(null);
			}, [timelineFocusIndexes]);
			const handleTimelineRangeChange = (0, react.useCallback)((range) => {
				setTimelineSelection(range);
			}, []);
			const handleTimelineRecordSelect = (0, react.useCallback)((index) => {
				setTimelineSelection(null);
				setTimelineRecordSelection({ index });
				setSelectedTimelineIndex(index);
			}, []);
			const handleTimelineRecordFocus = (0, react.useCallback)((index) => {
				setTimelineRecordFocus({ index });
			}, []);
			const collapsibleTurnIds = (0, react.useMemo)(() => timelineTurns.filter((turn) => turn.turn !== null && turn.groups.reduce((count, group) => count + group.cells.filter((cell) => cell.requestOnly !== true && cell.kind !== "system").length, 0) > 1).flatMap((turn) => turn.turn === null ? [] : [turn.turn]), [timelineTurns]);
			const allTurnsCollapsed = collapsibleTurnIds.length > 0 && collapsibleTurnIds.every((turn) => collapsedTurns.has(turn));
			const collapsibleAssistantIds = (0, react.useMemo)(() => {
				const ids = [];
				for (const turn of timelineTurns) {
					const cells = turn.groups.flatMap((group) => group.cells);
					for (let i = 0; i < cells.length; i++) {
						const cell = cells[i];
						if (cell?.kind !== "message") continue;
						const next = cells[i + 1];
						if (next?.kind === "tool" || next?.kind === "subtool") ids.push(trajectoryRecordId(cell));
					}
				}
				return ids;
			}, [timelineTurns]);
			const allAssistantsCollapsed = collapsibleAssistantIds.length > 0 && collapsibleAssistantIds.every((index) => collapsedAssistants.has(index));
			const toggleTurn = (turn) => {
				setCollapsedTurns((current) => {
					const collapsed = new Set(current);
					if (collapsed.has(turn)) collapsed.delete(turn);
					else collapsed.add(turn);
					return collapsed;
				});
			};
			const toggleAllTurns = () => {
				setCollapsedTurns((current) => {
					const collapsed = new Set(current);
					if (allTurnsCollapsed) for (const turn of collapsibleTurnIds) collapsed.delete(turn);
					else for (const turn of collapsibleTurnIds) collapsed.add(turn);
					return collapsed;
				});
			};
			const toggleAssistant = (id) => {
				setCollapsedAssistants((current) => {
					const collapsed = new Set(current);
					if (collapsed.has(id)) collapsed.delete(id);
					else collapsed.add(id);
					return collapsed;
				});
			};
			const toggleAllAssistants = () => {
				setCollapsedAssistants((current) => {
					const collapsed = new Set(current);
					if (allAssistantsCollapsed) for (const index of collapsibleAssistantIds) collapsed.delete(index);
					else for (const index of collapsibleAssistantIds) collapsed.add(index);
					return collapsed;
				});
			};
			const loadEarlierHistory = (0, react.useCallback)(async () => {
				if (!hasResidentOlderHistory && !await loadOlder()) return false;
				setHistoryNodeLimit((limit) => limit + HISTORY_PAGE_NODES);
				return true;
			}, [hasResidentOlderHistory, loadOlder]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: views_module_css_default.root,
				"data-conversation-composer-overlay": "",
				children: [
					(0, react_jsx_runtime.jsx)(TrajectoryToolbar, {
						actualDuration,
						onActualDurationChange: (nextActualDuration) => {
							setActualDuration(nextActualDuration);
							setTimelineSelection(null);
						},
						actualTime,
						onActualTimeChange: (nextActualTime) => {
							setActualTime(nextActualTime);
							setTimelineSelection(null);
						},
						allTurnsCollapsed,
						onToggleAllTurns: toggleAllTurns,
						allAssistantsCollapsed,
						onToggleAllAssistants: toggleAllAssistants,
						searchQuery,
						onSearchQueryChange: setSearchQuery,
						t
					}),
					(0, react_jsx_runtime.jsx)(TrajectoryTimeline, {
						t,
						turns: timelineTurns,
						mode: timelineMode,
						range: timelineRange,
						hasEarlierRecords: hasOlderHistory,
						onLoadEarlier: loadEarlierHistory,
						selectedIndex: selectedTimelineIndex,
						searchMatchIndexes,
						onRangeChange: handleTimelineRangeChange,
						onRecordSelect: handleTimelineRecordSelect,
						onRecordFocus: handleTimelineRecordFocus
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: views_module_css_default.ledger,
						children: (0, react_jsx_runtime.jsx)(TrajectoryTable, {
							t,
							stringWrapping: jsonStringWrapping === void 0 ? void 0 : {
								...jsonStringWrapping,
								label: t("record.wrapLines")
							},
							renderSlot,
							loadImage,
							requestNumbers,
							turns: timelineTurns,
							streamingCells,
							timelineFocusIndexes,
							searchMatchIndexes,
							onSelectedIndexChange: setSelectedTimelineIndex,
							onRecordSelect: handleRecordSelect,
							recordSelection: timelineRecordSelection,
							recordFocus: timelineRecordFocus,
							historyLoading,
							olderHistoryLoading,
							historyStartSeq: historyBaseSeq,
							hasOlderRecords: hasOlderHistory,
							onLoadOlder: loadEarlierHistory,
							onClearSelection: () => {
								setTimelineSelection(null);
							},
							collapsedTurns,
							onToggleTurn: toggleTurn,
							collapsedAssistants,
							onToggleAssistant: toggleAssistant,
							inspectCallId,
							onInspectApplied: completeViewRequest
						})
					})
				]
			});
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/index.js
		/** Required services: the conversation slot, registries, ordinary Session paging, and the locale service. */
		const inject = [
			"slots",
			"sessions",
			"uiSession",
			"uiConversation",
			"locale"
		];
		/**
		* Client plugin body: register the trajectory view tab. The registration
		* rides the slot service's effect wrapper, so plugin unload removes the tab.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const trajectorySources = /* @__PURE__ */ new WeakMap();
			const trajectorySource = (binding) => {
				let source = trajectorySources.get(binding);
				if (source === void 0) {
					const target = ctx.uiConversation.binding(binding).target("trajectory");
					source = {
						getSnapshot: () => target.getSnapshot() ?? EMPTY_TRAJECTORY_SNAPSHOT,
						subscribe: (listener) => target.subscribe(listener)
					};
					trajectorySources.set(binding, source);
				}
				return source;
			};
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-trajectory: dictionaries");
			const t = ctx.locale.bind(NS);
			const duration = createTrajectoryDurationStore();
			const stringWrapping = createTrajectoryStringWrappingStore();
			registerTrajectoryMessageDefinitions(ctx);
			registerTrajectoryRequestHeaderDefinition(ctx);
			registerTrajectoryAssistantDefinition(ctx);
			registerTrajectoryToolDefinition(ctx);
			registerTrajectoryCompactionDefinitions(ctx);
			registerTrajectoryConversationView(ctx);
			ctx.uiSession.provide({
				hooks: ["trajectory"],
				resolve: (binding) => ({ hooks: { trajectory: trajectorySource(binding) } })
			});
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "trajectory",
				order: 10,
				locale: NS,
				label: () => t("view.trajectory"),
				children: { "conversation.trajectory.images": {
					kind: "single",
					scope: "session"
				} },
				inject: (sessionId) => {
					const session = ctx.sessions.binding(sessionId)?.session;
					if (session === void 0) throw new Error(`ui-trajectory: session "${sessionId}" is unavailable`);
					const trajectory = ctx.uiConversation.binding(sessionId).target("trajectory");
					return {
						hooks: { duration },
						jsonStringWrapping: {
							getDefault: () => stringWrapping.getSnapshot(),
							setDefault: (value) => {
								stringWrapping.set(value);
							}
						},
						loadOlder: async () => {
							const before = trajectory.getSnapshot();
							await session.loadOlder();
							return trajectory.getSnapshot() !== before;
						},
						loadImage: Object.assign((attachment) => ctx.uiConversation.imageUrl(sessionId, attachment), { peek: (attachment) => ctx.uiConversation.peekImageUrl(sessionId, attachment) }),
						setActualDuration: (value) => {
							duration.set(value);
						}
					};
				}
			}, TrajectoryView));
		}
		//#endregion
} // __DSH_FRAGMENT_END__

export {};
