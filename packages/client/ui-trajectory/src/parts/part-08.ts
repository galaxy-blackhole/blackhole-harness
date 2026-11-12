/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-trajectory/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		function RequestTiming({ assistant, anchor, request, preview = false, t }) {
			if (assistant !== void 0) return (0, react_jsx_runtime.jsx)(RecordTiming, {
				record: assistant,
				preview,
				t
			});
			if (request?.startedAt !== void 0) {
				const duration = request.completedAt === null || request.completedAt === void 0 ? null : Math.max(0, (request.completedAt - request.startedAt) / 1e3);
				return (0, react_jsx_runtime.jsxs)("dl", {
					className: TrajectoryTable_module_css_default.overview,
					children: [
						(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.started") }), (0, react_jsx_runtime.jsx)(StartedAtValue, {
							timestamp: request.startedAt,
							t
						})] }),
						(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.duration") }), (0, react_jsx_runtime.jsx)("dd", { children: formatElapsedSeconds(duration, t) })] }),
						!preview && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.source") }), (0, react_jsx_runtime.jsx)("dd", { children: duration === null ? t("timing.sessionTimestampsRunning") : t("timing.sessionTimestamps") })] })
					]
				});
			}
			return (0, react_jsx_runtime.jsxs)("dl", {
				className: TrajectoryTable_module_css_default.overview,
				children: [(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.started") }), (0, react_jsx_runtime.jsx)(StartedAtValue, {
					timestamp: anchor?.cell.startedAt ?? null,
					t
				})] }), (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.duration") }), (0, react_jsx_runtime.jsx)("dd", { children: formatElapsedSeconds(null, t) })] })]
			});
		}
		function RecordPayload({ record, direction, preview = false, renderSlot, loadImage, stringWrapping, t }) {
			const value = direction === "input" ? record.cell.inputDetail : record.cell.outputDetail;
			const missing = direction === "input" ? t("record.noPayload") : t("record.noResult");
			if (!value) return (0, react_jsx_runtime.jsx)("p", {
				className: TrajectoryTable_module_css_default.noPayload,
				children: missing
			});
			const error = direction === "output" && record.cell.isError === true;
			const payloadClass = preview ? TrajectoryTable_module_css_default.jsonPreview : TrajectoryTable_module_css_default.jsonPayload;
			const payloadClassName = error ? `${payloadClass} ${TrajectoryTable_module_css_default.errorPayload}` : payloadClass;
			const json = parseJsonContainer(value);
			if (direction === "output" && record.cell.outputBlocks?.length === 1 && record.cell.outputBlocks[0]?.type === "text" && json !== void 0) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
				data: json,
				stringWrapping,
				collapsedStringLines: preview ? 3 : 12,
				label: t("record.resultJson"),
				labels: jsonTreeLabels(t),
				className: payloadClassName
			});
			if (direction === "output" && record.cell.outputBlocks?.some((block) => block.attachment !== void 0 || block.content !== "") === true) return (0, react_jsx_runtime.jsx)(ToolOutputBlocks, {
				blocks: record.cell.outputBlocks,
				error,
				errorDetail: error ? value : void 0,
				preview,
				renderSlot,
				loadImage
			});
			if (direction === "input" && (record.cell.kind === "user" || record.cell.kind === "context") || direction === "output" && record.cell.kind === "message") return (0, react_jsx_runtime.jsx)("div", {
				className: [preview ? TrajectoryTable_module_css_default.markdownPreview : TrajectoryTable_module_css_default.markdownPayload, error ? TrajectoryTable_module_css_default.errorPayload : void 0].filter((className) => className !== void 0).join(" "),
				children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
					text: value,
					labels: markdownLabels(t)
				})
			});
			if (json !== void 0) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
				data: json,
				stringWrapping,
				collapsedStringLines: preview ? 3 : 12,
				label: t(direction === "input" ? "record.payloadJson" : "record.outputJson"),
				labels: jsonTreeLabels(t),
				className: payloadClassName
			});
			return (0, react_jsx_runtime.jsx)("pre", {
				className: [
					TrajectoryTable_module_css_default.payload,
					preview ? TrajectoryTable_module_css_default.payloadPreview : void 0,
					error ? TrajectoryTable_module_css_default.errorPayload : void 0,
					value === t("record.noOutput") ? TrajectoryTable_module_css_default.noOutputText : void 0
				].filter((value) => value !== void 0).join(" "),
				children: value
			});
		}
		function RecordSchema({ record, preview = false, stringWrapping, t }) {
			if (!record.cell.schemaDetail) return (0, react_jsx_runtime.jsx)("p", {
				className: TrajectoryTable_module_css_default.noPayload,
				children: t("record.schemaUnavailable")
			});
			const schema = parseToolSchema(record.cell.schemaDetail);
			if (schema !== void 0) return (0, react_jsx_runtime.jsxs)("div", {
				className: preview ? `${TrajectoryTable_module_css_default.schema} ${TrajectoryTable_module_css_default.schemaPreview}` : TrajectoryTable_module_css_default.schema,
				children: [(0, react_jsx_runtime.jsxs)("header", {
					className: TrajectoryTable_module_css_default.schemaIntro,
					children: [(0, react_jsx_runtime.jsx)("h3", {
						className: TrajectoryTable_module_css_default.schemaName,
						children: schema.name
					}), (0, react_jsx_runtime.jsx)("p", {
						className: TrajectoryTable_module_css_default.schemaDescription,
						children: schema.description
					})]
				}), (0, react_jsx_runtime.jsxs)("section", {
					className: TrajectoryTable_module_css_default.schemaParameters,
					children: [(0, react_jsx_runtime.jsx)("h4", {
						className: TrajectoryTable_module_css_default.schemaParametersTitle,
						children: t("record.parameters")
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
						data: schema.parameters,
						stringWrapping,
						collapsedStringLines: preview ? 3 : 12,
						label: t("record.namedParametersJson", { name: schema.name }),
						labels: jsonTreeLabels(t),
						className: TrajectoryTable_module_css_default.schemaTree
					})]
				})]
			});
			return (0, react_jsx_runtime.jsx)("pre", {
				className: `${TrajectoryTable_module_css_default.payload} ${preview ? TrajectoryTable_module_css_default.payloadPreview : ""}`,
				children: record.cell.schemaDetail
			});
		}
		function parseToolSchema(value) {
			try {
				const parsed = JSON.parse(value);
				if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return void 0;
				const schema = parsed;
				if (typeof schema.name !== "string" || typeof schema.description !== "string" || typeof schema.parameters !== "object" || schema.parameters === null || Array.isArray(schema.parameters)) return void 0;
				return {
					name: schema.name,
					description: schema.description,
					parameters: schema.parameters
				};
			} catch {
				return;
			}
		}
		function parseJsonContainer(value) {
			try {
				const parsed = JSON.parse(value);
				return typeof parsed === "object" && parsed !== null ? parsed : void 0;
			} catch {
				return;
			}
		}
		function InspectorCopyButton({ text, label, t }) {
			const [state, setState] = (0, react.useState)("idle");
			(0, react.useEffect)(() => {
				if (state === "idle") return;
				const timer = setTimeout(() => {
					setState("idle");
				}, 1500);
				return () => {
					clearTimeout(timer);
				};
			}, [state]);
			const title = state === "idle" ? label : t(state === "copied" ? "copied" : "copy.failed");
			return (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: TrajectoryTable_module_css_default.programAction,
				"data-state": state,
				"aria-label": title,
				title,
				onClick: () => {
					(0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(text).then((ok) => {
						setState(ok ? "copied" : "failed");
					});
				},
				children: state === "copied" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 12 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 12 })
			});
		}
		function ProgramInput({ program, initialWrapped, stringWrapping, onOpen, t }) {
			const contentsId = (0, react.useId)();
			const [wrapped, setWrapped] = (0, react.useState)(initialWrapped);
			const [showJson, setShowJson] = (0, react.useState)(false);
			const actions = (0, react_jsx_runtime.jsxs)("span", {
				className: TrajectoryTable_module_css_default.programActions,
				children: [
					!showJson && program.language !== void 0 && (0, react_jsx_runtime.jsx)("span", {
						className: TrajectoryTable_module_css_default.programLanguage,
						children: program.language
					}),
					!showJson && (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: TrajectoryTable_module_css_default.programAction,
						"aria-label": t("record.wrapLines"),
						title: t("record.wrapLines"),
						"aria-pressed": wrapped,
						"aria-controls": contentsId,
						onClick: () => {
							const next = !wrapped;
							setWrapped(next);
							stringWrapping?.setDefault(next);
						},
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWrapLinesOutlineRegular, { size: 12 })
					}),
					onOpen === void 0 && (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: TrajectoryTable_module_css_default.programAction,
						"aria-label": t("code.originalJson"),
						title: t("code.originalJson"),
						"aria-pressed": showJson,
						"aria-controls": contentsId,
						onClick: () => {
							setShowJson((value) => !value);
						},
						children: (0, react_jsx_runtime.jsxs)("svg", {
							width: "12",
							height: "12",
							viewBox: "0 0 16 16",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.5",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							"aria-hidden": "true",
							children: [(0, react_jsx_runtime.jsx)("path", { d: "M6 2H5a2 2 0 0 0-2 2v2a2 2 0 0 1-2 2 2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h1" }), (0, react_jsx_runtime.jsx)("path", { d: "M10 2h1a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0-2 2v2a2 2 0 0 1-2 2h-1" })]
						})
					}),
					(0, react_jsx_runtime.jsx)(InspectorCopyButton, {
						text: showJson ? program.rawInput : program.source,
						label: t(showJson ? "copy.json" : "code.copySource"),
						t
					})
				]
			});
			const body = (0, react_jsx_runtime.jsx)("div", {
				id: contentsId,
				className: TrajectoryTable_module_css_default.programContent,
				"data-wrap": wrapped,
				children: showJson ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
					data: program.arguments,
					label: t("record.parametersJson"),
					labels: jsonTreeLabels(t),
					stringWrapping
				}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.CodeBlock, {
					code: program.source,
					lang: program.language,
					lineNumbers: true,
					showHeader: false,
					className: TrajectoryTable_module_css_default.programSource,
					copyLabel: t("code.copySource"),
					copiedLabel: t("copied")
				})
			});
			return onOpen === void 0 ? (0, react_jsx_runtime.jsxs)("section", {
				className: TrajectoryTable_module_css_default.programPanel,
				children: [(0, react_jsx_runtime.jsxs)("header", {
					className: TrajectoryTable_module_css_default.overviewHeading,
					children: [(0, react_jsx_runtime.jsx)("span", { children: t("code.source") }), actions]
				}), body]
			}) : (0, react_jsx_runtime.jsx)(OverviewSection, {
				label: t("code.source"),
				onOpen,
				actions,
				children: body
			});
		}
		function ProgramOutput({ record, stringWrapping, onOpen, t }) {
			const output = record.cell.outputDetail;
			const json = output === void 0 || record.cell.isError === true ? void 0 : parseJsonContainer(output);
			const actions = output === void 0 ? void 0 : (0, react_jsx_runtime.jsx)("span", {
				className: TrajectoryTable_module_css_default.programActions,
				children: (0, react_jsx_runtime.jsx)(InspectorCopyButton, {
					text: output,
					label: t("code.copyOutput"),
					t
				})
			});
			const body = (0, react_jsx_runtime.jsx)("div", {
				className: TrajectoryTable_module_css_default.programContent,
				children: output === void 0 || output === "" ? (0, react_jsx_runtime.jsx)("p", {
					className: TrajectoryTable_module_css_default.noPayload,
					children: t(stateOf(record) === "running" ? "code.running" : "record.noOutput")
				}) : json !== void 0 ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
					data: json,
					label: t("record.outputJson"),
					labels: jsonTreeLabels(t),
					stringWrapping,
					collapsedStringLines: onOpen === void 0 ? 12 : 3
				}) : (0, react_jsx_runtime.jsx)("pre", {
					className: `${TrajectoryTable_module_css_default.programOutput} ${record.cell.isError === true ? TrajectoryTable_module_css_default.programError : ""}`,
					children: output
				})
			});
			return onOpen === void 0 ? (0, react_jsx_runtime.jsxs)("section", {
				className: TrajectoryTable_module_css_default.programPanel,
				children: [(0, react_jsx_runtime.jsxs)("header", {
					className: TrajectoryTable_module_css_default.overviewHeading,
					children: [(0, react_jsx_runtime.jsx)("span", { children: t("code.output") }), actions]
				}), body]
			}) : (0, react_jsx_runtime.jsx)(OverviewSection, {
				label: t("code.output"),
				onOpen,
				actions,
				children: body
			});
		}
		function OverviewSection({ label, onOpen, actions, children }) {
			const previewRef = (0, react.useRef)(null);
			const [hasMore, setHasMore] = (0, react.useState)(false);
			const measureOverflow = (0, react.useCallback)((preview) => {
				setHasMore(preview.scrollHeight - preview.clientHeight - preview.scrollTop > 1);
			}, []);
			(0, react.useLayoutEffect)(() => {
				const preview = previewRef.current;
				const measure = () => {
					measureOverflow(preview);
				};
				measure();
				if (typeof ResizeObserver === "undefined") return;
				const observer = new ResizeObserver(measure);
				observer.observe(preview);
				for (const child of preview.children) observer.observe(child);
				return () => {
					observer.disconnect();
				};
			}, [children, measureOverflow]);
			return (0, react_jsx_runtime.jsxs)("section", {
				className: TrajectoryTable_module_css_default.overviewSection,
				children: [(0, react_jsx_runtime.jsxs)("h3", {
					className: TrajectoryTable_module_css_default.overviewHeading,
					children: [(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: TrajectoryTable_module_css_default.overviewTitle,
						onClick: onOpen,
						children: [(0, react_jsx_runtime.jsx)("span", { children: label }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
							className: TrajectoryTable_module_css_default.overviewTitleIcon,
							size: 12
						})]
					}), actions]
				}), (0, react_jsx_runtime.jsx)("div", {
					ref: previewRef,
					className: `${TrajectoryTable_module_css_default.overviewPreview} ${TrajectoryTable_module_css_default.summaryScrollRegion}`,
					"data-summary-scroll-region": "",
					"data-scroll-more": hasMore || void 0,
					onScroll: (event) => {
						measureOverflow(event.currentTarget);
					},
					children
				})]
			});
		}
		/**
		* Render trajectory events as a dense ledger with turn and step separators.
		* Clicking ledger whitespace clears the active record or request selection.
		* @param props - Grouped trajectory data and whole-ledger fold state.
		* @returns The ledger and an optional local record inspector.
		*/
		function TrajectoryTable({ t, stringWrapping, renderSlot, loadImage, requestNumbers: sessionRequestNumbers, turns, streamingCells = [], timelineFocusIndexes = null, searchMatchIndexes = null, onSelectedIndexChange, onRecordSelect, recordSelection = null, recordFocus = null, historyLoading = false, olderHistoryLoading = false, historyStartSeq, hasOlderRecords = false, onLoadOlder, onClearSelection, collapsedTurns, onToggleTurn, collapsedAssistants, onToggleAssistant, inspectCallId = null, onInspectApplied }) {
			const [selectedRecordId, setSelectedRecordId] = (0, react.useState)(null);
			const [selectedRequest, setSelectedRequest] = (0, react.useState)(null);
			const [activeTab, setActiveTab] = (0, react.useState)("overview");
			const [codeWrappingOnOpen, setCodeWrappingOnOpen] = (0, react.useState)(false);
			const [thinkingDisclosure, setThinkingDisclosure] = (0, react.useState)();
			const [detailsWidth, setDetailsWidth] = (0, react.useState)(null);
			const [toolRequestOffset, setToolRequestOffset] = (0, react.useState)(null);
			const detailsResizeDrag = (0, react.useRef)(null);
			const appliedRecordSelection = (0, react.useRef)(null);
			const appliedRecordFocus = (0, react.useRef)(null);
			const tabHistory = (0, react.useRef)(new Set(["overview"]));
			const rootRef = (0, react.useRef)(null);
			const tablePaneRef = (0, react.useRef)(null);
			const followsTableTail = (0, react.useRef)(false);
			const tableScrollInitialized = (0, react.useRef)(false);
			const [tableScrollReady, setTableScrollReady] = (0, react.useState)(false);
			const pendingScrollRecordId = (0, react.useRef)(null);
			const loadingOlder = (0, react.useRef)(false);
			const [olderLoading, setOlderLoading] = (0, react.useState)(false);
			const olderLoadAnchor = (0, react.useRef)(null);
			const allRecords = (0, react.useMemo)(() => flattenRecords(turns), [turns]);
			const streamingCellsByIndex = (0, react.useMemo)(() => new Map(streamingCells.map((cell) => [cell.index, cell])), [streamingCells]);
			const currentRecord = (0, react.useCallback)((record) => {
				const cell = streamingCellsByIndex.get(record.cell.index);
				return cell === void 0 ? record : {
					...record,
					cell
				};
			}, [streamingCellsByIndex]);
			const selectedTemplate = (0, react.useMemo)(() => selectedRecordId === null ? void 0 : allRecords.find((record) => trajectoryRecordId(record.cell) === selectedRecordId), [allRecords, selectedRecordId]);
			const selected = selectedTemplate === void 0 ? void 0 : currentRecord(selectedTemplate);
			const selectedProgram = selected === void 0 ? void 0 : codeProgram(selected.cell);
			const thinkingExpanded = thinkingDisclosure?.recordId === selectedRecordId ? thinkingDisclosure.expanded : selected?.cell.kind === "message" && Boolean(selected.cell.thinkingDetail?.trim());
			const setThinkingExpanded = (expanded) => {
				if (selectedRecordId !== null) setThinkingDisclosure({
					recordId: selectedRecordId,
					expanded
				});
			};
			const selectedIndex = selected?.cell.index ?? null;
			(0, react.useEffect)(() => {
				onSelectedIndexChange?.(selectedIndex);
			}, [onSelectedIndexChange, selectedIndex]);
			const requestGroups = (0, react.useMemo)(() => new Set((sessionRequestNumbers ?? []).map((request) => requestKey(request.turn, request.group))), [sessionRequestNumbers]);
			const requestBoundaries = (0, react.useMemo)(() => indexRequestBoundaries(allRecords, requestGroups), [allRecords, requestGroups]);
			const requestNumbers = (0, react.useMemo)(() => indexRequestNumbers(sessionRequestNumbers), [sessionRequestNumbers]);
			const records = (0, react.useMemo)(() => {
				if (searchMatchIndexes !== null) return filterRecords(allRecords, searchMatchIndexes);
				const turnRecords = collapsedTurns.size === 0 ? allRecords : collapseTurnRecords(allRecords, collapsedTurns, requestGroups, t);
				return collapsedAssistants.size === 0 ? turnRecords : collapseAssistantRecords(turnRecords, collapsedAssistants, t);
			}, [
				allRecords,
				collapsedAssistants,
				collapsedTurns,
				requestGroups,
				searchMatchIndexes,
				t
			]);
			const projectedVirtualRows = (0, react.useMemo)(() => groupTrajectoryVirtualRows(records), [records]);
			const virtualRowStructure = useStableVirtualRowStructure(projectedVirtualRows);
			const virtualizationEnabled = hasOlderRecords || records.length > VIRTUALIZATION_THRESHOLD;
			const virtualScrollMargin = hasOlderRecords ? HISTORY_LOAD_ROW_HEIGHT_PX : 0;
			const estimateVirtualRowSize = (0, react.useCallback)((index) => virtualRowStructure[index]?.height ?? 30, [virtualRowStructure]);
			const getVirtualRowKey = (0, react.useCallback)((index) => virtualRowStructure[index]?.key ?? index, [virtualRowStructure]);
			const getTableScrollElement = (0, react.useCallback)(() => tablePaneRef.current, []);
			const rowVirtualizer = (0, _tanstack_react_virtual.useVirtualizer)({
				count: virtualizationEnabled ? virtualRowStructure.length : 0,
				enabled: virtualizationEnabled,
				estimateSize: estimateVirtualRowSize,
				getItemKey: getVirtualRowKey,
				getScrollElement: getTableScrollElement,
				initialRect: {
					width: 0,
					height: VIRTUAL_INITIAL_VIEWPORT_HEIGHT_PX
				},
				anchorTo: "end",
				overscan: VIRTUAL_OVERSCAN_ROWS,
				scrollMargin: virtualScrollMargin,
				scrollEndThreshold: BOTTOM_FOLLOW_THRESHOLD_PX,
				followOnAppend: "auto"
			});
			const virtualIndexByRecordId = (0, react.useMemo)(() => {
				const indexes = /* @__PURE__ */ new Map();
				for (const [virtualIndex, row] of projectedVirtualRows.entries()) for (const entry of row.entries) if (entry.record.collapsedSummary === void 0) indexes.set(trajectoryRecordId(entry.record.cell), virtualIndex);
				return indexes;
			}, [projectedVirtualRows]);
			const virtualItems = virtualizationEnabled ? rowVirtualizer.getVirtualItems() : [];
			const virtualTop = Math.max(0, (virtualItems[0]?.start ?? 0) - virtualScrollMargin);
			const virtualBottom = virtualItems.length === 0 ? 0 : Math.max(0, rowVirtualizer.getTotalSize() + virtualScrollMargin - (virtualItems.at(-1)?.end ?? 0));
			const renderedRecords = virtualizationEnabled ? virtualItems.flatMap((item) => {
				const row = projectedVirtualRows[item.index];
				if (row === void 0) return [];
				return row.entries.map((entry, entryIndex) => ({
					record: currentRecord(entry.record),
					position: entry.logicalIndex,
					terminalRequestBoundary: entry.record.cell.requestOnly === true && row.entries.at(-1)?.record.cell.requestOnly === true && entryIndex === row.entries.length - 1
				}));
			}) : records.map((record, position) => ({
				record: currentRecord(record),
				position,
				terminalRequestBoundary: record.cell.requestOnly === true && position === records.length - 1
			}));
			const requestBoundaryRuns = (0, react.useMemo)(() => indexRequestBoundaryRuns(records, requestGroups), [records, requestGroups]);
			const selectedPrompt = selected?.cell.kind === "system" ? selected.cell.promptDetail : void 0;
			const selectedPreviousPrompt = selected?.cell.kind === "system" ? selected.cell.previousPromptDetail : void 0;
			const selectedSystemPrompt = selectedPrompt?.system ?? selected?.cell.systemPromptDetail;
			const promptSelected = selectedSystemPrompt !== void 0;
			const selectedState = selected === void 0 ? void 0 : stateOf(selected);
			const selectedRequestInfo = selectedRequest === null ? void 0 : sessionRequestNumbers?.find((request) => requestIdentity(request) === selectedRequest.identity);
			const selectedRequestRecords = (0, react.useMemo)(() => selectedRequestInfo === void 0 ? [] : allRecords.filter((record) => record.turn === selectedRequestInfo.turn && record.group === selectedRequestInfo.group), [allRecords, selectedRequestInfo]).map(currentRecord);
			const selectedRequestAssistant = selectedRequestRecords.find((record) => record.cell.kind === "message" && record.cell.requestOnly !== true);
			const selectedRequestAnchor = selectedRequestAssistant ?? selectedRequestRecords[0];
			const selectedRequestNumber = selectedRequestInfo?.number;
			const selectedRequestState = selectedRequestInfo === void 0 ? void 0 : selectedRequestInfo.status ?? (selectedRequestAssistant?.cell.assistantMetrics?.completedTime === null ? "running" : selectedRequestAssistant === void 0 && selectedRequestRecords.some((record) => stateOf(record) === "running") ? "running" : "complete");
			const selectedRequestToolCalls = selectedRequestRecords.filter((record) => record.cell.kind === "tool").length;
			const selectedRequestSubtoolCalls = selectedRequestRecords.filter((record) => record.cell.kind === "subtool").length;
			const selectedRequestResultTemplate = selectedRequestInfo?.resultSeq === void 0 ? selectedRequestAssistant : allRecords.find((record) => record.cell.sourceSeq === selectedRequestInfo.resultSeq);
			const selectedRequestResult = selectedRequestResultTemplate === void 0 ? void 0 : currentRecord(selectedRequestResultTemplate);
			const selectedRequestUsage = selectedRequestInfo?.usage ?? (selectedRequestAssistant === void 0 ? void 0 : {
				...selectedRequestAssistant.cell.input === void 0 ? {} : { input: selectedRequestAssistant.cell.input },
				...selectedRequestAssistant.cell.cacheRead === void 0 ? {} : { cacheRead: selectedRequestAssistant.cell.cacheRead },
				...selectedRequestAssistant.cell.cacheWrite === void 0 ? {} : { cacheWrite: selectedRequestAssistant.cell.cacheWrite },
				...selectedRequestAssistant.cell.output === void 0 ? {} : { output: selectedRequestAssistant.cell.output },
				...selectedRequestAssistant.cell.think === void 0 ? {} : { reasoning: selectedRequestAssistant.cell.think }
			});
			const selectedRequestCumulativeUsage = selectedRequestInfo?.cumulativeUsage ?? selectedRequestUsage;
			const selectedRequestOptions = selectedRequestInfo?.requestConfig;
			const activeTurn = selectedRequestInfo === void 0 ? selected?.turn : selectedRequestInfo.turn;
			const activeSection = selectedRequestInfo === void 0 ? selected?.section : selectedRequestRecords[0]?.section;
			const selectedTabs = selectedRequestInfo !== void 0 ? REQUEST_TABS.filter((tab) => tab.id !== "options" || selectedRequestOptions !== void 0) : selected === void 0 ? [] : detailTabs(selected);
			const selectedParents = selected === void 0 ? {} : parentRecords(allRecords, selected);
			const selectedParentMessage = selectedParents.message;
			const selectedParentTool = selectedParents.tool;
			const selectedAssistantRequest = selected?.cell.kind === "message" ? requestNumbers.get(requestKey(selected.turn, selected.group)) : void 0;
			const selectedAssistantRequestInfo = selectedAssistantRequest === void 0 ? void 0 : sessionRequestNumbers?.find((request) => request.number === selectedAssistantRequest);
			const selectedAssistantRequestTarget = selectedAssistantRequestInfo === void 0 ? void 0 : { identity: requestIdentity(selectedAssistantRequestInfo) };
			const hasSelectedHierarchy = selectedAssistantRequestTarget !== void 0 || selectedParents.message !== void 0 || selectedParents.tool !== void 0;
			const splitStyle = toolRequestOffset === null ? void 0 : { "--trajectory-tool-request-width": `calc(58cqw - ${toolRequestOffset}px)` };
			const activateTab = (tab) => {
				setCodeWrappingOnOpen(stringWrapping?.getDefault() ?? false);
				tabHistory.current.delete(tab);
				tabHistory.current.add(tab);
				setActiveTab(tab);
			};
			const clearInspectorSelection = () => {
				setSelectedRecordId(null);
				setSelectedRequest(null);
			};
			const clearAllSelections = () => {
				clearInspectorSelection();
				onClearSelection?.();
			};
			const selectRecord = (0, react.useCallback)((index) => {
				setCodeWrappingOnOpen(stringWrapping?.getDefault() ?? false);
				const record = allRecords.find((candidate) => candidate.cell.index === index);
				onRecordSelect?.(index);
				setSelectedRequest(null);
				setSelectedRecordId(record === void 0 ? null : trajectoryRecordId(record.cell));
				if (record === void 0) return;
				const tabs = detailTabs(record);
				const available = new Set(tabs.map((tab) => tab.id));
				setActiveTab([...tabHistory.current].reverse().find((tab) => available.has(tab)) ?? tabs[0]?.id ?? "overview");
			}, [
				allRecords,
				onRecordSelect,
				stringWrapping
			]);
			(0, react.useEffect)(() => {
				if (recordSelection === null || appliedRecordSelection.current === recordSelection) return;
				appliedRecordSelection.current = recordSelection;
				selectRecord(recordSelection.index);
				const record = allRecords.find((candidate) => candidate.cell.index === recordSelection.index);
				pendingScrollRecordId.current = record === void 0 ? null : trajectoryRecordId(record.cell);
			}, [
				allRecords,
				recordSelection,
				selectRecord
			]);
			(0, react.useEffect)(() => {
				if (recordFocus === null || appliedRecordFocus.current === recordFocus) return;
				appliedRecordFocus.current = recordFocus;
				const record = allRecords.find((candidate) => candidate.cell.index === recordFocus.index);
				pendingScrollRecordId.current = record === void 0 ? null : trajectoryRecordId(record.cell);
			}, [allRecords, recordFocus]);
			const selectRequest = (request, tab = "overview") => {
				setSelectedRecordId(null);
				setSelectedRequest(request);
				activateTab(tab);
			};
			const openRecordSummary = (target) => {
				const targetAt = allRecords.findIndex((record) => record.cell.index === target.cell.index);
				if (target.turn !== null && collapsedTurns.has(target.turn)) onToggleTurn(target.turn);
				if (target.cell.kind === "tool" || target.cell.kind === "subtool") for (let i = targetAt - 1; i >= 0; i--) {
					const candidate = allRecords[i];
					if (candidate === void 0 || candidate.turn !== target.turn) break;
					if (candidate.cell.kind !== "message") continue;
					const assistantId = trajectoryRecordId(candidate.cell);
					if (collapsedAssistants.has(assistantId)) onToggleAssistant(assistantId);
					break;
				}
				setSelectedRequest(null);
				setSelectedRecordId(trajectoryRecordId(target.cell));
				activateTab("overview");
			};
			const openCallSummary = (callId) => {
				const target = allRecords.find((record) => record.cell.callId === callId);
				if (target !== void 0) openRecordSummary(target);
			};
			const openRecordSummaryRef = (0, react.useRef)(openRecordSummary);
			openRecordSummaryRef.current = openRecordSummary;
			(0, react.useEffect)(() => {
				if (inspectCallId === null) return;
				const target = flattenRecords(turns).find((record) => record.cell.callId === inspectCallId);
				if (target === void 0) return;
				openRecordSummaryRef.current(target);
				pendingScrollRecordId.current = trajectoryRecordId(target.cell);
				onInspectApplied?.();
			}, [
				inspectCallId,
				turns,
				onInspectApplied
			]);
			(0, react.useEffect)(() => {
				const id = pendingScrollRecordId.current;
				if (id === null) return;
				const position = records.findIndex((record) => trajectoryRecordId(record.cell) === id && record.collapsedSummary === void 0);
				if (position === -1) return;
				if (virtualizationEnabled) {
					const virtualIndex = virtualIndexByRecordId.get(id);
					if (virtualIndex === void 0) return;
					pendingScrollRecordId.current = null;
					followsTableTail.current = false;
					rowVirtualizer.scrollToIndex(virtualIndex, {
						behavior: "smooth",
						align: "center"
					});
					return;
				}
				pendingScrollRecordId.current = null;
				followsTableTail.current = false;
				const recordIndex = records[position]?.cell.index;
				const row = recordIndex === void 0 ? null : rootRef.current?.querySelector(`tr[data-record-index="${recordIndex}"]`);
				/* v8 ignore next -- jsdom lacks scrollIntoView; browsers always have it. */
				if (row !== void 0 && row !== null && typeof row.scrollIntoView === "function") row.scrollIntoView({
					behavior: "smooth",
					block: "center"
				});
			}, [
				records,
				rowVirtualizer,
				virtualIndexByRecordId,
				virtualizationEnabled
			]);
			(0, react.useEffect)(() => {
				if (timelineFocusIndexes === null || timelineFocusIndexes.size === 0) return;
				const focusedPositions = records.flatMap((record, position) => record.collapsedSummary === void 0 && record.cell.requestOnly !== true && timelineFocusIndexes.has(record.cell.index) ? [position] : []);
				const first = focusedPositions.at(0);
				const last = focusedPositions.at(-1);
				if (first === void 0 || last === void 0) return;
				if (!virtualizationEnabled) {
					const ledger = rootRef.current;
					if (ledger === null) return;
					const focusedRows = [...ledger.querySelectorAll("tr[data-timeline-focus=\"inside\"]")];
					const firstRow = focusedRows.at(0);
					const lastRow = focusedRows.at(-1);
					if (firstRow === void 0 || lastRow === void 0) return;
					const focusHeight = lastRow.getBoundingClientRect().bottom - firstRow.getBoundingClientRect().top;
					const target = focusHeight > ledger.clientHeight ? firstRow : focusedRows[Math.floor((focusedRows.length - 1) / 2)];
					/* v8 ignore next -- jsdom lacks scrollIntoView; browsers always have it. */
					if (target !== void 0 && typeof target.scrollIntoView === "function") {
						followsTableTail.current = false;
						target.scrollIntoView({
							behavior: "smooth",
							block: focusHeight > ledger.clientHeight ? "start" : "center"
						});
					}
					return;
				}
				const focusedVirtualIndexes = [...new Set(focusedPositions.flatMap((position) => {
					const record = records[position];
					if (record === void 0) return [];
					const virtualIndex = virtualIndexByRecordId.get(trajectoryRecordId(record.cell));
					return virtualIndex === void 0 ? [] : [virtualIndex];
				}))].sort((left, right) => left - right);
				const firstVirtual = focusedVirtualIndexes.at(0);
				const lastVirtual = focusedVirtualIndexes.at(-1);
				if (firstVirtual === void 0 || lastVirtual === void 0) return;
				const paneHeight = tablePaneRef.current?.clientHeight ?? 0;
				const focusHeight = projectedVirtualRows.slice(firstVirtual, lastVirtual + 1).reduce((height, row) => height + row.height, 0);
				followsTableTail.current = false;
				rowVirtualizer.scrollToIndex(focusHeight > paneHeight ? firstVirtual : focusedVirtualIndexes[Math.floor((focusedVirtualIndexes.length - 1) / 2)] ?? firstVirtual, {
					behavior: "smooth",
					align: focusHeight > paneHeight ? "start" : "center"
				});
			}, [
				projectedVirtualRows,
				records,
				rowVirtualizer,
				timelineFocusIndexes,
				virtualIndexByRecordId,
				virtualizationEnabled
			]);
			const requestOlder = (0, react.useCallback)((pane, requireTop) => {
				if (!hasOlderRecords || onLoadOlder === void 0 || loadingOlder.current || olderHistoryLoading || requireTop && pane.scrollTop > OLDER_LOAD_THRESHOLD_PX) return;
				loadingOlder.current = true;
				setOlderLoading(true);
				olderLoadAnchor.current = {
					historyStartSeq,
					scrollHeight: pane.scrollHeight,
					scrollTop: pane.scrollTop
				};
				onLoadOlder().then((advanced) => {
					if (!advanced) olderLoadAnchor.current = null;
				}).finally(() => {
					loadingOlder.current = false;
					setOlderLoading(false);
				});
			}, [
				hasOlderRecords,
				historyStartSeq,
				olderHistoryLoading,
				onLoadOlder
			]);
			(0, react.useLayoutEffect)(() => {
				const pane = tablePaneRef.current;
				if (pane === null) return;
				const anchor = olderLoadAnchor.current;
				if (anchor !== null && anchor.historyStartSeq !== historyStartSeq) {
					if (!virtualizationEnabled) pane.scrollTop = anchor.scrollTop + pane.scrollHeight - anchor.scrollHeight;
					olderLoadAnchor.current = null;
					followsTableTail.current = false;
					return;
				}
				if (!tableScrollInitialized.current) {
					if (historyLoading) return;
					tableScrollInitialized.current = true;
					followsTableTail.current = true;
					if (virtualizationEnabled) rowVirtualizer.scrollToEnd({ behavior: "auto" });
					else pane.scrollTop = pane.scrollHeight;
					setTableScrollReady(true);
					return;
				}
				if (!followsTableTail.current) return;
				if (!virtualizationEnabled) pane.scrollTop = pane.scrollHeight;
			}, [
				historyLoading,
				historyStartSeq,
				rowVirtualizer,
				virtualRowStructure,
				virtualizationEnabled
			]);
			const olderBusy = olderHistoryLoading || olderLoading;
			const showInitialLoading = historyLoading || !tableScrollReady;
			const historyRowOffset = hasOlderRecords ? 1 : 0;
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: TrajectoryTable_module_css_default.split,
				style: splitStyle,
})}} // __DSH_FRAGMENT_END__

export {};
