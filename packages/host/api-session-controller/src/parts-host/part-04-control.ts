/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-session-controller — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/control.js
/** Live Session projection state with reconnect baselines. */
/** Owns the Host-wide Session control stream. */
var SessionControlController = class {
	ctx;
	streams = /* @__PURE__ */ new Set();
	/** @param ctx - Host context carrying live Agent and projection services. */
	constructor(ctx) {
		this.ctx = ctx;
		ctx.sessionProjections.onChanged((session, key, value, seq) => {
			this.broadcast({
				type: "projection",
				sessionId: session.id,
				key,
				value,
				seq
			});
		});
		ctx.effect(() => () => {
			for (const stream of this.streams) stream.end();
			this.streams.clear();
		}, "session-controller.control");
	}
	/**
	* Open one generation of Host-wide live control state.
	* @param signal - Remote stream cancellation.
	* @returns one complete baseline followed by live replacement frames.
	*/
	async *control(signal) {
		signal.throwIfAborted();
		const queue = new ControlQueue();
		this.streams.add(queue);
		try {
			yield {
				type: "baseline",
				value: this.baseline()
			};
			yield* queue.iterate(signal);
		} finally {
			this.streams.delete(queue);
			queue.end();
		}
	}
	baseline() {
		const sessions = this.ctx.sessions.list();
		return { projections: this.projectionBaseline(sessions) };
	}
	projectionBaseline(sessions) {
		const blocks = Object.create(null);
		for (const session of sessions) {
			const snapshot = this.ctx.sessionProjections.snapshot(session);
			blocks[session.id] = {
				asOfSeq: snapshot.asOfSeq,
				values: snapshot.values
			};
		}
		return blocks;
	}
	broadcast(frame) {
		for (const stream of this.streams) stream.push(frame);
	}
};
var ControlQueue = class {
	buffer = new Deque();
	wake;
	done = false;
	push(frame) {
		if (this.done) return;
		this.buffer.pushBack(frame);
		const wake = this.wake;
		this.wake = void 0;
		wake?.();
	}
	end() {
		if (this.done) return;
		this.done = true;
		const wake = this.wake;
		this.wake = void 0;
		wake?.();
	}
	async *iterate(signal) {
		const onAbort = () => {
			this.end();
		};
		signal.addEventListener("abort", onAbort, { once: true });
		try {
			while (!this.done && !signal.aborted) {
				const frame = this.buffer.popFront();
				if (frame !== void 0) {
					yield frame;
					continue;
				}
				await new Promise((resolve) => {
					this.wake = resolve;
				});
			}
			while (this.buffer.size > 0 && !signal.aborted) yield this.buffer.popFront();
		} finally {
			signal.removeEventListener("abort", onAbort);
			this.end();
		}
	}
};
//#endregion

export {};
