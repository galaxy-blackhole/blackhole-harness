/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				this.host.openWithFocus(sessionId, () => {
					actions.splitPane(sessionId, target, (id) => {
						created = id;
					});
					return created;
				});
				return created;
			}
			/**
			* Take a docked tab out into a floating panel; a missing or floating tab is left alone.
			* @param tabId - the tab to float.
			* @param rect - the panel's rectangle; defaults to the cascade from the last panel.
			*/
			float(tabId, rect) {
				const { sessionId, actions } = this.require();
				const layout = this.mountedSurface()?.layout;
				if (layout === void 0 || layout.tabs[tabId] === void 0) return;
				if ((0, _deepseek_ai_dsh_client_ui_dockkit.findTabPane)(layout, tabId).host !== "dock") return;
				actions.floatTab(sessionId, tabId, rect);
			}
			/**
			* Return a floating panel's tab to the active docked pane; a missing or docked pane is left alone.
			* @param paneId - the floating pane.
			*/
			dock(paneId) {
				const { sessionId, actions } = this.require();
				const node = this.mountedSurface()?.layout.nodes[paneId];
				if (node === void 0 || node.kind !== "pane" || node.host !== "float") return;
				actions.unfloatPane(sessionId, paneId);
			}
			/**
			* Step the on-screen Session's surface back one intent.
			*
			* @internal Not part of the product: the sequence is an architectural fact
			* with no user-facing control yet. Kept reachable for tests.
			*/
			_undo() {
				const { sessionId, actions } = this.require();
				actions.undo(sessionId);
			}
			/**
			* Step the on-screen Session's surface forward one intent.
			*
			* @internal See `_undo`.
			*/
			_redo() {
				const { sessionId, actions } = this.require();
				actions.redo(sessionId);
			}
			/**
			* The on-screen Session and its committed surface; `undefined` with no Session
			* on screen, before the runtime mints its store, or before its first open.
			*/
			screen() {
				const sessionId = this.mounted.getSnapshot();
				if (sessionId === void 0) return void 0;
				const surface = this.adopted.get(sessionId)?.store.getSnapshot().bySession[sessionId];
				return surface === void 0 ? void 0 : {
					sessionId,
					surface
				};
			}
			/** The on-screen Session's surface; see {@link SidebarRightController.screen}. */
			mountedSurface() {
				return this.screen()?.surface;
			}
			/** Whether a Session's docked pane has room for two working halves, as its seat last measured; unmeasured panes do. */
			canSplitPane(sessionId, paneId) {
				return this.rooms.get(sessionId)?.(paneId) ?? true;
			}
			/**
			* The store actions a tab's own action on `sessionId` runs through: that
			* session's adopted store. `undefined` — nothing to act on — for a session
			* whose store was never minted or whose adoption was released.
			*/
			actionsFor(sessionId) {
				return this.adopted.get(sessionId)?.store.actions;
			}
			require() {
				const sessionId = this.mounted.getSnapshot();
				const actions = sessionId === void 0 ? void 0 : this.actionsFor(sessionId);
				if (sessionId === void 0 || actions === void 0) throw new Error("sidebarRight: no session surface is mounted");
				return {
					sessionId,
					actions
				};
			}
		};
		//#endregion
		//#region ../../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/constants.js
		var require_constants = /* @__PURE__ */ __commonJSMin(((exports, module) => {
			const WIN_SLASH = "\\\\/";
			const WIN_NO_SLASH = `[^${WIN_SLASH}]`;
			const DEFAULT_MAX_EXTGLOB_RECURSION = 0;
			/**
			* Posix glob regex
			*/
			const DOT_LITERAL = "\\.";
			const PLUS_LITERAL = "\\+";
			const QMARK_LITERAL = "\\?";
			const SLASH_LITERAL = "\\/";
			const ONE_CHAR = "(?=.)";
			const QMARK = "[^/]";
			const END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
			const START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
			const DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
			const POSIX_CHARS = {
				DOT_LITERAL,
				PLUS_LITERAL,
				QMARK_LITERAL,
				SLASH_LITERAL,
				ONE_CHAR,
				QMARK,
				END_ANCHOR,
				DOTS_SLASH,
				NO_DOT: `(?!${DOT_LITERAL})`,
				NO_DOTS: `(?!${START_ANCHOR}${DOTS_SLASH})`,
				NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`,
				NO_DOTS_SLASH: `(?!${DOTS_SLASH})`,
				QMARK_NO_DOT: `[^.${SLASH_LITERAL}]`,
				STAR: `${QMARK}*?`,
				START_ANCHOR,
				SEP: "/"
			};
			/**
			* Windows glob regex
			*/
			const WINDOWS_CHARS = {
				...POSIX_CHARS,
				SLASH_LITERAL: `[${WIN_SLASH}]`,
				QMARK: WIN_NO_SLASH,
				STAR: `${WIN_NO_SLASH}*?`,
				DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
				NO_DOT: `(?!${DOT_LITERAL})`,
				NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
				NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
				NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
				QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
				START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
				END_ANCHOR: `(?:[${WIN_SLASH}]|$)`,
				SEP: "\\"
			};
			module.exports = {
				DEFAULT_MAX_EXTGLOB_RECURSION,
				MAX_LENGTH: 1024 * 64,
				POSIX_REGEX_SOURCE: {
					__proto__: null,
					alnum: "a-zA-Z0-9",
					alpha: "a-zA-Z",
					ascii: "\\x00-\\x7F",
					blank: " \\t",
					cntrl: "\\x00-\\x1F\\x7F",
					digit: "0-9",
					graph: "\\x21-\\x7E",
					lower: "a-z",
					print: "\\x20-\\x7E ",
					punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
					space: " \\t\\r\\n\\v\\f",
					upper: "A-Z",
					word: "A-Za-z0-9_",
					xdigit: "A-Fa-f0-9"
				},
				REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
				REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
				REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
				REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
				REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
				REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
				REPLACEMENTS: {
					__proto__: null,
					"***": "*",
					"**/**": "**",
					"**/**/**": "**"
				},
				CHAR_0: 48,
				CHAR_9: 57,
				CHAR_UPPERCASE_A: 65,
				CHAR_LOWERCASE_A: 97,
				CHAR_UPPERCASE_Z: 90,
				CHAR_LOWERCASE_Z: 122,
				CHAR_LEFT_PARENTHESES: 40,
				CHAR_RIGHT_PARENTHESES: 41,
				CHAR_ASTERISK: 42,
				CHAR_AMPERSAND: 38,
				CHAR_AT: 64,
				CHAR_BACKWARD_SLASH: 92,
				CHAR_CARRIAGE_RETURN: 13,
				CHAR_CIRCUMFLEX_ACCENT: 94,
				CHAR_COLON: 58,
				CHAR_COMMA: 44,
				CHAR_DOT: 46,
				CHAR_DOUBLE_QUOTE: 34,
				CHAR_EQUAL: 61,
				CHAR_EXCLAMATION_MARK: 33,
				CHAR_FORM_FEED: 12,
				CHAR_FORWARD_SLASH: 47,
				CHAR_GRAVE_ACCENT: 96,
				CHAR_HASH: 35,
				CHAR_HYPHEN_MINUS: 45,
				CHAR_LEFT_ANGLE_BRACKET: 60,
				CHAR_LEFT_CURLY_BRACE: 123,
				CHAR_LEFT_SQUARE_BRACKET: 91,
				CHAR_LINE_FEED: 10,
				CHAR_NO_BREAK_SPACE: 160,
				CHAR_PERCENT: 37,
				CHAR_PLUS: 43,
				CHAR_QUESTION_MARK: 63,
				CHAR_RIGHT_ANGLE_BRACKET: 62,
				CHAR_RIGHT_CURLY_BRACE: 125,
				CHAR_RIGHT_SQUARE_BRACKET: 93,
				CHAR_SEMICOLON: 59,
				CHAR_SINGLE_QUOTE: 39,
				CHAR_SPACE: 32,
				CHAR_TAB: 9,
				CHAR_UNDERSCORE: 95,
				CHAR_VERTICAL_LINE: 124,
				CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
				/**
				* Create EXTGLOB_CHARS
				*/
				extglobChars(chars) {
					return {
						"!": {
							type: "negate",
							open: "(?:(?!(?:",
							close: `))${chars.STAR})`
						},
						"?": {
							type: "qmark",
							open: "(?:",
							close: ")?"
						},
						"+": {
							type: "plus",
							open: "(?:",
							close: ")+"
						},
						"*": {
							type: "star",
							open: "(?:",
							close: ")*"
						},
						"@": {
							type: "at",
							open: "(?:",
							close: ")"
						}
					};
				},
				/**
				* Create GLOB_CHARS
				*/
				globChars(win32) {
					return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
				}
			};
		}));
		//#endregion
		//#region ../../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/utils.js
		var require_utils = /* @__PURE__ */ __commonJSMin(((exports) => {
			const { REGEX_BACKSLASH, REGEX_REMOVE_BACKSLASH, REGEX_SPECIAL_CHARS, REGEX_SPECIAL_CHARS_GLOBAL } = require_constants();
			exports.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
			exports.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
			exports.isRegexChar = (str) => str.length === 1 && exports.hasRegexChars(str);
			exports.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
			exports.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
			exports.isWindows = () => {
				if (typeof navigator !== "undefined" && navigator.platform) {
					const platform = navigator.platform.toLowerCase();
					return platform === "win32" || platform === "windows";
				}
				if (typeof process !== "undefined" && process.platform) return process.platform === "win32";
				return false;
			};
			exports.removeBackslashes = (str) => {
				return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
					return match === "\\" ? "" : match;
				});
			};
			exports.escapeLast = (input, char, lastIdx) => {
				const idx = input.lastIndexOf(char, lastIdx);
				if (idx === -1) return input;
				if (input[idx - 1] === "\\") return exports.escapeLast(input, char, idx - 1);
				return `${input.slice(0, idx)}\\${input.slice(idx)}`;
			};
			exports.removePrefix = (input, state = {}) => {
				let output = input;
				if (output.startsWith("./")) {
					output = output.slice(2);
					state.prefix = "./";
				}
				return output;
			};
			exports.wrapOutput = (input, state = {}, options = {}) => {
				let output = `${options.contains ? "" : "^"}(?:${input})${options.contains ? "" : "$"}`;
				if (state.negated === true) output = `(?:^(?!${output}).*$)`;
				return output;
			};
			exports.basename = (path, { windows } = {}) => {
				const segs = path.split(windows ? /[\\/]/ : "/");
				const last = segs[segs.length - 1];
				if (last === "") return segs[segs.length - 2];
				return last;
			};
		}));
		//#endregion
		//#region ../../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/scan.js
		var require_scan = /* @__PURE__ */ __commonJSMin(((exports, module) => {
			const utils = require_utils();
			const { CHAR_ASTERISK, CHAR_AT, CHAR_BACKWARD_SLASH, CHAR_COMMA, CHAR_DOT, CHAR_EXCLAMATION_MARK, CHAR_FORWARD_SLASH, CHAR_LEFT_CURLY_BRACE, CHAR_LEFT_PARENTHESES, CHAR_LEFT_SQUARE_BRACKET, CHAR_PLUS, CHAR_QUESTION_MARK, CHAR_RIGHT_CURLY_BRACE, CHAR_RIGHT_PARENTHESES, CHAR_RIGHT_SQUARE_BRACKET } = require_constants();
			const isPathSeparator = (code) => {
				return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
			};
			const depth = (token) => {
				if (token.isPrefix !== true) token.depth = token.isGlobstar ? Infinity : 1;
			};
			/**
			* Quickly scans a glob pattern and returns an object with a handful of
			* useful properties, like `isGlob`, `path` (the leading non-glob, if it exists),
			* `glob` (the actual pattern), `negated` (true if the path starts with `!` but not
			* with `!(`) and `negatedExtglob` (true if the path starts with `!(`).
			*
			* ```js
			* const pm = require('picomatch');
			* console.log(pm.scan('foo/bar/*.js'));
			* { isGlob: true, input: 'foo/bar/*.js', base: 'foo/bar', glob: '*.js' }
			* ```
			* @param {String} `str`
			* @param {Object} `options`
			* @return {Object} Returns an object with tokens and regex source string.
			* @api public
			*/
			const scan = (input, options) => {
				const opts = options || {};
				const length = input.length - 1;
				const scanToEnd = opts.parts === true || opts.tokens === true || opts.scanToEnd === true;
				const slashes = [];
				const tokens = [];
				const parts = [];
				let str = input;
				let index = -1;
				let start = 0;
				let lastIndex = 0;
				let isBrace = false;
				let isBracket = false;
				let isGlob = false;
				let isExtglob = false;
				let isGlobstar = false;
				let braceEscaped = false;
				let backslashes = false;
				let negated = false;
				let negatedExtglob = false;
				let finished = false;
				let braces = 0;
				let prev;
				let code;
				let token = {
					value: "",
					depth: 0,
					isGlob: false
				};
				const eos = () => index >= length;
				const peek = () => str.charCodeAt(index + 1);
				const advance = () => {
					prev = code;
					return str.charCodeAt(++index);
				};
				while (index < length) {
					code = advance();
					let next;
					if (code === CHAR_BACKWARD_SLASH) {
						backslashes = token.backslashes = true;
						code = advance();
						if (code === CHAR_LEFT_CURLY_BRACE) braceEscaped = true;
						continue;
					}
					if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
						braces++;
						while (eos() !== true && (code = advance())) {
							if (code === CHAR_BACKWARD_SLASH) {
								backslashes = token.backslashes = true;
								advance();
								continue;
							}
							if (code === CHAR_LEFT_CURLY_BRACE) {
								braces++;
								continue;
							}
							if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
								isBrace = token.isBrace = true;
								isGlob = token.isGlob = true;
								finished = true;
								if (scanToEnd === true) continue;
								break;
							}
							if (braceEscaped !== true && code === CHAR_COMMA) {
								isBrace = token.isBrace = true;
								isGlob = token.isGlob = true;
								finished = true;
								if (scanToEnd === true) continue;
export {};
