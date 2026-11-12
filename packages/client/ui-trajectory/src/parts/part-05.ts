/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-trajectory/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/util/string.js
		function longestCommonPrefix(str1, str2) {
			let i;
			for (i = 0; i < str1.length && i < str2.length; i++) if (str1[i] != str2[i]) return str1.slice(0, i);
			return str1.slice(0, i);
		}
		function longestCommonSuffix(str1, str2) {
			let i;
			if (!str1 || !str2 || str1[str1.length - 1] != str2[str2.length - 1]) return "";
			for (i = 0; i < str1.length && i < str2.length; i++) if (str1[str1.length - (i + 1)] != str2[str2.length - (i + 1)]) return str1.slice(-i);
			return str1.slice(-i);
		}
		function replacePrefix(string, oldPrefix, newPrefix) {
			if (string.slice(0, oldPrefix.length) != oldPrefix) throw Error(`string ${JSON.stringify(string)} doesn't start with prefix ${JSON.stringify(oldPrefix)}; this is a bug`);
			return newPrefix + string.slice(oldPrefix.length);
		}
		function replaceSuffix(string, oldSuffix, newSuffix) {
			if (!oldSuffix) return string + newSuffix;
			if (string.slice(-oldSuffix.length) != oldSuffix) throw Error(`string ${JSON.stringify(string)} doesn't end with suffix ${JSON.stringify(oldSuffix)}; this is a bug`);
			return string.slice(0, -oldSuffix.length) + newSuffix;
		}
		function removePrefix(string, oldPrefix) {
			return replacePrefix(string, oldPrefix, "");
		}
		function removeSuffix(string, oldSuffix) {
			return replaceSuffix(string, oldSuffix, "");
		}
		function maximumOverlap(string1, string2) {
			return string2.slice(0, overlapCount(string1, string2));
		}
		function overlapCount(a, b) {
			let startA = 0;
			if (a.length > b.length) startA = a.length - b.length;
			let endB = b.length;
			if (a.length < b.length) endB = a.length;
			const map = Array(endB);
			let k = 0;
			map[0] = 0;
			for (let j = 1; j < endB; j++) {
				if (b[j] == b[k]) map[j] = map[k];
				else map[j] = k;
				while (k > 0 && b[j] != b[k]) k = map[k];
				if (b[j] == b[k]) k++;
			}
			k = 0;
			for (let i = startA; i < a.length; i++) {
				while (k > 0 && a[i] != b[k]) k = map[k];
				if (a[i] == b[k]) k++;
			}
			return k;
		}
		/**
		* Split a string into segments using a word segmenter, merging consecutive
		* segments if they are both whitespace segments. Whitespace segments can
		* appear adjacent to one another for two reasons:
		* - newlines always get their own segment
		* - where a diacritic is attached to a whitespace character in the text, the
		*   segment ends after the diacritic, so e.g. " \u0300 " becomes two segments.
		* This function therefore runs the segmenter's .segment() method and then
		* merges consecutive segments of whitespace into a single part.
		*/
		function segment(string, segmenter) {
			const parts = [];
			for (const segmentObj of Array.from(segmenter.segment(string))) {
				const segment = segmentObj.segment;
				if (parts.length && /\s/.test(parts[parts.length - 1]) && /\s/.test(segment)) parts[parts.length - 1] += segment;
				else parts.push(segment);
			}
			return parts;
		}
		function trailingWs(string, segmenter) {
			if (segmenter) return leadingAndTrailingWs(string, segmenter)[1];
			let i;
			for (i = string.length - 1; i >= 0; i--) if (!string[i].match(/\s/)) break;
			return string.substring(i + 1);
		}
		function leadingWs(string, segmenter) {
			if (segmenter) return leadingAndTrailingWs(string, segmenter)[0];
			const match = string.match(/^\s*/);
			return match ? match[0] : "";
		}
		function leadingAndTrailingWs(string, segmenter) {
			if (!segmenter) return [leadingWs(string), trailingWs(string)];
			if (segmenter.resolvedOptions().granularity != "word") throw new Error("The segmenter passed must have a granularity of \"word\"");
			const segments = segment(string, segmenter);
			const firstSeg = segments[0];
			const lastSeg = segments[segments.length - 1];
			return [/\s/.test(firstSeg) ? firstSeg : "", /\s/.test(lastSeg) ? lastSeg : ""];
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/word.js
		const extendedWordChars = "a-zA-Z0-9_\\u{AD}\\u{C0}-\\u{D6}\\u{D8}-\\u{F6}\\u{F8}-\\u{2C6}\\u{2C8}-\\u{2D7}\\u{2DE}-\\u{2FF}\\u{1E00}-\\u{1EFF}";
		const tokenizeIncludingWhitespace = new RegExp(`[${extendedWordChars}]+|\\s+|[^${extendedWordChars}]`, "ug");
		var WordDiff = class extends Diff {
			equals(left, right, options) {
				if (options.ignoreCase) {
					left = left.toLowerCase();
					right = right.toLowerCase();
				}
				return left.trim() === right.trim();
			}
			tokenize(value, options = {}) {
				let parts;
				if (options.intlSegmenter) {
					const segmenter = options.intlSegmenter;
					if (segmenter.resolvedOptions().granularity != "word") throw new Error("The segmenter passed must have a granularity of \"word\"");
					parts = segment(value, segmenter);
				} else parts = value.match(tokenizeIncludingWhitespace) || [];
				const tokens = [];
				let prevPart = null;
				parts.forEach((part) => {
					if (/\s/.test(part)) if (prevPart == null) tokens.push(part);
					else tokens.push(tokens.pop() + part);
					else if (prevPart != null && /\s/.test(prevPart)) if (tokens[tokens.length - 1] == prevPart) tokens.push(tokens.pop() + part);
					else tokens.push(prevPart + part);
					else tokens.push(part);
					prevPart = part;
				});
				return tokens;
			}
			join(tokens) {
				return tokens.map((token, i) => {
					if (i == 0) return token;
					else return token.replace(/^\s+/, "");
				}).join("");
			}
			postProcess(changes, options) {
				if (!changes || options.oneChangePerToken) return changes;
				let lastKeep = null;
				let insertion = null;
				let deletion = null;
				changes.forEach((change) => {
					if (change.added) insertion = change;
					else if (change.removed) deletion = change;
					else {
						if (insertion || deletion) dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, change, options.intlSegmenter);
						lastKeep = change;
						insertion = null;
						deletion = null;
					}
				});
				if (insertion || deletion) dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, null, options.intlSegmenter);
				return changes;
			}
		};
		new WordDiff();
		function dedupeWhitespaceInChangeObjects(startKeep, deletion, insertion, endKeep, segmenter) {
			if (deletion && insertion) {
				const [oldWsPrefix, oldWsSuffix] = leadingAndTrailingWs(deletion.value, segmenter);
				const [newWsPrefix, newWsSuffix] = leadingAndTrailingWs(insertion.value, segmenter);
				if (startKeep) {
					const commonWsPrefix = longestCommonPrefix(oldWsPrefix, newWsPrefix);
					startKeep.value = replaceSuffix(startKeep.value, newWsPrefix, commonWsPrefix);
					deletion.value = removePrefix(deletion.value, commonWsPrefix);
					insertion.value = removePrefix(insertion.value, commonWsPrefix);
				}
				if (endKeep) {
					const commonWsSuffix = longestCommonSuffix(oldWsSuffix, newWsSuffix);
					endKeep.value = replacePrefix(endKeep.value, newWsSuffix, commonWsSuffix);
					deletion.value = removeSuffix(deletion.value, commonWsSuffix);
					insertion.value = removeSuffix(insertion.value, commonWsSuffix);
				}
			} else if (insertion) {
				if (startKeep) {
					const ws = leadingWs(insertion.value, segmenter);
					insertion.value = insertion.value.substring(ws.length);
				}
				if (endKeep) {
					const ws = leadingWs(endKeep.value, segmenter);
					endKeep.value = endKeep.value.substring(ws.length);
				}
			} else if (startKeep && endKeep) {
				const newWsFull = leadingWs(endKeep.value, segmenter), [delWsStart, delWsEnd] = leadingAndTrailingWs(deletion.value, segmenter);
				const newWsStart = longestCommonPrefix(newWsFull, delWsStart);
				deletion.value = removePrefix(deletion.value, newWsStart);
				const newWsEnd = longestCommonSuffix(removePrefix(newWsFull, newWsStart), delWsEnd);
				deletion.value = removeSuffix(deletion.value, newWsEnd);
				endKeep.value = replacePrefix(endKeep.value, newWsFull, newWsEnd);
				startKeep.value = replaceSuffix(startKeep.value, newWsFull, newWsFull.slice(0, newWsFull.length - newWsEnd.length));
			} else if (endKeep) {
				const endKeepWsPrefix = leadingWs(endKeep.value, segmenter);
				const overlap = maximumOverlap(trailingWs(deletion.value, segmenter), endKeepWsPrefix);
				deletion.value = removeSuffix(deletion.value, overlap);
			} else if (startKeep) {
				const overlap = maximumOverlap(trailingWs(startKeep.value, segmenter), leadingWs(deletion.value, segmenter));
				deletion.value = removePrefix(deletion.value, overlap);
			}
		}
		var WordsWithSpaceDiff = class extends Diff {
			tokenize(value) {
				const regex = new RegExp(`(\\r?\\n)|[${extendedWordChars}]+|[^\\S\\n\\r]+|[^${extendedWordChars}]`, "ug");
				return value.match(regex) || [];
			}
		};
		new WordsWithSpaceDiff();
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/line.js
		var LineDiff = class extends Diff {
			constructor() {
				super(...arguments);
				this.tokenize = tokenize;
			}
			equals(left, right, options) {
				if (options.ignoreWhitespace) {
					if (!options.newlineIsToken || !left.includes("\n")) left = left.trim();
					if (!options.newlineIsToken || !right.includes("\n")) right = right.trim();
				} else if (options.ignoreNewlineAtEof && !options.newlineIsToken) {
					if (left.endsWith("\n")) left = left.slice(0, -1);
					if (right.endsWith("\n")) right = right.slice(0, -1);
				}
				return super.equals(left, right, options);
			}
		};
		const lineDiff = new LineDiff();
		function diffLines(oldStr, newStr, options) {
			return lineDiff.diff(oldStr, newStr, options);
		}
		function tokenize(value, options) {
			if (options.stripTrailingCr) value = value.replace(/\r\n/g, "\n");
			const retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
			if (!linesAndNewlines[linesAndNewlines.length - 1]) linesAndNewlines.pop();
			for (let i = 0; i < linesAndNewlines.length; i++) {
				const line = linesAndNewlines[i];
				if (i % 2 && !options.newlineIsToken) retLines[retLines.length - 1] += line;
				else retLines.push(line);
			}
			return retLines;
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/sentence.js
		function isSentenceEndPunct(char) {
			return char == "." || char == "!" || char == "?";
		}
		var SentenceDiff = class extends Diff {
			tokenize(value) {
				var _a;
				const result = [];
				let tokenStartI = 0;
				for (let i = 0; i < value.length; i++) {
					if (i == value.length - 1) {
						result.push(value.slice(tokenStartI));
						break;
					}
					if (isSentenceEndPunct(value[i]) && value[i + 1].match(/\s/)) {
						result.push(value.slice(tokenStartI, i + 1));
						i = tokenStartI = i + 1;
						while ((_a = value[i + 1]) === null || _a === void 0 ? void 0 : _a.match(/\s/)) i++;
						result.push(value.slice(tokenStartI, i + 1));
						tokenStartI = i + 1;
					}
				}
				return result;
			}
		};
		new SentenceDiff();
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/css.js
		var CssDiff = class extends Diff {
			tokenize(value) {
				return value.split(/([{}:;,]|\s+)/);
			}
		};
		new CssDiff();
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/json.js
		var JsonDiff = class extends Diff {
			constructor() {
				super(...arguments);
				this.tokenize = tokenize;
			}
			get useLongestToken() {
				return true;
			}
			castInput(value, options) {
				const { undefinedReplacement, stringifyReplacer = (k, v) => typeof v === "undefined" ? undefinedReplacement : v } = options;
				return typeof value === "string" ? value : JSON.stringify(canonicalize(value, null, null, stringifyReplacer), null, "  ");
			}
			equals(left, right, options) {
				return super.equals(left.replace(/,([\r\n])/g, "$1"), right.replace(/,([\r\n])/g, "$1"), options);
			}
		};
		new JsonDiff();
		function canonicalize(obj, stack, replacementStack, replacer, key) {
			stack = stack || [];
			replacementStack = replacementStack || [];
			if (replacer) obj = replacer(key === void 0 ? "" : key, obj);
			let i;
			for (i = 0; i < stack.length; i += 1) if (stack[i] === obj) return replacementStack[i];
			let canonicalizedObj;
			if ("[object Array]" === Object.prototype.toString.call(obj)) {
				stack.push(obj);
				canonicalizedObj = new Array(obj.length);
				replacementStack.push(canonicalizedObj);
				for (i = 0; i < obj.length; i += 1) canonicalizedObj[i] = canonicalize(obj[i], stack, replacementStack, replacer, String(i));
				stack.pop();
				replacementStack.pop();
				return canonicalizedObj;
			}
			if (obj && obj.toJSON) obj = obj.toJSON();
			if (typeof obj === "object" && obj !== null) {
				stack.push(obj);
				canonicalizedObj = {};
				replacementStack.push(canonicalizedObj);
				const sortedKeys = [];
				let key;
				for (key in obj)
 /* istanbul ignore else */
				if (Object.prototype.hasOwnProperty.call(obj, key)) sortedKeys.push(key);
				sortedKeys.sort();
				for (i = 0; i < sortedKeys.length; i += 1) {
					key = sortedKeys[i];
					canonicalizedObj[key] = canonicalize(obj[key], stack, replacementStack, replacer, key);
				}
				stack.pop();
				replacementStack.pop();
			} else canonicalizedObj = obj;
			return canonicalizedObj;
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/array.js
		var ArrayDiff = class extends Diff {
			tokenize(value) {
				return value.slice();
			}
			join(value) {
				return value;
			}
			removeEmpty(value) {
				return value;
			}
		};
		new ArrayDiff();
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/patch/create.js
		function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
			let optionsObj;
			if (!options) optionsObj = {};
			else if (typeof options === "function") optionsObj = { callback: options };
			else optionsObj = options;
			if (typeof optionsObj.context === "undefined") optionsObj.context = 4;
			const context = optionsObj.context;
			if (optionsObj.newlineIsToken) throw new Error("newlineIsToken may not be used with patch-generation functions, only with diffing functions");
			if (!optionsObj.callback) return diffLinesResultToPatch(diffLines(oldStr, newStr, optionsObj));
			else {
				const { callback } = optionsObj;
				diffLines(oldStr, newStr, Object.assign(Object.assign({}, optionsObj), { callback: (diff) => {
					callback(diffLinesResultToPatch(diff));
				} }));
			}
			function diffLinesResultToPatch(diff) {
				if (!diff) return;
				diff.push({
					value: "",
					lines: []
				});
				function contextLines(lines) {
					return lines.map(function(entry) {
						return " " + entry;
					});
				}
				const hunks = [];
				let oldRangeStart = 0, newRangeStart = 0, curRange = [], oldLine = 1, newLine = 1;
				for (let i = 0; i < diff.length; i++) {
					const current = diff[i], lines = current.lines || splitLines(current.value);
					current.lines = lines;
					if (current.added || current.removed) {
						if (!oldRangeStart) {
							const prev = diff[i - 1];
							oldRangeStart = oldLine;
							newRangeStart = newLine;
							if (prev) {
								curRange = context > 0 ? contextLines(prev.lines.slice(-context)) : [];
								oldRangeStart -= curRange.length;
								newRangeStart -= curRange.length;
							}
						}
						for (const line of lines) curRange.push((current.added ? "+" : "-") + line);
						if (current.added) newLine += lines.length;
						else oldLine += lines.length;
					} else {
						if (oldRangeStart) if (lines.length <= context * 2 && i < diff.length - 2) for (const line of contextLines(lines)) curRange.push(line);
						else {
							const contextSize = Math.min(lines.length, context);
							for (const line of contextLines(lines.slice(0, contextSize))) curRange.push(line);
							const hunk = {
								oldStart: oldRangeStart,
								oldLines: oldLine - oldRangeStart + contextSize,
								newStart: newRangeStart,
								newLines: newLine - newRangeStart + contextSize,
								lines: curRange
							};
							hunks.push(hunk);
							oldRangeStart = 0;
							newRangeStart = 0;
							curRange = [];
						}
						oldLine += lines.length;
						newLine += lines.length;
					}
				}
				for (const hunk of hunks) for (let i = 0; i < hunk.lines.length; i++) if (hunk.lines[i].endsWith("\n")) hunk.lines[i] = hunk.lines[i].slice(0, -1);
				else {
					hunk.lines.splice(i + 1, 0, "\\ No newline at end of file");
					i++;
				}
				return {
					oldFileName,
					newFileName,
					oldHeader,
					newHeader,
					hunks
				};
			}
		}
		/**
		* Split `text` into an array of lines, including the trailing newline character (where present)
		*/
		function splitLines(text) {
			const hasTrailingNl = text.endsWith("\n");
			const result = text.split("\n").map((line) => line + "\n");
			if (hasTrailingNl) result.pop();
			else result.push(result.pop().slice(0, -1));
			return result;
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/trajectory-record.js
		/** Shared trajectory record data and formatting contracts. */
		/**
		* Resolve the identity that survives prepending older projected records.
		* @param cell - Projected trajectory record.
		* @returns Stable identity from the owning event or tool call, with a fixture fallback.
		*/
		function trajectoryRecordId(cell) {
			if (cell.recordId !== void 0) return cell.recordId;
			if (cell.callId !== void 0) return `${cell.kind}\u0000call\u0000${cell.callId}`;
			if (cell.sourceSeq !== void 0) return `${cell.kind}\u0000seq\u0000${cell.sourceSeq}`;
			return `${cell.kind}\u0000index\u0000${cell.index}`;
		}
		/**
		* Format a duration in milliseconds with thousands separators.
		* @param milliseconds - Duration in milliseconds, or `null` when absent.
		* @param t - Trajectory locale translator.
		* @returns `—` when unknown, otherwise an integer-millisecond label.
		*/
		function formatDurationMillis(milliseconds, t) {
			if (milliseconds === null || !Number.isFinite(milliseconds)) return "—";
			return t("unit.milliseconds", { value: String(Math.round(milliseconds)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") });
		}
		/**
		* Format an elapsed duration given in seconds as a millisecond label.
		* @param seconds - Duration seconds, or `null` when absent.
		* @param t - Trajectory locale translator.
		* @returns `—` when unknown, otherwise an integer-millisecond label.
		*/
		function formatElapsedSeconds(seconds, t) {
			return formatDurationMillis(seconds === null ? null : seconds * 1e3, t);
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/trajectory-virtual-rows.js
		/** Pure projection from trajectory records to measurable virtual ledger rows. */
		const CONTENT_ROW_HEIGHT = 30;
		const COLLAPSED_SUMMARY_HEIGHT = 20;
		const TERMINAL_BOUNDARY_HEIGHT = 9;
		/**
		* Derive the DOM-safe row identity shared by React, the virtualizer, and
		* browser scroll contracts.
		* @param record - Display record whose identity is required.
		* @returns Stable record identity with a suffix for synthetic fold summaries.
		*/
		function trajectoryVirtualRecordKey(record) {
			const identity = encodeURIComponent(trajectoryRecordId(record.cell));
			return record.collapsedSummaryKind === void 0 ? identity : `${identity}\u0000summary\u0000${record.collapsedSummaryKind}`;
		}
		/**
		* Attach separator-only records to the next content row so the virtualizer
		* never owns a zero-height item. A terminal separator retains its CSS-owned
		* lower-marker clearance as a standalone item.
		* @param records - Final search/fold projection in ledger order.
		* @returns Measurable virtual rows with original logical positions retained.
		*/
		function groupTrajectoryVirtualRows(records) {
			const rows = [];
			let pending = [];
			for (const [logicalIndex, record] of records.entries()) {
				const entry = {
					logicalIndex,
					record
				};
				if (record.cell.requestOnly === true) {
					pending.push(entry);
					continue;
				}
				const entries = [...pending, entry];
				pending = [];
				rows.push({
					entries,
					height: record.collapsedSummaryKind === void 0 ? CONTENT_ROW_HEIGHT : COLLAPSED_SUMMARY_HEIGHT,
					key: trajectoryVirtualRecordKey(record)
				});
			}
			if (pending.length > 0) rows.push({
				entries: pending,
				height: TERMINAL_BOUNDARY_HEIGHT,
				key: pending.map((candidate) => trajectoryVirtualRecordKey(candidate.record)).join("|")
			});
			return rows;
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/trajectory-preview.js
		/** Bounded Markdown-to-text projection shared by trajectory consumers. */
		const PREVIEW_SOURCE_CHARACTERS = 2048;
		const PREVIEW_OUTPUT_CHARACTERS = 512;
		/**
		* Build a bounded one-line preview without parsing the complete Markdown document.
		* @param text - Untrusted message, reasoning, payload, or result text.
		* @returns A compact preview capped independently from the retained source.
		*/
		function trajectoryPreviewText(text) {
			const source = text.slice(0, PREVIEW_SOURCE_CHARACTERS);
			const compact = (0, _deepseek_ai_dsh_client_ui_primitives.extractMarkdownPlainText)(source).replace(/\s+/g, " ").trim();
			const preview = compact.slice(0, PREVIEW_OUTPUT_CHARACTERS).trimEnd();
			return source.length < text.length || preview.length < compact.length ? `${preview}…` : preview;
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/code-program.js
		/** Recorded name of the programmatic tool-calling entry point. */
		const PTC_TOOL_NAME = "run_code";
		function record(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		function parseRecord(value) {
			if (value === void 0) return void 0;
			try {
				return record(JSON.parse(value));
			} catch {
				return;
			}
		}
		function recordedLanguage(schemaRaw) {
			const description = record(record(record(parseRecord(schemaRaw)?.parameters)?.properties)?.code)?.description;
			if (typeof description !== "string") return void 0;
			const typescript = /\bTypeScript\b/i.test(description);
			if (typescript === /\bPython\b/i.test(description)) return void 0;
			return typescript ? "typescript" : "python";
		}
		/**
		* Resolve a PTC program without guessing its language from source or current runtime settings.
		* @param cell - Recorded tool arguments and the schema visible at call time.
		* @returns The program, or undefined for another tool or unsupported arguments.
		*/
		function codeProgram(cell) {
			if (cell.kind !== "tool" && cell.kind !== "subtool") return void 0;
			if (cell.toolName !== "run_code" || cell.inputDetail === void 0) return void 0;
			const args = parseRecord(cell.inputDetail);
			if (typeof args?.code !== "string") return void 0;
			if (args.description !== void 0 && typeof args.description !== "string") return void 0;
			return {
				rawInput: cell.inputDetail,
				source: args.code,
				description: typeof args.description === "string" && args.description.trim() !== "" ? args.description : args.code.split(/\r?\n/).find((line) => line.trim() !== "")?.trim() ?? "",
				arguments: args,
				language: recordedLanguage(cell.schemaDetail)
			};
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-trajectory/src/client/TrajectoryTable.module.css.mjs
		const css$3 = "__GBH_UI_TRAJECTORY_CSS_TrajectoryTable__";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-trajectory/TrajectoryTable.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-trajectory";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var TrajectoryTable_module_css_default = {
			"arrow": "Y0dWHa_arrow",
			"assistantContent": "Y0dWHa_assistantContent",
			"assistantContentRendered": "Y0dWHa_assistantContentRendered",
			"assistantOutput": "Y0dWHa_assistantOutput",
			"assistantToolCallArgs": "Y0dWHa_assistantToolCallArgs",
			"assistantToolCallButton": "Y0dWHa_assistantToolCallButton",
			"assistantToolCallIcon": "Y0dWHa_assistantToolCallIcon",
			"assistantToolCallName": "Y0dWHa_assistantToolCallName",
			"assistantToolCallText": "Y0dWHa_assistantToolCallText",
			"assistantToolCalls": "Y0dWHa_assistantToolCalls",
			"assistantToolCallsPreview": "Y0dWHa_assistantToolCallsPreview",
			"assistantVioletBright": "Y0dWHa_assistantVioletBright",
			"attachmentDisclosure": "Y0dWHa_attachmentDisclosure",
			"attachmentIcon": "Y0dWHa_attachmentIcon",
			"attachmentInfo": "Y0dWHa_attachmentInfo",
			"attachmentMetadata": "Y0dWHa_attachmentMetadata",
			"attachmentName": "Y0dWHa_attachmentName",
			"attachmentRow": "Y0dWHa_attachmentRow",
			"attachments": "Y0dWHa_attachments",
			"attachmentsPreview": "Y0dWHa_attachmentsPreview",
			"close": "Y0dWHa_close",
			"collapsedTurnContent": "Y0dWHa_collapsedTurnContent",
			"collapsedTurnEllipsis": "Y0dWHa_collapsedTurnEllipsis",
			"collapsedTurnText": "Y0dWHa_collapsedTurnText",
			"compacted": "Y0dWHa_compacted",
			"compactedSummary": "Y0dWHa_compactedSummary",
			"content": "Y0dWHa_content",
			"contentColumn": "Y0dWHa_contentColumn",
			"contentText": "Y0dWHa_contentText",
			"contextGreen": "Y0dWHa_contextGreen",
			"detailBody": "Y0dWHa_detailBody",
			"detailBodyProgram": "Y0dWHa_detailBodyProgram",
			"detailBodySummary": "Y0dWHa_detailBodySummary",
			"detailTab": "Y0dWHa_detailTab",
			"detailTabActive": "Y0dWHa_detailTabActive",
			"detailTabs": "Y0dWHa_detailTabs",
			"details": "Y0dWHa_details",
			"detailsHeader": "Y0dWHa_detailsHeader",
			"detailsLocation": "Y0dWHa_detailsLocation",
			"detailsResizeHandle": "Y0dWHa_detailsResizeHandle",
			"detailsTitle": "Y0dWHa_detailsTitle",
			"error": "Y0dWHa_error",
			"errorPayload": "Y0dWHa_errorPayload",
			"event": "Y0dWHa_event",
			"eventColumn": "Y0dWHa_eventColumn",
			"eventHeader": "Y0dWHa_eventHeader",
			"eventInner": "Y0dWHa_eventInner",
			"historyLoadButton": "Y0dWHa_historyLoadButton",
			"historyLoadRow": "Y0dWHa_historyLoadRow",
			"historyLoading": "Y0dWHa_historyLoading",
			"historyLoadingBar": "Y0dWHa_historyLoadingBar",
			"inlineResult": "Y0dWHa_inlineResult",
			"inlineResultText": "Y0dWHa_inlineResultText",
			"jsonPayload": "Y0dWHa_jsonPayload",
			"jsonPreview": "Y0dWHa_jsonPreview",
			"kindSlot": "Y0dWHa_kindSlot",
			"kindTag": "Y0dWHa_kindTag",
			"kindTagIcon": "Y0dWHa_kindTagIcon",
			"kindTagLabel": "Y0dWHa_kindTagLabel",
			"markdownPayload": "Y0dWHa_markdownPayload",
			"markdownPreview": "Y0dWHa_markdownPreview",
			"message": "Y0dWHa_message",
			"messageImages": "Y0dWHa_messageImages",
			"noOutputText": "Y0dWHa_noOutputText",
			"noPayload": "Y0dWHa_noPayload",
			"overview": "Y0dWHa_overview",
			"overviewHeading": "Y0dWHa_overviewHeading",
			"overviewHierarchyJumpIconTight": "Y0dWHa_overviewHierarchyJumpIconTight",
			"overviewHierarchyNavLink": "Y0dWHa_overviewHierarchyNavLink",
			"overviewParentLinks": "Y0dWHa_overviewParentLinks",
			"overviewPreview": "Y0dWHa_overviewPreview",
			"overviewSection": "Y0dWHa_overviewSection",
			"overviewSections": "Y0dWHa_overviewSections",
			"overviewTitle": "Y0dWHa_overviewTitle",
			"overviewTitleIcon": "Y0dWHa_overviewTitleIcon",
			"payload": "Y0dWHa_payload",
			"payloadPreview": "Y0dWHa_payloadPreview",
			"programAction": "Y0dWHa_programAction",
			"programActions": "Y0dWHa_programActions",
			"programContent": "Y0dWHa_programContent",
			"programDescription": "Y0dWHa_programDescription",
			"programError": "Y0dWHa_programError",
			"programIcon": "Y0dWHa_programIcon",
			"programLanguage": "Y0dWHa_programLanguage",
			"programOutput": "Y0dWHa_programOutput",
			"programPanel": "Y0dWHa_programPanel",
			"programSource": "Y0dWHa_programSource",
			"programSummary": "Y0dWHa_programSummary",
			"promptDiff": "Y0dWHa_promptDiff",
			"promptDiffLineadded": "Y0dWHa_promptDiffLineadded",
			"promptDiffLinecontext": "Y0dWHa_promptDiffLinecontext",
			"promptDiffLinemeta": "Y0dWHa_promptDiffLinemeta",
			"promptDiffLineremoved": "Y0dWHa_promptDiffLineremoved",
			"promptDiffSection": "Y0dWHa_promptDiffSection",
			"promptDiffSections": "Y0dWHa_promptDiffSections",
			"promptDiffTitle": "Y0dWHa_promptDiffTitle",
			"requestBoundaryControl": "Y0dWHa_requestBoundaryControl",
			"requestBoundaryControlActive": "Y0dWHa_requestBoundaryControlActive",
			"requestDetailsDot": "Y0dWHa_requestDetailsDot",
			"requestDetailsName": "Y0dWHa_requestDetailsName",
			"requestTokenDetail": "Y0dWHa_requestTokenDetail",
			"resultBlockText": "Y0dWHa_resultBlockText",
			"resultBlocks": "Y0dWHa_resultBlocks",
			"resultBlocksPreview": "Y0dWHa_resultBlocksPreview",
			"resultPreview": "Y0dWHa_resultPreview",
			"resultRequest": "Y0dWHa_resultRequest",
			"schema": "Y0dWHa_schema",
			"schemaDescription": "Y0dWHa_schemaDescription",
			"schemaIntro": "Y0dWHa_schemaIntro",
			"schemaName": "Y0dWHa_schemaName",
			"schemaParameters": "Y0dWHa_schemaParameters",
			"schemaParametersTitle": "Y0dWHa_schemaParametersTitle",
			"schemaPreview": "Y0dWHa_schemaPreview",
			"schemaTree": "Y0dWHa_schemaTree",
			"selectionRail": "Y0dWHa_selectionRail",
			"sourceBlock": "Y0dWHa_sourceBlock",
			"sourceBlockContent": "Y0dWHa_sourceBlockContent",
			"sourceBlockHeader": "Y0dWHa_sourceBlockHeader",
			"sourceBlockJumpIcon": "Y0dWHa_sourceBlockJumpIcon",
			"sourceBlockJumpTarget": "Y0dWHa_sourceBlockJumpTarget",
			"sourceBlockLabel": "Y0dWHa_sourceBlockLabel",
			"sourceBlocks": "Y0dWHa_sourceBlocks",
			"split": "Y0dWHa_split",
			"subtoolAmber": "Y0dWHa_subtoolAmber",
			"summaryScrollRegion": "Y0dWHa_summaryScrollRegion",
			"systemNeutral": "Y0dWHa_systemNeutral",
			"systemPrompt": "Y0dWHa_systemPrompt",
			"table": "Y0dWHa_table",
			"tablePane": "Y0dWHa_tablePane",
			"thinkingChevron": "Y0dWHa_thinkingChevron",
			"thinkingQuote": "Y0dWHa_thinkingQuote",
			"thinkingQuoteOnlyPreview": "Y0dWHa_thinkingQuoteOnlyPreview",
			"thinkingToggle": "Y0dWHa_thinkingToggle",
			"timestampToggle": "Y0dWHa_timestampToggle",
			"toolAmber": "Y0dWHa_toolAmber",
			"toolCallNameTypeface": "Y0dWHa_toolCallNameTypeface",
			"toolCallOnly": "Y0dWHa_toolCallOnly",
			"toolCallPayload": "Y0dWHa_toolCallPayload",
			"toolCatalog": "Y0dWHa_toolCatalog",
			"toolCatalogChevron": "Y0dWHa_toolCatalogChevron",
			"toolCatalogDefinition": "Y0dWHa_toolCatalogDefinition",
			"toolCatalogDescription": "Y0dWHa_toolCatalogDescription",
			"toolCatalogFullDescription": "Y0dWHa_toolCatalogFullDescription",
			"toolCatalogIcon": "Y0dWHa_toolCatalogIcon",
			"toolCatalogItem": "Y0dWHa_toolCatalogItem",
			"toolCatalogName": "Y0dWHa_toolCatalogName",
			"toolCatalogSummary": "Y0dWHa_toolCatalogSummary",
			"toolCatalogTree": "Y0dWHa_toolCatalogTree",
			"toolUpdatePayload": "Y0dWHa_toolUpdatePayload",
			"trajectory-table": "Y0dWHa_trajectory-table",
			"turnLabel": "Y0dWHa_turnLabel",
			"turnLabelActive": "Y0dWHa_turnLabelActive",
			"turnLabelCompact": "Y0dWHa_turnLabelCompact",
			"turnLabelFull": "Y0dWHa_turnLabelFull",
			"turnRail": "Y0dWHa_turnRail",
			"usageGroup": "Y0dWHa_usageGroup",
			"usageHeading": "Y0dWHa_usageHeading",
			"usagePanel": "Y0dWHa_usagePanel",
			"user": "Y0dWHa_user",
			"virtualSpacer": "Y0dWHa_virtualSpacer",
			"visuallyHidden": "Y0dWHa_visuallyHidden"
		};
		//#endregion
} // __DSH_FRAGMENT_END__

export {};
