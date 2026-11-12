/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			"delete.pending": "正在删除工作区…",
			"menu.fork": "分叉会话",
			"menu.archiveSession": "归档会话",
			"menu.unarchiveSession": "取消归档",
			"menu.pinSession": "置顶会话",
			"menu.unpinSession": "取消置顶",
			"menu.sessionId": "复制 Session ID",
			"toast.sessionIdCopied": "Session ID 已复制",
			"toast.sessionIdCopyFailed": "复制失败，请重试",
			"row.archived": "已归档",
			"row.pinned": "已置顶",
			"toast.archivedNotOpenable": "已归档对话暂时无法查看，请取消归档后查看",
			"toast.archived": "会话已归档，可",
			"toast.stoppedAndArchived": "已停止并归档，可",
			"archive.confirm.title": "停止并归档此会话？",
			"archive.confirm.desc": "“{title}”仍有正在进行的工作。归档会先停止这些工作；之后可在侧栏筛选“全部对话（显示已归档）”中恢复会话，被停止的工作不会自动继续。",
			"archive.confirm.activity": "将被停止的工作",
			"archive.confirm.turn": "进行中的回合",
			"archive.confirm.subagents.one": "{n} 个运行中的子智能体：{names}",
			"archive.confirm.subagents.other": "{n} 个运行中的子智能体：{names}",
			"archive.confirm.jobs.one": "{n} 个后台任务：{names}",
			"archive.confirm.jobs.other": "{n} 个后台任务：{names}",
			"archive.confirm.schedules.one": "{n} 条定时提醒：{names}",
			"archive.confirm.schedules.other": "{n} 条定时提醒：{names}",
			"archive.confirm.other.one": "{n} 项其他工作（{kind}）",
			"archive.confirm.other.other": "{n} 项其他工作（{kind}）",
			"archive.confirm.listSeparator": "、",
			"archive.confirm.action": "停止并归档",
			"archive.confirm.pending": "正在停止并归档…",
			"toast.archivedUndo": "撤销",
			"toast.archivedOr": "或",
			"toast.archivedFilter": "筛选已归档会话",
			"toast.pinFailed": "置顶失败，请稍后重试",
			"toast.unpinFailed": "取消置顶失败，请稍后重试",
			"toast.createFailed": "新建会话失败：{message}",
			"toast.forkRequiresOpen": "请先打开原会话完成迁移，再创建分支",
			"toast.openForkSource": "打开原会话",
			"sessions.count.one": "{n} 个会话",
			"sessions.count.other": "{n} 个会话",
			"actions.workspace.aria": "工作区“{name}”的操作",
			"actions.session.aria": "会话“{name}”的操作",
			"actions.archive": "归档会话",
			"actions.unarchive": "取消归档",
			"actions.pin": "置顶会话",
			"actions.unpin": "取消置顶",
			"actions.newSession": "新会话",
			"actions.newSession.aria": "在“{name}”中新建会话",
			"status.running": "进行中",
			"status.subagentsRunning.one": "{n} 个子智能体运行中",
			"status.subagentsRunning.other": "{n} 个子智能体运行中",
			"status.idle": "空闲",
			"status.waitingApproval": "等待审批",
			"status.planReview": "计划待审",
			"status.waitingAnswer": "等待回答",
			"status.compact.approval": "待审批",
			"status.compact.planReview": "计划待审",
			"status.compact.answer": "待回答",
			"status.completed": "已完成",
			"hover.created": "创建于 {time}",
			"hover.copied": "已复制",
			"date.ymd": "{y}年{m}月{d}日",
			"time.now": "刚刚",
			"time.minutes": "{n}分钟",
			"time.hours": "{n}小时",
			"time.days": "{n}天",
			"time.months": "{n}个月",
			"time.years": "{n}年",
			"time.ago": "{t}前"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"defaultWorkspace.failed": "Unable to create default workspace. Use Choose workspace to select a folder.",
			"draft.workspaceRequired": "Choose a workspace first.",
			"draft.initializationFailed": "Could not fill the draft. Please try again shortly.",
			"group.ungrouped": "Ungrouped",
			"session.new": "New Session",
			"session.untitled": "Untitled",
			"shortcut.noSession": "Select a session first",
			"shortcut.noPicker": "Directory picker unavailable",
			"shortcut.directoryBusy": "Selecting or adding a workspace",
			"shortcut.noCompletedTurn": "This session has no completed turn",
			"shortcut.forkFailed": "Could not fork the session. Try again.",
			"section.workspaces": "Workspaces",
			"section.sessions": "Sessions",
			"viewOptions.label": "View options",
			"groupBy.label": "Group by",
			"groupBy.workspace": "WorkSpace",
			"groupBy.workspaceTree": "Workspace Tree",
			"groupBy.flat": "In one list",
			"orderBy.label": "Order by",
			"orderBy.manual": "Manual",
			"orderBy.updated": "Last updated",
			"filterBy.label": "Filter sessions",
			"viewOptions.hideArchived": "Hide archived",
			"viewOptions.showArchived": "All conversations (show archived)",
			"viewOptions.onlyArchived": "Archived only",
			"sessions.expand": "Show {n} more sessions",
			"sessions.collapse": "Show less",
			"empty.none": "No sessions yet",
			"empty.noneArchived": "No archived sessions yet",
			"empty.viewOthers": "View other sessions",
			"empty.noMatches": "No matches",
			"workspace.add": "Add workspace",
			"search.sessions.aria": "Search sessions",
			"search.placeholder": "Search session names",
			"search.clear": "Clear search",
			"search.results.aria": "Search results",
			"search.pending": "Searching session history…",
			"search.noMatches": "No matching sessions",
			"search.hasMore": "Showing the first {n} results. Narrow your search.",
			"menu.addWorkspace": "Add workspace…",
			"picker.loading": "Loading workspaces…",
			"conflict.named": "A workspace named “{name}” already exists.",
			"folderError.title": "Couldn’t open folder",
			"folderError.retry": "Choose again",
			"rename": "Rename",
			"rename.workspace.title": "Rename workspace",
			"rename.session.title": "Rename session",
			"field.workspaceName": "Workspace name",
			"field.sessionName": "Session name",
			"delete.workspace": "Delete workspace",
			"delete.desc": "This removes “{name}” from the workspace list. The folder and session logs will be kept. Its sessions will appear under Ungrouped.",
			"delete.pending": "Deleting workspace…",
			"menu.fork": "Fork session",
			"menu.archiveSession": "Archive session",
			"menu.unarchiveSession": "Unarchive session",
			"menu.pinSession": "Pin session",
			"menu.unpinSession": "Unpin session",
			"menu.sessionId": "Copy Session ID",
			"toast.sessionIdCopied": "Session ID copied",
			"toast.sessionIdCopyFailed": "Copy failed. Try again.",
			"row.archived": "Archived",
			"row.pinned": "Pinned",
			"toast.archivedNotOpenable": "Archived sessions cannot be opened. Unarchive it to view.",
			"toast.archived": "Session archived. You can ",
			"toast.stoppedAndArchived": "Session stopped and archived. You can ",
			"archive.confirm.title": "Stop and archive this session?",
			"archive.confirm.desc": "“{title}” still has work in progress. Archiving stops it first; you can restore the session later from the “All conversations (show archived)” filter in the sidebar, and the stopped work will not resume on its own.",
			"archive.confirm.activity": "Work that will be stopped",
			"archive.confirm.turn": "The turn in progress",
			"archive.confirm.subagents.one": "{n} running subagent: {names}",
			"archive.confirm.subagents.other": "{n} running subagents: {names}",
			"archive.confirm.jobs.one": "{n} background job: {names}",
			"archive.confirm.jobs.other": "{n} background jobs: {names}",
			"archive.confirm.schedules.one": "{n} scheduled reminder: {names}",
			"archive.confirm.schedules.other": "{n} scheduled reminders: {names}",
			"archive.confirm.other.one": "{n} other item of work ({kind})",
			"archive.confirm.other.other": "{n} other items of work ({kind})",
			"archive.confirm.listSeparator": ", ",
			"archive.confirm.action": "Stop and archive",
			"archive.confirm.pending": "Stopping and archiving…",
			"toast.archivedUndo": "undo",
			"toast.archivedOr": " or ",
			"toast.archivedFilter": "filter archived sessions",
			"toast.pinFailed": "Pin failed. Try again later.",
			"toast.unpinFailed": "Unpin failed. Try again later.",
			"toast.createFailed": "New session failed: {message}",
			"toast.forkRequiresOpen": "Open the original session to complete migration before creating a branch.",
			"toast.openForkSource": "Open original session",
			"sessions.count.one": "{n} session",
			"sessions.count.other": "{n} sessions",
			"actions.workspace.aria": "Workspace actions for {name}",
			"actions.session.aria": "Session actions for {name}",
			"actions.archive": "Archive",
			"actions.unarchive": "Unarchive",
			"actions.pin": "Pin",
			"actions.unpin": "Unpin",
			"actions.newSession": "New session",
			"actions.newSession.aria": "New session in {name}",
			"status.running": "Running",
			"status.subagentsRunning.one": "{n} subagent running",
			"status.subagentsRunning.other": "{n} subagents running",
			"status.idle": "Idle",
			"status.waitingApproval": "Waiting for approval",
			"status.planReview": "Plan awaiting review",
			"status.waitingAnswer": "Waiting for answer",
			"status.compact.approval": "Approval",
			"status.compact.planReview": "Plan review",
			"status.compact.answer": "Answer",
			"status.completed": "Completed",
			"hover.created": "Created {time}",
			"hover.copied": "Copied",
			"date.ymd": "{y}-{m}-{d}",
			"time.now": "now",
			"time.minutes": "{n}min",
			"time.hours": "{n}h",
			"time.days": "{n}d",
			"time.months": "{n}mo",
			"time.years": "{n}y",
			"time.ago": "{t} ago"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "workspace";
		/**
		* Required services (cordis fiber inject). The target slots are declared by
		* the ui-sidebar / ui-conversation applies, whose activation order relative
		* to this one is NOT constrained: dsh.client.inject edges are informational
		* (loading/prefetch metadata, never apply sequencing) and neither owner
		* provides a waitable service. apply therefore depends on each slot
		* declaration through `slots.inject()` instead of assuming order.
		*/
		const inject = [
			"slots",
			"sessions",
			"workspaces",
			"locale",
			"remote",
			"remote.directoryPicker",
			"layout",
			"shortcuts",
			"remoteAccess"
		];
		/**
		* Register the browser and picker once their slot declarations are on the
		* ledger. Inject factories return plain callbacks; data reads use the
		* framework's global hooks.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const sessions = ctx.get("sessions");
			const workspaces = ctx.get("workspaces");
			const viewHandle = createWorkspaceViewStore();
			const viewInstance = viewHandle.create();
			const viewStore = {
				...viewHandle,
				create: () => viewInstance
			};
			const rowToast = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			let toastSeq = 0;
			const notify = (toast) => {
				rowToast.set({
					...toast,
					seq: ++toastSeq
				});
			};
			const uiWorkspace = new UiWorkspaceService(ctx, ctx.remote.directoryPicker, workspaces, sessions, viewInstance.actions, notify);
			ctx.slots.provideRoot({
				hooks: { workspaces: workspaces.list },
				keyedHooks: { workspaceAccess: (workspaceId, action) => action === void 0 ? void 0 : ctx.remoteAccess.source("workspace", workspaceId, action) }
			});
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-workspace: dictionaries");
			const shortcutControls = createWorkspaceShortcutControls();
			const searchSessions = async (query, signal) => {
				const result = await sessions.search(query, signal);
				if (!result.ok) throw new Error(result.error.message);
				return result.value;
			};
			const flowSource = (hole) => ({
				getSnapshot: () => ctx.slots.entries(hole).length > 0,
				subscribe: (listener) => ctx.slots.subscribe(hole, listener)
			});
			const browserFlowSource = flowSource("sidebar.workspaces.directoryFlow");
			const hostInfo = {
				getSnapshot: () => ctx.remote.$host,
				subscribe: (listener) => ctx.on("connection/reset", listener)
			};
			const pickerFlowSource = flowSource("conversation.hero.workspace.directoryFlow");
			const openSession = (sessionId) => {
				uiWorkspace.openSession(sessionId);
			};
			const pinnedSet = derive(workspaces.list, (snapshot) => new Set(snapshot.pinnedSessionIds));
			const archivedSet = derive(workspaces.list, (snapshot) => new Set(snapshot.archivedSessionIds));
			const renameRequest = derive(shortcutControls.state, (state) => state.renameTarget);
			const archiveRequest = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			const requestSessionRename = shortcutControls.rename;
			const unarchiveSession = (sessionId) => {
				uiWorkspace.unarchiveSession(sessionId).catch((reason) => {
					console.warn("session unarchive rejected:", reason);
				});
			};
			const renameSession = async (sessionId, title) => {
				const result = await sessions.using(sessionId, { source: "workspaceOperation" }, (reference) => reference.binding.session.rename(title));
				if (!result.ok) throw new Error(result.error.message);
			};
			const pinInjected = () => ({
				hooks: {
					pinned: pinnedSet,
					archived: archivedSet
				},
				pinSession: (sessionId) => {
					uiWorkspace.pinSession(sessionId).catch(() => {
						notify({ kind: "pinFailed" });
					});
				},
				unpinSession: (sessionId) => {
					uiWorkspace.unpinSession(sessionId).catch(() => {
						notify({ kind: "unpinFailed" });
					});
				}
			});
			const archiveInjected = () => ({
				hooks: { archived: archivedSet },
				archiveSession: (sessionId) => {
					uiWorkspace.archiveSession(sessionId).then(() => {
						notify({
							kind: "archived",
							sessionId
						});
					}).catch((reason) => {
						const activity = activeSessionRefusal(reason);
						if (activity === void 0) {
							console.warn("session archive rejected:", reason);
							return;
						}
						const displayTitle = sessions.list.getSnapshot().byId[sessionId]?.displayTitle ?? sessionId;
						archiveRequest.set({
							sessionId,
							displayTitle,
							activity
						});
					});
				},
				unarchiveSession
			});
			installWorkspaceShortcuts(ctx, uiWorkspace, shortcutControls, archiveInjected().archiveSession, (reason) => {
				notify({
					kind: "shortcutForkFailed",
					reason
				});
			});
			const archiveConfirmInjected = () => ({
				hooks: { archiveRequest },
				settleSessionArchive: () => {
					archiveRequest.set(null);
				},
				stopAndArchiveSession: async (sessionId) => {
					await uiWorkspace.archiveSession(sessionId, { stopActivity: true });
					notify({
						kind: "stoppedAndArchived",
						sessionId
					});
				}
			});
			const forkInjected = () => ({ forkSession: (sessionId) => {
				uiWorkspace.forkSession(sessionId, (childId) => {
					ctx.get("productAnalytics")?.track("branch_session_click", {
						session_id: childId,
						parent_session_id: sessionId,
						click_position: "sidebar"
					});
				}, { allowMigration: false }).catch((error) => {
					if (error instanceof Error && error.name === "SessionForkError" && error.rpcError.code === "session/migration-required") notify({
						kind: "forkRequiresOpen",
						sessionId
					});
				});
			} });
			const sessionIdInjected = () => ({ copySessionId: async (sessionId) => {
				notify({ kind: await (0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(sessionId) ? "sessionIdCopied" : "sessionIdCopyFailed" });
			} });
			const renameInjected = () => ({ requestSessionRename });
			const renameDialogInjected = () => ({
				hooks: { renameRequest },
				settleSessionRename: shortcutControls.closeRename,
				renameSession
			});
			registerToasts(ctx, viewStore, {
				undoArchive: unarchiveSession,
				showArchived: () => {
					viewInstance.actions.setArchivedFilter("show");
				},
				openForkSource: (sessionId) => {
					if (workspaces.list.getSnapshot().archivedSessionIds.includes(sessionId)) {
						notify({ kind: "archivedNotOpenable" });
						return;
					}
					openSession(sessionId);
				}
			});
			const rowToastInjected = () => ({
				hooks: { toast: rowToast },
				dismissToast: () => {
					rowToast.set(null);
				}
			});
			const browserInjected = () => ({
				startSession: (workspaceId, options) => {
					uiWorkspace.startSession(workspaceId, options);
				},
				open: openSession,
				searchSessions,
				searchResultLimit: sessions.searchResultLimit,
				requestSessionRename,
				notifyArchivedNotOpenable: () => {
					notify({ kind: "archivedNotOpenable" });
				},
				renameWorkspace: async (workspaceId, title) => {
					await workspaces.rename(workspaceId, title);
				},
				deleteWorkspace: async (workspaceId) => {
					await workspaces.delete(workspaceId);
				},
				insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
					await workspaces.insertBefore(workspaceId, beforeWorkspaceId);
				},
export {};
