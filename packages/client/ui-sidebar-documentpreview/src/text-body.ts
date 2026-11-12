/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Than van ban thuong: cac dong nguon kem dich danh dieu huong toi mot dong
 */

import { clsx } from "./clsx.ts";
import { textPreviewStyles as S } from "./class-names.ts";
import { linesOf } from "./document/lines.ts";
import type { JsxRuntimeLike } from "./types.ts";

/** Props ma than van ban thuong nhan tu slot. */
export interface TextBodyProps {
  /** Noi dung da doc. */
  content: { kind: string; pages: readonly { offset: number; text: string; lines: number }[] };
  /** Bo doc thong tin tab cua khung. */
  useTabInfo: () => { tab: { navigation: { params?: Record<string, unknown> } } };
}

/**
 * Dung than van ban thuong.
 * Nhan: runtime — jsx runtime cua trang.
 * Tra: component ve cac dong nguon kem dich danh dieu huong.
 */
export function createTextBody(runtime: JsxRuntimeLike): (props: TextBodyProps) => unknown {
  const { jsx, jsxs } = runtime;
  return function TextBody({ content, useTabInfo }: TextBodyProps): unknown {
    const { tab } = useTabInfo();
    const params = tab.navigation.params;
    const target = params !== undefined && "line" in params ? (params.line as number | undefined) : undefined;
    if (content.kind !== "text") return null;
    return jsx("div", {
      className: S.textDocument,
      "data-textpreview-plain": true,
      children: content.pages.map((page) => jsx("pre", {
        className: S.page,
        "data-textpreview-page": page.offset,
        children: linesOf(page).map((text, index) => {
          const number = page.offset + index;
          return jsxs("div", {
            className: clsx(S.line, number === target && S.lineTarget),
            "data-textpreview-line": number,
            ...(number === target ? { "data-textpreview-target": number } : {}),
            children: [text, "\n"],
          }, number);
        }),
      }, page.offset)),
    });
  };
}
