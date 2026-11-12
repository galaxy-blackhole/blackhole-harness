/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					const presented = [];
					for (let index = 0; index < files.length; index += 1) {
						const file = files[index];
						if (isPresentedFile(file)) presented.push({
							...file,
							seq,
							index
						});
					}
					if (presented.length === 0) return context.state;
					return {
						...context.state,
						presented: [...context.state.presented ?? [], ...presented]
					};
				}
				if (match.event.type === "tool/call") {
					const calls = new Map(context.state.calls);
					calls.set(String(match.event.data.callId), mutationPath(match.event.data.name, match.event.data.arguments));
					return {
						...context.state,
						calls
					};
				}
				if (match.event.type !== "tool/result") return context.state;
				if (match.event.data.message.isError === true) return context.state;
				const callId = String(match.event.data.message.source.callId);
				const argumentPath = context.state.calls.get(callId);
				if (argumentPath === null || argumentPath === void 0) return context.state;
				const path = mutationResultPath(argumentPath, match.event.data.meta);
				return path === null ? context.state : {
					...context.state,
					produced: [...context.state.produced, {
						seq: match.event.seq,
						path,
						...path === argumentPath ? {} : { argumentPath }
					}]
				};
			},
			buildLocationData: (context, scope, previous) => {
				if (scope !== "turn" || context.state === void 0) return null;
				if (previous?.kind === "turn" && previous.turn === context.state.turn && previous.key === "deliverables" && previous.value.produced === context.state.produced && previous.value.presented === context.state.presented && previous.value.changes === context.state.changes) return previous;
				return {
					kind: "turn",
					turn: context.state.turn,
					key: "deliverables",
					value: {
						produced: context.state.produced,
						...context.state.presented === void 0 ? {} : { presented: context.state.presented },
						...context.state.changes === void 0 ? {} : { changes: context.state.changes }
					}
				};
			}
		};
		/**
		* The turn's latest change announcement.
		* @param owner - closing turn.
		* @returns the announcement, or null when the Host recorded none.
		*/
		function changesForClosing(owner) {
			return owner.turn.data.get("deliverables")?.changes ?? null;
		}
		/**
		* Select the latest declaration of each path before the closing reply.
		* @param owner - closing turn and sequence.
		* @returns replayable deliveries in first-seen path order.
		*/
		function presentedForClosing(owner) {
			const files = /* @__PURE__ */ new Map();
			for (const file of owner.turn.data.get("deliverables")?.presented ?? []) if (file.seq < owner.seq) files.set(file.path, file);
			return [...files.values()];
		}
		/**
		* Resolves inline-code references against one turn's produced or delivered
		* paths and explicit mutation arguments. A reference resolves only when every
		* exact or basename match identifies one target. Ambiguous and unknown tokens stay inert.
		* @param paths - The turn's produced or delivered paths, already deduplicated.
		* @param openFile - The chat view's file opener.
		* @param label - Localizes the accessible open-label for a resolved path.
		* @param operations - successful mutations whose literal arguments may name the same canonical targets.
		* @returns The resolver MarkdownText consumes; the full path rides `title`,
		* the same disambiguator the row's chips carry.
		*/
		function producedFileMentions(paths, openFile, label, operations = []) {
			return { resolve(value) {
				const matches = new Set(paths.filter((path) => path === value || basename(path) === value));
				for (const operation of operations) if (operation.argumentPath === value) matches.add(operation.path);
				const path = matches.size === 1 ? matches.values().next().value : void 0;
				if (path === void 0) return void 0;
				return {
					open: () => {
						openFile(path);
					},
					label: label(path),
					title: path
				};
			} };
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-deliverables/src/client/ChangedFiles.module.css.mjs
		const css$2 = ".hz8-rW_card{--changes-fill:var(--dsw-static-neutral-50);--changes-hover:var(--dsw-static-neutral-100);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);min-width:0;color:var(--dsw-alias-label-primary);flex-direction:column;margin-top:4px;display:flex;overflow:hidden}.hz8-rW_card[data-single=true]{border-color:var(--dsw-alias-border-l1)}body[data-ds-dark-theme] .hz8-rW_card{--changes-fill:var(--dsw-static-neutral-850);--changes-hover:var(--dsw-static-neutral-800)}.hz8-rW_header{box-sizing:border-box;background:var(--changes-fill);width:100%;min-width:0;height:60px;color:inherit;font:inherit;text-align:left;border:0;align-items:center;gap:10px;margin:0;padding:8px 10px;display:flex}button.hz8-rW_header{cursor:pointer;transition:background-color .12s}button.hz8-rW_header:hover:not(:disabled),button.hz8-rW_header:focus-visible{background:var(--changes-hover)}button.hz8-rW_header:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline:none}button.hz8-rW_header:disabled{cursor:progress}.hz8-rW_tile{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l1);background:color-mix(in srgb, var(--dsw-static-neutral-00) 50%, transparent);border-radius:10px;flex:none;place-items:center;width:40px;height:40px;display:grid}body[data-ds-dark-theme] .hz8-rW_tile{background:color-mix(in srgb, var(--dsw-static-neutral-00) 5%, transparent)}.hz8-rW_titles{flex-direction:column;flex:1;min-width:0;display:flex}.hz8-rW_title{text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.hz8-rW_stat{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;display:inline-flex}.hz8-rW_statCounts{font-family:var(--ds-font-family-code);gap:6px;display:inline-flex}.hz8-rW_previewHint,.hz8-rW_header:hover .hz8-rW_statCounts,.hz8-rW_header:focus-visible .hz8-rW_statCounts{display:none}.hz8-rW_header:hover .hz8-rW_previewHint,.hz8-rW_header:focus-visible .hz8-rW_previewHint{display:inline}.hz8-rW_stat[data-error=true],.hz8-rW_counts[data-error=true]{color:var(--dsw-alias-state-error-primary)}.hz8-rW_added{color:var(--dsw-alias-state-success-primary)}.hz8-rW_deleted{color:var(--dsw-alias-state-error-primary)}.hz8-rW_list{border-top:.5px solid var(--dsw-alias-border-l2);margin:0;padding:0;list-style:none}.hz8-rW_row{box-sizing:border-box;width:100%;min-width:0;min-height:24px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-family:var(--ds-font-family-code);text-align:left;background:0 0;border:0;justify-content:space-between;align-items:center;gap:10px;margin:0;padding:7px 18px 7px 14px;font-size:11px;line-height:18px;display:flex}.hz8-rW_row:hover:not(:disabled),.hz8-rW_row:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}.hz8-rW_row:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline:none}.hz8-rW_row:disabled{cursor:progress}.hz8-rW_path{min-width:0;font-family:var(--dsw-font-family);text-overflow:ellipsis;white-space:nowrap;font-size:12px;overflow:hidden}.hz8-rW_counts{white-space:nowrap;color:var(--dsw-alias-label-tertiary);flex:none;gap:6px;display:inline-flex}.hz8-rW_toggle{box-sizing:border-box;width:100%;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;text-align:left;background:0 0;border:0;justify-content:flex-start;align-items:center;gap:4px;margin:0;padding:10px 18px 10px 14px;font-size:12px;line-height:18px;display:inline-flex}.hz8-rW_toggle:hover{background:var(--dsw-alias-interactive-bg-hover)}.hz8-rW_toggle svg{flex:none;width:14px;height:14px}@media (pointer:coarse){.hz8-rW_row,.hz8-rW_toggle{min-height:44px}}.hz8-rW_preview{max-height:100%;overflow:hidden}.hz8-rW_previewPath{min-width:0;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);white-space:nowrap;flex:auto;font-size:12px;line-height:20px;overflow:auto hidden}.hz8-rW_preview [data-diff-note=metadata],.hz8-rW_preview [data-diff-hunk-header]{display:none}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-deliverables/ChangedFiles.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-deliverables";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var ChangedFiles_module_css_default = {
			"added": "hz8-rW_added",
			"card": "hz8-rW_card",
			"counts": "hz8-rW_counts",
			"deleted": "hz8-rW_deleted",
			"header": "hz8-rW_header",
			"list": "hz8-rW_list",
			"path": "hz8-rW_path",
			"preview": "hz8-rW_preview",
			"previewHint": "hz8-rW_previewHint",
			"previewPath": "hz8-rW_previewPath",
			"row": "hz8-rW_row",
			"stat": "hz8-rW_stat",
			"statCounts": "hz8-rW_statCounts",
			"tile": "hz8-rW_tile",
			"title": "hz8-rW_title",
			"titles": "hz8-rW_titles",
			"toggle": "hz8-rW_toggle"
		};
		//#endregion
		//#region lib/types/client/ChangedFiles.js
		/** Turn changes use a compact single-file card or a header with a folded file list. */
		/** Rows shown before the fold; the design's summary height for a closing message. */
		const COLLAPSED_ROWS = 4;
		const GROUPED$1 = new Intl.NumberFormat("en-US");
		/** Added and deleted line counts in the card's colors. */
		function Counts$1({ added, deleted, t }) {
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
				className: ChangedFiles_module_css_default.added,
				children: t("changes.added", { count: GROUPED$1.format(added) })
			}), (0, react_jsx_runtime.jsx)("span", {
				className: ChangedFiles_module_css_default.deleted,
				children: t("changes.deleted", { count: GROUPED$1.format(deleted) })
			})] });
		}
		/**
		* Render one turn's changed files. The header opens the turn's review in the
		* right Sidebar on its first file. A single file uses only the header; it and
		* multi-file rows preview their comparison after a 500ms hover.
		* @param props - the recorded summary, the review opener, and localized copy.
		* @returns the card.
		*/
		function ChangedFiles({ changes, cwd, openReview, t, sessionId, useChangesDiff, loadChangesDiff }) {
			const cardRef = (0, react.useRef)(null);
			const pathDescriptionId = (0, react.useId)();
			const [expanded, setExpanded] = (0, react.useState)(false);
			const singleFile = changes.total === 1 ? changes.files[0] : void 0;
			const foldable = changes.files.length > COLLAPSED_ROWS;
			const rows = foldable && !expanded ? changes.files.slice(0, COLLAPSED_ROWS) : changes.files;
			const header = (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: ChangedFiles_module_css_default.header,
				"aria-label": singleFile === void 0 ? t("changes.openReview") : t("changes.viewDiff", { name: singleFile.display }),
				"aria-describedby": singleFile === void 0 ? void 0 : pathDescriptionId,
				onClick: () => {
					openReview(0);
				},
				children: [(0, react_jsx_runtime.jsx)("span", {
					className: ChangedFiles_module_css_default.tile,
					children: singleFile === void 0 ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
						kind: "code",
						size: 20
					}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
						path: singleFile.path,
						size: 20
					})
				}), (0, react_jsx_runtime.jsxs)("span", {
					className: ChangedFiles_module_css_default.titles,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: ChangedFiles_module_css_default.title,
						children: singleFile === void 0 ? t("changes.title", { count: String(changes.total) }) : t("changes.singleTitle", { name: basename(singleFile.path) })
					}), (0, react_jsx_runtime.jsxs)("span", {
						className: ChangedFiles_module_css_default.stat,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: ChangedFiles_module_css_default.statCounts,
							children: singleFile?.binary === true ? t("changes.binary") : singleFile?.oversized === true ? t("changes.oversized") : (0, react_jsx_runtime.jsx)(Counts$1, {
								t,
								added: changes.added,
								deleted: changes.deleted
							})
						}), (0, react_jsx_runtime.jsx)("span", {
							className: ChangedFiles_module_css_default.previewHint,
							children: t("presented.preview")
						})]
					})]
				})]
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: cardRef,
				className: ChangedFiles_module_css_default.card,
				"data-changed-files": true,
				"data-single": singleFile !== void 0 || void 0,
				children: [
					singleFile === void 0 ? header : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.HoverCard, {
						variant: "preview",
						widthAnchorRef: cardRef,
						openDelayMs: 500,
						anchor: header,
						content: (0, react_jsx_runtime.jsx)(ChangedFilePreview, {
							sessionId,
							seq: changes.seq,
							index: 0,
							display: resolveWorkspacePath(cwd, singleFile.path),
							useChangesDiff,
							loadChangesDiff,
							t
						})
					}), (0, react_jsx_runtime.jsx)("span", {
						id: pathDescriptionId,
						hidden: true,
						children: resolveWorkspacePath(cwd, singleFile.path)
					})] }),
					singleFile === void 0 && (0, react_jsx_runtime.jsx)("ul", {
						className: ChangedFiles_module_css_default.list,
						children: rows.map((file, index) => (0, react_jsx_runtime.jsxs)("li", { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.HoverCard, {
							variant: "preview",
							widthAnchorRef: cardRef,
							openDelayMs: 500,
							content: (0, react_jsx_runtime.jsx)(ChangedFilePreview, {
								sessionId,
								seq: changes.seq,
								index,
								display: resolveWorkspacePath(cwd, file.path),
								useChangesDiff,
								loadChangesDiff,
								t
							}),
							anchor: (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: ChangedFiles_module_css_default.row,
								"aria-label": t("changes.viewDiff", { name: file.display }),
								"aria-describedby": `${pathDescriptionId}-${index}`,
								onClick: () => {
									openReview(index);
								},
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: ChangedFiles_module_css_default.path,
									children: file.display
								}), (0, react_jsx_runtime.jsx)("span", {
									className: ChangedFiles_module_css_default.counts,
									children: file.binary === true ? t("changes.binary") : file.oversized === true ? t("changes.oversized") : (0, react_jsx_runtime.jsx)(Counts$1, {
										t,
										added: file.added,
										deleted: file.deleted
									})
								})]
							})
						}), (0, react_jsx_runtime.jsx)("span", {
							id: `${pathDescriptionId}-${index}`,
							hidden: true,
							children: resolveWorkspacePath(cwd, file.path)
						})] }, file.display))
					}),
					foldable && (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: ChangedFiles_module_css_default.toggle,
						"aria-expanded": expanded,
						"aria-label": t(expanded ? "changes.collapseAria" : "changes.expandAria", { count: String(changes.files.length) }),
						onClick: () => {
							setExpanded((value) => !value);
						},
						children: [(0, react_jsx_runtime.jsx)("span", { children: t(expanded ? "changes.collapse" : "changes.all", { count: String(changes.files.length) }) }), expanded ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {})]
					})
				]
			});
		}
		/** Mounted only while its hover card is open, so passing over a row does not read a comparison. */
		function ChangedFilePreview({ sessionId, seq, index, display, useChangesDiff, loadChangesDiff, t }) {
			const state = useChangesDiff((value) => value[changesDiffUrl(sessionId, seq, index)]);
			(0, react.useEffect)(() => {
				if (state === void 0) loadChangesDiff(sessionId, seq, index);
			}, [
				state,
				sessionId,
				seq,
				index,
				loadChangesDiff
			]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: `${FileDiff_module_css_default.root} ${ChangedFiles_module_css_default.preview}`,
				"data-changes-hover-preview": true,
				children: [(0, react_jsx_runtime.jsx)("div", {
					className: FileDiff_module_css_default.header,
					children: (0, react_jsx_runtime.jsx)("span", {
						className: ChangedFiles_module_css_default.previewPath,
						"data-changes-preview-path": true,
						children: display
					})
				}), (0, react_jsx_runtime.jsx)(FileDiff, {
					state,
					split: false,
					wrap: false,
					t,
					retry: () => {
						loadChangesDiff(sessionId, seq, index);
					}
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-deliverables/src/client/Deliverables.module.css.mjs
		const css$1 = ".nyYjTG_root{--deliverable-fill:var(--dsw-static-neutral-50);--deliverable-hover:var(--dsw-static-neutral-100);flex-direction:column;gap:16px;min-width:0;margin-top:4px;display:flex;container-type:inline-size}.nyYjTG_root[data-after-changes=true]{margin-top:0}body[data-ds-dark-theme] .nyYjTG_root{--deliverable-fill:var(--dsw-static-neutral-850);--deliverable-hover:var(--dsw-static-neutral-800)}.nyYjTG_hostStatus{color:var(--dsw-alias-label-secondary);align-items:center;gap:8px;font-size:12px;line-height:18px;display:flex}.nyYjTG_presented{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;min-width:0;display:grid}.nyYjTG_presented[data-single=true]{grid-template-columns:minmax(0,1fr)}.nyYjTG_file{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--deliverable-fill);min-width:0;height:60px;color:var(--dsw-alias-label-primary);align-items:center;gap:10px;padding:8px 10px;transition:background-color .12s;display:flex;position:relative;overflow:hidden}.nyYjTG_file:hover{background:var(--deliverable-hover)}.nyYjTG_cardPreview{z-index:1;border-radius:inherit;cursor:pointer;background:0 0;border:0;width:100%;padding:0;position:absolute;inset:0}.nyYjTG_cardPreview:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline:none}.nyYjTG_fileIcon{z-index:2;box-sizing:border-box;pointer-events:none;border:.5px solid var(--dsw-alias-border-l1);background:color-mix(in srgb, var(--dsw-static-neutral-00) 50%, transparent);width:40px;height:40px;color:var(--dsw-alias-link);border-radius:10px;flex:none;place-items:center;display:grid;position:relative;overflow:hidden}body[data-ds-dark-theme] .nyYjTG_fileIcon{background:color-mix(in srgb, var(--dsw-static-neutral-00) 5%, transparent)}.nyYjTG_fileBody{z-index:2;pointer-events:none;flex:1;justify-content:space-between;align-items:center;gap:12px;min-width:0;display:flex;position:relative}.nyYjTG_details{flex-direction:column;flex:1;justify-content:center;gap:2px;min-width:0;display:flex}.nyYjTG_fileName{text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.nyYjTG_description{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:400;line-height:16px;overflow:hidden}.nyYjTG_description[data-error=true]{color:var(--dsw-alias-state-error-primary)}.nyYjTG_previewHint,.nyYjTG_file:hover .nyYjTG_description:not([role=status]) .nyYjTG_secondaryText{display:none}.nyYjTG_file:hover .nyYjTG_description:not([role=status]) .nyYjTG_previewHint{display:inline}.nyYjTG_toggle{border-radius:var(--dsw-radius-sm);min-width:0;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;background:0 0;border:0;align-self:center;align-items:center;gap:4px;padding:1px 11px;font-size:12px;line-height:18px;display:inline-flex}.nyYjTG_toggle:hover{background:var(--dsw-alias-interactive-bg-hover)}.nyYjTG_toggle svg{flex:none;width:14px;height:14px}@container (width<=620px){.nyYjTG_presented{grid-template-columns:minmax(0,1fr)}}.nyYjTG_actions{pointer-events:auto;flex:none;display:inline-flex}.nyYjTG_secondaryText[data-success]{animation-name:nyYjTG_success-fade;animation-timing-function:ease-out;animation-fill-mode:forwards}@keyframes nyYjTG_success-fade{to{opacity:0}}@media (prefers-reduced-motion:reduce){.nyYjTG_secondaryText[data-success]{animation-name:none}}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-deliverables/Deliverables.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-deliverables";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var Deliverables_module_css_default = {
			"actions": "nyYjTG_actions",
			"cardPreview": "nyYjTG_cardPreview",
			"description": "nyYjTG_description",
			"details": "nyYjTG_details",
			"file": "nyYjTG_file",
			"fileBody": "nyYjTG_fileBody",
			"fileIcon": "nyYjTG_fileIcon",
			"fileName": "nyYjTG_fileName",
			"hostStatus": "nyYjTG_hostStatus",
			"presented": "nyYjTG_presented",
			"previewHint": "nyYjTG_previewHint",
			"root": "nyYjTG_root",
			"secondaryText": "nyYjTG_secondaryText",
			"success-fade": "nyYjTG_success-fade",
			"toggle": "nyYjTG_toggle"
		};
		//#endregion
		//#region lib/types/client/PresentedFileCard.js
		function cardDescription(description, fallback) {
			const trimmed = description?.replace(/\s*(?:\([^()]*\)|（[^（）]*）)\s*$/u, "").trim();
			return trimmed === void 0 || trimmed === "" ? fallback : trimmed;
		}
		/**
		* Render independent file actions without nesting buttons inside a clickable card.
		* @param props - durable file metadata, Sidebar preview, Host capabilities, gesture status, and localized copy.
		* @returns the file card and its anchored action menu.
		*/
		function PresentedFileCard({ file, cwd, phase, host, onPreview, actions, t }) {
			const succeeded = phase === "opened" || phase === "revealed";
			const reveal = host?.fileManager ?? "directory";
			const name = basename(file.path);
			const metadata = (0, _deepseek_ai_dsh_client_ui_primitives.fileExtension)(name).toUpperCase() || t("presented.file");
			const status = phase === void 0 ? cardDescription(file.description, metadata) : t(reveal === "directory" && phase === "revealed" ? "presented.directoryOpened" : reveal === "directory" && phase === "revealing" ? "presented.directoryOpening" : reveal === "directory" && phase === "revealError" ? "presented.directoryError" : `presented.${phase}`);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: Deliverables_module_css_default.file,
				"data-presented-file": true,
				children: [
					(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: Deliverables_module_css_default.cardPreview,
						title: resolveWorkspacePath(cwd, file.path),
						"aria-label": t("presented.previewCard", { name: file.path }),
						onClick: onPreview
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: Deliverables_module_css_default.fileIcon,
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
							path: file.path,
							size: 20
						})
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: Deliverables_module_css_default.fileBody,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: Deliverables_module_css_default.details,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: Deliverables_module_css_default.fileName,
								children: name
							}), (0, react_jsx_runtime.jsxs)("span", {
								className: Deliverables_module_css_default.description,
								"data-presented-description": true,
								role: phase === void 0 ? void 0 : "status",
								"data-error": phase === "error" || phase === "revealError" || phase === "nativeUnavailable" ? true : void 0,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: Deliverables_module_css_default.secondaryText,
									"data-success": succeeded || void 0,
									style: succeeded ? {
										animationDelay: `${PRESENTED_SUCCESS_HOLD_MS}ms`,
										animationDuration: `200ms`
									} : void 0,
									children: status
								}), (0, react_jsx_runtime.jsx)("span", {
									className: Deliverables_module_css_default.previewHint,
									children: t("presented.preview")
								})]
							})]
						}), (0, react_jsx_runtime.jsx)("div", {
							className: Deliverables_module_css_default.actions,
							children: actions
						})]
					})
export {};
