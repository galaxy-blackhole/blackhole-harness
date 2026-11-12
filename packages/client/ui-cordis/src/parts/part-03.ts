/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			if (all.length === 0) return null;
			const runAction = async (pluginId, action) => {
				if (pending.has(pluginId)) return;
				setPending((currentPending) => new Set(currentPending).add(pluginId));
				setActionErrors((currentErrors) => {
					const next = new Map(currentErrors);
					next.delete(pluginId);
					return next;
				});
				try {
					const result = await action();
					if (result !== void 0 && !result.ok) setActionErrors((currentErrors) => new Map(currentErrors).set(pluginId, result.message ?? "operation failed"));
				} catch (error) {
					setActionErrors((currentErrors) => new Map(currentErrors).set(pluginId, error instanceof Error ? error.message : String(error)));
				} finally {
					setPending((currentPending) => {
						const next = new Set(currentPending);
						next.delete(pluginId);
						return next;
					});
					onRefresh();
				}
			};
			const renderRow = (view) => {
				const { pluginId, listed, activity } = view;
				const selectedPackageId = selectedPackageIdOf(view, selected);
				const selectedPackage = listed !== void 0 && selectedPackageId !== void 0 ? packageOf(listed, selectedPackageId) : void 0;
				const activePackage = listed?.activeRun === void 0 ? void 0 : packageOf(listed, listed.activeRun.packageId);
				const name = selectedPackage?.name ?? (activity?.phase === "awaiting-approval" ? activity.name : pluginId);
				const purpose = selectedPackage?.purpose ?? (activity?.phase === "awaiting-approval" ? activity.purpose : "");
				const latest = listed?.latestRun;
				const awaiting = activity?.phase === "awaiting-approval" ? activity.requestId : latest?.status === "awaiting-approval" ? latest.approvalRequestId : void 0;
				const status = visiblePanelStatus(view, selectedPackageId, loaded);
				const busy = pending.has(pluginId) || activity?.phase === "orchestrating";
				const failure = errors.get(pluginId);
				const hostFailure = latest?.status === "failed" ? latest.error : void 0;
				const renderFailure = renderFailures.get(pluginId);
				const actionError = actionErrors.get(pluginId);
				const nextPackageId = listed?.nextPackageId !== void 0 && listed.nextPackageId !== listed.currentPackageId ? listed.nextPackageId : void 0;
				const currentPackageId = listed?.currentPackageId;
				const runMode = listed?.currentPackageId !== void 0 && selectedPackageId !== listed.currentPackageId ? "update" : "run";
				return (0, react_jsx_runtime.jsxs)("li", {
					className: CordisPanel_module_css_default.row,
					"data-cordis-row": pluginId,
					"data-cordis-status": status,
					"data-cordis-awaiting": awaiting !== void 0 || void 0,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: CordisPanel_module_css_default.rowHead,
							children: [
								(0, react_jsx_runtime.jsx)("span", {
									className: CordisPanel_module_css_default.rowId,
									children: pluginId
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: CordisPanel_module_css_default.rowName,
									children: name
								}),
								(0, react_jsx_runtime.jsxs)("span", {
									className: CordisPanel_module_css_default.rowStatus,
									children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: panelDotState(status, busy) }), (0, react_jsx_runtime.jsx)("span", { children: t(STATUS_LABELS[status]) })]
								})
							]
						}),
						listed !== void 0 && listed.packages.length > 1 && selectedPackageId !== void 0 && (0, react_jsx_runtime.jsxs)("label", {
							className: CordisPanel_module_css_default.versionPicker,
							children: [(0, react_jsx_runtime.jsx)("span", { children: t("panel.version") }), (0, react_jsx_runtime.jsx)("select", {
								value: selectedPackageId,
								disabled: busy,
								onChange: (event) => {
									setSelected((currentSelected) => ({
										...currentSelected,
										[pluginId]: event.target.value
									}));
								},
								children: listed.packages.map((pkg) => (0, react_jsx_runtime.jsx)("option", {
									value: pkg.packageId,
									children: `${pkg.name} · ${pkg.packageId}`
								}, pkg.packageId))
							})]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: CordisPanel_module_css_default.rowDetail,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: CordisPanel_module_css_default.rowPurpose,
								children: purpose
							}), (0, react_jsx_runtime.jsxs)("div", {
								className: CordisPanel_module_css_default.rowActions,
								children: [
									awaiting !== void 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										(0, react_jsx_runtime.jsx)(RowAction, {
											label: t("action.approveOnce"),
											"data-cordis-approve": awaiting,
											disabled: busy,
											onClick: () => {
												runAction(pluginId, async () => {
													await onApprove(awaiting, false);
													setOpen(false);
												});
											},
											children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 14 })
										}),
										(0, react_jsx_runtime.jsx)(RowAction, {
											label: t("action.approvePlugin"),
											"data-cordis-approve-plugin": awaiting,
											disabled: busy,
											onClick: () => {
												runAction(pluginId, async () => {
													await onApprove(awaiting, true);
													setOpen(false);
												});
											},
											children: (0, react_jsx_runtime.jsx)(DoubleCheckIcon, {})
										}),
										(0, react_jsx_runtime.jsx)(RowAction, {
											label: t("action.decline"),
											"data-cordis-decline": awaiting,
											disabled: busy,
											onClick: () => {
												runAction(pluginId, async () => {
													await onDecline(awaiting);
													setOpen(false);
												});
											},
											children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 })
										})
									] }),
									awaiting === void 0 && listed !== void 0 && selectedPackageId !== void 0 && listed.activeRun === void 0 && (0, react_jsx_runtime.jsx)(RowAction, {
										label: t("action.run"),
										"data-cordis-switch": "run",
										disabled: busy,
										onClick: () => {
											runAction(pluginId, () => onRun({
												agentId: listed.agentId,
												pluginId,
												packageId: selectedPackageId,
												mode: runMode,
												hasClientHalf: selectedPackage?.hasClientHalf === true
											}));
										},
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlayOutlineRegular, { size: 14 })
									}),
									awaiting === void 0 && listed !== void 0 && listed.activeRun !== void 0 && selectedPackageId !== listed.activeRun.packageId && selectedPackage !== void 0 && (0, react_jsx_runtime.jsx)(RowAction, {
										label: t("action.run"),
										"data-cordis-switch": "run",
										disabled: busy,
										onClick: () => {
											runAction(pluginId, () => onRun({
												agentId: listed.agentId,
												pluginId,
												packageId: selectedPackage.packageId,
												mode: runMode,
												hasClientHalf: selectedPackage.hasClientHalf
											}));
										},
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlayOutlineRegular, { size: 14 })
									}),
									awaiting === void 0 && listed !== void 0 && listed.activeRun !== void 0 && status === "client-pending" && activePackage !== void 0 && selectedPackageId === listed.activeRun.packageId && (0, react_jsx_runtime.jsx)(RowAction, {
										label: t("action.run"),
										"data-cordis-switch": "run",
										disabled: busy,
										onClick: () => {
											runAction(pluginId, () => onRun({
												agentId: listed.agentId,
												pluginId,
												packageId: activePackage.packageId,
												mode: "run",
												hasClientHalf: true
											}));
										},
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlayOutlineRegular, { size: 14 })
									}),
									awaiting === void 0 && listed !== void 0 && listed.activeRun !== void 0 && (0, react_jsx_runtime.jsx)(RowAction, {
										label: t("action.stop"),
										"data-cordis-switch": "stop",
										disabled: busy,
										onClick: () => {
											runAction(pluginId, () => onStop(listed.agentId, pluginId));
										},
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconStopFillRegular, { size: 14 })
									}),
									awaiting === void 0 && listed !== void 0 && (0, react_jsx_runtime.jsx)(RowAction, {
										label: t("action.remove"),
										"data-cordis-remove": pluginId,
										disabled: busy,
										onClick: () => {
											runAction(pluginId, () => onRemove(listed.agentId, pluginId));
										},
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
									})
								]
							})]
						}),
						awaiting === void 0 && nextPackageId !== void 0 && listed !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
							className: CordisPanel_module_css_default.transition,
							children: [
								(0, react_jsx_runtime.jsx)("span", { children: currentPackageId === void 0 ? "" : t("panel.current", { packageId: currentPackageId }) }),
								(0, react_jsx_runtime.jsx)("span", { children: t("panel.next", { packageId: nextPackageId }) }),
								(0, react_jsx_runtime.jsxs)("div", {
									className: CordisPanel_module_css_default.transitionActions,
									children: [(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: busy,
										onClick: () => {
											runAction(pluginId, () => onRun({
												agentId: listed.agentId,
												pluginId,
												packageId: nextPackageId,
												mode: currentPackageId === void 0 ? "run" : "update",
												hasClientHalf: packageOf(listed, nextPackageId)?.hasClientHalf === true
											}));
										},
										children: t("action.retry")
									}), currentPackageId !== void 0 && (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: busy,
										onClick: () => {
											runAction(pluginId, () => onRun({
												agentId: listed.agentId,
												pluginId,
												packageId: currentPackageId,
												mode: "run",
												hasClientHalf: packageOf(listed, currentPackageId)?.hasClientHalf === true
											}));
										},
										children: t("action.rollback")
									})]
								})
							]
						}),
						failure !== void 0 && (0, react_jsx_runtime.jsx)("div", {
							className: CordisPanel_module_css_default.rowError,
							role: "alert",
							children: `${failure.message} (${failure.reason})`
						}),
						failure === void 0 && hostFailure !== void 0 && (0, react_jsx_runtime.jsx)("div", {
							className: CordisPanel_module_css_default.rowError,
							role: "alert",
							children: `${hostFailure.message} (${hostFailure.phase})`
						}),
						actionError !== void 0 && (0, react_jsx_runtime.jsx)("div", {
							className: CordisPanel_module_css_default.rowError,
							role: "alert",
							children: actionError
						}),
						renderFailure !== void 0 && (0, react_jsx_runtime.jsx)("div", {
							className: CordisPanel_module_css_default.rowError,
							role: "alert",
							"data-cordis-render-failure": renderFailure.slot,
							"data-cordis-render-abdicated": renderFailure.abdicated || void 0,
							children: `${t(RENDER_FAILURE_LABELS[renderFailure.abdicated ? "abdicated" : "held"], { slot: renderFailure.slot })} ${renderFailure.message}`
						}),
						activePackage !== void 0 && activePackage.packageId !== selectedPackageId && (0, react_jsx_runtime.jsx)("span", {
							className: CordisPanel_module_css_default.activeVersion,
							children: `${t("status.running")}: ${activePackage.name} · ${activePackage.packageId}`
						})
					]
				}, pluginId);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: wide ? CordisPanel_module_css_default.layer : `${CordisPanel_module_css_default.layer} ${CordisPanel_module_css_default.rail}`,
				children: [open && anchor !== void 0 && (0, react_jsx_runtime.jsxs)("section", {
					className: CordisPanel_module_css_default.panel,
					style: anchor,
					"data-cordis-panel": true,
					"aria-label": t("panel.title"),
					children: [(0, react_jsx_runtime.jsx)("header", {
						className: CordisPanel_module_css_default.header,
						children: (0, react_jsx_runtime.jsx)("span", {
							className: CordisPanel_module_css_default.title,
							children: t("panel.title")
						})
					}), (0, react_jsx_runtime.jsxs)("div", {
						className: CordisPanel_module_css_default.body,
						children: [
							inventory.error !== void 0 && (0, react_jsx_runtime.jsx)("p", {
								className: CordisPanel_module_css_default.readError,
								role: "alert",
								children: t("panel.readFailed", { message: inventory.error })
							}),
							!inventory.read && inventory.error === void 0 && (0, react_jsx_runtime.jsx)("p", {
								className: CordisPanel_module_css_default.note,
								children: t("panel.loading")
							}),
							inventory.read && all.length === 0 && (0, react_jsx_runtime.jsx)("p", {
								className: CordisPanel_module_css_default.note,
								children: t("panel.empty")
							}),
							mine.length > 0 && (0, react_jsx_runtime.jsxs)("section", { children: [(0, react_jsx_runtime.jsx)("h3", {
								className: CordisPanel_module_css_default.group,
								children: t("panel.group.current")
							}), (0, react_jsx_runtime.jsx)("ul", {
								className: CordisPanel_module_css_default.rows,
								children: mine.map(renderRow)
							})] }),
							theirs.length > 0 && (0, react_jsx_runtime.jsxs)("section", { children: [(0, react_jsx_runtime.jsx)("h3", {
								className: CordisPanel_module_css_default.group,
								children: t("panel.group.others")
							}), (0, react_jsx_runtime.jsx)("ul", {
								className: CordisPanel_module_css_default.rows,
								children: theirs.map(renderRow)
							})] })
						]
					})]
				}), (0, react_jsx_runtime.jsx)("div", {
					className: CordisPanel_module_css_default.footerButtons,
					children: (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: CordisPanel_module_css_default.badge,
						"data-cordis-badge": all.length,
						"data-cordis-approval-badge": approvals,
						"data-active": approvals > 0 || void 0,
						"aria-label": t("panel.plugins.aria"),
						"aria-expanded": open,
						onClick: () => {
							setOpen((value) => !value);
						},
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCordisPluginOutlineRegular, { size: wide ? 16 : 18 }), wide && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
							className: CordisPanel_module_css_default.badgeLabel,
							children: t("panel.trigger")
						}), (0, react_jsx_runtime.jsx)("span", {
							className: CordisPanel_module_css_default.badgeCount,
							children: t("panel.runningCount", { count: running })
						})] })]
					})
				})]
			});
		}
		//#endregion
		//#region lib/types/client/inventory.js
		/**
		* The host's definition registry as this page last read it, owned by the
		* plugin's apply closure.
		*
		* The panel is a frame-wide surface, so it cannot derive this from any session:
		* the registry is global and the read is a single global call. The rows are
		* re-read rather than patched, because the wire announcements
		* (`cordis/dynamic-package` / `/retract`) carry no labels and a definition
		* can appear or disappear between them — a patch-in-place cache would drift into
		* showing definitions the host no longer holds.
		*
		* Reads are single-flight: several announcements settling at once, or a badge
		* opening while a reconnect re-reads, must not multiply the call. Single-flight
		* alone would be wrong across a reconnect, though — the in-flight read belongs to
		* the previous connection, so a reset both discards its answer and frees the slot
		* for a fresh one. Without that, a reconnect either loses its re-read to the old
		* call or has the old host's rows published on top of it.
		*/
		/**
		* Create the inventory source.
		* @param port - the RPC seam the read goes through.
		* @param onError - reporter for a failed read (console in production, captured in specs).
		* @returns the inventory observable and its read trigger.
		*/
		function createCordisInventory(port, onError) {
			const listeners = /* @__PURE__ */ new Set();
			let snapshot = {
				rows: [],
				removed: /* @__PURE__ */ new Set(),
				read: false
			};
			let inFlight;
			let generation = 0;
			const publish = (next) => {
				snapshot = next;
				for (const listener of [...listeners]) listener();
			};
			return {
				getSnapshot: () => snapshot,
				subscribe: (fn) => {
					listeners.add(fn);
					return () => {
						listeners.delete(fn);
					};
				},
				refresh: () => {
					if (inFlight !== void 0) return;
					const issued = generation;
					inFlight = port.inventory().then((rows) => {
						if (issued !== generation) return;
						const removed = new Set(snapshot.removed);
						const live = new Set(rows.map((row) => row.pluginId));
						for (const previous of snapshot.rows) if (!live.has(previous.pluginId)) removed.add(previous.pluginId);
						publish({
							rows,
							removed,
							read: true
						});
					}, (error) => {
						if (issued !== generation) return;
						onError(error);
						publish({
							rows: snapshot.rows,
							removed: snapshot.removed,
							read: snapshot.read,
							error: error instanceof Error ? error.message : "reading the cordis inventory failed"
						});
					}).then(() => {
						if (issued === generation) inFlight = void 0;
export {};
