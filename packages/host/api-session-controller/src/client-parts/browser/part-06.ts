/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region ../../core/session/lib/types/surface.js
		/** Runtime counterpart of the message-producing event union. */
		const SURFACE_EVENT_TYPES = new Set([
			"system/message",
			"developer/message",
			"user/message",
			"assistant/message",
			"tool/result"
		]);
		/**
		* Whether an event type can join the model-visible surface.
		* @param type - event type to test.
		* @returns true for one of the message-producing event types.
		*/
		function isSurfaceEligibleType(type) {
			return SURFACE_EVENT_TYPES.has(type);
		}
		/** Whether a payload field is a JSON object rather than an array or scalar. */
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/**
		* Reject noncanonical request-header fields, developer roles/content, and contradictory tool failure metadata.
		* This does not validate complete event payloads or embedded provider streams.
		* @param event - event whose locally related payload fields are inspected.
		* @param subject - event location to include in validation errors.
		* @throws when request-header fields, developer roles/content, or tool failure metadata are invalid.
		*/
		function validateSessionEventData(event, subject) {
			const data = event.data;
			if (SURFACE_EVENT_TYPES.has(event.type) && isRecord(data)) {
				const message = event.type === "user/message" ? data : data["message"];
				if (isRecord(message)) {
					if (event.type === "developer/message" !== (message["role"] === "developer")) throw new Error(`${subject} developer/message and developer role must occur together`);
					if (message["role"] !== "developer" && Array.isArray(message["content"]) && message["content"].some((block) => isRecord(block) && (block["type"] === "tool-addition" || block["type"] === "tool-removal"))) throw new Error(`${subject} tool-change blocks require developer role`);
					if (event.type === "developer/message" && Array.isArray(message["content"])) {
						let hasAdditions = false;
						for (const block of message["content"]) {
							if (!isRecord(block) || block["type"] !== "tool-addition" && block["type"] !== "tool-removal") continue;
							if (typeof block["toolName"] !== "string" || block["toolName"].length === 0) throw new Error(`${subject} ${block["type"]} requires a nonempty toolName`);
							if (block["type"] === "tool-addition") {
								hasAdditions = true;
								if (Object.hasOwn(block, "tool")) throw new Error(`${subject} tool-addition must omit inline tool definitions`);
							}
						}
						if (hasAdditions ? !isEventSeq(data["headerSeq"]) : Object.hasOwn(data, "headerSeq")) throw new Error(`${subject} requires headerSeq exactly when tool additions are present`);
					}
				}
			}
			if (event.type === "request/header") {
				if (!isRecord(data)) throw new Error(`${subject} data must be an object`);
				const header = data["header"];
				if (!isRecord(header)) throw new Error(`${subject} header must be an object`);
				if (Object.hasOwn(header, "system")) throw new Error(`${subject} must omit header.system; use system/message`);
				if (Array.isArray(header["tools"]) && header["tools"].length === 0) throw new Error(`${subject} must omit empty tools`);
				const defaults = header["adapterDefaults"];
				if (isRecord(defaults) && Object.keys(defaults).length === 0) throw new Error(`${subject} must omit empty adapterDefaults`);
			} else if (event.type === "tool/result") {
				if (!isRecord(data)) throw new Error(`${subject} data must be an object`);
				if (data["error"] === void 0) return;
				const message = data["message"];
				if (!isRecord(message) || message["isError"] !== true) throw new Error(`${subject} error requires message.isError === true`);
			}
		}
		/** Whether a runtime value is a non-negative safe event sequence. */
		function isEventSeq(value) {
			return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
		}
		/** Whether a runtime value is the exact positional-replacement shape. */
		function isReplaceOp(value) {
			const op = value;
			return Object.keys(op).length === 3 && Object.hasOwn(op, "op") && Object.hasOwn(op, "startSeq") && Object.hasOwn(op, "endSeq") && op["op"] === "replace" && isEventSeq(op["startSeq"]) && isEventSeq(op["endSeq"]);
		}
		/** Validate event-local surface eligibility and return its operation. */
		function surfaceOpOf(event) {
			const raw = event;
			if (!isSurfaceEligibleType(event.type)) {
				if (!KNOWN_SESSION_EVENT_TYPES.has(event.type) && event.ignorable === true) return;
				if (raw.surfaceOp !== void 0) throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry surfaceOp`);
				if (raw.sourceEventSeqs !== void 0) throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry sourceEventSeqs`);
				return;
			}
			const op = raw.surfaceOp;
			if (op === void 0) throw new Error(`session event "${event.type}" is surface-eligible and requires a surfaceOp marker`);
			if (op === "append") return op;
			if (op === null || typeof op !== "object" || Array.isArray(op)) throw new Error(`session event "${event.type}" carries an invalid surfaceOp`);
			if (!isReplaceOp(op)) throw new Error(`session event "${event.type}" carries an invalid replace surfaceOp`);
			return op;
		}
		/** Validate cited source-event seqs against prior log entries and the replacement range. */
		function assertSourceEventReferences(event, shadowedSeqs) {
			const raw = event.sourceEventSeqs;
			if (event.type === "assistant/message" && raw !== void 0) throw new Error("assistant/message embeds its source stream and cannot carry sourceEventSeqs");
			const sources = /* @__PURE__ */ new Set();
			if (raw !== void 0) {
				if (!Array.isArray(raw)) throw new Error(`sourceEventSeqs on event at seq ${event.seq} must be an array when present`);
				if (raw.length === 0) throw new Error("sourceEventSeqs must not be empty");
				let nonEarlierSource;
				for (const source of raw) {
					if (!isEventSeq(source)) throw new Error(`session event "${event.type}" sourceEventSeqs must densely contain non-negative safe integers`);
					sources.add(source);
					if (nonEarlierSource === void 0 && source >= event.seq) nonEarlierSource = source;
				}
				if (sources.size !== raw.length) throw new Error("sourceEventSeqs must not contain duplicates");
				if (nonEarlierSource !== void 0) throw new Error(`sourceEventSeqs must reference earlier events: ${nonEarlierSource} >= current seq ${event.seq}`);
			}
			const missing = shadowedSeqs.filter((seq) => !sources.has(seq));
			if (missing.length > 0) throw new Error(`surface replace: sourceEventSeqs must include every shadowed surface node; missing ${missing.join(", ")}`);
		}
		/**
		* Validate one event's surface metadata without checking membership in a log or surface.
		* @param event - event whose marker and source sequence values are inspected.
		* Unknown ignorable records retain opaque metadata and never change the surface.
		* @returns the validated operation, or undefined for a log-only or unknown ignorable event.
		* @throws when metadata violates event-local eligibility, marker, or source-sequence rules.
		*/
		function validateSurfaceMetadata(event) {
			const op = surfaceOpOf(event);
			if (op !== void 0 && op !== "append" && (op.startSeq >= event.seq || op.endSeq >= event.seq)) throw new Error(`surface replace at seq ${event.seq}: startSeq and endSeq must reference earlier events`);
			if (op !== void 0) assertSourceEventReferences(event, []);
			return op;
		}
		//#endregion

export {};
