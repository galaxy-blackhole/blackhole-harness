/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Spec Remote đã sinh của cotTranslation — NGUYÊN VĂN vùng lib/typert.remote-client.js
 *      trong bundle gốc lib/client.js (vùng 2); chỉ đổi id gói sang id CỦA TA (luật MỘT-ID)
 */

import { PACKAGE_NAME } from "./ids.ts";
import { createTypertRemoteInfo } from "./remote-info.ts";
import type { RequireFn, ZodModuleLike, ZodSchemaLike } from "./runtime-types.ts";

/** `require` của factory do vỏ cấp — nguồn của zod (KHÔNG import tĩnh: bundle phải chạy trong bảng module). */
declare const require: RequireFn;

/** Module zod do bảng module của vỏ cấp (nguyên văn `require("zod")` của bản gốc). */
const zod = require("zod") as ZodModuleLike;

/** Schema kết quả của `cotTranslation/limits` (dựng lười, cache — nguyên văn bản gốc). */
let limitsResultSchemaValue: ZodSchemaLike | undefined;
const limitsResultSchema = (): ZodSchemaLike =>
	(limitsResultSchemaValue ??= zod.z.object({
		maxTextChars: zod.z.number().describe("Maximum UTF-16 text length accepted by one translation request."),
		preferences: zod.z
			.object({
				provider: zod.z
					.union([zod.z.literal("google"), zod.z.literal("bing"), zod.z.literal("deepseek-account"), zod.z.literal("deepseek-official")])
					.describe("Explicit provider selection; requests never fall back to another provider."),
				targetLanguage: zod.z.string().describe("BCP 47 language code, or auto to follow the UI language."),
			})
			.describe("Current accepted provider and target-language preferences."),
		availableProviders: zod.z
			.array(zod.z.union([zod.z.literal("google"), zod.z.literal("bing"), zod.z.literal("deepseek-account"), zod.z.literal("deepseek-official")]))
			.describe("Anonymous endpoints and native paid routes currently eligible for translation."),
	}));

/** Schema kết quả của `cotTranslation/translate` (dựng lười, cache — nguyên văn bản gốc). */
let translateResultSchemaValue: ZodSchemaLike | undefined;
const translateResultSchema = (): ZodSchemaLike => (translateResultSchemaValue ??= zod.z.string());

/** Schema tham số `request` của `cotTranslation/translate` (dựng lười, cache — nguyên văn bản gốc). */
let translateRequestSchemaValue: ZodSchemaLike | undefined;
const translateRequestSchema = (): ZodSchemaLike =>
	(translateRequestSchemaValue ??= zod.z.object({
		text: zod.z.string().readonly().describe("Complete text submitted to the selected provider."),
		targetLanguage: zod.z.string().readonly().describe("Destination language; common Chinese locale tags are normalized per provider."),
		sourceLanguage: zod.z.string().readonly().optional().describe("Source language; omission uses automatic detection."),
		provider: zod.z
			.union([zod.z.literal("google"), zod.z.literal("bing"), zod.z.literal("deepseek-account"), zod.z.literal("deepseek-official")])
			.readonly()
			.optional()
			.describe("Endpoint selection; omission uses the service's configured provider."),
		sessionId: zod.z
			.string()
			.readonly()
			.optional()
			.describe("Existing Session for durable results; a cache miss requires it to be active. Omission keeps the call stateless."),
	}));

/** Schema tham số `request` ở chế độ NGHIÊM NGẶT (từ chối khoá lạ — nguyên văn bản gốc). */
let translateRequestStrictSchemaValue: ZodSchemaLike | undefined;
const translateRequestStrictSchema = (): ZodSchemaLike =>
	(translateRequestStrictSchemaValue ??= zod.z.strictObject({
		text: zod.z.string().readonly().describe("Complete text submitted to the selected provider."),
		targetLanguage: zod.z.string().readonly().describe("Destination language; common Chinese locale tags are normalized per provider."),
		sourceLanguage: zod.z.string().readonly().optional().describe("Source language; omission uses automatic detection."),
		provider: zod.z
			.union([zod.z.literal("google"), zod.z.literal("bing"), zod.z.literal("deepseek-account"), zod.z.literal("deepseek-official")])
			.readonly()
			.optional()
			.describe("Endpoint selection; omission uses the service's configured provider."),
		sessionId: zod.z
			.string()
			.readonly()
			.optional()
			.describe("Existing Session for durable results; a cache miss requires it to be active. Omission keeps the call stateless."),
	}));

/** Mô tả tham số `request` (dùng cho cả codec thường lẫn codec nghiêm ngặt — nguyên văn bản gốc). */
const REQUEST_PARAMETER_DESCRIPTION =
	"original text and Session identity supplied by the Client; provider and explicit target language match accepted preferences, while auto uses the browser locale.";

/** JSON Schema của tham số `request` (nguyên văn bản gốc; `additionalProperties` khác nhau theo chế độ). */
function requestJsonSchema(additionalProperties: boolean): Record<string, unknown> {
	return {
		type: "object",
		properties: {
			text: { type: "string", description: "Complete text submitted to the selected provider." },
			targetLanguage: { type: "string", description: "Destination language; common Chinese locale tags are normalized per provider." },
			sourceLanguage: { type: "string", description: "Source language; omission uses automatic detection." },
			provider: {
				type: "string",
				enum: ["google", "bing", "deepseek-account", "deepseek-official"],
				description: "Endpoint selection; omission uses the service's configured provider.",
			},
			sessionId: {
				type: "string",
				description: "Existing Session for durable results; a cache miss requires it to be active. Omission keeps the call stateless.",
			},
		},
		required: ["text", "targetLanguage"],
		additionalProperties,
	};
}

/**
 * Spec Remote đã sinh của service cotTranslation (hai phương thức limits + translate).
 * Nhận: không — hằng số của module, dựng lười khi Gateway hỏi.
 * Trả: thực thể info Remote để `ctx.remote.$mount` nhận.
 */
export const TYPERT_REMOTE = createTypertRemoteInfo(
	{
		package: PACKAGE_NAME,
		methods: {
			"cotTranslation/limits": {
				service: "cotTranslation",
				description: "Read accepted translation preferences and the current request limit without sending text.",
				invocation: { kind: "direct" },
				parameters: [],
				cancellation: { parameter: "signal" },
				result: {
					mode: "strict",
					typeSymbol: PACKAGE_NAME + "/types#CotTranslationSnapshot",
					create: limitsResultSchema,
					description: "authoritative preferences, eligible routes, and maximum UTF-16 text length per request.",
					jsonSchema: {
						type: "object",
						properties: {
							maxTextChars: {
								type: "number",
								description: "Maximum UTF-16 text length accepted by one translation request.",
							},
							preferences: {
								type: "object",
								properties: {
									provider: {
										type: "string",
										enum: ["google", "bing", "deepseek-account", "deepseek-official"],
										description: "Explicit provider selection; requests never fall back to another provider.",
									},
									targetLanguage: {
										type: "string",
										description: "BCP 47 language code, or auto to follow the UI language.",
									},
								},
								required: ["provider", "targetLanguage"],
								additionalProperties: true,
								description: "Current accepted provider and target-language preferences.",
							},
							availableProviders: {
								type: "array",
								items: {
									type: "string",
									enum: ["google", "bing", "deepseek-account", "deepseek-official"],
								},
								description: "Anonymous endpoints and native paid routes currently eligible for translation.",
							},
						},
						required: ["maxTextChars", "preferences", "availableProviders"],
						additionalProperties: true,
					},
				},
				sourceLocation: {
					file: "packages/experimental/client-ui-cot-translation/src/index.ts",
					line: 47,
					column: 9,
				},
			},
			"cotTranslation/translate": {
				service: "cotTranslation",
				description: "Translate one displayed fragment through the reader's selected provider.",
				invocation: { kind: "direct" },
				parameters: [
					{
						name: "request",
						description: REQUEST_PARAMETER_DESCRIPTION,
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@galaxy-blackhole/gbh-experimental-translator/types#TranslationRequest",
							create: translateRequestSchema,
							jsonSchema: requestJsonSchema(true),
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@galaxy-blackhole/gbh-experimental-translator/types#TranslationRequest",
							create: translateRequestStrictSchema,
							jsonSchema: requestJsonSchema(false),
						},
					},
				],
				cancellation: { parameter: "signal" },
				result: {
					mode: "strict",
					typeSymbol: PACKAGE_NAME + "#cotTranslation/translate:result",
					create: translateResultSchema,
					description:
						"translated text; an uncached inactive Session joins ordinary GUI activation before retry. Failures omit the source and provider response. Cancellation stops this caller's wait, not shared activation.",
					jsonSchema: { type: "string" },
				},
				sourceLocation: {
					file: "packages/experimental/client-ui-cot-translation/src/index.ts",
					line: 64,
					column: 9,
				},
			},
		},
	},
	zod.z,
);