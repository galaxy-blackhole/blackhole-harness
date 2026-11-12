/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			}
			/**
			* Remove one association and its strongly retained value.
			* @param key - weakly held lookup key.
			* @returns whether an association was removed.
			*/
			delete(key) {
				if (!this.keys.has(key)) return false;
				const value = this.keys.get(key);
				const deleted = this.keys.delete(key);
				this.valueSet.delete(value);
				return deleted;
			}
			/** Remove every association and strongly retained value. */
			clear() {
				this.keys = /* @__PURE__ */ new WeakMap();
				this.valueSet.clear();
			}
		};
		//#endregion
		//#region lib/types/client/contract/request-inspection.js
		/**
		* Canonicalize one request header against the system node in force and
		* classify the model-visible prompt change.
		* @param previous - Prompt from the preceding loaded request header, when available.
		* @param event - Durable full request header to inspect.
		* @param system - Effective nonempty system prompt after loaded surface replacements; empty when removed.
		* An in-history update already presented its text at its own position, so the header reports no system change for it.
		* @returns The canonical prompt and an initial/system/tool change when it can be established.
		*/
		function inspectRequestPrompt(previous, event, system) {
			const header = event.data.header;
			const rawTools = header.tools;
			const prompt = {
				config: header.config,
				system: system?.text ?? "",
				tools: Array.isArray(rawTools) ? rawTools : []
			};
			if (previous === void 0 && event.data.reason !== "initial") return { prompt };
			const systemChanged = previous !== void 0 && previous.system !== prompt.system && system?.update !== true;
			const toolsChanged = previous !== void 0 && JSON.stringify(previous.tools) !== JSON.stringify(prompt.tools);
			if (previous !== void 0 && !systemChanged && !toolsChanged) return { prompt };
			const origin = system !== void 0 && (previous === void 0 || systemChanged) ? system : event;
			return {
				prompt,
				change: {
					seq: origin.seq,
					time: origin.time,
					kind: previous === void 0 ? "initial" : systemChanged && toolsChanged ? "system-and-tools" : systemChanged ? "system" : "tools",
					...previous === void 0 ? {} : { previous }
				}
			};
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
		//#endregion
		//#region lib/types/client/contract/system-prompt.js
		/**
		* Apply a system event or positional replacement without retaining ordinary messages.
		* Replacement positions inherit their start endpoint, not their chronological seq.
		* Unknown older endpoint order withholds the prompt until prepend replay resolves it.
		* @param previous - Interpretation at the preceding relevant event in the loaded window.
		* @param event - System message or surface replacement already admitted by Session.
		* @returns Immutable surviving system facts and the effective nonempty prompt.
		*/
		function inspectSystemPrompt(previous, event) {
			const op = isSurfaceEvent(event) ? event.surfaceOp : void 0;
			const firstSeq = previous?.firstSeq ?? event.seq;
			let nodes = previous?.nodes ?? [];
			let replacements = previous?.replacements ?? /* @__PURE__ */ new Map();
			const unknownEndpoint = (seq) => seq < firstSeq && !replacements.has(seq);
			const uncertain = previous?.uncertain === true || op !== void 0 && op !== "append" && (unknownEndpoint(op.startSeq) || unknownEndpoint(op.endSeq));
			if (uncertain) return {
				firstSeq,
				uncertain,
				nodes: [],
				replacements: /* @__PURE__ */ new Map(),
				effective: void 0,
				introduced: void 0
			};
			let position = event.seq;
			if (op !== void 0 && op !== "append") {
				position = replacements.get(op.startSeq) ?? op.startSeq;
				const end = replacements.get(op.endSeq) ?? op.endSeq;
				nodes = nodes.filter((item) => item.position < position || item.position > end);
				const retained = new Map([...replacements].filter(([, value]) => value < position || value > end));
				retained.set(event.seq, position);
				replacements = retained;
			}
			const introduced = event.type === "system/message" ? {
				seq: event.seq,
				time: event.time,
				turn: event.data.turn,
				step: event.data.step,
				text: event.data.message.content.flatMap((block) => block.type === "text" ? [block.text] : []).join(""),
				update: op === "append" && previous?.nodes.some((item) => item.node.text !== "") === true
			} : void 0;
			if (introduced !== void 0) nodes = [...nodes, {
				position,
				node: introduced
			}].sort((a, b) => a.position - b.position);
			const surviving = nodes.findLast((item) => item.node.text !== "")?.node;
			const effective = surviving === previous?.nodes.findLast((item) => item.node.text !== "")?.node ? previous?.effective : introduced !== void 0 && introduced === surviving ? introduced : {
				seq: event.seq,
				time: event.time,
				turn: surviving?.turn ?? 0,
				step: surviving?.step ?? 0,
				text: surviving?.text ?? "",
				update: false
			};
			return {
				firstSeq,
				uncertain,
				nodes,
				replacements,
				effective,
				introduced
			};
		}
		//#endregion
		//#region lib/types/client/contract/conversation.js
		/**
		* Build a stable collision-free key for one Definition-local business identity.
		* @param kind - Definition kind.
		* @param id - Definition-local business identity.
		* @returns engine-owned Context key.
		*/
		function conversationContextKey(kind, id) {
			return `${kind.length}:${kind}${id}`;
		}
		//#endregion
		//#region lib/types/client/conversation/group-store.js
		/** Keyed group publication and incremental validation of rendering positions. */
		function sameNodeReference(left, right) {
			return left.key === right.key && left.groupPart === right.groupPart;
		}
		function sameEntry(left, right) {
			return left.kind === right.kind && left.key === right.key && (left.kind === "group" || right.kind === "node" && left.groupPart === right.groupPart);
		}
		function reuseReferences(previous, next, equal) {
			return previous === next || previous.length === next.length && previous.every((value, index) => equal(value, next[index])) ? previous : next;
		}
		/** Validates a complete batch before installing its group and root-list changes. */
		var ConversationGroupStore = class {
			root = [];
			rootGroups = /* @__PURE__ */ new Set();
			groups = /* @__PURE__ */ new Map();
			placements = /* @__PURE__ */ new Map();
			sources = /* @__PURE__ */ new Map();
			dirty = /* @__PURE__ */ new Set();
			/** @returns the identity-stable ordered root references. */
			get entries() {
				return this.root;
			}
			groupSource(key) {
				let source = this.sources.get(key);
				if (source === void 0) {
					const publication = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(this.groups.get(key));
					source = {
						publication,
						observable: {
							getSnapshot: () => this.groups.get(key),
							subscribe: (listener) => publication.subscribe(listener)
						}
					};
					this.sources.set(key, source);
				}
				return source.observable;
			}
			/**
			* Install one validated update without notifying readers.
			* @param update - root replacement and complete or incremental group records.
			* @param readNode - synchronous reader of the current target Nodes.
			*/
			prepareAndInstall(update, readNode) {
				const nextRoot = update.entries === void 0 ? this.root : reuseReferences(this.root, update.entries, sameEntry);
				const nextRootGroups = nextRoot === this.root ? this.rootGroups : this.collectRootGroups(nextRoot);
				const { upserts, removes } = this.collectChanges(update);
				const replaceReferences = update.groups.kind === "replace";
				if (this.groups.size - removes.size + [...upserts.keys()].filter((key) => !this.groups.has(key)).length !== nextRootGroups.size) throw new Error("conversation group records and root references must correspond one-to-one");
				for (const key of removes) if (nextRootGroups.has(key)) throw new Error(`conversation group "${key}" is still referenced`);
				for (const key of upserts.keys()) if (!nextRootGroups.has(key)) throw new Error(`conversation group "${key}" has no root reference`);
				if (nextRootGroups !== this.rootGroups) {
					for (const key of nextRootGroups) if (!upserts.has(key) && !this.groups.has(key)) throw new Error(`conversation root references missing group "${key}"`);
				}
				const affectedParts = /* @__PURE__ */ new Map();
				const partsOf = (key) => {
					let parts = affectedParts.get(key);
					if (parts === void 0) {
						parts = new Set(this.placements.get(key));
						affectedParts.set(key, parts);
					}
					return parts;
				};
				const removeReference = (reference) => {
					partsOf(reference.key).delete(reference.groupPart);
				};
				const addReference = (reference) => {
					if (readNode(reference.key) === void 0) throw new Error(`conversation group references missing Node "${reference.key}"`);
					const parts = partsOf(reference.key);
					if (parts.has(reference.groupPart) || reference.groupPart === void 0 && parts.size > 0 || parts.has(void 0)) throw new Error(`conversation Node "${reference.key}" has overlapping rendering positions`);
					parts.add(reference.groupPart);
				};
				if (replaceReferences || nextRoot !== this.root) {
					for (const entry of this.root) if (entry.kind === "node") removeReference(entry);
				}
				for (const key of removes) for (const member of this.groups.get(key).members) removeReference(member);
				for (const [key, next] of upserts) {
					const previous = this.groups.get(key);
					if (previous !== void 0 && (replaceReferences || previous.members !== next.members)) for (const member of previous.members) removeReference(member);
				}
				if (replaceReferences || nextRoot !== this.root) {
					for (const entry of nextRoot) if (entry.kind === "node") addReference(entry);
				}
				for (const [key, next] of upserts) if (replaceReferences || this.groups.get(key)?.members !== next.members) for (const member of next.members) addReference(member);
				for (const [key, parts] of affectedParts) if (parts.size === 0) this.placements.delete(key);
				else this.placements.set(key, parts);
				for (const key of removes) {
					this.groups.delete(key);
					this.dirty.add(key);
				}
				for (const [key, next] of upserts) {
					if (this.groups.get(key) === next) continue;
					this.groups.set(key, next);
					this.dirty.add(key);
				}
				this.root = nextRoot;
				this.rootGroups = nextRootGroups;
			}
			/** Publish changed group sources after all related target data has been installed. */
			publish() {
				const keys = [...this.dirty];
				this.dirty.clear();
				for (const key of keys) this.sources.get(key)?.publication.set(this.groups.get(key));
			}
			/** Remove grouping without deleting its source Nodes; publication remains deferred. */
			clear() {
				this.prepareAndInstall(
					{
						entries: [],
						groups: {
							kind: "replace",
							snapshots: []
						}
					},
					/* v8 ignore next -- an empty replacement never reads a Node reference. */
					() => void 0
				);
			}
			collectRootGroups(entries) {
				const keys = /* @__PURE__ */ new Set();
				for (const entry of entries) {
					if (entry.kind !== "group") continue;
					if (keys.has(entry.key)) throw new Error(`conversation group "${entry.key}" has duplicate root references`);
					keys.add(entry.key);
				}
				return keys;
			}
			collectChanges(update) {
				const upserts = /* @__PURE__ */ new Map();
				const removes = /* @__PURE__ */ new Set();
				const add = (snapshot) => {
					if (upserts.has(snapshot.key)) throw new Error(`conversation group "${snapshot.key}" has duplicate upserts`);
					const previous = this.groups.get(snapshot.key);
					if (previous === void 0) {
						upserts.set(snapshot.key, snapshot);
						return;
					}
					const members = reuseReferences(previous.members, snapshot.members, sameNodeReference);
					upserts.set(snapshot.key, previous.data === snapshot.data && previous.members === members ? previous : {
						...snapshot,
						members
					});
				};
				switch (update.groups.kind) {
					case "replace":
						for (const snapshot of update.groups.snapshots) add(snapshot);
						for (const key of this.groups.keys()) if (!upserts.has(key)) removes.add(key);
						break;
					case "apply":
						for (const snapshot of update.groups.upserts) add(snapshot);
						for (const key of update.groups.removes) {
							if (removes.has(key)) throw new Error(`conversation group "${key}" has duplicate removals`);
							if (!this.groups.has(key)) throw new Error(`conversation group "${key}" cannot be removed because it is absent`);
							if (upserts.has(key)) throw new Error(`conversation group "${key}" cannot be upserted and removed together`);
							removes.add(key);
						}
						break;
					/* v8 ignore next 2 -- closed update union; TypeScript rejects other operation tags. */
					default: assertNever$1(update.groups);
				}
				return {
					upserts,
					removes
				};
			}
		};
		//#endregion
		//#region lib/types/client/conversation/location-index.js
		var MutableLocationDataSource = class {
			store;
			key;
			listeners = /* @__PURE__ */ new Set();
			published;
			constructor(store, key) {
				this.store = store;
				this.key = key;
				this.published = store.get(key);
			}
			getSnapshot = () => this.store.get(this.key);
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			publish() {
				const next = this.getSnapshot();
				if (this.published === next) return;
				this.published = next;
				(0, _deepseek_ai_dsh_client_store.notifySubscribers)(this.listeners, `[ui-conversation] Location data ${this.key}`);
			}
		};
		var MutableLocationDataStore = class {
			markDirty;
			entries = /* @__PURE__ */ new Map();
			sources = /* @__PURE__ */ new Map();
			dirtyKeys = /* @__PURE__ */ new Set();
			constructor(markDirty) {
				this.markDirty = markDirty;
			}
			get(key) {
				return this.entries.get(key)?.value;
			}
			source(key) {
				let source = this.sources.get(key);
				if (source === void 0) {
					source = new MutableLocationDataSource(this, key);
					this.sources.set(key, source);
				}
				return source;
			}
			remove(owner, key) {
				if (this.entries.get(key)?.owner !== owner) return false;
				this.entries.delete(key);
				this.changed(key);
				return true;
			}
			set(owner, key, value) {
				const current = this.entries.get(key);
				if (current !== void 0 && current.owner !== owner) throw new Error(`conversation Location data "${key}" is already owned by ${current.owner}`);
				if (current?.value === value) return false;
				this.entries.set(key, {
					owner,
					value
				});
				this.changed(key);
				return true;
			}
			replace(entries) {
				const changedKeys = [];
				for (const key of new Set([...this.entries.keys(), ...entries.keys()])) {
					const current = this.entries.get(key);
					const next = entries.get(key);
					if (current?.owner !== next?.owner || current?.value !== next?.value) changedKeys.push(key);
				}
				if (changedKeys.length === 0) return false;
				this.entries = new Map(entries);
				for (const key of changedKeys) this.changed(key);
				return true;
			}
			publish() {
				const dirty = [...this.dirtyKeys];
				this.dirtyKeys.clear();
				for (const key of dirty) this.sources.get(key)?.publish();
			}
			changed(key) {
				this.dirtyKeys.add(key);
				this.markDirty(this);
			}
		};
		const SESSION_LOCATION = { kind: "session" };
		const UNRESOLVED_LOCATION = { kind: "unresolved" };
export {};
