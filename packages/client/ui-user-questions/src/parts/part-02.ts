/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				const rpc = this.#rpc;
				if (this.#state === "continued" && rpc !== void 0) return rpc.answer(answer).then((accepted) => {
					if (!accepted) throw new Error("this question is no longer answerable");
				});
				return Promise.reject(/* @__PURE__ */ new Error("no channel accepts an answer yet"));
			}
			/**
			* Close the panel. A tool-call-keyed card only leaves the composer seat: the
			* request stands, the countdown keeps running here, and the tool call row
			* reopens it. A card the Host never named ends its request instead, because
			* nothing could bring it back.
			*/
			dismiss() {
				if (this.dismissal === "hide") return settlePendingComposer(() => {
					this.#seat?.hide();
				}, "pending question hide failed");
				const waterfall = this.#waterfall;
				if (waterfall === void 0) return Promise.reject(/* @__PURE__ */ new Error("no channel accepts a cancellation yet"));
				return settlePendingComposer(() => {
					waterfall.reject("ASK_CANCELLED");
				}, "pending question cancellation failed");
			}
		};
		//#endregion
		//#region lib/types/client/draft-store.js
		/**
		* Session-scoped draft state for the generic question composer. The Slot
		* registry owns store instances; this module exports only the factory so a
		* plugin reload cannot reuse a module-global handle.
		*/
		/**
		* Declare the question composer's Session store. Drafts persist per Session so
		* leaving the Session or restarting the Client does not erase an unfinished answer.
		* @returns a persisted store handle whose instance is owned by the Slot registry.
		*/
		function createQuestionDraftStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({ progressByRequest: {} }),
				persist: "dsh.user-questions.drafts.v1",
				actions: {
					replace: (draft, requestKey, progress) => {
						draft.progressByRequest[requestKey] = progress;
					},
					clear: (draft, requestKey) => {
						draft.progressByRequest = Object.fromEntries(Object.entries(draft.progressByRequest).filter(([key]) => key !== requestKey));
					},
					prune: (draft, keep) => {
						const live = new Set(keep);
						draft.progressByRequest = Object.fromEntries(Object.entries(draft.progressByRequest).filter(([key]) => live.has(key)));
					}
				}
			});
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-user-questions/src/client/PlanReviewPanel.module.css.mjs
		const css$2 = ".LVzXQa_frame{padding:6px calc(var(--dsh-composer-side-clearance) + 16px) 10px;justify-content:center;display:flex}.LVzXQa_card{width:100%;max-width:var(--dsh-chat-content-width);--dsw-elevation-stroke-color:var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-xl);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-elevation-panel);color:var(--dsw-alias-label-primary);border:0;flex-direction:column;display:flex;overflow:hidden}.LVzXQa_card,.LVzXQa_card *{box-sizing:border-box}.LVzXQa_strip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);flex-shrink:0;align-items:center;gap:8px;padding:12px 16px;font-size:14px;line-height:20px;display:flex}.LVzXQa_footer{flex-shrink:0;justify-content:space-between;align-items:center;gap:12px;padding:8px 16px 12px;display:flex}.LVzXQa_feedback{min-height:16px;color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:16px}.LVzXQa_actions{flex-shrink:0;align-items:center;gap:8px;display:flex}.LVzXQa_summary{min-width:0;padding:14px 16px 12px}.LVzXQa_title{text-overflow:ellipsis;white-space:nowrap;margin:0;font-size:15px;font-weight:500;line-height:22px;overflow:hidden}.LVzXQa_description{-webkit-line-clamp:2;color:var(--dsw-alias-label-secondary);-webkit-box-orient:vertical;margin:8px 0 0;font-size:14px;line-height:24px;display:-webkit-box;overflow:hidden}.LVzXQa_discuss{gap:6px}@media (width<=720px){.LVzXQa_card{border-radius:var(--dsw-radius-xl)}.LVzXQa_footer{align-items:flex-end;padding:8px 12px 10px}}.LVzXQa_previewActions{align-items:center;margin-left:auto;display:flex}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-user-questions/PlanReviewPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-user-questions";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var PlanReviewPanel_module_css_default = {
			"actions": "LVzXQa_actions",
			"card": "LVzXQa_card",
			"description": "LVzXQa_description",
			"discuss": "LVzXQa_discuss",
			"feedback": "LVzXQa_feedback",
			"footer": "LVzXQa_footer",
			"frame": "LVzXQa_frame",
			"previewActions": "LVzXQa_previewActions",
			"strip": "LVzXQa_strip",
			"summary": "LVzXQa_summary",
			"title": "LVzXQa_title"
		};
		//#endregion
		//#region lib/types/client/PlanReviewPanel.js
		/**
		* Optional-prop spread for a decision button's tooltip: `title` is optional on
		* the DOM props, and exactOptionalPropertyTypes rejects an explicit undefined.
		*
		* @param description - the asker's option description, when it carries one.
		* @returns The `title` prop to spread, or nothing.
		*/
		function tooltip(description) {
			return description === void 0 ? {} : { title: description };
		}
		/**
		* Render plan review controls; the submitted document opens in the sidebar.
		*
		* @param props - the question domain face, the narrowed plan review, and `t`.
		* @returns The plan-review takeover for this request.
		*/
		function PlanReviewPanel({ pending, review, t, renderSlot }) {
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const settle = (send, remote = false) => {
				setBusy(true);
				setError(null);
				send().then(() => {
					if (!remote) return;
					setBusy(false);
					pending.dismiss().catch(() => {
						setError(t("status.sent"));
					});
				}).catch((cause) => {
					setBusy(false);
					setError(cause instanceof Error ? cause.message : String(cause));
				});
			};
			const decide = (label) => {
				settle(() => pending.answer({ answers: [{
					id: review.id,
					selected: [label]
				}] }), pending.snapshot().channel === "rpc");
			};
			const summary = (0, react.useMemo)(() => {
				const title = (0, _deepseek_ai_dsh_client_ui_primitives.extractMarkdownPlainText)(review.plan, { mode: "first-line" });
				const description = (0, _deepseek_ai_dsh_client_ui_primitives.extractMarkdownPlainText)(review.plan, { mode: "first-paragraph" });
				return {
					title,
					description: description === title ? "" : description
				};
			}, [review.plan]);
			return (0, react_jsx_runtime.jsx)("div", {
				className: PlanReviewPanel_module_css_default.frame,
				"data-plan-review-key": pending.key,
				children: (0, react_jsx_runtime.jsxs)("section", {
					className: PlanReviewPanel_module_css_default.card,
					"aria-label": review.question,
					"aria-busy": busy,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: PlanReviewPanel_module_css_default.strip,
							children: [
								(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: busy ? "ongoing" : "warning" }),
								t("plan.header"),
								(0, react_jsx_runtime.jsx)("div", {
									className: PlanReviewPanel_module_css_default.previewActions,
									children: renderSlot("conversation.plan-review.actions", {
										review,
										requestKey: pending.key
									})
								})
							]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: PlanReviewPanel_module_css_default.summary,
							children: [(0, react_jsx_runtime.jsx)("h3", {
								className: PlanReviewPanel_module_css_default.title,
								children: summary.title
							}), summary.description !== "" && (0, react_jsx_runtime.jsx)("p", {
								className: PlanReviewPanel_module_css_default.description,
								children: summary.description
							})]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: PlanReviewPanel_module_css_default.footer,
							children: [(0, react_jsx_runtime.jsx)("div", {
								className: PlanReviewPanel_module_css_default.feedback,
								role: "status",
								children: error
							}), (0, react_jsx_runtime.jsxs)("div", {
								className: PlanReviewPanel_module_css_default.actions,
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									className: PlanReviewPanel_module_css_default.discuss,
									icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 14 }),
									disabled: busy,
									onClick: () => {
										settle(() => pending.dismiss());
									},
									children: t("plan.discuss")
								}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									...tooltip(review.approve.description),
									disabled: busy,
									onClick: () => {
										decide(review.approve.label);
									},
									children: t("plan.approve")
								})]
							})]
						})
					]
				})
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-user-questions/src/client/QuestionComposer.module.css.mjs
		const css$1 = ".Mbwy4a_frame{padding:6px calc(var(--dsh-composer-side-clearance) + 16px) 10px;justify-content:center;display:flex}.Mbwy4a_card{width:100%;max-width:var(--dsh-chat-content-width);--dsw-elevation-stroke-color:var(--dsw-alias-border-l2-darkmode-thin);border-radius:var(--dsw-radius-xl);background:var(--dsw-specific-input-major);max-height:min(60vh,520px);box-shadow:var(--dsw-elevation-panel);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border:0;flex-direction:column;padding:0 0 10px;display:flex;overflow:hidden}.Mbwy4a_card,.Mbwy4a_card *{box-sizing:border-box}.Mbwy4a_cardMinimized{max-height:none}.Mbwy4a_cardMinimized .Mbwy4a_header{padding-bottom:14px}.Mbwy4a_headerActions{flex-shrink:0;align-items:center;gap:4px;display:flex}.Mbwy4a_waitButton{white-space:nowrap}.Mbwy4a_waitStatus{color:var(--dsw-alias-label-secondary);white-space:nowrap;font-size:12px;line-height:24px}.Mbwy4a_header{flex-shrink:0;justify-content:space-between;align-items:flex-start;gap:16px;padding:20px 16px 0 24px;display:flex}.Mbwy4a_headingBlock{min-width:0}.Mbwy4a_eyebrow{color:var(--dsw-alias-label-tertiary);margin-bottom:5px;font-size:11px;line-height:16px}.Mbwy4a_title{margin:0;font-size:16px;font-weight:500;line-height:22px}.Mbwy4a_detail{margin:0 2px 8px}.Mbwy4a_footerActions{flex-shrink:0;align-items:center;gap:12px;display:flex}.Mbwy4a_pager{flex-shrink:0;align-items:center;gap:6px;display:flex}.Mbwy4a_progress{color:var(--dsw-alias-label-secondary);white-space:nowrap;word-spacing:-2px;padding:0 4px;font-size:14px;font-weight:500;line-height:24px}.Mbwy4a_iconButton{corner-shape:round;width:24px;height:24px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:999px;place-items:center;padding:0;display:grid}.Mbwy4a_iconButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.Mbwy4a_iconButton:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.Mbwy4a_body{overscroll-behavior:contain;flex-direction:column;flex:auto;min-height:0;display:flex;overflow-y:auto}.Mbwy4a_options{flex-direction:column;gap:1px;margin:8px 0 0;padding:4px 12px;display:flex}.Mbwy4a_option{border-radius:var(--dsw-radius-md);width:100%;min-height:40px;color:inherit;text-align:left;cursor:pointer;background:0 0;border:1px solid #0000;flex-shrink:0;align-items:flex-start;gap:8px;padding:8px 12px 8px 8px;transition:background-color .12s,border-color .12s;display:flex}.Mbwy4a_option:hover:not(:disabled),.Mbwy4a_optionSelected{background:var(--dsw-alias-interactive-bg-hover)}.Mbwy4a_optionSelected{border-color:var(--dsw-alias-border-l2)}.Mbwy4a_option:disabled{cursor:default}.Mbwy4a_number{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-overlay);width:20px;height:20px;color:var(--dsw-alias-label-secondary);flex:0 0 20px;place-items:center;margin-top:2px;font-size:12px;font-weight:500;line-height:18px;display:grid}.Mbwy4a_checkbox{flex:0 0 20px;place-items:center;width:20px;height:20px;margin-top:2px;display:grid}.Mbwy4a_checkbox:before{content:\"\";border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-xs);grid-area:1/1;width:14px;height:14px;transition:background-color .12s,border-color .12s}.Mbwy4a_checkbox>svg{grid-area:1/1}.Mbwy4a_checkboxChecked{color:var(--dsw-alias-label-primary-foreground)}.Mbwy4a_checkboxChecked:before{border-color:var(--dsw-alias-label-primary);background:var(--dsw-alias-label-primary)}.Mbwy4a_optionCopy{flex:1;min-width:0}.Mbwy4a_optionLine{flex-wrap:wrap;align-items:baseline;gap:2px 6px;display:flex}.Mbwy4a_optionLabel{font-size:14px;font-weight:500;line-height:24px}.Mbwy4a_badge{border-radius:var(--dsw-radius-xs);background:var(--dsw-specific-sidebar-nav-item-active-accent);color:var(--dsw-alias-button-info-fill);padding:0 4px;font-size:11px;font-weight:600;line-height:18px}.Mbwy4a_description{color:var(--dsw-alias-label-tertiary);font-size:14px;font-weight:400;line-height:24px}.Mbwy4a_reviewNote{color:var(--dsw-alias-label-tertiary);margin:0;padding:8px 12px;font-size:14px;line-height:24px}.Mbwy4a_customRow{border-radius:var(--dsw-radius-md);border:1px solid #0000;flex-shrink:0;align-items:flex-start;gap:8px;width:100%;min-height:40px;padding:8px 12px 8px 8px;transition:background-color .12s,border-color .12s;display:flex}.Mbwy4a_customRow:hover,.Mbwy4a_customRow:focus-within:not(.Mbwy4a_customRowYielded),.Mbwy4a_customRowActive{background:var(--dsw-alias-interactive-bg-hover)}.Mbwy4a_customRow:focus-within:not(.Mbwy4a_customRowYielded),.Mbwy4a_customRowActive{border-color:var(--dsw-alias-border-l2)}.Mbwy4a_field{--dsh-answer-field-padding:0;min-width:0;display:grid}.Mbwy4a_field>*{min-width:0;padding:var(--dsh-answer-field-padding);font:inherit;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;grid-area:1/1;font-size:14px;line-height:24px}.Mbwy4a_fieldMirror{box-sizing:content-box;visibility:hidden;max-height:144px;overflow:hidden}.Mbwy4a_fieldInput{resize:none;color:var(--dsw-alias-label-primary);caret-color:var(--dsw-alias-state-business-primary);background:0 0;border:none;outline:none;overflow-y:auto}.Mbwy4a_fieldInput::placeholder{color:var(--dsw-alias-label-caption)}.Mbwy4a_customInline{flex:1}.Mbwy4a_customBlock{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-module-platform);--dsh-answer-field-padding:8px 12px;flex-shrink:0;min-height:64px;margin:0 12px}.Mbwy4a_customBlock:focus-within{border-color:var(--dsw-alias-state-business-primary)}.Mbwy4a_footer{flex-shrink:0;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding:0 10px 0 18px;display:flex}.Mbwy4a_feedback{min-height:16px;color:var(--dsw-alias-state-error-primary);text-align:right;flex:1;font-size:11px;line-height:16px}@media (width<=720px){.Mbwy4a_card{border-radius:var(--dsw-radius-xl)}.Mbwy4a_header{padding:10px 12px 0 18px}.Mbwy4a_options{padding:4px 8px}.Mbwy4a_title{font-size:15px;line-height:21px}.Mbwy4a_option,.Mbwy4a_customRow{padding:8px 6px}.Mbwy4a_footer{align-items:flex-end;padding:0 10px}.Mbwy4a_footerActions{flex-shrink:0}}@media (prefers-reduced-motion:reduce){.Mbwy4a_option,.Mbwy4a_customRow{transition:none}}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-user-questions/QuestionComposer.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-user-questions";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var QuestionComposer_module_css_default = {
			"badge": "Mbwy4a_badge",
			"body": "Mbwy4a_body",
			"card": "Mbwy4a_card",
			"cardMinimized": "Mbwy4a_cardMinimized",
			"checkbox": "Mbwy4a_checkbox",
			"checkboxChecked": "Mbwy4a_checkboxChecked",
			"customBlock": "Mbwy4a_customBlock",
			"customInline": "Mbwy4a_customInline",
			"customRow": "Mbwy4a_customRow",
			"customRowActive": "Mbwy4a_customRowActive",
			"customRowYielded": "Mbwy4a_customRowYielded",
			"description": "Mbwy4a_description",
			"detail": "Mbwy4a_detail",
			"eyebrow": "Mbwy4a_eyebrow",
			"feedback": "Mbwy4a_feedback",
			"field": "Mbwy4a_field",
			"fieldInput": "Mbwy4a_fieldInput",
			"fieldMirror": "Mbwy4a_fieldMirror",
			"footer": "Mbwy4a_footer",
			"footerActions": "Mbwy4a_footerActions",
			"frame": "Mbwy4a_frame",
			"header": "Mbwy4a_header",
			"headerActions": "Mbwy4a_headerActions",
			"headingBlock": "Mbwy4a_headingBlock",
			"iconButton": "Mbwy4a_iconButton",
			"number": "Mbwy4a_number",
			"option": "Mbwy4a_option",
			"optionCopy": "Mbwy4a_optionCopy",
			"optionLabel": "Mbwy4a_optionLabel",
			"optionLine": "Mbwy4a_optionLine",
			"optionSelected": "Mbwy4a_optionSelected",
			"options": "Mbwy4a_options",
			"pager": "Mbwy4a_pager",
			"progress": "Mbwy4a_progress",
			"reviewNote": "Mbwy4a_reviewNote",
			"title": "Mbwy4a_title",
			"waitButton": "Mbwy4a_waitButton",
			"waitStatus": "Mbwy4a_waitStatus"
		};
		//#endregion
		//#region lib/types/client/QuestionComposer.js
		/** A removed card can remain mounted until the composer seat updates. */
		const REMOVED_CARD = {
			state: "open",
			waitState: "counting",
			countdown: void 0,
			channel: "none",
			closed: true
		};
		/**
		* Split the conventional recommendation suffix without changing the answer value.
		* @param label - Original option label returned if selected.
		* @returns Display label plus recommendation state.
		*/
		function parseRecommendedLabel(label) {
			const suffix = /\s*(?:\((?:recommended|推荐)\)|（(?:recommended|推荐)）)\s*$/i;
			return suffix.test(label) ? {
				label: label.replace(suffix, ""),
				recommended: true
			} : {
				label,
				recommended: false
			};
		}
		/** Only a marked first choice is an implicit draft; the user still submits it. */
		function recommendedFirstOption(question) {
			const label = question.options?.[0]?.label;
			return label !== void 0 && parseRecommendedLabel(label).recommended ? label : void 0;
		}
		/** Accept persisted progress only when it still describes this question batch. */
		function isQuestionDraftProgress(value, questionCount) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const progress = value;
			if (typeof progress.index !== "number" || !Number.isInteger(progress.index) || progress.index < 0 || progress.index >= questionCount || !Array.isArray(progress.drafts) || progress.drafts.length !== questionCount || progress.wait !== void 0 && progress.wait !== "editing" && progress.wait !== "waiting") return false;
			return progress.drafts.every((item) => {
				if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
				const draft = item;
				return Array.isArray(draft.selected) && draft.selected.every((label) => typeof label === "string") && typeof draft.custom === "string" && typeof draft.skipped === "boolean";
			});
		}
		/** Return whether a text-field key event belongs to an active IME composition. */
		function isComposing(event) {
			return event.nativeEvent.isComposing || Reflect.get(event.nativeEvent, "keyCode") === 229;
		}
		/**
		* Auto-growing free-text answer: a textarea, so a long answer soft-wraps and
		* Shift+Enter breaks a line, over a hidden mirror that owns the height.
		*
		* The mirror renders the draft plus a trailing newline in normal flow and so
		* sizes the grid row (counting rows by '\n' cannot see soft wraps); the
		* textarea shares that one cell and stretches to it, and `rows={1}` keeps the
		* control's own intrinsic height out of the row sizing so the mirror alone
		* decides. Past the mirror's cap the textarea scrolls itself — it is the only
		* scrollport in the stack, there being no second glyph layer to keep aligned.
		* Mirror and textarea MUST share font, line-height, padding and wrapping rules
		* or the two heights diverge.
		*
		* @param props - visual variant, draft text, and the field's event handlers.
		* @returns The mirrored auto-growing field.
		*/
		function AnswerField(props) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(QuestionComposer_module_css_default.field, props.variant === "inline" ? QuestionComposer_module_css_default.customInline : QuestionComposer_module_css_default.customBlock),
				children: [(0, react_jsx_runtime.jsx)("div", {
					"aria-hidden": true,
					className: QuestionComposer_module_css_default.fieldMirror,
					children: `${props.value}\n`
				}), (0, react_jsx_runtime.jsx)("textarea", {
					autoFocus: props.autoFocus,
					className: QuestionComposer_module_css_default.fieldInput,
					value: props.value,
					disabled: props.disabled,
					rows: 1,
					placeholder: props.placeholder,
					onFocus: props.onFocus,
					onChange: props.onChange,
					onKeyDown: props.onKeyDown
				})]
			});
		}
		/**
		* Composer takeover router. Generic-question drafts live in this entry's
		* Session-scoped Slot store, keyed by the pending carrier, so a strict Session
		* entry remount restores the same request without exposing it to another one.
		*
		* One takeover, two presentations: a request that declares a presentation intent this
		* package renders uses that presentation (a plan review is one decision over one
		* plan, not a question set), and every other request takes the generic flow.
		* The routing lives here, at the one entry that owns the composer seat, so
		* neither presentation can claim a request the other is already rendering.
		*
		* @param props - the selector-matched pending question carrier plus the framework standard kit.
		* @returns The question flow, or the intent's own surface, for this request.
		*/
		function QuestionComposer(props) {
			const question = props.matched;
			const review = (0, react.useMemo)(() => planReviewOf(question.questions), [question]);
			return review === void 0 ? (0, react_jsx_runtime.jsx)(QuestionFlow, {
				pending: question,
				t: props.t,
				useStore: props.useStore,
				useQuestionCard: props.useQuestionCard,
				actions: props.actions
			}, question.key) : (0, react_jsx_runtime.jsx)(PlanReviewPanel, {
				pending: question,
				review,
				t: props.t,
				renderSlot: props.renderSlot
			}, question.key);
		}
		function QuestionFlow({ pending, t, useStore, useQuestionCard, actions }) {
			const questions = pending.questions;
			const review = pending.review;
			const markdownLabels = (0, react.useMemo)(() => ({
				code: {
					copyLabel: t("copy"),
					copiedLabel: t("copied"),
					toolbarLabels: {
						codeLabel: t("codeBlock.title"),
						wrapLabel: t("codeBlock.wrap"),
						unwrapLabel: t("codeBlock.unwrap")
					}
				},
				footnotes: t("markdown.footnotes")
			}), [t]);
			const initialDrafts = (0, react.useMemo)(() => {
				const recorded = new Map((review ?? []).map((answer) => [answer.id, answer]));
				return questions.map((item) => {
					const answer = recorded.get(item.id);
					const custom = answer?.custom ?? "";
					const recommended = review === void 0 ? recommendedFirstOption(item) : void 0;
					return {
						selected: answer === void 0 && recommended !== void 0 ? [recommended] : [...answer?.selected ?? []],
						custom,
						skipped: answer !== void 0 && answer.selected.length === 0 && custom === ""
					};
				});
			}, [questions, review]);
			const stored = useStore((state) => state.progressByRequest[pending.key]);
			const validStored = isQuestionDraftProgress(stored, questions.length) ? stored : void 0;
			const storedProgress = review === void 0 ? validStored : void 0;
			const index = validStored?.index ?? 0;
			const drafts = storedProgress?.drafts ?? initialDrafts;
export {};
