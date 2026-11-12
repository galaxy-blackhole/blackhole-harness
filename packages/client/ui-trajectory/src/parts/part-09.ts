/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-trajectory/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() {{({ // __DSH_FRAGMENT_BEGIN__
				children: [(0, react_jsx_runtime.jsxs)("div", {
					ref: tablePaneRef,
					className: TrajectoryTable_module_css_default.tablePane,
					"data-trajectory-scroll": "",
					onScroll: (event) => {
						const pane = event.currentTarget;
						followsTableTail.current = pane.scrollHeight - pane.clientHeight - pane.scrollTop <= BOTTOM_FOLLOW_THRESHOLD_PX;
						requestOlder(pane, true);
					},
					onClick: (event) => {
						if (event.target === event.currentTarget) clearAllSelections();
					},
					children: [showInitialLoading && (0, react_jsx_runtime.jsx)("div", {
						className: TrajectoryTable_module_css_default.historyLoading,
						role: "status",
						"aria-live": "polite",
						children: (0, react_jsx_runtime.jsxs)("span", {
							className: TrajectoryTable_module_css_default.historyLoadingBar,
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }), t("history.loadingTrajectory")]
						})
					}), (0, react_jsx_runtime.jsxs)("table", {
						className: TrajectoryTable_module_css_default.table,
						"data-scroll-ready": tableScrollReady || void 0,
						"aria-rowcount": records.length + historyRowOffset,
						children: [(0, react_jsx_runtime.jsxs)("colgroup", { children: [(0, react_jsx_runtime.jsx)("col", { className: TrajectoryTable_module_css_default.eventColumn }), (0, react_jsx_runtime.jsx)("col", { className: TrajectoryTable_module_css_default.contentColumn })] }), (0, react_jsx_runtime.jsxs)("tbody", { children: [
							hasOlderRecords && (0, react_jsx_runtime.jsx)("tr", {
								className: TrajectoryTable_module_css_default.historyLoadRow,
								"data-history-load": "",
								"aria-rowindex": 1,
								children: (0, react_jsx_runtime.jsx)("td", {
									colSpan: 2,
									children: (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: TrajectoryTable_module_css_default.historyLoadButton,
										disabled: olderBusy || onLoadOlder === void 0,
										"aria-label": olderBusy ? t("history.loadingEarlierAria") : t("history.loadEarlier"),
										onClick: () => {
											const pane = tablePaneRef.current;
											if (pane !== null) requestOlder(pane, false);
										},
										children: [
											olderBusy && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }),
											(0, react_jsx_runtime.jsx)("span", {
												"aria-hidden": "true",
												children: olderBusy ? t("history.loadingEarlier") : t("history.loadEarlier")
											}),
											(0, react_jsx_runtime.jsx)("span", {
												className: TrajectoryTable_module_css_default.visuallyHidden,
												role: "status",
												"aria-live": "polite",
												children: olderBusy ? t("history.loadingEarlier") : ""
											})
										]
									})
								})
							}),
							virtualTop > 0 && (0, react_jsx_runtime.jsx)("tr", {
								className: TrajectoryTable_module_css_default.virtualSpacer,
								"data-virtual-spacer": "top",
								"aria-hidden": "true",
								children: (0, react_jsx_runtime.jsx)("td", {
									colSpan: 2,
									style: { "--trajectory-virtual-spacer-height": `${virtualTop}px` }
								})
							}),
							renderedRecords.map(({ record, position, terminalRequestBoundary }) => (0, react_jsx_runtime.jsx)(RecordPresentation, {
								cell: record.cell,
								t,
								children: ({ displayText, listDisplayText, resultText, toolCallOnly, toolCallText }) => {
									const isCollapsedSummary = record.collapsedSummary !== void 0;
									const isRequestOnly = record.cell.requestOnly === true;
									const isInitialSystem = record.cell.kind === "system" && record.cell.index === allRecords[0]?.cell.index;
									const key = requestKey(record.turn, record.group);
									const request = requestBoundaries.get(key) === record.cell.index && !isCollapsedSummary && (record.turn === null || !collapsedTurns.has(record.turn)) ? requestNumbers.get(key) : void 0;
									const requestInfo = request === void 0 ? void 0 : sessionRequestNumbers?.find((candidate) => candidate.number === request);
									const requestStatus = requestInfo?.status ?? (record.cell.isError === true ? "error" : void 0);
									const requestRunIndex = requestBoundaryRuns.get(record.cell.index) ?? 0;
									const requestBoundaryStyle = { "--request-boundary-offset": `${requestRunIndex * 8}px` };
									const requestLabel = request === void 0 ? void 0 : t(requestInfo?.purpose === "compaction" ? "request.labelCompaction" : "request.label", { request });
									const requestSelected = requestInfo !== void 0 && selectedRequest?.identity === requestIdentity(requestInfo);
									const sectionActive = record.turn === null ? activeSection === record.section : activeTurn === record.turn;
									const singleToolNotice = record.cell.kind === "context" && record.cell.sourceBlocks?.length === 1 && record.cell.sourceBlocks.every((block) => block.type === "tool-addition" || block.type === "tool-removal");
									return (0, react_jsx_runtime.jsxs)("tr", {
										tabIndex: isRequestOnly || singleToolNotice ? -1 : 0,
										"aria-rowindex": position + 1 + historyRowOffset,
										"aria-label": isCollapsedSummary ? t("request.collapsedSummary", {
											kind: t(record.collapsedSummaryKind === "turn" ? "request.collapsedTurn" : "request.collapsedAssistant"),
											summary: record.collapsedSummary
										}) : isRequestOnly ? t("request.rowAriaCompaction", { request: request ?? "" }) : t("request.rowAria", {
											request: request === void 0 ? "" : t("request.rowPrefix", { request }),
											kind: t(KIND_LABEL_KEY[record.cell.kind]),
											content: listDisplayText || t("request.noContent")
										}),
										"aria-selected": !isCollapsedSummary && !isRequestOnly && selectedIndex === record.cell.index,
										"data-kind": record.cell.kind,
										"data-trajectory-row-key": trajectoryVirtualRecordKey(record),
										"data-virtual-position": virtualizationEnabled ? position : void 0,
										"data-record-index": !isCollapsedSummary && !isRequestOnly ? record.cell.index : void 0,
										"data-request-only": isRequestOnly || void 0,
										"data-terminal-request-boundary": terminalRequestBoundary || void 0,
										"data-group-start": record.groupStart || void 0,
										"data-turn-start": record.turnStart || void 0,
										"data-error": record.cell.isError || void 0,
										"data-running": stateOf(record) === "running" || void 0,
										"data-turn-end": record.turnEnd || void 0,
										"data-collapsed-summary": record.collapsedSummaryKind,
										"data-selected": !isCollapsedSummary && selectedIndex === record.cell.index || void 0,
										"data-timeline-focus": isCollapsedSummary || timelineFocusIndexes === null ? void 0 : timelineFocusIndexes.has(record.cell.index) ? "inside" : "outside",
										onClick: isRequestOnly || singleToolNotice ? void 0 : isCollapsedSummary ? () => {
											if (record.collapsedSummaryKind === "turn" && record.turn !== null) onToggleTurn(record.turn);
											else onToggleAssistant(trajectoryRecordId(record.cell));
										} : () => {
											selectRecord(record.cell.index);
										},
										onDoubleClick: (event) => {
											if (isCollapsedSummary || isRequestOnly || singleToolNotice) return;
											if (record.turn !== null && collapsedTurns.has(record.turn)) {
												event.preventDefault();
												onToggleTurn(record.turn);
												return;
											}
											if (record.cell.kind === "message" && assistantToolCalls(allRecords, record.cell.index).length > 0) {
												event.preventDefault();
												onToggleAssistant(trajectoryRecordId(record.cell));
												return;
											}
											if (!record.turnStart) return;
											if (record.turn === null) return;
											if (allRecords.filter((candidate) => candidate.turn === record.turn && candidate.cell.requestOnly !== true && candidate.cell.kind !== "system").length <= 1) return;
											event.preventDefault();
											onToggleTurn(record.turn);
										},
										onKeyDown: (event) => {
											if (isRequestOnly || singleToolNotice) return;
											if (event.key !== "Enter" && event.key !== " ") return;
											event.preventDefault();
											if (isCollapsedSummary) {
												if (record.collapsedSummaryKind === "turn" && record.turn !== null) onToggleTurn(record.turn);
												else onToggleAssistant(trajectoryRecordId(record.cell));
												return;
											}
											selectRecord(record.cell.index);
										},
										children: [(0, react_jsx_runtime.jsxs)("td", {
											className: TrajectoryTable_module_css_default.event,
											children: [
												request !== void 0 && (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: requestSelected ? `${TrajectoryTable_module_css_default.requestBoundaryControl} ${TrajectoryTable_module_css_default.requestBoundaryControlActive}` : TrajectoryTable_module_css_default.requestBoundaryControl,
													"aria-label": requestLabel,
													"aria-pressed": requestSelected,
													"data-label": requestLabel,
													"data-request-run-index": requestRunIndex,
													"data-request-status": requestStatus,
													style: requestBoundaryStyle,
													onClick: (event) => {
														event.stopPropagation();
														if (requestInfo !== void 0) selectRequest({ identity: requestIdentity(requestInfo) });
													},
													onDoubleClick: (event) => {
														event.stopPropagation();
													}
												}),
												record.turn !== null && activeTurn === record.turn && !isInitialSystem && (0, react_jsx_runtime.jsx)("span", {
													className: TrajectoryTable_module_css_default.turnRail,
													"aria-hidden": "true"
												}),
												!isCollapsedSummary && selectedIndex === record.cell.index && (0, react_jsx_runtime.jsx)("span", {
													className: TrajectoryTable_module_css_default.selectionRail,
													"aria-hidden": "true"
												}),
												!isCollapsedSummary && !isRequestOnly && record.turnStart && (0, react_jsx_runtime.jsx)("span", {
													className: sectionActive ? `${TrajectoryTable_module_css_default.turnLabel} ${TrajectoryTable_module_css_default.turnLabelActive}` : TrajectoryTable_module_css_default.turnLabel,
													"aria-label": sectionLabel(record.turn, t),
													children: record.turn === null ? sectionLabel(record.turn, t) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
														className: TrajectoryTable_module_css_default.turnLabelFull,
														"aria-hidden": "true",
														children: sectionLabel(record.turn, t)
													}), (0, react_jsx_runtime.jsxs)("span", {
														className: TrajectoryTable_module_css_default.turnLabelCompact,
														"aria-hidden": "true",
														children: ["#", record.turn]
													})] })
												}),
												(0, react_jsx_runtime.jsx)("div", {
													className: TrajectoryTable_module_css_default.eventInner,
													children: !isCollapsedSummary && !isRequestOnly && (0, react_jsx_runtime.jsx)("span", {
														className: TrajectoryTable_module_css_default.kindSlot,
														children: (0, react_jsx_runtime.jsxs)("span", {
															className: `${TrajectoryTable_module_css_default.kindTag} ${record.cell.kind === "system" ? TrajectoryTable_module_css_default.systemNeutral : record.cell.kind === "context" ? TrajectoryTable_module_css_default.contextGreen : record.cell.kind === "compacted" ? TrajectoryTable_module_css_default.compacted : record.cell.kind === "tool" ? TrajectoryTable_module_css_default.toolAmber : record.cell.kind === "message" ? TrajectoryTable_module_css_default.assistantVioletBright : record.cell.kind === "subtool" ? TrajectoryTable_module_css_default.subtoolAmber : TrajectoryTable_module_css_default[record.cell.kind]}`,
															"data-role-kind": record.cell.kind,
															children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
																label: t(KIND_LABEL_KEY[record.cell.kind]),
																side: "right",
																children: (0, react_jsx_runtime.jsx)("span", {
																	className: TrajectoryTable_module_css_default.kindTagIcon,
																	"aria-hidden": "true",
																	children: KIND_ICON[record.cell.kind]
																})
															}), (0, react_jsx_runtime.jsx)("span", {
																className: TrajectoryTable_module_css_default.kindTagLabel,
																children: t(KIND_LABEL_KEY[record.cell.kind])
															})]
														})
													})
												})
											]
										}), (0, react_jsx_runtime.jsx)("td", {
											className: TrajectoryTable_module_css_default.content,
											children: isRequestOnly ? null : record.collapsedSummary !== void 0 ? (0, react_jsx_runtime.jsxs)("span", {
												className: TrajectoryTable_module_css_default.collapsedTurnContent,
												title: record.collapsedSummary,
												children: [(0, react_jsx_runtime.jsx)("span", {
													className: TrajectoryTable_module_css_default.collapsedTurnEllipsis,
													children: "…"
												}), (0, react_jsx_runtime.jsx)("span", {
													className: TrajectoryTable_module_css_default.collapsedTurnText,
													children: record.collapsedSummary
												})]
											}) : (0, react_jsx_runtime.jsxs)("span", {
												className: resultText === void 0 ? TrajectoryTable_module_css_default.contentText : TrajectoryTable_module_css_default.resultPreview,
												title: resultText === void 0 ? listDisplayText : `${listDisplayText} → ${resultText}`,
												children: [(0, react_jsx_runtime.jsx)("span", {
													className: resultText === void 0 ? void 0 : TrajectoryTable_module_css_default.resultRequest,
													children: (0, react_jsx_runtime.jsx)(RecordListText, {
														displayText,
														toolCallOnly,
														toolCallText,
														t
													})
												}), resultText !== void 0 && (0, react_jsx_runtime.jsxs)("span", {
													className: record.cell.isError ? `${TrajectoryTable_module_css_default.inlineResult} ${TrajectoryTable_module_css_default.error}` : TrajectoryTable_module_css_default.inlineResult,
													children: [(0, react_jsx_runtime.jsx)("span", {
														className: TrajectoryTable_module_css_default.arrow,
														children: "→"
													}), (0, react_jsx_runtime.jsx)("span", {
														className: resultText === t("record.noOutput") ? `${TrajectoryTable_module_css_default.inlineResultText} ${TrajectoryTable_module_css_default.noOutputText}` : TrajectoryTable_module_css_default.inlineResultText,
														children: resultText
													})]
												})]
											})
										})]
									});
								}
							}, trajectoryVirtualRecordKey(record))),
							virtualBottom > 0 && (0, react_jsx_runtime.jsx)("tr", {
								className: TrajectoryTable_module_css_default.virtualSpacer,
								"data-virtual-spacer": "bottom",
								"aria-hidden": "true",
								children: (0, react_jsx_runtime.jsx)("td", {
									colSpan: 2,
									style: { "--trajectory-virtual-spacer-height": `${virtualBottom}px` }
								})
							})
						] })]
					})]
				}), (selectedRequestInfo !== void 0 || promptSelected || selected !== void 0 && selectedState !== void 0) && (0, react_jsx_runtime.jsxs)("aside", {
					className: TrajectoryTable_module_css_default.details,
					"aria-label": t("details.event"),
					style: detailsWidth === null ? void 0 : { width: detailsWidth },
					children: [
						(0, react_jsx_runtime.jsx)("div", {
							className: TrajectoryTable_module_css_default.detailsResizeHandle,
							role: "separator",
							"aria-label": t("details.resize"),
							"aria-controls": "trajectory-detail-panel",
							"aria-orientation": "vertical",
							tabIndex: 0,
							title: t("details.resizeTitle"),
							onDoubleClick: () => {
								setDetailsWidth(null);
								setToolRequestOffset(null);
							},
							onPointerDown: (event) => {
								if (event.button !== 0) return;
								const details = event.currentTarget.parentElement;
								if (details === null) return;
								const split = details.parentElement;
								if (split === null) return;
								const splitWidth = split.getBoundingClientRect().width;
								detailsResizeDrag.current = {
									pointerId: event.pointerId,
									startX: event.clientX,
									startWidth: details.getBoundingClientRect().width,
									splitWidth,
									startToolRequestOffset: toolRequestOffset ?? splitWidth * TOOL_REQUEST_SHARE - defaultToolRequestWidth(splitWidth)
								};
								event.currentTarget.setPointerCapture(event.pointerId);
								event.preventDefault();
							},
							onPointerMove: (event) => {
								const drag = detailsResizeDrag.current;
								if (drag === null || drag.pointerId !== event.pointerId) return;
								const nextDetailsWidth = clampDetailsWidth(drag.startWidth + drag.startX - event.clientX, drag.splitWidth);
								setDetailsWidth(nextDetailsWidth);
								setToolRequestOffset(drag.startToolRequestOffset + (nextDetailsWidth - drag.startWidth) * TOOL_REQUEST_SHARE);
							},
							onPointerUp: (event) => {
								if (detailsResizeDrag.current?.pointerId !== event.pointerId) return;
								detailsResizeDrag.current = null;
								event.currentTarget.releasePointerCapture(event.pointerId);
							},
							onPointerCancel: () => {
								detailsResizeDrag.current = null;
							},
							onKeyDown: (event) => {
								if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
								const details = event.currentTarget.parentElement;
								if (details === null) return;
								const split = details.parentElement;
								if (split === null) return;
								const direction = event.key === "ArrowLeft" ? 1 : -1;
								const currentDetailsWidth = details.getBoundingClientRect().width;
								const splitWidth = split.getBoundingClientRect().width;
								const nextDetailsWidth = clampDetailsWidth(currentDetailsWidth + direction * DETAILS_RESIZE_STEP, splitWidth);
								const currentToolRequestOffset = toolRequestOffset ?? splitWidth * TOOL_REQUEST_SHARE - defaultToolRequestWidth(splitWidth);
								setDetailsWidth(nextDetailsWidth);
								setToolRequestOffset(currentToolRequestOffset + (nextDetailsWidth - currentDetailsWidth) * TOOL_REQUEST_SHARE);
								event.preventDefault();
							}
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: TrajectoryTable_module_css_default.detailsHeader,
							children: [(0, react_jsx_runtime.jsx)("div", {
								className: TrajectoryTable_module_css_default.detailsTitle,
								children: selectedRequestInfo !== void 0 ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: TrajectoryTable_module_css_default.requestDetailsDot,
										"aria-hidden": "true"
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: TrajectoryTable_module_css_default.requestDetailsName,
										children: t("request.label", { request: selectedRequestNumber ?? "—" })
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: TrajectoryTable_module_css_default.detailsLocation,
										children: selectedRequestInfo.purpose === "compaction" ? t("request.compaction", { section: sectionLabel(selectedRequestInfo.turn, t) }) : sectionLabel(selectedRequestInfo.turn, t)
									})
								] }) : promptSelected ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
									className: `${TrajectoryTable_module_css_default.kindTag} ${TrajectoryTable_module_css_default.systemNeutral}`,
									children: t("kind.system")
								}), (0, react_jsx_runtime.jsx)("span", {
									className: TrajectoryTable_module_css_default.detailsLocation,
									children: selected?.cell.text
								})] }) : selected !== void 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
									className: `${TrajectoryTable_module_css_default.kindTag} ${selected.cell.kind === "context" ? TrajectoryTable_module_css_default.contextGreen : selected.cell.kind === "compacted" ? TrajectoryTable_module_css_default.compacted : selected.cell.kind === "tool" ? TrajectoryTable_module_css_default.toolAmber : selected.cell.kind === "message" ? TrajectoryTable_module_css_default.assistantVioletBright : selected.cell.kind === "subtool" ? TrajectoryTable_module_css_default.subtoolAmber : TrajectoryTable_module_css_default[selected.cell.kind]}`,
									children: t(KIND_LABEL_KEY[selected.cell.kind])
								}), (0, react_jsx_runtime.jsx)("span", {
									className: TrajectoryTable_module_css_default.detailsLocation,
									children: selected.cell.kind === "compacted" ? sectionLabel(selected.turn, t) : `${sectionLabel(selected.turn, t)} · ${selected.group}`
								})] })
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: TrajectoryTable_module_css_default.close,
								"aria-label": t("details.close"),
								onClick: clearInspectorSelection,
								children: (0, react_jsx_runtime.jsx)("span", {
									"aria-hidden": "true",
									children: "×"
								})
							})]
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: TrajectoryTable_module_css_default.detailTabs,
							role: "tablist",
							"aria-label": t("details.event"),
							children: selectedTabs.map((tab) => (0, react_jsx_runtime.jsx)("button", {
								id: `trajectory-detail-${tab.id}`,
								type: "button",
								role: "tab",
								"aria-controls": "trajectory-detail-panel",
								"aria-selected": activeTab === tab.id,
								className: activeTab === tab.id ? `${TrajectoryTable_module_css_default.detailTab} ${TrajectoryTable_module_css_default.detailTabActive}` : TrajectoryTable_module_css_default.detailTab,
								onClick: () => {
									activateTab(tab.id);
								},
								children: t(tab.labelKey)
							}, tab.id))
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							id: "trajectory-detail-panel",
							className: activeTab === "overview" ? `${TrajectoryTable_module_css_default.detailBody} ${TrajectoryTable_module_css_default.detailBodySummary}` : selectedProgram !== void 0 && (activeTab === "input" || activeTab === "output") ? `${TrajectoryTable_module_css_default.detailBody} ${TrajectoryTable_module_css_default.detailBodyProgram}` : TrajectoryTable_module_css_default.detailBody,
							role: "tabpanel",
							"aria-labelledby": `trajectory-detail-${activeTab}`,
							children: [
								selectedRequestInfo !== void 0 && selectedRequestState !== void 0 && activeTab === "overview" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("dl", {
									className: `${TrajectoryTable_module_css_default.overview} ${TrajectoryTable_module_css_default.summaryScrollRegion}`,
									"data-summary-scroll-region": "",
									children: [
										(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("details.status") }), (0, react_jsx_runtime.jsx)("dd", {
											className: selectedRequestState === "error" ? TrajectoryTable_module_css_default.error : void 0,
											children: statusLabel(selectedRequestState, t)
										})] }),
										selectedRequestInfo.purpose === "compaction" && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("details.purpose") }), (0, react_jsx_runtime.jsx)("dd", { children: t("request.compactionPurpose") })] }),
										(selectedRequestInfo.provider ?? selectedRequestInfo.requestConfig?.provider) !== void 0 && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("details.provider") }), (0, react_jsx_runtime.jsx)("dd", { children: selectedRequestInfo.provider ?? selectedRequestInfo.requestConfig?.provider })] }),
										(selectedRequestInfo.model ?? selectedRequestInfo.requestConfig?.model) !== void 0 && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("details.model") }), (0, react_jsx_runtime.jsx)("dd", { children: selectedRequestInfo.model ?? selectedRequestInfo.requestConfig?.model })] }),
										(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("details.toolCalls") }), (0, react_jsx_runtime.jsx)("dd", { children: selectedRequestToolCalls })] }),
										selectedRequestSubtoolCalls > 0 && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("details.subtoolCalls") }), (0, react_jsx_runtime.jsx)("dd", { children: selectedRequestSubtoolCalls })] }),
										selectedRequestInfo.error !== void 0 && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t(selectedRequestState !== "error" && selectedRequestInfo.retry !== void 0 ? "details.lastAttemptError" : "details.error") }), (0, react_jsx_runtime.jsx)("dd", {
											className: selectedRequestState === "error" ? TrajectoryTable_module_css_default.error : void 0,
											children: requestErrorMessage(selectedRequestInfo, t)
										})] }),
										selectedRequestInfo.retry !== void 0 && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("details.retry") }), (0, react_jsx_runtime.jsx)("dd", { children: selectedRequestInfo.maxRetries === void 0 ? selectedRequestInfo.retry : t("request.retryProgress", {
											retry: selectedRequestInfo.retry,
											maximum: selectedRequestInfo.maxRetries
										}) })] }),
										selectedRequestInfo.retryDelayMs !== void 0 && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("details.retryDelay") }), (0, react_jsx_runtime.jsx)("dd", { children: formatDurationMs(selectedRequestInfo.retryDelayMs, t) })] }),
										selectedRequestResult !== void 0 && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("details.result") }), (0, react_jsx_runtime.jsx)("dd", {
											className: TrajectoryTable_module_css_default.overviewParentLinks,
											children: (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: TrajectoryTable_module_css_default.overviewHierarchyNavLink,
												onClick: () => {
													openRecordSummary(selectedRequestResult);
												},
												children: [(0, react_jsx_runtime.jsx)("span", { children: selectedRequestInfo.purpose === "compaction" ? t("details.compacted") : t("details.assistantMessage") }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
													className: TrajectoryTable_module_css_default.overviewHierarchyJumpIconTight,
													size: 11
												})]
											})
										})] })
									]
								}), (0, react_jsx_runtime.jsxs)("div", {
									className: TrajectoryTable_module_css_default.overviewSections,
									children: [
										selectedRequestOptions !== void 0 && (0, react_jsx_runtime.jsx)(OverviewSection, {
											label: t("tab.options"),
											onOpen: () => {
												activateTab("options");
											},
											children: (0, react_jsx_runtime.jsx)(RequestOptions, {
												options: selectedRequestOptions,
												preview: true,
												stringWrapping,
												t
											})
										}),
										(0, react_jsx_runtime.jsx)(OverviewSection, {
											label: t("tab.usage"),
											onOpen: () => {
												activateTab("usage");
											},
											children: (0, react_jsx_runtime.jsx)(UsageRows, {
												usage: selectedRequestUsage,
												t
											})
										}),
										(0, react_jsx_runtime.jsx)(OverviewSection, {
											label: t("tab.timing"),
											onOpen: () => {
												activateTab("timing");
											},
											children: (0, react_jsx_runtime.jsx)(RequestTiming, {
												assistant: selectedRequestAssistant,
												anchor: selectedRequestAnchor,
												request: selectedRequestInfo,
												preview: true,
												t
											})
										})
									]
								})] }),
								selectedRequestInfo !== void 0 && activeTab === "options" && (0, react_jsx_runtime.jsx)(RequestOptions, {
									options: selectedRequestOptions,
									stringWrapping,
									t
								}),
								selectedRequestInfo !== void 0 && activeTab === "usage" && (0, react_jsx_runtime.jsx)(RequestUsagePanel, {
									usage: selectedRequestUsage,
									cumulative: selectedRequestCumulativeUsage,
									t
								}),
								selectedRequestInfo !== void 0 && activeTab === "timing" && (0, react_jsx_runtime.jsx)(RequestTiming, {
									assistant: selectedRequestAssistant,
									anchor: selectedRequestAnchor,
									request: selectedRequestInfo,
									t
								}),
								selectedPrompt !== void 0 && selectedPreviousPrompt !== void 0 && activeTab === "diff" && (0, react_jsx_runtime.jsx)(SystemPromptDiff, {
									before: selectedPreviousPrompt,
									after: selectedPrompt,
									t
								}),
								promptSelected && activeTab === "system-prompt" && (selectedSystemPrompt === "" ? (0, react_jsx_runtime.jsx)("p", {
									className: TrajectoryTable_module_css_default.noPayload,
									children: t("record.systemPromptMissing")
								}) : (0, react_jsx_runtime.jsx)("div", {
									className: `${TrajectoryTable_module_css_default.markdownPayload} ${TrajectoryTable_module_css_default.systemPrompt}`,
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
										text: selectedSystemPrompt,
										labels: markdownLabels(t)
									})
								})),
								selectedPrompt !== void 0 && activeTab === "tools" && (0, react_jsx_runtime.jsx)(ToolCatalog, {
									tools: selectedPrompt.tools,
									stringWrapping,
									t
								}),
								!promptSelected && selected?.cell.kind === "compacted" && selectedState !== void 0 && activeTab === "overview" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("dl", {
									className: `${TrajectoryTable_module_css_default.overview} ${TrajectoryTable_module_css_default.summaryScrollRegion}`,
									"data-summary-scroll-region": "",
									children: [
										(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("details.status") }), (0, react_jsx_runtime.jsx)("dd", {
											className: selectedState === "error" ? TrajectoryTable_module_css_default.error : void 0,
											children: statusLabel(selectedState, t)
										})] }),
										(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.duration") }), (0, react_jsx_runtime.jsx)("dd", { children: formatElapsedSeconds(selected.cell.timeSeconds, t) })] }),
										(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("usage.tokens") }), (0, react_jsx_runtime.jsx)("dd", { children: "—" })] })
									]
								}), selected.cell.outputDetail !== void 0 && (0, react_jsx_runtime.jsx)("div", {
									className: `${TrajectoryTable_module_css_default.compactedSummary} ${TrajectoryTable_module_css_default.summaryScrollRegion}`,
									"data-summary-scroll-region": "",
									children: (0, react_jsx_runtime.jsx)(MarkdownRecordContent, {
										record: selected,
										renderSlot,
										loadImage,
										rendered: true,
										thinkingExpanded,
										onThinkingExpandedChange: setThinkingExpanded,
										onOpenCall: openCallSummary,
										t
									})
								})] }),
								!promptSelected && selected !== void 0 && selected.cell.kind !== "compacted" && selectedState !== void 0 && activeTab === "overview" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									selectedProgram !== void 0 && selectedProgram.description !== "" && (0, react_jsx_runtime.jsx)("p", {
										className: TrajectoryTable_module_css_default.programDescription,
										children: selectedProgram.description
									}),
									(0, react_jsx_runtime.jsxs)("dl", {
										className: `${TrajectoryTable_module_css_default.overview} ${TrajectoryTable_module_css_default.summaryScrollRegion}`,
										"data-summary-scroll-region": "",
										children: [
											selected.cell.messageSource !== void 0 && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("details.source") }), (0, react_jsx_runtime.jsx)("dd", {
												className: TrajectoryTable_module_css_default.overviewParentLinks,
												children: (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: TrajectoryTable_module_css_default.overviewHierarchyNavLink,
													onClick: () => {
														activateTab("source");
													},
													children: [(0, react_jsx_runtime.jsx)("span", { children: messageSourceLabel(selected.cell.messageSource, t) }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
														className: TrajectoryTable_module_css_default.overviewHierarchyJumpIconTight,
														size: 11
													})]
												})
											})] }),
											hasSelectedHierarchy && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: selectedAssistantRequestTarget !== void 0 ? t("details.source") : t("details.hierarchy") }), (0, react_jsx_runtime.jsxs)("dd", {
												className: TrajectoryTable_module_css_default.overviewParentLinks,
												children: [
													selectedAssistantRequestTarget !== void 0 && (0, react_jsx_runtime.jsxs)("button", {
														type: "button",
														className: TrajectoryTable_module_css_default.overviewHierarchyNavLink,
														onClick: () => {
															selectRequest(selectedAssistantRequestTarget);
														},
														children: [(0, react_jsx_runtime.jsx)("span", { children: t("request.label", { request: selectedAssistantRequest ?? "—" }) }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
															className: TrajectoryTable_module_css_default.overviewHierarchyJumpIconTight,
															size: 11
														})]
													}),
													selectedParentMessage !== void 0 && (0, react_jsx_runtime.jsxs)("button", {
														type: "button",
														className: TrajectoryTable_module_css_default.overviewHierarchyNavLink,
														onClick: () => {
															openRecordSummary(selectedParentMessage);
														},
														children: [(0, react_jsx_runtime.jsx)("span", { children: t("details.assistantMessage") }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
															className: TrajectoryTable_module_css_default.overviewHierarchyJumpIconTight,
															size: 11
														})]
													}),
													selectedParentTool !== void 0 && (0, react_jsx_runtime.jsxs)("button", {
														type: "button",
														className: TrajectoryTable_module_css_default.overviewHierarchyNavLink,
														onClick: () => {
															openRecordSummary(selectedParentTool);
														},
														children: [(0, react_jsx_runtime.jsx)("span", { children: t("details.toolCall") }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
															className: TrajectoryTable_module_css_default.overviewHierarchyJumpIconTight,
															size: 11
														})]
													})
												]
											})] }),
											(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("details.status") }), (0, react_jsx_runtime.jsx)("dd", {
												className: selectedState === "error" ? TrajectoryTable_module_css_default.error : void 0,
												children: statusLabel(selectedState, t)
											})] }),
											selected.cell.kind === "message" && (0, react_jsx_runtime.jsx)(TokenRows, {
												cell: selected.cell,
												t
											}),
											(selected.cell.kind === "user" || selected.cell.kind === "context") && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.duration") }), (0, react_jsx_runtime.jsx)("dd", { children: formatElapsedSeconds(selected.cell.timeSeconds, t) })] })
										]
									}),
									(0, react_jsx_runtime.jsxs)("div", {
										className: TrajectoryTable_module_css_default.overviewSections,
										children: [
											selectedProgram !== void 0 ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(ProgramInput, {
												program: selectedProgram,
												initialWrapped: codeWrappingOnOpen,
												stringWrapping,
												onOpen: () => {
													activateTab("input");
												},
												t
											}, `preview:${selectedRecordId}`), (0, react_jsx_runtime.jsx)(ProgramOutput, {
												record: selected,
												stringWrapping,
												onOpen: () => {
													activateTab("output");
												},
												t
											})] }) : isMarkdownRecord(selected) ? (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: (0, react_jsx_runtime.jsx)(OverviewSection, {
												label: t("tab.preview"),
												onOpen: () => {
													activateTab("rendered");
												},
												children: (0, react_jsx_runtime.jsx)(MarkdownRecordContent, {
													record: selected,
													renderSlot,
													loadImage,
													rendered: true,
													preview: true,
													thinkingExpanded,
													onThinkingExpandedChange: setThinkingExpanded,
													onOpenCall: openCallSummary,
													t
												})
											}) }) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
												selected.cell.inputDetail && (0, react_jsx_runtime.jsx)(OverviewSection, {
													label: t("tab.payload"),
													onOpen: () => {
														activateTab("input");
													},
													children: (0, react_jsx_runtime.jsx)(RecordPayload, {
														record: selected,
														direction: "input",
														preview: true,
														renderSlot,
														loadImage,
														stringWrapping,
														t
													})
												}),
												selected.cell.outputDetail && (0, react_jsx_runtime.jsx)(OverviewSection, {
													label: t("tab.result"),
													onOpen: () => {
														activateTab("output");
													},
													children: (0, react_jsx_runtime.jsx)(RecordPayload, {
														record: selected,
														direction: "output",
														preview: true,
														renderSlot,
														loadImage,
														stringWrapping,
														t
													})
												}),
												(0, react_jsx_runtime.jsx)(OverviewSection, {
													label: t("tab.schema"),
													onOpen: () => {
														activateTab("schema");
													},
													children: (0, react_jsx_runtime.jsx)(RecordSchema, {
														record: selected,
														preview: true,
														stringWrapping,
														t
													})
												})
											] }),
											selectedAssistantRequestTarget !== void 0 && (0, react_jsx_runtime.jsx)(OverviewSection, {
												label: t("timing.request"),
												onOpen: () => {
													selectRequest(selectedAssistantRequestTarget, "timing");
												},
												children: (0, react_jsx_runtime.jsx)(RecordTiming, {
													record: selected,
													preview: true,
													t
												})
											}),
											(selected.cell.kind === "tool" || selected.cell.kind === "subtool") && (0, react_jsx_runtime.jsx)(OverviewSection, {
												label: t("tab.timing"),
												onOpen: () => {
													activateTab("timing");
												},
												children: (0, react_jsx_runtime.jsx)(RecordTiming, {
													record: selected,
													preview: true,
													t
												})
											})
										]
									})
								] }),
								!promptSelected && selected !== void 0 && activeTab === "rendered" && (0, react_jsx_runtime.jsx)(MarkdownRecordContent, {
									record: selected,
									renderSlot,
									loadImage,
									rendered: true,
									thinkingExpanded,
									onThinkingExpandedChange: setThinkingExpanded,
									onOpenCall: openCallSummary,
									t
								}),
								!promptSelected && selected !== void 0 && activeTab === "raw" && (0, react_jsx_runtime.jsx)(MarkdownRecordContent, {
									record: selected,
									renderSlot,
									loadImage,
									rendered: false,
									thinkingExpanded,
									onThinkingExpandedChange: setThinkingExpanded,
									onOpenCall: openCallSummary,
									t
								}),
								!promptSelected && selected !== void 0 && activeTab === "source" && (0, react_jsx_runtime.jsx)(MessageSource, {
									record: selected,
									stringWrapping,
									t
								}),
								!promptSelected && selected !== void 0 && activeTab === "input" && (selectedProgram === void 0 ? (0, react_jsx_runtime.jsx)(RecordPayload, {
									record: selected,
									direction: "input",
									renderSlot,
									loadImage,
									stringWrapping,
									t
								}) : (0, react_jsx_runtime.jsx)(ProgramInput, {
									program: selectedProgram,
									initialWrapped: codeWrappingOnOpen,
									stringWrapping,
									t
								}, `input:${selectedRecordId}`)),
								!promptSelected && selected !== void 0 && activeTab === "output" && (selectedProgram === void 0 ? (0, react_jsx_runtime.jsx)(RecordPayload, {
									record: selected,
									direction: "output",
									renderSlot,
									loadImage,
									stringWrapping,
									t
								}) : (0, react_jsx_runtime.jsx)(ProgramOutput, {
									record: selected,
									stringWrapping,
									t
								})),
								!promptSelected && selected !== void 0 && activeTab === "schema" && (0, react_jsx_runtime.jsx)(RecordSchema, {
									record: selected,
									stringWrapping,
									t
								}),
								!promptSelected && selected !== void 0 && activeTab === "timing" && (0, react_jsx_runtime.jsx)(RecordTiming, {
									record: selected,
									t
								})
							]
						})
					]
				})]
			});
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-trajectory/src/client/TrajectoryToolbar.module.css.mjs
		const css$2 = "__GBH_UI_TRAJECTORY_CSS_TrajectoryToolbar__";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-trajectory/TrajectoryToolbar.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-trajectory";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var TrajectoryToolbar_module_css_default = {
			"action": "fV0t5q_action",
			"actionIcon": "fV0t5q_actionIcon",
			"actions": "fV0t5q_actions",
			"control": "fV0t5q_control",
			"controlThumb": "fV0t5q_controlThumb",
			"controlTrack": "fV0t5q_controlTrack",
			"inner": "fV0t5q_inner",
			"root": "fV0t5q_root",
			"search": "fV0t5q_search",
			"searchIcon": "fV0t5q_searchIcon",
			"searchInput": "fV0t5q_searchInput",
			"toggle": "fV0t5q_toggle",
			"toggleIcon": "fV0t5q_toggleIcon"
		};
		//#endregion
} // __DSH_FRAGMENT_END__

export {};
