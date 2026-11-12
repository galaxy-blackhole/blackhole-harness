/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/retention.js
		/** A stream acknowledgement gates output attachment for each physical connection. */
		var TerminalWindowHold = class {
			stream;
			waiters = /* @__PURE__ */ new Set();
			generation;
			failure;
			/**
			* @param gateway - reconnecting stream owner.
			* @param remote - typed terminal namespace.
			* @param sessionId - saved layout's Session, without Agent activation.
			* @param id - existing Host terminal.
			*/
			constructor(gateway, remote, sessionId, id) {
				this.stream = gateway.$stream({
					name: "Browser terminal window hold",
					open: (signal) => remote.retain(sessionId, id, signal),
					ended: () => new RemoteError("terminal/unavailable", "Terminal hold ended", {})
				});
				this.consume();
			}
			/** Whether a terminal-domain failure ended this hold, allowing an explicit retry. */
			get failed() {
				return this.failure !== void 0;
			}
			/**
			* Wait for an acknowledged current physical hold before following its screen.
			* @param signal - output request or view lifetime.
			* @returns after acknowledgement, or rejects on cancellation/unavailability.
			*/
			async ready(signal) {
				signal.throwIfAborted();
				if (this.failure !== void 0) throw this.failure;
				if (this.generation !== void 0 && !this.generation.aborted) return;
				const waiting = Promise.withResolvers();
				const abort = () => {
					waiting.reject(signal.reason);
				};
				this.waiters.add(waiting);
				signal.addEventListener("abort", abort, { once: true });
				try {
					await waiting.promise;
				} finally {
					this.waiters.delete(waiting);
					signal.removeEventListener("abort", abort);
				}
			}
			/**
			* Release this window's stream and all acknowledgement waiters.
			* @returns after the stream consumer closes.
			*/
			dispose() {
				this.reject(/* @__PURE__ */ new Error("Terminal window hold released"));
				return this.stream.dispose();
			}
			async consume() {
				try {
					for await (const item of this.stream) {
						item.accept();
						this.generation = item.signal;
						for (const waiter of this.waiters) waiter.resolve();
						this.waiters.clear();
					}
				} catch (error) {
					this.reject(error);
				}
			}
			reject(error) {
				this.failure = error instanceof Error ? error : new Error("Terminal window hold failed", { cause: error });
				this.generation = void 0;
				for (const waiter of this.waiters) waiter.reject(error);
				this.waiters.clear();
			}
		};
		//#endregion

export {};
