/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					const item = scheduleItem(value, t, locale);
					return item === null ? null : { items: [item] };
				}
				case "schedule_list": {
					if (!Array.isArray(value)) return null;
					const items = [];
					for (const entry of value) {
						const item = scheduleItem(entry, t, locale);
						if (item === null) return null;
						items.push(item);
					}
					return {
						items,
						summary: t("detail.schedule.count", { count: items.length }),
						empty: t("detail.schedule.empty")
					};
				}
				case "schedule_delete":
					if (!detailRecord(value) || !nonempty(value.id) || value.deleted !== true) return null;
					return { items: [{
						title: value.id,
						fields: [{
							label: t("detail.state"),
							value: t("detail.schedule.deleted")
						}]
					}] };
				default: return null;
			}
		}
		//#endregion
		//#region lib/types/client/tool/toolviews/details-row.js
		/** Keyed recorded-result rows sharing the compact detail body. */
		const LSP_TITLE_KEYS = {
			goToDefinition: "tool.title.findDefinition",
			findReferences: "tool.title.findReferences",
			goToImplementation: "tool.title.findImplementation",
			hover: "tool.title.hoverSymbol"
		};
		/** Teammate-coordination tools presented with the two-person team icon. */
		const TEAMMATE_TOOLS = new Set([
			"spawn_teammate",
			"list_agents",
			"send_message",
			"interrupt_agent",
			"wait_agent"
		]);
		function detailIcon(toolName) {
			if (TEAMMATE_TOOLS.has(toolName)) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUsersOutlineRegular, { size: 14 });
			if (toolName.startsWith("schedule_")) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular, { size: 14 });
			if (toolName.endsWith("_goal")) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGoalOutlineRegular, { size: 14 });
			if (toolName.startsWith("cordis_")) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCordisPluginOutlineRegular, {});
			if (toolName.startsWith("terminal_")) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size: 14 });
			if (toolName.startsWith("session_") || toolName === "lsp") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: 14 });
			if (toolName.startsWith("job_") || toolName.startsWith("team_task_")) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutlineRegular, {});
			if (toolName === "workflow" || toolName === "ralph") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 14 });
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutlineRegular, { size: 14 });
		}
		/**
		* Present recorded entities, receipts, and report fields in the existing expandable row.
		* @param props - Tool call, row actions, and locale supplied by the keyed slot.
		* @returns A Tool row with structured details or generic input/output.
		*/
		function DetailsRow({ toolName, block, cwd, home, openFile, inspect, useDisclosure, t }) {
			const model = toolRowModel(toolName, block, cwd, home);
			const locale = document.documentElement.lang;
			const details = (0, react.useMemo)(() => detailsCardModel(block, t, locale), [
				block,
				t,
				locale
			]);
			const operation = toolName === "lsp" ? parsedToolCall(block)?.args.operation : void 0;
			const titleKey = typeof operation === "string" && Object.hasOwn(LSP_TITLE_KEYS, operation) ? LSP_TITLE_KEYS[operation] : model.titleKey;
			return (0, react_jsx_runtime.jsx)(ToolRow, {
				useDisclosure,
				t,
				variant: model.variant,
				toolName,
				icon: detailIcon(toolName),
				title: t(titleKey),
				summary: details?.summary ?? details?.items[0]?.title ?? details?.empty ?? model.summary,
				details,
				bodyRaw: model.bodyRaw,
				output: model.output,
				errorSummary: model.errorSummary,
				state: model.state,
				inspect,
				onOpenFile: openFile
			});
		}
		/** Register recorded-result details through the standard atomic Tool slot. */
		const detailsToolview = {
			name: "details-toolview",
			inject: ["slots"],
			apply(ctx) {
				ctx.slots.inject("tool.call.toolview", function* () {
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "create_goal",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "get_goal",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "update_goal",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "schedule_create",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "schedule_list",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "schedule_delete",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "schedule_update",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "cordis_inspect_list",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "cordis_inspect_query",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "cordis_inspect_self",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "workflow",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "ralph",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "session_event_read",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "session_event_search",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "session_event_trace",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "session_search",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "session_trace",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "list_subagent_models",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "subagent",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "list_agents",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "send_message",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "interrupt_agent",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "job_list",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "job_output",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "job_kill",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "terminal_open",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "terminal_read",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "terminal_list",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "terminal_signal",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "terminal_close",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "lsp",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "spawn_teammate",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "team_task_create",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "team_task_get",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "team_task_update",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "team_task_list",
						locale: CONVERSATION_NS
					}, DetailsRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "wait_agent",
						locale: CONVERSATION_NS
					}, DetailsRow);
				});
			}
		};
		//#endregion
		//#region lib/types/client/tool/models/todo-history.js
		/** Durable writes are indexed independently of Tool success receipts. */
		const todoWriteDefinition = {
			kind: "tool-todo-write",
			match: (event) => event.type === "todo/write" ? {
				id: String(event.seq),
				role: "start"
			} : null,
			start: (_context, match) => {
				if (match.event.type !== "todo/write") throw new Error("tool-todo-write requires todo/write");
				return match.event.data.todos;
			},
			update: (context) => context.state,
			publication: () => "none"
		};
		/** Invocation predecessors are repaired by the assembler when older history arrives. */
		const todoCallDefinition = {
			kind: "tool-todo-call",
			target: "tool-todo-history",
			match: (event) => {
				if (event.type === "tool/call" && event.data.name === "todo_write") return {
					id: String(event.data.callId),
					role: "start"
				};
				if (event.type === "tool/ptc-dispatch-start" && event.data.name === "todo_write") return {
					id: String(event.data.subCallId),
					role: "start"
				};
				return null;
			},
			start: (_context, _match, reader) => ({ todos: reader.previous("tool-todo-write")?.state }),
			update: (context) => context.state,
			buildViewNode: (context) => context.state === void 0 ? null : {
				key: context.key,
				kind: context.kind,
				id: context.id,
				target: "tool-todo-history",
				data: context.state
			}
		};
		/** Incremental lookup snapshots preserve earlier call baselines across later writes. */
		const todoHistoryView = {
			target: "tool-todo-history",
			create: () => {
				let calls = /* @__PURE__ */ new Map();
				return {
					empty: calls,
					replace: ({ nodes }) => calls = new Map(nodes.map((node) => [node.id, node.data])),
					apply: ({ upserts }) => {
						if (upserts.length > 0) {
							calls = new Map(calls);
							for (const node of upserts) calls.set(node.id, node.data);
						}
						return calls;
					}
				};
			}
		};
		/**
		* Install the recorded-write index and call predecessor target.
		* @param ctx - Tool presentation plugin context.
		*/
		function registerTodoHistory(ctx) {
			ctx.uiConversation.events.register(todoWriteDefinition);
			ctx.uiConversation.events.register(todoCallDefinition);
			ctx.uiConversation.views.register(todoHistoryView);
		}
		//#endregion
		//#region lib/types/client/tool/models/todo-diff-model.js
		/**
		* Compare this write with its predecessor in the loaded call history.
		* @param block - The write being displayed.
		* @param baseline - List recorded before this call, or undefined when its start is unavailable.
		* @param hasMore - Whether older unloaded history may contain a preceding list.
		* @param t - Conversation dictionary translator.
		* @returns Details and a change summary, or null for generic Tool output.
		*/
		function todoDiffModel(block, baseline, hasMore, t) {
			if (!("kind" in block) || block.isError) return null;
			const call = parsedToolCall(block);
			const current = call?.name === "todo_write" ? todosDetail(call.args, t) : null;
			if (current === null) return null;
			const previous = baseline?.todos === void 0 ? null : { items: baseline.todos.map((todo) => ({
				title: todo.content,
				status: {
					value: todo.status,
					label: t(`detail.todo.${todo.status}`)
				},
				fields: []
			})) };
			if (baseline === void 0 || previous === null && hasMore) return {
				details: {
					...current,
					caption: t("todo.diff.unavailable")
				},
				summary: null
			};
			const previousByTitle = new Map(previous?.items.map((item) => [item.title, item]));
			const currentTitles = new Set(current.items.map((item) => item.title));
			const retainedPositions = new Map(previous?.items.filter((item) => currentTitles.has(item.title)).map((item, index) => [item.title, index]));
			let retainedIndex = 0;
			const items = [];
			const unchanged = [];
			let added = 0;
			let updated = 0;
			for (const item of current.items) {
				const before = previousByTitle.get(item.title);
				previousByTitle.delete(item.title);
				if (before === void 0) {
					added++;
					items.push({
						...item,
						change: {
							value: "added",
							label: t("todo.diff.addedItem")
						}
export {};
