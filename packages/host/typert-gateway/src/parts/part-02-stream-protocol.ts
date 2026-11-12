/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-gateway — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/stream-protocol.js
/** Wire messages for Gateway-owned Remote streams and event-result RPCs. */
/** Exact WebSocket route carrying every Typert Remote stream. */
const REMOTE_STREAM_MUX_PATH = "/api/remote.mux";
/** Gateway-internal logical stream carrying application-selected Cordis events. */
const REMOTE_EVENT_STREAM_ENDPOINT = "$events";
/** Discriminator for the first item proving the Host event source is ready. */
const REMOTE_EVENT_STREAM_READY = { type: "ready" };
/**
* Parse one result sent through the Client's `$events/result` HTTP RPC.
* @param value - untrusted result payload.
* @returns validated event correlation and outcome fields.
*/
function parseRemoteEventResult(value) {
	if (!isRecord(value) || !exactKeys(value, [
		"clientId",
		"eventId",
		"outcome"
	]) || !isRemoteEventClientId(value.clientId) || !isRemoteEventId(value.eventId) || !isRecord(value.outcome)) throw new Error("api gateway: invalid Remote event result");
	const outcome = value.outcome;
	if (outcome.kind === "next" && exactKeys(outcome, ["kind"])) return {
		clientId: value.clientId,
		eventId: value.eventId,
		outcome: { kind: "next" }
	};
	if (outcome.kind === "result" && (exactKeys(outcome, ["kind"]) || exactKeys(outcome, ["kind", "value"])) && (!Object.hasOwn(outcome, "value") || isRemoteJsonValue(outcome.value))) return {
		clientId: value.clientId,
		eventId: value.eventId,
		outcome: Object.hasOwn(outcome, "value") ? {
			kind: "result",
			value: outcome.value
		} : { kind: "result" }
	};
	if (outcome.kind === "rejected" && exactKeys(outcome, ["kind", "error"])) return {
		clientId: value.clientId,
		eventId: value.eventId,
		outcome: {
			kind: "rejected",
			error: parseRemoteEventRejection(outcome.error)
		}
	};
	throw new Error("api gateway: invalid Remote event result");
}
/**
* Remove the direct Agent and cancellation fields from one waterfall request.
* @param value - request object before the waterfall's `next` callback.
* @param subject - Agent used by the Cordis scope carrier.
* @returns JSON-safe request fields and the optional Host cancellation signal.
*/
function projectRemoteEventRequest(value, subject) {
	if (!isPlainRecord(value) || !Object.hasOwn(value, "agent") || value.agent !== subject) throw new TypeError("api gateway: Remote event request must carry its scoped Agent directly");
	const signal = value.signal;
	if (signal !== void 0 && !(signal instanceof AbortSignal)) throw new TypeError("api gateway: Remote event request signal must be an AbortSignal");
	const request = Object.create(null);
	for (const key of Reflect.ownKeys(value)) {
		if (key === "agent" || key === "signal") continue;
		if (typeof key !== "string" || (typeof key === "string" ? Object.getOwnPropertyDescriptor(value, key) : void 0)?.enumerable !== true) throw new TypeError("api gateway: Remote event request has a non-JSON property");
		request[key] = Reflect.get(value, key);
	}
	if (!isRemoteJsonValue(request)) throw new TypeError("api gateway: Remote event request is not lossless JSON data");
	return {
		request,
		...signal === void 0 ? {} : { signal }
	};
}
/**
* Recreate a Client rejection for the Host continuation.
* @param rejection - validated wire-safe error fields.
* @returns an Error preserving the remote name, code, and JSON-safe details.
*/
function restoreRemoteEventRejection(rejection) {
	const error = new Error(rejection.message);
	error.name = rejection.name;
	if (rejection.code !== void 0) error.code = rejection.code;
	if (rejection.details !== void 0) error.details = rejection.details;
	return error;
}
/**
* Recognize a non-empty Remote Event correlation id at a wire boundary.
* @param value - untrusted wire value.
* @returns whether the value is a valid Remote Event id.
*/
function isRemoteEventId(value) {
	return typeof value === "string" && value.length > 0;
}
/**
* Recognize a non-empty Remote Event Client id at a wire boundary.
* @param value - untrusted wire value.
* @returns whether the value identifies one event-stream generation.
*/
function isRemoteEventClientId(value) {
	return typeof value === "string" && value.length > 0;
}
/**
* Recognize the direct Agent identity used by a scoped Remote Event.
* @param value - untrusted wire value.
* @returns whether the value is a non-empty Agent identity.
*/
function isRemoteEventAgentId(value) {
	return typeof value === "string" && value.length > 0;
}
/**
* Parse and validate one browser-to-Host text message.
* @param text - complete WebSocket text message.
* @returns the validated logical-stream request.
*/
function parseRemoteStreamClientMessage(text) {
	return parseMessage(text, (value) => {
		if ((value.type === "cancel" || value.type === "end") && exactKeys(value, ["type", "streamId"]) && validId(value.streamId)) return value;
		if (value.type === "item" && (exactKeys(value, ["type", "streamId"]) || exactKeys(value, [
			"type",
			"streamId",
			"value"
		])) && validId(value.streamId) && (!Object.hasOwn(value, "value") || isRemoteJsonValue(value.value))) return value;
		if (value.type === "open" && exactKeys(value, [
			"type",
			"streamId",
			"endpoint",
			"payload"
		]) && validId(value.streamId) && typeof value.endpoint === "string" && value.endpoint.length > 0) return value;
		throw new Error("api gateway: invalid Remote stream client message");
	});
}
function parseMessage(text, validate) {
	let decoded;
	try {
		decoded = JSON.parse(text);
	} catch (cause) {
		throw new Error("api gateway: Remote stream message is not JSON", { cause });
	}
	if (!isRecord(decoded)) throw new Error("api gateway: Remote stream message must be an object");
	return validate(decoded);
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isPlainRecord(value) {
	if (!isRecord(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
function exactKeys(value, expected) {
	return Reflect.ownKeys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}
function validId(value) {
	return typeof value === "string" && value.length > 0;
}
function parseRemoteEventRejection(value) {
	if (!isRecord(value) || !hasOnlyKeys(value, ["name", "message"], ["code", "details"]) || typeof value.name !== "string" || value.name.length === 0 || typeof value.message !== "string" || Object.hasOwn(value, "code") && typeof value.code !== "string" || Object.hasOwn(value, "details") && !isRemoteJsonValue(value.details)) throw new Error("api gateway: invalid Remote event rejection");
	return {
		name: value.name,
		message: value.message,
		...typeof value.code === "string" ? { code: value.code } : {},
		...Object.hasOwn(value, "details") ? { details: value.details } : {}
	};
}
function hasOnlyKeys(value, required, optional) {
	const keys = Reflect.ownKeys(value);
	return required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => typeof key === "string" && (required.includes(key) || optional.includes(key)));
}
//#endregion

export {};
