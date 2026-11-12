/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
						});
					});
					return;
				}
				this.cancelFrame();
				this.flush();
			}
			cancelFrame() {
				if (this.frame !== void 0 && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.frame);
				this.frame = void 0;
			}
			flush() {
				if (this.assembler.flush()) this.snapshot.set(this.currentSnapshot());
				this.openTurn.set(this.assembler.openTurn());
			}
			currentSnapshot() {
				return {
					views: this.viewStore,
					activeTargets: this.assembler.activityTargets()
				};
			}
		};
		/** Root service owning Conversation registries and per-Session bindings. */
		var UiConversation = class extends _deepseek_ai_cordis.Service {
			sessions;
			/** Registry of event matchers and target snapshot builders. */
			events;
			/** Registry of target View definitions. */
			views;
			/** Business grouping rules over already materialized target Nodes. */
			groups;
			/** Pure text rules and parser snapshots, independent of durable Session assembly. */
			userText;
			bindings = new WeakMapWithValues();
			images;
			/**
			* @param ctx - owning Client context.
			* @param sessions - Session Controller object layer.
			*/
			constructor(ctx, sessions) {
				super(ctx, "uiConversation");
				this.sessions = sessions;
				this.events = new ConversationEventRegistry(ctx);
				this.views = new ConversationViewRegistry(ctx);
				this.groups = new ConversationGroupRegistry(ctx, this.views);
				this.userText = new UserTextRegistry(ctx);
				this.images = new HistoricalImageCache(ctx, sessions);
				const rebuild = () => {
					for (const record of this.bindings.values) record.binding.rebuild();
				};
				let rebuildQueued = false;
				const scheduleRebuild = () => {
					if (rebuildQueued) return;
					rebuildQueued = true;
					queueMicrotask(() => {
						rebuildQueued = false;
						rebuild();
					});
				};
				ctx.effect(() => {
					const disposeEvents = this.events.subscribe(scheduleRebuild);
					const disposeViews = this.views.subscribe(scheduleRebuild);
					const disposeGroups = this.groups.subscribe(scheduleRebuild);
					return () => {
						disposeGroups();
						disposeViews();
						disposeEvents();
						for (const record of [...this.bindings.values]) this.drop(record, true);
					};
				}, "ui-conversation assembly");
			}
			/**
			* Resolve the Conversation binding for one Controller binding or Session id.
			* @param source - Session binding or identity.
			* @returns stable Conversation binding.
			* @throws if the Session is unknown or its binding is no longer current.
			*/
			binding(source) {
				const sessionId = typeof source === "string" ? source : source.sessionId;
				const owner = typeof source === "string" ? this.sessions.binding(source) : source;
				if (owner === void 0) throw new Error(`uiConversation.binding: unknown session "${sessionId}"`);
				if (this.sessions.binding(sessionId) !== owner) throw new Error(`uiConversation.binding: inactive session "${sessionId}"`);
				const current = this.bindings.get(owner);
				if (current !== void 0) return current.binding;
				const binding = new BoundConversation(owner.eventSource, new ConversationNodeAssembler(this.events, this.views, this.groups));
				const record = {
					source: owner,
					binding,
					disposeScope: () => {}
				};
				this.bindings.set(owner, record);
				const disposeScope = owner.ctx.effect(() => () => {
					this.drop(record, false);
				}, "ui-conversation binding");
				record.disposeScope = () => {
					disposeScope();
				};
				return binding;
			}
			/**
			* Resolve one session-authorized durable image URL, cached per Session so
			* every Conversation target shares one read and one browser URL.
			* @param sessionId - Session authorization and lifetime scope.
			* @param attachment - Durable image reference from a session event.
			* @returns browser URL valid until the Session binding is released.
			*/
			imageUrl(sessionId, attachment) {
				return this.images.resolve(sessionId, attachment);
			}
			/**
			* Read a cached durable image URL synchronously when one is available.
			* @param sessionId - Session authorization and lifetime scope.
			* @param attachment - Durable image reference from a session event.
			* @returns current preview or canonical URL, if cached.
			*/
			peekImageUrl(sessionId, attachment) {
				return this.images.peek(sessionId, attachment);
			}
			/**
			* Adopt an already-displayable URL for one durable reference (see
			* HistoricalImageCache.seed): the transcript node then renders it without a
			* byte round-trip.
			* @param sessionId - Session authorization and lifetime scope.
			* @param attachment - Durable image reference the URL displays.
			* @param url - browser URL to adopt.
			* @returns whether the cache took URL ownership.
			*/
			seedImageUrl(sessionId, attachment, url) {
				return this.images.seed(sessionId, attachment, url);
			}
			/**
			* Interpret a system message or surface replacement for target-owned prompt Definitions.
			* @param previous - System facts at the preceding relevant loaded event.
			* @param event - Durable system message or positional replacement.
			* @returns Immutable prompt interpretation at this event.
			*/
			inspectSystemPrompt(previous, event) {
				return inspectSystemPrompt(previous, event);
			}
			/**
			* Canonicalize one `request/header` event against the previous prompt state
			* and the `system/message` node in force.
			*
			* A pure interpretation shared by the Chat and Trajectory Definitions, exposed
			* as a service method because cross-plugin value imports are forbidden in
			* client bundles.
			* @param previous - prompt recorded by the preceding loaded header, if any.
			* @param event - the `request/header` session event to interpret.
			* @param system - effective prompt after loaded surface replacements, if any.
			* @returns the canonical prompt snapshot and any model-visible change.
			*/
			inspectRequestPrompt(previous, event, system) {
				return inspectRequestPrompt(previous, event, system);
			}
			drop(record, releaseScope) {
				if (this.bindings.get(record.source) !== record) return;
				this.bindings.delete(record.source);
				record.binding.dispose();
				if (releaseScope) record.disposeScope();
			}
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-conversation/src/client/user-text/UserText.module.css.mjs
		const css$9 = ".BNl2La_root{display:contents}.BNl2La_ellipsis{text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:100%;display:block;overflow:hidden}";
		const tagId$9 = "@deepseek-ai/dsh-client-ui-conversation/UserText.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$9) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$9;
			tag.textContent = css$9;
			document.head.appendChild(tag);
		}
		var UserText_module_css_default = {
			"ellipsis": "BNl2La_ellipsis",
			"root": "BNl2La_root"
		};
		//#endregion
		//#region lib/types/client/user-text/UserText.js
		/** User-text presentation delegates evaluation to its data-layer document and renders JSON business nodes. */
		/**
		* Render original text through pure matching rules and business-owned node Slots.
		* A failed parse retains the entire original text and reports the rule error.
		* @param props - original text, confirmed facts, display policy, and framework seats.
		* @returns ordered inline nodes with raw-text fallbacks for missing registrations.
		*/
		function UserText({ text, facts, interactive = false, ellipsis = false, useUserTextRevision, createUserTextEvaluator, reportTransformFailure, renderSlot }) {
			useUserTextRevision((revision) => revision);
			const evaluate = (0, react.useMemo)(createUserTextEvaluator, [createUserTextEvaluator]);
			let nodes;
			let error;
			try {
				nodes = evaluate({
					text,
					facts
				});
			} catch (cause) {
				error = cause;
			}
			const failed = nodes === void 0;
			(0, react.useEffect)(() => {
				if (failed) reportTransformFailure(error);
			}, [
				failed,
				error,
				reportTransformFailure
			]);
			const content = (0, react.useMemo)(() => nodes === void 0 ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.UserTextRun, { text }) : (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: nodes.map((node) => {
				const raw = text.slice(node.start, node.end);
				return (0, react_jsx_runtime.jsx)(react.Fragment, { children: renderSlot("conversation.user.text.node", {
					node,
					raw,
					interactive
				}, {
					entryKey: node.id,
					fallback: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.UserTextRun, { text: node.id === "text" ? node.data.display ?? raw : raw })
				}) }, `${node.id}:${node.start}`);
			}) }), [
				nodes,
				text,
				interactive,
				renderSlot
			]);
			return (0, react_jsx_runtime.jsx)("span", {
				className: ellipsis ? UserText_module_css_default.ellipsis : UserText_module_css_default.root,
				children: content
			});
		}
		/**
		* Display an unmatched substring without business interpretation.
		* @param props - parser-produced plain-text node.
		* @returns its inline text.
		*/
		function PlainUserText({ node }) {
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.UserTextRun, { text: node.data.display ?? node.data.text });
		}
		/**
		* Display a confirmed Session label without inventing navigation behavior.
		* @param props - Session reference JSON and its original spelling.
		* @returns the existing non-interactive Session chip.
		*/
		function SessionReference({ node, raw }) {
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ReferenceChip, {
				appearance: "session",
				label: node.data.label,
				title: raw
			});
		}
		//#endregion
		//#region lib/types/client/user-text/session-reference-rule.js
		/** Find the nearest Session reference; bare labels read their Facts only at a non-wire @ position. */
		const sessionReferenceRule = {
			id: "session",
			order: 10,
			match(text, from, context) {
				let labels;
				let readLabels = false;
				const wire = /@\[([^\]\n]+)\]\(dsh-session:[^)\s]+\)/uy;
				for (let start = text.indexOf("@", from); start >= 0; start = text.indexOf("@", start + 1)) {
					wire.lastIndex = start;
					const explicit = wire.exec(text);
					if (explicit !== null) return {
						id: "session",
						start,
						end: start + explicit[0].length,
						data: { label: explicit[1] }
					};
					if (!readLabels) {
						labels = context.read("sessionLabels");
						readLabels = true;
					}
					let best;
					for (const label of labels ?? []) {
						if (label.length === 0 || !text.startsWith(label, start + 1)) continue;
						const end = start + label.length + 1;
						if (best === void 0 || end > best.end) best = {
							id: "session",
							start,
							end,
							data: { label }
						};
					}
					if (best !== void 0) return best;
				}
			}
		};
		//#endregion
		//#region lib/types/client/user-text/whitespace-rules.js
		function replacement(text, start, end, display) {
			return {
				id: "text",
				start,
				end,
				data: {
					text: text.slice(start, end),
					display
				}
			};
		}
		/** Offer the next whitespace run whose display collapses to one space. */
		const collapseWhitespaceRule = {
			id: "text.collapse-whitespace",
			order: 1010,
			match(text, from, context) {
				if (!context.read("collapseWhitespace")) return void 0;
				const spaces = /\s+/gu;
				spaces.lastIndex = from;
				for (let match = spaces.exec(text); match !== null; match = spaces.exec(text)) {
					if (match.index > 0 && /\s/u.test(text.slice(match.index - 1, match.index)) || match[0] === " ") continue;
					return replacement(text, match.index, match.index + match[0].length, " ");
				}
			}
		};
		/** Offer original document-edge whitespace, winning same-start collisions with collapse. */
		const trimWhitespaceRule = {
			id: "text.trim-whitespace",
			order: 1e3,
			match(text, from, context) {
				if (!context.read("trimWhitespace")) return void 0;
				if (from === 0) {
					const leading = /^\s+/u.exec(text);
					if (leading !== null) return replacement(text, 0, leading[0].length, "");
				}
				let start = text.length;
				const whitespace = /\s/u;
				while (start > 0 && whitespace.test(text.charAt(start - 1))) start--;
				return start === text.length || start < from ? void 0 : replacement(text, start, text.length, "");
			}
		};
		//#endregion
		//#region lib/types/client/draft.js
		/** Semantic draft snapshots shared by storage, programmatic input, and editor restoration. */
		const referenceSchema = zod.z.object({
			source: zod.z.string(),
			ref: zod.z.string(),
			offset: zod.z.number().int().nonnegative(),
			length: zod.z.number().int().positive(),
			label: zod.z.string(),
			appearance: zod.z.enum([
				"session",
				"file",
				"folder"
			]).optional(),
			clipboardText: zod.z.string(),
			invalid: zod.z.boolean().optional()
		});
		const commandSchema = zod.z.object({ token: zod.z.string() });
		const snapshotSchema = zod.z.object({
			text: zod.z.string(),
			references: zod.z.array(referenceSchema),
			command: commandSchema.optional()
		}).refine((draft) => {
			const spelling = draft.command?.token.trimEnd();
			if (spelling !== void 0 && (!/^\/\S/u.test(spelling) || !draft.text.startsWith(spelling))) return false;
			let end = spelling?.length ?? 0;
			for (const reference of draft.references) {
				if (reference.offset < end || reference.length !== reference.clipboardText.length) return false;
				end = reference.offset + reference.length;
				if (end > draft.text.length || draft.text.slice(reference.offset, end) !== reference.clipboardText) return false;
			}
			return true;
		}, "Draft references must identify ordered, non-overlapping text spans after the leading command token");
		/**
		* Copy input into the semantic draft representation without editor runtime identities.
		* @param input - plain text or caller-owned structured content.
		* @returns an owned snapshot ready for editor import.
		*/
		function resolveDraftInput(input) {
			if (typeof input === "string") return {
				text: input,
				references: []
			};
			return {
				text: input.text,
				references: input.references.map(copyReference),
				...input.command === void 0 ? {} : { command: { token: input.command.token } }
			};
		}
		/**
		* Decode persisted drafts, accepting the earlier plain-string representation.
		* @param value - JSON value read from browser storage.
		* @returns the decoded draft, or undefined for invalid data.
		*/
		function parseStoredDraft(value) {
			if (typeof value === "string") return resolveDraftInput(value);
			const parsed = snapshotSchema.safeParse(value);
			if (!parsed.success) return void 0;
			return {
				text: parsed.data.text,
				references: parsed.data.references.map(({ appearance, invalid, ...reference }) => ({
					...reference,
					...appearance === void 0 ? {} : { appearance },
					...invalid === void 0 ? {} : { invalid }
				})),
				...parsed.data.command === void 0 ? {} : { command: { token: parsed.data.command.token } }
			};
		}
		/**
		* Export reference identities without their editor-local occurrence ids.
		* @param text - current clipboard projection.
		* @param occurrences - matching reference projections from the same document revision.
export {};
