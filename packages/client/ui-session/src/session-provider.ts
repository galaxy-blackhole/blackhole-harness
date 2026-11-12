/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nguồn Session dựng sẵn và hàm render vùng Session (nhánh rỗng hoặc cây con đã chọn)
 */

import type { JsxRuntimeLike } from "./types.ts";

/** Props chuẩn của vùng Session khi render. */
export interface SessionAreaProps {
  /** Nhánh hiện khi chưa chọn phiên nào. */
  empty?: () => unknown;
  /** Cây con của phiên đang chọn. */
  children?: unknown;
}

/** Một liên kết phạm vi Session đã được vật chất hoá. */
export interface SessionBinding {
  /** Khoá phiên; undefined nghĩa là "không có phiên". */
  key?: string;
  /** Context của phiên, nếu có. */
  ctx?: unknown;
  /** Hook theo phiên. */
  hooks: Record<string, unknown>;
  /** Hook theo khoá. */
  keyedHooks: Record<string, (key: string) => unknown>;
  /** Prop theo phiên. */
  props: Record<string, unknown>;
}

/**
 * Render thân của phiên đang chọn, hoặc nhánh rỗng của nó.
 * Nhận: liên kết phạm vi hiện tại và props render chuẩn của vùng Session.
 * Trả: cây con của phiên đang chọn, hoặc nhánh rỗng.
 */
export function renderSessionArea(
  runtime: JsxRuntimeLike,
  binding: SessionBinding,
  props: SessionAreaProps,
): unknown {
  const { jsx, Fragment } = runtime;
  if (binding.key === undefined) return jsx(Fragment, { children: props.empty?.() ?? null });
  return jsx(Fragment, { children: props.children });
}
