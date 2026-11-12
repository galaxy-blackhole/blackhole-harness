/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Renderer artwork thuan (khong phu thuoc so tra): dung cay SVG tu du lieu artwork + jsx runtime
 */

import type { GbhIconArtwork, GbhJsxRuntime, GbhSvgNode } from "./artwork-types.ts";
import { GBH_INSTANCE_TOKEN } from "./artwork-types.ts";

/** Dem the hien de id gradient/clip/mask KHONG trung nhau giua hai icon cung artwork tren mot trang. */
let instanceSeq = 0;

/**
 * Cap mot id the hien moi (duy nhat trong pham vi module).
 * Nhận: khong.
 * Trả: chuoi id ngan, duy nhat theo thu tu render.
 */
export function nextInstanceId(): string {
  instanceSeq += 1;
  return "gbh" + instanceSeq.toString(36);
}

/**
 * Thay token the hien trong mot gia tri chuoi.
 * Nhận: value — gia tri co the chua GBH_INSTANCE_TOKEN; instanceId — id cua the hien.
 * Trả: chuoi da thay token (hoac nguyen van neu khong co token).
 */
function substitute(value: string, instanceId: string): string {
  if (!value.includes(GBH_INSTANCE_TOKEN)) return value;
  return value.split(GBH_INSTANCE_TOKEN).join(instanceId);
}

/**
 * Chuyen thuoc tinh cua mot the: thay token va giu nguyen kieu so/object.
 * Nhận: attrs — thuoc tinh tho trong so tra; instanceId — id cua the hien.
 * Trả: object thuoc tinh san sang dua cho jsx runtime.
 */
function renderAttrs(attrs: GbhSvgNode["attrs"], instanceId: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === "string") out[key] = substitute(value, instanceId);
    else if (typeof value === "number") out[key] = value;
    else {
      const nested: Record<string, string | number> = {};
      for (const [innerKey, innerValue] of Object.entries(value)) {
        nested[innerKey] = typeof innerValue === "string" ? substitute(innerValue, instanceId) : innerValue;
      }
      out[key] = nested;
    }
  }
  return out;
}

/**
 * Dung mot the SVG (de quy xuong the con) bang jsx runtime nhan qua tham so.
 * Nhận: runtime — cap ham jsx/jsxs; node — the trong so tra; instanceId — id cua the hien.
 * Trả: phan tu React da dung xong (mot the hoac cay the).
 */
function renderNode(runtime: GbhJsxRuntime, node: GbhSvgNode, instanceId: string): unknown {
  const attrs = renderAttrs(node.attrs, instanceId);
  const children = node.children;
  if (children === undefined || children.length === 0) return runtime.jsx(node.tag, attrs);
  const rendered = children.map((child) => renderNode(runtime, child, instanceId));
  if (rendered.length === 1) return runtime.jsx(node.tag, { ...attrs, children: rendered[0] });
  return runtime.jsxs(node.tag, { ...attrs, children: rendered });
}

/** Tuy chon khi ve mot artwork/icon: kich thuoc px, class ngoai, do day net. */
export interface GbhRenderProps {
  /** Kich thuoc px; vang mat thi lay kich thuoc mac dinh cua artwork. */
  size?: number;
  /** Class ngoai dat len the svg. */
  className?: string;
  /** Do day net; vang mat thi lay tu dac ta icon. */
  strokeWidth?: number;
}

/**
 * Ve mot artwork du lieu TINH thanh cay SVG (khong phu thuoc so tra — dung duoc cho asset thuong hieu).
 * Nhận: runtime — cap ham jsx/jsxs; artwork — artwork tinh; props — size/className/strokeWidth.
 * Trả: phan tu svg da dung (aria-hidden, fill/stroke nguyen van tu nguon).
 */
export function renderStaticArtwork(runtime: GbhJsxRuntime, artwork: GbhIconArtwork, props: GbhRenderProps = {}): unknown {
  const instanceId = nextInstanceId();
  const size = props.size ?? artwork.size;
  const root = artwork.root;
  const attrs: Record<string, unknown> = { width: size, height: size, viewBox: artwork.viewBox };
  if (props.className !== undefined) attrs.className = props.className;
  if (root.fill !== undefined) attrs.fill = root.fill;
  if (root.xmlns !== undefined) attrs.xmlns = root.xmlns;
  if (root.stroke !== undefined) attrs.stroke = root.stroke;
  if (root.strokeLinecap !== undefined) attrs.strokeLinecap = root.strokeLinecap;
  if (root.strokeLinejoin !== undefined) attrs.strokeLinejoin = root.strokeLinejoin;
  attrs["aria-hidden"] = "true";
  if (props.strokeWidth !== undefined) attrs.strokeWidth = props.strokeWidth;
  const rendered = artwork.nodes.map((node) => renderNode(runtime, node, instanceId));
  if (rendered.length === 1) return runtime.jsx("svg", { ...attrs, children: rendered[0] });
  return runtime.jsxs("svg", { ...attrs, children: rendered });
}
