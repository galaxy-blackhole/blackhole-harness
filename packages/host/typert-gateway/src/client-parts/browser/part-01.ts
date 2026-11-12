/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @deepseek-ai/dsh-api-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region ../../typert/protocol/lib/index.js
		/** The one Remote failure class shared by owners, the Gateway, and consumers. */
		/**
		* One Remote call failure: a real Error carrying its stable code and typed
		* details. Owners throw it at the failure point; the Host Gateway encodes it
		* onto the wire unchanged; the Client face rebuilds an instance for the
		* `RemoteResult` error branch, so `throw result.error` keeps throw semantics.
		* Discrimination is always by `code`, never by instanceof.
		*/
		var RemoteError = class extends Error {
			code;
			details;
			/** Structural marker: cross-realm/bundle identification never uses instanceof. */
			isDSHRemoteError = true;
			/**
			* @param code - stable failure code declared in {@link RemoteErrorDetailsMap}.
			* @param message - human diagnostic carried across the wire.
			* @param details - structured payload typed by the code.
			* @param options - standard Error options (`cause` survives in-process only).
			*/
			constructor(code, message, details, options) {
				super(message, options);
				this.code = code;
				this.details = details;
				this.name = "RemoteError";
			}
		};
		/**
		* Structurally identify a RemoteError thrown across module or realm copies of
		* this class. Mechanism-internal: the Gateway and test assertions use it;
		* business code receives typed failures and never needs it.
		* @param value - a caught value.
		* @returns the failure when the marker matches, otherwise undefined.
		*/
		function remoteErrorOf(value) {
			if (typeof value === "object" && value !== null && value.isDSHRemoteError === true && typeof value.code === "string") return value;
		}
		/** Generic invocation-owned values returned by synchronous Client Context resolvers. */
		/** Shared identity across independently bundled Context providers and Gateway. */
		const TYPERT_OWNED_VALUE = Symbol.for("dsh.typert.owned-value");
		/**
		* Identify invocation-owned values using the shared marker.
		* @param value - borrowed or owned resolver result.
		* @returns whether the result carries invocation cleanup.
		*/
		function isTypertOwnedValue(value) {
			return typeof value === "object" && value !== null && TYPERT_OWNED_VALUE in value && value[TYPERT_OWNED_VALUE] === true;
		}
		/**
		* Lossless JSON checks every Remote carrier shares: the Client handle before it
		* queues an uplink item, the Gateway at its wire and codec-less uplink
		* boundaries, and the in-process mock.
		*/
		/**
		* Test whether a value crosses JSON transport without coercion or omission.
		* @param value - candidate boundary value.
		* @returns whether the value is losslessly JSON-compatible.
		*/
		function isRemoteJsonValue(value) {
			return visitJsonValue(value, /* @__PURE__ */ new Set());
		}
		/**
		* Test whether a value may travel as one uplink item: a lossless JSON value, or
		* a top-level `undefined`, which the wire carries as an `item` frame without
		* `value`. Nested `undefined`, `NaN`, and infinities stay rejected.
		* @param value - candidate uplink item.
		* @returns whether the item crosses every carrier unchanged.
		*/
		function isRemoteUplinkItem(value) {
			return value === void 0 || isRemoteJsonValue(value);
		}
		function visitJsonValue(value, ancestors) {
			if (value === null || typeof value === "string" || typeof value === "boolean") return true;
			if (typeof value === "number") return Number.isFinite(value) && !Object.is(value, -0);
			if (typeof value !== "object") return false;
			if (ancestors.has(value)) return false;
			ancestors.add(value);
			try {
				if (Array.isArray(value)) {
					if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) return false;
					for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index) || !visitJsonValue(value[index], ancestors)) return false;
					return true;
				}
				const prototype = Object.getPrototypeOf(value);
				if (prototype !== Object.prototype && prototype !== null) return false;
				for (const key of Reflect.ownKeys(value)) {
					if (typeof key !== "string") return false;
					if (Object.getOwnPropertyDescriptor(value, key)?.enumerable !== true || !visitJsonValue(Reflect.get(value, key), ancestors)) return false;
				}
				return true;
			} finally {
				ancestors.delete(value);
			}
		}
		//#endregion

export {};
