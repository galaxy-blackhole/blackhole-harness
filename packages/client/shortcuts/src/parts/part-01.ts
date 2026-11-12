/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-shortcuts",
	factory: (require) => {
		var module = { exports: {} };
		module.exports;
		let _deepseek_ai_cordis = require("@deepseek-ai/cordis");
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		//#region lib/types/binding.js
		const keyNames = {
			Slash: "/",
			Comma: ",",
			Period: ".",
			Backslash: "\\",
			Backquote: "`",
			Minus: "-",
			Equal: "=",
			BracketLeft: "[",
			BracketRight: "]",
			Semicolon: ";",
			Quote: "'",
			Enter: "Enter",
			Escape: "Esc",
			Space: "Space",
			Tab: "Tab",
			Backspace: "Backspace",
			Delete: "Delete",
			ArrowUp: "↑",
			ArrowDown: "↓",
			ArrowLeft: "←",
			ArrowRight: "→"
		};
		const modifierOrder = [
			"control",
			"alt",
			"shift",
			"meta"
		];
		/**
		* Expand logical modifiers, deduplicate, and validate the physical code.
		* @param binding - declared binding.
		* @param platform - receiving device platform.
		* @returns canonical binding; unsupported codes throw during registration.
		*/
		function normalizeBinding(binding, platform) {
			const codes = [binding.code, ...binding.secondCode === void 0 ? [] : [binding.secondCode]];
			codes.sort();
			for (const code of codes) if (!/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4]))$/u.test(code) && !Object.hasOwn(keyNames, code)) throw new Error(`Unsupported shortcut code: ${code}`);
			if (codes.length === 2 && codes[0] === codes[1]) throw new Error("Shortcut keys must be distinct");
			const modifiers = new Set(binding.modifiers.map((value) => value === "primary" ? platform === "macos" ? "meta" : "control" : value));
			return {
				code: codes[0],
				...codes[1] === void 0 ? {} : { secondCode: codes[1] },
				modifiers: modifierOrder.filter((value) => modifiers.has(value))
			};
		}
		/**
		* Produce an exact-match index from a normalized binding.
		* @param binding - normalized physical key and modifiers.
		* @returns stable index used for both matching and conflict checks.
		*/
		function bindingKey(binding) {
			const codes = binding.secondCode === void 0 ? [binding.code] : [binding.code, binding.secondCode].sort();
			return [...binding.modifiers, ...codes].join("+");
		}
		/**
		* Format keycaps and ARIA; Windows separates modifiers with plus signs, while chord keys remain adjacent.
		* @param binding - normalized binding, or null for an unbound command.
		* @param platform - receiving device platform.
		* @returns visible keycaps; two-key chords omit ARIA shortcuts, which only support one non-modifier key.
		*/
		function presentBinding(binding, platform) {
			if (binding === null) return {
				keys: [],
				aria: void 0
			};
			const key = keyNames[binding.code] ?? binding.code.replace(/^(Key|Digit)/u, "");
			const symbols = platform === "macos" ? {
				control: "⌃",
				alt: "⌥",
				shift: "⇧",
				meta: "⌘"
			} : {
				control: "Ctrl",
				alt: "Alt",
				shift: "Shift",
				meta: "Meta"
			};
			const ariaNames = {
				control: "Control",
				alt: "Alt",
				shift: "Shift",
				meta: "Meta"
			};
			const ariaKey = binding.code === "Space" ? "Space" : binding.code === "Escape" ? "Escape" : binding.code.startsWith("Arrow") ? binding.code : key;
			const second = binding.secondCode === void 0 ? [] : [keyNames[binding.secondCode] ?? binding.secondCode.replace(/^(Key|Digit)/u, "")];
			const keys = [...binding.modifiers.map((value) => symbols[value]), key];
			return {
				keys: [...platform === "windows" ? keys.flatMap((label, index) => index === 0 ? [label] : ["+", label]) : keys, ...second],
				aria: binding.secondCode === void 0 ? [...binding.modifiers.map((value) => ariaNames[value]), ariaKey].join("+") : void 0
			};
		}
		/**
		* Check Web combinations: Windows and macOS also admit any three or four modifiers; Linux retains the limited set.
		* @param binding - normalized candidate.
		* @param platform - receiving device platform.
		* @returns whether this combination is admitted; admission does not guarantee browser or system delivery.
		*/
		function isWebBindingAllowed(binding, platform) {
			if (binding.secondCode !== void 0) return false;
			if (platform === "windows" || platform === "macos") {
				if (binding.modifiers.length >= 3) return true;
				const primary = platform === "macos" ? "meta" : "control";
				if (binding.modifiers.length === 1 && (["Comma", "Backslash"].includes(binding.code) && binding.modifiers[0] === primary || binding.code === "Backquote" && binding.modifiers[0] === "control")) return true;
				if (binding.modifiers.length === 2 && binding.modifiers.includes(primary) && (binding.modifiers.includes("alt") || binding.modifiers.includes("shift"))) return true;
			}
			return [
				{
					code: "Slash",
					modifiers: ["primary"]
				},
				{
					code: "Comma",
					modifiers: ["primary", "shift"]
				},
				{
					code: "Period",
					modifiers: ["primary", "shift"]
				}
			].some((candidate) => bindingKey(binding) === bindingKey(normalizeBinding(candidate, platform)));
		}
		//#endregion
		//#region ../../util/values/lib/index.js
		/**
		* Lazily scanned view of one JSON object's top-level fields, built from text
		* that may still be streaming or from an already parsed object. Nothing is
		* scanned until a reader asks; the view remembers every question it answered
		* and reports changed answers when the owner refreshes for publication.
		* Used for model tool-call arguments: a row reads the fields it
		* cares about at whatever granularity it displays, at every stage of the call.
		* @module @deepseek-ai/dsh-util-values/src/partial-json
		*/
		const SIMPLE_ESCAPES = {
			"\"": "\"",
			"\\": "\\",
			"/": "/",
			b: "\b",
			f: "\f",
			n: "\n",
			r: "\r",
			t: "	"
		};
		const CONTENT_ESCAPE = /[\\\u0000-\u001f]/u;
		function isWhitespace(c) {
			return c === " " || c === "\n" || c === "\r" || c === "	";
		}
		function isHex(c) {
			return c >= "0" && c <= "9" || c >= "a" && c <= "f" || c >= "A" && c <= "F";
		}
		(class PartialArguments {
			/** The view of a call with no arguments available. */
			static EMPTY = PartialArguments.fromObject({});
			/**
			* View finished argument text without scanning it until a reader asks.
			* @param text - the complete argument JSON text.
			* @returns a sealed view.
			*/
			static fromText(text) {
				const view = new PartialArguments();
				view.append(text);
				view.sealed = true;
				return view;
			}
			/**
			* View an already parsed argument payload, such as a PTC dispatch object.
			* @param value - the parsed argument value.
			* @returns a sealed view; a non-object payload has no fields.
			*/
			static fromObject(value) {
				const view = new PartialArguments();
				view.object = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
				view.sealed = true;
				return view;
			}
			/**
			* The source: text so far or a parsed object, plus whether it can still grow.
			* These are the only enumerable fields, so two views over the same source
			* compare equal structurally however far each has been read.
			*/
			chunks = [];
			object;
			sealed = false;
			#ends = [];
			#size = 0;
			#consumed = 0;
			#mode = "root";
			#escape = false;
			#keyStart = 0;
			#keyEscaped = false;
			#key = "";
			#current = null;
			#nestedEnds = [];
			#nestedInString = false;
			#invalidAt;
			#invalidValue = false;
			#entries = /* @__PURE__ */ new Map();
			#order = [];
			#reads = /* @__PURE__ */ new Map();
			/** Whether this view rejects further appends; does not scan text or register reads. */
			get isSealed() {
				return this.sealed;
			}
			/** Whether indexing or a content read found invalid JSON; unread value contents are not validated. */
			get invalid() {
				this.scan();
				return this.#mode === "invalid" || this.#invalidValue;
			}
			/**
			* Retain streamed argument text without scanning or comparing observed answers.
			* @param fragment - the text following every fragment appended before.
			*/
			append(fragment) {
				if (this.sealed) throw new Error("PartialArguments: cannot append to a sealed view");
				if (fragment.length === 0) return;
				this.chunks.push(fragment);
				this.#size += fragment.length;
				this.#ends.push(this.#size);
			}
			/**
			* Reconcile a streamed prefix with authoritative complete text without joining the fragments.
			* @param text - the final argument text, which replaces missing or conflicting deltas.
			* @returns this view sealed with its caches retained when every character matches; otherwise a new sealed view.
			*/
			settle(text) {
				if (this.object !== void 0 || text.length !== this.#size) return PartialArguments.fromText(text);
				let offset = 0;
				for (const chunk of this.chunks) {
					if (!text.startsWith(chunk, offset)) return PartialArguments.fromText(text);
					offset += chunk.length;
				}
				this.chunks = text.length === 0 ? [] : [text];
				this.#ends = text.length === 0 ? [] : [text.length];
				this.sealed = true;
				return this;
			}
			/**
			* Compare observed answers and advance their publication baseline. Unread views remain unscanned.
			* @returns whether any observed answer changed since its first read or the preceding refresh.
			*/
			refresh() {
				if (this.#reads.size === 0) return false;
				this.scan();
				let changed = false;
				let completions = false;
				for (const read of this.#reads.values()) {
					if (read.completion) {
						completions = true;
						continue;
					}
					changed = this.refreshRead(read) || changed;
				}
				if (completions) {
					for (const read of this.#reads.values()) if (read.completion) changed = this.refreshRead(read) || changed;
				}
				if (this.sealed) this.#reads.clear();
				return changed;
			}
			refreshRead(read) {
				const now = read.answer();
				if (Object.is(now, read.last)) return false;
				read.last = now;
				return true;
			}
			/**
			* Check whether no further fields can arrive.
			* @returns whether the outer object closed, indexing failed, or the view is sealed; unread values are not validated.
			*/
			closed() {
				return this.remember("closed", "", () => this.closedNow());
			}
			/**
			* List discovered fields in first-appearance order.
			* @returns top-level keys seen so far, in first-appearance order.
			*/
			keys() {
				return this.remember("keys", "", () => this.keysNow(), (keys) => keys.length);
			}
			/**
			* Check whether a top-level field has appeared.
			* @param key - argument name.
			* @returns whether the field has appeared (a string opened or another value began).
			*/
			has(key) {
				return this.remember("has", key, () => this.hasNow(key));
			}
			/**
			* Check whether a field's closing delimiter has arrived, without validating its contents.
			* @param key - argument name.
			* @returns whether its delimiter arrived and no content reader has reported an error for this value.
			*/
			complete(key) {
				return this.remember("complete", key, () => this.completeNow(key));
			}
			/**
			* Read string length without materializing its text.
			* @param key - argument name.
			* @param options - change granularity for a streaming string.
			* @returns decoded UTF-16 length of the string field so far; undefined when absent or not a string.
			*/
			stringLength(key, options) {
				const step = Math.max(1, Math.floor(options?.step ?? 1));
				const offset = options?.offset ?? 0;
				return this.remember(`length:${step}:${offset}`, key, () => this.lengthNow(key), (length) => length === void 0 ? void 0 : Math.ceil((length + offset) / step));
			}
			/**
			* Check a string against a decoded UTF-16 length limit without materializing it.
			* @param key - argument name.
			* @param maxLength - decoded UTF-16 limit, floored to at least zero.
			* @returns whether the string is longer than the limit; false when absent or not a string.
			*/
			stringExceeds(key, maxLength) {
				const limit = Math.max(0, Math.floor(maxLength));
				return this.remember(`exceeds:${limit}`, key, () => (this.lengthNow(key, limit + 1) ?? 0) > limit);
			}
			/**
			* Read a decoded string, including a streaming prefix.
			* @param key - argument name.
			* @returns the string field's decoded text so far; undefined when absent or not a string.
			*/
			text(key) {
				return this.remember("text", key, () => this.textNow(key));
			}
			/**
			* Read at most the first decoded UTF-16 units of a string.
			* @param key - argument name.
			* @param maxLength - maximum decoded UTF-16 length, floored to at least one.
			* @returns the bounded string prefix; undefined when absent or not a string.
			*/
			textPrefix(key, maxLength) {
				const limit = Math.max(1, Math.floor(maxLength));
				return this.remember(`prefix:${limit}`, key, () => this.textPrefixNow(key, limit));
			}
			/**
			* Read a completed non-string argument.
			* @param key - argument name.
			* @returns the parsed non-string value once it closed; undefined while open, absent, or a string.
			*/
			value(key) {
				return this.remember("value", key, () => this.valueNow(key));
			}
			/** Answer a question and, on a streaming view, remember it for change detection. */
			remember(kind, key, read, comparison) {
				this.scan();
				const result = read();
				if (!this.sealed) {
					const id = `${kind}/${key}`;
					if (!this.#reads.has(id)) this.#reads.set(id, {
						completion: kind === "complete",
						answer: comparison === void 0 ? read : () => comparison(read()),
						last: comparison === void 0 ? result : comparison(result)
					});
				}
				return result;
			}
			closedNow() {
				return this.sealed || this.#mode === "closed" || this.#mode === "invalid";
			}
			keysNow() {
				return this.object === void 0 ? this.#order : Object.keys(this.object);
			}
			hasNow(key) {
				return this.object === void 0 ? this.#entries.has(key) : Object.hasOwn(this.object, key);
			}
			completeNow(key) {
				if (this.object !== void 0) return Object.hasOwn(this.object, key);
				const entry = this.#entries.get(key);
				return entry !== void 0 && entry.end >= 0 && (entry.kind === "string" ? entry.invalidAt === void 0 : !entry.invalid);
			}
			lengthNow(key, limit = Number.POSITIVE_INFINITY) {
				if (this.object !== void 0) {
					const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
					return typeof field === "string" ? field.length : void 0;
				}
				const entry = this.#entries.get(key);
				if (entry?.kind !== "string") return void 0;
				if (entry.text !== void 0 && entry.text.at === entry.end) return entry.text.length;
				const read = entry.length ??= {
					at: entry.start,
					length: 0,
					text: ""
				};
				this.readString(entry, read, limit, false);
				return read.length;
			}
			textNow(key) {
				if (this.object !== void 0) {
					const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
					return typeof field === "string" ? field : void 0;
				}
				const entry = this.#entries.get(key);
export {};
