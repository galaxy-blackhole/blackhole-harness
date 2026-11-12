/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Port 1:1 vung `scoped-slots.js` cua bundle goc (dong 316-1279): cache theo DANH TINH - inject theo
 *      mục - locale seat - error boundary từng chỗ ngồi - standard kit - các component entry
 */
//
// Vì sao tách khỏi outlets.ts/factories.ts: luật ≤1000 dòng/file. Ba tệp này là MỘT vùng của bundle gốc
// được cắt theo trách nhiệm; import vòng scoped-slots ↔ factories là AN TOÀN vì Bun gộp mọi module vào
// MỘT phạm vi hàm và khai `function` được hoist — chỉ các lời gọi LÚC RENDER chạm tới nhau.
import type { RendererBindings, RendererRuntime } from "./bindings.ts";
import { SlotAssemblyError } from "./errors.ts";
import { FactoryOutletRef, SlotOutletRef } from "./refs.ts";
import type {
  HostObservable,
  KeyedStandardSource,
  LocaleFace,
  SlotRendererHost,
  SlotScopeAdapter,
  StandardSourceBinding,
  StoredEntry,
} from "./slots-api.ts";

/** Face inject do bộ điều phối sở hữu (mỗi mục/slot một face, giữ theo danh tính object). */
export type InjectFace = Record<string, unknown>;

/** Kết quả chuẩn hoá face inject của một slot. */
export interface SlotInjected {
  /** Prop đi thẳng vào component. */
  readonly props: Record<string, unknown>;
  /** Factory hook hoãn (chỉ chạy khi có hookContext). */
  readonly slotHookFactories?: Record<string, (standard: Record<string, unknown>, hookContext: unknown) => unknown>;
}

/** Tuỳ chọn một lần renderSlot (khớp bản gốc — chỉ những khoá renderer đọc). */
export interface RenderOpts {
  /** Khoá của mục trong slot kiểu keyed. */
  readonly entryKey?: string;
  /** Cây thay thế khi ô trống. */
  readonly fallback?: unknown;
  /** Chỉ vẽ mục có id này (slot kiểu list). */
  readonly only?: string;
  /** Chuỗi overlay: giữ cây fallback ở đúng vị trí. */
  readonly overlay?: boolean;
  /** Chỉ trả kết quả chọn chuỗi, không vẽ. */
  readonly fallbackOnly?: boolean;
  /** Context hook của chỗ ngồi. */
  readonly hookContext?: unknown;
}

/** Chữ ký `renderSlot(key, owner, opts?)` mà mục nhận qua kit. */
export type RenderSlot = (key: string, owner: Record<string, unknown>, opts?: RenderOpts) => unknown;

/** Chữ ký `renderFactorySlot(name, props, options?)` mà mục nhận qua kit. */
export type RenderFactorySlot = (
  name: string,
  props: Record<string, unknown>,
  options?: { readonly slots?: Record<string, unknown>; readonly fallback?: unknown },
) => unknown;

/** Props chung của một chỗ ngồi được render. */
export interface EntryRenderProps {
  /** Mục đăng ký. */
  entry: StoredEntry;
  /** Phần prop của chủ sở hữu ô. */
  ownerProps: Record<string, unknown>;
  /** Khoá slot đang render. */
  slotKey: string;
  /** Face inject của slot. */
  slotInjected: SlotInjected;
  /** Context hook của chỗ ngồi. */
  hookContext: unknown;
  /** Có `hookContext` trong opts hay không. */
  hasHookContext: boolean;
}

/** Props của chỗ ngồi PHIÊN nghiêm ngặt. */
export interface StrictEntryProps extends EntryRenderProps {
  /** Mỏ neo error boundary. */
  anchor: string;
  /** Báo lỗi chỗ ngồi (registry quyết định rút lui). */
  onEntryError: (error: unknown) => void;
}

/** Bề mặt nội bộ mà tầng renderer dùng — do `createScopedSlots` dựng một lần cho mỗi runtime. */
export interface ScopedSlots {
  /** Chuẩn hoá face inject của một slot (cache theo danh tính face). */
  cachedSlotInject(face: InjectFace | undefined): SlotInjected;
  /** Face inject RỖNG (dùng cho ô 'root' — không có bộ điều phối). */
  readonly emptySlotInject: SlotInjected;
  /** Số danh tính của một mục — dùng làm React key và khoá cache. */
  entryKeyOf(entry: StoredEntry): number;
  /** Số danh tính THẾ HỆ của một binding phiên — remount khi đổi phiên. */
  sessionGenerationKeyOf(binding: StandardSourceBinding): number;
  /** Theo dõi revision từ điển (gọi ĐÚNG MỘT lần mỗi render để giữ thứ tự hook). */
  useLocaleRevision(face: LocaleFace | undefined): number;
  /** Theo dõi "thế hệ" scope tuỳ chọn (adopt phiên đầu tiên; remount khi đổi phiên). */
  useMaybeIncarnation(binding: StandardSourceBinding): number;
  /** Kit chuẩn + renderSlot/renderFactorySlot/actions cho một mục. */
  standardKit(
    host: SlotRendererHost,
    entry: StoredEntry,
    scope: "root" | "session" | "session-maybe",
    rootBinding: StandardSourceBinding,
    scopeBinding: StandardSourceBinding | undefined,
  ): { kit: Record<string, unknown>; standard: Record<string, unknown>; actions: unknown };
  /** Chạy face inject của một mục (có cache theo trục của mục). */
  runInject(entry: StoredEntry, binding: StandardSourceBinding | undefined, actions: unknown): Record<string, unknown>;
  /** Ghế dịch `t` của một namespace (cache theo revision). */
  localeSeat(face: LocaleFace, ns: string): (key: string, params?: Record<string, unknown>) => string;
  /** Binding `renderFactorySlot` của một caller (cache theo danh tính caller). */
  boundRenderFactorySlot(caller: unknown): RenderFactorySlot;
  /** Prop chuẩn của một scope (cache theo binding gốc × binding scope). */
  standardProps(
    scope: "root" | "session" | "session-maybe",
    rootBinding: StandardSourceBinding,
    scopeBinding: StandardSourceBinding | undefined,
  ): Record<string, unknown>;
  /** Chạy face inject của một Factory (cùng ngữ nghĩa runInject, trục cache là định nghĩa). */
  runFactoryInject(definition: { readonly inject?: (...args: unknown[]) => InjectFace }, binding: StandardSourceBinding | undefined, actions: unknown): Record<string, unknown>;
  /** Provider vùng của một scope (ghế SessionProvider). */
  scopeAreaProvider(adapter: SlotScopeAdapter): unknown;
  /** Error boundary của MỘT chỗ ngồi (bọc ngoài entry). */
  SlotErrorBoundary: new (props: Record<string, unknown>) => unknown;
  /** Error boundary của MỘT occurrence Factory. */
  FactoryErrorBoundary: new (props: Record<string, unknown>) => unknown;
  /** Vẽ một entry theo scope (root · session · session-maybe) trong boundary. */
  renderEntry(
    slotKey: string,
    Comp: unknown,
    kit: Record<string, unknown>,
    standard: Record<string, unknown>,
    injected: Record<string, unknown>,
    slotInjected: SlotInjected,
    ownerProps: Record<string, unknown>,
    hookContext: unknown,
    hasHookContext: boolean,
  ): unknown;
  /** Chỗ ngồi scope PHIÊN nghiêm ngặt (ném nếu thiếu binding). */
  StrictSessionEntry(props: StrictEntryProps): unknown;
  /** Chỗ ngồi scope PHIÊN TUỲ CHỌN (có adopt incarnation). */
  SessionMaybeEntry(props: EntryRenderProps): unknown;
  /** Chỗ ngồi scope GỐC. */
  RootEntry(props: EntryRenderProps): unknown;
  /** Vẽ chỗ ngồi scope phiên (đã có binding nghiêm ngặt). */
  SessionEntry(props: EntryRenderProps & { binding: StandardSourceBinding }): unknown;
}

/**
 * Dựng toàn bộ máy móc scoped-slots (port 1:1 vùng `scoped-slots.js`, dòng 316–1279 của bundle gốc).
 *
 * Nhận: `runtime` — module react/jsx/ui-slots của trang; `bindings` — bộ binding React đã dựng.
 * Trả: bề mặt nội bộ dùng bởi outlets/factories/registry.
 */
export function createScopedSlots(runtime: RendererRuntime, bindings: RendererBindings): ScopedSlots {
  const { jsx } = runtime.jsx;
  const { useMemo, useState, useEffect, Component } = runtime.hooks;
  const { standardHookPropName, SlotOwnershipError, StaleAuthorizationError } = runtime.slotsApi;
  const { useHost, useRootBinding, useScopeBinding, ScopeBindingProvider, observableHook, maybeObservableHook, keyedObservableHook } =
    bindings;

  //#region cache renderSlot / renderSlotChain (bản gốc: dòng 335–424)

  /** Cache binding `renderSlot` theo MỤC — binding sống chết cùng mục (bản gốc: `renderSlotCache`). */
  const renderSlotCache = new WeakMap<object, RenderSlot>();

  /**
   * Lấy binding `renderSlot` của một mục (bản gốc: `boundRenderSlot`).
   *
   * Nhận: `host` — face host, `entry` — mục đăng ký.
   * Trả: hàm render ổn định danh tính theo mục.
   * @throws {StaleAuthorizationError} khi mục đã bị gỡ mà closure còn gọi.
   * @throws {SlotOwnershipError} khi khoá không được mục này khai, hoặc khai sai kiểu.
   */
  function boundRenderSlot(host: SlotRendererHost, entry: StoredEntry): RenderSlot {
    let binding = renderSlotCache.get(entry as object);
    if (binding === undefined) {
      binding = (key, owner, opts) => {
        if (!host.isLive(entry)) throw new StaleAuthorizationError(`renderSlot('${key}') from a disposed registration`);
        const declared = entry.children?.[key];
        if (declared === undefined) throw new SlotOwnershipError(`slot '${key}' is not declared by this entry's children`);
        if (declared.kind === "chain") throw new SlotOwnershipError(`slot '${key}' is declared 'chain' — use renderSlotChain`);
        return jsx(SlotOutletRef.current, { slotKey: key, ownerProps: owner, opts, declaredInline: declared.inline === true });
      };
      renderSlotCache.set(entry as object, binding);
    }
    return binding;
  }

  /** Cache binding `renderSlotChain` theo MỤC (bản gốc: `renderSlotChainCache`). */
  const renderSlotChainCache = new WeakMap<object, RenderSlot>();

  /**
   * Lấy binding `renderSlotChain` của một mục (bản gốc: `boundRenderSlotChain`).
   *
   * Nhận: `host` — face host, `entry` — mục đăng ký.
   * Trả: hàm render ổn định danh tính theo mục.
   * @throws {StaleAuthorizationError} khi mục đã bị gỡ mà closure còn gọi.
   * @throws {SlotOwnershipError} khi khoá không được khai, hoặc không phải kiểu chain.
   */
  function boundRenderSlotChain(host: SlotRendererHost, entry: StoredEntry): RenderSlot {
    let binding = renderSlotChainCache.get(entry as object);
    if (binding === undefined) {
      binding = (key, owner, opts) => {
        if (!host.isLive(entry)) throw new StaleAuthorizationError(`renderSlotChain('${key}') from a disposed registration`);
        const declared = entry.children?.[key];
        if (declared === undefined) throw new SlotOwnershipError(`slot '${key}' is not declared by this entry's children`);
        if (declared.kind !== "chain") throw new SlotOwnershipError(`slot '${key}' is declared '${declared.kind}', not 'chain' — use renderSlot`);
        return jsx(SlotOutletRef.current, { slotKey: key, ownerProps: owner, opts, declaredInline: declared.inline === true });
      };
      renderSlotChainCache.set(entry as object, binding);
    }
    return binding;
  }
  //#endregion

  //#region inject theo mục (bản gốc: dòng 425–532)
  /** Cache kết quả inject của mục cấp GỐC (bản gốc: `rootInjectCache`). */
  const rootInjectCache = new WeakMap<object, Record<string, unknown>>();
  /** Cache kết quả inject của mục cấp PHIÊN, theo (mục × binding) (bản gốc: `sessionInjectCache`). */
  const sessionInjectCache = new WeakMap<object, WeakMap<object, Record<string, unknown>>>();
  /** Cache kết quả inject của mục cấp PHIÊN TUỲ CHỌN (bản gốc: `sessionMaybeInjectCache`). */
  const sessionMaybeInjectCache = new WeakMap<object, WeakMap<object, Record<string, unknown>>>();
  /** Object rỗng DÙNG CHUNG cho mục không khai inject (bản gốc: `EMPTY_INJECTED_PROPS`). */
  const EMPTY_INJECTED_PROPS: Record<string, unknown> = {};

  /**
   * Chạy face inject của một mục rồi bind các nguồn hook của nó (bản gốc: `runInject`).
   *
   * Nhận: `entry`, `binding` (vắng ở cấp gốc), `actions` (vắng khi mục không có store).
   * Trả: prop inject đã bind hook.
   */
  function runInject(entry: StoredEntry, binding: StandardSourceBinding | undefined, actions: unknown): Record<string, unknown> {
    const inject = entry.inject as ((...args: unknown[]) => InjectFace) | undefined;
    if (inject === undefined) return EMPTY_INJECTED_PROPS;
    const args: unknown[] = [];
    if (binding !== undefined) args.push(binding.key);
    if (actions !== undefined) args.push(actions);
    return bindInjectSources(inject(...args));
  }

  /**
   * Chạy face inject của một FACTORY (bản gốc: Factory dùng chung runInject với trục riêng).
   *
   * Nhận: `definition` — định nghĩa Factory; `binding`, `actions`.
   * Trả: prop inject đã bind hook.
   */
  function runFactoryInject(
    definition: { readonly inject?: (...args: unknown[]) => InjectFace },
    binding: StandardSourceBinding | undefined,
    actions: unknown,
  ): Record<string, unknown> {
    const inject = definition.inject;
    if (inject === undefined) return EMPTY_INJECTED_PROPS;
    const args: unknown[] = [];
    if (binding !== undefined) args.push(binding.key);
    if (actions !== undefined) args.push(actions);
    return bindInjectSources(inject(...args));
  }

  /**
   * Bind face inject của một mục trên ĐÚNG trục cache của nó (bản gốc: `bindInjectSources`).
   *
   * Nhận: `face` — face thô từ hàm inject.
   * Trả: face đã thay `hooks`/`keyedHooks` bằng hook đã bind.
   */
  function bindInjectSources(face: InjectFace): Record<string, unknown> {
    const sources = face["hooks"] as Record<string, HostObservable<unknown>> | undefined;
    const keyedSources = face["keyedHooks"] as Record<string, KeyedStandardSource> | undefined;
    if (sources === undefined && keyedSources === undefined) return face;
    const { hooks: _hooks, keyedHooks: _keyedHooks, ...rest } = face;
    const bound = rest;
    for (const [name, source] of Object.entries(sources ?? {})) bound[standardHookPropName(name)] = observableHook(source);
    for (const [name, source] of Object.entries(keyedSources ?? {})) bound[standardHookPropName(name)] = keyedObservableHook(source);
    return bound;
  }

  /** Cache chuẩn hoá face inject theo DANH TÍNH face (bản gốc: `slotInjectCache`). */
  const slotInjectCache = new WeakMap<object, SlotInjected>();
  /** Face inject RỖNG dùng chung (bản gốc: `EMPTY_SLOT_INJECT`). */
  const EMPTY_SLOT_INJECT: SlotInjected = { props: EMPTY_INJECTED_PROPS };

  /**
   * Chuẩn hoá face inject do bộ điều phối sở hữu, theo DANH TÍNH object (bản gốc: `cachedSlotInject`).
   *
   * Nhận: `face` — face thô (có thể vắng).
   * Trả: `{ props, slotHookFactories? }` đã chuẩn hoá.
   */
  function cachedSlotInject(face: InjectFace | undefined): SlotInjected {
    if (face === undefined) return EMPTY_SLOT_INJECT;
    let bound = slotInjectCache.get(face);
    if (bound !== undefined) return bound;
    const definitions = face["hooks"] as Record<string, unknown> | undefined;
    if (definitions === undefined) {
      bound = { props: face };
      slotInjectCache.set(face, bound);
      return bound;
    }
    const { hooks: _hooks, ...rest } = face;
    const props = rest;
    let factories: Record<string, (standard: Record<string, unknown>, hookContext: unknown) => unknown> | undefined;
    for (const [name, definition] of Object.entries(definitions)) {
      const hookName = standardHookPropName(name);
      if (typeof definition === "function") {
        factories ??= {};
        factories[name] = definition as (standard: Record<string, unknown>, hookContext: unknown) => unknown;
      } else props[hookName] = observableHook(definition as HostObservable<unknown>);
    }
    bound = factories === undefined ? { props } : { props, slotHookFactories: factories };
    slotInjectCache.set(face, bound);
    return bound;
  }

  /**
   * Bind các factory hook hoãn của MỘT lần renderSlot (bản gốc: `bindSlotHookFactories`).
   *
   * Nhận: `factories`, `standard`, `hookContext`.
   * Trả: prop hook đã dựng.
   */
  function bindSlotHookFactories(
    factories: Record<string, (standard: Record<string, unknown>, hookContext: unknown) => unknown>,
    standard: Record<string, unknown>,
    hookContext: unknown,
  ): Record<string, unknown> {
    const hooks: Record<string, unknown> = {};
    for (const [name, factory] of Object.entries(factories)) hooks[standardHookPropName(name)] = factory(standard, hookContext);
    return hooks;
  }

  /**
   * Inject cấp GỐC, cache theo mục (bản gốc: `cachedRootInject`).
   * Nhận: `entry`, `actions`. Trả: prop inject.
   */
  function cachedRootInject(entry: StoredEntry, actions: unknown): Record<string, unknown> {
    let props = rootInjectCache.get(entry as object);
    if (props === undefined) {
      props = runInject(entry, undefined, actions);
      rootInjectCache.set(entry as object, props);
    }
    return props;
  }

  /**
   * Inject cấp PHIÊN, cache theo (mục × binding) (bản gốc: `cachedSessionInject`).
   * Nhận: `entry`, `binding`, `actions`. Trả: prop inject.
   */
  function cachedSessionInject(entry: StoredEntry, binding: StandardSourceBinding, actions: unknown): Record<string, unknown> {
    let perBinding = sessionInjectCache.get(entry as object);
    if (perBinding === undefined) {
      perBinding = new WeakMap<object, Record<string, unknown>>();
      sessionInjectCache.set(entry as object, perBinding);
    }
    let props = perBinding.get(binding as unknown as object);
    if (props === undefined) {
      props = runInject(entry, binding, actions);
      perBinding.set(binding as unknown as object, props);
    }
    return props;
  }

  /**
   * Inject cấp PHIÊN TUỲ CHỌN, cache theo (mục × binding) (bản gốc: `cachedSessionMaybeInject`).
   * Nhận: `entry`, `binding`, `actions`. Trả: prop inject.
   */
  function cachedSessionMaybeInject(entry: StoredEntry, binding: StandardSourceBinding, actions: unknown): Record<string, unknown> {
    let perBinding = sessionMaybeInjectCache.get(entry as object);
    if (perBinding === undefined) {
      perBinding = new WeakMap<object, Record<string, unknown>>();
      sessionMaybeInjectCache.set(entry as object, perBinding);
    }
    let props = perBinding.get(binding as unknown as object);
    if (props === undefined) {
      props = runInject(entry, binding, actions);
      perBinding.set(binding as unknown as object, props);
    }
    return props;
  }
  //#endregion

  //#region locale seat (bản gốc: dòng 533–590)
  /** Cache hàm dịch theo (face × namespace × revision) (bản gốc: `localeSeatCache`). */
  const localeSeatCache = new WeakMap<object, Map<string, { revision: number; t: (key: string, params?: Record<string, unknown>) => string }>>();

  /**
   * Lấy ghế `t` của một namespace, cache theo revision (bản gốc: `localeSeat`).
   *
   * Revision nằm trong KHOÁ CACHE là CÓ CHỦ Ý: đổi ngôn ngữ sinh tham chiếu hàm MỚI cho mỗi namespace,
   * nên component `React.memo` nhận `t` tự render lại qua so sánh nông — không cần kênh vô hiệu riêng.
   *
   * Nhận: `face` — face từ điển đã cài, `ns` — namespace.
   * Trả: hàm dịch `t(key, params?)`.
   */
  function localeSeat(face: LocaleFace, ns: string): (key: string, params?: Record<string, unknown>) => string {
    let perNs = localeSeatCache.get(face as unknown as object);
    if (perNs === undefined) {
      perNs = new Map();
      localeSeatCache.set(face as unknown as object, perNs);
    }
    const revision = face.getSnapshot().revision;
    const cached = perNs.get(ns);
    if (cached !== undefined && cached.revision === revision) return cached.t;
    const bound = face.bind(ns);
    const t = (key: string, params?: Record<string, unknown>): string => bound(key, params);
    perNs.set(ns, { revision, t });
    return t;
  }

  /** Subscribe rỗng khi chưa cài face (bản gốc: `noopSubscribe`). */
  const noopSubscribe = (): (() => void) => () => undefined;
  /** Revision luôn 0 khi chưa cài face (bản gốc: `zeroRevision`). */
  const zeroRevision = (): number => 0;
  /** Cache cặp subscribe/getRevision theo face (bản gốc: `localeSubscriptionCache`). */
  const localeSubscriptionCache = new WeakMap<object, { subscribe: (fn: () => void) => () => void; getRevision: () => number }>();

  /**
   * Lấy cặp subscribe/getRevision ổn định theo face (bản gốc: `localeSubscription`).
   * Nhận: `face`. Trả: cặp closure.
   */
  function localeSubscription(face: LocaleFace): { subscribe: (fn: () => void) => () => void; getRevision: () => number } {
    let cached = localeSubscriptionCache.get(face as unknown as object);
    if (cached === undefined) {
      cached = {
        subscribe: (fn) => face.subscribe(fn),
        getRevision: () => face.getSnapshot().revision,
      };
      localeSubscriptionCache.set(face as unknown as object, cached);
    }
    return cached;
  }

  /**
   * Theo dõi revision từ điển (bản gốc: `useLocaleRevision`) — ĐÚNG MỘT lời gọi uSES mỗi render.
   * Nhận: `face` — face hoặc vắng. Trả: revision (0 khi vắng).
   */
  function useLocaleRevision(face: LocaleFace | undefined): number {
    const subscription = face !== undefined ? localeSubscription(face) : undefined;
    return runtime.hooks.useSyncExternalStore(subscription?.subscribe ?? noopSubscribe, subscription?.getRevision ?? zeroRevision);
  }
  //#endregion

  //#region danh tính mục / thế hệ phiên (bản gốc: dòng 591–620)
  /** Bộ đếm key mục — bản gốc: `nextEntryKey`. */
  let nextEntryKey = 0;
  /** Key theo mục — bản gốc: `entryKeys`. */
  const entryKeys = new WeakMap<object, number>();

  /**
   * Số danh tính của một mục (bản gốc: `entryKeyOf`).
   *
   * Vì sao cần key: outlet vẽ một người thắng mỗi vị trí qua error boundary; KHÔNG có key thì boundary
   * đã hỏng ở mục A sẽ sống sót khi người thắng đổi ⇒ mục B lành vẫn bị "đen". Key theo danh tính mục
   * làm boundary remount tươi mỗi khi người thắng đổi.
   *
   * Nhận: `entry`. Trả: số key ổn định.
   */
  function entryKeyOf(entry: StoredEntry): number {
    let key = entryKeys.get(entry as object);
    if (key === undefined) {
      key = nextEntryKey++;
      entryKeys.set(entry as object, key);
    }
    return key;
  }

  /** Bộ đếm thế hệ phiên — bản gốc: `nextSessionGenerationKey`. */
  let nextSessionGenerationKey = 0;
  /** Key theo ctx của binding — bản gốc: `sessionGenerationKeys`. */
  const sessionGenerationKeys = new WeakMap<object, number>();

  /**
   * Số danh tính THẾ HỆ của một binding phiên (bản gốc: `sessionGenerationKeyOf`).
   * Nhận: `binding`. Trả: số key ổn định theo `binding.ctx`.
   */
  function sessionGenerationKeyOf(binding: StandardSourceBinding): number {
    const ctx = binding.ctx as object;
    let key = sessionGenerationKeys.get(ctx);
    if (key === undefined) {
      key = nextSessionGenerationKey++;
      sessionGenerationKeys.set(ctx, key);
    }
    return key;
  }
  //#endregion

  //#region error boundary từng chỗ ngồi (bản gốc: dòng 621–662)

  /** Props của error boundary một chỗ ngồi. */
  interface SlotErrorBoundaryProps {
    /** Khoá slot đang render (dùng cho chẩn đoán + thuộc tính DOM). */
    slotKey: string;
    /** Mỏ neo thay thế khi chỗ ngồi chết (mặc định 'div'). */
    anchor?: string;
    /** Báo lỗi cho sổ (registry quyết định rút lui). */
    onEntryError: (error: unknown) => void;
    /** Cây con. */
    children?: unknown;
  }

  /**
   * Cô lập MỘT chỗ ngồi: một registrant sập (render component hoặc factory inject) KHÔNG được kéo anh em
   * theo (bản gốc: SlotErrorBoundary).
   *
   * Lỗi LẮP RÁP (thiếu provider) được NÉM LẠI — một vỏ đấu dây sai phải hỏng TO, không được thoái hoá
   * thành fallback im lặng. Mọi lỗi khác báo qua onEntryError (seam giám sát của sổ).
   */
  class SlotErrorBoundary extends Component {
    /** State khởi tạo: chưa hỏng. */
    override state: Record<string, unknown> = { failed: false };

    /**
     * Bắt lỗi render của con.
     * Nhận: error — lỗi.
     * Trả: state mới, hoặc NÉM LẠI khi là lỗi lắp ráp.
     */
    static getDerivedStateFromError(error: unknown): Record<string, unknown> {
      if (error instanceof SlotAssemblyError) throw error;
      return { failed: true };
    }

    /**
     * Báo lỗi đã bắt.
     * Nhận: error — lỗi.
     * Trả: không.
     */
    componentDidCatch(error: unknown): void {
      const props = this.props as unknown as SlotErrorBoundaryProps;
      console.error("slot entry crashed in '" + props.slotKey + "':", error);
      props.onEntryError(error);
    }

    /**
     * Vẽ con, hoặc mỏ neo đánh dấu chỗ ngồi đã chết.
     * Nhận: không.
     * Trả: cây React.
     */
    override render(): unknown {
      const props = this.props as unknown as SlotErrorBoundaryProps;
      const Anchor = props.anchor ?? "div";
      if (this.state["failed"] === true) return jsx(Anchor, { "data-slot-error": props.slotKey });
      return props.children;
    }
  }

  /** Props của error boundary một occurrence Factory. */
  interface FactoryErrorBoundaryProps {
    /** Tên Factory. */
    name: string;
    /** Báo lỗi cho sổ. */
    onEntryError: (error: unknown) => void;
    /** Cây con. */
    children?: unknown;
  }

  /**
   * Cô lập MỘT occurrence Factory mà KHÔNG rút lui định nghĩa dùng chung
   * (bản gốc: FactoryErrorBoundary).
   */
  class FactoryErrorBoundary extends Component {
    /** State khởi tạo: chưa hỏng. */
    override state: Record<string, unknown> = { failed: false };

    /**
     * Bắt lỗi render của con.
     * Nhận: error — lỗi.
     * Trả: state mới, hoặc NÉM LẠI khi là lỗi lắp ráp.
     */
    static getDerivedStateFromError(error: unknown): Record<string, unknown> {
      if (error instanceof SlotAssemblyError) throw error;
      return { failed: true };
    }

    /**
     * Báo lỗi đã bắt.
     * Nhận: error — lỗi.
     * Trả: không.
     */
    componentDidCatch(error: unknown): void {
      const props = this.props as unknown as FactoryErrorBoundaryProps;
      console.error("slot factory occurrence crashed in '" + props.name + "':", error);
      props.onEntryError(error);
    }

    /**
     * Vẽ con, hoặc mỏ neo đánh dấu occurrence đã chết.
     * Nhận: không.
     * Trả: cây React.
     */
    override render(): unknown {
      const props = this.props as unknown as FactoryErrorBoundaryProps;
      if (this.state["failed"] === true) return jsx("div", { "data-factory-error": props.name });
      return props.children;
    }
  }
  //#endregion

  //#region chuẩn hoá binding chuẩn + kit (bản gốc: dòng 663–767)
  /** Cache binding GỐC đã vật chất hoá (bản gốc: rootStandardCache). */
  const rootStandardCache = new WeakMap<object, Record<string, unknown>>();
  /** Cache binding PHIÊN đã vật chất hoá (bản gốc: sessionStandardCache). */
  const sessionStandardCache = new WeakMap<object, WeakMap<object, Record<string, unknown>>>();
  /** Cache binding PHIÊN TUỲ CHỌN đã vật chất hoá (bản gốc: sessionMaybeStandardCache). */
  const sessionMaybeStandardCache = new WeakMap<object, WeakMap<object, Record<string, unknown>>>();

  /**
   * Vật chất hoá MỘT binding thành ghế hook + prop tĩnh ỔN ĐỊNH (bản gốc: materializeStandardBinding).
   *
   * Nhận: binding — binding nguồn; optional — binding tuỳ chọn chấp nhận nguồn vắng; defaultKey — khoá
   * mặc định cho họ nguồn theo khoá.
   * Trả: bảng prop chuẩn (use<Name>).
   * @throws {SlotAssemblyError} khi hook nghiêm ngặt không có nguồn.
   */
  function materializeStandardBinding(binding: StandardSourceBinding, optional: boolean, defaultKey?: string): Record<string, unknown> {
    const standard: Record<string, unknown> = { ...binding.props };
    for (const [name, source] of Object.entries(binding.hooks)) {
      if (source === undefined && !optional) throw new SlotAssemblyError("strict standard hook '" + name + "' has no source");
      standard[standardHookPropName(name)] = optional
        ? maybeObservableHook(source as HostObservable<unknown> | undefined)
        : observableHook(source as HostObservable<unknown>);
    }
    for (const [name, source] of Object.entries(binding.keyedHooks)) {
      if (source === undefined && !optional) throw new SlotAssemblyError("strict keyed standard hook '" + name + "' has no source resolver");
      standard[standardHookPropName(name)] = keyedObservableHook(source as KeyedStandardSource | undefined, defaultKey);
    }
    return standard;
  }

  /**
   * Prop chuẩn chính thức của một scope, cache theo (binding gốc × binding scope)
   * (bản gốc: standardProps).
   *
   * Nhận: scope — phạm vi dữ liệu; rootBinding — binding gốc; scopeBinding — binding phiên (có thể vắng).
   * Trả: bảng prop chuẩn.
   * @throws {SlotAssemblyError} khi scope cần binding mà không có.
   */
  function standardProps(
    scope: "root" | "session" | "session-maybe",
    rootBinding: StandardSourceBinding,
    scopeBinding: StandardSourceBinding | undefined,
  ): Record<string, unknown> {
    let root = rootStandardCache.get(rootBinding as unknown as object);
    if (root === undefined) {
      root = materializeStandardBinding(rootBinding, false);
      rootStandardCache.set(rootBinding as unknown as object, root);
    }
    if (scope === "root") return root;
    if (scopeBinding === undefined) throw new SlotAssemblyError("scope '" + scope + "' rendered without a standard-source binding");
    const cache = scope === "session" ? sessionStandardCache : sessionMaybeStandardCache;
    let perScope = cache.get(rootBinding as unknown as object);
    if (perScope === undefined) {
      perScope = new WeakMap<object, Record<string, unknown>>();
      cache.set(rootBinding as unknown as object, perScope);
    }
    let standard = perScope.get(scopeBinding as unknown as object);
    if (standard !== undefined) return standard;
    standard = {
      ...materializeStandardBinding(rootBinding, false, scopeBinding.key),
      ...materializeStandardBinding(scopeBinding, scope === "session-maybe"),
    };
    perScope.set(scopeBinding as unknown as object, standard);
    return standard;
  }

  /** Cache provider vùng của một adapter scope (bản gốc: scopeAreaCache). */
  const scopeAreaCache = new WeakMap<object, unknown>();

  /**
   * Bind bộ vẽ vùng của MỘT scope vào binding scope hiện tại (bản gốc: scopeAreaProvider).
   *
   * Nhận: adapter — bộ chuyển scope đã cài.
   * Trả: component ScopeAreaProvider ổn định danh tính theo adapter.
   * @throws {SlotAssemblyError} khi adapter không có renderArea.
   */
  function scopeAreaProvider(adapter: SlotScopeAdapter): unknown {
    let Provider = scopeAreaCache.get(adapter as unknown as object);
    if (Provider !== undefined) return Provider;
    if (adapter.renderArea === undefined) throw new SlotAssemblyError("scope 'session' adapter does not provide its area renderer");
    const renderArea = adapter.renderArea.bind(adapter);
    /**
     * Vùng của scope: chọn binding theo props.session nếu chủ gọi khai tường minh, hoặc kế thừa.
     * Nhận: props — prop của vùng (có thể có session).
     * Trả: element provider.
     */
    Provider = function ScopeAreaProvider(props: Record<string, unknown>): unknown {
      const inherited = useScopeBinding();
      const explicit = Object.hasOwn(props, "session");
      const source = adapter.bindingSource(props["session"]);
      const resolved = runtime.hooks.useSyncExternalStore(
        (listener) => source.subscribe(listener),
        () => source.getSnapshot(),
        () => source.getSnapshot(),
      );
      const binding = explicit ? resolved : inherited;
      return jsx(ScopeBindingProvider as unknown as unknown, { binding, children: renderArea(binding, props) });
    };
    scopeAreaCache.set(adapter as unknown as object, Provider);
    return Provider;
  }

  /**
   * Tổng hợp "kit chuẩn" cho cả hai nhánh scope (bản gốc: standardKit).
   *
   * Kit gồm: các hook chuẩn toàn cục, bó provide của phiên (mỗi nguồn hooks thành hook chọn use<Name>,
   * props rải nguyên văn), cặp store khi có khai, binding renderSlot khi mục khai con, và ghế
   * SessionProvider khi con khai scope phiên.
   *
   * Host trao nguồn observable TRẦN (hook không bao giờ qua hợp đồng host); mọi hook được bind Ở ĐÂY,
   * cache theo nguồn (observableHook), nên rải kit mới mỗi lần render không làm con đăng ký lại.
   *
   * Nhận: host — face host; entry — mục; scope — phạm vi; rootBinding/scopeBinding — binding.
   * Trả: { kit, standard, actions }.
   * @throws {SlotAssemblyError} khi mục khai locale/con phiên mà thiếu face/adapter.
   */
  function standardKit(
    host: SlotRendererHost,
    entry: StoredEntry,
    scope: "root" | "session" | "session-maybe",
    rootBinding: StandardSourceBinding,
    scopeBinding: StandardSourceBinding | undefined,
  ): { kit: Record<string, unknown>; standard: Record<string, unknown>; actions: unknown } {
    const standard = standardProps(scope, rootBinding, scopeBinding);
    const kit: Record<string, unknown> = { ...standard, renderFactorySlot: boundRenderFactorySlot(entry) };
    if (entry.locale !== undefined) {
      const face = host.locale;
      if (face === undefined) {
        throw new SlotAssemblyError(
          "entry declares locale namespace '" + entry.locale + "' but no locale face is installed (locale plugin missing from the composition?)",
        );
      }
      kit["t"] = localeSeat(face, entry.locale);
    }
    const scopedStoreBinding = scopeBinding?.key === undefined ? undefined : scopeBinding;
    const store = host.storeOf(entry, scopedStoreBinding);
    if (store !== undefined) {
      kit["useStore"] = observableHook(store);
      kit["actions"] = store.actions;
    }
    if (entry.children !== undefined) {
      kit["renderSlot"] = boundRenderSlot(host, entry);
      if (Object.values(entry.children).some((spec) => spec.kind === "chain")) kit["renderSlotChain"] = boundRenderSlotChain(host, entry);
      if (Object.values(entry.children).some((spec) => spec.scope !== "root")) {
        const adapter = host.scope("session");
        if (adapter === undefined) throw new SlotAssemblyError("entry declares a session child without an installed 'session' scope adapter");
        kit["SessionProvider"] = scopeAreaProvider(adapter);
      }
    }
    return { kit, standard, actions: store?.actions };
  }
  //#endregion

  //#region chỗ ngồi (bản gốc: dòng 768–1109)
  /** Props của một chỗ ngồi đã có kit + inject. */
  interface RenderEntryProps {
    /** Khoá slot đang render. */
    slotKey: string;
    /** Component của mục. */
    Comp: unknown;
    /** Kit chuẩn. */
    kit: Record<string, unknown>;
    /** Prop chuẩn (dùng cho factory hook). */
    standard: Record<string, unknown>;
    /** Prop inject của mục. */
    injected: Record<string, unknown>;
    /** Face inject của slot. */
    slotInjected: SlotInjected;
    /** Phần prop của chủ sở hữu ô. */
    ownerProps: Record<string, unknown>;
    /** Context hook. */
    hookContext: unknown;
    /** Có hookContext hay không. */
    hasHookContext: boolean;
  }

  /**
   * Chỗ ngồi có factory hook theo hookContext (bản gốc: ContextualEntry).
   * Nhận: props của chỗ ngồi.
   * Trả: element component.
   * @throws {SlotAssemblyError} khi có factory hook mà không có hookContext.
   */
  function ContextualEntry(props: RenderEntryProps): unknown {
    const { slotKey, Comp, kit, standard, injected, slotInjected, ownerProps, hookContext, hasHookContext } = props;
    const factories = slotInjected.slotHookFactories;
    const contextual = useMemo(() => {
      if (!hasHookContext) throw new SlotAssemblyError("slot '" + slotKey + "' has contextual injected Hooks but no hookContext");
      return bindSlotHookFactories(factories ?? {}, standard, hookContext);
    }, [hasHookContext, hookContext, factories, slotKey, standard]);
    return jsx(Comp, { ...kit, ...injected, ...slotInjected.props, ...contextual, ...ownerProps });
  }

  /**
   * Vẽ một chỗ ngồi, có hoặc không có factory hook (bản gốc: renderEntry).
   * Nhận: các phần của chỗ ngồi.
   * Trả: cây React.
   */
  function renderEntry(
    slotKey: string,
    Comp: unknown,
    kit: Record<string, unknown>,
    standard: Record<string, unknown>,
    injected: Record<string, unknown>,
    slotInjected: SlotInjected,
    ownerProps: Record<string, unknown>,
    hookContext: unknown,
    hasHookContext: boolean,
  ): unknown {
    if (slotInjected.slotHookFactories === undefined) {
      return jsx(Comp, { ...kit, ...injected, ...slotInjected.props, ...ownerProps });
    }
    return jsx(ContextualEntry, { slotKey, Comp, kit, standard, injected, slotInjected, ownerProps, hookContext, hasHookContext });
  }

  /**
   * Chỗ ngồi scope PHIÊN (đã có binding nghiêm ngặt) (bản gốc: SessionEntry).
   * Nhận: props + binding. Trả: cây React.
   */
  function SessionEntry(props: EntryRenderProps & { binding: StandardSourceBinding }): unknown {
    const host = useHost();
    const rootBinding = useRootBinding();
    const Comp = props.entry.component;
    const { kit, standard, actions } = standardKit(host, props.entry, "session", rootBinding, props.binding);
    return renderEntry(
      props.slotKey,
      Comp,
      kit,
      standard,
      cachedSessionInject(props.entry, props.binding, actions),
      props.slotInjected,
      props.ownerProps,
      props.hookContext,
      props.hasHookContext,
    );
  }

  /**
   * Thân chỗ ngồi scope PHIÊN TUỲ CHỌN (bản gốc: SessionMaybeEntryBody).
   * Nhận: props + binding. Trả: cây React.
   */
  function SessionMaybeEntryBody(props: EntryRenderProps & { binding: StandardSourceBinding }): unknown {
    const host = useHost();
    const rootBinding = useRootBinding();
    const Comp = props.entry.component;
    const { kit, standard, actions } = standardKit(host, props.entry, "session-maybe", rootBinding, props.binding);
    return renderEntry(
      props.slotKey,
      Comp,
      kit,
      standard,
      cachedSessionMaybeInject(props.entry, props.binding, actions),
      props.slotInjected,
      props.ownerProps,
      props.hookContext,
      props.hasHookContext,
    );
  }

  /** State khởi tạo của incarnation (bản gốc: FIRST_INCARNATION). */
  const FIRST_INCARNATION = { adopted: undefined as unknown, epoch: 0 };

  /**
   * Danh tính scope PHIÊN TUỲ CHỌN — "adopt" là hành vi DUY NHẤT (bản gốc: useMaybeIncarnation).
   *
   * Một incarnation sinh ra KHÔNG có phiên sẽ ADOPT phiên đầu tiên tới: danh tính giữ qua đúng một lần
   * chuyển (undefined → id đầu), nên DOM của vỏ trống sống qua khoảnh khắc phiên xuất hiện. Từ đó mục
   * hành xử y như mục phiên nghiêm ngặt: đổi sang phiên KHÁC thì remount (state cục bộ không rò giữa
   * phiên), rơi về không-phiên thì remount thành incarnation trống mới (lại adopt).
   *
   * Nhận: binding — binding scope hiện tại.
   * Trả: số thế hệ (epoch) làm React key.
   */
  function useMaybeIncarnation(binding: StandardSourceBinding): number {
    const identity = binding.key === undefined ? undefined : binding.ctx;
    const [state, setState] = useState(FIRST_INCARNATION);
    let { adopted, epoch } = state;
    if (identity !== undefined && adopted === undefined) {
      adopted = identity;
      setState({ adopted, epoch });
    } else if (adopted !== undefined && identity !== undefined && identity !== adopted) {
      adopted = identity;
      epoch += 1;
      setState({ adopted, epoch });
    } else if (adopted !== undefined && identity === undefined) {
      adopted = undefined;
      epoch += 1;
      setState({ adopted, epoch });
    }
    return epoch;
  }

  /**
   * Chỗ ngồi scope PHIÊN TUỲ CHỌN (bản gốc: SessionMaybeEntry).
   * Nhận: props. Trả: cây React (key = thế hệ).
   */
  function SessionMaybeEntry(props: EntryRenderProps): unknown {
    const binding = useScopeBinding();
    const epoch = useMaybeIncarnation(binding);
    return jsx(SessionMaybeEntryBody, { ...props, binding }, epoch);
  }

  /**
   * Chỗ ngồi scope GỐC (bản gốc: RootEntry).
   * Nhận: props. Trả: cây React.
   */
  function RootEntry(props: EntryRenderProps): unknown {
    const host = useHost();
    const rootBinding = useRootBinding();
    const Comp = props.entry.component;
    const { kit, standard, actions } = standardKit(host, props.entry, "root", rootBinding, undefined);
    return renderEntry(
      props.slotKey,
      Comp,
      kit,
      standard,
      cachedRootInject(props.entry, actions),
      props.slotInjected,
      props.ownerProps,
      props.hookContext,
      props.hasHookContext,
    );
  }

  /**
   * Chỗ ngồi scope PHIÊN NGHIÊM NGẶT — ném nếu thiếu binding, key theo thế hệ phiên
   * (bản gốc: StrictSessionEntry).
   * Nhận: props. Trả: cây React.
   * @throws {SlotAssemblyError} khi slot phiên nghiêm ngặt render mà không có binding.
   */
  function StrictSessionEntry(props: StrictEntryProps): unknown {
    const binding = useScopeBinding();
    if (binding.key === undefined) throw new SlotAssemblyError("strict session slot '" + props.slotKey + "' rendered without a scope binding");
    const scopedBinding = binding;
    return jsx(
      SlotErrorBoundary,
      {
        slotKey: props.slotKey,
        anchor: props.anchor,
        onEntryError: props.onEntryError,
        children: jsx(SessionEntry, {
          entry: props.entry,
          ownerProps: props.ownerProps,
          slotKey: props.slotKey,
          slotInjected: props.slotInjected,
          hookContext: props.hookContext,
          hasHookContext: props.hasHookContext,
          binding: scopedBinding,
        }),
      },
      sessionGenerationKeyOf(scopedBinding),
    );
  }

  /** Cache binding renderFactorySlot theo caller (bản gốc: factoryRenderCache). */
  const factoryRenderCache = new WeakMap<object, RenderFactorySlot>();

  /**
   * Binding renderFactorySlot ổn định danh tính theo caller (bản gốc: boundRenderFactorySlot).
   *
   * Nhận: caller — mục/định nghĩa Factory đóng vai chủ.
   * Trả: hàm render Factory ổn định danh tính.
   */
  function boundRenderFactorySlot(caller: unknown): RenderFactorySlot {
    let render = factoryRenderCache.get(caller as object);
    if (render !== undefined) return render;
    render = (name, props, options) =>
      jsx(FactoryOutletRef.current, { name, inputProps: props, slots: options?.slots, fallback: options?.fallback, caller });
    factoryRenderCache.set(caller as object, render);
    return render;
  }
  //#endregion

  return {
    cachedSlotInject,
    emptySlotInject: EMPTY_SLOT_INJECT,
    entryKeyOf,
    sessionGenerationKeyOf,
    useLocaleRevision,
    useMaybeIncarnation,
    standardKit,
    runInject,
    localeSeat,
    standardProps,
    boundRenderFactorySlot,
    runFactoryInject,
    scopeAreaProvider,
    SlotErrorBoundary: SlotErrorBoundary as unknown as new (props: Record<string, unknown>) => unknown,
    FactoryErrorBoundary: FactoryErrorBoundary as unknown as new (props: Record<string, unknown>) => unknown,
    renderEntry,
    StrictSessionEntry,
    SessionMaybeEntry,
    RootEntry,
    SessionEntry,
  };
}

export { FactoryOutletRef, SlotOutletRef } from "./refs.ts";