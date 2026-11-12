/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
						this.pick(state.highlight.source, state.highlight.index);
						return "pick-highlighted";
					}
					case "tab": {
						if (state.highlight === null) return "pass";
						const group = state.groups.find((g) => g.source === state.highlight?.source);
						if (group === void 0 || group.status !== "ready") return "consumed";
						const item = group.items[state.highlight.index];
						if (item === void 0) return "pass";
						if (item.drill === true) {
							this.pick(state.highlight.source, state.highlight.index, "drill");
							return "consumed";
						}
						this.pick(state.highlight.source, state.highlight.index);
						return "pick-highlighted";
					}
				}
			}
			/**
			* Space adjudication over the just-completed leading token: polls sources'
			* matchSpace (hot state, synchronous) and dispatches the outcome itself.
			* @returns true when a claim/insert was actually applied by the input —
			* the caller preventDefaults exactly then.
			*/
			onSpace() {
				const hit = this.hit;
				if (this.disposed || hit === null || hit.position !== "leading") return false;
				const token = hit.trigger + hit.query;
				const projection = this.project();
				for (const src of this.deps.roster.sources(hit.trigger)) {
					if (src.matchSpace === void 0) continue;
					const outcome = src.matchSpace(projection, token);
					if (outcome === void 0) continue;
					if (outcome === "handled") return true;
					return this.execute(outcome, hit.span);
				}
				return false;
			}
			/**
			* Serialize one reference occurrence to its model form via the owning
			* source's codec (prompt serialization: registry → explicit
			* call → await). Owner missing or codec-less rejects — the submit attempt
			* blocks instead of silently downgrading to the clipboard text.
			* @param source - owning source name.
			* @param ref - owner-scoped reference id.
			* @param signal - the submit attempt's abort signal.
			* @returns the model representation (e.g. `<skill>name</skill>`).
			*/
			serializeReference(source, ref, signal) {
				const owner = this.deps.roster.all().find((s) => s.name === source);
				if (owner?.codec === void 0) return Promise.reject(/* @__PURE__ */ new Error(`slash: no serializer for reference source "${source}"`));
				return owner.codec.serialize(ref, signal);
			}
			/**
			* Route a chip to its owner or an editable token to its current lexicon owner.
			* @param source - chip source name; undefined for editable text.
			* @param reference - source-owned id and optional chip glyph.
			* @returns whether an owner accepted the preview, possibly awaiting its catalog.
			*/
			openReference(source, reference) {
				if (this.disposed) return false;
				const session = this.project();
				for (const owner of this.deps.roster.all()) if ((source === void 0 ? reference.ref.startsWith(owner.trigger) && owner.lexicon?.(session)?.includes(reference.ref.slice(1)) : owner.name === source) && owner.openReference?.(session, reference)) {
					this.dismiss();
					return true;
				}
				return false;
			}
			/**
			* Enter last adjudication: polls sources' matchEnter in registration
			* order, first non-undefined wins. The outcome returns to the caller (the
			* input machine applies it inside the same submit attempt — no event).
			* @param line - trimmed draft; the leading char selects the trigger roster.
			* @param signal - attempt-scoped abort from the input machine.
			* @param envelope - non-text submission state accompanying the draft.
			* @returns the winning outcome or undefined (default sink). Rejects when a
			* polled source's warmup fails or the winning source refuses the envelope —
			* the caller must not silently downgrade.
			*/
			async adjudicate(line, signal, envelope) {
				const projection = this.project();
				for (const src of this.deps.roster.all()) {
					if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : /* @__PURE__ */ new Error("slash adjudication aborted");
					if (src.matchEnter === void 0 || !line.startsWith(src.trigger)) continue;
					const outcome = await src.matchEnter(projection, line, signal, envelope);
					if (outcome !== void 0) return outcome;
				}
			}
			/**
			* Resolve the claim a persisted command chip names, polling sources'
			* matchClaim in registration order; the first claim wins. Never acts on the
			* token (see {@link InputTriggerSource.matchClaim}).
			* @param token - command spelling without its argument separator, e.g. '/goal'.
			* @param signal - abort for the caller's restore attempt.
			* @returns the claim, or undefined when no source claims the token. Rejects
			* when a polled source's warmup fails or `signal` aborts.
			*/
			async resolveClaim(token, signal) {
				const projection = this.project();
				for (const src of this.deps.roster.all()) {
					if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : /* @__PURE__ */ new Error("command restore aborted");
					if (src.matchClaim === void 0 || !token.startsWith(src.trigger)) continue;
					const claim = await src.matchClaim(projection, token, signal);
					if (claim !== void 0) return claim;
				}
			}
			/**
			* Drop the menu group of a disposed source (root registry change notification).
			* @param source - the source whose registration was disposed.
			*/
			sourceRemoved(source) {
				const state = this.menu.getSnapshot();
				if (state.open && state.hit !== null && state.hit.trigger === source.trigger) this.reduce({
					type: "source-failed",
					generation: state.generation,
					source: source.name
				});
				this.lexiconOffs.get(source)?.();
				this.lexiconOffs.delete(source);
				this.refreshLexicon();
			}
			/**
			* Admit a source registered after this controller's birth (root registry
			* change notification): warm it and fold its roll into the live lexicon —
			* the constructor-time prewarm covers only the roster present at scope
			* birth.
			* @param source - the newly registered source.
			*/
			sourceAdded(source) {
				const projection = this.project();
				source.warm?.(projection);
				this.watchLexicon(source, projection);
				this.refreshLexicon();
			}
			/** External dismiss (e.g. pointer outside the composer area). */
			dismiss() {
				if (this.disposed) return;
				this.rememberDismissed();
				this.stopFetch();
				this.reduce({ type: "close" });
			}
			/** Re-fetch the currently open menu without changing its hit or visible rows. */
			refreshOpenMenu() {
				if (this.disposed || !this.menu.getSnapshot().open || this.hit === null) return;
				const launched = this.launcher.getSnapshot();
				const roster = this.deps.roster.sources(this.hit.trigger).filter((source) => launched === null || source.name === launched);
				if (roster.length === 0) return;
				this.fetchCandidates(this.hit, roster);
			}
			/** Scope teardown: close and abort (the service deletes the map entry). */
			dispose() {
				this.disposed = true;
				this.stopFetch();
				this.reduce({ type: "close" });
				this.hit = null;
				for (const off of this.lexiconOffs.values()) off();
				this.lexiconOffs.clear();
			}
			/** The session projection handed to sources (agent-backed identity; constant per scope). */
			project() {
				return { sessionId: this.deps.sessionId };
			}
			/** Execute a claim/insert/text outcome via the scoped input events (actx as dispatch subject); true = the input applied it. */
			execute(outcome, span) {
				const { actx } = this.deps;
				if (outcome === void 0 || outcome === "handled") return false;
				if ("claim" in outcome) return actx.bail(actx, "slash/input-begin-command", {
					claim: outcome.claim,
					span
				}) === true;
				if ("text" in outcome) return actx.bail(actx, "slash/input-insert-text", {
					text: outcome.text,
					span,
					...outcome.continue === true ? { continue: true } : {}
				}) === true;
				return actx.bail(actx, "slash/input-insert-reference", {
					reference: outcome.insert,
					span
				}) === true;
			}
			/** Re-poll every lexicon-bearing source and publish the aggregated rolls (see the store doc). */
			refreshLexicon() {
				const projection = this.project();
				const rolls = /* @__PURE__ */ new Map();
				for (const src of this.deps.roster.all()) {
					if (src.lexicon === void 0) continue;
					let names;
					try {
						names = src.lexicon(projection);
					} catch (error) {
						console.error(`[ui-input-trigger] source "${src.name}" lexicon failed:`, error);
						continue;
					}
					if (names === void 0) continue;
					const prev = rolls.get(src.trigger);
					rolls.set(src.trigger, prev === void 0 ? names : [...prev, ...names]);
				}
				this.lexicon.set(rolls);
			}
			/** Wire one source's lexicon invalidation channel into refresh (hookless or roll-less sources never notify). */
			watchLexicon(source, projection) {
				if (source.lexicon === void 0 || source.subscribeLexicon === void 0) return;
				this.lexiconOffs.set(source, source.subscribeLexicon(projection, () => {
					this.refreshLexicon();
					const hit = this.hit;
					if (hit === null || !this.menu.getSnapshot().open || hit.trigger !== source.trigger) return;
					Promise.resolve().then(() => {
						if (this.disposed || this.hit !== hit || !this.menu.getSnapshot().open) return;
						this.fetchCandidates(hit, this.deps.roster.sources(hit.trigger));
					});
				}));
			}
			/** Launch the candidate fetch for one hit generation, superseding the previous one. */
			fetchCandidates(hit, roster) {
				this.stopFetch();
				const controller = new AbortController();
				this.fetch = controller;
				const generation = this.menu.getSnapshot().generation;
				const projection = this.project();
				for (const source of roster) source.candidates(projection, {
					query: hit.query,
					quoted: hit.quoted,
					position: hit.position,
					drilled: this.drilled,
					signal: controller.signal
				}).then((items) => {
					if (controller.signal.aborted) return;
					this.reduce({
						type: "source-settled",
						generation,
						source: source.name,
						items
					});
				}, (error) => {
					if (controller.signal.aborted) return;
					console.error(`[ui-input-trigger] source "${source.name}" candidates failed:`, error);
					this.reduce({
						type: "source-failed",
						generation,
						source: source.name
					});
				});
			}
			stopFetch() {
				this.fetch?.abort();
				this.fetch = null;
			}
			/**
			* Run one candidate (or crumb) through its source and apply the outcome.
			*
			* A drill is the one pick that leaves the menu open, so it is also the one
			* that records how the next query was reached; every other pick closes the
			* menu, which clears that record.
			* @param src - the owning source.
			* @param candidate - the picked candidate, or a crumb projected as one.
			* @param hit - the authoritative hit supplying position and span CAS.
			* @param action - settling pick or drill.
			*/
			settle(src, candidate, hit, action) {
				const outcome = src.onPick({
					candidate,
					session: this.project(),
					position: hit.position,
					via: "menu",
					action,
					span: hit.span
				});
				this.stopFetch();
				if (action === "pick") this.rememberDismissed();
				this.reduce({ type: "close" });
				this.drilled = action === "drill";
				if (!this.execute(outcome, hit.span)) this.drilled = false;
			}
			/** Re-poll every header-bearing source in the hit roster and publish their crumbs. */
			refreshHeaders(hit, roster) {
				const projection = this.project();
				const crumbs = /* @__PURE__ */ new Map();
				for (const src of roster) {
					if (src.header === void 0) continue;
					let published;
					try {
						published = src.header(projection, {
							query: hit.query,
							quoted: hit.quoted,
							drilled: this.drilled
						});
					} catch (error) {
						console.error(`[ui-input-trigger] source "${src.name}" header failed:`, error);
						continue;
					}
					if (published === void 0 || published.length === 0) continue;
					crumbs.set(src.name, published);
				}
				this.setHeaders(crumbs);
			}
			setHeaders(next) {
				if (this.headers.getSnapshot().size === 0 && next.size === 0) return;
				this.headers.set(next);
			}
			/** Record the open menu's identity as dismissed, so a bare re-track cannot revive it. */
			rememberDismissed() {
				const hit = this.hit;
				this.dismissed = hit === null ? null : {
					trigger: hit.trigger,
					query: hit.query,
					quoted: hit.quoted,
					start: hit.span.start,
					end: hit.span.end
				};
			}
			clearLauncher() {
				if (this.launcher.getSnapshot() !== null) this.launcher.set(null);
			}
			reduce(ev) {
				const cur = this.menu.getSnapshot();
				const next = menuReduce(cur, ev);
				if (next !== cur) this.menu.set(next);
				if (next.open) return;
				this.clearLauncher();
				this.drilled = false;
				this.setHeaders(/* @__PURE__ */ new Map());
			}
		};
		//#endregion
		//#region lib/types/client/service.js
		/**
		* InputTriggerService (`ctx.inputTriggers`): the root half of the trigger pipeline — the
		* stateless source registry plus the per-session controller map. Every piece
		* of mutable interaction state (hit, menu, fetch) lives on the
		* {@link InputTriggerController}; the service only registers sources, resolves
		* controllers by session scope, and relays roster changes.
		*/
		/** The `ctx.inputTriggers` trigger pipeline service (root registry + controller resolution). */
		var InputTriggerService = class extends _deepseek_ai_cordis.Service {
			static inject = ["sessions"];
			live = {
				sources: [],
				controllers: new WeakMapWithValues()
			};
			/**
			* @param ctx - owning root context (the service registers itself as `slash`).
			*/
			constructor(ctx) {
				super(ctx, "inputTriggers");
				ctx.on("locale/change", () => {
					for (const controller of this.live.controllers.values) controller.refreshOpenMenu();
				});
			}
			/**
			* Register one trigger source. Live session controllers are notified so a
			* source arriving after scope birth still warms and joins the lexicon.
			* @param src - the source; (trigger, name) must be unique — duplicates throw.
			* @returns the disposer (callers wrap registration in ctx.effect). Disposal
			* while a controller shows the source's menu group drops that group.
			*/
			registerSource(src) {
				const { live } = this;
				if (live.sources.some((s) => s.trigger === src.trigger && s.name === src.name)) throw new Error(`slash source "${src.trigger}${src.name}" is already registered`);
				live.sources.push(src);
				for (const controller of live.controllers.values) try {
					controller.sourceAdded(src);
				} catch (error) {
					console.error(`[ui-input-trigger] source "${src.trigger}${src.name}" late-registration setup failed:`, error);
				}
				return () => {
					const at = live.sources.indexOf(src);
					if (at < 0) return;
					live.sources.splice(at, 1);
					for (const controller of live.controllers.values) controller.sourceRemoved(src);
				};
			}
			/**
			* Resolve the per-session controller for one session scope (lazy; the
			* scope disposer removes and disposes it). Construction warms the source
			* roster once — sessions are always agent-backed, so scope birth is the
			* single prewarm moment.
			* @param actx - session-scope ctx.
			* @returns the resident controller.
			* @throws when the Context no longer belongs to a retained Session generation.
			*/
			sessionOf(actx) {
				const sessions = this.sessions();
				const session = sessions.sessionOf(actx);
				const binding = session === void 0 ? void 0 : sessions.binding(session.sessionId);
				if (binding === void 0 || binding.session !== session) throw new Error("slash.sessionOf requires a retained Session scope");
				const id = binding.sessionId;
				const { live } = this;
				const existing = live.controllers.get(binding);
				if (existing !== void 0) return existing;
				const controller = new InputTriggerController({
					actx: binding.ctx,
					sessionId: id,
					roster: {
						sources: (trigger) => live.sources.filter((s) => s.trigger === trigger).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
						all: () => live.sources
					}
				});
				live.controllers.set(binding, controller);
				binding.ctx.effect(() => () => {
					controller.dispose();
export {};
