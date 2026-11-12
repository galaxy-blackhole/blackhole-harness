/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Renderer artwork thuan (khong phu thuoc so tra): dung cay SVG tu du lieu artwork + jsx runtime
 */
import type { GbhIconArtwork, GbhJsxRuntime } from "./artwork-types.ts";
/**
 * Cap mot id the hien moi (duy nhat trong pham vi module).
 * Nhận: khong.
 * Trả: chuoi id ngan, duy nhat theo thu tu render.
 */
export declare function nextInstanceId(): string;
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
export declare function renderStaticArtwork(runtime: GbhJsxRuntime, artwork: GbhIconArtwork, props?: GbhRenderProps): unknown;
