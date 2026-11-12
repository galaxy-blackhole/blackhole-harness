/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-workspace",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		let _deepseek_ai_cordis = require("@deepseek-ai/cordis");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region lib/types/client/contract/slots.js
		/**
		* Bind the row's render occurrence into the entries' `useMenuOpenState` hook:
		* the owner supplies its open-state pair as the occurrence's `hookContext`,
		* and the hook hands that pair back.
		* @param _standard - framework standard props (unused).
		* @param state - the menu's open-state pair from the render occurrence.
		* @returns the hook the entry calls.
		*/
		const menuOpenStateFactory = (_standard, state) => () => state;
		//#endregion
		//#region lib/types/client/shortcuts.js
		/**
		* Create the private browser request source shared by commands and controls.
		* @returns observable state and its complete mutation callbacks.
		*/
		function createWorkspaceShortcutControls() {
			const state = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				searchRequest: 0,
				addRequested: false,
				directoryBusy: false,
				renameTarget: null
			});
			return {
				state,
				search: () => {
					state.set({
						...state.getSnapshot(),
						searchRequest: state.getSnapshot().searchRequest + 1
					});
				},
				add: () => {
					state.set(state.getSnapshot().directoryBusy ? state.getSnapshot() : {
						...state.getSnapshot(),
						addRequested: true
					});
				},
				closeAdd: () => {
					state.set({
						...state.getSnapshot(),
						addRequested: false
					});
				},
				directoryBusy: (busy) => {
					state.set({
						...state.getSnapshot(),
						directoryBusy: busy
					});
				},
				rename: (sessionId, currentTitle) => {
					state.set({
						...state.getSnapshot(),
						renameTarget: {
							sessionId,
							currentTitle
						}
					});
				},
				closeRename: () => {
					state.set({
						...state.getSnapshot(),
						renameTarget: null
					});
				}
			};
		}
		/**
		* Register navigation commands against the existing workspace owner.
		* Rename requires a nonblank main Conversation with no modal obscuring it.
		* @param ctx - plugin context with the shortcut, locale, and model services.
		* @param navigation - session creation and forking from the pointer controls' navigation service.
		* @param controls - browser-owned opening requests.
		* @param archiveSession - shared archive action, including running-work confirmation and notices.
		* @param reportForkFailure - publish a classified failure through the frame-wide notice channel.
		*/
		function installWorkspaceShortcuts(ctx, navigation, controls, archiveSession, reportForkFailure) {
			const t = ctx.locale.bind("workspace");
			const current = () => Object.values(ctx.sessions.list.getSnapshot().byId).find((row) => (row.retainedBy.mainView ?? 0) > 0);
			const addReason = () => ctx.slots.entries("sidebar.workspaces.directoryFlow").length === 0 ? t("shortcut.noPicker") : controls.state.getSnapshot().directoryBusy ? t("shortcut.directoryBusy") : null;
			const register = (id, label, aliases, code, modifiers, webModifiers, resolve) => {
				ctx.effect(() => ctx.shortcuts.register({
					id,
					label,
					aliases,
					defaults: {
						"desktop:macos": {
							code,
							modifiers
						},
						"desktop:windows": {
							code,
							modifiers
						},
						"desktop:linux": {
							code,
							modifiers
						},
						"web:macos": {
							code,
							modifiers: webModifiers
						},
						"web:windows": {
							code,
							modifiers: webModifiers
						}
					},
					regions: ["page", "editable"],
					modals: [],
					resolve
				}), `ui-workspace: ${id}`);
			};
			register("session.new", () => t("session.new"), ["new session", "new chat"], "KeyN", ["primary"], ["primary", "alt"], () => ({
				status: "handled",
				run: () => {
					navigation.startSession();
				}
			}));
			register("session.search", () => t("search.sessions.aria"), ["search sessions"], "KeyK", ["primary"], ["primary", "alt"], () => ({
				status: "handled",
				run: controls.search
			}));
			register("workspace.add", () => t("workspace.add"), ["add workspace", "open folder"], "KeyO", ["primary"], ["primary", "alt"], () => {
				const reason = addReason();
				return reason === null ? {
					status: "handled",
					run: controls.add
				} : {
					status: "blocked",
					reason
				};
			});
			register("session.rename", () => t("rename.session.title"), ["rename session"], "KeyG", ["primary", "alt"], ["primary", "alt"], (context) => {
				const target = current();
				return target === void 0 || target.blank || context.modal !== null || ctx.layout.panelInfo.getSnapshot().activePanelId !== null ? {
					status: "blocked",
					reason: t("shortcut.noSession")
				} : {
					status: "handled",
					run: () => {
						controls.rename(target.id, target.title?.trim() ?? "");
					}
				};
			});
			register("session.fork", () => t("menu.fork"), ["fork session"], "KeyF", ["primary", "alt"], ["primary", "shift"], () => {
				const target = current();
				if (target === void 0) return {
					status: "blocked",
					reason: t("shortcut.noSession")
				};
				if (target.blank) return {
					status: "blocked",
					reason: t("shortcut.noCompletedTurn")
				};
				return {
					status: "handled",
					run: () => {
						navigation.forkSession(target.id).catch((error) => {
							const unavailable = error instanceof Error && error.name === "SessionForkError" && error.rpcError.code === "session/fork-unavailable";
							reportForkFailure(unavailable ? "unavailable" : "failed");
							if (!unavailable) console.warn("session fork rejected:", error);
						});
					}
				};
			});
			register("session.archive", () => t("menu.archiveSession"), ["archive session"], "KeyA", ["primary", "shift"], ["primary", "alt"], () => {
				const target = current();
				return target === void 0 ? {
					status: "blocked",
					reason: t("shortcut.noSession")
				} : {
					status: "handled",
					run: () => {
						archiveSession(target.id);
					}
				};
			});
		}
		//#endregion
		//#region ../../util/values/src/partial-json.ts
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
export {};
