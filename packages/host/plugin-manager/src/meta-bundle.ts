/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Dựng `meta` hiển thị (tiêu đề/mô tả tiếng Việt + icon thật) cho một bundle, dùng CHUNG cho mọi nhánh
 *      trả về của `listBundles` để bundle đang TẮT không rơi về chuỗi stock tiếng Anh trong package.json.
 */

import { bundleMetaVi, ICON_BUNDLE_GBH } from "@galaxy-blackhole/gbh-host-bundle-labels";
import type { BundleInfo } from "./types.ts";

/** Phần `meta` dùng lại được của một bundle trong payload `listBundles`. */
export type MetaBundle = Pick<BundleInfo, "meta"> | Record<string, never>;

/**
 * Dựng `meta` cho một bundle: ưu tiên bảng tiếng Việt của ta (`bundleMetaVi`), thêm icon THẬT nếu có, và rơi về
 * `catalogMeta` khi bảng không có entry.
 * Nhận: name — tên gói bundle; quyTenName — tên thay thế để tra bảng; catalogMeta — meta dự phòng từ catalog.
 * Trả: object `{ meta }` hoặc object rỗng để spread vào entry của bundle.
 * @param name - tên gói bundle trong payload.
 * @param quyTenName - tên thay thế (dạng stock hoặc GBH) để tra bảng từ điển.
 * @param catalogMeta - meta dự phòng (từ catalog `official`), có thể rỗng.
 * @returns object chứa `meta` đã bản địa hoá, hoặc rỗng.
 */
export function metaBundle(name: string, quyTenName: string | undefined, catalogMeta: MetaBundle): MetaBundle {
  const chuTa = bundleMetaVi(name, quyTenName);
  if (chuTa === undefined) return catalogMeta;
  const goc = (catalogMeta as Pick<BundleInfo, "meta">).meta;
  const icon = ICON_BUNDLE_GBH[name];
  const meta: BundleInfo["meta"] = { ...(goc ?? {}), title: chuTa.title, description: chuTa.description };
  return { meta: icon === undefined ? meta : { ...meta, icon } };
}
