/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Canh bao tren thanh cong cu va phan chi tiet khong chan cho font con thieu cua ban xem hien tai
 */

import { fontNoticeStyles as S } from "../class-names.ts";
import { clsx } from "../clsx.ts";
import { textPreviewStyles as TP } from "../class-names.ts";
import type { JsxRuntimeLike, ReactLike, ReactDomLike } from "../types.ts";

/** Primitive ma canh bao font dung. */
export interface FontNoticePrimitivesLike {
  /** Chu thich noi. */
  Tooltip: unknown;
  /** Nut cua DSH. */
  Button: unknown;
  /** Bieu tuong canh bao. */
  IconWarningTriangleOutlineRegular: unknown;
  /** Bieu tuong dong. */
  IconCloseOutlineRegular: unknown;
  /** Vi tri neo cua bang noi. */
  useAnchoredPosition(spec: Record<string, unknown>): Record<string, unknown> | null;
  /** Dong khi con tro ra ngoai. */
  useDismissOnOutsidePointer(anchor: unknown, open: boolean, close: () => void, panel: unknown): void;
}

/** Props ma canh bao font nhan. */
export interface FontNoticeProps {
  /** Ten cac font con thieu. */
  fonts: readonly string[];
  /** Ham dich cua namespace Office. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Dung canh bao font.
 * Nhan: runtime — jsx runtime; react — hook cua react; reactDom — createPortal; primitives — primitive cua DSH.
 * Tra: component nhan danh sach font thieu.
 */
export function createFontNotice(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  reactDom: ReactDomLike,
  primitives: FontNoticePrimitivesLike,
): (props: FontNoticeProps) => unknown {
  const { jsx, jsxs, Fragment } = runtime;
  const { useState, useRef, useId, useLayoutEffect } = react;
  return function FontNotice({ fonts, t }: FontNoticeProps): unknown {
    const [expanded, setExpanded] = useState(false);
    const open = fonts.length > 0 && expanded;
    const anchor = useRef<HTMLElement | null>(null);
    const panel = useRef<HTMLElement | null>(null);
    const id = useId();
    const position = primitives.useAnchoredPosition({ open, anchorRef: anchor, panelRef: panel, gap: 8, margin: 12 });
    primitives.useDismissOnOutsidePointer(anchor, open, () => { setExpanded(false); }, panel);
    const closeDetails = (): void => {
      setExpanded(false);
      anchor.current?.querySelector("button")?.focus();
    };
    const positioned = position !== null;
    useLayoutEffect(() => {
      if (!open || !positioned) return;
      panel.current?.focus();
    }, [open, positioned]);
    if (fonts.length === 0) return null;
    const label = t("viewMissingFonts", { count: fonts.length });
    return jsxs(Fragment, {
      children: [
        jsx(primitives.Tooltip, {
          label,
          side: "bottom",
          delayMs: 500,
          disabled: open,
          children: jsx("span", {
            ref: anchor,
            className: S.anchor,
            "data-office-font-warning": true,
            children: jsx("button", {
              type: "button",
              className: clsx(TP.tool, S.warning),
              "aria-label": label,
              "aria-expanded": open,
              "aria-controls": open ? id : undefined,
              "aria-haspopup": "dialog",
              onClick: () => { setExpanded((value) => !value); },
              children: jsx(primitives.IconWarningTriangleOutlineRegular, {}),
            }),
          }),
        }),
        open && reactDom.createPortal(jsxs("div", {
          ref: panel,
          id,
          role: "dialog",
          "aria-labelledby": id + "-title",
          "aria-describedby": id + "-description",
          tabIndex: -1,
          className: S.panel,
          style: { ...position, visibility: position === null ? "hidden" : undefined },
          onKeyDown: (event: { key: string; preventDefault(): void; stopPropagation(): void }) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeDetails();
            }
          },
          onBlur: (event: { relatedTarget: unknown; currentTarget: HTMLElement }) => {
            const related = event.relatedTarget;
            if (related instanceof Node && !event.currentTarget.contains(related) && !anchor.current?.contains(related)) setExpanded(false);
          },
          children: [
            jsxs("div", {
              className: S.panelHeader,
              children: [
                jsx("h3", { id: id + "-title", children: t("missingFontsTitle") }),
                jsx(primitives.Button, { size: "sm", "aria-label": t("closeDetails"), onClick: closeDetails, icon: jsx(primitives.IconCloseOutlineRegular, {}) }),
              ],
            }),
            jsx("p", { id: id + "-description", className: S.description, children: t("missingFontsDescription") }),
            jsx("p", { className: S.count, children: t("missingFontsCount", { count: fonts.length }) }),
            jsx("ul", { className: S.fonts, children: fonts.map((font) => jsx("li", { children: font }, font)) }),
          ],
        }), document.body),
      ],
    });
  };
}
