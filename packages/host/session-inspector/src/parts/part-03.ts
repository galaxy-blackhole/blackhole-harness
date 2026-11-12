/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-experimental-session-inspector/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region ../../llm/llm/src/assistant-stream.ts
		/**
		* Lossless compact representation of one model-stream attempt, plus record-level
		* readers that answer common consumer questions without materializing members.
		* Readers trust the static record type; expandAssistantStream is the validating
		* path for records read at a durable boundary.
		*/
		function safeTime(value) {
			if (!Number.isSafeInteger(value)) throw new TypeError(`Assistant stream time must be a safe integer, got ${String(value)}`);
			return value;
		}
		function safeIndex(value, label) {
			if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new TypeError(`${label} index must be a non-negative safe integer`);
			return value;
		}
		function snapshotChunk(chunk) {
			const snapshot = snapshotJsonValue(chunk);
			if (snapshot === void 0) throw new TypeError("Assistant stream chunk must be losslessly JSON-serializable");
			return snapshot;
		}
		/**
		* Expand compact records into the exact timed chunk sequence.
		* @param stream - compact records from one durable Assistant settlement.
		* @returns detached timed chunks with every original delta boundary preserved.
		* @throws {TypeError} when a record or reconstructed timestamp is invalid.
		*/
		function expandAssistantStream(stream) {
			const chunks = [];
			for (const candidate of stream) {
				const record = validateRecord(candidate);
				if (record.type === "chunk") {
					chunks.push({
						time: record.time,
						chunk: record.chunk
					});
					continue;
				}
				const members = record.type === "tool-call-chunks" ? record.args : record.texts;
				let time = record.time0;
				for (let index = 0; index < members.length; index += 1) {
					if (index > 0) time += record.dt[index - 1];
					let chunk;
					if (record.type === "text-chunks") chunk = {
						type: "text-delta",
						index: record.index,
						text: members[index]
					};
					else if (record.type === "reasoning-chunks") chunk = {
						type: "reasoning-delta",
						index: record.index,
						text: members[index]
					};
					else chunk = {
						type: "tool-call-delta",
						index: record.index,
						id: record.id,
						...Object.hasOwn(record, "name") ? { name: record.name } : {},
						argumentsDelta: members[index]
					};
					chunks.push({
						time,
						chunk
					});
				}
			}
			return chunks;
		}
		function validateRecord(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("Assistant stream record must be an object");
			const record = value;
			switch (record.type) {
				case "text-chunks":
				case "reasoning-chunks": {
					exactKeys(record, [
						"type",
						"time0",
						"index",
						"dt",
						"texts"
					], record.type);
					const texts = stringArray(record.texts, `${record.type} texts`);
					if (texts.length === 0) throw new TypeError(`${record.type} texts must be non-empty`);
					validateRun(record, texts.length, record.type);
					return record;
				}
				case "tool-call-chunks": {
					exactKeys(record, Object.hasOwn(record, "name") ? [
						"type",
						"time0",
						"index",
						"dt",
						"id",
						"name",
						"args"
					] : [
						"type",
						"time0",
						"index",
						"dt",
						"id",
						"args"
					], record.type);
					const args = stringArray(record.args, "tool-call-chunks args");
					if (args.length === 0) throw new TypeError("tool-call-chunks args must be non-empty");
					if (typeof record.id !== "string" || record.id.length === 0) throw new TypeError("tool-call-chunks id must be a non-empty string");
					if (record.name !== void 0 && (typeof record.name !== "string" || record.name.length === 0)) throw new TypeError("tool-call-chunks name must be a non-empty string");
					validateRun(record, args.length, record.type);
					return record;
				}
				case "chunk": {
					exactKeys(record, [
						"type",
						"time",
						"chunk"
					], "chunk");
					const time = safeTime(record.time);
					if (typeof record.chunk !== "object" || record.chunk === null || Array.isArray(record.chunk)) throw new TypeError("Assistant stream raw chunk must be a lossless JSON object");
					let chunk;
					try {
						chunk = snapshotChunk(record.chunk);
					} catch (error) {
						throw new TypeError("Assistant stream raw chunk must be a lossless JSON object", { cause: error });
					}
					return deepFreeze({
						type: "chunk",
						time,
						chunk
					});
				}
				default: throw new TypeError(`Unsupported Assistant stream record ${JSON.stringify(record.type)}`);
			}
		}
		function validateRun(record, members, label) {
			safeTime(record.time0);
			safeIndex(record.index, label);
			if (!Array.isArray(record.dt) || record.dt.some((value) => !Number.isSafeInteger(value))) throw new TypeError(`${label} dt must contain safe integers`);
			if (record.dt.length !== members - 1) throw new TypeError(`${label} dt length must be one less than its members`);
			let time = record.time0;
			for (const gap of record.dt) {
				time += gap;
				if (!Number.isSafeInteger(time)) throw new TypeError(`${label} member times must stay safe integers`);
			}
		}
		function stringArray(value, label) {
			if (!Array.isArray(value) || value.some((member) => typeof member !== "string")) throw new TypeError(`${label} must be a string array`);
			return value;
		}
		function exactKeys(record, keys, label) {
			if (Object.keys(record).length !== keys.length || !keys.every((key) => Object.hasOwn(record, key))) throw new TypeError(`${label} Assistant stream record must contain exactly ${keys.join(", ")}`);
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/session-log/stream.js
		/** Block-indexed hierarchy for one live or durable Assistant stream. */
		/** Keeps original delta rows under their blocks and a bounded reasoning prefix for folded headers. */
		var AssistantLogStream = class {
			parent;
			blocks = /* @__PURE__ */ new Map();
			count = 0;
			/** @param parent - Stable Assistant event or live-attempt row identity. */
			constructor(parent) {
				this.parent = parent;
			}
			/**
			* Count all received chunks, including children of folded blocks.
			* @returns Number of original chunks received by this stream.
			*/
			get length() {
				return this.count;
			}
			/**
			* Add one original chunk and update the matching block's disclosure state.
			* Chunks without a loaded block-start remain direct Assistant children.
			* @param chunk - Original chunk, correlated by block index.
			* @returns One row insertion, an optional replaced block header, and its folded preview.
			*/
			append(chunk) {
				const index = this.count++;
				const key = `${this.parent}/chunk:${index}`;
				let position = index;
				let row = {
					key,
					parent: this.parent,
					depth: 1
				};
				let header;
				let block;
				if (chunk.type === "block-start") {
					block = {
						row: {
							...row,
							disclosure: "open"
						},
						offset: index,
						children: 0,
						...chunk.blockType === "reasoning" ? { reasoningText: "" } : {}
					};
					row = block.row;
					this.blocks.set(chunk.index, block);
				} else {
					block = "index" in chunk ? this.blocks.get(chunk.index) : void 0;
					if (block !== void 0) {
						position = block.offset + 1 + block.children++;
						row = {
							key,
							parent: block.row.key,
							depth: 2
						};
						for (const following of this.blocks.values()) if (following.offset > block.offset) following.offset++;
						if (chunk.type === "reasoning-delta" && block.reasoningText !== void 0) block.reasoningText = (block.reasoningText + chunk.text).slice(0, 240);
						if (chunk.type === "block-end") {
							block.row = {
								...block.row,
								disclosure: "closed"
							};
							header = {
								position: block.offset,
								row: block.row
							};
						}
					}
				}
				return {
					key,
					index,
					position,
					row,
					...header === void 0 ? {} : { header },
					...block?.reasoningText === void 0 ? {} : { collapsed: {
						key: block.row.key,
						summary: `blockType: reasoning${block.reasoningText === "" ? "" : ` · ${block.reasoningText}`}`.slice(0, 240)
					} }
				};
			}
		};
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/session-log/groups.js
		/** Turn and Step start/end ranges add ancestry without inventing or reordering log records. */
		/** One ordered pass over the loaded log; missing starts do not create synthetic headers. */
		var SessionLogGroups = class {
			turn;
			step;
			/**
			* Place a record inside its open Step or Turn, retaining end records as the final children.
			* Turn and Step headers remain expanded after their end; manual folding stays table-local.
			* @param row - Ungrouped event row.
			* @param event - Original event.
			* @returns The same row identity with range ancestry and depth.
			*/
			append(row, event) {
				switch (event.type) {
					case "turn/start":
						this.step = void 0;
						this.turn = {
							...row,
							disclosure: "open"
						};
						return this.turn;
					case "step/start":
						this.step = {
							...this.child(row, this.turn),
							disclosure: "open"
						};
						return this.step;
					case "step/end": {
						const result = this.child(row, this.step ?? this.turn);
						this.step = void 0;
						return result;
					}
					case "turn/end": {
						const result = this.child(row, this.turn);
						this.step = void 0;
						this.turn = void 0;
						return result;
					}
					default: return this.child(row, this.step ?? this.turn);
				}
			}
			child(row, parent) {
				return parent === void 0 ? row : {
					...row,
					parent: parent.key,
					depth: parent.depth + 1
				};
			}
		};
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/session-log/model.js
		/** Incremental raw Session rows with lossless Assistant stream children. */
		/** Session-owned log projection; subscriptions exist only while the table is observed. */
		var SessionLogModel = class {
			source;
			rows = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)([]);
			records = /* @__PURE__ */ new Map();
			roots = [];
			attempts = /* @__PURE__ */ new Map();
			groups = new SessionLogGroups();
			/** Preserve live-to-durable row identities only while their rows remain in the loaded window. */
			settledRoots = /* @__PURE__ */ new Map();
			streams = /* @__PURE__ */ new WeakMap();
			revision = -1;
			subscribers = 0;
			disconnect;
			/**
			* @param source - The existing Session window, shared with Chat and Trajectory.
			*/
			constructor(source) {
				this.source = source;
				this.accept(source.getSnapshot());
			}
			/** @returns Stable table order; row contents have independent sources. */
			getSnapshot = () => this.rows.getSnapshot();
			/**
			* Recover an event's placement without interpreting formatted table cells.
			* @param key - Selected root or delta row.
			* @returns The owning event and chunk, or undefined if the row is unavailable.
			*/
			chatAnchor(key) {
				this.accept(this.source.getSnapshot());
				const root = this.roots.find((root) => root.row.key === key || root.stream !== void 0 && key.startsWith(`${root.row.key}/chunk:`));
				if (root === void 0) return void 0;
				const record = this.records.get(key)?.getSnapshot();
				if (record === void 0) return void 0;
				return {
					event: root.entry.event,
					...root.row.key === key ? {} : { chunk: record.value }
				};
			}
			/**
			* Resolve a picked Chat object in the loaded log, without creating synthetic records.
			* @param target - DOM identity enriched with the owning Chat Node's sequence and Turn/Step.
			* @returns Tool call, exact anchor, Assistant, Step, or Turn row; reasoning parts prefer a block-start child.
			*/
			pick(target) {
				const window = this.source.getSnapshot();
				this.accept(window);
				const entries = window.entries;
				const sameStep = (entry) => {
					const data = entry.event.data;
					return target.turn !== void 0 && "turn" in data && data.turn === target.turn && (target.step === void 0 || "step" in data && data.step === target.step);
				};
				const call = target.callId === void 0 ? void 0 : entries.find((entry) => entry.event.type === "tool/call" && entry.event.data.callId === target.callId);
				const anchor = target.anchorSeq === void 0 ? void 0 : entries.find((entry) => entry.event.seq === target.anchorSeq);
				const assistant = target.nodeKind !== "assistant-step" ? void 0 : entries.findLast((entry) => sameStep(entry) && (entry.event.type === "assistant/message" || entry.event.type === "assistant/attempt" || entry.type === "transient"));
				const step = target.step === void 0 ? void 0 : entries.find((entry) => entry.event.type === "step/start" && sameStep(entry));
				const turn = target.turn === void 0 ? void 0 : entries.find((entry) => entry.event.type === "turn/start" && entry.event.data.turn === target.turn);
				const entry = call ?? anchor ?? assistant ?? step ?? turn ?? entries.find(sameStep);
				if (entry === void 0) return void 0;
				const key = entry.type === "transient" ? `attempt:${entry.event.data.attemptId}` : this.settledRoots.get(entry.event.seq) ?? `event:${entry.event.seq}`;
				if (target.groupPart === "reasoning") {
					const block = this.rows.getSnapshot().find((row) => {
						if (row.parent !== key) return false;
						const value = this.records.get(row.key)?.getSnapshot()?.value;
						return value !== null && typeof value === "object" && "type" in value && value.type === "block-start" && "blockType" in value && value.blockType === "reasoning";
					});
					if (block !== void 0) return block.key;
				}
				return key;
			}
			/** @param listener - Structural invalidation callback. @returns Subscription disposer. */
			subscribe = (listener) => {
				const stop = this.rows.subscribe(listener);
				if (this.subscribers++ === 0) {
					this.disconnect = this.source.subscribe(() => {
						this.accept(this.source.getSnapshot());
					});
					this.accept(this.source.getSnapshot());
				}
				return () => {
					stop();
					if (--this.subscribers === 0) {
						this.disconnect?.();
						this.disconnect = void 0;
					}
				};
			};
			/**
			* Obtain a cached row source, initially empty when its record is unavailable.
			* @param key - Stable table row identity.
			* @returns Its independently observable raw data.
			*/
			row = (key) => {
				let record = this.records.get(key);
				if (record === void 0) {
					record = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(void 0);
					this.records.set(key, record);
				}
				return record;
			};
			put(key, record) {
				this.row(key);
				const source = this.records.get(key);
				if (source.getSnapshot()?.value !== record.value) source.set(record);
			}
			accept(window) {
				if (window.revision === this.revision) return;
				if (window.change.kind === "settle-assistant" && window.change.entry !== void 0) {
					const parent = `attempt:${window.change.attemptId}`;
					if (this.attempts.has(parent)) this.settledRoots.set(window.change.entry.event.seq, parent);
				}
				const append = window.revision === this.revision + 1 && window.change.kind === "append";
				if (!append) {
					this.roots.length = 0;
					this.attempts.clear();
					this.groups = new SessionLogGroups();
				}
				const next = append ? this.rows.getSnapshot().slice() : [];
				const entries = append ? window.change.entries : window.entries;
				for (const entry of entries) this.add(entry, next);
				this.revision = window.revision;
				if (!append) this.prune(next);
				this.rows.set(next);
			}
			prune(rows) {
				const retained = new Set(rows.map((row) => row.key));
				for (const [seq, key] of this.settledRoots) if (!retained.has(key)) this.settledRoots.delete(seq);
				for (const [key, source] of this.records) if (!retained.has(key)) {
					source.set(void 0);
					this.records.delete(key);
				}
			}
			root(key, entry, rows, stream) {
				const row = this.groups.append({
					key,
					depth: 0
				}, entry.event);
				const root = {
					row,
					entry,
					stream,
					ordinal: this.roots.length,
					offset: rows.length
				};
				this.roots.push(root);
				rows.push(row);
				return root;
			}
			add(entry, rows) {
				if (entry.type === "transient") {
					const event = entry.event;
					const { attemptId, turn, step, chunk } = entry.event.data;
					const parent = `attempt:${attemptId}`;
					let attempt = this.attempts.get(parent);
					if (attempt === void 0) {
						attempt = this.root(parent, entry, rows, new AssistantLogStream(parent));
						this.attempts.set(parent, attempt);
					}
					const chunks = this.addChunk(attempt, rows, event.time, chunk, `${turn}/${step}`);
					this.put(parent, {
						type: "assistant/live",
						identity: attemptId,
						location: `${turn}/${step}`,
						time: event.time,
						value: {
							attemptId,
							turn,
							step,
							chunks
						}
					});
					return;
				}
				const event = entry.event;
				const key = this.settledRoots.get(event.seq) ?? `event:${event.seq}`;
				const data = event.data;
				const location = "turn" in data ? `${data.turn}${"step" in data ? `/${data.step}` : ""}` : "";
				this.put(key, {
					type: event.type,
					identity: String(event.seq),
					time: event.time,
					location,
					value: event
				});
				if (entry.event.type === "assistant/message" || entry.event.type === "assistant/attempt") {
					const hierarchy = new AssistantLogStream(key);
					const root = this.root(key, entry, rows, hierarchy);
					const stream = entry.event.data.stream;
					let chunks = this.streams.get(stream);
					if (chunks === void 0) {
						chunks = expandAssistantStream(stream);
						this.streams.set(stream, chunks);
					}
					for (const item of chunks) this.addChunk(root, rows, item.time, item.chunk, location);
				} else this.root(key, entry, rows);
			}
			addChunk(root, rows, time, chunk, location) {
				const stream = root.stream;
				const { key, index, position, row, header, collapsed } = stream.append(chunk);
				rows.splice(root.offset + 1 + position, 0, {
					...row,
					depth: row.depth + root.row.depth
				});
				if (header !== void 0) rows[root.offset + 1 + header.position] = {
					...header.row,
					depth: header.row.depth + root.row.depth
				};
				for (let ordinal = root.ordinal + 1; ordinal < this.roots.length; ordinal++) this.roots[ordinal].offset++;
				this.put(key, {
					type: chunk.type,
					identity: String(index),
					time,
					location,
					value: chunk
				});
				if (collapsed !== void 0) {
					const source = this.records.get(collapsed.key);
					const previous = source.getSnapshot();
					if (previous.collapsedSummary !== collapsed.summary) source.set({
						...previous,
						collapsedSummary: collapsed.summary
					});
				}
				return stream.length;
			}
		};
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/session-log/chat-target.js
		/** Original log coordinates submitted for target-owned Chat reveal. */
		function partOf(chunk) {
			if (chunk?.type === "reasoning-delta") return "reasoning";
			if (chunk?.type === "text-delta") return "response";
			const type = chunk?.type === "block-start" ? chunk.blockType : chunk?.type === "block-end" ? chunk.block.type : void 0;
			return type === "reasoning" ? "reasoning" : type === "text" ? "response" : void 0;
		}
		/**
		* Describe a log record without reading another View's model or DOM.
		* @param anchor - Original log event and optional selected delta.
		* @returns Original event coordinates and any tool-call or Assistant-part identity.
		*/
		function sessionLogChatTarget(anchor) {
			const { event, chunk } = anchor;
			const data = event.data;
			const turn = "turn" in data && typeof data.turn === "number" ? data.turn : void 0;
			const step = "step" in data && typeof data.step === "number" ? data.step : void 0;
			const callId = event.type === "tool/call" ? event.data.callId : event.type === "tool/result" ? event.data.message.source.callId : "subCallId" in data && typeof data.subCallId === "string" ? data.subCallId : chunk?.type === "tool-call-delta" ? chunk.id : chunk?.type === "block-end" && chunk.block.type === "tool-call" ? chunk.block.id : void 0;
			const rootCallId = "rootCallId" in data && typeof data.rootCallId === "string" ? data.rootCallId : callId;
			const groupPart = partOf(chunk);
			return {
				anchorSeq: event.seq,
				...event.type === "assistant/message" || event.type === "assistant/attempt" || event.type === "assistant/live-chunk" ? { nodeKind: "assistant-step" } : {},
				...turn === void 0 ? {} : { turn },
				...step === void 0 ? {} : { step },
				...callId === void 0 ? {} : { callId },
				...rootCallId === void 0 || rootCallId === callId ? {} : { rootCallId },
				...groupPart === void 0 ? {} : { groupPart }
			};
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/raw-json.js
		/** JSON inspection of live objects, including cyclic Location stores. */
		var InspectorJsonWriter = class {
			ancestors = [];
			containers = /* @__PURE__ */ new WeakMap();
			write(value) {
				const replace = this.replace.bind(this);
				const result = JSON.stringify(value, function(_key, item) {
					return replace(this, item);
				}, 2);
				return typeof result === "string" ? result : "";
			}
			replace(parent, value) {
				if (typeof value === "bigint") return `${value}n`;
				if (value === null || typeof value !== "object") return value;
				while (this.ancestors.length > 0 && this.ancestors.at(-1) !== parent) this.ancestors.pop();
				let rendered = value;
				if (value instanceof Map || value instanceof Set) {
					const container = this.containers.get(value) ?? (value instanceof Map ? Object.fromEntries(value) : [...value]);
					this.containers.set(value, container);
					rendered = container;
				}
				if (this.ancestors.includes(rendered)) return "[Circular]";
				this.ancestors.push(rendered);
				return rendered;
			}
		};
		/**
		* Serialize raw details without allowing a formatting failure to retire the View.
		* @param value - Original record; Maps/Sets become objects/arrays and bigint becomes an n-suffixed string.
		* @returns JSON with circular references marked, or an error message for the detail panel.
		*/
		function inspectorJson(value) {
			try {
				return {
					text: new InspectorJsonWriter().write(value),
					failed: false
				};
			} catch (error) {
				return {
					text: error instanceof Error ? error.message : String(error),
					failed: true
				};
			}
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/experimental/session-inspector/src/client/views/inspector.module.css.mjs
		const css = "__GBH_SESSION_INSPECTOR_CSS_inspector__";
		const tagId = "@deepseek-ai/dsh-experimental-session-inspector/inspector.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-experimental-session-inspector";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var inspector_module_css_default = {
			"chatPick": "GTtnTq_chatPick",
			"chatPickMask": "GTtnTq_chatPickMask",
			"chatReveal": "GTtnTq_chatReveal",
			"contextRow": "GTtnTq_contextRow",
			"details": "GTtnTq_details",
			"detailsResize": "GTtnTq_detailsResize",
			"disclosure": "GTtnTq_disclosure",
			"empty": "GTtnTq_empty",
			"idColumn": "GTtnTq_idColumn",
			"identity": "GTtnTq_identity",
			"identityText": "GTtnTq_identityText",
			"locationColumn": "GTtnTq_locationColumn",
			"modeControls": "GTtnTq_modeControls",
			"modeSelector": "GTtnTq_modeSelector",
			"objectBreadcrumbs": "GTtnTq_objectBreadcrumbs",
			"objectDetails": "GTtnTq_objectDetails",
			"objectField": "GTtnTq_objectField",
			"objectMuted": "GTtnTq_objectMuted",
			"objectReference": "GTtnTq_objectReference",
			"objectTree": "GTtnTq_objectTree",
			"objectValue": "GTtnTq_objectValue",
			"pickButton": "GTtnTq_pickButton",
			"pickNotice": "GTtnTq_pickNotice",
			"preview": "GTtnTq_preview",
			"record": "GTtnTq_record",
			"root": "GTtnTq_root",
			"scroller": "GTtnTq_scroller",
			"selected": "GTtnTq_selected",
			"sticky": "GTtnTq_sticky",
			"table": "GTtnTq_table",
			"timeColumn": "GTtnTq_timeColumn",
			"toolbar": "GTtnTq_toolbar",
			"typeColumn": "GTtnTq_typeColumn",
			"typeFilterActions": "GTtnTq_typeFilterActions",
			"typeFilterButton": "GTtnTq_typeFilterButton",
			"typeFilterHelp": "GTtnTq_typeFilterHelp",
			"typeFilterInput": "GTtnTq_typeFilterInput",
			"typeFilterOptions": "GTtnTq_typeFilterOptions",
			"typeFilterPanel": "GTtnTq_typeFilterPanel",
			"typeHeader": "GTtnTq_typeHeader"
		};
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/InspectorDetails.js
		/** Locally resizable raw-data panel; pointer capture owns the drag lifetime. */
		function clampPercent(value) {
			return Math.max(15, Math.min(80, value));
		}
		/**
		* Resize the raw-data area from its upper edge while keeping the table visible.
		* @param props - Complete raw text, localized labels, and close callback.
		* @returns Detail text with a pointer- and keyboard-operated horizontal separator.
		*/
		function InspectorDetails({ text, failed, children, close, t }) {
			const id = (0, react.useId)();
			const panel = (0, react.useRef)(null);
			const drag = (0, react.useRef)(null);
			const [percent, setPercent] = (0, react.useState)(40);
			const resize = (event) => {
				const current = drag.current;
				if (current === null || current.pointerId !== event.pointerId) return;
				setPercent(clampPercent((current.height + current.y - event.clientY) / current.available * 100));
			};
			const stop = (event) => {
				if (drag.current?.pointerId !== event.pointerId) return;
				drag.current = null;
				if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: panel,
				id,
				className: inspector_module_css_default.details,
				style: { flexBasis: `${percent}%` },
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						role: "separator",
						tabIndex: 0,
						"aria-orientation": "horizontal",
						"aria-controls": id,
						"aria-label": t("table.resizeDetails"),
						"aria-valuemin": 15,
						"aria-valuemax": 80,
						"aria-valuenow": Math.round(percent),
						className: inspector_module_css_default.detailsResize,
						onPointerDown: (event) => {
							if (event.button !== 0 || drag.current !== null) return;
							const element = panel.current;
							const available = element?.parentElement?.getBoundingClientRect().height ?? 0;
							if (element === null || available === 0) return;
							event.preventDefault();
							drag.current = {
								pointerId: event.pointerId,
								y: event.clientY,
								height: element.getBoundingClientRect().height,
								available
							};
							event.currentTarget.setPointerCapture(event.pointerId);
						},
						onPointerMove: resize,
						onPointerUp: (event) => {
							resize(event);
							stop(event);
						},
						onPointerCancel: stop,
						onLostPointerCapture: () => {
							drag.current = null;
						},
						onKeyDown: (event) => {
							switch (event.key) {
								case "ArrowUp":
									setPercent((value) => clampPercent(value + 5));
									break;
								case "ArrowDown":
									setPercent((value) => clampPercent(value - 5));
									break;
								case "Home":
									setPercent(15);
									break;
								case "End":
									setPercent(80);
									break;
								default: return;
							}
							event.preventDefault();
						}
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: inspector_module_css_default.toolbar,
						children: [(0, react_jsx_runtime.jsx)("span", { children: t("table.raw") }), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: close,
							children: t("table.close")
						})]
					}),
					children === void 0 ? (0, react_jsx_runtime.jsx)("pre", {
						role: failed ? "alert" : void 0,
						children: text
					}) : (0, react_jsx_runtime.jsx)("div", {
						className: inspector_module_css_default.objectDetails,
						children
					})
				]
			});
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/object-value.js
		/** Shallow, typed runtime-object inspection without JSON conversion or implicit getter calls. */
		var CollectionProperties = class {
			value;
			length;
			constructor(value, length) {
				this.value = value;
				this.length = length;
			}
		};
		const typedArrayLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "length").get;
		function indexedLength(value) {
			if (Array.isArray(value)) return value.length;
			if (ArrayBuffer.isView(value) && !(value instanceof DataView)) return typedArrayLength.call(value);
		}
		function field(value, key, index) {
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			return {
				key: typeof key === "symbol" ? `symbol:${index}` : key,
				name: String(key),
				value: descriptor?.value,
				...descriptor === void 0 ? { absent: true } : "value" in descriptor ? {} : { accessor: true }
			};
		}
		/** Display of one value; child enumeration never recursively visits child values. */
		var InspectorObjectValue = class {
			value;
			/** Shallow type or scalar preview; no child getters are evaluated. */
			label;
			/** Whether this value permits child enumeration rather than opaque scalar display. */
			expandable;
			/** @param value - Original runtime value, including Maps, Sets, and class instances. */
			constructor(value) {
				this.value = value;
				this.expandable = value !== null && typeof value === "object" && !(value instanceof Date || value instanceof RegExp || value instanceof WeakMap || value instanceof WeakSet);
				if (value instanceof Map) this.label = `Map(${value.size})`;
				else if (value instanceof Set) this.label = `Set(${value.size})`;
				else if (Array.isArray(value)) this.label = `Array(${value.length})`;
				else if (value instanceof Date) this.label = `Date(${Number.isNaN(value.getTime()) ? "Invalid" : value.toISOString()})`;
				else if (value instanceof RegExp) this.label = String(value);
				else if (value instanceof WeakMap) this.label = "WeakMap";
				else if (value instanceof WeakSet) this.label = "WeakSet";
				else if (value instanceof ArrayBuffer) this.label = `ArrayBuffer(${value.byteLength})`;
				else if (value instanceof CollectionProperties) this.label = "Object";
				else if (value !== null && typeof value === "object") {
					const prototype = Object.getPrototypeOf(value);
					const constructor = prototype === null ? void 0 : Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
					this.label = typeof constructor === "function" ? constructor.name : "Object";
				} else if (typeof value === "string") this.label = JSON.stringify(value);
				else if (typeof value === "bigint") this.label = `${value}n`;
				else if (typeof value === "function") this.label = `[Function ${value.name}]`;
				else this.label = String(value);
			}
			/**
			* Enumerate one level without evaluating accessors or descending into children.
			* @returns Original children; Map keys remain values rather than being coerced to property names.
			*/
			*entries() {
				const value = this.value;
				if (value instanceof Map) {
					let index = 0;
					const entries = value;
					for (const [key, item] of entries) yield {
						key: String(index),
						name: String(index++),
						value: {
							key,
							value: item
						}
					};
				} else if (value instanceof Set) {
					let index = 0;
					for (const item of value) yield {
						key: String(index),
						name: String(index++),
						value: item
					};
				} else if (value instanceof ArrayBuffer || value instanceof DataView) yield {
					key: "bytes",
					name: "bytes",
					value: value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
				};
				else if (value !== null && typeof value === "object") {
					const length = indexedLength(value);
					if (length !== void 0) {
						yield {
							key: "properties",
							name: "",
							properties: true,
							value: new CollectionProperties(value, length)
						};
						for (let index = 0; index < length; index++) yield field(value, String(index), index);
					} else {
						const target = value instanceof CollectionProperties ? value.value : value;
						for (const [index, key] of Reflect.ownKeys(target).entries()) {
							if (value instanceof CollectionProperties && typeof key === "string" && (key === "length" && Array.isArray(target) || String(Number(key)) === key && Number.isInteger(Number(key)) && Number(key) >= 0 && Number(key) < value.length)) continue;
							const entry = field(target, key, index);
							if (!entry.absent) yield entry;
						}
					}
				}
			}
		};
		//#endregion
} // __DSH_FRAGMENT_END__

export {};
