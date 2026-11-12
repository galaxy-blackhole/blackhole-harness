/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-trajectory/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/trajectory-request-header-definition.js
		/**
		* Definition retaining each `system/message` surface node for the Trajectory
		* request-header Definition, which reads it through `reader.previous` and
		* presents the prompt through the request's `system` cell. A node that
		* lacks a loaded header contributes known text without request config or tools; an in-history
		* update contributes a request-header fact at its own position, since no
		* `request/header` follows a prompt change that keeps the cached history.
		* Surface replacements also contribute prompt changes when they remove the
		* effective node; earlier request facts remain historical.
		* @param inspect - Pure surface interpretation supplied by uiConversation.
		* @returns The Trajectory system-prompt Definition.
		*/
		function trajectorySystemMessageDefinition(inspect) {
			return {
				kind: "trajectory-system-message",
				target: "trajectory",
				match: (event) => event.type === "system/message" || "surfaceOp" in event && event.surfaceOp !== "append" ? {
					id: String(event.seq),
					role: "start"
				} : null,
				start: (_context, match, reader) => {
					if (match.event.type === "assistant/live-chunk") throw new Error("system-message requires a durable event");
					const prior = reader.previous("trajectory-system-message")?.state;
					const state = inspect(prior, match.event);
					const node = state.effective;
					if (state.uncertain) {
						const header = reader.previous("trajectory-request-header")?.state;
						if (header === void 0) return state;
						return {
							...state,
							header: {
								seq: match.event.seq,
								time: match.event.time,
								location: match.location,
								prompt: {
									...header.prompt,
									system: ""
								}
							}
						};
					}
					if (node === void 0 || node.text === prior?.effective?.text || state.introduced !== void 0 && !state.introduced.update) return {
						...state,
						...prior?.header === void 0 ? {} : { header: prior.header }
					};
					const header = reader.previous("trajectory-request-header")?.state;
					const systemHeader = prior?.header;
					const previous = systemHeader !== void 0 && (header === void 0 || systemHeader.seq > header.seq) ? systemHeader : header;
					if (previous === void 0) return state;
					return {
						...state,
						header: {
							seq: node.seq,
							time: node.time,
							prompt: {
								...previous.prompt,
								system: node.text
							},
							change: {
								seq: node.seq,
								time: node.time,
								kind: "system",
								previous: previous.prompt
							},
							location: match.location
						}
					};
				},
				update: (context) => context.state,
				buildViewNode: (context) => {
					const state = context.state;
					if (state?.header !== void 0 && state.header.seq === context.start?.event.seq) return trajectoryNode(context, state.header.seq, {
						kind: "request-header",
						header: state.header
					});
					const prompt = state?.introduced;
					return prompt !== void 0 && prompt.text !== "" && context.start?.event.type === "system/message" && context.start.event.surfaceOp === "append" ? trajectoryNode(context, prompt.seq, {
						kind: "system-prompt",
						prompt
					}) : null;
				}
			};
		}
		/**
		* Request-header fact Definition for the Trajectory target.
		* @param inspect - the shared prompt interpretation, supplied by the
		* uiConversation service (a client bundle cannot value-import it).
		* @returns the Trajectory request-header Definition.
		*/
		function trajectoryRequestHeaderDefinition(inspect) {
			return {
				kind: "trajectory-request-header",
				target: "trajectory",
				match: (event) => event.type === "request/header" ? {
					id: String(event.seq),
					role: "start"
				} : null,
				start: (_context, match, reader) => {
					if (match.event.type !== "request/header") throw new Error("trajectory-request-header start requires request/header");
					const header = reader.previous("trajectory-request-header")?.state;
					const state = reader.previous("trajectory-system-message")?.state;
					const systemHeader = state?.header;
					const previous = systemHeader !== void 0 && (header === void 0 || systemHeader.seq > header.seq) ? systemHeader.prompt : header?.prompt;
					const system = state?.effective;
					const inspection = inspect(previous, match.event, system);
					const { prompt } = inspection;
					const change = inspection.change ?? (systemHeader !== void 0 && (header === void 0 || systemHeader.seq > header.seq) ? systemHeader.change : void 0);
					return {
						seq: match.event.seq,
						time: match.event.time,
						prompt,
						location: match.location,
						...change === void 0 ? {} : { change }
					};
				},
				update: (context) => context.state,
				buildViewNode: (context) => context.state === void 0 ? null : trajectoryNode(context, context.state.seq, {
					kind: "request-header",
					header: context.state
				})
			};
		}
		/**
		* Register Trajectory system-prompt node and request-header facts.
		*
		* @param ctx - Plugin context receiving the Definitions.
		*/
		function registerTrajectoryRequestHeaderDefinition(ctx) {
			ctx.uiConversation.events.register(trajectorySystemMessageDefinition((previous, event) => ctx.uiConversation.inspectSystemPrompt(previous, event)));
			ctx.uiConversation.events.register(trajectoryRequestHeaderDefinition((previous, event, system) => ctx.uiConversation.inspectRequestPrompt(previous, event, system)));
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/copy-codes.js
		/** Stable non-display markers for client-synthesized trajectory copy. */
		/** Error marker localized only when the trajectory renders it. */
		const COMPACTION_INTERRUPTED_ERROR = "trajectory.compaction-interrupted";
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/trajectory-snapshot-builder.js
		const EMPTY_LIST = [];
		/** Stable empty target used until a Session has assembled Trajectory records. */
		const EMPTY_TRAJECTORY_SNAPSHOT = {
			eventNodes: EMPTY_LIST,
			eventLocations: /* @__PURE__ */ new Map(),
			requests: EMPTY_LIST,
			callSchemas: /* @__PURE__ */ new Map(),
			partial: null,
			runningCalls: EMPTY_LIST
		};
		function stepKey(turn, step) {
			return `${turn}\u0000${step}`;
		}
		function headerStepKey(header) {
			const location = header.location;
			return location.kind === "step" ? stepKey(location.turn.turn, location.step.step) : void 0;
		}
		function headerFor(request, headersByStep, previous) {
			return headersByStep.get(stepKey(request.turn, request.step)) ?? (previous !== void 0 && previous.seq < request.startSeq ? {
				latest: previous,
				...previous.change === void 0 ? {} : { change: previous.change }
			} : void 0);
		}
		function applyHeader(request, header, includeChange) {
			return header === void 0 ? request : {
				...request,
				prompt: header.latest.prompt,
				requestConfig: header.latest.prompt.config,
				...includeChange && header.change !== void 0 ? { promptChange: header.change } : {}
			};
		}
		function withRequestConfig(node, prompt) {
			return prompt === void 0 ? node : {
				...node,
				requestConfig: prompt.config
			};
		}
		function captureSchemas(block, toolsByName, output) {
			const name = "kind" in block ? block.call?.name : block.name;
			const schema = name === void 0 ? void 0 : toolsByName.get(name);
			if (schema !== void 0) output.set(block.callId, schema);
			for (const child of block.subCalls) captureSchemas(child, toolsByName, output);
		}
		function indexTools(tools) {
			return new Map(tools.map((tool) => [tool.name, tool]));
		}
		function interruptCompactions(requests, boundaries) {
			let nextRequest = 0;
			const runningCompactions = [];
			for (const boundary of boundaries) {
				while (nextRequest < requests.length) {
					const request = requests[nextRequest];
					if (request === void 0 || request.startSeq >= boundary.seq) break;
					if (request.purpose === "compaction" && request.status === "running") runningCompactions.push(nextRequest);
					nextRequest++;
				}
				let index = runningCompactions.pop();
				while (index !== void 0 && requests[index]?.status !== "running") index = runningCompactions.pop();
				if (index === void 0) continue;
				const request = requests[index];
				if (request?.purpose !== "compaction") continue;
				requests[index] = {
					...request,
					completedAt: boundary.time,
					status: "error",
					error: COMPACTION_INTERRUPTED_ERROR
				};
			}
		}
		function applyTurnErrors(requests, endings) {
			const lastAssistantByTurn = /* @__PURE__ */ new Map();
			for (const [index, request] of requests.entries()) if (request.purpose === "assistant") lastAssistantByTurn.set(request.turn, index);
			for (const ending of endings) {
				if (ending.error === void 0) continue;
				const index = lastAssistantByTurn.get(ending.turn);
				if (index === void 0) continue;
				const request = requests[index];
				if (request?.purpose !== "assistant") continue;
				requests[index] = {
					...request,
					completedAt: request.completedAt ?? ending.time,
					status: "error",
					error: ending.error,
					...ending.errorCode === void 0 ? {} : { errorCode: ending.errorCode }
				};
			}
		}
		/** Simple keyed adapter retaining the old Trajectory snapshot and stage layout. */
		var TrajectorySnapshotBuilder = class {
			nodes = /* @__PURE__ */ new Map();
			positions = /* @__PURE__ */ new Map();
			contributions = [];
			empty = EMPTY_TRAJECTORY_SNAPSHOT;
			replace(input) {
				this.nodes.clear();
				for (const node of input.nodes) this.nodes.set(node.key, node);
				this.rebuildContributions();
				return this.snapshot();
			}
			apply(input) {
				let structural = false;
				for (const node of input.upserts) {
					const previous = this.nodes.get(node.key);
					this.nodes.set(node.key, node);
					if (previous === void 0 || previous.anchorSeq !== node.anchorSeq) {
						structural = true;
						continue;
					}
					const position = this.positions.get(node.key);
					if (position === void 0) structural = true;
					else this.contributions[position] = node;
				}
				if (structural) this.rebuildContributions();
				return this.snapshot();
			}
			snapshot() {
				const headersByStep = /* @__PURE__ */ new Map();
				for (const contribution of this.contributions) {
					if (contribution.data.kind !== "request-header") continue;
					const key = headerStepKey(contribution.data.header);
					if (key === void 0) continue;
					const previous = headersByStep.get(key);
					headersByStep.set(key, {
						latest: contribution.data.header,
						...contribution.data.header.change !== void 0 ? { change: contribution.data.header.change } : previous?.change === void 0 ? {} : { change: previous.change }
					});
				}
				const representedPrompts = new Set(this.contributions.flatMap((node) => node.data.kind === "request-header" && node.data.header.change !== void 0 ? [node.data.header.change.seq] : []));
				const systemPrompts = [];
				const finalized = [];
				const eventLocations = /* @__PURE__ */ new Map();
				const requests = [];
				const boundaries = [];
				const turnEndings = [];
				const callSchemas = /* @__PURE__ */ new Map();
				const consumedPromptChanges = /* @__PURE__ */ new Set();
				let previousHeader;
				let previousTools = /* @__PURE__ */ new Map();
				let partial = null;
				const runningCalls = [];
				for (const contribution of this.contributions) {
					const data = contribution.data;
					if (data.kind === "system-prompt") {
						if (!representedPrompts.has(data.prompt.seq)) systemPrompts.push(data.prompt);
						continue;
					}
					if (data.kind === "request-header") {
						previousHeader = data.header;
						previousTools = indexTools(data.header.prompt.tools);
						continue;
					}
					if (data.kind === "node") {
						finalized.push(data.node);
						eventLocations.set(data.node.seq, contribution.location);
						continue;
					}
					if (data.kind === "assistant") {
						const header = data.request === void 0 ? void 0 : headerFor(data.request, headersByStep, previousHeader);
						if (data.node !== void 0) finalized.push(withRequestConfig(data.node, header?.latest.prompt));
						if (data.partial !== null) partial = data.partial;
						if (data.request !== void 0) {
							const change = header?.change;
							const includeChange = change !== void 0 && !consumedPromptChanges.has(change.seq);
							requests.push(applyHeader(data.request, header, includeChange));
							if (includeChange) consumedPromptChanges.add(change.seq);
						}
						continue;
					}
					if (data.kind === "tool") {
						if ("kind" in data.root) finalized.push(data.root);
						else runningCalls.push(data.root);
						if (previousHeader !== void 0 && previousHeader.seq < contribution.anchorSeq) captureSchemas(data.root, previousTools, callSchemas);
						continue;
					}
					if (data.kind === "compaction") {
						requests.push(data.request);
						continue;
					}
					if (data.kind === "session-end") {
						boundaries.push({
							seq: data.seq,
							time: data.time
						});
						continue;
					}
					turnEndings.push({
						turn: data.turn,
						time: data.time,
						...data.error === void 0 ? {} : { error: data.error },
						...data.errorCode === void 0 ? {} : { errorCode: data.errorCode }
					});
				}
				requests.sort((left, right) => left.startSeq - right.startSeq);
				interruptCompactions(requests, boundaries);
				applyTurnErrors(requests, turnEndings);
				finalized.sort((left, right) => left.seq - right.seq);
				return {
					eventNodes: finalized,
					...systemPrompts.length > 0 ? { systemPrompts } : {},
					eventLocations,
					requests,
					callSchemas,
					partial,
					runningCalls
				};
			}
			rebuildContributions() {
				this.contributions = [...this.nodes.values()].sort((left, right) => left.anchorSeq - right.anchorSeq || left.key.localeCompare(right.key));
				this.positions.clear();
				for (const [index, contribution] of this.contributions.entries()) this.positions.set(contribution.key, index);
			}
		};
		/** Trajectory target factory preserving the existing stage-oriented view model. */
		const trajectoryViewDefinition = {
			target: "trajectory",
			toolCallFocus: (callId) => callId,
			create: () => new TrajectorySnapshotBuilder()
		};
		/**
		* Register the stage-oriented Trajectory target builder.
		*
		* @param ctx - Plugin context receiving the view Definition.
		*/
		function registerTrajectoryConversationView(ctx) {
			ctx.uiConversation.views.register(trajectoryViewDefinition);
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/trajectory-tool-definition.js
		const MAX_DEPTH = 256;
		function rootCall(match) {
			if (match.event.type !== "tool/call") throw new Error("trajectory-tool-call start requires tool/call");
			return {
				phase: "start",
				callId: String(match.event.data.callId),
				name: match.event.data.name,
				argsRaw: match.event.data.arguments,
				args: PartialArguments.fromText(match.event.data.arguments),
				turn: match.event.data.turn,
				step: match.event.data.step,
				time: match.event.time,
				subCalls: []
			};
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
		function locationTurn(match) {
			return match.location.kind === "step" || match.location.kind === "turn" ? match.location.turn.turn : 0;
		}
		function locationStep(match) {
			return match.location.kind === "step" ? match.location.step.step : 0;
		}
		function childCall(match, data) {
			return {
				phase: "start",
				callId: data.subCallId,
				parentCallId: data.parentCallId,
				name: data.name,
				argsRaw: JSON.stringify(data.arguments),
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
				args: previous?.args ?? PartialArguments.fromObject(data.arguments),
				call: {
					name: data.name,
					argsRaw: JSON.stringify(data.arguments)
				},
				callTime: previous === void 0 || "kind" in previous ? null : previous.time,
				content: data.content ?? [],
				meta: data.meta,
				isError: data.isError === true,
				...data.error === void 0 ? {} : { error: data.error },
				subCalls: []
			};
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
					callId: nested,
					depth: candidate.depth + 1
				});
			}
			return parentDepth + subtreeDepth <= MAX_DEPTH;
		}
		function updateDispatch(state, match) {
			const event = match.event;
			if (event.type !== "tool/ptc-dispatch-start" && event.type !== "tool/ptc-dispatch") return state;
			const data = event.data;
			const parentId = String(data.parentCallId);
			const childId = String(data.subCallId);
			const siblings = state.children.get(parentId) ?? [];
			const index = siblings.indexOf(childId);
			if (index < 0 && !acceptsEdge(state, parentId, childId)) return state;
			if (event.type === "tool/ptc-dispatch-start" && index >= 0) return state;
			const calls = new Map(state.calls);
			calls.set(childId, event.type === "tool/ptc-dispatch-start" ? childCall(match, data) : childResult(match, data, calls.get(childId)));
			if (index >= 0) return {
				...state,
				calls
			};
			const children = new Map(state.children);
			children.set(parentId, [...siblings, childId]);
			const parents = new Map(state.parents);
			parents.set(childId, parentId);
			return {
				...state,
				calls,
				children,
				parents
			};
		}
		function interruption(context) {
			const location = context.start?.location;
			if (location?.kind === "step" && location.step.status === "closed") return location.step.end;
			if ((location?.kind === "step" || location?.kind === "turn") && location.turn.status === "closed") return location.turn.end;
		}
		function projectCall(state, callId, interruptedAt, visited = /* @__PURE__ */ new Set(), depth = 1) {
			const block = state.calls.get(callId);
			if (block === void 0) return void 0;
			if (visited.has(callId) || depth > MAX_DEPTH) return {
				...block,
				subCalls: []
			};
			const nextVisited = new Set(visited);
			nextVisited.add(callId);
			const subCalls = (state.children.get(callId) ?? []).flatMap((childId) => {
				const child = projectCall(state, childId, interruptedAt, nextVisited, depth + 1);
				return child === void 0 ? [] : [child];
			});
			if ("kind" in block || interruptedAt === void 0) return {
				...block,
				subCalls
			};
			return {
				kind: "tool-result",
				seq: interruptedAt.seq - .8,
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
				subCalls
			};
		}
		function fallbackState(context) {
			const resultMatch = context.matches.find((match) => match.event.type === "tool/result");
			const root = resultMatch === void 0 ? void 0 : rootResult(resultMatch);
			if (root === void 0) return void 0;
			let state = {
				rootId: root.callId,
				calls: new Map([[root.callId, root]]),
				children: /* @__PURE__ */ new Map(),
				parents: /* @__PURE__ */ new Map()
			};
			for (const match of context.matches) state = updateDispatch(state, match);
			return state;
		}
		/** Trajectory-owned root Tool lifecycle with nested PTC dispatch calls. */
		const trajectoryToolDefinition = {
			kind: "trajectory-tool-call",
			target: "trajectory",
			match: (event) => {
				if (event.type === "tool/call") return {
					id: String(event.data.callId),
					role: "start"
				};
				if (event.type === "tool/result") return {
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
				const root = rootCall(match);
				return {
					rootId: root.callId,
					calls: new Map([[root.callId, root]]),
					children: /* @__PURE__ */ new Map(),
					parents: /* @__PURE__ */ new Map()
				};
			},
			update: (context, match) => {
				if (match.event.type !== "tool/result") return updateDispatch(context.state, match);
				const previous = context.state.calls.get(context.state.rootId);
				const result = rootResult(match, previous !== void 0 && !("kind" in previous) ? previous : void 0);
				if (result === void 0) return context.state;
				const calls = new Map(context.state.calls);
				calls.set(context.state.rootId, result);
				return {
					...context.state,
					calls
				};
			},
			buildViewNode: (context) => {
				const state = context.state ?? fallbackState(context);
				if (state === void 0) return null;
				const root = projectCall(state, state.rootId, interruption(context));
				if (root === void 0) return null;
				return trajectoryNode(context, context.start?.event.seq ?? ("kind" in root ? root.seq : context.matches[0]?.event.seq ?? 0), {
					kind: "tool",
					root
				});
			}
		};
		/**
		* Register the Trajectory Tool lifecycle with raw native and PTC error details.
		*
		* @param ctx - Plugin context receiving the Definition.
		*/
		function registerTrajectoryToolDefinition(ctx) {
			ctx.uiConversation.events.register(trajectoryToolDefinition);
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/base.js
		var Diff = class {
			diff(oldStr, newStr, options = {}) {
				let callback;
				if (typeof options === "function") {
					callback = options;
					options = {};
				} else if ("callback" in options) callback = options.callback;
				const oldString = this.castInput(oldStr, options);
				const newString = this.castInput(newStr, options);
				const oldTokens = this.removeEmpty(this.tokenize(oldString, options));
				const newTokens = this.removeEmpty(this.tokenize(newString, options));
				return this.diffWithOptionsObj(oldTokens, newTokens, options, callback);
			}
			diffWithOptionsObj(oldTokens, newTokens, options, callback) {
				var _a;
				const done = (value) => {
					value = this.postProcess(value, options);
					if (callback) {
						setTimeout(function() {
							callback(value);
						}, 0);
						return;
					} else return value;
				};
				const newLen = newTokens.length, oldLen = oldTokens.length;
				let editLength = 1;
				let maxEditLength = newLen + oldLen;
				if (options.maxEditLength != null) maxEditLength = Math.min(maxEditLength, options.maxEditLength);
				const maxExecutionTime = (_a = options.timeout) !== null && _a !== void 0 ? _a : Infinity;
				const abortAfterTimestamp = Date.now() + maxExecutionTime;
				const bestPath = [{
					oldPos: -1,
					lastComponent: void 0
				}];
				let newPos = this.extractCommon(bestPath[0], newTokens, oldTokens, 0, options);
				if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) return done(this.buildValues(bestPath[0].lastComponent, newTokens, oldTokens));
				let minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
				const execEditLength = () => {
					for (let diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
						let basePath;
						const removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
						if (removePath) bestPath[diagonalPath - 1] = void 0;
						let canAdd = false;
						if (addPath) {
							const addPathNewPos = addPath.oldPos - diagonalPath;
							canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
						}
						const canRemove = removePath && removePath.oldPos + 1 < oldLen;
						if (!canAdd && !canRemove) {
							bestPath[diagonalPath] = void 0;
							continue;
						}
						if (!canRemove || canAdd && removePath.oldPos < addPath.oldPos) basePath = this.addToPath(addPath, true, false, 0, options);
						else basePath = this.addToPath(removePath, false, true, 1, options);
						newPos = this.extractCommon(basePath, newTokens, oldTokens, diagonalPath, options);
						if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) return done(this.buildValues(basePath.lastComponent, newTokens, oldTokens)) || true;
						else {
							bestPath[diagonalPath] = basePath;
							if (basePath.oldPos + 1 >= oldLen) maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
							if (newPos + 1 >= newLen) minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
						}
					}
					editLength++;
				};
				if (callback) (function exec() {
					setTimeout(function() {
						if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) return callback(void 0);
						if (!execEditLength()) exec();
					}, 0);
				})();
				else while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
					const ret = execEditLength();
					if (ret) return ret;
				}
			}
			addToPath(path, added, removed, oldPosInc, options) {
				const last = path.lastComponent;
				if (last && !options.oneChangePerToken && last.added === added && last.removed === removed) return {
					oldPos: path.oldPos + oldPosInc,
					lastComponent: {
						count: last.count + 1,
						added,
						removed,
						previousComponent: last.previousComponent
					}
				};
				else return {
					oldPos: path.oldPos + oldPosInc,
					lastComponent: {
						count: 1,
						added,
						removed,
						previousComponent: last
					}
				};
			}
			extractCommon(basePath, newTokens, oldTokens, diagonalPath, options) {
				const newLen = newTokens.length, oldLen = oldTokens.length;
				let oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
				while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(oldTokens[oldPos + 1], newTokens[newPos + 1], options)) {
					newPos++;
					oldPos++;
					commonCount++;
					if (options.oneChangePerToken) basePath.lastComponent = {
						count: 1,
						previousComponent: basePath.lastComponent,
						added: false,
						removed: false
					};
				}
				if (commonCount && !options.oneChangePerToken) basePath.lastComponent = {
					count: commonCount,
					previousComponent: basePath.lastComponent,
					added: false,
					removed: false
				};
				basePath.oldPos = oldPos;
				return newPos;
			}
			equals(left, right, options) {
				if (options.comparator) return options.comparator(left, right);
				else return left === right || !!options.ignoreCase && left.toLowerCase() === right.toLowerCase();
			}
			removeEmpty(array) {
				const ret = [];
				for (let i = 0; i < array.length; i++) if (array[i]) ret.push(array[i]);
				return ret;
			}
			castInput(value, options) {
				return value;
			}
			tokenize(value, options) {
				return Array.from(value);
			}
			join(chars) {
				return chars.join("");
			}
			postProcess(changeObjects, options) {
				return changeObjects;
			}
			get useLongestToken() {
				return false;
			}
			buildValues(lastComponent, newTokens, oldTokens) {
				const components = [];
				let nextComponent;
				while (lastComponent) {
					components.push(lastComponent);
					nextComponent = lastComponent.previousComponent;
					delete lastComponent.previousComponent;
					lastComponent = nextComponent;
				}
				components.reverse();
				const componentLen = components.length;
				let componentPos = 0, newPos = 0, oldPos = 0;
				for (; componentPos < componentLen; componentPos++) {
					const component = components[componentPos];
					if (!component.removed) {
						if (!component.added && this.useLongestToken) {
							let value = newTokens.slice(newPos, newPos + component.count);
							value = value.map(function(value, i) {
								const oldValue = oldTokens[oldPos + i];
								return oldValue.length > value.length ? oldValue : value;
							});
							component.value = this.join(value);
						} else component.value = this.join(newTokens.slice(newPos, newPos + component.count));
						newPos += component.count;
						if (!component.added) oldPos += component.count;
					} else {
						component.value = this.join(oldTokens.slice(oldPos, oldPos + component.count));
						oldPos += component.count;
					}
				}
				return components;
			}
		};
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region ../../../node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/character.js
		var CharacterDiff = class extends Diff {};
		new CharacterDiff();
		//#endregion
} // __DSH_FRAGMENT_END__

export {};
