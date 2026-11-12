/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		}
		function ol(t) {
			fi();
			const e = hi();
			null !== t && (t.dirty = !0, t.setCachedNodes(null), ur(t) && _i()._slotsUsed && Or(t)), e._selection = t;
		}
		function rl() {
			fi();
			ht$2(_i());
		}
		function il(t) {
			const e = function(t, e) {
				let n = t;
				for (; null != n;) {
					const t = Qs(n, e);
					if (void 0 !== t) return t;
					n = wl(n);
				}
				return null;
			}(t, _i());
			return null === e ? null : Ys(e);
		}
		function sl(t) {
			return /[\uD800-\uDBFF][\uDC00-\uDFFF]/g.test(t);
		}
		function ll(t) {
			const e = [];
			for (let n = t; null !== n; n = n._parentEditor) e.push(n);
			return e;
		}
		function cl() {
			return Math.random().toString(36).replace(/[^a-z]+/g, "").substring(0, 5);
		}
		function al(t) {
			return zs(t) ? t.nodeValue : null;
		}
		function ul(t, e, n) {
			const o = Jl(Il(e));
			if (null === o) return;
			const r = nc(o, e._rootElement), i = r.anchorNode;
			let { anchorOffset: s, focusOffset: l } = r;
			if (null !== i) {
				let e = al(i);
				const o = Zs(i);
				if (null !== e && Xo(o)) {
					if ((e === A || e === F) && n) {
						const t = n.length;
						e = n, s = t, l = t;
					}
					null !== e && fl(o, e, s, l, t);
				}
			}
		}
		function fl(t, e, n, o, r) {
			let i = t;
			if (i.isAttached() && (r || !i.isDirty())) {
				const s = i.isComposing();
				if (i.isToken() && s) return;
				let c = e;
				if ((s || r) && (e.endsWith(A) && (c = e.slice(0, -A.length)), r)) {
					const t = F;
					let e;
					for (; -1 !== (e = c.indexOf(t));) c = c.slice(0, e) + c.slice(e + t.length), null !== n && n > e && (n = Math.max(e, n - t.length)), null !== o && o > e && (o = Math.max(e, o - t.length));
				}
				const u = i.getTextContent();
				if (r || c !== u) {
					const e = Kr();
					if ("" === c) {
						if (Vs(null), a || l || d$1) i.remove();
						else {
							const t = _i();
							dl(i, "", e), setTimeout(() => {
								t.update(() => {
									i.isAttached() && "" === i.getTextContent() && i.remove();
								});
							}, 20);
						}
						return;
					}
					const r = i.getParent(), u = zr(), f = i.getTextContentSize(), h = qs(), g = i.getKey();
					if (i.isToken() && !s || null !== h && g === h && !s || ur(u) && (null !== r && !r.canInsertTextBefore() && 0 === u.anchor.offset || u.anchor.key === t.__key && 0 === u.anchor.offset && !i.canInsertTextBefore() && !s || u.focus.key === t.__key && u.focus.offset === f && !i.canInsertTextAfter() && !s)) return void i.markDirty();
					if (!ur(e) || null === n || null === o) return void dl(i, c, e);
					if (e.setTextNodeRange(i, n, i, o), i.isSegmented()) {
						const t = Go(i.getTextContent());
						i.replace(t), i = t;
					}
					dl(i, c, e);
				}
			}
		}
		function dl(t, e, n) {
			if (t.setTextContent(e), ur(n)) {
				const e = t.getKey();
				let o = !1;
				for (const r of ["anchor", "focus"]) {
					const i = n[r];
					"text" === i.type && i.key === e && (i.offset = Ka(t, i.offset, "clamp"), o = !0);
				}
				o && (n._cachedNodes = null, n._cachedIsBackward = null);
			}
		}
		function hl(t, e, n) {
			const o = e[n] || !1;
			return "any" === o || o === t[n];
		}
		function gl(t, e) {
			return hl(t, e, "altKey") && hl(t, e, "ctrlKey") && hl(t, e, "shiftKey") && hl(t, e, "metaKey");
		}
		function _l(t, e, n) {
			if (!gl(t, n)) return !1;
			if (t.key.toLowerCase() === e.toLowerCase()) return !0;
			if (e.length > 1) return !1;
			if (1 === t.key.length && t.key.charCodeAt(0) <= 127) return !1;
			if (t.code.startsWith("Digit") && /^\d$/.test(e)) return t.code === `Digit${e}`;
			const o = "Key" + e.toUpperCase();
			return t.code === o;
		}
		const pl = {
			ctrlKey: !r$1,
			metaKey: r$1
		}, yl = {
			altKey: r$1,
			ctrlKey: !r$1
		};
		function ml(t) {
			return "Backspace" === t.key;
		}
		function xl(t) {
			const e = nl();
			if (ur(t)) {
				const e = t.anchor, n = t.focus, o = e.getNode();
				if (Bi(o)) return e.set(o.getKey(), 0, "element"), n.set(o.getKey(), o.getChildrenSize(), "element"), It(t), t;
				const r = o.getTopLevelElementOrThrow(), i = r.getParent();
				if (null === i) return Pi(r) && (e.set(r.getKey(), 0, "element"), n.set(r.getKey(), r.getChildrenSize(), "element"), It(t)), t;
				const s = i;
				return e.set(s.getKey(), 0, "element"), n.set(s.getKey(), s.getChildrenSize(), "element"), It(t), t;
			}
			{
				const t = e.select(0, e.getChildrenSize());
				return ol(It(t)), t;
			}
		}
		function Cl(t, e) {
			void 0 === t.__lexicalClassNameCache && (t.__lexicalClassNameCache = {});
			const n = t.__lexicalClassNameCache, o = n[e];
			if (void 0 !== o) return o;
			const r = t[e];
			if ("string" == typeof r) {
				const t = ku(r);
				return n[e] = t, t;
			}
			return r;
		}
		function Sl(e, n, o, r, i) {
			if (0 === o.size) return;
			const s = r.__type, l = r.__key, c = n.get(s);
			void 0 === c && t(33, s);
			const a = c.klass;
			let u = e.get(a);
			void 0 === u && (u = /* @__PURE__ */ new Map(), e.set(a, u));
			const f = u.get(l), d = "destroyed" === f && "created" === i;
			(void 0 === f || d) && u.set(l, d ? "updated" : i);
		}
		function Tl(t, e, n) {
			const o = t.getParent();
			let r = n, i = t;
			return null !== o && (e && 0 === n ? (r = i.getIndexWithinParent(), i = o) : e || n !== i.getChildrenSize() || (r = i.getIndexWithinParent() + 1, i = o)), i.getChildAtIndex(e ? r - 1 : r);
		}
		function kl(t, e) {
			const n = t.offset;
			if ("element" === t.type) return Tl(t.getNode(), e, n);
			{
				const o = t.getNode();
				if (e && 0 === n || !e && n === o.getTextContentSize()) {
					const t = e ? o.getPreviousSibling() : o.getNextSibling();
					return null === t ? Tl(o.getParentOrThrow(), e, o.getIndexWithinParent() + (e ? 0 : 1)) : t;
				}
			}
			return null;
		}
		function bl(t) {
			const e = Il(t).event, n = e && e.inputType;
			return "insertFromPaste" === n || "insertFromPasteAsQuotation" === n;
		}
		function Nl(t, e, ...n) {
			return Ei(t, e, n[0], t);
		}
		function El(e, n) {
			const o = e._keyToDOMMap.get(n);
			return void 0 === o && t(75, n), o;
		}
		function wl(t) {
			const e = t.assignedSlot || t.parentElement;
			if (null !== e) return e;
			const n = t.parentNode;
			return ql(n) ? n.host : null;
		}
		function Ol(t) {
			return Bs(t) ? t : gc(t) ? t.ownerDocument : null;
		}
		function Al(t) {
			fi();
			_i()._updateTags.add(t);
		}
		function Dl(t) {
			fi();
			_i()._deferred.push(t);
		}
		function Fl(t, e) {
			let n = t.getParent();
			for (; null !== n;) {
				if (n.is(e)) return !0;
				n = n.getParent();
			}
			return !1;
		}
		function Pl(t) {
			const e = Ol(t);
			return e ? e.defaultView : null;
		}
		function Il(e) {
			const n = e._window;
			return null === n && t(78), n;
		}
		function Ll(t) {
			return Pi(t) && t.isInline() || Ki(t) && t.isInline();
		}
		function Kl(t) {
			let e = t.getLatest();
			for (; null !== e;) {
				if (null !== ta(e) && Pi(e)) return e;
				const t = e.getParentOrThrow();
				if (Bl(t)) return t;
				e = t;
			}
			return e;
		}
		function zl(t) {
			return Pi(t) && t.isShadowRoot();
		}
		function Bl(t) {
			return Bi(t) || zl(t);
		}
		function Rl(t, e = !1) {
			const n = t.constructor.clone(t, Ts);
			return Us(n, null), n.afterCloneFrom(t), e || n.resetOnCopyNodeFrom(t), n;
		}
		function Wl(e) {
			const n = _i(), o = e.getType(), r = Es(n, o);
			void 0 === r && t(200, e.constructor.name, o);
			const { replace: i, replaceWithKlass: s } = r;
			if (null !== i) {
				const n = i(e), r = n.constructor;
				return null !== s ? n instanceof s || t(201, s.name, s.getType(), r.name, r.getType(), e.constructor.name, o) : n instanceof e.constructor && r !== e.constructor || t(202, r.name, r.getType(), e.constructor.name, o), n.__key === e.__key && t(203, e.constructor.name, o, r.name, r.getType()), n;
			}
			return e;
		}
		function $l(e, n) {
			!Bi(e.getParent()) || Pi(n) || Ki(n) || t(99);
		}
		function Ul(e) {
			const n = Ys(e);
			return null === n && t(63, e), n;
		}
		function Hl(t) {
			if (!t || t.isInline()) return !1;
			if (Ki(t)) return !0;
			if (Pi(t)) {
				if (t.isShadowRoot()) {
					const e = t.getParent();
					return !(Pi(e) && e.isShadowRoot());
				}
				return !t.canBeEmpty();
			}
			return !1;
		}
		function jl(t, e, n) {
			n.style.removeProperty("caret-color"), e._blockCursorElement = null;
			const o = t.parentElement;
			null !== o && o.removeChild(t);
		}
		function Jl(t) {
			return n ? (t || window).getSelection() : null;
		}
		function Vl(t) {
			const e = Pl(t);
			return e ? e.getSelection() : null;
		}
		function ql(t) {
			return pc(t) && "host" in t;
		}
		const Yl = [];
		function Gl(t) {
			const e = t.getRootNode();
			if (e === t || !ql(e)) return Yl;
			const n = [e];
			let o = e.host;
			for (;;) {
				const t = o.getRootNode();
				if (t === o || !ql(t)) break;
				n.push(t), o = t.host;
			}
			return n;
		}
		function* Xl(t) {
			const e = [t];
			let n;
			for (; n = e.pop();) {
				yield* n.querySelectorAll("[data-lexical-editor=\"true\"]");
				const t = (Bs(n) ? n : n.ownerDocument).createTreeWalker(n, NodeFilter.SHOW_ELEMENT);
				let o;
				for (; o = t.nextNode();) o.shadowRoot && e.push(o.shadowRoot);
			}
		}
		function Ql(t) {
			return null !== t ? t.ownerDocument : document;
		}
		function Zl() {
			const t = mi();
			return Ql(null !== t ? t._rootElement : null);
		}
		function tc(t, e) {
			if (null === e || "function" != typeof t.getComposedRanges) return null;
			const n = Gl(e);
			if (0 === n.length) return null;
			const o = t.getComposedRanges;
			try {
				const e = o.call(t, { shadowRoots: n })[0];
				if (void 0 !== e) return e;
			} catch (t) {}
			try {
				const e = o.apply(t, n)[0];
				if (void 0 !== e) return e;
			} catch (t) {}
			return null;
		}
		function ec(t, e) {
			const n = tc(t, e);
			if (null !== n) {
				const t = rc(n);
				if (null !== t) return t;
			}
			return t.rangeCount > 0 ? t.getRangeAt(0) : null;
		}
		function nc(t, e) {
			const n = tc(t, e);
			return null === n ? t : ic(n, sc(t));
		}
		function rc(t) {
			const e = t.startContainer.ownerDocument;
			if (null === e) return null;
			const n = e.createRange();
			try {
				return n.setStart(t.startContainer, t.startOffset), n.setEnd(t.endContainer, t.endOffset), n;
			} catch (t) {
				return null;
			}
		}
		function ic(t, e) {
			const { startContainer: n, startOffset: o, endContainer: r, endOffset: i } = t;
			return "backward" === e ? {
				anchorNode: r,
				anchorOffset: i,
				direction: e,
				focusNode: n,
				focusOffset: o
			} : {
				anchorNode: n,
				anchorOffset: o,
				direction: e,
				focusNode: r,
				focusOffset: i
			};
		}
		function sc(t) {
			return t.direction;
		}
		function lc(t) {
			const e = t.getRootNode();
			return Bs(e) || ql(e) ? e.activeElement : null;
		}
		function cc(t) {
			let e = t.activeElement;
			for (; null !== e && null !== e.shadowRoot;) {
				const t = e.shadowRoot.activeElement;
				if (null === t) break;
				e = t;
			}
			return e;
		}
		function ac(t) {
			const e = t.target;
			if (null !== e && gc(e) && null !== e.shadowRoot && "function" == typeof t.composedPath) {
				const e = t.composedPath();
				if (e.length > 0) return e[0];
			}
			return e;
		}
		function gc(t) {
			return _c(t) && 1 === t.nodeType;
export {};
