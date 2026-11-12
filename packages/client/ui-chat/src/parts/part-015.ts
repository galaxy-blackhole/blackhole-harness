/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js — CẮT LẠI 08/11/2026
 *      theo MOT kieu duy nhat (region-based), gộp/cắt tiếp để mỗi lát ≤ 900 dòng.
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#region lib/types/client/conversation-nodes/tool.js
		const MAX_DEPTH = 256;
		const projectedBlocks = /* @__PURE__ */ new WeakMap();
		function jsonArguments(value) {
			return JSON.stringify(value);
		}
		function rootCall(match, previous) {
			if (match.event.type !== "tool/call") throw new Error("tool-call start requires tool/call");
			return {
				phase: "start",
				callId: String(match.event.data.callId),
				name: match.event.data.name,
				argsRaw: match.event.data.arguments,
				args: previous === void 0 ? PartialArguments.fromText(match.event.data.arguments) : previous.args.settle(match.event.data.arguments),
				turn: match.event.data.turn,
				step: match.event.data.step,
				time: match.event.time,
				subCalls: []
			};
		}
		/**
		* Retain argument fragments in the named call's lazy view. Root replacement
		* belongs to publication, after all pending fragments can be observed together.
		*/
		function applyDelta(state, match) {
			const event = match.event;
			if (event.type !== "assistant/live-chunk") return state;
			const chunk = event.data.chunk;
			const root = state.root;
			if (chunk.type === "block-end" && chunk.block.type === "tool-call") {
				if (root === void 0 || "kind" in root || root.phase !== "preparing") return state;
				return {
					...state,
					root: {
						...root,
						name: chunk.block.name,
						args: root.args.settle(chunk.block.arguments)
					}
				};
			}
			if (chunk.type !== "tool-call-delta") return state;
			if (root === void 0) {
				if (!chunk.name) return state;
				const args = new PartialArguments();
				args.append(chunk.argumentsDelta);
				return {
					...state,
					root: {
						phase: "preparing",
						callId: String(chunk.id),
						name: chunk.name,
						turn: event.data.turn,
						step: event.data.step,
						time: event.time,
						subCalls: [],
						args
					}
				};
			}
			if ("kind" in root || root.phase !== "preparing" || root.args.isSealed) return state;
			root.args.append(chunk.argumentsDelta);
			return state;
		}
		function preparingBlock(root, current) {
			const changed = root.args.refresh();
			if (!changed && current !== void 0 && !("kind" in current) && current.phase === "preparing" && current.name === root.name && current.args === root.args) return current;
			return changed ? { ...root } : root;
		}
		function rootResult(match, previous) {
			if (match.event.type !== "tool/result") return void 0;
			const message = match.event.data.message;
			return {
				kind: "tool-result",
				seq: match.event.seq,
				time: match.event.time,
				callId: String(message.source.callId),
				name: previous?.name ?? "",
				args: previous?.args ?? PartialArguments.EMPTY,
				call: previous === void 0 ? null : {
					name: previous.name,
					argsRaw: previous.argsRaw
				},
				callTime: previous?.time ?? null,
				content: message.content,
				isError: message.isError === true,
				...match.event.data.error === void 0 ? {} : { error: match.event.data.error },
				meta: match.event.data.meta,
				subCalls: []
			};
		}
		function childCall(match, data) {
			return {
				phase: "start",
				callId: data.subCallId,
				parentCallId: data.parentCallId,
				name: data.name,
				argsRaw: jsonArguments(data.arguments),
				args: PartialArguments.fromObject(data.arguments),
				turn: locationTurn(match),
				step: locationStep(match),
				time: match.event.time,
				subCalls: []
			};
		}
		function childResult(match, data, previous) {
			return {
				kind: "tool-result",
				seq: match.event.seq,
				time: match.event.time,
				callId: data.subCallId,
				parentCallId: data.parentCallId,
				name: data.name,
				args: previous !== void 0 && !("kind" in previous) ? previous.args : PartialArguments.fromObject(data.arguments),
				call: {
					name: data.name,
					argsRaw: jsonArguments(data.arguments)
				},
				callTime: previous?.time ?? null,
				content: data.content ?? [],
				meta: data.meta,
				isError: data.isError === true,
				...data.error === void 0 ? {} : { error: data.error },
				subCalls: []
			};
		}
		function locationTurn(match) {
			return match.location.kind === "step" || match.location.kind === "turn" ? match.location.turn.turn : 0;
		}
		function locationStep(match) {
			return match.location.kind === "step" ? match.location.step.step : 0;
		}
		function acceptsEdge(state, parent, child) {
			if (parent === child || state.parents.has(child)) return false;
			let cursor = parent;
			let parentDepth = 0;
			const ancestors = /* @__PURE__ */ new Set();
			while (cursor !== void 0) {
				if (cursor === child || ancestors.has(cursor)) return false;
				ancestors.add(cursor);
				parentDepth++;
				cursor = state.parents.get(cursor);
			}
			const pending = [{
				callId: child,
				depth: 1
			}];
			const descendants = /* @__PURE__ */ new Set();
			let subtreeDepth = 0;
			for (const candidate of pending) {
				if (descendants.has(candidate.callId)) return false;
				descendants.add(candidate.callId);
				subtreeDepth = Math.max(subtreeDepth, candidate.depth);
				for (const nested of state.children.get(candidate.callId) ?? []) pending.push({
					callId: nested.callId,
					depth: candidate.depth + 1
				});
			}
			return parentDepth + subtreeDepth <= MAX_DEPTH;
		}
		function updateDispatch(state, match) {
			const event = match.event;
			if (event.type !== "tool/ptc-dispatch-start" && event.type !== "tool/ptc-dispatch") return state;
			const data = event.data;
			const parentCallId = String(data.parentCallId);
			const subCallId = String(data.subCallId);
			const siblings = state.children.get(parentCallId) ?? [];
			const index = siblings.findIndex((candidate) => candidate.callId === subCallId);
			if (event.type === "tool/ptc-dispatch-start") {
				if (index >= 0 || !acceptsEdge(state, parentCallId, subCallId)) return state;
				const children = new Map(state.children);
				children.set(parentCallId, [...siblings, childCall(match, data)]);
				const parents = new Map(state.parents);
				parents.set(subCallId, parentCallId);
				return {
					...state,
					children,
					parents
				};
			}
			if (index < 0 && !acceptsEdge(state, parentCallId, subCallId)) return state;
			const settled = childResult(match, data, index < 0 ? void 0 : siblings[index]);
			const children = new Map(state.children);
			children.set(parentCallId, index < 0 ? [...siblings, settled] : siblings.map((child, at) => at === index ? settled : child));
			const parents = new Map(state.parents);
			if (index < 0) parents.set(subCallId, parentCallId);
			return {
				...state,
				children,
				parents
			};
		}
		function projectBlock(block, state, interruptedAt, visited = /* @__PURE__ */ new Set(), depth = 1) {
			if (!("kind" in block) && block.phase === "preparing") return block;
			if (visited.has(block.callId) || depth > MAX_DEPTH) return {
				...block,
				subCalls: []
			};
			const nextVisited = new Set(visited);
			nextVisited.add(block.callId);
			const children = (state.children.get(block.callId) ?? block.subCalls).map((child) => projectBlock(child, state, interruptedAt, nextVisited, depth + 1));
			const interruptionSeq = "kind" in block ? void 0 : interruptedAt?.seq;
			const interruptionTime = "kind" in block ? void 0 : interruptedAt?.time;
			const cached = projectedBlocks.get(block);
			if (cached !== void 0 && cached.interruptionSeq === interruptionSeq && cached.interruptionTime === interruptionTime && sameReferences(cached.children, children)) return cached.value;
			const projected = "kind" in block || interruptedAt === void 0 ? sameReferences(block.subCalls, children) ? block : {
				...block,
				subCalls: children
			} : {
				kind: "tool-result",
				seq: interruptedAt.seq + CHAT_SYNTHETIC_SEQ_OFFSETS.interruptedFollowup,
				time: interruptedAt.time,
				callId: block.callId,
				...block.parentCallId === void 0 ? {} : { parentCallId: block.parentCallId },
				name: block.name,
				args: block.args,
				call: {
					name: block.name,
					argsRaw: block.argsRaw
				},
				callTime: block.time,
				content: [],
				isError: true,
				error: {
					name: "Interrupted",
					code: "interrupted"
				},
				subCalls: children
			};
			projectedBlocks.set(block, {
				children,
				interruptionSeq,
				interruptionTime,
				value: projected
			});
			return projected;
		}
		function sameReferences(left, right) {
			return left.length === right.length && left.every((value, index) => value === right[index]);
		}
		function interruption(context) {
			const location = context.start?.location;
			if (location?.kind === "step" && location.step.status === "closed") return location.step.end;
			if ((location?.kind === "step" || location?.kind === "turn") && location.turn.status === "closed") return location.turn.end;
		}
		function fallbackState$2(context) {
			const match = context.matches.find((candidate) => candidate.event.type === "tool/result");
			const root = match === void 0 ? void 0 : rootResult(match);
			if (root === void 0) return void 0;
			let state = {
				root,
				children: /* @__PURE__ */ new Map(),
				parents: /* @__PURE__ */ new Map()
			};
			for (const candidate of context.matches) state = updateDispatch(state, candidate);
			return state;
		}
		/** Root Tool preparation, dispatch, result, and nested PTC calls. */
		const toolDefinition = {
			kind: "tool-call",
			target: "chat",
			match: (event) => {
				if (event.type === "assistant/live-chunk") {
					const chunk = event.data.chunk;
					if (chunk.type === "block-end" && chunk.block.type === "tool-call") return {
						id: String(chunk.block.id),
						role: "start"
					};
					return chunk.type === "tool-call-delta" ? {
						id: String(chunk.id),
						role: "start"
					} : null;
				}
				if (event.type === "tool/call") return {
					id: String(event.data.callId),
					role: "start"
				};
				if (event.type === "tool/result" && isAppendSurfaceEvent(event)) return {
					id: String(event.data.message.source.callId),
					role: "update"
				};
				if (event.type === "tool/ptc-dispatch-start" || event.type === "tool/ptc-dispatch") {
					const rootCallId = event.data.rootCallId;
					return typeof rootCallId === "string" && rootCallId !== "" ? {
						id: rootCallId,
						role: "update"
					} : null;
				}
				return null;
			},
			start: (_context, match) => {
				const state = {
					root: void 0,
					children: /* @__PURE__ */ new Map(),
					parents: /* @__PURE__ */ new Map()
				};
				return match.event.type === "tool/call" ? {
					...state,
					root: rootCall(match)
				} : applyDelta(state, match);
			},
			update: (context, match) => {
				if (match.event.type === "assistant/live-chunk") return applyDelta(context.state, match);
				if (match.event.type === "tool/call") return {
					...context.state,
					root: rootCall(match, context.state.root)
				};
				if (match.event.type === "tool/result") {
					const root = context.state.root;
					const result = rootResult(match, root !== void 0 && !("kind" in root) && root.phase === "start" ? root : void 0);
					return result === void 0 ? context.state : {
						...context.state,
						root: result
					};
				}
				return updateDispatch(context.state, match);
			},
			publication: (match) => match.event.type === "assistant/live-chunk" ? "animation-frame" : "immediate",
			buildViewNode: (context) => {
				const current = context.current.get("chat");
				const state = context.state ?? fallbackState$2(context);
				if (state?.root === void 0) return current == null ? null : current.visibility === "hidden" ? current : {
					...current,
					visibility: "hidden"
				};
				const interruptedAt = interruption(context);
				const projected = projectBlock(!("kind" in state.root) && state.root.phase === "preparing" ? preparingBlock(state.root, current?.data.root) : state.root, state, interruptedAt);
				const anchor = context.start?.event.seq ?? ("kind" in state.root ? state.root.seq : context.matches[0]?.event.seq ?? 0);
				const visibility = !("kind" in projected) && projected.phase === "preparing" && interruptedAt !== void 0 ? "hidden" : "visible";
				const location = contextLocation(context);
				const data = current?.data.root === projected ? current.data : { root: projected };
				if (current?.data === data && current.anchorSeq === anchor && current.visibility === visibility && current.location === location) return current;
				return chatNode(context, "tool-call", anchor, data, {
					visibility,
					location
				});
			}
		};
		/**
		* Register the root Tool lifecycle and nested-subcall contribution.
		* @param ctx - owning UI Conversation context.
		*/
		function registerToolConversationNode(ctx) {
			const match = toolDefinition.match.bind(toolDefinition);
			ctx.uiConversation.events.register({
				...toolDefinition,
				match: {
					"assistant/live-chunk": match,
					"tool/call": match,
					"tool/result": match,
					"tool/ptc-dispatch-start": match,
					"tool/ptc-dispatch": match
				}
			});
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/turn-error.js
		function lastStep$1(context) {
			const location = context.start?.location ?? context.matches[0]?.location;
			if (location?.kind !== "turn" && location?.kind !== "step") return 0;
			return location.turn.steps.at(-1)?.step ?? 0;
		}
		/**
		* Failure shown for a turn ending: a recorded error, a sign-out cancellation,
		* or a turn that restart recovery closed because the DSH process exited mid-turn.
		*/
		function endFailure(reason) {
			switch (reason.kind) {
				case "error": return reason.error;
				case "aborted": return reason.reason.kind === "hook" && reason.reason.reason === "deepseek-account/signed-out" ? {
					message: "Stopped because you signed out of DeepSeek.",
					code: "ACCOUNT_SIGNED_OUT"
				} : void 0;
				case "interrupted": return {
					message: "The DSH process exited before this turn finished.",
					code: "INTERRUPTED"
				};
				default: return;
			}
		}
		function failureFrom(match) {
			if (match.event.type !== "turn/end") return void 0;
			const failure = endFailure(match.event.data.reason);
			if (failure === void 0) return void 0;
			const display = displayFailure(failure);
			return {
				seq: match.event.seq,
				time: match.event.time,
				message: display.message,
				...display.code === void 0 ? {} : { code: display.code }
			};
		}
		function fallbackState$1(context) {
			const end = context.matches.find((match) => failureFrom(match) !== void 0);
			if (end?.event.type !== "turn/end") return void 0;
			const failure = failureFrom(end);
			if (failure === void 0) return void 0;
			return {
				turn: end.event.data.turn,
				failure
			};
		}
		/**
		* Terminal turn failure Definition. Retries run inside the failing turn, so the
		* turn's `llm/retry` history never suppresses this terminal row; the model-retry
		* node renders that history separately.
		*/
		const turnErrorDefinition = {
			kind: "turn-error",
			target: "chat",
			match: (event) => {
				if (event.type === "turn/start") return {
					id: String(event.data.turn),
					role: "start"
				};
				if (event.type === "turn/end" && endFailure(event.data.reason) !== void 0) return {
					id: String(event.data.turn),
					role: "update"
				};
				return null;
			},
			start: (_context, match) => {
				if (match.event.type !== "turn/start") throw new Error("turn-error start requires turn/start");
				return { turn: match.event.data.turn };
			},
			update: (context, match) => {
				const failure = failureFrom(match);
				return failure === void 0 ? context.state : {
					...context.state,
					failure
				};
			},
			buildViewNode: (context) => {
				const state = context.state ?? fallbackState$1(context);
				if (state?.failure === void 0) return null;
				const failure = state.failure;
				const node = {
					kind: "turn-error",
					seq: failure.seq,
					time: failure.time,
					turn: state.turn,
					step: lastStep$1(context),
					message: failure.message,
					...failure.code === void 0 ? {} : { code: failure.code }
				};
				return chatNode(context, "turn-error", node.seq, node, { groupTree: "turn" });
			}
		};
		/**
		* Register the terminal Turn-error business contribution.
		* @param ctx - owning UI Conversation context.
		*/
		function registerTurnErrorConversationNode(ctx) {
			ctx.uiConversation.events.register(turnErrorDefinition);
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/turn-max-tokens.js
		function lastStep(context) {
			const location = context.start?.location ?? context.matches[0]?.location;
			if (location?.kind !== "turn" && location?.kind !== "step") return 0;
			return location.turn.steps.at(-1)?.step ?? 0;
		}
		/**
		* Anchor the notice between the closing Assistant and the turn-tail so the
		* tail stays the turn's last Chat node and keeps its branch action enabled.
		* Without a closing text Assistant there is no branch action to protect, and
		* the turn/end seq keeps the notice at the truncation point.
		*/
		function noticeAnchor(context, seq) {
			const location = context.start?.location ?? context.matches[0]?.location;
			if (location?.kind !== "turn" && location?.kind !== "step") return seq;
			const closing = location.turn.data.get("turn-tail")?.closing;
			return closing === null || closing === void 0 ? seq : closing.finalNode.seq + CHAT_SYNTHETIC_SEQ_OFFSETS.maxTokensNotice;
		}
		function stateFrom(match) {
			if (match.event.type !== "turn/end" || match.event.data.reason.kind !== "max-tokens") return void 0;
			return {
				turn: match.event.data.turn,
				seq: match.event.seq,
				time: match.event.time
			};
		}
		/** Notice Definition for a turn the provider ended at its output-token cap. */
		const turnMaxTokensDefinition = {
			kind: "turn-max-tokens",
			target: "chat",
			match: (event) => {
				if (event.type === "turn/end" && event.data.reason.kind === "max-tokens") return {
					id: String(event.data.turn),
					role: "start"
				};
				return null;
			},
			start: (_context, match) => {
				const state = stateFrom(match);
				if (state === void 0) throw new Error("turn-max-tokens start requires a max-tokens turn/end");
				return state;
			},
			update: (context) => context.state,
			buildViewNode: (context) => {
				const state = context.state;
				if (state === void 0) return null;
				const node = {
					kind: "turn-max-tokens",
					seq: state.seq,
					time: state.time,
					turn: state.turn,
					step: lastStep(context)
				};
				return chatNode(context, "turn-max-tokens", noticeAnchor(context, state.seq), node, { groupTree: "turn" });
			}
		};
		/**
		* Register the max-tokens turn-end notice contribution.
		* @param ctx - owning UI Conversation context.
		*/
		function registerTurnMaxTokensConversationNode(ctx) {
			ctx.uiConversation.events.register(turnMaxTokensDefinition);
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/turn-process.js
		function eventTurn(event) {
			const data = event.data;
			return typeof data.turn === "number" ? data.turn : void 0;
		}
		function visibleChunk(chunk) {
			if (chunk.type === "text-delta" || chunk.type === "reasoning-delta") return chunk.text.trim() !== "";
			if (chunk.type === "block-start") return chunk.blockType !== "text" && chunk.blockType !== "reasoning" && chunk.blockType !== "tool-call";
			if (chunk.type !== "block-end") return false;
			const block = chunk.block;
			if (block.type === "tool-call") return false;
			if (block.type === "text" || block.type === "reasoning") return block.text.trim() !== "";
			return true;
		}
		function visibleAssistantEvent(event) {
			if (event.type === "assistant/live-chunk") return visibleChunk(event.data.chunk);
			if (event.type === "assistant/attempt") return false;
			return event.type === "assistant/message" && event.surfaceOp === "append" && toAssistantBlocks(event.data.message.content).some((block) => {
				if (block.kind === "tool-call") return false;
				if (block.kind === "text" || block.kind === "reasoning") return block.text.trim() !== "";
				return true;
			});
		}
		function processEvidence(event) {
			if (visibleAssistantEvent(event)) {
				if (event.type !== "assistant/live-chunk" && event.type !== "assistant/message" && event.type !== "assistant/attempt") return void 0;
				return {
					kind: "assistant",
					seq: event.seq,
					step: event.data.step
				};
			}
			if (event.type === "tool/call" || event.type === "tool/result" && event.surfaceOp === "append" || event.type === "llm/retry") return {
				kind: "other",
				seq: event.seq
			};
		}
		function turnLocation$1(context) {
			const location = context.start?.location ?? context.matches.at(-1)?.location;
			return location?.kind === "turn" || location?.kind === "step" ? location.turn : void 0;
		}
		function fallbackState(context) {
			const turn = context.matches.map((match) => eventTurn(match.event)).find((candidate) => candidate !== void 0);
			if (turn === void 0) return void 0;
			let state = {
				turn,
				assistantStartByStep: /* @__PURE__ */ new Map(),
				messageCountByStep: /* @__PURE__ */ new Map(),
				messageCount: 0,
				toolCallCount: 0,
				subagentCount: 0
			};
			for (const match of context.matches) state = updateProcessState(state, match.event);
			return state;
		}
		function isFinalAssistant(data) {
			return data?.finalNode !== void 0;
		}
		function latestAnswer(turn) {
			const data = turn.steps.at(-1)?.data.get("assistant-step");
			if (!isFinalAssistant(data) || !hasAssistantReplyContent(data.blocks)) return null;
			return data.blocks.some((block) => block.kind === "tool-call") ? null : data;
		}
		function processSpec(state, turn) {
			const controlAnchorSeq = state.controlAnchorSeq ?? turn.start?.seq;
			if (controlAnchorSeq === void 0) return null;
			const answer = latestAnswer(turn);
			const counts = {
				messageCount: answer === null ? state.messageCount : [...state.messageCountByStep].filter(([step]) => step < answer.step).reduce((total, [, count]) => total + count, 0),
				toolCallCount: state.toolCallCount,
				subagentCount: state.subagentCount
			};
			if (answer === null) return {
				turn: turn.turn,
				controlAnchorSeq,
				processStartSeq: controlAnchorSeq,
				answerAnchorSeq: null,
				answerStep: null,
				inlineReasoning: false,
				...counts
			};
			const inlineReasoning = answer.blocks.some((block) => block.kind === "reasoning" && block.text.trim() !== "");
			const earlierAssistantSeq = Math.min(...[...state.assistantStartByStep].filter(([step]) => step < answer.step).map(([, seq]) => seq));
			const externalProcessSeq = Math.min(state.otherStartSeq ?? Number.POSITIVE_INFINITY, earlierAssistantSeq);
			return {
				turn: turn.turn,
				controlAnchorSeq,
				processStartSeq: turn.start?.seq ?? (Number.isFinite(externalProcessSeq) ? externalProcessSeq : answer.finalNode.seq),
				answerAnchorSeq: answer.finalNode.seq,
				answerStep: answer.step,
				inlineReasoning,
				...counts
			};
		}
		function updateProcessState(state, event) {
			let current = state;
			if (event.type === "assistant/message" && event.surfaceOp === "append" && hasAssistantReplyContent(toAssistantBlocks(event.data.message.content))) {
				const messageCountByStep = new Map(current.messageCountByStep);
				messageCountByStep.set(event.data.step, (messageCountByStep.get(event.data.step) ?? 0) + 1);
				current = {
					...current,
					messageCountByStep,
					messageCount: current.messageCount + 1
				};
			}
			if (event.type === "tool/call") {
				const subagent = isSubagentDelegationTool(event.data.name);
				current = {
					...current,
					toolCallCount: current.toolCallCount + (subagent ? 0 : 1),
					subagentCount: current.subagentCount + (subagent ? 1 : 0)
				};
			}
			const evidence = processEvidence(event);
			if (evidence === void 0) return current;
			if (evidence.kind === "other") return current.otherStartSeq === void 0 ? {
				...current,
				otherStartSeq: evidence.seq,
				controlAnchorSeq: Math.min(current.controlAnchorSeq ?? Number.POSITIVE_INFINITY, evidence.seq)
			} : current;
			if (current.assistantStartByStep.has(evidence.step)) return current;
			const assistantStartByStep = new Map(current.assistantStartByStep);
			assistantStartByStep.set(evidence.step, evidence.seq);
			return {
				...current,
				assistantStartByStep,
				controlAnchorSeq: Math.min(current.controlAnchorSeq ?? Number.POSITIVE_INFINITY, evidence.seq)
			};
		}
		/** Turn-scoped process range and answer-boundary Definition. */
		const turnProcessDefinition = {
			kind: "turn-process",
			target: "chat",
			match: (event) => {
				if (event.type === "turn/start") return {
					id: String(event.data.turn),
					role: "start"
				};
				const turn = eventTurn(event);
				if (turn === void 0) return null;
				if (event.type === "assistant/live-chunk" || event.type === "assistant/message" || event.type === "tool/call" || event.type === "tool/result" || event.type === "llm/retry" || event.type === "step/start" || event.type === "step/end" || event.type === "turn/end") return {
					id: String(turn),
					role: "update"
				};
				return null;
			},
			start: (_context, match) => {
				if (match.event.type !== "turn/start") throw new Error("turn-process start requires turn/start");
				return {
					turn: match.event.data.turn,
					assistantStartByStep: /* @__PURE__ */ new Map(),
					messageCountByStep: /* @__PURE__ */ new Map(),
					messageCount: 0,
					toolCallCount: 0,
					subagentCount: 0
				};
			},
			update: (context, match) => updateProcessState(context.state, match.event),
			publication: (match) => {
				if (match.event.type === "assistant/live-chunk") {
					const type = match.event.data.chunk.type;
					return type === "usage" || type === "finish" ? "none" : "animation-frame";
				}
				return "immediate";
			},
			buildLocationData: (context, scope, previous) => {
				if (scope !== "turn") return null;
				const state = context.state ?? fallbackState(context);
				if (state === void 0) return null;
				const turn = turnLocation$1(context);
				if (turn === void 0) return null;
				const current = context.current.get("chat");
				const latestStep = turn.steps.at(-1);
				if (previous?.kind === "turn" && previous.key === "turn-process" && current?.kind === "turn-process" && current.data.answerAnchorSeq === null && current.data.controlAnchorSeq === state.controlAnchorSeq && current.data.messageCount === state.messageCount && current.data.toolCallCount === state.toolCallCount && current.data.subagentCount === state.subagentCount && turn.status !== "closed" && latestStep?.status !== "closed") return previous;
				const spec = processSpec(state, turn);
				if (spec === null) return null;
				if (previous?.kind === "turn" && previous.turn === spec.turn && previous.key === "turn-process" && sameTurnProcessSpec(previous.value, spec)) return previous;
				return {
					kind: "turn",
					turn: turn.turn,
					key: "turn-process",
					value: spec
				};
			},
			buildViewNode: (context) => {
				const turn = turnLocation$1(context);
				const data = turn?.data.get("turn-process");
				if (turn === void 0 || data === void 0) return null;
				const current = context.current.get("chat");
				const state = context.state;
				if (current?.kind === "turn-process" && state !== void 0 && current.data.answerAnchorSeq === null && current.data.controlAnchorSeq === state.controlAnchorSeq && current.data.messageCount === state.messageCount && current.data.toolCallCount === state.toolCallCount && current.data.subagentCount === state.subagentCount && turn.status !== "closed" && turn.steps.at(-1)?.status !== "closed" && current.location === (context.start?.location ?? context.matches[0]?.location)) return current;
				return chatNode(context, "turn-process", data.controlAnchorSeq + CHAT_SYNTHETIC_SEQ_OFFSETS.processControl, data, { groupTree: "turn" });
			}
		};
		/**
		* Register the Turn-scoped process disclosure projection.
		* @param ctx - owning UI Conversation context.
		*/
		function registerTurnProcess(ctx) {
			const match = turnProcessDefinition.match.bind(turnProcessDefinition);
			ctx.uiConversation.events.register({
				...turnProcessDefinition,
				match: {
					"turn/start": match,
					"assistant/live-chunk": match,
					"assistant/message": match,
					"tool/call": match,
					"tool/result": match,
					"llm/retry": match,
					"step/start": match,
					"step/end": match,
					"turn/end": match
				}
			});
		}
		//#endregion
		//#region ../../llm/llm/lib/types/assistant-stream.js
		/**
		* The last raw chunk of one never-packed type, scanning backwards and stopping at the first hit.
		* @param stream - compact records from one durable Assistant settlement.
		* @param type - chunk type that only appears as a raw record.
		* @returns the stream's final chunk of that type, or undefined when it has none.
		*/
		function lastAssistantStreamChunk(stream, type) {
			for (let index = stream.length - 1; index >= 0; index -= 1) {
				const record = stream[index];
				if (record.type === "chunk" && record.chunk.type === type) return record.chunk;
			}
		}
		//#endregion