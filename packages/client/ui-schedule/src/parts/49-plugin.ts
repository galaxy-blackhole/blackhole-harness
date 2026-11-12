/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/index.js
		/**
		* Browser catalogs for retained Host tasks and the selected Session's active
		* reminders, plus the right-Sidebar page that shows one task's detail.
		*
		* The page type reaches the Sidebar through its public path only: the
		* definition into `ctx.sidebarRightTabs`, the body into the keyed
		* `sidebar.right.pane.tab` seat, and the chip title into
		* `sidebar.right.pane.tab.title`, both under the definition's `id`. Because the
		* Sidebar persists a tab's layout record and not the parameters its opener
		* passed, the page also owns a binding from each tab page to the task it last
		* showed, which its body and chip read back after a reload. The Session
		* header entry and the task tab share one Host catalog source, so opening or
		* deleting from either view reads and refreshes the same records.
		*
		* The created task of a `schedule_create` call renders at Turn level: a Turn
		* Definition publishes the settled result against its Turn, and ui-chat's
		* `conversation.chat.turnTail` list seat renders the card beneath
		* the closing prose, outside the collapsible Tool group, opening the same
		* right-Sidebar detail the header entry opens. The call's Tool-group cell
		* stays with ui-tool's generic keyed tool view, so this package registers no
		* `tool.call.toolview` entry for the wire name.
		*
		* Two ambient surfaces read the ONE Host catalog the page owns: ui-workspace's
		* `sidebar.session.row.leading` seat marks an idle row whose Session has an
		* active task, and its `sidebar.session.row.hover` seat lists those tasks
		* inside the row's hover card. Both project the same source, so N visible rows
		* issue one query rather than one per row. The header entry keeps its own
		* per-Session source.
		*/
		const MANAGER_NS = "schedule.manager";
		const PANEL_ID = "schedules";
		/** Required services for catalogs, ambient Session marks, the right Sidebar, Remote queries, and original-Session navigation. */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.schedule",
			"conversation",
			"uiConversation",
			"uiWorkspace",
			"sessions",
			"workspaces",
			"sidebarRightTabs",
			"sidebarRight"
		];
		/**
		* Register the Host task page, the Session-header reminder catalog, the
		* right-Sidebar page that shows one task's detail, and the transcript card of
		* one created task.
		* @param ctx - browser services used by these contributions.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh: zh$1,
				en: en$1
			}), "ui-schedule: dictionaries");
			ctx.effect(() => ctx.locale.register(MANAGER_NS, {
				zh,
				en
			}), "ui-schedule: manager dictionaries");
			const t = ctx.locale.bind(MANAGER_NS);
			const manager = createCatalogSource({
				list: () => ctx.remote.schedule.catalog(),
				remove: async (id) => {
					const record = manager.hooks.catalog.getSnapshot().records.find((item) => item.id === id);
					if (record === void 0) return {
						ok: true,
						value: {
							id,
							deleted: false,
							code: "schedule_not_found"
						}
					};
					return ctx.remote.schedule.delete({
						sessionId: record.sessionId,
						id
					});
				},
				subscribeChanged: (listener) => ctx.remote.$on("schedule/changed", listener),
				subscribeReset: (listener) => ctx.on("connection/reset", listener)
			});
			const deleteToast = createDeleteToastSource();
			const reportedDelete = (onDelete) => async (id) => {
				const outcome = await onDelete(id);
				deleteToast.report(outcome);
				return outcome;
			};
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "schedule.delete-toast",
				locale: MANAGER_NS,
				inject: () => ({
					hooks: deleteToast.hooks,
					dismiss: deleteToast.dismiss
				})
			}, ScheduleDeleteToast));
			/**
			* Forward one compare-and-update request, which may replace the task name,
			* the instruction, and/or the timing, and refresh the authoritative catalog
			* after an accepted or stale outcome.
			* @param request - complete expected record with the optional content and timing change.
			* @returns the original Remote mutation result.
			*/
			const updateTask = async (request) => {
				const result = await ctx.remote.schedule.update(request);
				if (result.ok && ("record" in result.value || result.value.code === "schedule_conflict" || result.value.code === "schedule_ended" || result.value.code === "schedule_not_found")) await manager.onRetry(manager.hooks.catalog.getSnapshot().readRequest);
				return result;
			};
			const loadHistory = (request) => ctx.remote.schedule.history(request);
			const openSession = (id) => {
				if (sessionLinkState(id, ctx.sessions.list.getSnapshot(), ctx.workspaces.list.getSnapshot()) === "available") ctx.uiWorkspace.openSession(id);
			};
			const detail = {
				hooks: manager.hooks,
				onDelete: reportedDelete(manager.onDelete),
				onRetry: manager.onRetry,
				onUpdateTiming: updateTask,
				loadHistory,
				onOpenSession: openSession
			};
			const taskBindings = new TaskTabBindings((sessionId) => ctx.sidebarRight.tabsIn(sessionId).map((tab) => tab.id));
			ctx.effect(() => ctx.sidebarRightTabs.register(scheduleTaskDefinition(t)), "ui-schedule: task tab type");
			ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: SCHEDULE_TASK_ID,
				locale: MANAGER_NS,
				inject: () => ({
					...detail,
					taskBindings
				})
			}, ScheduleTaskTab));
			ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
				name: "sidebar.right.pane.tab.title",
				key: SCHEDULE_TASK_ID,
				locale: MANAGER_NS,
				inject: () => ({
					hooks: detail.hooks,
					taskBindings
				})
			}, ScheduleTaskTabTitle));
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: PANEL_ID,
				locale: MANAGER_NS,
				inject: () => ({
					...detail,
					onNewTask: () => {
						ctx.uiWorkspace.startSession();
					}
				})
			}, TaskManagerPage));
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: PANEL_ID,
				order: 10,
				locale: MANAGER_NS,
				label: () => t("panel")
			}, TaskManagerIcon));
			ctx.uiConversation.events.register(scheduleTurnDefinition);
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
				name: "conversation.chat.turnTail",
				id: "schedule-created",
				order: 20,
				locale: MANAGER_NS,
				inject: (sessionId) => ({
					hooks: { catalog: manager.hooks.catalog },
					onRetry: manager.onRetry,
					openTaskDetail: (id) => {
						ctx.sidebarRight.openTab(SCHEDULE_TASK_KIND, { params: {
							sessionId,
							id
						} });
					}
				})
			}, ScheduleTurnCard));
			const createSource = (sessionId) => createSessionScheduleSource(ctx, sessionId);
			ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
				name: "conversation.session.header.utilities",
				id: "schedule-catalog",
				order: -5,
				locale: NS,
				inject: (sessionId) => {
					const source = createSource(sessionId);
					return {
						...source,
						onDelete: reportedDelete(source.onDelete),
						openTaskDetail: (id) => {
							ctx.sidebarRight.openTab(SCHEDULE_TASK_KIND, { params: {
								sessionId,
								id
							} });
						}
					};
				}
			}, ScheduleCatalogAction));
			ctx.slots.inject("sidebar.session.row.leading", () => ctx.slots.register({
				name: "sidebar.session.row.leading",
				id: "schedule-mark",
				order: 10,
				locale: NS,
				inject: () => ({ hooks: { catalog: manager.hooks.catalog } })
			}, SessionScheduleMark));
			ctx.slots.inject("sidebar.session.row.hover", () => ctx.slots.register({
				name: "sidebar.session.row.hover",
				id: "schedule-tasks",
				order: 10,
				locale: NS,
				inject: () => ({ hooks: { catalog: manager.hooks.catalog } })
			}, SessionScheduleHover));
		}
		//#endregion