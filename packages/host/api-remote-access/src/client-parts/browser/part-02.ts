/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/typert.remote-client.js
		let _deepseek_ai_dsh_api_remote_access_remoteAccess_follow_result$schema$value;
		const _deepseek_ai_dsh_api_remote_access_remoteAccess_follow_result$schema = () => _deepseek_ai_dsh_api_remote_access_remoteAccess_follow_result$schema$value ??= zod.z.union([
			zod.z.object({
				"type": zod.z.literal("baseline").readonly(),
				"owner": zod.z.literal(true).readonly()
			}),
			zod.z.object({
				"type": zod.z.literal("baseline").readonly(),
				"owner": zod.z.literal(false).readonly(),
				"grants": zod.z.array(zod.z.object({
					"resource": zod.z.union([
						zod.z.object({ "kind": zod.z.literal("global").readonly() }),
						zod.z.object({
							"kind": zod.z.literal("session").readonly(),
							"id": zod.z.string().readonly()
						}),
						zod.z.object({
							"kind": zod.z.literal("workspace").readonly(),
							"id": zod.z.string().readonly()
						})
					]).readonly(),
					"actions": zod.z.array(zod.z.string()).readonly().describe("Endpoint actions allowed on this resource without call arguments, sorted; plain strings because Typert generates no codec for template literal types.")
				})).readonly()
			}),
			zod.z.object({
				"type": zod.z.literal("upsert").readonly(),
				"grant": zod.z.object({
					"resource": zod.z.union([
						zod.z.object({ "kind": zod.z.literal("global").readonly() }),
						zod.z.object({
							"kind": zod.z.literal("session").readonly(),
							"id": zod.z.string().readonly()
						}),
						zod.z.object({
							"kind": zod.z.literal("workspace").readonly(),
							"id": zod.z.string().readonly()
						})
					]).readonly(),
					"actions": zod.z.array(zod.z.string()).readonly().describe("Endpoint actions allowed on this resource without call arguments, sorted; plain strings because Typert generates no codec for template literal types.")
				}).readonly()
			}),
			zod.z.object({
				"type": zod.z.literal("remove").readonly(),
				"resource": zod.z.union([
					zod.z.object({ "kind": zod.z.literal("global").readonly() }),
					zod.z.object({
						"kind": zod.z.literal("session").readonly(),
						"id": zod.z.string().readonly()
					}),
					zod.z.object({
						"kind": zod.z.literal("workspace").readonly(),
						"id": zod.z.string().readonly()
					})
				]).readonly()
			})
		]);
		const TYPERT_REMOTE = createTypertRemoteInfo({
			package: "@deepseek-ai/dsh-api-remote-access",
			methods: { "remoteAccess/follow": {
				service: "remoteAccess",
				description: "Stream the calling Peer's access snapshot: one baseline, then `upsert` and `remove` frames after each `invalidate()` and each policy registration or removal that changes a grant. The owner receives only `{ owner: true }`. The generation ends when `signal` aborts or this service unloads, so a reloaded service starts every reader from a fresh baseline.",
				mode: "stream",
				invocation: { kind: "direct" },
				parameters: [],
				cancellation: { parameter: "signal" },
				result: {
					mode: "strict",
					typeSymbol: "@deepseek-ai/dsh-api-remote-access/types#RemoteAccessFrame",
					create: _deepseek_ai_dsh_api_remote_access_remoteAccess_follow_result$schema,
					description: "the access frames of one generation.",
					jsonSchema: { "oneOf": [
						{
							"type": "object",
							"properties": {
								"type": {
									"type": "string",
									"const": "baseline"
								},
								"owner": {
									"type": "boolean",
									"const": true
								}
							},
							"required": ["type", "owner"],
							"additionalProperties": true
						},
						{
							"type": "object",
							"properties": {
								"type": {
									"type": "string",
									"const": "baseline"
								},
								"owner": {
									"type": "boolean",
									"const": false
								},
								"grants": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"resource": { "oneOf": [
												{
													"type": "object",
													"properties": { "kind": {
														"type": "string",
														"const": "global"
													} },
													"required": ["kind"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "session"
														},
														"id": { "type": "string" }
													},
													"required": ["kind", "id"],
													"additionalProperties": true
												},
												{
													"type": "object",
													"properties": {
														"kind": {
															"type": "string",
															"const": "workspace"
														},
														"id": { "type": "string" }
													},
													"required": ["kind", "id"],
													"additionalProperties": true
												}
											] },
											"actions": {
												"type": "array",
												"items": { "type": "string" },
												"description": "Endpoint actions allowed on this resource without call arguments, sorted; plain strings because Typert generates no codec for template literal types."
											}
										},
										"required": ["resource", "actions"],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"type",
								"owner",
								"grants"
							],
							"additionalProperties": true
						},
						{
							"type": "object",
							"properties": {
								"type": {
									"type": "string",
									"const": "upsert"
								},
								"grant": {
									"type": "object",
									"properties": {
										"resource": { "oneOf": [
											{
												"type": "object",
												"properties": { "kind": {
													"type": "string",
													"const": "global"
												} },
												"required": ["kind"],
												"additionalProperties": true
											},
											{
												"type": "object",
												"properties": {
													"kind": {
														"type": "string",
														"const": "session"
													},
													"id": { "type": "string" }
												},
												"required": ["kind", "id"],
												"additionalProperties": true
											},
											{
												"type": "object",
												"properties": {
													"kind": {
														"type": "string",
														"const": "workspace"
													},
													"id": { "type": "string" }
												},
												"required": ["kind", "id"],
												"additionalProperties": true
											}
										] },
										"actions": {
											"type": "array",
											"items": { "type": "string" },
											"description": "Endpoint actions allowed on this resource without call arguments, sorted; plain strings because Typert generates no codec for template literal types."
										}
									},
									"required": ["resource", "actions"],
									"additionalProperties": true
								}
							},
							"required": ["type", "grant"],
							"additionalProperties": true
						},
						{
							"type": "object",
							"properties": {
								"type": {
									"type": "string",
									"const": "remove"
								},
								"resource": { "oneOf": [
									{
										"type": "object",
										"properties": { "kind": {
											"type": "string",
											"const": "global"
										} },
										"required": ["kind"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "session"
											},
											"id": { "type": "string" }
										},
										"required": ["kind", "id"],
										"additionalProperties": true
									},
									{
										"type": "object",
										"properties": {
											"kind": {
												"type": "string",
												"const": "workspace"
											},
											"id": { "type": "string" }
										},
										"required": ["kind", "id"],
										"additionalProperties": true
									}
								] }
							},
							"required": ["type", "resource"],
							"additionalProperties": true
						}
					] }
				},
				sourceLocation: {
					"file": "packages/api/remote-access/src/index.ts",
					"line": 271,
					"column": 10
				}
			} }
		}, zod.z);
		//#endregion

export {};
