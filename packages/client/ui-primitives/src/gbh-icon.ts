/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Primitive GbhIcon: tra dac ta icon trong so tra roi dung cay SVG (nhan jsx runtime qua tham so)
 */

import type { GbhJsxRuntime } from "./artwork-types.ts";
import type { GbhIconSpec } from "./artwork-types.ts";
import { resolveGbhArtwork } from "./artwork-registry.ts";
import { nextInstanceId, renderStaticArtwork, type GbhRenderProps } from "./artwork-render.ts";
import { DSH_TO_GBH_ICON, GBH_ICONS } from "./gbh-icon-specs.ts";

/**
 * Ve mot icon theo dac ta (artwork + do dam net + kich thuoc mac dinh).
 * Nhận: runtime — cap ham jsx/jsxs; spec — dac ta icon trong GBH_ICONS; props — size/className.
 * Trả: phan tu svg cua icon, dung nguyen hinh nguon (C7 P1).
 */
export function renderGbhIcon(runtime: GbhJsxRuntime, spec: GbhIconSpec, props: GbhRenderProps = {}): unknown {
  const resolved = resolveGbhArtwork(spec.artwork);
  const options: GbhRenderProps = {
    size: props.size ?? spec.size ?? resolved.size,
    className: props.className,
    strokeWidth: props.strokeWidth ?? spec.strokeWidth,
  };
  if (typeof resolved.artwork === "function") {
    const instanceId = nextInstanceId();
    return resolved.artwork(runtime, { size: options.size ?? 16, className: options.className, strokeWidth: options.strokeWidth, instanceId });
  }
  return renderStaticArtwork(runtime, resolved.artwork, options);
}

/**
 * Tim dac ta icon theo ten GBH hoac ten CU cua DSH.
 * Nhận: name — "gbh:chevron-down-outline-regular" hoac "IconChevronDownOutlineRegular".
 * Trả: dac ta icon, hoac undefined khi khong co (nguoi goi tu quyet bao loi).
 */
export function findGbhIconSpec(name: string): GbhIconSpec | undefined {
  const direct = GBH_ICONS[name];
  if (direct !== undefined) return direct;
  const mapped = DSH_TO_GBH_ICON[name];
  if (mapped === undefined) return undefined;
  return GBH_ICONS[mapped];
}

/** Thuoc tinh cua component GbhIcon. */
export interface GbhIconProps {
  /** Ten icon GBH (hoac ten CU cua DSH — tu tra qua DSH_TO_GBH_ICON). */
  name: string;
  /** Kich thuoc px; vang mat thi lay mac dinh cua icon. */
  size?: number;
  /** Class ngoai. */
  className?: string;
}

/**
 * Tao component GbhIcon gan voi mot jsx runtime (bundle client nhan runtime qua require, khong import React).
 * Nhận: runtime — cap ham jsx/jsxs cua react/jsx-runtime.
 * Trả: component nhan { name, size, className } va tra cay SVG tuong ung.
 */
export function createGbhIcon(runtime: GbhJsxRuntime): (props: GbhIconProps) => unknown {
  const GbhIcon = (props: GbhIconProps): unknown => {
    const spec = findGbhIconSpec(props.name);
    if (spec === undefined) throw new Error("gbh-ui-primitives: khong co icon ten \"" + props.name + "\"");
    return renderGbhIcon(runtime, spec, { size: props.size, className: props.className });
  };
  return GbhIcon;
}
