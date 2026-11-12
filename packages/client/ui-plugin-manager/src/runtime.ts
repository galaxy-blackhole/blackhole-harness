/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bảng module mà nửa browser nhận qua `require` của loader (KHÔNG import tĩnh) + kiểu runtime tối thiểu
 *      cho các cụm file của trang Plugins. Đây là HỢP ĐỒNG giữa các cụm (store/ledger · trang · wiring).
 */

/** Hàm `require` do bảng module của loader cấp cho factory (gọi lúc vạt chất hoá). */
export type RuntimeRequire = (specifier: string) => unknown;

/** Hook React tối thiểu mà trang/store dùng (phần còn lại truy cập qua chỉ mục). */
export interface RuntimeReact {
  /** Ô trạng thái cục bộ. */
  useState<S>(initial: S | (() => S)): [S, (next: S | ((current: S) => S)) => void];
  /** Tham chiếu bền qua các lượt render. */
  useRef<T>(initial: T): { current: T };
  /** Hiệu ứng sau commit; trả hàm dọn. */
  useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  /** Hiệu ứng trước khi vẽ. */
  useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  /** Ghi nhớ giá trị dẫn xuất. */
  useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  /** Ghi nhớ callback. */
  useCallback<T>(callback: T, deps: readonly unknown[]): T;
  /** Đọc store ngoài React (subscribe/getSnapshot). */
  useSyncExternalStore<T>(subscribe: (listener: () => void) => () => void, getSnapshot: () => T): T;
  /** Mọi hook khác của React 18 (useReducer, useId, …) — truy cập động. */
  readonly [hook: string]: unknown;
}

/** Hàm dựng element (react/jsx-runtime). */
export type RuntimeJsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown) => unknown;

/**
 * Bảng module của nửa browser. Mỗi cụm tự khai `interface` HẸP cho phần mình dùng rồi ép kiểu từ đây
 * (bảng là ĐỘNG: loader cấp theo id package, không import tĩnh được).
 */
export interface PluginManagerModules {
  /** `react` (hook). */
  readonly react: RuntimeReact;
  /** `react/jsx-runtime` (`jsx`, `jsxs`, `Fragment`). */
  readonly jsxRuntime: { readonly jsx: RuntimeJsx; readonly jsxs: RuntimeJsx; readonly Fragment: unknown };
  /** `react-dom` (`createPortal`). */
  readonly reactDom: { readonly createPortal: (children: unknown, container: unknown) => unknown };
  /** `@galaxy-blackhole/gbh-client-store` (`defineStore`). */
  readonly store: Record<string, unknown>;
  /** `@galaxy-blackhole/gbh-client-ui-slots` (`useSlot`, `useSlotEntries`, …). */
  readonly slots: Record<string, unknown>;
  /** `@galaxy-blackhole/gbh-client-ui-primitives` (icon, Button, Tooltip, StateDot, Tag, …). */
  readonly primitives: Record<string, unknown>;
  /** `@deepseek-ai/dsh-api-remotes` (`Remote`/kiểu). */
  readonly remotes: Record<string, unknown>;
  /** `@deepseek-ai/dsh-client-ui-settings` (khung cài đặt). */
  readonly settings: Record<string, unknown>;
  /** `@deepseek-ai/dsh-client-ui-layout` (panel/layout). */
  readonly layout: Record<string, unknown>;
  /** `@deepseek-ai/dsh-package-manifest` (phân tích spec gói). */
  readonly packageManifest: Record<string, unknown>;
  /** `zod` (kiểm dữ liệu form cài đặt). */
  readonly zod: Record<string, unknown>;
}

/**
 * Khoá KHÔNG được `require` cứng: bản gốc dùng chúng qua service/kiểu, không qua bảng module.
 * Nạp cứng ⇒ loader ném `require(...) missed the module table` ⇒ row chết (sự cố thật 19/10/2026, #root 871).
 */
export const OPTIONAL_KEYS = ["remotes", "settings", "layout", "packageManifest", "zod"] as const;

/** Khoá module trong bảng — dùng để `require` đúng id một lần ở `client.ts`. */
export const MODULE_IDS = {
  /** `react`. */
  react: "react",
  /** `react/jsx-runtime`. */
  jsxRuntime: "react/jsx-runtime",
  /** `react-dom`. */
  reactDom: "react-dom",
  /** Sổ store của client. */
  store: "@galaxy-blackhole/gbh-client-store",
  /** Sổ slot của client. */
  slots: "@galaxy-blackhole/gbh-client-ui-slots",
  /** Primitive giao diện. */
  primitives: "@galaxy-blackhole/gbh-client-ui-primitives",
  /** Kênh Remote. */
  // ⚠️ 19/10/2026 — BẢN GỐC KHÔNG require hai id dưới đây ở factory scope (chỉ dùng kiểu/service).
  //   Đưa vào MODULE_IDS làm loader ném "require(...) missed the module table" ⇒ row chết, #root 871.
  //   Giữ tên để tài liệu hoá, nhưng loadModules KHÔNG nạp cứng (xem OPTIONAL_KEYS).
  remotes: "@deepseek-ai/dsh-api-remotes",
  /** Khung cài đặt. */
  settings: "@deepseek-ai/dsh-client-ui-settings",
  /** Bố cục/panel. */
  layout: "@deepseek-ai/dsh-client-ui-layout",
  /** Phân tích manifest gói. */
  packageManifest: "@deepseek-ai/dsh-package-manifest",
  /** Kiểm dữ liệu. */
  zod: "zod",
} as const;

/**
 * Nạp bảng module từ `require` của loader (một lần, ở `client.ts`).
 * Nhận: requireFn — hàm require của loader.
 * Trả: bảng module đã ép kiểu theo {@link PluginManagerModules}.
 */
export function loadModules(requireFn: RuntimeRequire): PluginManagerModules {
  // Nạp CỨNG đúng những id bản gốc require; các khoá "tuỳ chọn" thì thử — thiếu chỉ trả {} (không ném),
  // đúng hành vi bản gốc vốn không require chúng ở factory scope.
  const read = (key: keyof typeof MODULE_IDS): Record<string, unknown> => requireFn(MODULE_IDS[key]) as Record<string, unknown>;
  const readOptional = (key: keyof typeof MODULE_IDS): Record<string, unknown> => {
    try {
      return requireFn(MODULE_IDS[key]) as Record<string, unknown>;
    } catch {
      return {};
    }
  };
  return {
    react: requireFn(MODULE_IDS.react) as RuntimeReact,
    jsxRuntime: requireFn(MODULE_IDS.jsxRuntime) as PluginManagerModules["jsxRuntime"],
    reactDom: requireFn(MODULE_IDS.reactDom) as PluginManagerModules["reactDom"],
    store: read("store"),
    slots: read("slots"),
    primitives: read("primitives"),
    remotes: readOptional("remotes"),
    settings: readOptional("settings"),
    layout: readOptional("layout"),
    packageManifest: readOptional("packageManifest"),
    zod: readOptional("zod"),
  };
}