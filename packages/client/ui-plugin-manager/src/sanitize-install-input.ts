/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Phan loai dau vao cai dat plugin theo cach KHONG lo thong tin rieng tu — dung chung cho su kien bam va su kien ket qua
 */

/**
 * Giu nguyen ten goi registry va phien ban thuong; moi dau vao khac duoc PHAN LOAI ma KHONG kem noi dung.
 * Nhan: chuoi nguoi dung go vao o cai dat (spec).
 * Tra: dinh danh an toan de gui di — khong kem thong tin dang nhap URL, token, hay duong dan cuc bo.
 */
export function sanitizeInstallInput(spec: string): string {
  if (/^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*(?:@[a-z0-9.*^~+<>=| -]+)?$/iu.test(spec)) return spec;
  if (/^(?:git[+:]|git@|github:|gitlab:|bitbucket:)/iu.test(spec)) return "[git]";
  if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(spec)) return "[url]";
  return "[path-or-other]";
}
