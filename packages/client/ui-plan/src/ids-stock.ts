/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Id package GỐC của row ui-plan — chỉ để test/host đối chiếu; KHÔNG nhánh client nào được import
 */

/**
 * Tên package GỐC của DSH — nguồn đối chiếu cho test/host (gbh.row.aliases, phép đo 0 lần trong artifact).
 * Luật MỘT-ID (19/10/2026): chuỗi này phải VẮNG hoàn toàn khỏi lib/client.js (kể cả tag CSS, dataset.plugin,
 * hằng tài liệu, chunk) — vì vậy nó nằm ở tệp riêng, NGOÀI mọi nhánh import của nửa client.
 * Nhận: không có.
 * Trả: chuỗi tên package gốc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-plan";
