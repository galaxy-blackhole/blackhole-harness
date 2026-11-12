/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			}
			if (l && !u) {
				if ((gc(d) || pc(d)) && (g ? g(y) : d.append(y)), o(d), p) {
					const t = p.call(f, d);
					t && (pc(d) ? d.replaceChildren(t) : d.replaceWith(t));
				}
			} else o(y);
			return l;
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/@lexical+clipboard@0.49.0_typescript@6.0.3/node_modules/@lexical/clipboard/dist/LexicalClipboard.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		function et(r, i, l = null) {
			const c = Ql(l), s = l ? Gl(l) : [], u = null !== l && s.length > 0;
			if (u && "function" == typeof c.caretPositionFromPoint) {
				const t = c.caretPositionFromPoint(r, i, { shadowRoots: s });
				if (null !== t && function(t, e) {
					for (let n = t; null !== n;) {
						if (n === e) return !0;
						n = wl(n);
					}
					return !1;
				}(t.offsetNode, l)) return {
					node: t.offsetNode,
					offset: t.offset
				};
			}
			if (u) {
				const t = l.getRootNode();
				if (ql(t)) {
					const e = t.elementFromPoint(r, i);
					if (null !== e && l.contains(e)) {
						const t = function(t, e, n, o) {
							const r = o.createRange(), i = (t) => e < t.top ? t.top - e : e > t.bottom ? e - t.bottom : 0, l = (e) => t < e.left ? e.left - t : t > e.right ? t - e.right : 0, c = o.createTreeWalker(n, NodeFilter.SHOW_TEXT);
							let s = null, u = Infinity, a = Infinity;
							for (let t = c.nextNode(); t; t = c.nextNode()) {
								r.selectNodeContents(t);
								for (const e of r.getClientRects()) {
									const n = i(e), o = l(e);
									(n < u || n === u && o < a) && (u = n, a = o, s = t);
								}
							}
							if (null === s) return null;
							let f = 0, p = Infinity, d = Infinity;
							for (let e = 0; e <= s.length; e++) {
								r.setStart(s, e), r.collapse(!0);
								const n = r.getBoundingClientRect(), o = i(n), l = Math.abs(t - n.left);
								(o < p || o === p && l < d) && (p = o, d = l, f = e);
							}
							return {
								node: s,
								offset: f
							};
						}(r, i, e, c);
						if (null !== t) return t;
					}
				}
			}
			if ("function" == typeof c.caretRangeFromPoint) {
				const t = c.caretRangeFromPoint(r, i);
				return null === t ? null : {
					node: t.startContainer,
					offset: t.startOffset
				};
			}
			if ("function" == typeof c.caretPositionFromPoint) {
				const t = c.caretPositionFromPoint(r, i);
				return null === t ? null : {
					node: t.offsetNode,
					offset: t.offset
				};
			}
			return null;
		}
		function nt(t, ...e) {
			const n = new URL("https://lexical.dev/docs/error"), o = new URLSearchParams();
			o.append("code", t);
			for (const t of e) o.append("v", t);
			throw n.search = o.toString(), Error(`Minified Lexical error #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		function pt(t, e = Kr()) {
			return e ?? nt(166), ur(e) && e.isCollapsed() || 0 === e.getNodes().length ? "" : On(t, e);
		}
		function mt(t, e) {
			const n = t.getData("text/plain") || t.getData("text/uri-list");
			null != n && e.insertRawText(n);
		}
		const yt = "application/x-lexical-drag";
		function xt(t, e) {
			const n = { editorKey: e.getKey() };
			t.setData(yt, JSON.stringify(n));
		}
		function ht(t, e, n) {
			const o = t.dataTransfer;
			if (null === o) return !1;
			const r = function(t) {
				const e = t.getData(yt);
				if (!e) return null;
				let n;
				try {
					n = JSON.parse(e);
				} catch (t) {
					return null;
				}
				return null !== (o = n) && "object" == typeof o && "editorKey" in o && "string" == typeof o.editorKey ? n : null;
				var o;
			}(o);
			if (null === r) return !1;
			const i = function(t, e) {
				const n = et(t.clientX, t.clientY, e.getRootElement());
				if (null === n) return null;
				const o = Zs(n.node);
				if (null === o) return null;
				if (Xo(o)) return La(o, "next", n.offset);
				if (Pi(o)) return hu(o, n.offset, "next");
				const r = o.getParent();
				return null === r ? null : hu(r, o.getIndexWithinParent() + 1, "next");
			}(t, e);
			if (null === i) return !1;
			const l = yu(i);
			if (null === l) return !1;
			const c = r.editorKey === e.getKey(), u = Kr();
			if (c) {
				if (!ur(u) || u.isCollapsed()) return !1;
				if (function(t, e) {
					const { anchor: n, focus: o } = du(ru(e), "next");
					return Ya(n, t) < 0 && Ya(t, o) < 0;
				}(i, u)) return t.preventDefault(), !0;
				u.removeText();
			}
			if (!l.origin.isAttached()) return t.preventDefault(), !0;
			if (n(o, nu(Ja(l)), e), !c) {
				const t = e.getRootElement(), n = t ? t.ownerDocument : null, o = n ? function(t, e) {
					for (const n of Xl(e)) {
						const e = Ps(n);
						if (Ds(e) && e.getKey() === t && gc(n)) return n;
					}
					return null;
				}(r.editorKey, n) : null;
				null !== o && o.dispatchEvent(new InputEvent("beforeinput", {
					bubbles: !0,
					cancelable: !0,
					inputType: "deleteByDrag"
				}));
			}
			return t.preventDefault(), !0;
		}
		function bt(t, e) {
			return ht(t, e, (t, e) => mt(t, e));
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/@lexical+plain-text@0.49.0_typescript@6.0.3/node_modules/@lexical/plain-text/dist/LexicalPlainText.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		function M$1(e, t) {
			t.update(() => {
				if (null !== e) {
					const r = Mt(e, KeyboardEvent) ? null : e.clipboardData, o = Kr();
					if (null !== o && !o.isCollapsed() && null != r) {
						e.preventDefault();
						const a = pt(t);
						null !== a && r.setData("text/html", a), r.setData("text/plain", o.getTextContent());
					}
				}
			});
		}
		function O$1(n) {
			return Eu(n.registerCommand($e$2, (e) => {
				const t = Kr();
				return !!ur(t) && (t.deleteCharacter(e), !0);
			}, 0), n.registerCommand(qe$2, (e) => {
				const t = Kr();
				return !!ur(t) && (t.deleteWord(e), !0);
			}, 0), n.registerCommand(Ye$1, (e) => {
				const t = Kr();
				return !!ur(t) && (t.deleteLine(e), !0);
			}, 0), n.registerCommand(je$2, (t) => {
				const r = Kr();
				if (!ur(r)) return !1;
				if ("string" == typeof t) r.insertText(t);
				else {
					const n = t.dataTransfer;
					if (null != n) mt(n, r);
					else {
						const e = t.data;
						e && r.insertText(e);
					}
				}
				return !0;
			}, 0), n.registerCommand(Ve$2, () => {
				const e = Kr();
				return !!ur(e) && (e.removeText(), !0);
			}, 0), n.registerCommand(Ue$2, (e) => {
				const t = Kr();
				return !!ur(t) && (t.insertLineBreak(e), !0);
			}, 0), n.registerCommand(He$2, () => {
				const e = Kr();
				return !!ur(e) && (e.insertLineBreak(), !0);
			}, 0), n.registerCommand(on$1, (e) => {
				const t = Kr();
				if (!ur(t)) return !1;
				const r = e, n = r.shiftKey;
				return !!te$2(t, !0) && (r.preventDefault(), le$1(t, n, !0), !0);
			}, 0), n.registerCommand(en$3, (e) => {
				const t = Kr();
				if (!ur(t)) return !1;
				const r = e, n = r.shiftKey;
				return !!te$2(t, !1) && (r.preventDefault(), le$1(t, n, !1), !0);
			}, 0), n.registerCommand(un$2, (e) => {
				return !!ur(Kr()) && (!l || !s) && (e.preventDefault(), n.dispatchCommand($e$2, !0));
			}, 0), n.registerCommand(dn$1, (e) => {
				return !!ur(Kr()) && (e.preventDefault(), n.dispatchCommand($e$2, !1));
			}, 0), n.registerCommand(cn$1, (e) => {
				if (!ur(Kr())) return !1;
				if (null !== e) {
					if ((l || a || d$1) && s) return !1;
					e.preventDefault();
				}
				return n.dispatchCommand(Ue$2, !1);
			}, 0), n.registerCommand(kn, () => {
				const e = Kr();
				return xl(ur(e) && null !== oa(e.anchor.getNode()) ? e : null), !0;
			}, 0), n.registerCommand(vn$2, (e) => {
				return !!ur(Kr()) && (M$1(e, n), !0);
			}, 0), n.registerCommand(Tn, (e) => {
				return !!ur(Kr()) && (function(e, t) {
					M$1(e, t), t.update(() => {
						const e = Kr();
						ur(e) && e.removeText();
					}, { tag: "cut" });
				}(e, n), !0);
			}, 0), n.registerCommand(Je$2, (t) => {
				return !!ur(Kr()) && (function(t, r) {
					t.preventDefault(), r.update(() => {
						const r = Kr(), n = Mt(t, ClipboardEvent) ? t.clipboardData : null;
						null != n && ur(r) && mt(n, r);
					}, { tag: "paste" });
				}(t, n), !0);
			}, 0), n.registerCommand(yn$1, (e) => bt(e, n), 0), n.registerCommand(xn$1, (e) => {
				const t = Kr();
				return !!ur(t) && (t.isCollapsed() || null === e.dataTransfer || xt(e.dataTransfer, n), !0);
			}, 0));
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/@lexical+history@0.49.0_typescript@6.0.3/node_modules/@lexical/history/dist/LexicalHistory.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		function E(t, e, n, o, r) {
			if (null === t || 0 === n.size && 0 === o.size && !r) return 0;
			const a = e._selection, i = t._selection;
			if (r) return 1;
			if (!(ur(a) && ur(i) && i.isCollapsed() && a.isCollapsed())) return 0;
			const l = function(t, e, n) {
				const o = t._nodeMap, r = [];
				for (const t of e) {
					const e = o.get(t);
					void 0 !== e && r.push(e);
				}
				for (const [t, e] of n) {
					if (!e) continue;
					const n = o.get(t);
					void 0 === n || Bi(n) || r.push(n);
				}
				return r;
			}(e, n, o);
			if (0 === l.length) return 0;
			if (l.length > 1) {
				const n = e._nodeMap, o = n.get(a.anchor.key), r = n.get(i.anchor.key);
				return o && r && !t._nodeMap.has(o.__key) && Xo(o) && 1 === o.__text.length && 1 === a.anchor.offset ? 2 : 0;
			}
			const s = l[0], u = t._nodeMap.get(s.__key);
			if (!Xo(u) || !Xo(s) || u.__mode !== s.__mode) return 0;
			const d = u.__text, c = s.__text;
			if (d === c) return 0;
			const p = a.anchor, f = i.anchor;
			if (p.key !== f.key || "text" !== p.type) return 0;
			const h = p.offset, m = f.offset, g = c.length - d.length;
			return 1 === g && m === h - 1 ? 2 : -1 === g && m === h + 1 ? 3 : -1 === g && m === h ? 4 : 0;
		}
		function D(t, e, n) {
			let o = n(), r = 0, a = o, i = 0, l = null;
			return (s, u, d, c, p, f) => {
				const h = n();
				if (f.has("composition-start") && (a = o, i = r, l = s), f.has("historic")) return r = 0, o = h, 2;
				f.has("composition-end") && l && (o = a, r = i, s = l);
				const m = f.has("paste") || f.has("cut") ? 0 : E(s, u, c, p, t.isComposing()), w = (() => {
					const n = null === d || d.editor === t, a = f.has(mo);
					if (!a && n && f.has("history-merge")) return 0;
					if (1 === m) return 2;
					if (null === s) return 1;
					const i = u._selection;
					if (!(c.size > 0 || p.size > 0)) return null !== i ? 0 : 2;
					const l = "number" == typeof e ? e : e.peek();
					if (!1 === a && 0 !== m && m === r && h < o + l && n) return 0;
					if (1 === c.size) {
						if (function(t, e, n) {
							const o = e._nodeMap.get(t), r = n._nodeMap.get(t), a = e._selection, i = n._selection;
							return !(ur(a) && ur(i) && "element" === a.anchor.type && "element" === a.focus.type && "text" === i.anchor.type && "text" === i.focus.type || !Xo(o) || !Xo(r) || o.__parent !== r.__parent) && JSON.stringify(e.read(() => o.exportJSON())) === JSON.stringify(n.read(() => r.exportJSON()));
						}(Array.from(c)[0], s, u)) return 0;
					}
					return 1;
				})();
				return o = h, r = m, w;
			};
		}
		function M(t, e) {
			t.undoStack = [], t.redoStack = [], t.current = null, e && e(t);
		}
		function O(t, e, n, o = Date.now, r, f = null) {
			const h = D(t, n, o), m = () => {
				r && r(e);
			};
			return m(), Eu(t.registerCommand(Qe$2, () => (function(t, e, n) {
				const o = e.redoStack, r = e.undoStack;
				if (0 !== r.length) {
					const a = e.current, i = r.pop();
					null !== a && (o.push(a), t.dispatchCommand(En, !0)), 0 === r.length && t.dispatchCommand(wn$1, !1), e.current = i || null, n && n(e), i && i.editor.setEditorState(i.editorState, { tag: "historic" });
				}
			}(t, e, r), !0), 0), t.registerCommand(Ze$2, () => (function(t, e, n) {
				const o = e.redoStack, r = e.undoStack;
				if (0 !== o.length) {
					const a = e.current;
					null !== a && (r.push(a), t.dispatchCommand(wn$1, !0));
					const i = o.pop();
					0 === o.length && t.dispatchCommand(En, !1), e.current = i || null, n && n(e), i && i.editor.setEditorState(i.editorState, { tag: "historic" });
				}
			}(t, e, r), !0), 0), t.registerCommand(bn$2, () => (M(e, r), !1), 0), t.registerCommand(Nn$1, () => (M(e, r), t.dispatchCommand(En, !1), t.dispatchCommand(wn$1, !1), !0), 0), t.registerUpdateListener(({ editorState: n, prevEditorState: o, dirtyLeaves: r, dirtyElements: a, tags: i }) => {
				const l = e.current, s = e.redoStack, u = e.undoStack, d = null === l ? null : l.editorState;
				if (null !== l && n === d) return;
				const g = h(o, n, l, r, a, i);
				if (1 === g) {
					if (0 !== s.length && (e.redoStack = [], t.dispatchCommand(En, !1)), null !== l) {
						u.push({ ...l });
						const e = "number" == typeof f || null === f ? f : f.peek();
						null !== e && u.length > e && u.splice(0, u.length - e), t.dispatchCommand(wn$1, !0);
					}
				} else if (2 === g) return;
				e.current = {
					editor: t,
					editorState: n
				}, m();
			}));
		}
		function z() {
			return {
				current: null,
				redoStack: [],
				undoStack: []
			};
		}
		Date.now;
		//#endregion
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-conversation/src/client/input/editor/ReferenceChip.module.css.mjs
		const css$8 = ".yAWgPa_chip{max-width:240px;color:var(--dsw-alias-state-business-primary);user-select:none;align-items:baseline;gap:3px;display:inline-flex}.yAWgPa_marker{flex:none;font-weight:500}.yAWgPa_icon{flex:none;align-self:center}.yAWgPa_label{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.yAWgPa_invalid{color:var(--dsw-alias-state-error-primary);opacity:.7;text-decoration:line-through}";
		const tagId$8 = "@deepseek-ai/dsh-client-ui-conversation/ReferenceChip.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$8) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$8;
			tag.textContent = css$8;
			document.head.appendChild(tag);
		}
		var ReferenceChip_module_css_default = {
			"chip": "yAWgPa_chip",
			"icon": "yAWgPa_icon",
			"invalid": "yAWgPa_invalid",
			"label": "yAWgPa_label",
			"marker": "yAWgPa_marker"
		};
export {};
