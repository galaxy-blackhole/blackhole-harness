/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hinh dang module va seam ma row ui-sidebar-browser dung (jsx runtime, react, store, slots, locale, sidebar phai)
 */

import type { BrowserTabState } from "./persistence.ts";

/** Ham dung phan tu cua jsx runtime. */
export interface JsxRuntimeLike {
  /** Mot phan tu con. */
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Nhieu phan tu con. */
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Manh roi. */
  Fragment: unknown;
}

/** Module react o muc row nay can. */
export interface ReactLike {
  /** Trang thai cuc bo. */
  useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void];
  /** Tham chieu ben. */
  useRef<T>(initial: T): { current: T };
  /** Id on dinh cho aria. */
  useId(): string;
  /** Hieu ung sau khi ve. */
  useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  /** Hieu ung truoc khi trinh duyet ve. */
  useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
}

/** Nguon quan sat duoc (khuon `HostObservable` cua ban goc). */
export interface ObservableLike<T> {
  /** Anh chup hien tai. */
  getSnapshot(): T;
  /** Theo doi thay doi; tra ham huy. */
  subscribe(listener: () => void): () => void;
}

/** Store anh chup ghi duoc do `createSnapshotStore` cap. */
export interface SnapshotStoreLike<T> extends ObservableLike<T> {
  /** Ghi anh chup moi. */
  set(value: T): void;
}

/** Hook chon theo nguon (khuon `observableHook` cua renderer). */
export interface SelectorHookLike<T> {
  /** Doc gia tri (hoac chieu qua selector). */
  <S>(selector: (value: T) => S): S;
}

/** Hook chon theo khoa (khuon `keyedObservableHook` cua renderer). */
export interface KeyedSelectorHookLike<T> {
  /** Doc gia tri cua mot khoa. */
  (key: string): T;
}

/** Anh chup mot tab dang mo o sidebar phai (chi khai phan row nay dung). */
export interface OpenTabLike {
  /** Phien so huu tab. */
  sessionId: string;
  /** Id tab trong phien. */
  tabId: string;
}

/** Phim tat hien tai cua tab (de hien thi va aria). */
export interface TabShortcutLike {
  /** Cac phim cua to hop. */
  keys?: readonly string[];
  /** Chuoi aria-keyshortcuts. */
  aria?: string;
}

/** Thong tin tab ma khe cam cap qua hook `useTabInfo`. */
export interface TabInfoLike {
  /** Tab dang ve. */
  tab: {
    /** Id tab trong phien. */
    id: string;
    /** Tieu de luc mo tab. */
    title?: string;
    /** Vong doi cua tab. */
    signal: AbortSignal;
    /** Dia chi va tham so dieu huong cua tab. */
    navigation: { params?: { readonly url?: string } };
    /** Phim tat lam moi cua tab. */
    refreshShortcut?: TabShortcutLike;
    /** Y dinh cua tab (mo tab moi tu trong tab). */
    actions: {
      /** Gan lenh cho tab (lam moi tu bang lenh); tra ham go lenh neu co. */
      bindCommands(commands: Record<string, () => void>): void | (() => void);
      /** Mo them mot tab cung phien. */
      openTab(kind: string, options: { params: Record<string, unknown>; revealIfOpened: boolean }): unknown;
    };
  };
}

/** Action ghi trang thai trinh duyet theo tab (khuon `BoundActions` cua ban goc). */
export interface BrowserActionsLike {
  /** Ghi checkpoint cua mot tab. */
  replace(tabId: string, state: BrowserTabState): void;
  /** Quen mot tab da dong. */
  forget(tabId: string): void;
}

/** Khe cam cua trang. */
export interface SlotsSeamLike {
  /** Dang ky mot occupant; tra gia tri do seam quyet dinh. */
  register(definition: Record<string, unknown>, component: unknown): unknown;
  /** Dang ky occupant vao slot, co the hoan. */
  inject(slot: string, register: () => unknown): unknown;
}

/** Seam tu dien. */
export interface LocaleSeamLike {
  /** Bind mot namespace thanh ham t(key, params). */
  bind(namespace: string): (key: string, params?: Record<string, string>) => string;
  /** Dang ky tu dien. */
  register(namespace: string, copy: Record<string, Record<string, string>>): unknown;
}

/** Bang phim tat cua trang. */
export interface ShortcutsSeamLike {
  /** Dang ky mot phim tat. */
  register(definition: Record<string, unknown>): unknown;
}

/** Sidebar phai. */
export interface SidebarRightSeamLike {
  /** Cac tab dang mo. */
  openTabs: ObservableLike<readonly OpenTabLike[]>;
  /** Dich lenh tu mot phan tu. */
  commandTarget(element: unknown): unknown;
  /** Mo tab tu mot dich. */
  openTabFromTarget(kind: string, target: unknown): void;
}

/** Kieu tab cua sidebar phai. */
export interface SidebarRightTabsSeamLike {
  /** Dang ky mot kieu tab. */
  register(definition: Record<string, unknown>): unknown;
}

/** Context phia browser (chi khai phan row nay dung). */
export interface ClientContextLike {
  /** Dang ky hieu ung co the huy; callback tra ham don dep hoac gia tri bat ky. */
  effect(callback: () => unknown, label?: string): unknown;
  /** Cho mot nhom dich vu khac roi chay callback voi context da mo rong. */
  inject(services: readonly string[], callback: (ctx: ClientContextLike) => unknown): unknown;
  /** Khe cam. */
  slots: SlotsSeamLike;
  /** Tu dien. */
  locale: LocaleSeamLike;
  /** Sidebar phai. */
  sidebarRight: SidebarRightSeamLike;
  /** Kieu tab cua sidebar phai. */
  sidebarRightTabs: SidebarRightTabsSeamLike;
  /** Bang phim tat. */
  shortcuts: ShortcutsSeamLike;
}

/** Hinh dang `defineStore` ma `@galaxy-blackhole/gbh-client-store` cap. */
export interface DefineStoreLike {
  /** Khai mot store theo pham vi phien. */
  (spec: {
    /** Trang thai dau. */
    init: () => { byTab: Record<string, BrowserTabState> };
    /** Khoa luu tru ben vung. */
    persist: string;
    /** Tap action; tham so dau la ban nhap trang thai. */
    actions: Record<string, (draft: { byTab: Record<string, BrowserTabState> }, ...args: never[]) => void>;
  }): unknown;
}

/** Bang module ma factory nhan qua `require`. */
export interface StoreModuleLike {
  /** Store anh chup ghi duoc. */
  createSnapshotStore<T>(initial: T): SnapshotStoreLike<T>;
  /** Store ben vung theo pham vi phien. */
  defineStore: DefineStoreLike;
}

/** require do bang module cap cho factory. */
export type RequireFn = (id: string) => unknown;
