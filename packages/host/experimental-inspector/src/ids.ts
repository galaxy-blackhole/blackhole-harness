/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Danh tính module client của inspector: id module CỦA TA thay id stock trong bundle client (bề mặt 2 mặt).
 */

/** Id package CỦA TA. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-experimental-inspector";

/** Tên gói gốc (CHỈ ĐỌC). */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-experimental-inspector";

/** Id module client CỦA TA (gbh.row.moduleIds). */
export const CLIENT_MODULE_ID = PACKAGE_NAME;

/** Id module client của bản gốc (gbh.row.aliases). */
export const STOCK_CLIENT_MODULE_ID = STOCK_PACKAGE_NAME;

/** Thư mục lib của bundle gốc. */
export const STOCK_LIB_DIR = "apps/host/node_modules/@deepseek-ai/dsh-experimental-inspector/lib";

/** Số lát của host bundle (de-bundle theo region index.js). */
export const HOST_PART_COUNT = 5;
