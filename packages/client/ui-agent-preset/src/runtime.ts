/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kieu dung chung cua row ui-agent-preset: runtime JSX, React, bo primitive va ham dich
 */

/** Ham require do bang module cua loader cap cho factory. */
export type RequireFn = (specifier: string) => unknown;

/** Runtime JSX: hai ham tao phan tu va manh rong — hai ham nay nam o react/jsx-runtime, KHONG o react. */
export interface JsxRuntime {
  /** Tao mot phan tu co mot con. */
  jsx: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Tao mot phan tu co nhieu con. */
  jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Manh rong. */
  Fragment: unknown;
}

/** Hook React ma row nay dung — chi khai phan that su goi. */
export interface ReactLike {
  /** Trang thai cuc bo. */
  useState: <T>(initial: T | (() => T)) => [T, (next: T | ((current: T) => T)) => void];
  /** O nho. */
  useRef: <T>(initial: T) => { current: T };
  /** Hieu ung sau khi ve. */
  useEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Hieu ung bo cuc (chay truoc khi trinh duyet ve). */
  useLayoutEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Ghi nho gia tri dan xuat. */
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T;
  /** Id on dinh cho aria-labelledby cua tab. */
  useId: () => string;
}

/** Ham dich cua namespace settings.agentPreset: nhan khoa + tham so, tra chuoi da noi. */
export interface Translator {
  /** Dich mot khoa cua namespace voi tham so noi suy. */
  (key: string, params?: Record<string, string | number>): string;
}

/**
 * Bo primitive dung chung cua DSH — chi khai ten ma row nay that su dung.
 * Moi truong la mot component (hoac chuoi trong test), nen kieu la unknown cho gon.
 */
export interface Primitives {
  /** Nut bam chuan. */
  Button: unknown;
  /** Menu noi (anchor + items + selectedId). */
  Menu: unknown;
  /** Mot muc trong menu. */
  MenuItemButton: unknown;
  /** Hop thoai modal. */
  Modal: unknown;
  /** Tab phan doan. */
  SegmentedTabs: unknown;
  /** Nhan nho. */
  Tag: unknown;
  /** Bang bao tam thoi. */
  Toast: unknown;
  /** Nhan noi khi bi cat. */
  Tooltip: unknown;
  /** Khoi van ban Markdown chi doc. */
  MarkdownText: unknown;
  /** Icon preset agent. */
  IconAgentPresetOutlineRegular: unknown;
  /** Icon xem cau hinh. */
  IconBrowseOutlineRegular: unknown;
  /** Icon chevron xuong. */
  IconChevronDownOutlineRegular: unknown;
  /** Icon dong. */
  IconCloseOutlineRegular: unknown;
  /** Icon danh sach-but (nhan vi du). */
  IconListPenOutlineRegular: unknown;
  /** Icon cong. */
  IconPlusOutlineRegular: unknown;
  /** Icon canh bao. */
  IconWarningOutlineRegular: unknown;
}

/**
 * Doc mot module bat buoc phai co tu bang module cua loader.
 * Nhan: requireFn — ham nap module; specifier — ten module.
 * Tra: module da ep kieu T (nem neu bang module khong co).
 */
export function requireModule<T>(requireFn: RequireFn, specifier: string): T {
  return requireFn(specifier) as T;
}
