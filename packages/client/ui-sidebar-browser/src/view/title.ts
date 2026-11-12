/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tieu de tab trinh duyet: bieu tuong qua dia cau + ten mien dang mo
 */

import { currentBrowserTarget } from "../persistence.ts";
import type { BrowserState } from "../store.ts";
import { CLASS } from "./css.ts";
import type { JsxRuntimeLike, TabInfoLike } from "../types.ts";

/** Phan cua ui-primitives ma tieu de tab can. */
export interface BrowserTitlePrimitivesLike {
  /** Bieu tuong qua dia cau cua bo primitive. */
  IconGlobeOutlineRegular: unknown;
}

/** Props ma cho ngoi tieu de tab bom cho tieu de trinh duyet. */
export interface BrowserTitleProps {
  /** Hook thong tin tab. */
  useTabInfo: () => TabInfoLike;
  /** Hook doc store checkpoint. */
  useStore: <S>(selector: (state: BrowserState) => S) => S;
}

/**
 * Dung tieu de tab trinh duyet.
 * Nhan: runtime — jsx runtime; primitives — phan ui-primitives can dung.
 * Tra: component nhan props cua cho ngoi tieu de.
 */
export function createBrowserTitle(
  runtime: JsxRuntimeLike,
  primitives: BrowserTitlePrimitivesLike,
): (props: BrowserTitleProps) => unknown {
  const { jsx, jsxs, Fragment } = runtime;
  return function BrowserTitle(props: BrowserTitleProps): unknown {
    const { tab } = props.useTabInfo();
    const entry = props.useStore((state) => currentBrowserTarget(state.byTab[tab.id]));
    return jsxs(Fragment, {
      children: [
        jsx(primitives.IconGlobeOutlineRegular, { className: CLASS.titleIcon }),
        entry?.title ?? tab.title,
      ],
    });
  };
}
