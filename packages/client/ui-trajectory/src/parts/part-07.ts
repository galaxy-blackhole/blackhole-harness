/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-trajectory/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() {{ // __DSH_FRAGMENT_BEGIN__
			return t("status.completed");
		}
		function requestErrorMessage(request, t) {
			if (request.errorCode === "AUTH") return t("details.failure.auth");
			if (request.error === "trajectory.compaction-interrupted") return t("layout.compactionInterrupted");
			return request.error;
		}
		function TokenRows({ cell, t }) {
			const content = cell.output !== void 0 && cell.think !== void 0 ? Math.max(0, cell.output - cell.think) : void 0;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("usage.tokens") }), (0, react_jsx_runtime.jsx)("dd", { children: cell.output === void 0 ? "—" : t("unit.tokens", { value: cell.output }) })] }),
				cell.think !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
					className: TrajectoryTable_module_css_default.requestTokenDetail,
					children: [(0, react_jsx_runtime.jsx)("dt", { children: t("usage.reasoning") }), (0, react_jsx_runtime.jsx)("dd", { children: t("unit.tokens", { value: cell.think }) })]
				}),
				content !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
					className: TrajectoryTable_module_css_default.requestTokenDetail,
					children: [(0, react_jsx_runtime.jsx)("dt", { children: t("usage.content") }), (0, react_jsx_runtime.jsx)("dd", { children: t("unit.tokens", { value: content }) })]
				})
			] });
		}
		function inputTotal(usage) {
			if (usage.input === void 0 && usage.cacheRead === void 0 && usage.cacheWrite === void 0) return void 0;
			return (usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
		}
		function UsageRows({ usage, t }) {
			if (usage === void 0) return (0, react_jsx_runtime.jsx)("p", {
				className: TrajectoryTable_module_css_default.noPayload,
				children: t("usage.notReported")
			});
			const totalInput = inputTotal(usage);
			const otherOutput = usage.output !== void 0 && usage.reasoning !== void 0 ? usage.output - usage.reasoning : void 0;
			return (0, react_jsx_runtime.jsxs)("dl", {
				className: TrajectoryTable_module_css_default.overview,
				children: [
					totalInput !== void 0 && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("usage.input") }), (0, react_jsx_runtime.jsx)("dd", { children: t("unit.tokens", { value: totalInput }) })] }),
					usage.cacheRead !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTable_module_css_default.requestTokenDetail,
						children: [(0, react_jsx_runtime.jsx)("dt", { children: t("usage.cached") }), (0, react_jsx_runtime.jsx)("dd", { children: t("unit.tokens", { value: usage.cacheRead }) })]
					}),
					usage.cacheWrite !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTable_module_css_default.requestTokenDetail,
						children: [(0, react_jsx_runtime.jsx)("dt", { children: t("usage.cacheCreated") }), (0, react_jsx_runtime.jsx)("dd", { children: t("unit.tokens", { value: usage.cacheWrite }) })]
					}),
					usage.input !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTable_module_css_default.requestTokenDetail,
						children: [(0, react_jsx_runtime.jsx)("dt", { children: t("usage.other") }), (0, react_jsx_runtime.jsx)("dd", { children: t("unit.tokens", { value: usage.input }) })]
					}),
					usage.output !== void 0 && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("usage.output") }), (0, react_jsx_runtime.jsx)("dd", { children: t("unit.tokens", { value: usage.output }) })] }),
					usage.reasoning !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTable_module_css_default.requestTokenDetail,
						children: [(0, react_jsx_runtime.jsx)("dt", { children: t("usage.reasoning") }), (0, react_jsx_runtime.jsx)("dd", { children: t("unit.tokens", { value: usage.reasoning }) })]
					}),
					otherOutput !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTable_module_css_default.requestTokenDetail,
						children: [(0, react_jsx_runtime.jsx)("dt", { children: t("usage.content") }), (0, react_jsx_runtime.jsx)("dd", { children: t("unit.tokens", { value: otherOutput }) })]
					})
				]
			});
		}
		function RequestUsagePanel({ usage, cumulative, t }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: TrajectoryTable_module_css_default.usagePanel,
				children: [(0, react_jsx_runtime.jsxs)("section", {
					className: TrajectoryTable_module_css_default.usageGroup,
					children: [(0, react_jsx_runtime.jsx)("h4", {
						className: TrajectoryTable_module_css_default.usageHeading,
						children: t("usage.thisRequest")
					}), (0, react_jsx_runtime.jsx)(UsageRows, {
						usage,
						t
					})]
				}), (0, react_jsx_runtime.jsxs)("section", {
					className: TrajectoryTable_module_css_default.usageGroup,
					children: [(0, react_jsx_runtime.jsx)("h4", {
						className: TrajectoryTable_module_css_default.usageHeading,
						children: t("usage.sessionCumulative")
					}), (0, react_jsx_runtime.jsx)(UsageRows, {
						usage: cumulative,
						t
					})]
				})]
			});
		}
		function RequestOptions({ options, preview = false, stringWrapping, t }) {
			if (options === void 0) return (0, react_jsx_runtime.jsx)("p", {
				className: TrajectoryTable_module_css_default.noPayload,
				children: t("options.notRecorded")
			});
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
				data: options,
				stringWrapping,
				collapsedStringLines: preview ? 3 : 12,
				label: t("options.json"),
				labels: jsonTreeLabels(t),
				className: preview ? TrajectoryTable_module_css_default.jsonPreview : TrajectoryTable_module_css_default.jsonPayload
			});
		}
		function messageSourceLabel(source, t) {
			if (typeof source !== "object" || source === null || Array.isArray(source)) return t("source.unknown");
			const properties = source;
			const kind = properties.kind;
			if (kind === "user") return t("source.user");
			if (kind === "goal") {
				const round = properties.round;
				return typeof round === "number" && round > 0 ? t("source.goalRound", { round }) : t("source.goal");
			}
			if (typeof kind !== "string" || kind === "") return t("source.unknown");
			return `${kind[0]?.toUpperCase() ?? ""}${kind.slice(1)}`;
		}
		function MessageSource({ record, stringWrapping, t }) {
			const source = record.cell.messageSource;
			if (source === void 0) return (0, react_jsx_runtime.jsx)("p", {
				className: TrajectoryTable_module_css_default.noPayload,
				children: t("source.notRecorded")
			});
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
				data: typeof source === "object" && source !== null ? source : { value: source },
				stringWrapping,
				collapsedStringLines: 12,
				label: t("source.messageJson"),
				labels: jsonTreeLabels(t),
				className: TrajectoryTable_module_css_default.jsonPayload
			});
		}
		function isMarkdownRecord(record) {
			return record.cell.kind === "user" || record.cell.kind === "context" || record.cell.kind === "message";
		}
		function parentRecords(records, record) {
			if (record.cell.kind !== "tool" && record.cell.kind !== "subtool") return {};
			const at = records.findIndex((candidate) => candidate.cell.index === record.cell.index);
			if (at === -1) return {};
			let tool;
			if (record.cell.kind === "subtool") for (let i = at - 1; i >= 0; i--) {
				const candidate = records[i];
				if (candidate === void 0 || candidate.turn !== record.turn || candidate.group !== record.group) break;
				if (candidate.cell.kind === "tool") {
					tool = candidate;
					break;
				}
			}
			const parentCallId = tool?.cell.callId ?? record.cell.callId;
			let message;
			if (parentCallId !== void 0) message = records.find((candidate) => candidate.turn === record.turn && candidate.cell.kind === "message" && candidate.cell.sourceBlocks?.some((block) => block.callId === parentCallId) === true);
			return {
				...message === void 0 ? {} : { message },
				...tool === void 0 ? {} : { tool }
			};
		}
		function markdownSource(record) {
			if (record.cell.kind === "user" || record.cell.kind === "context") return record.cell.inputDetail;
			if (record.cell.kind === "message" || record.cell.kind === "compacted") return record.cell.outputDetail;
		}
		function detailTabs(record) {
			if (record.cell.kind === "system") {
				if (record.cell.promptDetail === void 0 && record.cell.systemPromptDetail !== void 0) return SYSTEM_PROMPT_TABS.filter((tab) => tab.id === "system-prompt");
				return record.cell.previousPromptDetail === void 0 ? SYSTEM_PROMPT_TABS : SYSTEM_UPDATE_TABS;
			}
			if (record.cell.kind === "compacted") return [{
				id: "overview",
				labelKey: "tab.summary"
			}, {
				id: "raw",
				labelKey: "tab.rawOutput"
			}];
			if (isMarkdownRecord(record)) return [
				{
					id: "overview",
					labelKey: "tab.summary"
				},
				{
					id: "rendered",
					labelKey: "tab.preview"
				},
				{
					id: "raw",
					labelKey: "tab.raw"
				},
				...record.cell.messageSource === void 0 ? [] : [{
					id: "source",
					labelKey: "tab.source"
				}]
			];
			return [
				{
					id: "overview",
					labelKey: "tab.summary"
				},
				...record.cell.inputDetail ? [{
					id: "input",
					labelKey: codeProgram(record.cell) === void 0 ? "tab.payload" : "code.source"
				}] : [],
				...record.cell.outputDetail || codeProgram(record.cell) !== void 0 ? [{
					id: "output",
					labelKey: "tab.result"
				}] : [],
				{
					id: "schema",
					labelKey: "tab.schema"
				},
				{
					id: "timing",
					labelKey: "tab.timing"
				}
			];
		}
		function recordDisplayText(cell, t) {
			if (isToolCallOnly(cell, t)) return "";
			const program = codeProgram(cell);
			if (program !== void 0) return `${PTC_TOOL_NAME} · ${program.description.replace(/\s+/g, " ")}`;
			if (cell.previewMarkdown !== void 0) {
				const preview = trajectoryPreviewText(cell.previewMarkdown);
				if (cell.text === "") return preview;
				return preview === "" ? cell.text : `${cell.text} · ${preview}`;
			}
			if (cell.text !== "") return cell.text;
			const markdown = cell.kind === "user" || cell.kind === "context" ? cell.inputDetail : cell.kind === "message" ? cell.outputDetail ?? cell.thinkingDetail : void 0;
			return markdown === void 0 ? "" : trajectoryPreviewText(markdown);
		}
		function recordResultText(cell) {
			return cell.resultPreviewMarkdown === void 0 ? cell.result : trajectoryPreviewText(cell.resultPreviewMarkdown);
		}
		function toolCallTextParts(cell, text) {
			if (cell.kind !== "tool" && cell.kind !== "subtool") return void 0;
			const program = cell.toolName === PTC_TOOL_NAME;
			const separator = text.indexOf(" · ");
			if (separator === -1) return {
				name: text,
				program
			};
			return {
				program,
				name: text.slice(0, separator),
				args: text.slice(separator + 3)
			};
		}
		function isToolCallOnly(cell, t) {
			return cell.kind === "message" && !cell.outputDetail && !cell.thinkingDetail && cell.text === t("layout.toolCallOnly");
		}
		function RecordPresentation({ cell, children, t }) {
			const displayText = (0, react.useMemo)(() => recordDisplayText(cell, t), [
				cell.kind,
				cell.text,
				cell.toolName,
				cell.previewMarkdown,
				cell.inputDetail,
				cell.outputDetail,
				cell.thinkingDetail,
				t
			]);
			const resultText = (0, react.useMemo)(() => recordResultText(cell), [cell.result, cell.resultPreviewMarkdown]);
			const toolCallOnly = isToolCallOnly(cell, t);
			const toolCallText = toolCallTextParts(cell, displayText);
			return children({
				displayText,
				listDisplayText: toolCallOnly ? t("record.toolCallOnly") : toolCallText === void 0 ? displayText : [toolCallText.name, toolCallText.args].filter(Boolean).join(" "),
				resultText,
				toolCallOnly,
				toolCallText
			});
		}
		function RecordListText({ displayText, toolCallOnly, toolCallText, t }) {
			if (toolCallOnly) return (0, react_jsx_runtime.jsx)("span", {
				className: TrajectoryTable_module_css_default.toolCallOnly,
				children: t("record.toolCallOnly")
			});
			if (toolCallText === void 0) return displayText || "—";
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("span", {
				className: TrajectoryTable_module_css_default.toolCallNameTypeface,
				children: [toolCallText.program && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, {
					className: TrajectoryTable_module_css_default.programIcon,
					size: 12
				}), toolCallText.name || "—"]
			}), toolCallText.args !== void 0 && (0, react_jsx_runtime.jsx)("span", {
				className: toolCallText.program ? TrajectoryTable_module_css_default.programSummary : TrajectoryTable_module_css_default.toolCallPayload,
				children: toolCallText.args
			})] });
		}
		function MarkdownFragment({ text, rendered, preview, variant = "body", t }) {
			const labels = (0, react.useMemo)(() => markdownLabels(t), [t]);
			if (rendered) return (0, react_jsx_runtime.jsx)("div", {
				className: preview ? TrajectoryTable_module_css_default.markdownPreview : TrajectoryTable_module_css_default.markdownPayload,
				children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
					text,
					labels,
					variant
				})
			});
			return (0, react_jsx_runtime.jsx)("pre", {
				className: `${TrajectoryTable_module_css_default.payload} ${preview ? TrajectoryTable_module_css_default.payloadPreview : ""}`,
				children: text
			});
		}
		function SourceBlocks({ blocks, onOpenCall, t }) {
			const attachments = new Map(recordAttachments(blocks, t).map((entry) => [entry.index, entry]));
			return (0, react_jsx_runtime.jsx)("div", {
				className: TrajectoryTable_module_css_default.sourceBlocks,
				children: blocks.map((block, index) => {
					const attachment = attachments.get(index);
					return attachment !== void 0 ? (0, react_jsx_runtime.jsxs)("details", {
						className: TrajectoryTable_module_css_default.attachmentDisclosure,
						children: [(0, react_jsx_runtime.jsxs)("summary", { children: [(0, react_jsx_runtime.jsx)("span", {
							className: TrajectoryTable_module_css_default.sourceBlockLabel,
							children: t("block.label", {
								index: index + 1,
								type: block.type
							})
						}), (0, react_jsx_runtime.jsx)("span", {
							className: TrajectoryTable_module_css_default.attachmentName,
							title: attachment.name,
							children: attachment.name
						})] }), (0, react_jsx_runtime.jsx)("pre", {
							className: TrajectoryTable_module_css_default.sourceBlockContent,
							children: block.content
						})]
					}, index) : (0, react_jsx_runtime.jsxs)("section", {
						className: TrajectoryTable_module_css_default.sourceBlock,
						children: [block.callId !== void 0 ? (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: TrajectoryTable_module_css_default.sourceBlockJumpTarget,
							"aria-label": t("block.openSummary", { index: index + 1 }),
							title: t("block.openSummaryTitle"),
							onClick: () => {
								if (block.callId !== void 0) onOpenCall(block.callId);
							},
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: TrajectoryTable_module_css_default.sourceBlockLabel,
								children: t("block.label", {
									index: index + 1,
									type: block.type
								})
							}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
								className: TrajectoryTable_module_css_default.sourceBlockJumpIcon,
								size: 12
							})]
						}) : (0, react_jsx_runtime.jsx)("div", {
							className: TrajectoryTable_module_css_default.sourceBlockHeader,
							children: (0, react_jsx_runtime.jsx)("span", {
								className: TrajectoryTable_module_css_default.sourceBlockLabel,
								children: t("block.label", {
									index: index + 1,
									type: block.type
								})
							})
						}), (0, react_jsx_runtime.jsx)("pre", {
							className: TrajectoryTable_module_css_default.sourceBlockContent,
							children: block.content
						})]
					}, index);
				})
			});
		}
		function recordAttachments(blocks, t) {
			let imageIndex = 0;
			return (blocks ?? []).flatMap((block, index) => {
				const ref = block.attachment ?? block.file;
				if (ref === void 0) return [];
				if (block.attachment !== void 0) imageIndex += 1;
				return [{
					block,
					index,
					name: ref.name ?? t("attachment.imageName", { index: imageIndex }),
					metadata: [
						block.attachment?.mediaType ?? (0, _deepseek_ai_dsh_client_ui_primitives.fileExtension)(ref.name ?? "").toUpperCase(),
						(0, _deepseek_ai_dsh_client_ui_primitives.fileSizeText)(ref.bytes),
						...block.attachment === void 0 ? [] : [`${block.attachment.width} × ${block.attachment.height}`]
					].filter(Boolean).join(" · ")
				}];
			});
		}
		function RecordAttachments({ blocks, preview, renderSlot, loadImage, t }) {
			const attachments = recordAttachments(blocks, t);
			if (attachments.length === 0) return null;
			return (0, react_jsx_runtime.jsx)("ul", {
				className: preview ? `${TrajectoryTable_module_css_default.attachments} ${TrajectoryTable_module_css_default.attachmentsPreview}` : TrajectoryTable_module_css_default.attachments,
				"aria-label": t("attachment.list"),
				children: attachments.map(({ block, index, name, metadata }) => (0, react_jsx_runtime.jsxs)("li", {
					className: TrajectoryTable_module_css_default.attachmentRow,
					children: [block.attachment !== void 0 ? renderSlot("conversation.trajectory.images", {
						images: [{
							attachment: block.attachment,
							label: name
						}],
						align: "start",
						thumbnail: true,
						loadImage
					}) : (0, react_jsx_runtime.jsx)("span", {
						className: TrajectoryTable_module_css_default.attachmentIcon,
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, { path: name })
					}), (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTable_module_css_default.attachmentInfo,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: TrajectoryTable_module_css_default.attachmentName,
							title: name,
							children: name
						}), (0, react_jsx_runtime.jsx)("span", {
							className: TrajectoryTable_module_css_default.attachmentMetadata,
							children: metadata
						})]
					})]
				}, index))
			});
		}
		function AssistantToolCalls({ blocks, preview, onOpenCall, t }) {
			const calls = blocks?.filter((block) => block.type === "tool-call") ?? [];
			if (calls.length === 0) return null;
			return (0, react_jsx_runtime.jsx)("ul", {
				className: preview ? `${TrajectoryTable_module_css_default.assistantToolCalls} ${TrajectoryTable_module_css_default.assistantToolCallsPreview}` : TrajectoryTable_module_css_default.assistantToolCalls,
				children: calls.map((call, index) => (0, react_jsx_runtime.jsx)("li", { children: (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: TrajectoryTable_module_css_default.assistantToolCallButton,
					title: t("block.openSummaryTitle"),
					onClick: () => {
						if (call.callId !== void 0) onOpenCall(call.callId);
					},
					children: [(0, react_jsx_runtime.jsx)("svg", {
						className: TrajectoryTable_module_css_default.assistantToolCallIcon,
						width: "12",
						height: "12",
						viewBox: "0 0 24 24",
						fill: "none",
						"aria-hidden": "true",
						children: (0, react_jsx_runtime.jsx)("path", {
							d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z",
							stroke: "currentColor",
							strokeWidth: "1.8",
							strokeLinecap: "round",
							strokeLinejoin: "round"
						})
					}), (0, react_jsx_runtime.jsxs)("span", {
						className: TrajectoryTable_module_css_default.assistantToolCallText,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: TrajectoryTable_module_css_default.assistantToolCallName,
							children: call.toolName ?? t("details.toolCall")
						}), call.content !== "" && (0, react_jsx_runtime.jsx)("span", {
							className: TrajectoryTable_module_css_default.assistantToolCallArgs,
							children: call.content
						})]
					})]
				}) }, call.callId ?? index))
			});
		}
		function ToolGlyph() {
			return (0, react_jsx_runtime.jsx)("svg", {
				className: TrajectoryTable_module_css_default.toolCatalogIcon,
				width: "12",
				height: "12",
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z",
					stroke: "currentColor",
					strokeWidth: "1.8",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function ToolCatalog({ tools, stringWrapping, t }) {
			if (tools.length === 0) return (0, react_jsx_runtime.jsx)("p", {
				className: TrajectoryTable_module_css_default.noPayload,
				children: t("record.toolsMissing")
			});
			return (0, react_jsx_runtime.jsx)("div", {
				className: TrajectoryTable_module_css_default.toolCatalog,
				children: tools.map((tool, index) => (0, react_jsx_runtime.jsxs)("details", {
					className: TrajectoryTable_module_css_default.toolCatalogItem,
					children: [(0, react_jsx_runtime.jsxs)("summary", {
						className: TrajectoryTable_module_css_default.toolCatalogSummary,
						children: [
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
								className: TrajectoryTable_module_css_default.toolCatalogChevron,
								size: 12
							}),
							(0, react_jsx_runtime.jsx)(ToolGlyph, {}),
							(0, react_jsx_runtime.jsx)("span", {
								className: TrajectoryTable_module_css_default.toolCatalogName,
								children: tool.name
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: TrajectoryTable_module_css_default.toolCatalogDescription,
								children: tool.description
							})
						]
					}), (0, react_jsx_runtime.jsxs)("div", {
						className: TrajectoryTable_module_css_default.toolCatalogDefinition,
						children: [tool.description !== "" && (0, react_jsx_runtime.jsx)("p", {
							className: TrajectoryTable_module_css_default.toolCatalogFullDescription,
							children: tool.description
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonTree, {
							data: tool.parameters,
							stringWrapping,
							label: t("record.namedParametersJson", { name: tool.name }),
							labels: jsonTreeLabels(t),
							className: TrajectoryTable_module_css_default.toolCatalogTree
						})]
					})]
				}, `${tool.name}:${index}`))
			});
		}
		function promptDiffLines(before, after) {
			return structuredPatch("", "", before, after, void 0, void 0, { context: 3 }).hunks.flatMap((hunk, hunkIndex) => [
				...hunkIndex === 0 ? [] : [{
					kind: "meta",
					text: ""
				}],
				{
					kind: "meta",
					text: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
				},
				...hunk.lines.flatMap((line) => {
					if (line.startsWith("\\")) return [];
					if (line.startsWith("+")) return [{
						kind: "added",
						text: line
					}];
					if (line.startsWith("-")) return [{
						kind: "removed",
						text: line
					}];
					return [{
						kind: "context",
						text: line
					}];
				})
			]);
		}
		function PromptDiffSection({ title, before, after }) {
			const lines = promptDiffLines(before, after);
			if (lines.length === 0) return null;
			return (0, react_jsx_runtime.jsxs)("section", {
				className: TrajectoryTable_module_css_default.promptDiffSection,
				children: [(0, react_jsx_runtime.jsx)("h3", {
					className: TrajectoryTable_module_css_default.promptDiffTitle,
					children: title
				}), (0, react_jsx_runtime.jsx)("pre", {
					className: TrajectoryTable_module_css_default.promptDiff,
					children: lines.map((line, index) => (0, react_jsx_runtime.jsxs)("span", {
						className: TrajectoryTable_module_css_default[`promptDiffLine${line.kind}`],
						children: [line.text || " ", "\n"]
					}, index))
				})]
			});
		}
		function SystemPromptDiff({ before, after, t }) {
			const toolsBefore = JSON.stringify(before.tools, null, 2);
			const toolsAfter = JSON.stringify(after.tools, null, 2);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: TrajectoryTable_module_css_default.promptDiffSections,
				children: [before.system !== after.system && (0, react_jsx_runtime.jsx)(PromptDiffSection, {
					title: t("record.systemPrompt"),
					before: before.system,
					after: after.system
				}), toolsBefore !== toolsAfter && (0, react_jsx_runtime.jsx)(PromptDiffSection, {
					title: t("record.tools"),
					before: toolsBefore,
					after: toolsAfter
				})]
			});
		}
		function ToolOutputBlocks({ blocks, error, errorDetail, preview, renderSlot, loadImage }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: [
					TrajectoryTable_module_css_default.resultBlocks,
					preview ? TrajectoryTable_module_css_default.resultBlocksPreview : void 0,
					error ? TrajectoryTable_module_css_default.errorPayload : void 0
				].filter((value) => value !== void 0).join(" "),
				children: [error && errorDetail !== void 0 && errorDetail !== "" && (0, react_jsx_runtime.jsx)("pre", {
					className: TrajectoryTable_module_css_default.resultBlockText,
					children: errorDetail
				}), blocks.map((block, index) => block.attachment !== void 0 ? (0, react_jsx_runtime.jsx)("div", {
					className: TrajectoryTable_module_css_default.messageImages,
					children: renderSlot("conversation.trajectory.images", {
						images: [{ attachment: block.attachment }],
						align: "start",
						loadImage
					})
				}, index) : block.content !== "" ? (0, react_jsx_runtime.jsx)("pre", {
					className: TrajectoryTable_module_css_default.resultBlockText,
					children: block.content
				}, index) : null)]
			});
		}
		function MarkdownRecordContent({ record, rendered, preview = false, thinkingExpanded, onThinkingExpandedChange, onOpenCall, renderSlot, loadImage, t }) {
			if (record.cell.sourceBlocks?.length && record.cell.sourceBlocks.every((block) => block.type === "tool-addition" || block.type === "tool-removal")) return (0, react_jsx_runtime.jsx)("pre", {
				className: `${TrajectoryTable_module_css_default.payload} ${TrajectoryTable_module_css_default.toolUpdatePayload}`,
				children: record.cell.inputDetail
			});
			if (!rendered && record.cell.sourceBlocks && record.cell.sourceBlocks.length > 0) return (0, react_jsx_runtime.jsx)(SourceBlocks, {
				blocks: record.cell.sourceBlocks,
				onOpenCall,
				t
			});
			if (record.cell.thinkingDetail) {
				if (!rendered) return (0, react_jsx_runtime.jsx)(MarkdownFragment, {
					text: [record.cell.thinkingDetail, record.cell.outputDetail].filter((value) => value !== void 0 && value !== "").join("\n\n"),
					rendered: false,
					preview,
					t
				});
				return (0, react_jsx_runtime.jsxs)("div", {
					className: `${TrajectoryTable_module_css_default.assistantContent} ${TrajectoryTable_module_css_default.assistantContentRendered}`,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: preview && !record.cell.outputDetail ? `${TrajectoryTable_module_css_default.thinkingQuote} ${TrajectoryTable_module_css_default.thinkingQuoteOnlyPreview}` : TrajectoryTable_module_css_default.thinkingQuote,
							children: [(0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: TrajectoryTable_module_css_default.thinkingToggle,
								"aria-expanded": thinkingExpanded,
								onClick: () => {
									onThinkingExpandedChange(!thinkingExpanded);
								},
								children: [t("record.thinking"), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
									className: TrajectoryTable_module_css_default.thinkingChevron,
									size: 12
								})]
							}), thinkingExpanded && (0, react_jsx_runtime.jsx)(MarkdownFragment, {
								text: record.cell.thinkingDetail,
								rendered,
								preview,
								variant: "compact",
								t
							})]
						}),
						record.cell.outputDetail && (0, react_jsx_runtime.jsx)("div", {
							className: TrajectoryTable_module_css_default.assistantOutput,
							children: (0, react_jsx_runtime.jsx)(MarkdownFragment, {
								text: record.cell.outputDetail,
								rendered,
								preview,
								t
							})
						}),
						(0, react_jsx_runtime.jsx)(AssistantToolCalls, {
							blocks: record.cell.sourceBlocks,
							preview,
							onOpenCall,
							t
						}),
						(0, react_jsx_runtime.jsx)(RecordAttachments, {
							blocks: record.cell.sourceBlocks,
							preview,
							renderSlot,
							loadImage,
							t
						})
					]
				});
			}
			const source = markdownSource(record);
			const hasAttachments = record.cell.sourceBlocks?.some((block) => block.attachment !== void 0 || block.file !== void 0) === true;
			const hasToolCalls = record.cell.kind === "message" && record.cell.sourceBlocks?.some((block) => block.type === "tool-call") === true;
			if (!source && !hasAttachments && !hasToolCalls) {
				const emptyLabel = isToolCallOnly(record.cell, t) ? t("record.toolCallOnly") : record.cell.text || t("record.noContent");
				return (0, react_jsx_runtime.jsx)("p", {
					className: TrajectoryTable_module_css_default.noPayload,
					children: emptyLabel
				});
			}
			if (!rendered || !hasAttachments && !hasToolCalls) return (0, react_jsx_runtime.jsx)(MarkdownFragment, {
				text: source ?? "",
				rendered,
				preview,
				t
			});
			return (0, react_jsx_runtime.jsxs)("div", { children: [
				source && (0, react_jsx_runtime.jsx)(MarkdownFragment, {
					text: source,
					rendered: true,
					preview,
					t
				}),
				record.cell.kind === "message" && (0, react_jsx_runtime.jsx)(AssistantToolCalls, {
					blocks: record.cell.sourceBlocks,
					preview,
					onOpenCall,
					t
				}),
				(0, react_jsx_runtime.jsx)(RecordAttachments, {
					blocks: record.cell.sourceBlocks,
					preview,
					renderSlot,
					loadImage,
					t
				})
			] });
		}
		function RecordTiming({ record, preview = false, t }) {
			return record.cell.kind === "message" && record.cell.assistantMetrics !== void 0 ? (0, react_jsx_runtime.jsx)(AssistantTimingPanel, {
				metrics: record.cell.assistantMetrics,
				t
			}) : (0, react_jsx_runtime.jsxs)("dl", {
				className: TrajectoryTable_module_css_default.overview,
				children: [
					(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.started") }), (0, react_jsx_runtime.jsx)(StartedAtValue, {
						timestamp: record.cell.startedAt ?? null,
						t
					})] }),
					(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.duration") }), (0, react_jsx_runtime.jsx)("dd", { children: formatElapsedSeconds(record.cell.timeSeconds, t) })] }),
					!preview && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("timing.source") }), (0, react_jsx_runtime.jsx)("dd", { children: record.cell.timeSeconds === null ? t("timing.notAvailable") : t("timing.sessionTimestamps") })] })
				]
			});
		}
} // __DSH_FRAGMENT_END__

export {};
