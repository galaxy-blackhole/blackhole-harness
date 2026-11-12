/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/file-store.js
/** DeepSeek Files API upload reuse, invalidation, and quota recovery. @module dsh-llm-deepseek/file-store */
/** Shared Files-store limit for each request image, including file-id references. */
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const OWNED_FILE_PREFIX = "dsh-";
/** The Files resource's parent URL identifies the upload namespace. */
function fileScope(connection) {
	return deepSeekFileScope(messagesApiRoot(connection.baseURL), JSON.stringify(Object.entries(connection.headers).sort(([left], [right]) => left.localeCompare(right))));
}
function abortReason(signal) {
	const reason = signal.reason;
	return reason instanceof Error ? reason : new Error("DeepSeek file upload cancelled with a non-Error reason.", { cause: reason });
}
function uploadFailure(error) {
	return error instanceof Error ? error : new Error("DeepSeek file upload failed with a non-Error reason.", { cause: error });
}
function waitForUpload(operation, signal) {
	signal?.throwIfAborted();
	operation.waiters += 1;
	let released = false;
	const release = (cancelledReason) => {
		if (released) return;
		released = true;
		operation.waiters -= 1;
		if (cancelledReason !== void 0 && operation.waiters === 0 && !operation.settled) operation.controller.abort(cancelledReason);
	};
	if (signal === void 0) return operation.promise.finally(() => {
		release();
	});
	return new Promise((resolve, reject) => {
		const abort = () => {
			const reason = abortReason(signal);
			release(reason);
			reject(reason);
		};
		signal.addEventListener("abort", abort, { once: true });
		operation.promise.then((value) => {
			signal.removeEventListener("abort", abort);
			release();
			resolve(value);
		}, (error) => {
			signal.removeEventListener("abort", abort);
			release();
			reject(uploadFailure(error));
		});
	});
}
function extension(mediaType) {
	switch (mediaType) {
		case "image/png": return "png";
		case "image/jpeg": return "jpeg";
		case "image/webp": return "webp";
		case "image/gif": return "gif";
	}
}
function filename(version) {
	return `${OWNED_FILE_PREFIX}${String(version.attachment.attachmentId).slice(7, 23)}-${String(version.variantId).slice(7, 15)}.${extension(version.mediaType)}`;
}
/** User-scoped durable file-id reuse for the DeepSeek route. */
var DeepSeekFileStore = class {
	index;
	now;
	fetchImpl;
	inflight = /* @__PURE__ */ new Map();
	/**
	* @param options - testable index, clock, and transport boundaries.
	*/
	constructor(options = {}) {
		this.index = options.index ?? new DeepSeekUploadIndex();
		this.now = options.now ?? Date.now;
		this.fetchImpl = options.fetch;
	}
	client(connection) {
		return new DeepSeekFilesClient({
			baseURL: connection.baseURL,
			headers: connection.headers,
			...this.fetchImpl === void 0 ? {} : { fetch: this.fetchImpl }
		});
	}
	/**
	* Resolve or upload one deterministic request image. Concurrent calls share one upload while retaining independent waits.
	* @param version - deterministic model-request bytes and complete transformation identity.
	* @param connection - endpoint and API-key snapshot.
	* @param policy - expiry and quota-recovery policy.
	* @param signal - cancellation of this wait; shared transport stops when no waiter remains.
	* @returns a reusable file id and whether this call published a new upload.
	*/
	ensureUploaded(version, connection, policy, signal) {
		signal?.throwIfAborted();
		const key = `${fileScope(connection)}\0${version.variantId}`;
		let active = this.inflight.get(key);
		if (active?.controller.signal.aborted) {
			this.inflight.delete(key);
			active = void 0;
		}
		if (active !== void 0) return waitForUpload(active, signal);
		const controller = new AbortController();
		const shared = {
			controller,
			settled: false,
			waiters: 0,
			promise: void 0
		};
		shared.promise = this.ensureUploadedOnce(version, connection, policy, controller.signal).then((value) => {
			shared.settled = true;
			return value;
		}, (error) => {
			shared.settled = true;
			throw uploadFailure(error);
		});
		this.inflight.set(key, shared);
		shared.promise.finally(() => {
			if (this.inflight.get(key) === shared) this.inflight.delete(key);
		}).catch(() => {});
		return waitForUpload(shared, signal);
	}
	async ensureUploadedOnce(version, connection, policy, signal) {
		if (version.bytes > 33554432) throw new LlmError("DeepSeek image exceeds the 32 MiB per-image limit.", "INVALID_REQUEST");
		const scope = fileScope(connection);
		const now = this.now();
		const marginMs = policy.refreshMarginSeconds * 1e3;
		const cached = await this.index.get(scope, version.variantId, now, marginMs);
		if (cached !== void 0) return {
			record: cached,
			uploaded: false
		};
		const client = this.client(connection);
		const upload = async () => {
			const remote = await client.upload({
				data: version.data,
				mediaType: version.mediaType,
				filename: filename(version),
				expiresAfterSeconds: policy.expiresAfterSeconds,
				signal
			});
			if (remote.bytes !== version.data.byteLength) throw new LlmError("DeepSeek Files API upload response does not match the submitted image.", "INVALID_RESPONSE");
			return {
				scope,
				attachmentId: version.attachment.attachmentId,
				variantId: version.variantId,
				fileId: remote.id,
				bytes: remote.bytes,
				createdAt: remote.createdAt * 1e3,
				expiresAt: remote.expiresAt * 1e3
			};
		};
		let candidate;
		try {
			candidate = await upload();
		} catch (error) {
			if (!isFilesQuotaError(error)) throw error;
			if (await this.reclaimOldestOwned(connection, policy.quotaCleanupBatch, signal) === 0) throw error;
			candidate = await upload();
		}
		const committed = await this.index.commit(candidate, this.now(), marginMs);
		if (!committed.accepted) try {
			await client.delete(candidate.fileId, signal);
		} catch {}
		return {
			record: committed.record,
			uploaded: committed.accepted
		};
	}
	/**
	* Invalidate exact local mappings in one index update after a model request rejects their remote ids.
	* @param generations - request-image variants with the exact file id the request used for each.
	* @param connection - endpoint and API-key snapshot.
	*/
	async invalidate(generations, connection) {
		await this.index.remove(fileScope(connection), generations);
	}
	/**
	* Delete the indexed remote file for one attachment and remove its local mapping.
	* @param version - exact request-image version to release.
	* @param connection - endpoint and API-key snapshot.
	* @param policy - expiry policy used to locate a reusable mapping.
	* @param signal - request cancellation.
	* @returns whether an indexed file existed and was deleted.
	*/
	async release(version, connection, policy, signal) {
		const scope = fileScope(connection);
		const record = await this.index.get(scope, version.variantId, this.now(), policy.refreshMarginSeconds * 1e3);
		if (record === void 0) return false;
		await this.client(connection).delete(record.fileId, signal);
		await this.index.remove(scope, [{
			variantId: version.variantId,
			fileId: record.fileId
		}]);
		return true;
	}
	/**
	* Delete the oldest provider files whose names identify harness ownership.
	* @param connection - endpoint and API-key snapshot.
	* @param count - positive maximum number of files to delete.
	* @param signal - request cancellation.
	* @returns number of successfully deleted files.
	*/
	async reclaimOldestOwned(connection, count, signal) {
		const client = this.client(connection);
		let after;
		const owned = [];
		while (true) {
			const page = await client.list({
				...after === void 0 ? {} : { after },
				limit: 1e3,
				...signal === void 0 ? {} : { signal }
			});
			for (const file of page.data) {
				if (!file.filename.startsWith(OWNED_FILE_PREFIX)) continue;
				owned.push({
					id: file.id,
					createdAt: file.createdAt
				});
			}
			owned.sort((left, right) => left.createdAt - right.createdAt);
			owned.splice(count);
			if (!page.hasMore || page.lastId === void 0 || page.lastId === after) break;
			after = page.lastId;
		}
		for (const file of owned) await client.delete(file.id, signal);
		return owned.length;
	}
	/**
	* Delete every remote harness-owned file in the active API-key namespace and clear its index.
	* @param connection - endpoint and API-key snapshot.
	* @param signal - request cancellation.
	* @returns number of deleted files.
	*/
	async releaseAll(connection, signal) {
		let total = 0;
		for (;;) {
			const deleted = await this.reclaimOldestOwned(connection, 1e3, signal);
			total += deleted;
			if (deleted < 1e3) break;
		}
		await this.index.clear(fileScope(connection));
		return total;
	}
};
//#endregion

export {};
