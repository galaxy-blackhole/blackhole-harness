/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN 2/2 của bundle gốc @deepseek-ai/dsh-tool-fs-search (dòng 522–1272: glob + grep + index), chia tại ranh giới //#region gần nhất, không sửa tay
 */
// @ts-nocheck

//#region lib/types/glob.js
/**
* The model-facing `glob` tool: discover files whose paths match a glob
* pattern, sorted by modification time. Execution spawns the packaged
* ripgrep binary (`@vscode/ripgrep`) directly through the subprocess seam
* with a plain argv vector — this module owns the model-facing schema,
* argument validation, argv construction, result parsing, inline sampling,
* and formatting; process concerns (spawn execution, tree termination,
* environment scrubbing, output capture) stay behind `ctx.subprocess`.
* @module @deepseek-ai/dsh-tool-fs-search/glob
*/
/**
* Default cap on paths retained inline by one `glob` call (the `globMaxResults`
* config), matching Claude Code's default `GlobTool` result limit.
*/
const GLOB_MAX_RESULTS = 100;
/**
* Directory names ripgrep must never descend into for a discovery listing: VCS
* metadata stores. `--no-ignore --hidden` would otherwise surface them in every
* broad search. Each name is excluded with TWO negated `--glob`s (see
* {@link buildGlobCommand}): an any-depth directory glob that matches — and
* prunes — the directory during traversal, and a contents glob that still
* excludes the internals when the search root itself is at or inside the
* directory (an explicit `path` of `.git` or `sub/.git`), where the prune glob
* alone never matches.
*/
const GLOB_VCS_EXCLUDES = [
	".git",
	".svn",
	".hg",
	".bzr",
	".jj",
	".sl"
];
/**
* Validate value constraints the schema DSL can't express: a non-blank
* `pattern`, and a non-blank `path` when given. Throws a plain `Error` (an
* ordinary tool argument error) otherwise.
*
* @param args - the schema-validated `glob` arguments.
* @returns the accepted input, unchanged.
*/
function parseGlobArgs(args) {
	if (args.pattern.trim().length === 0) throw new Error("pattern must be a non-empty string");
	if (args.path !== void 0 && args.path.trim().length === 0) throw new Error("path must be a non-empty string when given");
	return {
		pattern: args.pattern,
		...args.path !== void 0 ? { path: args.path } : {}
	};
}
/**
* Build the fixed `rg --files` argv for one `glob` call. Every
* model-controlled value ({@link GlobInput.pattern}, {@link GlobInput.path})
* is a plain argv element — no shell layer exists, so no quoting applies; the
* search root rides behind `--` so a leading-dash path can never be parsed as
* a flag. `--sort=modified` orders by modification time, `--no-ignore
* --hidden` searches ignored and hidden files, and
* {@link GLOB_VCS_EXCLUDES} keeps VCS metadata out.
*
* @param input - the validated arguments.
* @returns the complete ripgrep argument vector (excluding the binary itself).
*/
function buildGlobCommand(input) {
	const parts = [
		"--files",
		`--glob=${input.pattern}`,
		"--sort=modified",
		"--no-ignore",
		"--hidden",
		...GLOB_VCS_EXCLUDES.flatMap((name) => [`--glob=!**/${name}`, `--glob=!**/${name}/**`])
	];
	if (input.path !== void 0) parts.push("--", input.path);
	return parts;
}
/** Remove the displayed search-root prefix before choosing a top-level group. */
function relativeToSearchRoot(path, root) {
	if (root === ".") return path.startsWith(`.${sep}`) ? path.slice(2) : path;
	let rootEnd = root.length;
	while (rootEnd > 0 && root[rootEnd - 1] === sep) rootEnd -= 1;
	const trimmedRoot = root.slice(0, rootEnd);
	if (trimmedRoot.length === 0) return stripLeadingSeparators(path);
	if (path === trimmedRoot) return "";
	if (path.startsWith(`${trimmedRoot}${sep}`)) return path.slice(trimmedRoot.length + 1);
	return path;
}
/** Strip only separators recognized by the execution platform. */
function stripLeadingSeparators(path) {
	let start = 0;
	while (path[start] === sep) start += 1;
	return path.slice(start);
}
/**
* The leading path segment of one display path — the top-level entry, relative
* to the search root, that the path sits under. A path with no separator is its
* own top-level entry. Leading separators are stripped first so an absolute path
* (one outside the workdir, which {@link toWorkdirRelative} leaves untouched)
* groups by its first real name instead of collapsing every such path into one
* empty group.
*/
function topLevelSegment(path) {
	const trimmed = stripLeadingSeparators(path);
	const cut = trimmed.indexOf(sep);
	return cut === -1 ? trimmed : trimmed.slice(0, cut);
}
/**
* Choose the inline page of an over-cap result by round-robin across the
* complete result's top-level entries, instead of taking its head.
*
* Every top-level entry receives a slot before any receives a second; exhausted
* groups drop out. Group order and order within each group follow `paths`, so a
* flat result reproduces the modification-time head.
*
* @param paths - the complete result, in ripgrep's modification-time order.
* @param maxItems - how many paths the page may hold; the caller has already established it is smaller than `paths`.
* @param root - the search root in the same display-path space as `paths`.
* @returns the page grouped by top-level entry, with the shown/total top-level spread.
*/
function sampleAcrossTopLevel(paths, maxItems, root = ".") {
	const groups = /* @__PURE__ */ new Map();
	let active = [];
	for (const path of paths) {
		const key = topLevelSegment(relativeToSearchRoot(path, root));
		const group = groups.get(key);
		if (group === void 0) {
			const items = [path];
			groups.set(key, items);
			active.push({
				key,
				items,
				index: 0,
				current: path
			});
		} else group.push(path);
	}
	const taken = /* @__PURE__ */ new Map();
	let count = 0;
	while (active.length > 0 && count < maxItems) {
		const nextActive = [];
		for (const { key, items, index, current } of active) {
			if (count >= maxItems) break;
			count += 1;
			const bucket = taken.get(key);
			if (bucket === void 0) taken.set(key, [current]);
			else bucket.push(current);
			const nextIndex = index + 1;
			const nextPath = items[nextIndex];
			if (nextPath !== void 0) nextActive.push({
				key,
				items,
				index: nextIndex,
				current: nextPath
			});
		}
		active = nextActive;
	}
	return {
		items: [...taken.values()].flat(),
		shown: taken.size,
		total: groups.size
	};
}
/**
* Format a capped sampled page and its complete-result recovery path. A flat
* result keeps the plain footer because its sample is the modification-time head.
*
* @param sample - the inline page and its top-level spread.
* @param seen - how many paths the complete result holds; always more than the page.
* @param spillRef - the saved complete-result reference, or `undefined` when unsaved.
* @returns the model-facing text.
*/
function formatGlobOutput(sample, seen, spillRef) {
	const basis = sample.total === seen ? "." : `, sampled across ${sample.shown} of the ${sample.total} top-level entries this pattern matched instead of taken in modification-time order.` + (sample.shown < sample.total ? " Narrow path to inspect a specific subtree." : "");
	return formatGlobPage(sample.items, seen, spillRef, basis);
}
/** Format one bounded page and the recovery path for its complete sorted result. */
function formatGlobPage(items, seen, spillRef, basis) {
	const body = items.join("\n");
	const recovery = spillRef !== void 0 ? `Full sorted result stored at: ${spillRef.locator}. ${spillRef.retrievalHint}` : "The complete result could not be saved; narrow pattern or path to see more.";
	return `${body}\n\n(Showing ${items.length} of ${seen} paths${basis} ${recovery})`;
}
/** Bound and format one canonical path list for the Native surface relative to its search root. */
function renderGlobPaths(paths, caps, root, spillRef) {
	if (paths.length === 0) return "No files found";
	if (paths.length <= caps.maxResults) return paths.join("\n");
	if (!caps.sampleOverCapGlobResults) return formatGlobPage(paths.slice(0, caps.maxResults), paths.length, spillRef, ".");
	return formatGlobOutput(sampleAcrossTopLevel(paths, caps.maxResults, root), paths.length, spillRef);
}
/**
* The inline page of paths a completed `glob` card shows, computed the SAME way
* {@link renderGlobPaths} computes its model-facing page so the card and the text
* agree on which paths survived the cap. A result within the cap is shown whole;
* an over-cap result is either the modification-time head or the top-level sample,
* matching the deployment's `sampleOverCapGlobResults`.
*
* @param paths - the complete discovered path list, in modification-time order.
* @param caps - the resolved glob caps (the inline cap and the sampling switch).
* @param root - the search root in the same display-path space as `paths`.
* @returns the inline page and whether the complete result was capped.
*/
function globCardPage(paths, caps, root) {
	if (paths.length <= caps.maxResults) return {
		items: paths,
		truncated: false
	};
	if (!caps.sampleOverCapGlobResults) return {
		items: paths.slice(0, caps.maxResults),
		truncated: true
	};
	return {
		items: sampleAcrossTopLevel(paths, caps.maxResults, root).items,
		truncated: true
	};
}
/**
* Pending-call presentation: a search card titled by the pattern (and root).
*
* @param args - the raw tool arguments; `pattern` and `path` feed the title.
* @returns the generic card view (`kind: 'search'`) shown while the call runs.
*/
function presentGlobCall(args) {
	const where = args.path !== void 0 ? ` in ${args.path}` : "";
	return {
		card: "generic",
		title: `Glob ${args.pattern}${where}`,
		kind: "search",
		rawInput: args.pattern
	};
}
/**
* Completed-call presentation: the search card projected from the result's
* `presentationMeta` (the discovered path list, with the truncation signal). A UI
* without a search card falls back to the raw `tool/result` content, so the view
* carries no result text of its own. Malformed or absent metadata (an obsolete or
* hand-edited replayed log) falls back to the generic card.
*
* @param _args - the raw tool arguments; unused, the view derives from the result.
* @param result - the final model-facing tool result carrying the projected metadata.
* @returns the search card view, or `undefined` for the generic fallback.
*/
function presentGlobResult(_args, result) {
	if (result.isError) return void 0;
	const view = searchViewFromMeta(result.meta);
	if (view === void 0 || view.shape !== "paths") return void 0;
	return view;
}
/**
* Register the `glob` tool and its scope-aware system-prompt guidance.
*
* @param ctx - the plugin context; registrations are effects scoped to it, and
*   execution uses its `subprocess` service.
* @param caps - the deployment's resolved glob caps (plugin config after defaulting).
*/
function applyGlobTool(ctx, caps) {
	ctx.systemPrompt.section({
		name: "tool:glob",
		order: ctx.systemPrompt.getSectionOrder("TOOL_GLOB"),
		text: ({ scope }) => ctx.tools.get("glob", scope) === void 0 ? "" : "Use the glob tool — not shell find — to discover files by path pattern."
	});
	const overCapDescription = caps.sampleOverCapGlobResults ? "is sampled across top-level entries" : "keeps the first paths";
	const tool = defineTool({
		name: "glob",
		description: `Find files, not directories, whose paths match a glob pattern, including hidden and ignored files. Returns up to ${caps.maxResults} paths in modification-time order; a larger result ${overCapDescription} and reports where the complete list was saved.`,
		parameters: {
			pattern: {
				type: "string",
				required: true,
				description: "Glob pattern to match file paths against (e.g. \"**/*.ts\", \"src/**/*.test.js\"). A pattern with no \"/\" matches the basename at any depth, so \"*\" and \"*.ts\" both search the whole tree; include a separator to anchor the depth."
			},
			path: {
				type: "string",
				description: "Directory to search in. Defaults to the session workspace; a relative path resolves against it."
			}
		},
		timeoutMs: caps.timeoutMs,
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					root: {
						type: "string",
						required: true
					},
					paths: {
						type: "array",
						required: true,
						items: { type: "string" }
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: renderGlobPaths(value.paths, caps, value.root)
			}],
			presentationMeta: (_args, value) => {
				const page = globCardPage(value.paths, caps, value.root);
				return globSearchMeta({
					items: page.items,
					truncated: page.truncated,
					seen: value.paths.length
				}, caps.maxMetaBytes);
			}
		},
		async execute(args, exec) {
			const input = parseGlobArgs(args);
			const run = await runRipgrep(ctx, exec, "glob", buildGlobCommand(input), caps.rawOutputMaxBytes, caps.graceMs, caps.stderrMaxBytes);
			const root = input.path === void 0 ? "." : toWorkdirRelative(input.path, run.workdir);
			if (run.noMatches) return {
				root,
				paths: []
			};
			const all = [];
			for (const line of run.stdout.split("\n")) {
				if (line.length === 0) continue;
				const displayPath = toWorkdirRelative(line, run.workdir);
				all.push(displayPath);
			}
			return {
				root,
				paths: all
			};
		},
		presentCall: presentGlobCall,
		presentResult: presentGlobResult
	});
	ctx.tools.register(tool);
	ctx.on("tools/post-execute", async (exec, result, next) => {
		const decision = await next();
		const value = acceptedDirectCallValue(ctx, tool, exec, result, decision);
		if (value === void 0) return decision;
		const paths = value.paths;
		if (paths.length <= caps.maxResults) return decision;
		const spillRef = await trySaveFormattedResult(ctx, exec, "glob-results.txt", paths.join("\n"));
		return {
			kind: "accept",
			content: [{
				type: "text",
				text: renderGlobPaths(paths, caps, value.root, spillRef)
			}],
			...decision.additionalContexts !== void 0 ? { additionalContexts: decision.additionalContexts } : {}
		};
	});
}
//#endregion
//#region lib/types/grep.js
/**
* The model-facing `grep` tool: search file contents with a ripgrep regular
* expression. Execution spawns the packaged ripgrep binary
* (`@vscode/ripgrep`) directly through the subprocess seam with a plain argv
* vector using a fixed line-oriented `rg --json` command so file path, line
* number, and line text parse without colon-splitting ambiguity — this module
* owns the model-facing schema, argument validation, argv construction,
* `--json` record parsing, per-line preview retention, match retention,
* grouping, and formatting; process concerns stay behind `ctx.subprocess`.
*
* @module @deepseek-ai/dsh-tool-fs-search/grep
*/
/**
* Default cap on flat matches retained inline by one `grep` call (the
* `grepMaxMatches` config), matching Claude Code's default `GrepTool`
* `head_limit`.
*/
const GREP_MAX_MATCHES = 250;
/**
* Default cap in bytes on one matched-line preview (the `grepMaxLineBytes`
* config); the cut preserves UTF-8 boundaries.
*/
const GREP_MAX_LINE_BYTES = 2e3;
/**
* Reject an `include` that is not ONE positive glob filter: blank strings,
* negated patterns (`!…`), and comma-separated lists. A comma inside a brace
* group is fine — `*.{ts,tsx}` is one glob with alternation, not a list.
*/
function validateInclude(include) {
	if (include.trim().length === 0) throw new Error("include must be a non-empty glob when given");
	if (include.startsWith("!")) throw new Error("include must be a positive glob filter; negated patterns (\"!…\") are not supported");
	let braceDepth = 0;
	for (const char of include) if (char === "{") braceDepth++;
	else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
	else if (char === "," && braceDepth === 0) throw new Error("include must be one glob, not a comma-separated list (use {a,b} alternation instead)");
}
/**
* Validate value constraints the schema DSL can't express: a non-EMPTY
* `pattern` (whitespace is a legitimate regex), a non-blank `path` when given,
* and a single positive `include` glob ({@link GrepInput}). Throws a plain
* `Error` (an ordinary tool argument error) otherwise.
*
* @param args - the schema-validated `grep` arguments.
* @returns the accepted input, unchanged.
*/
function parseGrepArgs(args) {
	if (args.pattern.length === 0) throw new Error("pattern must be a non-empty string");
	if (args.path !== void 0 && args.path.trim().length === 0) throw new Error("path must be a non-empty string when given");
	if (args.include !== void 0) validateInclude(args.include);
	return {
		pattern: args.pattern,
		...args.path !== void 0 ? { path: args.path } : {},
		...args.include !== void 0 ? { include: args.include } : {}
	};
}
/**
* Build the fixed line-oriented `rg --json` argv for one `grep` call. Every
* model-controlled value ({@link GrepInput.pattern}, {@link GrepInput.path},
* {@link GrepInput.include}) is a plain argv element — no shell layer exists,
* so no quoting applies; the pattern and include ride in `--flag=value` form
* and the target behind `--`, so a leading-dash value can never be parsed as
* a flag.
*
* @param input - the validated arguments.
* @returns the complete ripgrep argument vector (excluding the binary itself).
*/
function buildGrepCommand(input) {
	const parts = ["--json", `--regexp=${input.pattern}`];
	if (input.include !== void 0) parts.push(`--glob=${input.include}`);
	if (input.path !== void 0) parts.push("--", input.path);
	return parts;
}
/**
* The uniform malformed-output failure: raw `rg --json` is an internal
* transport, so missing or invalid response fields cause a search failure, not a partial result.
*/
function malformedRecord(detail, cause) {
	return new SearchError(`grep received malformed ripgrep --json output (${detail})`, "SEARCH_FAILED", cause !== void 0 ? { cause } : void 0);
}
/**
* Parse one `rg --json` NDJSON line into a match, `undefined` for the
* non-match record types (`begin`/`end`/`context`/`summary`). A line that is
* not JSON, or a `match` record missing its path / line number / line content,
* throws {@link SearchError} `SEARCH_FAILED`. A match whose line is not valid
* UTF-8 (ripgrep sends base64 `bytes` instead of `text`) yields a placeholder
* preview rather than failing the whole search.
*/
function parseRecord(line) {
	let parsed;
	try {
		parsed = JSON.parse(line);
	} catch (error) {
		throw malformedRecord("a line is not JSON", error);
	}
	if (typeof parsed !== "object" || parsed === null) throw malformedRecord("a record is not an object");
	const record = parsed;
	if (record.type !== "match") return void 0;
	if (typeof record.data !== "object" || record.data === null) throw malformedRecord("a match record has no data");
	const data = record.data;
	const pathText = typeof data.path === "object" && data.path !== null ? data.path.text : void 0;
	if (typeof pathText !== "string") throw malformedRecord("a match record has no path text");
	if (typeof data.line_number !== "number") throw malformedRecord("a match record has no line number");
	if (typeof data.lines !== "object" || data.lines === null) throw malformedRecord("a match record has no line content");
	const lines = data.lines;
	if (typeof lines.text === "string") return {
		path: pathText,
		lineNumber: data.line_number,
		line: lines.text.replace(/\r?\n$/, "")
	};
	if (typeof lines.bytes === "string") return {
		path: pathText,
		lineNumber: data.line_number,
		line: "(line is not valid UTF-8)"
	};
	throw malformedRecord("a match record has neither line text nor bytes");
}
/**
* Parse complete `rg --json` stdout into flat matches, in output order (ripgrep
* emits one file's matches contiguously). Only `match` records are consumed.
*
* @param stdout - the complete raw `rg --json` stdout.
* @returns the flat matches; empty for output with no match records.
*/
function parseGrepMatches(stdout) {
	const matches = [];
	for (const line of stdout.split("\n")) {
		if (line.length === 0) continue;
		const match = parseRecord(line);
		if (match !== void 0) matches.push(match);
	}
	return matches;
}
/** `match` / `matches` for a count. */
function matchNoun(count) {
	return count === 1 ? "match" : "matches";
}
/**
* Group flat matches by file (first-seen order) into the model-facing body:
* each file's display path, then one `Line N: <text>` row per match.
*
* @param matches - the flat matches to render.
* @returns the grouped body text.
*/
function formatGrepMatches(matches) {
	const byFile = /* @__PURE__ */ new Map();
	for (const match of matches) {
		const group = byFile.get(match.path);
		if (group !== void 0) group.push(match);
		else byFile.set(match.path, [match]);
	}
	const sections = [];
	for (const [path, group] of byFile) sections.push(`${path}\n${group.map((m) => `Line ${m.lineNumber}: ${m.line}`).join("\n")}`);
	return sections.join("\n\n");
}
/**
* Format the model-facing `grep` result: a found-count header, the retained
* matches grouped by file, then — when the result was capped — a footer
* carrying either the formatted-spill recovery locator or the could-not-save
* explanation. The omitted count is a budget fact: the search itself completed.
*
* @param retained - the retention outcome over every parsed match.
* @param spillRef - the saved complete-result reference, or `undefined` when unsaved.
* @returns the model-facing text.
*/
function formatGrepOutput(retained, spillRef) {
	const header = retained.truncated ? `Found ${retained.kept} of ${retained.seen} matches` : `Found ${retained.seen} ${matchNoun(retained.seen)}`;
	const body = formatGrepMatches(retained.items);
	if (!retained.truncated) return `${header}\n\n${body}`;
	return `${header}\n\n${body}\n\n(${spillRef !== void 0 ? `Full grep result stored at: ${spillRef.locator}. ${spillRef.retrievalHint}` : "The complete result could not be saved; narrow pattern, path, or include to see more."})`;
}
/** Format one already-retained match list for the Native surface. */
function formatRetainedGrep(retained, spillRef) {
	if (retained.seen === 0) return "No matches found";
	return formatGrepOutput(retained, spillRef);
}
/**
* Pending-call presentation: a search card titled by the pattern (and target /
* include filter).
*
* @param args - the raw tool arguments; `pattern`, `path`, and `include` feed the title.
* @returns the generic card view (`kind: 'search'`) shown while the call runs.
*/
function presentGrepCall(args) {
	const where = args.path !== void 0 ? ` in ${args.path}` : "";
	const filter = args.include !== void 0 ? ` (${args.include})` : "";
	return {
		card: "generic",
		title: `Grep ${args.pattern}${where}${filter}`,
		kind: "search",
		rawInput: args.pattern
	};
}
/**
* Completed-call presentation: the search card projected from the result's
* `presentationMeta` (matches grouped by file, with the truncation signal). A UI
* without a search card falls back to the raw `tool/result` content, so the view
* carries no result text of its own. Malformed or absent metadata (an obsolete or
* hand-edited replayed log) falls back to the generic card.
*
* @param _args - the raw tool arguments; unused, the view derives from the result.
* @param result - the final model-facing tool result carrying the projected metadata.
* @returns the search card view, or `undefined` for the generic fallback.
*/
function presentGrepResult(_args, result) {
	if (result.isError) return void 0;
	const view = searchViewFromMeta(result.meta);
	if (view === void 0 || view.shape !== "matches") return void 0;
	return view;
}
/**
* Register the `grep` tool and its scope-aware system-prompt guidance.
*
* @param ctx - the plugin context; registrations are effects scoped to it, and
*   execution uses its `subprocess` service.
* @param caps - the deployment's resolved grep caps (plugin config after defaulting).
*/
function applyGrepTool(ctx, caps) {
	ctx.systemPrompt.section({
		name: "tool:grep",
		order: ctx.systemPrompt.getSectionOrder("TOOL_GREP"),
		text: ({ scope }) => ctx.tools.get("grep", scope) === void 0 ? "" : "Use the grep tool — not shell grep or rg — to search file contents." + (ctx.tools.get("read", scope) === void 0 ? "" : " Use read on a matched file when you need surrounding context.")
	});
	const tool = defineTool({
		name: "grep",
		description: `Search file contents with a ripgrep regular expression. Returns matching lines with line numbers, grouped by file. Returns up to ${caps.maxMatches} matches; a larger result reports where the complete match list was saved.`,
		parameters: {
			pattern: {
				type: "string",
				required: true,
				description: "Regular expression to search for (ripgrep syntax)."
			},
			path: {
				type: "string",
				description: "File or directory to search. Defaults to the session workspace; a relative path resolves against it."
			},
			include: {
				type: "string",
				description: "One glob filter for which files to search (e.g. \"*.ts\", \"*.{js,jsx}\"). Not a list; negation is not supported."
			}
		},
		timeoutMs: caps.timeoutMs,
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { matches: {
					type: "array",
					required: true,
					items: {
						type: "object",
						additionalProperties: false,
						properties: {
							path: {
								type: "string",
								required: true
							},
							lineNumber: {
								type: "integer",
								required: true
							},
							line: {
								type: "string",
								required: true
							}
						}
					}
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: formatRetainedGrep(retainGrepMatches(value.matches, caps.maxMatches, caps.maxLineBytes))
			}],
			presentationMeta: (_args, value) => grepSearchMeta(retainGrepMatches(value.matches, caps.maxMatches, caps.maxLineBytes), caps.maxMetaBytes)
		},
		async execute(args, exec) {
			const run = await runRipgrep(ctx, exec, "grep", buildGrepCommand(parseGrepArgs(args)), caps.rawOutputMaxBytes, caps.graceMs, caps.stderrMaxBytes);
			if (run.noMatches) return { matches: [] };
			const all = [];
			for (const raw of parseGrepMatches(run.stdout)) {
				const match = {
					path: toWorkdirRelative(raw.path, run.workdir),
					lineNumber: raw.lineNumber,
					line: raw.line
				};
				all.push(match);
			}
			return { matches: all };
		},
		presentCall: presentGrepCall,
		presentResult: presentGrepResult
	});
	ctx.tools.register(tool);
	ctx.on("tools/post-execute", async (exec, result, next) => {
		const decision = await next();
		const value = acceptedDirectCallValue(ctx, tool, exec, result, decision);
		if (value === void 0) return decision;
		const matches = value.matches;
		if (matches.length <= caps.maxMatches) return decision;
		const previewedAll = matches.map((match) => ({
			...match,
			line: previewLine(match.line, caps.maxLineBytes)
		}));
		const spillRef = await trySaveFormattedResult(ctx, exec, "grep-results.txt", `Found ${matches.length} ${matchNoun(matches.length)}\n\n${formatGrepMatches(previewedAll)}`);
		return {
			kind: "accept",
			content: [{
				type: "text",
				text: formatRetainedGrep(retainGrepMatches(matches, caps.maxMatches, caps.maxLineBytes), spillRef)
			}],
			...decision.additionalContexts !== void 0 ? { additionalContexts: decision.additionalContexts } : {}
		};
	});
}
//#endregion
//#region lib/types/index.js
/**
* The model-facing filesystem discovery tool suite (`glob`, `grep`) over the
* packaged ripgrep binary (`@vscode/ripgrep`). This single plugin registers
* both tools; the binary ships inside the npm dependency, so no system `rg`
* install and no shell layer is involved.
*
* ## Spawn-backed, not a `ctx.fs` provider method
*
* Local workspace discovery is a process-backed `rg` workflow, so these tools
* execute through `ctx.subprocess.spawn()` with fixed ripgrep argv templates —
* never `ctx.shell`, never `ctx.shell.start()`, never a model-visible background
* task. The tool layer owns schemas, argument validation, argv construction
* ({@link module:@deepseek-ai/dsh-tool-fs-search/glob} /
* {@link module:@deepseek-ai/dsh-tool-fs-search/grep}), result parsing,
* retention, formatted-result spill, and timeout declaration; the subprocess
* seam owns spawn execution, process-tree termination, environment scrubbing,
* and raw output capture. The package injects `tools`, `systemPrompt`, and
* `subprocess` — deliberately NOT `fs`, and `ctx.spillStore` is read
* opportunistically with `ctx.get()` because formatted-result spill is optional.
*
* Returned paths are displayed relative to the resolved workdir and are
* follow-up-readable only in co-located deployments where the workdir and the
* filesystem `read` root are the same workspace — a documented v1 deployment
* requirement, not runtime-validated.
*
* @module @deepseek-ai/dsh-tool-fs-search
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "tool-fs-search";
/** Services required by the search tool suite (`spillStore` is optional, read via `ctx.get()`). */
const inject = [
	"tools",
	"systemPrompt",
	"subprocess",
	"workingDirectory"
];
const Config = z.object({
	sampleOverCapGlobResults: z.boolean().required(),
	globMaxResults: z.number().default(100),
	grepMaxMatches: z.number().default(250),
	grepMaxLineBytes: z.number().default(GREP_MAX_LINE_BYTES),
	searchMetaMaxBytes: z.number().default(SEARCH_META_MAX_BYTES),
	rawOutputMaxBytes: z.number().default(RAW_OUTPUT_MAX_BYTES),
	graceMs: z.number().default(SEARCH_GRACE_MS),
	stderrMaxBytes: z.number().default(SEARCH_STDERR_MAX_BYTES),
	timeoutMs: z.number().default(SEARCH_TIMEOUT_MS)
});
/** Every search cap counts items/bytes/milliseconds — a positive integer, or retention and timeout arithmetic misbehaves silently. */
function assertPositiveInteger(name, value) {
	if (!Number.isInteger(value) || value < 1) throw new Error(`tool-fs-search: ${name} must be a positive integer`);
}
/**
* Register the `glob`/`grep` filesystem discovery tool suite. The packaged
* ripgrep binary is always available (an npm dependency), so registration is
* unconditional.
*
* @param ctx - plugin context; registrations are effects scoped to this plugin.
* @param config - resolved plugin configuration from schemastery.
*/
async function apply(ctx, config) {
	const resolved = config;
	assertPositiveInteger("globMaxResults", resolved.globMaxResults);
	assertPositiveInteger("grepMaxMatches", resolved.grepMaxMatches);
	assertPositiveInteger("grepMaxLineBytes", resolved.grepMaxLineBytes);
	assertPositiveInteger("searchMetaMaxBytes", resolved.searchMetaMaxBytes);
	assertPositiveInteger("rawOutputMaxBytes", resolved.rawOutputMaxBytes);
	assertPositiveInteger("graceMs", resolved.graceMs);
	if (resolved.graceMs > MAX_TIMER_DELAY_MS) throw new Error(`tool-fs-search: graceMs must be no greater than ${MAX_TIMER_DELAY_MS}`);
	assertPositiveInteger("stderrMaxBytes", resolved.stderrMaxBytes);
	assertPositiveInteger("timeoutMs", resolved.timeoutMs);
	applyGlobTool(ctx, {
		sampleOverCapGlobResults: resolved.sampleOverCapGlobResults,
		maxResults: resolved.globMaxResults,
		maxMetaBytes: resolved.searchMetaMaxBytes,
		rawOutputMaxBytes: resolved.rawOutputMaxBytes,
		graceMs: resolved.graceMs,
		stderrMaxBytes: resolved.stderrMaxBytes,
		timeoutMs: resolved.timeoutMs
	});
	applyGrepTool(ctx, {
		maxMatches: resolved.grepMaxMatches,
		maxLineBytes: resolved.grepMaxLineBytes,
		maxMetaBytes: resolved.searchMetaMaxBytes,
		rawOutputMaxBytes: resolved.rawOutputMaxBytes,
		graceMs: resolved.graceMs,
		stderrMaxBytes: resolved.stderrMaxBytes,
		timeoutMs: resolved.timeoutMs
	});
}
//#endregion
export { Config, GLOB_MAX_RESULTS, GLOB_VCS_EXCLUDES, GREP_MAX_LINE_BYTES, GREP_MAX_MATCHES, RAW_OUTPUT_MAX_BYTES, SEARCH_GRACE_MS, SEARCH_META_MAX_BYTES, SEARCH_STDERR_MAX_BYTES, SEARCH_TIMEOUT_MS, SearchError, apply, applyGlobTool, applyGrepTool, buildGlobCommand, buildGrepCommand, formatGlobOutput, formatGrepMatches, formatGrepOutput, inject, name, parseGlobArgs, parseGrepArgs, parseGrepMatches, presentGlobCall, presentGlobResult, presentGrepCall, presentGrepResult, previewLine, resolveRgPath, runRipgrep, sampleAcrossTopLevel, toWorkdirRelative, trySaveFormattedResult };


export {};
