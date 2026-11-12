/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				for (const context of contexts ?? []) {
					const previous = context.current.get(target) ?? null;
					const node = this.buildNode(context, target);
					if (node === null && previous !== null) throw new Error(`conversation Definition "${context.kind}" withdrew materialized target "${target}"; return the same key with hidden visibility instead`);
					context.current.set(target, node);
					if (node !== null) upserts.push(node);
				}
				return upserts;
			}
			buildLocationData(context, scope, previous) {
				if (context.definition.buildLocationData === void 0) return null;
				const data = context.definition.buildLocationData(contextSnapshot(context), scope, previous);
				if (data === null) return null;
				if (data.kind !== scope) throw new Error(`conversation Definition "${context.kind}" published ${data.kind} data through its ${scope} scope`);
				if (data.key !== context.kind) throw new Error(`conversation Definition "${context.kind}" published Location data key "${data.key}"; expected its owned kind`);
				if (!Number.isSafeInteger(data.turn) || data.turn < 0) throw new Error(`conversation Definition "${context.kind}" published invalid turn ${data.turn}`);
				if (data.kind === "step" && (!Number.isSafeInteger(data.step) || data.step < 0)) throw new Error(`conversation Definition "${context.kind}" published invalid step ${String(data.step)}`);
				return data;
			}
			replaceLocationData() {
				const entries = [];
				for (const scope of LOCATION_DATA_SCOPES) {
					for (const context of this.contexts.values()) {
						const data = this.buildLocationData(context, scope, context.locationData[scope]);
						context.locationData[scope] = data;
						if (data !== null) entries.push({
							owner: context.key,
							data
						});
					}
					this.locationIndex.replaceData(entries);
				}
			}
			applyDirtyLocationData() {
				let changed = false;
				for (const scope of LOCATION_DATA_SCOPES) {
					const changes = [];
					for (const context of this.dirty) {
						const previous = context.locationData[scope];
						const next = this.buildLocationData(context, scope, previous);
						if (previous === next) continue;
						context.locationData[scope] = next;
						changes.push({
							owner: context.key,
							previous,
							next
						});
					}
					changed = this.locationIndex.applyData(changes) || changed;
				}
				return changed;
			}
			resetViewBuilders() {
				const definitions = this.viewDefinitions.entries();
				const targets = new Set(definitions.map((definition) => definition.target));
				for (const [target, group] of this.groups) if (!targets.has(target) || this.groupDefinitions.forTarget(target) !== group.definition) {
					group.store.clear();
					this.pendingGroupStores.add(group.store);
					this.groups.delete(target);
				}
				this.views.clear();
				for (const definition of definitions) {
					const view = {
						target: definition.target,
						definition,
						groupDefinition: this.groupDefinitions.forTarget(definition.target),
						isActive: definition.isActive === void 0 ? void 0 : (snapshot) => definition.isActive?.(snapshot) === true,
						builder: void 0,
						snapshot: void 0
					};
					this.views.set(definition.target, view);
				}
				this.replacePending = true;
			}
		};
		function isLocationBoundary(type) {
			return type === "turn/start" || type === "turn/end" || type === "step/start" || type === "step/end";
		}
		function requireState(definition, phase, state) {
			if (state === void 0) throw new Error(`conversation Definition "${definition.kind}" returned undefined from ${phase}()`);
			return state;
		}
		//#endregion
		//#region lib/types/client/conversation/definition-registry.js
		/** Shared lifecycle and stable-entry storage for one Conversation Definition registry. */
		var ConversationDefinitionRegistry = class {
			ctx;
			definitions = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			cached = [];
			/** @param ctx - Context whose effects own contributed Definitions. */
			constructor(ctx) {
				this.ctx = ctx;
				Object.defineProperty(this, _deepseek_ai_cordis.Service.tracker, { value: { property: "ctx" } });
			}
			/**
			* Return reference-stable Definitions in registration order.
			* @returns current Definitions.
			*/
			entries() {
				return this.cached;
			}
			/**
			* Observe low-frequency registry changes.
			* @param listener - synchronous invalidation callback.
			* @returns unsubscribe callback.
			*/
			subscribe(listener) {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			}
			/**
			* Register one uniquely keyed Definition for the caller's lifetime.
			* @param key - registry-local unique key.
			* @param definition - contributed Definition.
			* @param duplicateMessage - error raised when the key is already owned.
			* @param effectName - Cordis effect diagnostic label.
			* @returns idempotent disposer.
			*/
			registerDefinition(key, definition, duplicateMessage, effectName) {
				if (this.definitions.has(key)) throw new Error(duplicateMessage);
				const dispose = this.ctx.effect(() => {
					this.definitions.set(key, definition);
					this.refresh();
					return () => {
						if (this.definitions.get(key) !== definition) return;
						this.definitions.delete(key);
						this.refresh();
					};
				}, effectName);
				return () => {
					dispose();
				};
			}
			/** Refresh cached entries and synchronously invalidate subscribers. */
			refresh() {
				this.cached = [...this.definitions.values()];
				(0, _deepseek_ai_dsh_client_store.notifySubscribers)(this.listeners, "[ui-conversation] definition registry");
			}
		};
		//#endregion
		//#region lib/types/client/conversation/event-registry.js
		/** Runtime registry of independently owned Conversation business Definitions. */
		var ConversationEventRegistry = class extends ConversationDefinitionRegistry {
			fallback;
			routes = /* @__PURE__ */ new Map();
			unrestricted = /* @__PURE__ */ new Set();
			tables = /* @__PURE__ */ new WeakMap();
			/**
			* Register a uniquely named business Definition for the caller's lifetime.
			* @param definition - Definition contribution.
			* @returns idempotent disposer.
			*/
			register(definition) {
				assertDefinitionTarget(definition);
				return this.registerDefinition(definition.kind, this.resolve(definition), `conversation Definition "${definition.kind}" is already registered`, `uiConversation.events.register(${JSON.stringify(definition.kind)})`);
			}
			/**
			* Register the sole fallback used only when no ordinary Definition matches.
			* @param input - fallback Definition.
			* @returns idempotent disposer.
			*/
			registerFallback(input) {
				assertDefinitionTarget(input);
				if (input.target === void 0) throw new Error("conversation fallback Definition must declare a target");
				if (this.fallback !== void 0) throw new Error("conversation fallback Definition is already registered");
				const definition = this.resolve(input);
				const dispose = this.ctx.effect(() => {
					this.fallback = definition;
					this.refresh();
					return () => {
						if (this.fallback !== definition) return;
						this.fallback = void 0;
						this.refresh();
					};
				}, `uiConversation.events.registerFallback(${JSON.stringify(definition.kind)})`);
				return () => {
					dispose();
				};
			}
			/**
			* Return the current unmatched-event fallback.
			* @returns installed fallback, when present.
			*/
			fallbackEntry() {
				return this.fallback;
			}
			/**
			* Read precomputed candidates in registration order; the returned Set is borrowed read-only.
			* @param type - current event type.
			* @returns table handlers for this type together with all function-form handlers.
			*/
			forEvent(type) {
				return this.routes.get(type) ?? this.unrestricted;
			}
			resolve(input) {
				if (typeof input.match === "function") return input;
				const table = new Map(Object.entries(input.match));
				const definition = {
					...input,
					match: (event) => table.get(event.type)?.call(definition, event) ?? null
				};
				this.tables.set(definition, table);
				return definition;
			}
			refresh() {
				const routes = /* @__PURE__ */ new Map();
				const unrestricted = /* @__PURE__ */ new Set();
				for (const definition of this.definitions.values()) {
					const table = this.tables.get(definition);
					if (table === void 0) {
						const route = {
							definition,
							match: definition.match.bind(definition)
						};
						unrestricted.add(route);
						for (const candidates of routes.values()) candidates.add(route);
					} else for (const [type, match] of table) {
						let candidates = routes.get(type);
						if (candidates === void 0) {
							candidates = new Set(unrestricted);
							routes.set(type, candidates);
						}
						candidates.add({
							definition,
							match: match.bind(definition)
						});
					}
				}
				this.routes = routes;
				this.unrestricted = unrestricted;
				super.refresh();
			}
		};
		function assertDefinitionTarget(definition) {
			if (definition.target === void 0 !== (definition.buildViewNode === void 0)) throw new Error(`conversation Definition "${definition.kind}" must declare target and buildViewNode together`);
		}
		//#endregion
		//#region ../../util/crypto/lib/index.js
		/**
		* UUID minting that works in every JavaScript context this repository ships
		* to. `crypto.randomUUID` is a secure-context Web API — a page or worker
		* served over plain HTTP on a LAN address has no such method — while
		* `crypto.getRandomValues` is unrestricted everywhere (browsers, workers,
		* Node ≥ 19). One implementation here replaces per-caller polyfills; the
		* `no-restricted-properties` lint rule points `crypto.randomUUID` callers at
		* this module.
		* @module @deepseek-ai/dsh-util-crypto
		*/
		/**
		* Encode bytes as canonical base64 without overflowing function argument limits.
		* @param data - Bytes to encode.
		* @returns base64 text.
		*/
		function bytesToBase64(data) {
			let binary = "";
			const chunk = 32768;
			for (let offset = 0; offset < data.length; offset += chunk) binary += String.fromCharCode(...data.subarray(offset, offset + chunk));
			return btoa(binary);
		}
		/**
		* Random v4 UUID, minted from `crypto.getRandomValues`.
		* @returns the UUID string.
		*/
		function randomUUID() {
			const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
			const hex = Array.from(bytes, (byte, index) => {
				return (index === 6 ? byte & 15 | 64 : index === 8 ? byte & 63 | 128 : byte).toString(16).padStart(2, "0");
			}).join("");
			return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
		}
		//#endregion
		//#region lib/types/client/conversation/historical-images.js
		/** Resolve durable Conversation images and release their browser URLs with Session scope. */
		var HistoricalImageCache = class {
			sessions;
			entries = new WeakMapWithValues();
			scopeDisposers = new WeakMapWithValues();
			urls = /* @__PURE__ */ new Set();
			disposed = false;
			/**
			* @param ctx - Owning ui-conversation fiber.
			* @param sessions - Session Controller object layer.
			*/
			constructor(ctx, sessions) {
				this.sessions = sessions;
				ctx.effect(() => () => {
					this.dispose();
				}, "ui-conversation historical image cache");
			}
			/**
			* Resolve and cache one session-authorized image URL.
			* @param sessionId - Session authorization and lifetime scope.
			* @param attachment - Durable image reference.
			* @returns browser URL valid until the Session binding is released.
			*/
			resolve(sessionId, attachment) {
				if (this.disposed) return Promise.reject(/* @__PURE__ */ new Error("ui-conversation image cache is disposed"));
				const binding = this.sessions.binding(sessionId);
				if (binding === void 0) return Promise.reject(/* @__PURE__ */ new Error(`ui-conversation: unknown session "${sessionId}"`));
				const entries = this.bindScope(binding);
				const key = attachment.attachmentId;
				const cached = entries.get(key);
				if (cached !== void 0) return cached.pending;
				const entry = {
					binding,
					pending: Promise.resolve("")
				};
				entries.set(key, entry);
				entry.pending = this.loadCanonical(key, entry, attachment);
				return entry.pending;
			}
			/**
			* Return an already-displayable URL without starting a read.
			* @param sessionId - Session authorization and lifetime scope.
			* @param attachment - Durable image reference.
			* @returns current preview or canonical URL when cached.
			*/
			peek(sessionId, attachment) {
				const binding = this.sessions.binding(sessionId);
				return binding === void 0 ? void 0 : this.entries.get(binding)?.get(attachment.attachmentId)?.current;
			}
			/**
			* Adopt a submission preview while fetching the durable admitted bytes.
			* The preview is available synchronously, then replaced and revoked when
			* the canonical attachment read completes.
			* @param sessionId - Session authorization and lifetime scope.
			* @param attachment - Durable image reference the URL temporarily displays.
			* @param url - browser URL to adopt.
			* @returns whether the cache took ownership.
			*/
			seed(sessionId, attachment, url) {
				if (this.disposed) return false;
				const binding = this.sessions.binding(sessionId);
				if (binding === void 0) return false;
				const entries = this.bindScope(binding);
				const key = attachment.attachmentId;
				if (entries.has(key)) return false;
				const entry = {
					binding,
					current: url,
					pending: Promise.resolve(url)
				};
				this.urls.add(url);
				entries.set(key, entry);
				entry.pending = this.loadCanonical(key, entry, attachment).catch((error) => {
					if (entries.get(key) === entry && entry.current === url) {
						entries.delete(key);
						this.releaseUrl(url);
					}
					throw error;
				});
				entry.pending.catch(() => {});
				return true;
			}
			loadCanonical(key, entry, attachment) {
				return entry.binding.session.readAttachment(attachment.attachmentId).then((result) => {
					if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
					this.assertLive(key, entry);
					let url;
					if (typeof URL.createObjectURL !== "function") url = `data:${result.value.attachment.mediaType};base64,${bytesToBase64(result.value.data)}`;
					else {
						const bytes = Uint8Array.from(result.value.data);
						url = URL.createObjectURL(new Blob([bytes.buffer], { type: result.value.attachment.mediaType }));
					}
					this.assertLive(key, entry);
					this.urls.add(url);
					const previous = entry.current;
					entry.current = url;
					if (previous !== void 0 && previous !== url) this.releaseUrl(previous);
					return url;
				}).catch((error) => {
					const entries = this.entries.get(entry.binding);
					if (entries?.get(key) === entry && entry.current === void 0) entries.delete(key);
					throw error;
				});
			}
			assertLive(key, entry) {
				if (this.disposed) throw new Error("ui-conversation image cache was disposed before loading completed");
				if (this.entries.get(entry.binding)?.get(key) !== entry) throw new Error("ui-conversation image scope was released before loading completed");
			}
			bindScope(binding) {
				const existing = this.entries.get(binding);
				if (existing !== void 0) return existing;
				const entries = /* @__PURE__ */ new Map();
				this.entries.set(binding, entries);
				const dispose = binding.ctx.effect(() => () => {
					this.scopeDisposers.delete(binding);
					this.release(binding, entries);
				}, "ui-conversation historical image scope");
				const release = () => {
					dispose();
				};
				this.scopeDisposers.set(binding, release);
				return entries;
			}
			release(binding, entries) {
				if (this.entries.get(binding) === entries) this.entries.delete(binding);
export {};
