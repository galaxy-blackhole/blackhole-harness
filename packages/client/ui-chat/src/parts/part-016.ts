/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js — CẮT LẠI 08/11/2026
 *      theo MOT kieu duy nhat (region-based), gộp/cắt tiếp để mỗi lát ≤ 900 dòng.
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#region ../../llm/token-meter/lib/types/turn-usage.js
		function isCount(value) {
			return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
		}
		function safeSum(values) {
			let total = 0;
			for (const value of values) {
				total += value;
				if (!Number.isSafeInteger(total)) return void 0;
			}
			return total;
		}
		function messageRoute(message) {
			const { provider, model } = message.source;
			return provider.length > 0 && model.length > 0 ? {
				provider,
				model
			} : void 0;
		}
		function streamUsage(stream) {
			return lastAssistantStreamChunk(stream, "usage")?.usage;
		}
		function normalizeUsage(usage, route) {
			const { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, reasoningTokens, totalTokens } = usage;
			if (!isCount(inputTokens) || !isCount(outputTokens)) return void 0;
			if (cacheReadTokens !== void 0 && !isCount(cacheReadTokens)) return void 0;
			if (cacheWriteTokens !== void 0 && !isCount(cacheWriteTokens)) return void 0;
			if (reasoningTokens !== void 0 && (!isCount(reasoningTokens) || reasoningTokens > outputTokens)) return;
			const knownPrompt = safeSum([
				inputTokens,
				...cacheReadTokens === void 0 ? [] : [cacheReadTokens],
				...cacheWriteTokens === void 0 ? [] : [cacheWriteTokens]
			]);
			if (knownPrompt === void 0) return void 0;
			let exactTotal;
			if (totalTokens !== void 0) {
				if (!isCount(totalTokens)) return void 0;
				const exactPrompt = totalTokens - outputTokens;
				if (!isCount(exactPrompt) || exactPrompt < knownPrompt) return void 0;
				if (cacheReadTokens !== void 0 && cacheWriteTokens !== void 0 && exactPrompt !== knownPrompt) return;
				exactTotal = totalTokens;
			} else {
				if (cacheReadTokens === void 0 || cacheWriteTokens === void 0) return void 0;
				const derivedTotal = safeSum([knownPrompt, outputTokens]);
				if (derivedTotal === void 0) return void 0;
				exactTotal = derivedTotal;
			}
			return {
				inputTokens,
				outputTokens,
				totalTokens: exactTotal,
				...cacheReadTokens === void 0 ? {} : { cacheReadTokens },
				...cacheWriteTokens === void 0 ? {} : { cacheWriteTokens },
				...reasoningTokens === void 0 ? {} : { reasoningTokens },
				...route === void 0 ? {} : { route }
			};
		}
		function aggregateAttempts(attempts) {
			if (attempts.length === 0) return void 0;
			const inputTokens = safeSum(attempts.map((attempt) => attempt.inputTokens));
			const outputTokens = safeSum(attempts.map((attempt) => attempt.outputTokens));
			const totalTokens = safeSum(attempts.map((attempt) => attempt.totalTokens));
			if (inputTokens === void 0 || outputTokens === void 0 || totalTokens === void 0) return void 0;
			const cacheRead = attempts.map((attempt) => attempt.cacheReadTokens);
			const cacheWrite = attempts.map((attempt) => attempt.cacheWriteTokens);
			const reasoning = attempts.map((attempt) => attempt.reasoningTokens);
			const cacheReadTokens = cacheRead.every(isCount) ? safeSum(cacheRead) : void 0;
			const cacheWriteTokens = cacheWrite.every(isCount) ? safeSum(cacheWrite) : void 0;
			const reasoningTokens = reasoning.every(isCount) ? safeSum(reasoning) : void 0;
			let routes;
			const attributed = attempts.map((attempt) => attempt.route);
			if (attributed.every((route) => route !== void 0)) {
				const unique = /* @__PURE__ */ new Map();
				for (const route of attributed) unique.set(`${route.provider}\0${route.model}`, route);
				routes = [...unique.values()];
			}
			return {
				uncachedInputTokens: inputTokens,
				outputTokens,
				totalTokens,
				...cacheReadTokens === void 0 ? {} : { cacheReadTokens },
				...cacheWriteTokens === void 0 ? {} : { cacheWriteTokens },
				...reasoningTokens === void 0 ? {} : { reasoningTokens },
				...routes === void 0 ? {} : { routes }
			};
		}
		function sameAttempt(state, turn, step) {
			return state.turn === turn && state.step === step;
		}
		/**
		* Fold one complete Turn's durable attempt lifecycle into exact token accounting.
		*
		* No attempt is inferred from a usage sample. Any missing lifecycle boundary,
		* incomplete attempt usage, unsafe count, or contradictory exact total makes
		* the whole disclosure unavailable.
		* @param events - Turn-local durable events from `turn/start` through `turn/end`.
		* @returns exact aggregate usage, or undefined when it cannot be proven.
		*/
		function deriveTurnTokenUsage(events) {
			let state = { kind: "idle" };
			const attempts = [];
			let turn;
			let sawEnd = false;
			let invalid = false;
			const closeOpen = (route) => {
				if (state.kind !== "open" || state.sample === void 0) return false;
				const normalized = normalizeUsage(state.sample, route);
				if (normalized === void 0) return false;
				attempts.push(normalized);
				return true;
			};
			for (const event of events) {
				if (invalid) break;
				if (event.type === "turn/start") {
					if (turn !== void 0 || state.kind !== "idle") invalid = true;
					else turn = event.data.turn;
					continue;
				}
				if (turn === void 0) {
					invalid = true;
					break;
				}
				if (event.type === "turn/end") {
					if (event.data.turn !== turn || state.kind !== "idle" || sawEnd) invalid = true;
					else sawEnd = true;
					continue;
				}
				if (sawEnd) {
					invalid = true;
					break;
				}
				if (event.type === "step/start") {
					if (event.data.turn !== turn || state.kind !== "idle") invalid = true;
					else state = {
						kind: "open",
						turn,
						step: event.data.step
					};
					continue;
				}
				if (event.type === "llm/retry-started") {
					if (event.data.turn !== turn || state.kind !== "settled" || state.by !== "retry" || !sameAttempt(state, event.data.turn, event.data.step)) invalid = true;
					else state = {
						kind: "open",
						turn,
						step: event.data.step
					};
					continue;
				}
				if (event.type === "assistant/attempt") {
					if (event.data.turn !== turn || state.kind !== "open" || !sameAttempt(state, event.data.turn, event.data.step)) {
						invalid = true;
						continue;
					}
					const sample = streamUsage(event.data.stream) ?? state.sample;
					state = {
						kind: "open",
						turn,
						step: event.data.step,
						...sample === void 0 ? {} : { sample }
					};
					if (!closeOpen()) invalid = true;
					else state = {
						kind: "finishClosed",
						turn,
						step: event.data.step
					};
					continue;
				}
				if (event.type === "assistant/message") {
					if (event.data.turn !== turn || state.kind !== "open" || !sameAttempt(state, event.data.turn, event.data.step)) {
						invalid = true;
						continue;
					}
					const sample = event.data.usage ?? streamUsage(event.data.stream);
					if (sample !== void 0) state = {
						...state,
						sample
					};
					if (!closeOpen(messageRoute(event.data.message))) invalid = true;
					else state = {
						kind: "settled",
						turn,
						step: event.data.step,
						by: "message"
					};
					continue;
				}
				if (event.type === "llm/retry") {
					if (event.data.turn !== turn || state.kind === "idle" || !sameAttempt(state, event.data.turn, event.data.step)) {
						invalid = true;
						continue;
					}
					if (state.kind === "settled" || state.kind === "open" && !closeOpen()) invalid = true;
					if (!invalid) state = {
						kind: "settled",
						turn,
						step: event.data.step,
						by: "retry"
					};
					continue;
				}
				if (event.type === "step/end") {
					if (event.data.turn !== turn || state.kind === "idle" || !sameAttempt(state, event.data.turn, event.data.step)) {
						invalid = true;
						continue;
					}
					if (state.kind === "open" && !closeOpen()) invalid = true;
					if (!invalid) state = { kind: "idle" };
				}
			}
			return invalid || !sawEnd || state.kind !== "idle" ? void 0 : aggregateAttempts(attempts);
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/turn-tail.js
		function isSessionEvent(event) {
			return event.type !== "assistant/live-chunk";
		}
		function turnCoordinates(event) {
			if (event.type === "assistant/message" || event.type === "assistant/attempt" || event.type === "assistant/live-chunk" || event.type === "step/start" || event.type === "step/end") return {
				turn: event.data.turn,
				step: event.data.step
			};
			if (event.type === "llm/retry" || event.type === "llm/retry-started") return {
				turn: event.data.turn,
				step: event.data.step
			};
		}
		function turnLocation(context) {
			const location = context.start?.location ?? context.matches[0]?.location;
			return location?.kind === "turn" || location?.kind === "step" ? location.turn : void 0;
		}
		function hasText(data) {
			return data.finalNode !== void 0 && data.blocks.some((block) => block.kind === "text" && block.text.trim() !== "");
		}
		function tailData(context) {
			const end = context.state === void 0 ? context.matches.find((match) => match.event.type === "turn/end") : context.state.end;
			if (end?.event.type !== "turn/end") return null;
			const turn = turnLocation(context);
			if (turn === void 0) return null;
			const finalized = turn.steps.map((step) => step.data.get("assistant-step")).filter((candidate) => candidate !== void 0).filter((candidate) => candidate.finalNode !== void 0).sort((left, right) => left.finalNode.seq - right.finalNode.seq);
			const closing = finalized.findLast(hasText) ?? null;
			let latestTranscriptSeq = finalized.at(-1)?.finalNode.seq;
			for (const match of context.matches) {
				const event = match.event;
				const candidate = event.type === "tool/call" || event.type === "tool/result" && event.surfaceOp === "append" || event.type === "turn/end" && event.data.reason.kind === "error" || event.type === "llm/retry" ? event.seq : void 0;
				if (candidate !== void 0 && (latestTranscriptSeq === void 0 || candidate > latestTranscriptSeq)) latestTranscriptSeq = candidate;
			}
			const tokenUsage = context.start?.event.type === "turn/start" ? deriveTurnTokenUsage(context.matches.map((match) => match.event).filter(isSessionEvent)) : void 0;
			return {
				turn: end.event.data.turn,
				seq: end.event.seq,
				time: end.event.time,
				closing,
				branchUnavailable: closing === null || latestTranscriptSeq !== closing.finalNode.seq,
				...tokenUsage === void 0 ? {} : { tokenUsage }
			};
		}
		/** Completed-turn footer Definition independent of any Assistant row. */
		const turnTailDefinition = {
			kind: "turn-tail",
			target: "chat",
			match: (event) => {
				if (event.type === "turn/start") return {
					id: String(event.data.turn),
					role: "start"
				};
				if (event.type === "turn/end") return {
					id: String(event.data.turn),
					role: "update"
				};
				if (event.type === "tool/call" || event.type === "tool/result") return {
					id: String(event.data.turn),
					role: "update"
				};
				const coordinates = turnCoordinates(event);
				if (coordinates !== void 0) return {
					id: String(coordinates.turn),
					role: "update"
				};
				return null;
			},
			start: (_context, match) => {
				if (match.event.type !== "turn/start") throw new Error("turn-tail start requires turn/start");
				return { turn: match.event.data.turn };
			},
			update: (context, match) => match.event.type === "turn/end" ? {
				...context.state,
				end: match
			} : context.state,
			publication: (match) => match.event.type === "turn/end" ? "immediate" : "none",
			buildLocationData: (context, scope) => {
				if (scope !== "turn") return null;
				const value = tailData(context);
				return value === null ? null : {
					kind: "turn",
					turn: value.turn,
					key: "turn-tail",
					value
				};
			},
			buildViewNode: (context) => {
				const data = turnLocation(context)?.data.get("turn-tail");
				return data === void 0 ? null : chatNode(context, "turn-tail", data.seq + CHAT_SYNTHETIC_SEQ_OFFSETS.finalizedFollowup, data, { groupTree: "turn" });
			}
		};
		/**
		* Register completed-Turn footer data and its Chat node contribution.
		* @param ctx - owning UI Conversation context.
		*/
		function registerTurnTailConversationNode(ctx) {
			const match = turnTailDefinition.match.bind(turnTailDefinition);
			ctx.uiConversation.events.register({
				...turnTailDefinition,
				match: {
					"turn/start": match,
					"turn/end": match,
					"tool/call": match,
					"tool/result": match,
					"assistant/message": match,
					"assistant/attempt": match,
					"assistant/live-chunk": match,
					"step/start": match,
					"step/end": match,
					"llm/retry": match,
					"llm/retry-started": match
				}
			});
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/process-activity.js
		function activity(name) {
			if (name === "read") return "read";
			if (name === "read_image") return "readImage";
			if (name === "grep" || name === "glob" || name.endsWith("_inspect")) return "search";
			if (name === "write") return "write";
			if (name === "edit" || name === "apply_patch") return "edit";
			if ([
				"bash",
				"pwsh",
				"exec_command",
				"write_stdin"
			].includes(name) || name.startsWith("terminal_")) return "commands";
			if (name === "run_code") return "code";
			if (name === "web_search") return "webSearch";
			if (name === "web_fetch") return "webFetch";
			if (name === "subagent" || name.startsWith("subagent_")) return "subagents";
			if ([
				"todo_write",
				"create_goal",
				"update_goal",
				"get_goal"
			].includes(name)) return "plan";
			if (name === "ask_user_question" || name === "request_user_input") return "questions";
			return "tools";
		}
		const LIVE_TOOL_DETAIL_MAX_CHARS = 160;
		const LIVE_TOOL_DETAIL_PREFIX_CHARS = 512;
		const LIVE_TOOL_DETAIL_SEGMENTER = new Intl.Segmenter(void 0, { granularity: "grapheme" });
		const LIVE_TOOL_DETAIL_KEYS = [
			"title",
			"description",
			"objective",
			"task",
			"task_name",
			"name",
			"question",
			"questions",
			"prompt",
			"message",
			"command",
			"cmd",
			"queries",
			"query",
			"pattern",
			"url",
			"uri",
			"file_path",
			"path",
			"target",
			"action",
			"status"
		];
		function normalizeLiveToolText(text) {
			const normalized = text.replace(/\s+/g, " ").trim();
			if (normalized.length <= LIVE_TOOL_DETAIL_MAX_CHARS) return {
				text: normalized,
				truncated: false
			};
			const chars = [];
			for (const { segment } of LIVE_TOOL_DETAIL_SEGMENTER.segment(normalized)) {
				if (chars.length === LIVE_TOOL_DETAIL_MAX_CHARS) return {
					text: `${chars.slice(0, LIVE_TOOL_DETAIL_MAX_CHARS - 1).join("").trimEnd()}…`,
					truncated: true
				};
				chars.push(segment);
			}
			return {
				text: normalized,
				truncated: false
			};
		}
		function normalizeLiveToolDetail(value) {
			return normalizeLiveToolText(typeof value === "string" ? value : Array.isArray(value) && value.every((item) => typeof item === "string") ? value.join(", ") : "").text;
		}
		function argumentTextDetail(args, key) {
			let limit = LIVE_TOOL_DETAIL_PREFIX_CHARS;
			while (true) {
				let prefix = args.textPrefix(key, limit);
				if (prefix === void 0) return void 0;
				const last = prefix.charCodeAt(prefix.length - 1);
				if (last >= 55296 && last <= 56319) {
					const extended = args.textPrefix(key, limit + 1);
					const next = extended.charCodeAt(prefix.length);
					if (next >= 56320 && next <= 57343) {
						prefix = extended;
						limit++;
					} else if (extended.length === prefix.length && !args.isSealed && !args.complete(key)) prefix = prefix.slice(0, -1);
				}
				const detail = normalizeLiveToolText(prefix);
				if (detail.truncated || !args.stringExceeds(key, limit)) return detail.text;
				limit *= 2;
			}
		}
		function questionDetail(value) {
			if (!Array.isArray(value)) return "";
			for (const item of value) {
				if (item === null || typeof item !== "object") continue;
				const detail = normalizeLiveToolDetail(Reflect.get(item, "question"));
				if (detail !== "") return detail;
			}
			return "";
		}
		function liveReasoningDetail(nodes) {
			for (let nodeIndex = nodes.length - 1; nodeIndex >= 0; nodeIndex--) {
				const node = nodes[nodeIndex];
				if (node?.kind !== "assistant-step" || node.data.status !== "running") continue;
				for (let blockIndex = node.data.blocks.length - 1; blockIndex >= 0; blockIndex--) {
					const block = node.data.blocks[blockIndex];
					if (block?.kind !== "reasoning") continue;
					const paragraphs = block.text.split(/\r?\n[\t ]*\r?\n/);
					for (let paragraphIndex = paragraphs.length - 1; paragraphIndex >= 0; paragraphIndex--) {
						const detail = normalizeLiveToolDetail(paragraphs[paragraphIndex]?.replaceAll("**", ""));
						if (detail !== "") return detail;
					}
				}
			}
			return "";
		}
		/**
		* One-line task detail from the argument view, read the same way while the
		* arguments stream and after dispatch: the first detail key present with text
		* so far or a closed value. Without one, the tool name stands in once no further
		* field can arrive; a field still to come is not named early.
		*/
		function liveToolDetail(name, args) {
			for (const key of LIVE_TOOL_DETAIL_KEYS) {
				if (!args.has(key)) continue;
				const detail = key === "questions" ? questionDetail(args.value(key)) : argumentTextDetail(args, key) ?? normalizeLiveToolDetail(args.value(key));
				if (detail !== "") return detail;
			}
			return args.closed() ? normalizeLiveToolDetail(name) : "";
		}
		/**
		* Rank categories by distinct call count, breaking ties by first appearance.
		* @param nodes - process members, including recursive tools.
		* @returns all ranked categories and the latest running tool category and bounded task detail.
		*/
		function processActivity(nodes) {
			const counts = /* @__PURE__ */ new Map();
			const seen = /* @__PURE__ */ new Set();
			let running;
			let runningDetail = "";
			let runningTime = -Infinity;
			let preparing;
			const visit = (tool) => {
				if (seen.has(tool.callId)) return;
				seen.add(tool.callId);
				const call = isRunningTool(tool) ? tool : tool.call;
				if (call !== null) {
					const kind = activity(call.name);
					if (isRunningTool(tool) && tool.time >= runningTime) {
						running = kind;
						preparing = tool.phase === "preparing";
						runningDetail = liveToolDetail(tool.name, tool.args);
						runningTime = tool.time;
					}
					counts.set(kind, (counts.get(kind) ?? 0) + 1);
				}
				for (const child of tool.subCalls) visit(child);
			};
			for (const node of nodes) if (node.kind === "tool-call") visit(node.data.root);
			if (running === void 0) runningDetail = liveReasoningDetail(nodes);
			return {
				counts: [...counts].map(([kind, count]) => ({
					kind,
					count
				})).sort((a, b) => b.count - a.count),
				running,
				runningDetail,
				...preparing ? { preparing: true } : {}
			};
		}
		//#endregion
		//#region lib/types/client/conversation-nodes/process-groups.js
		/** Chat-owned segmentation and incremental summaries over materialized Node inputs. */
		function turnOf(node) {
			const location = node.location;
			return location.kind === "turn" || location.kind === "step" ? location.turn.turn : void 0;
		}
		function reasoning(node) {
			return node.kind === "assistant-step" && node.data.blocks.some((block) => block.kind === "reasoning" && block.text.trim() !== "");
		}
		function reply(node) {
			return node.kind === "assistant-step" && hasAssistantReplyContent(node.data.blocks);
		}
		function sameSummary(left, right) {
			return left.running === right.running && left.runningDetail === right.runningDetail && left.preparing === right.preparing && left.counts.length === right.counts.length && left.counts.every((value, index) => value.kind === right.counts[index]?.kind && value.count === right.counts[index].count);
		}
		function sameMembers(left, right) {
			return left.length === right.length && left.every((value, index) => value.key === right[index]?.key && value.groupPart === right[index].groupPart);
		}
		function structureChanged(previous, current) {
			if (!isVisibleChatNode(current) && (previous === void 0 || !isVisibleChatNode(previous))) return false;
			return previous === void 0 || previous.kind !== current.kind || turnOf(previous) !== turnOf(current) || isVisibleChatNode(previous) !== isVisibleChatNode(current) || previous.groupTree !== current.groupTree || reasoning(previous) !== reasoning(current) || reply(previous) !== reply(current);
		}
		function readNode(input, key) {
			const node = input.readNode(key);
			if (node === void 0) throw new Error(`Chat grouping input is missing Node ${key}`);
			return node;
		}
		/** One group's members and cached summary, refreshed together when its content changes. */
		var ProcessGroup = class {
			key;
			turn;
			members;
			nodes = [];
			snapshot;
			constructor(key, turn, members) {
				this.key = key;
				this.turn = turn;
				this.members = members;
				this.snapshot = {
					key,
					members,
					data: {
						turn,
						closed: false,
						summary: {
							counts: [],
							running: void 0,
							runningDetail: ""
						}
					}
				};
			}
			refresh(input, closed) {
				const nodes = this.members.map((member) => readNode(input, member.key));
				const unchanged = nodes.length === this.nodes.length && nodes.every((node, index) => node === this.nodes[index]);
				const previous = this.snapshot.data;
				const activity = unchanged && previous.closed === closed ? previous.summary : processActivity(nodes);
				const summary = closed ? {
					counts: activity.counts,
					running: void 0,
					runningDetail: ""
				} : activity;
				this.nodes = nodes;
				if (previous.closed !== closed || !sameSummary(previous.summary, summary)) this.snapshot = {
					key: this.key,
					members: this.members,
					data: {
						turn: this.turn,
						closed,
						summary
					}
				};
			}
		};
		/** One Turn's grouping result and member lookup; summaries stay with their groups. */
		var TurnGroups = class {
			turn;
			groups = /* @__PURE__ */ new Map();
			membership = /* @__PURE__ */ new Map();
			roots = /* @__PURE__ */ new Map();
			constructor(turn) {
				this.turn = turn;
			}
			references(key) {
				return this.roots.get(key) ?? [];
			}
			snapshots() {
				return [...this.groups.values()].map((group) => group.snapshot);
			}
			refresh(input, changed) {
				const dirty = /* @__PURE__ */ new Set();
				for (const node of changed) {
					const group = this.membership.get(node);
					if (group !== void 0) dirty.add(group);
				}
				const ended = input.timeline.turns.get(this.turn)?.status === "closed";
				if (ended) {
					for (const group of this.groups.values()) if (!group.snapshot.data.closed) dirty.add(group.key);
				}
				const upserts = [];
				for (const key of dirty) {
					const group = this.groups.get(key);
					const previous = group.snapshot;
					group.refresh(input, previous.data.closed || ended);
					if (group.snapshot !== previous) upserts.push(group.snapshot);
				}
				return upserts;
			}
			rebuild(input, added) {
				const roots = /* @__PURE__ */ new Map();
				const groups = /* @__PURE__ */ new Map();
				const membership = /* @__PURE__ */ new Map();
				let pending = [];
				const upserts = [];
				const emit = (key, entry) => {
					roots.set(key, [...roots.get(key) ?? [], entry]);
				};
				const flush = (closed) => {
					const first = pending[0];
					if (first === void 0) return;
					const key = this.extendedGroup(pending, added)?.key ?? brandString(JSON.stringify([
						"process",
						first.key,
						first.groupPart ?? null
					]));
					const previous = this.groups.get(key);
					const before = previous?.snapshot;
					const group = previous !== void 0 && sameMembers(previous.members, pending) ? previous : new ProcessGroup(key, this.turn, pending);
					group.refresh(input, closed || input.timeline.turns.get(this.turn)?.status === "closed");
					groups.set(group.key, group);
					emit(first.key, {
						kind: "group",
						key: group.key
					});
					for (const member of pending) membership.set(member.key, group.key);
					if (group.snapshot !== before) upserts.push(group.snapshot);
					pending = [];
				};
				let previous;
				let followed = false;
				for (const key of input.readTurn(this.turn)) {
					const position = readPosition(input, key);
					if (previous !== void 0 && position.previous !== previous) flush(true);
					previous = key;
					followed = position.next !== void 0;
					const node = readNode(input, key);
					if (isAtOrOutside(node, "process")) {
						flush(true);
						emit(key, {
							kind: "node",
							key
						});
					} else if (node.kind === "assistant-step") {
						if (reasoning(node)) pending.push({
							kind: "node",
							key,
							groupPart: "reasoning"
						});
						if (reply(node)) {
							flush(true);
							emit(key, {
								kind: "node",
								key,
								groupPart: "response"
							});
						}
					} else pending.push({
						kind: "node",
						key
					});
				}
				flush(followed);
				const removes = [...this.groups.keys()].filter((key) => !groups.has(key));
				this.groups = groups;
				this.membership = membership;
				this.roots = roots;
				return {
					upserts,
					removes
				};
			}
			extendedGroup(members, added) {
				const offset = members.findIndex((member) => !added.has(member.key));
				const first = members[offset];
				if (first === void 0) return void 0;
				const key = this.membership.get(first.key);
				const previous = key === void 0 ? void 0 : this.groups.get(key);
				if (previous === void 0 || offset + previous.members.length > members.length) return void 0;
				for (let index = 0; index < previous.members.length; index++) {
					const before = previous.members[index];
					const after = members[offset + index];
					if (before.key !== after.key || before.groupPart !== after.groupPart) return void 0;
				}
				for (let index = offset + previous.members.length; index < members.length; index++) if (!added.has(members[index].key)) return void 0;
				return previous;
			}
		};
		function readPosition(input, key) {
			const position = input.readPosition(key);
			if (position === void 0) throw new Error(`Chat grouping order is missing position for Node ${key}`);
			return position;
		}
		/** Session-local Turn results; ordinary updates never read other Turns' Node contents. */
		var ProcessState = class {
			turns = /* @__PURE__ */ new Map();
			order = [];
			pending = null;
			/**
			* Consume one synchronous Builder input without retaining its readers.
			* @param input - projected Node changes, indexed positions, and Turn lifecycle.
			*/
			accept(input) {
				if (input.kind === "replace") {
					const previousKeys = new Set(this.order);
					const added = new Set(input.order.filter((key) => !previousKeys.has(key)));
					const turns = /* @__PURE__ */ new Map();
					for (const key of input.order) {
						const turn = readPosition(input, key).turn;
						if (turn === void 0 || turns.has(turn)) continue;
						const groups = this.turns.get(turn) ?? new TurnGroups(turn);
						groups.rebuild(input, added);
						turns.set(turn, groups);
					}
					this.turns = turns;
					this.order = input.order;
					this.pending = {
						entries: this.rootEntries(input),
						groups: {
							kind: "replace",
							snapshots: [...turns.values()].flatMap((turn) => turn.snapshots())
						}
					};
					return;
				}
				const regroup = new Set(input.changedTurnOrders);
				const added = /* @__PURE__ */ new Set();
				const changed = /* @__PURE__ */ new Map();
				const touch = (turn) => {
					let keys = changed.get(turn);
					if (keys === void 0) {
						keys = /* @__PURE__ */ new Set();
						changed.set(turn, keys);
					}
					return keys;
				};
				for (const change of input.changes) {
					const before = change.previous;
					const after = change.current;
					const turn = turnOf(after);
					if (before === void 0 || !isVisibleChatNode(before)) added.add(after.key);
					if (structureChanged(before, after)) {
						const previousTurn = before === void 0 ? void 0 : turnOf(before);
						if (previousTurn !== void 0) regroup.add(previousTurn);
						if (turn !== void 0) regroup.add(turn);
					}
					if (turn !== void 0) touch(turn).add(after.key);
				}
				for (const turn of input.changedTurns) touch(turn);
				const upserts = [];
				const removes = [];
				for (const turn of regroup) {
					const groups = this.turns.get(turn) ?? new TurnGroups(turn);
					const update = groups.rebuild(input, added);
					upserts.push(...update.upserts);
					removes.push(...update.removes);
					if (input.readTurn(turn).length === 0) this.turns.delete(turn);
					else this.turns.set(turn, groups);
				}
				for (const [turn, keys] of changed) if (!regroup.has(turn)) upserts.push(...this.turns.get(turn)?.refresh(input, keys) ?? []);
				const reordered = input.order !== this.order || regroup.size > 0;
				this.order = input.order;
				const installed = new Set(upserts.map((group) => group.key));
				this.pending = reordered || upserts.length > 0 || removes.length > 0 ? {
					...reordered ? { entries: this.rootEntries(input) } : {},
					groups: {
						kind: "apply",
						upserts,
						removes: removes.filter((key) => !installed.has(key))
					}
				} : null;
			}
			rootEntries(input) {
				return input.order.flatMap((key) => {
					const turn = readPosition(input, key).turn;
					if (turn === void 0) return [{
						kind: "node",
						key
					}];
					const groups = this.turns.get(turn);
					if (groups === void 0) throw new Error(`Chat grouping order is missing Turn ${turn}`);
					return groups.references(key);
				});
			}
			/**
			* Read pending output without advancing State.
			* @returns the repeatable update for the last input batch.
			*/
			output() {
				return this.pending;
			}
		};
		/** Chat's registered business grouping; presentation modes never enter its State. */
		const processGroupDefinition = {
			kind: "process-groups",
			target: "chat",
			create: () => new ProcessState(),
			update: (context, input) => {
				context.state.accept(input);
				return context.state;
			},
			buildGroups: (context) => context.state.output()
		};
		//#endregion
		//#region lib/types/client/conversation-nodes/register.js
		/**
		* Register the Chat business Definitions and target builder contributed by this package.
		* @param ctx - owning UI Conversation context.
		*/
		function registerConversationNodes(ctx) {
			registerInboxConversationNodes(ctx);
			registerMessageConversationNode(ctx);
			registerRequestPromptConversationNode(ctx);
			registerAssistantConversationNode(ctx);
			registerTurnProcess(ctx);
			registerToolConversationNode(ctx);
			registerCommandConversationNode(ctx);
			registerCompactionConversationNode(ctx);
			registerRetryConversationNode(ctx);
			registerTurnErrorConversationNode(ctx);
			registerTurnMaxTokensConversationNode(ctx);
			registerTurnTailConversationNode(ctx);
			registerUnknownConversationFallback(ctx);
			registerChatConversationView(ctx);
			ctx.uiConversation.groups.register(processGroupDefinition);
		}
		//#endregion
		//#region lib/types/client/chat/QuotaNoticeHost.js
		/**
		* The frame-wide `shell.overlay` host for quota notices. It holds the one live
		* notice for the whole app, so leaving the Chat panel does not drop it. A
		* `shell.quota-notice` entry may replace the generic Toast for codes it claims.
		*/
		/**
		* @param props - the live notice, its dismissal, the chain outlet, and the locale seat.
		* @returns the notice on display, or null while none is live.
		*/
		function QuotaNoticeHost({ useNotice, dismissNotice, keepNoticeOpen, renderSlotChain, t }) {
			const notice = useNotice((current) => current);
			if (notice === null) return null;
			const owner = {
				code: notice.code,
				message: t("message.failure.quota"),
				dismiss: dismissNotice,
				keepOpen: keepNoticeOpen
			};
			return (0, react_jsx_runtime.jsx)(react.Fragment, { children: renderSlotChain("shell.quota-notice", owner, { fallback: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: owner.message,
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 18 }),
				onDone: dismissNotice
			}) }) }, `quota-notice-${String(notice.seq)}`);
		}
		//#endregion