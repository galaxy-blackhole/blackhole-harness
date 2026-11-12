/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			return Ca[t];
		}
		function ba(t, e = "root") {
			return null === t || Ta[e](t) ? null : null === ta(t) ? t : null;
		}
		var Na = class Na extends Sa {
			type = "sibling";
			getLatest() {
				const t = this.origin.getLatest();
				return t === this.origin ? this : Ia(t, this.direction);
			}
			getSiblingCaret() {
				return this;
			}
			getParentAtCaret() {
				return this.origin.getParent();
			}
			getChildCaret() {
				return Pi(this.origin) ? Ba(this.origin, this.direction) : null;
			}
			getParentCaret(t = "root") {
				return Ia(ba(this.getParentAtCaret(), t), this.direction);
			}
			getFlipped() {
				const t = ka(this.direction);
				return Ia(this.getNodeAtCaret(), t) || Ba(this.origin.getParentOrThrow(), t);
			}
			isSamePointCaret(t) {
				return t instanceof Na && this.direction === t.direction && this.origin.is(t.origin);
			}
			isSameNodeCaret(t) {
				return (t instanceof Na || t instanceof Ea) && this.direction === t.direction && this.origin.is(t.origin);
			}
		};
		var Ea = class Ea extends Sa {
			type = "text";
			offset;
			constructor(t, e) {
				super(t), this.offset = e;
			}
			getLatest() {
				const t = this.origin.getLatest();
				return t === this.origin ? this : La(t, this.direction, this.offset);
			}
			getParentAtCaret() {
				return this.origin.getParent();
			}
			getChildCaret() {
				return null;
			}
			getParentCaret(t = "root") {
				return Ia(ba(this.getParentAtCaret(), t), this.direction);
			}
			getFlipped() {
				return La(this.origin, ka(this.direction), this.offset);
			}
			isSamePointCaret(t) {
				return t instanceof Ea && this.direction === t.direction && this.origin.is(t.origin) && this.offset === t.offset;
			}
			isSameNodeCaret(t) {
				return (t instanceof Na || t instanceof Ea) && this.direction === t.direction && this.origin.is(t.origin);
			}
			getSiblingCaret() {
				return Ia(this.origin, this.direction);
			}
		};
		function wa(t) {
			return t instanceof Ea;
		}
		function Ma(t) {
			return t instanceof Na;
		}
		function Aa(t) {
			return t instanceof va;
		}
		const Da = {
			next: class extends Ea {
				direction = "next";
				getNodeAtCaret() {
					return this.origin.getNextSibling();
				}
				insert(t) {
					return this.origin.insertAfter(t), this;
				}
			},
			previous: class extends Ea {
				direction = "previous";
				getNodeAtCaret() {
					return this.origin.getPreviousSibling();
				}
				insert(t) {
					return this.origin.insertBefore(t), this;
				}
			}
		}, Fa = {
			next: class extends Na {
				direction = "next";
				getNodeAtCaret() {
					return this.origin.getNextSibling();
				}
				insert(t) {
					return this.origin.insertAfter(t), this;
				}
			},
			previous: class extends Na {
				direction = "previous";
				getNodeAtCaret() {
					return this.origin.getPreviousSibling();
				}
				insert(t) {
					return this.origin.insertBefore(t), this;
				}
			}
		}, Pa = {
			next: class extends va {
				direction = "next";
				getNodeAtCaret() {
					return this.origin.getFirstChild();
				}
				insert(t) {
					return this.origin.splice(0, 0, [t]), this;
				}
			},
			previous: class extends va {
				direction = "previous";
				getNodeAtCaret() {
					return this.origin.getLastChild();
				}
				insert(t) {
					return this.origin.splice(this.origin.getChildrenSize(), 0, [t]), this;
				}
			}
		};
		function Ia(t, e) {
			return t ? new Fa[e](t) : null;
		}
		function La(t, e, n) {
			return t ? new Da[e](t, Ka(t, n)) : null;
		}
		function Ka(t, n, o = "error") {
			const r = t.getTextContentSize();
			let i = "next" === n ? r : "previous" === n ? 0 : n;
			return (i < 0 || i > r) && ("clamp" !== o && e(284, String(n), String(r), t.getKey()), i = i < 0 ? 0 : r), i;
		}
		function za(t, e) {
			return new Ua(t, e);
		}
		function Ba(t, e) {
			return Pi(t) ? new Pa[e](t) : null;
		}
		function Ra(t) {
			return t && t.getChildCaret() || t;
		}
		function Wa(t) {
			return t && Ra(t.getAdjacentCaret());
		}
		var $a = class $a {
			type = "node-caret-range";
			direction;
			anchor;
			focus;
			constructor(t, e, n) {
				this.anchor = t, this.focus = e, this.direction = n;
			}
			getLatest() {
				const t = this.anchor.getLatest(), e = this.focus.getLatest();
				return t === this.anchor && e === this.focus ? this : new $a(t, e, this.direction);
			}
			isCollapsed() {
				return this.anchor.isSamePointCaret(this.focus);
			}
			getTextSlices() {
				const t = (t) => {
					const e = this[t].getLatest();
					return wa(e) ? function(t, e) {
						const { direction: n, origin: o } = t;
						return za(t, Ka(o, "focus" === e ? ka(n) : n) - t.offset);
					}(e, t) : null;
				}, e = t("anchor"), n = t("focus");
				if (e && n) {
					const { caret: t } = e, { caret: o } = n;
					if (t.isSameNodeCaret(o)) return [za(t, o.offset - t.offset), null];
				}
				return [e, n];
			}
			iterNodeCarets(t = "root") {
				const e = wa(this.anchor) ? this.anchor.getSiblingCaret() : this.anchor.getLatest(), n = this.focus.getLatest(), o = wa(n), r = (e) => e.isSameNodeCaret(n) ? null : Wa(e) || e.getParentCaret(t);
				return qa({
					hasNext: (t) => null !== t && !(o && n.isSameNodeCaret(t)),
					initial: e.isSameNodeCaret(n) ? null : r(e),
					map: (t) => t,
					step: r
				});
			}
			[Symbol.iterator]() {
				return this.iterNodeCarets("root");
			}
		};
		var Ua = class {
			type = "slice";
			caret;
			distance;
			constructor(t, e) {
				this.caret = t, this.distance = e;
			}
			getSliceIndices() {
				const { distance: t, caret: { offset: e } } = this, n = e + t;
				return n < e ? [n, e] : [e, n];
			}
			getTextContent() {
				const [t, e] = this.getSliceIndices();
				return this.caret.origin.getTextContent().slice(t, e);
			}
			getTextContentSize() {
				return Math.abs(this.distance);
			}
			removeTextSlice() {
				const { caret: { origin: t, direction: e } } = this, [n, o] = this.getSliceIndices(), r = t.getTextContent();
				return La(t.setTextContent(r.slice(0, n) + r.slice(o)), e, n);
			}
		};
		function ja(t) {
			return Va(t, Ia(nl(), t.direction));
		}
		function Ja(t) {
			return Va(t, t);
		}
		function Va(e, n) {
			return e.direction !== n.direction && t(265), new $a(e, n, e.direction);
		}
		function qa(t) {
			const { initial: e, hasNext: n, step: o, map: r } = t;
			let i = e;
			return {
				[Symbol.iterator]() {
					return this;
				},
				next() {
					if (!n(i)) return {
						done: !0,
						value: void 0
					};
					const t = {
						done: !1,
						value: r(i)
					};
					return i = o(i), t;
				}
			};
		}
		function Ya(e, n) {
			const o = Za(e.origin, n.origin);
			switch (null === o && t(275, e.origin.getKey(), n.origin.getKey()), o.type) {
				case "same": {
					const t = "text" === e.type, o = "text" === n.type;
					return t && o ? function(t, e) {
						return Math.sign(t - e);
					}(e.offset, n.offset) : e.type === n.type ? 0 : t ? -1 : o ? 1 : "child" === e.type ? -1 : 1;
				}
				case "ancestor": return "child" === e.type ? -1 : 1;
				case "descendant": return "child" === n.type ? 1 : -1;
				case "branch": return Ga(o);
			}
		}
		function Ga(t) {
			const { a: e, b: n } = t, o = e.__key, r = n.__key;
			let i = e, s = n;
			for (; i && s; i = i.getNextSibling(), s = s.getNextSibling()) {
				if (i.__key === r) return -1;
				if (s.__key === o) return 1;
			}
			return null === i ? 1 : -1;
		}
		function Xa(t, e) {
			return e.is(t);
		}
		function Qa(t) {
			return Pi(t) ? [t.getLatest(), null] : [t.getParent(), t.getLatest()];
		}
		function Za(e, n) {
			if (e.is(n)) return {
				commonAncestor: e,
				type: "same"
			};
			const o = /* @__PURE__ */ new Map();
			for (let [t, n] = Qa(e); t; n = t, t = t.getParent()) o.set(t, n);
			for (let [r, i] = Qa(n); r; i = r, r = r.getParent()) {
				const s = o.get(r);
				if (void 0 !== s) return null === s ? (Xa(e, r) || t(276), {
					commonAncestor: r,
					type: "ancestor"
				}) : null === i ? (Xa(n, r) || t(277), {
					commonAncestor: r,
					type: "descendant"
				}) : ((Pi(s) || Xa(e, s)) && (Pi(i) || Xa(n, i)) && r.is(s.getParent()) && r.is(i.getParent()) || t(278), {
					a: s,
					b: i,
					commonAncestor: r,
					type: "branch"
				});
			}
			return null;
		}
		function tu(e, n) {
			const { type: o, key: r, offset: i } = e, s = Ul(e.key);
			return "text" === o ? (Xo(s) || t(266, s.getType(), r), La(s, n, i)) : (Pi(s) || t(267, s.getType(), r), hu(s, e.offset, n));
		}
		function eu(e, n) {
			const { origin: o, direction: r } = n, i = "next" === r;
			wa(n) ? e.set(o.getKey(), n.offset, "text") : Ma(n) ? Xo(o) ? e.set(o.getKey(), Ka(o, r), "text") : e.set(o.getParentOrThrow().getKey(), o.getIndexWithinParent() + (i ? 1 : 0), "element") : (Aa(n) && Pi(o) || t(268), e.set(o.getKey(), i ? 0 : o.getChildrenSize(), "element"));
		}
		function nu(t) {
			const e = Kr(), n = ur(e) ? e : Fr();
			return ou(n, t), ol(n), n;
		}
		function ou(t, e) {
			eu(t.anchor, e.anchor), eu(t.focus, e.focus);
		}
		function ru(t) {
			const { anchor: e, focus: n } = t, o = tu(e, "next"), r = tu(n, "next"), i = Ya(o, r) <= 0 ? "next" : "previous";
			return Va(fu(o, i), fu(r, i));
		}
		function iu(t) {
			const { direction: e, origin: n } = t, o = Ia(n, ka(e)).getNodeAtCaret();
			return o ? Ia(o, e) : Ba(n.getParentOrThrow(), e);
		}
		function su(t, e = "root") {
			const n = [t];
			for (let o = Aa(t) ? t.getParentCaret(e) : t.getSiblingCaret(); null !== o; o = o.getParentCaret(e)) n.push(iu(o));
			return n;
		}
		function lu(t) {
			return !!t && t.origin.isAttached();
		}
		function cu(e, n = "removeEmptySlices") {
			if (e.isCollapsed()) return e;
			const o = "root", r = "next";
			let i = n;
			const s = du(e, r), l = su(s.anchor, o), c = su(s.focus.getFlipped(), o), a = /* @__PURE__ */ new Set(), u = [];
			for (const t of s.iterNodeCarets(o)) if (Aa(t)) a.add(t.origin.getKey());
			else if (Ma(t)) {
				const { origin: e } = t;
				Pi(e) && !a.has(e.getKey()) || u.push(e);
			}
			const f = /* @__PURE__ */ new Set();
			for (const t of u) {
				const e = t.getParent();
				null === e || a.has(e.getKey()) || f.add(e), Hs(t);
			}
			for (const t of f) !t.canBeEmpty() && !Bl(t) && t.isEmpty() && t.isAttached() && t.remove();
			for (const t of s.getTextSlices()) {
				if (!t) continue;
				const { origin: e } = t.caret, n = e.getTextContentSize(), o = iu(Ia(e, r)), s = e.getMode();
				if (Math.abs(t.distance) === n && "removeEmptySlices" === i || "token" === s && 0 !== t.distance) o.remove();
				else if (0 !== t.distance) {
					i = "removeEmptySlices";
					let e = t.removeTextSlice();
					const n = t.caret.origin;
					if ("segmented" === s) {
						const t = e.origin, n = Go(t.getTextContent()).setStyle(t.getStyle()).setFormat(t.getFormat());
						o.replaceOrInsert(n), e = La(n, r, e.offset);
					}
					n.is(l[0].origin) && (l[0] = e), n.is(c[0].origin) && (c[0] = e.getFlipped());
				}
			}
			let d, h;
			for (const t of l) if (lu(t)) {
				d = au(t);
				break;
			}
			for (const t of c) if (lu(t)) {
				h = au(t);
				break;
			}
			const g = function(t, e, n) {
				if (!t || !e) return null;
				const o = t.getParentAtCaret(), r = e.getParentAtCaret();
				if (!o || !r) return null;
				const i = o.getParents().reverse();
				i.push(o);
				const s = r.getParents().reverse();
				s.push(r);
				const l = Math.min(i.length, s.length);
				let c;
				for (c = 0; c < l && i[c] === s[c]; c++);
				const a = (t, e) => {
					let n;
					for (let o = c; o < t.length; o++) {
						const r = t[o];
						if (Bl(r)) return;
						!n && e(r) && (n = r);
					}
					return n;
				}, u = a(i, Sc), f = u && a(s, (t) => n.has(t.getKey()) && Sc(t));
				if (f && ia(f).length > 0) return null;
				return u && f ? [u, f] : null;
			}(d, h, a);
			if (g) {
				const [t, e] = g;
				Ba(t, "previous").splice(0, e.getChildren());
export {};
