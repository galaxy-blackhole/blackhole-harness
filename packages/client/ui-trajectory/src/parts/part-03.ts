/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-trajectory/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/trajectory-event-projection.js
		/** Trajectory-owned conversion from durable Session events to ledger view data. */
		function asRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
		}
		function readString(record, key) {
			const value = record[key];
			return typeof value === "string" && value.length > 0 ? value : null;
		}
		function collect(source, member, field) {
			const list = source[member];
			if (!Array.isArray(list)) return [];
			const seen = [];
			for (const entry of list) {
				const record = asRecord(entry);
				const value = record === null ? null : readString(record, field);
				if (value !== null && !seen.includes(value)) seen.push(value);
			}
			return seen;
		}
		function joined(names) {
			return names.length > 0 ? names.join(", ") : null;
		}
		/** Forms Trajectory presents structurally; unknown merge-extensible values remain opaque. */
		const KNOWN_FORMS = [
			"instructions",
			"catalog",
			"snapshot",
			"notice",
			"relay",
			"recall"
		];
		/**
		* Read the target-supported presentation form from a durable message source.
		* @param source - Logged `user/message` source.
		* @returns Supported form, or null for the opaque presentation.
		*/
		function contextForm(source) {
			const record = asRecord(source);
			const form = record === null ? null : readString(record, "form");
			return form !== null && KNOWN_FORMS.includes(form) ? form : null;
		}
		/**
		* Project a durable message source to the Trajectory row's role and producer label.
		* @param source - Logged `user/message` source.
		* @returns Role and label rendered by Trajectory.
		*/
		function contextProducer(source) {
			const record = asRecord(source);
			const kind = record === null ? null : readString(record, "kind");
			if (record === null || kind === null) return {
				role: "inject",
				label: null
			};
			switch (kind) {
				case "session-reference": return {
					role: "recall",
					label: joined(collect(record, "references", "label")) ?? kind
				};
				case "agent-instructions": return {
					role: "inject",
					label: joined(collect(record, "changes", "path")) ?? kind
				};
				case "skill-invocation": return {
					role: "inject",
					label: readString(record, "name") ?? kind
				};
				default: return {
					role: "inject",
					label: kind
				};
			}
		}
		/**
		* Classify finalized Assistant content for Trajectory rendering.
		* @param content - Core content blocks.
		* @returns Trajectory blocks in source order.
		*/
		function toAssistantBlocks(content) {
			return content.map(toAssistantBlock);
		}
		/**
		* Classify one finalized Assistant block for Trajectory rendering.
		* @param block - Core content block.
		* @returns Trajectory block.
		*/
		function toAssistantBlock(block) {
			switch (block.type) {
				case "text": return {
					kind: "text",
					text: block.text
				};
				case "reasoning": return {
					kind: "reasoning",
					text: block.text
				};
				case "image": return {
					kind: "image",
					attachment: block.attachment
				};
				case "tool-call": return {
					kind: "tool-call",
					callId: String(block.id),
					name: block.name,
					argsRaw: block.arguments
				};
				default: return {
					kind: "other",
					block
				};
			}
		}
		/**
		* Create the initial Trajectory block for one streamed Assistant block kind.
		* @param blockType - Wire block kind.
		* @returns Empty block ready to receive deltas.
		*/
		function emptyAssistantBlock(blockType) {
			switch (blockType) {
				case "text": return {
					kind: "text",
					text: ""
				};
				case "reasoning": return {
					kind: "reasoning",
					text: ""
				};
				case "tool-call": return {
					kind: "tool-call",
					callId: "",
					name: "",
					argsRaw: ""
				};
				default: return {
					kind: "other",
					block: null
				};
			}
		}
		/**
		* Convert a durable failure to locale-independent fields safe for Trajectory.
		* @param failure - Failure preserved by a Session event.
		* @returns Sanitized message and optional stable provider code.
		*/
		function displayFailure(failure) {
			if (failure === null || typeof failure !== "object") return { message: String(failure) };
			const record = failure;
			const code = typeof record.code === "string" ? record.code : void 0;
			if (code === "AUTH") return {
				code,
				message: ""
			};
			return {
				...code === void 0 ? {} : { code },
				message: typeof record.message === "string" ? record.message : JSON.stringify(failure)
			};
		}
		/**
		* Whether a stream chunk carries visible model output for Trajectory timing.
		* @param chunk - Stream chunk to inspect.
		* @returns true for a non-empty text, reasoning, or Tool-call delta.
		*/
		function isTokenDelta(chunk) {
			switch (chunk.type) {
				case "text-delta":
				case "reasoning-delta": return chunk.text !== "";
				case "tool-call-delta": return chunk.argumentsDelta !== "" || chunk.name !== void 0;
				default: return false;
			}
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/trajectory-assistant-definition.js
		function initialState(turn, step, startSeq, startTime, started) {
			return {
				turn,
				step,
				startSeq,
				startTime,
				started,
				blocks: [],
				visibleBlocks: 0,
				firstVisibleSeq: void 0,
				firstVisibleTime: void 0,
				firstTokenTime: void 0,
				final: void 0,
				usage: void 0,
				retry: void 0,
				stepEnd: void 0
			};
		}
		function compactBlocks(blocks) {
			return blocks.filter((block) => block !== void 0);
		}
		function blockIsVisible(block) {
			if (block === void 0 || block.kind === "tool-call") return false;
			if (block.kind === "text" || block.kind === "reasoning") return block.text.trim() !== "";
			return true;
		}
		function countVisibleBlocks(blocks) {
			let count = 0;
			for (const block of blocks) if (blockIsVisible(block)) count++;
			return count;
		}
		function hasInterruptionEvidence(blocks) {
			return blocks.some((block) => {
				if (block.kind === "text" || block.kind === "reasoning") return block.text.trim() !== "";
				return true;
			});
		}
		function addUsage$1(current, next) {
			return {
				inputTokens: (current?.inputTokens ?? 0) + next.inputTokens,
				outputTokens: (current?.outputTokens ?? 0) + next.outputTokens,
				...current?.cacheReadTokens === void 0 && next.cacheReadTokens === void 0 ? {} : { cacheReadTokens: (current?.cacheReadTokens ?? 0) + (next.cacheReadTokens ?? 0) },
				...current?.cacheWriteTokens === void 0 && next.cacheWriteTokens === void 0 ? {} : { cacheWriteTokens: (current?.cacheWriteTokens ?? 0) + (next.cacheWriteTokens ?? 0) },
				...current?.reasoningTokens === void 0 && next.reasoningTokens === void 0 ? {} : { reasoningTokens: (current?.reasoningTokens ?? 0) + (next.reasoningTokens ?? 0) }
			};
		}
		function updateChunk(state, chunk, seq, time) {
			if (chunk.type === "usage") return {
				...state,
				usage: addUsage$1(state.usage, chunk.usage)
			};
			const blocks = [...state.blocks];
			let changedIndex = -1;
			let previousVisible = false;
			switch (chunk.type) {
				case "block-start":
					changedIndex = chunk.index;
					previousVisible = blockIsVisible(blocks[chunk.index]);
					blocks[chunk.index] = emptyAssistantBlock(chunk.blockType);
					break;
				case "text-delta": {
					const previous = blocks[chunk.index];
					changedIndex = chunk.index;
					previousVisible = blockIsVisible(previous);
					blocks[chunk.index] = {
						kind: "text",
						text: (previous?.kind === "text" ? previous.text : "") + chunk.text
					};
					break;
				}
				case "reasoning-delta": {
					const previous = blocks[chunk.index];
					changedIndex = chunk.index;
					previousVisible = blockIsVisible(previous);
					blocks[chunk.index] = {
						kind: "reasoning",
						text: (previous?.kind === "reasoning" ? previous.text : "") + chunk.text
					};
					break;
				}
				case "tool-call-delta": {
					const previous = blocks[chunk.index];
					changedIndex = chunk.index;
					previousVisible = blockIsVisible(previous);
					const base = previous?.kind === "tool-call" ? previous : {
						kind: "tool-call",
						callId: "",
						name: "",
						argsRaw: ""
					};
					blocks[chunk.index] = {
						kind: "tool-call",
						callId: base.callId || String(chunk.id),
						name: chunk.name ?? base.name,
						argsRaw: base.argsRaw + chunk.argumentsDelta
					};
					break;
				}
				case "block-end":
					changedIndex = chunk.index;
					previousVisible = blockIsVisible(blocks[chunk.index]);
					blocks[chunk.index] = toAssistantBlock(chunk.block);
					break;
				default: return state;
			}
			const visibleBlocks = state.visibleBlocks - Number(previousVisible) + Number(blockIsVisible(blocks[changedIndex]));
			return {
				...state,
				blocks,
				visibleBlocks,
				...visibleBlocks > 0 && state.firstVisibleSeq === void 0 ? {
					firstVisibleSeq: seq,
					firstVisibleTime: time
				} : {},
				...isTokenDelta(chunk) && state.firstTokenTime === void 0 ? { firstTokenTime: time } : {}
			};
		}
		/** The Step retains its first token across live chunks and settled retry attempts. */
		function settleTiming(state, event) {
			return {
				...state,
				firstTokenTime: state.firstTokenTime ?? assistantStreamFirstTokenTime(event.data.stream)
			};
		}
		function settleMessage(state, match, event) {
			const blocks = toAssistantBlocks(event.data.message.content);
			return {
				...settleTiming(state, event),
				blocks,
				visibleBlocks: countVisibleBlocks(blocks),
				final: match,
				usage: event.data.usage
			};
		}
		function closedBoundary(context) {
			if (context.state?.stepEnd?.event.type === "step/end") return context.state.stepEnd.event;
			const location = context.start?.location ?? context.matches.at(-1)?.location;
			if (location?.kind === "step" && location.step.status === "closed") return location.step.end;
			if ((location?.kind === "step" || location?.kind === "turn") && location.turn.status === "closed") return location.turn.end;
		}
		function fallbackState$1(context) {
			let state;
			for (const match of context.matches) {
				const event = match.event;
				if (event.type === "assistant/live-chunk") {
					state ??= initialState(event.data.turn, event.data.step, event.seq, event.time, false);
					state = updateChunk(state, event.data.chunk, event.seq, event.time);
				} else if (event.type === "assistant/attempt") {
					state ??= initialState(event.data.turn, event.data.step, event.seq, event.time, false);
					state = settleTiming(state, event);
				} else if (event.type === "assistant/message") {
					state ??= initialState(event.data.turn, event.data.step, event.seq, event.time, false);
					state = settleMessage(state, match, event);
				} else if (event.type === "step/end" && state !== void 0) state = {
					...state,
					stepEnd: match
				};
			}
			return state;
		}
		function finalNode(state, context) {
			const final = state.final;
			if (final?.event.type === "assistant/message") {
				const event = final.event;
				return {
					kind: "assistant",
					seq: event.seq,
					messageId: event.data.message.id,
					time: event.time,
					turn: state.turn,
					step: state.step,
					blocks: toAssistantBlocks(event.data.message.content),
					usage: event.data.usage,
					providerMetadata: {
						provider: event.data.message.source.provider,
						model: event.data.message.source.model
					},
					timing: {
						stepStartTime: state.started ? state.startTime : null,
						firstTokenTime: state.firstTokenTime ?? null,
						completedTime: event.time
					},
					...event.data.interrupted === true ? { interrupted: true } : {}
				};
			}
			const boundary = closedBoundary(context);
			if (boundary === void 0) return void 0;
			const blocks = compactBlocks(state.blocks);
			if (!hasInterruptionEvidence(blocks)) return void 0;
			return {
				kind: "assistant",
				seq: boundary.seq - .9,
				time: boundary.time,
				turn: state.turn,
				step: state.step,
				blocks,
				interrupted: true
			};
		}
		function assistantRequest(state, node, boundary) {
			if (!state.started) return void 0;
			const status = node !== void 0 ? node.interrupted === true ? "error" : "complete" : boundary !== void 0 ? "error" : "running";
			return {
				purpose: "assistant",
				startSeq: state.startSeq,
				turn: state.turn,
				step: state.step,
				startedAt: state.startTime,
				completedAt: node?.time ?? boundary?.time ?? null,
				status,
				...state.retry === void 0 ? {} : {
					error: state.retry.message,
					...state.retry.code === void 0 ? {} : { errorCode: state.retry.code },
					retry: state.retry.retry,
					...state.retry.maxRetries === void 0 ? {} : { maxRetries: state.retry.maxRetries },
					retryDelayMs: state.retry.delayMs
				},
				...node?.messageId === void 0 ? {} : {
					resultSeq: node.seq,
					...node.providerMetadata === void 0 ? {} : { providerMetadata: node.providerMetadata }
				},
				...state.usage === void 0 ? {} : { usage: state.usage }
			};
		}
		/** Trajectory-owned Assistant streaming, settlement, and request lifecycle. */
		const trajectoryAssistantDefinition = {
			kind: "trajectory-assistant-step",
			target: "trajectory",
			match: (event) => {
				if (event.type === "step/start") return {
					id: `${event.data.turn}:${event.data.step}`,
					role: "start"
				};
				if (event.type === "assistant/live-chunk" || event.type === "assistant/message" || event.type === "assistant/attempt" || event.type === "llm/retry" || event.type === "step/end") return {
					id: `${event.data.turn}:${event.data.step}`,
					role: "update"
				};
				return null;
			},
			start: (_context, match) => {
				if (match.event.type !== "step/start") throw new Error("trajectory-assistant-step start requires step/start");
				return initialState(match.event.data.turn, match.event.data.step, match.event.seq, match.event.time, true);
			},
			update: (context, match) => {
				if (match.event.type === "assistant/live-chunk") return updateChunk(context.state, match.event.data.chunk, match.event.seq, match.event.time);
				if (match.event.type === "assistant/message") return settleMessage(context.state, match, match.event);
				if (match.event.type === "assistant/attempt") return settleTiming(context.state, match.event);
				if (match.event.type === "step/end") return {
					...context.state,
					stepEnd: match
				};
				if (match.event.type !== "llm/retry") return context.state;
				const data = match.event.data;
				const failure = displayFailure(data.failure);
				return {
					...initialState(context.state.turn, context.state.step, context.state.startSeq, context.state.startTime, true),
					firstTokenTime: context.state.firstTokenTime,
					usage: context.state.usage,
					retry: {
						message: failure.message,
						...failure.code === void 0 ? {} : { code: failure.code },
						retry: data.retry,
						...data.mode === "normal" ? { maxRetries: data.maxRetries } : {},
						delayMs: data.delayMs
					}
				};
			},
			publication: (match) => {
				if (match.event.type === "step/start" || match.event.type === "assistant/attempt") return "none";
				if (match.event.type !== "assistant/live-chunk") return "immediate";
				const type = match.event.data.chunk.type;
				return type === "usage" || type === "finish" ? "none" : "animation-frame";
			},
			buildViewNode: (context) => {
				const state = context.state ?? fallbackState$1(context);
				if (state === void 0) return null;
				const node = finalNode(state, context);
				const boundary = closedBoundary(context);
				const partial = node === void 0 && boundary === void 0 && state.blocks.length > 0 ? {
					turn: state.turn,
					step: state.step,
					blocks: compactBlocks(state.blocks),
					timing: {
						stepStartTime: state.started ? state.startTime : null,
						firstTokenTime: state.firstTokenTime ?? null
					}
				} : null;
				const request = assistantRequest(state, node, boundary);
				if (node === void 0 && partial === null && request === void 0) return null;
				return trajectoryNode(context, state.startSeq, {
					kind: "assistant",
					...node === void 0 ? {} : { node },
					partial,
					...request === void 0 ? {} : { request }
				});
			}
		};
		const trajectoryTurnEndDefinition = {
			kind: "trajectory-turn-end",
			target: "trajectory",
			match: (event) => event.type === "turn/end" ? {
				id: String(event.seq),
				role: "start"
			} : null,
			start: (_context, match) => {
				if (match.event.type !== "turn/end") throw new Error("trajectory-turn-end start requires turn/end");
				const reason = match.event.data.reason;
				const failure = reason.kind === "error" ? displayFailure(reason.error) : void 0;
				return {
					turn: match.event.data.turn,
					seq: match.event.seq,
					time: match.event.time,
					...failure === void 0 ? {} : {
						error: failure.message,
						...failure.code === void 0 ? {} : { errorCode: failure.code }
					}
				};
			},
			update: (context) => context.state,
			buildViewNode: (context) => context.state === void 0 ? null : trajectoryNode(context, context.state.seq, {
				kind: "turn-end",
				turn: context.state.turn,
				time: context.state.time,
				...context.state.error === void 0 ? {} : { error: context.state.error },
				...context.state.errorCode === void 0 ? {} : { errorCode: context.state.errorCode }
			})
		};
		/**
		* Register the Trajectory Assistant lifecycle.
		*
		* @param ctx - Plugin context receiving the Definitions.
		*/
		function registerTrajectoryAssistantDefinition(ctx) {
			ctx.uiConversation.events.register(trajectoryAssistantDefinition);
			ctx.uiConversation.events.register(trajectoryTurnEndDefinition);
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/trajectory-compaction-definition.js
		function checkpointId(event) {
			if (event.type !== "user/message") return void 0;
			const source = event.data.source;
			return source.kind === "compact-checkpoint" && typeof source.compactionId === "string" && source.compactionId !== "" ? source.compactionId : void 0;
		}
		function eventCompactionId(event) {
			if (event.type !== "compaction/start" && event.type !== "compaction/summary" && event.type !== "compaction/end") return void 0;
			const value = event.data.compactionId;
			return typeof value === "string" && value !== "" ? value : void 0;
		}
		function requestFromState(state) {
			const start = state.start.event;
			if (start.type !== "compaction/start") return void 0;
			const summary = state.summary?.event;
			const end = state.end?.event;
			const checkpoint = state.checkpoint?.event;
			return {
				purpose: "compaction",
				startSeq: start.seq,
				turn: start.data.turn,
				step: 0,
				startedAt: start.time,
				completedAt: end?.type === "compaction/end" ? end.time : null,
				status: end?.type !== "compaction/end" ? "running" : end.data.error === void 0 ? "complete" : "error",
				...end?.type === "compaction/end" && end.data.error !== void 0 ? { error: end.data.error } : {},
				...summary?.type !== "compaction/summary" ? {} : {
					resultSeq: summary.seq,
					summary: summary.data.summary,
					...summary.data.rawOutput === void 0 ? {} : { rawOutput: summary.data.rawOutput },
					providerMetadata: {
						provider: summary.data.provider,
						model: summary.data.model
					},
					requestConfig: {
						provider: summary.data.provider,
						model: summary.data.model,
						purpose: "compaction",
						...summary.data.maxTokens === void 0 ? {} : { maxTokens: summary.data.maxTokens }
					},
					...summary.data.usage === void 0 ? {} : { usage: summary.data.usage }
				},
				...checkpoint?.type === "user/message" ? { replacementSeq: checkpoint.seq } : {}
			};
		}
		const trajectoryCompactionDefinition = {
			kind: "trajectory-compaction",
			target: "trajectory",
			match: (event) => {
				const compactId = eventCompactionId(event);
				if (compactId !== void 0) return {
					id: compactId,
					role: event.type === "compaction/start" ? "start" : "update"
				};
				const checkpoint = checkpointId(event);
				return checkpoint === void 0 ? null : {
					id: checkpoint,
					role: "update"
				};
			},
			start: (_context, match) => {
				if (match.event.type !== "compaction/start") throw new Error("trajectory-compaction start requires compaction/start");
				return { start: match };
			},
			update: (context, match) => {
				if (match.event.type === "compaction/summary") return {
					...context.state,
					summary: match
				};
				if (match.event.type === "compaction/end") return {
					...context.state,
					end: match
				};
				return checkpointId(match.event) === void 0 ? context.state : {
					...context.state,
					checkpoint: match
				};
			},
			buildViewNode: (context) => {
				if (context.state === void 0) return null;
				const request = requestFromState(context.state);
				return request === void 0 ? null : trajectoryNode(context, request.startSeq, {
					kind: "compaction",
					request
				});
			}
		};
		const trajectorySessionEndDefinition = {
			kind: "trajectory-session-end",
			target: "trajectory",
			match: (event) => event.type === "session/end-seed" ? {
				id: String(event.seq),
				role: "start"
			} : null,
			start: (_context, match) => ({
				seq: match.event.seq,
				time: match.event.time
			}),
			update: (context) => context.state,
			buildViewNode: (context) => context.state === void 0 ? null : trajectoryNode(context, context.state.seq, {
				kind: "session-end",
				seq: context.state.seq,
				time: context.state.time
			})
		};
		/**
		* Register Trajectory compaction requests and session boundaries.
		*
		* @param ctx - Plugin context receiving the Definitions.
		*/
		function registerTrajectoryCompactionDefinitions(ctx) {
			ctx.uiConversation.events.register(trajectoryCompactionDefinition);
			ctx.uiConversation.events.register(trajectorySessionEndDefinition);
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/trajectory-message-definitions.js
		const EMPTY_PENDING = {
			kind: "snapshot",
			ids: []
		};
		const EMPTY_CURRENT_CLAIMED = /* @__PURE__ */ new Set();
		function materializePending(state) {
			const splices = [];
			let current = state;
			while (current.kind === "splice") {
				splices.push(current);
				current = current.previous;
			}
			const pending = [...current.ids];
			for (const splice of splices.reverse()) pending.splice(splice.start, splice.removedCount, ...splice.inserted);
			return pending;
		}
		function withoutInserted(claimed, inserted) {
			let next;
			for (const id of inserted) {
				if (!claimed.has(id)) continue;
				next ??= new Set(claimed);
				next.delete(id);
			}
			return next ?? claimed;
		}
		/**
		* Apply one next-step splice under the AgentLoop's durable event ordering.
		* An entered claim logs its complete message batch before another claim; a
		* rejected claim logs no messages, so only the current claim can classify a
		* later `user/message`.
		*/
		function applySplice(previous, splice) {
			const priorPending = previous?.state.pending ?? EMPTY_PENDING;
			const inserted = splice.inserted.map((identity) => identity.id);
			const removedCount = splice.removedCount ?? 0;
			if (removedCount > 0 && splice.outcome !== "canceled") {
				const pending = materializePending(priorPending);
				const removed = pending.splice(splice.start, removedCount, ...inserted);
				return {
					pending: {
						kind: "snapshot",
						ids: pending
					},
					currentClaimed: new Set(removed)
				};
			}
			const currentClaimed = withoutInserted(previous?.state.currentClaimed ?? EMPTY_CURRENT_CLAIMED, inserted);
			return {
				pending: {
					kind: "splice",
					previous: priorPending,
					start: splice.start,
					removedCount,
					inserted
				},
				currentClaimed
			};
		}
		const trajectoryInboxDefinition = {
			kind: "trajectory-inbox-next-step",
			match: (event) => {
				if (event.type === "agent/inbox/spliced" && event.data.target === "next-step") return {
					id: String(event.seq),
					role: "start"
				};
				return null;
			},
			start: (_context, match, reader) => {
				if (match.event.type !== "agent/inbox/spliced") throw new Error("trajectory-inbox-next-step start requires agent/inbox/spliced");
				return applySplice(reader.previous("trajectory-inbox-next-step"), match.event.data);
			},
			update: (context) => context.state,
			publication: () => "none"
		};
		const trajectoryMessageDefinition = {
			kind: "trajectory-input-message",
			target: "trajectory",
			match: (event) => {
				return event.type === "user/message" || event.type === "developer/message" ? {
					id: String(event.seq),
					role: "start"
				} : null;
			},
			start: (_context, match, reader) => {
				if (match.event.type === "developer/message") {
					const { seq, time, data: { message } } = match.event;
					return {
						kind: "context",
						seq,
						time,
						content: message.content,
						source: message.source,
						producer: contextProducer(message.source),
						form: contextForm(message.source)
					};
				}
				if (match.event.type !== "user/message") throw new Error("trajectory-input-message start requires user/message");
				const event = match.event;
				if (event.data.source.kind !== "user") return {
					kind: "context",
					seq: event.seq,
					time: event.time,
					content: event.data.content,
					source: event.data.source,
					producer: contextProducer(event.data.source),
					form: contextForm(event.data.source)
				};
				return reader.previous("trajectory-inbox-next-step")?.state.currentClaimed.has(String(event.data.id)) === true ? {
					kind: "steering",
					messageId: event.data.id,
					seq: event.seq,
					time: event.time,
					content: event.data.content,
					source: event.data.source
				} : {
					kind: "user",
					seq: event.seq,
					time: event.time,
					content: event.data.content,
					source: event.data.source
				};
			},
			update: (context) => context.state,
			buildViewNode: (context) => context.state === void 0 ? null : trajectoryNode(context, context.state.seq, {
				kind: "node",
				node: context.state
			})
		};
		/**
		* Register Trajectory-owned inbox classification and message records.
		*
		* @param ctx - Plugin context receiving the Definitions.
		*/
		function registerTrajectoryMessageDefinitions(ctx) {
			ctx.uiConversation.events.register(trajectoryInboxDefinition);
			ctx.uiConversation.events.register(trajectoryMessageDefinition);
		}
		//#endregion
} // __DSH_FRAGMENT_END__

export {};
