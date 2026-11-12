/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/scope.js
		/** Client scope generations route local events independently of Host Agent residency. */
		/** Context tag written by {@link createScope}. */
		const kScope = Symbol("dsh.client.scope");
		/** Shared no-op plugin backing each Agent scope fiber. */
		function agentScope() {}
		/**
		* Mint an Agent scope under `ctx`: a no-op plugin fiber whose context
		* carries the agent tag and the dispatch filter — untagged listeners are
		* admitted globally, tagged listeners only for the same Client generation.
		* Registrations through the returned ctx dispose with the fiber.
		* @param ctx - client root context the scope fiber mounts under.
		* @param key - durable Session identity carried by this generation.
		* @returns the tagged context and its backing fiber.
		*/
		function createScope(ctx, key) {
			const fiber = ctx.plugin(agentScope);
			const identity = { sessionId: key };
			return {
				fiber,
				ctx: fiber.ctx.extend({
					[kScope]: identity,
					[_deepseek_ai_cordis.Context.filter](listenerCtx) {
						const tag = scopeIdentityOf(listenerCtx);
						return tag === void 0 || tag === identity;
					}
				})
			};
		}
		/**
		* Read the nearest agent tag inherited by a context.
		* @param ctx - any client context.
		* @returns its agent identity (the session id), or undefined for root contexts.
		*/
		function scopeOf(ctx) {
			return scopeIdentityOf(ctx)?.sessionId;
		}
		/**
		* Read the exact generation identity inherited by a Client Context.
		* @param ctx - scoped or root Client Context.
		* @returns the generation identity, or undefined for an unscoped Context.
		*/
		function scopeIdentityOf(ctx) {
			return ctx[kScope];
		}
		//#endregion

export {};
