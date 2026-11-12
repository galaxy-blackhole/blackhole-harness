/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-tool-session-query — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/operations.js
/**
* Tool operation orchestration over session-query service capabilities.
*
* @module @deepseek-ai/dsh-tool-session-query/operations
*/
async function executeSessionSearch(ctx, args, exec, maxResults) {
	const caller = workspaceAccess.callerOf(exec, ctx);
	const cwd = caller.header.cwd;
	if (cwd === void 0) throw new HarnessError("cross-session search is unavailable because the caller session has no workspace", "SESSION_QUERY_TOOL_UNAUTHORIZED");
	const query = toolInput.normalizeQuery(args.query);
	const sessionFilters = toolInput.buildSessionFilters(args);
	const eventFilters = toolInput.buildEventFilters({
		seqFrom: args.event_seq_from,
		seqTo: args.event_seq_to,
		timeFrom: args.event_time_from,
		timeTo: args.event_time_to,
		eventTypes: args.event_types,
		surfaces: args.event_surfaces
	});
	const requestedParentIds = toolInput.materializeParentSessionIds(args.parent_session_ids);
	if (requestedParentIds !== void 0 || args.include_root_sessions === true) {
		const authorizedParentIds = requestedParentIds === void 0 ? /* @__PURE__ */ new Set() : await workspaceAccess.authorizeSessionIds(ctx, caller, requestedParentIds, exec.signal);
		const parentValues = requestedParentIds?.filter((id) => authorizedParentIds.has(id)) ?? [];
		if (args.include_root_sessions === true) parentValues.push(null);
		if (parentValues.length === 0) return presentation.formatEmptySessionSearch();
		sessionFilters.push({
			kind: "parent",
			values: parentValues
		});
	}
	sessionFilters.push({
		kind: "cwd",
		values: [cwd]
	});
	const collected = await collectPages(maxResults, exec.signal, (cursor) => serviceBoundary.call(ctx, exec.signal, "session search", () => ctx.sessionQuery.searchSessions({
		query,
		sessionFilters,
		eventFilters,
		...cursor === void 0 ? {} : { cursor }
	}, { signal: exec.signal })), (hit) => hit.header.id !== caller.id && workspaceAccess.recordAuthorized(hit, caller));
	const parentIds = collected.items.map((hit) => hit.header.parentSession).filter((id) => id !== void 0);
	const authorizedParents = await workspaceAccess.authorizeSessionIds(ctx, caller, parentIds, exec.signal);
	const titles = await workspaceAccess.readTitles(ctx, caller, collected.items.map((hit) => hit.header.id), exec.signal);
	return presentation.formatSessionSearch(collected, titles, authorizedParents);
}
async function executeEventSearch(ctx, args, exec, maxResults) {
	const caller = workspaceAccess.callerOf(exec, ctx);
	const sessionId = workspaceAccess.targetId(args, caller);
	await workspaceAccess.authorizeTarget(ctx, caller, sessionId, exec.signal);
	const query = toolInput.normalizeQuery(args.query);
	const range = toolInput.sequenceRange(args.seq_from, args.seq_to);
	if (sessionId === caller.id) {
		const stepStartSeq = caller.boundary?.lastStepStartSeq;
		if (stepStartSeq === void 0) throw new HarnessError("current-session search requires an active step boundary", "SESSION_QUERY_TOOL_NO_CURRENT_STEP");
		range.to = Math.min(range.to ?? Number.MAX_SAFE_INTEGER, (stepStartSeq ?? 0) - 1);
	}
	const title = await workspaceAccess.readTitle(ctx, caller, sessionId, exec.signal);
	if (range.from !== void 0 && range.to !== void 0 && range.from > range.to) return presentation.formatEventSearch(sessionId, title, {
		items: [],
		capped: false
	});
	const filters = toolInput.buildEventFilters({
		seqFrom: range.from,
		seqTo: range.to,
		timeFrom: args.time_from,
		timeTo: args.time_to,
		eventTypes: args.event_types,
		surfaces: args.surfaces
	});
	const collected = await collectPages(maxResults, exec.signal, async (cursor) => {
		const page = await serviceBoundary.call(ctx, exec.signal, "event search", () => ctx.sessionQuery.searchEvents({
			sessionId,
			query,
			filters,
			...cursor === void 0 ? {} : { cursor }
		}, { signal: exec.signal }));
		workspaceAccess.assertObservedTargetAuthorized(caller, sessionId, page.session);
		return page;
	}, () => true);
	return presentation.formatEventSearch(sessionId, title, collected);
}
async function executeSessionTrace(ctx, args, exec) {
	const caller = workspaceAccess.callerOf(exec, ctx);
	const sessionId = workspaceAccess.targetId(args, caller);
	await workspaceAccess.authorizeTarget(ctx, caller, sessionId, exec.signal);
	const trace = await serviceBoundary.call(ctx, exec.signal, "session lineage trace", () => ctx.sessionQuery.traceSession(sessionId, exec.signal));
	workspaceAccess.assertObservedTargetAuthorized(caller, sessionId, trace.target.header);
	const ancestors = [];
	let ancestorBoundary = false;
	for (const ancestor of trace.ancestors) {
		if (!workspaceAccess.recordAuthorized(ancestor, caller)) {
			ancestorBoundary = true;
			break;
		}
		ancestors.push(ancestor);
	}
	if (ancestors.length === trace.ancestors.length && !trace.complete) ancestorBoundary = true;
	const descendants = workspaceAccess.authorizeDescendants(trace.descendants, caller);
	const visibleIds = [
		trace.target.header.id,
		...ancestors.map((record) => record.header.id),
		...workspaceAccess.descendantIds(descendants)
	];
	const titles = await workspaceAccess.readTitles(ctx, caller, visibleIds, exec.signal);
	return presentation.formatSessionTrace(trace, ancestors, ancestorBoundary, descendants, titles);
}
async function executeEventTrace(ctx, args, exec) {
	toolInput.assertNonNegativeSafeInteger("seq", args.seq);
	const seq = SessionSeq(args.seq);
	const caller = workspaceAccess.callerOf(exec, ctx);
	const sessionId = workspaceAccess.targetId(args, caller);
	await workspaceAccess.authorizeTarget(ctx, caller, sessionId, exec.signal);
	const trace = await serviceBoundary.call(ctx, exec.signal, "event trace", () => ctx.sessionQuery.traceEvent({
		sessionId,
		seq
	}, exec.signal));
	workspaceAccess.assertObservedTargetAuthorized(caller, sessionId, trace.session);
	const title = await workspaceAccess.readTitle(ctx, caller, sessionId, exec.signal);
	return presentation.formatEventTrace(sessionId, title, trace);
}
async function executeEventRead(ctx, args, exec) {
	toolInput.assertNonNegativeSafeInteger("seq", args.seq);
	const seq = SessionSeq(args.seq);
	if (args.before !== void 0) toolInput.assertNonNegativeSafeInteger("before", args.before);
	if (args.after !== void 0) toolInput.assertNonNegativeSafeInteger("after", args.after);
	const caller = workspaceAccess.callerOf(exec, ctx);
	const sessionId = workspaceAccess.targetId(args, caller);
	await workspaceAccess.authorizeTarget(ctx, caller, sessionId, exec.signal);
	const window = await serviceBoundary.call(ctx, exec.signal, "event read", () => ctx.sessionQuery.readEvent({
		sessionId,
		seq,
		...args.before === void 0 ? {} : { before: args.before },
		...args.after === void 0 ? {} : { after: args.after }
	}, exec.signal));
	workspaceAccess.assertObservedTargetAuthorized(caller, sessionId, window.session);
	const title = await workspaceAccess.readTitle(ctx, caller, sessionId, exec.signal);
	return presentation.formatEventRead(sessionId, title, window);
}
async function collectPages(maxResults, signal, request, accept) {
	const items = [];
	const seen = /* @__PURE__ */ new Set();
	let cursor;
	while (true) {
		signal.throwIfAborted();
		const page = await request(cursor);
		signal.throwIfAborted();
		for (const item of page.items) {
			if (!accept(item)) continue;
			if (items.length === maxResults) return {
				items,
				capped: true
			};
			items.push(item);
		}
		if (page.nextCursor === void 0) return {
			items,
			capped: false
		};
		if (seen.has(page.nextCursor)) throw new SessionQueryError("session-search provider repeated a continuation cursor", "SESSION_QUERY_INVALID_CURSOR");
		seen.add(page.nextCursor);
		cursor = page.nextCursor;
	}
}
/** Five model-facing session-query operation implementations. */
const operations = {
	executeSessionSearch,
	executeEventSearch,
	executeSessionTrace,
	executeEventTrace,
	executeEventRead
};
//#endregion

export {};
