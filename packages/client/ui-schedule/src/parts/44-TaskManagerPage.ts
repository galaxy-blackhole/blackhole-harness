/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/TaskManagerPage.js
		/** Cross-session retained reminders with local search and selection. */
		/**
		* Render retained tasks with authoritative deletion and timing-only edits.
		* @param props - framework catalog snapshot, localized copy, and action callbacks.
		* @returns the searchable task list beside the selected task's detail.
		*/
		function TaskManagerPage(props) {
			const { useCatalog, onNewTask, onRetry, t } = props;
			const catalog = useCatalog((snapshot) => snapshot);
			const { records, status } = catalog;
			const [search, setSearch] = (0, react.useState)("");
			const [statusFilter, setStatusFilter] = (0, react.useState)("all");
			const [selectedId, setSelectedId] = (0, react.useState)(null);
			const now = useRelativeClock();
			const detail = useTaskDetail(props, catalog, selectedId ?? void 0);
			const { record: catalogRecord, task: selected, id: detailId, confirmId, setConfirmId, setTab } = detail;
			const rowRef = (0, react.useRef)(null);
			const headingRef = (0, react.useRef)(null);
			const confirming = records.find((record) => record.id === confirmId);
			const rows = (0, react.useMemo)(() => {
				const query = search.trim().toLowerCase();
				return records.filter((record) => (statusFilter === "all" || record.status === statusFilter) && (record.prompt.toLowerCase().includes(query) || record.sessionId.toLowerCase().includes(query) || taskName(record).toLowerCase().includes(query))).toSorted((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt));
			}, [
				records,
				search,
				statusFilter
			]);
			const emptyTitle = statusFilter === "inactive" && search.trim() === "" ? "list.emptyInactive" : records.length === 0 ? "list.empty" : "list.noMatches";
			const frequencyZone = {
				system: Intl.DateTimeFormat().resolvedOptions().timeZone,
				label: (zone) => zoneLabel(zone, t)
			};
			const frequency = (record) => formatScheduleFrequency(record, t, frequencyZone);
			(0, react.useEffect)(() => {
				if (selectedId !== null) return;
				if (rowRef.current !== null) {
					(rowRef.current.isConnected ? rowRef.current : headingRef.current)?.focus();
					rowRef.current = null;
				}
			}, [selectedId]);
			(0, react.useEffect)(() => {
				if (status !== "ready") return;
				if (selectedId !== null && selected === void 0) setSelectedId(null);
				if (confirmId !== null && confirming === void 0) setConfirmId(null);
			}, [
				status,
				selectedId,
				selected,
				confirmId,
				confirming
			]);
			const closeDetails = () => {
				setSelectedId(null);
			};
			return (0, react_jsx_runtime.jsxs)("section", {
				className: clsx(TaskManagerPage_module_css_default.page, selected !== void 0 && TaskManagerPage_module_css_default.hasDetails),
				"aria-label": t("title"),
				"data-testid": "task-manager-page",
				onKeyDown: (event) => {
					if (event.key !== "Escape" || event.defaultPrevented || confirmId !== null || selectedId === null) return;
					event.preventDefault();
					event.stopPropagation();
					closeDetails();
				},
				children: [(0, react_jsx_runtime.jsx)("div", {
					className: TaskManagerPage_module_css_default.listPane,
					children: (0, react_jsx_runtime.jsx)("div", {
						className: TaskManagerPage_module_css_default.pageScroll,
						children: (0, react_jsx_runtime.jsxs)("div", {
							className: TaskManagerPage_module_css_default.pageContent,
							children: [
								(0, react_jsx_runtime.jsxs)("div", {
									className: TaskManagerPage_module_css_default.pageHeading,
									children: [(0, react_jsx_runtime.jsx)("h1", {
										ref: headingRef,
										tabIndex: -1,
										children: t("title")
									}), (0, react_jsx_runtime.jsx)("div", {
										className: TaskManagerPage_module_css_default.creationActions,
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "primary",
											size: "sm",
											className: TaskManagerPage_module_css_default.newButton,
											icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 13 }),
											onClick: onNewTask,
											children: t("new.action")
										})
									})]
								}),
								(0, react_jsx_runtime.jsx)("div", {
									className: TaskManagerPage_module_css_default.filters,
									children: (0, react_jsx_runtime.jsx)("div", {
										className: TaskManagerPage_module_css_default.filterTabs,
										role: "group",
										"aria-label": t("statusFilter.label"),
										children: [
											"all",
											"active",
											"inactive"
										].map((value) => (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: clsx(TaskManagerPage_module_css_default.filterTab, statusFilter === value && TaskManagerPage_module_css_default.filterTabActive),
											"aria-pressed": statusFilter === value,
											onClick: () => {
												setStatusFilter(value);
											},
											children: t(value === "all" ? "statusFilter.all" : `status.${value}`)
										}, value))
									})
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: TaskManagerPage_module_css_default.searchField,
									children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
										type: "search",
										icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, {}),
										"aria-label": t("search.label"),
										placeholder: t("search.placeholder"),
										value: search,
										onChange: (event) => {
											setSearch(event.target.value);
										}
									}), search !== "" && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										size: "sm",
										className: TaskManagerPage_module_css_default.searchClear,
										"aria-label": t("search.clear"),
										onClick: () => {
											setSearch("");
										},
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, {})
									})]
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: TaskManagerPage_module_css_default.list,
									children: [
										selected === void 0 && (0, react_jsx_runtime.jsx)(CatalogFeedback, {
											status,
											populated: rows.length > 0,
											onRetry,
											t
										}),
										status === "ready" && rows.length === 0 && (0, react_jsx_runtime.jsxs)("div", {
											className: TaskManagerPage_module_css_default.empty,
											role: "status",
											children: [
												(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular, {
													size: 24,
													className: TaskManagerPage_module_css_default.emptyGlyph
												}),
												(0, react_jsx_runtime.jsx)("h2", { children: t(emptyTitle) }),
												(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
													variant: "outline",
													className: TaskManagerPage_module_css_default.emptyAction,
													onClick: onNewTask,
													children: t("empty.action")
												})
											]
										}),
										(0, react_jsx_runtime.jsx)("ul", {
											className: TaskManagerPage_module_css_default.listRows,
											"aria-label": t("list.label"),
											"aria-busy": status === "loading",
											children: rows.map((record) => {
												const nextRun = nextRunParts(record.scheduledAt, t("time.locale"), now, t);
												return (0, react_jsx_runtime.jsx)("li", { children: (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
													className: clsx(TaskManagerPage_module_css_default.row, selectedId === record.id && TaskManagerPage_module_css_default.selectedRow, record.status === "inactive" && TaskManagerPage_module_css_default.endedRow),
													"aria-label": taskName(record),
													"aria-describedby": `${detailId}-metadata-${record.id}`,
													"aria-expanded": selectedId === record.id,
													"aria-controls": selectedId === record.id ? detailId : void 0,
													onClick: (event) => {
														rowRef.current = event.currentTarget;
														setSelectedId(record.id);
														setTab("rule");
													},
													children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular, { className: TaskManagerPage_module_css_default.rowGlyph }), (0, react_jsx_runtime.jsxs)("span", {
														className: TaskManagerPage_module_css_default.rowContent,
														children: [(0, react_jsx_runtime.jsx)("span", {
															className: TaskManagerPage_module_css_default.rowTitle,
															children: taskName(record)
														}), (0, react_jsx_runtime.jsxs)("span", {
															className: TaskManagerPage_module_css_default.rowSummary,
															id: `${detailId}-metadata-${record.id}`,
															children: [
																record.status === "inactive" && (0, react_jsx_runtime.jsx)("span", {
																	className: TaskManagerPage_module_css_default.metadata,
																	children: t("status.inactive")
																}),
																(0, react_jsx_runtime.jsx)("span", {
																	className: TaskManagerPage_module_css_default.metadata,
																	children: frequency(record)
																}),
																record.status === "active" && (0, react_jsx_runtime.jsxs)("span", {
																	className: TaskManagerPage_module_css_default.metadata,
																	children: [
																		t("list.nextPrefix"),
																		(0, react_jsx_runtime.jsx)("time", {
																			dateTime: record.scheduledAt,
																			children: nextRun.absolute
																		}),
																		" ",
																		(0, react_jsx_runtime.jsx)("span", {
																			className: TaskManagerPage_module_css_default.nextRunRelative,
																			children: nextRun.relative
																		})
																	]
																})
															]
														})]
													})]
												}) }, record.id);
											})
										})
									]
								})
							]
						})
					})
				}), selected !== void 0 && (0, react_jsx_runtime.jsx)(TaskDetail, {
					...detail.props,
					task: selected,
					authoritative: catalogRecord !== void 0,
					onDeleted: closeDetails,
					onClose: closeDetails
				})]
			});
		}
		//#endregion
