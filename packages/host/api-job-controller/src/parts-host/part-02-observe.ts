/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-job-controller — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/observe.js
/** Per-job observation generations: anchor, coalesced output, terminal status. */
function isTerminal(status) {
	return status !== "running" && status !== "stopping";
}
/**
* Stream one job's retained output from an absolute offset: one `opened`
* anchor, coalesced `output` frames as the ring advances, then one terminal
* `status` after the settled job is drained, after which the generation
* closes normally. A removal announced mid-generation (the owner's teardown)
* closes it with the removed job's terminal projection instead of a failed
* read. Reads are non-consuming — the model-facing cursor and
* notice state never observe them; reconnecting callers resume by passing
* the last frame's `next` as `from`. The request's session is the fenced
* read's caller: the registry rejects a job the session cannot see and an
* unknown job.
* @param registry - the live job registry.
* @param request - target job, owning session, and optional resume offset.
* @param options - cadence and framing bounds.
* @param signal - generation cancellation owned by the Remote stream carrier.
* @returns the observation frame sequence for one generation.
*/
async function* observeJobOutput(registry, request, options, signal) {
	if (request.from !== void 0 && (!Number.isSafeInteger(request.from) || request.from < 0)) throw new Error(`invalid observe offset: expected a non-negative safe integer, got ${JSON.stringify(request.from)}`);
	signal.throwIfAborted();
	const id = String(request.jobId);
	const waiter = new OutputWaiter();
	let removed;
	const unsubscribe = registry.events.subscribe({ owners: "all" }, (event) => {
		if ((event.type === "output" ? event.id : event.job.id) !== id) return;
		if (event.type === "removed") removed = event.job;
		waiter.wake();
	});
	try {
		let job = registry.get(id, request.sessionId);
		let cursor = request.from ?? job.output.earliest;
		yield {
			type: "opened",
			job,
			from: cursor
		};
		while (!signal.aborted) {
			if (removed !== void 0) {
				yield {
					type: "status",
					job: removed
				};
				return;
			}
			const read = registry.readAt(id, cursor, request.sessionId);
			if (read.chunks.length > 0 || read.lossy) yield* outputFrames(read.chunks, read.next, read.lossy, options.maxFrameBytes);
			cursor = read.next;
			job = registry.get(id, request.sessionId);
			if (isTerminal(job.status) && cursor >= job.output.total) {
				yield {
					type: "status",
					job
				};
				return;
			}
			await waiter.wait(signal);
			await sleep(options.flushMs, signal);
		}
	} finally {
		unsubscribe();
	}
}
/** Split one read into frames along the soft per-frame byte budget. */
function* outputFrames(chunks, next, lossy, maxFrameBytes) {
	let batch = [];
	let batchBytes = 0;
	let flaggedLossy = lossy;
	for (const chunk of chunks) {
		batch.push(chunk);
		batchBytes += Buffer.byteLength(chunk.text, "utf8");
		if (batchBytes >= maxFrameBytes) {
			const last = batch[batch.length - 1];
			/* v8 ignore start -- a non-empty batch always has a last chunk; the arm only discharges noUncheckedIndexedAccess. */
			const end = last === void 0 ? next : last.at + Buffer.byteLength(last.text, "utf8");
			/* v8 ignore stop */
			yield {
				type: "output",
				chunks: batch,
				next: end,
				...flaggedLossy ? { lossy: true } : {}
			};
			flaggedLossy = false;
			batch = [];
			batchBytes = 0;
		}
	}
	if (batch.length > 0 || flaggedLossy) yield {
		type: "output",
		chunks: batch,
		next,
		...flaggedLossy ? { lossy: true } : {}
	};
}
//#endregion

export {};
