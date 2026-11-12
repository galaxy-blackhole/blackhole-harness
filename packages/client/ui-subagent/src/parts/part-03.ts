/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			const { tab } = useTabInfo();
			const resource = useResource(tab.contentId);
			return (0, react_jsx_runtime.jsx)("div", {
				className: SidebarChat_module_css_default.root,
				"data-sidebar-chat": "",
				children: resource.value === void 0 ? null : (0, react_jsx_runtime.jsx)(SessionProvider, {
					session: resource.value.reference,
					children: renderSlot("sidebar.chat.conversation", {})
				})
			});
		}
		/**
		* Register the chat resource owner and its right-Sidebar presentation.
		* @param ctx - Client root carrying Sessions, resources, Slots, and Sidebar registries.
		* @param t - Chat namespace translator used for fallback tab titles.
		*/
		function registerSidebarChat(ctx, t) {
			ctx.effect(() => ctx.resources.register(subagentChatResourceProvider(ctx.sessions)), "ui-subagent: Sidebar chat resources");
			ctx.effect(() => ctx.sidebarRightTabs.register({
				id: SUBAGENT_CHAT_ID,
				kind: "subagentchat",
				patterns: [`${SUBAGENT_CHAT_ADDRESS}**`],
				priority: "builtin",
				canOpen: (address) => parseSubagentChatAddress(address) !== void 0,
				title: (address) => {
					const child = parseSubagentChatAddress(address)?.childSessionId;
					return child === void 0 ? t("sidebar.chat") : ctx.sessions.list.getSnapshot().byId[child]?.projectionValues?.subagent?.label ?? child;
				}
			}), "ui-subagent: Sidebar chat type");
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: SUBAGENT_CHAT_ID,
				children: { "sidebar.chat.conversation": {
					kind: "single",
					scope: "session"
				} }
			}, SidebarChatTab)), "ui-subagent: Sidebar chat body");
			ctx.effect(() => ctx.slots.inject("sidebar.chat.conversation", () => ctx.slots.register({ name: "sidebar.chat.conversation" }, ConversationSlotPanel)), "ui-subagent: Sidebar Conversation");
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** `subagent` namespace dictionaries. */
		/** Dictionary namespace owned by this plugin. */
		const NS = "subagent";
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"duration.seconds": "{seconds}秒",
			"duration.minutes": "{minutes}分{seconds}秒",
			"duration.hours": "{hours}小时{minutes}分{seconds}秒",
			"duration.days": "{days}天",
			"duration.daysHours": "{days}天{hours}小时",
			"duration.months": "约{months}个月",
			"duration.monthsDays": "约{months}个月{days}天",
			"duration.years": "约{years}年",
			"duration.yearsMonths": "约{years}年{months}个月",
			"duration.exactDays": "{days}天{hours}小时{minutes}分{seconds}秒",
			"duration.exactTitle": "总活跃耗时：{duration}",
			"tokens.thousand": "{value}K",
			"tokens.million": "{value}M",
			"tokens.total": "{value} tok",
			"loading.label": "正在加载子智能体…",
			"load.error": "无法加载子智能体",
			"catalog.migrationRequired": "需要迁移",
			"retry": "重试",
			"mode.external": "外部任务",
			"mode.oneShot": "一次性",
			"mode.continuable": "可继续",
			"mode.unknown": "模式未知",
			"readonly.unknown.body": "读取子会话后才能确定是否可继续。",
			"activity.running": "正在运行",
			"activity.completed": "已完成",
			"activity.inactive": "当前未运行",
			"branch.collapse": "收起 {label} 的下级子智能体",
			"branch.expand": "展开 {label} 的下级子智能体",
			"count.total.one": "{count} 个子智能体",
			"count.total.other": "{count} 个子智能体",
			"count.running.one": "{count} 个子智能体，正在运行",
			"count.running.other": "{count} 个子智能体，正在运行",
			"switcher.aria": "切换子智能体：{title}",
			"tree.aria": "子智能体会话",
			"open.sidebar": "在侧边栏打开",
			"open.sidebar.aria": "在侧边栏打开 {label}",
			"sidebar.chat": "聊天",
			"readonly.oneShot.title": "一次性子智能体记录",
			"readonly.title": "此子智能体暂时只读",
			"readonly.oneShot.body": "一次性任务不支持后续消息，可在这里查看完整执行记录。",
			"readonly.body": "父会话当前不在线，重新打开父会话后即可继续发送消息。"
		};
		/** English dictionary, key-identical to the Chinese source of truth. */
		const en = {
			"duration.seconds": "{seconds}s",
			"duration.minutes": "{minutes}m {seconds}s",
			"duration.hours": "{hours}h {minutes}m {seconds}s",
			"duration.days": "{days}d",
			"duration.daysHours": "{days}d {hours}h",
			"duration.months": "~{months}mo",
			"duration.monthsDays": "~{months}mo {days}d",
			"duration.years": "~{years}y",
			"duration.yearsMonths": "~{years}y {months}mo",
			"duration.exactDays": "{days}d {hours}h {minutes}m {seconds}s",
			"duration.exactTitle": "Total active duration: {duration}",
			"tokens.thousand": "{value}K",
			"tokens.million": "{value}M",
			"tokens.total": "{value} tok",
			"loading.label": "Loading subagents…",
			"load.error": "Unable to load subagents",
			"catalog.migrationRequired": "Migration required",
			"retry": "Retry",
			"mode.external": "External task",
			"mode.oneShot": "one-shot",
			"mode.continuable": "continuable",
			"mode.unknown": "unknown mode",
			"readonly.unknown.body": "Read the child session to determine whether it can be continued.",
			"activity.running": "running",
			"activity.completed": "completed",
			"activity.inactive": "not running",
			"branch.collapse": "Collapse {label} descendants",
			"branch.expand": "Expand {label} descendants",
			"count.total.one": "{count} subagent",
			"count.total.other": "{count} subagents",
			"count.running.one": "{count} subagent running",
			"count.running.other": "{count} subagents running",
			"switcher.aria": "Switch subagent: {title}",
			"tree.aria": "Subagent sessions",
			"open.sidebar": "Open in sidebar",
			"open.sidebar.aria": "Open {label} in sidebar",
			"sidebar.chat": "Chat",
			"readonly.oneShot.title": "One-shot subagent record",
			"readonly.title": "This subagent is read-only for now",
			"readonly.oneShot.body": "One-shot tasks do not accept follow-ups; review the full execution record here.",
			"readonly.body": "The parent session is offline; reopen it to continue sending messages."
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Required services for subagent presentation and navigation. */
		const inject = [
			"sessions",
			"uiWorkspace",
			"slots",
			"locale",
			"sidebarRight"
		];
		/** Claim the composer for one-shot history or an unavailable continuation owner. */
		function selectReadOnlySubagent(owner) {
			const subagent = owner.session?.subagent;
			if (subagent === void 0 || subagent === null) return null;
			if (subagent.address.mode === "unknown") return { reason: "unknown" };
			if (subagent.address.mode === "one-shot") return { reason: "one-shot" };
			if (subagent.parentAvailable !== false) return null;
			return owner.session?.running === true ? null : { reason: "parent-unavailable" };
		}
		/**
		* Client plugin body: register the subagent catalog and read-only composer seats.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-subagent: dictionaries");
			ctx.inject(["resources", "sidebarRightTabs"], (scope) => {
				registerSidebarChat(scope, ctx.locale.bind(NS));
			});
			const catalogActions = (_parentSessionId) => ({
				openChild(address) {
					ctx.uiWorkspace.openSession(address);
				},
				openChildAside(address) {
					ctx.sidebarRight.openResource(subagentChatAddress(address), {
						kind: "subagentchat",
						preferNewPane: true
					});
				},
				refreshProjection(parentSessionId) {
					ctx.sessions.refreshProjections(parentSessionId);
				}
			});
			ctx.slots.inject("conversation.session.header.lineage", () => ctx.slots.register({
				name: "conversation.session.header.lineage",
				locale: NS,
				inject: catalogActions
			}, SubagentHeaderLineage));
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "subagent-catalog",
				order: 10,
				locale: NS,
				inject: catalogActions
			}, SubagentCatalogAction));
			ctx.slots.inject("conversation.composer", () => ctx.slots.register({
				name: "conversation.composer",
				priority: -10,
				locale: NS,
				select: selectReadOnlySubagent
			}, SubagentReadOnlyComposer));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
