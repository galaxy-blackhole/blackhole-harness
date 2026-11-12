/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				if (null == e) return !1;
				const n = e.getNodes().some((t) => t.__key === this.__key);
				if (Xo(this)) return n;
				if (ur(e) && "element" === e.anchor.type && "element" === e.focus.type) {
					if (e.isCollapsed()) return !1;
					const t = this.getParent();
					if (Ki(this) && this.isInline() && t) {
						const n = e.isBackward() ? e.focus : e.anchor;
						if (t.is(n.getNode()) && n.offset === t.getChildrenSize() && this.is(t.getLastChild())) return !1;
					}
				}
				return n;
			}
			getKey() {
				return this.__key;
			}
			getIndexWithinParent() {
				const t = this.getParent();
				if (null === t) return -1;
				let e = t.getFirstChild(), n = 0;
				for (; null !== e;) {
					if (this.is(e)) return n;
					n++, e = e.getNextSibling();
				}
				return -1;
			}
			getParent() {
				const t = this.getLatest().__parent;
				return null === t ? null : Ys(t);
			}
			getParentOrThrow() {
				const e = this.getParent();
				return null === e && t(66, this.__key), e;
			}
			getTopLevelElement() {
				let e = this;
				for (; null !== e;) {
					const n = e.getParent();
					if (Bl(n) || null !== ta(e)) return Pi(e) || e === this && Ki(e) || t(194), e;
					e = n;
				}
				return null;
			}
			getTopLevelElementOrThrow() {
				const e = this.getTopLevelElement();
				return null === e && t(67, this.__key), e;
			}
			getParents() {
				const t = [];
				let e = this.getParent();
				for (; null !== e;) t.push(e), e = e.getParent();
				return t;
			}
			getParentKeys() {
				const t = [];
				let e = this.getParent();
				for (; null !== e;) t.push(e.__key), e = e.getParent();
				return t;
			}
			getPreviousSibling() {
				const t = this.getLatest().__prev;
				return null === t ? null : Ys(t);
			}
			getPreviousSiblings() {
				const t = [], e = this.getParent();
				if (null === e) return t;
				let n = e.getFirstChild();
				for (; null !== n && !n.is(this);) t.push(n), n = n.getNextSibling();
				return t;
			}
			getNextSibling() {
				const t = this.getLatest().__next;
				return null === t ? null : Ys(t);
			}
			getNextSiblings() {
				const t = [];
				let e = this.getNextSibling();
				for (; null !== e;) t.push(e), e = e.getNextSibling();
				return t;
			}
			getCommonAncestor(t) {
				const e = Pi(this) ? this : this.getParent(), n = Pi(t) ? t : t.getParent(), o = e && n ? Za(e, n) : null;
				return o ? o.commonAncestor : null;
			}
			is(t) {
				return null != t && this.__key === t.__key;
			}
			isBefore(e) {
				const n = Za(this, e);
				return null !== n && ("descendant" === n.type || ("branch" === n.type ? -1 === Ga(n) : ("same" !== n.type && "ancestor" !== n.type && t(279), !1)));
			}
			isParentOf(t) {
				return Fl(t, this);
			}
			getNodesBetween(e) {
				const n = this.isBefore(e), o = [], r = /* @__PURE__ */ new Set();
				let i = this;
				for (; null !== i;) {
					const s = i.__key;
					if (r.has(s) || (r.add(s), o.push(i)), i === e) break;
					const l = Pi(i) ? n ? i.getFirstChild() : i.getLastChild() : null;
					if (null !== l) {
						i = l;
						continue;
					}
					const c = n ? i.getNextSibling() : i.getPreviousSibling();
					if (null !== c) {
						i = c;
						continue;
					}
					const a = i.getParentOrThrow();
					if (r.has(a.__key) || o.push(a), a === e) break;
					let u = null, f = a;
					do {
						if (null === f && t(68), u = n ? f.getNextSibling() : f.getPreviousSibling(), f = f.getParent(), null === f) break;
						null !== u || r.has(f.__key) || o.push(f);
					} while (null === u);
					i = u;
				}
				return n || o.reverse(), o;
			}
			isDirty() {
				const t = _i()._dirtyLeaves;
				return null !== t && t.has(this.__key);
			}
			getLatest() {
				if (ho(this)) return this;
				const e = Ys(this.__key);
				return null === e && t(113), e;
			}
			getWritable() {
				if (ho(this)) return this;
				fi();
				const t = hi(), e = _i(), n = t._nodeMap, o = this.__key, r = this.getLatest(), i = e._cloneNotNeeded, s = Kr();
				if (null !== s && s.setCachedNodes(null), i.has(o)) return Js(r), r;
				const l = Dc(r);
				return i.add(o), Js(l), n.set(o, l), l;
			}
			getTextContent() {
				return ha(this);
			}
			getTextContentSize() {
				return this.getTextContent().length;
			}
			createDOM(e, n) {
				t(70);
			}
			updateDOM(e, n, o) {
				t(71);
			}
			getDOMSlot(t) {
				return new q(t);
			}
			exportDOM(t) {
				return { element: this.createDOM(t._config, t) };
			}
			exportJSON() {
				const t = this.__state ? this.__state.toJSON() : void 0;
				return {
					type: this.__type,
					version: 1,
					...t
				};
			}
			static importJSON(e) {
				t(18, this.name);
			}
			updateFromJSON(t) {
				return function(t, e) {
					const n = t.getWritable(), o = e.$;
					let r = o;
					for (const t of Nt$1(n).flatKeys) t in e && (void 0 !== r && r !== o || (r = { ...o }), r[t] = e[t]);
					return (n.__state || r) && bt$2(t).updateFromJSON(r), n;
				}(this, t);
			}
			static transform() {
				return null;
			}
			remove(t) {
				ao(this, !0, t);
			}
			replace(e, n) {
				fi();
				let o = Kr();
				null !== o && (o = o.clone()), $l(this, e);
				const r = this.getLatest(), i = this.__key, s = e.__key, l = e.getWritable(), c = this.getParentOrThrow().getWritable(), a = c.__size, u = l.getParent(), f = null !== u ? l.getIndexWithinParent() : -1;
				Hs(l), null !== u && ur(o) && Br(o, u, f, -1);
				const d = r.getPreviousSibling(), h = r.getNextSibling(), g = r.__prev, _ = r.__next, p = r.__parent;
				if (ao(r, !1, !0), null === d) c.__first = s;
				else d.getWritable().__next = s;
				if (l.__prev = g, null === h) c.__last = s;
				else h.getWritable().__prev = s;
				l.__next = _, l.__parent = p, c.__size = a;
				let y = 0;
				n && (Pi(this) && Pi(l) || t(139), y = l.getChildrenSize(), l.splice(y, 0, this.getChildren()));
				const m = ia(this);
				if (m.length > 0) {
					Qc(this) && Qc(l) || t(368, this.__key, l.__key);
					for (const t of m) {
						const e = sa(this, t);
						null !== e && (ya(this, t), pa(l, t, e));
					}
				}
				if (ur(o)) {
					ol(o);
					const t = o.anchor, e = o.focus;
					t.key === i && (n && "element" === t.type ? t.set(l.__key, y + t.offset, "element") : ir(t, l)), e.key === i && (n && "element" === e.type ? e.set(l.__key, y + e.offset, "element") : ir(e, l));
				}
				return qs() === i && Vs(s), l;
			}
			insertAfter(t, e = !0) {
				fi(), $l(this, t);
				const n = this.getWritable(), o = t.getWritable();
				this.getParentOrThrow();
				const r = o.getParent(), i = Kr();
				let s = !1, l = !1;
				if (null !== r) {
					const n = t.getIndexWithinParent();
					if (ur(i)) {
						const t = r.__key, e = i.anchor, o = i.focus;
						s = "element" === e.type && e.key === t && e.offset === n + 1, l = "element" === o.type && o.key === t && o.offset === n + 1;
					}
					Hs(o), e && ur(i) && Br(i, r, n, -1);
				} else Hs(o);
				const c = this.getNextSibling(), a = this.getParentOrThrow().getWritable(), u = o.__key, f = n.__next;
				if (null === c) a.__last = u;
				else c.getWritable().__prev = u;
				if (a.__size++, n.__next = u, o.__next = f, o.__prev = n.__key, o.__parent = n.__parent, e && ur(i)) {
					const t = this.getIndexWithinParent();
					Br(i, a, t + 1);
					const e = a.__key;
					s && i.anchor.set(e, t + 2, "element"), l && i.focus.set(e, t + 2, "element");
				}
				return t;
			}
			insertBefore(t, e = !0) {
				fi(), $l(this, t);
				const n = this.getWritable(), o = t.getWritable();
				this.getParentOrThrow();
				const r = o.__key, i = Kr(), s = o.getParent(), l = null !== s ? o.getIndexWithinParent() : -1;
				Hs(o), null !== s && e && ur(i) && Br(i, s, l, -1);
				const c = this.getPreviousSibling(), a = this.getParentOrThrow().getWritable(), u = n.__prev, f = this.getIndexWithinParent();
				if (null === c) a.__first = r;
				else c.getWritable().__next = r;
				if (a.__size++, n.__prev = r, o.__prev = u, o.__next = n.__key, o.__parent = n.__parent, e && ur(i)) Br(i, this.getParentOrThrow(), f);
				return t;
			}
			isParentRequired() {
				return !1;
			}
			createParentElementNode() {
				return es();
			}
			selectStart() {
				return this.selectPrevious();
			}
			selectEnd() {
				return this.selectNext(0, 0);
			}
			selectPrevious(t, e) {
				fi();
				const n = ea(this);
				if (null !== n) return n.selectPrevious(t, e);
				const o = this.getPreviousSibling(), r = this.getParentOrThrow();
				if (null === o) return r.select(0, 0);
				if (Pi(o)) return o.select();
				if (!Xo(o)) {
					const t = o.getIndexWithinParent() + 1;
					return r.select(t, t);
				}
				return o.select(t, e);
			}
			selectNext(t, e) {
				fi();
				const n = ea(this);
				if (null !== n) return n.selectNext(t, e);
				const o = this.getNextSibling(), r = this.getParentOrThrow();
				if (null === o) return r.select();
				if (Pi(o)) return o.select(0, 0);
				if (!Xo(o)) {
					const t = o.getIndexWithinParent();
					return r.select(t, t);
				}
				return o.select(t, e);
			}
			markDirty() {
				this.getWritable();
			}
			reconcileObservedMutation(t, e) {
				this.markDirty();
			}
		};
		function po(t) {
			return t instanceof _o;
		}
		const mo = "history-push", xo = "history-merge", Co = "paste", ko = "skip-scroll-into-view", bo = "skip-dom-selection", No = "skip-selection-focus", wo = "composition-end", Oo = "!important";
		function Mo(t) {
			const e = {};
			if (!t) return e;
			let n = "", o = "", r = null, i = !1, s = !1, l = !1, c = 0;
			const a = t.length;
			let u = -1;
			for (let f = 0; f < a; f++) {
				const a = t[f];
				if (i) "*" === a && "/" === t[f + 1] && (i = !1, f++);
				else if (s) -1 === u && (u = f), s = !1;
				else if (null === r) if ("/" !== a || "*" !== t[f + 1]) if ("\"" !== a && "'" !== a) if ("(" !== a) if (")" !== a) if (l || ":" !== a || 0 !== c) {
					if (";" === a && 0 === c) {
						-1 !== u && (l ? o += t.slice(u, f) : n += t.slice(u, f), u = -1);
						const r = n.trim(), i = o.trim();
						"" !== r && "" !== i && (e[r] = i), n = "", o = "", l = !1;
						continue;
					}
					-1 === u && (u = f);
				} else -1 !== u && (n += t.slice(u, f), u = -1), l = !0;
				else -1 === u && (u = f), c = Math.max(0, c - 1);
				else -1 === u && (u = f), c++;
				else -1 === u && (u = f), r = a;
				else -1 !== u && (l ? o += t.slice(u, f) : n += t.slice(u, f), u = -1), i = !0, f++;
				else -1 === u && (u = f), "\\" === a ? s = !0 : a === r && (r = null);
			}
			-1 !== u && (l ? o += t.slice(u, a) : n += t.slice(u, a));
			const f = n.trim(), d = o.trim();
			return "" !== f && "" !== d && (e[f] = d), e;
		}
		function Ao(t, e, n) {
			const o = n.trimEnd(), r = o.length - 10;
			r >= 0 && o.slice(r).toLowerCase() === Oo ? t.setProperty(e, o.slice(0, r).trim(), "important") : t.setProperty(e, n, "");
		}
		function Fo(t, e, n = "") {
			if (e === n) return;
			const o = Mo(n), r = Mo(e);
			for (const e in r) delete o[e], Ao(t, e, r[e]);
			for (const e in o) t.removeProperty(e);
		}
		function Po(t, e) {
			return 16 & e ? "code" : e & 128 ? "mark" : 32 & e ? "sub" : 64 & e ? "sup" : null;
		}
		function Io(t, e) {
			return 1 & e ? "strong" : 2 & e ? "em" : "span";
		}
		function Lo(t, e, n, o, r) {
			const i = o.classList;
			let s = Cl(r, "base");
			void 0 !== s && i.add(...s), s = Cl(r, "underlineStrikethrough");
			let l = !1;
			const c = 8 & e && 4 & e;
			void 0 !== s && (8 & n && 4 & n ? (l = !0, c || i.add(...s)) : c && i.remove(...s));
			for (const t in z$1) {
				const o = z$1[t];
				if (s = Cl(r, t), void 0 !== s) if (n & o) {
					if (l && ("underline" === t || "strikethrough" === t)) {
						e & o && i.remove(...s);
						continue;
					}
					(0 === (e & o) || c && "underline" === t || "strikethrough" === t) && i.add(...s);
				} else e & o && i.remove(...s);
			}
		}
		function Ko(t, e, n) {
			const o = n.isComposing(), r = t + (o ? A : ""), s = vc(), l = Tc(s).$getDOMSlot(n, e, s), c = l.getFirstChild();
			if (null === c || c.nodeType !== Node.TEXT_NODE) return void l.insertChild(Zl().createTextNode(r));
			const a = c, u = a.nodeValue;
			if (u !== r) if (o || i) {
				const [t, e, n] = function(t, e) {
					const n = t.length, o = e.length;
					let r = 0, i = 0;
					for (; r < n && r < o && t[r] === e[r];) r++;
					for (; i + r < n && i + r < o && t[n - i - 1] === e[o - i - 1];) i++;
					return [
						r,
						n - r - i,
						e.slice(r, o - i)
					];
				}(u, r);
				0 !== e && a.deleteData(t, e), a.insertData(t, n);
			} else a.nodeValue = r;
		}
		function zo(t, e, n, o, r, i) {
			Ko(r, t, e);
			const s = i.theme.text;
			void 0 !== s && Lo(0, 0, o, t, s);
		}
		function Bo(t, e) {
			const n = Zl().createElement(e);
			return n.appendChild(t), n;
		}
		function Ro(t) {
			return null != t && !0 === t.__isInlineFormattable;
		}
		var Wo = class extends _o {
			__text;
			__format;
			__style;
			__mode;
			__detail;
			get __isInlineFormattable() {
				return !0;
			}
			$config() {
export {};
