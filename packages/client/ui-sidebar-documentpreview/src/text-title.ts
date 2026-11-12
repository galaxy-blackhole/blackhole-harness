/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tieu de tab: bieu tuong theo loai tep roi toi ten tab
 */

import { textPreviewStyles as S } from "./class-names.ts";
import type { JsxRuntimeLike } from "./types.ts";

/** Primitive ma tieu de tab dung. */
export interface TitlePrimitivesLike {
  /** Bieu tuong theo loai tep. */
  FileTypeIcon: unknown;
  /** Phan loai loai tep theo ten. */
  classifyFileType(name: string): string;
}

/** Props ma tieu de tab nhan tu slot. */
export interface TextTitleProps {
  /** Bo doc thong tin tab cua khung. */
  useTabInfo: () => { tab: { title: string } };
}

/**
 * Dung tieu de tab van ban.
 * Nhan: runtime — jsx runtime cua trang; primitives — primitive cua DSH.
 * Tra: component ve bieu tuong 16px roi ten tab.
 */
export function createTextTitle(runtime: JsxRuntimeLike, primitives: TitlePrimitivesLike): (props: TextTitleProps) => unknown {
  const { jsx, jsxs, Fragment } = runtime;
  return function TextTitle({ useTabInfo }: TextTitleProps): unknown {
    const { tab } = useTabInfo();
    return jsxs(Fragment, {
      children: [
        jsx(primitives.FileTypeIcon, { kind: primitives.classifyFileType(tab.title), size: 16, className: S.titleIcon }),
        tab.title,
      ],
    });
  };
}
