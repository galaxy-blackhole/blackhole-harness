/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/host.js
/**
* Register one provider with request-local transport services and live retry policy.
* @param ctx - provider plugin lifetime with the LLM registry injected.
* @param provider - exact route owned by this plugin.
* @param dependencies - provider-owned discovery, credential, and configuration callbacks.
*/
function registerDeepSeekProvider(ctx, provider, dependencies) {
	ctx.inject(["settings"], (child) => {
		child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
	});
	let userId;
	const degradedReplays = /* @__PURE__ */ new Set();
	const omittedRoutes = /* @__PURE__ */ new Set();
	const unacceptedRoutes = /* @__PURE__ */ new Set();
	const adapter = new DeepSeekAdapter({
		...dependencies,
		resolveUserId: () => userId ??= getOrCreateAnonymousUserId(),
		onReplayDegrade: ({ provider, model, reason }) => {
			const key = `${provider}/${model}\u0000${reason}`;
			if (degradedReplays.has(key)) return;
			degradedReplays.add(key);
			ctx.logger.warn(`llm-deepseek: unusable Messages replay state on assistant history for route "${provider}/${model}"; sending provider-neutral content (${reason})`);
		},
		onExtensionsOmitted: ({ provider, model, fields, error }) => {
			const route = `${provider}/${model}`;
			if (omittedRoutes.has(route)) return;
			omittedRoutes.add(route);
			ctx.logger.warn(`llm-deepseek: sending route "${route}" without request extension fields ${fields.join(", ")} because they failed to serialize: %o`, error);
		},
		onExtensionsUnaccepted: ({ provider, model, error }) => {
			const route = `${provider}/${model}`;
			if (unacceptedRoutes.has(route)) return;
			unacceptedRoutes.add(route);
			ctx.logger.warn(`llm-deepseek: route "${route}" request extension acceptance failed; contributors resend on a later request: %o`, error);
		},
		resolveAttachments: () => ctx.get("attachments"),
		resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(attachments, (hostPath) => ctx.get("fs")?.processPathFromHostPath(hostPath), ref),
		prepareExtensions: (request) => ctx.get("deepseekLlmApiExtensions")?.prepare(request) ?? Promise.resolve({
			fields: {},
			accept: () => Promise.resolve()
		})
	});
	const registration = ctx.llm.registerAdapter([provider], adapter);
	let registeredPolicy = dependencies.options().retryPolicy;
	ctx.on("loader/volatile-update", () => {
		let policy;
		try {
			policy = dependencies.options().retryPolicy;
		} catch (error) {
			ctx.logger.warn(error);
			return;
		}
		if (deepEqualJson(policy, registeredPolicy)) return;
		registration.replace([provider]);
		registeredPolicy = policy;
	});
}
//#endregion

export {};
