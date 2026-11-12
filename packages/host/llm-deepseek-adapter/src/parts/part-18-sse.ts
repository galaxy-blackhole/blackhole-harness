/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/sse.js
/** SSE framing delegated to eventsource-parser; JSON errors remain provider failures. */
/** Decode complete SSE frames without treating an unterminated tail as an event.
* @param body - provider response bytes.
* @param activity - pulse the idle watchdog for events and heartbeat comments.
* @returns JSON events, including message_stop; the translator owns completion.
*/
async function* parseSse(body, activity) {
	const events = body.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream({ onComment: activity }));
	for await (const frame of events) {
		activity();
		let raw;
		try {
			raw = JSON.parse(frame.data);
		} catch (_invalidSseJson) {
			throw new LlmError("DeepSeek Messages SSE contains invalid JSON", "MALFORMED_RESPONSE");
		}
		const event = object(raw);
		if (typeof event.type !== "string" || frame.event !== void 0 && frame.event !== event.type) throw new LlmError("DeepSeek Messages SSE event type mismatch", "MALFORMED_RESPONSE");
		if (event.type === "error") throw providerError(event, void 0);
		yield event;
	}
}
//#endregion

export {};
