/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Entry NUA CLIENT cua typert-gateway: API ghep hai ban client (browser/node) tu lat nguyen van —
 *      build.ts dung chinh module nay, va no la dau vao build thu 2 (bang chung build nua client)
 */

/**
 * Nửa client của row typert-gateway được sinh từ ba thành phần:
 *   1. src/client-parts/<phía>/part-NN.ts — các lát NGUYÊN VĂN cắt từ bundle gốc;
 *   2. src/client-wrapper.<phía>.json     — dòng vỏ đầu/cuối (browser: dòng id đã đổi sang id của ta);
 *   3. module này                          — API ghép, dùng bởi build.ts và bởi phép kiểm byte.
 * Artifact: lib/client.browser.js (2.186 dòng, trùng bản gốc sau quy đổi đúng 1 dòng id)
 * và lib/client.node.js (1.991 dòng, byte-identical).
 */

/** Hai phía của nửa client mà gói này sinh ra. */
export const CLIENT_SIDES = ["browser", "node"] as const;

/** Một phía của nửa client. */
export type ClientSide = (typeof CLIENT_SIDES)[number];

/** Id GỐC trong bundle client browser (dòng id duy nhất được quy đổi). */
export const STOCK_CLIENT_ID = "@deepseek-ai/dsh-api-gateway";

/** Id của ta — bundle client tự khai ĐÚNG một id này (luật MỘT-ID). */
export const OUR_CLIENT_ID = "@galaxy-blackhole/gbh-host-typert-gateway";

/**
 * Khuôn MỞ ĐẦU của bundle client browser — NGUYÊN VĂN dòng vỏ (id đã là id của ta).
 * build.ts đối chiếu 3 dòng vỏ thật trong client-wrapper.browser.json với khuôn này, nên hằng số vừa là
 * tài liệu vừa là phép kiểm; tools/check/rows.ts cũng đọc được lời gọi load() từ đây.
 */
export const CLIENT_LOADER_SHAPE =
  'window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-host-typert-gateway", factory: (require) => {';

export { assembleClient, readWrapper, stripPartScaffold, type ClientWrapper } from "./client-assemble.ts";

/**
 * Số phía nửa client mà gói sinh ra.
 * Nhận: không.
 * Trả: 2 (browser + node).
 */
export function clientHalfCount(): number {
  return CLIENT_SIDES.length;
}
