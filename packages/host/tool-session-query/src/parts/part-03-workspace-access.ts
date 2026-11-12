/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-tool-session-query — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/workspace-access.js
/**
* Caller identity, workspace authorization, and visible lineage projection.
*
* @module @deepseek-ai/dsh-tool-session-query/workspace-access
*/
function callerOf(exec, ctx) {
	const agent = exec.agent;
	if (agent === void 0) throw new HarnessError("session query tools require an agent-bound caller", "SESSION_QUERY_TOOL_MISSING_AGENT");
	return {
		id: agent.session.id,
		header: agent.session.header,
		boundary: ctx.sessionProjections.stateOf(agent.session, "turnBoundary")
	};
}
function targetId(args, caller) {
	return args.session_id === void 0 ? caller.id : brandString(args.session_id);
}
async function authorizeTarget(ctx, caller, target, signal) {
	if (target === caller.id) return;
	const cwd = caller.header.cwd;
	if (cwd === void 0) throw serviceBoundary.unauthorizedTarget();
	if ((await serviceBoundary.call(ctx, signal, "target authorization", () => ctx.sessionQuery.filterSessions([{
		kind: "id",
		values: [target]
	}, {
		kind: "cwd",
		values: [cwd]
	}], signal))).length !== 1) throw serviceBoundary.unauthorizedTarget();
}
function recordAuthorized(record, caller) {
	return headerAuthorized(record.header, caller);
}
function headerAuthorized(header, caller) {
	if (header.id === caller.id) return header.cwd === caller.header.cwd;
	return caller.header.cwd !== void 0 && header.cwd === caller.header.cwd;
}
function assertObservedTargetAuthorized(caller, target, observed) {
	if (observed.id !== target || !headerAuthorized(observed, caller)) throw serviceBoundary.unauthorizedTarget();
}
async function authorizeSessionIds(ctx, caller, ids, signal) {
	const unique = [...new Set(ids)];
	const authorized = /* @__PURE__ */ new Set();
	if (unique.includes(caller.id)) authorized.add(caller.id);
	const cwd = caller.header.cwd;
	const other = unique.filter((id) => id !== caller.id);
	if (cwd === void 0 || other.length === 0) return authorized;
	const records = await serviceBoundary.call(ctx, signal, "session-id authorization", () => ctx.sessionQuery.filterSessions([{
		kind: "id",
		values: other
	}, {
		kind: "cwd",
		values: [cwd]
	}], signal));
	const requested = new Set(other);
	for (const record of records) if (requested.has(record.header.id) && recordAuthorized(record, caller)) authorized.add(record.header.id);
	return authorized;
}
async function readTitles(ctx, caller, ids, signal) {
	const result = /* @__PURE__ */ new Map();
	const observations = await serviceBoundary.call(ctx, signal, "title observation", () => ctx.sessionQuery.readTitleSnapshots(ids, signal));
	for (const observation of observations) {
		if (observation.status === "rejected") {
			result.set(observation.sessionId, unavailableTitle(ctx, observation.reason));
			continue;
		}
		assertObservedTargetAuthorized(caller, observation.sessionId, observation.value.session);
		result.set(observation.sessionId, { text: observation.value.title?.title ?? "untitled" });
	}
	return result;
}
async function readTitle(ctx, caller, id, signal) {
	return (await readTitles(ctx, caller, [id], signal)).get(id);
}
function unavailableTitle(ctx, error) {
	const sanitized = serviceBoundary.sanitizeError(ctx, "title observation item", error);
	if (sanitized.code === "SESSION_QUERY_TOOL_UNAUTHORIZED") throw sanitized;
	return {
		text: "untitled",
		unavailableCode: sanitized.code
	};
}
function authorizeDescendants(nodes, caller) {
	const result = [];
	let pending;
	for (const node of [...nodes].reverse()) pending = {
		node,
		target: result,
		next: pending
	};
	while (pending !== void 0) {
		const current = pending;
		pending = current.next;
		if (!recordAuthorized(current.node.session, caller)) {
			current.target.push(null);
			continue;
		}
		const projected = {
			record: current.node.session,
			descendants: []
		};
		current.target.push(projected);
		for (const child of [...current.node.descendants].reverse()) pending = {
			node: child,
			target: projected.descendants,
			next: pending
		};
	}
	return result;
}
function* visitDescendants(nodes) {
	let pending;
	for (const node of [...nodes].reverse()) pending = {
		node,
		depth: 0,
		next: pending
	};
	while (pending !== void 0) {
		const current = pending;
		pending = current.next;
		yield current;
		if (current.node === null) continue;
		for (const child of [...current.node.descendants].reverse()) pending = {
			node: child,
			depth: current.depth + 1,
			next: pending
		};
	}
}
function descendantIds(nodes) {
	const ids = [];
	for (const { node } of visitDescendants(nodes)) if (node !== null) ids.push(node.record.header.id);
	return ids;
}
function titleText(view) {
	return view.unavailableCode === void 0 ? view.text : `${view.text} (title unavailable: ${view.unavailableCode})`;
}
/** Workspace-scoped caller authorization, title access, and lineage projection. */
const workspaceAccess = {
	callerOf,
	targetId,
	authorizeTarget,
	recordAuthorized,
	assertObservedTargetAuthorized,
	authorizeSessionIds,
	readTitles,
	readTitle,
	authorizeDescendants,
	visitDescendants,
	descendantIds,
	titleText
};
//#endregion

export {};
