/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					const aborted = () => signal.aborted;
					if (aborted()) return;
					const target = parsePlanAddress(address);
					if (target === void 0) {
						yield {
							ok: false,
							error: new RemoteError("plan/invalid-address", "Invalid plan resource address.", {})
						};
						return;
					}
					const sessionAddress = target.session;
					try {
						let snapshot;
						for await (const frame of remote.follow({ address: sessionAddress }, signal)) if (frame.type === "snapshot") {
							snapshot = frame;
							break;
						}
						if (aborted()) return;
						if (snapshot === void 0) throw new RemoteError("plan/unavailable", "Session history ended before the plan could be read.", {});
						let page = {
							records: snapshot.records,
							hasMore: snapshot.hasMore
						};
						while (true) {
							for (const entry of page.records) {
								const plan = submittedPlan(entry.event);
								if (plan?.callId === target.callId) {
									yield {
										ok: true,
										value: plan
									};
									return;
								}
							}
							const beforeSeq = page.records[0]?.event.seq;
							if (!page.hasMore || beforeSeq === void 0) break;
							const next = await remote.page({
								address: sessionAddress,
								throughSeq: snapshot.cursor,
								beforeSeq
							}, signal);
							if (aborted()) return;
							if (!next.ok) {
								yield next;
								return;
							}
							page = next.value;
						}
						yield {
							ok: false,
							error: new RemoteError("plan/not-found", "The submitted plan was not found in this Session.", {})
						};
					} catch (error) {
						if (!aborted()) yield {
							ok: false,
							error: remoteErrorOf(error) ?? new RemoteError("plan/read-failed", error instanceof Error ? error.message : String(error), {})
						};
					}
				}
			};
		}
		//#endregion
		//#region lib/types/client/review-store.js
		/** Session-owned memory of pending plans already opened automatically. */
		/**
		* Keep manual sidebar closure effective across review component remounts.
		* @returns a transient store handle whose instances belong to Session scopes.
		*/
		function createPlanReviewStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({ opened: {} }),
				actions: { markOpened: (draft, reviewKey) => {
					draft.opened[reviewKey] = true;
				} }
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-plan/src/client/PlanModeControl.module.css.mjs
		const css = ".rS3zOq_wrap{align-items:center;gap:6px;display:inline-flex}.rS3zOq_chip{border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-state-business-tertiary);min-width:34px;height:28px;color:var(--dsw-alias-state-business-primary);cursor:pointer;border:none;align-items:center;gap:4px;padding:0 8px;font-size:13px;font-weight:500;line-height:20px;display:inline-flex}.rS3zOq_chip:hover:not(:disabled){background:color-mix(in srgb, var(--dsw-alias-state-business-tertiary), var(--dsw-alias-state-business-primary) 6%)}.rS3zOq_chip:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.rS3zOq_chip:disabled{opacity:.6;cursor:default}.rS3zOq_glyph{color:currentColor;flex:none;width:14px;height:14px;display:inline-flex}.rS3zOq_hoverGlyph,.rS3zOq_chip:hover:not(:disabled) .rS3zOq_restGlyph,.rS3zOq_chip:focus-visible .rS3zOq_restGlyph{display:none}.rS3zOq_chip:hover:not(:disabled) .rS3zOq_hoverGlyph,.rS3zOq_chip:focus-visible .rS3zOq_hoverGlyph{display:block}.rS3zOq_error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}";
		const tagId = "@deepseek-ai/dsh-client-ui-plan/PlanModeControl.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-plan";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var PlanModeControl_module_css_default = {
			"chip": "rS3zOq_chip",
			"error": "rS3zOq_error",
			"glyph": "rS3zOq_glyph",
			"hoverGlyph": "rS3zOq_hoverGlyph",
			"restGlyph": "rS3zOq_restGlyph",
			"wrap": "rS3zOq_wrap"
		};
		//#endregion
		//#region lib/types/client/PlanModeControl.js
		/**
		* Plan-mode status over the host-computed `plan` projection. The chip renders
		* only while the effective target is plan mode (`pending ? !active : active`
		* — a folded host value, not client optimism) and executes /plan off.
		*/
		function PlanChip({ useProjection, locked, exitPlanMode, t }) {
			const plan = useProjection("plan");
			const [leaving, setLeaving] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const aliveRef = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				aliveRef.current = true;
				return () => {
					aliveRef.current = false;
				};
			}, []);
			if (plan === void 0) return null;
			if (!(plan.pending ? !plan.active : plan.active)) return null;
			const off = () => {
				setLeaving(true);
				setError(null);
				exitPlanMode().then((failure) => {
					if (!aliveRef.current) return;
					setLeaving(false);
					setError(failure);
				}, (reason) => {
					if (!aliveRef.current) return;
					setLeaving(false);
					setError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			return (0, react_jsx_runtime.jsxs)("span", {
				className: PlanModeControl_module_css_default.wrap,
				children: [(0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: PlanModeControl_module_css_default.chip,
					"aria-label": t("chip.on.aria"),
					title: t("chip.on.title"),
					disabled: locked || leaving,
					onClick: off,
					children: [(0, react_jsx_runtime.jsxs)("span", {
						className: PlanModeControl_module_css_default.glyph,
						"aria-hidden": true,
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlanOutlineRegular, {
							className: PlanModeControl_module_css_default.restGlyph,
							size: 14
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseCircleFillRegular, {
							className: PlanModeControl_module_css_default.hoverGlyph,
							size: 14
						})]
					}), t("chip.label")]
				}), error !== null && (0, react_jsx_runtime.jsx)("span", {
					className: PlanModeControl_module_css_default.error,
					role: "status",
					title: error,
					children: t("chip.exitFailed")
				})]
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** `plan` namespace dictionaries (the composer plan chip's copy). */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"chip.label": "计划",
			"preview.title": "计划",
			"preview.document": "计划 · Markdown",
			"preview.action": "打开",
			"preview.open": "在侧边栏打开计划",
			"preview.full": "查看全文",
			"preview.openNamed": "打开计划：{title}",
			"preview.loading": "正在读取计划…",
			"preview.failed": "无法读取计划",
			"preview.invalidAddress": "计划地址无效",
			"preview.historyUnavailable": "无法读取会话历史",
			"preview.notFound": "未找到这份计划",
			"preview.unavailable": "计划预览不可用",
			"preview.expired": "临时计划预览已失效，请从仍在等待审批的卡片重新打开。",
			"chip.on.aria": "计划模式已开启，按下关闭",
			"chip.on.title": "计划模式已开启 — 点击关闭（/plan off）",
			"chip.exitFailed": "退出计划模式失败"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"chip.label": "Plan",
			"preview.title": "Plan",
			"preview.document": "Plan · Markdown",
			"preview.action": "Open",
			"preview.open": "Open plan in sidebar",
			"preview.full": "View full plan",
			"preview.openNamed": "Open plan: {title}",
			"preview.loading": "Loading plan…",
			"preview.failed": "Could not load plan",
			"preview.invalidAddress": "Invalid plan address",
			"preview.historyUnavailable": "Session history is unavailable",
			"preview.notFound": "This plan was not found",
			"preview.unavailable": "Plan preview is unavailable",
			"preview.expired": "This temporary plan preview has expired. Reopen it from the pending review card.",
			"chip.on.aria": "Plan mode on, press to turn off",
			"chip.on.title": "Plan mode on — click to turn off (/plan off)",
			"chip.exitFailed": "Failed to exit plan mode"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "plan";
		/** Services for plan controls, Conversation projection, and resource navigation. */
		const inject = [
			"slots",
			"remote",
			"remote.commands",
			"remote.session",
			"sessions",
			"locale",
			"uiConversation",
			"resources",
			"sidebarRight",
			"sidebarRightTabs"
		];
		/**
		* Register plan controls, permanent Chat cards, and sidebar document reading.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-plan: dictionaries");
			const previewId = "@deepseek-ai/dsh-client-ui-plan";
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.uiConversation.events.register(planDefinition), "ui-plan: conversation definition");
			ctx.effect(() => ctx.resources.register(planResourceProvider(ctx.remote.session)), "ui-plan: resources");
			ctx.effect(() => ctx.sidebarRightTabs.register({
				id: previewId,
				kind: "plan",
				patterns: ["dsh-resource://plan/**", "dsh-resource://plan-review/**"],
				priority: "builtin",
				canOpen: (address) => parsePlanAddress(address) !== void 0 || isReviewPreviewAddress(address),
				title: () => t("preview.title")
			}), "ui-plan: sidebar type");
			const open = (sessionId) => ({ openPlan: (callId) => {
				const child = ctx.sessions.subagentAddress(sessionId);
				const session = child === void 0 ? {
					kind: "session",
					sessionId
				} : {
					kind: "subagent",
					...child
				};
				ctx.sidebarRight.openResource(planAddress({
					session,
					callId
				}));
			} });
			const reviewWindow = randomUUID();
			const reviewStore = createPlanReviewStore();
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
				name: "conversation.chat.turnTail",
				id: previewId,
				locale: NS,
				inject: (sessionId) => {
					const binding = ctx.sessions.binding(sessionId);
					if (binding === void 0) throw new Error(`ui-plan: unknown session "${sessionId}"`);
					const chat = ctx.uiConversation.binding(binding).target("chat");
					return {
						...open(sessionId),
						keyedHooks: { plans: (turn) => {
							const snapshot = chat.getSnapshot();
							if (snapshot === void 0) throw new Error("ui-plan: Chat target is unavailable");
							return snapshot.nodes.turnDataSource(Number(turn), "submitted-plan");
						} }
					};
				}
			}, PlanCards));
			ctx.slots.inject("conversation.plan-review.actions", () => ctx.slots.register({
				name: "conversation.plan-review.actions",
				id: previewId,
				locale: NS,
				store: reviewStore,
				inject: (sessionId) => ({
					openReview: (review, requestKey) => {
						if (review.callId !== void 0) {
							open(sessionId).openPlan(review.callId);
							return;
						}
						ctx.sidebarRight.openResource(reviewPreviewAddress(sessionId, `${reviewWindow}:${requestKey}`), { params: { planReview: {
							markdown: review.plan,
							title: (0, _deepseek_ai_dsh_client_ui_primitives.extractMarkdownPlainText)(review.plan, { mode: "first-line" })
						} } });
					},
					hooks: { sidebarMounted: ctx.sidebarRight.mounted }
				})
			}, PlanReviewOpen));
			ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: previewId,
				locale: NS
			}, PlanPreview));
			ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
				name: "sidebar.right.pane.tab.title",
				key: previewId
			}, PlanTitle));
			ctx.slots.inject("conversation.input.plan", () => ctx.slots.register({
				name: "conversation.input.plan",
				locale: NS,
				inject: (sessionId) => ({ exitPlanMode: async () => {
					const result = await ctx.remote.commands.execute(sessionId, "/plan off", []);
					if (!result.ok) return `${result.error.message} (${result.error.code})`;
					if (result.value === void 0) return "unknown command: /plan off";
					return null;
				} })
			}, PlanChip));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
