/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				return code < 128 ? (this.classes[code] & 256) !== 0 : code === code && !isWideSpace(code);
			}
			/** Index of the literal the prefix scan matched ending at `end`; one literal sharing the ending matches, so the last needs no check. */
			literalEndingAt(end) {
				const text = this.text;
				const key = text.charCodeAt(end - 2) * 128 + text.charCodeAt(end - 1);
				const literal = this.ending[key];
				if (literal > 0) return literal - 1;
				const shared = this.sharedEndings[key];
				let index = 0;
				for (; index < shared.length - 1; index++) {
					const candidate = shared[index];
					if (text.startsWith(this.literals[candidate], end - this.literalLength[candidate])) break;
				}
				return shared[index];
			}
			/** End of the `[A-Za-z0-9_-]*` run at `start`, through four memo pairs replaced in turn. */
			keyRunEnd(start) {
				for (let slot = KEY_SLOTS; slot < KEY_NEXT; slot += 2) if (this.slot(slot) <= start && start <= this.slot(slot + 1)) return this.slot(slot + 1);
				const end = runEnd(this.keyRun, this.text, start);
				const next = this.slot(KEY_NEXT) + 1 & 3;
				this.memo[KEY_NEXT] = next;
				this.memo[KEY_SLOTS + 2 * next] = start;
				this.memo[KEY_SLOTS + 2 * next + 1] = end;
				return end;
			}
			/** End of the run `pattern` matches at `start`, through the memo pair at `slot`. */
			memoRunEnd(pattern, start, slot) {
				if (this.slot(slot) <= start && start <= this.slot(slot + 1)) return this.slot(slot + 1);
				const end = runEnd(pattern, this.text, start);
				this.memo[slot] = start;
				this.memo[slot + 1] = end;
				return end;
			}
			/** Offset of the first digit at or after `start`, or the text length. */
			nextDigit(start) {
				if (this.slot(DIGIT_FROM) <= start && start <= this.slot(DIGIT_AT)) return this.slot(DIGIT_AT);
				this.memo[DIGIT_FROM] = start;
				this.memo[DIGIT_AT] = runEnd(this.nonDigits, this.text, start);
				return this.slot(DIGIT_AT);
			}
			/** Offset after `[A-Z0-9 ]{0,40}PRIVATE KEY-----` at `start`, or -1; reads at most 52 characters. */
			labelEnd(start) {
				const text = this.text;
				const limit = Math.min(text.length, start + 52);
				let index = start;
				while (index < limit) {
					const code = text.charCodeAt(index);
					if (code > 127 || (this.classes[code] & 32) === 0) break;
					index++;
				}
				const tail = index - 11;
				return index < start + 52 && tail >= start && text.startsWith("PRIVATE KEY-----", tail) ? tail + 16 : -1;
			}
			/**
			* End of the `-----BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY-----` block at `at`: after its first complete
			* `END` line, or the end of the text; -1 for an invalid header.
			*/
			keyBlockEnd(at) {
				const header = this.labelEnd(at + 11);
				if (header < 0) return -1;
				if (this.slot(BLOCK_FROM) <= header && header <= this.slot(BLOCK_END_START)) return this.slot(BLOCK_END);
				const text = this.text;
				this.memo[BLOCK_FROM] = header;
				this.memo[BLOCK_END_START] = text.length;
				this.memo[BLOCK_END] = text.length;
				for (let line = text.indexOf("-----END ", header); line >= 0; line = text.indexOf("-----END ", line + 1)) {
					const end = this.labelEnd(line + 9);
					if (end < 0) continue;
					this.memo[BLOCK_END_START] = line;
					this.memo[BLOCK_END] = end;
					break;
				}
				return this.slot(BLOCK_END);
			}
			/** Whether `\b[a-z][a-z0-9+.-]{1,15}` ends at `at`; reads at most 17 characters back. */
			schemeBefore(at) {
				const text = this.text;
				for (let start = at - 1; start >= 0 && start >= at - 16; start--) {
					const code = text.charCodeAt(start);
					const bits = code < 128 ? this.classes[code] : 0;
					if ((bits & 64) === 0) return false;
					if ((bits & 128) !== 0 && at - start >= 2 && !this.isWordAt(start - 1)) return true;
				}
				return false;
			}
			/**
			* The password in `\b[a-z][a-z0-9+.-]{1,15}://[^\s/:@?#]{0,256}:[^\s/@?#]+@` for the `://` at
			* `at`; neither part crosses `?` or `#`, where the authority ends. Callers pass a `://` at or after
			* the query offset, or one whose user name reaches it, so the password never starts before it.
			* @returns the password end with its start in the memo, or -1.
			*/
			addressPassword(at) {
				if (!this.schemeBefore(at)) return -1;
				const text = this.text;
				const userStart = at + 3;
				const userEnd = this.memoRunEnd(this.userRun, userStart, USER_SLOT);
				if (userEnd - userStart > 256 || text.charCodeAt(userEnd) !== 58) return -1;
				const start = userEnd + 1;
				const end = this.memoRunEnd(this.passwordRun, start, PASSWORD_SLOT);
				if (end === start || text.charCodeAt(end) !== 64) return -1;
				this.memo[CANDIDATE_START] = start;
				return end;
			}
			/**
			* The address password at or after `from` whose `://` starts before `from`, as `addressPassword`
			* returns it. The walk back over the user name runs only when a `:`, a password, and `@` follow.
			*/
			addressBefore(from) {
				const text = this.text;
				if (from < 3) return -1;
				if (text.startsWith("://", from - 1)) return this.addressPassword(from - 1);
				if (text.startsWith("://", from - 2)) return this.addressPassword(from - 2);
				let index = from - 1;
				const before = text.charCodeAt(index);
				let passwordStart;
				if (before === 58) {
					passwordStart = from;
					index--;
				} else if (this.isUserCode(before)) {
					const userEnd = this.memoRunEnd(this.userRun, from, USER_SLOT);
					if (text.charCodeAt(userEnd) !== 58) return -1;
					passwordStart = userEnd + 1;
				} else return text.startsWith("://", from - 3) ? this.addressPassword(from - 3) : -1;
				const passwordEnd = this.memoRunEnd(this.passwordRun, passwordStart, PASSWORD_SLOT);
				if (passwordEnd === passwordStart || text.charCodeAt(passwordEnd) !== 64) return -1;
				const lowest = Math.max(0, passwordStart - 258);
				while (index >= lowest && this.isUserCode(text.charCodeAt(index))) index--;
				return index >= 2 && text.startsWith("://", index - 2) ? this.addressPassword(index - 2) : -1;
			}
			/** End of the prefixed credential whose literal starts at `at`, or -1. */
			prefixedEnd(literal, at) {
				if (this.isWordAt(at - 1)) return -1;
				const text = this.text;
				const start = at + this.literalLength[literal];
				const shape = this.literalShape[literal];
				const min = this.literalMin[literal];
				if (shape === 2) {
					const digit = this.nextDigit(start);
					if (digit - start > 255) return -1;
					const end = this.keyRunEnd(start);
					return end - start >= min && digit < end ? end : -1;
				}
				const slot = this.literalSlot[literal];
				const end = slot === 0 ? this.keyRunEnd(start) : this.memoRunEnd(this.literalPattern[literal], start, slot);
				const length = end - start;
				if (length < min) return -1;
				if (shape === 0) return end;
				if (shape === 3) return start + min;
				if (shape === 1) return length <= this.literalMax[literal] && !this.isWordAt(end) ? end : -1;
				if (length > this.literalMax[literal] || !text.startsWith(".eyJ", end)) return -1;
				const payloadStart = end + 4;
				const payloadEnd = this.keyRunEnd(payloadStart);
				if (payloadEnd - payloadStart < min || text.charCodeAt(payloadEnd) !== 46) return -1;
				const signatureEnd = this.keyRunEnd(payloadEnd + 1);
				return signatureEnd - (payloadEnd + 1) >= min ? signatureEnd : -1;
			}
		};
		//#endregion
		//#region lib/types/client/format-tables.js
		/** Lookup tables derived from the credential formats, built once on first use. */
		let tables;
		/**
		* The tables for `CREDENTIAL_FORMATS`; the first call builds them.
		* @returns the shared, read-only tables.
		*/
		function formatTables() {
			tables ??= buildTables();
			return tables;
		}
		function buildTables() {
			const formats = CREDENTIAL_FORMATS;
			const literals = formats.map((f) => f.literal);
			const { ending, sharedEndings } = endingTables(literals);
			return {
				classes: charClasses(),
				literals,
				literalLength: Uint8Array.from(literals, (literal) => literal.length),
				literalKind: Uint8Array.from(formats, (f) => f.kind),
				literalShape: Uint8Array.from(formats, (f) => f.shape),
				literalRun: Uint16Array.from(formats, (f) => f.run),
				literalMin: Int32Array.from(formats, (f) => f.min),
				literalMax: Int32Array.from(formats, (f) => f.max),
				literalOverlap: Uint8Array.from(literals, (literal) => overlap(literal, literals)),
				prefixSource: alternation(literals),
				ending,
				sharedEndings
			};
		}
		function charClasses() {
			const classes = new Uint16Array(128);
			for (let code = 0; code < 128; code++) {
				const upper = code >= 65 && code <= 90;
				const lower = code >= 97 && code <= 122;
				const digit = code >= 48 && code <= 57;
				const alnum = upper || lower || digit;
				const authority = !(code >= 9 && code <= 13 || code === 32 || code === 47 || code === 64 || code === 63 || code === 35);
				classes[code] = (alnum || code === 95 || code === 45 ? 1 : 0) | (alnum ? 2 : 0) | (alnum || code === 95 ? 4 : 0) | (alnum || code === 45 ? 8 : 0) | (upper || digit ? 16 : 0) | (upper || digit || code === 32 ? 32 : 0) | (lower || digit || code === 43 || code === 46 || code === 45 ? 64 : 0) | (lower ? 128 : 0) | (authority && code !== 58 ? 256 : 0) | (authority ? 512 : 0);
			}
			return classes;
		}
		function overlap(literal, literals) {
			for (let size = literal.length - 1; size > 0; size--) {
				const suffix = literal.slice(-size);
				if (literals.some((other) => other.startsWith(suffix))) return size;
			}
			return 0;
		}
		function endingTables(literals) {
			const ending = new Int8Array(16384);
			const sharedEndings = [];
			literals.forEach((literal, index) => {
				const key = literal.charCodeAt(literal.length - 2) * 128 + literal.charCodeAt(literal.length - 1);
				const existing = ending[key];
				if (existing === 0) {
					ending[key] = index + 1;
					return;
				}
				if (existing > 0) {
					sharedEndings[key] = [existing - 1];
					ending[key] = -1;
				}
				sharedEndings[key].push(index);
			});
			return {
				ending,
				sharedEndings
			};
		}
		const escape = (literal) => literal.replace(/[.*+?^${}()|[\]\\/]/gu, "\\$&");
		/** Literal alternatives grouped by shared leading characters; groups only factor literals and add no quantifier. */
		function alternation(literals) {
			const groups = /* @__PURE__ */ new Map();
			for (const literal of literals) groups.set(literal.charAt(0), [...groups.get(literal.charAt(0)) ?? [], literal.slice(1)]);
			return [...groups].map(([head, tails]) => tails.length === 1 ? escape(head + tails.join("")) : `${escape(head)}(?:${alternation(tails)})`).join("|");
		}
		//#endregion
		//#region lib/types/client/secret-rule.js
		/**
		* Create the credential matcher. Each instance owns a scanner whose memo holds
		* the last queried text until a query for another text.
		* @returns the `secret` rule; it reads no Facts, so Facts changes never invalidate its queries.
		*/
		function createSecretRule() {
			const scanner = new CredentialScanner(formatTables());
			return {
				id: "secret",
				order: 0,
				match: (text, from) => scanner.match(text, from)
			};
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** `secretMask` dictionaries for the per-credential reveal control. */
		/** Dictionary namespace owned by this plugin. */
		const NS = "secretMask";
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"secret.reveal": "显示密钥",
			"secret.hide": "隐藏密钥"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"secret.reveal": "Show secret",
			"secret.hide": "Hide secret"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Required services: the copy, the node renderer registry, and the UserText rule registry. */
		const inject = [
			"locale",
			"slots",
			"uiConversation"
		];
		/**
		* Register the dictionaries, the credential matcher, and its node renderer.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-secret-mask: dictionaries");
			ctx.uiConversation.userText.register(createSecretRule());
			ctx.slots.inject("conversation.user.text.node", () => ctx.slots.register({
				name: "conversation.user.text.node",
				key: "secret",
				priority: 100,
				locale: NS
			}, SecretText));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
