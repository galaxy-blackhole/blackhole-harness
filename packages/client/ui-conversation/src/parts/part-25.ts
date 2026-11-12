/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				return this.config(Symbol.for("ElementNode"), {
					$transform: Di,
					extends: _o
				});
			}
			constructor(t) {
				super(t), this.__first = null, this.__last = null, this.__size = 0, this.__format = 0, this.__style = "", this.__indent = 0, this.__dir = null, this.__textFormat = 0, this.__textStyle = "", this.__slotHost = null, this.__slots = null;
			}
			afterCloneFrom(e) {
				super.afterCloneFrom(e), this.__key === e.__key && (this.__first = e.__first, this.__last = e.__last, this.__size = e.__size, this.__slotHost = e.__slotHost, null !== this.__slotHost && null !== this.__parent && t(384, this.__key, String(this.__slotHost), String(this.__parent)), this.__slots = e.__slots), this.__indent = e.__indent, this.__format = e.__format, this.__style = e.__style, this.__dir = e.__dir, this.__textFormat = e.__textFormat, this.__textStyle = e.__textStyle;
			}
			getFormat() {
				return this.getLatest().__format;
			}
			getFormatType() {
				return W[this.getFormat()] || "";
			}
			getStyle() {
				return this.getLatest().__style;
			}
			getIndent() {
				return this.getLatest().__indent;
			}
			getChildren() {
				const t = [];
				let e = this.getFirstChild();
				for (; null !== e;) t.push(e), e = e.getNextSibling();
				return t;
			}
			getChildrenKeys() {
				const t = [];
				let e = this.getFirstChild();
				for (; null !== e;) t.push(e.__key), e = e.getNextSibling();
				return t;
			}
			getChildrenSize() {
				return this.getLatest().__size;
			}
			isEmpty() {
				return 0 === this.getChildrenSize() && 0 === ia(this).length;
			}
			isDirty() {
				const t = _i()._dirtyElements;
				return null !== t && t.has(this.__key);
			}
			isLastChild() {
				const t = this.getLatest(), e = this.getParentOrThrow().getLastChild();
				return null !== e && e.is(t);
			}
			getAllTextNodes() {
				const t = [];
				for (const e of ia(this)) {
					const n = sa(this, e);
					Pi(n) && t.push(...n.getAllTextNodes());
				}
				let e = this.getFirstChild();
				for (; null !== e;) {
					if (Xo(e) && t.push(e), Pi(e)) {
						const n = e.getAllTextNodes();
						t.push(...n);
					}
					e = e.getNextSibling();
				}
				return t;
			}
			getFirstDescendant() {
				let t = this.getFirstChild();
				for (; Pi(t);) {
					const e = t.getFirstChild();
					if (null === e) break;
					t = e;
				}
				return t;
			}
			getLastDescendant() {
				let t = this.getLastChild();
				for (; Pi(t);) {
					const e = t.getLastChild();
					if (null === e) break;
					t = e;
				}
				return t;
			}
			getDescendantByIndex(t) {
				const e = this.getChildren(), n = e.length;
				if (t >= n) {
					const t = e[n - 1];
					return Pi(t) && t.getLastDescendant() || t || null;
				}
				const o = e[t];
				return Pi(o) && o.getFirstDescendant() || o || null;
			}
			getFirstChild() {
				const t = this.getLatest().__first;
				return null === t ? null : Ys(t);
			}
			getFirstChildOrThrow() {
				const e = this.getFirstChild();
				return null === e && t(45, this.__key), e;
			}
			getLastChild() {
				const t = this.getLatest().__last;
				return null === t ? null : Ys(t);
			}
			getLastChildOrThrow() {
				const e = this.getLastChild();
				return null === e && t(96, this.__key), e;
			}
			getChildAtIndex(t) {
				const e = this.getChildrenSize();
				let n, o;
				if (t < e / 2) {
					for (n = this.getFirstChild(), o = 0; null !== n && o <= t;) {
						if (o === t) return n;
						n = n.getNextSibling(), o++;
					}
					return null;
				}
				for (n = this.getLastChild(), o = e - 1; null !== n && o >= t;) {
					if (o === t) return n;
					n = n.getPreviousSibling(), o--;
				}
				return null;
			}
			getTextContent() {
				let t = ha(this);
				const e = this.getChildren(), n = e.length;
				for (let o = 0; o < n; o++) {
					const r = e[o];
					t += r.getTextContent(), Pi(r) && o !== n - 1 && !r.isInline() && (t += D$1);
				}
				return t;
			}
			getTextContentSize() {
				let t = function(t) {
					let e = 0;
					for (const n of ia(t)) {
						const o = sa(t, n);
						null !== o && (e += o.getTextContentSize());
					}
					return e;
				}(this);
				const e = this.getChildren(), n = e.length;
				for (let o = 0; o < n; o++) {
					const r = e[o];
					t += r.getTextContentSize(), Pi(r) && o !== n - 1 && !r.isInline() && (t += 2);
				}
				return t;
			}
			getDirection() {
				return this.getLatest().__dir;
			}
			getTextFormat() {
				return this.getLatest().__textFormat;
			}
			hasFormat(t) {
				if ("" !== t) {
					const e = R$1[t];
					return 0 !== (this.getFormat() & e);
				}
				return !1;
			}
			hasTextFormat(t) {
				const e = z$1[t];
				return 0 !== (this.getTextFormat() & e);
			}
			getFormatFlags(t, e) {
				return Ws(this.getLatest().__textFormat, t, e);
			}
			getTextStyle() {
				return this.getLatest().__textStyle;
			}
			select(t, e) {
				fi();
				const n = Kr();
				let o = t, r = e;
				const i = this.getChildrenSize();
				if (!this.canBeEmpty()) {
					if (0 === t && 0 === e) {
						const t = this.getFirstChild();
						if (Xo(t) || Pi(t)) return t.select(0, 0);
					} else if (!(void 0 !== t && t !== i || void 0 !== e && e !== i)) {
						const t = this.getLastChild();
						if (Xo(t) || Pi(t)) return t.select();
					}
				}
				void 0 === o && (o = i), void 0 === r && (r = i);
				const s = this.__key;
				return ur(n) ? (n.anchor.set(s, o, "element"), n.focus.set(s, r, "element"), n.dirty = !0, n) : Dr(s, o, s, r, "element", "element");
			}
			selectStart() {
				const t = this.getFirstDescendant();
				return t ? t.selectStart() : this.select();
			}
			selectEnd() {
				const t = this.getLastDescendant();
				return t ? t.selectEnd() : this.select();
			}
			clear() {
				const t = this.getWritable();
				return this.getChildren().forEach((t) => t.remove()), t;
			}
			append(...t) {
				return this.splice(this.getChildrenSize(), 0, t);
			}
			setDirection(t) {
				const e = this.getWritable();
				return e.__dir = t, e;
			}
			setFormat(t) {
				return this.getWritable().__format = "" !== t && R$1[t] || 0, this;
			}
			setStyle(t) {
				return this.getWritable().__style = t || "", this;
			}
			setTextFormat(t) {
				const e = this.getWritable();
				return e.__textFormat = t, e;
			}
			setTextStyle(t) {
				const e = this.getWritable();
				return e.__textStyle = t, e;
			}
			setIndent(t) {
				return this.getWritable().__indent = t, this;
			}
			splice(e, n, o) {
				ho(this) && t(324, this.__key, this.__type);
				const r = this.getChildrenSize(), i = this.getWritable();
				e + n <= r || t(226, String(e), String(n), String(r));
				for (const t of o);
				const s = i.__key, l = [], c = [], a = this.getChildAtIndex(e + n);
				let u = null, f = r - n + o.length;
				if (0 !== e) if (e === r) u = this.getLastChild();
				else {
					const t = this.getChildAtIndex(e);
					null !== t && (u = t.getPreviousSibling());
				}
				if (n > 0) {
					let e = null === u ? this.getFirstChild() : u.getNextSibling();
					for (let o = 0; o < n; o++) {
						null === e && t(100);
						const n = e.getNextSibling(), o = e.__key;
						Hs(e.getWritable()), c.push(o), e = n;
					}
				}
				let d = u;
				for (const e of o) {
					null !== d && e.is(d) && (u = d = d.getPreviousSibling());
					const n = e.getWritable();
					n.__parent === s && f--, Hs(n);
					const o = e.__key;
					if (null === d) i.__first = o, n.__prev = null;
					else {
						const t = d.getWritable();
						t.__next = o, n.__prev = t.__key;
					}
					e.__key === s && t(76), n.__parent = s, l.push(o), d = e;
				}
				if (e + n === r) {
					if (null !== d) d.getWritable().__next = null, i.__last = d.__key;
				} else if (null !== a) {
					const t = a.getWritable();
					if (null !== d) {
						const e = d.getWritable();
						t.__prev = d.__key, e.__next = a.__key;
					} else t.__prev = null;
				}
				if (i.__size = f, c.length) {
					const t = Kr();
					if (ur(t)) {
						const e = new Set(c), n = new Set(l), { anchor: o, focus: r } = t;
						Ii(o, e, n) && Wr(o, o.getNode(), this, u, a), Ii(r, e, n) && Wr(r, r.getNode(), this, u, a), 0 !== f || this.canBeEmpty() || Bl(this) || this.remove();
					}
				}
				return i;
			}
			getDOMSlot(t) {
				return new G(t);
			}
			exportDOM(t) {
				const { element: e } = super.exportDOM(t);
				if (gc(e)) {
					const t = this.getIndent();
					t > 0 && (e.style.paddingInlineStart = 40 * t + "px", e.setAttribute("data-lexical-indent", String(t)));
					const n = this.getDirection();
					n && (e.dir = n);
				}
				return { element: e };
			}
			exportJSON() {
				const t = {
					children: [],
					direction: this.getDirection(),
					format: this.getFormatType(),
					indent: this.getIndent(),
					...super.exportJSON()
				}, e = this.getTextFormat(), n = this.getTextStyle();
				return 0 === e && "" === n || Bl(this) || this.getChildren().some(Xo) || (0 !== e && (t.textFormat = e), "" !== n && (t.textStyle = n)), t;
			}
			updateFromJSON(t) {
				return super.updateFromJSON(t).setFormat(t.format).setIndent(t.indent).setDirection(t.direction).setTextFormat(t.textFormat || 0).setTextStyle(t.textStyle || "");
			}
			insertNewAfter(t, e) {
				return null;
			}
			canIndent() {
				return !0;
			}
			collapseAtStart(t) {
				return !1;
			}
			excludeFromCopy(t) {
				return !1;
			}
			canReplaceWith(t) {
				return !0;
			}
			canInsertAfter(t) {
				return !0;
			}
			canBeEmpty() {
				return !0;
			}
			canInsertTextBefore() {
				return !0;
			}
			canInsertTextAfter() {
				return !0;
			}
			isInline() {
				return !1;
			}
			isShadowRoot() {
				return !1;
			}
			canMergeWith(t) {
				return !1;
			}
			extractWithChild(t, e, n) {
				return !1;
			}
			canMergeWhenEmpty() {
				return !1;
			}
			reconcileObservedMutation(t, e) {
				const n = kc(this, t, e);
				let o = n.getFirstChild();
				for (let t = this.getFirstChild(); t; t = t.getNextSibling()) {
					const r = e.getElementByKey(t.getKey());
					null !== r && (null == o ? (n.insertChild(r), o = r) : o !== r && n.replaceChild(r, o), o = o.nextSibling);
				}
			}
		};
		function Pi(t) {
			return t instanceof Fi;
		}
		function Ii(t, e, n) {
			let o = t.getNode();
			for (; o;) {
				const t = o.__key;
				if (e.has(t) && !n.has(t)) return !0;
				o = o.getParent();
			}
			return !1;
		}
		var Li = class extends _o {
			__slotHost;
			__slots;
			constructor(t) {
				super(t), this.__slotHost = null, this.__slots = null;
			}
			afterCloneFrom(e) {
				super.afterCloneFrom(e), this.__key === e.__key && (this.__slotHost = e.__slotHost, null !== this.__slotHost && null !== this.__parent && t(383, this.__key, String(this.__slotHost), String(this.__parent)), this.__slots = e.__slots);
			}
			decorate(t, e) {
				return null;
			}
			isIsolated() {
				return !1;
			}
			isInline() {
				return !0;
			}
			isKeyboardSelectable() {
				return !0;
			}
		};
		function Ki(t) {
			return t instanceof Li;
		}
		var zi = class extends Fi {
			__cachedText;
			$config() {
				return this.config("root", { extends: Fi });
			}
			constructor() {
				super("root"), this.__cachedText = null;
			}
			getTopLevelElementOrThrow() {
export {};
