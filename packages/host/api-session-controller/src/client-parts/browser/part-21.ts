/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/sessions/assistant-stream.js
		/** Web presentation fold joining transient Assistant frames to one durable v2 settlement. */
		/** Keeps transient Assistant presentation behind one settlement-aware interface. */
		var ClientAssistantStream = class {
			activeAttempt;
			retainedAttempt;
			pending = /* @__PURE__ */ new Map();
			publishedSeqs = /* @__PURE__ */ new Set();
			durableCursor = -1;
			transientInGap = 0;
			/**
			* Replace the durable Web window and adopt an optional reconnect baseline.
			* @param entries - durable entries in the replacement window.
			* @param baseline - compact prefix for an Assistant attempt that is still live.
			* @returns immediately visible durable entries plus reconstructed transient chunks.
			*/
			replace(entries, baseline) {
				this.pending.clear();
				this.transientInGap = 0;
				this.activeAttempt = void 0;
				this.retainedAttempt = void 0;
				const opening = baseline?.activeAttempt;
				if (opening !== void 0) this.activeAttempt = {
					attemptId: opening.attemptId,
					startedAfterSeq: opening.startedAfterSeq,
					turn: opening.turn,
					step: opening.step,
					nextIndex: opening.nextIndex
				};
				const visible = [...entries];
				this.publishedSeqs = new Set(visible.map((entry) => entry.event.seq));
				this.durableCursor = visible.reduce((cursor, entry) => Math.max(cursor, entry.event.seq), -1);
				if (opening !== void 0) for (const [index, member] of expandAssistantStream(opening.stream).entries()) {
					this.transientInGap += 1;
					visible.push({
						type: "transient",
						event: {
							type: "assistant/live-chunk",
							seq: this.durableCursor + 1 - 1 / (this.transientInGap + 1),
							time: member.time,
							data: {
								attemptId: opening.attemptId,
								turn: opening.turn,
								step: opening.step,
								chunk: member.chunk
							}
						}
					});
					if (index + 1 >= opening.nextIndex) break;
				}
				return visible;
			}
			/**
			* Stage one durable v2 settlement while its matching live attempt is open.
			* @param entry - newly followed durable entry.
			* @returns a publication decision, or `undefined` when no entry becomes visible.
			*/
			acceptDurable(entry) {
				const event = entry.event;
				this.durableCursor = Math.max(this.durableCursor, event.seq);
				this.transientInGap = 0;
				const settlement = assistantSettlementEntry(entry);
				if (settlement !== void 0 && this.attemptForSettlement(settlement.event) !== void 0) {
					if (this.pending.has(event.seq)) return { type: "rebaseline" };
					this.pending.set(event.seq, settlement);
					return;
				}
				return this.publish(entry);
			}
			/**
			* Fold one dense transient frame and release its named durable settlement.
			* Successful messages retain their transient rows until the owning Step ends;
			* interrupted messages, failed attempts, and abandonment retire them immediately.
			* @param frame - next Assistant stream frame received by the follow connection.
			* @returns a transient, publication, or rebaseline decision, or `undefined` when no entry becomes visible.
			*/
			acceptFrame(frame) {
				switch (frame.type) {
					case "start":
						if (this.activeAttempt !== void 0 || this.retainedAttempt !== void 0 || this.pending.size > 0) return { type: "rebaseline" };
						this.pending.clear();
						this.activeAttempt = {
							attemptId: frame.attemptId,
							startedAfterSeq: frame.startedAfterSeq,
							turn: frame.turn,
							step: frame.step,
							nextIndex: 0
						};
						return;
					case "chunk": {
						const attempt = this.activeAttempt;
						if (attempt === void 0 || attempt.attemptId !== frame.attemptId) return void 0;
						if (frame.index !== attempt.nextIndex) return { type: "rebaseline" };
						attempt.nextIndex += 1;
						this.transientInGap += 1;
						return {
							type: "transient",
							entry: {
								type: "transient",
								event: {
									type: "assistant/live-chunk",
									seq: this.durableCursor + 1 - 1 / (this.transientInGap + 1),
									time: frame.time,
									data: {
										attemptId: frame.attemptId,
										turn: attempt.turn,
										step: attempt.step,
										chunk: frame.chunk
									}
								}
							}
						};
					}
					case "end": {
						const attempt = this.activeAttempt;
						if (attempt === void 0 || attempt.attemptId !== frame.attemptId) return;
						this.activeAttempt = void 0;
						if (frame.index !== attempt.nextIndex) return { type: "rebaseline" };
						if (frame.outcome.kind === "abandoned") return this.pending.size === 0 ? {
							type: "abandonment",
							attemptId: attempt.attemptId
						} : { type: "rebaseline" };
						if (this.publishedSeqs.has(frame.outcome.seq)) return void 0;
						const entry = this.pending.get(frame.outcome.seq);
						if (entry === void 0 || entry.event.type !== frame.outcome.eventType) return { type: "rebaseline" };
						this.pending.delete(frame.outcome.seq);
						if (entry.event.type === "assistant/message" && entry.event.data.interrupted !== true) {
							this.retainedAttempt = {
								attemptId: attempt.attemptId,
								turn: attempt.turn,
								step: attempt.step
							};
							return this.publish(entry);
						}
						this.publishedSeqs.add(entry.event.seq);
						return {
							type: "settlement",
							attemptId: attempt.attemptId,
							entry
						};
					}
				}
			}
			attemptForSettlement(event) {
				const attempt = this.activeAttempt;
				if (attempt === void 0 || event.type === "assistant/message" && event.surfaceOp !== "append" || event.seq <= attempt.startedAfterSeq || attempt.turn !== event.data.turn || attempt.step !== event.data.step) return void 0;
				return attempt;
			}
			publish(entry) {
				this.publishedSeqs.add(entry.event.seq);
				const retained = this.retainedAttempt;
				if (retained !== void 0 && entry.event.type === "step/end" && entry.event.data.turn === retained.turn && entry.event.data.step === retained.step) {
					this.retainedAttempt = void 0;
					return {
						type: "publish",
						entry,
						retireAttemptId: retained.attemptId
					};
				}
				return {
					type: "publish",
					entry
				};
			}
		};
		function assistantSettlementEntry(entry) {
			return entry.event.type === "assistant/message" || entry.event.type === "assistant/attempt" ? entry : void 0;
		}
		//#endregion

export {};
