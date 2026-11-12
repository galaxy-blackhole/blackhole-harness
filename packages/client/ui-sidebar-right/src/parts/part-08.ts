/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
								break;
							}
							if (code === CHAR_RIGHT_CURLY_BRACE) {
								braces--;
								if (braces === 0) {
									braceEscaped = false;
									isBrace = token.isBrace = true;
									finished = true;
									break;
								}
							}
						}
						if (scanToEnd === true) continue;
						break;
					}
					if (code === CHAR_FORWARD_SLASH) {
						slashes.push(index);
						tokens.push(token);
						token = {
							value: "",
							depth: 0,
							isGlob: false
						};
						if (finished === true) continue;
						if (prev === CHAR_DOT && index === start + 1) {
							start += 2;
							continue;
						}
						lastIndex = index + 1;
						continue;
					}
					if (opts.noext !== true) {
						if ((code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK) === true && peek() === CHAR_LEFT_PARENTHESES) {
							isGlob = token.isGlob = true;
							isExtglob = token.isExtglob = true;
							finished = true;
							if (code === CHAR_EXCLAMATION_MARK && index === start) negatedExtglob = true;
							if (scanToEnd === true) {
								let parens = 0;
								while (eos() !== true && (code = advance())) {
									if (code === CHAR_BACKWARD_SLASH) {
										backslashes = token.backslashes = true;
										advance();
										continue;
									}
									if (code === CHAR_LEFT_PARENTHESES) {
										parens++;
										continue;
									}
									if (code === CHAR_RIGHT_PARENTHESES && --parens === 0) {
										finished = true;
										break;
									}
								}
								continue;
							}
							break;
						}
					}
					if (code === CHAR_ASTERISK) {
						if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
						isGlob = token.isGlob = true;
						finished = true;
						if (scanToEnd === true) continue;
						break;
					}
					if (code === CHAR_QUESTION_MARK) {
						isGlob = token.isGlob = true;
						finished = true;
						if (scanToEnd === true) continue;
						break;
					}
					if (code === CHAR_LEFT_SQUARE_BRACKET) {
						while (eos() !== true && (next = advance())) {
							if (next === CHAR_BACKWARD_SLASH) {
								backslashes = token.backslashes = true;
								advance();
								continue;
							}
							if (next === CHAR_RIGHT_SQUARE_BRACKET) {
								isBracket = token.isBracket = true;
								isGlob = token.isGlob = true;
								finished = true;
								break;
							}
						}
						if (scanToEnd === true) continue;
						break;
					}
					if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
						negated = token.negated = true;
						start++;
						continue;
					}
					if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
						isGlob = token.isGlob = true;
						if (scanToEnd === true) {
							let parens = 1;
							while (eos() !== true && (code = advance())) {
								if (code === CHAR_BACKWARD_SLASH) {
									backslashes = token.backslashes = true;
									advance();
									continue;
								}
								if (code === CHAR_LEFT_PARENTHESES) {
									parens++;
									continue;
								}
								if (code === CHAR_RIGHT_PARENTHESES && --parens === 0) {
									finished = true;
									break;
								}
							}
							continue;
						}
						break;
					}
					if (isGlob === true) {
						finished = true;
						if (scanToEnd === true) continue;
						break;
					}
				}
				if (opts.noext === true) {
					isExtglob = false;
					isGlob = false;
				}
				let base = str;
				let prefix = "";
				let glob = "";
				if (start > 0) {
					prefix = str.slice(0, start);
					str = str.slice(start);
					lastIndex -= start;
				}
				if (base && isGlob === true && lastIndex > 0) {
					base = str.slice(0, lastIndex);
					glob = str.slice(lastIndex);
				} else if (isGlob === true) {
					base = "";
					glob = str;
				} else base = str;
				if (base && base !== "" && base !== "/" && base !== str) {
					if (isPathSeparator(base.charCodeAt(base.length - 1))) base = base.slice(0, -1);
				}
				if (opts.unescape === true) {
					if (glob) glob = utils.removeBackslashes(glob);
					if (base && backslashes === true) base = utils.removeBackslashes(base);
				}
				const state = {
					prefix,
					input,
					start,
					base,
					glob,
					isBrace,
					isBracket,
					isGlob,
					isExtglob,
					isGlobstar,
					negated,
					negatedExtglob
				};
				if (opts.tokens === true) {
					state.maxDepth = 0;
					if (!isPathSeparator(code)) tokens.push(token);
					state.tokens = tokens;
				}
				if (opts.parts === true || opts.tokens === true) {
					let prevIndex;
					for (let idx = 0; idx < slashes.length; idx++) {
						const n = prevIndex !== void 0 ? prevIndex + 1 : start;
						const i = slashes[idx];
						const value = input.slice(n, i);
						if (opts.tokens) {
							if (idx === 0 && start !== 0) {
								tokens[idx].isPrefix = true;
								tokens[idx].value = prefix;
							} else tokens[idx].value = value;
							depth(tokens[idx]);
							state.maxDepth += tokens[idx].depth;
						}
						if (i >= start) {
							parts.push(value);
							prevIndex = i;
						}
					}
					const n = prevIndex !== void 0 ? prevIndex + 1 : start;
					const value = input.slice(n);
					parts.push(value);
					if (opts.tokens && prevIndex && prevIndex + 1 < input.length) {
						tokens[tokens.length - 1].value = value;
						depth(tokens[tokens.length - 1]);
						state.maxDepth += tokens[tokens.length - 1].depth;
					}
					state.slashes = slashes;
					state.parts = parts;
				}
				return state;
			};
			module.exports = scan;
		}));
		//#endregion
		//#region ../../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/parse.js
		var require_parse = /* @__PURE__ */ __commonJSMin(((exports, module) => {
			const constants = require_constants();
			const utils = require_utils();
			/**
			* Constants
			*/
			const { MAX_LENGTH, POSIX_REGEX_SOURCE, REGEX_NON_SPECIAL_CHARS, REGEX_SPECIAL_CHARS_BACKREF, REPLACEMENTS } = constants;
			/**
			* Helpers
			*/
			const expandRange = (args, options) => {
				if (typeof options.expandRange === "function") return options.expandRange(...args, options);
				args.sort();
				const value = `[${args.join("-")}]`;
				try {
					new RegExp(value);
				} catch (ex) {
					return args.map((v) => utils.escapeRegex(v)).join("..");
				}
				return value;
			};
			/**
			* Create the message for a syntax error
			*/
			const syntaxError = (type, char) => {
				return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
			};
			const splitTopLevel = (input) => {
				const parts = [];
				let bracket = 0;
				let paren = 0;
				let quote = 0;
				let value = "";
				let escaped = false;
				for (const ch of input) {
					if (escaped === true) {
						value += ch;
						escaped = false;
						continue;
					}
					if (ch === "\\") {
						value += ch;
						escaped = true;
						continue;
					}
					if (ch === "\"") {
						quote = quote === 1 ? 0 : 1;
						value += ch;
						continue;
					}
					if (quote === 0) {
						if (ch === "[") bracket++;
						else if (ch === "]" && bracket > 0) bracket--;
						else if (bracket === 0) {
							if (ch === "(") paren++;
							else if (ch === ")" && paren > 0) paren--;
							else if (ch === "|" && paren === 0) {
								parts.push(value);
								value = "";
								continue;
							}
						}
					}
					value += ch;
				}
				parts.push(value);
				return parts;
			};
			const isPlainBranch = (branch) => {
				let escaped = false;
				for (const ch of branch) {
					if (escaped === true) {
						escaped = false;
						continue;
					}
					if (ch === "\\") {
						escaped = true;
						continue;
					}
					if (/[?*+@!()[\]{}]/.test(ch)) return false;
				}
				return true;
			};
			const normalizeSimpleBranch = (branch) => {
				let value = branch.trim();
				let changed = true;
				while (changed === true) {
					changed = false;
					if (/^@\([^\\()[\]{}|]+\)$/.test(value)) {
						value = value.slice(2, -1);
						changed = true;
					}
				}
				if (!isPlainBranch(value)) return;
				return value.replace(/\\(.)/g, "$1");
			};
			const hasRepeatedCharPrefixOverlap = (branches) => {
				const values = branches.map(normalizeSimpleBranch).filter(Boolean);
				for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
					const a = values[i];
					const b = values[j];
					const char = a[0];
					if (!char || a !== char.repeat(a.length) || b !== char.repeat(b.length)) continue;
					if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
				}
				return false;
			};
			const parseRepeatedExtglob = (pattern, requireEnd = true) => {
				if (pattern[0] !== "+" && pattern[0] !== "*" || pattern[1] !== "(") return;
				let bracket = 0;
				let paren = 0;
				let quote = 0;
				let escaped = false;
				for (let i = 1; i < pattern.length; i++) {
					const ch = pattern[i];
					if (escaped === true) {
						escaped = false;
						continue;
					}
					if (ch === "\\") {
						escaped = true;
						continue;
					}
					if (ch === "\"") {
						quote = quote === 1 ? 0 : 1;
						continue;
					}
					if (quote === 1) continue;
					if (ch === "[") {
						bracket++;
						continue;
					}
					if (ch === "]" && bracket > 0) {
						bracket--;
						continue;
					}
					if (bracket > 0) continue;
					if (ch === "(") {
						paren++;
						continue;
					}
					if (ch === ")") {
						paren--;
						if (paren === 0) {
							if (requireEnd === true && i !== pattern.length - 1) return;
							return {
								type: pattern[0],
								body: pattern.slice(2, i),
								end: i
							};
						}
					}
				}
			};
			const buildCharClassStar = (chars) => {
				return `${chars.length === 1 ? utils.escapeRegex(chars[0]) : `[${chars.map((ch) => utils.escapeRegex(ch)).join("")}]`}*`;
			};
			const getStarExtglobSequenceChars = (pattern) => {
				let index = 0;
				const chars = [];
				while (index < pattern.length) {
					const match = parseRepeatedExtglob(pattern.slice(index), false);
					if (!match || match.type !== "*") return;
					const branches = splitTopLevel(match.body).map((branch) => branch.trim());
					if (branches.length !== 1) return;
					const branch = normalizeSimpleBranch(branches[0]);
					if (!branch || branch.length !== 1) return;
					chars.push(branch);
					index += match.end + 1;
				}
				if (chars.length < 1) return;
				return chars;
			};
			const repeatedExtglobRecursion = (pattern) => {
				let depth = 0;
				let value = pattern.trim();
				let match = parseRepeatedExtglob(value);
				while (match) {
					depth++;
					value = match.body.trim();
					match = parseRepeatedExtglob(value);
				}
				return depth;
			};
			const analyzeRepeatedExtglob = (body, options) => {
				if (options.maxExtglobRecursion === false) return { risky: false };
				const max = typeof options.maxExtglobRecursion === "number" ? options.maxExtglobRecursion : constants.DEFAULT_MAX_EXTGLOB_RECURSION;
				const branches = splitTopLevel(body).map((branch) => branch.trim());
				if (branches.length > 1) {
					if (branches.some((branch) => branch === "") || branches.some((branch) => /^[*?]+$/.test(branch)) || hasRepeatedCharPrefixOverlap(branches)) return { risky: true };
				}
				const safeChars = [];
				let sawStarSequence = false;
				let combinable = true;
				for (const branch of branches) {
					const chars = getStarExtglobSequenceChars(branch);
export {};
