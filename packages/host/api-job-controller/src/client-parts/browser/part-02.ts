/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/service.js
		/**
		* The `ctx.jobs` client service: reference-counted streams over the `job`
		* namespace — one `job.list` roster stream per watched session and one
		* `job.follow` stream per observed job — so overlapping viewers share a
		* stream, rosters resume whole after a reconnect, and observations resume
		* from the model's cursor, plus the human kill passthrough over `job.kill`.
		* @module @deepseek-ai/dsh-api-job-controller/client/service
		*/
		/** Owns the bare jobs snapshot and the per-session and per-job streams. */
		var ClientJobs = class extends _deepseek_ai_cordis.Service {
			remote;
			model;
			state;
			rowsEntries = /* @__PURE__ */ new Map();
			observations = /* @__PURE__ */ new Map();
			/**
			* @param ctx - client root Context.
			* @param remote - the Gateway stream factory plus the generated `job` namespace, both resolved by the caller.
			* @param model - shared client jobs model.
			*/
			constructor(ctx, remote, model) {
				super(ctx, "jobs");
				this.remote = remote;
				this.model = model;
				this.state = model;
				ctx.effect(() => async () => {
					const open = [...this.rowsEntries.values(), ...this.observations.values()];
					this.rowsEntries.clear();
					this.observations.clear();
					for (const entry of open) entry.stopped = true;
					await Promise.allSettled(open.map((entry) => entry.dispose()));
				}, "job-controller.client.streams");
			}
			kill(sessionId, id) {
				return this.remote.job.kill({
					sessionId,
					jobId: id
				});
			}
			watchRows(sessionId) {
				return this.acquire(this.rowsEntries, String(sessionId), () => this.startRows(sessionId), () => {
					this.model.rowsDropped(sessionId);
				});
			}
			observe(sessionId, id) {
				return this.acquire(this.observations, String(id), () => this.startObservation(sessionId, id), () => {
					this.model.observeStopped(id);
				});
			}
			/** Share the live entry under `key` or start one, and hand back its release. */
			acquire(entries, key, start, cleared) {
				const existing = entries.get(key);
				if (existing !== void 0 && !existing.stopped) {
					existing.refs += 1;
					return this.releaser(entries, key, existing, cleared);
				}
				const entry = start();
				entries.set(key, entry);
				return this.releaser(entries, key, entry, cleared);
			}
			/**
			* Release closures bind the exact entry they were minted for, never the
			* map's current occupant: a later acquire on the same key may have replaced
			* a stopped entry, and decrementing or disposing through the key alone
			* would tear down that newer stream's references.
			*/
			releaser(entries, key, entry, cleared) {
				let released = false;
				return () => {
					if (released) return;
					released = true;
					entry.refs -= 1;
					if (entry.refs > 0) return;
					if (entries.get(key) === entry) entries.delete(key);
					entry.stopped = true;
					entry.dispose().then(() => {
						if (entries.has(key)) return;
						cleared();
					});
				};
			}
			startRows(sessionId) {
				const name = `job rows ${String(sessionId)}`;
				const stream = this.remote.$stream({
					name,
					open: (signal) => this.remote.job.list({ sessionId }, signal),
					ended: (accepted) => accepted ? new _deepseek_ai_dsh_api_gateway_client.RemoteStreamCarrierError(`${name} ended before release`) : /* @__PURE__ */ new Error(`${name} ended before its first frame`)
				});
				const entry = {
					refs: 1,
					stopped: false,
					dispose: () => stream.dispose()
				};
				(async () => {
					try {
						for await (const item of stream) {
							this.model.rowsReplaced(sessionId, item.value.jobs);
							item.accept();
						}
					} catch {
						if (!entry.stopped) this.model.rowsDropped(sessionId);
					} finally {
						entry.stopped = true;
						entry.dispose();
					}
				})();
				return entry;
			}
			startObservation(sessionId, id) {
				const name = `job observation ${String(id)}`;
				const stream = this.remote.$stream({
					name,
					open: (signal) => {
						const from = this.model.cursorOf(id);
						return this.remote.job.follow({
							jobId: id,
							...sessionId !== void 0 ? { sessionId } : {},
							...from !== void 0 ? { from } : {}
						}, signal);
					},
					ended: (accepted) => accepted ? new _deepseek_ai_dsh_api_gateway_client.RemoteStreamCarrierError(`${name} ended before settlement`) : /* @__PURE__ */ new Error(`${name} ended before its anchor`)
				});
				const entry = {
					refs: 1,
					stopped: false,
					dispose: () => stream.dispose()
				};
				(async () => {
					try {
						for await (const item of stream) {
							const frame = item.value;
							if (frame.type === "opened") {
								this.model.observeOpened(id, frame);
								item.accept();
								continue;
							}
							if (frame.type === "output") {
								this.model.observeOutput(id, frame);
								continue;
							}
							this.model.observeSettled(id);
							break;
						}
					} catch (error) {
						if (!entry.stopped) this.model.observeFailed(id, error);
					} finally {
						entry.stopped = true;
						entry.dispose();
					}
				})();
				return entry;
			}
		};
		//#endregion

export {};
