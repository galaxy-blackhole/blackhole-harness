/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Gom dong cua the chon theo ten nhom do ben goi so huu — dung chung cho loc va ve
 */

import type { OptionGroupLike, SelectOptionLike } from "./types.ts";

/**
 * Gom dong theo ten nhom do ben goi so huu, khong sap xep nhom hay dong.
 * Dong khong co nhom nam chung mot khoi tai lan xuat hien dau tien.
 * Nhan: options — cac dong theo thu tu hien thi.
 * Tra: cac nhom theo thu tu xuat hien dau tien, giu nguyen doi tuong dong goc.
 */
export function groupOptions(options: readonly SelectOptionLike[]): OptionGroupLike[] {
  const groups = new Map<string | undefined, { group: OptionGroupLike["group"]; rows: SelectOptionLike[] }>();
  for (const option of options) {
    const name = option.group?.name;
    const existing = groups.get(name);
    if (existing !== undefined) existing.rows.push(option);
    else groups.set(name, { group: option.group, rows: [option] });
  }
  return [...groups.values()];
}
