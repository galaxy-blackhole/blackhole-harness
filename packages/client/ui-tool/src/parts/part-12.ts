/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					});
				} else {
					const moved = retainedPositions.get(item.title) !== retainedIndex++;
					const statusChanged = before.status?.value !== item.status?.value;
					if (statusChanged || moved) {
						updated++;
						items.push({
							...item,
							...statusChanged && before.status !== void 0 ? { previousStatus: before.status.label } : {},
							change: {
								value: "updated",
								label: t(statusChanged ? "todo.diff.updatedItem" : "todo.diff.movedItem")
							}
						});
					} else unchanged.push(item);
				}
			}
			for (const item of previousByTitle.values()) items.push({
				...item,
				change: {
					value: "removed",
					label: t("todo.diff.removedItem")
				}
			});
			return {
				summary: [
					added > 0 ? t("todo.diff.added", { count: added }) : null,
					updated > 0 ? t("todo.diff.updated", { count: updated }) : null,
					previousByTitle.size > 0 ? t("todo.diff.removed", { count: previousByTitle.size }) : null
				].filter((part) => part !== null).join(" · ") || t("todo.diff.noChanges"),
				details: {
					items,
					caption: t(previous === null ? "todo.diff.initial" : "todo.diff.compare"),
					empty: current.items.length === 0 && previous === null ? t("detail.todo.empty") : t("todo.diff.noChanges"),
					...unchanged.length === 0 ? {} : { unchanged: {
						label: t("todo.diff.unchanged", { count: unchanged.length }),
						items: unchanged
					} }
				}
			};
		}
		//#endregion
		//#region lib/types/client/tool/toolviews/plan-summary.js
		/**
		* Pure plan derivation for the todo_write row's one-line summary. Several items
		* may be `in_progress` at once — parallel work runs concurrent tasks, so a
		* summary built from one active item would silently drop the rest. The plan
		* strip header derives its own counts inline and shares nothing with this, so
		* this stays inside the toolviews domain rather than in `contract/` (the
		* inter-domain face).
		* @module
		*/
		/**
		* Derive the counts and the active summary from a whole-list snapshot. It names
		* the first `in_progress` item and counts the remaining active ones, so a
		* parallel plan reports how many tasks are running rather than naming one and
		* hiding the others. `activeContent` is null when nothing is in progress, or
		* when the first active item's content is missing, mistyped, or blank once
		* trimmed — the tool's own rule for usable content, applied here because a
		* rejected call keeps its args verbatim. The row then renders the counts alone
		* rather than falling back to the generic tool summary: the counts are already
		* known to be good, and the active-item clause is the only part an unusable
		* name costs.
		* @param todos - the whole list, in model order.
		* @returns the done/total counts and the two summary halves.
		*/
		function planSummary(todos) {
			const active = todos.filter((t) => t.status === "in_progress");
			const first = active[0]?.content;
			const named = typeof first === "string" && first.trim() !== "";
			return {
				done: todos.filter((t) => t.status === "completed").length,
				total: todos.length,
				activeContent: named ? first : null,
				activeExtra: named ? active.length - 1 : 0
			};
		}
		//#endregion
		//#region lib/types/client/tool/toolviews/todo-row.js
		function isItem(value) {
			return typeof value === "object" && value !== null;
		}
		function summarize(argsRaw, t) {
			if (argsRaw === null) return null;
			let parsed;
			try {
				parsed = JSON.parse(argsRaw);
			} catch {
				return null;
			}
			if (typeof parsed !== "object" || parsed === null) return null;
			const todos = parsed.todos;
			if (!Array.isArray(todos) || !todos.every(isItem)) return null;
			const { done, total, activeContent, activeExtra } = planSummary(todos);
			const head = t("todo.completed", {
				done,
				total
			});
			return {
				text: activeContent === null ? head : `${head} · ${activeContent}`,
				extra: activeExtra
			};
		}
		/** Summarizes a plan update without presenting a cancelled call as completed. */
		function TodoRow({ toolName, block, inspect, useDisclosure, useTodoHistory, useSession, t }) {
			const baseline = useTodoHistory((snapshot) => snapshot?.get(block.callId));
			const hasMore = useSession((snapshot) => snapshot.hasMore);
			const diff = (0, react.useMemo)(() => todoDiffModel(block, baseline, hasMore, t), [
				block,
				baseline,
				hasMore,
				t
			]);
			const model = toolRowModel(toolName, block);
			const summary = summarize(model.bodyRaw, t) ?? {
				text: model.summary,
				extra: 0
			};
			return (0, react_jsx_runtime.jsx)(ToolRow, {
				useDisclosure,
				t,
				variant: model.variant,
				toolName,
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutlineRegular, {}),
				title: t(model.titleKey),
				summary: summary.text,
				summarySuffix: [diff?.summary, summary.extra > 0 ? `+${summary.extra}` : null].filter((part) => part !== null && part !== void 0).join(" · ") || null,
				bodyRaw: model.bodyRaw,
				output: model.output,
				details: diff?.details,
				errorSummary: model.errorSummary,
				state: model.state,
				inspect
			});
		}
		/** Registers the todo conversation row. */
		const todoToolview = {
			name: "todo-toolview",
			inject: ["slots", "uiConversation"],
			apply(ctx) {
				registerTodoHistory(ctx);
				ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
					name: "tool.call.toolview",
					key: "todo_write",
					locale: CONVERSATION_NS,
					inject: (sessionId) => ({ hooks: { todoHistory: ctx.uiConversation.binding(sessionId).target("tool-todo-history") } })
				}, TodoRow));
			}
		};
		//#endregion
		//#region lib/types/client/tool/toolviews/web-row.js
		const WEB_TITLE_KEYS = {
			web_search: "tool.title.webSearch",
			web_fetch: "tool.title.webFetch"
		};
		/** Lets users expand a completed web search or fetch result. */
		function WebRow({ toolName, block, inspect, useDisclosure, t }) {
			const model = toolRowModel(toolName, block);
			const web = webCardModel(block);
			const icon = toolName === "web_fetch" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutlineRegular, { size: 14 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGlobeOutlineRegular, { size: 14 });
			return (0, react_jsx_runtime.jsx)(ToolRow, {
				useDisclosure,
				t,
				variant: model.variant,
				toolName,
				icon,
				title: t(toolName === "web_search" ? WEB_TITLE_KEYS.web_search : toolName === "web_fetch" ? WEB_TITLE_KEYS.web_fetch : model.titleKey),
				summary: model.summary,
				output: model.output,
				errorSummary: model.errorSummary,
				web,
				href: webFetchHref(block),
				state: model.state,
				inspect
			});
		}
		/** Registers the web search and fetch conversation rows. */
		const webToolview = {
			name: "web-toolview",
			inject: ["slots"],
			apply(ctx) {
				ctx.slots.inject("tool.call.toolview", function* () {
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "web_search",
						locale: CONVERSATION_NS
					}, WebRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "web_fetch",
						locale: CONVERSATION_NS
					}, WebRow);
				});
			}
		};
		//#endregion
		//#region lib/types/client/apply.js
		/** Required services: the slot registry and the Remote face carrying the Host home used for POSIX `~`. */
		const inject = ["slots", "remote"];
		/**
		* Mount the whole-Tool renderers and built-in atomic Tool registrations.
		* @param ctx - Client root context.
		*/
		function apply(ctx) {
			const hostInfo = {
				getSnapshot: () => ctx.remote.$host,
				subscribe: (listener) => ctx.on("connection/reset", listener)
			};
			const toolInject = () => ({ hooks: { hostInfo } });
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "tool-call",
				locale: CONVERSATION_NS,
				children: { "tool.call.toolview": {
					kind: "keyed",
					scope: "session"
				} },
				inject: toolInject
			}, ToolCallTree));
			ctx.plugin(bashToolviewSample);
			ctx.plugin(readToolview);
			ctx.plugin(readImageToolview);
			ctx.plugin(fileMutationToolview);
			ctx.plugin(searchToolview);
			ctx.plugin(webToolview);
			ctx.plugin(todoToolview);
			ctx.plugin(detailsToolview);
			ctx.plugin(askQuestionToolview);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
