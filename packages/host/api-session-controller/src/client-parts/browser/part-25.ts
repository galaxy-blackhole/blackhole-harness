/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/index.js
		/** Client Session object layer, Agent scopes, and Remote lifecycle wiring. */
		/** Required Remote and Context projection services. */
		const inject = [
			"connection",
			"fileUpload",
			"typert",
			"remote",
			"remote.commands",
			"remote.session",
			"remote.subagents"
		];
		/**
		* Install Client Session state and its reconnecting control stream.
		* @param ctx - Client Cordis context.
		*/
		function apply(ctx) {
			const remotes = ctx.remote;
			const connection = ctx.get("connection");
			const sessions = new ClientSessions(ctx, remotes);
			ctx.remote.$on("api-session/added", (summary) => {
				sessions.handleSessionAdded(summary);
			});
			ctx.remote.$on("api-session/removed", (sessionId) => {
				sessions.handleSessionRemoved(sessionId);
			});
			ctx.remote.$on("api-session/status", (sessionId, running) => {
				sessions.handleSessionStatus(sessionId, running);
			});
			ctx.remote.$on("api-session/activity", (sessionId, updatedAt) => {
				sessions.handleSessionActivity(sessionId, updatedAt);
			});
			ctx.remote.$on("api-session/error", (sessionId, message) => {
				sessions.handleSessionError(sessionId, message);
			});
			const control = createSessionControlStream(remotes, {
				accept: (frame) => {
					sessions.handleControlFrame(frame);
				},
				failed: (error) => {
					console.error("[session-controller] control stream failed:", error);
				}
			});
			const connected = () => {
				if (connection.generation.getSnapshot() === void 0) return;
				sessions.handleConnected();
				control.restart();
				control.start();
			};
			ctx.effect(() => connection.generation.subscribe(connected), "session-controller.client.generation");
			connected();
			ctx.typert.contexts.registerClient("agent", {
				identity: (candidate) => sessions.sessionOf(candidate)?.sessionId,
				resolve: (sessionId) => {
					const reference = sessions.retainAgentScope(sessionId);
					return typertOwnedValue(reference.binding.ctx, () => {
						reference.release();
					});
				}
			});
			ctx.effect(() => async () => {
				await control.dispose();
			}, "session-controller.client.control");
		}
		//#endregion

export {};
