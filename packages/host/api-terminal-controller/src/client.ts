/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Entry THẬT của nửa client: khai khuôn loader (rows.ts đọc lời gọi load() từ đây), id MỘT-ID của ta,
 *      và tái xuất bộ ghép vỏ + lát để build.ts (Bun.build thứ hai) dùng — file này có người dùng thật.
 */

/** Khuôn MỞ ĐẦU bundle client browser — NGUYÊN VĂN dòng vỏ (id đã là id của ta). */
export const CLIENT_LOADER_SHAPE =
  'window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-api-terminal-controller", factory: (require) => {';

/** Id GỐC của bundle stock — chỉ dùng trong metadata gbh.row.aliases, KHÔNG xuất hiện trong artefact. */
export const STOCK_CLIENT_ID = "@deepseek-ai/dsh-api-terminal-controller";

/** Id của ta — bundle client tự khai ĐÚNG tên này (luật MỘT-ID). */
export const OUR_CLIENT_ID = "@galaxy-blackhole/gbh-api-terminal-controller";

/** Số lát thân của nửa client browser (đếm từ vỏ) — dùng cho test/kiểm nhanh. */
export { assembleClientBundle, readWrapper, type ClientWrapper } from "./assemble-client.ts";