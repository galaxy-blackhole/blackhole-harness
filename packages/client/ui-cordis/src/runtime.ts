/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bảng module mà factory nhận từ tầng nạp: react/jsx-runtime, react và ui-primitives — khai đúng phần row này dùng, KHÔNG import gì lúc nạp module
 */

/** `require` do bảng module cấp cho factory (lazy-CJS, hợp đồng C2). */
export type RequireFn = (specifier: string) => unknown;

/** Hàm dựng phần tử của `react/jsx-runtime` (jsx/jsxs). */
export type JsxFn = (type: unknown, props: Record<string, unknown> | null, key?: unknown) => unknown;

/** Bảng `react/jsx-runtime` — hai hàm dựng phần tử nằm ở ĐÂY, không nằm trên namespace react. */
export interface JsxRuntime {
  /** Node bọc nhiều con mà không thêm phần tử cha. */
  Fragment: unknown;
  /** Dựng phần tử một con. */
  jsx: JsxFn;
  /** Dựng phần tử nhiều con (mảng). */
  jsxs: JsxFn;
}

/** Bảng `react` — chỉ bốn hook mà row này dùng. */
export interface ReactHooks {
  /**
   * Khai một ô trạng thái cục bộ.
   * Nhận: giá trị đầu (hoặc hàm sinh giá trị đầu).
   * Trả: cặp [giá trị, hàm đặt giá trị].
   */
  useState<S>(initial: S | (() => S)): [S, (value: S | ((previous: S) => S)) => void];
  /**
   * Khai một ô nhớ bền qua các lần render.
   * Nhận: giá trị đầu.
   * Trả: hộp `{ current }`.
   */
  useRef<T>(initial: T): { current: T };
  /**
   * Chạy hiệu ứng sau khi render.
   * Nhận: hàm hiệu ứng (trả hàm dọn dẹp nếu cần) và mảng phụ thuộc.
   * Trả: không.
   */
  useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  /**
   * Chạy hiệu ứng NGAY sau khi DOM cập nhật (dùng để đo chỗ đặt bảng).
   * Nhận: hàm hiệu ứng (trả hàm dọn dẹp nếu cần) và mảng phụ thuộc.
   * Trả: không.
   */
  useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  /**
   * Sinh một id ổn định trong vòng đời component.
   * Nhận: không.
   * Trả: chuỗi id duy nhất.
   */
  useId(): string;
}

/** Bảng `@galaxy-blackhole/gbh-client-ui-primitives` — chỉ những primitive/icon row này dùng. */
export interface CordisPrimitives {
  /** Dòng có thể mở/đóng quanh nội dung thẻ. */
  DisclosureRow: unknown;
  /** Khối mã có thanh công cụ (nhãn, wrap, copy). */
  CodeBlock: unknown;
  /** Chú thích hiện khi rê chuột. */
  Tooltip: unknown;
  /** Chấm trạng thái. */
  StateDot: unknown;
  /** Icon thùng rác (xoá Plugin). */
  IconTrashOutlineRegular: unknown;
  /** Icon dừng. */
  IconStopFillRegular: unknown;
  /** Icon soi chi tiết. */
  IconInspectOutlineRegular: unknown;
  /** Icon mã nguồn. */
  IconCodeOutlineRegular: unknown;
  /** Icon dấu kiểm. */
  IconCheckOutlineRegular: unknown;
  /** Icon đóng/từ chối. */
  IconCloseOutlineRegular: unknown;
  /** Icon chạy. */
  IconPlayOutlineRegular: unknown;
  /** Icon Plugin Cordis. */
  IconCordisPluginOutlineRegular: unknown;
  /**
   * Đóng một bề mặt nổi khi bấm ra ngoài nó.
   * Nhận: ref gốc, cờ đang mở, hàm đặt cờ.
   * Trả: không.
   */
  useDismissOnOutsidePointer(
    ref: { readonly current: unknown },
    open: boolean,
    setOpen: (value: boolean | ((previous: boolean) => boolean)) => void,
  ): void;
}

/** Bộ chạy mà mọi component của row dùng chung — dựng MỘT lần trong `createPlugin`. */
export interface CordisRuntime {
  /** `react/jsx-runtime`. */
  jsx: JsxRuntime;
  /** `react`. */
  react: ReactHooks;
  /** `@galaxy-blackhole/gbh-client-ui-primitives`. */
  primitives: CordisPrimitives;
}

/**
 * Dựng bộ chạy từ bảng module của tầng nạp (đúng bốn lệnh require đầu của factory gốc).
 * Nhận: requireFn — hàm require do bảng module cấp.
 * Trả: bộ chạy { jsx, react, primitives } dùng cho mọi component của row.
 */
export function createRuntime(requireFn: RequireFn): CordisRuntime {
  const jsx = requireFn("react/jsx-runtime") as JsxRuntime;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as CordisPrimitives;
  const react = requireFn("react") as ReactHooks;
  return { jsx, react, primitives };
}

/** Hàm dịch của một namespace từ điển (khoá + tham số nội suy). */
export type Translate = (key: string, params?: Readonly<Record<string, unknown>>) => string;

/** Hàm đọc state do renderer bơm vào component (theo dõi một observable bằng selector). */
export type UseObservable<T> = <S>(selector: (value: T) => S) => S;
