/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			});
			return (0, react_jsx_runtime.jsx)(ToolRow, {
				useDisclosure,
				t,
				variant: model.variant,
				toolName,
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQuestionOutlineRegular, {}),
				title: t(model.titleKey),
				summary,
				bodyRaw: transcript === null ? model.bodyRaw : null,
				output: transcript === null ? model.output : null,
				askQuestion: transcript,
				state,
				inspect
			});
		}
		/** Registers the ask-user-question conversation row. */
		const askQuestionToolview = {
			name: "ask-question-toolview",
			inject: ["slots"],
			apply(ctx) {
				ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
					name: "tool.call.toolview",
					key: "ask_user_question",
					locale: CONVERSATION_NS,
					inject: (sessionId) => ({
						revealPanel: (callId) => ctx.get("userQuestionPanels")?.reveal(sessionId, callId) ?? false,
						reviewPanel: (callId, record) => ctx.get("userQuestionPanels")?.review(sessionId, callId, record) ?? false
					})
				}, AskQuestionRow));
			}
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-tool/src/client/tool/toolviews/bash-sample.module.css.mjs
		const css = ".CY-8Ka_card{flex-direction:column;display:flex}.CY-8Ka_terminal{--dsl-terminal-font:var(--dsw-font-markdown-code-block-small);--dsl-terminal-line-height:18px;--dsl-terminal-output-max-height:224px;--dsl-terminal-command-whitespace:pre-wrap;border:.5px solid var(--dsw-alias-border-l1);margin:4px 0 4px 4px}.CY-8Ka_ioCard{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-code-block-small);flex-direction:column;margin:4px 0 4px 4px;display:flex}.CY-8Ka_ioSection{grid-template-columns:max-content 1fr;align-items:baseline;column-gap:14px;max-height:150px;padding:12px 16px;display:grid;overflow-y:auto}.CY-8Ka_ioSection::-webkit-scrollbar-thumb{border-radius:var(--dsw-radius-sm);background-clip:padding-box;border:2px solid #0000}.CY-8Ka_ioSection::-webkit-scrollbar-track{margin:6px 0}.CY-8Ka_ioLabel{color:var(--dsw-alias-label-caption);align-self:start;position:sticky;top:0}.CY-8Ka_ioDivider{background:var(--dsw-alias-border-l2);flex:none;height:.5px}.CY-8Ka_ioText{white-space:pre-wrap;word-break:break-word;min-width:0;color:var(--dsw-alias-label-secondary)}.CY-8Ka_ioText[data-error]{color:var(--dsw-alias-state-error-primary)}.CY-8Ka_commandInput{--dsl-command-whitespace:pre-wrap;color:var(--dsw-alias-label-secondary)}.CY-8Ka_root[data-expandable]{cursor:pointer}.CY-8Ka_root{height:calc(24px + var(--dsh-content-font-delta,0px));min-width:0;color:var(--dsw-alias-label-tertiary);align-items:center;transition:color .1s;display:flex}.CY-8Ka_root:hover{color:var(--dsw-alias-label-secondary)}@media (prefers-reduced-motion:reduce){.CY-8Ka_root{transition:none}}.CY-8Ka_leading{width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));color:inherit;flex:none;justify-content:center;align-items:center;margin-right:6px;display:inline-flex;position:relative}.CY-8Ka_leading svg:not([data-state]){width:calc(14px + var(--dsh-content-font-delta,0px));height:calc(14px + var(--dsh-content-font-delta,0px))}.CY-8Ka_chevron{color:inherit}.CY-8Ka_iconIdle{opacity:1;transition:opacity .1s;display:inline-flex}.CY-8Ka_chevronHover{opacity:0;margin:auto;transition:opacity .1s;position:absolute;inset:0}.CY-8Ka_root:hover .CY-8Ka_iconIdle{opacity:0}.CY-8Ka_root:hover .CY-8Ka_chevronHover{opacity:1}.CY-8Ka_title{font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:none}.CY-8Ka_sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.CY-8Ka_summary{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:auto;overflow:hidden}.CY-8Ka_errorSummary{color:var(--dsw-alias-state-error-primary)}.CY-8Ka_stoppedSummary{color:var(--dsw-alias-state-warn-label)}.CY-8Ka_bodyWrap{flex-direction:column;display:flex}.CY-8Ka_inspectButton{border:.5px solid var(--dsw-alias-border-l4);corner-shape:round;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;border-radius:999px;align-self:flex-start;align-items:center;gap:4px;margin:4px 0 2px 4px;padding:2px 8px;font-size:11px;line-height:16px;transition:opacity .1s;display:inline-flex}.CY-8Ka_card:hover .CY-8Ka_inspectButton,.CY-8Ka_inspectButton:focus-visible{opacity:1}.CY-8Ka_inspectButton:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}.CY-8Ka_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}";
		const tagId = "@deepseek-ai/dsh-client-ui-tool/bash-sample.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-tool";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var bash_sample_module_css_default = {
			"bodyWrap": "CY-8Ka_bodyWrap",
			"card": "CY-8Ka_card",
			"chevron": "CY-8Ka_chevron",
			"chevronHover": "CY-8Ka_chevronHover",
			"commandInput": "CY-8Ka_commandInput",
			"errorSummary": "CY-8Ka_errorSummary",
			"iconIdle": "CY-8Ka_iconIdle",
			"inspectButton": "CY-8Ka_inspectButton",
			"ioCard": "CY-8Ka_ioCard",
			"ioDivider": "CY-8Ka_ioDivider",
			"ioLabel": "CY-8Ka_ioLabel",
			"ioSection": "CY-8Ka_ioSection",
			"ioText": "CY-8Ka_ioText",
			"leading": "CY-8Ka_leading",
			"root": "CY-8Ka_root",
			"sep": "CY-8Ka_sep",
			"stoppedSummary": "CY-8Ka_stoppedSummary",
			"summary": "CY-8Ka_summary",
			"terminal": "CY-8Ka_terminal",
			"title": "CY-8Ka_title",
			"visuallyHidden": "CY-8Ka_visuallyHidden"
		};
		//#endregion
		//#region lib/types/client/tool/toolviews/bash-sample.js
		const BASH_ICON = (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconApiOutlineRegular, { size: 14 });
		/** Visually hidden status for the color-only running sweep and error tone. */
		function stateStatus(state, t) {
			switch (state) {
				case "preparing": return t("row.preparing");
				case "running": return t("bash.running");
				case "error": return t("bash.failed");
				case "stopped": return t("bash.stopped");
				default: return null;
			}
		}
		/**
		* Render expandable Bash output with an accessible lifecycle label. While the
		* call is preparing the row shows the description streamed so far and cannot expand.
		* @param props - tool call, Session sources, locale, and inspection callback.
		* @returns the Bash output row.
		*/
		const BashRow = (0, react.memo)(function BashRow({ toolName, block, sessionId, useSessions, inspect, useDisclosure, t }) {
			const model = (0, react.useMemo)(() => toolRowModel(toolName, block), [toolName, block]);
			const cwd = useSessions((list) => list.byId[sessionId]?.cwd);
			const terminalModel = (0, react.useMemo)(() => terminalCardModel(block, cwd), [block, cwd]);
			const terminal = (0, react.useMemo)(() => terminalModel === null ? null : localizeTerminalCardModel(terminalModel, t), [terminalModel, t]);
			const labels = (0, react.useMemo)(() => terminalBlockLabels(t), [t]);
			const state = model.state === "ok" && terminalModel !== null && terminalFailed(terminalModel) ? "error" : model.state;
			const status = stateStatus(state, t);
			const { expanded, toggle: toggleExpand } = useDisclosure();
			const background = isBackgroundShellCall(block);
			const genericBody = terminal === null && (model.state === "error" || isSettledPersistentShellCall(block) || isSpilledShellCall(block) || background) && (model.bodyRaw !== null || model.output !== null);
			const expandable = terminal !== null || genericBody;
			const open = expanded && expandable;
			const body = (0, react.useMemo)(() => open && genericBody && model.bodyRaw !== null ? formatToolBody(model.variant, model.bodyRaw) : null, [
				genericBody,
				model.bodyRaw,
				model.variant,
				open
			]);
			const normalSummary = terminal?.description ?? model.summary;
			const exitLabel = terminalExitLabel(terminalModel, t);
			const settlementLine = exitLabel !== null ? null : state === "error" ? model.errorSummary ?? normalSummary : state === "stopped" ? t("bash.stopped") : null;
			const running = state === "running" || state === "preparing";
			const toggleFromKeyboard = (0, react.useCallback)((event) => {
				if (!expandable || event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				toggleExpand();
			}, [expandable, toggleExpand]);
			const leading = open ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutlineRegular, { className: bash_sample_module_css_default.chevron }) : expandable ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
				className: bash_sample_module_css_default.iconIdle,
				children: BASH_ICON
			}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: clsx(bash_sample_module_css_default.chevron, bash_sample_module_css_default.chevronHover) })] }) : BASH_ICON;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: bash_sample_module_css_default.card,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: bash_sample_module_css_default.root,
					"data-sample": "bash",
					"data-variant": "bash",
					"data-state": state,
					"data-expandable": expandable || void 0,
					role: expandable ? "button" : void 0,
					tabIndex: expandable ? 0 : void 0,
					"aria-expanded": expandable ? open : void 0,
					onClick: expandable ? toggleExpand : void 0,
					onKeyDown: expandable ? toggleFromKeyboard : void 0,
					children: [
						(0, react_jsx_runtime.jsx)("span", {
							className: bash_sample_module_css_default.leading,
							children: leading
						}),
						status !== null && (0, react_jsx_runtime.jsx)("span", {
							className: bash_sample_module_css_default.visuallyHidden,
							children: status
						}),
						(0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, {
							active: running,
							children: [
								(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, {
									className: bash_sample_module_css_default.title,
									children: t(model.titleKey)
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: bash_sample_module_css_default.sep,
									"data-shimmer-decoration": true,
									"aria-hidden": true
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: clsx(bash_sample_module_css_default.summary, exitLabel === null && state === "error" && bash_sample_module_css_default.errorSummary, exitLabel === null && state === "stopped" && bash_sample_module_css_default.stoppedSummary),
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, { children: settlementLine ?? normalSummary })
								}),
								exitLabel !== null && (0, react_jsx_runtime.jsx)(ExitCodeBadge, { label: exitLabel })
							]
						})
					]
				}), open && (0, react_jsx_runtime.jsxs)("div", {
					className: bash_sample_module_css_default.bodyWrap,
					children: [terminal !== null ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TerminalBlock, {
						...terminal.card,
						maxLines: Infinity,
						labels,
						className: bash_sample_module_css_default.terminal
					}) : (0, react_jsx_runtime.jsxs)("div", {
						className: bash_sample_module_css_default.ioCard,
						children: [
							body !== null && (0, react_jsx_runtime.jsxs)("div", {
								className: bash_sample_module_css_default.ioSection,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: bash_sample_module_css_default.ioLabel,
									children: t("row.input")
								}), background ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.CommandText, {
									className: bash_sample_module_css_default.commandInput,
									text: body,
									label: t("row.commandArguments")
								}) : (0, react_jsx_runtime.jsx)("span", {
									className: bash_sample_module_css_default.ioText,
									children: body
								})]
							}),
							body !== null && model.output !== null && (0, react_jsx_runtime.jsx)("span", {
								className: bash_sample_module_css_default.ioDivider,
								"aria-hidden": true
							}),
							model.output !== null && (0, react_jsx_runtime.jsxs)("div", {
								className: bash_sample_module_css_default.ioSection,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: bash_sample_module_css_default.ioLabel,
									children: t("row.output")
								}), (0, react_jsx_runtime.jsx)("span", {
									className: bash_sample_module_css_default.ioText,
									"data-error": state === "error" || void 0,
									children: model.output
								})]
							})
						]
					}), inspect !== void 0 && (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: bash_sample_module_css_default.inspectButton,
						onClick: inspect,
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInspectOutlineRegular, {}), t("row.inspect")]
					})]
				})]
			});
		});
		/** Registers the standalone Bash conversation-row sample. */
		const bashToolviewSample = {
			name: "bash-toolview-sample",
			inject: ["slots"],
			apply(ctx) {
				ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
					name: "tool.call.toolview",
					key: "bash",
					locale: CONVERSATION_NS
				}, BashRow));
			}
		};
		//#endregion
		//#region lib/types/client/tool/toolviews/file-mutation-row.js
		const FILE_MUTATION_ICON = (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 14 });
		const CONTENT_FIELDS = [
			"content",
			"old_string",
			"new_string"
		];
		const KILOBYTE = 1024;
		/** Kilobytes of decoded input at every stage; null before any content field arrives. */
		function contentKilobytes(block) {
			const { args } = block;
			const open = CONTENT_FIELDS.find((key) => args.has(key) && !args.complete(key));
			const completed = CONTENT_FIELDS.reduce((total, key) => key !== open && args.complete(key) ? total + (args.stringLength(key, { step: KILOBYTE }) ?? 0) : total, 0);
			if (open === void 0) return CONTENT_FIELDS.some((key) => args.has(key)) ? Math.ceil(completed / KILOBYTE) : null;
			const chars = completed + (args.stringLength(open, {
				step: KILOBYTE,
				offset: completed
			}) ?? 0);
			return Math.ceil(chars / KILOBYTE);
		}
		/**
		* Shows the path and decoded input size through preparation, execution, and
		* settlement, with the applied diff available once the call settles.
		*/
		function FileMutationRow({ toolName, block, cwd, home, openFile, inspect, useDisclosure, t }) {
			const model = toolRowModel(toolName, block, cwd, home);
			const diff = diffCardModel(block);
			const kilobytes = contentKilobytes(block);
			const size = kilobytes === null ? null : t("tool.preparing.content", { kilobytes });
			return (0, react_jsx_runtime.jsx)(ToolRow, {
				useDisclosure,
				t,
				variant: model.variant,
				toolName,
				icon: FILE_MUTATION_ICON,
				title: t(model.titleKey),
				summary: model.summary,
				summarySuffix: size !== null && model.summary !== "" ? size : void 0,
				output: model.output,
				errorSummary: model.errorSummary,
				diff,
				state: model.state,
				filePath: model.filePath,
				onOpenFile: openFile,
				inspect
			});
		}
		/** Registers the edit and write conversation rows. */
		const fileMutationToolview = {
			name: "file-mutation-toolview",
			inject: ["slots"],
			apply(ctx) {
				ctx.slots.inject("tool.call.toolview", function* () {
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "edit",
						locale: CONVERSATION_NS
					}, FileMutationRow);
					yield ctx.slots.register({
						name: "tool.call.toolview",
						key: "write",
						locale: CONVERSATION_NS
					}, FileMutationRow);
				});
			}
		};
		//#endregion
		//#region lib/types/client/tool/toolviews/read-family-row.js
		/**
		* Compose a read-family row: the shared chrome and model-derived fields, plus the
		* caller's card material.
		* @param props - the toolview runtime share and locale seat.
		* @param card - the card props this row owns.
		* @returns the assembled ToolRow.
		*/
		function readFamilyRow({ toolName, block, cwd, home, openFile, inspect, useDisclosure, t }, card) {
			const model = toolRowModel(toolName, block, cwd, home);
			return (0, react_jsx_runtime.jsx)(ToolRow, {
				useDisclosure,
				t,
				variant: model.variant,
				toolName,
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutlineRegular, { size: 14 }),
				title: t(model.titleKey),
				summary: model.summary,
				bodyRaw: null,
				output: model.output,
				errorSummary: model.errorSummary,
				...card,
				state: model.state,
				filePath: model.filePath,
				onOpenFile: openFile,
				inspect
			});
		}
		//#endregion
		//#region lib/types/client/tool/toolviews/read-row.js
		/**
		* Lets users expand a completed read result and open its reported path at the
		* line the call started from.
		*/
		function ReadRow(props) {
			const { block, cwd, home } = props;
			return readFamilyRow(props, {
				read: readCardModel(block, cwd, home),
				filePathLine: readCallLine(block)
			});
		}
		/** Registers the read tool's conversation row. */
		const readToolview = {
			name: "read-toolview",
			inject: ["slots"],
			apply(ctx) {
				ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
					name: "tool.call.toolview",
					key: "read",
					locale: CONVERSATION_NS
				}, ReadRow));
			}
		};
		//#endregion
		//#region lib/types/client/tool/models/image-card-model.js
		/**
		* Whether a wire value is a usable pixel or byte measure.
		* @param value - unvalidated wire value.
		* @returns true when it is a positive integer.
		*/
		function positiveInteger(value) {
			return typeof value === "number" && Number.isInteger(value) && value > 0;
		}
		/** The envelope `formatImageReadOutput` writes, matched by shape. */
		const IMAGE_ENVELOPE = /^<path>[^\n]*<\/path>\n<type>image<\/type>\n<content>\n[\s\S]*\n<\/content>$/u;
		/** The media types a durable image block may claim; anything else declines.
		*  Hand-written mirror of `ImageMediaType` from dsh-attachment — the wire
		*  boundary needs a runtime check and feature plugins must not import values
		*  from each other; a new member added there must be added here too, or the
		*  decline point below silently degrades that image to the generic card. */
		const IMAGE_MEDIA_TYPES = new Set([
			"image/png",
			"image/jpeg",
			"image/webp",
			"image/gif"
		]);
		/** Runtime membership check; the cast is safe because the set holds exactly the four members. */
		function isImageMediaType(value) {
			return IMAGE_MEDIA_TYPES.has(value);
		}
		/**
		* Narrow the persisted metadata, defensively. Every field arrives unvalidated on
		* replay (an obsolete or hand-edited log reaches here), so any mismatch declines
		* to the generic card rather than throwing. An absent `meta` (a nested call
		* persists none) leaves the path to the call's own `file_path` argument.
		*
		* The attachment id is checked for existence only: it is opaque and
		* provider-owned, and consumers must not parse that representation, so
		* pattern-matching the local content-address form would reject a legitimate id
		* minted by an alternative store.
		* @param meta - persisted presentation metadata of unknown shape.
		* @returns the narrowed path, or null when it does not match.
		*/
		function imageMeta(meta) {
			if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return null;
			const { path } = meta;
			if (typeof path !== "string" || path === "") return null;
			return { path };
		}
		/**
		* Narrow every attachment reference carried by the result's image blocks, in
		* order.
		*
		* The content is the single source of truth for the references: it is what the
		* tool actually returned and what a post-execute hook would replace together
		* with the rest of the content. Every field arrives unvalidated over the wire,
		* so any malformed image block declines to the generic card rather than
		* rendering a partial gallery.
		*
		* The attachment id is checked for existence only — it is opaque and
		* provider-owned, so pattern-matching the local content-address form would reject
		* a legitimate id minted by an alternative store.
export {};
