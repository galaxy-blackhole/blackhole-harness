/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/images.js
/** Deterministic Messages image preparation for Files references and bounded inline fallback. */
function bounds(connection, representation) {
	return {
		representation,
		maxBytes: representation === "raw" ? connection.maxRequestFilesBytes : connection.maxInlineRequestImageBytes,
		maxImages: connection.maxImagesPerRequest,
		byteQuantum: representation === "raw" ? connection.imageOffloadByteQuantum : connection.inlineImageOffloadByteQuantum,
		countQuantum: connection.imageOffloadCountQuantum
	};
}
function* imageRefs(blocks) {
	for (const block of blocks) if (block.type === "image") yield block.attachment;
}
/** Normalize retained image references before converting Messages content.
* @param history - durable history; never mutated.
* @param connection - request-local image budgets.
* @param modelId - target model id.
* @param attachments - mounted attachment store, required only for image requests.
* @param access - current execution-world path resolver.
* @param signal - request cancellation.
* @returns projected history and prepared image bytes keyed by attachment id.
*/
async function prepareImages(history, connection, modelId, attachments, access, signal) {
	const versions = /* @__PURE__ */ new Map();
	const messages = projectOffloadedImages(history, (ref) => offloadedImageText(ref, access(ref)));
	if (!messages.some((message) => contentHasImage(message.content))) return {
		messages,
		versions
	};
	const model = connection.models.find((entry) => entry.id === modelId);
	if (model?.inputModalities?.includes("image") !== true || attachments === void 0) throw new LlmError("DeepSeek Messages image input requires a vision model and attachment service", "UNSUPPORTED_CONTENT");
	if (messages.some((message) => message.role !== "user" && message.role !== "tool" && contentHasImage(message.content))) throw new LlmError("DeepSeek Messages supports images only in user messages and tool results", "UNSUPPORTED_CONTENT");
	for (const message of messages) for (const ref of imageRefs(message.content)) if (!versions.has(ref.attachmentId)) versions.set(ref.attachmentId, await attachments.readImageRequest(ref, resolveRequestImageTarget(model, ref), signal));
	assertImagesFit(messages, versions, connection, "raw");
	return {
		messages,
		versions
	};
}
/** Require logged offload before retrying images that exceed the inline budget.
* @param messages - history already within the Files budget.
* @param versions - normalized versions prepared for retained references.
* @param connection - resolved inline bounds.
* @returns unchanged history within both byte and image-count limits.
*/
function inlineImages(messages, versions, connection) {
	assertImagesFit(messages, versions, connection, "base64");
	return messages;
}
/** Count additional oldest occurrences requiring durable offload at their exact represented bytes. */
function assertImagesFit(messages, versions, connection, representation) {
	const offloadImages = requiredImageOffload(messages, bounds(connection, representation), (block) => versions.get(block.attachment.attachmentId).bytes);
	if (offloadImages > 0) throw new LlmError(`DeepSeek Messages ${representation} request images exceed the route budget; ${offloadImages} more oldest occurrence(s) must be offloaded.`, IMAGE_OFFLOAD_REQUIRED_CODE, { offloadImages });
}
/** Resolve retained images to Files ids, recording every occurrence for failure diagnostics.
* @param messages - history within the Files byte/count budget.
* @param versions - normalized versions for every retained reference.
* @param files - request-owned Files resolution and recovery.
* @returns ids keyed by durable attachment identity.
*/
async function prepareFileIds(messages, versions, files) {
	const ids = /* @__PURE__ */ new Map();
	for (const [index, message] of messages.entries()) {
		let image = 0;
		for (const ref of imageRefs(message.content)) {
			const version = versions.get(ref.attachmentId);
			ids.set(ref.attachmentId, await files.resolve(version, {
				message: index + 1,
				image: ++image
			}));
		}
	}
	return ids;
}
//#endregion

export {};
