/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/session-wire-event.js
		/** Event-local acceptance for raw Session journal responses; payloads remain owner-defined JSON. */
		/**
		* Reject non-current event envelopes without stripping or normalizing wire fields.
		* Range membership and source existence require the durable log and remain Host-owned.
		* @param value - one event received in a follow frame or history page.
		* @returns nothing after narrowing the accepted event envelope.
		* @throws when the envelope or current event-local metadata is invalid.
		*/
		function assertSessionWireEvent(value) {
			const subject = "session wire event";
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${subject} must be an object`);
			const event = value;
			for (const key of Object.keys(event)) switch (key) {
				case "type":
				case "seq":
				case "time":
				case "data":
				case "ignorable":
				case "surfaceOp":
				case "sourceEventSeqs": break;
				default: throw new Error(`${subject} has unexpected field ${key}`);
			}
			const seq = event["seq"];
			if (typeof event["type"] !== "string" || typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0 || Object.is(seq, -0) || typeof event["time"] !== "number" || !Number.isSafeInteger(event["time"]) || !Object.hasOwn(event, "data") || event["data"] === void 0 || Object.hasOwn(event, "ignorable") && event["ignorable"] !== true) throw new Error(`${subject} has an invalid envelope`);
			const current = event;
			validateSurfaceMetadata(current);
			validateSessionEventData(current, subject);
		}
		//#endregion

export {};
