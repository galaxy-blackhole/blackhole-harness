/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js — CẮT LẠI 08/11/2026
 *      theo MOT kieu duy nhat (region-based), gộp/cắt tiếp để mỗi lát ≤ 900 dòng.
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					order: this.order,
					readNode: this.readGroupNode,
					readTurn: this.readGroupTurn,
					readPosition: this.readGroupPosition,
					timeline: input.timeline
				};
				return this.snapshot(input.timeline, this.legacy.replace(nodes, input.timeline));
			}
			apply(input) {
				const upserts = this.skillNames.apply(this.referenceLabels.apply(input.upserts, this.store), this.store);
				const processTurns = /* @__PURE__ */ new Set();
				let structural = false;
				const contentOnly = [];
				const changes = [];
				for (const node of upserts) {
					const previous = this.store.get(node.key);
					if (previous !== node) changes.push({
						previous,
						current: node
					});
					const nodeStructural = previous === void 0 || previous.kind !== node.kind || previous.anchorSeq !== node.anchorSeq || previous.visibility !== node.visibility || previous.groupTree !== node.groupTree || locationIdentity(previous.location) !== locationIdentity(node.location);
					structural ||= nodeStructural;
					if (!nodeStructural) contentOnly.push(node);
					if (processPresentationInputChanged(previous, node, nodeStructural)) {
						const previousTurn = previous === void 0 ? void 0 : locationCoordinates(previous.location).turn;
						const nextTurn = locationCoordinates(node.location).turn;
						if (previousTurn !== void 0) processTurns.add(previousTurn);
						if (nextTurn !== void 0) processTurns.add(nextTurn);
					}
				}
				this.store.upsert(upserts);
				let changedTurnOrders = EMPTY_TURNS;
				if (structural) {
					const next = orderedVisibleChatNodes(this.store.values()).map((node) => node.key);
					this.order = sameReferences$1(this.order, next) ? this.order : next;
					changedTurnOrders = this.locations.rebuild(this.order, this.store);
				}
				this.locations.touch(contentOnly);
				this.store.updateProcesses(processTurns, this.locations);
				this.store.settleBottom(input.timeline.turnOrder, this.locations);
				if (structural || input.timeline !== this.timeline) this.navigation.rebuild(input.timeline, this.locations, this.store);
				else this.navigation.touch(turnsOf(contentOnly), this.locations, this.store);
				this.timeline = input.timeline;
				this.latestGroupInput = {
					kind: "apply",
					changes,
					order: this.order,
					readNode: this.readGroupNode,
					readTurn: this.readGroupTurn,
					readPosition: this.readGroupPosition,
					timeline: input.timeline,
					changedTurns: input.changedTurns ?? EMPTY_TURNS,
					changedTurnOrders
				};
				return this.snapshot(input.timeline, this.legacy.apply(upserts, input.timeline));
			}
			groupInput() {
				return this.latestGroupInput;
			}
			publish() {
				this.store.publish();
			}
			snapshot(timeline, legacy = this.legacy.replace(EMPTY_LIST, timeline)) {
				return {
					order: this.order,
					nodes: this.store,
					locations: this.locations,
					navigation: this.navigation,
					timeline,
					legacy
				};
			}
		};
		/** Turns owning the given nodes, for the content-only navigation update. */
		function turnsOf(nodes) {
			const turns = /* @__PURE__ */ new Set();
			for (const node of nodes) {
				const turn = locationCoordinates(node.location).turn;
				if (turn !== void 0) turns.add(turn);
			}
			return turns;
		}
		function locationIdentity(location) {
			const coordinates = locationCoordinates(location);
			return `${location.kind}:${coordinates.turn ?? ""}:${coordinates.step ?? ""}`;
		}
		/** Chat target factory contributed to the Conversation view registry. */
		const chatViewDefinition = {
			target: "chat",
			create: () => new ChatSnapshotBuilder(),
			isActive: (snapshot) => snapshot.order.some((key) => snapshot.nodes.get(key)?.kind !== "command")
		};
		/**
		* Register the incremental Chat target builder.
		* @param ctx - owning UI Conversation context.
		*/
		function registerChatConversationView(ctx) {
			ctx.uiConversation.views.register(chatViewDefinition);
		}
		//#endregion
		//#region ../../core/session/lib/types/surface.js
		/** Runtime counterpart of the message-producing event union. */
		const SURFACE_EVENT_TYPES = new Set([
			"system/message",
			"developer/message",
			"user/message",
			"assistant/message",
			"tool/result"
		]);
		/**
		* Narrow an event to a surface-eligible event carrying its required marker.
		* @param event - event to test.
		* @returns true when both the type and marker identify a surface event.
		*/
		function isSurfaceEvent(event) {
			if (!SURFACE_EVENT_TYPES.has(event.type)) return false;
			return event.surfaceOp !== void 0;
		}
		/**
		* Narrow an event to an append-origin surface event: one that entered the
		* surface at its own log position and was never itself a replacement copy.
		*
		* The model-visible surface deliberately shadows replaced ranges, so it is the
		* wrong source for a human transcript — a landed replacement would erase
		* conversation the user already saw. Append-origin events are that transcript's
		* durable source material; replacement copies stay model-only.
		* @param event - event to test.
		* @returns true when the event appended to the surface tail.
		*/
		function isAppendSurfaceEvent(event) {
			return isSurfaceEvent(event) && event.surfaceOp === "append";
		}
		/**
		* Narrow an event to a surface replacement: a node that shadowed an existing
		* surface range instead of appending to the tail. The counterpart of
		* {@link isAppendSurfaceEvent} over the two {@link SurfaceOp} variants.
		* @param event - event to test.
		* @returns true when the event replaced a surface range.
		*/
		function isReplacementSurfaceEvent(event) {
			return isSurfaceEvent(event) && event.surfaceOp !== "append";
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/command.js
		const COMPACT_KIND = "compact-checkpoint";
		function commandFromRun(match) {
			if (match.event.type !== "command/run") throw new Error("command start requires command/run");
			const data = match.event.data;
			return {
				kind: "command",
				seq: match.event.seq,
				time: match.event.time,
				commandId: data.commandId,
				name: data.name,
				args: data.args ?? null,
				outcome: null
			};
		}
		function commandFromDone(match, previous) {
			if (match.event.type !== "command/done") throw new Error("command update requires command/done");
			const data = match.event.data;
			const sourceEventSeq = data.kind === "success" && data.sourceEventSeq !== void 0 && Number.isSafeInteger(data.sourceEventSeq) && data.sourceEventSeq >= 0 ? data.sourceEventSeq : void 0;
			return {
				kind: "command",
				seq: previous?.seq ?? match.event.seq,
				time: previous?.time ?? match.event.time,
				commandId: data.commandId,
				name: previous?.name ?? null,
				args: previous?.args ?? null,
				outcome: {
					kind: data.kind,
					...data.text === void 0 ? {} : { text: data.text },
					...sourceEventSeq === void 0 ? {} : { sourceEventSeq }
				}
			};
		}
		/**
		* Read correlation identity from a compaction replacement checkpoint.
		* @param event - candidate Session event.
		* @returns correlated compaction and optional command identity.
		*/
		function compactSource(event) {
			if (event.type !== "user/message" || !isReplacementSurfaceEvent(event)) return void 0;
			const source = event.data.source;
			if (source.kind !== COMPACT_KIND || typeof source.compactionId !== "string") return void 0;
			return {
				compactionId: source.compactionId,
				...source.sourceCommandId === void 0 ? {} : { sourceCommandId: source.sourceCommandId }
			};
		}
		/**
		* Build the visible summary marker from optional lifecycle evidence.
		* @param match - compaction/summary Match, when loaded.
		* @param checkpoint - replacement checkpoint Match.
		* @returns final compaction summary Node data.
		*/
		function compactSummary(match, checkpoint) {
			let summary = null;
			let shadowedItemCount = null;
			let shadowedTokenCount = null;
			if (match?.event.type === "compaction/summary") {
				const data = match.event.data;
				if (Array.isArray(data.summary)) {
					const text = data.summary.map((block) => block.type === "text" ? block.text : "").join("");
					summary = text.trim() === "" ? null : text;
				}
				shadowedItemCount = Array.isArray(data.shadowedSeqs) && data.shadowedSeqs.every((seq) => Number.isSafeInteger(seq) && seq >= 0) ? data.shadowedSeqs.length : null;
				shadowedTokenCount = Number.isSafeInteger(data.shadowedTokenCount) && data.shadowedTokenCount >= 0 ? data.shadowedTokenCount : null;
			}
			return {
				kind: "compaction",
				seq: checkpoint.event.seq,
				time: checkpoint.event.time,
				summary,
				summaryEventSeq: match?.event.seq ?? null,
				shadowedItemCount,
				shadowedTokenCount
			};
		}
		function fallbackState$4(context) {
			const done = context.matches.find((match) => match.event.type === "command/done");
			const checkpoint = context.matches.find((match) => compactSource(match.event) !== void 0);
			const summary = context.matches.find((match) => match.event.type === "compaction/summary");
			if (checkpoint === void 0) return done === void 0 ? void 0 : { command: commandFromDone(done) };
			const source = compactSource(checkpoint.event);
			if (source?.sourceCommandId === void 0) return done === void 0 ? void 0 : { command: commandFromDone(done) };
			return {
				command: done === void 0 ? {
					kind: "command",
					seq: checkpoint.event.seq,
					time: checkpoint.event.time,
					commandId: source.sourceCommandId,
					name: "compact",
					args: null,
					outcome: null
				} : {
					...commandFromDone(done),
					name: "compact"
				},
				checkpoint,
				...summary === void 0 ? {} : { summary }
			};
		}
		/**
		* Fold shared compaction evidence into a Definition-owned State.
		* @param state - current business State carrying optional compaction evidence.
		* @param match - next compaction lifecycle Match.
		* @returns adopted State, preserving reference identity when the Match adds no evidence.
		*/
		function updateCompactionState(state, match) {
			if (match.event.type === "compaction/summary") return {
				...state,
				summary: match
			};
			if (compactSource(match.event) !== void 0) return {
				...state,
				checkpoint: match
			};
			return state;
		}
		/** Slash-command lifecycle, including integrated manual compaction, Definition. */
		const commandDefinition = {
			kind: "command",
			target: "chat",
			match: (event) => {
				if (event.type === "command/run") return {
					id: String(event.data.commandId),
					role: "start"
				};
				if (event.type === "command/done") return {
					id: String(event.data.commandId),
					role: "update"
				};
				const checkpoint = compactSource(event);
				if (checkpoint?.sourceCommandId !== void 0) return {
					id: String(checkpoint.sourceCommandId),
					role: "update"
				};
				if (event.type === "compaction/start" || event.type === "compaction/summary" || event.type === "compaction/end") {
					if (event.data.sourceCommandId !== void 0) return {
						id: String(event.data.sourceCommandId),
						role: "update"
					};
				}
				return null;
			},
			start: (_context, match) => ({ command: commandFromRun(match) }),
			update: (context, match) => {
				if (match.event.type === "command/done") return {
					...context.state,
					command: commandFromDone(match, context.state.command)
				};
				return updateCompactionState(context.state, match);
			},
			buildViewNode: (context) => {
				const state = context.state ?? fallbackState$4(context);
				if (state === void 0) return null;
				if (state.command.name !== "compact") return chatNode(context, "command", state.command.seq, state.command);
				const compaction = state.checkpoint === void 0 ? null : compactSummary(state.summary, state.checkpoint);
				const data = {
					command: state.command,
					compaction
				};
				return chatNode(context, "manual-compaction", compaction?.seq ?? state.command.seq, data);
			}
		};
		/**
		* Register the command lifecycle business contribution.
		* @param ctx - owning UI Conversation context.
		*/
		function registerCommandConversationNode(ctx) {
			ctx.uiConversation.events.register(commandDefinition);
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/compaction.js
		function fallbackState$3(context) {
			const summary = context.matches.find((match) => match.event.type === "compaction/summary");
			const checkpoint = context.matches.find((match) => compactSource(match.event) !== void 0);
			return {
				...summary === void 0 ? {} : { summary },
				...checkpoint === void 0 ? {} : { checkpoint }
			};
		}
		/** Automatic compaction lifecycle and landed checkpoint Definition. */
		const compactionDefinition = {
			kind: "compaction",
			target: "chat",
			match: (event) => {
				const checkpoint = compactSource(event);
				if (checkpoint !== void 0 && checkpoint.sourceCommandId === void 0) return {
					id: checkpoint.compactionId,
					role: "update"
				};
				if (event.type === "compaction/start" || event.type === "compaction/summary" || event.type === "compaction/end") {
					if (event.data.sourceCommandId !== void 0) return null;
					const compactionId = event.data.compactionId;
					if (typeof compactionId !== "string" || compactionId === "") return null;
					return {
						id: compactionId,
						role: event.type === "compaction/start" ? "start" : "update"
					};
				}
				return null;
			},
			start: () => ({}),
			update: (context, match) => updateCompactionState(context.state, match),
			buildViewNode: (context) => {
				const state = context.state ?? fallbackState$3(context);
				if (state.checkpoint === void 0) return null;
				const marker = compactSummary(state.summary, state.checkpoint);
				return chatNode(context, "compaction", marker.seq, marker);
			}
		};
		/**
		* Register the automatic-compaction business contribution.
		* @param ctx - owning UI Conversation context.
		*/
		function registerCompactionConversationNode(ctx) {
			ctx.uiConversation.events.register(compactionDefinition);
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/fallback.js
		/** Unclaimed append-surface fallback Definition. */
		const unknownFallbackDefinition = {
			kind: "unknown-surface",
			target: "chat",
			match: (event) => event.type !== "assistant/live-chunk" && isAppendSurfaceEvent(event) ? {
				id: String(event.seq),
				role: "start"
			} : null,
			start: (_context, match) => ({
				kind: "unknown",
				seq: match.event.seq,
				time: match.event.time,
				type: match.event.type,
				data: match.event.data
			}),
			update: (context) => context.state,
			buildViewNode: (context) => context.state === void 0 ? null : chatNode(context, "unknown", context.state.seq, context.state)
		};
		/**
		* Register the unmatched append-surface fallback contribution.
		* @param ctx - owning UI Conversation context.
		*/
		function registerUnknownConversationFallback(ctx) {
			ctx.uiConversation.events.registerFallback(unknownFallbackDefinition);
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/inbox.js
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
			for (const { id } of inserted) {
				if (!claimed.has(id)) continue;
				next ??= new Set(claimed);
				next.delete(id);
			}
			return next ?? claimed;
		}
		/**
		* Apply one Inbox splice under the AgentLoop's durable event ordering.
		* An entered claim logs its complete message batch before another claim; a
		* rejected claim logs no messages, so only the current claim can classify a
		* later `user/message`.
		*/
		function applySplice(previous, splice, seq) {
			const priorPending = previous?.state.pending ?? EMPTY_PENDING;
			const inserted = splice.inserted;
			const removedCount = splice.removedCount ?? 0;
			if (removedCount > 0 && splice.outcome !== "canceled") {
				const pending = materializePending(priorPending);
				const removed = pending.splice(splice.start, removedCount, ...inserted);
				return {
					pending: {
						kind: "snapshot",
						ids: pending
					},
					currentClaimed: new Set(removed.map((message) => message.id)),
					claimSeq: seq,
					claimedHuman: removed.some((message) => message.source.kind === "user")
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
				currentClaimed,
				claimSeq: previous?.state.claimSeq ?? -1,
				claimedHuman: previous?.state.claimedHuman ?? false
			};
		}
		function inboxDefinition(target) {
			const kind = `inbox-${target}`;
			return {
				kind,
				match: (event) => event.type === "agent/inbox/spliced" && event.data.target === target ? {
					id: String(event.seq),
					role: "start"
				} : null,
				start: (_context, match, reader) => {
					if (match.event.type !== "agent/inbox/spliced") throw new Error("inbox start requires agent/inbox/spliced");
					return applySplice(reader.previous(kind), match.event.data, match.event.seq);
				},
				update: (context) => context.state,
				publication: () => "none"
			};
		}
		/** Persistent next-step claims identify messages admitted into a running Turn. */
		const nextStepInboxDefinition = inboxDefinition("next-step");
		/** Persistent next-turn claims identify messages that wake a new Turn. */
		const nextTurnInboxDefinition = inboxDefinition("next-turn");
		/**
		* Register the Inbox state used by Chat message classification.
		* @param ctx - owning UI Conversation context.
		*/
		function registerInboxConversationNodes(ctx) {
			ctx.uiConversation.events.register(nextStepInboxDefinition);
			ctx.uiConversation.events.register(nextTurnInboxDefinition);
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/message.js
		function isCompactionCheckpoint(event) {
			if (event.type !== "user/message" || !isReplacementSurfaceEvent(event)) return false;
			return event.data.source.kind === "compact-checkpoint";
		}
		/** Context presentation shared by user-role injections and developer messages. */
		function contextMessage(event, message) {
			return {
				kind: "context",
				seq: event.seq,
				time: event.time,
				content: message.content,
				source: message.source,
				producer: contextProducer(message.source),
				form: contextForm(message.source)
			};
		}
		/** User, steering, and injected-context message classification Definition. */
		const messageDefinition = {
			kind: "input-message",
			target: "chat",
			match: (event) => {
				if (event.type === "user/message") return isAppendSurfaceEvent(event) && !isCompactionCheckpoint(event) ? {
					id: String(event.data.id),
					role: "start"
				} : null;
				return null;
			},
			start: (_context, match, reader) => {
				const event = match.event;
				if (event.type !== "user/message") throw new Error("input-message start requires user/message");
				if (event.data.source.kind !== "user") {
					const nextTurn = reader.previous("inbox-next-turn")?.state;
					const nextStep = reader.previous("inbox-next-step")?.state;
					const location = match.location;
					const turnStart = location.kind === "step" ? location.turn.start?.seq : void 0;
					const idleSteer = location.kind === "step" && location.step.step === 1 && turnStart !== void 0 && (nextStep?.claimSeq ?? -1) > turnStart && (nextTurn?.claimSeq ?? -1) < turnStart && nextStep?.claimedHuman === false && nextStep.currentClaimed.has(String(event.data.id));
					return {
						...contextMessage(event, event.data),
						waking: nextTurn?.currentClaimed.has(String(event.data.id)) === true || idleSteer
					};
				}
				return reader.previous("inbox-next-step")?.state.currentClaimed.has(String(event.data.id)) === true ? {
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
			buildViewNode: (context) => {
				if (context.state === void 0) return null;
				const waking = context.state.kind === "context" && context.start?.event.type === "user/message" && context.state.waking === true;
				const location = contextLocation(context);
				const human = context.state.kind === "user" || context.state.kind === "steering";
				const opensExchange = human && location.kind === "step" && location.step.step === 1;
				return chatNode(context, waking ? "turn-trigger" : context.state.kind, context.state.seq, context.state, {
					location,
					groupTree: opensExchange ? "exchange" : human || waking ? "input" : void 0
				});
			}
		};
		/** Developer history uses the input-message lifecycle and context presentation. */
		const developerMessageDefinition = {
			...messageDefinition,
			kind: "developer-message",
			match: (event) => event.type === "developer/message" ? {
				id: String(event.data.message.id),
				role: "start"
			} : null,
			start: (_context, match) => {
				const event = match.event;
				if (event.type !== "developer/message") throw new Error("developer-message start requires developer/message");
				return contextMessage(event, event.data.message);
			}
		};
		/**
		* Register user, steering, injected-context, and developer message contributions.
		* @param ctx - owning UI Conversation context.
		*/
		function registerMessageConversationNode(ctx) {
			ctx.uiConversation.events.register(messageDefinition);
			ctx.uiConversation.events.register(developerMessageDefinition);
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/request-prompt.js
		/** Place a request's system prompt at the start of its visible message series. */
		function requestPromptAnchor(match, previous, isInitial) {
			if (match.location.kind !== "step") return match.event.seq;
			if (previous === void 0 && !isInitial) return match.event.seq;
			if (previous?.turn === match.location.turn.turn && previous.step === match.location.step.step) return match.event.seq;
			return match.location.step.step === 1 ? match.location.turn.start?.seq ?? match.location.step.start?.seq ?? match.event.seq : match.location.step.start?.seq ?? match.event.seq;
		}
		/** Keep an already rendered prompt at its page-lifetime presentation anchor. */
		function stableRequestPromptAnchor(context, match, previous, isInitial) {
			const current = context.current.get("chat");
			return current?.kind === "system-prompt" ? current.anchorSeq : requestPromptAnchor(match, previous, isInitial);
		}
		/**
		* System-prompt surface node Definition for the Chat target. It owns every
		* `system/message` event on the Chat target so the unknown-surface fallback
		* never renders the prompt as a transcript row. Each nonempty append owns a
		* prompt card, even without a loaded request header. Initial cards precede
		* their step's input; in-history updates stay at their own positions. The
		* request-prompt Definition owns replacement and later-series cards. Positional
		* replacements advance the effective prompt without changing historical cards.
		* @param inspect - Pure surface interpretation supplied by uiConversation.
		* @returns The Chat system-prompt Definition.
		*/
		function systemMessageDefinition(inspect) {
			return {
				kind: "system-message",
				target: "chat",
				match: (event) => event.type === "system/message" || "surfaceOp" in event && event.surfaceOp !== "append" ? {
					id: String(event.seq),
					role: "start"
				} : null,
				start: (_context, match, reader) => {
					if (match.event.type === "assistant/live-chunk") throw new Error("system-message requires a durable event");
					return inspect(reader.previous("system-message")?.state, match.event);
				},
				update: (context) => context.state,
				buildViewNode: (context) => {
					const state = context.state?.introduced;
					if (state === void 0 || state.text === "" || context.start?.event.type !== "system/message" || context.start.event.surfaceOp !== "append") return null;
					return chatNode(context, "system-prompt", state.update ? state.seq : requestPromptAnchor(context.start, void 0, true), {
						text: state.text,
						...state.update ? { update: true } : {}
					});
				}
			};
		}
		/**
		* Request-header prompt Definition for the Chat target. Resume and explicit
		* series starts retain a prompt card even when the system text is unchanged.
		* @param inspect - the shared prompt interpretation, supplied by the
		* uiConversation service (a client bundle cannot value-import it).
		* @returns the Chat request-prompt Definition.
		*/
		function requestPromptDefinition(inspect) {
			return {
				kind: "request-prompt",
				target: "chat",
				match: (event) => event.type === "request/header" ? {
					id: String(event.seq),
					role: "start"
				} : null,
				start: (context, match, reader) => {
					if (match.event.type !== "request/header") throw new Error("request-prompt start requires request/header");
					const previous = reader.previous("request-prompt")?.state;
					const systemContext = reader.previous("system-message");
					const system = systemContext?.state.effective;
					const location = match.location.kind === "step" ? {
						turn: match.location.turn.turn,
						step: match.location.step.step
					} : {};
					const inspection = inspect(previous?.prompt, match.event, system);
					const change = inspection.change?.kind;
					const systemEvent = systemContext?.matches[0]?.event;
					const shownByUpdate = system !== void 0 && systemEvent?.type === "system/message" && systemEvent.surfaceOp === "append" && (system.update || previous === void 0) && system.turn === location.turn && system.step === location.step;
					return {
						anchorSeq: stableRequestPromptAnchor(context, match, previous, match.event.data.reason === "initial"),
						showsPrompt: !shownByUpdate && (previous === void 0 || match.event.data.reason !== "change" || match.event.data.startsSeries === true || change === "system" || change === "system-and-tools"),
						...location,
						...inspection
					};
				},
				update: (context) => context.state,
				buildViewNode: (context) => {
					const state = context.state;
					if (state === void 0) return null;
					const current = context.current.get("chat");
					const visible = state.showsPrompt && state.prompt.system !== "";
					if (!visible && current?.kind !== "system-prompt") return null;
					return chatNode(context, "system-prompt", state.anchorSeq, { text: state.prompt.system }, { visibility: visible ? "visible" : "hidden" });
				}
			};
		}
		/**
		* Register the system-prompt surface node and the model-request prompt card in the Chat flow.
		* @param ctx - Owning UI Conversation context.
		*/
		function registerRequestPromptConversationNode(ctx) {
			ctx.uiConversation.events.register(systemMessageDefinition((previous, event) => ctx.uiConversation.inspectSystemPrompt(previous, event)));
			ctx.uiConversation.events.register(requestPromptDefinition((previous, event, system) => ctx.uiConversation.inspectRequestPrompt(previous, event, system)));
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/retry.js
		function scheduledNode(match) {
			if (match.event.type !== "llm/retry") return void 0;
			return {
				kind: "model-retry",
				seq: match.event.seq,
				time: match.event.time,
				retryState: "scheduled",
				...match.event.data
			};
		}
		/** A scheduled attempt is cancelled once either owning boundary closes. */
		function isClosed(location) {
			return location.kind === "step" && location.step.status === "closed" || (location.kind === "step" || location.kind === "turn") && location.turn.status === "closed";
		}
		/** Producer-correlated model retry chain Definition. */
		const retryDefinition = {
			kind: "model-retry",
			target: "chat",
			match: (event) => {
				if (event.type === "llm/retry") {
					const retryId = event.data.retryId;
					if (typeof retryId !== "string" || retryId === "") return null;
					return {
						id: retryId,
						role: event.data.retry === 1 ? "start" : "update"
					};
				}
				if (event.type === "llm/retry-started") {
					const retryId = event.data.retryId;
					return typeof retryId === "string" && retryId !== "" ? {
						id: retryId,
						role: "update"
					} : null;
				}
				return null;
			},
			start: (_context, match) => {
				const node = scheduledNode(match);
				if (node === void 0) throw new Error("model-retry start requires a valid llm/retry event");
				return {
					turn: node.turn,
					step: node.step,
					attempts: [node]
				};
			},
			update: (context, match) => {
				if (match.event.type === "llm/retry") {
					const node = scheduledNode(match);
					return node === void 0 ? context.state : {
						...context.state,
						attempts: [...context.state.attempts, node]
					};
				}
				if (match.event.type !== "llm/retry-started") return context.state;
				const retry = match.event.data.retry;
				return {
					...context.state,
					attempts: context.state.attempts.map((attempt) => attempt.retry === retry ? {
						...attempt,
						retryState: "started"
					} : attempt)
				};
			},
			buildViewNode: (context) => {
				if (context.state === void 0 || context.state.attempts.length === 0) return null;
				const location = context.start?.location ?? context.matches[0]?.location ?? { kind: "unresolved" };
				const stateAttempts = context.state.attempts;
				const attempts = stateAttempts.map((attempt, index) => index === stateAttempts.length - 1 && attempt.retryState === "scheduled" && isClosed(location) ? {
					...attempt,
					retryState: "cancelled"
				} : attempt);
				const current = attempts.at(-1);
				if (current === void 0) return null;
				const data = {
					attempts,
					current
				};
				return chatNode(context, "model-retry", attempts[0]?.seq ?? current.seq, data, { groupTree: "process" });
			}
		};
		/**
		* Register the correlated model-retry business contribution.
		* @param ctx - owning UI Conversation context.
		*/
		function registerRetryConversationNode(ctx) {
			ctx.uiConversation.events.register(retryDefinition);
		}
		//#endregion