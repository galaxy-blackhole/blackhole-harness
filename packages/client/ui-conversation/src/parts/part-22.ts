/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				if (Pi(r) && null !== ta(r)) {
					const t = Xr(this), n = Gr(e);
					r.splice(t, 0, n);
					const o = n[n.length - 1];
					void 0 !== o ? o.selectEnd() : r.select(t, t);
					return;
				}
				if (null === r) {
					const t = ti(e), n = t.getLastDescendant();
					let o = tu(this.anchor, "next");
					for (const e of t.getChildren()) o = mu(e, o);
					null !== n && n.selectEnd();
					return;
				}
				if (Pi(r) && !r.isParentRequired() && !Bl(r.getParentOrThrow())) {
					const t = Xr(this), n = Gr(e);
					r.splice(t, 0, n);
					const o = n[n.length - 1];
					void 0 !== o ? o.selectEnd() : r.select(t, t);
					return;
				}
				const s = ti(e), l = s.getLastDescendant(), c = s.getChildren(), a = !Pi(r) || !r.isEmpty() ? this.insertParagraph() : null;
				a && !r.isAttached() && (o = this.anchor.getNode(), r = qc(o, Sc));
				const u = c[c.length - 1];
				let f = c[0];
				var d;
				Pi(d = f) && Sc(d) && !d.isEmpty() && Pi(r) && (!r.isEmpty() || r.canMergeWhenEmpty()) && (Pi(r) || t(211, o.constructor.name, o.getType()), r.append(...f.getChildren()), f = c[1]), f && (null === r && t(212, o.constructor.name, o.getType()), function(e, n) {
					const o = n.getParentOrThrow().getLastChild();
					let r = n;
					const i = [n];
					for (; r !== o;) r.getNextSibling() || t(140), r = r.getNextSibling(), i.push(r);
					let s = e;
					for (const t of i) s = s.insertAfter(t);
				}(r, f));
				const h = qc(l, Sc);
				a && Pi(h) && (a.canMergeWhenEmpty() || Sc(u)) && (h.append(...a.getChildren()), a.remove()), Pi(r) && r.isEmpty() && r.remove(), l.selectEnd();
				const g = Pi(r) ? r.getLastChild() : null;
				Yi(g) && h !== r && g.remove();
			}
			insertParagraph() {
				const e = this.anchor.getNode();
				if ("element" === this.anchor.type && Bl(e)) {
					const t = es();
					return e.splice(this.anchor.offset, 0, [t]), t.select(), t;
				}
				const n = Xr(this), o = qc(this.anchor.getNode(), Sc);
				if (null !== o && null !== ta(o)) return null;
				Pi(o) || t(213);
				const r = o.getChildAtIndex(n), i = r ? [r, ...r.getNextSiblings()] : [], s = o.insertNewAfter(this, !1);
				return s ? (s.append(...i), s.selectStart(), s) : null;
			}
			insertLineBreak(t) {
				const e = qi();
				if (this.insertNodes([e]), t) {
					const t = e.getParentOrThrow(), n = e.getIndexWithinParent();
					t.select(n, n);
				}
			}
			extract() {
				const t = [...this.getNodes()], e = t.length;
				let n = t[0], o = t[e - 1];
				const [r, i] = yr(this), s = this.isBackward(), [l, c] = s ? [this.focus, this.anchor] : [this.anchor, this.focus], [a, u] = s ? [i, r] : [r, i];
				if (0 === e) return [];
				if (1 === e) {
					if (Xo(n) && !this.isCollapsed()) {
						const t = n.splitText(a, u), e = 0 === a ? t[0] : t[1];
						return e ? (l.set(e.getKey(), 0, "text"), c.set(e.getKey(), e.getTextContentSize(), "text"), [e]) : [];
					}
					return [n];
				}
				if (Xo(n) && (a === n.getTextContentSize() ? t.shift() : 0 !== a && ([, n] = n.splitText(a), t[0] = n, l.set(n.getKey(), 0, "text"))), Xo(o)) {
					const e = o.getTextContent().length;
					0 === u ? t.pop() : u !== e && ([o] = o.splitText(u), t[t.length - 1] = o, c.set(o.getKey(), o.getTextContentSize(), "text"));
				}
				return t;
			}
			modify(t, e, n) {
				if (ei(this, t, e, n)) return;
				const o = "move" === t, r = _i(), i = Jl(Il(r));
				if (!i) return;
				const s = r._blockCursorElement, l = r._rootElement, c = this.focus.getNode();
				null === l || null === s || !Pi(c) || c.isInline() || c.canBeEmpty() || jl(s, r, l);
				const a = El(r, this.focus.key);
				let u = a;
				if ("text" === this.focus.type && (u = Xo(c) ? wc(c, a, r) : null), this.dirty) {
					const t = El(r, this.anchor.key);
					let e = t;
					if ("text" === this.anchor.type) {
						const n = this.anchor.getNode();
						e = Xo(n) ? wc(n, t, r) : null;
					}
					e && u && Ur(i, e, this.anchor.offset, u, this.focus.offset);
				}
				if ("character" === n && Xo(c) && c.isUnmergeable()) {
					if (e ? 0 === this.focus.offset : this.focus.offset === c.getTextContentSize()) {
						const t = Ia(c, e ? "previous" : "next").getNodeAtCaret();
						if (Xo(t)) {
							if (!o) {
								const n = t.getTextContentSize();
								e ? this.focus.set(t.__key, n - 1, "text") : this.focus.set(t.__key, 1, "text"), this.dirty = !0;
								return;
							}
							{
								const n = r.getElementByKey(t.getKey()), o = n ? wc(t, n, r) : null;
								if (o) {
									const t = e ? o.length : 0;
									Ur(i, o, t, o, t);
								}
							}
						}
					}
				}
				if (Cr(i, t, e ? "backward" : "forward", n), i.rangeCount > 0) {
					const t = tc(i, r._rootElement), n = t || i.getRangeAt(0), s = this.anchor.getNode(), l = Bi(s) ? s : Kl(s);
					if (this.applyDOMRange(n), this.dirty = !0, !o) {
						Sr(this, e, l);
						(t ? "backward" !== i.direction : i.anchorNode === n.startContainer && i.anchorOffset === n.startOffset) || xr(this);
					}
				}
				"lineboundary" === n && ei(this, t, e, n, "decorators");
			}
			forwardDeletion(t, e, n) {
				if (!n && ("element" === t.type && Pi(e) && t.offset === e.getChildrenSize() || "text" === t.type && t.offset === e.getTextContentSize())) {
					const t = e.getParent(), n = e.getNextSibling() || (null === t ? null : t.getNextSibling());
					if (Pi(n) && n.isShadowRoot()) return !0;
				}
				return !1;
			}
			deleteCharacter(t) {
				const e = this.isCollapsed();
				if (this.isCollapsed()) {
					const e = this.anchor;
					let n = e.getNode();
					if (this.forwardDeletion(e, n, t)) return;
					const o = ja(tu(e, t ? "previous" : "next"));
					if (o.getTextSlices().every((t) => null === t || 0 === t.distance)) {
						let t = { type: "initial" };
						for (const e of o.iterNodeCarets("shadowRoot")) if (Aa(e)) if (e.origin.isInline());
						else {
							if (e.origin.isShadowRoot()) {
								if ("merge-block" === t.type) break;
								if (Pi(o.anchor.origin) && o.anchor.origin.isEmpty()) {
									const t = au(e);
									ou(this, Va(t, t)), o.anchor.origin.remove();
								}
								return;
							}
							"merge-next-block" !== t.type && "merge-block" !== t.type || (t = {
								block: t.block,
								caret: e,
								type: "merge-block"
							});
						}
						else {
							if ("merge-block" === t.type) break;
							if (Ma(e)) {
								if (Pi(e.origin)) {
									if (e.origin.isInline()) {
										if (!e.origin.isParentOf(o.anchor.origin)) break;
									} else t = {
										block: e.origin,
										type: "merge-next-block"
									};
									continue;
								}
								if (Ki(e.origin)) {
									if (e.origin.isIsolated());
									else if (ia(e.origin).length > 0) {
										if (Pi(o.anchor.origin) && o.anchor.origin.isEmpty()) {
											o.anchor.origin.remove();
											const t = Pr();
											t.add(e.origin.getKey()), ol(t);
										}
									} else if ("merge-next-block" === t.type && (e.origin.isKeyboardSelectable() || !e.origin.isInline()) && Pi(o.anchor.origin) && o.anchor.origin.isEmpty()) {
										o.anchor.origin.remove();
										const t = Pr();
										t.add(e.origin.getKey()), ol(t);
									} else e.origin.remove();
									return;
								}
								break;
							}
						}
						if ("merge-block" === t.type) {
							const { caret: e, block: n } = t;
							if (ia(n).length > 0) return;
							return e.origin.isEmpty() && !n.isEmpty() && e.origin.getParent() === n.getParent() ? void e.origin.remove(!0) : (ou(this, Va(!e.origin.isEmpty() && n.isEmpty() ? iu(Ia(n, e.direction)) : o.anchor, e)), this.removeText());
						}
						for (let t = e.getNode(); null !== t;) {
							if (null !== ta(t)) return;
							if (Pi(t) && t.isShadowRoot()) break;
							t = t.getParent();
						}
					}
					const r = this.focus;
					if (vr(this, t, "character"), this.isCollapsed()) {
						if (t && 0 === e.offset && mr(this, e.getNode())) return;
					} else {
						const o = "text" === r.type ? r.getNode() : null;
						if (n = "text" === e.type ? e.getNode() : null, null !== o && o.isSegmented()) {
							const e = r.offset, i = o.getTextContentSize();
							if (o.is(n) || t && e !== i || !t && 0 !== e) return void kr(o, t, e);
						} else if (null !== n && n.isSegmented()) {
							const r = e.offset, i = n.getTextContentSize();
							if (n.is(o) || t && 0 !== r || !t && r !== i) return void kr(n, t, r);
						}
						(function(t, e) {
							const n = t.anchor, o = t.focus, r = n.getNode();
							if (r === o.getNode() && "text" === n.type && "text" === o.type) {
								const t = n.offset, i = o.offset, s = t < i, l = s ? t : i, c = s ? i : t, a = c - 1;
								if (l !== a) (function(t) {
									return !(sl(t) || Tr(t));
								})(r.getTextContent().slice(l, c)) && (e ? o.set(o.key, a, o.type) : n.set(n.key, a, n.type));
							}
						})(this, t);
					}
				}
				if (this.removeText(), t && !e && this.isCollapsed() && "element" === this.anchor.type && 0 === this.anchor.offset) {
					const t = this.anchor.getNode();
					t.isEmpty() && Bi(t.getParent()) && null === t.getPreviousSibling() && mr(this, t), ar();
				}
			}
			deleteLine(t) {
				const e = Er(this.anchor);
				if (null !== e && Ki(ea(e))) return this.isCollapsed() || this.focus.set(this.anchor.key, this.anchor.offset, this.anchor.type), void this.deleteCharacter(t);
				if (this.isCollapsed() && vr(this, t, "lineboundary"), this.isCollapsed()) this.deleteCharacter(t);
				else qc(this.anchor.getNode(), Sc) !== qc(this.focus.getNode(), Sc) ? (this.focus.set(this.anchor.key, this.anchor.offset, this.anchor.type), this.deleteCharacter(t)) : this.removeText();
			}
			deleteWord(t) {
				if (this.isCollapsed()) {
					const e = this.anchor, n = e.getNode();
					if (this.forwardDeletion(e, n, t)) return;
					vr(this, t, "word");
				}
				this.isCollapsed() ? this.deleteCharacter(t) : this.removeText();
			}
			isBackward() {
				const t = this._cachedIsBackward;
				if (null !== t) return t;
				const e = this.focus.isBefore(this.anchor);
				return ui() || (this._cachedIsBackward = e), e;
			}
			getStartEndPoints() {
				return [this.anchor, this.focus];
			}
		};
		function dr(t) {
			return t instanceof cr;
		}
		function hr(t, e) {
			if (dr(t)) {
				for (const n of t.getNodes()) Ro(n) && n.setFormat(e(n.getFormat()));
				return;
			}
			if (t.isCollapsed()) return t.setFormat(e(t.format)), void Vs(null);
			const n = [];
			for (const o of t.getNodes()) Xo(o) ? n.push(o) : Pi(o) ? o.setTextFormat(e(o.getTextFormat())) : Ro(o) && o.setFormat(e(o.getFormat()));
			const o = n.length;
			if (0 === o) return t.setFormat(e(t.format)), void Vs(null);
			const r = t.anchor, i = t.focus, s = t.isBackward(), l = s ? i : r, c = s ? r : i;
			let a = 0, u = n[0], f = "element" === l.type ? 0 : l.offset;
			if ("text" === l.type && f === u.getTextContentSize() && (a = 1, u = n[1], f = 0), null == u) return;
			const d = o - 1;
			let h = n[d];
			const g = "text" === c.type ? c.offset : h.getTextContentSize();
			if (u.is(h)) {
				if (f === g) return;
				const n = e(u.getFormat());
				if (Ks(u) || 0 === f && g === u.getTextContentSize()) u.setFormat(n);
				else {
					const t = u.splitText(f, g), e = 0 === f ? t[0] : t[1];
					e.setFormat(n), "text" === l.type && l.set(e.__key, 0, "text"), "text" === c.type && c.set(e.__key, g - f, "text");
				}
				t.format = n;
				return;
			}
			0 === f || Ks(u) || ([, u] = u.splitText(f), f = 0);
			const _ = e(u.getFormat());
			u.setFormat(_);
			const p = e(h.getFormat());
			g > 0 && (g === h.getTextContentSize() || Ks(h) || ([h] = h.splitText(g)), h.setFormat(p));
			for (let t = a + 1; t < d; t++) {
				const o = n[t];
				o.setFormat(e(o.getFormat()));
			}
			"text" === l.type && l.set(u.__key, f, "text"), "text" === c.type && c.set(h.__key, g, "text"), t.format = _ | p;
		}
		function _r(t, e, n = null) {
			const o = null === n && ur(t) ? Ws(t.format, e, null) : n;
			hr(t, (t) => Ws(t, e, o));
		}
		function pr(t) {
			const e = t.offset;
			if ("text" === t.type) return e;
			const n = t.getNode();
			return e === n.getChildrenSize() ? n.getTextContent().length : 0;
		}
		function yr(t) {
			const e = t.getStartEndPoints();
			if (null === e) return [0, 0];
			const [n, o] = e;
			return "element" === n.type && "element" === o.type && n.key === o.key && n.offset === o.offset ? [0, 0] : [pr(n), pr(o)];
		}
		function mr(t, e) {
			for (let n = e; n; n = n.getParent()) {
				if (Pi(n)) {
					if (n.collapseAtStart(t)) return !0;
					if (Bl(n)) break;
				}
				if (n.getPreviousSibling()) break;
			}
			return !1;
		}
		function xr(t) {
			const e = t.focus, n = t.anchor, o = n.key, r = n.offset, i = n.type;
			n.set(e.key, e.offset, e.type, !0), e.set(o, r, i, !0);
		}
		function Cr(t, e, n, o) {
			t.modify(e, n, o);
		}
		function Sr(t, e, n) {
			const o = t.getNodes(), r = o.filter((t) => Fl(t, n));
			if (0 === r.length || r.length === o.length) return !1;
			const i = e ? r[0] : r[r.length - 1], s = Pi(i) ? i : i.getParentOrThrow();
			return e ? s.selectStart() : s.selectEnd(), !0;
		}
		function vr(t, e, n) {
			if (ei(t, "extend", e, n)) return;
			const o = _i(), r = Jl(Il(o));
			if (!r || "function" != typeof r.modify) return;
			const i = o._blockCursorElement, s = o._rootElement, l = t.anchor, c = t.focus.getNode();
			null === s || null === i || !Pi(c) || c.isInline() || c.canBeEmpty() || jl(i, o, s);
			const a = (t) => {
				const e = t.getNode(), n = o.getElementByKey(t.key);
				return null !== n && "text" === t.type && Xo(e) ? wc(e, n, o) : n;
			}, u = l.getNode(), f = a(l);
			if (null === f) return;
			const d = l.offset, h = t.isCollapsed(), g = t.focus, _ = h ? f : a(g);
			if (null === _) return;
			const p = g.offset;
			if (Ur(r, _, p, _, p), Cr(r, "move", e ? "backward" : "forward", n), 0 === r.rangeCount) return;
			const y = tc(r, s) || r.getRangeAt(0), m = y.startContainer, x = y.startOffset;
			if (h && "character" === n && "text" === l.type && Xo(u) && u.isUnmergeable()) {
				if (d === (e ? 0 : u.getTextContentSize())) {
					const n = Ia(u, e ? "previous" : "next").getNodeAtCaret();
					if (Xo(n)) {
						const o = e ? n.getTextContentSize() - 1 : 1;
						t.focus.set(n.__key, o, "text"), t.dirty = !0;
						return;
					}
				}
			}
			if (h && "character" === n && "text" === l.type) {
				const n = e ? 0 : u.getTextContentSize(), o = m === f ? x : d !== n ? n : -1;
				if (o >= 0) return void (o !== d && (t.focus.set(l.key, o, "text"), t.dirty = !0));
			}
			const [C, S, v, T] = e ? [
				m,
				x,
				f,
				d
			] : [
				f,
				d,
				m,
				x
			], k = Bi(u) ? u : Kl(u);
			t.applyDOMRange({
				collapsed: !1,
				endContainer: v,
				endOffset: T,
				startContainer: C,
				startOffset: S
			}), t.dirty = !0, !Sr(t, e, k) && e && xr(t), "lineboundary" === n && ei(t, "extend", e, n, "decorators");
		}
		const Tr = (() => {
			try {
				const t = /* @__PURE__ */ new RegExp("\\p{Emoji}", "u"), e = t.test.bind(t);
				if (e("❤️") && e("#️⃣") && e("👍")) return e;
			} catch (t) {}
			return () => !1;
		})();
		function kr(t, e, n) {
			const o = t, r = o.getTextContent().split(/(?=\s)/g), i = r.length;
			let s = 0, l = 0;
			for (let t = 0; t < i; t++) {
				const o = t === i - 1;
				if (l = s, s += r[t].length, e && s === n || s > n || o) {
					r.splice(t, 1), o && (l = void 0);
					break;
				}
			}
			const c = r.join("").trim();
			"" === c ? o.remove() : (o.setTextContent(c), o.select(l, l));
		}
		function br(e, n, o, r) {
			let i, s = n, l = !1;
			if (gc(e)) {
				let c = !1;
				const a = e.childNodes, u = a.length, f = r._blockCursorElement;
export {};
