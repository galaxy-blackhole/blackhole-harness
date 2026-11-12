/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Thanh cong cu thu phong noi: vua rong, cac muc co dinh va nut tang/giam
 */

import { zoomControlsStyles as S } from "../class-names.ts";
import { MAX_ZOOM, MIN_FIXED_ZOOM, ZOOM_OPTIONS, ZOOM_STEP } from "./types.ts";
import type { JsxRuntimeLike, ReactLike } from "../types.ts";

/** Primitive ma thanh thu phong dung. */
export interface ZoomControlsPrimitivesLike {
  /** Nut cua DSH. */
  Button: unknown;
  /** Menu noi. */
  Menu: unknown;
  /** Chu thich noi. */
  Tooltip: unknown;
  /** Bieu tuong muon xuong. */
  IconChevronDownOutlineRegular: unknown;
  /** Bieu tuong cong. */
  IconPlusOutlineRegular: unknown;
}

/** Nhan da dich cua thanh thu phong. */
export interface ZoomLabels {
  /** Nhan cua ca thanh. */
  controls: string;
  /** Nhan cua menu chon ti le. */
  menu: string;
  /** Nhan nut thu nho. */
  out: string;
  /** Nhan nut phong to. */
  into: string;
  /** Nhan nut vua rong. */
  fitWidth: string;
  /** Dinh dang mot ti le phan tram. */
  value(percent: number): string;
}

/** Props ma thanh thu phong nhan. */
export interface ZoomControlsProps {
  /** Ti le dang hien. */
  zoom: number;
  /** Co dang o che do vua rong khong. */
  fitWidth: boolean;
  /** Nhan da dich. */
  labels: ZoomLabels;
  /** Thanh co dang hien khong. */
  visible: boolean;
  /** Nguoi dung chon mot ti le co dinh. */
  onZoom(next: number): void;
  /** Nguoi dung chon vua rong. */
  onFitWidth(): void;
  /** Bao rang thanh dang duoc dung (mo, hover hoac focus). */
  onActiveChange(active: boolean): void;
}

/**
 * Di mot buoc ti le theo huong cho truoc, kep trong khoang cho phep.
 * Nhan: zoom — ti le hien tai; direction — -1 de thu nho, 1 de phong to.
 * Tra: ti le moi.
 */
export function steppedZoom(zoom: number, direction: number): number {
  const step = direction === -1 ? Math.ceil(zoom / ZOOM_STEP) - 1 : Math.floor(zoom / ZOOM_STEP) + 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_FIXED_ZOOM, step * ZOOM_STEP));
}

/**
 * Dung thanh thu phong noi dung chung cho moi renderer co thu phong.
 * Nhan: runtime — jsx runtime; react — hook cua react; primitives — primitive cua DSH.
 * Tra: component (co forwardRef) nhan props cua thanh thu phong.
 */
export function createZoomControls(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  primitives: ZoomControlsPrimitivesLike,
): unknown {
  const { jsx, jsxs } = runtime;
  const { useState, useEffect, forwardRef, useImperativeHandle } = react;

  const ZoomControls = forwardRef(function ZoomControls(props: ZoomControlsProps, ref: unknown): unknown {
    const { zoom, fitWidth, labels, visible, onZoom, onFitWidth, onActiveChange } = props;
    const [displayZoom, setDisplayZoom] = useState(zoom);
    const [open, setOpen] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    useImperativeHandle(ref, () => ({ showZoom: setDisplayZoom }), []);
    useEffect(() => { onActiveChange(open || hovered || focused); }, [focused, hovered, onActiveChange, open]);
    const items = [
      { id: "fit-width", label: labels.fitWidth },
      { type: "separator", id: "fit-scale" },
      ...ZOOM_OPTIONS.map((value) => ({ id: String(value), label: labels.value(value * 100) })),
    ];
    const selectedId = fitWidth ? "fit-width" : ZOOM_OPTIONS.includes(displayZoom) ? String(displayZoom) : undefined;
    return jsxs("div", {
      className: S.panel + " " + (visible ? S.visible : ""),
      role: "toolbar",
      "aria-label": labels.controls,
      "data-document-zoom-controls": true,
      "data-document-zoom-visible": visible || undefined,
      onPointerEnter: () => { setHovered(true); },
      onPointerLeave: () => { setHovered(false); },
      onFocusCapture: () => { setFocused(true); },
      onBlurCapture: () => { setFocused(false); },
      children: [
        jsx(primitives.Tooltip, {
          label: labels.out,
          side: "top",
          children: jsx("span", {
            className: S.controlAnchor,
            children: jsx(primitives.Button, {
              size: "sm",
              className: S.zoomButton,
              "aria-label": labels.out,
              disabled: displayZoom <= MIN_FIXED_ZOOM,
              onMouseDown: (event: { preventDefault(): void }) => { event.preventDefault(); },
              onClick: () => { onZoom(steppedZoom(displayZoom, -1)); },
              children: jsx("svg", {
                width: "14",
                height: "14",
                viewBox: "0 0 16 16",
                "aria-hidden": "true",
                children: jsx("path", { d: "M2 8h12", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
              }),
            }),
          }),
        }),
        jsx(primitives.Menu, {
          open,
          side: "top",
          align: "start",
          portal: true,
          compact: true,
          listClassName: S.zoomMenu,
          anchor: jsxs(primitives.Button, {
            size: "sm",
            className: S.percent,
            "aria-label": labels.menu,
            "aria-expanded": open,
            onMouseDown: (event: { preventDefault(): void }) => { event.preventDefault(); },
            onClick: () => { setOpen((value) => !value); },
            children: [
              jsx("span", { children: labels.value(Math.round(displayZoom * 100)) }),
              jsx(primitives.IconChevronDownOutlineRegular, { size: 12 }),
            ],
          }),
          items,
          selectedId,
          onClose: () => { setOpen(false); },
          onSelect: (selected: string) => {
            setOpen(false);
            if (selected === "fit-width") onFitWidth();
            else onZoom(Number(selected));
          },
        }),
        jsx(primitives.Tooltip, {
          label: labels.into,
          side: "top",
          children: jsx("span", {
            className: S.controlAnchor,
            children: jsx(primitives.Button, {
              size: "sm",
              className: S.zoomButton,
              "aria-label": labels.into,
              disabled: displayZoom >= MAX_ZOOM,
              onMouseDown: (event: { preventDefault(): void }) => { event.preventDefault(); },
              onClick: () => { onZoom(steppedZoom(displayZoom, 1)); },
              children: jsx(primitives.IconPlusOutlineRegular, { size: 14 }),
            }),
          }),
        }),
      ],
    });
  });
  return ZoomControls;
}
