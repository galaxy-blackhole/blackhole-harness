/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dang ky ban xem bang tinh tren trinh duyet va slot do vong doi so huu
 */

import { EXCEL_BINARY_EXTENSIONS, EXCEL_BODY_ID, EXCEL_EXTENSIONS, LOADING_BYTES_COMPLETE, PRIORITY_BUILTIN } from "../ids.ts";
import { NS_EXCEL, excelEn, excelZh } from "../locales.ts";
import { createLazyExcelBody } from "./lazy-excel-body.ts";
import type { DocumentPreviewRegistry } from "../document/registry.ts";
import type { ClientContextLike } from "../types.ts";
import type { ExcelLimits } from "../config.ts";
import type { LoadExcelBody } from "./lazy-excel-body.ts";
import type { JsxRuntimeLike, ReactLike } from "../types.ts";
import type { LoadingIndicatorProps } from "../loading-indicator.ts";
import { viExcel } from "../locales-vi.ts";

/** Moi thu ma ban xem bang tinh can. */
export interface ExcelKindEnvironment {
  /** So ban xem tai lieu. */
  previews: DocumentPreviewRegistry;
  /** jsx runtime cua trang. */
  runtime: JsxRuntimeLike;
  /** Hook cua react. */
  react: ReactLike;
  /** Vong xoay dung chung. */
  LoadingIndicator: (props: LoadingIndicatorProps) => unknown;
  /** Ham nap chunk renderer bang tinh. */
  loadExcel: LoadExcelBody;
  /** Gioi han trinh phan tich. */
  limits: ExcelLimits;
}

/**
 * Dang ky ban xem bang tinh.
 * Nhan: ctx — context goc phia client; env — moi thu dung san.
 * Tra: khong.
 */
export function applyExcelKind(ctx: ClientContextLike, env: ExcelKindEnvironment): void {
  const id = EXCEL_BODY_ID;
  ctx.effect(() => ctx.locale.register(NS_EXCEL, { vi: viExcel, zh: excelZh, en: excelEn }));
  const t = ctx.locale.bind(NS_EXCEL);
  ctx.effect(() => env.previews.register({ id, extensions: EXCEL_EXTENSIONS, binaryExtensions: EXCEL_BINARY_EXTENSIONS, priority: PRIORITY_BUILTIN, title: () => t("title"), loading: LOADING_BYTES_COMPLETE, wrap: false }));
  const LazyExcelBody = createLazyExcelBody(env.runtime, env.react, env.LoadingIndicator, env.loadExcel);
  ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
    name: "sidebar.right.tab.document",
    key: id,
    locale: NS_EXCEL,
    inject: () => ({ limits: env.limits }),
  }, LazyExcelBody)));
}
