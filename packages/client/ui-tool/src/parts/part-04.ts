/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		*/
		function readBlockLabels(t) {
			return {
				...codeToolbarLabels(t),
				window: (shown, total) => t("read.window", {
					shown,
					total
				}),
				copy: t("copy"),
				copied: t("copied"),
				collapseAria: t("read.collapseAria"),
				expandAria: (count) => t("read.expandAria", { count }),
				collapse: t("collapse"),
				expand: (count) => t("read.expandRest", { count })
			};
		}
		/**
		* Build localized search-card chrome labels.
		* @param t - Conversation locale seat.
		* @returns Search-card chrome labels.
		*/
		function searchBlockLabels(t) {
			return {
				pathsSummary: (shown, total, truncated) => t(truncated ? "search.paths.truncated" : "search.paths", {
					shown,
					total
				}),
				matchesSummary: (shown, total, files, truncated) => t(truncated ? "search.matches.truncated" : "search.matches", {
					shown,
					total,
					files
				}),
				copy: t("copy"),
				copied: t("copied"),
				noResults: t("search.noResults"),
				collapseAria: t("search.collapseAria"),
				expandAria: (count) => t("search.expandAria", { count }),
				collapse: t("collapse"),
				expand: (count) => t("search.expandRest", { count })
			};
		}
		/**
		* Build localized web-card chrome labels.
		* @param t - Conversation locale seat.
		* @returns Web-card chrome labels.
		*/
		function webBlockLabels(t) {
			return {
				noResults: t("web.noResults"),
				sourcesTruncated: t("web.sourcesTruncated"),
				http: t("web.http"),
				contentTruncated: t("web.contentTruncated"),
				markdown: markdownLabels(t)
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-tool/src/client/tool/components/AskQuestionCard.module.css.mjs
		const css$6 = ".fsXYAq_card{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-base);flex-direction:column;gap:16px;max-height:360px;margin:4px 0 4px 4px;padding:16px 20px;display:flex;overflow-y:auto}.fsXYAq_item{flex-direction:column;gap:2px;min-width:0;display:flex}.fsXYAq_question,.fsXYAq_answer{white-space:pre-wrap;overflow-wrap:anywhere;font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));margin:0}.fsXYAq_question{color:var(--dsw-alias-label-tertiary)}.fsXYAq_answer{color:var(--dsw-alias-label-primary)}.fsXYAq_answerLine{display:block}.fsXYAq_skipped{color:var(--dsw-alias-label-tertiary)}.fsXYAq_verdict{color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));margin:0}.fsXYAq_questionList{flex-direction:column;gap:8px;margin:0;padding-left:20px;display:flex}.fsXYAq_unansweredQuestion{color:var(--dsw-alias-label-tertiary);white-space:pre-wrap;overflow-wrap:anywhere;font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px))}";
		const tagId$6 = "@deepseek-ai/dsh-client-ui-tool/AskQuestionCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$6) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-tool";
			tag.dataset.pluginCss = tagId$6;
			tag.textContent = css$6;
			document.head.appendChild(tag);
		}
		var AskQuestionCard_module_css_default = {
			"answer": "fsXYAq_answer",
			"answerLine": "fsXYAq_answerLine",
			"card": "fsXYAq_card",
			"item": "fsXYAq_item",
			"question": "fsXYAq_question",
			"questionList": "fsXYAq_questionList",
			"skipped": "fsXYAq_skipped",
			"unansweredQuestion": "fsXYAq_unansweredQuestion",
			"verdict": "fsXYAq_verdict"
		};
		//#endregion
		//#region lib/types/client/tool/components/AskQuestionCard.js
		/**
		* Render a validated ask-user transcript from plain card data.
		* @param props - Localized transcript card data.
		* @returns the readable answered or unanswered question list.
		*/
		function AskQuestionCard({ card }) {
			if (card.kind === "unanswered") return (0, react_jsx_runtime.jsxs)("div", {
				className: AskQuestionCard_module_css_default.card,
				children: [(0, react_jsx_runtime.jsx)("p", {
					className: AskQuestionCard_module_css_default.verdict,
					children: card.verdict
				}), (0, react_jsx_runtime.jsx)("ul", {
					className: AskQuestionCard_module_css_default.questionList,
					children: card.questions.map((question) => (0, react_jsx_runtime.jsx)("li", {
						className: AskQuestionCard_module_css_default.unansweredQuestion,
						children: question.question
					}, question.id))
				})]
			});
			return (0, react_jsx_runtime.jsx)("dl", {
				className: AskQuestionCard_module_css_default.card,
				children: card.questions.map((question) => (0, react_jsx_runtime.jsxs)("div", {
					className: AskQuestionCard_module_css_default.item,
					children: [(0, react_jsx_runtime.jsx)("dt", {
						className: AskQuestionCard_module_css_default.question,
						children: question.question
					}), (0, react_jsx_runtime.jsx)("dd", {
						className: AskQuestionCard_module_css_default.answer,
						children: question.answers.length === 0 ? (0, react_jsx_runtime.jsx)("span", {
							className: AskQuestionCard_module_css_default.skipped,
							children: card.skippedLabel
						}) : question.answers.map((answer, index) => (0, react_jsx_runtime.jsx)("span", {
							className: AskQuestionCard_module_css_default.answerLine,
							children: answer
						}, `${question.id}-${String(index)}`))
					})]
				}, question.id))
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-tool/src/client/tool/components/ToolDetails.module.css.mjs
		const css$5 = ".DXqwVW_root{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13);margin:4px 0 4px 4px;overflow:hidden}.DXqwVW_list{max-height:320px;margin:0;padding:0;list-style:none;overflow-y:auto}.DXqwVW_item,.DXqwVW_empty{margin:0;padding:10px 14px}.DXqwVW_item+.DXqwVW_item{border-top:.5px solid var(--dsw-alias-border-l2)}.DXqwVW_root[data-inspect]:not([data-caption])>.DXqwVW_list>.DXqwVW_item,.DXqwVW_root[data-inspect]:not([data-caption]) .DXqwVW_empty,.DXqwVW_root[data-inspect] .DXqwVW_caption{padding-inline-end:88px}.DXqwVW_caption{color:var(--dsw-alias-label-caption);padding:10px 14px 6px;font-size:12px}.DXqwVW_heading{flex-wrap:wrap;align-items:baseline;gap:8px;display:flex}.DXqwVW_text{white-space:pre-wrap;overflow-wrap:anywhere;flex:1;min-width:0}.DXqwVW_status{flex:none;justify-content:center;align-self:flex-start;align-items:center;width:14px;height:18px;font-size:16px;line-height:18px;display:inline-flex}.DXqwVW_pending{box-sizing:border-box;border:1px solid var(--dsw-alias-label-tertiary);border-radius:2px;width:10px;height:10px}.DXqwVW_heading:has(.DXqwVW_statusText) .DXqwVW_text{flex-basis:12em}.DXqwVW_statusText{color:var(--dsw-alias-label-caption);white-space:nowrap;margin-inline-start:auto;font-size:12px}.DXqwVW_previous,.DXqwVW_unchanged{color:var(--dsw-alias-label-tertiary)}.DXqwVW_item[data-change=added] .DXqwVW_status{color:var(--dsw-alias-state-success-primary)}.DXqwVW_item[data-change=removed] .DXqwVW_status{color:var(--dsw-alias-state-error-primary)}.DXqwVW_item[data-change=removed] .DXqwVW_text{color:var(--dsw-alias-label-tertiary);text-decoration:line-through}.DXqwVW_unchanged{border-top:.5px solid var(--dsw-alias-border-l2)}.DXqwVW_unchanged summary{cursor:pointer;align-items:center;gap:6px;padding:9px 14px;list-style:none;display:flex}.DXqwVW_unchanged summary::-webkit-details-marker{display:none}.DXqwVW_unchanged[open] summary svg{transform:rotate(90deg)}.DXqwVW_fields{margin:0}.DXqwVW_heading+.DXqwVW_fields{margin-top:6px}.DXqwVW_field{grid-template-columns:5.5em minmax(0,1fr);gap:12px;display:grid}.DXqwVW_field+.DXqwVW_field{margin-top:4px}.DXqwVW_field dt{color:var(--dsw-alias-label-caption)}.DXqwVW_field dd{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.DXqwVW_badge{color:var(--dsw-alias-label-caption);flex:none;align-items:center;gap:5px;font-size:12px;display:inline-flex}.DXqwVW_badge:before{content:\"\";corner-shape:round;background:currentColor;border-radius:50%;width:5px;height:5px}.DXqwVW_badge[data-tone=info]{color:var(--dsw-alias-state-business-primary)}.DXqwVW_badge[data-tone=success]{color:var(--dsw-alias-state-success-primary)}.DXqwVW_badge[data-tone=warning]{color:var(--dsw-alias-state-warn-primary)}.DXqwVW_badge[data-tone=error]{color:var(--dsw-alias-state-error-primary)}.DXqwVW_subtitle{color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;margin-top:3px;font-size:12px}.DXqwVW_description{color:var(--dsw-alias-label-caption);white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0}.DXqwVW_lines{white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0 0;padding-inline-start:18px}.DXqwVW_lines li+li{margin-top:4px}.DXqwVW_group{border-top:.5px solid var(--dsw-alias-border-l2);margin-top:8px}.DXqwVW_group>summary{color:var(--dsw-alias-label-caption);cursor:pointer;overflow-wrap:anywhere;align-items:center;gap:6px;padding:8px 0 0;list-style:none;display:flex}.DXqwVW_group>summary::-webkit-details-marker{display:none}.DXqwVW_group[open]>summary svg{transform:rotate(90deg)}.DXqwVW_group>summary svg{flex:none}.DXqwVW_group .DXqwVW_list{max-height:none;overflow:visible}.DXqwVW_group .DXqwVW_item{padding:9px 0 2px 20px}.DXqwVW_prose,.DXqwVW_code{max-width:100%;font-size:13px}.DXqwVW_prose{margin-top:8px}.DXqwVW_root .DXqwVW_item>.DXqwVW_code{max-height:240px;margin:8px 0 0;overflow:auto}.DXqwVW_root .DXqwVW_item:has(>.DXqwVW_code:only-child){padding:0}.DXqwVW_root .DXqwVW_item>.DXqwVW_code:only-child{margin:0}.DXqwVW_root .DXqwVW_group .DXqwVW_item:has(>.DXqwVW_code:only-child){padding:4px 0 0 20px}.DXqwVW_path{min-width:0;color:inherit;font:inherit;text-align:start;overflow-wrap:anywhere;cursor:pointer;background:0 0;border:none;flex:1;padding:0}.DXqwVW_path:hover{text-decoration:underline}.DXqwVW_path:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:3px}";
		const tagId$5 = "@deepseek-ai/dsh-client-ui-tool/ToolDetails.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-tool";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var ToolDetails_module_css_default = {
			"badge": "DXqwVW_badge",
			"caption": "DXqwVW_caption",
			"code": "DXqwVW_code",
			"description": "DXqwVW_description",
			"empty": "DXqwVW_empty",
			"field": "DXqwVW_field",
			"fields": "DXqwVW_fields",
			"group": "DXqwVW_group",
			"heading": "DXqwVW_heading",
			"item": "DXqwVW_item",
			"lines": "DXqwVW_lines",
			"list": "DXqwVW_list",
			"path": "DXqwVW_path",
			"pending": "DXqwVW_pending",
			"previous": "DXqwVW_previous",
			"prose": "DXqwVW_prose",
			"root": "DXqwVW_root",
			"status": "DXqwVW_status",
			"statusText": "DXqwVW_statusText",
			"subtitle": "DXqwVW_subtitle",
			"text": "DXqwVW_text",
			"unchanged": "DXqwVW_unchanged"
		};
		//#endregion
		//#region lib/types/client/tool/components/ToolDetails.js
		/** Compact, read-only fields and lists for recorded Tool results. */
		function DetailItem({ item, t, onOpenFile }) {
			const status = item.status;
			return (0, react_jsx_runtime.jsxs)("li", {
				className: ToolDetails_module_css_default.item,
				"data-change": item.change?.value,
				children: [
					item.title !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
						className: ToolDetails_module_css_default.heading,
						children: [
							status !== void 0 && (0, react_jsx_runtime.jsx)("span", {
								className: ToolDetails_module_css_default.status,
								role: "img",
								"aria-label": item.change?.label ?? status.label,
								children: item.change?.value === "added" ? "+" : item.change?.value === "removed" ? "−" : status.value === "completed" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 14 }) : status.value === "in_progress" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlayOutlineRegular, { size: 14 }) : (0, react_jsx_runtime.jsx)("span", { className: ToolDetails_module_css_default.pending })
							}),
							item.location !== void 0 && onOpenFile !== void 0 ? (0, react_jsx_runtime.jsx)("button", {
								className: ToolDetails_module_css_default.path,
								type: "button",
								onClick: () => {
									const location = item.location;
									if (location !== void 0) onOpenFile(location.path, location.line === void 0 ? void 0 : { line: location.line });
								},
								children: item.title
							}) : (0, react_jsx_runtime.jsx)("span", {
								className: ToolDetails_module_css_default.text,
								children: item.title
							}),
							item.badge !== void 0 && (0, react_jsx_runtime.jsx)("span", {
								className: ToolDetails_module_css_default.badge,
								"data-tone": item.badge.tone,
								children: item.badge.label
							}),
							status !== void 0 && (0, react_jsx_runtime.jsxs)("span", {
								className: ToolDetails_module_css_default.statusText,
								children: [
									item.previousStatus !== void 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
										className: ToolDetails_module_css_default.previous,
										children: item.previousStatus
									}), (0, react_jsx_runtime.jsx)("span", { children: " → " })] }),
									(0, react_jsx_runtime.jsx)("span", { children: status.label }),
									item.change?.value === "updated" && item.previousStatus === void 0 && (0, react_jsx_runtime.jsxs)("span", { children: [" · ", item.change.label] })
								]
							})
						]
					}),
					item.subtitle !== void 0 && (0, react_jsx_runtime.jsx)("div", {
						className: ToolDetails_module_css_default.subtitle,
						children: item.subtitle
					}),
					item.description !== void 0 && (0, react_jsx_runtime.jsx)("p", {
						className: ToolDetails_module_css_default.description,
						children: item.description
					}),
					item.fields.length > 0 && (0, react_jsx_runtime.jsx)("dl", {
						className: ToolDetails_module_css_default.fields,
						children: item.fields.map((field) => (0, react_jsx_runtime.jsxs)("div", {
							className: ToolDetails_module_css_default.field,
							children: [(0, react_jsx_runtime.jsx)("dt", { children: field.label }), (0, react_jsx_runtime.jsx)("dd", { children: field.value })]
						}, field.label))
					}),
					item.lines !== void 0 && (0, react_jsx_runtime.jsx)("ul", {
						className: ToolDetails_module_css_default.lines,
						children: item.lines.map((line, index) => (0, react_jsx_runtime.jsx)("li", { children: line }, index))
					}),
					item.markdown !== void 0 && (0, react_jsx_runtime.jsx)("div", {
						className: ToolDetails_module_css_default.prose,
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
							text: item.markdown,
							labels: markdownLabels(t)
						})
					}),
					item.code !== void 0 && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.CodeBlock, {
						toolbarLabels: codeToolbarLabels(t),
						className: ToolDetails_module_css_default.code,
						code: item.code.text,
						lang: item.code.language,
						copyLabel: t("copy"),
						copiedLabel: t("copied")
					}),
					item.groups?.map((group, index) => (0, react_jsx_runtime.jsxs)("details", {
						className: ToolDetails_module_css_default.group,
						children: [(0, react_jsx_runtime.jsxs)("summary", { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {}), (0, react_jsx_runtime.jsx)("span", { children: group.label })] }), (0, react_jsx_runtime.jsx)("ul", {
							className: ToolDetails_module_css_default.list,
							children: group.items.map((child, childIndex) => (0, react_jsx_runtime.jsx)(DetailItem, {
								item: child,
								t,
								onOpenFile
							}, childIndex))
						})]
					}, index))
				]
			});
		}
		/**
		* Render recorded values with local disclosures, copy controls, and file navigation.
		* @param props.model - Localized fields or list items; an empty list uses its empty label.
		* @param props.hasInspect - Reserve space for the row's upper-right Inspect button.
		* @param props.t - Conversation dictionary for shared Markdown and code controls.
		* @param props.onOpenFile - Open a recorded file location in the session workspace.
		* @returns The expanded detail body.
		*/
		function ToolDetails({ model, hasInspect = false, t, onOpenFile }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ToolDetails_module_css_default.root,
				"data-inspect": hasInspect || void 0,
				"data-caption": model.caption !== void 0 || void 0,
				children: [
					model.caption !== void 0 && (0, react_jsx_runtime.jsx)("div", {
						className: ToolDetails_module_css_default.caption,
						children: model.caption
					}),
					model.items.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
						className: ToolDetails_module_css_default.empty,
						children: model.empty
					}) : (0, react_jsx_runtime.jsx)("ul", {
						className: ToolDetails_module_css_default.list,
						children: model.items.map((item, index) => (0, react_jsx_runtime.jsx)(DetailItem, {
							item,
							t,
							onOpenFile
						}, index))
					}),
					model.unchanged !== void 0 && (0, react_jsx_runtime.jsxs)("details", {
						className: ToolDetails_module_css_default.unchanged,
						children: [(0, react_jsx_runtime.jsxs)("summary", { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {}), model.unchanged.label] }), (0, react_jsx_runtime.jsx)("ul", {
							className: ToolDetails_module_css_default.list,
							children: model.unchanged.items.map((item, index) => (0, react_jsx_runtime.jsx)(DetailItem, {
								item,
								t,
								onOpenFile
							}, index))
						})]
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-tool/src/client/tool/components/ExitCodeBadge.module.css.mjs
		const css$4 = ".YJoo9W_badge{flex:none;gap:5px;margin-left:8px}.YJoo9W_dot{corner-shape:round;background:var(--dsw-alias-state-error-primary);border-radius:50%;flex:none;width:4px;height:4px}";
		const tagId$4 = "@deepseek-ai/dsh-client-ui-tool/ExitCodeBadge.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-tool";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var ExitCodeBadge_module_css_default = {
			"badge": "YJoo9W_badge",
			"dot": "YJoo9W_dot"
		};
		//#endregion
		//#region lib/types/client/tool/components/ExitCodeBadge.js
		/** Inline exit status for a settled command. */
		/**
		* Render a neutral capsule with a failure dot and a localized exit status.
		* @param props - localized exit code or terminating signal label.
		* @returns the exit status capsule.
		*/
		function ExitCodeBadge({ label }) {
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
				tone: "neutral",
				className: ExitCodeBadge_module_css_default.badge,
				children: [(0, react_jsx_runtime.jsx)("span", {
					className: ExitCodeBadge_module_css_default.dot,
					"aria-hidden": true
				}), label]
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-tool/src/client/tool/components/ToolRow.module.css.mjs
		const css$3 = ".o3BgMG_root{flex-direction:column;display:flex}.o3BgMG_leading{flex-shrink:0}.o3BgMG_root[data-tool^=cordis_] .o3BgMG_title{font-weight:500}.o3BgMG_title{font-weight:400}.o3BgMG_sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.o3BgMG_summary{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:auto;overflow:hidden}.o3BgMG_summarySuffix{white-space:nowrap;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:none;margin-left:4px}.o3BgMG_diffStat{font-family:var(--ds-font-family-code);font-size:calc(var(--dsh-content-font-size-secondary,13px) - 2px);margin-left:10px;transform:translateY(.5px)}.o3BgMG_row:is(:hover,[aria-expanded=true]) .o3BgMG_diffAdded{color:var(--dsw-alias-state-success-primary)}.o3BgMG_row:is(:hover,[aria-expanded=true]) .o3BgMG_diffRemoved{color:var(--dsw-alias-state-error-primary)}.o3BgMG_fileLink{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:inherit;text-align:left;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:inherit;text-underline-offset:3px;cursor:pointer;background:0 0;border:none;flex:0 auto;margin:0;padding:0;text-decoration:underline 1px dotted;overflow:hidden}.o3BgMG_errorSummary{color:var(--dsw-alias-state-error-primary)}.o3BgMG_stoppedSummary{color:var(--dsw-alias-state-warn-label)}.o3BgMG_bodyWrap{flex-direction:column;display:flex}.o3BgMG_inspectButton{border:.5px solid var(--dsw-alias-border-l3);corner-shape:round;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;border-radius:999px;align-self:flex-start;align-items:center;gap:4px;margin:4px 0 2px 4px;padding:2px 8px;font-size:11px;line-height:16px;transition:opacity .1s;display:inline-flex}.o3BgMG_root:hover .o3BgMG_inspectButton,.o3BgMG_inspectButton:focus-visible{opacity:1}.o3BgMG_detailsBodyWrap{position:relative}.o3BgMG_detailsBodyWrap .o3BgMG_inspectButton{margin:0;position:absolute;top:12px;right:12px}.o3BgMG_inspectButton:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}.o3BgMG_bodyScroll{max-height:260px;overflow-y:auto}.o3BgMG_ioCard{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-code-block-small);flex-direction:column;margin:4px 0 4px 4px;display:flex}.o3BgMG_ioSection{grid-template-columns:max-content 1fr;align-items:baseline;column-gap:14px;max-height:150px;padding:12px 16px;display:grid;overflow-y:auto}.o3BgMG_ioSection::-webkit-scrollbar-thumb{border-radius:var(--dsw-radius-sm);background-clip:padding-box;border:2px solid #0000}.o3BgMG_ioSection::-webkit-scrollbar-track{margin:6px 0}.o3BgMG_ioLabel{color:var(--dsw-alias-label-caption);align-self:start;position:sticky;top:0}.o3BgMG_ioDivider{background:var(--dsw-alias-border-l2);flex:none;height:.5px}.o3BgMG_ioText{white-space:pre-wrap;word-break:break-word;min-width:0;color:var(--dsw-alias-label-secondary)}.o3BgMG_ioText[data-error]{color:var(--dsw-alias-state-error-primary)}.o3BgMG_codeBody,.o3BgMG_terminalBody,.o3BgMG_diffBody,.o3BgMG_readBody,.o3BgMG_imageBody,.o3BgMG_searchBody,.o3BgMG_webBody{margin:4px 0 4px 4px}.o3BgMG_searchRecovery{white-space:pre-wrap;overflow-wrap:anywhere;font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-tertiary);margin:4px 0 4px 4px}.o3BgMG_imageMeta{white-space:pre-wrap;overflow-wrap:anywhere;font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-tertiary);margin-top:4px}.o3BgMG_imageExtra{white-space:pre-wrap;overflow-wrap:anywhere;font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-tertiary);margin-top:4px}.o3BgMG_terminalBody{--dsl-terminal-font:var(--dsw-font-markdown-code-block-small);--dsl-terminal-line-height:18px;--dsl-terminal-output-max-height:224px;--dsl-terminal-command-whitespace:pre-wrap;border:.5px solid var(--dsw-alias-border-l1)}.o3BgMG_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-tool/ToolRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-tool";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var ToolRow_module_css_default = {
			"bodyScroll": "o3BgMG_bodyScroll",
			"bodyWrap": "o3BgMG_bodyWrap",
			"codeBody": "o3BgMG_codeBody",
			"detailsBodyWrap": "o3BgMG_detailsBodyWrap",
			"diffAdded": "o3BgMG_diffAdded",
			"diffBody": "o3BgMG_diffBody",
			"diffRemoved": "o3BgMG_diffRemoved",
			"diffStat": "o3BgMG_diffStat",
			"errorSummary": "o3BgMG_errorSummary",
			"fileLink": "o3BgMG_fileLink",
			"imageBody": "o3BgMG_imageBody",
			"imageExtra": "o3BgMG_imageExtra",
			"imageMeta": "o3BgMG_imageMeta",
			"inspectButton": "o3BgMG_inspectButton",
			"ioCard": "o3BgMG_ioCard",
			"ioDivider": "o3BgMG_ioDivider",
			"ioLabel": "o3BgMG_ioLabel",
			"ioSection": "o3BgMG_ioSection",
			"ioText": "o3BgMG_ioText",
			"leading": "o3BgMG_leading",
			"readBody": "o3BgMG_readBody",
			"root": "o3BgMG_root",
			"row": "o3BgMG_row",
			"searchBody": "o3BgMG_searchBody",
			"searchRecovery": "o3BgMG_searchRecovery",
			"sep": "o3BgMG_sep",
			"stoppedSummary": "o3BgMG_stoppedSummary",
			"summary": "o3BgMG_summary",
			"summarySuffix": "o3BgMG_summarySuffix",
			"terminalBody": "o3BgMG_terminalBody",
			"title": "o3BgMG_title",
			"visuallyHidden": "o3BgMG_visuallyHidden",
			"webBody": "o3BgMG_webBody"
		};
		//#endregion
		//#region lib/types/client/tool/components/ToolRow.js
		/** Keep a summary link click from toggling the row; the browser still follows the link. */
		function stopLinkClick(event) {
			event.stopPropagation();
		}
		/** Visually hidden run-state label for color-only running and settlement cues. */
		function stateStatus$1(state, t) {
			switch (state) {
				case "preparing": return t("row.preparing");
				case "running": return t("row.running");
				case "error": return t("row.failed");
				case "stopped": return t("row.stopped");
				default: return null;
			}
		}
		/**
		* Render one localized tool summary and lazily mounted result card.
		* Preparation retains the icon, title, and optional tool-name summary without disclosure.
		* @param props - tool state, summary, output, and navigation callbacks.
		* @returns the tool disclosure.
		*/
		const ToolRow = (0, react.memo)(function ToolRow({ t, variant, toolName, icon, title, summary, summarySuffix, bodyRaw, output, askQuestion, errorSummary, terminal, diff, read, image, renderSlot, loadImage, search, web, details, state, filePath, filePathLine, onOpenFile, href, inspect, useDisclosure }) {
			const { expanded, toggle: toggleExpand } = useDisclosure();
			const terminalLabels = (0, react.useMemo)(() => terminalBlockLabels(t), [t]);
			const diffLabels = (0, react.useMemo)(() => diffBlockLabels(t), [t]);
			const readLabels = (0, react.useMemo)(() => readBlockLabels(t), [t]);
			const searchLabels = (0, react.useMemo)(() => searchBlockLabels(t), [t]);
			const webLabels = (0, react.useMemo)(() => webBlockLabels(t), [t]);
export {};
