/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khop hau to ten tep, dung chung cho so ban xem va danh sach khong-xem-duoc
 */

/**
 * Chuan hoa mot hau to da khai de so sanh.
 * Nhan: extension — hau to, co hay khong co dau cham dau.
 * Tra: hau to viet thuong, bo dau cham dau.
 */
export function normalizeSuffix(extension: string): string {
  return extension.toLowerCase().replace(/^\./u, "");
}

/**
 * Ten tep ma cac hau to cua mot duong dan duoc doi chieu vao.
 * Nhan: path — ten tep hoac duong dan da giai ma; '\\' cung duoc coi la phan cach.
 * Tra: doan cuoi cua duong dan, viet thuong.
 */
export function documentFileName(path: string): string {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

/**
 * Hau to da khai DAI NHAT dung o cuoi ten tep.
 * Nhan: name — ten tep viet thuong tu {@link documentFileName}; extensions — cac hau to da khai.
 * Tra: do dai hau to khop, hoac 0 khi khong khop.
 */
export function matchedSuffixLength(name: string, extensions: readonly string[]): number {
  return Math.max(0, ...extensions.map(normalizeSuffix).filter((extension) => name.endsWith("." + extension)).map((extension) => extension.length));
}
