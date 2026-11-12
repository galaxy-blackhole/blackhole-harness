/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Ba id module của row ui-sidebar-terminal: entry chính, entry phụ và chunk lazy
 */

/** Id package của TA — id CHÍNH của entry. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-sidebar-terminal";

/** Id package GỐC — id PHỤ, để mọi bundle phụ thuộc vẫn tìm thấy module này. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-sidebar-terminal";

/** Tên file chunk lazy nằm cạnh client.js trong lib/. */
export const CHUNK_FILE = "client.terminal.js";
