/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-gateway — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

// __DSH_FRAGMENT_BEGIN__
function __gbh_fragment__() {
/** Pull-driven queue owned by one connected Client event generation. */
var RemoteEventQueue = class {
	frames = new Deque();
	waiter;
	closed = false;
	push(frame) {
		if (this.closed) return;
		this.frames.pushBack(frame);
		this.waiter?.();
	}
	end() {
		if (this.closed) return;
		this.closed = true;
		this.waiter?.();
	}
	/**
	* Yield buffered and later frames until the queue ends or `signal` aborts.
	* An abort discards the frames still buffered, so a revoked Peer receives none of them.
	* @param signal - Client generation lifetime.
	* @returns the queued wire frames in push order.
	*/
	async *iterate(signal) {
		const abort = () => {
			this.end();
		};
		signal.addEventListener("abort", abort, { once: true });
		try {
			while (true) {
				while (this.frames.size > 0 && !signal.aborted) yield this.frames.popFront();
				if (this.closed || signal.aborted) return;
				await new Promise((resolve) => {
					this.waiter = resolve;
				});
				this.waiter = void 0;
			}
		} finally {
			signal.removeEventListener("abort", abort);
		}
	}
};
function assertRemoteEventFrame(frame) {
	assertRemoteEventName(frame);
	if (!Array.isArray(frame.args) || !isRemoteJsonValue(frame.args)) throw new TypeError(`typert gateway: Remote event ${JSON.stringify(frame.event)} arguments are not lossless JSON data`);
}
function assertRemoteEventName(frame) {
	if (typeof frame.event !== "string" || frame.event.length === 0) throw new TypeError("typert gateway: Remote event name must be a nonempty string");
}
function requireInteractions(peer, endpoint) {
	if (peer.interactions !== "answer") throw new TypertGatewayError("gateway/interactions-forbidden", endpoint, "forwarded Remote events require interactions=answer");
}
function parseRemoteEventResultPayload(payload) {
	if (!isObject(payload) || !isPlainObject(payload) || Reflect.ownKeys(payload).length !== 1 || !Object.hasOwn(payload, "args")) throw new Error("typert gateway: Remote event result requires exactly one plain-object args field");
	return parseRemoteEventResult(payload.args);
}
function remoteRequest(endpoint, payload, signal, peer) {
	assertPeerLive(peer, endpoint);
	const segments = endpoint.split("/");
	if (segments.length !== 2 || segments[0] === "" || segments[1] === "") throw new Error(`invalid Remote endpoint ${JSON.stringify(endpoint)}`);
	const [namespace, method] = segments;
	if (!isObject(payload) || !isPlainObject(payload) || Reflect.ownKeys(payload).length !== 1 || !Object.hasOwn(payload, "args") || !isObject(payload.args) || !isPlainObject(payload.args)) throw new Error("Remote payload must contain exactly one plain-object args field");
	return {
		namespace,
		method,
		args: payload.args,
		signal,
		peer
	};
}
/**
* The signal a method observes. A carrier that supplies an uplink fails the
* stream through `control` when an item is rejected, so that invocation joins
* `control` with the carrier signal; a stream also ends with its Peer. Every
* other invocation keeps the carrier signal's identity.
*/
function methodSignal(request, control, stream) {
	const carrier = request.signal;
	if (request.uplink === void 0 && !stream) return carrier ?? NEVER_ABORTED_SIGNAL;
	const joined = carrier === void 0 || carrier === control.signal ? [control.signal] : [carrier, control.signal];
	return AbortSignal.any(stream ? [...joined, request.peer.signal] : joined);
}
/**
* Refuse a call whose Peer has been disposed.
* @param peer - Peer the call speaks for.
* @param endpoint - endpoint named in the failure.
* @throws {@link TypertGatewayError} `gateway/peer-disposed` once the Peer is disposed.
*/
function assertPeerLive(peer, endpoint) {
	if (peer.signal.aborted) throw new TypertGatewayError("gateway/peer-disposed", endpoint, "the calling Peer has been disposed");
}
function isIterable(value) {
	return isObject(value) && (typeof Reflect.get(value, Symbol.iterator) === "function" || typeof Reflect.get(value, Symbol.asyncIterator) === "function");
}
async function* cancellableStream(source, endpoint, invocation) {
	const { signal } = invocation;
	const asyncFactory = Reflect.get(source, Symbol.asyncIterator);
	const syncFactory = Reflect.get(source, Symbol.iterator);
	const iterator = typeof asyncFactory === "function" ? Reflect.apply(asyncFactory, source, []) : Reflect.apply(syncFactory, source, []);
	let rejectAbort;
	const onAbort = () => {
		rejectAbort?.(streamAbortFailure(endpoint, signal.reason));
	};
	signal.addEventListener("abort", onAbort, { once: true });
	try {
		while (true) {
			if (signal.aborted) throw streamAbortFailure(endpoint, signal.reason);
			const aborted = new Promise((_resolve, reject) => {
				rejectAbort = reject;
			});
			aborted.catch(() => void 0);
			const next = await Promise.race([Promise.resolve(iterator.next()), aborted]);
			rejectAbort = void 0;
			if (next.done === true) return;
			yield next.value;
		}
	} finally {
		rejectAbort = void 0;
		signal.removeEventListener("abort", onAbort);
		await invocation.close();
		await iterator.return?.();
	}
}
/**
* The failure a stream surfaces for its abort: a Remote failure used as the
* reason is the Gateway or carrier failing the stream itself (a rejected,
* overflowing, or misplaced uplink item); any other abort is a cancellation.
*/
function streamAbortFailure(endpoint, reason) {
	return remoteErrorOf(reason) === void 0 ? remoteCancelled(endpoint, reason) : reason;
}
/** Carrier-signal cancellation as the shared failure vocabulary expresses it. */
function remoteCancelled(endpoint, cause) {
	return new RemoteError("gateway/cancelled", `Remote invocation "${endpoint}" was aborted`, {}, { cause });
}
/**
* The iterable `invocation.uplink()` returns. Each uplink item passes the
* descriptor codec, or the JSON-safety check when the descriptor declares no
* uplink, before delivery; a rejected item fails the whole logical stream.
* Iteration ends when the Client half-closes or the downlink finishes, and
* fails when the stream is cancelled, so a method blocked on the uplink always
* wakes.
*/
var UplinkDecoder = class {
	codec;
	endpoint;
	signal;
	abort;
	source;
	interrupted = /* @__PURE__ */ new Set();
	onAbort = () => {
		const failure = streamAbortFailure(this.endpoint, this.signal.reason);
		for (const read of this.interrupted) read.reject(failure);
	};
	closed = false;
	constructor(uplink, codec, endpoint, signal, abort) {
		this.codec = codec;
		this.endpoint = endpoint;
		this.signal = signal;
		this.abort = abort;
		this.source = uplink[Symbol.asyncIterator]();
		signal.addEventListener("abort", this.onAbort, { once: true });
	}
	[Symbol.asyncIterator]() {
		return this;
	}
	async next() {
		if (this.signal.aborted) throw streamAbortFailure(this.endpoint, this.signal.reason);
		if (this.closed) return UPLINK_DONE;
		const interrupted = Promise.withResolvers();
		this.interrupted.add(interrupted);
		interrupted.promise.catch(() => void 0);
		let next;
		try {
			next = await Promise.race([this.source.next(), interrupted.promise]);
		} finally {
			this.interrupted.delete(interrupted);
		}
		if (next.done === true) {
			this.finish();
			return UPLINK_DONE;
		}
		let value;
		try {
			value = next.value === void 0 && this.codec.mode === "src-json" ? void 0 : decode(this.codec, next.value, this.endpoint, "uplink");
		} catch (failure) {
			this.abort(failure);
			throw failure;
		}
		return {
			value,
			done: false
		};
	}
	/** Downlink finished or the method stopped reading: unread uplink items are dropped. */
	return() {
		if (!this.closed) {
			this.finish();
			Promise.resolve().then(() => this.source.return?.()).catch(() => void 0);
		}
		return Promise.resolve(UPLINK_DONE);
	}
	finish() {
		this.closed = true;
		this.signal.removeEventListener("abort", this.onAbort);
		for (const read of this.interrupted) read.resolve(UPLINK_DONE);
	}
};
/**
* The context of one Remote call as the receiving method reads it through
* `this.ctx.invocation`. The uplink is decoded on first use and released when
* the call's downlink finishes.
*/
var GatewayInvocation = class {
	request;
	service;
	peer;
	signal;
	uplink_;
	decoder;
	taken = false;
	get uplinkWindow() {
		return this.uplink_.window;
	}
	/**
	* @param request - decoded endpoint and wire arguments.
	* @param service - Cordis service key of the receiver.
	* @param peer - Peer the call speaks for.
	* @param signal - the signal the method observes.
	* @param uplink - carrier items and the codec that decodes them.
	*/
	constructor(request, service, peer, signal, uplink_) {
		this.request = request;
		this.service = service;
		this.peer = peer;
		this.signal = signal;
		this.uplink_ = uplink_;
	}
	uplink() {
		if (this.taken) throw new Error(`typert gateway: ${this.uplink_.endpoint}: invocation.uplink() is available once per call`);
		this.taken = true;
		const { source, codec, endpoint, abort } = this.uplink_;
		this.decoder = new UplinkDecoder(source, codec, endpoint, this.signal, abort);
		return this.decoder;
	}
	/**
	* The downlink finished: release the uplink. Unread items are dropped, and a
	* carrier iterable the method never took is returned so it stops producing;
	* a later `uplink()` throws like a second one would.
	* @returns settles once a taken uplink has closed.
	*/
	async close() {
		if (this.decoder !== void 0) {
			await this.decoder.return();
			return;
		}
		this.taken = true;
		releaseUplink(this.uplink_.source);
	}
};
/**
* Return a carrier uplink nobody will read, so it drops later items instead of
* buffering them. The carrier owns the iterator and `return()` is not awaited:
* a generator blocked in `next()` completes it only once it yields.
* @param source - the carrier's uplink iterable.
*/
function releaseUplink(source) {
	Promise.resolve().then(() => source[Symbol.asyncIterator]().return?.()).catch(() => void 0);
}
function rpcFailure(error) {
	const remote = remoteErrorOf(error);
	if (remote !== void 0) return {
		ok: false,
		error: {
			code: remote.code,
			message: remote.message,
			details: remote.details
		}
	};
	return {
		ok: false,
		error: {
			code: "gateway/internal",
			message: error instanceof Error ? error.message : String(error),
			details: {}
		}
	};
}
function rpcError(error) {
	return rpcFailure(error).error;
}
function endpointOf(namespace, method) {
	return `${namespace}/${method}`;
}
function validateBinding(receiver, serviceKey, namespace, endpoint) {
	const original = originalOf(receiver);
	const value = Reflect.get(original, "typertRemote");
	if (value === void 0) throw new TypertGatewayError("gateway/binding-invalid", endpoint, `Service ${JSON.stringify(serviceKey)} has no visible typertRemote binding`);
	return {
		binding: readBinding(value, original, serviceKey, endpoint, namespace),
		original
	};
}
function readBinding(value, original, serviceKey, endpoint, namespace) {
	if (!isObject(value) || Reflect.get(value, "service") !== original || Reflect.get(value, "serviceKey") !== serviceKey || typeof Reflect.get(value, "namespace") !== "string" || namespace !== void 0 && Reflect.get(value, "namespace") !== namespace) throw new TypertGatewayError("gateway/binding-invalid", endpoint, `Service ${JSON.stringify(serviceKey)} has an inconsistent typertRemote binding`);
	return value;
}
function originalOf(receiver) {
	const original = Reflect.get(receiver, symbols.original);
	return isObject(original) ? original : receiver;
}
function methodParameterNames(service, method, endpoint) {
	let prototype = Object.getPrototypeOf(service);
	let implementation;
	while (prototype !== null) {
		const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
		if (descriptor !== void 0) {
			if ("value" in descriptor && typeof descriptor.value === "function") implementation = descriptor.value;
			break;
		}
		prototype = Object.getPrototypeOf(prototype);
	}
	if (implementation === void 0) throw new TypertGatewayError("gateway/method-unavailable", endpoint, `Remote marker has no prototype method ${JSON.stringify(method)}`);
	const source = Function.prototype.toString.call(implementation);
	const open = source.indexOf("(");
	const close = source.indexOf(")", open + 1);
	/* v8 ignore next -- standard public class-method syntax always contains a parenthesized parameter list. */
	if (open < 0 || close < 0) return invalidSignature(endpoint, method);
	const body = source.slice(open + 1, close).trim();
	if (body.length === 0) return [];
	const parts = body.split(",").map((part) => part.trim());
	const names = /* @__PURE__ */ new Set();
	for (const part of parts) {
		if (!/^[$A-Z_a-z][$\w]*$/u.test(part) || names.has(part)) return invalidSignature(endpoint, method);
		names.add(part);
	}
	return [...names];
}
function invalidSignature(endpoint, method) {
	throw new TypertGatewayError("gateway/signature-invalid", endpoint, `SRC method ${JSON.stringify(method)} must use unique identifier parameters without destructuring, defaults, or rest`);
}
function assertExactArguments(args, descriptor, endpoint) {
	if (!isPlainObject(args)) throw new TypertGatewayError("gateway/arguments-invalid", endpoint, "args must be a plain object");
	const expected = new Set(descriptor.parameters.map((parameter) => parameter.wire));
	if (descriptor.invocation.kind === "context") expected.add(descriptor.invocation.wire);
	const extra = Reflect.ownKeys(args).filter((key) => typeof key !== "string" || !expected.has(key));
	const acceptsMissing = new Set(descriptor.parameters.filter((parameter) => parameter.source === "json" && (parameter.acceptsUndefined === true || parameter.codec.mode === "src-json")).map((parameter) => parameter.wire));
	const missing = [...expected].filter((key) => !Object.hasOwn(args, key) && !acceptsMissing.has(key));
	if (extra.length === 0 && missing.length === 0) return;
	const clauses = [];
	if (missing.length > 0) clauses.push(`missing ${missing.map((key) => JSON.stringify(key)).join(", ")}`);
	if (extra.length > 0) clauses.push(`unexpected ${extra.map((key) => JSON.stringify(String(key))).join(", ")}`);
	throw new TypertGatewayError("gateway/arguments-invalid", endpoint, `args fields do not match the descriptor: ${clauses.join("; ")}`);
}
/**
* Decode every present JSON argument once through its parameter codec; a
* Typert codec drops object fields its compiled type does not declare. Lookup
* and Context identities keep their wire values; dispatch decodes and resolves
* them only after the access check. An absent field stays absent; a present
* `undefined` is not JSON-safe and fails decoding.
*/
function validateArguments(descriptor, args, endpoint) {
	const entries = [];
	if (descriptor.invocation.kind === "context") entries.push([descriptor.invocation.wire, args[descriptor.invocation.wire]]);
	for (const parameter of descriptor.parameters) {
		if (!Object.hasOwn(args, parameter.wire)) continue;
		const value = args[parameter.wire];
		entries.push([parameter.wire, parameter.source === "json" ? decode(parameter.codec, value, endpoint, parameter.wire) : value]);
	}
	return Object.fromEntries(entries);
}
function decode(codec, value, endpoint, field) {
	try {
		if (codec.mode === "strict") {
			value = codec.create().parse(value);
			/* v8 ignore next -- generated optional-input codecs are the only strict codecs that return undefined. */
			if (value === void 0) return value;
		}
		assertJsonValue(value, /* @__PURE__ */ new Set());
		return value;
	} catch (cause) {
		throw new TypertGatewayError("gateway/input-invalid", endpoint, `wire field ${JSON.stringify(field)} failed boundary validation`, {
			cause,
			field
		});
	}
}
function assertJsonValue(value, ancestors) {
	if (value === null || typeof value === "string" || typeof value === "boolean") return;
	if (typeof value === "number") {
		if (Number.isFinite(value)) return;
		throw new TypeError("non-finite number is not JSON-safe");
	}
	if (!isObject(value)) throw new TypeError(`${typeof value} is not JSON-safe`);
	if (ancestors.has(value)) throw new TypeError("cyclic value is not JSON-safe");
	ancestors.add(value);
	try {
		if (Array.isArray(value)) {
			if (Object.getOwnPropertySymbols(value).length > 0 || Object.keys(value).length !== value.length) throw new TypeError("sparse or decorated array is not JSON-safe");
			for (let index = 0; index < value.length; index += 1) {
				if (!Object.hasOwn(value, index)) throw new TypeError("sparse array is not JSON-safe");
				assertJsonValue(value[index], ancestors);
			}
			return;
		}
		if (!isPlainObject(value)) throw new TypeError("non-plain object is not JSON-safe");
		if (Object.getOwnPropertySymbols(value).length > 0) throw new TypeError("symbol property is not JSON-safe");
		for (const key of Reflect.ownKeys(value)) {
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			/* v8 ignore next -- ownKeys() just returned this key; only a hostile same-process Proxy can delete it between operations. */
			if (descriptor === void 0 || !descriptor.enumerable || !("value" in descriptor)) throw new TypeError("non-data property is not JSON-safe");
			assertJsonValue(descriptor.value, ancestors);
		}
	} finally {
		ancestors.delete(value);
	}
}
function isPlainObject(value) {
	if (Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === null || prototype === Object.prototype;
}
function isObject(value) {
	return typeof value === "object" && value !== null || typeof value === "function";
}
//#endregion
}
// __DSH_FRAGMENT_END__

export {};
