/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN dòng 547–1086 của stock lib/index.js (@deepseek-ai/dsh-experimental-inspector): 12 region (runtime/frames → shared/bridge/buffer), phần CDP + realm + đệm bridge
 */
// @ts-nocheck

//#region lib/types/shared/bridge/messages/runtime/frames.js
/**
* Parse and rebuild one Worker-to-Client Runtime request.
* @param value - Untrusted request frame.
* @returns The validated request frame.
*/
function parseClientRuntimeRequestFrame(value) {
	exactKeys(value, [
		"v",
		"t",
		"sourceId",
		"generation",
		"sessionId",
		"requestId",
		"command"
	], "Client Runtime request");
	if (value.v !== 0 || value.t !== "client-runtime/request") throw new Error("inspector protocol: invalid Client Runtime request envelope");
	return {
		v: 0,
		t: "client-runtime/request",
		sourceId: wireId(value.sourceId, "sourceId"),
		generation: wireId(value.generation, "generation"),
		sessionId: wireId(value.sessionId, "sessionId"),
		requestId: wireId(value.requestId, "requestId"),
		command: parseClientRuntimeCommand(value.command)
	};
}
/**
* Parse and rebuild one Worker-to-Client Runtime cancellation.
* @param value - Untrusted cancellation frame.
* @returns The validated cancellation frame.
*/
function parseClientRuntimeCancelFrame(value) {
	exactKeys(value, [
		"v",
		"t",
		"sourceId",
		"generation",
		"sessionId",
		"requestId"
	], "Client Runtime cancellation");
	if (value.v !== 0 || value.t !== "client-runtime/cancel") throw new Error("inspector protocol: invalid Client Runtime cancellation envelope");
	return {
		v: 0,
		t: "client-runtime/cancel",
		sourceId: wireId(value.sourceId, "sourceId"),
		generation: wireId(value.generation, "generation"),
		sessionId: wireId(value.sessionId, "sessionId"),
		requestId: wireId(value.requestId, "requestId")
	};
}
/**
* Parse and rebuild one Worker acknowledgement for a Client Runtime response.
* @param value - Untrusted acknowledgement frame.
* @returns The validated acknowledgement frame.
*/
function parseClientRuntimeResponseAcknowledgedFrame(value) {
	exactKeys(value, [
		"v",
		"t",
		"sourceId",
		"generation",
		"sessionId",
		"requestId"
	], "Client Runtime response acknowledgement");
	if (value.v !== 0 || value.t !== "client-runtime/response-acknowledged") throw new Error("inspector protocol: invalid Client Runtime response acknowledgement envelope");
	return {
		v: 0,
		t: "client-runtime/response-acknowledged",
		sourceId: wireId(value.sourceId, "sourceId"),
		generation: wireId(value.generation, "generation"),
		sessionId: wireId(value.sessionId, "sessionId"),
		requestId: wireId(value.requestId, "requestId")
	};
}
/**
* Parse and rebuild one Runtime-session cleanup notification.
* @param value - Untrusted cleanup frame.
* @returns The validated cleanup frame.
*/
function parseClientRuntimeSessionClosedFrame(value) {
	exactKeys(value, [
		"v",
		"t",
		"sourceId",
		"generation",
		"sessionId"
	], "Client Runtime session close");
	if (value.v !== 0 || value.t !== "client-runtime/session-closed") throw new Error("inspector protocol: invalid Client Runtime session close envelope");
	return {
		v: 0,
		t: "client-runtime/session-closed",
		sourceId: wireId(value.sourceId, "sourceId"),
		generation: wireId(value.generation, "generation"),
		sessionId: wireId(value.sessionId, "sessionId")
	};
}
//#endregion
//#region lib/types/shared/bridge/messages/sources/codec.js
/** Exact decoders for Client source catalog operations and values. */
/**
* Parse one Worker-to-Client source command.
* @param value - Untrusted decoded command.
* @returns The validated command.
*/
function parseClientSourceCommand(value) {
	if (!isPlainObject(value) || typeof value.op !== "string") throw new Error("inspector protocol: Client source command must have an op");
	if (value.op === "list-scripts") {
		exactKeys(value, ["op"], "Client source list command");
		return { op: "list-scripts" };
	}
	if (value.op !== "get-content-chunk") throw new Error(`inspector protocol: unknown Client source command ${JSON.stringify(value.op)}`);
	exactKeys(value, [
		"op",
		"scriptKey",
		"content",
		"offset",
		"maxBytes"
	], "Client source chunk command");
	return {
		op: "get-content-chunk",
		scriptKey: wireId(value.scriptKey, "scriptKey"),
		content: contentKind(value.content),
		offset: natural$3(value.offset, "offset", true),
		maxBytes: natural$3(value.maxBytes, "maxBytes", false)
	};
}
function contentKind(value) {
	if (value !== "source" && value !== "source-map") throw new Error("inspector protocol: invalid Client source content kind");
	return value;
}
function natural$3(value, label, zero) {
	if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1)) throw new Error(`inspector protocol: ${label} must be ${zero ? "a non-negative" : "a positive"} integer`);
	return value;
}
//#endregion
//#region lib/types/shared/bridge/messages/sources/frames.js
/**
* Parse one Worker-to-Client source request.
* @param value - Untrusted decoded request.
* @returns The validated request frame.
*/
function parseClientSourceRequestFrame(value) {
	exactKeys(value, [
		"v",
		"t",
		"sourceId",
		"generation",
		"sessionId",
		"requestId",
		"command"
	], "Client source request");
	if (value.v !== 0 || value.t !== "client-sources/request") throw new Error("inspector protocol: invalid Client source request envelope");
	return {
		v: 0,
		t: "client-sources/request",
		sourceId: wireId(value.sourceId, "sourceId"),
		generation: wireId(value.generation, "generation"),
		sessionId: wireId(value.sessionId, "sessionId"),
		requestId: wireId(value.requestId, "requestId"),
		command: parseClientSourceCommand(value.command)
	};
}
/**
* Parse one Client source-session cleanup notification.
* @param value - Untrusted decoded notification.
* @returns The validated cleanup frame.
*/
function parseClientSourceSessionClosedFrame(value) {
	exactKeys(value, [
		"v",
		"t",
		"sourceId",
		"generation",
		"sessionId"
	], "Client source session close");
	if (value.v !== 0 || value.t !== "client-sources/session-closed") throw new Error("inspector protocol: invalid Client source session close envelope");
	return {
		v: 0,
		t: "client-sources/session-closed",
		sourceId: wireId(value.sourceId, "sourceId"),
		generation: wireId(value.generation, "generation"),
		sessionId: wireId(value.sessionId, "sessionId")
	};
}
//#endregion
//#region lib/types/shared/bridge/messages/observation.js
/** Versioned source lifecycle, observation, and extension frames shared by both carriers. */
/**
* Parse and rebuild one Worker control frame received by a source.
* @param value - Untrusted decoded wire value.
* @returns The validated Worker-to-source frame.
*/
function parseWorkerSourceFrame(value) {
	if (!isJsonValue(value) || !isPlainObject(value) || value.v !== 0 || typeof value.t !== "string") throw new Error("inspector protocol: invalid Worker source frame");
	if (value.t === "source/rejected") {
		exactKeys(value, [
			"v",
			"t",
			"code",
			"message"
		], "source/rejected frame");
		if (value.code !== "invalid-frame" && value.code !== "version-mismatch" && value.code !== "unauthorized" || typeof value.message !== "string") throw new Error("inspector protocol: invalid source/rejected frame");
		return {
			v: 0,
			t: "source/rejected",
			code: value.code,
			message: value.message
		};
	}
	if (value.t === "client-runtime/request") return parseClientRuntimeRequestFrame(value);
	if (value.t === "client-runtime/cancel") return parseClientRuntimeCancelFrame(value);
	if (value.t === "client-runtime/response-acknowledged") return parseClientRuntimeResponseAcknowledgedFrame(value);
	if (value.t === "client-runtime/session-closed") return parseClientRuntimeSessionClosedFrame(value);
	if (value.t === "client-sources/request") return parseClientSourceRequestFrame(value);
	if (value.t === "client-sources/session-closed") return parseClientSourceSessionClosedFrame(value);
	if (value.t === "client-console/enable" || value.t === "client-console/disable") return parseClientConsoleControlFrame(value);
	const common = {
		v: 0,
		sourceId: sourceId(value.sourceId),
		generation: generation(value.generation)
	};
	if (value.t === "source/accepted") {
		exactKeys(value, [
			"v",
			"t",
			"sourceId",
			"generation"
		], "source/accepted frame");
		return {
			...common,
			t: "source/accepted"
		};
	}
	if (value.t === "source/append-acknowledged") {
		exactKeys(value, [
			"v",
			"t",
			"sourceId",
			"generation",
			"nextSequence"
		], "source append acknowledgement");
		return {
			...common,
			t: "source/append-acknowledged",
			nextSequence: natural$2(value.nextSequence, "nextSequence")
		};
	}
	if (value.t === "source/resnapshot" && typeof value.reason === "string") {
		exactKeys(value, [
			"v",
			"t",
			"sourceId",
			"generation",
			"expectedSequence",
			"reason"
		], "source/resnapshot frame");
		return {
			...common,
			t: "source/resnapshot",
			expectedSequence: natural$2(value.expectedSequence, "expectedSequence"),
			reason: value.reason
		};
	}
	throw new Error(`inspector protocol: unknown Worker source frame ${JSON.stringify(value.t)}`);
}
function sourceId(value) {
	if (typeof value !== "string") throw new Error("inspector protocol: sourceId must be a string");
	return inspectorId(value, "sourceId");
}
function generation(value) {
	if (typeof value !== "string") throw new Error("inspector protocol: generation must be a string");
	return inspectorId(value, "generation");
}
function natural$2(value, label) {
	if (!Number.isSafeInteger(value) || value < 0) throw new Error(`inspector protocol: ${label} must be a non-negative safe integer`);
	return value;
}
//#endregion
//#region lib/types/shared/bridge/publisher.js
/** Source-side interfaces shared by MessagePort and WebSocket bridge implementations. */
/** Shared observation and query delegation inherited by both source transports. */
var InspectorSourceConnection = class {
	/** Publish one JSON observation without waiting on its carrier. */
	publish(topic, payload, monotonicMs = performance.now()) {
		this.publisher.publish(topic, payload, monotonicMs);
	}
	/** Retain and publish one state value for reconnect or replacement recovery. */
	setState(topic, payload, monotonicMs = performance.now()) {
		this.publisher.setState(topic, payload, monotonicMs);
	}
	/** Execute one non-CDP query through the active source generation. */
	request(query) {
		return this.queries.request(query);
	}
};
/**
* Reject a Client Console control frame that was routed to the Host source.
* @param operation - Misrouted Console frame type.
* @returns This function never returns.
*/
function rejectConsoleBridgeCommand(operation) {
	throw new Error(`inspector protocol: ${operation} cannot use the Host source bridge`);
}
//#endregion
//#region lib/types/host/cdp/stack.js
/** Host stack and call-frame data remain owned by the Worker-side Node inspector session. */
/** Stable explanation used for Host bridge rejections. */
const HOST_CDP_BRIDGE_REASON = "Host Runtime is attached directly from the Inspector Worker";
//#endregion
//#region lib/types/host/cdp/errors.js
/** Explicit failure for Client-style CDP bridge commands misrouted to the Host. */
/** Host Runtime uses the Worker-side Node inspector session instead of source RPC. */
var HostCdpBridgeUnavailableError = class extends Error {
	constructor(operation) {
		super(`inspector protocol: ${operation} cannot use the Host source bridge; ${HOST_CDP_BRIDGE_REASON}`);
	}
};
//#endregion
//#region lib/types/host/cdp/objects.js
/** Host RemoteObject handles never cross the Host source bridge. */
/**
* Reject an object operation that must use the Worker-owned native inspector session.
* @param operation - Misrouted object operation.
* @returns This function never returns.
*/
function rejectObjectBridgeOperation(operation) {
	throw new HostCdpBridgeUnavailableError(operation);
}
//#endregion
//#region lib/types/host/cdp/properties.js
/** Host property enumeration never crosses the Host source bridge. */
/**
* Reject a property request that must use the Worker-owned native inspector session.
* @returns This function never returns.
*/
function rejectPropertyBridgeOperation() {
	return rejectObjectBridgeOperation("client-runtime/get-properties");
}
/**
* Reject a Client Runtime command that was routed to the Host source.
* @param command - Misrouted Client Runtime operation.
* @returns This function never returns.
*/
function rejectRuntimeBridgeCommand(command) {
	switch (command.op) {
		case "get-properties": return rejectPropertyBridgeOperation();
		case "release-object":
		case "release-object-group": return rejectObjectBridgeOperation(`client-runtime/${command.op}`);
		case "evaluate":
		case "call-function":
		case "await-promise":
		case "global-lexical-scope-names": throw new HostCdpBridgeUnavailableError(`client-runtime/${command.op}`);
		default: return assertNever$1(command);
	}
}
function assertNever$1(value) {
	throw new Error(`Unexpected Host Runtime bridge command: ${JSON.stringify(value)}`);
}
/**
* Reject a Client Sources request that was routed to the Host source.
* @returns This function never returns.
*/
function rejectSourcesBridgeCommand() {
	throw new Error("inspector protocol: Client Sources cannot use the Host source bridge");
}
//#endregion
//#region lib/types/host/cdp/index.js
/** Source-side CDP capability declarations for the Host realm. */
const HOST_BRIDGE_CAPABILITIES = [
	void 0,
	void 0,
	void 0,
	void 0,
	void 0,
	void 0
].filter((capability) => capability !== void 0);
/**
* Collect Host source-bridge capabilities.
* @param _origin - Unused Host origin supplied for parity with the Client adapter.
* @param _hasSources - Unused source availability supplied for parity with the Client adapter.
* @returns No capabilities because the Worker attaches to Host V8 directly.
*/
function bridgeCapabilities(_origin, _hasSources) {
	return HOST_BRIDGE_CAPABILITIES;
}
//#endregion
//#region lib/types/host/inspection/realm.js
/** Stable descriptor for the Host observation source generation. */
/**
* Create the descriptor for one Host-to-Worker MessagePort generation.
* @param label - Human-readable Host execution-context label.
* @returns The complete Host source descriptor.
*/
function createHostRealmSource(label) {
	return {
		sourceId: inspectorId(`host-${randomUUID()}`, "sourceId"),
		generation: inspectorId(randomUUID(), "generation"),
		kind: "host",
		label,
		timeOriginMs: performance.timeOrigin,
		capabilities: bridgeCapabilities("", false)
	};
}
//#endregion
//#region lib/types/shared/bridge/buffer.js
/** Realm-neutral bounded buffering for Host and Client observation sources. */
const SOURCE_FRAME_OVERHEAD_BYTES = 4096;
/**
* Owns retained state, queued events, and source-local sequencing independently
* of whether frames travel over MessagePort or WebSocket.
*/
var InspectorSourceBuffer = class {
	options;
	queue = [];
	state = /* @__PURE__ */ new Map();
	queuedBytes = 0;
	nextSequence = 1;
	expectedSequence = 1;
	constructor(options) {
		this.options = options;
	}
	/** Whether at least one observation is waiting for transport. */
	get hasPending() {
		return this.queue.length > 0;
	}
	/**
	* Validate and enqueue one observation, dropping the oldest prefix as needed.
	* A record larger than one transport frame is dropped after consuming its sequence number.
	* @param topic - Declared domain topic.
	* @param payload - Lossless JSON payload.
	* @param monotonicMs - Finite source-clock timestamp.
	*/
	publish(topic, payload, monotonicMs) {
		this.enqueue(this.record(topic, payload, monotonicMs));
	}
	/**
	* Replace one retained topic and enqueue the same observation for live delivery.
	* @param topic - Declared state topic.
	* @param payload - Lossless JSON payload retained for replacement frames.
	* @param monotonicMs - Finite source-clock timestamp.
	*/
	setState(topic, payload, monotonicMs) {
		const record = this.record(topic, payload, monotonicMs);
		const previous = this.state.get(topic);
		this.state.set(topic, record);
		if (!this.stateFits()) {
			if (previous === void 0) this.state.delete(topic);
			else this.state.set(topic, previous);
			throw new Error("inspector: source state exceeds the source-frame byte limit");
		}
		this.enqueue(record);
	}
	/**
	* Build a complete state replacement and absorb every preceding queue drop.
	* @param sourceId - Logical source identity.
	* @param generation - Current transport generation.
	* @returns A replacement frame whose sequence is the next append position.
	*/
	replacement(sourceId, generation) {
		const nextSequence = this.queue[0]?.sequence ?? this.nextSequence;
		this.expectedSequence = nextSequence;
		return {
			v: 0,
			t: "source/replace",
			sourceId,
			generation,
			nextSequence,
			records: [...this.state.values()]
		};
	}
	/**
	* Remove and sequence the next transport-sized observation batch.
	* @param sourceId - Logical source identity.
	* @param generation - Current transport generation.
	* @returns The next append frame, or `undefined` when the queue is empty.
	*/
	takeBatch(sourceId, generation) {
		if (this.queue.length === 0) return void 0;
		const batch = [];
		let batchBytes = SOURCE_FRAME_OVERHEAD_BYTES;
		const first = this.queue[0];
		while (batch.length < this.options.maxRecordsPerFrame && this.queue.length > 0) {
			const candidate = this.queue[0];
			if (candidate.sequence !== first.sequence + batch.length) break;
			if (batch.length > 0 && batchBytes + candidate.bytes > this.options.maxFrameBytes) break;
			this.queue.shift();
			batch.push(candidate);
			batchBytes += candidate.bytes;
		}
		this.queuedBytes -= batch.reduce((sum, item) => sum + item.bytes, 0);
		const firstSequence = first.sequence;
		const frame = {
			v: 0,
			t: "source/append",
			sourceId,
			generation,
			firstSequence,
			droppedBefore: firstSequence - this.expectedSequence,
			records: batch.map((item) => item.record)
		};
		this.expectedSequence = firstSequence + frame.records.length;
		return frame;
	}
	/** Discard observations that have not entered a transport frame. */
	discardPending() {
		this.queue.length = 0;
		this.queuedBytes = 0;
	}
	record(topic, payload, monotonicMs) {
		if (topic.length === 0 || topic.length > 128) throw new Error("inspector: topic must contain 1 to 128 characters");
		if (!this.options.topics.includes("*") && !this.options.topics.includes(topic)) throw new Error(`inspector: source does not declare topic ${JSON.stringify(topic)}`);
		if (!isJsonValue(payload)) throw new Error("inspector: source payload must be lossless JSON data");
		if (!Number.isFinite(monotonicMs)) throw new Error("inspector: monotonicMs must be finite");
		return {
			monotonicMs,
			topic,
			payload
		};
	}
	enqueue(record) {
		const bytes = jsonByteLength(record);
		const sequence = this.nextSequence++;
		if (bytes + SOURCE_FRAME_OVERHEAD_BYTES > this.options.maxFrameBytes) return;
		this.queue.push({
			sequence,
			bytes,
			record
		});
		this.queuedBytes += bytes;
		while (this.queue.length > this.options.maxQueuedRecords || this.queuedBytes > this.options.maxQueuedBytes) {
			const dropped = this.queue.shift();
			this.queuedBytes -= dropped.bytes;
		}
	}
	stateFits() {
		return jsonByteLength([...this.state.values()]) + SOURCE_FRAME_OVERHEAD_BYTES <= this.options.maxFrameBytes;
	}
};
//#endregion

export {};
