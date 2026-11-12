/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mot dong cua the chon: nhan, dau nho, mo ta va dau check — nguyen van cay render cua ban goc
 */

import type { PopupSelectController } from "../popup.ts";
import type { JsxRuntimeLike, PrimitivesLike, SelectOptionLike } from "../types.ts";
import { CLASS } from "./css.ts";
import { classes } from "./class-names.ts";

/** Ham ve mot dong cua the chon. */
export type OptionRowRenderer = (option: SelectOptionLike, index: number, active: number, popup: PopupSelectController<never>) => unknown;

/**
 * Dung ham ve mot dong cua the chon.
 * Nhan: runtime — react/jsx-runtime; primitives — seam ui-primitives (lay bieu tuong check).
 * Tra: ham ve nhan (option, index, active, popup) -> node.
 */
export function createOptionRow(runtime: JsxRuntimeLike, primitives: PrimitivesLike): OptionRowRenderer {
  return (option: SelectOptionLike, index: number, active: number, popup: PopupSelectController<never>): unknown => {
    const selected = index === active;
    return runtime.jsxs(
      "div",
      {
        role: "option",
        "aria-selected": selected,
        "aria-label": option.badge === undefined ? undefined : option.label + " " + option.badge,
        className: classes(CLASS.row, selected && CLASS.rowActive),
        onClick: (): void => {
          void popup.select(index);
        },
        onMouseEnter: (): void => {
          popup.highlight(index);
        },
        children: [
          runtime.jsxs(
            "span",
            {
              className: CLASS.label,
              children: [
                runtime.jsx("span", { className: CLASS.labelText, children: option.label }),
                option.badge !== undefined && runtime.jsx("sup", { className: CLASS.badge, children: option.badge }),
              ],
            },
            undefined,
          ),
          option.detail !== undefined && runtime.jsx("span", { className: CLASS.detail, children: option.detail }, undefined),
          option.active === true && runtime.jsx("span", { className: CLASS.check, children: runtime.jsx(primitives.IconCheckOutlineRegular, {}, undefined) }, undefined),
        ],
      },
      option.id,
    );
  };
}
