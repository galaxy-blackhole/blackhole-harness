/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
										onClick: () => {
											replaceProgress(index + 1, drafts);
											setError(null);
										},
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
									})
								]
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: QuestionComposer_module_css_default.feedback,
								role: "status",
								children: error === null ? null : "key" in error ? t(error.key) : error.text
							}),
							review === void 0 && (0, react_jsx_runtime.jsxs)("div", {
								className: QuestionComposer_module_css_default.footerActions,
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									disabled: busy !== null,
									onClick: skipQuestion,
									children: t("action.skip")
								}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									disabled: busy !== null || !answered(draft) || index === questions.length - 1 && !canSubmit,
									onClick: continueFlow,
									children: busy === "answer" ? t("submitting") : index === questions.length - 1 ? t("submit") : t("action.next")
								})]
							})
						]
					})] })]
				})
			});
		}
		//#endregion
		//#region ../../core/session/src/surface.ts
		/** Runtime counterpart of the message-producing event union. */
		const SURFACE_EVENT_TYPES = new Set([
			"system/message",
			"developer/message",
			"user/message",
			"assistant/message",
			"tool/result"
		]);
		/**
		* Narrow an event to a surface-eligible event carrying its required marker.
		* @param event - event to test.
		* @returns true when both the type and marker identify a surface event.
		*/
		function isSurfaceEvent(event) {
			if (!SURFACE_EVENT_TYPES.has(event.type)) return false;
			return event.surfaceOp !== void 0;
		}
		/**
		* Narrow an event to an append-origin surface event: one that entered the
		* surface at its own log position and was never itself a replacement copy.
		*
		* The model-visible surface deliberately shadows replaced ranges, so it is the
		* wrong source for a human transcript — a landed replacement would erase
		* conversation the user already saw. Append-origin events are that transcript's
		* durable source material; replacement copies stay model-only.
		* @param event - event to test.
		* @returns true when the event appended to the surface tail.
		*/
		function isAppendSurfaceEvent(event) {
			return isSurfaceEvent(event) && event.surfaceOp === "append";
		}
		//#endregion
		//#region lib/types/client/question-reply.js
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/**
		* Read the question and answer pairs out of the reply text at the conversation boundary.
		* @param text - Model-facing JSON payload of the steered message.
		* @returns The pairs, or empty lists when the payload is unreadable.
		*/
		function replyPairsOf(text) {
			let value;
			try {
				value = JSON.parse(text);
			} catch (error) {
				return {
					questions: [],
					answers: []
				};
			}
			if (!isRecord(value) || !Array.isArray(value.questions)) return {
				questions: [],
				answers: []
			};
			const questions = [];
			for (const question of value.questions) {
				if (!isRecord(question) || typeof question.id !== "string" || typeof question.question !== "string") continue;
				questions.push({
					id: question.id,
					question: question.question,
					...typeof question.detail === "string" ? { detail: question.detail } : {},
					...typeof question.header === "string" ? { header: question.header } : {},
					...Array.isArray(question.options) ? { options: question.options.flatMap((option) => {
						if (!isRecord(option) || typeof option.label !== "string") return [];
						return [{
							label: option.label,
							...typeof option.description === "string" ? { description: option.description } : {}
						}];
					}) } : {},
					...typeof question.multiSelect === "boolean" ? { multiSelect: question.multiSelect } : {}
				});
			}
			const answers = [];
			for (const answer of Array.isArray(value.answers) ? value.answers : []) {
				if (!isRecord(answer) || typeof answer.id !== "string" || !Array.isArray(answer.selected)) continue;
				answers.push({
					id: answer.id,
					selected: answer.selected.filter((item) => typeof item === "string"),
					...typeof answer.custom === "string" ? { custom: answer.custom } : {}
				});
			}
			return {
				questions,
				answers
			};
		}
		/**
		* Answer values of one question in display order: the selected option labels
		* followed by a non-blank custom answer.
		* @param data - Projected reply holding the recorded answers.
		* @param id - Question id to read.
		* @returns The values, empty when the user skipped that question.
		*/
		function replyAnswerValues(data, id) {
			const answer = data.answers.find((item) => item.id === id);
			const custom = answer?.custom?.trim() ?? "";
			return [...answer?.selected ?? [], ...custom === "" ? [] : [custom]];
		}
		/**
		* Clipboard text of one late reply: every question with the answer the user
		* gave, in the layout the open bubble shows, without the options nobody chose.
		* The text does not depend on whether the bubble is open.
		* @param data - Projected reply to copy.
		* @param t - Bound `question` namespace translator owning the answer labels.
		* @returns One block per question, or the model-facing text when the payload was unreadable.
		*/
		function replyClipboardText(data, t) {
			if (data.questions.length === 0) return data.text;
			return data.questions.map((question) => {
				const values = replyAnswerValues(data, question.id);
				return `${question.header && question.header !== question.question ? `${question.header} — ${question.question}` : question.question}\n${values.length === 0 ? t("reply.skipped") : `${t("reply.answerLabel")}${values.join(", ")}`}`;
			}).join("\n\n");
		}
		/** Validate a late reply source at the persisted conversation boundary. */
		function replySource(event) {
			const source = event.data.source;
			return isRecord(source) && source.kind === "user-question-reply" && typeof source.callId === "string" && source.outcome === "answered" ? {
				callId: source.callId,
				outcome: "answered"
			} : null;
		}
		/**
		* Late-reply projection owned by the questions UI. It claims the reply message
		* on the Chat target, so the generic message Definition never presents it.
		*/
		const questionReplyDefinition = {
			kind: "user-question-reply",
			target: "chat",
			match: (event) => {
				if (event.type !== "user/message" || !isAppendSurfaceEvent(event)) return null;
				return replySource(event) === null ? null : {
					id: String(event.data.id),
					role: "start",
					exclusive: true
				};
			},
			start: (_context, match) => {
				if (match.event.type !== "user/message") throw new Error("user-question-reply start requires user/message");
				const event = match.event;
				const text = event.data.content.find((item) => item.type === "text")?.text ?? "";
				const source = replySource(event);
				if (source === null) throw new Error("user-question-reply start requires a reply source");
				return {
					seq: event.seq,
					time: event.time,
					callId: source.callId,
					outcome: source.outcome,
					text,
					...replyPairsOf(text)
				};
			},
			update: (context) => context.state,
			buildViewNode: (context) => {
				if (context.state === void 0) return null;
				const { seq, ...data } = context.state;
				return {
					key: context.key,
					kind: "question-reply",
					id: context.id,
					target: "chat",
					anchorSeq: seq,
					location: context.start?.location ?? { kind: "unresolved" },
					visibility: "visible",
					data
				};
			}
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-user-questions/src/client/QuestionReplyView.module.css.mjs
		const css = ".ROF66W_row{flex-direction:column;justify-content:flex-end;align-items:flex-end;gap:6px;padding:4px 0;display:flex}.ROF66W_bubble{border-radius:var(--dsw-radius-xl);background:var(--dsw-specific-bubble);max-width:72%;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:var(--dsh-content-font-size,14px);line-height:calc(22px + var(--dsh-content-font-delta,0px));text-align:left;overflow-wrap:anywhere;white-space:pre-wrap;padding:10px 16px}.ROF66W_toggle{width:100%;color:inherit;cursor:pointer;font:inherit;text-align:left;background:0 0;border:0;padding:0}.ROF66W_toggle:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.ROF66W_bubble:has(.ROF66W_toggle:focus-visible){box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}.ROF66W_labelRow{align-items:center;gap:3px;display:flex}.ROF66W_caret{color:var(--dsw-alias-label-secondary);display:inline-flex}.ROF66W_caret svg{width:12px;height:12px}.ROF66W_label{color:var(--dsw-alias-label-secondary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(18px + var(--dsh-content-font-delta-secondary,0px));display:block}.ROF66W_summary{color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size,14px);margin-top:3px;display:block}.ROF66W_text{margin:8px 0 0}.ROF66W_details{border-top:1px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 24%, transparent);margin:8px 0 0;padding-top:8px}.ROF66W_details>div+div{margin-top:12px}.ROF66W_details dt{color:var(--dsw-alias-label-secondary);font-size:12px}.ROF66W_question{gap:3px;display:grid}.ROF66W_header,.ROF66W_detail,.ROF66W_options{color:var(--dsw-alias-label-secondary);font-size:11px}.ROF66W_questionText{color:var(--dsw-alias-label-primary)}.ROF66W_options{margin:0;padding-left:16px}.ROF66W_details dd{margin:4px 0 0}.ROF66W_answer{font-size:14px}.ROF66W_answerLabel{color:var(--dsw-alias-label-secondary);margin-right:4px;font-size:12px}.ROF66W_actions{height:28px;color:var(--dsw-alias-label-tertiary);align-items:center;gap:8px;padding-right:4px;display:flex}.ROF66W_time{white-space:nowrap;padding-right:4px;font-size:13px;line-height:24px}.ROF66W_action{border-radius:var(--dsw-radius-sm);width:28px;height:28px;color:inherit;cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;padding:6px;display:inline-flex}.ROF66W_action svg{width:15px;height:15px}.ROF66W_action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}";
		const tagId = "@deepseek-ai/dsh-client-ui-user-questions/QuestionReplyView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-user-questions";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var QuestionReplyView_module_css_default = {
			"action": "ROF66W_action",
			"actions": "ROF66W_actions",
			"answer": "ROF66W_answer",
			"answerLabel": "ROF66W_answerLabel",
			"bubble": "ROF66W_bubble",
			"caret": "ROF66W_caret",
			"detail": "ROF66W_detail",
			"details": "ROF66W_details",
			"header": "ROF66W_header",
			"label": "ROF66W_label",
			"labelRow": "ROF66W_labelRow",
			"options": "ROF66W_options",
			"question": "ROF66W_question",
			"questionText": "ROF66W_questionText",
			"row": "ROF66W_row",
			"summary": "ROF66W_summary",
			"text": "ROF66W_text",
			"time": "ROF66W_time",
			"toggle": "ROF66W_toggle"
		};
		//#endregion
		//#region lib/types/client/QuestionReplyView.js
		/**
		* Right-aligned late-reply bubble: a label naming the earlier pending
		* questions, then one question and answer pair per question. A payload the
		* Client cannot read falls back to the model-facing text.
		*/
		const QuestionReplyView = (0, react.memo)(function QuestionReplyView({ node, t }) {
			return (0, react_jsx_runtime.jsx)(QuestionReplyBubble, {
				data: node.data,
				t
			});
		});
		/**
		* Render one settled question reply as a compact transcript bubble.
		* @param props - Reply data and the question locale translator.
		* @returns The expandable reply bubble.
		*/
		function QuestionReplyBubble({ data, t }) {
			const label = t("reply.label");
			const [open, setOpen] = (0, react.useState)(false);
			const toggleLabel = t(open ? "reply.close" : "reply.open");
			const summary = data.questions.map((question) => replyAnswerValues(data, question.id)).flat().join(", ");
			const copyText = replyClipboardText(data, t);
			const [copied, setCopied] = (0, react.useState)(false);
			const onCopy = (0, react.useCallback)(() => {
				if (copied) return;
				(0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(copyText).then((ok) => {
					if (!ok) return;
					setCopied(true);
					window.setTimeout(() => {
						setCopied(false);
					}, 1e3);
				});
			}, [copied, copyText]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: QuestionReplyView_module_css_default.row,
				"data-question-reply": data.callId,
				"data-reply-outcome": data.outcome,
				role: "group",
				"aria-label": label,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: QuestionReplyView_module_css_default.bubble,
					children: [(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: QuestionReplyView_module_css_default.toggle,
						"aria-expanded": open,
						"aria-label": `${label} · ${toggleLabel}`,
						onClick: () => {
							setOpen((value) => !value);
						},
						children: [(0, react_jsx_runtime.jsxs)("span", {
							className: QuestionReplyView_module_css_default.labelRow,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: QuestionReplyView_module_css_default.caret,
								"aria-hidden": "true",
								children: open ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
							}), (0, react_jsx_runtime.jsx)("span", {
								className: QuestionReplyView_module_css_default.label,
								children: label
							})]
						}), !open && (0, react_jsx_runtime.jsx)("span", {
							className: QuestionReplyView_module_css_default.summary,
							children: summary === "" ? t("reply.skipped") : summary
						})]
					}), open && (data.questions.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
						className: QuestionReplyView_module_css_default.text,
						children: data.text
					}) : (0, react_jsx_runtime.jsx)("dl", {
						className: QuestionReplyView_module_css_default.details,
						children: data.questions.map((question) => {
							const values = replyAnswerValues(data, question.id);
							return (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsxs)("dt", {
								className: QuestionReplyView_module_css_default.question,
								children: [
									question.header && question.header !== question.question && (0, react_jsx_runtime.jsx)("span", {
										className: QuestionReplyView_module_css_default.header,
										children: question.header
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: QuestionReplyView_module_css_default.questionText,
										children: question.question
									}),
									question.detail && (0, react_jsx_runtime.jsx)("span", {
										className: QuestionReplyView_module_css_default.detail,
										children: question.detail
									}),
									question.options && question.options.length > 0 && (0, react_jsx_runtime.jsx)("ul", {
										className: QuestionReplyView_module_css_default.options,
										children: question.options.map((option) => (0, react_jsx_runtime.jsxs)("li", { children: [option.label, option.description && ` — ${option.description}`] }, option.label))
									})
								]
							}), (0, react_jsx_runtime.jsxs)("dd", {
								className: QuestionReplyView_module_css_default.answer,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: QuestionReplyView_module_css_default.answerLabel,
									children: t("reply.answerLabel")
								}), values.length === 0 ? t("reply.skipped") : values.join(", ")]
							})] }, question.id);
						})
					}))]
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: QuestionReplyView_module_css_default.actions,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: QuestionReplyView_module_css_default.time,
						children: new Intl.DateTimeFormat(void 0, {
							hour: "2-digit",
							minute: "2-digit",
							hour12: false
						}).format(data.time)
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: copied ? t("copied") : t("copy"),
						side: "bottom",
						children: (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: QuestionReplyView_module_css_default.action,
							"aria-label": copied ? t("copied") : t("copy"),
							onClick: onCopy,
							children: copied ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, {})
						})
					})]
				})]
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** `question` namespace dictionaries. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"error.incomplete": "请先完成这道问题。",
			"error.unanswered": "请选择一个选项或填写自定义答案。",
			"error.unavailable": "当前无法提交，请稍候再试。",
			"error.resubmit": "回答未送达，工作已继续，请再提交一次。",
			"status.sent": "回答已发送；面板未能关闭。",
			"wait.takeTime": "慢慢回答",
			"wait.countdown": "{seconds} 秒后继续工作",
			"wait.paused": "已暂停 · 剩余 {seconds} 秒",
			"wait.held": "会一直等你回答",
			"wait.continued": "已继续工作，仍可回答",
			"review.status": "已回答",
			"review.skipped": "这道问题当时被跳过。",
			"reply.label": "回答先前等待中的问题",
			"reply.open": "展开问题详情",
			"reply.close": "收起问题详情",
			"reply.answerLabel": "回答：",
			"reply.skipped": "已跳过",
			"nav.prev": "上一题",
			"nav.next": "下一题",
			"nav.minimize": "收起问题卡片",
			"nav.maximize": "展开问题卡片",
			"nav.cancel": "放弃整组问题",
			"nav.close": "收起问题面板，可从工具调用重新打开",
			"option.recommended": "推荐",
			"custom.placeholder": "输入你的答案",
			"action.skip": "跳过",
			"action.next": "下一题",
			"plan.header": "计划待审",
			"plan.approve": "同意执行",
			"plan.decline": "拒绝",
			"plan.discuss": "要求修改"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"error.incomplete": "Please complete this question first.",
			"error.unanswered": "Please select an option or enter a custom answer.",
			"error.unavailable": "Cannot submit right now; try again in a moment.",
export {};
