/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dung bo cong cu render cua row tu bang module cua loader: React, react-dom, nguyen thu UI va seed kho
 */

import type { Primitives, ReactHooks, RenderDeps } from "./types.ts";
import type { JsxRuntime } from "./types.ts";
import { loadStoreModule, type StoreModule } from "./store.ts";

/** Module react: chi hook, KHONG co jsx/jsxs (hai ham do nam o react/jsx-runtime). */
type ReactModule = ReactHooks;

/** Module react-dom: lop phu duoc render qua portal. */
interface ReactDomModule {
  /** Render mot cay con vao mot nut ngoai cay hien tai. */
  createPortal: (children: unknown, container: unknown) => unknown;
}

/** Bo cong cu render kem seed kho ma plugin dung chung. */
export interface Runtime {
  /** Bo cong cu JSX/React/nguyen thu. */
  readonly deps: RenderDeps;
  /** Seed kho cua vo (createSnapshotStore + shallowEqual). */
  readonly store: StoreModule;
}

/**
 * Nap cac seed nen tang ma bundle goc cung require, roi gom thanh bo cong cu render.
 * @param requireFn - ham nap module cua bang module trang.
 * @returns bo cong cu render va seed kho.
 */
export function loadRuntime(requireFn: (specifier: string) => unknown): Runtime {
  const jsxRuntime = requireFn("react/jsx-runtime") as JsxRuntime;
  const react = requireFn("react") as ReactModule;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as Primitives;
  const createPortal = (requireFn("react-dom") as ReactDomModule).createPortal;
  return {
    deps: { jsxRuntime, react, primitives, createPortal },
    store: loadStoreModule(requireFn),
  };
}
