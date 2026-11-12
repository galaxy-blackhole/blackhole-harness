/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc So tra artwork GBH: gop 4 phan du lieu + 3 artwork dong + 2 artwork alias, kem ham phan giai theo ten
 */

import { archiveOffArtwork, microphoneArtwork, treeCornerArtwork } from "./artwork-dynamic.ts";
import { GBH_ARTWORK_PART_1 } from "./artwork-part-1.ts";
import { GBH_ARTWORK_PART_2 } from "./artwork-part-2.ts";
import { GBH_ARTWORK_PART_3 } from "./artwork-part-3.ts";
import { GBH_ARTWORK_PART_4 } from "./artwork-part-4.ts";
import type { GbhDynamicArtwork, GbhIconArtwork } from "./artwork-types.ts";

/** Mot artwork co the la du lieu tinh (cay SVG) hoac ham dong (mask/so hoc). */
export type GbhArtworkEntry = GbhIconArtwork | GbhDynamicArtwork;

/** Bang artwork GBH: ten artwork -> cay SVG nguyen van hoac ham dong. */
export const GBH_ARTWORKS: Record<string, GbhArtworkEntry> = Object.freeze({
  ...GBH_ARTWORK_PART_1,
  ...GBH_ARTWORK_PART_2,
  ...GBH_ARTWORK_PART_3,
  ...GBH_ARTWORK_PART_4,
  "IconArchiveOffOutlineArtwork": archiveOffArtwork,
  "IconMicrophoneOutlineArtwork": microphoneArtwork,
  "IconTreeCornerArtwork": treeCornerArtwork,
});

/** Artwork la ALIAS cua artwork khac trong nguon DSH (khong tu ve lai). */
export const GBH_ARTWORK_ALIASES: Record<string, { base: string; size?: number }> = Object.freeze({
  IconPlanOutlineArtwork: { base: "IconListPenOutlineArtwork", size: 14 },
  IconQueueOutlineArtwork: { base: "ChatLinesOutlineArtwork" },
});

/**
 * Phan giai mot ten artwork (ke ca alias) thanh artwork that + kich thuoc mac dinh.
 * Nhan: name — ten artwork trong nguon DSH (vd "IconChevronDownOutlineArtwork").
 * Tra: { artwork, size } — artwork (du lieu tinh hoac ham dong) va kich thuoc mac dinh cua no.
 * Nem: khi ten khong co trong so tra (bao sai ten ngay, khong render rong am tham).
 */
export function resolveGbhArtwork(name: string): { artwork: GbhArtworkEntry; size: number } {
  const direct = GBH_ARTWORKS[name];
  if (direct !== undefined) return { artwork: direct, size: isDynamic(direct) ? 16 : direct.size };
  const alias = GBH_ARTWORK_ALIASES[name];
  if (alias !== undefined) {
    const base = resolveGbhArtwork(alias.base);
    return { artwork: base.artwork, size: alias.size ?? base.size };
  }
  throw new Error("gbh-ui-primitives: khong co artwork ten \"" + name + "\"");
}

/**
 * Cho biet mot entry la ham dong hay du lieu tinh.
 * Nhan: entry — mot entry trong ban do artwork.
 * Tra: true khi entry la ham render dong.
 */
function isDynamic(entry: GbhArtworkEntry): entry is GbhDynamicArtwork {
  return typeof entry === "function";
}

/** So artwork phan giai duoc (du lieu tinh + dong + alias) — dung cho test phu song. */
export const GBH_ARTWORK_COUNT = Object.keys(GBH_ARTWORKS).length + Object.keys(GBH_ARTWORK_ALIASES).length;
