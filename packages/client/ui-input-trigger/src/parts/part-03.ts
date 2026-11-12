/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					query: draft.slice(i + 1, caret),
					quoted: false,
					position: draft.search(/\S/) === i ? "leading" : "inline",
					span: {
						start: i,
						end: caret,
						draftRev: 0
					}
				};
			}
			return null;
		};
		//#endregion
		//#region lib/types/core/menu.js
		/** Closed rest state with generation 0; store initializer and test seed. */
		const MENU_CLOSED = {
			open: false,
			hit: null,
			generation: 0,
			groups: [],
			highlight: null
		};
		/**
		* Replace the group roster with pending groups for `sources`, in order.
		* Shell-side step before dispatching `hit` on a fresh menu open.
		*
		* @param state - Current menu state.
		* @param sources - Sources registered for the hit trigger, in menu order.
		* @returns State carrying the new pending roster; highlight cleared.
		*/
		function seedGroups(state, sources) {
			return {
				...state,
				groups: sources.map((source) => ({
					source: source.name,
					...source.showGroupTitle === false ? { showGroupTitle: false } : {},
					status: "pending",
					items: []
				})),
				highlight: null
			};
		}
		/** Close, preserving the generation so in-flight settlements stay droppable. */
		const closed = (state) => state.open || state.hit !== null || state.groups.length > 0 || state.highlight !== null ? {
			open: false,
			hit: null,
			generation: state.generation,
			groups: [],
			highlight: null
		} : state;
		/** First item of the first non-empty ready group, or null. */
		function firstHighlight(groups) {
			for (const g of groups) if (g.status === "ready" && g.items.length > 0) return {
				source: g.source,
				index: 0
			};
			return null;
		}
		/** The highlight itself when it still points at a ready item, else null. */
		function validHighlight(highlight, groups) {
			if (!highlight) return null;
			const g = groups.find((x) => x.source === highlight.source);
			return g && g.status === "ready" && highlight.index < g.items.length ? highlight : null;
		}
		/** Flatten ready items into (source, index) positions in group order. */
		function positions(groups) {
			const out = [];
			for (const g of groups) {
				if (g.status !== "ready") continue;
				for (let i = 0; i < g.items.length; i++) out.push({
					source: g.source,
					index: i
				});
			}
			return out;
		}
		/** True when every group is ready with zero items (the auto-close condition). */
		const allReadyEmpty = (groups) => groups.every((g) => g.status === "ready" && g.items.length === 0);
		/**
		* Pure menu reducer. `hit` opens a new generation over the seeded roster
		* (null hit closes); `source-settled` outside the current generation, the
		* open menu, or the roster is dropped; a settlement or failure leaving every
		* group ready-and-empty (or no groups) auto-closes; `source-failed` silently
		* removes the group (the shell logs); `move` cycles the highlight across
		* ready items; `hover` parks it on one ready item (pointer and keyboard
		* share the single highlight — last input wins).
		*
		* @param state - Current menu state.
		* @param ev - Menu event.
		* @returns Next state; the same reference when stale or a no-op.
		*/
		const menuReduce = (state, ev) => {
			switch (ev.type) {
				case "hit":
					if (ev.hit === null) return closed(state);
					return {
						open: true,
						hit: ev.hit,
						generation: state.generation + 1,
						groups: state.groups.map((g) => ({
							...g,
							status: "pending"
						})),
						highlight: state.highlight
					};
				case "source-settled": {
					if (!state.open || ev.generation !== state.generation) return state;
					const idx = state.groups.findIndex((g) => g.source === ev.source);
					if (idx < 0) return state;
					const items = ev.items ?? [];
					const groups = state.groups.map((g, i) => i === idx ? {
						...g,
						status: "ready",
						items
					} : g);
					if (allReadyEmpty(groups)) return closed(state);
					const highlight = validHighlight(state.highlight, groups) ?? firstHighlight(groups);
					return {
						...state,
						groups,
						highlight
					};
				}
				case "source-failed": {
					if (!state.open || ev.generation !== state.generation) return state;
					if (!state.groups.some((g) => g.source === ev.source)) return state;
					const groups = state.groups.filter((g) => g.source !== ev.source);
					if (groups.length === 0 || allReadyEmpty(groups)) return closed(state);
					const highlight = validHighlight(state.highlight, groups) ?? firstHighlight(groups);
					return {
						...state,
						groups,
						highlight
					};
				}
				case "move": {
					if (!state.open) return state;
					const pos = positions(state.groups);
					if (pos.length === 0) return state;
					const hl = state.highlight;
					const at = hl ? pos.findIndex((p) => p.source === hl.source && p.index === hl.index) : -1;
					const next = pos[at < 0 ? ev.dir === 1 ? 0 : pos.length - 1 : (at + ev.dir + pos.length) % pos.length];
					if (next === void 0) return state;
					if (hl && next.source === hl.source && next.index === hl.index) return state;
					return {
						...state,
						highlight: next
					};
				}
				case "hover": {
					if (!state.open) return state;
					const target = validHighlight({
						source: ev.source,
						index: ev.index
					}, state.groups);
					if (target === null) return state;
					const hl = state.highlight;
					if (hl && hl.source === target.source && hl.index === target.index) return state;
					return {
						...state,
						highlight: target
					};
				}
				case "close": return closed(state);
			}
		};
		//#endregion
		//#region lib/types/client/controller.js
		/** Whether a tracked hit is the one the user just dismissed (same token, same query). */
		function dismissedHit(dismissed, hit) {
			return dismissed.trigger === hit.trigger && dismissed.query === hit.query && dismissed.quoted === hit.quoted && dismissed.start === hit.span.start && dismissed.end === hit.span.end;
		}
		/**
		* Per-session trigger pipeline state and orchestration. All mutation stays
		* inside; MenuView renders from {@link InputTriggerController.menu} and routes
		* pointer picks back through {@link InputTriggerController.pick}.
		*/
		var InputTriggerController = class {
			deps;
			/** Menu state store (per-session; survives session switches, dies with the scope). */
			menu = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(MENU_CLOSED);
			/**
			* Name of the source opened through the programmatic launcher, or null for
			* trigger-detected/closed menus. Composer chrome subscribes to this store
			* for the launcher's expanded state without owning a second menu model.
			*/
			launcher = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			/**
			* Crumbs published by each header-bearing source for the open menu, keyed
			* by source name. A snapshot store like {@link InputTriggerController.launcher}:
			* the answer changes with every hit, and render-side consumers subscribe
			* instead of re-polling sources during a render.
			*/
			headers = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(/* @__PURE__ */ new Map());
			/**
			* Aggregated hot reference lexicon, grouped by trigger (plain-text-reference decision;
			* see .agents/notes/archived/architecture/2026-07-25-web-input-machine-and-slash-pipeline.md):
			* sources implementing the lexicon hook are polled with the session
			* projection; undefined answers (roll not hot yet) are skipped; multiple
			* sources on one trigger concatenate in registration order. A snapshot
			* store because rolls change asynchronously (catalog settles, children
			* spawn/exit) — render-side consumers subscribe instead of re-reading a
			* mutable answer.
			*/
			lexicon = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(/* @__PURE__ */ new Map());
			/** The authoritative hit: single truth for span CAS material (menu snapshot never carries it alone). */
			hit = null;
			/**
			* Identity of the hit whose menu the user dismissed. A dismissal means "not
			* this one, not now": the same token with the same query keeps its menu
			* closed, so restoring the caret after a dismissal cannot reopen it. Typing
			* (a new query) or moving to another token clears it.
			*/
			dismissed = null;
			/** Whether the open menu was reached by a drill pick; cleared with the menu. */
			drilled = false;
			fetch = null;
			disposed = false;
			/** Per-source lexicon unsubscribers (sources without the hook never enter). */
			lexiconOffs = /* @__PURE__ */ new Map();
			constructor(deps) {
				this.deps = deps;
				const projection = this.project();
				for (const src of deps.roster.all()) {
					src.warm?.(projection);
					this.watchLexicon(src, projection);
				}
				this.refreshLexicon();
			}
			/**
			* Feed a draft/caret change through trigger detection and drive the menu.
			* @param draft - full draft text.
			* @param caret - caret offset into `draft`.
			* @param guard - availability tier derived from the input phase.
			* @param draftRev - the input machine's current draft revision, stamped
			* into the hit span for pick-time CAS.
			*/
			track(draft, caret, guard, draftRev) {
				if (this.disposed) return;
				const launched = this.launcher.getSnapshot() !== null;
				this.clearLauncher();
				const raw = detectTrigger(draft, caret, guard);
				if (raw === null) {
					if (launched) return;
					this.hit = null;
					if (guard.tier !== "frozen") this.dismissed = null;
					this.stopFetch();
					this.reduce({ type: "close" });
					return;
				}
				const hit = {
					...raw,
					span: {
						...raw.span,
						draftRev
					}
				};
				if (launched) this.dismissed = null;
				if (this.dismissed !== null) if (!dismissedHit(this.dismissed, hit)) this.dismissed = null;
				else {
					this.hit = hit;
					return;
				}
				const prev = this.menu.getSnapshot();
				const same = !launched && prev.open && prev.hit !== null && prev.hit.trigger === hit.trigger && prev.hit.query === hit.query && prev.hit.quoted === hit.quoted && prev.hit.span.start === hit.span.start && prev.hit.span.end === hit.span.end;
				this.hit = hit;
				if (same) return;
				const roster = this.deps.roster.sources(hit.trigger);
				if (roster.length === 0) {
					this.stopFetch();
					this.reduce({ type: "close" });
					return;
				}
				if (launched || !prev.open || prev.hit === null || prev.hit.trigger !== hit.trigger) this.menu.set(seedGroups(this.menu.getSnapshot(), roster));
				this.reduce({
					type: "hit",
					hit
				});
				this.refreshHeaders(hit, roster);
				this.fetchCandidates(hit, roster);
			}
			/**
			* Toggle a menu containing exactly one registered source. The supplied hit
			* is a synthetic selection span rather than a typed trigger token, but
			* picks deliberately reuse the ordinary source callback and scoped input
			* mutation pipeline.
			* @param source - registered source name under `hit.trigger`.
			* @param hit - synthetic hit carrying position and pick-time draft CAS.
			*/
			toggleSource(source, hit) {
				if (this.disposed) return;
				if (this.launcher.getSnapshot() === source && this.menu.getSnapshot().open) {
					this.dismiss();
					return;
				}
				const match = this.deps.roster.sources(hit.trigger).find((item) => item.name === source);
				if (match === void 0) {
					this.dismiss();
					return;
				}
				this.stopFetch();
				this.hit = hit;
				this.launcher.set(source);
				this.menu.set(seedGroups(this.menu.getSnapshot(), [match]));
				this.reduce({
					type: "hit",
					hit
				});
				this.refreshHeaders(hit, [match]);
				this.fetchCandidates(hit, [match]);
			}
			/**
			* Pointer pick from MenuView: route the clicked candidate through onPick
			* and execute claim/insert outcomes via the scoped input events.
			* @param source - source (group) name.
			* @param index - candidate index within the group.
			* @param action - settling pick (default) or the candidate's drill action.
			*/
			pick(source, index, action = "pick") {
				const state = this.menu.getSnapshot();
				const hit = this.hit;
				if (this.disposed || !state.open || hit === null) return;
				const group = state.groups.find((g) => g.source === source);
				const candidate = group !== void 0 && group.status === "ready" ? group.items[index] : void 0;
				if (candidate === void 0) return;
				const src = this.deps.roster.sources(hit.trigger).find((s) => s.name === source);
				if (src === void 0) return;
				this.settle(src, candidate, hit, action);
			}
			/**
			* Pointer pick on one crumb of a source's menu header: route it through the
			* same drill path a folder row takes, so returning to a step and descending
			* into one share one outcome.
			* @param source - source (group) name.
			* @param index - crumb index within that source's published header.
			*/
			pickCrumb(source, index) {
				const hit = this.hit;
				if (this.disposed || !this.menu.getSnapshot().open || hit === null) return;
				const crumb = this.headers.getSnapshot().get(source)?.[index];
				if (crumb === void 0 || crumb.current === true) return;
				const src = this.deps.roster.sources(hit.trigger).find((s) => s.name === source);
				if (src === void 0) return;
				this.settle(src, {
					name: crumb.label,
					value: crumb.value
				}, hit, "drill");
			}
			/**
			* Pointer hover from MenuView: park the shared highlight on the hovered
			* candidate (keyboard `move` and pointer hover drive one highlight —
			* last input wins).
			* @param source - source (group) name.
			* @param index - candidate index within the group.
			*/
			hover(source, index) {
				if (this.disposed) return;
				this.reduce({
					type: "hover",
					source,
					index
				});
			}
			/**
			* Keyboard arbitration while the menu is open.
			* @param key - intercepted key.
			* @param composing - inside IME composition: everything passes.
			* @returns `pass` when the browser keeps the key (closed menu, no
			* highlight, or a vanished candidate), `consumed` when the menu handled
			* the key without a settling pick (move, close, drill descent, or a
			* pending-refinement no-op), or `pick-highlighted` when the highlighted
			* candidate settled and the menu closed.
			*/
			arbitrate(key, composing) {
				if (composing || this.disposed) return "pass";
				const state = this.menu.getSnapshot();
				if (!state.open) return "pass";
				switch (key) {
					case "up":
						this.reduce({
							type: "move",
							dir: -1
						});
						return "consumed";
					case "down":
						this.reduce({
							type: "move",
							dir: 1
						});
						return "consumed";
					case "escape":
					case "tabBack":
						this.rememberDismissed();
						this.stopFetch();
						this.reduce({ type: "close" });
						return "consumed";
					case "enter": {
						if (state.highlight === null) return "pass";
						const group = state.groups.find((g) => g.source === state.highlight?.source);
						if (group === void 0 || group.status !== "ready") return "consumed";
export {};
