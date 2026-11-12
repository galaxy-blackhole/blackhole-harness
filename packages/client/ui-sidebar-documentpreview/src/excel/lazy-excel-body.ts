/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chi nap renderer bang tinh khi mo mot workbook duoc ho tro
 */

import { hostFileOf } from "../rpc.ts";
import type { LoadingIndicatorProps } from "../loading-indicator.ts";
import type { JsxRuntimeLike, ReactLike } from "../types.ts";
import { excelFormat } from "./format.ts";

/** Ham nap chunk renderer bang tinh cua chinh goi nay. */
export type LoadExcelBody = () => Promise<{ ExcelBody: unknown }>;

/**
 * Dung than bang tinh treo.
 * Nhan: runtime — jsx runtime; react — hook cua react; LoadingIndicator — vong xoay dung chung;
 *        loadExcel — ham nap chunk client.excel.js cua chinh goi nay.
 * Tra: component nhan props cua slot.
 */
export function createLazyExcelBody(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  LoadingIndicator: (props: LoadingIndicatorProps) => unknown,
  loadExcel: LoadExcelBody,
): (props: Record<string, unknown>) => unknown {
  const { jsx } = runtime;
  const { lazy, Suspense } = react;
  const LoadedExcelBody = lazy(async () => ({ default: (await loadExcel()).ExcelBody }));
  return function LazyExcelBody(props: Record<string, unknown>): unknown {
    const format = excelFormat(hostFileOf(props.resourceAddress as string).path);
    const t = props.t as (key: string) => string;
    const loading = jsx(LoadingIndicator, { label: t("loading") });
    return jsx(Suspense, { fallback: loading, children: jsx(LoadedExcelBody, { ...props, format, loading }) });
  };
}
