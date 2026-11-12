/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				void 0 !== e && (t = t.bind(e));
				for (const [e, n] of this.entries()) t(n, e, this);
			}
			get [Symbol.toStringTag]() {
				return "GenMap";
			}
			[Symbol.iterator]() {
				return this.entries();
			}
		};
		function rt$1(t, e, n, o, r, i) {
			if (Pi(t)) {
				let s = t.getFirstChild();
				for (; null !== s;) {
					const t = s.__key;
					s.__parent === e && ((Pi(s) || Qc(s) && null !== s.__slots) && rt$1(s, t, n, o, r, i), n.has(t) || i.delete(t), r.push(t)), s = s.getNextSibling();
				}
			}
			for (const s of Qc(t) && null !== t.__slots ? t.__slots.values() : []) {
				const t = o.get(s);
				void 0 !== t && Zc(t) && t.__slotHost === e && ((Pi(t) || Qc(t) && null !== t.__slots) && rt$1(t, s, n, o, r, i), n.has(s) || i.delete(s), r.push(s));
			}
		}
		let it$1 = !1, st$1 = 0;
		function lt$1(t) {
			st$1 = t.timeStamp;
		}
		function ct$1(t, e, n) {
			const o = "BR" === t.nodeName, r = e.__lexicalLineBreak;
			return r && (t === r || o && t.previousSibling === r) || o && void 0 !== Qs(t, n);
		}
		function at(t, e, n) {
			const o = Jl(Il(n)), r = o && nc(o, n._rootElement);
			let i = null, s = null;
			null !== r && r.anchorNode === t && (i = r.anchorOffset, s = r.focusOffset);
			const l = t.nodeValue;
			null !== l && fl(e, l, i, s, !1);
		}
		function ut$1(t, e, n) {
			if (ur(t)) {
				const e = t.anchor.getNode();
				if (e.is(n) && t.format !== e.getFormat()) return !1;
			}
			return zs(e) && n.isAttached();
		}
		function ft$1(t, e, n) {
			for (let o = t; o && !zc(o); o = wl(o)) {
				const t = Qs(o, e);
				if (void 0 !== t) {
					const e = Ys(t, n);
					if (e) return Ki(e) || !gc(o) ? void 0 : [o, e];
				}
			}
		}
		function dt$1(t, e, n) {
			it$1 = !0;
			const o = performance.now() - st$1 > 100;
			try {
				Ai(t, () => {
					const r = Kr() || function(t) {
						return t.read("latest", () => {
							const t = Kr();
							return null !== t ? t.clone() : null;
						});
					}(t), s = /* @__PURE__ */ new Map(), l = t._editorState, c = t._blockCursorElement;
					let a = !1, u = "";
					for (let n = 0; n < e.length; n++) {
						const f = e[n], d = f.type, h = f.target, g = ft$1(h, t, l);
						if (!g) continue;
						const [_, p] = g;
						if ("characterData" === d) o && Xo(p) && zs(h) && ut$1(r, h, p) && at(h, p, t);
						else if ("childList" === d) {
							a = !0;
							const e = f.addedNodes;
							for (let n = 0; n < e.length; n++) {
								const o = e[n], r = Gs(o), s = o.parentNode;
								if (!(null == s || o === c || null !== r || ct$1(o, s, t) || t._slotsUsed && gc(o) && o.hasAttribute("data-lexical-slot") || zc(o))) {
									if (i) {
										const t = (gc(o) ? o.innerText : null) || o.nodeValue;
										t && (u += t);
									}
									s.removeChild(o);
								}
							}
							const n = f.removedNodes, o = n.length;
							if (o > 0) {
								let e = 0;
								for (let r = 0; r < o; r++) {
									const o = n[r];
									(ct$1(o, h, t) || c === o) && (h.appendChild(o), e++);
								}
								o !== e && s.set(_, p);
							}
						}
					}
					if (s.size > 0) for (const [e, n] of s) n.reconcileObservedMutation(e, t);
					const f = n.takeRecords();
					if (f.length > 0) {
						for (let e = 0; e < f.length; e++) {
							const n = f[e], o = n.addedNodes, r = n.target;
							for (let e = 0; e < o.length; e++) {
								const n = o[e], i = n.parentNode;
								null == i || "BR" !== n.nodeName || ct$1(n, r, t) || i.removeChild(n);
							}
						}
						n.takeRecords();
					}
					null !== r && (a && ol(r), i && bl(t) && r.insertRawText(u));
				});
			} finally {
				it$1 = !1;
			}
		}
		function ht$2(t) {
			const e = t._observer;
			if (null !== e) dt$1(t, e.takeRecords(), e);
		}
		function gt$1(t) {
			(function(t) {
				0 === st$1 && Il(t).addEventListener("textInput", lt$1, !0);
			})(t), t._observer = new MutationObserver((e, n) => {
				dt$1(t, e, n);
			});
		}
		var yt$2 = class {
			key;
			parse;
			unparse;
			isEqual;
			defaultValue;
			resetOnCopyNode;
			constructor(t, e) {
				this.key = t, this.parse = e.parse.bind(e), this.unparse = (e.unparse || wt).bind(e), this.isEqual = (e.isEqual || Object.is).bind(e), this.defaultValue = this.parse(void 0), this.resetOnCopyNode = e.resetOnCopyNode || !1;
			}
		};
		function mt$2(t, e) {
			return new yt$2(t, e);
		}
		function vt$1(t) {
			const e = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Set();
			for (const { ownNodeConfig: o } of jc("function" == typeof t ? t : t.replace)) if (o && o.stateConfigs) for (const t of o.stateConfigs) {
				let o;
				"stateConfig" in t ? (o = t.stateConfig, t.flat && n.add(o.key)) : o = t, e.set(o.key, o);
			}
			return {
				flatKeys: n,
				sharedConfigMap: e
			};
		}
		const Tt$2 = new Set([
			"__proto__",
			"constructor",
			"prototype"
		]);
		var kt$1 = class kt$1 {
			node;
			knownState;
			unknownState;
			sharedNodeState;
			size;
			constructor(t, e, n = void 0, o = /* @__PURE__ */ new Map(), r = void 0) {
				this.node = t, this.sharedNodeState = e, this.unknownState = n, this.knownState = o;
				const { sharedConfigMap: i } = this.sharedNodeState, s = void 0 !== r ? r : function(t, e, n) {
					let o = n.size;
					if (e) for (const r in e) {
						const e = t.get(r);
						e && n.has(e) || o++;
					}
					return o;
				}(i, n, o);
				this.size = s;
			}
			getValue(t) {
				const e = this.knownState.get(t);
				if (void 0 !== e) return e;
				this.sharedNodeState.sharedConfigMap.set(t.key, t);
				let n = t.defaultValue;
				if (this.unknownState && t.key in this.unknownState) {
					const e = this.unknownState[t.key];
					void 0 !== e && (n = t.parse(e)), this.updateFromKnown(t, n);
				}
				return n;
			}
			getInternalState() {
				return [this.unknownState, this.knownState];
			}
			toJSON() {
				const t = { ...this.unknownState }, e = {};
				for (const [e, n] of this.knownState) e.isEqual(n, e.defaultValue) ? delete t[e.key] : t[e.key] = e.unparse(n);
				for (const n of this.sharedNodeState.flatKeys) n in t && (e[n] = t[n], delete t[n]);
				return Et$1(t) && (e.$ = t), e;
			}
			getWritable(t) {
				if (this.node === t) return this;
				const { sharedNodeState: e, unknownState: n } = this, o = new Map(this.knownState);
				return new kt$1(t, e, function(t, e, n) {
					let o;
					if (n) for (const [r, i] of Object.entries(n)) {
						if (Tt$2.has(r)) continue;
						const n = t.get(r);
						n ? e.has(n) || e.set(n, n.parse(i)) : (o = o || {}, o[r] = i);
					}
					return o;
				}(e.sharedConfigMap, o, n), o, this.size);
			}
			resetOnCopyNode() {
				for (const t of this.knownState.keys()) t.resetOnCopyNode && this.knownState.set(t, t.defaultValue);
				return this;
			}
			updateFromKnown(t, e) {
				const n = t.key;
				this.sharedNodeState.sharedConfigMap.set(n, t);
				const { knownState: o, unknownState: r } = this;
				o.has(t) || r && n in r || (r && (delete r[n], this.unknownState = Et$1(r)), this.size++), o.set(t, e);
			}
			updateFromUnknown(t, e) {
				if (Tt$2.has(t)) return;
				const n = this.sharedNodeState.sharedConfigMap.get(t);
				n ? this.updateFromKnown(n, n.parse(e)) : (this.unknownState = this.unknownState || {}, t in this.unknownState || this.size++, this.unknownState[t] = e);
			}
			updateFromJSON(t) {
				const { knownState: e } = this;
				for (const t of e.keys()) e.set(t, t.defaultValue);
				if (this.size = e.size, this.unknownState = void 0, t) for (const [e, n] of Object.entries(t)) this.updateFromUnknown(e, n);
			}
		};
		function bt$2(t) {
			const e = t.getWritable(), n = e.__state ? e.__state.getWritable(e) : new kt$1(e, Nt$1(e));
			return e.__state = n, n;
		}
		function Nt$1(t) {
			return t.__state ? t.__state.sharedNodeState : Ns(vc(), t.getType()).sharedNodeState;
		}
		function Et$1(t) {
			if (t) for (const e in t) return t;
		}
		function wt(t) {
			return t;
		}
		function Ot$1(t, e, n) {
			for (const [o, r] of e.knownState) {
				if (t.has(o.key)) continue;
				t.add(o.key);
				const e = n ? n.getValue(o) : o.defaultValue;
				if (e !== r && !o.isEqual(e, r)) return !0;
			}
			return !1;
		}
		function Mt$1(t, e, n) {
			const { unknownState: o } = e, r = n ? n.unknownState : void 0;
			if (o) for (const [e, n] of Object.entries(o)) {
				if (t.has(e)) continue;
				t.add(e);
				if (n !== (r ? r[e] : void 0)) return !0;
			}
			return !1;
		}
		function At(t, e) {
			const n = t.__state;
			return n && n.node === t ? n.getWritable(e) : n;
		}
		function Dt$1(t, e) {
			const n = t.__mode, o = t.__format, r = t.__style, i = e.__mode, s = e.__format, l = e.__style, c = t.__state, a = e.__state;
			return (null === n || n === i) && (null === o || o === s) && (null === r || r === l) && (null === t.__state || c === a || function(t, e) {
				if (t === e) return !0;
				const n = /* @__PURE__ */ new Set();
				return !(t && Ot$1(n, t, e) || e && Ot$1(n, e, t) || t && Mt$1(n, t, e) || e && Mt$1(n, e, t));
			}(c, a));
		}
		function Ft$1(t, e) {
			const n = t.mergeWithSibling(e), o = _i()._normalizedNodes;
			return o.add(t.__key), o.add(e.__key), n;
		}
		function Pt$1(t) {
			let e, n, o = t;
			if ("" !== o.__text || !o.isSimpleText() || o.isUnmergeable()) {
				for (; null !== (e = o.getPreviousSibling()) && Xo(e) && e.isSimpleText() && !e.isUnmergeable();) {
					if ("" !== e.__text) {
						if (Dt$1(e, o)) {
							o = Ft$1(e, o);
							break;
						}
						break;
					}
					e.remove();
				}
				for (; null !== (n = o.getNextSibling()) && Xo(n) && n.isSimpleText() && !n.isUnmergeable();) {
					if ("" !== n.__text) {
						if (Dt$1(o, n)) {
							o = Ft$1(o, n);
							break;
						}
						break;
					}
					n.remove();
				}
			} else o.remove();
		}
		function It(t) {
			return Lt$1(t.anchor), Lt$1(t.focus), t;
		}
		function Lt$1(t) {
			for (; "element" === t.type;) {
				const e = t.getNode(), n = t.offset;
				let o, r;
				if (n === e.getChildrenSize() ? (o = e.getChildAtIndex(n - 1), r = !0) : (o = e.getChildAtIndex(n), r = !1), Xo(o)) {
					t.set(o.__key, r ? o.getTextContentSize() : 0, "text", !0);
					break;
				}
				if (!Pi(o)) break;
				t.set(o.__key, r ? o.getChildrenSize() : 0, "element", !0);
			}
		}
		const Kt$2 = Symbol.for("@lexical/CachedTextSize");
		function zt$2(e, n) {
			return ee$3.read(() => {
				let o = 0, r = e;
				for (let e = 0; e < n && null !== r; e++) {
					const i = te$3.get(r);
					if (void 0 === i && t(345, r), Pi(i)) {
						const s = ne$3.get(r);
						if (void 0 !== s && Pi(s) && s.__parent !== i.__parent) o += i.getTextContentSize();
						else {
							const e = oe$3.get(r), n = e && e.__lexicalTextContent;
							"string" != typeof n && t(346, i.getType()), o += n.length;
						}
						e < n - 1 && !i.isInline() && (o += 2);
					} else {
						const e = i[Kt$2];
						void 0 === e && t(347, i.getType(), r), o += e;
					}
					r = i.__next;
				}
				return o;
			}, { editor: $t$2 });
		}
		function Bt$3(t) {
			Pi(t) || void 0 === t[Kt$2] && (t[Kt$2] = Xo(t) ? t.__text.length : t.getTextContentSize());
		}
		const Rt$1 = 4;
		let Wt$2, $t$2, Ut$2, Ht$2 = "", jt$2 = null, Jt$2 = null, Vt$2 = null;
		function qt$2() {
			return {
				firstTextKey: Vt$2,
				format: jt$2,
				style: Jt$2
			};
		}
		function Yt$2(t) {
			null !== t.firstTextKey && (jt$2 = t.format, Jt$2 = t.style, Vt$2 = t.firstTextKey);
		}
		function Gt$2(e) {
			if (null !== Vt$2) return;
			const n = e.__lexicalFirstTextKey;
			if (void 0 === n && t(348), null === n) return;
			const o = ne$3.get(n);
			Xo(o) && (jt$2 = o.getFormat(), Jt$2 = o.getStyle(), Vt$2 = n);
		}
		let Xt$2, Qt$2, Zt$2, te$3, ee$3, ne$3, oe$3, re$2, ie$2, se$2, le$2 = !1, ce$2 = !1;
		function ae$2(t, e) {
			const n = te$3.get(t), o = ne$3.has(t);
			if (null !== e) {
				const n = Fe$2(t);
				n.parentNode === e && e.removeChild(n);
			}
			if (!o) {
				if ($t$2._keyToDOMMap.delete(t), Pi(n)) {
					const t = Yc(n, te$3);
					ue$1(t, 0, t.length - 1, null);
				}
				if (void 0 !== n) {
					for (const t of xe$1(n).values()) {
						const e = Se$1(t);
						ae$2(t, null), null !== e && e.remove();
					}
					Sl(ie$2, Ut$2, Xt$2, n, "destroyed");
				}
			}
		}
		function ue$1(t, e, n, o) {
			for (let r = e; r <= n; ++r) {
				const e = t[r];
				void 0 !== e && ae$2(e, o);
			}
		}
		function fe$1(t, e) {
			t.setProperty("text-align", e);
		}
		const de$1 = "40px";
		function he(t, e) {
			const n = Wt$2.theme.indent;
			if ("string" == typeof n) {
				const o = t.classList.contains(n);
				e > 0 && !o ? t.classList.add(n) : e < 1 && o && t.classList.remove(n);
			}
			t.style.setProperty("padding-inline-start", 0 === e ? "" : `calc(${e} * var(--lexical-indent-base-value, ${de$1}))`);
		}
		function ge$1(t, e) {
			const n = t.style;
			0 === e ? fe$1(n, "") : 1 === e ? fe$1(n, "left") : 2 === e ? fe$1(n, "center") : 3 === e ? fe$1(n, "right") : 4 === e ? fe$1(n, "justify") : 5 === e ? fe$1(n, "start") : 6 === e && fe$1(n, "end");
export {};
