/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		/** `session.search` wire bound, measured in JavaScript UTF-16 code units. */
		const SEARCH_QUERY_MAX_CODE_UNITS = 500;
		/** Non-blank Session rows visible per Workspace while no Session raises its watermark. */
		const SESSION_WATERMARK_BASE = 5;
		/** Highest watermark that attention-bearing Sessions raise automatically; Show more and search reveals may exceed it. */
		const SESSION_WATERMARK_AUTO_MAX = 50;
		/** Show the blank row plus the first `watermark` non-blank rows, in list order. */
		function watermarkRows(sessions, watermark) {
			let count = 0;
			const rows = sessions.filter((session) => {
				if (session.blank) return true;
				count += 1;
				return count <= watermark;
			});
			return {
				rows,
				hiddenCount: sessions.length - rows.length
			};
		}
		/**
		* Smallest watermark that covers every non-blank row within the automatic maximum that is running, has a running
		* child, awaits the user, carries an unread completion, or is current, and the reveal target at any position.
		*/
		function requiredWatermark(sessions, current, revealSessionId) {
			let index = 0;
			let required = 0;
			for (const session of sessions) {
				if (session.blank) continue;
				index += 1;
				if (index <= SESSION_WATERMARK_AUTO_MAX && (session.running || session.runningSubagentCount > 0 || session.pendingInteraction !== void 0 || session.completed || session.id === current) || session.id === revealSessionId) required = index;
			}
			return required;
		}
		/** Raise each listed group's watermark to its requirement; returns `marks` itself when nothing rises. */
		function raiseWatermarks(marks, required) {
			let raised = marks;
			for (const [key, watermark] of required) if (watermark > (raised[key] ?? SESSION_WATERMARK_BASE)) raised = {
				...raised,
				[key]: watermark
			};
			return raised;
		}
		/** Keep controlled input and RPC payload inside the session.search wire contract. */
		function sanitizeSearchQuery(value) {
			const withoutNul = value.replaceAll("\0", "");
			if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul;
			let end = SEARCH_QUERY_MAX_CODE_UNITS;
			const last = withoutNul.charCodeAt(end - 1);
			const next = withoutNul.charCodeAt(end);
			if (last >= 55296 && last <= 56319 && next >= 56320 && next <= 57343) end--;
			return withoutNul.slice(0, end);
		}
		/**
		* Accept the native drag at document level while a row drag is active: row
		* hover still owns the insertion marker, and releasing outside the list must
		* not be rendered as a rejected drop before dragend commits that last marker.
		*/
		function useNativeDragAcceptance(active) {
			(0, react.useEffect)(() => {
				if (!active) return;
				const acceptDrag = (event) => {
					event.preventDefault();
					if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "move";
				};
				const acceptDrop = (event) => {
					event.preventDefault();
				};
				document.addEventListener("dragover", acceptDrag);
				document.addEventListener("drop", acceptDrop);
				return () => {
					document.removeEventListener("dragover", acceptDrag);
					document.removeEventListener("drop", acceptDrop);
				};
			}, [active]);
		}
		/** Grouping, ordering, and archived-filter menu; own open state so it resets with the wide chrome. */
		function ViewOptionsMenu({ groupBy, orderBy, archivedFilter, onGroupPick, onOrderPick, onArchivedFilterPick, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open,
				onClose: () => {
					setOpen(false);
				},
				items: [
					{
						type: "label",
						id: "group-by",
						text: t("groupBy.label")
					},
					{
						id: "workspace",
						label: t("groupBy.workspace"),
						icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseRegular, {})
					},
					{
						id: "workspace-tree",
						label: t("groupBy.workspaceTree"),
						icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWorkspaceTreeOutlineRegular, {})
					},
					{
						id: "flat",
						label: t("groupBy.flat"),
						icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFlatListOutlineRegular, {})
					},
					{
						type: "separator",
						id: "order-by-separator"
					},
					{
						type: "label",
						id: "order-by",
						text: t("orderBy.label")
					},
					{
						id: "manual",
						label: t("orderBy.manual"),
						icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronsUpDownOutlineRegular, {})
					},
					{
						id: "updated",
						label: t("orderBy.updated"),
						icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular, {})
					},
					{
						type: "separator",
						id: "archived-filter-separator"
					},
					{
						type: "label",
						id: "filter-by",
						text: t("filterBy.label")
					},
					{
						id: "hide-archived",
						label: t("viewOptions.hideArchived"),
						icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOffOutlineRegular, {})
					},
					{
						id: "show-archived",
						label: t("viewOptions.showArchived"),
						icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQueueOutlineRegular, {})
					},
					{
						id: "only-archived",
						label: t("viewOptions.onlyArchived"),
						icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveCheckOutlineRegular, {})
					}
				],
				selectedIds: [
					groupBy,
					orderBy,
					{
						default: "hide-archived",
						show: "show-archived",
						only: "only-archived"
					}[archivedFilter]
				],
				onSelect: (id) => {
					if (id === "workspace" || id === "workspace-tree" || id === "flat") onGroupPick(id);
					else if (id === "manual" || id === "updated") onOrderPick(id);
					else if (id === "hide-archived") onArchivedFilterPick("default");
					else if (id === "show-archived") onArchivedFilterPick("show");
					else if (id === "only-archived") onArchivedFilterPick("only");
					setOpen(false);
				},
				align: "end",
				dense: true,
				listClassName: WorkspaceBrowser_module_css_default.viewOptionsMenu,
				portal: true,
				anchor: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: t("viewOptions.label"),
					side: "bottom",
					delayMs: 500,
					children: (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: clsx(WorkspaceBrowser_module_css_default.iconButton, WorkspaceBrowser_module_css_default.wide),
						"aria-label": t("viewOptions.label"),
						onClick: () => {
							setOpen((v) => !v);
						},
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSlidersTwoOutlineRegular, {})
					})
				})
			});
		}
		/** Apply a visible drop to the complete account without removing hidden members. */
		function sessionDragOrder(order, rows, drag, over) {
			const source = rows.find((row) => row.id === drag.sessionId);
			const target = rows.find((row) => row.id === over.id);
			if (source === void 0 || target === void 0 || source.blank || source.pinned !== drag.pinned || target.pinned !== drag.pinned || source.id === target.id || !order.includes(source.id)) return;
			const section = rows.filter((row) => row.pinned === drag.pinned);
			const sourceIndex = section.findIndex((row) => row.id === source.id);
			if (section.filter((row) => row.id !== source.id).findIndex((row) => row.id === target.id) + (over.half === "after" ? 1 : 0) === sourceIndex) return;
			const next = order.filter((id) => id !== source.id);
			const targetIndex = next.indexOf(target.id);
			if (targetIndex === -1) return;
			next.splice(targetIndex + (over.half === "after" ? 1 : 0), 0, source.id);
			return pinCurrentBlank(next, rows.find((row) => row.blank)?.id);
		}
		/** Resolve an insertion side across the Workspace header, descendants, and Sessions. */
		function workspaceGroupHalf(e) {
			const rect = e.currentTarget.getBoundingClientRect();
			return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
		}
		/** The list-empty placeholder — a glyph over the text; the archived-only view names its filter and offers the way back. */
		function EmptySessions({ rowState, onLeaveArchivedOnly, t }) {
			const archivedOnly = rowState.archivedFilter === "only";
			return (0, react_jsx_runtime.jsxs)("div", {
				className: WorkspaceBrowser_module_css_default.emptyState,
				"data-row-key": "empty",
				children: [
					archivedOnly ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 24 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQueueOutlineRegular, { size: 24 }),
					(0, react_jsx_runtime.jsx)("div", { children: archivedOnly ? t("empty.noneArchived") : t("empty.none") }),
					archivedOnly && (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: WorkspaceBrowser_module_css_default.emptyAction,
						onClick: onLeaveArchivedOnly,
						children: t("empty.viewOthers")
					})
				]
			});
		}
		/** The scrolling session tree; unmounting drops the sessions subscription and the session watermarks. */
		function SessionTree({ list, useSessionStatus, startSession, open, workspaces, ungroupedSessionIds, rowState, onLeaveArchivedOnly, workspaceReady, animationResetKey, usePanelInfo, onRenameRequest, onDeleteRequest, onSessionRenameRequest, renderSlot, insertWorkspaceBefore, nestWorkspaces, groupExpansion, setGroupExpanded, setSessionOrder, home, t, revealSessionId, onSessionRevealed, shortcuts }) {
			const panelActive = usePanelInfo((info) => info.activePanelId !== null);
			const statuses = useSessionStatus((s) => s);
			const current = panelActive ? void 0 : Object.values(list.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
			const revealGroup = revealSessionId === void 0 || !workspaceReady ? void 0 : owningGroupKey(workspaces, revealSessionId);
			const [storedWatermarks, setStoredWatermarks] = (0, react.useState)({});
			const [watermarkMotionKey, setWatermarkMotionKey] = (0, react.useState)(0);
			const [drag, setDrag] = (0, react.useState)(null);
			const sessionDropCommitted = (0, react.useRef)(false);
			const [workspaceDrag, setWorkspaceDrag] = (0, react.useState)(null);
			const workspaceDropCommitted = (0, react.useRef)(false);
			const nativeDragActive = drag !== null || workspaceDrag !== null;
			useNativeDragAcceptance(nativeDragActive);
			const currentGroup = current === void 0 || !workspaceReady ? void 0 : owningGroupKey(workspaces, current);
			(0, react.useEffect)(() => {
				if (current === void 0 || currentGroup === void 0 || Object.hasOwn(groupExpansion, currentGroup)) return;
				setGroupExpanded(currentGroup, true);
			}, [
				current,
				currentGroup,
				setGroupExpanded,
				groupExpansion
			]);
			const parents = (0, react.useMemo)(() => {
				if (!nestWorkspaces) return /* @__PURE__ */ new Map();
				const keysByPath = new Map(workspaces.map((workspace) => [workspace.path, workspace.workspaceId]));
				const paths = [...keysByPath.keys()];
				return new Map(workspaces.map((workspace) => {
					const path = owningParentFolder(workspace.path, paths);
					return [workspace.workspaceId, path === void 0 ? void 0 : keysByPath.get(path)];
				}));
			}, [nestWorkspaces, workspaces]);
			const currentAncestors = (0, react.useMemo)(() => {
				const keys = /* @__PURE__ */ new Set();
				for (let key = currentGroup === void 0 ? void 0 : parents.get(currentGroup); key !== void 0; key = parents.get(key)) keys.add(key);
				return keys;
			}, [currentGroup, parents]);
			const expandedGroups = (0, react.useMemo)(() => {
				const ancestorKeys = new Set(parents.values());
				return [...workspaces.map((workspace) => workspace.workspaceId), ""].filter((key) => groupExpansion[key] ?? ancestorKeys.has(key));
			}, [
				groupExpansion,
				parents,
				workspaces
			]);
			const groups = (0, react.useMemo)(() => deriveGroups(list, workspaces, rowState, statuses, {
				expandedGroups,
				ungroupedOrder: ungroupedSessionIds
			}), [
				list,
				workspaces,
				rowState,
				statuses,
				expandedGroups,
				ungroupedSessionIds
			]);
			(0, react.useEffect)(() => {
				for (let key = revealGroup; key !== void 0; key = parents.get(key)) if (groupExpansion[key] === false || key === revealGroup && groupExpansion[key] !== true) setGroupExpanded(key, true);
			}, [
				groupExpansion,
				parents,
				revealGroup,
				setGroupExpanded
			]);
			const baselines = new Map(groups.map((group) => [group.key, Math.max(SESSION_WATERMARK_BASE, requiredWatermark(group.sessions, current, group.key === revealGroup ? revealSessionId : void 0))]));
			const foldedKeys = new Set(groups.filter((group) => !group.expanded).map((group) => group.key));
			const underFoldedAncestor = (key) => {
				for (let owner = parents.get(key); owner !== void 0; owner = parents.get(owner)) if (foldedKeys.has(owner)) return true;
				return false;
			};
			const requiredWatermarks = new Map([...baselines].filter(([key]) => !underFoldedAncestor(key)));
			const sessionWatermarks = raiseWatermarks(storedWatermarks, requiredWatermarks);
			if (sessionWatermarks !== storedWatermarks) setStoredWatermarks((marks) => raiseWatermarks(marks, requiredWatermarks));
			const dropWatermarks = (drop) => {
				if (!Object.keys(storedWatermarks).some(drop)) return;
				setStoredWatermarks((marks) => Object.fromEntries(Object.entries(marks).filter(([key]) => !drop(key))));
				setWatermarkMotionKey((key) => key + 1);
			};
			const withinGroup = (key, root) => {
				for (let owner = key; owner !== void 0; owner = parents.get(owner)) if (owner === root) return true;
				return false;
			};
			const now = Date.now();
			const commitSessionDrag = (activeDrag, over) => {
				if (sessionDropCommitted.current) return;
				sessionDropCommitted.current = true;
				setDrag(null);
				const group = groups.find((candidate) => candidate.key === activeDrag.accountKey);
				if (group === void 0) return;
				if (over.id === activeDrag.sessionId) return;
				const accountSessionIds = activeDrag.accountKey === "" ? ungroupedSessionIds : workspaces.find((workspace) => workspace.workspaceId === activeDrag.accountKey)?.sessionIds;
				if (accountSessionIds === void 0) return;
				const renderedSessions = watermarkRows(group.sessions, sessionWatermarks[group.key] ?? SESSION_WATERMARK_BASE).rows;
				const nextOrder = sessionDragOrder(accountSessionIds, renderedSessions, activeDrag, over);
				if (nextOrder !== void 0) setSessionOrder(activeDrag.accountKey, nextOrder);
			};
			const commitWorkspaceDrag = (activeDrag, over) => {
				if (workspaceDropCommitted.current) return;
				workspaceDropCommitted.current = true;
				setWorkspaceDrag(null);
				const owner = parents.get(activeDrag.workspaceId);
				const siblings = workspaces.filter((workspace) => parents.get(workspace.workspaceId) === owner);
				const rowIndex = siblings.findIndex((workspace) => workspace.workspaceId === over.id);
				if (rowIndex === -1) return;
				const anchor = over.half === "before" ? over.id : siblings[rowIndex + 1]?.workspaceId;
				if (anchor === activeDrag.workspaceId) return;
				const sourceIndex = siblings.findIndex((workspace) => workspace.workspaceId === activeDrag.workspaceId);
				const anchorIndex = anchor === void 0 ? siblings.length : siblings.findIndex((workspace) => workspace.workspaceId === anchor);
				if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return;
				insertWorkspaceBefore(activeDrag.workspaceId, anchor).catch((reason) => {
					console.warn("workspace reorder rejected:", reason);
				});
			};
			const childrenByParent = (0, react.useMemo)(() => {
				const rendered = new Set(groups.map((group) => group.key));
				const children = /* @__PURE__ */ new Map();
				for (const group of groups) {
					let parent = parents.get(group.key);
					while (parent !== void 0 && !rendered.has(parent)) parent = parents.get(parent);
					const siblings = children.get(parent);
					if (siblings === void 0) children.set(parent, [group]);
					else siblings.push(group);
				}
				return children;
			}, [groups, parents]);
			const rootGroups = childrenByParent.get(void 0) ?? [];
			const workspaceDropAtListStart = rootGroups[0]?.workspaceId !== void 0 && workspaceDrag?.over?.id === rootGroups[0].workspaceId && workspaceDrag.over.half === "before";
			const rowKeys = groups.length === 0 ? ["empty"] : [];
			const renderGroup = (group, depth) => {
				const workspaceId = group.workspaceId;
				const children = childrenByParent.get(group.key) ?? [];
				const compatibleDrag = workspaceDrag !== null && parents.get(workspaceDrag.workspaceId) === parents.get(group.key);
				const watermark = sessionWatermarks[group.key] ?? SESSION_WATERMARK_BASE;
				const collapsed = watermarkRows(group.sessions, baselines.get(group.key) ?? SESSION_WATERMARK_BASE);
				const visible = watermarkRows(group.sessions, watermark);
				const sessionsExpanded = visible.hiddenCount === 0;
				rowKeys.push(`workspace:${group.key}`);
				const childRows = group.expanded ? children.map((child) => renderGroup(child, depth + 1)) : [];
				const sessions = visible.rows;
				for (const node of sessions) rowKeys.push(`session:${node.id}`);
				if (collapsed.hiddenCount > 0) rowKeys.push(`overflow:${group.key}`);
				const workspaceMarker = workspaceId !== void 0 && workspaceDrag?.over?.id === workspaceId ? workspaceDrag.over.half : null;
				const workspaceDragProps = workspaceId === void 0 ? void 0 : {
					start: () => {
						workspaceDropCommitted.current = false;
						setWorkspaceDrag({
							workspaceId,
							over: null
						});
					},
					end: () => {
						if (workspaceDrag?.over !== null && workspaceDrag?.over !== void 0) commitWorkspaceDrag(workspaceDrag, workspaceDrag.over);
						else setWorkspaceDrag(null);
						workspaceDropCommitted.current = false;
					}
				};
				const hoverWorkspace = workspaceId === void 0 || !compatibleDrag ? void 0 : (half) => {
					setWorkspaceDrag((active) => active === null ? active : {
						...active,
						over: {
							id: workspaceId,
							half
						}
					});
				};
				const dropWorkspace = workspaceId === void 0 || !compatibleDrag ? void 0 : (half) => {
					commitWorkspaceDrag(workspaceDrag, {
						id: workspaceId,
						half
					});
				};
				return (0, react_jsx_runtime.jsxs)("div", {
					style: { "--dsh-workspace-indent": `${depth * 12}px` },
					className: clsx(WorkspaceBrowser_module_css_default.groupSection, workspaceMarker === "before" && WorkspaceBrowser_module_css_default.workspaceDropBefore, workspaceMarker === "after" && WorkspaceBrowser_module_css_default.workspaceDropAfter),
					onDragOver: workspaceDrag === null ? void 0 : (e) => {
						e.preventDefault();
						if (hoverWorkspace === void 0 && parents.get(group.key) !== void 0) return;
export {};
