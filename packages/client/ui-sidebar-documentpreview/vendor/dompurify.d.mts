/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khai bao kieu cho DOMPurify 3.4.16 da vendor o vendor/dompurify.mjs — chi khai dung phan ma row nay goi
 */

/** Cau hinh sanitize ma row nay dung — nguyen van ten truong cua DOMPurify. */
export interface PurifySanitizeConfig {
  /** Giu ca khung tai lieu (html/head/body) thay vi chi than. */
  WHOLE_DOCUMENT?: boolean;
  /** Danh sach the bi loai bo khoi ket qua. */
  FORBID_TAGS?: readonly string[];
  /** Danh sach thuoc tinh bi loai bo khoi ket qua. */
  FORBID_ATTR?: readonly string[];
}

/** Doi tuong DOMPurify ma vendor xuat mac dinh. */
export interface Purify {
  /** Lam sach HTML va tra chuoi (khong bat RETURN_DOM). */
  sanitize(dirty: string, config?: PurifySanitizeConfig): string;
  /** Phien ban DOMPurify dang chay, vi du "3.4.16". */
  version: string;
}

/** Doi tuong DOMPurify da khoi tao san — vendor/dompurify.mjs xuat mac dinh gia tri nay. */
declare const purify: Purify;

export default purify;
