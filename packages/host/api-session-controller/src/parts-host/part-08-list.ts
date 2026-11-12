/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-session-controller — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/list.js
/** Cold-safe Session list and search projection. */
const SEARCH_PROVIDER_CALL_LIMIT = 100;
const SESSION_SEARCH_QUERY_MAX_CHARS = 500;
const MESSAGE_TYPES = new Set(["user/message", "assistant/message"]);
const sessionListMetadataSchema = z$1.object({
	blank: z$1.boolean(),
	lastPromptAt: z$1.number().nullable()
});
const imageLimitsSchema = z$1.object({
	maxImageBytes: z$1.number().int().positive(),
	maxImagesPerMessage: z$1.number().int().positive(),
	maxMessageImageBytes: z$1.number().int().positive(),
	maxImagePixels: z$1.number().int().positive(),
	maxImageDimension: z$1.number().int().positive(),
	mediaTypes: z$1.array(z$1.string())
});
/**
* Advance the Session-list metadata projection by one committed event.
* @param state - metadata before the event.
* @param event - next committed Session event.
* @returns the original or advanced metadata value.
*/
function applySessionListMetadata(state, event) {
	const blank = state.blank && event.type !== "turn/start";
	const lastPromptAt = event.type === "user/message" && event.data.source.kind === "user" ? event.time : state.lastPromptAt;
	return blank === state.blank && lastPromptAt === state.lastPromptAt ? state : {
		blank,
		lastPromptAt
	};
}
/**
* Return the longest prefix containing at most `maximum` Unicode code points.
* @param value - source text.
* @param maximum - maximum number of Unicode code points.
* @returns the source text or its longest allowed prefix.
*/
function truncateUnicodeCodePoints(value, maximum) {
	let count = 0;
	let end = 0;
	for (const codePoint of value) {
		if (count === maximum) return value.slice(0, end);
		count++;
		end += codePoint.length;
	}
	return value;
}
/** Owns list projection registration, bounded cold summaries, and authorized search. */
var ApiSessionList = class {
	ctx;
	workSliceMs;
	/**
	* @param ctx - Host context carrying Session, query, persistence, and projection services.
	* @param workSliceMs - Resolved positive integral list-work budget in milliseconds.
	*/
	constructor(ctx, workSliceMs) {
		this.ctx = ctx;
		this.workSliceMs = workSliceMs;
		ctx.sessionProjections.register({
			key: "sessionListMetadata",
			stateSchema: sessionListMetadataSchema,
			init: () => ({
				blank: true,
				lastPromptAt: null
			}),
			apply: applySessionListMetadata,
			wire: {
				viewSchema: sessionListMetadataSchema,
				view: (state) => state
			},
			stateVersion: 1
		});
		ctx.inject(["attachments"], (attachmentCtx) => {
			ctx.sessionProjections.register({
				key: "imageLimits",
				stateSchema: z$1.null(),
				init: () => null,
				apply: (state) => state,
				wire: {
					viewSchema: imageLimitsSchema,
					view: () => attachmentCtx.attachments.imageLimits
				},
				stateVersion: 1
			});
		});
	}
	/**
	* Build one current attached-Session summary.
	* @param session - attached Session to summarize.
	* @returns current list metadata and available projections.
	*/
	summaryFor(session) {
		const projections = this.projectionsFor(session.header, session);
		const metadata = projections?.values.sessionListMetadata;
		return {
			sessionId: session.id,
			updatedAt: updatedAt(session.header, metadata),
			agentAvailable: this.ctx.agents.get(session.id)?.session === session,
			formatStatus: "current",
			running: this.ctx.agents.get(session.id)?.status === "running",
			blank: metadata?.blank ?? session.seq === 0,
			...listFields(session.header),
			...projections === void 0 ? {} : { projections }
		};
	}
	/**
	* Read every visible attached and persisted Session without activating an Agent.
	* @param signal - optional cancellation for persistence reads and summary generation.
	* @returns visible Session summaries ordered by activity.
	*/
	async list(signal) {
		signal?.throwIfAborted();
		const records = await this.ctx.sessionQuery.listSessions(signal);
		signal?.throwIfAborted();
		const items = [];
		const cold = [];
		let yieldDeadline = performance.now() + this.workSliceMs;
		for (const record of records) {
			signal?.throwIfAborted();
			const live = this.ctx.sessions.get(record.header.id);
			if (live !== void 0) {
				/*
				 * Phiên còn sống trong bộ nhớ nhưng NHẬT KÝ ĐÃ BỊ XOÁ (ui-session-delete gỡ thư mục log) thì
				 * KHÔNG liệt kê nữa — nếu không, sidebar vẫn hiện dòng đã xoá cho tới lần boot sau.
				 * Đo 01/11/2026: xoá xong, dòng vẫn còn vì agent còn attached trong phiên này.
				 */
				const persistence = this.ctx.get("sessionPersistence");
				if (persistence === void 0) items.push(this.summaryFor(live));
				else {
					const stored = await persistence.stat(record.header.id, { signal }).catch(() => undefined);
					if (stored !== void 0) items.push(this.summaryFor(live));
				}
			} else if (record.header.cwd !== void 0) cold.push(record);
			if (performance.now() >= yieldDeadline) {
				await scheduler.yield();
				signal?.throwIfAborted();
				yieldDeadline = performance.now() + this.workSliceMs;
			}
		}
		for (const record of cold) {
			signal?.throwIfAborted();
			items.push(this.summarizeCold(record));
			if (performance.now() >= yieldDeadline) {
				await scheduler.yield();
				signal?.throwIfAborted();
				yieldDeadline = performance.now() + this.workSliceMs;
			}
		}
		signal?.throwIfAborted();
		items.sort((left, right) => right.updatedAt - left.updatedAt);
		return items;
	}
	summarizeCold({ header, formatStatus }) {
		const projections = this.projectionsFor(header, void 0);
		const metadata = projections?.values.sessionListMetadata;
		return {
			sessionId: header.id,
			updatedAt: updatedAt(header, metadata),
			agentAvailable: false,
			...formatStatus === void 0 ? {} : { formatStatus },
			running: false,
			blank: metadata?.blank ?? false,
			...listFields(header),
			...projections === void 0 ? {} : { projections }
		};
	}
	/**
	* Search current visible message content without activating any matching Session.
	* @param query - literal message-content query.
	* @param signal - cancellation for list and search reads.
	* @returns authorized bounded Session search results.
	*/
	async search(query, signal) {
		const normalizedQuery = normalizeSearchQuery(query);
		signal.throwIfAborted();
		const provider = this.ctx.get("sessionQuery");
		if (provider === void 0) throw new RemoteError("gateway/internal", "session search is unavailable: this deployment does not mount @deepseek-ai/dsh-session-query", {});
		try {
			const visible = await provider.listSessions(signal);
			signal.throwIfAborted();
			const visibleIds = new Set(visible.filter((record) => record.header.cwd !== void 0).map((record) => record.header.id));
			if (visibleIds.size === 0) return {
				items: [],
				hasMore: false
			};
			const authorized = [];
			const acceptedIds = /* @__PURE__ */ new Set();
			const seenCursors = /* @__PURE__ */ new Set();
			let cursor;
			let providerCalls = 0;
			let pageLimit = 20;
			while (authorized.length <= 20) {
				signal.throwIfAborted();
				if (providerCalls >= SEARCH_PROVIDER_CALL_LIMIT) throw new Error(`session search provider exceeded the ${SEARCH_PROVIDER_CALL_LIMIT}-call work budget`);
				providerCalls++;
				const requestedCursor = cursor;
				const requestedLimit = pageLimit;
				let page;
				try {
					page = await provider.searchSessions({
						query: normalizedQuery,
						eventFilters: [{
							kind: "type",
							values: ["user/message", "assistant/message"]
						}, {
							kind: "surface",
							values: ["current"]
						}],
						limit: requestedLimit,
						...requestedCursor === void 0 ? {} : { cursor: requestedCursor }
					}, { signal });
					signal.throwIfAborted();
				} catch (error) {
					signal.throwIfAborted();
					if (requestedCursor === void 0 && error instanceof SessionQueryError && error.code === "SESSION_QUERY_INVALID_LIMIT" && requestedLimit > 1) {
						pageLimit = Math.max(1, Math.floor(requestedLimit / 2));
						continue;
					}
					if (requestedCursor !== void 0 && error instanceof SessionQueryError && error.code === "SESSION_QUERY_STALE_CURSOR") {
						authorized.length = 0;
						acceptedIds.clear();
						seenCursors.clear();
						cursor = void 0;
						continue;
					}
					throw error;
				}
				if (page.items.length > requestedLimit) throw new Error(`session search provider returned ${String(page.items.length)} items; maximum is ${String(requestedLimit)}`);
				for (const hit of page.items) {
					if (authorized.length > 20) continue;
					if (!visibleIds.has(hit.header.id) || hit.bestMatch.sessionId !== hit.header.id || hit.bestMatch.surface !== "current" || !MESSAGE_TYPES.has(hit.bestMatch.type) || acceptedIds.has(hit.header.id)) continue;
					acceptedIds.add(hit.header.id);
					authorized.push({
						sessionId: hit.header.id,
						snippet: truncateUnicodeCodePoints(hit.bestMatch.snippet, 240)
					});
				}
				if (page.nextCursor !== void 0) {
					if (seenCursors.has(page.nextCursor)) throw new Error("session search provider repeated a continuation cursor");
					seenCursors.add(page.nextCursor);
				}
				if (authorized.length > 20 || page.nextCursor === void 0) break;
				cursor = page.nextCursor;
			}
			return {
				items: authorized.slice(0, 20),
				hasMore: authorized.length > 20
			};
		} catch (error) {
			signal.throwIfAborted();
			if (error instanceof SessionQueryError && error.code === "SESSION_QUERY_ABORTED") throw new RemoteError("gateway/cancelled", "session search was aborted", {});
			throw new RemoteError("gateway/internal", `session search failed: ${String(error)}`, {});
		}
	}
	projectionsFor(header, session) {
		try {
			if (session !== void 0) return hintsOf("sequenced", this.ctx.sessionProjections.cachedSnapshot(session));
			const cache = this.ctx.get("sessionProjectionCache");
			return hintsOf("cached", cache?.cachedSnapshot(header) ?? cache?.cachedPredecessorTitle(header));
		} catch (error) {
			this.ctx.logger.warn(`api-session.list: projection column for "${header.id}" failed; serving the row without it: ${String(error)}`);
			return;
		}
	}
};
/**
* Wrap one projection block as Session-list hints of the named sequence space.
* @param kind - which sequence space the block's watermark belongs to.
* @param block - the block, or `undefined` when no source served one.
* @returns the hints, or `undefined` when the block is absent or carries no value.
*/
function hintsOf(kind, block) {
	if (block === void 0 || Object.keys(block.values).length === 0) return void 0;
	return {
		kind,
		asOfSeq: block.asOfSeq,
		values: block.values
	};
}
function normalizeSearchQuery(query) {
	const normalized = query.trim();
	if (normalized.length === 0) throw new RemoteError("gateway/bad-request", "session search query must not be empty", {});
	if (normalized.length > SESSION_SEARCH_QUERY_MAX_CHARS) throw new RemoteError("gateway/bad-request", `session search query must contain at most ${SESSION_SEARCH_QUERY_MAX_CHARS} UTF-16 code units`, {});
	if (normalized.includes("\0")) throw new RemoteError("gateway/bad-request", "session search query must not contain NUL", {});
	return normalized;
}
function updatedAt(header, metadata) {
	return Math.max(header.createdAt, metadata?.lastPromptAt ?? 0);
}
function listFields(header) {
	return {
		...header.parentSession === void 0 ? {} : { parentSessionId: header.parentSession },
		...header.origin === void 0 ? {} : { origin: header.origin },
		...header.cwd === void 0 ? {} : { cwd: header.cwd }
	};
}
//#endregion

export {};
