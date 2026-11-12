/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-deliverables",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		//#region lib/types/changes.js
		/** Authenticated GET route serving one announced change summary while its Session lives. */
		const CHANGED_FILES_PATH = "/api/changes.summary";
		/** Authenticated GET route serving one listed file's turn-start and turn-end comparison while its Session lives. */
		const CHANGES_DIFF_PATH = "/api/changes.diff";
		/** Authenticated POST route for opening a changed file on the Host desktop. */
		const CHANGES_OPEN_PATH = "/api/changes.open";
		/**
		* Browser-relative form of {@link CHANGED_FILES_PATH}; see
		* .agents/notes/implemented/architecture/2026-09-14-web-document-relative-app-routes.md.
		*/
		const CHANGED_FILES_ROUTE = CHANGED_FILES_PATH.slice(1);
		/** Browser-relative form of {@link CHANGES_DIFF_PATH}. */
		const CHANGES_DIFF_ROUTE = CHANGES_DIFF_PATH.slice(1);
		/** Browser-relative form of {@link CHANGES_OPEN_PATH}. */
		const CHANGES_OPEN_ROUTE = CHANGES_OPEN_PATH.slice(1);
		/** Resource-address prefix of a turn's review tab in the right Sidebar. */
		const CHANGES_REVIEW_ADDRESS = "dsh-resource://changes-review/session/";
		function isRecord$1(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/**
		* Validate one changed-file record read from the summary route.
		* @param value - decoded JSON.
		* @returns whether the record carries a path, a display path, and line counts.
		*/
		function isChangedFile(value) {
			if (!isRecord$1(value)) return false;
			const { path, display, added, deleted, binary, oversized } = value;
			return typeof path === "string" && path.length > 0 && typeof display === "string" && display.length > 0 && Number.isSafeInteger(added) && Number.isSafeInteger(deleted) && (binary === void 0 || binary === true) && (oversized === void 0 || oversized === true);
		}
		/**
		* Validate a summary read from the summary route.
		* @param value - decoded JSON.
		* @returns whether the value identifies a turn, a complete file list, the total count, and the line totals.
		*/
		function isChangesSummary(value) {
			if (!isRecord$1(value)) return false;
			const { turn, files, total, added, deleted } = value;
			return Number.isSafeInteger(turn) && turn >= 1 && Number.isSafeInteger(total) && Number.isSafeInteger(added) && Number.isSafeInteger(deleted) && Array.isArray(files) && files.every(isChangedFile);
		}
		function isHunk(value) {
			if (!isRecord$1(value)) return false;
			const { oldStart, oldLines, newStart, newLines, lines } = value;
			return [
				oldStart,
				oldLines,
				newStart,
				newLines
			].every((field) => Number.isSafeInteger(field) && field >= 0) && Array.isArray(lines) && lines.every((line) => typeof line === "string" && /^[+ -]/.test(line));
		}
		/**
		* Validate a comparison read from the comparison route.
		* @param value - decoded JSON.
		* @returns whether the value is a text comparison with well-formed hunks, or a binary or oversized refusal.
		*/
		function isChangesDiff(value) {
			if (!isRecord$1(value)) return false;
			const { kind, path, display } = value;
			if (typeof path !== "string" || path.length === 0 || typeof display !== "string" || display.length === 0) return false;
			if (kind === "binary" || kind === "oversized") return true;
			if (kind !== "text") return false;
			const { before, after, hunks, coarse } = value;
			return typeof before === "boolean" && typeof after === "boolean" && typeof coarse === "boolean" && Array.isArray(hunks) && hunks.every(isHunk);
		}
		/**
		* Validate the `workspace/changes` event data read from a Session log.
		* @param value - decoded durable event data.
		* @returns whether the event names a turn.
		*/
		function isChangesEvent(value) {
			return isRecord$1(value) && Number.isSafeInteger(value.turn) && value.turn >= 1;
		}
		/**
		* Build authenticated coordinates for the summary one `workspace/changes` event announced.
		* @param sessionId - owning Session.
		* @param seq - event sequence.
		* @returns document-relative summary route.
		*/
		function changesSummaryUrl(sessionId, seq) {
			return `${CHANGED_FILES_ROUTE}?${new URLSearchParams({
				sessionId,
				seq: String(seq)
			})}`;
		}
		/**
		* Build authenticated coordinates for one listed file's comparison.
		* @param sessionId - owning Session.
		* @param seq - workspace/changes event sequence.
		* @param index - original index in the summary's files array.
		* @returns document-relative comparison route.
		*/
		function changesDiffUrl(sessionId, seq, index) {
			return `${CHANGES_DIFF_ROUTE}?${new URLSearchParams({
				sessionId,
				seq: String(seq),
				index: String(index)
			})}`;
		}
		/**
		* Build authenticated coordinates for a changed file's native open.
		* @param sessionId - owning Session.
		* @param seq - workspace/changes event sequence.
		* @param index - original index in the summary's files array.
		* @returns document-relative action route.
		*/
		function changedFileUrl(sessionId, seq, index) {
			return `${CHANGES_OPEN_ROUTE}?${new URLSearchParams({
				sessionId,
				seq: String(seq),
				index: String(index)
			})}`;
		}
		/**
		* The right-Sidebar address of one turn's review. The Session and the event
		* sequence identify the content; the turn rides along for the tab title.
		* @param coordinates - viewed Session, announcing event, and turn.
		* @returns a `dsh-resource://changes-review/session/…` address.
		*/
		function changesReviewAddress(coordinates) {
			const { sessionId, seq, turn } = coordinates;
			return `${CHANGES_REVIEW_ADDRESS}${encodeURIComponent(sessionId)}/${seq}/${turn}`;
		}
		/**
		* Read the coordinates back out of a review address.
		* @param address - a resource address.
		* @returns the coordinates, or undefined for any other address.
		*/
		function parseChangesReviewAddress(address) {
			if (!address.startsWith("dsh-resource://changes-review/session/")) return void 0;
			const parts = address.slice(38).split("/");
			if (parts.length !== 3) return void 0;
			const [sessionId, seq, turn] = parts;
			if (sessionId === "" || !/^\d+$/.test(seq) || !/^[1-9]\d*$/.test(turn)) return void 0;
			try {
				return {
					sessionId: decodeURIComponent(sessionId),
					seq: Number(seq),
					turn: Number(turn)
				};
			} catch {
				return;
			}
		}
		//#endregion
		//#region lib/types/client/host-read-store.js
		/**
		* Fetch-once cache of Host-served records keyed by their authenticated URL:
		* one read per URL while a state stands, cleared on connection replacement,
		* cancelled on disposal. Each store decides what a response means and which
		* states a later request reads again.
		*/
		/** One browser plugin's reads of one record kind. */
		var HostReadStore = class {
			policy;
			/** Record URLs key the state across Sessions and turns. */
			state = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({});
			lifetime = new AbortController();
			/** The connection generation the current states belong to; a reset aborts it so no older read publishes. */
			generation = new AbortController();
			pending = /* @__PURE__ */ new Set();
			constructor(policy) {
				this.policy = policy;
			}
			/**
			* Read one URL unless a state the policy keeps already stands for it.
			* @param url - the record's authenticated URL.
			* @returns after the state is published.
			*/
			async loadUrl(url) {
				const current = this.state.getSnapshot()[url];
				if (this.lifetime.signal.aborted || current !== void 0 && !this.policy.retryable(current)) return;
				this.state.update((state) => {
					state[url] = this.policy.loading;
				});
				const task = this.read(url, AbortSignal.any([this.lifetime.signal, this.generation.signal]));
				this.pending.add(task);
				try {
					await task;
				} finally {
					this.pending.delete(task);
				}
			}
			/** Forget every state and abandon in-flight reads; a replaced connection may reach a Host that no longer serves them. */
			reset() {
				this.generation.abort();
				this.generation = new AbortController();
				this.state.set({});
			}
			/** Cancel outstanding reads and wait until none can publish state. */
			async dispose() {
				this.lifetime.abort();
				await Promise.all(this.pending);
			}
			async read(url, signal) {
				let next;
				try {
					next = await this.policy.decode(await fetch(url, { signal }));
				} catch {
					next = this.policy.failed;
				}
				if (!signal.aborted) this.state.update((state) => {
					state[url] = next;
				});
			}
		};
		//#endregion
		//#region lib/types/client/changes-diff.js
		/** One browser plugin's comparison reads; a failed read is the one state a later request replaces. */
		var ChangesDiffStore = class extends HostReadStore {
			constructor() {
				super({
					loading: "loading",
					failed: "error",
					retryable: (state) => state === "error",
					decode: async (response) => {
						if (response.status === 404) return "missing";
						if (!response.ok) return "error";
						const value = await response.json();
						return isChangesDiff(value) ? value : "error";
					}
				});
			}
			/**
			* Read one comparison; a cached comparison or a missing one is kept, a failed one is read again.
			* @param sessionId - viewed Session.
			* @param seq - the announcing event's sequence.
			* @param index - the file's index in the summary.
			* @returns after the state is published.
			*/
			load(sessionId, seq, index) {
				return this.loadUrl(changesDiffUrl(sessionId, seq, index));
			}
		};
		//#endregion
		//#region lib/types/client/changes-summary.js
		/** One browser plugin's summary reads; a summary or a missing answer is kept until the connection is replaced. */
		var ChangesSummaryStore = class extends HostReadStore {
			constructor() {
				super({
					loading: "loading",
					failed: "missing",
					retryable: () => false,
					decode: async (response) => {
						if (!response.ok) return "missing";
						const value = await response.json();
						return isChangesSummary(value) ? value : "missing";
					}
				});
			}
			/**
			* Read one summary once; a later read of the same coordinates returns the cached state.
			* @param sessionId - viewed Session.
			* @param seq - the announcing event's sequence.
			* @returns after the state is published.
			*/
			load(sessionId, seq) {
				return this.loadUrl(changesSummaryUrl(sessionId, seq));
			}
		};
		//#endregion
		//#region lib/types/presented.js
		/** Authenticated POST route for opening a workspace file on the Host desktop. */
		const PRESENT_OPEN_PATH = "/api/present.open";
		/** Authenticated desktop availability and destination metadata. */
		const PRESENT_HOST_PATH = "/api/present.host";
		/**
		* Browser-relative form of {@link PRESENT_OPEN_PATH}; see
		* .agents/notes/implemented/architecture/2026-09-14-web-document-relative-app-routes.md.
		*/
		const PRESENT_OPEN_ROUTE = PRESENT_OPEN_PATH.slice(1);
		/** Browser-relative form of {@link PRESENT_HOST_PATH}. */
		const PRESENT_HOST_ROUTE = PRESENT_HOST_PATH.slice(1);
		/**
		* Validate desktop metadata received over HTTP.
		* @param value - decoded response.
		* @returns whether all displayed and actionable fields are supported.
		*/
		function isPresentedHost(value) {
			if (typeof value !== "object" || value === null) return false;
			const host = value;
			return typeof host.name === "string" && typeof host.available === "boolean" && (host.fileManager === null || host.fileManager === "finder" || host.fileManager === "explorer" || host.fileManager === "directory");
		}
		/**
		* Validate a file declaration read from a Session log.
		* @param value - decoded durable data.
		* @returns whether the declaration contains a path and optional description.
		*/
		function isPresentedFile(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const { path, description } = value;
			return typeof path === "string" && path.trim().length > 0 && (description === void 0 || typeof description === "string");
		}
		/**
		* Build authenticated coordinates for a declared file.
		* @param sessionId - owning Session.
		* @param seq - deliverables/presented event sequence.
		* @param index - original index in the event's files array.
		* @returns document-relative file action route.
		*/
		function presentedFileUrl(sessionId, seq, index) {
			return `${PRESENT_OPEN_ROUTE}?${new URLSearchParams({
				sessionId,
				seq: String(seq),
				index: String(index)
			})}`;
		}
		/**
		* Validate a delivery event before reading its turn or file declarations.
		* @param value - decoded durable event data.
		* @returns whether the event identifies a turn, call, and file list.
		*/
		function isPresentedData(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const { turn, callId, files } = value;
			return typeof turn === "number" && Number.isSafeInteger(turn) && turn >= 1 && typeof callId === "string" && callId.length > 0 && Array.isArray(files);
		}
		/**
		* Trailing path segment, the part that identifies the file at a glance.
		* @param path - Slash- or backslash-separated path.
		* @returns The final segment, or the whole string when separator-free.
		*/
		function basename(path) {
			const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
			return at === -1 ? path : path.slice(at + 1);
		}
		//#endregion
		//#region lib/types/client/present-open.js
		/** Shared native-open status for delivery cards, the changed-files card, and closing-message file mentions. */
		/** Success feedback remains fully visible for five seconds before fading. */
		const PRESENTED_SUCCESS_HOLD_MS = 5e3;
		/** One browser plugin's file-open requests, cancelled when that plugin is disposed. */
		var PresentedOpenController = class {
			/** File action URLs key the state across Sessions, turns, and both clickable surfaces. */
			state = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({});
			/** Native destination metadata, or a retryable read failure. */
			host = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			expiry = /* @__PURE__ */ new Map();
			loading;
			metadata = new AbortController();
			lifetime = new AbortController();
			pending = /* @__PURE__ */ new Set();
			/**
			* Open a declared file once while a request for the same coordinates is pending.
			* Failures remain visible on the card and a later gesture retries them.
			* @param sessionId - viewed Session, including a fork's own identity.
			* @param seq - durable delivery event sequence.
			* @param index - original file index within that event.
			* @param action - default application open or file-manager reveal.
			* @param application - registered handler identifier for an explicit application choice.
			* @returns null after a successful handoff, or the failure to announce after publishing card status.
			*/
			open(sessionId, seq, index, action = "open", application) {
				return this.openUrl(presentedFileUrl(sessionId, seq, index), action, application);
			}
			/**
			* Open one recorded changed file in the Host's default application.
			* @param sessionId - viewed Session.
			* @param seq - durable workspace/changes event sequence.
			* @param index - original file index within that event.
			* @param action - application open or file-manager reveal.
			* @param application - registered handler identifier for an explicit application choice.
			* @returns null after a successful handoff, or the failure to announce after publishing card status.
			*/
			openChanged(sessionId, seq, index, action = "open", application) {
				return this.openUrl(changedFileUrl(sessionId, seq, index), action, application);
			}
			async openUrl(url, action, application) {
				const phase = this.state.getSnapshot()[url];
				if (this.lifetime.signal.aborted || phase === "opening" || phase === "revealing") return null;
				this.clearExpiry(url);
				this.state.update((state) => {
					state[url] = action === "open" ? "opening" : "revealing";
				});
				const task = this.request(url, action, application);
				this.pending.add(task);
				try {
					return await task;
				} finally {
					this.pending.delete(task);
				}
			}
			/**
			* Read the serving desktop metadata, coalescing concurrent reads; a later call retries failure.
			* @returns after metadata or a retryable error is published.
			*/
			async loadHost() {
				if (this.lifetime.signal.aborted) return;
				if (this.loading !== void 0) return this.loading;
				this.host.set(null);
export {};
