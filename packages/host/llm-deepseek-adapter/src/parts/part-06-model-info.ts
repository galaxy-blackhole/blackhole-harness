/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/model-info.js
/** Protocol-independent model capabilities and reasoning choices. */
const OFF_REASONING_EFFORT = ReasoningEffortId("off");
const LOW_REASONING_EFFORT = ReasoningEffortId("low");
const HIGH_REASONING_EFFORT = ReasoningEffortId("high");
const MAX_REASONING_EFFORT = ReasoningEffortId("max");
const REASONING_EFFORTS = [
	{
		id: OFF_REASONING_EFFORT,
		name: "Off",
		description: "Use for simple tasks that do not need reasoning."
	},
	{
		id: LOW_REASONING_EFFORT,
		name: "Low",
		description: "Prefer for routine or latency-sensitive tasks."
	},
	{
		id: HIGH_REASONING_EFFORT,
		name: "High",
		description: "The default balance for most tasks."
	},
	{
		id: MAX_REASONING_EFFORT,
		name: "Max",
		description: "Reserve for the hardest quality-first tasks."
	}
];
const OFF_ONLY_REASONING_EFFORTS = [{
	id: OFF_REASONING_EFFORT,
	name: "Off",
	description: "Use for simple tasks that do not need reasoning."
}];
/** Advertise one catalog entry.
* @param provider - registered provider id.
* @param model - advisory catalog entry.
* @returns selector metadata.
*/
function catalogModelInfo(provider, model) {
	return {
		provider,
		id: model.id,
		name: model.name ?? model.id,
		...model.description === void 0 ? {} : { description: model.description },
		inputModalities: model.inputModalities ?? ["text"]
	};
}
/** Resolve model capabilities against one configuration generation.
* @param connection - validated connection facts.
* @param provider - registered provider id.
* @param model - requested wire model id.
* @returns effective model metadata for this operation.
*/
function modelInfo(connection, provider, model) {
	const configured = connection.models.find((entry) => entry.id === model);
	const contextWindow = configured?.contextWindow ?? connection.defaultContextWindow;
	return {
		...configured === void 0 ? {
			provider,
			id: model,
			name: model,
			inputModalities: ["text"]
		} : catalogModelInfo(provider, configured),
		context: { contextWindow },
		defaultMaxTokens: configured?.maxTokens ?? connection.maxTokens,
		...configured?.systemPromptUpdate === void 0 ? {} : { systemPromptUpdate: configured.systemPromptUpdate },
		...configured?.toolUpdate === void 0 ? {} : { toolUpdate: configured.toolUpdate },
		...connection.defaults.thinking === "disabled" ? { reasoning: {
			efforts: OFF_ONLY_REASONING_EFFORTS,
			defaultEffort: OFF_REASONING_EFFORT
		} } : { reasoning: {
			efforts: REASONING_EFFORTS,
			defaultEffort: connection.defaults.reasoningEffort === "off" ? OFF_REASONING_EFFORT : connection.defaults.reasoningEffort === "low" ? LOW_REASONING_EFFORT : connection.defaults.reasoningEffort === "max" ? MAX_REASONING_EFFORT : HIGH_REASONING_EFFORT
		} }
	};
}
//#endregion

export {};
