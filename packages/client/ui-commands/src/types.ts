/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hinh dang module ma bang module trang cap cho factory, va cac kieu du lieu cua be mat lenh
 */

/** Ham nap module cua bang module trang (do factory nhan tu tang nap). */
export type RequireFn = (specifier: string) => unknown;

/** Ham dich cua namespace 'command'. */
export type Translate = (key: string, params?: Record<string, string>) => string;

/** Runtime JSX do bang module cap (react/jsx-runtime). */
export interface JsxRuntimeLike {
  /** Dung mot element. */
  jsx(type: unknown, props: Record<string, unknown> | null, key?: unknown): unknown;
  /** Dung nhieu element. */
  jsxs(type: unknown, props: Record<string, unknown> | null, key?: unknown): unknown;
  /** Node boc nhieu con. */
  Fragment: unknown;
}

/** Hook React ma row nay dung (react). */
export interface ReactHooksLike {
  /** Theo doi mot store ben ngoai. */
  useSyncExternalStore(subscribe: (onChange: () => void) => () => void, getSnapshot: () => unknown): unknown;
  /** Tham chieu song qua cac lan render. */
  useRef<T>(initial: T): { current: T };
  /** Hieu ung sau render; tra ham don dep. */
  useEffect(run: () => void | (() => void), deps: readonly unknown[]): void;
  /** Gia tri nho theo phu thuoc. */
  useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  /** Node boc nhieu con (cung gia tri voi Fragment cua react/jsx-runtime). */
  Fragment: unknown;
}

/** Kho anh chup ma `dsh-client-store` cap. */
export interface SnapshotStoreLike<T> {
  /** Anh chup hien tai. */
  getSnapshot(): T;
  /** Dat gia tri moi va bao cho nguoi nghe. */
  set(value: T): void;
  /** Nghe thay doi; tra ham huy. */
  subscribe(listener: () => void): () => void;
}

/** Seam `dsh-client-store`. */
export interface StoreSeamLike {
  /** Tao mot kho anh chup. */
  createSnapshotStore<T>(initial: T): SnapshotStoreLike<T>;
}

/** Ham xep hang theo ten va nhan cua ui-primitives (dung chung voi menu '/'). */
export type RankByName = <T extends { readonly name: string }>(rows: readonly T[], query: string) => readonly T[];

/** Seam `dsh-client-ui-primitives` (chi phan row nay dung). */
export interface PrimitivesLike {
  /** Xep hang theo ten va nhan, dung chung voi menu '/'. */
  rankByName: RankByName;
  /** Theo doi nhom dinh (sticky) trong mot khung cuon; tra ham huy. */
  observeStickyMenuGroups(viewport: HTMLElement): () => void;
  /** Tinh tran chieu cao theo khoang trong phia tren hop soan tin. */
  useAnchoredMaxHeight(ref: { current: HTMLElement | null }, limit: number, dep: unknown): number;
  /** Be mat the noi cua menu. */
  MenuSurface: unknown;
  /** Nhom muc co tieu de dinh. */
  MenuGroup: unknown;
  /** Hop xac nhan rui ro. */
  RiskConfirmation: unknown;
  /** Bieu tuong dau check. */
  IconCheckOutlineRegular: unknown;
  /** Bieu tuong lenh goal. */
  IconGoalOutlineRegular: unknown;
  /** Bieu tuong lenh plan. */
  IconPlanOutlineRegular: unknown;
  /** Bieu tuong lenh feedback. */
  IconPaperPlaneOutlineRegular: unknown;
  /** Bieu tuong lenh compact. */
  IconCompactOutlineRegular: unknown;
  /** Bieu tuong lenh permission. */
  PermissionIconFullAccessRegular: unknown;
  /** Bieu tuong lenh export. */
  IconDownloadOutlineRegular: unknown;
}

/** Mot dong trong thuc don lenh (nguyen van hinh dang cua `InputTriggerCandidate`). */
export interface MenuRowLike {
  /** Ten lenh (khong co dau '/' ). */
  name: string;
  /** Nhan hien thi. */
  label?: string;
  /** Mo ta hien thi. */
  description?: string;
  /** Bieu tuong. */
  icon?: unknown;
  /** Goi y tham so cua lenh Host co input. */
  hint?: string;
  /** Tieu de nhom (chi co o ket qua cua sectionRows). */
  section?: string;
}

/** Mot dong chon cua popupSelect (nguyen van `SelectOption`). */
export interface SelectOptionLike {
  /** Id on dinh cua dong. */
  readonly id: string;
  /** Nhan hien thi. */
  readonly label: string;
  /** Dau nho ngan ben canh nhan. */
  readonly badge?: string;
  /** Mo ta phu. */
  readonly detail?: string;
  /** Nhom do ben goi so huu. */
  readonly group?: { readonly name: string; readonly label: string };
  /** Dong dang duoc dung — the se do vao dong nay khi mo. */
  readonly active?: boolean;
  /** Cong chan rui ro phai xac nhan truoc khi chon. */
  readonly confirmation?: {
    readonly title: string;
    readonly description: string;
    readonly acknowledgeLabel: string;
    readonly cancelLabel: string;
    readonly confirmLabel: string;
  };
}

/** Mot nhom dong sau khi gom (nguyen van `OptionGroup`). */
export interface OptionGroupLike {
  /** Nhom do ben goi khai; undefined = nhom khong ten. */
  readonly group: { readonly name: string; readonly label: string } | undefined;
  /** Cac dong theo thu tu hien thi. */
  readonly rows: readonly SelectOptionLike[];
}

/** Che do tim kiem cua popupSelect. */
export type PopupSearchMode = "substring" | "fuzzy-label";

/** Nhan tim kiem do lenh so huu. */
export interface PopupSearchLabelsLike {
  /** Goi y o tim kiem. */
  readonly placeholder: string;
  /** Nhan khi danh muc rong. */
  readonly empty: string;
  /** Nhan khi loc khong ra dong nao. */
  readonly noResults: string;
}

/** Spec popupSelect ma nghiep vu dang ky. */
export interface PopupSpecLike<TCtx> {
  /** Che do tim kiem; mac dinh substring. */
  readonly searchMode?: PopupSearchMode;
  /** Nhan tim kiem cho lan mo nay. */
  searchLabels?(): PopupSearchLabelsLike;
  /** Nap danh sach dong mot lan cho moi lan mo. */
  options(context: TCtx, signal: AbortSignal): Promise<readonly SelectOptionLike[]>;
  /** Chot mot dong da chon. */
  onSelect(option: SelectOptionLike, context: TCtx): void | Promise<void>;
}

/** Doan token da chup luc mo the (nguyen van `TokenSegment`). */
export type TokenSegmentLike =
  | { readonly via: "menu"; readonly span: unknown }
  | { readonly via: "enter"; readonly token: string };

/** Callback ma tang noi phien tiem vao the. */
export interface PopupSelectDepsLike {
  /** Tieu thu doan token sau khi chon thanh cong; false = CAS truot (vo hai). */
  consume(segment: TokenSegmentLike): boolean;
  /** Tra tieu diem ve hop soan tin. */
  focusComposer(): void;
}

/** Trang thai cua the chon (nguyen van `PopupState`). */
export interface PopupStateLike {
  /** The dang mo. */
  readonly open: boolean;
  /** Ten lenh the dang phuc vu; null khi dong. */
  readonly command: string | null;
  /** Vong doi nap dong. */
  readonly status: "pending" | "ready" | "failed";
  /** Dong da nap (khong nap lai theo tung phim). */
  readonly options: readonly SelectOptionLike[];
  /** Van ban loc cuc bo. */
  readonly search: string;
  /** Nhan tim kiem do lenh cap; null = dung nhan chung. */
  readonly searchLabels: PopupSearchLabelsLike | null;
  /** Chinh sach tim kiem chot luc mo. */
  readonly searchMode: PopupSearchMode;
  /** Chi so dang to sang trong danh sach DA LOC. */
  readonly active: number;
  /** Mot lan chot dang chay. */
  readonly submitting: boolean;
  /** Dong dang cho xac nhan rui ro. */
  readonly confirming: SelectOptionLike | null;
  /** O checkbox da duoc tich cho cong dang cho. */
  readonly acknowledged: boolean;
  /** Loi da lo ra (nap dong hoac chot dong). */
  readonly error: string | null;
}

/** Mot dong cua danh muc lenh Host (nguyen van `CommandDescriptor`). */
export interface CommandDescriptorLike {
  /** Ten lenh khong co dau '/'. */
  readonly name: string;
  /** Id dinh nghia goc (dung de nhan dien lenh built-in). */
  readonly definitionId?: string;
  /** Mo ta tu danh muc Host. */
  readonly description?: string;
  /** Lenh co nhan tham so. */
  readonly input?: { readonly hint?: string; readonly attachments?: boolean };
}

/** Ket qua RPC cua tang remote. */
export type RpcResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** Seam `remote` (chi phan row nay dung). */
export interface RemoteLike {
  /** Nghe su kien remote. */
  $on(name: string, listener: (...args: any[]) => void): () => void;
  /** Lenh Host. */
  readonly commands: {
    /** Liet ke lenh cua mot phien. */
    list(sessionId: string): Promise<RpcResult<readonly CommandDescriptorLike[]>>;
    /** Thuc thi mot dong lenh. */
    execute(sessionId: string, line: string, attachments: readonly unknown[]): Promise<RpcResult<{ readonly result: { readonly kind: string; readonly text?: string } } | undefined>>;
  };
}

/** Mot lan dang ky slot cua tang slots. */
export interface SlotsServiceLike {
  /** Cho slot san sang roi chay callback. */
  inject(name: string, register: () => unknown): unknown;
  /** Dang ky mot cho ngoi; component la THAM SO THU HAI. */
  register(spec: Record<string, unknown>, component: unknown): unknown;
}

/** Seam `locale` (chi phan row nay dung). */
export interface LocaleServiceLike {
  /** Dang ky mot namespace. */
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): unknown;
  /** Lay ham dich cua mot namespace. */
  bind(namespace: string): Translate;
}

/** Mot tham chieu phien ma `sessions.using` tra ve. */
export interface SessionReferenceLike {
  /** Rang buoc cua phien. */
  readonly binding: { readonly session: { getSnapshot(): { readonly openState: string; readonly openError?: Error } } };
}

/** Seam `sessions` (chi phan row nay dung). */
export interface SessionsServiceLike {
  /** Dia chi subagent cua mot phien, neu co. */
  subagentAddress(sessionId: string): unknown;
  /** Rang buoc dang giu cua mot phien. */
  binding(sessionId: string): { readonly session: unknown; readonly ctx: ClientContextLike } | undefined;
  /** Giu mot phien trong luc chay mot tac vu. */
  using(sessionId: string, options: { readonly source: string }, run: (reference: SessionReferenceLike) => Promise<readonly CommandDescriptorLike[]>): Promise<readonly CommandDescriptorLike[]>;
  /** Phien cua mot context con. */
  sessionOf(actx: unknown): { readonly sessionId: string } | undefined;
  /** Context con cua mot phien. */
  scope(sessionId: string): ClientContextLike | undefined;
}

/** Context phia client ma row nay dung (hinh dang toi thieu). */
export interface ClientContextLike {
  /** Dang ky hieu ung vong doi; tra ham huy. */
  effect(run: () => void | (() => void), label?: string): () => void;
  /** Cho mot tap dich vu san sang roi chay callback trong context con. */
  inject(services: readonly string[], callback: (scope: ClientContextLike) => void): unknown;
  /** Nap mot plugin vao context. */
  plugin(plugin: unknown): unknown;
  /** Tra mot dich vu theo ten (khong can inject). */
  get(name: string): any;
  /** Nghe mot su kien cordis. */
  on(name: string, listener: (...args: any[]) => void): () => void;
  /** Phat mot su kien waterfall/emit tren context phien. */
  bail(ctx: unknown, event: string, payload: unknown): unknown;
  /** Nha hat su kien (dung de phat command/executed khong cho observer doi ket qua). */
  readonly events: { dispatch(mode: string, args: readonly unknown[]): readonly ((...args: any[]) => unknown)[] };
  /** Ghi log. */
  readonly logger: { warn(...args: unknown[]): void };
  /** Tang tu dien. */
  readonly locale: LocaleServiceLike;
  /** Tang slot. */
  readonly slots: SlotsServiceLike;
  /** Tang remote. */
  readonly remote: RemoteLike;
}

/** Ham dung lop Service THAT cua cordis (chi co o runtime qua bang module). */
export interface ServiceCtorLike {
  /** Tao service gan vao context voi mot ten. */
  new (ctx: ClientContextLike, name: string): { readonly ctx: ClientContextLike };
}

/** Mat plugin ma factory dung ra — tang nap goi apply tren do. */
export interface UiCommandsPlugin {
  /** Ten plugin. */
  name: string;
  /** Dich vu bat buoc (cordis fiber inject). */
  inject: string[];
  /** Gan be mat lenh vao trang. */
  apply(ctx: ClientContextLike): void;
}
