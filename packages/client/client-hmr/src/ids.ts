/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hang so dinh danh cua row client-hmr, dung chung cho ca hai nua (host va browser).
 */

/** Ten package cua ta — cung la id module ma bundle client TU KHAI. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-hmr";

/** Ten row trong cordis (giu nguyen ten ban goc nen inject/route khong doi). */
export const ROW_NAME = "client-hmr";

/** Diem cuoi SSE o dang tuyet doi (nua host dang ky route). */
export const EVENTS_ENDPOINT = "/plugins/events";

/** Diem cuoi SSE o dang tuong doi tai lieu (nua browser goi). */
export const EVENTS_ROUTE = EVENTS_ENDPOINT.slice(1);

/** Chu ky bundle dung de phat hien build lai. */
export interface BundleStat {
  /** Duong dan bundle. */
  path: string;
  /** mtime tinh bang ms. */
  mtimeMs: number;
  /** ctime tinh bang ms. */
  ctimeMs: number;
  /** Kich thuoc tinh bang byte. */
  size: number;
}
