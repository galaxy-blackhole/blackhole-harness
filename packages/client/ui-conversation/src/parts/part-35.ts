/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-conversation/src/client/input/editor/composer-editor.module.css.mjs
		const css$7 = ".q44v1G_reference{border-radius:var(--dsw-radius-sm);line-height:inherit;vertical-align:baseline;color:var(--dsw-alias-state-business-primary);-webkit-box-decoration-break:clone;box-decoration-break:clone;background:0 0;padding:0 4px}.q44v1G_reference:hover{background:var(--dsw-alias-state-business-tertiary)}.q44v1G_openable{cursor:pointer}[data-composer-command][data-selected]>.q44v1G_reference{background:var(--dsw-alias-state-business-tertiary)}.q44v1G_textRef{max-width:100%;display:inline-block}";
		const tagId$7 = "@deepseek-ai/dsh-client-ui-conversation/composer-editor.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$7) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$7;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		var composer_editor_module_css_default = {
			"openable": "q44v1G_openable",
			"reference": "q44v1G_reference",
			"textRef": "q44v1G_textRef"
		};
		//#endregion
		//#region lib/types/client/input/editor/ReferenceChip.js
		/**
		* Visual body of one inline reference chip: the DecoratorNode's React
		* face. Pure display — identity, invalidation, and lifecycle live on the
		* ReferenceChipNode; this component renders whatever the node carries.
		*/
		/**
		* Render one inline reference chip.
		* @param props - label, optional domain glyph, and the invalid bit.
		* @returns the chip body (icon + truncating label).
		*/
		function ReferenceChip({ label, appearance, invalid }) {
			return (0, react_jsx_runtime.jsxs)("span", {
				className: clsx(composer_editor_module_css_default.reference, ReferenceChip_module_css_default.chip, appearance === "file" && !invalid && composer_editor_module_css_default.openable, invalid && ReferenceChip_module_css_default.invalid),
				title: label,
				children: [appearance === void 0 ? (0, react_jsx_runtime.jsx)("span", {
					className: ReferenceChip_module_css_default.marker,
					"aria-hidden": true,
					children: "@"
				}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ReferenceIconRegular, {
					kind: appearance,
					size: 14,
					className: ReferenceChip_module_css_default.icon
				}), (0, react_jsx_runtime.jsx)("span", {
					className: ReferenceChip_module_css_default.label,
					children: label
				})]
			});
		}
		//#endregion
		//#region lib/types/client/input/editor/chip-node.js
		/** One inline reference occurrence as an atomic decorator node. */
		var ReferenceChipNode = class ReferenceChipNode extends Li {
			/** Owning source name (serializer routing key). */
			__source;
			/** Owner-scoped reference id. */
			__ref;
			/** Inline display label (insert-time cache). */
			__label;
			/** Optional domain glyph (insert-time cache). */
			__appearance;
			/** Clipboard / persistence projection, e.g. `/name` (never the model form). */
			__clipboardText;
			/** Owner-resolution failure flag: chip renders invalid; serialization must fail. */
			__invalid;
			/** Lexical node registry type tag. */
			static getType() {
				return "reference-chip";
			}
			/**
			* Clone with identity (Lexical writable-copy contract).
			* @param node - node to clone.
			* @returns a copy carrying the same NodeKey.
			*/
			static clone(node) {
				return new ReferenceChipNode({
					source: node.__source,
					ref: node.__ref,
					label: node.__label,
					appearance: node.__appearance,
					clipboardText: node.__clipboardText
				}, node.__invalid, node.__key);
			}
			/**
			* Rebuild one chip from its JSON form.
			* @param json - serialized chip.
			* @returns a fresh node (new key).
			*/
			static importJSON(json) {
				return new ReferenceChipNode({
					source: json.source,
					ref: json.ref,
					label: json.label,
					appearance: json.appearance,
					clipboardText: json.clipboardText
				}, json.invalid);
			}
			/**
			* @param insert - the owner's reference insertion (display projections included).
			* @param invalid - owner-resolution failure bit (defaults valid).
			* @param key - Lexical clone-path key; absent for fresh nodes.
			*/
			constructor(insert, invalid = false, key) {
				super(key);
				this.__source = insert.source;
				this.__ref = insert.ref;
				this.__label = insert.label;
				this.__appearance = insert.appearance;
				this.__clipboardText = insert.clipboardText;
				this.__invalid = invalid;
			}
			/** Serialize to the JSON node form. */
			exportJSON() {
				return {
					...super.exportJSON(),
					type: "reference-chip",
					version: 1,
					source: this.__source,
					ref: this.__ref,
					label: this.__label,
					...this.__appearance === void 0 ? {} : { appearance: this.__appearance },
					clipboardText: this.__clipboardText,
					invalid: this.__invalid
				};
			}
			/**
			* Mount the chip's host element; the decorator portal renders into it.
			* @returns an inline, non-editable span carrying the test/e2e anchor.
			*/
			createDOM(_config) {
				const el = document.createElement("span");
				el.setAttribute("data-composer-chip", this.__source);
				el.setAttribute("contenteditable", "false");
				return el;
			}
			/** Host element never changes shape. */
			updateDOM() {
				return false;
			}
			/** Chips sit in the text line. */
			isInline() {
				return true;
			}
			/**
			* No keyboard-selected intermediate state: arrows step across the chip in
			* one move and Backspace/Delete remove it whole (the placeholder semantics
			* of the old textarea). `true` would put a NodeSelection between the
			* keystroke and the caret — a state the plain-text binding's handlers all
			* ignore, deadlocking arrows, typing, and deletion at the chip edge.
			*/
			isKeyboardSelectable() {
				return false;
			}
			/** Clipboard / persistence projection (native copy reads this). */
			getTextContent() {
				return this.__clipboardText;
			}
			/**
			* Flip the owner-resolution failure bit.
			* @param invalid - next bit; no-op writes are the caller's concern.
			*/
			setInvalid(invalid) {
				const writable = this.getWritable();
				writable.__invalid = invalid;
			}
			/** Owner-resolution failure bit. */
			isInvalid() {
				return this.getLatest().__invalid;
			}
			/** Owning source name. */
			getSource() {
				return this.getLatest().__source;
			}
			/** Owner-scoped reference id. */
			getReference() {
				return this.getLatest().__ref;
			}
			/** Inline display label. */
			getLabel() {
				return this.getLatest().__label;
			}
			/** Optional domain glyph. */
			getAppearance() {
				return this.getLatest().__appearance;
			}
			/** React face rendered into the host element by the decorator portal. */
			decorate() {
				return (0, react_jsx_runtime.jsx)(ReferenceChip, {
					label: this.__label,
					appearance: this.__appearance,
					invalid: this.__invalid
				});
			}
		};
		/**
		* Mint one chip node from a reference insertion.
		* @param insert - the owner's reference insertion.
		* @returns the fresh node.
		*/
		function $createReferenceChipNode(insert) {
			return new ReferenceChipNode(insert);
		}
		/**
		* Chip type guard.
		* @param node - any node or nullish.
		* @returns whether the node is a ReferenceChipNode.
		*/
		function $isReferenceChipNode(node) {
			return node instanceof ReferenceChipNode;
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/@lexical+text@0.49.0_typescript@6.0.3/node_modules/@lexical/text/dist/LexicalText.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		function d(t, ...e) {
			const n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
			r.append("code", t);
			for (const t of e) r.append("v", t);
			throw n.search = r.toString(), Error(`Minified Lexical error #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		function x(t, e, n, r) {
			const s = (t) => t instanceof n, f = (t) => {
				const e = Go(t.getTextContent());
				e.setFormat(t.getFormat()), t.replace(e);
			};
			return [t.registerNodeTransform(Wo, (t) => {
				if (!t.isSimpleText()) return;
				let n, o = t.getPreviousSibling(), l = t.getTextContent(), u = t;
				if (Xo(o)) {
					const n = o.getTextContent(), r = e(n + l);
					if (s(o)) {
						if (null === r || 0 !== ((t) => t.getLatest().__mode)(o)) return void f(o);
						{
							const e = r.end - n.length;
							if (e > 0) {
								const r = n + l.slice(0, e);
								if (o.select(), o.setTextContent(r), e === l.length) t.remove();
								else {
									const n = l.slice(e);
									t.setTextContent(n);
								}
								return;
							}
						}
					} else if (null === r || r.start < n.length) return;
				}
				let c = 0;
				for (;;) {
					n = e(l);
					let t, g = null === n ? "" : l.slice(n.end);
					if (l = g, "" === g) {
						const t = u.getNextSibling();
						if (Xo(t)) {
							g = u.getTextContent() + t.getTextContent();
							const n = e(g);
							if (null === n) return void (s(t) ? f(t) : t.markDirty());
							if (0 !== n.start) return;
						}
					}
					if (null === n) return;
					if (0 === n.start && Xo(o) && o.isTextEntity()) {
						c += n.end;
						continue;
					}
					0 === n.start ? [t, u] = u.splitText(n.end) : [, t, u] = u.splitText(n.start + c, n.end + c), void 0 === t && d(165, "nodeToReplace");
					const a = r(t);
					if (a.setFormat(t.getFormat()), t.replace(a), null == u) return;
					c = 0, o = a;
				}
			}), t.registerNodeTransform(n, (t) => {
				const n = t.getTextContent(), r = e(n);
				if (null === r || 0 !== r.start) return void f(t);
				if (n.length > r.end) return void t.splitText(r.end);
				const o = t.getPreviousSibling();
				Xo(o) && o.isTextEntity() && (f(o), f(t));
				const l = t.getNextSibling();
				Xo(l) && l.isTextEntity() && (f(l), s(t) && f(t));
			})];
		}
		//#endregion
		//#region lib/types/client/input/decorations.js
		/**
		* Plain-text reference scan (the plain-text-reference decision;
		* see .agents/notes/archived/architecture/2026-07-25-web-input-machine-and-slash-pipeline.md):
		* a `/name` or `@name` token whose name is on the trigger's lexicon, and
		* syntax-recognizable `@dir/` folder tokens. Pure derivation — the editor's
		* text-ref entity transform consumes these ranges; editing the text out of
		* match shape simply drops the range next scan.
		*/
		/** Token matcher: a trigger char at line start or after whitespace, then a word-ish name (never crosses \n). */
		const TEXT_REF_RE = /(^|\s)([/@])([\w-]+)/g;
		const FOLDER_REF_RE = /(^|\s)(@(?:"[^"\n]*\/|[^\s"]+\/))/g;
		/**
		* What may follow a `/name` token: whitespace or the draft end, the boundary
		* the host skill gesture (`dsh-tool-skill`) requires, so `/nfs-hg/xxx`,
		* `/plan.md`, and `/plan。` are prose, never a reference.
		*/
		const SLASH_TOKEN_END_RE = /^(?:\s|$)/;
		/**
		* Scan the draft for plain-text reference tokens against the hot lexicons.
		* Word-boundary discipline: the trigger must sit at the draft
		* start or after whitespace ('x/name' never matches); the name must be an
		* exact lexicon member; a `/name` token must end at whitespace or the draft
		* end ('/name/x' is a path, '/name。' is prose).
		* @param draft - draft text.
		* @param lexicon - per-trigger name lists; missing catalogs match no named tokens.
		* @returns matched ranges in draft order.
		*/
		function scanTextRefs(draft, lexicon) {
			if (draft === "") return [];
			const out = [];
			TEXT_REF_RE.lastIndex = 0;
			let m;
			while ((m = TEXT_REF_RE.exec(draft)) !== null) {
				const trigger = m[2];
				const name = m[3] ?? "";
				if (trigger === "/" && !SLASH_TOKEN_END_RE.test(draft.slice(m.index + m[0].length))) continue;
				if (lexicon.get(trigger)?.includes(name)) {
					const start = m.index + (m[1]?.length ?? 0);
					out.push({
						start,
						end: start + 1 + name.length,
						trigger
					});
				}
			}
			FOLDER_REF_RE.lastIndex = 0;
			let folder;
			while ((folder = FOLDER_REF_RE.exec(draft)) !== null) {
				const token = folder[2] ?? "";
				const start = folder.index + (folder[1]?.length ?? 0);
				const end = start + token.length;
				if (!out.some((range) => range.start < end && range.end > start)) out.push({
					start,
					end,
					trigger: "@"
				});
			}
			return out.sort((left, right) => left.start - right.start);
		}
		//#endregion
		//#region lib/types/client/input/editor/text-ref.js
		/** Editable reference tokens share chip hover styling while retaining ordinary text semantics. */
		/** One matched plain-text reference as a styled, fully editable text node. */
		var TextRefNode = class TextRefNode extends Wo {
			/** Lexical node registry type tag. */
			static getType() {
				return "composer-text-ref";
			}
			/**
			* Clone with identity (Lexical writable-copy contract).
			* @param node - node to clone.
			* @returns a copy carrying the same NodeKey.
			*/
			static clone(node) {
				return new TextRefNode(node.__text, node.__key);
			}
			/**
			* Rebuild one text-ref from its JSON form.
			* @param json - serialized node.
			* @returns a fresh node.
			*/
			static importJSON(json) {
				const node = new TextRefNode(json.text);
				node.setFormat(json.format);
				node.setDetail(json.detail);
				node.setMode(json.mode);
				node.setStyle(json.style);
				return node;
			}
			/** Serialize to the JSON node form. */
			exportJSON() {
				return {
					...super.exportJSON(),
					type: "composer-text-ref"
				};
			}
			/** Style the span the base TextNode mounts. */
			createDOM(config) {
				const el = super.createDOM(config);
				el.className = clsx(el.className, composer_editor_module_css_default.reference, composer_editor_module_css_default.textRef, this.getTextContent().startsWith("/") && composer_editor_module_css_default.openable);
				el.setAttribute("spellcheck", "false");
				el.setAttribute("data-composer-text-ref", "");
				return el;
			}
			/** Entity nodes never merge with plain siblings (the transform owns their bounds). */
			isTextEntity() {
				return true;
			}
			/** Editing continues inside; the transform re-evaluates match shape per edit. */
			canInsertTextBefore() {
				return true;
			}
		};
		/**
		* Register the plain-text reference entity transform.
		* @param editor - the shell-owned editor.
		* @param lexiconOf - live per-trigger name-roll accessor (the controller's aggregated store).
export {};
