/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/config.js
const MODEL_MODALITIES = ["text", "image"];
/** Read the current value behind every reference of a validated Config.
* @param config Parsed plugin Config.
* @returns Plain options for the resolver.
*/
function plainOptions(config) {
	return Object.fromEntries(Object.entries(config).map(([key, value]) => [key, isVolatile(value) ? value.get() : value]));
}
/**
* Schemas of the catalog-entry fields other than `id` and `inputModalities`,
* whose requiredness and defaults differ between a `models` entry and a
* provider's per-model overrides.
*/
const catalogModelFields = {
	name: z.string(),
	description: z.string(),
	contextWindow: z.number().step(1).min(1),
	maxTokens: z.number().step(1).min(1),
	imagePixelBudget: z.union([z.number().step(1).min(1), "low"]),
	imageMaxBytes: z.number().step(1).min(1),
	systemPromptUpdate: z.const("in-history"),
	toolUpdate: z.union(["in-history", "addition-only"])
};
const catalogModel = z.object({
	id: z.string().required(),
	...catalogModelFields,
	inputModalities: z.array(z.union(MODEL_MODALITIES)).min(1).default(["text"])
});
/** Shared schema fields for Messages protocol options. */
const deepSeekConfigFields = {
	baseURL: z.string().volatile(),
	thinking: z.union(["enabled", "disabled"]).volatile(),
	reasoningEffort: z.union([
		"off",
		"low",
		"high",
		"max"
	]).volatile(),
	maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_TOKENS).volatile(),
	defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW).volatile(),
	models: z.array(catalogModel).default(DEFAULT_MODELS).volatile(),
	streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS).volatile(),
	maxRequestFilesBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_FILES_BYTES).volatile(),
	maxInlineRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_INLINE_REQUEST_IMAGE_BYTES).volatile(),
	maxImagesPerRequest: z.number().step(1).min(1).default(600).volatile(),
	imageOffloadByteQuantum: z.number().step(1).min(1).default(DEFAULT_IMAGE_OFFLOAD_BYTE_QUANTUM).volatile(),
	inlineImageOffloadByteQuantum: z.number().step(1).min(1).default(DEFAULT_INLINE_IMAGE_OFFLOAD_BYTE_QUANTUM).volatile(),
	imageOffloadCountQuantum: z.number().step(1).min(1).default(20).volatile(),
	filesApiTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_FILES_API_TIMEOUT_MS).volatile(),
	fileExpiresAfterSeconds: z.number().step(1).min(3600).max(2592e3).default(DEFAULT_FILE_EXPIRY_SECONDS).volatile(),
	fileRefreshMarginSeconds: z.number().step(1).min(0).default(DEFAULT_FILE_REFRESH_MARGIN_SECONDS).volatile(),
	fileQuotaCleanupBatch: z.number().step(1).min(1).max(1e3).default(100).volatile(),
	retryPolicy: RetryPolicySchema.volatile()
};
const Config = z.object(deepSeekConfigFields);
/** Public API default; the internal endpoint comes from $DEEPSEEK_BASE_URL. */
const PUBLIC_BASE_URL = "https://api.deepseek.com/anthropic";
/** Environment variable naming this provider's endpoint, honored only from trusted layers. */
const BASE_URL_ENV = "DEEPSEEK_BASE_URL";
/** Resolve, validate, and detach the advisory model catalog. */
function resolveModels(models) {
	const seen = /* @__PURE__ */ new Set();
	return (models ?? DEFAULT_MODELS).map((model) => {
		if (Object.hasOwn(model, "imageDetail")) throw new Error("llm-deepseek: catalog model imageDetail is no longer supported; use imagePixelBudget");
		if (model.id.length === 0) throw new Error("llm-deepseek: catalog model ids must be non-empty");
		if (model.name !== void 0 && model.name.length === 0) throw new Error(`llm-deepseek: catalog model "${model.id}" has an empty name`);
		if (model.contextWindow !== void 0 && (!Number.isInteger(model.contextWindow) || model.contextWindow <= 0)) throw new Error(`llm-deepseek: catalog model "${model.id}" contextWindow must be a positive integer`);
		if (model.maxTokens !== void 0 && (!Number.isInteger(model.maxTokens) || model.maxTokens <= 0)) throw new Error(`llm-deepseek: catalog model "${model.id}" maxTokens must be a positive integer`);
		const inputModalities = model.inputModalities ?? ["text"];
		if (inputModalities.length === 0) throw new Error(`llm-deepseek: catalog model "${model.id}" inputModalities must not be empty`);
		if (inputModalities.some((modality) => !MODEL_MODALITIES.includes(modality))) throw new Error(`llm-deepseek: catalog model "${model.id}" inputModalities must contain only "text" and "image"`);
		if (new Set(inputModalities).size !== inputModalities.length) throw new Error(`llm-deepseek: catalog model "${model.id}" inputModalities must not contain duplicates`);
		const hasImage = inputModalities.includes("image");
		if (!hasImage && (model.imagePixelBudget !== void 0 || model.imageMaxBytes !== void 0)) throw new Error(`llm-deepseek: text-only catalog model "${model.id}" cannot declare image request limits`);
		if (model.imagePixelBudget !== void 0 && model.imagePixelBudget !== "low" && (!Number.isSafeInteger(model.imagePixelBudget) || model.imagePixelBudget <= 0)) throw new Error(`llm-deepseek: catalog model "${model.id}" imagePixelBudget must be "low" or a positive safe integer`);
		if (model.imageMaxBytes !== void 0 && (!Number.isSafeInteger(model.imageMaxBytes) || model.imageMaxBytes <= 0)) throw new Error(`llm-deepseek: catalog model "${model.id}" imageMaxBytes must be a positive safe integer`);
		const systemPromptUpdate = model.systemPromptUpdate;
		if (systemPromptUpdate !== void 0 && systemPromptUpdate !== "in-history") throw new Error(`llm-deepseek: catalog model "${model.id}" systemPromptUpdate must be "in-history" when present`);
		const toolUpdate = model.toolUpdate;
		if (toolUpdate !== void 0 && toolUpdate !== "in-history" && toolUpdate !== "addition-only") throw new Error(`llm-deepseek: catalog model "${model.id}" toolUpdate must be "in-history" or "addition-only" when present`);
		if (seen.has(model.id)) throw new Error(`llm-deepseek: duplicate catalog model "${model.id}"`);
		seen.add(model.id);
		return {
			id: model.id,
			...model.name === void 0 ? {} : { name: model.name },
			...model.description === void 0 ? {} : { description: model.description },
			...model.contextWindow === void 0 ? {} : { contextWindow: model.contextWindow },
			...model.maxTokens === void 0 ? {} : { maxTokens: model.maxTokens },
			...model.systemPromptUpdate === void 0 ? {} : { systemPromptUpdate: model.systemPromptUpdate },
			...model.toolUpdate === void 0 ? {} : { toolUpdate: model.toolUpdate },
			inputModalities: [...inputModalities],
			...hasImage ? {
				...model.imagePixelBudget === void 0 ? {} : { imagePixelBudget: model.imagePixelBudget },
				imageMaxBytes: model.imageMaxBytes ?? 2097152
			} : {}
		};
	});
}
/**
* The one explicit resolve step from raw config to validated protocol
* settings. Programmatic construction may bypass Schemastery normalization, so
* every default and bound is re-judged here — for the composition entry at
* load (fail loud) and for each settings snapshot at its first use.
* @param config - raw plugin config or resolved settings snapshot.
* @param environment - this run's environment layers, or `undefined` outside
* the product CLI. Every layer may supply an endpoint: the product trusts the
* project it is launched in, so a checkout can point its own agent at the
* gateway that checkout is meant to use.
* @returns validated protocol settings; `models` holds one resolved entry per
* input model in input order, or the built-in catalog when `models` is absent.
*/
function resolveAdapterOptions(config, environment) {
	if (Object.hasOwn(config, "protocol")) throw new Error("llm-deepseek: protocol is not configurable; remove it and use a Messages-compatible baseURL");
	if (config.thinking === "disabled" && config.reasoningEffort !== void 0 && config.reasoningEffort !== "off") throw new Error("llm-deepseek: only reasoningEffort \"off\" can be configured when thinking is disabled");
	if (config.defaultContextWindow !== void 0 && (!Number.isInteger(config.defaultContextWindow) || config.defaultContextWindow <= 0)) throw new Error("llm-deepseek: defaultContextWindow must be a positive integer");
	if (config.maxTokens !== void 0 && (!Number.isSafeInteger(config.maxTokens) || config.maxTokens <= 0)) throw new Error("llm-deepseek: maxTokens must be a positive safe integer");
	const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? 3e5;
	if (!Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0 || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) throw new Error(`llm-deepseek: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
	const maxRequestFilesBytes = config.maxRequestFilesBytes ?? 134217728;
	if (!Number.isSafeInteger(maxRequestFilesBytes) || maxRequestFilesBytes <= 0) throw new Error("llm-deepseek: maxRequestFilesBytes must be a positive safe integer");
	const maxInlineRequestImageBytes = config.maxInlineRequestImageBytes ?? 20971520;
	if (!Number.isSafeInteger(maxInlineRequestImageBytes) || maxInlineRequestImageBytes <= 0) throw new Error("llm-deepseek: maxInlineRequestImageBytes must be a positive safe integer");
	const maxImagesPerRequest = config.maxImagesPerRequest ?? 600;
	if (!Number.isSafeInteger(maxImagesPerRequest) || maxImagesPerRequest <= 0) throw new Error("llm-deepseek: maxImagesPerRequest must be a positive safe integer");
	const imageOffloadByteQuantum = config.imageOffloadByteQuantum ?? 67108864;
	if (!Number.isSafeInteger(imageOffloadByteQuantum) || imageOffloadByteQuantum <= 0) throw new Error("llm-deepseek: imageOffloadByteQuantum must be a positive safe integer");
	if (imageOffloadByteQuantum > maxRequestFilesBytes) throw new Error("llm-deepseek: imageOffloadByteQuantum must not exceed maxRequestFilesBytes");
	const inlineImageOffloadByteQuantum = config.inlineImageOffloadByteQuantum ?? 10485760;
	if (!Number.isSafeInteger(inlineImageOffloadByteQuantum) || inlineImageOffloadByteQuantum <= 0) throw new Error("llm-deepseek: inlineImageOffloadByteQuantum must be a positive safe integer");
	if (inlineImageOffloadByteQuantum > maxInlineRequestImageBytes) throw new Error("llm-deepseek: inlineImageOffloadByteQuantum must not exceed maxInlineRequestImageBytes");
	const imageOffloadCountQuantum = config.imageOffloadCountQuantum ?? 20;
	if (!Number.isSafeInteger(imageOffloadCountQuantum) || imageOffloadCountQuantum <= 0) throw new Error("llm-deepseek: imageOffloadCountQuantum must be a positive safe integer");
	if (imageOffloadCountQuantum > maxImagesPerRequest) throw new Error("llm-deepseek: imageOffloadCountQuantum must not exceed maxImagesPerRequest");
	const filesApiTimeoutMs = config.filesApiTimeoutMs ?? 6e4;
	if (!Number.isFinite(filesApiTimeoutMs) || filesApiTimeoutMs <= 0 || filesApiTimeoutMs > MAX_TIMER_DELAY_MS) throw new Error(`llm-deepseek: filesApiTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
	const fileExpiresAfterSeconds = config.fileExpiresAfterSeconds ?? 604800;
	if (!Number.isSafeInteger(fileExpiresAfterSeconds) || fileExpiresAfterSeconds < 3600 || fileExpiresAfterSeconds > 2592e3) throw new Error("llm-deepseek: fileExpiresAfterSeconds must be an integer from 3600 through 2592000");
	const fileRefreshMarginSeconds = config.fileRefreshMarginSeconds ?? 3600;
	if (!Number.isSafeInteger(fileRefreshMarginSeconds) || fileRefreshMarginSeconds < 0 || fileRefreshMarginSeconds >= fileExpiresAfterSeconds) throw new Error("llm-deepseek: fileRefreshMarginSeconds must be a non-negative integer below fileExpiresAfterSeconds");
	const fileQuotaCleanupBatch = config.fileQuotaCleanupBatch ?? 100;
	if (!Number.isSafeInteger(fileQuotaCleanupBatch) || fileQuotaCleanupBatch < 1 || fileQuotaCleanupBatch > 1e3) throw new Error("llm-deepseek: fileQuotaCleanupBatch must be an integer from 1 through 1000");
	const baseURL = config.baseURL ?? environment?.get(BASE_URL_ENV)?.value ?? "https://api.deepseek.com/anthropic";
	const parsed = new URL(baseURL);
	if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("llm-deepseek: Messages baseURL must be an HTTP(S) root without credentials, query, or fragment");
	return {
		baseURL,
		defaults: {
			thinking: config.thinking,
			reasoningEffort: config.reasoningEffort
		},
		maxTokens: config.maxTokens ?? 256e3,
		defaultContextWindow: config.defaultContextWindow ?? 1e6,
		models: resolveModels(config.models),
		streamIdleTimeoutMs,
		maxRequestFilesBytes,
		maxInlineRequestImageBytes,
		maxImagesPerRequest,
		imageOffloadByteQuantum,
		inlineImageOffloadByteQuantum,
		imageOffloadCountQuantum,
		filesApiTimeoutMs,
		filePolicy: {
			expiresAfterSeconds: fileExpiresAfterSeconds,
			refreshMarginSeconds: fileRefreshMarginSeconds,
			quotaCleanupBatch: fileQuotaCleanupBatch
		},
		retryPolicy: resolveRetryPolicy(config.retryPolicy, "llm-deepseek: retryPolicy")
	};
}
//#endregion

export {};
