/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-terminal-controller — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/retention.js
/** Window holds and conservative idle reclamation for one terminal owner. */
/** Exactly one owner orders holds, observation, and retryable process cleanup. */
var TerminalRetention = class {
	policy;
	inspect;
	terminate;
	failed;
	lifetime = new AbortController();
	holders = /* @__PURE__ */ new Set();
	epoch = 0;
	timer;
	observation;
	idle;
	closing = false;
	disposed = false;
	cleanup;
	/**
	* @param policy - deployment timing choices.
	* @param inspect - fresh shell and owned-job observation.
	* @param terminate - mark the identity closed, await process quiescence, and remove its owner record.
	* @param failed - diagnostic sink for failed automatic cleanup.
	*/
	constructor(policy, inspect, terminate, failed) {
		this.policy = policy;
		this.inspect = inspect;
		this.terminate = terminate;
		this.failed = failed;
		this.schedule(0);
	}
	/**
	* Hold one terminal for one physical Remote stream, independently of screen subscriptions.
	* @param signal - transport generation lifetime.
	* @returns acknowledgement followed by an open stream until cancellation or terminal closure.
	*/
	async *retain(signal) {
		signal.throwIfAborted();
		if (this.closing || this.disposed) throw new RemoteError("terminal/unavailable", "Terminal is closing or unavailable", {});
		const holder = {};
		const ended = Promise.withResolvers();
		const combined = AbortSignal.any([signal, this.lifetime.signal]);
		const release = () => {
			if (!this.holders.delete(holder)) return;
			combined.removeEventListener("abort", release);
			this.invalidate();
			ended.resolve();
			this.schedule(0);
		};
		this.holders.add(holder);
		this.invalidate();
		this.cancelTimer();
		combined.addEventListener("abort", release, { once: true });
		try {
			yield { type: "retained" };
			await ended.promise;
		} finally {
			release();
		}
	}
	/** Invalidate outstanding idle observations before accepting input. */
	invalidate() {
		this.epoch++;
		this.idle = void 0;
	}
	/**
	* Start or join cleanup; failure keeps the identity closed and schedules one retry.
	* @returns after owned process cleanup succeeds, or rejects with its failure.
	*/
	close() {
		if (this.cleanup !== void 0) return this.cleanup;
		this.closing = true;
		this.invalidate();
		this.lifetime.abort(/* @__PURE__ */ new Error("Terminal closed"));
		this.cancelTimer();
		this.cleanup = this.terminate().catch((error) => {
			this.cleanup = void 0;
			this.schedule(this.policy.cleanupRetryMs);
			throw error;
		});
		return this.cleanup;
	}
	/**
	* Stop timers and streams and await both observation and final cleanup.
	* @returns after process quiescence; cleanup failure is reported to the disposing owner.
	*/
	async dispose() {
		this.disposed = true;
		this.cancelTimer();
		const observation = this.observation;
		try {
			await this.close();
		} finally {
			await observation;
		}
	}
	cancelTimer() {
		clearTimeout(this.timer);
		this.timer = void 0;
	}
	schedule(delay) {
		if (this.disposed || this.timer !== void 0) return;
		if (!this.closing && (this.holders.size > 0 || this.policy.unattendedTimeoutMs === 0)) return;
		const due = performance.now() + delay;
		this.timer = setTimeout(() => {
			this.timer = void 0;
			const remaining = due - performance.now();
			if (remaining > 0) {
				this.schedule(remaining);
				return;
			}
			if (this.closing) {
				this.close().catch(this.failed);
				return;
			}
			this.observe();
		}, Math.min(delay, 2147483647));
		this.timer.unref();
	}
	observe() {
		if (this.observation !== void 0) return;
		const epoch = this.epoch;
		this.observation = (async () => {
			let activity;
			try {
				activity = await this.inspect();
			} catch (_activityUnavailable) {
				activity = {
					state: "unknown",
					revision: 0
				};
			}
			if (this.disposed || this.closing || this.holders.size > 0 || epoch !== this.epoch) return;
			const now = performance.now();
			if (activity.state !== "idle") {
				this.idle = void 0;
				return;
			}
			if (this.idle?.revision !== activity.revision || now - this.idle.observedAt > this.policy.activityPollIntervalMs * 2) this.idle = {
				since: now,
				observedAt: now,
				revision: activity.revision
			};
			else this.idle.observedAt = now;
			if (now - this.idle.since >= this.policy.unattendedTimeoutMs) await this.close();
		})().catch(this.failed).finally(() => {
			this.observation = void 0;
			if (!this.closing) this.schedule(this.policy.activityPollIntervalMs);
		});
	}
};
//#endregion

export {};
