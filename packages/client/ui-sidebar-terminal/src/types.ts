/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hình dạng module do bảng module cấp mà row này dùng (jsx runtime, react)
 */

/** Hàm dựng phần tử của jsx runtime. */
export interface JsxRuntimeLike {
  /** Một phần tử con. */
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Nhiều phần tử con. */
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Mảnh rời. */
  Fragment: unknown;
}

/** Module react ở mức row này cần. */
export interface ReactLike {
  /** Id ổn định cho aria. */
  useId(): string;
  /** Trạng thái cục bộ. */
  useState<T>(initial: T): [T, (value: T | ((previous: T) => T)) => void];
  /** Tham chiếu bền. */
  useRef<T>(initial?: T): { current: T };
  /** Hiệu ứng sau khi vẽ; hàm dọn dẹp là tuỳ chọn. */
  useEffect(effect: () => unknown, deps: unknown[]): void;
  /** Hiệu ứng trước khi trình duyệt vẽ; hàm dọn dẹp là tuỳ chọn. */
  useLayoutEffect(effect: () => unknown, deps: unknown[]): void;
  /** Lazy component. */
  lazy(loader: () => Promise<{ default: unknown }>): unknown;
  /** Suspense. */
  Suspense: unknown;
}
