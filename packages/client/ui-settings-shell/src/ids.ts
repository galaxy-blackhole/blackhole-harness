/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hai id module của row ui-settings-shell: id của ta (chính) và id package gốc (phụ)
 */

/** Id package của TA — id CHÍNH của module (để rev của HMR tra đúng dòng trong manifest). */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-settings-shell";

/** Id package GỐC — id PHỤ, để mọi bundle phụ thuộc vẫn tìm thấy module này. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-settings-shell";
