/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/upload-index.js
/** Durable DeepSeek attachment-to-file-id index. @module dsh-llm-deepseek/upload-index */
var InvalidUploadIndexError = class extends Error {};
/**
* Derive a non-secret stable index namespace without persisting or logging authentication headers.
* @param baseURL - normalized provider endpoint namespace.
* @param credentials - serialized authentication headers used only as hash input.
* @returns branded SHA-256 namespace digest.
*/
function deepSeekFileScope(baseURL, credentials) {
	return DeepSeekFileScope(createHash("sha256").update(baseURL.replace(/\/+$/u, "")).update("\0").update(credentials).digest("hex"));
}
function absent(error) {
	return error?.code === "ENOENT";
}
function parseRecord(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new InvalidUploadIndexError("llm-deepseek: upload index contains a non-object record");
	const record = value;
	if (typeof record.scope !== "string" || !/^[0-9a-f]{64}$/u.test(record.scope) || typeof record.attachmentId !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(record.attachmentId) || typeof record.variantId !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(record.variantId) || typeof record.fileId !== "string" || record.fileId.length === 0 || !Number.isSafeInteger(record.bytes) || record.bytes < 0 || !Number.isSafeInteger(record.createdAt) || record.createdAt < 0 || !Number.isSafeInteger(record.expiresAt) || record.expiresAt < 0) throw new InvalidUploadIndexError("llm-deepseek: upload index contains an invalid record");
	return {
		scope: DeepSeekFileScope(record.scope),
		attachmentId: record.attachmentId,
		variantId: ImageVariantId(record.variantId),
		fileId: DeepSeekFileId(record.fileId),
		bytes: record.bytes,
		createdAt: record.createdAt,
		expiresAt: record.expiresAt
	};
}
function parseIndex(text) {
	let value;
	try {
		value = JSON.parse(text);
	} catch (error) {
		throw new InvalidUploadIndexError("llm-deepseek: upload index is not valid JSON", { cause: error });
	}
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new InvalidUploadIndexError("llm-deepseek: upload index is not an object");
	const index = value;
	if (index.formatVersion !== 3 || !Array.isArray(index.records)) throw new InvalidUploadIndexError("llm-deepseek: unsupported upload index format");
	const records = index.records.map(parseRecord);
	const keys = /* @__PURE__ */ new Set();
	for (const record of records) {
		const key = `${record.scope}\0${record.variantId}`;
		if (keys.has(key)) throw new InvalidUploadIndexError("llm-deepseek: upload index contains duplicate mappings");
		keys.add(key);
	}
	return {
		formatVersion: 3,
		records
	};
}
function reusable(record, now, refreshMarginMs) {
	return record.expiresAt - now > refreshMarginMs;
}
/** Atomic local index shared by every DeepSeek session in this DSH home. */
var DeepSeekUploadIndex = class {
	/** Absolute owner-private JSON index path. */
	path;
	/**
	* @param path - explicit test path; omission uses `DSH_HOME/llm-deepseek/files-v3.json`.
	*/
	constructor(path = join(resolveDshHome(), "llm-deepseek", "files-v3.json")) {
		this.path = path;
	}
	async load() {
		try {
			return parseIndex(await readFile(this.path, "utf8"));
		} catch (error) {
			if (absent(error) || error instanceof InvalidUploadIndexError) return {
				formatVersion: 3,
				records: []
			};
			throw error;
		}
	}
	async save(index) {
		await writeFileAtomic(this.path, `${JSON.stringify(index, void 0, 2)}\n`, {
			mode: 384,
			dirMode: 448
		});
	}
	/**
	* Read one reusable mapping.
	* @param scope - endpoint/API-key namespace.
	* @param variantId - complete request-image transformation identity.
	* @param now - current Unix time in milliseconds.
	* @param refreshMarginMs - remaining lifetime below which a mapping is not reused.
	* @returns the mapping when it has enough lifetime remaining.
	*/
	async get(scope, variantId, now, refreshMarginMs) {
		const record = (await this.load()).records.find((candidate) => candidate.scope === scope && candidate.variantId === variantId);
		return record !== void 0 && reusable(record, now, refreshMarginMs) ? record : void 0;
	}
	/**
	* Publish a completed upload unless another process already published a reusable mapping.
	* @param candidate - completed remote upload.
	* @param now - current Unix time in milliseconds.
	* @param refreshMarginMs - minimum reusable remaining lifetime.
	* @returns the winning record and whether the candidate entered the index.
	*/
	async commit(candidate, now, refreshMarginMs) {
		await mkdir(dirname(this.path), {
			recursive: true,
			mode: 448
		});
		return withFileLock(this.path, async () => {
			const index = await this.load();
			const existing = index.records.find((record) => record.scope === candidate.scope && record.variantId === candidate.variantId && reusable(record, now, refreshMarginMs));
			if (existing !== void 0) return {
				record: existing,
				accepted: false
			};
			const records = index.records.filter((record) => reusable(record, now, refreshMarginMs) && !(record.scope === candidate.scope && record.variantId === candidate.variantId));
			records.push(candidate);
			await this.save({
				formatVersion: 3,
				records
			});
			return {
				record: candidate,
				accepted: true
			};
		});
	}
	/**
	* Remove exact mappings in one locked rewrite without deleting concurrently installed successors.
	* @param scope - endpoint/API-key namespace.
	* @param generations - exact remote generations being invalidated; pairs absent from the index are ignored.
	*/
	async remove(scope, generations) {
		const invalidated = new Set(generations.map((generation) => `${generation.variantId}\0${generation.fileId}`));
		await mkdir(dirname(this.path), {
			recursive: true,
			mode: 448
		});
		await withFileLock(this.path, async () => {
			const index = await this.load();
			const records = index.records.filter((record) => !(record.scope === scope && invalidated.has(`${record.variantId}\0${record.fileId}`)));
			if (records.length !== index.records.length) await this.save({
				formatVersion: 3,
				records
			});
		});
	}
	/**
	* Remove every local mapping for one remote namespace.
	* @param scope - endpoint/API-key namespace.
	*/
	async clear(scope) {
		await mkdir(dirname(this.path), {
			recursive: true,
			mode: 448
		});
		await withFileLock(this.path, async () => {
			const index = await this.load();
			const records = index.records.filter((record) => record.scope !== scope);
			if (records.length !== index.records.length) await this.save({
				formatVersion: 3,
				records
			});
		});
	}
};
//#endregion

export {};
