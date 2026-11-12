/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-secret-mask",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		const prefixed = (literal, shape, run, min, max = 0) => ({
			literal,
			kind: 2,
			shape,
			run,
			min,
			max
		});
		/** Every prefixed format matches more than the 8 characters a mask leaves readable. */
		const CREDENTIAL_FORMATS = [
			{
				literal: "-----BEGIN ",
				kind: 0,
				shape: 0,
				run: 0,
				min: 0,
				max: 0
			},
			{
				literal: "://",
				kind: 1,
				shape: 0,
				run: 0,
				min: 0,
				max: 0
			},
			prefixed("sk-", 2, 1, 20),
			prefixed("AIza", 3, 1, 35),
			prefixed("ghp_", 0, 2, 36),
			prefixed("gho_", 0, 2, 36),
			prefixed("ghu_", 0, 2, 36),
			prefixed("ghs_", 0, 2, 36),
			prefixed("ghr_", 0, 2, 36),
			prefixed("github_pat_", 0, 4, 22),
			prefixed("glpat-", 0, 1, 20),
			prefixed("npm_", 0, 2, 36),
			prefixed("hf_", 0, 2, 30),
			prefixed("AKIA", 1, 16, 16, 16),
			prefixed("ASIA", 1, 16, 16, 16),
			prefixed("LTAI", 1, 2, 12, 20),
			prefixed("AKID", 1, 2, 28, 36),
			prefixed("xoxa-", 0, 8, 10),
			prefixed("xoxb-", 0, 8, 10),
			prefixed("xoxp-", 0, 8, 10),
			prefixed("xoxr-", 0, 8, 10),
			prefixed("xoxs-", 0, 8, 10),
			prefixed("sk_live_", 0, 2, 16),
			prefixed("sk_test_", 0, 2, 16),
			prefixed("rk_live_", 0, 2, 16),
			prefixed("rk_test_", 0, 2, 16),
			prefixed("whsec_", 0, 2, 24),
			prefixed("eyJ", 4, 1, 8, 2048)
		];
		/** Leading characters of a prefixed key left readable: the provider prefix and little else. */
		const VISIBLE_PREFIX = 8;
		const SHARED_MARKS = 4096;
		/** Builds masks; owns the shared mark strings and its sticky run pattern. */
		var CredentialMasks = class {
			marksOnly = "*".repeat(SHARED_MARKS);
			marksLf = `${this.marksOnly}\n`;
			marksCr = `${this.marksOnly}\r`;
			/** Code units that `lines` counts without inspection: neither line breaks nor surrogates. Set `lastIndex` before each test. */
			ordinary = /[^\r\n\ud800-\udfff]*/y;
			/**
			* The display form of `text[start, end)`, whose earliest candidate has `kind`.
			* @param text - the queried text.
			* @param kind - the literal kind of the range's earliest candidate.
			* @param plain - the range holds only prefixed-format characters: ASCII without line breaks.
			* @param start - first offset of the range.
			* @param end - offset after the range.
			* @returns the mask; line breaks stay in place, one mark per code point.
			*/
			masked(text, kind, plain, start, end) {
				if (kind === 1) return this.range(text, start, end);
				if (kind === 2) return text.slice(start, start + VISIBLE_PREFIX) + (plain ? this.marks(end - start - VISIBLE_PREFIX) : this.range(text, start + VISIBLE_PREFIX, end));
				return this.keyBlock(text, start, end);
			}
			/** `count` marks: up to the shared string's length, one slice of it. */
			marks(count) {
				return count <= SHARED_MARKS ? this.marksOnly.slice(0, count) : "*".repeat(count);
			}
			/** `count` marks and then the line break `code`, 10 or 13: one slice where `marks` would be one. */
			marksThen(count, code) {
				return count <= SHARED_MARKS ? (code === 10 ? this.marksLf : this.marksCr).slice(SHARED_MARKS - count) : "*".repeat(count) + (code === 10 ? "\n" : "\r");
			}
			/**
			* Keep the `BEGIN` line, the `END` line when present, and every line break; a block written on
			* one line is masked whole. Both searches stay inside the range, so they cost what the mask costs.
			*/
			keyBlock(text, start, end) {
				let bodyStart = start;
				for (let index = start; index < end; index++) if (text.charCodeAt(index) === 10) {
					bodyStart = index + 1;
					break;
				}
				let bodyEnd = end;
				for (let index = end - 9; index >= bodyStart; index--) if (text.charCodeAt(index) === 10 && text.startsWith("-----END", index + 1)) {
					bodyEnd = index;
					break;
				}
				const body = bodyEnd === text.length || text.charCodeAt(bodyEnd) === 10 || text.charCodeAt(bodyEnd) === 13 ? this.lines(text, bodyStart, bodyEnd) : this.range(text, bodyStart, bodyEnd);
				return text.slice(start, bodyStart) + body + text.slice(bodyEnd, end);
			}
			/**
			* `text[start, end)` with every character except line breaks replaced; a surrogate pair is one
			* character, as `[^\r\n]` with the `u` flag counts it. A character loop: a native run could read far past `end`.
			*/
			range(text, start, end) {
				let masked = "";
				let count = 0;
				for (let index = start; index < end; index++) {
					const code = text.charCodeAt(index);
					if (code === 10 || code === 13) {
						masked += this.marksThen(count, code);
						count = 0;
						continue;
					}
					if (code >= 55296 && code <= 56319 && index + 1 < end) {
						const next = text.charCodeAt(index + 1);
						if (next >= 56320 && next <= 57343) index++;
					}
					count++;
				}
				return masked + this.marks(count);
			}
			/** `range` for a body that ends at a line break or the end of the text, where native runs stop. */
			lines(text, start, end) {
				const ordinary = this.ordinary;
				let masked = "";
				let count = 0;
				let index = start;
				while (index < end) {
					ordinary.lastIndex = index;
					ordinary.test(text);
					const stop = Math.min(ordinary.lastIndex, end);
					count += stop - index;
					if (stop === end) break;
					const code = text.charCodeAt(stop);
					index = stop + 1;
					if (code === 10 || code === 13) {
						masked += this.marksThen(count, code);
						count = 0;
						continue;
					}
					if (code <= 56319 && index < end) {
						const next = text.charCodeAt(index);
						if (next >= 56320 && next <= 57343) index++;
					}
					count++;
				}
				return masked + this.marks(count);
			}
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-secret-mask/src/client/SecretText.module.css.mjs
		const css = ".lpJacW_secret{box-sizing:border-box;max-width:100%;font-family:var(--ds-font-family-code);align-items:center;margin:0 2px;font-size:.875em;display:inline-flex}.lpJacW_value{overflow-wrap:anywhere;min-width:0}.lpJacW_mask{-webkit-text-fill-color:transparent;background-color:currentColor;-webkit-mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 20'%3E%3Cpath d='M6 5.6v8.8M2.19 7.8l7.62 4.4M2.19 12.2l7.62-4.4' stroke='%23000' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\") 0/1ch 100% repeat-x;mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 20'%3E%3Cpath d='M6 5.6v8.8M2.19 7.8l7.62 4.4M2.19 12.2l7.62-4.4' stroke='%23000' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\") 0/1ch 100% repeat-x}.lpJacW_mask,.lpJacW_toggle{position:relative;top:-.125em}.lpJacW_toggle{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;flex:none;align-items:center;padding:0;display:inline-flex}.lpJacW_toggle:hover{color:var(--dsw-alias-label-primary)}.lpJacW_toggle:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px;border-radius:var(--dsw-radius-xs)}.lpJacW_icon{width:1em;height:1em}";
		const tagId = "@deepseek-ai/dsh-client-ui-secret-mask/SecretText.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-secret-mask";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SecretText_module_css_default = {
			"icon": "lpJacW_icon",
			"mask": "lpJacW_mask",
			"secret": "lpJacW_secret",
			"toggle": "lpJacW_toggle",
			"value": "lpJacW_value"
		};
		//#endregion
		//#region lib/types/client/SecretText.js
		/** Masked credential presentation with a per-value reveal control in interactive text. */
		const EYE_CONTOUR = "M1.5 8C2.9 5.25 5.25 3.5 8 3.5C10.75 3.5 13.1 5.25 14.5 8C13.1 10.75 10.75 12.5 8 12.5C5.25 12.5 2.9 10.75 1.5 8Z";
		const EYE_PATH = `${EYE_CONTOUR}M10 8C10 9.1 9.1 10 8 10C6.9 10 6 9.1 6 8C6 6.9 6.9 6 8 6C9.1 6 10 6.9 10 8Z`;
		/** The struck-through glyph drops the pupil so it stays distinct at text size. */
		const EYE_OFF_PATH = `${EYE_CONTOUR}M2.5 2.5L13.5 13.5`;
		const MASK_RUNS = new RegExp(`(\\*+)`, "u");
		function EyeGlyph({ path }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				className: SecretText_module_css_default.icon,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinecap: "round",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)("path", { d: path })
			});
		}
		/**
		* Split the masked form into kept text and mask runs. Mask runs keep their
		* characters for copying and assistive technology but draw centered marks,
		* because a font's own asterisk sits near the cap height.
		*/
		function MaskedText({ masked }) {
			let offset = 0;
			return masked.split(MASK_RUNS).map((part) => {
				const key = offset;
				offset += part.length;
				if (part === "") return null;
				return part.startsWith("*") ? (0, react_jsx_runtime.jsx)("span", {
					className: SecretText_module_css_default.mask,
					children: part
				}, key) : (0, react_jsx_runtime.jsx)("span", { children: part }, key);
			});
		}
		/**
		* Draw one credential masked; interactive text adds a control that reveals or hides this value.
		* Every mount, and every different original value at the same position, starts masked.
		* @param props - masked node, original spelling, interaction mode, and locale seat.
		* @returns an inline masked run with an optional reveal control.
		*/
		function SecretText({ node, raw, interactive, t }) {
			const [revealedRaw, setRevealedRaw] = (0, react.useState)();
			const revealed = interactive && revealedRaw === raw;
			return (0, react_jsx_runtime.jsxs)("span", {
				className: SecretText_module_css_default.secret,
				"data-secret": "",
				children: [(0, react_jsx_runtime.jsx)("span", {
					className: SecretText_module_css_default.value,
					children: revealed ? raw : (0, react_jsx_runtime.jsx)(MaskedText, { masked: node.data.masked })
				}), interactive && (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: SecretText_module_css_default.toggle,
					"aria-pressed": revealed,
					"aria-label": t(revealed ? "secret.hide" : "secret.reveal"),
					onClick: () => {
						setRevealedRaw(revealed ? void 0 : raw);
					},
					children: (0, react_jsx_runtime.jsx)(EyeGlyph, { path: revealed ? EYE_OFF_PATH : EYE_PATH })
				})]
			});
		}
		//#endregion
		//#region lib/types/client/credential-scanner.js
		const KEY_SLOTS = 0;
		const KEY_NEXT = 8;
		const ALNUM_SLOT = 9;
		const WORD_SLOT = 11;
		const ALNUM_DASH_SLOT = 13;
		const UPPER_ALNUM_SLOT = 15;
		const USER_SLOT = 17;
		const PASSWORD_SLOT = 19;
		const DIGIT_FROM = 21;
		const DIGIT_AT = 22;
		const BLOCK_FROM = 23;
		const BLOCK_END_START = 24;
		const BLOCK_END = 25;
		/** Start of the password that the last address check accepted. */
		const CANDIDATE_START = 26;
		const MEMO_SIZE = 27;
		/** `\s` above ASCII. */
		function isWideSpace(code) {
			return code === 160 || code === 5760 || code >= 8192 && code <= 8202 || code === 8232 || code === 8233 || code === 8239 || code === 8287 || code === 12288 || code === 65279;
		}
		/** Offset after the run that sticky `pattern` matches at `start`. */
		function runEnd(pattern, text, start) {
			pattern.lastIndex = start;
			pattern.test(text);
			return pattern.lastIndex;
		}
		/**
		* One matcher's scanning state: the tables, its own patterns, and a memo of the
		* last queried text, which it keeps until a query for another text. Queries are
		* synchronous and never re-enter, so the patterns' cursors are never shared.
		*/
		var CredentialScanner = class {
			classes;
			literals;
			literalLength;
			literalKind;
			literalShape;
			literalMin;
			literalMax;
			literalOverlap;
			ending;
			sharedEndings;
			/** Memo slot of each prefixed format's run class; 0 for `[A-Za-z0-9_-]`, which has four. */
			literalSlot;
			literalPattern;
			prefixes;
			keyRun = /[A-Za-z0-9_-]*/y;
			userRun = /[^\s/:@?#]*/y;
			passwordRun = /[^\s/@?#]*/y;
			nonDigits = /\D*/y;
			masks = new CredentialMasks();
			memo = new Int32Array(MEMO_SIZE).fill(-1);
			text = "";
			constructor(tables) {
				this.classes = tables.classes;
				this.literals = tables.literals;
				this.literalLength = tables.literalLength;
				this.literalKind = tables.literalKind;
				this.literalShape = tables.literalShape;
				this.literalMin = tables.literalMin;
				this.literalMax = tables.literalMax;
				this.literalOverlap = tables.literalOverlap;
				this.ending = tables.ending;
				this.sharedEndings = tables.sharedEndings;
				this.prefixes = new RegExp(tables.prefixSource, "g");
				const patterns = new Map([
					[2, [ALNUM_SLOT, /[A-Za-z0-9]*/y]],
					[4, [WORD_SLOT, /\w*/y]],
					[8, [ALNUM_DASH_SLOT, /[A-Za-z0-9-]*/y]],
					[16, [UPPER_ALNUM_SLOT, /[A-Z0-9]*/y]]
				]);
				this.literalSlot = Uint8Array.from(tables.literalRun, (run) => patterns.get(run)?.[0] ?? 0);
				this.literalPattern = Array.from(tables.literalRun, (run) => patterns.get(run)?.[1] ?? this.keyRun);
			}
			/**
			* The nearest credential at or after `from`. Overlapping candidates of any format join the earliest
			* one and take its mask, so no credential is drawn half masked. Candidates arrive in start order;
			* an address password waits until the scan passes its start, and no other `://` can occur before
			* then, because a user name and a password exclude `/`. A password that starts inside a range also
			* ends inside it: the range holds the `:` before the password, so it is a key block, whose `END`
			* line has spaces, or one that runs to the end of the text.
			* @param text - the complete original text.
			* @param from - the query offset.
			* @returns the `secret` node, or undefined when no credential starts at or after `from`.
			*/
			match(text, from) {
				if (text !== this.text) {
					this.memo.fill(-1);
					this.text = text;
				}
				const prefixes = this.prefixes;
				const length = text.length;
				let start = -1;
				let end = -1;
				let kind = 2;
				let plain = true;
				let deferredEnd = this.addressBefore(from);
				let deferredStart = deferredEnd < 0 ? -1 : this.slot(CANDIDATE_START);
				prefixes.lastIndex = from;
				while (prefixes.test(text)) {
					const literalEnd = prefixes.lastIndex;
					const literal = this.literalEndingAt(literalEnd);
					const at = literalEnd - this.literalLength[literal];
					prefixes.lastIndex = literalEnd - this.literalOverlap[literal];
					if (deferredStart >= 0 && deferredStart <= at) {
						if (start < 0) {
							start = deferredStart;
							end = deferredEnd;
							kind = 1;
						} else if (deferredStart >= end) break;
						deferredStart = -1;
					}
					if (start >= 0 && (at >= end || end === length)) break;
					const literalKind = this.literalKind[literal];
					if (literalKind === 1) {
						deferredEnd = this.addressPassword(at);
						deferredStart = deferredEnd < 0 ? -1 : this.slot(CANDIDATE_START);
						continue;
					}
					const candidateEnd = literalKind === 0 ? this.keyBlockEnd(at) : this.prefixedEnd(literal, at);
					if (candidateEnd < 0) continue;
					if (start < 0) {
						start = at;
						end = candidateEnd;
						kind = literalKind;
						plain = literalKind === 2;
					} else if (candidateEnd > end) {
						end = candidateEnd;
						if (literalKind !== 2) plain = false;
					}
				}
				if (start < 0 && deferredStart >= 0) {
					start = deferredStart;
					end = deferredEnd;
					kind = 1;
				}
				if (start < 0) return void 0;
				return {
					id: "secret",
					start,
					end,
					data: { masked: this.masks.masked(text, kind, plain, start, end) }
				};
			}
			/** Memo entry at `index`; the layout keeps every index inside the array. */
			slot(index) {
				return this.memo[index];
			}
			/** `\w` at `index`; out of range is not a word character. */
			isWordAt(index) {
				const code = this.text.charCodeAt(index);
				return code < 128 && (this.classes[code] & 4) !== 0;
			}
			/** `[^\s/:@?#]` for one UTF-16 code unit; NaN, read out of range, is not one. */
			isUserCode(code) {
export {};
