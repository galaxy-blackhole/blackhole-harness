/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js — CẮT LẠI 08/11/2026
 *      theo MOT kieu duy nhat (region-based), gộp/cắt tiếp để mỗi lát ≤ 900 dòng.
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#region lib/types/client/conversation-nodes/assistant.js
		function initialState(turn, step) {
			return {
				turn,
				step,
				blocks: [],
				visibleBlocks: 0,
				firstVisibleSeq: void 0,
				firstVisibleTime: void 0,
				firstTokenTime: void 0,
				final: void 0,
				usage: void 0
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
		function hasVisibleContent(blocks) {
			return blocks.some(blockIsVisible);
		}
		function hasInterruptionEvidence(blocks) {
			return blocks.some((block) => {
				if (block.kind === "text" || block.kind === "reasoning") return block.text.trim() !== "";
				return true;
			});
		}
		function resetForRetry(state) {
			return {
				...initialState(state.turn, state.step),
				firstTokenTime: state.firstTokenTime
			};
		}
		function updateChunk(state, chunk, seq, time) {
			if (chunk.type === "tool-call-delta") {
				const previous = state.blocks[chunk.index];
				if (previous?.kind === "tool-call" && previous.callId !== "" && (chunk.name === void 0 || chunk.name === previous.name) && (state.firstTokenTime !== void 0 || !isTokenDelta(chunk))) return state;
			}
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
					blocks[chunk.index] = {
						kind: "tool-call",
						callId: (previous?.kind === "tool-call" ? previous.callId : "") || String(chunk.id),
						name: chunk.name ?? (previous?.kind === "tool-call" ? previous.name : ""),
						argsRaw: previous?.kind === "tool-call" ? previous.argsRaw : ""
					};
					break;
				}
				case "block-end":
					changedIndex = chunk.index;
					previousVisible = blockIsVisible(blocks[chunk.index]);
					blocks[chunk.index] = toAssistantBlock(chunk.block);
					break;
				case "usage": return {
					...state,
					usage: chunk.usage
				};
				default: return state;
			}
			const visibleBlocks = state.visibleBlocks - Number(previousVisible) + Number(blockIsVisible(blocks[changedIndex]));
			const firstToken = isTokenDelta(chunk);
			return {
				...state,
				blocks,
				visibleBlocks,
				...visibleBlocks > 0 && state.firstVisibleSeq === void 0 ? {
					firstVisibleSeq: seq,
					firstVisibleTime: time
				} : {},
				...firstToken && state.firstTokenTime === void 0 ? { firstTokenTime: time } : {}
			};
		}
		function settleMessage(state, match, event) {
			const blocks = toAssistantBlocks(event.data.message.content);
			return {
				...state,
				blocks,
				visibleBlocks: countVisibleBlocks(blocks),
				final: match,
				usage: event.data.usage
			};
		}
		function closedBoundary(location) {
			if (location.kind === "step" && location.step.status === "closed" && location.step.end !== void 0) return location.step.end;
			if ((location.kind === "step" || location.kind === "turn") && location.turn.status === "closed" && location.turn.end !== void 0) return location.turn.end;
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
					timing: {
						stepStartTime: context.start?.event.time ?? null,
						firstTokenTime: state.firstTokenTime ?? null,
						completedTime: event.time
					},
					...event.data.interrupted === true ? { interrupted: true } : {}
				};
			}
			const location = context.start?.location ?? context.matches.at(-1)?.location;
			const boundary = location === void 0 ? void 0 : closedBoundary(location);
			if (boundary === void 0) return void 0;
			const blocks = compactBlocks(state.blocks);
			if (!hasInterruptionEvidence(blocks)) return void 0;
			return {
				kind: "assistant",
				seq: boundary.seq + CHAT_SYNTHETIC_SEQ_OFFSETS.interruptedAssistant,
				time: boundary.time,
				turn: state.turn,
				step: state.step,
				blocks,
				interrupted: true
			};
		}
		function fallbackState$5(context) {
			let state;
			for (const match of context.matches) {
				if (match.event.type === "assistant/live-chunk") {
					state ??= initialState(match.event.data.turn, match.event.data.step);
					state = updateChunk(state, match.event.data.chunk, match.event.seq, match.event.time);
					continue;
				}
				if (match.event.type === "assistant/message") {
					state ??= initialState(match.event.data.turn, match.event.data.step);
					state = settleMessage(state, match, match.event);
					continue;
				}
				if (match.event.type === "llm/retry" && state !== void 0) state = resetForRetry(state);
			}
			return state;
		}
		function projectAssistant(context) {
			const state = context.state ?? fallbackState$5(context);
			if (state === void 0) return void 0;
			const settled = finalNode(state, context);
			const blocks = settled?.blocks ?? compactBlocks(state.blocks);
			const visible = settled === void 0 ? state.visibleBlocks > 0 : hasVisibleContent(blocks);
			const status = settled?.interrupted === true ? "interrupted" : settled === void 0 ? "running" : "settled";
			const anchorSeq = (settled?.interrupted === true ? settled.seq : state.firstVisibleSeq ?? settled?.seq) ?? context.matches[0]?.event.seq ?? 0;
			const time = settled?.time ?? state.firstVisibleTime ?? context.matches[0]?.event.time ?? 0;
			return {
				anchorSeq,
				visible,
				settled,
				data: {
					status,
					turn: state.turn,
					step: state.step,
					blocks,
					time,
					...state.usage === void 0 ? {} : { usage: state.usage },
					...settled === void 0 ? {} : { finalNode: settled }
				}
			};
		}
		function publishedAssistantData(context) {
			const location = context.start?.location ?? context.matches.at(-1)?.location;
			return location?.kind === "step" ? location.step.data.get("assistant-step") : void 0;
		}
		/** Per-step Assistant lifecycle; materialized keys survive cleared stream content as hidden Nodes. */
		const assistantDefinition = {
			kind: "assistant-step",
			target: "chat",
			match: (event) => {
				if (event.type === "step/start") return {
					id: `${event.data.turn}:${event.data.step}`,
					role: "start"
				};
				if (event.type === "assistant/live-chunk" || event.type === "assistant/message" && event.surfaceOp === "append") return {
					id: `${event.data.turn}:${event.data.step}`,
					role: "update"
				};
				if (event.type === "llm/retry") return {
					id: `${event.data.turn}:${event.data.step}`,
					role: "update"
				};
				return null;
			},
			start: (_context, match) => {
				if (match.event.type !== "step/start") throw new Error("assistant-step start requires step/start");
				return initialState(match.event.data.turn, match.event.data.step);
			},
			update: (context, match) => {
				if (match.event.type === "assistant/live-chunk") return updateChunk(context.state, match.event.data.chunk, match.event.seq, match.event.time);
				if (match.event.type === "assistant/message") return settleMessage(context.state, match, match.event);
				if (match.event.type === "llm/retry") return resetForRetry(context.state);
				return context.state;
			},
			publication: (match) => {
				if (match.event.type === "step/start") return "none";
				if (match.event.type !== "assistant/live-chunk") return "immediate";
				const type = match.event.data.chunk.type;
				return type === "usage" || type === "finish" ? "none" : "animation-frame";
			},
			buildLocationData: (context, scope) => {
				if (scope !== "step") return null;
				const projected = projectAssistant(context);
				if (projected === void 0) return null;
				return {
					kind: "step",
					turn: projected.data.turn,
					step: projected.data.step,
					key: "assistant-step",
					value: projected.data
				};
			},
			buildViewNode: (context) => {
				const current = context.current.get("chat");
				const state = context.state ?? fallbackState$5(context);
				const data = publishedAssistantData(context);
				if (state === void 0 || data === void 0) return current == null ? null : {
					...current,
					visibility: "hidden"
				};
				const settled = data.finalNode;
				const visible = settled === void 0 ? state.visibleBlocks > 0 : hasVisibleContent(data.blocks);
				if (settled === void 0 && !visible && current == null) return null;
				return chatNode(context, "assistant-step", (settled?.interrupted === true ? settled.seq : state.firstVisibleSeq ?? settled?.seq) ?? context.matches[0]?.event.seq ?? 0, data, { visibility: settled?.interrupted === true || visible ? "visible" : "hidden" });
			}
		};
		/**
		* Register the Assistant lifecycle business contribution.
		* @param ctx - owning UI Conversation context.
		*/
		function registerAssistantConversationNode(ctx) {
			const match = assistantDefinition.match.bind(assistantDefinition);
			ctx.uiConversation.events.register({
				...assistantDefinition,
				match: {
					"step/start": match,
					"assistant/live-chunk": match,
					"assistant/message": match,
					"llm/retry": match
				}
			});
		}
		//#endregion
		//#region lib/types/client/contract/chat-nodes.js
		/**
		* Test whether a Tool root has settled.
		* @param block - Tool root lifecycle value.
		* @returns whether the root carries its final result.
		*/
		function isSettledTool(block) {
			return "kind" in block;
		}
		/**
		* Test whether a Tool root is still running.
		* @param block - Tool root lifecycle value.
		* @returns whether the root lacks a final result.
		*/
		function isRunningTool(block) {
			return !isSettledTool(block);
		}
		//#endregion
		//#region lib/types/client/contract/chat-visibility.js
		/**
		* Exclude system prompts, ordinary Context, and permission commands from visible Chat rows.
		* Context containing tool changes retains its notice row.
		* @param node - projected Chat node.
		* @returns whether the node contributes a visible Chat row.
		*/
		function isVisibleChatNode(node) {
			return node.visibility === "visible" && node.kind !== "system-prompt" && (node.kind !== "context" || node.data.content.some((block) => block.type === "tool-addition" || block.type === "tool-removal")) && !(node.kind === "command" && node.data.name === "permission");
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/group-tree-segments.js
		const NO_TURNS = [];
		/**
		* Loaded Turns split into consecutive segments at the Turns holding a Node at
		* one group-tree position, visible or hidden. The latest segment starts at the
		* last such Turn, or at the first loaded Turn when none is loaded. Node changes
		* update per-Turn counts without scanning the loaded Nodes; `settle` returns at
		* once while the start holds and otherwise reads loaded Turns only from the
		* earlier of the previous and new starts.
		*/
		var GroupTreeSegments = class {
			position;
			/** Opening Node count by owning Turn. */
			openings = /* @__PURE__ */ new Map();
			latestOpening;
			latestStart;
			/** @param position - group-tree position whose Nodes open a segment. */
			constructor(position) {
				this.position = position;
			}
			/**
			* Account one Node change.
			* @param previous - replaced Node; absent for an addition.
			* @param next - replacing Node; absent for a removal.
			*/
			track(previous, next) {
				const before = this.openingTurn(previous);
				const after = this.openingTurn(next);
				if (before === after) return;
				if (before !== void 0 && this.adjust(before, -1) === 0 && before === this.latestOpening) this.latestOpening = this.lastOpeningTurn();
				if (after !== void 0) {
					this.adjust(after, 1);
					if (this.latestOpening === void 0 || after > this.latestOpening) this.latestOpening = after;
				}
			}
			/**
			* Test latest-segment membership as of the last `settle`.
			* @param turn - owning Turn, when resolved.
			* @returns whether the Turn belongs to the latest segment.
			*/
			inLatest(turn) {
				return turn !== void 0 && this.latestStart !== void 0 && turn >= this.latestStart;
			}
			/**
			* Move the latest segment start for the currently loaded Turns.
			* @param turnOrder - loaded Turns in ascending timeline order.
			* @returns loaded Turns that entered or left the latest segment, in ascending order.
			*/
			settle(turnOrder) {
				const previous = this.latestStart;
				const start = this.latestOpening ?? turnOrder[0];
				if (start === previous) return NO_TURNS;
				this.latestStart = start;
				const bounded = previous !== void 0 && start !== void 0;
				const low = bounded ? Math.min(previous, start) : Number.NEGATIVE_INFINITY;
				const high = bounded ? Math.max(previous, start) : Number.POSITIVE_INFINITY;
				const changed = [];
				for (const turn of turnOrder.slice(turnOrder.findLastIndex((turn) => turn < low) + 1)) {
					if (turn >= high) break;
					changed.push(turn);
				}
				return changed;
			}
			openingTurn(node) {
				return node !== void 0 && isAtOrOutside(node, this.position) ? locationCoordinates(node.location).turn : void 0;
			}
			lastOpeningTurn() {
				let last;
				for (const turn of this.openings.keys()) if (last === void 0 || turn > last) last = turn;
				return last;
			}
			/** @returns the Turn's opening count after the change; zero removes the Turn. */
			adjust(turn, delta) {
				const next = (this.openings.get(turn) ?? 0) + delta;
				if (next > 0) this.openings.set(turn, next);
				else this.openings.delete(turn);
				return next;
			}
		};
		//#endregion
		//#region lib/types/client/conversation-nodes/turn-navigation.js
		/**
		* Preview budgets, sized to the rail card's clamps (one prompt line, up to
		* three response lines) and mirrored by the turnOutline projection so a turn
		* shows the same words before and after its events load. Anything past a
		* budget is invisible; copying whole transcripts into navigation state would
		* otherwise grow with the loaded window on every structural update.
		*/
		const PROMPT_PREVIEW_LIMIT = 50;
		const RESPONSE_PREVIEW_LIMIT = 120;
		/** Join rendered text, collapse whitespace, and cap at `limit` with a trailing ellipsis when clipped. */
		function preview(parts, limit) {
			let text = "";
			let unread = false;
			for (const part of parts) {
				if (text.length >= limit * 2) {
					unread = true;
					break;
				}
				const clipped = part.length > limit * 2;
				const chunk = clipped ? part.slice(0, limit * 2) : part;
				text += text === "" ? chunk : ` ${chunk}`;
				if (clipped) {
					unread = true;
					break;
				}
			}
			const normalized = text.replace(/\s+/g, " ").trim();
			if (normalized.length > limit - 1) return `${normalized.slice(0, limit - 1).trimEnd()}…`;
			return unread ? `${normalized}…` : normalized;
		}
		function promptText(node) {
			if (node.kind !== "user") return "";
			return preview(node.data.content.flatMap((block) => block.type === "text" ? [block.text] : []), PROMPT_PREVIEW_LIMIT);
		}
		function responseText(node) {
			if (node.kind !== "assistant-step") return "";
			return preview(node.data.blocks.flatMap((block) => block.kind === "text" ? [block.text] : []), RESPONSE_PREVIEW_LIMIT);
		}
		/**
		* Whether two items carry the same rail state, so the reader can keep its array.
		* @param left - previously published item, when the Turn had one.
		* @param right - freshly derived item, when the Turn still has one.
		* @returns whether both sides describe the same mark.
		*/
		function sameTurnNavigationItem(left, right) {
			if (left === void 0 || right === void 0) return left === right;
			return left.turn === right.turn && left.anchorKey === right.anchorKey && left.prompt === right.prompt && left.response === right.response;
		}
		/**
		* Project one loaded Turn into its rail item.
		* @param turn - Turn number the item addresses.
		* @param locations - live Location index supplying the Turn's node keys.
		* @param nodes - live Chat node store.
		* @returns the item, or undefined when the Turn has no visible loaded node.
		*/
		function turnNavigationItem(turn, locations, nodes) {
			const loaded = locations.getTurn(turn).map((key) => nodes.get(key)).filter((node) => node !== void 0 && isVisibleChatNode(node));
			const user = loaded.find((node) => node.kind === "user");
			const anchor = user ?? loaded[0];
			if (anchor === void 0) return void 0;
			const response = loaded.findLast((node) => responseText(node) !== "");
			return {
				turn,
				anchorKey: anchor.key,
				prompt: user === void 0 ? "" : promptText(user),
				response: response === void 0 ? "" : responseText(response)
			};
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/turn-process-presentation.js
		function nodeTurn(node) {
			const location = node?.location;
			return location?.kind === "turn" || location?.kind === "step" ? location.turn.turn : void 0;
		}
		function samePresentation(left, right) {
			return left === right || left !== void 0 && right !== void 0 && left.spec === right.spec && left.turn === right.turn && left.turnStarted === right.turnStarted && left.turnClosed === right.turnClosed && left.hasExternalProcess === right.hasExternalProcess && left.hasInterleavedInput === right.hasInterleavedInput && left.compactAnswer === right.compactAnswer;
		}
		function derivePresentation(turn, locations, nodes) {
			const keys = locations.getTurn(turn);
			const control = keys.map((key) => nodes.get(key)).find((node) => node?.kind === "turn-process");
			if (control === void 0) return void 0;
			const spec = control.data;
			const location = control.location;
			if (location.kind !== "turn" && location.kind !== "step") return void 0;
			let openingHumanAnchor;
			for (const key of keys) {
				const node = nodes.get(key);
				if (node !== void 0 && isAtOrOutside(node, "input") && (spec.controlAnchorSeq === location.turn.start?.seq || node.anchorSeq < spec.controlAnchorSeq)) openingHumanAnchor = Math.max(openingHumanAnchor ?? node.anchorSeq, node.anchorSeq);
			}
			let hasExternalProcess = false;
			let hasInterleavedInput = false;
			let compactAnswer = true;
			for (const key of keys) {
				const node = nodes.get(key);
				if (node === void 0 || !isVisibleChatNode(node) || node.kind === "turn-process") continue;
				if (isAtOrOutside(node, "input") && (openingHumanAnchor === void 0 || node.anchorSeq > openingHumanAnchor)) {
					hasInterleavedInput = true;
					if (spec.answerAnchorSeq === null || node.anchorSeq < spec.answerAnchorSeq) compactAnswer = false;
				}
				if (isAtOrOutside(node, "turn") || node.anchorSeq < spec.processStartSeq || spec.answerAnchorSeq !== null && node.anchorSeq >= spec.answerAnchorSeq) continue;
				if (node.kind !== "assistant-step" || spec.answerStep === null || node.data.step !== spec.answerStep) hasExternalProcess = true;
			}
			return {
				turn,
				spec,
				turnStarted: location.turn.start !== void 0,
				turnClosed: location.turn.status === "closed",
				hasExternalProcess,
				hasInterleavedInput,
				compactAnswer
			};
		}
		/** Mutable projection of cross-Node process layout facts by Turn. */
		var ChatTurnProcessProjector = class {
			presentations = /* @__PURE__ */ new Map();
			/**
			* Read the retained process presentation for a Node's Turn.
			* @param node - Current Chat Node.
			* @returns The Turn's process presentation, when present.
			*/
			get(node) {
				const turn = nodeTurn(node);
				return turn === void 0 ? void 0 : this.presentations.get(turn);
			}
			/**
			* Replace every projected Turn.
			* @param order - visible Chat Node order.
			* @param locations - current Chat Location index.
			* @param nodes - current Chat Node store.
			* @returns Turns whose process presentation changed.
			*/
			replace(order, locations, nodes) {
				const turns = /* @__PURE__ */ new Set();
				for (const key of order) {
					const turn = nodeTurn(nodes.get(key));
					if (turn !== void 0) turns.add(turn);
				}
				const changed = /* @__PURE__ */ new Set();
				for (const turn of new Set([...this.presentations.keys(), ...turns])) if (this.set(turn, turns.has(turn) ? derivePresentation(turn, locations, nodes) : void 0)) changed.add(turn);
				return changed;
			}
			/**
			* Recompute selected Turns after incremental Node changes.
			* @param turns - affected Turn numbers.
			* @param locations - current Chat Location index.
			* @param nodes - current Chat Node store.
			* @returns Turns whose process presentation changed.
			*/
			update(turns, locations, nodes) {
				const changed = /* @__PURE__ */ new Set();
				for (const turn of turns) if (this.set(turn, derivePresentation(turn, locations, nodes))) changed.add(turn);
				return changed;
			}
			set(turn, next) {
				if (samePresentation(this.presentations.get(turn), next)) return false;
				if (next === void 0) this.presentations.delete(turn);
				else this.presentations.set(turn, next);
				return true;
			}
		};
		//#endregion