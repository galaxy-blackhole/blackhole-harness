/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-tool-session-query — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/index.js
/**
* Model-facing, workspace-authorized session-history search and read tools.
*
* @module @deepseek-ai/dsh-tool-session-query
*/
/** Cordis plugin name used by Loader diagnostics. */
const name = "tool-session-query";
/** Capability services required by the model-facing consumer. */
const inject = [
	"tools",
	"systemPrompt",
	"sessionQuery",
	"sessionProjections"
];
/** Default maximum number of authorized search hits returned by one call. */
const DEFAULT_MAX_SEARCH_RESULTS = 100;
/** Default cooperative deadline for either full-text search tool. */
const DEFAULT_SEARCH_TIMEOUT_MS = 3e4;
/** Schemastery config for Loader defaults and generated configuration docs. */
const Config = z.object({
	maxSearchResults: z.number().step(1).min(1).default(100),
	searchTimeoutMs: z.number().step(1).min(1).max(MAX_TIMER_DELAY_MS).default(DEFAULT_SEARCH_TIMEOUT_MS)
});
const TEXT_OUTPUT = {
	schema: { type: "string" },
	render: (_args, value) => [{
		type: "text",
		text: value
	}]
};
const PROMPT_TEXT = "Use session_search to find relevant work from prior sessions, or session_event_search to search earlier events in one session. Search results are cursor-free and workspace-scoped. Follow a useful hit with session_trace, session_event_trace, or session_event_read when you need lineage, relationships, or exact data.";
/** Register all five tools and their shared model guidance. */
function apply(ctx, config) {
	const resolved = resolveConfig(config);
	ctx.systemPrompt.section({
		name: "tool:session-query",
		order: ctx.systemPrompt.getSectionOrder("TOOL_SESSION_QUERY"),
		text: PROMPT_TEXT
	});
	ctx.tools.register(defineTool({
		name: "session_search",
		description: "Search prior sessions in the caller workspace and return the strongest matching event from each session.",
		parameters: toolInput.sessionSearchParameters,
		output: TEXT_OUTPUT,
		timeoutMs: resolved.searchTimeoutMs,
		execute: (args, exec) => operations.executeSessionSearch(ctx, args, exec, resolved.maxSearchResults),
		presentCall: presentation.presentSessionSearchCall
	}));
	ctx.tools.register(defineTool({
		name: "session_event_search",
		description: "Search prior events in one authorized session; the current session excludes the step performing this call.",
		parameters: toolInput.eventSearchParameters,
		output: TEXT_OUTPUT,
		timeoutMs: resolved.searchTimeoutMs,
		execute: (args, exec) => operations.executeEventSearch(ctx, args, exec, resolved.maxSearchResults),
		presentCall: presentation.presentEventSearchCall
	}));
	ctx.tools.register(defineTool({
		name: "session_trace",
		description: "Read the authorized session lineage around one session, including complete visible ancestor and descendant relationships.",
		parameters: toolInput.targetSessionParameter,
		output: TEXT_OUTPUT,
		isConcurrencySafe: () => true,
		execute: (args, exec) => operations.executeSessionTrace(ctx, args, exec),
		presentCall: presentation.presentSessionTraceCall
	}));
	ctx.tools.register(defineTool({
		name: "session_event_trace",
		description: "Read every direct replacement and relationship to a cited source event for one event in an authorized session.",
		parameters: {
			...toolInput.targetSessionParameter,
			seq: {
				type: "integer",
				required: true,
				description: "Target event sequence number."
			}
		},
		output: TEXT_OUTPUT,
		isConcurrencySafe: () => true,
		execute: (args, exec) => operations.executeEventTrace(ctx, args, exec),
		presentCall: (args) => presentation.presentEventTargetCall("Trace event", args)
	}));
	ctx.tools.register(defineTool({
		name: "session_event_read",
		description: "Read one full unabridged event and optional neighboring raw-event summaries from an authorized session.",
		parameters: {
			...toolInput.targetSessionParameter,
			seq: {
				type: "integer",
				required: true,
				description: "Target event sequence number."
			},
			before: {
				type: "integer",
				description: "Number of preceding raw events to summarize. Omit for none."
			},
			after: {
				type: "integer",
				description: "Number of following raw events to summarize. Omit for none."
			}
		},
		output: TEXT_OUTPUT,
		isConcurrencySafe: () => true,
		execute: (args, exec) => operations.executeEventRead(ctx, args, exec),
		presentCall: (args) => presentation.presentEventTargetCall("Read event", args)
	}));
}
function resolveConfig(config) {
	const maxSearchResults = config.maxSearchResults ?? 100;
	const searchTimeoutMs = config.searchTimeoutMs ?? 3e4;
	if (!Number.isSafeInteger(maxSearchResults) || maxSearchResults < 1) throw new TypeError("tool-session-query: maxSearchResults must be a positive safe integer");
	if (!Number.isInteger(searchTimeoutMs) || searchTimeoutMs < 1 || searchTimeoutMs > MAX_TIMER_DELAY_MS) throw new TypeError(`tool-session-query: searchTimeoutMs must be a positive integer no greater than ${MAX_TIMER_DELAY_MS}`);
	return {
		maxSearchResults,
		searchTimeoutMs
	};
}
//#endregion

export {};
