/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-gateway — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/access.js
/**
* Resource resolution for non-owner access decisions: the resources one call
* or one forwarded event touches, read from Typert-validated arguments before
* any lookup or Context resolves them.
* @module @deepseek-ai/dsh-api-gateway/src/access
*/
const GLOBAL = Object.freeze([Object.freeze({ kind: "global" })]);
/**
* Resolve the resources one call touches. For each resource kind, a
* `resources` reader of the method wins; otherwise every lookup parameter
* whose provider declares the kind contributes its wire resource id, and so
* does the Context identity of a Context method whose Host adapter declares
* the kind; otherwise the kind's default field registered in
* `typert.resources` is read from a top-level argument or, failing that,
* from the first object argument.
* @param typert - registry holding default fields, lookup providers, and Host Context adapters.
* @param readers - the method's `resources` readers, or `undefined` when it declares none.
* @param descriptor - receiver, parameter order, lookups, and cancellation slot of the method.
* @param args - named arguments matched to the descriptor's field set: JSON
*   arguments as their Typert codecs validated them, lookup and Context
*   identities as wire values.
* @param signal - value placed in the cancellation slot of the positional arguments.
* @returns the touched resources, the global resource alone when none;
*   `undefined` when the resources are invalid: a reader throws or returns
*   an empty list, a default field holds an array, or a resource id is not a
*   non-empty string.
*/
function callResources(typert, readers, descriptor, args, signal) {
	const sources = /* @__PURE__ */ new Map();
	for (const { kind, field } of typert.resources.entries()) sources.set(kind, () => {
		const id = defaultFieldId(descriptor, args, field);
		return Array.isArray(id) ? "invalid" : id === void 0 ? [] : [id];
	});
	for (const [kind, ids] of lookupResources(typert, descriptor, args)) sources.set(kind, () => ids);
	let positional;
	for (const [kind, reader] of Object.entries(readers ?? {})) sources.set(kind, () => {
		positional ??= [...descriptor.parameters.map((parameter) => args[parameter.wire]), ...descriptor.cancellation === void 0 ? [] : [signal]];
		return read(reader, positional, []);
	});
	const resources = [];
	for (const [kind, ids] of sources) if (!collect(resources, kind, ids())) return void 0;
	return resources.length === 0 ? GLOBAL : resources;
}
/**
* Resolve the resources one forwarded event notification touches. An event
* carries every resource it declares, so a reader returning `undefined`
* makes the notification invalid instead of a global one.
* @param readers - the event entry's declared readers, or `undefined` when it declares none.
* @param args - the event's validated JSON arguments, passed to each reader as its positional arguments.
* @returns the global resource alone without readers, including an empty
*   reader set; otherwise the touched resources; `undefined` when the
*   resources are invalid: a resource id is missing or malformed.
*/
function eventResources(readers, args) {
	const declared = Object.entries(readers ?? {});
	if (declared.length === 0) return GLOBAL;
	const resources = [];
	for (const [kind, reader] of declared) if (!collect(resources, kind, read(reader, args, "invalid"))) return void 0;
	return resources;
}
/**
* The resource ids lookup parameters and the Context identity name, per
* resource kind: the Context identity first, then lookup parameters in order.
* An optional lookup parameter the call omits names no resource id; the
* Context identity is required.
*/
function lookupResources(typert, descriptor, args) {
	const ids = /* @__PURE__ */ new Map();
	const add = (kind, id) => {
		const list = ids.get(kind);
		if (list === void 0) ids.set(kind, [id]);
		else list.push(id);
	};
	const receiver = descriptor.invocation;
	if (receiver.kind === "context") {
		const kind = typert.contexts.getHost(receiver.context)?.resource;
		if (kind !== void 0) add(kind, args[receiver.wire]);
	}
	for (const parameter of descriptor.parameters) {
		if (parameter.lookup === void 0) continue;
		const kind = typert.lookups.get(parameter.lookup)?.resource;
		const id = args[parameter.wire];
		if (kind !== void 0 && id !== void 0) add(kind, id);
	}
	return ids;
}
/** Run one reader with spread positional arguments: `undefined` yields `absent`, a list names several and must not be empty. */
function read(reader, args, absent) {
	let value;
	try {
		value = reader(...args);
	} catch {
		return "invalid";
	}
	if (value === void 0) return absent;
	if (!Array.isArray(value)) return [value];
	return value.length === 0 ? "invalid" : value;
}
/** Append one kind's resource ids; false when any is malformed. */
function collect(resources, kind, ids) {
	if (ids === "invalid") return false;
	for (const id of ids) {
		if (typeof id !== "string" || id.length === 0) return false;
		resources.push({
			kind,
			id
		});
	}
	return true;
}
/** The default field: a top-level argument, else that field of the first object argument. */
function defaultFieldId(descriptor, args, field) {
	if (descriptor.parameters.some((parameter) => parameter.wire === field)) return args[field];
	for (const parameter of descriptor.parameters) {
		const value = args[parameter.wire];
		if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
		if (!Object.hasOwn(value, field)) return void 0;
		return Reflect.get(value, field);
	}
}
//#endregion

export {};
