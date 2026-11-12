/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js — CẮT LẠI 08/11/2026
 *      theo MOT kieu duy nhat (region-based), gộp/cắt tiếp để mỗi lát ≤ 900 dòng.
 *      SỬA 10/11/2026 (chủ dự án yêu cầu): BỎ icon "con cá" (RunningWhaleTail) ở chỉ báo đang chạy —
 *      dòng suy luận trong chat trước đây mở đầu bằng con cá. Chỉ báo còn lại: dải phân cách + chữ
 *      "Đang suy nghĩ trong {duration}". Xem docs/GBH-SAI-KHAC-CO-CHU-DICH.md (mục ui-chat).
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#region lib/types/client/chat/MessageItem.js
		const EMPTY_TEXT_FACTS = {};
		function contentParts(content) {
			const texts = [];
			const attachments = [];
			const rest = [];
			for (const block of content) {
				const b = block;
				if (b.type === "text" && typeof b.text === "string") texts.push(b.text);
				else if (b.type === "image" && b.attachment !== void 0) attachments.push({
					type: "image",
					image: { attachment: b.attachment }
				});
				else if (b.type === "file" && b.attachment !== void 0) attachments.push({
					type: "file",
					file: b.attachment
				});
				else rest.push(block);
			}
			return {
				text: texts.join(""),
				attachments,
				rest
			};
		}
		function retrySeconds(milliseconds) {
			return Math.max(1, Math.ceil(milliseconds / 1e3));
		}
		function failureMessage(message, code, t) {
			if (code === "ACCOUNT_SIGNED_OUT") return t("message.failure.accountSignedOut");
			if (code === "INTERRUPTED") return t("message.failure.interrupted");
			if (code === "ACCOUNT_SIGN_IN_REQUIRED") return t("message.failure.accountSignInRequired");
			if (code === "QUOTA" || code === "ACCOUNT_QUOTA") return t("message.failure.quota");
			return code === "AUTH" ? t("message.failure.auth") : message;
		}
		function ModelRetryItem({ node, active, t }) {
			const deadline = (0, react.useMemo)(() => Date.now() + node.delayMs, [node.delayMs, node.seq]);
			const scheduledSeconds = retrySeconds(node.delayMs);
			const maximum = node.mode === "normal" ? node.maxRetries : "∞";
			const [countdown, setCountdown] = (0, react.useState)(() => ({
				deadline,
				seconds: retrySeconds(deadline - Date.now())
			}));
			const remainingSeconds = countdown.deadline === deadline ? countdown.seconds : retrySeconds(deadline - Date.now());
			(0, react.useEffect)(() => {
				if (!active) return;
				const updateCountdown = () => {
					const next = retrySeconds(deadline - Date.now());
					setCountdown((current) => current.deadline === deadline && current.seconds === next ? current : {
						deadline,
						seconds: next
					});
					return next;
				};
				if (updateCountdown() === 1) return;
				const timer = window.setInterval(() => {
					if (updateCountdown() === 1) window.clearInterval(timer);
				}, 250);
				return () => {
					window.clearInterval(timer);
				};
			}, [active, deadline]);
			const label = active ? t("message.retry.active") : node.retryState === "cancelled" ? t("message.retry.cancelled") : node.retryState === "started" ? t("message.retry.started") : t("message.retry.scheduled");
			const seconds = active ? remainingSeconds : scheduledSeconds;
			return (0, react_jsx_runtime.jsxs)("details", {
				className: MessageItem_module_css_default.retryRow,
				"data-active": active || void 0,
				children: [(0, react_jsx_runtime.jsx)("summary", {
					className: MessageItem_module_css_default.retrySummary,
					children: (0, react_jsx_runtime.jsx)("span", {
						className: MessageItem_module_css_default.retryText,
						role: "status",
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, {
							active,
							children: t("message.retry.status", {
								label,
								retry: node.retry,
								maximum,
								seconds
							})
						})
					})
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: MessageItem_module_css_default.retryDetails,
					children: [(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("span", {
						className: MessageItem_module_css_default.retryDetailLabel,
						children: t("message.retry.delay")
					}), t("duration.milliseconds", { milliseconds: Math.round(node.delayMs) })] }), (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("span", {
						className: MessageItem_module_css_default.retryDetailLabel,
						children: t("message.retry.failure")
					}), failureMessage(node.failure.message, node.failure.code, t)] })]
				})]
			});
		}
		/** Persistent, turn-positioned feedback for a terminal failure. */
		function TurnErrorItem({ node, t }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MessageItem_module_css_default.turnErrorRow,
				role: "status",
				children: [
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
						state: "error",
						className: MessageItem_module_css_default.turnErrorDot
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: MessageItem_module_css_default.turnErrorCopy,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: MessageItem_module_css_default.turnErrorTitle,
							children: node.code === "ACCOUNT_SIGNED_OUT" || node.code === "INTERRUPTED" ? t("message.taskStopped") : t("message.turnError")
						}), (0, react_jsx_runtime.jsx)("span", {
							className: MessageItem_module_css_default.turnErrorMessage,
							children: failureMessage(node.message, node.code, t)
						})]
					}),
					node.code !== void 0 && node.code !== "INTERRUPTED" && (0, react_jsx_runtime.jsx)("code", {
						className: MessageItem_module_css_default.turnErrorCode,
						children: node.code
					})
				]
			});
		}
		/** Persistent, turn-positioned notice for a turn ended at the output-token cap. */
		function TurnMaxTokensItem({ t }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MessageItem_module_css_default.turnErrorRow,
				role: "status",
				children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
					state: "warning",
					className: MessageItem_module_css_default.turnErrorDot
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: MessageItem_module_css_default.turnErrorCopy,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: MessageItem_module_css_default.maxTokensTitle,
						children: t("message.maxTokens")
					}), (0, react_jsx_runtime.jsx)("span", {
						className: MessageItem_module_css_default.turnErrorMessage,
						children: t("message.maxTokens.hint")
					})]
				})]
			});
		}
		/** Right-aligned bubble shared by user and steering rows. */
		function UserStyleBubble({ content, loadImage, renderFactorySlot, actions, pending = false, echo = false, referenceLabels, skillNames, previewAttachments, facts: inputFacts = EMPTY_TEXT_FACTS, interactive = false }) {
			const parts = (0, react.useMemo)(() => contentParts(content), [content]);
			const prepared = (0, react.useMemo)(() => ({
				text: parts.text,
				attachments: previewAttachments ?? parts.attachments,
				extraBlocks: parts.rest,
				...referenceLabels === void 0 ? {} : { referenceLabels }
			}), [
				parts,
				previewAttachments,
				referenceLabels
			]);
			const facts = (0, react.useMemo)(() => ({
				...inputFacts,
				...referenceLabels === void 0 ? {} : { sessionLabels: referenceLabels },
				...skillNames === void 0 ? {} : { skillNames }
			}), [
				inputFacts,
				referenceLabels,
				skillNames
			]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MessageItem_module_css_default.userRow,
				"data-pending-steering": pending || void 0,
				"data-submission-echo": echo || void 0,
				children: [renderFactorySlot("conversation.chat.user.content", {
					content: prepared,
					loadImage,
					facts,
					interactive
				}), actions?.(prepared.text)]
			});
		}
		/**
		* Render one Host-authoritative pending steering item with the same visual
		* language as its eventual durable transcript node.
		* @param props - pending content, authorized image loader, and Factory/locale seats.
		* @returns the pending steering bubble.
		*/
		function PendingSteeringBubble({ content, loadImage, renderFactorySlot, t }) {
			return (0, react_jsx_runtime.jsx)(UserStyleBubble, {
				content,
				renderFactorySlot,
				loadImage,
				pending: true,
				actions: (text) => (0, react_jsx_runtime.jsx)(MessageIconActions, {
					text,
					clock: "start",
					className: MessageItem_module_css_default.actions,
					t
				})
			});
		}
		/**
		* Render one local transcript or steering submission echo with the same
		* visual language and surface marker as the Host occurrence that replaces
		* it: draft text plus object-URL previews, visible from the submit click
		* until the durable `user/message` or steering occurrence renders.
		* @param props - the pending submission, authorized image loader, and render seats.
		* @returns the echoed user bubble.
		*/
		function PendingSubmissionBubble({ submission, loadImage, renderFactorySlot, t }) {
			return (0, react_jsx_runtime.jsx)(UserStyleBubble, {
				content: (0, react.useMemo)(() => submission.text === "" ? [] : [{
					type: "text",
					text: submission.text
				}], [submission.text]),
				previewAttachments: (0, react.useMemo)(() => submission.attachments.map((attachment) => attachment.type === "image" ? {
					type: "image",
					image: { preview: {
						url: attachment.value.previewUrl,
						...attachment.value.name === void 0 ? {} : { name: attachment.value.name },
						...attachment.value.width === void 0 ? {} : { width: attachment.value.width },
						...attachment.value.height === void 0 ? {} : { height: attachment.value.height }
					} }
				} : {
					type: "file",
					file: attachment.value
				}), [submission.attachments]),
				renderFactorySlot,
				loadImage,
				pending: submission.placement === "steering",
				echo: true,
				actions: (text) => (0, react_jsx_runtime.jsx)(MessageIconActions, {
					text,
					time: submission.time,
					clock: "start",
					className: MessageItem_module_css_default.actions,
					t
				})
			});
		}
		/** User and admitted-steering keyed Chat renderer. */
		const UserMessageNodeView = (0, react.memo)(function UserMessageNodeView({ node, renderFactorySlot, loadImage, t }) {
			const data = node.data;
			return (0, react_jsx_runtime.jsx)(UserStyleBubble, {
				content: data.content,
				interactive: true,
				renderFactorySlot,
				loadImage,
				...data.referenceLabels === void 0 ? {} : { referenceLabels: data.referenceLabels },
				...data.skillNames === void 0 ? {} : { skillNames: data.skillNames },
				actions: (text) => (0, react_jsx_runtime.jsx)(MessageIconActions, {
					text,
					time: data.time,
					clock: "start",
					className: MessageItem_module_css_default.actions,
					t
				})
			});
		});
		/** Injected-context keyed Chat renderer. */
		const ContextMessageNodeView = (0, react.memo)(function ContextMessageNodeView({ node, t }) {
			const data = node.data;
			return (0, react_jsx_runtime.jsx)(ContextInjectionRow, {
				content: data.content,
				source: data.source,
				producer: data.producer,
				form: data.form,
				t
			});
		});
		/** Automatic compaction keyed Chat renderer. */
		const CompactionNodeView = (0, react.memo)(function CompactionNodeView({ node, t }) {
			return (0, react_jsx_runtime.jsx)(CompactionItem, {
				node: node.data,
				t
			});
		});
		/** Correlated retry-chain keyed Chat renderer. */
		const RetryNodeView = (0, react.memo)(function RetryNodeView({ node, t }) {
			const data = node.data;
			return (0, react_jsx_runtime.jsx)(ModelRetryItem, {
				node: data.current,
				active: data.current.retryState === "scheduled",
				t
			});
		});
		/** Terminal turn-error keyed Chat renderer. */
		const TurnErrorNodeView = (0, react.memo)(function TurnErrorNodeView({ node, t }) {
			return (0, react_jsx_runtime.jsx)(TurnErrorItem, {
				node: node.data,
				t
			});
		});
		/** Max-tokens turn-end notice keyed Chat renderer. */
		const TurnMaxTokensNodeView = (0, react.memo)(function TurnMaxTokensNodeView({ t }) {
			return (0, react_jsx_runtime.jsx)(TurnMaxTokensItem, { t });
		});
		/** Explicit unknown-surface keyed Chat renderer. */
		const UnknownNodeView = (0, react.memo)(function UnknownNodeView({ node, t }) {
			const data = node.data;
			return (0, react_jsx_runtime.jsx)("div", {
				className: MessageItem_module_css_default.contextRow,
				children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonBlock, {
					label: t("message.unknownSurface", { type: data.type }),
					payload: data.data,
					truncatedLabel: (total) => t("json.truncated", { total })
				})
			});
		});
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/accessibility.module.css.mjs
		const css$10 = ".TTCZqG_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}";
		const tagId$10 = "@deepseek-ai/dsh-client-ui-chat/accessibility.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$10) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$10;
			tag.textContent = css$10;
			document.head.appendChild(tag);
		}
		var accessibility_module_css_default = { "visuallyHidden": "TTCZqG_visuallyHidden" };
		//#endregion
		//#region lib/types/client/chat/RunningStatus.js
		/** Running Turn clock isolated from the transcript's render cycle. */
		/**
		* Show live elapsed time after the current Turn's content without announcing ticks.
		* @param props - Current Turn start time and localized copy.
		* @returns the blue running indicator; mount only while the Session is running.
		*/
		const RunningStatus = (0, react.memo)(function RunningStatus({ startTime, t }) {
			const [now, setNow] = (0, react.useState)(Date.now);
			(0, react.useEffect)(() => {
				if (startTime === void 0) return;
				setNow(Date.now());
				const timer = setInterval(() => {
					setNow(Date.now());
				}, LIVE_RUN_CLOCK_INTERVAL_MS);
				return () => {
					clearInterval(timer);
				};
			}, [startTime]);
			const label = startTime === void 0 ? t("chat.deepDiving") : t("chat.deepDivingFor", { duration: formatRunDuration(Math.max(1e3, now - startTime), t).map((part) => part.text).join("") });
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ChatView_module_css_default.running,
				"data-chat-running": true,
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: accessibility_module_css_default.visuallyHidden,
						role: "status",
						"aria-live": "polite",
						"aria-atomic": "true",
						children: t("chat.deepDiving")
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: ChatView_module_css_default.runningDivider,
						"aria-hidden": "true"
					}),
					(0, react_jsx_runtime.jsxs)("span", {
						className: ChatView_module_css_default.runningContent,
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, {
							active: true,
							className: ChatView_module_css_default.runningText,
							children: label
						})]
					})
				]
			});
		});
		//#endregion
		//#region lib/types/client/chat/ChatFlow.js
		/** Ordered Chat rows, local echoes, and running status share the flow slot's parent. */
		/** Render the flow without adding a DOM parent or changing keyed row positions. */
		const ChatFlow = (0, react.memo)(function ChatFlow({ entries, pendingInputs, lastInputTurn, deferCollapse, useSession, useChat, useChatNode, useChatNodeBottom, useChatNodeProcess, useChatGroup, usePresentation, useStore, actions, renderSlot, renderFactorySlot, t, useGroupAction, useGroupHeaderAction, cwd, openFile, inspectCall, forkAt, loadImage, fileMentions }) {
			const nodeStore = useChat((snapshot) => snapshot.nodes);
			const running = useSession((snapshot) => snapshot.running);
			const runningStartTime = useChatNode(useChat((snapshot) => snapshot.navigation.items().at(-1)?.anchorKey) ?? "", (node) => {
				const location = node?.location;
				return location?.kind === "turn" || location?.kind === "step" ? location.turn.status === "open" ? location.turn.start?.time : void 0 : void 0;
			});
			const seatProps = {
				nodeStore,
				useChatNode,
				useChatNodeBottom,
				useChatNodeProcess,
				usePresentation,
				useStore,
				actions,
				renderSlot,
				t,
				useGroupAction,
				deferCollapse,
				cwd,
				openFile,
				inspectCall,
				forkAt,
				loadImage,
				fileMentions
			};
			const rows = entries.map((entry) => {
				switch (entry.kind) {
					case "node": return (0, react.createElement)(ChatNodeSeat, {
						...seatProps,
						key: chatRenderKey(entry),
						nodeKey: entry.key,
						...entry.groupPart === void 0 ? {} : { groupPart: entry.groupPart }
					});
					case "group": return (0, react.createElement)(ChatGroupSeat, {
						...seatProps,
						key: chatRenderKey(entry),
						groupKey: entry.key,
						useChatGroup,
						useGroupHeaderAction
					});
					default: return assertNever(entry);
				}
			});
			const pendingRows = pendingInputs.map((item) => "requestId" in item ? (0, react_jsx_runtime.jsx)(PendingSubmissionBubble, {
				submission: item,
				loadImage,
				renderFactorySlot,
				t
			}, item.requestId) : (0, react_jsx_runtime.jsx)(PendingSteeringBubble, {
				content: item.content,
				loadImage,
				renderFactorySlot,
				t
			}, item.id));
			const tail = entries.at(-1);
			const node = tail?.kind === "node" ? nodeStore.get(tail.key) : void 0;
			if (node?.kind === "turn-process" && node.location.kind === "turn" && node.location.turn.status === "open" && node.location.turn.turn !== lastInputTurn) {
				const index = pendingInputs.findIndex((item) => "requestId" in item && item.placement === "transcript");
				if (index !== -1) rows.splice(rows.length - 1, 0, ...pendingRows.splice(index, 1));
			}
			return [
				...rows,
				...pendingRows,
				...running ? [(0, react_jsx_runtime.jsx)(RunningStatus, {
					startTime: runningStartTime,
					t
				}, "running")] : []
			];
		});
		//#endregion
		//#region lib/types/client/locale.js
		/** Chat-owned locale namespace and dictionaries. */
		/** Namespace for Chat target, node, statistics, and details copy. */
		const NS = "chat";
		/** Simplified Chinese dictionary and key-set source of truth. */
		const zh = {
			"message.stepProcess.thinking": "正在分析请求",
			"message.stepProcess.read": "正在读取文件",
			"message.stepProcess.readImage": "正在读取图片",
			"message.stepProcess.write": "正在写入文件",
			"message.stepProcess.search": "正在搜索代码",
			"message.stepProcess.edit": "正在编辑文件",
			"message.stepProcess.commands": "正在运行命令",
			"message.stepProcess.code": "正在运行代码",
			"message.stepProcess.webSearch": "正在搜索网页",
			"message.stepProcess.webFetch": "正在访问网页",
			"message.stepProcess.subagents": "正在协调子智能体",
			"message.stepProcess.plan": "正在更新计划",
			"message.stepProcess.questions": "等待你的操作",
			"message.stepProcess.tools": "正在调用工具",
			"message.stepProcess.prepare.read": "准备读取文件",
			"message.stepProcess.prepare.readImage": "准备读取图片",
			"message.stepProcess.prepare.write": "准备写入文件",
			"message.stepProcess.prepare.search": "准备搜索代码",
			"message.stepProcess.prepare.edit": "准备编辑文件",
			"message.stepProcess.prepare.commands": "准备运行命令",
			"message.stepProcess.prepare.code": "准备运行代码",
			"message.stepProcess.prepare.webSearch": "准备搜索网页",
			"message.stepProcess.prepare.webFetch": "准备访问网页",
			"message.stepProcess.prepare.subagents": "准备协调子智能体",
			"message.stepProcess.prepare.plan": "准备更新计划",
			"message.stepProcess.prepare.questions": "准备提问",
			"message.stepProcess.prepare.tools": "准备调用工具",
			"message.stepProcess.done.thinking": "已完成分析",
			"message.stepProcess.done.read": "已读取文件",
			"message.stepProcess.done.readImage": "已读取图片",
			"message.stepProcess.done.write": "已写入文件",
			"message.stepProcess.done.search": "已搜索代码",
			"message.stepProcess.done.edit": "修改了文件",
			"message.stepProcess.done.commands": "执行了命令",
			"message.stepProcess.done.code": "运行了代码",
			"message.stepProcess.done.webSearch": "已搜索网页",
			"message.stepProcess.done.webFetch": "已访问网页",
			"message.stepProcess.done.subagents": "已协调子智能体",
			"message.stepProcess.done.plan": "更新了计划",
			"message.stepProcess.done.questions": "向用户提出了问题",
			"message.stepProcess.done.tools": "已调用工具",
			"message.stepProcess.joinTwo": "{first}并{second}",
			"message.stepProcess.comma": "，",
			"message.stepProcess.sharedPrefix": "已",
			"message.stepProcess.more": "{title}等",
			"message.trigger.request": "收到执行请求",
			"message.trigger.goal": "继续执行目标",
			"message.trigger.agent": "收到任务消息",
			"message.trigger.team": "收到团队消息",
			"message.trigger.subagent": "子任务状态更新",
			"message.trigger.github": "收到 GitHub 事件",
			"message.trigger.webhook": "收到外部事件",
			"message.trigger.schedule": "自动化任务",
			"message.trigger.job": "后台任务状态更新",
			"message.trigger.plugin": "插件状态更新",
			"message.trigger.explanation": "这条通知触发了本轮回复。",
			"message.turnProcess.worked": "已完成",
			"message.turnProcess.took": "已完成，用时 ",
			"message.turnProcess.failed": "处理失败",
			"view.chat": "对话",
			"image.open": "查看大图",
			"image.loading": "加载图片…",
			"image.failed": "图片无法预览",
			"image.dialog": "图片预览",
			"image.close": "关闭图片预览",
			"number.groupSeparator": ",",
			"duration.compactSeconds": "{seconds}秒",
			"duration.compactMinutes": "{minutes}分{seconds}秒",
			"duration.milliseconds": "{milliseconds}毫秒",
			"stats.counts": "{turns} 轮 {steps} 步",
			"stats.cacheHit": "缓存命中 {percent}%",
			"stats.dialog.title": "会话统计",
			"stats.dialog.usageTitle": "Token 用量",
			"stats.dialog.llmTime": "模型用时",
			"stats.dialog.toolTime": "工具调用用时",
			"stats.dialog.ttft": "首 token 平均（TTFT）",
			"stats.dialog.speed": "输出速度（TPS）",
			"chat.loadingHistory": "载入历史…",
			"chat.loadError": "历史加载失败：{message}（{code}）",
			"chat.loadOlder": "加载更早",
			"chat.toBottom": "回到底部",
			"chat.deepDiving": "深度求索中",
			"chat.deepDivingFor": "深度求索中，用时 {duration} ···",
			"chat.turnNavigation.label": "轮次导航",
			"chat.turnNavigation.jump": "跳转到第 {turn} 轮",
			"chat.turnNavigation.jumpLoad": "加载并跳转到第 {turn} 轮",
			"chat.turnNavigation.turn": "第 {turn} 轮",
			"settings.performance.title": "性能与用量",
			"settings.performance.description": "选择性能与用量信息展示的详细程度",
			"settings.performance.compact": "简洁",
			"settings.performance.detailed": "详细",
			"settings.links.title": "网页链接默认打开方式",
			"settings.links.description": "对话中网页链接的打开位置",
			"settings.links.sidebar": "应用内侧边栏",
			"settings.links.newTab": "默认浏览器",
			"settings.transcript.title": "工作步骤展示",
			"settings.transcript.description": "选择希望看到多少工具调用细节",
			"settings.collapse.title": "工作步骤收起时机",
			"settings.collapse.description": "选择何时自动收起工作步骤",
			"settings.collapse.completion": "回答结束后",
			"settings.collapse.nextInput": "下次有新消息时",
			"settings.transcript.compact": "简洁",
			"settings.transcript.standard": "标准",
			"settings.transcript.detailed": "详细",
			"settings.transcript.verbose": "完全展开",
			"fileOpen.title": "无法打开文件",
			"fileOpen.unknown": "无法打开此文件",
			"message.extraBlock": "附加内容块",
			"message.systemPrompt": "系统提示词",
			"message.systemPromptUpdate": "系统提示词更新",
			"message.toolAdded": "已添加工具：{name}",
			"message.toolRemoved": "已移除工具：{name}",
			"message.toolsAdded": "新增：{names}",
			"message.toolsAddedCount": "新增 {count} 个",
			"message.toolsChanged": "新增 {added} 个，移除 {removed} 个",
			"message.toolsRemoved": "移除：{names}",
			"message.toolsRemovedCount": "移除 {count} 个",
			"message.toolsUpdated": "工具已更新",
			"message.contextInjection": "上下文注入",
			"message.contextRecall": "跨会话召回",
			"message.referenceSummary": "引用会话 · {labels}",
			"message.referenceSeparator": "、",
			"message.context.instructions.loaded": "已载入",
			"message.context.instructions.added": "已新增",
			"message.context.instructions.updated": "已更新",
			"message.context.instructions.removed": "已移除",
			"message.context.catalog.replaced": "替换目录",
			"message.context.catalog.more": "…还有 {count} 条",
			"message.context.snapshot.supersedes": "取代先前的快照",
			"message.context.relay.from": "来自会话 {session}",
			"message.context.recall.counts": "保留 {retained} 条 · 省略 {omitted} 条",
			"message.context.recall.truncated": "已截断",
			"message.compaction": "上下文已压缩",
			"message.compaction.running": "正在压缩…",
			"message.compaction.completed": "已压缩 {items} 条历史记录（约 {tokens} tokens）",
			"message.compaction.expand": "点击查看压缩摘要",
			"message.compaction.unavailable": "压缩摘要不可用",
			"message.compaction.commandTitle": "compact",
			"message.think": "思考",
			"message.unknownSurface": "未知 surface 事件：{type}",
			"message.unknownBlock": "未知内容块",
			"message.turnProcess.toolCalls.one": "{count} 次工具调用",
			"message.turnProcess.toolCalls.other": "{count} 次工具调用",
			"message.turnProcess.messages.one": "{count} 条消息",
			"message.turnProcess.messages.other": "{count} 条消息",
			"message.turnProcess.subagents.one": "{count} 个 subagent",
			"message.turnProcess.subagents.other": "{count} 个 subagent",
			"message.turnProcess.thoughtForAWhile": "已思考",
			"message.turnProcess.separator": " · ",
			"message.stopped": "已停止",
			"message.branch": "在新对话中分支",
			"message.branchUnavailable": "仅可从已完成轮次的最后一条消息分支",
			"message.retry.active": "正在重试模型请求",
			"message.retry.cancelled": "模型请求重试已取消",
			"message.retry.started": "已重试模型请求",
			"message.retry.scheduled": "等待重试模型请求",
			"message.retry.status": "{label}（{retry}/{maximum}） · {seconds}s",
			"message.retry.delay": "重试延迟：",
			"message.retry.failure": "失败原因：",
			"message.failure.auth": "API 密钥无效",
			"message.taskStopped": "任务已停止",
			"message.failure.accountSignedOut": "任务已因退出 DeepSeek 登录而停止。",
			"message.failure.interrupted": "DSH 进程在本轮完成前退出（例如被强制结束、崩溃或关闭超时），重新启动后本轮已中止。未完成的工具调用结果未知。",
			"message.failure.accountSignInRequired": "请先登录 DeepSeek，并确认请求地址支持账号认证。",
			"message.failure.quota": "当前请求的额度已用尽",
			"message.turnError": "本轮运行失败",
			"message.maxTokens": "已达到输出 token 上限",
			"message.maxTokens.hint": "回答被截断，已有输出保留在对话中。发送“继续”可让模型接着输出。",
			"message.tokensPerSecond": "{tps} tok/s",
			"message.turnUsage.title": "本轮用量",
			"message.turnUsage.consumed": "用量 {total}",
			"message.turnUsage.model": "提供方 / 模型",
			"message.turnUsage.cacheHit": "缓存命中",
			"message.turnUsage.input": "未缓存输入",
			"message.turnUsage.cacheRead": "缓存读取",
			"message.turnUsage.cacheWrite": "缓存写入",
			"message.turnUsage.output": "输出",
			"message.turnUsage.reasoning": "（其中推理 {tokens}）",
			"message.turnUsage.count": "{count} tok",
			"duration.secondUnit": "秒",
			"duration.minuteUnit": "分",
			"duration.hourUnit": "小时",
			"command.running": "执行中…",
			"command.failed": "指令失败",
			"command.done": "已完成",
			"command.title": "指令",
			"row.running": "运行中",
			"row.failed": "失败",
			"json.truncated": "… 已截断，共 {total} 字符",
			"clock.md": "{m}月{d}日",
			"clock.ymd": "{y}年{m}月{d}日"
		};
		/** English dictionary, checked against the Chinese key set. */
		const en = {
			"message.stepProcess.thinking": "Analyzing the request",
			"message.stepProcess.read": "Reading files",
			"message.stepProcess.readImage": "Reading images",
			"message.stepProcess.write": "Writing files",
			"message.stepProcess.search": "Searching code",
			"message.stepProcess.edit": "Editing files",
			"message.stepProcess.commands": "Running commands",
			"message.stepProcess.code": "Running code",
			"message.stepProcess.webSearch": "Searching the web",
			"message.stepProcess.webFetch": "Visiting web pages",
			"message.stepProcess.subagents": "Coordinating subagents",
			"message.stepProcess.plan": "Updating the plan",
			"message.stepProcess.questions": "Waiting for your action",
			"message.stepProcess.tools": "Calling tools",
			"message.stepProcess.prepare.read": "Preparing to read files",
			"message.stepProcess.prepare.readImage": "Preparing to read images",
			"message.stepProcess.prepare.write": "Preparing to write files",
			"message.stepProcess.prepare.search": "Preparing to search code",
			"message.stepProcess.prepare.edit": "Preparing to edit files",
			"message.stepProcess.prepare.commands": "Preparing to run commands",
			"message.stepProcess.prepare.code": "Preparing to run code",
			"message.stepProcess.prepare.webSearch": "Preparing to search the web",
			"message.stepProcess.prepare.webFetch": "Preparing to visit web pages",
			"message.stepProcess.prepare.subagents": "Preparing to coordinate subagents",
			"message.stepProcess.prepare.plan": "Preparing to update the plan",
			"message.stepProcess.prepare.questions": "Preparing questions",
			"message.stepProcess.prepare.tools": "Preparing tool calls",
			"message.stepProcess.done.thinking": "Analysis completed",
			"message.stepProcess.done.read": "Read files",
			"message.stepProcess.done.readImage": "Read images",
			"message.stepProcess.done.write": "Wrote files",
			"message.stepProcess.done.search": "Searched code",
			"message.stepProcess.done.edit": "Edited files",
			"message.stepProcess.done.commands": "Ran commands",
			"message.stepProcess.done.code": "Ran code",
			"message.stepProcess.done.webSearch": "Searched the web",
			"message.stepProcess.done.webFetch": "Visited web pages",
			"message.stepProcess.done.subagents": "Coordinated subagents",
			"message.stepProcess.done.plan": "Updated the plan",
			"message.stepProcess.done.questions": "Asked questions",
			"message.stepProcess.done.tools": "Called tools",
			"message.stepProcess.joinTwo": "{first} and {second}",
			"message.stepProcess.comma": ", ",
			"message.stepProcess.sharedPrefix": "",
			"message.stepProcess.more": "{title}, etc.",
			"message.trigger.request": "Execution requested",
			"message.trigger.goal": "Continuing goal",
			"message.trigger.agent": "Task message received",
			"message.trigger.team": "Team message received",
			"message.trigger.subagent": "Subtask status updated",
			"message.trigger.github": "GitHub event received",
			"message.trigger.webhook": "External event received",
			"message.trigger.schedule": "Automation task",
			"message.trigger.job": "Background task updated",
			"message.trigger.plugin": "Plugin status updated",
			"message.trigger.explanation": "This notification triggered this response.",
			"message.turnProcess.worked": "Completed",
			"message.turnProcess.took": "Completed in ",
			"message.turnProcess.failed": "Failed",
			"view.chat": "Chat",
			"image.open": "View full image",
			"image.loading": "Loading image…",
			"image.failed": "Image preview unavailable",
			"image.dialog": "Image preview",
			"image.close": "Close image preview",
			"number.groupSeparator": ",",
			"duration.compactSeconds": "{seconds}s",
			"duration.compactMinutes": "{minutes}m{seconds}s",
			"duration.milliseconds": "{milliseconds}ms",
			"stats.counts": "{turns} turns {steps} steps",
			"stats.cacheHit": "Cache hit {percent}%",
			"stats.dialog.title": "Session statistics",
			"stats.dialog.usageTitle": "Token usage",
			"stats.dialog.llmTime": "LLM time",
			"stats.dialog.toolTime": "Tool time",
			"stats.dialog.ttft": "Avg time to first token (TTFT)",
			"stats.dialog.speed": "Tokens per second (TPS)",
			"chat.loadingHistory": "Loading history…",
			"chat.loadError": "Failed to load history: {message} ({code})",
			"chat.loadOlder": "Load earlier",
			"chat.toBottom": "Back to bottom",
			"chat.deepDiving": "Deep diving",
			"chat.deepDivingFor": "Deep diving for {duration} ···",
			"chat.turnNavigation.label": "Turn navigation",
			"chat.turnNavigation.jump": "Jump to turn {turn}",
			"chat.turnNavigation.jumpLoad": "Load and jump to turn {turn}",
			"chat.turnNavigation.turn": "Turn {turn}",
			"settings.performance.title": "Performance & usage",
			"settings.performance.description": "Choose how much performance and usage information to show",
			"settings.performance.compact": "Compact",
			"settings.performance.detailed": "Detailed",
			"settings.links.title": "Open chat links in",
			"settings.links.description": "Choose where to open web links",
			"settings.links.sidebar": "In-App Sidebar",
			"settings.links.newTab": "Default Browser",
			"settings.transcript.title": "Work details",
			"settings.transcript.description": "Choose how much detail to show for tool calls",
			"settings.collapse.title": "When to Collapse Work Details",
			"settings.collapse.description": "Choose when to automatically collapse work details",
			"settings.collapse.completion": "On completion",
			"settings.collapse.nextInput": "On next message",
			"settings.transcript.compact": "Compact",
			"settings.transcript.standard": "Standard",
			"settings.transcript.detailed": "Detailed",
			"settings.transcript.verbose": "Verbose",
			"fileOpen.title": "Couldn’t open file",
			"fileOpen.unknown": "Couldn’t open this file",
			"message.extraBlock": "Extra content block",
			"message.systemPrompt": "System prompt",
			"message.systemPromptUpdate": "System prompt update",
			"message.toolAdded": "Tool added: {name}",
			"message.toolRemoved": "Tool removed: {name}",
			"message.toolsAdded": "Added: {names}",
			"message.toolsAddedCount": "{count} added",
			"message.toolsChanged": "{added} added, {removed} removed",
			"message.toolsRemoved": "Removed: {names}",
			"message.toolsRemovedCount": "{count} removed",
			"message.toolsUpdated": "Tools updated",
			"message.contextInjection": "Context injection",
			"message.contextRecall": "Session recall",
			"message.referenceSummary": "Referenced session · {labels}",
			"message.referenceSeparator": ", ",
			"message.context.instructions.loaded": "loaded",
			"message.context.instructions.added": "added",
			"message.context.instructions.updated": "updated",
			"message.context.instructions.removed": "removed",
			"message.context.catalog.replaced": "Replacement catalog",
			"message.context.catalog.more": "… {count} more",
			"message.context.snapshot.supersedes": "Supersedes earlier snapshots",
			"message.context.relay.from": "From session {session}",
			"message.context.recall.counts": "{retained} kept · {omitted} omitted",
			"message.context.recall.truncated": "truncated",
			"message.compaction": "Context compacted",
			"message.compaction.running": "Compacting context…",
			"message.compaction.completed": "Compacted {items} history items (~{tokens} tokens)",
			"message.compaction.expand": "View compaction summary",
			"message.compaction.unavailable": "Compaction summary unavailable",
			"message.compaction.commandTitle": "compact",
			"message.think": "Think",
			"message.unknownSurface": "Unknown surface event: {type}",
			"message.unknownBlock": "Unknown content block",
			"message.turnProcess.toolCalls.one": "{count} tool call",
			"message.turnProcess.toolCalls.other": "{count} tool calls",
			"message.turnProcess.messages.one": "{count} message",
			"message.turnProcess.messages.other": "{count} messages",
			"message.turnProcess.subagents.one": "{count} subagent",
			"message.turnProcess.subagents.other": "{count} subagents",
			"message.turnProcess.thoughtForAWhile": "Thought for a while",
			"message.turnProcess.separator": " · ",
			"message.stopped": "Stopped",
			"message.branch": "Branch into a new conversation",
			"message.branchUnavailable": "Available only on the last message of a completed turn",
			"message.retry.active": "Retrying model request",
			"message.retry.cancelled": "Model request retry cancelled",
			"message.retry.started": "Retried model request",
			"message.retry.scheduled": "Waiting to retry model request",
			"message.retry.status": "{label} ({retry}/{maximum}) · {seconds}s",
			"message.retry.delay": "Retry delay: ",
			"message.retry.failure": "Failure reason: ",
			"message.failure.auth": "API key is invalid",
			"message.taskStopped": "Task stopped",
			"message.failure.accountSignedOut": "Stopped because you signed out of DeepSeek.",
			"message.failure.interrupted": "The DSH process exited before this turn finished (for example, it was killed, crashed, or timed out while shutting down), so the turn was closed when DSH restarted. Unfinished tool calls have unknown outcomes.",
			"message.failure.accountSignInRequired": "Sign in to DeepSeek and ensure the request destination supports account authentication.",
			"message.failure.quota": "Request quota exhausted.",
			"message.turnError": "This turn failed",
			"message.maxTokens": "Output token limit reached",
			"message.maxTokens.hint": "The reply was cut off; earlier output is preserved in the conversation. Send \"continue\" to let the model resume.",
			"message.tokensPerSecond": "{tps} tok/s",
			"message.turnUsage.title": "Turn usage",
			"message.turnUsage.consumed": "Usage {total}",
			"message.turnUsage.model": "Provider / model",
			"message.turnUsage.cacheHit": "Cache hit",
			"message.turnUsage.input": "Uncached input",
			"message.turnUsage.cacheRead": "Cached input",
			"message.turnUsage.cacheWrite": "Cache write",
			"message.turnUsage.output": "Output",
			"message.turnUsage.reasoning": " ({tokens} reasoning)",
			"message.turnUsage.count": "{count} tok",
			"duration.secondUnit": "s",
			"duration.minuteUnit": "m ",
			"duration.hourUnit": "h ",
			"command.running": "Running…",
			"command.failed": "Command failed",
			"command.done": "Completed",
			"command.title": "Command",
			"row.running": "Running",
			"row.failed": "Failed",
			"json.truncated": "… truncated, {total} characters total",
			"clock.md": "{m}/{d}",
			"clock.ymd": "{y}-{m}-{d}"
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/ReasoningRow.module.css.mjs
		const css$9 = ".lcKema_root{flex-direction:column;display:flex}.lcKema_root:not([data-expanded]){contain:size layout;height:calc(24px + var(--dsh-content-font-delta,0px))}.lcKema_row{overflow:hidden}.lcKema_root[data-expanded] [data-open] [data-disclosure-header]{z-index:1;background:var(--dsw-alias-bg-base);position:sticky;top:0}.lcKema_leading{flex-shrink:0}.lcKema_title{font-weight:400}.lcKema_separator{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.lcKema_summary{min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));white-space:nowrap;flex:auto;overflow:hidden}.lcKema_summaryText{text-overflow:ellipsis;display:block;overflow:hidden}.lcKema_summary[data-streaming]{mask-image:linear-gradient(90deg,#000 calc(100% - 48px),#0000)}.lcKema_summary[data-streaming] .lcKema_summaryText{text-overflow:clip;overflow:visible}.lcKema_root:not([data-preview]) .lcKema_separator,.lcKema_root:not([data-preview]) .lcKema_summary{display:none}.lcKema_thinkBody{padding:4px 0 4px calc(22px + var(--dsh-content-font-delta,0px));min-width:0}";
		const tagId$9 = "@deepseek-ai/dsh-client-ui-chat/ReasoningRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$9) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$9;
			tag.textContent = css$9;
			document.head.appendChild(tag);
		}
		var ReasoningRow_module_css_default = {
			"leading": "lcKema_leading",
			"root": "lcKema_root",
			"row": "lcKema_row",
			"separator": "lcKema_separator",
			"summary": "lcKema_summary",
			"summaryText": "lcKema_summaryText",
			"thinkBody": "lcKema_thinkBody",
			"title": "lcKema_title"
		};
		//#endregion