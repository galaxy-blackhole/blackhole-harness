/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN 2/2 của bundle @deepseek-ai/dsh-tool-cordis: region index.js (name/inject/requireAgent/apply đăng ký 2 tool) + dòng export cuối
 */
// @ts-nocheck

//#region lib/types/index.js
const name = "tool-cordis";
const inject = ["tools", "cordisInspect"];
function requireAgent(exec) {
	if (exec.agent === void 0) throw new Error("Cordis inspection requires an Agent-backed session");
	return exec.agent;
}
/** Register read-only runtime inspection tools over the Host providers that
* `@deepseek-ai/dsh-tool-cordis/host` registers once per process.
* @param ctx Agent-scoped registration context.
*/
function apply(ctx) {
	ctx.tools.register(defineTool({
		name: "cordis_inspect_list",
		description: "List every Cordis Inspect Provider currently known to the Host, including local Host Providers and the latest manifests synchronized from the Client. Each entry includes its platform, purpose, read-only methods, and input/output schemas. Call this Tool before writing or configuring a plugin, then select the provider and method for cordis_inspect_query from its result. Do not guess names or treat an Inspect method as a business Service that Plugin code can call.",
		parameters: {},
		output: {
			schema: { type: "json" },
			render: (_args, value) => [{
				type: "text",
				text: JSON.stringify(value, null, 2)
			}]
		},
		execute(_args, _exec) {
			return Promise.resolve({ providers: ctx.cordisInspect.list() });
		},
		presentCall: presentInspectListCall
	}));
	ctx.tools.register(defineTool({
		name: "cordis_inspect_query",
		description: "Run a read-only query declared by an Inspect Provider. platform, provider, and method must come from cordis_inspect_list, and input must satisfy that method's schema. Use this Tool before writing plugin code to read exact Service methods, Event modes, plugin Config schemas, Tool schemas, theme tokens, or live Slot trees and props. Host queries run locally. A Client query waits for the first valid page response within the configured timeout; otherwise it reports a Client failure or asks you to reconnect and retry. This Tool cannot invoke business Service methods or modify the runtime.",
		parameters: {
			platform: {
				type: "string",
				required: true,
				enum: ["host", "client"],
				description: "Runtime platform that owns the Provider."
			},
			provider: {
				type: "string",
				required: true,
				description: "Exact Provider ID returned by cordis_inspect_list."
			},
			method: {
				type: "string",
				required: true,
				description: "Exact method name declared by the Provider manifest."
			},
			input: {
				type: "json",
				description: "Optional query input; it must satisfy the method input schema."
			}
		},
		output: {
			schema: { type: "json" },
			render: (_args, value) => [{
				type: "text",
				text: JSON.stringify(value, null, 2)
			}]
		},
		async execute(args, exec) {
			const data = await ctx.cordisInspect.query(args.platform, args.provider, args.method, args.input, requireAgent(exec), exec.signal);
			return {
				platform: args.platform,
				provider: args.provider,
				method: args.method,
				data
			};
		},
		presentCall: presentInspectQueryCall
	}));
}
//#endregion
export { apply, inject, name };


export {};
