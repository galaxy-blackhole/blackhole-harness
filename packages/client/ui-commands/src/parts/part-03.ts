/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		*/
		function claimToken(descriptor, t) {
			const name = builtinCommandName(descriptor);
			return name === void 0 ? descriptor.name : t(`token.${name}`);
		}
		const TOKEN_ALIASES = new Map(Object.keys(BUILTINS).flatMap((name) => [zh[`token.${name}`], en[`token.${name}`]].map((token) => [token, name])));
		/**
		* Resolve typed spelling against the current Session's effective definitions.
		* @param token - typed name without its leading slash.
		* @param descriptors - effective descriptors in the Session's ready catalog.
		* @returns the matching descriptor; aliases never select an unrelated scoped override.
		*/
		function resolveCommand(token, descriptors) {
			const exact = descriptors.find((descriptor) => descriptor.name === token);
			if (exact !== void 0) return exact;
			const name = TOKEN_ALIASES.get(token);
			if (name === void 0) return void 0;
			return descriptors.find((descriptor) => descriptor.definitionId === BUILTINS[name]);
		}
		//#endregion
		//#region lib/types/client/directory.js
		/** One session key's cache cell. */
		var Entry = class {
			state = "cold";
			commands = [];
			/** Bumped at each pull start; only the latest pull may publish its outcome. */
			epoch = 0;
			lastError;
			waiters = [];
		};
		/** The session-keyed directory cache. Plain class — the owning service wires events and RPC. */
		var CommandDirectory = class {
			fetchCommands;
			entries = /* @__PURE__ */ new Map();
			constructor(fetchCommands) {
				this.fetchCommands = fetchCommands;
			}
			/**
			* Current cache status for one session.
			* @param sessionId - session key.
			* @returns the entry status (cold when never touched).
			*/
			status(sessionId) {
				return this.entries.get(sessionId)?.state ?? "cold";
			}
			/**
			* Synchronous command lookup over one Session's ready catalog; exact names precede localized aliases.
			* @param sessionId - session key.
			* @param name - typed command spelling without the leading slash.
			* @returns the descriptor, or undefined when absent or the entry is not ready.
			*/
			resolve(sessionId, name) {
				const entry = this.entries.get(sessionId);
				if (entry === void 0 || entry.state !== "ready") return void 0;
				return resolveCommand(name, entry.commands);
			}
			/** Soft invalidation (commands-changed): background repull on every touched key; ready snapshots keep serving. */
			invalidateAll() {
				for (const key of this.entries.keys()) this.refresh(key);
			}
			/**
			* Drop one Session's obsolete composition-specific snapshot and prewarm its replacement.
			* @param sessionId - Session whose effective command composition changed.
			*/
			resetSession(sessionId) {
				const entry = this.entry(sessionId);
				entry.state = "cold";
				entry.commands = [];
				entry.lastError = void 0;
				this.refresh(sessionId);
			}
			/**
			* Hard reset on reconnect: every entry drops its snapshot (the agent world
			* may have changed shape across the generation) and prewarms.
			*/
			resetConnected() {
				for (const [key, entry] of this.entries) {
					entry.state = "cold";
					entry.commands = [];
					this.refresh(key);
				}
			}
			/**
			* Fire-and-forget prewarm of one session (the command source's scope-birth
			* warm hook lands here).
			* @param sessionId - session key.
			*/
			warm(sessionId) {
				const entry = this.entry(sessionId);
				if (entry.state === "cold" || entry.state === "failed") this.refresh(sessionId);
			}
			/**
			* Start one pull for one session. Publishes ready/failed only while it is
			* still the key's latest pull (epoch guard); a ready snapshot is not
			* demoted while the pull flies.
			* @param sessionId - session key.
			* @returns settled when this pull's outcome is published or discarded.
			*/
			async refresh(sessionId) {
				const entry = this.entry(sessionId);
				const epoch = ++entry.epoch;
				if (entry.state !== "ready") entry.state = "pending";
				try {
					const commands = await this.fetchCommands(sessionId);
					if (epoch !== entry.epoch) return;
					entry.commands = commands;
					entry.state = "ready";
					entry.lastError = void 0;
				} catch (error) {
					if (epoch !== entry.epoch) return;
					entry.commands = [];
					entry.state = "failed";
					entry.lastError = error;
				} finally {
					if (epoch === entry.epoch) notifyWaiters(entry);
				}
			}
			/**
			* Strong-wait until one session's catalog is servable (the enter-
			* adjudication "directory must be reached" rule): ready returns at once;
			* cold/failed launch a fresh pull; pending joins the flying one. Rejects
			* when the awaited pull fails or the signal aborts.
			* @param sessionId - session key.
			* @param signal - attempt-scoped abort (the SubmitAttempt signal).
			* @returns the hot command snapshot.
			*/
			async ensureReady(sessionId, signal) {
				const entry = this.entry(sessionId);
				while (true) {
					if (entry.state === "ready") return entry.commands;
					if (entry.state !== "pending") this.refresh(sessionId);
					await settled(entry, signal);
					if (entry.state === "failed") throw new Error(`command directory warmup failed: ${entry.lastError instanceof Error ? entry.lastError.message : String(entry.lastError)}`);
				}
			}
			entry(sessionId) {
				let entry = this.entries.get(sessionId);
				if (entry === void 0) {
					entry = new Entry();
					this.entries.set(sessionId, entry);
				}
				return entry;
			}
		};
		/** One settlement tick for one entry: resolves at the next winning publish, rejects on abort. */
		function settled(entry, signal) {
			if (signal.aborted) return Promise.reject(abortReason(signal));
			return new Promise((resolve, reject) => {
				const waiter = () => {
					signal.removeEventListener("abort", onAbort);
					resolve();
				};
				const onAbort = () => {
					entry.waiters = entry.waiters.filter((w) => w !== waiter);
					reject(abortReason(signal));
				};
				signal.addEventListener("abort", onAbort, { once: true });
				entry.waiters.push(waiter);
			});
		}
		function notifyWaiters(entry) {
			const woken = entry.waiters;
			entry.waiters = [];
			for (const wake of woken) wake();
		}
		/** Normalize an abort into an Error rejection. */
		function abortReason(signal) {
			return signal.reason instanceof Error ? signal.reason : /* @__PURE__ */ new Error("command directory wait aborted");
		}
		//#endregion
		//#region lib/types/client/option-groups.js
		/**
		* Group rows by their caller-owned group name, without sorting groups or rows.
		* Ungrouped rows occupy one block at their first occurrence.
		* @param options - Options in display order.
		* @returns groups in first-occurrence order, with original option objects.
		*/
		function groupOptions(options) {
			const groups = /* @__PURE__ */ new Map();
			for (const option of options) {
				const name = option.group?.name;
				const existing = groups.get(name);
				if (existing !== void 0) existing.rows.push(option);
				else groups.set(name, {
					group: option.group,
					rows: [option]
				});
			}
			return [...groups.values()];
		}
		//#endregion
		//#region lib/types/client/popup.js
		/**
		* Headless popupSelect shell state: one controller per client
		* session, owned by CommandUiRuntime's per-session map and torn down by the
		* session scope disposer. The shell is a transient layer (never in the input
		* state machine): it loads options once, filters them locally against the
		* shell's own search text, and settles a selection through the context
		* captured at open time. Draft consumption and composer focus are injected
		* callbacks — the session wiring dispatches the consume-token event (the
		* Input side owns the span/bare-token CAS guard) and focuses the composer;
		* the controller never touches the input machine.
		*/
		const CLOSED = {
			open: false,
			command: null,
			status: "pending",
			options: [],
			search: "",
			searchLabels: null,
			searchMode: "substring",
			active: 0,
			submitting: false,
			confirming: null,
			acknowledged: false,
			error: null
		};
		/**
		* Filter rows using substring matching, or rank labels fuzzily within each group.
		* Blank search keeps every row; fuzzy matching preserves group order.
		* @param options - the loaded rows.
		* @param search - the shell's search text.
		* @param mode - the command's policy; defaults to substring over label and detail.
		* @returns the original option objects in the order shown and used for selection.
		*/
		function filterOptions(options, search, mode = "substring") {
			const query = search.trim().toLowerCase();
			const groups = groupOptions(options);
			const ordered = groups.some((group) => group.group !== void 0) ? groups.flatMap((group) => group.rows) : options;
			if (query === "") return ordered;
			if (mode === "fuzzy-label") return groups.flatMap((group) => (0, _deepseek_ai_dsh_client_ui_primitives.rankByName)(group.rows.map((option) => ({
				name: option.label,
				option
			})), query).map((row) => row.option));
			return ordered.filter((o) => o.label.toLowerCase().includes(query) || (o.detail?.toLowerCase().includes(query) ?? false));
		}
		/**
		* Highlight index for a freshly loaded row list: the row marked as the current
		* value when the live search still shows it, else the top row. Opening parks
		* the highlight on the value the session already uses, so an accept gesture
		* made without looking confirms that value instead of the topmost row.
		* @param options - the loaded rows.
		* @param search - the shell's live filter text (non-empty after a retry).
		* @param mode - the command's search policy.
		* @returns index into the filtered rows.
		*/
		function currentIndex(options, search, mode) {
			const at = filterOptions(options, search, mode).findIndex((option) => option.active === true);
			return at === -1 ? 0 : at;
		}
		/** The shell's error-strip line for a settlement failure. */
		function errorText(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/**
		* Headless controller of one session's popupSelect shell. Late settlements
		* lose their write rights through binding identity: dismiss/dispose/reopen
		* swap the binding, so a settling options fetch or onSelect that no longer
		* matches writes nothing and consumes nothing.
		*/
		var PopupSelectController = class {
			deps;
			/** Shell state store (the overlay component subscribes here). */
			state = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(CLOSED);
			binding = null;
			/**
			* @param deps - session-wiring callbacks (token consumption + composer focus).
			*/
			constructor(deps) {
				this.deps = deps;
			}
			/**
			* Open the shell for one command: publish pending state and fetch options
			* once through the business spec. A reopen supersedes the previous shell
			* (its options fetch is aborted, its late settlements are dropped).
			* @param command - command name the shell serves.
			* @param spec - the registered popupSelect spec.
			* @param context - open-time context snapshot, handed verbatim to options/onSelect.
			* @param segment - open-time token segment snapshot for post-select consumption.
			*/
			open(command, spec, context, segment) {
				const searchLabels = spec.searchLabels?.() ?? null;
				this.binding?.abort.abort();
				const binding = {
					command,
					spec,
					context,
					segment,
					abort: new AbortController()
				};
				this.binding = binding;
				this.state.set({
					...CLOSED,
					open: true,
					command,
					searchLabels,
					searchMode: spec.searchMode ?? "substring"
				});
				this.load(binding);
			}
			/** Run the one options fetch of a binding; settlement rights die with the binding. */
			load(binding) {
				binding.spec.options(binding.context, binding.abort.signal).then((options) => {
					if (this.binding !== binding) return;
					const current = this.state.getSnapshot();
					this.state.set({
						...current,
						status: "ready",
						options,
						active: currentIndex(options, current.search, current.searchMode),
						error: null
					});
				}, (error) => {
					if (this.binding !== binding) return;
					console.error(`[ui-commands] popupSelect options failed for /${binding.command}:`, error);
					this.state.set({
						...this.state.getSnapshot(),
						status: "failed",
						options: [],
						active: 0,
						error: errorText(error)
					});
				});
			}
			/** Re-run a failed options fetch (search survives; no-op unless status is 'failed'). */
			retry() {
				const binding = this.binding;
				const s = this.state.getSnapshot();
				if (binding === null || !s.open || s.status !== "failed") return;
				this.state.set({
					...s,
					status: "pending",
					error: null
				});
				this.load(binding);
			}
			/**
			* Replace the local search text (pure local filter — the provider is never
			* re-queried) and rebase the highlight to the top of the new filtered list:
			* typing searches for something other than the current value.
			* @param search - the shell search input's text.
			*/
			setSearch(search) {
				const s = this.state.getSnapshot();
				if (!s.open || s.submitting || s.confirming !== null || search === s.search) return;
				this.state.set({
					...s,
					search,
					active: 0
				});
			}
			/**
			* Move the highlight across the filtered rows (wraps around; no-op unless
			* options are ready and no selection is in flight).
			* @param dir - +1 down, -1 up.
			*/
			move(dir) {
				const s = this.state.getSnapshot();
				if (!s.open || s.status !== "ready" || s.submitting || s.confirming !== null) return;
				const rows = filterOptions(s.options, s.search, s.searchMode);
				if (rows.length === 0) return;
				const active = (s.active + dir + rows.length) % rows.length;
				this.state.set({
					...s,
					active
				});
			}
			/**
			* Set the highlight directly (pointer hover; no-op unless ready, idle, and
			* in filtered range).
			* @param index - filtered-row index.
			*/
			highlight(index) {
				const s = this.state.getSnapshot();
				if (!s.open || s.status !== "ready" || s.submitting || s.confirming !== null) return;
				if (index < 0 || index >= filterOptions(s.options, s.search, s.searchMode).length || index === s.active) return;
				this.state.set({
					...s,
					active: index
				});
			}
			/**
			* Select one filtered row: single-flight — the first call enters
			* `submitting` and later calls no-op until it settles. Success consumes the
			* open-time token segment (a false CAS answer is benign), closes, and
			* returns focus to the composer. Failure keeps the shell open with search,
			* highlight, and token intact, surfaces the error, and re-arms select as
			* the retry.
			* @param index - filtered-row index (callers pass the highlight or the clicked row).
			* @returns settled when the attempt has closed the shell or surfaced its failure.
			*/
			async select(index) {
				const binding = this.binding;
				const s = this.state.getSnapshot();
				if (binding === null || !s.open || s.status !== "ready" || s.submitting || s.confirming !== null) return;
				const option = filterOptions(s.options, s.search, s.searchMode)[index];
				if (option === void 0) return;
				if (option.confirmation !== void 0) {
					this.state.set({
						...s,
export {};
