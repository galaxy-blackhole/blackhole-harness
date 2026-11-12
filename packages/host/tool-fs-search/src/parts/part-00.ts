/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN 1/2 của bundle gốc @deepseek-ai/dsh-tool-fs-search (dòng 1–521: import + search-core + presentation + direct-call), chia tại ranh giới //#region gần nhất, không sửa tay
 */
// @ts-nocheck

import z from "@deepseek-ai/schemastery";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import { isAbsolute, join, parse, relative, sep } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { existsSync } from "node:fs";
import { HarnessError } from "@deepseek-ai/dsh-llm";
import { ItemRetainer, TextRetainer } from "@deepseek-ai/dsh-output-retention";
//#region lib/types/search-core.js
/**
* Shared execution plumbing for the `glob` / `grep` search tools: the
* package-owned `SEARCH_*` error vocabulary, one spawn helper that runs the
* PACKAGED ripgrep binary (`@vscode/ripgrep`) with a plain argv vector and
* returns complete raw stdout, the best-effort formatted-result spill handoff,
* and workdir-relative path display.
*
* Both tools execute as ordinary foreground spawns through `ctx.subprocess` —
* never `ctx.shell`, never `ctx.shell.start()`, never a model-visible background
* task. The ripgrep binary ships inside the npm package, so no system `rg`
* install is required, and no shell layer exists between the argv vector and
* ripgrep, so no shell quoting is involved. Raw `rg` stdout is an internal
* transport detail: the tools request a per-run stdout capture budget from the
* subprocess seam, parse only complete in-memory stdout within
* `rawOutputMaxBytes`, and never read spill files. The model-facing recovery
* artifact is the formatted result saved through `ctx.spillStore.saveText()`
* ({@link trySaveFormattedResult}).
*
* @module @deepseek-ai/dsh-tool-fs-search/search-core
*/
/**
* Default cap on the complete raw `rg` stdout the tools will parse (the
* `rawOutputMaxBytes` config), matching Claude Code's ripgrep raw buffer.
*/
const RAW_OUTPUT_MAX_BYTES = 2e7;
/**
* Default cooperative tool-call timeout budget in milliseconds (the `timeoutMs`
* config), attached to both tool definitions for
* `@deepseek-ai/dsh-tool-call-timeout-policy` to enforce through `exec.signal`.
*/
const SEARCH_TIMEOUT_MS = 3e4;
/**
* Default cap in bytes on the retained stderr tail of one search run — a
* diagnostic excerpt only (the tool never reads a stderr spill path, and the
* collect disposition requests none).
*/
const SEARCH_STDERR_MAX_BYTES = 64 * 1024;
/** Default terminate grace period for a search process (ms). */
const SEARCH_GRACE_MS = 3e3;
/**
* Default cap in bytes on one search's serialized `presentationMeta` (the
* `searchMetaMaxBytes` config). The inline match/path caps already bound the item
* COUNT, but retained matches of a broad search (many long lines) can still
* serialize to hundreds of kilobytes, and `meta` is persisted with the session
* log and re-sent on every request. A deployment's final output budget
* (`dsh-spill-policy`) only shrinks a result's `content`, never its `meta`, so the
* projection owns this cap. 64 KiB holds the full default-capped result of a
* typical search while bounding the pathological one.
*/
const SEARCH_META_MAX_BYTES = 65536;
/**
* Typed search failure. Extends {@link HarnessError} so it carries a stable
* {@link SearchErrorCode} and chains `cause`; the tool registry exposes
* `{ name, code }` on `isError` results so retry/permission/UI layers can
* branch without parsing messages.
*/
var SearchError = class extends HarnessError {
	code;
	constructor(message, code, options) {
		super(message, code, options);
		this.code = code;
	}
};
/**
* The retained stderr tail as a diagnostic excerpt, with a truncation note when
* the subprocess seam dropped bytes.
*/
function stderrExcerpt(stderrText, truncated) {
	const text = stderrText.trim();
	if (text.length === 0) return "";
	return truncated ? `${text} [stderr truncated]` : text;
}
/**
* Classify a nonzero-exit `rg` run into the search error vocabulary. There is
* no shell layer, so an exit 127 or shell "command not found" text cannot
* occur — a launch failure rejects at spawn (see {@link runRipgrep}).
*/
function classifyRunFailure(toolName, exitCode, stderrText, stderrTruncated) {
	const stderr = stderrExcerpt(stderrText, stderrTruncated);
	if (/regex parse error|error parsing glob/i.test(stderr)) return new SearchError(`${toolName} pattern rejected by ripgrep: ${stderr}`, "SEARCH_INVALID_PATTERN");
	return new SearchError(`${toolName} search failed (exit ${exitCode})${stderr.length > 0 ? `: ${stderr}` : ""}`, "SEARCH_FAILED");
}
/**
* Acquire the COMPLETE raw stdout of a finished run, enforcing
* `rawOutputMaxBytes` on the in-memory transport. A truncated result means the
* subprocess seam could not retain complete stdout within the requested
* budget, so the tool fails clearly instead of parsing a silently-partial
* stream.
*/
function completeStdout(toolName, stdout, rawOutputMaxBytes) {
	const narrow = "narrow pattern, path, or include and retry";
	if (!stdout.lossy) {
		const inlineBytes = Buffer.byteLength(stdout.text, "utf8");
		if (inlineBytes > rawOutputMaxBytes) throw new SearchError(`${toolName} produced ${inlineBytes} bytes of raw output, over the ${rawOutputMaxBytes}-byte cap; ${narrow}`, "SEARCH_RAW_OUTPUT_OVERFLOW");
		return stdout.text;
	}
	throw new SearchError(`${toolName} produced more raw output than the subprocess seam retained within the ${rawOutputMaxBytes}-byte cap; ${narrow}`, "SEARCH_RAW_OUTPUT_OVERFLOW");
}
let rgPathPromise;
/**
* The packaged ripgrep binary path, resolved lazily once per process.
*
* A single-file runtime uses the executable's `-rg` sidecar because a native
* helper cannot be spawned from pkg's virtual filesystem. Node-mode builds
* fall back to the platform package selected by `@vscode/ripgrep`. Resolving
* at the call boundary keeps a missing or corrupt binary at the first search
* call as `SEARCH_FAILED`, rather than failing the Loader composition.
*
* @returns the packaged binary's absolute path; the memoized promise rejects
*   when the platform package cannot be resolved.
*/
function resolveRgPath() {
	rgPathPromise ??= Promise.resolve().then(async () => {
		const executable = parse(process.execPath);
		const executableSidecar = process.platform === "win32" ? join(executable.dir, `${executable.name}-rg.exe`) : `${process.execPath}-rg`;
		if ("pkg" in process && existsSync(executableSidecar)) return executableSidecar;
		const dependency = (await import("@vscode/ripgrep")).rgPath;
		return process.versions.electron === void 0 ? dependency : dependency.replace(/\.asar(?=[\\/])/u, ".asar.unpacked");
	});
	return rgPathPromise;
}
/**
* Run the packaged ripgrep binary with a plain argv vector and return its
* complete raw stdout. The working directory is the calling agent's session
* current directory when available, else
* `process.cwd()`. `exec.signal` is forwarded so the cooperative tool timeout
* (`@deepseek-ai/dsh-tool-call-timeout-policy`) and caller cancellation terminate the
* process tree.
*
* The spawn is unconfined (a plain `ctx.subprocess` call), so `--no-config`
* is prepended: a host `RIPGREP_CONFIG_PATH` (or `rg.conf` next to the
* binary) can otherwise inject `--pre` and make ripgrep execute an arbitrary
* preprocessor for every matched file. The collect dispositions are the
* seam's diagnostic-tail shape (no spill files): the tools never read a raw
* spill path, and truncated stdout fails as `SEARCH_RAW_OUTPUT_OVERFLOW`.
*
* Exit semantics are tool-owned: exit 0 is success with results, exit 1 is
* success with zero results (`noMatches`), anything else throws a
* {@link SearchError} (abort/timeout → `SEARCH_ABORTED`, invalid pattern →
* `SEARCH_INVALID_PATTERN`, the rest → `SEARCH_FAILED` /
* `SEARCH_RAW_OUTPUT_OVERFLOW`). Both launch-time failure domains are
* classified: a synchronous throw at spawn CREATION (a NUL in argv, an abort
* racing the pre-check, a rejected `@vscode/ripgrep` resolution) reports that
* the command could not start, while a rejection of `handle.done` reports a
* provider failure without claiming whether execution began. Both become
* `SEARCH_FAILED` with the original as `cause`; an abort already observed by
* creation time becomes `SEARCH_ABORTED` instead.
*
* @param ctx - the plugin context; execution uses its `subprocess` service.
* @param exec - the tool-execution context; supplies the owning Agent and the abort signal.
* @param toolName - `glob` or `grep`, used in error messages.
* @param argv - the ripgrep arguments (every model value an unquoted argv element; no shell layer exists).
* @param rawOutputMaxBytes - cap on the complete raw stdout the tool will parse.
* @param graceMs - the seam's terminate-escalation grace period.
* @param stderrMaxBytes - cap on the retained stderr diagnostic tail.
* @returns the complete stdout, the zero-result flag, and the resolved workdir.
*/
async function runRipgrep(ctx, exec, toolName, argv, rawOutputMaxBytes, graceMs, stderrMaxBytes) {
	if (exec.signal.aborted) throw new SearchError(`${toolName} was aborted before completion (tool timeout or caller cancellation)`, "SEARCH_ABORTED");
	const workdir = exec.agent === void 0 ? process.cwd() : await ctx.workingDirectory.ensure(exec.agent, exec.signal);
	let handle;
	try {
		handle = ctx.subprocess.spawn({
			argv: [
				await resolveRgPath(),
				"--no-config",
				...argv
			],
			cwd: workdir,
			stdio: {
				stdin: "ignore",
				stdout: { maxBytes: rawOutputMaxBytes },
				stderr: { maxBytes: stderrMaxBytes }
			},
			graceMs,
			signal: exec.signal
		});
	} catch (error) {
		if (exec.signal.aborted) throw new SearchError(`${toolName} was aborted before completion (tool timeout or caller cancellation)`, "SEARCH_ABORTED");
		throw new SearchError(`${toolName} could not start its search command (ripgrep launch failed)`, "SEARCH_FAILED", { cause: error });
	}
	let outcome;
	try {
		outcome = await handle.done;
	} catch (error) {
		throw new SearchError(`${toolName} subprocess failed before reporting an outcome (ripgrep provider failure)`, "SEARCH_FAILED", { cause: error });
	}
	const stdout = handle.collected.stdout?.readFrom(0);
	const stderr = handle.collected.stderr?.readFrom(0);
	if (stdout === void 0 || stderr === void 0) throw new SearchError(`${toolName} search command produced no collected output streams`, "SEARCH_FAILED");
	if (exec.signal.aborted) throw new SearchError(`${toolName} was aborted before completion (tool timeout or caller cancellation)`, "SEARCH_ABORTED");
	if (outcome.signal !== null || outcome.exitCode === null) throw new SearchError(`${toolName} search command was killed by signal ${outcome.signal ?? "(unknown)"}`, "SEARCH_FAILED");
	if (outcome.exitCode !== 0 && outcome.exitCode !== 1) throw classifyRunFailure(toolName, outcome.exitCode, stderr.text, stderr.lossy);
	return {
		stdout: completeStdout(toolName, stdout, rawOutputMaxBytes),
		noMatches: outcome.exitCode === 1,
		workdir
	};
}
/**
* Map an `rg` output path to its display form: absolute paths inside the
* resolved workdir become workdir-relative; everything else (relative output,
* paths outside the workdir) passes through unchanged. Display-only —
* returned paths are follow-up-readable in co-located workdir/filesystem
* deployments where both resolve the same workspace (the documented v1
* deployment requirement).
*
* @param path - one path as ripgrep printed it.
* @param workdir - the resolved workdir the command ran in.
* @returns the workdir-relative display path when possible, else `path` unchanged.
*/
function toWorkdirRelative(path, workdir) {
	if (!isAbsolute(path)) return path;
	const rel = relative(workdir, path);
	if (rel.length === 0) return ".";
	if (rel === ".." || rel.startsWith(`..${sep}`)) return path;
	return rel;
}
/**
* Bound one matched-line preview to `maxBytes` (UTF-8 boundary preserved) and
* mark the cut. The cap is a per-line budget fact; the complete line stays in
* the searched file for `read`.
*
* @param line - the matched line text (trailing newline already stripped).
* @param maxBytes - the preview budget in bytes.
* @returns the preview, suffixed with ` (line truncated)` when bytes were cut.
*/
function previewLine(line, maxBytes) {
	const retainer = new TextRetainer({
		kind: "head",
		maxBytes
	});
	retainer.push(line);
	const kept = retainer.finish();
	return kept.truncated ? `${kept.text} (line truncated)` : kept.text;
}
/**
* Apply the shared inline cap to a canonical `grep` match list: preview each
* retained line to `maxLineBytes` and keep the first `maxMatches`. The single
* retention pass both the model-facing render ({@link module:@deepseek-ai/dsh-tool-fs-search/grep}
* `formatGrepOutput`) and the search-card projection
* ({@link module:@deepseek-ai/dsh-tool-fs-search/presentation} `grepSearchMeta`)
* consume, so text and card never disagree about which matches survived.
*
* @param matches - every match the search parsed (the canonical value's matches).
* @param maxMatches - the inline match cap (the `grepMaxMatches` config).
* @param maxLineBytes - the per-matched-line preview budget in bytes.
* @returns the retention outcome over the previewed matches.
*/
function retainGrepMatches(matches, maxMatches, maxLineBytes) {
	const retainer = new ItemRetainer({
		kind: "head",
		maxItems: maxMatches
	});
	for (const match of matches) retainer.push({
		...match,
		line: previewLine(match.line, maxLineBytes)
	});
	return retainer.finish();
}
/**
* Best-effort save of one COMPLETE formatted search result through
* `ctx.spillStore.saveText()` — the model-facing recovery path for a capped
* result. `spillStore` is read with `ctx.get()` (not static inject) because
* formatted-result spill is optional; the spill owner is the calling agent's
* session header id and the source is the tool execution identity. A missing
* backend, a call with no session owner, or a `saveText()` rejection logs a
* warning and returns `undefined` — the caller keeps the inline result and
* reports that the complete result could not be saved; search success never
* turns into `isError` because spill storage is unavailable.
*
* @param ctx - the plugin context; `spillStore` is looked up opportunistically.
* @param exec - the tool-execution context; supplies the owning session, tool name, and call id.
* @param suggestedName - the backend-sanitized filename hint (e.g. `grep-results.txt`).
* @param content - the complete formatted result to persist.
* @returns the saved spill reference, or `undefined` when the result could not be saved.
*/
async function trySaveFormattedResult(ctx, exec, suggestedName, content) {
	const sessionId = exec.agent?.session.header.id;
	if (sessionId === void 0) {
		ctx.logger.warn(`tool-fs-search: no session owner for ${exec.name} result; complete result not saved`);
		return;
	}
	const spillStore = ctx.get("spillStore");
	if (!spillStore) {
		ctx.logger.warn(`tool-fs-search: no ctx.spillStore backend loaded; complete ${exec.name} result not saved`);
		return;
	}
	const save = {
		owner: { sessionId },
		source: {
			kind: "tool",
			toolName: exec.name,
			callId: exec.callId,
			label: "result"
		},
		suggestedName,
		content
	};
	try {
		return await spillStore.saveText(save);
	} catch (error) {
		ctx.logger.warn(`tool-fs-search: saveText failed for ${exec.name}: ${String(error)}; complete result not saved`);
		return;
	}
}
//#endregion
//#region lib/types/presentation.js
/**
* Result-time search-card presentation for `grep` and `glob`. Both tools land on
* one `card: 'search'` render intent ({@link SearchResultView}) with two
* `shape`-discriminated variants: `grep` projects its matches grouped by file
* ({@link SearchMatchesResultView}), `glob` projects a flat path list
* ({@link SearchPathsResultView}). This module owns the value→`presentationMeta`
* projection each tool declares and the defensive `meta`→view narrowing each
* tool's `presentResult` reads back on replay.
*
* The canonical value never crosses the wire — only the model-facing render text
* and this JSON `meta` do — so the structured shape a UI renders MUST ride in
* `meta`. Each projection consumes the SAME retained matches/paths the
* model-facing render consumes ({@link module:@deepseek-ai/dsh-tool-fs-search/search-core}
* `retainGrepMatches`/`retainGlobPaths`), so text and card agree about which
* results survived the inline cap, and reports `total` (every result found) and
* `truncated`, so a UI never presents a capped result as complete.
*
* A second, independent cap bounds the JSON `meta` itself: the retained matches
* of a broad search (hundreds of long lines) can still serialize to hundreds of
* kilobytes, and `meta` is persisted with the session log and re-sent on every
* request. {@link capMetaBytes} drops trailing groups/paths until the serialized
* `meta` fits `maxMetaBytes` and marks the result `truncated`; a deployment's
* final output budget (`dsh-spill-policy`) only shrinks `content`, never `meta`,
* so this projection owns keeping `meta` bounded.
*
* @module @deepseek-ai/dsh-tool-fs-search/presentation
*/
/**
* Group flat matches by file (first-seen order) into the structured by-file shape
* a UI renders as expandable per-file groups. The grouping matches the
* model-facing text grouping
* ({@link module:@deepseek-ai/dsh-tool-fs-search/grep} `formatGrepMatches`), so
* card and text agree about file order and membership.
*
* @param matches - the retained matches to group, in output order.
* @returns one entry per file, in first-seen order.
*/
function groupMatchesByFile(matches) {
	const byFile = /* @__PURE__ */ new Map();
	for (const match of matches) {
		const entry = {
			lineNumber: match.lineNumber,
			line: match.line
		};
		const group = byFile.get(match.path);
		if (group !== void 0) group.push(entry);
		else byFile.set(match.path, [entry]);
	}
	return Array.from(byFile, ([path, fileMatches]) => ({
		path,
		matches: fileMatches
	}));
}
/** The serialized UTF-8 byte size of one meta payload (the size persisted and re-sent). */
function metaBytes(meta) {
	return Buffer.byteLength(JSON.stringify(meta), "utf8");
}
/**
* Drop trailing top-level items (file groups or paths) until the serialized meta
* fits `maxMetaBytes`, marking the result `truncated` when anything was dropped.
* `total` is preserved (it counts what the search found, not what meta retains).
* A single item too large to fit on its own is kept: the invariant is a bounded
* payload wherever droppable, never an empty card that hides a real result.
*
* @param meta - the projected meta, already capped to the inline item count.
* @param maxMetaBytes - the serialized-meta byte budget.
* @returns the same meta when it fits, else a byte-bounded copy marked `truncated`.
*/
function capMetaBytes(meta, maxMetaBytes) {
	if (metaBytes(meta) <= maxMetaBytes) return meta;
	if (meta.shape === "matches") {
		const files = [...meta.files];
		while (files.length > 1 && metaBytes({
			...meta,
			files,
			truncated: true
		}) > maxMetaBytes) files.pop();
		return {
			...meta,
			files,
			truncated: true
		};
	}
	const paths = [...meta.paths];
	while (paths.length > 1 && metaBytes({
		...meta,
		paths,
		truncated: true
	}) > maxMetaBytes) paths.pop();
	return {
		...meta,
		paths,
		truncated: true
	};
}
/**
* Project the retained `grep` matches into {@link SearchMeta} for the search
* card. Consumes the same {@link RetainedItems} the model-facing render consumes
* (preview budget and inline match cap already applied), groups the retained
* matches by file, reports `total` (every parsed match) and `truncated`, then
* bounds the serialized meta to `maxMetaBytes`.
*
* @param retained - the retention outcome over every parsed match (previewed, capped).
* @param maxMetaBytes - the serialized-meta byte budget.
* @returns the `matches`-shaped search metadata.
*/
function grepSearchMeta(retained, maxMetaBytes) {
	return capMetaBytes({
		shape: "matches",
		files: groupMatchesByFile(retained.items),
		truncated: retained.truncated,
		total: retained.seen
	}, maxMetaBytes);
}
/**
* Project the retained `glob` paths into {@link SearchMeta} for the search card.
* Consumes the same {@link RetainedItems} the model-facing render consumes (inline
* path cap already applied), reports `total` (every discovered path) and
* `truncated`, then bounds the serialized meta to `maxMetaBytes`.
*
* @param retained - the retention outcome over every discovered path (capped).
* @param maxMetaBytes - the serialized-meta byte budget.
* @returns the `paths`-shaped search metadata.
*/
function globSearchMeta(retained, maxMetaBytes) {
	return capMetaBytes({
		shape: "paths",
		paths: retained.items,
		truncated: retained.truncated,
		total: retained.seen
	}, maxMetaBytes);
}
/** Whether `value` is a valid {@link SearchLineMatch} (defensive narrowing from opaque `meta`). */
function isSearchLineMatch(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const { lineNumber, line } = value;
	return typeof lineNumber === "number" && typeof line === "string";
}
/** Whether `value` is a valid {@link SearchFileMatches} (defensive narrowing from opaque `meta`). */
function isSearchFileMatches(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const { path, matches } = value;
	return typeof path === "string" && Array.isArray(matches) && matches.every(isSearchLineMatch);
}
/**
* Narrow opaque live or replayed result metadata to a {@link SearchResultView}.
* Malformed metadata returns `undefined` so `presentResult` can fall back to the
* generic card instead of throwing during replay of an older or hand-edited log.
* The view carries no result text: a UI without a search card falls back to the
* raw `tool/result` content.
*
* A zero-result meta (`files: []` / `paths: []`) narrows to a valid empty card —
* unlike the mirrored `diffsFromMeta`, which rejects empty diffs, because a
* zero-match grep is a legitimate result a UI shows as "no matches", not an
* absent projection.
*
* @param meta - result metadata (the {@link SearchMeta} the tool projected).
* @returns the search view, or `undefined` for absent or malformed metadata.
*/
function searchViewFromMeta(meta) {
	if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return void 0;
	const record = meta;
	const { truncated, total } = record;
	if (typeof truncated !== "boolean" || typeof total !== "number") return void 0;
	if (record.shape === "matches") {
		const { files } = record;
		if (!Array.isArray(files) || !files.every(isSearchFileMatches)) return void 0;
		return {
			card: "search",
			shape: "matches",
			files,
			truncated,
			total
		};
	}
	if (record.shape === "paths") {
		const { paths } = record;
		if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string")) return void 0;
		return {
			card: "search",
			shape: "paths",
			paths,
			truncated,
			total
		};
	}
}
//#endregion
//#region lib/types/direct-call.js
/** Shared top-level-call post-policy selection for search result spill. @module dsh-tool-fs-search/direct-call */
/**
* Return the accepted canonical value only when this tool still owns a direct
* successful top-level call and no downstream policy replaced either projection.
* @param ctx - the tool plugin context used to resolve the live scoped owner.
* @param tool - the exact registered definition whose value may be projected.
* @param exec - the completed execution identity.
* @param result - the canonical result before post-policy decisions are applied.
* @param decision - the composed downstream post-policy decision.
* @returns the canonical value to project, or `undefined` when spill must defer.
*/
function acceptedDirectCallValue(ctx, tool, exec, result, decision) {
	if (decision.kind !== "accept" || decision.content !== void 0 || Object.hasOwn(decision, "value") || exec.parent !== void 0 || exec.name !== tool.name || result.isError || ctx.tools.get(exec.name, exec.agent) !== tool) return void 0;
	return result.value;
}
//#endregion

export {};
