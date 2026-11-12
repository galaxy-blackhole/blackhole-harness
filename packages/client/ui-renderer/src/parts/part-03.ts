/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				Comp,
				kit,
				standard,
				injected,
				slotInjected,
				ownerProps,
				hookContext,
				hasHookContext
			});
		}
		function SessionEntry({ entry, ownerProps, binding, slotKey, slotInjected, hookContext, hasHookContext }) {
			const host = useHost();
			const rootBinding = useRootBinding();
			const Comp = entry.component;
			const { kit, standard, actions } = standardKit(host, entry, "session", rootBinding, binding);
			return renderEntry(slotKey, Comp, kit, standard, cachedSessionInject(entry, binding, actions), slotInjected, ownerProps, hookContext, hasHookContext);
		}
		function SessionMaybeEntryBody({ entry, ownerProps, binding, slotKey, slotInjected, hookContext, hasHookContext }) {
			const host = useHost();
			const rootBinding = useRootBinding();
			const Comp = entry.component;
			const { kit, standard, actions } = standardKit(host, entry, "session-maybe", rootBinding, binding);
			return renderEntry(slotKey, Comp, kit, standard, cachedSessionMaybeInject(entry, binding, actions), slotInjected, ownerProps, hookContext, hasHookContext);
		}
		/**
		* Session-maybe identity: adoption — the ONLY behavior (there is no
		* hold-identity-forever mode). An incarnation born session-less ADOPTS the
		* first session that arrives: identity holds across that one transition
		* (undefined → first id), so a blank shell's DOM survives the moment a
		* session appears. From then on the entry behaves exactly like a strict
		* session entry: switching to a DIFFERENT session remounts (component-local
		* state must not leak between sessions), and dropping back to no-session
		* remounts into a fresh blank incarnation, which will adopt again.
		* Component-local per-session state therefore clears by construction; state
		* that must SURVIVE a switch belongs in session-bound sources (machine,
		* store, hooks) — the existing layering rule, now load-bearing.
		*/
		function SessionMaybeEntry({ entry, ownerProps, slotKey, slotInjected, hookContext, hasHookContext }) {
			const binding = useScopeBinding();
			const epoch = useMaybeIncarnation(binding);
			return (0, react_jsx_runtime.jsx)(SessionMaybeEntryBody, {
				entry,
				ownerProps,
				binding,
				slotKey,
				slotInjected,
				hookContext,
				hasHookContext
			}, epoch);
		}
		const FIRST_INCARNATION = {
			adopted: void 0,
			epoch: 0
		};
		function useMaybeIncarnation(binding) {
			const identity = binding.key === void 0 ? void 0 : binding.ctx;
			const [state, setState] = (0, react.useState)(FIRST_INCARNATION);
			let { adopted, epoch } = state;
			if (identity !== void 0 && adopted === void 0) {
				adopted = identity;
				setState({
					adopted,
					epoch
				});
			} else if (adopted !== void 0 && identity !== void 0 && identity !== adopted) {
				adopted = identity;
				epoch += 1;
				setState({
					adopted,
					epoch
				});
			} else if (adopted !== void 0 && identity === void 0) {
				adopted = void 0;
				epoch += 1;
				setState({
					adopted,
					epoch
				});
			}
			return epoch;
		}
		function RootEntry({ entry, ownerProps, slotKey, slotInjected, hookContext, hasHookContext }) {
			const host = useHost();
			const rootBinding = useRootBinding();
			const Comp = entry.component;
			const { kit, standard, actions } = standardKit(host, entry, "root", rootBinding, void 0);
			return renderEntry(slotKey, Comp, kit, standard, cachedRootInject(entry, actions), slotInjected, ownerProps, hookContext, hasHookContext);
		}
		const FactoryOccurrenceContext = (0, react.createContext)(null);
		const FactoryAncestryContext = (0, react.createContext)(/* @__PURE__ */ new Set());
		const EMPTY_FACTORY_SELECTION = {};
		function useFactorySlotRuntime(name, fallback) {
			const occurrence = (0, react.useContext)(FactoryOccurrenceContext);
			if (occurrence === null) throw new SlotAssemblyError("useFactorySlot() called outside a Factory occurrence");
			if (!occurrence.host.isFactoryLive(occurrence.definition)) throw new _deepseek_ai_dsh_client_ui_slots.StaleAuthorizationError(`useFactorySlot('${name}') from a disposed Factory`);
			const declared = occurrence.definition.slots?.[name];
			if (declared === void 0) throw new _deepseek_ai_dsh_client_ui_slots.SlotOwnershipError(`local slot '${name}' is not declared by factory '${occurrence.definition.name}'`);
			const selected = occurrence.selected[name];
			const Selected = selected ?? fallback;
			const usesFallback = selected === void 0;
			const { definition, host } = occurrence;
			return (0, react.useMemo)(function bindFactoryLocalComponent() {
				return function BoundFactoryLocalComponent(localProps) {
					const current = (0, react.useContext)(FactoryOccurrenceContext);
					const localScopeBinding = useScopeBinding();
					const localMaybeEpoch = useMaybeIncarnation(localScopeBinding);
					if (!host.isFactoryLive(definition)) throw new _deepseek_ai_dsh_client_ui_slots.StaleAuthorizationError(`local slot '${name}' from a disposed Factory`);
					if (current === null || current.definition !== definition) throw new _deepseek_ai_dsh_client_ui_slots.SlotOwnershipError(`local slot '${name}' rendered outside factory '${definition.name}'`);
					if (declared.scope === "session" && localScopeBinding.key === void 0) throw new SlotAssemblyError(`strict session local slot '${name}' from factory '${definition.name}' rendered without a scope binding`);
					const localOwner = usesFallback ? definition : current.caller;
					const localScopeIdentity = declared.scope === "root" ? "root" : declared.scope === "session" ? `session:${sessionGenerationKeyOf(localScopeBinding)}` : `session-maybe:${localMaybeEpoch}`;
					const localStandard = standardProps(declared.scope, current.rootBinding, localScopeBinding);
					const localRegistrationKit = {
						...current.registrationKit,
						renderFactorySlot: boundRenderFactorySlot(localOwner)
					};
					assertNoPropOverlap(`factory '${definition.name}' local slot '${name}'`, localRegistrationKit, localStandard);
					const provided = {
						...localRegistrationKit,
						...localStandard
					};
					assertNoPropOverlap(`factory '${definition.name}' local slot '${name}'`, provided, localProps);
					return (0, react_jsx_runtime.jsx)(FactoryErrorBoundary, {
						name: `${definition.name}:${name}`,
						onEntryError: (error) => {
							host.reportFactoryError(definition.name, localOwner, error);
						},
						children: (0, react_jsx_runtime.jsx)(Selected, {
							...provided,
							...localProps
						})
					}, `${definition.name}:${name}:${localScopeIdentity}`);
				};
			}, [
				Selected,
				declared.scope,
				definition,
				host,
				name,
				usesFallback
			]);
		}
		function assertNoPropOverlap(owner, provided, received) {
			for (const name of Object.keys(received)) if (Object.hasOwn(provided, name)) throw new SlotAssemblyError(`${owner} received duplicate prop '${name}'`);
		}
		function factoryKit(host, definition, rootBinding, scopeBinding, occurrence) {
			const standard = standardProps(definition.scope, rootBinding, scopeBinding);
			const registrationKit = { renderFactorySlot: boundRenderFactorySlot(definition) };
			if (definition.locale !== void 0) {
				const face = host.locale;
				if (face === void 0) throw new SlotAssemblyError(`factory declares locale namespace '${definition.locale}' but no locale face is installed`);
				registrationKit["t"] = localeSeat(face, definition.locale);
			}
			const scoped = scopeBinding?.key === void 0 ? void 0 : scopeBinding;
			const store = host.factoryStoreOf(definition, scoped, occurrence);
			if (store !== void 0) {
				registrationKit["useStore"] = observableHook(store);
				registrationKit["actions"] = store.actions;
			}
			if (definition.children !== void 0) {
				registrationKit["renderSlot"] = boundFactoryRenderSlot(host, definition);
				if (Object.values(definition.children).some((spec) => spec.kind === "chain")) registrationKit["renderSlotChain"] = boundFactoryRenderSlotChain(host, definition);
				if (Object.values(definition.children).some((spec) => spec.scope !== "root")) {
					const sessionAdapter = host.scope("session");
					if (sessionAdapter === void 0) throw new SlotAssemblyError("factory declares a session child without an installed 'session' scope adapter");
					registrationKit["SessionProvider"] = scopeAreaProvider(sessionAdapter);
				}
			}
			return {
				kit: {
					...standard,
					...registrationKit
				},
				registrationKit,
				actions: store?.actions
			};
		}
		function FactoryOccurrence({ definition, inputProps, selected, caller, binding, maybeEpoch }) {
			if (definition.scope === "root") return (0, react_jsx_runtime.jsx)(FactoryOccurrenceBody, {
				definition,
				inputProps,
				selected,
				caller
			});
			if (definition.scope === "session") {
				if (binding.key === void 0) throw new SlotAssemblyError(`strict session factory '${definition.name}' rendered without a scope binding`);
				return (0, react_jsx_runtime.jsx)(FactoryOccurrenceBody, {
					definition,
					inputProps,
					selected,
					caller,
					scopeBinding: binding
				}, sessionGenerationKeyOf(binding));
			}
			return (0, react_jsx_runtime.jsx)(FactoryOccurrenceBody, {
				definition,
				inputProps,
				selected,
				caller,
				scopeBinding: binding
			}, maybeEpoch);
		}
		function FactoryOccurrenceBody({ definition, inputProps, selected, caller, scopeBinding }) {
			const host = useHost();
			const rootBinding = useRootBinding();
			const occurrence = (0, react.useRef)({}).current;
			const localeRevision = useLocaleRevision(host.locale);
			(0, react.useEffect)(() => host.retainFactoryOccurrence(definition, occurrence), [
				definition,
				host,
				occurrence
			]);
			const { kit, registrationKit, actions } = (0, react.useMemo)(() => factoryKit(host, definition, rootBinding, scopeBinding, occurrence), [
				definition,
				host,
				localeRevision,
				occurrence,
				rootBinding,
				scopeBinding
			]);
			const injected = (0, react.useMemo)(() => runInject(definition, scopeBinding, actions), [
				actions,
				definition,
				scopeBinding
			]);
			assertNoPropOverlap(`factory '${definition.name}' inject`, kit, injected);
			const provided = {
				...kit,
				...injected,
				useFactorySlot: useFactorySlotRuntime
			};
			assertNoPropOverlap(`factory '${definition.name}' occurrence`, provided, inputProps);
			const context = (0, react.useMemo)(() => ({
				host,
				definition,
				selected,
				registrationKit: {
					...registrationKit,
					...injected
				},
				rootBinding,
				caller
			}), [
				caller,
				definition,
				host,
				injected,
				registrationKit,
				rootBinding,
				selected
			]);
			const Comp = definition.component;
			return (0, react_jsx_runtime.jsx)(FactoryOccurrenceContext.Provider, {
				value: context,
				children: (0, react_jsx_runtime.jsx)(Comp, {
					...provided,
					...inputProps
				})
			});
		}
		function FactoryOutlet({ name, inputProps, slots: selected = EMPTY_FACTORY_SELECTION, fallback, caller }) {
			const host = useHost();
			const ancestors = (0, react.useContext)(FactoryAncestryContext);
			const binding = useScopeBinding();
			const maybeEpoch = useMaybeIncarnation(binding);
			const version = (0, react.useSyncExternalStore)((listener) => host.subscribeFactory(name, listener), () => host.getFactoryVersion(name));
			const definition = host.factoryOf(name);
			const nextAncestors = (0, react.useMemo)(() => new Set(ancestors).add(name), [ancestors, name]);
			if (definition === void 0) return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: fallback ?? null });
			if (ancestors.has(name)) throw new _deepseek_ai_dsh_client_ui_slots.SlotOwnershipError(`recursive render of factory '${name}'`);
			for (const localName of Object.keys(selected)) if (definition.slots?.[localName] === void 0) throw new _deepseek_ai_dsh_client_ui_slots.SlotOwnershipError(`local slot '${localName}' is not declared by factory '${name}'`);
			const scopeIdentity = definition.scope === "root" ? "root" : definition.scope === "session" ? binding.key === void 0 ? "session:absent" : `session:${sessionGenerationKeyOf(binding)}` : `session-maybe:${maybeEpoch}`;
			return (0, react_jsx_runtime.jsx)(FactoryErrorBoundary, {
				name,
				onEntryError: (error) => {
					host.reportFactoryError(name, definition, error);
				},
				children: (0, react_jsx_runtime.jsx)(FactoryAncestryContext.Provider, {
					value: nextAncestors,
					children: (0, react_jsx_runtime.jsx)(FactoryOccurrence, {
						definition,
						inputProps,
						selected,
						caller,
						binding,
						maybeEpoch
					})
				})
			}, `${name}:${version}:${scopeIdentity}`);
		}
		function StrictSessionEntry({ slotKey, anchor, entry, ownerProps, slotInjected, hookContext, hasHookContext, onEntryError }) {
			const binding = useScopeBinding();
			if (binding.key === void 0) throw new SlotAssemblyError(`strict session slot '${slotKey}' rendered without a scope binding`);
			const scopedBinding = binding;
			return (0, react_jsx_runtime.jsx)(SlotErrorBoundary, {
				slotKey,
				anchor,
				onEntryError,
				children: (0, react_jsx_runtime.jsx)(SessionEntry, {
					entry,
					ownerProps,
					binding: scopedBinding,
					slotKey,
					slotInjected,
					hookContext,
					hasHookContext
				})
			}, sessionGenerationKeyOf(scopedBinding));
		}
		/**
		* Anchor style shared by every outlet wrapper: `display:contents` keeps the
		* wrapper out of layout (grid/flex parents see the slot's own children), so
		* the anchor is purely addressable surface. Module-level constant — a stable
		* reference so the wrapper never diffs its style prop.
		*/
		const ANCHOR_STYLE = { display: "contents" };
		function SlotOutlet({ slotKey, ownerProps, opts, declaredInline }) {
			const host = useHost();
			(0, react.useSyncExternalStore)((fn) => host.subscribe(slotKey, fn), () => host.getVersion(slotKey));
			useLocaleRevision(host.locale);
			const scopeBinding = useScopeBinding();
			const spec = host.specOf(slotKey);
			return (0, react_jsx_runtime.jsx)((spec === void 0 ? declaredInline : spec.inline === true) ? "span" : "div", {
				"data-slot": slotKey,
				style: ANCHOR_STYLE,
				children: spec === void 0 ? null : renderOutletContent(host, slotKey, ownerProps, opts, scopeBinding, spec)
			});
		}
		/** Kind dispatch behind the outlet anchor (single/keyed/list/chain, fallbacks, crash faces). */
		function renderOutletContent(host, slotKey, ownerProps, opts, scopeBinding, spec) {
			const Anchor = spec.inline === true ? "span" : "div";
			if (spec.kind === "chain" && opts?.fallbackOnly === true) return renderChainResult(slotKey, null, opts, Anchor);
			if (spec.scope === "session" && scopeBinding.key === void 0) throw new SlotAssemblyError(`strict session slot '${slotKey}' rendered without a scope binding`);
			const entries = host.entriesOf(slotKey);
			const slotInjected = cachedSlotInject(spec.inject);
			const guarded = (entry, key, owner = ownerProps) => {
				const hasHookContext = opts !== void 0 && Object.hasOwn(opts, "hookContext");
				const hookContext = opts?.hookContext;
				const onEntryError = (error) => {
					host.reportEntryError(slotKey, entry, error, { abdicate: spec.kind !== "chain" });
				};
				return spec.scope === "session" ? (0, react_jsx_runtime.jsx)(StrictSessionEntry, {
					slotKey,
					anchor: Anchor,
					entry,
					ownerProps: owner,
					slotInjected,
					hookContext,
					hasHookContext,
					onEntryError
				}, key) : (0, react_jsx_runtime.jsx)(SlotErrorBoundary, {
					slotKey,
					anchor: Anchor,
					onEntryError,
					children: spec.scope === "session-maybe" ? (0, react_jsx_runtime.jsx)(SessionMaybeEntry, {
						entry,
						ownerProps: owner,
						slotKey,
						slotInjected,
						hookContext,
						hasHookContext
					}) : (0, react_jsx_runtime.jsx)(RootEntry, {
						entry,
						ownerProps: owner,
						slotKey,
						slotInjected,
						hookContext,
						hasHookContext
					})
				}, key);
			};
			const deadCell = () => (0, react_jsx_runtime.jsx)(Anchor, { "data-slot-error": slotKey });
			if (spec.kind === "single") {
				const entry = host.entriesOfSlot(slotKey)[0];
				if (!entry) return entries.length > 0 ? deadCell() : (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: opts?.fallback ?? null });
				return guarded(entry, entryKeyOf(entry));
			}
			if (spec.kind === "keyed") {
				const entry = host.entriesOfSlot(slotKey).find((e) => e.options.key === opts?.entryKey);
				if (!entry) return entries.some((e) => e.options.key === opts?.entryKey) ? deadCell() : (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: opts?.fallback ?? null });
				return guarded(entry, entryKeyOf(entry));
			}
			if (spec.kind === "chain") {
				let elected = null;
				for (const entry of entries) {
					let matched;
					try {
						matched = entry.select(ownerProps);
					} catch (error) {
						console.error(`chain selector crashed in '${slotKey}' (${entry.registrant ?? "unknown registrant"}), treating as declined:`, error);
						continue;
					}
					if (matched !== null) {
						elected = guarded(entry, entryKeyOf(entry), {
							...ownerProps,
							matched
						});
						break;
					}
				}
export {};
