/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tiêu đề tab cây thư mục: biểu tượng thư mục rồi tới tên tab.
 */

import { FILES_BODY_CLASS } from "./body-css.ts";
import type { FilesPrimitivesLike, JsxRuntimeLike } from "./types.ts";

/** Props mà khe cắm bơm cho tiêu đề tab. */
export interface FilesTitleProps {
  /** Thông tin tab đang mở. */
  useTabInfo: () => { tab: { title?: string } };
}

/**
 * Dựng tiêu đề tab cây thư mục.
 * Nhận: runtime — jsx runtime của trang; primitives — primitive của DSH (lấy FileTypeIcon).
 * Trả: component nhận props của khe cắm và vẽ biểu tượng thư mục kèm tên tab.
 */
export function createFilesTitle(
  runtime: JsxRuntimeLike,
  primitives: FilesPrimitivesLike,
): (props: FilesTitleProps) => unknown {
  const { jsx, jsxs, Fragment } = runtime;
  return (props: FilesTitleProps): unknown => {
    const { tab } = props.useTabInfo();
    return jsxs(Fragment, {
      children: [
        jsx(primitives.FileTypeIcon, { kind: "folder", size: 16, className: FILES_BODY_CLASS.titleIcon }),
        tab.title,
      ],
    });
  };
}
