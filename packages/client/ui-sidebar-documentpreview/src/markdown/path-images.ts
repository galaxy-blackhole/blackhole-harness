/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Anh Markdown cuc bo duoc phuc vu qua tuyen tep da xac thuc
 */

import { fileMediaUrl, isAbsoluteWorkspacePath, pathPartsOf } from "../workspace-path.ts";

/**
 * Dung URL tep, giai cac dich tuong doi nam canh tep dang xem.
 * Nhan: base — URI goc cua tai lieu; documentPath — duong dan nguon tuyet doi Host bao, neu co;
 *        destination — URL anh do tac gia viet.
 * Tra: URL tep kieu Web hoac Desktop, hoac undefined voi dich khong ho tro / sai dinh dang.
 */
export function markdownImageUrl(base: string, documentPath: string | undefined, destination: string): string | undefined {
  const suffix = destination.search(/[?#]/u);
  let path: string;
  try {
    path = decodeURIComponent(suffix === -1 ? destination : destination.slice(0, suffix));
  } catch {
    return undefined;
  }
  if (path.length === 0) return undefined;
  if (!/^[a-z]:[/\\]/iu.test(path) && /^[a-z][a-z\d+.-]*:/iu.test(path)) return undefined;
  if (!isAbsoluteWorkspacePath(path)) {
    if (documentPath === undefined) return undefined;
    path = pathPartsOf(documentPath).directory + path;
  }
  return fileMediaUrl(base, path);
}
