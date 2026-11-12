/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				const definitions = this.matchedDefinitions;
				const results = this.matchedResults;
				definitions.length = 0;
				results.length = 0;
				const routes = this.eventDefinitions.forEvent?.(event.type);
				if (routes === void 0) for (const definition of this.eventDefinitions.entries()) {
					const result = definition.match(event);
					if (result === null) continue;
					definitions.push(definition);
					results.push(result);
				}
				else for (const { definition, match } of routes) {
					const result = match(event);
					if (result === null) continue;
					definitions.push(definition);
					results.push(result);
				}
				let claims;
				for (let index = 0; index < results.length; index++) {
					if (results[index].exclusive !== true) continue;
					const definition = definitions[index];
					const target = definition.target;
					if (target === void 0) throw new Error(`conversation Definition "${definition.kind}" claims ${event.type} at seq ${String(event.seq)} without a target`);
					const claimant = claims?.get(target);
					if (claimant !== void 0) throw new Error(`conversation Definitions "${claimant}" and "${definition.kind}" both claim ${event.type} at seq ${String(event.seq)} on target "${target}"`);
					(claims ??= /* @__PURE__ */ new Map()).set(target, definition.kind);
				}
				let firstTarget;
				let secondTarget;
				let otherTargets;
				let publication = "none";
				for (let index = 0; index < results.length; index++) {
					const definition = definitions[index];
					const result = results[index];
					const target = definition.target;
					if (target !== void 0 && result.exclusive !== true && claims?.has(target) === true) continue;
					if (target !== void 0 && target !== firstTarget && target !== secondTarget) if (firstTarget === void 0) firstTarget = target;
					else if (secondTarget === void 0) secondTarget = target;
					else (otherTargets ??= /* @__PURE__ */ new Set()).add(target);
					publication = maximumPublication(publication, accept.call(this, definition, result.id, matchFor(result.role)));
				}
				const fallback = this.eventDefinitions.fallbackEntry();
				const target = fallback?.target;
				if (fallback !== void 0 && target !== void 0 && target !== firstTarget && target !== secondTarget && otherTargets?.has(target) !== true) {
					const result = fallback.match(event);
					if (result !== null) publication = maximumPublication(publication, accept.call(this, fallback, result.id, matchFor(result.role)));
				}
				return publication;
			}
			createContext(definition, id, key) {
				const context = {
					key,
					kind: definition.kind,
					id,
					definition,
					startSeq: void 0,
					start: void 0,
					matches: [],
					state: void 0,
					revision: 0,
					current: /* @__PURE__ */ new Map(),
					locationData: emptyLocationData(),
					dependencies: /* @__PURE__ */ new Map()
				};
				this.contexts.set(key, context);
				this.indexTargetContext(context);
				return context;
			}
			acceptMatch(definition, id, match) {
				const latest = this.contextsByKind.get(definition.kind)?.at(-1);
				const key = latest?.id === id ? latest.key : conversationContextKey(definition.kind, id);
				let context = this.contexts.get(key);
				context ??= this.createContext(definition, id, key);
				const starting = match.role === "start" && context.start === void 0;
				const previous = context.matches.at(-1);
				if (previous !== void 0 && previous.event.seq >= match.event.seq) throw new Error(`conversation Context ${key} received non-appended Match ${match.event.seq}`);
				if (starting && context.matches.length > 0) throw new Error(`conversation Context ${key} received an update before its start Match`);
				context.matches.push(match);
				if (starting) {
					context.startSeq = match.event.seq;
					context.start = match;
					this.indexStartedContext(context);
				}
				let owners = this.contextsBySeq.get(match.event.seq);
				if (owners === void 0) {
					owners = [];
					this.contextsBySeq.set(match.event.seq, owners);
				}
				owners.push(context);
				if (starting) this.replayContext(context);
				else if (context.state !== void 0) {
					const typed = contextSnapshot(context);
					context.state = requireState(definition, "update", definition.update(typed, match));
					context.revision++;
					this.revised.add(context);
				}
				this.markDirty(context);
				return definition.publication?.(match) ?? "immediate";
			}
			applyPendingMatches(pending, affected) {
				for (const [key, entries] of pending) {
					const first = entries[0];
					if (first === void 0) continue;
					let context = this.contexts.get(key);
					context ??= this.createContext(first.definition, first.id, key);
					const additions = entries.map((entry) => {
						if (entry.definition !== context.definition || entry.id !== context.id) throw new Error(`conversation Context ${key} received inconsistent Definition identity`);
						let owners = this.contextsBySeq.get(entry.match.event.seq);
						if (owners === void 0) {
							owners = [];
							this.contextsBySeq.set(entry.match.event.seq, owners);
						}
						owners.push(context);
						return entry.match;
					}).sort((left, right) => left.event.seq - right.event.seq);
					context.matches = mergeMatches(context.key, additions, context.matches);
					affected.add(context);
					this.markDirty(context);
				}
			}
			replayContexts(contexts) {
				this.refreshStarts(contexts);
				const ordered = [...contexts].sort((left, right) => (left.startSeq ?? Number.POSITIVE_INFINITY) - (right.startSeq ?? Number.POSITIVE_INFINITY));
				for (const context of ordered) {
					if (context.start === void 0) {
						context.state = void 0;
						this.replaceDependencies(context, /* @__PURE__ */ new Map());
						context.revision++;
						this.revised.add(context);
						this.markDirty(context);
						continue;
					}
					this.replayContext(context);
				}
			}
			refreshStarts(contexts) {
				const changed = /* @__PURE__ */ new Set();
				const startsByKind = /* @__PURE__ */ new Map();
				for (const context of contexts) {
					const start = context.matches.find((match) => match.role === "start");
					if (start === context.start) continue;
					context.start = start;
					context.startSeq = start?.event.seq;
					changed.add(context);
					const starts = startsByKind.get(context.kind) ?? [];
					if (start !== void 0) starts.push(context);
					startsByKind.set(context.kind, starts);
				}
				for (const [kind, starts] of startsByKind) {
					const existing = this.contextsByKind.get(kind) ?? [];
					this.contextsByKind.set(kind, existing.filter((context) => !changed.has(context)));
					this.indexStartedContexts(kind, starts);
				}
			}
			replayContext(context) {
				const start = context.start;
				if (start === void 0) {
					context.state = void 0;
					return;
				}
				if (context.matches[0] !== start) throw new Error(`conversation Context ${context.key} received an update before its start Match`);
				const dependencies = /* @__PURE__ */ new Map();
				const reader = this.readerFor(start.event.seq, dependencies);
				context.state = void 0;
				context.state = requireState(context.definition, "start", context.definition.start(contextSnapshot(context), start, reader));
				this.replaceDependencies(context, dependencies);
				for (let index = 1; index < context.matches.length; index++) {
					const match = context.matches[index];
					if (match === void 0) continue;
					const typed = contextSnapshot(context);
					context.state = requireState(context.definition, "update", context.definition.update(typed, match));
				}
				context.revision++;
				this.revised.add(context);
				this.markDirty(context);
			}
			indexTargetContext(context) {
				const target = context.definition.target;
				if (target === void 0) return;
				const contexts = this.contextsByTarget.get(target) ?? /* @__PURE__ */ new Set();
				contexts.add(context);
				this.contextsByTarget.set(target, contexts);
			}
			markDirty(context) {
				if (this.dirty.has(context)) return;
				this.dirty.add(context);
				const target = context.definition.target;
				if (target === void 0 || !this.activeTargets.has(target)) return;
				let contexts = this.dirtyByTarget.get(target);
				if (contexts === void 0) {
					contexts = /* @__PURE__ */ new Set();
					this.dirtyByTarget.set(target, contexts);
				}
				contexts.add(context);
			}
			replaceDependencies(context, dependencies) {
				for (const dependency of context.dependencies.values()) {
					if (dependency.key === void 0) continue;
					const current = this.dependents.get(dependency.key);
					current?.delete(context);
					if (current?.size === 0) this.dependents.delete(dependency.key);
				}
				context.dependencies = dependencies;
				for (const dependency of dependencies.values()) {
					if (dependency.key === void 0) continue;
					const current = this.dependents.get(dependency.key) ?? /* @__PURE__ */ new Set();
					current.add(context);
					this.dependents.set(dependency.key, current);
				}
			}
			replayRevisedDependents() {
				if (this.dependents.size === 0) return false;
				const pending = [...this.revised];
				const affected = /* @__PURE__ */ new Set();
				for (let index = 0; index < pending.length; index++) {
					const dependency = pending[index];
					if (dependency === void 0) continue;
					for (const dependent of this.dependents.get(dependency.key) ?? []) {
						if (affected.has(dependent)) continue;
						affected.add(dependent);
						pending.push(dependent);
					}
				}
				if (affected.size > 0) this.replayContexts(affected);
				return affected.size > 0;
			}
			readerFor(beforeSeq, dependencies) {
				return { previous: (kind) => {
					const predecessor = this.previousContext(kind, beforeSeq);
					dependencies.set(kind, {
						kind,
						key: predecessor?.key,
						revision: predecessor?.revision,
						windowGap: predecessor === void 0 && this.hasMore
					});
					if (predecessor?.state === void 0) return void 0;
					const seq = startSeq(predecessor);
					if (seq === void 0) return void 0;
					return {
						key: predecessor.key,
						kind: predecessor.kind,
						id: predecessor.id,
						startSeq: seq,
						state: predecessor.state,
						matches: predecessor.matches
					};
				} };
			}
			previousContext(kind, beforeSeq) {
				const candidates = this.contextsByKind.get(kind) ?? [];
				const indexBefore = insertionIndex(candidates, beforeSeq);
				for (let index = indexBefore - 1; index >= 0; index--) {
					const candidate = candidates[index];
					if (candidate?.state !== void 0) return candidate;
				}
			}
			/** Insert one newly discovered start into its Definition's ordered predecessor index. */
			indexStartedContext(context) {
				const seq = context.startSeq;
				if (seq === void 0) return;
				const candidates = this.contextsByKind.get(context.kind) ?? [];
				const previous = candidates.at(-1);
				if (previous === void 0 || previous.startSeq < seq) candidates.push(context);
				else candidates.splice(insertionIndex(candidates, seq), 0, context);
				this.contextsByKind.set(context.kind, candidates);
			}
			indexStartedContexts(kind, additions) {
				if (additions.length === 0) return;
				const sorted = [...additions].sort((left, right) => left.startSeq - right.startSeq);
				const existing = this.contextsByKind.get(kind) ?? [];
				const merged = [];
				let before = 0;
				let added = 0;
				while (before < existing.length || added < sorted.length) {
					const left = existing[before];
					const right = sorted[added];
					if (right === void 0 || left !== void 0 && left.startSeq < right.startSeq) {
						merged.push(left);
						before++;
					} else {
						merged.push(right);
						added++;
					}
				}
				this.contextsByKind.set(kind, merged);
			}
			replayDependencies() {
				let replayed = false;
				const ordered = [...this.contexts.values()].filter((context) => startSeq(context) !== void 0).sort((left, right) => startSeq(left) - startSeq(right));
				for (const context of ordered) {
					if (context.state === void 0 || context.dependencies.size === 0) continue;
					const before = startSeq(context);
					if (before === void 0) continue;
					let changed = false;
					for (const dependency of context.dependencies.values()) {
						const current = this.previousContext(dependency.kind, before);
						const windowGap = current === void 0 && this.hasMore;
						if (current?.key !== dependency.key || current?.revision !== dependency.revision || windowGap !== dependency.windowGap) {
							changed = true;
							break;
						}
					}
					if (changed) {
						this.replayContext(context);
						replayed = true;
					}
				}
				return replayed;
			}
			refreshMatchLocations(changedSeqs) {
				const affected = /* @__PURE__ */ new Set();
				if (changedSeqs.size === 0) return affected;
				for (const seq of changedSeqs) for (const context of this.contextsBySeq.get(seq) ?? []) affected.add(context);
				for (const context of affected) {
					let start = context.start;
					context.matches = context.matches.map((match) => {
						if (!changedSeqs.has(match.event.seq)) return match;
						if (match.role === "start") {
							const refreshed = {
								...match,
								location: this.locationIndex.locationOf(match.event)
							};
							if (match === start) start = refreshed;
							return refreshed;
						}
						return {
							...match,
							location: this.locationIndex.locationOf(match.event)
						};
					});
					context.start = start;
				}
				return affected;
			}
			buildNode(context, target) {
				if (context.definition.target !== target || context.definition.buildViewNode === void 0) return null;
				const node = context.definition.buildViewNode(contextSnapshot(context));
				if (node === null) return null;
				if (node.key !== context.key) throw new Error(`conversation Definition "${context.kind}" returned unstable key "${node.key}"; expected "${context.key}"`);
				if (node.target !== target) throw new Error(`conversation Definition "${context.kind}" returned target "${node.target}" while building "${target}"`);
				return node;
			}
			replaceView(view) {
				this.updateView(view, true, this.buildTargetNodes(view.target, this.contextsByTarget.get(view.target)), []);
			}
			updateView(view, replacing, nodes, changedTurns) {
				const builder = view.builder ?? view.definition.create();
				const definition = view.groupDefinition;
				if (definition !== void 0 && builder.groupInput === void 0) throw new Error(`conversation group target "${view.target}" requires builder.groupInput()`);
				view.builder = builder;
				const timeline = this.locationIndex.snapshot();
				const snapshot = replacing ? builder.replace({
					nodes,
					timeline,
					changedTurns
				}) : builder.apply({
					upserts: nodes,
					timeline,
					changedTurns
				});
				if (definition !== void 0 && builder.groupInput !== void 0) {
					let context = this.groups.get(view.target);
					const initial = context === void 0;
					if (context === void 0) context = {
						definition,
						state: definition.create(),
						store: new ConversationGroupStore()
					};
					const input = builder.groupInput();
					context.state = definition.update(context, input);
					const change = definition.buildGroups(context);
					if ((initial || input.kind === "replace") && (change === null || change.entries === void 0 || change.groups.kind !== "replace")) throw new Error(`conversation group target "${view.target}" requires complete grouping for replacement input`);
					if (change !== null) {
						context.store.prepareAndInstall(change, input.readNode);
						this.pendingGroupStores.add(context.store);
					}
					this.groups.set(view.target, context);
				}
				view.snapshot = snapshot;
			}
			publishViews(updated) {
				const changed = updated.length > 0 || this.pendingGroupStores.size > 0;
				const stores = [...this.pendingGroupStores];
				this.pendingGroupStores.clear();
				for (const view of updated) view.builder?.publish?.();
				for (const store of stores) store.publish();
				this.locationIndex.publishData();
				return changed;
			}
			buildTargetNodes(target, contexts) {
				const nodes = [];
				for (const context of contexts ?? []) {
					const node = this.buildNode(context, target);
					context.current.set(target, node);
					if (node !== null) nodes.push(node);
				}
				return nodes;
			}
			buildTargetUpserts(target, contexts) {
				const upserts = [];
export {};
