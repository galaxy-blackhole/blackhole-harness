/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/replay.js
/** Minimal native thinking metadata; durable Harness blocks own all response text. */
/** Reject malformed JSON objects at provider and durable-data reads.
* @param value - untrusted decoded JSON.
* @param code - owning failure category.
* @returns the validated object.
*/
function object(value, code = "MALFORMED_RESPONSE") {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new LlmError("DeepSeek Messages expected a JSON object", code);
	return value;
}
/** Construct response metadata without duplicating the assistant text.
* @param model - requested model identity.
* @param blocks - metadata in emitted block order.
* @returns the versioned envelope persisted by the existing assembler.
*/
function replayState(model, blocks) {
	return {
		response: {
			kind: "deepseek-messages",
			version: 1,
			model
		},
		blocks
	};
}
/** Validate native replay, discarding unusable metadata before serializing durable content.
* @param message - durable assistant content and source metadata.
* @param model - target model; cross-model signatures are not portable.
* @param onDegrade - diagnostic for unusable metadata; receives no message content or signatures.
* @returns index-aligned metadata, absent for foreign, cross-model or degraded history.
*/
function readReplay(message, model, onDegrade) {
	try {
		return validateReplay(message, model);
	} catch (error) {
		/* v8 ignore next -- the validator only throws INVALID_REPLAY_STATE; preserve future non-replay failures. */
		if (!(error instanceof LlmError) || error.code !== "INVALID_REPLAY_STATE") throw error;
		onDegrade?.(error.message);
		return;
	}
}
function validateReplay(message, model) {
	if (message.source.kind !== "model" || message.source.replayState === void 0) return void 0;
	const fail = (detail) => {
		throw new LlmError(`DeepSeek Messages replay: ${detail}`, "INVALID_REPLAY_STATE");
	};
	const envelope = object(message.source.replayState, "INVALID_REPLAY_STATE");
	const response = object(envelope.response, "INVALID_REPLAY_STATE");
	if (response.kind !== "deepseek-messages" || response.version !== 1) return fail("unsupported kind or version");
	if (response.model !== message.source.model) return fail("model does not match assistant source model");
	if (!Array.isArray(envelope.blocks) || envelope.blocks.length !== message.content.length) return fail("block count mismatch");
	const blocks = envelope.blocks.map((value, index) => {
		const block = object(value, "INVALID_REPLAY_STATE");
		if (block.type !== message.content[index]?.type || block.type !== "text" && block.type !== "reasoning" && block.type !== "tool-call") return fail("block type mismatch");
		if (block.signature !== void 0 && (block.type !== "reasoning" || typeof block.signature !== "string")) return fail("invalid signature");
		return {
			type: block.type,
			...typeof block.signature === "string" ? { signature: block.signature } : {}
		};
	});
	return response.model === model ? blocks : void 0;
}
//#endregion

export {};
