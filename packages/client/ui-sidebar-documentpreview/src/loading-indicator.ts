/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Vong xoay 'dang doc tai lieu' — ban day du va ban noi tiep theo dong
 */

import { clsx } from "./clsx.ts";
import { loadingIndicatorStyles as S } from "./class-names.ts";
import type { JsxRuntimeLike, ReactLike } from "./types.ts";

/** Props ma vong xoay nhan. */
export interface LoadingIndicatorProps {
  /** Nhan trang thai da dich. */
  label: string;
  /** Dat kieu noi tiep gon cho cac trang doc them. */
  inline?: boolean;
}

/** Primitive ma vong xoay dung. */
export interface LoadingPrimitivesLike {
  /** Cham trang thai cua DSH. */
  StateDot: unknown;
}

/**
 * Dung vong xoay 'dang doc tai lieu'.
 * Nhan: runtime — jsx runtime cua trang; primitives — primitive cua DSH (lay StateDot).
 * Tra: component nhan nhan trang thai va cho dat inline.
 */
export function createLoadingIndicator(runtime: JsxRuntimeLike, primitives: LoadingPrimitivesLike): (props: LoadingIndicatorProps) => unknown {
  const { jsx, jsxs } = runtime;
  return function LoadingIndicator({ label, inline = false }: LoadingIndicatorProps): unknown {
    return jsxs("span", {
      className: clsx(S.loading, inline && S.inline),
      role: "status",
      "aria-label": label,
      "data-document-loading": true,
      children: [
        jsx(primitives.StateDot, { state: "ongoing", size: inline ? 14 : 28 }),
        !inline && jsx("span", { children: label }),
      ],
    });
  };
}

/** Kieu cua component vong xoay sau khi dung. */
export type LoadingIndicatorComponent = (props: LoadingIndicatorProps) => unknown;

/** Kieu module react ma factory nay can — chi de tai lieu hoa, khong dung truc tiep. */
export type UnusedReactLike = ReactLike;
