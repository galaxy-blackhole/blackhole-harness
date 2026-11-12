/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN dòng 1–546 của stock lib/index.js (@deepseek-ai/dsh-experimental-inspector): 8 dòng import + 6 region đầu (inspection/network, identity, json, validation, console-frames, command-codec)
 */
// @ts-nocheck

import z from "@deepseek-ai/schemastery";
import { fileURLToPath } from "node:url";
import { connect } from "node:net";
import { randomBytes, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { MessageChannel, Worker } from "node:worker_threads";
import { Context } from "@deepseek-ai/cordis";
import { randomUUID as randomUUID$1 } from "@deepseek-ai/dsh-util-crypto";
//#endregion
//#region lib/types/host/inspection/network.js
/** Full `globalThis.fetch` capture that publishes without delaying response delivery. */
/** Observation topics published by the Host network adapter. */
const NETWORK_TOPICS = [
	"fetch/start",
	"fetch/request-body-chunk",
	"fetch/request-body-end",
	"fetch/response",
	"fetch/response-body-chunk",
	"fetch/end",
	"fetch/error"
];
/**
* Keeps each wrapper-created Request reachable while the caller's response body stream is reachable.
* Node's fetch forwards the caller's abort signal only while that Request is reachable. The capture
* clone shares one source with the caller's body stream and keeps that stream reachable while capture
* reads. Entries are set after `response.clone()`, which replaces `response.body`. The map is
* module-level so that responses obtained before `stop()` keep their Request reachable afterwards.
*/
const requestsByBody = /* @__PURE__ */ new WeakMap();
/**
* Install full fetch capture for every later call through `globalThis.fetch`.
* @param publisher - Host source that receives fetch lifecycle records.
* @param options - Per-body capture limits.
* @returns The owner that stops capture and awaits pending body readers.
*/
function installFetchObserver(publisher, options) {
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
	const original = globalThis.fetch;
	if (typeof original !== "function") throw new Error("inspector: globalThis.fetch is unavailable");
	if (descriptor !== void 0 && !("value" in descriptor)) throw new Error("inspector: globalThis.fetch is an accessor and cannot be observed safely");
	const controller = new AbortController();
	const pending = /* @__PURE__ */ new Set();
	let nextRequestId = 0;
	const track = (promise) => {
		pending.add(promise);
		promise.then(() => {
			pending.delete(promise);
		}, () => {
			pending.delete(promise);
		});
	};
	const observedFetch = async (input, init) => {
		const request = new Request(input, init);
		const requestId = `fetch-${++nextRequestId}`;
		publisher.publish("fetch/start", {
			requestId,
			url: request.url,
			method: request.method,
			headers: headerEntries(request.headers),
			hasBody: request.body !== null,
			wallTimeMs: Date.now()
		});
		let requestClone;
		try {
			requestClone = request.clone();
		} catch (error) {
			publisher.publish("fetch/request-body-end", {
				requestId,
				capturedBytes: 0,
				truncated: false,
				captureError: renderError$1(error)
			});
		}
		if (requestClone !== void 0) track(captureBody(requestClone.body, options.maxRequestBodyBytes, options.maxChunkBytes, controller.signal, (data) => {
			publisher.publish("fetch/request-body-chunk", {
				requestId,
				data
			});
		}).then((outcome) => {
			publisher.publish("fetch/request-body-end", compactOutcome(requestId, outcome));
		}));
		let response;
		try {
			response = await Reflect.apply(original, globalThis, [request]);
		} catch (error) {
			publisher.publish("fetch/error", {
				requestId,
				message: renderError$1(error),
				canceled: request.signal.aborted || isAbortError(error)
			});
			throw error;
		}
		publisher.publish("fetch/response", {
			requestId,
			url: response.url || request.url,
			status: response.status,
			statusText: response.statusText,
			headers: headerEntries(response.headers),
			mimeType: response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? ""
		});
		try {
			track(captureBody(response.clone().body, options.maxResponseBodyBytes, options.maxChunkBytes, controller.signal, (data) => {
				publisher.publish("fetch/response-body-chunk", {
					requestId,
					data
				});
			}).then((outcome) => {
				publisher.publish("fetch/end", {
					requestId,
					capturedBytes: outcome.capturedBytes,
					responseBodyTruncated: outcome.truncated,
					...outcome.captureError === void 0 ? {} : { responseCaptureError: outcome.captureError }
				});
			}));
		} catch (error) {
			publisher.publish("fetch/end", {
				requestId,
				capturedBytes: 0,
				responseBodyTruncated: false,
				responseCaptureError: renderError$1(error)
			});
		}
		if (response.body !== null) requestsByBody.set(response.body, request);
		return response;
	};
	Object.defineProperty(observedFetch, "name", {
		value: original.name,
		configurable: true
	});
	Object.defineProperty(observedFetch, "length", {
		value: original.length,
		configurable: true
	});
	Object.defineProperty(globalThis, "fetch", descriptor === void 0 ? {
		value: observedFetch,
		writable: true,
		configurable: true
	} : {
		...descriptor,
		value: observedFetch
	});
	let stopped;
	return { stop() {
		if (stopped !== void 0) return stopped;
		stopped = (async () => {
			const current = Object.getOwnPropertyDescriptor(globalThis, "fetch");
			if (current !== void 0 && "value" in current && current.value === observedFetch) if (descriptor === void 0) Reflect.deleteProperty(globalThis, "fetch");
			else Object.defineProperty(globalThis, "fetch", descriptor);
			controller.abort();
			await Promise.allSettled([...pending]);
		})();
		return stopped;
	} };
}
async function captureBody(body, limit, chunkLimit, signal, emit) {
	if (body === null) return {
		capturedBytes: 0,
		truncated: false
	};
	const reader = body.getReader();
	const abort = () => {
		reader.cancel(signal.reason).catch(() => void 0);
	};
	signal.addEventListener("abort", abort, { once: true });
	let capturedBytes = 0;
	let truncated = false;
	try {
		while (!signal.aborted) {
			const item = await reader.read();
			if (item.done) break;
			let offset = 0;
			while (offset < item.value.byteLength) {
				const remaining = limit - capturedBytes;
				if (remaining <= 0) {
					truncated = true;
					reader.cancel("inspector body capture limit reached").catch(() => void 0);
					return {
						capturedBytes,
						truncated
					};
				}
				const size = Math.min(chunkLimit, remaining, item.value.byteLength - offset);
				const chunk = item.value.subarray(offset, offset + size);
				emit(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).toString("base64"));
				capturedBytes += size;
				offset += size;
			}
		}
		if (signal.aborted) {
			reader.cancel(signal.reason).catch(() => void 0);
			return {
				capturedBytes,
				truncated,
				captureError: "inspector stopped during body capture"
			};
		}
		return {
			capturedBytes,
			truncated
		};
	} catch (error) {
		return {
			capturedBytes,
			truncated: true,
			captureError: renderError$1(error)
		};
	} finally {
		signal.removeEventListener("abort", abort);
		reader.releaseLock();
	}
}
function compactOutcome(requestId, outcome) {
	return {
		requestId,
		capturedBytes: outcome.capturedBytes,
		truncated: outcome.truncated,
		...outcome.captureError === void 0 ? {} : { captureError: outcome.captureError }
	};
}
function headerEntries(headers) {
	return [...headers.entries()];
}
function isAbortError(error) {
	return error instanceof DOMException && error.name === "AbortError";
}
function renderError$1(error) {
	if (error instanceof Error) return `${error.name}: ${error.message}`;
	try {
		return String(error);
	} catch {
		return "unrenderable fetch error";
	}
}
//#endregion
//#region lib/types/shared/identity.js
/** Shared branded-identifier construction without assigning protocol ownership. */
/**
* Validate and brand a non-empty identifier received from or sent across a runtime boundary.
* @param value - Untrusted identifier text.
* @param label - Field name used in validation errors.
* @returns The role-branded identifier.
*/
function inspectorId(value, label) {
	if (value.length === 0 || value.length > 256) throw new Error(`inspector protocol: ${label} must contain 1 to 256 characters`);
	return value;
}
//#endregion
//#region lib/types/shared/json.js
/** JSON values admitted by every Inspector cross-realm message. */
/**
* Test that a value can cross both MessagePort and JSON WebSocket carriers without coercion.
* @param value - Candidate wire value.
* @returns Whether the value is lossless JSON data.
*/
function isJsonValue(value) {
	return visitJson(value, /* @__PURE__ */ new Set());
}
/**
* Compute the UTF-8 byte length of a JSON wire value.
* @param value - Validated JSON value.
* @returns Its encoded byte length.
*/
function jsonByteLength(value) {
	return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
/**
* Test whether a value is a plain object with string own keys.
* @param value - Candidate object.
* @returns Whether the value has `Object.prototype` or a null prototype.
*/
function isPlainObject(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
function visitJson(value, ancestors) {
	if (value === null || typeof value === "string" || typeof value === "boolean") return true;
	if (typeof value === "number") return Number.isFinite(value) && !Object.is(value, -0);
	if (typeof value !== "object" || ancestors.has(value)) return false;
	ancestors.add(value);
	try {
		if (Array.isArray(value)) {
			if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) return false;
			return value.every((item) => visitJson(item, ancestors));
		}
		if (!isPlainObject(value)) return false;
		for (const key of Reflect.ownKeys(value)) {
			if (typeof key !== "string") return false;
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (descriptor?.enumerable !== true || !("value" in descriptor) || !visitJson(descriptor.value, ancestors)) return false;
		}
		return true;
	} finally {
		ancestors.delete(value);
	}
}
//#endregion
//#region lib/types/shared/validation.js
/** Shared exact-object readers for versioned Inspector wire protocols. */
/**
* Require a plain object containing only the listed fields.
* @param value - Candidate object.
* @param keys - Complete field allowlist.
* @param label - Object name used in validation errors.
* @returns The validated plain object.
*/
function exactObject(value, keys, label) {
	if (!isPlainObject(value)) throw new Error(`inspector protocol: ${label} must be an object`);
	exactKeys(value, keys, label);
	return value;
}
/**
* Reject fields outside one versioned object's declared field set.
* @param value - Plain object being validated.
* @param keys - Complete field allowlist.
* @param label - Object name used in validation errors.
*/
function exactKeys(value, keys, label) {
	const allowed = new Set(keys);
	for (const key of Reflect.ownKeys(value)) if (typeof key !== "string" || !allowed.has(key)) throw new Error(`inspector protocol: ${label} has unknown field ${JSON.stringify(String(key))}`);
}
/**
* Read one non-empty opaque identifier.
* @param value - Candidate identifier.
* @param label - Field name used in validation errors.
* @returns The role-branded identifier.
*/
function wireId(value, label) {
	if (typeof value !== "string") throw new Error(`inspector protocol: ${label} must be a string`);
	return inspectorId(value, label);
}
/**
* Read one optional string field.
* @param value - Object containing the field.
* @param key - Field name.
* @returns An empty object or the validated field.
*/
function optionalString(value, key) {
	const item = value[key];
	if (item === void 0) return {};
	if (typeof item !== "string") throw new Error(`inspector protocol: ${key} must be a string`);
	return { [key]: item };
}
/**
* Read one optional boolean field.
* @param value - Object containing the field.
* @param key - Field name.
* @returns An empty object or the validated field.
*/
function optionalBoolean(value, key) {
	const item = value[key];
	if (item === void 0) return {};
	if (typeof item !== "boolean") throw new Error(`inspector protocol: ${key} must be a boolean`);
	return { [key]: item };
}
/**
* Read one optional non-negative finite number field.
* @param value - Object containing the field.
* @param key - Field name.
* @returns An empty object or the validated field.
*/
function optionalNonNegativeNumber(value, key) {
	const item = value[key];
	if (item === void 0) return {};
	if (typeof item !== "number" || !Number.isFinite(item) || item < 0) throw new Error(`inspector protocol: ${key} must be a non-negative finite number`);
	return { [key]: item };
}
//#endregion
//#region lib/types/shared/bridge/messages/runtime/console-frames.js
/**
* Parse a Worker-to-Client Console lifecycle frame.
* @param value - Untrusted decoded frame.
* @returns A validated enable or disable frame.
*/
function parseClientConsoleControlFrame(value) {
	exactKeys(value, [
		"v",
		"t",
		"sourceId",
		"generation",
		"sessionId"
	], "Client Console control frame");
	if (value.v !== 0 || value.t !== "client-console/enable" && value.t !== "client-console/disable") throw new Error("inspector protocol: invalid Client Console control frame");
	return {
		v: 0,
		t: value.t,
		sourceId: wireId(value.sourceId, "sourceId"),
		generation: wireId(value.generation, "generation"),
		sessionId: wireId(value.sessionId, "sessionId")
	};
}
//#endregion
//#region lib/types/shared/bridge/messages/runtime/command-codec.js
/** Exact wire decoder for Client Runtime commands. */
/**
* Parse and rebuild one Runtime command before it enters the Client realm.
* @param value - Untrusted command value.
* @returns The validated command union member.
*/
function parseClientRuntimeCommand(value) {
	if (!isPlainObject(value) || typeof value.op !== "string") throw new Error("inspector protocol: Client Runtime command must have an op");
	switch (value.op) {
		case "evaluate":
			exactKeys(value, [
				"op",
				"expression",
				"objectGroup",
				"includeCommandLineAPI",
				"silent",
				"returnByValue",
				"generatePreview",
				"userGesture",
				"awaitPromise",
				"disableBreaks",
				"replMode",
				"allowUnsafeEvalBlockedByCSP",
				"timeoutMs"
			], "evaluate command");
			if (typeof value.expression !== "string") throw new Error("inspector protocol: evaluate expression must be a string");
			return {
				op: "evaluate",
				expression: value.expression,
				...optionalString(value, "objectGroup"),
				...optionalBoolean(value, "includeCommandLineAPI"),
				...optionalBoolean(value, "silent"),
				...optionalBoolean(value, "returnByValue"),
				...optionalBoolean(value, "generatePreview"),
				...optionalBoolean(value, "userGesture"),
				...optionalBoolean(value, "awaitPromise"),
				...optionalBoolean(value, "disableBreaks"),
				...optionalBoolean(value, "replMode"),
				...optionalBoolean(value, "allowUnsafeEvalBlockedByCSP"),
				...optionalNonNegativeNumber(value, "timeoutMs")
			};
		case "get-properties":
			exactKeys(value, [
				"op",
				"handle",
				"ownProperties",
				"accessorPropertiesOnly",
				"generatePreview",
				"nonIndexedPropertiesOnly"
			], "get-properties command");
			return {
				op: "get-properties",
				handle: wireId(value.handle, "handle"),
				...optionalBoolean(value, "ownProperties"),
				...optionalBoolean(value, "accessorPropertiesOnly"),
				...optionalBoolean(value, "generatePreview"),
				...optionalBoolean(value, "nonIndexedPropertiesOnly")
			};
		case "call-function": return parseCallFunction(value);
		case "await-promise":
			exactKeys(value, [
				"op",
				"promise",
				"returnByValue",
				"generatePreview"
			], "await-promise command");
			return {
				op: "await-promise",
				promise: wireId(value.promise, "promise"),
				...optionalBoolean(value, "returnByValue"),
				...optionalBoolean(value, "generatePreview")
			};
		case "release-object":
			exactKeys(value, ["op", "handle"], "release-object command");
			return {
				op: "release-object",
				handle: wireId(value.handle, "handle")
			};
		case "release-object-group":
			exactKeys(value, ["op", "objectGroup"], "release-object-group command");
			if (typeof value.objectGroup !== "string") throw new Error("inspector protocol: objectGroup must be a string");
			return {
				op: "release-object-group",
				objectGroup: value.objectGroup
			};
		case "global-lexical-scope-names":
			exactKeys(value, ["op"], "global-lexical-scope-names command");
			return { op: "global-lexical-scope-names" };
		default: throw new Error(`inspector protocol: unknown Client Runtime command ${JSON.stringify(value.op)}`);
	}
}
function parseCallFunction(value) {
	exactKeys(value, [
		"op",
		"functionDeclaration",
		"receiver",
		"arguments",
		"objectGroup",
		"silent",
		"returnByValue",
		"generatePreview",
		"userGesture",
		"awaitPromise"
	], "call-function command");
	if (typeof value.functionDeclaration !== "string") throw new Error("inspector protocol: functionDeclaration must be a string");
	let args;
	if (value.arguments !== void 0) {
		if (!Array.isArray(value.arguments)) throw new Error("inspector protocol: call arguments must be an array");
		args = value.arguments.map(parseCallArgument);
	}
	return {
		op: "call-function",
		functionDeclaration: value.functionDeclaration,
		...value.receiver === void 0 ? {} : { receiver: wireId(value.receiver, "receiver") },
		...args === void 0 ? {} : { arguments: args },
		...optionalString(value, "objectGroup"),
		...optionalBoolean(value, "silent"),
		...optionalBoolean(value, "returnByValue"),
		...optionalBoolean(value, "generatePreview"),
		...optionalBoolean(value, "userGesture"),
		...optionalBoolean(value, "awaitPromise")
	};
}
function parseCallArgument(value) {
	if (!isPlainObject(value) || typeof value.kind !== "string") throw new Error("inspector protocol: invalid Client Runtime call argument");
	switch (value.kind) {
		case "value":
			exactKeys(value, ["kind", "value"], "value call argument");
			if (!isJsonValue(value.value)) throw new Error("inspector protocol: call argument value must be JSON");
			return {
				kind: "value",
				value: value.value
			};
		case "unserializable":
			exactKeys(value, ["kind", "value"], "unserializable call argument");
			if (typeof value.value !== "string") throw new Error("inspector protocol: unserializable argument must be a string");
			return {
				kind: "unserializable",
				value: value.value
			};
		case "object":
			exactKeys(value, ["kind", "handle"], "object call argument");
			return {
				kind: "object",
				handle: wireId(value.handle, "handle")
			};
		case "undefined":
			exactKeys(value, ["kind"], "undefined call argument");
			return { kind: "undefined" };
		default: throw new Error(`inspector protocol: unknown call argument ${JSON.stringify(value.kind)}`);
	}
}
//#endregion

export {};
