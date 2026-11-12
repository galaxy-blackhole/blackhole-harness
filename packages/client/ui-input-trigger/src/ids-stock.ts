/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Id package GỐC của row ui-input-trigger — CHỈ dùng cho test/host (đối chiếu manifest + đo 0 lần
 *      trong artifact). KHÔNG được import từ src/client.ts, src/plugin.ts hay bất kỳ module đi vào bundle client
 */

/**
 * Tên package GỐC của DSH — nguồn đối chứng cho test/host, KHÔNG BAO GIỜ được load() trong bundle.
 * Luật MỘT-ID (19/10/2026): chuỗi này phải VẮNG hoàn toàn khỏi artifact lib/client.js (kể cả tag CSS và
 * dataset.plugin) — vì vậy nó nằm ở tệp riêng, ngoài mọi nhánh import của nửa client.
 * Nhận: không có.
 * Trả: chuỗi tên package gốc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-input-trigger";
