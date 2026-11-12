/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Port 1:1 binding React noi bo (bundle goc dong 168-315): host context - binding theo scope - hook chon
 */
import { createBindSnapshotSelector, type ReactModule } from "./bind.ts";
import { SlotAssemblyError } from "./errors.ts";
import type {
  HostObservable,
  KeyedStandardSource,
  MaybeSnapshotSelectorHook,
  SlotRendererHost,
  SnapshotSelectorHook,
  StandardSourceBinding,
} from "./slots-api.ts";

/** Bảng hook + jsx React lấy từ bảng module của trang (không import tĩnh — xem `bind.ts`). */
export interface BindingsRuntime {
  /** Module `react` của trang (hook + createContext/useContext + Component). */
  hooks: ReactModule;
  /** Hàm dựng element (`react/jsx-runtime`). */
  jsx: {
    /** Dựng phần tử có một con. */
    jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
    /** Dựng phần tử có nhiều con. */
    jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  };
}

/** Context React đã tạo (giữ cả `.Provider` — React 18 KHÔNG nhận chính context làm kiểu element). */
export interface RendererContext<T> {
  /** Provider của context (React 18 bắt buộc dùng `.Provider`, KHÔNG dùng chính context làm kiểu element). */
  readonly Provider: unknown;
  /** Giá trị mặc định (chỉ để giữ tham số kiểu). */
  readonly _defaultValue?: T;
}

/** Hook chọn theo khoá mở; tham số thứ hai dạng chuỗi là TÊN THÀNH VIÊN (không kèm selector). */
export type KeyedSnapshotHook = (
  keyOrSelector: string | ((value: unknown) => unknown),
  memberOrSelectorOrEqual?:
    | string
    | ((value: unknown) => unknown)
    | ((left: unknown, right: unknown) => boolean),
  equal?: (left: unknown, right: unknown) => boolean,
) => unknown;

/** Bộ binding React của tầng renderer (bề mặt nội bộ — dùng bởi scoped-slots). */
export interface RendererBindings {
  /** Context host nội bộ (chỉ dùng trong package). */
  HostContext: RendererContext<SlotRendererHost | null>;
  /** Context binding gốc. */
  RootBindingContext: RendererContext<StandardSourceBinding | null>;
  /** Context binding scope. */
  ScopeBindingContext: RendererContext<StandardSourceBinding | null>;
  /** Đọc host đã cài; ném lỗi khi component nằm ngoài cây renderer. */
  useHost(): SlotRendererHost;
  /** Đọc binding gốc. */
  useRootBinding(): StandardSourceBinding;
  /** Đọc binding scope hiện tại (có thể vắng khoá). */
  useScopeBinding(): StandardSourceBinding;
  /** Provider công bố một binding scope cho cây con. */
  ScopeBindingProvider(props: { binding: StandardSourceBinding; children: unknown }): unknown;
  /** Nối một nguồn thành hook chọn (cache theo nguồn). */
  observableHook<T>(source: HostObservable<T>): SnapshotSelectorHook<T>;
  /** Nối một nguồn CÓ THỂ vắng (không đổi thứ tự hook). */
  maybeObservableHook<T>(source: HostObservable<T> | undefined): MaybeSnapshotSelectorHook<T>;
  /** Nối một họ nguồn theo khoá. */
  keyedObservableHook(source: KeyedStandardSource | undefined, defaultKey?: string): KeyedSnapshotHook;
  /** Provider theo dõi roster binding gốc. */
  RootStandardProvider(props: { children: unknown }): unknown;
  /** Provider theo dõi roster scope rồi bind bộ chuyển hiện tại. */
  ScopeProvider(props: { scope: "session" | "session-maybe"; children: unknown }): unknown;
}

/**
 * Dựng bộ binding React của tầng renderer (port 1:1 vùng `bindings.js` của bundle gốc).
 *
 * Nhận: `runtime` — hook React + jsx lấy từ bảng module của trang.
 * Trả: bộ binding (đúng bề mặt bản gốc dùng nội bộ).
 */
export function createBindings(runtime: BindingsRuntime): RendererBindings {
  const hooks = runtime.hooks;
  const createContext = hooks.createContext as <T>(initial: T) => RendererContext<T>;
  const useContext = hooks.useContext as <T>(context: RendererContext<T>) => T;
  const { jsx } = runtime.jsx;
  const bindSnapshotSelector = createBindSnapshotSelector(runtime.hooks);

  /** Context host nội bộ (bản gốc: `HostContext = createContext(null)`). */
  const HostContext = createContext<SlotRendererHost | null>(null);
  /** Context binding GỐC. */
  const RootBindingContext = createContext<StandardSourceBinding | null>(null);
  /** Context binding SCOPE. */
  const ScopeBindingContext = createContext<StandardSourceBinding | null>(null);

  /**
   * Đọc host đã cài.
   * Nhận: không.
   * Trả: bề mặt host.
   * @throws {SlotAssemblyError} khi cây component nằm ngoài renderer đã cài.
   */
  function useHost(): SlotRendererHost {
    const host = useContext<SlotRendererHost | null>(HostContext);
    if (host === null) throw new SlotAssemblyError("slot machinery rendered outside the installed renderer tree");
    return host;
  }

  /**
   * Đọc binding nguồn chuẩn GỐC.
   * Nhận: không.
   * Trả: binding gốc.
   * @throws {SlotAssemblyError} khi thiếu provider gốc.
   */
  function useRootBinding(): StandardSourceBinding {
    const binding = useContext<StandardSourceBinding | null>(RootBindingContext);
    if (binding === null) throw new SlotAssemblyError("slot rendered outside the root standard-source provider");
    return binding;
  }

  /**
   * Đọc binding scope hiện tại (khoá vắng khi chưa chọn phiên).
   * Nhận: không.
   * Trả: binding scope.
   * @throws {SlotAssemblyError} khi thiếu provider scope.
   */
  function useScopeBinding(): StandardSourceBinding {
    const binding = useContext<StandardSourceBinding | null>(ScopeBindingContext);
    if (binding === null) throw new SlotAssemblyError("scoped slot rendered outside its scope provider");
    return binding;
  }

  /**
   * Công bố một binding scope cho cây con.
   * Nhận: `props.binding` — binding, `props.children` — cây con.
   * Trả: element provider.
   */
  function ScopeBindingProvider(props: { binding: StandardSourceBinding; children: unknown }): unknown {
    return jsx(ScopeBindingContext.Provider, { value: props.binding, children: props.children });
  }

  /** Cache hook theo nguồn (WeakMap ⇒ nguồn chết thì cache chết theo) — bản gốc: `hookCache`. */
  const hookCache = new WeakMap<object, SnapshotSelectorHook<unknown>>();
  /** Nguồn "vắng" dùng chung — bản gốc: `absentSource`. */
  const absentSource: HostObservable<undefined> = {
    getSnapshot: () => undefined,
    subscribe: () => () => undefined,
  };

  /**
   * Nối một nguồn thành hook chọn, cache theo DANH TÍNH nguồn.
   * Nhận: `source` — nguồn observable.
   * Trả: hook chọn (ổn định danh tính theo nguồn).
   */
  function observableHook<T>(source: HostObservable<T>): SnapshotSelectorHook<T> {
    let hook = hookCache.get(source as unknown as object) as SnapshotSelectorHook<T> | undefined;
    if (hook === undefined) {
      hook = bindSnapshotSelector(source);
      hookCache.set(source as unknown as object, hook as SnapshotSelectorHook<unknown>);
    }
    return hook;
  }

  /**
   * Hook cho nguồn VẮNG — luôn trả undefined mà KHÔNG đổi thứ tự hook.
   * Nhận: `_selector`/`_equal` — bị bỏ qua (bản gốc cũng bỏ qua).
   * Trả: undefined.
   */
  function useAbsentSnapshot<S>(_selector?: (value: undefined) => S, _equal?: (left: S, right: S) => boolean): S {
    observableHook(absentSource)(() => undefined);
    return undefined as unknown as S;
  }

  /**
   * Nối một nguồn CÓ THỂ vắng mà không đổi thứ tự hook (bản gốc: `maybeObservableHook`).
   * Nhận: `source` — nguồn, hoặc vắng.
   * Trả: hook chọn trả `undefined` khi vắng.
   */
  function maybeObservableHook<T>(source: HostObservable<T> | undefined): MaybeSnapshotSelectorHook<T> {
    if (source !== undefined) return observableHook(source) as MaybeSnapshotSelectorHook<T>;
    return useAbsentSnapshot as MaybeSnapshotSelectorHook<T>;
  }

  /**
   * Đọc ba dạng gọi của hook theo khoá: `(key, member)`, `(key, selector?, equal?)`, `(selector, equal?)`.
   * Nhận: `defaultKey` — khoá mặc định (hoặc vắng), ba tham số gọi.
   * Trả: bộ `{ key, member, selector, equal }` đã chuẩn hoá.
   */
  function keyedHookCall(
    defaultKey: string | undefined,
    keyOrSelector: string | ((value: unknown) => unknown),
    second?: string | ((value: unknown) => unknown) | ((left: unknown, right: unknown) => boolean),
    equal?: (left: unknown, right: unknown) => boolean,
  ): {
    key: string | undefined;
    member: string | undefined;
    selector: ((value: unknown) => unknown) | undefined;
    equal: ((left: unknown, right: unknown) => boolean) | undefined;
  } {
    if (typeof keyOrSelector !== "string") {
      return { key: defaultKey, member: undefined, selector: keyOrSelector, equal: second as ((left: unknown, right: unknown) => boolean) | undefined };
    }
    if (typeof second === "string") return { key: keyOrSelector, member: second, selector: undefined, equal: undefined };
    return { key: keyOrSelector, member: undefined, selector: second as ((value: unknown) => unknown) | undefined, equal };
  }

  /** Khoá cache cho hook KHÔNG có default key. */
  const NO_DEFAULT_KEY = Symbol("no default key");
  /** Cache hook theo (nguồn, default key) — bản gốc: `keyedHookCache`. */
  const keyedHookCache = new WeakMap<object, Map<unknown, KeyedSnapshotHook>>();
  /** Selector mặc định: giữ nguyên giá trị. */
  const identity = (value: unknown): unknown => value;

  /** Hook khi KHÔNG có họ nguồn theo khoá (scope vắng) — bản gốc: `absentKeyedHook`. */
  const absentKeyedHook: KeyedSnapshotHook = (keyOrSelector, second, equal) => {
    const call = keyedHookCall(undefined, keyOrSelector, second, equal);
    return observableHook(absentSource)((call.selector ?? identity) as (value: undefined) => unknown, call.equal as ((left: unknown, right: unknown) => boolean) | undefined);
  };

  /**
   * Nối một họ nguồn theo khoá thành hook (cache theo nguồn + default key).
   * Nhận: `source` — bộ phân giải theo khoá (hoặc vắng cho scope tuỳ chọn), `defaultKey` — khoá mặc định.
   * Trả: hook chọn theo khoá.
   */
  function keyedObservableHook(source: KeyedStandardSource | undefined, defaultKey?: string): KeyedSnapshotHook {
    if (source === undefined) return absentKeyedHook;
    let hooks = keyedHookCache.get(source as unknown as object);
    if (hooks === undefined) {
      hooks = new Map<unknown, KeyedSnapshotHook>();
      keyedHookCache.set(source as unknown as object, hooks);
    }
    const cacheKey = defaultKey ?? NO_DEFAULT_KEY;
    let hook = hooks.get(cacheKey);
    if (hook === undefined) {
      hook = (keyOrSelector, second, equal) => {
        const call = keyedHookCall(defaultKey, keyOrSelector, second, equal);
        const resolved =
          call.key === undefined ? undefined : call.member === undefined ? source(call.key) : source(call.key, call.member);
        return observableHook((resolved ?? absentSource) as HostObservable<unknown>)(
          (call.selector ?? identity) as (value: unknown) => unknown,
          call.equal as ((left: unknown, right: unknown) => boolean) | undefined,
        );
      };
      hooks.set(cacheKey, hook);
    }
    return hook;
  }

  /**
   * Provider theo dõi roster binding chuẩn GỐC và công bố nó cho cây con.
   * Nhận: `props.children` — cây con.
   * Trả: element provider.
   */
  function RootStandardProvider(props: { children: unknown }): unknown {
    const binding = observableHook(useHost().root)((value: StandardSourceBinding) => value);
    return jsx(RootBindingContext.Provider, { value: binding, children: props.children });
  }

  /**
   * Provider theo dõi roster scope rồi bind bộ chuyển hiện tại của scope đó.
   * Nhận: `props.scope` — tên scope, `props.children` — cây con.
   * Trả: element provider.
   * @throws {SlotAssemblyError} khi scope chưa được cài bộ chuyển.
   */
  function ScopeProvider(props: { scope: "session" | "session-maybe"; children: unknown }): unknown {
    const host = useHost();
    observableHook(host.scopeRevision)((value: number) => value);
    const adapter = host.scope(props.scope);
    if (adapter === undefined) throw new SlotAssemblyError(`scope '${props.scope}' rendered without an installed adapter`);
    const binding = observableHook(adapter.current)((value: StandardSourceBinding) => value);
    return jsx(ScopeBindingContext.Provider, { value: binding, children: props.children });
  }

  return {
    HostContext,
    RootBindingContext,
    ScopeBindingContext,
    useHost,
    useRootBinding,
    useScopeBinding,
    ScopeBindingProvider,
    observableHook,
    maybeObservableHook,
    keyedObservableHook,
    RootStandardProvider,
    ScopeProvider,
  };
}
/** Runtime đầy đủ của nửa client: module react + jsx runtime + module ui-slots của trang. */
export interface RendererRuntime extends BindingsRuntime {
  /** Module `@galaxy-blackhole/gbh-client-ui-slots` (core thuần + lỗi + tên prop hook chuẩn). */
  slotsApi: import("./slots-api.ts").SlotsApi;
}
