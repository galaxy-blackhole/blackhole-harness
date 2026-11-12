/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/task-tab-bindings.js
		/** Storage prefix; one key per Session holds that Session's entries. */
		const PREFIX = "dsh.schedule.task-tab.v1.";
		/**
		* Whether a parsed storage value is a record rather than an array or a scalar.
		* @param value - parsed storage value.
		* @returns `true` for a plain record.
		*/
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/**
		* Narrow one stored value to a task tab entry.
		* @param value - one member of a stored Session document.
		* @returns the entry, or undefined for a value this store did not write.
		*/
		function entryOf(value) {
			if (!isRecord(value)) return void 0;
			const { kind, contentId, sessionId, id } = value;
			if (typeof kind !== "string" || typeof contentId !== "string") return void 0;
			if (typeof sessionId !== "string" || typeof id !== "string") return void 0;
			return {
				kind,
				contentId,
				sessionId,
				id
			};
		}
		/**
		* Narrow one stored Session document to its well-formed entries.
		* @param raw - stored text.
		* @returns the entries it holds; unparseable text and malformed values are dropped.
		*/
		function entriesOf(raw) {
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch (_invalidJson) {
				return /* @__PURE__ */ new Map();
			}
			if (!isRecord(parsed)) return /* @__PURE__ */ new Map();
			const entries = /* @__PURE__ */ new Map();
			for (const [tabId, value] of Object.entries(parsed)) {
				const entry = entryOf(value);
				if (entry !== void 0) entries.set(tabId, entry);
			}
			return entries;
		}
		/**
		* Last shown task per task tab page, kept in this window and in browser storage.
		*
		* The window copy is authoritative for this window's reads: it keeps the value
		* usable when storage is absent or rejects writes, and it avoids reparsing the
		* stored document on every render.
		*/
		var TaskTabBindings = class {
			liveTabIds;
			memory = /* @__PURE__ */ new Map();
			/**
			* @param liveTabIds - the committed layout's tab ids for one Session, read when an entry is stored.
			*/
			constructor(liveTabIds) {
				this.liveTabIds = liveTabIds;
			}
			/**
			* Read the task one page last showed.
			*
			* An entry whose kind or contentId differs from the page reading it belongs to
			* a layout id that has since been reused; the read reports no task and leaves
			* the document untouched, and `dropMismatched` removes it after the render.
			* @param sessionId - the Session holding the tab.
			* @param page - the restored layout record.
			* @returns the task to show, or undefined when the page has no applicable entry.
			*/
			read(sessionId, page) {
				const entry = this.document(sessionId).get(page.id);
				if (entry === void 0) return void 0;
				if (entry.kind !== page.kind || entry.contentId !== page.contentId) return void 0;
				return {
					sessionId: entry.sessionId,
					id: entry.id
				};
			}
			/**
			* Drop one page's entry when it recorded another kind or contentId.
			*
			* A read reports the mismatch without writing, so the page resolves its target
			* in a render and drops the entry from an effect; a render React discards must
			* not rewrite what it read.
			* @param sessionId - the Session holding the tab.
			* @param page - the layout record the stored entry has to match.
			*/
			dropMismatched(sessionId, page) {
				const entry = this.document(sessionId).get(page.id);
				if (entry === void 0 || entry.kind === page.kind && entry.contentId === page.contentId) return;
				this.forget(sessionId, page);
			}
			/**
			* Record the task one page now shows.
			* @param sessionId - the Session holding the tab.
			* @param page - the navigated layout record.
			* @param target - the task the navigation named.
			*/
			write(sessionId, page, target) {
				const entries = new Map(this.document(sessionId));
				entries.set(page.id, {
					kind: page.kind,
					contentId: page.contentId,
					...target
				});
				this.store(sessionId, entries);
			}
			/**
			* Drop one page's entry once a read that succeeded after the tab appeared shows
			* its task is gone.
			* @param sessionId - the Session holding the tab.
			* @param page - the layout record whose entry is removed.
			*/
			forget(sessionId, page) {
				const entries = new Map(this.document(sessionId));
				entries.delete(page.id);
				this.store(sessionId, entries);
			}
			/** Release this window's cached documents. */
			clear() {
				this.memory.clear();
			}
			/**
			* One Session's entries, from this window or from storage.
			* @param sessionId - the Session holding the tabs.
			* @returns its entries, empty when nothing is saved or storage is unreachable.
			*/
			document(sessionId) {
				const cached = this.memory.get(sessionId);
				if (cached !== void 0) return cached;
				if (typeof localStorage === "undefined") return /* @__PURE__ */ new Map();
				let raw;
				try {
					raw = localStorage.getItem(PREFIX + sessionId);
				} catch (_storageUnavailable) {
					return /* @__PURE__ */ new Map();
				}
				if (raw === null) return /* @__PURE__ */ new Map();
				const entries = entriesOf(raw);
				this.memory.set(sessionId, entries);
				return entries;
			}
			/**
			* Replace one Session's entries, dropping those of tabs a non-empty list of
			* committed ids does not hold, and publish them to this window and to storage.
			* An empty result removes the Session's key rather than storing an empty
			* document.
			* @param sessionId - the Session holding the tabs.
			* @param entries - the complete replacement set.
			*/
			store(sessionId, entries) {
				const live = this.liveTabIds?.(sessionId);
				const kept = live === void 0 || live.length === 0 ? entries : new Map([...entries].filter(([tabId]) => live.includes(tabId)));
				this.memory.set(sessionId, kept);
				if (typeof localStorage === "undefined") return;
				try {
					const key = PREFIX + sessionId;
					if (kept.size === 0) localStorage.removeItem(key);
					else localStorage.setItem(key, JSON.stringify(Object.fromEntries(kept)));
				} catch (error) {
					console.error("Task tab binding persistence failed:", error);
				}
			}
		};
		//#endregion
