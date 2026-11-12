/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kieu seam cua row ui-open-in-app — bang module cap gi, context phia browser co gi
 */

/**
 * Ham require do bang module cap cho factory.
 * Nhan: specifier — ten module.
 * Tra: module da nap.
 */
export type RequireFn = (specifier: string) => unknown;

/** Runtime JSX (`react/jsx-runtime`) — `jsx`/`jsxs` nam O DAY, khong nam tren namespace React. */
export interface JsxRuntimeLike {
  /** Tao mot element mot con. */
  jsx: (type: unknown, props: object | null, key?: unknown) => unknown;
  /** Tao mot element nhieu con. */
  jsxs: (type: unknown, props: object | null, key?: unknown) => unknown;
  /** Nhom khong phat sinh node. */
  Fragment: unknown;
}

/** React — chi nhung hook ma row nay dung. */
export interface ReactLike {
  /** State cuc bo cua mot lan render; ham cap nhat nhan gia tri moi HOAC ham cap nhat. */
  useState: <T>(initial: T) => [T, (next: T | ((previous: T) => T)) => void];
  /** Tham chieu giu nguyen qua cac lan render. */
  useRef: <T>(initial: T) => { current: T };
  /** Ghi nho ham theo danh sach phu thuoc. */
  useCallback: <T>(fn: T, deps: readonly unknown[]) => T;
  /** Hieu ung vong doi; ham don dep la tuy chon. */
  useEffect: (fn: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Doc nguon ngoai React theo kieu an toan voi concurrent rendering. */
  useSyncExternalStore: <T>(
    subscribe: (listener: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot: () => T,
  ) => T;
  /** Tao element khong qua JSX (nhanh SessionOpenInAppAction cua ban goc). */
  createElement: (type: unknown, props?: object | null, ...children: unknown[]) => unknown;
}

/** ui-primitives — chi nhung atom ma row nay dung. */
export interface PrimitivesLike {
  /** Menu neo vao mot phan tu (tu lo neo + portal). */
  Menu: unknown;
  /** Bong chu khi hover/focus. */
  Tooltip: unknown;
  /** Bang bao tam thoi o dinh trang. */
  Toast: unknown;
  /** Mui ten xuong. */
  IconChevronDownOutlineRegular: unknown;
  /** Bieu tuong thu muc mo. */
  IconFolderOpenOutlineRegular: unknown;
  /** Bieu tuong mo ra ngoai. */
  IconRightUpOutlineRegular: unknown;
  /** Tam giac canh bao. */
  IconWarningOutlineRegular: unknown;
}

/** Store quan sat duoc (dong dang `@galaxy-blackhole/gbh-client-store`). */
export interface SnapshotStoreLike<T> {
  /** Anh chup hien tai. */
  getSnapshot(): T;
  /** Thay bang gia tri moi. */
  set(next: T): void;
  /** Theo doi thay doi; tra ham huy. */
  subscribe(listener: () => void): () => void;
}

/** Ham tao store cua `@galaxy-blackhole/gbh-client-store` (chi phan row nay dung). */
export interface StoreModuleLike {
  /** Tao store voi tuy chon luu localStorage theo ten. */
  createSnapshotStore: <T>(init: T, options?: { persist?: { name: string } }) => SnapshotStoreLike<T>;
}

/** Mot ban ghi trong `slots.register` — component luon la THAM SO THU HAI. */
export interface SlotRegistrationSpec {
  /** Ten slot nguyen van cua ban goc. */
  name: string;
  /** Id nguoi ngoi (occupant). */
  id?: string;
  /** Thu tu chen trong slot danh sach. */
  order?: number;
  /** Namespace tu dien cua occupant. */
  locale?: string;
  /** Ham tra props tiem vao occupant. */
  inject?: () => Record<string, unknown>;
}

/** Khe cam phia client. */
export interface SlotsSeamLike {
  /** Dang ky mot occupant vao slot; component la THAM SO THU HAI. */
  register(spec: SlotRegistrationSpec, component: unknown): unknown;
  /** Dang ky occupant vao slot (co the hoan); tra gia tri do seam quyet dinh. */
  inject(slot: string, register: () => unknown): unknown;
}

/** Tu dien phia client (chi phan row nay dung). */
export interface LocaleSeamLike {
  /** Dang ky hai bang chu cho mot namespace. */
  register(namespace: string, dictionaries: { zh: Record<string, string>; en: Record<string, string>; vi?: Record<string, string> }): unknown;
  /** Bind mot namespace thanh ham t(key, params). */
  bind(namespace: string): (key: string, params?: Record<string, string>) => string;
}

/** Mot muc trong bang phim tat da resolve. */
export interface ShortcutCatalogEntry {
  /** Id lenh. */
  id: string;
  /** Nhan phim hien hanh. */
  keys?: readonly string[];
  /** Chuoi aria-keyshortcuts. */
  aria?: string;
}

/** Bang phim tat phia client. */
export interface ShortcutsSeamLike {
  /** Danh muc da resolve — nguon cho hook `useShortcuts`. */
  catalog: unknown;
  /** Dang ky mot lenh ban phim. */
  register(definition: Record<string, unknown>): unknown;
}

/** Mot phien trong `sessions.list`. */
export interface SessionRowLike {
  /** Thu muc lam viec tuyet doi cua phien. */
  cwd?: string;
  /** So lan phien duoc giu boi khung nhin chinh. */
  retainedBy: { mainView?: number };
}

/** Dich vu phien phia client (chi phan row nay dung). */
export interface SessionsSeamLike {
  /** Danh sach phien dang giu. */
  list: { getSnapshot(): { byId: Record<string, SessionRowLike> } };
}

/** Chon khung nhin phia client (chi phan row nay dung). */
export interface LayoutSeamLike {
  /** Thong tin panel dang mo. */
  panelInfo: { getSnapshot(): { activePanelId: string | null } };
}

/** Ket qua RPC cua tang Remote. */
export interface RemoteResultLike<T> {
  /** Thanh cong hay khong. */
  ok: boolean;
  /** Gia tri khi thanh cong. */
  value?: T;
}

/** Mot ung dung mo duoc cho mot tep, do Host tra ve. */
export interface PathApplicationLike {
  /** Id ung dung. */
  id: string;
  /** Ten hien thi. */
  name: string;
  /** Co phai ung dung mac dinh cua loai tep nay. */
  default: boolean;
  /** Icon data-URL, hoac null khi Host khong lay duoc. */
  icon: string | null;
}

/** Nua Remote ma cac thao tac duong dan goi. */
export interface PathRemoteLike {
  /** Namespace `session` cua Remote. */
  session: {
    /** Host co mo duoc duong dan bang desktop khong. */
    canOpenWorkspacePath(): Promise<RemoteResultLike<boolean>>;
    /** Danh sach ung dung da dang ky cho mot tep. */
    workspacePathApplications(
      request: { path: string },
      signal?: AbortSignal,
    ): Promise<RemoteResultLike<readonly PathApplicationLike[]>>;
    /** Mo mot duong dan bang ung dung mac dinh, hoac hien no trong trinh quan ly tep. */
    openWorkspacePath(
      request: { path: string; action?: string; application?: string },
      signal?: AbortSignal,
    ): Promise<RemoteResultLike<unknown>>;
  };
}

/** Context phia browser ma `apply` nhan (chi phan row nay dung). */
export interface ClientContextLike {
  /** Dang ky hieu ung co the huy; callback tra ham don dep. */
  effect(callback: () => unknown, label?: string): unknown;
  /** Khe cam. */
  slots: SlotsSeamLike;
  /** Tu dien. */
  locale: LocaleSeamLike;
  /** Phim tat. */
  shortcuts: ShortcutsSeamLike;
  /** Phien. */
  sessions: SessionsSeamLike;
  /** Khung nhin. */
  layout: LayoutSeamLike;
  /** Tang Remote. */
  remote: PathRemoteLike;
}

/** Be mat plugin ma tang nap goi `apply` tren do. */
export interface ClientPlugin {
  /** Ten plugin — id cua ta. */
  name: string;
  /** Dich vu bat buoc (cordis fiber inject). */
  inject: readonly string[];
  /** Than plugin. */
  apply(ctx: ClientContextLike): void;
}
