/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				return this.config("text", { importDOM: {
					"#text": () => ({
						conversion: Jo,
						priority: 0
					}),
					b: () => ({
						conversion: Uo,
						priority: 0
					}),
					code: () => ({
						conversion: Yo,
						priority: 0
					}),
					em: () => ({
						conversion: Yo,
						priority: 0
					}),
					i: () => ({
						conversion: Yo,
						priority: 0
					}),
					mark: () => ({
						conversion: Yo,
						priority: 0
					}),
					s: () => ({
						conversion: Yo,
						priority: 0
					}),
					span: () => ({
						conversion: $o,
						priority: 0
					}),
					strong: () => ({
						conversion: Yo,
						priority: 0
					}),
					sub: () => ({
						conversion: Yo,
						priority: 0
					}),
					sup: () => ({
						conversion: Yo,
						priority: 0
					}),
					u: () => ({
						conversion: Yo,
						priority: 0
					})
				} });
			}
			afterCloneFrom(t) {
				super.afterCloneFrom(t), this.__text = t.__text, this.__format = t.__format, this.__style = t.__style, this.__mode = t.__mode, this.__detail = t.__detail;
			}
			constructor(t = "", e) {
				super(e), this.__text = t, this.__format = 0, this.__style = "", this.__mode = 0, this.__detail = 0;
			}
			getFormat() {
				return this.getLatest().__format;
			}
			getDetail() {
				return this.getLatest().__detail;
			}
			getMode() {
				return U[this.getLatest().__mode];
			}
			getStyle() {
				return this.getLatest().__style;
			}
			isToken() {
				return 1 === this.getLatest().__mode;
			}
			isComposing() {
				return this.__key === qs();
			}
			isSegmented() {
				return 2 === this.getLatest().__mode;
			}
			isDirectionless() {
				return !!(1 & this.getLatest().__detail);
			}
			isUnmergeable() {
				return !!(2 & this.getLatest().__detail);
			}
			hasFormat(t) {
				const e = z$1[t];
				return 0 !== (this.getFormat() & e);
			}
			isSimpleText() {
				return "text" === this.__type && 0 === this.__mode;
			}
			getTextContent() {
				return this.getLatest().__text;
			}
			getFormatFlags(t, e) {
				return Ws(this.getLatest().__format, t, e);
			}
			canHaveFormat() {
				return !0;
			}
			isInline() {
				return !0;
			}
			createDOM(t, e) {
				const n = this.__format, o = Po(0, n), r = Io(0, n), i = null === o ? r : o, s = Zl().createElement(i);
				let l = s;
				this.hasFormat("code") && s.setAttribute("spellcheck", "false"), null !== o && (l = Zl().createElement(r), s.appendChild(l));
				zo(l, this, 0, n, this.__text, t);
				const c = this.__style;
				return "" !== c && Fo(s.style, c), s;
			}
			updateDOM(e, n, o) {
				const r = this.__text, i = e.__format, s = this.__format, l = Po(0, i), c = Po(0, s), a = Io(0, i), u = Io(0, s);
				if ((null === l ? a : l) !== (null === c ? u : c)) return !0;
				if (l === c && a !== u) {
					const e = n.firstChild;
					e ?? t(48);
					const i = Zl().createElement(u);
					return zo(i, this, 0, s, r, o), n.replaceChild(i, e), !1;
				}
				let f = n;
				null !== c && null !== l && (f = n.firstChild, f ?? t(49)), Ko(r, f, this);
				const d = o.theme.text;
				void 0 !== d && i !== s && Lo(0, i, s, f, d);
				const h = e.__style, g = this.__style;
				return h !== g && Fo(n.style, g, h), !1;
			}
			updateFromJSON(t) {
				return super.updateFromJSON(t).setTextContent(t.text).setFormat(t.format).setDetail(t.detail).setMode(t.mode).setStyle(t.style);
			}
			exportDOM(e) {
				let { element: n } = super.exportDOM(e);
				return gc(n) || t(132), n.style.whiteSpace = "pre-wrap", this.hasFormat("lowercase") ? n.style.textTransform = "lowercase" : this.hasFormat("uppercase") ? n.style.textTransform = "uppercase" : this.hasFormat("capitalize") && (n.style.textTransform = "capitalize"), this.hasFormat("bold") && (n = Bo(n, "b")), this.hasFormat("italic") && (n = Bo(n, "i")), this.hasFormat("strikethrough") && (n = Bo(n, "s")), this.hasFormat("underline") && (n = Bo(n, "u")), { element: n };
			}
			exportJSON() {
				return {
					detail: this.getDetail(),
					format: this.getFormat(),
					mode: this.getMode(),
					style: this.getStyle(),
					text: this.getTextContent(),
					...super.exportJSON()
				};
			}
			selectionTransform(t, e) {}
			setFormat(t) {
				const e = this.getWritable();
				return e.__format = "string" == typeof t ? z$1[t] : t, e;
			}
			setDetail(t) {
				const e = this.getWritable();
				return e.__detail = "string" == typeof t ? B[t] : t, e;
			}
			setStyle(t) {
				const e = this.getWritable();
				return e.__style = t, e;
			}
			toggleFormat(t) {
				const e = Ws(this.getFormat(), t, null);
				return this.setFormat(e);
			}
			toggleDirectionless() {
				const t = this.getWritable();
				return t.__detail ^= 1, t;
			}
			toggleUnmergeable() {
				const t = this.getWritable();
				return t.__detail ^= 2, t;
			}
			setMode(t) {
				const e = $[t];
				if (this.__mode === e) return this;
				const n = this.getWritable();
				return n.__mode = e, n;
			}
			setTextContent(t) {
				if (this.__text === t) return this;
				const e = this.getWritable();
				return e.__text = t, e;
			}
			select(t, e) {
				fi();
				let n = t, o = e;
				const r = Kr(), i = this.getTextContent(), s = this.__key;
				if ("string" == typeof i) {
					const t = i.length;
					void 0 === n && (n = t), void 0 === o && (o = t);
				} else n = 0, o = 0;
				if (!ur(r)) return Dr(s, n, s, o, "text", "text");
				{
					const t = qs();
					t !== r.anchor.key && t !== r.focus.key || Vs(s), r.setTextNodeRange(this, n, this, o);
				}
				return r;
			}
			selectStart() {
				return this.select(0, 0);
			}
			selectEnd() {
				const t = this.getTextContentSize();
				return this.select(t, t);
			}
			spliceText(t, e, n, o) {
				const r = this.getWritable(), i = r.__text, s = n.length;
				let l = t;
				l < 0 && (l = s + l, l < 0 && (l = 0));
				const c = Kr();
				if (o && ur(c)) {
					const e = t + s;
					c.setTextNodeRange(r, e, r, e);
				}
				return r.__text = i.slice(0, l) + n + i.slice(l + e), r;
			}
			canInsertTextBefore() {
				return !0;
			}
			canInsertTextAfter() {
				return !0;
			}
			splitText(...t) {
				fi();
				const e = this.getLatest(), n = e.getTextContent();
				if ("" === n) return [];
				const o = e.__key, r = qs(), i = n.length;
				t.sort((t, e) => t - e), t.push(i);
				const s = [], l = t.length;
				for (let e = 0, o = 0; e < i && o <= l; o++) {
					const r = t[o];
					r > e && (s.push(n.slice(e, r)), e = r);
				}
				const c = s.length;
				if (1 === c) return [e];
				const a = s[0], u = e.getParent();
				let f;
				const d = e.getFormat(), h = e.getStyle(), g = e.__detail;
				let _ = !1, p = null, y = null;
				const m = Kr();
				if (ur(m)) {
					const [t, e] = m.isBackward() ? [m.focus, m.anchor] : [m.anchor, m.focus];
					"text" === t.type && t.key === o && (p = t), "text" === e.type && e.key === o && (y = e);
				}
				e.isSegmented() ? (f = Go(a), f.__format = d, f.__style = h, f.__detail = g, f.__state = At(e, f), _ = !0) : f = e.setTextContent(a);
				const x = [f];
				for (let t = 1; t < c; t++) {
					const n = Go(s[t]);
					n.__format = d, n.__style = h, n.__detail = g, n.__state = At(e, n);
					const i = n.__key;
					r === o && Vs(i), x.push(n);
				}
				const C = p ? p.offset : null, S = y ? y.offset : null;
				let v = 0;
				for (const t of x) {
					if (!p && !y) break;
					const e = v + t.getTextContentSize();
					if (null !== p && null !== C && C <= e && C >= v && (p.set(t.getKey(), C - v, "text"), C < e && (p = null)), null !== y && null !== S && S <= e && S >= v) {
						y.set(t.getKey(), S - v, "text");
						break;
					}
					v = e;
				}
				if (null !== u) {
					(function(t) {
						const e = t.getPreviousSibling(), n = t.getNextSibling();
						null !== e && Js(e);
						null !== n && Js(n);
					})(this);
					const t = u.getWritable(), e = this.getIndexWithinParent();
					_ ? (t.splice(e, 0, x), this.remove()) : t.splice(e, 1, x), ur(m) && Br(m, u, e, c - 1);
				}
				return x;
			}
			mergeWithSibling(e) {
				const n = e === this.getPreviousSibling();
				n || e === this.getNextSibling() || t(50);
				const o = this.__key, r = e.__key, i = this.__text, s = i.length;
				qs() === r && Vs(o);
				const l = Kr();
				if (ur(l)) {
					const t = l.anchor, i = l.focus;
					null !== t && t.key === r && $r(t, n, o, e, s), null !== i && i.key === r && $r(i, n, o, e, s);
				}
				const c = e.__text, a = n ? c + i : i + c;
				this.setTextContent(a);
				const u = this.getWritable();
				return e.remove(), u;
			}
			isTextEntity() {
				return !1;
			}
		};
		function $o(t) {
			return {
				forChild: Qo(t.style),
				node: null
			};
		}
		function Uo(t) {
			const e = t, n = "normal" === e.style.fontWeight;
			return {
				forChild: Qo(e.style, n ? void 0 : "bold"),
				node: null
			};
		}
		const Ho = /* @__PURE__ */ new WeakMap();
		function jo(t) {
			if (!gc(t)) return !1;
			if ("PRE" === t.nodeName) return !0;
			const e = t.style.whiteSpace;
			return "string" == typeof e && e.startsWith("pre");
		}
		function Jo(e) {
			const n = e;
			null === e.parentElement && t(129);
			let o = n.textContent || "";
			if (null !== function(t) {
				let e, n = t.parentNode;
				const o = [t];
				for (; null !== n && void 0 === (e = Ho.get(n)) && !jo(n);) o.push(n), n = n.parentNode;
				const r = void 0 === e ? n : e;
				for (let t = 0; t < o.length; t++) Ho.set(o[t], r);
				return r;
			}(n)) return { node: qr(o) };
			if (o = o.replace(/\r/g, "").replace(/[ \t\n]+/g, " "), "" === o) return { node: null };
			if (" " === o[0]) {
				let t = n, e = !0;
				for (; null !== t && null !== (t = Vo(t, !1));) {
					const n = t.textContent || "";
					if (n.length > 0) {
						/[ \t\n]$/.test(n) && (o = o.slice(1)), e = !1;
						break;
					}
				}
				e && (o = o.slice(1));
			}
			if (" " === o[o.length - 1]) {
				let t = n, e = !0;
				for (; null !== t && null !== (t = Vo(t, !0));) if ((t.textContent || "").replace(/^( |\t|\r?\n)+/, "").length > 0) {
					e = !1;
					break;
				}
				e && (o = o.slice(0, o.length - 1));
			}
			return "" === o ? { node: null } : { node: Go(o) };
		}
		function Vo(t, e) {
			let n = t;
			for (;;) {
				let t;
				for (; null === (t = e ? n.nextSibling : n.previousSibling);) {
					const t = n.parentElement;
					if (null === t) return null;
					n = t;
				}
				if (n = t, gc(n)) {
					const t = n.style.display;
					if ("" === t && !mc(n) || "" !== t && !t.startsWith("inline")) return null;
				}
				let o = n;
				for (; null !== (o = e ? n.firstChild : n.lastChild);) n = o;
				if (zs(n)) return n;
				if ("BR" === n.nodeName) return null;
			}
		}
		const qo = {
			code: "code",
			em: "italic",
			i: "italic",
			mark: "highlight",
			s: "strikethrough",
			strong: "bold",
			sub: "subscript",
			sup: "superscript",
			u: "underline"
		};
		function Yo(t) {
			const e = qo[t.nodeName.toLowerCase()];
			return void 0 === e ? { node: null } : {
				forChild: Qo(t.style, e),
				node: null
			};
		}
		function Go(t = "") {
			return Wl(new Wo(t));
		}
		function Xo(t) {
			return t instanceof Wo;
		}
		function Qo(t, e) {
			const n = t.fontWeight, o = t.textDecoration.split(" "), r = "700" === n || "bold" === n, i = o.includes("line-through"), s = "italic" === t.fontStyle, l = o.includes("underline"), c = t.verticalAlign;
			return (t) => Xo(t) || Ro(t) ? (r && !t.hasFormat("bold") && t.toggleFormat("bold"), i && !t.hasFormat("strikethrough") && t.toggleFormat("strikethrough"), s && !t.hasFormat("italic") && t.toggleFormat("italic"), l && !t.hasFormat("underline") && t.toggleFormat("underline"), "sub" !== c || t.hasFormat("subscript") || t.toggleFormat("subscript"), "super" !== c || t.hasFormat("superscript") || t.toggleFormat("superscript"), e && !t.hasFormat(e) && t.toggleFormat(e), t) : t;
		}
		var Zo = class extends Wo {
			$config() {
				return this.config("tab", { extends: Wo });
			}
			constructor(t = void 0) {
				super("	", t), this.__detail = 2;
			}
			createDOM(t) {
				const e = super.createDOM(t), n = Cl(t.theme, "tab");
export {};
