/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					if (chars) {
						sawStarSequence = true;
						safeChars.push(...chars);
						continue;
					}
					const literal = normalizeSimpleBranch(branch);
					if (literal && literal.length === 1) {
						safeChars.push(literal);
						continue;
					}
					combinable = false;
					if (repeatedExtglobRecursion(branch) > max) return { risky: true };
				}
				if (sawStarSequence) return combinable ? {
					risky: true,
					safeOutput: buildCharClassStar([...new Set(safeChars)])
				} : { risky: true };
				return { risky: false };
			};
			/**
			* Parse the given input string.
			* @param {String} input
			* @param {Object} options
			* @return {Object}
			*/
			const parse = (input, options) => {
				if (typeof input !== "string") throw new TypeError("Expected a string");
				input = REPLACEMENTS[input] || input;
				const opts = { ...options };
				const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
				let len = input.length;
				if (len > max) throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
				const bos = {
					type: "bos",
					value: "",
					output: opts.prepend || ""
				};
				const tokens = [bos];
				const capture = opts.capture ? "" : "?:";
				const PLATFORM_CHARS = constants.globChars(opts.windows);
				const EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);
				const { DOT_LITERAL, PLUS_LITERAL, SLASH_LITERAL, ONE_CHAR, DOTS_SLASH, NO_DOT, NO_DOT_SLASH, NO_DOTS_SLASH, QMARK, QMARK_NO_DOT, STAR, START_ANCHOR } = PLATFORM_CHARS;
				const globstar = (opts) => {
					return `(${capture}(?:(?!${START_ANCHOR}${opts.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
				};
				const nodot = opts.dot ? "" : NO_DOT;
				const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
				let star = opts.bash === true ? globstar(opts) : STAR;
				if (opts.capture) star = `(${star})`;
				if (typeof opts.noext === "boolean") opts.noextglob = opts.noext;
				const state = {
					input,
					index: -1,
					start: 0,
					dot: opts.dot === true,
					consumed: "",
					output: "",
					prefix: "",
					backtrack: false,
					negated: false,
					brackets: 0,
					braces: 0,
					parens: 0,
					quotes: 0,
					globstar: false,
					tokens
				};
				input = utils.removePrefix(input, state);
				len = input.length;
				const extglobs = [];
				const braces = [];
				const stack = [];
				let prev = bos;
				let value;
				/**
				* Tokenizing helpers
				*/
				const eos = () => state.index === len - 1;
				const peek = state.peek = (n = 1) => input[state.index + n];
				const advance = state.advance = () => input[++state.index] || "";
				const remaining = () => input.slice(state.index + 1);
				const consume = (value = "", num = 0) => {
					state.consumed += value;
					state.index += num;
				};
				const append = (token) => {
					state.output += token.output != null ? token.output : token.value;
					consume(token.value);
				};
				const negate = () => {
					let count = 1;
					while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
						advance();
						state.start++;
						count++;
					}
					if (count % 2 === 0) return false;
					state.negated = true;
					state.start++;
					return true;
				};
				const increment = (type) => {
					state[type]++;
					stack.push(type);
				};
				const decrement = (type) => {
					state[type]--;
					stack.pop();
				};
				/**
				* Push tokens onto the tokens array. This helper speeds up
				* tokenizing by 1) helping us avoid backtracking as much as possible,
				* and 2) helping us avoid creating extra tokens when consecutive
				* characters are plain text. This improves performance and simplifies
				* lookbehinds.
				*/
				const push = (tok) => {
					if (prev.type === "globstar") {
						const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
						const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
						if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
							state.output = state.output.slice(0, -prev.output.length);
							prev.type = "star";
							prev.value = "*";
							prev.output = star;
							state.output += prev.output;
						}
					}
					if (extglobs.length && tok.type !== "paren") extglobs[extglobs.length - 1].inner += tok.value;
					if (tok.value || tok.output) append(tok);
					if (prev && prev.type === "text" && tok.type === "text") {
						prev.output = (prev.output || prev.value) + tok.value;
						prev.value += tok.value;
						return;
					}
					tok.prev = prev;
					tokens.push(tok);
					prev = tok;
				};
				const extglobOpen = (type, value) => {
					const token = {
						...EXTGLOB_CHARS[value],
						conditions: 1,
						inner: ""
					};
					token.prev = prev;
					token.parens = state.parens;
					token.output = state.output;
					token.startIndex = state.index;
					token.tokensIndex = tokens.length;
					const output = (opts.capture ? "(" : "") + token.open;
					increment("parens");
					push({
						type,
						value,
						output: state.output ? "" : ONE_CHAR
					});
					push({
						type: "paren",
						extglob: true,
						value: advance(),
						output
					});
					extglobs.push(token);
				};
				const extglobClose = (token) => {
					const literal = input.slice(token.startIndex, state.index + 1);
					const analysis = analyzeRepeatedExtglob(input.slice(token.startIndex + 2, state.index), opts);
					if ((token.type === "plus" || token.type === "star") && analysis.risky) {
						const safeOutput = analysis.safeOutput ? (token.output ? "" : ONE_CHAR) + (opts.capture ? `(${analysis.safeOutput})` : analysis.safeOutput) : void 0;
						const open = tokens[token.tokensIndex];
						open.type = "text";
						open.value = literal;
						open.output = safeOutput || utils.escapeRegex(literal);
						for (let i = token.tokensIndex + 1; i < tokens.length; i++) {
							tokens[i].value = "";
							tokens[i].output = "";
							delete tokens[i].suffix;
						}
						state.output = token.output + open.output;
						state.backtrack = true;
						push({
							type: "paren",
							extglob: true,
							value,
							output: ""
						});
						decrement("parens");
						return;
					}
					let output = token.close + (opts.capture ? ")" : "");
					let rest;
					if (token.type === "negate") {
						let extglobStar = star;
						if (token.inner && token.inner.length > 1 && token.inner.includes("/")) extglobStar = globstar(opts);
						if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) output = token.close = `)$))${extglobStar}`;
						if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) output = token.close = `)${parse(rest, {
							...options,
							fastpaths: false
						}).output})${extglobStar})`;
						if (token.prev.type === "bos") state.negatedExtglob = true;
					}
					push({
						type: "paren",
						extglob: true,
						value,
						output
					});
					decrement("parens");
				};
				/**
				* Fast paths
				*/
				if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
					let backslashes = false;
					let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
						if (first === "\\") {
							backslashes = true;
							return m;
						}
						if (first === "?") {
							if (esc) return esc + first + (rest ? QMARK.repeat(rest.length) : "");
							if (index === 0) return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "");
							return QMARK.repeat(chars.length);
						}
						if (first === ".") return DOT_LITERAL.repeat(chars.length);
						if (first === "*") {
							if (esc) return esc + first + (rest ? star : "");
							return star;
						}
						return esc ? m : `\\${m}`;
					});
					if (backslashes === true) if (opts.unescape === true) output = output.replace(/\\/g, "");
					else output = output.replace(/\\+/g, (m) => {
						return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
					});
					if (output === input && opts.contains === true) {
						state.output = input;
						return state;
					}
					state.output = utils.wrapOutput(output, state, options);
					return state;
				}
				/**
				* Tokenize input until we reach end-of-string
				*/
				while (!eos()) {
					value = advance();
					if (value === "\0") continue;
					/**
					* Escaped characters
					*/
					if (value === "\\") {
						const next = peek();
						if (next === "/" && opts.bash !== true) continue;
						if (next === "." || next === ";") continue;
						if (!next) {
							value += "\\";
							push({
								type: "text",
								value
							});
							continue;
						}
						const match = /^\\+/.exec(remaining());
						let slashes = 0;
						if (match && match[0].length > 2) {
							slashes = match[0].length;
							state.index += slashes;
							if (slashes % 2 !== 0) value += "\\";
						}
						if (opts.unescape === true) value = advance();
						else value += advance();
						if (state.brackets === 0) {
							push({
								type: "text",
								value
							});
							continue;
						}
					}
					/**
					* If we're inside a regex character class, continue
					* until we reach the closing bracket.
					*/
					if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
						if (opts.posix !== false && value === ":") {
							const inner = prev.value.slice(1);
							if (inner.includes("[")) {
								prev.posix = true;
								if (inner.includes(":")) {
									const idx = prev.value.lastIndexOf("[");
									const pre = prev.value.slice(0, idx);
									const posix = POSIX_REGEX_SOURCE[prev.value.slice(idx + 2)];
									if (posix) {
										prev.value = pre + posix;
										state.backtrack = true;
										advance();
										if (!bos.output && tokens.indexOf(prev) === 1) bos.output = ONE_CHAR;
										continue;
									}
								}
							}
						}
						if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") value = `\\${value}`;
						if (value === "]" && (prev.value === "[" || prev.value === "[^")) value = `\\${value}`;
						if (opts.posix === true && value === "!" && prev.value === "[") value = "^";
						prev.value += value;
						append({ value });
						continue;
					}
					/**
					* If we're inside a quoted string, continue
					* until we reach the closing double quote.
					*/
					if (state.quotes === 1 && value !== "\"") {
						value = utils.escapeRegex(value);
						prev.value += value;
						append({ value });
						continue;
					}
					/**
					* Double quotes
					*/
					if (value === "\"") {
						state.quotes = state.quotes === 1 ? 0 : 1;
						if (opts.keepQuotes === true) push({
							type: "text",
							value
						});
						continue;
					}
					/**
					* Parentheses
					*/
					if (value === "(") {
						increment("parens");
						push({
							type: "paren",
							value
						});
						continue;
					}
					if (value === ")") {
						if (state.parens === 0 && opts.strictBrackets === true) throw new SyntaxError(syntaxError("opening", "("));
						const extglob = extglobs[extglobs.length - 1];
						if (extglob && state.parens === extglob.parens + 1) {
							extglobClose(extglobs.pop());
							continue;
						}
						push({
							type: "paren",
							value,
							output: state.parens ? ")" : "\\)"
						});
						decrement("parens");
						continue;
					}
					/**
					* Square brackets
					*/
					if (value === "[") {
						if (opts.nobracket === true || !remaining().includes("]")) {
							if (opts.nobracket !== true && opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
							value = `\\${value}`;
						} else increment("brackets");
						push({
							type: "bracket",
							value
						});
						continue;
					}
					if (value === "]") {
						if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
							push({
								type: "text",
								value,
								output: `\\${value}`
							});
							continue;
						}
						if (state.brackets === 0) {
							if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("opening", "["));
							push({
								type: "text",
								value,
								output: `\\${value}`
							});
							continue;
						}
						decrement("brackets");
						const prevValue = prev.value.slice(1);
						if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) value = `/${value}`;
						prev.value += value;
						append({ value });
						if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) continue;
						const escaped = utils.escapeRegex(prev.value);
						state.output = state.output.slice(0, -prev.value.length);
						if (opts.literalBrackets === true) {
							state.output += escaped;
export {};
