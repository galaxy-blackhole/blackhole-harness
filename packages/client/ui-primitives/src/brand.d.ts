/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Asset thuong hieu Galaxy Blackhole (logo ho den + favicon + chu thuong hieu) — thay asset DSH, 1 nguon duy nhat
 */
import type { GbhDynamicArtwork, GbhIconArtwork, GbhJsxRuntime } from "./artwork-types.ts";
/**
 * Nguon goc cua asset thuong hieu (G4): file vector chuan trong repo Galaxy.
 * Hai ban sao (electron + web oracle) TRUNG sha256; day la ban duoc chep vao assets/ cua goi nay.
 */
export declare const GBH_LOGO_SOURCE_PATH = "galaxy-blackhole/blackhole-desktop-electron/host/cli/web/brand/logo.svg";
/** sha256 cua logo.svg goc (kiem bang shasum -a 256) — test N4 doi chieu lai. */
export declare const GBH_LOGO_SOURCE_SHA256 = "d7fac4b4c9d2b4b876e0e354a6d650cea2249dddb84247179e94b58e564333d9";
/** sha256 cua favicon.svg goc. */
export declare const GBH_FAVICON_SOURCE_SHA256 = "105ca4ce73ac1dc8707715b700dd16113fb6b8e7fa39af9251d3ca44749c4fc3";
/** viewBox cua logo thuong hieu (vector 128x128, vuong). */
export declare const GBH_LOGO_VIEWBOX = "0 0 128 128";
/** viewBox cua favicon thuong hieu (vector 64x64). */
export declare const GBH_FAVICON_VIEWBOX = "0 0 64 64";
/** Chu thuong hieu hien o slot sidebar.brand.name (nguon: oracle A — `GbhBrandName`). */
export declare const GBH_WORDMARK_TEXT = "Galaxy Blackhole";
/** Co chu thuong hieu (px) — nguyen van tu oracle A. */
export declare const GBH_WORDMARK_FONT_SIZE = 14;
/** Kieu chu thuong hieu — nguyen van tu oracle A (khong dung font la, khong dat mau). */
export declare const GBH_WORDMARK_STYLE: Readonly<{
    readonly fontWeight: 600;
    readonly letterSpacing: "0.01em";
    readonly whiteSpace: "nowrap";
}>;
/**
 * Logo thuong hieu duoi dang artwork: ho den + vanh gradient. Mau nam trong ASSET (khong phai style component)
 * theo C7 P4; id gradient dung token the hien de hai lan render khong tranh id.
 */
export declare const GBH_LOGO_ARTWORK: GbhIconArtwork;
/** Favicon thuong hieu duoi dang artwork (dung cho lop vo L3 sau nay). */
export declare const GBH_FAVICON_ARTWORK: GbhIconArtwork;
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
export declare function createGbhLogo(runtime: GbhJsxRuntime): (props: GbhBrandProps) => unknown;
/**
 * Tao component `GbhWordmark` (chu "Galaxy Blackhole") gan voi jsx runtime cua bundle.
 * Nhận: runtime — cap ham jsx/jsxs.
 * Trả: component nhan { size, className } va tra `span` chu thuong hieu (khong dung font la, khong dat mau).
 */
export declare function createGbhWordmark(runtime: GbhJsxRuntime): (props: GbhBrandProps) => unknown;
/** Kieu artwork dong cua thuong hieu (de ngoai kiem tra kieu khi can). */
export type GbhBrandArtwork = GbhIconArtwork | GbhDynamicArtwork;
