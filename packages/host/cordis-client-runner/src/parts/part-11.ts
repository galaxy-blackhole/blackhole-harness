/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-cordis-client-runner/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/providers.js
		/** Built-in Client inspect providers over live Client-owned services. */
		const EMPTY_INPUT = {
			type: "object",
			properties: {},
			additionalProperties: false
		};
		const ANY_OUTPUT = { description: "JSON data owned by this inspect provider." };
		const SERVICE_INPUT = exactInput("service", "Exact Service key. Omit it for the compact Service and method-signature directory.");
		const EVENT_INPUT = exactInput("event", "Exact Event name. Omit it for the compact Event and listener-signature directory.");
		const SERVICE_OUTPUT = { description: "Compact Service directory, or one exact Service contract with only its referenced type declarations." };
		const EVENT_OUTPUT = { description: "Compact Event directory, or one exact Event contract with only its referenced type declarations." };
		const SUBTREE_OUTPUT = { description: "Compact topology trees. An exact Slot includes its catalog and occupants; an exact Factory includes identity, scope, and registrant." };
		const SUBTREE_INPUT = {
			type: "object",
			properties: { root: {
				type: "string",
				description: "Exact live Slot key or factory:<name>. When supplied, selected contains that declaration."
			} },
			additionalProperties: false
		};
		/** Exact Client closure symbols exposed by the evaluator and guard. */
		const CLIENT_BUILTIN_INSPECTION = [
			{
				name: "ctx",
				description: "Restricted Cordis Context. Prefer ctx.get(name) with an undefined check; use inject only for hard dependencies.",
				signatures: [
					"ctx.get(name: string): unknown | undefined",
					"ctx.on(name: string, listener: Function): () => void",
					"ctx.provide(name: string, value: unknown): () => void",
					"ctx.effect(callback: Function, label?: string): () => void"
				]
			},
			{
				name: "React",
				description: "React runtime exposed without JSX transformation.",
				signatures: [
					"React.createElement(type, props, ...children): ReactElement",
					"React.useState(initial)",
					"React.useEffect(effect, deps)"
				]
			},
			{
				name: "host",
				description: "Package-private JSON RPC from Client to this Package's Host half.",
				signatures: ["host.call(method: string, args?: JsonValue): Promise<JsonValue>"]
			},
			{
				name: "styles",
				description: "Package-owned stylesheet insertion cleaned up with the Client run.",
				signatures: ["styles.insert(css: string): () => void"]
			},
			{
				name: "console",
				description: "Package-tagged browser logging.",
				signatures: ["console.log(...values): void", "console.error(...values): void"]
			}
		];
		/**
		* Construct the first-party Client provider registrations.
		* @param ctx - Client context used for live Service-backed queries.
		* @returns registrations for static catalogs and live Client capabilities.
		*/
		function clientInspectProviders(ctx) {
			return [
				registration("Service", "Progressive Client Service discovery: compact capability/signature directory, then one exact coding contract.", "listService", (input) => queryServiceApi(readExact(input, "service")), SERVICE_INPUT, SERVICE_OUTPUT),
				registration("Event", "Progressive Client Event discovery: compact listener directory, then one exact event contract.", "listEvents", (input) => queryEventApi(readExact(input, "event")), EVENT_INPUT, EVENT_OUTPUT),
				registration("Builtin", "Plain-JavaScript symbols available to a dynamic Client half.", "listBuiltins", () => ({
					builtins: [...CLIENT_BUILTIN_INSPECTION],
					referencedTypes: []
				})),
				{
					manifest: {
						id: "Slots",
						description: "Progressive live Slot inspection with explicit Slot and Factory topology nodes.",
						methods: [{
							name: "listSubTree",
							description: "Return compact live Slot and Factory trees, plus available detail for one exact root.",
							inputSchema: SUBTREE_INPUT,
							outputSchema: SUBTREE_OUTPUT
						}]
					},
					query(method, input) {
						if (method !== "listSubTree") throw new Error(`unknown Slots inspect method "${method}"`);
						const slots = ctx.get("slots");
						if (slots === void 0) throw new Error("Client Slots service is not running");
						const root = typeof input === "object" && input !== null && !Array.isArray(input) && typeof input.root === "string" ? input.root : void 0;
						const trees = slots.snapshot(root);
						const selected = trees[0];
						return Promise.resolve({
							...root === void 0 ? {} : { requestedRoot: {
								name: root,
								available: trees.length > 0
							} },
							trees: trees.map(compactSlotTree),
							...root === void 0 || selected === void 0 ? {} : { selected: inspectLiveSlot(selected) },
							referencedTypes: []
						});
					}
				},
				registration("Theme", "Current theme token names and light/dark override requirements.", "listTokens", () => {
					const theme = ctx.get("theme");
					if (theme === void 0) throw new Error("Client Theme service is not running");
					return {
						tokens: theme.exportInspectTokens(),
						referencedTypes: []
					};
				})
			];
		}
		function registration(id, description, method, query, inputSchema = EMPTY_INPUT, outputSchema = ANY_OUTPUT) {
			return {
				manifest: {
					id,
					description,
					methods: [{
						name: method,
						description,
						inputSchema,
						outputSchema
					}]
				},
				async query(requested, input) {
					if (requested !== method) throw new Error(`unknown ${id} inspect method "${requested}"`);
					return await query(input);
				}
			};
		}
		function exactInput(field, description) {
			return {
				type: "object",
				properties: { [field]: {
					type: "string",
					description
				} },
				additionalProperties: false
			};
		}
		function readExact(input, field) {
			if (input === void 0 || input === null || Array.isArray(input) || typeof input !== "object") return void 0;
			const value = input[field];
			return typeof value === "string" ? value : void 0;
		}
		const SLOT_CATALOG = new Map(CLIENT_SLOT_API.map((entry) => [entry.key, entry]));
		const GUARDED_SLOT_KEYS = new Map([["tool.view.cordis", {
			description: "fixed by the dynamic Client Guard",
			values: [{
				value: "self",
				description: "The only accepted key. The Guard binds it to this Package's pluginId and packageId."
			}]
		}]]);
		function compactSlotTree(node) {
			if (node.type === "factory") return {
				type: node.type,
				name: node.name,
				scope: node.scope,
				children: node.children.map(compactSlotTree)
			};
			const catalog = SLOT_CATALOG.get(node.name);
			const guardedKeys = catalog === void 0 ? void 0 : GUARDED_SLOT_KEYS.get(catalog.key);
			return {
				type: node.type,
				name: node.name,
				kind: node.kind,
				scope: node.scope,
				...catalog === void 0 ? {} : {
					purpose: catalog.summary,
					replaceRisk: catalog.replaceRisk,
					...catalog.registerOptions.length === 0 ? {} : { registration: catalog.registerOptions.map((option) => ({
						name: option.name,
						type: option.type,
						required: option.requirement === "required"
					})) },
					...catalog.keyDomain === "" ? {} : {
						keyDomain: guardedKeys?.description ?? catalog.keyDomain,
						...guardedKeys === void 0 ? {} : { allowedKeys: guardedKeys.values.map((value) => ({ ...value })) }
					}
				},
				children: node.children.map(compactSlotTree)
			};
		}
		function inspectLiveSlot(node) {
			if (node.type === "factory") return {
				type: node.type,
				name: node.name,
				scope: node.scope,
				...node.registrant === void 0 ? {} : { registrant: node.registrant }
			};
			const catalog = SLOT_CATALOG.get(node.name);
			return {
				type: node.type,
				name: node.name,
				kind: node.kind,
				scope: node.scope,
				...node.declaredBy === void 0 ? {} : { declaredBy: node.declaredBy },
				occupants: node.occupants.map((occupant) => ({ ...occupant })),
				...catalog === void 0 ? {} : { catalog: inspectSlotCatalog(catalog) }
			};
		}
		function inspectSlotCatalog(entry) {
			const guardedKeys = GUARDED_SLOT_KEYS.get(entry.key);
			return {
				description: entry.doc,
				registration: entry.registerOptions.map((option) => ({
					name: option.name,
					type: option.type,
					required: option.requirement === "required",
					description: option.doc
				})),
				ownerProps: [...entry.ownerProps],
				ownerPropsReferences: [...entry.ownerPropsReferences],
				standardProps: [...entry.standardProps],
				keyDomain: guardedKeys?.description ?? entry.keyDomain,
				...guardedKeys === void 0 ? {} : { allowedKeys: guardedKeys.values.map((value) => ({ ...value })) },
				hookContext: entry.hookContext,
				slotInject: entry.slotInject,
				replaceRisk: entry.replaceRisk
			};
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/timer.js
		/** Browser implementation of the Cordis timer Service. */
		/** Browser timer Service with the same public API as the Host Cordis TimerService. */
		var ClientTimerService = class extends _deepseek_ai_cordis.Service {
			/** Register the Service and mix its lifecycle-safe helpers onto Context. */
			constructor(ctx) {
				super(ctx, "timer");
				ctx.mixin("timer", [
					"timeout",
					"interval",
					"throttle",
					"debounce",
					"setTimeout",
					"setInterval"
				]);
			}
			/**
			* Run a callback once through {@link timeout}.
			* @param callback - Work to run after the delay.
			* @param delay - Delay in milliseconds.
			* @returns Disposer that cancels the pending callback early.
			* @deprecated Use `ctx.timeout()` instead.
			*/
			setTimeout(callback, delay) {
				return this.timeout(callback, delay);
			}
			/**
			* Run a callback repeatedly through {@link interval}.
			* @param callback - Work to run on each tick.
			* @param delay - Interval in milliseconds.
			* @returns Disposer that stops the interval early.
			* @deprecated Use `ctx.interval()` instead.
			*/
			setInterval(callback, delay) {
				return this.interval(callback, delay);
			}
			timeout(...args) {
				const callback = typeof args[0] === "function" ? args.shift() : void 0;
				const delay = args[0];
				if (callback !== void 0) {
					const dispose = this.ctx.effect(() => {
						const timer = globalThis.setTimeout(() => {
							dispose();
							callback();
						}, delay);
						return () => {
							globalThis.clearTimeout(timer);
						};
					}, "ctx.timeout()");
					return dispose;
				}
				const { promise, resolve, reject } = Promise.withResolvers();
				const dispose = this.ctx.effect(() => {
					const timer = globalThis.setTimeout(resolve, delay);
					return () => {
						globalThis.clearTimeout(timer);
						reject(/* @__PURE__ */ new Error("Context has been disposed"));
					};
				}, "ctx.timeout()");
				return promise.finally(() => {
					dispose();
				});
			}
			interval(...args) {
				const callback = typeof args[0] === "function" ? args.shift() : void 0;
				const delay = args[0];
				if (callback !== void 0) return this.ctx.effect(() => {
					const timer = globalThis.setInterval(callback, delay);
					return () => {
						globalThis.clearInterval(timer);
					};
				}, "ctx.interval()");
				let done;
				let nextTask;
				const dispose = this.ctx.effect(() => {
					const timer = globalThis.setInterval(() => {
						nextTask?.resolve({
							done: false,
							value: void 0
						});
					}, delay);
					return () => {
						globalThis.clearInterval(timer);
						if (done !== void 0) return;
						done = {
							kind: "throw",
							reason: /* @__PURE__ */ new Error("Context has been disposed")
						};
						nextTask?.reject(done.reason);
					};
				}, "ctx.interval()");
				return {
					next: () => {
						if (done === void 0) return (nextTask = Promise.withResolvers()).promise;
						if (done.kind === "return") return Promise.resolve({
							done: true,
							value: done.value
						});
						return Promise.reject(done.reason);
					},
					return: (value) => {
						if (done === void 0) done = {
							kind: "return",
							value
						};
						nextTask?.resolve({
							done: true,
							value
						});
						dispose();
						return Promise.resolve({
							done: true,
							value
						});
					},
					throw: (reason) => {
						if (done === void 0) done = {
							kind: "throw",
							reason
						};
						nextTask?.reject(reason);
						dispose();
						return Promise.resolve({
							done: true,
							value: void 0
						});
					},
					[Symbol.asyncIterator]() {
						return this;
					}
				};
			}
			/** Build a delayed wrapper whose pending callback belongs to the calling Fiber. */
			schedule(label, trigger, disposed = false) {
				let timer;
				const dispose = this.ctx.effect(() => () => {
					disposed = true;
					globalThis.clearTimeout(timer);
				}, label);
				const wrapper = (...args) => {
					globalThis.clearTimeout(timer);
					timer = trigger(args, disposed);
				};
				wrapper.dispose = dispose;
				return wrapper;
			}
			/**
			* Return a throttled function whose timer is disposed with the calling Fiber.
			* @param callback - Function to throttle.
			* @param delay - Minimum interval between calls in milliseconds.
			* @param noTrailing - Whether to suppress a delayed trailing call.
			* @returns Throttled function with an early disposer.
			*/
			throttle(callback, delay, noTrailing) {
				let lastCall = -Infinity;
				const execute = (...args) => {
					lastCall = Date.now();
					callback(...args);
				};
				return this.schedule("ctx.throttle()", (args, disposed) => {
					const remaining = delay - Date.now() + lastCall;
					if (remaining <= 0) execute(...args);
					else if (!disposed) return globalThis.setTimeout(execute, remaining, ...args);
				}, noTrailing);
			}
			/**
			* Return a debounced function whose timer is disposed with the calling Fiber.
			* @param callback - Function to debounce.
			* @param delay - Quiet period in milliseconds.
			* @returns Debounced function with an early disposer.
			*/
			debounce(callback, delay) {
				return this.schedule("ctx.debounce()", (args, disposed) => {
					if (disposed) return;
					return globalThis.setTimeout(callback, delay, ...args);
				});
			}
		};
		/**
		* Install the browser timer Service on one Client composition.
		* @param ctx - Client context that owns the Service and mixed-in helpers.
		* @returns Nothing after registering the Service.
		*/
		function provideClientTimer(ctx) {
			new ClientTimerService(ctx);
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/index.js
		/**
		* Dynamic-package runner, browser half: the load engine that turns one browser
		* half's source into a live cordis plugin (closure → guard → module table →
		* loader entry, ./runtime.ts), plus the retract announcement that unloads it.
		*
		* Nothing loads on activation: this page holds no dynamic package until a
		* dispatch arrives, and a dispatch only follows a model `cordis_run` or a user
		* pressing a card's start control. A refresh therefore starts clean by design —
		* host process memory still holds the definition, the page simply does not run
		* it until asked again.
		*/
		/** Teaching text for a routing failure the infrastructure itself reports. */
		function invokeFailure(pluginId, method, result) {
			const where = `host.call("${method}") on ${pluginId}`;
			if (result.code === "plugin-not-running") return `${where} found no active Host half — the Plugin is stopped or was removed.`;
			if (result.code === "stale-run") return `${where} belongs to an activation that has already been replaced.`;
			if (result.code === "method-not-found") return `${where} is not registered: the host half must declare it with harness.handle("${method}", fn).`;
			return `${where} failed inside the host handler: ${result.message}`;
		}
		/** Preserve a Host handler's stack while adding the Client call site diagnosis. */
		function invokeError(pluginId, method, result) {
			const error = new Error(invokeFailure(pluginId, method, result));
			if (result.stack !== void 0) error.stack = `${error.stack ?? error.message}\nHost stack:\n${result.stack}`;
			return error;
		}
		/**
		* Teaching text for a `host.call` the wire itself refused: the generated codec
		* rejected the argument before sending, or the result on the way back, or the
		* transport broke. The infrastructure's message names the field it refused but
		* not the call it belonged to, and the model authored both halves — so this adds
		* the call and the contract it has to satisfy.
		*/
		function wireFailure(id, method, error) {
			return `host.call("${method}") on ${id} did not complete: ${error instanceof Error ? error.message : String(error)}\nBoth directions carry JSON only: pass plain JSON data as the argument — or omit it, and the handler receives null — and answer from harness.handle("${method}", fn) with JSON (\`return null\` when there is nothing to report).`;
		}
		/** Stable Cordis plugin name. */
		const name = "cordis-client-runner";
		/**
		* Required services: the loader/module chain for entries, the slot registry for
		* contributions, and the `dynamicCordisRunner` Remote namespace. Declaring the
		* namespace parks this plugin until the host side exists, so a page never loads
		* a browser half whose host half it could not reach.
		*/
		const inject = [
			"loader",
			"modules",
			"slots",
			"remote",
			"remote.dynamicCordisRunner"
		];
		/**
		* Client plugin body: build the runner and subscribe the dispatch family.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			provideClientTimer(ctx);
			const inspect = new ClientCordisInspectRegistry({
				sync: async (providers) => {
					const answered = await ctx.remote.dynamicCordisRunner.syncInspectManifest(providers);
					if (!answered.ok) throw new Error(`${answered.error.code}: ${answered.error.message}`);
				},
				resolve: async (agentId, requestId, resolution) => {
					const answered = await ctx.remote.dynamicCordisRunner.resolveInspectQuery(agentId, requestId, resolution);
					if (!answered.ok) throw new Error(`${answered.error.code}: ${answered.error.message}`);
				}
			});
			provideClientCordisInspect(ctx, inspect);
			for (const provider of clientInspectProviders(ctx)) ctx.effect(() => inspect.register(provider), `cordis-client-runner: inspect ${provider.manifest.id}`);
			ctx.on("connection/reset", () => {
				inspect.publish();
			});
			const runner = new DynamicCordisPackageRunner({
				ctx,
				loader: ctx.loader,
				modules: ctx.get("modules"),
				slots: ctx.get("slots"),
				invoke: async (pluginId, pluginRunId, method, args) => {
					const answered = await ctx.remote.dynamicCordisRunner.invoke(pluginId, pluginRunId, method, args).catch((error) => {
						throw new Error(wireFailure(pluginId, method, error));
					});
					if (!answered.ok) throw new Error(wireFailure(pluginId, method, `${answered.error.code}: ${answered.error.message}`));
					const result = answered.value;
					if (result.ok) return result.value;
					throw invokeError(pluginId, method, result);
				},
				reportRenderFailure: (agentId, pluginId, pluginRunId, failure) => {
					ctx.remote.dynamicCordisRunner.reportRenderFailure(agentId, pluginId, pluginRunId, failure).then((result) => {
						if (!result.ok) console.error(`[cordis-client-runner] reporting a render failure of ${pluginId} failed:`, result.error);
					}, (error) => {
						console.error(`[cordis-client-runner] reporting a render failure of ${pluginId} failed:`, error);
					});
				},
				reportGuardFailure: (agentId, pluginId, pluginRunId, failure) => {
					ctx.remote.dynamicCordisRunner.reportClientGuardFailure(agentId, pluginId, pluginRunId, failure).then((result) => {
						if (!result.ok) console.error(`[cordis-client-runner] reporting a guard failure of ${pluginId} failed:`, result.error);
					}, (error) => {
						console.error(`[cordis-client-runner] reporting a guard failure of ${pluginId} failed:`, error);
					});
				}
			});
			const orchestrator = new CordisRunOrchestrator({
				runner,
				host: {
					runHostHalf: async (agentId, pluginId, packageId, mode, requestId, approveFutureVersions) => {
						const answered = await ctx.remote.dynamicCordisRunner.runHostHalf(agentId, pluginId, packageId, mode, requestId, approveFutureVersions);
						return answered.ok ? answered.value : {
							ok: false,
							message: `${answered.error.code}: ${answered.error.message}`
						};
					},
					getClientCode: async (agentId, pluginId, pluginRunId) => {
						const answered = await ctx.remote.dynamicCordisRunner.getClientCode(agentId, pluginId, pluginRunId);
						if (!answered.ok) throw new Error(`${answered.error.code}: ${answered.error.message}`);
						return answered.value;
					},
					resolveRequestRun: async (requestId, resolution) => {
						const answered = await ctx.remote.dynamicCordisRunner.resolveRequestRun(requestId, resolution);
						if (!answered.ok) throw new Error(`${answered.error.code}: ${answered.error.message}`);
						return answered.value;
					},
					settleUserRun: async (agentId, pluginId, resolution) => {
						const answered = await ctx.remote.dynamicCordisRunner.settleUserRun(agentId, pluginId, resolution);
						if (!answered.ok) throw new Error(`${answered.error.code}: ${answered.error.message}`);
						return answered.value;
					}
				}
			});
			const face = {
				activeRuns: orchestrator.activeRuns,
				lastRunError: orchestrator.lastRunError,
				renderFailures: runner.renderFailures,
				reconcileApprovals: (rows) => {
					orchestrator.reconcileApprovals(rows);
				},
				approve: (requestId, approveFutureVersions) => orchestrator.approve(requestId, approveFutureVersions),
				decline: (requestId) => orchestrator.decline(requestId),
				startUserRun: (request) => orchestrator.startUserRun(request),
				subscribe: (fn) => runner.subscribe(fn),
				getSnapshot: () => runner.getSnapshot(),
				isLoaded: (id) => runner.isLoaded(id)
			};
			ctx.provide("dynamicCordisRunner", face);
			ctx.effect(() => () => {
				runner.dispose();
			}, "cordis-client-runner: dynamic package runner");
			ctx.remote.$on("cordis/request-run", (request) => {
				orchestrator.open(request);
			});
			ctx.remote.$on("cordis/request-run-resolved", (resolved) => {
				orchestrator.close(resolved.requestId);
			});
			ctx.remote.$on("cordis/dynamic-retract", (retracted) => {
				runner.retract(retracted.pluginId, retracted.pluginRunId);
			});
			ctx.remote.$on("cordis/inspect-query", (request) => {
				inspect.query(request).catch((error) => {
					console.error(`[cordis-client-runner] inspect query ${request.provider}.${request.method} failed:`, error);
				});
			});
			ctx.remote.$on("cordis/inspect-query-resolved", (resolved) => {
				inspect.close(resolved.requestId);
			});
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		exports.ClientCordisInspectRegistry = ClientCordisInspectRegistry;
		exports.ClientTimerService = ClientTimerService;
		exports.CordisRunOrchestrator = CordisRunOrchestrator;
		exports.DynamicCordisPackageRunner = DynamicCordisPackageRunner;
		exports.DynamicCordisStyles = DynamicCordisStyles;
		exports.apply = apply;
		exports.dynamicCordisContext = dynamicCordisContext;
		exports.evaluateClientHalf = evaluateClientHalf;
		exports.inject = inject;
		exports.isDynamicCordisPlugin = isDynamicCordisPlugin;
		exports.name = name;
		return module.exports;
} // __DSH_FRAGMENT_END__

export {};
