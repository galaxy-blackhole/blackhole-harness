/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js — CẮT LẠI 08/11/2026
 *      theo MOT kieu duy nhat (region-based), gộp/cắt tiếp để mỗi lát ≤ 900 dòng.
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#region lib/types/client/chat/turn-trigger.js
		function record(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
		}
		function field(source, key) {
			return typeof source[key] === "string" ? source[key] : "";
		}
		/**
		* Describe a waking message using its recorded source.
		* @param node - durable context, including the original notification body.
		* @returns localized title key and source-family icon.
		*/
		function turnTriggerDetails(node) {
			const source = record(node.source);
			const kind = field(source, "kind");
			let title = "message.trigger.request";
			let icon = "request";
			switch (kind) {
				case "goal":
					title = "message.trigger.goal";
					icon = "goal";
					break;
				case "agent-message":
					title = "message.trigger.agent";
					icon = "agent";
					break;
				case "team-message":
					title = "message.trigger.team";
					icon = "team";
					break;
				case "subagent-settled":
					title = "message.trigger.subagent";
					icon = "subagent";
					break;
				case "webhook": {
					const github = field(source, "provider") === "github";
					title = github ? "message.trigger.github" : "message.trigger.webhook";
					icon = github ? "github" : "webhook";
					break;
				}
				case "schedule":
					title = "message.trigger.schedule";
					icon = "schedule";
					break;
				case "tool-jobs":
					title = "message.trigger.job";
					icon = "job";
					break;
				case "cordis-host-runner":
					title = "message.trigger.plugin";
					icon = "plugin";
					break;
				default: break;
			}
			return {
				title,
				icon
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/TurnTriggerNodeView.module.css.mjs
		const css$2 = ".oz9t_a_root{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-turn-trigger-bg,var(--dsw-alias-markdown-code-block));min-width:0;transition:background-color .1s}.oz9t_a_root:hover{background:var(--dsw-alias-turn-trigger-bg-hover,var(--dsw-alias-interactive-bg-hover))}.oz9t_a_header{width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;align-items:center;gap:10px;padding:12px 16px;transition:color .1s;display:flex}.oz9t_a_header:hover{color:var(--dsw-alias-label-secondary)}.oz9t_a_icon{color:inherit;flex:none;display:inline-flex}.oz9t_a_title{font-size:var(--dsh-content-font-size,14px);flex:none}.oz9t_a_time{color:inherit;font:var(--dsw-font-xxs-12);flex:none;margin-left:auto}.oz9t_a_chevron,.oz9t_a_openChevron{color:inherit;flex:none}.oz9t_a_openChevron{transform:rotate(180deg)}.oz9t_a_body{padding:0 16px 12px 40px}.oz9t_a_explanation{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);margin:8px 0}.oz9t_a_content{white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;font:var(--dsw-font-xxs-12);overflow:auto}@media (prefers-reduced-motion:reduce){.oz9t_a_root,.oz9t_a_header{transition:none}}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-chat/TurnTriggerNodeView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var TurnTriggerNodeView_module_css_default = {
			"body": "oz9t_a_body",
			"chevron": "oz9t_a_chevron",
			"content": "oz9t_a_content",
			"explanation": "oz9t_a_explanation",
			"header": "oz9t_a_header",
			"icon": "oz9t_a_icon",
			"openChevron": "oz9t_a_openChevron",
			"root": "oz9t_a_root",
			"time": "oz9t_a_time",
			"title": "oz9t_a_title"
		};
		//#endregion
		//#region lib/types/client/chat/TurnTriggerNodeView.js
		/** An independent, expandable notice explaining a non-human Turn trigger. */
		const TRIGGER_ICONS = {
			request: _deepseek_ai_dsh_client_ui_primitives.IconContextInjectionOutlineRegular,
			goal: _deepseek_ai_dsh_client_ui_primitives.IconGoalOutlineRegular,
			agent: _deepseek_ai_dsh_client_ui_primitives.IconPaperPlaneOutlineRegular,
			team: _deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutlineRegular,
			subagent: _deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutlineRegular,
			github: _deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular,
			webhook: _deepseek_ai_dsh_client_ui_primitives.IconGlobeOutlineRegular,
			schedule: _deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular,
			job: _deepseek_ai_dsh_client_ui_primitives.IconQueueOutlineRegular,
			plugin: _deepseek_ai_dsh_client_ui_primitives.IconCordisPluginOutlineRegular
		};
		/** Render recorded trigger attribution above the whole-Turn disclosure. */
		function TurnTriggerNodeView({ node, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const bodyId = (0, react.useId)();
			const details = turnTriggerDetails(node.data);
			const TriggerIcon = TRIGGER_ICONS[details.icon];
			const date = new Date(node.data.time);
			const time = formatMessageClock(node.data.time, t);
			return (0, react_jsx_runtime.jsxs)("section", {
				className: TurnTriggerNodeView_module_css_default.root,
				"data-turn-trigger": true,
				children: [(0, react_jsx_runtime.jsxs)("button", {
					className: TurnTriggerNodeView_module_css_default.header,
					type: "button",
					"aria-expanded": open,
					"aria-controls": bodyId,
					onClick: () => {
						setOpen(!open);
					},
					children: [
						(0, react_jsx_runtime.jsx)("span", {
							className: TurnTriggerNodeView_module_css_default.icon,
							"aria-hidden": true,
							children: (0, react_jsx_runtime.jsx)(TriggerIcon, { size: 14 })
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: TurnTriggerNodeView_module_css_default.title,
							children: t(details.title)
						}),
						(0, react_jsx_runtime.jsx)("time", {
							className: TurnTriggerNodeView_module_css_default.time,
							dateTime: date.toISOString(),
							children: time
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
							size: 12,
							className: open ? TurnTriggerNodeView_module_css_default.openChevron : TurnTriggerNodeView_module_css_default.chevron
						})
					]
				}), open && (0, react_jsx_runtime.jsxs)("div", {
					id: bodyId,
					className: TurnTriggerNodeView_module_css_default.body,
					children: [(0, react_jsx_runtime.jsx)("p", {
						className: TurnTriggerNodeView_module_css_default.explanation,
						children: t("message.trigger.explanation")
					}), (0, react_jsx_runtime.jsx)("div", {
						className: TurnTriggerNodeView_module_css_default.content,
						children: (0, react_jsx_runtime.jsx)(NoticeBody, {
							content: node.data.content,
							source: node.data.source,
							t
						})
					})]
				})]
			});
		}
		//#endregion
		//#region lib/types/client/chat/register-node-renderers.js
		/**
		* Register this package's business renderers behind the keyed Chat Node seat.
		* Renderers whose output depends on the work-details mode receive the policy
		* through their own registration; the seat and the other renderers do not.
		* @param ctx - owning UI Conversation context.
		* @param performanceUsage - live statistics detail preference.
		* @param presentation - live presentation policy.
		*/
		function registerChatNodeRenderers(ctx, performanceUsage, presentation) {
			ctx.effect(() => ctx.slots.registerFactory({
				name: "conversation.chat.reasoning.content",
				scope: "root",
				locale: NS
			}, ReasoningContent));
			ctx.slots.inject("conversation.chat.reasoning.body", () => ctx.slots.register({
				name: "conversation.chat.reasoning.body",
				priority: 100
			}, DefaultReasoningBody));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "user",
				locale: NS
			}, UserMessageNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "steering",
				locale: NS
			}, UserMessageNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "context",
				locale: NS
			}, ContextMessageNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "turn-trigger",
				locale: NS
			}, TurnTriggerNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "system-prompt",
				locale: NS
			}, SystemPromptNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "assistant-step",
				locale: NS,
				children: {
					"conversation.chat.reasoning.body": {
						kind: "single",
						scope: "session"
					},
					"conversation.chat.message.images": {
						kind: "single",
						scope: "session"
					}
				},
				inject: () => ({ hooks: { presentation } })
			}, AssistantNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "command",
				locale: NS,
				children: { "conversation.chat.commandview": {
					kind: "keyed",
					scope: "session"
				} }
			}, CommandNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "manual-compaction",
				locale: NS
			}, ManualCompactionNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "compaction",
				locale: NS
			}, CompactionNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "model-retry",
				locale: NS
			}, RetryNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "turn-error",
				locale: NS
			}, TurnErrorNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "turn-max-tokens",
				locale: NS
			}, TurnMaxTokensNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "turn-process",
				locale: NS
			}, TurnProcessNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "turn-tail",
				locale: NS,
				inject: () => ({ hooks: { performanceUsage } }),
				children: {
					"conversation.chat.turnTail": {
						kind: "list",
						scope: "session"
					},
					"conversation.chat.assistant-actions": {
						kind: "list",
						scope: "session"
					}
				}
			}, TurnTailNodeView));
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "unknown",
				locale: NS
			}, UnknownNodeView));
		}
		//#endregion
		//#region lib/types/client/chat/UserContent.js
		/** Reusable user contents inside a caller-owned message row. */
		const EMPTY_LABELS = [];
		/**
		* Render prepared text, ordered attachments, and references without message chrome.
		* The caller owns row identity, pending/echo state, time, and message actions.
		* @param props - prepared content, facts, authorized image loader, and framework Factory/locale seats.
		* @returns the content stack using the existing user-message layout.
		*/
		function UserContent({ content, loadImage, facts, interactive = false, ellipsis = false, renderSlot, renderFactorySlot, t }) {
			const { text, attachments, extraBlocks, referenceLabels = EMPTY_LABELS } = content;
			const compactImages = attachments.length > 1;
			const truncated = (total) => t("json.truncated", { total });
			const showBubble = text !== "" || extraBlocks.length > 0;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MessageItem_module_css_default.userStack,
				children: [
					attachments.length > 0 && (0, react_jsx_runtime.jsx)("div", {
						className: MessageItem_module_css_default.attachmentRow,
						"data-message-attachments": true,
						children: attachments.map((attachment, index) => attachment.type === "image" ? (0, react_jsx_runtime.jsx)(react.Fragment, { children: renderSlot("conversation.chat.user.images", {
							images: [attachment.image],
							loadImage,
							align: "end",
							compact: compactImages
						}) }, `image:${index}`) : (0, react_jsx_runtime.jsxs)("span", {
							className: MessageItem_module_css_default.fileCard,
							title: attachment.file.name,
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
								path: attachment.file.name,
								className: MessageItem_module_css_default.fileIcon
							}), (0, react_jsx_runtime.jsxs)("span", {
								className: MessageItem_module_css_default.fileContent,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: MessageItem_module_css_default.fileName,
									children: attachment.file.name
								}), (0, react_jsx_runtime.jsx)("span", {
									className: MessageItem_module_css_default.fileMeta,
									children: [(0, _deepseek_ai_dsh_client_ui_primitives.fileExtension)(attachment.file.name).toUpperCase().slice(0, 8), (0, _deepseek_ai_dsh_client_ui_primitives.fileSizeText)(attachment.file.bytes)].filter(Boolean).join(" ")
								})]
							})]
						}, `file:${index}`))
					}),
					showBubble && (0, react_jsx_runtime.jsxs)("div", {
						className: MessageItem_module_css_default.bubble,
						children: [renderFactorySlot("conversation.user.text", {
							text,
							facts,
							interactive,
							ellipsis
						}), extraBlocks.map((block, index) => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonBlock, {
							label: t("message.extraBlock"),
							payload: block,
							truncatedLabel: truncated
						}, index))]
					}),
					referenceLabels.length > 0 && (0, react_jsx_runtime.jsx)("div", {
						className: MessageItem_module_css_default.referenceSummary,
						children: t("message.referenceSummary", { labels: referenceLabels.join(t("message.referenceSeparator")) })
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/contract/turn-metrics.js
		function usageOutputTokens(usage) {
			if (typeof usage !== "object" || usage === null) return null;
			const value = usage.outputTokens;
			return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
		}
		/**
		* Read one assistant node's TTFT, decode wall time, and output tokens.
		* @param node - A settled assistant node.
		* @returns Per-part readings with `null` for unrecorded values.
		*/
		function assistantStepReading(node) {
			const timing = node.timing;
			return {
				ttftMs: timing !== void 0 && timing.stepStartTime !== null && timing.firstTokenTime !== null ? Math.max(0, timing.firstTokenTime - timing.stepStartTime) : null,
				decodeMs: timing !== void 0 && timing.firstTokenTime !== null ? Math.max(0, timing.completedTime - timing.firstTokenTime) : null,
				outputTokens: usageOutputTokens(node.usage)
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/StatsPills.module.css.mjs
		const css$1 = ".bOPqQW_anchor{min-width:0;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));display:inline-flex}.bOPqQW_pill{box-sizing:border-box;border-radius:var(--dsw-radius-sm);max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;background:0 0;border:none;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}.bOPqQW_pill svg{flex:none;width:14px;height:14px}button.bOPqQW_pill{cursor:pointer}button.bOPqQW_pill:hover,button.bOPqQW_pill[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.bOPqQW_label{text-overflow:ellipsis;min-width:0;overflow:hidden}.bOPqQW_sep{color:var(--dsw-alias-separator-primary);margin:0 6px}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-chat/StatsPills.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var StatsPills_module_css_default = {
			"anchor": "bOPqQW_anchor",
			"label": "bOPqQW_label",
			"pill": "bOPqQW_pill",
			"sep": "bOPqQW_sep"
		};
		//#endregion
		//#region lib/types/client/chat/StatsPills.js
		/**
		* Fold assistant and tool-result nodes into window-scoped display totals —
		* the FALLBACK for assemblies without the `sessionStats` projection.
		*
		* Every displayed figure rides that durable whole-log projection (and token
		* accounting rides `tokenUsage`) because the window is paged and compaction
		* rewrites it; this fold answers "what is on screen" only when no projection
		* value is served. Its field names deliberately mirror the projection's so
		* the two swap wholesale.
		* @param nodes - snapshot nodes.
		* @returns fallback counts and summed wall times.
		*/
		function deriveStats(nodes) {
			const turns = /* @__PURE__ */ new Set();
			let steps = 0;
			let llmMs = 0;
			let toolMs = 0;
			let ttftMs = 0;
			let ttftSteps = 0;
			let decodeMs = 0;
			let decodeTokens = 0;
			for (const node of nodes) {
				if (node.kind === "tool-result") {
					if (node.callTime !== null) toolMs += Math.max(0, node.time - node.callTime);
					continue;
				}
				if (node.kind !== "assistant") continue;
				turns.add(node.turn);
				steps += 1;
				if (node.timing !== void 0 && node.timing.stepStartTime !== null) llmMs += Math.max(0, node.timing.completedTime - node.timing.stepStartTime);
				const reading = assistantStepReading(node);
				if (reading.ttftMs !== null) {
					ttftMs += reading.ttftMs;
					ttftSteps += 1;
				}
				if (reading.decodeMs !== null && reading.outputTokens !== null) {
					decodeMs += reading.decodeMs;
					decodeTokens += reading.outputTokens;
				}
			}
			return {
				turns: turns.size,
				steps,
				llmMs,
				toolMs,
				ttftMs,
				ttftSteps,
				decodeMs,
				decodeTokens
			};
		}
		/**
		* Compact duration: 45.2s under a minute, 2m42s from there on.
		* @param ms - duration in milliseconds.
		* @returns display string.
		*/
		function formatDuration(ms, t) {
			const s = ms / 1e3;
			if (s < 60) return t("duration.compactSeconds", { seconds: Math.round(s * 10) / 10 });
			const whole = Math.round(s);
			return t("duration.compactMinutes", {
				minutes: Math.floor(whole / 60),
				seconds: whole % 60
			});
		}
		/**
		* Display-ready cache-hit share of prompt-side input over the whole durable log.
		* @param usage - the session's token-usage projection value.
		* @returns integer text when integer rounding stays below 100, otherwise the
		* minimum decimal precision that still rounds below 100; a full hit returns
		* 100, and no billed input returns null.
		*/
		function cacheHitPercent(usage) {
			const denominator = billedInputTokens(usage);
			return formatCacheHitPercent(usage.cacheReadTokens, denominator);
		}
		/**
		* Sum the three disjoint prompt-side billing buckets.
		* @param usage - the session's token-usage projection value.
		* @returns billed input tokens.
		*/
		function billedInputTokens(usage) {
			return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
		}
		function exactCount(value, t) {
			return t("message.turnUsage.count", { count: formatExactTokens(value, t) });
		}
		function joined$1(first, second) {
			if (second === null) return first;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				first,
				(0, react_jsx_runtime.jsx)("span", {
					className: StatsPills_module_css_default.sep,
					"aria-hidden": true,
					children: "·"
				}),
				second
			] });
		}
		function useSessionStats(useChat, useProjection) {
			const settledNodes = useChat((s) => s.legacy.nodes);
			const projected = useProjection("sessionStats");
			return (0, react.useMemo)(() => projected ?? deriveStats(settledNodes), [projected, settledNodes]);
		}
		function decodeSpeed(stats, t) {
			return t("message.tokensPerSecond", { tps: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1e3)) });
		}
		/** A static reading: used when the pill has no dialog rows or the mode is Compact. */
		function PlainPill({ stat, icon, label }) {
			return (0, react_jsx_runtime.jsx)("span", {
				className: StatsPills_module_css_default.anchor,
				"data-composer-stat": stat,
				children: (0, react_jsx_runtime.jsxs)("span", {
					className: StatsPills_module_css_default.pill,
					children: [icon, (0, react_jsx_runtime.jsx)("span", {
						className: StatsPills_module_css_default.label,
						children: label
					})]
				})
			});
		}
		/**
		* A pill button opening its own portaled dialog. Each pill owns its open
		* state; useStatDialog closes it on Escape or an outside pointerdown or click,
		* so at most one dialog is open across the dock.
		*/
		function DialogPill({ stat, icon, label, ariaLabel, title, titleValue, children }) {
			const { open, setOpen, rootRef, panelRef, pos } = useStatDialog();
			return (0, react_jsx_runtime.jsxs)("span", {
				ref: rootRef,
				className: StatsPills_module_css_default.anchor,
				"data-composer-stat": stat,
				children: [(0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: StatsPills_module_css_default.pill,
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					"aria-label": ariaLabel,
					onClick: () => {
						setOpen(!open);
					},
					children: [icon, (0, react_jsx_runtime.jsx)("span", {
						className: StatsPills_module_css_default.label,
						children: label
					})]
				}), open && (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)("div", {
					ref: panelRef,
					className: stat_dialog_module_css_default.panel,
					role: "dialog",
					"aria-label": title,
					style: pos ?? MEASURE_STYLE,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: stat_dialog_module_css_default.title,
							children: [(0, react_jsx_runtime.jsxs)("span", {
								className: stat_dialog_module_css_default.titleLabel,
								children: [icon, title]
							}), titleValue !== void 0 && (0, react_jsx_runtime.jsx)("span", {
								className: stat_dialog_module_css_default.titleValue,
								children: titleValue
							})]
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: stat_dialog_module_css_default.titleRule,
							"aria-hidden": true
						}),
						children
					]
				}), document.body)]
			});
		}
		/**
		* Turn and step counts with whole-session speed, opening the time and speed
		* dialog; Compact keeps only the speed reading.
		*/
		const ActivityPill = (0, react.memo)(function ActivityPill({ useChat, useProjection, usePerformanceUsage, t }) {
			const mode = usePerformanceUsage((value) => value);
			const stats = useSessionStats(useChat, useProjection);
			const speed = stats.decodeMs > 0 ? decodeSpeed(stats, t) : null;
			const icon = (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGaugeOutlineRegular, {});
			if (mode === "compact") return speed === null ? null : (0, react_jsx_runtime.jsx)(PlainPill, {
				stat: "activity",
				icon,
				label: speed
			});
			if (stats.steps === 0) return null;
			const counts = t("stats.counts", {
				turns: stats.turns,
				steps: stats.steps
			});
			const content = {
				stat: "activity",
				icon,
				label: joined$1(counts, speed)
			};
			if (stats.llmMs <= 0 && stats.toolMs <= 0 && stats.ttftSteps <= 0 && speed === null) return (0, react_jsx_runtime.jsx)(PlainPill, { ...content });
			return (0, react_jsx_runtime.jsx)(DialogPill, {
				...content,
				ariaLabel: speed === null ? counts : `${counts} · ${speed}`,
				title: t("stats.dialog.title"),
				children: (0, react_jsx_runtime.jsxs)("dl", {
					className: stat_dialog_module_css_default.details,
					"data-session-stats-details": true,
					children: [
						stats.llmMs > 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("stats.dialog.llmTime") }), (0, react_jsx_runtime.jsx)("dd", { children: formatDuration(stats.llmMs, t) })] }),
						stats.toolMs > 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("stats.dialog.toolTime") }), (0, react_jsx_runtime.jsx)("dd", { children: formatDuration(stats.toolMs, t) })] }),
						stats.ttftSteps > 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("stats.dialog.ttft") }), (0, react_jsx_runtime.jsx)("dd", { children: formatDuration(stats.ttftMs / stats.ttftSteps, t) })] }),
						speed !== null && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("stats.dialog.speed") }), (0, react_jsx_runtime.jsx)("dd", { children: speed })] })
					]
				})
			});
		});
		/** Whole-log token total and cache hit; Compact keeps only the cache hit. */
		const UsagePill = (0, react.memo)(function UsagePill({ useProjection, usePerformanceUsage, t }) {
			const mode = usePerformanceUsage((value) => value);
			const usage = useProjection("tokenUsage");
			if (usage === void 0 || billedInputTokens(usage) === 0 && usage.outputTokens === 0) return null;
			const cacheHit = cacheHitPercent(usage);
			const cacheHitText = cacheHit !== null ? t("stats.cacheHit", { percent: cacheHit }) : null;
			const icon = (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDatabaseOutlineRegular, {});
			if (mode === "compact") return cacheHitText === null ? null : (0, react_jsx_runtime.jsx)(PlainPill, {
				stat: "usage",
				icon,
				label: cacheHitText
			});
			const total = billedInputTokens(usage) + usage.outputTokens;
			const totalText = t("message.turnUsage.count", { count: formatTokens(total, t) });
			return (0, react_jsx_runtime.jsx)(DialogPill, {
				stat: "usage",
				icon,
				label: joined$1(totalText, cacheHitText),
				ariaLabel: cacheHitText === null ? totalText : `${totalText} · ${cacheHitText}`,
				title: t("stats.dialog.usageTitle"),
				titleValue: exactCount(total, t),
				children: (0, react_jsx_runtime.jsxs)("dl", {
					className: stat_dialog_module_css_default.details,
					"data-session-stats-usage": true,
					children: [
						cacheHit !== null && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("message.turnUsage.cacheHit") }), (0, react_jsx_runtime.jsx)("dd", { children: `${cacheHit}%` })] }),
						(0, react_jsx_runtime.jsx)("dt", { children: t("message.turnUsage.input") }),
						(0, react_jsx_runtime.jsx)("dd", { children: exactCount(usage.uncachedInputTokens, t) }),
						(0, react_jsx_runtime.jsx)("dt", { children: t("message.turnUsage.cacheRead") }),
						(0, react_jsx_runtime.jsx)("dd", { children: exactCount(usage.cacheReadTokens, t) }),
						usage.cacheWriteTokens !== 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("message.turnUsage.cacheWrite") }), (0, react_jsx_runtime.jsx)("dd", { children: exactCount(usage.cacheWriteTokens, t) })] }),
						(0, react_jsx_runtime.jsx)("dt", { children: t("message.turnUsage.output") }),
						(0, react_jsx_runtime.jsx)("dd", { children: exactCount(usage.outputTokens, t) })
					]
				})
			});
		});
		//#endregion
		//#region lib/types/client/conversation-nodes/common.js
		/**
		* Relative positions in one durable event's seq neighborhood: interrupted
		* Assistant, its follow-up Nodes, then follow-ups to an ordinary final. The
		* max-tokens notice sits between a closing Assistant and the turn-tail so the
		* tail stays the turn's last node and keeps its branch action enabled.
		*/
		const CHAT_SYNTHETIC_SEQ_OFFSETS = {
			interruptedAssistant: -.9,
			interruptedFollowup: -.8,
			processControl: -.1,
			maxTokensNotice: .05,
			finalizedFollowup: .1
		};
		/**
		* Resolve one Context's best currently loaded event Location.
		* @param context - assembled business Context.
		* @returns start or first-match Location, otherwise unresolved.
		*/
		function contextLocation(context) {
			return context.start?.location ?? context.matches[0]?.location ?? { kind: "unresolved" };
		}
		/**
		* Read the Turn and Step a Location resolves to.
		* @param location - engine-owned Location.
		* @returns resolved coordinates; Session-level and unresolved Locations have none.
		*/
		function locationCoordinates(location) {
			if (location.kind === "step") return {
				turn: location.turn.turn,
				step: location.step.step
			};
			if (location.kind === "turn") return { turn: location.turn.turn };
			return {};
		}
		/**
		* Build one final Chat target Node with the engine-owned stable key.
		* @param context - assembled business Context.
		* @param kind - Chat renderer dispatch key.
		* @param anchorSeq - sortable render position.
		* @param data - renderer-owned payload.
		* @param options - optional Location, visibility, and group-tree overrides.
		* @returns final Chat view Node.
		*/
		function chatNode(context, kind, anchorSeq, data, options = {}) {
			return {
				key: context.key,
				kind,
				id: context.id,
				target: "chat",
				anchorSeq,
				location: options.location ?? contextLocation(context),
				visibility: options.visibility ?? "visible",
				groupTree: options.groupTree,
				data
			};
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/event-projection.js
		/** Chat-owned conversion from durable Session events to Chat view data. */
		function asRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
		}
		function readString(record, key) {
			const value = record[key];
			return typeof value === "string" && value.length > 0 ? value : null;
		}
		function collect(source, member, field) {
			const list = source[member];
			if (!Array.isArray(list)) return [];
			const seen = [];
			for (const entry of list) {
				const record = asRecord(entry);
				const value = record === null ? null : readString(record, field);
				if (value !== null && !seen.includes(value)) seen.push(value);
			}
			return seen;
		}
		function joined(names) {
			return names.length > 0 ? names.join(", ") : null;
		}
		/** Forms Chat presents structurally; unknown merge-extensible values remain opaque. */
		const KNOWN_FORMS = [
			"instructions",
			"catalog",
			"snapshot",
			"notice",
			"relay",
			"recall"
		];
		/**
		* Read the target-supported presentation form from a durable message source.
		* @param source - Logged `user/message` source.
		* @returns Supported form, or null for the opaque presentation.
		*/
		function contextForm(source) {
			const record = asRecord(source);
			const form = record === null ? null : readString(record, "form");
			return form !== null && KNOWN_FORMS.includes(form) ? form : null;
		}
		/**
		* Project a durable message source to the Chat row's role and producer label.
		* @param source - Logged `user/message` source.
		* @returns Role and label rendered by Chat.
		*/
		function contextProducer(source) {
			const record = asRecord(source);
			const kind = record === null ? null : readString(record, "kind");
			if (record === null || kind === null) return {
				role: "inject",
				label: null
			};
			switch (kind) {
				case "session-reference": return {
					role: "recall",
					label: joined(collect(record, "references", "label")) ?? kind
				};
				case "agent-instructions": return {
					role: "inject",
					label: joined(collect(record, "changes", "path")) ?? kind
				};
				case "skill-invocation": return {
					role: "inject",
					label: readString(record, "name") ?? kind
				};
				default: return {
					role: "inject",
					label: kind
				};
			}
		}
		/**
		* Read distinct labels cited by a durable cross-session recall source.
		* @param source - Logged `user/message` source.
		* @returns Labels in first-seen order.
		*/
		function sessionRecallLabels(source) {
			const record = asRecord(source);
			if (record === null || readString(record, "kind") !== "session-reference") return [];
			return collect(record, "references", "label");
		}
		/**
		* Read the skill name a durable skill-invocation injection loaded.
		* @param source - Logged `user/message` source.
		* @returns The skill name, or null for every other source.
		*/
		function skillInvocationName(source) {
			const record = asRecord(source);
			if (record === null || readString(record, "kind") !== "skill-invocation") return null;
			return readString(record, "name");
		}
		/**
		* Classify finalized Assistant content for Chat rendering.
		* @param content - Core content blocks.
		* @returns Chat blocks in source order.
		*/
		function toAssistantBlocks(content) {
			return content.map(toAssistantBlock);
		}
		/**
		* Classify one finalized Assistant block for Chat rendering.
		* @param block - Core content block.
		* @returns Chat block.
		*/
		function toAssistantBlock(block) {
			switch (block.type) {
				case "text": return {
					kind: "text",
					text: block.text
				};
				case "reasoning": return {
					kind: "reasoning",
					text: block.text
				};
				case "image": return {
					kind: "image",
					attachment: block.attachment
				};
				case "tool-call": return {
					kind: "tool-call",
					callId: String(block.id),
					name: block.name,
					argsRaw: block.arguments
				};
				default: return {
					kind: "other",
					block
				};
			}
		}
		/**
		* Create the initial Chat block for one streamed Assistant block kind.
		* @param blockType - Wire block kind.
		* @returns Empty block ready to receive deltas.
		*/
		function emptyAssistantBlock(blockType) {
			switch (blockType) {
				case "text": return {
					kind: "text",
					text: ""
				};
				case "reasoning": return {
					kind: "reasoning",
					text: ""
				};
				case "tool-call": return {
					kind: "tool-call",
					callId: "",
					name: "",
					argsRaw: ""
				};
				default: return {
					kind: "other",
					block: null
				};
			}
		}
		/**
		* Convert a durable failure to locale-independent fields safe for Chat.
		* @param failure - Failure preserved by a Session event.
		* @returns Sanitized message and optional stable provider code.
		*/
		function displayFailure(failure) {
			if (failure === null || typeof failure !== "object") return { message: String(failure) };
			const record = failure;
			const code = typeof record.code === "string" ? record.code : void 0;
			if (code === "AUTH") return {
				code,
				message: ""
			};
			return {
				...code === void 0 ? {} : { code },
				message: typeof record.message === "string" ? record.message : JSON.stringify(failure)
			};
		}
		/**
		* Whether a stream chunk carries visible model output for Chat timing.
		* @param chunk - Stream chunk to inspect.
		* @returns true for a non-empty text, reasoning, or Tool-call delta.
		*/
		function isTokenDelta(chunk) {
			switch (chunk.type) {
				case "text-delta":
				case "reasoning-delta": return chunk.text !== "";
				case "tool-call-delta": return chunk.argumentsDelta !== "" || chunk.name !== void 0;
				default: return false;
			}
		}
		//#endregion