/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/request-extensions.js
/** Prepare plugin-contributed request fields and commit their delivery after HTTP acceptance. */
/**
* Merge contributions without replacing Messages fields. A rejected preparation or
* a base-field collision reports REQUEST_EXTENSION with the cause chain appended to
* the message. When the merged request fails to serialize, the payload is the
* base request alone and acceptance is a no-op, so contributors resend their
* unaccepted state on a later request. An acceptance failure is reported and
* does not fail the request.
* @param body - serialized Messages request before extension fields.
* @param options - request identity, purpose, and cancellation.
* @param prepare - contributor registry captured for this adapter.
* @param onOmitted - receives the omitted field names and the serialization failure.
* @param onUnaccepted - receives an acceptance failure after HTTP 2xx.
* @returns HTTP payload and a commit to invoke only after a successful HTTP response.
*/
async function prepareRequestExtensions(body, options, prepare, onOmitted, onUnaccepted) {
	let extensions;
	try {
		extensions = await prepare({
			body,
			...options
		});
	} catch (error) {
		throw new LlmError(`DeepSeek request extension preparation failed: ${errorChain(error)}`, "REQUEST_EXTENSION", { cause: error });
	}
	const fields = Object.keys(extensions.fields);
	for (const field of fields) if (Object.hasOwn(body, field)) throw new LlmError(`DeepSeek request extension field ${JSON.stringify(field)} collides with the base request`, "REQUEST_EXTENSION");
	let payload;
	try {
		payload = JSON.stringify({
			...body,
			...extensions.fields
		});
	} catch (error) {
		const base = JSON.stringify(body);
		onOmitted(fields, error);
		return {
			payload: base,
			accept: () => Promise.resolve()
		};
	}
	return {
		payload,
		async accept() {
			try {
				await extensions.accept();
			} catch (error) {
				onUnaccepted(error);
			}
		}
	};
}
//#endregion

export {};
