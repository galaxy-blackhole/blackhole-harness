/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			}
			/** Delegating registration path: factory minting + registrant stamp + core write + instance-axis bookkeeping. */
			_register(options, component) {
				const store = typeof options.store === "function" ? options.store() : options.store;
				const registrant = options.registrant ?? this.ctx.fiber?.name;
				const erased = {
					...options,
					...store !== void 0 ? { store } : {},
					...registrant !== void 0 ? { registrant } : {}
				};
				const dispose = this._core.register(erased, component);
				if (store !== void 0) {
					const scope = this._core.specDynamic(options.name).scope;
					this._acquire(store, scope);
				}
				let disposed = false;
				return () => {
					if (disposed) return;
					disposed = true;
					dispose();
					if (store !== void 0) this._release(store);
				};
			}
			_registerFactory(options, component) {
				const registrant = this.ctx.fiber?.name;
				const erased = {
					...options,
					...registrant === void 0 ? {} : { registrant }
				};
				const dispose = this._core.registerFactory(erased, component);
				const definition = this._core.factory(options.name);
				if (definition === void 0) throw new Error(`slot factory "${options.name}" disappeared during registration`);
				if (definition.store !== void 0 && typeof definition.store !== "function") this._acquire(definition.store, definition.scope);
				else if (typeof definition.store === "function") this._factoryStores.set(definition, {
					occurrences: /* @__PURE__ */ new WeakMap(),
					mounted: /* @__PURE__ */ new Map()
				});
				let disposed = false;
				return () => {
					if (disposed) return;
					disposed = true;
					dispose();
					this._factoryStores.delete(definition);
					if (definition.store !== void 0 && typeof definition.store !== "function") this._release(definition.store);
				};
			}
			/** Build the domain-neutral host face once; installed adapters remain live through getters. */
			hostFace() {
				if (this._host !== void 0) return this._host;
				const service = this;
				this._host = {
					subscribe: (key, fn) => this._core.subscribe(key, fn),
					getVersion: (key) => this._core.getVersion(key),
					entriesOf: (key) => this._core.entries(key),
					entriesOfSlot: (key) => this._core.entriesOfSlot(key),
					reportEntryError: (key, entry, error, info) => {
						this._core.reportEntryError(key, entry, error, info);
					},
					reportFactoryError: (name, registration, error) => {
						this._core.reportFactoryError(name, registration, error);
					},
					specOf: (key) => this._core.specDynamic(key),
					isLive: (entry) => this._core.isLive(entry),
					storeOf: (entry, scopeBinding) => entry.store === void 0 ? void 0 : this.resolveStore(entry.store, scopeBinding),
					factoryStoreOf: (definition, scopeBinding, occurrence) => this.resolveFactoryStore(definition, scopeBinding, occurrence),
					retainFactoryOccurrence: (definition, occurrence) => this.retainFactoryOccurrence(definition, occurrence),
					subscribeFactory: (name, fn) => this._core.subscribeFactory(name, fn),
					getFactoryVersion: (name) => this._core.factoryVersion(name),
					factoryOf: (name) => this._core.factory(name),
					isFactoryLive: (definition) => this._core.isFactoryLive(definition),
					root: this._rootSource,
					scopeRevision: this._scopeRevisionSource,
					scope: (scope) => service._scopes.get(scope === "session-maybe" ? "session" : scope),
					get locale() {
						return service._locale;
					}
				};
				return this._host;
			}
			/** Validate and atomically publish the current root contribution roster. */
			rebuildRootBinding() {
				const hooks = {};
				const keyedHooks = {};
				const props = {};
				const finalProps = /* @__PURE__ */ new Set();
				for (const contribution of this._rootContributions) {
					copyUnique("hook", hooks, contribution.hooks, finalProps, _deepseek_ai_dsh_client_ui_slots.standardHookPropName);
					copyUnique("keyed hook", keyedHooks, contribution.keyedHooks, finalProps, _deepseek_ai_dsh_client_ui_slots.standardHookPropName);
					copyUnique("prop", props, contribution.props, finalProps, (name) => name);
				}
				this._rootBinding = {
					key: void 0,
					hooks,
					keyedHooks,
					props
				};
				for (const listener of [...this._rootListeners]) try {
					listener();
				} catch (error) {
					console.error("root standard-source subscriber failed:", error);
				}
			}
			/** Publish one installed-scope roster transition after the map is authoritative. */
			publishScopeRevision() {
				this._scopeRevision += 1;
				for (const listener of [...this._scopeListeners]) try {
					listener();
				} catch (error) {
					console.error("scope-adapter subscriber failed:", error);
				}
			}
			/** Resolve (create or reuse) the store instance for a registered handle under a scope key. */
			resolveStore(handle, scopeBinding) {
				const record = this._stores.get(handle);
				if (record === void 0) throw new Error("store handle is not registered (entry unloaded, or the handle never went through register)");
				let key;
				if (record.scope === "root") key = ROOT_INSTANCE_KEY;
				else {
					if (scopeBinding === void 0) throw new Error(`${record.scope} store resolution requires a session id`);
					key = scopeBinding.key;
					this.bindStoreScope(scopeBinding);
				}
				let instance = record.instances.get(key);
				if (instance === void 0) {
					instance = record.scope === "root" ? handle.create() : handle.create(key);
					record.instances.set(key, instance);
				}
				return instance;
			}
			resolveFactoryStore(definition, scopeBinding, occurrence) {
				if (!this._core.isFactoryLive(definition)) throw new _deepseek_ai_dsh_client_ui_slots.StaleAuthorizationError(`slot factory "${definition.name}" is not registered`);
				const declaration = definition.store;
				if (declaration === void 0) return void 0;
				if (typeof declaration !== "function") return this.resolveStore(declaration, scopeBinding);
				const axis = this._factoryStores.get(definition);
				const scopeKey = definition.scope === "root" ? ROOT_INSTANCE_KEY : requireScopeKey(definition, scopeBinding);
				if (scopeBinding !== void 0 && definition.scope !== "root") this.bindStoreScope(scopeBinding);
				let record = axis.occurrences.get(occurrence);
				if (record === void 0) {
					const handle = declaration();
					if (handle.spec.persist !== void 0) throw new SlotAssemblyError(`exclusive store for factory "${definition.name}" cannot declare persistence`);
					record = {
						handle,
						instances: /* @__PURE__ */ new Map(),
						retainers: 0
					};
					axis.occurrences.set(occurrence, record);
				}
				const existing = record.instances.get(scopeKey);
				if (existing !== void 0) return existing;
				const instance = definition.scope === "root" || scopeBinding === void 0 ? record.handle.create() : record.handle.create(scopeBinding.key);
				record.instances.set(scopeKey, instance);
				return instance;
			}
			retainFactoryOccurrence(definition, occurrence) {
				if (!this._core.isFactoryLive(definition)) return () => {};
				if (typeof definition.store !== "function") return () => {};
				const axis = this._factoryStores.get(definition);
				const record = axis.occurrences.get(occurrence);
				record.retainers += 1;
				axis.mounted.set(occurrence, record);
				let released = false;
				return () => {
					if (released) return;
					released = true;
					record.retainers -= 1;
					if (record.retainers !== 0) return;
					axis.mounted.delete(occurrence);
				};
			}
			/** Drop every materialized non-root Store instance for one ended Context generation. */
			releaseStoreScope(key) {
				for (const record of this._stores.values()) {
					if (record.scope === "root") continue;
					record.instances.delete(key);
				}
				for (const axis of this._factoryStores.values()) for (const record of axis.mounted.values()) record.instances.delete(key);
			}
			/** Bind (or re-reference) a handle on the axis; cross-scope conflicts already threw in the core. */
			_acquire(handle, scope) {
				const record = this._stores.get(handle);
				if (record === void 0) {
					this._stores.set(handle, {
						scope,
						refs: 1,
						instances: /* @__PURE__ */ new Map()
					});
					return;
				}
				record.refs += 1;
			}
			/** Drop one reference; the last holder's unload drops the record (instances go with it — engine stores need no explicit dispose). */
			_release(handle) {
				const record = this._stores.get(handle);
				/* v8 ignore next -- defensive: release only runs from a disposer whose
				* register acquired the same handle, so the record must exist; kept so a
				* future call site cannot underflow the axis. */
				if (record === void 0) return;
				record.refs -= 1;
				if (record.refs !== 0) return;
				this._stores.delete(handle);
			}
		};
		function copyUnique(kind, target, values, finalProps, propNameOf) {
			if (values === void 0) return;
			for (const [name, value] of Object.entries(values)) {
				const propName = propNameOf(name);
				if (finalProps.has(propName)) throw new Error(`duplicate root standard ${kind} '${name}' at prop '${propName}'`);
				finalProps.add(propName);
				target[name] = value;
			}
		}
		SlotRegistry.prototype.register = function register(rawOptions, component) {
			const options = rawOptions;
			return this.ctx.effect(() => this["_register"](options, component), "slots.register()");
		};
		SlotRegistry.prototype.registerFactory = function registerFactory(rawOptions, component) {
			const options = rawOptions;
			return this.ctx.effect(() => this["_registerFactory"](options, component), "slots.registerFactory()");
		};
		function requireScopeKey(definition, binding) {
			if (binding === void 0) throw new Error(`${definition.scope} factory store resolution requires a session id`);
			return binding.key;
		}
		//#endregion
		//#region lib/types/client/index.js
		/**
		* Browser UI renderer. It installs the slot renderer after its Cordis
		* dependencies activate and exposes the mount operation used by the web boot
		* kernel after the complete client roster settles.
		*/
		/** Services required before application assembly. */
		const inject = [];
		/** Hydrate the kernel-owned loading DOM before replacing it with the application. */
		function BootHandoff(props) {
			const [ready, setReady] = (0, react.useState)(false);
			(0, react.useLayoutEffect)(() => {
				setReady(true);
			}, []);
			if (ready) return props.app();
			return (0, react.createElement)("div", {
				className: props.boot.className,
				"data-dsh-boot": "",
				dangerouslySetInnerHTML: { __html: props.boot.html }
			});
		}
		/** Mount React while preserving the framework-free boot DOM through hydration. */
		function mountApp(container, app) {
			const boot = container.querySelector(":scope > [data-dsh-boot]");
			if (boot !== null) return (0, react_dom_client.hydrateRoot)(container, (0, react.createElement)(BootHandoff, {
				app,
				boot: {
					className: boot.className,
					html: boot.innerHTML
				}
			}));
			const root = (0, react_dom_client.createRoot)(container);
			(0, react_dom.flushSync)(() => {
				root.render(app());
			});
			return root;
		}
		/**
		* Install the slot renderer and provide the application mount face.
		* @param ctx - Plugin context.
		*/
		function apply(ctx) {
			new SlotRegistry(ctx).install(createSlotRenderer());
			ctx.reflect.provide("uiRenderer", { mount: (container) => {
				const root = mountApp(container, buildRenderApp({ ctx }));
				return () => {
					root.unmount();
				};
			} });
		}
		//#endregion
		exports.SlotRegistry = SlotRegistry;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
