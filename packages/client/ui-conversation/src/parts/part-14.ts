/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
						attempt,
						claim: outcome.claim,
						args: argsAfter(attempt.draftSnapshot, outcome.claim.token)
					}];
				}
				this.inflight = void 0;
				this.phase = "plain";
				if (outcome !== void 0) return [];
				this.detached.set(attempt.seq, flight.controller);
				return this.detachedEffects(attempt);
			}
			onAdjudicationFailed(attempt, message) {
				if (this.phase !== "adjudicating" || this.inflight?.attempt.seq !== attempt.seq) return [];
				this.inflight = void 0;
				this.phase = "plain";
				return [{
					type: "notice",
					level: "error",
					text: message
				}];
			}
			/** Claimed command settlement; after a failure the claim follows the leading command chip again. */
			onSubmitSettled(ev) {
				const flight = this.inflight;
				if (this.phase !== "submitting" || flight === void 0 || flight.attempt.seq !== ev.attempt.seq) return [];
				this.inflight = void 0;
				if (ev.ok) {
					this.phase = "plain";
					this.claim = void 0;
					const effects = [{
						type: "commit-draft",
						retainSuffixOf: flight.attempt.draftSnapshot
					}];
					if (ev.outcome?.text !== void 0) effects.push({
						type: "notice",
						level: ev.outcome.kind === "error" ? "error" : "info",
						text: ev.outcome.text
					});
					return effects;
				}
				const text = ev.message ?? ev.outcome?.text;
				this.claim = ev.command;
				this.phase = ev.command === void 0 ? "plain" : "claimed";
				return text === void 0 ? [] : [{
					type: "notice",
					level: "error",
					text
				}];
			}
			/** Settle one ordinary send independently of current phase and other detached sends. */
			onSinkSettled(ev) {
				if (!this.detached.delete(ev.attempt.seq)) return [];
				const text = ev.message ?? ev.outcome?.text;
				if (text === void 0) return [];
				return [{
					type: "notice",
					level: ev.ok && ev.outcome?.kind !== "error" ? "info" : "error",
					text
				}];
			}
			/** Clear after an accepted attachment-only send; it has no text suffix to retain. */
			onSendCommitted() {
				if (this.phase !== "plain") return [];
				this.claim = void 0;
				return [{
					type: "commit-draft",
					retainSuffixOf: null
				}];
			}
			onRelease() {
				if (this.inflight !== void 0) {
					this.inflight.controller.abort();
					this.inflight = void 0;
				}
				for (const controller of this.detached.values()) controller.abort();
				this.detached.clear();
				this.phase = "plain";
				this.claim = void 0;
				return [];
			}
		};
		//#endregion
		//#region ../../../node_modules/.pnpm/lexical@0.49.0_typescript@6.0.3/node_modules/lexical/dist/Lexical.prod.mjs
		/**
		* Copyright (c) Meta Platforms, Inc. and affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*
		*/
		function t(t, ...e) {
			const n = new URL("https://lexical.dev/docs/error"), o = new URLSearchParams();
			o.append("code", t);
			for (const t of e) o.append("v", t);
			throw n.search = o.toString(), Error(`Minified Lexical error #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		function e(t, ...e) {
			const n = new URL("https://lexical.dev/docs/error"), o = new URLSearchParams();
			o.append("code", t);
			for (const t of e) o.append("v", t);
			n.search = o.toString(), console.warn(`Minified Lexical warning #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		const n = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement, o = n && "documentMode" in document ? document.documentMode : null, r$1 = n && /Mac|iPod|iPhone|iPad/.test(navigator.platform), i = n && /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent), s = !(!n || !("InputEvent" in window) || o) && "getTargetRanges" in new window.InputEvent("input"), l = n && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream, c = n && /Android/.test(navigator.userAgent), a = n && /Version\/[\d.]+.*Safari/.test(navigator.userAgent) && !c, u = n && /^(?=.*Chrome).*/i.test(navigator.userAgent), f = n && c && u, d$1 = n && /AppleWebKit\/[\d.]+/.test(navigator.userAgent) && r$1 && !u, h = 0, g = 1, _ = 2, b = 1, N = 2, E$1 = 3, w = 4, O$3 = 5, M$2 = 6, A = a || l || d$1 ? "\xA0" : "​", D$1 = "\n\n", F = i ? "\xA0" : A, z$1 = {
			bold: 1,
			capitalize: 1024,
			code: 16,
			highlight: 128,
			italic: 2,
			lowercase: 256,
			strikethrough: 4,
			subscript: 32,
			superscript: 64,
			underline: 8,
			uppercase: 512
		}, B = {
			directionless: 1,
			unmergeable: 2
		}, R$1 = {
			center: 2,
			end: 6,
			justify: 4,
			left: 1,
			right: 3,
			start: 5
		}, W = {
			[N]: "center",
			[M$2]: "end",
			[w]: "justify",
			[b]: "left",
			[E$1]: "right",
			[O$3]: "start"
		}, $ = {
			normal: 0,
			segmented: 2,
			token: 1
		}, U = {
			[h]: "normal",
			[_]: "segmented",
			[g]: "token"
		}, j = "$config";
		function J() {
			return vc()._blockCursorElement;
		}
		function V(t) {
			return null !== t && 1 === t.nodeType && t.hasAttribute("data-lexical-slot");
		}
		var q = class q {
			element;
			before;
			after;
			constructor(t, e, n) {
				this.element = t, this.before = e || null, this.after = n || null;
			}
			withBefore(t) {
				return new q(this.element, t, this.after);
			}
			withAfter(t) {
				return new q(this.element, this.before, t);
			}
			withElement(t) {
				return this.element === t ? this : new q(t, this.before, this.after);
			}
			insertChild(e) {
				const n = this.getInsertionAnchor();
				return null !== n && n.parentElement !== this.element && t(357), this.element.insertBefore(e, n), this;
			}
			removeChild(e) {
				return e.parentElement !== this.element && t(358), this.element.removeChild(e), this;
			}
			replaceChild(e, n) {
				return n.parentElement !== this.element && t(359), this.element.replaceChild(e, n), this;
			}
			getFirstChild() {
				const t = this.getFirstChildAnchor(), e = t ? t.nextSibling : this.element.firstChild;
				return e === this.getInsertionAnchor() ? null : e;
			}
			getFirstChildAnchor() {
				return this.after;
			}
			resolveLeafPosition(t, e, n) {
				if (this.element === t) return e === t && 0 === n ? "before" : "after";
				const o = Y(t, this.element);
				if (null === o) return "after";
				const r = Array.prototype.indexOf.call(t.childNodes, o);
				if (r < 0) return "after";
				if (e === t) return n <= r ? "before" : "after";
				const i = Y(t, e);
				if (null === i) return "after";
				const s = Array.prototype.indexOf.call(t.childNodes, i);
				return s >= 0 && s <= r ? "before" : "after";
			}
			getInsertionAnchor() {
				return this.before;
			}
		};
		function Y(t, e) {
			let n = e;
			for (; null !== n && n.parentNode !== t;) n = n.parentNode;
			return n;
		}
		var G = class G extends q {
			withBefore(t) {
				return new G(this.element, t, this.after);
			}
			withAfter(t) {
				return new G(this.element, this.before, t);
			}
			withElement(t) {
				return this.element === t ? this : new G(t, this.before, this.after);
			}
			getInsertionAnchor() {
				return super.getInsertionAnchor() || this.getManagedLineBreak();
			}
			getFirstChildAnchor() {
				let t = super.getFirstChildAnchor(), e = t ? t.nextSibling : this.element.firstChild;
				for (; V(e);) t = e, e = e.nextSibling;
				const n = t ? t.nextSibling : this.element.firstChild;
				return null !== n && n === J() ? n : t;
			}
			getManagedLineBreak() {
				return this.element.__lexicalLineBreak || null;
			}
			setManagedLineBreak(t) {
				if (this.element.__lexicalLastChildKind = t, null === t) this.removeManagedLineBreak();
				else {
					const e = "decorator" === t && (d$1 || l || a);
					this.insertManagedLineBreak(e);
				}
			}
			removeManagedLineBreak() {
				const t = this.getManagedLineBreak();
				if (t) {
					const e = this.element, n = "IMG" === t.nodeName ? t.nextSibling : null;
					n && e.removeChild(n), e.removeChild(t), e.__lexicalLineBreak = void 0;
				}
			}
			insertManagedLineBreak(t) {
				const e = this.getManagedLineBreak();
				if (e) {
					if (t === ("IMG" === e.nodeName)) return;
					this.removeManagedLineBreak();
				}
				const n = this.element, o = this.before, r = Zl().createElement("br");
				if (r.setAttribute("data-lexical-managed-linebreak", "true"), n.insertBefore(r, o), t) {
					const t = Zl().createElement("img");
					t.setAttribute("data-lexical-managed-linebreak", "true"), t.style.setProperty("display", "inline", "important"), t.style.setProperty("border", "0px", "important"), t.style.setProperty("margin", "0px", "important"), t.alt = "", n.insertBefore(t, r), n.__lexicalLineBreak = t;
				} else n.__lexicalLineBreak = r;
			}
			getFirstChildOffset() {
				const t = this.getFirstChild(), e = this.getInsertionAnchor();
				let n = 0;
				for (let o = this.element.firstChild; null !== o && o !== t && o !== e; o = o.nextSibling) n++;
				return n;
			}
			resolveChildIndex(t, e, n, o) {
				if (n === this.element) {
					const e = this.getFirstChildOffset(), n = J(), r = this.element.childNodes, i = Math.min(o, r.length);
					let s = 0;
					for (let t = e; t < i; t++) r[t] !== n && s++;
					return [t, Math.min(s, t.getChildrenSize())];
				}
				const r = X(e, n);
				r.push(o);
				const i = X(e, this.element);
				let s = t.getIndexWithinParent();
				for (let t = 0; t < i.length; t++) {
					const e = r[t], n = i[t];
					if (void 0 === e || e < n) break;
					if (e > n) {
						s += 1;
						break;
					}
				}
				return [t.getParentOrThrow(), s];
			}
		};
		function X(e, n) {
			const o = [];
			let r = n;
			for (; r !== e && null !== r; r = r.parentNode) {
				let t = 0;
				for (let e = r.previousSibling; null !== e; e = e.previousSibling) t++;
				o.push(t);
			}
			return r !== e && t(225), o.reverse();
		}
		let Q;
		try {
			Q = "0.49.0+prod.esm";
		} catch (t) {}
		const Z$1 = Q ?? "\"<unknown>+source\"";
		var tt = class {
			_front = /* @__PURE__ */ new Set();
			_back = /* @__PURE__ */ new Set();
			_cache;
			get size() {
				return this._front.size + this._back.size;
			}
			addBack(t) {
				return delete this._cache, this._front.has(t) || this._back.add(t), this;
			}
			addFront(t) {
				return delete this._cache, this._back.has(t) || this._front.add(t), this;
			}
			delete(t) {
				return delete this._cache, this._front.delete(t) || this._back.delete(t);
			}
			toArray() {
				const t = Array.from(this._front).reverse();
				for (const e of this._back) t.push(e);
				return t;
			}
			toReadonlyArray() {
				return this._cache = this._cache || this.toArray(), this._cache;
			}
			[Symbol.iterator]() {
				return this.toReadonlyArray()[Symbol.iterator]();
			}
		};
		const et$1 = null;
		function nt$2(t, e = 1e3) {
			return t instanceof ot$1 ? t.clone() : t.size < e ? new Map(t) : new ot$1().init(new Map(t), void 0, t.size);
		}
		var ot$1 = class ot$1 {
			_mutable = !1;
			_old = void 0;
			_nursery = void 0;
			_size = 0;
			clone() {
				return this._mutable = !1, new ot$1().init(this._old, this._nursery, this._size);
			}
			init(t, e, n) {
				return this._old = t, this._nursery = e, this._size = n, this;
			}
			get size() {
				return this._size;
			}
			has(t) {
				return void 0 !== this.get(t);
			}
			getWithTombstone(t) {
				const e = this._nursery && this._nursery.get(t);
				return void 0 !== e ? e : this._old && this._old.get(t);
			}
			get(t) {
				const e = this.getWithTombstone(t);
				return e === et$1 ? void 0 : e;
			}
			shouldCompact() {
				return void 0 !== this._nursery && 2 * this._nursery.size > this._size;
			}
			getNursery() {
				return this._mutable && this._nursery || (this.compact(), this._nursery = new Map(this._nursery), this._mutable = !0), this._nursery;
			}
			compact(t = !1) {
				if (this._nursery && this._nursery.size > 0 && (t || this.shouldCompact())) {
					const t = new Map(this._old);
					for (const [e, n] of this._nursery) n !== et$1 ? t.set(e, n) : t.delete(e);
					this._old = t, this._nursery = void 0;
				}
				return this._mutable = !1, this;
			}
			set(t, e) {
				const n = this.getWithTombstone(t);
				if (n === e) return this;
				const o = this.getNursery();
				return n !== et$1 && void 0 !== n || (this._size++, n === et$1 && o.delete(t)), o.set(t, e), this;
			}
			delete(t) {
				const e = this.has(t);
				return e && (this.getNursery().set(t, et$1), this._size--), e;
			}
			getOrInsert(t, e) {
				const n = this.get(t);
				return void 0 !== n ? n : (this.set(t, e), e);
			}
			getOrInsertComputed(t, e) {
				const n = this.get(t);
				if (void 0 !== n) return n;
				const o = e(t);
				return this.set(t, o), o;
			}
			clear() {
				this._mutable = !1, this._old = void 0, this._nursery = void 0, this._size = 0;
			}
			*keys() {
				for (const t of this.entries()) yield t[0];
			}
			*values() {
				for (const t of this.entries()) yield t[1];
			}
			*entries() {
				const t = this._nursery, e = this._old;
				if (e) for (const n of e) {
					const e = n[0], o = t ? t.get(e) : void 0;
					o !== et$1 && (void 0 !== o && (n[1] = o), yield n);
				}
				if (t) for (const n of t) n[1] === et$1 || e && e.has(n[0]) || (yield n);
			}
			forEach(t, e) {
export {};
