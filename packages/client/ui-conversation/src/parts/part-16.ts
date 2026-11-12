/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		}
		function _e$2(t, e) {
			const n = function(t) {
				const e = t.__dir;
				if (null !== e) return e;
				if (Bi(t)) return null;
				const n = t.getParent();
				return null === n || Bl(n) && null === n.__dir ? "auto" : null;
			}(e);
			null !== n ? t.dir = n : t.removeAttribute("dir");
		}
		function pe$1(t) {
			const e = Zl().createElement("div");
			return e.setAttribute("data-lexical-slot", t), e.style.display = "none", e;
		}
		function ye$1(t, e, n) {
			e || "false" === t.contentEditable ? Bc(n, $t$2) : n.removeAttribute("contenteditable");
		}
		function me$2(t, e, n) {
			const o = Ht$2, r = qt$2();
			Ht$2 = "";
			let i = "";
			const s = Ki(t);
			for (const [o, r] of n) {
				const n = pe$1(o);
				ye$1(e, s, n), e.appendChild(n), Ht$2 = "";
				const l = qt$2();
				Te$2(r, kc(t, n, $t$2)), Yt$2(l), Ce$2(t, o, e, n), i += Ht$2;
			}
			return Yt$2(r), Ht$2 = o, i;
		}
		function xe$1(t) {
			return Qc(t) && null !== t.__slots ? t.__slots : Xc;
		}
		function Ce$2(t, e, n, o) {
			const r = se$2.$getSlotTargetElement(t, e, n, $t$2);
			null !== r && (o.parentElement !== r && r.appendChild(o), o.style.display = "");
		}
		function Se$1(t) {
			const e = oe$3.get(t);
			return void 0 !== e ? e.parentElement : null;
		}
		function ve$2(t, e, n) {
			const o = xe$1(t), r = xe$1(e);
			for (const [t, e] of o) if (!r.has(t)) {
				const t = Se$1(e);
				ae$2(e, null), null !== t && t.remove();
			}
			const i = Ht$2, s = qt$2();
			let l = "", c = null;
			const a = Ki(e);
			for (const [t, i] of r) {
				const r = o.get(t);
				let s = void 0 !== r ? Se$1(r) : null;
				Ht$2 = "";
				const u = qt$2();
				if (null === s) {
					s = pe$1(t);
					let o = null;
					for (const t of n.children) if (!t.hasAttribute("data-lexical-slot")) {
						o = t;
						break;
					}
					n.insertBefore(s, o), Te$2(i, kc(e, s, $t$2));
				} else r === i ? we$1(i, s) : (void 0 !== r && ae$2(r, s), Te$2(i, kc(e, s, $t$2)));
				if (Yt$2(u), ye$1(n, a, s), Ce$2(e, t, n, s), l += Ht$2, s.parentElement === n) {
					const t = null === c ? n.firstChild : c.nextSibling;
					t !== s && n.insertBefore(s, t), c = s;
				}
			}
			return Yt$2(s), Ht$2 = i, l;
		}
		function Te$2(e, n) {
			const o = ne$3.get(e);
			if (void 0 === o && t(60), null !== n) {
				const t = te$3.get(e);
				if (void 0 !== t) {
					const r = oe$3.get(e);
					if (void 0 !== r) {
						const i = Zc(t) ? t.__slotHost : null, s = Zc(o) ? o.__slotHost : null, l = t.__parent !== o.__parent || i !== s, c = null !== s && r.parentElement !== n.element;
						if (l || c) return n.insertChild(r), we$1(e, n.element);
					}
				}
			}
			const r = se$2.$createDOM(o, $t$2);
			if (function(t, e, n) {
				const o = n._keyToDOMMap;
				Xs(e, n, t), o.set(t, e);
			}(e, r, $t$2), Xo(o) ? r.setAttribute("data-lexical-text", "true") : Ki(o) && (r.setAttribute("data-lexical-decorator", "true"), Kc(r, { captureSelection: !0 })), Pi(o)) {
				const t = o.__indent, e = o.__size;
				_e$2(r, o), 0 !== t && he(r, t);
				const n = xe$1(o), i = n.size > 0 ? me$2(o, r, n) : "";
				if (0 === e) r.__lexicalTextContent = i, r.__lexicalFirstTextKey = null, Ht$2 += i, n.size > 0 && (r.__lexicalSlotTextLength = i.length);
				else {
					const t = Ht$2, s = e - 1;
					if (ke$2(Yc(o, ne$3), o, 0, s, kc(o, r, $t$2)), "" !== i) {
						const e = r.__lexicalTextContent || "";
						r.__lexicalTextContent = i + e, Ht$2 = t + i + e;
					}
					n.size > 0 && (r.__lexicalSlotTextLength = i.length);
				}
				const s = o.__format;
				0 !== s && ge$1(r, s), o.isInline() || be$1(null, o, r);
			} else {
				const t = o.getTextContent();
				if (Ki(o)) {
					const t = o.decorate($t$2, Wt$2);
					null !== t && Oe$1(e, t), r.contentEditable = "false";
					const n = xe$1(o);
					n.size > 0 && me$2(o, r, n);
				}
				Ht$2 += t;
			}
			return null !== n && n.insertChild(r), se$2.$decorateDOM(o, null, r, $t$2), Bt$3(o), Sl(ie$2, Ut$2, Xt$2, o, "created"), r;
		}
		function ke$2(e, n, o, r, i) {
			const s = Ht$2, l = qt$2();
			Ht$2 = "", jt$2 = null, Jt$2 = null, Vt$2 = null;
			let c = o;
			for (; c <= r; ++c) {
				const t = qt$2();
				Te$2(e[c], i);
				const n = ne$3.get(e[c]);
				null !== n && Xo(n) ? null === jt$2 && (jt$2 = n.getFormat(), Jt$2 = n.getStyle(), Vt$2 = n.__key) : Pi(n) && c < r && !n.isInline() && (Ht$2 += D$1), Yt$2(t);
			}
			const a = $t$2._keyToDOMMap.get(n.__key);
			void 0 === a && t(349, n.__key), a.__lexicalTextContent = Ht$2, a.__lexicalFirstTextKey = Vt$2, Ht$2 = s + Ht$2, Yt$2(l);
		}
		function be$1(t, e, n) {
			const o = kc(e, n, $t$2), r = o.element.__lexicalLastChildKind ?? null, i = function(t, e) {
				if (t) {
					const n = t.__last;
					if (n) {
						const t = e.get(n);
						if (t) return Yi(t) ? "line-break" : Ki(t) && t.isInline() ? "decorator" : null;
					}
					return xe$1(t).size > 0 ? null : "empty";
				}
				return null;
			}(e, ne$3);
			r !== i && o.setManagedLineBreak(i);
		}
		function Ne$1(e, n, o) {
			var r;
			jt$2 = null, Jt$2 = null, Vt$2 = null, function(e, n, o) {
				const r = Ht$2, i = e.__size, s = n.__size;
				Ht$2 = "";
				const l = o.element, c = $t$2._keyToDOMMap.get(n.__key);
				void 0 === c && t(351, n.__key);
				const a = s - i;
				if (!le$2 && Math.abs(a) <= 1 && i >= Rt$1 && e.__first === n.__first && (0 !== a || !$t$2._cloneNotNeeded.has(e.__key))) {
					const i = c.__lexicalTextContent, u = re$2.get(e.__key);
					if (!le$2 && "string" == typeof i && void 0 !== u) {
						const s = function(t, e) {
							const n = e.size;
							if (0 === n || n >= t.__size) return null;
							let o = t.__last, r = null, i = 0;
							for (; null !== o && i < n;) {
								if (!e.has(o)) return null;
								r = o;
								const t = ne$3.get(o);
								if (void 0 === t) return null;
								o = t.__prev, i++;
							}
							if (i !== n) return null;
							if (null !== o && e.has(o)) return null;
							return r;
						}(n, u);
						if (null !== s) {
							const f = u.size;
							if (0 === a) {
								const e = zt$2(s, f);
								let o = s, a = 0;
								for (; null !== o && a < f;) {
									const t = ne$3.get(o);
									if (void 0 === t) break;
									const e = qt$2();
									we$1(o, l), Xo(t) && null === jt$2 && (jt$2 = t.getFormat(), Jt$2 = t.getStyle(), Vt$2 = t.__key), Yt$2(e), o = t.__next, a++;
								}
								let d = "";
								for (o = s, a = 0; null !== o && a < f;) {
									const e = ne$3.get(o);
									if (void 0 === e) break;
									let n;
									if (Pi(e)) {
										const r = $t$2._keyToDOMMap.get(o), i = r && r.__lexicalTextContent;
										"string" != typeof i && t(352, e.getType()), n = i;
									} else n = e.getTextContent();
									d += n, a < f - 1 && Pi(e) && !e.isInline() && (d += D$1), o = e.__next, a++;
								}
								const h = c.__lexicalSlotTextLength || 0, g = h > 0 ? i.slice(h) : i, _ = g.slice(0, g.length - e) + d;
								c.__lexicalTextContent = _, Ht$2 = r + _, Ee$1(n, c, u);
								return;
							}
							if (function(e, n, o, r, i, s, l, c) {
								if (1 !== c && -1 !== c) return !1;
								if (l !== (1 === c ? 2 : 1)) return !1;
								const u = l - c;
								let f = e.__last;
								for (let t = 0; t < u - 1; t++) {
									if (null === f) return !1;
									const t = te$3.get(f);
									if (void 0 === t) return !1;
									f = t.__prev;
								}
								if (null === f) return !1;
								const d = ne$3.get(s), h = te$3.get(f);
								if (void 0 === d || void 0 === h) return !1;
								if (d.__prev !== h.__prev) return !1;
								const g = [];
								let _ = s;
								for (let t = 0; t < l; t++) {
									if (null === _) return !1;
									g.push(_);
									const t = ne$3.get(_);
									_ = t ? t.__next : null;
								}
								const p = [];
								_ = f;
								for (let t = 0; t < u; t++) {
									if (null === _) return !1;
									p.push(_);
									const t = te$3.get(_);
									_ = t ? t.__next : null;
								}
								const y = new Set(p), m = new Set(g), x = [];
								let C = 0, S = 0;
								for (; C < u && S < l;) if (g[S] === p[C]) x.push({
									key: g[S],
									kind: "reconcile"
								}), C++, S++;
								else if (m.has(p[C])) {
									if (y.has(g[S])) return !1;
									x.push({
										key: g[S],
										kind: "create",
										nextIndex: S
									}), S++;
								} else x.push({
									key: p[C],
									kind: "destroy"
								}), C++;
								for (; C < u;) x.push({
									key: p[C++],
									kind: "destroy"
								});
								for (; S < l;) x.push({
									key: g[S],
									kind: "create",
									nextIndex: S
								}), S++;
								const v = zt$2(f, u);
								for (const t of x) {
									const e = qt$2();
									if ("reconcile" === t.kind) we$1(t.key, o.element);
									else if ("destroy" === t.kind) ae$2(t.key, o.element);
									else {
										let e = null;
										for (let n = t.nextIndex + 1; n < l; n++) {
											const t = $t$2._keyToDOMMap.get(g[n]);
											if (void 0 !== t) {
												e = t;
												break;
											}
										}
										Te$2(t.key, o.withBefore(e ?? o.before));
									}
									if ("destroy" !== t.kind) {
										const e = ne$3.get(t.key);
										e && Xo(e) && null === jt$2 && (jt$2 = e.getFormat(), Jt$2 = e.getStyle(), Vt$2 = e.__key);
									}
									Yt$2(e);
								}
								let T = "";
								for (let e = 0; e < l; e++) {
									const n = ne$3.get(g[e]);
									if (void 0 === n) return !1;
									let o;
									if (Pi(n)) {
										const r = $t$2._keyToDOMMap.get(g[e]), i = r && r.__lexicalTextContent;
										"string" != typeof i && t(350, n.getType()), o = i;
									} else o = n.getTextContent();
									T += o, e < l - 1 && Pi(n) && !n.isInline() && (T += D$1);
								}
								const k = r.__lexicalSlotTextLength || 0, b = k > 0 ? i.slice(k) : i;
								return r.__lexicalTextContent = b.slice(0, b.length - v) + T, !0;
							}(e, 0, o, c, i, s, f, a)) {
								const e = c.__lexicalTextContent;
								"string" != typeof e && t(353), Ht$2 = r + e, Ee$1(n, c, u);
								return;
							}
						}
					}
					if (0 === a) {
						let n = e.__first, o = 0;
						for (; null !== n;) {
							const e = ne$3.get(n);
							if (void 0 === e) break;
							const r = le$2 || Zt$2.has(n) || Qt$2.has(n), i = qt$2();
							if (r) we$1(n, l);
							else {
								let o, r;
								if (Pi(e)) {
									r = oe$3.get(n);
									const i = r && r.__lexicalTextContent;
									"string" != typeof i && t(354, e.getType()), o = i;
								} else o = e.getTextContent();
								Ht$2 += o, void 0 !== r && Gt$2(r);
							}
							Xo(e) ? null === jt$2 && (jt$2 = e.getFormat(), Jt$2 = e.getStyle(), Vt$2 = e.__key) : Pi(e) && o < s - 1 && !e.isInline() && (Ht$2 += D$1), Yt$2(i), n = e.__next, o++;
						}
						c.__lexicalTextContent = Ht$2, c.__lexicalFirstTextKey = Vt$2, Ht$2 = r + Ht$2;
						return;
					}
				}
				if (1 === i && 1 === s) {
					const t = e.__first, r = n.__first;
					if (t === r) we$1(t, l);
					else {
						const e = Fe$2(t), n = Te$2(r, null);
						try {
							e.parentNode === l ? l.replaceChild(n, e) : o.insertChild(n);
						} catch (o) {
							if ("object" == typeof o && null != o) {
								const i = `${o.toString()} Parent: ${l.tagName}, new child: {tag: ${n.tagName} key: ${r}}, old child: {tag: ${e.tagName}, key: ${t}}.`;
								throw new Error(i);
							}
							throw o;
						}
						ae$2(t, null);
					}
					const i = ne$3.get(r);
					Xo(i) && null === jt$2 && (jt$2 = i.getFormat(), Jt$2 = i.getStyle(), Vt$2 = i.__key);
				} else {
					const r = Yc(e, te$3), c = Yc(n, ne$3);
					if (r.length !== i && t(227), c.length !== s && t(228), 0 === i) 0 !== s && ke$2(c, n, 0, s - 1, o);
					else if (0 === s) {
						if (0 !== i) {
							const t = null == o.after && null == o.before && 0 === xe$1(n).size && null == o.element.__lexicalLineBreak;
							ue$1(r, 0, i - 1, t ? null : l), t && (l.textContent = "");
						}
					} else (function(t, e, n, o, r, i) {
						const s = o - 1, l = r - 1;
						let c, a, u = i.getFirstChild(), f = 0, d = 0;
						for (; f <= s && d <= l;) {
							const t = e[f], o = n[d], r = qt$2();
							if (t === o) u = Me$2(we$1(o, i.element)), f++, d++;
							else {
								if (void 0 === a && (a = Ae$2(n, d)), void 0 === c) c = Ae$2(e, f);
								else if (!c.has(t)) {
									f++, Yt$2(r);
									continue;
								}
								if (!a.has(t)) {
									u = Me$2(Fe$2(t)), ae$2(t, i.element), f++, c.delete(t), Yt$2(r);
									continue;
								}
								if (c.has(o)) {
									const t = El($t$2, o);
									t !== u && i.withBefore(u ?? i.before).insertChild(t), u = Me$2(we$1(o, i.element)), f++, d++;
								} else Te$2(o, i.withBefore(u ?? i.before)), d++;
							}
							const s = ne$3.get(o);
							null !== s && Xo(s) ? null === jt$2 && (jt$2 = s.getFormat(), Jt$2 = s.getStyle(), Vt$2 = s.__key) : Pi(s) && d <= l && !s.isInline() && (Ht$2 += D$1), Yt$2(r);
						}
						const h = f > s, g = d > l;
						if (h && !g) {
							const e = n[l + 1], o = void 0 === e ? null : $t$2.getElementByKey(e);
							ke$2(n, t, d, l, i.withBefore(o ?? i.before));
						} else g && !h && ue$1(e, f, s, i.element);
					})(n, r, c, i, s, o);
				}
				c.__lexicalTextContent = Ht$2, c.__lexicalFirstTextKey = Vt$2, Ht$2 = r + Ht$2;
			}(e, n, kc(n, o, $t$2)), Bl(n) || (r = n, null == jt$2 || jt$2 === r.__textFormat || ce$2 || r.setTextFormat(jt$2), function(t) {
				null == Jt$2 || Jt$2 === t.__textStyle || ce$2 || t.setTextStyle(Jt$2);
			}(n));
		}
		function Ee$1(t, e, n) {
			const o = e.__lexicalFirstTextKey;
			if (null != o) {
				const e = t.__key;
				let r = o;
				for (; null !== r;) {
					const t = ne$3.get(r);
					if (void 0 === t) {
						r = null;
						break;
					}
					if (t.__parent === e) break;
					r = t.__parent;
				}
				if (null !== r && !n.has(r)) {
					const t = ne$3.get(o);
					if (Xo(t)) return jt$2 = t.getFormat(), void (Jt$2 = t.getStyle());
				}
			}
			e.__lexicalFirstTextKey = Vt$2;
		}
		function we$1(e, n) {
			const o = te$3.get(e);
export {};
