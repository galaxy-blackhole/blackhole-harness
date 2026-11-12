/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
											},
											children: t(source === "client" ? "body.clientCode" : "body.hostCode")
										}, source);
									})
								}), (0, react_jsx_runtime.jsx)("div", {
									id: sourcePanelId,
									className: CordisDefineRow_module_css_default.sourcePanel,
									role: "tabpanel",
									"aria-labelledby": `${sourcePanelId}-${activeSource}`,
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.CodeBlock, {
										toolbarLabels: {
											codeLabel: t("codeBlock.title"),
											wrapLabel: t("codeBlock.wrap"),
											unwrapLabel: t("codeBlock.unwrap")
										},
										code: activeCode,
										lang: "javascript",
										copyLabel: t("body.copy"),
										copiedLabel: t("body.copied"),
										className: CordisDefineRow_module_css_default.sourceCode
									})
								})]
							}),
							card.output !== null && (0, react_jsx_runtime.jsxs)("section", {
								className: CordisDefineRow_module_css_default.codeSection,
								children: [(0, react_jsx_runtime.jsx)("div", {
									className: CordisDefineRow_module_css_default.sectionLabel,
									children: t("body.output")
								}), (0, react_jsx_runtime.jsx)("pre", {
									className: CordisDefineRow_module_css_default.output,
									"data-error": card.state === "error" || void 0,
									children: card.output
								})]
							}),
							card.pluginId !== null && (0, react_jsx_runtime.jsx)("div", {
								className: CordisDefineRow_module_css_default.panelHint,
								children: t("panel.hint")
							}),
							inspect !== void 0 && (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: CordisDefineRow_module_css_default.inspectButton,
								onClick: inspect,
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInspectOutlineRegular, {}), t("action.inspect")]
							})
						]
					})
				})]
			});
		}
		//#endregion
		//#region lib/types/client/run-card-index.js
		/** Session-local ownership index for Package business views on `cordis_run` cards. */
		function createStore() {
			const pointers = /* @__PURE__ */ new Map();
			const listeners = /* @__PURE__ */ new Set();
			let cache;
			return {
				getSnapshot: () => cache ??= new Map(pointers),
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				observe: (pointer) => {
					const current = pointers.get(pointer.key);
					if (current !== void 0 && current.seq >= pointer.seq) return;
					pointers.set(pointer.key, pointer);
					cache = void 0;
					for (const listener of [...listeners]) listener();
				}
			};
		}
		/** Page-lifetime registry that gives all cards of one session the same Store. */
		var CordisRunCardRegistry = class {
			sessions = /* @__PURE__ */ new Map();
			/**
			* Return the persistent page-local Store for a session.
			* @param sessionId - session whose cards share supersession state.
			* @returns the page-local Store retained for that session.
			*/
			forSession(sessionId) {
				let store = this.sessions.get(sessionId);
				if (store === void 0) {
					store = createStore();
					this.sessions.set(sessionId, store);
				}
				return store;
			}
		};
		/**
		* Build the Package business-view key shared by registrations and Run cards.
		* @param pluginId - stable Plugin identity.
		* @param packageId - immutable Package identity.
		* @returns the shared business-view key.
		*/
		function cordisToolViewKey(pluginId, packageId) {
			return `${pluginId}.${packageId}`;
		}
		//#endregion
		//#region lib/types/client/CordisRunRow.js
		/** `cordis_run` card and the host seat for Package-owned interactive UI. */
		const READING_LABELS = {
			idle: "status.idle",
			"awaiting-approval": "status.awaitingApproval",
			failed: "status.failed",
			"client-pending": "status.clientPending",
			running: "status.running",
			removed: "status.removed",
			superseded: "status.superseded"
		};
		/** Render one activation result and, when eligible, its Package-owned view. */
		function CordisRunRow(props) {
			if (props.phase === "preparing") return (0, react_jsx_runtime.jsx)(CordisPreparingRow, {
				...props,
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size: 14 }),
				title: props.t("row.runTitle"),
				className: CordisRunRow_module_css_default.card,
				rowClassName: CordisRunRow_module_css_default.row,
				titleClassName: CordisRunRow_module_css_default.title
			});
			return (0, react_jsx_runtime.jsx)(StartedCordisRunRow, { ...props });
		}
		function StartedCordisRunRow({ callId, block, inspect, renderSlot, useInventory, useLoaded, useRunCards, useActiveRuns, onObserveRunCard, t }) {
			const card = cordisRunCard(block);
			const inventory = useInventory((snapshot) => snapshot);
			const loaded = useLoaded((snapshot) => snapshot);
			const latest = useRunCards((snapshot) => snapshot);
			const activeRuns = useActiveRuns((snapshot) => snapshot);
			const key = card.state === "ok" && card.pluginId !== null && card.packageId !== null && card.pluginRunId !== null && card.seq !== null ? cordisToolViewKey(card.pluginId, card.packageId) : null;
			(0, react.useEffect)(() => {
				if (key === null || card.seq === null || card.pluginRunId === null) return;
				onObserveRunCard({
					key,
					callId,
					seq: card.seq,
					pluginRunId: card.pluginRunId
				});
			}, [
				callId,
				card.pluginRunId,
				card.seq,
				key,
				onObserveRunCard
			]);
			const row = card.pluginId === null ? void 0 : inventory.rows.find((candidate) => candidate.pluginId === card.pluginId);
			const pointer = key === null ? void 0 : latest.get(key);
			const superseded = pointer !== void 0 && pointer.callId !== callId && pointer.seq >= (card.seq ?? -1);
			const activity = card.pluginId === null ? void 0 : activeRuns.get(card.pluginId);
			const attempt = card.pluginRunId !== null && row?.latestRun?.pluginRunId === card.pluginRunId ? row.latestRun : void 0;
			const awaitingApproval = attempt?.status === "awaiting-approval" || card.packageId !== null && activity?.phase === "awaiting-approval" && activity.packageId === card.packageId && (card.mode === null || activity.mode === card.mode);
			const reading = card.pluginId !== null && inventory.removed.has(card.pluginId) ? "removed" : superseded ? "superseded" : awaitingApproval ? "awaiting-approval" : attempt?.status === "failed" ? "failed" : row !== void 0 && card.packageId !== null ? cordisVisibleStatus(row, card.packageId, loaded) : "idle";
			const status = t(READING_LABELS[reading]);
			const summary = card.errorSummary ?? (card.pluginId === null ? callId : `${card.pluginId}${card.packageId === null ? "" : ` · ${card.packageId}`}`);
			const showBusiness = reading === "running" && key !== null;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: CordisRunRow_module_css_default.card,
				"data-tool": "cordis_run",
				"data-state": card.state,
				"data-cordis-plugin-id": card.pluginId ?? void 0,
				"data-cordis-package-id": card.packageId ?? void 0,
				"data-cordis-run-id": card.pluginRunId ?? void 0,
				"data-cordis-status": reading,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: CordisRunRow_module_css_default.row,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: CordisRunRow_module_css_default.icon,
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size: 14 })
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: CordisRunRow_module_css_default.title,
								children: t(card.mode === "update" ? "row.updateTitle" : "row.runTitle")
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: CordisRunRow_module_css_default.separator,
								"aria-hidden": true
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: card.errorSummary === null ? CordisRunRow_module_css_default.summary : CordisRunRow_module_css_default.error,
								children: summary
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: CordisRunRow_module_css_default.status,
								children: status
							}),
							inspect !== void 0 && (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: CordisRunRow_module_css_default.inspect,
								"aria-label": t("action.inspect"),
								onClick: inspect,
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInspectOutlineRegular, {})
							})
						]
					}),
					reading === "removed" && (0, react_jsx_runtime.jsx)("div", {
						className: CordisRunRow_module_css_default.message,
						children: t("run.removed")
					}),
					reading === "superseded" && (0, react_jsx_runtime.jsx)("div", {
						className: CordisRunRow_module_css_default.message,
						children: t("run.superseded")
					}),
					reading === "failed" && attempt?.error !== void 0 && (0, react_jsx_runtime.jsx)("div", {
						className: CordisRunRow_module_css_default.message,
						children: attempt.error.message
					}),
					showBusiness && card.pluginId !== null && card.packageId !== null && card.pluginRunId !== null && (0, react_jsx_runtime.jsx)("div", {
						className: CordisRunRow_module_css_default.business,
						"data-cordis-business-view": key,
						children: renderSlot("tool.view.cordis", {
							pluginId: card.pluginId,
							packageId: card.packageId,
							pluginRunId: card.pluginRunId
						}, {
							entryKey: key,
							fallback: card.output === null ? null : (0, react_jsx_runtime.jsx)("pre", {
								className: CordisRunRow_module_css_default.output,
								children: card.output
							})
						})
					}),
					!showBusiness && reading !== "removed" && reading !== "superseded" && card.output !== null && (0, react_jsx_runtime.jsx)("pre", {
						className: CordisRunRow_module_css_default.output,
						children: card.output
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/extensions/ui-cordis/src/client/CordisPanel.module.css.mjs
		const css = ".Nqubda_layer{flex:none;align-items:center;width:100%;height:42px;margin:8px 0 0;display:flex;position:relative}.Nqubda_footerButtons{align-items:center;width:100%;display:flex}.Nqubda_badge{width:calc(100% + 4px);height:42px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:none;border-radius:12px;align-items:center;gap:8px;margin:0 -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden}.Nqubda_badge:hover,.Nqubda_badge[data-active]{background:var(--dsw-alias-interactive-bg-hover)}.Nqubda_badgeLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.Nqubda_badgeCount{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none;margin-left:auto;font-size:12px;line-height:16px}.Nqubda_layer.Nqubda_rail{width:36px;height:36px;margin:0}.Nqubda_rail .Nqubda_badge{corner-shape:round;border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;padding:0}.Nqubda_rail .Nqubda_footerButtons{flex-direction:column;gap:2px}.Nqubda_panel{isolation:isolate;z-index:30;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);width:420px;max-width:calc(100vw - 24px);max-height:60vh;box-shadow:var(--dsw-elevation-prominent);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border:0;border-radius:12px;flex-direction:column;display:flex;position:fixed;overflow:hidden}.Nqubda_panel:before{z-index:-1;border-radius:inherit;background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);content:\"\";pointer-events:none;position:absolute;inset:0}.Nqubda_header{box-sizing:border-box;flex:none;justify-content:space-between;align-items:center;min-height:44px;padding:10px 12px;display:flex}.Nqubda_body{flex:1;min-height:0;padding:0 12px 12px;overflow-y:auto}.Nqubda_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:20px}.Nqubda_note,.Nqubda_readError{color:var(--dsw-alias-label-tertiary);margin:4px 0;font-size:12px;line-height:18px}.Nqubda_readError{color:var(--dsw-alias-state-error-primary)}.Nqubda_group{color:var(--dsw-alias-label-caption);text-transform:uppercase;letter-spacing:.04em;margin:8px 0;font-size:11px;font-weight:500;line-height:16px}.Nqubda_rows{flex-direction:column;gap:8px;margin:0;padding:0;list-style:none;display:flex}.Nqubda_row{border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;flex-direction:column;gap:8px;padding:14px 12px 10px;display:flex}.Nqubda_row[data-cordis-awaiting]{border-color:var(--dsw-alias-state-business-primary)}.Nqubda_rowHead{align-items:center;gap:8px;display:flex}.Nqubda_rowId{color:var(--dsw-alias-label-tertiary);font-family:var(--dsh-font-mono,monospace);flex:none;font-size:11px;line-height:20px}.Nqubda_rowName{min-width:0;color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.Nqubda_rowStatus{height:20px;color:var(--dsw-alias-label-caption);flex:none;align-items:center;gap:4px;font-size:11px;line-height:20px;display:inline-flex}.Nqubda_rowDetail{align-items:center;gap:8px;min-height:28px;display:flex}.Nqubda_versionPicker{color:var(--dsw-alias-label-caption);align-items:center;gap:8px;font-size:11px;line-height:18px;display:flex}.Nqubda_versionPicker select{border:.5px solid var(--dsw-alias-border-l3);min-width:0;height:26px;color:var(--dsw-alias-label-secondary);font:inherit;background:0 0;border-radius:7px;flex:1;padding:0 8px}.Nqubda_rowPurpose{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px;line-height:18px;overflow:hidden}.Nqubda_rowError{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}.Nqubda_rowActions{flex:none;align-items:center;gap:10px;display:flex}.Nqubda_transition{min-width:0;color:var(--dsw-alias-label-caption);align-items:center;gap:8px;font-size:11px;line-height:18px;display:flex}.Nqubda_transitionActions{gap:6px;margin-left:auto;display:flex}.Nqubda_transitionActions button{border:.5px solid var(--dsw-alias-border-l3);corner-shape:round;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border-radius:999px;padding:2px 8px}.Nqubda_transitionActions button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.Nqubda_transitionActions button:disabled{opacity:.4;cursor:default}.Nqubda_activeVersion{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px}.Nqubda_actionButton{corner-shape:round;width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:999px;justify-content:center;align-items:center;padding:0;display:inline-flex}.Nqubda_actionButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.Nqubda_actionButton:disabled{opacity:.4;cursor:default}.Nqubda_doubleCheck{width:17px;height:14px;display:inline-block;position:relative}.Nqubda_doubleCheck svg{position:absolute;top:1px}.Nqubda_doubleCheck svg:first-child{opacity:.7;left:0}.Nqubda_doubleCheck svg:last-child{left:5px}";
		const tagId = "@deepseek-ai/dsh-client-ui-cordis/CordisPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-cordis";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var CordisPanel_module_css_default = {
			"actionButton": "Nqubda_actionButton",
			"activeVersion": "Nqubda_activeVersion",
			"badge": "Nqubda_badge",
			"badgeCount": "Nqubda_badgeCount",
			"badgeLabel": "Nqubda_badgeLabel",
			"body": "Nqubda_body",
			"doubleCheck": "Nqubda_doubleCheck",
			"footerButtons": "Nqubda_footerButtons",
			"group": "Nqubda_group",
			"header": "Nqubda_header",
			"layer": "Nqubda_layer",
			"note": "Nqubda_note",
			"panel": "Nqubda_panel",
			"rail": "Nqubda_rail",
			"readError": "Nqubda_readError",
			"row": "Nqubda_row",
			"rowActions": "Nqubda_rowActions",
			"rowDetail": "Nqubda_rowDetail",
			"rowError": "Nqubda_rowError",
			"rowHead": "Nqubda_rowHead",
			"rowId": "Nqubda_rowId",
			"rowName": "Nqubda_rowName",
			"rowPurpose": "Nqubda_rowPurpose",
			"rowStatus": "Nqubda_rowStatus",
			"rows": "Nqubda_rows",
			"title": "Nqubda_title",
			"transition": "Nqubda_transition",
			"transitionActions": "Nqubda_transitionActions",
			"versionPicker": "Nqubda_versionPicker"
		};
		//#endregion
		//#region lib/types/client/CordisPanel.js
		/** Frame-wide dynamic Plugin inventory, approvals, versions, and lifecycle actions. */
		const STATUS_LABELS = {
			idle: "status.idle",
			"awaiting-approval": "status.awaitingApproval",
			"client-pending": "status.clientPending",
			running: "status.running",
			failed: "status.failed"
		};
		const RENDER_FAILURE_LABELS = {
			abdicated: "render.failedAbdicated",
			held: "render.failedHeld"
		};
		function selectedPackageIdOf({ pluginId, listed, activity }, selected) {
			const selectedPackageId = selected[pluginId];
			if (selectedPackageId !== void 0 && listed?.packages.some((pkg) => pkg.packageId === selectedPackageId)) return selectedPackageId;
			return listed?.nextPackageId ?? listed?.currentPackageId ?? listed?.packages.at(-1)?.packageId ?? activity?.packageId;
		}
		function visiblePanelStatus(view, selectedPackageId, loaded) {
			const { listed, activity } = view;
			const latest = listed?.latestRun;
			if (activity?.phase === "awaiting-approval" || latest?.status === "awaiting-approval") return "awaiting-approval";
			if (latest?.status === "failed" && latest.packageId === selectedPackageId) return "failed";
			if (listed?.activeRun === void 0) return "idle";
			return cordisVisibleStatus(listed, listed.activeRun.packageId, loaded);
		}
		function panelDotState(status, busy) {
			if (busy) return "ongoing";
			switch (status) {
				case "idle": return "idle";
				case "client-pending": return "ongoing";
				case "running": return "done";
				case "awaiting-approval": return "warning";
				case "failed": return "error";
			}
		}
		function blockingFirst(rows) {
			return [...rows.filter((row) => row.activity?.phase === "awaiting-approval"), ...rows.filter((row) => row.activity?.phase !== "awaiting-approval")];
		}
		function RowAction({ label, children, ...props }) {
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label,
				side: "bottom",
				delayMs: 500,
				children: (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: CordisPanel_module_css_default.actionButton,
					"aria-label": label,
					...props,
					children
				})
			});
		}
		function DoubleCheckIcon() {
			return (0, react_jsx_runtime.jsxs)("span", {
				className: CordisPanel_module_css_default.doubleCheck,
				"aria-hidden": true,
				children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 12 }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 12 })]
			});
		}
		/** Render the inventory panel and its unified footer action. */
		function CordisPanel({ wide, useSessions, useInventory, useActiveRuns, useRunErrors, useLoaded, useRenderFailures, onApprove, onDecline, onRun, onStop, onRemove, onRefresh, t }) {
			const inventory = useInventory((snapshot) => snapshot);
			const activeRuns = useActiveRuns((snapshot) => snapshot);
			const errors = useRunErrors((snapshot) => snapshot);
			const loaded = useLoaded((snapshot) => snapshot);
			const renderFailures = useRenderFailures((snapshot) => snapshot);
			const current = useSessions((state) => Object.values(state.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id);
			const [open, setOpen] = (0, react.useState)(false);
			const [selected, setSelected] = (0, react.useState)({});
			const [pending, setPending] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [actionErrors, setActionErrors] = (0, react.useState)(/* @__PURE__ */ new Map());
			const visibleRequests = (0, react.useRef)(/* @__PURE__ */ new Set());
			const rootRef = (0, react.useRef)(null);
			const [anchor, setAnchor] = (0, react.useState)();
			(0, react.useLayoutEffect)(() => {
				if (!open) return;
				const place = () => {
					const rect = rootRef.current?.getBoundingClientRect();
					if (rect !== void 0) setAnchor({
						left: rect.left,
						bottom: window.innerHeight - rect.top + 8
					});
				};
				place();
				window.addEventListener("resize", place);
				return () => {
					window.removeEventListener("resize", place);
				};
			}, [open]);
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open, setOpen);
			(0, react.useEffect)(() => {
				const now = /* @__PURE__ */ new Set();
				for (const activity of activeRuns.values()) if (activity.phase === "awaiting-approval") now.add(activity.requestId);
				const discovered = [...now].some((requestId) => !visibleRequests.current.has(requestId));
				visibleRequests.current = now;
				if (discovered) setOpen(true);
			}, [activeRuns]);
			(0, react.useEffect)(() => {
				onRefresh();
			}, [onRefresh]);
			(0, react.useEffect)(() => {
				if (open) onRefresh();
			}, [onRefresh, open]);
			const byPlugin = /* @__PURE__ */ new Map();
			for (const listed of inventory.rows) {
				const activity = activeRuns.get(listed.pluginId);
				byPlugin.set(listed.pluginId, {
					pluginId: listed.pluginId,
					agentId: activity?.agentId ?? listed.agentId,
					listed,
					...activity === void 0 ? {} : { activity }
				});
			}
			for (const [pluginId, activity] of activeRuns) {
				if (byPlugin.has(pluginId)) continue;
				byPlugin.set(pluginId, {
					pluginId,
					agentId: activity.agentId,
					activity
				});
			}
			const all = [...byPlugin.values()];
			const mine = blockingFirst(all.filter((row) => current !== void 0 && row.agentId === current));
			const theirs = blockingFirst(all.filter((row) => current === void 0 || row.agentId !== current));
			const approvals = [...activeRuns.values()].filter((activity) => activity.phase === "awaiting-approval").length;
			const running = all.filter((view) => visiblePanelStatus(view, selectedPackageIdOf(view, selected), loaded) === "running").length;
export {};
