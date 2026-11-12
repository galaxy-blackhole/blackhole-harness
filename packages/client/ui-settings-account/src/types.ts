/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kieu cong cu dung chung: ham dich, bo JSX runtime, hook React, bo nguyen thu UI va bo cong cu render
 */

/** Ham dich cua mot namespace tu dien. */
export type Translator = (key: string, params?: Record<string, unknown>) => string;

/** Ba ham cua react/jsx-runtime. */
export interface JsxRuntime {
  /** Mot con. */
  readonly jsx: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Nhieu con tinh. */
  readonly jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Nut boc nhieu con khong co phan tu bao ngoai. */
  readonly Fragment: unknown;
}

/** Hook React ma row nay dung (KHONG co jsx/jsxs — hai ham do nam o react/jsx-runtime). */
export interface ReactHooks {
  /** Trang thai cuc bo. */
  useState: <T>(initial: T | (() => T)) => [T, (next: T | ((current: T) => T)) => void];
  /** O nho. */
  useRef: <T>(initial: T) => { current: T };
  /** Hieu ung vong doi sau khi ve. */
  useEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Hieu ung vong doi truoc khi trinh duyet ve. */
  useLayoutEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Ghi nho gia tri dan xuat. */
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T;
}

/** Bo nguyen thu giao dien cua DSH ma row nay dung — nguyen van ten cua ban goc. */
export interface Primitives {
  /** Hop thoai cua so. */
  readonly Modal: unknown;
  /** Nut. */
  readonly Button: unknown;
  /** Menu noi. */
  readonly Menu: unknown;
  /** Thong bao noi. */
  readonly Toast: unknown;
  /** Bieu tuong loai tep. */
  readonly FileTypeIcon: unknown;
  /** Bieu tuong dong. */
  readonly IconCloseOutlineRegular: unknown;
  /** Bieu tuong dang quay. */
  readonly IconLoadingOutlineRegular: unknown;
  /** Bieu tuong mui ten trai. */
  readonly IconChevronLeftOutlineRegular: unknown;
  /** Bieu tuong nguoi dung. */
  readonly IconUserOutlineMedium: unknown;
  /** Bieu tuong ba cham. */
  readonly IconEllipsisOutlineMedium: unknown;
  /** Bieu tuong banh rang. */
  readonly IconSettingsOutlineMedium: unknown;
  /** Bieu tuong gui. */
  readonly IconPaperPlaneOutlineMedium: unknown;
  /** Bieu tuong mo lien ket ngoai. */
  readonly IconRightUpOutlineRegular: unknown;
  /** Bieu tuong canh bao. */
  readonly IconWarningOutlineRegular: unknown;
  /** Bieu tuong tich. */
  readonly IconCheckOutlineRegular: unknown;
}

/** Bo cong cu render ma build.ts/plugin.ts dung chung cho moi component. */
export interface RenderDeps {
  /** Ba ham JSX runtime. */
  readonly jsxRuntime: JsxRuntime;
  /** Hook React. */
  readonly react: ReactHooks;
  /** Nguyen thu giao dien. */
  readonly primitives: Primitives;
  /** Render mot cay con ra ngoai cay hien tai. */
  readonly createPortal: (children: unknown, container: unknown) => unknown;
}
