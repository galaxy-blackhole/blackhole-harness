/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				return this.mutableStepData(stepDataKey(turn, step));
			}
			mutableTurnData(turn) {
				const current = this.turnDataStores.get(turn) ?? this.createDataStore(turn);
				this.turnDataStores.set(turn, current);
				return current;
			}
			mutableStepData(key) {
				const current = this.stepDataStores.get(key) ?? this.createDataStore(Number(key.slice(0, key.indexOf(":"))));
				this.stepDataStores.set(key, current);
				return current;
			}
			createDataStore(turn) {
				return new MutableLocationDataStore((store) => {
					this.dirtyDataStores.add(store);
					this.changedTurns.add(turn);
				});
			}
			storeFor(data) {
				return data.kind === "turn" ? this.mutableTurnData(data.turn) : this.mutableStepData(stepDataKey(data.turn, requireStep(data)));
			}
			resolve(seq) {
				const coordinates = this.coordinates.get(seq);
				if (coordinates?.turn === void 0) return SESSION_LOCATION;
				const turn = this.timeline.turns.get(coordinates.turn);
				if (turn === void 0) return UNRESOLVED_LOCATION;
				if (coordinates.step === void 0) return {
					kind: "turn",
					turn
				};
				const step = this.stepsByTurn.get(coordinates.turn)?.get(coordinates.step);
				return step === void 0 ? {
					kind: "turn",
					turn
				} : {
					kind: "step",
					turn,
					step
				};
			}
		};
		function stepDataKey(turn, step) {
			return `${turn}:${step}`;
		}
		function requireStep(data) {
			if (data.kind === "step" && data.step !== void 0) return data.step;
			throw new Error(`conversation Step data "${data.key}" requires a step`);
		}
		//#endregion
		//#region lib/types/client/conversation/assembler.js
		const PUBLICATION_RANK = {
			none: 0,
			"animation-frame": 1,
			immediate: 2
		};
		const LOCATION_DATA_SCOPES = ["step", "turn"];
		function emptyLocationData() {
			return {
				step: null,
				turn: null
			};
		}
		function maximumPublication(left, right) {
			return PUBLICATION_RANK[left] >= PUBLICATION_RANK[right] ? left : right;
		}
		function startSeq(context) {
			return context.startSeq;
		}
		function insertionIndex(contexts, seq) {
			let low = 0;
			let high = contexts.length;
			while (low < high) {
				const middle = low + Math.floor((high - low) / 2);
				const candidate = contexts[middle];
				if (candidate !== void 0 && candidate.startSeq < seq) low = middle + 1;
				else high = middle;
			}
			return low;
		}
		function contextSnapshot(context) {
			return {
				key: context.key,
				kind: context.kind,
				id: context.id,
				matches: context.matches,
				start: context.start,
				state: context.state,
				current: context.current
			};
		}
		function mergeMatches(key, additions, existing) {
			const merged = [];
			let added = 0;
			let current = 0;
			while (added < additions.length || current < existing.length) {
				const left = additions[added];
				const right = existing[current];
				if (left !== void 0 && right !== void 0 && left.event.seq === right.event.seq) throw new Error(`conversation Context ${key} received duplicate Match ${left.event.seq}`);
				if (right === void 0 || left !== void 0 && left.event.seq < right.event.seq) {
					merged.push(left);
					added++;
				} else {
					merged.push(right);
					current++;
				}
			}
			return merged;
		}
		function conversationMatch(input, role, location) {
			return {
				event: input.event,
				role,
				location
			};
		}
		const NO_GROUPS = {
			entries: () => [],
			forTarget: () => void 0
		};
		/**
		* Session-owned incremental engine that assembles business Contexts from a
		* contiguous Event window and materializes registered view snapshots.
		*/
		var ConversationNodeAssembler = class {
			eventDefinitions;
			viewDefinitions;
			groupDefinitions;
			contexts = /* @__PURE__ */ new Map();
			contextsByKind = /* @__PURE__ */ new Map();
			contextsBySeq = /* @__PURE__ */ new Map();
			contextsByTarget = /* @__PURE__ */ new Map();
			inputs = /* @__PURE__ */ new Map();
			locationIndex = new ConversationLocationIndex();
			dirty = /* @__PURE__ */ new Set();
			dirtyByTarget = /* @__PURE__ */ new Map();
			revised = /* @__PURE__ */ new Set();
			dependents = /* @__PURE__ */ new Map();
			views = /* @__PURE__ */ new Map();
			groups = /* @__PURE__ */ new Map();
			pendingGroupStores = /* @__PURE__ */ new Set();
			activeTargets = /* @__PURE__ */ new Set();
			/** Matches of the event in dispatch, kept by index; dispatch is not reentrant and reuses both arrays. */
			matchedDefinitions = [];
			matchedResults = [];
			hasMore = false;
			replacePending = true;
			timelineDirty = true;
			/**
			* @param eventDefinitions - live Event Definition registry.
			* @param viewDefinitions - live view builder registry.
			* @param groupDefinitions - optional registered grouping rules, independent of presentation modes.
			*/
			constructor(eventDefinitions, viewDefinitions, groupDefinitions = NO_GROUPS) {
				this.eventDefinitions = eventDefinitions;
				this.viewDefinitions = viewDefinitions;
				this.groupDefinitions = groupDefinitions;
				this.resetViewBuilders();
			}
			/**
			* Read the current open turn without activating a View.
			* @returns the latest turn number when its start is loaded and it remains open, otherwise undefined.
			*/
			openTurn() {
				const snapshot = this.locationIndex.snapshot();
				const latest = snapshot.turnOrder.at(-1);
				const turn = latest === void 0 ? void 0 : snapshot.turns.get(latest);
				return turn?.status === "open" && turn.start !== void 0 ? turn.turn : void 0;
			}
			/**
			* Replace the complete loaded window after open, resync, or gap repair.
			* @param entries - complete contiguous window.
			* @param hasMore - whether older history remains outside the window.
			* @returns immediate publication request.
			*/
			replaceWindow(entries, hasMore) {
				this.contexts.clear();
				this.contextsByKind.clear();
				this.contextsBySeq.clear();
				this.contextsByTarget.clear();
				this.inputs.clear();
				this.dirty.clear();
				this.dirtyByTarget.clear();
				this.revised.clear();
				this.dependents.clear();
				this.hasMore = hasMore;
				const sorted = [...entries].sort((left, right) => left.event.seq - right.event.seq);
				for (const entry of sorted) this.inputs.set(entry.event.seq, entry);
				this.locationIndex.rebuild(sorted);
				this.timelineDirty = true;
				for (const entry of sorted) this.matchInput(entry);
				this.replayDependencies();
				this.revised.clear();
				for (const context of this.contexts.values()) this.markDirty(context);
				this.replacePending = true;
				return "immediate";
			}
			/**
			* Add one contiguous live tail event without scanning existing Contexts.
			* @param record - appended Session event entry.
			* @returns highest requested publication cadence.
			*/
			append(record) {
				const event = record.event;
				if (this.inputs.has(event.seq)) return "none";
				if (this.revised.size > 0) this.revised.clear();
				this.inputs.set(event.seq, record);
				let publication = "none";
				if (event.type !== "assistant/live-chunk" && isLocationBoundary(event.type)) {
					const previousTimeline = this.locationIndex.snapshot();
					const changed = this.locationIndex.appendBoundary(event);
					if (this.locationIndex.snapshot() !== previousTimeline) {
						this.timelineDirty = true;
						publication = "immediate";
					}
					this.replayContexts(this.refreshMatchLocations(changed));
					if (changed.size > 0) publication = "immediate";
				} else this.locationIndex.appendNonBoundary(event);
				publication = maximumPublication(publication, this.matchInput(record));
				if (this.replayRevisedDependents()) publication = "immediate";
				if (this.revised.size > 0) this.revised.clear();
				return publication;
			}
			/**
			* Retire one Assistant attempt's transient matches and apply its optional durable settlement.
			* Empty Contexts retain their keys and published nodes until the loaded window is rebuilt;
			* Definitions may hide those nodes when no start remains instead of withdrawing their identities.
			* @param attemptId - process-local attempt whose transient presentation ended.
			* @param entry - durable message or attempt event committed for the stream.
			* @returns highest requested publication cadence.
			*/
			settleAssistant(attemptId, entry) {
				this.revised.clear();
				const retired = [...this.inputs.values()].filter((candidate) => candidate.type === "transient" && candidate.event.data.attemptId === attemptId);
				const retiredSeqs = new Set(retired.map((candidate) => candidate.event.seq));
				const affected = /* @__PURE__ */ new Set();
				for (const seq of retiredSeqs) {
					this.inputs.delete(seq);
					for (const context of this.contextsBySeq.get(seq) ?? []) affected.add(context);
					this.contextsBySeq.delete(seq);
				}
				for (const context of affected) context.matches = context.matches.filter((match) => !retiredSeqs.has(match.event.seq));
				this.locationIndex.removeAssistantTransients(retired.map((candidate) => candidate.event));
				let publication = retired.length === 0 ? "none" : "immediate";
				if (entry !== void 0 && !this.inputs.has(entry.event.seq)) {
					this.inputs.set(entry.event.seq, entry);
					this.locationIndex.insertAssistantSettlement(entry.event);
					const pending = /* @__PURE__ */ new Map();
					publication = maximumPublication(publication, this.collectInput(entry, pending));
					this.applyPendingMatches(pending, affected);
				}
				this.replayContexts(affected);
				if (this.replayRevisedDependents()) publication = "immediate";
				this.revised.clear();
				return publication;
			}
			/**
			* Add an older page while preserving existing Context and view identities.
			* @param entries - newly loaded older Events.
			* @param hasMore - whether history still precedes the expanded window.
			* @returns highest requested publication cadence.
			*/
			prepend(entries, hasMore) {
				this.revised.clear();
				let publication = "none";
				const previousHasMore = this.hasMore;
				const fresh = entries.filter((entry) => !this.inputs.has(entry.event.seq)).sort((left, right) => left.event.seq - right.event.seq);
				for (const entry of fresh) this.inputs.set(entry.event.seq, entry);
				this.hasMore = hasMore;
				const previousTimeline = this.locationIndex.snapshot();
				const changedLocations = this.locationIndex.rebuild(this.sortedInputs());
				if (this.locationIndex.snapshot() !== previousTimeline) this.timelineDirty = true;
				const affected = this.refreshMatchLocations(changedLocations);
				const pending = /* @__PURE__ */ new Map();
				for (const entry of fresh) publication = maximumPublication(publication, this.collectInput(entry, pending));
				this.applyPendingMatches(pending, affected);
				this.replayContexts(affected);
				if ((this.revised.size > 0 || previousHasMore !== hasMore) && this.replayDependencies()) publication = "immediate";
				if (changedLocations.size > 0) publication = "immediate";
				this.revised.clear();
				return publication;
			}
			/**
			* Rebuild against the current Registry set after a low-frequency plugin change.
			* @returns immediate publication request.
			*/
			rebuildRegistry() {
				this.resetViewBuilders();
				return this.replaceWindow(this.sortedInputs(), this.hasMore);
			}
			/**
			* Materialize dirty Contexts and advance every active view builder.
			* @returns whether any view snapshot was rebuilt or incrementally applied.
			*/
			flush() {
				if (!this.replacePending && this.dirty.size === 0 && !this.timelineDirty) return false;
				if (this.replacePending) {
					this.replaceLocationData();
					const updated = [];
					const changedTurns = this.locationIndex.takeChangedTurns();
					for (const target of this.activeTargets) {
						const view = this.views.get(target);
						if (view === void 0) continue;
						this.updateView(view, true, this.buildTargetNodes(target, this.contextsByTarget.get(target)), changedTurns);
						updated.push(view);
					}
					this.replacePending = false;
					this.dirty.clear();
					this.dirtyByTarget.clear();
					this.timelineDirty = false;
					return this.publishViews(updated);
				}
				const updated = [];
				if (this.applyDirtyLocationData()) this.timelineDirty = true;
				const changedTurns = this.locationIndex.takeChangedTurns();
				const timelineDirty = this.timelineDirty;
				for (const target of this.activeTargets) {
					const view = this.views.get(target);
					if (view === void 0) continue;
					if (view.builder === void 0) continue;
					const upserts = this.buildTargetUpserts(target, this.dirtyByTarget.get(target));
					if (upserts.length === 0 && !timelineDirty) continue;
					this.updateView(view, false, upserts, changedTurns);
					updated.push(view);
				}
				this.dirty.clear();
				this.dirtyByTarget.clear();
				this.timelineDirty = false;
				return this.publishViews(updated);
			}
			/**
			* Add one target to the monotonic active set and materialize its current snapshot.
			* Pending Context work is flushed before the first complete replacement.
			* @param target - registered or subsequently registered view target.
			* @returns whether any active target snapshot changed.
			*/
			activateTarget(target) {
				const view = this.views.get(target);
				if (this.activeTargets.has(target)) return false;
				const published = this.flush();
				this.activeTargets.add(target);
				if (view === void 0) return published;
				this.replaceView(view);
				this.publishViews([view]);
				return true;
			}
			/**
			* Read the latest snapshot of a registered target.
			* @param target - registered view target.
			* @returns target snapshot, or undefined before registration or activation.
			*/
			snapshot(target) {
				return this.views.get(target)?.snapshot;
			}
			get(target) {
				return this.snapshot(target);
			}
			grouped(target) {
				return this.groups.get(target)?.store;
			}
			/**
			* Read targets whose owners classify their latest snapshot as visible activity.
			* @returns target ids contributing visible activity.
			*/
			activityTargets() {
				const active = /* @__PURE__ */ new Set();
				for (const target of this.activeTargets) {
					const view = this.views.get(target);
					if (view === void 0) continue;
					if (view.isActive?.(view.snapshot) === true) active.add(view.target);
				}
				return active;
			}
			sortedInputs() {
				return [...this.inputs.values()].sort((left, right) => left.event.seq - right.event.seq);
			}
			matchInput(input) {
				return this.dispatchInput(input, this.acceptMatch);
			}
			collectInput(input, pending) {
				return this.dispatchInput(input, (definition, id, match) => {
					const key = conversationContextKey(definition.kind, id);
					const matches = pending.get(key) ?? [];
					matches.push({
						definition,
						id,
						match
					});
					pending.set(key, matches);
					return definition.publication?.(match) ?? "immediate";
				});
			}
			dispatchInput(input, accept) {
				const event = input.event;
				let startMatch;
				let updateMatch;
				let location;
				const matchFor = (role) => {
					location ??= this.locationIndex.locationOf(event);
					return role === "start" ? startMatch ??= conversationMatch(input, role, location) : updateMatch ??= conversationMatch(input, role, location);
				};
export {};
