/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bo runtime tiem vao row ui-deliverables: jsx, hook React, store va primitives — KHONG import tinh
 */

/** Kieu gia tri bat ky — ban goc doc du lieu phien o dang dong nen noi bo dung any cho de doc. */
export type Any = any;

/** Ham jsx cua react/jsx-runtime (ban goc goi truc tiep, khong qua JSX). */
export type JsxFn = (type: Any, props: Any, key?: Any) => Any;

/** Hook React ma row nay dung — nguyen van tap cua ban goc. */
export interface ReactHooks {
  /** Trang thai cuc bo. */
  useState: Any;
  /** O nho. */
  useRef: Any;
  /** Hieu ung vong doi. */
  useEffect: Any;
  /** Id on dinh cho aria. */
  useId: Any;
  /** Ghi nho gia tri dan xuat. */
  useMemo: Any;
}

/** Store cua DSH ma row nay dung (createSnapshotStore + defineStore). */
export interface StoreModule {
  /** Tao store chup anh (snapshot) voi trang thai bat bien. */
  createSnapshotStore: Any;
  /** Khai bao store cua mot tab voi init/actions. */
  defineStore: Any;
}

/** Bo runtime ma createPlugin nap mot lan roi moi module doc lai. */
export interface DeliverablesRuntime {
  /** Tao mot node. */
  jsx: JsxFn;
  /** Tao mot node nhieu con. */
  jsxs: JsxFn;
  /** Node trong. */
  Fragment: Any;
  /** Hook React. */
  react: ReactHooks;
  /** Store cua DSH. */
  store: StoreModule;
  /** Primitive cua DSH (Button, Menu, PathLabel, Tooltip, icon...). */
  primitives: Any;
}

/** Runtime dang dung; null khi chua nap — moi loi goi som deu nem ro rang thay vi undefined im lang. */
let current: DeliverablesRuntime | null = null;

/**
 * Nap runtime mot lan cho ca row; createPlugin goi truoc khi dung bat ky component nao.
 * Nhan: value — bo runtime (jsx, hook, store, primitives).
 * Tra: khong co.
 */
export function setRuntime(value: DeliverablesRuntime): void {
  current = value;
}

/**
 * Doc runtime dang dung.
 * Nhan: khong co.
 * Tra: bo runtime da nap.
 */
export function runtime(): DeliverablesRuntime {
  if (current === null) throw new Error("gbh-client-ui-deliverables: runtime chua duoc nap (thieu setRuntime)");
  return current;
}

/**
 * Doc mot primitive theo ten — giu nguyen loi goi dong cua ban goc ma khong can khai kieu tung cai.
 * Nhan: name — ten primitive (vi du "Button").
 * Tra: primitive do.
 */
export function primitive(name: string): Any {
  const value = runtime().primitives[name];
  if (value === undefined) throw new Error("gbh-client-ui-deliverables: primitive \"" + name + "\" khong co trong runtime");
  return value;
}

/**
 * Node trong cua react/jsx-runtime, doc muon (chi co sau khi nap runtime).
 * Nhan: khong co.
 * Tra: gia tri Fragment cua runtime dang dung.
 */
export function fragment(): Any {
  return runtime().Fragment;
}

/**
 * Tao mot node — vo mong doc runtime, de mo dun port giu nguyen loi goi cua ban goc.
 * Nhan: type — loai node; props — thuoc tinh; key — khoa tuy chon.
 * Tra: node da tao.
 */
export const jsx: JsxFn = (type: Any, props: Any, key?: Any): Any => runtime().jsx(type, props, key);

/**
 * Tao mot node nhieu con — vo mong doc runtime.
 * Nhan: type — loai node; props — thuoc tinh; key — khoa tuy chon.
 * Tra: node da tao.
 */
export const jsxs: JsxFn = (type: Any, props: Any, key?: Any): Any => runtime().jsxs(type, props, key);

/**
 * Trang thai cuc bo cua mot component — vo mong doc runtime.
 * Nhan: initial — gia tri dau (hoac ham tra gia tri dau).
 * Tra: cap [gia tri, ham dat].
 */
export const useState: Any = (initial: Any): Any => runtime().react.useState(initial);

/**
 * O nho cua mot component — vo mong doc runtime.
 * Nhan: initial — gia tri dau.
 * Tra: doi tuong { current }.
 */
export const useRef: Any = (initial: Any): Any => runtime().react.useRef(initial);

/**
 * Hieu ung vong doi cua mot component — vo mong doc runtime.
 * Nhan: run — than hieu ung; deps — mang phu thuoc tuy chon.
 * Tra: khong co.
 */
export const useEffect: Any = (run: Any, deps?: Any): Any => runtime().react.useEffect(run, deps);

/**
 * Id on dinh cho aria — vo mong doc runtime.
 * Nhan: khong co.
 * Tra: chuoi id.
 */
export const useId: Any = (): Any => runtime().react.useId();

/**
 * Ghi nho gia tri dan xuat — vo mong doc runtime.
 * Nhan: factory — ham tinh; deps — mang phu thuoc.
 * Tra: gia tri da ghi nho.
 */
export const useMemo: Any = (factory: Any, deps?: Any): Any => runtime().react.useMemo(factory, deps);
