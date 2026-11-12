/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js — CẮT LẠI 08/11/2026
 *      theo MOT kieu duy nhat (region-based), gộp/cắt tiếp để mỗi lát ≤ 900 dòng.
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#region lib/types/client/chat/ReasoningRow.js
		/** Assistant reasoning disclosure, independent of Tool-call presentation. */
		const THINK_ICON = (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconThinkOutlineRegular, { size: 14 });
		function firstLine(text) {
			const newline = text.indexOf("\n");
			return newline === -1 ? text : text.slice(0, newline);
		}
		function latestCompletedParagraphFirstLine(text) {
			let summary = "";
			let paragraphStart = 0;
			const separator = /\r?\n(?:[\t ]*\r?\n)+/g;
			while (true) {
				const nextParagraph = separator.exec(text);
				const paragraphEnd = nextParagraph === null ? text.length : nextParagraph.index + nextParagraph[0].indexOf("\n");
				const newline = text.indexOf("\n", paragraphStart);
				if (newline !== -1 && newline <= paragraphEnd) {
					const candidate = text.slice(paragraphStart, newline).trim();
					if (candidate !== "") summary = candidate;
				}
				if (nextParagraph === null) return summary;
				paragraphStart = nextParagraph.index + nextParagraph[0].length;
			}
		}
		/**
		* Render one assistant reasoning block collapsed until the reader opens it. The
		* collapsed summary omits double-asterisk markers; expanded content renders
		* the complete Markdown with secondary typography. A streaming preview advances
		* when a paragraph's first line completes. Mode changes toggle CSS display without unmounting
		* collapsed summaries.
		* @param props.text - complete or streaming reasoning text.
		* @param props.running - whether this block is the streaming tail.
		* @param props.usePresentation - live display-policy selector for this reasoning row.
		* @param props.useDisclosure - independent open state with enclosing-Turn resets.
		* @param props.renderSlot - framework renderer for the standard reasoning Body Slot.
		* @param props.t - conversation locale seat for the disclosure and running status.
		* @returns the reasoning disclosure.
		*/
		const ReasoningRow = (0, react.memo)(function ReasoningRow({ text, running, usePresentation, useDisclosure, renderSlot, t }) {
			const { expanded, toggle } = useDisclosure();
			const summaryText = running ? latestCompletedParagraphFirstLine(text) : firstLine(text);
			const summary = (0, react.useMemo)(() => summaryText.replaceAll("**", ""), [summaryText]);
			const preview = usePresentation((policy) => !expanded && summary !== "" && (running || policy.settledReasoningPreview));
			const collapsedContent = (0, react.useMemo)(() => (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
				className: ReasoningRow_module_css_default.separator,
				"data-shimmer-decoration": true,
				"aria-hidden": true
			}), (0, react_jsx_runtime.jsx)("span", {
				className: ReasoningRow_module_css_default.summary,
				"data-streaming": running || void 0,
				children: (0, react_jsx_runtime.jsx)("span", {
					className: ReasoningRow_module_css_default.summaryText,
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, { children: summary })
				})
			})] }), [running, summary]);
			const content = (0, react.useMemo)(() => expanded ? (0, react_jsx_runtime.jsx)("div", {
				className: ReasoningRow_module_css_default.thinkBody,
				children: renderSlot("conversation.chat.reasoning.body", {
					text,
					running
				})
			}) : void 0, [
				expanded,
				renderSlot,
				running,
				text
			]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ReasoningRow_module_css_default.root,
				"data-variant": "think",
				"data-state": running ? "running" : "ok",
				"data-expanded": expanded || void 0,
				"data-preview": preview || void 0,
				children: [running && (0, react_jsx_runtime.jsx)("span", {
					className: accessibility_module_css_default.visuallyHidden,
					children: t("row.running")
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
					rowClassName: ReasoningRow_module_css_default.row,
					leadingClassName: ReasoningRow_module_css_default.leading,
					titleClassName: ReasoningRow_module_css_default.title,
					icon: THINK_ICON,
					title: t("message.think"),
					running,
					open: expanded,
					expandable: true,
					expandOnRowClick: true,
					onToggle: toggle,
					collapsedContent,
					children: content
				})]
			});
		});
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/AssistantMarkdown.module.css.mjs
		const css$8 = ".hWmORq_root{font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-primary);flex-direction:column;display:flex}.hWmORq_body{flex-direction:column;gap:16px;display:flex}.hWmORq_body .md-table-wide{--dsh-table-spare:max(0px, calc((100cqw - var(--dsh-chat-content-width)) / 2));--dsh-table-lead:calc(var(--dsh-table-spare) + min(var(--dsh-chat-content-width), 100cqw) - 100%);box-sizing:border-box;width:calc(100% + var(--dsh-table-lead) + var(--dsh-table-spare));max-width:none;margin-left:calc(-1 * var(--dsh-table-lead));padding-left:var(--dsh-table-lead)}.hWmORq_body .md-table-wide>table{z-index:1;position:relative}.hWmORq_body>[data-turn-process-inline][hidden]{margin-bottom:-16px}.hWmORq_stopped{border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);align-self:flex-start;padding:0 6px;font-size:11px;line-height:18px}.hWmORq_actions{margin-top:16px;margin-left:-6px}";
		const tagId$8 = "@deepseek-ai/dsh-client-ui-chat/AssistantMarkdown.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$8) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$8;
			tag.textContent = css$8;
			document.head.appendChild(tag);
		}
		var AssistantMarkdown_module_css_default = {
			"actions": "hWmORq_actions",
			"body": "hWmORq_body",
			"root": "hWmORq_root",
			"stopped": "hWmORq_stopped"
		};
		//#endregion
		//#region lib/types/client/chat/AssistantMarkdown.js
		/**
		* Standalone fallback for image destinations (query/fragment suffixes are ignored).
		* Chat fileImages resolves decoded file references against cwd; pathImages also
		* serves this component outside that provider and accepts legacy image URL suffixes.
		* Resolve an authored absolute image path against the document's file API.
		* @param base - canonical `document.baseURI` at render time.
		* @param value - authored Markdown destination; URL escapes are decoded once.
		* @returns an absolute Web or Desktop file-API URL, or undefined for unsupported
		* protocols and non-local paths.
		*/
		function localPathMediaUrl(base, value) {
			let path;
			try {
				path = decodeURIComponent(value.split(/[?#]/u)[0] ?? "");
			} catch {
				return;
			}
			return fileMediaUrl(base, path);
		}
		/** Renders non-blank reasoning blocks as independent disclosures alongside the response. */
		const AssistantMarkdown = (0, react.memo)(function AssistantMarkdown({ blocks, streaming, interrupted, loadImage, groupPart, useDisclosure, reasoningHidden = false, usePresentation, revealProcess, mentions, renderSlot, useGroupAction, t }) {
			const labels = (0, react.useMemo)(() => markdownLabels(t), [t]);
			const pathImages = (0, react.useMemo)(() => {
				return { resolve: (value) => localPathMediaUrl(document.baseURI, value) };
			}, []);
			const last = blocks.length - 1;
			if (!(streaming || interrupted === true || blocks.some((block) => block.kind !== "tool-call"))) return null;
			const rendered = [];
			for (let i = 0; i < blocks.length; i++) {
				const block = blocks[i];
				if (block === void 0) continue;
				if (groupPart === "reasoning" && block.kind !== "reasoning") continue;
				if (groupPart === "response" && block.kind === "reasoning") continue;
				switch (block.kind) {
					case "text":
						rendered.push((0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
							text: block.text,
							streaming,
							labels,
							fileMentions: mentions,
							pathImages
						}, i));
						break;
					case "reasoning":
						if (block.text.trim() === "") break;
						rendered.push((0, react_jsx_runtime.jsx)(ProcessReasoning, {
							hidden: reasoningHidden,
							reveal: revealProcess,
							useGroupAction,
							children: (0, react_jsx_runtime.jsx)(ReasoningRow, {
								text: block.text,
								running: streaming && i === last,
								usePresentation,
								useDisclosure,
								renderSlot,
								t
							})
						}, i));
						break;
					case "image": {
						const start = i;
						const group = [block];
						while (i + 1 < blocks.length) {
							const next = blocks[i + 1];
							if (next === void 0 || next.kind !== "image") break;
							group.push(next);
							i += 1;
						}
						rendered.push((0, react_jsx_runtime.jsx)(react.Fragment, { children: renderSlot("conversation.chat.message.images", {
							images: group.map(({ attachment }) => ({ attachment })),
							loadImage,
							align: "start"
						}) }, start));
						break;
					}
					case "tool-call": break;
					default: rendered.push((0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonBlock, {
						label: t("message.unknownBlock"),
						payload: block.block,
						truncatedLabel: (total) => t("json.truncated", { total })
					}, i));
				}
			}
			return (0, react_jsx_runtime.jsx)("div", {
				className: AssistantMarkdown_module_css_default.root,
				"data-streaming": streaming || void 0,
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: AssistantMarkdown_module_css_default.body,
					children: [rendered, interrupted && (groupPart === void 0 || groupPart === "response" || !blocks.some((block) => block.kind !== "reasoning" && block.kind !== "tool-call")) && (0, react_jsx_runtime.jsx)("span", {
						className: AssistantMarkdown_module_css_default.stopped,
						children: t("message.stopped")
					})]
				})
			});
		});
		function ProcessReasoning({ hidden, reveal, useGroupAction, children }) {
			return (0, react_jsx_runtime.jsx)("div", {
				ref: useGroupAction(hidden, reveal ?? NOOP),
				"data-turn-process-inline": hidden || void 0,
				children
			});
		}
		const NOOP = () => {};
		//#endregion
		//#region lib/types/client/chat/AssistantNodeView.js
		/** Streaming, settled, and interrupted Assistant states share one keyed renderer instance. */
		const AssistantNodeView = (0, react.memo)(function AssistantNodeView({ node, groupPart, useDisclosure, useGroupAction, useTurnData, turnProcess, openFile, loadImage, fileMentions, usePresentation, renderSlot, t }) {
			const data = node.data;
			const turn = node.location.kind === "turn" || node.location.kind === "step" ? node.location.turn : void 0;
			const tail = useTurnData("turn-tail");
			const owner = (0, react.useMemo)(() => {
				if (turn?.status !== "closed" || data.finalNode === void 0) return void 0;
				if (tail?.closing?.finalNode.seq !== data.finalNode.seq) return void 0;
				return {
					turn,
					seq: data.finalNode.seq,
					openFile
				};
			}, [
				data.finalNode,
				openFile,
				tail,
				turn
			]);
			const mentions = (0, react.useMemo)(() => owner === void 0 ? void 0 : fileMentions(owner), [fileMentions, owner]);
			const reasoningHidden = turnProcess !== void 0 && turnProcess.foldable && turnProcess.spec.answerStep === data.step && turnProcess.spec.inlineReasoning && !turnProcess.open;
			const revealProcess = (0, react.useCallback)(() => {
				turnProcess?.setOpen(true);
			}, [turnProcess]);
			return (0, react_jsx_runtime.jsx)(AssistantMarkdown, {
				blocks: data.blocks,
				groupPart,
				useDisclosure,
				streaming: data.status === "running",
				interrupted: data.status === "interrupted",
				loadImage,
				reasoningHidden,
				useGroupAction,
				usePresentation,
				renderSlot,
				revealProcess,
				mentions,
				t
			});
		});
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/GenericCommandCard.module.css.mjs
		const css$7 = "._5OnbHa_root{flex-direction:column;display:flex}._5OnbHa_leading{flex-shrink:0}._5OnbHa_title{font-weight:400}._5OnbHa_separator{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}._5OnbHa_summary{min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:auto;overflow:hidden}._5OnbHa_summary[data-error],._5OnbHa_body[data-error]{color:var(--dsw-alias-state-error-primary)}._5OnbHa_body{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-markdown-code-block);max-height:260px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-markdown-code-block-small);white-space:pre-wrap;margin:4px 0 4px 4px;padding:12px 16px;overflow:auto}";
		const tagId$7 = "@deepseek-ai/dsh-client-ui-chat/GenericCommandCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$7) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$7;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		var GenericCommandCard_module_css_default = {
			"body": "_5OnbHa_body",
			"leading": "_5OnbHa_leading",
			"root": "_5OnbHa_root",
			"separator": "_5OnbHa_separator",
			"summary": "_5OnbHa_summary",
			"title": "_5OnbHa_title"
		};
		//#endregion
		//#region lib/types/client/chat/GenericCommandCard.js
		const COMMAND_ICON = (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconApiOutlineRegular, { size: 14 });
		/** Node state → row state semantic (running while unsettled; outcome kind after). */
		function stateOf(outcome) {
			if (outcome === null) return "running";
			return outcome.kind === "error" ? "error" : "ok";
		}
		/**
		* Render a command summary and its lazily mounted multiline output.
		* @param props - command, locale, and optional running label.
		* @returns the command disclosure.
		*/
		const GenericCommandCard = (0, react.memo)(function GenericCommandCard({ node, t, runningSummary }) {
			const [expanded, setExpanded] = (0, react.useState)(false);
			const text = node.outcome?.text;
			const summary = node.outcome === null ? runningSummary ?? t("command.running") : text ?? (node.outcome.kind === "error" ? t("command.failed") : t("command.done"));
			const title = node.name ?? t("command.title");
			const state = stateOf(node.outcome);
			const running = state === "running";
			const body = text !== void 0 && text.includes("\n") ? text : null;
			const open = expanded && body !== null;
			const toggle = (0, react.useCallback)(() => {
				setExpanded((value) => !value);
			}, []);
			const collapsedContent = (0, react.useMemo)(() => (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
				className: GenericCommandCard_module_css_default.separator,
				"data-shimmer-decoration": true,
				"aria-hidden": true
			}), (0, react_jsx_runtime.jsx)("span", {
				className: GenericCommandCard_module_css_default.summary,
				"data-error": state === "error" || void 0,
				children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, { children: summary })
			})] }), [
				running,
				state,
				summary
			]);
			const content = (0, react.useMemo)(() => open ? (0, react_jsx_runtime.jsx)("pre", {
				className: GenericCommandCard_module_css_default.body,
				"data-error": state === "error" || void 0,
				children: body
			}) : void 0, [
				body,
				open,
				state
			]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: GenericCommandCard_module_css_default.root,
				"data-variant": "others",
				"data-state": state,
				children: [
					state === "running" && (0, react_jsx_runtime.jsx)("span", {
						className: accessibility_module_css_default.visuallyHidden,
						children: t("row.running")
					}),
					state === "error" && (0, react_jsx_runtime.jsx)("span", {
						className: accessibility_module_css_default.visuallyHidden,
						children: t("row.failed")
					}),
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
						leadingClassName: GenericCommandCard_module_css_default.leading,
						titleClassName: GenericCommandCard_module_css_default.title,
						icon: COMMAND_ICON,
						title,
						running,
						open,
						expandable: body !== null,
						expandOnRowClick: true,
						keepContentWhenOpen: true,
						onToggle: toggle,
						collapsedContent,
						children: content
					})
				]
			});
		});
		//#endregion
		//#region lib/types/client/chat/CompactionCommandCard.js
		/** Render one manual compaction lifecycle without duplicating its checkpoint marker. */
		function CompactionCommandCard({ node, compaction, t }) {
			if (compaction !== void 0) return (0, react_jsx_runtime.jsx)(CompactionItem, {
				node: compaction,
				title: t("message.compaction.commandTitle"),
				fallbackSummary: node.outcome?.text ?? null,
				t
			});
			if (node.outcome !== null) return (0, react_jsx_runtime.jsx)(GenericCommandCard, {
				node,
				t
			});
			return (0, react_jsx_runtime.jsx)(GenericCommandCard, {
				node,
				t,
				runningSummary: t("message.compaction.running")
			});
		}
		//#endregion
		//#region lib/types/client/chat/CommandNodeView.js
		/** Ordinary command lifecycle renderer with command-name keyed specialization. */
		const CommandNodeView = (0, react.memo)(function CommandNodeView({ node, renderSlot, t }) {
			const command = node.data;
			const owner = (0, react.useMemo)(() => ({ node: command }), [command]);
			return (0, react_jsx_runtime.jsx)("div", {
				className: ChatView_module_css_default.callRow,
				children: renderSlot("conversation.chat.commandview", owner, {
					entryKey: command.name ?? "",
					fallback: (0, react_jsx_runtime.jsx)(GenericCommandCard, {
						...owner,
						t
					})
				})
			});
		});
		/** One integrated `/compact` command and compaction transaction renderer. */
		const ManualCompactionNodeView = (0, react.memo)(function ManualCompactionNodeView({ node, t }) {
			const data = node.data;
			return (0, react_jsx_runtime.jsx)("div", {
				className: ChatView_module_css_default.callRow,
				children: (0, react_jsx_runtime.jsx)(CompactionCommandCard, {
					node: data.command,
					...data.compaction === null ? {} : { compaction: data.compaction },
					t
				})
			});
		});
		//#endregion
		//#region lib/types/client/chat/ReasoningContent.js
		/** Official reasoning content and its default Body Slot adapter. */
		/**
		* Render compact reasoning with caller-supplied labels or Chat's defaults.
		* @param props - display text, streaming state, optional localized labels, and the Factory's locale seat; no Session is required.
		* @returns the standard reasoning content; supplied labels are used without merging defaults.
		*/
		const ReasoningContent = (0, react.memo)(function ReasoningContent({ text, running, labels, t }) {
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
				text,
				streaming: running,
				labels: (0, react.useMemo)(() => labels ?? markdownLabels(t), [labels, t]),
				variant: "compact"
			});
		});
		/**
		* Render the default Body through the same Factory available to third-party wrappers.
		* @param props - original reasoning and the framework's Factory renderer.
		* @returns an occurrence of the official reasoning Content Factory.
		*/
		function DefaultReasoningBody({ text, running, renderFactorySlot }) {
			return renderFactorySlot("conversation.chat.reasoning.content", {
				text,
				running
			});
		}
		//#endregion
		//#region lib/types/client/chat/SystemPromptRow.js
		/**
		* Render one complete system prompt as a collapsed disclosure whose expanded
		* body is the same opaque context chrome: 141px code-block scrollport and
		* model-facing text with its real line breaks. An in-history update uses the
		* same row under its own title.
		* @param props - Complete prompt text, whether it is an update, and the locale seat.
		* @returns The system-prompt disclosure row.
		*/
		function SystemPromptRow({ text, update = false, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
				className: ContextInjectionRow_module_css_default.root,
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutlineRegular, { size: 14 }),
				chevronClassName: ContextInjectionRow_module_css_default.chevron,
				title: t(update ? "message.systemPromptUpdate" : "message.systemPrompt"),
				open,
				expandable: true,
				expandOnRowClick: true,
				onToggle: () => {
					setOpen((value) => !value);
				},
				children: (0, react_jsx_runtime.jsx)("div", {
					className: ContextInjectionRow_module_css_default.body,
					"data-system-prompt-body": true,
					children: (0, react_jsx_runtime.jsx)(OpaqueBody, {
						content: [{
							type: "text",
							text
						}],
						source: null,
						t
					})
				})
			});
		}
		/** System-prompt keyed Chat renderer. */
		const SystemPromptNodeView = (0, react.memo)(function SystemPromptNodeView({ node, t }) {
			return (0, react_jsx_runtime.jsx)(SystemPromptRow, {
				text: node.data.text,
				update: node.data.update === true,
				t
			});
		});
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/TurnProcessNodeView.module.css.mjs
		const css$6 = ".l_V-RG_root{box-sizing:border-box;width:100%;min-width:0;height:calc(33px + var(--dsh-content-font-delta,0px));border:none;border-bottom:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);font:inherit;font-size:var(--dsh-content-font-size,14px);cursor:pointer;text-align:left;background:0 0;align-items:center;padding:0 0 8px;transition:color .1s;display:flex}.l_V-RG_root:disabled{cursor:default}.l_V-RG_root:hover:not(:disabled){color:var(--dsw-alias-label-secondary)}.l_V-RG_chevron{width:14px;height:14px;color:inherit;flex:none;margin-left:4px;transition:transform .1s}.l_V-RG_root[data-open] .l_V-RG_chevron{transform:rotate(180deg)}.l_V-RG_label{min-width:0;font-size:inherit;line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.l_V-RG_durationNumber{font-family:var(--ds-font-family-code);font-variant-numeric:tabular-nums}@media (prefers-reduced-motion:reduce){.l_V-RG_root,.l_V-RG_chevron{transition:none}}";
		const tagId$6 = "@deepseek-ai/dsh-client-ui-chat/TurnProcessNodeView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$6) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$6;
			tag.textContent = css$6;
			document.head.appendChild(tag);
		}
		var TurnProcessNodeView_module_css_default = {
			"chevron": "l_V-RG_chevron",
			"durationNumber": "l_V-RG_durationNumber",
			"label": "l_V-RG_label",
			"root": "l_V-RG_root"
		};
		//#endregion
		//#region lib/types/client/chat/TurnProcessNodeView.js
		/** Settled Turn duration and process disclosure above its content. */
		const TurnProcessNodeView = (0, react.memo)(function TurnProcessNodeView({ node, turnProcess, t }) {
			if (turnProcess === void 0) throw new Error("turn-process node requires Turn process owner state");
			const open = !turnProcess.foldable || turnProcess.open;
			const turn = node.location.kind === "turn" || node.location.kind === "step" ? node.location.turn : void 0;
			if (turn?.status !== "closed") return null;
			const canCollapse = turnProcess.foldable && turnProcess.hasContent && !turnProcessAlwaysOpen(node);
			const reason = turn.end?.data.reason.kind;
			const stopped = reason === "aborted" || reason === "interrupted";
			const elapsedMs = turn.start === void 0 || turn.end === void 0 ? void 0 : Math.max(1e3, turn.end.time - turn.start.time);
			const duration = elapsedMs === void 0 || stopped || reason === "error" ? void 0 : formatRunDuration(elapsedMs, t);
			const label = stopped ? t("message.stopped") : reason === "error" ? t("message.turnProcess.failed") : duration === void 0 ? t("message.turnProcess.worked") : t("message.turnProcess.took");
			const announcement = stopped ? t("message.stopped") : reason === "error" ? t("message.turnProcess.failed") : t("message.turnProcess.worked");
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
				className: accessibility_module_css_default.visuallyHidden,
				role: "status",
				"aria-live": "polite",
				"aria-atomic": "true",
				children: announcement
			}), (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: TurnProcessNodeView_module_css_default.root,
				"data-open": open || void 0,
				"data-turn-process": node.data.turn,
				"data-turn-process-messages": node.data.messageCount,
				"data-turn-process-tool-calls": node.data.toolCallCount,
				"data-turn-process-subagents": node.data.subagentCount,
				disabled: !canCollapse,
				"aria-expanded": turnProcess.hasContent ? open : void 0,
				onClick: (event) => {
					event.currentTarget.focus();
					turnProcess.setOpen(!open);
				},
				children: [(0, react_jsx_runtime.jsxs)("span", {
					className: TurnProcessNodeView_module_css_default.label,
					children: [label, duration?.map((part, index) => (0, react_jsx_runtime.jsx)("span", {
						className: part.numeric ? TurnProcessNodeView_module_css_default.durationNumber : void 0,
						children: part.text
					}, index))]
				}), canCollapse && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: TurnProcessNodeView_module_css_default.chevron })]
			})] });
		});
		//#endregion
		//#region lib/types/client/chat/token-format.js
		/**
		* Compact token count: 517 / 12.2K / 517K / 1.2M.
		* @param value - non-negative token count.
		* @param t - Chat locale seat.
		* @returns locale-owned compact display string.
		*/
		function formatTokens(value, t) {
			const scaled = (candidate) => candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10);
			if (value < 1e3) return String(value);
			if (value < 1e6) return t("number.thousand", { value: scaled(value / 1e3) });
			return t("number.million", { value: scaled(value / 1e6) });
		}
		/**
		* Exact integer token count with locale-owned digit grouping.
		* @param value - non-negative safe integer token count.
		* @param t - Chat locale seat.
		* @returns an unrounded display string.
		*/
		function formatExactTokens(value, t) {
			const digits = String(value);
			const groups = [];
			for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end));
			return groups.join(t("number.groupSeparator"));
		}
		/** Round a cache-read ratio to exact percentage units, with positive ties rounded up. */
		function roundedPercentUnits(cacheReadTokens, denominator, decimalPlaces) {
			const scale = (decimalPlaces === 0 ? 1 : 10) * 100;
			const doubledScale = scale * 2;
			const denominatorQuotient = Math.floor(denominator / doubledScale);
			const denominatorRemainder = denominator % doubledScale;
			let lower = 0;
			let upper = scale;
			while (lower < upper) {
				const candidate = Math.floor((lower + upper + 1) / 2);
				const factor = candidate * 2 - 1;
				if (cacheReadTokens >= factor * denominatorQuotient + Math.ceil(factor * denominatorRemainder / doubledScale)) lower = candidate;
				else upper = candidate - 1;
			}
			return lower;
		}
		function displayPercentUnits(units, decimalPlaces) {
			if (decimalPlaces === 0) return String(units);
			const whole = Math.floor(units / 10);
			const tenths = units % 10;
			return tenths === 0 ? String(whole) : `${whole}.${tenths}`;
		}
		/**
		* Display-ready cache-hit share without rounding a partial hit to 100%.
		* @param cacheReadTokens - exact prompt tokens served from cache.
		* @param promptTokens - exact aggregate prompt tokens.
		* @param decimalPlaces - ordinary-ratio precision; partial hits that would
		* round to 100 automatically use enough additional precision to stay honest.
		* @returns percentage text, or null when there was no prompt input.
		*/
		function formatCacheHitPercent(cacheReadTokens, promptTokens, decimalPlaces = 0) {
			if (promptTokens === 0) return null;
			const missedInputTokens = promptTokens - cacheReadTokens;
			if (missedInputTokens === 0) return "100";
			const roundedUnits = roundedPercentUnits(cacheReadTokens, promptTokens, decimalPlaces);
			if (roundedUnits < (decimalPlaces === 0 ? 100 : 1e3)) return displayPercentUnits(roundedUnits, decimalPlaces);
			let distinguishingPlaces = 1;
			let scaledDoubleGap = missedInputTokens * 200;
			const denominatorTens = Math.floor(promptTokens / 10);
			while (scaledDoubleGap <= denominatorTens) {
				scaledDoubleGap *= 10;
				distinguishingPlaces += 1;
			}
			const denominatorOnes = promptTokens % 10;
			let roundedLoss = 5;
			for (let loss = 1; loss < 5; loss += 1) {
				const factor = loss * 2 + 1;
				const threshold = factor * denominatorTens + Math.floor(factor * denominatorOnes / 10);
				if (scaledDoubleGap <= threshold) {
					roundedLoss = loss;
					break;
				}
			}
			return `99.${"9".repeat(distinguishingPlaces - 1)}${10 - roundedLoss}`;
		}
		//#endregion
		//#region lib/types/client/chat/stat-dialog.js
		/** Viewport margin the placement clamp keeps (the Menu portal margin). */
		const PANEL_MARGIN = 12;
		/** Distance between the trigger's top edge and the panel's bottom. */
		const PANEL_GAP = 8;
		/**
		* Unplaced portal panel: hidden but laid out so the clamp measures real
		* dimensions (the `useAnchoredPosition` measure pass).
		*/
		const MEASURE_STYLE = {
			visibility: "hidden",
			left: 0,
			top: 0
		};
		/**
		* One trigger-anchored dialog seat: open state, viewport-clamped placement, outside-close.
		* @returns the seat; spread `pos ?? MEASURE_STYLE` onto the portaled panel.
		*/
		function useStatDialog() {
			const [open, setOpen] = (0, react.useState)(false);
			const rootRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const pos = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open,
				anchorRef: rootRef,
				panelRef,
				side: "top",
				gap: PANEL_GAP,
				margin: PANEL_MARGIN
			});
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open, setOpen, panelRef);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onKeyDown = (e) => {
					if (e.key === "Escape") setOpen(false);
				};
				const onClick = (e) => {
					if (e.target instanceof Node && rootRef.current?.contains(e.target) !== true && panelRef.current?.contains(e.target) !== true) setOpen(false);
				};
				document.addEventListener("keydown", onKeyDown);
				document.addEventListener("click", onClick, true);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
					document.removeEventListener("click", onClick, true);
				};
			}, [open, setOpen]);
			return {
				open,
				setOpen,
				rootRef,
				panelRef,
				pos
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/TurnUsagePanel.module.css.mjs
		const css$5 = ".Q51KRG_root{min-width:0;display:inline-flex}.Q51KRG_root+.Q51KRG_root{margin-left:-6px}.Q51KRG_trigger{min-width:0;height:calc(28px + var(--dsh-content-font-delta,0px));border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);font-variant-numeric:tabular-nums;line-height:calc(24px + var(--dsh-content-font-delta,0px));white-space:nowrap;cursor:pointer;background:0 0;border:none;align-items:center;gap:4px;padding:6px 8px;display:inline-flex}.Q51KRG_label{text-overflow:ellipsis;min-width:0;overflow:hidden}.Q51KRG_trigger svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px));flex:none}.Q51KRG_trigger:hover,.Q51KRG_trigger[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary)}@media (width<=480px){.Q51KRG_trigger{width:calc(28px + var(--dsh-content-font-delta,0px));justify-content:center;padding:6px}.Q51KRG_trigger .Q51KRG_label{display:none}.Q51KRG_root+.Q51KRG_root{margin-left:0}}";
		const tagId$5 = "@deepseek-ai/dsh-client-ui-chat/TurnUsagePanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var TurnUsagePanel_module_css_default = {
			"label": "Q51KRG_label",
			"root": "Q51KRG_root",
			"trigger": "Q51KRG_trigger"
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/stat-dialog.module.css.mjs
		const css$4 = ".bRhRbq_panel{z-index:1100;box-sizing:border-box;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);width:max-content;min-width:min(300px,100vw - 24px);max-width:min(440px,100vw - 24px);backdrop-filter:var(--dsw-menu-backdrop-filter);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);cursor:default;border:0;padding:16px;font-size:12px;line-height:18px;position:fixed}.bRhRbq_title{color:var(--dsw-alias-label-primary);justify-content:space-between;gap:16px;margin-bottom:8px;font-weight:500;display:flex}.bRhRbq_titleRule{border-top:.5px solid var(--dsw-alias-border-l2);margin-bottom:10px}.bRhRbq_titleValue{font-variant-numeric:tabular-nums}.bRhRbq_titleLabel{align-items:center;gap:6px;min-width:0;display:inline-flex}.bRhRbq_titleLabel svg{flex:none;width:14px;height:14px}.bRhRbq_details{color:var(--dsw-alias-label-tertiary);grid-template-columns:minmax(76px,auto) minmax(0,1fr);gap:6px 16px;margin:0;display:grid}.bRhRbq_details dt,.bRhRbq_details dd{min-width:0;margin:0}.bRhRbq_details dd{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;text-align:right}.bRhRbq_details .bRhRbq_route{overflow-wrap:anywhere}.bRhRbq_reasoning{color:var(--dsw-alias-label-tertiary);white-space:nowrap}";
		const tagId$4 = "@deepseek-ai/dsh-client-ui-chat/stat-dialog.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var stat_dialog_module_css_default = {
			"details": "bRhRbq_details",
			"panel": "bRhRbq_panel",
			"reasoning": "bRhRbq_reasoning",
			"route": "bRhRbq_route",
			"title": "bRhRbq_title",
			"titleLabel": "bRhRbq_titleLabel",
			"titleRule": "bRhRbq_titleRule",
			"titleValue": "bRhRbq_titleValue"
		};
		//#endregion
		//#region lib/types/client/chat/TurnUsagePanel.js
		/** Completed-Turn token usage action and its accounting details dialog. */
		function formatCompactCount(value, t) {
			return t("message.turnUsage.count", { count: formatTokens(value, t) });
		}
		function formatExactCount(value, t) {
			return t("message.turnUsage.count", { count: formatExactTokens(value, t) });
		}
		/**
		* Turn-usage IconActions pill with a click-open Turn-usage details dialog.
		* @param props - Turn usage buckets and locale seat.
		* @returns The trigger and, while open, its portaled dialog anchored above the trigger.
		*/
		function TurnUsagePanel({ usage, t }) {
			const { open, setOpen, rootRef, panelRef, pos } = useStatDialog();
			const cacheHit = usage.cacheReadTokens === void 0 ? null : formatCacheHitPercent(usage.cacheReadTokens, usage.totalTokens - usage.outputTokens, 1);
			const total = formatCompactCount(usage.totalTokens, t);
			// 08/11/2026 (dev-5, B1 — Lead duyệt): KHÔNG hard-code chuỗi thương hiệu. Bảng tên do part-018 nạp MỘT LẦN
			//   từ `session/modelCatalog` (lấy từ CONFIG: groups[].name + models[].name); thiếu ⇒ fallback
			//   `provider/model` y như bản gốc (dsh-client-ui-chat/lib/client.js:6851).
			const routeLabel = (route) => __gbhRouteNames[route.provider + "|" + route.model] ?? `${route.provider}/${route.model}`;
			const routes = usage.routes?.map(routeLabel).join(", ") ?? "";
			return (0, react_jsx_runtime.jsxs)("span", {
				ref: rootRef,
				className: TurnUsagePanel_module_css_default.root,
				children: [(0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: TurnUsagePanel_module_css_default.trigger,
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDatabaseOutlineRegular, {}), (0, react_jsx_runtime.jsx)("span", {
						className: TurnUsagePanel_module_css_default.label,
						children: t("message.turnUsage.consumed", { total })
					})]
				}), open && (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)("div", {
					ref: panelRef,
					className: stat_dialog_module_css_default.panel,
					role: "dialog",
					"aria-label": t("message.turnUsage.title"),
					style: pos ?? MEASURE_STYLE,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: stat_dialog_module_css_default.title,
							children: [(0, react_jsx_runtime.jsxs)("span", {
								className: stat_dialog_module_css_default.titleLabel,
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDatabaseOutlineRegular, {}), t("message.turnUsage.title")]
							}), (0, react_jsx_runtime.jsx)("span", {
								className: stat_dialog_module_css_default.titleValue,
								children: formatExactCount(usage.totalTokens, t)
							})]
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: stat_dialog_module_css_default.titleRule,
							"aria-hidden": true
						}),
						(0, react_jsx_runtime.jsxs)("dl", {
							className: stat_dialog_module_css_default.details,
							"data-turn-usage-details": true,
							children: [
								routes !== "" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("message.turnUsage.model") }), (0, react_jsx_runtime.jsx)("dd", {
									className: stat_dialog_module_css_default.route,
									children: routes
								})] }),
								cacheHit !== null && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("message.turnUsage.cacheHit") }), (0, react_jsx_runtime.jsx)("dd", { children: `${cacheHit}%` })] }),
								(0, react_jsx_runtime.jsx)("dt", { children: t("message.turnUsage.input") }),
								(0, react_jsx_runtime.jsx)("dd", { children: formatExactCount(usage.uncachedInputTokens, t) }),
								usage.cacheReadTokens !== void 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("message.turnUsage.cacheRead") }), (0, react_jsx_runtime.jsx)("dd", { children: formatExactCount(usage.cacheReadTokens, t) })] }),
								usage.cacheWriteTokens !== void 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("message.turnUsage.cacheWrite") }), (0, react_jsx_runtime.jsx)("dd", { children: formatExactCount(usage.cacheWriteTokens, t) })] }),
								(0, react_jsx_runtime.jsx)("dt", { children: t("message.turnUsage.output") }),
								(0, react_jsx_runtime.jsxs)("dd", { children: [formatExactCount(usage.outputTokens, t), usage.reasoningTokens !== void 0 && (0, react_jsx_runtime.jsx)("span", {
									className: stat_dialog_module_css_default.reasoning,
									children: t("message.turnUsage.reasoning", { tokens: formatExactCount(usage.reasoningTokens, t) })
								})] })
							]
						})
					]
				}), document.body)]
			});
		}
		//#endregion
		//#region lib/types/client/chat/turn-assistant.js
		/**
		* Collect visible prose from one Assistant lifecycle.
		* @param blocks - Assistant content blocks.
		* @returns concatenated text blocks.
		*/
		function assistantText(blocks) {
			return blocks.flatMap((block) => block.kind === "text" ? [block.text] : []).join("");
		}
		//#endregion
		//#region lib/types/client/contract/assistant-content.js
		/**
		* Test whether Assistant blocks contain a user-facing reply rather than only
		* reasoning or Tool-call protocol material.
		* @param blocks - Assistant content blocks.
		* @returns whether the blocks contain visible reply content.
		*/
		function hasAssistantReplyContent(blocks) {
			return blocks.some((block) => {
				if (block.kind === "reasoning" || block.kind === "tool-call") return false;
				if (block.kind === "text") return block.text.trim() !== "";
				return true;
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/TurnTailNodeView.module.css.mjs
		const css$3 = ".TS9iAW_root{flex-direction:column;gap:16px;display:flex}.TS9iAW_actions{margin-top:4px;margin-left:-6px}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-chat/TurnTailNodeView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var TurnTailNodeView_module_css_default = {
			"actions": "TS9iAW_actions",
			"root": "TS9iAW_root"
		};
		//#endregion
		//#region lib/types/client/chat/TurnTailNodeView.js
		function lastContent(snapshot, turn, skipWarning) {
			const keys = snapshot.locations.getTurn(turn);
			for (let index = keys.length - 1; index >= 0; index--) {
				const node = snapshot.nodes.get(keys[index]);
				if (node === void 0 || node.kind === "turn-tail" || node.kind === "turn-process" || skipWarning && node.kind === "turn-max-tokens") continue;
				return node;
			}
		}
		/** Turn-local actions and feature tail over the Location index, independent of Assistant placement. */
		const TurnTailNodeView = (0, react.memo)(function TurnTailNodeView({ node, openFile, forkAt, renderSlot, t, useAccess, useChat, usePerformanceUsage }) {
			const detailed = usePerformanceUsage((mode) => mode) === "detailed";
			const forkAllowed = useAccess("session/fork");
			const data = node.data;
			const hasLaterChatNode = useChat((snapshot) => (lastContent(snapshot, data.turn, true)?.anchorSeq ?? -1) > (data.closing?.finalNode.seq ?? data.seq));
			const endsWithResponse = useChat((snapshot) => {
				if (snapshot.timeline.turnOrder.at(-1) !== data.turn) return false;
				const last = lastContent(snapshot, data.turn, false);
				const block = last?.kind === "assistant-step" ? last.data.blocks.findLast((candidate) => candidate.kind !== "text" && candidate.kind !== "reasoning" || candidate.text.trim() !== "") : void 0;
				return block !== void 0 && hasAssistantReplyContent([block]);
			});
			const turn = node.location.kind === "turn" || node.location.kind === "step" ? node.location.turn : void 0;
			if (turn === void 0) return null;
			const closing = data.closing;
			const tail = renderSlot("conversation.chat.turnTail", {
				turn,
				seq: closing?.finalNode.seq ?? data.seq,
				openFile
			});
			if (closing === null) return tail === null ? null : (0, react_jsx_runtime.jsx)("div", {
				className: TurnTailNodeView_module_css_default.root,
				"data-turn-tail": data.turn,
				children: tail
			});
			const messageId = closing.finalNode.messageId;
			const assistantActions = messageId === void 0 ? null : renderSlot("conversation.chat.assistant-actions", { messageId });
			return (0, react_jsx_runtime.jsxs)("div", {
				className: TurnTailNodeView_module_css_default.root,
				"data-turn-tail": data.turn,
				"data-actions-reveal": endsWithResponse ? "always" : "hover",
				children: [tail, (0, react_jsx_runtime.jsx)(MessageIconActions, {
					text: assistantText(closing.blocks),
					time: closing.time,
					clock: "end",
					onBranch: forkAllowed ? () => {
						forkAt(data.seq);
					} : void 0,
					branchUnavailable: data.branchUnavailable || hasLaterChatNode,
					className: TurnTailNodeView_module_css_default.actions,
					extraActions: assistantActions,
					usageAction: detailed && data.tokenUsage !== void 0 ? (0, react_jsx_runtime.jsx)(TurnUsagePanel, {
						usage: data.tokenUsage,
						t
					}) : null,
					t
				})]
			});
		});
		//#endregion