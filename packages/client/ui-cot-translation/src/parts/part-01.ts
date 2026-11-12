/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-experimental-client-ui-cot-translation",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let zod = require("zod");
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		//#region ../../typert/protocol/lib/types/remote-info.js
		/** Lazy assembly of generated Remote definitions using caller-supplied Zod; no runtime imports. */
		/**
		* Retain one generated definition per endpoint without constructing parsers or projections.
		* The class instance builds its shared descriptor/method index on first access;
		* input schemas and JSON Schema projections are cached only when requested.
		* @param spec - compiler-produced method facts and Zod factories.
		* @param zod - the generated artifact's Zod runtime for named-input parsers.
		* @returns a lazy, mountable info instance with no registration or transport effects.
		*/
		function createTypertRemoteInfo(spec, zod) {
			return new RemoteInfo(spec, zod);
		}
		var RemoteInfo = class {
			spec;
			zod;
			index;
			constructor(spec, zod) {
				this.spec = spec;
				this.zod = zod;
			}
			get package() {
				return this.spec.package;
			}
			get descriptors() {
				return this.resolve().descriptors;
			}
			get methods() {
				return this.resolve().methods;
			}
			resolve() {
				if (this.index !== void 0) return this.index;
				const zod = this.zod;
				const descriptors = [];
				const methods = Object.create(null);
				for (const [endpoint, definition] of Object.entries(this.spec.methods)) {
					const separator = endpoint.indexOf("/");
					const namespace = endpoint.slice(0, separator);
					const method = endpoint.slice(separator + 1);
					const parameters = definition.parameters.map((parameter) => ({
						...parameter,
						wire: parameter.wire ?? parameter.name
					}));
					const descriptor = {
						...definition,
						id: `${this.spec.package}#${endpoint}`,
						namespace,
						method,
						parameters,
						result: definition.result.description === void 0 ? definition.result : new ResultValue(definition.result)
					};
					if (definition.invocation.kind === "direct") {
						const inputs = [];
						methods[endpoint] = Object.assign(descriptor, {
							input(options) {
								const strict = options?.strict === true;
								return inputs[strict ? 1 : 0] ??= new NamedInput(parameters, strict, zod);
							},
							invoke(remote, input, signal) {
								const named = input;
								const values = parameters.map((parameter) => named[parameter.wire]);
								if (definition.cancellation !== void 0) values.push(signal);
								const receiver = Reflect.get(remote, namespace);
								return Reflect.get(receiver, method).apply(receiver, values);
							}
						});
					}
					descriptors.push(descriptor);
				}
				return this.index = {
					descriptors,
					methods
				};
			}
		};
		function optional(parameter) {
			return parameter.source === "json" && parameter.acceptsUndefined === true;
		}
		var NamedInput = class {
			parameters;
			strict;
			zod;
			schema;
			projection;
			constructor(parameters, strict, zod) {
				this.parameters = parameters;
				this.strict = strict;
				this.zod = zod;
			}
			codec(parameter) {
				return this.strict ? parameter.strictCodec : parameter.codec;
			}
			create = () => this.schema ??= this.zod.strictObject(Object.fromEntries(this.parameters.map((parameter) => {
				const value = this.codec(parameter).create();
				return [parameter.wire, optional(parameter) ? value.optional() : value.nonoptional()];
			})));
			get jsonSchema() {
				return this.project().jsonSchema;
			}
			get jsonSchemaError() {
				return this.project().jsonSchemaError;
			}
			project() {
				if (this.projection !== void 0) return this.projection;
				const unavailable = this.parameters.find((parameter) => this.codec(parameter).jsonSchema === void 0);
				if (unavailable !== void 0) return this.projection = { jsonSchemaError: this.codec(unavailable).jsonSchemaError ?? `No JSON Schema for parameter ${unavailable.wire}` };
				return this.projection = { jsonSchema: {
					type: "object",
					properties: Object.fromEntries(this.parameters.map((parameter) => [parameter.wire, {
						...this.codec(parameter).jsonSchema,
						...parameter.description === void 0 ? {} : { description: parameter.description }
					}])),
					required: this.parameters.filter((parameter) => !optional(parameter)).map((parameter) => parameter.wire),
					additionalProperties: false
				} };
			}
		};
		var ResultValue = class {
			spec;
			projection;
			constructor(spec) {
				this.spec = spec;
			}
			get mode() {
				return this.spec.mode;
			}
			get typeSymbol() {
				return this.spec.typeSymbol;
			}
			get create() {
				return this.spec.create;
			}
			get decode() {
				return this.spec.decode;
			}
			get encode() {
				return this.spec.encode;
			}
			get description() {
				return this.spec.description;
			}
			get jsonSchemaError() {
				return this.spec.jsonSchemaError;
			}
			get jsonSchema() {
				if (this.projection === void 0) {
					const schema = this.spec.jsonSchema;
					this.projection = { value: schema === void 0 ? void 0 : {
						...schema,
						description: this.spec.description
					} };
				}
				return this.projection.value;
			}
		};
		//#endregion
		//#region lib/typert.remote-client.js
		let _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_limits_result$schema$value;
		const _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_limits_result$schema = () => _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_limits_result$schema$value ??= zod.z.object({
			"maxTextChars": zod.z.number().describe("Maximum UTF-16 text length accepted by one translation request."),
			"preferences": zod.z.object({
				"provider": zod.z.union([
					zod.z.literal("google"),
					zod.z.literal("bing"),
					zod.z.literal("deepseek-account"),
					zod.z.literal("deepseek-official")
				]).describe("Explicit provider selection; requests never fall back to another provider."),
				"targetLanguage": zod.z.string().describe("BCP 47 language code, or auto to follow the UI language.")
			}).describe("Current accepted provider and target-language preferences."),
			"availableProviders": zod.z.array(zod.z.union([
				zod.z.literal("google"),
				zod.z.literal("bing"),
				zod.z.literal("deepseek-account"),
				zod.z.literal("deepseek-official")
			])).describe("Anonymous endpoints and native paid routes currently eligible for translation.")
		});
		let _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_translate_parameter_0$schema$value;
		const _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_translate_parameter_0$schema = () => _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_translate_parameter_0$schema$value ??= zod.z.object({
			"text": zod.z.string().readonly().describe("Complete text submitted to the selected provider."),
			"targetLanguage": zod.z.string().readonly().describe("Destination language; common Chinese locale tags are normalized per provider."),
			"sourceLanguage": zod.z.string().readonly().optional().describe("Source language; omission uses automatic detection."),
			"provider": zod.z.union([
				zod.z.literal("google"),
				zod.z.literal("bing"),
				zod.z.literal("deepseek-account"),
				zod.z.literal("deepseek-official")
			]).readonly().optional().describe("Endpoint selection; omission uses the service's configured provider."),
			"sessionId": zod.z.string().readonly().optional().describe("Existing Session for durable results; a cache miss requires it to be active. Omission keeps the call stateless.")
		});
		let _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_translate_result$schema$value;
		const _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_translate_result$schema = () => _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_translate_result$schema$value ??= zod.z.string();
		let _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_translate_parameter_0_strict$schema$value;
		const _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_translate_parameter_0_strict$schema = () => _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_translate_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"text": zod.z.string().readonly().describe("Complete text submitted to the selected provider."),
			"targetLanguage": zod.z.string().readonly().describe("Destination language; common Chinese locale tags are normalized per provider."),
			"sourceLanguage": zod.z.string().readonly().optional().describe("Source language; omission uses automatic detection."),
			"provider": zod.z.union([
				zod.z.literal("google"),
				zod.z.literal("bing"),
				zod.z.literal("deepseek-account"),
				zod.z.literal("deepseek-official")
			]).readonly().optional().describe("Endpoint selection; omission uses the service's configured provider."),
			"sessionId": zod.z.string().readonly().optional().describe("Existing Session for durable results; a cache miss requires it to be active. Omission keeps the call stateless.")
		});
		const TYPERT_REMOTE = createTypertRemoteInfo({
			package: "@deepseek-ai/dsh-experimental-client-ui-cot-translation",
			methods: {
				"cotTranslation/limits": {
					service: "cotTranslation",
					description: "Read accepted translation preferences and the current request limit without sending text.",
					invocation: { kind: "direct" },
					parameters: [],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-experimental-client-ui-cot-translation/types#CotTranslationSnapshot",
						create: _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_limits_result$schema,
						description: "authoritative preferences, eligible routes, and maximum UTF-16 text length per request.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"maxTextChars": {
									"type": "number",
									"description": "Maximum UTF-16 text length accepted by one translation request."
								},
								"preferences": {
									"type": "object",
									"properties": {
										"provider": {
											"type": "string",
											"enum": [
												"google",
												"bing",
												"deepseek-account",
												"deepseek-official"
											],
											"description": "Explicit provider selection; requests never fall back to another provider."
										},
										"targetLanguage": {
											"type": "string",
											"description": "BCP 47 language code, or auto to follow the UI language."
										}
									},
									"required": ["provider", "targetLanguage"],
									"additionalProperties": true,
									"description": "Current accepted provider and target-language preferences."
								},
								"availableProviders": {
									"type": "array",
									"items": {
										"type": "string",
										"enum": [
											"google",
											"bing",
											"deepseek-account",
											"deepseek-official"
										]
									},
									"description": "Anonymous endpoints and native paid routes currently eligible for translation."
								}
							},
							"required": [
								"maxTextChars",
								"preferences",
								"availableProviders"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/experimental/client-ui-cot-translation/src/index.ts",
						"line": 47,
						"column": 9
					}
				},
				"cotTranslation/translate": {
					service: "cotTranslation",
					description: "Translate one displayed fragment through the reader's selected provider.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "original text and Session identity supplied by the Client; provider and explicit target language match accepted preferences, while auto uses the browser locale.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-experimental-translator/types#TranslationRequest",
							create: _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_translate_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"text": {
										"type": "string",
										"description": "Complete text submitted to the selected provider."
									},
									"targetLanguage": {
										"type": "string",
										"description": "Destination language; common Chinese locale tags are normalized per provider."
									},
									"sourceLanguage": {
										"type": "string",
										"description": "Source language; omission uses automatic detection."
									},
									"provider": {
										"type": "string",
										"enum": [
											"google",
											"bing",
											"deepseek-account",
											"deepseek-official"
										],
										"description": "Endpoint selection; omission uses the service's configured provider."
									},
									"sessionId": {
										"type": "string",
										"description": "Existing Session for durable results; a cache miss requires it to be active. Omission keeps the call stateless."
									}
								},
								"required": ["text", "targetLanguage"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-experimental-translator/types#TranslationRequest",
							create: _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_translate_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"text": {
										"type": "string",
										"description": "Complete text submitted to the selected provider."
									},
									"targetLanguage": {
										"type": "string",
										"description": "Destination language; common Chinese locale tags are normalized per provider."
									},
									"sourceLanguage": {
										"type": "string",
										"description": "Source language; omission uses automatic detection."
									},
									"provider": {
										"type": "string",
										"enum": [
											"google",
											"bing",
											"deepseek-account",
											"deepseek-official"
										],
										"description": "Endpoint selection; omission uses the service's configured provider."
									},
									"sessionId": {
										"type": "string",
										"description": "Existing Session for durable results; a cache miss requires it to be active. Omission keeps the call stateless."
									}
								},
								"required": ["text", "targetLanguage"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@deepseek-ai/dsh-experimental-client-ui-cot-translation#cotTranslation/translate:result",
						create: _deepseek_ai_dsh_experimental_client_ui_cot_translation_cotTranslation_translate_result$schema,
						description: "translated text; an uncached inactive Session joins ordinary GUI activation before retry. Failures omit the source and provider response. Cancellation stops this caller's wait, not shared activation.",
						jsonSchema: { "type": "string" }
					},
					sourceLocation: {
						"file": "packages/experimental/client-ui-cot-translation/src/index.ts",
						"line": 64,
						"column": 9
					}
				}
			}
		}, zod.z);
		//#endregion
		//#region lib/types/client/translation.js
		/**
		* Split reasoning into completed paragraphs and request-sized fragments.
		* @param text - original reasoning, including its exact whitespace.
		* @param running - whether the final paragraph may still grow.
		* @param maxTextChars - translator's configured UTF-16 request limit.
		* @returns whitespace-preserving fragments with completion flags for translation eligibility.
		*/
		function reasoningFragments(text, running, maxTextChars) {
			const result = [];
			const separator = /\r?\n(?:[\t ]*\r?\n)+/g;
			let start = 0;
export {};
