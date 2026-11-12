/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			const terminalBody = (0, react.useMemo)(() => terminal === void 0 || terminal === null ? null : localizeTerminalCardModel(terminal, t), [terminal, t]);
			const diffBody = diff ?? null;
			const readBody = read ?? null;
			const imageBody = image !== void 0 && image !== null && renderSlot !== void 0 && loadImage !== void 0 ? image : null;
			const searchBody = search ?? null;
			const webBody = web ?? null;
			const askQuestionBody = askQuestion ?? null;
			const detailsBody = details ?? null;
			const inputRaw = bodyRaw ?? null;
			const outputText = output ?? null;
			const card = askQuestionBody ?? terminalBody ?? diffBody ?? readBody ?? imageBody ?? searchBody ?? webBody ?? detailsBody;
			const expandable = state !== "preparing" && (inputRaw !== null || outputText !== null || card !== null);
			const open = expanded && expandable;
			const bodyText = (0, react.useMemo)(() => open && card === null && inputRaw !== null ? formatToolBody(variant, inputRaw) : null, [
				card,
				inputRaw,
				open,
				variant
			]);
			const status = stateStatus$1(state, t);
			const running = state === "running" || state === "preparing";
			const normalSummary = terminalBody?.description ?? (open ? detailsBody?.expandedSummary ?? summary : summary);
			const exitLabel = terminalExitLabel(terminal, t);
			const summaryText = (state === "error" && exitLabel === null ? errorSummary ?? normalSummary : null) ?? normalSummary;
			const diffStat = (0, react.useMemo)(() => diffBody === null ? null : (0, _deepseek_ai_dsh_client_ui_primitives.diffTotals)(diffBody.card.diffs), [diffBody]);
			const settledWithCue = state === "error" || state === "stopped";
			const suffix = settledWithCue ? null : summarySuffix ?? null;
			const totals = settledWithCue ? null : diffStat;
			const openFile = (0, react.useMemo)(() => filePath !== void 0 && onOpenFile !== void 0 && !settledWithCue ? (event) => {
				event.stopPropagation();
				if (filePathLine === void 0) onOpenFile(filePath);
				else onOpenFile(filePath, { line: filePathLine });
			} : void 0, [
				filePath,
				filePathLine,
				onOpenFile,
				settledWithCue
			]);
			const linkHref = settledWithCue ? void 0 : href;
			const summaryLinkKeyDown = (0, react.useCallback)((event) => {
				if (event.key === "Enter" || event.key === " ") event.stopPropagation();
			}, []);
			const cardBody = variant === "code" ? null : bodyText;
			const collapsedContent = (0, react.useMemo)(() => summaryText !== "" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)("span", {
					className: ToolRow_module_css_default.sep,
					"data-shimmer-decoration": true,
					"aria-hidden": true
				}),
				exitLabel === null && openFile !== void 0 ? (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: ToolRow_module_css_default.fileLink,
					onClick: openFile,
					onKeyDown: summaryLinkKeyDown,
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, { children: summaryText })
				}) : exitLabel === null && linkHref !== void 0 ? (0, react_jsx_runtime.jsx)("a", {
					className: ToolRow_module_css_default.fileLink,
					href: linkHref,
					target: "_blank",
					rel: "noopener noreferrer",
					onClick: stopLinkClick,
					onKeyDown: summaryLinkKeyDown,
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, { children: summaryText })
				}) : (0, react_jsx_runtime.jsx)("span", {
					className: clsx(ToolRow_module_css_default.summary, exitLabel === null && state === "error" && ToolRow_module_css_default.errorSummary, exitLabel === null && state === "stopped" && ToolRow_module_css_default.stoppedSummary),
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, { children: summaryText })
				}),
				exitLabel !== null && (0, react_jsx_runtime.jsx)(ExitCodeBadge, { label: exitLabel }),
				suffix !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, {
					className: ToolRow_module_css_default.summarySuffix,
					children: suffix
				}),
				totals !== null && (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, {
					className: clsx(ToolRow_module_css_default.summarySuffix, ToolRow_module_css_default.diffStat),
					children: [
						(0, react_jsx_runtime.jsx)("span", {
							className: ToolRow_module_css_default.diffAdded,
							children: `+${totals.added}`
						}),
						" ",
						(0, react_jsx_runtime.jsx)("span", {
							className: ToolRow_module_css_default.diffRemoved,
							children: `-${totals.removed}`
						})
					]
				})
			] }), [
				summaryLinkKeyDown,
				linkHref,
				openFile,
				state,
				suffix,
				totals,
				summaryText,
				exitLabel
			]);
			const expandedContent = (0, react.useMemo)(() => open ? (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(ToolRow_module_css_default.bodyWrap, detailsBody !== null && ToolRow_module_css_default.detailsBodyWrap),
				children: [askQuestionBody !== null ? (0, react_jsx_runtime.jsx)(AskQuestionCard, { card: askQuestionBody }) : terminalBody !== null ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TerminalBlock, {
					...terminalBody.card,
					maxLines: Infinity,
					labels: terminalLabels,
					className: ToolRow_module_css_default.terminalBody
				}) : diffBody !== null ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DiffBlock, {
					...diffBody.card,
					labels: diffLabels,
					maxLines: 9,
					className: ToolRow_module_css_default.diffBody
				}) : readBody !== null ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ReadBlock, {
					...readBody,
					labels: readLabels,
					maxLines: 8,
					className: ToolRow_module_css_default.readBody
				}) : imageBody !== null ? (0, react_jsx_runtime.jsxs)("div", {
					className: ToolRow_module_css_default.imageBody,
					children: [
						renderSlot !== void 0 && loadImage !== void 0 && renderSlot("tool.call.images", {
							images: imageBody.images,
							loadImage,
							align: "start"
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: ToolRow_module_css_default.imageMeta,
							children: [(0, react_jsx_runtime.jsx)("div", { children: imageBody.path }), imageBody.images.map(({ attachment }, index) => (0, react_jsx_runtime.jsx)("div", { children: attachment.originalDimensions === void 0 ? t("row.imageSize", {
								width: attachment.width,
								height: attachment.height,
								bytes: attachment.bytes
							}) : t("row.imageSizeDownscaled", {
								width: attachment.width,
								height: attachment.height,
								originalWidth: attachment.originalDimensions.width,
								originalHeight: attachment.originalDimensions.height,
								bytes: attachment.bytes
							}) }, index))]
						}),
						imageBody.extraText !== null && (0, react_jsx_runtime.jsx)("div", {
							className: ToolRow_module_css_default.imageExtra,
							children: imageBody.extraText
						})
					]
				}) : searchBody !== null ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SearchBlock, {
					...searchBody.card,
					labels: searchLabels,
					maxLines: 8,
					className: ToolRow_module_css_default.searchBody
				}), searchBody.recovery !== void 0 && (0, react_jsx_runtime.jsx)("div", {
					className: ToolRow_module_css_default.searchRecovery,
					children: searchBody.recovery
				})] }) : webBody !== null ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.WebBlock, {
					...webBody,
					labels: webLabels,
					className: ToolRow_module_css_default.webBody
				}) : detailsBody !== null ? (0, react_jsx_runtime.jsx)(ToolDetails, {
					model: detailsBody,
					hasInspect: inspect !== void 0,
					t,
					onOpenFile
				}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [variant === "code" && bodyText !== null && (0, react_jsx_runtime.jsx)("div", {
					className: ToolRow_module_css_default.bodyScroll,
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.CodeBlock, {
						code: bodyText,
						lang: "typescript",
						copyLabel: t("copy"),
						copiedLabel: t("copied"),
						toolbarLabels: codeToolbarLabels(t),
						className: ToolRow_module_css_default.codeBody
					})
				}), (cardBody !== null || outputText !== null) && (0, react_jsx_runtime.jsxs)("div", {
					className: ToolRow_module_css_default.ioCard,
					children: [
						cardBody !== null && (0, react_jsx_runtime.jsxs)("div", {
							className: ToolRow_module_css_default.ioSection,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: ToolRow_module_css_default.ioLabel,
								children: t("row.input")
							}), (0, react_jsx_runtime.jsx)("span", {
								className: ToolRow_module_css_default.ioText,
								children: cardBody
							})]
						}),
						cardBody !== null && outputText !== null && (0, react_jsx_runtime.jsx)("span", {
							className: ToolRow_module_css_default.ioDivider,
							"aria-hidden": true
						}),
						outputText !== null && (0, react_jsx_runtime.jsxs)("div", {
							className: ToolRow_module_css_default.ioSection,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: ToolRow_module_css_default.ioLabel,
								children: t("row.output")
							}), (0, react_jsx_runtime.jsx)("span", {
								className: ToolRow_module_css_default.ioText,
								"data-error": state === "error" || void 0,
								children: outputText
							})]
						})
					]
				})] }), inspect !== void 0 && (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: ToolRow_module_css_default.inspectButton,
					onClick: inspect,
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInspectOutlineRegular, {}), t("row.inspect")]
				})]
			}) : void 0, [
				open,
				detailsBody,
				askQuestionBody,
				terminalBody,
				terminalLabels,
				diffBody,
				diffLabels,
				readBody,
				readLabels,
				imageBody,
				renderSlot,
				loadImage,
				searchBody,
				searchLabels,
				webBody,
				webLabels,
				inspect,
				t,
				onOpenFile,
				variant,
				bodyText,
				cardBody,
				outputText,
				state
			]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ToolRow_module_css_default.root,
				"data-variant": variant,
				"data-tool": toolName,
				"data-state": state,
				children: [status !== null && (0, react_jsx_runtime.jsx)("span", {
					className: ToolRow_module_css_default.visuallyHidden,
					children: status
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
					rowClassName: ToolRow_module_css_default.row,
					leadingClassName: ToolRow_module_css_default.leading,
					titleClassName: ToolRow_module_css_default.title,
					icon,
					title,
					running,
					open,
					expandable,
					expandOnRowClick: true,
					keepContentWhenOpen: true,
					onToggle: toggleExpand,
					collapsedContent,
					children: expandedContent
				})]
			});
		});
		//#endregion
		//#region lib/types/client/tool/toolviews/GenericToolCard.js
		/** Variant leading icons (figma table); all glyphs render at 14 inside the 16px leading box. */
		const VARIANT_ICONS = {
			search: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: 14 }),
			read: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutlineRegular, { size: 14 }),
			bash: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconApiOutlineRegular, { size: 14 }),
			write: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 14 }),
			edit: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 14 }),
			code: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size: 14 }),
			others: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkleRegular, { size: 14 })
		};
		/** @param props - current tool stage and locale. @returns its preparation or dispatched card. */
		function GenericToolCard({ toolName, block, cwd, home, openFile, inspect, useDisclosure, t }) {
			const model = toolRowModel(toolName, block, cwd, home);
			const autoReview = model.autoReviewDenial === null ? null : localizeAutoReviewDenial(model.autoReviewDenial, t);
			const terminal = terminalCardModel(block, cwd);
			const read = readCardModel(block, cwd, home);
			const diff = diffCardModel(block);
			const search = searchCardModel(block);
			const web = webCardModel(block);
			const state = model.state === "ok" && terminal !== null && terminalFailed(terminal) ? "error" : model.state;
			const singleFile = model.filePath !== void 0;
			return (0, react_jsx_runtime.jsx)(ToolRow, {
				useDisclosure,
				t,
				variant: model.variant,
				toolName,
				icon: VARIANT_ICONS[model.variant],
				title: t(model.titleKey),
				summary: model.summary,
				bodyRaw: singleFile || autoReview !== null ? null : model.bodyRaw,
				output: autoReview?.output ?? model.output,
				errorSummary: autoReview?.summary ?? model.errorSummary,
				terminal,
				diff,
				read,
				search,
				web,
				state,
				filePath: model.filePath,
				onOpenFile: singleFile ? openFile : void 0,
				inspect
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-tool/src/client/tool/ToolCallTree.module.css.mjs
		const css$2 = ".ztWv_q_callRow{border-radius:var(--dsw-radius-sm)}.ztWv_q_subCalls{border-left:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:4px;margin:4px 0 2px 22px;padding-left:8px;display:flex}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-tool/ToolCallTree.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-tool";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var ToolCallTree_module_css_default = {
			"callRow": "ztWv_q_callRow",
			"subCalls": "ztWv_q_subCalls"
		};
		//#endregion
		//#region lib/types/client/tool/ToolCallTree.js
		/** Root/subcall Tool composition with one keyed atomic dispatch path. */
		function toolCallPhase(block) {
			if ("kind" in block) return {
				phase: "result",
				block
			};
			return block.phase === "preparing" ? {
				phase: "preparing",
				block
			} : {
				phase: "start",
				block
			};
		}
		/** Resolve a Tool call's wire name from its current stage. */
		function callName(call) {
			return call.phase === "result" ? call.block.call?.name ?? "" : call.block.name;
		}
		/** One atomic call dispatched through the Tool-owned keyed slot. */
		const ToolCall = (0, react.memo)(function ToolCall({ renderSlot, callId, toolName, call, openFile, cwd, home, inspectCall, loadImage, useDisclosure, t, children }) {
			const owner = (0, react.useMemo)(() => ({
				callId,
				toolName,
				...call,
				openFile,
				cwd,
				home,
				loadImage,
				useDisclosure,
				inspect: inspectCall === void 0 ? void 0 : () => {
					inspectCall(callId);
				}
			}), [
				callId,
				toolName,
				call,
				openFile,
				cwd,
				home,
				loadImage,
				inspectCall,
				useDisclosure
			]);
			const autoReviewDenied = (0, react.useMemo)(() => call.phase === "result" && toolRowModel(toolName, call.block).autoReviewDenial !== null, [toolName, call]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ToolCallTree_module_css_default.callRow,
				"data-chat-anchor-key": `call:${callId}`,
				"data-chat-call-id": callId,
				children: [autoReviewDenied ? (0, react_jsx_runtime.jsx)(GenericToolCard, {
					...owner,
					t
				}) : renderSlot("tool.call.toolview", owner, {
					entryKey: toolName,
					fallback: (0, react_jsx_runtime.jsx)(GenericToolCard, {
						...owner,
						t
					})
				}), children]
			});
		});
		const ToolCallBranch = (0, react.memo)(function ToolCallBranch({ renderSlot, block, cwd, home, openFile, inspectCall, loadImage, useDisclosure, t }) {
			const call = (0, react.useMemo)(() => toolCallPhase(block), [block]);
			return (0, react_jsx_runtime.jsx)(ToolCall, {
				renderSlot,
				callId: call.block.callId,
				toolName: callName(call),
				call,
				openFile,
				cwd,
				home,
				inspectCall,
				useDisclosure,
				loadImage,
				t,
				children: call.phase !== "preparing" && call.block.subCalls.length > 0 ? (0, react_jsx_runtime.jsx)("div", {
					className: ToolCallTree_module_css_default.subCalls,
					"data-subcalls": true,
					children: call.block.subCalls.map((child) => (0, react_jsx_runtime.jsx)(ToolCallBranch, {
						renderSlot,
						block: child,
						cwd,
						home,
						openFile,
						inspectCall,
						useDisclosure,
export {};
