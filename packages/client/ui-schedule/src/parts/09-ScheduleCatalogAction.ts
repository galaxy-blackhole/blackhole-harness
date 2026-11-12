/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/ScheduleCatalogAction.js
		const SECOND_MS = 1e3;
		const MEASURE_STYLE$2 = {
			visibility: "hidden",
			left: 0,
			top: 0
		};
		/** Current-Session reminder catalog with durable deletion. */
		function ScheduleCatalogAction({ useSession, useCatalog, onDelete, onRetry, openTaskDetail, t }) {
			const openState = useSession((snapshot) => snapshot.openState);
			const { records, status, deleting } = useCatalog((value) => value);
			const visible = openState === "open";
			const [open, setOpen] = (0, react.useState)(false);
			const [now, setNow] = (0, react.useState)(() => Date.now());
			const rootRef = (0, react.useRef)(null);
			const triggerRef = (0, react.useRef)(null);
			const catalogRef = (0, react.useRef)(null);
			const catalogPosition = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open,
				anchorRef: triggerRef,
				panelRef: catalogRef,
				side: "bottom",
				gap: 5,
				margin: 16
			});
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open, setOpen, catalogRef);
			(0, react.useEffect)(() => {
				if (!open) return;
				setNow(Date.now());
				const timer = setInterval(() => {
					setNow(Date.now());
				}, SECOND_MS);
				return () => {
					clearInterval(timer);
				};
			}, [open]);
			(0, react.useEffect)(() => {
				if (visible || !open) return;
				setOpen(false);
			}, [visible, open]);
			const rows = (0, react.useMemo)(() => orderScheduleRecords(records, now), [records, now]);
			if (!visible) return null;
			if (records.length === 0 && status !== "error") return null;
			const known = records.length;
			const triggerLabel = known === 0 ? t("trigger.label") : t(known === 1 ? "trigger.one" : "trigger.other", { count: known });
			const soleTask = status === "ready" && records.length === 1 ? records[0] : void 0;
			const expandable = soleTask === void 0 || open;
			const toggleCatalog = () => {
				setNow(Date.now());
				setOpen((current) => !current);
			};
			const openTask = (id) => {
				setOpen(false);
				openTaskDetail(id);
			};
			const onKeyDown = (event) => {
				if (event.key !== "Escape" || !open) return;
				event.preventDefault();
				setOpen(false);
				triggerRef.current?.focus();
			};
			const trigger = (0, react_jsx_runtime.jsx)("button", {
				ref: triggerRef,
				type: "button",
				className: ScheduleCatalogAction_module_css_default.trigger,
				"data-schedule-reminder-entry": "",
				"aria-expanded": expandable ? open : void 0,
				"aria-label": triggerLabel,
				onClick: () => {
					if (expandable) {
						toggleCatalog();
						return;
					}
					setNow(Date.now());
					openTask(soleTask.id);
				},
				children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular, { size: 16 })
			});
			const catalog = open ? (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)("ul", {
				ref: catalogRef,
				className: ScheduleCatalogAction_module_css_default.menu,
				style: catalogPosition ?? MEASURE_STYLE$2,
				"aria-label": t("list.aria"),
				onKeyDown,
				children: [
					status === "loading" && (0, react_jsx_runtime.jsx)("li", {
						className: ScheduleCatalogAction_module_css_default.row,
						role: "status",
						children: t("list.loading")
					}),
					status === "error" && (0, react_jsx_runtime.jsxs)("li", {
						className: ScheduleCatalogAction_module_css_default.row,
						children: [(0, react_jsx_runtime.jsx)("span", {
							role: "alert",
							children: t("list.error")
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								onRetry();
							},
							children: t("list.retry")
						})]
					}),
					rows.map((record) => {
						const overdue = Date.parse(record.scheduledAt) <= now;
						const nextRun = nextRunParts(record.scheduledAt, t("time.locale"), now, t);
						return (0, react_jsx_runtime.jsxs)("li", {
							className: overdue ? `${ScheduleCatalogAction_module_css_default.row} ${ScheduleCatalogAction_module_css_default.rowTask} ${ScheduleCatalogAction_module_css_default.rowOverdue}` : `${ScheduleCatalogAction_module_css_default.row} ${ScheduleCatalogAction_module_css_default.rowTask}`,
							children: [(0, react_jsx_runtime.jsxs)("span", {
								className: ScheduleCatalogAction_module_css_default.body,
								children: [
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: ScheduleCatalogAction_module_css_default.openButton,
										"aria-label": t("list.open", { title: taskName(record) }),
										onClick: () => {
											openTask(record.id);
										},
										children: (0, react_jsx_runtime.jsx)("span", {
											className: ScheduleCatalogAction_module_css_default.title,
											children: taskName(record)
										})
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: overdue ? `${ScheduleCatalogAction_module_css_default.metadata} ${ScheduleCatalogAction_module_css_default.metadataOverdue}` : ScheduleCatalogAction_module_css_default.metadata,
										children: (0, react_jsx_runtime.jsx)("span", { children: formatScheduleFrequency(record, t) })
									}),
									(0, react_jsx_runtime.jsxs)("span", {
										className: overdue ? `${ScheduleCatalogAction_module_css_default.nextRun} ${ScheduleCatalogAction_module_css_default.metadataOverdue}` : ScheduleCatalogAction_module_css_default.nextRun,
										children: [
											(0, react_jsx_runtime.jsx)("span", { children: `${t("list.nextRun")} ` }),
											(0, react_jsx_runtime.jsx)("time", {
												dateTime: record.scheduledAt,
												children: nextRun.absolute
											}),
											(0, react_jsx_runtime.jsx)("span", {
												className: ScheduleCatalogAction_module_css_default.nextRunRelative,
												children: nextRun.relative
											})
										]
									})
								]
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ScheduleCatalogAction_module_css_default.deleteButton,
								"aria-label": t("delete.label", { title: taskName(record) }),
								title: t(deleting.includes(record.id) ? "delete.pending" : "delete.action"),
								disabled: deleting.includes(record.id),
								onClick: () => {
									onDelete(record.id);
								},
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
							})]
						}, record.id);
					})
				]
			}), document.body) : null;
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: ScheduleCatalogAction_module_css_default.root,
				onKeyDown,
				children: [trigger, catalog]
			});
		}
		//#endregion
