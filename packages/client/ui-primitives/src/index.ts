/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Diem vao cua goi ui-primitives: bo icon GBH qua GbhIcon + asset thuong hieu + so tra artwork
 */

export type { GbhDynamicArtwork, GbhIconArtwork, GbhIconSpec, GbhJsxRuntime, GbhSvgNode } from "./artwork-types.ts";
export { DSH_ARTWORK_SOURCE, GBH_INSTANCE_TOKEN } from "./artwork-types.ts";
export type { GbhArtworkEntry } from "./artwork-registry.ts";
export { GBH_ARTWORKS, GBH_ARTWORK_ALIASES, GBH_ARTWORK_COUNT, resolveGbhArtwork } from "./artwork-registry.ts";
export type { GbhRenderProps } from "./artwork-render.ts";
export { nextInstanceId, renderStaticArtwork } from "./artwork-render.ts";
export type { GbhIconName } from "./gbh-icon-specs.ts";
export { DSH_TO_GBH_ICON, GBH_ICONS, PERMISSION_ICON_DSH_WEIGHTS, REFERENCE_ICON_DSH_WEIGHTS, SHIELD_OUTLINE_PATH } from "./gbh-icon-specs.ts";
export type { GbhIconProps } from "./gbh-icon.ts";
export { createGbhIcon, findGbhIconSpec, renderGbhIcon } from "./gbh-icon.ts";
export type { GbhBrandProps } from "./brand.ts";
export {
  createGbhLogo,
  createGbhWordmark,
  GBH_FAVICON_ARTWORK,
  GBH_FAVICON_SOURCE_SHA256,
  GBH_FAVICON_VIEWBOX,
  GBH_LOGO_ARTWORK,
  GBH_LOGO_SOURCE_PATH,
  GBH_LOGO_SOURCE_SHA256,
  GBH_LOGO_VIEWBOX,
  GBH_WORDMARK_FONT_SIZE,
  GBH_WORDMARK_STYLE,
  GBH_WORDMARK_TEXT,
} from "./brand.ts";
