/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-session-controller — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/changes.js
/**
* Target-scoped filesystem watches and `fs/observed` invalidations for `changes`.
* Each generation sends `ready` after watcher initialization, then reads current
* target metadata for matching queued and live invalidations.
*/
/** Owns target watches, instrumented observations, and every open `changes` generation. */
var WorkspaceChangeFeed = class {
	ctx;
	followers = /* @__PURE__ */ new Set();
	/** @param ctx - Host context carrying the filesystem the observations come from. */
	constructor(ctx) {
		this.ctx = ctx;
		ctx.on("fs/observed", (target, observation) => {
			for (const follower of this.followers) follower.push([target, observation]);
		});
		ctx.effect(() => async () => {
			const followers = [...this.followers];
			await Promise.all(followers.map((follower) => follower.close()));
			this.followers.clear();
		}, "workspace-files.changes");
	}
	/**
	* Open one target watch; directory targets remain inside `workspaceRoot`.
	* @param workspaceRoot - the session's workspace root path.
	* @param path - target path, resolved relative to the workspace root; Host metadata determines its type.
	* @param signal - generation cancellation.
	* @returns `ready` after watching starts, then current metadata for target invalidations.
	*/
	async *follow(workspaceRoot, path, signal) {
		signal.throwIfAborted();
		const follower = new ChangeFollower(() => {
			signal.removeEventListener("abort", cancel);
			this.followers.delete(follower);
		});
		signal = AbortSignal.any([signal, follower.controller.signal]);
		const aborted = () => signal.aborted;
		const cancel = () => {
			follower.close().catch((error) => {
				this.ctx.logger.error(error);
			});
		};
		signal.addEventListener("abort", cancel, { once: true });
		this.followers.add(follower);
		let unwatch;
		try {
			const root = await this.ctx.fs.resolve(workspaceRoot, { signal }).catch((error) => {
				if (aborted()) return void 0;
				throw error;
			});
			if (root === void 0 || aborted() || follower.isClosed) return;
			const target = await this.ctx.fs.resolve(path, {
				cwd: workspaceRoot,
				signal
			}).catch((error) => {
				if (aborted()) return void 0;
				throw error;
			});
			if (target === void 0 || aborted()) return;
			const stat = async () => {
				const info = await this.ctx.fs.stat(target, signal).catch((error) => {
					if (aborted()) return void 0;
					throw error;
				});
				if (info?.type === "directory" && !this.ctx.fs.contains(root, target)) throw new RemoteError("workspace-file/outside-workspace", "Directory is outside the workspace", { path });
				return info;
			};
			await stat();
			if (aborted()) return;
			try {
				unwatch = await this.ctx.fs.watch(target, (error) => {
					if (error !== void 0) follower.fail(error);
					else if (!follower.isClosed) follower.push([target]);
				}, signal);
				if (follower.error !== void 0) throw follower.error;
			} catch (error) {
				if (aborted() && follower.error === void 0) return;
				const failure = follower.error ?? error;
				throw new RemoteError("workspace-file/watch-unsupported", failure instanceof Error ? failure.message : String(failure), { path });
			}
			follower.initialized.resolve(unwatch);
			if (aborted()) return;
			yield { kind: "ready" };
			for await (const [observed] of follower.read()) {
				if (observed.targetKey !== target.targetKey) continue;
				const info = await stat();
				if (aborted()) return;
				const absolutePath = this.ctx.fs.processPath(target);
				yield {
					kind: "change",
					change: info !== void 0 ? {
						absolutePath,
						version: info.version
					} : {
						absolutePath,
						absent: true
					}
				};
			}
		} finally {
			follower.initialized.resolve(unwatch);
			await follower.close();
		}
	}
};
/** One generation's queue: observations wait here until its consumer pulls them. */
var ChangeFollower = class {
	release;
	controller = new AbortController();
	initialized = Promise.withResolvers();
	error;
	queue = new Deque();
	wake;
	closed = false;
	closing;
	constructor(release) {
		this.release = release;
	}
	/** Whether this generation has stopped accepting invalidations. */
	get isClosed() {
		return this.closed;
	}
	push(observed) {
		if (this.closed) return;
		this.queue.pushBack(observed);
		this.wake?.();
	}
	close() {
		if (this.closing !== void 0) return this.closing;
		this.closed = true;
		this.closing = this.initialized.promise.then((unwatch) => unwatch?.()).finally(this.release);
		this.controller.abort();
		this.wake?.();
		return this.closing;
	}
	fail(error) {
		this.error = error;
		this.controller.abort();
	}
	/** Drain until closed or aborted; anything still queued then is dropped with the generation. */
	async *read() {
		while (!this.closed) {
			const observed = this.queue.popFront();
			if (observed !== void 0) {
				yield observed;
				continue;
			}
			await new Promise((resolve) => {
				this.wake = resolve;
			});
			this.wake = void 0;
		}
		if (this.error !== void 0) throw this.error;
	}
};
//#endregion

export {};
