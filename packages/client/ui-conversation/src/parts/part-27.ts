/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
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
			}
			isComposing() {
				return null != this._compositionKey;
			}
			registerUpdateListener(t) {
				return xs(this._listeners.update, t);
			}
			registerEditableListener(t) {
				return xs(this._listeners.editable, t);
			}
			registerDecoratorListener(t) {
				return xs(this._listeners.decorator, t);
			}
			registerTextContentListener(t) {
				return xs(this._listeners.textcontent, t);
			}
			registerRootListener(t) {
				const e = this._listeners.root;
				return Eu(xs(e, t, t(this._rootElement, null) || void 0), () => function(t, e, n) {
					const o = t.get(e);
					o && o(), t.set(e, e(...n) || void 0);
				}(e, t, [null, this._rootElement]));
			}
			registerCommand(e, n, o) {
				void 0 === o && t(35);
				const r = this._commands;
				r.has(e) || r.set(e, [
					new tt(),
					new tt(),
					new tt(),
					new tt(),
					new tt()
				]);
				const i = r.get(e);
				void 0 === i && t(36, String(e));
				const s = function(t) {
					return 7 & t;
				}(o), l = i[s];
				return s !== o ? l.addFront(n) : l.addBack(n), () => {
					l.delete(n), i.every((t) => 0 === t.size) && r.delete(e);
				};
			}
			registerMutationListener(t, e, n) {
				const o = this.resolveRegisteredNodeAfterReplacements(this.getRegisteredNode(t)).klass, r = this._listeners.mutation;
				let i = r.get(e);
				void 0 === i && (i = /* @__PURE__ */ new Set(), r.set(e, i)), i.add(o);
				const s = n && n.skipInitialization;
				return void 0 !== s && s || this.initializeMutationListener(e, o), () => {
					i.delete(o), 0 === i.size && r.delete(e);
				};
			}
			getRegisteredNode(e) {
				const n = this._nodes.get(e.getType());
				return void 0 === n && t(37, e.name), n;
			}
			resolveRegisteredNodeAfterReplacements(t) {
				for (; t.replaceWithKlass;) t = this.getRegisteredNode(t.replaceWithKlass);
				return t;
			}
			initializeMutationListener(t, e) {
				const n = this._editorState, o = Ac(n).get(e.getType());
				if (!o) return;
				const r = /* @__PURE__ */ new Map();
				for (const t of o.keys()) r.set(t, "created");
				r.size > 0 && t(r, {
					dirtyLeaves: /* @__PURE__ */ new Set(),
					prevEditorState: n,
					updateTags: new Set(["registerMutationListener"])
				});
			}
			registerNodeTransformToKlass(t, e) {
				const n = this.getRegisteredNode(t);
				return n.transforms.add(e), n;
			}
			registerNodeTransform(t, e) {
				const n = this.registerNodeTransformToKlass(t, e), o = [n], r = n.replaceWithKlass;
				if (null != r) {
					const t = this.registerNodeTransformToKlass(r, e);
					o.push(t);
				}
				return function(t, e) {
					const n = Ac(t.getEditorState()), o = [];
					for (const t of e) {
						const e = n.get(t);
						e && o.push(e);
					}
					if (0 === o.length) return;
					t.update(() => {
						for (const t of o) for (const e of t.keys()) {
							const t = Ys(e);
							t && t.markDirty();
						}
					}, null === t._pendingEditorState ? { tag: xo } : void 0);
				}(this, o.map((t) => t.klass.getType())), () => {
					o.forEach((t) => t.transforms.delete(e));
				};
			}
			hasNode(t) {
				return this._nodes.has(t.getType());
			}
			hasNodes(t) {
				return t.every(this.hasNode.bind(this));
			}
			dispatchCommand(t, ...e) {
				return Nl(this, t, ...e);
			}
			getDecorators() {
				return this._decorators;
			}
			getRootElement() {
				return this._rootElement;
			}
			getKey() {
				return this._key;
			}
			setRootElement(t) {
				const e = this._rootElement;
				if (t !== e) {
					const n = Cl(this._config.theme, "root"), o = this._pendingEditorState || this._editorState;
					if (this._rootElement = t, gs(this, e, t, o, { preserveUpdateQueue: !0 }), null !== e && (this._config.disableEvents || co(e), null != n && e.classList.remove(...n)), null !== t) {
						const e = Pl(t), o = t.style;
						o.userSelect = "text", o.whiteSpace = "pre-wrap", o.wordBreak = "break-word", t.setAttribute("data-lexical-editor", "true"), this._window = e, this._dirtyType = 2, gt$1(this), this._updateTags.add(xo), bi(this), this._config.disableEvents || function(t, e) {
							const n = t.ownerDocument;
							Ln.set(t, n);
							let o = Kn.get(n);
							void 0 === o && (o = {
								editors: /* @__PURE__ */ new Set(),
								hasShadowEditor: void 0
							}, Kn.set(n, o)), o.editors.add(e), o.hasShadowEditor = void 0, t.__lexicalEditor = e;
							const r = no(t);
							r.push(zn.register(n));
							for (let n = 0; n < In.length; n++) {
								const [o, i] = In[n], s = "function" == typeof i ? (t) => {
									so(t) || (io(t), (e.isEditable() || "click" === o) && i(t, e));
								} : (t) => {
									if (so(t)) return;
									io(t);
									const n = e.isEditable();
									switch (o) {
										case "cut": return n && Nl(e, Tn, t);
										case "copy": return Nl(e, vn$2, t);
										case "paste": return n && Nl(e, Je$2, t);
										case "dragstart": return n && Nl(e, xn$1, t);
										case "dragover": return n && Nl(e, Cn$1, t);
										case "dragend": return n && Nl(e, Sn$2, t);
										case "focus": return n && Nl(e, On$1, t);
										case "blur": return n && Nl(e, Mn$1, t);
										case "drop": return n && Nl(e, yn$1, t);
									}
								};
								r.push(Fn(t, o, s));
							}
						}(t, this), null != n && t.classList.add(...n);
					} else this._window = null, this._updateTags.add(xo), bi(this);
					Ni("root", this, !1, t, e);
				}
			}
			getElementByKey(t) {
				return this._keyToDOMMap.get(t) || null;
			}
			getEditorState() {
				return this._editorState;
			}
			setEditorState(e, n) {
				e.isEmpty() && t(38);
				let o = e;
				o._readOnly && (o = Ri(e), o._selection = e._selection ? e._selection.clone() : null), ht$2(this);
				const r = this._pendingEditorState, i = void 0 !== n ? n.tag : null;
				null === r || r.isEmpty() || (null != i && this._updateTags.add(i), bi(this)), this._pendingEditorState = o, this._dirtyType = 2, this._dirtyElements.set("root", !1), this._compositionKey = null, this._slotsUsed = this._slotsUsed || e._slotsUsed, Ai(this, () => {
					if (i && this._updateTags.add(i), e._parsed) for (const [t, e] of o._nodeMap.entries()) Pi(e) ? this._dirtyElements.set(t, !0) : this._dirtyLeaves.add(t);
				}, { discrete: !this._updating || void 0 });
			}
			parseEditorState(t, e) {
				return function(t, e, n) {
					const o = Wi(), r = ni, i = ri, s = oi, l = e._dirtyElements, c = e._dirtyLeaves, a = e._cloneNotNeeded, u = e._dirtyType;
					e._dirtyElements = /* @__PURE__ */ new Map(), e._dirtyLeaves = /* @__PURE__ */ new Set(), e._cloneNotNeeded = /* @__PURE__ */ new Set(), e._dirtyType = 0, ni = o, ri = !1, oi = e, vs(null);
					try {
						const r = e._nodes;
						Ti(t.root, r), n && n(), o._readOnly = !0, o._parsed = !0;
					} catch (t) {
						t instanceof Error && e._onError(t);
					} finally {
						e._dirtyElements = l, e._dirtyLeaves = c, e._cloneNotNeeded = a, e._dirtyType = u, ni = r, ri = i, oi = s;
					}
					return o;
				}("string" == typeof t ? JSON.parse(t) : t, this, e);
			}
			read(...t) {
				const [e, n] = 1 === t.length ? ["force-commit", t[0]] : t;
				"force-commit" === e && bi(this);
				return ("pending" === e ? this._pendingEditorState || this._editorState : this.getEditorState()).read(n, { editor: this });
			}
			update(t, e) {
				(function(t, e, n) {
					t._updating ? t._updates.push([e, n]) : Mi(t, e, n);
				})(this, t, e);
			}
			focus(t, e = {}) {
				const n = this._rootElement;
				null !== n && (n.setAttribute("autocapitalize", "off"), Ai(this, () => {
					const o = Kr(), r = nl();
					null !== o ? o.dirty || ol(o.clone()) : 0 !== r.getChildrenSize() && ("rootStart" === e.defaultSelection ? r.selectStart() : r.selectEnd()), Al("focus"), Dl(() => {
						n.removeAttribute("autocapitalize"), t && t();
					});
				}), null === this._pendingEditorState && n.removeAttribute("autocapitalize"));
			}
			blur() {
				const t = this._rootElement;
				null !== t && t.blur();
				const e = Jl(this._window);
				null !== e && e.removeAllRanges();
			}
			isEditable() {
				return this._editable;
			}
			setEditable(t) {
				this._editable !== t && (this._editable = t, Ni("editable", this, !0, t), this._slotsUsed && this.update(() => pi()));
			}
			toJSON() {
				return { editorState: this._editorState.toJSON() };
			}
		};
		Cs.version = Z$1;
		let Ss = null;
		function vs(t) {
			Ss = t;
		}
		const Ts = Symbol("INTERNAL_SKIP_AFTER_CLONE_FROM");
		let ks = 1;
		function Ns(e, n) {
			const o = Es(e, n);
			return void 0 === o && t(30, n), o;
		}
		function Es(t, e) {
			return t._nodes.get(e);
		}
		const ws = "function" == typeof queueMicrotask ? queueMicrotask : (t) => {
			Promise.resolve().then(t);
		};
		function Os(t, e) {
			const n = void 0 !== e ? e : (() => {
				const e = t.getRootNode();
				return Bs(e) || ql(e) ? cc(e) : null;
			})();
			if (!gc(n)) return !1;
			if (n.hasAttribute("data-lexical-slot")) return !1;
			const o = Zs(n), r = n.nodeName;
			return po(o) && ("INPUT" === r || "TEXTAREA" === r || "true" === n.contentEditable && null == Ps(n));
		}
		function As(t, e, n) {
			const o = t.getRootElement();
			if (!o) return !1;
			try {
				if (!e || !o.contains(e) || !o.contains(n)) return !1;
			} catch (t) {
				return !1;
			}
			return Fs(e) === t && t.read("latest", () => !Os(e));
		}
		function Ds(t) {
			return t instanceof Cs;
		}
		function Fs(t) {
			let e = t;
			for (; null != e;) {
				const t = Ps(e);
				if (Ds(t)) return t;
				e = wl(e);
			}
			return null;
		}
		function Ps(t) {
			return t ? t.__lexicalEditor : null;
		}
		function Ls(t) {
			return er(t) || t.isToken();
		}
		function Ks(t) {
			return Ls(t) || t.isSegmented();
		}
		function zs(t) {
			return _c(t) && 3 === t.nodeType;
		}
		function Bs(t) {
			return _c(t) && 9 === t.nodeType;
		}
		function Rs(t) {
			let e = t;
			for (; null != e;) {
				if (zs(e)) return e;
				e = e.firstChild;
			}
			return null;
		}
		function Ws(t, e, n) {
			const o = z$1[e];
			if (null !== n && (t & o) === (n & o)) return t;
			let r = t ^ o;
			return "subscript" === e ? r &= ~z$1.superscript : "superscript" === e ? r &= ~z$1.subscript : "lowercase" === e ? (r &= ~z$1.uppercase, r &= ~z$1.capitalize) : "uppercase" === e ? (r &= ~z$1.lowercase, r &= ~z$1.capitalize) : "capitalize" === e && (r &= ~z$1.lowercase, r &= ~z$1.uppercase), r;
		}
		function Us(t, e) {
			const n = function() {
				const t = Ss;
				return Ss = null, t;
			}();
			if (null != (e = e || n && n.__key)) return void (t.__key = e);
			fi(), di();
			const o = _i(), r = hi(), i = "" + ks++;
			r._nodeMap.set(i, t), Pi(t) ? o._dirtyElements.set(i, !0) : o._dirtyLeaves.add(i), o._cloneNotNeeded.add(i), 0 === o._dirtyType && (o._dirtyType = 1), t.__key = i;
		}
		function Hs(e) {
			null !== ta(e) && t(380, e.__key, String(ta(e)));
			const n = e.getParent();
			if (null !== n) {
				const t = e.getWritable(), o = n.getWritable(), r = e.getPreviousSibling(), i = e.getNextSibling(), s = null !== i ? i.__key : null, l = null !== r ? r.__key : null, c = null !== r ? r.getWritable() : null, a = null !== i ? i.getWritable() : null;
				null === r && (o.__first = s), null === i && (o.__last = l), null !== c && (c.__next = s), null !== a && (a.__prev = l), t.__prev = null, t.__next = null, t.__parent = null, o.__size--;
			}
		}
		function Js(e) {
			di(), ho(e) && t(323, e.__key, e.__type);
			const n = e.getLatest(), o = null !== n.__parent ? n.__parent : Zc(n) ? n.__slotHost : null, r = hi(), i = _i(), s = r._nodeMap, l = i._dirtyElements;
			null !== o && function(t, e, n) {
				let o = t;
				for (; null !== o;) {
					if (n.has(o)) return;
					const t = e.get(o);
					if (void 0 === t) break;
					n.set(o, !1), o = null !== t.__parent ? t.__parent : Zc(t) ? t.__slotHost : null;
				}
			}(o, s, l);
			const c = n.__key;
			0 === i._dirtyType && (i._dirtyType = 1), Pi(e) ? l.set(c, !0) : i._dirtyLeaves.add(c);
		}
		function Vs(t) {
			fi();
			const e = _i(), n = e._compositionKey;
			if (t !== n) {
				if (e._compositionKey = t, null !== n) {
					const t = Ys(n);
					null !== t && t.getWritable();
				}
				if (null !== t) {
					const e = Ys(t);
					null !== e && e.getWritable();
				}
			}
		}
		function qs() {
			if (ui()) return null;
			return _i()._compositionKey;
		}
		function Ys(t, e) {
			const n = (e || hi())._nodeMap.get(t);
			return void 0 === n ? null : n;
		}
		function Gs(t, e) {
			const n = Qs(t, _i());
			return void 0 !== n ? Ys(n, e) : null;
		}
		function Xs(t, e, n) {
			t[`__lexicalKey_${e._key}`] = n;
		}
		function Qs(t, e) {
			return t[`__lexicalKey_${e._key}`];
		}
		function Zs(t, e) {
			let n = t;
			for (; null != n;) {
				const t = Gs(n, e);
				if (null !== t) return t;
				n = wl(n);
			}
			return null;
		}
		function tl(t) {
			const e = t._decorators, n = Object.assign({}, e);
			return t._pendingDecorators = n, n;
		}
		function el(t) {
			return t.read(() => nl().getTextContent());
		}
		function nl() {
			return hi()._nodeMap.get("root");
export {};
