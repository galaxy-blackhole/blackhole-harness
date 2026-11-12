/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				s === u && u > 0 && (c = !0, s = u - 1), void 0 !== Qs(e, r) || Rc(e, r) || (l = !0);
				let d = a[s], h = !1;
				if (d === f) d = a[s + 1], h = !0;
				else if (null !== f) {
					const t = f.parentNode;
					if (e === t) n > Array.prototype.indexOf.call(t.children, f) && s--;
				}
				if (i = il(d), Xo(i)) s = Ka(i, c ? "next" : "previous");
				else {
					let a = il(e);
					if (null === a) return null;
					if (Pi(a)) {
						const l = r.getElementByKey(a.getKey());
						null === l && t(214);
						const u = kc(a, l, r);
						[a, s] = u.resolveChildIndex(a, l, e, n), Pi(a) || t(215), c && s >= a.getChildrenSize() && (s = Math.max(0, a.getChildrenSize() - 1));
						let f = a.getChildAtIndex(s);
						if (Pi(f) && function(t, e, n) {
							const o = t.getParent();
							return null === n || null === o || !o.canBeEmpty() || o !== n.getNode();
						}(f, 0, o)) {
							const t = c ? f.getLastDescendant() : f.getFirstDescendant();
							null === t ? a = f : (f = t, a = Pi(f) ? f : f.getParentOrThrow()), s = 0;
						}
						Xo(f) ? (i = f, a = null, s = Ka(f, c ? "next" : "previous")) : f !== a && c && !h && (Pi(a) || t(216), s = Math.min(a.getChildrenSize(), s + 1));
					} else {
						const t = ea(a), o = null !== t ? t : a, i = o.getIndexWithinParent(), l = r.getElementByKey(a.getKey());
						let c = "after";
						if (null !== l && il(e) === a) {
							const t = kc(a, l, r);
							t.element !== l ? c = t.resolveLeafPosition(l, e, n) : 0 === n && Ki(a) && (c = "before");
						}
						s = "before" === c ? i : i + 1, a = o.getParentOrThrow();
					}
					if (Pi(a)) return [or(a.__key, s, "element"), l];
				}
			} else i = il(e);
			return Xo(i) ? [or(i.__key, Ka(i, s, "clamp"), "text"), l] : null;
		}
		function Nr(t, e, n) {
			const o = t.offset, r = t.getNode();
			if (0 === o) {
				const o = r.getPreviousSibling(), i = r.getParent();
				if (e) {
					if ((n || !e) && null === o && Pi(i) && i.isInline()) {
						const e = i.getPreviousSibling();
						Xo(e) && t.set(e.__key, e.getTextContent().length, "text");
					}
				} else Pi(o) && !n && o.isInline() ? t.set(o.__key, o.getChildrenSize(), "element") : Xo(o) && !r.isUnmergeable() && t.set(o.__key, o.getTextContent().length, "text");
			} else if (o === r.getTextContent().length) {
				const o = r.getNextSibling(), i = r.getParent();
				if (e && Pi(o) && o.isInline()) t.set(o.__key, 0, "element");
				else if ((n || e) && null === o && Pi(i) && i.isInline() && !i.canInsertTextAfter() && i.getTextContentSize() > 1) {
					const e = i.getNextSibling();
					Xo(e) && t.set(e.__key, 0, "text");
				}
			}
		}
		function Er(t) {
			const e = Ys(t.key);
			return null === e ? null : oa(e);
		}
		function wr(t, e, n) {
			const o = Er(t), r = Er(e);
			if (o === r || null !== o && null !== r && o.is(r)) return !1;
			const i = n(o, r);
			if (null !== o) return Pi(o) ? e.set(o.getKey(), i ? o.getChildrenSize() : 0, "element") : e.set(o.getKey(), i ? o.getTextContentSize() : 0, "text"), !0;
			const s = ea(r);
			if (null === s) return !1;
			const l = s.getParent();
			if (null === l) return !1;
			const c = s.getIndexWithinParent();
			return e.set(l.getKey(), i ? c + 1 : c, "element"), !0;
		}
		function Or(t) {
			const e = wr(t.anchor, t.focus, (e, n) => function(t, e, n, o) {
				if (null !== n && null !== o) {
					const t = ea(n), e = ea(o);
					if (null !== t && t.is(e)) {
						for (const e of ra(t).values()) {
							if (e === n.getKey()) return !0;
							if (e === o.getKey()) return !1;
						}
						return !0;
					}
					return null === t || null === e || t.isBefore(e);
				}
				if (null !== n) {
					const t = ea(n), o = Ys(e.key);
					return null === t || null === o || !(!t.is(o) && !t.isParentOf(o)) || t.isBefore(o);
				}
				const r = ea(o), i = Ys(t.key);
				return null !== r && null !== i && !r.is(i) && !r.isParentOf(i) && i.isBefore(r);
			}(t.anchor, t.focus, e, n));
			return e && (t.dirty = !0), e;
		}
		function Mr(t, e, n, o, r, i) {
			if (null === t || null === n || !As(r, t, n)) return null;
			const s = br(t, e, ur(i) ? i.anchor : null, r);
			if (null === s) return null;
			const l = br(n, o, ur(i) ? i.focus : null, r);
			if (null === l) return null;
			const [c, a] = s, [u, f] = l;
			if ("element" === c.type && "element" === u.type) {
				const e = il(t), o = il(n);
				if (Ki(e) && Ki(o)) return null;
			}
			const d = r._slotsUsed && wr(c, u, () => 0 !== (t.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING));
			return function(t, e) {
				if ("text" === t.type && "text" === e.type) {
					const n = t.isBefore(e), o = t.is(e);
					Nr(t, n, o), Nr(e, !n, o), o && e.set(t.key, t.offset, t.type);
				}
			}(c, u), [
				c,
				u,
				a || f || d
			];
		}
		function Ar(t) {
			return Pi(t) && !t.isInline();
		}
		function Dr(t, e, n, o, r, i) {
			const s = hi(), l = new fr(or(t, e, r), or(n, o, i), 0, "");
			return l.dirty = !0, s._selection = l, l;
		}
		function Fr() {
			return new fr(or("root", 0, "element"), or("root", 0, "element"), 0, "");
		}
		function Pr() {
			return new cr(/* @__PURE__ */ new Set());
		}
		function Lr(t, e, n, o) {
			const r = n._window;
			if (null === r) return null;
			const i = o || r.event, s = i ? i.type : void 0, l = "selectionchange" === s, c = !it$1 && (l || "beforeinput" === s || "compositionstart" === s || "compositionend" === s || "click" === s && i && 3 === i.detail || "drop" === s || void 0 === s);
			let a, u, f, d;
			if (ur(t) && !c) return t.clone();
			{
				if (null === e) return null;
				const o = nc(e, n._rootElement);
				if (a = o.anchorNode, u = o.focusNode, f = o.anchorOffset, d = o.focusOffset, (l || void 0 === s) && ur(t) && !As(n, a, u)) return t.clone();
			}
			const h = Mr(a, f, u, d, n, t);
			if (null === h) return null;
			const [g, _, p] = h;
			let y = 0, m = "";
			if (ur(t)) {
				const e = t.anchor;
				if (g.key === e.key) y = t.format, m = t.style;
				else {
					const t = g.getNode();
					Xo(t) ? (y = t.getFormat(), m = t.getStyle()) : Pi(t) && (y = t.getTextFormat(), m = t.getTextStyle());
				}
			}
			const x = new fr(g, _, y, m);
			return p && (x.dirty = !0), x;
		}
		function Kr() {
			return hi()._selection;
		}
		function zr() {
			return _i()._editorState._selection;
		}
		function Br(t, e, n, o = 1) {
			const r = t.anchor, i = t.focus, s = r.getNode(), l = i.getNode();
			if (!e.is(s) && !e.is(l)) return;
			const c = e.__key;
			if (t.isCollapsed()) {
				const e = r.offset;
				if (n <= e && o > 0 || n < e && o < 0) {
					const n = Math.max(0, e + o);
					r.set(c, n, "element"), i.set(c, n, "element"), Rr(t);
				}
			} else {
				const s = t.isBackward(), l = s ? i : r, a = l.getNode(), u = s ? r : i, f = u.getNode();
				if (e.is(a)) {
					const t = l.offset;
					(n <= t && o > 0 || n < t && o < 0) && l.set(c, Math.max(0, t + o), "element");
				}
				if (e.is(f)) {
					const t = u.offset;
					(n <= t && o > 0 || n < t && o < 0) && u.set(c, Math.max(0, t + o), "element");
				}
			}
			Rr(t);
		}
		function Rr(t) {
			const e = t.anchor, n = e.offset, o = t.focus, r = o.offset, i = e.getNode(), s = o.getNode();
			if (t.isCollapsed()) {
				if (!Pi(i)) return;
				const t = i.getChildrenSize(), r = n >= t, s = r ? i.getChildAtIndex(t - 1) : i.getChildAtIndex(n);
				if (Xo(s)) {
					let t = 0;
					r && (t = s.getTextContentSize()), e.set(s.__key, t, "text"), o.set(s.__key, t, "text");
				}
				return;
			}
			if (Pi(i)) {
				const t = i.getChildrenSize(), o = n >= t, r = o ? i.getChildAtIndex(t - 1) : i.getChildAtIndex(n);
				if (Xo(r)) {
					let t = 0;
					o && (t = r.getTextContentSize()), e.set(r.__key, t, "text");
				}
			}
			if (Pi(s)) {
				const t = s.getChildrenSize(), e = r >= t, n = e ? s.getChildAtIndex(t - 1) : s.getChildAtIndex(r);
				if (Xo(n)) {
					let t = 0;
					e && (t = n.getTextContentSize()), o.set(n.__key, t, "text");
				}
			}
		}
		function Wr(t, e, n, o, r) {
			let i = null, s = 0, l = null;
			null !== o ? (i = o.__key, Xo(o) ? (s = o.getTextContentSize(), l = "text") : Pi(o) && (s = o.getChildrenSize(), l = "element")) : null !== r && (i = r.__key, Xo(r) ? l = "text" : Pi(r) && (l = "element")), null !== i && null !== l ? t.set(i, s, l) : (s = e.getIndexWithinParent(), -1 === s && (s = n.getChildrenSize()), t.set(n.__key, s, "element"));
		}
		function $r(t, e, n, o, r) {
			"text" === t.type ? t.set(n, t.offset + (e ? 0 : r), "text") : t.offset > o.getIndexWithinParent() && t.set(t.key, t.offset - 1, "element");
		}
		function Ur(t, e, n, o, r) {
			try {
				t.setBaseAndExtent(e, n, o, r);
			} catch (t) {}
		}
		function Hr(t, e, n) {
			const o = El(t, e.getKey());
			if (Pi(e)) {
				const r = kc(e, o, t);
				return [r.element, n + r.getFirstChildOffset()];
			}
			return [o, n];
		}
		function jr(t, e, n, o, r, s) {
			const l = s.getRootNode(), c = Bs(l) || ql(l) ? cc(l) : null;
			if (r.has("collaboration") && c !== s || null !== c && Os(c, c)) return;
			const a = nc(o, s);
			let u;
			if (!ur(e)) return void (null !== t && As(n, a.anchorNode, a.focusNode) && o.removeAllRanges());
			const f = e.anchor, d = e.focus, h = f.getNode(), g = d.getNode(), [_, p] = Hr(n, h, f.offset), [y, m] = Hr(n, g, d.offset), x = e.format, C = e.style, S = e.isCollapsed();
			let v = _, T = y, k = !1;
			if ("text" === f.type ? (v = Xo(h) ? wc(h, _, n) : null, k = h.getFormat() !== x || h.getStyle() !== C) : ur(t) && "text" === t.anchor.type && (k = !0), "text" === d.type && (T = Xo(g) ? wc(g, y, n) : null), null !== v && null !== T) {
				if (S && (null === t || k || ur(t) && (t.format !== x || t.style !== C)) && function(t, e, n, o, r, i) {
					t._inputState.collapsedSelectionFormat = {
						format: e,
						key: r,
						offset: o,
						style: n,
						timeStamp: i
					};
				}(n, x, C, p, f.key, performance.now()), ("Range" !== o.type || !S) && a.anchorOffset === p && a.focusOffset === m && a.anchorNode === v && a.focusNode === T) {
					if (null === c || !s.contains(c)) {
						const t = null !== c ? Fs(c) : null;
						null !== t && t !== n || r.has("skip-selection-focus") || s.focus({ preventScroll: !0 });
					}
					if ("element" !== f.type) return;
				}
				if (Ur(o, v, p, T, m), i && e.isCollapsed() && null !== s && !r.has("skip-selection-focus")) {
					const t = lc(s);
					if (null === t || !s.contains(t)) {
						const t = cc(s.ownerDocument), e = null !== t ? Fs(t) : null;
						null !== e && e !== n || s.focus({ preventScroll: !0 });
					}
				}
				if (!r.has("skip-scroll-into-view") && e.isCollapsed() && null !== s && s === lc(s)) {
					const t = ur(e) && "element" === e.anchor.type ? v.childNodes[p] || null : (void 0 === u && (u = ec(o, s)), u);
					if (null !== t) {
						let e;
						if (zs(t)) {
							const n = t.ownerDocument.createRange();
							n.selectNode(t), e = n.getBoundingClientRect();
						} else e = t.getBoundingClientRect();
						(function(t, e, n) {
							const o = Ol(n), r = Pl(o);
							if (null === o || null === r) return;
							const i = n.getBoundingClientRect();
							if (e.bottom < i.top) return;
							let { top: s, bottom: l } = e, c = 0, a = 0, u = n;
							for (; null !== u;) {
								const e = u === o.body;
								if (e) {
									const e = r.visualViewport;
									if (e) {
										const t = e.offsetTop;
										c = t, a = t + e.height;
									} else c = 0, a = Il(t).innerHeight;
									const n = r.getComputedStyle(o.documentElement), i = parseFloat(n.scrollPaddingTop), s = parseFloat(n.scrollPaddingBottom);
									isFinite(i) && (c += i), isFinite(s) && (a -= s);
								} else {
									const t = u === n ? i : u.getBoundingClientRect();
									c = t.top, a = t.bottom;
								}
								let f = 0;
								if (s < c ? f = -(c - s) : l > a && (f = l - a), 0 !== f) if (e) r.scrollBy(0, f);
								else {
									const t = u.scrollTop;
									u.scrollTop += f;
									const e = u.scrollTop - t;
									s -= e, l -= e;
								}
								if (e) break;
								u = wl(u);
							}
						})(n, e, s);
					}
				}
				(function(t) {
					t._inputState.isSelectionChangeFromDOMUpdate = !0;
				})(n);
			}
		}
		function Vr(t, e) {
			for (const n of t.split(/(\r?\n|\t)/)) "\n" === n || "\r\n" === n ? e.linebreak() : "	" === n ? e.tab() : "" !== n && e.text(n);
		}
		function qr(t) {
			const e = [];
			return Vr(t, {
				linebreak: () => e.push(qi()),
				tab: () => e.push(tr()),
				text: (t) => e.push(Go(t))
			}), e;
		}
		function Gr(t) {
			const e = [];
			for (const n of t) Yi(n) || (!Pi(n) && !Ki(n) || n.isInline() ? e.push(n) : Pi(n) && e.push(...Gr(n.getChildren())));
			return e;
		}
		function Xr(e) {
			let n = e;
			e.isCollapsed() || n.removeText();
			const o = Kr();
			ur(o) && (n = o), ur(n) || t(161);
			const r = n.anchor;
			let i = r.getNode(), s = r.offset;
			for (; !Sc(i) && null === ta(i);) {
				const t = i;
				if ([i, s] = Qr(i, s), t.is(i)) break;
			}
			return s;
		}
		function Qr(t, e) {
			const n = t.getParent();
			if (!n) {
				const t = es();
				return nl().append(t), t.select(), [nl(), 0];
			}
			if (Xo(t)) {
				const o = t.splitText(e);
				if (0 === o.length) return [n, t.getIndexWithinParent()];
				const r = 0 === e ? 0 : 1;
				return [n, o[0].getIndexWithinParent() + r];
			}
			if (!Pi(t) || 0 === e) return [n, t.getIndexWithinParent()];
			const o = t.getChildAtIndex(e);
			if (o) {
				const n = new fr(or(t.__key, e, "element"), or(t.__key, e, "element"), 0, ""), r = t.insertNewAfter(n);
				r && r.append(o, ...o.getNextSiblings());
			}
			return [n, t.getIndexWithinParent() + 1];
		}
		function Zr(t) {
			return Yi(t) || Ll(t) || Xo(t) || t.isParentRequired();
		}
		function ti(t) {
			const e = es();
			let n = null;
			for (let o = 0; o < t.length; o++) {
				const r = t[o];
				if (Zr(r)) {
					if (null === n) {
						n = r.createParentElementNode(), e.append(n);
						const i = t[o + 1];
						if (Yi(r) && (void 0 === i || !Zr(i))) continue;
					}
					n.append(r);
				} else e.append(r), n = null;
			}
			return e;
		}
		function ei(t, e, n, o, r = "decorators-and-blocks") {
			if ("move" === e && "character" === o && !t.isCollapsed()) {
				const [e, o] = n === t.isBackward() ? [t.focus, t.anchor] : [t.anchor, t.focus];
				return o.set(e.key, e.offset, e.type), !0;
			}
			const i = tu(t.focus, n ? "previous" : "next"), s = "lineboundary" === o, l = "move" === e;
			let c = i, a = "decorators-and-blocks" === r;
			if (!uu(c)) {
				for (const t of c) {
					a = !1;
					const { origin: e } = t;
					if (!Ki(e) || e.isIsolated() || (c = t, !s || !e.isInline())) break;
				}
				if (a) for (const t of ja(i).iterNodeCarets("extend" === e ? "shadowRoot" : "root")) {
					if (Aa(t)) t.origin.isInline() || (c = t);
					else {
						if (Pi(t.origin)) continue;
						Ki(t.origin) && !t.origin.isInline() && (c = t);
					}
					break;
				}
export {};
