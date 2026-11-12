/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Asset nhung cua lop vo (L3): favicon GBH + manifest GBH — byte-identical voi asset thuong hieu cua ui-primitives
 */

/** Favicon Galaxy Blackhole (vector 64x64) — byte-identical voi packages/client/ui-primitives/assets/gbh-favicon.svg. */
export const GBH_FAVICON_SVG = "<svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n  <defs>\n    <linearGradient id=\"a\" x1=\"8\" y1=\"14\" x2=\"56\" y2=\"50\" gradientUnits=\"userSpaceOnUse\">\n      <stop stop-color=\"#a99bff\"/>\n      <stop offset=\"1\" stop-color=\"#6ee7f0\"/>\n    </linearGradient>\n  </defs>\n  <rect width=\"64\" height=\"64\" rx=\"14\" fill=\"#0b0a14\"/>\n  <circle cx=\"32\" cy=\"32\" r=\"11\" fill=\"#05040a\"/>\n  <circle cx=\"32\" cy=\"32\" r=\"11\" stroke=\"#a99bff\" stroke-width=\"1.5\"/>\n  <ellipse cx=\"32\" cy=\"32\" rx=\"25\" ry=\"9\" stroke=\"url(#a)\" stroke-width=\"2.5\" transform=\"rotate(-18 32 32)\"/>\n</svg>\n";

/** sha256 cua GBH_FAVICON_SVG — test doi chieu lai (N4: asset truy duoc ve nguon). */
export const GBH_FAVICON_SHA256 = "105ca4ce73ac1dc8707715b700dd16113fb6b8e7fa39af9251d3ca44749c4fc3";

/** Manifest PWA cua Galaxy Blackhole — giu HINH DANG manifest goc, doi gia tri sang GBH. */
export const GBH_MANIFEST_JSON = "{\n  \"name\": \"Galaxy Blackhole\",\n  \"short_name\": \"GBH\",\n  \"start_url\": \"./\",\n  \"scope\": \"./\",\n  \"display\": \"fullscreen\",\n  \"background_color\": \"#0b0a14\",\n  \"theme_color\": \"#0b0a14\",\n  \"icons\": [\n    {\n      \"src\": \"favicon.svg\",\n      \"sizes\": \"any\",\n      \"type\": \"image/svg+xml\",\n      \"purpose\": \"any\"\n    }\n  ]\n}\n";
