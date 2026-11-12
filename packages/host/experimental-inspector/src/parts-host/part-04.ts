/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN dòng 2123–2599 của stock lib/index.js (@deepseek-ai/dsh-experimental-inspector): 7 region (cordis/collector → host/plugin → index), kết bằng dòng export cuối của bundle
 */
// @ts-nocheck

//#region lib/types/shared/cordis/collector.js
/** Shared Host/Client projection from live Cordis objects to a bounded semantic tree. */
const SHADOW = Symbol.for("cordis.shadow");
/** Realm-local collector retaining Contexts without Cordis service-call shadow wrappers. */
var CordisTreeCollector = class {
	root;
	limits;
	/** Live-object table replaced atomically with each emitted snapshot. */
	objects = new RealmObjectRegistry();
	revision = 0;
	constructor(root, limits) {
		this.root = root;
		this.limits = limits;
	}
	/**
	* Capture the current reachable Context/Fiber tree.
	* @returns A detached JSON snapshot whose retained objects replace the prior generation atomically.
	*/
	snapshot() {
		const collected = collectContexts(this.root);
		const tree = collected.root;
		const objects = this.objects.begin();
		let nodeCount = 0;
		let truncated = collected.truncated;
		const contextNode = (info) => {
			if (nodeCount >= this.limits.maxNodes) {
				truncated = true;
				return;
			}
			nodeCount++;
			const node = {
				kind: "context",
				objectHandle: objects.retain(info.value).handle,
				children: []
			};
			for (const child of info.children) if (child.fiber !== void 0 && unwrapContext(child.fiber.ctx) === child.value) {
				const projected = fiberNode(child.fiber, child);
				if (projected !== void 0) node.children.push(projected);
			} else {
				const projected = contextNode(child);
				if (projected !== void 0) node.children.push(projected);
			}
			return node;
		};
		const fiberNode = (fiber, owned) => {
			if (fiber.uid === null) return void 0;
			if (nodeCount + 2 > this.limits.maxNodes) {
				truncated = true;
				return;
			}
			nodeCount++;
			const context = contextNode(owned);
			return {
				kind: "fiber",
				objectHandle: objects.retain(fiber).handle,
				uid: fiber.uid,
				children: [context]
			};
		};
		const root = contextNode(tree);
		if (root === void 0) throw new Error("inspector: maxNodes cannot retain the root Context");
		let snapshot = {
			schemaVersion: 0,
			revision: ++this.revision,
			objectRegistryId: this.objects.id,
			root,
			truncated
		};
		while (jsonByteLength(snapshot) > this.limits.maxBytes) {
			const removed = pruneLast(root);
			if (removed.length === 0) break;
			for (const handle of removed) objects.release(handle);
			snapshot = {
				...snapshot,
				truncated: true
			};
		}
		if (jsonByteLength(snapshot) > this.limits.maxBytes) throw new Error("inspector: Cordis root exceeds the source-frame byte limit");
		objects.commit();
		return snapshot;
	}
	/** Release the realm-global resolver and every retained object. */
	close() {
		this.objects.close();
	}
};
function collectContexts(root) {
	const contexts = /* @__PURE__ */ new Map();
	let truncated = false;
	const ensure = (candidate, depth = 0) => {
		if (depth > 100) {
			truncated = true;
			return;
		}
		const value = unwrapContext(candidate);
		if (!Context.is(value)) return void 0;
		const existing = contexts.get(value);
		if (existing !== void 0) return existing;
		if (value === root) {
			const info = describeContext(value);
			contexts.set(value, info);
			return info;
		}
		const parent = ensure(unwrapContext(Object.getPrototypeOf(value)), depth + 1);
		if (parent === void 0) return void 0;
		const info = describeContext(value);
		contexts.set(value, info);
		parent.children.push(info);
		return info;
	};
	const rootInfo = ensure(root);
	for (const runtime of root.registry.values()) for (const fiber of runtime.fibers) {
		if (fiber.uid === null) continue;
		ensure(fiber.parent);
		ensure(fiber.ctx);
	}
	for (const key of Reflect.ownKeys(root.events._hooks)) for (const hook of root.events._hooks[key] ?? []) ensure(hook.ctx);
	const order = (info) => info.fiber?.uid ?? Number.MAX_SAFE_INTEGER;
	for (const info of contexts.values()) info.children.sort((left, right) => order(left) - order(right));
	return {
		root: rootInfo,
		truncated
	};
}
function describeContext(value) {
	return {
		value,
		children: [],
		fiber: ownValue(value, "fiber")
	};
}
function ownValue(value, key) {
	return Reflect.getOwnPropertyDescriptor(value, key)?.value;
}
function unwrapContext(value) {
	let current = value;
	while (typeof current === "object" && current !== null && Object.hasOwn(current, SHADOW)) current = Object.getPrototypeOf(current);
	return current;
}
function pruneLast(context) {
	const child = context.children.at(-1);
	if (child === void 0) return [];
	if (child.kind === "context") {
		const nested = pruneLast(child);
		if (nested.length > 0) return nested;
		context.children.pop();
		return [child.objectHandle];
	}
	const owned = child.children[0];
	const nested = pruneLast(owned);
	if (nested.length > 0) return nested;
	context.children.pop();
	return [child.objectHandle, owned.objectHandle];
}
//#endregion
//#region lib/types/shared/cordis/observer.js
/** Lifecycle-driven Cordis tree publication shared by Host and Client plugin faces. */
/**
* Observe one Cordis realm and publish immutable tree replacements.
* @param ctx - Plugin context whose root is inspected and whose effects own listeners.
* @param listener - Consumer of complete snapshots in the inspected realm.
* @param limits - Snapshot node and encoded-byte limits.
* @returns A disposer that unregisters listeners and releases retained objects.
*/
function observeCordisTree(ctx, listener, limits) {
	const collector = new CordisTreeCollector(ctx.root, limits);
	let scheduled = false;
	let closed = false;
	const publish = () => {
		scheduled = false;
		if (closed) return;
		listener(collector.snapshot());
	};
	const schedule = () => {
		if (scheduled || closed) return;
		scheduled = true;
		queueMicrotask(publish);
	};
	const disposers = [ctx.on("internal/plugin", schedule, { global: true }), ctx.on("internal/status", schedule, { global: true })];
	publish();
	return () => {
		if (closed) return;
		closed = true;
		for (const dispose of disposers) dispose();
		collector.close();
	};
}
//#endregion
//#region lib/types/shared/cordis/publisher.js
/** Shared Host/Client publication of browser-safe Cordis snapshots. */
/**
* Observe one Cordis runtime and retain its latest source snapshot.
* @param ctx - Plugin context whose root is inspected.
* @param publisher - Active Host or Client source publisher.
* @param limits - Snapshot node and encoded-byte limits.
* @returns A disposer that stops observation and releases retained objects.
*/
function publishCordisTree(ctx, publisher, limits) {
	return observeCordisTree(ctx, (snapshot) => {
		publisher.setState(CORDIS_TREE_TOPIC, snapshot);
	}, limits);
}
//#endregion
//#region lib/types/shared/web.js
/** Authenticated browser bootstrap route; the debugging URL stays on the Host. */
/** Read the current browser-source connection parameters. */
const INSPECTOR_BOOTSTRAP_PATH = "/api/experimental-inspector/bootstrap";
INSPECTOR_BOOTSTRAP_PATH.slice(1);
/** Query parameter selecting the Client visible beside Host in one DevTools connection. */
const INSPECTOR_CLIENT_QUERY = "clientSourceId";
/**
* Read an optional Client selection from a DevTools WebSocket URL.
* @param url - Untrusted upgrade URL.
* @returns The selected logical Client id, or undefined for all Clients.
* @throws If the selection is repeated or is not a valid source id.
*/
function readInspectorClientSelection(url) {
	const values = url.searchParams.getAll(INSPECTOR_CLIENT_QUERY);
	const selected = values[0];
	if (selected === void 0) return void 0;
	if (values.length !== 1) throw new Error("Inspector Client selection must occur once");
	return inspectorId(selected, INSPECTOR_CLIENT_QUERY);
}
//#endregion
//#region lib/types/shared/dispose.js
/** Ordered release of Inspector registrations before their source transport closes. */
/**
* Join every registration disposer in reverse order, then close the source even after failures.
* @param disposers - Registrations in acquisition order.
* @param close - Final transport teardown.
* @param message - Aggregate failure diagnostic owned by the Host or Client caller.
* @returns Completion after all cleanup actions have settled.
* @throws AggregateError containing every failed cleanup action in release order.
*/
async function disposeInspectorResources(disposers, close, message) {
	const failures = [];
	for (const dispose of [...disposers].reverse().concat(close)) try {
		await dispose();
	} catch (error) {
		failures.push(error);
	}
	if (failures.length > 0) throw new AggregateError(failures, message);
}
//#endregion
//#region lib/types/host/plugin.js
/** Host Cordis plugin for the cross-realm Inspector Worker and full fetch capture. */
const DEVTOOLS_PATH = "/inspector/devtools";
/** Node's standard code for a feature the running platform cannot provide, such as `worker_threads` in a browser Worker host. */
const FEATURE_UNAVAILABLE_ON_PLATFORM = "ERR_FEATURE_UNAVAILABLE_ON_PLATFORM";
/**
* Start the Worker, expose `ctx.inspector`, and inject the matching Client bootstrap.
* The bootstrap route exists before the Worker is ready, so a Client published during startup waits instead of failing.
* When the platform cannot run the Worker (`ERR_FEATURE_UNAVAILABLE_ON_PLATFORM`), the plugin warns once and stays active
* with only that route, which answers 503; every other startup failure rolls back and rejects the fiber.
*/
async function apply$1(ctx, config) {
	await ctx.effect(async () => {
		const spec = resolveInspectorOptions(config);
		const ready = Promise.withResolvers();
		const disposers = [];
		let worker;
		const dispose = () => disposeInspectorResources(disposers, () => worker?.close(), "experimental-inspector: disposal failed");
		try {
			disposers.push(ctx.connection.fetch.register({
				path: INSPECTOR_BOOTSTRAP_PATH,
				methods: ["GET"],
				requestBody: "buffered",
				fetch: (request) => bootstrapResponse(ready.promise, request.signal)
			}));
			const handle = await startInspector(spec).catch((error) => {
				if (!isUnavailableOnPlatform(error)) throw error;
				ctx.logger.warn("experimental-inspector: NodeJS Inspector is unavailable on this platform; Host inspection stays disabled", error);
			});
			if (handle === void 0) {
				ready.resolve(void 0);
				return dispose;
			}
			worker = handle;
			const { default: serveStatic } = await import("serve-static");
			disposers.push(publishCordisTree(ctx, handle.source, {
				maxNodes: spec.maxCordisNodes,
				maxBytes: spec.maxSourceFrameBytes - 4096
			}));
			disposers.push(ctx.provide("inspector", createInspectorService(handle.source)));
			disposers.push(ctx.on("webserver/index-inject", (table) => {
				table.push({
					kind: "global",
					name: "__GBH_INSPECTOR__",
					value: handle.endpoint.client
				});
			}));
			const assets = serveStatic(fileURLToPath(new URL("./lib/devtools/", import.meta.resolve("@deepseek-ai/dsh-experimental-inspector/package.json"))), {
				index: false,
				redirect: false,
				fallthrough: true,
				setHeaders: (res) => {
					res.setHeader("X-Content-Type-Options", "nosniff");
				}
			});
			disposers.push(ctx.webServer.register({
				kind: "prefix",
				path: DEVTOOLS_PATH,
				handler: (req, res) => {
					if (req.method !== "GET" && req.method !== "HEAD") {
						res.writeHead(405, { allow: "GET, HEAD" }).end();
						return;
					}
					if (!ctx.connection.authorizeIndex(req, res)) return;
					const url = new URL(req.url ?? "/", "http://inspector.invalid");
					if (url.pathname === DEVTOOLS_PATH || url.pathname === `${DEVTOOLS_PATH}/`) {
						const location = `${url.pathname === DEVTOOLS_PATH ? "devtools/" : ""}devtools_app.html${url.search}`;
						res.writeHead(302, { location }).end();
						return;
					}
					req.url = `${url.pathname.slice(19)}${url.search}`;
					assets(req, res, (error) => {
						if (error !== void 0) {
							ctx.logger.warn("experimental-inspector: frontend asset request failed", error);
							if (res.headersSent) res.destroy();
							else res.writeHead(500).end();
						} else res.writeHead(404).end();
					});
				}
			}));
			const sockets = /* @__PURE__ */ new Set();
			const track = (socket) => {
				sockets.add(socket);
				socket.once("close", () => {
					sockets.delete(socket);
				});
			};
			disposers.push(async () => {
				await Promise.all([...sockets].map((socket) => new Promise((resolve) => {
					socket.once("close", resolve);
					socket.destroy();
				})));
			});
			const target = new URL(handle.endpoint.webSocketDebuggerUrl);
			disposers.push(ctx.webServer.registerUpgrade({
				path: `${DEVTOOLS_PATH}/cdp`,
				handler: (req, socket, head) => {
					const rejection = ctx.connection.requestRejection(req);
					if (rejection !== void 0) {
						const reason = rejection === 401 ? "Unauthorized" : "Forbidden";
						socket.end(`HTTP/1.1 ${rejection} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
						return;
					}
					const endpoint = new URL(target);
					try {
						const selected = readInspectorClientSelection(new URL(req.url ?? "/", "http://inspector.invalid"));
						if (selected !== void 0) endpoint.searchParams.set(INSPECTOR_CLIENT_QUERY, selected);
					} catch (error) {
						socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
						return;
					}
					const upstream = connect(Number(target.port), target.hostname);
					track(socket);
					track(upstream);
					upstream.once("connect", () => {
						upstream.write(`GET ${endpoint.pathname}${endpoint.search} HTTP/1.1\r\nHost: ${target.host}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n`);
						for (const [key, value] of Object.entries(req.headers)) if (key.startsWith("sec-websocket-") && value !== void 0) upstream.write(`${key}: ${Array.isArray(value) ? value.join(", ") : value}\r\n`);
						upstream.write("\r\n");
						if (head.length > 0) upstream.write(head);
						socket.pipe(upstream).pipe(socket);
					});
					upstream.once("error", () => {
						socket.destroy();
					});
					socket.once("error", () => {
						upstream.destroy();
					});
					upstream.once("close", () => {
						socket.destroy();
					});
					socket.once("close", () => {
						upstream.destroy();
					});
				}
			}));
			console.log(`dsh inspector: ${handle.endpoint.devtoolsFrontendUrl}`);
			ready.resolve(handle.endpoint.client);
			if (ctx.get("cmdlineArgs")?.get().includes("--inspect")) {
				const { default: open, apps } = await import("open");
				await open(handle.endpoint.devtoolsFrontendUrl, {
					app: { name: apps.chrome },
					wait: false
				}).catch((error) => {
					ctx.logger.error("experimental-inspector: Chrome could not open DevTools", error);
				});
			}
		} catch (error) {
			ready.resolve(void 0);
			await dispose().catch((cleanupError) => {
				ctx.logger.error("experimental-inspector: initialization rollback failed", cleanupError);
			});
			throw error;
		}
		return dispose;
	}, "experimental-inspector: Host Worker");
}
/**
* Report whether a Worker startup failure means this platform cannot run the Inspector at all.
* @param error - Rejection from {@link startInspector}.
* @returns True only for Node's `ERR_FEATURE_UNAVAILABLE_ON_PLATFORM` code; messages are never inspected.
*/
function isUnavailableOnPlatform(error) {
	return error instanceof Error && "code" in error && error.code === FEATURE_UNAVAILABLE_ON_PLATFORM;
}
/**
* Answer one bootstrap request once Host initialization settles or the browser abandons the request.
* @param ready - Resolves with the Client bootstrap, or with undefined after initialization failed or found the platform unavailable.
* @param signal - Request signal; an aborted request stops waiting and receives no endpoint.
* @returns The bootstrap JSON, or 503 when the Inspector is unavailable or the request was aborted.
*/
async function bootstrapResponse(ready, signal) {
	const headers = { "cache-control": "no-store" };
	const abandoned = Promise.withResolvers();
	const abandon = () => {
		abandoned.resolve(void 0);
	};
	if (signal.aborted) abandon();
	else signal.addEventListener("abort", abandon, { once: true });
	try {
		const client = await Promise.race([ready, abandoned.promise]);
		return client === void 0 ? new Response(null, {
			status: 503,
			headers
		}) : Response.json(client, { headers });
	} finally {
		signal.removeEventListener("abort", abandon);
	}
}
//#endregion
//#region lib/types/index.js
/** Repository-facing Host package entry over the mirrored implementation tree. */
/** Cordis plugin name shared with the Client face. */
const name = "experimental-inspector";
/** Web Host and authenticated browser bootstrap transport. */
const inject = ["webServer", "connection"];
const libraryDefaults = resolveInspectorOptions();
/** Runtime validation for {@link Config}. */
const Config = z.object({
	host: z.const("127.0.0.1").default("127.0.0.1"),
	port: z.natural().max(65535).default(9230),
	clientOrigins: z.array(z.string()).default([]),
	captureFetch: z.boolean().default(true),
	maxRequestBodyBytes: z.natural().min(1).default(libraryDefaults.maxRequestBodyBytes),
	maxResponseBodyBytes: z.natural().min(1).default(libraryDefaults.maxResponseBodyBytes),
	maxBodyChunkBytes: z.natural().min(1).default(libraryDefaults.maxBodyChunkBytes),
	maxJournalBytes: z.natural().min(1).default(libraryDefaults.maxJournalBytes),
	maxRetainedRequests: z.natural().min(1).default(libraryDefaults.maxRetainedRequests),
	maxSourceFrameBytes: z.natural().min(1).default(libraryDefaults.maxSourceFrameBytes),
	maxSourceRecordsPerFrame: z.natural().min(1).default(libraryDefaults.maxSourceRecordsPerFrame),
	maxQueuedRecords: z.natural().min(1).default(libraryDefaults.maxQueuedRecords),
	maxQueuedBytes: z.natural().min(1).default(libraryDefaults.maxQueuedBytes),
	startupTimeoutMs: z.natural().min(1).default(libraryDefaults.startupTimeoutMs),
	stopTimeoutMs: z.natural().min(1).default(libraryDefaults.stopTimeoutMs),
	clientReconnectBaseMs: z.natural().min(1).default(libraryDefaults.clientReconnectBaseMs),
	clientReconnectMaxMs: z.natural().min(1).default(libraryDefaults.clientReconnectMaxMs),
	clientRuntimeTimeoutMs: z.natural().min(1).default(libraryDefaults.clientRuntimeTimeoutMs),
	queryTimeoutMs: z.natural().min(1).default(libraryDefaults.queryTimeoutMs),
	maxClientRuntimeObjects: z.natural().min(1).default(libraryDefaults.maxClientRuntimeObjects),
	maxClientRuntimeProperties: z.natural().min(1).default(libraryDefaults.maxClientRuntimeProperties),
	maxClientSourceBytes: z.natural().min(1).default(libraryDefaults.maxClientSourceBytes),
	maxCordisNodes: z.natural().min(1).default(libraryDefaults.maxCordisNodes),
	maxDisconnectedCordisTrees: z.natural().default(libraryDefaults.maxDisconnectedCordisTrees)
});
/**
* Start inspection when enabled; the hidden --inspect flag also opens the Host debugging window.
* @param ctx - Host Cordis plugin context.
* @param config - Validated Inspector configuration.
*/
async function apply(ctx, config) {
	await apply$1(ctx, config);
}
//#endregion
export { Config, apply, inject, name, resolveInspectorOptions, startInspector };

export {};
