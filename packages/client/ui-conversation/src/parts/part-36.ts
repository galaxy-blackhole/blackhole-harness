/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		* @returns the unregister disposer.
		*/
		function registerTextRefDecoration(editor, lexiconOf) {
			const getMatch = (text) => {
				const range = scanTextRefs(text, lexiconOf())[0];
				return range === void 0 ? null : {
					start: range.start,
					end: range.end
				};
			};
			return Eu(...x(editor, getMatch, TextRefNode, (node) => new TextRefNode(node.getTextContent())));
		}
		/**
		* Force a re-scan of the whole document (transforms only visit dirty nodes;
		* a lexicon roll change dirties nothing on its own). Queued, not discrete —
		* the caller may sit inside an update listener.
		* @param editor - the shell-owned editor.
		*/
		function rescanTextRefs(editor) {
			editor.update(() => {
				for (const node of nl().getAllTextNodes()) node.markDirty();
			}, { tag: xo });
		}
		//#endregion
		//#region lib/types/client/input/editor/reference-activation.js
		/** Route composer clicks through the live reference owner without editing the draft. */
		/**
		* Install preview activation for atomic chips and editable reference tokens.
		* @param editor - composer editor.
		* @param open - live source routing; false preserves ordinary editor handling.
		* @returns command disposer.
		*/
		function registerReferenceActivation(editor, open) {
			return editor.registerCommand(Ke$2, (event) => {
				if (event.target === null || event.button !== 0 || event.detail > 1) return false;
				const selection = Kr();
				if (ur(selection) && !selection.isCollapsed()) return false;
				const node = Zs(event.target);
				if ($isReferenceChipNode(node)) {
					if (node.isInvalid()) return false;
					const appearance = node.getAppearance();
					return open(node.getSource(), {
						ref: node.getReference(),
						...appearance === void 0 ? {} : { appearance }
					});
				}
				return node instanceof TextRefNode && open(void 0, { ref: node.getTextContent() });
			}, 1);
		}
		//#endregion
		//#region lib/types/client/input/editor/CommandChip.js
		/**
		* Visual body of the claimed command chip: the CommandChipNode's React face.
		* Pure display with the reference chip's treatment; the claim and its
		* lifecycle live on the node and the shell.
		*/
		/**
		* Render the claimed command chip.
		* @param props - the token to display.
		* @returns the chip body.
		*/
		function CommandChip({ token }) {
			return (0, react_jsx_runtime.jsx)("span", {
				className: clsx(composer_editor_module_css_default.reference, ReferenceChip_module_css_default.chip),
				children: (0, react_jsx_runtime.jsx)("span", {
					className: ReferenceChip_module_css_default.label,
					children: token
				})
			});
		}
		//#endregion
		//#region lib/types/client/input/editor/command-chip-node.js
		/** One claimed command as an atomic decorator node. */
		var CommandChipNode = class CommandChipNode extends Li {
			/** The claim this chip anchors; its submit closure has no JSON form. */
			__claim;
			/** Lexical node registry type tag. */
			static getType() {
				return "command-chip";
			}
			/**
			* Clone with identity (Lexical writable-copy contract).
			* @param node - node to clone.
			* @returns a copy carrying the same NodeKey and claim.
			*/
			static clone(node) {
				return new CommandChipNode(node.__claim, node.__key);
			}
			/**
			* Rebuild one chip from its JSON form. JSON cannot carry the claim's
			* submit closure, so an imported command is its literal token text.
			* @param json - serialized chip.
			* @returns a plain text node holding the token.
			*/
			static importJSON(json) {
				return Go(json.text);
			}
			/**
			* @param claim - the command claim the chip anchors.
			* @param key - Lexical clone-path key; absent for fresh nodes.
			*/
			constructor(claim, key) {
				super(key);
				this.__claim = claim;
			}
			/** Serialize to the JSON node form (the token text alone). */
			exportJSON() {
				return {
					...super.exportJSON(),
					type: "command-chip",
					version: 1,
					text: this.getTextContent()
				};
			}
			/**
			* Mount the chip's host element; the decorator portal renders into it.
			* @returns an inline, non-editable span carrying the test/e2e anchor.
			*/
			createDOM() {
				const el = document.createElement("span");
				el.setAttribute("data-composer-command", this.__claim.name);
				el.setAttribute("contenteditable", "false");
				return el;
			}
			/** Host element never changes shape. */
			updateDOM() {
				return false;
			}
			/** The chip sits in the text line. */
			isInline() {
				return true;
			}
			/**
			* Arrows step across the chip and the default character deletion removes
			* it whole, for the reason documented on ReferenceChipNode.isKeyboardSelectable;
			* registerCommandChipSelection inserts the selecting step before that deletion.
			*/
			isKeyboardSelectable() {
				return false;
			}
			/** Clipboard / persistence projection: the token without its separator. */
			getTextContent() {
				return this.__claim.token.trimEnd();
			}
			/** The claim this chip anchors. */
			getClaim() {
				return this.getLatest().__claim;
			}
			/** React face rendered into the host element by the decorator portal. */
			decorate() {
				return (0, react_jsx_runtime.jsx)(CommandChip, { token: this.getTextContent() });
			}
		};
		/**
		* Mint one chip node for a claim.
		* @param claim - the command claim.
		* @returns the fresh node.
		*/
		function $createCommandChipNode(claim) {
			return new CommandChipNode(claim);
		}
		/**
		* Command chip type guard.
		* @param node - any node or nullish.
		* @returns whether the node is a CommandChipNode.
		*/
		function $isCommandChipNode(node) {
			return node instanceof CommandChipNode;
		}
		/** Replace a displaced chip with its literal token. */
		function $releaseChip(chip) {
			chip.replace(Go(chip.getTextContent()));
		}
		/**
		* Keep command chips on the leading seat. A chip anywhere but the first
		* child of the first block (text, a line break, or a block inserted before
		* it) becomes its literal token, which releases the claim. Inserting a
		* sibling before the chip or moving it to another block marks the chip dirty;
		* a block inserted before the chip's block marks only that block dirty.
		* @param editor - the shell-owned editor.
		* @returns the unregister disposer.
		*/
		function registerCommandChipSeat(editor) {
			return Eu(editor.registerNodeTransform(CommandChipNode, (chip) => {
				if (chip.getPreviousSibling() !== null || chip.getParentOrThrow().getPreviousSibling() !== null) $releaseChip(chip);
			}), editor.registerNodeTransform(Zi, (block) => {
				const first = block.getFirstChild();
				if ($isCommandChipNode(first) && block.getPreviousSibling() !== null) $releaseChip(first);
			}));
		}
		//#endregion
		//#region lib/types/client/input/editor/command-chip-selection.js
		/**
		* Keys that never clear a selected chip by themselves: bare modifiers, and
		* IME or virtual-keyboard keys whose deletion arrives later as an input event.
		*/
		const PASSIVE_KEYS = new Set([
			"Shift",
			"Control",
			"Alt",
			"Meta",
			"Unidentified",
			"Process"
		]);
		/** The chip a collapsed caret deletes next in one direction, or null. */
		function $commandChipBesideCaret(isBackward) {
			const selection = Kr();
			if (!ur(selection) || !selection.isCollapsed()) return null;
			const node = kl(selection.focus, isBackward);
			return $isCommandChipNode(node) ? node : null;
		}
		/** Deletion direction of an input event type; null for other input. */
		function deletionDirection(inputType) {
			if (inputType === "deleteContentBackward") return true;
			if (inputType === "deleteContentForward") return false;
			return null;
		}
		/**
		* Register two-step deletion for the command chip.
		* @param editor - the shell-owned editor.
		* @returns the unregister disposer, which also clears a selected chip.
		*/
		function registerCommandChipSelection(editor) {
			let selected = null;
			/** A keydown with a selected chip whose dispatch has produced no character deletion yet. */
			let keyWithoutDeletion = false;
			const paint = (next) => {
				if (selected !== null && selected.key !== next?.key) editor.getElementByKey(selected.key)?.removeAttribute("data-selected");
				selected = next;
				if (next !== null) editor.getElementByKey(next.key)?.setAttribute("data-selected", "");
				editor.getRootElement()?.toggleAttribute("data-composer-chip-selected", next !== null);
			};
			const clear = () => {
				if (selected !== null) paint(null);
				return false;
			};
			/**
			* Decide one character deletion.
			* @param isBackward - deletion direction.
			* @param clearOnPass - whether letting the deletion run clears the selection here;
			* an input event leaves it for the deletion that follows.
			* @returns true when the deletion only selected the chip and must be consumed.
			*/
			const $decide = (isBackward, clearOnPass) => {
				keyWithoutDeletion = false;
				const chip = $commandChipBesideCaret(isBackward);
				if (chip === null) return clear();
				if (selected?.key === chip.getKey() && selected.isBackward === isBackward) return clearOnPass ? clear() : false;
				paint({
					key: chip.getKey(),
					isBackward
				});
				return true;
			};
			return Eu(editor.registerCommand(ze$2, (event) => {
				const isBackward = deletionDirection(event.inputType);
				if (isBackward === null || !$decide(isBackward, false)) return false;
				event.preventDefault();
				return true;
			}, 3), editor.registerCommand($e$2, (isBackward) => $decide(isBackward, true), 3), editor.registerCommand(tn$2, (event) => {
				if (selected === null || PASSIVE_KEYS.has(event.key)) return false;
				keyWithoutDeletion = true;
				queueMicrotask(() => {
					if (!keyWithoutDeletion) return;
					keyWithoutDeletion = false;
					clear();
				});
				return false;
			}, 4), editor.registerCommand(Ke$2, clear, 4), editor.registerCommand(Mn$1, clear, 4), editor.registerUpdateListener(({ editorState }) => {
				const current = selected;
				if (current === null) return;
				paint(editorState.read(() => $commandChipBesideCaret(current.isBackward)?.getKey() === current.key) ? current : null);
			}), () => {
				paint(null);
			});
		}
		/**
		* Walk the composer document once, producing every projection segment in
		* document order. Blocks (paragraphs) contribute a one-newline gap between
		* one another in both text projections.
		* @returns the layout for this EditorState.
		*/
		function $composerLayout() {
			const segments = [];
			const byKey = /* @__PURE__ */ new Map();
			const children = /* @__PURE__ */ new Map();
			const bounds = /* @__PURE__ */ new Map();
			let detect = "";
			let clipboard = "";
			const pushLeaf = (kind, node, detectPiece, clipboardPiece) => {
				const segment = {
					kind,
					node,
					detectStart: detect.length,
					detectLength: detectPiece.length,
					clipboardStart: clipboard.length,
					clipboardLength: clipboardPiece.length
				};
				segments.push(segment);
				byKey.set(node.getKey(), segment);
				detect += detectPiece;
				clipboard += clipboardPiece;
			};
			const walkElement = (element) => {
				const start = detect.length;
				const kids = element.getChildren();
				children.set(element.getKey(), kids.map((kid) => kid.getKey()));
				for (const kid of kids) if ($isReferenceChipNode(kid) || $isCommandChipNode(kid)) pushLeaf("chip", kid, "￼", kid.getTextContent());
				else if (Xo(kid)) {
					const text = kid.getTextContent();
					pushLeaf("text", kid, text, text);
				} else if (Yi(kid)) pushLeaf("linebreak", kid, "\n", "\n");
				else if (Pi(kid))
 /* v8 ignore next 4 -- plain-text composition nests no block elements today; the walk stays total for imported states. */
				walkElement(kid);
				bounds.set(element.getKey(), {
					start,
					end: detect.length
				});
			};
			const root = nl();
			const blocks = root.getChildren();
			children.set(root.getKey(), blocks.map((block) => block.getKey()));
			const rootStart = detect.length;
			blocks.forEach((block, index) => {
				const previous = blocks[index - 1];
				if (index > 0 && previous !== void 0) {
					segments.push({
						kind: "gap",
						node: null,
						detectStart: detect.length,
						detectLength: 1,
						clipboardStart: clipboard.length,
						clipboardLength: 1,
						gapBetween: {
							before: previous.getKey(),
							after: block.getKey()
						}
					});
					detect += "\n";
					clipboard += "\n";
				}
				if (Pi(block)) walkElement(block);
			});
			bounds.set(root.getKey(), {
				start: rootStart,
				end: detect.length
			});
			return {
				segments,
				detectLength: detect.length,
				detectText: detect,
				clipboardText: clipboard,
				byKey,
				children,
				bounds
			};
		}
		/**
		* Fold one clipboard-projection offset to its detect-projection twin.
		* Offsets inside a chip's clipboard expansion snap to the chip's trailing
		* edge; callers only pass boundaries that were once a document end (submit
		* snapshots), which never split a chip.
		* @param layout - the current walk product.
		* @param clipboardOffset - offset into the clipboard projection.
		* @returns the detect offset covering the same document position.
		*/
		function detectOffsetOfClipboardOffset(layout, clipboardOffset) {
			for (const segment of layout.segments) {
				const end = segment.clipboardStart + segment.clipboardLength;
				if (clipboardOffset > end) continue;
				if (clipboardOffset === end) return segment.detectStart + segment.detectLength;
				if (segment.kind === "chip") return segment.detectStart + segment.detectLength;
				return segment.detectStart + (clipboardOffset - segment.clipboardStart);
			}
			return layout.detectLength;
		}
		/**
		* Fold one selection point to a detect offset.
		* @param layout - the current walk product.
		* @param point - selection anchor/focus point.
		* @returns detect offset, or null when the point references an unknown node.
		*/
		function $detectOffsetOfPoint(layout, point) {
			if (point.type === "text") {
				const segment = layout.byKey.get(point.key);
				return segment === void 0 ? null : segment.detectStart + Math.min(point.offset, segment.detectLength);
			}
			const kids = layout.children.get(point.key);
			const elementBounds = layout.bounds.get(point.key);
			if (kids === void 0 || elementBounds === void 0) return null;
			if (point.offset >= kids.length) return elementBounds.end;
			const childKey = kids[point.offset];
			if (childKey === void 0) return elementBounds.end;
			const childSegment = layout.byKey.get(childKey);
			if (childSegment !== void 0) return childSegment.detectStart;
			const childBounds = layout.bounds.get(childKey);
			return childBounds === void 0 ? null : childBounds.start;
		}
		/**
export {};
