/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js — CẮT LẠI 08/11/2026
 *      theo MOT kieu duy nhat (region-based), gộp/cắt tiếp để mỗi lát ≤ 900 dòng.
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#region lib/types/client/chat/ContextBody.js
		/** Model-facing text stays bounded at the disclosure, not at the producer. */
		const MAX_CHARS = 2e4;
		/** Rows a list body materializes before summarizing the remainder. */
		const MAX_ENTRIES = 200;
		/** One durable source narrowed to the readable-record shape; null for anything else. */
		function asRecord$1(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
		}
		/**
		* The content blocks as runs, IN THE ORDER the model received them.
		*
		* Adjacent text blocks join with no separator, matching how provider adapters
		* flatten them — inserting a line break would show the reader a line the model
		* never saw. An unknown block breaks the run and keeps its own fallback rather
		* than being hoisted past the text around it or vanishing; the block union is
		* merge-extensible, so a foreign log may interleave shapes this build does not
		* know.
		*/
		function contentRuns(content) {
			const runs = [];
			for (const block of content) {
				if (block.type !== "text") {
					runs.push({ block });
					continue;
				}
				const last = runs[runs.length - 1];
				if (last !== void 0 && "text" in last) last.text += block.text;
				else runs.push({ text: block.text });
			}
			return runs;
		}
		/** Only the blocks this UI version does not know, for bodies that replace the text. */
		function unknownBlocks(content) {
			return contentRuns(content).flatMap((run) => "block" in run ? [run.block] : []);
		}
		/** The model-facing text, truncated to the display bound. */
		function boundedText(text, t) {
			return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n${t("json.truncated", { total: text.length })}` : text;
		}
		/**
		* One source field rendered as a value row; nested shapes stay compact JSON.
		* Bounded on its own, because source fields are as unbounded as the text: an unknown
		* producer may record an arbitrarily large string or array.
		*/
		function fieldValue(value, t) {
			return boundedText(typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(value), t);
		}
		/**
		* Source fields as a key/value list. `kind` is always omitted because the
		* row header already names the producer. `form` is omitted only when a
		* dedicated body rendered for it — then the presentation the reader is looking
		* at IS that value. On the opaque fallback the declaration is kept, because
		* that is the one place a form this version cannot present would otherwise
		* disappear from the UI entirely.
		*/
		function SourceFields({ source, formRendered, t }) {
			const record = asRecord$1(source);
			if (record === null) return null;
			const hidden = formRendered ? ["kind", "form"] : ["kind"];
			const rows = Object.entries(record).filter(([key]) => !hidden.includes(key));
			if (rows.length === 0) return null;
			return (0, react_jsx_runtime.jsx)("dl", {
				className: ContextBody_module_css_default.fields,
				"data-context-fields": true,
				children: rows.map(([key, value]) => (0, react_jsx_runtime.jsxs)("div", {
					className: ContextBody_module_css_default.field,
					children: [(0, react_jsx_runtime.jsx)("dt", {
						className: ContextBody_module_css_default.fieldKey,
						children: key
					}), (0, react_jsx_runtime.jsx)("dd", {
						className: ContextBody_module_css_default.fieldValue,
						children: fieldValue(value, t)
					})]
				}, key))
			});
		}
		/**
		* Content blocks this UI version does not know, kept visible rather than
		* dropped: the block union is merge-extensible, so a newer or foreign log may
		* carry a shape this build has no presentation for.
		* @param props - The unrecognized blocks and the locale seat.
		* @returns One generic JSON block per unknown entry.
		*/
		function UnknownBlocks({ blocks, t }) {
			return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: blocks.map((block, index) => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonBlock, {
				label: t("message.unknownBlock"),
				payload: block,
				truncatedLabel: (total) => t("json.truncated", { total })
			}, index)) });
		}
		/**
		* The model-facing content of one context, shared by every form that shows it:
		* the text with its real line breaks, then any block this UI version does not
		* know, which keeps its own fallback rather than vanishing.
		* @param props - Durable content and the locale seat.
		* @returns The content blocks as the model received them.
		*/
		function ModelFacingContent({ content, t }) {
			return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: contentRuns(content).map((run, index) => "text" in run ? run.text !== "" && (0, react_jsx_runtime.jsx)("pre", {
				className: ContextBody_module_css_default.text,
				"data-context-text": true,
				children: boundedText(run.text, t)
			}, index) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.JsonBlock, {
				label: t("message.unknownBlock"),
				payload: run.block,
				truncatedLabel: (total) => t("json.truncated", { total })
			}, index)) });
		}
		/**
		* Default presentation: the model-facing text as text, with its real line
		* breaks, and the remaining source fields beneath it. This is what every form
		* this UI version does not recognize renders as.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The opaque context body.
		*/
		function OpaqueBody({ content, source, t }) {
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(ModelFacingContent, {
				content,
				t
			}), (0, react_jsx_runtime.jsx)(SourceFields, {
				source,
				formRendered: false,
				t
			})] });
		}
		/**
		* Instruction changes read off the source, or null when the record is not a
		* usable instruction list.
		*
		* The read is all-or-nothing: silently dropping one unreadable entry would show
		* a confident, incomplete file list for a log this version cannot fully read.
		* Paths are deduplicated in first-seen order, matching how the header label is
		* derived from the same array.
		*/
		function instructionChanges(source) {
			const record = asRecord$1(source);
			const list = record === null ? void 0 : record["changes"];
			if (!Array.isArray(list)) return null;
			const changes = [];
			const seen = /* @__PURE__ */ new Set();
			for (const entry of list) {
				const change = asRecord$1(entry);
				if (change === null) return null;
				const path = change["path"];
				if (typeof path !== "string" || path === "") return null;
				const action = change["action"];
				if (action !== "set" && action !== "replace" && action !== "remove") return null;
				const digest = change["digest"];
				if (seen.has(path)) continue;
				seen.add(path);
				changes.push({
					action,
					path,
					...typeof digest === "string" ? { digest } : {}
				});
			}
			return changes.length === 0 ? null : changes;
		}
		/**
		* Locale key for one reconciled file. The baseline loads a file; a later delta
		* distinguishes a newly reconciled path from a rewritten one, which `set` and
		* `replace` already separate at the producer.
		* @param action - the durable change action.
		* @param baseline - whether this context is the startup/resume baseline.
		* @returns the key naming what happened to that file.
		*/
		function instructionAction(action, baseline) {
			if (action === "remove") return "message.context.instructions.removed";
			if (baseline) return "message.context.instructions.loaded";
			return action === "set" ? "message.context.instructions.added" : "message.context.instructions.updated";
		}
		/**
		* `instructions` form: the files this context reconciled, then their text.
		*
		* The text keeps its `<system-reminder>` framing verbatim — the framing is part
		* of what the model read, so hiding it would misreport the request.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The instructions context body, or the opaque body when the change
		* list is unreadable.
		*/
		function InstructionsBody({ content, source, t }) {
			const changes = instructionChanges(source);
			if (changes === null) return (0, react_jsx_runtime.jsx)(OpaqueBody, {
				content,
				source,
				t
			});
			const baseline = asRecord$1(source)?.["baseline"] === true;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("ul", {
				className: ContextBody_module_css_default.files,
				"data-context-files": true,
				children: changes.map((change) => (0, react_jsx_runtime.jsxs)("li", {
					className: ContextBody_module_css_default.file,
					title: change.digest,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: ContextBody_module_css_default.filePath,
						children: change.path
					}), (0, react_jsx_runtime.jsx)("span", {
						className: ContextBody_module_css_default.fileAction,
						children: t(instructionAction(change.action, baseline))
					})]
				}, change.path))
			}), (0, react_jsx_runtime.jsx)(ModelFacingContent, {
				content,
				t
			})] });
		}
		/**
		* Catalog entries read off the source, or null when the record is not a usable
		* catalog. All-or-nothing for the same reason as the instruction list: this body
		* replaces the model-facing text, so a partial list would hide the only complete
		* account of what the model read.
		*/
		function catalogEntries(source) {
			const record = asRecord$1(source);
			const list = record === null ? void 0 : record["entries"];
			if (!Array.isArray(list)) return null;
			const entries = [];
			for (const item of list) {
				const entry = asRecord$1(item);
				if (entry === null) return null;
				const name = entry["name"];
				const description = entry["description"];
				if (typeof name !== "string" || name === "" || typeof description !== "string") return null;
				entries.push({
					name,
					description
				});
			}
			return entries;
		}
		/**
		* `catalog` form: the published entries as a list, read from the source rather
		* than re-parsed out of the model-facing prose.
		*
		* A catalog whose source carries no usable entries falls through to the opaque
		* body, so an older or hand-edited log still shows its text.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The catalog context body, or the opaque body when the entry list is
		* unreadable.
		*/
		function CatalogBody({ content, source, t }) {
			const entries = catalogEntries(source);
			if (entries === null) return (0, react_jsx_runtime.jsx)(OpaqueBody, {
				content,
				source,
				t
			});
			const update = asRecord$1(source)?.["update"] === true;
			const shown = entries.slice(0, MAX_ENTRIES);
			const rest = unknownBlocks(content);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				update && (0, react_jsx_runtime.jsx)("p", {
					className: ContextBody_module_css_default.catalogNotice,
					"data-context-catalog-update": true,
					children: t("message.context.catalog.replaced")
				}),
				(0, react_jsx_runtime.jsx)("ul", {
					className: ContextBody_module_css_default.entries,
					"data-context-entries": true,
					children: shown.map((entry, index) => (0, react_jsx_runtime.jsxs)("li", {
						className: ContextBody_module_css_default.entry,
						children: [(0, react_jsx_runtime.jsx)("code", {
							className: ContextBody_module_css_default.entryName,
							children: entry.name
						}), (0, react_jsx_runtime.jsx)("span", {
							className: ContextBody_module_css_default.entryDescription,
							children: entry.description
						})]
					}, index))
				}),
				shown.length < entries.length && (0, react_jsx_runtime.jsx)("p", {
					className: ContextBody_module_css_default.catalogNotice,
					"data-context-entries-truncated": true,
					children: t("message.context.catalog.more", { count: entries.length - shown.length })
				}),
				(0, react_jsx_runtime.jsx)(UnknownBlocks, {
					blocks: rest,
					t
				})
			] });
		}
		/** Snapshot sections read off the source, or null when the record is unusable. */
		function snapshotSections(source) {
			const record = asRecord$1(source);
			const list = record === null ? void 0 : record["sections"];
			if (!Array.isArray(list)) return null;
			const sections = [];
			for (const item of list) {
				const section = asRecord$1(item);
				if (section === null) return null;
				const name = section["name"];
				const text = section["text"];
				if (typeof name !== "string" || name === "" || typeof text !== "string") return null;
				sections.push({
					name,
					text
				});
			}
			return sections.length === 0 ? null : sections;
		}
		/**
		* `snapshot` form: the named contributions this snapshot assembled, in order.
		*
		* The sections are the same bytes the model read, split at the boundaries the
		* producer assembled them on, so a reader sees which subsystem contributed
		* which state instead of one undifferentiated wall.
		*
		* One sentence of the model-facing text is NOT in any section: the producer's
		* framing line declaring that this snapshot supersedes earlier ones. Unlike the
		* `<system-reminder>` wrapper an instruction context carries — which wraps
		* content and cannot be separated from it — that line states the form's own
		* semantics, so the body states them as a caption instead of reprinting the
		* joined prose beside the sections it was split from.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The snapshot context body, or the opaque body when unreadable.
		*/
		function SnapshotBody({ content, source, t }) {
			const sections = snapshotSections(source);
			/* v8 ignore next -- contextBody reads the sections before choosing this body. */
			if (sections === null) return (0, react_jsx_runtime.jsx)(OpaqueBody, {
				content,
				source,
				t
			});
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("p", {
				className: ContextBody_module_css_default.catalogNotice,
				"data-context-snapshot-supersedes": true,
				children: t("message.context.snapshot.supersedes")
			}), (0, react_jsx_runtime.jsx)("dl", {
				className: ContextBody_module_css_default.sections,
				"data-context-sections": true,
				children: sections.map((section, index) => (0, react_jsx_runtime.jsxs)("div", {
					className: ContextBody_module_css_default.section,
					children: [(0, react_jsx_runtime.jsx)("dt", {
						className: ContextBody_module_css_default.sectionName,
						children: section.name
					}), (0, react_jsx_runtime.jsx)("dd", {
						className: ContextBody_module_css_default.sectionText,
						children: boundedText(section.text, t)
					})]
				}, index))
			})] });
		}
		/**
		* `notice` form: what just happened, with the model-facing text beneath it.
		*
		* The one-line account also rides the collapsed row ({@link contextBody}), so a
		* notice is usually readable without expanding at all.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The notice context body.
		*/
		function NoticeBody({ content, t }) {
			return (0, react_jsx_runtime.jsx)(ModelFacingContent, {
				content,
				t
			});
		}
		/**
		* `relay` form: which agent sent this, then what it said.
		*
		* The sender is an opaque session id; it is shown as a field rather than a
		* label, because this client cannot resolve it to a title.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The relay context body.
		*/
		function RelayBody({ content, source, t }) {
			const sender = relaySender(source);
			/* v8 ignore next -- contextBody resolves the sender before choosing this body. */
			if (sender === null) return (0, react_jsx_runtime.jsx)(OpaqueBody, {
				content,
				source,
				t
			});
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("p", {
				className: ContextBody_module_css_default.relaySender,
				"data-context-relay-sender": true,
				children: t("message.context.relay.from", { session: sender })
			}), (0, react_jsx_runtime.jsx)(ModelFacingContent, {
				content,
				t
			})] });
		}
		/** The sending agent's session id, or null when the record does not name one. */
		function relaySender(source) {
			const sender = asRecord$1(source)?.["senderSessionId"];
			return typeof sender === "string" && sender !== "" ? sender : null;
		}
		/** Recalled sessions read off the source, or null when the record is unusable. */
		function recalledSessions(source) {
			const record = asRecord$1(source);
			const list = record === null ? void 0 : record["references"];
			if (!Array.isArray(list)) return null;
			const sessions = [];
			for (const item of list) {
				const reference = asRecord$1(item);
				if (reference === null) return null;
				const label = reference["label"];
				const retained = reference["retainedMessages"];
				const omitted = reference["omittedMessages"];
				const truncated = reference["truncated"];
				if (typeof label !== "string" || label === "" || typeof retained !== "number" || typeof omitted !== "number" || typeof truncated !== "boolean") return null;
				sessions.push({
					label,
					retained,
					omitted,
					truncated
				});
			}
			return sessions.length === 0 ? null : sessions;
		}
		/**
		* `recall` form: which sessions this material came from and how much of each
		* survived the read, then the material itself.
		*
		* Completeness is the fact a reader needs first: recalled context is bounded on
		* the way in, so a card that hid the omitted count would overstate what the
		* model received.
		* @param props - Durable content, its source, and the locale seat.
		* @returns The recall context body, or the opaque body when unreadable.
		*/
		function RecallBody({ content, source, t }) {
			const sessions = recalledSessions(source);
			if (sessions === null) return (0, react_jsx_runtime.jsx)(OpaqueBody, {
				content,
				source,
				t
			});
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("ul", {
				className: ContextBody_module_css_default.recalls,
				"data-context-recalls": true,
				children: sessions.map((session, index) => (0, react_jsx_runtime.jsxs)("li", {
					className: ContextBody_module_css_default.recall,
					children: [
						(0, react_jsx_runtime.jsx)("span", {
							className: ContextBody_module_css_default.recallLabel,
							children: session.label
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: ContextBody_module_css_default.recallCounts,
							children: t("message.context.recall.counts", {
								retained: session.retained,
								omitted: session.omitted
							})
						}),
						session.truncated && (0, react_jsx_runtime.jsx)("span", {
							className: ContextBody_module_css_default.recallCounts,
							children: t("message.context.recall.truncated")
						})
					]
				}, index))
			}), (0, react_jsx_runtime.jsx)(ModelFacingContent, {
				content,
				t
			})] });
		}
		/** The one-line account a `notice` puts on its collapsed row, when it records one. */
		function noticeSummary(source) {
			const summary = asRecord$1(source)?.["summary"];
			return typeof summary === "string" && summary !== "" ? summary : null;
		}
		/**
		* Choose the body for one context node.
		*
		* Returns the form the body actually rendered as, which is not always the
		* declared one: a declared form whose fields are unreadable falls back to
		* opaque, and the caller labels the row with what it really shows.
		* `summary` is the collapsed row's one-line account, which only a `notice`
		* records: its whole point is being readable without expanding.
		* @param form - the producer-declared form projected onto the node.
		* @param props - durable content, its source, and the locale seat.
		* @returns the rendered form (null for opaque), its collapsed summary, and its body.
		*/
		function contextBody(form, props) {
			const opaque = {
				rendered: null,
				summary: null,
				body: (0, react_jsx_runtime.jsx)(OpaqueBody, { ...props })
			};
			switch (form) {
				case "instructions": return instructionChanges(props.source) === null ? opaque : {
					rendered: "instructions",
					summary: null,
					body: (0, react_jsx_runtime.jsx)(InstructionsBody, { ...props })
				};
				case "catalog": return catalogEntries(props.source) === null ? opaque : {
					rendered: "catalog",
					summary: null,
					body: (0, react_jsx_runtime.jsx)(CatalogBody, { ...props })
				};
				case "snapshot": return snapshotSections(props.source) === null ? opaque : {
					rendered: "snapshot",
					summary: null,
					body: (0, react_jsx_runtime.jsx)(SnapshotBody, { ...props })
				};
				case "notice": {
					const summary = noticeSummary(props.source);
					return summary === null ? opaque : {
						rendered: "notice",
						summary,
						body: (0, react_jsx_runtime.jsx)(NoticeBody, { ...props })
					};
				}
				case "relay": return relaySender(props.source) === null ? opaque : {
					rendered: "relay",
					summary: null,
					body: (0, react_jsx_runtime.jsx)(RelayBody, { ...props })
				};
				case "recall": return recalledSessions(props.source) === null ? opaque : {
					rendered: "recall",
					summary: null,
					body: (0, react_jsx_runtime.jsx)(RecallBody, { ...props })
				};
				case null: return opaque;
				/* v8 ignore next 4 -- closed-union backstop; the compiler rejects a new
				KnownContextForm here rather than letting it degrade to opaque silently. */
				default: throw new Error(`unreachable context form: ${String(form)}`);
			}
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/ContextInjectionRow.module.css.mjs
		const css$12 = ".XrJvXW_root{min-width:0}.XrJvXW_root[data-open]{padding-bottom:4px}.XrJvXW_chevron{color:var(--dsw-alias-label-secondary)}.XrJvXW_sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.XrJvXW_source{min-width:0;color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:none;overflow:hidden}.XrJvXW_summary{min-width:0;color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:auto;overflow:hidden}.XrJvXW_body{box-sizing:border-box;width:calc(100% - 22px - var(--dsh-content-font-delta,0px));max-height:141px;margin:4px 0 0 calc(22px + var(--dsh-content-font-delta,0px));border-radius:var(--dsw-radius-md);background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-tertiary);font:400 11px/16px var(--ds-font-family-code);border:none;padding:10px 16px 12px 12px;overflow:auto}.XrJvXW_toolChanges{white-space:nowrap}";
		const tagId$12 = "@deepseek-ai/dsh-client-ui-chat/ContextInjectionRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$12) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$12;
			tag.textContent = css$12;
			document.head.appendChild(tag);
		}
		var ContextInjectionRow_module_css_default = {
			"body": "XrJvXW_body",
			"chevron": "XrJvXW_chevron",
			"root": "XrJvXW_root",
			"sep": "XrJvXW_sep",
			"source": "XrJvXW_source",
			"summary": "XrJvXW_summary",
			"toolChanges": "XrJvXW_toolChanges"
		};
		//#endregion
		//#region lib/types/client/chat/ContextInjectionRow.js
		/**
		* Render logged context with the Tool calls disclosure chrome from Figma.
		*
		* The header names the role the context plays and, beside it, the producer the
		* durable source identifies, so a reader can tell an injected skill catalog
		* from a workspace instruction file or a recalled session without expanding.
		* The expanded body follows the producer-declared form; an absent or unknown
		* form renders the opaque body.
		* @param props - Durable content, its projected producer role/name and form, and the locale seat.
		* @returns A collapsed context row with a bounded, form-specific body.
		*/
		function ContextInjectionRow({ content, source, producer, form, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const { rendered, summary, body } = contextBody(form, {
				content,
				source,
				t
			});
			const toolBlocks = content.length > 0 && content.every((block) => block.type === "tool-addition" || block.type === "tool-removal") ? content : void 0;
			const added = toolBlocks?.flatMap((block) => block.type === "tool-addition" ? [block.toolName] : []) ?? [];
			const removed = toolBlocks?.flatMap((block) => block.type === "tool-removal" ? [block.toolName] : []) ?? [];
			const single = toolBlocks?.length === 1 ? toolBlocks[0] : void 0;
			const toolSummary = toolBlocks === void 0 || single !== void 0 ? null : added.length > 0 && removed.length > 0 ? t("message.toolsChanged", {
				added: added.length,
				removed: removed.length
			}) : added.length > 0 ? t("message.toolsAddedCount", { count: added.length }) : t("message.toolsRemovedCount", { count: removed.length });
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
				className: ContextInjectionRow_module_css_default.root,
				icon: toolBlocks !== void 0 ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutlineRegular, { size: 14 }) : producer.role === "recall" ? (0, react_jsx_runtime.jsx)("span", {
					"data-context-recall-icon": true,
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ReferenceIconRegular, { kind: "session" })
				}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconContextInjectionOutlineRegular, { size: 14 }),
				chevronClassName: ContextInjectionRow_module_css_default.chevron,
				title: single !== void 0 ? t(single.type === "tool-addition" ? "message.toolAdded" : "message.toolRemoved", { name: single.toolName }) : t(toolBlocks !== void 0 ? "message.toolsUpdated" : producer.role === "recall" ? "message.contextRecall" : "message.contextInjection"),
				collapsedContent: toolSummary !== null ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
					className: ContextInjectionRow_module_css_default.sep,
					"aria-hidden": true
				}), (0, react_jsx_runtime.jsx)("span", {
					className: ContextInjectionRow_module_css_default.summary,
					children: toolSummary
				})] }) : toolBlocks !== void 0 || producer.label === null ? void 0 : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: ContextInjectionRow_module_css_default.sep,
						"aria-hidden": true
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: ContextInjectionRow_module_css_default.source,
						"data-context-source": true,
						children: producer.label
					}),
					summary !== null && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
						className: ContextInjectionRow_module_css_default.sep,
						"aria-hidden": true
					}), (0, react_jsx_runtime.jsx)("span", {
						className: ContextInjectionRow_module_css_default.summary,
						"data-context-summary": true,
						children: summary
					})] })
				] }),
				keepContentWhenOpen: true,
				open: open && single === void 0,
				expandable: single === void 0,
				expandOnRowClick: true,
				onToggle: () => {
					setOpen((value) => !value);
				},
				children: (0, react_jsx_runtime.jsx)("div", {
					className: ContextInjectionRow_module_css_default.body,
					"data-context-injection-body": true,
					"data-context-form": rendered ?? void 0,
					children: toolBlocks === void 0 ? body : (0, react_jsx_runtime.jsxs)("div", {
						className: ContextInjectionRow_module_css_default.toolChanges,
						children: [added.length > 0 && (0, react_jsx_runtime.jsx)("div", { children: t("message.toolsAdded", { names: added.join(", ") }) }), removed.length > 0 && (0, react_jsx_runtime.jsx)("div", { children: t("message.toolsRemoved", { names: removed.join(", ") }) })]
					})
				})
			});
		}
		//#endregion
		//#region lib/types/client/chat/message-chrome.js
		/** Refresh interval for whole-second live run clocks. */
		const LIVE_RUN_CLOCK_INTERVAL_MS = 1e3;
		function pad2(n) {
			return String(n).padStart(2, "0");
		}
		/**
		* Local calendar-day epoch (ms at local midnight) for an instant.
		* @param ms - Unix epoch ms.
		* @returns Midnight of that local calendar day.
		*/
		function startOfLocalDay(ms) {
			const d = new Date(ms);
			d.setHours(0, 0, 0, 0);
			return d.getTime();
		}
		/**
		* Delay until the next local midnight after `ms` (at least 1ms).
		* @param ms - Unix epoch ms.
		* @returns Milliseconds until the following local midnight.
		*/
		function msUntilNextLocalMidnight(ms) {
			const next = new Date(ms);
			next.setHours(24, 0, 0, 0);
			return Math.max(next.getTime() - ms, 1);
		}
		/**
		* Build elapsed-time fragments for both live and completed Turn labels.
		* @param ms - elapsed milliseconds; negatives clamp to zero and fractions floor.
		* @param t - translate seat supplying units and their trailing spacing.
		* @returns numbers and localized units in display order, without leading zeros;
		* minutes start at 60 seconds and hours at 60 minutes.
		*/
		function formatRunDuration(ms, t) {
			const total = Math.max(0, Math.floor(ms / 1e3));
			const hours = Math.floor(total / 3600);
			const minutes = Math.floor(total / 60) % 60;
			const seconds = total % 60;
			const parts = [];
			if (hours > 0) parts.push({
				text: String(hours),
				numeric: true
			}, {
				text: t("duration.hourUnit"),
				numeric: false
			});
			if (total >= 60) parts.push({
				text: String(minutes),
				numeric: true
			}, {
				text: t("duration.minuteUnit"),
				numeric: false
			});
			parts.push({
				text: String(seconds),
				numeric: true
			}, {
				text: t("duration.secondUnit"),
				numeric: false
			});
			return parts;
		}
		/**
		* Decode-throughput figure: whole tokens from ten up, one decimal below.
		* @param tps - Tokens per second.
		* @returns Display number without unit.
		*/
		function formatTokensPerSecond(tps) {
			const clamped = Math.max(0, tps);
			return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10);
		}
		/**
		* Compact local timestamp for message IconActions. Same calendar day →
		* `HH:mm`; earlier this year → the `clock.md` date template + clock; other
		* years → the `clock.ymd` template + clock. Pure: the date templates arrive
		* through the caller's locale seat.
		* @param time - Unix epoch ms from the source session event.
		* @param t - translate seat supplying the `clock.md` / `clock.ymd` templates.
		* @param now - Reference instant for the day/year cut (defaults to wall clock).
		* @returns Date-aware clock string (24-hour, zero-padded time).
		*/
		function formatMessageClock(time, t, now = Date.now()) {
			const d = new Date(time);
			const n = new Date(now);
			const clock = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
			if (d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()) return clock;
			const params = {
				y: d.getFullYear(),
				m: d.getMonth() + 1,
				d: d.getDate()
			};
			return `${d.getFullYear() === n.getFullYear() ? t("clock.md", params) : t("clock.ymd", params)} ${clock}`;
		}
		//#endregion
		//#region lib/types/client/chat/use-calendar-day.js
		/**
		* Local calendar-day epoch that advances at each local midnight.
		* @returns Midnight ms for the current local day; updates after the boundary.
		*/
		function useCalendarDay() {
			const [day, setDay] = (0, react.useState)(() => startOfLocalDay(Date.now()));
			(0, react.useEffect)(() => {
				let timer;
				const arm = () => {
					const now = Date.now();
					setDay(startOfLocalDay(now));
					timer = setTimeout(arm, msUntilNextLocalMidnight(now));
				};
				timer = setTimeout(arm, msUntilNextLocalMidnight(Date.now()));
				return () => {
					clearTimeout(timer);
				};
			}, []);
			return day;
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/MessageIconActions.module.css.mjs
		const css$11 = ".xzv4MW_actions{height:calc(28px + var(--dsh-content-font-delta,0px));align-items:center;gap:8px;display:flex}.xzv4MW_timeStart{font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-tertiary);white-space:nowrap;padding-right:12px}.xzv4MW_timeEnd{font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:inherit;white-space:nowrap}.xzv4MW_endInfo{min-width:0;color:var(--dsw-alias-label-tertiary);align-items:center;gap:8px;margin-left:8px;display:inline-flex}@media (hover:hover){[data-actions-reveal=hover] .xzv4MW_actions,:is([data-chat-flow-kind=user],[data-chat-flow-kind=steering]):has(~:is([data-chat-flow-kind=user],[data-chat-flow-kind=steering])) .xzv4MW_actions{opacity:0;transition:opacity 80ms}[data-actions-reveal=hover]:hover .xzv4MW_actions,[data-actions-reveal=hover]:focus-within .xzv4MW_actions,:is([data-chat-flow-kind=user],[data-chat-flow-kind=steering]):has(~:is([data-chat-flow-kind=user],[data-chat-flow-kind=steering])):hover .xzv4MW_actions,:is([data-chat-flow-kind=user],[data-chat-flow-kind=steering]):has(~:is([data-chat-flow-kind=user],[data-chat-flow-kind=steering])):focus-within .xzv4MW_actions{opacity:1}}.xzv4MW_action{width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;padding:6px;display:inline-flex}.xzv4MW_action svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}.xzv4MW_actions[data-clock=end] .xzv4MW_action svg{width:calc(17px + var(--dsh-content-font-delta,0px));height:calc(17px + var(--dsh-content-font-delta,0px))}.xzv4MW_action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.xzv4MW_action[data-unavailable]{cursor:default;opacity:.4}.xzv4MW_action[data-unavailable]:hover{color:var(--dsw-alias-label-tertiary);background:0 0}.xzv4MW_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}";
		const tagId$11 = "@deepseek-ai/dsh-client-ui-chat/MessageIconActions.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$11) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$11;
			tag.textContent = css$11;
			document.head.appendChild(tag);
		}
		var MessageIconActions_module_css_default = {
			"action": "xzv4MW_action",
			"actions": "xzv4MW_actions",
			"endInfo": "xzv4MW_endInfo",
			"timeEnd": "xzv4MW_timeEnd",
			"timeStart": "xzv4MW_timeStart",
			"visuallyHidden": "xzv4MW_visuallyHidden"
		};
		//#endregion
		//#region lib/types/client/chat/MessageIconActions.js
		/**
		* Copy / branch (/ clock) IconActions row shared by user and assistant chrome.
		* @param props - Copy text, event time, clock side, branch callback, className.
		* @returns The actions row element.
		*/
		function MessageIconActions({ text, time, clock, onBranch, branchUnavailable = false, className, extraActions, usageAction, t }) {
			const day = useCalendarDay();
			const reasonId = (0, react.useId)();
			const [copied, setCopied] = (0, react.useState)(false);
			const copyPending = (0, react.useRef)(false);
			const copyTimer = (0, react.useRef)(null);
			const copyEpoch = (0, react.useRef)(0);
			(0, react.useEffect)(() => () => {
				copyEpoch.current += 1;
				copyPending.current = false;
				if (copyTimer.current !== null) clearTimeout(copyTimer.current);
			}, []);
			const onCopy = (0, react.useCallback)(() => {
				if (copied || copyPending.current) return;
				const epoch = copyEpoch.current;
				copyPending.current = true;
				(0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(text).then((ok) => {
					if (epoch !== copyEpoch.current) return;
					copyPending.current = false;
					if (!ok) return;
					setCopied(true);
					copyTimer.current = window.setTimeout(() => {
						copyTimer.current = null;
						setCopied(false);
					}, 1e3);
				});
			}, [copied, text]);
			const clockEl = time === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
				className: clock === "start" ? MessageIconActions_module_css_default.timeStart : MessageIconActions_module_css_default.timeEnd,
				children: formatMessageClock(time, t, day)
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				className: className === void 0 ? MessageIconActions_module_css_default.actions : `${MessageIconActions_module_css_default.actions} ${className}`,
				"data-clock": clock,
				children: [
					clock === "start" ? clockEl : null,
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: copied ? t("copied") : t("copy"),
						side: "bottom",
						children: (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: MessageIconActions_module_css_default.action,
							"aria-label": copied ? t("copied") : t("copy"),
							onClick: onCopy,
							children: copied ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, {})
						})
					}),
					extraActions,
					onBranch !== void 0 && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: branchUnavailable ? t("message.branchUnavailable") : t("message.branch"),
						side: "bottom",
						children: (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: MessageIconActions_module_css_default.action,
							"aria-label": t("message.branch"),
							"aria-disabled": branchUnavailable || void 0,
							"aria-describedby": branchUnavailable ? reasonId : void 0,
							"data-unavailable": branchUnavailable || void 0,
							onClick: branchUnavailable ? void 0 : onBranch,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, {})
						})
					}),
					onBranch !== void 0 && branchUnavailable && (0, react_jsx_runtime.jsx)("span", {
						id: reasonId,
						className: MessageIconActions_module_css_default.visuallyHidden,
						children: t("message.branchUnavailable")
					}),
					clock === "end" ? (0, react_jsx_runtime.jsxs)("span", {
						className: MessageIconActions_module_css_default.endInfo,
						children: [usageAction, clockEl]
					}) : usageAction
				]
			});
		}
		//#endregion