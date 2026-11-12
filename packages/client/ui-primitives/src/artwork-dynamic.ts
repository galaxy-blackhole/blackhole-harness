/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ba artwork DONG cua nguon DSH (mask id + so hoc theo do dam net) — port 1:1, khong the bieu dien bang du lieu tinh
 */

import type { GbhDynamicArtwork, GbhJsxRuntime } from "./artwork-types.ts";

/** Ve artwork IconArchiveOffOutline (mask che net cheo) 1:1 voi nguon DSH. */
export const archiveOffArtwork: GbhDynamicArtwork = (runtime: GbhJsxRuntime, props) => {
  const strokeWidth = props.strokeWidth ?? 1;
  const maskId = props.instanceId + "-archive-off";
  return runtime.jsxs("svg", {
    width: props.size,
    height: props.size,
    className: props.className,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    strokeWidth: props.strokeWidth,
    children: [
      runtime.jsxs("mask", {
        id: maskId,
        maskUnits: "userSpaceOnUse",
        x: "0",
        y: "0",
        width: "16",
        height: "16",
        children: [
          runtime.jsx("rect", { x: "0", y: "0", width: "16", height: "16", fill: "white", stroke: "none" }),
          runtime.jsx("path", { d: "m2.2 1.3 11.6 12.8", stroke: "black", strokeWidth: strokeWidth + 3 }),
        ],
      }),
      runtime.jsxs("g", {
        mask: "url(#" + maskId + ")",
        children: [
          runtime.jsx("rect", { x: "1.9", y: "2.1", width: "12.2", height: "3.4", rx: "1.1" }),
          runtime.jsx("path", { d: "M2.95 5.7v4.8a2.9 2.9 0 0 0 2.9 2.9h4.3a2.9 2.9 0 0 0 2.9-2.9V5.7" }),
        ],
      }),
      runtime.jsx("path", { d: "m2.2 1.3 11.6 12.8" }),
    ],
  });
};

/** Ve artwork IconMicrophoneOutline (hinh chu nhat noi suy theo do dam net) 1:1 voi nguon DSH. */
export const microphoneArtwork: GbhDynamicArtwork = (runtime: GbhJsxRuntime, props) => {
  const strokeWidth = props.strokeWidth ?? 1;
  return runtime.jsxs("svg", {
    width: props.size,
    height: props.size,
    viewBox: "0 0 16 16",
    className: props.className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: props.strokeWidth,
    "aria-hidden": "true",
    children: [
      runtime.jsx("rect", {
        x: 4.5 + strokeWidth / 2,
        y: 1 + strokeWidth / 2,
        width: 7 - strokeWidth,
        height: 10 - strokeWidth,
        rx: (7 - strokeWidth) / 2,
      }),
      runtime.jsx("path", { d: "M2.35 8.675C3.075 11.3 5.2 13.125 8 13.125C10.8 13.125 12.925 11.3 13.65 8.675M8 13.125V15" }),
    ],
  });
};

/** Ve artwork IconTreeCorner (rong = size * 8 / 10) 1:1 voi nguon DSH. */
export const treeCornerArtwork: GbhDynamicArtwork = (runtime: GbhJsxRuntime, props) => {
  return runtime.jsx("svg", {
    width: (props.size * 8) / 10,
    height: props.size,
    className: props.className,
    viewBox: "0 0 9 11",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": "true",
    strokeWidth: props.strokeWidth,
    children: runtime.jsx("path", {
      d: "M0.5 0V7C0.5 7.79565 0.81607 8.55871 1.37868 9.12132C1.94129 9.68393 2.70435 10 3.5 10H8.5",
      stroke: "currentColor",
    }),
  });
};
