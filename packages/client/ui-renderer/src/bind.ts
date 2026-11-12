/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Port 1:1 `use-sync-external-store/shim/with-selector` + `bindSnapshotSelector` cua bundle goc
 */
import type { HostObservable, SnapshotSelectorHook } from "./slots-api.ts";

/**
 * Bảng hook React mà tầng này cần — LẤY TỪ BẢNG MODULE CỦA TRANG, không import tĩnh.
 *
 * Vì sao không `import ... from "react"`: bundle nửa client là **script classic** nạp bằng thẻ
 * `<script>`; React do trang cấp qua `require` của bảng module (hợp đồng C2). Import tĩnh sẽ khiến Bun
 * nhúng bản sao React thứ hai vào bundle ⇒ hai thể hiện React ⇒ hook nổ.
 */
export interface ReactHooksSeam {
  /** Hộp giữ giá trị bền qua các lần render. */
  useRef<T>(initial: T): { current: T };
  /** Ghi nhớ giá trị theo phụ thuộc. */
  useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  /** Hiệu ứng sau khi vẽ. */
  useEffect(effect: () => void, deps: readonly unknown[]): void;
  /** Nhãn gỡ lỗi của DevTools (tuỳ chọn — shim gốc gọi vô điều kiện). */
  useDebugValue?(value: unknown): void;
  /** Đăng ký với một kho ngoài React (React 18). */
  useSyncExternalStore<Snapshot>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => Snapshot,
    getServerSnapshot?: () => Snapshot,
  ): Snapshot;
}

/** Chữ ký đầy đủ của `useSyncExternalStoreWithSelector` (shim gốc). */
export type UseSyncExternalStoreWithSelector = <Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: (() => Snapshot) | undefined,
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (left: Selection, right: Selection) => boolean,
) => Selection;

/** So sánh theo `Object.is`, có fallback đúng ngữ nghĩa của shim (−0 === 0 và NaN === NaN). */
const objectIs: (left: unknown, right: unknown) => boolean =
  typeof Object.is === "function"
    ? Object.is
    : (left, right) => (left === right && (left !== 0 || 1 / (left as number) === 1 / (right as number))) || (left !== left && right !== right);

/**
 * Dựng bản port 1:1 của `useSyncExternalStoreWithSelector` (bundle gốc dòng 87–141).
 *
 * Vì sao port thay vì import: shim là thư viện NHÚNG trong bundle gốc (`__commonJSMin`); React 18 của
 * trang đã có `useSyncExternalStore`, nên chỉ còn phần "with selector". Giữ NGUYÊN thuật toán — kể cả
 * `inst.hasValue`/`inst.value` cập nhật trong `useEffect` và memo hoá `getServerSnapshot` — vì đó là
 * thứ quyết định component `React.memo` có re-render hay không khi selector trả giá trị bằng nhau.
 *
 * Nhận: `hooks` — bảng hook React lấy từ bảng module của trang.
 * Trả: hàm `useSyncExternalStoreWithSelector`.
 */
export function createWithSelector(hooks: ReactHooksSeam): UseSyncExternalStoreWithSelector {
  const { useRef, useMemo, useEffect, useDebugValue, useSyncExternalStore } = hooks;
  return function useSyncExternalStoreWithSelector<Snapshot, Selection>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => Snapshot,
    getServerSnapshot: (() => Snapshot) | undefined,
    selector: (snapshot: Snapshot) => Selection,
    isEqual?: (left: Selection, right: Selection) => boolean,
  ): Selection {
    let instRef = useRef<{ hasValue: boolean; value: Selection | null } | null>(null);
    if (instRef.current === null) instRef.current = { hasValue: false, value: null };
    const inst = instRef.current;
    const pair = useMemo(() => {
      let hasMemo = false;
      let memoizedSnapshot: Snapshot;
      let memoizedSelection: Selection;
      /**
       * Chọn giá trị có ghi nhớ — lõi của shim.
       * Nhận: `nextSnapshot` — ảnh chụp mới.
       * Trả: lựa chọn (giữ nguyên tham chiếu khi bằng theo `isEqual`).
       */
      function memoizedSelector(nextSnapshot: Snapshot): Selection {
        if (!hasMemo) {
          hasMemo = true;
          memoizedSnapshot = nextSnapshot;
          const nextSelection = selector(nextSnapshot);
          if (isEqual !== undefined && inst.hasValue) {
            const currentSelection = inst.value as Selection;
            if (isEqual(currentSelection, nextSelection)) return (memoizedSelection = currentSelection);
          }
          return (memoizedSelection = nextSelection);
        }
        const currentSelection = memoizedSelection;
        if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection;
        const nextSelection = selector(nextSnapshot);
        if (isEqual !== undefined && isEqual(currentSelection, nextSelection)) {
          memoizedSnapshot = nextSnapshot;
          return currentSelection;
        }
        memoizedSnapshot = nextSnapshot;
        return (memoizedSelection = nextSelection);
      }
      const maybeGetServerSnapshot = getServerSnapshot === undefined ? null : getServerSnapshot;
      return [
        () => memoizedSelector(getSnapshot()),
        maybeGetServerSnapshot === null ? undefined : () => memoizedSelector(maybeGetServerSnapshot()),
      ] as const;
    }, [getSnapshot, getServerSnapshot, selector, isEqual]);
    const value = useSyncExternalStore(subscribe, pair[0], pair[1]);
    useEffect(() => {
      inst.hasValue = true;
      inst.value = value;
    }, [value]);
    useDebugValue?.(value);
    return value;
  };
}

/**
 * Nối một nguồn observable trần vào hook chọn có kiểu (bản gốc: `bindSnapshotSelector`, dòng 147–161).
 *
 * `subscribe`/`getSnapshot` được chụp MỘT LẦN cho mỗi nguồn thành closure ổn định (đồng thời buộc
 * `this` cho nguồn dạng method), nên component không bao giờ đăng ký lại giữa các lần render. Hàm so
 * sánh mặc định: `Object.is` (uSES tự dùng).
 *
 * Nhận: `hooks` — bảng hook React lấy từ bảng module của trang.
 * Trả: `bindSnapshotSelector(w)` — nhận nguồn và trả hook chọn.
 */
export function createBindSnapshotSelector(hooks: ReactHooksSeam): <T>(w: HostObservable<T>) => SnapshotSelectorHook<T> {
  const withSelector = createWithSelector(hooks);
  return function bindSnapshotSelector<T>(w: HostObservable<T>): SnapshotSelectorHook<T> {
    const subscribe = (fn: () => void): (() => void) => w.subscribe(fn);
    const getSnapshot = (): T => w.getSnapshot();
    /**
     * Hook chọn giá trị của nguồn này.
     * Nhận: `selector` — hàm chọn (mặc định: giữ nguyên), `equal` — hàm so sánh (mặc định: Object.is).
     * Trả: giá trị đã chọn.
     */
    return function useSelector<S = T>(selector?: (value: T) => S, equal?: (left: S, right: S) => boolean): S {
      // Bản gốc truyền `sel` trần; khi vắng selector shim sẽ ném. Ta giữ tham chiếu identity để một
      // component gọi `useX()` không biến thành lỗi thời gian chạy — hành vi với selector HỢP LỆ là y hệt.
      return withSelector(subscribe, getSnapshot, undefined, selector ?? ((value: T) => value as unknown as S), equal);
    };
  };
}
/**
 * Module `react` đầy đủ mà tầng renderer cần — LẤY TỪ BẢNG MODULE CỦA TRANG (không import tĩnh).
 * Hình dạng thật của `react` 18: KHÔNG có `jsx`/`jsxs` (chúng ở `react/jsx-runtime`) — xem luật
 * "stub phải hẹp bằng hoặc hẹp hơn module thật".
 */
export interface ReactModule extends ReactHooksSeam {
  /** Tạo context React. */
  createContext<T>(initial: T): unknown;
  /** Đọc giá trị context. */
  useContext<T>(context: unknown): T;
  /** Dựng element (dùng cho `BootHandoff` — bản gốc gọi `react.createElement`). */
  createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown;
  /** Trạng thái cục bộ. */
  useState<S>(initial: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void];
  /** Hiệu ứng trước khi vẽ. */
  useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  /** Lớp nền của error boundary (`class X extends react.Component`). */
  Component: new (props: Record<string, unknown>) => {
    /** Prop của instance. */
    props: Record<string, unknown>;
    /** State của instance. */
    state: Record<string, unknown>;
    /** Ghi state. */
    setState(next: Record<string, unknown>): void;
    /** Vẽ. */
    render(): unknown;
  };
}
