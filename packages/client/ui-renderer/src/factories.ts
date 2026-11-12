/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Port 1:1 vung Factory cua bundle goc (dong 889-1090): occurrence - ancestry - local slot - outlet
 */
import type { RendererBindings, RendererRuntime } from "./bindings.ts";
import { SlotAssemblyError } from "./errors.ts";
import { FactoryOutletRef, SlotOutletRef } from "./refs.ts";
import type { RenderSlot, ScopedSlots } from "./scoped-slots.ts";
import type { SlotRendererHost, StoredEntry, StoredFactory, StandardSourceBinding } from "./slots-api.ts";

/** Trạng thái một occurrence Factory đang sống (bản gốc: `occurrence` trong FactoryOutlet). */
interface FactoryOccurrenceState {
  /** Face host tại thời điểm occurrence sống. */
  host: SlotRendererHost;
  /** Định nghĩa Factory. */
  definition: StoredFactory;
  /** Ô cục bộ được chọn. */
  selected: Record<string, unknown>;
  /** Kit đăng ký (đã gộp inject) để local slot kế thừa. */
  registrationKit: Record<string, unknown>;
  /** Binding gốc tại thời điểm occurrence sống. */
  rootBinding: StandardSourceBinding;
  /** Chủ gọi. */
  caller: StoredEntry | Record<string, unknown>;
}

/** Props một occurrence Factory nhận từ outlet. */
export interface FactoryOccurrenceProps {
  /** Định nghĩa Factory. */
  definition: StoredFactory;
  /** Prop đầu vào của chủ gọi. */
  inputProps: Record<string, unknown>;
  /** Ô cục bộ được chọn. */
  selected: Record<string, unknown>;
  /** Chủ gọi (caller). */
  caller: StoredEntry | Record<string, unknown>;
  /** Binding scope hiện tại. */
  binding: StandardSourceBinding;
  /** Thế hệ scope tuỳ chọn (dùng làm React key). */
  maybeEpoch: number;
}

/** Props của outlet Factory (khớp bản gốc: name/inputProps/slots/fallback/caller). */
export interface FactoryOutletProps {
  /** Tên Factory. */
  name: string;
  /** Prop đầu vào. */
  inputProps: Record<string, unknown>;
  /** Ô cục bộ được chọn. */
  slots?: Record<string, unknown>;
  /** Cây thay thế khi Factory chưa đăng ký. */
  fallback?: unknown;
  /** Chủ gọi. */
  caller: StoredEntry | Record<string, unknown>;
}

/** Bề mặt Factory mà outlets/registry dùng. */
export interface Factories {
  /** Binding renderSlot của Factory (ổn định danh tính theo định nghĩa). */
  boundFactoryRenderSlot(host: SlotRendererHost, definition: StoredFactory): RenderSlot;
  /** Binding renderSlotChain của Factory. */
  boundFactoryRenderSlotChain(host: SlotRendererHost, definition: StoredFactory): RenderSlot;
  /** Outlet của một Factory (tra định nghĩa sống rồi vẽ occurrence). */
  FactoryOutlet(props: FactoryOutletProps): unknown;
}

/**
 * Dựng máy móc Factory (port 1:1 vùng Factory của bundle gốc, dòng 889–1090).
 *
 * Nhận: `runtime` — module react/jsx/ui-slots; `bindings` — bộ binding; `scoped` — máy móc scope.
 * Trả: bề mặt Factory; đồng thời điền `FactoryOutletRef` để scoped-slots dùng được.
 */
export function createFactories(runtime: RendererRuntime, bindings: RendererBindings, scoped: ScopedSlots): Factories {
  const { jsx } = runtime.jsx;
  const { createContext, useContext } = runtime.hooks as {
    createContext<T>(initial: T): unknown;
    useContext<T>(context: unknown): T;
  };
  const { Fragment } = runtime.jsx as RendererRuntime["jsx"] & { Fragment: unknown };
  const { useMemo, useRef, useEffect, useSyncExternalStore } = runtime.hooks;
  const { SlotOwnershipError, StaleAuthorizationError } = runtime.slotsApi;
  const { useHost, useScopeBinding, useRootBinding, observableHook } = bindings;
  const {
    standardProps,
    boundRenderFactorySlot,
    localeSeat,
    scopeAreaProvider,
    runFactoryInject,
    useLocaleRevision,
    useMaybeIncarnation,
    sessionGenerationKeyOf,
    FactoryErrorBoundary,
  } = scoped;

  /** Context occurrence hiện tại (bản gốc: FactoryOccurrenceContext). */
  const FactoryOccurrenceContext = createContext<unknown>(null) as { Provider: unknown };
  /** Tập tên Factory đang trong cây — chặn đệ quy (bản gốc: FactoryAncestryContext). */
  const FactoryAncestryContext = createContext<ReadonlySet<string>>(new Set<string>()) as { Provider: unknown };
  /** Lựa chọn cục bộ rỗng dùng chung (bản gốc: EMPTY_FACTORY_SELECTION). */
  const EMPTY_FACTORY_SELECTION: Record<string, unknown> = {};
  /** Cache binding renderSlot của Factory theo định nghĩa (bản gốc: factoryRenderSlotCache). */
  const factoryRenderSlotCache = new WeakMap<object, RenderSlot>();
  /** Cache binding renderSlotChain của Factory theo định nghĩa (bản gốc: factoryRenderSlotChainCache). */
  const factoryRenderSlotChainCache = new WeakMap<object, RenderSlot>();

  /**
   * Bảo đảm không prop nào bị hai nguồn cùng cấp (bản gốc: assertNoPropOverlap).
   * Nhận: `owner` — nhãn chẩn đoán, `provided` — prop đã cấp, `received` — prop chủ gọi truyền.
   * Trả: không.
   * @throws {SlotAssemblyError} khi trùng tên prop.
   */
  function assertNoPropOverlap(owner: string, provided: Record<string, unknown>, received: Record<string, unknown>): void {
    for (const name of Object.keys(received)) {
      if (Object.hasOwn(provided, name)) throw new SlotAssemblyError(owner + " received duplicate prop '" + name + "'");
    }
  }

  /**
   * Lấy binding renderSlot của Factory (bản gốc: boundFactoryRenderSlot).
   * Nhận: `host`, `definition`. Trả: hàm render ổn định danh tính.
   */
  function boundFactoryRenderSlot(host: SlotRendererHost, definition: StoredFactory): RenderSlot {
    let binding = factoryRenderSlotCache.get(definition as unknown as object);
    if (binding !== undefined) return binding;
    binding = (key, owner, opts) => {
      if (!host.isFactoryLive(definition)) throw new StaleAuthorizationError("renderSlot('" + key + "') from a disposed Factory");
      const declared = definition.children?.[key];
      if (declared === undefined) throw new SlotOwnershipError("slot '" + key + "' is not declared by this Factory");
      if (declared.kind === "chain") throw new SlotOwnershipError("slot '" + key + "' is declared 'chain' — use renderSlotChain");
      return jsx(SlotOutletRef.current, { slotKey: key, ownerProps: owner, opts, declaredInline: declared.inline === true });
    };
    factoryRenderSlotCache.set(definition as unknown as object, binding);
    return binding;
  }

  /**
   * Lấy binding renderSlotChain của Factory (bản gốc: boundFactoryRenderSlotChain).
   * Nhận: `host`, `definition`. Trả: hàm render ổn định danh tính.
   */
  function boundFactoryRenderSlotChain(host: SlotRendererHost, definition: StoredFactory): RenderSlot {
    let binding = factoryRenderSlotChainCache.get(definition as unknown as object);
    if (binding !== undefined) return binding;
    binding = (key, owner, opts) => {
      if (!host.isFactoryLive(definition)) throw new StaleAuthorizationError("renderSlotChain('" + key + "') from a disposed Factory");
      const declared = definition.children?.[key];
      if (declared === undefined) throw new SlotOwnershipError("slot '" + key + "' is not declared by this Factory");
      if (declared.kind !== "chain") throw new SlotOwnershipError("slot '" + key + "' is declared '" + declared.kind + "', not 'chain' — use renderSlot");
      return jsx(SlotOutletRef.current, { slotKey: key, ownerProps: owner, opts, declaredInline: declared.inline === true });
    };
    factoryRenderSlotChainCache.set(definition as unknown as object, binding);
    return binding;
  }

  /**
   * Tổng hợp kit của một occurrence Factory (bản gốc: factoryKit).
   *
   * Nhận: `host`, `definition`, `rootBinding`, `scopeBinding`, `occurrence`.
   * Trả: `{ kit, registrationKit, actions }`.
   * @throws {SlotAssemblyError} khi khai locale/con phiên mà thiếu face/adapter.
   */
  function factoryKit(
    host: SlotRendererHost,
    definition: StoredFactory,
    rootBinding: StandardSourceBinding,
    scopeBinding: StandardSourceBinding | undefined,
    occurrence: Record<string, unknown>,
  ): { kit: Record<string, unknown>; registrationKit: Record<string, unknown>; actions: unknown } {
    const standard = standardProps(definition.scope, rootBinding, scopeBinding);
    const registrationKit: Record<string, unknown> = { renderFactorySlot: boundRenderFactorySlot(definition as unknown as Record<string, unknown>) };
    if (definition.locale !== undefined) {
      const face = host.locale;
      if (face === undefined) throw new SlotAssemblyError("factory declares locale namespace '" + definition.locale + "' but no locale face is installed");
      registrationKit["t"] = localeSeat(face, definition.locale);
    }
    const scopedBinding = scopeBinding?.key === undefined ? undefined : scopeBinding;
    const store = host.factoryStoreOf(definition, scopedBinding, occurrence);
    if (store !== undefined) {
      registrationKit["useStore"] = observableHook(store);
      registrationKit["actions"] = store.actions;
    }
    if (definition.children !== undefined) {
      registrationKit["renderSlot"] = boundFactoryRenderSlot(host, definition);
      if (Object.values(definition.children).some((spec) => spec.kind === "chain")) {
        registrationKit["renderSlotChain"] = boundFactoryRenderSlotChain(host, definition);
      }
      if (Object.values(definition.children).some((spec) => spec.scope !== "root")) {
        const sessionAdapter = host.scope("session");
        if (sessionAdapter === undefined) throw new SlotAssemblyError("factory declares a session child without an installed 'session' scope adapter");
        registrationKit["SessionProvider"] = scopeAreaProvider(sessionAdapter);
      }
    }
    return { kit: { ...standard, ...registrationKit }, registrationKit, actions: store?.actions };
  }

  /**
   * Chuyển định nghĩa Factory thành "caller" cho binding renderFactorySlot
   * (bản gốc truyền thẳng `definition` — cùng hình dạng object nên dùng lại).
   * Nhận: `definition`. Trả: chính định nghĩa, kiểu caller.
   */
  function scopedCaller(definition: StoredFactory): Record<string, unknown> {
    return definition as unknown as Record<string, unknown>;
  }

  /**
   * Runtime của một local slot Factory (bản gốc: useFactorySlotRuntime).
   *
   * Nhận: `name` — tên local slot, `fallback` — component dự phòng.
   * Trả: component đã bind (ổn định theo phụ thuộc).
   * @throws {SlotAssemblyError} khi gọi ngoài occurrence, hoặc local slot phiên thiếu binding.
   * @throws {SlotOwnershipError} khi local slot không được Factory khai, hoặc render ngoài Factory.
   * @throws {StaleAuthorizationError} khi Factory đã bị gỡ.
   */
  function useFactorySlotRuntime(name: string, fallback: unknown): unknown {
    const occurrence = useContext<FactoryOccurrenceState | null>(FactoryOccurrenceContext);
    if (occurrence === null) throw new SlotAssemblyError("useFactorySlot() called outside a Factory occurrence");
    const { definition, host } = occurrence;
    if (!host.isFactoryLive(definition)) throw new StaleAuthorizationError("useFactorySlot('" + name + "') from a disposed Factory");
    const declared = definition.slots?.[name];
    if (declared === undefined) throw new SlotOwnershipError("local slot '" + name + "' is not declared by factory '" + definition.name + "'");
    const selected = occurrence.selected[name];
    const Selected = selected ?? fallback;
    const usesFallback = selected === undefined;
    return useMemo(
      /**
       * Dựng component local slot đã bind.
       * Nhận: không. Trả: component.
       */
      function bindFactoryLocalComponent(): unknown {
        /**
         * Component của một local slot.
         * Nhận: `localProps` — prop chủ gọi truyền.
         * Trả: cây React trong boundary của occurrence.
         */
        return function BoundFactoryLocalComponent(localProps: Record<string, unknown>): unknown {
          const current = useContext<FactoryOccurrenceState | null>(FactoryOccurrenceContext);
          const localScopeBinding = useScopeBinding();
          const localMaybeEpoch = useMaybeIncarnation(localScopeBinding);
          if (!host.isFactoryLive(definition)) throw new StaleAuthorizationError("local slot '" + name + "' from a disposed Factory");
          if (current === null || current.definition !== definition) {
            throw new SlotOwnershipError("local slot '" + name + "' rendered outside factory '" + definition.name + "'");
          }
          if (declared.scope === "session" && localScopeBinding.key === undefined) {
            throw new SlotAssemblyError("strict session local slot '" + name + "' from factory '" + definition.name + "' rendered without a scope binding");
          }
          const localOwner = usesFallback ? definition : current.caller;
          const localScopeIdentity =
            declared.scope === "root"
              ? "root"
              : declared.scope === "session"
                ? "session:" + String(sessionGenerationKeyOf(localScopeBinding))
                : "session-maybe:" + String(localMaybeEpoch);
          const localStandard = standardProps(declared.scope, current.rootBinding, localScopeBinding);
          const localRegistrationKit: Record<string, unknown> = {
            ...current.registrationKit,
            renderFactorySlot: boundRenderFactorySlot(localOwner),
          };
          assertNoPropOverlap("factory '" + definition.name + "' local slot '" + name + "'", localRegistrationKit, localStandard);
          const provided = { ...localRegistrationKit, ...localStandard };
          assertNoPropOverlap("factory '" + definition.name + "' local slot '" + name + "'", provided, localProps);
          return jsx(
            FactoryErrorBoundary,
            {
              name: definition.name + ":" + name,
              onEntryError: (error: unknown) => {
                host.reportFactoryError(definition.name, localOwner, error);
              },
              children: jsx(Selected, { ...provided, ...localProps }),
            },
            definition.name + ":" + name + ":" + localScopeIdentity,
          );
        };
      },
      [Selected, declared.scope, definition, host, name, usesFallback],
    );
  }



  /**
   * Thân một occurrence Factory: dựng kit + inject rồi vẽ component (bản gốc: FactoryOccurrenceBody).
   * Nhận: `props`. Trả: cây React (bọc provider occurrence).
   */
  function FactoryOccurrenceBody(props: {
    definition: StoredFactory;
    inputProps: Record<string, unknown>;
    selected: Record<string, unknown>;
    caller: StoredEntry | Record<string, unknown>;
    scopeBinding?: StandardSourceBinding;
  }): unknown {
    const { definition, inputProps, selected, caller, scopeBinding } = props;
    const host = useHost();
    const rootBinding = useRootBinding();
    const occurrence = useRef<Record<string, unknown>>({}).current;
    const localeRevision = useLocaleRevision(host.locale);
    useEffect(() => host.retainFactoryOccurrence(definition, occurrence), [definition, host, occurrence]);
    const { kit, registrationKit, actions } = useMemo(
      () => factoryKit(host, definition, rootBinding, scopeBinding, occurrence),
      [definition, host, localeRevision, occurrence, rootBinding, scopeBinding],
    );
    const injected = useMemo(() => runFactoryInject(definition, scopeBinding, actions), [actions, definition, scopeBinding]);
    assertNoPropOverlap("factory '" + definition.name + "' inject", kit, injected);
    const provided: Record<string, unknown> = { ...kit, ...injected, useFactorySlot: useFactorySlotRuntime };
    assertNoPropOverlap("factory '" + definition.name + "' occurrence", provided, inputProps);
    const context = useMemo(
      (): FactoryOccurrenceState => ({
        host,
        definition,
        selected,
        registrationKit: { ...registrationKit, ...injected },
        rootBinding,
        caller,
      }),
      [caller, definition, host, injected, registrationKit, rootBinding, selected],
    );
    const Comp = definition.component;
    return jsx(FactoryOccurrenceContext.Provider as unknown as unknown, { value: context, children: jsx(Comp, { ...provided, ...inputProps }) });
  }

  /**
   * Một occurrence Factory: chia nhánh theo scope rồi gắn React key đúng thế hệ
   * (bản gốc: FactoryOccurrence).
   * Nhận: `props` của occurrence.
   * Trả: cây React.
   * @throws {SlotAssemblyError} khi Factory phiên nghiêm ngặt render mà thiếu binding.
   */
  function FactoryOccurrence(props: FactoryOccurrenceProps): unknown {
    const { definition, inputProps, selected, caller, binding, maybeEpoch } = props;
    if (definition.scope === "root") {
      return jsx(FactoryOccurrenceBody, { definition, inputProps, selected, caller });
    }
    if (definition.scope === "session") {
      if (binding.key === undefined) throw new SlotAssemblyError("strict session factory '" + definition.name + "' rendered without a scope binding");
      return jsx(FactoryOccurrenceBody, { definition, inputProps, selected, caller, scopeBinding: binding }, sessionGenerationKeyOf(binding));
    }
    return jsx(FactoryOccurrenceBody, { definition, inputProps, selected, caller, scopeBinding: binding }, maybeEpoch);
  }

  /**
   * Outlet của một Factory (bản gốc: FactoryOutlet) — theo dõi đăng ký, chặn đệ quy, bọc boundary.
   * Nhận: `props.name` + prop đầu vào + lựa chọn cục bộ + caller.
   * Trả: cây React.
   * @throws {SlotOwnershipError} khi đệ quy, hoặc local slot không được khai.
   */
  function FactoryOutlet(props: FactoryOutletProps): unknown {
    const { name, inputProps, fallback, caller } = props;
    const selected = props.slots ?? EMPTY_FACTORY_SELECTION;
    const host = useHost();
    const ancestors = useContext<ReadonlySet<string>>(FactoryAncestryContext);
    const binding = useScopeBinding();
    const maybeEpoch = useMaybeIncarnation(binding);
    const version = useSyncExternalStore(
      (listener: () => void) => host.subscribeFactory(name, listener),
      () => host.getFactoryVersion(name),
    );
    const definition = host.factoryOf(name);
    const nextAncestors = useMemo(() => new Set(ancestors).add(name), [ancestors, name]);
    if (definition === undefined) return jsx(Fragment, { children: fallback ?? null });
    if (ancestors.has(name)) throw new SlotOwnershipError("recursive render of factory '" + name + "'");
    for (const localName of Object.keys(selected)) {
      if (definition.slots?.[localName] === undefined) throw new SlotOwnershipError("local slot '" + localName + "' is not declared by factory '" + name + "'");
    }
    const scopeIdentity =
      definition.scope === "root"
        ? "root"
        : definition.scope === "session"
          ? binding.key === undefined
            ? "session:absent"
            : "session:" + String(sessionGenerationKeyOf(binding))
          : "session-maybe:" + String(maybeEpoch);
    return jsx(
      FactoryErrorBoundary,
      {
        name,
        onEntryError: (error: unknown) => {
          host.reportFactoryError(name, definition, error);
        },
        children: jsx(FactoryAncestryContext.Provider as unknown as unknown, {
          value: nextAncestors,
          children: jsx(FactoryOccurrence, { definition, inputProps, selected, caller, binding, maybeEpoch }),
        }),
      },
      name + ":" + String(version) + ":" + scopeIdentity,
    );
  }

  FactoryOutletRef.current = FactoryOutlet;

  return { boundFactoryRenderSlot, boundFactoryRenderSlotChain, FactoryOutlet };
}