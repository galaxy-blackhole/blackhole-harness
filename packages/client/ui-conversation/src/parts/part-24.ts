/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			}
			if (c === i) return !1;
			if (l && !s && Ki(c.origin) && c.origin.isKeyboardSelectable()) {
				const t = Pr();
				return t.add(c.origin.getKey()), ol(t), !0;
			}
			return c = au(c), l && eu(t.anchor, c), eu(t.focus, c), a || !s;
		}
		let ni = null, oi = null, ri = !1, ii = !1, si = !1;
		const li = /* @__PURE__ */ new Set();
		let ci = 0;
		const ai = {
			characterData: !0,
			childList: !0,
			subtree: !0
		};
		function ui() {
			return ri || null !== ni && ni._readOnly;
		}
		function fi() {
			ri && t(13);
		}
		function di() {
			ci > 99 && t(14);
		}
		function hi() {
			return null === ni && t(195, yi()), ni;
		}
		function gi(t) {
			null !== hi() && null === oi && (oi = t), oi !== t && e(378);
		}
		function _i() {
			return null === oi && t(337, yi()), oi;
		}
		function pi() {
			_i()._dirtyType = 2;
		}
		function yi() {
			let t = 0;
			const e = /* @__PURE__ */ new Set(), n = Cs.version;
			if ("undefined" != typeof window) for (const o of Xl(document)) {
				const r = Ps(o);
				if (Ds(r)) t++;
				else if (r) {
					let t = String(r.constructor.version || "<0.17.1");
					t === n && (t += " (separately built, likely a bundler configuration issue)"), e.add(t);
				}
			}
			let o = ` Detected on the page: ${t} compatible editor(s) with version ${n}`;
			return e.size && (o += ` and incompatible editors with versions ${Array.from(e).join(", ")}`), o;
		}
		function mi() {
			return oi;
		}
		function xi(t, e, n) {
			const o = e.__type, r = Ns(t, o);
			let i = n.get(o);
			void 0 === i && (i = Array.from(r.transforms), n.set(o, i));
			const s = i.length;
			for (let t = 0; t < s && (i[t](e), e.isAttached()); t++);
		}
		function Ci(t, e) {
			return void 0 !== t && t.__key !== e && t.isAttached();
		}
		function Si(t, e) {
			if (!e) return;
			const n = t._updateTags;
			let o = e;
			Array.isArray(e) || (o = [e]);
			for (const t of o) n.add(t);
		}
		function Ti(e, n) {
			const o = e.type, r = n.get(o);
			void 0 === r && t(17, o);
			const i = r.klass;
			e.type !== i.getType() && t(18, i.name);
			const s = i.importJSON(e), l = e.children;
			if (Pi(s) && Array.isArray(l)) for (let t = 0; t < l.length; t++) {
				const e = Ti(l[t], n);
				s.append(e);
			}
			const c = e.$slots;
			if (c) {
				Qc(s) || t(379, i.name);
				for (const t in c) pa(s, t, Ti(c[t], n));
			}
			return s;
		}
		function ki(t, e, n) {
			const o = ni, r = ri, i = oi;
			ni = e, ri = !0, oi = t;
			try {
				return n();
			} finally {
				ni = o, ri = r, oi = i;
			}
		}
		function bi(t, e) {
			const n = si;
			si = !0;
			try {
				(function(t, e) {
					const n = t._pendingEditorState, o = t._rootElement, r = t._headless || null === o;
					if (null === n) return void (!t._updating && t._deferred.length > 0 && wi(t, t._deferred));
					const i = t._editorState, s = i._selection, l = n._selection, c = 0 !== t._dirtyType, a = ni, u = ri, f = oi, d = t._updating, h = t._observer;
					let g = null;
					if (t._pendingEditorState = null, t._editorState = n, !r && c && null !== h) {
						oi = t, ni = n, ri = !1, t._updating = !0;
						try {
							const e = t._dirtyType, o = t._dirtyElements, r = t._dirtyLeaves;
							h.disconnect(), g = De$2(i, n, t, e, o, r);
						} catch (e) {
							if (e instanceof Error && t._onError(e), ii) throw e;
							gs(t, null, o, n), gt$1(t), t._dirtyType = 2, ii = !0, bi(t, i), ii = !1;
							return;
						} finally {
							h.observe(o, ai), t._updating = d, ni = a, ri = u, oi = f;
						}
					}
					n._readOnly || (n._readOnly = !0);
					const _ = t._dirtyLeaves, p = t._dirtyElements, y = t._normalizedNodes, m = t._updateTags;
					c && (t._dirtyType = 0, t._cloneNotNeeded.clear(), t._dirtyLeaves = /* @__PURE__ */ new Set(), t._dirtyElements = /* @__PURE__ */ new Map(), t._normalizedNodes = /* @__PURE__ */ new Set());
					t._updateTags = /* @__PURE__ */ new Set(), function(t, e) {
						const n = t._decorators;
						let o = t._pendingDecorators || n;
						const r = e._nodeMap;
						let i;
						for (i in o) r.has(i) || (o === n && (o = tl(t)), delete o[i]);
					}(t, n);
					const x = r ? null : Jl(Il(t));
					if (t._editable && null !== x && (c || null === l || l.dirty || !l.is(s)) && null !== o && !m.has("skip-dom-selection")) {
						oi = t, ni = n;
						try {
							if (null !== h && h.disconnect(), c || null === l || l.dirty) {
								const e = t._blockCursorElement;
								null !== e && jl(e, t, o), jr(s, l, t, x, m, o);
							}
							(function(t, e, n) {
								let o = t._blockCursorElement;
								if (ur(n) && n.isCollapsed() && "element" === n.anchor.type && e.contains(lc(e))) {
									const r = n.anchor, i = r.getNode(), s = r.offset;
									let l = !1, c = null;
									if (s === i.getChildrenSize()) Hl(i.getChildAtIndex(s - 1)) && (l = !0);
									else {
										const e = i.getChildAtIndex(s);
										if (null !== e && Hl(e)) {
											const n = e.getPreviousSibling();
											(null === n || Hl(n)) && (l = !0, c = t.getElementByKey(e.__key));
										}
									}
									if (l) {
										const n = kc(i, t.getElementByKey(i.__key), t).element;
										null === o && (t._blockCursorElement = o = function(t) {
											const e = t.theme, n = Zl().createElement("div");
											n.contentEditable = "false", n.setAttribute("data-lexical-cursor", "true");
											let o = e.blockCursor;
											if (void 0 !== o) {
												if ("string" == typeof o) o = e.blockCursor = ku(o);
												void 0 !== o && n.classList.add(...o);
											}
											return n;
										}(t._config)), e.style.caretColor = "transparent", null === c ? n.appendChild(o) : n.insertBefore(o, c);
										return;
									}
								}
								null !== o && jl(o, t, e);
							})(t, o, l);
						} finally {
							null !== h && h.observe(o, ai), oi = f, ni = a;
						}
					}
					null !== g && function(t, e, n, o, r) {
						const i = Array.from(t._listeners.mutation), s = i.length;
						for (let t = 0; t < s; t++) {
							const [s, l] = i[t];
							for (const t of l) {
								const i = e.get(t);
								void 0 !== i && s(i, {
									dirtyLeaves: o,
									prevEditorState: r,
									updateTags: n
								});
							}
						}
					}(t, g, m, _, i);
					ur(l) || null === l || null !== s && s.is(l) || t.dispatchCommand(Ie$2);
					const C = t._pendingDecorators;
					null !== C && (t._decorators = C, t._pendingDecorators = null, Ni("decorator", t, !0, C));
					if (function(t, e, n) {
						const o = el(e), r = el(n);
						o !== r && Ni("textcontent", t, !0, r);
					}(t, e || i, n), Ni("update", t, !0, {
						dirtyElements: p,
						dirtyLeaves: _,
						editorState: n,
						mutatedNodes: g,
						normalizedNodes: y,
						prevEditorState: e || i,
						tags: m
					}), !d) wi(t, t._deferred);
					(function(t) {
						const e = t._updates;
						if (0 === e.length) return void (t._cascadeCount = 0);
						if (function(t) {
							if (li.has(t)) return;
							li.add(t), setTimeout(() => {
								li.delete(t), t._cascadeCount = 0;
							}, 0);
						}(t), t._cascadeCount++ > 99) return t._updates = [], t._cascadeCount = 0, void t._onWarn(/* @__PURE__ */ new Error(`One or more update listeners are endlessly enqueueing more updates. May have encountered infinite recursion caused by update listeners that trigger additional updates without a stop condition. Editor namespace: ${t._config.namespace}`));
						const n = e.shift();
						if (n) {
							const [e, o] = n;
							Mi(t, e, o);
						}
					})(t);
				})(t, e);
			} finally {
				si = n;
			}
		}
		function Ni(t, e, n, ...o) {
			const r = e._updating;
			e._updating = n;
			try {
				const n = e._listeners[t], r = Array.from(n);
				for (const [t, e] of r) {
					e && e();
					const r = t(...o);
					n.has(t) ? n.set(t, r) : r && r();
				}
			} finally {
				e._updating = r;
			}
		}
		function Ei(t, e, n, o) {
			const r = ll(t);
			let i;
			if (!si) for (let t = 0; t < r.length; t++) r[t]._updating || (r[t]._cascadeCount = 0);
			for (let t = 4; t >= 0; t--) for (let s = 0; s < r.length; s++) {
				const l = r[s];
				if (s > 0 && l._updating) {
					i = l;
					break;
				}
				const c = l._commands.get(e);
				if (void 0 !== c) {
					const e = c[t];
					if (e.size > 0) {
						let t = !1;
						if (Ai(l, () => {
							for (const r of e) if (r(n, o)) return void (t = !0);
						}), t) return t;
					}
				}
			}
			return i && i.update(() => {
				Ei(i, e, n, o);
			}), !1;
		}
		function wi(t, e) {
			if (t._deferred = [], 0 !== e.length) {
				const n = t._updating;
				t._updating = !0;
				try {
					for (let t = 0; t < e.length; t++) e[t]();
				} finally {
					t._updating = n;
				}
			}
		}
		function Oi(e, n) {
			const o = e._updates;
			let r = n || !1;
			for (; 0 !== o.length;) {
				const n = o.shift();
				if (n) {
					const [o, i] = n, s = e._pendingEditorState;
					let l;
					void 0 !== i && (l = i.onUpdate, i.skipTransforms && (r = !0), i.discrete && (null === s && t(191), s._flushSync = !0), l && e._deferred.push(l), Si(e, i.tag)), null == s ? Mi(e, o, i) : o();
				}
			}
			return r;
		}
		function Mi(e, n, o) {
			const r = e._updateTags;
			let i, s = !1, l = !1;
			void 0 !== o && (i = o.onUpdate, Si(e, o.tag), s = o.skipTransforms || !1, l = o.discrete || !1), i && e._deferred.push(i);
			const c = e._editorState;
			let a = e._pendingEditorState, u = !1;
			(null === a || a._readOnly) && (a = e._pendingEditorState = Ri(a || c), u = !0), a._flushSync = l;
			const f = ni, d = ri, h = oi, g = e._updating;
			ni = a, ri = !1, e._updating = !0, oi = e;
			const _ = e._headless || null === e.getRootElement();
			vs(null);
			try {
				u && (_ ? null !== c._selection && (a._selection = c._selection.clone()) : a._selection = function(t, e) {
					const n = t.getEditorState()._selection, o = Jl(Il(t));
					return ur(n) || null == n ? Lr(n, o, t, e) : n.clone();
				}(e, o && o.event || null));
				const r = e._compositionKey;
				n(), s = Oi(e, s), function(t, e) {
					const n = e.getEditorState()._selection, o = t._selection;
					if (ur(o)) {
						const t = o.anchor, e = o.focus;
						let r;
						if ("text" === t.type && (r = t.getNode(), r.selectionTransform(n, o)), "text" === e.type) {
							const t = e.getNode();
							r !== t && t.selectionTransform(n, o);
						}
					}
				}(a, e), 0 !== e._dirtyType && (s ? function(t, e) {
					const n = e._dirtyLeaves, o = t._nodeMap;
					for (const t of n) {
						const e = o.get(t);
						Xo(e) && e.isAttached() && e.isSimpleText() && !e.isUnmergeable() && Pt$1(e);
					}
				}(a, e) : function(t, e) {
					const n = e._dirtyLeaves, o = e._dirtyElements, r = t._nodeMap, i = qs(), s = /* @__PURE__ */ new Map();
					let l = n, c = l.size, a = o, u = a.size;
					for (; c > 0 || u > 0;) {
						if (c > 0) {
							e._dirtyLeaves = /* @__PURE__ */ new Set();
							for (const t of l) {
								const o = r.get(t);
								Xo(o) && o.isAttached() && o.isSimpleText() && !o.isUnmergeable() && Pt$1(o), void 0 !== o && Ci(o, i) && xi(e, o, s), n.add(t);
							}
							if (l = e._dirtyLeaves, c = l.size, c > 0) {
								ci++;
								continue;
							}
						}
						e._dirtyLeaves = /* @__PURE__ */ new Set(), e._dirtyElements = /* @__PURE__ */ new Map(), a.delete("root") && a.set("root", !0);
						for (const t of a) {
							const n = t[0], l = t[1];
							if (o.set(n, l), !l) continue;
							const c = r.get(n);
							void 0 !== c && Ci(c, i) && xi(e, c, s);
						}
						l = e._dirtyLeaves, c = l.size, a = e._dirtyElements, u = a.size, ci++;
					}
					e._dirtyLeaves = n, e._dirtyElements = o;
				}(a, e), Oi(e), function(t, e, n, o) {
					const r = t._nodeMap, i = e._nodeMap, s = [];
					for (const [t] of o) {
						const e = i.get(t);
						void 0 !== e && (e.isAttached() || (Pi(e) && rt$1(e, t, r, i, s, o), r.has(t) || o.delete(t), s.push(t)));
					}
					for (const t of n) {
						const e = i.get(t);
						void 0 === e || e.isAttached() || (Qc(e) && null !== e.__slots && rt$1(e, t, r, i, s, n), r.has(t) || n.delete(t), s.push(t));
					}
					for (const t of s) i.delete(t);
					const l = _i(), c = l._compositionKey;
					null === c || i.has(c) || (l._compositionKey = null);
				}(c, a, e._dirtyLeaves, e._dirtyElements));
				r !== e._compositionKey && (a._flushSync = !0);
				const i = a._selection;
				if (ur(i)) {
					e._slotsUsed && Or(i);
					const n = a._nodeMap, o = i.anchor.key, r = i.focus.key;
					void 0 !== n.get(o) && void 0 !== n.get(r) || t(19);
				} else dr(i) && 0 === i._nodes.size && (a._selection = null);
			} catch (t) {
				t instanceof Error && e._onError(t), e._pendingEditorState = c, e._dirtyType = 2, e._cloneNotNeeded.clear(), e._dirtyLeaves = /* @__PURE__ */ new Set(), e._dirtyElements.clear(), bi(e);
				return;
			} finally {
				ni = f, ri = d, oi = h, e._updating = g, ci = 0;
			}
			0 !== e._dirtyType || e._deferred.length > 0 || function(t, e) {
				const n = e.getEditorState()._selection, o = t._selection;
				if (null !== o) {
					if (o.dirty || !o.is(n)) return !0;
				} else if (null !== n) return !0;
				return !1;
			}(a, e) ? a._flushSync ? (a._flushSync = !1, bi(e)) : u && ws(() => {
				bi(e);
			}) : (a._flushSync = !1, u && (r.clear(), e._deferred = [], e._pendingEditorState = null));
		}
		function Ai(t, e, n) {
			oi === t && void 0 === n ? ui() ? Mi(t, e, n) : e() : Mi(t, e, n);
		}
		function Di(t) {
			if (Bl(t)) {
				let e = null;
				for (const n of t.getChildren()) e = n.isInline() ? (e || n.replace(n.createParentElementNode())).append(n) : null;
			}
		}
		var Fi = class extends _o {
			__first;
			__last;
			__size;
			__format;
			__style;
			__indent;
			__dir;
			__textFormat;
			__textStyle;
			__slotHost;
			__slots;
			$config() {
export {};
