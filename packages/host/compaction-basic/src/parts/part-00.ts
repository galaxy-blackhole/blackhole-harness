/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN 1/2 của bundle gốc @deepseek-ai/dsh-compaction-basic — sinh tự động từ bundle gốc, không sửa tay
 */
// @ts-nocheck

import z from "@deepseek-ai/schemastery";
import { CompactionEngine, CompactionId, ManualCompactionError, compactCheckpointSource, toolPairingBalancedAfter, toolPairingBalancedBefore } from "@deepseek-ai/dsh-compaction";
import { BlockAssembler, CONTEXT_WINDOW_EXCEEDED_CODE, LlmError, contentHasImage, createUserMessage, errorChain } from "@deepseek-ai/dsh-llm";
import { assertNever, deepFreeze } from "@deepseek-ai/dsh-util-values";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { SessionSeq } from "@deepseek-ai/dsh-session";
//#region lib/types/config.js
/**
* Load-time validation and routed-model policy resolution for compaction-basic.
*
* @module @deepseek-ai/dsh-compaction-basic/config
*/
/** Default request-pressure fraction for every routed model. */
const DEFAULT_THRESHOLD_RATIO = .8;
/** Default verbatim-tail fraction for every routed model. */
const DEFAULT_RETAIN_RATIO = .16;
/** Fields shared by top-level defaults and exact-target overrides. */
const POLICY_CONFIG_KEYS = [
	"thresholdRatio",
	"headroomTokens",
	"retainRatio",
	"retainTokens",
	"summarizationProvider",
	"summarizationModel",
	"maxTokens",
	"compactionRetries",
	"maxOverflowRetries"
];
/** Complete public top-level configuration key set. */
const BASIC_COMPACT_CONFIG_KEYS = new Set([
	...POLICY_CONFIG_KEYS,
	"modelPolicies",
	"auto"
]);
/** Complete exact-target override key set. */
const MODEL_POLICY_KEYS = new Set([
	"provider",
	"model",
	...POLICY_CONFIG_KEYS
]);
/** Target-specific pressure configuration failure eligible for warning suppression. */
var TargetPressureConfigError = class extends Error {
	targetKey;
	/**
	* @param targetKey - exact provider/model route used as the warning key.
	* @param message - actionable configuration failure detail.
	*/
	constructor(targetKey, message) {
		super(message);
		this.targetKey = targetKey;
	}
};
/**
* Resolve and validate service defaults plus exact-target partial overrides.
* @param config - untrusted plugin configuration after Loader normalization.
* @returns detached immutable defaults and validated exact-target overrides.
*/
function resolveConfig(config = {}) {
	validateKeys(config, BASIC_COMPACT_CONFIG_KEYS, "BasicCompactionConfig");
	validatePolicy(config, "BasicCompactionConfig");
	if (config.auto !== void 0 && typeof config.auto !== "boolean") throw new Error("BasicCompactionConfig: auto must be a boolean");
	const headroomTokens = config.headroomTokens ?? 65536;
	const maxTokens = config.maxTokens ?? headroomTokens;
	assertPositiveInteger("BasicCompactionConfig.maxTokens (explicit or from headroomTokens)", maxTokens);
	const thresholdRatio = config.thresholdRatio ?? DEFAULT_THRESHOLD_RATIO;
	const retention = resolveRetention(config, { retainRatio: DEFAULT_RETAIN_RATIO });
	validateRatioRetention(thresholdRatio, retention, "BasicCompactionConfig");
	const modelPolicies = resolveModelPolicies(config.modelPolicies);
	for (const [index, policy] of modelPolicies.entries()) {
		if (policy.maxTokens === void 0 && config.maxTokens === void 0 && policy.headroomTokens !== void 0) policy.maxTokens = policy.headroomTokens;
		assertPositiveInteger(`BasicCompactionConfig: modelPolicies[${index}].maxTokens (explicit or from headroomTokens)`, policy.maxTokens ?? maxTokens);
		validateRatioRetention(policy.thresholdRatio ?? thresholdRatio, resolveRetention(policy, retention), `BasicCompactionConfig: modelPolicies[${index}]`);
	}
	return deepFreeze({
		thresholdRatio,
		headroomTokens,
		...retention,
		summarizationProvider: config.summarizationProvider ?? "",
		summarizationModel: config.summarizationModel ?? "",
		maxTokens,
		compactionRetries: config.compactionRetries ?? 1,
		maxOverflowRetries: config.maxOverflowRetries ?? 1,
		modelPolicies,
		auto: config.auto ?? true
	});
}
/**
* Merge the exact provider/model override over the validated default policy.
* @param config - validated service defaults and override table.
* @param target - exact durable provider/model route to match.
* @returns detached immutable policy before model-capacity scaling.
*/
function resolveTargetPolicy(config, target) {
	const override = config.modelPolicies.find((policy) => policy.provider === target.provider && policy.model === target.model);
	const inheritedRetention = config.retainTokens === void 0 ? { retainRatio: config.retainRatio } : { retainTokens: config.retainTokens };
	return deepFreeze({
		target: {
			provider: target.provider,
			model: target.model
		},
		thresholdRatio: override?.thresholdRatio ?? config.thresholdRatio,
		headroomTokens: override?.headroomTokens ?? config.headroomTokens,
		...resolveRetention(override ?? {}, inheritedRetention),
		summarizationProvider: override?.summarizationProvider ?? config.summarizationProvider,
		summarizationModel: override?.summarizationModel ?? config.summarizationModel,
		maxTokens: override?.maxTokens ?? config.maxTokens,
		compactionRetries: override?.compactionRetries ?? config.compactionRetries,
		maxOverflowRetries: override?.maxOverflowRetries ?? config.maxOverflowRetries
	});
}
/**
* Scale one routed policy into concrete token budgets for its model capacity.
*
* Pressure is capped by both the window fraction and the capacity remaining
* after the routed output reservation plus compaction headroom. Retention scales
* the message budget before headroom is deducted.
*
* @param policy - merged policy for the exact routed target.
* @param contextWindow - positive adapter-owned capacity for that target.
* @param reservedCompletionTokens - output tokens one routed request reserves.
* @returns detached immutable pressure and retention budgets.
*/
function resolveCompactSpec(policy, contextWindow, reservedCompletionTokens) {
	const targetKey = `${policy.target.provider}/${policy.target.model}`;
	if (!Number.isInteger(contextWindow) || contextWindow <= 0) throw new TargetPressureConfigError(targetKey, `BasicCompactionConfig: contextWindow (${contextWindow}) must be a positive integer`);
	if (!Number.isInteger(reservedCompletionTokens) || reservedCompletionTokens < 0) throw new TargetPressureConfigError(targetKey, `BasicCompactionConfig: reservedCompletionTokens (${reservedCompletionTokens}) must be a non-negative integer`);
	const messageBudgetTokens = contextWindow - reservedCompletionTokens;
	if (messageBudgetTokens <= 0) throw new TargetPressureConfigError(targetKey, `compaction-basic: ${targetKey} reserves ${reservedCompletionTokens} completion tokens of its ${contextWindow}-token context window, leaving no message budget; configure the adapter model's contextWindow above the effective request maxTokens`);
	const pressureBudgetTokens = messageBudgetTokens - policy.headroomTokens;
	if (pressureBudgetTokens <= 0) throw new TargetPressureConfigError(targetKey, `compaction-basic: ${targetKey} reserves ${reservedCompletionTokens} completion tokens and ${policy.headroomTokens} headroom tokens of its ${contextWindow}-token context window, leaving no pressure budget; reduce the effective request maxTokens or compaction headroomTokens, or configure a larger adapter model contextWindow`);
	const thresholdTokens = Math.floor(Math.min(contextWindow * policy.thresholdRatio, pressureBudgetTokens));
	const retainTokens = policy.retainTokens === void 0 ? Math.floor(messageBudgetTokens * policy.retainRatio) : policy.retainTokens;
	if (retainTokens >= thresholdTokens) throw new TargetPressureConfigError(targetKey, `BasicCompactionConfig: ${policy.target.provider}/${policy.target.model} retainTokens (${retainTokens}) must be less than threshold tokens ${thresholdTokens}`);
	return deepFreeze({
		target: { ...policy.target },
		contextWindow,
		thresholdRatio: policy.thresholdRatio,
		thresholdTokens,
		retainTokens,
		summarizationProvider: policy.summarizationProvider,
		summarizationModel: policy.summarizationModel,
		maxTokens: policy.maxTokens,
		compactionRetries: policy.compactionRetries,
		maxOverflowRetries: policy.maxOverflowRetries
	});
}
/** Choose an explicit retention form or inherit the already-resolved fallback. */
function resolveRetention(config, fallback) {
	if (config.retainTokens !== void 0) return { retainTokens: config.retainTokens };
	if (config.retainRatio !== void 0) return { retainRatio: config.retainRatio };
	return fallback;
}
/** Reject a capacity-independent retention conflict at plugin load. */
function validateRatioRetention(thresholdRatio, retention, name) {
	if (retention.retainRatio !== void 0 && retention.retainRatio >= thresholdRatio) throw new Error(`${name}: retainRatio (${retention.retainRatio}) must be less than the resolved thresholdRatio (${thresholdRatio})`);
}
/** Validate, detach, and reject duplicate exact-target policies. */
function resolveModelPolicies(configured) {
	if (configured === void 0) return [];
	if (!Array.isArray(configured)) throw new Error("BasicCompactionConfig: modelPolicies must be an array");
	const seen = /* @__PURE__ */ new Set();
	return configured.map((source, index) => {
		assertModelPolicy(source, `BasicCompactionConfig: modelPolicies[${index}]`);
		const key = `${source.provider}\u0000${source.model}`;
		if (seen.has(key)) throw new Error(`BasicCompactionConfig: duplicate model policy for ${source.provider}/${source.model}`);
		seen.add(key);
		return { ...source };
	});
}
/** Validate one untrusted exact-target override and narrow its public type. */
function assertModelPolicy(source, name) {
	if (!isUnknownRecord(source)) throw new Error(`${name} must be an object`);
	validateKeys(source, MODEL_POLICY_KEYS, name);
	assertNonEmptyString(`${name}.provider`, source.provider);
	assertNonEmptyString(`${name}.model`, source.model);
	validatePolicy(source, name);
}
/** Validate the fields common to defaults and exact-target partial overrides. */
function validatePolicy(config, name) {
	const thresholdRatio = config.thresholdRatio;
	const headroomTokens = config.headroomTokens;
	const retainRatio = config.retainRatio;
	const retainTokens = config.retainTokens;
	const maxTokens = config.maxTokens;
	const compactionRetries = config.compactionRetries;
	const maxOverflowRetries = config.maxOverflowRetries;
	if (thresholdRatio !== void 0) assertRatio(`${name}.thresholdRatio`, thresholdRatio);
	if (headroomTokens !== void 0) assertNonNegativeInteger(`${name}.headroomTokens`, headroomTokens);
	if (retainRatio !== void 0) assertRatio(`${name}.retainRatio`, retainRatio);
	if (retainTokens !== void 0) assertNonNegativeInteger(`${name}.retainTokens`, retainTokens);
	if (retainRatio !== void 0 && retainTokens !== void 0) throw new Error(`${name}: retainRatio and retainTokens are mutually exclusive`);
	if (maxTokens !== void 0) assertPositiveInteger(`${name}.maxTokens`, maxTokens);
	if (compactionRetries !== void 0) assertNonNegativeInteger(`${name}.compactionRetries`, compactionRetries);
	if (maxOverflowRetries !== void 0) assertNonNegativeInteger(`${name}.maxOverflowRetries`, maxOverflowRetries);
	validateSummarizationPair(config, name);
}
/** Require one scope to omit, clear, or replace the summarization target as a pair. */
function validateSummarizationPair(config, name) {
	const provider = config.summarizationProvider;
	const model = config.summarizationModel;
	if (provider !== void 0 && typeof provider !== "string") throw new Error(`${name}.summarizationProvider must be a string`);
	if (model !== void 0 && typeof model !== "string") throw new Error(`${name}.summarizationModel must be a string`);
	if (provider === void 0 && model === void 0) return;
	if (provider === void 0 || model === void 0 || provider.length === 0 !== (model.length === 0)) throw new Error(`${name}: summarizationProvider and summarizationModel must be set together as an empty or non-empty pair`);
}
/** Reject stale or misspelled keys before defaults can hide them. */
function validateKeys(config, keys, name) {
	for (const key of Object.keys(config)) if (!keys.has(key)) throw new Error(`${name}: unknown key "${key}"`);
}
function isUnknownRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function assertNonEmptyString(name, value) {
	if (typeof value !== "string" || value.length === 0) throw new Error(`${name} must be a non-empty string`);
}
function assertPositiveInteger(name, value) {
	if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error(`${name} (${String(value)}) must be a positive integer`);
}
function assertNonNegativeInteger(name, value) {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error(`${name} (${String(value)}) must be a non-negative integer`);
}
function assertRatio(name, value) {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 1) throw new Error(`${name} (${String(value)}) must be a number in (0, 1]`);
}
//#endregion
//#region lib/types/summarizer.js
/**
* Default one-shot summarization and durable checkpoint framing.
*
* @module @deepseek-ai/dsh-compaction-basic/summarizer
*/
/** Tags wrapping the structured summary inside the landed checkpoint node. */
const SUMMARY_OPEN_TAG = "<compacted-summary>";
const SUMMARY_CLOSE_TAG = "</compacted-summary>";
/**
* The summarization directive, delivered as the FINAL user message after the
* replayed conversation rather than as a distinct summarizer system prompt.
* Keeping the conversation's own system prompt, tools, and message prefix in
* front of it makes the auxiliary call a genuine prefix of the last routed
* request, so the provider's KV cache is reused instead of invalidated.
*/
const COMPACTION_INSTRUCTION = [
	"You are now acting as a compaction engine for this AI coding assistant. Condense the conversation ABOVE into a structured checkpoint that lets another model resume the work with no loss of essential context.",
	"",
	"Output EXACTLY the Markdown structure below: keep every section, in order. Use terse bullets, not prose paragraphs. Write \"(none)\" for an empty section — never drop a section.",
	"",
	"## Primary Request and Intent",
	"- [the user's original and evolving goals; quote verbatim where the exact wording matters]",
	"",
	"## Key Technical Concepts",
	"- [technologies, frameworks, patterns, and conventions in play]",
	"",
	"## Files and Code",
	"- [exact path: why it matters, key changes or snippets]",
	"",
	"## Errors and Fixes",
	"- [error: how it was resolved, plus any related user feedback]",
	"",
	"## Pending Jobs",
	"- [explicitly requested work not yet completed]",
	"",
	"## Current Work",
	"- [precisely what was in progress at this checkpoint]",
	"",
	"## Next Step",
	"- [the single next action, directly in line with the most recent request, or \"(none)\"]",
	"",
	"## Critical Context",
	"- [decisions and their rationale, constraints, user preferences, open questions, data needed to continue]",
	"",
	"Rules:",
	"- Write concise English engineering prose. Preserve exact file paths, commands, error strings, identifiers, numeric values, function signatures, and syntax fragments.",
	"- Capture user feedback and explicit instructions faithfully, especially corrections.",
	"- Do NOT mention this summarization request or that the context was compacted.",
	"- Output only the checkpoint text: do not call any tool or take any other action.",
	`- If the conversation already contains a ${SUMMARY_OPEN_TAG} block, it is a PRIOR checkpoint. Do not copy it forward verbatim: preserve still-true facts, drop stale ones, and merge newer information into a single consolidated summary under the same structure.`
].join("\n");
/** Framing that makes the replacement user message established context. */
const CHECKPOINT_PREAMBLE = "This is an automatically generated checkpoint condensing an earlier span of the conversation to free up context. Treat the captured context as established background and build on it without restating it. Continue the task directly from the messages that follow, without acknowledging this checkpoint.";
/**
* Run the default cache-reusing `ctx.llm.stream()` summarization call: replay
* the conversation prefix, then append the compaction instruction as the final
* user message so the provider's warm prefix cache is reused.
* @param ctx - context providing the LLM service.
* @param config - resolved backend configuration.
* @param input - replayed conversation prefix (system, tools, and leading messages) to condense.
* @param agent - supplies routed-model history, fallback model, and session id.
* @param signal - optional cancellation forwarded to the adapter.
* @returns safe text-only summary blocks and the exact call envelope and output.
*/
async function summarizeWithLlm(ctx, config, input, agent, signal) {
	const latest = agent.session.requestHeader()?.config;
	const configured = config.summarizationProvider.length === 0 ? void 0 : {
		provider: config.summarizationProvider,
		model: config.summarizationModel
	};
	const agentTarget = agent.options.provider !== void 0 && agent.options.provider.length > 0 && agent.options.model !== void 0 && agent.options.model.length > 0 ? {
		provider: agent.options.provider,
		model: agent.options.model
	} : void 0;
	const target = configured ?? latest ?? agentTarget;
	if (target === void 0) throw new Error("no provider/model available for summarization: set both BasicCompactionConfig summarization fields, route one request, or set both AgentOptions fields");
	const assembler = new BlockAssembler();
	const messages = [...input.messages, deepFreeze({
		role: "user",
		content: [{
			type: "text",
			text: COMPACTION_INSTRUCTION
		}]
	})];
	const options = {
		provider: target.provider,
		model: target.model,
		messages,
		toolHistory: agent.session.toolHistory(),
		...input.tools === void 0 ? {} : { tools: [...input.tools] },
		maxTokens: config.maxTokens,
		sessionId: agent.session.id,
		purpose: "compaction",
		...signal === void 0 ? {} : { signal }
	};
	for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk);
	const error = finishError(assembler.finish);
	if (error !== void 0) throw error;
	const rawOutput = assembler.blocks();
	const summary = summaryText(rawOutput);
	if (!summary.some((block) => block.text.trim().length > 0)) throw new Error("summarization produced no text summary content");
	return {
		summary,
		rawOutput,
		llmStreamCall: true,
		provider: options.provider,
		model: options.model,
		maxTokens: config.maxTokens,
		...assembler.usage === void 0 ? {} : { usage: assembler.usage }
	};
}
/**
* Wrap raw summary blocks in the durable checkpoint framing.
* @param summary - safe text-only model output.
* @returns content for the synthesized replacement user message.
*/
function frameSummary(summary) {
	return [
		{
			type: "text",
			text: `${CHECKPOINT_PREAMBLE}\n\n${SUMMARY_OPEN_TAG}`
		},
		...summary,
		{
			type: "text",
			text: SUMMARY_CLOSE_TAG
		}
	];
}
/** Map a terminal summarization finish to its fail-closed error. */
function finishError(finish) {
	switch (finish.kind) {
		case "error":
		case "aborted": return new LlmError(finish.failure.message, finish.failure.code, finish.failure);
		case "max-tokens": {
			const error = /* @__PURE__ */ new Error("summarization truncated at the token cap (incomplete checkpoint)");
			error.code = "MAX_TOKENS";
			return error;
		}
		default: return;
	}
}
/** Reject visual output and keep only text before synthesizing a user message. */
function summaryText(blocks) {
	if (contentHasImage(blocks)) throw new LlmError("compaction summary cannot contain image output", "UNSUPPORTED_CONTENT");
	return blocks.filter((block) => block.type === "text");
}
//#endregion

export {};
