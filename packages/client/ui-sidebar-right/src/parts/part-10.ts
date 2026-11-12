/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
							prev.value = escaped;
							continue;
						}
						prev.value = `(${capture}${escaped}|${prev.value})`;
						state.output += prev.value;
						continue;
					}
					/**
					* Braces
					*/
					if (value === "{" && opts.nobrace !== true) {
						increment("braces");
						const open = {
							type: "brace",
							value,
							output: "(",
							outputIndex: state.output.length,
							tokensIndex: state.tokens.length
						};
						braces.push(open);
						push(open);
						continue;
					}
					if (value === "}") {
						const brace = braces[braces.length - 1];
						if (opts.nobrace === true || !brace) {
							push({
								type: "text",
								value,
								output: value
							});
							continue;
						}
						let output = ")";
						if (brace.dots === true) {
							const arr = tokens.slice();
							const range = [];
							for (let i = arr.length - 1; i >= 0; i--) {
								tokens.pop();
								if (arr[i].type === "brace") break;
								if (arr[i].type !== "dots") range.unshift(arr[i].value);
							}
							output = expandRange(range, opts);
							state.backtrack = true;
						}
						if (brace.comma !== true && brace.dots !== true) {
							const out = state.output.slice(0, brace.outputIndex);
							const toks = state.tokens.slice(brace.tokensIndex);
							brace.value = brace.output = "\\{";
							value = output = "\\}";
							state.output = out;
							for (const t of toks) state.output += t.output || t.value;
						}
						push({
							type: "brace",
							value,
							output
						});
						decrement("braces");
						braces.pop();
						continue;
					}
					/**
					* Pipes
					*/
					if (value === "|") {
						if (extglobs.length > 0) extglobs[extglobs.length - 1].conditions++;
						push({
							type: "text",
							value
						});
						continue;
					}
					/**
					* Commas
					*/
					if (value === ",") {
						let output = value;
						const brace = braces[braces.length - 1];
						if (brace && stack[stack.length - 1] === "braces") {
							brace.comma = true;
							output = "|";
						}
						push({
							type: "comma",
							value,
							output
						});
						continue;
					}
					/**
					* Slashes
					*/
					if (value === "/") {
						if (prev.type === "dot" && state.index === state.start + 1) {
							state.start = state.index + 1;
							state.consumed = "";
							state.output = "";
							tokens.pop();
							prev = bos;
							continue;
						}
						push({
							type: "slash",
							value,
							output: SLASH_LITERAL
						});
						continue;
					}
					/**
					* Dots
					*/
					if (value === ".") {
						if (state.braces > 0 && prev.type === "dot") {
							if (prev.value === ".") prev.output = DOT_LITERAL;
							const brace = braces[braces.length - 1];
							prev.type = "dots";
							prev.output += value;
							prev.value += value;
							brace.dots = true;
							continue;
						}
						if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
							push({
								type: "text",
								value,
								output: DOT_LITERAL
							});
							continue;
						}
						push({
							type: "dot",
							value,
							output: DOT_LITERAL
						});
						continue;
					}
					/**
					* Question marks
					*/
					if (value === "?") {
						if (!(prev && prev.value === "(") && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
							extglobOpen("qmark", value);
							continue;
						}
						if (prev && prev.type === "paren") {
							const next = peek();
							let output = value;
							if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) output = `\\${value}`;
							push({
								type: "text",
								value,
								output
							});
							continue;
						}
						if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
							push({
								type: "qmark",
								value,
								output: QMARK_NO_DOT
							});
							continue;
						}
						push({
							type: "qmark",
							value,
							output: QMARK
						});
						continue;
					}
					/**
					* Exclamation
					*/
					if (value === "!") {
						if (opts.noextglob !== true && peek() === "(") {
							if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
								extglobOpen("negate", value);
								continue;
							}
						}
						if (opts.nonegate !== true && state.index === 0) {
							negate();
							continue;
						}
					}
					/**
					* Plus
					*/
					if (value === "+") {
						if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
							extglobOpen("plus", value);
							continue;
						}
						if (prev && prev.value === "(" || opts.regex === false) {
							push({
								type: "plus",
								value,
								output: PLUS_LITERAL
							});
							continue;
						}
						if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
							push({
								type: "plus",
								value
							});
							continue;
						}
						push({
							type: "plus",
							value: PLUS_LITERAL
						});
						continue;
					}
					/**
					* Plain text
					*/
					if (value === "@") {
						if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
							push({
								type: "at",
								extglob: true,
								value,
								output: ""
							});
							continue;
						}
						push({
							type: "text",
							value
						});
						continue;
					}
					/**
					* Plain text
					*/
					if (value !== "*") {
						if (value === "$" || value === "^") value = `\\${value}`;
						const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
						if (match) {
							value += match[0];
							state.index += match[0].length;
						}
						push({
							type: "text",
							value
						});
						continue;
					}
					/**
					* Stars
					*/
					if (prev && (prev.type === "globstar" || prev.star === true)) {
						prev.type = "star";
						prev.star = true;
						prev.value += value;
						prev.output = star;
						state.backtrack = true;
						state.globstar = true;
						consume(value);
						continue;
					}
					let rest = remaining();
					if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
						extglobOpen("star", value);
						continue;
					}
					if (prev.type === "star") {
						if (opts.noglobstar === true) {
							consume(value);
							continue;
						}
						const prior = prev.prev;
						const before = prior.prev;
						const isStart = prior.type === "slash" || prior.type === "bos";
						const afterStar = before && (before.type === "star" || before.type === "globstar");
						if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
							push({
								type: "star",
								value,
								output: ""
							});
							continue;
						}
						const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
						const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
						if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
							push({
								type: "star",
								value,
								output: ""
							});
							continue;
						}
						while (rest.slice(0, 3) === "/**") {
							const after = input[state.index + 4];
							if (after && after !== "/") break;
							rest = rest.slice(3);
							consume("/**", 3);
						}
						const isEnd = eos() || state.parens > 0 && rest === ")".repeat(state.parens) && !extglobs.some((extglob) => extglob.type === "negate");
						if (prior.type === "bos" && eos()) {
							prev.type = "globstar";
							prev.value += value;
							prev.output = globstar(opts);
							state.output = prev.output;
							state.globstar = true;
							consume(value);
							continue;
						}
						if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && isEnd) {
							state.output = state.output.slice(0, -(prior.output + prev.output).length);
							prior.output = `(?:${prior.output}`;
							prev.type = "globstar";
							prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
							prev.value += value;
							state.globstar = true;
							state.output += prior.output + prev.output;
							consume(value);
							continue;
						}
						if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
							const end = rest[1] !== void 0 ? "|$" : "";
							state.output = state.output.slice(0, -(prior.output + prev.output).length);
							prior.output = `(?:${prior.output}`;
							prev.type = "globstar";
							prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
							prev.value += value;
							state.output += prior.output + prev.output;
							state.globstar = true;
							consume(value + advance());
							push({
								type: "slash",
								value: "/",
								output: ""
							});
							continue;
						}
						if (prior.type === "bos" && rest[0] === "/") {
							prev.type = "globstar";
							prev.value += value;
							prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
							state.output = prev.output;
							state.globstar = true;
							consume(value + advance());
							push({
								type: "slash",
								value: "/",
								output: ""
							});
							continue;
						}
						state.output = state.output.slice(0, -prev.output.length);
						prev.type = "globstar";
						prev.output = globstar(opts);
						prev.value += value;
						state.output += prev.output;
						state.globstar = true;
						consume(value);
						continue;
					}
					const token = {
						type: "star",
						value,
						output: star
					};
					if (opts.bash === true) {
						token.output = ".*?";
						if (prev.type === "bos" || prev.type === "slash") token.output = nodot + token.output;
						push(token);
						continue;
					}
					if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
						token.output = value;
						push(token);
						continue;
					}
					if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
						if (prev.type === "dot") {
							state.output += NO_DOT_SLASH;
							prev.output += NO_DOT_SLASH;
						} else if (opts.dot === true) {
							state.output += NO_DOTS_SLASH;
							prev.output += NO_DOTS_SLASH;
						} else {
							state.output += nodot;
							prev.output += nodot;
						}
						if (peek() !== "*") {
							state.output += ONE_CHAR;
							prev.output += ONE_CHAR;
						}
					}
					push(token);
				}
				while (state.brackets > 0) {
					if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
					state.output = utils.escapeLast(state.output, "[");
					decrement("brackets");
export {};
