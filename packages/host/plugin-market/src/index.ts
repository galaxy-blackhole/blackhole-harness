/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào của @galaxy-blackhole/gbh-plugin-market — mirror 1:1 mặt xuất khẩu của 'lib/types/index.js'
 *      (@deepseek-ai/dsh-plugin-market, vùng #region cuối dòng 257–661): default export class PluginMarket, named
 *      export cùng lớp (row nạp qua default), interface Config và toàn bộ kiểu của namespace 'pluginMarket'.
 */

import PluginMarket from "./service.ts";

/**
 * Service 'pluginMarket' của host: tải, validate và nhớ các chỉ mục thị trường đã cấu hình, rồi chú thích từng
 * plugin bằng dữ kiện cài đặt của hồ sơ. Đây là export mặc định mà row nạp, đúng như bản gốc.
 * Nhận: không — giá trị xuất là chính lớp đã port 1:1 ở './service.ts' (không chép lại thân).
 * Trả: lớp PluginMarket, mang ba phương thức Remote listIndexes/setIndexes/search và hai phương thức nội bộ
 *   entry/document dùng bởi tool 'plugin_market'.
 */
export default PluginMarket;

/**
 * Cùng một lớp PluginMarket, phơi thêm dưới dạng named export để nơi dùng khai theo tên (test A/B, manifest typert)
 * mà không phải đổi sang default import; KHÔNG có bản cài đặt thứ hai.
 * Nhận: không.
 * Trả: đúng lớp PluginMarket của default export (cùng tham chiếu, nên 'instanceof' và đăng ký service là một).
 */
export { PluginMarket };

/**
 * Cấu hình của row: nguồn chỉ mục (trường volatile 'indexes' do Settings ghi) và ba trần tải.
 * Nhận: không — chỉ là kiểu, không phát sinh mã lúc chạy.
 * Trả: kiểu Config mà 'static Config' của lớp phân giải từ schema schemastery.
 */
export type { Config } from "./service.ts";

/**
 * Toàn bộ kiểu dữ liệu JSON-safe và bản ghi của namespace 'pluginMarket' (MarketIndexSummary,
 * MarketListingEntry, MarketQuery, MarketSearchResult, MarketInstallation, MarketCompatibility, mã lỗi...), đúng
 * như 'export type * from "./types.ts"' của bản gốc.
 * Nhận: không — chỉ là kiểu.
 * Trả: các kiểu của './types.ts' được tái xuất nguyên vẹn cho nơi dùng.
 */
export type * from "./types.ts";
