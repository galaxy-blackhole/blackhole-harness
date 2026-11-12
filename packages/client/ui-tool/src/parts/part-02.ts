/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			let previous = offset - 1;
			for (const line of lines) {
				if (typeof line !== "object" || line === null || Array.isArray(line)) return null;
				const { number, text } = line;
				if (typeof number !== "number" || !Number.isInteger(number) || number < 1 || number <= previous) return null;
				if (number > totalLines || typeof text !== "string") return null;
				previous = number;
				narrowed.push({
					number,
					text
				});
			}
			return {
				path,
				offset,
				lines: narrowed,
				totalLines,
				...lang === void 0 ? {} : { lang }
			};
		}
		/**
		* The line one `read` call was about, from its arguments.
		*
		* `offset` is the read tool's own 1-based start line, so opening the path can
		* land where the model looked. Available while the call is still running,
		* unlike the persisted metadata, because the arguments carry it. The arguments
		* are model-produced JSON: only an integer of at least 1 is a line, and a call
		* whose `offset` is anything else names none.
		* @param block - running or settled Tool block.
		* @returns the 1-based line, or undefined when the call named none.
		*/
		function readCallLine(block) {
			if (!validReadCall(block)) return void 0;
			const { offset } = parsedToolCall(block)?.args ?? {};
			return positiveInteger$1(offset) ? offset : void 0;
		}
		/**
		* Derive a settled root read card after validating its persisted metadata and
		* model-facing read envelope.
		* @param block - running or settled Tool block.
		* @param sessionCwd - the session workspace root; a workspace-rooted absolute
		*   path label displays relative to it. Absent leaves the path as authored.
		* @param home - host account home; a leftover POSIX home path displays as `~`.
		* @returns the read-card props, or null for the generic path.
		*/
		function readCardModel(block, sessionCwd, home) {
			if (block.parentCallId !== void 0 || !("kind" in block) || block.isError) return null;
			if (!validReadCall(block)) return null;
			const meta = readMeta(block.meta);
			if (meta === null) return null;
			const text = singleResultText(block);
			if (text === void 0) return null;
			if (/^<path>[^\n]*<\/path>\n<type>file<\/type>\n<content>\n([\s\S]*)\n<\/content>$/u.exec(text)?.[1] === void 0) return null;
			return {
				label: abbreviateHomePath(relativizeToCwd(meta.path, sessionCwd), home),
				lines: meta.lines,
				totalLines: meta.totalLines,
				lang: meta.lang
			};
		}
		//#endregion
		//#region lib/types/client/tool/models/diff-card-model.js
		/**
		* Narrow opaque result metadata's `diffs` to well-formed hunks.
		* @param diffs - the metadata field to validate.
		* @returns the validated hunks, or null when the payload is not usable.
		*/
		function narrowDiffs(diffs) {
			if (!Array.isArray(diffs) || diffs.length === 0) return null;
			const out = [];
			for (const hunk of diffs) {
				if (typeof hunk !== "object" || hunk === null) return null;
				const { path, oldText, newText } = hunk;
				if (typeof path !== "string") return null;
				if (oldText !== null && typeof oldText !== "string") return null;
				if (typeof newText !== "string") return null;
				out.push({
					path,
					oldText,
					newText
				});
			}
			return out;
		}
		function intendedDiff(block) {
			const parsed = parsedToolCall(block);
			if (parsed === null) return null;
			if (parsed.name === "str_replace_editor") {
				const { command, path, file_text: fileText, old_str: oldText, new_str: newText } = parsed.args;
				if (typeof path !== "string" || path.trim() === "") return null;
				if (command === "create") {
					if (fileText !== void 0 && typeof fileText !== "string") return null;
					return {
						tool: "str_replace_editor",
						diff: {
							path,
							oldText: null,
							newText: fileText ?? ""
						}
					};
				}
				if (command === "str_replace") {
					if (oldText !== void 0 && typeof oldText !== "string") return null;
					if (newText !== void 0 && typeof newText !== "string") return null;
					return {
						tool: "str_replace_editor",
						diff: {
							path,
							oldText: oldText ?? null,
							newText: newText ?? ""
						}
					};
				}
				return null;
			}
			const { file_path: path } = parsed.args;
			if (typeof path !== "string" || path.trim() === "") return null;
			if (parsed.name === "write") {
				const { content } = parsed.args;
				return typeof content === "string" ? {
					tool: "write",
					diff: {
						path,
						oldText: null,
						newText: content
					}
				} : null;
			}
			if (parsed.name !== "edit") return null;
			const { old_string: oldText, new_string: newText, replace_all: replaceAll } = parsed.args;
			if (typeof oldText !== "string" || typeof newText !== "string") return null;
			if (replaceAll !== void 0 && typeof replaceAll !== "boolean") return null;
			return {
				tool: "edit",
				diff: {
					path,
					oldText: oldText || null,
					newText
				}
			};
		}
		function appliedDiffs(meta) {
			if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return null;
			const diffs = meta.diffs;
			if (!Array.isArray(diffs)) return null;
			if (diffs.length === 0) return "empty";
			return narrowDiffs(diffs);
		}
		/**
		* Derive running diffs for root write/edit and `str_replace_editor`
		* create/replace calls, plus applied settled diffs for root write/edit calls.
		* A successful write with valid empty metadata uses its argument-derived
		* whole-file diff, matching create and identical-overwrite presentation;
		* `str_replace_editor` settles through Generic because it has no result view.
		* @param block - running or settled Tool block.
		* @returns the diff-card props, or null for the generic path.
		*/
		function diffCardModel(block) {
			if (block.parentCallId !== void 0) return null;
			const intended = intendedDiff(block);
			if (intended === null) return null;
			if (!("kind" in block)) return { card: { diffs: [intended.diff] } };
			if (intended.tool === "str_replace_editor") return null;
			if (block.isError) return null;
			const applied = appliedDiffs(block.meta);
			if (applied === null || applied === "empty") return intended.tool === "write" ? { card: { diffs: [intended.diff] } } : null;
			const path = recordedAbsolutePath(block.meta, "path");
			return { card: { diffs: applied.map((diff) => diff.path === path ? {
				...diff,
				path: intended.diff.path
			} : diff) } };
		}
		//#endregion
		//#region lib/types/client/tool/models/search-card-model.js
		function validSearchCall(block) {
			const call = parsedToolCall(block);
			if (call === null) return null;
			const { pattern, path } = call.args;
			if (typeof pattern !== "string") return null;
			if (call.name === "grep" && pattern === "") return null;
			if (call.name === "glob" && pattern.trim() === "") return null;
			if (call.name !== "grep" && call.name !== "glob") return null;
			if (path !== void 0 && (typeof path !== "string" || path.trim() === "")) return null;
			if (call.name === "grep") {
				const { include } = call.args;
				if (include !== void 0 && (typeof include !== "string" || !validInclude(include))) return null;
			}
			return call.name;
		}
		function validInclude(include) {
			if (include.trim() === "" || include.startsWith("!")) return false;
			let braceDepth = 0;
			for (const character of include) if (character === "{") braceDepth += 1;
			else if (character === "}") braceDepth = Math.max(0, braceDepth - 1);
			else if (character === "," && braceDepth === 0) return false;
			return true;
		}
		function searchFiles(value) {
			if (!Array.isArray(value)) return null;
			const files = [];
			for (const file of value) {
				if (typeof file !== "object" || file === null || Array.isArray(file)) return null;
				const { path, matches } = file;
				if (typeof path !== "string" || !Array.isArray(matches)) return null;
				const narrowed = [];
				for (const match of matches) {
					if (typeof match !== "object" || match === null || Array.isArray(match)) return null;
					const { lineNumber, line } = match;
					if (typeof lineNumber !== "number" || !Number.isInteger(lineNumber) || lineNumber < 1) return null;
					if (typeof line !== "string") return null;
					narrowed.push({
						lineNumber,
						line
					});
				}
				files.push({
					path,
					matches: narrowed
				});
			}
			return files;
		}
		function flattenContent(content) {
			const text = content.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text).join("\n");
			return text === "" ? void 0 : text;
		}
		/**
		* Derive a settled root grep/glob card from persisted metadata.
		* @param block - running or settled Tool block.
		* @returns search-card props, or null for the generic path.
		*/
		function searchCardModel(block) {
			if (block.parentCallId !== void 0 || !("kind" in block) || block.isError) return null;
			const tool = validSearchCall(block);
			if (tool === null) return null;
			if (typeof block.meta !== "object" || block.meta === null || Array.isArray(block.meta)) return null;
			const meta = block.meta;
			if (typeof meta.truncated !== "boolean") return null;
			if (typeof meta.total !== "number" || !Number.isInteger(meta.total) || meta.total < 0) return null;
			const common = {
				truncated: meta.truncated,
				total: meta.total
			};
			const recovery = meta.truncated ? flattenContent(block.content) : void 0;
			if (tool === "grep") {
				if (meta.shape !== "matches") return null;
				const files = searchFiles(meta.files);
				return files === null ? null : {
					recovery,
					card: {
						kind: "matches",
						files,
						...common
					}
				};
			}
			if (meta.shape !== "paths" || !Array.isArray(meta.paths)) return null;
			if (!meta.paths.every((path) => typeof path === "string")) return null;
			return {
				recovery,
				card: {
					kind: "paths",
					paths: [...meta.paths],
					...common
				}
			};
		}
		new TextEncoder();
		new TextDecoder();
		/**
		* Standardized, false-precision-safe wording for one {@link Omitted} value —
		* the "may standardize omission wording" half the library owns. `exact` prints
		* the count (`Omitted 3 items`); `unknown` prints NO count because the caller
		* did not provide one. `none` is the empty string.
		*
		* @param omitted The omission metadata from a retainer result.
		* @param unit The noun for the omitted quantity (`items`, `bytes`, `chars`, `lines`).
		* @returns A neutral clause (no trailing space), or `''` when nothing was omitted.
		*/
		function describeOmitted(omitted, unit) {
			switch (omitted.kind) {
				case "none": return "";
				case "exact": return `Omitted ${omitted.count} ${unit}.`;
				case "unknown": return `More ${unit} were omitted.`;
			}
		}
		//#endregion
		//#region ../../spill/spill-policy/src/notice.ts
		/** Browser-safe formatting and recognition of persisted spill-policy notices. */
		const OPEN = "(";
		const CLOSE = ")";
		const LOCATION = " Full formatted result stored at: ";
		const GUIDANCE_SEPARATOR = ". ";
		const SEPARATOR = "\n\n";
		const EXACT_OMISSION = describeOmitted({
			kind: "exact",
			count: 0
		}, "bytes");
		const COUNT_OFFSET = EXACT_OMISSION.indexOf("0");
		const COUNT_SUFFIX = EXACT_OMISSION.slice(COUNT_OFFSET + 1);
		function isOmission(text) {
			const imageNotice = / Omitted ([1-9][0-9]*) images\.$/.exec(text);
			if (imageNotice !== null) {
				if (!Number.isSafeInteger(Number(imageNotice[1]))) return false;
				text = text.slice(0, imageNotice.index);
			}
			if (text === describeOmitted({ kind: "none" }, "bytes") || text === describeOmitted({ kind: "unknown" }, "bytes")) return true;
			const count = Number(text.slice(COUNT_OFFSET, text.length - COUNT_SUFFIX.length));
			return Number.isSafeInteger(count) && count >= 0 && text === describeOmitted({
				kind: "exact",
				count
			}, "bytes");
		}
		/**
		* Recognize a final spill-policy notice in persisted text, including notice-only output.
		* This identifies the text convention, not authenticated tool-output origin.
		* @param text - complete recorded text result.
		* @returns whether a complete notice occupies the end of the result.
		*/
		function hasSpillNotice(text) {
			if (!text.endsWith(CLOSE)) return false;
			let start = 0;
			while (true) {
				const next = text.indexOf(`${SEPARATOR}${OPEN}`, start);
				const candidate = text.slice(start, next < 0 ? -1 : next);
				const location = candidate.indexOf(LOCATION, 1);
				if (candidate.startsWith(OPEN) && location >= 0 && isOmission(candidate.slice(1, location))) return text.indexOf(GUIDANCE_SEPARATOR, start + location + 34) >= 0;
				if (next < 0) return false;
				start = next + 2;
			}
		}
		//#endregion
		//#region lib/types/client/tool/models/terminal-card-model.js
		/**
		* Build the TerminalBlock display copy from the conversation locale seat —
		* the one place the primitive's label surface pairs with this package's
		* dictionary, shared by every terminal render site (chat row, bash row,
		* details panel).
		* @param t - the render site's conversation locale seat.
		* @returns the full label set for {@link TerminalBlockProps}'s `labels`.
		*/
		function terminalBlockLabels(t) {
			return {
				commandLine: (line) => t("terminal.commandLine", { n: line }),
				signal: (signal) => t("terminal.signal", { signal }),
				exitCode: (code) => t("terminal.exitCode", { code }),
				noExitCode: t("terminal.noExitCode"),
				running: t("terminal.running"),
				failed: t("terminal.failed"),
				done: t("terminal.done"),
				copy: t("copy"),
				copied: t("copied"),
				noOutput: t("terminal.noOutput"),
				collapseAria: t("terminal.collapseAria"),
				collapse: t("collapse"),
				expandAria: (hidden) => t("terminal.expandAria", { n: hidden }),
				expand: (hidden) => t("terminal.expandRest", { n: hidden })
			};
		}
		/**
		* Resolve locale-owned `terminal_send` copy while preserving Tool-authored
		* shell commands and descriptions verbatim.
		* @param model - locale-neutral terminal card data.
		* @param t - the render site's conversation locale seat.
		* @returns terminal props and description ready for rendering.
		*/
		function localizeTerminalCardModel(model, t) {
			if (model.copy.kind === "shell") return {
				card: {
					command: model.copy.command,
					...model.card
				},
				description: model.copy.description
			};
			return {
				card: {
					command: model.copy.text === "" ? t("terminal.sendInput") : model.copy.text,
					...model.card
				},
				description: t("terminal.session", { sessionId: model.copy.sessionId })
			};
		}
		/**
		* True when a settled terminal card reports a failing exit — a non-zero code,
		* an explicitly missing exit code, or a terminating signal. The bash tool settles
		* a failing command as a completed call (`isError` stays false: the exit status is result data), so
		* the row retains that failure state alongside its exit capsule.
		* @param model - a derived terminal card.
		* @returns whether the card's exit status is a failure.
		*/
		function terminalFailed(model) {
			const { exitCode, signal, running } = model.card;
			return running !== true && (exitCode !== void 0 && exitCode !== 0 || signal !== void 0);
		}
		/**
		* Localize a settled foreground command's exit status without inventing a code.
		* @param model - terminal card, absent for generic execution errors.
		* @param t - conversation locale.
		* @returns the capsule label, or null for running, background, or successful calls.
		*/
export {};
