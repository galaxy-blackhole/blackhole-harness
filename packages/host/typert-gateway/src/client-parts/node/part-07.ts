/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @deepseek-ai/dsh-api-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

//#region lib/types/client/index.js
/**
* Client projection of generated Typert Remote descriptors. Contributions
* install traced `remote.<namespace>` services; no JavaScript Proxy
* participates in method lookup, invocation, or type exposure.
*/
/** Required Client services: the Typert registry and the existing Connection carrier. */
const inject = ["typert", "connection"];
/**
* Install the typed Client Remote service.
* @param ctx - Client Cordis root.
*/
function apply(ctx) {
	new ClientRemoteService(ctx);
}
var ClientRemoteService = class extends Service {
	ownerCtx;
	connection;
	namespaces = /* @__PURE__ */ new Map();
	hostFacts;
	streams;
	events;
	mutations = Promise.resolve();
	constructor(ctx) {
		super(ctx, "remote");
		this.ownerCtx = ctx;
		const connection = ctx.get("connection");
		this.connection = connection;
		this.streams = new RemoteStreamMuxClient((path) => connection.openWebSocket(path), connection.interactions === "answer");
		if (connection.interactions === "answer") this.events = new ClientRemoteEvents(ctx, connection, (endpoint, payload, signal) => this.openRemoteStream(endpoint, payload, signal));
		if (connection.rpc.open === void 0) this.streams.start();
		let disposed = false;
		let loop;
		const start = () => {
			if (disposed || connection.interactions === "none") return;
			if (connection.rpc.open === void 0) this.streams.start();
			loop = connection.start({
				onConnected: () => {
					this.ownerCtx.emit("connection/reset");
				},
				onReconnectRequested: () => {
					if (connection.rpc.open === void 0) this.streams.reconnect();
				}
			});
		};
		const loader = ctx.get("loader");
		if (loader === void 0) start();
		else loader.await().then(start, () => {});
		ctx.effect(() => async () => {
			disposed = true;
			loop?.stop();
			await this.events?.dispose();
			await this.streams.close();
		}, "api-gateway.client.transport");
	}
	$stream(options) {
		if (this.connection.interactions === "none") throw new Error("client api: $stream requires interactions=answer; use a generated stream method");
		return new RemoteStream(this.connection, options);
	}
	get $host() {
		const home = this.connection.generation.getSnapshot()?.host.home;
		if (this.hostFacts === void 0 || this.hostFacts.home !== home) this.hostFacts = {
			home,
			isLoopback: this.connection.isLoopback
		};
		return this.hostFacts;
	}
	async $mount(contribution) {
		const callerCtx = this.ctx;
		const owned = callerCtx.effect(async () => {
			const dispose = await this.enqueue(() => this.mountContribution(callerCtx, contribution));
			return () => this.enqueue(dispose);
		}, `api-gateway.client.$mount(${JSON.stringify(contribution.package)})`);
		await owned;
		return async () => {
			await owned();
		};
	}
	$on(event, listener) {
		if (this.events === void 0) throw new Error("client api: forwarded events require interactions=answer");
		return this.events.subscribe(this.ctx, event, listener);
	}
	/** Open one Remote stream and normalize a worker-local carrier's structural failures. */
	openRemoteStream(endpoint, payload, signal, uplink, noConnection = `client api: ${endpoint} has no active Connection`) {
		const connection = this.ownerCtx.get("connection");
		if (connection === void 0) throw new Error(noConnection);
		const local = connection.rpc.open?.("/api", endpoint, payload, signal, uplink);
		return local === void 0 ? this.streams.open(endpoint, payload, signal, uplink) : normalizeConnectionStream(local);
	}
	enqueue(operation) {
		const result = this.mutations.then(operation, operation);
		this.mutations = result.then(() => void 0, () => void 0);
		return result;
	}
	async mountContribution(callerCtx, contribution) {
		this.validateContribution(contribution);
		const disposeRemote = callerCtx.typert.remotes.register(contribution);
		const groups = /* @__PURE__ */ new Map();
		for (const descriptor of contribution.descriptors) {
			const group = groups.get(descriptor.namespace);
			if (group === void 0) groups.set(descriptor.namespace, [descriptor]);
			else group.push(descriptor);
		}
		const installed = [];
		try {
			for (const [namespace, descriptors] of groups) installed.push(await this.installNamespace(namespace, descriptors));
		} catch (error) {
			for (const dispose of installed.reverse()) await dispose();
			await disposeRemote();
			throw error;
		}
		return async () => {
			for (const dispose of installed.reverse()) await dispose();
			await disposeRemote();
		};
	}
	validateContribution(contribution) {
		const direct = /* @__PURE__ */ new Map();
		const scoped = /* @__PURE__ */ new Map();
		const add = (table, descriptor, kind) => {
			const methods = table.get(descriptor.namespace) ?? /* @__PURE__ */ new Set();
			if (methods.has(descriptor.method)) throw new Error(`client api: contribution repeats ${kind} method ${endpointOf(descriptor)}`);
			methods.add(descriptor.method);
			table.set(descriptor.namespace, methods);
			if ((this.namespaces.get(descriptor.namespace)?.service)?.has(kind, descriptor.method) === true) throw new Error(`client api: ${kind} method ${endpointOf(descriptor)} is already mounted`);
		};
		for (const descriptor of contribution.descriptors) {
			requireStrictInputs(descriptor);
			if (descriptor.invocation.kind === "direct") add(direct, descriptor, "direct");
			if (scopedProjection(descriptor) !== void 0) add(scoped, descriptor, "scoped");
		}
		const namespaces = new Set([...direct.keys(), ...scoped.keys()]);
		for (const namespace of namespaces) {
			const service = this.namespaces.get(namespace)?.service;
			if (service === void 0) {
				if (namespace in this) throw new Error(`client api: namespace ${JSON.stringify(namespace)} conflicts with the Remote service`);
				const serviceKey = remoteServiceKey(namespace);
				if (this.ownerCtx.reflect.props[serviceKey]?.type === "accessor" || this.ownerCtx.get(serviceKey) !== void 0) throw new Error(`client api: namespace ${JSON.stringify(namespace)} conflicts with an existing Remote namespace`);
			}
			for (const method of new Set([...direct.get(namespace) ?? [], ...scoped.get(namespace) ?? []])) if (service === void 0) RemoteNamespaceService.assertMethodAvailable(namespace, method);
			else service.assertMethodAvailable(method);
		}
	}
	/**
	* Mount one namespace's descriptor group with no visibility gap: a fresh
	* namespace installs its whole group synchronously inside its fiber's
	* apply, so a plugin parked on the namespace service never observes it
	* without the methods the same contribution carries; an existing namespace
	* takes the group in one synchronous step.
	* @param name - Remote namespace.
	* @param descriptors - Every contribution descriptor naming that namespace.
	* @returns disposer unmounting the group and the namespace once empty.
	*/
	async installNamespace(name, descriptors) {
		let namespace = this.namespaces.get(name);
		let installed;
		if (namespace === void 0) ({namespace, installed} = await this.createNamespace(name, descriptors));
		else installed = installMethods(namespace.service, descriptors);
		const handle = namespace;
		return async () => {
			for (const method of [...installed].reverse()) {
				/* v8 ignore next -- Cordis effect disposers are idempotent and invoke this cleanup at most once. */
				if (!method.token.active) continue;
				method.token.active = false;
				method.token.abort.abort();
				if (method.scoped) handle.service.remove("scoped", method.descriptor.method, method.token);
				if (method.direct) handle.service.remove("direct", method.descriptor.method, method.token);
			}
			await this.disposeNamespace(name, handle);
		};
	}
	async createNamespace(name, descriptors) {
		let service;
		let installed;
		const fiber = this.ownerCtx.plugin({
			name: remoteServiceKey(name),
			apply: (ctx) => {
				service = new RemoteNamespaceService(ctx, name, (direct, scoped, caller, args) => this.invokeMethod(direct, scoped, caller, args));
				installed = installMethods(service, descriptors);
			}
		});
		try {
			await fiber;
		} catch (error) {
			await fiber.dispose();
			throw error;
		}
		/* v8 ignore next 3 -- a settled namespace fiber synchronously constructs its Service and installs the group. */
		if (service === void 0 || installed === void 0) throw new Error(`client api: namespace ${JSON.stringify(name)} did not start`);
		const namespace = {
			service,
			dispose: fiber.dispose
		};
		this.namespaces.set(name, namespace);
		return {
			namespace,
			installed
		};
	}
	async disposeNamespace(name, namespace) {
		if (!namespace.service.empty || this.namespaces.get(name) !== namespace) return;
		this.namespaces.delete(name);
		await namespace.dispose();
	}
	invokeMethod(direct, scoped, callerCtx, values) {
		if (scoped !== void 0) {
			const identity = this.ownerCtx.typert.contexts.getClient(scoped.projection.context)?.identity(callerCtx);
			if (identity !== void 0) return this.invokeSelected(scoped.descriptor, scoped.projection, scoped.token, callerCtx, values, { value: identity });
		}
		if (direct !== void 0) return this.invokeSelected(direct.descriptor, void 0, direct.token, callerCtx, values);
		if (scoped !== void 0) return this.invokeSelected(scoped.descriptor, scoped.projection, scoped.token, callerCtx, values);
		throw new Error("client api: Remote method is no longer mounted");
	}
	invokeSelected(descriptor, projection, token, callerCtx, values, boundIdentity) {
		if (descriptor.mode !== void 0) return this.invokeStream(descriptor, projection, token, callerCtx, values, boundIdentity);
		return this.invoke(descriptor, projection, token, callerCtx, values, boundIdentity);
	}
	async invoke(descriptor, projection, token, callerCtx, values, boundIdentity) {
		const endpoint = endpointOf(descriptor);
		if (!token.active) return withdrawn(endpoint);
		const prepared = this.prepareInvocation(descriptor, projection, token, callerCtx, values, boundIdentity);
		const connection = this.ownerCtx.get("connection");
		if (connection === void 0) throw new Error(`client api: ${endpoint} has no active Connection`);
		try {
			const result = await connection.rpc.call("/api", endpoint, { args: prepared.args }, prepared.signal);
			if (!mountActive(token)) return withdrawn(endpoint);
			prepared.signal.throwIfAborted();
			if (!result.ok) return {
				ok: false,
				error: rebuiltFailure(result.error)
			};
			return {
				ok: true,
				value: descriptor.result.mode === "strict" && descriptor.result.decode !== void 0 ? descriptor.result.decode(result.value) : result.value
			};
		} catch (error) {
			if (prepared.signal.aborted) return cancelledFailure(endpoint, error);
			return carrierFailure(endpoint, error);
		}
	}
	/** Open the logical stream now and hand back its handle; `send()` before the first read queues behind the `open` frame. */
	invokeStream(descriptor, projection, token, callerCtx, values, boundIdentity) {
		const endpoint = endpointOf(descriptor);
		if (!token.active) throw new Error(withdrawn(endpoint).error.message);
		const prepared = this.prepareInvocation(descriptor, projection, token, callerCtx, values, boundIdentity);
		const generation = new AbortController();
		const uplink = new ClientUplinkQueue(endpoint);
		return new ClientStreamHandle(endpoint, this.openRemoteStream(endpoint, { args: prepared.args }, AbortSignal.any([prepared.signal, generation.signal]), uplink), uplink, generation, token);
	}
	prepareInvocation(descriptor, projection, token, callerCtx, values, boundIdentity) {
		const endpoint = endpointOf(descriptor);
		const expected = descriptor.parameters.length - (projection?.parameterIndex === void 0 ? 0 : 1);
		const hasCallerSignal = descriptor.cancellation !== void 0 && values.length === expected + 1;
		if (values.length !== expected && !hasCallerSignal) {
			const contract = descriptor.cancellation === void 0 ? `${String(expected)} argument(s)` : `${String(expected)} business argument(s) plus an optional AbortSignal`;
			throw new Error(`client api: ${endpoint} expected ${contract}, got ${String(values.length)}`);
		}
		const args = Object.create(null);
		if (projection !== void 0) {
			const adapter = boundIdentity === void 0 ? this.ownerCtx.typert.contexts.getClient(projection.context) : void 0;
			if (boundIdentity === void 0 && adapter === void 0) throw new Error(`client api: ${endpoint} has no Client Context adapter for ${JSON.stringify(projection.context)}`);
			const identity = boundIdentity === void 0 ? adapter?.identity(callerCtx) : boundIdentity.value;
			if (identity === void 0) throw new Error(`client api: ${endpoint} requires a ${JSON.stringify(projection.context)} Context`);
			args[projection.wire] = identity;
		}
		let valueIndex = 0;
		descriptor.parameters.forEach((parameter, parameterIndex) => {
			if (parameterIndex === projection?.parameterIndex) return;
			const value = values[valueIndex];
			if (value !== void 0) args[parameter.wire] = value;
			valueIndex += 1;
		});
		const callerSignal = hasCallerSignal ? values[expected] : void 0;
		return {
			endpoint,
			args,
			signal: callerSignal === void 0 ? token.abort.signal : AbortSignal.any([token.abort.signal, callerSignal])
		};
	}
};
/**
* The handle a generated stream method returns: one generation of one logical
* stream. The downlink is iterated once; `send`/`end` feed the uplink queue the
* carrier pump drains; `dispose` aborts the generation and returns the carrier
* iterator, which sends `cancel` unless a terminal frame arrived, drops what was
* buffered, and ends the iteration quietly.
*/
var ClientStreamHandle = class {
	endpoint;
	uplink;
	generation;
	token;
	downlink;
	primed;
	consumed = false;
	disposed = false;
	constructor(endpoint, downlink, uplink, generation, token) {
		this.endpoint = endpoint;
		this.uplink = uplink;
		this.generation = generation;
		this.token = token;
		this.downlink = downlink[Symbol.asyncIterator]();
		this.primed = this.downlink.next();
		this.primed.catch(() => {
			this.uplink.close();
		});
	}
	send(item) {
		if (!isRemoteUplinkItem(item)) throw new Error(`client api: ${this.endpoint} uplink item is not a lossless JSON value`);
		this.uplink.push(item);
	}
	end() {
		this.uplink.end();
	}
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.uplink.close();
		this.generation.abort(/* @__PURE__ */ new Error(`client api: ${this.endpoint} stream disposed`));
		Promise.resolve(this.downlink.return?.()).catch(() => void 0);
	}
	[Symbol.asyncIterator]() {
		if (this.consumed) throw new Error(`client api: ${this.endpoint} stream has one consumer`);
		this.consumed = true;
		const iteration = this.iterate();
		return {
			next: () => iteration.next(),
			return: (value) => {
				this.dispose();
				return iteration.return(value);
			}
		};
	}
	async *iterate() {
		try {
			while (true) {
				const next = await (this.primed ?? this.downlink.next());
				this.primed = void 0;
				if (this.disposed || next.done === true) return;
				if (!mountActive(this.token)) throw new Error(withdrawn(this.endpoint).error.message);
				yield next.value;
			}
		} catch (error) {
			if (this.disposed) return;
			throw error;
		} finally {
			this.dispose();
			await this.downlink.return?.();
		}
	}
};
var RemoteNamespaceService = class RemoteNamespaceService extends Service {
	invokeRemote;
	methods = /* @__PURE__ */ new Map();
	namespace;
	static assertMethodAvailable(namespace, method) {
		if (REMOTE_NAMESPACE_FIELDS.has(method) || method in RemoteNamespaceService.prototype) throw new Error(`client api: method ${JSON.stringify(`${namespace}/${method}`)} conflicts with its namespace service`);
	}
	constructor(ctx, name, invokeRemote) {
		super(ctx, remoteServiceKey(name));
		this.invokeRemote = invokeRemote;
		this.namespace = name;
	}
	assertMethodAvailable(method) {
		RemoteNamespaceService.assertMethodAvailable(this.namespace, method);
		if (method in this && !this.methods.has(method)) throw new Error(`client api: method ${JSON.stringify(`${this.namespace}/${method}`)} conflicts with its namespace service`);
	}
	get empty() {
		return this.methods.size === 0;
	}
	has(kind, method) {
		return this.methods.get(method)?.[kind] !== void 0;
	}
	installDirect(descriptor, token) {
		this.install(descriptor.method, "direct", {
			descriptor,
			token
		});
	}
	installScoped(descriptor, projection, token) {
		this.install(descriptor.method, "scoped", {
			descriptor,
			projection,
			token
		});
	}
	install(method, kind, value) {
		this.assertMethodAvailable(method);
		let record = this.methods.get(method);
		const fresh = record === void 0;
		record ??= {};
		if (fresh) {
			Object.defineProperty(this, method, {
				configurable: true,
				enumerable: true,
				get: function() {
					const callerCtx = this.ctx;
					const current = this.methods.get(method);
					const direct = current?.direct;
					const scoped = current?.scoped;
					return (...args) => {
						return this.invokeRemote(direct, scoped, callerCtx, args);
					};
				}
			});
			this.methods.set(method, record);
		}
		if (kind === "direct") record.direct = value;
		else record.scoped = value;
	}
	remove(kind, method, token) {
		const record = this.methods.get(method);
		const current = record?.[kind];
		/* v8 ignore next -- duplicate live variants are rejected before installation, so no newer token can replace this one. */
		if (record === void 0 || current?.token !== token) return;
		if (kind === "direct") delete record.direct;
		else delete record.scoped;
		if (record.direct !== void 0 || record.scoped !== void 0) return;
		this.methods.delete(method);
		Reflect.deleteProperty(this, method);
	}
};
/**
* Install one descriptor group on a namespace service, unwinding the partial
* group when a descriptor is refused.
* @param service - Namespace service taking the methods.
* @param descriptors - Descriptor group of one contribution.
* @returns per-descriptor records for the group disposer.
*/
function installMethods(service, descriptors) {
	const installed = [];
	try {
		for (const descriptor of descriptors) {
			const method = {
				descriptor,
				token: {
					active: true,
					abort: new AbortController()
				},
				direct: false,
				scoped: false
			};
			installed.push(method);
			if (descriptor.invocation.kind === "direct") {
				service.installDirect(descriptor, method.token);
				method.direct = true;
			}
			const projection = scopedProjection(descriptor);
			if (projection !== void 0) {
				service.installScoped(descriptor, projection, method.token);
				method.scoped = true;
			}
		}
	} catch (error) {
		for (const method of [...installed].reverse()) {
			method.token.active = false;
			method.token.abort.abort();
			if (method.scoped) service.remove("scoped", method.descriptor.method, method.token);
			if (method.direct) service.remove("direct", method.descriptor.method, method.token);
		}
		throw error;
	}
	return installed;
}
const REMOTE_NAMESPACE_FIELDS = new Set([
	"ctx",
	"empty",
	"invokeRemote",
	"methods",
	"name",
	"namespace"
]);
function remoteServiceKey(namespace) {
	return `remote.${namespace}`;
}
function endpointOf(descriptor) {
	return `${descriptor.namespace}/${descriptor.method}`;
}
function mountActive(token) {
	return token.active;
}
function scopedProjection(descriptor) {
	if (descriptor.invocation.kind === "context") return {
		context: descriptor.invocation.context,
		wire: descriptor.invocation.wire
	};
	if (descriptor.scope === void 0) return void 0;
	const lookupParameters = descriptor.parameters.map((parameter, index) => ({
		parameter,
		index
	})).filter((candidate) => candidate.parameter.source === "lookup");
	const selected = lookupParameters.length === 1 ? lookupParameters[0] : void 0;
	if (selected === void 0 || selected.parameter.wire !== descriptor.scope.wire || selected.parameter.lookup !== descriptor.scope.context) throw new Error(`client api: generated Remote ${endpointOf(descriptor)} scope must select its only lookup parameter`);
	return {
		context: descriptor.scope.context,
		wire: descriptor.scope.wire,
		parameterIndex: selected.index
	};
}
function requireStrictInputs(descriptor) {
	const endpoint = endpointOf(descriptor);
	for (const parameter of descriptor.parameters) requireStrictCodec(parameter.codec, endpoint, parameter.wire);
	if (descriptor.uplink !== void 0) requireStrictCodec(descriptor.uplink.codec, endpoint, "uplink");
	if (descriptor.invocation.kind === "context") requireStrictCodec(descriptor.invocation.codec, endpoint, descriptor.invocation.wire);
}
function requireStrictCodec(codec, endpoint, field) {
	if (codec.mode !== "strict") throw new Error(`client api: generated Remote ${endpoint} field ${JSON.stringify(field)} has no strict codec`);
}
/** The namespace retired before or during the call, so no request outcome exists. */
function withdrawn(endpoint) {
	return internalFailure(`client api: Remote method ${endpoint} is no longer mounted`);
}
/**
* The error branch a carrier throw (offline, transport fault) folds into: `gateway/internal` naming the endpoint and
* the thrown message. Exported so a stand-in for this face folds identically.
* @param endpoint - `<namespace>/<method>` that was called.
* @param error - what the carrier threw.
* @returns the failed result.
*/
function carrierFailure(endpoint, error) {
	return internalFailure(`client api: ${endpoint} failed: ${error instanceof Error ? error.message : String(error)}`);
}
/**
* The error branch a call aborted by its caller folds into: `gateway/cancelled` with the carrier's throw as `cause`.
* @param endpoint - `<namespace>/<method>` that was called.
* @param cause - what the carrier threw when the signal aborted.
* @returns the failed result.
*/
function cancelledFailure(endpoint, cause) {
	return {
		ok: false,
		error: new RemoteError("gateway/cancelled", `client api: Remote invocation "${endpoint}" was aborted`, {}, { cause })
	};
}
function internalFailure(message) {
	return {
		ok: false,
		error: new RemoteError("gateway/internal", message, {})
	};
}
/**
* Whether a caught value is a Remote failure this face delivered or threw.
* The one consumer-facing discrimination point: marked instances carry their
* Host code; anything else is a local fault the caller should let crash.
* @param error - a caught value.
* @returns true when the value narrows to RemoteFailure.
*/
function isRemoteFailure(error) {
	return remoteErrorOf(error) !== void 0;
}
/**
* Rebuild the wire failure as a local RemoteError instance so the error branch
* carries a real Error and `throw result.error` keeps throw semantics. The code
* is passed through verbatim without runtime validation: a code outside this
* Client's merged map still surfaces as-is, so a newer Host stays readable.
*/
function rebuiltFailure(error) {
	return new RemoteError(error.code, error.message, error.details);
}
/** Preserve Gateway error classes across a worker transport's separately bundled page half. */
async function* normalizeConnectionStream(source) {
	try {
		yield* source;
	} catch (error) {
		if (!(error instanceof Error)) throw error;
		const marker = error.dshRemoteStreamFailure;
		if (marker?.kind === "remote") throw new RemoteError(marker.code, error.message, marker.details);
		if (marker?.kind === "carrier") throw new RemoteStreamCarrierError(error.message, { cause: error });
		throw error;
	}
}
//#endregion

export {};
