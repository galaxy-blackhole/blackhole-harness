/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bieu tuong chinh sach sandbox — giu nguyen SVG goc cua DSH (parity icon)
 */

import type { JsxRuntimeLike } from "../types.ts";

/** Duong ve khien cua bieu tuong khi sandbox DANG bat (nguyen van tu bundle goc). */
export const SANDBOX_ON_PATH =
  "M12.1654 5.7552L8.9447 9.41475C8.73044 9.65816 8.53628 9.8804 8.35774 10.0423C8.1713 10.2114 7.94235 10.3717 7.64016 10.4254C7.48207 10.4535 7.32 10.4552 7.16151 10.4294C6.85843 10.3801 6.62728 10.2223 6.43836 10.0559C6.25752 9.89653 6.06037 9.67732 5.84264 9.43705L4.72925 8.20897L5.63557 7.38707L6.74897 8.61594C6.98603 8.87755 7.12974 9.03533 7.24673 9.13839C7.31033 9.19443 7.34485 9.21476 7.35823 9.22122C7.38068 9.22484 7.40352 9.22515 7.42593 9.22122C7.40522 9.22502 7.42893 9.23294 7.53583 9.136C7.65132 9.03126 7.79316 8.87139 8.02643 8.60638L11.2479 4.94763L12.1654 5.7552Z";

/** Duong ve khien cua bieu tuong khi sandbox DA TAT (nguyen van tu bundle goc). */
export const SANDBOX_OFF_PATH =
  "M10.6074 4.40278L8.00975 6.99973L10.6074 9.59739L9.59736 10.6074L6.9997 8.00978L4.40274 10.6074L3.3927 9.59739L5.98966 6.99973L3.3927 4.40278L4.40274 3.39273L6.9997 5.98969L9.59736 3.39273L10.6074 4.40278Z";

/** Phan cua ui-primitives ma bieu tuong nay can. */
export interface SandboxIconPrimitivesLike {
  /** Duong ve khien cua ban goc. */
  SHIELD_OUTLINE_PATH: string;
  /** Do day net ve thuong cua bo icon. */
  ICON_REGULAR_STROKE: number;
}

/**
 * Dung bieu tuong chinh sach sandbox.
 * Nhan: runtime — jsx runtime; primitives — phan ui-primitives can dung.
 * Tra: component nhan prop `sandboxed`.
 */
export function createSandboxPolicyIcon(
  runtime: JsxRuntimeLike,
  primitives: SandboxIconPrimitivesLike,
): (props: { sandboxed: boolean }) => unknown {
  const { jsx, jsxs } = runtime;
  return function SandboxPolicyIcon(props: { sandboxed: boolean }): unknown {
    return jsxs("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 16 16",
      fill: "none",
      "aria-hidden": true,
      children: [
        jsx("path", {
          d: primitives.SHIELD_OUTLINE_PATH,
          stroke: "currentColor",
          strokeWidth: primitives.ICON_REGULAR_STROKE,
          strokeLinejoin: "round",
        }),
        props.sandboxed
          ? jsx("path", { d: SANDBOX_ON_PATH, fill: "currentColor" })
          : jsx("path", { d: SANDBOX_OFF_PATH, fill: "currentColor", transform: "translate(1.2 0.8)" }),
      ],
    });
  };
}
