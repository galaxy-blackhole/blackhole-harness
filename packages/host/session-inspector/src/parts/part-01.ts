/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-experimental-session-inspector/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _tanstack_react_virtual = require("@tanstack/react-virtual");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		let react_dom = require("react-dom");
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/locales.js
		/** Session Inspector tab, table controls, and object navigation labels. */
		/** Namespace owned by the Session Inspector plugin. */
		const NS = "session-inspector";
		/** Simplified Chinese labels and dictionary keys. */
		const zh = {
			"tab.title": "会话数据诊断",
			"tab.description": "在侧边栏分析当前会话原始日志和聊天分组数据",
			"view.presentation": "展示形式",
			"view.sessionLog": "原始数据",
			"view.chatNode": "对话分组",
			"picker.pick": "在对话面板中选取元素",
			"picker.cancel": "取消选取 (Esc)",
			"picker.instructions": "在左侧 Chat 中悬停预览，点击选取；Esc 取消。",
			"picker.noMatch": "当前表格没有匹配记录，请选择其他元素或按 Esc 取消。",
			"picker.noChat": "请先在主区域打开当前 Session 的 Chat。",
			"table.id": "序号",
			"table.type": "类型",
			"filter.title": "筛选类型",
			"filter.input": "类型关键词",
			"filter.placeholder": "输入类型片段，如 delta",
			"filter.help": "默认包含匹配（*关键词*）；Enter 确认，Esc 取消。",
			"filter.candidates": "类型候选",
			"filter.loading": "正在查找候选…",
			"filter.failed": "无法获取类型候选。",
			"filter.noCandidates": "没有匹配候选，仍可确认当前关键词。",
			"filter.clear": "清空",
			"filter.cancel": "取消",
			"filter.apply": "确认筛选",
			"filter.context": "匹配记录的父级上下文",
			"table.location": "T/S",
			"table.time": "时间 (UTC)",
			"table.data": "数据",
			"table.older": "加载更早",
			"table.loading": "加载中…",
			"table.latest": "跟踪最新",
			"table.empty": "暂无记录",
			"table.raw": "原始数据",
			"table.rawError": "无法序列化这条记录，可以选择其他记录继续查看。",
			"table.resizeDetails": "调整原始数据面板高度",
			"table.close": "关闭",
			"table.expand": "展开子行",
			"table.collapse": "收起子行",
			"table.removed": "该记录已移除或结算，请选择当前记录。",
			"object.node": "Node",
			"object.nodeData": "Node Data",
			"object.group": "Group",
			"object.groupData": "Group Data",
			"object.turn": "Turn",
			"object.turnData": "Turn Data",
			"object.step": "Step",
			"object.stepData": "Step Data",
			"object.accessor": "[Getter / Setter，未执行]",
			"object.empty": "空",
			"object.absent": "[空槽]",
			"object.properties": "其他属性",
			"object.more": "显示更多",
			"object.navigation": "原始数据导航"
		};
		/** English labels, checked against the Chinese key set. */
		const en = {
			"tab.title": "Session Log",
			"tab.description": "Analyze raw logs and grouped chat messages for the current session in the sidebar.",
			"view.presentation": "Presentation",
			"view.sessionLog": "Raw Log",
			"view.chatNode": "Chat Group",
			"picker.pick": "Pick an element in Chat View",
			"picker.cancel": "Cancel picking (Esc)",
			"picker.instructions": "Hover in the main Chat to preview, then click to select. Esc cancels.",
			"picker.noMatch": "No matching record in this table. Pick another element or press Esc to cancel.",
			"picker.noChat": "Open this Session in the main Chat before picking.",
			"table.id": "Index",
			"table.type": "Type",
			"filter.title": "Filter types",
			"filter.input": "Type keyword",
			"filter.placeholder": "Type a fragment, e.g. delta",
			"filter.help": "Contains matching (*keyword*). Enter confirms; Esc cancels.",
			"filter.candidates": "Type suggestions",
			"filter.loading": "Finding suggestions…",
			"filter.failed": "Type suggestions could not be loaded.",
			"filter.noCandidates": "No suggestions. You can still apply this keyword.",
			"filter.clear": "Clear",
			"filter.cancel": "Cancel",
			"filter.apply": "Apply filter",
			"filter.context": "Parent context of a matching record",
			"table.location": "T/S",
			"table.time": "Time (UTC)",
			"table.data": "Data",
			"table.older": "Load earlier",
			"table.loading": "Loading…",
			"table.latest": "Follow Latest",
			"table.empty": "No records",
			"table.raw": "Raw data",
			"table.rawError": "This record could not be serialized. Select another record to continue.",
			"table.resizeDetails": "Resize raw data panel",
			"table.close": "Close",
			"table.expand": "Expand children",
			"table.collapse": "Collapse children",
			"table.removed": "This record was removed or settled. Select a current record.",
			"object.node": "Node",
			"object.nodeData": "Node Data",
			"object.group": "Group",
			"object.groupData": "Group Data",
			"object.turn": "Turn",
			"object.turnData": "Turn Data",
			"object.step": "Step",
			"object.stepData": "Step Data",
			"object.accessor": "[Getter / Setter, not evaluated]",
			"object.empty": "Empty",
			"object.absent": "[Empty slot]",
			"object.properties": "Other properties",
			"object.more": "Show more",
			"object.navigation": "Raw data navigation"
		};
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/table-model.js
		/** Row identities and raw values shared by the two virtual inspector tables. */
		/**
		* Resolve a manual choice or the block lifecycle default.
		* @param row - Current row metadata.
		* @param choices - Table-local user choices.
		* @returns Whether the row's descendants are hidden.
		*/
		function inspectorRowCollapsed(row, choices) {
			const choice = choices.get(row.key);
			return choice !== void 0 && choice.state === row.disclosure ? choice.collapsed : row.disclosure === "closed";
		}
		/** Table-local hierarchy index for disclosure and virtualized sticky ancestors. */
		var InspectorTableHierarchy = class {
			/** Depth-first row order with folded descendants omitted. */
			rows;
			byKey = /* @__PURE__ */ new Map();
			branches = /* @__PURE__ */ new Set();
			/**
			* @param rows - Complete depth-first row order.
			* @param choices - Table-local disclosure overrides.
			*/
			constructor(rows, choices) {
				const visible = [];
				let hiddenDepth;
				for (const row of rows) {
					if (row.parent !== void 0) this.branches.add(row.parent);
					if (row.disclosure !== void 0) this.branches.add(row.key);
					if (hiddenDepth !== void 0 && row.depth > hiddenDepth) continue;
					hiddenDepth = inspectorRowCollapsed(row, choices) ? row.depth : void 0;
					this.byKey.set(row.key, visible.length);
					visible.push(row);
				}
				this.rows = visible;
			}
			/**
			* Identify rows that own descendants or an explicit disclosure state.
			* @param key - Row identity.
			* @returns Whether this row owns a disclosure.
			*/
			isBranch(key) {
				return this.branches.has(key);
			}
			/**
			* Find the current row's visible parent headers, including itself when it is a header.
			* @param index - First row at the viewport's scroll offset.
			* @returns Ordered indexes retained above the virtual viewport.
			*/
			stickyIndexes(index) {
				const indexes = [];
				let row = this.rows[index];
				if (row !== void 0 && this.isBranch(row.key)) indexes.push(index);
				while (row?.parent !== void 0) {
					const parent = this.byKey.get(row.parent);
					if (parent === void 0) break;
					indexes.push(parent);
					row = this.rows[parent];
				}
				return indexes.reverse();
			}
		};
		/** Converts a keyed source without changing snapshot identity on unchanged input. */
		var InspectorRecordSource = class {
			source;
			project;
			previous;
			snapshot;
			/**
			* @param source - Existing keyed business source.
			* @param project - Raw metadata projection, evaluated only after its input changes.
			*/
			constructor(source, project) {
				this.source = source;
				this.project = project;
			}
			/** @returns Stable metadata for the current raw value. */
			getSnapshot = () => {
				const value = this.source.getSnapshot();
				if (value !== this.previous) {
					this.previous = value;
					this.snapshot = value === void 0 ? void 0 : this.project(value);
				}
				return this.snapshot;
			};
			/** @param listener - Row invalidation callback. @returns Its disposer. */
			subscribe = (listener) => this.source.subscribe(listener);
		};
		const DELTA_PREVIEW_FIELDS = new Map([["tool-call-delta", ["argumentsDelta"]], ["reasoning-delta", ["text"]]]);
		function preview(value, depth, hiddenRootFields) {
			if (typeof value === "string") return value.slice(0, 180);
			if (value === null || typeof value !== "object") return String(value);
			if (depth > 1) return Array.isArray(value) ? `[${value.length}]` : "{…}";
			const fields = "type" in value && typeof value.type === "string" ? DELTA_PREVIEW_FIELDS.get(value.type) : void 0;
			const entries = Object.entries(value).filter(([key]) => !(depth === 0 && (key.toLowerCase() === "time" || hiddenRootFields.includes(key))) && (fields === void 0 ? ![
				"type",
				"seq",
				"sequence"
			].includes(key.toLowerCase()) : fields.includes(key)));
			const [first, second] = entries;
			if (first !== void 0 && second === void 0) return preview(first[1], depth + 1, hiddenRootFields);
			return entries.slice(0, 5).map(([key, item]) => `${key}: ${preview(item, depth + 1, hiddenRootFields)}`).join(" · ").slice(0, 240);
		}
		/**
		* Format horizontal data with type-specific delta fields and bounded nesting.
		* @param value - Original row data, which remains unchanged for JSON inspection.
		* @param hiddenRootFields - Additional top-level metadata already displayed in the owning table's columns.
		* @returns A bounded preview omitting type, sequence, top-level time, and singleton field names.
		*/
		function inspectorPreview(value, hiddenRootFields = []) {
			return preview(value, 0, hiddenRootFields);
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/chat-node/objects.js
		/** Weak identity index for materialized Nodes, Groups, Turn/Step locations, and their Data readers. */
		/** Indexes each immutable publication once, without retaining its objects or node arrays. */
		var ChatObjectIndex = class {
			binding;
			identities = /* @__PURE__ */ new WeakMap();
			indexed = /* @__PURE__ */ new WeakSet();
			/** @param binding - Existing Session-owned Conversation reader. */
			constructor(binding) {
				this.binding = binding;
			}
			/**
			* Resolve an original object without retaining replaced publications.
			* @param value - Original object identity.
			* @returns Its named reference, including older identities, or undefined when unregistered.
			*/
			reference(value) {
				this.refresh();
				return this.identities.get(value);
			}
			chat() {
				return this.binding.snapshot.getSnapshot().views.get("chat");
			}
			register(value, reference) {
				if (value !== null && typeof value === "object" && !this.identities.has(value)) this.identities.set(value, reference);
			}
			location(value, step) {
				const turn = value.turn;
				const identity = step === void 0 ? String(turn) : `${turn}/${step}`;
				const kind = step === void 0 ? "turn" : "step";
				const read = () => {
					const current = this.chat()?.timeline.turns.get(turn);
					return step === void 0 ? current : current?.steps.find((value) => value.step === step);
				};
				const firstNode = step === void 0 ? this.chat()?.locations.getTurn(turn)[0] : this.chat()?.locations.getStep(turn, step)[0];
				const target = {
					turn,
					...firstNode === void 0 ? {} : { nodeKey: firstNode }
				};
				this.register(value, {
					id: `${kind}:${identity}`,
					kind,
					identity,
					target,
					read
				});
				this.register(value.data, {
					id: `${kind}-data:${identity}`,
					kind: step === void 0 ? "turnData" : "stepData",
					identity,
					target,
					read: () => read()?.data
				});
			}
			refresh() {
				const chat = this.chat();
				if (chat === void 0) return;
				const nodes = chat.nodes.values();
				if (!this.indexed.has(nodes)) {
					this.indexed.add(nodes);
					for (const node of nodes) {
						const { key, location } = node;
						const turn = location.kind === "turn" || location.kind === "step" ? location.turn.turn : void 0;
						const target = {
							nodeKey: key,
							...turn === void 0 ? {} : { turn }
						};
						this.register(node, {
							id: `node:${key}`,
							kind: "node",
							identity: key,
							target,
							read: () => this.chat()?.nodes.get(key)
						});
						this.register(node.data, {
							id: `node-data:${key}`,
							kind: "nodeData",
							identity: key,
							target,
							read: () => this.chat()?.nodes.get(key)?.data
						});
					}
				}
				if (!this.indexed.has(chat.timeline)) {
					this.indexed.add(chat.timeline);
					for (const turn of chat.timeline.turns.values()) {
						this.location(turn);
						for (const step of turn.steps) this.location(step, step.step);
					}
				}
				const groups = this.binding.snapshot.getSnapshot().views.grouped("chat");
				for (const entry of groups?.entries ?? []) {
					if (entry.kind !== "group") continue;
					const key = entry.key;
					const group = groups.groupSource(key).getSnapshot();
					if (group === void 0 || this.indexed.has(group)) continue;
					this.indexed.add(group);
					const target = { groupKey: key };
					const read = () => this.binding.snapshot.getSnapshot().views.grouped("chat")?.groupSource(key).getSnapshot();
					this.register(group, {
						id: `group:${key}`,
						kind: "group",
						identity: key,
						target,
						read
					});
					this.register(group.data, {
						id: `group-data:${key}`,
						kind: "groupData",
						identity: key,
						target,
						read: () => read()?.data
					});
					for (const member of group.members) {
						const nodeKey = member.key;
						this.register(member, {
							id: `node:${nodeKey}`,
							kind: "node",
							identity: nodeKey,
							target: {
								nodeKey,
								...member.groupPart === void 0 ? {} : { groupPart: member.groupPart }
							},
							read: () => this.chat()?.nodes.get(nodeKey)
						});
					}
				}
			}
		};
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/chat-node/dom.js
		/** DOM lookups owned by the experimental Inspector, using existing Slot and Chat attributes. */
		/**
		* Check an existing element's mounted and ancestor visibility without revealing it.
		* @param element - Candidate element.
		* @returns Whether CSS and hidden ancestors allow it to be displayed.
		*/
		function displayed(element) {
			if (!element.isConnected || element.closest("[hidden]") !== null) return false;
			for (let parent = element; parent !== null; parent = parent.parentElement) {
				const style = getComputedStyle(parent);
				if (style.display === "none" || style.visibility === "hidden") return false;
			}
			return true;
		}
		/**
		* Find the displayed main Chat's outer flow column without entering a Sidebar or nested View.
		* @returns The current Chat column, or undefined while another View is selected.
		*/
		function mainChatRoot() {
			return [...document.querySelectorAll("[data-slot=\"main.conversation\"] [data-slot=\"conversation.view\"] [data-chat-flow]")].find((element) => element.closest("[data-sidebar-right-session], [data-step-process-body]") === null && displayed(element));
		}
		/**
		* Restrict a DOM match to the selected Chat column and its own Conversation View.
		* @param element - Candidate node, including SVG children.
		* @param root - Main Chat column.
		* @returns Whether the candidate belongs to that occurrence.
		*/
		function inChat(element, root) {
			return root.contains(element) && element.closest("[data-sidebar-right-session]") === null && element.closest("[data-slot=\"conversation.view\"]") === root.closest("[data-slot=\"conversation.view\"]");
		}
		/**
		* Enumerate exact and approximate occurrences without changing their display state.
		* @param root - Current main Chat column.
		* @param targets - Exact identities followed by nearby loaded Node identities.
		* @returns Unique candidates, with the requested Turn's occurrences before other Turns.
		*/
		function findChatTargets(root, targets) {
			const fields = [
				"chatCallId",
				"chatNodeKey",
				"chatGroupKey",
				"chatTurn"
			];
			const indexed = {
				chatCallId: /* @__PURE__ */ new Map(),
				chatNodeKey: /* @__PURE__ */ new Map(),
				chatGroupKey: /* @__PURE__ */ new Map(),
				chatTurn: /* @__PURE__ */ new Map()
			};
			for (const element of root.querySelectorAll("[data-chat-call-id], [data-chat-node-key], [data-chat-group-key], [data-chat-turn]")) {
				if (!inChat(element, root)) continue;
				for (const field of fields) {
					const value = element.dataset[field];
					if (value === void 0) continue;
					const matches = indexed[field].get(value);
					if (matches === void 0) indexed[field].set(value, [element]);
					else matches.push(element);
				}
			}
			const found = /* @__PURE__ */ new Set();
			const add = (field, value, part) => {
				if (value === void 0) return;
				for (const element of indexed[field].get(value) ?? []) if (part === void 0 || element.dataset.chatGroupPart === part) found.add(element);
			};
			const turns = /* @__PURE__ */ new Set();
			const preferredTurn = targets.find((target) => target.turn !== void 0)?.turn;
			let preferredTurnAdded = false;
			for (const [index, target] of targets.entries()) {
				if (index > 0 && preferredTurn !== void 0 && target.turn !== preferredTurn && !preferredTurnAdded) {
					add("chatTurn", String(preferredTurn));
					preferredTurnAdded = true;
				}
				add("chatCallId", target.callId);
				add("chatNodeKey", target.nodeKey, target.groupPart);
				add("chatNodeKey", target.nodeKey);
				add("chatCallId", target.rootCallId);
				add("chatGroupKey", target.groupKey);
				if (target.turn !== void 0) turns.add(target.turn);
			}
			for (const turn of turns) if (!preferredTurnAdded || turn !== preferredTurn) add("chatTurn", String(turn));
			return [...found];
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/chat-node/pick-match.js
		/** Replaceable element-to-record matching rules for the Inspector's Chat picker. */
		/**
		* Match tool-call boxes and Node parts before Group or Turn containers; never compare rendered text.
		* @param element - Pointer target in the main Chat.
		* @param root - Inspected Session's displayed main Chat column.
		* @returns Candidate identities and the box to preview, or undefined outside matching content.
		*/
		function matchChatElement(element, root) {
			if (!inChat(element, root) || !displayed(root) || element.closest("[hidden]") !== null) return void 0;
			const closest = (selector) => {
				const found = element.closest(selector);
				return found !== null && inChat(found, root) && displayed(found) ? found : void 0;
			};
			const node = closest("[data-chat-node-key]");
			const call = closest("[data-chat-call-id]");
			const group = closest("[data-chat-group-key]");
			const turnElement = closest("[data-chat-turn]");
			const box = call ?? node ?? group ?? turnElement;
			if (box === void 0) return void 0;
			const turnValue = turnElement?.dataset.chatTurn;
			const turn = turnValue === void 0 || turnValue === "" ? void 0 : Number(turnValue);
			return {
				element: box,
				target: {
					...node?.dataset.chatNodeKey === void 0 ? {} : { nodeKey: node.dataset.chatNodeKey },
					...node?.dataset.chatGroupPart === void 0 ? {} : { groupPart: node.dataset.chatGroupPart },
					...node?.dataset.chatFlowKind === void 0 ? {} : { nodeKind: node.dataset.chatFlowKind },
					...call?.dataset.chatCallId === void 0 ? {} : { callId: call.dataset.chatCallId },
					...group?.dataset.chatGroupKey === void 0 ? {} : { groupKey: group.dataset.chatGroupKey },
					...turn !== void 0 && Number.isSafeInteger(turn) && turn >= 0 ? { turn } : {}
				}
			};
		}
		/**
		* Prefer an exact Node part, then its Node, Group, Step, or Turn table row.
		* @param target - Picked identities.
		* @param rows - Current row identities, including members of folded Inspector groups.
		* @returns The closest materialized table row, or undefined when none matches.
		*/
		function matchChatNodeRow(target, rows) {
			const entries = [...rows];
			if (target.nodeKey !== void 0) {
				const nodes = entries.filter(([, row]) => row.nodeKey === target.nodeKey);
				const exact = nodes.find(([, row]) => row.groupPart === target.groupPart) ?? nodes[0];
				if (exact !== void 0) return exact[0];
			}
			if (target.groupKey !== void 0) {
				const group = entries.find(([, row]) => row.groupKey === target.groupKey && row.nodeKey === void 0);
				if (group !== void 0) return group[0];
			}
			if (target.turn === void 0) return void 0;
			const turn = entries.filter(([, row]) => row.turn === target.turn);
			return (target.step === void 0 ? turn[0] : turn.find(([, row]) => row.step === target.step) ?? turn[0])?.[0];
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/chat-node/model.js
		/** Chat table order follows root references and group membership, independently of row data. */
		const EMPTY = [];
		const COLUMN_FIELDS = ["key", "kind"];
		function nodeRecord(node) {
			const location = node.location;
			return {
				type: node.kind,
				identity: node.key,
				location: location.kind === "step" ? `${location.turn.turn}/${location.step.step}` : location.kind === "turn" ? String(location.turn.turn) : location.kind,
				value: node,
				summary: inspectorPreview(node, COLUMN_FIELDS)
			};
		}
		/** Observes structural Chat changes while visible rows observe their own Node or Group. */
		var ChatNodeModel = class {
			binding;
			rows = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(EMPTY);
			sources = /* @__PURE__ */ new Map();
			groups = /* @__PURE__ */ new Map();
			entries;
			order;
			keys;
			anchors;
			nodeStore;
			grouped;
			subscribers = 0;
			disconnect;
			queued = false;
			targets = /* @__PURE__ */ new Map();
			objectIndex;
			/** @param binding - Existing target-neutral Conversation binding for the inspected Session. */
			constructor(binding) {
				this.binding = binding;
				this.objectIndex = new ChatObjectIndex(binding);
				this.refresh();
			}
			/**
			* Bind object references and publication updates to the inspected Session.
			* @param sessionId - Session displayed by this model.
			* @returns Weak object lookup and row navigation for its details.
			*/
			objects(sessionId) {
				const reference = (value) => {
					const found = this.objectIndex.reference(value);
					if (found === void 0) return void 0;
					const row = [...this.targets].find(([, target]) => found.target.nodeKey !== void 0 ? target.nodeKey === found.target.nodeKey && (found.target.groupPart === void 0 || target.groupPart === found.target.groupPart) : found.target.groupKey !== void 0 && target.groupKey === found.target.groupKey);
					return {
						...found,
						...row === void 0 ? {} : { rowKey: row[0] }
					};
				};
				return {
					sessionId,
					updates: this.binding.snapshot,
					reference,
					row: (key) => {
						const value = this.row(key)?.getSnapshot()?.value;
						if (value === null || typeof value !== "object") return void 0;
						const found = reference(value);
						const target = this.targets.get(key);
						return found === void 0 || target === void 0 ? void 0 : {
							...found,
							rowKey: key,
							target
						};
					}
				};
			}
			/** @returns Stable flattened group/node order. */
			getSnapshot = () => this.rows.getSnapshot();
			/**
			* Match a picked Chat object against the current table, including folded children.
			* @param target - Picked Chat identities.
			* @returns Closest current Node or Group row, or undefined without a match.
			*/
			pick(target) {
				this.refresh(true);
				return matchChatNodeRow(target, this.targets);
			}
			/** @param listener - Structural invalidation callback. @returns Its disposer. */
			subscribe = (listener) => {
				const stop = this.rows.subscribe(listener);
				if (this.subscribers++ === 0) {
					this.disconnect = this.binding.snapshot.subscribe(() => {
						this.refresh();
					});
					this.binding.activate("chat");
					this.refresh(true);
				}
				return () => {
					stop();
					if (--this.subscribers === 0) {
						this.disconnect?.();
						this.disconnect = void 0;
						for (const stop of this.groups.values()) stop();
						this.groups.clear();
					}
				};
			};
			/**
			* Read a loaded row without adding a subscription.
			* @param key - Stable table position.
			* @returns Cached Node or Group metadata source, or undefined outside the loaded rows.
			*/
			row = (key) => this.sources.get(key);
			refresh(force = false) {
				const snapshot = this.binding.snapshot.getSnapshot();
				const chat = snapshot.views.get("chat");
				const grouped = snapshot.views.grouped("chat");
				const nodes = chat?.nodes.values();
				const sameKeys = nodes === void 0 ? this.keys === void 0 : nodes.length === this.keys?.length && nodes.every((node, index) => node.key === this.keys?.[index] && node.anchorSeq === this.anchors?.[index]);
				if (!force && chat?.order === this.order && chat?.nodes === this.nodeStore && sameKeys && grouped === this.grouped && grouped?.entries === this.entries) return;
				this.order = chat?.order;
				this.entries = grouped?.entries;
				this.keys = nodes?.map((node) => node.key);
				this.anchors = nodes?.map((node) => node.anchorSeq);
				if (grouped !== this.grouped) {
					for (const stop of this.groups.values()) stop();
					this.groups.clear();
					this.sources.clear();
				}
				this.grouped = grouped;
				if (chat?.nodes !== this.nodeStore) this.sources.clear();
				this.nodeStore = chat?.nodes;
				const activeGroups = /* @__PURE__ */ new Set();
				this.targets.clear();
				const rows = [];
				const addNode = (entry, parent) => {
					const key = `node:${entry.key}:${entry.groupPart ?? ""}`;
					const location = chat?.nodes.get(entry.key)?.location;
					const turn = location?.kind === "turn" || location?.kind === "step" ? location.turn.turn : void 0;
					const step = location?.kind === "step" ? location.step.step : void 0;
					this.targets.set(key, {
						nodeKey: entry.key,
						...entry.groupPart === void 0 ? {} : { groupPart: entry.groupPart },
						...turn === void 0 ? {} : { turn },
						...step === void 0 ? {} : { step }
					});
					rows.push({
						key,
						depth: parent === void 0 ? 0 : 1,
						...parent === void 0 ? {} : { parent }
					});
					if (!this.sources.has(key) && chat !== void 0) this.sources.set(key, new InspectorRecordSource(chat.nodes.source(entry.key), (node) => {
						const record = nodeRecord(node);
						return entry.groupPart === void 0 ? record : {
							...record,
							identity: `${node.key}#${entry.groupPart}`
						};
					}));
				};
				const entries = grouped?.entries ?? chat?.order.map((key) => ({
					kind: "node",
					key
				})) ?? [];
				const included = /* @__PURE__ */ new Set();
				const entryAnchors = entries.map((entry) => {
					const members = entry.kind === "node" ? [entry] : grouped.groupSource(entry.key).getSnapshot()?.members ?? [];
					let anchor;
					for (const member of members) {
						included.add(member.key);
						const seq = chat?.nodes.get(member.key)?.anchorSeq;
						if (seq !== void 0) anchor = anchor === void 0 ? seq : Math.min(anchor, seq);
					}
					return anchor;
				});
				const unlisted = (nodes ?? []).filter((node) => !included.has(node.key)).sort((left, right) => left.anchorSeq - right.anchorSeq || left.key.localeCompare(right.key));
				let nextUnlisted = 0;
				const addUnlistedBefore = (anchor) => {
					let node = unlisted[nextUnlisted];
					while (node !== void 0 && node.anchorSeq <= anchor) {
						addNode({ key: node.key });
						node = unlisted[++nextUnlisted];
					}
				};
				for (const [index, entry] of entries.entries()) {
					const anchor = entryAnchors[index];
					if (anchor !== void 0) addUnlistedBefore(anchor);
					if (entry.kind === "node") {
						addNode(entry);
						continue;
					}
					activeGroups.add(entry.key);
					const key = `group:${entry.key}`;
					this.targets.set(key, { groupKey: entry.key });
					const source = grouped.groupSource(entry.key);
					const group = source.getSnapshot();
					rows.push({
						key,
						depth: 0
					});
					if (!this.sources.has(key)) this.sources.set(key, new InspectorRecordSource(source, (value) => ({
						type: "group",
						identity: value.key,
						location: "",
						value,
						summary: inspectorPreview(value, COLUMN_FIELDS)
					})));
					for (const member of group?.members ?? []) addNode(member, key);
					if (this.subscribers > 0 && !this.groups.has(entry.key)) {
						let members = group?.members;
						const stop = source.subscribe(() => {
							const next = source.getSnapshot()?.members;
							if (next === members) return;
							members = next;
							this.schedule();
						});
						this.groups.set(entry.key, stop);
					}
				}
				addUnlistedBefore(Infinity);
				for (const [key, stop] of this.groups) if (!activeGroups.has(key)) {
					stop();
					this.groups.delete(key);
				}
				const rowKeys = new Set(rows.map((row) => row.key));
				for (const key of this.sources.keys()) if (!rowKeys.has(key)) this.sources.delete(key);
				this.rows.set(rows);
			}
			schedule() {
				if (this.queued) return;
				this.queued = true;
				queueMicrotask(() => {
					this.queued = false;
					if (this.subscribers > 0) this.refresh(true);
				});
			}
		};
		//#endregion
} // __DSH_FRAGMENT_END__

export {};
