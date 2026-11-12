/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				let n = e.getParent();
				for (e.remove(!0); n && n.isEmpty();) {
					const t = n;
					n = n.getParent(), t.remove(!0);
				}
			} else if (h) {
				const t = function(t) {
					if (Aa(t)) {
						const e = t.origin;
						if (Sc(e)) return e;
					} else {
						const e = t.getParentAtCaret();
						if (e && Sc(e)) return e;
					}
					return null;
				}(h), e = t && t.getParent(), n = t && t.getParents().findLast(zl);
				if (t && e && !Bi(e) && t.isEmpty() && a.has(t.getKey()) && 0 === ia(t).length && (!n || a.has(n.getKey()))) {
					t.remove(!0);
					let n = e;
					for (; n && !Bi(n) && n.isEmpty();) {
						const t = n.getParent();
						if (t && Bi(t) && t.getChildrenSize() <= 1) break;
						const e = n;
						n = t, e.remove(!0);
					}
				}
			}
			const _ = [
				d,
				h,
				...l,
				...c
			].find(lu);
			if (_) return Ja(fu(au(_), e.direction));
			t(269, JSON.stringify(l.map((t) => t.origin.__key)));
		}
		function au(t) {
			const e = function(t) {
				let e = t;
				for (; Aa(e);) {
					const t = Wa(e);
					if (!Aa(t)) break;
					e = t;
				}
				return e;
			}(t.getLatest()), { direction: n } = e;
			if (Xo(e.origin)) return wa(e) ? e : La(e.origin, n, n);
			const o = e.getAdjacentCaret();
			return Ma(o) && Xo(o.origin) ? La(o.origin, n, ka(n)) : e;
		}
		function uu(t) {
			return wa(t) && t.offset !== Ka(t.origin, t.direction);
		}
		function fu(t, e) {
			return t.direction === e ? t : t.getFlipped();
		}
		function du(t, e) {
			return t.direction === e ? t : Va(fu(t.focus, e), fu(t.anchor, e));
		}
		function hu(t, e, n) {
			let o = Ba(t, "next");
			for (let t = 0; t < e; t++) {
				const t = o.getAdjacentCaret();
				if (null === t) break;
				o = t;
			}
			return fu(o, n);
		}
		function _u(e) {
			const { origin: n, offset: o, direction: r } = e;
			if (o === Ka(n, r)) return e.getSiblingCaret();
			if (o === Ka(n, ka(r))) return iu(e.getSiblingCaret());
			const [i] = n.splitText(o);
			return Xo(i) || t(281), fu(Ia(i, "next"), r);
		}
		function pu(t, e) {
			return !0;
		}
		function yu(t, { $copyElementNode: e = Rl, $splitTextPointCaretNext: n = _u, rootMode: o = "shadowRoot", $shouldSplit: r = pu, removeEmptyDestination: i = !1 } = {}) {
			if (wa(t)) return n(t);
			const s = t.getParentCaret(o);
			if (s) {
				const { origin: n } = s;
				if (Aa(t)) {
					const t = iu(s);
					if (i && n.isEmpty()) return n.remove(), t;
					if (!n.canBeEmpty() || !r(n, "first")) return t;
				}
				const o = function(t) {
					const e = [];
					for (let n = t.getAdjacentCaret(); n; n = n.getAdjacentCaret()) e.push(n.origin);
					return e;
				}(t);
				(o.length > 0 || !i && n.canBeEmpty() && r(n, "last")) && s.insert(e(n).splice(0, 0, o));
			}
			return s;
		}
		function mu(e, n, o) {
			let r = fu(n, "next");
			wa(r) && (0 === r.offset ? r = Ia(r.origin, "previous").getFlipped() : r.offset === r.origin.getTextContentSize() && (r = Ia(r.origin, "next"))), r.origin.is(e) && (Ma(r) || t(342, e.getKey(), e.getType()), r = iu(r)), (e.is(r.getNodeAtCaret()) || e.is(r.getFlipped().getNodeAtCaret())) && e.remove(!0);
			for (let t = r; t; t = yu(t, o)) r = t;
			return wa(r) && t(283), r.insert(e.isInline() ? es().append(e) : e), fu(Ia(e.getLatest(), "next"), n.direction);
		}
		function xu(t) {
			return t;
		}
		function vu(t) {
			return t;
		}
		function Tu(t, e) {
			if (!e || t === e) return t;
			for (const n in e) if (t[n] !== e[n]) return {
				...t,
				...e
			};
			return t;
		}
		function ku(...t) {
			const e = [];
			for (const n of t) if (n && "string" == typeof n) for (const [t] of n.matchAll(/\S+/g)) e.push(t);
			return e;
		}
		function bu(t, ...e) {
			const n = ku(...e);
			n.length > 0 && t.classList.add(...n);
		}
		function Eu(...t) {
			return () => {
				for (let e = t.length - 1; e >= 0; e--) t[e]();
				t.length = 0;
			};
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/@lexical+selection@0.49.0_typescript@6.0.3/node_modules/@lexical/selection/dist/LexicalSelection.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		function R(e) {
			const t = vc().getElementByKey(e.getKey());
			if (null === t) return null;
			const o = t.ownerDocument.defaultView;
			return null === o ? null : o.getComputedStyle(t);
		}
		function O$2(e) {
			return R(Bi(e) ? e : e.getParentOrThrow());
		}
		function L(e, t, n = "self") {
			const o = e.getStartEndPoints();
			if (t.isSelected(e) && !Ks(t) && null !== o) {
				const [l, r] = o, i = e.isBackward(), s = l.getNode(), c = r.getNode(), g = t.is(s), a = t.is(c);
				if (g || a) {
					const [o, l] = yr(e), r = s.is(c), g = t.is(i ? c : s), a = t.is(i ? s : c);
					let d, p = 0;
					if (r) p = o > l ? l : o, d = o > l ? o : l;
					else if (g) p = i ? l : o, d = void 0;
					else if (a) p = 0, d = i ? o : l;
					const h = t.__text.slice(p, d);
					h !== t.__text && ("clone" === n && (t = Fc(t)), t.__text = h);
				}
			}
			return t;
		}
		function Z(e) {
			const t = ee$2(e);
			return null !== t && "vertical-rl" === t.writingMode;
		}
		function ee$2(e) {
			const t = e.anchor.getNode();
			return Pi(t) ? R(t) : O$2(t);
		}
		function te$2(e, n) {
			let o = Z(e) ? !n : n;
			oe$2(e) && (o = !o);
			const l = tu(e.focus, o ? "previous" : "next");
			if (uu(l)) return !1;
			if (wa(l) && !er(l.origin) && l.origin.isUnmergeable()) {
				const e = l.getNodeAtCaret();
				if (Xo(e) && !er(e)) return !0;
			}
			for (const e of ja(l)) {
				if (Aa(e)) return !e.origin.isInline();
				if (!Pi(e.origin)) {
					if (Ki(e.origin)) return !0;
					break;
				}
			}
			return !1;
		}
		function ne$2(e, t, n, o) {
			e.modify(t ? "extend" : "move", n, o);
		}
		function oe$2(e) {
			const t = ee$2(e);
			return null !== t && "rtl" === t.direction;
		}
		function le$1(e, t, n) {
			const o = oe$2(e);
			let l;
			l = Z(e) || o ? !n : n, ne$2(e, t, l, "character");
		}
		function Mt(t, e) {
			return null !== t && Object.getPrototypeOf(t).constructor.name === e.name;
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/@lexical+extension@0.49.0_typescript@6.0.3/node_modules/@lexical/extension/dist/LexicalExtension.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		const Kt$1 = Symbol.for("preact-signals");
		function $t$1() {
			if (Bt$1 > 1) return void Bt$1--;
			let t, e = !1;
			for (function() {
				let t = Wt$1;
				for (Wt$1 = void 0; void 0 !== t;) t.S.v === t.v && (t.S.i = t.i), t = t.o;
			}(); void 0 !== zt$1;) {
				let n = zt$1;
				for (zt$1 = void 0, Vt$1++; void 0 !== n;) {
					const i = n.u;
					if (n.u = void 0, n.f &= -3, !(8 & n.f) && qt$1(n)) try {
						n.c();
					} catch (n) {
						e || (t = n, e = !0);
					}
					n = i;
				}
			}
			if (Vt$1 = 0, Bt$1--, e) throw t;
		}
		let Tt$1, zt$1;
		function Ut$1(t) {
			const e = Tt$1;
			Tt$1 = void 0;
			try {
				return t();
			} finally {
				Tt$1 = e;
			}
		}
		let Wt$1, Bt$1 = 0, Vt$1 = 0, Zt$1 = 0, Ht$1 = 0;
		function Jt$1(t) {
			if (void 0 === Tt$1) return;
			let e = t.n;
			return void 0 === e || e.t !== Tt$1 ? (e = {
				i: 0,
				S: t,
				p: Tt$1.s,
				n: void 0,
				t: Tt$1,
				e: void 0,
				x: void 0,
				r: e
			}, void 0 !== Tt$1.s && (Tt$1.s.n = e), Tt$1.s = e, t.n = e, 32 & Tt$1.f && t.S(e), e) : -1 === e.i ? (e.i = 0, void 0 !== e.n && (e.n.p = e.p, void 0 !== e.p && (e.p.n = e.n), e.p = Tt$1.s, e.n = void 0, Tt$1.s.n = e, Tt$1.s = e), e) : void 0;
		}
		function Xt$1(t, e) {
			this.v = t, this.i = 0, this.n = void 0, this.t = void 0, this.l = 0, this.W = null == e ? void 0 : e.watched, this.Z = null == e ? void 0 : e.unwatched, this.name = null == e ? void 0 : e.name;
		}
		function qt$1(t) {
			for (let e = t.s; void 0 !== e; e = e.n) if (e.S.i !== e.i || !e.S.h() || e.S.i !== e.i) return !0;
			return !1;
		}
		function Qt$1(t) {
			for (let e = t.s; void 0 !== e; e = e.n) {
				const n = e.S.n;
				if (void 0 !== n && (e.r = n), e.S.n = e, e.i = -1, void 0 === e.n) {
					t.s = e;
					break;
				}
			}
		}
		function te$1(t) {
			let e, n = t.s;
			for (; void 0 !== n;) {
				const t = n.p;
				-1 === n.i ? (n.S.U(n), void 0 !== t && (t.n = n.n), void 0 !== n.n && (n.n.p = t)) : e = n, n.S.n = n.r, void 0 !== n.r && (n.r = void 0), n = t;
			}
			t.s = e;
		}
		function ee$1(t, e) {
			Xt$1.call(this, void 0), this.x = t, this.s = void 0, this.g = Ht$1 - 1, this.f = 4, this.W = null == e ? void 0 : e.watched, this.Z = null == e ? void 0 : e.unwatched, this.name = null == e ? void 0 : e.name;
		}
		function ie$1(t) {
			const e = t.m;
			if (t.m = void 0, "function" == typeof e) {
				Bt$1++;
				const n = Tt$1;
				Tt$1 = void 0;
				try {
					e();
				} catch (e) {
					throw t.f &= -2, t.f |= 8, oe$1(t), e;
				} finally {
					Tt$1 = n, $t$1();
				}
			}
		}
		function oe$1(t) {
			for (let e = t.s; void 0 !== e; e = e.n) e.S.U(e);
			t.x = void 0, t.s = void 0, ie$1(t);
		}
		function se$1(t) {
			if (Tt$1 !== this) throw new Error("Out-of-order effect");
			te$1(this), Tt$1 = t, this.f &= -2, 8 & this.f && oe$1(this), $t$1();
		}
		function re$1(t, e) {
			this.x = t, this.m = void 0, this.s = void 0, this.u = void 0, this.f = 32, this.name = null == e ? void 0 : e.name;
		}
		function ce$1(t, e) {
			const n = new re$1(t, e);
			try {
				n.c();
			} catch (t) {
				throw n.d(), t;
			}
			const i = n.d.bind(n);
			return i[Symbol.dispose] = i, i;
		}
		Xt$1.prototype.brand = Kt$1, Xt$1.prototype.h = function() {
			return !0;
		}, Xt$1.prototype.S = function(t) {
			const e = this.t;
			e !== t && void 0 === t.e && (t.x = e, this.t = t, void 0 !== e ? e.e = t : Ut$1(() => {
				var t;
				null == (t = this.W) || t.call(this);
			}));
		}, Xt$1.prototype.U = function(t) {
			if (void 0 !== this.t) {
				const e = t.e, n = t.x;
				void 0 !== e && (e.x = n, t.e = void 0), void 0 !== n && (n.e = e, t.x = void 0), t === this.t && (this.t = n, void 0 === n && Ut$1(() => {
					var t;
					null == (t = this.Z) || t.call(this);
				}));
			}
		}, Xt$1.prototype.subscribe = function(t) {
			return ce$1(() => {
				const e = this.value, n = Tt$1;
				Tt$1 = void 0;
				try {
					t(e);
				} finally {
					Tt$1 = n;
				}
			}, { name: "sub" });
		}, Xt$1.prototype.valueOf = function() {
			return this.value;
		}, Xt$1.prototype.toString = function() {
			return this.value + "";
		}, Xt$1.prototype.toJSON = function() {
			return this.value;
		}, Xt$1.prototype.peek = function() {
			const t = Tt$1;
			Tt$1 = void 0;
			try {
				return this.value;
			} finally {
				Tt$1 = t;
			}
		}, Object.defineProperty(Xt$1.prototype, "value", {
			get() {
				const t = Jt$1(this);
				return void 0 !== t && (t.i = this.i), this.v;
			},
			set(t) {
				if (t !== this.v) {
					if (Vt$1 > 100) throw new Error("Cycle detected");
					(function(t) {
						0 !== Bt$1 && 0 === Vt$1 && t.l !== Zt$1 && (t.l = Zt$1, Wt$1 = {
							S: t,
							v: t.v,
							i: t.i,
							o: Wt$1
						});
					})(this), this.v = t, this.i++, Ht$1++, Bt$1++;
					try {
						for (let t = this.t; void 0 !== t; t = t.x) t.t.N();
					} finally {
						$t$1();
					}
				}
			}
		}), ee$1.prototype = new Xt$1(), ee$1.prototype.h = function() {
			if (this.f &= -3, 1 & this.f) return !1;
			if (32 == (36 & this.f)) return !0;
			if (this.f &= -5, this.g === Ht$1) return !0;
			if (this.g = Ht$1, this.f |= 1, this.i > 0 && !qt$1(this)) return this.f &= -2, !0;
			const t = Tt$1;
			try {
				Qt$1(this), Tt$1 = this;
				const t = this.x();
				(16 & this.f || this.v !== t || 0 === this.i) && (this.v = t, this.f &= -17, this.i++);
			} catch (t) {
				this.v = t, this.f |= 16, this.i++;
export {};
