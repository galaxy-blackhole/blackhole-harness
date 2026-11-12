/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kieu runtime cua nua client ui-model-selection: ham require, JSX, React, react-dom, bo primitive va ham dich
 */

/** Ham require do bang module cua loader cap cho factory (ban goc dung bien tu do "require"). */
export type RequireFn = (specifier: string) => unknown;

/** Runtime JSX: hai ham tao phan tu va manh rong — nam o react/jsx-runtime, KHONG o react. */
export interface JsxRuntime {
  /** Tao mot phan tu co mot con. */
  jsx: JsxFn;
  /** Tao mot phan tu co nhieu con. */
  jsxs: JsxFn;
  /** Manh rong. */
  Fragment: unknown;
}

/** Thuoc tinh cua mot phan tu JSX ma row nay dung — chi khai key that su xuat hien trong ban goc. */
export interface JsxProps {
  /** Cho phep moi thuoc tinh con lai (aria-*, data-*, title, ...) nhu ban goc. */
  [key: string]: unknown;
  /** Con cua phan tu (mang hoac mot gia tri). */
  children?: unknown;
  /** Su kien chuot xuong. */
  onMouseDown?: (event: MouseEventLike) => void;
  /** Su kien chuot di chuyen. */
  onMouseMove?: () => void;
  /** Su kien bam. */
  onClick?: () => void;
  /** Su kien doi gia tri cua o nhap. */
  onChange?: (event: { readonly target: { readonly value: string } }) => void;
  /** Su kien ban phim. */
  onKeyDown?: (event: KeyboardEventLike) => void;
  /** Su kien mat tieu diem. */
  onBlur?: (event: FocusEventLike) => void;
  /** Su kien nhan tieu diem. */
  onFocus?: () => void;
}

/** Ham tao phan tu cua react/jsx-runtime. */
export type JsxFn = (type: unknown, props: JsxProps | null, key?: unknown) => unknown;

/** Su kien chuot toi thieu ma row nay doc. */
export interface MouseEventLike {
  /** Dich cua su kien. */
  readonly target: EventTarget | null;
  /** Chan hanh vi mac dinh. */
  preventDefault(): void;
}

/** Su kien ban phim toi thieu ma row nay doc. */
export interface KeyboardEventLike {
  /** Ten phim. */
  readonly key: string;
  /** Co Shift hay khong. */
  readonly shiftKey: boolean;
  /** Dich cua su kien. */
  readonly target: EventTarget | null;
  /** Su kien goc cua React (co co composing cua IME). */
  readonly nativeEvent: { readonly isComposing: boolean };
  /** Chan hanh vi mac dinh. */
  preventDefault(): void;
}

/** Su kien mat tieu diem toi thieu ma row nay doc. */
export interface FocusEventLike {
  /** Phan tu nhan tieu diem tiep theo. */
  readonly relatedTarget: EventTarget | null;
}

/** O nho cua React. */
export interface RefObject<T> {
  /** Gia tri hien tai. */
  current: T;
}

/** Hook React ma row nay dung — chi khai phan that su goi. */
export interface ReactLike {
  /** Doc store ngoai React (uSES). */
  useSyncExternalStore: <T>(subscribe: (listener: () => void) => () => void, getSnapshot: () => T) => T;
  /** Trang thai cuc bo. */
  useState: <T>(initial: T | (() => T)) => [T, (next: T | ((current: T) => T)) => void];
  /** O nho. */
  useRef: <T>(initial: T) => RefObject<T>;
  /** Hieu ung sau khi ve. */
  useEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Hieu ung bo cuc (chay truoc khi trinh duyet ve). */
  useLayoutEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Ghi nho gia tri dan xuat. */
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T;
  /** Id on dinh cho aria-controls/aria-activedescendant. */
  useId: () => string;
}

/** react-dom: chi ham cong portal ma ban goc dung. */
export interface ReactDomLike {
  /** Ve mot cay vao container ngoai cay React. */
  createPortal: (node: unknown, container: Element | DocumentFragment) => unknown;
}

/** Mot muc reasoning effort do Host tra ve. */
export interface EffortLevel {
  /** Id cua muc. */
  readonly id: string;
  /** Ten hien thi cua muc. */
  readonly name: string;
}

/** Metadata reasoning cua mot model do Host tra ve. */
export interface ReasoningMetadata {
  /** Effort mac dinh cua provider. */
  readonly defaultEffort?: string;
  /** Cac muc effort provider ho tro. */
  readonly efforts: readonly EffortLevel[];
}

/** Mot model trong danh muc do Host tra ve. */
export interface CatalogModel {
  /** Id model do provider so huu. */
  readonly id: string;
  /** Ten hien thi. */
  readonly name: string;
  /** Metadata reasoning (co the vang). */
  readonly reasoning?: ReasoningMetadata;
}

/** Mot nhom provider trong danh muc do Host tra ve. */
export interface CatalogGroup {
  /** Id provider. */
  readonly id: string;
  /** Ten hien thi cua provider. */
  readonly name: string;
  /** Model cua provider. */
  readonly models: readonly CatalogModel[];
}

/**
 * Bo primitive dung chung cua DSH — chi khai ten ma row nay that su dung.
 * Moi truong la mot component (hoac chuoi trong test), nen kieu la unknown cho gon.
 */
export interface Primitives {
  /** Loc + xep hang model theo ten (ban goc goi thang cua bo primitive). */
  rankByName: <T extends { readonly id: string; readonly name: string }>(models: readonly T[], query: string) => T[];
  /** Theo doi nhom dinh (sticky) khi cuon menu. */
  observeStickyMenuGroups: (viewport: HTMLElement) => () => void;
  /** Be mat menu noi. */
  MenuSurface: unknown;
  /** Nhom muc trong menu. */
  MenuGroup: unknown;
  /** O nhap chuan. */
  Input: unknown;
  /** Bang bao tam thoi. */
  Toast: unknown;
  /** Diem trang thai (chay nen). */
  StateDot: unknown;
  /** Icon danh muc model. */
  IconDataOutlineRegular: unknown;
  /** Icon chevron xuong. */
  IconChevronDownOutlineRegular: unknown;
  /** Icon chevron phai. */
  IconChevronRightOutlineRegular: unknown;
  /** Icon dong (xoa tim kiem). */
  IconCloseFillRegular: unknown;
  /** Icon danh dau da chon. */
  IconCheckOutlineRegular: unknown;
  /** Icon canh bao. */
  IconWarningOutlineRegular: unknown;
}

/** Ham dich cua namespace model: nhan khoa + tham so, tra chuoi da noi. */
export interface Translator {
  /** Dich mot khoa cua namespace voi tham so noi suy. */
  (key: string, params?: Record<string, string | number>): string;
}

/** Doi tuong cordis Service ma row nay ke thua (require luc tao plugin). */
export interface ServiceBase {
  /** Context cua fiber dich vu. */
  readonly ctx: unknown;
}

/** Constructor cua cordis Service. */
export type ServiceConstructor = new (ctx: unknown, name: string) => ServiceBase;

/** Module cordis: chi lop Service ma row nay can. */
export interface CordisModule {
  /** Lop co so de dang ky dich vu. */
  Service: ServiceConstructor;
}

/**
 * Doc mot module bat buoc phai co tu bang module cua loader.
 * Nhận: requireFn — ham nap module; specifier — ten module.
 * Trả: module da ep kieu T (nem neu bang module khong co).
 */
export function requireModule<T>(requireFn: RequireFn, specifier: string): T {
  return requireFn(specifier) as T;
}
