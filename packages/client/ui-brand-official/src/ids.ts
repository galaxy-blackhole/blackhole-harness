/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-brand-official — mot id module, hai ten slot nguyen van
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra) — KHONG khai id cua goi goc: no thuoc gbh.row.aliases va tang nap
 * TU sinh entry alias tro ve cung URL bundle. Mot bundle MOT id.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-brand-official";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio dang ky trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-brand-official";

/**
 * Ten slot chua DAU CHINH THUC — nguyen van tu bundle goc.
 * Nhan: khong co.
 * Tra: chuoi ten slot.
 */
export const SLOT_MARK = "sidebar.brand.mark";

/**
 * Ten slot chua TEN THUONG HIEU — nguyen van tu bundle goc.
 * Nhan: khong co.
 * Tra: chuoi ten slot.
 */
export const SLOT_NAME = "sidebar.brand.name";
