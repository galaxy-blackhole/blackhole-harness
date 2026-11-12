/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/files-api.js
/** DeepSeek Files API transport. @module dsh-llm-deepseek/files-api */
/** Minimum provider-supported file lifetime. */
const MIN_FILE_EXPIRY_SECONDS = 3600;
/** Maximum provider-supported file lifetime. */
const MAX_FILE_EXPIRY_SECONDS = 2592e3;
/** Maximum Files API upload size. */
const MAX_FILE_UPLOAD_BYTES = 128 * 1024 * 1024;
/** Current per-key file-count quota. */
const MAX_STORED_FILE_COUNT = 1e4;
/** Current per-key storage quota. */
const MAX_STORED_FILE_BYTES = 25 * 1024 * 1024 * 1024;
/** Files API operation failure with its HTTP status retained for recovery policy. */
var DeepSeekFilesError = class extends LlmError {
	/** Parsed provider detail used only for error classification. */
	detail;
	/**
	* @param message - user-readable provider failure.
	* @param status - HTTP status returned by the Files API.
	* @param detail - provider error fields joined for classification.
	*/
	constructor(message, status, detail) {
		super(message, status === 401 || status === 403 ? "AUTH" : status === 429 ? "RATE_LIMIT" : status >= 500 ? "SERVER" : "FILES_API", { status });
		this.name = "DeepSeekFilesError";
		this.detail = detail;
	}
};
/**
* Whether an upload failure reports a provider storage or file-count quota.
* @param error - Files API operation failure.
* @returns whether one bounded remote cleanup and upload retry may recover.
*/
function isFilesQuotaError(error) {
	return error instanceof DeepSeekFilesError && /(?:quota|storage|stored files|file count|too many files)/iu.test(error.detail);
}
function invalidResponse(operation) {
	return new LlmError(`DeepSeek Files API returned an invalid ${operation} response.`, "INVALID_RESPONSE");
}
/** Decode successful Files JSON with operation context; body transport and abort failures retain their identity. */
async function responseJson(response, operation) {
	try {
		return await response.json();
	} catch (error) {
		if (!(error instanceof SyntaxError)) throw error;
		throw new LlmError(`DeepSeek Files API returned invalid JSON for ${operation} (HTTP ${response.status}).`, "INVALID_RESPONSE", {
			status: response.status,
			cause: error
		});
	}
}
function parseFileObject(value, operation) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw invalidResponse(operation);
	const wire = value;
	const createdAt = typeof wire.created_at === "string" ? Math.floor(Date.parse(wire.created_at) / 1e3) : NaN;
	if (typeof wire.id !== "string" || wire.id.length === 0 || wire.type !== "file" || typeof wire.mime_type !== "string" || typeof wire.size_bytes !== "number" || !Number.isSafeInteger(wire.size_bytes) || wire.size_bytes < 0 || !Number.isSafeInteger(createdAt) || createdAt < 0 || typeof wire.filename !== "string" || wire.filename.length === 0) throw invalidResponse(operation);
	return {
		id: DeepSeekFileId(wire.id),
		bytes: wire.size_bytes,
		createdAt,
		filename: wire.filename
	};
}
function providerErrorDetail$1(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return { detail: "" };
	const error = value.error;
	if (error === null || typeof error !== "object" || Array.isArray(error)) return { detail: "" };
	const fields = error;
	const message = typeof fields.message === "string" ? fields.message : void 0;
	return {
		...message === void 0 ? {} : { message },
		detail: [
			fields.code,
			fields.type,
			fields.message
		].filter((field) => typeof field === "string").join(" ")
	};
}
/** Direct Files client retaining the configured URL root and refusing redirects before credentials can leave its origin. */
var DeepSeekFilesClient = class {
	baseURL;
	authHeaders;
	fetchImpl;
	/**
	* @param options - endpoint, authentication headers, and optional test transport.
	*/
	constructor(options) {
		this.authHeaders = options.headers;
		this.fetchImpl = options.fetch ?? globalThis.fetch;
		this.baseURL = messagesApiRoot(options.baseURL);
	}
	async request(path, init, signal) {
		let response;
		try {
			const headers = new Headers(attributionHeaders());
			for (const [name, value] of Object.entries(this.authHeaders)) headers.set(name, value);
			headers.set("anthropic-version", "2023-06-01");
			headers.set("anthropic-beta", MESSAGES_FILES_BETA);
			response = await this.fetchImpl(`${this.baseURL}${path}`, {
				...init,
				redirect: "error",
				headers,
				...signal === void 0 ? {} : { signal }
			});
		} catch (error) {
			if (signal?.aborted) throw error;
			throw new LlmError(`DeepSeek Files API request to ${this.baseURL} failed`, "TRANSPORT", { cause: error });
		}
		if (response.ok) return response;
		let parsed;
		try {
			parsed = await response.json();
		} catch {}
		const { message, detail } = providerErrorDetail$1(parsed);
		throw new DeepSeekFilesError(message ?? `DeepSeek Files API error (HTTP ${response.status})`, response.status, detail);
	}
	/**
	* Upload one image with an explicit expiry.
	* @param input - deterministic request-version bytes, media type, filename, lifetime, and cancellation.
	* @returns the validated file and reuse deadline. Messages omits expiry metadata;
	*   its deadline uses upload creation plus the requested lifetime.
	*/
	async upload(input) {
		if (input.data.byteLength > 134217728) throw new LlmError("DeepSeek Files API upload exceeds 128 MiB.", "INVALID_REQUEST");
		if (!Number.isSafeInteger(input.expiresAfterSeconds) || input.expiresAfterSeconds < 3600 || input.expiresAfterSeconds > 2592e3) throw new LlmError("DeepSeek file expiry must be between 3600 and 2592000 seconds.", "INVALID_REQUEST");
		const form = new FormData();
		form.set("expires_after[anchor]", "created_at");
		form.set("expires_after[seconds]", String(input.expiresAfterSeconds));
		form.set("file", new Blob([Uint8Array.from(input.data).buffer], { type: input.mediaType }), input.filename);
		const file = parseFileObject(await responseJson(await this.request("/files", {
			method: "POST",
			body: form
		}, input.signal), "upload"), "upload");
		return {
			...file,
			expiresAt: file.createdAt + input.expiresAfterSeconds
		};
	}
	/**
	* List one provider-ordered page of files.
	* @param options - pagination and cancellation.
	* @returns the validated page with null cursors omitted.
	*/
	async list(options = {}) {
		const query = new URLSearchParams();
		if (options.after !== void 0) query.set("after_id", options.after);
		if (options.limit !== void 0) query.set("limit", String(options.limit));
		const value = await responseJson(await this.request(`/files?${query.toString()}`, { method: "GET" }, options.signal), "list");
		if (value === null || typeof value !== "object" || Array.isArray(value)) throw invalidResponse("list");
		const wire = value;
		const firstId = wire.first_id ?? void 0;
		const lastId = wire.last_id ?? void 0;
		if (!Array.isArray(wire.data) || typeof wire.has_more !== "boolean" || firstId !== void 0 && typeof firstId !== "string" || lastId !== void 0 && typeof lastId !== "string") throw invalidResponse("list");
		return {
			data: wire.data.map((item) => parseFileObject(item, "list")),
			...typeof firstId === "string" ? { firstId: DeepSeekFileId(firstId) } : {},
			...typeof lastId === "string" ? { lastId: DeepSeekFileId(lastId) } : {},
			hasMore: wire.has_more
		};
	}
	/**
	* Retrieve one file object.
	* @param fileId - provider file identifier.
	* @param signal - request cancellation.
	* @returns the validated file object.
	*/
	async retrieve(fileId, signal) {
		return parseFileObject(await responseJson(await this.request(`/files/${encodeURIComponent(fileId)}`, { method: "GET" }, signal), "retrieve"), "retrieve");
	}
	/**
	* Delete one provider file.
	* @param fileId - provider file identifier.
	* @param signal - request cancellation.
	*/
	async delete(fileId, signal) {
		const value = await responseJson(await this.request(`/files/${encodeURIComponent(fileId)}`, { method: "DELETE" }, signal), "delete");
		if (value === null || typeof value !== "object" || Array.isArray(value)) throw invalidResponse("delete");
		const wire = value;
		if (wire.id !== fileId || wire.type !== "file_deleted") throw invalidResponse("delete");
	}
};
//#endregion

export {};
