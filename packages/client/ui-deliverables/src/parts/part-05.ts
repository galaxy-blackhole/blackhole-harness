/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				]
			});
		}
		//#endregion
		//#region lib/types/client/Deliverables.js
		/** The changed-files card, shown only while the Host serves the turn's summary, and explicitly declared files for a closing turn. */
		const COLLAPSED_PRESENTED_COUNT = 4;
		/**
		* Claim turns with a change announcement or declared files.
		* @param owner - closing turn.
		* @returns matched announcement and deliveries, or null for a turn with neither.
		*/
		function selectDeliverables(owner) {
			const changes = changesForClosing(owner);
			const presented = presentedForClosing(owner);
			return changes === null && presented.length === 0 ? null : {
				changes,
				presented
			};
		}
		/**
		* Contribute file deliveries alongside other completed-Turn artifacts.
		* @param props - closing Turn, file actions, and localized copy.
		* @returns file rows, or null when the Turn declares none.
		*/
		function DeliverablesTail(props) {
			const matched = selectDeliverables(props);
			return matched === null ? null : (0, react_jsx_runtime.jsx)(Deliverables, {
				...props,
				matched
			});
		}
		/**
		* Render the changed-files card, once the Host has served the announced
		* summary and it lists a file, and shared native opening controls for declared
		* files. A summary the Host no longer serves leaves no card.
		* @param props - matched announcement and files, workspace opener, and localized copy.
		* @returns the closing turn's file rows.
		*/
		function Deliverables({ matched, openFile, t, sessionId, useSessions, openPresented, openChangesReview, usePresentedOpen, usePresentedHost, useChangesDiff, loadChangesDiff, useChangesSummary, reloadPresentedHost, loadChangesSummary, useShowCodeDiff, renderSlot }) {
			const [expanded, setExpanded] = (0, react.useState)(false);
			const showCodeDiff = useShowCodeDiff((value) => value);
			const cwd = useSessions((state) => state.byId[sessionId]?.cwd);
			const states = usePresentedOpen((value) => value);
			const host = usePresentedHost((value) => value);
			const announced = showCodeDiff ? matched.changes : null;
			const summary = useChangesSummary((value) => announced === null ? void 0 : value[changesSummaryUrl(sessionId, announced.seq)]);
			(0, react.useEffect)(() => {
				if (announced !== null && summary === void 0) loadChangesSummary(sessionId, announced.seq);
			}, [
				announced,
				summary,
				sessionId,
				loadChangesSummary
			]);
			const changes = announced !== null && typeof summary === "object" && summary.files.length > 0 ? {
				seq: announced.seq,
				...summary
			} : null;
			const collapsible = matched.presented.length > COLLAPSED_PRESENTED_COUNT;
			const presented = collapsible && !expanded ? matched.presented.slice(0, COLLAPSED_PRESENTED_COUNT) : matched.presented;
			(0, react.useEffect)(() => {
				if (host === null) reloadPresentedHost();
			}, [host, reloadPresentedHost]);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [changes !== null && (0, react_jsx_runtime.jsx)(ChangedFiles, {
				changes,
				cwd,
				t,
				sessionId,
				useChangesDiff,
				loadChangesDiff,
				openReview: (index) => {
					openChangesReview({
						sessionId,
						seq: changes.seq,
						turn: changes.turn
					}, index);
				}
			}), matched.presented.length > 0 && (0, react_jsx_runtime.jsxs)("div", {
				className: Deliverables_module_css_default.root,
				"data-after-changes": changes !== null || void 0,
				children: [
					host === "error" && (0, react_jsx_runtime.jsxs)("div", {
						className: Deliverables_module_css_default.hostStatus,
						children: [(0, react_jsx_runtime.jsx)("span", { children: t("presented.hostError") }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							onClick: () => {
								reloadPresentedHost();
							},
							children: t("presented.retry")
						})]
					}),
					host !== null && host !== "error" && !host.available && (0, react_jsx_runtime.jsx)("span", {
						className: Deliverables_module_css_default.hostStatus,
						children: t("presented.unavailable")
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: Deliverables_module_css_default.presented,
						"data-presented-files-row": true,
						"data-single": matched.presented.length === 1 ? true : void 0,
						children: presented.map((file) => (0, react_jsx_runtime.jsx)(PresentedFileCard, {
							file,
							cwd,
							phase: states[presentedFileUrl(sessionId, file.seq, file.index)],
							host: host === "error" ? null : host,
							t,
							onPreview: () => {
								openFile(file.path);
							},
							actions: renderSlot("deliverables.file.actions", {
								actionUrl: presentedFileUrl(sessionId, file.seq, file.index),
								available: host !== null && host !== "error" && host.available,
								pending: states[presentedFileUrl(sessionId, file.seq, file.index)] === "opening" || states[presentedFileUrl(sessionId, file.seq, file.index)] === "revealing",
								onAction: (action, application) => openPresented(sessionId, file.seq, file.index, action, application)
							})
						}, `${file.seq}:${file.index}`))
					}),
					collapsible && (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: Deliverables_module_css_default.toggle,
						"aria-expanded": expanded,
						"aria-label": t(expanded ? "presented.collapseAria" : "presented.expandAria", { count: matched.presented.length }),
						onClick: () => {
							setExpanded((value) => !value);
						},
						children: [(0, react_jsx_runtime.jsx)("span", { children: t(expanded ? "presented.collapse" : "presented.all", { count: matched.presented.length }) }), expanded ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {})]
					})
				]
			})] });
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-deliverables/src/client/ReviewTab.module.css.mjs
		const css = ".ZDDmpq_root{height:100%}.ZDDmpq_selector{flex:0 auto;min-width:0}.ZDDmpq_selectorLabel{text-overflow:ellipsis;white-space:nowrap;flex:auto;min-width:0;font-size:12px;overflow:hidden}.ZDDmpq_selectorButton{box-sizing:border-box;border-radius:var(--dsw-radius-sm);max-width:100%;height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;background:0 0;border:0;align-items:center;gap:4px;padding:0 6px 0 8px;font-size:12px;line-height:20px;display:inline-flex}.ZDDmpq_selectorButton:hover,.ZDDmpq_selectorButton[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover)}.ZDDmpq_selectorButton svg{flex:none;display:block}.ZDDmpq_item{justify-content:space-between;align-items:center;gap:12px;min-width:0;display:flex}.ZDDmpq_itemPath{text-overflow:ellipsis;white-space:nowrap;min-width:0;line-height:20px;overflow:hidden}.ZDDmpq_itemCounts,.ZDDmpq_counts{font-family:var(--ds-font-family-code);color:var(--dsw-alias-label-tertiary);flex:none;align-items:center;gap:6px;font-size:12px;line-height:20px;display:inline-flex}.ZDDmpq_counts{min-width:0;margin-right:auto}.ZDDmpq_added{color:var(--dsw-alias-state-success-primary)}.ZDDmpq_deleted{color:var(--dsw-alias-state-error-primary)}.ZDDmpq_label{color:var(--dsw-alias-label-tertiary)}.ZDDmpq_tools{flex:none;align-items:center;gap:2px;margin-left:auto;display:inline-flex}.ZDDmpq_tool{border-radius:var(--dsw-radius-sm);width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;flex:none;justify-content:center;align-items:center;padding:6px;display:inline-flex}.ZDDmpq_tool svg{width:15px;height:15px}.ZDDmpq_tool:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.ZDDmpq_tool[aria-pressed=true] .ZDDmpq_compareIcon{transform:rotate(90deg)}.ZDDmpq_tool:disabled{cursor:progress}.ZDDmpq_tool[data-error]{color:var(--dsw-alias-state-error-primary)}";
		const tagId = "@deepseek-ai/dsh-client-ui-deliverables/ReviewTab.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-deliverables";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var ReviewTab_module_css_default = {
			"added": "ZDDmpq_added",
			"compareIcon": "ZDDmpq_compareIcon",
			"counts": "ZDDmpq_counts",
			"deleted": "ZDDmpq_deleted",
			"item": "ZDDmpq_item",
			"itemCounts": "ZDDmpq_itemCounts",
			"itemPath": "ZDDmpq_itemPath",
			"label": "ZDDmpq_label",
			"root": "ZDDmpq_root",
			"selector": "ZDDmpq_selector",
			"selectorButton": "ZDDmpq_selectorButton",
			"selectorLabel": "ZDDmpq_selectorLabel",
			"tool": "ZDDmpq_tool",
			"tools": "ZDDmpq_tools"
		};
		//#endregion
		//#region lib/types/client/ReviewTab.js
		/**
		* The review tab: one turn's changed files behind a file selector, with the
		* selected file's turn-start and turn-end comparison drawn unified or side by
		* side, wrapped or scrolling, and controls to open the file itself.
		*/
		const GROUPED = new Intl.NumberFormat("en-US");
		/** The file index a navigation names, when it names one. */
		function navigatedIndex(params) {
			const index = params?.index;
			return typeof index === "number" && Number.isSafeInteger(index) && index >= 0 ? index : void 0;
		}
		/** Added and deleted line counts in the card's colors. */
		function Counts({ file, t }) {
			if (file.binary === true) return (0, react_jsx_runtime.jsx)("span", {
				className: ReviewTab_module_css_default.label,
				children: t("changes.binary")
			});
			if (file.oversized === true) return (0, react_jsx_runtime.jsx)("span", {
				className: ReviewTab_module_css_default.label,
				children: t("changes.oversized")
			});
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
				className: ReviewTab_module_css_default.added,
				children: t("changes.added", { count: GROUPED.format(file.added) })
			}), (0, react_jsx_runtime.jsx)("span", {
				className: ReviewTab_module_css_default.deleted,
				children: t("changes.deleted", { count: GROUPED.format(file.deleted) })
			})] });
		}
		/**
		* The review type's body, registered under `sidebar.right.pane.tab` as `changes-review`.
		* @param props - composed slot props.
		* @returns the selected file's comparison behind the file selector, or the state that stands in for it.
		*/
		function ReviewTab({ useTabInfo, sessionId, useSessions, useStore, actions, useChangesSummary, useChangesDiff, usePresentedOpen, usePresentedHost, loadChangesSummary, loadChangesDiff, reloadPresentedHost, openChanged, t, renderSlot }) {
			const { tab } = useTabInfo();
			const { navigation, signal } = tab;
			const coordinates = (0, react.useMemo)(() => parseChangesReviewAddress(tab.contentId), [tab.contentId]);
			if (coordinates === void 0) throw new Error(`ui-deliverables: not a review address "${tab.contentId}"`);
			const { seq } = coordinates;
			const cwd = useSessions((sessions) => sessions.byId[sessionId]?.cwd);
			const summary = useChangesSummary((value) => value[changesSummaryUrl(sessionId, seq)]);
			const state = useStore((store) => store.byTab[tab.id]);
			const host = usePresentedHost((value) => value);
			(0, react.useEffect)(() => {
				if (state?.navigated === navigation.revision) return;
				actions.navigated(tab.id, navigation.revision, navigatedIndex(navigation.params) ?? state?.index ?? 0);
			}, [
				state,
				navigation.revision,
				navigation.params,
				actions,
				tab.id
			]);
			(0, react.useEffect)(() => {
				const forget = () => {
					actions.forget(tab.id);
				};
				signal.addEventListener("abort", forget, { once: true });
				return () => {
					signal.removeEventListener("abort", forget);
				};
			}, [
				signal,
				actions,
				tab.id
			]);
			(0, react.useEffect)(() => {
				if (summary === void 0) loadChangesSummary(sessionId, seq);
			}, [
				summary,
				sessionId,
				seq,
				loadChangesSummary
			]);
			(0, react.useEffect)(() => {
				if (host === null) reloadPresentedHost();
			}, [host, reloadPresentedHost]);
			const files = typeof summary === "object" ? summary.files : [];
			const index = state !== void 0 && files[state.index] !== void 0 ? state.index : 0;
			const file = files[index];
			const diffState = useChangesDiff((value) => file === void 0 ? void 0 : value[changesDiffUrl(sessionId, seq, index)]);
			(0, react.useEffect)(() => {
				if (file !== void 0 && diffState === void 0) loadChangesDiff(sessionId, seq, index);
			}, [
				file,
				diffState,
				sessionId,
				seq,
				index,
				loadChangesDiff
			]);
			const phase = usePresentedOpen((value) => file === void 0 ? void 0 : value[changedFileUrl(sessionId, seq, index)]);
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const split = state?.split === true;
			const wrap = state?.wrap === true;
			const native = host !== null && host !== "error" && host.available && phase !== "nativeUnavailable";
			const summaryState = summary === void 0 || summary === "loading" ? "loading" : summary === "missing" ? "missing" : "ready";
			return (0, react_jsx_runtime.jsxs)("div", {
				className: `${FileDiff_module_css_default.root} ${ReviewTab_module_css_default.root}`,
				"data-changes-review": true,
				"data-review-state": summaryState,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: FileDiff_module_css_default.header,
						children: [
							file === void 0 ? (0, react_jsx_runtime.jsx)("span", {
								className: ReviewTab_module_css_default.selectorLabel,
								children: t("review.title", { turn: String(coordinates.turn) })
							}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								className: ReviewTab_module_css_default.selector,
								open: menuOpen,
								autoFocus: true,
								portal: true,
								align: "start",
								dense: true,
								onClose: () => {
									setMenuOpen(false);
								},
								anchor: (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: ReviewTab_module_css_default.selectorButton,
									"aria-haspopup": "menu",
									"aria-expanded": menuOpen,
									"aria-label": t("review.selectFile"),
									title: file.display,
									"data-review-file": file.path,
									onClick: () => {
										setMenuOpen((value) => !value);
									},
									children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.PathLabel, { path: file.display }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: 12 })]
								}),
								items: files.map((entry, at) => ({
									id: String(at),
									label: (0, react_jsx_runtime.jsxs)("span", {
										className: ReviewTab_module_css_default.item,
										children: [(0, react_jsx_runtime.jsx)("span", {
											className: ReviewTab_module_css_default.itemPath,
											children: entry.display
										}), (0, react_jsx_runtime.jsx)("span", {
											className: ReviewTab_module_css_default.itemCounts,
											children: (0, react_jsx_runtime.jsx)(Counts, {
												file: entry,
												t
											})
										})]
									})
								})),
								selectedId: String(index),
								onSelect: (id) => {
									actions.selected(tab.id, Number(id));
									setMenuOpen(false);
								}
							}),
							file !== void 0 && (0, react_jsx_runtime.jsx)("span", {
								className: ReviewTab_module_css_default.counts,
								children: (0, react_jsx_runtime.jsx)(Counts, {
									file,
									t
								})
							}),
							(0, react_jsx_runtime.jsxs)("span", {
								className: ReviewTab_module_css_default.tools,
								children: [
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
										label: t(split ? "review.unified" : "review.split"),
										side: "bottom",
										delayMs: 500,
										children: (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: ReviewTab_module_css_default.tool,
											"aria-pressed": split,
											"aria-label": t("review.splitAria"),
											"data-review-tool": "split",
											onClick: () => {
												actions.toggledSplit(tab.id);
											},
											children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCompareSplitOutlineRegular, { className: ReviewTab_module_css_default.compareIcon })
										})
									}),
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
										label: t(wrap ? "review.nowrap" : "review.wrap"),
										side: "bottom",
										delayMs: 500,
										children: (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: ReviewTab_module_css_default.tool,
											"aria-pressed": wrap,
											"aria-label": t("review.wrapAria"),
											"data-review-tool": "wrap",
											onClick: () => {
												actions.toggledWrap(tab.id);
											},
											children: wrap ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNowrapFillRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWrapFillRegular, {})
										})
									}),
									file !== void 0 && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
										label: t("review.openFile"),
										side: "bottom",
										delayMs: 500,
										children: (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: ReviewTab_module_css_default.tool,
											"aria-label": t("review.openFileAria", { name: file.display }),
											"data-review-tool": "open-file",
											onClick: () => {
												tab.actions.openResource(fileAddressFor(sessionId, cwd, file.path));
											},
											children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInspectOutlineRegular, {})
										})
									}),
									file !== void 0 && renderSlot("deliverables.review.file.actions", {
										actionUrl: changedFileUrl(sessionId, seq, index),
										available: native,
										pending: phase === "opening" || phase === "revealing",
										onAction: (action, application) => openChanged(sessionId, seq, index, action, application)
									})
								]
							})
						]
					}),
					summaryState === "loading" && (0, react_jsx_runtime.jsx)("p", {
						className: FileDiff_module_css_default.status,
						role: "status",
						children: t("diff.loading")
					}),
					summaryState === "missing" && (0, react_jsx_runtime.jsx)("p", {
						className: FileDiff_module_css_default.status,
						children: t("diff.missing")
					}),
					file !== void 0 && (0, react_jsx_runtime.jsx)(FileDiff, {
						state: diffState,
						split,
						wrap,
						t,
						retry: () => {
							loadChangesDiff(sessionId, seq, index);
						}
					})
				]
			});
export {};
