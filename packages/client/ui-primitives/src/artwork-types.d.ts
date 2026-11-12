/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kieu du lieu cho bo icon GBH (cay SVG + dac ta) va hang so goc/nguon doi chieu (C7 P1/P2, G4)
 */
/**
 * Cho chen id TUNG THE HIEN trong artwork (gradient/clip/mask). Renderer thay bang id duy nhat moi lan render
 * de hai icon cung artwork tren mot trang khong tranh nhau id.
 */
export declare const GBH_INSTANCE_TOKEN = "\u00A7ID\u00A7";
/** Nguon doi chieu 1:1 cua artwork (G4) — file nguon DSH (MIT) + version da kiem chung. */
export declare const DSH_ARTWORK_SOURCE = "galaxy-vscode-extension/vendor/dsh-client-ui-primitives/lib/index.js (DSH 0.2.0-rc.2, MIT)";
/** Mot the SVG trong artwork: ten the + thuoc tinh tinh (style la object con) + the con. */
export interface GbhSvgNode {
    /** Ten the SVG (vd `path`, `circle`, `defs`, `linearGradient`). */
    tag: string;
    /** Thuoc tinh React-style; gia tri chuoi co the chua {@link GBH_INSTANCE_TOKEN}. */
    attrs: Record<string, string | number | Record<string, string | number>>;
    /** The con, neu co. */
    children?: GbhSvgNode[];
}
/** Artwork nguyen van cua mot icon: khung nhin + thuoc tinh goc + cac the con. */
export interface GbhIconArtwork {
    /** viewBox nguyen van cua nguon. */
    viewBox: string;
    /** Kich thuoc mac dinh (px) cua artwork trong nguon. */
    size: number;
    /** Thuoc tinh dat tren the `<svg>` goc (chi giu cai nguon co). */
    root: {
        /** Gia tri `fill` cua goc (thuong la "none"). */
        fill?: string;
        /** Gia tri `stroke` cua goc (chi artwork ve bang net). */
        stroke?: string;
        /** Gia tri `strokeLinecap` cua goc. */
        strokeLinecap?: string;
        /** Gia tri `strokeLinejoin` cua goc. */
        strokeLinejoin?: string;
        /** namespace SVG neu nguon khai. */
        xmlns?: string;
    };
    /** Cac the con cua `<svg>`. */
    nodes: GbhSvgNode[];
    /** Ten component artwork trong nguon DSH (G4: truy nguoc duoc). */
    component: string;
}
/** Dac ta mot icon GBH: artwork nao, dam net nao, kich thuoc mac dinh. */
export interface GbhIconSpec {
    /** Khoa artwork trong {@link GBH_ARTWORKS}. */
    artwork: string;
    /** Kich thuoc mac dinh (px) khi nguoi goi khong truyen `size`. */
    size: number;
    /** Do day net (1 hoac 1.3); vang mat voi icon chi-to. */
    strokeWidth?: number;
    /** Bien the cua ho tong hop (reference: session/file/folder). */
    variant?: string;
}
/** Cap ham JSX runtime ma bundle nhan qua `require("react/jsx-runtime")` (khong import React). */
export type GbhJsxRuntime = {
    /** Tao MOT phan tu. */
    jsx: (type: unknown, props: Record<string, unknown>) => unknown;
    /** Tao phan tu nhieu con tinh. */
    jsxs: (type: unknown, props: Record<string, unknown>) => unknown;
};
/** Artwork dong (mask/id tinh toan theo do dam net) — nguon co bieu thuc so hoc nen khong the la du lieu tinh. */
export type GbhDynamicArtwork = (runtime: GbhJsxRuntime, props: {
    /** Kich thuoc px. */
    size: number;
    /** Class ngoai. */
    className?: string;
    /** Do day net. */
    strokeWidth?: number;
    /** Id duy nhat cua the hien (mask/gradient). */
    instanceId: string;
}) => unknown;
