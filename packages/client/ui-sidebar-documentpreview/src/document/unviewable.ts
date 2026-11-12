/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Danh sach hau to nhi phan da biet la khong co renderer — nguyen van tu bundle goc
 */

import { documentFileName, matchedSuffixLength } from "./suffix.ts";

/**
 * Hau to nhi phan da biet la khong co renderer nao nhan. Chu so huu ban xem hien
 * trang thai "khong ho tro" thay cho truong hop lui van ban thuong; bat ky dang ky
 * renderer nao cho hau to do deu thang, vi danh sach nay chi duoc tra khi khong co
 * ban cai dat nao khop. Mot hau to chi thuoc day khi byte cua no KHONG BAO GIO la
 * van ban doc duoc — hau to con nghi ngo thi o ngoai va giu truong hop lui van ban.
 */
export const UNVIEWABLE_BINARY_EXTENSIONS: readonly string[] = [
  "mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v",
  "mp3", "wav", "flac", "ogg", "m4a", "aac", "wma", "opus",
  "zip", "gz", "tgz", "bz2", "xz", "zst", "7z", "rar", "tar", "jar",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "pages", "numbers",
  "exe", "dll", "so", "dylib", "bin", "o", "class", "pyc", "wasm",
  "ttf", "otf", "woff", "woff2", "eot",
  "dmg", "iso", "img", "sqlite", "db", "psd", "ai", "sketch",
  "tiff", "tif", "heic", "heif", "avif",
];

/**
 * Hau to cua ten tep co phai mot container nhi phan da biet ma khong renderer nao nhan khong.
 * Nhan: path — ten tep hoac duong dan da giai ma.
 * Tra: true khi hau to thuoc danh sach nhi phan khong xem duoc.
 */
export function unviewableBinaryPath(path: string): boolean {
  return matchedSuffixLength(documentFileName(path), UNVIEWABLE_BINARY_EXTENSIONS) > 0;
}
