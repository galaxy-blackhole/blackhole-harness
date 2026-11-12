/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		function payloadCoordinates(event) {
			const data = event.data;
			if (data.turn === null) return {
				session: true,
				location: void 0
			};
			const turn = Number.isSafeInteger(data.turn) && data.turn >= 0 ? data.turn : void 0;
			const step = Number.isSafeInteger(data.step) && data.step >= 0 ? data.step : void 0;
			if (turn === void 0) return step === void 0 ? { location: void 0 } : {
				step,
				location: void 0
			};
			return step === void 0 ? {
				turn,
				location: void 0
			} : {
				turn,
				step,
				location: void 0
			};
		}
		function sameReferences(left, right) {
			return left.length === right.length && left.every((value, index) => value === right[index]);
		}
		function sameStep(left, right) {
			return left !== void 0 && left.start === right.start && left.end === right.end && left.status === right.status && left.data === right.data;
		}
		function sameTurn(left, right) {
			return left !== void 0 && left.start === right.start && left.end === right.end && left.status === right.status && left.data === right.data && sameReferences(left.steps, right.steps);
		}
		function sameLocation(left, right) {
			if (left === void 0 || right === void 0 || left.kind !== right.kind) return left === right;
			if (left.kind === "session" || left.kind === "unresolved") return true;
			if (right.kind === "session" || right.kind === "unresolved") return false;
			if (left.kind === "turn" || right.kind === "turn") return left.kind === "turn" && right.kind === "turn" && left.turn === right.turn;
			return left.turn === right.turn && left.step === right.step;
		}
		/** Session-owned Turn/Step timeline and event-to-Location index. */
		var ConversationLocationIndex = class {
			coordinates = /* @__PURE__ */ new Map();
			seqsByTurn = /* @__PURE__ */ new Map();
			stepsByTurn = /* @__PURE__ */ new Map();
			timeline = {
				turnOrder: [],
				turns: /* @__PURE__ */ new Map()
			};
			turnDataStores = /* @__PURE__ */ new Map();
			stepDataStores = /* @__PURE__ */ new Map();
			dirtyDataStores = /* @__PURE__ */ new Set();
			changedTurns = /* @__PURE__ */ new Set();
			currentTurn;
			currentStep;
			/**
			* Return the current reference-stable timeline.
			* @returns current timeline snapshot.
			*/
			snapshot() {
				return this.timeline;
			}
			/**
			* Drain the Turn changes accumulated for one assembly flush.
			* @returns Turn identities changed since the preceding drain.
			*/
			takeChangedTurns() {
				const turns = [...this.changedTurns];
				this.changedTurns.clear();
				return turns;
			}
			/**
			* Replace all Definition-owned Location values while preserving reader identities.
			* @param entries - complete current set of Definition-owned Location values.
			* @returns whether any published Location data changed.
			*/
			replaceData(entries) {
				const turns = /* @__PURE__ */ new Map();
				const steps = /* @__PURE__ */ new Map();
				for (const { owner, data } of entries) {
					const values = data.kind === "turn" ? turns.get(data.turn) ?? /* @__PURE__ */ new Map() : steps.get(stepDataKey(data.turn, requireStep(data))) ?? /* @__PURE__ */ new Map();
					const current = values.get(data.key);
					if (current !== void 0 && current.owner !== owner) throw new Error(`conversation Location data "${data.key}" is already owned by ${current.owner}`);
					values.set(data.key, {
						owner,
						value: data.value
					});
					if (data.kind === "turn") turns.set(data.turn, values);
					else steps.set(stepDataKey(data.turn, requireStep(data)), values);
				}
				let changed = false;
				for (const turn of new Set([...this.turnDataStores.keys(), ...turns.keys()])) changed = this.mutableTurnData(turn).replace(turns.get(turn) ?? /* @__PURE__ */ new Map()) || changed;
				for (const step of new Set([...this.stepDataStores.keys(), ...steps.keys()])) changed = this.mutableStepData(step).replace(steps.get(step) ?? /* @__PURE__ */ new Map()) || changed;
				return changed;
			}
			/**
			* Apply changed Context publications without rebuilding Turn/Step membership.
			* @param changes - incremental removals and replacements from published Contexts.
			* @returns whether any published Location data changed.
			*/
			applyData(changes) {
				let changed = false;
				for (const change of changes) {
					const previous = change.previous;
					if (previous === null) continue;
					changed = this.storeFor(previous).remove(change.owner, previous.key) || changed;
				}
				for (const change of changes) {
					const next = change.next;
					if (next === null) continue;
					changed = this.storeFor(next).set(change.owner, next.key, next.value) || changed;
				}
				return changed;
			}
			/** Publish committed Location-data changes to their keyed sources. */
			publishData() {
				const dirty = [...this.dirtyDataStores];
				this.dirtyDataStores.clear();
				for (const store of dirty) store.publish();
			}
			/**
			* Resolve the latest Location for one event.
			* @param event - event already ingested into this index.
			* @returns current Location, falling back to session when it has no Turn/Step affinity.
			*/
			locationOf(event) {
				return this.coordinates.get(event.seq)?.location ?? SESSION_LOCATION;
			}
			/**
			* Rebuild timeline facts after replace/prepend or a boundary append.
			* @param entries - complete current window in ascending seq order.
			* @returns seqs whose resolved Location changed.
			*/
			rebuild(entries) {
				const previousCoordinates = this.coordinates;
				const turns = /* @__PURE__ */ new Map();
				const coordinates = /* @__PURE__ */ new Map();
				let currentTurn;
				let currentStep;
				const turnDraft = (turn, seq) => {
					let draft = turns.get(turn);
					if (draft === void 0) {
						draft = {
							turn,
							firstSeq: seq,
							steps: /* @__PURE__ */ new Map()
						};
						turns.set(turn, draft);
					} else draft.firstSeq = Math.min(draft.firstSeq, seq);
					return draft;
				};
				const stepDraft = (turn, step, seq) => {
					const owner = turnDraft(turn, seq);
					let draft = owner.steps.get(step);
					if (draft === void 0) {
						draft = {
							turn,
							step,
							firstSeq: seq
						};
						owner.steps.set(step, draft);
					} else draft.firstSeq = Math.min(draft.firstSeq, seq);
					return draft;
				};
				for (const { event } of entries) {
					const explicit = payloadCoordinates(event);
					if (event.type === "turn/start") {
						currentTurn = event.data.turn;
						currentStep = void 0;
					}
					if (event.type === "step/start") {
						currentTurn = event.data.turn;
						currentStep = event.data.step;
					}
					if (explicit.session !== true && explicit.turn !== void 0) {
						if (currentTurn !== explicit.turn) currentStep = void 0;
						currentTurn = explicit.turn;
						if (explicit.step !== void 0) currentStep = explicit.step;
					}
					const turn = explicit.session === true ? void 0 : explicit.turn ?? currentTurn;
					const step = explicit.session === true || event.type === "turn/start" || event.type === "turn/end" ? void 0 : explicit.step ?? (turn === currentTurn ? currentStep : void 0);
					coordinates.set(event.seq, {
						...turn === void 0 ? {} : { turn },
						...turn === void 0 || step === void 0 ? {} : { step },
						location: void 0
					});
					if (turn !== void 0) turnDraft(turn, event.seq);
					if (turn !== void 0 && step !== void 0) stepDraft(turn, step, event.seq);
					if (event.type === "turn/start") turnDraft(event.data.turn, event.seq).start = event;
					else if (event.type === "turn/end") turnDraft(event.data.turn, event.seq).end = event;
					else if (event.type === "step/start") stepDraft(event.data.turn, event.data.step, event.seq).start = event;
					else if (event.type === "step/end") stepDraft(event.data.turn, event.data.step, event.seq).end = event;
					if (event.type === "step/end" && currentTurn === event.data.turn && currentStep === event.data.step) currentStep = void 0;
					if (event.type === "turn/end" && currentTurn === event.data.turn) {
						currentTurn = void 0;
						currentStep = void 0;
					}
				}
				const previousTurns = this.timeline.turns;
				const nextTurns = /* @__PURE__ */ new Map();
				const orderedDrafts = [...turns.values()].sort((left, right) => left.firstSeq - right.firstSeq);
				for (const draft of orderedDrafts) {
					const previousTurn = previousTurns.get(draft.turn);
					const previousSteps = new Map(previousTurn?.steps.map((step) => [step.step, step]) ?? []);
					const steps = [...draft.steps.values()].sort((left, right) => left.firstSeq - right.firstSeq).map((candidate) => {
						const value = {
							turn: candidate.turn,
							step: candidate.step,
							start: candidate.start,
							end: candidate.end,
							status: candidate.end !== void 0 ? "closed" : candidate.start === void 0 ? "unknown" : "open",
							data: this.stepData(candidate.turn, candidate.step)
						};
						const previous = previousSteps.get(candidate.step);
						return sameStep(previous, value) ? previous : value;
					});
					const value = {
						turn: draft.turn,
						start: draft.start,
						end: draft.end,
						status: draft.end !== void 0 ? "closed" : draft.start === void 0 ? "unknown" : "open",
						steps,
						data: this.turnData(draft.turn)
					};
					nextTurns.set(draft.turn, sameTurn(previousTurn, value) ? previousTurn : value);
				}
				const nextOrder = orderedDrafts.map((draft) => draft.turn);
				const turnOrder = this.timeline.turnOrder.length === nextOrder.length && this.timeline.turnOrder.every((turn, index) => turn === nextOrder[index]) ? this.timeline.turnOrder : nextOrder;
				let sameMap = previousTurns.size === nextTurns.size;
				if (sameMap) {
					for (const [turn, value] of nextTurns) if (previousTurns.get(turn) !== value) {
						sameMap = false;
						break;
					}
				}
				for (const turn of new Set([...previousTurns.keys(), ...nextTurns.keys()])) if (previousTurns.get(turn) !== nextTurns.get(turn)) this.changedTurns.add(turn);
				this.timeline = sameMap && turnOrder === this.timeline.turnOrder ? this.timeline : {
					turnOrder,
					turns: nextTurns
				};
				this.stepsByTurn.clear();
				for (const [number, turn] of this.timeline.turns) this.stepsByTurn.set(number, new Map(turn.steps.map((step) => [step.step, step])));
				this.coordinates = coordinates;
				this.seqsByTurn = /* @__PURE__ */ new Map();
				for (const { event } of entries) {
					const coordinates = this.coordinates.get(event.seq);
					if (coordinates.turn !== void 0) this.indexTurnSeq(coordinates.turn, event.seq);
					coordinates.location = this.resolve(event.seq);
				}
				this.currentTurn = currentTurn;
				this.currentStep = currentStep;
				const changed = /* @__PURE__ */ new Set();
				for (const { event } of entries) if (!sameLocation(previousCoordinates.get(event.seq)?.location, this.coordinates.get(event.seq)?.location)) changed.add(event.seq);
				return changed;
			}
			/**
			* Append one Turn/Step boundary while revisiting only the owning Turn.
			* @param event - contiguous tail boundary event.
			* @returns seqs whose immutable Location reference changed.
			*/
			appendBoundary(event) {
				if (event.type !== "turn/start" && event.type !== "turn/end" && event.type !== "step/start" && event.type !== "step/end") throw new Error(`conversation Location boundary expected, received ${event.type}`);
				const explicit = payloadCoordinates(event);
				if (event.type === "turn/start") {
					this.currentTurn = event.data.turn;
					this.currentStep = void 0;
				} else if (event.type === "step/start") {
					this.currentTurn = event.data.turn;
					this.currentStep = event.data.step;
				}
				if (explicit.turn !== void 0) {
					if (this.currentTurn !== explicit.turn) this.currentStep = void 0;
					this.currentTurn = explicit.turn;
					if (explicit.step !== void 0) this.currentStep = explicit.step;
				}
				const turnNumber = explicit.turn ?? this.currentTurn;
				if (turnNumber === void 0) throw new Error(`conversation boundary ${event.type} has no turn`);
				const stepNumber = event.type === "turn/start" || event.type === "turn/end" ? void 0 : explicit.step ?? (turnNumber === this.currentTurn ? this.currentStep : void 0);
				this.coordinates.set(event.seq, {
					turn: turnNumber,
					...stepNumber === void 0 ? {} : { step: stepNumber },
					location: this.coordinates.get(event.seq)?.location
				});
				this.indexTurnSeq(turnNumber, event.seq);
				const previousTurn = this.timeline.turns.get(turnNumber);
				let steps = previousTurn?.steps ?? [];
				if (event.type === "step/start" || event.type === "step/end") {
					const number = event.data.step;
					const indexedSteps = this.stepsByTurn.get(turnNumber) ?? /* @__PURE__ */ new Map();
					const previousStep = indexedSteps.get(number);
					const candidate = {
						turn: turnNumber,
						step: number,
						start: event.type === "step/start" ? event : previousStep?.start,
						end: event.type === "step/end" ? event : previousStep?.end,
						status: event.type === "step/end" || previousStep?.end !== void 0 ? "closed" : "open",
						data: this.stepData(turnNumber, number)
					};
					const nextStep = sameStep(previousStep, candidate) ? previousStep : candidate;
					indexedSteps.set(number, nextStep);
					this.stepsByTurn.set(turnNumber, indexedSteps);
					const index = steps.findIndex((step) => step.step === number);
					steps = index < 0 ? [...steps, nextStep] : steps.map((step, at) => at === index ? nextStep : step);
				}
				const candidate = {
					turn: turnNumber,
					start: event.type === "turn/start" ? event : previousTurn?.start,
					end: event.type === "turn/end" ? event : previousTurn?.end,
					status: event.type === "turn/end" || previousTurn?.end !== void 0 ? "closed" : event.type === "turn/start" || previousTurn?.start !== void 0 ? "open" : "unknown",
					steps,
					data: this.turnData(turnNumber)
				};
				const turn = sameTurn(previousTurn, candidate) ? previousTurn : candidate;
				const turns = new Map(this.timeline.turns);
				turns.set(turnNumber, turn);
				const turnOrder = previousTurn === void 0 ? [...this.timeline.turnOrder, turnNumber] : this.timeline.turnOrder;
				this.timeline = {
					turnOrder,
					turns
				};
				if (turn !== previousTurn) this.changedTurns.add(turnNumber);
				const changed = /* @__PURE__ */ new Set();
				for (const seq of this.seqsByTurn.get(turnNumber) ?? []) {
					const coordinates = this.coordinates.get(seq);
					const previous = coordinates.location;
					const next = this.resolve(seq);
					coordinates.location = next;
					if (!sameLocation(previous, next)) changed.add(seq);
				}
				if (event.type === "step/end" && this.currentTurn === event.data.turn && this.currentStep === event.data.step) this.currentStep = void 0;
				if (event.type === "turn/end" && this.currentTurn === event.data.turn) {
					this.currentTurn = void 0;
					this.currentStep = void 0;
				}
				return changed;
			}
			/**
			* Index one non-boundary tail event without scanning the window or the Turn's Steps.
			* @param event - contiguous appended event.
			*/
			appendNonBoundary(event) {
				const explicit = payloadCoordinates(event);
				if (explicit.session === true) {
					this.coordinates.set(event.seq, { location: SESSION_LOCATION });
					return;
				}
				if (explicit.turn !== void 0) {
					if (this.currentTurn !== explicit.turn) this.currentStep = void 0;
					this.currentTurn = explicit.turn;
					if (explicit.step !== void 0) this.currentStep = explicit.step;
				}
				const turn = explicit.turn ?? this.currentTurn;
				const step = explicit.step ?? (turn === this.currentTurn ? this.currentStep : void 0);
				const coordinates = explicit.turn !== void 0 && explicit.step !== void 0 ? explicit : {
					...turn === void 0 ? {} : { turn },
					...turn === void 0 || step === void 0 ? {} : { step },
					location: void 0
				};
				this.coordinates.set(event.seq, coordinates);
				if (turn !== void 0) this.indexTurnSeq(turn, event.seq);
				coordinates.location = this.resolve(event.seq);
			}
			/**
			* Remove indexed Assistant transients without rebuilding the Turn/Step timeline.
			* @param events - transient events retired by one Assistant settlement.
			*/
			removeAssistantTransients(events) {
				for (const event of events) {
					const turn = this.coordinates.get(event.seq)?.turn;
					if (turn !== void 0) {
						const seqs = this.seqsByTurn.get(turn);
						seqs?.delete(event.seq);
						if (seqs?.size === 0) this.seqsByTurn.delete(turn);
					}
					this.coordinates.delete(event.seq);
				}
			}
			/**
			* Index one durable Assistant settlement inserted before an already visible tail.
			* @param event - message or attempt settlement with explicit Turn and Step coordinates.
			*/
			insertAssistantSettlement(event) {
				const coordinates = {
					turn: event.data.turn,
					step: event.data.step,
					location: void 0
				};
				this.coordinates.set(event.seq, coordinates);
				this.indexTurnSeq(event.data.turn, event.seq);
				coordinates.location = this.resolve(event.seq);
			}
			indexTurnSeq(turn, seq) {
				let current = this.seqsByTurn.get(turn);
				if (current === void 0) {
					current = /* @__PURE__ */ new Set();
					this.seqsByTurn.set(turn, current);
				}
				current.add(seq);
			}
			turnData(turn) {
				return this.mutableTurnData(turn);
			}
			stepData(turn, step) {
export {};
