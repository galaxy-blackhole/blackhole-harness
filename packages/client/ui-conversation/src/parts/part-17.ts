/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			let r = ne$3.get(e);
			void 0 !== o && void 0 !== r || t(61);
			const i = le$2 || Zt$2.has(e) || Qt$2.has(e), s = El($t$2, e);
			if (o === r && !i) {
				let e;
				if (Pi(o)) {
					const n = s.__lexicalTextContent;
					"string" != typeof n && t(355, o.getType()), e = n, Gt$2(s);
				} else e = o.getTextContent();
				return Ht$2 += e, s;
			}
			if (o !== r && i && Sl(ie$2, Ut$2, Xt$2, r, "updated"), se$2.$updateDOM(r, o, s, $t$2)) {
				const o = Te$2(e, null);
				return null === n && t(62), n.replaceChild(o, s), ae$2(e, null), o;
			}
			if (Pi(o)) {
				Pi(r) || t(334, e);
				const n = r.__indent;
				(le$2 || n !== o.__indent) && he(s, n);
				const l = r.__format;
				(le$2 || l !== o.__format) && ge$1(s, l);
				const c = i && (xe$1(r).size > 0 || xe$1(o).size > 0) ? ve$2(o, r, s) : "";
				if (i) {
					const t = Ht$2;
					if (Ne$1(o, r, s), Bi(r) || r.isInline() || be$1(0, r, s), "" !== c) {
						const e = s.__lexicalTextContent || "";
						s.__lexicalTextContent = c + e, Ht$2 = t + c + e, s.__lexicalSlotTextLength = c.length;
					} else (xe$1(r).size > 0 || xe$1(o).size > 0) && (s.__lexicalSlotTextLength = 0);
				} else {
					const e = s.__lexicalTextContent;
					"string" != typeof e && t(356, o.getType()), Ht$2 += e, Gt$2(s);
				}
				if ((le$2 || r.__dir !== o.__dir || r.__parent !== o.__parent) && (_e$2(s, r), Bi(r) && !le$2)) {
					for (const t of r.getChildren()) if (Pi(t)) _e$2(El($t$2, t.getKey()), t);
				}
			} else {
				const t = r.getTextContent();
				if (Ki(r)) {
					const t = r.decorate($t$2, Wt$2);
					null !== t && Oe$1(e, t), i && (xe$1(r).size > 0 || xe$1(o).size > 0) && ve$2(o, r, s);
				}
				Ht$2 += t;
			}
			if (!ce$2 && Bi(r)) {
				const t = r.getLatest();
				if (t.__cachedText !== Ht$2) {
					const e = t.getWritable();
					e.__cachedText = Ht$2, r = e;
				}
			}
			return se$2.$decorateDOM(r, o, s, $t$2), Bt$3(r), s;
		}
		function Oe$1(t, e) {
			let n = $t$2._pendingDecorators;
			const o = $t$2._decorators;
			if (null === n) {
				if (o[t] === e) return;
				n = tl($t$2);
			}
			n[t] = e;
		}
		function Me$2(t) {
			let e = t.nextSibling;
			return null !== e && e === $t$2._blockCursorElement && (e = e.nextSibling), e;
		}
		function Ae$2(t, e) {
			const n = /* @__PURE__ */ new Set();
			for (let o = e; o < t.length; o++) n.add(t[o]);
			return n;
		}
		function De$2(t, e, n, o, r, i) {
			Ht$2 = "", jt$2 = null, Jt$2 = null, Vt$2 = null, le$2 = 2 === o, $t$2 = n, Wt$2 = n._config, se$2 = n._config.dom || ps, Ut$2 = n._nodes, Xt$2 = $t$2._listeners.mutation, Qt$2 = r, Zt$2 = i, te$3 = t._nodeMap, ee$3 = t, ne$3 = e._nodeMap, ce$2 = e._readOnly, oe$3 = nt$2(n._keyToDOMMap), re$2 = function() {
				const t = /* @__PURE__ */ new Map(), e = (e) => {
					for (const n of e) {
						const e = ne$3.get(n);
						if (void 0 === e) continue;
						const o = e.__parent;
						if (null === o) continue;
						let r = t.get(o);
						void 0 === r && (r = /* @__PURE__ */ new Set(), t.set(o, r)), r.add(n);
					}
				};
				return e(Qt$2.keys()), e(Zt$2), t;
			}();
			const s = /* @__PURE__ */ new Map();
			return ie$2 = s, we$1("root", null), $t$2 = void 0, Ut$2 = void 0, Qt$2 = void 0, Zt$2 = void 0, te$3 = void 0, ee$3 = void 0, ne$3 = void 0, Wt$2 = void 0, oe$3 = void 0, re$2 = void 0, ie$2 = void 0, se$2 = ps, s;
		}
		function Fe$2(e) {
			const n = oe$3.get(e);
			return void 0 === n && t(75, e), n;
		}
		function Pe$2(t) {
			return { type: t };
		}
		const Ie$2 = /* @__PURE__ */ Pe$2("SELECTION_CHANGE_COMMAND"), Ke$2 = /* @__PURE__ */ Pe$2("CLICK_COMMAND"), ze$2 = /* @__PURE__ */ Pe$2("BEFORE_INPUT_COMMAND"), Be$2 = /* @__PURE__ */ Pe$2("INPUT_COMMAND"), Re = /* @__PURE__ */ Pe$2("COMPOSITION_START_COMMAND"), We$2 = /* @__PURE__ */ Pe$2("COMPOSITION_END_COMMAND"), $e$2 = /* @__PURE__ */ Pe$2("DELETE_CHARACTER_COMMAND"), Ue$2 = /* @__PURE__ */ Pe$2("INSERT_LINE_BREAK_COMMAND"), He$2 = /* @__PURE__ */ Pe$2("INSERT_PARAGRAPH_COMMAND"), je$2 = /* @__PURE__ */ Pe$2("CONTROLLED_TEXT_INSERTION_COMMAND"), Je$2 = /* @__PURE__ */ Pe$2("PASTE_COMMAND"), Ve$2 = /* @__PURE__ */ Pe$2("REMOVE_TEXT_COMMAND"), qe$2 = /* @__PURE__ */ Pe$2("DELETE_WORD_COMMAND"), Ye$1 = /* @__PURE__ */ Pe$2("DELETE_LINE_COMMAND"), Ge$2 = /* @__PURE__ */ Pe$2("FORMAT_TEXT_COMMAND"), Qe$2 = /* @__PURE__ */ Pe$2("UNDO_COMMAND"), Ze$2 = /* @__PURE__ */ Pe$2("REDO_COMMAND"), tn$2 = /* @__PURE__ */ Pe$2("KEYDOWN_COMMAND"), en$3 = /* @__PURE__ */ Pe$2("KEY_ARROW_RIGHT_COMMAND"), nn$2 = /* @__PURE__ */ Pe$2("MOVE_TO_END"), on$1 = /* @__PURE__ */ Pe$2("KEY_ARROW_LEFT_COMMAND"), rn$1 = /* @__PURE__ */ Pe$2("MOVE_TO_START"), sn$2 = /* @__PURE__ */ Pe$2("KEY_ARROW_UP_COMMAND"), ln$2 = /* @__PURE__ */ Pe$2("KEY_ARROW_DOWN_COMMAND"), cn$1 = /* @__PURE__ */ Pe$2("KEY_ENTER_COMMAND"), an$1 = /* @__PURE__ */ Pe$2("KEY_SPACE_COMMAND"), un$2 = /* @__PURE__ */ Pe$2("KEY_BACKSPACE_COMMAND"), fn$1 = /* @__PURE__ */ Pe$2("KEY_ESCAPE_COMMAND"), dn$1 = /* @__PURE__ */ Pe$2("KEY_DELETE_COMMAND"), hn$2 = /* @__PURE__ */ Pe$2("KEY_TAB_COMMAND"), yn$1 = /* @__PURE__ */ Pe$2("DROP_COMMAND"), xn$1 = /* @__PURE__ */ Pe$2("DRAGSTART_COMMAND"), Cn$1 = /* @__PURE__ */ Pe$2("DRAGOVER_COMMAND"), Sn$2 = /* @__PURE__ */ Pe$2("DRAGEND_COMMAND"), vn$2 = /* @__PURE__ */ Pe$2("COPY_COMMAND"), Tn = /* @__PURE__ */ Pe$2("CUT_COMMAND"), kn = /* @__PURE__ */ Pe$2("SELECT_ALL_COMMAND"), bn$2 = /* @__PURE__ */ Pe$2("CLEAR_EDITOR_COMMAND"), Nn$1 = /* @__PURE__ */ Pe$2("CLEAR_HISTORY_COMMAND"), En = /* @__PURE__ */ Pe$2("CAN_REDO_COMMAND"), wn$1 = /* @__PURE__ */ Pe$2("CAN_UNDO_COMMAND"), On$1 = /* @__PURE__ */ Pe$2("FOCUS_COMMAND"), Mn$1 = /* @__PURE__ */ Pe$2("BLUR_COMMAND"), An = /* @__PURE__ */ Pe$2("KEY_MODIFIER_COMMAND");
		function Dn$1(t) {
			const e = /* @__PURE__ */ new Map();
			return {
				dispose() {
					for (const t of e.values()) t.dispose();
					e.clear();
				},
				register(n, o) {
					let r = e.get(n);
					void 0 === r && (r = {
						dispose: t(n, o),
						holders: /* @__PURE__ */ new Set()
					}, e.set(n, r));
					const i = () => {
						const t = e.get(n);
						t && t.holders.delete(i) && 0 === t.holders.size && (e.delete(n), t.dispose());
					};
					return r.holders.add(i), i;
				}
			};
		}
		function Fn(t, e, n, o) {
			return t.addEventListener(e, n, o), t.removeEventListener.bind(t, e, n, o);
		}
		const Pn = Object.freeze({}), In = [
			["keydown", function(t, e) {
				const n = e._inputState;
				n.lastKeyDownTimeStamp = t.timeStamp, n.lastKeyCode = t.key, "Backspace" !== t.key && Jn(n);
				if (e.isComposing()) return;
				Nl(e, tn$2, t);
			}],
			["pointerdown", function(t, e) {
				const n = ac(t), o = t.pointerType;
				_c(n) && "touch" !== o && "pen" !== o && 0 === t.button && Ai(e, () => {
					Rc(n, e) || (e._inputState.isSelectionChangeFromMouseDown = !0);
				});
			}],
			["compositionstart", function(t, e) {
				Nl(e, Re, t);
			}],
			["compositionend", function(t, e) {
				const n = e._inputState;
				i ? n.compositionPhase = "ending-firefox" : l || !a && !d$1 ? Nl(e, We$2, t) : (n.compositionPhase = "ending-safari", n.compositionEndData = t.data);
			}],
			["input", function(t, e) {
				t.stopPropagation();
				const n = e._inputState;
				Jn(n), Ai(e, () => {
					qn(t, e) || e.dispatchCommand(Be$2, t);
				}, { event: t }), n.unprocessedBeforeInputData = null;
			}],
			["click", function(t, e) {
				Ai(e, () => {
					const n = Kr(), o = Jl(Il(e)), r = zr();
					if (o) {
						if (ur(n)) {
							const t = n.anchor, e = t.getNode();
							"element" === t.type && 0 === t.offset && n.isCollapsed() && !Bi(e) && 1 === nl().getChildrenSize() && e.getTopLevelElementOrThrow().isEmpty() && null !== r && n.is(r) && (o.removeAllRanges(), n.dirty = !0);
						} else if ("touch" === t.pointerType || "pen" === t.pointerType) {
							const n = nc(o, e._rootElement).anchorNode;
							if (gc(n) || zs(n)) ol(Lr(r, o, e, t));
						}
					}
					if (i && null !== o && 0 === o.rangeCount) {
						const n = e._rootElement;
						if (null !== n && t.target === n) {
							const i = t.clientY;
							let s = n.childNodes.length;
							for (let t = 0; t < n.childNodes.length; t++) {
								const e = n.childNodes[t];
								if (gc(e)) {
									const n = e.getBoundingClientRect();
									if (i <= (n.top + n.bottom) / 2) {
										s = t;
										break;
									}
								}
							}
							o.setBaseAndExtent(n, s, n, s);
							const l = Lr(r, o, e, t);
							null !== l ? ol(l) : o.removeAllRanges();
						}
					}
					Nl(e, Ke$2, t);
				});
			}],
			["cut", Pn],
			["copy", Pn],
			["dragstart", Pn],
			["dragover", Pn],
			["dragend", Pn],
			["paste", Pn],
			["focus", Pn],
			["blur", Pn],
			["drop", Pn]
		];
		s && In.push(["beforeinput", (t, e) => function(t, e) {
			const n = t.inputType;
			if ("deleteCompositionText" === n || i && bl(e)) return;
			if ("insertCompositionText" === n) return;
			Ai(e, () => {
				qn(t, e) || Nl(e, ze$2, t);
			}, { event: t });
		}(t, e)]);
		const Ln = /* @__PURE__ */ new WeakMap(), Kn = /* @__PURE__ */ new WeakMap(), zn = Dn$1((t) => (t.addEventListener("selectionchange", ro), () => t.removeEventListener("selectionchange", ro)));
		function Bn(t, e, n, o, r, i) {
			const l = t.anchor, c = t.focus, a = l.getNode(), u = _i();
			let f;
			if (void 0 !== i) f = i;
			else {
				const t = Jl(Il(u));
				f = null !== t ? nc(t, u._rootElement) : null;
			}
			const d = null !== f ? f.anchorNode : null, h = l.key, g = u.getElementByKey(h), _ = n.length;
			return h !== c.key || !Xo(a) || (!r && (!s || u._inputState.lastBeforeInputInsertTextTimeStamp < o + 50) || a.isDirty() && _ < 2 || sl(n)) && l.offset !== c.offset && !a.isComposing() || Ks(a) || a.isDirty() && _ > 1 || (r || !s) && null !== g && !a.isComposing() && d !== wc(a, g, u) || null !== f && null !== e && (!e.collapsed || e.startContainer !== f.anchorNode || e.startOffset !== f.anchorOffset) || !a.isComposing() && (a.getFormat() !== t.format || a.getStyle() !== t.style) || function(t, e) {
				if (e.isSegmented()) return !0;
				if (!t.isCollapsed()) return !1;
				const n = t.anchor.offset, o = e.getParentOrThrow(), r = Ls(e);
				return 0 === n ? !e.canInsertTextBefore() || !o.canInsertTextBefore() && !e.isComposing() || r || function(t) {
					const e = t.getPreviousSibling();
					return (Xo(e) || Pi(e) && e.isInline()) && !e.canInsertTextAfter();
				}(e) : n === e.getTextContentSize() && (!e.canInsertTextAfter() || !o.canInsertTextAfter() && !e.isComposing() || r);
			}(t, a);
		}
		function Rn(t, e) {
			return zs(t) && null !== t.nodeValue && 0 !== e && e !== t.nodeValue.length;
		}
		function Wn(e, n, o) {
			const { anchorNode: r, anchorOffset: i, focusNode: s, focusOffset: l } = nc(e, n._rootElement), c = n._inputState;
			c.isSelectionChangeFromDOMUpdate && (c.isSelectionChangeFromDOMUpdate = !1, Rn(r, i) && Rn(s, l) && !c.postDeleteSelectionToRestore) || Ai(n, () => {
				if (!o) return void ol(null);
				if (!As(n, r, s)) return;
				let a = Kr();
				if (c.postDeleteSelectionToRestore && ur(a) && a.isCollapsed()) {
					const t = a.anchor, e = c.postDeleteSelectionToRestore.anchor;
					(t.key === e.key && t.offset === e.offset + 1 || 1 === t.offset && e.getNode().is(t.getNode().getPreviousSibling())) && (a = c.postDeleteSelectionToRestore.clone(), ol(a));
				}
				if (c.postDeleteSelectionToRestore = null, ur(a)) {
					const o = a.anchor, u = o.getNode();
					if (a.isCollapsed()) {
						"Range" === e.type && r === s && (a.dirty = !0);
						const i = Il(n).event, l = i ? i.timeStamp : performance.now(), { format: f, style: d, offset: h, key: g, timeStamp: _ } = c.collapsedSelectionFormat, p = nl(), y = !1 === n.isComposing() && "" === p.getTextContent();
						if (l < _ + 200 && o.offset === h && o.key === g) $n$1(a, f, d);
						else if ("text" === o.type) Xo(u) || t(141), Un(a, u);
						else if ("element" === o.type && !y) {
							Pi(u) || t(259);
							const e = o.getNode();
							e.isEmpty() ? function(t, e) {
								$n$1(t, e.getTextFormat(), e.getTextStyle());
							}(a, e) : $n$1(a, a.format, "");
						}
					} else {
						const t = o.key, e = a.focus.key, n = a.getNodes(), r = n.length, s = a.isBackward(), c = s ? l : i, u = s ? i : l, f = s ? e : t, d = s ? t : e;
						let h = 2047, g = !1;
						for (let t = 0; t < r; t++) {
							const e = n[t], o = e.getTextContentSize();
							if (Xo(e) && 0 !== o && !(0 === t && e.__key === f && c === o || t === r - 1 && e.__key === d && 0 === u) && (g = !0, h &= e.getFormat(), 0 === h)) break;
						}
						a.format = g ? h : 0;
					}
				}
				Nl(n, Ie$2);
			});
		}
		function $n$1(t, e, n) {
			t.format === e && t.style === n || (t.format = e, t.style = n, t.dirty = !0);
		}
		function Un(t, e) {
			$n$1(t, e.getFormat(), e.getStyle());
		}
		function Hn(t) {
			if (!t.getTargetRanges) return null;
			const e = t.getTargetRanges();
			return 0 === e.length ? null : e[0];
		}
		function jn(t) {
			const { lastKeyCode: e } = _i()._inputState;
			if (null == t || t.length <= 1 || null == e) return;
			const n = 1 === e.length ? e : "Enter" === e ? "\n" : "Tab" === e ? "	" : null;
			if (!n) return;
			const o = Kr();
			if (!ur(o) || !o.isCollapsed()) return;
			const r = o.anchor.getNode();
			if (!Xo(r)) return;
			const { offset: i } = o.anchor;
			if (r.getTextContentSize() === i) {
				const t = r.getNextSibling();
				if ("\n" === n) {
					if (Yi(t)) t.selectEnd();
					else if (!t) {
						const t = qc(r, Ar), e = t && t.getNextSibling();
						Pi(e) && e.selectStart();
					}
				} else "	" === n ? er(t) && t.selectEnd() : Xo(t) && t.getTextContent()[0] === n && t.select(1, 1);
			} else r.getTextContent()[i] === n && r.select(i + 1, i + 1);
		}
		function Jn(t) {
			t.isInsertTextAfterHandledSelectionCommand = !1, null !== t.handledSelectionCommandTimeoutId && (clearTimeout(t.handledSelectionCommandTimeoutId), t.handledSelectionCommandTimeoutId = null);
		}
		function Vn(t) {
			Jn(t), t.isInsertTextAfterHandledSelectionCommand = !0, t.handledSelectionCommandTimeoutId = setTimeout(() => Jn(t), 0);
		}
		function qn(t, e) {
			const n = ac(t);
			if (gc(n) && Rc(n, e)) return !0;
			const o = e.getRootElement();
			if (null === o) return !1;
			const r = cc(o.ownerDocument);
			return null !== r && o.contains(r) && Rc(r, e);
		}
		function Yn(e) {
			const n = e.inputType, o = Hn(e), r = _i(), i = r._inputState, s = Kr();
			if ("insertText" === n && e.data && i.isInsertTextAfterHandledSelectionCommand) {
				if (Jn(i), e.preventDefault(), ur(s) && !s.isCollapsed()) {
					const t = s.isBackward() ? s.anchor : s.focus;
					s.anchor.set(t.key, t.offset, t.type), s.focus.set(t.key, t.offset, t.type);
				}
				return !0;
			}
			if ("deleteContentBackward" === n) {
				if (null === s) {
					const t = zr();
					if (!ur(t)) return !0;
					ol(t.clone());
				}
				if (ur(s)) {
					const n = s.anchor.key === s.focus.key;
					if (function(t, e) {
						return "MediaLast" === t.lastKeyCode && e < t.lastKeyDownTimeStamp + 30;
					}(i, e.timeStamp) && r.isComposing() && n) {
						if (Vs(null), i.lastKeyDownTimeStamp = 0, setTimeout(() => {
							Ai(r, () => {
								Vs(null);
							});
						}, 30), ur(s)) {
							const e = s.anchor.getNode();
							e.markDirty(), Xo(e) || t(142), Un(s, e);
						}
					} else {
						if (Vs(null), l && null !== o && !o.collapsed && (s.applyDOMRange(o), !s.isCollapsed())) return e.preventDefault(), s.removeText(), !0;
						e.preventDefault();
						const t = s.anchor.getNode(), c = t.getTextContent(), a = t.canInsertTextAfter(), u = 0 === s.anchor.offset && s.focus.offset === c.length;
						let d = f && n && !u && a;
						if (d && s.isCollapsed() && (d = !Ki(kl(s.anchor, !0))), !d) {
							Nl(r, $e$2, !0);
							const t = Kr();
							f && ur(t) && t.isCollapsed() && (i.postDeleteSelectionToRestore = t, setTimeout(() => i.postDeleteSelectionToRestore = null));
						}
					}
					return !0;
				}
			}
			if (!ur(s)) return !0;
			const c = e.data;
			null !== i.unprocessedBeforeInputData && ul(!1, r, i.unprocessedBeforeInputData), s.dirty && null === i.unprocessedBeforeInputData || !s.isCollapsed() || Bi(s.anchor.getNode()) || null === o || s.applyDOMRange(o), i.unprocessedBeforeInputData = null;
			const a = s.anchor, u = s.focus, d = a.getNode(), h = u.getNode();
			if ("insertText" === n || "insertTranspose" === n) {
				if ("\n" === c) e.preventDefault(), Nl(r, Ue$2, !1);
				else if (c === D$1) e.preventDefault(), Nl(r, He$2);
				else if (null == c && e.dataTransfer) {
					const t = e.dataTransfer.getData("text/plain");
					e.preventDefault(), s.insertRawText(t);
				} else null != c && Bn(s, o, c, e.timeStamp, !0) ? (e.preventDefault(), Nl(r, je$2, c), jn(c)) : i.unprocessedBeforeInputData = c;
				return i.lastBeforeInputInsertTextTimeStamp = e.timeStamp, !0;
			}
			switch (e.preventDefault(), n) {
				case "insertFromYank":
				case "insertFromDrop":
				case "insertReplacementText":
					Nl(r, je$2, e);
					jn((e.dataTransfer ? e.dataTransfer.getData("text/plain") : null) ?? e.data);
					break;
				case "insertFromComposition": {
					const t = i.hadOrphanedCompositionEvents;
					i.hadOrphanedCompositionEvents = !1;
					const n = r._compositionKey;
					Vs(null), t || Nl(r, je$2, e), Zn(n);
					break;
				}
				case "insertLineBreak":
					Vs(null), Nl(r, Ue$2, !1);
					break;
				case "insertParagraph":
					Vs(null), i.isInsertLineBreak && !l ? (i.isInsertLineBreak = !1, Nl(r, Ue$2, !1)) : Nl(r, He$2);
					break;
				case "insertFromPaste":
				case "insertFromPasteAsQuotation":
					Nl(r, Je$2, e);
					break;
				case "deleteByComposition":
					(function(t, e) {
						return t !== e || Pi(t) || Pi(e) || !Ls(t) || !Ls(e);
					})(d, h) && Nl(r, Ve$2, e);
					break;
				case "deleteByDrag":
					Al(No), Nl(r, Ve$2, e);
					break;
				case "deleteByCut":
					Nl(r, Ve$2, e);
					break;
				case "deleteContent":
					Nl(r, $e$2, !1);
					break;
				case "deleteWordBackward":
					Nl(r, qe$2, !0);
export {};
