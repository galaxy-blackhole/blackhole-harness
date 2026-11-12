/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Thu tu hien thi provider dung chung cho composer va bo chon model cua lenh — port 1:1
 */

/**
 * Dat provider tai khoan va provider chinh thuc len dau, giu nguyen tuong quan cua cac provider con lai.
 * Nhận: groups — cac nhom provider theo thu tu danh muc.
 * Trả: mot ban sao da sap xep; thu tu model trong tung nhom khong doi.
 */
export function orderModelProviders<T extends { readonly id: string }>(groups: readonly T[]): T[] {
  return groups.toSorted(
    (left, right) =>
      (left.id === "deepseek-account" ? 0 : left.id === "deepseek-official" ? 1 : 2) -
      (right.id === "deepseek-account" ? 0 : right.id === "deepseek-official" ? 1 : 2),
  );
}
