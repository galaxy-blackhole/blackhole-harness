/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chi nap renderer PDF sau khi mot than PDF duoc mount
 */

import type { LoadingIndicatorProps } from "../loading-indicator.ts";
import type { JsxRuntimeLike, ReactLike } from "../types.ts";

/** Ham nap chunk renderer PDF cua chinh goi nay. */
export type LoadPdfBody = () => Promise<{ PdfBody: unknown }>;

/**
 * Dung than PDF treo.
 * Nhan: runtime — jsx runtime; react — hook cua react; LoadingIndicator — vong xoay dung chung;
 *        loadPdf — ham nap chunk client.pdf.js cua chinh goi nay.
 * Tra: component nhan props cua slot.
 */
export function createLazyPdfBody(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  LoadingIndicator: (props: LoadingIndicatorProps) => unknown,
  loadPdf: LoadPdfBody,
): (props: Record<string, unknown>) => unknown {
  const { jsx } = runtime;
  const { lazy, Suspense } = react;
  const LoadedPdfBody = lazy(async () => ({ default: (await loadPdf()).PdfBody }));
  return function LazyPdfBody(props: Record<string, unknown>): unknown {
    const t = props.t as (key: string) => string;
    const loading = jsx(LoadingIndicator, { label: t("loading") });
    return jsx(Suspense, { fallback: loading, children: jsx(LoadedPdfBody, { ...props, loading }) });
  };
}
