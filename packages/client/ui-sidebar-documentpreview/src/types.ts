/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hinh dang module va seam ma row ui-sidebar-documentpreview dung (jsx runtime · react · primitive · Remote · slot)
 */

import type { DocumentPreviewDefinition, DocumentPreviewRegistry } from "./document/registry.ts";

/** Ham dung phan tu cua jsx runtime — hai ham nay nam o react/jsx-runtime, KHONG co tren namespace react. */
export interface JsxRuntimeLike {
  /** Mot phan tu. */
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Phan tu co nhieu con. */
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Manh roi. */
  Fragment: unknown;
}

/** Module react o muc row nay dung — hook THAT co tren namespace react. */
export interface ReactLike {
  /** Trang thai cuc bo. */
  useState<T>(initial: T | (() => T)): [T, (next: T | ((current: T) => T)) => void];
  /** O nho ben qua cac lan ve. */
  useRef<T>(initial: T): { current: T };
  /** Hieu ung sau khi ve. */
  useEffect(effect: () => unknown, deps?: readonly unknown[]): void;
  /** Hieu ung truoc khi trinh duyet ve. */
  useLayoutEffect(effect: () => unknown, deps?: readonly unknown[]): void;
  /** Ghi nho gia tri dan xuat. */
  useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  /** Ghi nho ham goi lai. */
  useCallback<T>(callback: T, deps: readonly unknown[]): T;
  /** Gop ref ngoai voi ref noi bo. */
  useImperativeHandle(ref: unknown, factory: () => unknown, deps: readonly unknown[]): void;
  /** Dinh danh on dinh cho aria. */
  useId(): string;
  /** Bao boc mot nhanh treo. */
  Suspense: unknown;
  /** Tai mot module theo yeu cau. */
  lazy(factory: () => Promise<{ default: unknown }>): unknown;
  /** Chuyen tiep ref xuong component ham — tong quat theo props dung nhu forwardRef that cua react. */
  forwardRef<P>(render: (props: P, ref: unknown) => unknown): unknown;
  /** Tao phan tu voi mot kieu cu the. */
  createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown;
}

/** Module react-dom: cong cu dung o thoi diem ve. */
export interface ReactDomLike {
  /** Render mot cay con vao mot nut ngoai cay hien tai. */
  createPortal(children: unknown, container: unknown): unknown;
}

/** Ham nap chunk cua goi do trinh bien dich sinh ra. */
export interface RequireFn {
  /** Nap dong bo mot module tu bang module cua trang. */
  (id: string): unknown;
  /** Nap BAT DONG BO mot chunk noi bo cua chinh goi nay. */
  async?(id: string): Promise<unknown>;
}

/** Module store cua DSH. */
export interface StoreModuleLike {
  /** Khai mot store. */
  defineStore(spec: Record<string, unknown>): unknown;
  /** Bao cho nguoi quan sat rang co thay doi. */
  notifySubscribers(listeners: Set<() => void>, label: string): void;
}

/** Mot ban cai dat ban xem kem metadata — tai xuat de test doc duoc. */
export type { DocumentPreviewDefinition, DocumentPreviewRegistry };

/** Nguon metadata cua mot tai nguyen. */
export interface ResourceSourceLike {
  /** Anh chup hien tai. */
  getSnapshot(): { status: string; value?: { version?: unknown; absolutePath?: string }; failure?: { code?: string } };
  /** Quan sat thay doi. */
  subscribe(listener: () => void): () => void;
}

/** Mot ket qua Remote da settled. */
export type RemoteResultLike<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };

/** Seam khe cam: register(spec, Component) — component la THAM SO THU HAI. */
export interface SlotsSeamLike {
  /** Dang ky mot cho ngoi vao slot (co the hoan). */
  inject(slot: string, register: () => unknown): unknown;
  /** Dang ky cho ngoi voi spec va component. */
  register(definition: Record<string, unknown>, component: unknown): unknown;
}

/** Seam tu dien. */
export interface LocaleSeamLike {
  /** Bind mot namespace thanh ham t(key, params). */
  bind(namespace: string): (key: string, params?: Record<string, string | number>) => string;
  /** Dang ky tu dien cua namespace. */
  register(namespace: string, copy: Record<string, unknown>): unknown;
}

/** Seam so kieu tab cua sidebar phai. */
export interface SidebarRightTabsSeamLike {
  /** Dang ky mot kieu tab. */
  register(definition: Record<string, unknown>): unknown;
}

/** Seam tai nguyen dung chung. */
export interface ResourcesSeamLike {
  /** Nguon metadata cua mot dia chi. */
  source(address: string): ResourceSourceLike;
}

/** Seam Remote cua trang (chi phan row nay dung). */
export interface RemoteSeamLike {
  /** Doc mot trang van ban cua tep workspace. */
  workspaceFiles: {
    /** Doc theo trang. */
    read(sessionId: string, path: string, options: { offset: number }, signal: AbortSignal): Promise<RemoteResultLike<{ offset: number; text: string; lines: number; eof: boolean; version: number }>>;
    /** Doc tron byte. */
    readBytes(sessionId: string, path: string, options: Record<string, unknown>, signal: AbortSignal): Promise<RemoteResultLike<{ data: Uint8Array; version: number; absolutePath: string }>>;
    /** Doc metadata cua tep. */
    stat(sessionId: string, path: string, signal: AbortSignal): Promise<RemoteResultLike<{ absolutePath: string; version: number }>>;
  };
  /** Chuyen Office thanh PDF. */
  officeToPdf: {
    /** Yeu cau Host chuyen doi. */
    render(sessionId: string, path: string, priority: string, signal: AbortSignal): Promise<RemoteResultLike<{ data: Uint8Array; version: number; absolutePath: string; generation: number; missingFonts: string[] }>>;
    /** The he renderer hien tai cua Host. */
    generation(signal: AbortSignal): Promise<RemoteResultLike<number>>;
  };
}

/** Seam bang cau hinh cua trang. */
export interface ConfigFormsSeamLike {
  /** Cong cu danh cho nha phat trien. */
  developerTools: { enabled: boolean };
}

/** Context phia browser (chi khai phan row nay dung). */
export interface ClientContextLike {
  /** Dang ky hieu ung co the huy. */
  effect(callback: () => unknown, label?: string): unknown;
  /** Cho mot tap service roi chay callback trong scope hep hon. */
  inject(dependencies: readonly string[], callback: (ctx: ClientContextLike) => void): void;
  /** Cong cu phan chieu: cong bo mot service cho phan con lai cua trang. */
  reflect: { provide(name: string, value: unknown): () => void };
  /** Khe cam. */
  slots: SlotsSeamLike;
  /** Tu dien. */
  locale: LocaleSeamLike;
  /** So kieu tab cua sidebar phai. */
  sidebarRightTabs: SidebarRightTabsSeamLike;
  /** Tai nguyen dung chung. */
  resources: ResourcesSeamLike;
  /** Remote cua trang. */
  remote: RemoteSeamLike;
  /** Bang cau hinh cua trang. */
  configForms: ConfigFormsSeamLike;
  /** Lang nghe su kien cua ket noi. */
  on(event: string, listener: () => void): unknown;
}
