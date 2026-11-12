/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Asset thuong hieu Galaxy Blackhole (logo ho den + favicon + chu thuong hieu) — thay asset DSH, 1 nguon duy nhat
 */

import type { GbhDynamicArtwork, GbhIconArtwork, GbhJsxRuntime } from "./artwork-types.ts";
import { GBH_INSTANCE_TOKEN } from "./artwork-types.ts";
import { renderStaticArtwork } from "./artwork-render.ts";

/**
 * Nguon goc cua asset thuong hieu (G4): file vector chuan trong repo Galaxy.
 * Hai ban sao (electron + web oracle) TRUNG sha256; day la ban duoc chep vao assets/ cua goi nay.
 */
export const GBH_LOGO_SOURCE_PATH = "galaxy-blackhole/blackhole-desktop-electron/host/cli/web/brand/logo.svg";

/** sha256 cua logo.svg goc (kiem bang shasum -a 256) — test N4 doi chieu lai. */
export const GBH_LOGO_SOURCE_SHA256 = "d7fac4b4c9d2b4b876e0e354a6d650cea2249dddb84247179e94b58e564333d9";

/** sha256 cua favicon.svg goc. */
export const GBH_FAVICON_SOURCE_SHA256 = "105ca4ce73ac1dc8707715b700dd16113fb6b8e7fa39af9251d3ca44749c4fc3";

/** viewBox cua logo thuong hieu (vector 128x128, vuong). */
export const GBH_LOGO_VIEWBOX = "0 0 128 128";

/** viewBox cua favicon thuong hieu (vector 64x64). */
export const GBH_FAVICON_VIEWBOX = "0 0 64 64";

/** Chu thuong hieu hien o slot sidebar.brand.name (nguon: oracle A — `GbhBrandName`). */
export const GBH_WORDMARK_TEXT = "Galaxy Blackhole";

/** Co chu thuong hieu (px) — nguyen van tu oracle A. */
export const GBH_WORDMARK_FONT_SIZE = 14;

/** Kieu chu thuong hieu — nguyen van tu oracle A (khong dung font la, khong dat mau). */
export const GBH_WORDMARK_STYLE = Object.freeze({
  fontWeight: 600,
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
} as const);

/**
 * Logo thuong hieu duoi dang artwork: ho den + vanh gradient. Mau nam trong ASSET (khong phai style component)
 * theo C7 P4; id gradient dung token the hien de hai lan render khong tranh id.
 */
export const GBH_LOGO_ARTWORK: GbhIconArtwork = {
  viewBox: GBH_LOGO_VIEWBOX,
  size: 24,
  root: { fill: "none", xmlns: "http://www.w3.org/2000/svg" },
  component: "logo.svg (Galaxy Blackhole)",
  nodes: [
    {
      tag: "defs",
      attrs: {},
      children: [
        {
          tag: "radialGradient",
          attrs: { id: GBH_INSTANCE_TOKEN + "ring", cx: "50%", cy: "50%", r: "50%" },
          children: [
            { tag: "stop", attrs: { offset: "55%", stopColor: "#8b7bff", stopOpacity: "0.05" } },
            { tag: "stop", attrs: { offset: "78%", stopColor: "#8b7bff", stopOpacity: "0.85" } },
            { tag: "stop", attrs: { offset: "92%", stopColor: "#6ee7f0", stopOpacity: "0.9" } },
            { tag: "stop", attrs: { offset: "100%", stopColor: "#6ee7f0", stopOpacity: "0" } },
          ],
        },
        {
          tag: "linearGradient",
          attrs: { id: GBH_INSTANCE_TOKEN + "arc", x1: "18", y1: "30", x2: "110", y2: "98", gradientUnits: "userSpaceOnUse" },
          children: [
            { tag: "stop", attrs: { stopColor: "#a99bff" } },
            { tag: "stop", attrs: { offset: "1", stopColor: "#6ee7f0" } },
          ],
        },
      ],
    },
    { tag: "circle", attrs: { cx: "64", cy: "64", r: "62", fill: "#0b0a14" } },
    { tag: "circle", attrs: { cx: "64", cy: "64", r: "46", fill: "url(#" + GBH_INSTANCE_TOKEN + "ring)" } },
    { tag: "circle", attrs: { cx: "64", cy: "64", r: "22", fill: "#05040a" } },
    { tag: "circle", attrs: { cx: "64", cy: "64", r: "22", stroke: "#a99bff", strokeOpacity: "0.55", strokeWidth: "1.5" } },
    {
      tag: "ellipse",
      attrs: {
        cx: "64",
        cy: "64",
        rx: "52",
        ry: "18",
        stroke: "url(#" + GBH_INSTANCE_TOKEN + "arc)",
        strokeWidth: "3",
        strokeLinecap: "round",
        transform: "rotate(-18 64 64)",
      },
    },
    {
      tag: "ellipse",
      attrs: { cx: "64", cy: "64", rx: "40", ry: "12", stroke: "#6ee7f0", strokeOpacity: "0.45", strokeWidth: "1.5", transform: "rotate(-18 64 64)" },
    },
  ],
};

/** Favicon thuong hieu duoi dang artwork (dung cho lop vo L3 sau nay). */
export const GBH_FAVICON_ARTWORK: GbhIconArtwork = {
  viewBox: GBH_FAVICON_VIEWBOX,
  size: 32,
  root: { fill: "none", xmlns: "http://www.w3.org/2000/svg" },
  component: "favicon.svg (Galaxy Blackhole)",
  nodes: [
    {
      tag: "defs",
      attrs: {},
      children: [
        {
          tag: "linearGradient",
          attrs: { id: GBH_INSTANCE_TOKEN + "a", x1: "8", y1: "14", x2: "56", y2: "50", gradientUnits: "userSpaceOnUse" },
          children: [
            { tag: "stop", attrs: { stopColor: "#a99bff" } },
            { tag: "stop", attrs: { offset: "1", stopColor: "#6ee7f0" } },
          ],
        },
      ],
    },
    { tag: "rect", attrs: { width: "64", height: "64", rx: "14", fill: "#0b0a14" } },
    { tag: "circle", attrs: { cx: "32", cy: "32", r: "11", fill: "#05040a" } },
    { tag: "circle", attrs: { cx: "32", cy: "32", r: "11", stroke: "#a99bff", strokeWidth: "1.5" } },
    {
      tag: "ellipse",
      attrs: { cx: "32", cy: "32", rx: "25", ry: "9", stroke: "url(#" + GBH_INSTANCE_TOKEN + "a)", strokeWidth: "2.5", transform: "rotate(-18 32 32)" },
    },
  ],
};

/** Thuoc tinh chung cua hai component thuong hieu. */
export interface GbhBrandProps {
  /** Kich thuoc px (logo lay ca rong lan cao; chu lay co chu). */
  size?: number;
  /** Class ngoai. */
  className?: string;
}

/**
 * Tao component `GbhLogo` (dau ho den) gan voi jsx runtime cua bundle.
 * Nhận: runtime — cap ham jsx/jsxs.
 * Trả: component nhan { size, className } va tra `svg` logo thuong hieu (aria-hidden).
 */
export function createGbhLogo(runtime: GbhJsxRuntime): (props: GbhBrandProps) => unknown {
  const GbhLogo = (props: GbhBrandProps): unknown =>
    renderStaticArtwork(runtime, GBH_LOGO_ARTWORK, { size: props.size ?? GBH_LOGO_ARTWORK.size, className: props.className });
  return GbhLogo;
}

/**
 * Tao component `GbhWordmark` (chu "Galaxy Blackhole") gan voi jsx runtime cua bundle.
 * Nhận: runtime — cap ham jsx/jsxs.
 * Trả: component nhan { size, className } va tra `span` chu thuong hieu (khong dung font la, khong dat mau).
 */
export function createGbhWordmark(runtime: GbhJsxRuntime): (props: GbhBrandProps) => unknown {
  const GbhWordmark = (props: GbhBrandProps): unknown =>
    runtime.jsx("span", {
      className: props.className,
      style: { ...GBH_WORDMARK_STYLE, fontSize: String(props.size ?? GBH_WORDMARK_FONT_SIZE) + "px" },
      children: GBH_WORDMARK_TEXT,
    });
  return GbhWordmark;
}

/** Kieu artwork dong cua thuong hieu (de ngoai kiem tra kieu khi can). */
export type GbhBrandArtwork = GbhIconArtwork | GbhDynamicArtwork;
