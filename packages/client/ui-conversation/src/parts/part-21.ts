/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				if (void 0 !== n) e.classList.add(...n);
				return e;
			}
			setTextContent(t) {
				return super.setTextContent("	");
			}
			spliceText(e, n, o, r) {
				return "" === o && 0 === n || "	" === o && 1 === n || t(286), this;
			}
			setDetail(e) {
				return 2 !== e && t(127), this;
			}
			setMode(e) {
				return "normal" !== e && t(128), this;
			}
			canInsertTextBefore() {
				return !1;
			}
			canInsertTextAfter() {
				return !1;
			}
		};
		function tr() {
			return Wl(new Zo());
		}
		function er(t) {
			return t instanceof Zo;
		}
		var nr = class {
			key;
			offset;
			type;
			_selection;
			constructor(t, e, n) {
				this._selection = null, this.key = t, this.offset = e, this.type = n;
			}
			is(t) {
				return this.key === t.key && this.offset === t.offset && this.type === t.type;
			}
			isBefore(t) {
				if (this.key === t.key) return this.offset < t.offset;
				return Ya(au(tu(this, "next")), au(tu(t, "next"))) < 0;
			}
			getNode() {
				const e = Ys(this.key);
				return null === e && t(20), e;
			}
			set(t, e, n, o) {
				const r = this._selection, i = this.key;
				o && this.key === t && this.offset === e && this.type === n || (this.key = t, this.offset = e, this.type = n, ui() || (qs() === i && Vs(t), null !== r && (r.setCachedNodes(null), ur(r) && (r._cachedIsBackward = null), r.dirty = !0)));
			}
		};
		function or(t, e, n) {
			return new nr(t, e, n);
		}
		function rr(t, e) {
			let n = e.__key, o = t.offset, r = "element";
			if (Xo(e)) {
				r = "text";
				const t = e.getTextContentSize();
				o > t && (o = t);
			} else if (!Pi(e)) {
				const t = e.getNextSibling();
				if (Xo(t)) n = t.__key, o = 0, r = "text";
				else {
					const t = e.getParent();
					t && (n = t.__key, o = e.getIndexWithinParent() + 1);
				}
			}
			t.set(n, o, r);
		}
		function ir(t, e) {
			if (Pi(e)) {
				const n = e.getLastDescendant();
				Pi(n) || Xo(n) ? rr(t, n) : rr(t, e);
			} else rr(t, e);
		}
		function sr(t, e, n, o) {
			const r = t.getNode(), i = r.getChildAtIndex(t.offset), s = Go();
			if (s.setFormat(n), s.setStyle(o), ns(i)) i.splice(0, 0, [s]);
			else if (null !== i) {
				const t = Bl(r) ? es().append(s) : s;
				i.insertBefore(t);
			} else if (Bl(r)) {
				const t = r.getLastChild();
				Pi(t) && !t.isInline() && t.isEmpty() ? t.append(s) : r.append(es().append(s));
			} else r.append(s);
			t.is(e) && e.set(s.__key, 0, "text"), t.set(s.__key, 0, "text");
		}
		function lr(e, n, o, r) {
			const i = e.anchor.getNode();
			Xo(i) || t(398);
			const s = e.anchor.offset, l = Go(n);
			l.setFormat(o), l.setStyle(r);
			const c = i.getParentOrThrow();
			if (0 === s) c.isInline() && !i.__prev ? c.insertBefore(l) : i.insertBefore(l, !1);
			else if (s === i.getTextContentSize()) c.isInline() && !i.__next ? c.insertAfter(l) : i.insertAfter(l, !1);
			else {
				const [t] = i.splitText(s);
				t.insertAfter(l, !1);
			}
			"" === i.getTextContent() && i.isAttached() && i.remove(), l.selectEnd(), l.isComposing() && "text" === e.anchor.type && e.anchor.set(e.anchor.key, e.anchor.offset - n.length, e.anchor.type);
		}
		var cr = class cr {
			_nodes;
			_cachedNodes;
			dirty;
			constructor(t) {
				this._cachedNodes = null, this._nodes = t, this.dirty = !1;
			}
			getCachedNodes() {
				return this._cachedNodes;
			}
			setCachedNodes(t) {
				this._cachedNodes = t;
			}
			is(t) {
				if (!dr(t)) return !1;
				const e = this._nodes, n = t._nodes;
				return e.size === n.size && Array.from(e).every((t) => n.has(t));
			}
			isCollapsed() {
				return !1;
			}
			isBackward() {
				return !1;
			}
			getStartEndPoints() {
				return null;
			}
			add(t) {
				this.dirty = !0, this._nodes.add(t), this._cachedNodes = null;
			}
			delete(t) {
				this.dirty = !0, this._nodes.delete(t), this._cachedNodes = null;
			}
			clear() {
				this.dirty = !0, this._nodes.clear(), this._cachedNodes = null;
			}
			has(t) {
				return this._nodes.has(t);
			}
			clone() {
				return new cr(new Set(this._nodes));
			}
			extract() {
				return this.getNodes();
			}
			insertRawText(t) {}
			insertText() {}
			insertNodes(t) {
				const e = this.getNodes().filter((t) => null === ta(t)), n = e.length;
				if (0 === n) return;
				const o = e[n - 1];
				let r;
				if (Xo(o)) r = o.select();
				else {
					const t = o.getIndexWithinParent() + 1;
					r = o.getParentOrThrow().select(t, t);
				}
				r.insertNodes(t);
				for (let t = 0; t < n; t++) e[t].remove();
			}
			getNodes() {
				const t = this._cachedNodes;
				if (null !== t) return t;
				const e = this._nodes, n = [];
				for (const t of e) {
					const e = Ys(t);
					null !== e && n.push(e);
				}
				return ui() || (this._cachedNodes = n), n;
			}
			getTextContent() {
				const t = this.getNodes();
				let e = "";
				for (let n = 0; n < t.length; n++) e += t[n].getTextContent();
				return e;
			}
			deleteNodes() {
				const t = this.getNodes().filter((t) => null === ta(t));
				if ((Kr() || zr()) === this && t[0]) {
					const e = Ia(t[0], "next");
					nu(Va(e, e));
				}
				for (const e of t) e.remove();
				ar();
			}
		};
		function ar() {
			const t = nl();
			if (t.isEmpty()) {
				const e = es();
				t.append(e), e.select();
			}
		}
		function ur(t) {
			return t instanceof fr;
		}
		var fr = class fr {
			format;
			style;
			anchor;
			focus;
			_cachedNodes;
			_cachedIsBackward;
			dirty;
			constructor(t, e, n, o) {
				this.anchor = t, this.focus = e, t._selection = this, e._selection = this, this._cachedNodes = null, this._cachedIsBackward = null, this.format = n, this.style = o, this.dirty = !1;
			}
			getCachedNodes() {
				return this._cachedNodes;
			}
			setCachedNodes(t) {
				this._cachedNodes = t;
			}
			is(t) {
				return !!ur(t) && this.anchor.is(t.anchor) && this.focus.is(t.focus) && this.format === t.format && this.style === t.style;
			}
			isCollapsed() {
				return this.anchor.is(this.focus);
			}
			getNodes() {
				const t = this._cachedNodes;
				if (null !== t) return t;
				const e = function(t) {
					const e = [], [n, o] = t.getTextSlices();
					n && e.push(n.caret.origin);
					const r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set();
					for (const n of t) if (Aa(n)) {
						const { origin: t } = n;
						0 === e.length ? r.add(t) : (i.add(t), e.push(t));
					} else {
						const { origin: t } = n;
						Pi(t) && i.has(t) || e.push(t);
					}
					o && e.push(o.caret.origin);
					if (Ma(t.focus) && Pi(t.focus.origin) && null === t.focus.getNodeAtCaret()) for (let n = Ba(t.focus.origin, "previous"); Aa(n) && r.has(n.origin) && !n.origin.isEmpty() && n.origin.is(e[e.length - 1]); n = Wa(n)) r.delete(n.origin), e.pop();
					for (; e.length > 1;) {
						const t = e[e.length - 1];
						if (!Pi(t) || i.has(t) || t.isEmpty() || r.has(t)) break;
						e.pop();
					}
					if (0 === e.length && t.isCollapsed()) {
						const n = au(t.anchor), o = au(t.anchor.getFlipped()), r = (t) => wa(t) ? t.origin : t.getNodeAtCaret(), i = r(n) || r(o) || (t.anchor.getNodeAtCaret() ? n.origin : o.origin);
						e.push(i);
					}
					return e;
				}(du(ru(this), "next"));
				return ui() || (this._cachedNodes = e), e;
			}
			setTextNodeRange(t, e, n, o) {
				return this.anchor.set(t.__key, e, "text"), this.focus.set(n.__key, o, "text"), this;
			}
			getTextContent() {
				const t = this.getNodes();
				if (0 === t.length) return "";
				const e = t[0], n = t[t.length - 1], o = this.anchor, r = this.focus, i = o.isBefore(r), [s, l] = yr(this);
				let c = "", a = !0;
				for (let u = 0; u < t.length; u++) {
					const f = t[u];
					if (Pi(f) && !f.isInline()) {
						a || (c += "\n");
						let t = "";
						for (const e of ia(f)) {
							const n = sa(f, e);
							null !== n && (t += n.getTextContent());
						}
						"" !== t ? (c += t, a = !1) : a = !f.isEmpty();
					} else if (a = !1, Xo(f)) {
						let t = f.getTextContent();
						f === e ? f === n ? "element" === o.type && "element" === r.type && r.offset !== o.offset || (t = s < l ? t.slice(s, l) : t.slice(l, s)) : t = i ? t.slice(s) : t.slice(l) : f === n && (t = i ? t.slice(0, l) : t.slice(0, s)), c += t;
					} else !Ki(f) && !Yi(f) || f === n && this.isCollapsed() || (c += f.getTextContent());
				}
				return c;
			}
			applyDOMRange(t) {
				const e = _i(), n = e.getEditorState()._selection, o = Mr(t.startContainer, t.startOffset, t.endContainer, t.endOffset, e, n);
				if (null === o) return;
				const [r, i, s] = o;
				this.anchor.set(r.key, r.offset, r.type, !0), this.focus.set(i.key, i.offset, i.type, !0), s && (this.dirty = !0), It(this);
			}
			clone() {
				const t = this.anchor, e = this.focus;
				return new fr(or(t.key, t.offset, t.type), or(e.key, e.offset, e.type), this.format, this.style);
			}
			toggleFormat(t) {
				this.format = Ws(this.format, t, null), this.dirty = !0;
			}
			setFormat(t) {
				this.format = t, this.dirty = !0;
			}
			setStyle(t) {
				this.style = t, this.dirty = !0;
			}
			hasFormat(t) {
				const e = z$1[t];
				return 0 !== (this.format & e);
			}
			insertRawText(t) {
				this.insertNodes(qr(t));
			}
			insertText(e) {
				let n = this.format, o = this.style;
				if (!this.isCollapsed()) {
					const t = (this.focus.isBefore(this.anchor) ? this.focus : this.anchor).getNode();
					if (Xo(t) && (n = t.getFormat(), o = t.getStyle()), this.removeText(), this.format = n, this.style = o, "" === e) return;
					if (null === qs()) return "element" === this.anchor.type && sr(this.anchor, this.focus, n, o), void lr(this, e, n, o);
				}
				"element" === this.anchor.type && sr(this.anchor, this.focus, n, o);
				const r = this.anchor.getNode();
				Xo(r) || t(398);
				const i = this.anchor.offset, s = r.getParentOrThrow(), l = r.getTextContentSize();
				if (Ks(r) || 0 === i && (!r.canInsertTextBefore() || !s.canInsertTextBefore() && !r.__prev) || i === l && (!r.canInsertTextAfter() || !s.canInsertTextAfter() && !r.__next)) {
					if (r.isSegmented() && 0 !== i && i !== l) {
						if (null !== qs()) r.setMode("normal").setFormat(n).setStyle(o);
						else {
							const t = Go(r.getTextContent());
							t.setFormat(n), t.setStyle(o), r.replace(t), t.select(i, i);
						}
						"" !== e && this.insertText(e);
						return;
					}
					if ("" === e) return;
					if (0 === i) {
						const t = r.getPreviousSibling();
						if (Xo(t) && t.canInsertTextAfter() && !Ks(t)) t.select();
						else {
							const t = Go();
							t.setFormat(n), t.setStyle(o), s.canInsertTextBefore() ? r.insertBefore(t) : s.insertBefore(t), t.select();
						}
						this.insertText(e);
						return;
					}
					if (i === l) {
						const t = r.getNextSibling();
						if (Xo(t) && t.canInsertTextBefore() && !Ks(t)) t.select(0, 0);
						else {
							const t = Go();
							t.setFormat(n), t.setStyle(o), s.canInsertTextAfter() ? r.insertAfter(t) : s.insertAfter(t), t.select(0, 0);
						}
						this.insertText(e);
						return;
					}
					const t = Go(e);
					t.setFormat(n), t.setStyle(o), r.replace(t), t.select();
					return;
				}
				if ("" === e) return;
				const c = s.isInline() && 0 === i && !r.__prev, a = s.isInline() && i === l && !r.__next, u = r.getFormat() !== n || r.getStyle() !== o;
				if (c || a || u) {
					if ("" !== r.getTextContent() || c || a) return void lr(this, e, n, o);
					r.setFormat(n), r.setStyle(o);
				}
				r.spliceText(i, 0, e, !0), r.isComposing() && "text" === this.anchor.type && this.anchor.set(this.anchor.key, this.anchor.offset - e.length, this.anchor.type);
			}
			removeText() {
				const t = Kr() === this;
				ou(this, cu(ru(this))), t && Kr() !== this && ol(this);
			}
			formatText(t, e = null) {
				_r(this, t, e);
			}
			insertNodes(e) {
				if (0 === e.length) return;
				this.isCollapsed() || this.removeText();
				const n = this.anchor.getNode();
				if ("element" === this.anchor.type && Pi(n) && null !== ta(n)) {
					let o = n.isShadowRoot() ? n.getFirstChild() ?? n.append(es()).getFirstChild() : n.getFirstChild();
					if (n.isShadowRoot() && null !== o && !Pi(o)) {
						const t = es();
						o.insertBefore(t), o = t;
					}
					if (null !== o) {
						o.selectStart();
						const n = Kr();
						return ur(n) || t(369), n.insertNodes(e);
					}
				}
				if ("element" === this.anchor.type && Bl(n)) {
					const t = ti(e), o = t.getLastDescendant();
					n.splice(this.anchor.offset, 0, t.getChildren()), null !== o && o.selectEnd();
					return;
				}
				let o = (this.isBackward() ? this.focus : this.anchor).getNode(), r = qc(o, Sc);
				const i = e[e.length - 1];
				if (Pi(r) && "__language" in r) {
					if ("__language" in e[0]) this.insertText(e[0].getTextContent());
					else {
						const t = Xr(this);
						r.splice(t, 0, e), i.selectEnd();
					}
					return;
				}
				if (!e.some((t) => (Pi(t) || Ki(t)) && !t.isInline())) {
					Pi(r) || t(211, o.constructor.name, o.getType());
					const n = Xr(this);
					r.splice(n, 0, e), i.selectEnd();
					return;
				}
export {};
