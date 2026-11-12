/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				return renderChainResult(slotKey, elected, opts, Anchor);
			}
			const rows = host.entriesOfSlot(slotKey).map((entry) => ({
				entry,
				id: entry.options.id,
				order: entry.options.order ?? 0
			}));
			const rowIds = new Set(rows.map((row) => row.id));
			for (const entry of entries) {
				if (rowIds.has(entry.options.id)) continue;
				rowIds.add(entry.options.id);
				rows.push({
					entry: void 0,
					id: entry.options.id,
					order: entry.options.order ?? 0
				});
			}
			let list = [...rows].sort((a, b) => a.order - b.order);
			if (opts?.only !== void 0) list = list.filter((item) => item.id === opts.only);
			if (list.length === 0) return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: opts?.fallback ?? null });
			return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: list.map((item, i) => item.entry !== void 0 ? guarded(item.entry, `e${entryKeyOf(item.entry)}`) : (0, react_jsx_runtime.jsx)(Anchor, { "data-slot-error": slotKey }, `x${item.id ?? i}`)) });
		}
		/** Render a chain election while preserving the overlay fallback's tree position. */
		function renderChainResult(slotKey, elected, opts, Anchor) {
			if (!opts?.overlay) return elected ?? (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: opts?.fallback ?? null });
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(Anchor, {
				"data-chain-overlay-fallback": slotKey,
				style: { display: elected === null ? "contents" : "none" },
				children: opts.fallback ?? null
			}), elected] });
		}
		/** Root outlet: the shell's single ctx-level render entry — an unregistered 'root' is a boot-order failure, never a silent blank. */
		function RootOutlet({ ownerProps }) {
			const host = useHost();
			(0, react.useSyncExternalStore)((fn) => host.subscribe("root", fn), () => host.getVersion("root"));
			useLocaleRevision(host.locale);
			const entry = host.entriesOfSlot("root")[0];
			if (!entry) {
				if (host.entriesOf("root").length > 0) return (0, react_jsx_runtime.jsx)("div", { "data-slot-error": "root" });
				throw new SlotAssemblyError("renderSlot('root') before any 'root' registration (boot order)");
			}
			return (0, react_jsx_runtime.jsx)("div", {
				"data-slot": "root",
				style: ANCHOR_STYLE,
				children: (0, react_jsx_runtime.jsx)(SlotErrorBoundary, {
					slotKey: "root",
					onEntryError: (error) => {
						host.reportEntryError("root", entry, error, { abdicate: true });
					},
					children: (0, react_jsx_runtime.jsx)(RootEntry, {
						entry,
						ownerProps,
						slotKey: "root",
						slotInjected: EMPTY_SLOT_INJECT,
						hookContext: void 0,
						hasHookContext: false
					})
				}, entryKeyOf(entry))
			});
		}
		/**
		* Build the renderer installed into the `ui-renderer` SlotRegistry
		* (ctx.slots.install(createSlotRenderer()) at boot; the service owns the
		* install/renderSlot contract and the double-install/not-installed throws).
		* @returns the renderer.
		*/
		function createSlotRenderer() {
			return { renderRoot(host, ownerProps) {
				return (0, react_jsx_runtime.jsx)(HostContext.Provider, {
					value: host,
					children: (0, react_jsx_runtime.jsx)(RootStandardProvider, { children: (0, react_jsx_runtime.jsx)(ScopeProvider, {
						scope: "session-maybe",
						children: (0, react_jsx_runtime.jsx)(RootOutlet, { ownerProps })
					}) })
				});
			} };
		}
		//#endregion
		//#region lib/types/client/app.js
		/**
		* Build the assembled application factory.
		* @param deps - Active UI-renderer dependencies.
		* @returns Factory producing the application React tree.
		*/
		function buildRenderApp(deps) {
			const { ctx } = deps;
			return () => ctx.slots.renderSlot("root", {});
		}
		//#endregion
		//#region lib/types/client/registry.js
		/**
		* SlotRegistry: the renderer-owned Cordis service over the pure
		* SlotCore (ui-slots owns registration semantics, the declaration ledger,
		* the load-time validations, and the unload cascade). This layer owns what
		* needs a live application: the 'slots/changed' event bridge, register and
		* declaration injection through the caller's ctx.effect (fiber unload
		* collects both), the renderer installation contract (install()/renderSlot('root') +
		* the SlotRendererHost face), and the store INSTANCE axis — handle x scope
		* key -> create/cache, dropped with the last holding entry, and in-memory
		* session instances released without clearing persisted state on scope death.
		*/
		/** Instance key for root-scoped store records (session records key by session id, so the literal cannot collide). */
		const ROOT_INSTANCE_KEY = "root";
		/** cordis Service layer of the slot system; see the module doc for the split with SlotCore. */
		var SlotRegistry = class extends _deepseek_ai_cordis.Service {
			_core = new _deepseek_ai_dsh_client_ui_slots.SlotCore();
			/** Store-instance axis: handle -> mounted scope, refcount, resolved instances. */
			_stores = /* @__PURE__ */ new Map();
			_factoryStores = /* @__PURE__ */ new Map();
			/** Latest live Context generation for each scoped store key. */
			_storeScopeOwners = /* @__PURE__ */ new Map();
			_renderer;
			_locale;
			_host;
			_rootContributions = [];
			_rootListeners = /* @__PURE__ */ new Set();
			_rootBinding = {
				key: void 0,
				hooks: {},
				keyedHooks: {},
				props: {}
			};
			_rootSource = {
				getSnapshot: () => this._rootBinding,
				subscribe: (listener) => {
					this._rootListeners.add(listener);
					return () => {
						this._rootListeners.delete(listener);
					};
				}
			};
			_scopes = /* @__PURE__ */ new Map();
			_scopeRevision = 0;
			_scopeListeners = /* @__PURE__ */ new Set();
			_scopeRevisionSource = {
				getSnapshot: () => this._scopeRevision,
				subscribe: (listener) => {
					this._scopeListeners.add(listener);
					return () => {
						this._scopeListeners.delete(listener);
					};
				}
			};
			/**
			* @param ctx - owning root context.
			*/
			constructor(ctx) {
				super(ctx, "slots");
				this._core.onMutate((key) => {
					ctx.emit("slots/changed", key);
				});
			}
			/**
			* Install an effect for each declaration lifetime of a slot. The callback
			* runs synchronously when the declaration already exists; otherwise it runs
			* inside the declaring `register()` call after the declaration is committed.
			* Collapse disposes the effect and a later declaration runs it again.
			* Callback effects are synchronous disposers; iterable effects install
			* transactionally and dispose in reverse order. The controller belongs to
			* the caller's fiber, so plugin unload cancels a pending wait and removes any
			* active contribution.
			*
			* @param key - declared SlotMap key to depend on.
			* @param callback - creates one disposer or an iterable of disposers.
			* @returns idempotent disposer for the wait and active effect.
			* @throws callback setup failures synchronously when the slot is already declared.
			*/
			inject(key, callback) {
				const ctx = this.ctx;
				const disposeController = ctx.effect(() => {
					let active;
					let activeEpoch;
					let stopped = false;
					let unsubscribe = () => {};
					const stop = () => {
						if (stopped) return;
						stopped = true;
						unsubscribe();
						const dispose = active;
						active = void 0;
						activeEpoch = void 0;
						dispose?.();
					};
					const reconcile = () => {
						if (stopped) return;
						const spec = this._core.specDynamic(key);
						const epoch = this._core.declarationEpoch(key);
						if (active !== void 0 && activeEpoch === epoch) return;
						const dispose = active;
						active = void 0;
						activeEpoch = void 0;
						dispose?.();
						if (spec === void 0) return;
						const disposeEffect = ctx.effect(callback, `slots.inject(${JSON.stringify(key)}): declaration`);
						active = () => {
							disposeEffect();
						};
						activeEpoch = epoch;
					};
					const changed = () => {
						try {
							reconcile();
						} catch (error) {
							if (error?.code === "INACTIVE_EFFECT") {
								stop();
								return;
							}
							stop();
							const failure = error instanceof Error ? error : new Error(String(error));
							queueMicrotask(() => {
								throw failure;
							});
						}
					};
					unsubscribe = this._core.subscribeDeclaration(key, changed);
					try {
						reconcile();
					} catch (error) {
						stop();
						throw error;
					}
					return stop;
				}, `slots.inject(${JSON.stringify(key)})`);
				return () => {
					disposeController();
				};
			}
			/**
			* Install the shell's renderer (ui-renderer's createSlotRenderer product).
			* Boot-once: a second install throws. Runs through the caller's ctx.effect,
			* so shell fiber unload uninstalls the renderer.
			* @param renderer - the outlet machinery implementing SlotRenderer.
			*/
			install(renderer) {
				if (this._renderer !== void 0) throw new Error("slot renderer already installed (install() is boot-once)");
				this.ctx.effect(() => {
					this._renderer = renderer;
					return () => {
						if (this._renderer === renderer) this._renderer = void 0;
					};
				}, "slots.install()");
			}
			/**
			* Install the locale face backing the `t` standard seat (the locale
			* plugin's product; same boot-once discipline as the renderer install).
			* Runs through the caller's ctx.effect, so the installing fiber's unload
			* uninstalls the face.
			* @param face - namespace binder + revision observable.
			*/
			installLocale(face) {
				if (this._locale !== void 0) throw new Error("locale face already installed (installLocale() is boot-once)");
				this.ctx.effect(() => {
					this._locale = face;
					return () => {
						if (this._locale === face) this._locale = void 0;
					};
				}, "slots.installLocale()");
			}
			/**
			* Contribute domain-owned root data. Hook names must be globally unique;
			* registration and disposal republish one atomic root binding.
			* @param contribution - bare sources and stable props.
			* @returns disposer owned by the caller's Cordis fiber.
			*/
			provideRoot(contribution) {
				const dispose = this.ctx.effect(() => {
					this._rootContributions.push(contribution);
					try {
						this.rebuildRootBinding();
					} catch (error) {
						this._rootContributions.pop();
						throw error;
					}
					return () => {
						const index = this._rootContributions.indexOf(contribution);
						if (index === -1) return;
						this._rootContributions.splice(index, 1);
						this.rebuildRootBinding();
					};
				}, "slots.provideRoot()");
				return () => {
					dispose();
				};
			}
			/**
			* Install the owner adapter for one strict scope. Its optional counterpart
			* resolves through the same adapter.
			* @param scope - strict scope name.
			* @param adapter - current/resolved binding source and release notifications.
			*/
			installScope(scope, adapter) {
				if (this._scopes.has(scope)) throw new Error(`slot scope '${scope}' already has an adapter`);
				this.ctx.effect(() => {
					this._scopes.set(scope, adapter);
					this.publishScopeRevision();
					return () => {
						if (this._scopes.get(scope) === adapter) {
							this._scopes.delete(scope);
							this.publishScopeRevision();
						}
					};
				}, `slots.installScope(${JSON.stringify(scope)})`);
			}
			/**
			* Bind scoped Store instances to one Context generation. Rebinding the key
			* drops the previous generation's memory instances before the new owner can
			* resolve them. Cleanup never clears persisted state, which belongs to the
			* durable scope key, or drops a replacement generation's instances.
			*
			* @param binding - materialized scope identity and its owning Context.
			*/
			bindStoreScope(binding) {
				const current = this._storeScopeOwners.get(binding.key);
				if (current === binding.ctx) return;
				if (current !== void 0) this.releaseStoreScope(binding.key);
				this._storeScopeOwners.set(binding.key, binding.ctx);
				binding.ctx.effect(() => () => {
					if (this._storeScopeOwners.get(binding.key) !== binding.ctx) return;
					this._storeScopeOwners.delete(binding.key);
					this.releaseStoreScope(binding.key);
				}, `slots: store scope ${binding.key}`);
			}
			/**
			* The single ctx-level render entry: the shell renders 'root'; every other
			* key renders inside components through the props renderSlot face. All
			* three guards are fail-loud boot-order checks, no fallback.
			* @param key - must be 'root' (runtime-enforced for dynamically composed callers).
			* @param owner - owner share for the root entry (the shell supplies {}).
			* @returns the rendered root tree.
			*/
			renderSlot(key, owner) {
				if (key !== "root") throw new Error(`ctx-level renderSlot only renders 'root' (got "${key}"); child slots render through the component props face`);
				if (this._renderer === void 0) throw new Error("slot renderer not installed — boot must call ctx.slots.install(createSlotRenderer()) before rendering 'root'");
				if (this._core.entries("root").length === 0) throw new Error("'root' has no registration — a layout entry must register into 'root' before the shell renders it");
				return this._renderer.renderRoot(this.hostFace(), owner);
			}
			/**
			* Snapshot entries for a key (render-erased view; stable reference between mutations).
			* @param key - SlotMap key.
			* @returns registered entries.
			*/
			entries(key) {
				return this._core.entries(key);
			}
			/**
			* Shadowing winners per cell for a key: the first live (non-abdicated)
			* entry of each cell in priority order — what outlets render; chain keys
			* pass through unchanged (election consumes every entry). The raw
			* {@link SlotRegistry.entries} view stays the inspection surface. Fresh
			* array per call, not a uSES getSnapshot source.
			* @param key - SlotMap key.
			* @returns the winning entry per occupied cell.
			*/
			entriesOfSlot(key) {
				return this._core.entriesOfSlot(key);
			}
			/**
			* Export the current JSON-safe Slot and Factory declaration trees for read-only inspection.
			* @param root - exact live Slot key or `factory:<name>`; omitted returns all roots.
			* @returns selected composition trees.
			*/
			snapshot(root) {
				return this._core.snapshot(root);
			}
			/**
			* Observe ordinary entry and Factory occurrence crashes through one
			* supervision channel. Fires synchronously after any ordinary-entry
			* abdication mutation. Callers own the disposer (wire it through ctx.effect
			* for fiber-lifetime cleanup, as with {@link SlotRegistry.subscribe}).
			* @param fn - called with the Slot or `factory:<name>` key, crashed
			* registration, cause, and whether an ordinary entry was retired.
			* @returns unsubscribe.
			*/
			onEntryError(fn) {
				return this._core.onEntryError(fn);
			}
			/**
			* Look up a declared spec (register-declared or the built-in 'root').
			* @param key - SlotMap key.
			* @returns spec or undefined.
			*/
			spec(key) {
				return this._core.spec(key);
			}
			/**
			* Subscribe to a key's registration changes (microtask-batched).
			* @param key - SlotMap key.
			* @param fn - change callback.
			* @returns unsubscribe.
			*/
			subscribe(key, fn) {
				return this._core.subscribe(key, fn);
			}
			/**
			* Version counter for uSES pairing.
			* @param key - SlotMap key.
			* @returns current version.
			*/
			getVersion(key) {
				return this._core.getVersion(key);
export {};
