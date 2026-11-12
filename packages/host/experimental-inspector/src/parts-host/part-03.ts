/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN dòng 1584–2122 của stock lib/index.js (@deepseek-ai/dsh-experimental-inspector): 7 region (control-codec → cordis/object-registry), phần vòng đời + controller + object-registry
 */
// @ts-nocheck

//#region lib/types/shared/bridge/control-codec.js
/** Exact decoders for Host, Worker, and injected Client lifecycle values. */
/**
* Decode one Worker-to-Host lifecycle event.
* @param value - Untrusted control message.
* @returns The validated Worker event.
*/
function parseInspectorWorkerControl(value) {
	const record = exactObjectByType(value, "Worker control message");
	switch (record.type) {
		case "ready":
			exactKeys(record, [
				"type",
				"host",
				"port",
				"targetId"
			], "Worker ready message");
			if (typeof record.host !== "string" || typeof record.targetId !== "string") throw new Error("inspector protocol: invalid Worker ready identity");
			return {
				type: "ready",
				host: record.host,
				port: natural$1(record.port, "port", true),
				targetId: record.targetId
			};
		case "failure":
			exactKeys(record, ["type", "message"], "Worker failure message");
			if (typeof record.message !== "string") throw new Error("inspector protocol: invalid Worker failure");
			return {
				type: "failure",
				message: record.message
			};
		case "stopped":
			exactKeys(record, ["type"], "Worker stopped message");
			return { type: "stopped" };
		default: throw new Error("inspector protocol: unknown Worker control message");
	}
}
function exactObjectByType(value, label) {
	if (!isPlainObject(value) || typeof value.type !== "string") throw new Error(`inspector protocol: ${label} must have a type`);
	return value;
}
function natural$1(value, label, zero = false) {
	if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1)) throw new Error(`inspector protocol: ${label} must be ${zero ? "a non-negative" : "a positive"} safe integer`);
	return value;
}
//#endregion
//#region lib/types/host/bridge/lifecycle.js
/** Failure containment and shutdown coordination for the Inspector Worker. */
/** Tracks Worker termination without removing the listener that contains runtime errors. */
var InspectorWorkerLifecycle = class {
	worker;
	exitResolution = Promise.withResolvers();
	failureResolution = Promise.withResolvers();
	failure;
	running = false;
	expectedExit = false;
	notified = false;
	onUnexpectedExit;
	exitCodeValue;
	/** Worker exit code once its `exit` event has fired. */
	get exitCode() {
		return this.exitCodeValue;
	}
	constructor(worker) {
		this.worker = worker;
		worker.on("error", (error) => {
			this.failure ??= error;
			this.failureResolution.resolve(error);
			this.notifyUnexpectedExit();
		});
		worker.once("exit", (code) => {
			this.exitCodeValue = code;
			this.exitResolution.resolve(code);
			this.notifyUnexpectedExit();
		});
	}
	/**
	* Wait for the validated ready frame while also observing startup failure and exit.
	* @param timeoutMs - Readiness deadline in milliseconds.
	* @returns The Worker's bound endpoint fields.
	*/
	async waitForReady(timeoutMs) {
		let timer;
		let onMessage;
		const message = new Promise((resolve, reject) => {
			onMessage = (value) => {
				let control;
				try {
					control = parseInspectorWorkerControl(value);
				} catch (error) {
					reject(error instanceof Error ? error : new Error(String(error)));
					return;
				}
				if (control.type === "ready") resolve(control);
				else if (control.type === "failure") reject(/* @__PURE__ */ new Error(`inspector Worker failed: ${control.message}`));
			};
			timer = setTimeout(() => {
				reject(/* @__PURE__ */ new Error(`inspector Worker did not become ready within ${String(timeoutMs)}ms`));
			}, timeoutMs);
			this.worker.on("message", onMessage);
		});
		try {
			return await Promise.race([
				message,
				this.failureResolution.promise.then((error) => {
					throw error;
				}),
				this.exitResolution.promise.then((code) => {
					throw new Error(`inspector Worker exited before readiness (code ${String(code)})`);
				})
			]);
		} finally {
			if (timer !== void 0) clearTimeout(timer);
			if (onMessage !== void 0) this.worker.off("message", onMessage);
		}
	}
	/**
	* Begin reporting an unexpected runtime exit through one contained callback.
	* @param listener - Failure observer that must not throw.
	*/
	markRunning(listener) {
		this.running = true;
		this.onUnexpectedExit = listener;
		this.notifyUnexpectedExit();
	}
	/** Mark subsequent Worker termination as owner-requested. */
	expectExit() {
		this.expectedExit = true;
	}
	/** Terminate the Worker during failed initialization. */
	async terminate() {
		this.expectExit();
		if (this.exitCodeValue === void 0) await this.worker.terminate();
	}
	/**
	* Request graceful shutdown and terminate after the deadline.
	* @param timeoutMs - Grace period before forced termination.
	*/
	async stop(timeoutMs) {
		this.expectExit();
		if (this.exitCodeValue !== void 0) return;
		this.worker.postMessage({ type: "shutdown" });
		let timer;
		const timeout = new Promise((resolve) => {
			timer = setTimeout(() => {
				resolve("timeout");
			}, timeoutMs);
		});
		const outcome = await Promise.race([this.exitResolution.promise.then(() => "exited"), timeout]);
		if (timer !== void 0) clearTimeout(timer);
		if (outcome === "exited") return;
		await this.worker.terminate();
		throw new Error(`inspector Worker did not stop within ${String(timeoutMs)}ms and was terminated`);
	}
	notifyUnexpectedExit() {
		if (!this.running || this.expectedExit || this.notified || this.exitCodeValue === void 0) return;
		this.notified = true;
		this.onUnexpectedExit?.(this.failure ?? /* @__PURE__ */ new Error(`inspector Worker exited unexpectedly with code ${String(this.exitCodeValue)}`));
	}
};
//#endregion
//#region lib/types/host/bridge/controller.js
/** Host controller that owns the Inspector Worker and Host observation source. */
const DEFAULT_MAX_REQUEST_BODY_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_RESPONSE_BODY_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_BODY_CHUNK_BYTES = 48 * 1024;
const DEFAULT_MAX_JOURNAL_BYTES = 256 * 1024 * 1024;
const DEFAULT_MAX_RETAINED_REQUESTS = 2e3;
const DEFAULT_MAX_SOURCE_FRAME_BYTES = 128 * 1024;
const DEFAULT_MAX_SOURCE_RECORDS_PER_FRAME = 128;
const DEFAULT_MAX_QUEUED_RECORDS = 2048;
const DEFAULT_MAX_QUEUED_BYTES = 16 * 1024 * 1024;
const DEFAULT_STARTUP_TIMEOUT_MS = 1e4;
const DEFAULT_STOP_TIMEOUT_MS = 5e3;
const DEFAULT_CLIENT_RECONNECT_BASE_MS = 250;
const DEFAULT_CLIENT_RECONNECT_MAX_MS = 5e3;
const DEFAULT_CLIENT_RUNTIME_TIMEOUT_MS = 3e4;
const DEFAULT_QUERY_TIMEOUT_MS = 1e4;
const DEFAULT_MAX_CLIENT_RUNTIME_OBJECTS = 1e4;
const DEFAULT_MAX_CLIENT_RUNTIME_PROPERTIES = 2e3;
const DEFAULT_MAX_CLIENT_SOURCE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_CORDIS_NODES = 2048;
const DEFAULT_MAX_DISCONNECTED_CORDIS_TREES = 8;
/**
* Resolve and validate all deployment-varying Inspector choices.
* @param options - Partial caller configuration.
* @returns A complete immutable configuration.
*/
function resolveInspectorOptions(options = {}) {
	const spec = {
		host: options.host ?? "127.0.0.1",
		port: natural(options.port ?? 0, "port", true),
		clientOrigins: [...options.clientOrigins ?? []],
		captureFetch: options.captureFetch ?? true,
		maxRequestBodyBytes: natural(options.maxRequestBodyBytes ?? DEFAULT_MAX_REQUEST_BODY_BYTES, "maxRequestBodyBytes"),
		maxResponseBodyBytes: natural(options.maxResponseBodyBytes ?? DEFAULT_MAX_RESPONSE_BODY_BYTES, "maxResponseBodyBytes"),
		maxBodyChunkBytes: natural(options.maxBodyChunkBytes ?? DEFAULT_MAX_BODY_CHUNK_BYTES, "maxBodyChunkBytes"),
		maxJournalBytes: natural(options.maxJournalBytes ?? DEFAULT_MAX_JOURNAL_BYTES, "maxJournalBytes"),
		maxRetainedRequests: natural(options.maxRetainedRequests ?? DEFAULT_MAX_RETAINED_REQUESTS, "maxRetainedRequests"),
		maxSourceFrameBytes: natural(options.maxSourceFrameBytes ?? DEFAULT_MAX_SOURCE_FRAME_BYTES, "maxSourceFrameBytes"),
		maxSourceRecordsPerFrame: natural(options.maxSourceRecordsPerFrame ?? DEFAULT_MAX_SOURCE_RECORDS_PER_FRAME, "maxSourceRecordsPerFrame"),
		maxQueuedRecords: natural(options.maxQueuedRecords ?? DEFAULT_MAX_QUEUED_RECORDS, "maxQueuedRecords"),
		maxQueuedBytes: natural(options.maxQueuedBytes ?? DEFAULT_MAX_QUEUED_BYTES, "maxQueuedBytes"),
		startupTimeoutMs: natural(options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS, "startupTimeoutMs"),
		stopTimeoutMs: natural(options.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS, "stopTimeoutMs"),
		clientReconnectBaseMs: natural(options.clientReconnectBaseMs ?? DEFAULT_CLIENT_RECONNECT_BASE_MS, "clientReconnectBaseMs"),
		clientReconnectMaxMs: natural(options.clientReconnectMaxMs ?? DEFAULT_CLIENT_RECONNECT_MAX_MS, "clientReconnectMaxMs"),
		clientRuntimeTimeoutMs: natural(options.clientRuntimeTimeoutMs ?? DEFAULT_CLIENT_RUNTIME_TIMEOUT_MS, "clientRuntimeTimeoutMs"),
		queryTimeoutMs: natural(options.queryTimeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS, "queryTimeoutMs"),
		maxClientRuntimeObjects: natural(options.maxClientRuntimeObjects ?? DEFAULT_MAX_CLIENT_RUNTIME_OBJECTS, "maxClientRuntimeObjects"),
		maxClientRuntimeProperties: natural(options.maxClientRuntimeProperties ?? DEFAULT_MAX_CLIENT_RUNTIME_PROPERTIES, "maxClientRuntimeProperties"),
		maxClientSourceBytes: natural(options.maxClientSourceBytes ?? DEFAULT_MAX_CLIENT_SOURCE_BYTES, "maxClientSourceBytes"),
		maxCordisNodes: natural(options.maxCordisNodes ?? DEFAULT_MAX_CORDIS_NODES, "maxCordisNodes"),
		maxDisconnectedCordisTrees: natural(options.maxDisconnectedCordisTrees ?? DEFAULT_MAX_DISCONNECTED_CORDIS_TREES, "maxDisconnectedCordisTrees", true)
	};
	if (spec.port > 65535) throw new Error("inspector: port must not exceed 65535");
	if (Math.ceil(spec.maxBodyChunkBytes / 3) * 4 + 4096 > spec.maxSourceFrameBytes) throw new Error("inspector: maxSourceFrameBytes cannot carry one base64 body chunk");
	if (spec.clientReconnectMaxMs < spec.clientReconnectBaseMs) throw new Error("inspector: clientReconnectMaxMs must be at least clientReconnectBaseMs");
	for (const origin of spec.clientOrigins) if (new URL(origin).origin !== origin) throw new Error(`inspector: client origin must be canonical: ${origin}`);
	return spec;
}
/**
* Start the Worker, create the Host source, and install full fetch capture by default.
* @param options - Partial caller configuration.
* @returns The ready endpoint and its quiescent shutdown handle.
*/
async function startInspector(options = {}) {
	const spec = resolveInspectorOptions(options);
	const channel = new MessageChannel();
	const clientProtocol = `dsh-inspector-v${String(0)}-${randomBytes(32).toString("base64url")}`;
	const lifecycle = new InspectorWorkerLifecycle(spawnWorker({
		config: {
			host: spec.host,
			startPort: spec.port,
			targetId: randomUUID(),
			clientToken: clientProtocol,
			clientOrigins: spec.clientOrigins,
			maxSourceFrameBytes: spec.maxSourceFrameBytes,
			maxSourceRecordsPerFrame: spec.maxSourceRecordsPerFrame,
			maxRetainedRequests: spec.maxRetainedRequests,
			maxJournalBytes: spec.maxJournalBytes,
			clientRuntimeTimeoutMs: spec.clientRuntimeTimeoutMs,
			maxClientSourceBytes: spec.maxClientSourceBytes,
			maxCordisNodes: spec.maxCordisNodes,
			maxDisconnectedCordisTrees: spec.maxDisconnectedCordisTrees
		},
		hostSourcePort: channel.port2
	}));
	let source;
	try {
		source = new HostInspectorSource(channel.port1, {
			label: "Host",
			topics: ["*", ...NETWORK_TOPICS],
			maxQueuedRecords: spec.maxQueuedRecords,
			maxQueuedBytes: spec.maxQueuedBytes,
			maxRecordsPerFrame: spec.maxSourceRecordsPerFrame,
			maxFrameBytes: spec.maxSourceFrameBytes,
			queryTimeoutMs: spec.queryTimeoutMs
		});
	} catch (error) {
		channel.port1.close();
		await lifecycle.terminate();
		throw error;
	}
	const ready = await lifecycle.waitForReady(spec.startupTimeoutMs).catch(async (error) => {
		source.close();
		await lifecycle.terminate();
		throw error;
	});
	const authority = `${ready.host}:${String(ready.port)}`;
	const endpoint = {
		httpUrl: `http://${authority}/`,
		webSocketDebuggerUrl: `ws://${authority}/devtools/page/${ready.targetId}`,
		devtoolsFrontendUrl: `devtools://devtools/bundled/devtools_app.html?ws=${authority}/devtools/page/${ready.targetId}&panel=elements&noJavaScriptCompletion=true`,
		client: {
			endpoint: `ws://${authority}/ingest`,
			protocol: clientProtocol,
			maxQueuedRecords: spec.maxQueuedRecords,
			maxQueuedBytes: spec.maxQueuedBytes,
			maxRecordsPerFrame: spec.maxSourceRecordsPerFrame,
			maxFrameBytes: spec.maxSourceFrameBytes,
			reconnectBaseMs: spec.clientReconnectBaseMs,
			reconnectMaxMs: spec.clientReconnectMaxMs,
			queryTimeoutMs: spec.queryTimeoutMs,
			maxRuntimeObjectsPerSession: spec.maxClientRuntimeObjects,
			maxRuntimePropertiesPerResult: spec.maxClientRuntimeProperties,
			maxClientSourceBytes: spec.maxClientSourceBytes,
			maxCordisNodes: spec.maxCordisNodes
		}
	};
	let fetchObserver;
	try {
		fetchObserver = spec.captureFetch ? installFetchObserver(source, {
			maxRequestBodyBytes: spec.maxRequestBodyBytes,
			maxResponseBodyBytes: spec.maxResponseBodyBytes,
			maxChunkBytes: spec.maxBodyChunkBytes
		}) : void 0;
	} catch (error) {
		source.close();
		await lifecycle.terminate();
		throw error;
	}
	lifecycle.markRunning((error) => {
		try {
			source.close();
		} catch (closeError) {
			console.error("dsh inspector: Host source cleanup after Worker failure failed", closeError);
		}
		fetchObserver?.stop().catch((stopError) => {
			console.error("dsh inspector: fetch cleanup after Worker failure failed", stopError);
		});
		console.error("dsh inspector: Worker stopped unexpectedly", error);
	});
	let closing;
	return {
		endpoint,
		source,
		close() {
			closing ??= closeInspector(lifecycle, source, fetchObserver, spec.stopTimeoutMs);
			return closing;
		}
	};
}
function spawnWorker(boot) {
	const options = {
		workerData: boot,
		transferList: [boot.hostSourcePort],
		execArgv: []
	};
	if (!import.meta.url.endsWith(".ts")) return new Worker(new URL("./worker.js", import.meta.url), options);
	const workerEntry = new URL("../../worker/entry.ts", import.meta.url);
	const tsxEsmApiEntry = import.meta.resolve("tsx/esm/api");
	const bootstrap = [
		`import { register } from ${JSON.stringify(tsxEsmApiEntry)}`,
		"register()",
		`await import(${JSON.stringify(workerEntry.href)})`
	].join("\n");
	return new Worker(new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`), {
		...options,
		env: sourceWorkerEnv()
	});
}
function sourceWorkerEnv() {
	const env = {};
	if (process.platform === "win32") {
		env.TMP = tmpdir();
		env.TEMP = tmpdir();
	}
	if (process.env.TSX_TSCONFIG_PATH !== void 0) env.TSX_TSCONFIG_PATH = process.env.TSX_TSCONFIG_PATH;
	return env;
}
async function closeInspector(lifecycle, source, fetchObserver, timeoutMs) {
	const failures = [];
	try {
		await fetchObserver?.stop();
	} catch (error) {
		failures.push(error);
	}
	try {
		source.close();
	} catch (error) {
		failures.push(error);
	}
	try {
		await lifecycle.stop(timeoutMs);
	} catch (error) {
		failures.push(error);
	}
	if (failures.length > 0) throw new AggregateError(failures, "inspector: shutdown failed");
}
function natural(value, name, zero = false) {
	if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1)) throw new Error(`inspector: ${name} must be ${zero ? "a non-negative" : "a positive"} safe integer`);
	return value;
}
//#endregion
//#region lib/types/shared/bridge/query-reader.js
/** Query-backed adapter for the transport-independent Cordis tree reader. */
/**
* Create a reader that obtains the tree through the typed Inspector query protocol.
* @param requester - Active Host or Client query connection.
* @returns A non-CDP Cordis tree reader.
*/
function createQueryCordisRuntimeTreeReader(requester) {
	return { async getTree() {
		return (await requester.request({ op: "cordis-tree/get" })).tree;
	} };
}
//#endregion
//#region lib/types/shared/service.js
/** Cordis service API shared by the Host and Client plugin faces. */
/**
* Create the shared service façade without exposing the carrier implementation.
* @param connection - Realm-local observation and query transport.
* @returns The Cordis service value.
*/
function createInspectorService(connection) {
	return {
		publish: (topic, payload, monotonicMs) => {
			connection.publish(topic, payload, monotonicMs);
		},
		cordis: createQueryCordisRuntimeTreeReader(connection)
	};
}
//#endregion
//#region lib/types/shared/bridge/messages/cordis.js
/** Bridge message metadata for Cordis runtime-tree snapshots. */
/** Observation topic carrying the latest complete Cordis tree. */
const CORDIS_TREE_TOPIC = "cordis/tree";
//#endregion
//#region lib/types/shared/cordis/object-registry.js
/** Realm-local retention and identity for live objects referenced by Inspector snapshots. */
const REGISTRIES_SYMBOL = "dsh.inspector.realm-object-registries";
const MAX_FIBER_WRAPPER_DEPTH = 8;
`${JSON.stringify(REGISTRIES_SYMBOL)}`;
/** One realm's bounded table of objects retained by its latest semantic snapshot. */
var RealmObjectRegistry = class {
	/** Realm-unique id carried by every reference from this registry. */
	id = inspectorId(randomUUID$1(), "registryId");
	known = /* @__PURE__ */ new WeakMap();
	retained = /* @__PURE__ */ new Map();
	nextHandle = 1;
	disposed = false;
	constructor() {
		registries().set(this.id, this);
	}
	/**
	* Start one replacement generation.
	* @returns A collector that atomically installs exactly the retained objects on commit.
	*/
	begin() {
		if (this.disposed) throw new Error("inspector: realm object registry is disposed");
		return new RealmObjectGeneration(this);
	}
	/**
	* Resolve one current opaque handle.
	* @param handle - Handle from the latest committed snapshot.
	* @returns The live object, when it remains retained.
	*/
	resolve(handle) {
		return this.retained.get(handle);
	}
	/**
	* Identify one object retained by the latest snapshot. Cordis plugin calls may return nested thenable facades;
	* only objects whose prototype path consists exclusively of those `then` wrappers resolve to the retained Fiber.
	* @param value - Candidate live value.
	* @returns Its wire reference, when present in this registry.
	*/
	identify(value) {
		if ((typeof value !== "object" || value === null) && typeof value !== "function") return void 0;
		let candidate = value;
		for (let depth = 0; candidate !== null && depth <= MAX_FIBER_WRAPPER_DEPTH; depth++) {
			const handle = this.known.get(candidate);
			if (handle !== void 0 && this.retained.get(handle) === candidate) return {
				registryId: this.id,
				handle
			};
			try {
				const keys = Reflect.ownKeys(candidate);
				if (keys.length !== 1 || keys[0] !== "then") return void 0;
				candidate = Object.getPrototypeOf(candidate);
			} catch {
				return;
			}
		}
	}
	/** Remove this registry from the realm and release all strong references. */
	close() {
		if (this.disposed) return;
		this.disposed = true;
		registries().delete(this.id);
		this.retained.clear();
	}
	/**
	* Assign a stable handle and retain a value in one pending generation.
	* @param value - Object represented by the pending snapshot.
	* @param next - Pending generation's strong-reference table.
	* @returns The registry id and stable object handle.
	*/
	retain(value, next) {
		let handle = this.known.get(value);
		if (handle === void 0) {
			handle = inspectorId(`object-${String(this.nextHandle++)}`, "objectHandle");
			this.known.set(value, handle);
		}
		next.set(handle, value);
		return {
			registryId: this.id,
			handle
		};
	}
	/**
	* Replace the current strong-reference set with one completed generation.
	* @param next - Complete object table for the committed snapshot.
	*/
	commit(next) {
		this.retained = next;
	}
};
/** Mutable object set assembled before one snapshot becomes visible. */
var RealmObjectGeneration = class {
	owner;
	retained = /* @__PURE__ */ new Map();
	committed = false;
	constructor(owner) {
		this.owner = owner;
	}
	/**
	* Retain one object and obtain its stable opaque reference.
	* @param value - Context or Fiber represented in the snapshot.
	* @returns Source-local wire reference.
	*/
	retain(value) {
		if (this.committed) throw new Error("inspector: realm object generation is already committed");
		return this.owner.retain(value, this.retained);
	}
	/**
	* Stop retaining an object omitted while bounding the pending snapshot.
	* @param handle - Opaque handle removed from this pending generation.
	*/
	release(handle) {
		if (this.committed) throw new Error("inspector: realm object generation is already committed");
		this.retained.delete(handle);
	}
	/** Atomically replace the registry's retained set. */
	commit() {
		if (this.committed) return;
		this.committed = true;
		this.owner.commit(this.retained);
	}
};
function registries() {
	const key = Symbol.for(REGISTRIES_SYMBOL);
	const existing = Reflect.get(globalThis, key);
	if (existing instanceof Map) return existing;
	const value = /* @__PURE__ */ new Map();
	Reflect.set(globalThis, key, value);
	return value;
}
//#endregion

export {};
