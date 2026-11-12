/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		* Project the composer document and its caret.
		* @param idOf - stable occurrence-id assignment per chip NodeKey (the shell
		* owns the map so ids survive across projections of the same node).
		* @returns the three-view projection product.
		*/
		function $projectComposer(idOf) {
			const layout = $composerLayout();
			const occurrences = [];
			for (const segment of layout.segments) {
				if (segment.kind !== "chip" || !$isReferenceChipNode(segment.node)) continue;
				const chip = segment.node;
				occurrences.push({
					occurrenceId: idOf(chip.getKey()),
					source: chip.getSource(),
					ref: chip.getReference(),
					offset: segment.clipboardStart,
					length: segment.clipboardLength,
					label: chip.getLabel(),
					...chip.getAppearance() === void 0 ? {} : { appearance: chip.getAppearance() },
					clipboardText: chip.getTextContent(),
					...chip.isInvalid() ? { invalid: true } : {}
				});
			}
			const lead = layout.segments[0]?.node;
			const selection = Kr();
			let range = null;
			if (ur(selection)) {
				const anchor = $detectOffsetOfPoint(layout, selection.anchor);
				const focus = $detectOffsetOfPoint(layout, selection.focus);
				if (anchor !== null && focus !== null) range = {
					start: Math.min(anchor, focus),
					end: Math.max(anchor, focus)
				};
			}
			return {
				detectText: layout.detectText,
				clipboardText: layout.clipboardText,
				occurrences,
				selection: range,
				caret: range !== null && range.start === range.end ? range.start : null,
				command: $isCommandChipNode(lead) ? lead.getClaim() : void 0
			};
		}
		//#endregion
		//#region lib/types/client/input/editor/span-map.js
		/**
		* Resolve one detect offset to a selection point. Ownership rule: the first
		* segment whose half-open [start, end) contains the offset resolves it; the
		* document end falls to the last block. Atomic segments (chip, linebreak)
		* resolve to element points beside them, so a span can only ever address a
		* chip as a whole; a gap offset is the end of the block before it.
		* @param layout - current walk product.
		* @param offset - detect offset in [0, detectLength].
		* @returns the point, or null when the offset is out of bounds.
		*/
		function resolvePoint(layout, offset) {
			if (offset < 0 || offset > layout.detectLength) return null;
			for (const segment of layout.segments) {
				if (offset >= segment.detectStart + segment.detectLength) continue;
				if (segment.kind === "text" && segment.node !== null) return {
					key: segment.node.getKey(),
					offset: offset - segment.detectStart,
					type: "text"
				};
				if (segment.kind === "gap" && segment.gapBetween !== void 0) {
					const before = segment.gapBetween.before;
					return {
						key: before,
						offset: layout.children.get(before)?.length ?? 0,
						type: "element"
					};
				}
				/* v8 ignore next -- non-gap segments always carry their node. */
				if (segment.node === null) return null;
				const element = segment.node.getParent();
				/* v8 ignore next -- a walked leaf always has a parent element. */
				if (element === null) return null;
				return {
					key: element.getKey(),
					offset: segment.node.getIndexWithinParent(),
					type: "element"
				};
			}
			const blocks = nl().getChildren();
			const last = blocks[blocks.length - 1];
			if (last === void 0) return {
				key: nl().getKey(),
				offset: 0,
				type: "element"
			};
			return {
				key: last.getKey(),
				offset: layout.children.get(last.getKey())?.length ?? 0,
				type: "element"
			};
		}
		/**
		* Build and apply a live RangeSelection over one detect span.
		* @param layout - current walk product.
		* @param span - detect span.
		* @returns the applied selection, or null when either endpoint fails to map.
		*/
		function selectSpan(layout, span) {
			if (span.start < 0 || span.start > span.end || span.end > layout.detectLength) return null;
			const anchor = resolvePoint(layout, span.start);
			const focus = resolvePoint(layout, span.end);
			/* v8 ignore next -- bounds were checked above; resolvePoint only fails out of bounds. */
			if (anchor === null || focus === null) return null;
			const selection = Fr();
			selection.anchor.set(anchor.key, anchor.offset, anchor.type);
			selection.focus.set(focus.key, focus.offset, focus.type);
			ol(selection);
			return selection;
		}
		/**
		* Replace one detect span with plain text (empty text deletes the span).
		* The caret lands after the insertion.
		* @param span - detect span to replace.
		* @param text - replacement text.
		* @returns whether the span mapped and the edit applied.
		*/
		function $replaceDetectSpanWithText(span, text) {
			const selection = selectSpan($composerLayout(), span);
			if (selection === null) return false;
			if (text === "" && !selection.isCollapsed()) selection.removeText();
			else selection.insertText(text);
			return true;
		}
		/**
		* Replace one detect span with nodes (chip insertion path). The caret lands
		* after the last inserted node.
		* @param span - detect span to replace.
		* @param nodes - replacement nodes in order.
		* @returns whether the span mapped and the edit applied.
		*/
		function $replaceDetectSpanWithNodes(span, nodes) {
			const selection = selectSpan($composerLayout(), span);
			if (selection === null) return false;
			selection.insertNodes([...nodes]);
			return true;
		}
		//#endregion
		//#region lib/types/client/input/editor/runtime.js
		/**
		* Detect-projection and legacy reference placeholders stripped from every
		* external text entering the document (paste, persisted-draft seed): a chip
		* is the only legitimate source of U+FFFC in the detect projection, so a
		* literal one in text would forge chip positions.
		*/
		const REFERENCE_PLACEHOLDER_RE = /[\uE100-\uE11D\uFFFC]/gu;
		/** Undo merge window for contiguous typing, in ms (the old machine's mergeWindowMs). */
		const HISTORY_MERGE_DELAY_MS = 1e3;
		/** One model-owned editor; registration and disposal remain with its model. */
		var DraftEditorRuntime = class {
			deps;
			/** The editor bound by the Composer's contenteditable host. */
			editor;
			projected = {
				detectText: "",
				clipboardText: "",
				occurrences: [],
				selection: null,
				caret: null,
				command: void 0
			};
			/** Stable occurrence ids per chip NodeKey (undo restores keys, so ids survive it too). */
			occurrenceIds = /* @__PURE__ */ new Map();
			occurrenceSeq = 0;
			/** Live lexicon subscription disposer; undefined until the controller resolves. */
			lexiconOff;
			lexiconSource;
			/** @param deps - model callbacks used by editor listeners and transforms. */
			constructor(deps) {
				this.deps = deps;
				this.editor = ys({
					namespace: "dsh-composer",
					nodes: [
						ReferenceChipNode,
						CommandChipNode,
						TextRefNode
					],
					onError: (error) => {
						throw error;
					}
				});
			}
			/**
			* Install editor behavior after the model holds this runtime.
			* @returns unregister callback that also detaches the editor root.
			*/
			register() {
				const preserveExternalSelection = () => {
					const root = this.editor.getRootElement();
					if (root !== null && !root.contains(root.ownerDocument.activeElement)) Al(bo);
					return false;
				};
				const unregister = Eu(O$1(this.editor), this.editor.registerCommand(Mn$1, () => {
					this.editor.update(preserveExternalSelection, { discrete: true });
					return false;
				}, 4), this.editor.registerCommand(Ie$2, preserveExternalSelection, 4), this.editor.registerNodeTransform(zi, preserveExternalSelection), registerReferenceActivation(this.editor, (source, reference) => this.deps.openReference(source, reference)), O(this.editor, z(), HISTORY_MERGE_DELAY_MS), this.editor.registerUpdateListener(() => {
					this.deps.onUpdate();
				}), registerCommandChipSeat(this.editor), registerCommandChipSelection(this.editor), registerTextRefDecoration(this.editor, () => this.deps.lexicon()), () => {
					this.lexiconOff?.();
					this.lexiconOff = void 0;
					this.lexiconSource = void 0;
				});
				return () => {
					unregister();
					this.editor.setRootElement(null);
				};
			}
			/** The latest committed editor projection. */
			get projection() {
				return this.projected;
			}
			/**
			* Run one editor edit whose result is observable on return. At the top
			* level this is a discrete update. Inside this editor's own update —
			* command handlers land here synchronously (space/enter picks, paste) —
			* $-functions are already legal, and wrapping them in update() would DEFER
			* them past the synchronous bail answer (and a nested discrete throws);
			* the body runs directly and the outer update commits it.
			* @param fn - the $-edit body.
			*/
			applyEdit(fn, tag) {
				if (this.editor._updating) {
					if (tag !== void 0) Al(tag);
					fn();
					return;
				}
				this.editor.update(fn, {
					discrete: true,
					...tag === void 0 ? {} : { tag }
				});
			}
			/**
			* Reconnect decorations when the optional trigger provider changes.
			* The rescan reads the current editor and does not replace its content.
			*/
			refreshLexiconSubscription() {
				const lexicon = this.deps.resolveLexicon();
				if (lexicon === this.lexiconSource) return;
				this.lexiconOff?.();
				this.lexiconSource = lexicon;
				this.lexiconOff = lexicon?.subscribe(() => {
					rescanTextRefs(this.editor);
				});
				rescanTextRefs(this.editor);
			}
			/**
			* Re-project inside the existing editor update callback.
			* @returns the projection preceding this read.
			*/
			refreshProjection() {
				const prev = this.projected;
				this.projected = this.editor.getEditorState().read(() => $projectComposer((key) => this.occurrenceIdOf(key)));
				return prev;
			}
			occurrenceIdOf(key) {
				const existing = this.occurrenceIds.get(key);
				if (existing !== void 0) return existing;
				this.occurrenceSeq += 1;
				this.occurrenceIds.set(key, this.occurrenceSeq);
				return this.occurrenceSeq;
			}
			/**
			* Replace the whole draft (persisted-draft seed and programmatic writes).
			* Placeholder-sanitized; newlines split paragraphs; the caret lands at the
			* end. Merged into history so a seed is not an undoable step of its own.
			* @param text - the full next draft.
			*/
			setDraft(text) {
				const clean = text.replace(REFERENCE_PLACEHOLDER_RE, "");
				if (clean === this.projection.clipboardText && this.projection.occurrences.length === 0) return;
				this.editor.update(() => {
					const root = nl();
					root.clear();
					for (const line of clean.split("\n")) {
						const paragraph = es();
						if (line !== "") paragraph.append(Go(line));
						root.append(paragraph);
					}
					root.selectEnd();
				}, {
					discrete: true,
					tag: xo
				});
			}
			/**
			* Insert pasted plain text over the current editor selection
			* (placeholder-sanitized). The paste event's own default is suppressed by
			* the caller; PASTE_TAG makes the paste its own history boundary, so one
			* undo never removes both the paste and typing inside the merge window.
			* @param text - pasted plain text.
			*/
			paste(text) {
				const clean = text.replace(REFERENCE_PLACEHOLDER_RE, "");
				if (clean === "") return;
				this.applyEdit(() => {
					const selection = Kr();
					if (ur(selection)) {
						selection.insertText(clean);
						return;
					}
					const root = nl();
					if (root.getChildrenSize() === 0) root.append(es());
					root.selectEnd().insertText(clean);
				}, Co);
			}
			/**
			* The live selection as a detect-coordinate span (menu-launcher synthetic
			* hits replace it on pick); an absent selection answers a collapsed span at
			* the document end.
			* @returns the ordered [start, end) span in detect coordinates.
			*/
			caretSpan() {
				if (this.projection.selection !== null) return this.projection.selection;
				const at = this.projection.detectText.length;
				return {
					start: at,
					end: at
				};
			}
			/**
			* Replace a mapped span without applying the model's phase or revision guards.
			* @param span - detect-coordinate range.
			* @param text - inserted text.
			* @returns whether the range mapped and the edit applied.
			*/
			replaceText(span, text) {
				let applied = false;
				this.applyEdit(() => {
					applied = $replaceDetectSpanWithText(span, text);
				});
				return applied;
			}
			/**
			* Insert an asynchronous text result as one independent undo operation.
			* @param span - owner-validated insertion range.
			* @param text - text sanitized with the same rules as paste.
			* @returns whether the range mapped and the edit applied.
			*/
			insertAsyncText(span, text) {
				let applied = false;
				const clean = text.replace(REFERENCE_PLACEHOLDER_RE, "");
				this.applyEdit(() => {
					applied = $replaceDetectSpanWithText(span, clean);
				}, Co);
				return applied;
			}
			/**
			* Insert a reference chip with the existing trailing-space rule.
			* @param span - detect-coordinate range.
			* @param ref - reference fields.
			* @param tail - the character following the range before editing.
			* @returns whether the range mapped and the edit applied.
			*/
			insertReference(span, ref, tail) {
				let applied = false;
				this.applyEdit(() => {
					applied = $replaceDetectSpanWithNodes(span, tail === " " ? [$createReferenceChipNode(ref)] : [$createReferenceChipNode(ref), Go(" ")]);
				});
				return applied;
			}
			/**
			* Replace a span with a command chip followed by the claim token's
			* argument separator, unless the separator already follows.
			* @param span - detect-coordinate range.
			* @param claim - the command claim the chip anchors.
			* @param tail - the character following the range before editing.
			* @param mergeHistory - merge into the previous history entry (a restored
			* draft's chip is part of its seed, not an undoable step).
			* @returns whether the range mapped and the edit applied.
			*/
			insertCommand(span, claim, tail, mergeHistory = false) {
				const separator = claim.token.slice(claim.token.trimEnd().length);
				let applied = false;
				this.applyEdit(() => {
					applied = $replaceDetectSpanWithNodes(span, separator === "" || tail === separator.charAt(0) ? [$createCommandChipNode(claim)] : [$createCommandChipNode(claim), Go(separator)]);
				}, mergeHistory ? xo : void 0);
				return applied;
			}
			/**
			* Insert an ordered file-reference batch after the live selection without deleting it.
			* @param references - validated references in source order.
			* @returns whether the live insertion position accepted the batch.
			*/
			insertFileReferences(references) {
				if (references.length === 0) return true;
				let applied = false;
				this.applyEdit(() => {
					const projection = $projectComposer((key) => this.occurrenceIdOf(key));
					const at = projection.selection?.end ?? projection.detectText.length;
					const before = projection.detectText.slice(0, at);
					const nodes = references.flatMap((ref) => [$createReferenceChipNode(ref), Go(" ")]);
					if (before !== "" && !/\s$/u.test(before)) nodes.unshift(Go(" "));
					applied = $replaceDetectSpanWithNodes({
						start: at,
						end: at
					}, nodes);
export {};
