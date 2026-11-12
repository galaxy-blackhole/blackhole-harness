/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		}
		function _c(t) {
			return "object" == typeof t && null !== t && "nodeType" in t && "number" == typeof t.nodeType;
		}
		function pc(t) {
			return _c(t) && 11 === t.nodeType;
		}
		const yc = /^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|mark|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var|#text)$/i;
		function mc(t) {
			return !(!gc(t) || !t.style.display.startsWith("inline")) || yc.test(t.nodeName);
		}
		const xc = /^(address|article|aside|blockquote|canvas|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|header|hr|li|main|nav|noscript|ol|p|pre|section|table|td|tfoot|ul|video)$/i;
		function Cc(t) {
			return (!gc(t) || !t.style.display.startsWith("inline")) && xc.test(t.nodeName);
		}
		function Sc(t) {
			if (Ki(t) && !t.isInline()) return !0;
			if (!Pi(t) || Bl(t)) return !1;
			const e = t.getFirstChild(), n = null === e || Yi(e) || Xo(e) || e.isInline();
			return !t.isInline() && !1 !== t.canBeEmpty() && n;
		}
		function vc() {
			return _i();
		}
		function Tc(t = vc()) {
			return t._config.dom || ps;
		}
		function kc(e, n, o = vc()) {
			const r = Tc(o).$getDOMSlot(e, n, o);
			return Pi(e) && (Ec(r) || t(344, e.getKey(), e.getType())), r;
		}
		function Ec(t) {
			return t instanceof G;
		}
		function wc(t, e, n = vc()) {
			return Rs(kc(t, e, n).element);
		}
		const Oc = /* @__PURE__ */ new WeakMap(), Mc = /* @__PURE__ */ new Map();
		function Ac(e) {
			if (!e._readOnly && e.isEmpty()) return Mc;
			e._readOnly || t(192);
			let n = Oc.get(e);
			return n || (n = function(t) {
				const e = /* @__PURE__ */ new Map();
				for (const [n, o] of t._nodeMap) {
					const t = o.__type;
					let r = e.get(t);
					r || (r = /* @__PURE__ */ new Map(), e.set(t, r)), r.set(n, o);
				}
				return e;
			}(e), Oc.set(e, n)), n;
		}
		function Dc(t) {
			const e = t.constructor.clone(t, Ts);
			return e.afterCloneFrom(t), e;
		}
		function Fc(t) {
			return (e = Dc(t))[fo] = !0, e;
			var e;
		}
		function Pc(t, e) {
			const n = t.getAttribute("data-lexical-indent");
			if (null !== n) {
				const t = parseInt(n, 10);
				if (Number.isFinite(t) && t >= 0) return void e.setIndent(t);
			}
			const o = parseInt(t.style.paddingInlineStart, 10) || 0, r = Math.round(o / 40);
			e.setIndent(r);
		}
		function Ic(t, e) {
			const n = e.getAttribute("dir");
			return "ltr" === n || "rtl" === n ? t.setDirection(n) : t;
		}
		function Lc(t, e) {
			const n = e.style.textAlign;
			return n && n in R$1 ? t.setFormat(n) : t;
		}
		function Kc(t, e) {
			t.__lexicalUnmanaged = !0, e && void 0 !== e.captureSelection && (t.__lexicalCapturedSelection = e.captureSelection);
		}
		function zc(t) {
			return !0 === t.__lexicalUnmanaged;
		}
		function Bc(t, e = vc()) {
			const n = e.isEditable();
			t.contentEditable = n ? "true" : "false", n ? t.__lexicalEditor = e : delete t.__lexicalEditor;
		}
		function Rc(t, e) {
			let n = t;
			for (; null != n;) {
				if (!0 === n.__lexicalCapturedSelection) return !0;
				if (gc(n) && n.hasAttribute("data-lexical-slot")) return !1;
				if (void 0 !== Qs(n, e)) return !1;
				n = wl(n);
			}
			return !1;
		}
		function Wc(t, e) {
			return function(t, e) {
				return Object.prototype.hasOwnProperty.call(t, e);
			}(t, e) && t[e] !== _o[e];
		}
		const $c = /* @__PURE__ */ new WeakMap(), Uc = Symbol("lexical.synthesizedGetType");
		function Hc(e) {
			const n = $c.get(e);
			if (n) return n;
			const o = null != e.prototype && j in e.prototype ? e.prototype[j]() : void 0, r = function(e) {
				if (!(e === _o || e.prototype instanceof _o)) {
					let n = "<unknown>", o = "<unknown>";
					try {
						n = e.getType();
					} catch (t) {}
					try {
						Cs.version && (o = JSON.parse(Cs.version));
					} catch (t) {}
					t(290, e.name, n, o);
				}
				return e === Li || e === Fi || e === _o;
			}(e), i = !r && Wc(e, "getType") ? e.getType : void 0, s = i && !(Uc in i) ? i.call(e) : void 0;
			let l, c = s;
			if (o) if (s) l = o[s];
			else {
				for (const [t, e] of Object.entries(o)) c = t, l = e;
				if (!l) for (const t of Object.getOwnPropertySymbols(o)) {
					const e = o[t];
					if (e) {
						l = e;
						break;
					}
				}
			}
			if (!r && c) {
				if (!Wc(e, "getType")) {
					const t = e, n = function() {
						return this !== t ? _o.getType.call(this) : c;
					};
					n[Uc] = !0, e.getType = n;
				}
				if (Wc(e, "clone") || (e.clone = (t, n) => {
					vs(t);
					const o = new e();
					return n !== Ts && o.afterCloneFrom(t), o;
				}), Wc(e, "importJSON") || (e.importJSON = l && l.$importJSON || ((t) => new e().updateFromJSON(t))), !Wc(e, "importDOM") && l) {
					const { importDOM: t } = l;
					t && (e.importDOM = () => t);
				}
			}
			const a = {
				klass: e,
				ownNodeConfig: l,
				ownNodeType: c
			};
			return $c.set(e, a), a;
		}
		function* jc(t) {
			for (let e = t; e && (e === _o || po(e.prototype));) {
				const t = Hc(e);
				yield t, e = t.ownNodeConfig && t.ownNodeConfig.extends || Gc(e);
			}
		}
		function Vc(t) {
			const e = vc();
			fi();
			return new (e.resolveRegisteredNodeAfterReplacements(e.getRegisteredNode(t))).klass();
		}
		const qc = (t, e) => {
			let n = t;
			for (; null != n && !Bi(n);) {
				if (e(n)) return n;
				n = n.getParent();
			}
			return null;
		};
		function Yc(e, n) {
			const o = [];
			let r = e.__first;
			for (; null !== r;) {
				const e = null === n ? Ys(r) : n.get(r);
				e ?? t(174), o.push(r), r = e.__next;
			}
			return o;
		}
		function Gc(t) {
			const e = Object.getPrototypeOf(t);
			if ("function" == typeof e && e !== Function.prototype) return e;
			const n = t.prototype && Object.getPrototypeOf(t.prototype);
			return n ? n.constructor : null;
		}
		const Xc = /* @__PURE__ */ new Map();
		function Qc(t) {
			return Pi(t) || Ki(t);
		}
		function Zc(t) {
			return Pi(t) || Ki(t);
		}
		function ta(t) {
			const e = t.getLatest();
			return Zc(e) ? e.__slotHost : null;
		}
		function ea(e) {
			const n = ta(e);
			if (null === n) return null;
			const o = Ys(n);
			return Pi(o) || Ki(o) || t(370), o;
		}
		function na(t) {
			const e = ea(t);
			if (null === e) return null;
			const n = t.getLatest().__key;
			for (const [t, o] of ra(e)) if (o === n) return t;
			return null;
		}
		function oa(t) {
			let e = t.getLatest();
			for (; null !== e;) {
				if (null !== ta(e)) return e;
				e = e.getParent();
			}
			return null;
		}
		function ra(t) {
			const e = t.getLatest();
			return Qc(e) && null !== e.__slots ? e.__slots : Xc;
		}
		function ia(t) {
			return Array.from(ra(t).keys());
		}
		function sa(t, e) {
			const n = ra(t).get(e);
			return void 0 === n ? null : Ys(n);
		}
		const la = [
			"__proto__",
			"constructor",
			"prototype"
		], ca = Symbol("slotMapOwner");
		function aa(t) {
			let e = t.__slots;
			return null !== e && e[ca] === t || (e = new Map(e), e[ca] = t, t.__slots = e), e;
		}
		const ua = /* @__PURE__ */ new WeakMap(), fa = [];
		function da(t) {
			for (const { ownNodeConfig: e } of jc(t)) {
				const t = e && e.slots;
				if (t) return t;
			}
			return fa;
		}
		function ha(t) {
			let e = "";
			for (const n of ia(t)) {
				const o = sa(t, n);
				null !== o && (e += o.getTextContent());
			}
			return e;
		}
		function ga(t, e, n) {
			const o = n.get(t), r = n.get(e);
			return void 0 !== o ? void 0 !== r ? o - r : -1 : void 0 !== r ? 1 : t < e ? -1 : t > e ? 1 : 0;
		}
		function _a(e) {
			const n = e.__slots;
			if (null === n || n.size < 2) return;
			const o = function(e) {
				let n = ua.get(e);
				if (void 0 === n) {
					const o = da(e), r = /* @__PURE__ */ new Map();
					for (const n of o) la.includes(n) && t(371, e.name, n), r.has(n) && t(372, e.name, n), r.set(n, r.size);
					n = r, ua.set(e, n);
				}
				return n;
			}(e.constructor);
			let r = null, i = !0;
			for (const t of n.keys()) {
				if (null !== r && ga(r, t, o) > 0) {
					i = !1;
					break;
				}
				r = t;
			}
			if (i) return;
			const s = Array.from(n).sort(([t], [e]) => ga(t, e, o));
			n.clear();
			for (const [t, e] of s) n.set(t, e);
		}
		function pa(e, n, o) {
			"__proto__" !== n && "constructor" !== n && "prototype" !== n || t(373, n);
			const r = e.getLatest();
			if (null !== r.__slots && r.__slots.get(n) === o.getLatest().__key) return r;
			(!Pi(o) && !Ki(o) || o.isInline()) && t(374, o.__key);
			const i = e.getWritable(), s = aa(i), l = s.get(n);
			void 0 !== l && xa(l);
			const c = o.getWritable(), a = ea(c);
			if (null !== a) {
				const t = na(c);
				null !== t && aa(a.getWritable()).delete(t), c.__slotHost = null;
			}
			return Hs(c), c.__slotHost = i.__key, s.set(n, c.__key), _a(i), function() {
				const t = vc();
				t._slotsUsed = !0, t._pendingEditorState && (t._pendingEditorState._slotsUsed = !0);
			}(), i;
		}
		function ya(t, e) {
			const n = t.getWritable();
			if (null === n.__slots) return n;
			const o = n.__slots.get(e);
			return void 0 !== o && (xa(o), aa(n).delete(e)), n;
		}
		function xa(e) {
			const n = Ys(e);
			if (null === n) return;
			const o = n.getWritable();
			Zc(o) || t(377, e), o.__slotHost = null, o.remove();
		}
		const Ca = {
			next: "previous",
			previous: "next"
		};
		var Sa = class {
			origin;
			constructor(t) {
				this.origin = t;
			}
			[Symbol.iterator]() {
				return qa({
					hasNext: Ma,
					initial: this.getAdjacentCaret(),
					map: (t) => t,
					step: (t) => t.getAdjacentCaret()
				});
			}
			getAdjacentCaret() {
				return Ia(this.getNodeAtCaret(), this.direction);
			}
			getSiblingCaret() {
				return Ia(this.origin, this.direction);
			}
			remove() {
				const t = this.getNodeAtCaret();
				return t && t.remove(), this;
			}
			replaceOrInsert(t, e) {
				const n = this.getNodeAtCaret();
				return t.is(this.origin) || t.is(n) || (null === n ? this.insert(t) : n.replace(t, e)), this;
			}
			splice(e, n, o = "next") {
				const r = o === this.direction ? n : Array.from(n).reverse();
				let i = this;
				const s = this.getParentAtCaret(), l = /* @__PURE__ */ new Map();
				for (let t = i.getAdjacentCaret(); null !== t && l.size < e; t = t.getAdjacentCaret()) {
					const e = t.origin.getWritable();
					l.set(e.getKey(), e);
				}
				for (const e of r) {
					if (l.size > 0) {
						const n = i.getNodeAtCaret();
						if (n) if (l.delete(n.getKey()), l.delete(e.getKey()), n.is(e) || i.origin.is(e));
						else {
							const t = e.getParent();
							t && t.is(s) && e.remove(), n.replace(e);
						}
						else null === n && t(263, Array.from(l).join(" "));
					} else i.insert(e);
					i = Ia(e, this.direction);
				}
				for (const t of l.values()) t.remove();
				return this;
			}
		};
		var va = class va extends Sa {
			type = "child";
			getLatest() {
				const t = this.origin.getLatest();
				return t === this.origin ? this : Ba(t, this.direction);
			}
			getParentCaret(t = "root") {
				return Ia(ba(this.getParentAtCaret(), t), this.direction);
			}
			getFlipped() {
				const t = ka(this.direction);
				return Ia(this.getNodeAtCaret(), t) || Ba(this.origin, t);
			}
			getParentAtCaret() {
				return this.origin;
			}
			getChildCaret() {
				return this;
			}
			isSameNodeCaret(t) {
				return t instanceof va && this.direction === t.direction && this.origin.is(t.origin);
			}
			isSamePointCaret(t) {
				return this.isSameNodeCaret(t);
			}
		};
		const Ta = {
			root: Bi,
			shadowRoot: Bl
		};
		function ka(t) {
export {};
