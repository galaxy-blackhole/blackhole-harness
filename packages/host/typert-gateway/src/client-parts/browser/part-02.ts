/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @deepseek-ai/dsh-api-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/stream-protocol.js
		/** Wire messages for Gateway-owned Remote streams and event-result RPCs. */
		/** Exact WebSocket route carrying every Typert Remote stream. */
		const REMOTE_STREAM_MUX_PATH = "/api/remote.mux";
		/** Gateway-internal logical stream carrying application-selected Cordis events. */
		const REMOTE_EVENT_STREAM_ENDPOINT = "$events";
		/** Gateway-internal unary endpoint returning one Client Remote Event outcome. */
		const REMOTE_EVENT_RESULT_ENDPOINT = "$events/result";
		/** Empty standard Remote payload used to open the forwarded-event stream. */
		const REMOTE_EVENT_STREAM_PAYLOAD = { args: {} };
		/**
		* Project an arbitrary rejection to stable, JSON-safe error fields.
		* @param reason - value thrown or rejected by a Client listener.
		* @returns wire-safe rejection fields.
		*/
		function projectRemoteEventRejection(reason) {
			const record = typeof reason === "object" && reason !== null ? reason : void 0;
			const name = stringProperty(record, "name") ?? "Error";
			const message = stringProperty(record, "message") ?? String(reason);
			const code = stringProperty(record, "code");
			const details = record === void 0 ? void 0 : Reflect.get(record, "details");
			return {
				name,
				message,
				...code === void 0 ? {} : { code },
				...details === void 0 || !isRemoteJsonValue(details) ? {} : { details }
			};
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
		* Parse and validate one Host-to-browser text message.
		* @param text - complete WebSocket text message.
		* @returns the validated logical-stream frame.
		*/
		function parseRemoteStreamServerMessage(text) {
			return parseMessage(text, (value) => {
				if (value.type === "item" && (exactKeys(value, ["type", "streamId"]) || exactKeys(value, [
					"type",
					"streamId",
					"value"
				])) && validId(value.streamId)) return value;
				if (value.type === "end" && exactKeys(value, ["type", "streamId"]) && validId(value.streamId)) return value;
				if (value.type === "error" && exactKeys(value, [
					"type",
					"streamId",
					"error"
				]) && validId(value.streamId) && isRecord(value.error) && exactKeys(value.error, [
					"code",
					"message",
					"details"
				]) && typeof value.error.code === "string" && typeof value.error.message === "string" && isRecord(value.error.details)) return value;
				throw new Error("api gateway: invalid Remote stream server message");
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
		function exactKeys(value, expected) {
			return Reflect.ownKeys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
		}
		function validId(value) {
			return typeof value === "string" && value.length > 0;
		}
		function stringProperty(value, key) {
			if (value === void 0) return void 0;
			const candidate = Reflect.get(value, key);
			return typeof candidate === "string" ? candidate : void 0;
		}
		//#endregion

export {};
