/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					break;
				case "deleteWordForward":
					Nl(r, qe$2, !1);
					break;
				case "deleteHardLineBackward":
				case "deleteSoftLineBackward":
					Nl(r, Ye$1, !0);
					break;
				case "deleteContentForward":
				case "deleteHardLineForward":
				case "deleteSoftLineForward":
					Nl(r, Ye$1, !1);
					break;
				case "formatStrikeThrough":
					Nl(r, Ge$2, "strikethrough");
					break;
				case "formatBold":
					Nl(r, Ge$2, "bold");
					break;
				case "formatItalic":
					Nl(r, Ge$2, "italic");
					break;
				case "formatUnderline":
					Nl(r, Ge$2, "underline");
					break;
				case "historyUndo":
					Nl(r, Qe$2);
					break;
				case "historyRedo": Nl(r, Ze$2);
			}
			return !0;
		}
		function Gn(t) {
			const e = _i(), n = e._inputState, o = Kr(), r = t.data, l = Hn(t);
			let c = !1;
			if (null != r && ur(o)) {
				const a = Jl(Il(e)), u = null !== a ? nc(a, e._rootElement) : null, d = "insertCompositionText" === t.inputType && "ending-firefox" !== n.compositionPhase && !e.isComposing();
				d && (n.hadOrphanedCompositionEvents = !0);
				const h = o.anchor.getNode(), g = "insertCompositionText" === t.inputType && "ending-firefox" !== n.compositionPhase && e.isComposing() && Xo(h) && Ks(h);
				if (!d && !g && Bn(o, l, r, t.timeStamp, !1, u)) {
					if (c = !0, "ending-firefox" === n.compositionPhase) {
						const t = to(e, r);
						if (n.compositionPhase = "idle", t) return Al(wo), rl(), !0;
					}
					const l = o.anchor.getNode();
					if (null === a || null === u) return !0;
					const d = o.isBackward(), h = d ? o.anchor.offset : o.focus.offset, g = d ? o.focus.offset : o.anchor.offset;
					s && !o.isCollapsed() && Xo(l) && null !== u.anchorNode && l.getTextContent().slice(0, h) + r + l.getTextContent().slice(h + g) === al(u.anchorNode) || Nl(e, je$2, r);
					const _ = r.length;
					i && _ > 1 && "insertCompositionText" === t.inputType && !e.isComposing() && (o.anchor.offset -= _, o._cachedNodes = null, o._cachedIsBackward = null), f && e.isComposing() && (n.lastKeyDownTimeStamp = 0, Vs(null));
				}
			}
			if (!c) ul(!1, e, null !== r ? r : void 0), "ending-firefox" === n.compositionPhase && (to(e, r || void 0), Al("composition-end"), n.compositionPhase = "idle");
			return rl(), !0;
		}
		function Xn(t) {
			const e = _i(), n = e._inputState, o = Kr();
			if (ur(o) && !e.isComposing()) {
				n.compositionPhase = "composing", n.hadOrphanedCompositionEvents = !1;
				const r = o.anchor, i = o.anchor.getNode();
				if (Vs(r.key), Al("composition-start"), t.timeStamp < n.lastKeyDownTimeStamp + 30 || "element" === r.type || !o.isCollapsed() || !f && (i.getFormat() !== o.format || Xo(i) && i.getStyle() !== o.style) || Xo(i) && (Ks(i) || 0 === r.offset && !i.canInsertTextBefore() || r.offset === i.getTextContentSize() && !i.canInsertTextAfter())) {
					Nl(e, je$2, F);
					const t = Kr();
					ur(t) && Vs(t.anchor.key);
				}
			}
			return !0;
		}
		function Qn(t) {
			const e = _i();
			return e._inputState.compositionPhase = "idle", to(e, t.data), Al(wo), !0;
		}
		function Zn(t) {
			if (null === t) return;
			const e = Ys(t);
			if (!Xo(e) || "text" === e.getType() || Ks(e) || !e.isAttached()) return;
			const n = Kr(), o = ur(n) && n.anchor.key === t ? n.anchor.offset : null, r = Go(e.getTextContent());
			if (r.setFormat(e.getFormat()), r.setStyle(e.getStyle()), e.replace(r), null !== o) {
				const t = Math.min(o, r.getTextContentSize());
				r.select(t, t);
			}
		}
		function to(t, e) {
			const n = t._compositionKey;
			if (Vs(null), null !== n && null != e) {
				if ("" === e) {
					const e = Ys(n), o = t.getElementByKey(n), r = null !== o && Xo(e) ? wc(e, o, t) : null;
					if (null !== r && null !== r.nodeValue && Xo(e)) {
						const n = Jl(Il(t)), o = n && nc(n, t._rootElement);
						let i = null, s = null;
						null !== o && o.anchorNode === r && (i = o.anchorOffset, s = o.focusOffset), fl(e, r.nodeValue, i, s, !0);
					}
					return Zn(n), !1;
				}
				if ("\n" === e[e.length - 1]) {
					const e = Kr();
					if (ur(e) || dr(e)) {
						if (ur(e)) {
							const t = e.focus;
							e.anchor.set(t.key, t.offset, t.type);
						}
						return Nl(t, cn$1, null), Zn(n), !1;
					}
				}
				const o = Ys(n);
				if (null !== o && Xo(o) && Ks(o)) {
					o.markDirty();
					const t = Kr(), r = o.getTextContentSize(), i = ur(t) && t.anchor.key === n ? t.anchor.offset : r;
					return o.select(i, i).insertText(e), !0;
				}
			}
			return ul(!0, t, e), Zn(n), !1;
		}
		function eo(t) {
			const e = _i(), n = e._inputState;
			if (null == t.key) return !0;
			if ("ending-safari" === n.compositionPhase) {
				const o = ml(t);
				if (o && Ai(e, () => {
					to(e, n.compositionEndData);
				}), n.compositionPhase = "idle", n.compositionEndData = "", o) return !0;
			}
			if (function(t) {
				return _l(t, "ArrowRight", { shiftKey: "any" });
			}(t)) Nl(e, en$3, t);
			else if (function(t) {
				return _l(t, "ArrowRight", {
					...pl,
					shiftKey: "any"
				});
			}(t)) Nl(e, nn$2, t);
			else if (function(t) {
				return _l(t, "ArrowLeft", { shiftKey: "any" });
			}(t)) Nl(e, on$1, t);
			else if (function(t) {
				return _l(t, "ArrowLeft", {
					...pl,
					shiftKey: "any"
				});
			}(t)) Nl(e, rn$1, t);
			else if (function(t) {
				return _l(t, "ArrowUp", {
					altKey: "any",
					shiftKey: "any"
				});
			}(t)) Nl(e, sn$2, t);
			else if (function(t) {
				return _l(t, "ArrowDown", {
					altKey: "any",
					shiftKey: "any"
				});
			}(t)) Nl(e, ln$2, t);
			else if (function(t) {
				return _l(t, "Enter", {
					altKey: "any",
					ctrlKey: "any",
					metaKey: "any",
					shiftKey: !0
				});
			}(t)) n.isInsertLineBreak = !0, Nl(e, cn$1, t);
			else if (function(t) {
				return " " === t.key;
			}(t)) Nl(e, an$1, t);
			else if (function(t) {
				return r$1 && _l(t, "o", { ctrlKey: !0 });
			}(t)) t.preventDefault(), n.isInsertLineBreak = !0, Nl(e, Ue$2, !0);
			else if (function(t) {
				return _l(t, "Enter", {
					altKey: "any",
					ctrlKey: "any",
					metaKey: "any"
				});
			}(t)) n.isInsertLineBreak = !1, Nl(e, cn$1, t);
			else if (function(t) {
				return _l(t, "Backspace", { shiftKey: "any" }) || r$1 && _l(t, "h", { ctrlKey: !0 });
			}(t)) ml(t) ? Nl(e, un$2, t) && Vn(n) : (t.preventDefault(), Nl(e, $e$2, !0));
			else if (function(t) {
				return "Escape" === t.key;
			}(t)) Nl(e, fn$1, t);
			else if (function(t) {
				return _l(t, "Delete", {}) || r$1 && _l(t, "d", { ctrlKey: !0 });
			}(t)) !function(t) {
				return "Delete" === t.key;
			}(t) ? (t.preventDefault(), Nl(e, $e$2, !1)) : Nl(e, dn$1, t);
			else if (function(t) {
				return _l(t, "Backspace", yl);
			}(t)) t.preventDefault(), Nl(e, qe$2, !0);
			else if (function(t) {
				return _l(t, "Delete", yl);
			}(t)) t.preventDefault(), Nl(e, qe$2, !1);
			else if (function(t) {
				return r$1 && _l(t, "Backspace", { metaKey: !0 });
			}(t)) t.preventDefault(), Nl(e, Ye$1, !0);
			else if (function(t) {
				return r$1 && (_l(t, "Delete", { metaKey: !0 }) || _l(t, "k", { ctrlKey: !0 }));
			}(t)) t.preventDefault(), Nl(e, Ye$1, !1);
			else if (function(t) {
				return _l(t, "b", pl);
			}(t)) t.preventDefault(), Nl(e, Ge$2, "bold");
			else if (function(t) {
				return _l(t, "u", pl);
			}(t)) t.preventDefault(), Nl(e, Ge$2, "underline");
			else if (function(t) {
				return _l(t, "i", pl);
			}(t)) t.preventDefault(), Nl(e, Ge$2, "italic");
			else if (function(t) {
				return _l(t, "Tab", { shiftKey: "any" });
			}(t)) Nl(e, hn$2, t);
			else if (function(t) {
				return _l(t, "z", pl);
			}(t)) t.preventDefault(), Nl(e, Qe$2);
			else if (function(t) {
				if (r$1) return _l(t, "z", {
					metaKey: !0,
					shiftKey: !0
				});
				return _l(t, "y", { ctrlKey: !0 }) || _l(t, "z", {
					ctrlKey: !0,
					shiftKey: !0
				});
			}(t)) t.preventDefault(), Nl(e, Ze$2);
			else {
				const o = e._editorState._selection;
				!function(t) {
					return _l(t, "a", pl);
				}(t) ? null === o || ur(o) || (!function(t) {
					return _l(t, "c", pl);
				}(t) ? function(t) {
					return _l(t, "x", pl);
				}(t) && (t.preventDefault(), Nl(e, Tn, t)) : (t.preventDefault(), Nl(e, vn$2, t))) : (t.preventDefault(), Nl(e, kn, t) && Vn(n));
			}
			return function(t) {
				return t.ctrlKey || t.shiftKey || t.altKey || t.metaKey;
			}(t) && e.dispatchCommand(An, t), !0;
		}
		function no(t) {
			let e = t.__lexicalEventHandles;
			return void 0 === e && (e = [], t.__lexicalEventHandles = e), e;
		}
		const oo = /* @__PURE__ */ new Map();
		function ro(t) {
			const e = Vl(t.target);
			if (null === e) return;
			const n = Ol(t.target);
			let o = null, r = null;
			const i = null !== n ? Kn.get(n) : void 0;
			if (null !== n) {
				if (void 0 !== i) {
					const t = i.editors;
					let n = i.hasShadowEditor;
					if (void 0 === n) {
						n = !1;
						for (const e of t) if (null !== e._rootElement && ql(e._rootElement.getRootNode())) {
							n = !0;
							break;
						}
						i.hasShadowEditor = n;
					}
					if (n) {
						let n = null, i = null;
						for (const s of t) {
							const t = s._rootElement;
							if (null === t) continue;
							const l = nc(e, t).anchorNode;
							if (null !== l && Fs(l) === s) {
								if (ql(t.getRootNode())) {
									o = s, r = l;
									break;
								}
								null === n && (n = s, i = l);
							}
						}
						null === o && null !== n && (o = n, r = i);
					} else {
						const t = e.anchorNode;
						null === t || gc(t) && null !== t.shadowRoot || (o = Fs(t), null !== o && (r = t));
					}
				}
				if (null === o) {
					const t = cc(n);
					o = null !== t ? Fs(t) : null;
				}
			}
			if (null === o) return;
			if (o._inputState.isSelectionChangeFromMouseDown) {
				if (void 0 !== i) for (const t of i.editors) t._inputState.isSelectionChangeFromMouseDown = !1;
				Ai(o, () => {
					const n = zr(), i = r ?? nc(e, o._rootElement).anchorNode;
					if (gc(i) || zs(i)) ol(Lr(n, e, o, t));
				});
			}
			const s = ll(o), l = s[s.length - 1], c = l._key, a = oo.get(c), u = a || l;
			u !== o && Wn(e, u, !1), Wn(e, o, !0), o !== l ? oo.set(c, o) : a && oo.delete(c);
		}
		function io(t) {
			t._lexicalHandled = !0;
		}
		function so(t) {
			return !0 === t._lexicalHandled;
		}
		function co(e) {
			const n = Ln.get(e);
			if (void 0 === n) return void 0;
			const o = Kn.get(n);
			if (void 0 === o) return void 0;
			Ln.delete(e);
			const r = Ps(e);
			Ds(r) ? (function(t) {
				if (null !== t._parentEditor) {
					const e = ll(t), n = e[e.length - 1]._key;
					oo.get(n) === t && oo.delete(n);
				} else oo.delete(t._key);
			}(r), o.editors.delete(r), o.hasShadowEditor = void 0, e.__lexicalEditor = null) : r && t(198);
			const i = no(e);
			for (let t = 0; t < i.length; t++) i[t]();
			e.__lexicalEventHandles = [];
		}
		function ao(e, n, o) {
			fi();
			const r = e.__key, i = e.getParent();
			if (null === i) return void (null !== ta(e) && t(367, r, String(ta(e))));
			const s = function(t) {
				const e = Kr();
				if (!ur(e) || !Pi(t)) return e;
				const { anchor: n, focus: o } = e, r = n.getNode(), i = o.getNode();
				Fl(r, t) && n.set(t.__key, 0, "element");
				Fl(i, t) && o.set(t.__key, 0, "element");
				return e;
			}(e);
			let l = !1;
			if (ur(s) && n) {
				const t = s.anchor, n = s.focus;
				t.key === r && (Wr(t, e, i, e.getPreviousSibling(), e.getNextSibling()), l = !0), n.key === r && (Wr(n, e, i, e.getPreviousSibling(), e.getNextSibling()), l = !0);
			} else dr(s) && n && e.isSelected() && e.selectPrevious();
			if (ur(s) && n && !l) {
				const t = e.getIndexWithinParent();
				Hs(e), Br(s, i, t, -1);
			} else Hs(e);
			o || Bl(i) || i.canBeEmpty() || !i.isEmpty() || ao(i, n), n && s && Bi(i) && i.isEmpty() && i.selectEnd();
		}
		const fo = Symbol.for("ephemeral");
		function ho(t) {
			return t[fo] || !1;
		}
		const go = {
			configurable: !0,
			enumerable: !1,
			value: void 0,
			writable: !0
		};
		var _o = class {
			__type;
			__key;
			__parent;
			__prev;
			__next;
			__state;
			[Kt$2];
			static getType() {
				const { ownNodeType: e } = Hc(this);
				return void 0 === e && t(64, this.name), e;
			}
			static clone(e) {
				t(65, this.name);
			}
			$config() {
				return {};
			}
			config(t, e) {
				const n = e.extends || Gc(this.constructor);
				return Object.assign(e, { extends: n }), "string" == typeof t && Object.assign(e, { type: t }), { [t]: e };
			}
			afterCloneFrom(t) {
				this.__key === t.__key ? (this.__parent = t.__parent, this.__next = t.__next, this.__prev = t.__prev, this.__state = t.__state) : t.__state && (this.__state = t.__state.getWritable(this));
			}
			resetOnCopyNodeFrom(t) {
				this.__state && (this.__state = this.__state.getWritable(this).resetOnCopyNode());
			}
			static importDOM;
			constructor(t) {
				this.__type = this.constructor.getType(), this.__parent = null, this.__prev = null, this.__next = null, Object.defineProperty(this, "__state", go), Object.defineProperty(this, Kt$2, go), Us(this, t);
			}
			getType() {
				return this.__type;
			}
			isInline() {
				t(137, this.constructor.name);
			}
			isAttached() {
				let t = this.__key;
				for (; null !== t;) {
					if ("root" === t) return !0;
					const e = Ys(t);
					if (null === e) break;
					t = null !== e.__parent ? e.__parent : ta(e);
				}
				return !1;
			}
			isSelected(t) {
				const e = t || Kr();
export {};
