/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				t(51);
			}
			getTextContent() {
				const t = this.__cachedText;
				return null === t || !ui() && 0 !== _i()._dirtyType ? super.getTextContent() : t;
			}
			remove() {
				t(52);
			}
			replace(e) {
				t(53);
			}
			insertBefore(e) {
				t(54);
			}
			insertAfter(e) {
				t(55);
			}
			updateDOM(t, e) {
				return !1;
			}
			splice(e, n, o) {
				for (const e of o) Pi(e) || Ki(e) || t(282);
				return super.splice(e, n, o);
			}
			static importJSON(t) {
				return nl().updateFromJSON(t);
			}
			collapseAtStart() {
				return !0;
			}
		};
		function Bi(t) {
			return t instanceof zi;
		}
		function Ri(t) {
			return new Hi(nt$2(t._nodeMap), null, t._slotsUsed);
		}
		function Wi() {
			return new Hi(new Map([["root", new zi()]]), null, !1);
		}
		function $i(e) {
			const n = e.exportJSON(), o = e.constructor;
			if (n.type !== o.getType() && t(130, o.name), Pi(e)) {
				const r = n.children;
				Array.isArray(r) || t(59, o.name);
				const i = e.getChildren();
				for (let t = 0; t < i.length; t++) {
					const e = $i(i[t]);
					r.push(e);
				}
			}
			const r = ia(e);
			if (r.length > 0) {
				const i = {};
				for (const n of r) {
					const r = sa(e, n);
					null === r && t(366, o.name, n), i[n] = $i(r);
				}
				n.$slots = i;
			}
			return n;
		}
		function Ui(t) {
			return t instanceof Hi;
		}
		var Hi = class Hi {
			_nodeMap;
			_selection;
			_flushSync;
			_readOnly;
			_parsed;
			_slotsUsed;
			constructor(t, e = null, n = !1) {
				this._nodeMap = t, this._selection = e || null, this._flushSync = !1, this._readOnly = !1, this._parsed = !1, this._slotsUsed = n;
			}
			isEmpty() {
				return 1 === this._nodeMap.size && null === this._selection;
			}
			read(t, e) {
				return ki(e && e.editor || null, this, t);
			}
			clone(t) {
				const e = new Hi(this._nodeMap, void 0 === t ? this._selection : t, this._slotsUsed);
				return e._readOnly = !0, e;
			}
			toJSON() {
				return ki(null, this, () => ({ root: $i(nl()) }));
			}
		};
		var ji = class extends Fi {
			$config() {
				return this.config("artificial", { extends: Fi });
			}
			createDOM(t) {
				return Zl().createElement("div");
			}
		};
		var Ji = class extends _o {
			$config() {
				return this.config("linebreak", { importDOM: { br: (t) => Gi(t) || Xi(t) ? null : {
					conversion: Vi,
					priority: 0
				} } });
			}
			getTextContent() {
				return "\n";
			}
			createDOM() {
				return Zl().createElement("br");
			}
			updateDOM() {
				return !1;
			}
			isInline() {
				return !0;
			}
		};
		function Vi(t) {
			return { node: qi() };
		}
		function qi() {
			return Wl(new Ji());
		}
		function Yi(t) {
			return t instanceof Ji;
		}
		function Gi(t) {
			const e = t.parentElement;
			if (null !== e && Cc(e)) {
				const n = e.firstChild;
				if (n === t || n.nextSibling === t && Qi(n)) {
					const n = e.lastChild;
					if (n === t || n.previousSibling === t && Qi(n)) return !0;
				}
			}
			return !1;
		}
		function Xi(t) {
			const e = t.parentElement;
			if (null !== e && Cc(e)) {
				const n = e.firstChild;
				if (n === t || n.nextSibling === t && Qi(n)) return !1;
				const o = e.lastChild;
				if (o === t || o.previousSibling === t && Qi(o)) return !0;
			}
			return !1;
		}
		function Qi(t) {
			return zs(t) && /^( |\t|\r?\n)+$/.test(t.textContent || "");
		}
		var Zi = class extends Fi {
			$config() {
				return this.config("paragraph", {
					extends: Fi,
					importDOM: { p: () => ({
						conversion: ts,
						priority: 0
					}) }
				});
			}
			createDOM(t) {
				const e = Zl().createElement("p"), n = Cl(t.theme, "paragraph");
				if (void 0 !== n) e.classList.add(...n);
				return e;
			}
			updateDOM(t, e, n) {
				return !1;
			}
			exportDOM(t) {
				const { element: e } = super.exportDOM(t);
				if (gc(e)) {
					this.isEmpty() && e.append(Zl().createElement("br"));
					const t = this.getFormatType();
					t && (e.style.textAlign = t);
				}
				return { element: e };
			}
			exportJSON() {
				const t = super.exportJSON();
				if (void 0 === t.textFormat || void 0 === t.textStyle) {
					const e = this.getChildren().find(Xo);
					e ? (t.textFormat = e.getFormat(), t.textStyle = e.getStyle()) : (t.textFormat = this.getTextFormat(), t.textStyle = this.getTextStyle());
				}
				return t;
			}
			insertNewAfter(t, e) {
				const n = es();
				n.setTextFormat(t.format), n.setTextStyle(t.style);
				const o = this.getDirection();
				return n.setDirection(o), n.setFormat(this.getFormatType()), n.setStyle(this.getStyle()), this.insertAfter(n, e), n;
			}
			collapseAtStart() {
				const t = this.getChildren();
				if (0 === t.length || Xo(t[0]) && "" === t[0].getTextContent().trim()) {
					if (null !== this.getNextSibling()) return this.selectNext(), this.remove(), !0;
					if (null !== this.getPreviousSibling()) return this.selectPrevious(), this.remove(), !0;
				}
				return !1;
			}
		};
		function ts(t) {
			const e = es();
			if (Lc(e, t), Pc(t, e), "" === e.getFormatType()) {
				const n = t.getAttribute("align");
				n && n && n in R$1 && e.setFormat(n);
			}
			return Ic(e, t), { node: e };
		}
		function es() {
			return Wl(new Zi());
		}
		function ns(t) {
			return t instanceof Zi;
		}
		function os(t) {
			console.warn(t);
		}
		function gs(t, e, n, o, r) {
			const i = t._keyToDOMMap;
			i.clear(), t._editorState = Wi(), t._pendingEditorState = o, t._compositionKey = null, t._dirtyType = 0, t._cloneNotNeeded.clear(), t._dirtyLeaves = /* @__PURE__ */ new Set(), t._dirtyElements.clear(), t._normalizedNodes = /* @__PURE__ */ new Set(), r && r.preserveUpdateQueue || (t._updateTags = /* @__PURE__ */ new Set(), t._updates = [], t._cascadeCount = 0), t._blockCursorElement = null, null !== t._inputState.handledSelectionCommandTimeoutId && clearTimeout(t._inputState.handledSelectionCommandTimeoutId), t._inputState = {
				collapsedSelectionFormat: {
					format: 0,
					key: "root",
					offset: 0,
					style: "",
					timeStamp: 0
				},
				compositionEndData: "",
				compositionPhase: "idle",
				hadOrphanedCompositionEvents: !1,
				handledSelectionCommandTimeoutId: null,
				isInsertLineBreak: !1,
				isInsertTextAfterHandledSelectionCommand: !1,
				isSelectionChangeFromDOMUpdate: !1,
				isSelectionChangeFromMouseDown: !1,
				lastBeforeInputInsertTextTimeStamp: 0,
				lastKeyCode: null,
				lastKeyDownTimeStamp: 0,
				postDeleteSelectionToRestore: null,
				unprocessedBeforeInputData: null
			};
			const s = t._observer;
			null !== s && (s.disconnect(), t._observer = null), null !== e && (e.textContent = "", function(t, e) {
				const n = `__lexicalKey_${e._key}`;
				delete t[n];
			}(e, t)), null !== n && (n.textContent = "", i.set("root", n), Xs(n, t, "root"));
		}
		function _s(t) {
			const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
			for (const { klass: o, ownNodeConfig: r } of jc(t)) {
				const t = o.transform;
				if (!n.has(t)) {
					n.add(t);
					const r = o.transform();
					r && e.add(r);
				}
				if (r) {
					const t = r.$transform;
					t && e.add(t);
				}
			}
			return e;
		}
		const ps = {
			$createDOM: (t, e) => t.createDOM(e._config, e),
			$decorateDOM: (t, e, n, o) => {},
			$exportDOM: (t, e) => {
				const n = Es(e, t.getType());
				return n && void 0 !== n.exportDOM ? n.exportDOM(e, t) : t.exportDOM(e);
			},
			$extractWithChild: (t, e, n, o, r) => Pi(t) && t.extractWithChild(e, n, o),
			$getDOMSlot: (t, e, n) => t.getDOMSlot(e),
			$getSlotTargetElement: (t, e, n, o) => null,
			$shouldExclude: (t, e, n) => Pi(t) && t.excludeFromCopy("html"),
			$shouldInclude: (t, e, n) => !e || t.isSelected(e),
			$updateDOM: (t, e, n, o) => t.updateDOM(e, n, o._config)
		};
		function ys(e) {
			const n = e || {}, o = mi(), r = n.theme || {}, i = void 0 === e ? o : n.parentEditor || null, s = n.disableEvents || !1, l = Wi(), c = n.namespace || (null !== i ? i._config.namespace : cl()), a = n.editorState, u = [
				zi,
				Wo,
				Ji,
				Zo,
				Zi,
				ji,
				...n.nodes || []
			], { onError: f, onWarn: d, html: h } = n, g = void 0 === n.editable || n.editable;
			let _;
			if (void 0 === e && null !== o) _ = o._nodes;
			else {
				_ = /* @__PURE__ */ new Map();
				for (let e = 0; e < u.length; e++) {
					let o = u[e], r = null, i = null;
					if (o && "object" == typeof o) {
						const t = o;
						o = t.replace, r = t.with, i = t.withKlass || null;
					}
					if ("function" != typeof o || !o.prototype || !(o === _o || o.prototype instanceof _o)) {
						let r = "<unknown>";
						try {
							r = JSON.parse(Z$1);
						} catch (t) {}
						t(365, String(e - u.length + (n.nodes ? n.nodes.length : 0)), "function" == typeof o ? `${o.name}${"function" == typeof o.getType ? ` (type ${String(o.getType())})` : ""}` : String(o), String(r));
					}
					Hc(o);
					const s = o.getType(), l = _s(o);
					_.set(s, {
						exportDOM: h && h.export ? h.export.get(o) : void 0,
						klass: o,
						replace: r,
						replaceWithKlass: i,
						sharedNodeState: vt$1(u[e]),
						transforms: l
					});
				}
			}
			const p = new Cs(l, i, _, {
				disableEvents: s,
				dom: {
					...ps,
					...e && e.dom
				},
				namespace: c,
				theme: r
			}, f || console.error, d || os, function(t, e) {
				const n = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), r = (t) => {
					Object.keys(t).forEach((e) => {
						let o = n.get(e);
						void 0 === o && (o = [], n.set(e, o)), o.push(t[e]);
					});
				};
				return t.forEach((t) => {
					const e = t.klass.importDOM;
					if (null == e || o.has(e)) return;
					o.add(e);
					const n = e.call(t.klass);
					null !== n && r(n);
				}), e && r(e), n;
			}(_, h ? h.import : void 0), g, e);
			return void 0 !== a && (p._pendingEditorState = a, p._dirtyType = 2), function(t) {
				t.registerCommand(ze$2, Yn, 0), t.registerCommand(Be$2, Gn, 0), t.registerCommand(Re, Xn, 0), t.registerCommand(We$2, Qn, 0), t.registerCommand(tn$2, eo, 0);
			}(p), p;
		}
		function ms(t, e) {
			const n = t.get(e);
			t.delete(e), n && n();
		}
		function xs(t, e, n) {
			return t.set(e, n), ms.bind(null, t, e);
		}
		var Cs = class {
			static version;
			_headless;
			_parentEditor;
			_rootElement;
			_editorState;
			_pendingEditorState;
			_compositionKey;
			_deferred;
			_keyToDOMMap;
			_updates;
			_updating;
			_cascadeCount;
			_listeners;
			_commands;
			_nodes;
			_decorators;
			_pendingDecorators;
			_config;
			_dirtyType;
			_cloneNotNeeded;
			_dirtyLeaves;
			_dirtyElements;
			_normalizedNodes;
			_updateTags;
			_observer;
			_key;
			_onError;
			_onWarn;
			_htmlConversions;
			_window;
			_editable;
			_blockCursorElement;
			_slotsUsed;
			_inputState;
			_createEditorArgs;
			constructor(t, e, n, o, r, i, s, l, c) {
				this._createEditorArgs = c, this._parentEditor = e, this._rootElement = null, this._editorState = t, this._pendingEditorState = null, this._compositionKey = null, this._deferred = [], this._keyToDOMMap = new ot$1(), this._updates = [], this._updating = !1, this._cascadeCount = 0, this._listeners = {
					decorator: /* @__PURE__ */ new Map(),
					editable: /* @__PURE__ */ new Map(),
					mutation: /* @__PURE__ */ new Map(),
					root: /* @__PURE__ */ new Map(),
					textcontent: /* @__PURE__ */ new Map(),
					update: /* @__PURE__ */ new Map()
				}, this._commands = /* @__PURE__ */ new Map(), this._config = o, this._nodes = n, this._decorators = {}, this._pendingDecorators = null, this._dirtyType = 0, this._cloneNotNeeded = /* @__PURE__ */ new Set(), this._dirtyLeaves = /* @__PURE__ */ new Set(), this._dirtyElements = /* @__PURE__ */ new Map(), this._normalizedNodes = /* @__PURE__ */ new Set(), this._updateTags = /* @__PURE__ */ new Set(), this._observer = null, this._key = cl(), this._onError = r, this._onWarn = i, this._htmlConversions = s, this._editable = l, this._headless = null !== e && e._headless, this._window = null, this._blockCursorElement = null, this._slotsUsed = !1, this._inputState = {
					collapsedSelectionFormat: {
						format: 0,
						key: "root",
						offset: 0,
export {};
