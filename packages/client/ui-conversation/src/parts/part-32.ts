/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			}
			return Tt$1 = t, te$1(this), this.f &= -2, !0;
		}, ee$1.prototype.S = function(t) {
			if (void 0 === this.t) {
				this.f |= 36;
				for (let t = this.s; void 0 !== t; t = t.n) t.S.S(t);
			}
			Xt$1.prototype.S.call(this, t);
		}, ee$1.prototype.U = function(t) {
			if (void 0 !== this.t && (Xt$1.prototype.U.call(this, t), void 0 === this.t)) {
				this.f &= -33;
				for (let t = this.s; void 0 !== t; t = t.n) t.S.U(t);
			}
		}, ee$1.prototype.N = function() {
			if (!(2 & this.f)) {
				this.f |= 6;
				for (let t = this.t; void 0 !== t; t = t.x) t.t.N();
			}
		}, Object.defineProperty(ee$1.prototype, "value", { get() {
			if (1 & this.f) throw new Error("Cycle detected");
			const t = Jt$1(this);
			if (this.h(), void 0 !== t && (t.i = this.i), 16 & this.f) throw this.v;
			return this.v;
		} }), re$1.prototype.c = function() {
			const t = this.S();
			try {
				if (8 & this.f) return;
				if (void 0 === this.x) return;
				const t = this.x();
				"function" == typeof t && (this.m = t);
			} finally {
				t();
			}
		}, re$1.prototype.S = function() {
			if (1 & this.f) throw new Error("Cycle detected");
			this.f |= 1, this.f &= -9, ie$1(this), Qt$1(this), Bt$1++;
			const t = Tt$1;
			return Tt$1 = this, se$1.bind(this, t);
		}, re$1.prototype.N = function() {
			2 & this.f || (this.f |= 2, this.u = zt$1, zt$1 = this);
		}, re$1.prototype.d = function() {
			this.f |= 8, 1 & this.f || oe$1(this);
		}, re$1.prototype.dispose = function() {
			this.d();
		};
		function ve$1(t) {
			return ("function" == typeof t.nodes ? t.nodes() : t.nodes) || [];
		}
		function Ie$1(t, ...e) {
			const n = new URL("https://lexical.dev/docs/error"), i = new URLSearchParams();
			i.append("code", t);
			for (const t of e) i.append("v", t);
			throw n.search = i.toString(), Error(`Minified Lexical error #${t}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
		}
		let Fe$1;
		try {
			Fe$1 = "0.49.0+prod.esm";
		} catch (t) {}
		const Me$1 = Fe$1 ?? "\"<unknown>+source\"", ke$1 = new Set([
			"__proto__",
			"constructor",
			"prototype"
		]);
		function _e$1(t, e) {
			if (t && e && !Array.isArray(e) && "object" == typeof t && "object" == typeof e) {
				const n = t, i = e;
				for (const t in i) !ke$1.has(t) && Object.prototype.hasOwnProperty.call(i, t) && (n[t] = _e$1(n[t], i[t]));
				return t;
			}
			return e;
		}
		const Ae$1 = 0, Pe$1 = 1, Le$1 = 2, Ke$1 = 3, $e$1 = 4, je$1 = 5, Te$1 = 6, ze$1 = 7;
		function Ue$1(t) {
			return t.id === Ae$1;
		}
		function We$1(t) {
			return t.id === Le$1;
		}
		function Be$1(t) {
			return function(t) {
				return t.id === Pe$1;
			}(t) || Ie$1(305, String(t.id), String(Pe$1)), Object.assign(t, { id: Le$1 });
		}
		const Ve$1 = /* @__PURE__ */ new Set();
		var Ge$1 = class {
			builder;
			configs;
			_dependency;
			_peerNameSet;
			extension;
			state;
			_signal;
			constructor(t, e) {
				this.builder = t, this.extension = e, this.configs = /* @__PURE__ */ new Set(), this.state = { id: Ae$1 };
			}
			mergeConfigs() {
				let t = this.extension.config || {};
				const e = this.extension.mergeConfig ? this.extension.mergeConfig.bind(this.extension) : Tu;
				for (const n of this.configs) t = e(t, n);
				return t;
			}
			init(t) {
				const e = this.state;
				We$1(e) || Ie$1(306, String(e.id));
				const n = {
					getDependency: this.getInitDependency.bind(this),
					getDirectDependentNames: this.getDirectDependentNames.bind(this),
					getPeer: this.getInitPeer.bind(this),
					getPeerNameSet: this.getPeerNameSet.bind(this)
				}, i = {
					...n,
					getDependency: this.getDependency.bind(this),
					getInitResult: this.getInitResult.bind(this),
					getPeer: this.getPeer.bind(this)
				}, o = function(t, e, n) {
					return Object.assign(t, {
						config: e,
						id: Ke$1,
						registerState: n
					});
				}(e, this.mergeConfigs(), n);
				let s;
				this.state = o, this.extension.init && (s = this.extension.init(t, o.config, n)), this.state = function(t, e, n) {
					return Object.assign(t, {
						id: $e$1,
						initResult: e,
						registerState: n
					});
				}(o, s, i);
			}
			build(t) {
				const e = this.state;
				let n;
				e.id !== $e$1 && Ie$1(307, String(e.id), String(je$1)), this.extension.build && (n = this.extension.build(t, e.config, e.registerState));
				const i = {
					...e.registerState,
					getOutput: () => n,
					getSignal: this.getSignal.bind(this)
				};
				this.state = function(t, e, n) {
					return Object.assign(t, {
						id: je$1,
						output: e,
						registerState: n
					});
				}(e, n, i);
			}
			register(t, e) {
				this._signal = e;
				const n = this.state;
				n.id !== je$1 && Ie$1(308, String(n.id), String(je$1));
				const i = this.extension.register && this.extension.register(t, n.config, n.registerState);
				return this.state = function(t) {
					return Object.assign(t, { id: Te$1 });
				}(n), () => {
					const t = this.state;
					t.id !== ze$1 && Ie$1(309, String(n.id), String(ze$1)), this.state = function(t) {
						return Object.assign(t, { id: je$1 });
					}(t), i && i();
				};
			}
			afterRegistration(t) {
				const e = this.state;
				let n;
				return e.id !== Te$1 && Ie$1(310, String(e.id), String(Te$1)), this.extension.afterRegistration && (n = this.extension.afterRegistration(t, e.config, e.registerState)), this.state = function(t) {
					return Object.assign(t, { id: ze$1 });
				}(e), n;
			}
			getSignal() {
				return void 0 === this._signal && Ie$1(311), this._signal;
			}
			getInitResult() {
				void 0 === this.extension.init && Ie$1(312, this.extension.name);
				const t = this.state;
				return function(t) {
					return t.id >= $e$1;
				}(t) || Ie$1(313, String(t.id), String($e$1)), t.initResult;
			}
			getInitPeer(t) {
				const e = this.builder.extensionNameMap.get(t);
				return e ? e.getExtensionInitDependency() : void 0;
			}
			getExtensionInitDependency() {
				const t = this.state;
				return function(t) {
					return t.id >= Ke$1;
				}(t) || Ie$1(314, String(t.id), String(Ke$1)), { config: t.config };
			}
			getPeer(t) {
				const e = this.builder.extensionNameMap.get(t);
				return e ? e.getExtensionDependency() : void 0;
			}
			getInitDependency(t) {
				const e = this.builder.getExtensionRep(t);
				return void 0 === e && Ie$1(315, this.extension.name, t.name), e.getExtensionInitDependency();
			}
			getDependency(t) {
				const e = this.builder.getExtensionRep(t);
				return void 0 === e && Ie$1(315, this.extension.name, t.name), e.getExtensionDependency();
			}
			getState() {
				const t = this.state;
				return function(t) {
					return t.id >= ze$1;
				}(t) || Ie$1(316, String(t.id), String(ze$1)), t;
			}
			getDirectDependentNames() {
				return this.builder.incomingEdges.get(this.extension.name) || Ve$1;
			}
			getPeerNameSet() {
				let t = this._peerNameSet;
				return t || (t = new Set((this.extension.peerDependencies || []).map(([t]) => t)), this._peerNameSet = t), t;
			}
			getExtensionDependency() {
				if (!this._dependency) {
					const t = this.state;
					(function(t) {
						return t.id >= je$1;
					})(t) || Ie$1(317, this.extension.name), this._dependency = {
						config: t.config,
						init: t.initResult,
						output: t.output
					};
				}
				return this._dependency;
			}
		};
		const Ze$1 = { tag: xo };
		function He$1() {
			const t = nl();
			t.isEmpty() && t.append(es());
		}
		const Je$1 = /* @__PURE__ */ xu({
			config: /* @__PURE__ */ vu({
				setOptions: Ze$1,
				updateOptions: Ze$1
			}),
			init: ({ $initialEditorState: t = He$1 }) => ({
				$initialEditorState: t,
				initialized: !1
			}),
			afterRegistration(t, { updateOptions: e, setOptions: n }, i) {
				const o = i.getInitResult();
				if (!o.initialized) {
					o.initialized = !0;
					const { $initialEditorState: i } = o;
					if (Ui(i)) t.setEditorState(i, n);
					else if ("function" == typeof i) t.update(() => {
						i(t);
					}, e);
					else if (i && ("string" == typeof i || "object" == typeof i)) {
						const e = t.parseEditorState(i);
						t.setEditorState(e, n);
					}
				}
				return () => {};
			},
			name: "@lexical/extension/InitialState",
			nodes: [
				zi,
				Wo,
				Ji,
				Zo,
				Zi
			]
		}), Xe$1 = Symbol.for("@lexical/extension/LexicalBuilder");
		function qe$1() {}
		function Qe$1(t) {
			throw t;
		}
		function tn$1(t) {
			return Array.isArray(t) ? t : [t];
		}
		const en$2 = Me$1;
		var nn$1 = class nn$1 {
			roots;
			extensionNameMap;
			outgoingConfigEdges;
			incomingEdges;
			conflicts;
			_sortedExtensionReps;
			PACKAGE_VERSION;
			constructor(t) {
				this.outgoingConfigEdges = /* @__PURE__ */ new Map(), this.incomingEdges = /* @__PURE__ */ new Map(), this.extensionNameMap = /* @__PURE__ */ new Map(), this.conflicts = /* @__PURE__ */ new Map(), this.PACKAGE_VERSION = en$2, this.roots = t;
				for (const e of t) this.addExtension(e);
			}
			static fromExtensions(t) {
				const e = [tn$1(Je$1)];
				for (const n of t) e.push(tn$1(n));
				return new nn$1(e);
			}
			static maybeFromEditor(t) {
				const e = t[Xe$1];
				return e && (e.PACKAGE_VERSION !== en$2 && Ie$1(292, e.PACKAGE_VERSION, en$2), e instanceof nn$1 || Ie$1(293)), e;
			}
			static fromEditor(t) {
				const e = nn$1.maybeFromEditor(t);
				return void 0 === e && Ie$1(294), e;
			}
			constructEditor() {
				const { $initialEditorState: t, onError: e, onWarn: n, ...i } = this.buildCreateEditorArgs(), o = Object.assign(ys({
					...i,
					...e ? { onError: (t) => {
						e(t, o);
					} } : {},
					...n ? { onWarn: (t) => {
						n(t, o);
					} } : {}
				}), { [Xe$1]: this });
				for (const t of this.sortedExtensionReps()) t.build(o);
				return o;
			}
			buildEditor() {
				let t = qe$1;
				function e() {
					try {
						t();
					} finally {
						t = qe$1;
					}
				}
				const n = Object.assign(this.constructEditor(), {
					dispose: e,
					[Symbol.dispose]: e
				});
				return t = Eu(this.registerEditor(n), () => n.setRootElement(null)), n;
			}
			hasExtensionByName(t) {
				return this.extensionNameMap.has(t);
			}
			getExtensionRep(t) {
				const e = this.extensionNameMap.get(t.name);
				if (e) return e.extension !== t && Ie$1(295, t.name), e;
			}
			addEdge(t, e, n) {
				const i = this.outgoingConfigEdges.get(t);
				i ? i.set(e, n) : this.outgoingConfigEdges.set(t, new Map([[e, n]]));
				const o = this.incomingEdges.get(e);
				o ? o.add(t) : this.incomingEdges.set(e, new Set([t]));
			}
			addExtension(t) {
				void 0 !== this._sortedExtensionReps && Ie$1(296);
				const [n] = tn$1(t);
				"string" != typeof n.name && Ie$1(297, typeof n.name);
				let i = this.extensionNameMap.get(n.name);
				if (void 0 !== i && i.extension !== n && Ie$1(298, n.name), !i) {
					i = new Ge$1(this, n), this.extensionNameMap.set(n.name, i);
					const t = this.conflicts.get(n.name);
					"string" == typeof t && Ie$1(299, n.name, t);
					for (const t of n.conflictsWith || []) this.extensionNameMap.has(t) && Ie$1(299, n.name, t), this.conflicts.set(t, n.name);
					for (const t of n.dependencies || []) {
						const e = tn$1(t);
						this.addEdge(n.name, e[0].name, e.slice(1)), this.addExtension(e);
					}
					for (const [t, e] of n.peerDependencies || []) this.addEdge(n.name, t, e ? [e] : []);
				}
			}
			sortedExtensionReps() {
				if (this._sortedExtensionReps) return this._sortedExtensionReps;
				const t = [], e = (n, i) => {
					let o = n.state;
					if (We$1(o)) return;
					const s = n.extension.name;
					var r;
					Ue$1(o) || Ie$1(300, s, i || "[unknown]"), Ue$1(r = o) || Ie$1(304, String(r.id), String(Ae$1)), o = Object.assign(r, { id: Pe$1 }), n.state = o;
					const c = this.outgoingConfigEdges.get(s);
					if (c) for (const t of c.keys()) {
						const n = this.extensionNameMap.get(t);
						n && e(n, s);
					}
					o = Be$1(o), n.state = o, t.push(n);
				};
				for (const t of this.extensionNameMap.values()) Ue$1(t.state) && e(t);
				for (const e of t) for (const [t, n] of this.outgoingConfigEdges.get(e.extension.name) || []) if (n.length > 0) {
					const e = this.extensionNameMap.get(t);
					if (e) for (const t of n) e.configs.add(t);
				}
				for (const [t, ...e] of this.roots) if (e.length > 0) {
					const n = this.extensionNameMap.get(t.name);
					void 0 === n && Ie$1(301, t.name);
					for (const t of e) n.configs.add(t);
				}
				return this._sortedExtensionReps = t, this._sortedExtensionReps;
			}
			registerEditor(t) {
				const e = this.sortedExtensionReps(), n = new AbortController(), i = [() => n.abort()], o = n.signal;
				for (const n of e) {
					const e = n.register(t, o);
					e && i.push(e);
				}
				for (const n of e) {
					const e = n.afterRegistration(t);
					e && i.push(e);
				}
				return Eu(...i);
			}
			buildCreateEditorArgs() {
				const t = {}, e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), o = {}, s = {}, r = this.sortedExtensionReps();
				for (const c of r) {
					const { extension: r } = c;
export {};
