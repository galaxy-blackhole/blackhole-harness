/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
						e.stopPropagation();
						if (hoverWorkspace === void 0) {
							e.dataTransfer.dropEffect = "none";
							if (workspaceDrag.over !== null) setWorkspaceDrag({
								...workspaceDrag,
								over: null
							});
						} else {
							e.dataTransfer.dropEffect = "move";
							hoverWorkspace(workspaceGroupHalf(e));
						}
					},
					onDrop: workspaceDrag === null ? void 0 : (e) => {
						e.preventDefault();
						if (dropWorkspace === void 0 && parents.get(group.key) !== void 0) return;
						e.stopPropagation();
						if (dropWorkspace === void 0) {
							workspaceDropCommitted.current = true;
							setWorkspaceDrag(null);
						} else dropWorkspace(workspaceGroupHalf(e));
					},
					children: [
						(0, react_jsx_runtime.jsx)(ProjectRowItem, {
							newShortcut: shortcuts.find((row) => row.id === "session.new"),
							group,
							containsCurrentDescendant: currentAncestors.has(group.key),
							home,
							t,
							onToggle: () => {
								if (group.expanded) dropWatermarks((key) => withinGroup(key, group.key));
								setGroupExpanded(group.key, !group.expanded);
							},
							onCreate: () => {
								if (group.workspaceId !== void 0) {
									setGroupExpanded(group.key, true);
									startSession(group.workspaceId);
								}
							},
							drag: workspaceDragProps,
							actions: group.workspaceId === void 0 ? void 0 : {
								rename: () => {
									/* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
									if (group.workspaceId !== void 0) onRenameRequest(group.workspaceId, group.label);
								},
								delete: () => {
									/* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
									if (group.workspaceId !== void 0) onDeleteRequest(group.workspaceId, group.label);
								}
							}
						}),
						childRows.length > 0 && (0, react_jsx_runtime.jsx)("div", {
							role: "group",
							children: childRows
						}),
						sessions.map((node) => {
							const sameGroupDrag = drag !== null && drag.accountKey === group.key;
							const compatibleTarget = sameGroupDrag && drag.pinned === node.pinned;
							const normalizeHalf = (half) => node.blank ? "after" : half;
							const dragProps = {
								start: () => {
									sessionDropCommitted.current = false;
									setDrag({
										accountKey: group.key,
										sessionId: node.id,
										pinned: node.pinned,
										over: null
									});
								},
								active: compatibleTarget,
								marker: sameGroupDrag && drag.over?.id === node.id ? drag.over.half : null,
								hover: (half) => {
									/* v8 ignore next -- narrowing guard: Rows gates hover on `active`, which is false while the drag state is null. */
									setDrag((d) => d === null ? d : {
										...d,
										over: {
											id: node.id,
											half: normalizeHalf(half)
										}
									});
								},
								drop: (half) => {
									/* v8 ignore next -- narrowing guard: Rows gates drop on `active`, which is false while the drag state is null. */
									if (drag === null) return;
									commitSessionDrag(drag, {
										id: node.id,
										half: normalizeHalf(half)
									});
								},
								end: () => {
									if (drag?.over !== null && drag?.over !== void 0) commitSessionDrag(drag, drag.over);
									else setDrag(null);
									sessionDropCommitted.current = false;
								}
							};
							return (0, react_jsx_runtime.jsx)(SessionNodeItem, {
								node,
								currentId: current,
								now,
								onOpen: open,
								onRenameRequest: onSessionRenameRequest,
								renderSlot,
								onReveal: node.id === revealSessionId && group.key === revealGroup ? () => {
									onSessionRevealed(node.id);
								} : void 0,
								drag: dragProps,
								t
							}, node.id);
						}),
						collapsed.hiddenCount > 0 && (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: WorkspaceBrowser_module_css_default.sessionOverflowButton,
							"data-row-key": `overflow:${group.key}`,
							"aria-expanded": sessionsExpanded,
							onClick: () => {
								if (sessionsExpanded) {
									dropWatermarks((key) => key === group.key);
									return;
								}
								setStoredWatermarks((marks) => ({
									...marks,
									[group.key]: visible.hiddenCount <= SESSION_WATERMARK_BASE ? Infinity : watermark + SESSION_WATERMARK_BASE
								}));
								setWatermarkMotionKey((key) => key + 1);
							},
							children: sessionsExpanded ? t("sessions.collapse") : t("sessions.expand", { n: visible.hiddenCount })
						})
					]
				}, group.key);
			};
			const groupRows = rootGroups.map((group) => renderGroup(group, 0));
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.HoverCardGroup, {
				className: clsx(WorkspaceBrowser_module_css_default.treeBody, WorkspaceBrowser_module_css_default.wide),
				children: [
					workspaceDropAtListStart && (0, react_jsx_runtime.jsx)("span", {
						className: WorkspaceBrowser_module_css_default.listTopDropIndicator,
						"aria-hidden": "true"
					}),
					(0, react_jsx_runtime.jsxs)(AnimatedRows, {
						className: clsx(WorkspaceBrowser_module_css_default.list, workspaceDropAtListStart && WorkspaceBrowser_module_css_default.listTopDropActive),
						label: t("section.sessions"),
						rowKeys,
						ready: list.phase === "ready" && workspaceReady && !nativeDragActive,
						resetKey: JSON.stringify([animationResetKey, watermarkMotionKey]),
						children: [groups.length === 0 && (0, react_jsx_runtime.jsx)(EmptySessions, {
							rowState,
							onLeaveArchivedOnly,
							t
						}), groupRows]
					}),
					(0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.fade })
				]
			});
		}
		/** The flat "In one list" body: every session is one draggable top-level row. */
		function FlatList({ list, sessionIds, rowState, onLeaveArchivedOnly, useSessionStatus, open, onSessionRenameRequest, usePanelInfo, setSessionOrder, workspaceReady, animationResetKey, revealSessionId, onSessionRevealed, renderSlot, t }) {
			const panelActive = usePanelInfo((info) => info.activePanelId !== null);
			const statuses = useSessionStatus((s) => s);
			const rows = (0, react.useMemo)(() => deriveFlat(list, sessionIds, rowState, statuses), [
				list,
				sessionIds,
				rowState,
				statuses
			]);
			const [drag, setDrag] = (0, react.useState)(null);
			const dropCommitted = (0, react.useRef)(false);
			useNativeDragAcceptance(drag !== null);
			const currentId = panelActive ? void 0 : Object.values(list.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
			const commitDrag = (activeDrag, over) => {
				if (dropCommitted.current) return;
				dropCommitted.current = true;
				setDrag(null);
				const nextOrder = sessionDragOrder(sessionIds, rows, activeDrag, over);
				if (nextOrder !== void 0) setSessionOrder(FLAT_SESSION_ORDER_KEY, nextOrder);
			};
			const now = Date.now();
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.HoverCardGroup, {
				className: clsx(WorkspaceBrowser_module_css_default.treeBody, WorkspaceBrowser_module_css_default.wide),
				children: [(0, react_jsx_runtime.jsxs)(AnimatedRows, {
					className: clsx(WorkspaceBrowser_module_css_default.list, WorkspaceBrowser_module_css_default.flatList),
					label: t("section.sessions"),
					rowKeys: rows.length === 0 ? ["empty"] : rows.map((row) => `session:${row.id}`),
					ready: list.phase === "ready" && workspaceReady && drag === null,
					resetKey: animationResetKey,
					children: [rows.length === 0 && (0, react_jsx_runtime.jsx)(EmptySessions, {
						rowState,
						onLeaveArchivedOnly,
						t
					}), rows.map((node) => {
						const active = drag !== null && drag.pinned === node.pinned;
						const normalizeHalf = (half) => node.blank ? "after" : half;
						return (0, react_jsx_runtime.jsx)(SessionNodeItem, {
							node,
							currentId,
							now,
							onOpen: open,
							onRenameRequest: onSessionRenameRequest,
							renderSlot,
							onReveal: node.id === revealSessionId ? () => {
								onSessionRevealed(node.id);
							} : void 0,
							drag: {
								start: () => {
									dropCommitted.current = false;
									setDrag({
										accountKey: FLAT_SESSION_ORDER_KEY,
										sessionId: node.id,
										pinned: node.pinned,
										over: null
									});
								},
								active,
								marker: active && drag.over?.id === node.id ? drag.over.half : null,
								hover: (half) => {
									setDrag((current) => current === null ? current : {
										...current,
										over: {
											id: node.id,
											half: normalizeHalf(half)
										}
									});
								},
								drop: (half) => {
									if (drag !== null) commitDrag(drag, {
										id: node.id,
										half: normalizeHalf(half)
									});
								},
								end: () => {
									if (drag?.over !== null && drag?.over !== void 0) commitDrag(drag, drag.over);
									else setDrag(null);
									dropCommitted.current = false;
								}
							},
							t
						}, node.id);
					})]
				}), (0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.fade })]
			});
		}
		/** Flat search body: local metadata matches plus the current Host result page. */
		function SearchResults({ useSessions, useSessionStatus, open, onUnarchive, workspaces, archivedSessionIds, archivedFilter, query, remote, resultLimit, usePanelInfo, t }) {
			const panelActive = usePanelInfo((info) => info.activePanelId !== null);
			const list = useSessions((s) => s);
			const statuses = useSessionStatus((s) => s);
			const currentRemote = remote.query === query ? remote : {
				query,
				status: "loading",
				items: [],
				hasMore: false
			};
			const results = (0, react.useMemo)(() => deriveSearchResults(list, workspaces, query, archivedSessionIds, archivedFilter, statuses, currentRemote, resultLimit), [
				list,
				workspaces,
				query,
				archivedSessionIds,
				archivedFilter,
				statuses,
				currentRemote,
				resultLimit
			]);
			const pending = currentRemote.status === "loading";
			const currentId = panelActive ? void 0 : Object.values(list.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(WorkspaceBrowser_module_css_default.treeBody, WorkspaceBrowser_module_css_default.wide),
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: WorkspaceBrowser_module_css_default.list,
					children: [
						(0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.searchTree,
							role: "tree",
							"aria-label": t("search.results.aria"),
							children: results.items.map((result) => (0, react_jsx_runtime.jsx)(SearchResultItem, {
								result,
								currentId,
								onOpen: open,
								onUnarchive,
								t
							}, result.id))
						}),
						pending && (0, react_jsx_runtime.jsx)("div", {
							role: "status",
							"aria-label": t("search.pending"),
							children: (results.items.length === 0 ? [0, 1] : [0]).map((i) => (0, react_jsx_runtime.jsxs)("div", {
								className: WorkspaceBrowser_module_css_default.skeletonRow,
								"aria-hidden": "true",
								children: [(0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.skeletonDot }), (0, react_jsx_runtime.jsxs)("span", {
									className: WorkspaceBrowser_module_css_default.skeletonBars,
									children: [(0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.skeletonBar }), (0, react_jsx_runtime.jsx)("span", { className: clsx(WorkspaceBrowser_module_css_default.skeletonBar, WorkspaceBrowser_module_css_default.skeletonBarWide) })]
								})]
							}, i))
						}),
						!pending && results.items.length === 0 && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.empty,
							children: t("search.noMatches")
						}),
						results.hasMore && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.searchStatus,
							children: t("search.hasMore", { n: resultLimit })
						})
					]
				}), (0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.fade })]
			});
		}
		/**
		* Render the browsing region.
		* @param props - composed slot props (shell owner share + store + injected actions).
		* @returns the region element tree.
		*/
		function WorkspaceBrowser({ wide, usePanelInfo, expandSidebar, useSessions, useSessionStatus, useWorkspaces, useStore, actions, startSession, open, requestSessionRename, notifyArchivedNotOpenable, renameWorkspace, deleteWorkspace, insertWorkspaceBefore, unarchiveSession, createWorkspace, searchSessions, searchResultLimit, useDirectoryFlow, useHostInfo, useShortcuts, useWorkspaceShortcuts, requestSearch, requestAddWorkspace, closeAddWorkspace, setDirectoryBusy, renderSlot, t }) {
			const home = useHostInfo((info) => info.home);
			const shortcuts = useShortcuts((rows) => rows);
			const searchShortcut = shortcuts.find((row) => row.id === "session.search");
			const addShortcut = shortcuts.find((row) => row.id === "workspace.add");
			const shortcutState = useWorkspaceShortcuts((state) => state);
			const list = useSessions((state) => state);
			const storedWorkspaces = useWorkspaces((state) => state.items);
			const defaultWorkspaceName = t("workspace.defaultName");
			const workspaces = (0, react.useMemo)(() => storedWorkspaces.map((workspace) => ({
				...workspace,
				title: workspaceDisplayTitle(workspace.title, defaultWorkspaceName)
			})), [storedWorkspaces, defaultWorkspaceName]);
			const workspacePhase = useWorkspaces((state) => state.phase);
			const workspaceStreamState = useWorkspaces((state) => state.state);
			const archivedSessionIds = useWorkspaces((state) => state.archivedSessionIds);
			const pinnedSessionIds = useWorkspaces((state) => state.pinnedSessionIds);
			const directoryFlowAvailable = useDirectoryFlow((occupied) => occupied);
			const groupBy = useStore((s) => s.groupBy);
			const orderBy = useStore((s) => s.orderBy);
			const archivedFilter = useStore((s) => s.archivedFilter ?? "default");
			const groupExpansion = useStore((s) => s.groupExpansion);
			const sessionOrderByAccount = useStore((s) => s.sessionOrderByAccount);
			const guardedOpen = (sessionId) => {
				if (archivedSessionIds.includes(sessionId)) {
					notifyArchivedNotOpenable();
					return;
				}
				open(sessionId);
			};
			const leaveArchivedOnly = () => {
				actions.setArchivedFilter("default");
			};
			const workspaceReady = workspacePhase === "ready" && workspaceStreamState !== "loading";
			const mainSessionId = Object.values(list.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
			const currentBlank = mainSessionId !== void 0 && list.byId[mainSessionId]?.blank === true ? mainSessionId : void 0;
			const ungroupedMemberIds = (0, react.useMemo)(() => {
				const accounted = new Set(workspaces.flatMap((workspace) => workspace.sessionIds));
				return list.ids.filter((id) => list.byId[id] !== void 0 && !accounted.has(id));
			}, [list, workspaces]);
			const orderState = (0, react.useMemo)(() => ({
				pinnedSessionIds,
				archivedSessionIds
			}), [archivedSessionIds, pinnedSessionIds]);
			const rowState = (0, react.useMemo)(() => ({
				...orderState,
				archivedFilter
			}), [orderState, archivedFilter]);
			const flatMemberIds = (0, react.useMemo)(() => sessionMemberIds(list), [list]);
			const orderedWorkspaces = (0, react.useMemo)(() => workspaces.map((workspace) => {
				const memberIds = workspace.sessionIds;
				const baseOrder = orderBy === "updated" ? orderByRecency(memberIds, list.byId) : reconcileManualOrder(memberIds, sessionOrderByAccount[workspace.workspaceId], list.byId, orderState);
				return {
					...workspace,
					sessionIds: pinCurrentBlank(baseOrder, currentBlank !== void 0 && memberIds.includes(currentBlank) ? currentBlank : void 0)
				};
			}), [
				currentBlank,
				list.byId,
				orderBy,
				orderState,
				sessionOrderByAccount,
				workspaces
			]);
			const orderedUngroupedSessionIds = (0, react.useMemo)(() => {
				return pinCurrentBlank(orderBy === "updated" ? orderByRecency(ungroupedMemberIds, list.byId) : reconcileManualOrder(ungroupedMemberIds, sessionOrderByAccount[""], list.byId, orderState), currentBlank !== void 0 && ungroupedMemberIds.includes(currentBlank) ? currentBlank : void 0);
			}, [
				currentBlank,
				list.byId,
				orderBy,
				orderState,
				sessionOrderByAccount,
				ungroupedMemberIds
			]);
			const orderedFlatSessionIds = (0, react.useMemo)(() => {
				return pinCurrentBlank(orderBy === "updated" ? orderByRecency(flatMemberIds, list.byId) : reconcileManualOrder(flatMemberIds, sessionOrderByAccount[FLAT_SESSION_ORDER_KEY], list.byId, orderState), currentBlank !== void 0 && flatMemberIds.includes(currentBlank) ? currentBlank : void 0);
			}, [
				currentBlank,
				flatMemberIds,
				list.byId,
				orderBy,
				orderState,
				sessionOrderByAccount
			]);
			const activeSessionOrders = (0, react.useMemo)(() => Object.fromEntries([
				...orderedWorkspaces.map((workspace) => [workspace.workspaceId, workspace.sessionIds]),
				["", orderedUngroupedSessionIds],
				[FLAT_SESSION_ORDER_KEY, orderedFlatSessionIds]
			]), [
				orderedFlatSessionIds,
				orderedUngroupedSessionIds,
				orderedWorkspaces
export {};
