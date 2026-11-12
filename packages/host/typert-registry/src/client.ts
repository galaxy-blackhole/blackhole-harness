/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Entry THAT cua nua client BROWSER: khai khuon loader (MOT-ID cua ta) + tai xuat bo ghep vo + lat.
 */

/** Khuôn MỞ ĐẦU bundle client browser — NGUYÊN VĂN dòng vỏ (id đã là id của ta). */
export const CLIENT_LOADER_SHAPE =
  'window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-typert-registry", factory: (require) => {';

/** Id GỐC của bundle stock — chỉ dùng trong metadata gbh.row.aliases, KHÔNG xuất hiện trong artefact. */
export const STOCK_CLIENT_ID = "@deepseek-ai/dsh-typert-registry";

/** Id của ta — bundle client tự khai ĐÚNG tên này (luật MỘT-ID). */
export const OUR_CLIENT_ID = "@galaxy-blackhole/gbh-typert-registry";

export { assembleClientBundle, readWrapper, type ClientWrapper } from "./assemble-client.ts";
