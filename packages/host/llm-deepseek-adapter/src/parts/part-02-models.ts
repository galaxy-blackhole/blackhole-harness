/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/models.js
/** Default DeepSeek model catalog. */
/** Advisory official model entries; deployments may replace the catalog. */
const DEFAULT_MODELS = [{
	id: "deepseek-flash",
	name: "DeepSeek-V4.1-Flash",
	contextWindow: DEFAULT_CONTEXT_WINDOW,
	inputModalities: ["text", "image"],
	systemPromptUpdate: "in-history",
	toolUpdate: "addition-only"
}, {
	id: "deepseek-v4-pro",
	name: "DeepSeek-V4-Pro",
	description: "Stronger agentic coding, knowledge, and difficult reasoning; suited to complex or quality-critical tasks at higher cost.",
	contextWindow: DEFAULT_CONTEXT_WINDOW
}];
//#endregion

export {};
