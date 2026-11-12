/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cac seam ma row ui-plan nhan tu bang module cua trang: JSX runtime, hook React, primitive, slot, tu dien
 */
import type { TranslatePlan } from "./failure-line.ts";
import type { PlanKey } from "./plan-keys.ts";

/**
 * Runtime JSX do bang module cap (react/jsx-runtime).
 * KHONG lay jsx/jsxs tu "react": namespace React KHONG co hai ham do (loi da lam hong thanh ben 17/10/2026).
 */
export interface JsxRuntime {
  /** Dung element MOT con. */
  jsx: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Dung element NHIEU con. */
  jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Nhom con khong co element bao ngoai. */
  Fragment: unknown;
}

/** Hook cua "react" ma row nay dung (module that KHONG co jsx/jsxs). */
export interface ReactHooks {
  /** Trang thai cuc bo cua component. */
  useState: <T>(initial: T) => [T, (next: T) => void];
  /** O nho ben qua cac lan render. */
  useRef: <T>(initial: T) => { current: T };
  /** Hieu ung vong doi; tra ham don dep neu co. */
  useEffect: (callback: () => void | (() => void), deps: readonly unknown[]) => void;
  /** Ghi nho gia tri theo phu thuoc. */
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T;
}

/** Bon hook + runtime JSX: bo khung ma moi component cua row nay nhan. */
export type PlanShell = JsxRuntime & ReactHooks;

/** Primitive cua @galaxy-blackhole/gbh-client-ui-primitives ma row nay dung (giu NGUYEN icon goc cua DSH). */
export interface PlanPrimitives {
  /** Bieu tuong theo loai tep (the plan + tieu de tab). */
  FileTypeIcon: unknown;
  /** Mui ten sang phai cua nut xem toan van. */
  IconChevronRightOutlineRegular: unknown;
  /** Bieu tuong plan mode luc nghi. */
  IconPlanOutlineRegular: unknown;
  /** Bieu tuong dong luc hover (tat plan mode). */
  IconCloseCircleFillRegular: unknown;
  /** Bo doc Markdown day du (khong tu viet lai). */
  MarkdownText: unknown;
  /**
   * Rut van ban thuan tu Markdown (dung cho tieu de plan tam thoi).
   * Nhan: text — Markdown; options — che do rut (first-line).
   * Tra: chuoi van ban thuan.
   */
  extractMarkdownPlainText: (text: string, options: { readonly mode: "first-line" }) => string;
}

/** Nguon chi doc mot gia tri (store cua phien, store cua chu so huu, Session…). */
export interface Observable<T> {
  /**
   * Doc gia tri hien tai.
   * Nhan: khong co.
   * Tra: gia tri hien tai.
   */
  getSnapshot(): T;
  /**
   * Dang ky nguoi nghe thay doi.
   * Nhan: listener — ham nghe.
   * Tra: ham go.
   */
  subscribe(listener: () => void): () => void;
}

/** Hook chon mot phan cua anh chup (do tang renderer gan vao props). */
export type SelectorHook<T> = <S = T>(selector?: (value: T) => S) => S;

/** Hook chon theo khoa (keyedHooks cua mat inject). */
export type KeyedSelectorHook<T> = <S = T>(key: string, selector?: (value: T) => S) => S;

/** Seam so slot cua tang renderer (dich vu "slots" cua cordis). */
export interface SlotsSeam {
  /**
   * Dang ky mot occupant vao slot; co the hoan lai qua ctx.effect.
   * Nhan: name — ten slot NGUYEN VAN; register — ham dang ky that su.
   * Tra: gia tri do seam quyet dinh (thuong la ham go).
   */
  inject(name: string, register: () => unknown): unknown;
  /**
   * Dang ky occupant: register(spec, Component) — component la THAM SO THU HAI, khong nhet vao spec.
   * Nhan: spec — dinh danh occupant (name, id/key, locale, store, inject…); component — component React.
   * Tra: gia tri do seam quyet dinh.
   */
  register(spec: Record<string, unknown>, component: unknown): unknown;
}

/** Seam tu dien (dich vu "locale" cua cordis). */
export interface LocaleSeam {
  /**
   * Dang ky mot namespace.
   * Nhan: namespace — ten namespace; dictionaries — bang chu theo ngon ngu.
   * Tra: gia tri do seam quyet dinh (thuong la ham go).
   */
  register(namespace: string, dictionaries: { readonly zh: unknown; readonly en: unknown; readonly vi?: unknown }): unknown;
  /**
   * Bind mot namespace thanh ham dich.
   * Nhan: namespace — ten namespace da dang ky.
   * Tra: ham dich t(key, params).
   */
  bind(namespace: string): TranslatePlan;
}

/** Seam hoi thoai: noi dang ky dinh nghia chieu node. */
export interface ConversationSeam {
  /** So su kien cua Conversation. */
  events: {
    /**
     * Dang ky mot dinh nghia chieu node.
     * Nhan: definition — dinh nghia (kind, target, match, start, update, buildViewNode).
     * Tra: gia tri do seam quyet dinh.
     */
    register(definition: unknown): unknown;
  };
  /**
   * Lay mat binding cua mot phien.
   * Nhan: binding — binding phien do ctx.sessions.binding tra ve.
   * Tra: doi tuong co target(name).
   */
  binding(binding: unknown): { target(name: string): ChatTarget };
}

/** Dich cua Chat ma the plan doc du lieu Turn tu do. */
export interface ChatTarget {
  /**
   * Anh chup hien tai cua Chat (undefined khi chua san sang).
   * Nhan: khong co.
   * Tra: anh chup co nodes.turnDataSource, hoac undefined.
   */
  getSnapshot(): ChatSnapshot | undefined;
}

/** Anh chup cua Chat: phan ma row nay doc. */
export interface ChatSnapshot {
  /** Nguon du lieu cua cac node trong mot Turn. */
  nodes: {
    /**
     * Nguon du lieu cua mot khoa trong mot Turn.
     * Nhan: turn — so thu tu Turn; key — khoa du lieu.
     * Tra: nguon chi doc cua du lieu do.
     */
    turnDataSource(turn: number, key: string): Observable<readonly unknown[]>;
  };
}

/** Seam tai nguyen cua trang (dich vu "resources"). */
export interface ResourcesSeam {
  /**
   * Dang ky mot provider theo giao thuc.
   * Nhan: provider — doi tuong { protocol, open(address, { signal }) }.
   * Tra: gia tri do seam quyet dinh.
   */
  register(provider: unknown): unknown;
}

/** Seam sidebar phai (dich vu "sidebarRight"). */
export interface SidebarRightSeam {
  /** Phien dang hien tren man hinh (undefined khi khong co). */
  readonly mounted: Observable<string | undefined>;
  /**
   * Mo mot dia chi tai nguyen trong sidebar phai.
   * Nhan: address — dia chi tai nguyen; options — tham so dieu huong (plan tam thoi).
   * Tra: khong co.
   */
  openResource(address: string, options?: { readonly params?: Record<string, unknown> }): void;
}

/** Seam kieu tab cua sidebar phai (dich vu "sidebarRightTabs"). */
export interface SidebarRightTabsSeam {
  /**
   * Dang ky mot kieu tab.
   * Nhan: definition — { id, kind, patterns, priority, canOpen, title }.
   * Tra: gia tri do seam quyet dinh.
   */
  register(definition: Record<string, unknown>): unknown;
}

/** Dia chi phien con do seam "sessions" tra ve. */
export interface SubagentAddress {
  /** Phien cha. */
  readonly parentSessionId: string;
  /** Phien con. */
  readonly childSessionId: string;
  /** Che do phien con. */
  readonly mode: string;
}

/** Seam bang phien (dich vu "sessions"). */
export interface SessionsSeam {
  /**
   * Binding cua mot phien.
   * Nhan: sessionId — id phien.
   * Tra: binding, hoac undefined khi phien khong ton tai.
   */
  binding(sessionId: string): unknown;
  /**
   * Dia chi phien con cua mot phien (khi phien do la phien con).
   * Nhan: sessionId — id phien.
   * Tra: dia chi phien con, hoac undefined.
   */
  subagentAddress(sessionId: string): SubagentAddress | undefined;
}

/** Ket qua mot lan goi Remote. */
export interface RemoteResult<T> {
  /** true khi Host nhan. */
  readonly ok: boolean;
  /** Gia tri khi thanh cong. */
  readonly value?: T;
  /** Loi khi that bai. */
  readonly error: { readonly code: string; readonly message: string };
}

/** Seam Remote ma row nay dung (ctx.remote). */
export interface RemoteSeam {
  /** Lenh cua phien (/plan off). */
  readonly commands: {
    /**
     * Chay mot lenh trong mot phien.
     * Nhan: sessionId — phien; command — chuoi lenh; args — tham so them.
     * Tra: ket qua Remote (value la van ban tra ve cua lenh).
     */
    execute(sessionId: string, command: string, args: readonly string[]): Promise<RemoteResult<unknown>>;
  };
  /** Lich su phien (provider tai nguyen plan doc tu day). */
  readonly session: unknown;
}

/** Ngu canh goc phia client; chi khai nhung gi row nay that su dung. */
export interface ClientContext {
  /**
   * Dang ky mot hieu ung vong doi (fiber don dep khi go).
   * Nhan: callback — than hieu ung; label — nhan hien trong log.
   * Tra: gia tri do seam quyet dinh.
   */
  effect(callback: () => unknown, label: string): unknown;
  /** So slot. */
  slots: SlotsSeam;
  /** Tu dien. */
  locale: LocaleSeam;
  /** Hoi thoai. */
  uiConversation: ConversationSeam;
  /** Tai nguyen. */
  resources: ResourcesSeam;
  /** Sidebar phai. */
  sidebarRight: SidebarRightSeam;
  /** Kieu tab cua sidebar phai. */
  sidebarRightTabs: SidebarRightTabsSeam;
  /** Bang phien. */
  sessions: SessionsSeam;
  /** Kenh Remote. */
  remote: RemoteSeam;
}

/** Mat plugin ma Loader goi apply tren do. */
export interface ClientPlugin {
  /** Ten package (cung la id module duy nhat cua bundle). */
  readonly name: string;
  /** Seam ma fiber can (ten dich vu cordis). */
  readonly inject: readonly string[];
  /**
   * Than plugin.
   * Nhan: ctx — ngu canh goc phia client.
   * Tra: khong co.
   */
  apply(ctx: ClientContext): void;
}

/** Khoa cua namespace ma chip/the dung — dung lai kieu cua tu dien cho gon. */
export type PlanTextKey = PlanKey;

/** Ham require do bang module cua loader cap cho factory. */
export type RequireFn = (specifier: string) => unknown;
