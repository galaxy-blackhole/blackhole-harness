/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				for (const entry of entries.values()) if (entry.current !== void 0) this.releaseUrl(entry.current);
				entries.clear();
			}
			releaseUrl(url) {
				if (!this.urls.delete(url)) return;
				revokeUrl(url);
			}
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				for (const dispose of [...this.scopeDisposers.values]) dispose();
				this.scopeDisposers.clear();
				for (const url of this.urls) revokeUrl(url);
				this.urls.clear();
				for (const entries of this.entries.values) entries.clear();
				this.entries.clear();
			}
		};
		function revokeUrl(url) {
			if (url.startsWith("blob:")) URL.revokeObjectURL(url);
		}
		//#endregion
		//#region lib/types/client/conversation/view-registry.js
		/** Runtime registry of per-target Conversation snapshot builders. */
		var ConversationViewRegistry = class extends ConversationDefinitionRegistry {
			/**
			* Register a uniquely named view builder factory for the caller's lifetime.
			* @param definition - target builder contribution.
			* @returns idempotent disposer.
			*/
			register(definition) {
				return this.registerDefinition(definition.target, definition, `conversation view target "${definition.target}" is already registered`, `uiConversation.views.register(${JSON.stringify(definition.target)})`);
			}
		};
		//#endregion
		//#region lib/types/client/conversation/group-registry.js
		/** One Group Definition per target; registration never instantiates its Builder. */
		var ConversationGroupRegistry = class extends ConversationDefinitionRegistry {
			views;
			/**
			* @param ctx - owning plugin context.
			* @param views - registered target Builder definitions.
			*/
			constructor(ctx, views) {
				super(ctx);
				this.views = views;
			}
			/**
			* Register grouping rules for an existing target.
			* @param definition - business State and grouping output for the declared target data.
			* @returns the effect-owned, idempotent registration disposer.
			*/
			register(definition) {
				if (!this.views.entries().some((view) => view.target === definition.target)) throw new Error(`conversation group target "${definition.target}" is not registered`);
				return this.registerDefinition(definition.target, definition, `conversation group target "${definition.target}" is already registered`, `uiConversation.groups.register(${JSON.stringify(definition.target)})`);
			}
			/**
			* Find the grouping rules registered for one target.
			* @param target - View target.
			* @returns its grouping Definition, when registered.
			*/
			forTarget(target) {
				return this.definitions.get(target);
			}
		};
		//#endregion
		//#region lib/types/client/conversation/user-text-document.js
		var UserTextTransformError = class extends Error {
			ruleId;
			constructor(ruleId, cause) {
				super(`user-text rule "${ruleId}" failed to evaluate`, { cause });
				this.ruleId = ruleId;
				this.name = "UserTextTransformError";
			}
		};
		/** Data-layer cache owned by one caller; initialization and refresh share one reconciliation. */
		var UserTextDocument = class {
			text;
			rules;
			initial = [];
			output = [];
			matchers = /* @__PURE__ */ new Map();
			complete = false;
			evaluating = false;
			/**
			* Reconcile original text using current rule definitions and valid query records.
			* @param input - original text and readonly Facts, compared by fields actually read.
			* @param rules - unique definitions ordered by ascending order and stable ID.
			* @returns complete readonly nodes; failures retain caches but publish no partial result.
			*/
			evaluate(input, rules) {
				if (this.evaluating) throw new Error("user-text document evaluation cannot be reentrant");
				this.evaluating = true;
				try {
					const { changed, matchers } = this.prepare(input, rules);
					if (!changed && this.complete) return this.output;
					this.complete = false;
					this.output = alignNodes(this.reconcile(input, matchers), this.output, this.initial);
					this.complete = true;
					return this.output;
				} finally {
					this.evaluating = false;
				}
			}
			prepare(input, rules) {
				let changed = this.rules !== rules;
				if (this.text !== input.text) {
					changed = true;
					this.text = input.text;
					this.matchers.clear();
					this.initial = input.text.length === 0 ? [] : [textNode(input.text, 0, input.text.length)];
					this.output = this.initial;
				}
				const ids = new Set(rules.map((rule) => rule.id));
				const matchers = [];
				for (const definition of rules) {
					let matcher = this.matchers.get(definition.id);
					if (matcher === void 0 || matcher.definition !== definition || factsChanged(matcher.reads, input)) {
						matcher = {
							definition,
							queries: [],
							reads: /* @__PURE__ */ new Map()
						};
						this.matchers.set(definition.id, matcher);
						changed = true;
					}
					matchers.push(matcher);
				}
				for (const id of this.matchers.keys()) if (!ids.has(id)) this.matchers.delete(id);
				this.rules = rules;
				return {
					changed,
					matchers
				};
			}
			reconcile(input, matchers) {
				const traversals = matchers.map((matcher) => ({
					matcher,
					added: [],
					index: -1,
					head: void 0
				}));
				const nodes = [];
				let cursor = 0;
				try {
					while (true) {
						let winner;
						for (const traversal of traversals) {
							const node = nextCandidate(traversal, input, cursor);
							if (node !== void 0 && (winner === void 0 || node.start < winner.start)) winner = node;
						}
						if (winner === void 0) {
							if (cursor < input.text.length) nodes.push(textNode(input.text, cursor, input.text.length));
							return nodes;
						}
						if (cursor < winner.start) nodes.push(textNode(input.text, cursor, winner.start));
						nodes.push(winner);
						cursor = winner.end;
					}
				} finally {
					for (const { matcher, added } of traversals) if (added.length > 0) matcher.queries = mergeQueries(matcher.queries, added);
				}
			}
		};
		function factsChanged(reads, input) {
			for (const [key, value] of reads) if (!Object.is(value, input.facts[key])) return true;
			return false;
		}
		function withFacts(input, reads, run) {
			let active = true;
			try {
				return run({ read: (key) => {
					if (!active) throw new Error("user-text transform context is closed; read is synchronous only");
					const value = input.facts[key];
					reads.set(key, value);
					return value;
				} });
			} finally {
				active = false;
			}
		}
		function nextCandidate(traversal, input, cursor) {
			const { matcher } = traversal;
			if (traversal.head === void 0 || traversal.head.node !== void 0 && traversal.head.node.start < cursor) {
				let next = matcher.queries[traversal.index + 1];
				while (next !== void 0 && next.from <= cursor) {
					traversal.index++;
					next = matcher.queries[traversal.index + 1];
				}
				const recorded = matcher.queries[traversal.index];
				if (recorded !== void 0 && (recorded.error !== void 0 ? recorded.from === cursor : recorded.node === void 0 || recorded.node.start >= cursor)) traversal.head = recorded;
				else {
					let node;
					let error;
					try {
						node = withFacts(input, matcher.reads, (context) => matcher.definition.match(input.text, cursor, context));
						if (node !== void 0) validateCandidate(input.text, matcher.definition.id, cursor, node);
					} catch (cause) {
						error = new UserTextTransformError(matcher.definition.id, cause);
					}
					traversal.head = {
						from: cursor,
						node,
						error
					};
					traversal.added.push(traversal.head);
				}
			}
			if (traversal.head.error !== void 0) throw traversal.head.error;
			return traversal.head.node;
		}
		function validateCandidate(text, ruleId, from, node) {
			if (!Number.isInteger(node.start) || !Number.isInteger(node.end) || node.start < from || node.end <= node.start || node.end > text.length) throw new Error(`invalid candidate range [${node.start}, ${node.end}); expected a nonempty range from ${from} to ${text.length}`);
			if (node.id === "text") {
				if (node.data.text !== text.slice(node.start, node.end)) throw new Error("text candidate must preserve its original substring");
			} else if (node.id !== ruleId) throw new Error(`candidate must use rule ID "${ruleId}" or text`);
		}
		function mergeQueries(previous, added) {
			if (previous.length === 0) return added;
			const merged = [];
			const remaining = previous.values();
			let old = remaining.next().value;
			for (const query of added) {
				while (old !== void 0 && old.from < query.from) {
					merged.push(old);
					old = remaining.next().value;
				}
				merged.push(query);
			}
			while (old !== void 0) {
				merged.push(old);
				old = remaining.next().value;
			}
			return merged;
		}
		function textNode(text, start, end) {
			return {
				id: "text",
				start,
				end,
				data: { text: text.slice(start, end) }
			};
		}
		function alignNodes(output, previous, input) {
			let previousIndex = 0;
			let inputIndex = 0;
			let aligned;
			for (const [index, node] of output.entries()) {
				let inputNode = input[inputIndex];
				while (inputNode && inputNode.start < node.start) inputNode = input[++inputIndex];
				let previousNode = previous[previousIndex];
				while (previousNode && previousNode.start < node.start) previousNode = previous[++previousIndex];
				const reused = inputNode && equalNode(node, inputNode) ? inputNode : previousNode && equalNode(node, previousNode) ? previousNode : node;
				if (reused !== node && !aligned) aligned = output.slice(0, index);
				aligned?.push(reused);
			}
			const nodes = aligned ?? output;
			if (equalElements(nodes, previous)) return previous;
			return equalElements(nodes, input) ? input : nodes;
		}
		function equalElements(left, right) {
			return left === right || left.length === right.length && left.every((node, index) => node === right[index]);
		}
		function equalNode(left, right) {
			return Object.is(left, right) || left.id === right.id && left.start === right.start && left.end === right.end && equalJson(left.data, right.data);
		}
		function equalJson(left, right) {
			if (Object.is(left, right)) return true;
			if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
			if (Array.isArray(left) !== Array.isArray(right)) return false;
			const keys = Object.keys(left);
			if (keys.length !== Object.keys(right).length) return false;
			return keys.every((key) => Object.hasOwn(right, key) && equalJson(Reflect.get(left, key), Reflect.get(right, key)));
		}
		//#endregion
		//#region lib/types/client/conversation/user-text-registry.js
		/** Observable rule revision with no retained documents or document subscriptions. */
		var UserTextRegistry = class extends ConversationDefinitionRegistry {
			rules = [];
			revision = 0;
			/**
			* Register a uniquely named rule; invalid IDs, duplicate IDs and non-finite order throw before publication.
			* @param rule - readonly synchronous candidate matcher with a nonempty ID other than the reserved `text` ID.
			* @returns idempotent disposer; removal synchronously publishes a new revision.
			*/
			register(rule) {
				if (rule.id.length === 0) throw new Error("user-text rule ID must not be empty");
				if (rule.id === "text") throw new Error("user-text rule \"text\" is reserved for original text");
				if (!Number.isFinite(rule.order)) throw new Error(`user-text rule "${rule.id}" order must be finite`);
				return this.registerDefinition(rule.id, rule, `user-text rule "${rule.id}" is already registered`, `uiConversation.userText.register(${JSON.stringify(rule.id)})`);
			}
			/**
			* Create an independent document evaluator; it reads current rules at each call and never subscribes.
			* @returns callback owning its document cache, released when the caller releases the callback.
			*/
			createEvaluator() {
				const document = new UserTextDocument();
				return (input) => document.evaluate(input, this.rules);
			}
			/**
			* Read the observable rule revision.
			* @returns monotonic revision, stable until a successful registration or disposal.
			*/
			getSnapshot() {
				return this.revision;
			}
			refresh() {
				this.rules = [...this.definitions.values()].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
				this.revision++;
				super.refresh();
			}
		};
		//#endregion
		//#region lib/types/client/conversation/assembly.js
		/** Per-Session target-neutral Conversation assembly. */
		var BoundConversation = class {
			assembler;
			snapshot;
			openTurn;
			viewStore;
			targetSources = /* @__PURE__ */ new Map();
			revision = -1;
			frame;
			disposeFeed = () => {};
			constructor(feed, assembler) {
				this.assembler = assembler;
				this.viewStore = assembler;
				this.snapshot = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(this.currentSnapshot());
				this.openTurn = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(assembler.openTurn());
				this.replace(feed.getSnapshot());
				this.disposeFeed = feed.subscribe(() => {
					this.accept(feed.getSnapshot());
				});
			}
			target(target) {
				let source = this.targetSources.get(target);
				if (source === void 0) {
					const views = this.viewStore;
					source = {
						getSnapshot: () => views.get(target),
						subscribe: (listener) => {
							const unsubscribe = this.snapshot.subscribe(listener);
							this.activate(target);
							return unsubscribe;
						}
					};
					this.targetSources.set(target, source);
				}
				return source;
			}
			activate(target) {
				if (this.assembler.activateTarget(target)) this.snapshot.set(this.currentSnapshot());
				this.openTurn.set(this.assembler.openTurn());
			}
			rebuild() {
				this.publish(this.assembler.rebuildRegistry());
			}
			dispose() {
				this.cancelFrame();
				this.disposeFeed();
			}
			replace(window) {
				this.revision = window.revision;
				this.publish(this.assembler.replaceWindow(window.entries, window.hasMore));
			}
			accept(window) {
				if (window.revision === this.revision) return;
				if (window.revision !== this.revision + 1 || window.change.kind === "replace") {
					this.replace(window);
					return;
				}
				this.revision = window.revision;
				switch (window.change.kind) {
					case "prepend":
						this.publish(this.assembler.prepend(window.change.entries, window.hasMore));
						return;
					case "append": {
						let publication = "none";
						for (const event of window.change.entries) {
							const next = this.assembler.append(event);
							if (next === "immediate" || publication === "none") publication = next;
						}
						this.publish(publication);
						return;
					}
					case "settle-assistant":
						this.publish(this.assembler.settleAssistant(window.change.attemptId, window.change.entry));
						return;
				}
			}
			publish(publication) {
				if (publication === "none") return;
				if (publication === "animation-frame" && typeof requestAnimationFrame === "function") {
					if (this.frame !== void 0) return;
					this.frame = requestAnimationFrame(() => {
						this.frame = requestAnimationFrame(() => {
							this.frame = requestAnimationFrame(() => {
								this.frame = void 0;
								this.flush();
							});
export {};
