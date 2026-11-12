/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			unavailable: "Team 暂不可用",
			failure: "团队持久记录无效：{message}",
			empty: "暂无共享任务，可以通过对话创建",
			roster: "成员",
			tasks: "共享任务",
			model: "模型",
			open: "打开成员会话",
			current: "当前会话",
			owner: "Owner",
			unowned: "未分配",
			blockedBy: "依赖",
			writeScopes: "写入范围",
			ready: "可开始",
			blocked: "被依赖阻塞",
			"task.expand": "展开",
			"task.collapse": "收起",
			"memberStatus.running": "运行中",
			"memberStatus.inactive": "未运行",
			"memberStatus.provisioning": "准备中",
			"memberStatus.failed": "失败",
			"status.pending": "待处理",
			"status.in_progress": "进行中",
			"status.completed": "已完成"
		};
		/** English dictionary checked against the Chinese key set. */
		const en = {
			trigger: "Agent Team",
			loading: "Loading Team…",
			unavailable: "Team is unavailable",
			failure: "Invalid persisted Team record: {message}",
			empty: "No shared tasks yet. Create them through the conversation.",
			roster: "Members",
			tasks: "Shared tasks",
			model: "Model",
			open: "Open member conversation",
			current: "Current chat",
			owner: "Owner",
			unowned: "Unowned",
			blockedBy: "Blocked by",
			writeScopes: "Write scopes",
			ready: "Ready",
			blocked: "Blocked by dependencies",
			"task.expand": "Show more",
			"task.collapse": "Show less",
			"memberStatus.running": "Running",
			"memberStatus.inactive": "Inactive",
			"memberStatus.provisioning": "Provisioning",
			"memberStatus.failed": "Failed",
			"status.pending": "Pending",
			"status.in_progress": "In progress",
			"status.completed": "Completed"
		};
		//#endregion
		//#region lib/types/client/mount.js
		/** Source-safe Agent Teams browser registration. */
		/** Required browser services for navigation, slots, and localized copy. */
		const inject = [
			"sessions",
			"uiWorkspace",
			"slots",
			"locale"
		];
		/**
		* Register the Team locale dictionaries and the conversation-header action.
		* The panel reads the Lead Session's `agentTeam` projection from the shared
		* Session store; this registration performs no Team RPC.
		* @param ctx - Client Context carrying the injected navigation, locale, slot, and Session services.
		*/
		function registerAgentTeamUi(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "client-ui-agent-team: dictionaries");
			const sessions = ctx.sessions;
			const leadSessionId = (sessionId) => {
				return (sessions.binding(sessionId)?.session.getSnapshot().subagent?.address)?.parentSessionId ?? sessionId;
			};
			const actions = { openTeammate(sessionId, childSessionId) {
				const parentSessionId = leadSessionId(sessionId);
				if ((sessions.retainInfo(sessionId).getSnapshot().retainedBy.mainView ?? 0) === 0) return;
				if (childSessionId === parentSessionId) {
					ctx.uiWorkspace.openSession(parentSessionId);
					return;
				}
				ctx.uiWorkspace.openSession({
					parentSessionId,
					childSessionId,
					mode: "continuable"
				});
			} };
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "agent-team",
				order: -20,
				locale: NS,
				inject: () => actions
			}, TeamAction));
		}
		//#endregion
		//#region lib/types/client/index.js
		/** Browser entry registering the Agent Teams conversation-header action. */
		/**
		* Register the Team locale dictionaries and header action on the Client Context.
		* @param ctx - Client Context with the declared `inject` services available.
		*/
		function apply(ctx) {
			registerAgentTeamUi(ctx);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
