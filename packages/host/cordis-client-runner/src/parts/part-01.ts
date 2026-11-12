/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-cordis-client-runner/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		let react = require("react");
		react = __toESM(react, 1);
		let _deepseek_ai_cordis = require("@deepseek-ai/cordis");
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/evaluator.js
		/**
		* Browser-half closure evaluation: the package source runs as the body of an
		* async function whose parameters ARE the symbol surface. Shadowing parameters
		* (setTimeout/fetch/require/…) turn the ambient browser globals into teaching
		* redirects without touching the page. The host syntax-prechecked the source at
		* define time; SyntaxError handling here is the engine-divergence fallback and
		* reaches the model through the load report.
		*/
		const TIMER_REDIRECT = "browser timer globals are unavailable in dynamic packages. Declare inject: ['timer'] on the returned plugin, query Client Service.listService for the exact API, and close over that plugin ctx. In React, create timers from an event handler or React.useEffect and return callback-form disposers from the effect cleanup.";
		/**
		* Where each withheld browser global sends the author instead. One home for two
		* consumers: the closure traps below throw these, and a render crash whose
		* message names one of them gets the same redirect appended — a package that
		* reached the global some other way (`window.setInterval`) crashes with the
		* engine's own bare text, and the author needs the redirect either way.
		*/
		const DYNAMIC_CLIENT_REDIRECTS = {
			setTimeout: TIMER_REDIRECT,
			setInterval: TIMER_REDIRECT,
			clearTimeout: TIMER_REDIRECT,
			clearInterval: TIMER_REDIRECT,
			fetch: "network belongs to the HOST half: register a handler there with harness.handle(method, fn) and call it here via host.call(method, args).",
			require: "modules cannot be imported here. React arrives as the `React` closure symbol; everything else goes through ctx services or host.call."
		};
		/** Callable teaching traps shadowing the ambient globals the closure must not reach. */
		function closureTraps() {
			const traps = {};
			for (const [name, redirect] of Object.entries(DYNAMIC_CLIENT_REDIRECTS)) traps[name] = () => {
				throw new Error(`${name} is not available in a dynamic client half — ${redirect}`);
			};
			return traps;
		}
		/** The `harness` seat exists only host-side; any touch teaches the split. */
		function harnessTrap() {
			return new Proxy({}, { get(_target, prop) {
				throw new Error(`harness.${String(prop)} belongs to the HOST half (\`code\`): register handlers there with harness.handle(method, fn); the browser half calls them via host.call(method, args).`);
			} });
		}
		/** Per-package style-tag bookkeeping behind the `styles.insert` symbol. */
		var DynamicCordisStyles = class {
			pluginId;
			tags = /* @__PURE__ */ new Set();
			/** @param pluginId - owning Plugin ID, stamped as `data-dyn` on every tag. */
			constructor(pluginId) {
				this.pluginId = pluginId;
			}
			/**
			* Inject one stylesheet, removed automatically on package unload.
			* @param css - raw CSS text.
			* @returns disposer removing this one tag early.
			*/
			insert(css) {
				if (typeof css !== "string") throw new Error("styles.insert(css) needs a CSS string");
				const tag = document.createElement("style");
				tag.dataset.dyn = this.pluginId;
				tag.textContent = css;
				document.head.append(tag);
				this.tags.add(tag);
				return () => {
					this.tags.delete(tag);
					tag.remove();
				};
			}
			/** Live tag count (load-report contribution summary). */
			get count() {
				return this.tags.size;
			}
			/** Remove every tag this package still owns (unload path). */
			dispose() {
				for (const tag of this.tags) tag.remove();
				this.tags.clear();
			}
		};
		/** Stringify one console argument for the error mirror. */
		function errorText(arg) {
			if (arg instanceof Error) return arg.message;
			if (typeof arg === "string") return arg;
			if (arg === void 0) return "undefined";
			try {
				return JSON.stringify(arg);
			} catch {
				return "[unserializable console argument]";
			}
		}
		/** Tagged write-through console; error lines additionally copy into the load report. */
		function taggedConsole(pluginId, noteError) {
			const tag = `[cordis:${pluginId}]`;
			const forward = (level) => (...args) => {
				console[level](tag, ...args);
				if (level !== "error") return;
				noteError(args.map(errorText).join(" ").slice(0, 500));
			};
			return {
				...console,
				log: forward("log"),
				info: forward("info"),
				warn: forward("warn"),
				error: forward("error"),
				debug: forward("debug")
			};
		}
		/**
		* Narrow a closure return value to a mountable plugin (host guard mirror).
		* @param value - whatever the closure returned.
		* @returns whether the value is mountable.
		*/
		function isDynamicCordisPlugin(value) {
			if (typeof value === "function") return true;
			return typeof value === "object" && value !== null && typeof value.apply === "function";
		}
		/**
		* Evaluate one package's browser half and return the (un-guarded) plugin.
		* @param pluginId - stable Plugin ID (console tag and style ownership).
		* @param clientCode - the browser half's source: an async function body returning a plugin.
		* @param env - runner wiring for `host.call` and error mirroring.
		* @param styles - the package's style bookkeeping (owned by the caller so unload can dispose it).
		* @returns the plugin the closure returned.
		* @throws teaching errors for syntax failures and non-plugin returns.
		*/
		async function evaluateClientHalf(pluginId, clientCode, env, styles) {
			const traps = closureTraps();
			const parameters = [
				"React",
				"console",
				"styles",
				"host",
				"harness",
				...Object.keys(traps),
				"process",
				"Buffer"
			];
			let closure;
			try {
				closure = new Function(...parameters, `return (async () => {\n${clientCode}\n})()`);
			} catch (error) {
				if (!(error instanceof SyntaxError)) throw error;
				throw new Error(`client half failed to parse in this browser: ${error.message}\nThe browser half is plain JavaScript (no JSX, no TypeScript); build elements with React.createElement.`);
			}
			const returned = await closure(react, taggedConsole(pluginId, (message) => {
				env.noteError(message);
			}), styles, { 
			/**
			* Call a host-half handler of THIS package (harness.handle pairing). A call
			* with nothing to pass omits the argument: it arrives at the handler as
			* `null`, because the wire carries JSON and `undefined` is not JSON —
			* requiring `host.call('m', {})` would be a ritual, and defaulting to `{}`
			* would invent an empty argument the caller never wrote.
			*/
call: (method, args = null) => env.invoke(method, args) }, harnessTrap(), ...Object.values(traps), void 0, void 0);
			if (!isDynamicCordisPlugin(returned)) {
				if (returned === void 0) throw new Error("client half returned `undefined` — did you forget `return`?\n  ✓ return (ctx) => { … }\n  ✓ return { name: '…', inject: ['slots'], apply(ctx) { … } }");
				throw new Error("client half must `return` a plugin: a function, or an object with an `apply(ctx)` method");
			}
			return returned;
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/guard.js
		/**
		* The browser twin of the tool-cordis context facade: a whitelist of
		* lifecycle-safe verbs plus optional `ctx.get()` lookup and declared-service
		* property access, with
		* framework internals withheld and Context-valued returns denied. Two seats
		* carry extra machinery: `slots`, where the registration proxy assigns any
		* shadowing priority and ledgers ordinary entries or Factory definitions — invoking the service with
		* the traced receiver so the effect lands on the CALLING plugin's fiber
		* (SlotRegistry.register must stay a prototype method for exactly that
		* reason) — and `theme`, whose override source is pinned to the package id.
		*
		* This is API discipline, not a security boundary: a dynamic package's code is
		* as trusted as the host process that accepted its definition.
		*/
		/** Facade verbs beyond declared services (host CTX_VERBS twin). */
		const CTX_VERBS = new Set([
			"effect",
			"on",
			"once",
			"provide",
			"timeout",
			"interval",
			"setTimeout",
			"setInterval",
			"throttle",
			"debounce"
		]);
		const TIMER_VERBS = new Set([
			"timeout",
			"interval",
			"setTimeout",
			"setInterval",
			"throttle",
			"debounce"
		]);
		/** Reject any service return that is a cordis Context (host guard twin). */
		function denyContext(value, service, env) {
			if (value instanceof _deepseek_ai_cordis.Context) return rejectGuard(env, `service "${service}" returned a cordis Context, which the dynamic facade does not expose. Operate through your own plugin ctx and the services you declared — never another context.`);
			return value;
		}
		/**
		* Forward service methods with the traced service as receiver — `this.ctx`
		* inside prototype methods (slots.register) must stay the CALLER's ctx so
		* effects land on the calling plugin's fiber — while denying Context returns.
		*/
		function guardedService(service, name, env) {
			return new Proxy(service, { get(target, prop) {
				const value = Reflect.get(target, prop, target);
				if (typeof value !== "function") return denyContext(value, name, env);
				return (...args) => {
					const result = Reflect.apply(value, target, args);
					if (result instanceof Promise) return result.then((resolved) => denyContext(resolved, name, env));
					return denyContext(result, name, env);
				};
			} });
		}
		/**
		* The slots seat: automatic shadowing priority and ledger recording around the
		* traced service's own Slot and Factory registration methods.
		*/
		function guardedSlots(slots, env) {
			return new Proxy(slots, { get(target, prop) {
				const value = Reflect.get(target, prop, target);
				if (prop !== "register" && prop !== "registerFactory") {
					if (typeof value !== "function") return denyContext(value, "slots", env);
					return (...args) => denyContext(Reflect.apply(value, target, args), "slots", env);
				}
				return (rawOptions, component) => {
					if (typeof rawOptions !== "object" || rawOptions === null) return rejectGuard(env, "slots.register(options, component) needs an options object with a `name`");
					const options = { ...rawOptions };
					const slot = options.name;
					if (typeof slot !== "string" || slot.length === 0) return rejectGuard(env, `slots.${prop} options need a string \`name\``);
					if (prop === "registerFactory") {
						const dispose = Reflect.apply(value, target, [options, component]);
						env.ledger.push({
							slot: `factory:${slot}`,
							priority: void 0
						});
						env.claim(component);
						return dispose;
					}
					if (slot === "tool.view.cordis") {
						if (options.key !== "self") return rejectGuard(env, "tool.view.cordis only accepts key \"self\"; the runtime binds it to this Package");
						options.key = `${env.pkg.pluginId}.${env.pkg.packageId}`;
					}
					const spec = slots.spec(slot);
					let priority = options.priority;
					if (spec === void 0 || spec.kind !== "chain") {
						priority = env.allocatePriority();
						options.priority = priority;
					}
					const dispose = Reflect.get(target, "register", target).call(target, options, component);
					env.ledger.push({
						slot,
						priority
					});
					env.claim(component);
					return dispose;
				};
			} });
		}
		/**
		* The theme seat: `overrideTokens`' source is FORCED to the package id — a
		* dynamic package can never impersonate (or evict) another source's layer, and
		* its own layers converge under one identity unload can reason about. The
		* layer's disposer is additionally hung on the calling fiber, because the
		* documented contract is "unload restores" and model code cannot be trusted to
		* keep the returned handle (slots parity — register hangs its own cleanup).
		* Everything else forwards through the generic guard.
		*/
		function guardedTheme(theme, env, ctx) {
			return new Proxy(theme, { get(target, prop) {
				if (prop !== "overrideTokens") {
					const value = Reflect.get(target, prop, target);
					if (typeof value !== "function") return denyContext(value, "theme", env);
					return (...args) => {
						const result = Reflect.apply(value, target, args);
						if (result instanceof Promise) return result.then((resolved) => denyContext(resolved, "theme", env));
						return denyContext(result, "theme", env);
					};
				}
				return (source, tokens) => {
					if (tokens === void 0 && typeof source === "object" && source !== null) return rejectGuard(env, "theme.overrideTokens(source, tokens) takes two arguments; source is replaced with your package id, so pass any string first and the token map second: overrideTokens('mine', { '--dsw-alias-…': { light: '…', dark: '…' } })");
					const method = Reflect.get(target, "overrideTokens", target);
					const dispose = Reflect.apply(method, target, [`${env.pkg.pluginId}.${env.pkg.packageId}`, tokens]);
					ctx.effect(() => dispose, "cordis-client-runner: dynamic theme override layer");
					return dispose;
				};
			} });
		}
		/**
		* Build the facade one dynamic plugin's `apply` receives (host sandboxContext
		* twin, browser seats). `ctx.get(name)` performs optional lookup; direct
		* `ctx.serviceName` access is gated by the fiber's `inject` declaration.
		* @param ctx - the plugin's real fiber ctx (loader-created).
		* @param env - package row + ledger sink.
		* @returns the whitelisting proxy standing in for ctx.
		*/
		function dynamicCordisContext(ctx, env) {
			const declared = new Set(Object.keys(ctx.fiber.inject));
			const denyRead = (prop) => {
				if (ctx.get(prop) !== void 0) return rejectGuard(env, `service "${prop}" is not declared by your plugin. Declare it on the plugin you return: { inject: ['${prop}', …], apply(ctx) { … } } — a plain \`function\` has no declaration site, so use the object form. The runtime then parks the package if the provider unloads.`);
				return rejectGuard(env, `dynamic ctx does not expose "${prop}". Available: ctx.on / ctx.provide / timer helpers after injecting timer, and any service your returned plugin declared in inject (slots and theme are the usual UI seats). Framework internals are withheld by design.`);
			};
			const readService = (name, requireDeclaration) => {
				if (requireDeclaration && !declared.has(name)) return denyRead(name);
				const service = denyContext(ctx.get(name), name, env);
				if (service === null || typeof service !== "object" && typeof service !== "function") return service;
				if (name === "slots") return guardedSlots(service, env);
				if (name === "theme") return guardedTheme(service, env, ctx);
				return guardedService(service, name, env);
			};
			return new Proxy({}, {
				get(_target, prop) {
					if (prop === "get") return (name) => readService(name, false);
					if (typeof prop !== "string") return void 0;
					if (CTX_VERBS.has(prop)) return (...args) => {
						if (TIMER_VERBS.has(prop) && !declared.has("timer")) return denyRead("timer");
						const method = ctx[prop];
						return Reflect.apply(method, ctx, args);
					};
					return readService(prop, true);
				},
				set(_target, prop) {
					return rejectGuard(env, `dynamic ctx is read-only; cannot assign "${String(prop)}"`);
				},
				has: (_target, prop) => prop === "get" || typeof prop === "string" && (CTX_VERBS.has(prop) && (!TIMER_VERBS.has(prop) || declared.has("timer")) || declared.has(prop))
			});
		}
		function rejectGuard(env, message) {
			const error = new Error(message);
			env.reportFailure(error);
			throw error;
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/runtime.js
		/**
		* Per-package browser lifecycle: evaluate the closure, wrap `apply` in the guard
		* facade, seat a ready-made factory in the module table, and create a loader
		* entry — so dynamic packages ride the exact machinery static plugins do
		* (activation gating on inject, fiber-effect cleanup, status projection). Unload
		* = loader entry removal (fiber disposal cascades slot entries and facade
		* effects) + factory invalidation + style removal.
		*
		* The engine answers its caller: `load` resolves with what this page ended up
		* with, which is what the run orchestration reports back to the host. Loads
		* converge by Plugin Run ID against live state, not history: loading the exact
		* activation this page already runs is a no-op that still answers, another run
		* replaces it, and the same Package after a retract loads afresh. Per-Plugin
		* serialization keeps a second request from interleaving with one in flight.
		*/
		/** Module-table id of one package (also its loader entry name and fiber name). */
		function moduleIdOf(id) {
			return `dyn/${id}`;
		}
		/** The browser-side load engine for dynamic packages. */
		var DynamicCordisPackageRunner = class {
			env;
			live = /* @__PURE__ */ new Map();
			/** Serializes load/unload per package id (a second request can outrun a slow load). */
			queues = /* @__PURE__ */ new Map();
			changeListeners = /* @__PURE__ */ new Set();
			/** Page-local shadowing rank. A later registration receives a lower priority. */
			nextPriority = 0;
			/**
			* Which package seated which component, and for whom. Component identity is the
			* only attribution key that holds:
			* - the registry stores the component verbatim, so a crashed entry carries its
			*   own way back — no parallel entry ledger to keep in step;
			* - `entry.registrant` is `options.registrant ?? fiber.name` and the facade does
			*   not strip a package-supplied one, so a package could name itself something
			*   else — attributing by it would let a package impersonate another;
			* - the assigned shadowing priority is unique but absent on chain entries (their
			*   election is deliberately left alone), so it would miss chain crashes;
			* - a package torn down between the crash and the report is still attributable,
			*   because this index does not depend on the live record.
			*
			* Two packages cannot collide here: each browser half is evaluated in its own
			* closure, so no component object reaches two of them. A collision is only
			* possible inside ONE package (the same component seated twice), where both
			* entries map to the same id and the value is identical.
			*/
			owners = /* @__PURE__ */ new WeakMap();
			/** This page's last render crash per package: what a run surface shows on the row. */
			failures = /* @__PURE__ */ new Map();
			unwatch;
			snapshotCache;
			failureCache;
			/** @param env - loader/module/slot wiring plus the two host verbs this engine uses. */
			constructor(env) {
				this.env = env;
				this.unwatch = env.slots.onEntryError((slot, entry, error, info) => {
					const component = entry.component;
					const owner = indexable(component) ? this.owners.get(component) : void 0;
					if (owner === void 0) return;
					const details = errorDetails(error);
					const failure = {
						slot,
						message: renderFailureMessage(slot, details.message),
						...details.stack === void 0 ? {} : { stack: details.stack },
						abdicated: info.abdicated
					};
					env.reportRenderFailure(owner.agentId, owner.pluginId, owner.pluginRunId, failure);
					this.failures.set(owner.pluginId, failure);
					this.notify();
				});
			}
			/**
			* Observe live-set changes (the run-state surface's re-render seam).
			* @param fn - notified after every converged mutation.
			* @returns unsubscribe.
			*/
			subscribe(fn) {
				this.changeListeners.add(fn);
				return () => {
					this.changeListeners.delete(fn);
				};
			}
			/**
			* This page's last render crash per package, on the same notification channel as
			* the live set — a surface that already subscribed learns about a crash without
			* a second mechanism to wire.
			*/
			renderFailures = {
				getSnapshot: () => this.failureCache ??= new Map(this.failures),
				subscribe: (fn) => this.subscribe(fn)
			};
			/**
			* What this page currently has loaded (stable reference between mutations, so
			* it can back a snapshot selector).
			* @returns one row per live package.
			*/
			getSnapshot() {
				return this.snapshotCache ??= [...this.live.values()].map(({ pkg, ledger, styles }) => ({
					pluginId: pkg.pluginId,
					packageId: pkg.packageId,
					pluginRunId: pkg.pluginRunId,
					name: pkg.name,
					slots: [...new Set(ledger.map((row) => row.slot))],
					styleCount: styles.count
				}));
			}
			/**
			* Whether this page has the browser half loaded — page-local truth, never the
			* host's "it is running".
			* @param pluginId - stable Plugin identity.
			* @returns true while one activation of the Plugin is live here.
			*/
			isLoaded(pluginId) {
				return this.live.has(pluginId);
			}
			/**
			* Load one browser half into this page and answer what happened.
			* @param half - source for one exact Host activation.
			* @returns the outcome the run orchestration reports to the host.
			*/
			load(half) {
				return this.enqueue(half.pluginId, async () => {
					const current = this.live.get(half.pluginId);
					if (current !== void 0) {
						if (current.pkg.pluginRunId === half.pluginRunId) return settled(current);
						await this.teardown(current.pkg.pluginId, current.entryId, current.styles);
					}
					const result = await this.mount(half);
					this.notify();
					return result;
				});
			}
			/**
			* Unload one package (`cordis/dynamic-retract`: a stop, or an undefine
			* that stops first).
			* @param pluginId - stable Plugin identity.
			* @param pluginRunId - exact activation being retracted; a newer run survives.
			*/
			retract(pluginId, pluginRunId) {
				this.enqueue(pluginId, async () => {
					const current = this.live.get(pluginId);
					if (current === void 0 || current.pkg.pluginRunId !== pluginRunId) return;
					await this.teardown(pluginId, current.entryId, current.styles);
					this.notify();
				});
			}
			/** Unload everything (plugin disposal path). */
			async dispose() {
				this.unwatch();
				for (const current of [...this.live.values()]) await this.teardown(current.pkg.pluginId, current.entryId, current.styles);
				this.notify();
			}
			notify() {
				this.snapshotCache = void 0;
				this.failureCache = void 0;
				for (const fn of [...this.changeListeners]) fn();
			}
			/** Queue one package operation behind that package's previous ones. */
			enqueue(id, op) {
				const next = (this.queues.get(id) ?? Promise.resolve()).then(op);
				this.queues.set(id, next.then(() => {}, () => {}));
				return next;
			}
			async mount(half) {
				const styles = new DynamicCordisStyles(half.pluginId);
				const ledger = [];
				let plugin;
				try {
					plugin = await evaluateClientHalf(half.pluginId, half.code, {
						invoke: (method, args) => this.env.invoke(half.pluginId, half.pluginRunId, method, args),
						noteError: (message) => {
							console.error(`[cordis-client-runner] ${half.pluginId} logged an error:`, message);
						}
					}, styles);
				} catch (error) {
					styles.dispose();
					return {
						ok: false,
						cause: "evaluate",
						...errorDetails(error),
						error
					};
				}
				const pkg = {
					pluginId: half.pluginId,
					packageId: half.packageId,
					pluginRunId: half.pluginRunId,
					name: half.name
				};
				const surface = this.guardedSurface(pkg, half.agentId, plugin, ledger);
				const moduleId = moduleIdOf(half.pluginId);
				this.env.modules.invalidate(moduleId);
				const sink = globalThis.__ModuleLoader__;
				if (sink === void 0) throw new Error("cordis-client-runner: window.__ModuleLoader__ is missing (booted outside the web shell?)");
				sink.load({
					id: moduleId,
					factory: () => surface
				});
				const entryId = await this.env.loader.create({ name: moduleId });
				const fiber = this.env.loader.resolve(entryId).fiber;
				if (fiber === void 0) {
					await this.teardown(half.pluginId, entryId, styles);
					return {
						ok: false,
						cause: "module-import",
						message: "module import failed (see the browser console)"
					};
				}
				try {
					await fiber.await();
				} catch (error) {
					await this.teardown(half.pluginId, entryId, styles);
					return {
						ok: false,
						cause: "activate",
						...errorDetails(error),
						error
					};
				}
				const record = {
					pkg,
					entryId,
					styles,
					ledger,
					waitingFor: Object.keys(fiber.inject).filter((name) => this.env.ctx.get(name) === void 0)
				};
				this.live.set(half.pluginId, record);
				this.failures.delete(half.pluginId);
				return settled(record);
			}
			/**
			* Wrap the evaluated plugin so `apply` sees the guard facade; the surface
			* doubles as the module-table module. The plugin's OWN `inject` survives (the
			* object form's declaration is the facade's service gate, mirroring the host
			* sandbox reading `ctx.fiber.inject`); the function form has no declaration
			* site and therefore reaches no service.
			*/
			guardedSurface(pkg, agentId, plugin, ledger) {
				const claim = (component) => {
					if (indexable(component)) this.owners.set(component, {
						pluginId: pkg.pluginId,
						pluginRunId: pkg.pluginRunId,
						agentId
					});
				};
				const guarded = (ctx) => dynamicCordisContext(ctx, {
					pkg,
					ledger,
					claim,
					allocatePriority: () => --this.nextPriority,
					reportFailure: (error) => {
						this.env.reportGuardFailure(agentId, pkg.pluginId, pkg.pluginRunId, errorDetails(error));
					}
				});
				if (typeof plugin === "function") return {
					name: moduleIdOf(pkg.pluginId),
					apply: (ctx) => plugin(guarded(ctx))
				};
				return {
					...plugin,
					name: moduleIdOf(pkg.pluginId),
					apply: (ctx, config) => plugin.apply(guarded(ctx), config)
				};
			}
			/**
			* Unload one package's contributions. Takes the pieces rather than the record
			* because a load can fail before any record is seated.
			*/
			async teardown(id, entryId, styles) {
				this.live.delete(id);
				this.failures.delete(id);
				const disposal = this.env.loader.resolve(entryId).fiber?.dispose();
				this.env.loader.remove(entryId);
				await disposal;
				this.env.modules.invalidate(moduleIdOf(id));
				styles.dispose();
			}
		};
		/** The success answer for a package that is live here, parked or active. */
		function settled(record) {
			return {
				ok: true,
				pluginRunId: record.pkg.pluginRunId,
				...record.waitingFor.length > 0 ? { waitingFor: record.waitingFor } : {}
			};
		}
		/**
		* Whether a component can key the ownership index. Identity is the key, so only
		* objects and functions qualify — a package may register anything, and what it
		* registered is what a crash report carries back.
		* @param component - whatever a package passed as its component.
		* @returns true when the value can be indexed by identity.
		*/
		function indexable(component) {
			return typeof component === "object" && component !== null || typeof component === "function";
		}
		/**
		* Preserve error fields for a load result without fabricating a stack.
		* @param error - original thrown value.
		* @returns its message and original string stack, when present.
		*/
		function errorDetails(error) {
			if (typeof error !== "object" || error === null) return { message: String(error) };
			const message = "message" in error && typeof error.message === "string" ? error.message : Object.prototype.toString.call(error);
			const stack = "stack" in error && typeof error.stack === "string" ? error.stack : void 0;
			return {
				message,
				...stack === void 0 ? {} : { stack }
			};
		}
		/**
		* What the authoring session reads about one render crash. The slot says where it
		* happened, the crash message says what broke, and a withheld global named in that
		* text pulls in its redirect — a package that reached `window.setInterval` around
		* the closure trap crashes with the engine's bare message, which teaches nothing.
		*/
		function renderFailureMessage(slot, message) {
			const redirect = Object.entries(DYNAMIC_CLIENT_REDIRECTS).find(([name, text]) => message.includes(name) && !message.includes(text))?.[1];
			return `${slot.startsWith("factory:") ? `your component in Factory "${slot.slice(8)}"` : `your entry in slot "${slot}"`} crashed while React rendered it: ${message}` + (redirect === void 0 ? "" : `\n${redirect}`);
		}
		//#endregion
} // __DSH_FRAGMENT_END__

export {};
