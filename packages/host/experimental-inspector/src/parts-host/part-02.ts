/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN dòng 1087–1583 của stock lib/index.js (@deepseek-ai/dsh-experimental-inspector): 6 region (host/bridge/publisher → transport), phần bridge host + RPC + transport
 */
// @ts-nocheck

//#region lib/types/host/bridge/publisher.js
/** Buffered Host observation publication over a dedicated Worker MessagePort. */
/** Non-blocking Host publisher with microtask-coalesced MessagePort writes. */
var HostBridgePublisher = class {
	port;
	source;
	records;
	flushScheduled = false;
	inFlightNextSequence;
	closed = false;
	/** true khi đã cảnh báo lần đầu source closed (fail-soft: tránh ném làm chết host, chỉ warn 1 lần). */
	closedLogged = false;
	constructor(port, source, options) {
		this.port = port;
		this.source = source;
		this.records = new InspectorSourceBuffer(options);
	}
	publish(topic, payload, monotonicMs = performance.now()) {
		if (this.closed) return;
		this.records.publish(topic, payload, monotonicMs);
		this.scheduleFlush();
	}
	setState(topic, payload, monotonicMs = performance.now()) {
		if (this.closed) {
			// SAI LỆCH CÓ CHỦ ĐÍCH (task-152 · HANDOVER §8): stock ném ở đây khi Worker chết (ECONNRESET) ⇒ fatal
			// uncaught exception ⇒ host exit. Fail-soft: cảnh báo ĐÚNG MỘT LẦN rồi bỏ qua lần ghi để host sống.
			if (!this.closedLogged) {
				this.closedLogged = true;
				console.warn("inspector: Host source is closed — bo qua setState (fail-soft, tranh lam chet host)");
			}
			return;
		}
		this.records.setState(topic, payload, monotonicMs);
		this.scheduleFlush();
	}
	/** Send the retained state as a complete source replacement. */
	replace() {
		this.inFlightNextSequence = void 0;
		this.port.postMessage(this.records.replacement(this.source.sourceId, this.source.generation));
		this.scheduleFlush();
	}
	/** Send one queued batch when no earlier MessagePort batch awaits acknowledgement. */
	flush() {
		if (this.closed || this.inFlightNextSequence !== void 0) return;
		const frame = this.records.takeBatch(this.source.sourceId, this.source.generation);
		if (frame === void 0) return;
		this.port.postMessage(frame);
		this.inFlightNextSequence = frame.firstSequence + frame.records.length;
	}
	/**
	* Release one in-flight batch and schedule the next bounded transfer.
	* @param nextSequence - First sequence expected by the Worker after the accepted batch.
	*/
	acknowledge(nextSequence) {
		if (this.closed || this.inFlightNextSequence === void 0) return;
		if (nextSequence !== this.inFlightNextSequence) throw new Error("inspector: Host source acknowledgement does not match the in-flight batch");
		this.inFlightNextSequence = void 0;
		this.scheduleFlush();
	}
	/** Send at most one final batch, discard later queued observations, and reject publication. */
	close() {
		if (this.closed) return;
		this.flush();
		this.closed = true;
		this.records.discardPending();
	}
	scheduleFlush() {
		if (!this.records.hasPending || this.flushScheduled) return;
		this.flushScheduled = true;
		queueMicrotask(() => {
			this.flushScheduled = false;
			this.flush();
		});
	}
};
/**
* Decode a consumer-neutral tree received across an Inspector transport.
* @param value - Untrusted query result value.
* @returns A detached tree containing only public semantic fields.
*/
function parseCordisRuntimeTree(value) {
	const record = exactObject(value, [
		"schemaVersion",
		"host",
		"clients"
	], "Cordis runtime tree");
	if (record.schemaVersion !== 0 || !Array.isArray(record.clients)) throw new Error("inspector protocol: invalid Cordis runtime tree");
	const host = record.host === null ? null : parseRealm(record.host, "host");
	const clients = record.clients.map((client) => parseRealm(client, "client"));
	const sourceIds = /* @__PURE__ */ new Set();
	for (const realm of host === null ? clients : [host, ...clients]) {
		if (sourceIds.has(realm.source.sourceId)) throw new Error("inspector protocol: Cordis runtime tree repeats a sourceId");
		sourceIds.add(realm.source.sourceId);
	}
	return {
		schemaVersion: 0,
		host,
		clients
	};
}
function parseRealm(value, kind) {
	const record = exactObject(value, [
		"source",
		"connection",
		"revision",
		"truncated",
		"root"
	], "Cordis runtime realm");
	const source = exactObject(record.source, [
		"sourceId",
		"kind",
		"label"
	], "Cordis runtime source");
	if (source.kind !== kind || typeof source.label !== "string" || source.label.length === 0 || source.label.length > 256) throw new Error(`inspector protocol: invalid ${kind} Cordis runtime source`);
	if (!Number.isSafeInteger(record.revision) || record.revision < 1 || typeof record.truncated !== "boolean") throw new Error("inspector protocol: invalid Cordis runtime realm header");
	const root = parseNode(record.root, { fiberUids: /* @__PURE__ */ new Set() }, 0);
	if (root.kind !== "context") throw new Error("inspector protocol: Cordis runtime root must be a Context");
	return {
		source: {
			sourceId: wireId(source.sourceId, "sourceId"),
			kind,
			label: source.label
		},
		connection: parseConnection(record.connection),
		revision: record.revision,
		truncated: record.truncated,
		root
	};
}
function parseConnection(value) {
	if (!isPlainObject(value)) throw new Error("inspector protocol: Cordis runtime connection must be an object");
	if (value.state === "connected") {
		exactKeys(value, ["state"], "connected Cordis runtime connection");
		return { state: "connected" };
	}
	if (value.state === "disconnected" && typeof value.reason === "string") {
		exactKeys(value, ["state", "reason"], "disconnected Cordis runtime connection");
		return {
			state: "disconnected",
			reason: value.reason
		};
	}
	throw new Error("inspector protocol: invalid Cordis runtime connection");
}
function parseNode(value, state, depth) {
	if (depth > 256) throw new Error("inspector protocol: Cordis runtime tree exceeds the depth limit");
	if (!isPlainObject(value) || value.kind !== "context" && value.kind !== "fiber") throw new Error("inspector protocol: Cordis runtime node must have a known kind");
	const record = exactObject(value, value.kind === "fiber" ? [
		"kind",
		"uid",
		"children"
	] : ["kind", "children"], "Cordis runtime node");
	if (!Array.isArray(record.children)) throw new Error("inspector protocol: Cordis runtime node children must be an array");
	if (record.kind === "context") return {
		kind: "context",
		children: record.children.map((child) => parseNode(child, state, depth + 1))
	};
	if (!Number.isSafeInteger(record.uid) || record.uid < 1 || record.children.length !== 1) throw new Error("inspector protocol: invalid Cordis runtime Fiber");
	const uid = record.uid;
	if (state.fiberUids.has(uid)) throw new Error("inspector protocol: Cordis runtime tree repeats a Fiber uid");
	state.fiberUids.add(uid);
	const context = parseNode(record.children[0], state, depth + 1);
	if (context.kind !== "context") throw new Error("inspector protocol: Cordis runtime Fiber child must be a Context");
	return {
		kind: "fiber",
		uid,
		children: [context]
	};
}
//#endregion
//#region lib/types/shared/bridge/messages/query/codec.js
/** Exact decoders for non-CDP Inspector query frames. */
/**
* Test whether a decoded carrier value belongs to the query response protocol.
* @param value - Decoded carrier value.
* @returns Whether the query response decoder owns the value.
*/
function isInspectorQueryResponseEnvelope(value) {
	return isPlainObject(value) && value.t === "query/response";
}
/**
* Decode one Worker-to-source query response.
* @param value - Untrusted decoded carrier value.
* @returns The detached, validated response frame.
*/
function parseInspectorQueryResponseFrame(value) {
	const record = exactObject(value, [
		"v",
		"t",
		"sourceId",
		"generation",
		"requestId",
		"outcome"
	], "query response");
	if (record.v !== 0 || record.t !== "query/response") throw new Error("inspector protocol: invalid query response envelope");
	return {
		v: 0,
		t: "query/response",
		sourceId: wireId(record.sourceId, "sourceId"),
		generation: wireId(record.generation, "generation"),
		requestId: wireId(record.requestId, "requestId"),
		outcome: parseOutcome(record.outcome)
	};
}
function parseResult(value) {
	if (!isPlainObject(value) || typeof value.op !== "string") throw new Error("inspector protocol: query result must have an op");
	switch (value.op) {
		case "cordis-tree/get":
			exactKeys(value, ["op", "tree"], "Cordis tree query result");
			return {
				op: "cordis-tree/get",
				tree: parseCordisRuntimeTree(value.tree)
			};
		default: throw new Error(`inspector protocol: unknown query result ${JSON.stringify(value.op)}`);
	}
}
function parseOutcome(value) {
	if (!isPlainObject(value) || typeof value.ok !== "boolean") throw new Error("inspector protocol: invalid query outcome");
	if (value.ok) {
		exactKeys(value, ["ok", "result"], "successful query outcome");
		return {
			ok: true,
			result: parseResult(value.result)
		};
	}
	exactKeys(value, ["ok", "error"], "failed query outcome");
	const error = exactObject(value.error, ["code", "message"], "query error");
	if (!QUERY_ERROR_CODES.has(error.code) || typeof error.message !== "string") throw new Error("inspector protocol: invalid query error");
	return {
		ok: false,
		error: {
			code: error.code,
			message: error.message
		}
	};
}
const QUERY_ERROR_CODES = new Set([
	"invalid-request",
	"stale-source",
	"result-too-large",
	"internal-error"
]);
//#endregion
//#region lib/types/shared/bridge/rpc.js
/** Shared Host/Client owner of correlated non-CDP query requests. */
/** Failure deliberately returned by the Worker query handler. */
var InspectorQueryRemoteError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
	}
};
/** Correlates requests for one reconnecting Host or Client source. */
var InspectorQueryConnection = class {
	options;
	pending = /* @__PURE__ */ new Map();
	active;
	nextRequestId = 0;
	closed = false;
	constructor(options) {
		this.options = options;
	}
	/**
	* Admit the source generation acknowledged by the Worker.
	* @param sourceId - Stable source identity.
	* @param generation - Newly accepted transport generation.
	* @param sender - Carrier writer valid for that generation.
	*/
	connect(sourceId, generation, sender) {
		if (this.closed) throw new Error("inspector query connection is closed");
		this.disconnect("Inspector source generation replaced");
		this.active = {
			sourceId,
			generation,
			sender
		};
	}
	/**
	* Execute a query against the currently accepted source generation.
	* @param query - Closed typed query command.
	* @returns The result with the same operation discriminant.
	*/
	request(query) {
		const active = this.active;
		if (this.closed || active === void 0) return Promise.reject(/* @__PURE__ */ new Error("Inspector query transport is not connected"));
		const requestId = inspectorId(`query-${String(++this.nextRequestId)}`, "requestId");
		const frame = {
			v: 0,
			t: "query/request",
			sourceId: active.sourceId,
			generation: active.generation,
			requestId,
			query
		};
		if (jsonByteLength(frame) > this.options.maxFrameBytes) return Promise.reject(/* @__PURE__ */ new Error(`Inspector query request exceeds ${String(this.options.maxFrameBytes)} bytes`));
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(requestId);
				reject(/* @__PURE__ */ new Error(`Inspector query ${query.op} timed out after ${String(this.options.timeoutMs)}ms`));
			}, this.options.timeoutMs);
			this.pending.set(requestId, {
				op: query.op,
				resolve,
				reject,
				timer
			});
			try {
				active.sender.send(frame);
			} catch (error) {
				this.rejectPending(requestId, renderError(error));
			}
		});
	}
	/**
	* Consume a decoded carrier value when it is a query response.
	* @param value - Untrusted Worker-to-source value.
	* @returns Whether the value belonged to the query protocol.
	*/
	receive(value) {
		if (!isInspectorQueryResponseEnvelope(value)) return false;
		let frame;
		try {
			frame = parseInspectorQueryResponseFrame(value);
			if (jsonByteLength(frame) > this.options.maxFrameBytes) throw new Error(`inspector protocol: query response exceeds ${String(this.options.maxFrameBytes)} bytes`);
		} catch (error) {
			this.disconnect(`Invalid Inspector query response: ${renderError(error).message}`);
			throw error;
		}
		const pending = this.pending.get(frame.requestId);
		if (pending === void 0) return true;
		const active = this.active;
		if (active === void 0 || frame.sourceId !== active.sourceId || frame.generation !== active.generation) {
			this.rejectPending(frame.requestId, /* @__PURE__ */ new Error("Inspector query response source generation does not match"));
			return true;
		}
		if (!frame.outcome.ok) {
			this.rejectPending(frame.requestId, new InspectorQueryRemoteError(frame.outcome.error.code, frame.outcome.error.message));
			return true;
		}
		if (frame.outcome.result.op !== pending.op) {
			this.rejectPending(frame.requestId, /* @__PURE__ */ new Error(`Inspector query response op ${frame.outcome.result.op} does not match ${pending.op}`));
			return true;
		}
		clearTimeout(pending.timer);
		this.pending.delete(frame.requestId);
		pending.resolve(frame.outcome.result);
		return true;
	}
	/**
	* Reject active requests while permitting a later source generation.
	* @param reason - Failure reported to every pending caller.
	*/
	disconnect(reason) {
		this.active = void 0;
		for (const requestId of [...this.pending.keys()]) this.rejectPending(requestId, new Error(reason));
	}
	/**
	* Permanently reject requests and prevent later reconnection.
	* @param reason - Failure reported to every pending caller.
	*/
	close(reason = "Inspector query connection closed") {
		if (this.closed) return;
		this.closed = true;
		this.disconnect(reason);
	}
	rejectPending(requestId, error) {
		const pending = this.pending.get(requestId);
		if (pending === void 0) return;
		clearTimeout(pending.timer);
		this.pending.delete(requestId);
		pending.reject(error);
	}
};
function renderError(error) {
	return error instanceof Error ? error : new Error(String(error));
}
//#endregion
//#region lib/types/host/bridge/rpc.js
/** Host-side non-CDP query bridge over the Worker MessagePort. */
/** Owns query correlation for one Host source generation. */
var HostBridgeRpc = class extends InspectorQueryConnection {
	port;
	constructor(port, options) {
		super(options);
		this.port = port;
	}
	/**
	* Connect query writes after the Worker accepts the Host source.
	* @param source - Accepted Host source descriptor.
	*/
	connectPort(source) {
		this.connect(source.sourceId, source.generation, { send: (frame) => {
			this.port.postMessage(frame);
		} });
	}
};
//#endregion
//#region lib/types/host/bridge/dispatcher.js
/** Dispatch of validated Worker frames accepted by the Host MessagePort. */
/**
* Dispatch one validated Worker frame and reject Client-only commands on the Host carrier.
* @param frame - Decoded Worker-to-source frame.
* @param handlers - Host source-lifecycle operations.
*/
function dispatchBridgeFrame(frame, handlers) {
	switch (frame.t) {
		case "source/accepted":
			handlers.accepted(frame);
			return;
		case "source/append-acknowledged":
			handlers.acknowledged(frame);
			return;
		case "source/resnapshot":
			handlers.resnapshot(frame);
			return;
		case "source/rejected":
			handlers.rejected(frame);
			return;
		case "client-runtime/request": return rejectRuntimeBridgeCommand(frame.command);
		case "client-runtime/cancel":
		case "client-runtime/response-acknowledged": return;
		case "client-console/enable":
		case "client-console/disable": return rejectConsoleBridgeCommand(frame.t);
		case "client-sources/request": return rejectSourcesBridgeCommand();
		case "client-runtime/session-closed":
		case "client-sources/session-closed": return;
		default: return assertNever(frame);
	}
}
function assertNever(value) {
	throw new Error(`Unexpected Worker source frame: ${JSON.stringify(value)}`);
}
//#endregion
//#region lib/types/host/bridge/transport.js
/** Host-realm observation publisher over a dedicated MessagePort. */
/** Non-blocking Host source; queue overflow is represented by `droppedBefore` on the next batch. */
var HostInspectorSource = class extends InspectorSourceConnection {
	port;
	source;
	publisher;
	closed = false;
	queries;
	constructor(port, options) {
		super();
		this.port = port;
		this.source = createHostRealmSource(options.label);
		this.publisher = new HostBridgePublisher(port, this.source, options);
		this.queries = new HostBridgeRpc(port, {
			timeoutMs: options.queryTimeoutMs,
			maxFrameBytes: options.maxFrameBytes
		});
		port.on("message", (value) => {
			try {
				if (this.queries.receive(value)) return;
				this.receive(parseWorkerSourceFrame(value));
			} catch {
				this.close();
			}
		});
		port.on("close", () => {
			this.queries.disconnect("Inspector Host source disconnected");
		});
		port.start();
		const open = {
			v: 0,
			t: "source/open",
			source: this.source,
			topics: [...options.topics]
		};
		port.postMessage(open);
		this.publisher.replace();
	}
	/** Flush pending observations and close the source port. */
	close() {
		if (this.closed) return;
		this.publisher.close();
		this.closed = true;
		this.queries.close("Inspector Host source closed");
		const frame = {
			v: 0,
			t: "source/close",
			sourceId: this.source.sourceId,
			generation: this.source.generation
		};
		this.port.postMessage(frame);
		this.port.close();
	}
	receive(frame) {
		if (frame.t !== "source/rejected" && (frame.sourceId !== this.source.sourceId || frame.generation !== this.source.generation)) return;
		dispatchBridgeFrame(frame, {
			accepted: () => {
				this.queries.connectPort(this.source);
			},
			acknowledged: (acknowledged) => {
				this.publisher.acknowledge(acknowledged.nextSequence);
			},
			resnapshot: () => {
				this.publisher.replace();
			},
			rejected: (rejected) => {
				this.queries.disconnect(`Inspector Host source rejected: ${rejected.message}`);
			}
		});
	}
};
//#endregion

export {};
