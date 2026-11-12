/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					if (void 0 !== r.onError && (t.onError = r.onError), void 0 !== r.onWarn && (t.onWarn = r.onWarn), void 0 !== r.disableEvents && (t.disableEvents = r.disableEvents), void 0 !== r.parentEditor && (t.parentEditor = r.parentEditor), void 0 !== r.editable && (t.editable = r.editable), void 0 !== r.namespace && (t.namespace = r.namespace), void 0 !== r.$initialEditorState && (t.$initialEditorState = r.$initialEditorState), r.nodes) for (const t of ve$1(r)) {
						if ("function" != typeof t) {
							const e = n.get(t.replace);
							e && Ie$1(302, r.name, t.replace.name, e.extension.name), n.set(t.replace, c);
						}
						e.add(t);
					}
					if (r.html) {
						if (r.html.export) for (const [t, e] of r.html.export.entries()) i.set(t, e);
						r.html.import && Object.assign(o, r.html.import);
					}
					r.theme && _e$1(s, r.theme);
				}
				Object.keys(s).length > 0 && (t.theme = s), e.size && (t.nodes = [...e]);
				const c = Object.keys(o).length > 0, a = i.size > 0;
				(c || a) && (t.html = {}, c && (t.html.import = o), a && (t.html.export = i));
				for (const e of r) e.init(t);
				return t.onError || (t.onError = Qe$1), t;
			}
		};
		function sn$1(t, e) {
			const n = nn$1.maybeFromEditor(t);
			if (!n) return;
			const i = n.extensionNameMap.get(e);
			return i ? i.getExtensionDependency() : void 0;
		}
		var hn$1 = class extends Li {
			$config() {
				return this.config("horizontalrule", { importDOM: { hr: () => ({
					conversion: gn$1,
					priority: 0
				}) } });
			}
			exportDOM() {
				return { element: Zl().createElement("hr") };
			}
			createDOM(t) {
				const e = Zl().createElement("hr");
				return bu(e, t.theme.hr), e;
			}
			getTextContent() {
				return "\n";
			}
			isInline() {
				return !1;
			}
			updateDOM() {
				return !1;
			}
		};
		function gn$1() {
			return { node: pn$1() };
		}
		function pn$1() {
			return Vc(hn$1);
		}
		new Set([No, ko]);
		Date.now;
		//#endregion
		//#region ../../../node_modules/.pnpm/@lexical+html@0.49.0_typescript@6.0.3/node_modules/@lexical/html/dist/LexicalHtml.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		function nt$1(t, ...e) {
			const n = new URL("https://lexical.dev/docs/error"), o = new URLSearchParams();
			o.append("code", t);
			for (const t of e) o.append("v", t);
			throw n.search = o.toString(), Error(`Minified Lexical error #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		let ot;
		function rt(t, e) {
			const { key: n } = e;
			return t && n in t ? t[n] : e.defaultValue;
		}
		function st(t) {
			return ot && ot.editor === t ? ot : void 0;
		}
		function it(t, e) {
			const n = st(e);
			return n && n[t];
		}
		function ct(t, e) {
			if ("cfg" in e) {
				const { cfg: n, updater: o } = e;
				return [n, o(rt(t, n))];
			}
			return e;
		}
		function lt(t, e) {
			let n = e;
			for (const o of t) {
				const [t, r] = ct(n, o), s = t.key;
				if (n === e && rt(n, t) === r) continue;
				const i = n === e || void 0 === n ? ut(e) : n;
				i[s] = r, n = i;
			}
			return n;
		}
		function ut(t) {
			return Object.create(t || null);
		}
		function ft(t, e) {
			return [t, e];
		}
		function dt(t, n, o, r = vc()) {
			const s = ot, i = st(r);
			try {
				return ot = {
					...i,
					editor: r,
					[t]: n
				}, o();
			} finally {
				ot = s;
			}
		}
		function pt$1(t, n = () => {}) {
			return (o, r = vc()) => (e) => {
				const s = st(r), i = s && s[t], c = lt(o, i || n(r));
				return c && c !== i ? dt(t, c, e, r) : e();
			};
		}
		function ht$1(t, e, o, r) {
			return Object.assign(mt$2(Symbol(e), {
				isEqual: r,
				parse: o
			}), { [t]: !0 });
		}
		const yt$1 = "@lexical/html/DOM", xt$1 = Symbol.for("@lexical/html/DOMExportContext"), St = "@lexical/html/DOMImport", $t = Symbol.for("@lexical/html/DOMImportContext");
		function Ct(t, e, n) {
			return ht$1(xt$1, t, e, n);
		}
		const kt = /* @__PURE__ */ Ct("isExport", Boolean);
		function Dt(t) {
			const e = sn$1(t, yt$1);
			return e ? e.output.defaults : void 0;
		}
		function Ot(t) {
			const e = sn$1(t, yt$1);
			return e ? e.output.runtime : void 0;
		}
		function Nt(t = vc()) {
			const n = Ot(t);
			return n ? n.getSessionConfig() : Tc(t);
		}
		const Et = pt$1(xt$1, Dt);
		new Map([[zi, () => {
			const t = Zl().createElement("div");
			return t.role = "textbox", { element: t };
		}]]);
		const re = Symbol.for("@lexical/html/SelectorImpl");
		function se(t, e) {
			const n = {
				kind: "element",
				predicate: (o = e, 0 === o.length ? gc : 1 === o.length ? o[0] : (t, e) => {
					for (const n of o) if (!n(t, e)) return !1;
					return !0;
				}),
				tags: t
			};
			var o;
			const s = (n) => se(t, [...e, n]);
			return {
				[re]: n,
				attr: (t, e, n) => s(le(t, e, n)),
				classAll: (...t) => s(ce(t)),
				classAny: (...t) => s(function(t) {
					const e = ie(t);
					if (0 === e.length) return () => !1;
					return (t) => {
						if (!gc(t)) return !1;
						const n = t.classList;
						for (const t of e) if (n.contains(t)) return !0;
						return !1;
					};
				}(t)),
				styleAny: (t, e, n) => s(function(t, e, n) {
					if ("string" == typeof e) return (n) => gc(n) && n.style.getPropertyValue(t) === e;
					if (e instanceof RegExp) {
						const o = n && n.capture, s = e;
						return (e, n) => {
							if (!gc(e)) return !1;
							const i = e.style.getPropertyValue(t);
							if (!i) return !1;
							const c = i.match(s);
							return null !== c && (void 0 !== o && (n[o] = c), !0);
						};
					}
					nt$1(362, JSON.stringify(t));
				}(t, e, n))
			};
		}
		function ie(t) {
			const e = [];
			for (const n of t) n && e.push(n);
			return e;
		}
		function ce(t) {
			const e = ie(t);
			return 0 === e.length ? () => !0 : (t) => {
				if (!gc(t)) return !1;
				const n = t.classList;
				for (const t of e) if (!n.contains(t)) return !1;
				return !0;
			};
		}
		function le(t, e, n) {
			if (!0 === e) return (e) => gc(e) && e.hasAttribute(t);
			if ("string" == typeof e) return (n) => gc(n) && n.getAttribute(t) === e;
			if (e instanceof RegExp) {
				const o = n && n.capture, s = e;
				return (e, n) => {
					if (!gc(e)) return !1;
					const i = e.getAttribute(t);
					if (null == i) return !1;
					const c = i.match(s);
					return null !== c && (void 0 !== o && (n[o] = c), !0);
				};
			}
			nt$1(361, JSON.stringify(t));
		}
		const ue = {
			kind: "text",
			predicate: zs,
			tags: /* @__PURE__ */ new Set()
		}, fe = { [re]: ue }, ae = {
			kind: "comment",
			predicate: (t) => 8 === t.nodeType,
			tags: /* @__PURE__ */ new Set()
		}, de = { [re]: ae }, pe = {
			any: () => se(/* @__PURE__ */ new Set(), []),
			comment: () => de,
			tag(...t) {
				t.length > 0 || nt$1(363);
				const e = /* @__PURE__ */ new Set();
				for (const n of t) e.add(n.toUpperCase());
				return se(e, []);
			},
			text: () => fe
		};
		function Ne(t) {
			const e = sn$1(t, St);
			return e ? e.output.defaults : void 0;
		}
		function Ee(t, n = vc()) {
			return rt(function(t) {
				return it($t, t) || Ne(t);
			}(n), t);
		}
		const Ie = pt$1($t, Ne), Le = pe;
		new Set([
			"center",
			"end",
			"justify",
			"left",
			"right",
			"start"
		]);
		new Set([
			"font-weight",
			"font-style",
			"text-decoration",
			"vertical-align"
		]);
		Le.tag("b", "strong", "em", "i", "code", "mark", "s", "sub", "sup", "u", "span");
		Le.text();
		Le.tag("script", "style");
		Le.tag("br");
		Le.tag("p"), Le.tag("hr"), Le.any();
		function sn(t, e) {
			return zs(e) ? t.textIndices : 8 === e.nodeType ? t.commentIndices : gc(e) ? t.byTag.get(e.nodeName) || t.wildcardIndices : cn;
		}
		const cn = Object.freeze([]);
		const an = Object.freeze({});
		function dn(t, e) {
			return {
				$importChildren: (e, n) => function(t, e, n) {
					const o = n && n.rules ? n.rules.dispatch : void 0;
					o && t.overlays.push(o);
					try {
						const o = () => pn(t, e, n);
						return n && n.context ? Ie(n.context, t.editor)(o) : o();
					} finally {
						o && t.overlays.pop();
					}
				}(t, e, n),
				$importOne: (e, n) => hn(t, e, n),
				captures: e,
				get: (e) => Ee(e, t.editor),
				session: t.session
			};
		}
		function pn(t, e, n) {
			const o = n && n.$onChild, r = [];
			for (const n of Array.from(e.childNodes)) {
				const e = hn(t, n, void 0);
				for (const t of e) {
					const e = o ? o(t) : t;
					null != e && r.push(e);
				}
			}
			const s = n && n.$after ? n.$after(r) : r, i = n && n.schema;
			return i ? function(t, e, n, o) {
				const r = [];
				let s = null;
				const i = () => {
					if (null === s) return;
					const e = s;
					if (s = null, t.$packageRun) {
						const s = t.$packageRun(e, n, o);
						if (s.length > 0) {
							for (const t of s) r.push(t);
							return;
						}
					}
					if ("hoist" === t.onReject) for (const t of e) r.push(t);
				};
				for (const o of e) t.$accepts(o, n) ? (i(), r.push(o)) : (null === s && (s = []), s.push(o));
				return i(), t.$finalize ? t.$finalize(r, n) : r;
			}(i, s, null, e) : s;
		}
		function hn(t, e, n) {
			const o = () => function(t, e) {
				const n = function(t, e) {
					const n = [];
					for (let o = t.overlays.length - 1; o >= 0; o--) {
						const r = t.overlays[o], s = sn(r, e);
						s.length > 0 && n.push({
							dispatch: r,
							indices: s
						});
					}
					const o = sn(t.dispatch, e);
					o.length > 0 && n.push({
						dispatch: t.dispatch,
						indices: o
					});
					return n;
				}(t, e);
				if (0 === n.length) return gn(t, e);
				let o = 0, r = 0;
				const s = () => {
					for (; o < n.length;) {
						const { dispatch: i, indices: c } = n[o];
						for (; r < c.length;) {
							const n = c[r++], o = i.rules[n], l = {};
							if (o.predicate(e, l)) {
								const n = dn(t, 0 === Object.keys(l).length ? an : l);
								try {
									return o.$import(n, e, s);
								} catch (t) {
									throw t;
								}
							}
						}
						o++, r = 0;
					}
					return gn(t, e);
				};
				return s();
			}(t, e);
			return n && n.context ? Ie(n.context, t.editor)(o) : o();
		}
		function gn(t, e) {
			if (0 === e.childNodes.length) return [];
			const n = [];
			for (const o of Array.from(e.childNodes)) {
				const e = hn(t, o, void 0);
				for (const t of e) n.push(t);
			}
			return n;
		}
		pe.any();
		pe.any, pe.comment, pe.tag, pe.text;
		new Set(["STYLE", "SCRIPT"]);
		function Dn(t, n = null, o = vc()) {
			return Et([ft(kt, !0)], o)(() => {
				const e = nl(), r = Nt(o), s = ur(n) ? oa(n.anchor.getNode()) : null, i = t.append.bind(t);
				for (const t of (Pi(s) ? s : e).getChildren()) Mn(o, t, i, n, r);
				return t;
			});
		}
		function On(t, e = null) {
			return ("undefined" == typeof document || "undefined" == typeof window && void 0 === global.window) && nt$1(338), gi(t), Dn(Zl().createElement("div"), e, t).innerHTML;
		}
		function Mn(e, n, o, i = null, c = Tc(e)) {
			let l = c.$shouldInclude(n, i, e);
			const u = c.$shouldExclude(n, i, e);
			let f = n;
			null !== i && Xo(n) && (f = L(i, n, "clone"));
			const { element: d, after: p, append: g, $getChildNodes: m } = c.$exportDOM(f, e);
			if (!d) return !1;
			const y = Zl().createDocumentFragment(), S = m ? m() : Pi(f) ? f.getChildren() : [], $ = l && dr(i) && Pi(n) ? null : i, v = y.append.bind(y);
			for (const t of S) {
				const o = Mn(e, t, v, $, c);
				!l && o && c.$extractWithChild(n, t, i, "html", e) && (l = !0);
export {};
