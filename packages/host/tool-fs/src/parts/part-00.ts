/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN 1/2 của bundle gốc @deepseek-ai/dsh-tool-fs — sinh tự động từ bundle gốc, không sửa tay
 */
// @ts-nocheck

import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { FsError } from "@deepseek-ai/dsh-fs";
import { readLangHintForPath as langFromPath } from "@deepseek-ai/dsh-util-code-language";
import { structuredPatch } from "diff";
import { basename, extname } from "node:path";
import { AttachmentError, AttachmentId } from "@deepseek-ai/dsh-attachment";
import { ESCALATION_TARGETS, approveEscalation, escalationHintMarker, sandboxDenialMarker, sandboxPermissionsDescription, validateEscalationArgs } from "@deepseek-ai/dsh-sandbox";
//#region lib/types/read-render.js
/**
* Pure read presentation: turn provider-decoded text into a bounded, line-numbered window and
* model-facing envelope. Chunk scanning caps the current line, so even one newline-free giant
* line cannot grow memory without bound.
* @module @deepseek-ai/dsh-tool-fs/read-render
*/
/** Default maximum characters returned for a single line (the `readMaxLineLength` config). */
const READ_MAX_LINE_LENGTH = 2e3;
/** Default maximum bytes returned for selected file lines (the `readMaxBytes` config). */
const READ_MAX_BYTES = 50 * 1024;
function newAccumulator() {
	return {
		lines: [],
		totalLines: 0,
		outputBytes: 0,
		truncatedByBytes: false
	};
}
function truncateLine(line, maxLineLength) {
	return line.length > maxLineLength ? `${line.substring(0, maxLineLength)}... (line truncated to ${maxLineLength} chars)` : line;
}
function lineByteSize(line, currentLineCount) {
	return Buffer.byteLength(line, "utf8") + (currentLineCount > 0 ? 1 : 0);
}
function consumeLine(acc, rawLine, request) {
	acc.totalLines += 1;
	if (acc.truncatedByBytes || acc.totalLines < request.offset || acc.lines.length >= request.limit) return;
	const text = truncateLine(rawLine, request.maxLineLength);
	const bytes = lineByteSize(text, acc.lines.length);
	if (acc.outputBytes + bytes > request.maxBytes) {
		acc.truncatedByBytes = true;
		return;
	}
	acc.outputBytes += bytes;
	acc.lines.push({
		number: acc.totalLines,
		text
	});
}
function stripCarriageReturn(line) {
	return line.endsWith("\r") ? line.slice(0, -1) : line;
}
function finish(acc, request, displayPath) {
	if (!acc.truncatedByBytes && request.offset > acc.totalLines && !(acc.totalLines === 0 && request.offset === 1)) throw new FsError(`offset ${request.offset} is out of range for "${displayPath}" (${acc.totalLines} lines)`, "FS_NOT_FOUND");
	return {
		lines: acc.lines,
		totalLines: acc.totalLines,
		truncatedByBytes: acc.truncatedByBytes
	};
}
/**
* Build one window from streamed or whole-file chunks, enforcing line and byte caps while still
* scanning to an exact total line count, and throwing `FS_NOT_FOUND` when the requested offset is
* past EOF.
* @param chunks - decoded text chunks in file order; chunk boundaries carry no meaning.
* @param request - the resolved window; the caller has already applied its defaults and caps.
* @param displayPath - the caller-facing path used in the offset-out-of-range error.
* @returns the numbered window lines, the total line count seen, and the byte-cap truncation flag.
*/
async function buildWindow(chunks, request, displayPath) {
	const acc = newAccumulator();
	const lineBufferCap = request.maxLineLength + 1;
	let lineBuffer = "";
	function appendToLineBuffer(segment) {
		if (lineBuffer.length >= lineBufferCap) return;
		lineBuffer += segment;
		if (lineBuffer.length > lineBufferCap) lineBuffer = lineBuffer.slice(0, lineBufferCap);
	}
	function flushLine() {
		consumeLine(acc, stripCarriageReturn(lineBuffer), request);
		lineBuffer = "";
	}
	for await (const chunk of chunks) {
		let startPos = 0;
		let newlinePos;
		while ((newlinePos = chunk.indexOf("\n", startPos)) !== -1) {
			appendToLineBuffer(chunk.slice(startPos, newlinePos));
			flushLine();
			startPos = newlinePos + 1;
		}
		appendToLineBuffer(chunk.slice(startPos));
	}
	if (lineBuffer.length > 0) flushLine();
	return finish(acc, request, displayPath);
}
/**
* Format a read outcome as one OpenCode-style line-numbered text block body.
* @param displayPath - the backend-resolved path rendered in the envelope's `<path>` element.
* @param outcome - the windowed read to render.
* @returns the model-facing envelope: numbered lines plus a continuation or end-of-file footer.
*/
function formatReadOutput(displayPath, outcome) {
	const endLine = outcome.lines.at(-1)?.number ?? Math.max(0, outcome.offset - 1);
	let footer;
	if (outcome.truncatedByBytes) footer = `(Output capped. Showing lines ${outcome.offset}-${endLine}. Use offset=${endLine + 1} to continue.)`;
	else if (endLine < outcome.totalLines) footer = `(Showing lines ${outcome.offset}-${endLine} of ${outcome.totalLines}. Use offset=${endLine + 1} to continue.)`;
	else footer = `(End of file - total ${outcome.totalLines} lines)`;
	return `<path>${displayPath}</path>
<type>file</type>
<content>
${outcome.lines.length > 0 ? `${outcome.lines.map((line) => `${line.number}: ${line.text}`).join("\n")}\n\n${footer}` : footer}
</content>`;
}
/**
* Whether `value` is a valid {@link FileTextLine} (defensive narrowing from
* opaque `meta`). `number` must be a 1-based integer line number, since a card
* rendered from a zero, fractional, or non-finite line number would violate the
* 1-based numbering contract the read window promises.
*/
function isFileTextLine(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const { number, text } = value;
	return typeof number === "number" && Number.isInteger(number) && number >= 1 && typeof text === "string";
}
/**
* Narrow opaque live or replayed result metadata to a structured read window.
* Malformed metadata returns `undefined` so presentation can fall back to the
* generic text card instead of throwing during replay. Beyond shape, the
* semantic contract of a read window is enforced against replayed JSON that is
* well-typed but out of range: `offset` must be a 1-based integer, `totalLines`
* must be a non-negative integer, each line number must be a 1-based integer no
* less than `offset`, the line numbers must strictly increase, and no line number
* may exceed `totalLines`. Any violation declines to the generic fallback rather
* than emitting a card that misnumbers or overcounts.
* @param meta - result metadata.
* @returns the validated read window, or `undefined` for absent, malformed, or semantically invalid data.
*/
function readMetaFromMeta(meta) {
	if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return void 0;
	const { path, offset, lines, totalLines, lang } = meta;
	if (typeof path !== "string" || typeof totalLines !== "number" || typeof offset !== "number") return void 0;
	if (!Number.isInteger(offset) || offset < 1) return void 0;
	if (!Number.isInteger(totalLines) || totalLines < 0) return void 0;
	if (!Array.isArray(lines) || !lines.every(isFileTextLine)) return void 0;
	if (lang !== void 0 && typeof lang !== "string") return void 0;
	let previous = offset - 1;
	for (const { number } of lines) {
		if (number <= previous || number > totalLines) return void 0;
		previous = number;
	}
	return {
		path,
		offset,
		lines,
		totalLines,
		...lang === void 0 ? {} : { lang }
	};
}
//#endregion
//#region lib/types/session-cwd.js
/**
* Resolution options for filesystem calls in the Session's current directory.
* Non-agent calls leave directory defaults to the filesystem provider.
* @module @deepseek-ai/dsh-tool-fs/session-cwd
*/
/**
* Resolve the current directory and cancellation for a filesystem call.
* @param ctx - context containing the working-directory service.
* @param exec - tool execution supplying the agent and cancellation.
* @returns filesystem resolution options for this call.
*/
async function sessionResolveOptions(ctx, exec) {
	const cwd = exec.agent === void 0 ? void 0 : await ctx.workingDirectory.ensure(exec.agent, exec.signal);
	return {
		...cwd !== void 0 ? { cwd } : {},
		signal: exec.signal
	};
}
//#endregion
//#region lib/types/read-target.js
/**
* Shared path resolution and regular-file validation for model-facing read tools.
* @module @deepseek-ai/dsh-tool-fs/src/read-target
*/
/**
* Resolve a model-supplied path, observe absence, and require a regular file.
* @param ctx - the plugin context providing filesystem resolution and observation events.
* @param exec - the current tool execution, including the owning Agent and cancellation.
* @param requestedPath - the raw path supplied to the tool.
* @returns the resolved target and its single stat result.
*/
async function resolveRegularReadTarget(ctx, exec, requestedPath) {
	const target = await ctx.fs.resolve(requestedPath, await sessionResolveOptions(ctx, exec));
	const info = await ctx.fs.stat(target, exec.signal);
	if (info === void 0) {
		ctx.emit("fs/observed", target, { kind: "absent" }, exec);
		throw new FsError(`cannot read "${target.displayPath}": not found`, "FS_NOT_FOUND");
	}
	if (info.type !== "file") throw new FsError(`cannot read "${target.displayPath}": not a regular file`, "FS_NOT_REGULAR_FILE");
	return {
		target,
		info
	};
}
//#endregion
//#region lib/types/read.js
/**
* Model-facing UTF-8 read. It performs one provider stat for type, routing, and observed version,
* streams large or size-unknown files, renders a bounded window, then emits the observation.
* @module @deepseek-ai/dsh-tool-fs/src/read
*/
/** Default and maximum number of lines returned by one `read` call (the `readLimit` config). */
const READ_LIMIT = 2e3;
/**
* Default streaming threshold (the `readStreamMinSize` config): files at or
* above this size stream; smaller files read whole into memory.
*/
const STREAM_MIN_SIZE = 10 * 1024 * 1024;
function parsePositiveInteger(value, name) {
	if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
	return value;
}
/**
* Validate value constraints the schema DSL can't express. `maxLimit` is the deployment's line cap.
* @param args - the schema-validated raw tool arguments; `offset`/`limit` must be positive integers when given.
* @param maxLimit - the configured line cap: both the default `limit` and the largest one accepted.
* @returns the validated input with `offset` defaulted to 1 and `limit` to `maxLimit`.
*/
function parseReadArgs(args, maxLimit) {
	if (args.file_path.trim().length === 0) throw new Error("file_path must be a non-empty string");
	const offset = args.offset === void 0 ? 1 : parsePositiveInteger(args.offset, "offset");
	const limit = args.limit === void 0 ? maxLimit : parsePositiveInteger(args.limit, "limit");
	if (limit > maxLimit) throw new Error(`limit must be less than or equal to ${maxLimit}`);
	return {
		filePath: args.file_path,
		offset,
		limit
	};
}
/**
* Register the `read` tool and its scope-aware system-prompt guidance.
* @param ctx - the plugin context; registrations are effects scoped to it, and execution uses its `fs` service.
* @param caps - the deployment's resolved read caps (plugin config after defaulting).
*/
function applyReadTool(ctx, caps) {
	ctx.systemPrompt.section({
		name: "tool:read",
		order: ctx.systemPrompt.getSectionOrder("TOOL_READ"),
		text: ({ scope }) => ctx.tools.get("read", scope) === void 0 ? "" : "Use the read tool — not shell commands like cat, sed, head, or tail — to inspect text files. Use offset and limit to read a line range or continue a large file."
	});
	ctx.tools.register(defineTool({
		name: "read",
		description: "Read a UTF-8 text file and return line-numbered content.",
		parameters: {
			file_path: {
				type: "string",
				required: true,
				description: "Path to read, resolved by the filesystem backend."
			},
			offset: {
				type: "number",
				description: "1-based first line to return. Defaults to 1."
			},
			limit: {
				type: "number",
				description: `Maximum number of lines to return. Defaults to ${caps.limit}.`
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					path: {
						type: "string",
						required: true,
						description: "Canonical absolute path in the filesystem execution world."
					},
					offset: {
						type: "integer",
						required: true
					},
					lines: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								number: {
									type: "integer",
									required: true
								},
								text: {
									type: "string",
									required: true
								}
							}
						}
					},
					totalLines: {
						type: "integer",
						required: true
					}
				}
			},
			render: (args, value) => {
				const input = parseReadArgs(args, caps.limit);
				const endLine = value.lines.at(-1)?.number ?? Math.max(0, value.offset - 1);
				const truncatedByBytes = value.lines.length < input.limit && endLine < value.totalLines;
				return [{
					type: "text",
					text: formatReadOutput(value.path, {
						offset: value.offset,
						lines: value.lines,
						totalLines: value.totalLines,
						...truncatedByBytes ? { truncatedByBytes: true } : {}
					})
				}];
			},
			presentationMeta: (_args, value) => {
				const lang = langFromPath(value.path);
				return {
					path: value.path,
					offset: value.offset,
					lines: value.lines.map(({ number, text }) => ({
						number,
						text
					})),
					totalLines: value.totalLines,
					...lang === void 0 ? {} : { lang }
				};
			}
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			const input = parseReadArgs(args, caps.limit);
			const { target, info } = await resolveRegularReadTarget(ctx, exec, input.filePath);
			const window = await buildWindow(info.size === void 0 || info.size >= caps.streamMinSize ? await ctx.fs.streamText(target, exec.signal) : [await ctx.fs.readText(target, exec.signal)], {
				offset: input.offset,
				limit: input.limit,
				maxLineLength: caps.maxLineLength,
				maxBytes: caps.maxBytes
			}, target.displayPath);
			const outcome = {
				path: ctx.fs.processPath(target),
				offset: input.offset,
				lines: window.lines,
				totalLines: window.totalLines
			};
			ctx.emit("fs/observed", target, {
				kind: "present",
				version: info.version
			}, exec);
			return outcome;
		},
		presentResult(_args, result) {
			if (result.isError) return void 0;
			const meta = readMetaFromMeta(result.meta);
			if (meta === void 0) return void 0;
			const only = result.content.length === 1 ? result.content[0] : void 0;
			const text = only?.type === "text" ? only.text : void 0;
			if (text === void 0) return void 0;
			const body = /^<path>[^\n]*<\/path>\n<type>file<\/type>\n<content>\n([\s\S]*)\n<\/content>$/u.exec(text)?.[1];
			if (body === void 0) return void 0;
			return {
				card: "read",
				path: meta.path,
				offset: meta.offset,
				lines: meta.lines,
				totalLines: meta.totalLines,
				...meta.lang === void 0 ? {} : { lang: meta.lang },
				content: [{
					type: "text",
					text: body
				}]
			};
		},
		presentCall(args) {
			const { offset, limit } = args;
			const window = limit !== void 0 && limit > 0 ? ` (${offset ?? 1} - ${(offset ?? 1) + limit - 1})` : offset !== void 0 ? ` (from line ${offset})` : "";
			return {
				card: "generic",
				title: `Read ${args.file_path}${window}`,
				kind: "read",
				locations: [{
					path: args.file_path,
					line: offset ?? 1
				}]
			};
		}
	}));
}
/**
* Compute one {@link FileDiff} per hunk between `before` and `after`, each carrying the
* applied change plus {@link DIFF_CONTEXT} context lines. Pure insertions use `oldText: null`,
* patch-only no-newline markers are omitted, and scattered replacements remain separate hunks.
*
* @param path - the path stamped on every produced diff (the model-facing `file_path`; the
*   bridge relativizes it).
* @param before - the file text before the change (the backend's LF-normalized diff basis).
* @param after - the file text after the change, on the same basis.
* @returns one diff per applied hunk, in file order; empty when the texts are identical.
*/
function computeHunkDiffs(path, before, after) {
	const patch = structuredPatch("", "", before, after, void 0, void 0, { context: 3 });
	const diffs = [];
	for (const hunk of patch.hunks) {
		const oldLines = [];
		const newLines = [];
		for (const line of hunk.lines) {
			if (line.startsWith("\\")) continue;
			const text = line.slice(1);
			if (line.startsWith("-")) oldLines.push(text);
			else if (line.startsWith("+")) newLines.push(text);
			else {
				oldLines.push(text);
				newLines.push(text);
			}
		}
		diffs.push({
			path,
			oldText: oldLines.length > 0 ? oldLines.join("\n") : null,
			newText: newLines.join("\n")
		});
	}
	return diffs;
}
/** Whether `value` is a valid {@link FileDiff} (defensive narrowing from opaque `meta`). */
function isFileDiff(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const { path, oldText, newText } = value;
	return typeof path === "string" && (oldText === null || typeof oldText === "string") && typeof newText === "string";
}
/**
* Narrow opaque live or replayed result metadata to non-empty file diffs. Malformed metadata
* returns `undefined` so presentation can fall back instead of throwing during replay.
* @param meta - result metadata.
* @returns validated hunks, or `undefined` for absent or malformed data.
*/
function diffsFromMeta(meta) {
	if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return void 0;
	const diffs = meta.diffs;
	if (!Array.isArray(diffs) || diffs.length === 0 || !diffs.every(isFileDiff)) return void 0;
	return diffs;
}
/**
* Read the operation's file path even when the applied diff is empty.
* @param meta - opaque persisted result metadata.
* @returns the recorded path, or undefined for old or malformed metadata.
*/
function pathFromMeta(meta) {
	if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return void 0;
	const path = meta.path;
	return typeof path === "string" && path.length > 0 ? path : void 0;
}
//#endregion
//#region lib/types/error.js
/**
* Model-facing diagnostics for guarded-mutation failures. Providers and
* policies retain operation-specific causes, while this package owns the
* stable message shown to the model.
* @module @deepseek-ai/dsh-tool-fs/src/error
*/
/**
* Render the stable model-facing diagnostic for a guarded-mutation failure.
* `FS_STALE_VERSION` keeps the provider's reason and appends its re-read
* remedy. `FS_NOT_OBSERVED` replaces operation-specific policy/provider text
* with one path-aware reason and read remedy. The original error remains the
* cause, and both diagnostics preserve its code for machine routing. Anything
* else passes through untouched.
* @param error - the caught value from a write/edit execution.
* @param displayPath - the resolved target path shown to the model.
* @returns a remediated `FsError` for the two guarded-mutation codes, else the original value.
*/
function remediateFsError(error, displayPath) {
	if (!(error instanceof FsError)) return error;
	if (error.code === "FS_NOT_OBSERVED") return new FsError(`cannot modify "${displayPath}": file has not been read — read the file, then retry`, error.code, { cause: error });
	if (error.code === "FS_STALE_VERSION") return new FsError(`${error.message} — re-read the file, then retry`, error.code, { cause: error });
	return error;
}
//#endregion
//#region lib/types/mutation-result.js
/** Shared observation and result fields for successful file mutations. */
/**
* Record the new file version and expose the mutation result with its canonical path.
* @param ctx - filesystem and observation event owner.
* @param target - resolved file that was mutated.
* @param outcome - successful provider result; its version stays in the observation event.
* @param exec - calling tool execution.
* @returns the provider's result fields without the version, plus the canonical absolute path.
*/
function mutationResult(ctx, target, outcome, exec) {
	const { version, ...result } = outcome;
	ctx.emit("fs/observed", target, {
		kind: "present",
		version
	}, exec);
	return {
		path: ctx.fs.processPath(target),
		...result
	};
}
//#endregion
//#region lib/types/write.js
/**
* Model-facing full-file write. It obtains an optional intent from the single policy slot, calls
* `ctx.fs.writeText` without a stat, then records the resulting version; no policy means an
* unconditional atomic create-or-overwrite.
* @module @deepseek-ai/dsh-tool-fs/src/write
*/
/**
* Validate value constraints the schema DSL can't express: only a non-blank
* `file_path` — an empty `content` is legitimate (it writes an empty file).
* @param args - the schema-validated raw tool arguments.
* @returns the camelCased input; `content` passes through untouched.
*/
function parseWriteArgs(args) {
	if (args.file_path.trim().length === 0) throw new Error("file_path must be a non-empty string");
	return {
		filePath: args.file_path,
		content: args.content
	};
}
/**
* Format a write outcome as one model-facing text block body.
* @param displayPath - the backend-resolved path rendered in the envelope's `<path>` element.
* @param outcome - the write outcome; its `operation` selects the Created/Updated wording.
* @returns the model-facing confirmation envelope (no file content is echoed back).
*/
function formatWriteOutput(displayPath, outcome) {
	return `<path>${displayPath}</path>
<type>file</type>
<content>
${outcome.operation === "create" ? "Created" : "Updated"} file
</content>`;
}
/**
* Register the `write` tool and its scope-aware system-prompt guidance.
* @param ctx - the plugin context; registrations are effects scoped to it, and execution uses its `fs` service.
* @param sandbox - the shared sandbox-escalation API (advertisement, mode stamping, denial mapping).
*/
function applyWriteTool(ctx, sandbox) {
	ctx.systemPrompt.section({
		name: "tool:write",
		order: ctx.systemPrompt.getSectionOrder("TOOL_WRITE"),
		text: ({ scope }) => ctx.tools.get("write", scope) === void 0 ? "" : "Read an existing file before overwriting it with write (the default fs-observation-policy requires it)" + (ctx.tools.get("edit", scope) === void 0 ? "" : " and prefer edit for targeted changes") + "."
	});
	ctx.tools.register(defineTool({
		name: "write",
		description: "Create or fully replace a UTF-8 text file.",
		parameters: {
			file_path: {
				type: "string",
				required: true,
				description: "Path to write, resolved by the filesystem backend. Provide `file_path` before `content` in the arguments."
			},
			content: {
				type: "string",
				required: true,
				description: "Full UTF-8 text content to write."
			},
			...sandbox.escalationModes.length > 0 ? sandbox.schemaFields() : {}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					path: {
						type: "string",
						required: true,
						description: "Canonical absolute path in the filesystem execution world."
					},
					operation: {
						type: "string",
						required: true,
						enum: ["create", "update"]
					},
					before: {
						required: true,
						oneOf: [{ type: "string" }, { type: "null" }]
					},
					after: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: formatWriteOutput(value.path, value)
			}],
			presentationMeta: (_args, value) => ({
				operation: value.operation,
				path: value.path,
				diffs: value.before === null ? [] : computeHunkDiffs(value.path, value.before, value.after).map(({ path, oldText, newText }) => ({
					path,
					oldText,
					newText
				}))
			})
		},
		async execute(args, exec) {
			const input = parseWriteArgs(args);
			const sandboxPolicy = await sandbox.resolvePolicy("write", args, exec);
			const target = await ctx.fs.resolve(input.filePath, await sessionResolveOptions(ctx, exec));
			const intent = await ctx.waterfall("fs/write-intent", target, exec, () => void 0);
			let outcome;
			try {
				outcome = await ctx.fs.writeText(target, input.content, intent, exec.signal, sandboxPolicy);
			} catch (error) {
				throw remediateFsError(sandbox.mapError(error, sandboxPolicy), target.displayPath);
			}
			return mutationResult(ctx, target, outcome, exec);
		},
		presentCall(args) {
			return {
				card: "diff",
				title: `Write ${args.file_path}`,
				diffs: [{
					path: args.file_path,
					oldText: null,
					newText: args.content
				}],
				locations: [{ path: args.file_path }]
			};
		},
		presentResult(args, result) {
			if (result.isError) return void 0;
			const diffs = diffsFromMeta(result.meta) ?? [{
				path: pathFromMeta(result.meta) ?? args.file_path,
				oldText: null,
				newText: args.content
			}];
			return {
				card: "diff",
				title: `Write ${args.file_path}`,
				diffs
			};
		}
	}));
}
//#endregion

export {};
