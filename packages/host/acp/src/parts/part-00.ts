/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN dòng 1–645 của stock lib/index.js (@deepseek-ai/dsh-acp): ACP host plugin (content/mcp/model-control/codec/updates/session).
 */
// @ts-nocheck

import { Buffer as Buffer$1 } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import Schema from "@deepseek-ai/schemastery";
import { brandString } from "@deepseek-ai/dsh-brand";
import { ReasoningEffortId, createUserMessage, errorChain } from "@deepseek-ai/dsh-llm";
import { PROTOCOL_VERSION, RequestError, agent, methods, ndJsonStream } from "@agentclientprotocol/sdk";
import { isImageAdmissionError } from "@deepseek-ai/dsh-attachment";
import { validateHeaderName, validateHeaderValue } from "node:http";
import * as McpClient from "@deepseek-ai/dsh-mcp-client";
import { installModelSelection } from "@deepseek-ai/dsh-agent";
//#region lib/types/content.js
/** ACP wire-content admission and projection owned by the ACP adapter. @module */
/** Raster formats shared by ACP image blocks and the core attachment vocabulary. */
const IMAGE_MEDIA_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif"
];
/** Canonical RFC 4648 base64, excluding whitespace and URL-safe aliases. */
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
/** Error with a stable ACP request-failure category and no raw binary payload. */
var AcpContentError = class extends Error {
	/** Whether the bridge should report invalid params or an internal failure. */
	kind;
	/**
	* @param message - safe protocol-facing detail without inline binary data.
	* @param kind - request-failure category.
	* @param options - optional causal chain for diagnostics.
	*/
	constructor(message, kind, options) {
		super(message, options);
		this.name = "AcpContentError";
		this.kind = kind;
	}
};
/** Narrow a wire MIME string to the durable raster vocabulary. */
function imageMediaType(value) {
	return IMAGE_MEDIA_TYPES.includes(value) ? value : void 0;
}
/** Strictly decode one ACP inline image without accepting base64 aliases. */
function decodeImage(block) {
	const mediaType = imageMediaType(block.mimeType);
	if (mediaType === void 0) throw new AcpContentError("image mimeType must be image/png, image/jpeg, image/webp, or image/gif", "invalid");
	if (!CANONICAL_BASE64.test(block.data)) throw new AcpContentError("image data must be canonical base64", "invalid");
	const data = Buffer.from(block.data, "base64");
	if (data.toString("base64") !== block.data) throw new AcpContentError("image data must be canonical base64", "invalid");
	return {
		data,
		mediaType
	};
}
/** Resolve the exact current route and require explicit image input support. */
async function assertImageRoute(ctx, route, signal) {
	const provider = route?.provider;
	const model = route?.model;
	const llm = ctx.get("llm");
	if (provider === void 0 || model === void 0 || llm === void 0) throw new AcpContentError("the current model route could not be resolved for image input", "invalid");
	let info;
	try {
		info = await llm.resolveModelInfo(provider, model, signal);
	} catch (error) {
		throw new AcpContentError("the current model route could not be verified for image input", "internal", { cause: error });
	}
	if (info.inputModalities === void 0 || !info.inputModalities.includes("image")) throw new AcpContentError(`model "${model}" does not declare image input`, "invalid");
}
/**
* Determine whether initialization may truthfully advertise inline image prompts.
* Unknown service, route, capability, or deployment media support is negative.
* @param ctx - bridge context carrying optional attachment and model services.
* @param provider - configured provider route used for newly created sessions.
* @param model - configured exact model id used for newly created sessions.
* @returns whether this bridge can admit images at initialization time.
*/
async function supportsAcpImagePrompts(ctx, provider, model) {
	const attachments = ctx.get("attachments");
	const llm = ctx.get("llm");
	if (attachments === void 0 || llm === void 0 || provider === void 0 || model === void 0) return false;
	if (!attachments.imageLimits.mediaTypes.some((mediaType) => IMAGE_MEDIA_TYPES.includes(mediaType))) return false;
	try {
		return (await llm.resolveModelInfo(provider, model)).inputModalities?.includes("image") === true;
	} catch {
		return false;
	}
}
/** Render one baseline resource link into the core's current text vocabulary. */
function resourceLinkText(block) {
	return `\n[resource_link name=${JSON.stringify(block.name)} uri=${JSON.stringify(block.uri)}]\n`;
}
/**
* Admit one ACP prompt into ordered durable core content.
* Every wire block and image is validated before the ordered image batch starts
* writing; cancellation after a successful content-addressed write may leave an
* unreachable object but never queues a late user message.
* @param ctx - bridge context carrying attachment and model services.
* @param route - selection pinned to the accepted prompt.
* @param prompt - untrusted ACP prompt blocks in wire order.
* @param imageEnabled - capability result advertised during initialization.
* @param signal - admission cancellation signal.
* @returns core content with durable image references in wire order.
*/
async function admitAcpPrompt(ctx, route, prompt, imageEnabled, signal) {
	const images = [];
	for (const block of prompt) switch (block.type) {
		case "text":
		case "resource_link": break;
		case "image":
			if (!imageEnabled) throw new AcpContentError("inline image prompts were not advertised by this connection", "invalid");
			images.push(decodeImage(block));
			break;
		case "audio": throw new AcpContentError("audio prompt content is not supported", "invalid");
		case "resource": throw new AcpContentError("embedded resource prompt content is not supported", "invalid");
		/* v8 ignore next 2 -- ACP ContentBlock is a closed generated union. */
		default: throw new AcpContentError("unsupported ACP prompt content", "invalid");
	}
	let refs = [];
	if (images.length > 0) {
		const attachments = ctx.get("attachments");
		if (attachments === void 0) throw new AcpContentError("no attachment store is mounted", "invalid");
		await assertImageRoute(ctx, route, signal);
		signal.throwIfAborted();
		try {
			refs = await attachments.saveImages(images);
		} catch (error) {
			if (isImageAdmissionError(error)) throw new AcpContentError(error.message, "invalid", { cause: error });
			throw new AcpContentError("unable to persist the prompt image batch", "internal", { cause: error });
		}
		signal.throwIfAborted();
	}
	const content = [];
	let pendingText = "";
	let imageIndex = 0;
	const flushText = () => {
		if (pendingText.length === 0) return;
		content.push({
			type: "text",
			text: pendingText
		});
		pendingText = "";
	};
	for (const block of prompt) switch (block.type) {
		case "text":
			pendingText += block.text;
			break;
		case "resource_link":
			pendingText += resourceLinkText(block);
			break;
		case "image": {
			flushText();
			const ref = refs[imageIndex++];
			content.push({
				type: "image",
				attachment: ref
			});
			break;
		}
		/* v8 ignore start -- the validation pass above rejects both tags before reconstruction. */
		case "audio":
		case "resource": break;
		/* v8 ignore stop */
		/* v8 ignore next 2 -- validated by the first closed-union switch. */
		default: break;
	}
	flushText();
	if (!content.some((block) => block.type === "image" || block.type === "text" && block.text.trim().length > 0)) throw new AcpContentError("empty prompt", "invalid");
	return content;
}
/**
* Translate one committed assistant block to ACP wire content.
* Images are re-read and integrity-verified before inline base64 delivery;
* unsupported core output blocks stay off the automation wire.
* @param ctx - bridge context carrying the authoritative attachment store.
* @param block - committed core assistant block.
* @returns ACP text/image content, or undefined for non-output blocks.
*/
async function assistantBlockToAcp(ctx, block) {
	if (block.type === "text") return block.text.length === 0 ? void 0 : {
		type: "text",
		text: block.text
	};
	if (block.type !== "image") return void 0;
	const attachments = ctx.get("attachments");
	if (attachments === void 0) throw new AcpContentError("cannot deliver assistant image: no attachment store is mounted", "internal");
	let stored;
	try {
		stored = await attachments.readImage(block.attachment);
	} catch (error) {
		throw new AcpContentError("cannot deliver assistant image: the attachment is unavailable or corrupt", "internal", { cause: error });
	}
	return {
		type: "image",
		data: Buffer.from(stored.data).toString("base64"),
		mimeType: stored.ref.mediaType
	};
}
//#endregion
//#region lib/types/mcp.js
/** Standard ACP MCP-server declarations translated into Agent-scoped DSH MCP clients. */
const VALID_SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/;
/** Caller-correctable MCP declaration failure. */
var AcpMcpConfigError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "AcpMcpConfigError";
	}
};
/**
* Validate and mount one session's complete standard MCP server list before Agent publication.
* @param agentCtx - unpublished Agent scope that owns the MCP clients and tools.
* @param servers - stable ACP stdio or HTTP server declarations.
* @param sessionCwd - canonical primary workspace used by stdio servers.
*/
async function mountAcpMcpServers(agentCtx, servers, sessionCwd) {
	const configs = resolveMcpConfigs(servers, sessionCwd);
	for (const config of configs) await agentCtx.plugin(McpClient, config);
}
/** Convert the stable stdio/HTTP ACP transports and reject every other transport. */
function resolveMcpConfigs(servers, sessionCwd) {
	const names = /* @__PURE__ */ new Set();
	return servers.map((server, index) => {
		const serverName = normalizeServerName(server.name);
		if (names.has(serverName)) throw new AcpMcpConfigError(`mcpServers contains duplicate normalized name: ${serverName}`);
		names.add(serverName);
		if (!("type" in server)) {
			if (!isAbsolute(server.command)) throw new AcpMcpConfigError(`mcpServers[${index}].command must be an absolute path`);
			const env = entriesToRecord(server.env, `mcpServers[${index}].env`, "environment");
			return {
				...validateClientConfig(index, () => McpClient.Config({
					transport: "stdio",
					serverName,
					command: server.command,
					args: server.args,
					env,
					cwd: sessionCwd,
					failOnStartupError: true
				})),
				env
			};
		}
		if (server.type === "http") {
			assertHttpUrl(server.url, `mcpServers[${index}].url`);
			const headers = entriesToRecord(server.headers, `mcpServers[${index}].headers`, "header");
			return {
				...validateClientConfig(index, () => McpClient.Config({
					transport: "streamable-http",
					serverName,
					url: server.url,
					headers,
					failOnStartupError: true
				})),
				headers
			};
		}
		throw new AcpMcpConfigError(`mcpServers[${index}] transport ${server.type} is not supported`);
	});
}
/** Convert ordered ACP name/value entries without silently accepting duplicate keys. */
function entriesToRecord(entries, field, kind) {
	const result = Object.create(null);
	const names = /* @__PURE__ */ new Set();
	for (const entry of entries) {
		if (kind === "header") try {
			validateHeaderName(entry.name);
			validateHeaderValue(entry.name, entry.value);
		} catch (_invalidHeader) {
			throw new AcpMcpConfigError(`${field} contains an invalid header entry`);
		}
		else if (entry.name.length === 0 || entry.name.includes("=") || entry.name.includes("\0") || entry.value.includes("\0")) throw new AcpMcpConfigError(`${field} contains an invalid environment entry`);
		const identity = kind === "header" ? entry.name.toLowerCase() : entry.name;
		if (names.has(identity)) throw new AcpMcpConfigError(`${field} contains duplicate name: ${entry.name}`);
		names.add(identity);
		result[entry.name] = entry.value;
	}
	return result;
}
/** Produce a stable DSH tool namespace from ACP's human-readable server name. */
function normalizeServerName(name) {
	if (name.trim().length === 0 || /[\u0000-\u001f\u007f]/.test(name)) throw new AcpMcpConfigError("mcpServers contains an invalid server name");
	if (VALID_SERVER_NAME.test(name)) return name;
	return `${name.normalize("NFKD").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20) || "server"}_${createHash("sha256").update(name).digest("hex").slice(0, 8)}`.slice(0, 32);
}
/** Require the stable Streamable HTTP transport URL schemes. */
function assertHttpUrl(value, field) {
	try {
		const url = new URL(value);
		if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported protocol");
	} catch (_invalidUrl) {
		throw new AcpMcpConfigError(`${field} must be an absolute HTTP(S) URL`);
	}
}
/** Map the existing MCP provider's schema error into ACP invalid params. */
function validateClientConfig(index, parse) {
	try {
		return parse();
	} catch (error) {
		throw new AcpMcpConfigError(`mcpServers[${index}] is invalid: ${error instanceof Error ? error.message : String(error)}`);
	}
}
//#endregion
//#region lib/types/model-control.js
/** Standard ACP session configuration over one Agent's model selection. */
const MODEL_CONFIG_ID = "model";
const REASONING_CONFIG_ID = "reasoning_effort";
const PROVIDER_DEFAULT_REASONING_VALUE = "";
/** Caller-correctable session configuration failure. */
var AcpModelConfigError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "AcpModelConfigError";
	}
};
/** Project and mutate one Agent's provider/model/reasoning selection through ACP config options. */
var AcpModelControl = class {
	llm;
	/** Scoped selection reference consumed by Agent request assembly. */
	selection;
	tail = Promise.resolve();
	selected;
	turnSelection;
	hasResolvedState = false;
	constructor(llm, initial) {
		this.llm = llm;
		this.selected = initial;
		const getCurrent = () => this.turnSelection?.selection ?? this.selected;
		const setCurrent = (value) => {
			this.selected = value;
		};
		this.selection = {
			get current() {
				return getCurrent();
			},
			set current(value) {
				setCurrent(value);
			},
			assembled: void 0
		};
	}
	/**
	* Install request/prompt consistency listeners in the unpublished Agent scope.
	* @param agentCtx - Agent scope that consumes this selection.
	*/
	install(agentCtx) {
		installModelSelection(agentCtx, this.selection);
	}
	/**
	* Snapshot the selection attached to the next accepted ACP prompt.
	* @returns a detached future selection, or undefined when listeners supply the route.
	*/
	snapshot() {
		return this.selected === void 0 ? void 0 : { ...this.selected };
	}
	/**
	* Pin one admitted ACP message's selection for every step in its turn.
	* @param turn - admitted Agent turn.
	* @param selection - exact prompt-admission selection.
	*/
	pinTurn(turn, selection) {
		this.turnSelection = {
			turn,
			selection: { ...selection }
		};
	}
	/**
	* Release only the exact completed turn's routing override.
	* @param turn - completed Agent turn.
	*/
	releaseTurn(turn) {
		if (this.turnSelection?.turn === turn) this.turnSelection = void 0;
	}
	/**
	* Return the complete standard config-option state after prior mutations settle.
	* @param signal - optional catalog and exact-model cancellation.
	* @returns all current standard configuration options.
	*/
	options(signal) {
		return this.serialize(async () => (await this.state(signal)).options);
	}
	/**
	* Set one advertised option and return the complete resulting option state.
	* @param configId - standard option id.
	* @param value - opaque selected value returned by a previous option state.
	* @param signal - optional catalog and exact-model cancellation.
	* @returns all standard options after the serialized mutation.
	*/
	set(configId, value, signal) {
		return this.serialize(async () => {
			if (typeof value !== "string") throw new AcpModelConfigError(`${configId} requires a select value`);
			const current = this.selected;
			if (current === void 0) throw new AcpModelConfigError("this session has no model selection");
			if (configId === MODEL_CONFIG_ID) {
				const selected = (await this.state(signal)).choices.get(value);
				if (selected === void 0) throw new AcpModelConfigError(`unknown model option: ${value}`);
				await this.resolveSelection(selected, signal);
				this.selected = selected;
			} else if (configId === REASONING_CONFIG_ID) {
				const info = await this.llm.resolveModelInfo(current.provider, current.model, signal);
				const providerDefault = value === PROVIDER_DEFAULT_REASONING_VALUE && info.reasoning?.defaultEffort === void 0;
				if (info.reasoning === void 0 || !providerDefault && !info.reasoning.efforts.some((effort) => effort.id === value)) throw new AcpModelConfigError(`unknown reasoning effort for ${current.provider}/${current.model}: ${value}`);
				this.selected = await this.resolveSelection({
					provider: current.provider,
					model: current.model,
					...providerDefault ? {} : { reasoningEffort: ReasoningEffortId(value) }
				}, signal);
			} else throw new AcpModelConfigError(`unknown session config option: ${configId}`);
			return (await this.state(signal)).options;
		});
	}
	/** Keep concurrent client mutations in receive order without wedging after rejection. */
	serialize(operation) {
		const result = this.tail.then(operation);
		this.tail = result.then(() => void 0, () => void 0);
		return result;
	}
	/** Build detached model choices and the dependent reasoning option. */
	async state(signal) {
		const selected = this.selected;
		if (selected === void 0) return {
			choices: /* @__PURE__ */ new Map(),
			options: []
		};
		let resolved;
		let routeAvailable = true;
		try {
			resolved = await this.resolveSelection(selected, signal);
			this.hasResolvedState = true;
		} catch (error) {
			if (!this.hasResolvedState) throw error;
			resolved = selected;
			routeAvailable = false;
		}
		const choices = /* @__PURE__ */ new Map();
		const groups = await Promise.all(this.llm.listProviders().map(async (provider) => {
			try {
				const entries = (await this.llm.listModels(provider.id)).map((model) => {
					const choice = {
						value: modelValue(provider.id, model.id),
						selection: {
							provider: provider.id,
							model: model.id
						}
					};
					choices.set(choice.value, choice.selection);
					return {
						value: choice.value,
						name: model.name,
						...model.description === void 0 ? {} : { description: model.description }
					};
				});
				return {
					group: provider.id,
					name: provider.name,
					options: entries
				};
			} catch (_providerCatalogUnavailable) {
				return {
					group: provider.id,
					name: provider.name,
					options: []
				};
			}
		}));
		const currentValue = modelValue(resolved.provider, resolved.model);
		if (!choices.has(currentValue)) {
			choices.set(currentValue, {
				provider: resolved.provider,
				model: resolved.model
			});
			let group = groups.find((item) => item.group === resolved.provider);
			if (group === void 0) {
				group = {
					group: resolved.provider,
					name: resolved.provider,
					options: []
				};
				groups.push(group);
			}
			group.options.unshift({
				value: currentValue,
				name: resolved.model
			});
		}
		const options = [{
			id: MODEL_CONFIG_ID,
			name: "Model",
			category: "model",
			type: "select",
			currentValue,
			options: groups.filter((group) => group.options.length > 0)
		}];
		const info = routeAvailable ? await this.llm.resolveModelInfo(resolved.provider, resolved.model, signal) : void 0;
		if (info?.reasoning !== void 0) options.push({
			id: REASONING_CONFIG_ID,
			name: "Reasoning effort",
			category: "thought_level",
			type: "select",
			currentValue: resolved.reasoningEffort === void 0 ? PROVIDER_DEFAULT_REASONING_VALUE : String(resolved.reasoningEffort),
			options: [...info.reasoning.defaultEffort === void 0 ? [{
				value: PROVIDER_DEFAULT_REASONING_VALUE,
				name: "Provider default"
			}] : [], ...info.reasoning.efforts.map((effort) => ({
				value: String(effort.id),
				name: effort.name,
				...effort.description === void 0 ? {} : { description: effort.description }
			}))]
		});
		return {
			choices,
			options
		};
	}
	/** Validate an exact route and retain only Agent-owned selection fields. */
	async resolveSelection(selection, signal) {
		const resolved = await this.llm.resolveCallConfig(selection, signal);
		return {
			provider: resolved.provider,
			model: resolved.model,
			...resolved.reasoningEffort === void 0 ? {} : { reasoningEffort: resolved.reasoningEffort }
		};
	}
};
/** Opaque ACP selector value carrying the full route identity. */
function modelValue(provider, model) {
	return JSON.stringify([provider, model]);
}
//#endregion
//#region lib/types/codec.js
/**
* Pure translation between the harness lifecycle and the automation-only ACP wire.
* @module @deepseek-ai/dsh-acp/codec
*/
/**
* Map a harness turn ending to ACP's terminal reason vocabulary.
* @param reason - harness turn outcome.
* @returns the closest legal ACP stop reason.
*/
function turnEndToStopReason(reason) {
	switch (reason.kind) {
		case "completed": return "end_turn";
		case "max-tokens": return "max_tokens";
		case "aborted": return "end_turn";
		case "interrupted": return "cancelled";
		case "blocked":
		case "error": return "end_turn";
		/* v8 ignore next 2 -- TurnEndReason is merge-extensible; every live-turn member is
		* handled above, and seed-only variants (`forked`) never end an ACP prompt turn. */
		default: return "end_turn";
	}
}
//#endregion
//#region lib/types/updates.js
/** Standard ACP updates derived from committed DSH session events. */
/**
* Convert one committed assistant message and its context usage in block order.
* @param ctx - bridge context carrying attachment and token-meter services.
* @param session - durable session used for context pressure.
* @param event - committed assistant message event.
* @returns ordered standard thought, message, and optional usage updates.
*/
async function assistantUpdates(ctx, session, event) {
	const updates = [];
	for (const block of event.data.message.content) {
		if (block.type === "reasoning") {
			if (block.text.length > 0) updates.push({
				sessionUpdate: "agent_thought_chunk",
				messageId: event.data.message.id,
				content: {
					type: "text",
					text: block.text
				}
			});
			continue;
		}
		const content = await assistantBlockToAcp(ctx, block);
		if (content !== void 0) updates.push({
			sessionUpdate: "agent_message_chunk",
			messageId: event.data.message.id,
			content
		});
	}
	const usage = usageUpdate(ctx, session, event);
	if (usage !== void 0) updates.push(usage);
	return updates;
}
/**
* Start one generic ACP tool lifecycle from the durable call fact.
* @param event - committed DSH tool-call event.
* @returns the standard generic tool-call update.
*/
function toolCallUpdate(event) {
	return {
		sessionUpdate: "tool_call",
		toolCallId: event.data.callId,
		title: event.data.name,
		kind: "other",
		status: "in_progress",
		rawInput: parseToolArguments(event.data.arguments)
	};
}
/**
* Finish one generic ACP tool lifecycle from its committed model-facing result.
* @param ctx - bridge context carrying the attachment store.
* @param event - committed DSH tool-result event.
* @returns the standard completed or failed tool-call update.
*/
async function toolResultUpdate(ctx, event) {
	const message = event.data.message;
	const content = [];
	for (const block of message.content) {
		const converted = await assistantBlockToAcp(ctx, block);
		if (converted !== void 0) content.push({
			type: "content",
			content: converted
		});
	}
	return {
		sessionUpdate: "tool_call_update",
		toolCallId: message.toolCallId,
		status: message.isError === true ? "failed" : "completed",
		content
	};
}
/** Report current context occupancy only when DSH has both usage and capacity facts. */
function usageUpdate(ctx, session, event) {
	if (event.data.usage === void 0) return void 0;
	const size = session.requestContext()?.contextWindow;
	const meter = ctx.get("tokenMeter");
	if (size === void 0 || meter === void 0) return void 0;
	return {
		sessionUpdate: "usage_update",
		used: meter.measure(session).totalTokens,
		size
	};
}
/** Preserve malformed model output as opaque input instead of dropping the call update. */
function parseToolArguments(value) {
	try {
		return JSON.parse(value);
	} catch (_invalidModelJson) {
		return value;
	}
}
//#endregion

export {};
