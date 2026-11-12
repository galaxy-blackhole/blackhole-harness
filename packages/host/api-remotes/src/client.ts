/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Entry NỬA CLIENT của api-remotes: API ghép bundle browser từ 24 part nguyên văn + vỏ loader;
 *      build.ts dùng chính module này, và đây là đầu vào build THỨ HAI (bằng chứng build nửa client).
 */

/**
 * Nửa client của row api-remotes được sinh từ ba thành phần:
 *   1. src/client-parts/part-NN.txt — 24 lát NGUYÊN VĂN (phần thân) cắt từ bundle gốc;
 *   2. src/client-wrapper.json     — 3 dòng vỏ đầu (id đã đổi sang id của ta) + 6 dòng vỏ cuối;
 *   3. module này                  — API ghép, dùng bởi build.ts và bởi cổng byte.
 * Artifact: lib/client.js (23.698 dòng, trùng bản gốc sau quy đổi ĐÚNG MỘT dòng id module).
 */

/** Id GỐC trong bundle client (dòng id duy nhất được quy đổi). */
export const STOCK_CLIENT_ID = "@deepseek-ai/dsh-api-remotes";

/** Id của ta — bundle client tự khai ĐÚNG một id này (luật MỘT-ID). */
export const OUR_CLIENT_ID = "@galaxy-blackhole/gbh-api-remotes";

/**
 * Khuôn MỞ ĐẦU của bundle client — NGUYÊN VĂN dòng vỏ (id đã là id của ta).
 * build.ts đối chiếu 3 dòng vỏ thật trong client-wrapper.json với khuôn này, nên hằng số vừa là tài liệu
 * vừa là phép kiểm; tools/check/rows.ts cũng đọc được lời gọi load() từ đây.
 */
export const CLIENT_LOADER_SHAPE =
  'window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-api-remotes", factory: (require) => {';

export { assembleClient, readWrapper, type ClientWrapper } from "./client-assemble.ts";

/**
 * Số nửa client mà gói sinh ra.
 * Nhận: không.
 * Trả: 1 (chỉ browser — gói gốc không có nửa node riêng cho row này).
 */
export function clientHalfCount(): number {
  return 1;
}
